/**
 * The ErvisioTodo page in Ervisio: a header with the app's state, three tabs (Overview, Settings, Maintenance), one at
 * a time and, while settings have unsaved changes, a bar to save or discard them. With the app installed but not
 * answering the page stays, with the reason and the way to start it again; with nothing installed, the install steps
 * (Connect.tsx).
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { getSdk } from "../sdk";
import * as todo from "../api/todo";
import * as service from "../api/service";
import { Button, EmptyState, Icon, Skeleton, Tabs, toast } from "../kit";
import { Connect } from "./Connect";
import { Maintenance } from "./Maintenance";
import { Overview } from "./Overview";
import { Section, Settings, SettingsProvider, useSettings } from "./Settings";
import {
  clock,
  errText,
  hostOf,
  isAdminError,
  isMissingError,
  t,
  upFor,
  waitForServer,
} from "./util";

export type TabId = "overview" | "settings" | "maintenance";
const TABS: { id: TabId; icon: string }[] = [
  { id: "overview", icon: "overview" },
  { id: "settings", icon: "cog" },
  { id: "maintenance", icon: "broom" },
];

/** What the page knows about the server. */
export interface Server {
  status?: todo.TodoStatus;
  /** Milliseconds the last status call took. */
  latency?: number;
  /** The installation, once looked for (null: nothing installed; undefined: not known yet). */
  inst?: service.Installation | null;
  /** True when an installation exists but its API does not answer. */
  down: boolean;
  reload(): void;
  /** Restarts the app and waits until it answers again; false when that failed (already told). */
  restart(): Promise<boolean>;
  start(): Promise<void>;
  busy: "restart" | "start" | null;
  go(tab: TabId): void;
  /** Version an update is going to, while it runs. */
  updating: string | null;
  setUpdating(v: string | null): void;
}

function useTheme(): boolean {
  const sdk = getSdk();
  const [light, setLight] = useState(() => sdk.theme.get().kind === "light");
  useEffect(
    () => sdk.theme.onChange(() => setLight(sdk.theme.get().kind === "light")),
    [sdk],
  );
  return light;
}

export function TodoPage() {
  const light = useTheme();
  const [status, setStatus] = useState<todo.TodoStatus>();
  const [latency, setLatency] = useState<number>();
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [inst, setInst] = useState<service.Installation | null>();
  const [instError, setInstError] = useState<unknown>(null);
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState<TabId>("overview");
  const [busy, setBusy] = useState<Server["busy"]>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    const t0 = performance.now();
    todo.status().then(
      (s) => {
        if (!live) return;
        setLatency(Math.round(performance.now() - t0));
        setStatus(s);
        setError(null);
        setLoading(false);
      },
      (e) => {
        if (!live) return;
        setStatus(undefined);
        setError(e);
        setLoading(false);
      },
    );
    service.detect().then(
      (i) => {
        if (!live) return;
        setInst(i);
        setInstError(null);
      },
      (e) => {
        if (!live) return;
        setInst(undefined);
        setInstError(e);
      },
    );
    return () => {
      live = false;
    };
  }, [tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  const go = useCallback((id: TabId) => {
    setTab(id);
    mainRef.current?.scrollIntoView({ block: "start" });
  }, []);

  const restart = useCallback(async () => {
    if (!inst) {
      toast.err(t("svc.noInstall"));
      return false;
    }
    setBusy("restart");
    try {
      await service.restart(inst);
      await waitForServer();
      toast.ok(t("svc.restarted"));
      return true;
    } catch (e) {
      toast.err(t("svc.restartFailed"), errText(e));
      return false;
    } finally {
      setBusy(null);
      reload();
    }
  }, [inst, reload]);

  const start = useCallback(async () => {
    if (!inst) return;
    setBusy("start");
    try {
      await service.start(inst);
      await waitForServer(undefined, 90_000);
      toast.ok(t("svc.started"));
    } catch (e) {
      toast.err(t("svc.startFailed"), errText(e));
    } finally {
      setBusy(null);
      reload();
    }
  }, [inst, reload]);

  const root = `td-root hue-term${light ? " td-light" : ""}`;
  const missing = !status && isMissingError(error);

  if (!status && (loading || (missing && inst === undefined && !instError))) {
    return (
      <div className={root}>
        <div className="td-pad">
          <Skeleton height={56} style={{ borderRadius: 18 }} />
        </div>
        <div className="td-pad">
          <Skeleton height={320} style={{ borderRadius: 18 }} />
        </div>
      </div>
    );
  }
  if (!status && !(missing && inst)) {
    // Nothing answers. Only a search that found no installation may show the install steps: a Docker error (rights
    // not unlocked, Docker refusing) must not look like "not installed".
    return (
      <div className={root}>
        {missing && inst === null ? (
          <Connect error={error} onRetry={reload} />
        ) : (
          <Blocked error={missing ? instError : error} onRetry={reload} />
        )}
      </div>
    );
  }

  const srv: Server = {
    status,
    latency,
    inst,
    down: !status,
    reload,
    restart,
    start,
    busy,
    go,
    updating,
    setUpdating,
  };
  return (
    <div className={root}>
      <SettingsProvider enabled={!!status}>
        <Shell srv={srv} tab={tab} mainRef={mainRef}>
          {tab === "overview" && <Overview srv={srv} />}
          {tab === "settings" && (
            <Settings>{(id) => <Section id={id} status={status} />}</Settings>
          )}
          {tab === "maintenance" && <Maintenance srv={srv} />}
        </Shell>
      </SettingsProvider>
    </div>
  );
}

function Pill({
  tone,
  children,
}: {
  tone?: "warn" | "err" | "info" | "off";
  children: ReactNode;
}) {
  return (
    <span className={`td-pill${tone ? ` is-${tone}` : ""}`}>{children}</span>
  );
}

function Shell({
  srv,
  tab,
  mainRef,
  children,
}: {
  srv: Server;
  tab: TabId;
  mainRef: RefObject<HTMLDivElement>;
  children: ReactNode;
}) {
  const sdk = getSdk();
  const set = useSettings();
  const s = srv.status;
  const host = hostOf(s?.publicUrl || null);
  const newer =
    s && service.compareVersions(sdk.plugin.version, s.version) > 0
      ? sdk.plugin.version
      : null;
  const unsaved = set?.dirty.length ?? 0;

  const pill = srv.updating ? (
    <Pill tone="info">{t("head.updating", { v: srv.updating })}</Pill>
  ) : srv.down ? (
    srv.inst?.running ? (
      <Pill tone="warn">{t("head.notAnswering")}</Pill>
    ) : (
      <Pill tone="err">
        {srv.inst?.stoppedAt
          ? t("head.stoppedAt", { time: clock(srv.inst.stoppedAt) })
          : t("head.stopped")}
      </Pill>
    )
  ) : (
    <Pill>
      {s?.startedAt && upFor(s.startedAt)
        ? t("head.runningFor", { d: upFor(s.startedAt) })
        : t("head.running")}
    </Pill>
  );

  return (
    <>
      <header className="td-head">
        <span className="td-htile">
          <Icon name="list" />
        </span>
        <div className="td-ttl">
          <h1>ErvisioTodo</h1>
          <div className="td-meta">
            {pill}
            {s?.version && <span>{t("head.docker", { v: s.version })}</span>}
            {host && (
              <button
                type="button"
                className="td-link"
                onClick={() => sdk.openExternal(s!.publicUrl)}
              >
                {host}
              </button>
            )}
            {newer && !srv.updating && (
              <button
                type="button"
                className="td-upd"
                onClick={() => srv.go("maintenance")}
              >
                {t("head.available", { v: newer })}
              </button>
            )}
          </div>
        </div>
        <div className="td-hacts">
          {srv.down ? (
            srv.inst?.running ? (
              <Button
                icon="refresh"
                loading={srv.busy === "restart"}
                disabled={!!srv.busy}
                onClick={() => void srv.restart()}
              >
                {t("svc.restart")}
              </Button>
            ) : (
              <Button
                icon="play"
                loading={srv.busy === "start"}
                disabled={!!srv.busy}
                onClick={() => void srv.start()}
              >
                {t("svc.start")}
              </Button>
            )
          ) : (
            <>
              <Button
                icon="refresh"
                loading={srv.busy === "restart"}
                disabled={!!srv.busy || !!srv.updating}
                onClick={() => void srv.restart()}
              >
                {t("svc.restart")}
              </Button>
              {s?.publicUrl && (
                <Button
                  variant="primary"
                  icon="externallink"
                  onClick={() => sdk.openExternal(s.publicUrl)}
                >
                  {t("head.open")}
                </Button>
              )}
            </>
          )}
        </div>
      </header>

      <div className="td-tabs">
        <Tabs
          variant="pill"
          hue="term"
          aria-label={t("nav.label")}
          value={tab}
          onChange={(id) => srv.go(id as TabId)}
          items={TABS.map(({ id, icon }) => ({
            id,
            icon,
            label: t(`nav.${id}`),
            count: id === "settings" && unsaved ? unsaved : undefined,
          }))}
        />
      </div>

      <main className="td-main" ref={mainRef}>
        {children}
      </main>
      {unsaved > 0 && <Bar />}
    </>
  );
}

/** Changes not saved yet, with discard and save. */
function Bar() {
  const set = useSettings();
  if (!set || !set.dirty.length) return null;
  const n = set.dirty.length;
  return (
    <div className="td-bar" role="status">
      <span className="td-bar-i">
        <Icon name="alert" />
      </span>
      <div className="td-bar-t">
        <b>{t(n === 1 ? "bar.unsaved.one" : "bar.unsaved.other", { n })}</b>
        <span>{t("bar.immediate")}</span>
      </div>
      <Button variant="ghost" disabled={set.busy} onClick={set.discard}>
        {t("bar.discard")}
      </Button>
      <Button
        variant="primary"
        loading={set.busy}
        onClick={() => void set.save()}
      >
        {t("bar.save")}
      </Button>
    </div>
  );
}

/** A call failed: rights not unlocked, or another error, with retry. */
export function Blocked({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry(): void;
}) {
  if (isAdminError(error)) {
    return (
      <EmptyState
        icon="lock"
        hue="svc"
        title={t("admin.title")}
        text={t("admin.text")}
        action={
          <Button variant="primary" icon="unlock" onClick={onRetry}>
            {t("admin.unlock")}
          </Button>
        }
      />
    );
  }
  return (
    <EmptyState
      icon="alert"
      hue="svc"
      title={isMissingError(error) ? t("error.down") : t("error.title")}
      text={errText(error)}
      action={
        <Button icon="refresh" onClick={onRetry}>
          {t("retry")}
        </Button>
      }
    />
  );
}
