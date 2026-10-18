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

In **Impostazioni → AI**, scegli un provider, segui il link per creare una chiave API, salvala e seleziona un modello dall'elenco restituito dal provider. Supportati Anthropic, Gemini, OpenAI, Qwen, Kimi e DeepSeek. Qwen richiede la piattaforma internazionale Singapore; Kimi la piattaforma globale. Le chiavi vengono cifrate con l'archivio sicuro del sistema, restano fuori dal vault e non sono esposte al renderer. Se l'archivio sicuro non è disponibile, il salvataggio viene rifiutato.

```text
vault/
  .studia/chat-profili.json
  Zaini/<zaino>/
    MATERIALI/   documenti e fonti
    APPUNTI/     appunti della persona
    CHAT/        una coppia JSON + Markdown per ogni conversazione
```

Il contesto inviato all'AI è una selezione di passaggi pertinenti, con nomi dei file e pagine: i limiti e i documenti non leggibili sono dichiarati nella chat. I PDF fotografati richiedono prima l'OCR facoltativo già presente nello zaino. La ricerca locale del testo resta disponibile; non viene eseguita la pipeline CORSI. Vedi [dettagli chat](docs/CHAT.md) e [provider e fonti ufficiali](docs/PROVIDER-AI.md).

## Materiali in parallelo

Ogni tendina nella testata del banco offre **Appunti** e **Fonti**. Scegli la stessa voce in un secondo riquadro per aprire un altro materiale: sono disponibili due editor e due visualizzatori PDF indipendenti, anche insieme nella forma a quattro riquadri. Il menu del materiale in ciascun riquadro sceglie il file. Posizioni e materiali aperti vengono ripristinati per zaino.

I due appunti si salvano separatamente e vengono salvati prima dell’invio alla chat. Lo stesso appunto non può essere modificato nei due editor contemporaneamente. La seconda fonte permette lettura, selezione/copia, pagina e zoom indipendenti; gli strumenti avanzati di annotazione e ritaglio restano nella prima fonte.

I due editor degli appunti hanno gli stessi comandi: formattazione, callout, emoji, citazioni, materiali, anteprima modificabile, immagini, rinomina con fonte associata, eliminazione, stampa e PDF. Il riquadro usato per ultimo riceve **Appunta**, parole chiave e aperture dalla sidebar; **⌘/Ctrl+S** salva quel riquadro e **⌘/Ctrl+J** ne cambia l’anteprima. Ogni appunto conserva il proprio testo, cursore e salvataggio. Scrivi `> ` e scegli un callout: il cursore si posiziona subito nel corpo vuoto, dopo `> `.

**Appunta** riconosce le frasi che iniziano con maiuscola e terminano con `.`, `?` o `!`: le inserisce come blocchi citazione con una linea sottile e il rimando alla fonte. I frammenti entrano fra virgolette e in corsivo. È una regola pratica: nei PDF le righe non identificano con certezza i paragrafi. I callout scelti manualmente continuano a prevalere; il simbolo **¶** nella riga di Appunta riattiva la scelta automatica. **Quote** permette di formattare un blocco nell’editor.

**Cancella evidenziatura** toglie il segno dalla fonte e la parola dalle keyword. Anche negli appunti scompaiono colore e sottolineatura: restano il testo citato e il rimando alla pagina.

Le toolbar di Appunti e Mappe includono **Annulla/Ripeti**. Ogni editor usa la propria cronologia; nella mappa si recuperano anche le disposizioni e la vista conservate dal gesto. Una modifica dopo Annulla abbandona i passi da ripetere. Le cronologie sono della sessione del documento e si azzerano quando si apre un altro file; non sostituiscono le versioni salvate degli appunti.

Le testate del Banco mostrano l’ordine dei riquadri e indicano quello attivo con un **pallino verde**. Quando riduci la vista resta prima l’attivo, poi gli altri da sinistra a destra, riga per riga. Nel menu Banco, passando sulle disposizioni o raggiungendole con la tastiera, puoi leggere in anticipo quali contenuti resteranno. Per esempio, con quattro riquadri numerati 1–4 e il 4 attivo, passando a due conserverai i contenuti del **4 e dell’1**, rinumerati nella nuova vista; passando da tre a uno resta solo quello attivo. Gli altri rimangono aperti fuori vista e tornano riallargandola, nell’ordine risultante dagli spostamenti.

Le linee dei banchi sono sottili e grigie. La vecchia barra verticale di avanzamento del capitolo è nascosta nello ZAINO.

## Organizzare la sidebar

**Fonti**, **Appunti**, **Media** e **Mappe** hanno ciascuno i propri gruppi. **+** crea un gruppo; il chevron accanto al suo nome lo chiude o riapre. **✎** attiva l’organizzazione e **✓** la conclude.

Durante l’organizzazione, trascina i blocchi delle voci per riordinarli o spostarli in un altro gruppo; trascina la testata di un gruppo per cambiarne la posizione. Una linea indica il punto di inserimento. Il **chevron a destra della voce**, integrato nella riga senza separatore né altezza aggiuntiva, apre il menu dei gruppi, con la scelta corrente e **Senza gruppo**. Il menu funziona anche con frecce, Invio ed Esc; **Alt+↑/↓** riordina il blocco da tastiera. Sciogliere un gruppo conserva tutte le sue voci.

Ordine, assegnazioni e apertura viaggiano con lo zaino: `MATERIALI/_gruppi.json` conserva separatamente Fonti e Media, `APPUNTI/_gruppi.json` gli Appunti e `MAPPE/_gruppi.json` le Mappe. I gruppi di Fonti, Appunti, Media e Mappe sono indipendenti, anche quando hanno lo stesso nome: creare, rinominare o sciogliere un gruppo in una sezione lascia invariate le altre tre. Le copie vuote ereditate dalla vecchia migrazione vengono corrette; i documenti restano nei loro percorsi e la rinomina di PDF, appunti e mappe conserva gruppo e posizione.

## Verifica

```bash
npm test       # moduli esistenti + nuovi controlli chat, profili, provider e confini
npm run test:ui # Electron isolato, vault sintetico e AI simulata: nessuna API reale
```

Le prove includono un PDF reale, aggiornamento del contesto, persistenza e riapertura, annullamento, separazione tra zaini, chiavi, modelli e profili. La verifica dei sei protocolli usa risposte simulate: una chiamata effettiva richiede la chiave e il credito dell'utente.

## Pacchetto

`npm run dist:mac` crea il pacchetto macOS; `npm run dist:win` quello Windows. Identità, nome e nomi degli installer sono propri del fork. L'eventuale firma/notarizzazione del progetto originale non si trasferisce al fork.

StudIA - ZAINO è **software libero**, distribuito con licenza **GNU General Public License v3 o successiva** (`GPL-3.0-or-later`): il testo integrale è nel file [`LICENSE`](LICENSE). Puoi usarlo, studiarlo, modificarlo e ridistribuirlo; chi riceve una copia, anche modificata, deve poter avere il codice sorgente con la stessa libertà.

⚠️ Fino alla versione 1.1.1 compresa il codice è stato pubblicato con licenza MIT, e quelle copie restano MIT: una licenza già data non si ritira. Il cambio vale da qui in avanti.

Icona e marchio usano [OpenMoji backpack (1F392)](https://openmoji.org/library/emoji-1F392/), con attribuzione e licenza CC BY-SA 4.0; i crediti delle dipendenze sono disponibili nell'app.

La guida completa del fork è in `App/guida-zaino/index.html`: include percorsi passo per passo per Cerca e studia, schede AI, Ripasso, fonti della chat, gruppi e strumenti del Banco. Gli screenshot si rigenerano su un vault temporaneo con `bash bin/guida-zaino.sh`. `npm run icona` rigenera solo le icone in `build/`, senza modificare i pacchetti in `dist/`.
