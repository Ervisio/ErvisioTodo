# UI rework handoff

Purpose: Carry the approved UI direction into the existing app without repeating the design exploration.
Status: Mockup ported to app components 2026-11-04 (uncommitted). Shell, sidebar, TaskItem, docked TaskDetailPanel, OverflowMenu, taskActions.ts, Manrope via next/font/local app/fonts, blue presets in lib/themes.ts.
Approved: 008-albero-progetti / B Rientro pulito, decision 597c73e89cfa, 2026-11-04.
Artifacts: docs/design/ervisio-todo.html is a self-contained offline preview; docs/DESIGN.md explains the specification. Studio history is local and gitignored under .variant-studio/.
Direction: Minimal modern Material, Manrope, neutral surfaces, configurable blue primary. Logo in the top-left header; side-detail subtask checklist; aligned folder icons, right chevron, indented lists.
Interactions: Circular checkbox hover; task selection follows the open detail; animated filters, panels, dialogs and project disclosure. Closed project groups use inert; reduced-motion preference disables transitions.
Invariants: Preserve personal themes, configurable accents/list colors, Font Awesome, collapsible sidebar, List/Cards views, nested task semantics, sharing, assignments and existing authorization.
Constraints: User replaced designer with frontend-design. Use senior-craft, lean-craft, Variant Studio, stop-slop and transitions-dev where relevant.
Next: commit when user asks. Known gaps: no sidebar list counts (API lacks them); subtask summary costs 2 SWR fetches per row and hides when all subtasks done; no sliding tab pill/close animation; breadcrumb removed; list tabs only <=760px.
Verification completed: Responsive screenshots at 1440/1280/390; dark/long text; selections, detail, completion cascade, ancestor reopen, views, local capture/search, states, hierarchy, reversible disclosure, inert, collapsed sidebar and reduced motion. Offline exported preview also rendered and interacted without JS errors.
Verification limit: App verified via e2e 3/3 (theme assertions updated to blue/#202631), unit 28/28, typecheck, build (needs AUTH_SECRET>=32), Playwright MCP QA 1440/1280/1000/390 light+dark. No screen-reader pass.
Gotchas: Preview changes live only in browser memory; share/settings/edit controls are demonstrative. The top bar does not establish Ervisio host contracts. Studio startup layoutCompare error did not block previews or feedback; no skill code changed.
Publication: No dependencies added. AGENTS.md, .gitignore and initial .context files were already dirty when the design task started.
Related: map/todo.md, map/settings-ui.md, map/deployment.md, decisions.md.
