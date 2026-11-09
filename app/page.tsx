import TodoApp from "@/components/TodoApp";
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
      <main className="workspace glass-workspace">
        <TodoApp
          initialListId={branding?._id}
          boundToHost={!!branding}
          currentUserId={user.id}
          userName={user.username}
        />
      </main>
    </>
  );
}
