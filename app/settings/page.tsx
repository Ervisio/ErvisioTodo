import { pageUser } from "@/lib/server/page";
import { SettingsShell } from "@/components/shell/SettingsShell";
import { SettingsForm } from "@/components/SettingsForm";
export const dynamic = "force-dynamic";
export default async function Settings() {
  const user = await pageUser("/settings");
  return (
    <SettingsShell
      userName={user.username}
      admin={user.role === "admin"}
      active="appearance"
      title="Aspetto"
      description="Salvato su questo dispositivo."
    >
      <SettingsForm admin={false} section="personal" />
    </SettingsShell>
  );
}
