"use client";

import useSWR, { useSWRConfig } from "swr";
import { apiFetch, dataFetcher } from "@/lib/client";
import { useSounds } from "@/hooks/useSounds";
import type { TodoTaskPlain } from "@/types/todo";

const isTaskKey = (key: unknown) =>
  typeof key === "string" && key.startsWith("/api/admin/todo/tasks");

/** Completion, reopening and cache refresh shared by the task list and the detail panel. */
export function useTaskActions() {
  const { mutate } = useSWRConfig(),
    { playCompleted } = useSounds();
  const revalidate = () => mutate(isTaskKey, undefined, { revalidate: true }),
    /** Drops a task from every cached list without waiting for the refetch. */
    removeFromLists = (id: string) =>
      mutate(
        isTaskKey,
        (current: TodoTaskPlain[] | undefined) =>
          Array.isArray(current)
            ? current.filter((task) => task._id !== id)
            : current,
        { revalidate: false },
      );
  return {
    revalidate,
    removeFromLists,
    async complete(id: string) {
      const response = await apiFetch(`/api/admin/todo/tasks/${id}/complete`, {
        method: "PATCH",
      });
      if (!response.ok) return false;
      playCompleted();
      return true;
    },
    /** Asks for confirmation, then deletes the task and its subtasks. */
    async remove(task: Pick<TodoTaskPlain, "_id" | "title">) {
      if (
        !confirm(`Eliminare il task "${task.title}" e tutte le sue sottotask?`)
      )
        return false;
      const response = await apiFetch(`/api/admin/todo/tasks/${task._id}`, {
        method: "DELETE",
      });
      if (!response.ok) return false;
      removeFromLists(task._id);
      await revalidate();
      return true;
    },
    async reopen(id: string) {
      const response = await apiFetch(`/api/admin/todo/tasks/${id}/reopen`, {
        method: "PATCH",
      });
      return response.ok;
    },
  };
}

/** Direct children of a task: the API lists open and completed ones separately. */
export function useSubtasks(
  listId: string,
  parentId: string,
  enabled: boolean,
) {
  const base = `/api/admin/todo/tasks?listId=${listId}&parentTaskId=${parentId}`,
    { data: open } = useSWR<TodoTaskPlain[]>(
      enabled ? base : null,
      dataFetcher,
    ),
    { data: done } = useSWR<TodoTaskPlain[]>(
      enabled ? `${base}&completed=true` : null,
      dataFetcher,
    );
  return { open, done, total: (open?.length ?? 0) + (done?.length ?? 0) };
}
