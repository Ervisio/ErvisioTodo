"use client";
import { useState } from "react";
import { usePreferences } from "./Preferences";
import type { WorkspaceSettings } from "@/lib/server/settings";
type Key =
  | "uploadMaxMb"
  | "storageQuotaGb"
  | "userQuotaGb"
  | "maxFilesPerUpload"
  | "maxAttachmentsPerTask"
  | "editorMaxMb"
  | "writeRequestsPerMinute"
  | "apiRequestsPerMinute"
  | "statsRetentionDays";
const fields: {
  key: Key;
  label: string;
  hint: string;
  unit: string;
  env?: "uploadMaxMb" | "quotaGb";
  fallback: number;
  integer?: boolean;
}[] = [
  {
    key: "storageQuotaGb",
    label: "Spazio totale",
    hint: "Spazio occupato dagli allegati di tutti gli utenti.",
    unit: "GB",
    env: "quotaGb",
    fallback: 1,
  },
  {
    key: "userQuotaGb",
    label: "Quota per persona",
    hint: "Spazio per gli allegati caricati da ogni persona.",
    unit: "GB",
    fallback: 1,
  },
  {
    key: "uploadMaxMb",
    label: "Dimensione massima allegato",
    hint: "I file più grandi vengono rifiutati dal server.",
    unit: "MB",
    env: "uploadMaxMb",
    fallback: 10,
  },
  {
    key: "maxFilesPerUpload",
    label: "File per caricamento",
    hint: "Quanti file si possono caricare insieme.",
    unit: "file",
    fallback: 10,
    integer: true,
  },
  {
    key: "maxAttachmentsPerTask",
    label: "Allegati per attività",
    hint: "Numero massimo di allegati associati alla stessa attività.",
    unit: "file",
    fallback: 30,
    integer: true,
  },
  {
    key: "editorMaxMb",
    label: "Dimensione descrizione",
    hint: "Dimensione massima del testo Markdown di un’attività.",
    unit: "MB",
    fallback: 0.0625,
  },
  {
    key: "writeRequestsPerMinute",
    label: "Scritture al minuto",
    hint: "Creazione, modifica, caricamenti ed eliminazioni per persona.",
    unit: "/min",
    fallback: 240,
    integer: true,
  },
  {
    key: "apiRequestsPerMinute",
    label: "Richieste API al minuto",
    hint: "Limite per ciascun token API.",
    unit: "/min",
    fallback: 120,
    integer: true,
  },
  {
    key: "statsRetentionDays",
    label: "Conservazione attività",
    hint: "Dopo questo periodo le voci del registro vengono eliminate.",
    unit: "giorni",
    fallback: 365,
    integer: true,
  },
];
export function LimitSettings({
  draft,
  environment,
  set,
}: {
  draft: WorkspaceSettings;
  environment: { quotaGb: number; uploadMaxMb: number; maxRequestMb: number };
  set: (key: keyof WorkspaceSettings, value: unknown) => void;
}) {
  const { t } = usePreferences(),
    [text, setText] = useState<Partial<Record<Key, string>>>({});
  return (
    <>
      <p className="settings-help">
        {t(
          "Server usa la configurazione dell’installazione; Illimitato rimuove il limite applicativo.",
        )}{" "}
        {t("Limite tecnico per richiesta")}: {environment.maxRequestMb || 512}{" "}
        MB.
      </p>
      {fields.map((field) => {
        const value = draft[field.key],
          mode = value === null ? "env" : value === 0 ? "off" : "set",
          raw = text[field.key],
          invalid =
            mode === "set" &&
            raw !== undefined &&
            (!raw.trim() ||
              !Number.isFinite(Number(raw.replace(",", "."))) ||
              Number(raw.replace(",", ".")) <= 0 ||
              (!!field.integer &&
                !Number.isInteger(Number(raw.replace(",", ".")))));
        function choose(next: string) {
          setText((current) => ({ ...current, [field.key]: undefined }));
          set(
            field.key,
            next === "env"
              ? null
              : next === "off"
                ? 0
                : field.env && environment[field.env] > 0
                  ? environment[field.env]
                  : field.fallback,
          );
        }
        return (
          <div className="limit-row" key={field.key}>
            <div>
              <strong id={`limit-${field.key}`}>{t(field.label)}</strong>
              <p>{t(field.hint)}</p>
            </div>
            <div className="limit-control">
              {mode === "set" && (
                <label className="limit-value">
                  <input
                    aria-labelledby={`limit-${field.key}`}
                    inputMode={field.integer ? "numeric" : "decimal"}
                    aria-invalid={invalid}
                    value={raw ?? String(value)}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setText((current) => ({ ...current, [field.key]: raw }));
                      const n = Number(raw.replace(",", "."));
                      if (
                        raw.trim() &&
                        n > 0 &&
                        Number.isFinite(n) &&
                        (!field.integer || Number.isInteger(n))
                      )
                        set(field.key, n);
                    }}
                  />
                  <span>{t(field.unit)}</span>
                </label>
              )}
              {mode === "env" && (
                <span className="limit-environment">
                  {field.env && environment[field.env] > 0
                    ? `${environment[field.env]} ${field.unit}`
                    : t("Illimitato")}
                </span>
              )}
              <div
                className="segmented"
                role="group"
                aria-label={`${t(field.label)}: ${t("modalità")}`}
              >
                {field.env && (
                  <button
                    type="button"
                    aria-pressed={mode === "env"}
                    onClick={() => choose("env")}
                  >
                    {t("Server")}
                  </button>
                )}
                <button
                  type="button"
                  aria-pressed={mode === "set"}
                  onClick={() => choose("set")}
                >
                  {t("Limite")}
                </button>
                <button
                  type="button"
                  aria-pressed={mode === "off"}
                  onClick={() => choose("off")}
                >
                  {t("Illimitato")}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
