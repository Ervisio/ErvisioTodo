/** Overview: service state, counts, how to reach the app, start/stop/restart, the live log; why it stopped when it did. */
import { useEffect, useMemo, useRef, useState } from "react";
import { getSdk } from "../sdk";
import * as service from "../api/service";
import type { TodoStatus } from "../api/todo";
import type { ContainerSummary } from "../api/docker";
import { Button, ConfirmDialog, Icon, Skeleton, toast } from "../kit";
import type { Server } from "./TodoPage";
import { bytes, clock, copy, errText, num, t, useLoad } from "./util";

export function Overview({ srv }: { srv: Server }) {
  const sdk = getSdk();
  const s = srv.status;
  const newer =
    s &&
    !srv.updating &&
    service.compareVersions(sdk.plugin.version, s.version) > 0
      ? sdk.plugin.version
      : null;
  return (
    <>
      <div className="td-pagehead">
        <h2>{t("nav.overview")}</h2>
      </div>
      {srv.down && srv.inst && <DownBanner srv={srv} inst={srv.inst} />}
      {newer && s && (
        <div className="td-banner" role="status">
          <Icon name="download" />
          <div>
            <b>{t("up.available", { v: newer })}</b>
            <span>{t("up.from", { v: s.version })}</span>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => srv.go("maintenance")}
          >
            {t("up.view")}
          </Button>
        </div>
      )}
      {s && <Tiles srv={srv} s={s} />}
      <div className="td-two">
        {srv.inst && <ServiceCard srv={srv} inst={srv.inst} />}
        {s && <AccessCard s={s} />}
      </div>
      {srv.inst && <Logs inst={srv.inst} />}
    </>
  );
}

/** Classes for a log line: plain, warning or error. */
export function lineClass(l: string): string {
  if (
    /\b(ERROR|ERR|FATAL|PANIC)\b|level=(error|fatal)|"level":"(error|fatal)"|\blevel":50\b/i.test(
      l,
    )
  )
    return "e";
  if (/\b(WARN|WARNING|WRN)\b|level=warn|"level":"warn"|\blevel":40\b/i.test(l))
    return "w";
  return "t";
}

export function Term({
  lines,
  className,
  empty,
}: {
  lines: string[];
  className?: string;
  empty?: string;
}) {
  return (
    <div className={`td-term${className ? ` ${className}` : ""}`} role="log">
      {lines.length ? (
        lines.map((l, i) => (
          <div key={i} className={lineClass(l)}>
            {l}
          </div>
        ))
      ) : (
        <div className="t">{empty ?? ""}</div>
      )}
    </div>
  );
}

function DownBanner({
  srv,
  inst,
}: {
  srv: Server;
  inst: service.Installation;
}) {
  const logs = useLoad(() => service.tailLogs(inst, 20), [inst]);
  const name = inst.app.Names?.[0]?.replace(/^\//, "") ?? "app";
  const title = inst.running
    ? t("down.notAnswering")
    : inst.stoppedAt
      ? t("down.stoppedAt", { time: clock(inst.stoppedAt) })
      : t("down.stopped");
  const text = inst.running
    ? t("down.notAnsweringText", { name })
    : inst.exit
      ? t("down.exitCode", { name, code: inst.exit })
      : t("down.text", { name });
  return (
    <div className="td-down" role="alert">
      <Icon name="alert" />
      <div className="td-down-b">
        <b>{title}</b>
        <p>{text}</p>
        {logs.data ? (
          <Term lines={logs.data} empty={t("logs.empty")} />
        ) : logs.loading ? (
          <Skeleton height={80} />
        ) : null}
        <div className="td-acts">
          {inst.running ? (
            <Button
              variant="primary"
              size="sm"
              icon="refresh"
              loading={srv.busy === "restart"}
              disabled={!!srv.busy}
              onClick={() => void srv.restart()}
            >
              {t("svc.restart")}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              icon="play"
              loading={srv.busy === "start"}
              disabled={!!srv.busy}
              onClick={() => void srv.start()}
            >
              {t("svc.start")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="td-tile2">
      <span className="lb">{label}</span>
      <span className="v">{value}</span>
      {sub && <span className="s">{sub}</span>}
    </div>
  );
}

function Tiles({ srv, s }: { srv: Server; s: TodoStatus }) {
  const { counts, storage } = s;
  return (
    <div className="td-grid">
      <Tile
        label={t("ov.service")}
        value={t("ov.active")}
        sub={
          srv.latency !== undefined
            ? t("ov.latency", { ms: srv.latency })
            : undefined
        }
      />
      <Tile
        label={t("ov.users")}
        value={num(counts.users)}
        sub={t("ov.lists", { n: num(counts.lists) })}
      />
      <Tile
        label={t("ov.tasks")}
        value={num(counts.tasks)}
        sub={t("ov.open", { n: num(counts.openTasks) })}
      />
      <Tile
        label={t("ov.space")}
        value={bytes(storage.usedBytes)}
        sub={
          storage.quotaBytes
            ? t("ov.spaceOf", { quota: bytes(storage.quotaBytes) })
            : t("ov.noQuota")
        }
      />
    </div>
  );
}

/** A container's state as a pill: healthy, running, unhealthy, exited with its code. */
function containerPill(c: ContainerSummary, down: boolean) {
  const status = c.Status ?? "";
  if (c.State === "running") {
    if (/\(unhealthy\)/.test(status))
      return <span className="td-pill is-warn">{t("ct.unhealthy")}</span>;
    if (/\(health: starting\)/.test(status))
      return <span className="td-pill is-info">{t("ct.starting")}</span>;
    return (
      <span className="td-pill">
        {/\(healthy\)/.test(status) ? t("ct.healthy") : t("ct.running")}
      </span>
    );
  }
  if (c.State === "restarting")
    return <span className="td-pill is-warn">{t("ct.restarting")}</span>;
  const code = /Exited \((\d+)\)/.exec(status)?.[1];
  const tone = code && code !== "0" ? "is-err" : down ? "is-err" : "is-off";
  return (
    <span className={`td-pill ${tone}`}>
      {code ? t("ct.exited", { code }) : t("ct.stopped")}
    </span>
  );
}

/** Containers of the project, and the start, stop and restart buttons. */
function ServiceCard({
  srv,
  inst,
}: {
  srv: Server;
  inst: service.Installation;
}) {
  const [stopping, setStopping] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const stop = async () => {
    setConfirmStop(false);
    setStopping(true);
    try {
      await service.stop(inst);
      toast.ok(t("svc.stopped"));
    } catch (e) {
      toast.err(t("svc.stopFailed"), errText(e));
    } finally {
      setStopping(false);
      srv.reload();
    }
  };
  const idle = !!srv.busy || !!srv.updating || stopping;
  return (
    <section className="td-card">
      <h3>{t("ov.containers")}</h3>
      <div className="td-list">
        {inst.containers.map((c) => (
          <div key={c.Id} className="td-li">
            <b className="td-mono">
              {c.Labels?.["com.docker.compose.service"] ?? c.Names?.[0]}
            </b>
            <span className="s td-mono">{c.Image}</span>
            {containerPill(c, srv.down)}
          </div>
        ))}
      </div>
      <div className="td-svc">
        {inst.running ? (
          <>
            <Button
              size="sm"
              icon="refresh"
              loading={srv.busy === "restart"}
              disabled={idle}
              onClick={() => void srv.restart()}
            >
              {t("svc.restart")}
            </Button>
            <Button
              size="sm"
              icon="stop"
              loading={stopping}
              disabled={idle}
              onClick={() => setConfirmStop(true)}
            >
              {t("svc.stop")}
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="primary"
            icon="play"
            loading={srv.busy === "start"}
            disabled={idle}
            onClick={() => void srv.start()}
          >
            {t("svc.start")}
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={confirmStop}
        onClose={() => setConfirmStop(false)}
        onConfirm={() => void stop()}
        danger
        icon="stop"
        title={t("svc.stopTitle")}
        description={t("svc.stopText")}
        confirmLabel={t("svc.stop")}
        cancelLabel={t("cancel")}
      />
    </section>
  );
}

const METHODS = ["credentials", "google", "discord", "cognito"] as const;

function AccessCard({ s }: { s: TodoStatus }) {
  const on = METHODS.filter((m) => s.providers[m]).map((m) => t(`prov.${m}`));
  return (
    <section className="td-card">
      <h3>{t("ov.access")}</h3>
      <div className="td-list">
        <div className="td-li">
          <b>{t("ov.web")}</b>
          <span className="s td-mono">{s.publicUrl || t("ov.noUrl")}</span>
        </div>
        <div className="td-li">
          <b>{t("ov.signin")}</b>
          <span className="s">{on.length ? on.join(", ") : "-"}</span>
        </div>
        <div className="td-li">
          <b>{t("info.smtp")}</b>
          <span className="s">
            {t(s.mailEnabled ? "info.configured" : "info.notConfigured")}
          </span>
        </div>
      </div>
      {s.publicUrl && (
        <div className="td-svc">
          <Button
            size="sm"
            variant="primary"
            icon="externallink"
            onClick={() => getSdk().openExternal(s.publicUrl)}
          >
            {t("head.open")}
          </Button>
        </div>
      )}
    </section>
  );
}

/* ---------- logs ---------- */

type Level = "all" | "w" | "e";
const MAX_LINES = 2000;

function Logs({ inst }: { inst: service.Installation }) {
  const [lines, setLines] = useState<string[]>([]);
  const [level, setLevel] = useState<Level>("all");
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState("");
  const [gen, setGen] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (paused) return;
    setError("");
    setLines([]);
    let retry: ReturnType<typeof setTimeout> | undefined;
    const stop = service.watchLogs(
      inst,
      (l) => {
        setError("");
        setLines((x) => [...x, ...l].slice(-MAX_LINES));
      },
      (e) => {
        setError(errText(e));
        retry = setTimeout(() => setGen((n) => n + 1), 2000);
      },
    );
    return () => {
      stop();
      clearTimeout(retry);
    };
    // The container id changes when the stack is recreated by an update.
  }, [inst.app.Id, paused, gen]);

  const shown = useMemo(
    () =>
      level === "all"
        ? lines
        : lines.filter((l) =>
            level === "e" ? lineClass(l) === "e" : lineClass(l) !== "t",
          ),
    [lines, level],
  );

  useEffect(() => {
    const el = ref.current?.querySelector(".td-term");
    if (el && !paused) el.scrollTop = el.scrollHeight;
  }, [shown, paused]);

  const onCopy = async () => {
    if (await copy(shown.join("\n"))) toast.ok(t("logs.copied"));
  };
  const levels: { value: Level; label: string }[] = [
    { value: "all", label: t("logs.all") },
    { value: "w", label: t("logs.warn") },
    { value: "e", label: t("logs.err") },
  ];
  return (
    <section className="td-card td-logcard" ref={ref}>
      <div className="td-logh">
        <h3>{t("logs.title")}</h3>
        <div className="td-seg" role="group" aria-label={t("logs.level")}>
          {levels.map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={level === o.value}
              onClick={() => setLevel(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon={paused ? "play" : "pause"}
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? t("logs.resume") : t("logs.pause")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon="copy"
          disabled={!shown.length}
          onClick={() => void onCopy()}
        >
          {t("logs.copy")}
        </Button>
      </div>
      {error && (
        <p className="td-muted td-pad">{t("logs.failed", { e: error })}</p>
      )}
      <Term lines={shown} empty={t("logs.empty")} />
    </section>
  );
}
