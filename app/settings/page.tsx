import { pageUser } from "@/lib/server/page";
import { AppHeader } from "@/components/AppHeader";
import { SettingsForm } from "@/components/SettingsForm";
export const dynamic = "force-dynamic";
export default async function Settings() {
  const user = await pageUser("/settings");
  return (
    <>
      <AppHeader name={user.username} role={user.role} />
      <main className="settings-page">
        <h1>Impostazioni</h1>
        <p>Preferenze personali e configurazione dello spazio ErvisioTodo.</p>
        <SettingsForm admin={user.role === "admin"} />
      </main>
    </>
  );
}
