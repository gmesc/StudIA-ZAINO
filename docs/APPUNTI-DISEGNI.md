# Disegni modificabili e livelli delle figure in APPUNTI

La toolbar di ciascun editor offre **Inserisci disegno modificabile**. La finestra Excalidraw locale permette forme, frecce, linee, testo e tratto libero. **Inserisci disegno** lo colloca al cursore, fra paragrafi; **Annulla** non modifica l’appunto. Il doppio clic sul disegno nell’anteprima riapre gli elementi originali.

Un clic o il menu contestuale su un disegno o un’immagine apre i controlli di larghezza e allineamento. **Porta sopra** sovrappone la figura davanti al testo; **Porta sotto** la mette dietro. **In linea** torna alla figura che occupa spazio fra i paragrafi. Trascinando una figura la si può posizionare liberamente sopra il foglio. **Posiziona liberamente** mostra una maniglia anche per una figura dietro al testo: trascinamento, frecce (1 px) e Maiusc+frecce (10 px); Esc chiude o annulla un trascinamento. Il punto Markdown resta l’ancora: se si aggiungono paragrafi prima, il disegno segue il suo contesto. **In linea** azzera la posizione libera. Lo spostamento si annulla con un solo Undo. Le immagini dell’album conservano il comando per aprire l’originale.

## Conservazione

Il Markdown contiene una normale immagine relativa e un commento con le proprietà:

````markdown
![Disegno|60%](_disegni/UUID.png)
<!-- zaino-figura {"align":"center","layer":"back","x":32,"y":2.5} -->
````

Le coordinate sono relative al foglio: x in percentuale della larghezza e y in em rispetto all’ancora. Si conservano fra split, zoom, riaperture ed export. I bordi del foglio limitano il trascinamento; non è un impaginatore con pagine fisse o testo che scorre intorno alla sagoma.

La scena vettoriale è incorporata nel PNG da `exportToBlob` di Excalidraw con `exportEmbedScene`. Non viene salvata una semplice schermata: `loadFromBlob` recupera gli elementi modificabili. I PNG sono in `APPUNTI/_disegni`, con nomi UUID generati nel main. Ogni aggiornamento crea una nuova versione e sostituisce il riferimento nel solo appunto corrente. Le precedenti restano disponibili per Undo e per le versioni salvate degli appunti; non vengono cancellate automaticamente.

Il salvataggio passa dalla whitelist sincrona del preload, valida contenuto PNG, dimensioni e presenza dei metadati Excalidraw, e usa la scrittura atomica. Il renderer non sceglie percorsi o nomi dei file. Limiti: PNG massimo 24 MB, esportazione a lato massimo 3200 px; il disegno ammette forme, frecce, testo e tratti, senza immagini incorporate o collegamenti. Gli errori sono mostrati nel dialogo, che rimane aperto con il lavoro corrente.

Le figure devono occupare una riga autonoma nel Markdown per avere questi comandi. Le immagini in mezzo a una frase conservano la resa precedente. Le figure aggiunte dall’interfaccia vengono già collocate su righe autonome.

## PDF e DOCX

Il PDF mantiene aspetto e sovrapposizione della figura rispetto al testo. Il DOCX incorpora il PNG: le figure in linea sono immagini normali; quelle sovrapposte usano ancoraggi Word, allineamento/coordinate e proprietà davanti/dietro al documento. I footer restano presenti. I vettori si modificano in ZAINO; in Word il disegno è una figura. L’impaginazione può variare secondo il lettore Word.

## Verifica

96 programmi Node verdi: `/private/tmp/zaino-disegni-node.log`. `test/appunti-figure.js` verifica roundtrip delle proprietà, dati rifiutati, percorsi, privilegi e ancoraggi DOCX davanti/dietro.

`bash bin/prova-zaino.sh prova-appunti-disegni.js prova-appunti-tabelle.js prova-editor-pari.js prova-appunti-docx.js` è verde, con vault e documenti sintetici. Verifica mouse reale, salvataggio PNG con metadati, doppio clic, riapertura della scena, aggiunta freccia, dimensione, allineamento, foto dell’album, file originali conservati, PDF e DOCX. Corretto anche il mancato aggiornamento immediato dell’anteprima dopo `noteInserisci`.

Campioni: `/private/tmp/zaino-disegni-prova.pdf` e `.docx`. PDF renderizzato e ispezionato; nel DOCX controllati PNG e ancoraggi OOXML. Rendering visivo in Microsoft Word non verificato.

Moduli: `appunti/figure.js`, `figure-ui.js`, `figure.css`, `lib/appunti-disegni.js`; esteso il renderer e il ponte sincrono esistenti. Il runtime Excalidraw locale è rigenerato da `bin/lim-editor.js` per esporre `exportToBlob` e `loadFromBlob`; il bundle generato contiene spazi finali nelle stringhe localizzate upstream.

API ufficiali: https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/utils/export

## Vettoriale e preferenze di interfaccia

Excalidraw espone `exportToSvg`, già incluso nel runtime locale. È possibile sviluppare una rappresentazione SVG con la scena originale per la riapertura: l’attuale formato è PNG con scena incorporata, non SVG. Un SVG generico importato non diventa automaticamente un insieme di elementi Excalidraw. Un’eventuale importazione SVG deve essere validata come contenuto grafico; il DOCX dovrebbe mantenere un fallback PNG per i lettori che non supportano SVG.

Font UI: Atkinson e TestMe sono già distribuiti localmente. Un futuro menu Impostazioni → Aspetto può salvare il font dell’interfaccia separatamente dal font dei documenti e intervenire sul token `--font-text`, con anteprima e ripristino. Occorre verificare testo troncato, misure delle toolbar, finestre strette e tema scuro. Atkinson sarebbe la prima alternativa proposta; TestMe una scelta personale. Nessuna preferenza UI dell’utente è stata modificata.

Fonti: [API export Excalidraw](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/utils/export), [Atkinson del Braille Institute](https://www.brailleinstitute.org/freefont/), [TestMe degli autori](https://github.com/molotro/TestMe02).

MAPPE: clic destro su un nodo → colore (con opzione per i discendenti); ingranaggio → dimensioni testi/card, distanze e stile delle linee. Non è ancora disponibile un pannello di preset completi dei nodi né la scelta dello sfondo della mappa.

Verifica del posizionamento libero: `test/appunti-figure.js` controlla coordinate, zoom, limiti, ridimensionamento entro il margine e serializzazione. Le controprove sul codice precedente rifiutano la nuova operazione e i nuovi bordi delle tabelle. `prova-appunti-disegni.js` trascina davvero disegno e foto, confronta la geometria a video, prova frecce, Undo/Redo ed esportazione. Log `/private/tmp/zaino-impaginazione-figura-finale.log`; test di parità/editor/export in `/private/tmp/zaino-impaginazione-finale.log`. PDF renderizzati e ispezionati; DOCX controllato nella struttura, ancora da aprire in Word per il collaudo visivo.
