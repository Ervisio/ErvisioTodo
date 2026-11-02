import { canonicalUrl } from "@/lib/server/config";
import Link from "next/link";
import { pageUser } from "@/lib/server/page";
import { AppHeader } from "@/components/AppHeader";
import { ApiDocs } from "@/components/ApiDocs";
export const dynamic = "force-dynamic";
export default async function Documentation() {
  const user = await pageUser("/api-docs");
  return (
    <>
      <AppHeader name={user.username} role={user.role} />
      <main className="settings-page api-docs">
        <p className="eyebrow">INTEGRAZIONI · REST API v1</p>
        <h1>Ogni operazione, via API.</h1>
        <p>
          Gestisci progetti, liste, attività, allegati, utenti e configurazione
          con gli stessi permessi dell’app.
        </p>
        <div className="settings-section">
          <h2>Inizia dal tuo account</h2>
          <p>
            Crea un token personale da <Link href="/account">Account</Link>,
            oppure usa POST /api/v1/auth/login con username/email e password.
            Google, Discord e Cognito usano l’accesso browser; dopo il login
            puoi generare un token personale.
          </p>
          <pre>
            <code>
              {
                'curl http://localhost:3000/api/v1/projects \\\n  -H "Authorization: Bearer $ERVISIO_TOKEN"'
              }
            </code>
          </pre>
          <div className="flex flex-wrap gap-3">
            <a
              className="button"
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
          <p className="settings-help">
            Risposte JSON: success e data, oppure success: false ed error. Le
            collezioni usano limit (1–500, default 100), offset e pagination. Le
            scritture con cookie richiedono Origin; i token Bearer possono
            essere usati direttamente dai client. I token derivati non possono
            superare scope, risorse o scadenza del padre. La revoca è immediata.
          </p>
        </div>
        <ApiDocs baseUrl={canonicalUrl()} />
      </main>
    </>
  );
}
