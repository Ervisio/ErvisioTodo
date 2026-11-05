# Changelog

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
