# Plugin admin API contract (2026-11-04)

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
`deploy/ervisio-setup.sh --url <url>` which writes .env with AUTH_SECRET/AUTH_URL/PLUGIN_SOCKET and `docker compose
up -d`), start/stop/restart and logs via Docker API (compose project `ervisiotodo`, service `app`), update when
`sdk.plugin.version` > `status.version` (unit `ervisio-todo-update`: back up data/.env, set ERVISIO_VERSION in .env,
`docker compose pull app && up -d`). Server down with existing container → down banner, never the wizard.
Docker only (no native package). Caddy: the stack's own `compose.caddy.yaml` or the host's; no Address page in v1.
