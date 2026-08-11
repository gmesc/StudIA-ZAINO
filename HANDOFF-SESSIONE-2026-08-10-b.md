# Handoff di sessione — 10 agosto 2026, secondo giro

> **A chi arriva adesso.** Stessa giornata del file accanto, sessione diversa: il primo giro sta in
> [HANDOFF-SESSIONE-2026-08-10.md](HANDOFF-SESSIONE-2026-08-10.md) e va letto prima, perché è lì che
> nascono le mappe a concetti, la topbar su una riga e il viewer pdf.js. Qui c'è una cosa sola, tirata
> fino in fondo: **i rimandi fra lezioni non funzionavano, e sotto c'era una famiglia di difetti** —
> più i quattro lavori che ne sono seguiti.
>
> ⚠️ **Questo file è un verbale, non il punto di ripartenza.** Per ripartire c'è
> [HANDOFF-DEFINITIVO-2026-08-10.md](HANDOFF-DEFINITIVO-2026-08-10.md), che raccoglie tutta la
> giornata — questa sessione compresa — e tutto ciò che resta aperto. Qui restano i dettagli e le
> misure per esteso.
>
> Regola di lettura: dove c'è ⚠️ c'è un **guasto già pagato**. Sono la parte utile.
>
> Sei lavori, non uno: **i rimandi fra lezioni** (§2-§5), **il ritentativo sugli errori passeggeri**
> (§6), **lo zero nel registro dei costi** (§6-bis), **la tendina che offriva cartelle invisibili**
> (§6-ter), **il viewer pdf.js** (§6-quater) e **l'album dei ritagli** (§6-quinquies).
>
> Sono slegati, ma hanno lo stesso morale: **la premessa da cui si parte va misurata prima di
> ripararla**, perché quasi ogni volta era falsa per metà. E più volte il difetto vero era un
> **elenco di campi o di nomi tenuto a mano**, che invecchia da solo.

---

## 1. Stato in due righe

`npm test` esegue **2010 controlli verdi su tredici suite** e le **dieci prove sull'app viva** sono
verdi (una è nuova). I rimandi `[[NN-slug]]` fra lezioni funzionano anche quando la lezione ha
varianti; la ricerca resta dentro il percorso che si sta studiando; una lezione non può più sparire
dalla tendina con i capitoli intatti sul disco. Gemini, che non ritentava **mai**, adesso ritenta. E
quello che scrivi con Claude Code non è più registrato a zero dollari. E il viewer pdf.js **disegna
davvero** — verificato contando i pixel, non l'evento di caricamento — con zoom, ricerca e **ritaglio
d'area**: si trascina un rettangolo sulla pagina e diventa un'immagine dell'album.

```bash
cd "/Users/giacomomeschini/Claude/StudIA/StudIA" && npm test
./test/cdp/con-vault-di-prova.sh        # le dieci prove sull'app viva
```

| suite | controlli | | suite | controlli |
|---|---:|---|---|---:|
| roundtrip | 915 | | grafo-focus | 74 |
| mappe | 187 | | disegna-fonti | 33 |
| modifica | 229 | | appunti-rinomina | 94 |
| evidenze | 123 | | genera-concetti | 96 |
| figure | 32 | | mappa-immagini | 55 |
| album | 124 | | ritentativi | 32 |
| | | | costi | 16 |

---

## 2. Il fatto che spiega tutto: una lezione ha due nomi

La **base** (`04-delegation-consapevolezza-e-delega-del-c`) e la **cartella-variante** che la
contiene davvero (`04-delegation-…--scaletta-a-sequenza-didattica-…`). La base è l'identità stabile;
quale variante si legge lo decide il percorso attivo. Il testo di un capitolo cita **sempre la base**,
ed è giusto: la variante è una scelta che cambia sotto i piedi del testo.

Sul disco, di una lezione variantizzata restano **due cartelle**: il segnaposto della base, con il
solo `_lezione.md` e zero capitoli, e la variante con i capitoli veri. Chi guarda il disco vede due
lezioni; l'app ne carica una (`preload.js:106`, `if (chapters.length)`).

**Da qui nasceva tutto.** Cinque punti del progetto rispondevano alla domanda «questa lezione
esiste?» guardando il disco, mentre la domanda vera era «il lettore ci arriva?».

---

## 3. Che cosa è stato fatto

### 3.1 Una nozione, scritta una volta, e sono DUE liste

In `lib/percorsi.js`, accanto a `scomponi`, perché sono la stessa conoscenza:

- **`nomiRimandabili`** — che cosa si **può citare**: la base, mai la variante. Comprende le lezioni
  non ancora scritte, ed è voluto (vedi §5.2).
- **`nomiRaggiungibili`** — che cosa si **apre adesso**: solo le lezioni con capitoli, in sé o in una
  variante. Serve a chi deve DIRE che un rimando è rotto.

Sono due domande diverse e vanno tenute tali. Confonderle è precisamente come è nato il difetto —
e, nel primo tentativo, anche come stavo per introdurne un altro.

### 3.2 Nel lettore: una regola sola per «quale cartella si guarda»

Blocco puro `@lezioni-puro-*` in `App/StudIA.html`, estratto dai test via `lib/reader-parser.js`
(stessa convenzione di TTS e appunti):

- `scomponiLezione(folder)` → `{base, variante}`;
- `preferitaFra(cand, base, scelte)` → fra più cartelle della stessa lezione, quella che si guarda;
- `cartelleScelte(ids, meta, scelte)` → `base → cartella`, per tutte le lezioni caricate;
- `risolviLezione(target, ctx)` → da un nome di rimando alla lezione da aprire.

Ci passano **il rimando, la tendina e la ricerca**. Tre idee di quale variante sia quella buona sono
tre app diverse nella stessa finestra. Un test lo tiene inchiodato: *la tendina e i rimandi scelgono
la stessa cartella, sempre.*

⚠️ Il target si normalizza **sempre** alla base, anche quando nomina per esteso una variante che
esiste. Sembra perdere precisione, è il contrario: un rimando a `04-…--scaletta-a` letto dentro il
percorso «per domande» ti sposterebbe di percorso a metà corso, in silenzio.

### 3.3 `VAULT_META.base` dalla fonte autorevole

`lezione_base:` del frontmatter — che è ciò che `lib/percorsi.js` **scrive** quando crea la variante —
prima del taglio sul `--`, che resta il ripiego per le cartelle nate a mano. Da lì passa ogni rimando,
e dedurre un'identità da un nome di file è il modo in cui un rimando finisce sulla lezione sbagliata.

---

## 4. Le decisioni prese, che vanno rispettate

1. **Il testo cita la base.** Mai la variante: quale versione si legge non lo decide il testo.
2. **Rimandi, tendina e ricerca seguono il percorso attivo.** La ricerca cerca **solo** dentro la
   variante selezionata (decisione esplicita dell'utente).
3. **Evidenze, mappe e appunti restano nella variante in cui sono nati**, e non migrano (decisione
   esplicita). Il confronto esatto su `capitoloId`/`lezioneId` è quindi il comportamento giusto, non
   un difetto. Due percorsi che scelgono lo stesso indice condividono la cartella: vedono le stesse
   evidenze, ed è coerente — è lo stesso testo.
   ⚠️ Per gli appunti la regola era **vera per caso**: l'indice raggruppava per `n.lezione`, cioè per
   TITOLO, e le varianti il titolo lo condividono per costruzione — gli appunti di due testi diversi
   finivano mescolati in una sezione sola, senza che si vedesse. Ora si raggruppa per `lezioneId` (la
   cartella) e l'etichetta dice la variante. Effetto buono in regalo: l'indice segue la sequenza
   didattica (`01-`, `02-`…) invece dell'alfabeto dei titoli.
4. **Una lezione non ancora scritta resta citabile.** Il rimando in avanti — la 01 che annuncia la 04 —
   è ciò che rende un corso un corso.
5. **«Non lo so» non è «nessuna».** Vale per la cache delle scalette come già valeva per `album.usi()`.

---

## 5. I guasti trovati (la parte più utile di questo file)

**5.1 Il gestore dei wiki-link cercava la chiave ESATTA.** `LESSONS[t]` con `t` = base, mentre
`LESSONS` è indicizzata per nome-cartella e la cartella base non è nemmeno caricata. Misurato sul
vault: **8 rimandi morti su 38 (21%)**, e dentro il corso a varianti **8 su 10**; 5 target distinti,
7 file. Nessuno in TD74-DSA, che varianti non ne ha. ⚠️ Non mancava la mappa base→variante: c'era
già in `cartellePercorso()`, e nessuno la passava al gestore. Mancava il cablaggio, non l'idea.

**5.2 Non era il modello a inventare: era la lista a mentire.** A `generaCapitolo` si passava
`corsi.elencoLezioni()`, cioè le **cartelle**: 14 voci per 7 lezioni, con dentro i segnaposto e le
varianti. Il modello copiava alla lettera un nome dalla lista — come gli si chiede — e otteneva un
rimando morto o uno che scavalca il percorso attivo. Il validatore approvava, perché guardava la
stessa lista. Adesso `lezioniDelCorso` torna 7 nomi non ambigui. Che il modello producesse output
**incoerente** si vedeva già nei dati: 8 rimandi con il nome base, 2 con quello della variante.

⚠️ **E qui il mio primo tentativo era sbagliato.** Avevo fatto una lista sola, richiedendo i
capitoli. Avrebbe fatto cancellare da `togliWikilinkRotti` ogni rimando in avanti proprio mentre il
corso si costruisce — cioè avrebbe ucciso il caso che i dati mostravano. Da lì le due liste.

**5.3 Il controllo che doveva accorgersene diceva «zero rimandi rotti».** `wikilinkRotti` confrontava
i target con le cartelle sul disco: il segnaposto c'è, quindi il rimando risultava sano mentre nel
lettore era morto. Il pannello ⚙ e il lettore avevano **due idee diverse di «lezione esistente»** —
uno guardava il disco, l'altro la memoria.

**5.4 Un salvataggio del composer poteva far sparire sette lezioni su sette.** `conCartelle` ricava
la cartella dalle scalette in cache (`_lavorazione/`, che è dichiarata buttabile — lo script delle
prove la esclude apposta). Cache assente → `cartella: null` scritto **dentro il percorso salvato** →
`cartellePercorso()` salta i null → le varianti si nascondono e i segnaposto non sono caricati: la
lezione non è da nessuna parte, con i capitoli intatti sul disco e nessun errore. Misurato sul
percorso «Analitica»: **7 scelte su 7 azzerate da un salvataggio**. Chiuso da due lati — chi scrive
non sovrascrive più con `null`, chi legge mostra comunque una cartella. Controllati tutti i
`PERCORSI/*.json` del vault: nessun `null` già salvato, niente da recuperare a mano.

**5.5 L'app dichiarava finito un corso vuoto.** Il conteggio della lista corsi contava le cartelle:
14 per un corso di 7. Il numero doppio è il sintomo minore — `projDaFinire` chiede `lezioni===0` per
dire «nessuna lezione ancora scritta», e un corso di soli segnaposto contava 7.

**5.6 La ricerca indicizzava le varianti fuori percorso.** `searchBuild` filtrava per `courseId` ma
non passava da `lezioniVisibili()`. Le varianti condividono il titolo per costruzione, quindi la
stessa lezione compariva più volte con la **stessa etichetta**, e aprire il risultato sbagliato
portava su una lezione che la tendina non contiene. Oggi non si vedeva: ogni lezione ha una sola
variante scritta. Sarebbe comparso al secondo percorso generato. ⚠️ Aggiunto anche il ricalcolo
dell'indice al **cambio di percorso**: `SEARCH` confrontava solo il corso, e si continuava a cercare
dentro la variante di prima.

⚠️ **Due lezioni sulle prove, pagate oggi.**
1. `getBoundingClientRect()` di un link **che va a capo** unisce le due righe, e il suo centro cade
   nel bianco in mezzo: la prova cliccava il paragrafo e accusava la risoluzione dei rimandi per un
   difetto della propria mira. Si misura `getClientRects()[0]`, la prima riga vera.
2. La stessa prova passava da sola e falliva in coda alle altre: il banco resta come l'ha lasciato
   la prova prima, e con più blocchi il divisore `bDivRiga` è una maniglia stesa sopra il testo. Ora
   parte da `bancoForma('uno')`, che è come si legge un capitolo.

---

## 6. Il ritentativo sugli errori passeggeri (lavoro a sé)

Il piano diceva: «il ritentativo esiste solo in `claudecode.js`; Anthropic, Google e OpenAI non ne
hanno — e l'incidente documentato è proprio una cascata di 503 di Google». ⚠️ **Misurato, era falso
per metà**, e la metà sbagliata è quella che avrebbe guidato la patch.

| fornitore | ritentava già? | dove si legge |
|---|---|---|
| Anthropic | **sì**, `maxRetries ?? 2` → 3 chiamate, con `retry-after` rispettato e jitter | `@anthropic-ai/sdk/client.js:111`, `:705-739` |
| OpenAI | **sì**, identico | `openai/client.js:173` |
| Claude Code | sì, ciclo suo di 3 | `lib/ai/claudecode.js:220-226` |
| **Google** | **no**: `apiCall()` fa `fetch` nudo se manca `httpOptions.retryOptions` | `@google/genai/…/index.mjs:13950-13955` |

Il buco era **uno**, ed era il fornitore della cascata documentata.

### Perché NON è stato messo un ciclo in `provider.completa`

Perché non avrebbe sommato sicurezza: l'avrebbe moltiplicata. Le misure:

| percorso | chiamate oggi | con 3 tentativi dentro | richieste HTTP vere |
|---|---|---|---|
| capitolo (`lib/genera.js:292`, **due giri**) | 2 | 6 | **18** |
| architettura (3 lenti + sintesi + revisione) | 6 | 18 | 54 |
| capitolo via Claude Code (3 tentativi suoi) | 3 | **18 processi** | 600 s di tetto ciascuno |

E tre danni che non si vedono in fattura: `lib/genera.js:305` tratta l'errore di rete come una
risposta invalida e **brucia uno dei due giri di riparazione**; `completa()` non ha una callback in
firma, quindi durante le attese l'interfaccia resta muta; il pulsante «Ferma» è letto solo fra un
capitolo e l'altro (`main.js:1539`), quindi sembrerebbe rotto per minuti.

Il posto giusto per ritentare è **il più vicino alla connessione**: là si riusa la stessa sessione, si
rispetta il `retry-after` del server e non si rispedisce il prompt da capo.

### Che cosa è stato fatto

- **`lib/ai/ritentativi.js`**, nuovo: la manopola. `TENTATIVI = 4` — uno più del default di Anthropic
  e OpenAI, perché la differenza fra tre e quattro è proprio la coda di una cascata.
  ⚠️ **La stessa cifra vuol dire cose diverse nei tre SDK**: Anthropic e OpenAI contano le
  *ripetizioni* (`maxRetries: 3` = 4 chiamate), Gemini conta i *tentativi* (`attempts: 4` = 4
  chiamate). Scrivere «3» in due posti dà 3 e 4: la conversione la fa questo file, non chi lo chiama.
- **`lib/ai/google.js`**: `httpOptions.retryOptions` acceso, più un `timeout`. ⚠️ Gemini non aveva
  **nessun** tetto di tempo: una richiesta appesa non falliva mai, quindi non si arrivava nemmeno a
  ritentare — il caso peggiore non era l'errore, era il silenzio. (Il suo `timeout` vale come header
  `X-Server-Timeout`: taglia il server, non noi — l'SDK non espone un `signal`.)
- **`anthropic.js` e `openai.js`**: il numero adesso è **dichiarato**, non ereditato da un default.
- **`claudecode.js`**: i tentativi vengono dalla manopola comune. ⚠️ E la regex degli errori
  passeggeri cercava `5\d\d` **ovunque nella stringa**: un errore 400 che nominasse
  `max_tokens: 512` risultava passeggero e si pagavano tre esecuzioni di un errore deterministico —
  il modo più caro di sbagliare. Ora il numero si accetta solo dove un codice sta davvero.
- **`provider.js`**: `motivoDi()` rimette lo status davanti al messaggio. ⚠️ Serve perché dopo
  l'ultimo ritentativo Gemini lancia `Retryable HTTP Error: Service Unavailable` — lo `status` è
  sull'oggetto ma non nel testo, e prima si teneva solo `e.message`: una cascata di 503 finiva nel
  registro come un errore **senza numero**.

⚠️ **Un controllo che vale più degli altri**: la nuova suite costruisce i client SDK **veri** (chiave
finta, nessuna rete) e verifica che le opzioni siano state prese. Un campo con il nome sbagliato non
solleva niente: viene ignorato, e il ritentativo resta spento finché non serve.

### Che cosa NON è stato toccato, e va saputo

Il secondo agente ha misurato tre cose vere che non sono di questo lavoro:

1. ~~**Il registro dei costi sottostima**~~ — **fatto subito dopo, vedi §6-bis.** Resta vera solo la
   metà sui conteggi: `chiamate` conta le invocazioni di `completa()`, non i tentativi HTTP, e con gli
   SDK che ritentano la colonna può sbagliare fino a 3×. Il numero vero da questa parte non ce l'ha
   nessuno: è una sottostima **dichiarata** nel codice, non un difetto da tappare.
2. **Nessun tetto sulla catena.** Zero `AbortController` in tutto il progetto: i tetti sono per
   tentativo (10 minuti gli SDK, 600 s Claude Code). Il problema è l'opposto di quello temuto — la
   catena può allungarsi senza limite.
3. **Il collaudo scavalca `provider.completa`.** `bin/studia.js:130-143` (`STUDIA_FINTO=1`) inietta
   `ai.chiama`: nessun doppio di prova percorre questa strada. È il motivo per cui la suite nuova
   prova le **opzioni** e il **giudizio**, non il ciclo.

Fuori dal percorso AI, altri due punti senza rete di sicurezza, entrambi cari: `main.js:901`
(`ocr.py leggi` scrive l'indice unito solo alla fine — quaranta minuti di GPU interrotti all'ultima
pagina lasciano zero testo) e `main.js:830` (scarico di ~10 GB di pesi senza ritentativo).

### 6-bis. Lo zero nel registro dei costi

⚠️ Non era una stima imprecisa: era uno **zero**. `sommaUso` esisteva in **due copie** — `genera.js`
e `schede.js` — che ricostruivano l'oggetto elencando i campi che conoscevano. Il campo non elencato
era `costoUsdDichiarato`, cioè il costo che Claude Code riporta già a listino e che `registraUso` fa
vincere sul calcolo nostro. Perso quello, il ripiego cerca il modello nel listino — ma per Claude
Code il modello è `''` **per costruzione** (si lascia decidere a lui), quindi non c'è prezzo e il
registro scriveva zero. **Ogni capitolo e ogni scheda scritti con Claude Code risultavano gratis.**

Un elenco di campi invecchia da solo: qualunque cosa si aggiunga a monte muore lì in silenzio. La
somma sta adesso in `lib/ai/provider.js`, cioè nel modulo che l'`uso` lo produce, e i due sommatori
la richiamano. Stessa forma della riparazione dei rimandi: una nozione, un posto.

⚠️ E ce n'era un secondo, ancora più diretto: in `main.js` la proposta d'indice aveva una **copia
scritta a mano** di `registraUso` con `costUsd: 0` **cablato**. È una delle chiamate più grosse del
progetto — ci passa tutto il digest del corpus — e risultava gratis per costruzione. Ora chiama la
funzione come tutti gli altri.

⚠️ Il campo, quando nessuno lo dichiara, deve restare **assente** e non valere `0`: è la differenza
fra «costa zero» e «il costo lo calcola il listino». Uno zero comparso lì vincerebbe sul calcolo e
nasconderebbe il prezzo di ogni chiamata via API. C'è un controllo apposta.

### 6-ter. La tendina «estendi»: offrire solo dove il testo si vedrà

⚠️ La domanda giusta non è «questa cartella esiste» né «ha dei capitoli»: è **se genero qui, il testo
si vedrà?** E la risposta la danno i PERCORSI, non il disco.

La tendina di ⚙ elencava tutte le cartelle col loro nome: davanti c'erano, indistinguibili, il
segnaposto della base (0 capitoli) e la variante coi capitoli veri. Scegliere il segnaposto genera
capitoli in una cartella che il lettore non mostra mai — soldi spesi per testo invisibile, e i file
su disco ci sono davvero, quindi non se ne accorge nessuno.

Ora `lib/espandi.js` ha `destinazioni(lezioni, percorsi)`, e l'etichetta dice titolo + variante invece
del nome cartella (due nomi che condividono i primi quaranta caratteri sono la stessa riga, a vista).
Misurato su `ai-literacy-anthropic`: **14 righe ambigue → 7 leggibili**.

⚠️ **Ma la prima versione della regola era sbagliata, e l'ha smontata la verifica.** Guardava il
conteggio dei capitoli; il lettore guarda `preferitaFra`, che consulta le scelte del percorso. Appena
le due divergono si offrono cartelle-fantasma: misurato, bastava creare **un** percorso su TD74-DSA
per avere 32 cartelle sul disco, **32 righe offerte e 16 visibili**. Adesso sono 16 su 16, e i sette
casi limite (base con capitoli suoi + variante rivendicata, variante che nessun percorso legge,
percorso muto, nessun percorso salvato…) sono confrontati **uno per uno** con il verdetto del lettore,
estratto a runtime dal blocco `@lezioni-puro-*`.

⚠️ **E la tendina da sola non bastava.** Il cancello vero è `main.js` (`gen:start`, `scaletta:proponi`),
che chiedeva «questa cartella è nel piano?» — ma il piano conosce **solo le basi**. Quindi la tendina
riparata offriva la destinazione giusta e il click rispondeva «lezione non trovata nel piano»: avevo
scambiato «spende per testo invisibile» con «non funziona». Ora `lezioneDelPiano()` accetta anche la
variante, risolvendo la base.

⚠️ **E la lista che si usa davvero non era quella.** È quella del wizard al passo «Capitoli»
(`App/wizard.js`), che si costruiva sul piano: tutte le basi, segnaposto compresi, e ci si arriva da
cinque strade (fine del wizard, «Riprendi», ritorno dal composer, l'opzione «una lezione nuova»,
`W.cap` non azzerato). Peggio: la mia patch la rendeva **più** invitante verso il segnaposto, perché
il conteggio dei capitoli spariva e la riga diceva «da scrivere». Ora quella lista nasce dalle
destinazioni.

Tre guasti minori chiusi nello stesso giro, tutti della famiglia «si genera nel posto sbagliato»:

- `open()` del wizard non azzerava **`W.piano` né `W.cap`**: la lista mostrava le lezioni del corso
  precedente e, con cartelle omonime fra corsi (`01-introduzione` c'è ovunque), i capitoli finivano
  nella lezione di **un altro corso** senza un errore;
- la tendina non veniva svuotata quando `expand:stato` falliva: restavano selezionabili le opzioni del
  corso di prima;
- due varianti possono avere lo **stesso nome** (`cartelleAlternative` deduplica la cartella, non il
  nome, e il titolo è identico per costruzione): due righe indistinguibili che portano in due posti.
  Quando succede, l'etichetta mostra anche la cartella.

**Resta fuori, misurato e non toccato**: il composer è pulito (calcola la cartella da
`cartelleAlternative`, nel segnaposto non può scrivere); e `plan:approve` riscrive il `_lezione.md` di
ogni base a ogni riapprovazione, `ordine_capitoli` e `status` compresi.

### 6-quater. Il viewer pdf.js: prima i pixel, poi zoom e ricerca

**Il dubbio da chiudere.** Il viewer era stato misurato con l'anteprima **nascosta**: si sapeva che il
documento si apriva, non che disegnasse. In un contenitore senza `offsetParent`
`requestAnimationFrame` non gira, e pdf.js decide che cosa disegnare dalle pagine visibili: «il
documento è aperto» e «la pagina è a schermo» sono due fatti diversi.

**Misurato**, con `test/cdp/prova-pdf.js` che campiona la tela e conta i pixel non bianchi: pagina 3
→ **148 campioni di inchiostro su 5246**, pagina 4 → 113, pagina 1 montata ma fuori vista → 0 (che è
giusto). Documento vero di **266 pagine**, aperto in **272 ms**, 220 pezzi di testo selezionabile.
⚠️ L'handoff diceva «8 pagine»: era una lettura sbagliata del PDF grezzo, non del codice.

**Zoom.** La percentuale è la scala vera del viewer, mai un contatore parallelo: `currentScale`
cambia anche da sola quando si ridimensiona il riquadro con `page-width` attivo, e un numero nostro
divergerebbe in silenzio. Il click sul numero alterna larghezza ↔ pagina intera; il livello si
ricorda su disco, perché è una leva della vista. Misurato: tela 850 → 936 px, cioè un ridisegno vero.

**Ricerca.** Passa dal `PDFFindController` di pdf.js e non da una scansione nostra del layer di
testo: è l'unico modo di **evidenziare** le occorrenze invece di contarle. 196 risultati su un
documento vero. ⌘F sceglie fra le due ricerche in base a dove sta il fuoco; Esc chiude **una cosa per
volta**, prima la ricerca e poi l'anteprima.

⚠️ **La verifica ostile ha trovato sei guasti veri, tutti riparati e tutti coperti da un controllo:**

1. **`closePops()` chiudeva la ricerca senza `findbarclose`.** La via di chiusura più naturale — un
   click sulla pagina per tornare a leggere — lasciava le evidenziazioni accese su tutte le pagine,
   e nessun comando visibile le spegneva.
2. **Il debounce riaccendeva la ricerca dopo la chiusura**: chiudendo entro i 220 ms della
   digitazione, il colpo in canna partiva dopo `findbarclose`.
3. **⌘F faceva il contrario di quello che prometteva**, e non nel caso raro: il pannellino sta fuori
   da `#pdfPane` (deve, per non essere tagliato), quindi scrivendo nel campo si cercava nel corso; e
   aprendo un PDF da un link il fuoco resta sul `body`, quindi valeva lo stesso.
4. **Esc veniva rubato** da mappa, barra di selezione e menu keyword, che ascoltano su `window` in
   cattura e fanno `stopPropagation`: un gestore sul documento non veniva mai raggiunto.
5. **«+» rimpiccioliva.** `page-width` su una slide in un riquadro largo dà 600%, e il clamp cieco a
   500% faceva *scendere* premendo «+».
6. **Dopo la ✕ restavano in barra comandi inerti**, e «cita il punto corrente» continuava a scrivere
   negli appunti un rimando al documento chiuso.

⚠️ **E quattro che sporcavano dati permanenti**, trovati dalla seconda verifica:

- **la pagina non veniva stretta al documento**: un rimando a `#p=9999` restava in `ANTEPRIMA.page`,
  la barra diceva «p. 9999 di 266» e 🔖 lo copiava **dentro l'appunto**. pdf.js non protesta:
  `_setCurrentPageNumber` torna `false` e stampa in console, quindi nemmeno il `try/catch` se ne
  accorge;
- **il numero del materiale veniva dalla mappa globale** invece che da quella del corso: con due
  corsi che hanno entrambi un «01», 🔖 citava il file di un altro corso;
- **un rimando `pdf:NN` a un materiale assente non faceva NIENTE** — click muto, per sempre — mentre
  la figura lo diceva e la nota mostrava un errore: tre esiti per lo stesso guasto;
- **`closePdf` non azzerava `ANTEPRIMA`**, e nel banco il riquadro resta a schermo.

Più le fragilità chiuse: il livello di zoom salvato ora è **validato** (pdf.js non solleva su un
valore storto — cade nel `default`, stampa in console e torna, quindi un `catch` non scatta mai e la
chiave avvelenata sopravvive); il conto delle occorrenze non sfarfalla più a vuoto durante la
scansione di un documento lungo; `WRAPPED` dice «ripartito dall'inizio»; `phraseSearch` — che in
questa build non esiste più — è stato tolto.

⚠️ **Due volte il rosso era del mio strumento, non del codice.** La prova pretendeva «tela > 850 px»,
che era la larghezza del riquadro in quella corsa; e misurava `canvas[0]`, cioè la **pagina 1**, che
essendo fuori vista non viene ridisegnata e quindi conservava la scala di prima. Ora aspetta che la
tela sia ferma e misura la pagina corrente via `getPageView`. Una prova instabile è peggio di una che
manca: insegna a ignorare il rosso.

**Resta fuori, misurato e non fatto** — in ordine di rischio:

- **PDF protetto da password**: nessun `onPassword` passato a `getDocument`, quindi vicolo cieco con
  un messaggio in inglese e nessun campo dove digitarla;
- il documento **non si chiude** quando «fonte» esce dal banco o si cambia corso: manca il gemello di
  `bancoSincronizzaMappa`, e resta un documento intero in memoria per ogni pannello parcheggiato;
- **tema scuro**: il CSS vendorizzato reagisce a `prefers-color-scheme`, non al nostro
  `data-theme`, e a `PDFViewer` non passiamo `pageColors`: pagina bianca dentro un'app nera;
- **stampa del PDF** impossibile dall'app (⌘P è intercettata e conosce solo appunti e mappe);
- non provati: selezione col mouse e **allineamento del layer di testo** ai glifi (è la promessa su
  cui poggerà il ritaglio d'area), scorrimento a mano, ridimensionamento del riquadro, e il ritorno
  di «fonte» dal magazzino del banco.

**Per il ritaglio d'area (passo successivo) l'API c'è già** ed è nel file vendorizzato:
`PDFViewer.getPageView(n-1)`, `PDFPageView.getPagePoint(x,y)` (che è
`viewport.convertToPdfPoint`), e la ricetta completa in `DOMRectToPDF`. Per il ritaglio ad alta
risoluzione **non** si passa dalla tela del viewer, che è tagliata da `maxCanvasPixels`: si rirende
la pagina con `getPage(n)` + `getViewport({scale})`.

### 6-quinquies. L'album dei ritagli, dal magazzino all'interfaccia

Il magazzino c'era già — `lib/album.js`, 111 controlli, le immagini in `Corsi/<corso>/ALBUM/` — e
non ci arrivava nessuno. Adesso c'è il gesto: **forbici nella barra dell'anteprima, si trascina un
rettangolo sopra la pagina, ed esce un'immagine.**

⚠️ **Il rettangolo si salva in coordinate della PAGINA, mai dello schermo.** A un altro zoom, o su
un'altra finestra, gli stessi pixel indicano un altro punto del documento — e un ritaglio serve
proprio a poter tornare là. La conversione la fa il viewport di pdf.js (`getPagePoint`), che sa già
di scala e rotazione. La prova lo verifica nel modo più diretto che c'è: **ritaglia la stessa area a
due zoom diversi e controlla che l'album non crei un doppione.** Misurato: `{x:119, y:463, w:238,
h:210}` a entrambi gli zoom, un ritaglio solo.

⚠️ **L'immagine non si taglia dalla tela del viewer.** Quella è disegnata alla scala di schermo ed è
limitata da `maxCanvasPixels`: un ritaglio preso da lì sarebbe sfocato quanto lo zoom del momento, e
cambierebbe qualità a seconda di come era ingrandita la finestra. Si ripassa dal documento
(`getPage` + `getViewport({scale:2})`) e si rende **solo quel rettangolo**. Misurato: rettangolo di
238 punti → immagine di 476 px.

⚠️ **L'asse y del PDF cresce verso l'alto**, al contrario dello schermo: prendere i due angoli così
come arrivano dà un'altezza negativa. Si normalizza con min/max sui due punti convertiti.

Il resto del giro:

- **la superficie «Album»** è uno strumento del banco come gli appunti e la mappa (registro a
  `bancoStrumenti`), una griglia di provini con ricerca: di un ritaglio si riconosce la **forma**
  prima della didascalia, ed è così che si ritrova;
- **il menu contestuale**: Alla fonte · Metti nell'appunto · Metti nella mappa · Rinomina · Rivela nel
  Finder · Copia · Elimina. Le voci che ora non si possono fare restano **visibili e spente col
  motivo accanto**, come nel menu della selezione: una voce che appare e sparisce insegna che l'app è
  imprevedibile, una spenta che dice perché insegna dove andare;
- **`![…](album:<id>)`** reso nel testo, con il click che porta all'immagine dentro l'album — che è
  il posto da cui si governa. Chi la usa la **referenzia, non la copia**;
- **un nodo di mappa può ESSERE un'immagine**: `disegna.js` lo sapeva già fare, ma nessuno gli metteva
  il campo. Ora `creaNodo`/`estrai` accettano `immagine:{id,w,h}` — copiata e non condivisa, e senza
  `id` non si scrive niente;
- **`window.vault.reveal`** non esisteva: la voce «Rivela nel Finder» era una promessa scritta e non
  mantenuta. ⚠️ Il main converte il `file://` in percorso (`showItemInFolder` vuole un percorso, non
  un URL) e **rifiuta tutto ciò che sta fuori dal vault**: è una porta che apre il Finder su quello
  che le si dice.

**Eliminare non è mai silenzioso**: si chiede prima `usi()`, e se qualche file non si è potuto
leggere non si cancella — «non lo so» non è «no», la stessa regola già scritta in `lib/album.js`.

#### E funziona anche sui VIDEO

⚠️ **La domanda che decideva tutto non era «si può disegnare un fotogramma su una tela» — quello è
banale — ma «quella tela si può ancora LEGGERE».** La pagina è caricata da `file://` e la finestra non
ha né `webSecurity:false` né `allowFileAccessFromFileURLs`: se Chromium avesse considerato la tela
contaminata, `toDataURL` avrebbe sollevato e la funzione non sarebbe esistita. **Misurato prima di
scrivere una riga: non contamina.** Primo pixel letto `[0,255,253]`. Se un giorno Chromium cambiasse
idea, è `prova-album.js` a doverlo dire.

Il vocabolario si è allargato di conseguenza: **un ritaglio viene da un PUNTO del materiale**, e il
punto ha due forme — la **pagina** di un documento e il **secondo** di un video. Non è la stessa cosa
scritta in due modi: una pagina parte da 1 e non ha decimali, un secondo parte da 0 (il primo
fotogramma) e ne ha. In `lib/album.js`: `punto()`, `secondo()`, il tipo dentro l'identità (senza,
«pagina 12» e «secondo 12» darebbero lo **stesso id** per due immagini diverse), il nome del file
`__t0132_` invece di `__p007_`, e una tolleranza di **mezzo secondo** sul gemello — fermare un video
due volte non dà mai lo stesso millisecondo, e l'uguaglianza esatta darebbe un doppione a ogni
ritaglio ripetuto.

⚠️ **Le bande nere non sono fotogramma.** Un `<video>` mostra l'immagine in «contain»: prendere il
riquadro dell'elemento come se fosse il fotogramma sposta ogni ritaglio della metà della banda — un
errore che cresce col riquadro e che a occhio sembra «un po' storto», cioè la specie peggiore. La
geometria la calcola `albumVideoGeom`, e il rettangolo si salva in **pixel del fotogramma**: sono la
cosa stabile di un video, come i punti della pagina lo sono di un PDF.

⚠️ **Il fotogramma si rende 1:1, non al doppio** come la pagina: un video non ha più dettaglio di
quello che ha, e chiedere il doppio darebbe un file quattro volte più pesante con la stessa
informazione. È la differenza fra una sorgente vettoriale e una a pixel.

Il video si mette in **pausa** quando si comincia a trascinare: un fotogramma che cambia sotto il
rettangolo vuol dire ritagliare una cosa e ottenerne un'altra. E «Alla fonte» riapre il video al
secondo giusto, come riapre il documento alla pagina giusta.

#### I nodi-immagine: forma del ritaglio, cornice tolta, ridimensionamento

⚠️ **Una decisione rovesciata, e conviene sapere com'era.** Fino a oggi il rapporto d'aspetto non
entrava MAI nella geometria: la card di un nodo-immagine misurava quanto tutte le altre e il ritaglio
si **tagliava** per starci dentro (`slice`). Il guadagno era una griglia perfettamente regolare; il
prezzo è che di uno schema si vedeva un pezzo — e uno schema di cui si vede un pezzo non è uno
schema. Ora il nodo prende la **forma del ritaglio**: larghezza dalla card, altezza dal rapporto,
`meet`. Misurato su un ritaglio 476×420: nodo 168×161, immagine 164×145.

⚠️ Con un **tetto** a cinque volte l'altezza della card, e ci si arriva **stringendo la larghezza**,
mai schiacciando l'altezza: il rapporto non si tocca, o si torna alla deformazione da cui si
scappava. Un test lo prova con un 100×3000.

**La cornice non c'è più**: tre lati nudi e a sinistra la sola barra del colore, spessa 4 px come su
tutte le card. Il rettangolo resta perché è il bersaglio del click; il tratto torna solo quando il
nodo è selezionato, perché la selezione è un fatto momentaneo e non una cornice.

**Ridimensionare**, da due porte con una funzione sola sotto: le **maniglie agli angoli** (solo sul
nodo selezionato — quattro pallini su ogni ritaglio competerebbero con il ritaglio) e la voce nel
menu contestuale (`−` · `100%` · `+`). ⚠️ La scala si ricava dalla **distanza dal centro**, non dallo
spostamento del puntatore: così qualunque angolo si prenda il gesto vuol dire lo stesso, e tirare in
diagonale non conta doppio. Il gesto intero è **un** passo nella pila, messo al rilascio: a ogni
`pointermove` avrebbe mangiato i venti posti dell'annulla.

⚠️ **E la sovrapposizione coi vicini NON è un debito.** I motori calcolano le spaziature sulla card
di fabbrica e non sanno che un nodo-immagine può essere alto il triplo — ma i nodi-immagine vivono
**solo sulle mappe dell'utente** (decisione del 10 agosto 2026), cioè dove la disposizione la fa la
mano. La regola è imposta dal codice, non affidata all'intenzione: `mappaNodoImmagine` è l'unica
porta che crea un nodo-immagine e sulla generata rifiuta dicendolo, e `genera.js` non emette mai
`immagine`. C'è un controllo sull'app viva che lo tiene fermo. Chi arriva qui cercando il debito da
pagare — insegnare le misure per nodo a quattro motori — non lo trovi: è un caso che non si presenta.

**Resta da fare**: la bolla dopo il ritaglio propone «metti nell'appunto / nella mappa» ma quelle due
strade sono provate solo dai loro pezzi, non dal gesto intero; e non c'è modo di ritagliare a mano
libera o di aggiustare un rettangolo dopo averlo disegnato.

---

## 7. Come è stato lavorato (vale per la prossima volta)

Richiesta: aprire un ventaglio di agenti sui problemi. Il sondaggio ha mostrato **una causa sola**
sotto tutti i sintomi e **due file** che condividevano la stessa nozione: tre agenti scriventi
avrebbero prodotto tre idee diverse di «lezione esistente». Forma scelta: **riparazione singola +
due agenti in sola lettura** sul lavoro adiacente.

Ha reso più del ventaglio pieno:

- il verificatore avversariale ha **corretto la diagnosi**: lo scarto della cartella base avviene in
  `preload.js:106`, non nel renderer, e la mappa base→variante esisteva già — cose che cambiavano la
  patch;
- la ricognizione ha trovato **15 punti** della stessa famiglia dove ne vedevo 2. Quattro erano guasti
  veri che nessuno stava cercando (5.4, 5.5, 5.6 e la trappola del §7.2).

---

## 8. Il prossimo passo

Ordine deciso dall'utente il 10 agosto, dopo che il §6 e il §6-bis hanno chiuso il primo punto.

1. ~~**Il ritentativo sugli errori passeggeri**~~ — **fatto** (§6). Ma non com'era scritto: non
   «esiste solo in `claudecode.js`». Due SDK su tre ritentavano già; il buco era Google soltanto, e un
   ciclo in `provider.completa` avrebbe moltiplicato invece che aggiunto.
2. ~~**La trappola della tendina «espandi»**~~ — **fatta**, §6-ter. Non era piccola come sembrava: la
   tendina era la porta di servizio, e il cancello vero stava in `main.js`.
3. ~~**Viewer pdf.js: prima i pixel, poi zoom e barra di ricerca**~~ — **fatto**, §6-quater. I pixel
   ci sono; zoom e ricerca pure. Restano password, tema scuro, stampa e la chiusura del documento
   quando «fonte» esce dal banco.
4. ~~**L'album nell'interfaccia**~~ — **fatto**, §6-quinquies. L'ordine dopo il viewer era quello
   giusto: il rettangolo si disegna sopra le pagine che il viewer rende, e senza la certezza che
   disegnasse sarebbe stato costruito sul vuoto.

**Parcheggiati dall'utente**, e non per sempre: la **forma delle mappe di corso** (65.158 × 358 px è
un nastro, e serve una decisione: motore che impagina su più righe, o soglia più alta di fabbrica) e
**G3**, i verbi sugli archi. Fra loro l'ordine resta quello: G3 non si fa prima della forma, o si
aggiungono etichette a una mappa che non si può guardare.

**In coda**, misurati il 10 agosto e non toccati:

- **Il ripasso** (AREA 3 di PIANO-BRAYNR). Le carte esistono già — quiz e glossario di ogni capitolo —
  ma lo stato di apprendimento vive **solo in memoria** e viene azzerato a ogni `loadLesson`
  (`App/StudIA.html:2703`). Nessuna cartella `RIPASSO/` esiste in nessun corso, e il codice non la
  nomina mai: il lavoro sull'apprendimento si perde ogni sera.
- **B3**, la fonte a schede (`PIANO-BANCO.md:186`). Parente del viewer ma cosa diversa: il viewer fa
  funzionare **un** documento, B3 ne mette **più d'uno** come linguette nello stesso blocco.
- ~~**B4**~~, la sidebar «dove sei»: **cade**. Nasceva per svuotare una topbar affollata, e la topbar
  adesso è una riga sola.

**Il debito che resta sotto tutto:** l'id di un capitolo è `cartella + ordine` (`…-c03`). Una
rigenerazione che ne infila uno in mezzo sposta gli id di tutti quelli dopo e stacca evidenze,
appunti e nodi-mappa. Dopo oggi è **il solo modo rimasto di perdere lavoro dell'utente**.

**Le due domande aperte sono state chiuse dall'utente nella stessa sessione:**

- **Gli appunti stanno nella variante** (§4.3): l'indice adesso raggruppa per cartella, e sette
  controlli nuovi lo tengono fermo.
- La **copia orfana** nella radice di `Corsi/ai-literacy-anthropic/` è stata spostata nel Cestino.
  ⚠️ Non era un doppione: era una **generazione precedente** della lezione 01 (8 agosto, 18:56-18:59)
  con sette capitoli dai titoli e dagli slug diversi, senza il 04; quella in `LEZIONI/` è stata
  rigenerata il 10 agosto alle 00:13. Nessun appunto, mappa o percorso la citava — verificato slug
  per slug prima di toccarla. Nel Cestino e non cancellata, così è ancora recuperabile.

---

## 9. Dove sta il codice

```
lib/percorsi.js                nomiRimandabili · nomiRaggiungibili — le due liste, accanto a scomponi
lib/espandi.js                 wikilinkRotti: «ci si arriva», non «esiste sul disco»
main.js                        lezioniDelCorso (i nomi citabili) · il conteggio delle lezioni vere
App/StudIA.html                @lezioni-puro-*: scomponiLezione · preferitaFra · cartelleScelte ·
                               risolviLezione · lezioniVisibili · searchBuild
lib/appunti.js                 indice(): raggruppa per cartella, non per titolo (+ etichettaLezione)
lib/ai/ritentativi.js          la manopola: TENTATIVI, e la conversione fra le unità dei tre SDK
lib/ai/google.js               opzioniClient(): il ritentativo che a Gemini non arriva da altrove
lib/ai/anthropic.js · openai.js  opzioniClient(): il numero dichiarato, non ereditato
lib/ai/claudecode.js           transitorio(): il codice ancorato a un contesto, non cercato nel testo
lib/ai/provider.js             motivoDi(): lo status davanti al messaggio · e perché NON c'è un ciclo
lib/ai/provider.js             sommaUso(): la somma dei consumi, in un posto solo
test/ritentativi.js            32 controlli, compresi i client SDK veri con chiave finta
test/costi.js                  16 controlli: che quello che paghi finisca nel registro
lib/reader-parser.js           loadLezioni(): il blocco puro estratto dal renderer vero
test/roundtrip.js              +31 controlli: le due liste, la risoluzione, il percorso muto
test/appunti-rinomina.js       +7: due varianti non si scambiano gli appunti
test/cdp/prova-wikilink.js     il click col mouse su un rimando, e la ricerca dentro il percorso
App/StudIA.html                PDFZOOM · pdfZoomPasso/Adatta/Aggiorna · PDFFIND · pdfFindDispatch/Apri/Chiudi
test/cdp/prova-pdf.js          i pixel contati sulla tela, lo zoom, la ricerca, e i guasti trovati
App/StudIA.html                ALBUM · albumRitaglioModo/Rendi/ChiudiGesto · albumAggiorna/Menu/Azione
App/assets/mappa/modifica.js   copiaImmagine: un nodo può essere un ritaglio dell'album
test/cdp/prova-album.js        il trascinamento vero, e lo stesso ritaglio a due zoom diversi
```
