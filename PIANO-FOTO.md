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

### F2 — il visualizzatore
Si apre **al momento dell'inserimento** in un appunto o in una mappa — è lì che serve la domanda
«tutta l'immagine o una parte?» — e dal menu contestuale di una card. Zoom col ciclo `⟷`/`⤢` e
⇧+rotella sotto il puntatore, come le fonti: `App/assets/fonti/zoom.js` si riusa tutto tranne una
cosa — lo scorrimento che tiene il punto sotto il puntatore, che per i PDF lo fa
`updateScale({origin})` di pdf.js e qui va rifatto (era `puntoFisso`, tolto dal modulo quando si è
scoperto che pdf.js lo faceva già).

### F3 — il ritaglio sulle foto, e gli usi
⌘ tenuto premuto, come sulle fonti. Tre regole da scrivere:

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
