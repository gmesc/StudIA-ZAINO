# Disegni modificabili e livelli delle figure in APPUNTI

La toolbar di ciascun editor offre **Inserisci disegno modificabile**. La finestra Excalidraw locale permette forme, frecce, linee, testo e tratto libero. **Inserisci disegno** lo colloca al cursore, fra paragrafi; **Annulla** non modifica l’appunto. Il doppio clic sul disegno nell’anteprima riapre gli elementi originali.

Un clic o il menu contestuale su un disegno o un’immagine apre i controlli di larghezza e allineamento. **Porta sopra** sovrappone la figura davanti al testo; **Porta sotto** la mette dietro. **In linea** torna alla figura che occupa spazio fra i paragrafi. Trascinando una figura la si può posizionare liberamente sopra il foglio. **Posiziona liberamente** mostra una maniglia anche per una figura dietro al testo: trascinamento, frecce (1 px) e Maiusc+frecce (10 px); Esc chiude o annulla un trascinamento. Il punto Markdown resta l’ancora: se si aggiungono paragrafi prima, il disegno segue il suo contesto. **In linea** azzera la posizione libera. Lo spostamento si annulla con un solo Undo. Le immagini dell’album conservano il comando per aprire l’originale.

## Conservazione

Il Markdown contiene una normale immagine relativa e un commento con le proprietà:

````markdown
![Disegno|60%](_disegni/UUID.svg)
<!-- zaino-figura {"align":"center","layer":"back","x":32,"y":2.5} -->
````

Le coordinate sono relative al foglio: x in percentuale della larghezza e y in em rispetto all’ancora. Si conservano fra split, zoom, riaperture ed export. I bordi del foglio limitano il trascinamento; non è un impaginatore con pagine fisse o testo che scorre intorno alla sagoma.

I disegni nuovi o aggiornati usano **SVG**, generato con `exportToSvg`: forme, frecce e testo restano vettoriali e i font del disegno sono incorporati. Per ogni UUID si conservano tre file in `APPUNTI/_disegni`: lo SVG per il Markdown, un PNG con la scena Excalidraw incorporata da `exportToBlob`, e un JSON con la rappresentazione grafica validata. Il doppio clic recupera la scena originale dal PNG con `loadFromBlob`. I vecchi riferimenti PNG continuano a funzionare; modificando e confermando un vecchio disegno si produce una nuova versione SVG.

Ogni aggiornamento crea una nuova versione; i file precedenti restano per Undo e per le versioni degli appunti. Il salvataggio passa dalla whitelist del preload e dalla scrittura atomica. Il renderer non sceglie percorsi o nomi. SVG è ricostruito da soli elementi e attributi grafici ammessi, con font locali in base64: non sono accettati script, collegamenti esterni o markup arbitrario. A schermo arriva una data URL generata dal main; la politica che blocca gli SVG arbitrari del vault resta invariata.

Limiti: PNG massimo 24 MB e lato esportato massimo 3200 px; vettori fino a 2000 elementi, albero/scene di 2 MB e font incorporati entro 16 MB complessivi. Sono disponibili forme, frecce, testo e tratti, senza immagini incorporate o collegamenti. Gli errori lasciano aperto il dialogo con il lavoro corrente. L’importazione di un SVG generico come elementi Excalidraw modificabili non è implementata: questa funzione riguarda i disegni creati o aggiornati nell’editor integrato.

Le figure devono occupare una riga autonoma nel Markdown per avere questi comandi. Le immagini in mezzo a una frase conservano la resa precedente. Le figure aggiunte dall’interfaccia vengono già collocate su righe autonome.

## PDF e DOCX

Il PDF mantiene aspetto e sovrapposizione della figura rispetto al testo. Il DOCX incorpora SVG e un PNG di compatibilità per i lettori che non supportano il vettoriale: le figure in linea sono immagini normali; quelle sovrapposte usano ancoraggi Word, allineamento/coordinate e proprietà davanti/dietro al documento. I footer restano presenti. I vettori si modificano in ZAINO; in Word il disegno è una figura. L’impaginazione può variare secondo il lettore Word.

## Verifica

96 programmi Node verdi: `/private/tmp/zaino-disegni-node.log`. `test/appunti-figure.js` verifica roundtrip delle proprietà, dati rifiutati, percorsi, privilegi e ancoraggi DOCX davanti/dietro.

`bash bin/prova-zaino.sh prova-appunti-disegni.js prova-appunti-tabelle.js prova-editor-pari.js prova-appunti-docx.js` è verde, con vault e documenti sintetici. Verifica mouse reale, salvataggio PNG con metadati, doppio clic, riapertura della scena, aggiunta freccia, dimensione, allineamento, foto dell’album, file originali conservati, PDF e DOCX. Corretto anche il mancato aggiornamento immediato dell’anteprima dopo `noteInserisci`.

Campioni: `/private/tmp/zaino-disegni-prova.pdf` e `.docx`. PDF renderizzato e ispezionato; nel DOCX controllati PNG e ancoraggi OOXML. Rendering visivo in Microsoft Word non verificato.

Moduli: `appunti/figure.js`, `figure-ui.js`, `figure.css`, `lib/appunti-disegni.js`; esteso il renderer e il ponte sincrono esistenti. Il runtime Excalidraw locale è rigenerato da `bin/lim-editor.js` per esporre `exportToBlob` e `loadFromBlob`; il bundle generato contiene spazi finali nelle stringhe localizzate upstream.

API ufficiali: https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/utils/export

## Aggiornamento SVG e aspetto — 4 novembre 2026

Impostazioni → Aspetto permette di scegliere Atkinson Hyperlegible per l’interfaccia, con ripristino. Il pannello MAPPE → ingranaggio → Stile e sfondo offre preset completi e sfondi: dettagli in [ASPETTO.md](ASPETTO.md).

`test/aspetto-svg.js` verifica validazione del vettoriale e DOCX con SVG/PNG. `prova-appunti-disegni.js` verifica salvataggio reale SVG, font Excalifont incorporato, riapertura della scena, posizionamento, immutabilità delle versioni e PDF/DOCX. Il PDF è stato renderizzato e ispezionato; SVG, PNG e font incorporato sono presenti nel DOCX. Il confronto visivo in Microsoft Word resta da eseguire con l’utente.

API ufficiali: [Export Utilities di Excalidraw](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/utils/export).

Verifica del posizionamento libero: `test/appunti-figure.js` controlla coordinate, zoom, limiti, ridimensionamento entro il margine e serializzazione. Le controprove sul codice precedente rifiutano la nuova operazione e i nuovi bordi delle tabelle. `prova-appunti-disegni.js` trascina davvero disegno e foto, confronta la geometria a video, prova frecce, Undo/Redo ed esportazione. Log `/private/tmp/zaino-impaginazione-figura-finale.log`; test di parità/editor/export in `/private/tmp/zaino-impaginazione-finale.log`. PDF renderizzati e ispezionati; DOCX controllato nella struttura, ancora da aprire in Word per il collaudo visivo.
