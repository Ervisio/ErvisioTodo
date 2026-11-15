"use client";

import { useCapabilities } from "@/hooks/useCapabilities";
import { apiFetch as fetch, dataFetcher } from "@/lib/client";
import { usePreferences } from "@/components/Preferences";

import { useState, useEffect, useRef, useLayoutEffect } from "react";
import useSWR from "swr";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { AdminModal } from "@/components/admin/AdminModal";
import { Icon } from "@/components/ui/Icon";
import { OverflowMenu } from "@/components/ui/OverflowMenu";
import {
  faXmark,
  faTrash,
  faPen,
  faCheck,
  faPlus,
  faPaperclip,
  faStar,
  faCalendar,
  faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons";
import { faStar as faStarOutline } from "@fortawesome/free-regular-svg-icons";
import type { TodoTaskPlain, TodoTagPlain } from "@/types/todo";
import { useSubtasks, useTaskActions } from "./taskActions";

function formatDate(
  iso: string | null | undefined,
  opts: Intl.DateTimeFormatOptions,
  locale: string,
): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(locale, opts);
}

const shortDate: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
};

const fullDate: Intl.DateTimeFormatOptions = {
  ...shortDate,
  hour: "2-digit",
  minute: "2-digit",
};

function localDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function daysFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDay(date);
}

function nextMonday(): string {
  const days = 7 - ((new Date().getDay() + 6) % 7);
  return daysFromToday(days === 1 ? 8 : days);
}

function isOverdue(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return new Date(iso) < start;
}

function displayUser(
  u: { username?: string; name?: string; email?: string; _id?: string },
  fallback = "Utente",
) {
  return u.username ?? u.name ?? u.email ?? u._id ?? fallback;
}

function grow(element: HTMLTextAreaElement | null) {
  if (!element) return;
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
}

function SubtaskRow({
  task,
  depth,
  onOpen,
}: {
  task: TodoTaskPlain;
  depth: number;
  onOpen: (id: string) => void;
}) {
  const { complete, reopen, revalidate } = useTaskActions(),
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
        className="detail-sub"
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
        <button
          type="button"
          className={`detail-sub-title${task.isCompleted ? " done" : ""}`}
          onClick={() => onOpen(task._id)}
        >
          {task.title}
        </button>
      </div>
      {[...(nested.open ?? []), ...(nested.done ?? [])].map((child) => (
        <SubtaskRow
          key={child._id}
          task={child}
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
  onOpenTask: (taskId: string) => void;
}

export function TaskDetailPanel({
  taskId,
  onClose,
  onEdit,
  onOpenTask,
}: Props) {
  const { aiEnabled } = useCapabilities(),
    { t, preferences } = usePreferences(),
    { complete, reopen, remove, removeFromLists, revalidate } =
      useTaskActions();
  const [isRefactoring, setIsRefactoring] = useState(false);
  const [showRefactorModal, setShowRefactorModal] = useState(false);
  const [generateSubtasks, setGenerateSubtasks] = useState(false);
  const [includeSubtasks, setIncludeSubtasks] = useState(false);
  const [errorStr, setErrorStr] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [descDraft, setDescDraft] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [pickingDate, setPickingDate] = useState(false);
  const [subDraft, setSubDraft] = useState("");
  const [addingSub, setAddingSub] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null),
    descRef = useRef<HTMLTextAreaElement>(null),
    dateRef = useRef<HTMLInputElement>(null),
    closeRef = useRef<HTMLButtonElement>(null);

  const {
    data: task,
    isLoading,
    mutate: mutateTask,
  } = useSWR<TodoTaskPlain>(`/api/admin/todo/tasks/${taskId}`, dataFetcher, {
    revalidateOnFocus: true,
    refreshInterval: 30_000,
  });
  const { data: parent } = useSWR<TodoTaskPlain>(
    task?.parentTaskId ? `/api/admin/todo/tasks/${task.parentTaskId}` : null,
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
  const dueDay = task?.dueDate ? task.dueDate.slice(0, 10) : "",
    overdue = !!task && !task.isCompleted && isOverdue(task.dueDate),
    pills = [
      { label: "Oggi", day: daysFromToday(0) },
      { label: "Domani", day: daysFromToday(1) },
      { label: "Prossima settimana", day: nextMonday() },
    ],
    customDay = dueDay && !pills.some((pill) => pill.day === dueDay);

  useEffect(() => {
    const origin = document.activeElement as HTMLElement | null;
    return () => {
      const active = document.activeElement;
      if (origin?.isConnected && (!active || active === document.body))
        origin.focus();
    };
  }, []);

  useEffect(() => {
    if (!task && !isLoading) closeRef.current?.focus();
  }, [task?._id, isLoading]);

  useEffect(() => {
    setTitleDraft(task?.title ?? "");
  }, [task?._id, task?.title]);

  useEffect(() => {
    setEditingDesc(false);
    setPickingDate(false);
    setSubDraft("");
  }, [taskId]);

  useLayoutEffect(() => grow(titleRef.current), [titleDraft, task?._id]);
  useLayoutEffect(() => grow(descRef.current), [descDraft, editingDesc]);

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

  async function save(
    fields: Partial<TodoTaskPlain>,
    request: () => Promise<Response>,
  ) {
    if (!task) return;
    const previous = task;
    await mutateTask({ ...task, ...fields }, { revalidate: false });
    try {
      const response = await request();
      if (!response.ok) throw new Error();
      await revalidate();
    } catch {
      await mutateTask(previous, { revalidate: false });
    }
  }

  const patch = (fields: Partial<TodoTaskPlain>) =>
    save(fields, () =>
      fetch(`/api/admin/todo/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      }),
    );

  const toggleFavorite = () =>
    task &&
    save({ isFavorite: !task.isFavorite }, () =>
      fetch(`/api/admin/todo/tasks/${taskId}/favorite`, { method: "PATCH" }),
    );

  async function commitTitle() {
    if (!task) return;
    const next = titleDraft.trim();
    if (next === task.title) {
      setTitleDraft(task.title);
      return;
    }
    if (!next) {
      setTitleDraft(task.title);
      window.dispatchEvent(
        new CustomEvent("ervisio:error", {
          detail: t("Il titolo è obbligatorio"),
        }),
      );
      return;
    }
    setTitleDraft(next);
    await patch({ title: next });
  }

  async function commitDescription() {
    if (!task) return;
    setEditingDesc(false);
    if (descDraft !== (task.description ?? ""))
      await patch({ description: descDraft });
  }

  function editDescription() {
    if (!task) return;
    setDescDraft(task.description ?? "");
    setEditingDesc(true);
  }

  async function setDue(day: string | null) {
    setPickingDate(false);
    await patch({ dueDate: day });
  }

  function togglePicker() {
    const next = !pickingDate;
    setPickingDate(next);
    if (next)
      requestAnimationFrame(() => {
        dateRef.current?.focus();
        dateRef.current?.showPicker?.();
      });
  }

  async function addSubtask() {
    const title = subDraft.trim();
    if (!task || !title || addingSub) return;
    setAddingSub(true);
    try {
      const response = await fetch("/api/admin/todo/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          listId: task.listId,
          parentTaskId: task._id,
        }),
      });
      if (response.ok) {
        setSubDraft("");
        await revalidate();
      }
    } catch {
      /* apiFetch already displays the connection error. */
    } finally {
      setAddingSub(false);
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

  const menuItems = task
    ? [
        {
          label: t("Tutti i dettagli"),
          icon: faPen,
          onSelect: () => onEdit(task),
        },
        ...(aiEnabled
          ? [
              {
                label: "Refactor AI",
                icon: faWandMagicSparkles,
                onSelect: promptRefactorAI,
                disabled: isRefactoring,
              },
            ]
          : []),
        {
          label: t("Elimina"),
          icon: faTrash,
          onSelect: deleteTask,
          danger: true,
        },
      ]
    : [];

  return (
    <>
      <aside aria-label={t("Dettaglio attività")} className="task-detail">
        <header className="detail-head">
          {task && (
            <OverflowMenu
              label={t("Altre azioni")}
              groups={[{ label: t("Altre azioni"), items: menuItems }]}
            />
          )}
          <button
            ref={closeRef}
            onClick={onClose}
            data-tip={t("Chiudi")}
            data-tip-side="bottom"
            aria-label={t("Chiudi")}
            className="icon-button"
          >
            <Icon icon={faXmark} />
          </button>
        </header>

        <div className="detail-body">
          {isLoading && <div className="task-loading" />}

          {!isLoading && !task && (
            <p className="detail-hint">{t("Attività non trovata.")}</p>
          )}

          {task && (
            <>
              {task.parentTaskId && parent && (
                <button
                  type="button"
                  className="detail-parent"
                  onClick={() => onOpenTask(parent._id)}
                >
                  {parent.title}
                </button>
              )}

              <div className="detail-title">
                <button
                  type="button"
                  role="checkbox"
                  className="check-task"
                  aria-checked={task.isCompleted}
                  aria-label={t(task.isCompleted ? "Riapri" : "Completa")}
                  data-tip={t(task.isCompleted ? "Riapri" : "Completa")}
                  disabled={toggling}
                  onClick={toggleCompleted}
                >
                  <span>{task.isCompleted && <Icon icon={faCheck} />}</span>
                </button>
                <textarea
                  ref={titleRef}
                  rows={1}
                  value={titleDraft}
                  maxLength={500}
                  aria-label={t("Titolo")}
                  className={task.isCompleted ? "done" : undefined}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={commitTitle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.currentTarget.blur();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      setTitleDraft(task.title);
                      e.currentTarget.blur();
                    }
                  }}
                />
                <button
                  type="button"
                  className={`icon-button favorite${task.isFavorite ? " on" : ""}`}
                  aria-pressed={task.isFavorite}
                  aria-label={t("Preferita")}
                  data-tip={t(
                    task.isFavorite
                      ? "Rimuovi dai preferiti"
                      : "Aggiungi ai preferiti",
                  )}
                  onClick={toggleFavorite}
                >
                  <Icon icon={task.isFavorite ? faStar : faStarOutline} />
                </button>
              </div>

              <div
                className="detail-due"
                role="group"
                aria-label={t("Scadenza")}
              >
                <span className="detail-label">{t("Scadenza")}</span>
                {pills.map((pill) => (
                  <button
                    key={pill.label}
                    type="button"
                    className="detail-pill"
                    aria-pressed={dueDay === pill.day}
                    onClick={() =>
                      setDue(dueDay === pill.day ? null : pill.day)
                    }
                  >
                    {t(pill.label)}
                  </button>
                ))}
                {customDay && (
                  <span
                    className={`detail-pill custom${overdue ? " overdue" : ""}`}
                    aria-current="date"
                  >
                    {formatDate(task.dueDate, shortDate, preferences.locale)}
                  </span>
                )}
                <button
                  type="button"
                  className="icon-button"
                  aria-expanded={pickingDate}
                  aria-label={t("Scegli una data")}
                  data-tip={t("Scegli una data")}
                  onClick={togglePicker}
                >
                  <Icon icon={faCalendar} />
                </button>
                {dueDay && (
                  <button
                    type="button"
                    className="icon-button detail-clear"
                    aria-label={t("Rimuovi scadenza")}
                    data-tip={t("Rimuovi scadenza")}
                    onClick={() => setDue(null)}
                  >
                    <Icon icon={faXmark} />
                  </button>
                )}
                {pickingDate && (
                  <input
                    ref={dateRef}
                    type="date"
                    className="detail-date"
                    aria-label={t("Scegli una data")}
                    value={dueDay}
                    onChange={(e) => e.target.value && setDue(e.target.value)}
                  />
                )}
              </div>

              {editingDesc ? (
                <textarea
                  ref={descRef}
                  autoFocus
                  className="detail-note"
                  rows={3}
                  value={descDraft}
                  placeholder={t("Aggiungi una nota")}
                  aria-label={t("Descrizione")}
                  onChange={(e) => setDescDraft(e.target.value)}
                  onBlur={commitDescription}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setDescDraft(task.description ?? "");
                      setEditingDesc(false);
                    }
                  }}
                />
              ) : (
                <div
                  className={`detail-note view${task.description ? "" : " empty"}`}
                  tabIndex={0}
                  role="button"
                  aria-label={t("Descrizione")}
                  onClick={(e) => {
                    if (!(e.target as Element).closest("a")) editDescription();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.target === e.currentTarget)
                      editDescription();
                  }}
                >
                  {task.description ? (
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                        {task.description}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    t("Aggiungi una nota")
                  )}
                </div>
              )}

              <div
                className="detail-subs"
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
                <label className="detail-sub add">
                  <Icon icon={faPlus} />
                  <input
                    value={subDraft}
                    disabled={task.isCompleted}
                    placeholder={t("Aggiungi sottoattività")}
                    aria-label={t("Aggiungi sottoattività")}
                    onChange={(e) => setSubDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSubtask();
                      } else if (e.key === "Escape" && subDraft) {
                        e.preventDefault();
                        setSubDraft("");
                      }
                    }}
                  />
                </label>
              </div>

              {(!!task.assignedToUsers?.length ||
                task.tags.length > 0 ||
                task.attachments.length > 0) && (
                <dl className="detail-facts">
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
                  {task.attachments.length > 0 && (
                    <div>
                      <dt>{t("Allegati")}</dt>
                      <dd className="detail-files">
                        {task.attachments.map((att) => (
                          <a
                            key={att.url}
                            href={att.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Icon icon={faPaperclip} />
                            <span>{att.name}</span>
                          </a>
                        ))}
                      </dd>
                    </div>
                  )}
                </dl>
              )}

              {preferences.showExtras && (
                <dl className="detail-facts quiet">
                  <div>
                    <dt>{t("Creata")}</dt>
                    <dd>
                      {formatDate(
                        task.createdAt,
                        shortDate,
                        preferences.locale,
                      )}
                      {task.createdByUser &&
                        ` · ${displayUser(task.createdByUser)}`}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("Aggiornata")}</dt>
                    <dd>
                      {formatDate(
                        task.updatedAt,
                        shortDate,
                        preferences.locale,
                      )}
                    </dd>
                  </div>
                  {task.isCompleted && task.completedAt && (
                    <div>
                      <dt>{t("Completata")}</dt>
                      <dd>
                        {formatDate(
                          task.completedAt,
                          fullDate,
                          preferences.locale,
                        )}
                        {task.completedByUser &&
                          ` · ${displayUser(task.completedByUser)}`}
                      </dd>
                    </div>
                  )}
                </dl>
              )}
            </>
          )}
        </div>
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
              {isRefactoring ? "…" : "Conferma"}
            </button>
          </div>
        </div>
      </AdminModal>
    </>
  );
}
