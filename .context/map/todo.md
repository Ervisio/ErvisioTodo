# Tasks, projects and sharing

Purpose: Workspace navigation, task trees, project membership and read-only public links.
Entry points: app/page.tsx; app/l/[slug]/page.tsx; app/p/[slug]/page.tsx; app/s/[token]/page.tsx; components/TodoApp.tsx.
Flow: pageUser and route selection → TodoApp/SWR → /api/admin/todo/* → lib/server/todo.ts, projects.ts, task-transfer.ts or shares.ts → SQLite.
UI: components/admin/todo/ holds forms, task panes, detail panels, tags and ShareManager; TodoApp owns project/list navigation, sidebar search query and mutations.
Task rows: TaskItem never expands children inline. Rows with subtasks show a .sub-summary button that calls onTaskClick, which opens the docked TaskDetailPanel (subtask checklist, onOpenTask to walk the tree). TodoApp selectedTaskId drives the row highlight through ListTaskPane selectedId.
Shared actions: components/admin/todo/taskActions.ts (useTaskActions: complete, reopen, remove, revalidate, removeFromLists; useSubtasks: open and completed children) is used by TaskItem and TaskDetailPanel. Reuse it instead of duplicating fetch or SWR mutate logic.
Overflow menu: components/ui/OverflowMenu.tsx renders TodoApp's "Altre azioni" groups (tag, list and project actions).
Search: opened from the "…" menu or Ctrl/Cmd+K as a field in the slab header; TodoApp query state goes to ListTaskPane as ?q=. No window event; do not reintroduce ervisio:search.
Smart views: lib/server/todo.ts smartTasks/smartCounts. GET /api/admin/todo/tasks/smart?from&to returns {today, important}; GET /api/admin/todo/tasks?smart=today|important[&from&to] returns open tasks across visible lists (any depth). The client sends its local day as from/to. "Oggi"/"Importanti" render only when their count > 0 (SmartTaskPane) and TodoApp leaves an emptied view.
Creation: TaskComposer (list view) posts {listId,title} on Enter; its side button (aria "Nuova task") opens TaskDetailModal. Cards keep ListTaskPane's add row (showAdd).
Lists column "Nuova lista" calls TodoApp newList() for the current context.
Invariants:

- TodoApp selectedProjectId is tri-state: undefined means overview, null means standalone lists, string means one project. Route initialization waits for lists.
- Overview and Favorites are exclusive navigation tabs: choosing Overview resets the active tab and tag filters; choosing Favorites clears task selection. Do not mark Overview active while the favorites filter is selected.
- Service-level getList/listAccess and projectAccess enforce ownership/membership and token resource policy. An empty member list never makes a resource public, even for admins.
- Project members inherit access to its lists; project owners can manage member-owned lists without taking ownership.
- Deleting a project detaches its lists and preserves tasks. Removing membership prunes assignments that are no longer allowed.
- Task parents and tags must belong to the task's list; assignments require membership.
- Completion cascades down the tree; reopening a child reopens ancestors. Reordering validates all resources atomically.
- task-transfer.ts:transferTask remaps subtree parents and clones private files across lists; moves cannot introduce cycles.
- Public shares require list ownership and workspace sharing permission; only the digest is stored and the raw URL is returned once.
- Shared output is read-only, excludes assignments/attachments and respects expiry, revocation and global sharing disablement.
- Subtasks are visible only in the detail panel; list rows show count and progress.
- ListTaskPane takes no onDeleted callback. After a delete, taskActions drops the task from every cached task list and revalidates.
  AI: lib/server/ai.ts:aiGenerate proposes content; aiRefactor saves changes and optional subtasks. It sends list/task text to the configured chat/completions service, uses a 45-second timeout and validates JSON output. Production endpoints require HTTPS.
  Gotchas: Keep public-share rendering separate from authenticated list data; do not serialize unrestricted task objects into shared responses. Counts come from SQL, not per-row fetches: the lists API adds openTaskCount (open top-level tasks, as the active tab) and tasksFor adds subtaskCount/subtaskDoneCount (direct children) beside childCount (open children). useTaskActions.revalidate refreshes task keys and the lists key.
  Verification: tests/todo.test.ts covers membership, trees, transfer, share filtering and project deletion; tests/app.spec.ts covers project navigation, task editing and desktop/mobile flows.
  Related: map/auth-api.md, map/storage.md, map/settings-ui.md.
