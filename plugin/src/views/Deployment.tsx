import { useEffect, useState } from "react";
import {
  applyConfiguration,
  getConfiguration,
  saveConfiguration,
  type ConfigurationDoc,
} from "../api/deployment";
import { Button, Icon, Input, Select } from "../kit";
import { errText, t } from "./util";

const GROUPS = [
  {
    id: "address",
    keys: [
      "AUTH_URL",
      "PORT",
      "BASE_DOMAIN",
      "AUTH_COOKIE_DOMAIN",
      "TRUSTED_IP_HEADER",
    ],
  },
  {
    id: "auth",
    keys: [
      "AUTH_SECRET",
      "AUTH_LOCAL_ENABLED",
      "REGISTRATION_ENABLED",
      "REQUIRE_EMAIL_VERIFICATION",
    ],
  },
  {
    id: "google",
    keys: ["AUTH_GOOGLE_ENABLED", "AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"],
  },
  {
    id: "discord",
    keys: ["AUTH_DISCORD_ENABLED", "AUTH_DISCORD_ID", "AUTH_DISCORD_SECRET"],
  },
  {
    id: "cognito",
    keys: [
      "AUTH_COGNITO_ENABLED",
      "AUTH_COGNITO_ID",
      "AUTH_COGNITO_SECRET",
      "AUTH_COGNITO_ISSUER",
    ],
  },
  { id: "mail", keys: ["SMTP_URL", "MAIL_FROM"] },
  { id: "ai", keys: ["AI_BASE_URL", "AI_API_KEY", "AI_MODEL"] },
  {
    id: "limits",
    keys: ["UPLOAD_MAX_MB", "STORAGE_QUOTA_GB", "UPLOAD_REQUEST_MAX_MB"],
  },
  {
    id: "managed",
    keys: [
      "NODE_ENV",
      "DATA_DIR",
      "BIND_HOST",
      "PLUGIN_SOCKET",
      "ERVISIO_SOCKET_DIR",
      "ERVISIO_VERSION",
    ],
  },
];
const KNOWN = new Set(GROUPS.flatMap((g) => g.keys));
const MANAGED = new Set(GROUPS.find((g) => g.id === "managed")?.keys);
const isManaged = (key: string) =>
  MANAGED.has(key) ||
  [
    "HOSTNAME",
    "PATH",
    "NODE_VERSION",
    "YARN_VERSION",
    "PLUGIN_SECRET",
  ].includes(key) ||
  /^(COMPOSE_|DOCKER_|BUILDX_)/.test(key);
const DEFAULTS: Record<string, string> = {
  AUTH_URL: "http://localhost:3000",
  PORT: "3000",
  AUTH_LOCAL_ENABLED: "true",
  REGISTRATION_ENABLED: "true",
  REQUIRE_EMAIL_VERIFICATION: "false",
  AUTH_GOOGLE_ENABLED: "false",
  AUTH_DISCORD_ENABLED: "false",
  AUTH_COGNITO_ENABLED: "false",
  MAIL_FROM: "ErvisioTodo <noreply@example.com>",
  UPLOAD_MAX_MB: "10",
  STORAGE_QUOTA_GB: "0",
  UPLOAD_REQUEST_MAX_MB: "512",
};
const SECRET_KEYS = new Set([
  "AUTH_SECRET",
  "AUTH_GOOGLE_SECRET",
  "AUTH_DISCORD_SECRET",
  "AUTH_COGNITO_SECRET",
  "SMTP_URL",
  "AI_API_KEY",
]);

export function Deployment({ onApplied }: { onApplied?: () => void }) {
  const [doc, setDoc] = useState<ConfigurationDoc | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [custom, setCustom] = useState("");
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<"idle" | "saving" | "applying">("idle");
  const [pendingApply, setPendingApply] = useState(false);
  const [applied, setApplied] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    getConfiguration().then(
      (d) => {
        if (live) {
          setDoc(d);
          setError("");
        }
      },
      (e: unknown) => {
        if (live) setError(errText(e));
      },
    );
    return () => {
      live = false;
    };
  }, [tick]);

  const busy = phase !== "idle";
  const secrets = new Set([...SECRET_KEYS, ...(doc?.secrets ?? [])]);
  const isSecret = (key: string) => secrets.has(key) || !KNOWN.has(key);
  const dirty = Object.keys(drafts).filter((k) =>
    isSecret(k)
      ? drafts[k] !== "" || !!doc?.configured.includes(k)
      : drafts[k] !== (doc?.values[k] ?? ""),
  );
  const extra = [
    ...new Set([
      ...Object.keys(doc?.values ?? {}),
      ...(doc?.secrets ?? []),
      ...Object.keys(drafts),
    ]),
  ]
    .filter((k) => !KNOWN.has(k))
    .sort();
  const change = (k: string, v: string) => {
    setDrafts((old) => {
      const next = { ...old };
      if (isSecret(k) && !v) delete next[k];
      else next[k] = v;
      return next;
    });
    setApplied(false);
    setError("");
  };
  const apply = async () => {
    setPhase("applying");
    try {
      await applyConfiguration();
      setPendingApply(false);
      setApplied(true);
      onApplied?.();
    } catch (e) {
      setError(errText(e));
    } finally {
      setPhase("idle");
    }
  };
  const save = async () => {
    if (!doc || !dirty.length || busy) return;
    setError("");
    setPhase("saving");
    try {
      await saveConfiguration(
        doc.revision,
        Object.fromEntries(dirty.map((k) => [k, drafts[k]])),
      );
      setPendingApply(true);
      setDrafts({});
      setDoc(await getConfiguration());
    } catch (e) {
      setError(errText(e));
      setPhase("idle");
      return;
    }
    await apply();
  };
  const add = () => {
    const key = custom.trim();
    if (
      !/^[A-Z_][A-Z0-9_]*$/.test(key) ||
      KNOWN.has(key) ||
      isManaged(key) ||
      extra.includes(key)
    )
      return;
    setDrafts((old) => ({ ...old, [key]: "" }));
    setCustom("");
  };

  const row = (key: string) => {
    const secret = secrets.has(key) || (!KNOWN.has(key) && !isManaged(key));
    const configured = !!doc?.configured.includes(key);
    const readonly = isManaged(key);
    const value = drafts[key] ?? (secret ? "" : (doc?.values[key] ?? ""));
    const cleared = key in drafts && drafts[key] === "" && secret && configured;
    return (
      <div
        key={key}
        className={`td-row${dirty.includes(key) ? " is-mod" : ""}`}
      >
        <div className="td-row-t">
          <label htmlFor={`td-env-${key}`} className="td-deploy-key">
            {key === "AUTH_URL" ? t("cn.url") : key}
          </label>
          {key === "AUTH_URL" && (
            <span className="td-row-h">{t("dep.urlHelp")}</span>
          )}
          {key === "PORT" && (
            <span className="td-row-h">{t("dep.portHelp")}</span>
          )}
          {secret && (
            <span className="td-row-h">
              {t(
                cleared
                  ? "dep.cleared"
                  : configured
                    ? "dep.secretSet"
                    : "dep.secretEmpty",
              )}
            </span>
          )}
          {DEFAULTS[key] && (
            <span className="td-row-k">
              {t("set.default", { v: DEFAULTS[key] })}
            </span>
          )}
          {key === "AUTH_URL" && (
            <span className="td-row-k">
              <code>AUTH_URL</code>
            </span>
          )}
        </div>
        <div className="td-ctl td-deploy-control">
          {key.endsWith("_ENABLED") || key === "REQUIRE_EMAIL_VERIFICATION" ? (
            <Select
              compact
              value={value}
              disabled={busy || readonly}
              options={[
                { value: "", label: t("dep.default") },
                { value: "true", label: t("on") },
                { value: "false", label: t("off") },
              ]}
              onChange={(v) => change(key, v)}
            />
          ) : (
            <Input
              id={`td-env-${key}`}
              compact
              mono
              type={secret ? "password" : "text"}
              value={value}
              disabled={busy || readonly}
              readOnly={readonly}
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="off"
              aria-label={key === "AUTH_URL" ? t("cn.url") : key}
              placeholder={
                secret && configured
                  ? t("dep.unchanged")
                  : (DEFAULTS[key] ?? "")
              }
              onChange={(e) => change(key, e.target.value)}
            />
          )}
          {secret && configured && !readonly && (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                if (cleared)
                  setDrafts((old) => {
                    const next = { ...old };
                    delete next[key];
                    return next;
                  });
                else setDrafts((old) => ({ ...old, [key]: "" }));
                setApplied(false);
              }}
            >
              {t(cleared ? "cancel" : "dep.clear")}
            </Button>
          )}
        </div>
      </div>
    );
  };

  if (!doc)
    return error ? (
      <div className="td-err" role="alert">
        <Icon name="alert" />
        <div>
          <b>{t("dep.loadFailed")}</b>
          <span>{error}</span>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setError("");
            setTick((n) => n + 1);
          }}
        >
          {t("retry")}
        </Button>
      </div>
    ) : (
      <div className="td-card td-card--empty" aria-busy="true" />
    );

  return (
    <div className="td-deploy">
      <div className="td-note is-info">
        <Icon name="info" />
        <span>{t("dep.intro")}</span>
      </div>
      {error && (
        <div className="td-err" role="alert">
          <Icon name="alert" />
          <div>
            <b>{t(pendingApply ? "dep.applyFailed" : "set.refused")}</b>
            <span>{error}</span>
          </div>
        </div>
      )}
      {applied && (
        <div className="td-ok-msg" role="status">
          <Icon name="check" />
          {t("dep.applied")}
        </div>
      )}
      {GROUPS.map((group) => (
        <section className="td-card" key={group.id}>
          <h3>{t(`dep.group.${group.id}`)}</h3>
          {group.id === "auth" && (
            <p className="td-help">{t("dep.authHelp")}</p>
          )}
          {group.id === "managed" && (
            <p className="td-help">{t("dep.managedHelp")}</p>
          )}
          {(group.id === "managed"
            ? [...group.keys, ...extra.filter(isManaged)]
            : group.keys
          ).map(row)}
        </section>
      ))}
      <section className="td-card">
        <h3>{t("dep.group.custom")}</h3>
        <p className="td-help">{t("dep.customHelp")}</p>
        {extra.filter((key) => !isManaged(key)).map(row)}
        <div className="td-deploy-add">
          <Input
            compact
            mono
            aria-label={t("dep.variable")}
            placeholder="MY_VARIABLE"
            value={custom}
            disabled={busy}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
          />
          <Button
            size="sm"
            disabled={
              busy ||
              !/^[A-Z_][A-Z0-9_]*$/.test(custom.trim()) ||
              KNOWN.has(custom.trim()) ||
              isManaged(custom.trim()) ||
              extra.includes(custom.trim())
            }
            onClick={add}
          >
            {t("dep.add")}
          </Button>
        </div>
      </section>
      <div className="td-bar td-deploy-bar">
        <div className="td-bar-t" role="status">
          <b>
            {t(
              pendingApply
                ? "dep.pending"
                : dirty.length
                  ? "bar.unsaved.other"
                  : "dep.upToDate",
              { n: dirty.length },
            )}
          </b>
          <span>{t("dep.restartHelp")}</span>
        </div>
        <Button
          variant="ghost"
          disabled={busy || !Object.keys(drafts).length}
          onClick={() => {
            setDrafts({});
            setError("");
          }}
        >
          {t("bar.discard")}
        </Button>
        {pendingApply && !dirty.length ? (
          <Button
            variant="primary"
            disabled={busy}
            loading={busy}
            onClick={() => {
              setError("");
              void apply();
            }}
          >
            {t("dep.retryApply")}
          </Button>
        ) : (
          <Button
            variant="primary"
            disabled={busy || !dirty.length}
            loading={busy}
            onClick={() => void save()}
          >
            {t(phase === "applying" ? "dep.applying" : "dep.save")}
          </Button>
        )}
      </div>
    </div>
  );
}
