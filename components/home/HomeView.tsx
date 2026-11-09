"use client";
import { useState } from "react";
import useSWR from "swr";
import { faCheck, faStar } from "@fortawesome/free-solid-svg-icons";
import { Icon } from "@/components/ui/Icon";
import { ListIcon } from "@/components/ui/ListIcon";
import { projectGlyph } from "@/components/shell/Rail";
import { usePreferences } from "@/components/Preferences";
import { dataFetcher } from "@/lib/client";
import { useTaskActions } from "@/components/admin/todo/taskActions";
import type {
  TodoListPlain,
  TodoProjectPlain,
  TodoTaskPlain,
} from "@/types/todo";

type Group = {
  key: string;
  title: string;
  color: string;
  tasks: TodoTaskPlain[];
};

/** Landing view behind "Panoramica": what is due today, grouped by project, and a way into every project. */
export function HomeView({
  lists,
  projects,
  range,
  importantCount,
  onSelect,
  onProject,
  onList,
  onImportant,
}: {
  lists: TodoListPlain[];
  projects: TodoProjectPlain[];
  range: string;
  importantCount: number;
  onSelect: (id: string) => void;
  onProject: (project: TodoProjectPlain) => void;
  onList: (list: TodoListPlain) => void;
  onImportant: () => void;
}) {
  const { t } = usePreferences(),
    { complete, removeFromLists, revalidate } = useTaskActions(),
    [busy, setBusy] = useState<string | null>(null),
    { data: tasks = [], isLoading } = useSWR<TodoTaskPlain[]>(
      `/api/admin/todo/tasks?smart=today&${range}`,
      dataFetcher,
      { refreshInterval: 30000 },
    );
  const projectOf = new Map(lists.map((list) => [list._id, list.projectId])),
    groups: Group[] = [];
  for (const task of tasks) {
    const projectId = projectOf.get(task.listId) ?? null,
      project = projects.find((p) => p._id === projectId),
      key = project?._id ?? "none";
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = {
        key,
        title: project?.title ?? t("Senza progetto"),
        color: project?.color ?? "rgb(var(--ink-dim))",
        tasks: [],
      };
      groups.push(group);
    }
    group.tasks.push(task);
  }
  const standalone = lists.filter((list) => !list.projectId),
    open = lists.reduce((sum, list) => sum + (list.openTaskCount ?? 0), 0);
  async function finish(task: TodoTaskPlain) {
    setBusy(task._id);
    try {
      if (await complete(task._id)) {
        removeFromLists(task._id);
        revalidate();
      }
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="home">
      <h1>{t("Oggi, per progetto")}</h1>
      <p className="home-sub">
        {isLoading
          ? t("Caricamento…")
          : tasks.length
            ? `${tasks.length} ${t("attività per oggi")}`
            : t("Niente in programma per oggi.")}
      </p>
      {groups.map((group) => (
        <section
          key={group.key}
          className="home-group"
          style={{ "--c": group.color } as React.CSSProperties}
        >
          <h2>
            <i />
            {group.title}
          </h2>
          {group.tasks.map((task) => (
            <div key={task._id} className="home-row">
              <button
                type="button"
                className="check-task"
                role="checkbox"
                aria-checked={busy === task._id}
                aria-label={task.title}
                disabled={busy === task._id}
                onClick={() => finish(task)}
              >
                <span>
                  <Icon icon={faCheck} />
                </span>
              </button>
              <button
                type="button"
                className="home-title"
                onClick={() => onSelect(task._id)}
              >
                {task.title}
              </button>
            </div>
          ))}
        </section>
      ))}
      <div className="home-foot">
        {importantCount > 0 && (
          <button type="button" onClick={onImportant}>
            <Icon icon={faStar} />
            <b>{importantCount}</b> {t("importanti")}
          </button>
        )}
        <span>
          <b>{projects.length}</b>{" "}
          {t(projects.length === 1 ? "progetto" : "progetti")}
        </span>
        <span>
          <b>{open}</b> {t("aperte in totale")}
        </span>
      </div>
      {(projects.length > 0 || standalone.length > 0) && (
        <nav className="home-projects" aria-label={t("Vai a")}>
          {projects.map((project) => (
            <button
              key={project._id}
              type="button"
              style={{ "--c": project.color } as React.CSSProperties}
              onClick={() => onProject(project)}
            >
              {projectGlyph(project)}
              {project.title}
            </button>
          ))}
          {standalone.map((list) => (
            <button
              key={list._id}
              type="button"
              style={{ "--c": list.accentColor } as React.CSSProperties}
              onClick={() => onList(list)}
            >
              <ListIcon list={list} />
              {list.title}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
