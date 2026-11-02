import TodoApp from "@/components/TodoApp";
import { AppHeader } from "@/components/AppHeader";
import { pageUser } from "@/lib/server/page";
import { brandingFor, getList } from "@/lib/server/todo";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function Home() {
  const user = await pageUser(),
    branding = brandingFor((await headers()).get("host") || "");
  if (branding) {
    try {
      getList(branding._id, user.id);
    } catch {
      notFound();
    }
  }
  return (
    <>
      <AppHeader name={user.username} role={user.role} />
      <main className="workspace">
        <TodoApp
          initialListId={branding?._id}
          boundToHost={!!branding}
          currentUserId={user.id}
        />
      </main>
    </>
  );
}
