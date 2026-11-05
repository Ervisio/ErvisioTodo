# Plugin admin API contract

Served on the unix socket `/run/ervisio-todo/api.sock` (mode 0660), consumed by `plugin/src/api/todo.ts`.
Mirrors ErvisioRepo (`D:\Projects\ErvisioRepo\.context\plugin-contract.md`).

Transport: `scripts/plugin-socket.mjs` listens on `PLUGIN_SOCKET` (unset = disabled), accepts only `/api/plugin/*`
(else 404), caps bodies at 1 MiB, strips any incoming `x-ervisio-plugin` and forwards to the Next server on
127.0.0.1:PORT adding `x-ervisio-plugin: <secret>`. The secret is 32 random bytes hex, generated per process start
and handed to Next via `PLUGIN_SECRET` env. Route handlers under `app/api/plugin/` compare it in constant time;
missing/wrong secret or no PLUGIN_SECRET → 404 like an unknown route. Plugin sends no secret.

All JSON camelCase. Errors `application/problem+json` `{title, status, detail}`; 422 adds `errors: [{path, msg}]`
(path = settings key, from zod issues).

## GET /api/plugin/status

`{ version, startedAt, publicUrl, restartRequired: false, mailEnabled, providers: {credentials, google, discord,
cognito}, counts: { users, lists, tasks, openTasks }, storage: { usedBytes, quotaBytes|null } }`

## GET /api/plugin/settings

`{ values: {...}, defaults: {...}, restartRequired: false }`. Keys: every `workspaceSchema` key
(siteName, defaultLocale, uploadMaxMb, storageQuotaGb, userQuotaGb, maxFilesPerUpload, maxAttachmentsPerTask,
editorMaxMb, writeRequestsPerMinute, statsRetentionDays, sharingEnabled, maxShareLifetimeHours, apiEnabled,
membersCanCreateTokens, defaultTokenLifetimeDays, maxTokenLifetimeDays, apiRequestsPerMinute) plus auth flags
credentials, google, discord, cognito, registration. Also `configured: {google, discord, cognito}` (env credentials
present). Settings live in SQLite and apply immediately: restartRequired is always false.

## PUT /api/plugin/settings

Body `{ values: {...changed keys} }` → `lib/server/settings.ts:saveSettings`. Zod error → 422 with per-key errors;
policy error (insist 400, e.g. last auth method) → 422 with `errors: [{path: "", msg}]`. Answers like GET.
Records activity actor "ervisio-plugin".

## POST /api/plugin/mail/test

Body `{ to }`. Sends a test mail through SMTP_URL. 200 `{sent: true}`; 422 when SMTP_URL unset or `to` invalid;
502 with SMTP error as detail.

## Done in the plugin, not the API

Install (systemd-run unit `ervisio-todo-install`: download release v{version} to /opt/ervisio-todo, run
`deploy/ervisio-setup.sh --url <url>` which writes initial .env and starts Compose), start/stop/restart and logs via
Docker API (compose project `ervisiotodo`, service `app`), update when `sdk.plugin.version` > `status.version`
(unit `ervisio-todo-update`). Update first recovers existing custom runtime env from the live container, then writes
ERVISIO_VERSION to persisted `.env` before pulling and starting. The existing app image supplies Node to the helper;
the host needs no Node installation.

## Docker deployment configuration

The deployment page calls admin SDK commands `configuration-read`, `configuration-save`, and
`configuration-apply` (`plugin/src/api/deployment.ts`). It never sends configuration values over HTTP or the Unix
socket. Save stages a private JSON request through the SDK file API at
`/opt/ervisio-todo/.plugin-config/requests/<id>.json`; the admin command consumes and removes it.

On first read/update, one-time recovery copies live container environment values that differ from image defaults into
`.env`, taking precedence over previous file values for those recovered keys. After the migration marker is written,
persisted `.env` is authoritative. Protected runtime variables and PORT are excluded from recovery. Reads return
non-secret values only; known secrets and every unknown key are masked and represented by configured status.

Configuration operations share a non-blocking `flock` lock. Save checks the submitted SHA-256 revision, validates
values, backs up `.env`, atomically replaces it, and restores the backup when `docker compose config` rejects the
result. The page then applies by validating Compose, recreating the app, and waiting for health. Host PORT selects
the published host port; the app always listens on container port 3000. Runtime/socket variables, ERVISIO_VERSION,
and Compose/Docker/Buildx environment keys are read-only.

`scripts/sync-plugin-commands.mjs` generates manifest command definitions from `deploy/plugin-config.mjs` and
`deploy/plugin-update.sh`. Run `npm run plugin:commands` after editing those sources; plugin build runs `--check`
and fails if the generated manifest is stale.

Server down with existing container → down banner, never the wizard. Docker only (no native package). Caddy: the
stack's own `compose.caddy.yaml` or the host's; no Address page in v1.
