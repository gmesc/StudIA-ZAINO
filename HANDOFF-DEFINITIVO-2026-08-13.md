# Handoff definitivo — 13 agosto 2026

> **A chi arriva adesso, in una chat nuova: questo file basta per ripartire.**
> Racconta la giornata del 13 agosto — l'OCR dello zaino portato a compimento su un contratto
> notarile vero, l'unione con la linea banco/zaini di un'altra sessione, e la mappa che smette di
> rimpicciolirsi sotto la mano. Sostituisce
> [HANDOFF-DEFINITIVO-2026-08-12c.md](HANDOFF-DEFINITIVO-2026-08-12c.md), che resta valido per
> tutto ciò che qui non si nomina (evidenze, parole chiave, tratto).
>
> **Regola di lettura**: dove c'è ⚠️ c'è un guasto già pagato — successo davvero, misurato, col
> rimedio accanto. È la parte utile.

---

## 1. Dove sono i lavori, adesso

| ramo | commit | suite | manca |
|---|---|---|---|
| `main` | `3419ae7` | ⚠️ **3 prove rosse** (album, player, + una instabile) | è indietro: non ha né l'OCR né la mappa |
| `deskew-ocr` | `2b1379b` (11 commit) | ✅ 27 unità · 33 prove vive | la prova a mano finale di Giacomo sull'OCR |
| `mappa-limiti` | `dcb5765` (2 commit, parte da `deskew-ocr`) | ✅ 27 unità · 33 prove vive | ⚠️ **TD/SX non funzionano nell'app di Giacomo** (vedi §5) |

`mappa-limiti` **contiene** `deskew-ocr`: unendo il primo si porta dentro anche il secondo. È
stato scelto apposta — le tre prove rosse di `main` sono riparate su `deskew-ocr`, e misurare un
lavoro nuovo dentro un rumore che non è suo è il modo più veloce per sbagliare diagnosi.

```bash
cd "/Users/giacomomeschini/Claude/StudIA/StudIA"
git branch -vv                                   # dove siamo
npm test                                         # 27 file, exit 0
STUDIA_PORTA=9334 ./test/cdp/con-vault-di-prova.sh   # 33 prove
```

---

## 2. L'OCR dello zaino, finito sul documento vero

Il riconoscimento del testo nelle schede fotografate era già consegnato l'11 agosto (PIANO-ZAINO
§Z7). Il 13 Giacomo l'ha usato su un **contratto notarile dattiloscritto** — 15 pagine, testo su
filetti di trattini, righe storte — e ha rimandato indietro sette schermate di difetti. Ognuna è
diventata un commit, e tutte sono state misurate su quella fonte, non su fixture:

1. **il layer copriva il 78% della parola** (`3cd9d28`). ⚠️ `horizontalScale` **non è un'opzione
   di `drawText`**: pdf-lib inghiotte le opzioni sconosciute senza dire niente, e la forzatura
   della larghezza non c'era mai stata. Lo spike misurava la posizione (0,00 pt, vera), mai la
   larghezza — **una forzatura che non si misura è una forzatura che non c'è**. Rimedio:
   l'operatore PDF `Tz` scritto a mano con `pushOperators`;
2. **la selezione senza spazi** — «UZIONEDIDIRITTODIUS» (`85c02db`). ⚠️ pdf.js **scarta lo spazio
   in coda a un run a ogni confine di stato** (`Tz`, `Tf`, `Tm`): provate e fallite quattro
   strade (parola-per-oggetto, spazio-oggetto, spazio insecabile, scala nella matrice). L'unica
   forma che tiene: **una riga = un oggetto di testo**, stato uniforme, parole ancorate col solo
   `Td`, spazi veri in coda. Le soglie che governano la fusione stanno nel sorgente di pdf.js
   (`spaceInFlowMax=0,6` corpi, `negativeSpaceMax=−0,2`), lette là invece che indovinate;
3. **i riquadri alti cinque righe**: Tesseract fonde le righe di trattini col testo in un'unica
   «riga» (179 px per parole alte 35). Rimedio: le righe si **spezzano in sotto-righe** sui salti
   di quota;
4. **l'evidenza a chiazze** (`c52dddc`). ⚠️ pdf.js scala ogni span del textLayer tranne quelli di
   **solo spazio** (5 px su un vuoto di 72): i rettangoli saltavano i vuoti. Rimedio nel
   renderer, `pdfSpaziaLayer` su `textlayerrendered`;
5. **una riga rubava il puntatore a quella sopra** (`d5eb407`): tre macchie della carta lette come
   parole alte 148 px facevano glifi alti due righe. Il corpo di una riga è la **mediana**, mai il
   massimo, e mai oltre la distanza dalla riga sopra;
6. **i filetti coperti al 10%** (`f1b9ef8`): gli spazi in coda riempiono anche il resto del
   riquadro della parola, non solo il vuoto fino alla prossima;
7. **bordo destro mozzo** (`9189357`): la scala di riga vive in una forbice (quantile 0,2 ↔
   mediana) e dentro comanda **l'ultima parola vera**, l'unica che gli spazi non possono ricucire.

⚠️⚠️ **La trappola più costosa non era nel codice: era nel righello.** `verifica()` filtrava gli
item con `str.trim()`, che sono esattamente gli **item-spazio** di pdf.js. Il layer era sano da
tre iterazioni e lo strumento diceva di no. **Quando una misura contraddice un esperimento minimo
identico, si controlla il righello prima del codice.**

E un falso allarme che tornerà: le evidenze **sopravvivono al togli-e-ritrascina** (è la lapide
che fa il suo mestiere), ma quelle nate su un layer vecchio portano dentro la spazzatura di allora
e si riancorano storte su quello nuovo. Sembrano un guasto del motore, sono scorie di dati. Il
round-trip su un layer corrente è provato esatto (`11cc1e1`), e le 16 scorie del contratto sono
state tolte via lib (copia in `APPUNTI/_evidenze.json.bak-13ago`).

**Il deskew** (`ab56f24`): Tesseract dà la baseline di ogni riga come **segmento**, e la sua
pendenza è già l'angolo — bastava smettere di buttare quel dato. Le parole non hanno baseline
propria (misurato: sempre `undefined`), e il codice ripiegava sulla y d'inizio riga: 26 px di
deriva a fine riga a 2°. Ora si interpola. Oltre 2° la pagina si rilegge **raddrizzata**, e il
risultato si tiene solo se ha letto **almeno quanto** la prima passata.

---

## 3. L'unione con la linea banco/zaini

⚠️ **`main` si è mossa mentre lavoravo** (merge `3419ae7` di un'altra sessione: banco, zaini,
media). Il protocollo dice che allora si unisce nel proprio ramo e **si rieseguono le suite sul
codice unito, che non è mai girato**. Fatto (`a511016`).

Il merge automatico non ha dato conflitti testuali — e la revisione indipendente ha confermato che
`App/StudIA.html` è ricostruibile byte per byte, senza pezzi persi. Ma ha trovato **tre guasti
semantici**, tutti ereditati, due dei quali muti (`994374c`):

- ⚠️ **due chiavi doppie nel preload**: `media` e `fonti` comparivano due volte nello stesso
  oggetto letterale. In JavaScript **l'ultima vince e la prima sparisce per intero**, senza un
  errore: `media.list` e `fonti.set` non esistevano più, e i loro canali nel main rispondevano a
  nessuno. Il modale «Trascrivi i video» si apriva e restava piantato; il ruolo di una fonte
  scelto nel wizard non arrivava mai in `_corso.md`. **Provato eseguendo il preload** con
  `electron` finto, non leggendolo;
- `capitolo.js` era l'unico chiamante rimasto a chiedere `srcUrl(file)` senza contenitore.

**Le tre prove rosse di `main`** (`aeb4d0a`) non erano guasti dell'app — verificato da agenti
indipendenti mandati a cercare il difetto: erano prove che davano per scontato uno **schermo
vuoto**, cosa che dal merge non è più vera (l'app riapre da sé quello che avevi aperto). Rimedio:
`partiVuoto()` in `cdp.js`, usata **solo** dalle tre che vogliono il caso vergine — il ripristino
non è sporcizia da spazzare, è una promessa che tre prove del banco misurano apposta.

---

## 4. La mappa che non si rimpicciolisce più

⚠️ **Il guasto**: trascinando un nodo verso il bordo, «tutto diventa piccolissimo» e non si trova
la strada per tornare. Non era un rimpicciolimento: era un **anello che si autoalimentava**.

La vista è fatta di **due strati** che è facile confondere. Il `viewBox` lo ricava `disegna.js`
dal rettangolo che contiene tutti i nodi: non ha stato, non si salva, e il browser ci adatta
dentro il disegno da sé. Sopra c'è lo zoom dell'**utente** (`MAPPA.z`), che ha stato, si salva, ed
è l'unica cosa che la rotella e ⤢ toccano. Il trascinamento campiona il punto di partenza in
coordinate del `viewBox`, ma `mappaRidisegna` gira a ogni `pointermove` e **rifà quel `viewBox`**:
nodo che esce → cornice più grande → tutto rimpicciolisce → lo stesso pixel di mouse vale più
unità di mappa → il nodo corre di più. E ⤢ non salvava nessuno, perché azzerava lo zoom mentre il
disastro stava nella cornice.

**La regola, adesso** (`d53e0b4`): *la cornice si rifà quando cambia la **struttura** della mappa —
quanti nodi, quanti archi — non quando la mano sistema dove stanno*. Scioglie il congelamento:
«Adatta alla vista» (che ora scioglie **e ridisegna**), un cambio di vista, e la struttura che
cambia — riconosciuta da una **firma**, non da un elenco di chiamanti, perché un elenco si
dimentica.

Misurato, e provato in `prova-mappa-trascina.js` (**il gesto centrale dell'editor non aveva
nessuna prova**, né unità né app viva): cornice 696 → 696 durante il trascinamento, 806 dopo
«Adatta», 1876 con un nodo nuovo.

Giacomo ha provato e confermato i punti 1-4 del piano. **Il punto 2 del piano — il limite
all'area visibile — non è stato scritto**: con la cornice ferma il difetto sparisce, e una regola
in meno è meglio. Resta in `PIANO-MAPPE-EDITOR.md` come rete, se un giorno servisse.

---

## 5. ⚠️ QUELLO CHE VIENE PRIMA DI TUTTO: TD/SX

**Giacomo dice che nell'app non funzionano ancora.** Il lavoro fatto (`dcb5765`) e che cosa
sospetto:

- il **cambio motore** aveva la sua funzione (`mappaMotore`) e dentro la regola che conta per le
  mappe tue: ogni nodo ha una posizione a mano, un motore non può muovere ciò che è fissato,
  quindi prima si **liberano** le posizioni, si dichiara quante e si mette un passo nella pila;
- l'**orientamento** stava in tre righe **dentro il gestore del click** e quella regola non
  l'aveva mai vista: premere TD/SX cambiava la leva e lasciava il disegno identico. È il caso da
  manuale della regola di L2 — *un gesto è una funzione chiamabile, non un gestore di eventi*;
- ora c'è `mappaOrientamento(verso)` (`StudIA.html:13750`), gemella di `mappaMotore`, e il gestore
  è una riga sola (`:13868`).

**La prova viva dice che funziona** (`prova-mappa-trascina.js`, sezione «Il VERSO cambia davvero»:
verso cambiato, posizioni azzerate, disegno ridisposto, ⌘Z che le rimette). Quindi le ipotesi, in
ordine di probabilità:

1. ⚠️ **l'app di Giacomo era partita prima del commit**: Electron legge i file all'avvio, e la
   modifica è di pochi minuti dopo la prova dei punti 1-4. **Prima cosa da chiedergli: ricarica
   (⌘R) o riavvia l'app, e riprova.** Se funziona, chiuso;
2. sulla sua mappa il motore è **`anelli`**: là TD/SX si spengono apposta (gli anelli non hanno un
   verso) e il `title` lo dice. Da guardare col mouse sopra;
3. la barra della mappa nel suo blocco è **stretta**: sotto i 560px nasconde i bottoni lunghi
   (`@container mappa`), e il gruppo del verso potrebbe non essere a schermo. Da guardare
   allargando il blocco.

⚠️ E un promemoria che è già costato un rosso: i due versi si chiamano **`td` e `lr`**, non «sx».
I nomi si leggono nel markup, non si ricordano.

---

## 6. Che cosa fare, in ordine

1. **TD/SX** (§5): far ricaricare l'app e riprovare. È l'unica cosa in sospeso che l'utente ha
   dichiarato rotta.
2. **La prova a mano dell'OCR**, mai completata: togliere la fonte, ritrascinare, riconoscere, e
   guardare il **bordo destro** (`subingresso`, `IL PORTATORE`) e l'**altezza sui filetti**. Serve
   un riconoscimento nuovo: gli ultimi due commit dell'OCR cambiano il layer, non il viewer.
3. **Il merge**, quando 1 e 2 sono verdi: `git checkout main && git merge mappa-limiti` porta
   dentro tutto (OCR + ponte + prove + mappa). ⚠️ Le quattro condizioni valgono ancora, e la (d) —
   `main` ferma — va **riverificata**: quella sessione parallela potrebbe essersi mossa di nuovo.
4. **Il punto 2 del piano mappa** solo se Giacomo riesce ancora a perdere un nodo.

---

## 7. Trappole nuove, da ricordare

- **Il righello prima del codice**: se una misura contraddice un esperimento minimo identico, è la
  misura a essere sospetta. Costata tre iterazioni sugli spazi del layer.
- **Le opzioni sconosciute non protestano**: pdf-lib ignora in silenzio ciò che non conosce.
  Vale per ogni libreria: quello che non si misura non esiste.
- **Due chiavi uguali in un oggetto letterale non sono due cose**: l'ultima vince, la prima
  sparisce. Il preload ne aveva due paia.
- **Una prova nuova va DENTRO `PROVE=(`**: c'è un `PROVE=("$@")` prima, e infilarcela la fa
  «passare» senza essere mai eseguita. Presa per un soffio: verificato il conto, 32 → 33.
- **Le prove che aprono qualcosa lasciano lo strascico**: da quando l'app ripristina ciò che era
  aperto, chi vuole partire da zero lo dichiara (`partiVuoto`).
- **Un processo di misura che muore prima di chiudere il motore Tesseract non esce mai**: un
  worker vivo tiene Node in piedi. Chiudere in un `finally`, o restano processi appesi (uno è
  rimasto sei ore).
