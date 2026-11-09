import { pageUser } from "@/lib/server/page";
import { SettingsHead } from "@/components/shell/SettingsShell";
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
    <SettingsHead
      title="Il tuo account"
      description="Profilo, accesso e token personali."
    >
      <AccountForm
        providers={availableProviders()}
        connected={connected}
        hasPassword={!!user.password}
        username={user.username}
        email={user.email}
      />
      <TokenManager admin={user.role === "admin"} />
    </SettingsHead>
  );
}
