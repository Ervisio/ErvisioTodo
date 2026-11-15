"use client";

import { apiFetch as fetch } from "@/lib/client";
import { usePreferences } from "@/components/Preferences";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Icon } from "@/components/ui/Icon";
import {
  faCheck,
  faStar,
  faPaperclip,
  faGripVertical,
} from "@fortawesome/free-solid-svg-icons";
import { faStar as faStarOutline } from "@fortawesome/free-regular-svg-icons";
import type { TodoTaskPlain, TodoTagPlain } from "@/types/todo";
import { showToast } from "@/components/Toasts";
import { useTaskActions } from "./taskActions";

/** Short relative label: Oggi, Ieri, Domani, a weekday within 6 days, otherwise the short date. */
function formatDue(
  iso: string | null,
  locale: string,
  t: (text: string) => string,
): { label: string; overdue: boolean; today: boolean } | null {
  if (!iso) return null;
  const d = new Date(iso),
    start = new Date();
  start.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - start.getTime()) / 864e5),
    weekday = d.toLocaleDateString(locale, { weekday: "long" });
  return {
    label:
      diff === 0
        ? t("Oggi")
        : diff === -1
          ? t("Ieri")
          : diff === 1
            ? t("Domani")
            : diff > 1 && diff <= 6
              ? weekday.charAt(0).toUpperCase() + weekday.slice(1)
              : d.toLocaleDateString(locale, {
                  day: "numeric",
                  month: "short",
                }),
    overdue: diff < 0,
    today: diff === 0,
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
  onTaskClick: (taskId: string) => void;
  /** Map of tag _id → tag info, for rendering tag badges */
  tagMap?: Record<string, TodoTagPlain>;
  /** Shown as an extra when tasks from several lists are mixed (smart views). */
  listTitle?: string;
}

export function TaskItem({
  task,
  selected = false,
  onTaskClick,
  tagMap,
  listTitle,
}: Props) {
  const { t, preferences } = usePreferences(),
    showExtras = preferences.showExtras;
  const [completing, setCompleting] = useState(false);
  const [togglingFav, setTogglingFav] = useState(false);

  const { complete, reopen, removeFromLists, revalidate } = useTaskActions();

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
    due = formatDue(task.dueDate, preferences.locale, t);

  async function handleComplete(e: React.MouseEvent) {
    e.stopPropagation();
    setCompleting(true);
    try {
      if (await complete(task._id)) {
        removeFromLists(task._id);
        revalidate();
        showToast(t("Completata"), {
          label: t("Annulla"),
          run: async () => {
            if (await reopen(task._id)) revalidate();
          },
        });
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
          <div className="task-line">
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
            {due && (
              <span
                className={`row-chip${due.today ? " today" : ""}${due.overdue ? " late" : ""}`}
              >
                {due.label}
              </span>
            )}
            {hasChildren && (
              <button
                type="button"
                className="row-chip sub-summary"
                aria-label={`${subtaskDone}/${subtaskTotal} ${t("sottoattività")}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onTaskClick(task._id);
                }}
              >
                {subtaskDone}/{subtaskTotal}
              </button>
            )}
          </div>
          {showExtras &&
            !!(
              listTitle ||
              task.attachments.length ||
              task.tags.length ||
              task.assignedToUsers?.length
            ) && (
              <div className="task-subtitle">
                {listTitle && <span className="task-chip">{listTitle}</span>}
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
    </div>
  );
}
