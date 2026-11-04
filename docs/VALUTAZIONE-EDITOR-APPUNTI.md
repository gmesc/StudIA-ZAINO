# APPUNTI: alternative per scrivere nel testo formattato

Valutazione del 4 novembre 2026. Solo ricerca e confronto architetturale; nessuna installazione o modifica alla produzione. Riferimento locale letto: `docs/VERIFICA-TIPTAP-APPUNTI.md`, con il precedente esperimento Tiptap 3.32.2. Per gli altri motori non è stata eseguita una prova di compatibilità sul dialetto ZAINO.

Codice esaminato: `7d4b08e`; ramo della valutazione `codex/valutazione-editor-export-word`. La valutazione complementare dei formati è in [Export Word](VALUTAZIONE-EXPORT-WORD.md).

## Che cosa significa «senza blocchi»

L’obiettivo realizzabile è un unico documento editabile: si clicca fra le parole già formattate, si seleziona attraverso più paragrafi, si continua con Invio, e Undo/Redo segue la scrittura. Non occorre far comparire un campo Markdown per il paragrafo attivo.

I motori rich text mantengono comunque nodi strutturali interni per paragrafi, liste e tabelle. Non impongono riquadri visibili, maniglie o una UI a schede. I bordi propri di un callout possono rimanere, perché sono parte del contenuto voluto, mentre spariscono i contenitori di editing attorno ai normali paragrafi. Questa è una distinzione di progettazione, non una limitazione da mostrare agli studenti.

Non serve introdurre pagine A4, margini di stampa o una nuova ribbon: l’esperienza richiesta riguarda cursore, selezione e modifica continua. Togliere cornici e padding a `mdb-edit` non elimina i campi separati né rende trasversale la selezione. Rendere editabile l’HTML del renderer attuale richiederebbe una mappatura affidabile verso il sorgente e gestione di Undo, incolla e composizione IME; non è una modifica soltanto CSS.

## Le possibilità e i compromessi

Le indicazioni di sforzo sono relative a ZAINO, dedotte dalle integrazioni attuali; non sono preventivi né benchmark.

| Soluzione | Esperienza e conservazione | UI, lavoro e giudizio |
|---|---|---|
| Ridurre/eliminare i bordi dell’editor attuale | Migliora l’aspetto, ma il testo attivo continuerebbe a essere Markdown dentro un campo separato | Sforzo basso; non soddisfa il comportamento richiesto |
| **Tiptap con estensioni ZAINO** | Documento rich text continuo; dialetto Markdown da gestire in lettura e scrittura | Prima scelta da prototipare: esiste già una prova locale; i comandi possono alimentare la toolbar attuale. Sforzo medio-alto per la parità, non per mostrare un editor vuoto |
| **Milkdown core** | Editor WYSIWYG orientato a Markdown, costruito su ProseMirror e remark | Alternativa concreta a Tiptap. Headless, MIT; usare il core, non adottare automaticamente la UI completa Crepe. Anche qui callout e rimandi ZAINO richiedono plugin |
| ProseMirror direttamente | Controllo completo dello schema, transazioni, selezioni e formato | Più lavoro su comandi, configurazione e strumenti; utile se le astrazioni superiori ostacolano requisiti concreti. Non migliora automaticamente la conservazione del Markdown |
| **CodeMirror 6 con resa visuale/decorazioni** | Il documento rimane il sorgente Markdown; si possono nascondere marcatori e mostrare widget | Opzione migliore se la priorità assoluta diventa preservare il sorgente anche nelle parti sconosciute. Ottenere il comportamento da Word su selezione, Backspace, tabelle e callout è un lavoro consistente |
| Lexical | Rich text continuo, modello strutturato e trasformatori Markdown personalizzabili | Alternativa valida MIT, core indipendente da React; richiede comunque modello, dialetto e integrazioni ZAINO. Nessuna evidenza raccolta che riduca il lavoro rispetto ai primi due |
| CKEditor 5 / TinyMCE | Funzioni da word processor già organizzate e editor visuale pronto | Adattamento alla UI ZAINO e conversione del dialetto comunque necessari; licenze GPL2+ o commerciali e caratteristiche premium da valutare. Preferibili se si accetta una piattaforma più completa e i relativi vincoli |
| Quill / Slate | Modelli ricchi estensibili, UI personalizzabile | Possibili, ma non emerge un vantaggio specifico per un archivio Markdown con molte convenzioni proprie: serve comunque il ponte dedicato |
| `contenteditable` costruito a mano sull’HTML attuale | Fa apparire subito un cursore nel testo renderizzato | Sembra una scorciatoia, ma trasforma ZAINO nel manutentore di selezioni, incolla, history, composizione e conversione reversibile. Non consigliato per questo requisito di parità |

### Tiptap: prima scelta condizionata, non automatica

L’installazione ufficiale supporta JavaScript senza imporre React; quindi non occorre riscrivere l’app Electron attuale in un framework diverso. [Installazione JavaScript](https://tiptap.dev/docs/editor/getting-started/install/vanilla-javascript).

Il precedente esperimento ha già individuato perdite nella configurazione Markdown standard. La scelta di Tiptap **non obbliga** ad affidarsi senza modifiche al suo pacchetto Markdown Beta: si può adattare quel pacchetto, oppure implementare un ponte controllato tra il dialetto ZAINO e il documento del motore. La seconda strada ha più codice da mantenere e non va presentata come una garanzia automatica. [Estensioni Markdown](https://tiptap.dev/docs/editor/markdown/guides/integrate-markdown-in-your-extension).

### Milkdown: il confronto utile prima della scelta definitiva

Milkdown nasce come editor WYSIWYG Markdown basato su ProseMirror e remark; il core è headless, mentre Crepe aggiunge un’esperienza completa. Il transformer collega AST Markdown e stato ProseMirror, con parser e serializer per lo schema. La guida dei marker mostra come aggiungere sintassi personalizzate. [Repository MIT](https://github.com/Milkdown/milkdown), [styling headless](https://milkdown.dev/docs/guide/styling), [transformer](https://milkdown.dev/docs/api/transformer), [plugin di sintassi](https://milkdown.dev/docs/plugin/example-marker-plugin).

Deduzione per ZAINO: è una vera alternativa al ponte Marked di Tiptap, ma non offre prova di conservazione byte per byte delle righe vuote o del dialetto. ProseMirror e remark introducono comunque una trasformazione strutturale; gli stessi campioni devono essere provati, non assunti compatibili.

### CodeMirror 6: sorgente come dato principale

Le decorazioni possono nascondere intervalli, sostituirli con widget e definire intervalli atomici per il movimento del cursore. Questo permette una vista che rende grassetto, link e immagini mantenendo il testo Markdown sottostante. [Decorazioni](https://codemirror.net/examples/decoration/), [riferimento](https://codemirror.net/docs/ref/).

L’inferenza è che riduce il rischio di riscrivere sintassi sconosciute attraverso un serializer generale. Non elimina però i casi d’interazione: cosa seleziona il cursore vicino a un marcatore nascosto, come si cancella metà di un link, come si attraversa un’immagine, come si edita una tabella. Un’impostazione che rivela il Markdown sul paragrafo attivo è più semplice, ma non realizza pienamente la richiesta di restare sempre nella versione formattata.

Non è un aggiornamento diretto dell’attuale EasyMDE/CodeMirror 5: CM6 cambia moduli, coordinate (offset invece di line/ch), eventi e gestione della storia. [Guida di migrazione](https://codemirror.net/docs/migration/).

### ProseMirror e Lexical: controllo senza un ponte già adatto

ProseMirror è un insieme modulare di strumenti, con schema del documento, transazioni e plugin per comandi/storia. Il modulo Markdown usa markdown-it e consente regole di mapping personalizzate. Non è dichiarato un componente pronto da inserire. [Guida](https://prosemirror.net/docs/guide/), [prosemirror-markdown](https://github.com/ProseMirror/prosemirror-markdown).

Lexical offre core indipendente dal framework, estensioni, history e trasformatori Markdown personalizzabili. La documentazione elenca formattazioni standard e possibilità di transformer propri; ciò non dimostra la compatibilità di callout/ev/album di ZAINO. [Introduzione](https://lexical.dev/docs/intro), [Markdown](https://lexical.dev/docs/packages/lexical-markdown), [licenza MIT](https://github.com/facebook/lexical).

Per entrambe le strade il lavoro decisivo rimane la semantica di ZAINO, non la semplice formattazione del testo.

### Editor completi e altre librerie

CKEditor 5 offre output Markdown GFM, ma il dialetto ZAINO resta distinto; l’edizione open source è GPL2+, quella commerciale e alcune funzioni premium hanno termini separati. [Markdown](https://ckeditor.com/docs/ckeditor5/latest/features/markdown.html), [licenza](https://ckeditor.com/docs/ckeditor5/latest/getting-started/licensing/license-and-legal.html).

TinyMCE 8 permette distribuzione locale GPL2+ oppure commerciale con chiave appropriata; la documentazione distingue gli editor locali dai servizi cloud e dalle prove che validano online. La presenza di un prodotto visuale pronto non garantisce il riuso trasparente di tutte le azioni della toolbar ZAINO. [Licenze e distribuzione](https://www.tiny.cloud/docs/tinymce/latest/license-key/).

Quill usa Delta/Parchment per contenuto e formati; Slate espone serializzazione del proprio modello JSON. Sono opzioni estensibili, ma l’interoperabilità del dialetto richiederebbe lavoro specifico anche lì. [Quill Delta](https://quilljs.com/docs/delta), [Quill estensioni](https://quilljs.com/docs/customization), [Slate serializzazione](https://docs.slatejs.org/concepts/10-serializing).

La scorciatoia basata su `document.execCommand` non è una base consigliabile per un nuovo editor: l’API è deprecata e la documentazione segnala comportamento non uniforme. Questo non significa che `contenteditable` sia deprecato; lo usano anche motori strutturati. [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Document/execCommand).

## Licenze, pacchetti e funzionamento locale

Tiptap core/Markdown (già verificati), ProseMirror, CodeMirror, Milkdown e Lexical hanno basi MIT. Un bundle locale delle parti usate può funzionare nell’app senza un servizio cloud; questo è un’inferenza dall’architettura delle librerie, non una promessa per ogni add-on. Il peso va misurato sulla configurazione che include le funzioni richieste: non sono stati raccolti benchmark comparabili, e le dimensioni pubblicitarie dei soli core non sarebbero utili.

I vecchi repository GitHub di ProseMirror e CodeMirror sono marcati archiviati perché trasferiti al server dell’autore. I README indicano la nuova posizione; non va confuso con una dichiarazione di fine manutenzione. [ProseMirror view](https://github.com/ProseMirror/prosemirror-view), [CodeMirror view](https://github.com/codemirror/view). La licenza MIT è dichiarata negli stessi repository.

## Scelta consigliata e criterio di accettazione

**Prototipare prima Tiptap e confrontarlo con Milkdown core sugli stessi campioni, mantenendo la UI di ZAINO.** Valutare CM6 come strada diversa solo se la priorità del sorgente intatto prevale sull’esperienza da word processor; ProseMirror diretto serve quando c’è un ostacolo concreto nelle astrazioni superiori.

Il prototipo utile non è una demo di grassetto: deve contenere callout adiacenti, citazioni con origine, evidenze dinamiche, immagini ALBUM, righe vuote, liste e incolla, due appunti, cambio file con Undo, autosave tardivo e salvataggio fallito. Aprire e richiudere senza modifiche non deve riscrivere il file. Il testo formattato va confrontato prima/dopo e i riferimenti devono ancora aprire le fonti corrette.

Per l’export Word conviene stabilire un modello semantico dei contenuti e degli stili condivisibile con l’esportatore; non occorre aspettare il cambio editor per esportare gli appunti attuali. Il modello in memoria non implica da solo cambiare il formato `.md` del vault. La scelta di aggiungere formattazioni che Markdown non rappresenta (esempio dimensioni diverse per singole parole) richiederebbe una decisione esplicita sul formato persistente; non si deve promettere che il Markdown standard mantenga ogni proprietà ricca.

## Limiti della valutazione

La fonte persistente resta il Markdown del vault con le preferenze già esistenti. Se in seguito si introducono nuove formattazioni per singole parole che il formato attuale non memorizza, vanno definite anche sul disco: HTML incorporato con parser aggiornato, metadati associati o un formato più ricco sono decisioni diverse, con costi di compatibilità. Un JSON Tiptap in memoria non risolve da solo la persistenza; sostituire il Markdown come archivio primario cambierebbe un invariante del progetto e non è necessario per ottenere la scrittura continua richiesta.

Solo Tiptap ha una prova locale già eseguita, limitata a API/JSDOM e campioni sintetici. Nessuna parità completa è dimostrata per alcun candidato; non sono stati misurati velocità, bundle, accessibilità o comportamento IME nella configurazione ZAINO. I giudizi di aderenza e sforzo sono inferenze motivate dal codice e dalle fonti sopra, non risultati di test comparativi.
