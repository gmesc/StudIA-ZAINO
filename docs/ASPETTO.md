# Aspetto dell’interfaccia e delle mappe

## Interfaccia

**Impostazioni → Aspetto → Font** offre ZAINO (predefinito) e Atkinson Hyperlegible. La scelta è immediata, locale e persistente sul computer; **Ripristina carattere** torna al predefinito. I font sono già inclusi nell’app, senza download. Il token dell’interfaccia è distinto da quello dei documenti: APPUNTI, stampa ed export mantengono il carattere del documento, PRESENTA e MAPPE mantengono le proprie scelte.

## Mappe

**MAPPE → ingranaggio → Stile e sfondo** contiene i preset **ZAINO, Essenziale, Leggibile, Lavagna e Pastello**, con campioni visivi. I preset coordinano font, dimensioni dei testi, stile dei collegamenti, colori, angoli e spessore. Non modificano contenuti, rimandi, posizioni manuali, zoom o rami chiusi. I colori manuali che identificano i nodi e i segni della loro origine restano distinguibili.

Si possono poi regolare font (catalogo comune di ZAINO), fondo dei nodi, testo, bordi, collegamenti, angoli e spessore. Lo sfondo offre tinta piena, puntini e linee con colori e distanza regolabili, oltre a **Carta cotone, Carta naturale e Carta chiarissima**, le stesse texture locali di PRESENTA. Le carte hanno solo fibre e imperfezioni naturali, senza righe o quadretti. Restano ferme sul contenitore durante pan e zoom della mappa; sono incluse anche nella stampa/PDF. Colore di fondo e controlli del pattern sono disabilitati quando non si applicano alla scelta corrente. La griglia di sfondo non è una griglia di aggancio dei nodi. Le altre leve di disposizione rimangono sotto il pannello richiudibile.

**Senza sfondo** rende trasparente il fondo dei nodi; **Senza bordo** elimina la cornice. Sono scelte indipendenti nelle rispettive palette. Le barre che identificano i rami rimangono visibili e contenute nella sagoma; la cornice temporanea di selezione e l’area cliccabile rimangono disponibili. Anche i ritagli e la stampa conservano la scelta. I collegamenti non scompaiono quando si elimina il bordo dei nodi.

Ogni scelta è annullabile con Undo/Redo e si salva nella `vista.aspetto` del file della mappa, comprese le memorie delle disposizioni. Il main normalizza gli stessi campi con il modulo UMD `mappa/aspetto.js`. Il disegno usa attributi SVG per portare colori, tratti e sfondo anche nella stampa/PDF. Le barre colorate dei nodi arrotondati seguono il profilo interno della cornice, sia in alto sia sul lato sinistro. Nei nodi immagine gli angoli superiori sono retti, in continuità con la fotografia, mentre quelli inferiori seguono il raggio scelto. Anche le immagini hanno una cornice completa, con lo stesso colore e spessore impostati per i nodi: segue foto e didascalia, viene disegnata sopra il ritaglio per restare visibile sui lati a filo e rispetta la scelta Senza bordo. Le barre restano sempre a sinistra, diritte in alto e contenute nel profilo inferiore anche con ritagli larghi o stretti e durante la selezione; usano tracciati autonomi senza riferimenti di clipping fra miniature. La tela mostra il pattern alla scala dell’interfaccia, indipendente dallo zoom dei nodi; la stampa lo include nel disegno completo.

## Video nelle mappe

Aprire una mappa personale e **ALBUM → VIDEO** in due split, quindi trascinare una scheda video sulla tela. Nasce un nodo con miniatura, didascalia modificabile e **Play**. Play (oppure Invio/Spazio sul pulsante) avvia il video direttamente nel nodo, con i controlli nativi per pausa, volume e avanzamento. **Chiudi video** oppure Esc dai controlli torna alla miniatura. Rimane disponibile anche il pallino della fonte per aprire il video nel player dell’ALBUM.

Il nodo si sposta e si collega come gli altri; le maniglie permettono il ridimensionamento proporzionale. L’inserimento è annullabile e si conserva riaprendo la mappa. Il player segue pan e zoom; un ridisegno della mappa, un cambio di strumento nello split o la finestra nascosta interrompe e scarica la riproduzione. Si riproduce un video alla volta. I controlli non trascinano il nodo e la chiusura rimane sopra i pallini SVG.

La miniatura JPEG viene generata localmente dal fotogramma iniziale, entro 640 px sul lato maggiore e 350.000 caratteri di dati codificati. Si conserva nel JSON della mappa insieme al nome del file video, alle proporzioni e all’eventuale scala. Il video originale rimane in MATERIALI/Video e non viene duplicato nel documento. Sono accettati i video dello stesso zaino; gli indirizzi esterni, gli audio e i percorsi arbitrari non diventano nodi video. Codec o file non leggibili danno un messaggio; se il video viene rimosso, la miniatura resta e Play segnala che il file non è disponibile.

**Stampa e PDF** mantengono miniatura, didascalia e simbolo Play cliccabile verso il file originale nello zaino. Il video non è incorporato nel PDF: il collegamento richiede che il file resti raggiungibile e che il lettore PDF consenta l’apertura di collegamenti locali. I video verticali e i ritagli alti sono compresi nel viewBox, evitando tagli nella stampa.

Moduli: `mappa/video.js` per validazione e trasporto; `video-ui.js` per fotogramma e player temporaneo. Le operazioni e la persistenza usano lo stesso normalizzatore. Il renderer SVG puro produce soltanto la resa statica; il foreignObject del player viene aggiunto nel DOM e non finisce nell’export. Nessuna nuova dipendenza o modifica ai permessi del preload.

Verifiche: 97 programmi Node verdi; `mappa-immagini.js` include validazione, rifiuto dei poster attivi, scala, link e geometria verticale. `prova-mappe-video.js`, registrata nel runner sintetico, verifica drag ALBUM, playback reale con mouse/tastiera, stop, cambio strumento, Undo/Redo, disco, riapertura, file mancante e annotazione URI nel PDF. Aspetto/bordi/Multiply verificati con la prova esistente. PDF renderizzato e controllato visivamente. Log `/private/tmp/zaino-mappe-video-suite-node.log`, `/private/tmp/zaino-mappe-video-ui.log` e `/private/tmp/zaino-mappe-video-finale.log`.

## Fusione dei contenuti

In **MAPPE → ingranaggio → Stile e sfondo → Fusione dei contenuti** si sceglie **Normale** oppure **Moltiplica (Multiply)**. La scelta fonde l’intera mappa (nodi, foto/ritagli, testi, bordi, barre e collegamenti) con lo sfondo: il bianco lascia emergere carta o tinta sottostante. Lo sfondo rimane fermo e i controlli dell’interfaccia mantengono il proprio aspetto. La fusione è una proprietà della mappa, salvata in `vista.aspetto.fusione`, annullabile e ripristinabile con Undo/Redo. Normale è il valore predefinito; i preset completi includono questa scelta.

A schermo la fusione si applica allo SVG sopra il contenitore dello sfondo, isolato nella tela. In stampa/miniature si applica al gruppo dei contenuti sopra lo sfondo SVG. Viene applicata una sola volta in ciascuna resa. La stampa/PDF conserva l’effetto. Verifiche: normalizzazione e persistenza in `test/aspetto-svg.js`; controllo UI, Undo/Redo, riapertura, PDF reale e campionamento raster (foto bianca su foglio grigio: 255 → 128) in `prova-aspetto-mappe.js`, log `/private/tmp/zaino-multiply-ui.log`.

## Palette condivisa

I selettori di colore usano la stessa palette locale Tailwind: **22 famiglie × 11 gradazioni**, più Bianco e Nero. Vale per MAPPE (sfondo, pattern, nodi, testi, bordi e collegamenti), PRESENTA, APPUNTI (callout e tabelle), evidenziatore, parole chiave, tinta dei PDF e disegni Excalidraw in LIM, proiezione e APPUNTI. I pulsanti rapidi e gli slot personali restano disponibili; la scelta di un nuovo colore apre sempre Tailwind. I colori già salvati conservano il valore originale: `≈` indica soltanto il nome Tailwind più vicino.

La griglia comune ha campioni da 24 px, 2 px fra le colonne e 6 px fra le righe. È scorrevole e rimane nel viewport, anche dentro un dialogo. Le frecce spostano il focus fra i campioni, Invio sceglie il colore; Esc chiude la palette lasciando aperto il pannello sottostante. La selezione da evidenziare viene conservata mentre si sceglie il colore.

Il modulo `interfaccia/palette.js` riusa il catalogo `presentazioni/colori.js`, senza introdurre Tailwind come framework o scaricare risorse. Excalidraw conserva il proprio editor e applica i colori tramite le sue API pubbliche, con Undo e sincronizzazione. `LimModello.colora` gestisce gli elementi selezionati e il testo legato; le immagini mantengono i propri pixel. Le tinte PDF storiche per nome restano leggibili, mentre le nuove scelte sono salvate come HEX validato.

## Drawably: fattibilità per MAPPE e PRESENTA

Valutazione del 4 novembre 2026; nessuna dipendenza Drawably installata e nessun preset Drawably attivato in questa modifica.

Il progetto [Drawably](https://github.com/danielwh2/drawably) offre controlli HTML decorati con SVG e funzioni pure che producono tracciati: rettangoli arrotondati, linee, ellissi, frecce e riempimenti tratteggiati. Il [renderer](https://github.com/danielwh2/drawably/blob/main/src/rough.ts) permette una casualità riproducibile tramite seed. `boil: 0` mantiene il tratto fermo. La [licenza MIT](https://github.com/danielwh2/drawably/blob/main/LICENSE) consente l’integrazione mantenendo gli avvisi dell’autore.

Per ZAINO è preferibile un preset opzionale **Schizzo**, con la generazione dei tracciati condivisa fra schermo ed export:

- MAPPE: bordi dei nodi, linee e frecce, campiture. Un seed derivato dall’identità dell’elemento mantiene lo stesso tratto nei ridisegni, nel salvataggio e nel PDF.
- PRESENTA: forme, cornici degli oggetti, separatori delle tabelle e parti grafiche della navbar. Titoli e testo conservano il font scelto dall’utente; foto, GIF, video e disegni importati conservano i propri contenuti e possono ricevere una cornice coerente.
- Lo stile viene salvato nel documento e applicato dalla resa comune, senza cambiare geometrie, contenuti o gerarchie. Il tremolio continuo resta disattivato per impostazione predefinita; eventuale movimento sarebbe una scelta esplicita e rispettosa della riduzione del movimento.

Non basta applicare una classe CSS a tutti gli item: MAPPE è SVG e PRESENTA comprende HTML, SVG e media. I wrapper HTML della libreria, che aggiungono SVG nel DOM e osservatori di dimensione, non sostituiscono il motore di disegno o il contratto di export. Si userebbe il renderer puro con un bundle locale e versione fissata, più prove di geometria, salvataggio ed export. La freccia DOM della libreria ha inoltre un limite dichiarato con gli elementi in contenitori scorrevoli; i collegamenti della mappa devono restare nel sistema di coordinate della mappa.

## Verifiche

- `test/aspetto-svg.js`: preset senza mutazione, persistenza su disco, attributi SVG, sfondi, input non validi e DOCX vettoriale con PNG.
- Controprova sul codice precedente: il salvataggio perde `vista.aspetto` e il controllo fallisce.
- `prova-aspetto-mappe.js`: font UI, riavvio, separazione da CodeMirror, preset tramite mouse, Undo/Redo, salvataggio/riapertura e stampa; pannello in finestra 800 px e tema scuro.
- 97 programmi Node verdi e prove mirate APPUNTI/PRESENTA/MAPPE/toolbar verdi. Suite UI generale non interamente verde: dieci fallimenti riprodotti anche sulla base; la nuova interferenza delle miniature con l’audit icone è stata corretta e verificata. Dettagli e log nel handoff corrente.

- Revisione carta/barre del 4 novembre: 97 programmi Node verdi; `prova-aspetto-mappe.js` verifica caricamento delle tre texture, sfondo fermo con rotella, persistenza, PDF reale e pixel degli angoli con raggi 8/24 nei due orientamenti. Toolbar verde. PDF renderizzato e ispezionato. Log `/private/tmp/zaino-mappe-carta-node.log` e `/private/tmp/zaino-mappe-carta-ui-finale.log`.

- Revisione palette del 4 novembre: 97 programmi Node verdi in `/private/tmp/zaino-palette-node.log`; controprove rosse prima delle modifiche a trasparenza dei nodi, tinte PDF e colori Excalidraw. `prova-palette.js` verifica tutti i selettori, geometria e tastiera, viewport a 800/390 px, salvataggio, Undo, selezione trasparente e stampa SVG. Prove mirate PRESENTA, MAPPE, tabelle APPUNTI, disegni APPUNTI, LIM/proiezione e toolbar passate. PDF/DOCX reali generati; nel vettoriale esportato verificato il colore scelto. Il confronto visivo in Word resta da fare. Log finali `/private/tmp/zaino-palette-finale.log` e `/private/tmp/zaino-palette-lim-toolbar.log`; quest’ultimo precede la correzione dell’audit icone, che ora distingue i comandi ZAINO da quelli nativi Excalidraw. Suite UI generale non ripetuta.
