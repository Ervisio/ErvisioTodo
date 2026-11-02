# Origine dei componenti

Estratti da KFScripts/FusionHub, commit `ad365d74e3e6f1c5797b289d2ee70c633bbd838c` (branch main), il 2 novembre 2026.

Componenti originali: `components/admin/todo/*`, `components/admin/MarkdownEditor.tsx`, `components/admin/AdminFields.tsx`, `components/admin/ImageUploadField.tsx`, `components/ui/Icon.tsx`, `hooks/useSounds.ts`, `lib/http/readJsonResponse.ts`, `types/todo.ts`; la pagina Todo originale è in `components/TodoApp.tsx`.

Il servizio, il database SQLite, l'autenticazione, i controlli di accesso, il branding e il deployment sono adattamenti per ErvisioTodo. Nessun database, credenziale o contenuto utente di FusionHub è stato importato. Il package upstream dichiara ISC; il repository è privato: conservare le autorizzazioni del titolare e non redistribuire pubblicamente senza verificarle.

## Impostazioni e progetti (0.2.0)

Fonte funzionale: Ervisio/ErvisioDrive, commit `e6d56e30ee5c3e1ad7209dd794e4b60e8aa72cb7`, verificato dal branch main il 2 novembre 2026. Riferimenti: `components/SettingsPanel.tsx`, `components/LimitSettings.tsx`, `models/WorkspaceSettings.ts`, `lib/settings.ts`, `components/LocaleProvider.tsx`. Preferenze, generali, quote, limiti, metodi di autenticazione e policy API/condivisione sono adattati alle attività; nessun database o segreto di Drive è stato importato.

Direzione UI approvata: Variant Studio `002-progetti-todo-remix/a` (Albero flessibile), con hamburger, icone FontAwesome e senza messaggio fisso di salvataggio.
