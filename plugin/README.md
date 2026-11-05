# ErvisioTodo plugin for Ervisio

Installs, runs and updates ErvisioTodo on a Linux machine with Docker, from the Ervisio web console: overview with
counts and live logs, the workspace settings (General, Space and limits, Authentication, API and security), a mail
test, and updates. It talks to the app over the unix socket `/run/ervisio-todo/api.sock` (contract:
`.context/plugin-contract.md`) and to Docker through `/var/run/docker.sock`.

SDK `@ervisio/plugin-sdk` v0.3.0 (contract version 3). `plugin/manifest.json` declares every command and API the
plugin may use; its `version` must equal `package.json` and the release tag.

## Dev loop

```sh
cd plugin
npm install
npm run typecheck
npm run build            # tsc, vite build, then copies plugin/ into dist/todo/
```

1. Copy `dist/todo/` into the `plugins/` folder of an Ervisio checkout (the folder name must be the plugin id, `todo`).
2. Run the Ervisio core with `--dev`; it loads the folders in `./plugins`.
3. For a rebuild on every save, run `npm run dev` (copy once, then `vite build --watch`) and reload the page.

`npm run pack` writes `dist/todo-<version>.tar.gz` and its `.sha256` (the registry signs and publishes it).

## Notes

- Settings → Deployment manages the public URL, host port, domains, OAuth, SMTP, AI, limits and custom environment variables. Save writes `/opt/ervisio-todo/.env`, validates Compose and recreates the app; a failed restart can be retried without saving again. Workspace policies stored in SQLite still override their environment defaults.
- On the first configuration read or update, custom values in the existing container are recovered into `.env`. Live values take precedence during this initial migration; subsequent changes use the persisted file. Image defaults and managed runtime variables are excluded. Missing values that were already lost in an earlier container update must be restored from a backup.
- Secrets, including custom variable values, are never returned to the page. Leave their input blank to retain them or use Clear to remove a value. Environment files and backups are private; writes and updates share a lock, and stale drafts cannot overwrite a newer file.
- `deploy/plugin-config.mjs` and `deploy/plugin-update.sh` are embedded into the manifest by `npm run plugin:commands` from the repository root. Run it after changing either source; plugin builds reject stale generated commands. The commands use Node from the installed Docker image and require `flock` on the host.

- React APIs must never run at module top level: they are created lazily after `activate()` calls `setReact`.
- `src/kit.ts` is adapted from Ervisio/plugin-caddy (MIT, see `LICENSE-plugin-caddy`).
- `vite.config.ts` turns off PostCSS lookup so the app's Tailwind config in the parent folder is not applied.
