# Da Braynr a StudIA — appunti, mappe, flashcard

> Studio comparato dell'8 agosto 2026, dai due video ufficiali Braynr («Tutorial completo», 62 min,
> stato dichiarato 23 marzo 2026; «Schemi e mappe», 1 min). Il criterio di tutto il documento:
> **non clonare Braynr, ma innestare le sue tre idee migliori su ciò che StudIA ha già** — la
> grammatica dei rimandi, il dock, gli appunti su disco, i quiz strutturati, le schede dei materiali.
> Dove Braynr e StudIA divergono per filosofia, vince la filosofia di StudIA (il disco è la verità,
> i capitoli sono rigenerabili, i contenuti dell'utente non si mescolano mai a quelli generati).

## 0. Il principio di Braynr che vale più di ogni singola funzione

Braynr ha un solo pattern architetturale, ripetuto ovunque: il **recupero del contesto**. Ogni
artefatto — keyword, nodo di mappa, domanda, flashcard, risposta della chat — porta con sé un
puntatore bidirezionale al punto esatto della fonte (pagina del PDF, minuto dell'audio, porzione di
video). Hover = anteprima; click = torni lì.

StudIA questo pattern **ce l'ha già, ed è più ricco**: la grammatica `[2:12](video:05#t=132)`,
`[p. 7](pdf:03#p=7)`, `[[02-comorbidita]]`, la futura `![didascalia](fig:03#p=7&i=2)`, il dock che
apre PDF alla pagina e video al minuto, gli appunti con `anchor` che rimontano i marker nel
capitolo. **La conseguenza operativa**: ogni proposta qui sotto deve solo *riusare* questa
grammatica, mai inventarne una seconda. Un nodo di mappa che cita una fonte è un link `video:`/`pdf:`
come tutti gli altri; il click lo gestisce `openPdf`/`openVideo` già scritti (stessa scelta già
concordata per le figure Chandra: zero codice nuovo per il click).

## 0-bis. Vocabolario Braynr → StudIA

| Braynr | StudIA (esistente o proposto) |
|---|---|
| fonte (PDF/audio/video/YouTube) | materiale in `MATERIALI/` (ingest, trascrizione, indici) |
| keyword (doppio click sul testo) | **da costruire**: evidenza (P1.1) |
| nota / domanda ancorata al testo | appunto in `APPUNTI/` con `anchor` (esiste) + callout `domanda` (P3.2) |
| tag su note e domande | **da costruire**: `tags` nel frontmatter degli appunti (P1.2) |
| contenuti generati (barra laterale) | il capitolo stesso (quiz, glossario, punti chiave) + `_indice.md` degli appunti |
| schema (mentale/concettuale/lineare) | **da costruire**: `MAPPE/` (P2) |
| mazzo di flashcard filtrato per tag | **da costruire**: mazzo-query in `RIPASSO/` (P3) |
| stati delle carte + notifica in home | oggi `state.learn` **volatile**; diventa derivato dal ripasso (P3.1) |
| Braynr Card (pacchetto condivisibile) | `course:export` / `lib/pacchetto.js` (esiste; fuori scope qui) |
| chat con la fonte | fuori scope; il motore (`lib/ai/provider`) c'è già quando servirà |

## 0-ter. Che cosa NON portare, e perché

- **Il tracciamento fragile dei file locali** (file spostato = fonte rotta, «cerca il file»). StudIA
  ha già risolto meglio: i materiali vivono *dentro* il corso, l'app li possiede.
- **Il tag «AI» sui contenuti generati.** In Braynr distingue ciò che ha scritto il tutor da ciò che
  hai scritto tu *nello stesso spazio*. In StudIA la distinzione è architetturale: tutto ciò che sta
  in `LEZIONI/` è generato, tutto ciò che sta in `APPUNTI/` (e domani `MAPPE/`, `RIPASSO/`) è
  dell'utente. Non serve etichettare ciò che le cartelle già dicono. L'unica eccezione è dentro le
  mappe (nodo-dal-testo vs nodo-tuo): lì la distinzione va fatta, ed è cromatica come in Braynr (P2.3).
- **La chat con la fonte e il tutor on-demand** — non perché sbagliati, ma perché fuori dalle tre
  aree chieste. Nota a margine: quando si vorrà, «genera esempi/semplificazioni da selezione» è una
  chiamata a `provider.completa()` con schema, il pattern c'è già in cinque moduli.

---

# AREA 1 — Gestione appunti

### Che cosa fa Braynr che StudIA non fa ancora

1. **Keyword col doppio click**: ogni parola è attiva; doppio click = evidenziata e raccolta nella
   barra, mappata a capitolo/paragrafo, hover = frase d'origine, «vai a» = torni al punto.
2. **Tag** su note e domande, con filtri e ricerca (e i tag alimentano i mazzi di flashcard).
3. **Raccolta immagini e formule** per selezione d'area, con titolo/descrizione e link al punto.
4. **Marker trascinabili**: il simbolo della nota sul testo si può riposizionare.

### Che cosa ha già StudIA su cui costruire

- `lib/appunti.js`: file `.md` indipendenti, frontmatter con `lezioneId/capitoloId/capitoloFile/anchor`,
  scrittura atomica, `_indice.md` rigenerato a ogni salvataggio.
- Nel lettore: EasyMDE nel dock (anteprima sopra, editor sotto, split ridimensionabile), callout
  in stile Obsidian (7 tipi), emoji OpenMoji, 🔖 (⌘⇧C) che cita il minuto/la pagina correnti, 📎 che
  inserisce il rimando a un materiale scelto da elenco.

  ⚠️ **Corretto il 9 agosto 2026, verificato riga per riga.** Qui c'era scritto che
  `injectNoteMarkers`/`wireNoteMarkers` «rimontano i marker nel capitolo dall'`anchor`». **Non è
  vero, e la frase ha indirizzato male il lavoro sulle evidenze.** Quelle due funzioni sostituiscono
  i token `[[NN]]` **già scritti nell'HTML generato** e li mappano su `chapterNotes(c)`, cioè
  l'elenco dei video e dei PDF del capitolo: una `String.replace` con una regex numerica. Nessuna
  ricerca di testo, nessun `anchor`, nessun caso «frase non trovata». L'`anchor` degli appunti oggi
  non ha alcun marcatore sul testo: serve solo come frammento nell'elenco e in `_indice.md`.
  Conseguenza pratica: per le evidenze (P1.1) **non c'era niente da riusare**, e il motore di
  ancoraggio è stato scritto da zero — `App/assets/evidenze/ancoraggio.js`, selettori
  TextQuoteSelector, puro e provato in Node.

### Proposte

**P1.1 — Evidenze (le keyword di Braynr), il pezzo mancante più visibile.**
Doppio click su una parola (o selezione + voce «Evidenzia» nel menu che già compare per
«Salva come appunto») → la parola entra in `APPUNTI/_evidenze.md`: una riga per evidenza, con
`lezioneId`, `capitoloId`, il testo e l'`anchor` (la frase attorno). Il lettore le rimonta come fa già
coi marker degli appunti — `injectNoteMarkers` è generalizzabile: oggi inietta 📝, domani anche
l'evidenziazione gialla. Doppio click su una parola già evidenziata la toglie (idempotenza alla
Braynr). Hover = frase d'origine (il dato c'è già: è l'`anchor`); click sulla voce in elenco = si
naviga al capitolo e si scrolla al marker (riuso di `openNote`/`go`).
*Perché un file unico e non un file per evidenza*: un'evidenza è una riga, non un documento; il
pattern «un file per appunto» serve all'editor, qui appesantirebbe. Il file resta `.md` leggibile
in Obsidian (elenco puntato raggruppato per capitolo), col frontmatter che lo dichiara generato.
⚠️ Trappola nota: la scrittura resta atomica e passa da `appunti.writeAtomic`, non da una seconda
implementazione (trappola ④ dell'HANDOFF).

**P1.2 — Tag negli appunti.**
Aggiungere `tags` alle `CHIAVI` del frontmatter (`lib/appunti.js` le enumera: è un punto solo).
Nell'editor: campo tag sotto il titolo (chip, come i filtri già disegnati altrove nell'app).
Nell'`_indice.md`: oggi raggruppa lezione → capitolo; aggiungere in coda una sezione «Per tag».
Nella lista appunti del dock: filtro per tag. **Il motivo vero non è la ricerca**: è che i tag sono
la leva dei mazzi viventi (P3.4) — «mazzo di tutte le domande taggate `esame`» — esattamente il
ruolo che hanno in Braynr.

**P1.3 — Il callout `domanda`, ottavo tipo.**
Braynr distingue note e domande perché *le domande diventano flashcard*. StudIA ha già 7 callout
(`nota`, `importante`, `definizione`, `esempio`, `dubbio`, `attenzione`, `dafare`); si aggiunge
`domanda`: titolo = la domanda, corpo = la risposta. `renderNoteMd` lo rende come gli altri; il
parser dei mazzi (P3.4) lo raccoglie. Costo minimo (una voce in `CALLOUTS` + lo stile), valore
alto: è il ponte appunti → flashcard, e la sintassi resta leggibile in Obsidian.
*Nota sul `dubbio` esistente*: resta ciò che è — una perplessità da chiarire. La `domanda` è
un'auto-interrogazione con risposta nota. Distinzione utile proprio per i mazzi: i dubbi non si
ripassano, si risolvono.

**P1.4 — Ritagli d'immagine dagli originali (dopo Chandra, non prima).**
La «raccolta immagini» di Braynr in StudIA ha un binario già tracciato: le figure ritagliate da
Chandra (`MATERIALI/Figure/`, `![didascalia](fig:03#p=7&i=2)`). Quando la sintassi `fig:` entrerà
in `_mdInline` (lavoro §9 dell'HANDOFF), gli appunti la erediteranno gratis — un appunto potrà
citare una figura e vederla. La selezione d'area *manuale* sul PDF nel dock è la coda di questo
lavoro, non un lavoro a sé: stesso formato di ritaglio, stessa cartella, stessa sintassi.
**Ordine giusto: chiudere il §9 prima.**

---

# AREA 2 — Mappe (mentali, concettuali, lineari)

StudIA qui parte da zero come interfaccia, ma **non come dati**: è l'area dove l'esistente aiuta di
più ed è invisibile.

### Che cosa insegna Braynr (dal video dedicato + tutorial)

1. **Tre stili, un click**: mappa mentale (4 direzioni), schema lineare (sinistra → destra),
   mappa concettuale (alto → basso). Stesso grafo, layout diverso.
2. **Il colore dice l'origine**: nodo trascinato dal testo = colore keyword; nodo scritto ex novo =
   grigio. Si vede a colpo d'occhio quanto della mappa è *tuo*.
3. **Ogni nodo dal testo resta mappato alla fonte** — anche al minuto del video da cui la parola
   viene. Hover = contesto; «vedi nel testo» = split view al punto esatto.
4. Rami che si chiudono/aprono (ripasso, mappe grandi), gruppi, colore propagato ai subordinati,
   Ctrl+Z, drag di immagini/note/domande dentro la mappa.
5. La mappa nasce *da un punto del testo* e si lavora in split view testo|mappa.

### Che cosa ha già StudIA su cui costruire

- **La struttura dei capitoli è già un albero**: titoli `##/###`, punti chiave, glossario. Una bozza
  di mappa per capitolo si estrae **senza modello e senza costo**.
- **Le schede dei materiali** (`_lavorazione/schede/NN.json`) hanno `temi` in sequenza *con i
  riferimenti esatti* (`[m:ss]` per i video, `[p. N]` per i PDF), `concetti`, `collegamenti`. Una
  mappa concettuale di un PDF ingerito è a una chiamata di modello da qui — e nasce **già mappata
  alle pagine**, il punto 3 di Braynr gratis.
- **Il dock è lo split view**: click su un nodo con rimando → `openPdf`/`openVideo` aprono la fonte
  affiancata. Braynr ha dovuto costruire lo split testo|mappa; StudIA ce l'ha come sottoprodotto.
- Il piano delle lezioni (aree → lezioni → capitoli) per la mappa d'insieme del corso.
- `lib/` con pattern consolidati: logica pura testabile, schema JSON + `validate`, `entroSchema`
  per le risposte del modello.

### Proposte

**P2.1 — Formato su disco: JSON Canvas in `MAPPE/`.**
`Corsi/<id>/MAPPE/<slug>.canvas` nel formato **JSON Canvas** (la spec aperta di Obsidian,
MIT): il vault è già dichiarato apribile in Obsidian nel README, e una mappa `.canvas` vi si apre
*oggi*, senza che StudIA esista. Nodi `text` col markdown di StudIA dentro (quindi i rimandi
`video:`/`pdf:` funzionano con la grammatica di casa), `edges` per gli archi, `group` per i gruppi
di Braynr. Campi extra ammessi dalla spec per ciò che serve a StudIA:
`origine: 'fonte'|'utente'|'generata'` sul nodo (il punto 2 di Braynr), `rimando` col link
canonico, `collapsed` sul nodo per i rami chiusi.
La cartella è dell'utente come `APPUNTI/`: **la pipeline non la tocca mai**, una rigenerazione dei
capitoli non perde una mappa (stessa regola che protegge gli appunti, e che vale anche su TD74-DSA
protetto).

**P2.2 — `lib/mappa.js`: il grafo è puro, il layout è una funzione.**
I tre stili di Braynr sono tre funzioni di layout sullo stesso grafo: radiale (mentale),
outline orizzontale (lineare), gerarchico verticale (concettuale). Logica pura in `lib/mappa.js`
— layout, collapse, propagazione colore ai subordinati — testata senza DOM, come `pianoedit.js`.
Il renderer è SVG vanilla nel lettore (coerente con l'app: nessuna dipendenza nuova; EasyMDE è
l'unica libreria UI e ha una pagina di crediti che la dichiara). Interazioni v1: pan/zoom
(Ctrl+/− come nel resto dell'app), drag nodo, doppio click per editare, +/− sui rami, undo con
uno stack di stati (il Ctrl+Z di Braynr; il file si salva atomico a ogni mutazione, pattern
`writeAtomic`).

**P2.3 — Da dove nascono le mappe (i tre rubinetti).**

| sorgente | come | costo |
|---|---|---|
| **capitolo generato** | «Crea mappa da questo capitolo»: titoli + punti chiave → albero; ogni nodo eredita i rimandi che il paragrafo cita (`rimandiDa` già estrae i puntatori dal testo) | zero (deterministico) |
| **PDF/video ingerito** | «Proponi mappa concettuale del materiale NN»: il modello riceve la *scheda* (temi + riferimenti), risponde su `mappa.schema.json`, `entroSchema` ripara; ogni nodo arriva con `[p. N]`/`[m:ss]` → `rimando` | 1 chiamata per materiale |
| **mano libera** | mappa vuota, nodi `origine:'utente'` | zero |

Il primo rubinetto copre «dai testi dei capitoli generati da StudIA», il secondo «dai PDF
ingeriti» — e il secondo funziona anche per materiali che non sono entrati in nessuna lezione,
perché le schede si pagano una volta per *materiale*, non per lezione.
⚠️ Trappola ①-bis: se lo schema della mappa prevede `rimando`, qualcuno deve riempirlo — la regola
va scritta nello schema mandato al modello *e* l'estrazione deterministica deve fare da rete,
come per `videoRefs`/`sources`.

**P2.4 — Drag dal testo (il gesto-firma di Braynr), in due tempi.**
V1 senza drag: selezione nel capitolo → il menu che già offre «Salva come appunto» offre anche
«Aggiungi alla mappa aperta» — il testo entra come nodo `origine:'fonte'` con `anchor`, appeso al
nodo selezionato o flottante. V2, se il gesto manca davvero: drag vero dalla selezione al canvas.
Il valore sta nel *legame automatico alla fonte*, non nella fisica del trascinamento: V1 lo dà
tutto. Stesso discorso per evidenze (P1.1) e figure (P1.4): voci del loro menu, non drag.

**P2.5 — Sinergia coi percorsi: la mappa come capitolo zero.**
🦅 *Panoramica* «vuole la mappa d'insieme prima di entrare nel dettaglio»: oggi è una preferenza
di scaletta, domani può essere letterale — la mappa della lezione (rubinetto 1 applicato all'intera
lezione) mostrata in testa al percorso. Nessun lavoro nuovo oltre P2.1–P2.3: è un uso, non una
funzione. Da non fare subito; da tenere nel disegno perché motiva il formato condiviso.

---

# AREA 3 — Flashcard: mazzi viventi auto-aggiornati

È l'area col rapporto valore/sforzo migliore, perché **le carte esistono già**: ogni capitolo ha
1–3 quiz strutturati (`q` = affermazione, `a` = vero/falso, `perche`), un glossario (`t`/`d` =
fronte/retro naturale), e il profilo governa già la loro quantità. Manca tutto il *dopo*: oggi il
punteggio del quiz produce uno stato per capitolo (`appreso`/`ripassare`/`studiare`, soglie 81/61)
che però vive in `state.learn` **in memoria, azzerato a ogni apertura della lezione**. Il lavoro
sull'apprendimento si perde ogni sera.

### Che cosa insegna Braynr

1. **Il mazzo è una query, non una copia**: «tutte le domande di questa fonte» o «solo quelle col
   tag X». Nuova domanda che soddisfa il filtro → entra da sola nel mazzo. *Vivente* vuol dire questo.
2. **Spaced repetition con tempi dinamici** (1 min / 5 min / … / 13 giorni) e **stati visibili in
   home**: mai studiate / studiate / da ripassare, con notifica quando un ripasso scade.
3. **Ogni carta recupera il contesto**: «vedi testo» apre la porzione d'origine affiancata;
   «vedi mappa» salta al nodo dove la domanda era stata trascinata.
4. Carte editabili al volo; panoramica del mazzo per ripassare fuori scheduling senza alterare i tempi.

### Proposte

**P3.1 — Prima pietra: lo stato di ripasso vive su disco.** ✅ **FATTO l'11 agosto 2026**
(`lib/ripasso.js`, `test/ripasso.js`, `test/cdp/prova-ripasso.js`). Com'è andata in pratica:
l'identità della carta è `hash(capitolo + domanda normalizzata)` e si calcola **nel main**, perché
il renderer non ha `crypto` e due formule per la stessa identità divergono al primo ritocco;
`state.learn` è diventato la vista di `RIPASSO/stato.json`; le carte sparite si potano dicendolo;
«azzera avanzamento» adesso chiede conferma, perché è diventato un gesto che perde qualcosa.
⚠️ Dal quiz si registrano **due** esiti (giusto → `buono`, sbagliato → `di-nuovo`): i quattro
arrivano con l'interfaccia di P3.3, e inventarne quattro da una domanda a due risposte sarebbe
attribuire all'utente una sfumatura che non ha espresso. Il campo `prossimo` esiste già ed è vuoto.

Il testo originale della proposta, per riferimento:
`Corsi/<id>/RIPASSO/stato.json`: per ogni carta `{ id, visto, esito, prossimo, storia }`.
Scrittura atomica, stessa regola di `APPUNTI/` e `MAPPE/`: cartella dell'utente, la pipeline non
la tocca, funziona sui corsi protetti. `state.learn` smette di essere una sessione e diventa
**derivato**: lo stato del capitolo = aggregato delle sue carte (la segnaletica su TOC e barra di
avanzamento resta identica, cambia solo da dove legge — trappola ③: il disco è la verità, e
finalmente lo è anche per l'apprendimento).
⚠️ **Identità della carta**: `id = hash(capitoloFile + testo normalizzato della domanda)`. Se una
rigenerazione riscrive il quiz, la carta è *nuova* e riparte da zero — corretto, perché la domanda
è cambiata — e lo stato orfano si pulisce **dicendolo** (toast «N carte non esistono più»), lo
stesso patto di `percorsi.invalida()`: si è persa una storia, non lo si nasconde.

**P3.2 — Le tre sorgenti di carte.** ✅ **GLOSSARIO FATTO il 12 agosto 2026** (la terza sorgente,
i callout `domanda`, aspetta P1.3). Com'è andata in pratica:

- Il glossario entra in `ripassoDomandeVive()` e **in nessun altro posto**: è il punto unico che
  la vista e la potatura condividono. Zero righe in `lib/`, `main.js`, `preload.js` — l'identità
  della carta è già generica (`hash(capitolo + domanda)`, e per il glossario «domanda» è il
  termine).
- ⚠️ **Il rischio vero di una sorgente nuova non è che le carte non compaiano**: è che entrino
  nella coda ma non nell'elenco dei vivi mandato alla potatura. Al primo avvio del corso la
  potatura non le riconoscerebbe e **cancellerebbe la storia dell'utente in silenzio**, per
  centinaia di carte. Il punto unico lo previene per costruzione; la prova CDP lo misura
  (risponde a una carta di glossario, chiama `ripassoPota()`, verifica che la storia resti).
- **L'identità è il TERMINE, non la definizione**: una rigenerazione che riscrive la definizione
  conserva la storia — come un quiz a cui cambia il «perché» resta la stessa carta.
- ⚠️ **La definizione è HTML, non testo**: il parser l'ha già passata per `_mdInline`, quindi
  porta corsivi e rimandi vivi (`pdf:`, `cap:`) che i gestori delegati fanno funzionare senza una
  riga in più. Escaparla mostrerebbe i tag a schermo.
- La carta prende il vestito del **riquadro Glossario del capitolo** (libro, blu), non quello del
  quiz: si riconosce da dove viene senza leggerla. La definizione non è in grassetto — il
  grassetto dice «ecco la risposta» quando la risposta è una parola, non quando è una frase.
- Misurato su ai-literacy: **93 carte da quiz, 114 da glossario**. Il glossario più che raddoppia
  il mazzo, senza generare un contenuto nuovo.

Il testo originale della proposta, per riferimento:

| sorgente | fronte | retro | esiste già? |
|---|---|---|---|
| quiz del capitolo | l'affermazione, «vero o falso?» | risposta + `perche` | sì, 258 capitoli |
| glossario del capitolo | il termine `t` | la definizione `d` | sì |
| callout `domanda` negli appunti | il titolo del callout | il corpo | con P1.3 |

La terza sorgente è il ciclo di Braynr (le *tue* domande diventano carte) ed è ciò che rende i
mazzi personali e non solo generati. Le prime due rendono il sistema utile dal primo giorno,
senza che l'utente abbia scritto nulla.

**P3.3 — Ripasso: quattro esiti, intervalli SM-2.** ✅ **FATTO il 12 agosto 2026**
(`App/assets/ripasso/intervalli.js`, la vista nel renderer, `test/ripasso.js`,
`test/cdp/prova-ripasso-vista.js`). Com'è andata in pratica:

- ⚠️ **L'algoritmo non sta in `lib/`, sta in un modulo UMD**: i tempi servono in due posti — il
  main che scrive `prossimo` su disco, il renderer che li stampa sopra i bottoni — e due copie
  vorrebbero dire un bottone che promette dieci minuti e un file che ne registra quindici, senza
  che nessuno se ne accorga perché nessuno confronta. `lib/ripasso.js` lo `require()`, l'app lo
  carica con `<script src>`, è lo **stesso file**. La prova CDP misura proprio quell'uguaglianza.
- ⚠️ **Facilità e ripetizioni non si scrivono**: si ricalcolano ogni volta dalla `storia`, che è
  l'unico dato vero. Un contatore salvato accanto sarebbe un secondo posto che diverge — e
  cambiando la formula domani si ricalcola anche il passato invece di lasciare metà archivio
  coi numeri vecchi.
- **`registra()` riempie `prossimo` da sé**: non è più a carico di chi chiama. Un campo che ogni
  chiamante deve ricordarsi di riempire è un campo che prima o poi resta vuoto.
- **La coda**: prima gli arretrati (il più scaduto davanti), poi le mai viste. Chi ha trecento
  carte in ritardo deve poterle smaltire; le voci senza `prossimo` — scritte prima di oggi —
  contano come arretrato, non come futuro.
- La vista è uno **strumento del banco** (chiave `flashcard`, nome «Ripasso»), non una schermata:
  si ripassa col capitolo accanto. I comandi stanno in un piede fisso fuori dalla parte che
  scorre — dentro, una domanda lunga li spingeva sotto la piega.
- ⚠️ Trovato per strada: `lib/ripasso.js` conteneva un **byte NUL letterale** come separatore
  dell'identità (`join('\0')` scritto per davvero), che per git rendeva il file binario — niente
  `diff`, niente `blame`. Stesso male di `lib/evidenze.js` l'11 agosto: **quando si trova, si
  cerca subito anche altrove.** Sostituito con la sequenza di escape, id invariati (verificati).
- Sorgente delle carte: **il quiz**. Glossario (P3.2) e callout `domanda` (P1.3) entrano in
  `ripassoDomandeVive()`, che è l'unico punto da toccare.

Il testo originale della proposta, per riferimento:
Di nuovo / Difficile / Buono / Facile → SM-2 semplificato (una pura funzione
`prossimoIntervallo(storia, esito)` in `lib/ripasso.js`, testata coi casi limite; l'algoritmo è
documentato e bastano poche decine di righe — la sofisticazione di FSRS non ripaga la complessità
qui). L'interfaccia di ripasso è una vista del lettore: fronte, «mostra risposta», i quattro
bottoni coi tempi previsti scritti sopra (come Braynr mostra «1 min / 10 min / 13 giorni»), e i
due bottoni di contesto di P3.5. Carte editabili? **No, e di proposito**: le carte da quiz e
glossario sono viste sul capitolo (modificarle creerebbe la seconda copia che diverge — trappola
④); le carte da appunti si modificano *nell'appunto*, che è già un editor.

**P3.4 — Il mazzo è un file di filtri.**
`Corsi/<id>/RIPASSO/mazzi.json`:

```json
{ "mazzi": [
  { "id": "esame-1", "nome": "Ripasso esame · dislessia",
    "lezioni": ["04-06-dislessia", "07-08-dislessia-lingue"],
    "sorgenti": ["quiz", "glossario", "appunti"],
    "tag": ["importante"] }
] }
```

Risolto **all'apertura, contro il disco**: capitolo rigenerato con un quiz in più → la carta
compare; appunto nuovo col tag giusto → la carta compare. L'auto-aggiornamento di Braynr non è
una feature da costruire: è la *conseguenza* di non copiare mai le carte. Un mazzo senza filtri
(`lezioni` vuoto = tutto il corso) è il mazzo dell'intero corso alla Braynr; i `tag` (P1.2 sugli appunti,
`tags` già nello schema del capitolo) sono i mazzi filtrati.
⚠️ Con le **varianti**, le carte si risolvono sui capitoli della variante attiva (`lezioniVisibili()`
già decide quali cartelle si leggono): due percorsi che condividono un indice condividono le
carte — coerente con la regola «i capitoli si condividono».

**P3.5 — Recupero del contesto dalla carta.**
«Vedi capitolo» → `go(indice)` sul capitolo d'origine (l'id della carta lo contiene) e scroll al
blocco quiz/glossario. «Vedi fonte» → il capitolo ha `videoRefs`/`sources`: si apre nel dock il
primo rimando del capitolo (v1 onesta; v2: il rimando più vicino al paragrafo da cui il quiz
nasce, quando `rimandiDa` saprà legare quiz e paragrafo). «Vedi mappa» alla Braynr arriva gratis
*se* P2 esiste e un nodo cita la stessa domanda — non è un requisito, è un incontro.

**P3.6 — La home dice quando ripassare.**
Conteggi per corso: mai studiate / in attesa / **da ripassare oggi** — il badge d'avanzamento
per corso è già in coda all'HANDOFF (§6.5): questa è una colonna in più di quel lavoro, non un
lavoro a sé. 🐘 *Ripassatore* smette di essere solo una preferenza di scaletta: è il percorso che
il sistema di ripasso serve meglio.

---

# Ordine dei lavori proposto

Il criterio: prima ciò che si appoggia su più esistente e produce valore da solo; le dipendenze
vere sono poche.

| # | lavoro | dipende da | taglia | note |
|---|---|---|---|---|
| 1 | ~~P3.1~~ ✅ ~~P3.3~~ ✅ ~~P3.2 glossario~~ ✅ + **P3.6** — ripasso persistente sui contenuti già generati | — | M | il valore c'è dal giorno uno, su 243 capitoli |
| 2 | **P1.2 tag + P1.3 callout `domanda`** | — | S | sblocca la terza sorgente di carte |
| 3 | **P3.4 mazzi-query** (+ appunti come sorgente) | 1, 2 | S/M | i «mazzi viventi» veri e propri |
| 4 | **P1.1 evidenze** | — | M | indipendente; riusa i marker |
| 5 | **P2.1 + P2.2 + P2.3 rubinetto 1** — mappe da capitolo, viewer/editor | — | L | la parte grossa è l'editor SVG |
| 6 | **P2.3 rubinetto 2** — mappe proposte dai materiali (schede) | 5 | M | 1 chiamata/materiale, schema + `entroSchema` |
| 7 | **P2.4 selezione→nodo, P3.5 «vedi mappa», P2.5 capitolo zero** | 5 | S ciascuno | le rifiniture che chiudono il cerchio |
| — | P1.4 ritagli manuali | §9 Chandra chiuso | S | coda del lavoro figure, non prima |

Tre avvertenze trasversali, dalle trappole già pagate:

1. **Niente seconda copia di una logica** (④). ⚠️ **Aggiornata il 12 agosto**: il rimedio non è più
   «due implementazioni e un test che le confronta», è **un file solo**. Una regola pura che serve
   di qua e di là nasce come modulo **UMD** in `App/assets/…` — `<script src>` nel browser,
   `require()` in Node — e `lib/` lo richiama. Così ha fatto `ripasso/intervalli.js`, ed è la
   strada per chiunque venga dopo. Il confronto fra due copie resta solo dove una copia è
   inevitabile perché tocca `crypto` o `fs` (l'identità delle carte sta nel main, e basta).
2. **Ogni campo previsto ha un riempitore dichiarato** (①-bis): `rimando` nei nodi di mappa,
   `tags` negli appunti, `prossimo` nello stato di ripasso — per ciascuno, scrivere *chi* lo
   popola, e se la risposta è «il modello, se se ne ricorda», ricavarlo deterministicamente.
3. **Le cartelle nuove (`MAPPE/`, `RIPASSO/`) entrano in `lib/pacchetto.js`** dal primo giorno:
   un'esportazione che perde le mappe o la storia dei ripassi è il tipo di silenzio che in questo
   lavoro è già costato caro.
