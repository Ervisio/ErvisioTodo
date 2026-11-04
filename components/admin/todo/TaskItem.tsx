"use client";

import { useCapabilities } from "@/hooks/useCapabilities";
import { apiFetch as fetch } from "@/lib/client";
import { usePreferences } from "@/components/Preferences";

import { useState } from "react";
import { AdminModal } from "@/components/admin/AdminModal";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Icon } from "@/components/ui/Icon";
import {
  faCheck,
  faChevronRight,
  faStar,
  faTrash,
  faPen,
  faPlus,
  faClock,
  faExclamationTriangle,
  faPaperclip,
  faGripVertical,
  faListUl,
  faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons";
import { faStar as faStarOutline } from "@fortawesome/free-regular-svg-icons";
import type { TodoTaskPlain, TodoTagPlain } from "@/types/todo";
import { useSubtasks, useTaskActions } from "./taskActions";

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
  /** The row whose detail panel is open. */
  selected?: boolean;
  onEdit: (task: TodoTaskPlain) => void;
  onAddChild: (parentId: string) => void;
  onTaskClick: (taskId: string) => void;
  /** Map of tag _id → tag info, for rendering tag badges */
  tagMap?: Record<string, TodoTagPlain>;
}

export function TaskItem({
  task,
  selected = false,
  onEdit,
  onAddChild,
  onTaskClick,
  tagMap,
}: Props) {
  const { aiEnabled } = useCapabilities(),
    { t } = usePreferences();
  const [completing, setCompleting] = useState(false);
  const [togglingFav, setTogglingFav] = useState(false);
  const [isRefactoring, setIsRefactoring] = useState(false);
  const [isRefactorModalOpen, setIsRefactorModalOpen] = useState(false);
  const [generateSubtasks, setGenerateSubtasks] = useState(false);

  const { complete, remove, removeFromLists, revalidate } = useTaskActions();

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

  const hasChildren = (task.childCount ?? 0) > 0,
    subtasks = useSubtasks(task.listId, task._id, hasChildren),
    subtaskTotal = Math.max(subtasks.total, task.childCount ?? 0),
    due = formatDue(task.dueDate);

  async function handleComplete(e: React.MouseEvent) {
    e.stopPropagation();
    setCompleting(true);
    try {
      if (await complete(task._id)) {
        removeFromLists(task._id);
        revalidate();
      }
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
      revalidate();
    } catch {
      /* apiFetch already displays the connection error. */
    } finally {
      setTogglingFav(false);
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await remove(task);
    } catch {
      /* apiFetch already displays the connection error. */
    }
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
      revalidate();
    } catch (err: any) {
      alert("Errore durante il refactor AI: " + err.message);
    } finally {
      setIsRefactoring(false);
    }
  }

  return (
    <div ref={setNodeRef} style={dragStyle}>
      <div
        data-task-row={task._id}
        className={`task-row${selected ? " selected" : ""}`}
        onClick={() => onTaskClick(task._id)}
      >
        <button
          type="button"
          className="drag-handle"
          onClick={(e) => e.stopPropagation()}
          title="Trascina per riordinare"
          {...attributes}
          {...listeners}
        >
          <Icon icon={faGripVertical} />
        </button>

        <button
          type="button"
          className="check-task"
          onClick={handleComplete}
          disabled={completing}
          aria-pressed={completing}
          title="Segna come completato"
        >
          <span>{completing && <Icon icon={faCheck} />}</span>
        </button>

        <div className="task-copy">
          <button
            type="button"
            className="task-title"
            onClick={(e) => {
              e.stopPropagation();
              onTaskClick(task._id);
            }}
          >
            {task.title}
          </button>
          {!!(
            hasChildren ||
            due ||
            task.attachments.length ||
            task.tags.length ||
            task.assignedToUsers?.length
          ) && (
            <div className="task-subtitle">
              {hasChildren && (
                <button
                  type="button"
                  className="sub-summary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTaskClick(task._id);
                  }}
                >
                  <Icon icon={faListUl} />
                  <span>
                    {subtaskTotal} {t("sottoattività")}
                  </span>
                  <span className="progress-count">
                    {subtasks.done?.length ?? 0}/{subtaskTotal}
                  </span>
                  <span className="summary-chevron">
                    <Icon icon={faChevronRight} />
                  </span>
                </button>
              )}
              {due && (
                <span className={`task-chip${due.overdue ? " overdue" : ""}`}>
                  <Icon icon={due.overdue ? faExclamationTriangle : faClock} />
                  {due.label}
                </span>
              )}
              {task.attachments.length > 0 && (
                <span className="task-chip">
                  <Icon icon={faPaperclip} />
                  {task.attachments.length}
                </span>
              )}
              {tagMap &&
                task.tags?.map((tagId) => {
                  const tag = tagMap[tagId];
                  if (!tag) return null;
                  return (
                    <span key={tagId} className="tag">
                      <i style={{ background: tag.color }} />
                      {tag.name}
                    </span>
                  );
                })}
              {task.assignedToUsers?.map((u) => (
                <span key={u._id} className="tag">
                  {displayUser(u)}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="row-end">
          <div className="row-actions">
            <button
              type="button"
              className="row-button"
              onClick={(e) => {
                e.stopPropagation();
                onAddChild(task._id);
              }}
              title="Aggiungi sottotask"
            >
              <Icon icon={faPlus} />
            </button>
            <button
              type="button"
              className="row-button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(task);
              }}
              title="Modifica"
            >
              <Icon icon={faPen} />
            </button>
            <button
              type="button"
              className="row-button"
              hidden={!aiEnabled}
              onClick={(e) => {
                e.stopPropagation();
                setIsRefactorModalOpen(true);
              }}
              disabled={isRefactoring}
              title="Refactor AI"
            >
              <Icon
                icon={faWandMagicSparkles}
                className={isRefactoring ? "animate-pulse" : undefined}
              />
            </button>
            <button
              type="button"
              className="row-button danger-icon"
              onClick={handleDelete}
              title="Elimina"
            >
              <Icon icon={faTrash} />
            </button>
          </div>
          <button
            type="button"
            className="row-button favorite"
            onClick={handleToggleFav}
            disabled={togglingFav}
            aria-pressed={task.isFavorite}
            title={
              task.isFavorite
                ? "Rimuovi dai preferiti"
                : "Aggiungi ai preferiti"
            }
          >
            <Icon icon={task.isFavorite ? faStar : faStarOutline} />
          </button>
        </div>
      </div>
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
      )}
    </div>
  );
}
