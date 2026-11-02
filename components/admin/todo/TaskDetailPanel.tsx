"use client";

import { useCapabilities } from "@/hooks/useCapabilities";
import { apiFetch as fetch } from "@/lib/client";

import { useState, useEffect } from "react";
import useSWR, { useSWRConfig } from "swr";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { AdminModal } from "@/components/admin/AdminModal";
import { Icon } from "@/components/ui/Icon";
import {
  faXmark,
  faPen,
  faClock,
  faExclamationTriangle,
  faUser,
  faPaperclip,
  faCircleCheck,
  faList,
  faWandMagicSparkles,
  faTag,
} from "@fortawesome/free-solid-svg-icons";
import type { TodoTaskPlain, TodoTagPlain } from "@/types/todo";

const fetcher = (url: string) =>
  fetch(url)
    .then((r) => r.json())
    .then((r) => r.data ?? null);

const arrayFetcher = (url: string) =>
  fetch(url)
    .then((r) => r.json())
    .then((r) => r.data ?? []);

function formatDate(
  iso: string | null | undefined,
  opts?: Intl.DateTimeFormatOptions,
): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(
    "it-IT",
    opts ?? {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  );
}

function isOverdue(iso: string | null | undefined): boolean {
  if (!iso) return false;
  return new Date(iso) < new Date();
}

interface Props {
  taskId: string | null;
  onClose: () => void;
  onEdit: (task: TodoTaskPlain) => void;
}

export function TaskDetailPanel({ taskId, onClose, onEdit }: Props) {
  const { aiEnabled } = useCapabilities();
  const [isRefactoring, setIsRefactoring] = useState(false);
  const [showRefactorModal, setShowRefactorModal] = useState(false);
  const [generateSubtasks, setGenerateSubtasks] = useState(false);
  const [includeSubtasks, setIncludeSubtasks] = useState(false);
  const [errorStr, setErrorStr] = useState<string | null>(null);

  const { mutate: globalMutate } = useSWRConfig();

  const { data: task, isLoading } = useSWR<TodoTaskPlain>(
    taskId ? `/api/admin/todo/tasks/${taskId}` : null,
    fetcher,
    { revalidateOnFocus: true, refreshInterval: 30_000 },
  );

  // Fetch tags for the task's list to render tag badges
  const { data: listTags } = useSWR<TodoTagPlain[]>(
    task?.listId ? `/api/admin/todo/tags?listId=${task.listId}` : null,
    arrayFetcher,
    { revalidateOnFocus: false },
  );

  const tagMap: Record<string, TodoTagPlain> = {};
  if (listTags) {
    for (const t of listTags) tagMap[t._id] = t;
  }

  const visible = !!taskId;
  useEffect(() => {
    if (!visible) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [visible, onClose]);

  function promptRefactorAI() {
    if (!task) return;
    setGenerateSubtasks(false);
    setIncludeSubtasks(false);
    setErrorStr(null);
    setShowRefactorModal(true);
  }

  async function handleConfirmRefactorAI() {
    if (!task) return;
    setIsRefactoring(true);
    setErrorStr(null);

    try {
      const res = await fetch(`/api/admin/todo/tasks/${task._id}/ai-refactor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "both",
          includeSubtasks,
          generateSubtasks,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Refactor failed");
      }
      globalMutate(
        (key: unknown) =>
          typeof key === "string" && key.startsWith("/api/admin/todo/tasks"),
        undefined,
        { revalidate: true },
      );
      setShowRefactorModal(false);
    } catch (err: any) {
      setErrorStr("Errore durante il refactor AI: " + err.message);
    } finally {
      setIsRefactoring(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      {visible && (
        <div
          className="task-panel-backdrop fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Sliding panel */}
      <div
        aria-hidden={!visible}
        inert={!visible}
        role="dialog"
        aria-label="Dettaglio attività"
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-white/[0.04] bg-[var(--surface)] shadow-2xl transition-transform duration-300 ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.04] px-5 py-4">
          <h3 className="text-xs font-semibold  text-ink-faint">
            Dettaglio Task
          </h3>
          <div className="flex items-center gap-2">
            {task && (
              <>
                <button
                  hidden={!aiEnabled}
                  onClick={promptRefactorAI}
                  disabled={isRefactoring}
                  title="Refactor AI"
                  className={`flex items-center gap-1.5 rounded-lg bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-400 transition hover:bg-blue-500/20 ${isRefactoring ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <Icon
                    icon={faWandMagicSparkles}
                    className={`text-[10px] ${isRefactoring ? "animate-pulse" : ""}`}
                  />
                  Refactor
                </button>
                <button
                  onClick={() => onEdit(task)}
                  className="flex items-center gap-1.5 rounded-lg bg-orange-500/10 px-3 py-1.5 text-xs font-medium text-orange-400 transition hover:bg-orange-500/20"
                >
                  <Icon icon={faPen} className="text-[10px]" />
                  Modifica
                </button>
              </>
            )}
            <button
              onClick={onClose}
              aria-label="Chiudi"
              className="rounded-lg p-1.5 text-ink-faint transition hover:bg-white/5 hover:text-white"
            >
              <Icon icon={faXmark} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {isLoading && (
            <div className="flex justify-center py-12">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            </div>
          )}

          {!isLoading && !task && taskId && (
            <p className="py-12 text-center text-sm text-ink-faint">
              Task non trovata.
            </p>
          )}

          {!isLoading && task && (
            <>
              {/* Title + status badge */}
              <div className="flex items-start gap-3">
                <h2 className="flex-1 text-lg font-semibold leading-snug text-white">
                  {task.title}
                </h2>
                {task.isCompleted ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
                    <Icon icon={faCircleCheck} className="text-[10px]" />
                    Completata
                  </span>
                ) : task.dueDate && isOverdue(task.dueDate) ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-rose-500/[0.06] px-2.5 py-1 text-xs font-medium text-rose-400">
                    <Icon
                      icon={faExclamationTriangle}
                      className="text-[10px]"
                    />
                    Scaduta
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-ink-dim">
                    Attiva
                  </span>
                )}
              </div>

              {/* Meta grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-white/5 p-3">
                  <p className="mb-1 text-[10px]  text-ink-faint">Creata da</p>
                  <p className="truncate font-medium text-white">
                    {task.createdByUser
                      ? (task.createdByUser.username ??
                        task.createdByUser.name ??
                        task.createdByUser.email ??
                        "Utente")
                      : task.createdBy
                        ? "Utente"
                        : "—"}
                  </p>
                </div>

                <div className="rounded-lg bg-white/5 p-3">
                  <p className="mb-1 text-[10px]  text-ink-faint">Creata il</p>
                  <p className="font-medium text-white">
                    {formatDate(task.createdAt, {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>

                {task.dueDate && (
                  <div
                    className={`rounded-lg p-3 ${
                      isOverdue(task.dueDate) && !task.isCompleted
                        ? "bg-rose-500/[0.06]"
                        : "bg-white/5"
                    }`}
                  >
                    <p className="mb-1 text-[10px]  text-ink-faint">Scadenza</p>
                    <p
                      className={`flex items-center gap-1 font-medium ${
                        isOverdue(task.dueDate) && !task.isCompleted
                          ? "text-rose-400"
                          : "text-white"
                      }`}
                    >
                      <Icon
                        icon={
                          isOverdue(task.dueDate) && !task.isCompleted
                            ? faExclamationTriangle
                            : faClock
                        }
                        className="text-[10px]"
                      />
                      {formatDate(task.dueDate, {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                )}

                <div className="rounded-lg bg-white/5 p-3">
                  <p className="mb-1 text-[10px]  text-ink-faint">Aggiornata</p>
                  <p className="font-medium text-white">
                    {formatDate(task.updatedAt, {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>

                {task.isCompleted && task.completedAt && (
                  <div className="col-span-2 rounded-lg bg-emerald-500/10 p-3">
                    <p className="mb-1 text-[10px]  text-emerald-400/60">
                      Completata il
                    </p>
                    <p className="font-medium text-emerald-400">
                      {formatDate(task.completedAt)}
                      {task.completedByUser && (
                        <span className="ml-1 text-emerald-300/70">
                          da{" "}
                          {task.completedByUser.username ??
                            task.completedByUser.name ??
                            task.completedByUser.email ??
                            "Utente"}
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>

              {/* Assigned to */}
              {task.assignedToUsers && task.assignedToUsers.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium  text-ink-faint">
                    <Icon icon={faUser} className="mr-1.5 text-[10px]" />
                    Assegnata a
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {task.assignedToUsers.map((u) => (
                      <span
                        key={u._id}
                        className="rounded-full bg-orange-500/15 px-3 py-1 text-xs font-medium text-orange-300"
                      >
                        {u.username ?? u.name ?? u.email ?? u._id}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {task.tags && task.tags.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium  text-ink-faint">
                    <Icon icon={faTag} className="mr-1.5 text-[10px]" />
                    Tag
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {task.tags.map((tagId) => {
                      const tag = tagMap[tagId];
                      if (!tag) return null;
                      return (
                        <span
                          key={tagId}
                          className="rounded-full px-3 py-1 text-xs font-medium"
                          style={{
                            backgroundColor: tag.color + "25",
                            color: tag.color,
                          }}
                        >
                          {tag.name}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <p className="mb-2 text-xs font-medium  text-ink-faint">
                  <Icon icon={faList} className="mr-1.5 text-[10px]" />
                  Descrizione
                </p>
                {task.description ? (
                  <div
                    className="
                      prose prose-invert prose-sm max-w-none rounded-lg
                      bg-[var(--surface)] px-4 py-3
                      prose-p:text-white/80 prose-li:text-white/80
                      prose-headings:text-white
                      prose-a:text-orange-400
                      prose-code:rounded prose-code:bg-white/10 prose-code:px-1 prose-code:text-orange-300
                      prose-blockquote:border-l-orange-500/40 prose-blockquote:text-ink-dim
                      prose-strong:text-white
                    "
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                      {task.description}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="rounded-lg bg-[var(--surface)] px-4 py-3 text-xs italic text-ink-faint">
                    Nessuna descrizione
                  </p>
                )}
              </div>

              {/* Attachments */}
              {task.attachments && task.attachments.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium  text-ink-faint">
                    <Icon icon={faPaperclip} className="mr-1.5 text-[10px]" />
                    Allegati ({task.attachments.length})
                  </p>
                  <div className="space-y-2">
                    {task.attachments.map((att, i) => (
                      <a
                        key={i}
                        href={att.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 rounded-lg border border-white/[0.04] bg-[var(--surface)] px-3 py-2.5 text-sm text-ink-dim transition hover:border-orange-500/20 hover:text-white"
                      >
                        <Icon
                          icon={faPaperclip}
                          className="shrink-0 text-ink-faint"
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {att.name}
                        </span>
                        <span className="shrink-0 text-[10px] uppercase text-ink-faint">
                          {att.mimeType.split("/").pop()}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Subtask count */}
              {(task.childCount ?? 0) > 0 && (
                <p className="rounded-lg bg-[var(--surface)] px-4 py-3 text-xs text-ink-dim">
                  {task.childCount} sottotask collegat
                  {(task.childCount ?? 0) === 1 ? "a" : "e"}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <AdminModal
        open={showRefactorModal}
        title="Refactor AI"
        onClose={() => setShowRefactorModal(false)}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-white/80">
            Vuoi eseguire un refactor AI di titolo e descrizione per questa
            task?
          </p>
          <div className="flex flex-col gap-3 pt-2">
            <label className="flex items-center gap-2 text-sm text-ink-dim">
              <input
                type="checkbox"
                checked={generateSubtasks}
                onChange={(e) => setGenerateSubtasks(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
              />
              Genera Sottotask automaticamente
            </label>

            {task && (task.childCount ?? 0) > 0 && (
              <label className="flex items-center gap-2 text-sm text-ink-dim">
                <input
                  type="checkbox"
                  checked={includeSubtasks}
                  onChange={(e) => setIncludeSubtasks(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                />
                Includi le sottotask esistenti
              </label>
            )}
          </div>

          {errorStr && (
            <p className="rounded-lg bg-rose-500/[0.06] px-3 py-2 text-xs text-rose-400">
              {errorStr}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowRefactorModal(false)}
              disabled={isRefactoring}
              className="rounded-lg border border-white/[0.04] px-4 py-2 text-sm text-ink-dim transition hover:bg-white/5 hover:text-white"
            >
              Annulla
            </button>
            <button
              onClick={handleConfirmRefactorAI}
              disabled={isRefactoring}
              className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
            >
              {isRefactoring ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border border-white/30 border-t-white" />
              ) : null}
              Conferma
            </button>
          </div>
        </div>
      </AdminModal>
    </>
  );
}
