# Handoff definitivo — 10 agosto 2026

> 📍 **Storico.** Il punto d'ingresso è **sempre** l'`HANDOFF-DEFINITIVO-*` con la data più alta
> — oggi [23 agosto 2026](HANDOFF-DEFINITIVO-2026-08-23.md), che porta in §9 la mappa di tutta
> la catena.
> Qui resta: il riassunto della giornata del 10 agosto: rimandi fra lezioni, ritentativi, costi,
> viewer pdf.js, album, memorie del banco.

> **A chi arriva adesso.** Questo file basta. Raccoglie tutto il lavoro della giornata, le decisioni
> che vanno rispettate e **tutto quello che resta aperto**. I due file di sessione
> ([mattino](HANDOFF-SESSIONE-2026-08-10.md) · [secondo giro](HANDOFF-SESSIONE-2026-08-10-b.md))
> restano come verbale, ma il punto di ripartenza è questo. [HANDOFF.md](HANDOFF.md) è più vecchio e
> più largo: vale per le parti del progetto che qui non si nominano.
>
> **Regola di lettura**: dove c'è ⚠️ c'è un **guasto già pagato** — successo davvero, misurato, con
> il rimedio accanto. È la parte utile.

---

## 1. Stato

`npm test` → **2010 controlli verdi su tredici suite**. `./test/cdp/con-vault-di-prova.sh` → **undici
prove sull'app viva**, verdi.

```bash
cd "/Users/giacomomeschini/Claude/StudIA/StudIA" && npm test
./test/cdp/con-vault-di-prova.sh                  # tutte le prove sull'app viva
./test/cdp/con-vault-di-prova.sh prova-pdf.js     # una sola
```

| suite | | suite | | suite | |
|---|---:|---|---:|---|---:|
| roundtrip | 915 | evidenze | 123 | figure | 32 |
| mappe | 187 | grafo-focus | 74 | mappa-immagini | 55 |
| modifica | 229 | disegna-fonti | 33 | album | 124 |
| appunti-rinomina | 94 | genera-concetti | 96 | ritentativi | 32 |
| | | | | costi | 16 |

Prove sull'app viva: `prova-b1` · `prova-b2` · `prova-menu` · `prova-keyword` · `prova-mappe-ui` ·
`prova-topbar` · `prova-wikilink` · `prova-pdf` · `prova-album` · `prova-memorie` · `prova-tendine`.

⚠️ Le prove **non toccano niente di tuo**: l'istanza di prova ha una cartella dati sua
(`--user-data-dir`) e lavora su una copia magra del vault. StudIA può restare aperta mentre girano.

---

## 2. I due fatti che spiegano metà di questo file

**Una lezione ha due nomi.** La **base** (`04-delegation`) e la **cartella-variante** che la contiene
davvero (`04-delegation--scaletta-a`). La base è l'identità stabile; quale variante si legge lo
decide il percorso attivo. Sul disco di una lezione variantizzata restano **due cartelle**: il
segnaposto della base (solo `_lezione.md`, zero capitoli) e la variante coi capitoli. Chi guarda il
disco vede due lezioni; l'app ne carica una (`preload.js`, `if (chapters.length)`).

**Un ritaglio viene da un punto del materiale.** E il punto ha due forme: la **pagina** di un
documento e il **secondo** di un video. Non è la stessa cosa scritta in due modi — una pagina parte
da 1 e non ha decimali, un secondo parte da 0 (il primo fotogramma) e ne ha.

Da queste due frasi discendono cinque dei nove lavori qui sotto.

---

## 3. Le decisioni prese, che vanno rispettate

1. **Il testo cita la base**, mai la variante: quale versione si legge non lo decide il testo.
2. **Rimandi, tendina e ricerca seguono il percorso attivo.** La ricerca cerca **solo** dentro la
   variante selezionata.
3. **Evidenze, mappe e appunti restano nella variante in cui sono nati**, e non migrano. Il confronto
   esatto su `capitoloId`/`lezioneId` è quindi il comportamento giusto, non un difetto.
4. **Una lezione non ancora scritta resta citabile**: il rimando in avanti — la 01 che annuncia la 04
   — è ciò che rende un corso un corso.
5. **«Non lo so» non è «nessuna».** Vale per la cache delle scalette, per `album.usi()`, per ogni
   controllo che non riesce a leggere un file.
6. **Il ritentativo sta il più vicino possibile alla connessione**, dentro gli SDK, mai in
   `provider.completa`.
7. **Le immagini vivono solo sulle mappe personali**, dove la disposizione la fa la mano.
8. **Cinque slot di disposizione, fissi**: il terzo bottone è il terzo bottone, e la mano lo ritrova
   senza leggere.
9. **Il ridimensionamento è sempre proporzionale**: un numero solo, o si deforma uno schema.
10. **Le password dei PDF restano fuori** (decisione esplicita: 55 PDF nel vault, zero cifrati).

---

## 4. Che cosa è stato fatto

### 4.1 I rimandi `[[NN-slug]]` fra lezioni

Erano **8 morti su 38 (21%)** — dentro il corso a varianti, 8 su 10. Cinque punti del progetto
rispondevano a «questa lezione esiste?» guardando il **disco**, mentre la domanda era «il lettore ci
arriva?».

- `lib/percorsi.js`: **due liste**, perché sono due domande. `nomiRimandabili` = che cosa si **può
  citare** (la base, mai la variante; comprende le lezioni non ancora scritte). `nomiRaggiungibili` =
  che cosa si **apre adesso** (solo con capitoli, in sé o in una variante).
- `App/StudIA.html`, blocco puro `@lezioni-puro-*`: `scomponiLezione` · `preferitaFra` ·
  `cartelleScelte` · `risolviLezione`. Ci passano **il rimando, la tendina e la ricerca**: tre idee
  di quale variante sia quella buona sarebbero tre app nella stessa finestra.
- `VAULT_META.base` viene da `lezione_base:` del frontmatter — chi lo **scrive** — prima del taglio
  sul `--`.

### 4.2 Il ritentativo sugli errori passeggeri

- `lib/ai/ritentativi.js`: la manopola, `TENTATIVI = 4`. ⚠️ La stessa cifra vuol dire cose diverse
  nei tre SDK: Anthropic e OpenAI contano le **ripetizioni**, Gemini i **tentativi**. La conversione
  la fa quel file.
- `google.js`: ritentativo acceso (`httpOptions.retryOptions`) più un tetto di tempo che non c'era.
- `claudecode.js`: tentativi dalla manopola comune, e la regex degli errori passeggeri ancorata.
- `provider.js`: `motivoDi()` rimette lo status davanti al messaggio, e un commento lungo spiega
  **perché lì dentro non c'è un ciclo**.

### 4.3 Il registro dei costi

`sommaUso` in un posto solo (`lib/ai/provider.js`), e la proposta d'indice che passa da `registraUso`
come tutti.

### 4.4 La tendina «estendi»

`espandi.destinazioni(lezioni, percorsi)` risponde a «se genero qui, il testo si vedrà?» — e la
risposta la danno i percorsi, non il conteggio dei capitoli. `main.js` accetta anche le varianti al
cancello (`lezioneDelPiano`), il wizard costruisce la sua lista dalle destinazioni, e l'etichetta
dice titolo + variante invece del nome cartella. Misurato: **14 righe ambigue → 7**.

### 4.5 Il viewer pdf.js

**Disegna davvero**, contando i pixel: pagina 3 → 148 campioni di inchiostro su 5246, pagina 1
montata ma fuori vista → 0. Documento vero di 266 pagine, aperto in 272 ms.

**Zoom**: la percentuale è la scala vera del viewer, mai un contatore parallelo; il click sul numero
alterna larghezza ↔ pagina intera; il livello si ricorda. **Ricerca**: passa dal `PDFFindController`,
che è l'unico modo di **evidenziare** invece di contare. ⌘F sceglie fra le due ricerche in base a
dove sta il fuoco; Esc chiude **una cosa per volta**.

### 4.6 L'album dei ritagli

Forbici nella barra dell'anteprima, si trascina un rettangolo, esce un'immagine in
`Corsi/<corso>/ALBUM/`.

⚠️ Il rettangolo si salva in **coordinate della pagina** (o in **pixel del fotogramma** per i video),
mai dello schermo. La prova lo verifica nel modo più diretto: ritaglia **la stessa area a due zoom
diversi** e controlla che non nasca un doppione.

⚠️ L'immagine **non si taglia dalla tela del viewer** — quella è alla scala di schermo e limitata da
`maxCanvasPixels`: si ripassa dal documento e si rende solo quel rettangolo (238 punti → 476 px). Sui
video invece **1:1**: un fotogramma non ha più dettaglio di quello che ha.

**Anche sui video.** ⚠️ La condizione non era «si può disegnare un fotogramma» ma «quella tela si può
ancora **leggere**»: misurato prima di scrivere una riga, un `<video>` `file://` non contamina il
canvas. Se Chromium cambiasse idea, è `prova-album.js` a doverlo dire.

Superficie «Album» come strumento del banco, menu contestuale a sette voci, `![…](album:<id>)` reso
nel testo, `window.vault.reveal` (che **rifiuta tutto ciò che sta fuori dal vault**).

### 4.7 I nodi-immagine sulla mappa

⚠️ Il difetto era **un cavo mancante**: `disegna.js` è puro e chiede l'indirizzo con
`opt.srcImmagine`, che nessuno gli passava — il segnaposto «immagine non disponibile» faceva il suo
mestiere.

Poi la forma: **cornice tolta** (tre lati nudi, a sinistra la sola barra del colore, 4 px come tutte
le card), **misure dal ritaglio** (larghezza dalla card, altezza dal rapporto, `meet`) con un tetto a
cinque volte l'altezza della card — e ci si arriva **stringendo la larghezza**, mai schiacciando
l'altezza. **Ridimensionamento** da due porte: le maniglie agli angoli (solo sul nodo selezionato) e
la voce nel menu. ⚠️ La scala si ricava dalla **distanza dal centro**: qualunque angolo si prenda, il
gesto vuol dire lo stesso.

### 4.8 Le cinque memorie di disposizione

Il problema non erano i cinque slot: era che **guardare e caricare erano lo stesso gesto**, e il
prezzo del guardare era perdere. Tre rimedi:

1. ogni richiamo mette lo stato di adesso nella pila degli annullamenti;
2. **anteprima al passaggio**, disegnata dal renderer vero, così non si preme per ricordare;
3. click = richiama, tasto destro = i verbi che sovrascrivono. Slot **proteggibile**.

⚠️ La pila copiava il solo grafo. Ora l'argomento si chiama `extra` e porta leve **e** memorie, con
la regola scritta: *se un pezzo di stato può sparire con un gesto, o entra lì o quel gesto non è
annullabile*.

### 4.9 Le tendine, il token dei bottoni, la barra degli appunti

Le tendine di blocco, mappa e appunti sono **bottoni che aprono il loro menu** — ma sotto resta il
`<select>` nativo, trasparente: elenco, tastiera e spunta di sistema non si buttano via per un
bottone più bello. Etichetta **fissa** dove il contenuto è scritto altrove (`Quaderno`, `Mappe`),
**viva** dove la tendina è l'unico posto in cui lo si legge (la testata di un blocco).

Token `--tb-*` per i bottoni delle barre: prima la mappa faceva `calc(--ctl-h − 10px)` e gli appunti
un `26px` scritto altrove. ⚠️ Non è `--ctl-h`, che è l'altezza dei controlli grandi.

⚠️ E la barra degli appunti c'è **anche senza appunti**: prima era un vicolo cieco — lo strumento che
serve a cominciare non compariva finché non avevi già cominciato.

---

## 5. I guasti trovati, con la misura

**Della famiglia «una lezione ha due nomi»**

1. Il gestore dei wiki-link cercava la chiave **esatta**: 8 rimandi morti su 38. Non mancava la mappa
   base→variante — c'era già in `cartellePercorso()`, mancava il cablaggio.
2. **Non era il modello a inventare: era la lista a mentire.** Al modello si passavano le *cartelle*
   (14 voci per 7 lezioni, segnaposto compresi). Copiava alla lettera, come gli si chiede.
3. Il controllo che doveva accorgersene diceva **«zero rimandi rotti»**: guardava il disco.
4. Un salvataggio del composer poteva far **sparire sette lezioni su sette** (`cartella: null` scritto
   nel percorso quando la cache delle scalette non c'è). Rotto e silenzioso.
5. L'app **dichiarava finito un corso vuoto**: il conteggio contava le cartelle.
6. La ricerca indicizzava le varianti fuori percorso (latente: una variante scritta per lezione).
7. `open()` del wizard non azzerava `W.piano`/`W.cap`: con cartelle omonime fra corsi, i capitoli
   finivano **nel corso sbagliato** senza un errore.

**Del viewer**

8. `closePops()` chiudeva la ricerca **senza spegnere le evidenziazioni** — ed era la via di chiusura
   più comune (un click sulla pagina).
9. Il debounce **riaccendeva** la ricerca dopo la chiusura.
10. ⌘F faceva **il contrario** di quello che prometteva ogni volta che aprivi un PDF da un link.
11. Esc veniva **rubato** da mappa e barra di selezione (ascoltano su `window` in cattura).
12. «+» **rimpiccioliva** partendo da un adattamento oltre il tetto.
13. La pagina non veniva stretta al documento: `#p=9999` finiva **dentro l'appunto**. pdf.js non
    protesta — torna `false` e stampa in console.
14. Il numero del materiale veniva dalla mappa **globale**: con due corsi che hanno un «01», citavi
    il file di un altro corso.
15. Un rimando `pdf:NN` a un materiale assente non faceva **niente**, mentre la figura lo diceva.
16. Dopo la ✕ restavano comandi inerti e «cita il punto corrente» citava il documento chiuso.

**Dei costi e delle chiamate**

17. `sommaUso` esisteva in **due copie** che elencavano i campi: perdevano `costoUsdDichiarato`,
    quindi tutto ciò che scrivi con Claude Code era registrato a **zero dollari**.
18. La proposta d'indice aveva `costUsd: 0` **cablato**.
19. La regex di `claudecode` cercava `5\d\d` **ovunque nella stringa**: un 400 che nominasse
    `max_tokens: 512` risultava passeggero, e si pagavano tre esecuzioni di un errore deterministico.

**Il filo comune**: quattro volte su cinque il difetto vero era **un elenco di campi o di nomi tenuto
a mano**, che invecchia da solo.

---

## 6. Come è stato lavorato

Tre volte il lavoro è cominciato da una premessa scritta in un handoff, e **tre volte la premessa era
falsa per metà**:

- «il ritentativo esiste solo in claudecode» → due SDK su tre ritentavano già, e un ciclo in
  `provider.completa` avrebbe **moltiplicato** (fino a 18 richieste HTTP per un capitolo);
- «la tendina è il problema» → il cancello vero stava in `main.js`, e la lista che si usa davvero era
  un'altra;
- «i pixel del viewer non sono verificati» → lo erano abbastanza da poterli misurare in dieci minuti,
  e disegnavano.

**La forma di delega che ha funzionato**: quando i sintomi hanno una causa sola, non aprire un
ventaglio di agenti scriventi — riparare una volta e mandare **agenti in sola lettura** a verificare
in modo avversariale e a cercare gli altri casi della stessa famiglia. Quattro dei guasti qui sopra
nessuno li stava cercando.

⚠️ **E la verifica ha corretto me più volte.** Tre volte il rosso era del mio strumento: una soglia
in pixel assoluti, la tela della pagina 1 che essendo fuori vista non si ridisegna, un bottone
nascosto che misura zero. E **tre volte** un apice inverso dentro un commento, dentro un template
letterale mandato via CDP, ha chiuso la stringa a metà: la regola è ora scritta dentro quel commento.

---

## 7. Che cosa resta aperto

### 7.1 L'unico modo rimasto di perdere lavoro dell'utente

**L'identità dei capitoli è `cartella + ordine`** (`…-c03`). Una rigenerazione che ne infila uno in
mezzo sposta gli id di tutti quelli dopo e **stacca evidenze, appunti e nodi-mappa**. È un debito
noto, scritto nei commenti, e dopo oggi è il solo che tocchi dati dell'utente.

### 7.2 Roadmap

1. **La forma delle mappe di corso.** 65.158 × 358 px non è una mappa, è un nastro: il motore Albero
   apre a ventaglio centinaia di concetti sullo stesso livello. Serve una decisione — un motore che
   impagina su più righe (Anelli, o la serpentina del Percorso) oppure una soglia più alta di
   fabbrica per la scala di corso. **Va prima di G3**, o si aggiungono verbi a una mappa che non si
   può guardare.
2. **G3**: i verbi sugli archi dal modello, con l'enum di `relazioni.js`.
3. **Il ripasso** (AREA 3 di PIANO-BRAYNR). Le carte esistono già — quiz e glossario di ogni capitolo
   — ma lo stato di apprendimento vive **solo in memoria** e si azzera a ogni `loadLesson`
   (`App/StudIA.html`): nessuna cartella `RIPASSO/` esiste, e il lavoro sull'apprendimento si perde
   ogni sera.
4. **B3**, la fonte a schede (`PIANO-BANCO.md:186`): il viewer fa funzionare **un** documento, B3 ne
   mette **più d'uno** come linguette nello stesso blocco.
5. ~~**B4**~~ — **cade**: nasceva per svuotare una topbar affollata, e la topbar è una riga sola.

### 7.3 Del viewer pdf.js

- **PDF protetto da password**: vicolo cieco, nessun `onPassword`, messaggio in inglese. ⚠️ Misurato:
  la password servirebbe a **tre porte** — il lettore, `ingest.py` (pypdf) e Chandra (`ocr.py`,
  pdfium, che non riesce nemmeno ad aprire il file). Fuori scope per decisione: 55 PDF nel vault,
  zero cifrati.
- **Il documento non si chiude** quando «fonte» esce dal banco o si cambia corso: resta un documento
  intero in memoria per ogni pannello parcheggiato. Manca il gemello di `bancoSincronizzaMappa`.
- **Tema scuro**: il CSS vendorizzato reagisce a `prefers-color-scheme`, non al nostro `data-theme`,
  e a `PDFViewer` non passiamo `pageColors`: pagina bianca dentro un'app nera.
- **Stampa del PDF** impossibile dall'app (⌘P è intercettata e conosce solo appunti e mappe).
- Non provati: **selezione col mouse e allineamento del layer di testo** ai glifi (è la promessa su
  cui poggia il ritaglio), scorrimento a mano, ridimensionamento del riquadro, e il ritorno di
  «fonte» dal magazzino del banco.

### 7.4 Dell'album

- La bolla dopo il ritaglio propone «metti nell'appunto / nella mappa»: quelle due strade sono
  provate solo nei loro pezzi, non nel **gesto intero**.
- Non si ritaglia **a mano libera**, e un rettangolo disegnato **non si aggiusta**: si rifà.

### 7.5 Dei costi

- `chiamate` conta le invocazioni di `completa()`, **non le richieste HTTP**: con gli SDK che
  ritentano, la colonna può sbagliare fino a 3×. Il numero vero da questa parte non ce l'ha nessuno:
  è una sottostima **dichiarata** nel codice, non un difetto da tappare.
- La **stima a priori** è calcolata su una chiamata sola per capitolo, mentre `genera` ne fa due.

### 7.6 Piccole, e sapute

- Il nome dell'appunto aperto ora vive **solo nel tooltip** (l'etichetta dice «Quaderno»). Il posto
  naturale per rimetterlo in chiaro è un chip accanto al bottone, come già fa `#noteWhere`.
- `main.js` (`plan:approve`) riscrive il `_lezione.md` di **ogni** base a ogni riapprovazione,
  `ordine_capitoli` e `status` compresi.

### 7.7 Che cosa NON è un debito, per quanto sembri

⚠️ **Le misure per nodo nei motori di layout.** Un nodo-immagine può essere alto il triplo di una
card e i motori non lo sanno. Ma i nodi-immagine vivono **solo sulle mappe dell'utente** — regola
imposta dal codice: `mappaNodoImmagine` è l'unica porta che li crea e sulla mappa generata rifiuta
dicendolo, `genera.js` non emette mai `immagine`, e c'è un controllo sull'app viva che lo tiene
fermo. Insegnare le misure per nodo a quattro motori vorrebbe dire riscrivere la geometria su cui
poggia tutto il disegno **per un caso che non si presenta**.

⚠️ **Il confronto esatto su `capitoloId`/`lezioneId`** per evidenze, mappe e appunti. È la decisione
3, non una svista.

---

## 8. Dove sta il codice

```
lib/percorsi.js              nomiRimandabili · nomiRaggiungibili · scomponi — il vocabolario base/variante
lib/espandi.js               wikilinkRotti · destinazioni — «ci si arriva», non «esiste sul disco»
lib/album.js                 i ritagli: punto (pagina o secondo), identità, usi, rimozione
lib/mappe.js                 il documento mappa + le cinque memorie di disposizione
lib/ai/ritentativi.js        la manopola dei tentativi, e la conversione fra le unità dei tre SDK
lib/ai/provider.js           sommaUso · motivoDi · e perché NON c'è un ciclo di ritentativi
lib/ai/google.js             opzioniClient(): il ritentativo che a Gemini non arriva da altrove
lib/reader-parser.js         estrae dal renderer VERO i blocchi puri, per provarli in Node
main.js                      lezioneDelPiano · registraUso · file:reveal (dentro il vault)
App/assets/mappa/modifica.js copiaImmagine · ridimensionaImmagine · pila con `extra`
App/assets/mappa/disegna.js  nodo-immagine: misure dal ritaglio, barra a sinistra, maniglie d'angolo
App/StudIA.html              @lezioni-puro-* · PDFZOOM/PDFFIND · ALBUM · memorie · tendinaViva · token --tb-*
```

Prove sull'app viva più recenti: `prova-wikilink` (il click su un rimando) · `prova-pdf` (i pixel
contati sulla tela) · `prova-album` (il trascinamento vero, e lo stesso ritaglio a due zoom) ·
`prova-memorie` (la scena dei cinque slot) · `prova-tendine` (i bottoni e il token).

---

## 9. Le trappole del mestiere, per chi continua

- **Una prova che scavalca la porta vera passa mentre la funzione è rotta.** Un evento sintetico
  mandato su un elemento salta il rilevamento del bersaglio; una funzione chiamata a mano salta la
  validazione che la avvolge.
- **Una soglia assoluta in una prova racconta la macchina su cui è stata scritta.** Si confronta con
  la misura di prima, non con un numero.
- **Misurare mentre il disegno è in volo dà un numero di passaggio.** Si aspetta la quiete.
- **Un test instabile è peggio di uno che manca**: insegna a ignorare il rosso.
- **Niente apici inversi nei commenti che finiscono dentro un template letterale.**
- **Se un pezzo di stato può sparire con un gesto, o entra nella pila degli annullamenti o quel gesto
  non è annullabile** — e soprattutto il messaggio non deve promettere un ⌘Z che non c'è.
- **Un elenco di campi tenuto a mano invecchia da solo.** Quattro guasti di oggi nascono da lì.
