import { redirect } from "next/navigation";
import { pageUser } from "@/lib/server/page";
import { SettingsHead } from "@/components/shell/SettingsShell";
import { StorageSettings } from "@/components/StorageSettings";
export const dynamic = "force-dynamic";
export default async function StorageSettingsPage() {
  const user = await pageUser("/settings/storage");
  if (user.role !== "admin") redirect("/settings");
  return (
    <SettingsHead
      title="Archiviazione"
      description="Salva i dati su un server esterno e riportali indietro quando servono."
    >
      <StorageSettings />
    </SettingsHead>
  );
}
