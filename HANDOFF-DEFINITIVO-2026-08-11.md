# Handoff definitivo — 11 agosto 2026

> **A chi arriva adesso.** Questo file basta per ripartire. Racconta la giornata — è nata la
> **modalità ZAINO** e si è cominciato il **riordino delle barre** — e dice che cosa resta aperto.
> Il dettaglio dello zaino, lavoro per lavoro, sta in [PIANO-ZAINO.md](PIANO-ZAINO.md); tutto ciò
> che riguarda i corsi e non si nomina qui vale ancora come scritto in
> [HANDOFF-DEFINITIVO-2026-08-10.md](HANDOFF-DEFINITIVO-2026-08-10.md).
>
> **Il lavoro che continua per primo è il RESTYLE** (§6): è piccolo, visibile, e la regola è già
> scritta e provata.
>
> **Regola di lettura**: dove c'è ⚠️ c'è un guasto già pagato — successo davvero, misurato, con il
> rimedio accanto. È la parte utile.

---

## 1. Stato

`npm test` → **2137 controlli verdi su 17 suite**. `./test/cdp/con-vault-di-prova.sh` → **17 prove
sull'app viva**, verdi.

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

### 6.2 Che cosa resta da riordinare — in ordine di visibilità

1. **La topbar.** È rimasta l'unica superficie a scatolette: `CORSO` `PERCORSO` `LEZIONE`, la lente,
   `Banco`, ⚙, il chip chiaro/scuro e `A− A+` sono `.iconbtn`/`.tendina` con cornice e `gap:.55rem`.
   ⚠️ Non è ovvio che vada fatta uguale: la topbar è la barra dell'APP, le altre sono barre di
   strumenti dentro un blocco, e la cornice lì fa da confine fra il logo e i comandi. **Da decidere
   con l'utente prima di toccare**: o si porta anche lei allo stile nudo con barrette (coerenza
   totale), o si dichiara la differenza e la si lascia (due livelli, due vestiti).
2. **La riga dei riquadri e quella dei colori** nel menu della selezione (`.ctx-cal`, `.ctx-col`):
   hanno ancora un bordo per quadratino e `gap:.2rem`. Sono le due righe che ora stonano di più,
   perché stanno dentro un menu già pulito.
3. **I separatori nativi di EasyMDE** (`i.separator`, `border-color:var(--line)`) non sono la stessa
   cosa di `.tbsep`: stessa funzione, due implementazioni. Vanno unificati — la barra del markdown è
   il modello, e il modello deve usare il pezzo comune.
4. **La testata dei blocchi** (`.bhead`): la tendina è già nuda, ma il contenitore ha ancora
   `min-height` calcolato a mano e il bordo superiore colorato. Va guardata insieme al punto 1.
5. **La barra delle parole chiave e quella dell'album** (`#kwCerca`, `#albCerca`, il bottone `Aa`):
   campo e bottone hanno cornici proprie e un gap. Stesso trattamento delle altre.
6. **`.pdfpag .iconbtn`** ha ancora una regola sua (26×26): è un residuo, i bottoni della paginazione
   sono `.tbtn` da Z4. Da togliere dopo aver verificato che non serva a nessuno.
7. **Il chip «altro capitolo»** nella barra degli appunti: in uno zaino non vuol dire niente e resta
   a schermo.

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
                        il token --tb-* e lo stile nudo delle barre
```

Prove più recenti: `prova-modo` (le due modalità) · `prova-zaino` (la sidebar a tre sezioni) ·
`prova-evidenze-pdf` (l'evidenziatore sul documento, zoom compreso) · `prova-fonti` (barra, selettore
e segno di lettura) · `prova-import` (import, indice, lente) · `prova-album` (⚠️ il confronto pixel
del ritaglio) · `prova-tendine` (lo stile delle barre).
