import TodoApp from "@/components/TodoApp";
import { pageUser } from "@/lib/server/page";
import { projectBySlug } from "@/lib/server/projects";
import { notFound } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params,
    user = await pageUser(`/p/${encodeURIComponent(slug)}`);
  let project;
  try {
    project = projectBySlug(slug, user.id);
  } catch {
    notFound();
  }
  if (!project) notFound();
  return (
    <>
      <main className="workspace glass-workspace">
        <TodoApp
          initialProjectId={project._id}
          currentUserId={user.id}
          userName={user.username}
        />
      </main>
    </>
  );
}
