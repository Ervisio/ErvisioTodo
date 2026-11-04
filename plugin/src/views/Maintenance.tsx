/** Maintenance: update to the plugin's version, and where the installation keeps its files and data. */
import { useEffect, useRef, useState } from "react";
import { getSdk } from "../sdk";
import * as service from "../api/service";
import { INSTALL_DIR } from "../api/install";
import { Button, ConfirmDialog, Icon, toast } from "../kit";
import { Term } from "./Overview";
import type { Server } from "./TodoPage";
import { errText, t, waitForServer } from "./util";

export function Maintenance({ srv }: { srv: Server }) {
  return (
    <>
      <div className="td-pagehead">
        <h2>{t("nav.maintenance")}</h2>
        <p className="td-lead">{t("lead.maintenance")}</p>
      </div>
      <Update srv={srv} />
      <Files srv={srv} />
    </>
  );
}

/* ---------- update ---------- */

type Phase = "idle" | "running" | "check" | "done" | "failed";

function Update({ srv }: { srv: Server }) {
  const target = getSdk().plugin.version;
  const current = srv.status?.version ?? "";
  const available = !!current && service.compareVersions(target, current) > 0;
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState(-1);
  const [log, setLog] = useState<string[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const { setUpdating, reload } = srv;

  const steps = [
    t("up.backup"),
    t("up.pull", { v: target }),
    t("up.up"),
    t("up.check"),
  ];

  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
      clearTimeout(timer.current);
    },
    [],
  );

  const finish = async () => {
    setPhase("check");
    try {
      await waitForServer(target, 180_000);
      if (!alive.current) return;
      setPhase("done");
      toast.ok(t("up.done", { v: target }));
    } catch (e) {
      if (!alive.current) return;
      setError(errText(e));
      setPhase("failed");
    } finally {
      if (alive.current) {
        setUpdating(null);
        reload();
      }
    }
  };

  const poll = async (first: boolean) => {
    let p;
    try {
      p = await service.updateProgress();
    } catch (e) {
      if (!alive.current || first) return;
      setError(errText(e));
      setPhase("failed");
      setUpdating(null);
      return;
    }
    if (!alive.current) return;
    // On opening the page, only follow an update that is still running.
    if (first && p.state !== "running") return;
    setLog(p.log);
    setStep(service.updateStep(p.log));
    if (p.state === "failed") {
      setPhase("failed");
      setUpdating(null);
      return;
    }
    if (p.state === "running") {
      setPhase("running");
      setUpdating(target);
      timer.current = setTimeout(() => void poll(false), 2000);
      return;
    }
    await finish();
  };

  useEffect(() => {
    void poll(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const begin = async () => {
    setConfirm(false);
    setError("");
    setLog([]);
    setStep(-1);
    try {
      await service.startUpdate(target);
      setUpdating(target);
      setPhase("running");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void poll(false), 2000);
    } catch (e) {
      setError(errText(e));
      setPhase("failed");
    }
  };

  const shown = phase !== "idle" && phase !== "done";
  const checking = phase === "check";
  const last = steps.length - 1;
  const stepAt = checking ? last : Math.min(step + 1, last);

  if (!available && !shown) {
    return (
      <section className="td-card">
        <div className="td-upd2">
          <div>
            <b>{t("up.latest", { v: current || "-" })}</b>
            <p>{t("up.latestText")}</p>
          </div>
        </div>
      </section>
    );
  }
  const notes = `https://github.com/Ervisio/ErvisioTodo/releases/tag/v${target}`;
  return (
    <section className="td-card">
      <div className="td-upd2">
        <div>
          <b>
            {shown
              ? t("up.to", { v: target })
              : t("up.available", { v: target })}
          </b>
          <p>{t("up.from", { v: current })}</p>
        </div>
        {!shown && (
          <div className="td-acts">
            <Button
              variant="ghost"
              size="sm"
              icon="externallink"
              onClick={() => getSdk().openExternal(notes)}
            >
              {t("up.notes")}
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!srv.inst}
              onClick={() => setConfirm(true)}
            >
              {t("up.update")}
            </Button>
          </div>
        )}
      </div>
      {shown && (
        <ol className="td-steps2">
          {steps.map((label, i) => {
            const cls =
              phase === "failed" && i === stepAt
                ? "is-err"
                : i < stepAt
                  ? "is-ok"
                  : i === stepAt && phase !== "failed"
                    ? "is-now"
                    : "";
            return (
              <li
                key={label}
                className={cls}
                aria-current={cls === "is-now" ? "step" : undefined}
              >
                <i />
                {label}
              </li>
            );
          })}
        </ol>
      )}
      {phase === "failed" && (
        <div className="td-pad">
          <div className="td-err">
            <Icon name="alert" />
            <div>
              <b>{t("up.failed")}</b>
              {error && <span>{error}</span>}
            </div>
          </div>
          {log.length > 0 && <Term lines={log.slice(-30)} />}
          <div className="td-acts">
            <Button size="sm" icon="refresh" onClick={() => setConfirm(true)}>
              {t("retry")}
            </Button>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => void begin()}
        icon="download"
        title={t("up.confirmTitle", { v: target })}
        description={t("up.confirm")}
        confirmLabel={t("up.update")}
        cancelLabel={t("cancel")}
      />
    </section>
  );
}

/* ---------- files and data ---------- */

function Files({ srv }: { srv: Server }) {
  const app = srv.inst?.app;
  return (
    <section className="td-card">
      <h3>{t("files.title")}</h3>
      <p className="td-help">{t("files.text")}</p>
      <div className="td-list">
        <div className="td-li">
          <b>{t("files.dir")}</b>
          <span className="s td-mono">{INSTALL_DIR}</span>
        </div>
        <div className="td-li">
          <b>{t("files.env")}</b>
          <span className="s td-mono">{INSTALL_DIR}/.env</span>
        </div>
        <div className="td-li">
          <b>{t("files.data")}</b>
          <span className="s td-mono">{service.PROJECT}_todo-data</span>
        </div>
        {app && (
          <div className="td-li">
            <b>{t("files.image")}</b>
            <span className="s td-mono">{app.Image}</span>
          </div>
        )}
      </div>
      <p className="td-help">{t("files.envNote")}</p>
    </section>
  );
}
