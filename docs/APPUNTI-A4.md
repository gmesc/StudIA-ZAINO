# APPUNTI: Scrittura e Impaginazione A4

Ogni banco APPUNTI ha due viste dello stesso documento, selezionabili con due icone a destra nella toolbar, prima di Stampa ed Esporta. L’icona quaderno con matita apre **Scrittura**, l’editor fluido. L’icona foglio apre **Impaginazione A4**, che è anche l’**Anteprima**: mostra un foglio alla volta, con navigazione delle pagine e indicazione dello zoom. Cmd/Ctrl+J alterna le due viste. Il cambio di vista non riscrive il Markdown; i banchi scelgono la vista indipendentemente.

In A4, un doppio clic su un paragrafo torna alla Scrittura in quel punto. I comandi di formattazione del testo aprono Scrittura. **Annota** permette di disegnare direttamente sopra la pagina, con testo visibile sotto la tela. Applica salva il disegno, Annulla lascia il documento invariato. Per esportare o stampare occorre prima applicare o annullare la bozza.

Un clic su una figura apre dimensione e livello; **Pagina** sposta una figura sovrapposta su un’altra pagina. Trascinamento e frecce muovono la figura, Maiusc aumenta il passo. Cmd/Ctrl+Z e Maiusc+Cmd/Ctrl+Z annullano e ripetono. L’icona **Seleziona figure**, accanto ad Annota, permette di scegliere anche i disegni dietro al testo. Si attiva automaticamente quando si porta una figura dietro al testo; Esc chiude prima i comandi e poi la modalità di selezione. Rimane disponibile anche Alt+clic. Il riquadro segue i tratti visibili di Annota, senza includere il margine trasparente della tela. **Fra i paragrafi** reinserisce la figura nel flusso del testo.

Le frecce ←/→, quando non si sta modificando un campo o spostando una figura, cambiano pagina. Lo scorrimento laterale e lo swipe fanno lo stesso; lo scorrimento verticale percorre il foglio e, oltre il margine, passa alla pagina vicina. L’inerzia di un gesto non salta più pagine. Il campo percentuale, i pulsanti −/+ e il pinch modificano lo zoom della vista (25–300%); **Adatta il foglio al banco** ripristina l’adattamento automatico. La scala non cambia la composizione o l’export PDF.

## Misure e conservazione

- Carta A4 verticale: 210 × 297 mm.
- Area del testo: 170 × 252 mm; margini 20 mm in alto e ai lati, 25 mm in basso.
- Corpo 12 pt, interlinea 1,55; tipografia condivisa con `StampaFoglio.corpo`.
- Footer: nome dell’appunto e pagina corrente/totale.

Il banco ridimensiona soltanto la visualizzazione del foglio. Non cambia larghezza del testo, dimensioni dei caratteri, posizione delle figure o numero di pagine.

Le figure sovrapposte posizionate in A4 conservano pagina, posizione e larghezza in millimetri nel commento Markdown della figura:

```markdown
![Disegno|60%](_disegni/UUID.svg)
<!-- zaino-figura {"align":"left","layer":"front","x":20,"y":3,"a4":{"pagina":2,"x":34,"y":12.7,"larghezza":102}} -->
```

La posizione A4 è relativa all’angolo superiore sinistro dell’area del testo. Le vecchie figure vengono collocate usando l’ancora nel testo finché non sono riposizionate in A4. Spostarle in Scrittura ripristina l’ancoraggio al testo e rimuove le coordinate A4 esplicite. Tornare alla figura fra i paragrafi rimuove la posizione sovrapposta.

Modificare il testo può cambiare la paginazione: le figure con coordinate A4 restano sulla pagina scelta e vanno ricontrollate. Il ridimensionamento del banco non modifica invece la composizione.

## PDF e stampa

`appunti/a4.js` misura il documento in colonne dell’altezza dell’area stampabile. Ogni foglio mostra una colonna. Anteprima, stampa ed export PDF utilizzano gli stessi fogli, CSS, font e immagini decodificate; il testo PDF resta selezionabile e i disegni rimangono SVG. Anche l’export avviato dalla vista Scrittura usa questa impaginazione.

Il DOCX mantiene il percorso precedente. Non viene promessa la stessa paginazione in Word, che usa un proprio motore di composizione. Non sono presenti modifiche al formato Markdown dei paragrafi o nuove dipendenze.

## Verifica — 10 novembre 2026

`npm test` superato. `test/appunti-figure.js` controlla coordinate, validazione e roundtrip. La prova Electron `prova-appunti-a4.js` usa un vault sintetico, mouse e tastiera reali e un PDF effettivamente esportato: cinque pagine con formattazioni, elenco, callout, tabella, foto e freccia. Verifica geometria nei banchi intero/metà/quarto, salvataggio/riapertura, viste indipendenti, trascinamento, frecce, Undo/Redo, testo completo senza duplicazioni e footer. Le righe del PDF sono confrontate con la geometria del foglio; pagine PDF renderizzate e ispezionate visivamente.

Verdi anche le prove di annotazioni, disegni Excalidraw, tabelle, DOCX, cursore, nove editor, movimento figure e riduzione dei banchi. Log di questa lavorazione: `/private/tmp/zaino-a4-unit.log`, `/private/tmp/zaino-a4-finale.log`, `/private/tmp/zaino-a4-tasti.log`.

L’app installata sul Mac non è stata aggiornata in questa lavorazione.

La prova `prova-appunti-a4.js` verifica anche le icone nella toolbar e il passaggio da tastiera. `prova-proiezione-laser.js` confronta le posizioni del testo A4 nella finestra esterna con quelle della pagina nel banco. La proiezione conserva colonne, interruzioni e footer del foglio; non ricompone il testo in base alla larghezza della finestra esterna.

`prova-appunti-a4-gesti.js` riproduce i problemi del riquadro e della selezione dietro al testo, e controlla zoom, scorrimento laterale/verticale, swipe, frecce e ridimensionamento del banco. La tela SVG mantiene le coordinate originali: si restringe solo il riquadro interattivo ai limiti dei segni, senza ritagliare i dati del disegno.
