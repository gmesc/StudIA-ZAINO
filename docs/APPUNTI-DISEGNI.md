# Disegni modificabili e livelli delle figure in APPUNTI

La toolbar di ciascun editor offre **Inserisci disegno modificabile**. La finestra Excalidraw locale permette forme, frecce, linee, testo e tratto libero. **Inserisci disegno** lo colloca al cursore, fra paragrafi; **Annulla** non modifica l’appunto. Il doppio clic sul disegno nell’anteprima riapre gli elementi originali.

Un clic o il menu contestuale su un disegno o un’immagine apre i controlli di larghezza e allineamento. **Porta sopra** sovrappone la figura davanti al testo; **Porta sotto** la mette dietro. **In linea** torna alla figura che occupa spazio fra i paragrafi. I livelli sono ancorati al punto di inserimento; non spostano il disegno ad altri paragrafi e non introducono una tela libera sopra l’intero documento. Le immagini dell’album conservano il comando per aprire l’originale.

## Conservazione

Il Markdown contiene una normale immagine relativa e un commento con le proprietà:

````markdown
![Disegno|60%](_disegni/UUID.png)
<!-- zaino-figura {"align":"center","layer":"back"} -->
````

La scena vettoriale è incorporata nel PNG da `exportToBlob` di Excalidraw con `exportEmbedScene`. Non viene salvata una semplice schermata: `loadFromBlob` recupera gli elementi modificabili. I PNG sono in `APPUNTI/_disegni`, con nomi UUID generati nel main. Ogni aggiornamento crea una nuova versione e sostituisce il riferimento nel solo appunto corrente. Le precedenti restano disponibili per Undo e per le versioni salvate degli appunti; non vengono cancellate automaticamente.

Il salvataggio passa dalla whitelist sincrona del preload, valida contenuto PNG, dimensioni e presenza dei metadati Excalidraw, e usa la scrittura atomica. Il renderer non sceglie percorsi o nomi dei file. Limiti: PNG massimo 24 MB, esportazione a lato massimo 3200 px; il disegno ammette forme, frecce, testo e tratti, senza immagini incorporate o collegamenti. Gli errori sono mostrati nel dialogo, che rimane aperto con il lavoro corrente.

Le figure devono occupare una riga autonoma nel Markdown per avere questi comandi. Le immagini in mezzo a una frase conservano la resa precedente. Le figure aggiunte dall’interfaccia vengono già collocate su righe autonome.

## PDF e DOCX

Il PDF mantiene aspetto e sovrapposizione della figura rispetto al testo. Il DOCX incorpora il PNG: le figure in linea sono immagini normali; quelle sovrapposte usano ancoraggi Word, allineamento e proprietà davanti/dietro al documento. I footer restano presenti. I vettori si modificano in ZAINO; in Word il disegno è una figura. L’impaginazione può variare secondo il lettore Word.

## Verifica

96 programmi Node verdi: `/private/tmp/zaino-disegni-node.log`. `test/appunti-figure.js` verifica roundtrip delle proprietà, dati rifiutati, percorsi, privilegi e ancoraggi DOCX davanti/dietro.

`bash bin/prova-zaino.sh prova-appunti-disegni.js prova-appunti-tabelle.js prova-editor-pari.js prova-appunti-docx.js` è verde, con vault e documenti sintetici. Verifica mouse reale, salvataggio PNG con metadati, doppio clic, riapertura della scena, aggiunta freccia, dimensione, allineamento, foto dell’album, file originali conservati, PDF e DOCX. Corretto anche il mancato aggiornamento immediato dell’anteprima dopo `noteInserisci`.

Campioni: `/private/tmp/zaino-disegni-prova.pdf` e `.docx`. PDF renderizzato e ispezionato; nel DOCX controllati PNG e ancoraggi OOXML. Rendering visivo in Microsoft Word non verificato.

Moduli: `appunti/figure.js`, `figure-ui.js`, `figure.css`, `lib/appunti-disegni.js`; esteso il renderer e il ponte sincrono esistenti. Il runtime Excalidraw locale è rigenerato da `bin/lim-editor.js` per esporre `exportToBlob` e `loadFromBlob`; il bundle generato contiene spazi finali nelle stringhe localizzate upstream.

API ufficiali: https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/utils/export
