/**
 * The ErvisioTodo service on this machine: find the Docker Compose project `ervisiotodo` (service `app`), start, stop
 * and restart it, read its log and update it. Docker is the only way to run it, so there is no native mode.
 *
 *   const inst = await service.detect();       // null when nothing is installed
 *   await service.restart(inst);
 *   const stop = service.watchLogs(inst, (lines) => ...);
 */
import { getSdk } from "../sdk";
import * as docker from "./docker";
import * as install from "./install";

export const PROJECT = "ervisiotodo";

export interface Installation {
  /** The compose `app` container. */
  app: docker.ContainerSummary;
  /** Every container of the compose project (the app, and Caddy when its stack is used). */
  containers: docker.ContainerSummary[];
  /** True when the container runs, even if the API does not answer yet. */
  running: boolean;
  /** When it last stopped (ISO), empty when unknown. */
  stoppedAt: string;
  /** Exit code of the app container, empty while it runs. */
  exit: string;
}

const service = (c: docker.ContainerSummary) =>
  c.Labels?.["com.docker.compose.service"] ?? "";

/**
 * Finds the installation: the `app` container of the Compose project. Null when Docker is missing or the project has
 * no container. Errors from Docker (rights not unlocked, Docker refusing) are thrown: the caller must not take them
 * for "nothing installed", or the install wizard would show over a working installation.
 */
export async function detect(): Promise<Installation | null> {
  if (!(await install.hasDocker())) return null;
  const all = await docker.listContainers();
  const containers = all.filter(
    (c) => c.Labels?.["com.docker.compose.project"] === PROJECT,
  );
  const app = containers.find((c) => service(c) === "app");
  if (!app) return null;
  let stoppedAt = "";
  let exit = "";
  if (app.State !== "running") {
    try {
      const i = await docker.inspect(app.Id);
      stoppedAt =
        i.State.FinishedAt && !i.State.FinishedAt.startsWith("0001")
          ? i.State.FinishedAt
          : "";
      exit = i.State.ExitCode !== undefined ? String(i.State.ExitCode) : "";
    } catch {
      /* the summary is enough */
    }
  }
  containers.sort((a, b) => service(a).localeCompare(service(b)));
  return { app, containers, running: app.State === "running", stoppedAt, exit };
}

/** Starts what is stopped: the other containers of the project first, then the app. */
export async function start(inst: Installation): Promise<void> {
  for (const c of inst.containers)
    if (c !== inst.app && c.State !== "running") await docker.start(c.Id);
  await docker.start(inst.app.Id);
}

export const stop = (inst: Installation) => docker.stop(inst.app.Id);
export const restart = (inst: Installation) => docker.restart(inst.app.Id);

/* ---------- logs ---------- */

/** The last `n` lines of the server's output. */
export const tailLogs = (inst: Installation, n = 20) =>
  docker.logs(inst.app.Id, n);

/** Follows the server's output: the last 300 lines, then new ones. Returns the function that stops it. */
export function watchLogs(
  inst: Installation,
  onLines: (lines: string[]) => void,
  onError: (e: unknown) => void,
): () => void {
  return docker.followLogs(inst.app.Id, onLines, (e) => e && onError(e));
}

/* ---------- update ---------- */

const VERSION = /^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$/;

/** -1, 0 or 1 like a comparator, for x.y.z versions (anything else compares equal). */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(".").map(Number);
  const pb = b.replace(/^v/, "").split(".").map(Number);
  if (
    pa.length !== 3 ||
    pb.length !== 3 ||
    [...pa, ...pb].some((n) => Number.isNaN(n))
  )
    return 0;
  for (let i = 0; i < 3; i++)
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  return 0;
}

/** Starts the update to `version` in a systemd unit (administrator rights). */
export async function startUpdate(version: string): Promise<void> {
  if (!VERSION.test(version)) throw new Error(`Not a version: ${version}`);
  const r = await getSdk().api.exec("update-docker", [version]);
  if (r.exitCode !== 0)
    throw new Error(
      (r.stderr || r.stdout).trim() || `systemd-run exited with ${r.exitCode}`,
    );
}

/** Progress of the last update unit (ervisio-todo-update). */
export const updateProgress = () =>
  install.unitProgress("update-state", "update-log");

/**
 * Which step the update script reached, from its `==> step` markers: 0 backup, 1 pull, 2 up, 3 done.
 * -1 before the first marker.
 */
export function updateStep(log: string[]): number {
  const order = ["backup", "pull", "up", "done"];
  let at = -1;
  for (const l of log) {
    const m = /^==> (backup|pull|up|done)\b/.exec(l.trim());
    if (m) at = Math.max(at, order.indexOf(m[1]));
  }
  return at;
}
