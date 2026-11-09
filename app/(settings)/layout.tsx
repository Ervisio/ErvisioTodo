import { sessionUser } from "@/lib/server/page";
import { SettingsShell } from "@/components/shell/SettingsShell";
export const dynamic = "force-dynamic";
export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await sessionUser();
  // Without a session each page redirects to the login with its own return path.
  if (!user) return children;
  return (
    <SettingsShell userName={user.username} admin={user.role === "admin"}>
      {children}
    </SettingsShell>
  );
}
