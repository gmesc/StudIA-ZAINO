# Handoff definitivo — 23 agosto 2026

> **A chi arriva adesso: questo file basta per ripartire.** Sostituisce
> `HANDOFF-DEFINITIVO-2026-08-18.md` come punto d'ingresso e ne eredita per riferimento ciò che
> non ripete. Il *come si costruisce qui* sta in `GUIDA-ARCHITETTO.md` e non cambia; il dettaglio
> di ogni area sta nei `PIANO-*`.
>
> ⚠️ **Il pacchetto «Leggere» è FINITO E UNITO SU `main`**, tutti e sette, più i due lavori
> laterali (il pannellino della ricerca, il titolo tolto dalla barra delle Fonti) e due correzioni
> nate strada facendo. La sessione ha anche chiuso una valutazione di codice morto (§2) e
> **registrato il lavoro del 19 e del 22 agosto che nessun handoff aveva mai raccolto** (§3).

---

## 0. Da dove ripartire, in tre righe

**Si è sul ramo `leggere`**, quindici commit avanti a `main` (che è ferma a `2e7511e`, col
pannellino e il titolo già dentro). Albero pulito. Il ramo **non è ancora unito e non è stato
spinto**.

Il pacchetto «Leggere» (§5) è **finito: L0-L7**. Le due decisioni revocabili di §5.6 — la voce che
si ferma a fine pagina, il ramo unico — non sono state riaperte e valgono come scritte.

**Il ramo è pronto per il merge su tre condizioni di quattro**: suite intera verde (56 prove),
`npm test` verde (45 file, nessuno fuori catena), `main` dentro il ramo e nessun conflitto aperto. Manca la **(b)**: i
gesti provati a mano. Il comando è in §5.8.

⚠️ I cinque rami locali già fusi — `evidenze-appunti`, `installer-windows`, `pacchetto`,
`selmenu-closepops`, `zaino-ricerca-rinomina` — sono stati cancellati oggi; le loro punte sono in
§4 per riferimento.

⚠️ **Prima di lanciare qualunque cosa che apra Electron**, leggi GUIDA-ARCHITETTO §6.1: due istanze
sulla stessa macchina si contendono la porta di debug, e il client CDP finisce a pilotare l'app
sbagliata.

---

## 1. Dove sono i lavori

| | |
|---|---|
| `main` | **`efb9755`** — «merge: il pacchetto Leggere» |
| rami | **nessuno**, né locali né worktree |
| remoto | `git@github.com:gmesc/StudIA.git` — ⚠️ `origin/main` **indietro**: il lavoro del 23 agosto non è spinto |
| unità | ✅ **45 file** — nuovi: `tasti-lettura`, `stanza`, `pagina-fonte`, `righello`. Tutti in catena, exit 0 |
| CDP | ✅ **56 prove**, suite INTERA verde sul ramo. Nuove: `prova-tasti-frecce`, `prova-pagina-campo`, `prova-righello`, `prova-voce-pagina`, `prova-ricerca-pannellino` |
| pacchetti | i tre in `dist/` sono del **17 agosto**: non contengono il lavoro del 18, del 19 né del 22 |

```bash
cd "/Users/giacomomeschini/Claude/StudIA/StudIA"
npm test                                                   # 45 file, exit 0
STUDIA_PORTA=9346 ./test/cdp/con-vault-di-prova.sh         # le 56 prove sull'app viva
STUDIA_PORTA=9346 ./test/cdp/con-vault-di-prova.sh prova-stampa.js   # una sola
```

⚠️ Il `cd` fa parte del comando: la cartella di lavoro delle chat è `StudIA/` (quella di fuori), e
da lì `./test/cdp/…` non esiste.

⚠️ **Tre file di prova sono ancora fuori dall'elenco**: `prova-l1.js`, `prova-l2.js`,
`prova-l3l4.js` chiedono un `cdp.js` dentro uno scratchpad di luglio che non esiste più — non
partirebbero comunque. Restano il punto 6 della coda (§6): si riportano a casa o si tolgono.
Il conto si fa, non si ricorda: 59 file, 56 in elenco, 3 fuori.

---

## 2. Le due decisioni di forma prese oggi

Oltre al pacchetto (§5) e ai due lavori laterali uniti su `main`, due scelte che non sono codice
ma governano il codice.

### La regola dichiarata dall'utente: si scrive per la prova in NODE, non per quella CDP

Non «aggiungere una prova dopo»: scegliere la forma del codice *prima*, così che la parte che si
sbaglia stia in una funzione pura richiamabile da `node test/<file>.js`. Il perché è misurato in
`PIANO-MODULI.md` §1 — 40 millisecondi contro 40 secondi più un'istanza di Electron. Ha
trasformato L0 da prova CDP in modulo, e ha dato la forma a tutti e quattro i moduli nuovi. Alla
prova CDP resta il **cablaggio**, mai la logica.

### `StampaFoglio.testata()` resta, con la sua bandierina

Il 19 agosto la testata è stata tolta da `stampaPrepara()`: nessun foglio la costruisce più, né
l'appunto né la mappa. Restavano senza chiamanti la funzione `testata(d)` in
`App/assets/stampa/foglio.js`, le sue tre regole CSS dentro `regole()` (`.st-testa`, `.st-titolo`,
`.st-dove`) e la sua sezione in `test/stampa-foglio.js`.

Valutato se toglierli: **si tengono**. `App/assets/stampa/foglio.js` è una *libreria*, e la riga
che costruiva la testata stava nel renderer, non nel modulo. Sopra `testata()` c'è adesso una
bandierina che dice tre cose: che dal 19 agosto non la chiama nessuno e perché (un appunto il
titolo ce l'ha già dentro, una mappa lo porta nel nome del file); che resta perché questo è un
modulo e un foglio futuro potrebbe volerla; e che i suoi tre pezzi **si tolgono tutti e tre
insieme, o non si toglie niente**. Rimanda anche a `test/cdp/prova-stampa.js`, che è il guardiano
del contrario: sul foglio vero quelle classi non ci devono essere.

⚠️ **Se un domani si decide di toglierli, la cascata è più lunga dei tre pezzi.** Misurato:
`testata()` è l'unico chiamante di `esc()` e di `data()`, e le sue regole CSS sono le uniche a
usare `SCALA.titolo`, `SCALA.dove`, `COL.tenue` e `COL.filo`. Muoiono tutti insieme, e va riscritta
anche la nota in testa al modulo, che parla di una testata che non ci sarebbe più.

**File**: `App/assets/stampa/foglio.js` (solo commento, 12 righe). `npm test` verde.

---

## 3. Il lavoro del 19 e del 22 agosto, che nessun handoff aveva raccolto

⚠️ **Questo è il buco che questo handoff chiude.** `HANDOFF-DEFINITIVO-2026-08-18.md` è stato
toccato l'ultima volta il 18 agosto (`477f08a`) e dichiara `main` a `060ee47`. Da allora sono
entrati **dodici commit più tre merge**, e nessuno di essi è registrato in un documento di stato.
Parte del lavoro del 19 è in `PIANO-BRAYNR.md`; il lavoro del 22 non è in nessun piano.
Un handoff che salta quattro giorni è la trappola ④ in forma di documento.

Quel che segue è il riassunto; il *perché* per esteso sta nei corpi dei commit, che in questo
progetto sono prosa e vanno letti (`git log 060ee47..HEAD`).

### 19 agosto — l'editor degli appunti (tre lavori, due merge)

| commit | che cosa |
|---|---|
| `b1925f7` | **il bianco fra i paragrafi**, che non c'era: due Invio non cambiavano niente a schermo, e sotto c'erano due difetti diversi |
| `6c18a25` | **la fonte nel frammento si può togliere**: un 🔗 in fondo alla fila dei riquadri decide se «Appunta» scrive da dove viene la frase. Difetto **acceso** (chi non sceglie ha il comportamento di ieri), scelta ricordata in `studia.appunta.cita` |
| `4447132` | il *perché* la testata del riquadro resta anche senza la citazione — titolo e citazione dicono due cose diverse |
| `7b8d1dd` | **la bolla dei riquadri**: si batte «> » a inizio riga e il menu compare al cursore, frecce per scorrere, Invio per mettere, Esc per mandare via. `prova-callout-bolla.js`, 17 controlli |
| `1af88e1` | **i riquadri si vestono**: nome, emoji e due colori per ciascuno dei sette, da «Personalizza i riquadri…». `prova-riquadri-stili.js`, 20 controlli |

**Le tre decisioni di quel giorno che vanno ricordate**, perché non si rileggono dal codice:

1. **L'aspetto dei riquadri sta NEL VAULT** (`.studia/prefs.json`, chiave `riquadri`), non nel
   `localStorage`: appartiene ai contenuti, viaggia con l'esportazione, vale su ogni macchina che
   apre quel vault. Nel `localStorage` stanno le preferenze di **lettura** (quali segni si vedono),
   che sono della macchina. **È il confine da citare ogni volta che nasce una preferenza nuova.**
2. **Si salvano SOLO LE DIFFERENZE.** Un vault che non ha mai aperto il pannello non ha nemmeno la
   chiave, e «com'era» la *toglie* invece di riscrivere il valore di fabbrica — altrimenti il
   giorno che si ritocca una tinta del tema, quella resta ferma per chi non ha mai toccato niente.
3. **`calloutDef` è la porta unica**: la usano il menu, la bolla, chi appunta e chi rende il
   markdown. Le sovrascritture entrano lì dentro, non accanto.

⚠️ **Due difetti pagati quel giorno, e nessuno dei due si vedeva a occhio.** Il primo: un blocco
d'avvio infilato **fra un `if` e il suo `else`** ha ucciso l'intero script del monolite, e il rosso
diceva «ensureMde non è definita» — tre schermate più in là del guasto. Il secondo: `closePops()`
toglieva il menu della bolla **ma non il suo stato** (le frecce dirottate, il «> » da cancellare),
e restava una bolla invisibile e attiva. *Chiudere è un gesto solo: lo stato e ciò che si vede si
spengono insieme.* **Trovato dalla suite intera, mai dalla prova da sola.**

### 22 agosto — la stampa e il PDF (tre lavori, un merge)

| commit | che cosa |
|---|---|
| `f4578d5` | **gli indirizzi si cliccano** (autolink di un URL scritto nudo) e **i rimandi morti diventano testo** sul foglio; la testata via dall'appunto |
| `bc9b7d9` | **nello zaino la mappa è sempre e solo la TUA**: aprendo lo strumento Mappe in uno zaino compariva una mappa *generata*, cioè la proiezione della lezione di un corso che con quello zaino non c'entra |
| `552cb0d` | **niente testata su nessun foglio** (via anche dalla mappa), e **il PDF prende il nome della cosa** (`Decodifica.pdf`, non `Decodifica — 19 ago 2026.pdf`) |
| `c5d97f4` | sul foglio **i link si vedono che sono link**: blu e sottolineati |

**Le quattro cose che vanno ricordate:**

1. **L'autolink passa FRA i tag, non sopra.** Un `replace` sull'HTML già fatto riscriverebbe anche
   gli indirizzi dentro gli `href` — un'ancora dentro un'altra ancora. La stringa si spezza sui
   tag; dentro `<a>`, `<code>` e `<pre>` non si entra. E la punteggiatura della frase resta fuori
   dal link.
2. **I rimandi dell'app diventano testo sul foglio**, e questo rende vera la regola del giorno
   dopo: in un PDF un'ancora `href="#"` è **un'annotazione che non porta da nessuna parte**
   (misurato: due `/Link` in un foglio che di link veri ne aveva uno). Colorare di blu i link
   **prima** di questa modifica avrebbe messo in evidenza proprio i rimandi morti.
3. **`mappaGenerateQui()` è la funzione unica** che dice se in questo contenitore esistono mappe
   generate, e la interrogano le tre porte da cui la cosa può cambiare. La guardia sta **dentro**
   `mappaRegistro`, non solo sul bottone: *un comando che non ha senso in un posto si nega dove si
   esegue, non dove si disegna.* E il segmento Generata/Mie **sparisce** invece di spegnersi — un
   interruttore a due posizioni di cui una non esiste è un comando che mente.
4. **`stampaNomeFile` è una funzione sua** e non un pezzo di `salvaPdf`, perché è una *regola* (che
   cosa il disco non accetta, quanto può essere lungo) e una regola si prova senza aprire un
   dialogo. ⚠️ La prima stesura della prova metteva una sentinella davanti a
   `window.vault.stampa.pdf`: **il ponte del preload non si lascia riscrivere**, e la sentinella
   non registrava niente.

⚠️ E un controllo di `prova-stampa.js` **diceva il contrario** fino al 22 agosto («la testata porta
titolo e contesto»): è stato riscritto insieme alla promessa, non aggirato. È il modo giusto —
quando cambia la promessa, cambia la prova, e si vede nel diff.

---

## 4. Pulizia dei rami

Cancellati oggi cinque rami locali, tutti già dentro `main` (`git branch --no-merged main` è vuoto).
Nessuno aveva un gemello su `origin`. Le punte, se un domani servisse ripescarne uno:

| ramo | punta |
|---|---|
| `evidenze-appunti` | `44f27ce` |
| `installer-windows` | `483b0ff` |
| `pacchetto` | `3b4775b` |
| `selmenu-closepops` | `1705cce` |
| `zaino-ricerca-rinomina` | `2e9a6a2` |

I commit ci sono ancora tutti dentro `main`: `git branch -d` ha tolto solo l'etichetta.

---

## 5. Il prossimo lavoro: il pacchetto «Leggere»

Nato da una ricognizione sulla modalità ZAINO: sei prospettive (DSA, scienze dell'apprendimento,
professionista, craft, architetto, concorrenti) hanno prodotto 70 idee, ridotte a 56 voci e votate
da tre giudici. **Il pacchetto «Leggere» è il gruppo che ha vinto**: sette lavori sullo strumento
Fonti e sulle preferenze di macchina, sei dei quali **S**.

Il piano per esteso è nel documento consegnato in chat (`PIANO-LEGGERE.md`); quel che segue è
quanto basta per ripartire senza di lui.

### 5.1 I due fatti misurati che tengono in piedi il pacchetto

1. **La voce legge solo il capitolo generato.** `.tts-go` vive su `article h2/p/.callout`, cioè il
   renderer del corso. Sul PDF non c'è sintesi vocale — eppure il testo di ogni pagina è già su
   disco (`MATERIALI/Indici-PDF/NN.json`) e il progetto dipinge già sul layer di testo con la CSS
   Custom Highlight API. Per chi ha una dislessia è la mancanza più grossa dello zaino.
2. **Il profilo di apprendimento nello zaino è muto.** `lib/profilo.js` mappa i token
   (`attenzione-distraibilita`, `carico-pause`…) in direttive di **generazione**: dove non si
   genera, non fa niente. E `--fs --lh --ls --ws` vestono la cornice dell'app, non il documento.

Lo zaino oggi è un ottimo posto per **segnare** e un posto povero per **leggere con fatica**.

### 5.2 I sette, in ordine di esecuzione

| | | costo | dov'è il perno |
|---|---|---|---|
| **L0** ✅ | il ramo `leggere` + `App/assets/tasti/lettura.js`, la priorità come tabella pura | — | `937c630` · `test/tasti-lettura.js`, 47 controlli |
| **L1** ✅ | **Esc non chiude il libro** | S | `7b054ea` · tolto il `closePdf()` finale; ✕ col suo `title` |
| **L2** ✅ | **Le frecce tornano a casa** — e il doppio effetto nel Player | S | `b8807b3` · `prova-tasti-frecce.js`; controprova a 5 rossi |
| **L3** ✅ | **La lampada resta accesa** | S | `58266f1` · `aspetto/stanza.js` + `test/stanza.js` |
| **L4** ✅ | **«Aprite a pagina 142»** — il contatore diventa un comando, col sommario del PDF | S | `63bf479` · `fonti/pagina.js` + `prova-pagina-campo.js` |
| **L5** ✅ | **Il foglio colorato** | S | `ea5a4b0` · quattro tinte, la tela si moltiplica |
| **L6** ✅ | **La finestra sulla riga** | S | `1de49ff` · `fonti/righello.js` + `prova-righello.js` |
| **L7** ✅ | **La voce sulla pagina** | **M** | `2d05e5f` · macOS-only; ogni frase sa dove sta nel DOM |

**Fuori dal piano, entrati strada facendo**: l'Esc della mappa che svuotava il blocco
(`467130b`), e il difetto che quella correzione ha introdotto — il gestore che ingoiava l'Esc senza
usarlo (`0104171`), trovato dalla suite INTERA e da nessuna prova singola.

### 5.3 La spina dorsale, e perché non è un router

Quattro dei sette toccano la tastiera (← →, ↑ ↓ del righello, la catena degli Esc, i tasti dentro
il campo della pagina), più i K/J/L del player che già ci sono. Costruiti in quattro momenti
scollegati nascerebbero quattro idee di priorità.

⚠️ **A tenerli insieme è una tabella, non un router.** La catena degli Esc ha un ordine pagato e
documentato in quindici punti (i commenti dicono *perché* ciascun anello sta dov'è): riscriverla è
un lavoro suo, con le sue prove, e **non è in questo pacchetto**. Esc resta dov'è; fuori restano
anche le combinazioni col modificatore, che non litigano con nessuno.

**`App/assets/tasti/lettura.js`** (fatto, L0) risponde invece per i tasti **nudi**, che sono quelli
che si contendono: `decidi(tasto, dove)` → **un'azione sola, o niente. Mai due.** È la forma che
rende il difetto impossibile invece che improbabile — una funzione che restituisce una cosa non può
risponderne due. Il renderer legge il DOM, riempie `dove` (`fuoco`, `modo`, `pdf`, `player`,
`righello`, `giaGestito`) e fa quello che gli viene detto.

⚠️ **Qui non si legge il DOM, ed è la ragione per cui il file esiste in questa forma**: la tabella
si prova in `node test/tasti-lettura.js` in 40 millisecondi invece che in 40 secondi di Electron.
È la stessa scelta di `suMac(nav)` in `tasti/nomi.js`. **Alla prova CDP resta il cablaggio** — il
gestore è attaccato? `preventDefault` ferma davvero lo scorrimento? — e quella nasce con L2, perché
prima di L2 non c'è niente da cablare.

**La tastiera, misurata il 23 agosto.** `App/StudIA.html` registra **24 ascoltatori globali di
`keydown`** (14 su `document`, 10 su `window`; 12 in cattura, 12 in bolla), e **18** guardano
`Escape`. L'ordine con cui scattano è: window-cattura → document-cattura → l'elemento a fuoco →
document-bolla → window-bolla, e **dentro lo stesso nodo e la stessa fase decide l'ordine di
registrazione**, cioè la posizione nel file. Non è dichiarato in nessun elenco.

⚠️ **Il guasto non è teorico: esiste già.** Con il fuoco dentro il Player, ← fa **due** cose. Il
gestore dei capitoli (`document`, bolla, `App/StudIA.html:4282`) gira **prima** di quello del Player
(`window`, bolla, `App/StudIA.html:7913`): quando decide, `defaultPrevented` è ancora falso perché
il Player non è stato chiamato, quindi cambia capitolo; poi il Player salta i suoi 5 secondi. Il
commento del Player dichiara l'intenzione opposta, e la guida ZAINO registra già il sintomo senza
riconoscerlo come difetto: «anche col fuoco sul documento **o sul player, dove in più saltano di 5
secondi**». **È il controllo che vale il file di L0, e vale in tutte e due le modalità** — lo
ripara L2, ma il caso del Player non è un caso dello zaino.

⚠️ **Il patto esiste e lo rispetta un gestore su ventiquattro**: `e.defaultPrevented` compare **una
volta sola** in tutto il file (`App/StudIA.html:4287`). `stopPropagation` non protegge dai vicini —
non ferma i gestori registrati sullo **stesso** nodo — e `stopImmediatePropagation` nel file non
compare mai (0 occorrenze). Regola per ogni tasto nuovo di questo pacchetto: **si consuma con
`preventDefault()`**, e chi lo guarda si tira indietro.

### 5.4 Dove vive la logica nuova

Due moduli UMD, sul criterio dichiarato in testa a `App/assets/fonti/zoom.js` — *solo ciò che si
può decidere senza il viewer e senza il DOM, perché è la parte che si sbaglia e che a schermo si
proverebbe solo a occhio*:

- **`fonti/pagina.js`** — `leggi(testo, {numPages, etichette})`, `etichetta(…)`,
  `appiattisci(outline)`. Il valore d'oro della prova: **`null` non è «vai a pagina 1»**.
- **`fonti/righello.js`** — `righe(caselle, {tolleranza})`, `sotto(righe, y)`, `passo(righe, i,
  verso)`: raggruppare gli span in bande di riga è la parte che si sbaglia in silenzio (gli apici,
  le due colonne, le righe a due decimi di pixel).
- **`tasti/lettura.js`** ✅ — la priorità dei tasti nudi (L0, `937c630`).

⚠️ **REGOLA DICHIARATA DALL'UTENTE IL 23 AGOSTO, e vale oltre questo pacchetto: si scrive sempre
pensando alla prova in NODE, non a quella CDP.** Non è «aggiungere una prova dopo»: è scegliere la
forma del codice *prima*, così che la parte che si sbaglia stia in una funzione pura richiamabile da
`node test/<file>.js`. Il perché è misurato in `PIANO-MODULI.md` §1 — 40 millisecondi contro 40
secondi più un'istanza di Electron — e cambia quante volte al giorno si prova qualcosa. Alla prova
CDP resta il **cablaggio**, mai la logica. È la regola che ha trasformato L0 da prova CDP in modulo.

Tutto il resto è renderer (DOM, asincronia, viewer). **La voce non aggiunge nessun motore**: testo
dall'indice per pagina → `TtsSegmenta` (lo stesso segmentatore dei capitoli) → `voce.rendi`; la
frase si accende con `::highlight(voce)` accanto a `::highlight(ricerca)`, e il `Range` lo trova
`EvidenzeAncoraggio`.

**Nessun file dell'utente cambia in tutto il pacchetto.** Tema, corpo e tinta stanno nel
`localStorage` accanto a `studia.pdf.zoom` — sono preferenze della macchina, ed è il confine
fissato il 19 agosto (§3).

Passati i dieci invarianti uno per uno: nessuno violato, e **L2 ne ripara uno** (invariante 4 —
oggi quelle frecce sfogliano in silenzio i capitoli di un corso che non è a schermo).

### 5.5 Le tre trappole già nominate

1. ⚠️ **La tinta del foglio NON va in `App/assets/pdfjs/pdf_viewer.scoped.css`.** Quel file è
   **generato** da `bin/pdfjs-css.js` e non si modifica a mano (guida §8: «quello che si genera si
   genera»). La regola va nel nostro `<style>`, che arriva dopo ed è sufficiente.
2. ⚠️ **Niente inversione scura del PDF.** Il layer di testo è in `mix-blend-mode:multiply`
   (`App/StudIA.html:1600`): su fondo scuro dà nero e le evidenze spariscono. È **una misura da
   fare**, non una promessa da scrivere in un piano.
3. ⚠️ **`--fs` di fabbrica è `17px` (`App/StudIA.html:131`) ma i bottoni scrivono `rem`.**
   Ripristinare «di fabbrica» vuol dire **nessuno stile in linea**, non `1.06rem`.

### 5.6 Le due decisioni ancora revocabili

Sono le uniche due che cambierebbero materialmente il lavoro. **Vanno decise prima di L0.**

1. **La voce si ferma a fine pagina** (scelto). Girare pagina da sola vuol dire sopravvivere alla
   ricostruzione del layer di testo a ogni cambio pagina — la trappola nota di PIANO-ZAINO Z6b — e
   raddoppia il rischio del pezzo più grosso. *Se si vuole continua, L7 diventa il lavoro più lungo
   del pacchetto.*
2. **Un ramo solo, `leggere`, in ordine L1→L7** (scelto). I sette toccano tutti
   `App/StudIA.html`: non si possono dare a più agenti in parallelo (guida §7.3 — nella stessa
   cartella l'ultimo che salva cancella l'altro). *Il taglio naturale, se lo si vuole: unire dopo
   L6 e fare la voce in un secondo ramo — è l'unico M e l'unico macOS-only.*

Le altre cinque decisioni sono nel piano e non hanno bisogno di essere riaperte: sei dei sette
valgono in tutte le modalità (il viewer `#pdfPane` è lo stesso in corso e in zaino; si guarda per
modalità solo dove una voce prometterebbe l'impossibile — è il criterio di
`bancoStrumentiOfferti`); L2 è l'eccezione, perché in un corso ← → cambiano capitolo ed è giusto;
le etichette di pagina (`iii`, `A-4`) si vedono nel chip e **mai** nei rimandi (invariante 7); la
tinta vale per tutti i documenti come lo zoom.

### 5.7 A lavoro finito

`PIANO-ZAINO.md` prende una sezione **Z12 — leggere** (da scrivere).
`GUIDA-ARCHITETTO.md` **non** è stata toccata: nessun invariante è cambiato. La guida illustrata
dello ZAINO è aggiornata (`6f584fc`) — ⚠️ **tranne la schermata `img/20-pdfbar-numerata.png`, che
mostra la barra di prima**: col titolo e senza i tre comandi nuovi. Si rigenera con la campagna CDP
del laboratorio, ed è un lavoro a sé.

### 5.8 I gesti provati a mano (fatti — è la condizione (b), soddisfatta)

```bash
cd "/Users/giacomomeschini/Claude/StudIA/StudIA" && npm start
```

1. **Esc** tre volte con un documento aperto → il documento resta. La **✕** lo chiude.
2. Mappa in uno split, **Esc** tre volte → il blocco resta suo. La **✕** lo svuota.
3. **← →** col fuoco sul documento → voltano pagina. Torna ai corsi: il capitolo non si è mosso.
4. **⌘←** → non fa niente.
5. Click su **«p. 3 di 24»**, scrivi `18`, Invio. Poi riaprilo e premi **Esc**: il campo si chiude,
   il documento resta. Su un PDF che ha il sommario, aprilo dal campo.
6. **◉** cicla le tinte; scegli crema, chiudi e riapri l'app: c'è ancora.
7. **▯** accendi il righello, leggi mezza pagina col mouse e mezza con ↑ ↓. **Poi seleziona una
   frase**: la barra della selezione si apre e «Appunta» funziona.
8. **▶** la voce legge e la frase si accende. Fermala a metà. Provala anche su un PDF riconosciuto
   con **Aa↗** e senti quanto è brutto — è il caso che decide se l'avviso basta.
9. Tema scuro + **A+** due volte, chiudi e riapri: la stanza è come l'avevi lasciata, **senza
   lampeggiare bianco** all'avvio.
10. In un **corso**: ← → cambiano ancora capitolo, ed Esc si comporta come prima.

⚠️ Il punto 8 è l'unico che questa sessione **non ha potuto verificare**: che la voce esca dagli
altoparlanti e dica le parole giuste si sente con le orecchie. Tutto quello che sta prima del suono
è misurato.

## 6. Che cosa viene dopo, in ordine di maturità

Dopo il pacchetto «Leggere», la coda ereditata dal 18 agosto più quel che è emerso oggi:

1. **I seguiti delle letture** (PIANO-BRAYNR §P1.1-quater e -quinquies): un colore di default per
   lettura applicato ai segni nuovi; il riordino delle righe; l'elenco delle parole chiave che
   segue la **visibilità** delle letture — oggi mostra tutto.
2. **Gli incrementi 2 e 3 dell'anteprima scrivibile**: elenchi e riquadri modificabili riga per
   riga; il cursore **dove hai cliccato** invece che in fondo al blocco.
3. **Le tre prove CDP fuori elenco** (`prova-l1`, `prova-l2`, `prova-l3l4`): si riportano al
   `test/cdp/cdp.js` di casa e si mettono in `PROVE=(`, o si tolgono.
4. **Le 46 variabili morte di `pdf_viewer.scoped.css`** (⚠️ rianimarle rimette bordi e margini che
   l'app non ha mai avuto: è un lavoro con le sue prove).
5. **La rinomina di una fonte**: si può tenendo il numero, ma il nome del file è citato per esteso
   in sei posti — l'elenco è quello di `fonti.usi()`.
6. **Pacchetti nuovi** (quelli in `dist/` sono del 17 agosto e saltano tre giorni di lavoro), poi
   **notarizzazione** e **installer Windows provato su Windows**: PIANO-ONBOARDING.
7. **Le bande orizzontali sui fondi sovrapposti**, se le si vuole davvero: non si ottengono con
   `::highlight()` (misurato). È il lavoro più grosso e più fragile della coda.

**Due difetti piccoli e isolati**, segnalati e mai chiusi:

- la **didascalia di un'immagine dell'album passa due volte dall'escape** (`albumHtml` in
  `App/assets/lettura/capitolo.js`): una «e» commerciale esce come `&amp;amp;`. La gemella
  `figuraHtml` non ha il difetto.
- **`.opus`, `.ogg` e `.aiff` entrano nello zaino e non nei corsi.** Misurato oggi: la lista delle
  estensioni audio esiste in **cinque** copie, due concordi (`lib/materiali.js:55` e
  `App/assets/player/lettore.js:34`, copia **dichiarata** e inchiodata da `test/player.js`) e tre
  divergenti che non hanno le tre estensioni (`main.js:236` e `main.js:319`, `lib/importa.js:22`,
  `lib/corpus.js:17`). Conseguenza: un `.opus` trascinato in uno **zaino** entra e si vede; messo
  in `Media/` di un **corso** non viene elencato, e l'app non dice niente — invariante 4 in forma
  di lista, invariante 5 da saldare.
  ⚠️ E c'è il caso opposto, **da misurare prima di dichiararlo**: `.aiff`, `.avi` e `.mpg` sono
  nelle liste accettate ma Chromium potrebbe non decodificarli — «entra e non suona» è la stessa
  promessa rotta, dall'altro lato.

---

## 7. Le idee sullo ZAINO, per non ricominciare da capo

La ricognizione di §5 ha prodotto un catalogo di **56 voci** con gesto, bisogno, pezzi esistenti su
cui si appoggiano, rischio e tre voti ciascuna, più dieci «buchi» che nessuna prospettiva aveva
visto. Il documento è stato consegnato in chat (`IDEE-ZAINO.md`) e **non è versionato**.

Quel che vale la pena ricordare qui, perché è emerso dal codice e non dalle idee:

- **Il quaderno non va nel Cestino.** PDF, media e zaino intero passano da `shell.trashItem`
  (`main.js:379/418/490`); **appunti, mappe, ritagli e foto sono `fs.unlinkSync`**
  (`lib/appunti.js:286`, `lib/mappe.js:647`, `lib/album.js:807`). L'asimmetria è rovesciata
  rispetto al valore: un PDF cancellato è ancora nella mail del professore, un appunto no. Il
  pattern di iniezione esiste già tre volte: è una riga copiata da un fratello maggiore.
- **La postilla**: un campo `nota` opzionale sull'evidenza — il *corpo* che manca al modello W3C,
  di cui StudIA ha già il *bersaglio* (`prefix/exact/suffix`). Non entra nell'identità (il seme è
  in `lib/evidenze.js:135`), quindi si comporta come colore e tratto.
- **Lo strato è già una «lettura di qualcuno»**: `App/assets/evidenze/strati.js` è nato per una
  persona che legge lo stesso testo in modi diversi, ma la struttura regge anche **due persone
  sullo stesso testo** — cioè il contesto d'uso originario (tutor + studente). ⚠️ Lo stato di
  visibilità oggi vive nel `localStorage` e **non viaggia col vault**: il commento del modulo
  dichiara già che è quello il file da cui si parte, il giorno che dovrà viaggiare.
- **«Il ritaglio sa che cosa c'è scritto» non è la funzione piccola che sembra.** Gli item di testo
  di pdf.js non sono caratteri: possono essere una riga intera o una lettera sola, e cambia da PDF
  a PDF. Un rettangolo che taglia «perielio» a metà produce una didascalia «perie» che l'utente
  accetta per inerzia, un indice che non trova la parola, e una voce che pronuncia una non-parola.
  ⚠️ Se si fa, si fa **solo per la lente**: il testo resta un dato di servizio, mai proposto come
  didascalia e mai letto a voce. La didascalia vuota è una scelta deliberata (`lib/album.js:327`).

---

## 8. Stato dichiarato, non ereditato

Per onestà, e perché è la regola di questo progetto:

| | |
|---|---|
| **verificato oggi** | `npm test` exit 0 · albero pulito · `origin/main` allineata · nessun ramo · i conti delle prove (41 · 51 · 54) · le cinque liste delle estensioni audio · le tre cancellazioni con `unlinkSync` |
| **ereditato, non rieseguito** | la suite CDP (ultimo verde dichiarato: 18 agosto, più le prove che i lavori del 19 e 22 dichiarano ciascuno) |
| **da misurare prima di dichiarare** | l'inversione scura del PDF col `mix-blend-mode:multiply`; se Chromium decodifica davvero `.aiff`, `.avi`, `.mpg` |

⚠️ Prima di dichiarare finito il pacchetto «Leggere» la suite CDP va **rieseguita per intera**, non
per i file toccati: due dei difetti più costosi di agosto — la bolla invisibile del 19 e il
`closePops()` che non spegneva lo stato — li ha trovati la suite intera, mai la prova da sola.
