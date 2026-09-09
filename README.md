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

La guida completa del fork è in `App/guida-zaino/index.html`. Gli screenshot si rigenerano su un vault temporaneo con `bash bin/guida-zaino.sh`. `npm run icona` rigenera solo le icone in `build/`, senza modificare i pacchetti in `dist/`.
