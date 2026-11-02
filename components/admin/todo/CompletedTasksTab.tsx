"use client";

import { apiFetch as fetch } from "@/lib/client";

import { useState } from "react";
import useSWR from "swr";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Icon } from "@/components/ui/Icon";
import {
  faRotateLeft,
  faCheck,
  faTrash,
  faChevronDown,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import type { TodoTaskPlain } from "@/types/todo";

const fetcher = (url: string) =>
  fetch(url)
    .then((r) => r.json())
    .then((r) => r.data ?? []);

function displayUser(
  u: { username?: string; name?: string; email?: string } | undefined | null,
): string {
  if (!u) return "—";
  return u.username ?? u.name ?? u.email ?? "—";
}

interface Props {
  listId: string;
  onChanged: () => void;
}

export function CompletedTasksTab({ listId, onChanged }: Props) {
  const {
    data: tasks,
    isLoading,
    mutate,
  } = useSWR<TodoTaskPlain[]>(
    `/api/admin/todo/tasks?listId=${listId}&completed=true`,
    fetcher,
    { revalidateOnFocus: true, refreshInterval: 30_000 },
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleReopen(id: string) {
    await fetch(`/api/admin/todo/tasks/${id}/reopen`, { method: "PATCH" });
    mutate();
    onChanged();
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Eliminare definitivamente la task completata "${title}"?`))
      return;
    await fetch(`/api/admin/todo/tasks/${id}`, { method: "DELETE" });
    mutate();
    onChanged();
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Icon icon={faCheck} className="mb-3 text-3xl text-ink-faint" />
        <p className="text-sm text-ink-faint">Nessuna task completata</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {tasks.map((task) => {
        const isExpanded = expandedIds.has(task._id);
        const completedAt = task.completedAt
          ? new Date(task.completedAt).toLocaleString("it-IT", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "—";
        const completedBy =
          displayUser(task.completedByUser) !== "—"
            ? displayUser(task.completedByUser)
            : task.completedBy
              ? task.completedBy
              : null;

        return (
          <div
            key={task._id}
            className="rounded-lg border border-white/5 bg-white/3 transition hover:bg-white/5"
          >
            {/* Header row */}
            <div className="flex items-center gap-3 px-4 py-3">
              {/* Expand toggle */}
              <button
                type="button"
                onClick={() => toggleExpanded(task._id)}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-faint transition hover:text-ink-dim"
                title={isExpanded ? "Chiudi dettagli" : "Vedi dettagli"}
              >
                <Icon
                  icon={isExpanded ? faChevronDown : faChevronRight}
                  className="text-xs"
                />
              </button>

              {/* Content */}
              <div
                className="min-w-0 flex-1 cursor-pointer"
                onClick={() => toggleExpanded(task._id)}
              >
                <p className="truncate text-sm font-medium text-ink-dim line-through">
                  {task.title}
                </p>
                <p className="mt-0.5 text-xs text-ink-faint">
                  Completato il{" "}
                  <span className="text-ink-dim">{completedAt}</span>
                  {completedBy && (
                    <>
                      {" "}
                      da{" "}
                      <span className="text-orange-400/70">{completedBy}</span>
                    </>
                  )}
                </p>
              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleReopen(task._id)}
                  className="flex items-center gap-1.5 rounded-lg border border-white/[0.04] bg-white/5 px-3 py-1.5 text-xs text-ink-dim transition hover:bg-white/10 hover:text-white"
                  title="Riapri task"
                >
                  <Icon icon={faRotateLeft} />
                  Riapri
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(task._id, task.title)}
                  className="flex items-center gap-1.5 rounded-lg border border-rose-500/15 bg-red-500/5 px-2.5 py-1.5 text-xs text-rose-400/60 transition hover:bg-red-500/15 hover:text-rose-400"
                  title="Elimina definitivamente"
                >
                  <Icon icon={faTrash} />
                </button>
              </div>
            </div>

            {/* Expanded details */}
            {isExpanded && (
              <div className="border-t border-white/5 px-4 pb-4 pt-3 space-y-3">
                {task.description ? (
                  <div
                    className="
                      prose prose-invert prose-sm max-w-none rounded-lg
                      bg-[var(--surface)] px-4 py-3
                      prose-p:text-ink-dim prose-li:text-ink-dim
                      prose-headings:text-white/80
                      prose-a:text-orange-400
                      prose-code:rounded prose-code:bg-white/10 prose-code:px-1 prose-code:text-orange-300
                      prose-strong:text-white/80
                    "
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {task.description}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-xs italic text-ink-faint">
                    Nessuna descrizione
                  </p>
                )}

                {task.assignedToUsers && task.assignedToUsers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-xs text-ink-faint self-center">
                      Assegnata a:
                    </span>
                    {task.assignedToUsers.map((u) => (
                      <span
                        key={u._id}
                        className="rounded-full bg-orange-500/15 px-2 py-0.5 text-xs text-orange-300"
                      >
                        {displayUser(u)}
                      </span>
                    ))}
                  </div>
                )}

                {task.dueDate && (
                  <p className="text-xs text-ink-faint">
                    Scadenza:{" "}
                    <span className="text-ink-dim">
                      {new Date(task.dueDate).toLocaleDateString("it-IT", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
