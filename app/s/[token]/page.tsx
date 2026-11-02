import { sharedList } from "@/lib/server/shares";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Lista condivisa",
  robots: { index: false, follow: false },
};
export default async function SharedPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = (() => {
    try {
      return sharedList(token);
    } catch {
      notFound();
    }
  })();
  function tasks(parent: string | null, depth = 0): React.ReactNode {
    return data.tasks
      .filter((task) => task.parentTaskId === parent)
      .map((task) => (
        <div
          key={task._id}
          className="shared-task"
          style={{ marginLeft: depth ? 18 : 0 }}
        >
          <div className="flex items-start gap-3">
            <span
              aria-label={task.isCompleted ? "Completata" : "Da completare"}
              className="mt-1"
            >
              {task.isCompleted ? "☑" : "○"}
            </span>
            <div className="min-w-0 flex-1">
              <h2
                className={
                  task.isCompleted ? "line-through text-ink-faint" : ""
                }
              >
                {task.title}
              </h2>
              {task.dueDate && (
                <p className="mt-1 text-xs text-ink-faint">
                  {new Date(task.dueDate).toLocaleDateString("it-IT")}
                </p>
              )}
              {task.description && (
                <div className="prose prose-sm mt-3 max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {task.description}
                  </ReactMarkdown>
                </div>
              )}
              {tasks(task._id, depth + 1)}
            </div>
          </div>
        </div>
      ));
  }
  return (
    <main className="public-list">
      <a href="/" className="wordmark">
        <span className="brand-symbol">✓</span>ErvisioTodo
      </a>
      <p className="mt-10 text-xs text-ink-faint">
        Lista condivisa · Sola lettura
      </p>
      <h1 className="mt-3 text-3xl font-semibold">{data.list.title}</h1>
      <div className="mt-8">{tasks(null)}</div>
    </main>
  );
}
