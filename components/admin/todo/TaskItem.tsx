"use client";

import { useCapabilities } from "@/hooks/useCapabilities";
import { apiFetch as fetch } from "@/lib/client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { AdminModal } from "@/components/admin/AdminModal";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Icon } from "@/components/ui/Icon";
import { useSounds } from "@/hooks/useSounds";
import {
  faChevronRight,
  faChevronDown,
  faStar,
  faTrash,
  faPen,
  faPlus,
  faClock,
  faExclamationTriangle,
  faPaperclip,
  faGripVertical,
  faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons";
import { faStar as faStarOutline } from "@fortawesome/free-regular-svg-icons";
import type { TodoTaskPlain, TodoTagPlain } from "@/types/todo";

const fetcher = (url: string) =>
  fetch(url)
    .then((r) => r.json())
    .then((r) => r.data ?? []);

function formatDue(
  iso: string | null,
): { label: string; overdue: boolean } | null {
  if (!iso) return null;
  const d = new Date(iso);
  const overdue = d < new Date();
  return {
    label: d.toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    overdue,
  };
}

function displayUser(
  u:
    | { username?: string; name?: string; email?: string; _id?: string }
    | undefined
    | null,
): string {
  if (!u) return "—";
  return u.username ?? u.name ?? u.email ?? u._id ?? "—";
}

interface Props {
  task: TodoTaskPlain;
  depth?: number;
  onEdit: (task: TodoTaskPlain) => void;
  onDeleted: () => void;
  onAddChild: (parentId: string) => void;
  onTaskClick: (taskId: string) => void;
  /** Map of tag _id → tag info, for rendering tag badges */
  tagMap?: Record<string, TodoTagPlain>;
}

export function TaskItem({
  task,
  depth = 0,
  onEdit,
  onDeleted,
  onAddChild,
  onTaskClick,
  tagMap,
}: Props) {
  const { aiEnabled } = useCapabilities();
  const [expanded, setExpanded] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [togglingFav, setTogglingFav] = useState(false);
  const [isRefactoring, setIsRefactoring] = useState(false);
  const [isRefactorModalOpen, setIsRefactorModalOpen] = useState(false);
  const [generateSubtasks, setGenerateSubtasks] = useState(false);
  const [localChildren, setLocalChildren] = useState<TodoTaskPlain[] | null>(
    null,
  );

  const { mutate: globalMutate } = useSWRConfig();
  const { playCompleted } = useSounds();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task._id });

  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: isDragging ? ("relative" as const) : undefined,
    zIndex: isDragging ? 50 : undefined,
  };

  /** Optimistically remove a task from any matching SWR caches without full refetch */
  function optimisticRemove(taskId: string) {
    globalMutate(
      (key: unknown) =>
        typeof key === "string" && key.startsWith("/api/admin/todo/tasks"),
      (current: TodoTaskPlain[] | undefined) => {
        if (!Array.isArray(current)) return current;
        return current.filter((t) => t._id !== taskId);
      },
      { revalidate: false },
    );
  }

  /** Background-revalidate all task queries (silent, no UI flicker) */
  function silentRevalidate() {
    globalMutate(
      (key: unknown) =>
        typeof key === "string" && key.startsWith("/api/admin/todo/tasks"),
      undefined,
      { revalidate: true },
    );
  }

  const childrenKey = expanded
    ? `/api/admin/todo/tasks?listId=${task.listId}&parentTaskId=${task._id}`
    : null;

  const { data: swrChildren, mutate: mutateChildren } = useSWR<TodoTaskPlain[]>(
    childrenKey,
    fetcher,
    { revalidateOnFocus: true, refreshInterval: 30_000 },
  );

  const children = localChildren ?? swrChildren ?? null;
  const due = formatDue(task.dueDate);
  const hasChildren = (task.childCount ?? 0) > 0 || expanded;

  async function handleComplete(e: React.MouseEvent) {
    e.stopPropagation();
    setCompleting(true);
    try {
      const response = await fetch(
        `/api/admin/todo/tasks/${task._id}/complete`,
        { method: "PATCH" },
      );
      if (!response.ok) return;
      playCompleted();
      optimisticRemove(task._id);
      silentRevalidate();
    } catch {
      /* apiFetch already displays the connection error. */
    } finally {
      setCompleting(false);
    }
  }

  async function handleToggleFav(e: React.MouseEvent) {
    e.stopPropagation();
    setTogglingFav(true);
    try {
      await fetch(`/api/admin/todo/tasks/${task._id}/favorite`, {
        method: "PATCH",
      });
      // Silent revalidate to update fav status across lists
      silentRevalidate();
    } catch {
      /* apiFetch already displays the connection error. */
    } finally {
      setTogglingFav(false);
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Eliminare il task "${task.title}" e tutte le sue sottotask?`))
      return;
    try {
      const response = await fetch(`/api/admin/todo/tasks/${task._id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        optimisticRemove(task._id);
        silentRevalidate();
      }
    } catch {
      /* apiFetch already displays the connection error. */
    }
  }

  async function handleRefactorAI(e: React.MouseEvent) {
    e.stopPropagation();
    setIsRefactorModalOpen(true);
  }

  async function performRefactorAI() {
    setIsRefactoring(true);
    setIsRefactorModalOpen(false);
    try {
      const res = await fetch(`/api/admin/todo/tasks/${task._id}/ai-refactor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "both", generateSubtasks }),
      });
      if (!res.ok) throw new Error("Refactor failed");
      silentRevalidate();
    } catch (err: any) {
      alert("Errore durante il refactor AI: " + err.message);
    } finally {
      setIsRefactoring(false);
    }
  }

  async function handleChildDragEnd(event: DragEndEvent) {
    if (!children) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = children.findIndex((t) => t._id === String(active.id));
    const newIndex = children.findIndex((t) => t._id === String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(children, oldIndex, newIndex);
    setLocalChildren(reordered);
    try {
      await fetch("/api/admin/todo/tasks/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: reordered.map((t) => t._id) }),
      });
    } finally {
      setLocalChildren(null);
      mutateChildren();
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={dragStyle}
      className={depth > 0 ? "ml-5 border-l border-white/[0.04] pl-3" : ""}
    >
      <div
        data-task-row={task._id}
        className="group flex cursor-pointer items-start gap-2 max-sm:flex-wrap rounded-lg px-2 py-2 transition hover:bg-white/5"
        onClick={() => onTaskClick(task._id)}
      >
        {/* Drag handle */}
        <button
          type="button"
          className="mt-0.5 flex h-5 w-5 shrink-0 cursor-grab items-center justify-center rounded text-ink-faint transition hover:text-ink-dim active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
          title="Trascina per riordinare"
          {...attributes}
          {...listeners}
        >
          <Icon icon={faGripVertical} className="text-xs" />
        </button>

        {/* Expand/Collapse */}
        <button
          type="button"
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-faint transition hover:text-ink-dim ${!hasChildren ? "opacity-0 pointer-events-none" : ""}`}
          aria-label={
            expanded ? "Nascondi sottoattività" : "Mostra sottoattività"
          }
          disabled={!hasChildren}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
        >
          <Icon
            icon={expanded ? faChevronDown : faChevronRight}
            className="text-xs"
          />
        </button>

        {/* Complete checkbox */}
        <button
          type="button"
          onClick={handleComplete}
          disabled={completing}
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/20 transition hover:border-emerald-400 hover:bg-emerald-400/10 disabled:opacity-40"
          title="Segna come completato"
        >
          {completing && (
            <span className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />
          )}
        </button>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white leading-snug">
              {task.title}
            </span>
            {due && (
              <span
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${due.overdue ? "bg-rose-500/[0.06] text-rose-400" : "bg-white/10 text-ink-dim"}`}
              >
                <Icon
                  icon={due.overdue ? faExclamationTriangle : faClock}
                  className="text-[10px]"
                />
                {due.label}
              </span>
            )}
            {task.attachments.length > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-xs text-ink-faint">
                <Icon icon={faPaperclip} className="text-[10px]" />
                {task.attachments.length}
              </span>
            )}
            {(task.childCount ?? 0) > 0 && (
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-ink-faint">
                {task.childCount} sottotask
              </span>
            )}
            {tagMap &&
              task.tags?.map((tagId) => {
                const tag = tagMap[tagId];
                if (!tag) return null;
                return (
                  <span
                    key={tagId}
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
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
          {task.assignedToUsers && task.assignedToUsers.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
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
        </div>

        {/* Actions */}
        <div className="max-sm:ml-auto flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100">
          <button
            type="button"
            onClick={handleToggleFav}
            disabled={togglingFav}
            className={`rounded p-1 text-xs transition ${task.isFavorite ? "text-yellow-400" : "text-ink-faint hover:text-yellow-400"}`}
            title={
              task.isFavorite
                ? "Rimuovi dai preferiti"
                : "Aggiungi ai preferiti"
            }
          >
            <Icon icon={task.isFavorite ? faStar : faStarOutline} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(true);
              onAddChild(task._id);
            }}
            className="rounded p-1 text-xs text-ink-faint transition hover:text-white"
            title="Aggiungi sottotask"
          >
            <Icon icon={faPlus} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(task);
            }}
            className="rounded p-1 text-xs text-ink-faint transition hover:text-white"
            title="Modifica"
          >
            <Icon icon={faPen} />
          </button>
          <button
            type="button"
            hidden={!aiEnabled}
            onClick={handleRefactorAI}
            disabled={isRefactoring}
            className={`rounded p-1 text-xs transition ${isRefactoring ? "text-blue-400 opacity-50" : "text-ink-faint hover:text-blue-400"}`}
            title="Refactor AI"
          >
            {isRefactoring ? (
              <Icon icon={faWandMagicSparkles} className="animate-pulse" />
            ) : (
              <Icon icon={faWandMagicSparkles} />
            )}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="rounded p-1 text-xs text-ink-faint transition hover:text-rose-400"
            title="Elimina"
          >
            <Icon icon={faTrash} />
          </button>
        </div>
      </div>
      {/* Recursive children with their own DnD context */}
      {expanded && (
        <div className="mt-1">
          {!children ? (
            <div className="ml-10 text-xs text-ink-faint py-1">
              Caricamento…
            </div>
          ) : children.length === 0 ? (
            <div className="ml-10 text-xs text-ink-faint py-1">
              Nessuna sottotask
            </div>
          ) : (
            <DndContext
              collisionDetection={closestCenter}
              onDragEnd={handleChildDragEnd}
            >
              <SortableContext
                items={children.map((c) => c._id)}
                strategy={verticalListSortingStrategy}
              >
                {children.map((child) => (
                  <TaskItem
                    key={child._id}
                    task={child}
                    depth={depth + 1}
                    onEdit={onEdit}
                    onDeleted={onDeleted}
                    onAddChild={onAddChild}
                    onTaskClick={onTaskClick}
                    tagMap={tagMap}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}
      {isRefactorModalOpen && (
        <AdminModal
          open={isRefactorModalOpen}
          title="Refactor AI"
          onClose={() => setIsRefactorModalOpen(false)}
          size="md"
        >
          <div className="space-y-4 text-sm text-white/80">
            <p>
              Vuoi eseguire un refactor AI di titolo e descrizione per il task
              &quot;<strong className="text-white">{task.title}</strong>&quot;?
            </p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={generateSubtasks}
                onChange={(e) => setGenerateSubtasks(e.target.checked)}
                className="rounded border-white/20 bg-background/50 accent-blue-500"
              />
              <span>Crea subtask se necessario</span>
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRefactorModalOpen(false)}
                className="rounded-lg border border-white/[0.04] px-4 py-2 text-white hover:bg-white/5 transition"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={performRefactorAI}
                className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500 transition"
              >
                Conferma Refactor
              </button>
            </div>
          </div>
        </AdminModal>
      )}{" "}
    </div>
  );
}
