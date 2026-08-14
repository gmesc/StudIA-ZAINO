# Handoff definitivo — 14 agosto 2026, sera

> **A chi arriva adesso: questo file basta per ripartire.** Sostituisce
> [HANDOFF-DEFINITIVO-2026-08-14.md](HANDOFF-DEFINITIVO-2026-08-14.md), che resta valido per tutto
> ciò che non ripete: lo stato dello smontaggio, la carta e i PDF, il trascinamento dei ritagli, e
> soprattutto **§4, le quattro cose che contano davvero prima del beta** — quelle non sono cambiate.
>
> Qui c'è un lavoro solo, aperto su un ramo: **lo zoom della fonte**.
>
> **Regola di lettura**: dove c'è ⚠️ c'è un guasto già pagato, col rimedio accanto. È la parte utile.

---

## 1. Dove sono i lavori

| ramo | commit | suite |
|---|---|---|
| `fonte-zoom-adatta` | `41fdd97` | ✅ **29** file di unità · **36** prove CDP, tutte verdi |
| `main` | `727476b` — **ferma**, non si è mossa | |

```bash
cd "/Users/giacomomeschini/Claude/StudIA/StudIA"
npm test                                              # 29 file, exit 0
STUDIA_PORTA=9334 ./test/cdp/con-vault-di-prova.sh    # 36 prove sull'app viva
```

⚠️ **Il ramo non è ancora unito**, e non lo si unisce finché non sono vere tutte e quattro le
condizioni del §7.2 della guida: (a) le due suite verdi — lo sono; (b) **i gesti provati a mano da
Giacomo** — la lista è al §4 qui sotto, ed è l'unica che manca; (c) piani e handoff aggiornati —
fatto (`PIANO-ZAINO §Z4-bis` e questo file); (d) `main` ferma — da **riverificare** al momento del
merge, non adesso.

---

## 2. Che cosa è stato fatto: il bottone dello zoom ha tre stati

Richiesta di Giacomo: «il click sul bottone % allarga la fonte adattandola al riquadro, e ci resta —
se allargo lo split anche lo zoom aumenta; il bottone in quel momento mostra una lineetta con due
frecce invece della percentuale, e se schiaccio più o meno torna a mostrare la percentuale. E
SHIFT+scroll zooma sotto il puntatore».

| stato | bottone | come ci si arriva | che cosa fa il riquadro |
|---|---|---|---|
| adattata alla larghezza | `⟷` | click (da qualunque stato) | la scala **segue** il riquadro |
| adattata alla pagina intera | `⤢` | un altro click | la scala **segue** il riquadro |
| a mano | `144%` | «+», «−», SHIFT+rotella | la scala **non si muove** |

La percentuale non si perde quando il bottone mostra un segno: sta nel suggerimento, insieme a dove
porta il click («Adattata alla larghezza — 144% — segue il riquadro; clicca per adattare alla pagina
intera»).

⚠️ **Il bottone tiene la larghezza del CASO PEGGIORE**, cioè «500%» — il tetto dello zoom. Trovato da
Giacomo provando i gesti: i segni misuravano 30px e una percentuale 46, quindi passando allo zoom a
mano il bottone si allargava di sedici pixel e «+» e «−» si spostavano **sotto le dita di chi stava
premendo**. La misura è in `ch` e non in pixel per seguire `--tb-fs`, e non sono 4ch: le barre hanno
`letter-spacing`, quindi quattro caratteri occupano più di quattro larghezze di cifra (4,3ch dava
39px contro i 46 veri; il numero giusto è **5,5ch**). La regola generale: **un'etichetta che cambia
riserva lo spazio del suo caso peggiore**, o sposta i comandi vicini mentre li si usa.

**Il ciclo a tre stati è una scelta dichiarata**: il click prima alternava larghezza ↔ pagina intera,
e col nuovo comportamento «pagina intera» sarebbe sparita. Ora ci sono due modi dinamici e una
percentuale, con un bottone solo.

Il modo **non è un interruttore nostro**: è `currentScaleValue` quando non è un numero — un dato che
il viewer tiene già e che si ricorda su disco così com'è (invariante 1: niente contatore parallelo).

**Dove vive.** L'aritmetica in `App/assets/fonti/zoom.js` — puro, `test/zoom-fonte.js` in `npm test`
(29ª suite). Nel monolite solo ciò che tocca il viewer e la barra: `pdfZoomAggiorna`, `pdfZoomPasso`,
`pdfZoomAdatta`, `pdfZoomRiadatta` e i due ascoltatori. Rapporto misurato su questo lavoro: **283
righe fuori dal monolite** (modulo + prova) contro **136 dentro** — meglio dell'1-a-6 osservato nei
tre giorni prima.

---

## 3. ⚠️ Le trappole pagate qui (la parte che vale oltre questo caso)

1. **`page-width` non è un abbonamento.** pdf.js calcola la scala **una volta**, quando gliela si
   assegna; il suo `ResizeObserver` aggiorna solo una variabile CSS per l'altezza. A riadattare i
   modi per nome, nel visualizzatore ufficiale, è `webViewerResize` di `app.js` — che noi non
   carichiamo. Vale in generale: **di una libreria si eredita quello che si è caricato**, e la
   sensazione che «page-width sia un modo» viene dall'app ufficiale, non dal viewer.
2. **`origin` di `updateScale` NON è in coordinate di schermo**, benché il visualizzatore ufficiale
   gli passi `clientX/clientY`: pdf.js lo confronta con `containerTopLeft`, cioè
   `offsetTop/offsetLeft`. Là il contenitore sta subito sotto la barra e i due sistemi quasi
   coincidono; qui `#pdfFrame` è `inset:0` dentro un blocco del banco, quindi la correzione veniva
   fatta **a metà**. Misurato: 29px di fuga (dx −25 · dy −15) contro 0 dopo la conversione. ⚠️ Un
   parametro che «funziona nell'esempio ufficiale» può dipendere dal LORO layout.
3. **L'isteresi contro il ping-pong della barra di scorrimento**: adatta → compare la barra → cambia
   la larghezza utile → riadatta → sparisce la barra → … Si riadatta solo oltre i 4px di scarto.
4. **`--pane-w` non è più lo split della fonte.** La prima stesura della prova muoveva la colonna del
   dock e misurava 465px prima e 465px dopo, **accusando il codice**: da quando la fonte è uno
   strumento del banco, la sua larghezza la decide il divisore del banco. ⚠️ Quando una misura dice
   «non è cambiato niente», il primo sospetto è la **leva sbagliata**, non il codice.
5. **Una rotellata sintetica va preceduta da un `mouseMoved`**, o Chromium non sempre sa a chi
   consegnarla: senza, una corsa su tre perdeva **tutte e tre** le rotellate della sezione, compresa
   quella nuda che col nostro codice non c'entra niente.
6. **Il bersaglio di un gesto sintetico si cerca fra i pezzi VISIBILI di una pagina NOTA.** pdf.js
   monta anche le pagine vicine: il «più vicino al centro» poteva cadere fuori dalla finestra, e le
   rotellate finivano nel vuoto. Ora la prova va a pagina 5 e sceglie fra i suoi span a schermo.
7. **I segni `↔` e `↕` sarebbero diventati emoji colorate**: il `@font-face` di OpenMoji dichiara
   `U+2190-21FF`. Si usano `⟷` (U+27F7) e `⤢` (U+2922), fuori da tutti gli intervalli dichiarati —
   e una prova di unità **conta i codepoint** invece di fidarsi dell'occhio. Verificato comunque
   anche con uno scatto: glifi neri, bottone da 30px come gli altri.

---

## 4. I gesti provati a mano ✅ *il 14 agosto sera*

Provati tutti da Giacomo, tutti funzionanti. L'unico difetto uscito da qui è il bottone che si
allargava cambiando etichetta (§2), rimediato e coperto da una prova. **Restano da riverificare solo
`main` ferma e le due suite prima di unire** (§7.2 della guida).

1. Apri una fonte: il bottone mostra `⟷`, non `100%`.
2. Trascina il divisore del banco avanti e indietro: **la pagina cresce e cala col riquadro**.
3. Premi «+»: il bottone diventa `NNN%`; adesso allargando il riquadro la pagina **non** cambia più.
4. Riclicca il bottone: torna `⟷` e riadatta subito. Un altro click: `⤢`, pagina intera — e anche
   quella segue il riquadro.
5. SHIFT+rotella su una parola in mezzo alla pagina: la parola resta sotto il puntatore. Senza SHIFT
   la rotella scorre come sempre.
6. Chiudi e riapri l'app: ritrovi il modo (o la percentuale) che avevi lasciato.
7. Con le forbici accese, un ritaglio in corso non deve saltare per una rotellata.

---

## 5. Che cosa resta aperto

Invariato rispetto al [14 agosto §5](HANDOFF-DEFINITIVO-2026-08-14.md) — il motore invisibile sulle
mappe tue, il limite del nodo all'area visibile, M4-M9, le pillole delle Lenti — più:

- **Il beta fra nove giorni**: il §4 del 14 agosto resta la lista che conta, e il **pacchetto** (una
  `dist/` ferma al 23 luglio) è ancora la prima cosa.

---

## 6. Come si lavora qui

[GUIDA-ARCHITETTO.md](GUIDA-ARCHITETTO.md) è la fonte su *come si costruisce*. Le tre di ogni
sessione: ramo per ogni lavoro con commit che spiegano il *perché*; le prove misurano ma non
guardano, quindi una lista corta di gesti a mano; e a fine sessione un handoff datato che rimpiazza
questo.
