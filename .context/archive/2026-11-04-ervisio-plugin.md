# Now

Goal: ErvisioTodo as Ervisio plugin. Released v0.3.0 (main c91edf7, PR #1): assets todo-0.3.0.tar.gz(+sha256), image ghcr.io/ervisio/ervisio-todo:0.3.0 (amd64/arm64). Repo made public 2026-11-04.
Pending: GHCR package still private (user via web settings); catalog PR Ervisio/plugins#45 open, merge after image is public.
Untested: real unix socket, Docker install/update, live Ervisio core (Linux only).
Release flow: push vX.Y.Z tag (= package.json = plugin manifest) → .github/workflows/release.yml (SDK plugin-release, working-directory plugin, + image job).
Open (older): e2e themes -g alone fails (pre-existing); local Node 24.12 < 24.13.
QA: node tests/fixtures/serve.mjs (3137) + .playwright-mcp/seed.mjs; owner / "Strong test passphrase 2026!"; log in via API request.

Closed 2026-11-04: GHCR public, Ervisio/plugins#45 merged, catalog lists todo 0.3.0 trust team (Publish 41919524511; earlier Pages deploys hung on same SHA, fresh dispatch fixed it). Registry branches pruned, delete_branch_on_merge on.
