"use client";
import { useState, useEffect } from "react";
import useSWR from "swr";
import { dataFetcher, apiFetch } from "@/lib/client";
import { usePreferences } from "./Preferences";
import { ThemeSettings } from "./ThemeSettings";
import { LimitSettings } from "./LimitSettings";
import type { WorkspaceSettings } from "@/lib/server/settings";
import type { AuthSettings } from "@/lib/server/config";
type Draft = WorkspaceSettings & AuthSettings;
type Data = {
  workspace: WorkspaceSettings;
  settings: AuthSettings;
  configured: Record<string, boolean>;
  environment: {
    quotaGb: number;
    uploadMaxMb: number;
    maxRequestMb: number;
    callbackBase: string;
    trustProxy: boolean;
    smtpConfigured: boolean;
    cognitoIssuer: string;
  };
  usage: { bytes: number; files: number };
  baseDomain: string;
};
export function SettingsForm({ admin }: { admin: boolean }) {
  const { preferences, setPreference, t } = usePreferences(),
    { data, error, mutate } = useSWR<Data>(
      admin ? "/api/admin/settings" : null,
      dataFetcher,
    ),
    [draft, setDraft] = useState<Draft | null>(null),
    [tab, setTab] = useState("Generali"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [saveError, setSaveError] = useState("");
  const { data: activity } = useSWR<
    {
      id: number;
      username: string;
      action: string;
      resource: string;
      created_at: number;
    }[]
  >(
    admin && tab === "API e sicurezza" ? "/api/admin/activity" : null,
    dataFetcher,
  );
  useEffect(() => {
    if (data) setDraft({ ...data.workspace, ...data.settings });
  }, [data]);
  const savedDraft = data ? { ...data.workspace, ...data.settings } : null;
  const dirty =
    draft !== null && JSON.stringify(draft) !== JSON.stringify(savedDraft);
  function discard() {
    setDraft(savedDraft);
    setMessage("");
    setSaveError("");
  }
  const set = (key: keyof Draft, value: unknown) => {
    setDraft((current) => (current ? { ...current, [key]: value } : null));
    setMessage("");
    setSaveError("");
  };
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError("");
    setMessage("");
    if (event.currentTarget.querySelector('[aria-invalid="true"]')) {
      setSaveError(t("Correggi i limiti evidenziati prima di salvare."));
      return;
    }
    setBusy(true);
    try {
      const response = await apiFetch("/api/admin/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        }),
        body = await response.json();
      if (!response.ok) throw new Error(body.error);
      await mutate();
      setMessage(t("Impostazioni salvate."));
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function toggle(
    key: keyof Draft,
    label: string,
    hint: string,
    disabled = false,
  ) {
    return (
      <label className="settings-row">
        <div>
          <strong>{t(label)}</strong>
          <p>{t(hint)}</p>
        </div>
        <input
          aria-label={t(label)}
          type="checkbox"
          className="switch"
          checked={!!draft?.[key]}
          disabled={busy || disabled}
          onChange={(e) => set(key, e.target.checked)}
        />
      </label>
    );
  }
  function number(key: keyof Draft, label: string, min = 0, unit = "giorni") {
    return (
      <label className="settings-row">
        <div>
          <strong>{t(label)}</strong>
          <p>
            {min === 0
              ? t("0 rimuove il limite applicativo.")
              : t("La durata si applica ai nuovi token.")}
          </p>
        </div>
        <span className="limit-value">
          <input
            aria-label={t(label)}
            type="number"
            min={min}
            step="1"
            required
            value={Number(draft?.[key] || 0)}
            onChange={(e) => set(key, Number(e.target.value))}
          />
          <span>{t(unit)}</span>
        </span>
      </label>
    );
  }
  return (
    <>
      <section className="settings-section">
        <h2>{t("Le tue preferenze")}</h2>
        <p className="settings-help">
          {t("Preferenze salvate su questo dispositivo.")}
        </p>
        <label className="settings-row">
          <strong>{t("Lingua")}</strong>
          <select
            aria-label={t("Lingua")}
            value={preferences.locale}
            onChange={(e) =>
              setPreference({ locale: e.target.value as "it" | "en" })
            }
          >
            <option value="it">Italiano</option>
            <option value="en">English</option>
          </select>
        </label>
        <ThemeSettings />
        <label className="settings-row">
          <div>
            <strong>{t("Editor attività")}</strong>
            <p>{t("Apertura dell’editor durante creazione e modifica.")}</p>
          </div>
          <select
            aria-label={t("Editor attività")}
            value={preferences.editorLayout}
            onChange={(e) =>
              setPreference({
                editorLayout: e.target.value as "panel" | "dialog",
              })
            }
          >
            <option value="panel">{t("Pannello laterale")}</option>
            <option value="dialog">{t("Finestra")}</option>
          </select>
        </label>
        <label className="settings-row">
          <strong>{t("Suoni delle attività")}</strong>
          <input
            aria-label={t("Suoni delle attività")}
            className="switch"
            type="checkbox"
            checked={preferences.sounds}
            onChange={(e) => setPreference({ sounds: e.target.checked })}
          />
        </label>
      </section>
      {admin && (
        <>
          {error && (
            <p className="error" role="alert">
              {t("Impossibile caricare le impostazioni.")}
            </p>
          )}
          {!draft && !error && (
            <p className="settings-help">{t("Caricamento…")}</p>
          )}
          {draft && data && (
            <form onSubmit={save}>
              <nav
                className="settings-tabs"
                aria-label={t("Sezioni impostazioni")}
              >
                {[
                  "Generali",
                  "Spazio e limiti",
                  "Autenticazione",
                  "API e sicurezza",
                ].map((name) => (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={tab === name}
                    onClick={() => setTab(name)}
                  >
                    {t(name)}
                  </button>
                ))}
              </nav>
              <section className="settings-section">
                {tab === "Generali" && (
                  <div className="space-y-5">
                    <h2>{t("Generali")}</h2>
                    <label className="field">
                      {t("Nome dello spazio")}
                      <input
                        maxLength={60}
                        minLength={1}
                        required
                        value={draft.siteName}
                        onChange={(e) => set("siteName", e.target.value)}
                      />
                    </label>
                    <label className="field">
                      {t("Lingua predefinita")}
                      <select
                        value={draft.defaultLocale}
                        onChange={(e) => set("defaultLocale", e.target.value)}
                      >
                        <option value="it">Italiano</option>
                        <option value="en">English</option>
                      </select>
                    </label>
                    <p className="settings-help">
                      {t("Usata per chi non ha ancora scelto una lingua.")}
                    </p>
                    <div className="settings-summary">
                      <strong>{t("Spazio utilizzato")}</strong>
                      <span>
                        {(data.usage.bytes / 1024 ** 2).toLocaleString(
                          preferences.locale,
                          { maximumFractionDigits: 2 },
                        )}{" "}
                        MB · {data.usage.files} {t("file")}
                      </span>
                    </div>
                    <p className="settings-help">
                      {t("Accesso principale")}:{" "}
                      <a href={data.environment.callbackBase}>
                        {data.environment.callbackBase}
                      </a>
                      <br />
                      {t("Dominio delle liste")}:{" "}
                      {data.baseDomain || t("Non configurato")}
                    </p>
                  </div>
                )}
                {tab === "Spazio e limiti" && (
                  <>
                    <h2>{t("Allegati e spazio")}</h2>
                    <LimitSettings
                      draft={draft}
                      environment={data.environment}
                      set={set}
                    />
                  </>
                )}
                {tab === "Autenticazione" && (
                  <>
                    <h2>{t("Accesso e registrazione")}</h2>
                    {toggle(
                      "credentials",
                      "Username/email e password",
                      "Accesso locale con password protette tramite hashing bcrypt.",
                    )}
                    {toggle(
                      "registration",
                      "Nuove registrazioni",
                      "Consenti la creazione di nuovi account con i metodi attivi.",
                    )}
                    {(["google", "discord", "cognito"] as const).map((key) => (
                      <div key={key}>
                        {toggle(
                          key,
                          key === "cognito"
                            ? "AWS Cognito"
                            : key === "google"
                              ? "Google"
                              : "Discord",
                          "Abilita quando le credenziali del provider sono configurate sul server.",
                          !data.configured[key],
                        )}
                        <div className="provider-configuration">
                          <span
                            className={
                              data.configured[key]
                                ? "configured"
                                : "not-configured"
                            }
                          >
                            {t(
                              data.configured[key]
                                ? "Configurato"
                                : "Non configurato",
                            )}
                          </span>
                          <span>
                            {t("Callback")}:{" "}
                            <code>
                              {data.environment.callbackBase}/api/auth/callback/
                              {key}
                            </code>
                          </span>
                        </div>
                      </div>
                    ))}
                    <p className="settings-help mt-6">
                      {t(
                        "I segreti dei provider restano nell’ambiente del server. Dopo averli cambiati, riavvia il servizio.",
                      )}
                    </p>
                    <p className="settings-help">
                      SMTP:{" "}
                      {t(
                        data.environment.smtpConfigured
                          ? "Configurato"
                          : "Non configurato",
                      )}
                    </p>
                  </>
                )}
                {tab === "API e sicurezza" && (
                  <>
                    <h2>{t("API e sicurezza")}</h2>
                    {toggle(
                      "apiEnabled",
                      "Attiva API",
                      "Disabilita i token Bearer senza interrompere le sessioni del browser.",
                    )}
                    {toggle(
                      "membersCanCreateTokens",
                      "Consenti token ai membri",
                      "Disabilitando questa opzione smettono di funzionare anche i token già creati dai membri.",
                    )}
                    {number(
                      "defaultTokenLifetimeDays",
                      "Durata predefinita token",
                      1,
                    )}
                    {number("maxTokenLifetimeDays", "Durata massima token", 1)}
                    {toggle(
                      "sharingEnabled",
                      "Link pubblici in sola lettura",
                      "Disabilitando questa opzione smettono di funzionare anche i link esistenti.",
                    )}
                    {number(
                      "maxShareLifetimeHours",
                      "Durata massima link",
                      0,
                      "ore",
                    )}
                    <h3 className="mt-8 text-sm font-semibold">
                      {t("Attività recente")}
                    </h3>
                    <div className="activity-log">
                      {activity?.length ? (
                        activity.map((event) => (
                          <div key={event.id}>
                            <span>
                              {new Date(event.created_at).toLocaleString(
                                preferences.locale,
                              )}
                            </span>
                            <strong>{event.username || "—"}</strong>
                            <span>{event.action}</span>
                            <small>{event.resource}</small>
                          </div>
                        ))
                      ) : (
                        <p className="settings-help">
                          {t("Nessuna attività registrata.")}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </section>
              <div
                className="settings-save"
                role="region"
                aria-label={t("Salvataggio impostazioni")}
              >
                <div className="settings-save-status">
                  <strong>
                    {t(
                      busy
                        ? "Salvataggio…"
                        : dirty
                          ? "Modifiche non salvate"
                          : "Impostazioni aggiornate",
                    )}
                  </strong>
                  {!saveError && !message && (
                    <p>
                      {t("Le preferenze personali si salvano automaticamente.")}
                    </p>
                  )}
                  {saveError && (
                    <p className="error" role="alert">
                      {saveError}
                    </p>
                  )}
                  {message && (
                    <p className="saved-message" role="status">
                      {message}
                    </p>
                  )}
                </div>
                <div className="settings-save-actions">
                  <button
                    type="button"
                    className="button secondary"
                    disabled={busy || !dirty}
                    onClick={discard}
                  >
                    {t("Annulla")}
                  </button>
                  <button className="button" disabled={busy || !dirty}>
                    {t(busy ? "Salvataggio…" : "Salva impostazioni")}
                  </button>
                </div>
              </div>
            </form>
          )}
        </>
      )}
    </>
  );
}
