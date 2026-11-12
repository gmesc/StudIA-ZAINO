# Verifica Tiptap Markdown per APPUNTI

4 novembre 2026 · codice ZAINO esaminato: `a484b01` · ramo `codex/check-tiptap-appunti`.

## Esito

**Sì, Tiptap è un candidato adatto per scrivere direttamente nel documento, senza aprire ogni blocco in un campo Markdown. La conservazione di tutta la UI e di tutte le funzioni di APPUNTI è possibile come progetto d’integrazione, ma non è già garantita dal pacchetto Markdown. Non è una sostituzione diretta di EasyMDE.**

La toolbar, i menu, i selettori nella testata, gli split e i token grafici possono mantenere il loro aspetto e le loro azioni. Occorre ricollegarli al nuovo motore e insegnargli le sintassi di ZAINO in entrambi i versi, lettura e salvataggio. Installare soltanto StarterKit e Markdown oggi altererebbe alcuni appunti, anche prima di una modifica sostanziale dell’utente.

L’estensione Markdown è dichiarata **Beta**: parsing verso il documento strutturato e serializzazione verso Markdown sono disponibili, con limiti documentati per commenti e celle di tabella con più nodi figli. Questo non vieta l’uso, ma rende necessarie versioni bloccate e prove di conservazione dei contenuti. [Documentazione ufficiale](https://tiptap.dev/docs/editor/markdown).

**Decisione consigliata:** procedere con un prototipo separato di APPUNTI; sostituire il motore nell’app solo dopo la parità verificata. Questo check non ha sostituito l’editor né modificato l’app in esecuzione o gli appunti personali.

## Cosa è stato realmente verificato

Sono state combinate tre evidenze, con ambiti distinti:

1. Lettura delle API e delle guide ufficiali, confrontate con i sorgenti dei pacchetti effettivamente installati.
2. Audit delle integrazioni EasyMDE/CodeMirror nel codice attuale di ZAINO e delle prove esistenti.
3. Esperimento locale con **Tiptap 3.32.2**, Node 24.22.0 e JSDOM 26.1.0: **21 campioni sintetici e 28 controlli della diagnosi superati**. Questi controlli confermano anche le perdite trovate; non sono 28 prove di parità superate. Non è stata provata una UI Tiptap dentro Electron.

Pacchetti della prova: core, pm, markdown, starter-kit, table, image, highlight, text-style e mathematics, tutti 3.32.2. Parsing con `gfm:true` e `breaks:true`. Dipendenze installate solo in una cartella temporanea, senza script npm. Manifest e lock dell’esperimento sono separati da quelli dell’app.

Codice e risultati riproducibili: [esperimento](esperimenti/tiptap-appunti/verifica.cjs), [risultati completi](esperimenti/tiptap-appunti/risultati.json), [dipendenze bloccate](esperimenti/tiptap-appunti/package-lock.json).

## Compatibilità dei contenuti

| Contenuto | Risultato effettivo della prova | Necessario per APPUNTI |
|---|---|---|
| Titoli, grassetto, corsivo, barrato, codice, elenchi semplici | Riconosciuti nel documento Tiptap | Collegare comandi, scorciatoie e stato della toolbar; verificare anche annidamenti e selezioni miste |
| Link web | Riconosciuti | Conservare dialogo e comportamento di apertura dell’app |
| `pdf:`, `video:`, `cap:` | URL conservati in JSON/Markdown, ma `href` vuoto nell’HTML della configurazione standard | La configurazione dei protocolli conserva gli `href` nel secondo test; servono inoltre validazione con la grammatica ZAINO e apertura nei relativi split |
| Citazioni tra zaini e selezioni di origine | Audit del codice, non prova runtime di questi casi | Conservare `zaino-pdf:`, source ID, revisione, pagina e selezione; riusare `RimandiSintassi`, senza ridurre il riferimento alla sola etichetta visibile |
| Callout `> [!nota] Titolo` | Trattati come citazioni; due callout contigui confluiscono in un solo blockquote. Il serializer aggiunge escape al marcatore | Nodo/tokenizer/serializer specifico; conservare tipo, titolo, contenuto e collegamento ai preset di colore/icona dell’app |
| Wikilink `[[…]]` | Rimangono testo e vengono salvati con escape alle parentesi | Parser e serializer dedicati, con navigazione esistente |
| `[==testo==](ev:id)` | Sintassi e ID conservati; resa come normale highlight dentro link con destinazione HTML vuota | Mark/routing dedicati: colore, tratto e postilla devono continuare a derivare dall’indice delle evidenze, non diventare copie nel file |
| `![didascalia\|93%](album:id)` | `src` e testo alternativo conservati; larghezza non interpretata | Risolvere ALBUM/figure e percentuale tramite un nodo specifico; preservare didascalia e riferimento all’originale |
| A capo singolo | Riconosciuto con `breaks:true`; riscritto come Markdown hard break | Allineare lettura/scrittura al renderer corrente |
| Righe vuote intenzionali | Tre newline diventano due; cinque diventano quattro; con più righe può comparire `&nbsp;` | Conservazione esplicita del bianco: l’attuale renderer conta le righe vuote, quindi non basta la normalizzazione Markdown standard |
| Note a piè pagina `[^1]` | Non interpretate e riscritte con escape | Estensione dedicata se presenti nei file letti dall’app |
| Tabelle semplici e formule `$…$` / `$$…$$` | Riconosciute dalle estensioni installate | Prove di resa/edizione/export nell’app; celle complesse richiedono una strategia distinta |
| Sottolineato HTML `<u>` | Conservato | È una sonda aggiuntiva di formato, non l’affermazione che esista già il relativo bottone in APPUNTI |
| Colore testo HTML e highlight multicolore | Visibili in HTML ma colore perso nella serializzazione Markdown standard | Se esposti, richiedono un serializer che conservi gli attributi. Non confondere questi colori incorporati con quelli dinamici delle evidenze |
| Commenti HTML | Eliminati nel campione | Preservazione opaca o segnalazione esplicita, evitando salvataggi distruttivi |
| Frontmatter | Se passato come contenuto, reinterpretato come separatore/titolo | Continuare a gestirlo fuori dal corpo editabile, come già avviene in ZAINO |

Le perdite sopra sono misurate sulla configurazione dell’esperimento, non limiti assoluti di Tiptap. La documentazione permette tokenizer, parser e serializer personalizzati per nodi e mark. [Estensioni Markdown](https://tiptap.dev/docs/editor/markdown/guides/integrate-markdown-in-your-extension).

La guida ufficiale dei callout usa `:::warning`: dimostra come creare un nodo, ma non fornisce un lettore pronto per i callout Obsidian di ZAINO. [Esempio admonition](https://tiptap.dev/docs/editor/markdown/guides/create-a-admonition-block).

## Come mantenere UI e funzioni attuali

L’audit individua questi contratti da conservare; la sola conversione Markdown non li verifica.

| Area attuale | Collegamento necessario al nuovo motore |
|---|---|
| Toolbar e menu | Stessi pulsanti, ordine, icone, tooltip, overflow e ruoli accessibili. Oggi la barra è generata da EasyMDE e poi decorata da `UiToolbar.appunti`: va ricostruito lo stesso contratto DOM, non applicato il tema predefinito di un altro editor |
| Callout ed emoji | Stessi menu e preset; inserimento nella selezione giusta, anche dopo l’apertura di un popover. Mantenere il controllo dell’epoca del documento per le azioni differite |
| Cita, materiali, evidenze, ALBUM, risposte AI | Stessa destinazione catturata all’avvio dell’azione, stessi riferimenti e inserimenti; non affidarsi allo split che per caso è attivo alla fine |
| Due istanze APPUNTI | Selezioni, documento e cronologia indipendenti. La prova conferma indipendenza dei contenuti, comandi, Undo e Redo, ma non il trasferimento completo nell’app |
| Cambio appunto e trasferimento fra split | Azzerare o ripristinare la cronologia appropriata. Nella prova `setContent(..., emitUpdate:false)` non azzera l’Undo: silenziare l’autosave non equivale a cancellare la storia. Non riutilizzare la serializzazione della storia CodeMirror |
| Autosave, salvataggio manuale, chiusura, bozze | Conservare debounce, flush, gestione errori e protezione da risposte asincrone obsolete. Il modulo `AppuntiSalvataggio` può restare; deve leggere la serializzazione del documento giusto |
| Anteprima e lettura | Conservare il pulsante Anteprima e il comportamento di lettura/proiezione. Non reintrodurre l’icona della vista accostata rimossa su richiesta. F9 e ripristino programmatico vanno gestiti consapevolmente |
| Posizione di lettura, ricerca, guida di riga | Mappare posizioni del documento strutturato verso ancore/offset Markdown: gli attuali numeri di riga CodeMirror non sono intercambiabili con le posizioni ProseMirror |
| Banco, fullscreen, proiezione e zoom 75% | Aggiornare i selettori ora basati su `.CodeMirror`/`.editor-preview`, mantenendo zoom solo sul contenuto, toolbar e testata invariate, e ripristino della posizione |
| Stampa, PDF, importazione e file leggibili fuori dall’app | Conservare il renderer/export corrente finché non è dimostrata l’equivalenza. File `.md` e metadati restano il formato del vault, senza imporre JSON come nuovo archivio |

Per i link, Tiptap consente protocolli personalizzati, validazione e disattivazione dell’apertura automatica. Questo permette di mantenere il routing di ZAINO invece di lasciare al browser l’apertura dei riferimenti. [API Link](https://tiptap.dev/docs/editor/extensions/marks/link).

Per il ponte di caricamento/salvataggio esistono `contentType:'markdown'`, `getMarkdown`, inserimento Markdown e controllo di `emitUpdate`; non sono sostituti compatibili delle API CodeMirror già usate. [API Markdown](https://tiptap.dev/docs/editor/markdown/api/editor).

### Punti del codice esaminati

- `App/StudIA.html`: `noteCreaStato`, `ensureMde`, `renderNoteMd`, `mdbChiudi`, `noteCaricaCorpo`, `noteTrasferisci`, `noteInserisci`, `noteMeta`, `noteSave`, posizione di lettura e gestori dei link.
- `App/assets/appunti/{scrivibile,salvataggio,citazione}.js`: mapping dei blocchi, identità dei salvataggi e composizione delle citazioni.
- `App/assets/lettura/capitolo.js` e `App/assets/rimandi/sintassi.js`: semantica del formato, evidenze dinamiche, immagini, wikilink e provenienza.
- `App/assets/banco/presentazione.js` e `App/assets/chat/schede-ripasso.js`: lettura/proiezione, scroll e selezione esterna all’editor.
- Prove esistenti: `test/appunti-md.js`, `test/evidenze-appunti.js`, `test/rimandi.js`, `test/appunti-autosalvataggio.js`, `test/appunti-asincroni.js`; controlli UI di editor pari, callout, Markdown, citazioni tra zaini e spostamento split.

## Percorso d’integrazione consigliato

1. **Prototipo con la toolbar attuale e dati sintetici.** Un adattatore esplicito per leggere/inserire Markdown, formattare, gestire selezione e ciclo del documento; evitare di simulare l’intera API CodeMirror. Tiptap conserva il documento strutturato durante la scrittura, senza riparsare tutto a ogni tasto.
2. **Dialetto ZAINO completo.** Callout, rimandi, wikilink, evidenze, figure e bianco intenzionale; parser e serializer devono funzionare in entrambi i versi. Metadati e stili dei preset rimangono dove sono già salvati.
3. **Conservazione prima dell’autosave su file esistenti.** Apertura senza modifiche non deve riscrivere il file. Per sintassi sconosciute, conservare il sorgente oppure dichiarare l’impossibilità di modificarle in modo visuale; non eliminarle. La conservazione di segmenti opachi è un requisito da implementare, non una funzione già dimostrata.
4. **Parità verificabile.** Confrontare contenuto e identità, non solo screenshot: formato riaperto nel renderer ZAINO/Obsidian, comandi toolbar, due appunti, Undo/Redo, cambio documento, inserimenti da altri split, autosave tardivo, errori disco/bozze, stampa/PDF, zoom e proiezione.
5. **Attivazione reversibile.** Tenere disponibile il motore attuale finché tutti questi contratti sono coperti e l’esperienza di scrittura è stata provata. Nessuna migrazione massiva dei file per attivare il prototipo.

## Offline, licenza e Word

I pacchetti pubblici provati sono MIT e parsing/serializzazione girano localmente. Per l’editor Markdown non emerge la necessità di un servizio cloud; risorse e dipendenze vanno incorporate nell’app. Verifica basata sui manifest installati e sulla prova locale. [Repository ufficiale](https://github.com/ueberdosis/tiptap), [licenza](https://github.com/ueberdosis/tiptap/blob/main/LICENSE.md).

Import/export Word non è un risultato di questo check: il prodotto Tiptap Conversion è distinto dall’estensione Markdown. **Precisazione dalla ricerca successiva del 4 novembre:** l’attuale estensione DOCX Export Pro esegue la conversione nel client senza server/token; rimane un pacchetto commerciale, mentre altri flussi Conversion usano il servizio. L’eventuale importer DOC/RTF ed exporter DOCX va progettato separatamente; integrare Markdown non li aggiunge automaticamente. [Installazione Conversion](https://tiptap.dev/docs/conversion/getting-started/install), [valutazione aggiornata dell’export Word](VALUTAZIONE-EXPORT-WORD.md).

## Riproduzione isolata

Non eseguire l’installazione nella cartella principale di ZAINO. Dalla cartella principale del progetto, il comando seguente copia solo l’esperimento in una nuova directory temporanea, installa il lock senza script e verifica i campioni sintetici:

```bash
prova_tiptap_dir="$(mktemp -d /private/tmp/zaino-tiptap-prova.XXXXXX)"
cp docs/esperimenti/tiptap-appunti/{package.json,package-lock.json,verifica.cjs} "$prova_tiptap_dir/"
cd "$prova_tiptap_dir"
npm ci --ignore-scripts --no-audit --no-fund
node verifica.cjs risultati.json
```

L’output atteso dichiara esplicitamente che la parità APPUNTI non è raggiunta. Lo script è un esperimento documentale separato dalle suite di produzione; non richiede Electron né un vault.
