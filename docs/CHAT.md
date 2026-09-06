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

I PDF vengono letti localmente con il PDF.js già incluso nell’app, anche se non sono mai stati aperti. Non si avviano OCR, trascrizioni o pipeline di corsi e non si generano indici persistenti. Le pagine senza testo vengono segnalate. Sono inclusi anche file UTF-8 `.txt`, `.text`, `.md`, `.markdown`, `.csv` e `.tsv` in `MATERIALI` e `APPUNTI`; cartelle di indici e trascrizioni vengono escluse.

La selezione usa i termini della domanda, senza embeddings. I passaggi includono nome del file e, per i PDF, numero di pagina. A parità di rilevanza la selezione distribuisce i passaggi tra le fonti. Gli avvisi della chat dichiarano fonti illeggibili e limiti raggiunti.

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

## Ruoli e adattamenti

**Tutor socratico** guida con una domanda e indizi progressivi, chiedendo un tentativo prima della soluzione. **Spiegamelo** spiega e può integrare Wikipedia. **Chiedimelo** propone una domanda alla volta, aspetta la risposta e dà un riscontro prima di proseguire.

I prompt applicano soltanto gli adattamenti scelti nel profilo: lettura, carico cognitivo, conoscenze, lingua, stile, lunghezza, esempi e verifiche. Le preferenze descrivono come la persona desidera studiare; non sono diagnosi o valutazioni delle sue capacità.

Solo Spiegamelo esegue una ricerca Wikipedia. La ricerca invia termini ricavati dalla domanda, senza estratti dei documenti o del profilo, e riceve fino a tre estratti introduttivi di 1.600 caratteri. Il timeout è di otto secondi; un errore della ricerca viene segnalato e permette comunque la risposta del provider. Le fonti Wikipedia hanno URL espliciti e sono distinte da quelle del vault. Si usa l’[API Search di MediaWiki](https://www.mediawiki.org/wiki/API:Search) con [TextExtracts](https://www.mediawiki.org/wiki/Extension:TextExtracts).

## Guardrail e isolamento

Documenti, appunti, estratti Wikipedia e preferenze libere sono delimitati come dati non fidati; i prompt vietano che cambino ruolo, rivelino credenziali o autorizzino operazioni. Il modello non riceve strumenti per eseguire comandi, modificare documenti o consultare altri vault. Le regole chiedono citazioni e dichiarazioni di incertezza; il contenuto della risposta resta generato dal modello e non è una verifica automatica della sua correttezza.

Le operazioni su disco validano zaino e identificatori, rifiutano collegamenti simbolici interni e verificano il marcatore dello zaino e la sua identità prima e dopo la risposta. Gli invii concorrenti sulla stessa sessione sono rifiutati. Se lo zaino viene eliminato o sostituito durante una richiesta non viene ricreato dal salvataggio finale.

## Verifica

Eseguire `npm run test:ui` per le prove sull'app viva: `prova-chat-zaino.js` (i gesti) e `prova-chat-stile.js` (il vestito). La seconda misura nei due temi che la chat non abbia angoli tondi, che ogni comando stia su una delle due altezze del sistema (`--tb-h` in barra, `--ctl-h` altrove), che l'ombra sia `--sh-3d` e solo su ciò che galleggia, che ogni stack di font tenga `--emoji-font` prima del generico e che la testa della finestra sia la `.tbar` dell'app con la sua grammatica. Il mockup d'approvazione, generato dal codice vero, sta in `docs/mockup-chat/` (`node docs/mockup-chat/genera.js`).

Eseguire inoltre `node test/chat-profili.js` e `node test/chat.js`. I test usano provider e Wikipedia simulati, un PDF reale generato localmente e vault temporanei. Verificano aggiornamento del contesto, adattamenti del profilo, ruoli, fonti, persistenza, errori, annullamento, concorrenza, isolamento e rifiuto dei collegamenti simbolici. Non richiedono chiavi API.
