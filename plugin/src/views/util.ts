/** Small helpers shared by the views: translation, number formats, a loader hook and the wait for the server. */
import { useCallback, useEffect, useRef, useState } from "react";
import { getSdk } from "../sdk";
import * as todo from "../api/todo";

export const t = (key: string, vars?: Record<string, string | number>) =>
  getSdk().t(key, vars);

export const locale = () => (getSdk().lang() === "it" ? "it-IT" : "en-US");

export const num = (n: number) => new Intl.NumberFormat(locale()).format(n);

/** Bytes with the unit people expect (1024 steps, like Ervisio). */
export function bytes(n: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const digits = i === 0 || v >= 100 ? 0 : 1;
  return `${new Intl.NumberFormat(locale(), { maximumFractionDigits: digits }).format(v)} ${units[i]}`;
}

export const errText = (e: unknown) => (e as Error)?.message ?? String(e);

/** The app's host name from its public URL, for display. */
export function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** "for 6 days", "for 3 hours" from an ISO start time. */
export function upFor(startedAt: string): string {
  const sec = (Date.now() - Date.parse(startedAt)) / 1000;
  if (!Number.isFinite(sec) || sec < 0) return "";
  const [n, unit] =
    sec >= 86400
      ? [sec / 86400, "day"]
      : sec >= 3600
        ? [sec / 3600, "hour"]
        : [Math.max(1, sec / 60), "minute"];
  return new Intl.NumberFormat(locale(), {
    style: "unit",
    unit,
    unitDisplay: "long",
    maximumFractionDigits: 0,
  }).format(Math.floor(n));
}

/** "11:42" today, or the date and time, from an ISO timestamp. */
export function clock(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  const today = new Date().toDateString() === d.toDateString();
  return new Intl.DateTimeFormat(
    locale(),
    today
      ? { hour: "2-digit", minute: "2-digit" }
      : { dateStyle: "medium", timeStyle: "short" },
  ).format(d);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Polls the status until the server answers (and, with `version`, runs that version). */
export async function waitForServer(
  version?: string,
  timeoutMs = 120_000,
): Promise<todo.TodoStatus> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    try {
      const s = await todo.status();
      if (!version || s.version === version) return s;
    } catch (e) {
      if (!isMissingError(e)) throw e;
    }
    if (Date.now() > end) throw new Error(t("svc.timeout"));
    await sleep(2000);
  }
}

export interface Loaded<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  reload(): void;
}

/** Runs `fn` on mount and on reload(); keeps the last data while reloading. */
export function useLoad<T>(
  fn: () => Promise<T>,
  deps: unknown[] = [],
): Loaded<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    let live = true;
    setLoading(true);
    fnRef.current().then(
      (d) => {
        if (!live) return;
        setData(d);
        setError(null);
        setLoading(false);
      },
      (e) => {
        if (!live) return;
        setError(e);
        setLoading(false);
      },
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { data, error, loading, reload };
}

/** Rights not unlocked: from the todo API (TodoError) or from Docker (the SDK's own error). */
export const isAdminError = (e: unknown) =>
  (e instanceof todo.TodoError && e.kind === "admin") ||
  (e as { code?: string } | undefined)?.code === "needs_admin";
export const isMissingError = (e: unknown) =>
  e instanceof todo.TodoError && e.kind === "unavailable";
