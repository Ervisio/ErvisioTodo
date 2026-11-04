/** UI strings of the plugin, registered with sdk.registerStrings(). Keys are short ids; {name} is a variable. */
export const strings: Record<"en" | "it", Record<string, string>> = {
  en: {
    retry: "Retry",
    cancel: "Cancel",
    on: "On",
    off: "Off",

    "nav.label": "ErvisioTodo",
    "nav.overview": "Overview",
    "nav.settings": "Settings",
    "nav.maintenance": "Maintenance",

    "lead.settings":
      "The workspace settings of ErvisioTodo. Changes apply as soon as you save them; no restart is needed.",
    "lead.maintenance":
      "Update ErvisioTodo and see where the installation keeps its files and data.",

    "sec.general": "General",
    "sec.limits": "Space and limits",
    "sec.auth": "Authentication",
    "sec.api": "API and security",
    "set.sections": "Settings sections",

    "head.updating": "Updating to v{v}",
    "head.notAnswering": "Not answering",
    "head.stoppedAt": "Stopped at {time}",
    "head.stopped": "Stopped",
    "head.runningFor": "Running for {d}",
    "head.running": "Running",
    "head.docker": "v{v} on Docker",
    "head.available": "v{v} available",
    "head.open": "Open the app",

    "bar.unsaved.one": "1 change not saved",
    "bar.unsaved.other": "{n} changes not saved",
    "bar.immediate": "Saved changes apply at once.",
    "bar.discard": "Discard",
    "bar.save": "Save settings",

    "admin.title": "Administrator rights needed",
    "admin.text":
      "Unlock administrator rights in Ervisio to manage ErvisioTodo, then try again.",
    "admin.unlock": "Unlock",
    "error.title": "Something went wrong",
    "error.down": "ErvisioTodo does not answer",

    "ov.service": "Service",
    "ov.active": "Active",
    "ov.latency": "answers in {ms} ms",
    "ov.users": "People",
    "ov.lists": "{n} lists",
    "ov.tasks": "Tasks",
    "ov.open": "{n} open",
    "ov.space": "Attachments",
    "ov.spaceOf": "of {quota}",
    "ov.noQuota": "No total limit",
    "ov.containers": "Containers",
    "ov.access": "Access",
    "ov.web": "Web address",
    "ov.noUrl": "No public address yet",
    "ov.signin": "Sign-in methods",

    "prov.credentials": "Password",
    "prov.google": "Google",
    "prov.discord": "Discord",
    "prov.cognito": "AWS Cognito",

    "ct.unhealthy": "Unhealthy",
    "ct.starting": "Starting",
    "ct.healthy": "Healthy",
    "ct.running": "Running",
    "ct.restarting": "Restarting",
    "ct.exited": "Exited ({code})",
    "ct.stopped": "Stopped",

    "down.notAnswering": "The app does not answer",
    "down.notAnsweringText":
      "The container {name} is running but its administration socket does not answer. It may still be starting; the last log lines are below.",
    "down.stoppedAt": "Stopped at {time}",
    "down.stopped": "ErvisioTodo is stopped",
    "down.exitCode":
      "The container {name} exited with code {code}. The last log lines are below.",
    "down.text":
      "The container {name} is not running. The last log lines are below.",

    "svc.restart": "Restart",
    "svc.start": "Start",
    "svc.stop": "Stop",
    "svc.stopTitle": "Stop ErvisioTodo?",
    "svc.stopText":
      "Nobody can use the app until it is started again. Nothing is deleted.",
    "svc.noInstall": "No installation was found.",
    "svc.restarted": "ErvisioTodo restarted",
    "svc.restartFailed": "The restart failed",
    "svc.started": "ErvisioTodo started",
    "svc.startFailed": "It could not be started",
    "svc.stopped": "ErvisioTodo stopped",
    "svc.stopFailed": "It could not be stopped",
    "svc.timeout": "ErvisioTodo did not answer in time.",

    "logs.title": "Log",
    "logs.level": "Level",
    "logs.all": "All",
    "logs.warn": "Warnings",
    "logs.err": "Errors",
    "logs.pause": "Pause",
    "logs.resume": "Resume",
    "logs.copy": "Copy",
    "logs.copied": "Log copied",
    "logs.empty": "No output yet.",
    "logs.failed": "The log stream stopped: {e}. Trying again.",

    "up.available": "ErvisioTodo v{v} is available",
    "up.from": "The app runs v{v}",
    "up.view": "See the update",
    "up.latest": "ErvisioTodo is up to date (v{v})",
    "up.latestText": "It runs the version that matches this plugin.",
    "up.to": "Updating to v{v}",
    "up.notes": "Release notes",
    "up.update": "Update",
    "up.backup": "Save a copy of .env",
    "up.pull": "Download version {v}",
    "up.up": "Restart the containers",
    "up.check": "Wait for the app to answer",
    "up.done": "ErvisioTodo is now v{v}",
    "up.failed": "The update did not finish",
    "up.confirmTitle": "Update to v{v}?",
    "up.confirm":
      "The .env file is copied next to itself, the new image is downloaded and the app restarts, which takes a short while. Your data lives in a Docker volume and is not touched.",

    "files.title": "Files and data",
    "files.text": "Where this installation lives on the machine.",
    "files.dir": "Folder",
    "files.env": "Settings file",
    "files.data": "Data volume",
    "files.image": "Image",
    "files.envNote":
      "Back up the data volume (the SQLite database and the attachments) before risky changes. Sign-in secrets, SMTP and AI settings are in the .env file; restart the app after changing them.",

    "card.workspace": "Workspace",
    "card.info": "This installation",
    "card.attachments": "Attachments and space",
    "card.limitsHelp":
      "Server takes the value from the installation; Unlimited removes the limit set by the app.",
    "card.signin": "Sign-in and sign-up",
    "card.mail": "Mail",
    "card.tokens": "API tokens",
    "card.sharing": "Public links",

    "info.space": "Space used",
    "info.spaceOf": "{used} of {quota}",
    "info.access": "Main address",
    "info.smtp": "SMTP",
    "info.configured": "Configured",
    "info.notConfigured": "Not configured",

    "auth.callback": "Callback",
    "auth.secretsNote":
      "Provider secrets stay in the server environment (.env). After changing them, restart the app.",

    "mail.to": "Send a test email",
    "mail.testText":
      "Sends a message through the SMTP server set in the installation.",
    "mail.off":
      "SMTP is not configured. Set SMTP_URL in the .env file and restart the app to send mail.",
    "mail.send": "Send",
    "mail.sent": "A test email was sent to {to}.",

    "set.default": "Default {v}",
    "set.saved": "Settings saved",
    "set.refused": "The settings were not saved",
    "set.loadFailed": "The settings could not be read",
    "set.offline": "The app does not answer",
    "set.offlineText":
      "Settings can be read and saved only while ErvisioTodo is running. Start it from the Overview.",

    "lim.server": "Server",
    "lim.limit": "Limit",
    "lim.unlimited": "Unlimited",
    "lim.mode": "mode",
    "lim.envHint": "Uses the installation default",
    "lim.offHint": "No limit set by the app",

    "unit.GB": "GB",
    "unit.MB": "MB",
    "unit.files": "files",
    "unit.perMin": "/min",
    "unit.days": "days",
    "unit.hours": "hours",

    "chk.required": "A value is required.",
    "chk.maxLen": "At most {n} characters.",
    "chk.number": "Enter a number.",
    "chk.positive": "Enter a number above 0, or choose Unlimited.",
    "chk.min": "At least {n}.",
    "chk.int": "Enter a whole number.",
    "chk.tokenOrder": "The default lifetime is longer than the maximum.",

    "f.siteName": "Workspace name",
    "f.siteName.h": "Shown in the app header and in emails.",
    "f.defaultLocale": "Default language",
    "f.defaultLocale.h": "Used for people who have not chosen a language yet.",
    "opt.defaultLocale.it": "Italiano",
    "opt.defaultLocale.en": "English",

    "f.storageQuotaGb": "Total space",
    "f.storageQuotaGb.h": "Space taken by the attachments of everyone.",
    "f.userQuotaGb": "Quota per person",
    "f.userQuotaGb.h": "Space for the attachments each person uploads.",
    "f.uploadMaxMb": "Largest attachment",
    "f.uploadMaxMb.h": "Larger files are refused by the server.",
    "f.maxFilesPerUpload": "Files per upload",
    "f.maxFilesPerUpload.h": "How many files can be uploaded together.",
    "f.maxAttachmentsPerTask": "Attachments per task",
    "f.maxAttachmentsPerTask.h": "The most attachments one task can hold.",
    "f.editorMaxMb": "Description size",
    "f.editorMaxMb.h": "Largest Markdown text of a task.",
    "f.writeRequestsPerMinute": "Writes per minute",
    "f.writeRequestsPerMinute.h":
      "Creating, editing, uploading and deleting, per person.",
    "f.apiRequestsPerMinute": "API requests per minute",
    "f.apiRequestsPerMinute.h": "Limit for each API token.",
    "f.statsRetentionDays": "Activity retention",
    "f.statsRetentionDays.h":
      "After this period the entries of the activity log are deleted.",

    "f.credentials": "Username/email and password",
    "f.credentials.h": "Local sign-in with passwords hashed with bcrypt.",
    "f.registration": "New sign-ups",
    "f.registration.h": "Allow creating new accounts with the active methods.",
    "f.google": "Google",
    "f.google.h":
      "Turn on once the provider credentials are set on the server.",
    "f.discord": "Discord",
    "f.discord.h":
      "Turn on once the provider credentials are set on the server.",
    "f.cognito": "AWS Cognito",
    "f.cognito.h":
      "Turn on once the provider credentials are set on the server.",

    "f.apiEnabled": "Enable the API",
    "f.apiEnabled.h":
      "Turning it off stops Bearer tokens without ending browser sessions.",
    "f.membersCanCreateTokens": "Let members create tokens",
    "f.membersCanCreateTokens.h":
      "Turning it off also stops the tokens members already created.",
    "f.defaultTokenLifetimeDays": "Default token lifetime",
    "f.defaultTokenLifetimeDays.h": "Applies to new tokens.",
    "f.maxTokenLifetimeDays": "Longest token lifetime",
    "f.maxTokenLifetimeDays.h": "No token can be valid for longer.",
    "f.sharingEnabled": "Read-only public links",
    "f.sharingEnabled.h":
      "Turning it off also stops the links that already exist.",
    "f.maxShareLifetimeHours": "Longest link lifetime",
    "f.maxShareLifetimeHours.h":
      "Unlimited lets links stay valid until they are removed.",

    "cn.sub": "Install and manage the task workspace on this machine.",
    "cn.step.search": "Search",
    "cn.step.install": "Install",
    "cn.step.done": "Done",
    "cn.search": "Search again",
    "cn.missing.title": "ErvisioTodo is not installed",
    "cn.missing.text":
      "No ErvisioTodo was found on this machine. Install it here with Docker.",
    "cn.dockerHint":
      "Version {v} is downloaded to {dir} and started with Docker Compose. Ervisio asks you to unlock administrator rights.",
    "cn.nodocker.title": "Docker is not installed",
    "cn.nodocker.text":
      "ErvisioTodo runs in Docker, and no Docker was found on this machine. Install Docker, then search again.",
    "cn.url": "Public address",
    "cn.urlHint":
      "The address people will use, for example https://todo.example.com. It becomes AUTH_URL.",
    "cn.urlBad":
      "Use an address like https://todo.example.com or http://localhost:3000.",
    "cn.install": "Install with Docker",
    "cn.retry": "Try again",
    "cn.startFailed": "The installation could not start",
    "cn.running.title": "Installing ErvisioTodo",
    "cn.running.text":
      "This runs in the background (systemd unit {unit}); you can leave this page.",
    "cn.done.title": "ErvisioTodo is installed",
    "cn.done.text": "The containers are up. Open the panel to see the app.",
    "cn.panel": "Open the panel",
    "cn.failed.title": "The installation failed",
    "cn.failed.text":
      "The last output is below. Fix the problem and try again.",

    "w.loading": "Loading…",
    "w.unavailable": "ErvisioTodo does not answer.",
    "w.openTasks": "{n} open tasks",
    "w.people": "{users} people, {lists} lists",
    "w.open": "Open",
  },
  it: {
    retry: "Riprova",
    cancel: "Annulla",
    on: "Attivo",
    off: "Disattivo",

    "nav.label": "ErvisioTodo",
    "nav.overview": "Panoramica",
    "nav.settings": "Impostazioni",
    "nav.maintenance": "Manutenzione",

    "lead.settings":
      "Le impostazioni dello spazio di lavoro di ErvisioTodo. Le modifiche si applicano appena le salvi; non serve riavviare.",
    "lead.maintenance":
      "Aggiorna ErvisioTodo e vedi dove l’installazione tiene file e dati.",

    "sec.general": "Generali",
    "sec.limits": "Spazio e limiti",
    "sec.auth": "Autenticazione",
    "sec.api": "API e sicurezza",
    "set.sections": "Sezioni impostazioni",

    "head.updating": "Aggiornamento alla v{v}",
    "head.notAnswering": "Non risponde",
    "head.stoppedAt": "Fermo dalle {time}",
    "head.stopped": "Fermo",
    "head.runningFor": "In esecuzione da {d}",
    "head.running": "In esecuzione",
    "head.docker": "v{v} su Docker",
    "head.available": "v{v} disponibile",
    "head.open": "Apri l’app",

    "bar.unsaved.one": "1 modifica non salvata",
    "bar.unsaved.other": "{n} modifiche non salvate",
    "bar.immediate": "Le modifiche salvate si applicano subito.",
    "bar.discard": "Annulla modifiche",
    "bar.save": "Salva impostazioni",

    "admin.title": "Servono i diritti di amministratore",
    "admin.text":
      "Sblocca i diritti di amministratore in Ervisio per gestire ErvisioTodo, poi riprova.",
    "admin.unlock": "Sblocca",
    "error.title": "Qualcosa è andato storto",
    "error.down": "ErvisioTodo non risponde",

    "ov.service": "Servizio",
    "ov.active": "Attivo",
    "ov.latency": "risponde in {ms} ms",
    "ov.users": "Persone",
    "ov.lists": "{n} liste",
    "ov.tasks": "Attività",
    "ov.open": "{n} aperte",
    "ov.space": "Allegati",
    "ov.spaceOf": "su {quota}",
    "ov.noQuota": "Nessun limite totale",
    "ov.containers": "Container",
    "ov.access": "Accesso",
    "ov.web": "Indirizzo web",
    "ov.noUrl": "Nessun indirizzo pubblico",
    "ov.signin": "Metodi di accesso",

    "prov.credentials": "Password",
    "prov.google": "Google",
    "prov.discord": "Discord",
    "prov.cognito": "AWS Cognito",

    "ct.unhealthy": "Non in salute",
    "ct.starting": "In avvio",
    "ct.healthy": "In salute",
    "ct.running": "In esecuzione",
    "ct.restarting": "Si riavvia",
    "ct.exited": "Terminato ({code})",
    "ct.stopped": "Fermo",

    "down.notAnswering": "L’app non risponde",
    "down.notAnsweringText":
      "Il container {name} è in esecuzione ma il suo socket di amministrazione non risponde. Potrebbe essere ancora in avvio; sotto le ultime righe del log.",
    "down.stoppedAt": "Fermo dalle {time}",
    "down.stopped": "ErvisioTodo è fermo",
    "down.exitCode":
      "Il container {name} è terminato con codice {code}. Sotto le ultime righe del log.",
    "down.text":
      "Il container {name} non è in esecuzione. Sotto le ultime righe del log.",

    "svc.restart": "Riavvia",
    "svc.start": "Avvia",
    "svc.stop": "Ferma",
    "svc.stopTitle": "Fermare ErvisioTodo?",
    "svc.stopText":
      "Nessuno potrà usare l’app finché non la riavvii. Non viene eliminato nulla.",
    "svc.noInstall": "Nessuna installazione trovata.",
    "svc.restarted": "ErvisioTodo riavviato",
    "svc.restartFailed": "Il riavvio non è riuscito",
    "svc.started": "ErvisioTodo avviato",
    "svc.startFailed": "Non è stato possibile avviarlo",
    "svc.stopped": "ErvisioTodo fermato",
    "svc.stopFailed": "Non è stato possibile fermarlo",
    "svc.timeout": "ErvisioTodo non ha risposto in tempo.",

    "logs.title": "Log",
    "logs.level": "Livello",
    "logs.all": "Tutto",
    "logs.warn": "Avvisi",
    "logs.err": "Errori",
    "logs.pause": "Pausa",
    "logs.resume": "Riprendi",
    "logs.copy": "Copia",
    "logs.copied": "Log copiato",
    "logs.empty": "Ancora nessun output.",
    "logs.failed": "Il flusso del log si è interrotto: {e}. Riprovo.",

    "up.available": "È disponibile ErvisioTodo v{v}",
    "up.from": "L’app esegue la v{v}",
    "up.view": "Vedi l’aggiornamento",
    "up.latest": "ErvisioTodo è aggiornato (v{v})",
    "up.latestText": "Esegue la versione che corrisponde a questo plugin.",
    "up.to": "Aggiornamento alla v{v}",
    "up.notes": "Note di rilascio",
    "up.update": "Aggiorna",
    "up.backup": "Salva una copia di .env",
    "up.pull": "Scarica la versione {v}",
    "up.up": "Riavvia i container",
    "up.check": "Attendi che l’app risponda",
    "up.done": "ErvisioTodo ora è alla v{v}",
    "up.failed": "L’aggiornamento non è terminato",
    "up.confirmTitle": "Aggiornare alla v{v}?",
    "up.confirm":
      "Il file .env viene copiato accanto a sé stesso, scarica la nuova immagine e riavvia l’app, il che richiede poco tempo. I dati stanno in un volume Docker e non vengono toccati.",

    "files.title": "File e dati",
    "files.text": "Dove vive questa installazione sulla macchina.",
    "files.dir": "Cartella",
    "files.env": "File delle impostazioni",
    "files.data": "Volume dei dati",
    "files.image": "Immagine",
    "files.envNote":
      "Fai una copia del volume dei dati (database SQLite e allegati) prima di modifiche rischiose. Segreti di accesso, SMTP e AI sono nel file .env; riavvia l’app dopo averli cambiati.",

    "card.workspace": "Spazio di lavoro",
    "card.info": "Questa installazione",
    "card.attachments": "Allegati e spazio",
    "card.limitsHelp":
      "Server usa la configurazione dell’installazione; Illimitato rimuove il limite applicativo.",
    "card.signin": "Accesso e registrazione",
    "card.mail": "Posta",
    "card.tokens": "Token API",
    "card.sharing": "Link pubblici",

    "info.space": "Spazio utilizzato",
    "info.spaceOf": "{used} su {quota}",
    "info.access": "Accesso principale",
    "info.smtp": "SMTP",
    "info.configured": "Configurato",
    "info.notConfigured": "Non configurato",

    "auth.callback": "Callback",
    "auth.secretsNote":
      "I segreti dei provider restano nell’ambiente del server (.env). Dopo averli cambiati, riavvia l’app.",

    "mail.to": "Invia un’email di prova",
    "mail.testText":
      "Manda un messaggio tramite il server SMTP impostato nell’installazione.",
    "mail.off":
      "SMTP non è configurato. Imposta SMTP_URL nel file .env e riavvia l’app per inviare posta.",
    "mail.send": "Invia",
    "mail.sent": "Email di prova inviata a {to}.",

    "set.default": "Predefinito {v}",
    "set.saved": "Impostazioni salvate",
    "set.refused": "Le impostazioni non sono state salvate",
    "set.loadFailed": "Impossibile leggere le impostazioni",
    "set.offline": "L’app non risponde",
    "set.offlineText":
      "Le impostazioni si leggono e si salvano solo mentre ErvisioTodo è in esecuzione. Avvialo dalla Panoramica.",

    "lim.server": "Server",
    "lim.limit": "Limite",
    "lim.unlimited": "Illimitato",
    "lim.mode": "modalità",
    "lim.envHint": "Usa il valore dell’installazione",
    "lim.offHint": "Nessun limite applicativo",

    "unit.GB": "GB",
    "unit.MB": "MB",
    "unit.files": "file",
    "unit.perMin": "/min",
    "unit.days": "giorni",
    "unit.hours": "ore",

    "chk.required": "Serve un valore.",
    "chk.maxLen": "Al massimo {n} caratteri.",
    "chk.number": "Inserisci un numero.",
    "chk.positive":
      "Inserisci un numero maggiore di 0, oppure scegli Illimitato.",
    "chk.min": "Almeno {n}.",
    "chk.int": "Inserisci un numero intero.",
    "chk.tokenOrder": "La durata predefinita supera quella massima.",

    "f.siteName": "Nome dello spazio",
    "f.siteName.h": "Compare nell’intestazione dell’app e nelle email.",
    "f.defaultLocale": "Lingua predefinita",
    "f.defaultLocale.h": "Usata per chi non ha ancora scelto una lingua.",
    "opt.defaultLocale.it": "Italiano",
    "opt.defaultLocale.en": "English",

    "f.storageQuotaGb": "Spazio totale",
    "f.storageQuotaGb.h": "Spazio occupato dagli allegati di tutti gli utenti.",
    "f.userQuotaGb": "Quota per persona",
    "f.userQuotaGb.h": "Spazio per gli allegati caricati da ogni persona.",
    "f.uploadMaxMb": "Dimensione massima allegato",
    "f.uploadMaxMb.h": "I file più grandi vengono rifiutati dal server.",
    "f.maxFilesPerUpload": "File per caricamento",
    "f.maxFilesPerUpload.h": "Quanti file si possono caricare insieme.",
    "f.maxAttachmentsPerTask": "Allegati per attività",
    "f.maxAttachmentsPerTask.h":
      "Numero massimo di allegati associati alla stessa attività.",
    "f.editorMaxMb": "Dimensione descrizione",
    "f.editorMaxMb.h": "Dimensione massima del testo Markdown di un’attività.",
    "f.writeRequestsPerMinute": "Scritture al minuto",
    "f.writeRequestsPerMinute.h":
      "Creazione, modifica, caricamenti ed eliminazioni per persona.",
    "f.apiRequestsPerMinute": "Richieste API al minuto",
    "f.apiRequestsPerMinute.h": "Limite per ciascun token API.",
    "f.statsRetentionDays": "Conservazione attività",
    "f.statsRetentionDays.h":
      "Dopo questo periodo le voci del registro vengono eliminate.",

    "f.credentials": "Username/email e password",
    "f.credentials.h":
      "Accesso locale con password protette tramite hashing bcrypt.",
    "f.registration": "Nuove registrazioni",
    "f.registration.h":
      "Consenti la creazione di nuovi account con i metodi attivi.",
    "f.google": "Google",
    "f.google.h":
      "Abilita quando le credenziali del provider sono configurate sul server.",
    "f.discord": "Discord",
    "f.discord.h":
      "Abilita quando le credenziali del provider sono configurate sul server.",
    "f.cognito": "AWS Cognito",
    "f.cognito.h":
      "Abilita quando le credenziali del provider sono configurate sul server.",

    "f.apiEnabled": "Attiva API",
    "f.apiEnabled.h":
      "Disabilita i token Bearer senza interrompere le sessioni del browser.",
    "f.membersCanCreateTokens": "Consenti token ai membri",
    "f.membersCanCreateTokens.h":
      "Disabilitando questa opzione smettono di funzionare anche i token già creati dai membri.",
    "f.defaultTokenLifetimeDays": "Durata predefinita token",
    "f.defaultTokenLifetimeDays.h": "La durata si applica ai nuovi token.",
    "f.maxTokenLifetimeDays": "Durata massima token",
    "f.maxTokenLifetimeDays.h": "Nessun token può restare valido più a lungo.",
    "f.sharingEnabled": "Link pubblici in sola lettura",
    "f.sharingEnabled.h":
      "Disabilitando questa opzione smettono di funzionare anche i link esistenti.",
    "f.maxShareLifetimeHours": "Durata massima link",
    "f.maxShareLifetimeHours.h":
      "Illimitato lascia i link validi finché non vengono rimossi.",

    "cn.sub":
      "Installa e gestisci lo spazio di lavoro delle attività su questa macchina.",
    "cn.step.search": "Ricerca",
    "cn.step.install": "Installazione",
    "cn.step.done": "Fatto",
    "cn.search": "Cerca di nuovo",
    "cn.missing.title": "ErvisioTodo non è installato",
    "cn.missing.text":
      "Su questa macchina non è stato trovato nessun ErvisioTodo. Installalo qui con Docker.",
    "cn.dockerHint":
      "La versione {v} viene scaricata in {dir} e avviata con Docker Compose. Ervisio ti chiede di sbloccare i diritti di amministratore.",
    "cn.nodocker.title": "Docker non è installato",
    "cn.nodocker.text":
      "ErvisioTodo funziona in Docker e su questa macchina non è stato trovato. Installa Docker, poi cerca di nuovo.",
    "cn.url": "Indirizzo pubblico",
    "cn.urlHint":
      "L’indirizzo che useranno le persone, per esempio https://todo.example.com. Diventa AUTH_URL.",
    "cn.urlBad":
      "Usa un indirizzo come https://todo.example.com o http://localhost:3000.",
    "cn.install": "Installa con Docker",
    "cn.retry": "Riprova",
    "cn.startFailed": "Impossibile avviare l’installazione",
    "cn.running.title": "Installazione di ErvisioTodo",
    "cn.running.text":
      "Va avanti in background (unità systemd {unit}); puoi lasciare questa pagina.",
    "cn.done.title": "ErvisioTodo è installato",
    "cn.done.text":
      "I container sono attivi. Apri il pannello per vedere l’app.",
    "cn.panel": "Apri il pannello",
    "cn.failed.title": "Installazione non riuscita",
    "cn.failed.text": "Sotto l’ultimo output. Risolvi il problema e riprova.",

    "w.loading": "Caricamento…",
    "w.unavailable": "ErvisioTodo non risponde.",
    "w.openTasks": "{n} attività aperte",
    "w.people": "{users} persone, {lists} liste",
    "w.open": "Apri",
  },
};
