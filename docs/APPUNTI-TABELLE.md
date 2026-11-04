# Tabelle in APPUNTI

Il comando **Inserisci o modifica tabella** nella toolbar apre l’editor a celle. Nell’anteprima basta cliccare la tabella. Si possono aggiungere righe e colonne dopo la cella selezionata, eliminare la riga o colonna corrente, scegliere l’intestazione e modificare font, dimensione, colori, allineamento, grassetto, corsivo e sottolineato. I comandi Grassetto/Corsivo/Codice formattano la selezione nella cella con Markdown. Annulla chiude senza applicare; Applica sostituisce soltanto la tabella, in un’operazione Undo. La rimozione di celle piene richiede conferma. Limiti: 50 righe, 20 colonne.

In PRESENTA selezionare l’oggetto tabella e usare **Copia oggetto** oppure ⌘/Ctrl+C fuori dai campi di testo. Incollare nell’appunto con ⌘/Ctrl+V. Il comando mantiene anche la copia interna fra slide. Gli appunti di sistema contengono i dati della tabella con font, dimensione, colore, sfondo, allineamento ed enfasi; APPUNTI li interpreta senza passare da HTML arbitrario. Non sono importate animazioni o posizione sulla slide. Le tabelle semplici scritte con la sintassi Markdown a barre verticali sono riconosciute quando iniziano un blocco.

Il file rimane Markdown: le tabelle formattate sono recinti `zaino-tabella` con un oggetto JSON versionato e validato. Nessun HTML viene eseguito. Gli appunti precedenti conservano la loro sintassi e gli altri blocchi non vengono riscritti. Il dialogo controlla che file, istanza e contenuto non siano cambiati prima di applicare modifiche.

PDF e DOCX usano la stessa tabella resa nell’anteprima. In PDF si ripetono le intestazioni e si evitano interruzioni dentro una riga. DOCX conserva celle modificabili, font, dimensioni, colori, sfondi, enfasi, allineamento, didascalie e rimandi già supportati dal convertitore. Il footer con titolo e pagina X di Y rimane. La disponibilità dei font e la paginazione del lettore Word possono produrre differenze rispetto al PDF.

## Barre e controlli

Il dialogo è centrato nel viewport dell’app, anche quando APPUNTI occupa uno split piccolo. La prima barra contiene aggiunta/eliminazione di righe e colonne, **Stile**, Annulla e Applica; la seconda **Testo · Bordi · Colore**. I bottoni di barra sono separati da linee verticali. Le celle scorrono all’interno del dialogo; l’aiuto Markdown appare nel tooltip della cella.

Stile riusa i temi **Essenziale, Leggibile e Lavagna** del catalogo di PRESENTA, adattando accento, intestazione e font alla tabella. Il cambio di preset conserva il contenuto. Font con anteprima, Peso, Dimensione, G/C/S, allineamenti e Interlinea usano le classi e i controlli condivisi con PRESENTA (`interfaccia/tipografia.js`). Il catalogo comune comprende Atkinson, Atkinson Next, TestMe e TestMe Alternate, oltre ai font di sistema. I font interni della tela Excalidraw hanno un catalogo della libreria distinto: non sono modificati da questo selettore.

Bordi offre righe/griglia/nessuno, tratto continuo/tratteggiato/puntinato, spessore e colore. Colore regola testo, fondo e intestazione. I dati passano nel Markdown e negli export; Word usa il proprio motore di impaginazione e deve avere disponibile il font scelto. I pesi intermedi delle famiglie variabili sono resi nel DOCX mediante normale/grassetto, come nelle formattazioni Word standard.

I campioni dei preset non sono appunti: il gestore delegato apre l’editor solo per una tabella dentro un blocco dell’appunto. Questo evita l’apertura di un secondo dialogo quando si seleziona il campione di stile.

## Verifiche del 4 novembre 2026

- 96 programmi Node verdi: `/private/tmp/zaino-impaginazione-node-completo.log`.
- `test/appunti-tabelle.js`: roundtrip, stili da PRESENTA, dati non validi e testo non eseguibile; controprova rossa togliendo gli stili.
- `test/cdp/prova-appunti-tabelle.js`: comando toolbar, modifica in anteprima, aggiunta riga, copia tramite scorciatoia di PRESENTA, incolla, riapertura e scrittura reale PDF/DOCX. La prova intercetta il contenuto scritto negli appunti di sistema, senza sovrascrivere il clipboard personale, e lo passa all’evento di incolla.
- Export DOCX precedente e parità dei due editor verificati. La toolbar è verde su un’istanza pulita (`/private/tmp/zaino-tabelle-toolbar.log`); nella sequenza di prove precedente aveva incontrato un problema di stato residuo nella chiusura dell’appunto.
- Verifiche UI verdi: `/private/tmp/zaino-impaginazione-finale.log`, `/private/tmp/zaino-tipografia-presenta.log` e `/private/tmp/zaino-impaginazione-drag-responsive.log`. Comprendono font/preset, bordi DOCX, dialogo centrato a 800 px, regressioni dei due editor APPUNTI e PRESENTA.
- Prove esportate: `/private/tmp/zaino-tabelle-prova.pdf` e `.docx`. PDF renderizzato e ispezionato; DOCX verificato nella struttura OOXML. Verifica visiva finale in Microsoft Word da eseguire con l’utente.

Moduli: `App/assets/appunti/tabelle.js` (contratto e resa), `tabelle-ui.js` (dialogo e incolla), `tabelle.css`. Il trasferimento passa dal comando copia esistente di PRESENTA; il renderer DOCX raccoglie gli stili delle celle.
