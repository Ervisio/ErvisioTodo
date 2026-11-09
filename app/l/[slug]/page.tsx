import TodoApp from "@/components/TodoApp";
import { pageUser } from "@/lib/server/page";
import { listBySlug } from "@/lib/server/todo";
import { notFound } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function ListPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params,
    user = await pageUser(`/l/${encodeURIComponent(slug)}`);
  let list;
  try {
    list = listBySlug(slug, user.id);
  } catch {
    notFound();
  }
  if (!list) notFound();
  return (
    <>
      <main className="workspace glass-workspace">
        <TodoApp
          initialListId={list._id}
          currentUserId={user.id}
          userName={user.username}
        />
      </main>
    </>
  );
}
