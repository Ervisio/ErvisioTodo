# Contratto ErvisioTodo v1

API JSON con cookie HTTP-only Auth.js o token Bearer personali. Le scritture con cookie richiedono `Origin` corrispondente all'host della richiesta (nessun CORS aperto). Risposte `{success:true,data:...}` o `{success:false,error:string}`. Errori 400 input, 401 sessione assente/scaduta, 403 permesso, 404 risorsa non accessibile, 409 conflitto, 429 limite tentativi. I provider usano l'authorization code flow di Auth.js. Nessuna API accetta ID utente/ruoli inviati dal client come autorizzazione.

- `GET /api/public`: metodi di accesso effettivamente disponibili e configurazione pubblica. Mai segreti.
- `POST /api/account/register`: `{username,email,password}`; primo account amministratore. 201, conflitto 409. Registrazione chiudibile.
- `POST /api/account/resend`: `{email}`; risposta uniforme, reinvia la conferma account via SMTP.
- `POST /api/account/verify`: `{token}`; conferma email, token monouso valido 30 minuti.
- `POST /api/account/link`: `{provider}`; richiede sessione, imposta un intento di collegamento OAuth monouso di 10 minuti.
- `POST /api/account/forgot`: `{email}`; risposta uniforme; invia token monouso via SMTP, se configurato.
- `POST /api/account/reset`: `{token,password}`; token monouso, scadenza 30 minuti, revoca sessioni.
- `POST /api/account/password`: `{currentPassword,password}`; utente autenticato; revoca sessioni.
- `GET|POST /api/auth/*`: protocollo Auth.js (CSRF incluso). Provider credentials, google, discord, cognito; un provider disabilitato viene rifiutato anche al callback.
- `GET|PATCH /api/admin/settings`: solo amministratori; flag login/registrazione, configurazione effettiva. Segreti solo nell'ambiente. Impedisce di disattivare l'ultimo metodo disponibile.
- `GET /api/admin/users?listId=...`: utenti già membri della lista. `?q=...` ricerca esatta per username/email per aggiungere membri; nessun elenco globale di email.
- `GET|POST /api/admin/todo/lists`: liste possedute/condivise; crea con `title,iconType,iconValue,members,aiContext,slug,subdomain,accentColor,backgroundColor,faviconUrl`. Slug e sottodominio globalmente unici; membri solo utenti esistenti. Liste private anche se members vuoto.
- `PATCH|DELETE /api/admin/todo/lists/:id`: proprietario; cancellazione a cascata.
- `DELETE /api/admin/todo/lists/:id/clear`: proprietario; cancella task attive e discendenti.
- `GET /api/admin/todo/tasks?listId=...`: solo membri/proprietario; filtri `parentTaskId=null|id`, `favorites=true`, `completed=true`, `tags=id,id` (AND).
- `POST /api/admin/todo/tasks`: `listId,title,description,parentTaskId?,assignedTo?,dueDate?,isFavorite?,attachments?,tags?`. Riferimenti vincolati alla stessa lista. Chiunque sia membro può gestire task e tag.
- `GET|PATCH|DELETE /api/admin/todo/tasks/:id`: lettura/modifica/cancellazione ricorsiva; listId e parentTaskId immutabili.
- `PATCH /api/admin/todo/tasks/:id/complete|reopen|favorite`: complete completa anche i discendenti; reopen riapre task e antenati.
- `POST /api/admin/todo/tasks/reorder`: `{ids:string[]}`; ID distinti, tutti della medesima lista; operazione atomica.
- `POST|DELETE /api/admin/todo/tasks/:id/attachments`: POST `{name,url,mimeType}`; DELETE `?url=...`.
- `GET|POST /api/admin/todo/tags?listId=...`; `PATCH|DELETE /api/admin/todo/tags/:id`.
- `POST /api/admin/upload`: multipart `file,listId?`; limiti configurabili (default 10 MiB per file); risposta `{success:true,url,files}`. File privati, salvo immagini usate esplicitamente come branding.
- `GET /api/files/:id`: controllo accesso lista/owner; download sicuro. Solo immagini raster verificate possono essere inline.
- `POST /api/admin/todo/ai-generate` e `POST /api/admin/todo/tasks/:id/ai-refactor`: facoltativi, richiedono configurazione AI nell'ambiente; 503 quando disabilitati.
- `GET /api/admin/todo/lists/:id/caddy?target=docker|standalone`: proprietario; snippet Caddy per host assegnato, nessuna modifica DNS o server esterno.
- `GET /api/caddy/ask?domain=...`: autorizzazione TLS on-demand solo per host canonico/sottodomini assegnati nel dominio configurato.
- `GET /api/health`: liveness e lettura DB.

Sottodomini: `BASE_DOMAIN` definisce lo spazio amministrato. `AUTH_URL` è l'origine canonica; per SSO fra sottodomini è necessario `AUTH_COOKIE_DOMAIN=.dominio.tld`. Nessun cookie condiviso verso domini esterni. L'URL `/l/:slug` è sempre disponibile sull'origine canonica. Il binding del sottodominio seleziona la lista, senza renderla pubblica.

## Estensione progetti e impostazioni (contratto)

Un progetto contiene liste. `projectId: null` mantiene le liste già esistenti fuori dai progetti. I membri di un progetto ereditano l'accesso alle sue liste; la condivisione esplicita di una lista resta indipendente. Solo il proprietario gestisce il progetto; il proprietario del progetto e quello della lista possono gestire identità e condivisione della lista. Eliminare un progetto scollega le liste senza cancellarle.

- `GET|POST /api/admin/todo/projects`; `PATCH|DELETE /api/admin/todo/projects/:id`. Campi: `title,slug,description,iconValue,color,members`. ID e proprietario sono assegnati dal server. URL `/p/:slug`.
- Le API liste accettano `projectId`, validato contro l'accesso al progetto. `GET /api/admin/todo/lists?projectId=id|none` filtra il contenitore.
- `GET|PATCH /api/admin/settings` estende i flag di autenticazione con generali, spazio/limiti e API/sicurezza adattati da ErvisioDrive; i valori salvati governano i controlli server. `null` usa l'ambiente, `0` rimuove il limite applicativo dove previsto.
- `GET|POST /api/admin/tokens`; `DELETE /api/admin/tokens/:id`: token Bearer personali con scope `read`/`write`, scadenza e revoca. Il valore in chiaro compare soltanto alla creazione. Disabilitare le API non interrompe le sessioni browser.
- `GET|POST /api/admin/todo/lists/:id/shares`; `DELETE /api/admin/todo/lists/:id/shares/:shareId`: solo proprietario della lista/progetto. Link pubblici in sola lettura, revocabili, con scadenza. Non espongono allegati o dati personali dei membri.
- `GET /api/shared/:token` e pagina `/s/:token`: vista pubblica controllata ad ogni richiesta; disattivare la condivisione invalida anche i link esistenti.
- `GET /api/admin/activity`: audit amministrativo soggetto alla conservazione configurata, senza password o credenziali nei dettagli.

## Interfaccia versionata `/api/v1`

Questa è l’interfaccia per integrazioni nuove. I percorsi `/api/admin/*` rimangono compatibili con l’app. [OpenAPI 3.1](openapi.json), [collection Postman](ErvisioTodo.postman_collection.json) e la pagina `/api-docs` descrivono il catalogo mantenuto in `lib/api-catalog.ts`. La specifica è disponibile a runtime da `/api/openapi.json`; la collection da `/api/postman.json`. Nessun segreto viene incluso negli artefatti.

| Risorsa                            | Operazioni                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| `/auth`                            | providers, login locale con token, register, forgot, reset, verify, logout                        |
| `/me`, `/account/password`         | profilo e limiti effettivi; cambio password con revoca sessioni/token                             |
| `/projects`                        | CRUD; elenco liste; lettura/sostituzione membri                                                   |
| `/lists`                           | CRUD, progetto/branding/colori/URL/sottodominio, membri, tasks, tags, clear, Caddy, link pubblici |
| `/tasks`                           | CRUD ricorsivo, complete/reopen/favorite, reorder, move/copy sottoalbero, bulk, allegati, AI      |
| `/tags`                            | CRUD con pulizia dei riferimenti                                                                  |
| `/files`                           | elenco/metadati, multipart upload, download, rinomina, eliminazione con pulizia riferimenti       |
| `/tokens`                          | elenco/lettura senza segreti, creazione e revoca a cascata                                        |
| `/users`                           | ricerca esatta di un membro; amministrazione utenti, ruolo e stato di accesso                     |
| `/settings`, `/usage`, `/activity` | configurazione completa, quote/spazio e registro                                                  |

Le collezioni `projects`, `lists`, `tasks`, `tags`, `files`, `tokens`, `users` e i relativi sottoelenchi usano `limit` (intero 1–500, default 100) e `offset` (intero >= 0). Risposta: `{success:true,data:[...],pagination:{total,limit,offset,hasMore}}`. Le letture singole e le scritture restituiscono `{success:true,data:...}`; gli errori `{success:false,error:"..."}` con stato HTTP coerente. L’upload v1 restituisce `data.files`; il percorso storico conserva `files` al livello principale.

`GET /tasks?listId=...` e `/lists/{id}/tasks` accettano `completed=true`, `favorites=true`, `tags=id1,id2`, `parentTaskId=id` o `null`, e ricerca `q`. Default: attività attive. La ricerca include gli antenati, così la gerarchia resta visualizzabile. `GET /users/lookup?q=...` richiede username o email esatti e restituisce soltanto ID e nome pubblico; l’elenco e l’amministrazione utenti richiedono ruolo admin. Un admin non ottiene accesso alle liste private di altri utenti.

### Autenticazione e token

`POST /api/v1/auth/login` con JSON `{login,password,name?,lifetimeDays?}` restituisce un token personale `evt_...` e il profilo senza password. Si applicano i flag dell’accesso locale, conferma email, API globali e autorizzazione API ai membri. Non crea cookie. Per Google/Discord/Cognito usa il flusso browser Auth.js e genera un token da Account. I segreti OAuth, SMTP e AI rimangono nella configurazione dell’ambiente; le API possono abilitarne l’uso soltanto se già configurati.

Le richieste Bearer usano `Authorization: Bearer $ERVISIO_TOKEN`. Le scritture con sessione cookie richiedono `Origin` uguale all’host pubblico; per Bearer non è richiesto. Le azioni pubbliche di autenticazione richiedono `application/json`, non impostano sessioni; se ricevono `Origin`, ne verificano la corrispondenza. Non è abilitato CORS indiscriminato.

Gli ambiti granulari sono `<risorsa>:read` e `<risorsa>:write` per projects, lists, tasks, tags, files, shares, settings, users, tokens, account, più `activity:read`. `read` e `write` sono alias globali. Un ambito di scrittura non include implicitamente la lettura. Un token valido può leggere `/me` per conoscere i propri limiti.

La creazione accetta `{name,scopes,lifetimeDays?,resourceMode:"all"|"selected",projectIds:[],listIds:[]}`. La selezione limita progetti/liste e relativi contenuti anche sui percorsi storici e sui download diretti. Un progetto include tutte le proprie liste accessibili; una lista selezionata non autorizza la lettura del contenitore progetto. Un token selezionato può creare liste soltanto nei progetti consentiti e non può creare nuovi progetti. L’upload di un token selezionato richiede una destinazione `listId` consentita. Gli ambiti globali di account, impostazioni, utenti e token sono valutati separatamente dalle restrizioni su progetti/liste.

Un token con `tokens:write` può crearne uno derivato. Ambiti, scadenza e risorse vengono limitati dall’intera catena dei token padre. La revoca elimina tutti i discendenti. Il valore in chiaro è mostrato soltanto alla creazione; il database conserva un hash SHA-256. Disabilitazione API, blocco dei membri, scadenza, revoca e disabilitazione dell’account hanno effetto immediato. Cambio/reset password revoca anche i token personali.

### Effetti delle operazioni

- Eliminare un progetto separa le sue liste senza eliminarle. Le membership ereditate cessano; rimangono proprietario e membri espliciti delle liste.
- Eliminare una lista cancella attività, tag, link e upload associati; eliminare un’attività cancella i discendenti.
- `POST /tasks/{id}/move` o `/copy` accetta `{listId,parentTaskId:null|id}`. Verifica accesso a sorgente/destinazione e impedisce cicli. Cross-list rimuove tag della sorgente, filtra assegnazioni e clona gli upload privati nella destinazione rispettando le quote. Gli upload originali restano nella lista sorgente finché eliminati esplicitamente. La copia azzera completamento e usa nuovi ID.
- `POST /tasks/bulk` accetta fino a 100 ID e `action: complete|reopen|delete`. Restituisce risultati individuali; un errore non annulla gli altri elementi.
- Rinomina/eliminazione file aggiorna i riferimenti delle attività; eliminare immagini di branding ripristina l’icona predefinita.
- `DELETE /users/{id}` disabilita l’account conservando dati e ownership, revoca token/sessioni, impedisce accesso locale e OAuth. Non si può disabilitare o degradare l’ultimo amministratore attivo. `PATCH {active:true}` ripristina l’accesso senza ripristinare vecchie sessioni/token.
- I link pubblici mostrano soltanto contenuto leggibile e gerarchia, senza file privati, assegnazioni o dati dei membri. Si possono disabilitare globalmente.
- OAuth e AI esterni richiedono credenziali configurate. I test locali non contattano i provider reali.

### Avvio rapido

```sh
# Conserva il token in una variabile locale; non inserirlo nei file di progetto.
curl http://localhost:3000/api/v1/projects \
  -H "Authorization: Bearer $ERVISIO_TOKEN"

curl http://localhost:3000/api/v1/tasks \
  -H "Authorization: Bearer $ERVISIO_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"listId":"ID_LISTA","parentTaskId":null,"title":"Preparare la release"}'
```

Importa la collection in Postman, configura `baseUrl` e il token oppure login/password in variabili private. I campi `projectId`, `listId`, `taskId` e `tagId` vengono valorizzati dalle creazioni. Gli script verificano stato HTTP ed envelope. Esegui le richieste mutative su un ambiente di test: le richieste DELETE e il cambio password hanno effetti reali. La collection non è un runner automatico ordinato.
