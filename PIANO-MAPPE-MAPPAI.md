# Da MappAI a StudIA — il motore delle mappe e la Vista Studio

> **v2, 8 agosto 2026.** La prima stesura aveva indagato la cartella sbagliata: `~/Claude/MappAI`
> è uno snapshot di giugno (app.js monolitico da 16k righe, niente Vista Studio). La versione
> corrente è **`~/Claude/MappAI re`**: app.js ridotto a 3k righe, 116 moduli `mappai-*.js`, e
> soprattutto la **Vista Studio** — sette motori di layout strutturato (DAG, Albero, Anelli,
> Colonne, Percorso, Fasci, Matrice), il **Focus** (nodi+vicini / nodi+parentela ridisegnati a
> tutta area), i **fogli nodi editabili**, l'export PDF vettoriale con le trappole già risolte, e
> il **tutor AI a sei modalità**. Tutti i riferimenti `file:riga` qui sotto puntano a
> `MappAI re/public/js/`.
>
> Questo documento raffina l'AREA 2 di [PIANO-BRAYNR.md](PIANO-BRAYNR.md) (P2.1–P2.5) e vi
> aggiunge il tutor (che tocca P3 e il futuro). Regola invariata: si portano le **logiche** in
> `lib/` pure e testate, non il codice; nei conflitti di filosofia vince StudIA.

## 0. Le due anime di MappAI, e quale interessa a StudIA

MappAI ha **due modi di disegnare la stessa mappa**:

1. **Il canvas D3** (`mappai-d3-render.js`, force simulation + pre-posizionamento settoriale
   radiale `placeMMChildren`, `d3-render.js:279`) — la vista «organica» per esplorare;
2. **La Vista Studio** (`mappai-studio-layouts.js` + `studio-draw.js` + `studio-view.js`) —
   un overlay **a card** sopra il canvas: layout strutturati, deterministici, misurati, pensati
   per *studiare* e *stampare*. Il force layout resta intatto sotto; uscendo si ritrova.

Per StudIA la seconda è quella giusta, e non è un'opinione: i motori della Vista Studio sono
**moduli puri, UMD, zero DOM, dichiaratamente «girano in Node e nel browser»** — cioè già nella
forma che StudIA impone a `lib/` (testabile con `node --test`, renderer sottile sopra). La v1 di
questo documento raccomandava «niente D3, layout deterministici»: MappAI ci è arrivata da sola,
e ha già scritto i motori.

### Vocabolario MappAI → StudIA

| MappAI («re») | StudIA (esistente o pianificato) |
|---|---|
| nodo `{level 0–5, group, label, desc, content}` · link `{rel, isCross, bidirectional}` | nodo/arco JSON Canvas + campi extra (P2.1, §1) |
| Vista Studio (overlay a card, 7 motori) | il renderer delle mappe di StudIA (§2) |
| Focus «vicini» / «parentela» | il focus nodi+vicini / nodi+parenti richiesto (§3) |
| `studioProfile` (+ `.focus`) salvato insieme alla mappa | profilo di vista dentro il `.canvas` (§2.4) |
| foglio nodi editabile (`nodesheet-core`) | export cartellini per mappe fisiche (§6) |
| `exportPdfFromSvg` (A4 vettoriale) | l'export PDF delle mappe (§7) |
| tutor AI a 6 modalità + `tutor-core` puro | tutor per capitolo/nodo su `provider` (§8) |
| mastery EWMA + «Cosa studiare ora» | ripasso P3 + percorsi (§8.3) |
| EDGE_FAMILIES (`mappai-relations.js`) | le famiglie di relazione della mappa concettuale (§4) |

---

# 1. Il modello dati (invariato dalla v1, confermato nella versione «re»)

Campi da adottare come proprietà extra dei nodi/archi JSON Canvas: `level` (ricalcolato, mai
creduto — §5), `group` (macro-area → colore, propagato), `rel` sull'arco (il verbo, §4),
`isCross`, `bidirectional`, `pinned`/posizioni. Non si adottano: `studyStatus` dichiarato a mano
(in StudIA lo stato viene dal ripasso P3.1), `chunks[]` (StudIA ha i rimandi `video:NN#t` /
`pdf:NN#p`, più precisi). Utility di attraversamento da portare con i loro guard anti-ciclo:
`getParentGroup`, `getDescendants`.

---

# 2. La Vista Studio: sette motori puri, tre stadi, una misura

## 2.1 L'architettura (`mappai-studio-layouts.js`, 1.565 righe — il modulo da studiare)

Testata del file, che è già il manifesto giusto:

- **tre stadi separati**, «così ogni opzione è una leva vera»:
  1) POSIZIONAMENTO → dove stanno i nodi; 2) INSTRADAMENTO → che strada fanno gli archi
  (`curva` | `dritto` | `orto`, con **porte d'attacco distinte** sul bordo della card,
  `assignPorts`, `layouts.js:391`); 3) MISURA → sulla geometria *effettivamente disegnata*;
- **coordinate interne astratte** `(al, ac)` — lungo il livello / attraverso i livelli —
  e l'orientamento (dall'alto `td` / da sinistra `lr`) è **una sola trasformazione finale**:
  «nessun ramo di codice duplicato per i due versi»;
- «Nessun DOM, nessuna dipendenza dall'app. Gira in Node e nel browser.»

Per StudIA questo file si porta quasi di peso in `lib/mappa/layouts.js`: è già puro, già
parametrico (card `w×h`, `gapNode`, `gapLayer`, routing, ports), già multi-motore con un
dispatcher unico (`run(nodes, links, d3, opt)`, `layouts.js:1546` — d3 serve solo al motore TD).

## 2.2 I sette motori (`studio-view.js:214–216`)

| motore | algoritmo | a che domanda risponde |
|---|---|---|
| **DAG** (`layoutDAG`, `:522`) | Sugiyama scritto a mano: componenti, **cicli rotti prima**, livelli per cammino più lungo (`depths`, `:40`), nodi-fantasma per gli archi che saltano livelli, porte, packing dei componenti | «che cosa dipende da cosa» — il default |
| **Albero** (`layoutTD`, `:667`) | Reingold-Tilford (`d3.tree`, unico uso di D3) | la gerarchia pura |
| **Anelli** (`layoutAnelli`, `:1255`) | BFS dal centro (nodo scelto / ROOT / più connesso); anello = distanza; angolo = baricentro dei vicini dell'anello interno («i figli restano sotto il genitore»); scollegati sull'anello esterno | «cosa sta a un passo, a due passi da qui» — col context-menu **«Anelli da qui»** su qualunque nodo |
| **Colonne** (`layoutColonne`, `:1316`) | icicle adattato alle card: ogni ramo L1 una colonna, «il contenimento lo dicono le bande, non gli archi» | confronto fra rami |
| **Percorso** (`layoutPercorso`, `:1379`) | **ordine topologico di Kahn** (prerequisiti prima; a parità resta nel gruppo corrente «così i rami escono contigui»), disposto **a serpentina con il numero del passo**; il filo del percorso è il contenuto, gli archi veri restano **in filigrana** (`extraEdges`) | «la mappa che diventa scaletta di studio» |
| **Fasci** (`layoutFasci`, `:1432`) | edge bundling gerarchico, «Holten semplificato» (beta 0.85) | dove si addensano le relazioni |
| **Matrice** (`layoutMatrice`, `:1529`) | matrice di adiacenza («zero incroci per costruzione») | mappe dense illeggibili a node-link |

Per StudIA v1 bastano **quattro**: Albero e DAG (le «mappe concettuali» top-down / a livelli),
**Percorso** (per il pubblico DSA è la killer feature: trasforma la mappa in una sequenza di
studio numerata — ed è l'anima del personaggio 🐢 Sequenziale), **Anelli** (è il layout
naturale della mappa mentale di Braynr, col centro spostabile). Colonne/Fasci/Matrice in v2.

## 2.3 La misura della qualità (`measure`, `:1154`) — il pezzo culturalmente più affine

Ogni layout viene **misurato sulla geometria disegnata**: `incroci` (intersezioni fra segmenti
di archi), `cardSovrapposte`, `archiSuCard` (archi che passano sopra card altrui),
`areeAccavallate`, `arcoMedio`, `inchiostro`, dimensioni/rapporto; il renderer aggiunge le
**etichette accavallate** (`labelConflitti`). Le metriche sono mostrate in tempo reale nel
pannello mentre si regolano le leve (`studio-view.js`, `#sv-metrics`).

È il principio della skill `/mockup-layout` applicato dentro l'app: **un layout non si giudica a
occhio, si misura**. In StudIA: stessa funzione in `lib/mappa/misura.js`, usata (a) nel pannello
della vista, (b) **nei test** — «il layout della lezione demo non supera N incroci» è un test di
regressione che nessun ritocco estetico può rompere in silenzio.

## 2.4 Preset con nomi parlanti e profilo persistito (`studio-view.js:33–41`)

Sei preset che regolano **solo geometria, motore e instradamento** («il resto resta come l'utente
l'ha messo»): *Nastro classico, Compatto, Colonna (da sx), **Arioso da LIM**, **Leggibile
BES/DSA** (lr, ortogonale, card 210×60, corridoi 110), Albero puro*. Il profilo attivo
(`studioProfile`) viaggia con la mappa in autosave.
Per StudIA: i preset sono la traduzione visiva delle **leve del profilo di apprendimento** — il
preset «Leggibile BES/DSA» è ciò che il profilo TD74 chiederebbe. Nel `.canvas` il profilo di
vista si salva come le viste con nome (v1 §6.3), e i preset si dichiarano in `lib/mappa.js`
come dati, non come if.

## 2.5 Il set di archi (`studio-view.js:88–95`)

La vista sceglie **quali archi contare**: per le mappe mentali `Gerarchia + cross` / `Solo
gerarchia`; per i KG anche `Solo relazioni` / `+ comunità`. Leva fondamentale per il Percorso e
il DAG: i cross-link cambiano l'ordine topologico. In StudIA: filtro `{gerarchia, cross}` passato
a `run()` — due checkbox, grande resa.

---

# 3. Il Focus: nodi+vicini e nodi+parentela (la richiesta esplicita)

`studio-view.js:419–546`. Dal tasto destro su una card: **«Focus: vicini diretti»** o
**«Focus: parentela»** (più «Descrizione» e «Anelli da qui»). Che cosa succede:

1. **Selezione del sottografo** (`openFocus`, `:429`):
   - `vicini` → il nodo + successori e predecessori **a un salto**;
   - `parenti` → il nodo + **tutta la raggiungibilità** all'insù e all'ingiù (`reach` su mappe
     di successori/predecessori): antenati, discendenti, l'intera linea di sangue.
2. **Overlay a tutta area** sopra la vista d'insieme, che «resta sotto intatta: chiudendo il
   focus si ritrova senza ricalcolare nulla». Testata a riga singola (badge FOCUS + nome nodo +
   sottotitolo `vicini diretti · N nodi · M relazioni`) — col commento-lezione: «se la testata
   crescesse si mangerebbe l'altezza del disegno».
3. **Ridisegno con geometria PROPRIA** (`DEF_FOCUS`, `:32`): card più grandi (210×64 contro
   118×54 della vista d'insieme), font maggiore, DAG ortogonale con porte, niente ponticelli
   («pochi nodi, sarebbero solo rumore»), orientamento `auto` = verticale sotto le 15 card,
   orizzontale sopra. Il commento del codice è la specifica: «Il Focus ha una geometria SUA…
   le stesse leve regolano cose diverse nei due contesti» — perciò **profilo separato**,
   persistito in `studioProfile.focus`.
4. Nel pannello restano **solo le leve che non possono aspettare** (orientamento, spaziature,
   corpi); le altre «sono sospese finché il focus è aperto: tornano chiudendolo».
5. **«Esporta PDF del Focus»** dedicato: `Focus-<nodo>-vicini|parentela.pdf` (§7). Lo stesso
   bottone del tab esporta *quello che si sta guardando*: focus aperto → la focus-map, chiuso →
   la vista d'insieme (`exportViewPdf`, `:688`).
6. In vista d'insieme, l'**evidenzia al passaggio** (`hl: no|vicini|parenti`) applica gli stessi
   due insiemi come highlight in hover, senza aprire nulla.

**Per StudIA è il «focus accessibile» già disegnato**: stessa `lib` di layout, due
funzioni di selezione del sottografo (1 salto / raggiungibilità), un overlay nel lettore con
profilo proprio, un export dedicato. Da aggiungere solo il legame di casa: dentro il focus, i
nodi con `rimando` aprono il dock (`openPdf`/`openVideo`) — il «recupero del contesto» di Braynr
dentro il focus di MappAI.

I fuochi del canvas D3 della v1 restano validi come *secondo* registro (dimmed/highlighted sulla
vista organica, pathfinder, ricerca-che-attenua, zoom semantico sulla profondità): sono lo stesso
schema a classi, e in StudIA condividono le due funzioni di selezione con il Focus.

---

# 4. EDGE_FAMILIES — ora modulo autonomo (`mappai-relations.js`, 172 righe)

Invariato dalla v1, ma nella versione «re» è stato **estratto in un modulo dati puro** — conferma
della strada: 8 famiglie semantiche di relazione (trasformazione, dipendenza, sequenza,
appartenenza, regolazione, opposizione, analogia, altro), palette daltonismo-safe, mappa
verbo→famiglia con fallback. Da portare pari pari in `lib/mappa/relazioni.js`; il prompt del
rubinetto 2 (P2.3) impone `rel` a vocabolario di famiglia; la «lente per famiglia» è un fuoco in
più del §3. Nello Studio Attivo la modalità «Verbi delle relazioni» usa le famiglie come
**rubrica di valutazione** (giusto se nella famiglia giusta, non serve il sinonimo esatto).

---

# 5. Igiene del grafo (invariato dalla v1)

`mappai-tree-sanitizer.js` (genitori multipli → uno; L1→L1 rimossi; **`level` ricalcolati via
BFS**; `group` propagato) = il gemello di `entroSchema` per i grafi: `lib/mappa.js →
sanitizza(grafo)` su ogni mappa proposta dal modello, **prima** della scrittura su disco.
`mappai-structure-analyzer.js` (god node, nodo fuori posto >60% link altrove, foglie isolate con
severità per livello, ponti, densità) = pannello suggerimenti, v2, pura e testabile.

---

# 6. I fogli nodi, fatti bene (la parte che la v1 aveva solo sfiorato)

Nella versione «re» il foglio nodi non è più una stampa monolitica: è un **documento editabile**
con un core puro dedicato.

### 6.1 `mappai-nodesheet-core.js` (479 righe, UMD, zero DOM/AI/jsPDF)

Il problema che risolve, dalla testata: prima il foglio era «una SCELTA GLOBALE (tutte le card
con lo stesso contenuto)… una card con le parole chiave e la vicina col solo titolo era
impossibile». Ora: **una card per nodo, ognuna col proprio tipo di contenuto** (solo titolo /
titolo+spazio per scrivere / titolo+parole chiave / titolo+descrizione), il proprio ordine, le
proprie parole chiave — un documento che si rivede e si mescola prima di stampare.

Le tre idee da portare:
1. **La geometria del foglio sta nel core, in un posto solo** — A4 orizzontale, margini 10/15,
   formati `3x4`/`2x2`/`2x1` con corpi in pt per formato: «sono i numeri con cui il PDF disegna
   davvero». Schermo, PDF e vault **non possono divergere** perché leggono la stessa tabella.
2. **Soglie di caratteri ricavate dalla geometria**: col font monospazio (advance em misurato,
   0.612) il core calcola quanti caratteri *entrano davvero* nella card stampata, e l'editor
   mostra un badge ambra quando il testo sborda. Il limite non è una convenzione: è una misura.
3. **Operazioni immutabili sul modello** + sincronizzazione con i nodi della mappa.

### 6.2 `mappai-print-layout.js` (785 righe) — il gemello per le flashcard

Stessa filosofia, ambito dichiarato con un ⚠️ in testata: «solo le flashcard. Il foglio con le
etichette dei nodi è una funzione SEPARATA e INDIPENDENTE… non legge nulla da qui e non deve
farlo». Perché esiste: lo stesso foglio usciva «da due motori diversi (HTML/CSS per la stampa dal
browser, jsPDF per il PDF scaricato)» e i due divergevano di millimetri a ogni ritocco — la
trappola ④ di StudIA, vissuta in un altro programma. Qui c'è UNA definizione (millimetri per la
geometria, pt per i corpi) e i due builder «si limitano a disegnare». Bonus: il modello si può
sovrascrivere senza toccare il codice (`localStorage` / `importModel(json)` / `exportModel()`).

**Per StudIA**: quando arriveranno i cartellini (v1 §7.3) e la stampa dei mazzi (P3), la
geometria di stampa nasce così — un modulo `lib/stampa/foglio.js` puro con le misure, e i
renderer (print CSS e/o jsPDF) che lo leggono. Con l'editor per-card come seconda tappa.

---

# 7. Export PDF vettoriale: le trappole già pagate (`studio-view.js:618–686`)

`exportPdfFromSvg` è il riferimento da copiare, insieme alla scelta del renderer che lo rende
possibile — testata di `studio-draw.js`: «Tutta la resa è ad **ATTRIBUTI SVG, mai classi CSS**:
così il clone per l'export PDF è fedele senza dover ricopiare fogli di stile». Anche le punte
delle frecce sono **triangoli disegnati**, non `marker` SVG (che svg2pdf gestisce male).

La sequenza, con le sue lezioni:
1. clona l'SVG, togli lo `style`, **rimuovi il transform dello zoom** («si esporta il disegno
   intero», viewBox dal bbox + padding);
2. A4 orizzontale jsPDF; **il font va registrato NELL'ISTANZA** del documento
   (`MappAISpaceMono.registerInto(doc)`) e «la chiave del font-family deve essere ESATTA
   ("Space Mono" nudo, niente apici, niente fallback) o svg2pdf non la trova» — senza, «le
   metriche sbagliate fanno uscire le etichette scentrate»;
3. ⚠️ **svg2pdf non onora `paint-order: stroke fill`**: l'alone bianco delle linking words
   coprirebbe il testo. Rimedio: per ogni `<text>` con alone, **copia-alone bianca dietro** e
   testo davanti senza stroke;
4. fit dentro i margini (277×190) con scala uniforme e centratura;
5. il nome del file dice cosa contiene: `Studio-<mappa>-<motore>.pdf`,
   `Focus-<nodo>-vicini|parentela.pdf`.

Il resto del catalogo export resta come in v1 (dossier multi-pagina — ora `print-dossier.js`,
2.505 righe, col **diagramma ad albero ASCII** in testa; quiz/flashcard via pagine HTML print
CSS; screenshot). Per StudIA: l'export della mappa e del focus = questa pipeline; il «dossier di
ramo» = assemblaggio dei capitoli citati via print CSS (v1 §7.2, invariato); i cartellini = §6.

---

# 8. Il tutor AI (nuovo nello scope)

Tre strati, ed è lo strato di mezzo quello prezioso per StudIA.

### 8.1 Le sei modalità per nodo (`mappai-ai-tutor.js`, 724 righe + `prompts_config.json`)

Il tutor si apre **sul nodo** (o in sidebar sull'intera mappa) e ha 6 modalità, ognuna un system
prompt (`TUTOR_MODE_*_IT/EN`): **Spiega** (EXPLAIN), **Interroga** (ASK), **Socratico**
(SOCRATIC, default — guida con domande, non risponde), **Avvocato del diavolo** (DEVIL),
**Collega** (CONNECT — relazioni con gli altri nodi), **Richiamo** (RECALL — recupero attivo).
Lo stato è **per nodo, persistito con autosave**: `{ mode, turns, history }` — riapri il nodo
domani e la conversazione riprende. Le chat finiscono nel vault (`Chat/`).

### 8.2 `mappai-tutor-core.js` (181 righe, puro) — il contratto prima della chiamata

Logica «testabile in Node», condivisa fra server, studente e docente:
- **`LIMITS` e `canSpend`**: cap di scambi per sessione (default 10, max 30), messaggi ≤600
  caratteri, risposte ≤400 token — il costo si governa *prima* della chiamata;
- **`validateMessage`**: il messaggio si valida prima di spendere;
- **`publicState` a WHITELIST**: «mai chiavi/istruzioni» verso il client;
- **`buildChatPayload`** provider-agnostico (google | infomaniak) da systemInstruction +
  transcript neutro; `extractText` per formato di risposta;
- **`buildTranscript` / `computeTutorResults`**: la chat produce un **report**, non solo parole.

### 8.3 Mastery e «Cosa studiare ora» (`mappai-mastery.js`, `mappai-study-path.js`)

- **Mastery per pinpoint** (nodo × tipo-attività): padronanza come **EWMA dell'accuratezza**
  (α 0.35) + rate opzionale per la **fluenza** (Precision Teaching); livelli
  nuovo/in-corso/acquisito/fluente. Core puro, ingest dai punteggi dello Studio Attivo.
- **`study-path`**: un pannello che risponde a «da dove parto / cosa ripasso» — **Pronti**
  (concetti nuovi col prerequisito = genitore già padroneggiato: gating SOFT, «consiglia, non
  blocca»), **Da rivedere** (deboli, o padroneggiati ma stantii oltre N giorni → decadimento),
  **Padroneggiati**, **Bloccati**. Core puro (`buildParentMap`, `classify`).

### 8.4 Che cosa ne fa StudIA

StudIA ha già ciò che a MappAI manca: **la fonte** (capitoli con rimandi puntuali) e **il
motore** (`lib/ai/provider`, con la dashboard costi). L'innesto:

1. **Tutor per capitolo** (prima) **e per nodo di mappa** (poi): contesto = il capitolo o il
   sottoalbero del nodo + i suoi rimandi — il tutor *cita la fonte* come la chat di Braynr, ma
   con le modalità di MappAI (le due si completano: Braynr ha il RAG con citazioni, MappAI ha la
   didattica delle modalità).
2. **Le 6 modalità come dati** (`lib/tutor.js`): system prompt per modalità nei prompt di casa,
   lingua da `lib/lingua.js` — non nove copie nei moduli (trappola già pagata da StudIA).
3. **`tutor-core` come modello del contratto**: cap scambi, validazione, transcript, report —
   pura, testata, condivisa. Il cap dialoga con la dashboard costi già esistente.
4. **Persistenza**: chat per capitolo/nodo in `Corsi/<id>/CHAT/` (cartella utente, come
   APPUNTI/MAPPE/RIPASSO — la pipeline non la tocca); un pezzo di chat può diventare appunto
   (pattern Braynr, P1).
5. **La modalità RECALL si aggancia al ripasso** (P3): una sessione di richiamo sul capitolo è
   un'attività che alimenta lo stato per-carta; e il «Cosa studiare ora» di `study-path` è il
   fratello del mazzo «da ripassare oggi» (P3.6) — con in più il criterio del **prerequisito**,
   che StudIA può leggere dai `prerequisiti` già presenti nelle schede dei materiali.
6. La mastery EWMA è la v2 naturale del semplice contatore SM-2: stessa cartella `RIPASSO/`,
   più segnale. Non prima che il ripasso base esista.

---

# 9. Che cosa NON portare

- **La force simulation D3 per la vista di studio** — MappAI stessa la scavalca con la Vista
  Studio; resta legittima solo come vista esplorativa, e per StudIA è rimandabile a data da
  destinarsi. (Il motore TD usa `d3.tree`: si porta l'algoritmo Reingold-Tilford o si accetta
  quella singola funzione — decisione da prendere in 5a.)
- **La pipeline di generazione Gemini** (multi-pass, lenses, triage, salvage JSON): StudIA
  genera dalle **schede** con `provider` + schema + `entroSchema`.
- **`studyStatus` dichiarato a mano**; live classes / collab / giochi (dungeon, garden, palace);
  la landing; il licensing. Tutto fuori scope.
- La **vista ridotta** (`mappai-vista-ridotta.js`) è un'altra cosa dal Focus (è il COSTRUISCI
  semplificato): non c'entra con le mappe di StudIA, ma il suo *metodo* — nascondere con una
  classe su `<html>`, mai stile per stile — è buona pratica da ricordare.

---

# 10. Ordine dei lavori (sostituisce la tabella v1; aggiorna la riga 5 di PIANO-BRAYNR)

| # | pezzo | fonte MappAI («re») | taglia |
|---|---|---|---|
| 5a | `lib/mappa/layouts.js`: porting dei motori **DAG, Albero, Percorso, Anelli** (3 stadi, coordinate al/ac, ports, routing) + `misura()` | `studio-layouts.js` (quasi di peso) | M |
| 5b | `lib/mappa.js`: modello dati (§1), `sanitizza()` (§5), `relazioni.js` (§4) | `tree-sanitizer`, `relations` | S/M |
| 5c | Renderer a card SVG nel lettore: **attributi, mai classi** (§7), frecce disegnate, wrap etichette, filigrana, badge del passo | `studio-draw.js` | M |
| 5d | **Focus vicini/parentela**: selezione sottografo, overlay, profilo proprio, evidenzia in hover (§3) | `studio-view.js:419–546` | S/M |
| 5e | Viste con nome + preset dichiarativi (§2.4) dentro il `.canvas`; set di archi (§2.5) | `studio-view.js` | S |
| 5f | **Export PDF**: `exportPdfFromSvg` con font nell'istanza, alone manuale, fit A4 (§7); PDF del Focus | `studio-view.js:618–700`, `vendor/spacemono-font.js` (pattern) | S/M |
| 5g | Editing (nodi/archi, undo etichettato, merge) — invariato v1 | `undo`, `node-merge` | S/M |
| 6 | Mappe proposte dai materiali (rubinetto 2 P2.3): `sanitizza()` obbligatoria + `rel` a vocabolario famiglie | — | M |
| 7 | **Tutor per capitolo** con modalità-come-dati e `tutor-core` (§8.1–8.4 punti 1–4) | `ai-tutor`, `tutor-core`, prompt `TUTOR_MODE_*` | M |
| 8 | Cartellini/fogli: `lib/stampa/foglio.js` con geometria unica; editor per-card come seconda tappa (§6) | `nodesheet-core`, `print-layout` | M |
| v2 | Colonne/Fasci/Matrice; structure-analyzer; multiselect; Studio Attivo (modalità 3 e 6 per prime); mastery EWMA + study-path; pathfinder | §2.2, §5, §8.3 | — |

Avvertenze trasversali invariate (una logica in un punto solo; ogni campo ha un riempitore;
`MAPPE/`, `RIPASSO/`, `CHAT/` in `pacchetto.js` dal giorno uno; mai fidarsi di `level` e genitori
dichiarati — si ricalcolano). Se ne aggiungono due, imparate qui:

1. **La geometria di stampa vive in un modulo dati unico** letto da tutti i renderer (§6): due
   builder con le proprie misure divergono di millimetri, sempre.
2. **Il renderer che vuole esportare bene disegna con attributi**: ogni stile in CSS è uno stile
   che il clone PDF perde. La fedeltà dell'export si decide quando si scrive il renderer, non
   quando si scrive l'export.
