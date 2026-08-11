# Handoff definitivo — 11 agosto 2026

> **A chi arriva adesso.** Questo file basta per ripartire. Racconta la giornata — è nata la
> **modalità ZAINO** e si è cominciato il **riordino delle barre** — e dice che cosa resta aperto.
> Il dettaglio dello zaino, lavoro per lavoro, sta in [PIANO-ZAINO.md](PIANO-ZAINO.md); tutto ciò
> che riguarda i corsi e non si nomina qui vale ancora come scritto in
> [HANDOFF-DEFINITIVO-2026-08-10.md](HANDOFF-DEFINITIVO-2026-08-10.md).
>
> **⚠️ AGGIORNATO A SERA.** Il file è nato a metà giornata e diceva «il lavoro che continua per
> primo è il restyle». Il restyle È STATO FATTO, e dopo è cominciato lo smontaggio del monolite.
> Le parti invecchiate sono corrette qui sotto; quello che è successo nel pomeriggio sta nel §9.
>
> **Regola di lettura**: dove c'è ⚠️ c'è un guasto già pagato — successo davvero, misurato, con il
> rimedio accanto. È la parte utile.

---

## 1. Stato

`npm test` → **314 controlli verdi su 19 suite**. `./test/cdp/con-vault-di-prova.sh` → **21 prove
sull'app viva**, verdi. (Il conteggio dei controlli è quello che stampano le suite: cambia col
corpus, non col codice.)

```bash
cd "/Users/giacomomeschini/Claude/StudIA/StudIA" && npm test
./test/cdp/con-vault-di-prova.sh                     # tutte le prove sull'app viva
./test/cdp/con-vault-di-prova.sh prova-tendine.js    # una sola
```

Prove vive: `prova-b1` · `prova-b2` · `prova-menu` · `prova-keyword` · `prova-mappe-ui` ·
`prova-topbar` · `prova-wikilink` · `prova-pdf` · `prova-testolayer` · `prova-album` ·
`prova-memorie` · `prova-tendine` · `prova-modo` · `prova-zaino` · `prova-evidenze-pdf` ·
`prova-fonti` · `prova-import`.

Nuove suite in `npm test`: `zaini` · `evidenze-pdf` · `lettura` · `fonti`.

⚠️ Le prove non toccano niente di tuo: l'istanza di prova ha una cartella dati sua
(`--user-data-dir`) e lavora su una copia magra del vault. StudIA può restare aperta.

---

## 2. Il fatto che spiega metà di questo file

**L'app ha due modalità, e una funzione sola le tiene insieme.**

`corsoAttivo()` risponde con l'id del CORSO o con quello dello ZAINO, secondo la modalità; sul disco
`corsi.cartella()` risolve `Corsi/<id>` **e** `Zaini/<id>`. Appunti, mappe, album, evidenze, segni di
lettura e materiali chiedono a quelle due funzioni e non sanno che gli zaini esistono.

⚠️ Sono due perni con la stessa proprietà pericolosa: **se si scollegano, a schermo non si vede
niente di rotto** — si continua a scrivere nel contenitore di prima. Per questo `prova-modo.js` e
`prova-zaino.js` li controllano per nome, e non «la topbar è cambiata».

---

## 3. Che cosa c'è adesso, in breve

**La modalità ZAINO** (dettaglio in PIANO-ZAINO.md, lavori Z1–Z6a):

- si commuta dal **logo**; la topbar alterna corso/percorso/lezione ↔ zaino;
- uno zaino vive in `Zaini/<id>/` con la forma di un corso (`MATERIALI/PDF`, `APPUNTI`, `MAPPE`,
  `ALBUM`, `_lettura.json`);
- la **sidebar** ha tre sezioni: fonti · appunti · mappe;
- i PDF si **trascinano dentro**: copiati, numerati `NN nome.pdf`, e indicizzati per pagina **da
  pdf.js** (266 pagine in 736 ms, senza Python e senza modelli). L'indice serve **solo** alla lente;
- la **lente** in modalità zaino cerca dentro i documenti, una voce per pagina;
- l'**evidenziatore funziona sul PDF**: le evidenze si ancorano a `materiale + pagina + citazione`,
  si dipingono con la Custom Highlight API e sopravvivono a zoom e cambio pagina;
- la **barra delle fonti** è sul token, ha il selettore dei documenti (solo nello zaino) e il **segno
  di lettura** in `_lettura.json`: un documento si riapre dove lo si era lasciato.

**Il gesto «Appunta»** ha adesso una riga di otto scelte sotto di sé — `¶` senza riquadro più i sette
callout — in tutte e due le superfici della selezione, **nei corsi come negli zaini**. La scelta si
ricorda (`studia.appunta.stile`); finché non si sceglie decide l'origine (documento → senza riquadro,
capitolo → nota).

**Le parole chiave** si portano negli appunti (menu del chip → «Negli appunti», o trascinamento) e
sulla mappa: il nodo nasce **col colore della sottolineatura** e col suo indirizzo, che accende il
pallino della fonte.

---

## 4. I guasti trovati oggi, con la misura

1. **Il ritaglio dell'album era ribaltato.** `getPagePoint` risponde in spazio PDF (origine in basso
   a sinistra), `page.render` disegna in spazio viewport (origine in alto): usare `rect.y` come
   distanza dal bordo superiore ribalta la pagina. Misurato: pagina alta 495 pt, selezione a 69 px
   dall'alto di un riquadro di 687 → `rect.y = 371`, disegno partito a 371 pt **dall'alto**, cioè
   321 pt più in basso. Rimedio: `convertToViewportPoint` sui due angoli (regge anche una pagina
   ruotata) e origine arrotondata al pixel intero — la somiglianza col riferimento passa da 90% a
   **100%**.
2. **La mappa NN→file guardava solo `Corsi/`**: in uno zaino nessun documento aveva un numero, quindi
   nessun rimando `pdf:NN#p=7` si poteva scrivere e le parole chiave finivano negli appunti come
   testo nudo.
3. **Quella mappa arriva dal preload congelata** (`contextBridge`): scriverci il numero di un
   documento appena importato non sollevava e non faceva niente. Il renderer ne tiene una copia.
4. **`_pdfNum()` rispondeva con i numeri dell'ultimo corso analizzato all'avvio**, perché
   `_numAttivi` restava ferma lì. Ora la precedenza è dichiarata: corso in analisi → contenitore
   aperto → mappe globali.
5. **«Alla mappa» sbagliava capitolo di uno**: scriveva `state.current + 1` mentre il campo è 0-based
   (`genera.js` scrive `indice: state.current`, `mappaVaiAllaFonte` fa `go(d.capitolo)`). Il pallino
   di un frammento estratto dal capitolo 1 apriva il 2.
6. **Il velo del trascinamento si accendeva su ogni gesto**, anche portando una parola chiave sulla
   mappa: ora si chiede al `dataTransfer` se ci sono `Files`, il testo dipende dalla modalità, e il
   carattere è dell'app (uno pseudo-elemento su `html` **non eredita** il font del `body`).
7. **`curMeta()` tornava `null` nello zaino**, e con lei si spegneva metà interfaccia: `notesReload`
   tornava a mani vuote, cioè gli appunti nello zaino non esistevano.
8. **Un `var` letto prima di essere assegnato** fermava lo script a metà: `corsoAttivo()` viene
   chiamata durante il primo disegno, e l'eccezione lasciava `MODO`, `MATERIALI` e `VAULT_META`
   indefiniti — app partita a metà, senza un errore visibile.

**Il filo comune**: cinque volte su otto il difetto era **un dato chiesto alla fonte sbagliata** —
la variabile dell'analisi invece del contenitore aperto, lo spazio PDF invece di quello del viewport,
una radice sola invece di due.

---

## 5. Le trappole del mestiere, aggiornate

- **Niente apici inversi nei commenti che finiscono dentro un template letterale.** Successo altre
  tre volte oggi (quarta, quinta e sesta della storia del progetto). Se una prova muore con
  `SyntaxError: missing ) after argument list`, è questo.
- **Una misura presa quando la regola non corrisponde più mente.** Lo stile calcolato di
  `html[data-drop]::after` senza l'attributo è quello della radice, non del velo.
- **Un click calcolato mentre la colonna si ridisegna arriva a un nodo staccato**: il gesto parte,
  non lo riceve nessuno, e il rosso accusa la funzione che non è mai stata chiamata.
- **Uno strumento lasciato acceso da un'altra prova**: le forbici dell'album trasformano il
  trascinamento in un ritaglio. `partiPulito()` adesso le spegne.
- **Il layer di testo di pdf.js si ricostruisce** a ogni zoom e a ogni rientro della pagina: i nodi
  di prima restano in memoria ma staccati, e un `Range` costruito su quelli **non dipinge e non
  solleva**.
- **Le coordinate non si accorgono di un ribaltamento: se ne accorgono i pixel.** Per i ritagli si
  confronta l'immagine con la stessa area tagliata dalla pagina disegnata a parte — e si chiede che
  dentro ci sia inchiostro, perché due aree bianche combaciano al 100%.

---

## 6. IL LAVORO CHE CONTINUA: il riordino delle barre

### 6.1 La regola, già applicata e provata

Lo stile di riferimento è la **barra del markdown**: la più leggibile dell'app perché non incornicia
ogni bottone. Adesso vale per la barra della mappa, quella delle fonti e quella degli appunti:

- **niente cornice** per bottone (`border:0`, fondo trasparente);
- **niente spazio** fra i bottoni (`gap:0`): si toccano;
- **una barretta verticale** (`.tbsep`, alias `.msep`) dove cambia il mestiere dei comandi;
- il bottone sotto il puntatore si segnala col **fondo** (`--hover`), quello **acceso** col fondo
  teal (`aria-pressed="true"`);
- i gruppi segmentati (`.mseg`) non hanno più cornice: sono bottoni attaccati con lo stato acceso.

⚠️ `barreSeparatori()` spegne le barrette che non separano niente — in queste barre metà dei comandi
va e viene, e una barretta scritta nel markup sopravvive al gruppo che doveva separare. Gira dopo
`mappaSincronizzaComandi`, `aggiornaBarraPagina` e `refreshNoteUI`.

Guardia: `prova-tendine.js` controlla `border: 0px` e `gap: 0px` nelle tre barre, e che **nessuna
delle barrette a schermo separi il nulla**.

### 6.2 ~~Che cosa resta da riordinare~~ — FATTO, tutto

L'elenco di sette voci che stava qui è chiuso. In ordine, com'è finita:

1. **La topbar** — fatta, e la domanda «uguale o diversa?» ha una risposta: **è la stessa barra, un
   decimo più grande**. Non ricopia nessuna regola: ridichiara i token (`--tb-h`, `--tb-fs`,
   `--tb-pad-x`, `--tb-bar-h`) sul contenitore `.tbar-lg`, e tutto ciò che sta dentro cresce da sé.
   Il rapporto è un token solo, `--tb-piu`. Le posizioni non si sono mosse: logo a sinistra,
   `margin-right:auto`, comandi a destra nell'ordine di prima.
2. **I quadratini del menu della selezione** — superati dal punto §9.2: la barra sulla selezione È
   diventata il menu del tasto destro, quindi ha le sue righe e non più le proprie.
3. **I separatori di EasyMDE** — unificati: `i.separator` è ora la barretta di StudIA (1×16,
   `--line`), e i bottoni dell'editor leggono `--tb-*` come tutti gli altri.
4. **La testata dei blocchi** — la sua altezza è un token derivato, `--tb-blocco-h` = bottone di
   barra + 3px di bordi. Lo legge anche la maniglia dell'indice, che le sta a fianco: erano 40
   contro 33, sette pixel di scalino in un angolo dove due riquadri si toccano.
5. **Parole chiave e album** — sul token: campi di ricerca da 24 a 30, il bottone `Aa` da `.iconbtn`
   a `.tbtn`.
6. **`.pdfpag .iconbtn`** — cancellata: era codice morto, i bottoni della paginazione sono `.tbtn`
   da Z4.
7. **Il chip «altro capitolo»** — spento nello zaino, dove i capitoli non esistono e non poteva mai
   spegnersi. ⚠️ Ora sta tornando con un contenuto suo (il documento da cui nasce l'appunto): è il
   lavoro Z6 che `curCtx()` annunciava nel suo commento.

**Il token, in una riga**: `class="tbar"` sulla barra, `class="tbtn"` sul comando, e non si scrive
mai più un pixel a mano. Guardie: `prova-tbar` (le cinque barre sono la stessa barra),
`prova-topbar-stile` (la testata è quella barra ×1.1 e le posizioni non si muovono),
`prova-appunti-barra` (una libreria di terze parti piegata al sistema), `prova-maniglia-indice`.

### 6.3 Come lavorarci senza rompere niente

- Le misure stanno nei token `--tb-*` (barre degli strumenti) e `--ctl-h` (controlli grandi). **Sono
  due cose diverse**: non unificarle per simmetria.
- Ogni volta che si tocca una barra, rieseguire `prova-tendine.js` (misure e stile) e `prova-fonti.js`
  (le altezze contro il token).
- Le prove vive si eseguono tutte in fila prima di dire che è finito: metà dei guasti di oggi si è
  visto solo con la suite intera, non con la prova singola.

---

## 7. Che cosa resta aperto, oltre al restyle

### 7.1 Dello zaino

- **Z7 — Impostazioni › ZAINO**: scheda nuova (il meccanismo `.set-tab`/`.set-pane` c'è), con lo
  stato di `ocrmypdf` per i PDF fotografati, lo scarico delle lingue, e la spiegazione di quando
  serve. ⚠️ `ocrmypdf` scrive un layer di testo invisibile **dentro una copia** del PDF: da quel
  momento il documento è indistinguibile da un nativo e il resto del codice non cambia. Il motore va
  scritto nell'indice (`motore: 'tesseract'`), e i crediti — `ocrmypdf` (MPL-2.0), `Tesseract`
  (Apache-2.0) — vanno in `CREDITI`.
- **Rifare i ritagli sbagliati**: le immagini salvate prima del rimedio §4.1 restano storte, ma il
  rettangolo salvato è giusto. Serve un comando «rifai i ritagli di questo contenitore» che
  rigeneri i PNG da `rect`.
- **Z6b**: il resto degli strumenti sul documento (mappa e appunti hanno già la loro strada; restano
  i gesti fini).
- **B3**, la fonte a schede: più documenti come linguette nello stesso blocco.

### 7.2 Dei corsi (dall'handoff del 10 agosto, ancora valido)

1. ⚠️ **L'unico modo rimasto di perdere lavoro dell'utente**: l'identità dei capitoli è
   `cartella + ordine`, e una rigenerazione che ne infila uno in mezzo stacca evidenze, appunti e
   nodi-mappa. Nello zaino il problema non esiste (l'ancora è pagina + citazione): **il rimedio
   provato là si può retro-portare qui**.
2. **La forma delle mappe di corso**: 65.158 × 358 px non è una mappa, è un nastro. Va prima di G3.
3. **G3**: i verbi sugli archi dal modello.
4. **Il ripasso** (AREA 3 di PIANO-BRAYNR): lo stato di apprendimento vive solo in memoria e si
   azzera a ogni `loadLesson`.

### 7.3 Del viewer

Restano come nell'handoff di ieri: il documento non si chiude quando «fonte» esce dal banco, il tema
scuro non arriva alla pagina (`pageColors` non passato), la stampa del PDF dall'app.

---

## 8. Dove sta il codice

```
lib/zaini.js            il contenitore ZAINO: radice, cartella, guardie, elenco, creazione
lib/fonti.js            i documenti che entrano: numero, nome, copia, indice per pagina
lib/lettura.js          il segno di lettura (_lettura.json), per contenitore
lib/evidenze.js         le parole chiave: identità a due spazi (capitolo | documento+pagina)
lib/corsi.js            ⚠️ cartella(): il perno — risolve `Corsi/` e `Zaini/`
lib/materiali.js        contenitoriConMateriali(): i materiali seguono lo stesso perno
main.js                 zaino:* · fonti:* · lettura:*
preload.js              numeriPerCorso() sulle due radici · webUtils.getPathForFile
App/StudIA.html         MODO · corsoAttivo() · evSup* (le due superfici dell'evidenziatore)
                        albumRendi() ⚠️ conversione PDF→viewport · barreSeparatori()
                        i token --tb-* / --tb-piu e `.tbar`, il vestito di TUTTE le barre
                        selMenuHTML() ⚠️ una funzione, due superfici sulla selezione

App/assets/lettura/capitolo.js   il parser dei capitoli (era ritagliato dall'HTML in un `vm`)
App/assets/lettura/lezioni.js    rimando → lezione, varianti comprese
App/assets/tts/segmenta.js       testo → segmenti da leggere
App/assets/appunti/elenco.js     appunto ↔ capitolo, i tre gruppi
App/assets/dati/{icone,emoji}.js dati, non codice
lib/reader-parser.js    ⚠️ non ritaglia più niente: carica i quattro moduli. 53 righe
```

Prove più recenti: `prova-modo` (le due modalità) · `prova-zaino` (la sidebar a tre sezioni) ·
`prova-evidenze-pdf` (l'evidenziatore sul documento, zoom compreso) · `prova-fonti` (barra, selettore
e segno di lettura) · `prova-import` (import, indice, lente) · `prova-album` (⚠️ il confronto pixel
del ritaglio) · `prova-tendine` (lo stile delle barre).

---

## 9. Il pomeriggio: il monolite comincia a smontarsi

### 9.1 Perché, in tre cifre

`App/StudIA.html` era **13.072 righe, 804 KB**. Tre costi misurati, nessuno estetico:

1. **Git non sa separare il lavoro.** Per portare tre sessioni su `main` il file è arrivato a
   `+4603/−250` in un commit indivisibile: barre, zaino, album e fonti insieme.
2. **Il 68% del codice del renderer non si poteva provare in Node.** Una prova CDP costa ~40
   secondi e un'istanza di Electron; una prova di unità 40 millisecondi.
3. ⚠️ **C'era già un rimedio disperato in produzione.** `lib/reader-parser.js` **ritagliava il
   sorgente dell'HTML** — uno dei quattro blocchi fra due `indexOf`, gli altri tre fra
   commenti-sentinella `@…-puro-inizio` — e lo eseguiva in un sandbox `vm`. Più di mille controlli
   pendevano da due marcatori di testo e tre commenti: cancellarne uno riordinando portava via le
   prove **senza un errore**, e il verde restava verde.

Il piano completo è in [PIANO-MODULI.md](PIANO-MODULI.md). Il criterio di taglio è uno:
**esce la logica che non tocca il DOM, resta ciò che è pagina.**

### 9.2 Che cosa è uscito, e che cosa è cambiato

| modulo | righe | che cos'è |
|---|---|---|
| `App/assets/lettura/capitolo.js` | 306 | il parser dei capitoli (`mdChapter`, frontmatter, blocchi recintati) |
| `App/assets/tts/segmenta.js` | 207 | testo → segmenti da leggere ad alta voce |
| `App/assets/lettura/lezioni.js` | 97 | da un rimando alla lezione da aprire (varianti comprese) |
| `App/assets/appunti/elenco.js` | 72 | appunto ↔ capitolo, i tre gruppi della tendina |
| `App/assets/dati/icone.js` | 60 KB | ⚠️ era **una riga da 59.706 caratteri** dentro l'HTML |
| `App/assets/dati/emoji.js` | 4 KB | la tavolozza curata del selettore |

Tutti **UMD**, come `mappa/grafo.js`: `<script src>` nel browser, `require()` in Node, **lo stesso
file**. Niente moduli ES — da `file://` seguono le regole CORS e costerebbero un server locale o un
bundler, cioè il primo dei non-obiettivi.

`lib/reader-parser.js`: **128 → 53 righe**, non importa più né `fs` né `vm`. Il nome resta solo
perché lo scrivono tre file di prova; il giorno che chiameranno i moduli per nome, sparisce.

**Altro, nella stessa giornata:**

- **Una superficie sola sulla selezione.** La barra che compare da sé e il menu del tasto destro
  erano due disegni per le stesse cinque azioni, con le condizioni scritte due volte. Adesso il
  menu lo scrive `selMenuHTML()` e le due porte lo mostrano; `#selBarra` porta le classi
  `ctxmenu selmenu` e aggiunge solo dove si posa. Guardia: `prova-selezione-menu`.
- **I richiami di nota saltano.** `[^1]` era un `<sup>` colorato d'accento che non faceva niente —
  sembrava un link. Ora è un'ancora alla voce in fondo, e ogni voce ha la freccia che riporta
  indietro. Gli id nascono dall'id del capitolo, non da un contatore di resa: due rese danno gli
  stessi id. ⚠️ Prefisso `nota-` e non `note-`, che è **già** l'id dei bottoni di «Note e
  materiali» (`StudIA.html:3502`) — due id uguali e metà dei salti finisce sull'elemento sbagliato.
  Guardia: `test/note.js` (47 controlli) + `prova-note` (il salto dentro `.bcorpo`).
- **`lib/evidenze.js` torna un file di testo.** Conteneva due byte NUL letterali come separatore:
  scelta giusta, ma un NUL nel sorgente rende il file binario per git — niente `diff`, niente
  `blame`, merge irrisolvibile. Ora è la sequenza di escape; gli id delle evidenze sono identici
  (verificato confrontando vecchia e nuova su quattro casi).

### 9.3 Le trappole nuove, tutte pagate oggi

- ⚠️ **I confini di un blocco non si prendono da un `grep` di ieri.** Tagliati agli indici presi
  prima dell'estrazione del parser — il file si era accorciato di 214 righe — i tre moduli sono
  nati a pezzi. Si calcolano dalle sentinelle.
- ⚠️ **`LESSONS` sono le LEZIONI, non i corsi.** Iterarle chiamando `cambiaCorso()` gira a vuoto.
- ⚠️ **Un click di CDP arriva a coordinate dello SCHERMO.** Premere un'ancora a y=1103 in una
  finestra alta 848 non preme niente: il rosso accusa il gestore per un colpo caduto nel vuoto.
  Prima `scrollIntoView`, poi il click.
- ⚠️ **Il tasto destro via CDP non genera `contextmenu`**: quello lo fa il sistema operativo. Si
  manda l'evento a mano, con le coordinate dentro i rettangoli del range.
- ⚠️ **Misurare le righe di una barra dai bordi alti conta righe che non ci sono**: una barretta da
  16 dentro una riga da 33 ha il `top` più basso pur stando sulla stessa riga. Si contano i centri.

### 9.3-bis Il tardo pomeriggio: togliere una fonte senza staccarne il lavoro

Fino a oggi una fonte si poteva solo **aggiungere**: per toglierla si andava nel
Finder, lasciando dietro un indice orfano — una lente che trova pagine di un
documento che non c'è.

Il problema vero però non è cancellare, è **il ritorno**. Il legame fra una fonte
e il lavoro che ci sta sopra (evidenze, ritagli, appunti, nodi di mappa) è il
NOME, perché è il nome che compare nei rimandi `pdf:03#p=7`. Reimportando lo
stesso PDF prendeva il numero successivo libero, e per l'app era un altro
documento: tutto restava orfano **avendo davanti il file giusto**.

**La lapide.** `MATERIALI/_rimossi.json` conserva l'IMPRONTA DEL CONTENUTO (sha1)
insieme al nome che la fonte aveva. Se quel contenuto torna, riprende nome e
numero di prima e tutto si riaggancia da sé, senza riscrivere un file
dell'utente.

- ⚠️ **L'impronta è del contenuto, non del nome**: sul nome, le evidenze di
  «dispensa.pdf» finirebbero attaccate a un dispensa.pdf qualunque.
- ⚠️ **Il numero si riusa SOLO su impronta uguale.** È la stessa azione con
  l'esito opposto: riciclarlo in generale farebbe puntare i vecchi `pdf:03` a un
  documento diverso.
- ⚠️ **Le lapidi prenotano il loro numero.** Difetto trovato scrivendo la prova,
  non a schermo: senza prenotazione il documento importato dopo prendeva il
  numero liberato, e al ritorno c'erano due «01». `dimentica()` è il gesto
  separato — l'unico irreversibile — con cui si dichiara che una fonte non
  tornerà e se ne libera il numero.

Nell'app: un cestino nella barra della fonte, **solo nello zaino**; la conferma
dice quanto lavoro ci si appoggia (`fonti.usi`) e promette il ritorno prima di
chiedere; il file va nel **Cestino di sistema**, non `unlink`. Se un file non si
è potuto leggere non si toglie niente — «non lo so» non è «no», la regola di
`albumElimina`.

Nella stessa fascia: **«Nasce dal documento»** è arrivato anche nella rinomina
delle mappe (`materiale` in `lib/mappe.js`), e nello zaino un appunto dice da
quale documento nasce, o `PERSONALE` (Z6, quello che `curCtx()` prometteva).
⚠️ Tre liste bianche in un giorno hanno provato a mangiarsi il campo nuovo:
`CHIAVI` in `lib/appunti.js`, la sua gemella nel renderer (`noteMeta`), e
`normalizza()` in `lib/mappe.js`. Il controllo che le smaschera non è «il campo
esiste» ma «il campo torna indietro dal disco».

### 9.4 Dove si è arrivati, e che cosa viene dopo

```
13.072 → 12.899 righe   ·   804 → 723 KB   ·   6 moduli nuovi   ·   il `vm` sparito
2232 controlli di unità su 19 file   ·   24 prove CDP sull'app viva
```
⚠️ Le righe sono risalite dopo il minimo di 12.610: le estrazioni ne hanno tolte
510, le funzioni nuove del pomeriggio (togliere una fonte, il documento
d'origine di appunti e mappe) ne hanno aggiunte ~290. È il motivo per cui il
conteggio delle righe **da solo non va creduto**: il numero che conta è il
secondo — quanta di quella logica gira in Node.

Prossimo passo del piano: **M3, la ricerca** (~700 righe su 866 già pure). È la cosa che si rompe
più silenziosamente — se l'indice smette di indicizzare qualcosa non lo dice nessuno, semplicemente
non lo trovi più — e oggi non ha nemmeno una prova in Node.

⚠️ E resta vero il §7.2: **l'identità dei capitoli (`cartella + ordine`) è ancora l'unico modo di
perdere lavoro dell'utente**. Il refactoring non la peggiora e non la risolve. Le flashcard, che
vivono attaccate ai capitoli e la cui storia di ripasso è il dato più costoso dell'app da
ricostruire, vanno costruite DOPO quel rimedio.

---
