/**
 * The Settings tab: state shared with the bottom bar, the setting rows and the four sections of the app's own
 * settings (General, Space and limits, Authentication, API and security).
 *
 * Changes are drafts until Save: one PUT with the changed keys, applied by the server at once (no restart). A value the
 * server refuses stays in its field with the server's message; errors about the whole save (for example "keep one
 * sign-in method") show in a banner.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Context,
  type ReactNode,
} from "react";
import * as todo from "../api/todo";
import type {
  SettingValue,
  SettingValues,
  SettingsDoc,
  TodoStatus,
} from "../api/todo";
import {
  Button,
  Icon,
  Input,
  Segmented,
  Select,
  Switch,
  Tabs,
  toast,
} from "../kit";
import {
  FIELDS,
  SECTIONS,
  check,
  display,
  parseNumber,
  same,
  type Field,
  type SectionId,
} from "./fields";
import { bytes, errText, t } from "./util";

export interface SettingsApi {
  doc: SettingsDoc | null;
  loadError: unknown;
  reload(): void;
  value(k: string): SettingValue | undefined;
  setDraft(k: string, v: SettingValue): void;
  /** A message for text typed in a field that is not a value yet (null clears it). Blocks saving. */
  setInvalid(k: string, msg: string | null): void;
  errors: Record<string, string>;
  /** Errors about the whole save. */
  general: string[];
  /** Keys whose draft differs from the saved value. */
  dirty: string[];
  busy: boolean;
  save(): Promise<boolean>;
  discard(): void;
  /** The server does not answer: nothing can be read or saved. */
  offline: boolean;
}

// Created on first use: React APIs must not run at import time, before activate() calls setReact.
let ctx: Context<SettingsApi | null> | undefined;
const settingsCtx = () => (ctx ??= createContext<SettingsApi | null>(null));
export const useSettings = () => useContext(settingsCtx());

export function SettingsProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const [doc, setDoc] = useState<SettingsDoc | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [drafts, setDrafts] = useState<SettingValues>({});
  const [invalid, setInvalidMap] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    todo.getSettings().then(
      (d) => {
        if (!live) return;
        setDoc(d);
        setLoadError(null);
      },
      (e) => live && setLoadError(e),
    );
    return () => {
      live = false;
    };
  }, [enabled, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  const dirty = useMemo(
    () =>
      doc
        ? Object.keys(drafts).filter((k) => !same(doc.values[k], drafts[k]))
        : [],
    [doc, drafts],
  );

  const setDraft = useCallback((k: string, v: SettingValue) => {
    setDrafts((d) => ({ ...d, [k]: v }));
    setErrors((x) => {
      if (!(k in x)) return x;
      const n = { ...x };
      delete n[k];
      return n;
    });
    setGeneral([]);
  }, []);

  const setInvalid = useCallback((k: string, msg: string | null) => {
    setInvalidMap((m) => {
      if (msg === null) {
        if (!(k in m)) return m;
        const n = { ...m };
        delete n[k];
        return n;
      }
      return m[k] === msg ? m : { ...m, [k]: msg };
    });
  }, []);

  const value = useCallback(
    (k: string) => (k in drafts ? drafts[k] : doc?.values[k]),
    [drafts, doc],
  );

  const save = useCallback(async (): Promise<boolean> => {
    if (!doc || !dirty.length || Object.keys(invalid).length) return false;
    const changed: SettingValues = {};
    const local: Record<string, string> = {};
    for (const k of dirty) {
      changed[k] = drafts[k];
      const c = check(k, drafts[k]);
      if (c) local[k] = c;
    }
    const val = (k: string) => (k in changed ? changed[k] : doc.values[k]);
    const def = val("defaultTokenLifetimeDays");
    const max = val("maxTokenLifetimeDays");
    if (
      !local.defaultTokenLifetimeDays &&
      typeof def === "number" &&
      typeof max === "number" &&
      def > max
    ) {
      local.defaultTokenLifetimeDays = t("chk.tokenOrder");
    }
    if (Object.keys(local).length) {
      setErrors((x) => ({ ...x, ...local }));
      return false;
    }
    setBusy(true);
    try {
      const d = await todo.putSettings(changed);
      setDoc(d);
      setDrafts({});
      setErrors({});
      setGeneral([]);
      toast.ok(t("set.saved"));
      return true;
    } catch (e) {
      const rowErrs: Record<string, string> = {};
      const gen: string[] = [];
      if (e instanceof todo.TodoError && e.errors.length) {
        for (const fe of e.errors) {
          if (fe.path && fe.path in changed) rowErrs[fe.path] = fe.msg;
          else gen.push(fe.path ? `${fe.path}: ${fe.msg}` : fe.msg);
        }
      } else {
        gen.push(errText(e));
      }
      setErrors(rowErrs);
      setGeneral(gen);
      return false;
    } finally {
      setBusy(false);
    }
  }, [doc, dirty, drafts, invalid]);

  const discard = useCallback(() => {
    setDrafts({});
    setInvalidMap({});
    setErrors({});
    setGeneral([]);
  }, []);

  const api: SettingsApi = {
    doc,
    loadError,
    reload,
    value,
    setDraft,
    setInvalid,
    errors: { ...invalid, ...errors },
    general,
    dirty,
    busy,
    save,
    discard,
    offline: !enabled,
  };
  const Ctx = settingsCtx();
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

/* ---------- rows ---------- */

/** One setting: title, help, key and default on the left, the control on the right. */
export function Row({
  k,
  disabled,
  extra,
}: {
  k: string;
  disabled?: boolean;
  extra?: ReactNode;
}) {
  const s = useSettings();
  if (!s?.doc || !(k in s.doc.values)) return null;
  const err = s.errors[k];
  const mod = s.dirty.includes(k);
  const def = s.doc.defaults?.[k];
  return (
    <>
      <div className={`td-row${mod ? " is-mod" : ""}${err ? " is-err" : ""}`}>
        <div className="td-row-t">
          <b>{t(`f.${k}`)}</b>
          <span className="td-row-h">{t(`f.${k}.h`)}</span>
          <span className="td-row-k">
            <code>{k}</code>
            {def !== undefined && (
              <span>{t("set.default", { v: display(k, def) })}</span>
            )}
          </span>
        </div>
        <div className="td-ctl">
          <Control k={k} disabled={!!disabled} />
        </div>
        {err && (
          <div className="td-msg" role="alert">
            <Icon name="alert" />
            {err}
          </div>
        )}
      </div>
      {extra}
    </>
  );
}

function Control({ k, disabled }: { k: string; disabled: boolean }) {
  const s = useSettings()!;
  const f = FIELDS[k];
  const v = s.value(k);
  const name = t(`f.${k}`);
  switch (f.kind) {
    case "bool":
      return (
        <Switch
          checked={!!v}
          disabled={disabled}
          aria-label={name}
          onChange={(c) => s.setDraft(k, c)}
        />
      );
    case "enum":
      return (
        <Select
          compact
          disabled={disabled}
          value={String(v ?? "")}
          onChange={(x) => s.setDraft(k, x)}
          options={f.options.map((o) => ({
            value: o,
            label: t(`opt.${k}.${o}`),
          }))}
        />
      );
    case "text":
      return (
        <Input
          compact
          maxLength={f.max}
          value={String(v ?? "")}
          disabled={disabled}
          aria-label={name}
          onChange={(e) => s.setDraft(k, e.target.value)}
        />
      );
    case "num":
      return (
        <NumCtl k={k} f={f} value={v ?? null} name={name} disabled={disabled} />
      );
  }
}

/**
 * A number with its unit. With `limit` there are modes: Server (null, only for keys that have an environment value),
 * Limit (a number above zero) and Unlimited (0).
 */
function NumCtl({
  k,
  f,
  value,
  name,
  disabled,
}: {
  k: string;
  f: Extract<Field, { kind: "num" }>;
  value: SettingValue;
  name: string;
  disabled: boolean;
}) {
  const s = useSettings()!;
  const [text, setText] = useState(value === null ? "" : String(value));
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setText(value === null ? "" : String(value));
  }, [value]);

  const mode = !f.limit
    ? "set"
    : value === null
      ? "env"
      : value === 0
        ? "off"
        : "set";
  const unit = t(`unit.${f.unit}`);

  const choose = (m: string) => {
    editing.current = false;
    s.setInvalid(k, null);
    const next = m === "env" ? null : m === "off" ? 0 : f.fallback;
    s.setDraft(k, next);
    setText(next === null ? "" : String(next));
  };
  const onText = (raw: string) => {
    editing.current = true;
    setText(raw);
    const n = parseNumber(raw);
    const min = f.limit ? Number.MIN_VALUE : f.min;
    if (!Number.isFinite(n)) return s.setInvalid(k, t("chk.number"));
    if (n < min || (f.limit && n <= 0))
      return s.setInvalid(
        k,
        f.limit ? t("chk.positive") : t("chk.min", { n: f.min }),
      );
    if (f.int && !Number.isInteger(n)) return s.setInvalid(k, t("chk.int"));
    s.setInvalid(k, null);
    s.setDraft(k, n);
  };
  const input = (
    <div className="td-num">
      <Input
        compact
        inputMode={f.int ? "numeric" : "decimal"}
        value={text}
        disabled={disabled}
        aria-label={name}
        aria-invalid={!!s.errors[k]}
        onFocus={() => {
          editing.current = true;
        }}
        onBlur={() => {
          editing.current = false;
          if (!s.errors[k]) setText(value === null ? "" : String(value));
        }}
        onChange={(e) => onText(e.target.value)}
      />
      <span className="td-unit">{unit}</span>
    </div>
  );
  if (!f.limit) return input;
  const options = [
    ...(f.env ? [{ value: "env", label: t("lim.server") }] : []),
    { value: "set", label: t("lim.limit") },
    { value: "off", label: t("lim.unlimited") },
  ];
  return (
    <div className="td-limit">
      {mode === "set" && input}
      {mode === "env" && <span className="td-env">{t("lim.envHint")}</span>}
      {mode === "off" && <span className="td-env">{t("lim.offHint")}</span>}
      <Segmented
        aria-label={`${name}: ${t("lim.mode")}`}
        value={mode}
        onChange={(m) => !disabled && choose(m)}
        options={options}
      />
    </div>
  );
}

/* ---------- frame ---------- */

export function SetCard({
  title,
  help,
  children,
}: {
  title: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <section className="td-card">
      <h3>{title}</h3>
      {help && <p className="td-help">{help}</p>}
      {children}
    </section>
  );
}

function Banners() {
  const s = useSettings();
  if (!s || !s.general.length) return null;
  return (
    <div className="td-err" role="alert">
      <Icon name="alert" />
      <div>
        <b>{t("set.refused")}</b>
        {s.general.map((g) => (
          <span key={g} className="td-pre">
            {g}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The settings tab: the four sections as sub-tabs. */
export function Settings({
  children,
}: {
  children: (id: SectionId) => ReactNode;
}) {
  const s = useSettings();
  const [section, setSection] = useState<SectionId>("general");
  const count = (id: SectionId) =>
    s ? s.dirty.filter((k) => FIELDS[k]?.section === id).length : 0;
  return (
    <>
      <div className="td-pagehead">
        <h2>{t("nav.settings")}</h2>
        <p className="td-lead">{t("lead.settings")}</p>
      </div>
      <div className="td-subtabs">
        <Tabs
          variant="underline"
          aria-label={t("set.sections")}
          value={section}
          onChange={(id) => setSection(id as SectionId)}
          items={SECTIONS.map((id) => ({
            id,
            label: t(`sec.${id}`),
            count: count(id) || undefined,
          }))}
        />
      </div>
      {!s?.doc ? (
        s?.offline ? (
          <div className="td-err">
            <Icon name="power" />
            <div>
              <b>{t("set.offline")}</b>
              <span>{t("set.offlineText")}</span>
            </div>
          </div>
        ) : s?.loadError ? (
          <div className="td-err">
            <Icon name="alert" />
            <div>
              <b>{t("set.loadFailed")}</b>
              <span>{errText(s.loadError)}</span>
            </div>
            <Button size="sm" icon="refresh" onClick={s.reload}>
              {t("retry")}
            </Button>
          </div>
        ) : (
          <div className="td-card td-card--empty" aria-busy="true" />
        )
      ) : (
        <>
          <Banners />
          {children(section)}
        </>
      )}
    </>
  );
}

/* ---------- sections ---------- */

const LIMIT_KEYS = [
  "storageQuotaGb",
  "userQuotaGb",
  "uploadMaxMb",
  "maxFilesPerUpload",
  "maxAttachmentsPerTask",
  "editorMaxMb",
  "writeRequestsPerMinute",
  "apiRequestsPerMinute",
  "statsRetentionDays",
];

export function Section({
  id,
  status,
}: {
  id: SectionId;
  status?: TodoStatus;
}) {
  switch (id) {
    case "general":
      return <General status={status} />;
    case "limits":
      return (
        <SetCard title={t("card.attachments")} help={t("card.limitsHelp")}>
          {LIMIT_KEYS.map((k) => (
            <Row key={k} k={k} />
          ))}
        </SetCard>
      );
    case "auth":
      return <Auth status={status} />;
    case "api":
      return (
        <>
          <SetCard title={t("card.tokens")}>
            {[
              "apiEnabled",
              "membersCanCreateTokens",
              "defaultTokenLifetimeDays",
              "maxTokenLifetimeDays",
            ].map((k) => (
              <Row key={k} k={k} />
            ))}
          </SetCard>
          <SetCard title={t("card.sharing")}>
            {["sharingEnabled", "maxShareLifetimeHours"].map((k) => (
              <Row key={k} k={k} />
            ))}
          </SetCard>
        </>
      );
  }
}

function General({ status }: { status?: TodoStatus }) {
  return (
    <>
      <SetCard title={t("card.workspace")}>
        <Row k="siteName" />
        <Row k="defaultLocale" />
      </SetCard>
      {status && (
        <SetCard title={t("card.info")}>
          <div className="td-list">
            <div className="td-li">
              <b>{t("info.space")}</b>
              <span className="s">
                {status.storage.quotaBytes
                  ? t("info.spaceOf", {
                      used: bytes(status.storage.usedBytes),
                      quota: bytes(status.storage.quotaBytes),
                    })
                  : bytes(status.storage.usedBytes)}
              </span>
            </div>
            <div className="td-li">
              <b>{t("info.access")}</b>
              <span className="s td-mono">
                {status.publicUrl || t("ov.noUrl")}
              </span>
            </div>
            <div className="td-li">
              <b>{t("info.smtp")}</b>
              <span className="s">
                {t(
                  status.mailEnabled ? "info.configured" : "info.notConfigured",
                )}
              </span>
            </div>
          </div>
        </SetCard>
      )}
    </>
  );
}

const PROVIDERS = ["google", "discord", "cognito"] as const;

function Auth({ status }: { status?: TodoStatus }) {
  const s = useSettings()!;
  const configured = s.doc?.configured;
  const base = (status?.publicUrl ?? "").replace(/\/$/, "");
  return (
    <>
      <SetCard title={t("card.signin")}>
        <Row k="credentials" />
        <Row k="registration" />
        {PROVIDERS.map((p) => {
          const known = configured !== undefined;
          const ok = !known || configured![p];
          return (
            <Row
              key={p}
              k={p}
              disabled={!ok && !s.value(p)}
              extra={
                <div className="td-prov">
                  <span className={`td-pill ${ok ? "" : "is-off"}`}>
                    {t(ok ? "info.configured" : "info.notConfigured")}
                  </span>
                  {base && (
                    <span>
                      {t("auth.callback")}:{" "}
                      <code>{`${base}/api/auth/callback/${p}`}</code>
                    </span>
                  )}
                </div>
              }
            />
          );
        })}
        <p className="td-help">{t("auth.secretsNote")}</p>
      </SetCard>
      <MailCard status={status} />
    </>
  );
}

function MailCard({ status }: { status?: TodoStatus }) {
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ ok: boolean; text: string } | null>(null);
  const on = !!status?.mailEnabled;
  const send = async () => {
    setBusy(true);
    setRes(null);
    try {
      await todo.testMail(to.trim());
      setRes({ ok: true, text: t("mail.sent", { to: to.trim() }) });
    } catch (e) {
      setRes({ ok: false, text: errText(e) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <SetCard title={t("card.mail")}>
      <div className="td-row">
        <div className="td-row-t">
          <b>{t("mail.to")}</b>
          <span className="td-row-h">
            {t(on ? "mail.testText" : "mail.off")}
          </span>
        </div>
        <div className="td-ctl td-ctl-wide">
          <Input
            compact
            type="email"
            value={to}
            disabled={!on}
            aria-label={t("mail.to")}
            placeholder="name@example.com"
            spellCheck={false}
            autoCapitalize="off"
            onChange={(e) => setTo(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && to.trim() && on && void send()
            }
          />
          <Button
            size="sm"
            loading={busy}
            disabled={!on || !to.trim()}
            onClick={() => void send()}
          >
            {t("mail.send")}
          </Button>
        </div>
        {res &&
          (res.ok ? (
            <div className="td-ok-msg">
              <Icon name="check" />
              {res.text}
            </div>
          ) : (
            <div className="td-msg" role="alert">
              <Icon name="alert" />
              {res.text}
            </div>
          ))}
      </div>
    </SetCard>
  );
}
