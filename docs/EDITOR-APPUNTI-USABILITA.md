# Strumenti APPUNTI e controllo ortografico

Implementazione sul ramo `codex/appunti-usabilita`, base `bd48373`, novembre 2026. Notarizzazione sospesa.

## Uso nell’editor corrente

- Il selettore del paragrafo mostra `¶ Testo`, `# Titolo`, `## Sottotitolo 1` fino a `###### Sottotitolo 5`. Funziona sulla selezione; Annulla ripristina la formattazione precedente. I blocchi di codice restano intatti. Sono riconosciuti anche i titoli Markdown con sottolineatura `===` o `---`.
- Il pulsante Sommario elenca i titoli con la loro gerarchia e porta al punto scelto.
- Nella vista A4, il doppio clic entra in Scrittura vicino alla parola cliccata, conservando la mappatura del renderer esistente.
- L’incolla HTML converte titoli, enfasi, elenchi e collegamenti in Markdown. Il testo semplice conserva il comportamento precedente. Le immagini diventano testo alternativo con un messaggio che indica ALBUM; le tabelle ZAINO continuano a usare il proprio gestore. Non è un importatore completo di documenti Word o di tutti gli stili HTML.
- Il menu Ortografia mostra le sigle ITA, ENG, la coppia configurata (inizialmente ITA + ENG) e OFF. Dal fondo del menu si possono scaricare altri dizionari e configurare la coppia ITA + seconda lingua. La scelta è condivisa fra i nove editor. Controlla le parole visibili, dopo una breve pausa; un solo clic destro sulle sottolineature apre un bubble vicino alla parola; un clic sul suggerimento corregge il testo. Escape e clic esterno chiudono il bubble senza modificare il testo. La correzione è annullabile. Controllo e dizionari sono locali, senza chiamate a servizi esterni.
- I selettori di gerarchia e lingua usano il font UI scelto in Impostazioni → Aspetto e la misura condivisa con le altre toolbar. Negli split stretti, selettori e sommario si trovano in Altri strumenti.

## Perché Hunspell

Hunspell è il motore e il formato dei dizionari. La qualità dipende dal lessico, dalle regole di affissazione e dall’ordinamento dei suggerimenti. Questa scelta copre ortografia e suggerimenti, senza comprendere un controllo grammaticale o stilistico contestuale.

La scelta risponde a tre esigenze concrete: funzionamento offline, dizionari italiani/inglesi disponibili e licenze compatibili con ZAINO, attualmente GPL-3.0-or-later. Non è stata eseguita una graduatoria comparativa che dimostri che sia il migliore.

| Componente | Provenienza e licenza | Scelta |
|---|---|---|
| Italiano | [wooorm/dictionaries, italiano](https://github.com/wooorm/dictionaries/tree/main/dictionaries/it); pacchetto `dictionary-it` 2.0.0, Italian Writing Aids 5.0, GPL-3.0 | Distribuito con attribuzioni e file `.aff`/`.dic` |
| Inglese US | [wooorm/dictionaries, inglese](https://github.com/wooorm/dictionaries/tree/main/dictionaries/en); `dictionary-en` 4.0.0, SCOWL 2020.12.07, MIT e BSD | Inglese americano dichiarato nella UI; `colour` può risultare errore |
| Hunspell | [sorgenti](https://github.com/hunspell/hunspell/tree/v1.6.2); versione nativa 1.6.2, MPL/GPL/LGPL alternative | Usato secondo l’opzione GPL compatibile con ZAINO |
| WebAssembly | [hunspell-asm](https://github.com/kwonoj/hunspell-asm), 4.0.2, wrapper MIT | Worker locale; ricetta nativa e sorgenti inclusi |
| Alternativa dizionari | [LibreOffice/dictionaries](https://github.com/LibreOffice/dictionaries) | Le licenze vanno controllate per ciascuna lingua; non basta la licenza del contenitore |

La prima prova con nspell (implementazione JavaScript) ha saturato un core per oltre un minuto durante il caricamento italiano. È stata interrotta ed esclusa dall’implementazione. La versione WebAssembly di Hunspell ha inizializzato i dizionari nella prova locale in circa 30 ms per italiano e 8 ms per inglese: misure isolate sul computer di sviluppo, non un benchmark fra prodotti né tempi garantiti nell’app.

Il campione di regressione controlla `perché`, `città`, `dell’acqua`, `fotosintesi`, `mitocondri`, `knowledge`, `photosynthesis` e correzioni come `conoscienza → conoscenza`, `recieve → receive`. Sono esempi limitati: `squola` non propone `scuola` fra le prime tre alternative osservate. Servono un corpus più ampio e prove con persone che studiano per valutare qualità e falsi positivi.

Le versioni dei dati e del motore sono datate e bloccate per riproducibilità; non sono presentate come le più recenti. Aggiornamenti di dizionari e motore devono ripetere le prove, non limitarsi al numero di versione. Il wrapper dipende da nanoid 2.1.11: l’audit segnala vulnerabilità relative al parametro della dimensione. I due usi nel bundle Hunspell sono interni, entrambi con costante intera `45`, senza parametro derivato dagli appunti. Questa delimitazione non equivale a un audit completo del motore.

Le licenze compaiono nei Crediti. Per `emscripten-wasm-loader` il manifest dichiara MIT ma il progetto omette il file LICENSE: è incluso il testo canonico, esplicitamente etichettato come tale. Sorgenti nativi, ricetta di compilazione e impronte dei dizionari sono in `App/assets/appunti/vendor/sorgenti` e `PROVENIENZA.json`.

## Riproduzione e verifiche

```sh
npm ci --ignore-scripts
npm run appunti:build
npm run appunti:verifica
node test/appunti-ortografia.js
npm test
STUDIA_PORTA=9362 bash bin/prova-zaino.sh
```

I test UI richiedono Electron installato. Le prove usano uno zaino temporaneo sintetico; `npm test` include una prova di sintesi vocale macOS, che richiede accesso al servizio di sistema. La prova ortografica esegue il bundle effettivamente distribuito e usa i suoi dizionari locali. La prova UI registra anche titoli, codice, sommario, incolla, cursore A4, suggerimenti e Undo.

## Prototipo Tiptap

Il [laboratorio](esperimenti/tiptap-appunti/demo.html) permette di scrivere direttamente nel testo formattato, usare i sei livelli di titolo, enfasi, elenchi, Undo/Redo e passare fra due documenti sintetici. I contenuti ZAINO speciali dei campioni sono nodi atomici che conservano il sorgente: la loro modifica visuale e l’integrazione con il vault restano da implementare. Non è dimostrata la parità completa dell’editor.

```sh
npm ci --ignore-scripts --prefix docs/esperimenti/tiptap-appunti
node docs/esperimenti/tiptap-appunti/demo-build.cjs
./node_modules/.bin/electron docs/esperimenti/tiptap-appunti/demo-prova.cjs
```

Poi aprire `demo.html` in un browser. Il bundle viene costruito localmente ed è ignorato da Git, come le dipendenze dell’esperimento. La prova copre inserimento di testo, Undo, isolamento della cronologia e conservazione dei campioni speciali; non copre ancora IME, accessibilità completa, stampa e autosave nel vault. I limiti precedentemente misurati sono documentati in [Verifica Tiptap](VERIFICA-TIPTAP-APPUNTI.md).

## Esito della verifica del 11 novembre 2026

- `npm test`: 108 file della catena superati. La prima esecuzione senza accesso alla sintesi vocale macOS si è fermata sul file audio temporaneo; l’esecuzione con accesso al servizio è terminata con codice 0.
- Registro UI: 67 prove, di cui 66 effettivamente superate e una RAG reale saltata perché `STUDIA_RAG_MODEL` non era presente. Nella corsa completa il test `prova-sicurezza.js` ha inizialmente fallito sul percorso reale di Electron: l’ambiente usava un symlink verso un altro worktree. Sostituito il symlink con una copia locale, il test dei permessi e quello dei nuovi strumenti sono stati rieseguiti con esito positivo. Nessun controllo di sicurezza dell’app è stato allentato per risolvere il problema.
- Build riproducibile, campione ortografico e inventario Crediti verificati.
- Prototipo Tiptap: prova Electron superata; controllati digitazione, Undo, isolamento fra documenti e conservazione dei campioni speciali. Schermata ispezionata.
- Nessuna compilazione di pacchetto, installazione in Applicazioni o notarizzazione eseguita per questo incarico.

### Correzione della UI ortografica

La regressione `prova-appunti-ortografia-ui.js` riproduceva tendine da 17 px al posto degli 11,5 px condivisi e suggerimenti ancorati alla tendina della lingua. Ora controlla entrambi i font UI, l’apertura con un singolo clic destro, il bubble sulla parola, la scelta mediante mouse reale, Undo, Escape, clic esterno e cambio lingua. Il gestore precede il menu nativo di CodeMirror; il bubble contestuale gestisce esplicitamente la chiusura per evitare che il rilascio dello stesso clic destro lo chiuda subito.

### Selezione, parole chiave e origine APPUNTI

In Scrittura, selezionare una parola con doppio clic oppure trascinare una selezione, quindi fare clic destro al suo interno: si apre lo stesso menu di FONTI (Appunta, Alla mappa, Keyword, Postilla, colori, tratto e Copia; i comandi specifici dei PDF restano disponibili solo sui PDF). Anche le selezioni di testo in lettura usano questo menu. In A4 il doppio clic conserva il gesto già esistente di passaggio alla Scrittura.

Una selezione esplicita ha precedenza sul correttore. Senza selezione, o fuori dalla selezione, il clic destro su una parola sottolineata apre i suggerimenti ortografici. I due menu si escludono; cambiare testo o appunto invalida la selezione conservata dal menu.

Le evidenze con al massimo tre **parole piene**, secondo la medesima regola di FONTI, compaiono in PAROLE CHIAVE. I filtri FONTI e APPUNTI sono esclusivi; TUTTE, inizialmente attivo, mostra entrambe le origini. Condividono la classe dei pulsanti di origine di ALBUM. Le frasi più lunghe restano evidenziate e possono avere una postilla, ma non diventano chip.

Le keyword di APPUNTI si salvano nello stesso archivio `_evidenze.json`, con il campo opzionale `appunto` (nome del file). Gli id di PDF e capitoli non cambiano. Il doppio clic su un chip torna alla parola nell’appunto; il trascinamento in un altro appunto inserisce il consueto collegamento `ev:`, e quello su una mappa personale conserva un rimando all’evidenza. Rinominare l’appunto aggiorna l’origine senza cambiare l’id già citato. Se il testo originale viene rimosso, il ritorno apre la nota e segnala che la parola è cambiata.

Verifiche aggiunte: `test/evidenze-origine-appunti.js` (identità, persistenza, rinomina, idempotenza, postille, rimando) e `test/cdp/prova-appunti-keyword.js` (doppio clic e selezione trascinata reali, precedenza sul correttore, limite delle tre parole, filtri e token ALBUM, trascinamento nativo verso un secondo appunto e una mappa, salvataggio e ritorno alla nota). Registrate nelle rispettive suite.

Verifica finale dell’estensione: `npm test` completato (109 file). Suite UI di 69 prove: 67 superate nella corsa completa, una prova RAG reale saltata per assenza del modello opzionale e una regressione CSS dei tab ALBUM rilevata. La regola comune ora prevale sui token generici dei comandi; sono state rieseguite con esito positivo `prova-appunti-keyword.js`, `prova-indicatori-materiali.js`, `prova-album-unificato.js` e `prova-toolbar-essenziali.js`. Le prove mirate di selezione, ortografia e strumenti sono passate anche dopo gli ultimi controlli su Lettura/Scrittura. Risultato complessivo: tutte le 68 prove UI eseguibili verificate. Notarizzazione ancora sospesa.


### Revisione dopo la prova del 11 novembre: anteprima e dizionari

- Il fondo delle evidenze in Scrittura usa il colore pieno di FONTI; le sovrapposizioni seguono la stessa regola al 55%. La sottolineatura usa le medesime variabili di spessore e distanza. I menu FONTI/APPUNTI condividono dimensione e tratto delle icone SVG.
- Un collegamento a una keyword originata da un altro appunto apre l’origine in un altro banco in anteprima, mantenendo aperta la nota di partenza. Se l’origine è già aperta viene riusato il suo banco; a banco completo viene segnalato che occorre liberarne uno, senza sostituire un appunto. La modalità A4 della nota di partenza viene rispettata.
- Il selettore dei dizionari misura automaticamente il nome più largo e lascia spazio al chevron, anche cambiando font UI. Il menu usa veri pulsanti, accessibili anche con frecce, Invio ed Escape. In fondo: **Scarica altri dizionari** e **Abbina dizionari**. Nella coppia il primo è sempre ITA; il secondo si sceglie fra quelli installati. Modificare la coppia mentre è attiva la applica a tutti gli editor; Annulla lascia intatta la preferenza.
- Italiano e inglese restano inclusi. Il primo catalogo scaricabile contiene FRA (francese), TED (tedesco), SPA (spagnolo). Il testo degli appunti non viene inviato in rete. Download solo da URL del catalogo fissati a una revisione; controllo di dimensioni e SHA-256, installazione atomica e conservazione delle licenze originali in `userData/dizionari`. Il worker carica i file locali attraverso un IPC dedicato: nessun accesso arbitrario del renderer al disco.

Provenienza dei dizionari aggiuntivi: `wooorm/dictionaries`, revisione `8cfea406b505e4d7df52d5a19bce525df98c54ab`. I file `.aff`/`.dic` sono conservati senza modifiche, insieme al file `license` e a `provenienza.json`.

| Lingua | Licenza adottata | Avviso upstream |
| --- | --- | --- |
| Francese | MPL-2.0 | [Grammalecte, dizionario 7.5](https://github.com/wooorm/dictionaries/blob/8cfea406b505e4d7df52d5a19bce525df98c54ab/dictionaries/fr/license) |
| Tedesco | GPL-3.0 (upstream consente GPL 2 oppure 3) | [igerman98](https://github.com/wooorm/dictionaries/blob/8cfea406b505e4d7df52d5a19bce525df98c54ab/dictionaries/de/license) |
| Spagnolo | GPL-3.0-or-later (una delle alternative offerte) | [Dizionario es_ES 2.8](https://github.com/wooorm/dictionaries/blob/8cfea406b505e4d7df52d5a19bce525df98c54ab/dictionaries/es/license) |

Regressioni: `prova-appunti-revisione.js` riproduceva colore al 28%, filtri indipendenti e sostituzione dell’appunto attivo. Ora controlla colore pieno, filtro esclusivo, anteprima separata, A4 e icone condivise. `test/dizionari.js` verifica integrità, installazione incompleta, concorrenza, riuso offline e confini dei permessi. `prova-appunti-dizionari.js` verifica menu, sigle, ingombro, chevron e preferenza della coppia. Il download reale dei tre dizionari e ITA + FRA dopo riapertura si verificano con:

```sh
STUDIA_DIZIONARI_RETE=1 STUDIA_PORTA=9363 bash bin/prova-zaino.sh prova-appunti-dizionari.js
```

Questo consenso alla rete appartiene solo al runner di test e abilita esclusivamente gli URL del catalogo; le altre prove mantengono la rete disabilitata. Non è un’opzione della versione distribuita. Notarizzazione sospesa.

Verifica finale: `npm test` completato (110 file), risorse generate verificate e download reale dei tre dizionari con riconoscimento di francese, tedesco e spagnolo. Suite UI completa: 67 prove superate, una RAG saltata perché manca il modello opzionale, tre da ripetere. La nuova regressione lasciava il secondo editor in A4: corretta la pulizia del test e verificata la sequenza `prova-appunti-revisione.js` → `prova-appunti-a4.js`. Anche `prova-pretext.js` e `prova-lim.js` sono passate nella successiva esecuzione sequenziale; i loro errori nella suite completa non si sono riprodotti e non sono stati modificati i relativi componenti. Complessivamente verificate tutte le 70 prove UI eseguibili.
