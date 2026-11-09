"use client";
import {
  useState,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
} from "react";
import Link from "next/link";
import useSWR, { useSWRConfig } from "swr";
import { Icon } from "@/components/ui/Icon";
import { ListIcon } from "@/components/ui/ListIcon";
import { OverflowMenu, type MenuGroup } from "@/components/ui/OverflowMenu";
import {
  faPlus,
  faFolder,
  faMagnifyingGlass,
  faStar,
  faTableColumns,
  faGear,
  faTrash,
  faPen,
  faBroom,
  faTag,
  faShareNodes,
  faXmark,
  faSun,
  faAnglesRight,
  faListUl,
  faCircleCheck,
  faFilter,
  faEye,
} from "@fortawesome/free-solid-svg-icons";
import {
  THEME_PRESETS,
  contrast,
  luminance,
  rgbChannels,
  themeVariables,
} from "@/lib/themes";
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
import { Rail, ShellBackdrop } from "./shell/Rail";
import { ListTaskPane } from "./admin/todo/ListTaskPane";
import { SmartTaskPane } from "./admin/todo/SmartTaskPane";
import { TaskComposer } from "./admin/todo/TaskComposer";
import { useSounds } from "@/hooks/useSounds";
import type {
  TodoProjectPlain,
  TodoListPlain,
  TodoTaskPlain,
  TodoTagPlain,
} from "@/types/todo";
type Smart = "today" | "important";
type Tab = "active" | "favorites" | "completed";
function surfaceStyle(
  list: TodoListPlain,
  useListColors: boolean,
): CSSProperties | undefined {
  if (!useListColors) return undefined;
  if (!list.backgroundColor)
    return {
      "--accent": list.accentColor,
      "--accent-ch": rgbChannels(list.accentColor).join(" "),
      "--accent-ink": "rgb(var(--fg))",
      "--accent-soft": "color-mix(in srgb, var(--accent) 12%, var(--sheet))",
      "--on-accent":
        contrast(list.accentColor, "#ffffff") >=
        contrast(list.accentColor, "#111111")
          ? "#ffffff"
          : "#111111",
    } as CSSProperties;
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
/** Local calendar day as an ISO range, so "Oggi" follows the viewer's timezone. */
function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return `from=${encodeURIComponent(start.toISOString())}&to=${encodeURIComponent(end.toISOString())}`;
}
export default function TodoApp({
  initialListId,
  initialProjectId,
  boundToHost = false,
  currentUserId,
  userName = "",
}: {
  initialListId?: string;
  initialProjectId?: string;
  boundToHost?: boolean;
  currentUserId: string;
  userName?: string;
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
  const day = new Date().toDateString(),
    range = useMemo(todayRange, [day]),
    { data: smartCounts } = useSWR<{ today: number; important: number }>(
      `/api/admin/todo/tasks/smart?${range}`,
      dataFetcher,
      { refreshInterval: 30000 },
    );
  const [selectedListId, setSelectedListId] = useState<string | null>(
      initialListId || null,
    ),
    [selectedProjectId, setSelectedProjectId] = useState<
      string | null | undefined
    >(initialProjectId),
    [smart, setSmart] = useState<Smart | null>(null),
    [mobileOpen, setMobileOpen] = useState(false),
    [listProjectId, setListProjectId] = useState<string | null>(null),
    [query, setQuery] = useState(""),
    [searchOpen, setSearchOpen] = useState(false),
    [tagsOpen, setTagsOpen] = useState(false),
    [tab, setTab] = useState<Tab>("active"),
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
    searchRef = useRef<HTMLInputElement>(null),
    listsOpen = mobileOpen || !preferences.sidebarCollapsed,
    overlay = preferences.sidebarMode === "overlay",
    extras = preferences.showExtras,
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
    isProjectOwner = selectedProject?.createdBy === currentUserId,
    showToday = !!smartCounts?.today,
    showImportant = !!smartCounts?.important;
  const { data: tags = [] } = useSWR<TodoTagPlain[]>(
    selectedList ? `/api/admin/todo/tags?listId=${selectedList._id}` : null,
    dataFetcher,
  );
  const [detailId, setDetailId] = useState<string | null>(null),
    detailClosing = !selectedTaskId && !!detailId;
  useEffect(() => {
    if (selectedTaskId) setDetailId(selectedTaskId);
  }, [selectedTaskId]);
  useEffect(() => {
    if (!detailClosing) return;
    const duration = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--panel-close",
      ),
    );
    const timer = setTimeout(
      () => setDetailId(null),
      duration ? duration + 80 : 0,
    );
    return () => clearTimeout(timer);
  }, [detailClosing]);
  useEffect(() => {
    if (initialized.current || isLoading) return;
    initialized.current = true;
    if (initialListId) {
      const list = lists.find((l) => l._id === initialListId);
      setSelectedProjectId(list?.projectId || null);
    } else if (initialProjectId) {
      setSelectedListId(
        lists.find((l) => l.projectId === initialProjectId)?._id || null,
      );
    } else if (lists.length) {
      setSelectedListId(lists[0]._id);
      setSelectedProjectId(lists[0].projectId || null);
    }
  }, [lists, isLoading, initialListId, initialProjectId]);
  // A smart view disappears as soon as it has nothing left to show.
  useEffect(() => {
    if (
      (smart === "today" && smartCounts && !smartCounts.today) ||
      (smart === "important" && smartCounts && !smartCounts.important)
    )
      setSmart(null);
  }, [smart, smartCounts]);
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (mobileOpen) setMobileOpen(false);
        else if (listsOpen && overlay)
          setPreference({ sidebarCollapsed: true });
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      }
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  });
  useEffect(() => {
    const title = smart
      ? t(smart === "today" ? "Oggi" : "Importanti")
      : preferences.view === "cards" && selectedProject
        ? selectedProject.title
        : selectedList?.title || selectedProject?.title;
    if (!title) return;
    document.title = `${title} · ${config?.siteName || "ErvisioTodo"}`;
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
    smart,
    selectedList,
    selectedProject,
    preferences.view,
    boundToHost,
    config?.siteName,
    t,
  ]);
  function closeOverlay() {
    setMobileOpen(false);
    if (overlay && !preferences.sidebarCollapsed)
      setPreference({ sidebarCollapsed: true });
  }
  function resetView() {
    setSelectedTaskId(null);
    setTab("active");
    setTagIds([]);
    setTagsOpen(false);
  }
  function selectOverview() {
    setSmart(null);
    setSelectedProjectId(undefined);
    setSelectedListId(lists[0]?._id || null);
    resetView();
  }
  function selectProject(project: TodoProjectPlain | null) {
    setSmart(null);
    setSelectedProjectId(project?._id || null);
    setSelectedListId(
      lists.find((l) => (l.projectId || null) === (project?._id || null))
        ?._id || null,
    );
    resetView();
  }
  function selectList(list: TodoListPlain) {
    if (boundToHost && list._id !== initialListId) {
      location.assign(`${config?.canonicalUrl || ""}/l/${list.slug}`);
      return;
    }
    setSmart(null);
    setSelectedListId(list._id);
    if (selectedProjectId !== undefined)
      setSelectedProjectId(list.projectId || null);
    resetView();
    closeOverlay();
  }
  function selectSmart(view: Smart) {
    setSmart(view);
    setSelectedTaskId(null);
    closeOverlay();
  }
  function openSearch() {
    setSearchOpen(true);
    requestAnimationFrame(() => searchRef.current?.focus());
  }
  function closeSearch() {
    setSearchOpen(false);
    setQuery("");
  }
  function newList(projectId = selectedProjectId ?? null) {
    setEditingList(null);
    setListProjectId(projectId);
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
    setSmart(null);
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
    setSmart(null);
    setSelectedProjectId(body.data._id);
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
    await Promise.all([refreshLists(), refreshProjects()]);
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
  const listView = !smart && preferences.view === "list" && !!selectedList,
    menuGroups: MenuGroup[] = [];
  menuGroups.push({
    label: t("Vista"),
    items: [
      ...(!smart && selectedList
        ? [
            {
              label: t("Cerca"),
              icon: faMagnifyingGlass,
              hint: "Ctrl K",
              onSelect: openSearch,
            },
          ]
        : []),
      ...(listView
        ? [
            {
              label: t("Solo importanti"),
              icon: faStar,
              checked: tab === "favorites",
              onSelect: () =>
                setTab(tab === "favorites" ? "active" : "favorites"),
            },
            {
              label: t("Completate"),
              icon: faCircleCheck,
              checked: tab === "completed",
              onSelect: () =>
                setTab(tab === "completed" ? "active" : "completed"),
            },
            ...(tags.length
              ? [
                  {
                    label: t("Filtra per tag"),
                    icon: faFilter,
                    checked: tagsOpen || tagIds.length > 0,
                    onSelect: () => {
                      if (tagsOpen) setTagIds([]);
                      setTagsOpen(!tagsOpen);
                    },
                  },
                ]
              : []),
          ]
        : []),
      ...(!smart && contextLists.length
        ? [
            {
              label: t("Schede"),
              icon: faTableColumns,
              checked: preferences.view === "cards",
              onSelect: () =>
                setPreference({
                  view: preferences.view === "cards" ? "list" : "cards",
                }),
            },
          ]
        : []),
      {
        label: t("Informazioni extra"),
        icon: faEye,
        checked: extras,
        onSelect: () => setPreference({ showExtras: !extras }),
      },
    ],
  });
  if (listView && selectedList)
    menuGroups.push({
      label: `${t("Lista")}: ${selectedList.title}`,
      items: [
        ...(canManage(selectedList)
          ? [
              {
                label: t("Link pubblico"),
                icon: faShareNodes,
                onSelect: () => setShareListId(selectedList._id),
              },
            ]
          : []),
        { label: t("Tag"), icon: faTag, onSelect: () => setTagModal(true) },
        ...(canManage(selectedList)
          ? [
              {
                label: t("Modifica lista"),
                icon: faPen,
                onSelect: () => {
                  setEditingList(selectedList);
                  setListModal(true);
                },
              },
              {
                label: t("Svuota lista"),
                icon: faBroom,
                onSelect: () => setClearList(selectedList),
              },
              {
                label: t("Elimina lista"),
                icon: faTrash,
                danger: true,
                onSelect: () => setDeleteList(selectedList),
              },
            ]
          : []),
      ],
    });
  if (!smart && isProjectOwner && selectedProject)
    menuGroups.push({
      label: `${t("Progetto")}: ${selectedProject.title}`,
      items: [
        {
          label: t("Modifica progetto"),
          icon: faGear,
          onSelect: () => {
            setEditingProject(selectedProject);
            setProjectModal(true);
          },
        },
        {
          label: t("Elimina progetto"),
          icon: faTrash,
          danger: true,
          onSelect: () => setDeleteProject(selectedProject),
        },
      ],
    });
  const pane = (list: TodoListPlain, showAdd: boolean) => (
    <ListTaskPane
      list={list}
      tab={tab}
      query={query}
      tags={preferences.view === "list" ? tagIds : []}
      onNew={newTask}
      onEdit={editTask}
      onSelect={setSelectedTaskId}
      selectedId={selectedTaskId}
      showAdd={showAdd}
    />
  );
  const contextTitle =
      selectedProjectId === undefined
        ? t("Panoramica")
        : selectedProject?.title || t("Senza progetto"),
    heading = smart
      ? t(smart === "today" ? "Oggi" : "Importanti")
      : preferences.view === "cards"
        ? contextTitle
        : selectedList?.title || contextTitle,
    headingIcon = smart ? (
      <Icon icon={smart === "today" ? faSun : faStar} />
    ) : preferences.view === "list" && selectedList ? (
      <ListIcon list={selectedList} />
    ) : null,
    stagger = (index: number) =>
      ({ "--d": `${(0.08 + index * 0.035).toFixed(3)}s` }) as CSSProperties;
  let row = 0;
  const listItem = (
    key: string,
    label: string,
    icon: React.ReactNode,
    active: boolean,
    onClick: () => void,
    options: { color?: string; count?: number; className?: string } = {},
  ) => (
    <button
      key={key}
      className={`lists-item${active ? " active" : ""}${options.className ? ` ${options.className}` : ""}`}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      data-tip={listsOpen ? undefined : label}
      data-tip-side="right"
      style={
        options.color ? ({ "--c": options.color } as CSSProperties) : undefined
      }
      onClick={onClick}
    >
      <span className="lists-icon">{icon}</span>
      <span className="lists-label" style={stagger(++row)}>
        {label}
      </span>
      {extras && !!options.count && (
        <span className="lists-count" style={stagger(row)}>
          {options.count}
        </span>
      )}
    </button>
  );
  const smartItems = [
    showToday &&
      listItem(
        "today",
        t("Oggi"),
        <Icon icon={faSun} />,
        smart === "today",
        () => selectSmart("today"),
        { className: "smart today", count: smartCounts?.today },
      ),
    showImportant &&
      listItem(
        "important",
        t("Importanti"),
        <Icon icon={faStar} />,
        smart === "important",
        () => selectSmart("important"),
        { className: "smart", count: smartCounts?.important },
      ),
  ].filter(Boolean);
  const storage =
    usage &&
    `${(usage.total.bytes / 1024 ** 2).toLocaleString(preferences.locale, {
      maximumFractionDigits: 1,
    })} MB${usage.quotaGb ? ` / ${usage.quotaGb} GB` : ""}`;
  return (
    <div
      className="glass-shell"
      data-lists={listsOpen ? "open" : "closed"}
      data-lists-mode={preferences.sidebarMode}
      data-detail={selectedTaskId || detailId ? "open" : undefined}
      data-mobile-menu={mobileOpen || undefined}
    >
      <ShellBackdrop />
      <Rail
        userName={userName}
        active={
          smart
            ? null
            : selectedProjectId === undefined
              ? { kind: "overview" }
              : selectedProjectId === null
                ? { kind: "unassigned" }
                : { kind: "project", id: selectedProjectId }
        }
        settingsTip={
          extras && storage ? `${t("Impostazioni")} · ${storage}` : undefined
        }
        onOverview={selectOverview}
        onProject={selectProject}
        onUnassigned={() => selectProject(null)}
        onNewProject={() => {
          setEditingProject(null);
          setProjectModal(true);
        }}
      />
      <section className="slab">
        {((listsOpen && overlay) || mobileOpen) && (
          <button
            className="lists-scrim"
            aria-label={t("Chiudi liste")}
            tabIndex={-1}
            onClick={closeOverlay}
          />
        )}
        <aside className="lists" aria-label={t("Navigazione")}>
          <button
            className="lists-item lists-toggle"
            aria-label={t(
              mobileOpen
                ? "Chiudi menu"
                : listsOpen
                  ? "Comprimi liste"
                  : "Espandi liste",
            )}
            aria-expanded={listsOpen}
            data-tip={listsOpen ? undefined : t("Espandi liste")}
            data-tip-side="right"
            onClick={() => {
              if (mobileOpen) setMobileOpen(false);
              else setPreference({ sidebarCollapsed: listsOpen });
            }}
          >
            <span className="lists-icon">
              <Icon icon={faAnglesRight} />
            </span>
            <span className="lists-label lists-context" style={stagger(0)}>
              {contextTitle}
            </span>
          </button>
          {smartItems}
          {smartItems.length > 0 && <hr className="lists-sep" />}
          {contextLists.map((list) =>
            listItem(
              list._id,
              list.title,
              <ListIcon list={list} />,
              !smart && list._id === selectedListId,
              () => selectList(list),
              { color: list.accentColor, count: list.openTaskCount },
            ),
          )}
          {listItem(
            "new",
            t("Nuova lista"),
            <Icon icon={faPlus} />,
            false,
            () => newList(),
            { className: "ghost" },
          )}
        </aside>
        <main
          className={`slab-main${preferences.view === "cards" && !smart ? " cards-mode" : ""}`}
        >
          <header className="slab-head">
            <button
              className="ghost-icon mobile-lists"
              aria-label={t("Apri menu")}
              onClick={() => setMobileOpen(true)}
            >
              <Icon icon={faListUl} />
            </button>
            <div className="slab-title">
              <h1>
                {headingIcon && (
                  <span
                    className="title-icon"
                    style={
                      smart
                        ? undefined
                        : ({
                            "--c": selectedList?.accentColor,
                          } as CSSProperties)
                    }
                  >
                    {headingIcon}
                  </span>
                )}
                {heading}
              </h1>
              {extras && !smart && (
                <p>
                  {contextTitle} · {contextLists.length}{" "}
                  {t("Liste").toLowerCase()}
                </p>
              )}
            </div>
            {searchOpen && (
              <label className="slab-search">
                <Icon icon={faMagnifyingGlass} />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  aria-label={t("Cerca nelle attività")}
                  placeholder={t("Cerca nelle attività")}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.stopPropagation();
                      closeSearch();
                    }
                  }}
                />
                <button
                  type="button"
                  className="ghost-icon"
                  aria-label={t("Chiudi ricerca")}
                  data-tip={t("Chiudi ricerca")}
                  data-tip-side="bottom"
                  onClick={closeSearch}
                >
                  <Icon icon={faXmark} />
                </button>
              </label>
            )}
            <OverflowMenu
              label={t("Altre azioni")}
              groups={menuGroups}
              className="ghost-icon"
            />
          </header>
          {(tagsOpen || tagIds.length > 0) && listView && tags.length > 0 && (
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
            </div>
          )}
          {error && (
            <p className="error slab-error" role="alert">
              {error}
            </p>
          )}
          <div className="slab-body">
            {isLoading ? (
              <div className="task-loading" />
            ) : smart ? (
              <SmartTaskPane
                view={smart}
                range={range}
                lists={lists}
                onNew={newTask}
                onEdit={editTask}
                onSelect={setSelectedTaskId}
                selectedId={selectedTaskId}
              />
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
                <button className="button" onClick={() => newList()}>
                  <Icon icon={faPlus} />
                  {t("Nuova lista")}
                </button>
              </div>
            ) : preferences.view === "list" ? (
              selectedList ? (
                <div
                  className="task-surface"
                  style={surfaceStyle(selectedList, preferences.useListColors)}
                >
                  {pane(selectedList, false)}
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
                        className="ghost-icon"
                        aria-label={`${t("Nuova attività")}: ${list.title}`}
                        data-tip={t("Nuova attività")}
                        data-tip-side="bottom"
                        onClick={() => newTask(list._id)}
                      >
                        <Icon icon={faPlus} />
                      </button>
                      {canManage(list) && (
                        <button
                          className="ghost-icon"
                          aria-label={`${t("Modifica lista")}: ${list.title}`}
                          data-tip={t("Modifica lista")}
                          data-tip-side="bottom"
                          onClick={() => {
                            setEditingList(list);
                            setListModal(true);
                          }}
                        >
                          <Icon icon={faGear} />
                        </button>
                      )}
                    </header>
                    {pane(list, true)}
                  </section>
                ))}
              </div>
            )}
          </div>
          {listView && selectedList && tab !== "completed" && (
            <TaskComposer
              listId={selectedList._id}
              onDetails={() => newTask(selectedList._id)}
            />
          )}
        </main>
      </section>
      {(selectedTaskId || detailId) && (
        <div
          className="detail-slot"
          data-closing={detailClosing || undefined}
          onAnimationEnd={(event) => {
            if (
              detailClosing &&
              (event.target as HTMLElement).classList.contains("task-detail")
            )
              setDetailId(null);
          }}
        >
          <TaskDetailPanel
            taskId={(selectedTaskId || detailId)!}
            onClose={() => setSelectedTaskId(null)}
            onEdit={(task) => {
              setSelectedTaskId(null);
              editTask(task);
            }}
            onAddSubtask={(task) => newTask(task.listId, task._id)}
            onOpenTask={setSelectedTaskId}
          />
        </div>
      )}
      <nav className="mobile-bar" aria-label={t("Navigazione")}>
        <button
          className="ghost-icon"
          aria-label={t("Liste")}
          onClick={() => setMobileOpen(true)}
        >
          <Icon icon={faListUl} />
        </button>
        {showToday && (
          <button
            className={`ghost-icon${smart === "today" ? " active" : ""}`}
            aria-label={t("Oggi")}
            onClick={() => selectSmart("today")}
          >
            <Icon icon={faSun} />
          </button>
        )}
        {selectedList && !smart && (
          <button
            className="ghost-icon"
            aria-label={t("Cerca")}
            onClick={openSearch}
          >
            <Icon icon={faMagnifyingGlass} />
          </button>
        )}
        <Link
          href="/settings"
          className="ghost-icon"
          aria-label={t("Impostazioni")}
        >
          <Icon icon={faGear} />
        </Link>
      </nav>
      <AdminModal
        open={listModal}
        title={t(editingList ? "Modifica lista" : "Nuova lista")}
        onClose={() => setListModal(false)}
        size="md"
      >
        <TodoListForm
          initial={editingList || { projectId: listProjectId }}
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
    </div>
  );
}
