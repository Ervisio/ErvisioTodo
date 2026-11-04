<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- lean-craft -->
## Working memory (lean-craft)
Project memory lives in `.context/`. At session start, after compact or clear, read `.context/INDEX.md` and `.context/now.md` unless they are already in context.
Read map/ and decisions.md only when the task touches them; never import them here.
Follow the lean-craft skill for token use, checkpoints, replies, subagents and code style.
<!-- /lean-craft -->
