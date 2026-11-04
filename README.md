# ErvisioTodo

Servizio autonomo di gestione attività, estratto dalla TodoList del backend admin di [KFScripts/FusionHub](https://github.com/KFScripts/FusionHub). Include progetti contenitori di liste, sottoattività ricorsive, drag & drop, preferiti, completamento/riapertura, tag, scadenze, assegnazioni ai membri, Markdown, allegati privati e assistente AI facoltativo.

Ogni lista ha nome, icona (emoji, FontAwesome o immagine), favicon, colore principale, sfondo, URL `/l/nome-lista` e sottodominio selezionabile dall’interfaccia. Le liste sono private: avere l’URL non concede accesso. Il proprietario della lista o del progetto può modificarne identità, condivisione o eliminarla; i membri possono gestire attività e tag.

Stack: Next.js 16, React 19, TypeScript, Auth.js 5 (`5.0.0-beta.32`, versione fissata), SQLite integrato in Node 24. Una sola istanza del servizio e un volume persistente; nessun MongoDB/Redis necessario. Il codice estratto e il commit di origine sono in [UPSTREAM.md](UPSTREAM.md). L’integrazione come plugin Ervisio è un passo successivo; questo progetto implementa standalone e Docker.

## Avvio locale

Richiede Node **24 LTS** e npm.

```sh
npm ci
npm run setup
npm run dev
```

Apri **http://localhost:3000**. Il primo account registrato diventa amministratore; non esistono credenziali predefinite. Gli account seguenti sono utenti normali. Completa la prima registrazione prima di esporre il servizio su Internet.

`npm run setup` crea `.env` con un segreto casuale e la cartella `data`; è ripetibile senza sovrascrivere la configurazione esistente. `.env` e i dati sono esclusi da Git e dall’immagine Docker. Esegui il comando dalla radice del progetto.

## Standalone in produzione

1. Compila `.env` a partire da `.env.example`: `AUTH_URL` è l’origine pubblica esatta, per esempio `https://todo.example.com`, senza percorsi; `AUTH_SECRET` deve restare stabile fra riavvii.
2. Costruisci e avvia:

```sh
npm ci
npm run setup
npm run build
npm start
```

La build prepara già gli asset ed esclude i file `.env` dall’artefatto. In alternativa distribuisci soltanto l’output standalone:

```sh
cp -R public .next/standalone/public
mkdir -p .next/standalone/.next
cp -R .next/static .next/standalone/.next/static
node --env-file=.env .next/standalone/server.js
```

Il server standalone richiede le variabili **a runtime**. `npm start` carica `.env` e avvia l’output standalone con `DATA_DIR` assoluta; `server.js` va avviato con `--env-file` o un process manager. È incluso un esempio systemd in [deploy/ervisio-todo.service](deploy/ervisio-todo.service): adegua percorsi e utente, copia anche gli asset come sopra e prepara `/var/lib/ervisio-todo` scrivibile. Per systemd la posizione di Node può essere diversa da `/usr/bin/node`.

Un server Caddy già presente può usare [deploy/Caddyfile.standalone](deploy/Caddyfile.standalone). Configura `ACME_EMAIL` nell’ambiente di **Caddy** e `TRUSTED_IP_HEADER=X-Real-IP` nell’ambiente di ErvisioTodo. Il processo Node deve essere raggiungibile soltanto dal proxy; `npm start` ascolta su `127.0.0.1` per impostazione predefinita; per cambiare binding imposta `BIND_HOST` e proteggi l’accesso diretto con un firewall. Non attivare `TRUSTED_IP_HEADER` quando client esterni possono inviare direttamente quel valore al processo Node.

## Docker

```sh
node scripts/setup.mjs
# Modifica .env se non usi http://localhost:3000

docker compose up -d --build
docker compose ps
docker compose logs --tail=50 app
```

Il servizio ascolta su `127.0.0.1:3000`; `PORT=4000` cambia la porta pubblicata (aggiorna anche `AUTH_URL`). Il volume `todo-data` conserva database, account, impostazioni e allegati. Il container usa l’utente `node`, ha healthcheck e riparte automaticamente. Non usare `docker compose down -v` se vuoi conservare i dati.

Per avviare anche Caddy:

```sh
# In .env aggiungi: ACME_EMAIL=admin@example.com
# AUTH_URL=https://todo.example.com
# BASE_DOMAIN=example.com
# AUTH_COOKIE_DOMAIN=.example.com

docker compose -f compose.yaml -f compose.caddy.yaml up -d --build
```

Caddy espone 80/443 TCP e 443 UDP e conserva certificati/configurazione in volumi propri. Se Caddy esiste già in Docker, mettilo sulla stessa rete dell’app e usa `reverse_proxy app:3000` oppure inoltra al binding locale tramite l’host appropriato. Lo snippet scaricabile dall’editor della lista usa `app:3000` per Docker e `127.0.0.1:3000` per standalone.

## Plugin Ervisio

Il plugin Ervisio (cartella `plugin/`) installa e gestisce ErvisioTodo con Docker e ne mostra stato e impostazioni nel pannello Ervisio. Il collegamento è un socket unix di amministrazione: con `PLUGIN_SOCKET` impostato, `scripts/plugin-socket.mjs` ascolta sul socket (0660), accetta solo `/api/plugin/*` (altrimenti 404), limita i body a 1 MiB e inoltra al server Next su `127.0.0.1:PORT` aggiungendo l’header `x-ervisio-plugin` con un segreto casuale generato a ogni avvio (`PLUGIN_SECRET`; eventuali header in ingresso sono scartati). Le route in `app/api/plugin/` rispondono 404 senza il segreto, quindi non sono utilizzabili dalla porta pubblica. Il contratto è in `.context/plugin-contract.md`.

```sh
deploy/ervisio-setup.sh --url https://todo.example.com
```

Lo script (non interattivo, rilanciabile) scrive `.env` solo se manca (altrimenti conserva `AUTH_SECRET` e aggiorna `AUTH_URL`) con `PLUGIN_SOCKET=/run/ervisio-todo/api.sock` e `ERVISIO_SOCKET_DIR=/run/ervisio-todo`, crea la cartella per l’utente `node` (uid 1000) con una voce `tmpfiles.d`, poi esegue `docker compose pull app` (in alternativa `build`) e `up -d --wait`. `ERVISIO_VERSION` sceglie il tag di `ghcr.io/ervisio/ervisio-todo`. Il socket è facoltativo: senza `PLUGIN_SOCKET` l’app funziona come prima.

## URL, sottodomini e Caddy

Esempio: `AUTH_URL=https://todo.example.com`, `BASE_DOMAIN=example.com`, `AUTH_COOKIE_DOMAIN=.example.com`.

1. Nel DNS crea `todo.example.com` e `*.example.com` diretti all’IP di Caddy; eventuali record AAAA devono puntare a un IPv6 realmente raggiungibile. Non usare questo spazio di sottodomini per servizi non fidati: il cookie di sessione è condiviso sotto il dominio configurato.
2. Avvia Caddy con uno degli esempi inclusi. Usano TLS on-demand con un endpoint `ask`: il certificato è autorizzato solo per l’host canonico o per un sottodominio assegnato a una lista esistente.
3. In **Modifica lista**, scegli `progetti` nel campo Sottodominio. Il nome deve essere libero; nomi di servizio riservati sono rifiutati. Dopo il salvataggio apri `https://progetti.example.com`: l’app seleziona la lista e applica nome, colori e favicon.
4. I provider OAuth usano sempre i callback sull’host canonico; la sessione condivisa permette il ritorno al sottodominio. Senza `AUTH_COOKIE_DOMAIN`, il login riporta al corrispondente `/l/slug` sull’host canonico per evitare un ciclo di accesso.

L’editor salva l’associazione e prepara la configurazione; **non crea record DNS e non modifica un Caddy esterno**. Con DNS wildcard e la configurazione on-demand, nuovi sottodomini funzionano senza ricaricare Caddy. Con Caddyfile per singolo host, scarica lo snippet dall’editor, aggiungilo al tuo Caddyfile, validalo e ricarica Caddy. Per wildcard TLS tradizionale serve il modulo DNS del tuo provider; gli esempi inclusi usano certificati per singolo host e non richiedono quel modulo.

Sono supportati host/sottodomini e percorsi `/l/slug`; il montaggio dell’intera app sotto un prefisso arbitrario come `/todo` non è previsto. Domini esterni per singola lista non sono accettati: lo spazio dei nomi è `BASE_DOMAIN`, controllato dal gestore.

## Login e registrazione

I metodi sono separati e attivabili/disattivabili da **Impostazioni** (amministratore). Le credenziali si configurano sul server; non vengono restituite al browser. I flag `.env` sono i valori iniziali: dopo il primo salvataggio le impostazioni persistite nel database prevalgono. L’ultimo metodo realmente configurato non può essere disabilitato dall’interfaccia.

| Metodo                    | Variabili                                                                                    | Callback da registrare nel provider                  |
| ------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Username/email e password | `AUTH_LOCAL_ENABLED=true`                                                                    | nessuno                                              |
| Google                    | `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_GOOGLE_ENABLED=true`                           | `https://todo.example.com/api/auth/callback/google`  |
| Discord                   | `AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET`, `AUTH_DISCORD_ENABLED=true`                        | `https://todo.example.com/api/auth/callback/discord` |
| AWS Cognito               | `AUTH_COGNITO_ID`, `AUTH_COGNITO_SECRET`, `AUTH_COGNITO_ISSUER`, `AUTH_COGNITO_ENABLED=true` | `https://todo.example.com/api/auth/callback/cognito` |

In locale usa gli stessi percorsi sotto `http://localhost:3000` e registra esattamente quegli URL. Abilitare un metodo senza credenziali non lo rende disponibile. `REGISTRATION_ENABLED=false` chiude le nuove registrazioni per password **e** provider social; utenti già registrati possono continuare ad accedere e collegare provider dalla pagina Account.

**Google:** crea un client OAuth di tipo Web application nella Google Auth Platform, configura il consenso e il callback. Scope standard `openid email profile`, gestiti da Auth.js. Se l’app di consenso è in test, autorizza i relativi utenti di test.

**Discord:** crea una application nel Developer Portal, aggiungi il redirect OAuth2 e usa Client ID/Secret (non un bot token). Scope `identify email`; l’account deve fornire un’email valida/verificata.

**Cognito:** usa un **User Pool**, Managed Login e un app client **confidential** per web server con client secret. Abilita authorization code grant, scope `openid email profile`, callback canonico e, se vuoi la registrazione, il self sign-up del pool. `AUTH_COGNITO_ISSUER` deve essere `https://cognito-idp.REGION.amazonaws.com/POOL_ID`, non il dominio Managed Login. Auth.js gestisce discovery OIDC, PKCE, state, nonce e verifica dei token; il browser riceve solo il cookie di sessione dell’app. Non servono access key AWS o Identity Pool. MFA, policy password e verifica email dei login Cognito sono governati dal pool. “Esci” chiude la sessione ErvisioTodo; la sessione SSO del provider può restare attiva.

**Collegamento account:** email uguali tra provider non vengono unite automaticamente. Accedi con il metodo originale, apri **Account** e scegli **Collega**. L’intento di collegamento è esplicito, monouso e scade dopo 10 minuti. Non vengono conservati access/refresh token dei provider.

**Password:** minimo 12 caratteri, massimo 72 byte UTF-8, hash bcrypt; login tramite username o email senza distinzione maiuscole/minuscole. Recupero e conferma email richiedono `SMTP_URL` e `MAIL_FROM`. Per obbligare la verifica email locale imposta `REQUIRE_EMAIL_VERIFICATION=true`; senza SMTP questa configurazione viene rifiutata. I link scadono dopo 30 minuti e sono monouso. Il reset o cambio password revoca tutte le sessioni dell’account. Nessuna email di recupero viene consegnata in assenza di un servizio SMTP configurato.

## Progetti, viste e impostazioni

La UI segue la variante **Albero flessibile** approvata in Variant Studio: barra estesa/ritratta con hamburger e tooltip, icone FontAwesome, viste **Lista** e **Schede**. La vista scelta e lo stato della barra restano su questo dispositivo. La creazione o modifica di una sottoattività aggiorna tutti i rami aperti, anche a più livelli, senza ricaricare la pagina.

Crea un progetto e aggiungi le sue liste, oppure sposta una lista esistente scegliendo Progetto nel suo editor. Il proprietario gestisce nome, URL, colore e membri del progetto. I membri ereditano accesso alle liste e possono creare liste e gestire attività/tag. La condivisione esplicita della singola lista è indipendente. Revocare un membro elimina l'accesso ereditato e le sue assegnazioni ereditate; eventuali inviti espliciti su una lista restano validi. Eliminare il progetto sposta le liste in **Senza progetto**, mantenendo attività e allegati.

Le funzionalità delle impostazioni sono adattate da [ErvisioDrive](https://github.com/Ervisio/ErvisioDrive):

- **Preferenze personali** per tutti: lingua, tema, editor a finestra o pannello, suoni. Lingua/tema sono salvati anche come cookie per la resa iniziale; gli altri valori restano nel browser.
- **Generali** (amministratore): nome dello spazio, lingua predefinita e utilizzo degli allegati.
- **Spazio e limiti**: quota totale e per persona, dimensione degli allegati, file per caricamento, allegati per attività, descrizione Markdown, richieste e conservazione del registro. `null` segue `.env` per spazio e dimensione file, `0` rimuove il limite applicativo dove previsto. I caricamenti multipli sono atomici rispetto alle quote.
- **Autenticazione**: metodi locali, Google, Discord, Cognito, registrazione e callback. Le credenziali restano nell'ambiente.
- **API e sicurezza**: accesso Bearer, autorizzazione ai membri, durata token, link pubblici in sola lettura e loro durata, registro delle modifiche senza corpi delle richieste o segreti.

`UPLOAD_MAX_MB=10`, `STORAGE_QUOTA_GB=0` e `UPLOAD_REQUEST_MAX_MB=512` sono i valori iniziali dell'ambiente. Il limite tecnico del caricamento è al massimo 512 MiB per richiesta; per allegati più grandi serve adeguare il servizio. I Caddyfile inclusi accettano richieste fino a 512 MB. Il testo Markdown ha inoltre un limite tecnico di 2 milioni di caratteri e il corpo JSON di 4,2 MB. Le quote contano i BLOB degli allegati, non l'intera dimensione del file SQLite/WAL.

## API complete e documentazione

Le API versionate `/api/v1` gestiscono progetti, liste, membri, attività annidate, spostamento/copia sottoalberi, operazioni batch, tag, allegati (caricamento/metadati/download/rinomina/eliminazione), link pubblici, token, utenti e ruoli, impostazioni, quote e registro attività. L’amministrazione utenti non dà accesso alle liste private altrui. La cancellazione utente disabilita l’accesso, conserva i dati e revoca sessioni/token; l’ultimo amministratore attivo è protetto.

Apri **[Documentazione API](http://localhost:3000/api-docs)** dall’app. La [specifica OpenAPI](docs/openapi.json) è servita anche da `/api/openapi.json`; la [collection Postman](docs/ErvisioTodo.postman_collection.json) da `/api/postman.json`. Le collection di risorse usano `limit` (1–500, default 100), `offset` e `pagination`. `docs/API.md` contiene semantica, scope, permessi ed esempi. `npm run docs:api` rigenera specifica e collection dal catalogo mantenuto insieme al codice.

Per un client locale usa `POST /api/v1/auth/login` con `{ "login": "username-o-email", "password": "..." }`: restituisce un token, senza cookie. Registrazione, recupero/conferma email e cambio password hanno endpoint dedicati. Google, Discord e Cognito passano dal login browser protetto da Auth.js; l’account autenticato può poi generare un token. Le credenziali dei provider restano nell’ambiente e non sono esposte dalle API.

## Temi personali

In Impostazioni trovi temi Chiaro, Scuro, AMOLED con nero puro, Tokyo Night, GitHub Dark, Dracula, Catppuccin Mocha, Nord, Solarized Light e modalità Sistema. Accento con campioni, HEX e selettore colore; creazione, modifica, duplicazione ed esportazione/importazione di temi personali, con anteprima e controllo del contrasto. I temi sono salvati sul browser/dispositivo. [Dettagli e riferimenti](docs/THEMES.md).

La palette personale governa anche liste, schede e finestre. I colori preesistenti delle liste restano conservati e possono essere attivati esplicitamente con **Usa i colori delle liste**. La sidebar indica la voce attiva con una linea sottile senza sfondo colorato; il selettore Lista/Schede è allineato a destra.

## Token API e link pubblici

Da **Account**, crea un token personale con nome, ambiti globali `read`/`write` o granulari (ad esempio `tasks:read`, `lists:write`), risorse selezionate e scadenza. Il valore `evt_...` è mostrato una sola volta; nel database resta solo il suo hash. Usa `Authorization: Bearer evt_...` sulle API amministrative delle tue risorse e sui download. `Origin` resta obbligatorio per le scritture autenticate da cookie; i token Bearer non lo richiedono. Creazione e revoca sono disponibili anche via API con ambiti `tokens:write`; i token derivati ereditano i limiti di accesso e scadenza del padre.

I token non ampliano i permessi dell'utente. Disabilitare API o accesso dei membri ha effetto immediato anche sui token già emessi, lasciando operative le sessioni browser. Il cambio/reset password revoca anche i token API personali.

Dal pulsante **Link pubblico** della lista il proprietario crea link `/s/token` revocabili in sola lettura. Espongono solo titoli, descrizioni, scadenze, stato e tag; allegati e dati personali dei membri restano privati. I token del link vengono mostrati solo alla creazione. Il limite globale di durata si applica anche ai link già esistenti; disattivare la condivisione blocca subito tutti i link senza cambiare i membri delle liste.

## Dati, backup e aggiornamenti

`DATA_DIR` contiene `ervisio.sqlite`, più i file WAL/SHM durante l’esecuzione. Gli allegati sono BLOB nel database: il backup include tutto. Un solo processo applicativo per database; non condividere il volume su filesystem di rete e non scalare più repliche sullo stesso file.

```sh
node --env-file=.env scripts/backup.mjs /percorso/backup
```

La copia usa l’API backup SQLite ed è consistente anche con il servizio attivo. In Docker puoi fermare l’app prima di archiviare il volume, oppure eseguire un backup consistente con `node:sqlite` nel container. Per ripristinare: ferma il servizio, conserva un backup dello stato corrente, ripristina il database nella directory dati, rimuovi eventuali WAL/SHM rimasti dalla vecchia istanza a servizio fermo e riavvia. Non copiare soltanto il file `.sqlite` di un’istanza attiva.

Per aggiornare: backup, `npm ci && npm run build`, riavvio; oppure `docker compose up -d --build`. Non cambiare `AUTH_SECRET` salvo revoca intenzionale di tutte le sessioni. Il database attuale ha schema versione 3; la migrazione dalla versione 1 aggiunge progetti, token, link, registro e stato di accesso utenti senza eliminare i dati. Le liste preesistenti compaiono in Senza progetto. Prima di aggiornare fai un backup.

## Assistente AI facoltativo

I pulsanti appaiono solo con `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` configurati. Il servizio configurato deve esporre `POST /chat/completions` con messaggi e JSON mode. Contesto lista, titolo e descrizione delle attività selezionate vengono inviati a quel servizio su richiesta dell’utente; gli allegati non vengono inviati. Il generatore propone titolo/descrizione nel form, il refactor modifica l’attività e può creare sottoattività. Sono presenti timeout, limiti per utente e validazione della risposta. Questa integrazione non richiede un account AI per l’uso normale di ErvisioTodo.

## Verifica e struttura

```sh
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm audit
# Facoltativo: verifica produzione con Docker e Caddy (porte 3138 e 3443 libere)
docker compose build
npm run test:docker
```

I test unitari usano SQLite temporaneo. Il test browser usa un servizio isolato su 3137 e un server SMTP di prova su 2527/2528; non tocca i dati locali né invia email reali. Il test Docker usa una CA locale di Caddy (non richiede DNS pubblici), verifica SSO tra sottodomini, favicon, scritture e persistenza dopo riavvio; rimuove i propri container, volume e rete al termine. Gli screenshot in `docs/screenshots` mostrano dati di prova. I login reali Google/Discord/Cognito richiedono credenziali e callback del deployment e vanno verificati dopo la configurazione.

- `components/admin/todo/`, `components/TodoApp.tsx`: UI estratta e adattata.
- `lib/server/todo.ts`: modello, validazione e permessi sulle liste.
- `lib/auth.ts`: Auth.js e provider; `lib/server/users.ts`, `mail.ts`: account e token.
- `lib/server/db.ts`: persistenza SQLite; `files.ts`: allegati e immagini.
- `app/api/`: HTTP API; [docs/API.md](docs/API.md) e [docs/openapi.json](docs/openapi.json) descrivono il contratto; `npm run docs:api` rigenera la specifica dal generatore mantenuto in `scripts/`.
- `deploy/`, `Dockerfile`, `compose*.yaml`: installazione e reverse proxy.

Riferimenti verificati: [Auth.js OAuth](https://authjs.dev/getting-started/authentication/oauth), [Google](https://authjs.dev/getting-started/providers/google), [Discord](https://authjs.dev/getting-started/providers/discord), [Cognito](https://authjs.dev/getting-started/providers/cognito), [Cognito authorization endpoint](https://docs.aws.amazon.com/cognito/latest/developerguide/authorization-endpoint.html), [Caddy reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy), [Caddy HTTPS](https://caddyserver.com/docs/automatic-https).
