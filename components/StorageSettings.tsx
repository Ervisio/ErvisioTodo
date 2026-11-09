"use client";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { apiFetch, dataFetcher } from "@/lib/client";
import { usePreferences } from "./Preferences";
import { AdminModal } from "./admin/AdminModal";
import type { Target, TargetType } from "@/lib/server/remote-storage";

type Config = {
  target: Target | null;
  secretsSet: string[];
  intervalHours: number;
  keep: number;
  lastRunAt: number | null;
  lastOk: boolean | null;
  lastMessage: string;
  running: boolean;
};
type Remote = { name: string; size: number; modified: number };
type Draft = Record<string, string | number | boolean>;

const kinds: { type: TargetType; label: string; hint: string }[] = [
  {
    type: "s3",
    label: "S3",
    hint: "AWS, MinIO, Backblaze, Wasabi e compatibili",
  },
  { type: "sftp", label: "SFTP", hint: "Qualsiasi server SSH" },
  { type: "smb", label: "SMB", hint: "Cartelle di rete Windows, NAS, Samba" },
];
const blank: Record<TargetType, Draft> = {
  s3: {
    type: "s3",
    endpoint: "",
    region: "",
    bucket: "",
    directory: "ervisio-todo",
    accessKeyId: "",
    secretAccessKey: "",
    forcePathStyle: false,
  },
  sftp: {
    type: "sftp",
    host: "",
    port: 22,
    username: "",
    password: "",
    privateKey: "",
    passphrase: "",
    fingerprint: "",
    directory: "ervisio-todo",
  },
  smb: {
    type: "smb",
    host: "",
    port: 445,
    share: "",
    domain: "",
    username: "",
    password: "",
    directory: "ervisio-todo",
  },
};
const intervals = [
  [0, "Solo manuale"],
  [6, "Ogni 6 ore"],
  [12, "Ogni 12 ore"],
  [24, "Ogni giorno"],
  [168, "Ogni settimana"],
] as const;

type FieldSpec = {
  key: string;
  label: string;
  type?: "text" | "number" | "password" | "area";
  placeholder?: string;
  secret?: boolean;
  hint?: string;
};
const fields: Record<TargetType, FieldSpec[]> = {
  s3: [
    { key: "bucket", label: "Bucket", placeholder: "ervisio-backup" },
    { key: "region", label: "Regione", placeholder: "eu-south-1" },
    {
      key: "endpoint",
      label: "Endpoint",
      placeholder: "https://s3.example.com",
      hint: "Lascia vuoto per AWS.",
    },
    { key: "directory", label: "Cartella", placeholder: "ervisio-todo" },
    { key: "accessKeyId", label: "Chiave di accesso" },
    {
      key: "secretAccessKey",
      label: "Chiave segreta",
      type: "password",
      secret: true,
    },
  ],
  sftp: [
    { key: "host", label: "Host", placeholder: "nas.example.com" },
    { key: "port", label: "Porta", type: "number" },
    { key: "username", label: "Utente" },
    { key: "password", label: "Password", type: "password", secret: true },
    {
      key: "privateKey",
      label: "Chiave privata",
      type: "area",
      secret: true,
      hint: "In alternativa alla password.",
    },
    {
      key: "passphrase",
      label: "Passphrase della chiave",
      type: "password",
      secret: true,
    },
    {
      key: "fingerprint",
      label: "Impronta del server",
      placeholder: "SHA256:…",
      hint: "Se la inserisci, la connessione viene rifiutata quando non coincide. La verifica ti mostra quella attuale.",
    },
    { key: "directory", label: "Cartella", placeholder: "ervisio-todo" },
  ],
  smb: [
    { key: "host", label: "Host", placeholder: "192.168.1.20" },
    { key: "port", label: "Porta", type: "number" },
    { key: "share", label: "Condivisione", placeholder: "backup" },
    { key: "domain", label: "Dominio", placeholder: "WORKGROUP" },
    { key: "username", label: "Utente" },
    { key: "password", label: "Password", type: "password", secret: true },
    { key: "directory", label: "Cartella", placeholder: "ervisio-todo" },
  ],
};

const size = (bytes: number) =>
  bytes > 1024 ** 2
    ? `${(bytes / 1024 ** 2).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** External storage for backups: choose S3, SFTP or SMB, schedule saves, and bring any of them back. */
export function StorageSettings() {
  const { preferences, t } = usePreferences(),
    { data, mutate } = useSWR<Config>(
      "/api/admin/storage/config",
      dataFetcher,
      {
        revalidateOnFocus: false,
      },
    ),
    [draft, setDraft] = useState<Draft | null>(null),
    [interval, setIntervalHours] = useState(24),
    [keep, setKeep] = useState(14),
    [busy, setBusy] = useState<"" | "save" | "test" | "backup" | "restore">(""),
    [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null),
    [restoring, setRestoring] = useState<Remote | null>(null),
    [confirmText, setConfirmText] = useState(""),
    configured = !!data?.target,
    {
      data: backups,
      mutate: refreshBackups,
      isLoading: loadingBackups,
    } = useSWR<Remote[]>(
      configured ? "/api/admin/storage/backups" : null,
      dataFetcher,
      { revalidateOnFocus: false, shouldRetryOnError: false },
    );
  useEffect(() => {
    if (!data) return;
    setDraft(data.target ? { ...data.target } : null);
    setIntervalHours(data.intervalHours);
    setKeep(data.keep);
  }, [data]);

  const type = draft?.type as TargetType | undefined,
    secretKept = (key: string) =>
      !draft?.[key] &&
      data?.target?.type === type &&
      !!data?.secretsSet.includes(key);

  function choose(next: TargetType | null) {
    setNotice(null);
    setDraft(
      next
        ? data?.target?.type === next
          ? { ...data.target }
          : { ...blank[next] }
        : null,
    );
  }
  const set = (key: string, value: string | number | boolean) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setNotice(null);
  };
  async function call(path: string, init: RequestInit, label: typeof busy) {
    setBusy(label);
    setNotice(null);
    try {
      const response = await apiFetch(path, {
          ...init,
          headers: { "Content-Type": "application/json" },
        }),
        body = await response.json();
      if (!response.ok) throw new Error(body.error);
      return body.data;
    } catch (e) {
      setNotice({ ok: false, text: (e as Error).message });
      return undefined;
    } finally {
      setBusy("");
    }
  }
  async function save() {
    const result = await call(
      "/api/admin/storage/config",
      {
        method: "PATCH",
        body: JSON.stringify({ target: draft, intervalHours: interval, keep }),
      },
      "save",
    );
    if (!result) return;
    await mutate(result, { revalidate: false });
    setNotice({ ok: true, text: t("Impostazioni salvate.") });
    refreshBackups();
  }
  async function disconnect() {
    const result = await call(
      "/api/admin/storage/config",
      {
        method: "PATCH",
        body: JSON.stringify({ target: null, intervalHours: 0 }),
      },
      "save",
    );
    if (!result) return;
    await mutate(result, { revalidate: false });
    setNotice({ ok: true, text: t("Archiviazione esterna scollegata.") });
  }
  async function test() {
    const result = await call(
      "/api/admin/storage/test",
      { method: "POST", body: JSON.stringify(draft) },
      "test",
    );
    if (result) setNotice({ ok: true, text: result.detail });
  }
  async function backupNow() {
    const result = await call(
      "/api/admin/storage/backup",
      { method: "POST", body: "{}" },
      "backup",
    );
    if (result) {
      setNotice({ ok: true, text: `${t("Backup creato")}: ${result.name}` });
      mutate();
      refreshBackups();
    }
  }
  async function restore() {
    if (!restoring) return;
    const target = restoring;
    setRestoring(null);
    setConfirmText("");
    const result = await call(
      "/api/admin/storage/restore",
      { method: "POST", body: JSON.stringify({ name: target.name }) },
      "restore",
    );
    if (result) window.location.assign("/login");
  }

  const dirty =
    JSON.stringify(draft) !== JSON.stringify(data?.target ?? null) ||
    interval !== data?.intervalHours ||
    keep !== data?.keep;
  const date = (time: number) =>
    new Date(time).toLocaleString(preferences.locale, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  const confirmWord = t("RIPRISTINA");

  if (!data) return <p className="settings-help">{t("Caricamento…")}</p>;
  return (
    <>
      <section className="settings-section storage-section">
        <h2>{t("Dove salvare")}</h2>
        <p className="settings-help">
          {t(
            "I dati restano sul server. Una copia completa del database e degli allegati viene inviata qui e può essere riportata indietro quando serve.",
          )}
        </p>
        <div
          className="storage-kinds"
          role="radiogroup"
          aria-label={t("Tipo di archiviazione")}
        >
          {kinds.map((kind) => (
            <button
              key={kind.type}
              type="button"
              role="radio"
              aria-checked={type === kind.type}
              onClick={() => choose(kind.type)}
            >
              <strong>{kind.label}</strong>
              <span>{t(kind.hint)}</span>
            </button>
          ))}
        </div>
        {type && draft && (
          <div className="storage-form">
            {fields[type].map((field) => (
              <label
                key={field.key}
                className={`field${field.type === "area" ? " wide" : ""}`}
              >
                {t(field.label)}
                {field.type === "area" ? (
                  <textarea
                    rows={4}
                    spellCheck={false}
                    autoComplete="off"
                    value={String(draft[field.key] ?? "")}
                    placeholder={
                      secretKept(field.key)
                        ? t("Salvata. Scrivi per sostituirla.")
                        : ""
                    }
                    onChange={(e) => set(field.key, e.target.value)}
                  />
                ) : (
                  <input
                    type={
                      field.type === "number"
                        ? "number"
                        : field.type === "password"
                          ? "password"
                          : "text"
                    }
                    autoComplete={
                      field.type === "password" ? "new-password" : "off"
                    }
                    spellCheck={false}
                    value={String(draft[field.key] ?? "")}
                    placeholder={
                      secretKept(field.key)
                        ? t("Salvata. Scrivi per sostituirla.")
                        : field.placeholder
                    }
                    onChange={(e) =>
                      set(
                        field.key,
                        field.type === "number"
                          ? Number(e.target.value)
                          : e.target.value,
                      )
                    }
                  />
                )}
                {field.hint && <small>{t(field.hint)}</small>}
              </label>
            ))}
            {type === "s3" && (
              <label className="settings-row wide">
                <div>
                  <strong>{t("Indirizzi con percorso")}</strong>
                  <p>
                    {t(
                      "Necessario per MinIO e per la maggior parte dei servizi compatibili.",
                    )}
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="switch"
                  aria-label={t("Indirizzi con percorso")}
                  checked={!!draft.forcePathStyle}
                  onChange={(e) => set("forcePathStyle", e.target.checked)}
                />
              </label>
            )}
          </div>
        )}
      </section>

      {type && (
        <section className="settings-section">
          <h2>{t("Pianificazione")}</h2>
          <label className="settings-row">
            <div>
              <strong>{t("Frequenza")}</strong>
              <p>{t("Il server crea e invia il backup da solo.")}</p>
            </div>
            <select
              aria-label={t("Frequenza")}
              value={interval}
              onChange={(e) => setIntervalHours(Number(e.target.value))}
            >
              {intervals.map(([hours, label]) => (
                <option key={hours} value={hours}>
                  {t(label)}
                </option>
              ))}
            </select>
          </label>
          <label className="settings-row">
            <div>
              <strong>{t("Copie da conservare")}</strong>
              <p>
                {t(
                  "Le più vecchie vengono eliminate dall’archiviazione esterna.",
                )}
              </p>
            </div>
            <span className="limit-value">
              <input
                aria-label={t("Copie da conservare")}
                type="number"
                min={1}
                max={365}
                value={keep}
                onChange={(e) => setKeep(Number(e.target.value))}
              />
            </span>
          </label>
        </section>
      )}

      {notice && (
        <p
          className={notice.ok ? "saved-message" : "error"}
          role={notice.ok ? "status" : "alert"}
        >
          {notice.text}
        </p>
      )}

      <div className="storage-actions">
        {type && (
          <>
            <button
              className="button"
              disabled={!!busy || !dirty}
              onClick={save}
            >
              {t(busy === "save" ? "Salvataggio…" : "Salva")}
            </button>
            <button
              className="button secondary"
              disabled={!!busy}
              onClick={test}
            >
              {t(
                busy === "test" ? "Verifica in corso…" : "Verifica connessione",
              )}
            </button>
          </>
        )}
        {configured && (
          <button
            className="button secondary"
            disabled={!!busy}
            onClick={disconnect}
          >
            {t("Scollega")}
          </button>
        )}
      </div>

      {configured && (
        <section className="settings-section">
          <div className="storage-head">
            <div>
              <h2>{t("Copie salvate")}</h2>
              {data.lastRunAt && (
                <p
                  className={`settings-help${data.lastOk === false ? " storage-failed" : ""}`}
                >
                  {t(
                    data.lastOk === false
                      ? "Ultimo tentativo non riuscito"
                      : "Ultimo backup",
                  )}
                  : {date(data.lastRunAt)}
                  {data.lastMessage && ` · ${data.lastMessage}`}
                </p>
              )}
            </div>
            <button
              className="button"
              disabled={!!busy || dirty}
              onClick={backupNow}
            >
              {t(busy === "backup" ? "Backup in corso…" : "Salva ora")}
            </button>
          </div>
          {loadingBackups ? (
            <p className="settings-help">{t("Caricamento…")}</p>
          ) : backups?.length ? (
            <ul className="backup-list">
              {backups.map((file) => (
                <li key={file.name}>
                  <div>
                    <strong>{date(file.modified)}</strong>
                    <span>
                      {file.name} · {size(file.size)}
                    </span>
                  </div>
                  <button
                    className="button secondary compact"
                    disabled={!!busy}
                    onClick={() => setRestoring(file)}
                  >
                    {t("Ripristina")}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="settings-help">
              {t("Nessuna copia trovata. Usa Salva ora per crearne una.")}
            </p>
          )}
        </section>
      )}

      <AdminModal
        open={!!restoring}
        title={t("Ripristinare questa copia?")}
        size="md"
        onClose={() => {
          setRestoring(null);
          setConfirmText("");
        }}
      >
        {restoring && (
          <form
            className="restore-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (confirmText === confirmWord) restore();
            }}
          >
            <p>
              {t("Il database attuale viene sostituito con la copia del")}{" "}
              {date(restoring.modified)}.{" "}
              {t(
                "Una copia di sicurezza resta in data/backups e tutti gli accessi vengono chiusi.",
              )}
            </p>
            <label className="field">
              {t("Scrivi")} {confirmWord} {t("per confermare")}
              <input
                autoFocus
                autoComplete="off"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
              />
            </label>
            <div className="restore-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setRestoring(null);
                  setConfirmText("");
                }}
              >
                {t("Annulla")}
              </button>
              <button
                className="button danger"
                disabled={confirmText !== confirmWord}
              >
                {t("Ripristina")}
              </button>
            </div>
          </form>
        )}
      </AdminModal>
    </>
  );
}
