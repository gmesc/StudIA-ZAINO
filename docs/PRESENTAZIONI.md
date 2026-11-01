# PRESENTA e GOBBO nel Banco

PRESENTA è lo strumento del Banco per comporre le presentazioni. GOBBO è il pannello indipendente con note private, timer e comandi del relatore. Il primo percorso utilizzabile è collegato: creazione, modifica, autosave, riapertura, anteprima isolata, player nativo Reveal.js ed esportazione HTML offline. L’editor usa il layout **B · Sul foglio**, scelto nel confronto dei mockup, con i componenti ZAINO esistenti: selezione e manipolazione sulla slide, elenco degli oggetti e proprietà contestuali sotto il foglio.

## Come provarlo nell’app

1. Aprire uno zaino e scegliere **PRESENTA** nella tendina di uno split.
2. Premere **Nuova presentazione** (`+` nella barra), scegliere il titolo e compilare il titolo della prima slide.
3. Aggiungere testo, elenco o formula; aggiungere altre slide con `+`, approfondimenti con la freccia verso il basso. Duplicazione, riordino, eliminazione e annulla/ripeti sono nella stessa superficie.
4. Trascinare parole chiave o elementi dell’Album nel pannello, oppure usare **Inserisci dallo zaino**. Il gesto inserisce nella slide selezionata; la creazione di slide tramite drop nella panoramica resta P1.
5. Attendere **Salvato**, chiudere il documento e riaprirlo dalla tendina o dalla sezione PRESENTA in sidebar. Anche l’ultima presentazione e la slide selezionata si ricordano per zaino.
6. Scegliere **Presenta a schermo intero**. Aprire **GOBBO** in un altro split per leggere le note e comandare la sessione. `Esc` esce dallo schermo intero della finestra pubblica; un altro `Esc` chiude quella finestra. `F` commuta lo schermo intero.
7. **Esporta presentazione HTML** apre il selettore della cartella e produce un pacchetto offline senza note.

Il campo titolo modifica anche il titolo visibile nella slide. Selezionare un oggetto sul foglio o nell’elenco: i comandi sotto mostrano contenuto, dimensione e colore del testo, allineamento delle righe e posizione verticale nel riquadro. Trascinare per spostare; usare il quadratino nell’angolo per ridimensionare. Le frecce spostano, Maiusc aumenta il passo e Alt + frecce ridimensiona. La griglia di nove posizioni offre un’alternativa al trascinamento. **Slide e sfondo** mostra le disposizioni illustrate **Immagine a sinistra**, **Testo a sinistra** e **Immagine sopra**; **Sfondo della slide** offre colori pronti e selettore personalizzato, indipendenti dal tema dell’app. Il testo usa un colore automatico leggibile, salvo una scelta sul singolo oggetto. Animazioni e appunti privati rimangono nelle sezioni espandibili; **Stato successivo animato** collega le corrispondenze fra le due slide. Le formule usano LaTeX; il testo accetta Markdown e delimitatori matematici espliciti. I bottoni hanno etichette accessibili e tooltip italiani; `⌘/Ctrl+S`, `⌘/Ctrl+Z`, `⌘/Ctrl+Shift+Z` agiscono sull’editor.

La testata di PRESENTA avvia il deck reale. GOBBO è marcato privato nel registro e non offre la proiezione generica, neppure nella barra a schermo intero. Una sessione usa la revisione fissata all’avvio: eventuali modifiche successive nell’editor non cambiano in silenzio le note o le slide già proiettate.

## Decisioni già fissate

- Documento JSON strutturato, con blocchi e layout guidati; l’HTML è un risultato della compilazione.
- Percorso principale orizzontale e approfondimenti verticali, con due soli assi.
- Reveal.js 6.0.2 e KaTeX 0.18.2 locali; Markdown analizzato con Marked 16.4.2 e renderizzato attraverso una lista consentita di token.
- Note private escluse dal documento pubblico e dal pacchetto HTML. Le citazioni interne nel Markdown diventano etichette statiche nell’esportazione.
- Duplicazione ordinaria con nuove identità. L’operazione esplicita `statoSuccessivo` conserva le corrispondenze Auto-Animate, distinte dalle identità dei blocchi.
- Le toolbar riusano `.tbar`, `.tbtn`, `--tb-*`, la palette dei comandi e `UiIcone`. Le misure e gli stati dei comandi sono ereditati dal design system; il layout del Banco resta quello esistente.
- Creazione di slide mediante drop nella panoramica ancora P1; possibile anticipazione soltanto se riusa le operazioni esistenti senza un secondo meccanismo. Generazione AI e PDF restano P1.

## Mappa degli innesti

| Punto reale | Uso |
| --- | --- |
| `main.js::createWindow` | Installa il servizio PRESENTA sulla WebContents della finestra principale |
| `lib/presentazioni-ipc.js::installa` | Controlla mittente, frame principale, zaino e privilegi del disco per ogni richiesta |
| `lib/presentazioni-ipc.js::ponte` e `bin/preload.js::genera` | Generano `window.vault.presentazioni`; il preload generato non si modifica a mano |
| `App/StudIA.html::bancoStrumenti`, `bancoAggiornaDocumenti` | Registro di PRESENTA/GOBBO, titoli dei documenti e protezione del pannello privato |
| Evento `studia:zaino-changed` | Riallineamento dell’editor, annullamento dei risultati obsoleti e chiusura della sessione al cambio di contesto |
| `App/assets/lim/modello.js::trasporto/leggiTrasporto` | Envelope esistente con tipo, ID e zaino, già prodotto dai drag di Parole e Album |
| `lib/lim.js::comando`, azione `materiale` | Risolve le identità reali delle parole e delle immagini con provenienza e byte originali |
| `lib/materiali.js::trova` | Risolve audio/video nello stesso zaino, senza accettare percorsi assoluti dal trasferimento |
| `lib/citazioni-zaini.js::identita` | Riusa l’UUID di `_identita.json`, stabile dopo la rinomina dello zaino |
| `lib/appunti.js::writeAtomicAsync` e `lib/appunti-coda.js::crea` | Scritture atomiche e coda seriale per documento |
| `lib/validate.js::validatePresentazione` | Schema Ajv e integrità referenziale del modello |
| `lib/pacchetto.js` | Presentazioni condivise con l’opzione dei contenuti personali; bozze e copia precedente sempre escluse |

I contratti drag `application/x-studia-album` e `application/x-studia-evidenza` non cambiano. Il ricevitore può usare l’envelope aggiuntivo `application/x-studia-lim` già emesso dal checkout: conserva anche lo zaino d’origine. Per i media è predisposto un ingresso versionato `{version:1,tipo:'audio'|'video',file,corso}`; l’Album produce `application/x-studia-presenta-media` per audio/video. I payload preesistenti di Parole e immagini sono conservati.

## Archivio e risorse

```text
Zaini/<cartella dello zaino>/PRESENTAZIONI/<UUID presentazione>/
  presentazione.json
  _precedente.json
  _bozza.json
  assets/<SHA256>.<estensione>
```

La lettura non crea cartelle. `schemaVersion` identifica il formato; `revision` cresce soltanto nel main dopo il salvataggio. Il documento contiene l’UUID stabile dello zaino, non il nome della sua cartella. Un salvataggio deve indicare la revisione di partenza: se è cambiata, viene rifiutato senza sovrascrivere il documento. Le versioni di formato sconosciute e i campi non riconosciuti vengono rifiutati, senza riscritture distruttive.

`bozza` registra esplicitamente il contenuto da recuperare; `recupera` può leggerlo separatamente da `apri`, anche se il documento principale è illeggibile. Il consumatore deve confrontare la sua revisione di partenza con quella aperta: una bozza vecchia non si applica automaticamente. `_precedente.json` conserva la revisione precedente. Un errore nella sostituzione atomica conserva il file corrente. La coda continua a funzionare dopo l’errore.

Immagini e media vengono copiati nella cartella della presentazione prima di inserirne il riferimento. Le copie identiche dello stesso formato riusano il file con impronta SHA256. I ritagli portano soltanto i pixel dell’Album, non il PDF completo. Rimandi e provenienza sono separati dalla copia. Gli originali restano nelle raccolte. Non c’è ancora raccolta automatica delle risorse inutilizzate: devono restare disponibili per annulla/ripeti e bozze.

Limiti iniziali: 8 MiB di JSON, 300 slide totali, 200 blocchi per slide, 512 MiB per singolo media. Formati supportati dal catalogo e riproducibilità nel browser sono due verifiche distinte: una firma riconosciuta non garantisce che il codec sia disponibile.

## Modello, animazioni e matematica

`App/assets/presentazioni/modello.js` contiene operazioni pure e cronologia annulla/ripeti. Sono previsti titolo, testo Markdown, lista con ID stabili delle voci, formula, immagine, audio e video. Ogni blocco ha contenuto, stile e provenienza separati. La disposizione libera usa `style.box` con x/y/larghezza/altezza in percentuale, validate entro il foglio. Sfondo della slide e posizione verticale del contenuto sono opzionali e seguono anche il player e l’export. Le disposizioni precedenti continuano ad aprirsi senza riscrittura: il primo gesto sul foglio converte le misure visualizzate in posizioni libere, con un’unica operazione annullabile. La selezione e i movimenti intermedi del mouse non scrivono sul disco; il rilascio registra il gesto nella cronologia. Un singolo comando di inserimento può portare insieme blocco e descrittore della risorsa.

Le animazioni sono azioni ordinate, anche multiple sullo stesso bersaglio. Le azioni nello stesso passaggio sono simultanee; effetti successivi generano wrapper annidati. Gli indici visuali sono consecutivi e partono da 1; `indiceFragment` è l’adattatore verso gli indici Reveal, che partono da 0. L’eliminazione di un bersaglio ricompatta i gruppi rimasti.

Il player distingue avanzamento sequenziale, salto di argomento e movimento verticale. Il comando diretto `vai` e i salti direzionali riaprono la destinazione dal passaggio iniziale; Avanti/Indietro seguono la sequenza nativa di Reveal, compresi i fragment. La preferenza di movimento ridotto elimina le transizioni e le interpolazioni, conservando i passaggi didattici.

Il renderer preserva `\(...\)`, `\[...\]` e `$$...$$`; il singolo dollaro non è un delimitatore automatico. Analizza il Markdown prima di generare il solo HTML consentito. HTML grezzo, handler e URL eseguibili non sono accettati come markup della presentazione. Le formule vengono compilate con KaTeX, `trust:false` e limiti di espansione; una formula errata produce un errore locale senza bloccare le altre. Il player include anche il plugin Math ufficiale configurato con i file locali e attende i font prima del layout.

## Sessione e vista pubblica

`lib/presentazioni-sessione.js` conserva una revisione fissata, un solo player autorevole e l’ultimo stato confermato. I messaggi sono associati a sessione, identità dello zaino, presentazione, revisione e sequenza. Il cambio di autorità revoca il token precedente; i messaggi obsoleti vengono rifiutati. Il timer usa un orologio monotono e vive nel coordinatore, non nel pannello.

La regia privata riceve le note della revisione fissata. Il player riceve HTML compilato e metadati delle sole risorse usate: niente note né provenienza. Il player autonomo non ha un preload del vault e non carica il plugin note standard. I media partono tramite controllo esplicito, salvo l’opzione sul singolo blocco; cambiare slide ferma quelli lasciati indietro.

`lib/presentazioni-player.js` collega il coordinatore alla finestra pubblica sandboxed. Il preload pubblico espone soltanto pronto/conferma e ricezione dei comandi, senza `vault`. GOBBO segue la posizione confermata dal player; le richieste di una sessione vecchia sono rifiutate. Chiudere e riavviare crea una nuova sessione. La finestra si apre sul secondo schermo se presente; il selettore in GOBBO permette di spostarla. La proiezione esistente di PDF, appunti e lavagna conserva il proprio percorso.

`lib/presentazioni-vista.js` serve il runtime e i media tramite URL `presenta://` a capacità temporanea. Ogni URL identifica un file espressamente autorizzato; nessun percorso arbitrario o file JSON del vault può essere richiesto. Le capacità dei media sono revocate alla chiusura del documento/sessione. L’anteprima è un iframe `sandbox="allow-scripts"`, senza `allow-same-origin`, senza preload e con media passivi; i messaggi controllano la finestra sorgente e il canale. Il player imposta esplicitamente la modalità slide, anche negli split stretti. La navigazione è condivisa con il pacchetto esportato in `navigazione.js`.

## Autosave e transizioni

`App/assets/presentazioni/documento.js` conserva cronologia, revisione del disco e bozza separatamente. Autosave dopo 600 ms; una scrittura per volta. Il testo digitato durante una scrittura rimane da salvare e viene scritto nel giro seguente. Annulla/ripeti non riportano indietro la revisione del disco.

Cambio zaino, rinomina/eliminazione dello zaino, cambio documento, esportazione e presentazione attendono le scritture necessarie. Anche il cambio della cartella vault passa da un flush prima del selettore. Per la chiusura nativa, il main intercetta `close`, richiede il flush al renderer e prosegue soltanto dopo la conferma associata a quella richiesta; non dipende da un `beforeunload` asincrono. Una ricarica con modifiche pendenti viene bloccata e avvia il salvataggio; può essere ripetuta dopo **Salvato**.

Un errore conserva la bozza in memoria e tenta una copia di recupero; se anche quella fallisce lo dice. Cambio contesto e chiusura sono impediti. Una bozza dello stesso documento e della stessa revisione può essere recuperata esplicitamente alla riapertura. L’errore non viene spacciato per un salvataggio riuscito.

## Build, dimostrazione e verifiche

Il runtime sotto `App/assets/presentazioni/vendor/` contiene script, CSS, font e licenze. Il manifest registra versione e impronte; la ricetta confronta i file con le dipendenze fissate nel lockfile. Il percorso `App/**` è incluso nel packaging desktop esistente.

```bash
npm run presenta:build
npm run presenta:verifica
node test/presentazioni.js
npm run test:presenta-player
npm run test:presenta-chiusura
npm run presenta:demo -- /percorso/assoluto/destinazione
```

La dimostrazione usa un vault temporaneo sintetico. Genera Sistema solare, Pianeti, Orbite e approfondimenti, formule valide e una volutamente errata, un’immagine tecnica minima e un tono WAV. Stampa la cartella da cui aprire `index.html`; non usa i dati personali. Il pacchetto HTML può essere spostato e aperto senza server e senza rete. Un media mancante o con impronta diversa interrompe l’esportazione prima di dichiarare successo.

Le prove Node coprono operazioni, undo/redo, struttura verticale, corrispondenze, serializzazione, conflitti, disco guasto, bozze, risorse, isolamento, rinomina dello zaino, rendering, privacy, sessione ed esportazione. La prova della privacy è stata fatta diventare rossa reinserendo le note nel payload pubblico in un processo di test separato.

`test/presentazioni-player.js` usa Electron con profilo e vault sintetici: verifica il player reale dopo lo spostamento del pacchetto, i passaggi simultanei e inversi, gli elementi riconosciuti da Auto-Animate verticale, le formule, pausa dei media e assenza di richieste remote. Non è una prova su una LIM fisica.

```bash
npm test
bash bin/prova-zaino.sh prova-presenta-fondazioni.js prova-presenta-editor.js prova-sicurezza.js
```

La prova CDP attraversa il preload e l’IPC reali di ZAINO. È registrata nel runner sintetico e ora usa anche eventi nativi del mouse per spostamento e ridimensionamento degli oggetti. Il test esistente `prova-presentazione.js` si ferma sul passaggio nativo a schermo intero della finestra esterna, nello stesso punto sia sul ramo sia sulla copia del commit iniziale `20a314b`. Le altre verifiche passate non vengono presentate come collaudo di quel passaggio, degli schermi esterni, di Windows o degli installatori.

## Verifiche dell’integrazione e limiti

`test/presentazioni-editor.js` prova scrittura durante autosave, revisioni dopo undo/redo, flush, recupero dopo errore e limiti/revoca degli URL media. Il controllo del flush è stato fatto diventare rosso sostituendo la transizione con una che non salva, in un processo separato.

`test/cdp/prova-presenta-editor.js` attraversa la UI vera e i produttori drag di Album: creazione da modale, campi, matematica effettivamente visibile, immagini caricate, audio passivo nell’anteprima, menu alternativo, riapertura, spostamento/riduzione del Banco, cambio zaino con ultima battuta pendente, player pubblico senza note/API vault, pausa del media uscendo dalla slide e GOBBO sincronizzato. I drag consegnati da CDP restano prove degli handler, non un collaudo fisico su LIM.

`test/presentazioni-chiusura.js` chiude davvero la finestra con un disco guasto simulato, controlla che restino finestra, ultima revisione e bozza, poi riprova con una scrittura rallentata e controlla l’ultima battuta sul disco dopo la chiusura.

La composizione libera è disponibile: il click seleziona l’oggetto, trascinamento e maniglia modificano il riquadro, i campi contestuali modificano il contenuto. Un gesto corrisponde a un solo Annulla e le coordinate sono indipendenti dalle dimensioni dello split. L’anteprima mostra tutti i passaggi animati per consentire la selezione; il pubblico mantiene la sequenza prevista. Un avviso segnala contenuto che non entra nel riquadro. Le note private non entrano neppure nei metadati dei messaggi dell’anteprima. Restano miniature grafiche nella scaletta, modifica del testo in linea sul foglio, rotazione, snap/guide e controlli più articolati delle animazioni.

La riapertura di una finestra pubblica chiusa avvia una nuova sessione dall’inizio; il trasferimento dell’autorità fra un player locale e quello esterno, preservando il passaggio in corso, resta da aggiungere. GOBBO mostra le note della slide attuale, non un’anteprima grafica della successiva. La riparazione da UI di un archivio con JSON principale corrotto non è ancora offerta: l’errore è dichiarato e le copie restano sul disco.

Restano i collaudi con trascinamento fisico, LIM, più monitor fisici, Windows e installatori. PDF, AI, PPTX e drop che crea nuove slide nella panoramica restano fuori da questa consegna. Non dichiarare P0 completo sulla sola base del percorso iniziale utilizzabile.

Per riprodurre il controllo visuale sintetico con il CSS e l’editor veri: `./node_modules/.bin/electron docs/mockup-presenta/avvia.js`. Usa un profilo temporaneo e non apre un vault personale. Non sostituisce le prove della UI nell’app.
