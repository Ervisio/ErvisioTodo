/**
 * When no ErvisioTodo is installed: three steps, Search / Install / Done. The page installs it with Docker
 * (install.ts), asking for the address people will use, and follows the installation, also after a reload, until the
 * unit finishes. Without Docker it says so and offers nothing to run.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { getSdk, type PluginError } from "../sdk";
import * as install from "../api/install";
import { Button, Icon, Input, toast } from "../kit";
import { errText, t } from "./util";

function Steps({ at, done }: { at: number; done: number }) {
  return (
    <ol className="td-wz-steps">
      {["search", "install", "done"].map((s, k) => (
        <li
          key={s}
          className={k < done ? "is-ok" : k === at ? "is-on" : undefined}
          aria-current={k === at ? "step" : undefined}
        >
          <b>{k < done ? <Icon name="check" /> : k + 1}</b>
          {t(`cn.step.${s}`)}
        </li>
      ))}
    </ol>
  );
}

export function Log({ lines }: { lines: string[] }) {
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines.length]);
  if (!lines.length) return null;
  return (
    <pre className="td-snip td-wz-log" ref={ref}>
      {lines.slice(0, -1).join("\n")}
      {lines.length > 1 && "\n"}
      <b>{lines[lines.length - 1]}</b>
    </pre>
  );
}

export const adminDeclined = (e: unknown) =>
  (e as Partial<PluginError>)?.code === "needs_admin";

export function Connect({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry(): void;
}) {
  const [prog, setProg] = useState<install.InstallProgress | null>(null);
  const [docker, setDocker] = useState<boolean | null>(null);
  const [url, setUrl] = useState("http://localhost:3000");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    install.progress().then(
      (p) => live && p.state !== "idle" && setProg(p),
      () => {},
    );
    install.hasDocker().then(
      (d) => live && setDocker(d),
      () => live && setDocker(false),
    );
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (prog?.state !== "running") return;
    const id = setInterval(() => {
      install.progress().then(setProg, () => {});
    }, 2000);
    return () => clearInterval(id);
  }, [prog?.state]);

  const clean = url.trim().replace(/\/$/, "");
  const urlOk = install.URL_RE.test(clean);
  const noDocker = docker === false;
  const submit = async () => {
    setTouched(true);
    if (!urlOk || noDocker) return;
    setBusy(true);
    try {
      await install.start({ url: clean });
      setProg({ state: "running", log: [] });
    } catch (e) {
      toast.err(
        t("cn.startFailed"),
        adminDeclined(e) ? t("admin.text") : errText(e),
      );
    } finally {
      setBusy(false);
    }
  };

  const searchBtn = (
    <Button variant="ghost" icon="refresh" onClick={onRetry}>
      {t("cn.search")}
    </Button>
  );
  const form = noDocker ? (
    <div className="td-note is-warn">
      <Icon name="alert" />
      <div>
        <b>{t("cn.nodocker.title")}</b>
        <br />
        {t("cn.nodocker.text")}
      </div>
    </div>
  ) : (
    <>
      <p className="td-wz-hint">
        {t("cn.dockerHint", {
          v: getSdk().plugin.version,
          dir: install.INSTALL_DIR,
        })}
      </p>
      <div className="td-wz-form">
        <Input
          label={t("cn.url")}
          hint={t("cn.urlHint")}
          mono
          value={url}
          spellCheck={false}
          onChange={(e) => setUrl(e.target.value)}
          error={touched && !urlOk ? t("cn.urlBad") : undefined}
        />
      </div>
    </>
  );

  let at = 1;
  let done = 1;
  let body: ReactNode;
  if (prog?.state === "running") {
    body = (
      <>
        <h2>{t("cn.running.title")}</h2>
        <p>{t("cn.running.text", { unit: install.UNIT })}</p>
        <Log lines={prog.log} />
      </>
    );
  } else if (prog?.state === "done") {
    at = 2;
    done = 3;
    body = (
      <>
        <h2>{t("cn.done.title")}</h2>
        <div className="td-note is-ok">
          <Icon name="check" />
          <span>{t("cn.done.text")}</span>
        </div>
        <Log lines={prog.log} />
        <div className="td-acts">
          <Button variant="primary" icon="overview" onClick={onRetry}>
            {t("cn.panel")}
          </Button>
        </div>
      </>
    );
  } else if (prog?.state === "failed") {
    body = (
      <>
        <h2>{t("cn.failed.title")}</h2>
        <div className="td-note is-warn">
          <Icon name="alert" />
          <span>{t("cn.failed.text")}</span>
        </div>
        <Log lines={prog.log} />
        {form}
        <div className="td-acts">
          <Button
            variant="primary"
            icon="refresh"
            loading={busy}
            disabled={noDocker}
            onClick={submit}
          >
            {t("cn.retry")}
          </Button>
          {searchBtn}
        </div>
      </>
    );
  } else {
    at = 0;
    done = 0;
    body = (
      <>
        <h2>{t("cn.missing.title")}</h2>
        <p>{t("cn.missing.text")}</p>
        <p className="td-muted">{errText(error)}</p>
        {form}
        <div className="td-acts">
          <Button
            variant="primary"
            icon="download"
            loading={busy}
            disabled={noDocker || docker === null}
            onClick={submit}
          >
            {t("cn.install")}
          </Button>
          {searchBtn}
        </div>
      </>
    );
  }

  return (
    <>
      <header className="td-ph">
        <span className="td-tile">
          <Icon name="list" />
        </span>
        <div className="td-ph-t">
          <h1>ErvisioTodo</h1>
          <p>{t("cn.sub")}</p>
        </div>
      </header>
      <div className="td-wz">
        <Steps at={at} done={done} />
        <div className="td-card td-wz-card">{body}</div>
      </div>
    </>
  );
}
