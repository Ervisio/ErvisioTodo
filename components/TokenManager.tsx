"use client";
import { useState, useEffect } from "react";
import useSWR from "swr";
import { dataFetcher, apiFetch } from "@/lib/client";
import Link from "next/link";
import { API_SCOPES } from "@/lib/api-catalog";
import { usePreferences } from "./Preferences";
export function TokenManager({ admin }: { admin: boolean }) {
  const { t } = usePreferences(),
    { data: tokens = [], mutate } = useSWR<
      {
        id: string;
        name: string;
        scopes: string[];
        expires: number;
        last_used: number | null;
      }[]
    >("/api/admin/tokens", dataFetcher),
    { data: config } = useSWR("/api/public", dataFetcher),
    [name, setName] = useState(""),
    [scope, setScope] = useState("read"),
    [customScopes, setCustomScopes] = useState<string[]>(["tasks:read"]),
    [resourceMode, setResourceMode] = useState("all"),
    [projectIds, setProjectIds] = useState<string[]>([]),
    [listIds, setListIds] = useState<string[]>([]),
    { data: projects = [] } = useSWR<{ _id: string; title: string }[]>(
      "/api/admin/todo/projects",
      dataFetcher,
    ),
    { data: lists = [] } = useSWR<{ _id: string; title: string }[]>(
      "/api/admin/todo/lists",
      dataFetcher,
    ),
    [days, setDays] = useState(30),
    [token, setToken] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (config?.defaultTokenLifetimeDays)
      setDays(config.defaultTokenLifetimeDays);
  }, [config?.defaultTokenLifetimeDays]);
  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await apiFetch("/api/admin/tokens", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            scopes:
              scope === "custom"
                ? customScopes
                : scope === "read"
                  ? ["read"]
                  : ["read", "write"],
            resourceMode,
            projectIds,
            listIds,
            lifetimeDays: days,
          }),
        }),
        b = await r.json();
      if (!r.ok) throw new Error(b.error);
      setToken(b.data.token);
      setName("");
      mutate();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="settings-section">
      <h2>{t("Token API personali")}</h2>
      <p className="settings-help">
        {t(
          "I token operano con i tuoi permessi su progetti e liste. Il valore viene mostrato una sola volta.",
        )}
      </p>
      <p className="settings-help">
        <Link href="/api-docs">Documentazione API e collection Postman →</Link>
      </p>
      {config?.apiEnabled && (admin || config?.membersCanCreateTokens) && (
        <form className="token-create" onSubmit={create}>
          <label className="field">
            {t("Nome token")}
            <input
              required
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              placeholder="Es. integrazione personale"
            />
          </label>
          <label className="field">
            {t("Permessi")}
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="read">{t("Sola lettura")}</option>
              <option value="custom">Ambiti personalizzati</option>
              <option value="write">{t("Lettura e scrittura")}</option>
            </select>
          </label>
          <label className="field">
            {t("Durata (giorni)")}
            <input
              type="number"
              min={1}
              max={config.maxTokenLifetimeDays}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              required
            />
          </label>
          {scope === "custom" && (
            <fieldset className="col-span-full">
              <legend>Operazioni consentite</legend>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                {API_SCOPES.filter((item) => item.includes(":")).map((item) => (
                  <label key={item} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={customScopes.includes(item)}
                      onChange={(event) =>
                        setCustomScopes(
                          event.target.checked
                            ? [...customScopes, item]
                            : customScopes.filter((value) => value !== item),
                        )
                      }
                    />
                    {item}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <label className="field">
            Risorse
            <select
              value={resourceMode}
              onChange={(event) => setResourceMode(event.target.value)}
            >
              <option value="all">Tutte quelle accessibili</option>
              <option value="selected">Seleziona progetti e liste</option>
            </select>
          </label>
          {resourceMode === "selected" && (
            <div className="col-span-full grid md:grid-cols-2 gap-4">
              <label className="field">
                Progetti
                <select
                  multiple
                  aria-label="Progetti consentiti"
                  value={projectIds}
                  onChange={(event) =>
                    setProjectIds(
                      Array.from(
                        event.target.selectedOptions,
                        (option) => option.value,
                      ),
                    )
                  }
                >
                  {projects.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Liste
                <select
                  multiple
                  aria-label="Liste consentite"
                  value={listIds}
                  onChange={(event) =>
                    setListIds(
                      Array.from(
                        event.target.selectedOptions,
                        (option) => option.value,
                      ),
                    )
                  }
                >
                  {lists.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>
              <p className="settings-help">
                Un progetto include le sue liste. Usa Cmd/Ctrl per selezioni
                multiple. Le operazioni globali restano regolate dagli ambiti
                scelti.
              </p>
            </div>
          )}
          <button className="button" disabled={busy}>
            {t("Crea token")}
          </button>
        </form>
      )}
      {config && !config.apiEnabled && (
        <p className="settings-help">
          {t("Accesso API disabilitato dal gestore.")}
        </p>
      )}
      {token && (
        <div className="notice mt-5">
          <label className="field">
            {t("Copia il token ora: non sarà più mostrato.")}
            <input readOnly value={token} />
          </label>
          <button
            className="button secondary mt-3"
            onClick={() => navigator.clipboard.writeText(token)}
          >
            {t("Copia token")}
          </button>
        </div>
      )}
      {error && (
        <p className="error mt-4" role="alert">
          {error}
        </p>
      )}
      <div className="mt-5">
        {tokens.length ? (
          tokens.map((item) => (
            <div className="settings-row" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <p>
                  {item.scopes.join(", ")} · {t("Scadenza")}:{" "}
                  {new Date(item.expires).toLocaleDateString()}
                </p>
              </div>
              <button
                className="button secondary"
                onClick={async () => {
                  const response = await apiFetch(
                    `/api/admin/tokens/${item.id}`,
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
          <p className="settings-help">{t("Nessun token creato.")}</p>
        )}
      </div>
    </section>
  );
}
