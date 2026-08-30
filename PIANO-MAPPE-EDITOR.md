# Le mappe di StudIA — spec di interazione (l'editor e le due viste)

> 8 agosto 2026. Terzo documento della serie mappe: [PIANO-BRAYNR.md](PIANO-BRAYNR.md) ha deciso
> *che cosa* (AREA 2), [PIANO-MAPPE-MAPPAI.md](PIANO-MAPPE-MAPPAI.md) *con quali motori*; questo
> decide **come si usa**: i gesti di costruzione, il menu contestuale, la toolbar, le due viste.
>
> **Lo scopo non è quello di MappAI.** In MappAI la mappa è il prodotto dell'app, e chi la
> costruisce (docente/OPI) la prepara per qualcun altro. In StudIA la mappa è **uno strumento del
> lettore**: vive accanto al capitolo, è sempre agganciata alla fonte con la grammatica dei
> rimandi, e ha **due registri** — la *vista generata* (calcolata dai file strutturati del
> corso, mai salvata, sempre allineata al testo) e la *mappa mia* (artefatto personale in
> `MAPPE/`, costruito estraendo dal capitolo, dal PDF, dal video). Braynr presta i gesti
> (evidenzia→trascina, distinzione cromatica dell'origine, ritaglio d'area); MappAI presta i
> motori (layout deterministici, focus, misura, export). StudIA aggiunge il suo DNA: **ogni
> frammento estratto porta con sé il rimando**, e il click lo riapre nel dock.

---

# 1. Collocazione nell'app

## 1.1 Il bottone

**«🗺 Mappe»** nella topbar, **accanto a «✏ Appunti»** (`#editorBtn`, `StudIA.html:1128`), stessa
classe `iconbtn`, stessa altezza unica dei controlli. Apre/chiude la **vista mappa**, che prende
l'area del contenuto (`#content`) come overlay — il capitolo resta intatto sotto, alla maniera
della Vista Studio di MappAI: chiudendo si ritrova tutto senza ricalcoli.

## 1.2 Il dock resta il ponte con la fonte

Con la mappa aperta il dock continua a fare il suo mestiere: click su un nodo con `rimando` →
`openPdf`/`openVideo` affianca la fonte. È lo split testo|mappa di Braynr ottenuto gratis. La
selezione per l'estrazione (§3) avviene *prima* di aprire la mappa (dal capitolo) o *durante*
(dal PDF/video nel dock): non serve un terzo pannello.

---

# 2. I due registri (il toggle in toolbar)

| | **Vista generata** | **Mie mappe** |
|---|---|---|
| nasce da | file strutturati del corso: capitolo o lezione (§6) | l'utente, estraendo o a mano libera |
| su disco | **mai** — ricalcolata a ogni apertura (il disco è la verità: rigeneri il capitolo, la mappa segue) | `Corsi/<id>/MAPPE/*.canvas` — cartella utente, la pipeline non la tocca |
| si edita | no — solo parametri di vista (motore, spaziature, corpi), persistiti a parte | sì, tutto (§3–§5) |
| ambito | selettore **capitolo / lezione** | elenco a tendina delle mappe (pattern `noteSelect`), + «Nuova mappa» |
| ponte fra i due | **«Modifica una copia»**: semina una mappa utente dalla generata (nodi con `origine:'generata'`), da lì si lavora | — |

Il toggle è un segmented control in testa alla toolbar: `Generata | Mie`. La vista generata è
anche la risposta al personaggio 🦅 Panoramica (P2.5): il «capitolo zero» è questa vista sulla
lezione.

---

# 3. Costruire estraendo (i gesti Braynr, con la grammatica StudIA)

Ogni estrazione produce un nodo che porta **testo + `origine` + `rimando`/`anchor`**. La
distinzione cromatica di Braynr si applica intera: **nodo estratto dalla fonte = colore pieno**
(del gruppo), **nodo scritto ex novo = grigio neutro**, finché l'utente non lo colora.

### 3.1 Dal testo del capitolo — selezione

> ⚠️ **Superato il 9 agosto 2026, e realizzato.** Qui il pulsante flottante diventava **doppio**
> (`Appunta · → Mappa`). Costruendo si è scelto un **menu contestuale**, perché le destinazioni
> della selezione non sono rimaste due: sono sei. Il doppio segmento regge a due, un menu scala.
> Il bottone flottante `#selNote` **resta** e apre lo stesso menu, chiamando la stessa funzione.

Sulla selezione nel capitolo si apre un **menu contestuale** (`#selMenu`), col tasto destro dentro
la selezione o dal pulsante flottante. Voci: `Appunta · Alla mappa · Keyword · [riga colori] ·
Cancella evidenziatura · Copia`. «Alla mappa» inserisce il frammento nella **mappa attiva**; se non
ce n'è, ne crea una col solo frammento intitolata a lezione + capitolo, e lo dice col toast. Il
nodo nasce `origine:'fonte'` con la frase attorno nella `nota` e il numero del capitolo — il gesto
di Braynr «trascina senza guardare», senza il drag.

Due cose imparate costruendo, che valgono per qualunque superficie sulla selezione:
- il testo si prende da **`range.toString()`**, mai da `selection.toString()`: in Chromium
  quest'ultimo applica `text-transform`, e dentro `#content` sono maiuscoli titoli, occhiello,
  punteggio del quiz e intestazioni dei riquadri. Misurato: un titolo tornava «MEMORIA DI LAVORO»
  mentre nel documento c'è «memoria di lavoro»;
- il `mousedown` sul pulsante flottante **collassa la selezione** prima che il gestore la legga:
  serve `preventDefault`, altrimenti il gesto lavora sul vuoto.

### 3.2 Dal video e dal PDF — ⌘⇧C (Ctrl+Shift+C)

`citaCorrente()` (`StudIA.html:2815`) già cattura «il punto che stai guardando»: minuto del video
in riproduzione, pagina del PDF nel dock. **La scorciatoia va alla superficie attiva**: con
l'editor appunti a fuoco resta un appunto (comportamento di oggi, invariato); con la vista mappa
aperta produce un **nodo** con `rimando` `video:NN#t=…` / `pdf:NN#p=…` ed etichetta editabile
subito (il nodo nasce in modalità rinomina). Il toast dice sempre dov'è andata la cattura —
l'ambiguità si risolve dichiarando, non vietando.

### 3.3 Frammenti d'immagine — ✂ ritaglio d'area sul PDF

Bottone «✂» nella toolbar mappa: attiva un **velo di cattura** sopra il pannello anteprima del
dock; drag → rettangolo → `capturePage(rect)` di Electron ritaglia la regione → il ritaglio si
salva come `.webp` in **`MATERIALI/Figure/`** (stessa cartella e stessa convenzione dei ritagli
Chandra: `<stem>__pNNN_uK.webp`, `u` = utente) con `rimando` alla pagina → **nodo immagine**
nella mappa, ridimensionabile, click = pagina del PDF nel dock.
È l'area-selection di Braynr, ma il ritaglio è un *materiale del corso* (viaggia con
l'esportazione, `pacchetto.js`) e non un blob dentro la mappa. ⚠️ Dipende solo da `capturePage`
(già usata altrove in Electron): NON aspetta il §9 Chandra — quando `fig:` entrerà in
`_mdInline`, questi ritagli saranno già a casa giusta.

### 3.4 Dagli altri contenuti (dopo, non v1)

Evidenze (P1.1), appunti e domande trascinabili come nodi: stessa meccanica, arriva quando
esistono le evidenze. Il formato nodo è già pronto (`origine`, `rimando`).

---

# 4. Costruire sulla tela (nodi, archi, linking words, colori)

### 4.1 Nodi

- **Doppio click su area vuota** → nuovo nodo lì (grigio, `origine:'utente'`, subito in editing).
- Con un nodo selezionato: **Tab** = figlio, **Invio** = fratello (le convenzioni degli editor di
  mappe; funzionano anche per costruire a raffica da tastiera).
- Doppio click su un nodo = rinomina. Trascina = sposta (la posizione si salva nel `.canvas`).
- **Canc/Backspace** = elimina (nodo intermedio → i figli restano flottanti, alla Braynr);
  ogni distruttiva passa da `pushUndoSnapshot(etichetta)` — **⌘Z** con l'etichetta che dice cosa
  annulla (pattern `mappai-undo`).

### 4.2 Archi

- **Drag dalla porta del nodo** (il pallino sul bordo, visibile in hover) a un altro nodo = arco
  **monodirezionale** A→B. In alternativa dal menu contestuale: «Collega a…» → click sulla
  destinazione (modalità a due click di MappAI, con hint a schermo ed Esc per annullare).
- Dal menu contestuale dell'arco: **direzione** (→ / ↔), inverti, elimina. Il bidirezionale si
  disegna con la doppia punta (e in export regge: frecce disegnate, non marker — §7 del doc
  MappAI).

### 4.3 Linking words

- **Doppio click sull'arco** → campo di testo sul posto. Con **datalist dei verbi per famiglia**
  (EDGE_FAMILIES): scrivi libero, ma i suggerimenti vengono dal vocabolario — e se il verbo
  appartiene a una famiglia, **l'arco prende il colore della famiglia** (daltonismo-safe).
  È ciò che trasforma la mappa mentale in concettuale senza un «modo» separato.
- Corpo del testo delle linking words regolabile dalla toolbar (`fsRel`), indipendente dal corpo
  dei nodi (`fsNode`) — le due leve della Vista Studio.

### 4.4 Colori

- Menu contestuale del nodo → **riga colori: 5 preset + picker** (input color nativo).
  ⚠️ **Corretto il 9 agosto 2026.** Qui c'era scritto che i 5 preset sono «costanti in
  `lib/mappa.js`, non hex sparsi nel renderer». Quel file **non esiste** (il modulo si chiama
  `lib/mappe.js` e non contiene nessuna palette), e per una volta ha ragione il codice: i preset
  stanno in `mappaColori()` nel renderer, che li legge **a runtime dalle variabili CSS** — così
  seguono il tema chiaro e scuro, cosa che cinque costanti in una libreria non potrebbero fare.
  Dal lotto delle evidenze la stessa funzione serve anche al menu sulla selezione e a quello sul
  chip delle parole chiave: una tavolozza sola, in un posto solo. Resta una crepa vera: il quinto
  colore (`#7c3aed`) è un hex nudo senza variabile, e nel tema scuro non cambia con gli altri.
- Checkbox **«applica ai discendenti»**: la cascata di MappAI/Braynr — il colore si propaga a
  tutto il sottoalbero (usa `getDescendants`, rispetta i rami chiusi). Senza spunta, colora solo
  il nodo.
- Il colore scelto a mano **vince** sull'origine (un nodo estratto può essere ricolorato); la
  distinzione fonte/utente resta leggibile dal bordo (pieno vs tratteggiato), così colore e
  origine non si contendono lo stesso canale visivo.

---

# 5. Il menu contestuale (tasto destro / long-press)

**Su un nodo**
`Rinomina · Colore [●●●●● +] ☐ applica ai discendenti · Aggiungi figlio · Aggiungi fratello ·
Collega a… · Libera la posizione (se spostato a mano) · Vai alla fonte (se rimando) ·
Focus: vicini · Focus: parentela · Chiudi/Apri ramo · Elimina · Annulla «…»`

⚠️ **Ogni gesto del §4.1 deve avere qui la sua voce**, con la scorciatoia scritta accanto. Un
gesto non si vede: doppio click, Tab e Invio li conosce chi ha già usato un editor di mappe, e chi
legge lentamente — il pubblico dichiarato di questa app — non li indovina e non li cerca. Il menu è
la superficie che *elenca* ciò che si può fare; i gesti restano la scorciatoia di chi li ha
imparati, non l'unico modo di arrivarci. Vale anche per il contrario: una voce che compare qui
senza gesto è legittima, un gesto senza voce no.

**Su un arco**
`Linking word… · Direzione → / ↔ · Inverti · Elimina`

**Su area vuota**
`Nuovo nodo qui · Incolla · Adatta alla vista · Motore ▸ (Albero / DAG / Percorso / Anelli)`

Un menu solo, voci condizionali (la voce fonte compare solo se c'è il rimando; nella vista
generata restano solo navigazione e focus). I Focus sono quelli del §3 del doc MappAI: overlay a
tutta area, geometria propria più grande, PDF dedicato.

---

# 6. La vista generata (mappe dai file strutturati)

> ⚠️ **Superato dal §13** (9 agosto 2026). Quanto segue descrive la vista generata come è stata
> costruita in fase B e come funziona oggi: mappa i **contenitori** del capitolo (titoli, punti
> chiave, note e materiali, glossario). Il §13 la rifonda sui **concetti** ricavati dai paragrafi
> espositivi e ne sposta la scala principale al corso. Si lascia qui perché descrive il codice
> in esercizio finché il §13 non è realizzato.

Deterministica, **zero AI, zero costo**, ricalcolata a ogni apertura:

- **Capitolo**: radice = titolo; L1 = i titoli `##`; L2 = `###` e punti chiave; ogni nodo
  eredita i **rimandi** che la sua sezione cita (`genera.rimandiDa` sa già estrarli) → ogni nodo
  clicca verso il dock. Glossario come ramo opzionale (toggle nei parametri).
- **Lezione**: radice = lezione; L1 = capitoli (in ordine); L2 = i loro titoli principali. Rispetta
  la **variante attiva** (`lezioniVisibili()`), come tutto il lettore.
- **Corso** (v2): aree → lezioni, dal piano.

Il parser è quello del lettore (i capitoli sono già in memoria in `LESSONS`): niente seconda
lettura del disco. I **parametri di vista** (motore, orientamento, spaziature, corpi) si
persistono per corso — non nella mappa, che non esiste su disco.

**«Modifica una copia»** scrive `MAPPE/<lezione>--<capitolo>.canvas` seminato dalla generata
(nodi `origine:'generata'`, rimandi inclusi) e passa al registro «Mie». Da lì è roba
dell'utente: la rigenerazione del capitolo **non** la tocca — il patto è lo stesso degli appunti.

---

# 7. La toolbar «Mappe»

Adattiva **come quella degli appunti**: stesso pattern a container query
(`container-type:inline-size`, breakpoint ~520/360px — `StudIA.html:436–443`), separatori che
spariscono per primi, gruppi che si impilano. Da sinistra:

1. **`Generata | Mie`** (segmented) — il toggle dei registri;
2. **ambito**: select capitolo/lezione (Generata) *oppure* select mappe + «+ Nuova» (Mie);
3. **motore**: `Albero · DAG · Percorso · Anelli` (segmented compatto);
4. **orientamento**: `TD | SX` (dall'alto / da sinistra — una trasformazione sola, dal motore);
5. **⚙ Vista** (popover, per non affollare — le leve fini stanno qui):
   distanza livelli (`gapLayer`) · distanza nodi (`gapNode`) · corpo testo nodi (`fsNode`) ·
   corpo linking words (`fsRel`) · stile linee `curva / dritta / ortogonale` · etichette
   `complete / brevi` · archi usati `gerarchia / +cross`;
6. **azioni**: `✂` ritaglio d'area (§3.3) · `🔖` cita (⌘⇧C) · `⤢` adatta alla vista ·
   `PDF` esporta (la vista corrente: mappa, o Focus se aperto — regola MappAI);
7. a destra, come negli appunti: pallino giallo di modifica non salvata (il salvataggio è
   atomico e automatico col debounce degli appunti).

Nel popover ⚙ in coda: **metriche live** (`N nodi · M archi · K incroci · etichette
accavallate`) — la misura del layout sotto gli occhi mentre giri le leve, come nella Vista
Studio. Le stesse leve, per la vista generata, si salvano per corso; per una mappa utente,
**dentro il suo `.canvas`** (ogni mappa ricorda come la stavi guardando — il patto della «vista
memorizzata»).

---

# 8. Scorciatoie (riepilogo)

| tasto | contesto | effetto |
|---|---|---|
| **⌘⇧C** | superficie attiva | cattura il punto guardato → nodo (mappa attiva) o appunto (editor a fuoco); il toast dice dove |
| **Tab / Invio** | nodo selezionato | figlio / fratello |
| **doppio click** | vuoto · nodo · arco | nuovo nodo · rinomina · linking word |
| **Canc** | nodo/arco | elimina (con undo etichettato) |
| **⌘Z** | mappa | annulla ultima operazione |
| **Esc** | focus / modalità collega / ✂ | chiude la modalità corrente |
| **⌘+ / ⌘−** | mappa | zoom (coerente col resto dell'app) |

---

# 9. Il formato su disco (consolida P2.1)

`MAPPE/<slug>.canvas` — JSON Canvas + campi extra sui nodi
(`origine: 'fonte'|'utente'|'generata'`, `rimando`, `colore`, `collapsed`) e sugli archi
(`rel`, `bidirectional`, `famiglia` derivata). In coda al file: `vista` (motore, orientamento,
leve, zoom/pan). Scrittura atomica (`writeAtomic`), `MAPPE/` in `pacchetto.js` e i ritagli `✂`
in `MATERIALI/Figure/` dal primo giorno.

---

# 10. Che cosa questa spec NON prevede (per non far rientrare MappAI dalla finestra)

- **Niente generazione AI dall'editor** in v1: la vista generata è deterministica; la mappa
  proposta dal modello (rubinetto 2 di P2.3) arriva dopo, e comunque passa da `sanitizza()`.
- **Niente force layout**, niente fisica: i nodi stanno dove il motore o l'utente li mette.
- **Niente stato di studio sul nodo**: lo stato viene dal ripasso (P3), semmai si *mostra*.
- **La vista generata non si salva mai**: chi vuole tenerla ne modifica una copia. Due verità
  sullo stesso capitolo (file e mappa salvata che divergono) sono la trappola ③.

---

# 11. Ordine di costruzione (raffina la tabella §10 del doc MappAI)

| fase | contenuto | dipende da |
|---|---|---|
| A | `lib/mappa/` — modello, layouts (Albero/DAG/Percorso/Anelli), misura, relazioni, sanitizza | — (porting, doc MappAI 5a/5b) |
| B | Vista generata read-only: bottone «🗺 Mappe», overlay, toggle registri (solo Generata), toolbar minima (motore, TD/SX, ⚙, PDF) | A |
| C | Export PDF vettoriale (pipeline `exportPdfFromSvg`) | B |
| D | Mie mappe: `.canvas` su disco, «Modifica una copia», editor nodi/archi/colori, menu contestuale, undo | B |
| E | Estrazione: `→ Mappa` sulla selezione, ⌘⇧C verso mappa, linking words con famiglie | D |
| F | ✂ ritaglio d'area → `MATERIALI/Figure/` | D |
| G | Focus vicini/parentela + PDF del focus | B (lettura) / D (piena resa) |
| v2 | capitolo affiancato nel dock per estrarre senza cambiare vista; evidenze/appunti come nodi; mappa proposta dal modello; Colonne/Fasci/Matrice | E |

La fase B da sola è già un deliverable: ogni capitolo e ogni lezione hanno una mappa navigabile ed
esportabile in PDF, a costo zero, dal giorno in cui esiste.

---

# 12. Piano di esecuzione — le mappe personali, dalle fondamenta ai gesti

> **Scritto l'8 agosto 2026**, dopo la fase B e dopo i due strati della fase D già consegnati
> (persistenza in `lib/mappe.js`, operazioni pure in `App/assets/mappa/modifica.js`). Questa
> sezione non ridiscute i §1–§11: li trasforma in un ordine di lavoro, con dentro le decisioni
> prese e ciò che le misure sul codice hanno smentito.
>
> **Stato: L0 → L4 chiusi e verificati** (8–9 agosto). `npm test` esegue **1205 controlli** —
> `roundtrip` 813 · `mappe` 180 · `modifica` 212, erano 921 — e i quattro lotti d'interfaccia sono
> stati provati sull'app viva a gesti veri (26 + 33 + 40 controlli via CDP). Resta **L5**
> (estrazione) e **L6** (ritaglio), più il lotto nuovo **G1–G3** del §13.
>
> Lungo la strada sono emersi, in codice già consegnato, **due guasti che rispondevano «fatto»**:
> `rinomina` che cancellava la mappa quando il titolo cambiava solo di maiuscole, e `rimuovi`/
> `salva` che accettavano nomi fuori da `MAPPE/` (un `../APPUNTI/…` cancellava l'appunto). Corretti
> e coperti da test; il racconto è nel §12.3, sotto L1.

## 12.1 Non è rimasta «solo l'interfaccia»: tre buchi stanno sotto

Il verbale della fase D dice che restava lo strato dell'interfaccia. Guardando il codice, tre pezzi
del **livello puro** mancano ancora, e sono esattamente quelli su cui l'interfaccia si appoggerebbe
a vuoto. Vanno chiusi per primi, perché ognuno ha la forma del guasto che in questo lavoro è già
costato caro: funziona a schermo, e perde il lavoro senza dirlo.

**G1 — nessun motore legge `x` e `y`.** `modifica.sposta()` scrive le coordinate, `mappe.js` le
porta su disco (passano dal ramo che lascia transitare i campi non nominati), ma in `layouts.js`
non c'è **nessun** riferimento a `n.x`: `run()` ricalcola ogni posizione da zero. Oggi trascinare
un nodo salverebbe una coordinata che nessuno onora, e alla riapertura la mappa tornerebbe
ordinata come prima: il lavoro sparisce, e sparisce in silenzio. Il rimedio sta in `layouts.run` e
non nel renderer — una passata finale che sovrascrive `pos` per i nodi fissati, **poi re-instrada
gli archi e ricalcola il bbox**. Senza il secondo passo gli archi resterebbero attaccati a dov'era
il nodo, e `misura()` — che conta gli incroci sulla geometria disegnata — direbbe il falso proprio
sulle mappe che l'utente ha sistemato a mano.

**G2 — `creaNodo` non sa fare un nodo estratto.** Cabla `origine:'utente'` e accetta soltanto
`testo · comeFiglioDi · vicinoA · x · y · colore`. Il §3 di questo documento vive su `origine`,
`rimando` e l'`anchor`: **l'estrazione non è lavoro di interfaccia**, è un'estensione del modulo
puro con i suoi test. Il disco è già pronto e non va toccato — `mappe.normalizzaNodo` porta
`rimando`, `nota` e `origine` da sempre.

**G3 — `disegna.js` non ha ancora la regola cromatica di Braynr.** Oggi `origine==='utente'`
cambia il solo bordo (tratteggiato), e il colore viene sempre dal gruppo. Il §3 chiede l'opposto
come segnale primario: estratto dalla fonte = colore pieno, scritto ex novo = **grigio neutro**
finché non lo si colora. Il grigio si prende dal tema (`tema.muted`), non da un hex nuovo, e resta
scritto **ad attributi**: è la condizione perché l'export della fase C lo porti con sé.

## 12.2 Le quattro decisioni prese, e che cosa comportano

1. **La cascata del colore scende sul grafo intero**, non sul potato da `senzaRami`. Chi colora un
   ramo intende il ramo; un colore che cambia a seconda di quali rami erano aperti in quel momento
   sarebbe imprevedibile. Chiude la domanda lasciata aperta da chi ha scritto `modifica.colora`:
   la scelta la fa il chiamante, e il chiamante passa il grafo intero.
2. **«→ Mappa» senza una mappa attiva crea una mappa nuova vuota** col solo frammento, intitolata
   al capitolo, e lo dice col toast. Non semina una copia della vista generata: un gesto piccolo
   non deve produrre da sé venti nodi che nessuno ha chiesto. La mappa cresce da ciò che si estrae
   — che è poi il modo di lavorare di Braynr.
3. **Le posizioni manuali valgono finché non si cambia motore.** Cambiando motore si azzerano, e
   qui sta la conseguenza da non sottovalutare: **il cambio motore diventa un'operazione
   distruttiva**. Passa quindi da `modifica.annullabile()` come tutte le altre e lo dichiara
   («12 posizioni azzerate»), altrimenti sarebbe un tasto che butta via mezz'ora di sistemazione
   senza nemmeno nominarla. Nel menu del nodo resta «Libera la posizione» per il caso singolo.
4. **Il ✂ ritaglio d'area entra, ma in coda** (lotto 6): non è una rifinitura dell'editor, è un
   **tipo di card nuovo** — `disegna.js` oggi non sa disegnare un nodo immagine.

Una quinta decisione, minore, la prende questa sezione: **una mappa dell'utente ricorda i rami che
avevi chiuso**, la generata no. Negli id generati (`n1`, `n2`…) un ramo chiuso non sopravvive alla
ricostruzione — è la ragione di `MAPPA.identita` — mentre nel file gli id sono stabili, e «la mappa
ricorda come la stavi guardando» è già il patto dichiarato per `vista`.

## 12.3 I sei lotti

Tutti i lotti dal primo in poi convergono in `App/StudIA.html`: si fanno **in fila**, non in
parallelo, per la stessa ragione per cui lo strato dell'interfaccia era stato tenuto fuori dal
ventaglio della fase D.

| # | lotto | file | dipende da |
|---|---|---|---|
| **L0** ✅ | il livello puro che manca (G1·G2·G3) | `layouts.js` · `grafo.js` · `modifica.js` · `disegna.js` · `lib/mappe.js` + i tre file di test | — |
| **L1** ✅ | il registro «Mie»: elenco, apertura, semina, salvataggio | `StudIA.html` | L0 |
| **L2** ✅ | i gesti sulla tela: crea, rinomina, sposta, elimina, ⌘Z, cestino | `StudIA.html` · `disegna.js` | L1 |
| **L3** ✅ | archi, porte di trascinamento, linking words | `StudIA.html` · `disegna.js` · `relazioni.js` | L2 |
| **L4** ✅ | menu contestuale unico (nodo · arco · vuoto) e colori | `StudIA.html` | L3 |
| **L5** ✅ | estrazione: `Alla mappa` dal menu contestuale (⌘⇧C resta da fare) | `StudIA.html` · `modifica.js` | L1 (basta), meglio dopo L4 |
| **L6** | ✂ ritaglio d'area → nodo immagine | `disegna.js` · `main.js` · `preload.js` · `StudIA.html` | L5 |

### L0 — il livello puro

- `layouts.run()`: passata finale sulle posizioni fissate, re-instradamento, bbox. Test: un nodo
  con `x/y` resta dove è stato messo su tutti e quattro i motori, l'arco lo raggiunge davvero, e
  `misura()` conta sulla geometria nuova.
- `modifica.creaNodo()`: accetta `origine` (`'utente'` di fabbrica, `'fonte'` ammesso — `'generata'`
  no, quella marca la mette solo `mappe.daGrafo`), `rimando` (copiato, non condiviso) e `nota`.
  Più `estrai()`, che è `creaNodo` con l'origine giusta e il rimando obbligatorio, e
  `libera(g,id)` / `liberaTutte(g)` per il punto 3 delle decisioni.
- `disegna.js`: colore per origine (G3), e — servirà a L3 — un **bersaglio cliccabile per gli
  archi**: un path invisibile spesso dentro `.marco`. Una linea da 1,4px non si prende col mouse,
  e un menu contestuale sull'arco senza un bersaglio è un menu che non si apre.
- `lib/mappe.js`: `x` e `y` entrano in `CAMPI_NODO` (oggi transitano per il ramo dei campi non
  nominati: funziona, ma un campo che serve va scritto dove si legge il vocabolario), e `vista`
  accoglie i rami chiusi.

**Com'è finito (8 agosto).** Fatto in tre deleghe parallele su insiemi di file disgiunti, con la
regola del fissaggio scritta identica nei tre mandati. Quattro cose sono state decise scrivendo, e
valgono da qui in poi:

1. **`fissato(n)` sta in `grafo.js`**, non in `modifica.js` dov'era nata. `layouts.js` non può
   dipendere dalle operazioni di modifica — quelle stanno *sopra* i motori, e farle richiedere dal
   basso invertirebbe le dipendenze; `grafo.js`, che è il vocabolario del modello, lo richiedono
   già tutti e due. `modifica.fissato` resta esportata e **delega**: è una porta, non una copia, e
   c'è un test che confronta i due verdetti su nove casi limite.
2. **L'instradamento è entrato in `finisci()`**, che ora è l'unico punto in cui si passa dalle
   posizioni agli archi: i motori non instradano più per conto loro, passano una ricetta.
   Il re-instradamento dopo le coordinate a mano non è così un secondo passaggio che qualcuno può
   dimenticare — è l'unico passaggio, e arriva sempre dopo.
3. **`estrai()` senza puntatore non rifiuta**: crea il nodo come `'utente'` e lascia che sia chi
   chiama a dirlo. Il testo del frammento è lavoro già fatto dall'utente e il puntatore è il
   contorno; un gesto che non fa niente e non lo dice è la classe di guasto peggiore.
4. **La severità sulle coordinate cambia con lo strato.** `modifica` accetta solo numeri veri
   (`coordinata()`), perché lì arrivano da un evento del puntatore e l'invariante che vale la pena
   avere è «ciò che si scrive soddisfa sempre `fissato()`»; `lib/mappe.js` in lettura raddrizza
   anche `"120"`, perché lì arriva un file che può essere stato scritto a mano o da una versione
   vecchia. ⚠️ Nella stessa passata è emerso che `creaNodo` e `sposta` usavano `isFinite(+v)`, e
   `+null` fa **zero**: un chiamante distratto avrebbe inchiodato un nodo nell'origine, per sempre
   e in silenzio. Innocuo finché nessun motore leggeva le coordinate; da G1 in poi, no.

Il giro intero — estrai → sposta → salva → apri → `run` → `svg` — è un test permanente in
`test/mappe.js` (sezione 15), non una prova fatta una volta a parte: è il punto in cui una delega
lascia i suoi difetti, e una rete che c'è ma non è agganciata è la classe di guasto del §7
dell'HANDOFF.

### L1 — il registro «Mie»

**Vincoli emersi dalla ricognizione dell'8 agosto** (tre agenti in sola lettura, prima di scrivere
una riga). Sono i punti su cui l'interfaccia si appoggerebbe a un'ipotesi sbagliata:

- ⚠️ **Il ponte si chiama `window.vault.mappe`, non `studia.mappe`** (`contextBridge
  .exposeInMainWorld('vault', …)`), ed è **asincrono** — a differenza di `vault.notes.*`, che è
  sincrono e scrive con `fs` dentro il preload. Ne discende tutto il resto del salvataggio:
  `beforeunload` non serve a niente (la finestra si chiude prima della risposta), serve un
  **guardiano di sequenza** perché due risposte possono tornare fuori ordine, e il pallino di
  modifica si spegne nel `.then`, mai prima.
- ⚠️ **`App/assets/mappa/modifica.js` non è caricato dalla pagina**: i tag in testa a `StudIA.html`
  caricano gli altri cinque moduli. Finché non si aggiunge, `MappaModifica` è `undefined` e tutto
  il livello di modifica di L0 è irraggiungibile.
- `elenco()` non distingue «nessuna mappa» da «corso inesistente» da «vault sparito», e torna
  `mappe:[]` **con** `error` quando la cartella è illeggibile: si guarda `error` **prima** di
  `length`, o si dice «non hai ancora mappe» a chi sta guardando un errore di permessi.
- La chiave dell'elenco è **`file`, mai il titolo**: due mappe possono legittimamente chiamarsi
  uguale. E il nome del file non si costruisce mai: si usa quello tornato da `salva`/`semina`.
- Dopo ogni salvataggio si rimpiazza lo stato locale con `r.mappa`: `salva` pota in silenzio (id
  doppi, cappi, archi verso nodi morti) e può restituire meno nodi di quanti gliene hai dati.
- I campi ignoti sopravvivono **solo sui nodi**. Su archi, su `vista` e sulla mappa spariscono al
  primo salvataggio: nessuna leva nuova in `vista` senza prima nominarla in `lib/mappe.js`.
- `semina` va chiamata col **grafo intero**: con quello potato i nodi chiusi spariscono per sempre
  dalla copia e i loro archi cadono senza un conteggio. Ed è l'unico canale che può far
  **rigettare** la Promise.
- `glossario` e `fonti` non sono leve di vista: sono parametri di *generazione*. Nel registro
  «Mie» non comandano niente e vanno spenti come già si spengono TD/SX sugli anelli.
- ⚠️ `#mappaView` ha `container-type:inline-size`, quindi è il blocco contenitore dei discendenti
  `position:fixed` **e** un contesto di impilamento: ogni popover, menu o tendina nuova va **fuori**
  da `#mappaView`, com'è già per `#mappaPop`. Dentro, `popAt()` lo posizionerebbe nel posto
  sbagliato e finirebbe comunque sotto la topbar.
- ⚠️ La regola che nasconde il resto della pagina è un elenco (`main > article | .nav | footer`),
  non `main > *:not(#mappaView)`: qualunque figlio nuovo di `<main>` resta visibile con la mappa
  aperta e rifà il guasto dei 72px di troppo.

Il tasto `Mie` oggi è spento con un titolo che promette (`StudIA.html`, `#mRegistro`). Si accende
e porta con sé: la tendina delle mappe col pattern di `noteSelect`, «+ Nuova», «Modifica una
copia» — che semina dal **grafo intero**, non da quello potato, e con la vista corrente, perché la
copia deve aprirsi com'era quando l'hai chiesta.

Il salvataggio è quello degli appunti: debounce, pallino giallo di modifica non salvata, scrittura
atomica di là dal ponte (`studia.mappe.salva`). La vista si biforca ed è l'unico punto in cui i
due registri divergono davvero: per la generata resta in `localStorage` per corso (la mappa non
esiste su disco), per la mia sta **dentro il file** — è ciò per cui `mappe.VISTA` è stato scritto.

**Com'è finito (8 agosto).** Il registro «Mie» funziona: si apre, elenca per uso recente, crea,
semina da «Modifica una copia», salva da solo e mostra il pallino giallo. Provato **dalla porta
vera** — Electron con la porta di debug, click veri via `Input.dispatchMouseEvent`, disco vero —
con 26 controlli, e il vault lasciato com'era (le due mappe di prova rimosse alla fine).

Quattro cose decise scrivendo:

1. **Una leva della vista non fa partire il salvataggio.** Uno slider manda un evento per campione
   e la rotella pure: si segna `vistaSporca` e si scrive col primo salvataggio vero o alla
   chiusura. Il contenuto invece passa da `mappaTocca()`, **una porta sola** che accende il pallino
   e riarma il debounce — perché in L2 i mutatori saranno molti e ognuno che se lo gestisse da sé
   sarebbe la trappola ④ (negli appunti la sorgente è una sola, e per questo là non si vede).
2. **Il salvataggio ha due guardie che gli appunti non hanno**, e le impone l'IPC asincrono: `seq`
   scarta la risposta vecchia di due salvataggi in volo, `rev` decide se adottare il grafo potato
   che torna dal disco — se l'utente ha modificato durante il viaggio, adottarlo butterebbe via
   quelle modifiche. E un salvataggio fallito **riarma** il timer: negli appunti non riprova più.
3. **Cambiando corso la mappa tua si salva e si chiude**, tornando al registro generato. Tenerla
   aperta vorrebbe dire che il salvataggio dopo finisce in `MAPPE/` di un altro corso. Lo stesso
   punto rimedia a un difetto vecchio: le leve della vista restavano quelle del corso di prima e
   la prima manopola toccata le riscriveva sotto la chiave nuova.
4. **Riaprire la mappa già aperta è un no-op.** Negli appunti lo stesso gesto ricarica il corpo dal
   disco e perde ciò che stavi scrivendo: difetto noto, non ereditato.

Rimandato a L2, di proposito: **il cambio motore che azzera le posizioni a mano** (decisione 3 del
§12.2). È distruttivo, e la decisione stessa dice che deve passare da `annullabile()`: farlo prima
che la pila di annullamento sia agganciata vorrebbe dire consegnare la distruzione senza la rete.
`MappaModifica.liberaTutte` è pronta e restituisce già quante posizioni azzererebbe.

### L2 — i gesti sulla tela (§4.1)

Doppio click sul vuoto crea, Tab il figlio, Invio il fratello, doppio click sul nodo rinomina, Canc
elimina, trascinare il nodo lo sposta. Il trascinamento del nodo va distinto dal pan: `pointerdown`
su `.mnodo` sposta il nodo, sul vuoto sposta la mappa — la soglia dei 3 unità che salva il click
c'è già e vale per tutti e due. La casella di scrittura è un input HTML in overlay sopra la card,
non un `foreignObject`: l'esportazione lo perderebbe, e comunque un campo aperto non si stampa.

⌘Z chiama `annullabile()` **prima** di ogni distruttiva, con l'etichetta di `descriviAzione()`, e
la voce del menu dice che cosa annullerebbe.

⚠️ **Nessuno di questi gesti esiste solo come gesto**: ognuno ha la sua voce nel menu di L4, con la
scorciatoia scritta accanto (§5). Conseguenza sull'ordine dei lavori: L2 non scrive i suoi gesti
come gestori d'evento a sé, ma come **funzioni chiamabili** — `mappaCrea`, `mappaFiglio`,
`mappaFratello`, `mappaRinomina`, `mappaElimina`, `mappaLibera` — che il gesto e la voce di menu
invocano allo stesso modo. Due strade che portano allo stesso posto devono passare per la stessa
funzione: è la trappola ④, e qui si eviterebbe di scoprire fra un mese che il menu elimina senza
mettere lo stato nella pila degli annullamenti mentre il tasto Canc lo fa.

**Com'è finito (8 agosto).** Ci sono tutti: doppio click sul vuoto crea, **Tab** figlio, **Invio**
fratello, doppio click rinomina, **Canc** elimina (i figli restano flottanti, e adesso lo si *dice*
col numero), trascinamento della card, **⌘Z** etichettato. Più il **cestino** in barra, chiesto
dall'utente: compare solo quando c'è una mappa aperta, la conferma la nomina, e dopo un rifiuto
l'elenco si ricarica invece di togliere la riga — `rimuovi` risponde `false` sia per «non c'era»
sia per «il disco ha detto di no». 33 controlli sull'app viva, gesti veri.

⚠️ **Il guasto grosso non era in L2: era in fase B, e stava lì da allora.** Cliccare una card non
apriva la sua fonte, **in nessuno dei due registri**. Causa: il trascinamento della mappa chiama
`setPointerCapture` sull'SVG, e da quel momento Chrome ridirige sull'elemento che cattura anche il
`click` — che arriva con `target` uguale a `<svg>`, quindi `closest('.mnodo')` non trova mai
niente. Non si vedeva nei controlli perché gli eventi sintetici mandati sull'elemento saltano tutta
questa storia, e non si vedeva sui pallini dei rami perché per loro il `pointerdown` esce prima e
non cattura mai. Misurato con `Input.dispatchMouseEvent`: prima del rimedio, zero fonti aperte.

Il rimedio cambia la regola per tutta la tela: **il bersaglio si prende al `pointerdown`** (dove è
ancora quello vero, in `MAPPA.giu`) **e si agisce al rilascio**, se nel frattempo il gesto non è
diventato un trascinamento. Vale anche per il doppio click, che arriva dopo il rilascio e ha lo
stesso problema — senza, un doppio click su una card sarebbe letto come «sul vuoto» e ci creerebbe
sopra un nodo.

Le altre decisioni:

1. **Il click sulla card seleziona**, nel registro «Mie»: è il gesto da cui dipendono tutti gli
   altri, e non può essere anche quello che apre una fonte. La fonte prende il suo bersaglio — il
   **pallino nell'angolo**, che già diceva «qui sotto c'è qualcosa» e adesso si preme. Disegnato
   come *fratello* della card, per la stessa ragione del pallino dei rami.
2. **Un nodo creato e lasciato senza testo se ne va** quando la casella si chiude: non è una
   scelta, è un gesto interrotto, e lascerebbe una card muta sulla tela.
3. **Il trascinamento mette UN passo solo** nella pila degli annullamenti, con lo stato di prima
   del gesto: uno per `pointermove` avrebbe riempito i venti posti con lo stesso movimento.
4. **Con la mappa aperta le frecce ←/→ non cambiano più capitolo.** La guardia che c'era escludeva
   i campi di testo per `tagName`, ma dentro un SVG il bersaglio è un `<g>`: si cambiava pagina
   sfiorando una freccia mentre si lavorava sulla tela.

### ⚠️ La cornice e il verso — riparati il 13 agosto 2026

**La cornice segue la struttura, non la mano.** La vista è a due strati: il `viewBox`, che
`disegna.js` ricava dal rettangolo di tutti i nodi (senza stato, non salvato, adattato dal
browser), e lo zoom dell'utente (`MAPPA.z`, con stato, salvato, l'unico che rotella e ⤢ toccano).
Il trascinamento campionava il punto di partenza in coordinate del `viewBox` mentre
`mappaRidisegna` lo rifaceva a ogni `pointermove`: nodo che esce → cornice più grande → tutto
rimpicciolisce → lo stesso pixel vale più unità → il nodo corre di più. Un anello, non un
rimpicciolimento. E ⤢ non salvava, perché agiva sull'altro strato.
Regola nuova: **il `viewBox` si rifà quando cambia la struttura — quanti nodi, quanti archi — non
quando la mano sistema le posizioni.** Scioglie il congelamento «Adatta alla vista» (che ora
scioglie E ridisegna), un cambio di vista, e la struttura che cambia, riconosciuta da una FIRMA e
non da un elenco di chiamanti. Provato in `prova-mappa-trascina.js` — il gesto centrale
dell'editor, che fino a quel giorno non aveva nessuna prova.
**Non fatto, e per ora non serve**: il limite del nodo all'area visibile. Con la cornice ferma il
difetto sparisce; resta qui come rete se un giorno si riuscisse ancora a perdere un nodo.

**Il verso (TD/SX) era acceso e inerte.** Il cambio motore aveva la sua funzione e dentro la
regola che conta per le mappe tue — ogni nodo ha una posizione a mano, un motore non muove ciò che
è fissato, quindi prima si liberano le posizioni, si dichiara quante e si mette un passo nella
pila. L'orientamento stava in tre righe dentro il gestore del click e quella regola non l'aveva
mai vista: premere TD/SX cambiava la leva e lasciava il disegno identico. Ora è
`mappaOrientamento(verso)`, gemella di `mappaMotore` — **la dimostrazione che «un gesto è una
funzione chiamabile, non un gestore di eventi» non è pedanteria**: è esattamente lì che le due
strade sono divergute. ⚠️ I due versi si chiamano `td` e `lr`, non «sx».

**E il seguito, il 14 agosto: sugli anelli erano spenti e non lo dicevano.** Rimessa a posto la
funzione, Giacomo continuava a vedere due tasti inerti — sulle SUE mappe, e per un'altra ragione:
quella mappa è salvata sul motore **anelli**, dove il verso non vuol dire niente ed è spento
apposta. ⚠️ Ma sulle mappe tue i quattro motori escono dalla barra (al loro posto le memorie),
quindi non si vede nemmeno quale motore è attivo; e un bottone `disabled` **non emette il click**,
quindi non può spiegarsi — il `title` c'è, ma sta sotto il puntatore, e chi preme un tasto morto
non ci passa sopra col mouse. Regola nuova, buona per ogni comando spento di questa app: **se ha
una ragione da dare si spegne con `aria-disabled`** (stessa veste, ma il click arriva), e la
ragione si dice insieme a DOVE si rimedia — qui «il motore si cambia col tasto destro sulla tela».
Il rifiuto vive dentro `mappaOrientamento`, non nel gestore del click, così vale da qualunque
porta arrivi. Provato in `prova-mappa-trascina.js`.
**Aperto, decisione di Giacomo**: su una mappa tua il motore attivo resta invisibile finché non si
apre il menu della tela. Un'etichetta in barra lo direbbe, ma rimetterebbe in barra ciò che era
stato tolto di proposito.

### L3 — archi e linking words (§4.2–4.3)

La porta di trascinamento è un **fratello** della card nell'SVG, mai un figlio: dentro erediterebbe
il click che apre la fonte, ed è la lezione già pagata dal pallino dei rami. Va anche tenuta
distinta dagli altri due segni che vivono sul bordo — il pallino del ramo (centro del lato da cui
escono i figli) e quello della fonte (angolo in alto a destra, dentro la card).

Doppio click sull'arco apre il campo con il `datalist` dei verbi di `relazioni.js`. Il verbo si
salva come battuto; **famiglia e colore si ricavano in lettura** e non si scrivono mai.

### L4 — il menu contestuale (§5)

Scritto **una volta sola**, con le voci condizionali: la fonte compare solo se c'è il rimando,
nella vista generata restano navigazione e focus. Le voci di lettura serviranno alla fase G, le cui
due funzioni di selezione (`grafo.vicini`, `grafo.parentela`) sono già scritte e provate. Nella
riga dei colori, i 5 preset e il picker, con la spunta «applica ai discendenti» che scende sul
grafo intero (decisione 1).

**Com'è finito L3 + L4 (9 agosto).** Il menu contestuale c'è ed è **uno solo**: su nodo, su arco e
sul vuoto, con le voci condizionali e — regola chiesta dall'utente — **ogni gesto del §4.1 ha la sua
voce, con la scorciatoia scritta accanto**. Gli archi si tirano dalla **porta** o si fanno con
«Collega a…» a due click; il verbo si scrive al volo, con il `datalist` dei 68 verbi che è **la
stessa tabella** che il §13.5 impone come enum al modello. 40 controlli sull'app viva.

Le famiglie di relazione sono passate da 8 a 11, **dopo averle misurate** su 5.259 frasi di TD74:
`intervento` (192 frasi, 88 capitoli su 210), `misura` (156, 90), `definizione` (97, 68) — tutte e
tre più frequenti delle quattro già in uso più rare. Tre correzioni che la misura ha imposto al
§13.5: «si misura con» vale quasi nulla (la famiglia sta sui transitivi — *indica* 64, *segnala* 38);
**«è» è fuori dal vocabolario** (1.882 frasi su 5.259: è la copula, e `famigliaDi` cerca per
sottostringa, quindi avrebbe fatto da calamita); «è esempio di» **non compare mai** nel corpus, che
esemplifica per inciso.

⚠️ **Il commento in testa a `relazioni.js` era falso**: la palette non era «leggibile anche a chi
confonde rosso e verde». Misurato in ΔE2000 sulle dicromazie: `dipendenza`/`appartenenza` stanno a
**3,0**, `trasformazione`/`opposizione` a **4,5**. Era un'intenzione, non una misura. Le tre tinte
nuove stanno tutte a ≥9,2 e il test tiene scritto quali sono le due coppie deboli, così il giorno
che si ripara la palette qualcuno se ne accorge.

**Tre guasti trovati provando, tutti e tre invisibili ai test:**

1. ⚠️ **Nel motore Percorso gli archi cliccabili non erano quelli della mappa.** Là `res.archi` sono
   i segmenti del **filo** che numera il percorso, e i legami veri passano in `res.extra`, in
   filigrana: il gruppo `.marco` — cioè il bersaglio e i capi che il menu legge — finiva sul filo.
   Si poteva «invertire» un segmento inesistente, e gli archi scritti dall'utente non si potevano né
   etichettare né togliere. Ora il `.marco` sta sui legami veri e il filo è `pointer-events="none"`.
2. ⚠️ **La linking word copriva il proprio arco.** Un `<text>` intercetta il puntatore: prendendo il
   legame per la parola — il punto in cui la mano lo cerca per primo — il menu non si apriva. Ora le
   etichette sono `pointer-events="none"`: si vedono, e a rispondere è l'arco che sta sotto.
3. **La porta è opt-in** (`opt.maniglie`) e il renderer non la chiedeva: il markup non esisteva. È il
   punto di contatto fra il modulo puro e l'interfaccia, cioè dove una delega lascia i suoi difetti.

**Una correzione di metodo, per verbale.** Il primo rimedio che avevo scritto per il difetto n.1 era
sbagliato — avevo ipotizzato una gara sul fuoco fra `pointerup` e `click`, e avevo perfino scritto
in un commento «misurato», che non era vero. Tolto tutto: verificato che senza quel rinvio è verde
lo stesso. Un commento che dichiara una misura mai fatta è peggio del codice che accompagna.

### L5 — l'estrazione (§3)

`#selNote` diventa doppio: `✏ Appunta · 🗺 → Mappa`. Il frammento entra come nodo `origine:'fonte'`
con l'`anchor` (la frase attorno, la stessa regola degli appunti) e il legame al capitolo.

Per ⌘⇧C c'è un pezzo da spezzare prima, ed è una trappola ④ in formazione: `citaCorrente()` oggi
impasta due cose — *qual è il punto che stai guardando* e *scrivilo come link nell'editor*. Si
estrae `puntoCorrente()`, che torna il punto e basta, e i due consumatori (il link nell'appunto, il
nodo nella mappa) lo leggono. Due letture separate del minuto corrente divergerebbero, come è già
successo con l'ordinamento delle lezioni.

Il toast dice **sempre** dov'è finita la cattura: con due superfici che accettano lo stesso tasto,
l'ambiguità si risolve dichiarando, non vietando.

### L6 — il ritaglio d'area (§3.3)

Velo di cattura sopra l'anteprima, `capturePage(rect)`, `.webp` in `MATERIALI/Figure/` con la
convenzione dei ritagli Chandra (`<stem>__pNNN_uK.webp`, `u` = utente) e il rimando alla pagina.
Il pezzo vero è il **nodo immagine** in `disegna.js`: una card di tipo nuovo, ad attributi, che
regga il ridimensionamento e l'export.

## 12.4 Come si verifica

I moduli puri con `npm test` (che ora esegue tutti e tre i file: una rete che c'è ma non è
agganciata è la classe di guasto del §7 dell'HANDOFF).

I gesti **solo** via CDP con `Input.dispatchMouseEvent`. Gli eventi sintetici mandati sull'SVG
saltano l'hit-testing: su questa stessa mappa sono già passati tutti mentre per l'utente non
funzionava nulla. E ogni superficie nuova — menu, campo inline, hint della modalità collega, velo
del ✂ — nasce con `pointer-events:none` da inerte: `.mvuota` era esattamente quel guasto, e la
rete `[hidden]{display:none!important}` copre la metà del problema, non tutto.

## 12.5 Che cosa resta fuori, e va detto

Export PDF (fase C) e Focus (fase G) non entrano in questo giro. Il Focus è però la ragione per cui
il menu contestuale si scrive una volta sola in L4, e l'export è la ragione per cui ogni pezzo
nuovo di `disegna.js` continua a disegnare ad attributi: due lavori futuri che decidono già oggi
come si scrive questo.

---

# 13. Le mappe generate cambiano oggetto: dai contenitori ai concetti

> **9 agosto 2026.** Rifonda il §6 e cambia la scala principale della vista generata. Nasce da
> un'osservazione dell'utente sulle mappe consegnate in fase B, e da una distinzione presa in
> prestito da «Leggere per sapere» di Alessandro de Concini (skill `leggere-per-sapere`).

## 13.1 Che cosa era sbagliato

Le mappe generate mettono la radice sul titolo del capitolo e al primo livello **i contenitori**:
«Punti chiave», «Note e materiali», «Glossario». Cioè mappano **come il capitolo è confezionato**,
non che cosa dice. I rami sono le scatole, non i concetti; e su una mappa così nessuna linking word
può voler dire niente, perché fra una scatola e il suo contenuto l'unica relazione possibile è
«contiene».

La mappa deve nascere dai **paragrafi espositivi** — dal testo che spiega — e la sua ossatura sono
i concetti che quel testo mette in rilievo.

## 13.2 Due famiglie di mappe, due autori (la distinzione che le separa)

De Concini distingue due cose che StudIA stava confondendo:

- la **parola importante** è dell'autore: è ciò che lui ha messo in grassetto per attirare
  l'attenzione di chiunque legga;
- la **parola chiave** è del lettore: nasce dal suo ragionamento sul contenuto informativo del
  periodo, e vale **solo perché l'ha trovata lui** — «il punto non è possederle, è trovarle».

Da qui la separazione netta, che risolve anche il conflitto fra i due registri già in piedi:

| | **Generate** | **Mie** |
|---|---|---|
| di chi è la mappa | dell'**autore**, e l'autore è StudIA: i capitoli li scrive lui, quindi i suoi grassetti sono legittimamente le sue parole importanti | dello **studente** |
| materia prima | **parole importanti** (grassetti dei paragrafi), glossario, rimandi | **parole chiave**, trovate leggendo |
| scala | **corso** (principale) · lezione (annidato) · capitolo | **capitolo** (principale) · lezione (a scelta) |
| chi la costruisce | l'app, deterministicamente + AI per i verbi | l'utente, a mano |
| su disco | mai (proiezione); si salva solo l'**estrazione** per capitolo | `MAPPE/*.json` |

⚠️ La stessa obiezione di de Concini («non puoi limitarti a osservare i grassetti») **resta valida
per lo studente** e per questo la mappa delle parole chiave non si genera mai: si costruisce.

## 13.3 Le misure, che decidono la forma (TD74-DSA, 210 capitoli, 16 lezioni)

| | |
|---|---|
| grassetti nei capitoli | **3.993**, in **tutti e 210** i capitoli |
| termini distinti (minuscolo) | **2.706** |
| voci di glossario già definite | **1.098** |
| termini presenti in ≥2 capitoli | 273 |
| **termini presenti in ≥2 LEZIONI** | **193** · in ≥3 lezioni: 63 · in ≥5: 9 |

I primi ponti: *memoria di lavoro* (9 lezioni), *velocità* (7), *flessibilità* (6), *comprensione*
(6), *lessicale*, *impotenza appresa*, *dislessia*, *accuratezza*, *comprensione del testo* (5).

**Conseguenza di disegno**: la mappa di corso non è «tutti i concetti» — sarebbero 2.706 nodi,
cioè niente. È la **spina dei ponti**: i concetti che compaiono in più lezioni. La soglia (≥2, ≥3, ≥5
lezioni → 193, 63, 9 nodi) è una leva del ⚙, non una costante. Tutto il resto vive annidato e compare
aprendo il ramo, con la meccanica dei rami che si chiudono già scritta.

**Un cross-link non si chiede al modello: si conta.** «Lo stesso concetto compare in due lezioni» è
un fatto misurabile, e `cross: true` esiste già nel modello e si disegna tratteggiato.

## 13.4 Le decisioni prese (9 agosto, con l'utente)

1. **Scala della vista generata: corso · lezione · capitolo.** ~~Il capitolo **resta**, ma rifatto
   con la stessa grammatica delle altre due — concetti dai paragrafi, non i contenitori dei
   callout. Resta perché è l'unica gratis e si apre stando dentro il capitolo che si legge.~~
   ⚠️ **Rovesciata il 10 agosto 2026, dall'utente: le scale sono DUE.** Del capitolo non si genera
   più niente — quella mappa la fa lo studente, scegliendo lui che cosa metterci. `MAPPA.ambito`
   vale `corso` o `lezione`, e un `capitolo` rimasto in una config vecchia viene *corretto*, non
   solo mostrato male. Il verbale è in `HANDOFF-SESSIONE-2026-08-10.md` §3.1, eliminato il 30 agosto 2026 e ripreso
   con `git show 52b0ad5:HANDOFF-SESSIONE-2026-08-10.md`.
2. **Prima il giro gratis, poi i verbi.** Nodi dai grassetti + glossario, archi **muti** da
   co-occorrenza e definizione: zero chiamate. Si guarda se la spina regge, e solo dopo l'AI mette
   i verbi sugli archi sopravvissuti al filtro. Se la forma non funziona senza verbi, non
   funzionerà nemmeno con.
3. **«Modifica una copia» semina solo la radice** (titolo del capitolo o della lezione). Copiare la
   generata intera sarebbe consegnare allo studente le parole importanti di StudIA al posto delle
   sue: è esattamente la «pappa pronta» del §5 di de Concini.
4. **L'identità del concetto è il problema vero**, non il disegno. *comprensione* e *comprensione
   del testo*, *tempo* e *tempi*: se non si fondono il ponte non nasce, se si fondono troppo nasce
   falso. Il glossario è il dizionario naturale (1.098 voci **con definizione**): un grassetto che
   coincide con una voce ne eredita definizione e identità. Id stabile come le carte del ripasso —
   hash del termine normalizzato — più una lista di **alias**.
5. **L'estrazione è un artefatto per capitolo**, pagato una volta e scritto su disco come le schede
   dei materiali. Le mappe di lezione e di corso sono **ri-assemblaggi deterministici**: cambiare
   scala, soglia o filtro costa zero. 210 capitoli sono 210 chiamate, e nessuno le vuole rifare per
   cambiare una vista.

## 13.5 Le linking word: da classificatore a vincolo

La domanda era se serva ancora categorizzarle. **Sì, ma cambia il mestiere che fanno.**

Oggi `relazioni.js` classifica *a posteriori* un verbo scritto dall'utente. Con l'AI che genera gli
archi il problema si rovescia: senza vocabolario chiuso il modello scriverà «causa», «provoca»,
«determina», «induce», «comporta» per la stessa relazione, e usciranno cinque sfumature di
arancione che non discriminano niente. **Il colore è un canale: se non discrimina è rumore** — e su
una mappa di corso gli archi sono centinaia.

Quindi:

- le famiglie diventano un **enum nello schema** mandato al modello, non una raccomandazione in
  prosa. È la trappola ① dell'HANDOFF, già pagata tre volte: la regola va dove il modello guarda;
- **il modello emette SOLO il verbo**, scelto dal vocabolario. Famiglia e colore si ricavano in
  lettura con `famigliaDi()` — è la decisione 3 del §12.2, e vale a maggior ragione qui: far
  emettere anche la famiglia significa due verità sullo stesso arco, che divergono al primo verbo
  corretto a mano;
- **il datalist di L3** (i suggerimenti all'utente) e l'enum del modello sono **la stessa tabella**:
  se divergono, la mappa dell'utente e quella generata si colorano con due leggi diverse.

Le otto famiglie attuali reggono, ma sono nate per mappe concettuali generiche. A un corpus
**didattico espositivo** ne mancano tre, e nel corpus TD74 si vedono dai termini più ricorrenti:

| famiglia da aggiungere | verbi | perché oggi finisce male |
|---|---|---|
| **definizione** | è, si definisce, significa, si chiama | «è esempio di» sta sotto *gerarchia*, che confonde iponimia ed esemplificazione: in un capitolo didattico sono i due archi più frequenti |
| **misura · valutazione** | si misura con, si valuta con, si osserva in, indica | *prove zero*, *analisi qualitativa*, *accuratezza*, *velocità* → oggi cadono in *altro* |
| **intervento · compenso** | compensa, riduce, si interviene con, dispensa da, potenzia | metà del corpus DSA (*sintesi vocale*, *strumenti compensativi*, *potenziamento*) → oggi cade male dentro *controllo* |

Da verificare sul corpus vero prima di fissarle: si contano le relazioni estratte per famiglia, e
una famiglia che non si riempie non serve.

## 13.6 Un regalo che arriva gratis

Una mappa di corso con archi diretti e verbi **è un DAG**, e il motore **Percorso** è già
scritto e provato: ordina per prerequisiti e dispone a serpentina col numero del passo. La mappa
d'insieme diventa allora la **scaletta di studio numerata** — cioè letteralmente il «capitolo zero»
del personaggio 🦅 Panoramica (P2.5 di PIANO-BRAYNR) e l'anima del 🐢 Sequenziale. Non è lavoro in
più: è un motore già acceso che trova finalmente il suo dato.

## 13.7 Che cosa cambia nei lotti già pianificati

- **L1** — «Modifica una copia» semina solo la radice (decisione 3). Una riga in `mappaCopia()`.
- **L3** — il `datalist` dei verbi nasce dalla tabella condivisa col modello, non da `relazioni.js`
  così com'è: prima si fissa il vocabolario (§13.5), poi si scrive il campo.
- **L2 / L4** — invariati: i gesti e il menu sono del registro «Mie», che questa sezione non tocca.
- **Nuovo lotto, dopo L4** — la vista generata rifondata, in tre tappe:
  **G1** estrazione deterministica (grassetti + glossario + rimandi → concetti, alias, co-occorrenze),
  **G2** assemblaggio a tre scale con soglia dei ponti e apertura progressiva,
  **G3** i verbi dal modello, con enum e artefatto per capitolo.
  G1 e G2 non costano niente e si vedono subito; G3 si decide guardandole.
