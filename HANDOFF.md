# Handoff — StudIA, 3-5 agosto 2026

Stato consegnato: **574 controlli verdi** (`npm test`), app funzionante, tre progetti nel vault.

> **PUNTO DI RIPARTENZA (5 agosto, fine sessione).**
>
> Il lavoro in corso è il **§9**: Chandra è installato e la rilettura dei PDF funziona fino
> all'indice, ma le figure **non entrano ancora nel capitolo**. È il pezzo da cui ripartire, ed è
> descritto in fondo al §9 sotto «Che cosa resta».
>
> I corsi di `ai-literacy-anthropic` e `digital-education-outlook-conference-2026-oecd` restano
> **cancellati di proposito** (`CORSI/`, `_piano.json`, `scarti/` → Cestino): l'utente rigenera da
> zero. **Materiali e schede sono intatti** — 37 e 24 schede già pagate, nulla da rileggere.
> `TD74-DSA` non è stato toccato, se non per la riparazione delle etichette del §8.
> Il primo passo per quei due progetti è **la proposta dell'indice**, non l'elaborazione.
>
> Prima di toccare la pipeline, leggere il §7 e il §7-bis: sono due guasti diversi con lo stesso
> sintomo, ed è facile richiuderne uno credendo di aver chiuso l'altro.

---

## 1. Dove sono le cose (CAMBIATO: i percorsi vecchi non valgono più)

```
/Users/giacomomeschini/Claude/StudIA/
├── StudIA/           1,2 GB   ← l'APP (ex «StudIA-Vault», rinominata)
└── StudIA - file/     13 GB   ← i DATI (l'utente vuole spostarla nei Documenti)
```

Prima erano **una cartella sola**: codice e dati mescolati. Sono stati separati il 3 agosto.

Il `vaultPath` sta in `~/Library/Application Support/studia/config.json` ed è **la fonte di verità** su dove sono i dati. Non scrivere mai percorsi che assumono i dati dentro la cartella dell'app: `test/roundtrip.js` lo faceva, e dopo lo spostamento **15 controlli si SALTAVANO restando verdi**. Ora c'è `vaultReale()` che legge il config.

### I tre progetti

| progetto | corsi | materiali | schede |
|---|---|---|---|
| `TD74-DSA` | 16 | 106 file | 0 — **protetto**, la pipeline non ci scrive |
| `ai-literacy-anthropic` | 12 | 61 file | 12 |
| `digital-education-outlook-conference-2026-oecd` | 23 | 65 file | 24 |

Struttura di un progetto:
```
Progetti/<id>/
├── MATERIALI/{Video,Audio,PDF,Web,Trascrizioni,Indici-PDF,Indici-Web,Figure}
├── CORSI/<NN-slug>/<NN-slug>.md
├── APPUNTI/
└── _lavorazione/{_piano.json, schede/}
```

### Configurazione attuale

`StudIA - file/.studia/prefs.json`: motore **Claude Code** (`sonnet`), lingua parlata `en`,
lingua di scrittura non impostata → **italiano** di default.

---

## 2. Come far girare e verificare

### Controllo di versione (NUOVO, 5 agosto)

Fino a oggi StudIA **non era versionata**: nessun `.git`, nessuna cronologia. Ora c'è, e la radice
del repository è la cartella dell'app (`StudIA/`), non quella che la contiene.

Il primo commit fotografa l'intera applicazione, lavoro di quel giorno compreso: non esisteva una
cronologia da cui separarlo. `.gitignore` tiene fuori `node_modules/`, `dist/`, gli ambienti Python
e — per prudenza, anche se i dati vivono altrove — `Progetti/` e `config.json`, che contiene le
chiavi API cifrate.

⚠️ **I dati non sono versionati e non devono esserlo**: stanno in `StudIA - file/`, fuori dal
repository. Un `git clean` o un checkout non li tocca, ma nemmeno li salva: il loro backup è un
problema a sé.

```bash
cd "/Users/giacomomeschini/Claude/StudIA/StudIA" && npm test
```

Per pilotare l'app e ispezionarla dal vivo (indispensabile: molti guasti si vedono solo a runtime):

```bash
cd "/Users/giacomomeschini/Claude/StudIA/StudIA" && ./node_modules/.bin/electron . --remote-debugging-port=9333
```

Poi via CDP con Node 20: `node --experimental-websocket <script>` che fa `fetch('http://localhost:9333/json')`,
apre il WebSocket e usa `Runtime.evaluate`. Gli script usati stanno nello scratchpad di sessione.

⚠️ **`lib/` e `main.js` vivono nel processo principale: un `Page.reload` NON li ricarica.** Va riavviata
l'app. Una verifica è già girata su codice vecchio per questo motivo, dando un falso negativo.

⚠️ `App/StudIA.html` servito da `file://` può arrivare dalla cache anche con `ignoreCache`. Per accertarsi
che il renderer sia aggiornato: `fetch('wizard.js').then(r=>r.text()).then(s=>/frammento nuovo/.test(s))`.

---

## 3. Che cosa è stato fatto

### Riordino del filesystem
- Codice e dati separati; `StudIA-Vault` → `StudIA`; `config.json` riagganciato.
- Eliminato un **duplicato da 10 GB** di TD74-DSA (confrontati prima gli alberi: unici solo 2 log, salvati in `_lavorazione/log-copia-vecchia/`).
- 41 materiali orfani nella radice del vault spostati dentro il progetto OECD; 3 gusci di progetto vuoti cestinati.
- Rimosse le cartelle globali `Media/ Fonti/ Trascrizioni/ Indice-PDF/ Indice-HTML/` (vecchio modello a corpus unico).

### Scoping per progetto (era tutto globale)
`corpus.digest(vault, progetto)`, `mat.cartelle/trova/elenca(..., progetto, solo)`, `corpus:list`,
`prossimoNumero(v, progetto)`, `importa.destinazione(...)`, `ingest.py --progetto`, `preload.numeriPerProgetto`.

Il confine si decide su `mat.haMateriali(vault, id)` (esiste `MATERIALI/`?): chi ce l'ha vede solo i suoi,
chi non ce l'ha (vault vecchio) pesca ancora dal globale.

**Prima**: aprire l'Analisi sul progetto OECD leggeva — e faceva pagare — anche i 40 materiali sui DSA.

### Numerazione per progetto
Tre pezzi che **stanno o cadono insieme**: chi assegna il numero, dove atterrano i file, chi risolve `video:NN`.
L'OECD è stato rinumerato `79–102 → 01–24` (65 file, 24 JSON aggiornati anche all'interno).
TD74 resta `01–40`: i suoi **673 rimandi** in 140 capitoli non si toccano.

### Lingua
`ingest.py --lang` (prima `language="it"` era cablato: audio inglese trascritto in italiano inventato).
`lib/lingua.js` + iniezione in `provider.completa()` — **non nei singoli prompt**, che sono nove in cinque moduli.

### Robustezza delle risposte del modello
- `schede.entroSchema()` — ricorsivo: accorcia stringhe all'ultima parola, taglia liste, rimuove campi inventati e valori fuori enum. Scrive nel campo `note` che cosa ha toccato. **Non** aggiusta ciò che non si può aggiustare (campo obbligatorio mancante → resta errore).
- `scaletta.numeroDiFonte()` — se il modello cita un materiale per titolo invece che per numero, lo riconduce.
- Tetti delle schede alzati: temi 24→**40**, concetti 30→**50**, capitoli proposti 20→**30**.

### Capitoli: fonti raccolte e tasti di lettura

**Le fonti citate ora finiscono nel frontmatter.** Lo schema del capitolo prevede `videoRefs` e `sources`
— è da lì che il lettore costruisce il riquadro delle fonti in fondo — ma **nessuno li riempiva**: il prompt
chiede al modello di citare con `[vai a 12:30](video:05#t=750)` e lui lo fa, mentre gli elenchi restavano
vuoti. Un capitolo pieno di rimandi non mostrava nessuna fonte raccolta.

`genera.rimandiDa(dati)` li **ricava dal testo** (contenuto, inBreve, punti chiave, note), deduplicati e
ordinati per numero e minuto. Non si è chiesta al modello una seconda lista che ripete la prima: una cosa
scritta due volte prima o poi diverge.

⚠️ In `scriviCapitolo` i valori calcolati vanno messi **dopo** `dati` nell'`Object.assign`. Il modello
dichiara spesso `videoRefs: []`, e un valore calcolato messo prima verrebbe sovrascritto dall'elenco vuoto —
riproducendo il guasto. C'è un test che copre proprio il caso «il modello li dichiara vuoti».

**I tasti di lettura si distribuiscono sulla lunghezza.** Prima ne finiva uno su *ogni* `<p>`: nei capitoli
sintetici, fatti di frasi brevi, uno ogni due righe. Ora i titoli lo prendono sempre (ossatura della
navigazione) e i paragrafi solo quando dall'ultimo si sono accumulati `TTS_PASSO = 420` caratteri
(≈ mezzo minuto di parlato); un paragrafo già lungo se lo prende comunque. Misurato sugli 11 capitoli veri
del corso AI Literacy: **101 → 45 pulsanti, 55% in meno**. Il testo resta tutto ascoltabile: cambia solo
da dove si può far ripartire la lettura.

### Interfaccia
- Menu **progetti in topbar** + menu varianti (compare coi percorsi salvati, disabilitato finché i loro capitoli non esistono: vedi §5). Cambio progetto via `cambiaProgetto()`, **una funzione sola** condivisa coi menu delle Impostazioni.
- Elenco corsi filtrato per progetto, **numerato** (`01 · Titolo`) e in **sequenza didattica**.
- Wizard: pulsante «Riprendi la creazione guidata» (prima un progetto senza corsi era **irraggiungibile**); un solo comando di elaborazione che dichiara su cosa agisce; spunta «✓ N capitoli» letta **dal disco**.

---

## 4. Le trappole ricorrenti (leggere prima di toccare qualcosa)

**① Una regola dichiarata solo dove si GIUDICA la risposta è una trappola.**
Successo tre volte:
- i tetti delle schede stavano in `scheda.schema.json` ma non nello schema mandato al modello;
- `scaletta` chiedeva `materiale: {type:'string'}` senza dire che voleva il numero;
- la regola «usa i numeri» c'era **in prosa** nel prompt, ma il modello guarda **lo schema**.

Se aggiungi un vincolo, mettilo dove il modello lo legge.

**①-bis Un campo previsto dallo schema non è un campo riempito.**
`videoRefs` e `sources` esistevano nello schema del capitolo da sempre, e nessuno li scriveva. Quando aggiungi
un campo, verifica **chi lo popola**: se la risposta è «il modello, se se ne ricorda», meglio ricavarlo.

**② Errori silenziosi che si vedono come UI mancante.**
`gen:start` scriveva i capitoli nel piano in una forma che `scriviPiano` rifiutava, e **nessuno guardava il valore
restituito**: il corso restava «approvato» e la spunta non compariva mai. Controlla sempre gli esiti dei salvataggi.

**③ Il registro può mentire, il disco no.**
La spunta dei capitoli ora conta i file `.md` via `expandStato`, col piano come solo ripiego.

**④ Due copie della stessa logica divergono sempre.**
Già capitato con l'ordinamento dei corsi (`refreshCourseSelect` per numero, `primoCorsoVisibile` per titolo).
Ora `corsiOrdinati()` e `cambiaProgetto()` sono in un punto solo.

**⑤ `lib/reader-parser.js` estrae il parser del lettore da `StudIA.html`** a partire da `function _unq(`.
Quello che sta prima non entra nella sandbox e va fornito lì a mano (com'è per `escHtml`, `_mediaNum`, `_pdfNum`).

**⑥ Il ripulitore di schema per Gemini** (`lib/ai/google.js`) non deve filtrare le chiavi dentro `properties`:
lì sono **nomi di campo**, non parole chiave. `title` è entrambe le cose, e la confusione rendeva Gemini
inutilizzabile per quasi ogni chiamata strutturata. C'è un test che lo blocca in modo generale.

---

## 5. Varianti di percorso: il composer è agganciato all'app

**Scritto il 5 agosto 2026.** Il mockup è diventato una pagina vera; resta fuori la sola scrittura dei
capitoli per coppia corso+indice (vedi «Quel che manca», in fondo alla sezione).

L'idea: dalla **stessa base di materiali** ricavare più percorsi per studenti dello **stesso livello** ma con
**stili di apprendimento diversi** (non per età o grado scolastico).

### Forma su disco concordata

```
Progetti/<id>/
├── MATERIALI/            condivisi   (191 MB, pagati una volta)
├── _lavorazione/schede/  condivise   (pagate una volta)
├── CORSI/
│   ├── 03-delega--per-domande/   ← i capitoli, scritti UNA volta
│   └── 03-delega--sequenza/      ← l'altra versione, se qualcuno la sceglie
└── PERCORSI/
    ├── analitica.json    → { "01":"panoramica", "02":"casi", "03":"per-domande", … }
    └── sequenziale.json  → { "01":"sequenza",   "02":"sequenza", "03":"sequenza", … }
```

Un percorso è **una mappa corso → indice**, poche righe. L'unità di lavoro è la coppia **corso+indice**.

### Regole decise

1. **I capitoli si condividono.** Due percorsi che scelgono lo stesso indice per un corso usano gli stessi capitoli. Misurato sul mockup: con 3 percorsi di cui 2 simili, **91 → 60 capitoli, 34% in meno**.
2. **L'esportazione appiattisce.** `03-delega--per-domande` → `03-delega`. Chi riceve vede un progetto normale e non sa che esistevano altre varianti.
3. **Rigenerare un indice condiviso aggiorna tutti i percorsi che lo usano.** È voluto, ma va **detto prima di premere**: «questo indice è usato da 3 percorsi».
4. **Un personaggio segue un indice solo per corso** (trascinarlo altrove lo sposta, non lo duplica).
5. Rimandata: le varianti che **escludono** parte dei materiali. Per ora tutte usano tutto.

### Il composer (`App/composer.js` + `#composer` in `StudIA.html`)

Pagina piena, non modale stretta. Righe = i corsi del piano approvato; su ogni riga le card degli indici
proposti (numero variabile, lo zig-zag è previsto); 8 personaggi OpenMoji rotondi da trascinare sulle card;
in fondo i percorsi a colonne dinamiche coi capitoli in ordine numerico; alert sui percorsi con buchi, col
chip e le sigle dei corsi mancanti. Si apre da **wizard, passo «Capitoli»** e da **⚙ Impostazioni › Progetti**.

Gli 8 personaggi stanno in `lib/percorsi.js` (`PERSONAGGI`), sorgente unica per l'interfaccia e per i file su
disco: 🦉 Analitica · 🐢 Sequenziale · 🦊 Sintetica · 🐝 Pratica · 🐙 Trasversale · 🐇 Curioso ·
🐘 Ripassatore · 🦅 Panoramica. Animali di proposito: sono codepoint singoli e OpenMoji li rende sempre
(le emoji «professione» sono sequenze ZWJ e cadono sul font di sistema).

Le frasi **«Adatto a: chi vuole seguire la logica dell'autore senza saltare»** sono il campo `adattaA`, che il
modello già produceva e che ora la card mostra: è ciò che fa capire la differenza fra un indice e l'altro.

### Il campo «capitoli per corso»

In topbar del composer, più un campo per riga che lo scavalca su quel corso. Vuoto = lo decide il modello.
Quando c'è un numero, `lib/scaletta.js → vincoloCapitoli()` lo scrive nel messaggio: vale per **tutte** le
alternative, mai come variabile per differenziarle — lasciato libero il numero oscillava fra 2 e 8 sullo stesso
corso, e le scalette finivano per distinguersi per lunghezza invece che per principio organizzativo. La
copertura resta intera: si accorpa, non si lascia fuori. Il valore generale vive in `prefs.capitoliPerCorso`,
quello usato per un corso resta scritto nella sua cache.

### Canali e file

- `composer:stato` — piano, scalette in cache, percorsi salvati, personaggi: tutto in una chiamata.
- `scalette:tutte` (+ `scalette:progress|done|error`) — le scalette di più corsi **in fila, non in parallelo**:
  sono chiamate lunghe e un 429 in concorrenza ne farebbe cadere quattro invece di una. Senza `rifai` salta i
  corsi che hanno già una scaletta in cache, così riaprire il composer dopo un errore non ricompra il fatto.
- `percorsi:list` / `percorsi:save` — `save` manda lo **stato intero**: i percorsi spariti dal tavolo vengono
  cancellati dal disco, altrimenti il menu in topbar mostrerebbe varianti che non esistono più.
- `_lavorazione/scalette/<folder>.json` — le alternative pagate al modello, con `nCapitoli`.
- `PERCORSI/<personaggio>.json` — `{id, emoji, nome, slug, creato, aggiornato, scelte: {folder: {indice, nome, capitoli}}}`.
  Il **nome del file è il personaggio**: rinominare la variante non lascia due file dove prima ce n'era uno.

### Quel che manca (fase successiva)

Scrivere i capitoli per **coppia corso+indice**: `CORSI/03-delega--per-domande/` con il suo `_corso.md`, e
l'appiattimento in esportazione. Finché non c'è, `variantSelect` in topbar **compare ma resta disabilitato**:
le varianti esistono, i loro capitoli no, e un menu che si muove senza cambiare niente è peggio di uno spento.
`lib/percorsi.js → conteggio()` dice già quanti capitoli distinti servono e quanti se ne risparmiano.

---

## 6. Coda, in ordine di urgenza

1. **Le figure dentro il capitolo** (§9, «Che cosa resta»). È il lavoro in corso, ed è a metà: la
   rilettura scrive già figure e didascalie nell'indice, ma il capitolo non le può mostrare. Finché
   non si chiude, le ore di lettura avanzata producono un indice più ricco che nessuno vede.
2. **Ritentativo sugli errori passeggeri** in `provider.completa` (503/429/timeout). Non esiste **nessun** retry
   in `lib/ai/`: una cascata di 503 di Google ha fatto perdere 7 materiali e un intero indice, e la proposta è
   ricaduta sull'euristica **senza che fosse evidente**. ~25 righe in un punto solo, vale per tutti i fornitori.
3. **Scrittura dei capitoli per coppia corso+indice** (§5, «Quel che manca»): è ciò che accende il menu delle
   varianti in topbar. La struttura dati e il composer ci sono già.
4. **Sezione «estendi un corso»** nelle Impostazioni: va riscritta perché dica che cosa comporta estendere un
   corso già strutturato (richiesta esplicita dell'utente, mai affrontata).
5. **Badge di avanzamento** nel tab Progetti: `materiali 24/24 · analisi 24/24 · indice approvato · capitoli 2/7`.
   Da fare **dopo** le varianti, perché andrebbero disegnati sui percorsi e non sul progetto.
6. **I 70 capitoli con il riquadro orfano** (§8, in fondo): l'unico rimedio è riscriverli col prompt
   nuovo, e si paga. Decisione dell'utente, non ancora presa.
7. `_ARCHIVIO/` (6 MB) e `dist/` (372 MB) nella cartella dell'app: mai valutati. `_ARCHIVIO` è ora
   versionato — dentro c'è anche il mockup del composer del §5 — mentre `dist/` è escluso dal
   repository e resta eliminabile senza perdere niente.

---

## 7. Perché i PDF non venivano citati (indagato a fondo, causa certa)

Sintomo: nel progetto `ai-literacy-anthropic` i capitoli avevano **156 citazioni video e zero PDF**.

**Causa: il piano è nato su un digest amputato.** La proposta multiagente è delle 19:26 del 4 agosto;
gli indici dei PDF sono stati creati alle 23:24 e le relative schede alle 23:38. In quel momento
`corpus.digest` restituiva **12 materiali su 37**, perché un materiale senza indice **sparisce in
silenzio**: `lib/corpus.js:194` (`digestHtml`) e `lib/corpus.js:212` (`digestPdf`) fanno `if (!idx) return null`.

Il digest amputato rende ciechi in modo coerente quattro punti, e nessuno se ne accorge:
- `lib/schede.js` — `tutte()` itera su `dg.materiali`: alla pipeline arrivano 12 schede;
- `main.js:810` — il gate dell'80% è `12 >= floor(12*0.8)`, sempre vero: si va di multiagente
  «convinti» di avere il corpus intero;
- `lib/propose.js:148` — `recuperaMancanti` calcola i mancanti **contro lo stesso digest**: 12/12, nessun mancante;
- `main.js:857` — `plan:approve` non riguarda il corpus.

Poi la catena fino al sintomo: piano senza PDF → `lib/scaletta.js:188` filtra le fonti di ogni capitolo
su `materialiDi(corso)` → `genera.testoPdf` non è mai chiamato → nel prompt non c'è nessun blocco
«documento» → zero citazioni `pdf:NN#p=`.

⚠️ **Smentite due comode spiegazioni**, per non rincorrerle di nuovo:
- *«lo schema impone che ogni materiale stia in un corso»* — **falso**, verificato: `schema/piano.schema.json`
  non ha nessuna regola di copertura, e un JSON Schema non può vedere il corpus. La regola sta nel *prompt*.
  L'unica rete è `recuperaMancanti`, e conta contro il digest sbagliato.
- *«il contesto era troppo lungo»* — **falso**, misurato: ai-literacy manda ~11.700 token e perde 25 materiali,
  l'OECD ne manda ~15.700 e non perde nulla.

### Correzione di fondo — FATTA (5 agosto, sessione successiva)

Si è fatto **tutto e due**, perché sono due reti a maglie diverse.

1. `lib/corpus.js` — `digestMedia/digestPdf/digestHtml` non restituiscono più `null`: il materiale
   senza trascrizione né indice torna con `indicizzato:false`. `digest()` tiene in `materiali` i soli
   elaborati (così gli 8 chiamanti non cambiano comportamento) e aggiunge `senzaIndice` e `suDisco`.
   Il materiale non può più sparire senza che qualcuno possa contarlo.
2. `corpus.perIlPiano(dg)` — riduce il digest a ciò che un piano può accogliere e restituisce **le due
   liste**: quella che va avanti e quella che resta fuori. `corpus.avvisoEsclusi()` ne fa la riga da
   mostrare. Ci passano `propose.corpusDelPiano()` (usata da tutte e tre le proposte), il gate di
   `plan:propose`, `schede:build` e `schede:stato`.
3. `plan:approve` ricalcola il corpus e **rifiuta** l'approvazione elencando i materiali già elaborati
   lasciati fuori dal piano. Non protesta per i non elaborati e per i congelati: quelli l'utente li ha
   già visti nell'avviso della proposta.

⚠️ Il gate dell'80% va misurato sul corpus **del piano**, non su quello del disco: confrontando le
schede con un totale che comprende materiali non elaborati e pagine web congelate, i due numeri si
muovono insieme e la soglia è sempre soddisfatta. È il guasto originale, in miniatura.

### Bloccante prima di rigenerare Anthropic
`schema/piano.schema.json` (enum di `corsi[].materiali[].type` e di `corsi[].capitoli[].fonte.type`)
ammette solo `["video","pdf"]`, ma `corpus` produce anche `tipo: 'html'`. Misurato: una riproposta che
copre tutti e 37 i materiali genera **12 errori di validazione** e **non viene scritta su disco**.
I 12 materiali HTML di Anthropic resteranno quindi fuori dai corsi finché l'enum non si apre.

**Risolto senza toccare l'enum**: gli HTML sono **in freezer**, cioè restano fuori dal piano di
proposito (`corpus.TIPI_PIANIFICABILI = ['video','pdf']`) e l'utente lo legge in un avviso. Prima una
sola pagina web faceva fallire la scrittura dell'intero piano con «piano non valido», senza dire chi
fosse il colpevole. Quando si deciderà su Chandra, l'unico punto da cambiare è quella costante — più
l'enum, se il tipo resterà `html`.

**Decisione dell'utente (5 agosto): non patchare l'enum adesso.** Vuole valutare
[chandra](https://github.com/datalab-to/chandra) (datalab) per pagine HTML, appunti scritti a mano, foto
e PDF con grafici e tabelle. È un modello OCR che converte immagini e PDF in markdown/HTML/JSON
preservando layout, tabelle e formule; gira da CLI (`pip install chandra-ocr`), server vLLM o Streamlit;
codice Apache 2.0, **modello sotto licenza OpenRAIL-M modificata** — libero per ricerca, uso personale e
startup sotto i 2 M$, non utilizzabile in concorrenza con la loro API, licenza a pagamento per il resto.
Se quei materiali passano da Chandra il loro tipo cambia, e patchare l'enum ora sarebbe lavoro da rifare.

## 7-bis. Perché i PDF non venivano citati NEL TESTO (la seconda metà, chiusa)

Il §7 spiega perché i PDF non entravano nei corsi. Restava un secondo guasto, **indipendente**: anche
quando il PDF era nel piano, il capitolo non ci rimandava. Misurato su TD74-DSA:

| | capitoli | con un link nel testo |
|---|---|---|
| video | 123 | **123** |
| PDF | 87 | **17** |

Negli altri 70 la fonte c'era, ma scritta a parole in una **nota a piè di pagina**: «Definizione ripresa
da D. Hammill; Materiale 01 (video), min. 2:40». 165 capitoli su 210 nominavano un materiale in prosa.

**Causa**: `lib/genera.js` offriva al modello **due canali** per la stessa cosa — il link
`[p. 7](pdf:03#p=7)` e la nota `[^1]` — e per un documento scritto il modello sceglie la nota, che è
come si cita un libro. Nessuno gli aveva detto che qui la fonte è un oggetto che si apre.

**Correzione**, nei tre posti che devono dire la stessa cosa:
- il prompt di sistema: una forma sola per i rimandi, l'obbligo di citare ogni materiale usato, il
  divieto esplicito di scrivere numero/pagina/minuto in prosa, e le note ridotte a note di contenuto;
- `genera.comeCitare()`: l'intestazione di ogni blocco di fonte dice come si cita **quel** materiale
  («citalo così: [etichetta](pdf:03#p=PAGINA)»). La regola dove il modello guarda davvero;
- `validate.validateCapitolo` con `ctx.attesi`: un materiale dichiarato e mai citato è un **errore**, e
  così una citazione in prosa (`citazioniInProsa`, che guarda anche le note). L'errore rientra nel giro
  di correzione già previsto da `generaCapitolo` — c'è un test che lo percorre tutto.

⚠️ `ctx.attesi` lo può riempire solo chi ha in mano la scaletta (`genera.fontiAttese`): il validatore
vede il testo, non il piano da cui il testo nasce.

Corretto nella stessa passata: `genera.testoVideo/testoPdf/testoHtml` cercavano il testo della fonte
**senza il progetto**, cioè in tutte le cartelle del vault. Con la numerazione per progetto due
materiali diversi possono chiamarsi «03 …».

## 8. Il riquadro «Note e materiali» (chiuso)

Due difetti distinti, entrambi in `lib/genera.js`, entrambi corretti e verificati su tutti i 258 capitoli.

1. **Riquadro assente** (17 capitoli). Il frontmatter `videoRefs`/`sources` non veniva mai riempito: il
   prompt chiede di citare con `[vai a 12:30](video:05#t=750)` e il modello lo fa, ma gli elenchi restavano
   vuoti. Risolto con `genera.rimandiDa()`, che li ricava dal testo.
2. **Riquadro monco** (39 capitoli, 88 rimandi persi). La prima versione usava una precedenza *esclusiva*:
   se il modello dichiarava anche una sola voce, la sua lista vinceva per intero e i rimandi in più scritti
   nel testo sparivano. Risolto con `genera.unisciRimandi()`: unione con dedup su `NN#t`/`NN#p`, e sul
   doppione **vince l'etichetta dichiarata dal modello**, che è scritta per essere letta lì.

I file già scritti sono stati riparati con le stesse funzioni (mai con logica duplicata). Stato finale
misurato: **258 capitoli, 0 senza riquadro, 0 incompleti.**

### Terzo difetto, trovato dopo (5 agosto, sessione successiva)

Il riquadro era pieno e i suoi rimandi si aprivano tutti — 996 su 996 — ma restavano **due difetti di
lettura**, misurati su TD74:

3. **Etichetta che ripete se stessa.** `rimandiDa` prendeva come etichetta il testo del link, e nel
   testo il link si scrive «[vai a 12:30](…)». Nel riquadro diventa «vai a 12:30 / Videolezione ·
   12:30», dove ci si aspetta di leggere di che cosa si parla lì. Erano **84 voci in 35 file**.
   Ora `genera.etichettaUtile()` scarta le etichette che sono solo il puntatore, e senza etichetta il
   lettore ripiega sul **titolo del materiale**.
4. **Ordine arbitrario.** `chapterNotes` elencava prima tutti i documenti e poi tutti i video, comunque
   fosse fatto il capitolo: appena un capitolo cita entrambi — cosa che il §7-bis rende normale — la
   voce «1» non è più la prima che si incontra leggendo. Ora `ordinaComeNelTesto()` ordina per
   comparsa nel testo, e mette in coda ciò che nel testo non compare.

⚠️ `titoloMateriale()` nel renderer ripete le regole di `corpus.titoloDi()`, perché il renderer non può
richiamare `lib/`. C'è un test che confronta le due implementazioni: è la trappola ④.

**Resta il riquadro orfano.** Nei 70 capitoli del §7-bis il riquadro è pieno ma nel testo non c'è nulla
che ci rimandi: l'unico rimedio è **riscrivere quei capitoli** con il prompt nuovo, e si paga.

---

## 9. Chandra: lettura avanzata dei documenti, componente FACOLTATIVO

Installato, girato su PDF veri e misurato. **La parte costruita finisce qui**: il resto — indice con le
figure, campo nel capitolo, resa nel lettore, esportazione — non è ancora scritto.

### Fatto

- `lib/ocr.js` — venv **separato** (`pyenv-ocr`, non `pyenv`). Chandra porta torch e transformers, la
  trascrizione vive su mlx e ctranslate2: nello stesso ambiente installare l'OCR potrebbe rompere la
  trascrizione, che è la cosa che si usa di più. Separati, rimuovere è cancellare una cartella.
- `ambiente.rileva()` lo vede; il suggerimento sta in `consiglio().ocr`, **fuori dagli avvisi**: un avviso
  che c'è sempre non lo legge nessuno, e «macchina a posto, niente da segnalare» deve restare possibile.
- `ocr:stato` · `ocr:installa` (con avanzamento e registro) · `ocr:rimuovi`. Nessuno parte da solo.
- Scheda in Impostazioni → Progetti, sotto «Materiali del progetto».
- `ocr:rimuovi` **non tocca i pesi**: stanno nella cache condivisa di Hugging Face. Dice dove sono.
- `ocr.cartellaHub()` rispetta `HF_HUB_CACHE` e `HF_HOME`: chi tiene i modelli su un disco esterno le
  imposta, e cercare a mano in `~/.cache` farebbe riscaricare dieci gigabyte per niente.

### Misure vere (M5, 32 GB, MPS)

| | |
|---|---|
| ambiente | 0,93 GB · pesi 9,9 GB (`datalab-to/chandra-ocr-2`, ~5B, Qwen3.5-VL) |
| velocità | **169 s a pagina** (misurate: da 80 a 436). Il corpus intero = **65 ore** |
| resa | figura ritagliata in `.webp` **con didascalia generata** e bbox; tabelle in `<table>` vero |
| confronto | sulle pagine scansionate pypdf estrae **solo il piè di pagina**: titolo, consegna, tabella e figura per l'app non esistono |

### Tre trappole nel codice di Chandra, che costano ore

1. `load_file(path, config)` vuole un **dict**, non un argomento nominato.
2. `page_range` è confrontato con l'indice **0-based** del documento (`input.py`), mentre la CLI lo
   documenta come numero di pagina. Sfasando di uno le figure si attaccano alla pagina sbagliata, **in
   silenzio** — e il senso della feature è proprio «questa figura sta a p. 7».
3. Serve `prompt_type='ocr_layout'`: è quello che fa uscire bbox ed etichette. Il default `None` va in
   `KeyError`, e `'ocr'` dà il solo testo.

### Quali pagine mandare a Chandra: misurato, non stimato

A 169 s/pagina la selezione decide se l'elaborazione dura ore o giorni. Due regimi:

- **pagine scansionate** (testo estratto < 200 car.): il rilevamento è esatto — la pagina *è* un'immagine.
  Ma nessun rilevatore locale può sapere se dentro c'è una figura: quello lo sa solo Chandra.
- **pagine native**: `pypdfium2` **elenca gli oggetti veri** della pagina, non indovina.

Provate due regole contro la verità di Chandra su 6 pagine:

| regola | esito |
|---|---|
| area della grafica più grande sotto il fondale ≥ 0,15 | **4/6** |
| `nImg ≥ 1` **oppure** `nPath ≥ 10` | **6/6** |

⚠️ **L'area è la caratteristica sbagliata**, ed è stata la mia prima ipotesi per due giri. Una tabella è
disegnata con filetti sottili: tanti tracciati, area minima — infatti la regola ad area perdeva una tabella
e segnalava una pagina che aveva solo una decorazione grande. Il conteggio funziona perché è meccanico: un
oggetto immagine **è** una figura, e venti tracciati **sono** una tabella o un disegno.

⚠️ Altre due secche in cui sono caduto, entrambe da evitare:
- `pypdf.pages[i].images` dà **0 ovunque** su questo corpus: quei disegni sono grafica vettoriale, non
  immagini incorporate.
- prendere il **massimo** dell'area dà sempre `1.000` sulle slide, perché è il rettangolo di sfondo.
- in `pypdfium2` un `PdfObject` **non ha** `get_objects()`: i gruppi (Form XObject) si aprono con
  `FPDFFormObj_CountObjects` / `FPDFFormObj_GetObject`, ed è lì dentro che stanno quasi sempre gli schemi.
  Sbagliando questo si perdevano **444 pagine su 1377** senza un errore.

Con la regola a conteggio: **786 pagine su 1377 (57%)**, cioè ~37 ore invece di 65 — TD74 14,4 · OECD 21,8
· anthropic 0,7. Il risparmio è modesto: la leva vera è scegliere **quali PDF** valgono la pena, non quali
pagine.

### Deciso con l'utente

I 258 capitoli già scritti **non si toccano**: le figure entrano solo nei capitoli nuovi.
La selezione delle pagine **si mostra prima**, PDF per PDF, e la sceglie l'utente.

### La rilettura, fatta e provata

- `ocr.py scheda <pdf>…` → un JSON per pagina (`car`, `nImg`, `nPath`). Gira sull'ambiente della
  **trascrizione**, non su quello dell'OCR: la stima deve vedersi *prima* di scaricare undici gigabyte,
  altrimenti l'unico modo di sapere se conviene installare Chandra sarebbe installarlo. Per questo
  `pypdfium2` è stato aggiunto a `ensureDeps` (pochi megabyte).
- `ocr.py leggi <pdf> <pagine> <indice.json> <cartella-figure>` → legge, ritaglia, e **innesta**
  nell'indice esistente senza buttare via ciò che pypdf aveva estratto dalle altre pagine.
- `lib/ocr.js`: `motivoPagina` · `selezionaPagine` · `rigaStima` · `durata` · `totaleStima`. La regola è
  **pura**, quindi provata contro i casi veri già letti da Chandra.
- IPC `ocr:stima` · `ocr:leggi` (avanzamento per pagina) · `ocr:ferma`. Un documento che fallisce non
  butta via le ore spese sugli altri, e i falliti si dicono **col nome**.
- Interfaccia: elenco dei PDF con spunta, «76 pagine · 29 da rileggere (20 figura, 1 scansione, 8 tabella
  o schema) · 82 minuti», totale in fondo, conferma con il numero davanti, e «Ferma la rilettura».

Formato dell'indice dopo la rilettura, **provato su una copia**:

```json
{ "motore": "misto",
  "pages": [ { "page": 13, "text": "…", "motore": "pypdf" },
             { "page": 14, "text": "…", "motore": "chandra", "html": "…" } ],
  "figure": [ { "p": 14, "file": "<stem>__p014_f1.webp", "tipo": "figura",
                "didascalia": "…", "bbox": [339,462,1253,1498] } ] }
```

⚠️ `motore` si scrive su **ogni pagina**, non solo sull'indice: un vault finisce per contenere pagine
lette in due modi diversi, e senza dirlo non si può più sapere perché una figura c'è e un'altra no.

⚠️ Il nome del ritaglio è `<stem>__pNNN_fK.webp` e **non** quello di Chandra, che è un hash dell'HTML
del modello: instabile fra due letture e muto su quale pagina venga.

Nuova cartella `MATERIALI/Figure/` in `mat.NOMI` e `cartelleProgetto()`: i ritagli sono derivati come le
trascrizioni e devono viaggiare col progetto.

Verificato: `ocr:leggi` **rifiuta** TD74-DSA (protetto) e l'indice resta intatto.

### Che cosa resta (la metà del capitolo)

`capitolo.schema.json` non ha nessun campo immagine e `validateCapitolo` **vieta l'HTML grezzo** in
`contenuto`. Da scrivere: la sintassi `![didascalia](fig:03#p=7&i=2)` in `_mdInline` (resa come `<figure>`
cliccabile che riusa `openPdf`), il campo nello schema, `mdser` + `reader-parser`, l'offerta delle figure
al modello in `genera.testoFonti`, e `lib/pacchetto.js` perché i `.webp` viaggino nell'esportazione.

### Disegno concordato per la figura nel capitolo (non ancora scritto)

Stessa grammatica dei rimandi già in uso: `![didascalia](fig:03#p=7&i=2)`. Il lettore la rende come
`<figure>` cliccabile che apre il PDF a quella pagina — **riusando `openPdf`**, quindi zero codice nuovo
per il click — e `genera.rimandiDa()` la raccoglie come qualunque altro rimando, così la figura entra da
sé nel riquadro «Note e materiali». Chiude anche il riquadro orfano del §8: una figura nel testo è un
puntatore visibile dentro il PDF.

Da scrivere: `capitolo.schema.json` (oggi non ha nessun campo immagine, e `validateCapitolo` **vieta
l'HTML grezzo** in `contenuto`), il formato dell'indice PDF (`ingest.py:48`, oggi `{pdf, npages, pages}`),
`mdser` + `reader-parser`, una cartella in `mat.NOMI` per i ritagli, e l'esportazione (`lib/pacchetto.js`)
perché i `.webp` viaggino col progetto.

⚠️ Da scrivere anche `motore: 'chandra' | 'pypdf'` **dentro l'indice**. Senza, un vault finisce per
contenere indici fatti in due modi diversi senza che si possa sapere quale: è la stessa cecità silenziosa
del §7.

---

### Note sparse

- Lo stato del piano dichiara 7 valori ma **solo `proposto` e `approvato` vengono scritti**: `raccolta`, `ingest`,
  `in-generazione`, `generato` non compaiono in nessuna riga di codice.
- La numerazione dei materiali è per progetto, ma TD74 resta `01–40` e l'OECD `01–24`: **si sovrappongono**.
  Va bene perché il risolutore è scopato per progetto, ma non fidarsi dei numeri fuori dal loro progetto.
- I 10 GB della copia vecchia di TD74 sono stati liberati (Cestino svuotato dall'utente il 5 agosto).
- Chandra occupa **~11 GB** sul computer dell'autore: 0,93 GB di ambiente in
  `~/Library/Application Support/studia/pyenv-ocr` e 9,9 GB di pesi nella cache di Hugging Face.
  ⚠️ Su quella macchina `~/.cache/huggingface` è un **link** verso
  `Antigravity/ScriverAI_models_database/huggingface`: i pesi sono fisicamente lì, insieme ad altri
  modelli. «Rimuovi» nelle Impostazioni cancella l'ambiente ma **non** i pesi, che sono condivisi.
- I server MCP `plugin:design:*` (asana, atlassian, figma, intercom, linear, notion, slack) risultano non
  autorizzati: vanno collegati dalle impostazioni dei connettori di claude.ai o con `claude mcp` in una
  sessione interattiva. Non servono a questo progetto.
