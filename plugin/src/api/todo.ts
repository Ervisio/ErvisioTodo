/**
 * Typed client of ErvisioTodo's administration API, reached through the unix socket the server opens on the host
 * (/run/ervisio-todo/api.sock, capabilities.http "todo"). The server adds its per-process secret to every request that
 * comes in on that socket, so no auth header is sent here. Every call resolves with the JSON answer or throws a
 * TodoError; errors from the server arrive as application/problem+json: `detail` becomes the message and a 422 also
 * carries per-field `errors` ({path, msg}, path "" for errors about the whole save, such as "keep one sign-in method").
 *
 * The socket is 0660 and belongs to the server's user: the "todo" API is declared `admin`, so the first call of a
 * session from a non-root account brings up Ervisio's unlock dialog. statusQuiet() goes through "todo-user", which is
 * not admin: it never prompts and simply fails when the account may not open the socket (used by the widget).
 */
import { getSdk, type PluginError } from "../sdk";

const BASE = "/api/plugin";

/**
 * - `unavailable`: nothing answers on the socket (not installed, stopped, starting);
 * - `admin`: administrator rights are needed and the user did not unlock them;
 * - `forbidden`: Ervisio refused the call (plugin disabled, socket permission denied);
 * - `invalid`: the server refused the input (HTTP 400/409/413/422);
 * - `failed`: any other error (`status` tells which, e.g. 502 for an SMTP failure).
 */
export type TodoErrorKind =
  "unavailable" | "admin" | "forbidden" | "invalid" | "failed";

export interface FieldError {
  /** Setting key such as `uploadMaxMb`; empty for errors about the whole save. */
  path: string;
  msg: string;
}

export class TodoError extends Error {
  kind: TodoErrorKind;
  /** HTTP status from the server, 0 when the request never reached it. */
  status: number;
  /** Per-field errors of a 422. */
  errors: FieldError[];
  constructor(
    kind: TodoErrorKind,
    message: string,
    status = 0,
    errors: FieldError[] = [],
  ) {
    super(message);
    this.name = "TodoError";
    this.kind = kind;
    this.status = status;
    this.errors = errors;
  }
}

function fromPluginError(e: unknown): TodoError {
  if (e instanceof TodoError) return e;
  const err = e as Partial<PluginError> | undefined;
  const message = err?.message ?? String(e);
  switch (err?.code) {
    case "needs_admin":
      return new TodoError("admin", message);
    case "forbidden":
      return new TodoError("forbidden", message);
    case "invalid":
      return new TodoError("invalid", message);
    case "not_found":
    case "unavailable":
      return new TodoError("unavailable", message);
    default:
      return new TodoError("failed", message);
  }
}

async function call<T>(
  method: string,
  path: string,
  body?: object,
  api = "todo",
): Promise<T> {
  let r;
  try {
    r = await getSdk().api.http(api, {
      method,
      path: `${BASE}${path}`,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body,
    });
  } catch (e) {
    throw fromPluginError(e);
  }
  if (r.status >= 400) {
    let message = "";
    let errors: FieldError[] = [];
    try {
      const p = r.json() as {
        detail?: string;
        title?: string;
        errors?: FieldError[];
      };
      message = p.detail || p.title || "";
      if (Array.isArray(p.errors)) errors = p.errors;
    } catch {
      message = (r.body ?? "").slice(0, 300);
    }
    message ||= `ErvisioTodo answered ${r.status}`;
    const s = r.status;
    // 502 from the mail test is the SMTP server's refusal, not a server that is down.
    if (s === 502 && path === "/mail/test")
      throw new TodoError("failed", message, s, errors);
    if (s === 502 || s === 503 || s === 404)
      throw new TodoError("unavailable", message, s);
    if (s === 400 || s === 409 || s === 413 || s === 422)
      throw new TodoError("invalid", message, s, errors);
    if (s === 401 || s === 403) throw new TodoError("forbidden", message, s);
    throw new TodoError("failed", message, s, errors);
  }
  if (r.status === 204 || !r.body) return {} as T;
  try {
    return r.json() as T;
  } catch {
    throw new TodoError(
      "failed",
      "ErvisioTodo sent an answer that is not JSON",
      r.status,
    );
  }
}

/* ---------- types ---------- */

export interface TodoStatus {
  version: string;
  startedAt?: string;
  /** The address people use to reach the app, empty when unset. */
  publicUrl: string;
  /** Always false: settings live in the database and apply at once. */
  restartRequired: boolean;
  mailEnabled: boolean;
  /** Sign-in methods that are on right now. */
  providers: {
    credentials: boolean;
    google: boolean;
    discord: boolean;
    cognito: boolean;
  };
  counts: { users: number; lists: number; tasks: number; openTasks: number };
  storage: { usedBytes: number; quotaBytes: number | null };
}

/** `null` is meaningful for the two limits that fall back to the installation's environment. */
export type SettingValue = string | number | boolean | null;
export type SettingValues = Record<string, SettingValue>;

export interface SettingsDoc {
  /** Every workspace key plus the auth flags. */
  values: SettingValues;
  defaults: SettingValues;
  restartRequired: boolean;
  /** Sign-in providers whose credentials are present in the server's environment. */
  configured?: { google: boolean; discord: boolean; cognito: boolean };
}

/* ---------- calls ---------- */

export const status = () => call<TodoStatus>("GET", "/status");
/** Like status() through the non-admin API: never asks to unlock, fails when the socket is not readable. */
export const statusQuiet = () =>
  call<TodoStatus>("GET", "/status", undefined, "todo-user");

export const getSettings = () => call<SettingsDoc>("GET", "/settings");
/** Writes only the given keys. 422 (TodoError.errors) when a value is refused, nothing written. Applies at once. */
export const putSettings = (values: SettingValues) =>
  call<SettingsDoc>("PUT", "/settings", { values });
/** Sends a test email through the server's SMTP_URL. 422 when SMTP is not configured or `to` is invalid; failed/502 with the SMTP error. */
export const testMail = (to: string) =>
  call<{ sent: boolean }>("POST", "/mail/test", { to });

/**
 * True when a server answers on the socket. False when none does (not installed, stopped); throws a TodoError for
 * `admin` (rights not unlocked) and `forbidden`, which the page shows as such.
 */
export async function available(): Promise<boolean> {
  try {
    await status();
    return true;
  } catch (e) {
    if (e instanceof TodoError && e.kind === "unavailable") return false;
    throw e;
  }
}
