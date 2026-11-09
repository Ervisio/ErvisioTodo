import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync, backup } from "node:sqlite";
import { pipeline } from "node:stream/promises";
import { createGunzip, createGzip } from "node:zlib";
import { z } from "zod";
import { closeDB, db } from "./db";
import { HttpError, insist } from "./security";
import { recordActivity } from "./settings";
import {
  backupName,
  driverFor,
  mapSecrets,
  secretFields,
  seal,
  targetSchema,
  unseal,
  type RemoteFile,
  type Target,
} from "./remote-storage";

const intervalHours = z
    .number()
    .int()
    .min(0)
    .max(24 * 90),
  keep = z.number().int().min(1).max(365);
const stateSchema = z.object({
  target: z.unknown().nullable().default(null),
  intervalHours: intervalHours.default(24),
  keep: keep.default(14),
  lastRunAt: z.number().nullable().default(null),
  lastOk: z.boolean().nullable().default(null),
  lastMessage: z.string().default(""),
});
type State = z.infer<typeof stateSchema>;

const dataDir = () => resolve(process.env.DATA_DIR || "./data");
const scratch = () => {
  const dir = resolve(dataDir(), "tmp");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
};

function readState(): State {
  const row = db()
    .prepare("SELECT value FROM settings WHERE key='backup'")
    .get() as { value: string } | undefined;
  return stateSchema.parse(row ? JSON.parse(row.value) : {});
}
function writeState(state: State) {
  db()
    .prepare(
      "INSERT INTO settings(key,value) VALUES('backup',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    )
    .run(JSON.stringify(state));
}
/** The stored target with secrets decrypted; undefined when none is set or it cannot be read. */
function storedTarget(state = readState()): Target | undefined {
  if (!state.target) return undefined;
  try {
    return mapSecrets(targetSchema.parse(state.target), unseal);
  } catch {
    return undefined;
  }
}

export type PublicBackupConfig = Omit<State, "target"> & {
  target: Target | null;
  /** Which secret fields hold a value; the values themselves are never sent. */
  secretsSet: string[];
  running: boolean;
};
export function backupConfig(): PublicBackupConfig {
  const state = readState(),
    target = storedTarget(state);
  return {
    ...state,
    target: target ? mapSecrets(target, () => "") : null,
    secretsSet: target
      ? secretFields[target.type].filter(
          (key) => (target as Record<string, unknown>)[key],
        )
      : [],
    running,
  };
}

const patchSchema = z.object({
  target: z.unknown().optional(),
  intervalHours: intervalHours.optional(),
  keep: keep.optional(),
});
/** A submitted target where blank secrets fall back to the stored ones for the same kind of storage. */
function mergedTarget(input: unknown): Target {
  const next = targetSchema.parse(input),
    current = storedTarget();
  if (current?.type !== next.type) return next;
  const merged: Record<string, unknown> = { ...next };
  for (const key of secretFields[next.type])
    if (!merged[key]) merged[key] = (current as Record<string, unknown>)[key];
  return merged as Target;
}
export function saveBackupConfig(input: unknown) {
  const patch = patchSchema.parse(input),
    state = readState();
  if (patch.target === null) state.target = null;
  else if (patch.target)
    state.target = mapSecrets(mergedTarget(patch.target), seal);
  if (patch.intervalHours !== undefined)
    state.intervalHours = patch.intervalHours;
  if (patch.keep !== undefined) state.keep = patch.keep;
  insist(
    !state.intervalHours || state.target,
    400,
    "Scegli dove salvare i backup prima di attivare la pianificazione.",
  );
  writeState(state);
}

export async function testBackupTarget(input?: unknown) {
  const target = input ? mergedTarget(input) : storedTarget();
  insist(target, 400, "Configura prima l’archiviazione esterna.");
  try {
    return await driverFor(target).check();
  } catch (e) {
    throw remoteError(e);
  }
}

/** Remote failures keep their message for the admin but never carry credentials. */
function remoteError(e: unknown) {
  if (e instanceof HttpError) return e;
  const message = e instanceof Error ? e.message : "errore sconosciuto";
  return new HttpError(502, `Archiviazione esterna: ${message}`.slice(0, 300));
}

export async function listBackups(): Promise<RemoteFile[]> {
  const target = storedTarget();
  if (!target) return [];
  try {
    return await driverFor(target).list();
  } catch (e) {
    throw remoteError(e);
  }
}

let running = false;
async function exclusive<T>(job: () => Promise<T>) {
  insist(!running, 409, "Un’altra operazione di backup è già in corso.");
  running = true;
  try {
    return await job();
  } finally {
    running = false;
  }
}

const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");

export function runBackup(actorId?: string) {
  return exclusive(async () => {
    const target = storedTarget();
    insist(target, 400, "Configura prima l’archiviazione esterna.");
    const dir = scratch(),
      id = stamp(),
      raw = resolve(dir, `ervisio-${id}.sqlite`),
      packed = `${raw}.gz`,
      name = `ervisio-${id}.sqlite.gz`;
    const state = readState();
    try {
      await backup(db(), raw);
      await pipeline(
        createReadStream(raw),
        createGzip(),
        createWriteStream(packed, { mode: 0o600 }),
      );
      const driver = driverFor(target);
      await driver.put(packed, name);
      const extra = (await driver.list()).slice(state.keep);
      for (const file of extra) await driver.remove(file.name);
      state.lastOk = true;
      state.lastMessage = `${name} (${Math.ceil(statSync(packed).size / 1024)} KB)`;
      if (actorId) recordActivity(actorId, "backup.run", name);
      return name;
    } catch (e) {
      state.lastOk = false;
      state.lastMessage = remoteError(e).message;
      throw remoteError(e);
    } finally {
      state.lastRunAt = Date.now();
      writeState({ ...readState(), ...pick(state) });
      rmSync(raw, { force: true });
      rmSync(packed, { force: true });
    }
  });
}
const pick = ({ lastRunAt, lastOk, lastMessage }: State) => ({
  lastRunAt,
  lastOk,
  lastMessage,
});

const REQUIRED_TABLES = ["users", "lists", "tasks", "uploads", "settings"];
/** Rejects anything that is not an intact ErvisioTodo database of a version this build understands. */
function assertValidDatabase(file: string) {
  let candidate: DatabaseSync | undefined;
  try {
    candidate = new DatabaseSync(file, { readOnly: true });
    const check = candidate.prepare("PRAGMA integrity_check").get() as Record<
      string,
      string
    >;
    insist(Object.values(check)[0] === "ok", 400, "Il backup è danneggiato.");
    const tables = (
      candidate
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all() as { name: string }[]
    ).map((row) => row.name);
    insist(
      REQUIRED_TABLES.every((table) => tables.includes(table)),
      400,
      "Il file non è un backup di ErvisioTodo.",
    );
    const version = (
      candidate.prepare("PRAGMA user_version").get() as { user_version: number }
    ).user_version;
    insist(
      version <= 3,
      400,
      "Il backup proviene da una versione più recente dell’app.",
    );
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, "Il file scaricato non è un database valido.");
  } finally {
    candidate?.close();
  }
}

export function restoreBackup(name: string, actorId: string) {
  return exclusive(async () => {
    insist(backupName.test(name), 400, "Nome del backup non valido.");
    const target = storedTarget();
    insist(target, 400, "Configura prima l’archiviazione esterna.");
    const dir = scratch(),
      download = resolve(
        dir,
        `restore-${stamp()}${name.endsWith(".gz") ? ".gz" : ""}`,
      ),
      restored = resolve(dir, `restore-${stamp()}.sqlite`);
    try {
      try {
        await driverFor(target).get(name, download);
      } catch (e) {
        throw remoteError(e);
      }
      if (name.endsWith(".gz"))
        await pipeline(
          createReadStream(download),
          createGunzip(),
          createWriteStream(restored, { mode: 0o600 }),
        );
      else renameSync(download, restored);
      assertValidDatabase(restored);

      // Keep the current database, and the backup settings that belong to this installation.
      const safety = resolve(dataDir(), "backups");
      mkdirSync(safety, { recursive: true, mode: 0o700 });
      await backup(db(), resolve(safety, `pre-restore-${stamp()}.sqlite`));
      const keepState = readState();
      recordActivity(actorId, "backup.restore", name);

      const live = resolve(dataDir(), "ervisio.sqlite");
      closeDB();
      for (const suffix of ["-wal", "-shm"])
        rmSync(`${live}${suffix}`, { force: true });
      renameSync(restored, live);
      writeState({ ...keepState });
    } finally {
      for (const file of [download, restored])
        if (existsSync(file)) rmSync(file, { force: true });
    }
  });
}

/** Starts the scheduled backups once per process; checks every five minutes whether one is due. */
export function startBackupScheduler() {
  const key = Symbol.for("ervisio.backup.scheduler"),
    scope = globalThis as Record<symbol, unknown>;
  if (scope[key]) return;
  scope[key] = setInterval(() => {
    try {
      const state = readState();
      if (!state.intervalHours || !storedTarget(state) || running) return;
      if (Date.now() - (state.lastRunAt ?? 0) < state.intervalHours * 3_600_000)
        return;
      runBackup().catch(() => undefined);
    } catch {
      // The next tick retries; the failure is already visible in the saved state.
    }
  }, 5 * 60_000).unref();
}
