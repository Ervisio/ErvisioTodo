# Changelog

## 0.4.0 - 2026-11-09

- New glass interface: AMOLED dark theme with slow blue and violet background spots, a borderless project rail and one acrylic panel for lists and tasks.
- Lists column collapsed to icons by default; it opens over the tasks or beside them (setting).
- "Today" and "Important" views across all lists, shown only when they contain tasks.
- Minimal task rows with an inline composer, a single actions menu, edge-aware tooltips and optional extra details.
- Settings, account, workspace administration and API docs in one section column; workspace administration moved to /settings/workspace.
- Self-hosted Figtree and JetBrains Mono fonts replace Manrope.

## 0.3.3 - 2026-11-05

- Fix Docker update and install scripts being altered by systemd environment expansion: execute private script files instead of passing shell source in ExecStart.
- Preserve the existing AUTH_SECRET during configuration recovery and add regression coverage for the complete systemd command boundary.

## 0.3.2 - 2026-11-05

- Preserve Docker environment customizations across updates by recovering existing container settings into the persistent .env file once.
- Add deployment settings for the public URL, host port, domains, OAuth, SMTP, AI, upload defaults and custom environment variables.
- Mask secrets, validate and back up configuration changes, reject stale drafts and allow retrying container recreation.
- Keep the internal Docker port fixed when changing the host port and preserve deployment drafts across navigation.

## 0.3.1 - 2026-11-05

- Fix mutually exclusive Overview and Favorites selection.
- Let new lists inherit the selected theme background, with an option to reset existing lists.
- Replace native list and project color pickers with the shared picker, preset swatches and HEX input.
- Keep the settings save bar visible while scrolling, with unsaved status and discard controls.

## 0.3.0 - 2026-11-04

- First version: install ErvisioTodo with Docker, start, stop, restart, live logs, updates, workspace settings, test email and a usage widget.
