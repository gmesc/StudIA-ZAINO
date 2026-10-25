# StudIA - ZAINO

Fork desktop di StudIA dedicato agli zaini: PDF, testi, appunti, evidenze, mappe, album e lettura ad alta voce. La modalità CORSI e i suoi comandi di ingestion, trascrizione, analisi e generazione di lezioni/indici didattici sono esclusi.

## Avvio

```bash
cd "/Users/giacomomeschini/Claude/StudIA - ZAINO"
npm install
npm start
```

Questa copia di lavoro riutilizza le dipendenze già installate in StudIA tramite un collegamento locale `node_modules`. Per spostare il progetto su un altro computer, installare le dipendenze con `npm install` nella nuova copia.

Il fork ha identità `ch.insegnai.studia.zaino` e configurazione personale `studia-zaino`, separate da StudIA. Scegli una cartella per il vault al primo avvio. Un vault esistente può essere aperto: il fork mostra soltanto i suoi zaini. Il progetto originale rimane nella sua cartella.

## Chat e profili

Il pulsante **Chat AI** nella barra superiore apre una finestra flottante, spostabile e ridimensionabile. Sono disponibili **Tutor socratico**, **Spiegamelo** e **Chiedimelo**. Ogni invio rilegge documenti e appunti salvati dello zaino attivo; Spiegamelo può integrare estratti Wikipedia con collegamenti alle fonti.

La testata contiene il ruolo, l’ingranaggio per le impostazioni AI, **+**, **−** e **×**. All’apertura puoi riprendere una conversazione dall’elenco centrale oppure scrivere per iniziarne una. **−** riduce la finestra conservando la chat aperta; **+** e **×** concludono la conversazione e chiedono un nome. Le nuove chat hanno per nome la data; il salvataggio è automatico anche prima di assegnare un titolo. Sotto ogni risposta trovi copia, lettura con la voce di sistema e nuova conversazione da quel punto, che conserva la cronologia precedente senza modificare l’originale.

In **Impostazioni → Utente** puoi salvare, clonare, eliminare e scegliere profili: lettura, carico cognitivo, conoscenze iniziali, lingua, presentazione, lunghezza, esempi, verifiche e preferenze libere. Sono inclusi Equilibrato, Explain like I'm 5 e Mr Feynman. I profili descrivono preferenze didattiche, non diagnosi.

In **Impostazioni → AI → AI cloud**, scegli Google, OpenAI, Anthropic o Infomaniak, segui il link per creare una chiave API, salvala e seleziona un modello dall'elenco restituito dal provider. Infomaniak rileva automaticamente il prodotto AI Services; se ne hai più di uno, inserisci il suo ID nell’apposito campo. Le chiavi vengono cifrate con l'archivio sicuro del sistema, restano fuori dal vault e non sono esposte al renderer. Se l'archivio sicuro non è disponibile, il salvataggio viene rifiutato. Le configurazioni precedenti Qwen, Kimi e DeepSeek restano utilizzabili.

```text
vault/
  .studia/chat-profili.json
  Zaini/<zaino>/
    MATERIALI/   documenti e fonti
    APPUNTI/     appunti della persona
    CHAT/        una coppia JSON + Markdown per ogni conversazione
```

Il contesto inviato all'AI è una selezione di passaggi pertinenti, con nomi dei file e pagine: i limiti e i documenti non leggibili sono dichiarati nella chat. I PDF fotografati richiedono prima l'OCR facoltativo già presente nello zaino. La ricerca locale del testo resta disponibile; non viene eseguita la pipeline CORSI. Vedi [dettagli chat](docs/CHAT.md) e [provider e fonti ufficiali](docs/PROVIDER-AI.md).

L’embedder locale è **EmbeddingGemma 2 · ONNX** ([scheda su Hugging Face](https://huggingface.co/onnx-community/embeddinggemma-2-ONNX)): confronta il significato di documenti, appunti e domande sul computer. In **Impostazioni → AI → AI locale** trovi le descrizioni e i download **text** (346,4 MB), **vision** e **video** (541,8 MB con il testo incluso), disponibili anche senza uno zaino aperto. Visione e Video condividono i componenti: scaricarne uno prepara entrambi. I file già presenti e i download parziali vengono riutilizzati; l’app mostra quanti MB mancano. La ricerca attuale usa il testo; i download visivi preparano i componenti per immagini e fotogrammi. In **Cerca e studia → Cerca nei materiali** un solo pulsante cambia fra **Attiva indice**, **Crea indice**, **Aggiorna indice** e **Ricostruisci indice**, secondo lo stato del modello e dei materiali. L’indice è un archivio tecnico persistente in `Zaini/<zaino>/_lavorazione/rag`: serve al sistema per mostrare risultati e rimandi alle fonti. Una cartella sincronizzata può sincronizzare anche questi file. La spiegazione **Come funziona l’indice locale** si trova in **Impostazioni → AI → AI locale**.

**Cerca e studia** apre il **Raccoglitore**: tutte le schede e le domande salvate nello zaino, con ricerca e filtro per tipo. Il nome del contenuto apre la scheda oppure la domanda in Ripasso, senza nuova generazione AI. **Nuova scheda**, lettura della scheda e **Cerca nei materiali** occupano viste separate; **Raccoglitore** torna all’elenco mantenendo i filtri. In **Opzioni** trovi spiegazione e aggiornamento manuale. **Rigenera…** si trova nella scheda aperta. Le domande hanno la dimensione del titolo H4. I riferimenti a ogni PDF sono separati e mostrano nome e pagina una sola volta per domanda, anche se la pagina contiene più passaggi. **Crea appunti da domanda** conserva una copia con titolo della scheda H6, domande H4 e citazioni su righe distinte; **Crea appunti da scheda** fa lo stesso per gli altri tipi, conservando il loro titolo H3. Le copie precedenti restano intatte: la prima copia nel nuovo formato è un nuovo appunto, le successive riaprono quella copia.

**Nuova scheda** propone l’ultimo PDF o appunto su cui hai lavorato, se compreso nelle fonti ammesse. Controlla fonte e tipo, poi premi **Prepara analisi**: il riepilogo mostra materiale, copertura e provider; i token sono in **Dettagli del consumo**. **Genera e salva scheda** conferma l’invio. Se manca la configurazione, **Configura AI cloud** apre direttamente le impostazioni; tornando, ritrovi fonte e tipo scelti. La ricerca e la gestione dell’indice sono secondarie, dentro **Cerca nei materiali**.

Il riepilogo **Materiali usati** compare nella ricerca e nella scelta o creazione delle domande, anche con il selettore chiuso. La scheda usa la fonte scelta nel modulo; durante il ripasso vedi le fonti effettive della domanda. **Apri Ripasso** trasferisce esplicitamente le fonti di Cerca e studia. Nelle nuove domande e nel selettore della chat trovi anche **Usa fonti di Cerca e studia**. Le scelte restano modificabili e separate per strumento. Aprire dal raccoglitore una domanda esclusa dal filtro aggiunge le sue fonti al Ripasso e lo segnala.

**Ripasso** mette in primo piano domanda, tentativo e **Verifica risposta**. **Domande** apre la scelta fra **Da ripassare**, **Nuove**, **Più avanti** e **Tutte le domande**; **Nuova domanda** apre la generazione. **Torna alla domanda** conserva la bozza. Dopo l’invio compare il riscontro: **Riprova** riapre il campo di risposta. **Prossima domanda** e **Pausa** sono sotto il contenuto; **Riprendi** torna alla domanda in pausa. La pausa conserva anche una domanda appena creata e mantiene il testo non inviato durante la sessione dell’app; domande conservate, tentativi inviati e date restano sul disco. Nelle schede di domande, **Rispondi** riusa esattamente quella domanda e il suo storico, senza generarne un’altra.

## Materiali in parallelo

I pulsanti delle azioni hanno sfondo trasparente e hover verde, anche nelle toolbar e sulle superfici colorate. Spazi e linee verticali separano i gruppi di comandi. Il verde persistente indica una selezione o un comando acceso, come la raccolta di Album; Album e Impostazioni non aggiungono una barra sotto il tab selezionato. Nella sidebar, ordinamento e matita compaiono solo nelle sezioni aperte, con testo verde scuro; nelle sezioni chiuse restano nome e chevron.

La **× nella toolbar** di Appunti o Fonti chiude il documento e lascia disponibili gli strumenti. L’appunto viene prima salvato; se il salvataggio fallisce resta aperto. Senza PDF il contatore mostra **− DI −**, con un PDF **n DI N**. Gli strumenti che richiedono un documento restano visibili e disabilitati.

Le icone dell’interfaccia usano **Lucide SVG locali**, con tooltip sui comandi. Restano **OpenMoji lo zaino come marchio, il fantasma della sidebar e il mago dei Crediti**. Le emoji scritte negli appunti o scelte per personalizzare un riquadro restano contenuto dell’utente. Nomi, contatori e posizioni 1–5 restano testo.

La maniglia con il fantasma ha **sfondo bianco** per distinguersi dalla testata dello split; al passaggio del mouse usa l’hover verde.
Nella sidebar A–Z, icone dei comandi e checkbox seguono la dimensione dei titoli delle sezioni. Le caselle conservano un’area cliccabile più ampia del segno visibile.

L’occhio in Fonti e Parole chiave controlla la stessa visibilità delle sottolineature: occhio aperto = visibili, barrato = nascoste. Nel menu delle letture, l’occhio barrato identifica un layer nascosto. Non si possono creare sottolineature su un PDF se la vista globale o il layer di destinazione è nascosto: un avviso indica dove riattivarlo. La matita nelle Mappe continua a rinominare la mappa.

In **Parole chiave**, **AZ/ZA** indica l’ordine alfabetico che verrà applicato al clic. Il calendario indica l’ordine attuale: **↑** dal meno recente al più recente, **↓** dal più recente al meno recente. Un altro clic inverte l’ordine. Il tooltip di ogni parola termina con la data di creazione.

La **× nella testata** chiude uno split e ridistribuisce gli altri, rinumerandoli da 1 in ordine di lettura. Conserva i documenti, ma il riquadro chiuso non ricompare da solo allargando il Banco. Se il salvataggio degli appunti fallisce, lo split resta aperto. L’ultimo split resta disponibile e la × è disabilitata. Sono disponibili anche forme da cinque, sette e otto riquadri, per chiuderne sempre uno alla volta.

Il menu **Banco** offre le disposizioni **Leggi e annota**, **Prepara schede** e **Ripassa**, oltre alle forme personalizzate. Nei riquadri Appunti stretti, **Altri strumenti** espande i comandi secondari; **ESC** li richiude e riporta il focus al pulsante.

Ogni tendina nella testata del banco offre **Appunti** e **Fonti**. Scegli la stessa voce in un secondo riquadro per aprire un altro materiale: sono disponibili due editor e due visualizzatori PDF indipendenti, anche insieme nella forma a quattro riquadri. Il menu del materiale in ciascun riquadro sceglie il file. Posizioni e materiali aperti vengono ripristinati per zaino.

I due appunti si salvano separatamente e vengono salvati prima dell’invio alla chat. Lo stesso appunto non può essere modificato nei due editor contemporaneamente. La seconda fonte permette lettura, selezione/copia, pagina e zoom indipendenti; gli strumenti avanzati di annotazione e ritaglio restano nella prima fonte.

I due editor degli appunti hanno gli stessi comandi: formattazione, callout, emoji, citazioni, materiali, anteprima modificabile, immagini, rinomina con fonte associata, eliminazione, stampa e PDF. Il riquadro usato per ultimo riceve **Appunta**, parole chiave e aperture dalla sidebar; **⌘/Ctrl+S** salva quel riquadro e **⌘/Ctrl+J** ne cambia l’anteprima. Ogni appunto conserva il proprio testo, cursore e salvataggio. Scrivi `> ` e scegli un callout: il cursore si posiziona subito nel corpo vuoto, dopo `> `.

**Appunta** riconosce le frasi che iniziano con maiuscola e terminano con `.`, `?` o `!`: le inserisce come blocchi citazione con una linea sottile e il rimando alla fonte. I frammenti entrano fra virgolette e in corsivo. È una regola pratica: nei PDF le righe non identificano con certezza i paragrafi. I callout scelti manualmente continuano a prevalere; il simbolo **¶** nella riga di Appunta riattiva la scelta automatica. **Quote** permette di formattare un blocco nell’editor.

**Cancella evidenziatura** toglie il segno dalla fonte e la parola dalle keyword. Anche negli appunti scompaiono colore e sottolineatura: restano il testo citato e il rimando alla pagina.

Le toolbar di Appunti e Mappe includono **Annulla/Ripeti**. Ogni editor usa la propria cronologia; nella mappa si recuperano anche le disposizioni e la vista conservate dal gesto. Una modifica dopo Annulla abbandona i passi da ripetere. Le cronologie sono della sessione del documento e si azzerano quando si apre un altro file; non sostituiscono le versioni salvate degli appunti.

Le testate del Banco usano lo stesso sfondo di sidebar e sezioni di Cerca; lo split attivo ha una tinta più satura. Mostrano il nome dello strumento e il chevron a sinistra. In Fonti e Appunti, il documento aperto compare a destra in carattere normale, abbreviato con puntini quando non entra; il nome completo resta disponibile al passaggio del mouse. Le testate mostrano l’ordine dei riquadri; quella attiva ha un colore più saturo, senza pallino. Quando riduci la vista resta prima l’attivo, poi gli altri da sinistra a destra, riga per riga. Nel menu Banco, passando sulle disposizioni o raggiungendole con la tastiera, puoi leggere in anticipo quali contenuti resteranno. Per esempio, con quattro riquadri numerati 1–4 e il 4 attivo, passando a due conserverai i contenuti del **4 e dell’1**, rinumerati nella nuova vista; passando da tre a uno resta solo quello attivo. Gli altri rimangono aperti fuori vista e tornano riallargandola, nell’ordine risultante dagli spostamenti.

Le linee dei banchi sono sottili e grigie. La vecchia barra verticale di avanzamento del capitolo è nascosta nello ZAINO.

## Album

La tendina degli split offre un unico **Album**, con le raccolte **Ritagli**, **Immagini**, **Video** e **Audio**. Un clic su un file apre l’anteprima o il player nello stesso split; **×** o **Esc** riporta alla raccolta. Anche i link con minutaggio negli appunti aprono ALBUM, al secondo citato.

Il cursore regola le miniature. La lente cerca in tutte le raccolte e raggruppa i risultati per tipo. Il chevron dell’ordinamento sceglie **Alfabetico** o **Data** di caricamento; il pulsante accanto inverte l’ordine e indica l’azione successiva: **Z–A / A–Z** oppure **31–1 / 1–31**. Le preferenze si ricordano per zaino. Per rinominare, eliminare o inserire una foto o un ritaglio negli appunti, usa il tasto destro sulla scheda; il trascinamento resta disponibile.

## Organizzare la sidebar

La sidebar mostra **Appunti**, **Mappe**, **Fonti**, **Media**, in questo ordine. Media contiene le sottosezioni **Immagini**, **Video** e **Audio**. Ogni sezione conserva i propri gruppi. **+** crea un gruppo; il chevron accanto al suo nome lo chiude o riapre. **✎** attiva l’organizzazione e **✓** la conclude.

Attiva la **matita** della sezione per mostrare le **caselle a destra** e il **+**, poi seleziona una o più voci. Uscendo dalla modifica, le spunte si azzerano. Premi **+** per creare un gruppo che le contenga, oppure trascina una delle voci selezionate su un gruppo esistente per spostarle insieme. Il pulsante **A–Z / Z–A** ordina i file per nome visibile, dentro ciascun gruppo e fra quelli senza gruppo. L’ordine viene salvato nello zaino.

Passando sul **+** con il mouse o raggiungendolo da tastiera, un popup spiega l’azione e indica quante voci selezionate entreranno nel gruppo. **Esc** chiude il suggerimento. I pulsanti sulle testate verdi si scuriscono leggermente al passaggio del mouse, conservando il colore dello sfondo.

Puoi trascinare anche una voce singola per riordinarla o portarla in **Senza gruppo**. **Alt+↑/↓** riordina da tastiera. La matita mostra i comandi per rinominare o sciogliere i gruppi e permette di trascinarne le testate per cambiarne la posizione. Sciogliere un gruppo conserva tutte le sue voci.

Ordine, assegnazioni e apertura viaggiano con lo zaino: `MATERIALI/_gruppi.json` conserva separatamente Fonti e Media, `APPUNTI/_gruppi.json` gli Appunti e `MAPPE/_gruppi.json` le Mappe. I gruppi di Fonti, Appunti, Media e Mappe sono indipendenti, anche quando hanno lo stesso nome: creare, rinominare o sciogliere un gruppo in una sezione lascia invariate le altre tre. Le copie vuote ereditate dalla vecchia migrazione vengono corrette; la rinomina di PDF, appunti e mappe conserva gruppo e posizione.

Per importare una o più cartelle di PDF, trascinale direttamente nell’area dell’app, anche senza attivare la matita. Ogni cartella diventa un gruppo con il suo nome, includendo i PDF delle eventuali sottocartelle. Gli originali restano dove sono. Le copie sono in `MATERIALI/PDF/Gruppi/Nome gruppo/`: rinominare il gruppo o cambiare le assegnazioni dalla sidebar aggiorna anche il disco. **Senza gruppo** e lo scioglimento riportano i PDF direttamente in `MATERIALI/PDF/`. I nomi e i numeri dei documenti restano stabili, insieme a rimandi, evidenze e indici.

I nuovi PDF mantengono il nome originale completo dopo un prefisso interno di almeno quattro cifre: `01.1 CT Alunno.pdf` diventa `0001 - 01.1 CT Alunno.pdf` sul disco. La sidebar mostra solo `01.1 CT Alunno.pdf`, inclusa l’estensione. I documenti già presenti conservano nome, numero e rimandi.

I gruppi già esistenti vengono organizzati sul disco al primo salvataggio dell’organizzazione Fonti. Gruppi omonimi restano distinti, con suffissi nelle cartelle; i caratteri non ammessi dal filesystem vengono sostituiti. I file non PDF e i collegamenti simbolici nelle cartelle importate sono esclusi con un messaggio. Se l’organizzazione non si può salvare, gli spostamenti vengono ripristinati; eventuali PDF appena copiati restano accessibili senza gruppo e l’importazione segnala il problema.

## Sicurezza

L’app ammette solo i formati previsti e controlla il contenuto prima di importarli e aprirli. PDF senza scripting, renderer isolato e permessi per singola operazione proteggono l’accesso al disco: gli originali importati restano in sola lettura; le esportazioni richiedono una destinazione scelta nel dialogo nativo. Eseguibili, script, HTML, SVG e archivi non si importano come materiali.

In **Impostazioni → Sicurezza** puoi installare e attivare separatamente **qpdf** (controllo della struttura PDF) e **ClamAV** (antivirus). I componenti sono inclusi nel pacchetto dell’app e vengono installati nei suoi dati locali, senza Homebrew, privilegi di amministratore o servizi permanenti. ClamAV scarica le firme prima di poter essere attivato; la stessa sezione ne mostra lo stato e permette di aggiornarle. Nessun PDF viene inviato online per questi controlli.

I controlli attivi precedono importazione, apertura, OCR ed estrazione per chat/ricerca, anche per PDF aggiunti o modificati fuori dall’app. La scansione di una cartella usa un lotto antivirus; i file invariati già approvati vengono riutilizzati nella sessione. Le rilevazioni e i controlli incompleti bloccano il file e mostrano il motivo. Gli avvisi strutturali riconosciuti come recuperabili sono segnalati separatamente. La [documentazione di sicurezza](docs/SICUREZZA.md) descrive privilegi, limiti e manutenzione: nessun motore garantisce l’assenza di ogni minaccia.

## Verifica

```bash
npm test       # moduli esistenti + nuovi controlli chat, profili, provider e confini
npm run test:ui # Electron isolato, vault sintetico e AI simulata: nessuna API reale
```

Le prove includono un PDF reale, aggiornamento del contesto, persistenza e riapertura, annullamento, separazione tra zaini, chiavi, modelli e profili. La verifica dei sei protocolli usa risposte simulate: una chiamata effettiva richiede la chiave e il credito dell'utente.

## Pacchetto

`npm run dist:mac` crea il pacchetto macOS; `npm run dist:win` quello Windows. Identità, nome e nomi degli installer sono propri del fork. L'eventuale firma/notarizzazione del progetto originale non si trasferisce al fork.

Prima del pacchetto prepara i componenti di sicurezza: `npm run sicurezza:prepara -- --piattaforma darwin --arch arm64` (oppure `darwin/x64`, `win32/x64`). Il preparatore scarica release ufficiali con SHA-256 fissati e conserva licenze, sorgenti core e ricetta; le risorse generate in `build/sicurezza-pacchetti/` sono ignorate da Git. `npm run sicurezza:verifica` controlla il target locale; la build verifica quello richiesto e si ferma se manca o è alterato. L’estrazione e preparazione dei pacchetti macOS richiede macOS. Per una nuova distribuzione pubblica va completata anche la verifica dei sorgenti delle dipendenze native incorporate nelle release upstream, descritta nella documentazione di sicurezza.

StudIA - ZAINO è **software libero**, distribuito con licenza **GNU General Public License v3 o successiva** (`GPL-3.0-or-later`): il testo integrale è nel file [`LICENSE`](LICENSE). Puoi usarlo, studiarlo, modificarlo e ridistribuirlo; chi riceve una copia, anche modificata, deve poter avere il codice sorgente con la stessa libertà.

⚠️ Fino alla versione 1.1.1 compresa il codice è stato pubblicato con licenza MIT, e quelle copie restano MIT: una licenza già data non si ritira. Il cambio vale da qui in avanti.

Icona e marchio usano [OpenMoji backpack (1F392)](https://openmoji.org/library/emoji-1F392/), con attribuzione e licenza CC BY-SA 4.0; i crediti delle dipendenze sono disponibili nell'app.

La guida completa del fork è in `App/guida-zaino/index.html`: include percorsi passo per passo per Cerca e studia, schede AI, Ripasso, fonti della chat, gruppi e strumenti del Banco. Gli screenshot si rigenerano su un vault temporaneo con `bash bin/guida-zaino.sh`. `npm run icona` rigenera solo le icone in `build/`, senza modificare i pacchetti in `dist/`.
