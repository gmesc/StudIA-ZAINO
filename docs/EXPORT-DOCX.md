# APPUNTI: esportazione DOCX locale

L’icona di download apre il bubble menu **.PDF / .DOCX**. Funziona nelle due istanze di APPUNTI, anche con modifiche non ancora salvate. La scelta resta legata all’appunto da cui è stato aperto il menu; cambiare appunto prima della scelta richiede di riaprire il menu.

Il file Word contiene testo modificabile: titoli, enfasi, elenchi, citazioni, collegamenti, evidenziature e callout. I callout sono celle con fondo tenue e bordo colorato, con i colori personalizzati e l’icona. Le immagini dell’album e le figure sono incorporate come PNG, con didascalie e proporzioni. I rimandi interni diventano riferimenti testuali con fonte, pagina o secondo; i link web restano cliccabili. Le postille delle evidenze vengono riportate fra parentesi.

Il footer contiene il nome dell’appunto e i campi Word `PAGE` e `NUMPAGES`. La richiesta di aggiornare i campi è salvata nel documento. A4, margini e scala dei titoli seguono il foglio PDF. La paginazione effettiva dipende dal motore Word e dai font presenti: non è una copia pixel per pixel del PDF. L’export non incorpora i font.

Le immagini oltre 3200 px vengono ridimensionate proporzionalmente; le GIF sono statiche, con avviso dopo il salvataggio. Una figura mancante o non leggibile interrompe l’export invece di sparire. I riferimenti a fonti rimosse conservano il testo e segnalano la fonte non disponibile. Gli elementi sconosciuti al convertitore producono un errore esplicito. Le tabelle sono supportate dal convertitore quando presenti nell’albero di contenuto: l’export non aggiunge una sintassi tabellare al parser Markdown dell’editor.

## Architettura

- `App/assets/appunti/export-dom.js` raccoglie il DOM già prodotto da `renderNoteMd`, senza un secondo parser Markdown. Risolve e incorpora le immagini prima di mandare i dati al main.
- `App/assets/appunti/documento.js` definisce il contratto indipendente dal DOM e i limiti del documento; viene validato nuovamente nel main.
- `lib/appunti-docx.js` costruisce il documento con **docx 9.15.2**, caricato solo al momento dell’esportazione. Non legge file e non accede alla rete.
- `stampa:docx` passa dal dialogo nativo e dalla scrittura atomica già usati dagli export. Il renderer non può scegliere un percorso di destinazione né far leggere file arbitrari al convertitore.

API ufficiali: [Packer](https://docx.js.org/api/classes/index.Packer.html), [PageNumber](https://docx.js.org/api/variables/index.PageNumber.html).

## Verifica

`node test/appunti-docx.js` ispeziona il contenuto OOXML: stili, immagini, fonti, liste e continuazioni, tabelle, footer e dati rifiutati. La controprova senza `NUMPAGES` è rossa.

`bash bin/prova-zaino.sh prova-appunti-docx.js prova-stampa.js` verifica i due editor, l’istanza di origine anche cambiando focus, il menu, Escape, il salvataggio reale DOCX/PDF, annullamento e immagini mancanti. Usa esclusivamente appunti e immagini sintetici. La prova DOCX è nel registro sintetico `bin/prova-zaino.sh`, non in quello storico basato su un vault personale.

La prova lascia `/private/tmp/zaino-docx-prova.docx` e `/private/tmp/zaino-docx-prova.pdf` per il confronto. L’anteprima Quick Look è stata ispezionata; la verifica finale della fedeltà in Word resta da fare insieme all’utente. Il tentativo automatico di apertura in Word ha incontrato il selettore di autorizzazione al file temporaneo e non costituisce una verifica del rendering Word.

Esito del 4 novembre 2026: 94 programmi Node verdi; verifiche mirate DOCX, parità editor, toolbar, PDF e sicurezza verdi. La suite UI generale eseguita segnala 9 prove fallite su altre funzionalità (log `/private/tmp/zaino-docx-ui-completa.log`). La prova delle citazioni PDF fallisce anche come prima prova su un vault appena creato; le cinque verifiche mirate successive passano (`/private/tmp/zaino-docx-ui-mirata.log`). Non è stato eseguito un merge in main.
