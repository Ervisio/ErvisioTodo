# Tasks, projects and sharing

Purpose: Workspace navigation, task trees, project membership and read-only public links.
Entry points: app/page.tsx; app/l/[slug]/page.tsx; app/p/[slug]/page.tsx; app/s/[token]/page.tsx; components/TodoApp.tsx.
Flow: pageUser and route selection → TodoApp/SWR → /api/admin/todo/* → lib/server/todo.ts, projects.ts, task-transfer.ts or shares.ts → SQLite.
UI: components/admin/todo/ holds forms, task panes, detail panels, tags and ShareManager; TodoApp owns project/list navigation and mutations.
Invariants:

- TodoApp selectedProjectId is tri-state: undefined means overview, null means standalone lists, string means one project. Route initialization waits for lists.
- Service-level getList/listAccess and projectAccess enforce ownership/membership and token resource policy. An empty member list never makes a resource public, even for admins.
- Project members inherit access to its lists; project owners can manage member-owned lists without taking ownership.
- Deleting a project detaches its lists and preserves tasks. Removing membership prunes assignments that are no longer allowed.
- Task parents and tags must belong to the task's list; assignments require membership.
- Completion cascades down the tree; reopening a child reopens ancestors. Reordering validates all resources atomically.
- task-transfer.ts:transferTask remaps subtree parents and clones private files across lists; moves cannot introduce cycles.
- Public shares require list ownership and workspace sharing permission; only the digest is stored and the raw URL is returned once.
- Shared output is read-only, excludes assignments/attachments and respects expiry, revocation and global sharing disablement.
  AI: lib/server/ai.ts:aiGenerate proposes content; aiRefactor saves changes and optional subtasks. It sends list/task text to the configured chat/completions service, uses a 45-second timeout and validates JSON output. Production endpoints require HTTPS.
  Gotchas: Keep public-share rendering separate from authenticated list data; do not serialize unrestricted task objects into shared responses.
  Verification: tests/todo.test.ts covers membership, trees, transfer, share filtering and project deletion; tests/app.spec.ts covers project navigation, task editing and desktop/mobile flows.
  Related: map/auth-api.md, map/storage.md, map/settings-ui.md.
