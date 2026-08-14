# Piano: smontare il monolite

> **Che cos'è.** La specifica per portare il renderer di StudIA da **un file solo** a un insieme di
> moduli, senza cambiare una virgola di come si comporta l'app e senza introdurre un passo di build.
>
> **Regola di lettura**: dove c'è ⚠️ c'è un guasto già pagato o un vincolo che sembra opzionale e non
> lo è. È la parte utile.
>
> **Misure prese l'11 agosto 2026.** Ogni numero in questo piano è stato contato, non stimato: se
> rileggendolo non torna, è il piano a essere invecchiato, non il codice.

---

## 1. Il problema, in cifre

`App/StudIA.html` — **13.072 righe, 804 KB**:

| pezzo | righe | note |
|---|---|---|
| `<style>` inline | ~2.075 | il design system intero, token compresi |
| `<script>` inline (2122 → 12331) | **10.211** | di cui 6.984 di codice, 2.886 di commento (28%) |
| markup | ~940 | testata, banco, dock, album, parole chiave, mappa |
| dati `base64` inline | 6 righe / 69 KB | ⚠️ una riga sola da **59.706 caratteri**: `const ICONS` |

Fuori dal file, il resto del codice nostro è già sano: 19.782 righe in `main.js`, `preload.js`,
`lib/`, `App/assets/mappa/`, `App/assets/banco/`, `wizard.js`, `composer.js`.

### Che cosa costa davvero

Tre costi misurati, non estetici. Sono la sola ragione per fare questo lavoro:

1. **Git non sa separare il lavoro.** L'11 agosto, per portare tre sessioni su `main`, il file è
   arrivato a `+4603 / −250` in un commit solo: barre, zaino, album e fonti insieme, indivisibili.
   Un cherry-pick di una delle quattro cose era impossibile. Con `main` a tre sessioni di distanza,
   l'unica scelta era «tutto o niente».
2. **Il 68% del codice del renderer non si può provare in Node.** 17 suite di unità coprono `lib/`;
   il renderer ha 24 prove CDP, che devono **lanciare l'app vera**. Una prova CDP costa ~40 secondi e
   un'istanza di Electron; una prova di unità costa 40 millisecondi. Questo cambia quante volte al
   giorno si prova qualcosa.
3. ⚠️ **Esiste già un rimedio disperato in produzione.** `lib/reader-parser.js` **ritaglia il
   sorgente di `StudIA.html` con due marcatori di testo** (`function _unq(` → `function
   buildVaultCourses(`) e lo esegue in un sandbox `vm`, per poter provare il parser markdown in Node.
   Sono 241 righe tenute insieme da due `indexOf`: rinominare una funzione le rompe in silenzio.
   Quella funzione **è** la misura del problema, ed è il primo pezzo da estrarre.

---

## 2. Non-obiettivi

Scritti per primi, perché il modo più facile di far fallire questo lavoro è allargarlo.

- **Nessun bundler, nessun framework, nessun `npm run build`.** L'app deve continuare a partire
  aprendo un file. Chi arriva deve poter modificare una riga e ricaricare.
- **Nessun cambio di comportamento.** Ogni passo è a **iso-comportamento**: se una prova cambia
  valore atteso, il passo è sbagliato, non la prova.
- **Nessuna riscrittura.** Il codice si **sposta**, non si migliora, non si riformatta, non si
  moderna. Un'estrazione che «già che c'era» cambia anche la logica non è verificabile: se qualcosa
  si rompe, non si sa quale delle due cose l'ha rotta.
- **Nessuna divisione per estetica.** Non si spezza un file perché è lungo. Si spezza quando il pezzo
  che esce **guadagna una prova in Node** o **smette di essere toccato da tutti**.
- **Niente TypeScript, niente `import`/`export` ES nel renderer** (vedi §3).
- **I commenti si spostano col loro codice.** Sono il 28% del file e sono la documentazione vera del
  progetto: un'estrazione che li lascia indietro distrugge più valore di quanta ne crei.

---

## 3. Il vincolo che decide la forma

L'app gira in Electron da `file://`, offline, con `asar: false`. Il pattern già in uso — e già
provato su cinque file — è **UMD**: lo stesso file si carica con `<script src>` nel browser *e* con
`require()` in Node.

```js
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NomeModulo = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  /* … */
  return { funzione: funzione };
}));
```

Chi lo usa già: `assets/mappa/{relazioni,grafo,layouts,genera,disegna,modifica}.js`,
`assets/banco/forme.js`, `assets/evidenze/ancoraggio.js`. Sono caricati con `<script src>` semplice
nell'`<head>` e provati in Node da `test/mappe.js`, `test/modifica.js`, `test/grafo-focus.js`.

⚠️ **Non passare a `type="module"`.** Da `file://` i moduli ES seguono le regole CORS: pdf.js ci
riesce solo perché Electron gli concede il suo protocollo, e la stessa cosa per il nostro codice
significherebbe un server locale o un bundler — cioè il non-obiettivo n.1. UMD funziona oggi, senza
niente.

**Un modulo che ne usa un altro** lo dichiara nei due modi, ed è la forma da copiare (la usa
`lettura/capitolo.js` con `rimandi/sintassi.js`):

```js
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../rimandi/sintassi.js'));
  else root.NomeModulo = factory(root.RimandiSintassi);
}(typeof self !== 'undefined' ? self : this, function (Dip) { … }));
```

⚠️ **L'ordine dei `<script>` è l'unica dipendenza dichiarata che abbiamo.** Non c'è un grafo: se
`disegna.js` usa `grafo.js`, deve stare dopo. Ogni modulo nuovo va inserito nel punto giusto
dell'`<head>` e il punto va motivato in un commento, o il prossimo che riordina rompe l'avvio.

---

## 4. Il criterio di taglio

Una riga sola, e da lei discende tutto il resto:

> **Esce la logica che non tocca il DOM. Resta nel renderer tutto ciò che è pagina.**

È il criterio che `assets/banco/forme.js` dichiara già nella sua testata: «qui c'è solo il livello
PURO: la tabella e lo stato. Niente DOM, niente `localStorage`, niente colori». Quel file non è
cambiato di una riga da quando esiste, mentre il banco intorno a lui cambiava tre volte.

In pratica, per ogni sezione ci si chiede:

1. **Che cosa sa fare senza una pagina davanti?** Segmentare un testo, ordinare un elenco, calcolare
   un intervallo, convertire coordinate, decidere quale documento è «quello attivo». Quella parte
   esce, e nasce con la sua prova in Node.
2. **Che cosa succede solo perché c'è un utente?** Ascoltare un click, disegnare un nodo, aprire un
   pannellino, leggere `localStorage`. Quella parte resta, e continua a essere provata da CDP.
3. **Che cosa è un DATO travestito da codice?** Elenchi di emoji, tabelle di abbreviazioni, icone in
   base64. Diventano file di dati, e nessuno li rilegge mai più.

⚠️ **Il taglio non passa mai in mezzo a uno stato globale.** Se una funzione «pura» legge `state`,
`MODO` o `LESSON`, non è pura: è una funzione che riceve quei valori come argomenti e ancora non lo
sa. Il parametro va aggiunto **prima** dell'estrazione, con la chiamata invariata — così se il passo
sbaglia, sbaglia da solo.

---

## 5. Inventario: che cosa contiene il monolite

Sezioni sopra le 120 righe, misurate. La colonna **verdetto** è la decisione di questo piano.

| riga | sezione | righe | verdetto |
|---|---|---|---|
| 2308 | Lettura vocale (TTS) | 1.165 | **estrai il segmentatore** (testo → segmenti, abbreviazioni, cifre); il lettore resta |
| 11247 | Mappe: archi, linking word, menu (L3/L4) | 1.084 | **estrai la logica degli archi**; il menu resta |
| 8447 | Impostazioni a schede | 913 | resta (DOM + IPC), **estrai la validazione dei campi** |
| 7581 | Ricerca nel corso (indice JS puro) | 866 | **esce quasi tutta**: l'indice e la query sono già puri |
| 4058 | Album: ritagliare un'area | 705 | **estrai la conversione PDF→viewport e il nome del ritaglio**; gesti e superficie restano |
| 5596 | Selettore del documento | 615 | resta (DOM), **estrai la precedenza dei numeri NN** |
| 9360 | Il banco | 480 | resta: la parte pura è già `forme.js` |
| 10770 | Le cinque memorie di disposizione | 477 | **esce**: è stato puro, cinque caselle e una scelta |
| 10190 | Registro «Mie mappe» | 474 | resta (DOM + IPC) |
| 7170 | Parole chiave: l'elenco a chip | 411 | **estrai ordinamento, filtro e orfane**; i chip restano |
| 9840 | Mappe: la vista generata | 350 | resta: chiama già `assets/mappa/*` |
| 6211 | Con che cosa si appunta | 320 | **estrai la scelta dello stile** (origine → callout) |
| 6616 | Menu contestuale sulla selezione | 240 | resta (DOM) |
| 6930 | Le due superfici dell'evidenziatore | 240 | resta; il puro è già `evidenze/ancoraggio.js` |
| 5159 | Citare i materiali | 202 | **estrai la sintassi del rimando** (`pdf:NN#p=7`) |
| 3593 | Il segno di lettura | 191 | resta (IPC sottile su `lib/lettura.js`) |
| 2133 | Il motore: indice, capitolo, quiz | 175 | resta (DOM), **estrai il calcolo del progresso** |
| 4980 | La stampa | 179 | **estrai la composizione del foglio** |
| 3473 | Le fonti che entrano nello zaino | 120 | resta (IPC sottile su `lib/fonti.js`) |
| ~9800 | *(blocco parsing markdown, dentro «Vault Markdown»)* | 241 | ⚠️ **esce per primo**: oggi lo ritaglia `lib/reader-parser.js` con due `indexOf` |

Totale stimato che può uscire: **~2.600 righe di logica** (il 37% del codice, non dei commenti),
più ~70 KB di dati.

⚠️ **La stima per sezione è ottimista, e M3 lo ha misurato.** «La ricerca: ~700 righe su 866»
contava la SEZIONE; le funzioni che davvero non toccano il DOM erano **81** — il resto (disegnare
l'elenco, saltare al risultato, evidenziare a schermo) è pagina, e resta. Il rapporto vero
osservato è **circa 1 a 5**: su cento righe di sezione ne escono venti. Chi pianifica il prossimo
passo tolga cinque volte prima di promettere, e conti quello che esce **con le sue prove**, non le
righe che spariscono dal file.

---

## 6. Dove va a finire

```
App/
  StudIA.html            il guscio: markup, <style>, e il renderer che CABLA i moduli
  assets/
    stile/               (§9) il CSS, spezzato per superficie
    dati/
      icone.js           ⚠️ la riga da 59.706 caratteri esce da StudIA.html
      emoji.js           l'elenco curato con le parole chiave italiane
      abbreviazioni.js   le tabelle del TTS
    lettura/
      capitolo.js        ⭐ il parser markdown (oggi ritagliato in vm)
      progresso.js       percentuale, capitolo corrente, stato di apprendimento
    tts/
      segmenta.js        testo → segmenti pronunciabili (sigle, cifre, abbreviazioni)
    ricerca/
      indice.js          costruzione dell'indice e query
    album/
      geometria.js       PDF ↔ viewport, ritaglio, nome del file
    mappa/               (già moduli) + archi.js, memorie.js
    banco/               (già forme.js)
    evidenze/            (già ancoraggio.js) + elenco.js  (ordina, filtra, orfane)
    rimandi/
      sintassi.js        pdf:NN#p=7 · video:NN#t=90 · cap:… — scrittura e lettura
    ripasso/
      intervalli.js      ⭐ SM-2 semplificato: i tempi sui bottoni E il campo su disco
```

⚠️ **`ripasso/intervalli.js` è nato qui, non è uscito dal monolite** — ed è il primo modulo che
serve al MAIN prima ancora che al renderer (`lib/ripasso.js` lo `require()`). Vale come precedente:
una regola pura che serve di qua e di là non si scrive in `lib/` con una copia nel lettore, si
scrive **una volta** in `assets/` e la si richiama dai due lati.

**Budget dichiarato**: `StudIA.html` sotto le **9.000 righe** a fine lavoro, e nessun modulo nuovo
sopra le 600. Non è un obiettivo estetico: è il numero sotto il quale il file torna a entrare in una
sessione di lettura senza doverlo saltare a pezzi.

---

## 7. La ricetta, uguale per ogni estrazione

Sette passi. ⚠️ Chi ne salta uno paga il passo 6.

1. **Delimita** la sezione nel file e leggi ogni riga: quali globali tocca (`state`, `MODO`,
   `LESSON`, `VAULT_META`, `NUM_CORSI`…) e quali funzioni chiama fuori da sé.
2. **Parametrizza sul posto**: le globali lette diventano argomenti, con le chiamate aggiornate.
   Nessuno sposta niente in questo passo. `npm test` + la prova CDP di guardia devono restare verdi.
3. **Sposta** il blocco in un file UMD nuovo, **coi suoi commenti**. La testata del modulo dichiara
   il suo ambito e che cosa NON gli appartiene (è lo stile di `forme.js`).
4. **Cabla**: `<script src>` nell'`<head>`, nel punto giusto, con un commento sul perché è lì. Nel
   renderer resta un ponte di una riga (`var X = NomeModulo.funzione;`) se serve a non toccare i
   chiamanti.
5. **Scrivi la prova in Node** sul modulo estratto. È il guadagno del passo: se non c'è, il passo non
   è finito. Deve coprire almeno i casi limite già noti (le ⚠️ nei commenti dicono quali).
6. **Verifica**: `npm test`, poi **la suite CDP intera** — non la prova singola. Metà dei guasti
   dell'11 agosto si è vista solo con la suite intera.
7. **Un commit per modulo**, che dice che cosa è uscito e quale prova nuova lo copre.

**Definizione di finito** per un passo: il modulo ha la sua prova in Node, `StudIA.html` è più corto
di quanto il modulo è lungo (± i ponti), e nessuna prova ha cambiato valore atteso.

---

## 8. L'ordine dei lavori

Non per dimensione: per **rischio crescente** e **guadagno immediato**. I primi tre sono quelli che
pagano da soli.

| # | lavoro | righe | perché adesso | prove di guardia |
|---|---|---|---|---|
| **M1** | `lettura/capitolo.js` — il parser markdown | 241 | ⚠️ elimina il `vm` di `lib/reader-parser.js`: 915 controlli di `roundtrip` smettono di dipendere da due `indexOf` | `roundtrip`, `prova-wikilink` |
| **M2** | `dati/icone.js` + `dati/emoji.js` | ~200 righe, 69 KB | la riga da 59.706 caratteri esce dal file; nessuna logica coinvolta, rischio quasi nullo | `prova-menu`, avvio |
| **M3** | `ricerca/indice.js` | **~150** di 866 ✅ | è già puro e non lo sa; la ricerca è la cosa che si rompe più silenziosamente | `prova-import` (la lente nello zaino) + `test/ricerca.js` (36 controlli, prima **zero**) |
| **M4** | `tts/segmenta.js` | ~450 di 1.165 | la sezione più grossa; le regole su sigle, cifre e abbreviazioni sono tabelle + funzioni pure, e oggi non hanno **nessuna** prova | nuova prova di unità; `prova-l1` |
| **M5** | `album/geometria.js` | ~180 di 705 | ⚠️ ci vive il guasto del ritaglio ribaltato (§4.1 dell'handoff dell'11): la conversione PDF→viewport merita una prova in Node, oggi ce l'ha solo il confronto pixel | `prova-album` |
| **M6** | `rimandi/sintassi.js` | ~115 ✅ | i rimandi si scrivevano in cinque punti diversi; tre dei guasti dell'11 agosto nascono lì | `prova-wikilink`, `prova-keyword` + `test/rimandi.js` (30 controlli) |
| **M7** | `evidenze/elenco.js` | ~200 di 411 | ordinamento, filtro, orfane: pura logica di elenco | `prova-keyword` |
| **M8** | `mappa/memorie.js` | ~250 di 477 | stato puro, cinque caselle | `prova-memorie` |
| **M9** | `mappa/archi.js` | ~350 di 1.084 | la parte più intricata: **ultimo**, quando la ricetta è rodata | `prova-l3l4`, `prova-mappe-ui` |

M1–M3 sono il nucleo: se dopo di quelli il lavoro si ferma, l'app è comunque in una posizione
migliore e nessun passo è a metà.

---

## 9. Il CSS, che è un lavoro a parte

2.075 righe in un `<style>`. Vale lo stesso criterio, con un vincolo suo:

- si spezza in `assets/stile/`: `token.css` (il blocco `:root` e il tema scuro), `barre.css` (§5bis
  del design system: `.tbar`, `.tbtn`, `.tseg`), `banco.css`, `dock.css`, `lettore.css`,
  `stampa.css`;
- ⚠️ **l'ordine di caricamento è la cascata**: `token.css` per primo, sempre. E i `@container`
  guardano il RIQUADRO, non la finestra: spostare una regola in un file caricato prima del suo
  contenitore non cambia niente, spostarla dopo una regola di pari specificità sì.
- ⚠️ `easymde.min.css` e `pdf_viewer.scoped.css` restano dove sono e **prima** dei nostri: metà delle
  regole delle barre esiste per sovrascriverli.
- guardia: `prova-tbar`, `prova-topbar-stile`, `prova-appunti-barra`, `prova-maniglia-indice`
  misurano già i valori calcolati delle barre. Sono la rete per tutto lo spostamento.

Da fare **dopo** M1–M3: il CSS non ha il problema delle prove in Node, quindi il guadagno è minore.

---

## 10. Le trappole che valgono qui

Tutte già pagate almeno una volta in questo progetto.

- ⚠️ **Una globale letta durante il primo disegno.** `corsoAttivo()` viene chiamata mentre la pagina
  si costruisce: un `var` non ancora assegnato ferma lo script a metà e l'app parte **senza un errore
  visibile** — `MODO`, `MATERIALI` e `VAULT_META` restano indefiniti. Ogni estrazione che sposta una
  dichiarazione deve chiedersi *chi legge questo, e quando*.
- ⚠️ **Niente apici inversi nei commenti che finiscono in un template letterale.** Sei volte, finora.
  Sintomo: `SyntaxError: missing ) after argument list`.
- ⚠️ **`contextBridge` consegna oggetti congelati.** Un modulo che riceve dati dal preload e ci
  scrive dentro non solleva e non fa niente. Se un modulo estratto deve scrivere, gli si passa una
  copia — ed è il renderer a farla.
- ⚠️ **Il `<script>` inline vede tutto; un modulo no.** Una funzione estratta che continua a chiamare
  `$()` o `closePops()` non è estratta: è spostata. Il passo 2 della ricetta esiste per questo.
- ⚠️ **Le prove CDP girano tutte contro la stessa istanza**, una dopo l'altra: quello che una lascia
  aperto resta per la successiva. Dopo ogni estrazione, suite intera.
- ⚠️ **`localStorage` falsa le misure**: forma del banco, stile dell'appunto e tema sopravvivono al
  ricaricamento. Le prove che misurano un layout lo azzerano prima.

---

## 11. Come si misura che sta funzionando

Quattro numeri, da riportare nell'handoff a ogni passo:

| metrica | all'inizio | 11 ago, sera | **14 ago** | obiettivo |
|---|---|---|---|---|
| righe di `App/StudIA.html` | 13.072 | 12.866 | **15.503** ⚠️ | < 9.000 |
| righe di logica del renderer provabili in Node | ~0 | 1.138 | **~1.700** | ~2.600 |
| suite di unità | 17 | 21 | **27** ✅ | 26 |
| moduli ritagliati da `reader-parser` con `indexOf` o sentinelle | 4 | **0** ✅ | **0** ✅ | 0 |

Fatti: **M1** (parser + i tre blocchi del `vm`), **M2** (icone ed emoji), **M3** (ricerca),
**M6** (rimandi). A metà: **M4** (`tts/segmenta.js`, 205 righe delle ~450 previste).
Restano M5 (album), M7 (evidenze), M8 (memorie), M9 (archi).
Fuori piano, usciti «sul percorso» in altre sessioni: `lettura/lezioni.js`, `lettura/identita.js`,
`appunti/elenco.js`, `player/lettore.js`, `ripasso/{intervalli,sorgenti}.js`.

⚠️ **Il monolite è CRESCIUTO di 2.637 righe fra l'11 e il 14**, e non è un fallimento del piano:
in quei tre giorni sono entrate tre feature (zaini e media, OCR dello zaino, banco per contenitore)
più le riparazioni. Misurato dove sono finite le righe nuove di quei tre giorni:

| dove | righe | provabile in Node |
|---|---|---|
| `lib/` (main) — 4 file nuovi: `ocrpdf` 709 · `ripasso` 230 · `media` 218 · `ascolto` 135 | **+1.469** | sì, con le loro prove |
| `App/assets/` — 3 moduli nuovi: `ripasso/intervalli` 169 · `player/lettore` 138 · `ripasso/sorgenti` 86 | **+473** | sì |
| **`App/StudIA.html`** | **+2.793** | no, solo CDP |

Cioè: **il nocciolo puro di ogni feature nuova è nato fuori dal monolite** (la matematica del layer
OCR, gli intervalli del ripasso, il tempo del player), e il lato PAGINA della stessa feature è
finito dentro — che è il criterio §4, non una deroga. Il rapporto osservato è **1 a 6**: per ogni
riga pura che esce, sei di pagina entrano. Finché si aggiungono feature il primo numero della
tabella non scenderà, ed è inutile guardarlo come se fosse un voto.

⚠️ Le righe del renderer scendono poco e a volte risalgono: le estrazioni ne tolgono, le funzioni
nuove ne aggiungono, e i commenti di aggancio restano. **La riga che conta è la seconda.**

⚠️ **Il numero di righe da solo non dice niente.** Se scendesse spostando codice in moduli senza
prove, il lavoro avrebbe peggiorato le cose: gli stessi difetti, più file in cui cercarli. La riga
che conta è la seconda.

---

## 12. Quando farlo

Non tutto in una volta, e **non al posto delle flashcard**. Due modi di incastrarlo, entrambi
legittimi:

- **A blocchi**: M1–M3 come un lavoro dichiarato (mezza giornata), poi il resto quando si tocca
  quella zona per altro.
- **Sul percorso**: chi apre una sezione per aggiungerci qualcosa, prima la estrae. Costa il 20% in
  più su quel lavoro e non richiede mai una giornata dedicata.

⚠️ **Quello che non funziona è il terzo modo**: aspettare che il file diventi «troppo grande». Lo è
già, e ogni sessione che passa aggiunge righe a un file che nessuno può dividere a posteriori senza
rileggerlo tutto.

~~**Prima di M9**, e prima delle flashcard, resta aperto il lavoro che questo piano non tocca:
l'identità dei capitoli.~~ ✅ **Chiuso**: l'identità stabile con la catena di alias vive in
`lettura/identita.js` ed è l'invariante 3 della guida.

## 12-bis. ⚠️ E in vista del beta (10 giorni, dal 14 agosto)

**Lo scorporo non è un bloccante del beta**: è un investimento sulla velocità di manutenzione, e
il tester non lo vede. Ogni estrazione però tocca il file più grosso dell'app — rischio senza
guadagno visibile, proprio nella finestra in cui serve stabilità.

Regola per questi dieci giorni: **niente estrazioni dichiarate**; resta valido il modo «sul
percorso» (se apri una sezione per un difetto e dentro c'è del puro, esce con la sua prova), e
resta valido — anzi obbligatorio — che il nocciolo di una feature nuova nasca fuori dal monolite,
come è successo per OCR, ripasso e player. Si riprende da M4-M9 dopo il primo giro di ritorni.
