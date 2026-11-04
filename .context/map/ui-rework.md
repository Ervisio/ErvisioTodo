# UI rework handoff

Purpose: Carry the approved UI direction into the existing app without repeating the design exploration.
Status: Mockups completed and approved; no application components changed.
Approved: 008-albero-progetti / B Rientro pulito, decision 597c73e89cfa, 2026-11-04.
Artifacts: docs/design/ervisio-todo.html is a self-contained offline preview; docs/DESIGN.md explains the specification. Studio history is local and gitignored under .variant-studio/.
Direction: Minimal modern Material, Manrope, neutral surfaces, configurable blue primary. Logo in the top-left header; side-detail subtask checklist; aligned folder icons, right chevron, indented lists.
Interactions: Circular checkbox hover; task selection follows the open detail; animated filters, panels, dialogs and project disclosure. Closed project groups use inert; reduced-motion preference disables transitions.
Invariants: Preserve personal themes, configurable accents/list colors, Font Awesome, collapsible sidebar, List/Cards views, nested task semantics, sharing, assignments and existing authorization.
Constraints: User replaced designer with frontend-design. Use senior-craft, lean-craft, Variant Studio, stop-slop and transitions-dev where relevant.
Next: Read map/todo.md and map/settings-ui.md, relevant installed Next.js guides, TodoApp, AppHeader, TaskItem, TaskDetailPanel and globals.css before translating the mockup into existing components.
Verification completed: Responsive screenshots at 1440/1280/390; dark/long text; selections, detail, completion cascade, ancestor reopen, views, local capture/search, states, hierarchy, reversible disclosure, inert, collapsed sidebar and reduced motion. Offline exported preview also rendered and interacted without JS errors.
Verification limit: Checks cover mockups only; no new app build, authenticated E2E, screen-reader or plugin integration verification in this phase.
Gotchas: Preview changes live only in browser memory; share/settings/edit controls are demonstrative. The top bar does not establish Ervisio host contracts. Studio startup layoutCompare error did not block previews or feedback; no skill code changed.
Publication: No dependencies added. AGENTS.md, .gitignore and initial .context files were already dirty when the design task started.
Related: map/todo.md, map/settings-ui.md, map/deployment.md, decisions.md.
