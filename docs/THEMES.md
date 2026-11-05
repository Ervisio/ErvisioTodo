# Temi personali

In **Impostazioni → Le tue preferenze → Tema** puoi scegliere Sistema, Chiaro, Scuro, AMOLED, Tokyo Night, GitHub Dark, Dracula, Catppuccin Mocha, Nord e Solarized Light. AMOLED usa nero puro per sfondo pagina e pannelli; l’accento è modificabile.

La palette personale si applica a navigazione, liste, schede, finestre, dettagli e impostazioni. Il selettore Lista/Schede rimane a destra. La voce attiva della sidebar usa una linea sottile, testo più deciso e icona accentata, senza riempimento colorato.

Il colore accento si modifica con campioni, codice HEX o il selettore con tonalità, saturazione e luminosità. Il testo dei pulsanti si adatta al contrasto dell’accento. Ripristina accento riapplica il valore della palette.

**Crea tema** parte dalla palette attuale. Puoi personalizzare nome, modalità chiara/scura, sfondo, pannelli, superfici secondarie, testo, testo secondario, bordi, accento, errori e conferme. L’anteprima è locale all’editor; Salva tema applica il risultato. Il salvataggio controlla il contrasto del testo rispetto agli sfondi. Sono disponibili modifica, duplicazione, eliminazione e importazione/esportazione JSON; massimo 20 temi personali. Le importazioni controllano struttura, colori, contrasto e dimensione del file.

Le preferenze e i temi personali sono conservati su questo browser/dispositivo. Un cookie contiene la palette attiva per applicarla già nel rendering del server, evitando il cambio di colori dopo un refresh. Esporta temi consente di trasferire la libreria su un altro dispositivo.

I colori e il branding già salvati nelle liste non vengono modificati. **Usa i colori delle liste** è disattivato per impostazione predefinita: se lo attivi, i contenuti della lista usano lo sfondo e l’accento configurati dal proprietario. Le nuove liste seguono lo sfondo del tema personale anche con i colori delle liste abilitati. Nel form lista, **Usa lo sfondo del tema** rimuove lo sfondo personalizzato; un colore HEX lo sostituisce. Nell’API `backgroundColor` vuoto (`""`, valore predefinito) indica questa eredità. I colori espliciti delle liste esistenti sono preservati. Il resto dell’interfaccia mantiene la palette personale. Nome, icona, favicon e URL della lista rimangono indipendenti dal tema personale.

## Riferimenti delle palette

Le palette sono adattate all’interfaccia ErvisioTodo; testo secondario, bordi e colori di stato possono differire dai temi degli editor per mantenere la leggibilità.

- [Tokyo Night](https://github.com/tokyo-night/tokyo-night-vscode-theme), [definizione dei colori](https://github.com/tokyo-night/tokyo-night-vscode-theme/blob/master/themes/tokyo-night-color-theme.json).
- [GitHub / Primer](https://github.com/primer/github-vscode-theme).
- [Dracula: palette OSS](https://github.com/dracula/dracula-theme#color-palette-oss).
- [Catppuccin: palette](https://github.com/catppuccin/palette).
- [Nord: palette](https://github.com/nordtheme/nord/blob/develop/src/nord.scss).
- [Solarized](https://ethanschoonover.com/solarized/).

Le definizioni mantenute nell’app si trovano in `lib/themes.ts`; tutti i componenti consumano le stesse variabili CSS. Il branding delle liste non scrive più le variabili di tema della pagina.
