/**
 * Installs ErvisioTodo on this machine when there is none, with Docker only: the release matching this plugin is
 * downloaded to /opt/ervisio-todo and set up with deploy/ervisio-setup.sh --url <public address>, which writes .env
 * (AUTH_SECRET, AUTH_URL, PLUGIN_SOCKET) and starts the Compose stack.
 *
 * The work runs in a transient systemd unit (ervisio-todo-install), so it survives the page being closed and has no
 * command time limit; the page follows it through the unit's state and its journal.
 *
 *   await install.start({ url: 'https://todo.example.com' });
 *   const p = await install.progress();        // { state: 'running' | 'done' | 'failed' | 'idle', log }
 */
import { getSdk } from "../sdk";

export const INSTALL_DIR = "/opt/ervisio-todo";
export const UNIT = "ervisio-todo-install";

export type InstallState = "idle" | "running" | "done" | "failed";

export interface InstallProgress {
  state: InstallState;
  /** The unit's output, newest last. */
  log: string[];
}

export const URL_RE = /^https?:\/\/[A-Za-z0-9.-]{1,150}(:[0-9]{1,5})?$/;

/** Docker must be there. */
export async function hasDocker(): Promise<boolean> {
  return (await getSdk().api.exec("has-docker")).exitCode === 0;
}

/** Starts the installation (administrator rights; Ervisio asks to unlock them). */
export async function start(opts: { url: string }): Promise<void> {
  const sdk = getSdk();
  if (!URL_RE.test(opts.url)) throw new Error("invalid url");
  const r = await sdk.api.exec("install-docker", [
    sdk.plugin.version,
    opts.url,
  ]);
  if (r.exitCode !== 0)
    throw new Error(
      (r.stderr || r.stdout).trim() || `systemd-run exited with ${r.exitCode}`,
    );
}

/** Parses `systemctl show` output (KEY=value lines). */
export function props(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const i = line.indexOf("=");
    if (i > 0) out[line.slice(0, i)] = line.slice(i + 1).trim();
  }
  return out;
}

export interface UnitProgress {
  state: InstallState;
  log: string[];
  description: string;
}

/**
 * State and journal of a transient systemd unit started with --remain-after-exit, read with two manifest commands:
 * `stateCmd` (systemctl show ... LoadState,ActiveState,SubState,Result,InvocationID,Description) and `logCmd` (the
 * journal of one invocation id).
 */
export async function unitProgress(
  stateCmd: string,
  logCmd: string,
): Promise<UnitProgress> {
  const sdk = getSdk();
  const p = props((await sdk.api.exec(stateCmd)).stdout);
  if (p.LoadState !== "loaded" || !p.InvocationID)
    return { state: "idle", log: [], description: "" };
  const state: InstallState =
    p.ActiveState === "failed" || (p.Result && p.Result !== "success")
      ? "failed"
      : p.ActiveState === "active" && p.SubState === "exited"
        ? "done"
        : p.ActiveState === "inactive"
          ? "idle"
          : "running";
  const journal = await sdk.api.exec(logCmd, [p.InvocationID]);
  const log = journal.stdout.split("\n").filter((l) => l.trim());
  return { state, log, description: p.Description ?? "" };
}

/** Where the installation is, with the output of its last run. */
export async function progress(): Promise<InstallProgress> {
  const u = await unitProgress("install-state", "install-log");
  if (u.state === "idle" && !u.log.length) return { state: "idle", log: [] };
  return { state: u.state, log: u.log };
}
