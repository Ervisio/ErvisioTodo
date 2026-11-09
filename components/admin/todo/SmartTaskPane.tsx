"use client";
import useSWR from "swr";
import { DndContext } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import { faListCheck } from "@fortawesome/free-solid-svg-icons";
import { Icon } from "@/components/ui/Icon";
import { dataFetcher } from "@/lib/client";
import { usePreferences } from "@/components/Preferences";
import { TaskItem } from "./TaskItem";
import type { TodoListPlain, TodoTaskPlain } from "@/types/todo";

/** "Oggi" and "Importanti": open tasks from every visible list, newest list order first. */
export function SmartTaskPane({
  view,
  range,
  lists,
  onNew,
  onEdit,
  onSelect,
  selectedId,
}: {
  view: "today" | "important";
  range: string;
  lists: TodoListPlain[];
  onNew: (listId: string, parentId?: string | null) => void;
  onEdit: (task: TodoTaskPlain) => void;
  onSelect: (id: string) => void;
  selectedId: string | null;
}) {
  const { t } = usePreferences(),
    { data: tasks, isLoading } = useSWR<TodoTaskPlain[]>(
      `/api/admin/todo/tasks?smart=${view}${view === "today" ? `&${range}` : ""}`,
      dataFetcher,
      { refreshInterval: 30000 },
    ),
    titles = Object.fromEntries(lists.map((list) => [list._id, list.title]));
  return (
    <section
      className="task-area"
      aria-label={t(view === "today" ? "Oggi" : "Importanti")}
    >
      {isLoading ? (
        <div className="task-loading" aria-label={t("Caricamento…")} />
      ) : tasks?.length ? (
        <DndContext>
          <SortableContext items={tasks.map((task) => task._id)} disabled>
            {tasks.map((task, index) => (
              <TaskItem
                key={task._id}
                task={task}
                index={index}
                listTitle={titles[task.listId]}
                selected={task._id === selectedId}
                onEdit={onEdit}
                onAddChild={(parent) => onNew(task.listId, parent)}
                onTaskClick={onSelect}
              />
            ))}
          </SortableContext>
        </DndContext>
      ) : (
        <div className="empty-tasks">
          <Icon icon={faListCheck} />
          <p>{t("Niente qui per ora")}</p>
        </div>
      )}
    </section>
  );
}
