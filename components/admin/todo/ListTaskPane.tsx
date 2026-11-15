"use client";
import { useState } from "react";
import useSWR from "swr";
import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { Icon } from "@/components/ui/Icon";
import { TaskItem } from "./TaskItem";
import { CompletedTasksTab, useCompletedTasks } from "./CompletedTasksTab";
import { TaskComposer } from "./TaskComposer";
import { apiFetch, dataFetcher } from "@/lib/client";
import { usePreferences } from "@/components/Preferences";
import type { TodoListPlain, TodoTaskPlain, TodoTagPlain } from "@/types/todo";
export function ListTaskPane({
  list,
  tab,
  query,
  tags = [],
  onNew,
  onSelect,
  onToggleCompleted,
  selectedId,
  showAdd = true,
}: {
  list: TodoListPlain;
  tab: "active" | "favorites" | "completed";
  query: string;
  tags?: string[];
  onNew: (listId: string, parentId?: string | null) => void;
  onSelect: (id: string) => void;
  /** Expands or collapses the completed rows ("completed" tab = expanded). */
  onToggleCompleted: () => void;
  selectedId: string | null;
  /** The list view has its composer and completed section; cards keep the inline add row. */
  showAdd?: boolean;
}) {
  const { t, preferences } = usePreferences(),
    [ordered, setOrdered] = useState<TodoTaskPlain[] | null>(null),
    sensors = useSensors(
      useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
      useSensor(KeyboardSensor, {
        coordinateGetter: sortableKeyboardCoordinates,
      }),
    );
  const filtering = tab === "favorites" || !!query || tags.length > 0,
    key = `/api/admin/todo/tasks?listId=${list._id}${tab === "favorites" ? "&favorites=true" : "&parentTaskId=null"}${tags.length ? "&tags=" + tags.join(",") : ""}${query ? "&q=" + encodeURIComponent(query) : ""}`;
  const {
      data: tasks,
      isLoading,
      mutate,
    } = useSWR<TodoTaskPlain[]>(key, dataFetcher, { refreshInterval: 30000 }),
    { data: completed } = useCompletedTasks(
      list._id,
      tab === "completed" && !showAdd && !filtering,
    ),
    { data: availableTags } = useSWR<TodoTagPlain[]>(
      `/api/admin/todo/tags?listId=${list._id}`,
      dataFetcher,
    );
  const map = Object.fromEntries(
    (availableTags || []).map((tag) => [tag._id, tag]),
  );
  async function reorder(event: DragEndEvent) {
    if (!tasks || !event.over || event.active.id === event.over.id) return;
    const oldIndex = tasks.findIndex((t) => t._id === event.active.id),
      newIndex = tasks.findIndex((t) => t._id === event.over!.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(tasks, oldIndex, newIndex);
    setOrdered(next);
    try {
      await apiFetch("/api/admin/todo/tasks/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: next.map((t) => t._id) }),
      });
    } catch {
    } finally {
      setOrdered(null);
      mutate();
    }
  }
  const doneCount = filtering || showAdd ? 0 : (list.doneTaskCount ?? 0);
  return (
    <section
      className="task-area"
      aria-label={`${list.title}: ${t("Attività")}`}
    >
      {isLoading ? (
        <div className="task-loading" aria-label={t("Caricamento…")} />
      ) : tasks?.length ? (
        <>
          {preferences.showExtras && (
            <p className="task-section-label">
              {t(tab === "favorites" ? "Preferite" : "Da completare")}
              <span>{tasks.length}</span>
            </p>
          )}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={reorder}
          >
            <SortableContext
              items={(ordered || tasks).map((t) => t._id)}
              strategy={verticalListSortingStrategy}
            >
              {(ordered || tasks).map((task) => (
                <TaskItem
                  key={task._id}
                  task={task}
                  selected={task._id === selectedId}
                  onTaskClick={onSelect}
                  tagMap={map}
                />
              ))}
            </SortableContext>
          </DndContext>
        </>
      ) : filtering || showAdd ? (
        <div className="empty-tasks">
          <p>
            {t(
              filtering
                ? "Nessuna attività corrisponde ai filtri"
                : "Aggiungi la prima attività",
            )}
          </p>
        </div>
      ) : null}
      {!showAdd && (
        <TaskComposer listId={list._id} onDetails={() => onNew(list._id)} />
      )}
      {doneCount > 0 && (
        <button
          type="button"
          className="completed-toggle"
          aria-expanded={tab === "completed"}
          onClick={onToggleCompleted}
        >
          {doneCount} {t(doneCount === 1 ? "completata" : "completate")}
        </button>
      )}
      {tab === "completed" && doneCount > 0 && completed && (
        <CompletedTasksTab
          tasks={completed}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      )}
      {showAdd && (
        <button className="add-task-row" onClick={() => onNew(list._id)}>
          <Icon icon={faPlus} />
          {t("Aggiungi attività")}
        </button>
      )}
    </section>
  );
}
