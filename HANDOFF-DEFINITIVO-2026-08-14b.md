# Handoff definitivo — 14 agosto 2026, sera

> **A chi arriva adesso: questo file basta per ripartire.** Sostituisce
> [HANDOFF-DEFINITIVO-2026-08-14.md](HANDOFF-DEFINITIVO-2026-08-14.md), che resta valido per tutto
> ciò che non ripete: lo stato dello smontaggio, la carta e i PDF, il trascinamento dei ritagli, e
> soprattutto **§4, le quattro cose che contano davvero prima del beta** — quelle non sono cambiate.
>
> Qui ci sono tre lavori del 14 sera: **lo zoom della fonte** e **le forbici con ⌘** (uniti in
> `main`), e **le foto nell'album** (F1, su un ramo aperto).
>
> **Regola di lettura**: dove c'è ⚠️ c'è un guasto già pagato, col rimedio accanto. È la parte utile.

---

## 1. Dove sono i lavori

| ramo | commit | suite |
|---|---|---|
| `main` | `0143b28` (15 ago, dopo il merge di `menu-impostazioni`) | crediti, Atlante, token |
| `foto-album` | `2011657` — **aperto**, gesti da provare, **già rifondato su `main`** | ✅ **33** file di unità · **41** prove CDP |

**Un ramo aperto: `foto-album`** (F1, le foto). I gesti a mano sono al §4-bis; finché non sono
provati non si unisce. `fonte-zoom-adatta` è entrato in `main` in **fast-forward** — `main`
era ancora a `727476b`, quindi il codice unito è **esattamente** quello su cui erano girate le due
suite: niente da rieseguire. Il ramo è stato cancellato con `-d`; la sua punta resta nel reflog.

```bash
cd "/Users/giacomomeschini/Claude/StudIA/StudIA"
git switch foto-album                                 # ⚠️ l'albero può essere su main
npm test                                              # 33 file, exit 0
STUDIA_PORTA=9334 ./test/cdp/con-vault-di-prova.sh    # 41 prove sull'app viva
```

⚠️ **UNA SESSIONE PARALLELA HA MOSSO `main`** mentre questo ramo era aperto: dieci commit —
crediti e licenze, l'Atlante delle opzioni, la tokenizzazione dei bottoni — che toccano gli stessi
quattro file (`App/StudIA.html`, `package.json`, `preload.js`, il runner delle prove). Il ramo è
stato **rifondato** su `main` il 15 agosto, i due conflitti risolti erano due ELENCHI (la catena di
`npm test` e `PROVE=(`), e **le due suite sono state rieseguite sul codice unito**, che non era mai
girato prima.

⚠️ E il sintomo che ha fatto scoprire tutto: l'app avviata mostrava «Album» invece di «Ritagli» e
il vecchio messaggio di rifiuto, perché **l'albero di lavoro era tornato su `main`**. Prima di dare
la colpa al codice, guardare su quale ramo si sta.

⚠️ Trovato durante il rebase: **`test/atlante.js` non era nella catena di `npm test`** — la prova
esisteva e non girava mai. È la stessa trappola del `PROVE=(`, in salsa `npm`: una prova nuova va
DENTRO l'elenco, o dice «verde» senza essere mai stata eseguita. Aggiunta (passa).

Le quattro condizioni del §7.2 della guida erano tutte vere al momento del merge: (a) le due suite
verdi; (b) i gesti provati a mano da Giacomo (§4, e da lì è uscito un difetto vero); (c)
`PIANO-ZAINO §Z4-bis` e questo file aggiornati; (d) `main` ferma, riverificata al momento, non
ricordata.

⚠️ Il prossimo lavoro parte da un ramo nuovo (`git switch -c <nome>`), e la condizione «`main`
ferma» va **riverificata** allora: una sessione parallela l'ha già mossa una volta.

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

## 2-bis. ⌘ tenuto premuto = forbici momentanee

Sempre dalle prove a mano: «il bottone delle forbici in barra è scomodo». Adesso sul documento (e
sul fermo immagine del player) basta tenere premuto **⌘** — `metaKey || ctrlKey`, quindi ⌃ su
Windows senza un secondo gesto da imparare: il puntatore passa a croce, il trascinamento ritaglia,
mollato il tasto torna la selezione del testo.

Non è una scorciatoia per accendere il modo, è **un modo che dura quanto il dito**: le forbici
appiccicate si possono dimenticare accese — succede all'utente, che crede di selezionare testo e
disegna un rettangolo, ed è successo alle prove, dove `partiPulito` deve spegnerle apposta. Il
bottone in barra resta per chi fa dieci ritagli di fila, e il suo suggerimento ora nomina ⌘.

⚠️ **Il cursore e il bottone dicono cose diverse, apposta**: il cursore segue `albumForbici()`
(appiccicato OPPURE ⌘), il bottone solo il modo appiccicato. Premendosi da sé, mollato ⌘ tornerebbe
su — e un comando che si accende e si spegne da solo non si capisce più chi lo comanda.

⚠️ **E i tasti da soli non bastano.** Misurato con una sonda, non indovinato: premendo ⌘ la finestra
perde il fuoco per un istante — su macOS quel tasto è la porta della barra dei menu — e il `blur`
spegneva il modo appena acceso. Con ⌥ non succedeva: la stessa prova, verde con ⌥, è diventata rossa
cambiando tasto. Il rimedio non è togliere il `blur` (serve al ⌘-Tab vero): **ogni evento del mouse
porta con sé lo stato dei modificatori**, quindi lo stato si riconcilia da `pointermove` e
`pointerdown` e si ripara da solo qualunque evento di tastiera si sia perso. Regola generale: per
un modo tenuto da un modificatore, la verità è la mano — non la memoria di che cosa è stato premuto.

Gesti provati a mano da Giacomo il 14 sera: ⌘+trascinamento ritaglia, mollato torna la selezione,
⌘S in un appunto non accende niente.

## 2-ter. Le foto entrano nel vault (F1) — ramo `foto-album`

Le immagini che l'utente porta dentro da fuori sono una popolazione nuova accanto ai ritagli. In uno
zaino si trascinano sulla finestra — `.jpg .png .gif .webp .heic` — ed entrano nell'archivio del
contenitore con la loro miniatura; da lì si trascinano in una mappa o in un appunto, che è il
trascinamento che c'era già. Il dettaglio sta in [PIANO-FOTO.md](PIANO-FOTO.md); qui la sostanza:

**Un archivio solo, due viste.** `ALBUM/` e `_album.json` restano uno; le voci dichiarano `origine`
(`ritaglio` · `foto`) e i due strumenti sono due **filtri**. «Album» si chiama adesso **Ritagli** —
lì dentro finiscono anche i fermi immagine del player — e la chiave resta `album`, o le disposizioni
salvate perderebbero il blocco.

**L'identità di una foto sono i suoi byte**: la stessa immagine due volte non fa due voci, comunque
si chiamasse il file la seconda volta.

⚠️ **Il formato lo dicono i byte, non il nome** — un `.png` che dentro è un JPEG è un file normale.

⚠️ **L'orientamento EXIF è la trappola che si sarebbe pagata dopo**: `<img>` raddrizza da sé, un
`canvas` no. Senza ricodificare, un ritaglio fatto su una foto da telefono avrebbe preso l'area
ruotata di novanta gradi — e sarebbe sembrato un difetto del ritaglio. Ricodificando, l'orientamento
entra nei pixel e i metadati GPS restano fuori dal vault.

⚠️ **Ma non tutto passa dal canvas**: una GIF ne uscirebbe come un fotogramma solo.

⚠️ **La miniatura non è un vezzo**: una card è alta 104px, e una foto da dodici megapixel dentro
quel francobollo è una decodifica intera per niente.

⚠️ **E `mini` è un percorso, non un data URL**: chi salva passa i due con lo stesso nome di campo, e
senza validazione il data URL finiva scritto nell'indice come se fosse un file. Trovato dalla prova
mentre la si scriveva — stessa forma della difesa già in piedi sul campo `file`.

Prove nuove: `test/foto.js` · `test/heic.js` (unità, ora **31** file) e `test/cdp/prova-foto.js`
(**37** prove sull'app viva), registrata DENTRO `PROVE=(`.

⚠️ E la prova rimette a posto **modalità e banco**: senza, `prova-modo` e `prova-evidenze-pdf`
diventavano rosse perché si ritrovavano uno zaino attivo. *Una prova lascia il banco come l'ha
trovato* — terza volta che si paga, e stavolta con un sintomo che non c'entrava niente col colpevole.

## 2-quater. Il visualizzatore delle immagini (F2 e F2-bis) — 15 agosto

Un'immagine dell'Album Foto si apre nel riquadro (doppio click o «Apri l'immagine…») e si guarda con
la **stessa grammatica delle fonti**; ⌘ tenuto premuto ritaglia. È la **seconda faccia** dello stesso
strumento — o la griglia, o un'immagine — non un blocco in più del banco.

Mettendo una foto in un appunto o in una mappa, l'immagine entra subito e una bolla offre «solo una
parte…»: si apre il visualizzatore con le forbici già accese, e il ritaglio **prende il posto**
dell'intera. Le quattro porte dell'inserimento passano tutte da una funzione sola.

⚠️ **Gli osservatori si registravano prima che il markup esistesse**, e valeva anche per lo zoom
delle fonti del giorno prima: l'inline sta in cima al corpo, i riquadri in fondo, e
`getElementById` torna `null` **in silenzio**. Regola: un ascoltatore su un elemento di pagina si
attacca a documento pronto, come già facevano il player e il TTS.

⚠️ **`scrollbar-gutter:stable`**: adattare alla larghezza fa comparire la barra, che si porta via
quindici pixel, che cambiano la larghezza utile, che rifà la scala, che fa sparire la barra.
Misurato: 694px dentro 679. Si riserva il posto invece di inseguirlo.

⚠️ **Trappola di metodo**: `await` su una promessa che si risolve solo quando un modale è stato
compilato blocca la prova per sempre — dieci minuti di silenzio, perché a compilarlo era la riga
dopo.

Prove: la sezione del visualizzatore e quella dell'inserimento in `prova-foto.js`;
`MappaModifica.sostituisciImmagine` in `test/modifica.js`; la scala per modo e il punto fisso in
`test/zoom-fonte.js`.

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

## 4-bis. I gesti da provare a mano sulle FOTO (quello che manca per unire `foto-album`)

1. In uno zaino, trascina sulla finestra **un `.jpg` da telefono ruotato**: entra **dritto**.
2. Trascina un **`.heic`**: entra convertito (e nell'archivio non resta l'originale).
3. Trascina una **GIF animata**: nella griglia si muove.
4. Trascina **lo stesso file due volte**: una card sola.
5. Trascina **un PDF e un'immagine insieme**: il PDF va nelle fonti, l'immagine nell'Album Foto.
6. Trascina un **`.txt`**: te lo dice, col motivo.
7. In un **corso** «Album Foto» non compare nella tendina; «Album» adesso si chiama **«Ritagli»** e
   contiene i ritagli di prima.
8. Trascina una foto **dentro un appunto** e **dentro una mappa**: compare.
9. Dal menu di una foto, **«Alla fonte» è spenta** e dice perché; **«Rinomina la didascalia»**
   funziona.

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
