# Chat dello zaino

La chat usa esclusivamente lo zaino aperto. Il bottone nella barra superiore apre la finestra della chat; le impostazioni permettono di scegliere provider, modello e profilo didattico.

## Dati salvati

- Ogni conversazione vive in `Zaini/<id>/CHAT/<sessione>.json`, con una copia Markdown omonima leggibile fuori dall’app. Il JSON è la copia autorevole. Ogni file viene scritto tramite file temporaneo e rinomina atomica; i due file non costituiscono una transazione unica.
- Il messaggio della persona viene salvato prima della richiesta al provider. Errori e interruzioni rimangono nella conversazione. Un invio rimasto incompleto dopo la chiusura dell’app viene segnalato alla riapertura.
- Le nuove chat ricevono un titolo con data e ora. Alla chiusura con × o all’avvio di una nuova chat con +, il dialogo propone il titolo già salvato: è possibile cambiarlo o usare la data. Esc conserva il titolo corrente. Una risposta in corso viene interrotta e salvata prima di chiedere il nome.
- L’azione «Nuova conversazione da qui» copia i messaggi fino alla risposta scelta in una nuova sessione, con nuovo identificatore e riferimenti `parentId`/`parentMessageId`. La sessione originale resta invariata.
- I profili sono salvati nel vault in `.studia/chat-profili.json`. I preset iniziali sono Equilibrato, Explain like I'm 5 e Mr Feynman. È possibile modificare, clonare, attivare ed eliminare profili, conservandone almeno uno.
- Le risposte conservano il provider, il modello e i riferimenti delle fonti disponibili. Eventuali campi tecnici di ragionamento necessari a un provider sono conservati nel JSON e reinviati nella cronologia; non sono mostrati nella chat o nella copia Markdown.
- Le chiavi API non sono passate al renderer né archiviate nelle sessioni. Sono gestite dal processo principale tramite l’archivio credenziali locale dell’app.

## Contesto e limiti

Ad ogni invio vengono riletti gli appunti e i materiali attuali dello zaino: aggiunte, modifiche e rimozioni entrano quindi nella richiesta successiva. Il contenuto inviato al provider comprende la domanda, una parte della cronologia, le preferenze del profilo e una selezione di documenti/appunti. Prima dell’invio vengono salvati entrambi gli editor aperti; se il salvataggio fallisce, l’invio viene bloccato conservando la domanda.

I PDF vengono letti localmente con il PDF.js già incluso nell’app, anche se non sono mai stati aperti. Non si avviano OCR, trascrizioni o pipeline di corsi. Le pagine senza testo vengono segnalate. Sono inclusi anche file UTF-8 `.txt`, `.text`, `.md`, `.markdown`, `.csv` e `.tsv` in `MATERIALI` e `APPUNTI`; cartelle di indici e trascrizioni vengono escluse. Estratti e vettori ricostruibili sono conservati nella cache locale dello zaino.

La selezione combina termini della domanda e similarità semantica quando il modello e l’indice locale sono pronti; altrimenti usa il recupero lessicale e lo dichiara. Il filtro delle fonti precede estrazione e ricerca. I passaggi includono nome del file e, per i PDF, numero di pagina. Sotto la risposta sono elencate soltanto le fonti effettivamente citate; se non ne riconosce nessuna lo dichiara con «Nessuna fonte citata». Il JSON e la copia Markdown conservano invece tutte le fonti inviate. Gli avvisi dichiarano fonti illeggibili, copertura semantica e limiti raggiunti.

| Limite | Valore |
| --- | --- |
| Documenti/appunti considerati | 200, appunti per primi |
| Dimensione di un PDF | 40 MiB |
| Pagine per PDF | 250 |
| Tempo di lettura per PDF | 20 secondi |
| Dimensione di un file di testo | 2 MiB |
| Testo estratto per documento | 250.000 caratteri |
| Testo estratto complessivo per invio | 2.000.000 caratteri |
| Passaggi locali inviati al modello | 24.000 caratteri di testo e riferimenti, più struttura JSON |
| Cronologia inviata | Fino a 24 messaggi e 24.000 caratteri di contenuto; eventuali campi tecnici del provider sono aggiuntivi |
| Domanda | 12.000 caratteri |
| Archivio JSON di una sessione | 8 MiB |

Il chatbot riceve una selezione, non l’intero zaino. Una domanda con termini o riferimenti più precisi migliora la ricerca nei materiali lunghi. I messaggi già presenti nella cronologia possono parlare di materiali successivamente rimossi: il prompt richiede di usare il contesto più recente per stabilire quali fonti siano ancora disponibili.

## Fonti, citazioni e studio

Il bottone con l’icona elenco nella toolbar della chat apre **Fonti selezionate**: il contatore mostra quante fonti sono ammesse oppure «Tutte». Il suggerimento al passaggio del mouse spiega la scelta. I selettori sono cerchi con un pallino verde; mantengono il comportamento di checkbox per selezionare più documenti. Wikipedia richiede il consenso nello stesso pannello.

Le citazioni nella risposta sono numeri in apice cliccabili. L’elenco **Fonti citate** rimane visibile sotto il testo, in ordine di prima citazione e senza duplicare la stessa pagina. Numeri ed elenco aprono la fonte verificando identità e revisione. Il riconoscimento condiviso accetta sia gli alias interni sia l’etichetta completa inviata al modello, anche fra backtick: funziona anche nelle risposte già salvate. Nomi, pagine e alias inventati non acquistano un collegamento. La copia negli appunti conserva numeri in apice cliccabili e l’elenco con i rimandi PDF revisionati. Conserva inoltre l’intero passaggio recuperato, senza il precedente taglio a 800 caratteri. Per le risposte storiche che hanno soltanto l’estratto ridotto compare «Estratto storico abbreviato», con lunghezza e invito ad aprire la fonte. La risposta originale e la provenienza restano indipendenti dalla chat.

**Cerca e studia** è uno strumento del Banco, selezionabile dal menu dello split e affiancabile a PDF, appunti e Ripasso. Funziona con la chat chiusa. Contiene la ricerca locale per parole/significato, le schede (sintesi, concetti, prerequisiti, domande, argomenti e prove) e l’accesso a interrogazione/ripasso. Il campo **Che cosa vuoi trovare?** cerca nei documenti e negli appunti selezionati attraverso l’indice locale, non nella cache delle schede. Una scheda conservata negli appunti diventa una fonte ricercabile come gli altri appunti. Indice e ricerca non chiamano il provider. Schede, domande e riscontro sul tentativo usano il provider configurato nelle impostazioni. Le note sul recupero sono espandibili e distinte dall’elenco delle fonti citate.

Ricerca e Ripasso hanno ciascuno un selettore **Fonti** nella propria toolbar: tutto lo zaino oppure più fonti scelte con cerchi e pallino verde. Le scelte sono conservate per strumento, vault e zaino e non modificano l’ambito della chat. Nel Ripasso filtrano sia le nuove domande sia l’elenco delle domande conservate; una domanda che usa più fonti compare quando tutte sono ammesse. Il menu **Riprendi** sostituisce i grandi pulsanti che ripetevano il testo della domanda. La sezione generale non è collassabile; restano espandibili indizio, fonti, soluzione e tentativi precedenti. **Interrompi** compare soltanto durante un’operazione.

**Apri Ripasso** è una scorciatoia che porta allo split omonimo, senza generare domande. Le intestazioni verdi distinguono **Indice sul dispositivo** e **Schede delle fonti**. Dopo il download esplicito del modello, l’indice si aggiorna automaticamente sulle fonti leggibili dello zaino aperto: all’apertura e circa 1,2 secondi dopo aggiunte, modifiche salvate o rimozioni, anche esterne all’app. Un cambiamento durante il lavoro viene ripreso al termine. I passaggi invariati sono riutilizzati; la scelta delle fonti limita la ricerca, non la preparazione dell’indice. Stato, avvisi e progresso compaiono sotto il campo di ricerca anche con Indice chiuso. Senza modello resta disponibile la ricerca lessicale. **Aggiorna ora** forza un controllo manuale; **Ricostruisci indice** riparte dalla cache della ricerca conservando schede, appunti e ripassi. Le operazioni manuali sospendono e poi riattivano l’aggiornamento automatico.

Dentro **Schede delle fonti**, il **Raccoglitore delle schede** elenca tutte le analisi già generate nello zaino, indipendentemente dalle fonti ammesse alla ricerca. Il filtro cerca nome della fonte o tipo; ogni voce mostra data e stato (aggiornata, fonte modificata o non disponibile), più l’eventuale copertura parziale. Il clic apre la copia conservata senza una nuova chiamata AI. **Aggiorna elenco** rilegge il raccoglitore; sotto rimangono i comandi per preparare nuove analisi. File illeggibili sono segnalati.

Le sezioni **Fonti, Appunti, Media e Mappe** della sidebar si espandono o si chiudono dal titolo, mantenendo la scelta per vault e zaino. I comandi di creazione e organizzazione restano raggiungibili e riaprono la sezione. Fra titolo e primo elemento non c’è più il margine vuoto.

La copia di una scheda usa come titolo il tipo e il nome del file, per esempio **Sintesi — 01 Energia nelle cellule.pdf**, sia nei metadati sia nel corpo dell’appunto. Le etichette introduttive, come **Concetti:** e **Prerequisiti:**, sono in grassetto nella scheda e nella copia. Il nome tecnico del file conserva l’identificatore per evitare doppioni; le copie già modificate dall’utente non vengono riscritte. Gli elenchi puntati e numerati hanno un rientro dedicato nelle anteprime dei due editor, comprese le viste affiancate.

## Ruoli e adattamenti

**Tutor socratico** guida con una domanda e indizi progressivi, chiedendo un tentativo prima della soluzione. **Spiegamelo** spiega e può integrare Wikipedia. **Chiedimelo** propone una domanda alla volta, aspetta la risposta e dà un riscontro prima di proseguire.

I prompt applicano soltanto gli adattamenti scelti nel profilo: lettura, carico cognitivo, conoscenze, lingua, stile, lunghezza, esempi e verifiche. Le preferenze descrivono come la persona desidera studiare; non sono diagnosi o valutazioni delle sue capacità.

Solo Spiegamelo esegue una ricerca Wikipedia. La ricerca invia termini ricavati dalla domanda, senza estratti dei documenti o del profilo, e riceve fino a tre estratti introduttivi di 1.600 caratteri. Il timeout è di otto secondi; un errore della ricerca viene segnalato e permette comunque la risposta del provider. Le fonti Wikipedia hanno URL espliciti e sono distinte da quelle del vault. Si usa l’[API Search di MediaWiki](https://www.mediawiki.org/wiki/API:Search) con [TextExtracts](https://www.mediawiki.org/wiki/Extension:TextExtracts).

## Guardrail e isolamento

Documenti, appunti, estratti Wikipedia e preferenze libere sono delimitati come dati non fidati; i prompt vietano che cambino ruolo, rivelino credenziali o autorizzino operazioni. Il modello non riceve strumenti per eseguire comandi, modificare documenti o consultare altri vault. Le regole chiedono citazioni e dichiarazioni di incertezza; il contenuto della risposta resta generato dal modello e non è una verifica automatica della sua correttezza.

Le operazioni su disco validano zaino e identificatori, rifiutano collegamenti simbolici interni e verificano il marcatore dello zaino e la sua identità prima e dopo la risposta. Gli invii concorrenti sulla stessa sessione sono rifiutati. Se lo zaino viene eliminato o sostituito durante una richiesta non viene ricreato dal salvataggio finale.

## Verifica

Eseguire `npm run test:ui` per la suite dello zaino sintetico, inclusi `prova-chat-zaino.js` (i gesti), `prova-chat-stile.js` (il vestito) e `prova-chat-fonti.js` (citazioni complete, apici, elenco, pagine e selettori). La prova di stile misura nei due temi gli angoli vivi delle superfici, le due altezze dei comandi (`--tb-h` in barra, `--ctl-h` altrove), l’ombra `--sh-3d` solo sugli elementi flottanti, gli stack di font e la grammatica `.tbar`. I selettori circolari e i rimandi testuali seguono le proprie misure. Il modello reale si abilita con `STUDIA_RAG_MODEL`; il runner si rifiuta di riusare una porta occupata.

Eseguire inoltre `node test/chat-profili.js` e `node test/chat.js`. I test usano provider e Wikipedia simulati, un PDF reale generato localmente e vault temporanei. Verificano aggiornamento del contesto, adattamenti del profilo, ruoli, fonti, persistenza, errori, annullamento, concorrenza, isolamento e rifiuto dei collegamenti simbolici. Non richiedono chiavi API.
