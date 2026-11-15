"use client";

import useSWR from "swr";
import { Icon } from "@/components/ui/Icon";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import { dataFetcher } from "@/lib/client";
import { usePreferences } from "@/components/Preferences";
import { useTaskActions } from "./taskActions";
import type { TodoTaskPlain } from "@/types/todo";

/** Completed top-level rows, fetched only while the section is expanded. */
export function useCompletedTasks(listId: string, enabled: boolean) {
  return useSWR<TodoTaskPlain[]>(
    enabled
      ? `/api/admin/todo/tasks?listId=${listId}&parentTaskId=null&completed=true`
      : null,
    dataFetcher,
    { revalidateOnFocus: true, refreshInterval: 30_000 },
  );
}

export function CompletedTasksTab({
  tasks,
  selectedId,
  onSelect,
}: {
  tasks: TodoTaskPlain[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { t } = usePreferences(),
    { reopen, revalidate } = useTaskActions();
  return (
    <div className="completed-rows">
      {tasks.map((task) => (
        <div
          key={task._id}
          className={`task-row done${task._id === selectedId ? " selected" : ""}`}
          onClick={() => onSelect(task._id)}
        >
          <button
            type="button"
            className="check-task"
            role="checkbox"
            aria-checked
            aria-label={task.title}
            data-tip={t("Riapri")}
            data-tip-side="right"
            onClick={async (e) => {
              e.stopPropagation();
              if (await reopen(task._id)) revalidate();
            }}
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
                onSelect(task._id);
              }}
            >
              {task.title}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
