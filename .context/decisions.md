# Decisions (date · decision · why)

2026-11-04 · Approved round 008-albero-progetti B, Rientro pulito · Material workspace, subtasks in side detail, indented project lists and animated folder disclosure; see docs/DESIGN.md and docs/design/ervisio-todo.html.
2026-11-04 · Use frontend-design instead of designer for this rework · Explicit user instruction; keep senior-craft, Variant Studio, stop-slop and transitions-dev for motion.
2026-11-04 · Deliver mockups before changing app code · Approved preview establishes the UI direction; React implementation and Ervisio plugin packaging remain subsequent phases.
2026-11-04 · Docked detail panel replaces inline subtask expansion · Matches approved mockup; .sub-summary opens the panel, shared logic in taskActions.ts.
2026-11-04 · Default accent blue #245ac2 / dark sheet #202631 · Mockup tokens; e2e theme assertions updated deliberately.
2026-11-04 · Keep npm lockfile churn out of commits · npm on Windows strips libc:glibc fields, risking Linux Docker installs.
2026-11-04 · Package as Ervisio plugin mirroring ErvisioRepo (unix-socket admin API, Docker-only install) · Same contract as repo plugin; see .context/plugin-contract.md.
2026-11-04 · Repo and GHCR image public · Registry register workflow and anonymous docker pull need them.
2026-11-04 · If Pages deploy hangs in Ervisio/plugins Publish, dispatch a fresh run instead of rerunning · Reruns reuse the stuck deployment for the same SHA.
2026-11-09 · Approved round 005-lists-motion B "Sopra" (glass shell redesign) · Discord + MS To Do mix: AMOLED black with slow blue/violet blurred spots, acrylic slab, borderless project rail, lists column collapsed to icons by default and opening as an overlay sheet (push mode A selectable in settings), one "…" menu in the header, icons with edge-aware tooltips, smart views only when non-empty, extra info only when the user enables it. Supersedes the 2026-11-04 Material direction.
2026-11-09 · Approved round 006-settings-pages A (sections column) · Settings, account, workspace admin and API docs share one glass sheet with separate URLs; Figtree + JetBrains Mono replace Manrope, self-hosted.
