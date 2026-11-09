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
  faStar,
  faTrash,
  faPen,
  faPlus,
  faCalendarDay,
  faListCheck,
  faPaperclip,
  faGripVertical,
  faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons";
import { faStar as faStarOutline } from "@fortawesome/free-regular-svg-icons";
import type { TodoTaskPlain, TodoTagPlain } from "@/types/todo";
import { useTaskActions } from "./taskActions";

function formatDue(
  iso: string | null,
  locale: string,
): { label: string; overdue: boolean; today: boolean } | null {
  if (!iso) return null;
  const d = new Date(iso),
    start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return {
    label: d.toLocaleDateString(locale, { day: "numeric", month: "short" }),
    overdue: d < start,
    today: d >= start && d < end,
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
  /** Position in the list, used to stagger the entrance animation. */
  index?: number;
  /** Shown as an extra when tasks from several lists are mixed (smart views). */
  listTitle?: string;
}

export function TaskItem({
  task,
  selected = false,
  onEdit,
  onAddChild,
  onTaskClick,
  tagMap,
  index = 0,
  listTitle,
}: Props) {
  const { aiEnabled } = useCapabilities(),
    { t, preferences } = usePreferences(),
    showExtras = preferences.showExtras;
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

  const subtaskTotal = task.subtaskCount ?? 0,
    subtaskDone = task.subtaskDoneCount ?? 0,
    hasChildren = subtaskTotal > 0,
    due = formatDue(task.dueDate, preferences.locale);

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
    <div
      ref={setNodeRef}
      style={{ ...dragStyle, "--n": index } as React.CSSProperties}
      className="task-enter"
    >
      <div
        data-task-row={task._id}
        className={`task-row${selected ? " selected" : ""}`}
        onClick={() => onTaskClick(task._id)}
      >
        <button
          type="button"
          className="drag-handle"
          onClick={(e) => e.stopPropagation()}
          aria-label={t("Trascina per riordinare")}
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
          role="checkbox"
          aria-checked={completing}
          aria-label={task.title}
          data-tip={t("Segna come completato")}
          data-tip-side="right"
        >
          <span>
            <Icon icon={faCheck} />
          </span>
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
          {showExtras &&
            !!(
              listTitle ||
              due ||
              task.attachments.length ||
              task.tags.length ||
              task.assignedToUsers?.length
            ) && (
              <div className="task-subtitle">
                {listTitle && <span className="task-chip">{listTitle}</span>}
                {due && (
                  <span className={`task-chip${due.overdue ? " overdue" : ""}`}>
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
              aria-label={t("Aggiungi sottoattività")}
              data-tip={t("Aggiungi sottoattività")}
              data-tip-side="left"
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
              aria-label={t("Modifica")}
              data-tip={t("Modifica")}
              data-tip-side="left"
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
              aria-label="Refactor AI"
              data-tip="Refactor AI"
              data-tip-side="left"
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
              aria-label={t("Elimina")}
              data-tip={t("Elimina")}
              data-tip-side="left"
            >
              <Icon icon={faTrash} />
            </button>
          </div>
          {due && (due.today || due.overdue) && (
            <span
              className="row-indicator late"
              data-tip={t(due.overdue ? "Scaduta" : "Scade oggi")}
              data-tip-side="left"
            >
              <Icon icon={faCalendarDay} />
            </span>
          )}
          {hasChildren && (
            <button
              type="button"
              className={`sub-summary row-indicator${subtaskDone === subtaskTotal ? " done" : ""}`}
              aria-label={`${subtaskDone}/${subtaskTotal} ${t("sottoattività")}`}
              data-tip={`${subtaskDone} ${t("di")} ${subtaskTotal} ${t("sottoattività")}`}
              data-tip-side="left"
              onClick={(e) => {
                e.stopPropagation();
                onTaskClick(task._id);
              }}
            >
              <Icon icon={faListCheck} />
            </button>
          )}
          <button
            type="button"
            className="row-button favorite"
            onClick={handleToggleFav}
            disabled={togglingFav}
            aria-pressed={task.isFavorite}
            aria-label={t("Preferita")}
            data-tip={t(
              task.isFavorite
                ? "Rimuovi dagli importanti"
                : "Segna come importante",
            )}
            data-tip-side="left"
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
          <div className="space-y-4 text-sm">
            <p>
              Vuoi eseguire un refactor AI di titolo e descrizione per il task
              &quot;<strong>{task.title}</strong>&quot;?
            </p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={generateSubtasks}
                onChange={(e) => setGenerateSubtasks(e.target.checked)}
                className="switch"
              />
              <span>Crea subtask se necessario</span>
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRefactorModalOpen(false)}
                className="button secondary"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={performRefactorAI}
                className="button"
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
