"use client";
import { useState, useEffect, useRef, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import useSWR, { useSWRConfig } from "swr";
import { Icon } from "@/components/ui/Icon";
import { ListIcon } from "@/components/ui/ListIcon";
import {
  faBars,
  faPlus,
  faFolder,
  faChevronDown,
  faChevronRight,
  faStar,
  faLayerGroup,
  faList,
  faTableColumns,
  faGear,
  faTrash,
  faPen,
  faBroom,
  faTag,
  faShareNodes,
  faXmark,
  faHouse,
} from "@fortawesome/free-solid-svg-icons";
import { THEME_PRESETS, luminance, themeVariables } from "@/lib/themes";
import { dataFetcher, apiFetch } from "@/lib/client";
import { usePreferences } from "./Preferences";
import { AdminModal } from "./admin/AdminModal";
import { ConfirmDialog } from "./admin/ConfirmDialog";
import { TodoListForm, type TodoListPayload } from "./admin/todo/TodoListForm";
import { ProjectForm, type ProjectPayload } from "./admin/todo/ProjectForm";
import { TaskDetailModal } from "./admin/todo/TaskDetailModal";
import { TaskDetailPanel } from "./admin/todo/TaskDetailPanel";
import { TagManager } from "./admin/todo/TagManager";
import { ShareManager } from "./admin/todo/ShareManager";
import { ListTaskPane } from "./admin/todo/ListTaskPane";
import { useSounds } from "@/hooks/useSounds";
import type {
  TodoProjectPlain,
  TodoListPlain,
  TodoTaskPlain,
  TodoTagPlain,
} from "@/types/todo";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
function surfaceStyle(
  list: TodoListPlain,
  useListColors: boolean,
): CSSProperties | undefined {
  if (!useListColors) return undefined;
  const dark = luminance(list.backgroundColor) < 0.18;
  const base = THEME_PRESETS[dark ? 1 : 0];
  const palette = {
    ...base,
    colors: { ...base.colors, sheet: list.backgroundColor },
  };
  return {
    ...themeVariables(palette, list.accentColor),
    "--list-bg": list.backgroundColor,
  } as CSSProperties;
}
export default function TodoApp({
  initialListId,
  initialProjectId,
  boundToHost = false,
  currentUserId,
}: {
  initialListId?: string;
  initialProjectId?: string;
  boundToHost?: boolean;
  currentUserId: string;
}) {
  const { preferences, setPreference, t } = usePreferences(),
    { playCreated } = useSounds(),
    { mutate: refresh } = useSWRConfig();
  const {
      data: lists = [],
      isLoading,
      mutate: refreshLists,
    } = useSWR<TodoListPlain[]>("/api/admin/todo/lists", dataFetcher, {
      refreshInterval: 30000,
    }),
    { data: projects = [], mutate: refreshProjects } = useSWR<
      TodoProjectPlain[]
    >("/api/admin/todo/projects", dataFetcher),
    { data: config } = useSWR("/api/public", dataFetcher),
    { data: usage } = useSWR("/api/admin/usage", dataFetcher);
  const [selectedListId, setSelectedListId] = useState<string | null>(
      initialListId || null,
    ),
    [selectedProjectId, setSelectedProjectId] = useState<
      string | null | undefined
    >(initialProjectId),
    [expanded, setExpanded] = useState<Set<string>>(
      new Set(initialProjectId ? [initialProjectId] : []),
    ),
    [mobileOpen, setMobileOpen] = useState(false),
    [tooltip, setTooltip] = useState<{
      text: string;
      x: number;
      y: number;
    } | null>(null),
    [query, setQuery] = useState(""),
    [tab, setTab] = useState<"active" | "favorites" | "completed">("active"),
    [tagIds, setTagIds] = useState<string[]>([]);
  const [listModal, setListModal] = useState(false),
    [editingList, setEditingList] = useState<TodoListPlain | null>(null),
    [projectModal, setProjectModal] = useState(false),
    [editingProject, setEditingProject] = useState<TodoProjectPlain | null>(
      null,
    ),
    [deleteList, setDeleteList] = useState<TodoListPlain | null>(null),
    [clearList, setClearList] = useState<TodoListPlain | null>(null),
    [deleteProject, setDeleteProject] = useState<TodoProjectPlain | null>(null),
    [taskModal, setTaskModal] = useState(false),
    [editingTask, setEditingTask] = useState<TodoTaskPlain | null>(null),
    [taskListId, setTaskListId] = useState(""),
    [parentId, setParentId] = useState<string | null>(null),
    [selectedTaskId, setSelectedTaskId] = useState<string | null>(null),
    [tagModal, setTagModal] = useState(false),
    [shareListId, setShareListId] = useState<string | null>(null),
    [error, setError] = useState("");
  const initialized = useRef(false),
    selectedList = lists.find((list) => list._id === selectedListId) || null,
    selectedProject =
      projects.find(
        (project) =>
          project._id === (selectedProjectId ?? selectedList?.projectId),
      ) || null;
  const contextLists =
      selectedProjectId === undefined
        ? lists
        : lists.filter(
            (list) => (list.projectId || null) === selectedProjectId,
          ),
    canManage = (list: TodoListPlain) =>
      list.createdBy === currentUserId ||
      projects.some(
        (p) => p._id === list.projectId && p.createdBy === currentUserId,
      ),
    isProjectOwner = selectedProject?.createdBy === currentUserId;
  const { data: tags = [] } = useSWR<TodoTagPlain[]>(
    selectedList ? `/api/admin/todo/tags?listId=${selectedList._id}` : null,
    dataFetcher,
  );
  useEffect(() => {
    if (initialized.current || isLoading) return;
    initialized.current = true;
    if (initialListId) {
      const list = lists.find((l) => l._id === initialListId);
      setSelectedProjectId(list?.projectId || null);
      if (list?.projectId) setExpanded(new Set([list.projectId]));
    } else if (initialProjectId) {
      setSelectedListId(
        lists.find((l) => l.projectId === initialProjectId)?._id || null,
      );
    } else if (lists.length) {
      setSelectedListId(lists[0]._id);
      setSelectedProjectId(lists[0].projectId || null);
      if (lists[0].projectId) setExpanded(new Set([lists[0].projectId]));
    }
  }, [lists, isLoading, initialListId, initialProjectId]);
  useEffect(() => {
    const menu = () => setMobileOpen((current) => !current),
      search = (e: Event) => setQuery((e as CustomEvent<string>).detail);
    window.addEventListener("ervisio:menu", menu);
    window.addEventListener("ervisio:search", search);
    return () => {
      window.removeEventListener("ervisio:menu", menu);
      window.removeEventListener("ervisio:search", search);
    };
  }, []);
  useEffect(() => {
    if (!mobileOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [mobileOpen]);
  useEffect(() => {
    setTooltip(null);
  }, [preferences.sidebarCollapsed, mobileOpen]);
  useEffect(() => {
    if (!selectedList && !selectedProject) return;
    document.title = `${preferences.view === "cards" && selectedProject ? selectedProject.title : selectedList?.title || selectedProject?.title} · ${config?.siteName || "ErvisioTodo"}`;
    if (selectedList) {
      const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (link) link.href = selectedList.faviconUrl || "/favicon.svg";
    }
    if (!boundToHost) {
      const path =
        preferences.view === "cards" && selectedProject
          ? `/p/${selectedProject.slug}`
          : selectedList
            ? `/l/${selectedList.slug}`
            : selectedProject
              ? `/p/${selectedProject.slug}`
              : "/";
      window.history.replaceState(null, "", path);
    }
  }, [
    selectedList,
    selectedProject,
    preferences.view,
    preferences.theme,
    boundToHost,
    config?.siteName,
  ]);
  function selectProject(project: TodoProjectPlain | null) {
    setSelectedProjectId(project?._id || null);
    setSelectedListId(
      lists.find((l) => (l.projectId || null) === (project?._id || null))
        ?._id || null,
    );
    setSelectedTaskId(null);
    setTagIds([]);
    setMobileOpen(false);
    if (project) setExpanded((current) => new Set([...current, project._id]));
  }
  function selectList(list: TodoListPlain) {
    if (boundToHost && list._id !== initialListId) {
      location.assign(`${config?.canonicalUrl || ""}/l/${list.slug}`);
      return;
    }
    setSelectedListId(list._id);
    setSelectedProjectId(list.projectId || null);
    setSelectedTaskId(null);
    setTab("active");
    setTagIds([]);
    setMobileOpen(false);
    if (list.projectId)
      setExpanded((current) => new Set([...current, list.projectId!]));
  }
  function newList() {
    setEditingList(null);
    setListModal(true);
  }
  function newTask(listId: string, parent: string | null = null) {
    setEditingTask(null);
    setTaskListId(listId);
    setParentId(parent);
    setTaskModal(true);
  }
  function editTask(task: TodoTaskPlain) {
    setEditingTask(task);
    setTaskListId(task.listId);
    setParentId(task.parentTaskId);
    setTaskModal(true);
  }
  async function saveList(value: TodoListPayload) {
    const response = await apiFetch(
        editingList
          ? `/api/admin/todo/lists/${editingList._id}`
          : "/api/admin/todo/lists",
        {
          method: editingList ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(value),
        },
      ),
      body = await response.json();
    if (!response.ok) throw new Error(body.error);
    await refreshLists();
    await refreshProjects();
    setSelectedListId(body.data._id);
    setSelectedProjectId(body.data.projectId || null);
    setListModal(false);
  }
  async function saveProject(value: ProjectPayload) {
    const response = await apiFetch(
        editingProject
          ? `/api/admin/todo/projects/${editingProject._id}`
          : "/api/admin/todo/projects",
        {
          method: editingProject ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(value),
        },
      ),
      body = await response.json();
    if (!response.ok) throw new Error(body.error);
    await refreshProjects();
    setSelectedProjectId(body.data._id);
    setExpanded((current) => new Set([...current, body.data._id]));
    if (!editingProject) setSelectedListId(null);
    setProjectModal(false);
  }
  async function taskSaved() {
    if (!editingTask) playCreated();
    await refresh(
      (key) =>
        typeof key === "string" && key.startsWith("/api/admin/todo/tasks"),
      (current) => current,
      { revalidate: true },
    );
    await refreshProjects();
  }
  async function remove(kind: "project" | "list" | "clear") {
    const target =
      kind === "project"
        ? deleteProject
        : kind === "list"
          ? deleteList
          : clearList;
    if (!target) return;
    const endpoint =
      kind === "project"
        ? `/api/admin/todo/projects/${target._id}`
        : `/api/admin/todo/lists/${target._id}${kind === "clear" ? "/clear" : ""}`;
    const response = await apiFetch(endpoint, { method: "DELETE" }),
      body = await response.json();
    if (!response.ok) {
      setError(body.error);
      return;
    }
    setDeleteList(null);
    setDeleteProject(null);
    setClearList(null);
    if (kind !== "clear") {
      setSelectedListId(null);
      if (kind === "project") setSelectedProjectId(null);
    }
    await refreshLists();
    await refreshProjects();
    await refresh(
      (key) =>
        typeof key === "string" && key.startsWith("/api/admin/todo/tasks"),
      (current) => current,
      { revalidate: true },
    );
  }
  function tip(
    event: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>,
    text: string,
  ) {
    if (!preferences.sidebarCollapsed || mobileOpen) return;
    const box = event.currentTarget.getBoundingClientRect();
    setTooltip({ text, x: box.right + 12, y: box.top + 8 });
  }
  function nav(
    label: string,
    icon: IconDefinition,
    onClick: () => void,
    active = false,
    color?: string,
  ) {
    return (
      <button
        key={label}
        className={`nav-item${active ? " active" : ""}`}
        onClick={onClick}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        onMouseEnter={(e) => tip(e, label)}
        onMouseLeave={() => setTooltip(null)}
        onFocus={(e) => tip(e, label)}
        onBlur={() => setTooltip(null)}
      >
        <Icon icon={icon} className="nav-icon" />
        <span className="nav-label">{label}</span>
      </button>
    );
  }
  const pane = (list: TodoListPlain) => (
    <ListTaskPane
      list={list}
      tab={tab}
      query={query}
      tags={preferences.view === "list" ? tagIds : []}
      onNew={newTask}
      onEdit={editTask}
      onSelect={setSelectedTaskId}
    />
  );
  return (
    <div
      className={`todo-shell${preferences.sidebarCollapsed ? " sidebar-collapsed" : ""}${mobileOpen ? " menu-open" : ""}`}
    >
      {mobileOpen && (
        <button
          className="sidebar-backdrop"
          aria-label={t("Chiudi navigazione")}
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className="project-sidebar"
        aria-label={t("Navigazione")}
        onScroll={() => setTooltip(null)}
      >
        <div className="sidebar-top">
          <span>{t("Il tuo spazio")}</span>
          <button
            className="sidebar-toggle"
            aria-label={t(
              mobileOpen
                ? "Chiudi menu"
                : preferences.sidebarCollapsed
                  ? "Espandi barra laterale"
                  : "Riduci barra laterale",
            )}
            aria-expanded={!preferences.sidebarCollapsed}
            onClick={() => {
              if (mobileOpen) setMobileOpen(false);
              else
                setPreference({
                  sidebarCollapsed: !preferences.sidebarCollapsed,
                });
            }}
          >
            <Icon icon={faBars} />
          </button>
        </div>
        <button
          className="button sidebar-create"
          onClick={() => {
            setEditingProject(null);
            setProjectModal(true);
          }}
          aria-label={t("Nuovo progetto")}
        >
          <Icon icon={faPlus} />
          <span className="nav-label">{t("Nuovo progetto")}</span>
        </button>
        <p className="sidebar-label">{t("Navigazione")}</p>
        {nav(
          t("Panoramica"),
          faHouse,
          () => {
            setSelectedProjectId(undefined);
            setSelectedListId(lists[0]?._id || null);
            setSelectedTaskId(null);
          },
          selectedProjectId === undefined,
        )}
        {nav(
          t("Preferiti"),
          faStar,
          () => setTab("favorites"),
          tab === "favorites",
        )}
        <div className="sidebar-label-row">
          <p className="sidebar-label">{t("Progetti")}</p>
          <button
            aria-label={t("Nuovo progetto")}
            onClick={() => {
              setEditingProject(null);
              setProjectModal(true);
            }}
          >
            <Icon icon={faPlus} />
          </button>
        </div>
        <nav className="project-tree">
          {projects.map((project) => (
            <div className="project-branch" key={project._id}>
              <div
                className={`project-node${selectedProjectId === project._id ? " selected" : ""}`}
              >
                <button
                  className="project-select"
                  aria-label={project.title}
                  onClick={() => selectProject(project)}
                  onMouseEnter={(e) => tip(e, project.title)}
                  onMouseLeave={() => setTooltip(null)}
                  onFocus={(e) => tip(e, project.title)}
                  onBlur={() => setTooltip(null)}
                >
                  <span
                    className="project-custom-icon"
                    style={{ color: project.color }}
                  >
                    <ListIcon
                      list={{
                        iconType: project.iconValue.startsWith("fa-")
                          ? "fontawesome"
                          : "emoji",
                        iconValue: project.iconValue,
                      }}
                    />
                  </span>
                  <span className="nav-label">{project.title}</span>
                </button>
                <button
                  className="project-expand"
                  aria-label={`${t(expanded.has(project._id) ? "Riduci" : "Espandi")} ${project.title}`}
                  aria-expanded={expanded.has(project._id)}
                  onClick={() =>
                    setExpanded((current) => {
                      const next = new Set(current);
                      next.has(project._id)
                        ? next.delete(project._id)
                        : next.add(project._id);
                      return next;
                    })
                  }
                >
                  <Icon
                    icon={
                      expanded.has(project._id) ? faChevronDown : faChevronRight
                    }
                  />
                </button>
              </div>
              {expanded.has(project._id) && (
                <div className="project-lists">
                  {lists
                    .filter((list) => list.projectId === project._id)
                    .map((list) => (
                      <button
                        key={list._id}
                        className={`sidebar-list${list._id === selectedListId ? " active" : ""}`}
                        aria-current={
                          list._id === selectedListId ? "page" : undefined
                        }
                        onClick={() => selectList(list)}
                      >
                        <ListIcon list={list} />
                        <span>{list.title}</span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        {nav(
          t("Senza progetto"),
          faLayerGroup,
          () => selectProject(null),
          selectedProjectId === null &&
            (!selectedListId || preferences.sidebarCollapsed),
        )}
        {selectedProjectId === null && (
          <div className="project-lists">
            {lists
              .filter((list) => !list.projectId)
              .map((list) => (
                <button
                  key={list._id}
                  className={`sidebar-list${list._id === selectedListId ? " active" : ""}`}
                  aria-current={
                    list._id === selectedListId ? "page" : undefined
                  }
                  onClick={() => selectList(list)}
                >
                  <ListIcon list={list} />
                  <span>{list.title}</span>
                </button>
              ))}
          </div>
        )}
        <footer className="sidebar-footer">
          {nav(t("Impostazioni"), faGear, () => location.assign("/settings"))}
          {usage && (
            <div className="sidebar-storage">
              <div className="storage-meter">
                <i
                  style={{
                    width: `${usage.quotaGb ? Math.min(100, (usage.total.bytes / (usage.quotaGb * 1024 ** 3)) * 100) : 0}%`,
                  }}
                />
              </div>
              <p>
                {(usage.total.bytes / 1024 ** 2).toLocaleString(
                  preferences.locale,
                  { maximumFractionDigits: 1 },
                )}{" "}
                MB {usage.quotaGb ? `/ ${usage.quotaGb} GB` : ""}
              </p>
            </div>
          )}
        </footer>
      </aside>
      <main
        className={`todo-content${preferences.view === "cards" ? " cards-mode" : ""}`}
      >
        <div className="workspace-heading">
          <div className="workspace-breadcrumb">
            <button onClick={() => setSelectedProjectId(undefined)}>
              {t("Progetti")}
            </button>
            {selectedProject && (
              <>
                <span>/</span>
                <span>{selectedProject.title}</span>
              </>
            )}
          </div>
          <div className="workspace-title-row">
            <h1>
              {selectedProject?.title ||
                (selectedList ? selectedList.title : t("Il tuo spazio"))}
            </h1>
            <div className="workspace-main-actions">
              {isProjectOwner && (
                <>
                  <button
                    className="button secondary"
                    onClick={() => {
                      setEditingProject(selectedProject);
                      setProjectModal(true);
                    }}
                  >
                    <Icon icon={faGear} />
                    <span>{t("Progetto")}</span>
                  </button>
                  <button
                    className="icon-button danger-icon"
                    title={t("Elimina progetto")}
                    aria-label={t("Elimina progetto")}
                    onClick={() => setDeleteProject(selectedProject)}
                  >
                    <Icon icon={faTrash} />
                  </button>
                </>
              )}
              <button className="button" onClick={newList}>
                <Icon icon={faPlus} />
                {t("Nuova lista")}
              </button>
            </div>
          </div>
          <div className="workspace-view-row">
            <p>
              {selectedProject?.description ||
                `${contextLists.length} ${t("Liste").toLowerCase()}`}
            </p>
            <div
              className="segmented view-selector"
              role="group"
              aria-label={t("Vista del progetto")}
            >
              <button
                aria-pressed={preferences.view === "list"}
                onClick={() => setPreference({ view: "list" })}
              >
                <Icon icon={faList} />
                {t("Lista")}
              </button>
              <button
                aria-pressed={preferences.view === "cards"}
                onClick={() => setPreference({ view: "cards" })}
              >
                <Icon icon={faTableColumns} />
                {t("Schede")}
              </button>
            </div>
          </div>
        </div>
        {error && (
          <p className="error px-7" role="alert">
            {error}
          </p>
        )}
        {isLoading ? (
          <div className="task-loading m-8" />
        ) : !contextLists.length ? (
          <div className="workspace-empty">
            <Icon icon={faFolder} />
            <h2>
              {t(
                selectedProject
                  ? "Nessuna lista in questo progetto"
                  : "Organizza il tuo prossimo progetto",
              )}
            </h2>
            <p>
              {t(
                selectedProject
                  ? "Crea una lista per iniziare a organizzare il lavoro."
                  : "Crea un progetto e raccogli al suo interno tutte le liste di attività.",
              )}
            </p>
            <button className="button" onClick={newList}>
              <Icon icon={faPlus} />
              {t("Nuova lista")}
            </button>
          </div>
        ) : (
          <>
            <nav className="workspace-list-tabs" aria-label={t("Liste")}>
              {contextLists.map((list) => (
                <button
                  key={list._id}
                  aria-current={
                    selectedListId === list._id ? "page" : undefined
                  }
                  onClick={() => selectList(list)}
                >
                  <ListIcon list={list} />
                  <span>{list.title}</span>
                </button>
              ))}
            </nav>
            <div className="task-toolbar">
              <div className="task-tabs">
                {(["active", "favorites", "completed"] as const).map(
                  (status) => (
                    <button
                      key={status}
                      aria-pressed={tab === status}
                      onClick={() => setTab(status)}
                    >
                      {t(
                        status === "active"
                          ? "Attive"
                          : status === "favorites"
                            ? "Preferite"
                            : "Completate",
                      )}
                    </button>
                  ),
                )}
              </div>
              {preferences.view === "list" && selectedList && (
                <div className="list-actions">
                  <button
                    className="button compact"
                    onClick={() => newTask(selectedList._id)}
                  >
                    <Icon icon={faPlus} />
                    {t("Nuova task")}
                  </button>
                  <button
                    className="icon-button"
                    title={t("Tag")}
                    aria-label={t("Tag")}
                    onClick={() => setTagModal(true)}
                  >
                    <Icon icon={faTag} />
                  </button>
                  {canManage(selectedList) && (
                    <>
                      <button
                        className="icon-button"
                        title={t("Link pubblico")}
                        aria-label={t("Link pubblico")}
                        onClick={() => setShareListId(selectedList._id)}
                      >
                        <Icon icon={faShareNodes} />
                      </button>
                      <button
                        className="icon-button"
                        title={t("Svuota lista")}
                        aria-label={t("Svuota lista")}
                        onClick={() => setClearList(selectedList)}
                      >
                        <Icon icon={faBroom} />
                      </button>
                      <button
                        className="icon-button"
                        title={t("Modifica lista")}
                        aria-label={t("Modifica lista")}
                        onClick={() => {
                          setEditingList(selectedList);
                          setListModal(true);
                        }}
                      >
                        <Icon icon={faPen} />
                      </button>
                      <button
                        className="icon-button danger-icon"
                        title={t("Elimina lista")}
                        aria-label={t("Elimina lista")}
                        onClick={() => setDeleteList(selectedList)}
                      >
                        <Icon icon={faTrash} />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            {preferences.view === "list" && selectedList && tags.length > 0 && (
              <div className="tag-filter">
                {tags.map((tag) => (
                  <button
                    key={tag._id}
                    aria-pressed={tagIds.includes(tag._id)}
                    onClick={() =>
                      setTagIds((current) =>
                        current.includes(tag._id)
                          ? current.filter((id) => id !== tag._id)
                          : [...current, tag._id],
                      )
                    }
                  >
                    <i style={{ background: tag.color }} />
                    {tag.name}
                  </button>
                ))}
                {tagIds.length > 0 && (
                  <button
                    onClick={() => setTagIds([])}
                    aria-label={t("Rimuovi filtri")}
                  >
                    <Icon icon={faXmark} />
                  </button>
                )}
              </div>
            )}
            <div className="task-workspace">
              {preferences.view === "list" ? (
                selectedList ? (
                  <div
                    className="task-surface"
                    style={surfaceStyle(
                      selectedList,
                      preferences.useListColors,
                    )}
                  >
                    {pane(selectedList)}
                  </div>
                ) : null
              ) : (
                <div className="list-board">
                  {contextLists.map((list) => (
                    <section
                      className="list-card task-surface"
                      key={list._id}
                      style={surfaceStyle(list, preferences.useListColors)}
                    >
                      <header>
                        <button
                          className="card-list-title"
                          onClick={() => {
                            selectList(list);
                            setPreference({ view: "list" });
                          }}
                        >
                          <ListIcon list={list} />
                          <h2>{list.title}</h2>
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`${t("Nuova attività")}: ${list.title}`}
                          onClick={() => newTask(list._id)}
                        >
                          <Icon icon={faPlus} />
                        </button>
                        {canManage(list) && (
                          <button
                            className="icon-button"
                            aria-label={`${t("Modifica lista")}: ${list.title}`}
                            onClick={() => {
                              setEditingList(list);
                              setListModal(true);
                            }}
                          >
                            <Icon icon={faGear} />
                          </button>
                        )}
                      </header>
                      {pane(list)}
                    </section>
                  ))}
                </div>
              )}
              {selectedTaskId && (
                <div className="task-detail-dock">
                  <TaskDetailPanel
                    taskId={selectedTaskId}
                    onClose={() => setSelectedTaskId(null)}
                    onEdit={(task) => {
                      setSelectedTaskId(null);
                      editTask(task);
                    }}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </main>
      <AdminModal
        open={listModal}
        title={t(editingList ? "Modifica lista" : "Nuova lista")}
        onClose={() => setListModal(false)}
        size="md"
      >
        <TodoListForm
          initial={editingList || { projectId: selectedProjectId || null }}
          onSubmit={saveList}
          onCancel={() => setListModal(false)}
        />
      </AdminModal>
      <AdminModal
        open={projectModal}
        title={t(editingProject ? "Modifica progetto" : "Nuovo progetto")}
        onClose={() => setProjectModal(false)}
        size="md"
      >
        <ProjectForm
          initial={editingProject || undefined}
          onSubmit={saveProject}
          onCancel={() => setProjectModal(false)}
        />
      </AdminModal>
      <TaskDetailModal
        open={taskModal}
        task={editingTask}
        listId={taskListId}
        parentTaskId={parentId}
        onClose={() => setTaskModal(false)}
        onSaved={taskSaved}
      />
      <AdminModal
        open={tagModal}
        title={t("Tag")}
        onClose={() => {
          setTagModal(false);
          refresh(`/api/admin/todo/tags?listId=${selectedListId}`);
        }}
        size="md"
      >
        {selectedList && (
          <TagManager
            listId={selectedList._id}
            onClose={() => setTagModal(false)}
          />
        )}
      </AdminModal>
      <AdminModal
        open={!!shareListId}
        title={t("Link pubblico")}
        onClose={() => setShareListId(null)}
        size="md"
      >
        {shareListId && <ShareManager listId={shareListId} />}
      </AdminModal>
      <ConfirmDialog
        open={!!deleteProject}
        title={`${t("Elimina progetto")}: ${deleteProject?.title || ""}`}
        description={t(
          "Le liste verranno spostate in Senza progetto. Nessuna attività sarà eliminata.",
        )}
        onConfirm={() => remove("project")}
        onCancel={() => setDeleteProject(null)}
        dangerous
      />
      <ConfirmDialog
        open={!!deleteList}
        title={`${t("Elimina lista")}: ${deleteList?.title || ""}`}
        description={t(
          "Verranno eliminate tutte le attività, le sottoattività e gli allegati della lista.",
        )}
        onConfirm={() => remove("list")}
        onCancel={() => setDeleteList(null)}
        dangerous
      />
      <ConfirmDialog
        open={!!clearList}
        title={`${t("Svuota lista")}: ${clearList?.title || ""}`}
        description={t(
          "Verranno eliminate le attività attive e le loro sottoattività.",
        )}
        onConfirm={() => remove("clear")}
        onCancel={() => setClearList(null)}
        dangerous
      />
      {tooltip &&
        createPortal(
          <div
            role="tooltip"
            className="sidebar-tooltip"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            {tooltip.text}
          </div>,
          document.body,
        )}
    </div>
  );
}
