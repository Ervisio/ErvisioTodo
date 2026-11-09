import { redirect } from "next/navigation";
import { pageUser } from "@/lib/server/page";
import { SettingsHead } from "@/components/shell/SettingsShell";
import { SettingsForm } from "@/components/SettingsForm";
export const dynamic = "force-dynamic";
export default async function WorkspaceSettings() {
  const user = await pageUser("/settings/workspace");
  if (user.role !== "admin") redirect("/settings");
  return (
    <SettingsHead
      title="Spazio di lavoro"
      description="Visibile solo agli amministratori."
    >
      <SettingsForm admin section="workspace" />
    </SettingsHead>
  );
}
