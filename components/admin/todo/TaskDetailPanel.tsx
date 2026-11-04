"use client";

import { useCapabilities } from "@/hooks/useCapabilities";
import { apiFetch as fetch, dataFetcher } from "@/lib/client";
import { usePreferences } from "@/components/Preferences";

import { useState, useEffect, useId, useRef } from "react";
import useSWR from "swr";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { AdminModal } from "@/components/admin/AdminModal";
import { Icon } from "@/components/ui/Icon";
import {
  faXmark,
  faTrash,
  faPen,
  faCheck,
  faPlus,
  faPaperclip,
  faRotateLeft,
  faStar,
  faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons";
import { faStar as faStarOutline } from "@fortawesome/free-regular-svg-icons";
import type { TodoListPlain, TodoTaskPlain, TodoTagPlain } from "@/types/todo";
import { useSubtasks, useTaskActions } from "./taskActions";

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

const shortDate: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short",
  year: "numeric",
};

function isOverdue(iso: string | null | undefined): boolean {
  if (!iso) return false;
  return new Date(iso) < new Date();
}

function displayUser(
  u: { username?: string; name?: string; email?: string; _id?: string },
  fallback = "Utente",
) {
  return u.username ?? u.name ?? u.email ?? u._id ?? fallback;
}

function SubtaskRow({
  task,
  parentTitle,
  depth,
  onOpen,
}: {
  task: TodoTaskPlain;
  parentTitle?: string;
  depth: number;
  onOpen: (id: string) => void;
}) {
  const { t } = usePreferences(),
    { complete, reopen, revalidate } = useTaskActions(),
    nested = useSubtasks(task.listId, task._id, (task.childCount ?? 0) > 0),
    [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    try {
      if (task.isCompleted ? await reopen(task._id) : await complete(task._id))
        await revalidate();
    } catch {
      /* apiFetch already displays the connection error. */
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div
        className="subtask-row"
        data-subtask={task._id}
        style={{ marginLeft: depth * 24 }}
      >
        <button
          type="button"
          role="checkbox"
          className="check-task"
          aria-checked={task.isCompleted}
          aria-label={task.title}
          disabled={busy}
          onClick={toggle}
        >
          <span>{task.isCompleted && <Icon icon={faCheck} />}</span>
        </button>
        <div className="task-copy">
          <button
            type="button"
            className={`task-title${task.isCompleted ? " done" : ""}`}
            onClick={() => onOpen(task._id)}
          >
            {task.title}
          </button>
          {parentTitle && (
            <span className="parent-note">
              {t("In")} {parentTitle}
            </span>
          )}
        </div>
      </div>
      {[...(nested.open ?? []), ...(nested.done ?? [])].map((child) => (
        <SubtaskRow
          key={child._id}
          task={child}
          parentTitle={task.title}
          depth={depth + 1}
          onOpen={onOpen}
        />
      ))}
    </>
  );
}

interface Props {
  taskId: string;
  onClose: () => void;
  onEdit: (task: TodoTaskPlain) => void;
  onAddSubtask: (task: TodoTaskPlain) => void;
  onOpenTask: (taskId: string) => void;
}

export function TaskDetailPanel({
  taskId,
  onClose,
  onEdit,
  onAddSubtask,
  onOpenTask,
}: Props) {
  const { aiEnabled } = useCapabilities(),
    { t } = usePreferences(),
    { complete, reopen, remove, removeFromLists, revalidate } =
      useTaskActions();
  const [isRefactoring, setIsRefactoring] = useState(false);
  const [showRefactorModal, setShowRefactorModal] = useState(false);
  const [generateSubtasks, setGenerateSubtasks] = useState(false);
  const [includeSubtasks, setIncludeSubtasks] = useState(false);
  const [errorStr, setErrorStr] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const headingId = useId(),
    titleId = useId(),
    titleRef = useRef<HTMLHeadingElement>(null),
    closeRef = useRef<HTMLButtonElement>(null);

  const { data: task, isLoading } = useSWR<TodoTaskPlain>(
    `/api/admin/todo/tasks/${taskId}`,
    dataFetcher,
    { revalidateOnFocus: true, refreshInterval: 30_000 },
  );
  const { data: parent } = useSWR<TodoTaskPlain>(
    task?.parentTaskId ? `/api/admin/todo/tasks/${task.parentTaskId}` : null,
    dataFetcher,
  );
  const { data: lists } = useSWR<TodoListPlain[]>(
    "/api/admin/todo/lists",
    dataFetcher,
  );
  const { data: listTags } = useSWR<TodoTagPlain[]>(
    task?.listId ? `/api/admin/todo/tags?listId=${task.listId}` : null,
    dataFetcher,
    { revalidateOnFocus: false },
  );
  const subtasks = useSubtasks(task?.listId ?? "", taskId, !!task);

  const tagMap: Record<string, TodoTagPlain> = {};
  for (const tag of listTags ?? []) tagMap[tag._id] = tag;
  const list = lists?.find((l) => l._id === task?.listId),
    overdue = !!task && !task.isCompleted && isOverdue(task.dueDate),
    done = subtasks.done?.length ?? 0;

  useEffect(() => {
    const origin = document.activeElement as HTMLElement | null;
    return () => {
      const active = document.activeElement;
      if (origin?.isConnected && (!active || active === document.body))
        origin.focus();
    };
  }, []);

  useEffect(() => {
    if (task) titleRef.current?.focus();
    else if (!isLoading) closeRef.current?.focus();
  }, [task?._id, isLoading]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        !(event.target as Element | null)?.closest?.("dialog[open]")
      )
        onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);

  async function toggleFavorite() {
    try {
      await fetch(`/api/admin/todo/tasks/${taskId}/favorite`, {
        method: "PATCH",
      });
      await revalidate();
    } catch {
      /* apiFetch already displays the connection error. */
    }
  }

  async function toggleCompleted() {
    if (!task) return;
    setToggling(true);
    try {
      if (task.isCompleted) {
        if (await reopen(task._id)) await revalidate();
      } else if (await complete(task._id)) {
        removeFromLists(task._id);
        await revalidate();
      }
    } catch {
      /* apiFetch already displays the connection error. */
    } finally {
      setToggling(false);
    }
  }

  async function deleteTask() {
    if (!task) return;
    try {
      if (await remove(task)) onClose();
    } catch {
      /* apiFetch already displays the connection error. */
    }
  }

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
      revalidate();
      setShowRefactorModal(false);
    } catch (err: any) {
      setErrorStr("Errore durante il refactor AI: " + err.message);
    } finally {
      setIsRefactoring(false);
    }
  }

  return (
    <>
      <aside
        aria-labelledby={task ? `${headingId} ${titleId}` : headingId}
        className="task-detail"
      >
        <header>
          <h3 id={headingId}>{t("Dettaglio attività")}</h3>
          <div>
            {task && aiEnabled && (
              <button
                onClick={promptRefactorAI}
                disabled={isRefactoring}
                title="Refactor AI"
                aria-label="Refactor AI"
                className="icon-button"
              >
                <Icon
                  icon={faWandMagicSparkles}
                  className={isRefactoring ? "animate-pulse" : undefined}
                />
              </button>
            )}
            {task && (
              <button
                onClick={deleteTask}
                title={t("Elimina attività")}
                aria-label={t("Elimina attività")}
                className="icon-button danger-icon"
              >
                <Icon icon={faTrash} />
              </button>
            )}
            <button
              ref={closeRef}
              onClick={onClose}
              title={t("Chiudi")}
              aria-label={t("Chiudi")}
              className="icon-button"
            >
              <Icon icon={faXmark} />
            </button>
          </div>
        </header>

        <div className="detail-content">
          {isLoading && <div className="task-loading" />}

          {!isLoading && !task && (
            <p className="detail-empty">{t("Attività non trovata.")}</p>
          )}

          {task && (
            <>
              <div className="detail-status">
                <span
                  className={`status-dot${task.isCompleted ? " done" : overdue ? " overdue" : ""}`}
                  aria-hidden="true"
                />
                <span role="status">
                  {t(
                    task.isCompleted
                      ? "Completata"
                      : overdue
                        ? "Scaduta"
                        : "Da completare",
                  )}
                </span>
                <button
                  className="icon-button favorite"
                  aria-pressed={task.isFavorite}
                  aria-label={t("Preferita")}
                  title={t(
                    task.isFavorite
                      ? "Rimuovi dai preferiti"
                      : "Aggiungi ai preferiti",
                  )}
                  onClick={toggleFavorite}
                >
                  <Icon icon={task.isFavorite ? faStar : faStarOutline} />
                </button>
              </div>
              <h2 id={titleId} ref={titleRef} tabIndex={-1}>
                {task.title}
              </h2>

              <dl className="detail-meta">
                {list && (
                  <div>
                    <dt>{t("Lista")}</dt>
                    <dd>{list.title}</dd>
                  </div>
                )}
                {task.parentTaskId && parent && (
                  <div>
                    <dt>{t("Sottoattività di")}</dt>
                    <dd>
                      <button onClick={() => onOpenTask(parent._id)}>
                        {parent.title}
                      </button>
                    </dd>
                  </div>
                )}
                {task.dueDate && (
                  <div>
                    <dt>{t("Scadenza")}</dt>
                    <dd className={overdue ? "overdue" : undefined}>
                      {formatDate(task.dueDate, shortDate)}
                    </dd>
                  </div>
                )}
                {!!task.assignedToUsers?.length && (
                  <div>
                    <dt>{t("Assegnata a")}</dt>
                    <dd>
                      {task.assignedToUsers
                        .map((u) => displayUser(u))
                        .join(", ")}
                    </dd>
                  </div>
                )}
                {task.tags.length > 0 && (
                  <div>
                    <dt>{t("Tag")}</dt>
                    <dd className="detail-tags">
                      {task.tags.map((tagId) => {
                        const tag = tagMap[tagId];
                        return tag ? (
                          <span key={tagId} className="tag">
                            <i style={{ background: tag.color }} />
                            {tag.name}
                          </span>
                        ) : null;
                      })}
                    </dd>
                  </div>
                )}
                <div>
                  <dt>{t("Creata")}</dt>
                  <dd>
                    {formatDate(task.createdAt, shortDate)}
                    {task.createdByUser &&
                      ` · ${displayUser(task.createdByUser)}`}
                  </dd>
                </div>
                <div>
                  <dt>{t("Aggiornata")}</dt>
                  <dd>{formatDate(task.updatedAt, shortDate)}</dd>
                </div>
                {task.isCompleted && task.completedAt && (
                  <div>
                    <dt>{t("Completata")}</dt>
                    <dd>
                      {formatDate(task.completedAt)}
                      {task.completedByUser &&
                        ` · ${displayUser(task.completedByUser)}`}
                    </dd>
                  </div>
                )}
              </dl>

              <h3>{t("Descrizione")}</h3>
              {task.description ? (
                <div className="prose prose-sm max-w-none detail-description">
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                    {task.description}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="detail-empty">{t("Nessuna descrizione")}</p>
              )}

              <h3>
                {t("Sottoattività")}
                <span>
                  {done}/{subtasks.total}
                </span>
              </h3>
              <div
                className="detail-subtasks"
                role="group"
                aria-label={t("Sottoattività")}
              >
                {[...(subtasks.open ?? []), ...(subtasks.done ?? [])].map(
                  (child) => (
                    <SubtaskRow
                      key={child._id}
                      task={child}
                      depth={0}
                      onOpen={onOpenTask}
                    />
                  ),
                )}
              </div>
              <button
                className="add-subtask"
                onClick={() => onAddSubtask(task)}
              >
                <Icon icon={faPlus} />
                {t("Aggiungi sottoattività")}
              </button>

              {task.attachments.length > 0 && (
                <>
                  <h3>
                    {t("Allegati")}
                    <span>{task.attachments.length}</span>
                  </h3>
                  <div className="detail-attachments">
                    {task.attachments.map((att, i) => (
                      <a
                        key={i}
                        href={att.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Icon icon={faPaperclip} />
                        <span>{att.name}</span>
                        <small>{att.mimeType.split("/").pop()}</small>
                      </a>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {task && (
          <footer>
            <button className="button secondary" onClick={() => onEdit(task)}>
              <Icon icon={faPen} />
              {t("Modifica")}
            </button>
            <button
              className="button"
              disabled={toggling}
              onClick={toggleCompleted}
            >
              <Icon icon={task.isCompleted ? faRotateLeft : faCheck} />
              {t(task.isCompleted ? "Riapri" : "Completa")}
            </button>
          </footer>
        )}
      </aside>

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
