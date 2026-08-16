# Piano ZAINO — studiare sui propri PDF

> Deciso il 10 agosto 2026. Lo ZAINO è la seconda modalità di StudIA: **carico i miei documenti,
> leggo, e uso gli strumenti**. Nessuna pipeline, nessun modello che scrive, nessun capitolo
> generato. Il corso resta quello che è; lo zaino è l'altra metà della stessa app.
>
> **Regola di lettura**: dove c'è ⚠️ c'è una misura, non un'opinione.

---

## 1. Le decisioni, prese e da rispettare

1. **Uno zaino è l'equivalente di un corso**, e sul disco vive in `Zaini/<id>/`.
2. **Niente OCR di serie.** I PDF sono nativi. Per quelli fotografati c'è il riconoscimento
   **proposto, mai imposto** (12/8/26: fatto, con `tesseract.js` — non più `ocrmypdf`, vedi Z7):
   agisce sulla **copia** nel vault, mai sull'originale dell'utente.
3. **Non esiste una superficie di testo.** Si legge il PDF. Gli strumenti lavorano sul layer di
   testo del viewer.
4. **L'identità di un'annotazione è `materiale + pagina + citazione`**, non `capitolo + ordine`.
   Conseguenza: il debito §7.1 dell'handoff — gli id dei capitoli che slittano — **nello zaino non
   esiste**, perché non c'è niente da rigenerare.
5. **Nello zaino scrive solo l'utente.** La pipeline non ci entra.
6. **Un documento per volta**, e la scelta sta nella **toolbar del PDF**, non nella sidebar.
7. **La sidebar dello zaino ha tre sezioni**: le fonti caricate, gli appunti, le mappe.
8. **La topbar cambia con la modalità.** In ZAINO: `ZAINO` · lente · banco · ⚙ · chiaro/scuro ·
   A−/A+. Spariscono `CORSO`, `PERCORSO`, `LEZIONE`, che non vogliono dire niente qui.
9. **Il logo è il commutatore**, con un'animazione che lo dichiara cliccabile.

---

## 2. Misurato prima di cominciare — `prova-testolayer.js`

Tutto lo zaino poggia su una promessa che l'handoff elencava fra i **non provati**: che il layer di
testo di pdf.js si possa selezionare col mouse e sia allineato ai glifi. Se non lo fosse, gli
strumenti dello zaino non sarebbero costruibili. Misurato sull'app viva, pagina 30 di un documento
vero:

| che cosa | misura |
|---|---|
| pezzi di testo sopra la pagina | 51 |
| misure del layer vs pagina disegnata | 425×601 vs 425×601 |
| doppio click al centro di un pezzo → parola giusta | 3 su 3 |
| trascinamento su una riga | testo continuo, ritrovato in `getTextContent()` della pagina 30 |

⚠️ Il doppio click è la prova dell'**allineamento**, non della selezione: un layer spostato
rispetto ai glifi restituirebbe la parola accanto, o niente. E la selezione si legge con
`range.toString()`, mai con `getSelection().toString()` — quella torna maiuscola quando il CSS lo
impone.

La prova entra nella suite viva (`con-vault-di-prova.sh`), prima di `prova-album.js`.

---

## 3. Il perno: una funzione sola decide dove sta la cartella

Verificato leggendo i tre moduli dei dati dell'utente:

```
lib/appunti.js:23   dir(vault, id) → corsiLib.cartella(vault, id) + '/APPUNTI'
lib/album.js:260    dir(vault, id) → corsiLib.cartella(vault, id) + '/ALBUM'
lib/mappe.js:48     dir(vault, id) → corsiLib.cartella(vault, id) + '/MAPPE'
```

`evidenze.js` passa da `appunti.dir`. Quindi **`corsi.cartella()` è l'unico punto** da cui dipende
dove finiscono appunti, mappe, album ed evidenze.

→ `cartella(vault, id)` risolve `Corsi/<id>` **e** `Zaini/<id>`, con lo stesso `primoCheEsiste()`
che il modulo usa già per tollerare i vault mai migrati da `Progetti/`. Quattro moduli funzionano
nello zaino senza una riga nuova.

⚠️ Il prezzo di questa scelta è che **gli id devono essere unici fra le due radici**: uno zaino e un
corso omonimi punterebbero alla stessa cartella per metà del codice. La guardia va alla creazione,
dove il nome si sceglie — non alla lettura, dove sarebbe troppo tardi.

---

## 4. Sul disco

```
Zaini/<id>/
  _zaino.md                    titolo, creato
  MATERIALI/PDF/               i documenti, COPIATI dentro il vault
  MATERIALI/Indici-PDF/        <file>.json = {pdf, npages, pages:[{page,text}]}
  APPUNTI/                     gli appunti .md + _evidenze.json + _indice.md
  MAPPE/
  ALBUM/
  _lettura.json                per ogni documento: l'ultima pagina guardata
```

⚠️ **`MATERIALI/PDF/` e non `FONTI/`**, per quanto «fonti» sia il nome giusto in italiano: è la
stessa forma di un corso, quindi `materiali.js`, `openPdf`, l'album e i rimandi `pdf:NN#p=7`
funzionano identici. Una cartella con un altro nome vorrebbe dire un secondo percorso nel codice per
ogni cosa che oggi cerca un documento — e i secondi percorsi in questo progetto si pagano due volte.

**L'indice per pagina lo scrive `ingest.py extract_pdf`** (pypdf: nessun modello, millisecondi a
pagina) e **serve solo alla ricerca**: non si mostra mai come testo. Senza, la lente della topbar in
modalità ZAINO non cerca niente.

**La pagina di ripresa sta in `_lettura.json`, dentro lo zaino**, non in `localStorage`: viaggia con
lo zaino e non è la memoria di una macchina. Lo zoom invece resta dov'è (`localStorage`), perché
quello sì è una preferenza dello schermo che si ha davanti.

---

## 5. I lavori, in ordine

### Z1 — Il contenitore ✅ *fatto il 10 agosto 2026*
`lib/zaini.js` (radice, cartella, `_zaino.md`, guardie sul nome, elenco, creazione),
`corsi.cartella()` che risolve le due radici, `zaino:list` / `zaino:create` in `main.js` e
`window.vault.zaino` nel preload.
`test/zaini.js`: **41 controlli**, dentro `npm test`. Fra questi i due che contano — un id omonimo
fra `Corsi/` e `Zaini/` viene rifiutato alla creazione, e un appunto salvato con l'id di uno zaino
atterra in `Zaini/<id>/APPUNTI/` **senza che `appunti.js` sappia che gli zaini esistono**.
⚠️ Un id sconosciuto continua a risolvere sotto `Corsi/`: è il comportamento su cui contano le
funzioni che creano un corso, ed è un controllo a sé.

### Z2 — La modalità ✅ *fatto il 10 agosto 2026*
`html[data-modo="zaino"]`. Il logo è un `<button class="brand">` con `aria-pressed`, il cappello che
si solleva al passaggio del mouse e un battito lento **finché non lo si usa la prima volta**
(`studia.modoUsato`, poi si spegne per sempre). Rispetta `html[data-reduce="1"]`.
La topbar alterna due file di tendine — corso/percorso/lezione ↔ zaino — e nello zaino spariscono
capitolo, indice, contatore e barra d'avanzamento, che contano una lezione. La modalità, lo zaino
attivo e il corso attivo si ricordano **separatamente**: tornando ai corsi si ritrova quello di
prima. Uno zaino si crea dalla card in mezzo allo schermo, che è anche lo stato vuoto.

⚠️ **Il perno lato interfaccia**: `corsoAttivo()` risponde con l'id dello ZAINO quando la modalità è
zaino. È il gemello di `corsi.cartella()` lato disco, e ha la stessa proprietà pericolosa: se si
scollegasse **non si vedrebbe niente di rotto** — si continuerebbe a scrivere nel corso di prima.
Perciò `prova-modo.js` lo controlla per nome.

⚠️ **Trappola pagata, misurata**: `corsoAttivo()` viene chiamata mentre lo script della pagina è
ancora in esecuzione (`lezioniOrdinati` → `lezioniVisibili` → `corsoAttivo`, durante il primo
disegno). Le funzioni si issano, i valori no: un `var MODO = {...}` più in basso vale `undefined` in
quel momento, solleva, e **l'eccezione ferma il resto dello script** — `MATERIALI`, `MODO`,
`VAULT_META` restano tutti indefiniti e l'app parte a metà, senza un errore visibile. Rimedio:
`modoAttivo()` non dà per scontato che lo stato esista, perché la domanda ha una risposta sensata
anche prima che ci sia uno stato — si è nei corsi.

**Rifinito subito dopo**, su osservazione dell'uso:
- via la targhetta «Zaino» accanto al logo — lo dice già la tendina in barra;
- uno zaino si crea dal **«+» accanto alla tendina ZAINO**, che apre un pannellino con un campo
  solo. La card in mezzo allo schermo è stata tolta: viveva dentro `main`, cioè dentro lo strumento
  «Capitolo», e nello zaino quel blocco tiene le fonti — sarebbe stata irraggiungibile. Lo stato
  vuoto vero è la sidebar di Z3;
- **nello zaino «Capitolo» non è in tendina** (`bancoStrumentiOfferti()`, una vista sopra il
  registro, non una seconda tabella), e il banco ha **una disposizione per modalità**
  (`studia.banco.zaino`): entrare nello zaino non riscrive più quella dei corsi. Rete per le
  disposizioni salvate prima: uno strumento non più offerto viene rimappato al caricamento, o
  resterebbe montato e irraggiungibile;
- lo strumento si chiama **«Fonti»** invece di «Fonte · PDF e video», nelle due modalità: il nome
  dice che cosa si apre, non l'elenco dei formati — che invecchia al terzo tipo di materiale.

⚠️ **Terza trappola pagata, misurata**: i comandi del pannellino sono ascoltati **per delega** sul
documento. `#zainoPop` sta in fondo alla pagina, dopo lo script: un `getElementById` al momento
della registrazione torna `null`, il listener non nasce, e il risultato è un campo che si riempie e
un bottone che non fa niente **senza un errore**. Gli altri pannellini dell'app sono delegati per la
stessa ragione.

`prova-modo.js`: 31 controlli sull'app viva, dentro la suite. ⚠️ Comincia mettendo a schermo il
blocco del capitolo: la card dello zaino vive dentro `<main>`, e una mappa lasciata lì dalla prova
precedente la rendeva alta zero — il click falliva accusando lo zaino. Successo davvero, eseguendo
la suite intera invece della prova sola.
`prova-topbar.js` ora conta solo le tendine **a schermo**: nella topbar ne convivono due file, e una
appartiene all'altra metà dell'app.

Resta in vista, e si chiude con Z3/Z4: la testata del blocco offre ancora «Capitolo» fra gli
strumenti, e lì dentro dovrà offrire fonte, appunti e mappe.

### Z3 — La sidebar a tre sezioni ✅ *fatto il 10 agosto 2026*
Fonti · Appunti · Mappe, con lo stesso vestito della sidebar dei capitoli ma **senza numerazione**:
un documento non è il terzo capitolo di niente. Ogni sezione porta il suo conto, accende la voce
aperta, e quando è vuota **dice perché** invece di restare bianca. Il click passa dalle porte vere —
`openPdf`, `noteOpen`, `mappaApriMia` — non da un quarto modo di montare uno strumento.

⚠️ **Le tre sezioni non hanno canali loro**: chiedono a `corpus.list`, `notes.leggi` e
`mappe.elenco` passando l'id dello zaino dove quelli si aspettano un corso. Nessuno dei tre sa che
gli zaini esistono: reggono i due perni. Se uno si scollegasse si vedrebbero **tre sezioni vuote
invece di un errore**, che è il guasto più silenzioso che questa modalità possa avere — perciò
`prova-zaino.js` mette un dato vero sul disco per ognuna e controlla anche **dove è finito**.

Sono serviti tre innesti, tutti della stessa famiglia — «insegnare gli zaini a un punto solo invece
che a dodici»:
- `curMeta()` risponde con un contenitore **sintetico** in modalità zaino (l'id dello zaino, nessuna
  lezione). Senza, `notesReload` tornava a mani vuote e **gli appunti non esistevano** nello zaino:
  mezza interfaccia si spegne quando quella funzione torna `null`.
- `curCtx()` fa lo stesso col contesto: campi di lezione e capitolo vuoti, che un giorno saranno
  `materiale` e `pagina` (Z6).
- `materiali.js` costruiva i percorsi con `radice + id` invece che con `corsi.cartella()`: i
  materiali erano l'unica cosa che non seguiva il perno. Ora `contenitoriConMateriali()` guarda le
  due radici. ⚠️ Senza, `srcUrl` non trovava il documento dello zaino e **ripiegava in silenzio** su
  `<vault>/Fonti/<nome>` — cioè apriva un altro file con lo stesso nome, o niente.

`prova-zaino.js`: 22 controlli sull'app viva, dentro la suite (che adesso ne conta 14).
⚠️ Trappola pagata: il click sulla voce della sidebar va dato **quando la colonna sta ferma**.
`zainoNavAggiorna()` riscrive l'`innerHTML`, e un click calcolato su un bottone appena sostituito
arriva a un nodo staccato — il gesto parte, non lo riceve nessuno, e il rosso accusa `openPdf`, che
non è mai stata chiamata. È «misurare mentre il disegno è in volo», applicata al gesto invece che
alla misura.

Resta in vista, e va con Z4/Z6: nella barra degli appunti compare ancora il chip «altro capitolo»,
che in uno zaino non vuol dire niente.

### Z4 — La toolbar del PDF ✅ *fatto il 10 agosto 2026*
I bottoni della `.pdfbar` erano `.iconbtn`, cioè i **40px** dei controlli grandi; adesso sono `.tbtn`
sul token — misurato a schermo: `{chiudi:30, zoom:30, livello:30, forbici:30, pagina:30}` contro
`--tb-h: 30px`.

**Il selettore del documento** vive nella barra e si vede **solo nello zaino**: in un corso i
documenti si aprono dai rimandi del capitolo, che dicono anche la pagina. La sua etichetta è VIVA
(dice quale documento è aperto) perché lì è l'unico posto in cui lo si legge — il titolo accanto si
accorcia fino a sparire quando il riquadro è stretto. L'elenco è lo stesso della sidebar
(`corpus.list`): due elenchi della stessa cosa divergono al primo documento aggiunto da una parte
sola.

**Il segno di lettura** — `lib/lettura.js` + `_lettura.json` dentro il contenitore. Sta nel vault e
non nel `localStorage` perché è un fatto del documento, non della macchina: uno zaino copiato altrove
si riapre dove l'avevi lasciato. `openPdf(file)` senza pagina riprende da lì; `openPdf(file, 7)` —
cioè un rimando `pdf:03#p=7` — vince, perché quella pagina è il senso del rimando. Nel pannellino,
accanto a ogni documento, si legge la pagina di ripresa: è l'unica cosa che distingue un documento
cominciato da uno mai aperto.

⚠️ **Tre trappole pagate.**
1. **Un timer solo per tutti i documenti.** La scrittura ha un respiro di 900 ms (venti pagine
   sfogliate = una scrittura), ma il `clearTimeout` del documento nuovo **buttava via il segno di
   quello vecchio**: misurato passando da un corso a uno zaino subito dopo aver girato pagina — sul
   disco restava la pagina di prima. Ora un segno in attesa che riguarda un altro documento o un
   altro contenitore si scrive **subito**, e `letturaFlush()` sta accanto a `noteFlush()` in
   `contenitoreMolla()`: prima si scrive quello che è in canna, poi si molla.
2. **`aria-expanded` prima di `popAt`.** `popAt` comincia con `closePops()`, che lo rimette a
   «chiuso»: il bottone diceva chiuso con il pannellino aperto davanti. Va messo dopo l'ultimo
   posizionamento.
3. **In una riga flex l'unico che può stringersi è il titolo.** Senza `min-width:0` su di lui, a
   cedere erano i bottoni: «DOCUMENTI» usciva dalla propria cornice e finiva sopra il titolo.

`test/lettura.js` (27 controlli, in `npm test`) e `test/cdp/prova-fonti.js` (17 sull'app viva, nella
suite — che adesso conta 16 prove).

#### Z4-bis — Il bottone dello zoom ha tre stati ✅ *fatto il 14 agosto 2026*

Non è più solo una percentuale. `⟷` = adattata alla **larghezza**, `⤢` = adattata alla **pagina
intera**, `144%` = scelta **a mano**. Il click cicla i due adattamenti; «+», «−» e **SHIFT+rotella**
portano alla percentuale. La percentuale non si perde: quando il bottone mostra un segno, il numero
sta nel suggerimento, insieme a dove porta il click.

I due adattamenti sono **dinamici**: cambia la misura del riquadro — divisore del banco, finestra,
forma del blocco — e la scala li segue.

⚠️ **`page-width` non era un abbonamento.** pdf.js calcola la scala **una volta**, nel momento in cui
gliela si assegna; il suo `ResizeObserver` aggiorna soltanto una variabile CSS per l'altezza. A
riadattare i modi per nome, nel visualizzatore ufficiale, è `webViewerResize` di `app.js` — che qui
non c'è. Un punto solo di reazione (`pdfZoomRiadatta`, su un `ResizeObserver` di `#pdfFrame`) copre
tutte le cause, con un'**isteresi di 4px** che rompe il ping-pong della barra di scorrimento
(adatta → compare la barra → cambia la larghezza → riadatta → sparisce la barra → …).

⚠️ **`origin` di `updateScale` non è in coordinate di schermo**, benché il visualizzatore ufficiale
gli passi `clientX/clientY`: pdf.js lo confronta con `containerTopLeft`, cioè `offsetTop/offsetLeft`.
Là il contenitore sta subito sotto la barra e i due sistemi quasi coincidono; qui `#pdfFrame` è
`inset:0` dentro un blocco del banco. Misurato: il punto sotto il puntatore scappava di **29px**
(dx −25 · dy −15); convertendo le coordinate, **0**.

⚠️ **I segni non sono `↔` e `↕`**: il `@font-face` di OpenMoji dichiara `U+2190-21FF`, e là dentro
quelle frecce diventano pittogrammi colorati. `⟷` (U+27F7) e `⤢` (U+2922) cadono fuori da tutti gli
intervalli dichiarati — verificato anche a schermo, bottone da 30px come gli altri.

Il modo **non è un interruttore nostro**: è `currentScaleValue` quando non è un numero, cioè un dato
che il viewer tiene già e che si ricorda su disco così com'è (invariante 1). L'aritmetica sta in
`App/assets/fonti/zoom.js` (`test/zoom-fonte.js`, in `npm test`); la sezione dell'app viva è dentro
`test/cdp/prova-pdf.js`.

### Z5-bis — Che cosa ENTRA in uno zaino, oggi ✅ *aggiornato il 15 agosto 2026*

Il trascinamento sulla finestra smista quattro popolazioni, e chi non entra lo sa col motivo:

| si trascina | dove va | dove sta scritto |
|---|---|---|
| `.pdf` | `MATERIALI/PDF/`, numerato e indicizzato | Z5, qui sotto |
| video · audio | `MATERIALI/`, col player | Z8 |
| `.jpg .png .gif .webp .heic` | `ALBUM/` (Album Foto) | [PIANO-FOTO §2](PIANO-FOTO.md) |
| `.md .markdown .txt` | `APPUNTI/`, come appunti | qui |

**I testi (F1-bis).** Un `.md` scritto altrove è già la forma nativa del vault: non si converte
niente. Il titolo si cerca in tre posti (frontmatter → primo `#` → nome del file), e **tre cose che
si perderebbero in silenzio si dicono**: il frontmatter di un altro programma (le chiavi che la
lista bianca di `lib/appunti.js` mangerebbe restano nel corpo, in un blocco `yaml`), i
`[[wikilink]]` che qui puntano alle lezioni del contenitore, e le immagini con percorso relativo,
che sono rimaste dov'erano. Oltre i 2 MB si rimanda alle fonti: «quella è un'altra strada».

⚠️ E il rifiuto dice che cosa entra **dove si è**: «qui si rilascia una lezione .json» era vero in
un corso e falso in uno zaino, dove le lezioni non si rilasciano affatto.

Modulo puro `App/assets/appunti/importa.js` (`test/importa-testi.js`), sezione CDP in
`prova-zaino.js`.

### Z5 — L'import e la lente ✅ *fatto il 10 agosto 2026*
Si trascinano dei PDF sulla finestra e, in modalità zaino, entrano: **copiati** dentro
`MATERIALI/PDF/` (mai linkati — un file linkato è una fonte che si rompe appena lo si sposta),
**numerati** `NN nome.pdf` — ed è quel numero che rende scrivibile un rimando `pdf:03#p=7` — e
**indicizzati per pagina**. Poi il primo si apre da solo.

⚠️ **L'indice lo scrive pdf.js, dentro l'app.** Misurato: **266 pagine in 736 ms**, senza Python,
senza modelli, senza un gigabyte di dipendenze — il testo di un PDF nativo lo sa leggere il
visualizzatore che è già nella finestra. L'indice non si mostra mai come testo: serve solo alla
lente. La forma è quella che `ingest.py` scrive da sempre, più `motore: 'pdfjs'`, perché chi legge
un indice deve poter sapere chi l'ha scritto.

**La lente della topbar, in modalità zaino, cerca dentro i documenti**: una voce per pagina, e il
click apre il documento a quella pagina e riaccende la parola con la ricerca del visualizzatore —
l'unica che sappia evidenziare dentro un PDF. Nei corsi continua a cercare nei capitoli, e la prova
lo verifica per nome: se la ricerca dello zaino invadesse i corsi, lì comparirebbe un `materiale`.

Tre scelte scritte nel codice: quello che **non entra lo dice col motivo** (un import che ingoia in
silenzio lascia a cercare un file che non c'è); lo stesso documento trascinato due volte diventa
`03` e `04` invece di sovrascrivere (una sovrascrittura porterebbe via le evidenze ancorate al nome
di prima); il prossimo numero si prende dal **massimo**, non dal conteggio — con un buco, il
conteggio riuserebbe un numero già speso.

⚠️ `webUtils.getPathForFile`: da Electron 32 un `File` trascinato **non ha più `.path`**. Senza
quella funzione (esposta dal preload) un documento trascinato si potrebbe solo rileggere e
riscrivere, cioè fare la stessa cosa in peggio.

`test/fonti.js` (38 controlli, in `npm test`) e `test/cdp/prova-import.js` (17 sull'app viva, nella
suite — 17 prove). ⚠️ Quello che la prova viva **non** può fare è il trascinamento vero:
`DataTransfer.files` non si costruisce dall'esterno con i percorsi del disco. Si prova tutto ciò che
sta sotto il gesto e si verifica che il gestore esista — la porta scavalcata è l'ultimo anello, non
la logica, ed è scritto in testa al file perché chi legge sappia che cosa resta scoperto.

### Z6a — L'evidenziatore sul documento ✅ *fatto il 10 agosto 2026*

Selezionare col mouse su un PDF apre la barra e il menu di sempre; «Keyword» e la riga dei colori
salvano un'evidenza ancorata a **documento + pagina + citazione**; il colore si riaccende a ogni
apertura, a ogni zoom e a ogni rientro della pagina. Vale nei corsi **e** negli zaini.

Non c'è un secondo motore: il ponte DOM↔stringa, i selettori TextQuoteSelector, la Custom Highlight
API e il salvataggio sono gli stessi del capitolo. È cambiata una cosa sola — l'idea di
**superficie**: `{ tipo:'capitolo', radice:#content }` oppure `{ tipo:'pdf', radice:.textLayer,
file, pagina }`. `evSupDaRange()` dice in quale cade una selezione, `evIndirizzo()` quali campi
scrivere, e da lì in giù il codice è quello di prima.

⚠️ **Le tre trappole, tutte pagate e misurate.**
1. **Il layer di testo si ricostruisce** a ogni cambio di zoom e a ogni rientro della pagina in
   vista. I nodi di prima restano in memoria ma staccati dal documento: un `Range` costruito su
   quelli **non dipinge niente e non solleva**. Rimedio: `textlayerrendered` invalida la mappa di
   quella pagina e ridisegna. La prova non chiede «è registrata?» ma **conta i rettangoli**, che
   sono zero appena il Range si stacca.
2. **L'identità collideva.** Il seme guardava `capitoloId` (vuoto su un PDF) più il testo: la stessa
   frase a pagina 3 di un documento e a pagina 9 di un altro aveva **lo stesso id**, e `aggiungi` —
   idempotente per id — sovrascriveva la prima con la seconda. Rimedio in `lib/evidenze.js`: chi ha
   un materiale usa un seme suo. Gli id dei capitoli **non cambiano** (c'è un controllo che inchioda
   il valore), quindi nessuna migrazione e nessun doppione.
3. **I due capi del `Range`, non l'antenato comune.** Trascinando fino a fine riga la selezione
   tocca `.endOfContent` — il nodo che pdf.js tiene sotto il layer — e l'antenato comune diventa la
   pagina: quella selezione risultava «di nessuna superficie», e l'evidenziatore si spegneva a
   seconda di dove finiva il gesto. La pagina la dice il capo d'inizio.

Fuori dal codice dell'app, due guasti di metodo: un `var` finito nella funzione sbagliata (due
`conVault` identici in due funzioni diverse — il tasto destro non apriva più niente, nel capitolo
come nel documento), e **le forbici dell'album lasciate accese** da `prova-album`, che trasformano
il trascinamento in un ritaglio: `partiPulito()` adesso le spegne.

`test/evidenze-pdf.js` (21 controlli, in `npm test`) e `test/cdp/prova-evidenze-pdf.js` (28 sull'app
viva, nella suite). Misurato a schermo: tre righe evidenziate con tre colori, 3 intervalli su 3 con
rettangolo, sopravvissuti a zoom e cambio pagina.

**Rifinito l'11 agosto 2026**, su due domande d'uso:
- **«Appunta» da un documento non fa più un riquadro.** Il callout diceva «Dal capitolo», che in uno
  zaino non esiste, e un riquadro attorno a ogni frase presa da un PDF trasforma un quaderno in una
  pila di scatole. Adesso è testo più rimando: `frase — [Titolo, p. 30](pdf:03#p=30)`, o l'indirizzo
  in chiaro quando il materiale non ha un numero — meglio di un link che non apre niente. Dai
  capitoli il riquadro resta: lì dice una cosa vera. La forma la decide **l'origine della
  selezione** (`origineDaRange`), non la modalità.
- **Con che cosa si appunta lo sceglie chi studia**, non il codice: sotto «Appunta», in tutte e due
  le superfici della selezione (il menu del tasto destro e la barra flottante), c'è una riga di otto
  bottoni — `¶` senza riquadro, più i sette callout. Vale nei **corsi** come negli **zaini**: la
  scelta è del gesto, non della modalità. È la stessa forma della riga dei colori
  dell'evidenziatore, e lo stesso patto: scegliere fa il gesto **e** diventa il modo di farlo, con
  la scelta ricordata (`studia.appunta.stile`). Finché non si sceglie decide l'origine — da un
  documento senza riquadro, da un capitolo la nota — e il rimando è lo stesso nelle due forme
  (calcolato una volta sola: se lo scrivessero in due, un giorno punterebbero a due posti diversi).
- **La parola chiave si porta dietro tutto quello che sa.** Sulla mappa il nodo nasce con il
  **colore della sua sottolineatura** e con il suo indirizzo — il rimando `{type,file,page}` se viene
  da un documento, il numero del capitolo se viene da un capitolo di questa lezione — ed è quello ad
  accendere il **pallino della fonte**. Un capitolo di un'altra lezione non produce un numero a caso:
  quello aprirebbe il capitolo sbagliato in silenzio, e un nodo senza pallino è meglio. Negli appunti
  il testo è **cliccabile**: `[competenza](pdf:01#p=12)` che si scioglie in un link vivo.
  ⚠️ Sotto c'erano tre guasti, tutti muti:
  1. la mappa NN→file la costruiva il preload guardando **solo `Corsi/`**: in uno zaino nessun
     documento aveva un numero, quindi nessun rimando si poteva scrivere;
  2. quella mappa arriva dal preload **congelata** (`contextBridge`): scriverci il numero di un
     documento appena importato non sollevava e non faceva niente. Il renderer ne tiene una copia e
     la aggiorna quando guarda un contenitore (indici, sidebar, import);
  3. `_pdfNum()` rispondeva con i numeri dell'**ultimo corso analizzato all'avvio**, perché
     `_numAttivi` restava ferma lì. Ora la precedenza è dichiarata: il corso in analisi, poi il
     contenitore aperto, poi le mappe globali. ⚠️ E il gancio si chiede con `typeof`, perché quelle
     due funzioni stanno nel **blocco puro** che gira anche in Node: chiamarlo senza guardia spegneva
     i 915 controlli di `test/roundtrip.js`.
  E un quarto, vecchio: «Alla mappa» scriveva `capitolo: state.current + 1` mentre il campo è
  **0-based** (`genera.js` scrive `indice: state.current`, `mappaVaiAllaFonte` fa `go(d.capitolo)`):
  il pallino di un frammento estratto dal capitolo 1 apriva il 2, e sull'ultimo non apriva niente.
- **La parola chiave negli appunti ha un cartello.** Si poteva già fare trascinando il chip
  nell'editor, ma un gesto che non si vede è un gesto che non esiste: nel menu del chip (tasto
  destro) c'è «Negli appunti», e lascia cadere la stessa riga del trascinamento (`kwMarkdown`) —
  due strade per lo stesso posto devono scrivere la stessa cosa. Nello stesso menu, «Vai al
  capitolo» diventa «Vai al documento» quando la parola viene da un PDF.

### Z6b — Il resto degli strumenti sul documento
Evidenziatore e keyword sul layer di testo; appunti e nodi-mappa ancorati a
`materiale + pagina + citazione`. I campi ci sono già: `evidenze.js:45` elenca `materiale` e
`pagina`, vuoti dal giorno in cui è stato scritto.
⚠️ La trappola nota: **il layer di testo si ridisegna** a ogni cambio di zoom e di pagina. Le
evidenze vanno riapplicate all'evento `textlayerrendered`, non una volta all'apertura — altrimenti
spariscono al primo `+`.
Per gli appunti serve una chiave in più in `appunti.CHIAVI` (`materiale`, `pagina`): è un elenco
tenuto a mano, ed è in un posto solo.

### Z8 — Il player: video e audio nello zaino ✅ *fatto il 12 agosto 2026*

Si trascinano dentro dei video e degli audio come si trascinano i PDF, si aprono in uno
strumento loro, e con un tasto si segna il minuto negli appunti.

**Una voce sola in tendina, «Player».** Video e audio sono lo stesso gesto — apri, scorri,
segna il minuto — e un audio è un video senza immagine: due voci vorrebbero dire due
pannelli, due stati e due strade per ogni cosa, per un guadagno che non c'è (due media non
si ascoltano insieme). Il tipo cambia il vestito (`#plHost[data-tipo]`), non il motore.

⚠️ **Il `<video>` è USCITO da `#pdfPane`.** Stava dentro il riquadro del documento, e i due
si spegnevano a vicenda: aprire la dispensa di cui la lezione parla zittiva la lezione. Ora
sono due strumenti del banco, affiancabili — ed è la ragione per cui questo lavoro esiste.
Vale anche nei corsi: un rimando `video:NN#t=` apre il blocco Player invece del riquadro
delle fonti.

⚠️ **Conseguenza sullo stato, ed è quella che si sarebbe pagata dopo.** `ANTEPRIMA` adesso
descrive **solo il documento**: con due riquadri accesi «che cosa è in anteprima» non ha una
risposta sola. Il media ce l'ha `PLAYER`. Da lì la regola delle citazioni, dichiarata invece
che indovinata: 🔖 negli appunti cita il documento se c'è e il minuto se no; ✎ nel player
(⌘⇧C) cita sempre e solo il minuto. Un tasto per cosa, invece di un tasto che cambia
mestiere a seconda di dove hai cliccato per ultimo.

**Sul disco**, dentro `Zaini/<id>/`:

```
MATERIALI/Video/   NN nome.mp4      copiati, mai linkati
MATERIALI/Audio/   NN nome.m4a
_ascolto.json      per ogni media: l'ultimo secondo
```

⚠️ **Il numero è UNO per contenitore, condiviso fra video e audio**: nel rimando `video:03`
il tipo non compare, e due «03» in due cartelle diverse sarebbero due risposte alla stessa
domanda — a decidere finirebbe l'ordine di lettura delle cartelle. E si prende dal massimo,
non dal conteggio, per la stessa ragione dei documenti.

⚠️ **`_ascolto.json` è un file suo, non una chiave in più in `_lettura.json`**: una pagina è
un intero ≥ 1 che il documento contiene, un secondo è un tempo che comincia da zero. E il
giorno in cui un materiale ha tutti e due i segni devono poter convivere invece di
escludersi. Lo zero **esiste**: «riportato all'inizio» è un fatto, al contrario della pagina.

⚠️ **Qui non si trascrive niente.** Un video importato è un video che si guarda e si cita al
secondo: la trascrizione costa minuti di macchina, è un derivato, e nello zaino scrive solo
l'utente (§1.5). Chi la vuole passa dalla pipeline dei corsi.

**I tasti rapidi**, e la differenza è dove sono le mani:
- **⌘⇧C** vale sempre, **anche mentre si scrive** — è il gesto per cui lo strumento esiste,
  e per questo è una combinazione e non una lettera. Fa tre cose in ordine: mette in pausa
  (o si scrive mentre la lezione va avanti), si assicura che un appunto ci sia — creandolo,
  invece di dire «apri prima un appunto», che a metà lezione è un vicolo cieco — e lascia la
  riga `- [14:10](video:03#t=850) `, col cursore dove si continua a scrivere;
- **K/spazio** play-pausa, **J/L** −10/+10 s, **&lt;/&gt;** velocità, le **frecce** ±5 s col
  fuoco dentro il player. ⚠️ Valgono solo quando NON si sta scrivendo: sono lettere sole, e
  una lettera sola dentro un editor è la lettera che si voleva scrivere — senza la guardia,
  digitare «job» in un appunto farebbe saltare la lezione indietro due volte.

**Il codice, separato per responsabilità**: `lib/media.js` (che cosa è un file, dove va,
che numero prende, che cosa non entra e perché), `lib/ascolto.js` (il segno), e
`App/assets/player/lettore.js` — modulo puro, provato in Node — per le quattro cose che
sbagliate non sollevano niente: il tipo, la forma del tempo, il salto stretto alla durata,
la riga che finisce nell'appunto. Nel renderer restano i comandi, uno per funzione.

⚠️ **Le estensioni sono scritte due volte** — `lib/materiali.js` per la pipeline,
`lettore.js` per il browser, che non può leggere `lib/`. È una copia **dichiarata**, e
`test/player.js` la inchioda confrontando le due liste **e** i due verdetti: se divergono, la
prova diventa rossa prima che un `.opus` trascinato sparisca senza dire dov'è finito.

`test/media.js` (34), `test/ascolto.js` (29), `test/player.js` (34) dentro `npm test`;
`test/cdp/prova-player.js` (26 sull'app viva, nella suite — che adesso conta 27 prove).
⚠️ Due controlli di `prova-album.js` sono stati riscritti, e non perché fossero sbagliati:
dicevano cose vere del mondo in cui il media viveva dentro il riquadro del documento («lo
zoom sparisce quando c'è un video», «alla fonte riapre e `ANTEPRIMA.tipo` è video»). Con due
riquadri quelle frasi non possono più diventare verdi, e la cosa da provare è un'altra —
che lo zoom appartenga al documento, e che il ritaglio riapra il materiale da cui viene.

**Resta fuori, e si sa**: i media non compaiono nelle tre sezioni della sidebar (si aprono
dal selettore «Media» nella barra del player), non c'è un «togli questo media» con la lapide
come per le fonti, e il Player non è nella disposizione di fabbrica dello zaino — lo si
sceglie dalla tendina di un blocco.

### Z7 — Il riconoscimento del testo (OCR) — ✅ fatto il 12/8/26, con un motore diverso
Il cuore di Z7 è consegnato, ma **non con `ocrmypdf`**: con **`tesseract.js` + `pdf-lib`**, tutto
dentro l'app. Due ragioni, misurate il 12/8/26:
1. **licenza** — `ocrmypdf` si porta dietro Ghostscript (**AGPL-3.0**): distribuirlo in un'app
   commerciale vorrebbe dire licenza Artifex a pagamento. tesseract.js/tessdata/pdf-lib sono
   Apache-2.0/MIT. (Per lo stesso motivo il layer non può farlo Chandra: dà i bbox dei **blocchi**,
   mai delle parole — il suo parser li butta, «not needed in open source» — e i pesi hanno il tetto
   dei 2 M$ di fatturato.)
2. **dipendenze** — niente Python, niente brew: gli studenti non ce li hanno. Le lingue (ita+eng,
   ~18 MB) sono vendorizzate in `App/assets/tesseract/`.

Com'è fatto: il drop di un PDF fotografato (indice: `scansione`, soglia `CAR_SCANSIONE` in
`lib/ocr.js`) **propone** il riconoscimento; il gesto si rifà dal bottone **Aa↗** nella barra del
documento. Il renderer rasterizza con pdf.js, il main riconosce (`lib/ocrpdf.js`) e scrive il layer
invisibile **nella copia** del vault — verifica con pdf.js PRIMA del rename, mai sull'originale
dell'utente. L'indice ricorda chi ha letto (`ocr: {motore, quando, improntaOriginale}`) e
l'impronta di prima impedisce il doppione al ritrascinamento (`gemelloOcr`).
⚠️ Il layer scrive le parole a **qualunque confidenza**: un buco nel layer sposta la selezione di
tutta la riga, testo brutto è meglio di testo slittato.

**Le righe storte** (13/8/26). Una foto non è mai dritta, e Tesseract dà la baseline di ogni riga
come *segmento*: la sua pendenza **è** l'inclinazione, gratis. Due livelli:
1. **il layer segue la riga** — ogni parola prende la sua `base` interpolata sul segmento (prima
   prendevano tutte la y d'inizio riga: ⚠️ 26 px di deriva a fine riga a 2°) e il glifo si inclina
   dell'angolo vero. L'altezza della riga si misura **de-inclinata**, o il riquadro storto la
   gonfia del dislivello (49 px invece di 30) e le lettere vengono grasse il doppio;
2. **la seconda passata** — oltre `GRADI_RADDRIZZA` (2°) la pagina *rasterizzata* si rigira e si
   rilegge: Tesseract legge meglio righe orizzontali. Si tiene **solo se ha letto almeno quanto la
   prima** — una miglioria che perde parole in silenzio è il guasto peggiore.

⚠️ La **foto non si tocca mai**: si gira una tela di servizio, e le parole tornano sull'immagine
vera con la rotazione inversa (`daRuotato`). Raddrizzare quello che l'utente vede sarebbe
riscrivere la sua fotografia.
⚠️ Convenzione degli angoli, dichiarata una volta sola in `lib/ocrpdf.js`: si misura nello spazio
**immagine** (y verso il basso), **positivo = riga che scende a destra**; nel PDF la y cresce verso
l'alto e il segno si inverte — è l'unica inversione del file, e sta in `scriviLayer`.
**Non fa**: la prospettiva (foto di sbieco, righe che convergono). Servirebbe OpenCV.js/jscanify —
licenze verificate il 13/8/26, **Apache-2.0 e MIT, vendibili** — ma è ~8 MB di WASM e riscriverebbe
l'immagine: da decidere a parte.
**Quanto costa, misurato il 16/8/26** — la domanda «ci gira sul portatile vecchio?» merita numeri,
non impressioni. Un documento fotografato di pagine A4 a 150 dpi, riconosciuto per intero:

| | Apple Silicon | pacchetto Intel (via Rosetta) |
|---|---|---|
| memoria col documento aperto | 705 MB | 624 MB |
| **picco durante il riconoscimento** | **1325 MB** | **1295 MB** |
| tempo per pagina | 1,7 s | 6,2 s |

⚠️ Il dato che decide non è il picco ma la sua **stabilità**: 1312 MB su 30 pagine contro 1325 su
10. Il riconoscimento lavora una pagina per volta e libera, quindi un documento lungo costa *tempo*
e non *memoria* — non esiste la lunghezza oltre la quale la macchina si pianta. È la differenza fra
questo motore e la lettura avanzata (Chandra), che carica un modello da 10,6 GB e su una macchina
da 4 GB non si può nemmeno installare.

Su una macchina piccola, quindi: le schede e le dispense corte si fanno lì; un libro intero conviene
riconoscerlo altrove e portarsi il vault, perché il risultato si scrive **nel documento** e si fa
una volta sola.

**Resta di Z7**: la scheda Impostazioni › ZAINO (stato del componente, spiegazione di quando
serve) — il gesto oggi vive tutto nel flusso del documento.
**Crediti**: fatti — `tesseract.js`, `Tesseract OCR (tessdata)` (Apache-2.0) e `pdf-lib` (MIT) in
`CREDITI`, accanto a pypdf e PDF.js.

### Z9 — La lente cerca anche negli appunti, e lo zaino si rinomina ✅ *fatto il 16 agosto 2026*

Tre cose che la guida illustrata (`StudIA - tutorial ZAINO/`) ha fatto emergere elencandole fra i «non
esiste»: scritte in una guida, si vedeva che erano buchi e non scelte.

**La lente cerca negli appunti**, in tutte e due le modalità. Erano l'unica cosa che l'utente SCRIVE e
non poteva rileggere cercando: la lente guardava i capitoli (nei corsi) o le pagine dei documenti
(negli zaini), mai il quaderno — e chi cercava una frase che sapeva di aver scritto concludeva di non
averla scritta. `RicercaIndice.docAppunto` (titolo + corpo, il titolo pesa 30 come per i capitoli),
`searchGoto` apre l'appunto con `bancoMostra('appunti')` + `noteOpen`.
⚠️ **L'indice della lente è una copia**: senza invalidarlo, un appunto appena scritto non si troverebbe
fino al cambio di contenitore. Il punto da cui si sa che l'elenco è cambiato è uno solo — `notesReload()`
— e lì c'è `SEARCH.docs=null`.
⚠️ E gli appunti si rileggono **prima** di aprire `SEARCH.docs`, non dopo: `notesReload()` azzera
l'indice, e chiamarlo a metà costruzione lo toglierebbe da sotto i piedi alla funzione che lo sta
riempiendo (`push` su `null`).
Dentro l'editor la parola trovata **non** si riaccende: CodeMirror ha una selezione sua, e accendere lì
vorrebbe dire un secondo motore di evidenziazione che nessuno spegne.

**Rinominare uno zaino** — ✎ accanto al 🗑 in Impostazioni › Zaino, l'ordine di ogni altra barra
dell'app. Cambia il titolo **e la cartella**: l'id di uno zaino *è* il suo titolo ridotto a nome di
cartella, e lasciare `Zaini/diritto-pubblico/` intitolato «Storia romana» sarebbe una seconda verità in
un vault che l'utente apre col Finder. Non fa paura perché **dentro la cartella nessuno cita lo zaino
per id**: i rimandi sono relativi al contenitore, evidenze e ritagli citano il nome del file, appunti e
mappe stanno lì dentro. Resta un timbro vecchio nel campo `corso` delle mappe già salvate: nessuno lo
legge — è una firma, non un puntatore.
⚠️ **Il riaggancio va fatto PRIMA di `zainiAggiorna()`**: quella funzione, vedendo che lo zaino attivo
non è più nell'elenco (l'id è cambiato), lo azzera e apre **il primo della lista** — rinominare lo zaino
aperto avrebbe portato dentro un altro zaino. Si passa da `cambiaZaino`, e `MODO.zaino=null` è ciò che
le impedisce di uscire alla prima riga.
⚠️ **La memoria della macchina trasloca** (`zainoMemoriaSposta`): `studia.banco.c.<id>`, `.zoom`, la voce
in `studia.aperto`. Senza, rinominare sembrerebbe aver resettato lo zaino — banco di fabbrica, riquadri
vuoti — mentre sul disco non si è perso niente.

**I nomi dei tasti secondo la tastiera che si ha davvero sotto le mani** (`App/assets/tasti/nomi.js`):
«⌘F» su un Mac, «Ctrl+F» altrove. Il codice funzionava già su Windows — le guardie sono tutte
`metaKey || ctrlKey` — ma i suggerimenti nominavano un tasto che là non esiste.
⚠️ Non è una sostituzione ma una regola: «⌘F» → «Ctrl+F», mentre «tieni premuto ⌘» → «tieni premuto
Ctrl», senza il più. Il «+» appartiene alla combinazione, non al tasto.
⚠️ La spazzata (`tastiNelDom`) entra anche nei `<template>`: la barra dell'editor si clona da lì a ogni
apertura, e un template non riscritto rimetterebbe «Cmd+S» a ogni clone — un guasto che ricompare da
solo dopo essere stato corretto. E si richiama dopo `ensureMde()`, perché i suggerimenti della sua barra
li scrive EasyMDE al momento, dopo la spazzata di partenza.
⚠️ «Maiusc» non si traduce: su una tastiera italiana quel tasto si chiama così su tutte e due le
piattaforme.

**Le etichette che dicevano «corso» dentro uno zaino**: la lente («Cerca nel corso…» anche fra i
documenti), il rimando orfano («non è fra i materiali del corso»), il 📎 dell'editor. `ricercaEtichette()`
sta in un posto solo e la chiama `modoAggiorna()`, che è il punto da cui passa ogni cambio di modalità.

`test/tasti.js` (27 controlli, nuovo nella catena di `npm test`), `test/ricerca.js` (+16), `test/zaini.js`
(+13), e la sezione viva in `test/cdp/prova-zaino.js` (+18): la lente che trova un appunto appena
scritto, le etichette della piattaforma, la rinomina che sposta la cartella col lavoro dentro.

---

## 6. Che cosa NON si fa

- **Nessun capitolo generato dallo zaino**, e nessuna chiamata al modello. Se un giorno servirà, la
  cartella dove il modello scrive va decisa prima, non dopo.
- **Nessun secondo motore di ancoraggio nei corsi.** Là l'ancora resta il capitolo; qui è la pagina.
  Sono due modalità, non due implementazioni della stessa cosa.
- **Niente linguette con più documenti aperti**: è B3, e viene dopo, se il gesto manca davvero.
