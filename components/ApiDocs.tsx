"use client";
import { useState } from "react";
import { API_OPERATIONS, API_SCOPES } from "@/lib/api-catalog";
export function ApiDocs({ baseUrl }: { baseUrl: string }) {
  const [search, setSearch] = useState(""),
    [family, setFamily] = useState("all");
  const families = [
    ...new Set(API_OPERATIONS.map((op) => op.path.split("/")[1])),
  ];
  return (
    <>
      <div className="settings-toolbar">
        <label className="field">
          Cerca endpoint
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Attività, progetti, allegati…"
          />
        </label>
        <label className="field">
          Risorsa
          <select
            value={family}
            onChange={(event) => setFamily(event.target.value)}
          >
            <option value="all">Tutte le risorse</option>
            {families.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="api-operations">
        {API_OPERATIONS.filter(
          (op) =>
            (family === "all" || op.path.split("/")[1] === family) &&
            (op.path + " " + op.summary)
              .toLowerCase()
              .includes(search.toLowerCase()),
        ).map((op) => (
          <details key={op.method + op.path} className="api-operation">
            <summary>
              <code className={`api-method ${op.method.toLowerCase()}`}>
                {op.method}
              </code>
              <code>/api/v1{op.path}</code>
              <span>{op.summary}</span>
            </summary>
            <p>
              {op.public
                ? "Pubblico"
                : op.scope
                  ? `Scope richiesto: ${op.scope}. I permessi sulle risorse si applicano sempre.`
                  : "Richiede un token valido o una sessione."}
            </p>
            <pre>
              <code>{`curl -X ${op.method} "${baseUrl}/api/v1${op.path}"${op.public ? "" : ' \\\n  -H "Authorization: Bearer $ERVISIO_TOKEN"'}${op.body ? ' \\\n  -H "Content-Type: application/json" \\\n  --data @payload.json' : ""}`}</code>
            </pre>
            {op.body && (
              <p>
                Lo schema del payload è disponibile nella specifica OpenAPI. Per
                gli upload usa multipart/form-data con file e listId.
              </p>
            )}
          </details>
        ))}
      </div>
      <details className="settings-section">
        <summary>Ambiti disponibili</summary>
        <p>
          <code>{API_SCOPES.join(", ")}</code>
        </p>
        <p>
          read e write concedono rispettivamente tutte le letture e tutte le
          scritture consentite all’utente. Un ambito write specifico non include
          la lettura. La selezione di progetti e liste limita quelle risorse e
          tutti i loro contenuti. Le operazioni globali richiedono i propri
          ambiti e, dove previsto, il ruolo amministratore.
        </p>
      </details>
    </>
  );
}
