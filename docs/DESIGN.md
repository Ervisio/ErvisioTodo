# ErvisioTodo: rework UI e UX

Stato: mockup in revisione. L’utente ha respinto il round 005 e chiesto una UI «più minimal e moderna, material». Ha sostituito la skill designer con frontend-design. Manteniamo senior-craft, Variant Studio e stop-slop.

## Ambito

Spazio di lavoro, navigazione progetto/lista, attività e dettaglio, per desktop e mobile. Nessuna modifica all’app o al database. La distribuzione come plugin Ervisio verrà affrontata in una fase successiva.

Contenuti e struttura delle attività provengono da `tests/app.spec.ts`. Sidebar richiudibile, viste Lista/Schede e icone Font Awesome conservano le scelte già approvate nelle sessioni precedenti.

## Direzione attuale

Round: `.variant-studio/rounds/006-material-ui/`.

- **Rail essenziale**: navigazione compatta, selettore delle liste in alto e contenuto centrato.
- **Workspace Material**: sidebar estesa, lista e dettaglio su superfici distinte.
- **Liste a pannelli**: liste affiancate nel progetto, apertura della singola lista dal pannello.

Abbiamo rimosso titoli serif, numerazione decorativa e copertina editoriale del round precedente. La nuova direzione usa Manrope, superfici neutre, controlli tonali e raggio diverso per contenitori, righe, pulsanti e checkbox. La vista a pannelli rappresenta liste reali, senza introdurre stati Kanban.

## Token

Fonte: `006-material-ui/tokens.css`.

| Ruolo             | Valore chiaro |
| ----------------- | ------------- |
| Contenuto         | `#ffffff`     |
| Fondo             | `#f4f6fa`     |
| Superficie tonale | `#e7ebf2`     |
| Testo             | `#20252d`     |
| Testo secondario  | `#5a6575`     |
| Bordo             | `#e1e6ee`     |
| Primario          | `#245ac2`     |
| Selezione         | `#e4edff`     |

Il blu è una proposta modificabile nell’Inspector, non una decisione definitiva sul brand. Il tema scuro ha una palette dedicata. I font risiedono nel round per evitare dipendenze dal caricamento remoto durante l’anteprima.

## Interazioni

Ricerca, filtro tag, preferite, passaggio Lista/Schede, selezione della lista, dettaglio e creazione in un dialog. Aggiunta e completamento modificano solo i dati in memoria del mockup. Il completamento della task padre include le sue sottoattività.

Stati vuoto, caricamento ed errore e scenario con testi lunghi si selezionano nella galleria. Le azioni distruttive restano nel menu secondario. Condivisione, allegati e impostazioni mostrano un messaggio esplicito: il mockup non chiama questi servizi.

La barra superiore Ervisio propone un contesto per il plugin; occorre verificare i contratti reali della shell prima dell’integrazione.

## Verifica

`006-material-ui/_qa.mjs` verifica le tre varianti a 1440 × 900, 1280 × 800 e 390 × 844. Controlla overflow, apertura e chiusura del dettaglio, cambio vista, creazione locale e stati. Gli screenshot includono il tema scuro con titoli lunghi. Nessun errore JavaScript nelle anteprime al controllo.

Focus visibile, nomi accessibili, stato tramite `aria-pressed`, dialog nativo e target touch da 44 px sui controlli principali. Non abbiamo eseguito una verifica con screen reader.

La galleria installata ha segnalato `layoutCompare is not defined` durante l’avvio; le anteprime e il flusso di feedback restano utilizzabili. Non abbiamo modificato il codice della skill.

## Implementazione successiva

Dopo la scelta, tradurre la direzione nei componenti React esistenti, conservando dati, callback, temi personali e autorizzazioni. Leggere prima le guide della versione installata di Next.js in `node_modules/next/dist/docs/`. Questa fase non aggiunge dipendenze al progetto.

## Revisione: sottoattività e interazioni

L’utente ha scelto B come base da rivedere, senza approvare l’implementazione. Nel round 007 confrontiamo tre modelli di sottoattività: checklist espandibile per livello, checklist nel dettaglio, gruppo compatto con indicazione del genitore.

Correzioni comuni: logo nell’header, icone della sidebar in slot fissi, hover circolare dei checkbox, selezione della task solo quando il dettaglio la mostra, preferite e contatori coerenti. Il dettaglio permette di completare e riaprire le sottoattività.

Movimento: indicatore scorrevole dei filtri, accordion a griglia, comparsa e chiusura del dettaglio, dialog e menu, conferma del checkbox e delle preferite. Usiamo i pattern di transitions-dev con riduzione del movimento tramite media query. Nessuna libreria runtime aggiunta.

Lo script `007-sottoattivita-material/_qa.mjs` ha verificato le tre dimensioni precedenti, selezioni, cascata del completamento, riapertura degli antenati, cambio dettaglio, viste, creazione locale, ricerca, stati e preferenza di movimento ridotto. Nessun errore JavaScript nelle anteprime.

## Revisione: albero dei progetti

Il round 008 mantiene la gestione delle sottoattività nel dettaglio e confronta un albero con linea di gerarchia con un rientro senza linea e freccia a destra. Le liste si trovano sotto il livello della cartella in entrambe le alternative.

Il gruppo usa un accordion a griglia, con opacità e freccia animate e inversione durante il movimento. Quando il gruppo si chiude, `inert` esclude le liste dal focus. La verifica del round copre posizione delle icone, animazione reversibile, navigazione, sidebar compatta, mobile e movimento ridotto.

## Direzione approvata

Il 4 novembre 2026 l’utente ha approvato B del round 008, **Rientro pulito**. La direzione definitiva combina Workspace Material, sottoattività nel dettaglio e sidebar con cartella allineata alle altre icone, freccia a destra e liste rientrate. Manteniamo le transizioni e le correzioni delle selezioni dei round precedenti.

Anteprima autonoma: [ervisio-todo.html](design/ervisio-todo.html). Include CSS, font e interazioni locali; non richiede Studio e non chiama il database. Le operazioni di condivisione, modifica e impostazioni restano dimostrative. Il mockup rappresenta la direzione approvata, non un’integrazione nell’app Next.js.

Font, colori e misure completi risiedono nei token del round 008, incorporati anche nell’anteprima. Non riaprire il confronto sulle alternative scartate senza una nuova richiesta. La prossima fase applicherà la direzione ai componenti reali e verificherà i flussi autenticati prima di affrontare il plugin Ervisio.
