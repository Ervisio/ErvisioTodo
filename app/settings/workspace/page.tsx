import { redirect } from "next/navigation";
import { pageUser } from "@/lib/server/page";
import { SettingsShell } from "@/components/shell/SettingsShell";
import { SettingsForm } from "@/components/SettingsForm";
export const dynamic = "force-dynamic";
export default async function WorkspaceSettings() {
  const user = await pageUser("/settings/workspace");
  if (user.role !== "admin") redirect("/settings");
  return (
    <SettingsShell
      userName={user.username}
      admin
      active="workspace"
      title="Spazio di lavoro"
      description="Visibile solo agli amministratori."
    >
      <SettingsForm admin section="workspace" />
    </SettingsShell>
  );
}
