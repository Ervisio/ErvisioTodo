import { pageUser } from "@/lib/server/page";
import { AppHeader } from "@/components/AppHeader";
import { TokenManager } from "@/components/TokenManager";
import { AccountForm } from "@/components/AccountForm";
import { availableProviders, canonicalUrl } from "@/lib/server/config";
import { db } from "@/lib/server/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function Account() {
  const user = await pageUser("/account");
  if ((await headers()).get("host") !== new URL(canonicalUrl()).host)
    redirect(`${canonicalUrl()}/account`);
  const connected = (
    db()
      .prepare("SELECT provider FROM accounts WHERE user_id=?")
      .all(user.id) as { provider: string }[]
  ).map((x) => x.provider);
  return (
    <>
      <AppHeader name={user.username} role={user.role} />
      <main className="settings-page">
        <h1>Il tuo account</h1>
        <p>Gestisci il profilo e i metodi di accesso.</p>
        <AccountForm
          providers={availableProviders()}
          connected={connected}
          hasPassword={!!user.password}
          username={user.username}
          email={user.email}
        />
        <TokenManager admin={user.role === "admin"} />
      </main>
    </>
  );
}
