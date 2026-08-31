# Handoff definitivo — 30 agosto 2026

> **A chi arriva adesso: questo file basta per ripartire.** Sostituisce
> `HANDOFF-DEFINITIVO-2026-08-26.md`, che **non esiste più sul disco** insieme agli altri
> diciannove storici: la catena è stata chiusa oggi, e il §7 dice dove sono finiti e come si
> riprendono. Il *come si costruisce qui* sta in `GUIDA-ARCHITETTO.md`; il dettaglio di ogni area
> nei `PIANO-*`; la pipeline in `HANDOFF.md`.
>
> ⚠️ **Se leggi una cosa sola, leggi il §7.** Da oggi la storia del progetto non si legge più
> aprendo ventidue file: si chiede a `git`. Chi non sa che è stata chiusa, cerca file che non ci
> sono e conclude che il progetto non è documentato.

---

## 0. Da dove ripartire, in tre righe

`main` è alla punta di **`guida-campagna`**, unito oggi in fast-forward: albero pulito, **nessun
ramo aperto, nessun worktree**. Il lavoro del giorno è in **`6bc56e6`** (il Confronto), **`a76ebeb`**
(la figura e la ricetta) e nel commit di documenti che porta questo file.

Il pacchetto «Quaderno» resta a **otto voci su nove**: **Q9, le sottolineature del tutor**, è **in
freezer** per decisione dell'utente (26 agosto). Non è abbandonato: è in attesa, e il file di
riferimento è `HANDOFF-PACCHETTO-QUADERNO.md`, autosufficiente.

⚠️ **Prima di lanciare qualunque cosa che apra Electron**, `GUIDA-ARCHITETTO.md` §6.1: la porta di
debug è a esemplare unico e il client CDP finisce a pilotare l'app sbagliata. E **non si chiude mai
un processo per nome**.

---

## 1. Lo stato, in cifre

| | |
|---|---|
| `main` | la punta di **`guida-campagna`**, unita oggi — quattro commit del 29-30 più i tre di oggi |
| remoto | `git@github.com:gmesc/StudIA.git` — ✅ **allineata** (spinto il 30 agosto) |
| rami · worktree | **nessuno** |
| unità | ✅ **51 file** nella catena di `npm test`, exit 0 |
| CDP | ✅ **69 prove** in elenco = 69 file `prova-*.js` sul disco: **nessuna fuori** (le tre L sono rientrate il 30 agosto; `prova-primo-avvio` è del 31) |
| monolite | `App/StudIA.html` **21.818 righe** · moduli in `App/assets/` (pdf.js escluso): **38** |
| guida ZAINO | **117 figure** in `App/guida-zaino/img/`, di cui **103 rifatte** fra il 29 e il 30 agosto |
| pacchetti | ✅ **`dist/StudIA-1.0.0-arm64.dmg` (246 MB) è firmato Developer ID e NOTARIZZATO**: `spctl` dice `accepted · source=Notarized Developer ID`, ticket cucito all'app e al dmg — si apre con un doppio click, anche senza rete. `dist/StudIA-1.0.0-setup-x64.exe` (167 MB) è un NSIS **non firmato**: SmartScreen avvisa. ⚠️ Nessuno dei due è stato **eseguito** |

```bash
cd "/Users/giacomomeschini/Claude/StudIA/StudIA"
npm test                                                   # 51 file, exit 0
STUDIA_PORTA=9346 ./test/cdp/con-vault-di-prova.sh         # le 69 prove sull'app viva
STUDIA_PORTA=9346 ./test/cdp/con-vault-di-prova.sh prova-confronto.js   # una sola
```

⚠️ Il `cd` fa parte del comando: la cartella di lavoro delle chat è `StudIA/` (quella **di fuori**).

⚠️ **E se il lavoro sta su un ramo, il comando per provarlo a mano si dà SEMPRE**, in un blocco a
sé: `git checkout <ramo> && npm start`. È già successo che l'utente provasse su `main` credendo di
essere sul ramo.

---

## 2. Che cosa è entrato dal 26 al 30 agosto

### 2.1 ⚠️ La lente vedeva le mappe a metà

Q5 prometteva che la ricerca vedesse anche le mappe. Vedeva i nodi della sola mappa **aperta**
nell'editor: di tutte le altre entrava il titolo e nient'altro. **Una parola scritta in un nodo di
una mappa chiusa non si trovava, senza nessun errore** — il modo peggiore in cui una ricerca si
rompe, perché chi cerca conclude di non aver mai scritto quella parola.

La ragione era di forma, non una scelta: `searchBuild` è sincrona e `mappe.apri` asincrona, quindi
dal disco non si poteva leggere. E il commento che lo giustificava — «una lettura per ogni mappa
bloccherebbe la digitazione» — era **falso**: `searchRun` ricostruisce l'indice quando cambia il
corso o il percorso, non a ogni tasto.

| dove | che cosa |
|---|---|
| `preload.js` | `mappe.nodi(corso)`, **sincrona** come `album.elenco`, che nello stesso indice fa già la stessa cosa. Passa i tre soli campi che l'indice cerca: posizioni, colori, archi e memorie non c'entrano con la ricerca e sarebbero il grosso di ciò che attraversa il ponte |
| `App/assets/ricerca/indice.js` | `docsMappe(mappe, {aperta})` — **quale grafo vince è una decisione**, e sta in una funzione sua: la mappa aperta porta anche ciò che non è ancora salvato, sulle altre vale il disco |
| `App/StudIA.html` | solo il cablaggio: leggere, passare, spingere |

Provato in Node (+4 controlli) e sull'app viva (`prova-lente-mappe.js`).

### 2.2 La guida ZAINO racconta fine agosto

La guida era ferma al 23 e non nominava «postilla» nemmeno una volta. Adesso ha quattro sezioni
nuove (la lente che apre **alla riga** e mette a fuoco **quel** nodo · la postilla e dove si
rilegge · lo strumento «Postille» · la soglia dei media che non si aprono · le due reti contro
l'appunto svuotato · il quaderno che si riapre dove eri · sbirciare un rimando), e **tre punti dove
diceva il falso** sono stati corretti (i formati audio che «entrano ma non compaiono», la
cancellazione «vera» di appunti e mappe, il pallino della fonte che Q3 ha aggiustato).

La campagna di `_lab/` ha **otto passi nuovi** in coda, dove il vault di prova è già pieno: è
l'unico stato in cui quelle cose si vedono — un pannello delle Postille su uno zaino vergine è una
scatola vuota. Materiale nuovo: `Nota vocale.aiff`, fatto con `say`, perché serve un formato che
Chromium **davvero** non apre o la soglia non ha niente da fermare.

⚠️ **Tre trappole pagate nel laboratorio**, e sono di ordine, non di codice:
`selezionaTesto` guarda gli span **resi**, e pdf.js ne tiene resi solo un intorno della pagina
corrente — quale intorno dipende dal passo precedente, e la stessa frase c'era a corse alterne
(rimedio: `selezionaFra`, che la prova su più pagine); un passo che chiude il documento lascia
senza layer di testo tutti quelli che vengono dopo; `.CodeMirror-activeline` **non esiste**
(`styleActiveLine` non è acceso) e il rettangolo della riga lo dà `charCoords`.

### 2.3 La barra del Confronto: il nome sta nel selettore

Nella barra dello strumento «Confronto» il nome del documento era scritto **per esteso** accanto al
selettore: la terza copia della stessa cosa — «Confronto» è già nella testata del blocco, e su un
nome lungo (*FLOW Manuale Fidelity MONITORING Implementation Guide IT v2 0 REV*) i comandi
venivano spinti fuori. È la stessa storia di `pdfTitle` (23 agosto) e `plTitle` (24).

Ora il nome è l'**etichetta viva** del bottone `#pdf2Doc`, scritta in `fonte2Aggiorna()` — un punto
solo, da cui passano apertura, chiusura e ogni ridisegno — e i puntini di sospensione li mette la
regola CSS che già serviva la Fonte (`#pdfDoc,#pdf2Doc`).

⚠️ **L'`aria-label` si riscrive insieme al testo.** Quello del markup **copre** il testo visibile:
lasciandolo fermo, chi ascolta lo schermo sentirebbe per sempre «scegli il documento da
confrontare» e mai **quale** documento sia. Ed è ora l'unico posto che lo dice.

`prova-confronto.js` ha cinque controlli in più: il titolo a parte non c'è, il selettore porta il
nome, lo dice anche a voce, e alla ✕ torna a invitare («Documenti ▾»).

### 2.4 Una figura sola, senza rifarne 117

La figura `24-confronto` mostrava la barra vecchia. Rifare `campagna.js` avrebbe riscritto tutte e
117 le immagini: un commit di soli PNG rigenerati, dove l'unica davvero cambiata si perde.
`_lab/scatto-24.js` ricostruisce **a mano lo stato che il passo 24 eredita** dai passi 21-23 —
pagina 9, ricerca «pianeti» aperta, zoom alla larghezza — e riscatta quella sola.

⚠️ È anche la sua fragilità: chi tocca i passi 21-23 della campagna deve toccare anche quel file.
Sta scritto in testa allo script e nel `README.md` del laboratorio.

---

## 3. Che cosa resta da fare

⚠️ **Questo elenco è stato riverificato il 30 agosto, voce per voce, misurando** — non ereditato:
tre voci erano scritte con la causa sbagliata, una era già chiusa da quindici giorni e due non
esistevano più. Quel che restava è stato chiuso lo stesso giorno, e sta in fondo sotto «già
chiuso», con il perché. È il motivo per cui un debito si rilegge prima di ripeterlo: costa meno
riverificarlo che inseguirlo — e di dieci voci, **due erano lavoro vero**.

1. ⚠️ **Windows: l'installer non è firmato**, e l'account Apple non c'entra. Senza Authenticode
   SmartScreen avvisa a ogni installazione. Le vie sono un certificato OV (la reputazione si
   accumula coi download), uno EV (nessun avviso subito, token hardware) o **Azure Trusted
   Signing**, oggi la più economica e supportata da `electron-builder`. Tutte chiedono una verifica
   d'identità di giorni.
2. **Nessuno dei due pacchetti è stato eseguito** (`PIANO-ONBOARDING.md`). Controllati **dentro** — la guida c'è
   con tutte e 117 le figure, `_lab/` e le prove restano fuori, i moduli nuovi ci sono — e per il
   dmg si è misurato il verdetto di Gatekeeper, che è la domanda vera. Ma nessuno ha ancora fatto
   la cosa più semplice: **aprirli**. Del dmg manca il doppio click su un Mac che non sia questo;
   dell'installer si è misurato che è un NSIS valido e completo (`PE32 executable (GUI) … Nullsoft
   Installer`), non che parta — per quello serve una macchina Windows.
3. **Q9 in freezer** — quando si riprende: `/architetto`, e **due bivi veri da chiedere
   all'utente** (il canale: `_evidenze.json` trascinato o pacchetto vero con `lib/pacchetto.js`; e
   che cosa fare quando l'impronta del documento non combacia: rifiutare tutto o importare
   lasciando i segni orfani). ⚠️ Vincolo non negoziabile dell'utente: **aggiunge uno strato, non
   sovrascrive** quelli che lo studente ha già.

**Già chiuso, e tolto da questo elenco** (verificato il 30 agosto):

- **Le «46 variabili morte» di `pdf_viewer.scoped.css`**: la causa era `bin/pdfjs-css.js`, che
  lasciava i blocchi `:root` **annidati** dentro il guscio (`#pdfPane #pdfPane`, che non
  corrisponde a niente). Il generatore scrive `:is(#pdfPane, #pdfPane2)` di primo livello **dal 15
  agosto**, e nel foglio ci sono **zero** regole annidate. Restano solo anomalie di pdf.js stesso
  (4 variabili definite e mai usate, 12 usate e mai definite, che prendono il fallback). ⚠️ Il
  numero 46 non si riproduce con nessun criterio: era una cifra ricordata, non ricontata.
- **`PIANO-BRAYNR.md` §P1.1-quater e -quinquies**: ✅ fatti il **18 agosto 2026**, e c'è scritto
  nel piano stesso (righe 217 e 270). Erano stati trascinati per inerzia.
- **Le bande orizzontali sui fondi sovrapposti**: non sono una coda, sono una **decisione chiusa e
  misurata** (`PIANO-BRAYNR.md:291`): `::highlight()` applica solo `background-color`, un
  `linear-gradient` viene ignorato, e al loro posto c'è la mescolanza dei fondi. Rifarle vorrebbe
  dire abbandonare gli highlight per un motore di pittura da risincronizzare a ogni scorrimento.
- **Gli incrementi 2 e 3 dell'anteprima scrivibile**: ✅ fatti il 30 agosto, ed erano in coda dal
  17. **3 — il cursore dove hai cliccato**: il campo contiene il markdown, il click è avvenuto sul
  testo reso, e fra i due c'è la sintassi; `posSorgente` allinea i due testi a due dita (dove i
  caratteri coincidono avanzano entrambi, dove no avanza solo il sorgente) e mette il cursore
  davanti al carattere che SI VEDE — fermarsi prima lo lascerebbe fra gli asterischi del
  grassetto, e la prima lettera battuta finirebbe nel marcatore. **2 — l'elenco voce per voce**:
  otto voci erano un blocco solo, quindi un campo con otto righe; adesso ogni `<li>` è il suo
  blocco, e ↹ tiene e passa al prossimo (⇧↹ indietro). ⚠️ `vociElenco` dice di NO agli annidati e
  alle voci che continuano sotto: quelle coordinate sono le due con cui si sovrascrive il file, e
  una sbagliata si mangia le voci vicine. Le due decisioni stanno in un modulo puro,
  `App/assets/appunti/scrivibile.js` (26 controlli in `test/scrivibile.js`); al renderer resta il
  cablaggio, e `mdbApri` è una funzione sola perché le porte sono due — il click e il ↹.
  ⚠️ Una riga di CSS che non si indovina: `div.mdb{display:contents}` invece di `.mdb`, perché un
  `<li>` a `display:contents` non ha rettangolo — non si può cliccare e perde il pallino.
- **⚠️ Il primo avvio parte dallo ZAINO** (31 agosto): l'app non apre più sempre nei corsi, e i
  requisiti della pipeline — motore AI, chiave, Python — non si chiedono più all'ingresso ma alla
  **soglia dei corsi**, e solo se manca qualcosa. Le tre decisioni stanno in
  `App/assets/onboarding/avvio.js` (20 controlli in Node); il racconto per intero, con le due
  trappole pagate, è in `PIANO-ONBOARDING.md`.
- **La notarizzazione del pacchetto Mac**: ✅ fatta il 30 agosto. `npm run notarizza` firma con
  **Developer ID Application: Giacomo Meschini (32678PYY8K)**, notarizza l'app, le cuce il ticket,
  rifà il dmg dall'app cucita, notarizza anche il dmg e chiude chiedendo a Gatekeeper che cosa ne
  pensa: `accepted · source=Notarized Developer ID`. Le credenziali stanno in un profilo del
  portachiavi (`studia-notarize`), quindi nessuno script vede la password. ⚠️ Le cuciture sono
  DUE apposta: solo sul dmg, l'app trascinata in Applicazioni resta senza ticket e offline
  Gatekeeper non può verificarla; solo sull'app, è il dmg scaricato dal browser a far comparire
  l'avviso. ⚠️ E `bin/pacchetto-mac.sh` non è morto: è la via locale ad-hoc, che ora dichiara di
  esserlo e passa `identity=null` a riga di comando — nel `package.json` c'è la firma vera, così
  il pacchetto da spedire non può uscire non firmato per distrazione.
- **La rinomina di una fonte**: ✅ fatta il 30 agosto, logica e gesto.
  `fonti.rinomina(vault, corso, nome, titolo)` cambia la parte leggibile e **lascia stare il
  numero** — `03` è ciò che scrivono i rimandi `pdf:03#p=7`, e cambiarlo vorrebbe dire riscrivere
  ogni rimando di ogni file, sbagliandone uno senza accorgersene. Il nome per esteso invece viene
  riscritto in tutti e sei i posti che `usi()` legge: il file, il suo indice, il campo `materiale`
  di `_evidenze.json` e di `_album.json`, il testo di appunti e mappe, il `nome` sulle lapidi.
  Prima il file, poi chi lo nomina — al contrario un errore a metà lascerebbe riferimenti a un
  documento inesistente — e ciò che non si è potuto riscrivere finisce in `avvisi`.
  Il gesto è ✎ in barra accanto al cestino, **solo nello zaino** con un documento aperto: nei corsi
  i nomi li governa la pipeline. Dopo, il documento si riapre col nome nuovo alla pagina dov'eri.
  `test/fonti.js` da 62 a 82 controlli (4 diventano rossi se i riferimenti non si aggiornano);
  `prova-fonti.js` prova il cablaggio, che in Node non esiste.
- **📌 `prova-b1` e `prova-mappe-ui` ripulivano la chiave sbagliata del banco**: ✅ chiuso il 30
  agosto. Adesso spazzano **tutte** le chiavi `studia.banco*` invece della sola `studia.banco`, che
  è la chiave di modalità morta dal 13 agosto: spazzare il prefisso vale anche per i contenitori
  che la prova non sa di stare per aprire. ⚠️ E `prova-mappe-ui` nascondeva un rosso suo: da sola
  falliva con «appunto di prova rimasto: `_riga.json`» — il segno di dove eri rimasto (Q1), che
  nasce da solo — perché il filtro saltava solo `_indice.md`. Ora salta tutti i file di servizio.
- **Le tre prove L erano fuori elenco**: ✅ rientrate il 30 agosto, e la causa non era quella
  scritta per settimane («chiedono un `cdp.js` di luglio»): due delle tre importavano già
  `test/cdp/cdp.js`, e morivano su `progettoAttivo is not defined` — il vocabolario di prima della
  rinomina. Rimesse in vita hanno chiesto di seguire cinque cose cambiate sotto: la mappa si apre
  come strumento del banco (`apriStrumento`, non `#mappaBtn`, e `mappaAperta()` al posto di
  `dataset.mappa`); **Esc non chiude più la mappa** (esce dal focus: chiude la ✕); «Modifica una
  copia» è diventato **«Parti da qui»** e semina la sola radice; i comandi `.mlungo` spariscono
  sotto i 560px di contenitore (container query: il bottone c'è, non è `hidden`, misura 0×0 —
  la prova ora mette la mappa a tutto banco, che è il gesto vero); in «Mie» i motori non sono più
  in barra ma nel menu della tela. ⚠️ E hanno trovato un difetto vero (qui sotto). Elenco: 65 → 68.
- **⚠️ La lente lasciava la barra della mappa a dire il registro sbagliato**: ✅ chiuso il 30
  agosto. Atterrando su un nodo di mappa, `searchGoto` scriveva `MAPPA.registro='mie'` a mano; se
  quella mappa era **già aperta**, `mappaApriMia` è un no-op dichiarato e nessuno ridisegnava la
  barra — si guardava una propria mappa con «Generata» premuto e «Parti da qui» al posto di «+».
  E premere «Mie» non rimediava: `mappaRegistro` usciva subito perché il registro *era* già quello.
  Due punti: la lente adesso sincronizza, e `mappaRegistro` **risincronizza invece di uscire muto**
  quando il registro chiesto è già il suo — così qualunque scrittura a mano viene riparata dal
  primo click. Il controllo sta in `prova-lente-mappe.js`, dove vive il gesto: due atterraggi, il
  secondo su una mappa già aperta.
- **Il `frammento` della lente partiva sfasato di uno sulla «İ»**: ✅ chiuso il 30 agosto, e non in
  `frammento`. La promessa violata era di `sNorm`, che nel suo stesso commento dice «preserva la
  lunghezza»: `toLowerCase()` faceva diventare «İ» (U+0130) due code unit, e da lì passano TUTTI
  gli indici del modulo (`ntext`, `cerca`, `frammento`). Ora l'ASCII e il resto si abbassano
  separatamente, e `minuscola()` prende la forma minuscola solo se è lunga uguale — altrimenti
  toglie i segni combinanti, che sono ciò che la allunga, e in ultima istanza tiene il carattere
  com'era. ⚠️ Effetto secondario, buono: «İstanbul» adesso si trova cercando `istanbul`, mentre
  prima la normalizzata era `i̇stanbul`, col punto combinante in mezzo, e non corrispondeva a
  niente. `punto()` non ne soffriva: mappa le posizioni una per una. `test/ricerca.js` da 127 a
  130 controlli, e la sezione che **dichiarava il limite** adesso lo tiene chiuso.
- **La didascalia di un'immagine dell'album passava due volte dall'escape**: ✅ chiuso il 30
  agosto. `_mdInline` escapa l'intera riga prima di riconoscere le figure, e `albumHtml`
  riescapava la didascalia — «Sole & Luna» arrivava a schermo come `Sole &amp;amp; Luna`,
  nell'`alt`, nell'`aria-label` e sotto la figura. Tolto l'escape di troppo dai quattro posti
  (i gemelli `figuraHtml` e i rimandi facevano già la cosa giusta: il fix era togliere, non
  aggiungere), e la convenzione — *chi chiama escapa, le funzioni `*Html` no* — è scritta nella
  docstring, dove ci si sbagliava. ⚠️ I primi controlli erano **verdi col difetto rimesso**: in
  Node non c'è `window`, quindi `albumHtml` cade sempre nel ramo «immagine non trovata», e i tre
  posti sbagliati stanno nell'altro ramo. Con un `window` finto e il gancio del contenitore la
  prova morde: 5 controlli su 5 rossi col difetto, `test/appunti-md.js` da 47 a 50.
- **`20-pdfbar-numerata.png` mostrava la barra col titolo**: la campagna rifatta a fine agosto l'ha
  risolto, e la barra fotografata è quella di adesso.

---

## 4. Stato dichiarato, non ereditato

| | |
|---|---|
| **verificato oggi** | `npm test` exit 0 (51 file) · suite CDP intera verde (**69 prove**) · i conti (50 · 68 · 38 · 117) · le righe del monolite (21.818) · la barra del Confronto letta dal vivo (`Sistema solare ▾`) · la figura 24 riguardata a occhio |
| **provato a mano dall'utente** | i gesti del Confronto: aprire, cambiare documento, chiudere |
| **riverificato oggi** | tutte le voci del §3, una per una: tre avevano la causa sbagliata, dieci sono state chiuse |
| **non fatto** | i due pacchetti non sono stati **aperti**: il dmg non è stato montato a mano né l'installer eseguito su Windows |

⚠️ Prima di dichiarare finito un lavoro, la suite CDP va **rieseguita per intera**, non per i file
toccati. È la lezione che negli ultimi dieci giorni è tornata più spesso.

---

## 5. Le due reti sugli appunti (26 agosto) — riassunto che basta

Un appunto vero è stato trovato col frontmatter intatto e il **corpo vuoto**. Causa riconosciuta:
⌘Z su un editor la cui cronologia era stata azzerata da un `setValue`, con il salvataggio
automatico che scriveva. Le difese non stanno nel gesto sospettato, ma nei punti da cui passano
**tutte** le scritture:

- **Rete 1** — `appunti.save` rifiuta di scrivere il vuoto sopra un appunto che ha del testo, salvo
  `opt.svuota`, che **solo un gesto esplicito** dichiara. Il rifiuto **si dice** anche quando il
  salvataggio era silenzioso.
- **Rete 2** — `APPUNTI/_versioni/`: si versiona **solo ciò che perde** (testo nuovo più corto di
  quello sul disco), le 10 più recenti per appunto, `.md` leggibili col Finder, fuori
  dall'esportazione.

I limiti, dichiarati: proteggono da lì in avanti, non retroattivamente, e chi svuota con un gesto
esplicito passa la rete 1 — lì difende la rete 2. Il racconto intero è in `PIANO-ZAINO.md` §Z17.

---

## 6. Il pacchetto «Quaderno»: otto voci su nove

Il dettaglio di ciascuna è in `PIANO-ZAINO.md`, ai paragrafi indicati.

| | | dove |
|---|---|---|
| **Q8** | il quaderno va nel **Cestino**, non nel nulla | §Z14 |
| **Q7** | o entra e si vede, o si ferma sulla **soglia** | §Z15 |
| **Q3** | il **pallino** della fonte apre davvero, o non compare | §Z16 |
| **Q6** | la **postilla**: il corpo dell'annotazione | §Z17 |
| **Q1** | il quaderno si riapre **alla riga** (`APPUNTI/_riga.json`) | §Z19 |
| **Q5** | la lente vede anche **mappe e didascalie** — completata il 30 (§2.1) | §Z20 |
| **Q4** | **sbirciare** senza saltare (hover = anteprima) | §Z21 |
| Q2 | la lente porta al punto esatto | §Z13 |
| **Q9** | le sottolineature del tutor | **in freezer** |

---

## 7. ⚠️ La catena degli handoff è CHIUSA

Fino a oggi c'erano **ventidue** file `HANDOFF*`, ognuno «sostituisce il precedente ma resta valido
per ciò che non ripete». Risalire quella catena costava una sessione, e le regole che valevano
davvero sono state assorbite mesi fa da `GUIDA-ARCHITETTO.md` (§3 invarianti, §8 trappole
permanenti). **Venti file storici sono stati eliminati il 30 agosto.**

Restano tre documenti, e sono tre cose diverse:

| file | che cos'è |
|---|---|
| **questo** | il punto d'ingresso: lo stato di adesso |
| `HANDOFF.md` | ⚠️ vecchio nei numeri, ma è l'**unica specifica della pipeline**: wizard, composer, percorsi, figure, Chandra |
| `HANDOFF-PACCHETTO-QUADERNO.md` | il pacchetto voce per voce, coi fatti misurati e i bivi. Vivo finché Q9 è in freezer |

**Come si riprende un handoff eliminato.** Sono in git, interi, fino al commit **`52b0ad5`**:

```bash
git show 52b0ad5:HANDOFF-DEFINITIVO-2026-08-26.md      # uno qualsiasi, per nome
git show 52b0ad5 --stat | grep HANDOFF                 # come si chiamavano tutti
git log --diff-filter=D --name-only --oneline -- 'HANDOFF*'
```

E se cerchi un argomento senza sapere in quale stia: `git log -S "<parola>" -- 'HANDOFF*'`.

⚠️ **Un handoff vecchio non si legge come una legge in vigore.** Due decisioni scritte lì come
vincolanti sono state poi **rovesciate**: la disposizione del banco («una sola, globale» → **una per
contenitore**, ed è il motivo per cui `studia.banco` è una chiave morta) e la scala delle mappe
generate. In conflitto vince sempre il più recente — e se il conflitto è con `GUIDA-ARCHITETTO.md`,
vince ugualmente l'handoff, che è più recente per costruzione.

⚠️ **Che cosa non sta in nessun file**: `PIANO-LEGGERE.md` e `IDEE-ZAINO.md` (il catalogo di 56
voci) sono stati consegnati in chat e **non sono mai stati versionati**. Di `IDEE-ZAINO` restava un
estratto nell'handoff del 23 agosto: `git show 52b0ad5:HANDOFF-DEFINITIVO-2026-08-23.md`.
