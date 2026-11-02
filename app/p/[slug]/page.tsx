import TodoApp from "@/components/TodoApp";
import { AppHeader } from "@/components/AppHeader";
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
      <AppHeader name={user.username} role={user.role} />
      <main className="workspace">
        <TodoApp initialProjectId={project._id} currentUserId={user.id} />
      </main>
    </>
  );
}
