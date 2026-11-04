# Export ZAINO verso Word — valutazione documentale

4 novembre 2026. Fonti primarie e lettura delle capacità dichiarate; nessuna prova di apertura in Microsoft Word effettuata in questa ricerca, nessuna modifica all'app o ai dati. Le raccomandazioni e la matrice di trasformazione sono valutazioni progettuali, non promesse di fedeltà già misurata.

Codice esaminato: `7d4b08e`; ramo `codex/valutazione-editor-export-word`. Confronto dei motori di scrittura: [Editor visuale APPUNTI](VALUTAZIONE-EDITOR-APPUNTI.md).

## Decisione proposta

**DOCX come export modificabile principale; RTF come opzione secondaria; PDF per un aspetto impaginato stabile.** L'export può essere costruito anche con l'editor attuale: non dipende dalla migrazione a Tiptap. Per ZAINO il punto difficile è risolvere il documento e il suo contesto (stili callout, evidenze, figure, provenienza), poi scrivere il formato prescelto.

Anche **DOCX è un formato basato su uno standard aperto**, Office Open XML (ECMA-376, ISO/IEC 29500); scegliere DOCX non significa scegliere un archivio binario proprietario o richiedere Word installato per generarlo. RTF ha una specifica pubblicata da Microsoft, ma non va confuso con uno standard OASIS/ISO indipendente: è un formato storico di interscambio. [ECMA-376](https://ecma-international.org/publications-and-standards/standards/ecma-376/), [specifica Microsoft RTF](https://learn.microsoft.com/en-us/previous-versions/office/developer/office2000/aa140277(v=office.10)).

## Formati

| Formato | Vantaggio | Limite per questo scopo | Valutazione |
|---|---|---|---|
| DOCX | Testo modificabile, stili semantici, liste, immagini incorporate, tabelle e riferimenti; destinazione naturale Word | Richiede mappatura esplicita dei costrutti ZAINO e verifica nelle versioni Word target | Prima scelta |
| RTF | Pubblico, scambio fra applicazioni desktop; supporta font, colori, tabelle, immagini, bordi e campi | Un buon writer RTF è lavoro reale: Unicode/emoji, escape, liste, tabelle e immagini; meno conveniente come base per funzionalità evolute e Web | Secondo formato, non semplice testo povero |
| ODT | Standard aperto OASIS, naturale per LibreOffice | Word lo apre ma documenta differenze e perdite di formattazione rispetto a DOCX | Utile se priorità interoperabilità con suite ODF, non prima scelta per Word |
| HTML/MHTML | Vicini al renderer esistente; Word desktop può importarli | CSS browser, pseudo-elementi, variabili, impaginazione e media non equivalgono a Word; MHTML aggiunge asset in un archivio ma non risolve la fedeltà CSS | Formato ponte o export Web, non promessa Word fedele |
| DOC legacy | Apribile nelle versioni storiche di Word | Formato binario più vecchio, nessun beneficio per nuovi export | Evitare come default |
| RTFD | Comodo nell'ecosistema Cocoa per RTF e allegati | Pacchetto con estensioni Apple, non sostituto portabile del RTF singolo | Non proporlo come Word |
| Markdown/TXT | Leggibili, semplici, utili come sorgente | TXT perde formattazione; MD non descrive tutto l'aspetto ZAINO e non è un documento Word pronto | Conservare come sorgente/archivio |
| PDF | Ottimo per consegna, stampa e confronto visivo | Aprirlo in Word comporta ricostruzione; non equivale a esportare un documento nativamente modificabile | Affiancare, non sostituire DOCX |

Microsoft distingue esplicitamente i formati e segnala possibili perdite ODT. La pagina Word per il Web non indica RTF fra i formati supportati: non promettere lo stesso flusso per Word desktop e browser. [Formati Office](https://learn.microsoft.com/en-us/office/compatibility/office-file-format-reference), [ODT in Word](https://support.microsoft.com/en-us/word/use-word-to-open-or-save-a-document-in-the-opendocument-text-odt-format), [differenze Web/desktop](https://support.microsoft.com/en-us/word/differences-between-using-a-document-in-the-browser-and-in-word). La documentazione Microsoft Web presenta differenze fra pagine sul supporto ODT; testare il target reale invece di generalizzare il vecchio elenco.

[ODF OASIS](https://docs.oasis-open.org/office/OpenDocument/v1.3/OpenDocument-v1.3-part1-introduction.html) e [estensioni RTF/RTFD Apple](https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/AttributedStrings/Tasks/RTFAndAttrStrings.html) chiariscono la distinzione dei formati. La specifica RTF 1.9.1 storica non era raggiungibile direttamente dal vecchio download Microsoft durante questa verifica; non si attribuiscono a quel PDF capacità non lette. La pagina Microsoft 1.6 resta consultabile e include font/colori/liste/immagini/tabelle/campi fra i costrutti.

## Strategie tecniche

### 1. Generazione DOCX locale con docx.js — preferita

`docx` è MIT, funziona in Node e nel browser. `Packer` compila la struttura in OOXML e la impacchetta come ZIP DOCX; non occorre automatizzare Word. [Repository ufficiale](https://github.com/dolanmiu/docx), [Packer](https://docx.js.org/api/classes/index.Packer.html).

Proposta: modello di export risolto → Paragraph/TextRun/Table/Image/Hyperlink → Buffer → salvataggio Electron. È uno scrittore, non un convertitore universale del CSS dell'app. Vantaggio: controllo fine, offline e dipendenza JS integrabile. Costo: tradurre e testare tutte le strutture supportate; eventuale patch OOXML solo dove il writer non espone una proprietà necessaria. Non costruire OOXML a mano per tutte le funzioni.

Le proprietà di testo espongono font, dimensione, colore, spaziatura, sottolineato e shading. Il normale highlight Word ha una palette enumerata: per colori arbitrari delle evidenze usare shading o una trasformazione dichiarata; evitare di convertire tutti i colori al giallo. [Run style](https://docx.js.org/api/types/index.IRunStylePropertiesOptions.html). Le celle possono contenere paragrafi e tabelle annidate, utile per callout con contenuto articolato. [TableCell](https://docx.js.org/api/types/index.ITableCellOptions.html).

### 2. Tiptap DOCX Export Pro locale — alternativa reale se si adotta Tiptap

**Precisazione importante rispetto alla generalizzazione “Conversion = cloud”: l'attuale `@tiptap-pro/extension-export-docx` esegue l'export interamente nel client, senza token né chiamate al servizio.** Richiede comunque pacchetto Pro da registro privato e trial/abbonamento. La variante REST gira invece sul servizio. [Installazione](https://tiptap.dev/docs/conversion/getting-started/install), [DOCX Export](https://tiptap.dev/docs/conversion/export/docx/editor-extension).

La versione documentata è Beta v0.26.1. Supporta mapper `customNodes` e override delle strutture, inclusi oggetti docx.js; quindi riduce parte del lavoro sullo schema standard ma non elimina quello specifico ZAINO. Per produzione andrebbero verificati condizioni di distribuzione/offline e contratto, senza dedurre che il solo “no auth per conversione” sia una licenza gratuita.

Altri flussi Conversion possono richiedere servizio e autenticazione; esiste offerta on-premises, ma non va equiparata a una piccola dipendenza desktop incorporabile. [Panoramica Conversion](https://tiptap.dev/docs/conversion/getting-started/overview), [offerta piattaforma](https://tiptap.dev/pricing).

Nel DSL delle conversioni REST gli hyperlink esterni accettano solo http/https/mailto/tel. È un motivo aggiuntivo per convertire i riferimenti ZAINO in provenienza leggibile, non esportare soltanto `pdf:`/`ev:`. Questo limite del DSL non va attribuito automaticamente a tutte le funzioni custom dell'export locale. [Custom-node DSL](https://tiptap.dev/docs/conversion/export/docx/custom-nodes-dsl).

### 3. Pandoc locale — buona strada multi-formato

Può scrivere DOCX/RTF/ODT, usare un documento di riferimento per gli stili e filtri/Lua per adattare il modello intermedio. La documentazione avverte che privilegia struttura e non tutte le proprietà visive dell'origine. [Manuale Pandoc](https://pandoc.org/MANUAL.html), [licenza GPL e descrizione](https://www.pandoc.org/).

Per ZAINO servirebbe un reader o una normalizzazione che riconosca callout, evidenze e figure, quindi AST Pandoc + stili; non inviare semplicemente il Markdown grezzo o l'HTML stampato aspettandosi equivalenza. Efficiente se servono molti formati e formule, meno diretto per copia esatta dei colori e microstili dell'app. Introduce un eseguibile per piattaforma e gestione distribuzione/licenze.

### 4. LibreOffice headless locale — utile conversione di formati Office

La CLI `soffice --convert-to` espone filtri RTF, ODT e DOCX oltre a formati storici. Può convertire un DOCX prodotto bene in RTF/ODT, o un documento intermedio controllato. [Filtri ufficiali](https://help.libreoffice.org/latest/en-US/text/shared/guide/convertfilters.html).

Ha il vantaggio di un motore office completo e nessun costo per licenza d'uso, ma aggiunge installazione/peso/avvio, processo esterno, gestione profilo e compatibilità dei filtri. La conversione secondaria è un ulteriore punto dove il layout può cambiare. Per la qualità in Word resta necessario aprire e confrontare in Word, non soltanto in LibreOffice. [Licenze](https://www.libreoffice.org/licenses/), [FAQ](https://www.libreoffice.org/faq/).

### 5. Writer RTF dedicato — fattibile, con ambito dichiarato

Dal medesimo modello risolto si può generare RTF senza dipendenze pesanti: font table, color table, paragrafi, runs, liste, tabelle e immagini. Per un sottoinsieme ben definito è ragionevole; supportare fedelmente tutto significa mantenere un secondo exporter. Necessari Unicode corretto (surrogate pair per emoji), escape di parentesi/backslash, dimensioni, immagini incorporate e liste semantiche. Non confondere “RTF è testo” con “basta concatenare stringhe”.

### 6. Motore macOS già presente — utile per prova/fallback, non base cross-platform

Su questo Mac `/usr/bin/textutil -help` elenca conversioni txt/rtf/rtfd/html/doc/docx/odt/wordml/webarchive. È stato eseguito solo `-help`; nessuna conversione o prova di fedeltà. AppKit offre NSAttributedString per formati documentali. [API Apple](https://developer.apple.com/documentation/foundation/nsattributedstring/documenttype).

È una possibilità locale senza installare una suite, ma legata a macOS e alle capacità del suo importatore HTML/attributed strings. Non garantisce CSS, callout e asset ZAINO: serve la stessa prova con un campione completo. Non usarla per promettere identico funzionamento su Windows/Linux.

### 7. HTML dentro DOCX con altChunk — da evitare per compatibilità ampia

`html-docx-js` crea un contenitore DOCX con HTML/MHT da importare al momento dell'apertura; non è lo stesso che creare tutti gli elementi Word nativi. Il README avverte limiti in LibreOffice/Google Docs e Word Mac 2008. È una fonte storica, quindi non dimostra da sola il comportamento di Word Mac corrente o Web. Per ZAINO scegliere OOXML nativo ed evitare di basare la compatibilità sulla conversione al primo avvio. [Repository del progetto](https://github.com/evidenceprime/html-docx-js).

### 8. Convertitore HTML → OOXML nativo — confronto utile per ridurre il lavoro

Esistono anche convertitori che producono strutture Word, come `@turbodocx/html-to-docx` (MIT, Node/browser), distinti dall'approccio altChunk. Possono ridurre il codice di mapping per paragrafi, liste e tabelle già resi in HTML. Il progetto documenta però differenze fra lettori, in particolare per i font. [Repository e limiti dichiarati](https://github.com/TurboDocx/html-to-docx).

Per ZAINO andrebbe preparato HTML di esportazione controllato: stili espliciti supportati, liste vere, immagini incorporate e riferimenti risolti. Non basta copiare il DOM dello split con variabili CSS, pseudo-elementi e link interni. È una buona alternativa da confrontare con docx.js sullo stesso campione, senza assumere fedeltà completa al CSS di Chromium. Non è stata installata o provata in questa valutazione.

## Traduzione dei contenuti ZAINO — proposta di contratto

| Contenuto | Rappresentazione Word proposta | Limite da dichiarare/verificare |
|---|---|---|
| Titoli e testo | Stili Word e runs, font/colore/grassetto/corsivo | Il documento mantiene struttura e stile, non la larghezza dello split o zoom 75% |
| Callout | Gruppo di paragrafi bordati/sfondati; per struttura complessa tabella a cella unica con contenuto modificabile | Bordo laterale e tinta si possono riprodurre; CSS non è copiabile direttamente, controllare interruzioni pagina |
| Titolo callout/icone | Stile dedicato; icona immagine o simbolo con fallback | Emoji/simboli dipendono dai font; immagine stabilizza l'aspetto dell'icona mantenendo il corpo testuale editabile |
| Liste | Numerazione/puntatori Word reali | I marcatori CSS `::before` dell'app vanno materializzati; non bastano stili HTML |
| Evidenze | Snapshot del colore/tratto corrente, shading/underline Word; postille come note/commenti o testo di supporto | Nel file esportato non continuano a sincronizzarsi con l'indice ZAINO |
| Citazioni/fonti | Etichetta fonte, pagina/minuto, eventuale URL pubblico; bookmark per rimandi dentro lo stesso file | `pdf:`, `album:`, `ev:` non sono destinazioni portabili al destinatario; metadata nel package non rendono quei click magicamente funzionanti |
| Figure ALBUM/PDF | Immagini incorporate con dimensione calcolata dalla larghezza utile della pagina; didascalia testuale | Risolvere ID e ritagli prima di scrivere, niente dipendenze da percorsi del Mac originario |
| Tabelle | Tabelle native e intestazioni | Testare celle lunghe, margini e salto pagina |
| Codice e righe vuote | Stile monospaziato; paragrafi/spaziatura intenzionali | Conservare il significato del bianco evitando normalizzazione distruttiva |
| Formule | Equazioni Word OMML ove supportate, altrimenti immagine con testo/LaTeX alternativo | Formula come immagine non è una formula editabile; scelta visibile |
| Video/audio/GIF | Poster e riferimento leggibile | Non promettere playback/animazione del documento appunti dentro Word |

La mappa si applica a DOCX e, per le proprietà supportate dal writer scelto, a RTF. RTF non è privo di tabelle o immagini; cambia la convenienza dell'implementazione e la verifica dei lettori, non la presenza di quelle categorie nel formato.

## Confini di fedeltà

Le preferenze macchina di ZAINO (tema, zoom, font di lettura) vanno distinte dagli stili scelti come parte del documento. Il codice attuale distingue stili callout nel vault da font/tema/dimensioni globali in localStorage; la stampa ha già valori propri su carta. Serve un profilo di export esplicito, non catturare indiscriminatamente computed CSS del viewport corrente.

### Evidenze specifiche del codice ZAINO

- `App/StudIA.html`, `riquadriOvr`/`calloutDef`: etichetta, emoji e due colori sono risolti da `<vault>/.studia/prefs.json`, oltre ai valori predefiniti. Esportare soltanto il Markdown non recupera gli stili personalizzati.
- `App/assets/lettura/capitolo.js`, `evidenzaHtml`: colore, tratto e postilla arrivano dall'indice delle evidenze. Il file Word deve ricevere lo stato corrente risolto; una modifica successiva in ZAINO compare in una nuova esportazione.
- `foglioAppunto` riusa `renderNoteMd` per stampa/PDF. È una buona fonte di confronto visivo, ma `stampaSenzaRimandiMorti` elimina le ancore interne `#`: l'export Word deve recuperare la provenienza PRIMA di quel passaggio, dal Markdown e da `RimandiSintassi`.
- I titoli a schermo hanno dimensioni dipendenti dalla finestra; `App/assets/stampa/foglio.js` usa invece A4 e punti. Il renderer APPUNTI attuale conserva i livelli Markdown (`mdToHtml(..., true)`); l'esportatore può mapparli a Titolo 1–6 Word, assegnando misure appropriate al documento.
- Alcuni punti elenco dei callout sono generati da `::before` e contatori CSS: copiare il solo testo DOM o il CSS in un convertitore generico può perdere la numerazione.

Il profilo proposto conserva i colori espliciti del contenuto, sceglie font e misure per il documento e risolve i colori automatici sulla carta chiara; lo zoom 75% e il tema dell'interfaccia non diventano stili del file. Se si vuole usare come default il font di lettura scelto dallo studente, lo si copia esplicitamente nel profilo di esportazione; non lo si lascia dipendere dal dispositivo che apre Word.

Per i callout la tinta `color-mix` va risolta rispetto al fondo carta; l'export non dovrebbe cambiare perché l'utente ha il tema scuro. I font richiedono disponibilità sul dispositivo destinatario o incorporamento consentito. Microsoft documenta restrizioni di embedding e differenze fra subset di glifi e font completo: non presumere che il font presente nel bundle ZAINO possa essere liberamente redistribuito. [Font embedding](https://support.microsoft.com/en-gb/office/fonts/benefits-of-embedding-custom-fonts), [Microsoft font FAQ](https://learn.microsoft.com/en-us/typography/fonts/font-faq).

Nessun formato editabile garantisce righe e pagine identiche su tutti i motori e sistemi. Definire fedeltà a livelli: contenuto e struttura integri; stili controllati; immagini e riferimenti presenti; impaginazione ragionevole. Per l'identità visiva paginata offrire anche PDF.

## Prova da fare prima di dichiarare compatibilità

Un appunto sintetico unico con tutti i costrutti, esportato e riaperto in Word Mac e Windows nelle versioni target e Word Web se previsto; confronto di testo/struttura/XML più immagini delle pagine. Modificare in Word un callout, una lista e una didascalia, salvare e riaprire. Verificare font mancanti, file senza rete, immagini non disponibili e citazioni interne.

Esportare preservando forma e contenuto non implica importare senza perdite un DOCX arbitrario modificato in Word. Il rientro verso Markdown va valutato separatamente; se in futuro si vogliono ricostruire callout/ID ZAINO serviranno stili e metadati riconoscibili, con fallback leggibile.

Priorità proposta: (1) modello risolto ed export DOCX locale con docx.js; (2) test di fedeltà e preset export; (3) RTF derivato o writer dedicato se il bisogno è confermato. Se si sceglie Tiptap, confrontare anche l'export Pro locale con lo stesso campione prima di pagare il costo di manutenzione del mapper standard.
