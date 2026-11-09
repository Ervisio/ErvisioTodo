import { canonicalUrl } from "@/lib/server/config";
import { pageUser } from "@/lib/server/page";
import { SettingsHead } from "@/components/shell/SettingsShell";
import { ApiDocs } from "@/components/ApiDocs";
export const dynamic = "force-dynamic";
export default async function Documentation() {
  await pageUser("/api-docs");
  const base = canonicalUrl();
  return (
    <SettingsHead
      title="Ogni operazione, via API."
      description="Progetti, liste, attività, allegati e utenti con gli stessi permessi dell’app."
      hero={
        <>
          <pre className="api-curl">
            <code>{`curl ${base}/api/v1/projects \\\n  -H "Authorization: Bearer $ERVISIO_TOKEN"`}</code>
          </pre>
          <div className="api-hero-actions">
            <a className="button" href="/account">
              Crea un token
            </a>
            <a
              className="button secondary"
              href="/api/openapi.json"
              target="_blank"
              rel="noreferrer"
            >
              Specifica OpenAPI 3.1
            </a>
            <a className="button secondary" href="/api/postman.json" download>
              Collection Postman
            </a>
          </div>
        </>
      }
    >
      <ApiDocs baseUrl={base} />
      <details className="settings-section">
        <summary>Convenzioni</summary>
        <p className="settings-help">
          Accedi con un token personale creato da Account, oppure con POST
          /api/v1/auth/login usando username o email e password. Google, Discord
          e Cognito usano l’accesso dal browser; dopo il login puoi generare un
          token.
        </p>
        <p className="settings-help">
          Risposte JSON: success e data, oppure success: false ed error. Le
          collezioni usano limit (1–500, default 100), offset e pagination. Le
          scritture con cookie richiedono Origin; i token Bearer possono essere
          usati direttamente dai client. I token derivati non possono superare
          scope, risorse o scadenza del padre. La revoca è immediata.
        </p>
      </details>
    </SettingsHead>
  );
}
