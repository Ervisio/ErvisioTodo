import { createReadStream, createWriteStream } from "node:fs";
import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import { pipeline } from "node:stream/promises";
import { z } from "zod";
import {
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import SftpClient from "ssh2-sftp-client";
import SMB2 from "@marsaud/smb2";
import { insist } from "./security";

/** One file on the remote side. */
export type RemoteFile = { name: string; size: number; modified: number };
export type CheckResult = { detail: string };
export interface RemoteDriver {
  check(): Promise<CheckResult>;
  list(): Promise<RemoteFile[]>;
  put(localPath: string, name: string): Promise<void>;
  get(name: string, localPath: string): Promise<void>;
  remove(name: string): Promise<void>;
}

const text = (max: number) => z.string().trim().max(max).default("");
const port = z.number().int().min(1).max(65535);
const directory = text(200);

export const targetSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("s3"),
    endpoint: text(300),
    region: text(60),
    bucket: text(120),
    directory,
    accessKeyId: text(200),
    secretAccessKey: text(400),
    forcePathStyle: z.boolean().default(false),
  }),
  z.object({
    type: z.literal("sftp"),
    host: text(255),
    port: port.default(22),
    username: text(120),
    password: text(400),
    privateKey: text(8000),
    passphrase: text(400),
    fingerprint: text(120),
    directory,
  }),
  z.object({
    type: z.literal("smb"),
    host: text(255),
    port: port.default(445),
    share: text(120),
    domain: text(120),
    username: text(120),
    password: text(400),
    directory,
  }),
]);
export type Target = z.infer<typeof targetSchema>;
export type TargetType = Target["type"];

/** Fields that never leave the server in clear text. */
export const secretFields: Record<TargetType, string[]> = {
  s3: ["secretAccessKey"],
  sftp: ["password", "privateKey", "passphrase"],
  smb: ["password"],
};

const secretKey = () =>
  Buffer.from(
    hkdfSync(
      "sha256",
      process.env.AUTH_SECRET || "",
      "ervisio-todo",
      "remote-storage-secrets",
      32,
    ),
  );
export function seal(value: string) {
  if (!value) return "";
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", secretKey(), iv),
    body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `enc:${Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64")}`;
}
export function unseal(value: string) {
  if (!value.startsWith("enc:")) return value;
  const raw = Buffer.from(value.slice(4), "base64"),
    decipher = createDecipheriv(
      "aes-256-gcm",
      secretKey(),
      raw.subarray(0, 12),
    );
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([
    decipher.update(raw.subarray(28)),
    decipher.final(),
  ]).toString("utf8");
}
/** Applies f to every secret field of a target. */
export function mapSecrets(target: Target, f: (value: string) => string) {
  const copy: Record<string, unknown> = { ...target };
  for (const key of secretFields[target.type])
    copy[key] = f(String(copy[key] ?? ""));
  return copy as Target;
}

const cleanDirectory = (value: string) =>
  value
    .replace(/\\/g, "/")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");

/** Prefix for backup files; only names created by this app are ever listed or removed. */
export const backupName = /^ervisio-[0-9T-]+Z?\.sqlite(\.gz)?$/;
const onlyBackups = (files: RemoteFile[]) =>
  files
    .filter((file) => backupName.test(file.name))
    .sort((a, b) => b.modified - a.modified);

function s3Driver(t: Extract<Target, { type: "s3" }>): RemoteDriver {
  insist(
    t.bucket && t.accessKeyId && t.secretAccessKey,
    400,
    "Compila bucket, chiave di accesso e chiave segreta.",
  );
  const client = new S3Client({
      region: t.region || "us-east-1",
      endpoint: t.endpoint || undefined,
      forcePathStyle: t.forcePathStyle,
      credentials: {
        accessKeyId: t.accessKeyId,
        secretAccessKey: t.secretAccessKey,
      },
    }),
    prefix = cleanDirectory(t.directory),
    key = (name: string) => (prefix ? `${prefix}/${name}` : name);
  return {
    async check() {
      await client.send(new HeadBucketCommand({ Bucket: t.bucket }));
      return { detail: `Bucket ${t.bucket} raggiungibile.` };
    },
    async list() {
      const found: RemoteFile[] = [];
      let token: string | undefined;
      do {
        const page = await client.send(
          new ListObjectsV2Command({
            Bucket: t.bucket,
            Prefix: prefix ? `${prefix}/` : undefined,
            ContinuationToken: token,
          }),
        );
        for (const item of page.Contents ?? [])
          if (item.Key)
            found.push({
              name: item.Key.slice(prefix ? prefix.length + 1 : 0),
              size: item.Size ?? 0,
              modified: item.LastModified?.getTime() ?? 0,
            });
        token = page.NextContinuationToken;
      } while (token);
      return onlyBackups(found);
    },
    async put(localPath, name) {
      await new Upload({
        client,
        params: {
          Bucket: t.bucket,
          Key: key(name),
          Body: createReadStream(localPath),
        },
      }).done();
    },
    async get(name, localPath) {
      const response = await client.send(
        new GetObjectCommand({ Bucket: t.bucket, Key: key(name) }),
      );
      insist(response.Body, 502, "Il bucket non ha restituito dati.");
      await pipeline(
        response.Body as NodeJS.ReadableStream,
        createWriteStream(localPath, { mode: 0o600 }),
      );
    },
    async remove(name) {
      await client.send(
        new DeleteObjectCommand({ Bucket: t.bucket, Key: key(name) }),
      );
    },
  };
}

/** SHA-256 host key digest in hex, from either hex, "SHA256:base64" or plain base64 input. */
function fingerprintHex(value: string) {
  const bare = value.replace(/^SHA256:/i, "").replace(/:/g, "");
  return /^[0-9a-f]{64}$/i.test(bare)
    ? bare.toLowerCase()
    : Buffer.from(bare, "base64").toString("hex");
}

function sftpDriver(t: Extract<Target, { type: "sftp" }>): RemoteDriver {
  insist(
    t.host && t.username && (t.password || t.privateKey),
    400,
    "Compila host, utente e password o chiave privata.",
  );
  const dir = cleanDirectory(t.directory) || ".",
    path = (name: string) => `${dir}/${name}`;
  async function session<T>(
    run: (client: SftpClient, seen: () => string) => Promise<T>,
  ) {
    const client = new SftpClient();
    let seen = "";
    try {
      await client.connect({
        host: t.host,
        port: t.port,
        username: t.username,
        password: t.password || undefined,
        privateKey: t.privateKey || undefined,
        passphrase: t.passphrase || undefined,
        readyTimeout: 15000,
        hostHash: "sha256",
        hostVerifier: (hash: string) => {
          seen = hash;
          return !t.fingerprint || fingerprintHex(t.fingerprint) === hash;
        },
      });
      return await run(client, () => seen);
    } finally {
      await client.end().catch(() => undefined);
    }
  }
  return {
    check: () =>
      session(async (client, seen) => {
        if (dir !== ".") await client.mkdir(dir, true);
        const fingerprint = `SHA256:${Buffer.from(seen(), "hex").toString("base64").replace(/=+$/, "")}`;
        return {
          detail: t.fingerprint
            ? "Server raggiungibile, impronta verificata."
            : `Server raggiungibile. Impronta del server: ${fingerprint}`,
        };
      }),
    list: () =>
      session(async (client) => {
        if (!(await client.exists(dir))) return [];
        const entries = await client.list(dir);
        return onlyBackups(
          entries
            .filter((entry) => entry.type === "-")
            .map((entry) => ({
              name: entry.name,
              size: entry.size,
              modified: entry.modifyTime,
            })),
        );
      }),
    put: (localPath, name) =>
      session(async (client) => {
        if (dir !== ".") await client.mkdir(dir, true);
        await client.fastPut(localPath, path(name));
      }),
    get: (name, localPath) =>
      session(async (client) => {
        await client.fastGet(path(name), localPath);
      }),
    remove: (name) =>
      session(async (client) => {
        await client.delete(path(name));
      }),
  };
}

function smbDriver(t: Extract<Target, { type: "smb" }>): RemoteDriver {
  insist(
    t.host && t.share && t.username,
    400,
    "Compila host, condivisione e utente.",
  );
  const parts = cleanDirectory(t.directory).split("/").filter(Boolean),
    dir = parts.join("\\"),
    path = (name: string) => (dir ? `${dir}\\${name}` : name);
  const open = () =>
    new SMB2({
      share: `\\\\${t.host}\\${t.share}`,
      domain: t.domain,
      username: t.username,
      password: t.password,
      port: t.port,
      autoCloseTimeout: 0,
    });
  async function session<T>(run: (client: SMB2) => Promise<T>) {
    const client = open();
    try {
      return await run(client);
    } finally {
      client.disconnect();
    }
  }
  async function ensureDirectory(client: SMB2) {
    let current = "";
    for (const part of parts) {
      current = current ? `${current}\\${part}` : part;
      if (!(await client.exists(current))) await client.mkdir(current);
    }
  }
  return {
    check: () =>
      session(async (client) => {
        await ensureDirectory(client);
        await client.readdir(dir);
        return { detail: `Condivisione ${t.share} raggiungibile.` };
      }),
    list: () =>
      session(async (client) => {
        if (dir && !(await client.exists(dir))) return [];
        const entries = await client.readdir(dir, { stats: true });
        return onlyBackups(
          entries
            .filter((entry) => !entry.isDirectory())
            .map((entry) => ({
              name: entry.name,
              size: entry.size,
              modified: entry.mtime.getTime(),
            })),
        );
      }),
    put: (localPath, name) =>
      session(async (client) => {
        await ensureDirectory(client);
        const out = await client.createWriteStream(path(name), { flags: "w" });
        await pipeline(createReadStream(localPath), out);
      }),
    get: (name, localPath) =>
      session(async (client) => {
        const input = await client.createReadStream(path(name));
        await pipeline(input, createWriteStream(localPath, { mode: 0o600 }));
      }),
    remove: (name) =>
      session(async (client) => {
        await client.unlink(path(name));
      }),
  };
}

export function driverFor(target: Target): RemoteDriver {
  return target.type === "s3"
    ? s3Driver(target)
    : target.type === "sftp"
      ? sftpDriver(target)
      : smbDriver(target);
}
