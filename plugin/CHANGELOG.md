# Changelog

## 0.6.0 - 2026-11-16

- New outline look: pure black canvas with thin lines instead of glass, no gradients, and a rail without background. Light and preset themes follow the same language.
- The accent colour from Settings drives every highlight, and text on filled accent surfaces now switches between black and white for readable contrast.
- Header with a time-of-day greeting and a progress ring for the open list; due-date chips on every task (today, tomorrow, weekday, date) and a subtask chip.
- Lists column with Today and Important on top, the project name with a "+" for a new list, and counts.
- The composer no longer draws an outline while you type.
- Fix: clicks on the rail, especially Settings, were often ignored because the app kept rewriting the URL hundreds of times per second and cancelled the pending navigation.
- Windows desktop client (Wails): a native window around your server, with server address check, window state and external links in the browser. Built from desktop/.

## 0.5.0 - 2026-11-15

- Essential workspace: the lists column is always open and shows the project name and list names; the collapse toggle and the overlay or push setting are gone.
- Task rows show the check and the title, plus a short due word only for today or overdue tasks; the star appears when set or on hover.
- The composer sits right after the last task, and completed tasks expand in place from a single "N completed" line. Completing a task offers an undo.
- The detail panel is editable in place: title, due date with Today, Tomorrow and Next week, note and subtasks. The full editor, AI rewrite and delete live in its menu.
- No icon animation and a static background; only short fades remain when menus and panels open.
- Home screen with today's tasks by project, a new login and registration screen, and a persistent settings layout.
- External backup storage on S3, SFTP and SMB.

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
