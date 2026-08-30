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
| unità | ✅ **49 file** nella catena di `npm test`, exit 0 |
| CDP | ✅ **65 prove** in elenco · 68 file `prova-*.js` sul disco (i 3 fuori sono i noti di luglio) |
| monolite | `App/StudIA.html` **21.818 righe** · moduli in `App/assets/` (pdf.js escluso): **37** |
| guida ZAINO | **117 figure** in `App/guida-zaino/img/`, di cui **103 rifatte** fra il 29 e il 30 agosto |
| pacchetti | ⚠️ **nessuno**: `dist/` è vuota dal 23 agosto. Si rifanno con `npm run pacchetto` |

```bash
cd "/Users/giacomomeschini/Claude/StudIA/StudIA"
npm test                                                   # 49 file, exit 0
STUDIA_PORTA=9346 ./test/cdp/con-vault-di-prova.sh         # le 65 prove sull'app viva
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

⚠️ **Questo elenco è stato riverificato il 30 agosto, voce per voce, misurando** — non ereditato.
Tre voci erano scritte con la causa sbagliata, una era già chiusa da quindici giorni e due non
esistevano più: le trovi in fondo, sotto «già chiuso». È il motivo per cui un debito si rilegge
prima di ripeterlo: costa meno riverificarlo che inseguirlo.

1. **Nessun pacchetto costruito**: `dist/` è vuota. `npm run pacchetto`, poi notarizzazione e
   installer Windows provato su Windows (`PIANO-ONBOARDING.md`).
2. **Q9 in freezer** — quando si riprende: `/architetto`, e **due bivi veri da chiedere
   all'utente** (il canale: `_evidenze.json` trascinato o pacchetto vero con `lib/pacchetto.js`; e
   che cosa fare quando l'impronta del documento non combacia: rifiutare tutto o importare
   lasciando i segni orfani). ⚠️ Vincolo non negoziabile dell'utente: **aggiunge uno strato, non
   sovrascrive** quelli che lo studente ha già.
3. **Le tre prove L fuori elenco parlano il vocabolario vecchio.** ⚠️ Non è il `cdp.js` di luglio,
   come si è ripetuto per settimane: `prova-l2.js` e `prova-l3l4.js` importano `test/cdp/cdp.js`,
   che esiste ed esporta tutto ciò che chiedono. Eseguite il 30 agosto, muoiono su
   `ReferenceError: progettoAttivo is not defined` — «progetto» prima che diventasse **corso**
   (`RINOMINA-GLOSSARIO.md`). Solo `prova-l1.js` ha anche il `require` rotto, e punta allo
   scratchpad di una sessione di agosto che non esiste più. Il lavoro è una **rinomina**, poi
   `PROVE=(` — oppure si tolgono, dichiarando che cosa resta scoperto delle mappe L0–L4.
4. **Il `frammento` della lente parte sfasato di uno** su un testo che contiene «İ» (U+0130).
   Riprodotto in Node il 30 agosto: `sNorm` fa `toLowerCase()`, e quella lettera diventa **due**
   code unit — la stringa normalizzata è più lunga dell'originale, e gli indici su cui `frammento`
   accende i `<mark>` scorrono di uno.
   ```
   "İstanbul e la memoria"  →  İstanbul e la m<mark>emoria</mark>
   "Istanbul e la memoria"  →  Istanbul e la <mark>memoria</mark>
   ```
   Chi lo chiude tocca `frammento` (`App/assets/ricerca/indice.js:408`), che **suppone che la
   normalizzazione conservi la lunghezza**. Il confine ha già il suo controllo in `test/ricerca.js`.
5. **La rinomina di una fonte**: si può tenendo il numero, ma il nome del file è citato per esteso
   in sei posti — l'elenco è quello di `fonti.usi()` (`lib/fonti.js:296`): il file in `MATERIALI/`,
   `_evidenze.json`, gli appunti `.md`, le mappe `.json`, `_album.json` e la lapide in
   `_rimossi.json`. Non esiste nessuna `fonti.rinomina()`.
6. **La didascalia di un'immagine dell'album passa due volte dall'escape.** Riprodotto il 30
   agosto: `_mdInline` escapa la stringa, e `albumHtml` (`App/assets/lettura/capitolo.js:156`)
   riescapa la didascalia — «Sole & Luna» arriva a schermo come `Sole &amp;amp; Luna`, nell'`alt`,
   nell'`aria-label` e sotto la figura. ⚠️ I gemelli fanno la cosa giusta (`figuraHtml` e i
   rimandi danno `Sole &amp; Luna`): il fix è **togliere l'escape di troppo**, non aggiungerne uno.
7. 📌 **`prova-b1` e `prova-mappe-ui` ripuliscono la chiave sbagliata del banco**
   (`prova-b1.js:22,127`, `prova-mappe-ui.js:42`). ⚠️ `studia.banco` non è morta del tutto —
   `bancoChiave()` la usa come ripiego quando non c'è contenitore — ma la chiave che il banco
   scrive davvero è `studia.banco.c.<contenitore>`, e quella non la tocca nessuno: le due prove
   credono di partire da un banco di fabbrica e non è vero.
8. **Gli incrementi 2 e 3 dell'anteprima scrivibile.** Si vedono nel codice: il campo di blocco
   chiude con `t.setSelectionRange(fine, fine)` — il cursore va **in fondo**, non dove hai
   cliccato (incremento 3, il più piccolo passo utile) — e il suo `keydown` conosce solo Escape e
   ⌘Invio, quindi niente ↹ al blocco dopo né elenchi e riquadri riga per riga (incremento 2).

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
- **`20-pdfbar-numerata.png` mostrava la barra col titolo**: la campagna rifatta a fine agosto l'ha
  risolto, e la barra fotografata è quella di adesso.

---

## 4. Stato dichiarato, non ereditato

| | |
|---|---|
| **verificato oggi** | `npm test` exit 0 (49 file) · suite CDP intera verde (65 prove) · i conti (49 · 65 · 68 · 37 · 117) · le righe del monolite (21.818) · la barra del Confronto letta dal vivo (`Sistema solare ▾`) · la figura 24 riguardata a occhio |
| **provato a mano dall'utente** | i gesti del Confronto: aprire, cambiare documento, chiudere |
| **riverificato oggi** | tutte le voci del §3, una per una: tre avevano la causa sbagliata, quattro sono state chiuse |
| **non fatto** | nessun pacchetto costruito |

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
