# Fondazioni di PRESENTA e GOBBO

PRESENTA è il nome scelto per il futuro strumento di composizione delle presentazioni nel Banco. GOBBO è il pannello indipendente per note, timer e comandi del presentatore. Questa prima consegna prepara il nucleo di P0: dati, archivio, risorse, renderer, player offline, esportazione e contratto della sessione. L’editor visuale e i due split nel Banco devono ancora essere costruiti dopo il confronto sulle interfacce.

## Decisioni già fissate

- Documento JSON strutturato, con blocchi e layout guidati; l’HTML è un risultato della compilazione.
- Percorso principale orizzontale e approfondimenti verticali, con due soli assi.
- Reveal.js 6.0.2 e KaTeX 0.18.2 locali; Markdown analizzato con Marked 16.4.2 e renderizzato attraverso una lista consentita di token.
- Note private escluse dal documento pubblico e dal pacchetto HTML. Le citazioni interne nel Markdown diventano etichette statiche nell’esportazione.
- Duplicazione ordinaria con nuove identità. L’operazione esplicita `statoSuccessivo` conserva le corrispondenze Auto-Animate, distinte dalle identità dei blocchi.
- Le toolbar future riusano `.tbar`, `.tbtn`, `--tb-*`, la palette dei comandi e `UiIcone`. Nessuna nuova toolbar o disposizione del Banco è definita da questa consegna.
- Creazione di slide mediante drop nella panoramica ancora P1; possibile anticipazione soltanto se riusa le operazioni esistenti senza un secondo meccanismo. Generazione AI e PDF restano P1.

## Mappa degli innesti

| Punto reale | Uso |
| --- | --- |
| `main.js::createWindow` | Installa il servizio PRESENTA sulla WebContents della finestra principale |
| `lib/presentazioni-ipc.js::installa` | Controlla mittente, frame principale, zaino e privilegi del disco per ogni richiesta |
| `lib/presentazioni-ipc.js::ponte` e `bin/preload.js::genera` | Generano `window.vault.presentazioni`; il preload generato non si modifica a mano |
| `App/StudIA.html::bancoStrumenti`, `bancoAggiornaDocumenti` | Registro e titoli del Banco da estendere nella fase UI; nessuna iscrizione fittizia di split vuoti |
| Evento `studia:zaino-changed` | Punto da usare per cancellare caricamenti e chiudere la sessione al cambio di contesto nella fase UI |
| `App/assets/lim/modello.js::trasporto/leggiTrasporto` | Envelope esistente con tipo, ID e zaino, già prodotto dai drag di Parole e Album |
| `lib/lim.js::comando`, azione `materiale` | Risolve le identità reali delle parole e delle immagini con provenienza e byte originali |
| `lib/materiali.js::trova` | Risolve audio/video nello stesso zaino, senza accettare percorsi assoluti dal trasferimento |
| `lib/citazioni-zaini.js::identita` | Riusa l’UUID di `_identita.json`, stabile dopo la rinomina dello zaino |
| `lib/appunti.js::writeAtomicAsync` e `lib/appunti-coda.js::crea` | Scritture atomiche e coda seriale per documento |
| `lib/validate.js::validatePresentazione` | Schema Ajv e integrità referenziale del modello |
| `lib/pacchetto.js` | Presentazioni condivise con l’opzione dei contenuti personali; bozze e copia precedente sempre escluse |

I contratti drag `application/x-studia-album` e `application/x-studia-evidenza` non cambiano. Il ricevitore può usare l’envelope aggiuntivo `application/x-studia-lim` già emesso dal checkout: conserva anche lo zaino d’origine. Per i media è predisposto un ingresso versionato `{version:1,tipo:'audio'|'video',file,corso}`; il produttore e il gesto effettivo nell’Album saranno collegati con l’editor.

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

`App/assets/presentazioni/modello.js` contiene operazioni pure e cronologia annulla/ripeti. Sono previsti titolo, testo Markdown, lista con ID stabili delle voci, formula, immagine, audio e video. Ogni blocco ha contenuto, posizione nella griglia, stile e provenienza separati. Un singolo comando di inserimento può portare insieme blocco e descrittore della risorsa.

Le animazioni sono azioni ordinate, anche multiple sullo stesso bersaglio. Le azioni nello stesso passaggio sono simultanee; effetti successivi generano wrapper annidati. Gli indici visuali sono consecutivi e partono da 1; `indiceFragment` è l’adattatore verso gli indici Reveal, che partono da 0. L’eliminazione di un bersaglio ricompatta i gruppi rimasti.

Il player distingue avanzamento sequenziale, salto di argomento e movimento verticale. Il comando diretto `vai` e i salti direzionali riaprono la destinazione dal passaggio iniziale; Avanti/Indietro seguono la sequenza nativa di Reveal, compresi i fragment. La preferenza di movimento ridotto elimina le transizioni e le interpolazioni, conservando i passaggi didattici.

Il renderer preserva `\(...\)`, `\[...\]` e `$$...$$`; il singolo dollaro non è un delimitatore automatico. Analizza il Markdown prima di generare il solo HTML consentito. HTML grezzo, handler e URL eseguibili non sono accettati come markup della presentazione. Le formule vengono compilate con KaTeX, `trust:false` e limiti di espansione; una formula errata produce un errore locale senza bloccare le altre. Il player include anche il plugin Math ufficiale configurato con i file locali e attende i font prima del layout.

## Sessione e vista pubblica

`lib/presentazioni-sessione.js` conserva una revisione fissata, un solo player autorevole e l’ultimo stato confermato. I messaggi sono associati a sessione, identità dello zaino, presentazione, revisione e sequenza. Il cambio di autorità revoca il token precedente; i messaggi obsoleti vengono rifiutati. Il timer usa un orologio monotono e vive nel coordinatore, non nel pannello.

La regia privata riceve le note della revisione fissata. Il player riceve HTML compilato e metadati delle sole risorse usate: niente note né provenienza. Il player autonomo non ha un preload del vault e non carica il plugin note standard. I media partono tramite controllo esplicito, salvo l’opzione sul singolo blocco; cambiare slide ferma quelli lasciati indietro.

Il coordinatore è pronto e provato come modulo; il collegamento con la futura finestra pubblica Electron e con GOBBO resta da realizzare. La proiezione esistente di PDF, appunti e lavagna conserva il proprio percorso.

## Build, dimostrazione e verifiche

Il runtime sotto `App/assets/presentazioni/vendor/` contiene script, CSS, font e licenze. Il manifest registra versione e impronte; la ricetta confronta i file con le dipendenze fissate nel lockfile. Il percorso `App/**` è incluso nel packaging desktop esistente.

```bash
npm run presenta:build
npm run presenta:verifica
node test/presentazioni.js
npm run test:presenta-player
npm run presenta:demo -- /percorso/assoluto/destinazione
```

La dimostrazione usa un vault temporaneo sintetico. Genera Sistema solare, Pianeti, Orbite e approfondimenti, formule valide e una volutamente errata, un’immagine tecnica minima e un tono WAV. Stampa la cartella da cui aprire `index.html`; non usa i dati personali. Il pacchetto HTML può essere spostato e aperto senza server e senza rete. Un media mancante o con impronta diversa interrompe l’esportazione prima di dichiarare successo.

Le prove Node coprono operazioni, undo/redo, struttura verticale, corrispondenze, serializzazione, conflitti, disco guasto, bozze, risorse, isolamento, rinomina dello zaino, rendering, privacy, sessione ed esportazione. La prova della privacy è stata fatta diventare rossa reinserendo le note nel payload pubblico in un processo di test separato.

`test/presentazioni-player.js` usa Electron con profilo e vault sintetici: verifica il player reale dopo lo spostamento del pacchetto, i passaggi simultanei e inversi, gli elementi riconosciuti da Auto-Animate verticale, le formule, pausa dei media e assenza di richieste remote. Non è una prova su una LIM fisica.

```bash
npm test
bash bin/prova-zaino.sh prova-presenta-fondazioni.js prova-sicurezza.js
```

La prova CDP attraversa il preload e l’IPC reali di ZAINO. È registrata nel runner sintetico; non simula un drag dell’utente. Il test esistente `prova-presentazione.js` si ferma sul passaggio nativo a schermo intero della finestra esterna, nello stesso punto sia sul ramo sia sulla copia del commit iniziale `20a314b`. Le altre verifiche passate non vengono presentate come collaudo di quel passaggio, degli schermi esterni, di Windows o degli installatori.

## Lavoro successivo di P0

Restano editor visuale e anteprima nel Banco; iscrizione e lifecycle dei due split; proprietà, ridimensionamento e feedback di overflow; adapter DOM del trascinamento e comandi alternativi nei menu; autosave con debounce, flush e protezione del cambio contesto/shutdown; finestra pubblica Electron con bridge di sessione ristretto; GOBBO sincronizzato e prove fisiche di trascinamento e LIM. Le fondamenta non costituiscono ancora P0 completo.

Per scegliere toolbar, pulsanti e disposizione dei pannelli si useranno mockup ricavati dai componenti e dai token reali di ZAINO, come richiesto.
