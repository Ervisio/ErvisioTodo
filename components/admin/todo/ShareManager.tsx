"use client";
import { useState } from "react";
import useSWR from "swr";
import { dataFetcher, apiFetch } from "@/lib/client";
import { usePreferences } from "@/components/Preferences";
export function ShareManager({ listId }: { listId: string }) {
  const { t } = usePreferences(),
    { data: shares, mutate } = useSWR<
      { id: string; expires: number | null; created_at: number }[]
    >(`/api/admin/todo/lists/${listId}/shares`, dataFetcher),
    [hours, setHours] = useState(24),
    [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function create() {
    setBusy(true);
    setError("");
    try {
      const r = await apiFetch(`/api/admin/todo/lists/${listId}/shares`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lifetimeHours: hours }),
        }),
        b = await r.json();
      if (!r.ok) throw new Error(b.error);
      setUrl(new URL(b.data.path, location.origin).href);
      mutate();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <p className="settings-help">
        {t(
          "Il link mostra titoli, descrizioni, scadenze e stato delle attività. Allegati e dati dei membri restano privati.",
        )}
      </p>
      <label className="field">
        {t("Durata (ore; 0 = senza scadenza)")}
        <input
          type="number"
          min={0}
          max={87600}
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
        />
      </label>
      <button className="button" disabled={busy} onClick={create}>
        {t("Crea link")}
      </button>
      {url && (
        <div className="notice">
          <label className="field">
            {t("Link pubblico")}
            <input readOnly value={url} />
          </label>
          <button
            className="button secondary mt-3"
            onClick={() => navigator.clipboard.writeText(url)}
          >
            {t("Copia link")}
          </button>
          <p className="mt-2 text-xs">
            {t("Copia il link ora: non sarà più mostrato dopo la chiusura.")}
          </p>
        </div>
      )}
      <div>
        {shares?.length ? (
          shares.map((share) => (
            <div key={share.id} className="settings-row">
              <div>
                <strong>{share.id.slice(0, 8)}</strong>
                <p>
                  {t("Scadenza")}:{" "}
                  {share.expires
                    ? new Date(share.expires).toLocaleString()
                    : t("Mai")}
                </p>
              </div>
              <button
                className="button secondary"
                onClick={async () => {
                  const response = await apiFetch(
                    `/api/admin/todo/lists/${listId}/shares/${share.id}`,
                    { method: "DELETE" },
                  );
                  if (response.ok) mutate();
                }}
              >
                {t("Revoca")}
              </button>
            </div>
          ))
        ) : (
          <p className="settings-help">{t("Nessun link creato.")}</p>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
