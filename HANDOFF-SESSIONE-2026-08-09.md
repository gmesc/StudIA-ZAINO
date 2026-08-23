# Handoff di sessione — 8-9 agosto 2026

> 📍 **Storico.** Il punto d'ingresso è **sempre** l'`HANDOFF-DEFINITIVO-*` con la data più alta
> — oggi [23 agosto 2026](HANDOFF-DEFINITIVO-2026-08-23.md), che porta in §9 la mappa di tutta
> la catena.
> Qui resta: le mappe personali L0–L4, l'ancoraggio delle evidenze, il banco B1, e la misura che
> impone la build **legacy** di pdf.js (§10.4). ⚠️ Due decisioni del §6 sono state poi
> rovesciate: si leggono con le note che stanno lì.

> **A chi arriva adesso.** Questo file racconta **una sessione di lavoro**: le mappe personali
> (lotti L0–L4) e il primo lotto del banco (B1). Il punto di ripartenza generale del progetto resta
> [HANDOFF.md](HANDOFF.md), che è più vecchio e più largo: leggi prima quello se non conosci
> StudIA, poi questo per sapere dove siamo arrivati.
>
> Regola di lettura: dove c'è ⚠️ c'è un guasto già pagato. Non sono avvertenze generiche, sono
> cose che sono successe davvero, misurate, con il rimedio accanto.

---

## 1. Stato in due righe

`npm test` esegue **1260 controlli verdi** — `roundtrip` 868 · `mappe` 180 · `modifica` 212.
Le **mappe personali si costruiscono** (creare, collegare, etichettare, colorare, annullare) e lo
**spazio di lavoro è una griglia di blocchi** che si dispone in otto forme.

```bash
cd "/Users/giacomomeschini/Claude/StudIA/StudIA" && npm test
```

## 2. Vocabolario (cambiato il 9 agosto)

**Corso › Lezione › Capitolo.** Prima erano *Progetto › Corso › Capitolo*. Il contratto è
[RINOMINA-GLOSSARIO.md](RINOMINA-GLOSSARIO.md), che descrive anche la forma nuova sul disco
(`Corsi/<corso>/LEZIONI/<lezione>/`). ⚠️ Nel codice affiora ancora vocabolario vecchio
(`progettoAttivo`, `PROGETTI/`): sono **residui**, non varianti — si correggono, ma in un commit
loro, mai dentro un altro lavoro.

## 3. Come si prova quello che si scrive

Due reti, e servono tutte e due.

**I moduli puri, in Node**: `npm test`. Tre file, e da questa sessione ce n'è un quarto di fatto —
la sezione 15 di `test/mappe.js` percorre la catena intera `estrai → sposta → salva → apri → run →
svg`, che è il punto in cui una delega lascia i suoi difetti.

**L'app viva, via CDP**, perché molti guasti si vedono solo lì:

```bash
cd "/Users/giacomomeschini/Claude/StudIA/StudIA" && ./node_modules/.bin/electron . --remote-debugging-port=9333
```
poi, da un altro terminale: `node test/cdp/prova-b1.js` (o `prova-l1`, `prova-l2`, `prova-l3l4`).
Il pilota è `test/cdp/cdp.js`: si collega alla porta di debug e manda **eventi veri** con
`Input.dispatchMouseEvent` / `dispatchKeyEvent`.

⚠️ **Gli eventi sintetici mandati sull'elemento (`el.dispatchEvent`) non provano niente**: saltano
il rilevamento del bersaglio, quindi passano anche quando per l'utente non funziona nulla. In
questa sessione hanno nascosto un guasto per settimane (§5.5).

⚠️ **Trappola ⑧, nuova e costata cara**: queste prove girano contro il **vault vero**, creano ed
eliminano mappe, e una sequenza interrotta a metà ha fatto sparire un file dell'utente
(`AI.json`, una mappa da un nodo). I dati non sono versionati: sotto non c'è nessuna rete. Prima di
riaprire la porta di debug, puntare `vaultPath` a una copia o usare un corso usa-e-getta.

---

## 4. Che cosa è stato fatto, in ordine

I lotti delle mappe sono definiti nel **§12 di [PIANO-MAPPE-EDITOR.md](PIANO-MAPPE-EDITOR.md)**;
quelli del banco nel **§7 di [PIANO-BANCO.md](PIANO-BANCO.md)**.

| lotto | contenuto | stato |
|---|---|---|
| **L0** | livello puro: posizioni fissate onorate dai motori, nodi estratti, colore per origine | ✅ |
| **L1** | registro «Mie»: elenco, apertura, creazione, salvataggio automatico, cestino | ✅ |
| **L2** | gesti sulla tela: crea, figlio/fratello, rinomina, trascina, elimina, ⌘Z etichettato | ✅ |
| **L3** | archi: porta di trascinamento, «Collega a…», linking word col vocabolario condiviso | ✅ |
| **L4** | menu contestuale unico (nodo · arco · vuoto), colori con cascata | ✅ |
| **B1** | il banco: otto forme, due divisori, registro degli strumenti, stato salvato | ✅ |
| **B2** | la mappa dentro un blocco del banco | ✅ (§10) |
| **L5** | estrazione: «Alla mappa» dal menu contestuale | ✅ (§10) — ⌘⇧C verso la mappa resta |
| L6 | ritaglio ✂ | da fare |
| B3 · B4 · B5 | fonte a schede · sidebar «dove sei» · strumenti nuovi | da fare |
| G1 · G2 · G3 | le mappe generate rifondate sui concetti (§13 del piano mappe) | da fare |

Fuori dai lotti, nella stessa sessione: la skill **`leggere-per-sapere`** (il manuale di Alessandro
de Concini convertito in knowledge base, in `~/.claude/skills/`), che è la fonte della distinzione
su cui poggia tutto il §13.

### Dove sta il codice

```
App/assets/mappa/     relazioni · grafo · layouts · genera · disegna · modifica   (puri, UMD)
App/assets/banco/     forme.js                                                    (puro, UMD)
App/StudIA.html       tutto il renderer: ~6.400 righe, un file solo
lib/mappe.js          le mappe dell'utente su disco (+ IPC in main.js, ponte in preload.js)
test/roundtrip.js     868 controlli · test/mappe.js 180 · test/modifica.js 212
test/cdp/             il pilota per l'app viva e le quattro prove di questa sessione
```

⚠️ Il ponte verso il main si chiama **`window.vault`**, non `studia` — e per le mappe è
**asincrono**, a differenza di `vault.notes.*` che è sincrono e scrive con `fs` dentro il preload.
Da lì discendono tre cose che dagli appunti **non si possono copiare**: niente salvataggio dentro
`beforeunload` (la finestra si chiude prima della risposta: si salva su `visibilitychange` e
`blur`), serve un guardiano di sequenza sulle risposte, e il pallino di modifica si spegne nel
`.then`, mai prima.

---

## 5. I guasti trovati (la parte più utile di questo file)

Nove, tutti misurati, tutti corretti, quasi tutti **invisibili ai test che c'erano**.

**5.1 `mappe.rinomina` cancellava la mappa** se il titolo cambiava solo di maiuscole, e rispondeva
«fatto». Su macOS il volume non distingue il caso: `nomeFile` cercava un nome libero **a
minuscole** (giusto), poi la riga che toglieva il vecchio file confrontava i nomi **con le
maiuscole** e cancellava quello appena scritto. Ora «sono lo stesso file?» lo decide il filesystem
(inode + dispositivo), non il nome.

**5.2 `rimuovi` e `salva` non validavano il nome del file.** `rimuovi(p,'../APPUNTI/prezioso.md')`
cancellava l'appunto e tornava `true`. Solo `apri` controllava. Ora `nomeValido()` è una sola e la
usano tutte e tre; e `nomeSicuro()` impedisce che un titolo produca un file che l'app non sa più
gestire («Cap.. 3» → mai apribile; «_bozza» → mai elencato).

**5.3 `App/assets/mappa/modifica.js` non era caricato dalla pagina.** 582 righe, 212 controlli, e
`MappaModifica` era `undefined` nel renderer: una rete che c'è ma non è agganciata.

**5.4 Esc chiudeva la mappa invece del pannellino.** Due gestori in cattura sullo stesso nodo: il
primo faceva `closePops()`, il secondo controllava se il pannellino fosse aperto e trovava
l'attributo già tolto (`stopPropagation` non ferma i gestori sullo **stesso** nodo). Rimediato con
la **posizione**: registrato in cattura su `window`, corre prima di tutti quelli sul documento.

**5.5 Il click su una card non ha mai aperto la sua fonte**, in nessuno dei due registri, fin dalla
fase B. Il trascinamento chiama `setPointerCapture` sull'SVG e da quel momento Chrome ridirige lì
anche il `click`: arriva con `target` uguale a `<svg>`, quindi `closest('.mnodo')` non trova niente.
Ora il bersaglio si prende al **`pointerdown`** e si agisce al rilascio (`mappaBersaglio` /
`mappaAttiva`) — **è la regola per tutto ciò che si preme dentro la tela**, doppio click compreso.

**5.6 Nel motore Percorso gli archi cliccabili non erano quelli della mappa.** Là `res.archi` sono
i segmenti del filo numerato e i legami veri stanno in `res.extra`: si poteva «invertire» un
segmento inesistente, e gli archi scritti dall'utente non si potevano né etichettare né togliere.

**5.7 La linking word copriva il proprio arco.** Un `<text>` intercetta il puntatore: prendendo il
legame per la parola — dove la mano lo cerca per prima — non si apriva niente. Ora le etichette
sono `pointer-events="none"`.

**5.8 I due divisori del banco si incrociano**, e nel punto d'incontro vinceva quello orizzontale
perché disegnato dopo: prendere il verticale **a metà altezza** afferrava l'altro, e trascinare di
lato non faceva niente. Ora il verticale è disegnato per ultimo.

**5.9 `creaNodo` e `sposta` accettavano le coordinate con `isFinite(+v)`**, e `+null` fa **zero**:
un chiamante distratto avrebbe inchiodato un nodo nell'origine. Innocuo finché nessun motore
leggeva `x`/`y`; da L0 in poi no.

⚠️ E il commento in testa a `relazioni.js` **dichiarava il falso**: la palette non era «leggibile
anche a chi confonde rosso e verde». Misurato in ΔE2000 sulle dicromazie, due coppie
preesistenti stanno sotto 5. Ora un test lo tiene scritto.

---

## 6. Le decisioni prese, che vanno rispettate

**Sulle mappe** (§12.2 e §13.4 del piano mappe)

1. La cascata del colore scende sul **grafo intero**, non su quello potato dai rami chiusi.
2. Le **posizioni manuali valgono finché non si cambia motore**; il cambio motore è perciò
   distruttivo, passa dalla pila degli annullamenti e **dichiara quante ne azzera**.
3. **«Parti da qui» semina la sola radice.** Copiare la mappa generata intera sarebbe consegnare
   allo studente le parole importanti di StudIA al posto delle sue.
4. Sull'arco si salva **solo il verbo**: famiglia e colore si ricavano in lettura. Il `datalist`
   dell'utente e l'enum che andrà al modello sono **la stessa tabella**.
5. Una mappa dell'utente **ricorda i rami che avevi chiuso**; la generata no (là gli id si
   rigenerano).
6. **Ogni gesto ha la sua voce nel menu**, con la scorciatoia scritta accanto. Il contrario no: una
   voce senza gesto è legittima.

**Sul banco** (§2 e §5 di PIANO-BANCO.md)

7. Otto forme su una griglia 2×2 con i blocchi che si uniscono; niente gestore di riquadri libero.
8. La geometria sta in **due frazioni** (mai pixel) più la forma più le quattro assegnazioni.
9. ~~**Una disposizione sola, globale**, non una per corso.~~
   ⚠️ **ROVESCIATA il 13 agosto 2026**: è **una disposizione per contenitore** — ogni corso e ogni
   zaino ricorda il suo banco, il suo contenuto aperto e la sua memoria di zoom. La misura che ha
   deciso e le trappole stanno in [PIANO-BANCO.md](PIANO-BANCO.md) §5.
10. Uno strumento sta in **un blocco solo**: sceglierlo altrove lo **scambia**, non lo duplica.
11. La fonte andrà **a schede** dentro il suo blocco (B3), non in due riquadri.

**Sulle mappe generate** (§13 del piano mappe, disegnato ma non ancora costruito)

12. Le generate sono **la mappa dell'autore**, e l'autore è StudIA: usano le sue **parole
    importanti** (i grassetti). Le mappe dell'utente sono fatte di **parole chiave**, e non si
    generano mai — «il punto non è possederle, è trovarle» (de Concini).
13. La scala principale diventa il **corso**, con le lezioni annidate; ~~il capitolo resta ma
    rifatto dai paragrafi, non dai contenitori dei callout~~.
    ⚠️ **La seconda metà è stata ROVESCIATA il 10 agosto 2026**: **del capitolo non si genera più
    nessuna mappa** — quella la fa lo studente, scegliendo lui che cosa metterci. `MAPPA.ambito`
    vale `corso` o `lezione`, e un `capitolo` rimasto in una config vecchia viene *corretto*. Il
    verbale è in [HANDOFF-SESSIONE-2026-08-10.md](HANDOFF-SESSIONE-2026-08-10.md) §3.1, e cambia
    il §13.4 punto 1 di [PIANO-MAPPE-EDITOR.md](PIANO-MAPPE-EDITOR.md).
14. **Prima il giro gratis** (grassetti + glossario + rimandi → nodi e archi muti, zero chiamate),
    poi l'AI mette i verbi solo dove serve.

---

## 7. Le misure che valgono più di un'opinione

Sono già state pagate: riusarle invece di rifarle.

- **TD74-DSA**: 210 capitoli, 16 lezioni. **3.993 grassetti**, **2.706 termini distinti**, tutti i
  210 capitoli ne hanno; **1.098 voci di glossario** già definite.
- Termini presenti in **≥2 lezioni: 193** · in ≥3: 63 · in ≥5: 9. *(memoria di lavoro* è in 9
  lezioni). **È la spina della mappa di corso**: non «tutti i concetti».
- Relazioni nel corpus, su 5.259 frasi: dipendenza 213 · **intervento 192** · trasformazione 183 ·
  regolazione 172 · **misura 156** · appartenenza 133 · **definizione 97** · sequenza 94 ·
  opposizione 31 · analogia 22. Le tre in grassetto sono le famiglie aggiunte.
- Larghezza mediana di una mappa: **2.884px** → in un blocco da 583px si guarda solo con «adatta».
- Spazio a schermo: 1440 → 583px per colonna; 1920 → 815px.

---

## 8. Come lavora l'utente (regole di ingaggio)

- **Funzioni piccole e separate**, una responsabilità ciascuna. È ciò che rende possibile la
  regola «gesto e voce di menu chiamano la stessa funzione».
- **Misurare prima di decidere.** Le famiglie di relazione sono state contate sul corpus, non
  scelte a occhio; i colori con ΔE2000, non a sentimento.
- **Mai un commento che dichiara una misura non fatta.** In questa sessione ne ho scritto uno
  («misurato») per un rimedio basato su un'ipotesi sbagliata: il rimedio è stato tolto dopo aver
  verificato che senza è verde lo stesso.
- **Una logica in un punto solo** (la trappola ④ di HANDOFF.md, già pagata quattro volte).
- Prosa italiana nei commenti, che spiega **il perché** e non il cosa.

---

## 9. Il prossimo passo

**B2 — la mappa dentro un blocco.** Oggi `#mappaView` vive dentro `main` e nasconde il capitolo:
dentro il banco significa che occupa il blocco del capitolo, il che è meglio di prima ma non è
ancora la cosa giusta. Diventa uno strumento del registro come gli altri.

Poi, nell'ordine che il piano motiva: **B3** (fonte a schede) e **B4** (sidebar «dove sei») →
**L5** (l'estrazione: `→ Mappa` sulla selezione e ⌘⇧C, che **presuppone B2**, perché servono fonte
e mappa insieme) → **G1–G3** (le mappe generate rifondate) → **B5** e **L6**.

⚠️ Restano fuori da tutto questo, e vengono da prima: le **figure nei capitoli** (§9 di HANDOFF.md,
il lavoro Chandra lasciato a metà) e il **ritentativo sugli errori passeggeri** in `provider.completa`,
che è il primo punto della coda del §6 e non è mai stato fatto.

---

# 10. La seconda metà del 9 agosto — le parole chiave e la selezione

> Sessione successiva, stesso giorno. Punto di partenza: una domanda — «avevamo già discusso di
> come gestire la funzione *Appunta* dal menu contestuale?». Punto d'arrivo: sei lotti chiusi,
> `npm test` da **1260 a 1383**, e tre prove nuove sull'app viva.

## 10.1 Che cosa c'è adesso

| lotto | contenuto | prova |
|---|---|---|
| **B2** | la mappa è uno strumento del banco: esce da `<main>`, `mappaAperta()` = `bancoVisibile('mappa')` | `test/cdp/prova-b2.js` (24 controlli) |
| **`cap:`** | rimando a un capitolo preciso: `[testo](cap:01-fondamenti-c03)` | dentro `prova-menu` |
| **ancoraggio** | `App/assets/evidenze/ancoraggio.js` — TextQuoteSelector puro, sole stringhe e indici | `test/evidenze.js` |
| **persistenza** | `lib/evidenze.js` → `APPUNTI/_evidenze.json` + vista `.md` | `test/evidenze.js` |
| **barra + menu** | `#selBarra` compare da sé sulla selezione e porta tutto; `#selMenu` è la stessa cosa col tasto destro e le parole scritte | `test/cdp/prova-menu.js` (42) |
| **strumento Keyword** | l'elenco a chip nel banco: ricerca, ordinamento, trascinamento | `test/cdp/prova-keyword.js` (20) |
| **L5** | il frammento diventa nodo `origine:'fonte'` | dentro `prova-menu` |
| **pdf.js** | vendorizzato (`App/assets/pdfjs/`, build legacy) — **il viewer è da scrivere** | chiodo di prova superato |

## 10.2 Le decisioni prese, che vanno rispettate

1. **Il menu contestuale al posto del doppio bottone** (§3.1 del piano editor, ora corretto): le
   destinazioni della selezione non sono due, sono sei. Il bottone flottante resta e apre lo
   **stesso** menu, chiamando la stessa funzione — due strade, una porta.
2. **«Evidenzia» non è una voce**: la riga dei colori *è* l'evidenziatore. Una voce che ripete lo
   stesso gesto con meno precisione è un bottone senza mestiere.
3. **Le evidenze stanno in `APPUNTI/`**, non in una cartella loro: così ereditano l'interruttore di
   `pacchetto.js` che lascia fuori le note personali. Chi non condivide gli appunti non vuole
   condividere le proprie parole chiave.
4. **L'identità di un'evidenza è il testo PIÙ il contorno** (`hash(capitoloId+prefix+exact+suffix)`).
   Senza contorno, «memoria di lavoro» — nove lezioni — avrebbe un id solo, ed evidenziarne una
   spegnerebbe l'altra.
5. **Match esatto o orfana, niente fuzzy**: su parole brevi il fuzzy produce falsi positivi
   (documentato da Hypothesis). Un'evidenza accesa nel punto sbagliato è peggio di una spenta.
6. **Le orfane non si cancellano**: restano nell'elenco, barrate. Il loro posto è sparito, non la
   loro storia.
7. **pdf.js: build `legacy/`**, e non è una preferenza — vedi §10.4.
8. **Due superfici sulla selezione, e non sono un doppione.** La **barra
   contestuale** (`#selBarra`) compare da sé ed è a icone: è per chi sa già. Il
   **menu contestuale** (`#selMenu`) si chiede col tasto destro e ha le parole
   scritte: è per chi guarda. Passano tutte e due da `selAzione()` e condividono
   il vocabolario `data-az` — è la regola già pagata sulle mappe, dove due riti
   separati avrebbero fatto dimenticare un pezzo a una delle due strade.
   ⚠️ Vocabolario, perché serve per parlarne: ciò che compare da sé **non è** un
   menu contestuale. In inglese è una *selection toolbar* (o *bubble menu* nel
   gergo degli editor, *Mini Toolbar* per Word). La differenza non è l'aspetto,
   è chi prende l'iniziativa.

## 10.3 I guasti trovati, tutti misurati

**10.3.1 `getSelection().toString()` restituisce il testo MAIUSCOLO.** In Chromium applica
`text-transform`, e dentro `#content` sono maiuscoli `.kicker`, `h1`, `.qscore` e le intestazioni
dei riquadri. Misurato: `MEMORIA DI LAVORO` contro `memoria di lavoro` di `range.toString()`.
`#selNote` faceva **esattamente** questo errore da sempre: appuntare da un titolo salvava un
`anchor` che nel documento non esiste. Con l'ancoraggio sarebbe stato fatale.

**10.3.2 Il `mouseup` del tasto destro rimetteva il bottone flottante sopra il menu** appena
aperto. Il gestore non guardava quale tasto fosse stato premuto.

**10.3.3 Il click che apriva il menu lo richiudeva nello stesso evento.** Il bottone è servito da
un listener registrato *prima*; quando arrivava il mio, il menu risultava già aperto e il click
era «fuori». Non una gara sul fuoco: **ordine di registrazione**. Si risolve nominando l'apritore,
non rincorrendolo con un rinvio.

**10.3.4 Il `mousedown` sul bottone collassa la selezione** prima che il gestore la legga: serve
`preventDefault`.

**10.3.5 `salva([])` seminava file vuoti.** Un elenco vuoto creava `_evidenze.json` e `.md` in ogni
corso sfiorato. Due sono davvero finiti nel vault dell'utente, e sono stati tolti. Ora zero
evidenze non crea nessun file; se il file c'è, svuotarlo lo riscrive.

**10.3.6 Il rimando non può stare nel titolo di un callout**: `renderNoteMd` passa il titolo da
`escHtml` e solo il corpo da `mdToHtml`. Un `[testo](cap:…)` nel titolo resta scritto così, morto.

⚠️ **E due falsi allarmi che sono costati tempo, perché sembravano regressioni appena introdotte:**
- `prova-b1` falliva 9 controlli. Non era il codice: il test asserisce «forma di fabbrica» **senza
  azzerare il `localStorage`**, che portava lo stato dell'uso reale. Prima di accusare il proprio
  lavoro: `localStorage.removeItem('studia.banco')` e ricarica.
- `roundtrip` scendeva da 868 a 858 dicendo «tutti i controlli passati». **`npm test` legge il
  vault dalla config**: con la copia di prova puntata, dieci controlli che dipendono dai materiali
  venivano saltati in silenzio. Il numero vero si legge solo col vault vero.

## 10.3-bis La posizione della barra la decide il browser

`#selAncora` è un rettangolo invisibile che si posa sul rettangolo della
selezione e si dichiara ancora (`anchor-name: --selezione`); `#selBarra` ci si
aggancia con `position-anchor` e `position-try-fallbacks: flip-block,
flip-inline`. Sopra se ci sta, sotto se non ci sta, di lato se sborda — e non
esce mai dalla finestra. Il posizionamento ancorato nativo **c'è** in questa
build: misurato, `anchor-name` · `position-anchor` · `position-try-fallbacks` ·
`position-area` tutti supportati (Chromium 142; sono in Chromium dalla 125).

Resta un ripiego in JS dentro `selBarraPosiziona`, e non è pignoleria: una
funzione che si appoggia in silenzio a una capacità del motore è una funzione
che un giorno smette senza dire perché.

⚠️ **Il confine è la FINESTRA, non il blocco** — scelta dell'utente, e va
saputa. Il capitolo vive dentro un `.bcorpo` della griglia del banco, quindi
una barra che non esce dallo schermo può comunque posarsi **sopra il blocco
accanto** (gli appunti, la mappa). Se un giorno darà fastidio, il rimedio è
un'inversione già capita: `container-type: inline-size` su `.bcorpo` lo rende il
blocco contenitore dei discendenti `position: fixed`. Per il **menu** è una
trappola (va tenuto fuori dai blocchi, o si ancora al riquadro e finisce sotto
la topbar); per una **barra** che deve restare nel suo riquadro è esattamente il
meccanismo giusto. Menu fuori, barra dentro: sembra un'incoerenza ed è la stessa
regola letta due volte.

Nota minore ma della stessa famiglia: il picker del colore è passato da `id` a
**classe**, perché barra e menu lo hanno entrambi e due elementi con lo stesso
id non sono una svista da correggere dopo.

## 10.4 pdf.js: la misura che decide tutto

`Map.prototype.getOrInsertComputed` è **undefined** nel Chromium dell'app (142.0.7444.265). Da
pdf.js 6.0 i polyfill sono stati tolti e la build moderna usa quel metodo, che Chromium spedisce
dalla **145**. Sintomo: il documento si carica, `numPages` è giusto, e il primo `render()` muore.

→ **build `legacy/`**, che porta core-js. Verificata con un PDF vero: 80 pagine, render con
113 315 pixel disegnati, testo estratto, `PDFFindController` disponibile.

Vendorizzata col modello EasyMDE — file copiati a mano, **nessuna riga in `package.json`**. 2,7 MB
su un `.dmg` di 122 MB. Due credenze diffuse e false: il worker **parte** da `file://` in Electron
(a differenza del browser), e non serve un ArrayBuffer — `window.vault.srcUrl()` basta.

⚠️ Quando si scriverà il viewer: `pdf_viewer.css` (160 KB) non è il CSS di un componente, è quello
del viewer di Firefox, con 46 custom property su `:root` e 141 selettori top-level. Va incapsulato
sotto `#pdfPane`. E i due `pointer-events:none` che disattivano l'anteprima durante il
trascinamento dei divisori vanno ristretti, o uccidono la selezione — che è il motivo di tutto.

## 10.5 Come si provano queste cose

`npm test` per i moduli puri (1383). I gesti **solo** via CDP, e con il rito del vault di prova:

```bash
./test/cdp/con-vault-di-prova.sh          # copia magra, config salvata, app, prove, ripristino
```

⚠️ Lo script esiste perché la trappola ⑧ è vera: le prove girano contro il vault indicato nella
config, e una sequenza interrotta ha già fatto sparire un file dell'utente. Non lanciare le prove
puntando al vault vero.

## 10.6 Il prossimo passo

**Il viewer pdf.js** (passi 3-5 del piano: `PDFViewer` + `EventBus`, riscrittura di `openPdf`,
zoom e barretta di ricerca). Il valore vero non è mostrare il PDF: è **invertire la direzione della
pagina**. Oggi `ANTEPRIMA.page` comanda l'iframe e `citaCorrente()` cita quello che l'app *crede*;
domani `pagechanging` alimenta `ANTEPRIMA.page` e si cita quello che l'utente **guarda**.

Poi: ⌘⇧C verso la mappa (che impone di spezzare `citaCorrente()` in `puntoCorrente()`), B3, L6.

> **La sessione successiva ha un file suo**: [HANDOFF-SESSIONE-2026-08-10.md](HANDOFF-SESSIONE-2026-08-10.md)
> — mappe concettuali, figure nei capitoli, viewer pdf.js, e le prove che smettono di toccare la
> casa dell'utente.
