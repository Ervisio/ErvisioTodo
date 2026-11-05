# Workspace settings and appearance

Purpose: Admin policies, personal themes, initial rendering and capability-driven controls.
Entry points: app/settings/page.tsx; components/SettingsForm.tsx; components/LimitSettings.tsx; components/ThemeSettings.tsx; components/Preferences.tsx; app/layout.tsx.
Flow: admin form → /api/admin/settings → lib/server/settings.ts:saveSettings → SQLite; personal appearance → PreferencesProvider → localStorage and SSR-readable cookies → layout/theme CSS variables.
Invariants:

- Workspace settings are admin-only; partial updates preserve omitted values and must leave at least one configured authentication method active.
- lib/server/config.ts:publicConfig exposes capabilities, configured limits and available providers without secrets; hooks/useCapabilities.ts supplies UI capabilities.
- Provider availability combines environment credentials, environment defaults and saved settings; merely enabling a provider is insufficient without credentials.
- Theme and locale preferences are browser-local, distinct from workspace policies. Initial layout reads cookies to match the client appearance.
- lib/themes.ts defines presets, themeVariables, validCustomTheme, parseCustomThemes and resolveTheme; validate imported colors and IDs before applying CSS. Light and dark defaults are blue (accent #245ac2 and #adc6ff).
- Manrope is self-hosted: app/layout.tsx loads app/fonts/manrope-{400,500,600}.ttf with next/font/local as --font-manrope on <html>, and globals.css uses it first. Do not add a Google Fonts link.
- List colors are an explicit appearance opt-in; preserve this when changing list branding or theme precedence.
- A list backgroundColor of "" inherits the personal theme when list colors are enabled; a valid HEX value is an explicit override. The list accent still applies with an inherited background.
- Project and list branding use the shared components/ColorInput picker, including hex entry and preset swatches; avoid native color inputs that diverge across browsers.
- Workspace settings use a fixed save bar following approved Variant Studio direction 009 A. Dirty state compares the draft with fetched settings; Annulla restores that snapshot, and saving stays disabled when clean or busy.
- Upload, storage, sharing and token limits are enforced by server services as well as surfaced in forms.
  Gotchas: Changing theme persistence requires updating both PreferencesProvider and the cookie-based initial layout to avoid inconsistent first render.
  References: docs/THEMES.md describes themes; lib/i18n.ts holds translations; app/globals.css defines application styles.
  Gotchas (theme defaults): tests/app.spec.ts asserts the default blue palette (#202631 for dark); update it together with the lib/themes.ts presets.
  Verification: tests/themes.test.ts covers preset contrast, custom-theme validation and color conversion; tests/todo.test.ts covers settings merge and policy limits; tests/app.spec.ts covers theme persistence/import/export, list colors and mobile overflow.
  Related: map/todo.md, map/auth-api.md, map/storage.md, map/deployment.md.
