# Piano — Le immagini dell'utente (Album Foto)

> **A che cosa serve questo documento.** Le immagini che l'utente porta dentro da fuori — foto,
> schermate, disegni — sono una popolazione nuova nel vault, accanto ai ritagli che l'app produce
> da sé. Qui c'è la struttura che regge tutt'e due, che cosa è fatto e che cosa resta.
>
> **La regola di lettura**: dove c'è ⚠️ c'è un guasto già pagato o una trappola misurata.

---

## 1. La struttura: un archivio solo, due viste

`ALBUM/` + `_album.json` restano **uno**. Ogni voce dichiara la sua `origine`:

| origine | che cos'è | identità | ha un punto? |
|---|---|---|---|
| `ritaglio` | un rettangolo preso da un documento o da un fermo immagine | `hash(materiale + punto + rettangolo)` | sì: pagina o secondo |
| `foto` | un'immagine portata dentro dall'utente | **i suoi byte** (`sha1`, dieci cifre) | no |

Gli strumenti del banco sono **due filtri** sulla stessa risposta (`album.elenco(corso, origine)`):
**Ritagli** (in corsi e zaini) e **Album Foto** (solo negli zaini).

**Perché non due cartelle.** Due archivi vorrebbero dire due spazi di identità, **due grammatiche
di rimando** — e `album:<id>` non deve sapere che cosa ha dietro (invariante 7) —, due `usi`, due
voci nell'esportazione. Il nome in tendina è la vista; il disco resta uno.

⚠️ **«Ritagli» e non «Ritagli PDF»**: lì dentro finiscono anche i fermi immagine del player. E la
chiave dello strumento resta `album`, perché è quella scritta nelle disposizioni già salvate —
cambiarla svuoterebbe il blocco a chi l'aveva scelto (stessa ragione di `flashcard` → «Ripasso»).

**L'identità dai byte** dà gratis la regola che i ritagli hanno con `gemello`: la stessa immagine
trascinata due volte non fa due voci, comunque si chiamasse il file la seconda volta.

## 2. F1 — le foto entrano ✅ *fatto il 14 agosto 2026*

Si trascinano immagini sulla finestra **in modalità zaino**: `.jpg .png .gif .webp .heic`. Entrano
nell'archivio del contenitore con la loro miniatura, la didascalia parte dal nome del file (ed è
modificabile subito: «Rinomina la didascalia»), e da lì si trascinano in una mappa o in un appunto —
il trascinamento delle card c'era già e non è cambiato di una riga.

**Dove vive che cosa**

| pezzo | dove |
|---|---|
| formati letti dai byte, tetto delle misure, scarti col motivo | `App/assets/album/foto.js` (UMD, puro) |
| `origine`, identità dai byte, miniatura, viste filtrate | `lib/album.js` |
| HEIC → JPEG | `lib/heic.js` (`sips`) |
| decodifica, EXIF, canvas, griglie | `App/StudIA.html` |

⚠️ **Il formato lo dicono i BYTE, non il nome.** Un `.png` che dentro è un JPEG è un file normale —
basta rinominarlo — e crederci vuol dire scrivere nel vault un'immagine la cui estensione mente.

⚠️ **Perché quasi tutto succede nel renderer.** Il browser sa già fare le due cose difficili:
decodificare e **raddrizzare**. Un JPEG da telefono porta l'orientamento nei metadati EXIF, e
`<img>` lo applica da sé — un canvas no: un ritaglio fatto dopo prenderebbe l'area **ruotata di
novanta gradi**, e sembrerebbe un difetto del ritaglio. Ridisegnandola, l'orientamento entra nei
pixel, i metadati GPS restano fuori dal vault, e dallo stesso passaggio esce la miniatura. Al main
resta il solo lavoro che il browser non sa fare: l'HEIC.

⚠️ **E non tutto passa dal canvas.** Una GIF ne uscirebbe come un fotogramma solo, cioè non sarebbe
più lei; un PNG dentro il tetto non ha niente da guadagnarci. La regola sta in
`AlbumFoto.daRicodificare`, provata in Node.

⚠️ **La miniatura non è un vezzo**: una card è alta 104px, e una foto da dodici megapixel dentro
quel francobollo è una decodifica intera per niente — con cinquanta foto la griglia si pianta. Se
manca si ripiega sull'immagine vera: una foto persa sarebbe peggio di un francobollo mancante.

⚠️ **Difetto trovato dalla prova mentre la si scriveva**: `mini` è un **percorso** dentro `ALBUM/`,
ma chi salva passa un **data URL** con lo stesso nome di campo. Senza validazione quel data URL
finiva scritto nell'indice come se fosse un file. È la stessa difesa del campo `file`: una foglia,
non una strada.

**Le misure, dichiarate e revocabili**: 15 MB per file · lato lungo 3000px · miniatura 480px ·
JPEG a 0,9. L'HEIC si converte e **l'originale non si tiene**: il vault è un archivio di studio,
non un rullino.

**Prove**: `test/foto.js` · `test/heic.js` · la sezione delle foto in `test/album.js` (unità);
`test/cdp/prova-foto.js` sull'app viva. ⚠️ Il trascinamento **dal Finder** non si può simulare —
CDP non consegna i percorsi dei file, e senza percorso non si prova la strada dell'HEIC: quel pezzo
sta in `test/heic.js` e nei gesti a mano, dichiarato invece che finto.

⚠️ **La prova rimette a posto modalità e banco**: senza, `prova-modo` e `prova-evidenze-pdf`
diventavano rosse perché si ritrovavano uno zaino attivo. *Una prova lascia il banco come l'ha
trovato* — è la terza volta che si paga.

## 3. Che cosa resta (in ordine)

### F1-bis — i testi che diventano appunti
Un `.md` trascinato in uno zaino diventa un appunto: è il formato nativo del vault, nessuna
conversione. Da decidere: il frontmatter YAML di un file da Obsidian (tenerlo o spogliarlo), i
`[[wikilink]]` che dentro l'app puntano alle lezioni e possono arrivare rotti, e le immagini con
percorso relativo (che vanno nell'album). Poi, se servirà, `.docx` via `textutil` — dichiaratamente
lossy: immagini, tabelle e impaginazione non arrivano.

### F2 — il visualizzatore ✅ *fatto il 15 agosto 2026*
Un'immagine si apre nel riquadro — doppio click sulla card o «Apri l'immagine…» — e si guarda con
la **stessa grammatica delle fonti**: `⟷` larghezza · `⤢` pagina intera · `NNN%` a mano, ciclo col
click, «+»/«−» e ⇧+rotella sotto il puntatore. ⌘ tenuto premuto ritaglia, come sul documento.

**Non è un blocco in più del banco**: è la seconda faccia dell'Album Foto — o la griglia, o
un'immagine — come la mappa ha i suoi due registri. Da lì lo zoom dinamico eredita gratis il
riquadro che cambia misura.

Il ritaglio di un'immagine ha un punto di tipo nuovo: **`da`**, l'identità della foto madre.
Serviva un tipo suo e non un riuso di `pagina` — il tipo entra nel seme dell'identità, e senza, il
ritaglio a pagina 12 di un PDF e quello preso da una foto potrebbero collidere. «Alla fonte», lì,
riapre la foto.

⚠️ **Gli osservatori si registravano prima che il markup esistesse** — l'inline sta in cima al
corpo, i riquadri in fondo — e `getElementById` tornava `null` in silenzio: niente «immagine
pronta», niente `ResizeObserver`, cioè un'immagine che non si adatta mai senza un errore da nessuna
parte. Valeva anche per lo zoom delle fonti. Ora si aspetta il documento.

⚠️ **`scrollbar-gutter:stable`**: adattando alla larghezza compare la barra verticale, si porta via
quindici pixel, la larghezza utile cambia e la scala andrebbe rifatta — e rifacendola la barra
sparisce. Misurato: immagine 694px in un riquadro da 679. Riservare il posto rompe l'anello
all'origine, invece di inseguirlo con un'isteresi.

⚠️ **`page-fit` non ingrandisce mai**: una foto da 200px sgranata a tutto schermo non è «adattata»,
è rovinata. «Alla larghezza» invece riempie — è un comando esplicito, e fa così anche su un PDF.

`FontiZoom.puntoFisso` è tornato (con la sua prova): sui PDF lo scorrimento sotto il puntatore lo fa
`updateScale({origin})`, ma sotto un `<img>` non c'è nessuno che ci pensi.

### F2-bis — la domanda al momento dell'inserimento ✅ *fatto il 15 agosto 2026*
Mettendo una foto in un appunto o in una mappa, l'immagine entra **subito** e una bolla chiede: «va
bene tutta» o «solo una parte…». La seconda apre il visualizzatore con le forbici **già accese**, e
il ritaglio **prende il posto** dell'immagine intera.

**La domanda arriva dopo, non prima**: chiederlo prima metterebbe un bivio davanti a un gesto oggi
immediato, e lo farebbe pagare a chi voleva davvero tutta l'immagine — il caso normale.

Le quattro porte (due voci di menu, due trascinamenti) passano tutte da `albumInserisci`: la domanda
si fa in un posto solo, o resterebbe una porta che non la fa.

⚠️ Nell'appunto si cerca la **stringa scritta**, non «l'ultima riga»: fra l'inserimento e il
ritaglio si può aver scritto altrove. Se non c'è più, non si inventa niente — si dice che il
ritaglio è nei Ritagli. Il ripiego cerca il solo `(album:<id>)`, che una rinomina non cambia.

⚠️ Un nodo con una foto **non prende più un rimando**: `materiale`, per un'immagine portata dentro,
è il nome del file da cui è entrata, non un documento — un rimando lì sopra prometterebbe di
riportare da qualche parte senza riportarci.

`MappaModifica.sostituisciImmagine` è il verbo nuovo, puro e provato: conserva la `scala` del nodo,
che è la misura data a mano a quel riquadro.

### F2-ter — quanto è larga, dentro un appunto ✅ *fatto il 18 agosto 2026*
Il tasto destro su un'immagine **nell'anteprima dell'appunto** apre il suo menu: «Mostra
nell'album», e una riga `−  com'era  +` per la larghezza. La misura si scrive nella
**didascalia** — `![Il panorama|60%](album:9f2c…)` — ed è una **percentuale della colonna**.

⚠️ **Il difetto vero era un altro, e stava sotto**: le regole di stile delle figure erano
agganciate a `#content`, cioè al lettore. La stessa `renderNoteMd` disegna figure in tre posti —
capitolo, foglio di stampa, e da ieri l'anteprima dell'appunto — e là dentro non arrivava
**nessuna** di quelle righe, nemmeno il tetto: una foto importata (lato lungo fino a 3000px, §2)
si disegnava a 3000px e sfondava il riquadro. Adesso le regole sono di classe (invariante 8), e
il tetto vale ovunque una figura compaia. La percentuale è ciò che si aggiunge sopra, non il
rimedio.

⚠️ **Perché la misura sta nell'alt e non nel rimando.** `(album:<id>)` deve restare identico
carattere per carattere: `album.usi` lo cerca per sapere in quanti posti un'immagine è citata (§F3
qui sotto), e `fotoSostituisciInserimento` per far prendere al ritaglio il posto della foto
intera. E la barra è la convenzione di **Obsidian** per la stessa cosa: dove un modo di dirlo
esiste già, non se ne inventa un secondo. Una misura è una proprietà di *come si vede lì*, non di
*da dove viene*: la stessa foto in due appunti può essere larga in modi diversi.

⚠️ **Percentuale della colonna, non della misura naturale.** Con la misura naturale il gesto non
farebbe niente proprio nel caso che lo fa nascere: 80% di 3000px è ancora più largo della colonna,
e l'immagine resterebbe identica mentre il menu dice che è cambiata.

⚠️ **A misura assente non si scrive `|100%`.** Un campo scritto per dire «normale» sporca il file
dell'utente — stessa regola con cui `mappa/modifica.js` cancella `scala` a 1. E 100% **non** è
«come viene»: è un comando esplicito che riempie la colonna, come «alla larghezza» sulle fonti.

**Il gesto è quello della mappa**, non un secondo dialetto: passo ×1,25, menu che resta aperto,
percentuale in testa che si riscrive a ogni passo (`mappaRidimensionaImmagine`). Solo le immagini
**dell'album**: il rimando di una figura di capitolo (`fig:03#p=7&i=2`) dal DOM non si ricompone
com'era scritto — l'`&` passa dall'escape e l'`i=1` può essere sottinteso — e riscrivere il file
dell'utente indovinando la stringa da cercare è il modo di non trovarla. Il tetto e una misura
scritta a mano valgono per tutte lo stesso.

| pezzo | dove |
|---|---|
| leggere **e** scrivere `\|N%` | `App/assets/lettura/misura.js` (UMD, puro) |
| dalla misura alla figura | `lettura/capitolo.js` (`_misuraVeste`, `albumHtml`, `figuraHtml`) |
| il vestito, e il tetto per tutti | `App/StudIA.html` (`.figura`, `.figura.misurata`) |
| sulla carta | `App/assets/stampa/foglio.js` |
| menu, gesto, riscrittura del blocco | `App/StudIA.html` (`figMenuApri`, `figRidimensiona`) |

**Prove**: `test/misura-immagini.js` (la grammatica, 41 controlli) · la sezione nuova di
`test/figure.js` · due controlli in `test/stampa-foglio.js` · `test/cdp/prova-misura-immagine.js`
sull'app viva — dove si misura che l'immagine **non** sia più larga della colonna, che è il
difetto da cui è nato tutto.

### F3 — gli usi, e le lapidi
Il ritaglio sulle foto è entrato con F2. Restano tre regole:

1. **il ritaglio di un ritaglio** si ancora sempre all'immagine **originale**, componendo i
   rettangoli: una catena renderebbe orfano il figlio quando si cancella l'anello di mezzo;
2. **cancellare una foto che ha figli** è permesso, e i ritagli sopravvivono **dicendo** che la
   fonte non c'è più — la regola delle lapidi (`MATERIALI/_rimossi.json`), non il silenzio;
3. **il click su un'immagine usata in più posti** non segue una regola cablata ma **chiede
   all'indice degli usi** (`album.usi`, che esiste già): un uso → ci si va; più usi → si sceglie da
   un elenco; nessun uso → si va alla sua scheda. Così non cambia niente quando gli usi diventano
   dieci.

Un ritaglio fatto durante l'inserimento e poi non inserito **resta** in Ritagli: è un'immagine che
l'utente ha fatto, e buttarla via perché ha cambiato idea sarebbe una perdita silenziosa.
