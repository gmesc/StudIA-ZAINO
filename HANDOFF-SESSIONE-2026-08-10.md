# Handoff di sessione — 10 agosto 2026

> 📍 **Storico.** Il punto d'ingresso è **sempre** l'`HANDOFF-DEFINITIVO-*` con la data più alta
> — oggi [23 agosto 2026](HANDOFF-DEFINITIVO-2026-08-23.md), che porta in §9 la mappa di tutta
> la catena.
> Qui resta: le mappe generate a **concetti** (G1–G2), la topbar su una riga, le figure dentro
> il capitolo, il viewer pdf.js e l'album su disco.

> **A chi arriva adesso.** Questo file racconta **una giornata di lavoro**. Il punto di ripartenza
> generale del progetto resta [HANDOFF.md](HANDOFF.md), che è più vecchio e più largo; la sessione
> precedente sta in [HANDOFF-SESSIONE-2026-08-09.md](HANDOFF-SESSIONE-2026-08-09.md) e va letta
> prima se non conosci le mappe personali e il banco.
>
> Regola di lettura: dove c'è ⚠️ c'è un **guasto già pagato**. Non sono avvertenze generiche: sono
> cose successe davvero, misurate, con il rimedio accanto. Sono la parte più utile del file.
>
> ⚠️ **Questo file è un verbale, non il punto di ripartenza.** Per ripartire c'è
> [HANDOFF-DEFINITIVO-2026-08-10.md](HANDOFF-DEFINITIVO-2026-08-10.md), che raccoglie tutta la
> giornata e tutto ciò che resta aperto.
>
> ⚠️ **Il §7 qui sotto è superato.** Nello stesso giorno c'è stato un secondo giro —
> [HANDOFF-SESSIONE-2026-08-10-b.md](HANDOFF-SESSIONE-2026-08-10-b.md), i rimandi fra lezioni — che
> ha riscritto l'ordine dei prossimi passi e ne ha aggiunti due. Il resto di questo file vale.

---

## 1. Stato in due righe

`npm test` esegue **1873 controlli verdi su undici suite**, e le **sei prove sull'app viva** sono
verdi. Le mappe generate parlano di **concetti** e non più di contenitori; i capitoli sanno mostrare
le **figure** ritagliate dai documenti; il PDF non sta più dentro un `<iframe>`.

```bash
cd "/Users/giacomomeschini/Claude/StudIA/StudIA" && npm test
./test/cdp/con-vault-di-prova.sh        # le prove sull'app viva
```

| suite | controlli | | suite | controlli |
|---|---:|---|---|---:|
| roundtrip | 875 | | grafo-focus | 74 |
| mappe | 180 | | disegna-fonti | 33 |
| modifica | 212 | | appunti-rinomina | 87 |
| evidenze | 123 | | genera-concetti | 96 |
| figure | 32 | | mappa-immagini | 50 |
| album | 111 | | | |

---

## 2. Come si provano le cose ADESSO (è cambiato, e cambia la giornata)

Le prove sull'app viva **non toccano più niente di tuo**. L'istanza di prova parte con
`--user-data-dir` su una cartella temporanea: config, preferenze e `localStorage` sono suoi, il
vault è una copia magra (23 GB → ~5 MB, senza `MATERIALI/` e `_lavorazione/`), e alla fine si butta
via tutto. **Non c'è più niente da ripristinare, che è il modo più sicuro di ripristinare.**

Conseguenza pratica: **StudIA può restare aperta e lavorare** mentre le prove girano — `main.js` non
ha un lock di istanza singola. Prima lo script scambiava la config vera e la rimetteva a posto con
un `trap`: un `kill -9` la lasciava puntata a un vault temporaneo poi cancellato.

⚠️ La rete non è nello script ma **dentro la prova**: `prova-mappe-ui` chiede all'APP dove sia il
vault (`window.vault.vaultPath`, esposto ora) e **si ferma prima di creare qualunque cosa** se non è
la copia. È la trappola ⑧ chiusa alla radice invece che ricordata.

⚠️ E il cambio ha subito mostrato che **due prove leggevano di nascosto il profilo dell'utente**:
davano per scontato l'ordinamento delle parole chiave rimasto da ieri, e «l'ultima evidenza del
file» invece di «quella appena creata». Con un profilo pulito sono cadute — e sotto c'erano due
guasti veri (§5.6 e §5.7). **Un test che eredita lo stato di chi lo lancia non prova quello che dice
di provare.**

Le prove: `prova-b1` · `prova-b2` · `prova-menu` · `prova-keyword` · `prova-mappe-ui` (47) ·
`prova-topbar` (nuova). Il pilota `test/cdp/cdp.js` ha due aiutanti nuovi: `apriStrumento(nome)` e
`partiPulito()`.

---

## 3. Che cosa è stato fatto

### 3.1 Le mappe generate cambiano oggetto: dai contenitori ai concetti (G1 · G2)

I nodi sono **concetti presi dai paragrafi** — i grassetti dell'autore, i micro-titoli `**Così.**`,
le voci di glossario che danno definizione e identità — e non più «Punti chiave», «Note e
materiali», «Glossario», che mappavano *come il capitolo è confezionato*. `App/assets/mappa/genera.js`
espone ora `estrai(cap,opt)`, `daLezione`, **`daCorso`**; `daCapitolo` resta intatta perché 23
controlli e chi la chiama ci contano.

**Due scale, non tre** — decisione dell'utente, e cambia il §13.4 punto 1 del piano mappe: **del
capitolo non si genera più niente**. Quella mappa la fa lo studente, scegliendo lui che cosa
metterci. `MAPPA.ambito` vale `corso` o `lezione`, e un `capitolo` rimasto in una config vecchia
viene **corretto**, non solo mostrato male.

Misurato su TD74-DSA (210 capitoli, 16 lezioni):

| | |
|---|---|
| concetti distinti dopo la fusione | **2.405** |
| ponti in ≥2 lezioni · ≥3 · ≥5 | **210 · 65 · 11** |
| legami | 2.751 co-occorrenza · 605 definizione · 229 micro-titolo |
| nodi di `daCorso` a soglia 2 / 3 / 5 | 353 / 272 / 220 |

⚠️ Le misure del §13.3 del piano (193 ponti, *memoria di lavoro* in 9 lezioni) contavano **anche i
1.503 grassetti dentro i punti chiave**; qui la materia prima sono i soli paragrafi. La differenza è
di conteggio, non di metodo, e si chiude in una riga se un giorno la si vuole chiudere.

### 3.2 L'interfaccia delle mappe

- tendina **Corso · Lezione**;
- **Profondità** (0 = «tutta») e **Ponti fra lezioni** (soglia) nel pannellino ⚙;
- **Metti a fuoco** dal menu contestuale: vicini · sopra e sotto · da dove viene, con Esc che esce
  dal focus prima di chiudere la mappa;
- **Collassa tutto / Espandi tutto** nel menu della tela;
- **evidenziazione al passaggio**: il puntatore su un nodo accende la sua parentela e spegne il
  resto;
- **bolla delle fonti**: un concetto cita più materiali, il pallino li apre per nome;
- **rinomina** e **stampa** della mappa; **⌘P** stampa ciò che si sta guardando.

⚠️ Le tre potature si applicano sempre in quest'ordine: **focus → profondità → rami chiusi**. I rami
chiusi sono una scelta nodo per nodo su ciò che si sta guardando, quindi lavorano per ultimi. E
dentro un focus la profondità conta **dal nodo a fuoco** (`entroProfondita(g,max,{da})`), o lo
slider mangerebbe per primo proprio il nodo appena messo a fuoco.

### 3.3 La topbar su una riga

Tre righe diventano una. «Appunti» e «Mappe» escono dalla barra — sono strumenti del banco e ogni
blocco ha già la sua tendina; le tre tendine dicono la **funzione** («Lezione») e non il contenuto,
che il capitolo scrive già nel suo `.kicker`; A− e A+ stanno in un chip solo; la ricerca è un
bottone che apre un pannellino.

⚠️ Un `<select>` nativo non sa mostrare una scritta diversa dall'opzione scelta. **Non è stato
sostituito**: resta lui a comandare — il suo `value` è quello che tutta l'app legge, e non è
cambiata una riga di logica — ma diventa trasparente e si stende sopra un'etichetta fissa. Elenco,
tastiera e spunta sulla voce corrente restano quelli di sistema; che cosa è scelto lo dice il
`title`. Misurato: i controlli passano da ~2.100px su tre righe a **625px su una**, e la barra sta
su una riga sola fino a 820px di finestra.

### 3.4 Le figure dentro il capitolo (§9 di HANDOFF.md, chiuso)

La metà che mancava è scritta: la sintassi `![didascalia](fig:03#p=7&i=2)` resa come figura
cliccabile che **riusa `openPdf`** (nessun secondo gestore), il campo `figure` nello schema, il
validatore, `mdser`, `rimandiDa` che le raccoglie dal testo, l'offerta al modello dentro `testoFonti`
con le didascalie generate da Chandra, e il conteggio nell'esportazione. Una figura che non c'è **lo
dice** invece di lasciare un buco.

⚠️ `srcUrl` cerca ora anche in `MATERIALI/Figure/`: senza quella riga il capitolo mostrava una
casella vuota e la causa non si vedeva da nessuna parte.

### 3.5 L'album dei ritagli, su disco (pronto, non ancora cucito nell'interfaccia)

`lib/album.js` + `window.vault.album.*` (sincrono e diretto come gli appunti). Le immagini vivono in
`Corsi/<corso>/ALBUM/` — **cartella dell'utente**, non della pipeline: i ritagli di Chandra in
`MATERIALI/Figure/` si rifanno rileggendo, questi no. Seguono l'interruttore degli appunti
nell'esportazione. Il rettangolo si salva in **coordinate della pagina PDF**, mai dello schermo.

⚠️ Due correzioni al disegno concordato, arrivate dalla misura e non dall'opinione:

1. **L'identità non è l'arrotondamento**: qualunque griglia ha dei bordi, e con passo 6 i valori 8,9
   e 9,1 cadono in celle diverse. L'id è il *nome* del ritaglio; a decidere se due ritagli sono lo
   stesso è una **tolleranza** di 6 punti tipografici (2,1 mm sulla pagina — la precisione della
   mano).
2. **`usi()` non può cercare la stringa `album:<id>`**: in un file di mappa fra i due c'è `": "`, e
   la scansione letterale avrebbe dato *zero usi su ogni mappa* — `rimuovi` avrebbe cancellato in
   silenzio un'immagine che una mappa stava mostrando. Cerca l'id delimitato, e rifiuta anche
   quando un file non si è potuto leggere: «non lo so» non è «no».

Un nodo di mappa può **essere** un'immagine (`nodo.immagine = {id,w,h}`), dentro la geometria che i
motori già calcolano. Se la sorgente manca, segnaposto dichiarato: mai un `<image>` senza sorgente.

### 3.6 Il viewer pdf.js (nucleo in piedi, rifiniture da fare)

L'`<iframe>` non c'è più. **La direzione della pagina è invertita**: prima `ANTEPRIMA.page`
comandava l'iframe e si citava quello che l'app *credeva*; ora è `pagechanging` a dirlo, e
`vaiAPagina` non ricarica più niente — sfogliare ottanta pagine erano ottanta ricaricamenti, con la
selezione persa a ogni passo.

Quello che la ricognizione ha misurato, e che va rispettato:

| | |
|---|---|
| versione | **6.2.108**, build legacy (core-js dentro), 86 file, 2,4 MB |
| formato | **ESM**: servono `<script type="module">`, in ordine — `pdf_viewer.mjs` destruttura `globalThis.pdfjsLib` mentre viene valutato |
| contenitore | **due `<div>`**, e quello esterno **`position:absolute`**: `PDFViewer` rifiuta il resto |
| il worker | **non si include come script**: se `globalThis.pdfjsWorker` esiste, pdf.js rende sul thread principale **in silenzio** |
| lettura da `file://` | misurata: PDF vero aperto in **248 ms**, 29 pezzi di testo estratti |
| CSS | 6.348 righe da incapsulare — il suo `.sidebar` **riscriverebbe l'indice dei capitoli** |

⚠️ Il foglio incapsulato lo genera `bin/pdfjs-css.js`, non una modifica a mano: il file è
vendorizzato e si aggiorna ricopiandolo, e una modifica a mano andrebbe rifatta a memoria ogni
volta. I 7 blocchi `:root` diventano `#pdfPane`, perché annidati non corrisponderebbero a niente e
le 46 variabili del viewer sparirebbero tutte. Misurato dopo: la sidebar dell'app resta **274px
`sticky`** invece dei 239px `relative` di pdf.js.

⚠️ Il viewer va **svegliato** quando il suo blocco torna a schermo (`bancoDopoLayout`): pdf.js
decide che cosa disegnare dalle pagine visibili, e un contenitore dentro qualcosa di nascosto non ha
nemmeno un `offsetParent` — la pagina resta in caricamento per sempre, senza un errore.

**Non ancora verificato**: i pixel davvero disegnati. L'anteprima usata per misurare è nascosta,
quindi `requestAnimationFrame` non gira. Va guardato nell'app vera.

---

## 4. Le decisioni prese, che vanno rispettate

1. **Del capitolo non si genera più una mappa.** La fa lo studente.
2. **Gli archi generati nascono muti.** Il campo `rel` c'è ed è vuoto: è la predisposizione per G3.
   ⚠️ Anche i legami di definizione restano muti, contro la concessione del §13.4: misurato, il
   concetto nominato è il genere prossimo **18 volte su 88** — un verbo giusto una volta su cinque
   colora, quindi mente.
3. **Le fonti sono un pallino, non rami** (`fonti:'pallino'` di fabbrica): farne nodi riempirebbe la
   mappa di foglie che non sono concetti, e la mappa smetterebbe di parlare di idee per parlare di
   file. `fonti:'nodo'` resta come leva.
4. **Il nodo porta `capitoloId`, non solo il numero**: su una mappa di corso «capitolo 3» sono
   sedici capitoli diversi. Si passa da `vaiAlCapitolo`, la stessa porta dei rimandi `cap:`.
5. **Il focus non si salva** (è un modo di guardare adesso), **la profondità sì** (è una leva della
   vista).
6. **Nel nome di un appunto il titolo non si sacrifica mai** al taglio dei 90 caratteri: si accorcia
   il contesto, che il frontmatter sa comunque ricostruire.
7. **Chi usa un'immagine dell'album la referenzia, non la copia** (`![…](album:<id>)`), e cancellare
   un'immagine usata non è un'operazione silenziosa.

---

## 5. I guasti trovati (la parte più utile di questo file)

**5.1 `pointerup` rieseguiva l'azione dell'ultimo nodo toccato, da qualunque punto della finestra.**
`MAPPA.giu` sopravvive al rilascio di proposito (serve al doppio click), ma il rilascio è ascoltato
su **tutto il documento** mentre la pressione tornava indietro senza toccare niente quando cadeva
fuori dalla tela. Restava innocuo finché l'azione era idempotente. Sulla bolla delle fonti non lo
era: la bolla si ricostruiva **fra `pointerup` e `mouseup`**, il bottone sotto il dito spariva, e il
`click` non nasceva proprio — si vedeva un menu che non rispondeva. Misurato registrando i grezzi:
`pointerup → BUTTON.ctx-item`, `mouseup → DIV.popmenu`. Ora ogni pressione azzera il bersaglio: è di
quel gesto.

**5.2 `popAt` non limitava mai il verticale.** Finché i pannellini pendevano da un bottone della
barra — sempre in alto — bastava il clamp orizzontale; una bolla che pende da un **nodo** può
nascere in fondo alla tela e finire sotto il bordo della finestra: visibile a
`getBoundingClientRect`, irraggiungibile dal mouse.

**5.3 Le linking word non si disegnavano nel motore Percorso.** Il ciclo delle etichette itera
`res.archi`, ma là dentro c'è il filo numerato (muto) e i legami veri stanno in `res.extra`. Stessa
famiglia del guasto 5.6 di ieri.

**5.4 Il tetto dello zoom era un numero, non una misura.** Era `6` scritto a mano, ma il `viewBox`
rimpicciolisce già la mappa per farla stare nel riquadro. ⚠️ Misurato: la mappa di corso di TD74-DSA
a soglia 2 è un nastro di **65.158 × 358 px**, che in un blocco da 583px il browser riduce a
**0,009×** — col tetto a 6 il massimo ingrandimento valeva il **5% della grandezza vera**. Ora
`mappaZoomLimiti()` lo calcola dal contenuto (tre volte la grandezza naturale) e il passo della
rotella cresce col campo da percorrere.

**5.5 Rinominare un appunto poteva non cambiare il nome del file.** Il nome è
`lezione - capitolo - titolo` tagliato a 90 caratteri **in fondo**: con titoli lunghi il titolo
spariva del tutto, e il gesto sembrava riuscito a metà senza dire perché.

**5.6 Ogni parola chiave salvava UN CARATTERE IN PIÙ di quello evidenziato.** `offsetDaRange` chiede
per ogni carattere `range.isPointInRange(nodo, offset)` — ma quel metodo risponde vero anche sul
**punto di fine** della selezione, e il carattere che comincia lì dentro ci finiva. Misurato:
selezionando venti caratteri se ne salvavano ventuno. Invisibile perché l'evidenza restava
**coerente con se stessa** — prefisso e suffisso allineati al testo sbagliato — quindi si riaccendeva
senza protestare. Le evidenze già salvate restano valide: niente da migrare.

**5.7 Il binario di avanzamento si prendeva i click di ciò che gli finiva sotto.** `.navdots` è un
indicatore — quattro elementi decorativi, nessun gestore — ma è `position:fixed` sul bordo destro,
alto 220px. I tre figli avevano `pointer-events:none`; il padre, che è quello grande, no. Misurato:
il bottone dell'ordinamento delle parole chiave sta a (1292,512), e lì `elementFromPoint` rispondeva
`navdots`.

**5.8 Il link di una figura portava il nome del RITAGLIO invece che del documento.** Cliccarla non
avrebbe aperto niente: `openPdf` avrebbe cercato un PDF che non esiste. Trovato dal test prima che
dallo schermo.

**5.9 Due figure sulla stessa pagina sono due cose diverse.** Con l'identità sulla sola pagina la
seconda spariva dall'elenco pur restando visibile nel testo (`unisciFigure` esiste per questo).

⚠️ **E un falso allarme mio, per memoria**: ho cambiato il tipo di ritorno di `capitoloDi` (da numero
a oggetto) per riusarla in due posti, e ogni legame in più è diventato un cross-link tratteggiato —
`capitoloDi(A) !== capitoloDi(B)` è sempre vero fra due oggetti. Due funzioni separate, `doveDi` e
`capitoloDi`: è la regola «una responsabilità per funzione» applicata al **valore di ritorno**.

⚠️ **E una lezione sulle prove**: una prova che sceglie «il primo nodo del DOM» e ci manda il
puntatore può mirare a un nodo coperto dalla barra degli strumenti. Adesso sceglie il primo che
`elementFromPoint` conferma — cioè il primo che l'utente potrebbe davvero sfiorare.

---

## 6. Dove sta il codice (le cose nuove)

```
App/assets/mappa/genera.js     estrai · daLezione · daCorso — i concetti dai paragrafi
App/assets/mappa/grafo.js      entroProfondita · focus (vicini·parentela·genitori·figli)
App/assets/mappa/disegna.js    pallino multi-fonte · nodi-immagine · etichette anche in Percorso
lib/album.js                   i ritagli dell'utente su disco (+ window.vault.album.*)
bin/pdfjs-css.js               incapsula pdf_viewer.css sotto #pdfPane — si RIGENERA, non si edita
App/assets/pdfjs/              pdf.js 6.2.108 legacy, vendorizzato a mano
test/                          figure · genera-concetti · grafo-focus · disegna-fonti
                               appunti-rinomina · mappa-immagini · album
test/cdp/prova-topbar.js       la barra su una riga, dalla porta principale
test/cdp/con-vault-di-prova.sh cartella dati separata: la tua config non si tocca più
```

---

## 7. Il prossimo passo

1. **Zoom e barra di ricerca del viewer** (il resto dei passi 4-5 del piano), e la verifica dei
   pixel disegnati nell'app vera.
2. **Il ritaglio d'area** con il bubble menu (Album · Mappa · Appunti secondo quello che è aperto),
   la **superficie Album** come strumento del banco, i riferimenti `album:` negli appunti e il menu
   contestuale sull'immagine (Alla fonte · Rivela nel Finder · Rinomina · Copia · Elimina).
3. **G3**: i verbi sugli archi dal modello, con l'enum di `relazioni.js` e l'artefatto per capitolo.
   ⚠️ Prima però va guardata la **forma**: 65.158 × 358 px non è una mappa, è un nastro. Il motore
   Albero apre a ventaglio centinaia di concetti sullo stesso livello. «Collassa tutto» lo rende
   governabile, ma la forma giusta va scelta — un motore che impagina su più righe (Anelli, o la
   serpentina del Percorso), oppure una soglia più alta di fabbrica per la scala di corso.

Restano da prima, e non sono stati toccati: il **ritentativo sugli errori passeggeri** in
`provider.completa` (esiste solo in `claudecode.js`; Anthropic, Google e OpenAI non ne hanno — e
l'incidente documentato è proprio una cascata di 503 di Google), il **ripasso** (AREA 3 di
PIANO-BRAYNR: le carte esistono già, lo stato di apprendimento no), **B3** e **B4**.

⚠️ **B4 va ridiscusso, non eseguito com'è scritto**: nasceva per svuotare una topbar affollata, e la
topbar adesso è una riga sola. Il bisogno resta solo se manca sapere dove si è.
