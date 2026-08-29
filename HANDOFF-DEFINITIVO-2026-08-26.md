# Handoff definitivo — 26 agosto 2026

> **A chi arriva adesso: questo file basta per ripartire.** Sostituisce
> `HANDOFF-DEFINITIVO-2026-08-24.md` come punto d'ingresso e ne eredita per riferimento ciò che non
> ripete. Il *come si costruisce qui* sta in `GUIDA-ARCHITETTO.md`; il dettaglio di ogni area sta
> nei `PIANO-*`.
>
> ⚠️ **Se leggi una cosa sola, leggi il §2.** Oggi un appunto dell'utente è stato trovato **col
> corpo vuoto**. È stato ricostruito, la causa ha un nome, e sotto ci sono adesso due reti che
> prima non c'erano. È il fatto più importante della giornata, più di tutte le funzioni.

---

## 0. Da dove ripartire, in tre righe

`main` è a **`e33142c`**, **spinta** (`origin/main` allineata), albero pulito, **nessun ramo,
nessun worktree**.

Il pacchetto «Quaderno» è a **otto voci su nove**. Resta **Q9 — le sottolineature del tutor**, che
l'utente ha messo **in freezer** il 26 agosto: non è abbandonato, è in attesa. Il file di
riferimento resta `HANDOFF-PACCHETTO-QUADERNO.md`, autosufficiente.

⚠️ **Prima di lanciare qualunque cosa che apra Electron**, leggi `GUIDA-ARCHITETTO.md` §6.1: la
porta di debug è a esemplare unico e il client CDP finisce a pilotare l'app sbagliata. E **non si
chiude mai un processo per nome**.

📍 **Gli altri ventuno handoff sono storici**, e non si risalgono a memoria: la mappa di quale file
porta quale argomento è al **§8** di questo file.

---

## 1. Lo stato, in cifre

| | |
|---|---|
| `main` | **`e33142c`** — «docs: Q4 chiuso (Z21) — otto voci su nove, resta Q9» |
| remoto | `git@github.com:gmesc/StudIA.git` — ✅ **allineato** |
| rami · worktree | **nessuno** |
| unità | ✅ **49 file**, tutti dentro la catena di `npm test`, exit 0 |
| CDP | ✅ **65 prove** in elenco · 68 file `prova-*.js` sul disco (i 3 fuori sono i noti di luglio) |
| monolite | `App/StudIA.html` **21.797 righe** · moduli in `App/assets/` (pdf.js escluso): **37** |
| pacchetti | ⚠️ **nessuno**: `dist/` è vuota dal 23 agosto. Si rifanno con `npm run pacchetto` |

```bash
cd "/Users/giacomomeschini/Claude/StudIA/StudIA"
npm test                                                   # 49 file, exit 0
STUDIA_PORTA=9346 ./test/cdp/con-vault-di-prova.sh         # le 65 prove sull'app viva
STUDIA_PORTA=9346 ./test/cdp/con-vault-di-prova.sh prova-sbircia.js   # una sola
```

⚠️ Il `cd` fa parte del comando: la cartella di lavoro delle chat è `StudIA/` (quella **di fuori**).

⚠️ **E se il lavoro sta su un ramo, il comando per provarlo a mano si dà SEMPRE**, in un blocco a
sé: `git checkout <ramo> && npm start`. È già successo che l'utente provasse su `main` credendo di
essere sul ramo.

⚠️ **Il conto si fa, non si ricorda**: 68 file di prova, 65 in elenco, 3 fuori (`prova-l1`,
`prova-l2`, `prova-l3l4`, che chiedono un `cdp.js` di luglio che non esiste più).

---

## 2. ⚠️ UN APPUNTO SVUOTATO, e le due reti che ne sono nate

**Il fatto.** Un appunto dello zaino `flow` è stato trovato col frontmatter intatto e il **corpo
vuoto**: il file c'era, il lavoro no. Nel Cestino non c'era niente — quindi non una cancellazione.
Ricostruito da un PDF che l'utente aveva stampato, **ricollegando le 36 evidenze ai loro id veri**
(`_evidenze.json` era intatto) e i 5 link, associati per posizione nel PDF invece che per ordine.

**La causa**, riconosciuta dall'utente: **⌘Z** su un editor la cui cronologia era stata azzerata da
un `setValue` riporta l'editor a uno stato **vuoto**, e il salvataggio automatico scriveva.

⚠️ **Tre riproduzioni sull'app viva erano risultate innocue** — la postilla dal preload, il gesto
completo in un corso, lo stesso in uno zaino. Per questo la difesa **non sta nel gesto che si
sospettava**, ma nei due punti da cui passano *tutte* le scritture. Il racconto intero è in
`PIANO-ZAINO.md` §Z17.

**Rete 1 — un appunto pieno non si svuota da sé** (`appunti.save`): scrivere il vuoto sopra un
appunto che ha del testo si rifiuta, salvo `opt.svuota`. Il salvataggio **automatico** non lo
dichiara mai; quello **esplicito** sì. ⚠️ E il rifiuto **si dice** anche quando il salvataggio era
silenzioso: è il caso in cui tacere farebbe credere che il lavoro sia al sicuro.

**Rete 2 — le versioni** (`APPUNTI/_versioni/`): una copia di ciò che sta per essere perso.
⚠️ **Si versiona solo ciò che PERDE** — quando il testo nuovo è più corto di quello sul disco — o un
autosalvataggio ogni 1,8 s seminerebbe migliaia di file. Sono `.md` leggibili col Finder, le **10
più recenti** per appunto, e **non escono nell'esportazione**.

⚠️ **Due copie nello stesso istante diventavano una sola**, con la più vecchia — quella che serviva
— sovrascritta. Due volte lo stesso difetto: al secondo, poi al millesimo. Il secondo l'ha trovato
un **rosso a corse alterne**, fatto *parlare* invece che rilanciato.

**I limiti, dichiarati**: le versioni proteggono da oggi in avanti, non retroattivamente, e chi
svuota con un gesto esplicito (⌘S dopo un ⌘Z sbagliato) passa la rete 1 — lì difende la rete 2.

---

## 3. Il pacchetto «Quaderno»: otto voci su nove

Il dettaglio di ciascuna è in `PIANO-ZAINO.md`, ai paragrafi indicati.

| | | dove |
|---|---|---|
| **Q8** | il quaderno va nel **Cestino**, non nel nulla | §Z14 |
| **Q7** | o entra e si vede, o si ferma sulla **soglia** | §Z15 |
| **Q3** | il **pallino** della fonte apre davvero, o non compare | §Z16 |
| **Q6** | la **postilla**: il corpo dell'annotazione | §Z17 |
| **Q1** | il quaderno si riapre **alla riga** | §Z19 |
| **Q5** | la lente vede anche **mappe e didascalie** | §Z20 |
| **Q4** | **sbirciare** senza saltare (hover = anteprima) | §Z21 |
| Q2 | la lente porta al punto esatto *(24 agosto)* | §Z13 |

**E tre cose fuori dal pacchetto**, nate dal guasto del §2: la **rete**, le **versioni**, e lo
strumento **«Postille»** (§Z18) — chiesto dall'utente quando la postilla è risultata *scritta e
invisibile*.

**Le decisioni prese ai bivi**, tutte dichiarate nei rispettivi paragrafi:

- **Q1** — la riga **viaggia col vault**, in `APPUNTI/_riga.json` (dentro `APPUNTI/` perché
  `pacchetto.js` esclude quella cartella quando l'autore non dà i suoi appunti);
- **Q5** — l'ordine dei gruppi è **appunti → mappe → ritagli → ciò che si è letto**, e vale anche
  quando un documento vince per punteggio.

---

## 4. ⚠️ Che cosa ha insegnato questa giornata, e vale oltre il codice

Sono cinque lezioni, e ognuna è costata almeno un rosso o un difetto trovato dall'utente.

**⚠️ PROVARE CHE IL DATO È SUL DISCO NON BASTA.** La postilla si scriveva e restava **invisibile**:
sul documento le evidenze si dipingono con la Custom Highlight API — che non crea elementi su cui
passare il mouse — e una frase lunga non diventa «parola chiave», quindi non ha nemmeno un chip.
Tre prove verificavano la scrittura e **nessuna guardava se qualcosa comparisse a schermo**. Per chi
la usa, invisibile e non salvato sono la stessa cosa.

**⚠️ UN VERDE CHE NON SI SA FAR DIVENTARE ROSSO NON PROVA NIENTE**, e oggi è successo due volte in
forma nuova: una prova CDP restava verde **col difetto dentro** (la postilla nel seme dell'identità)
perché su un'evidenza esistente l'id non viene ricalcolato — il punto in cui il seme conta è l'id
*futuro*; e una mia riga finiva in `|| true`, cioè non poteva fallire.

**⚠️ UN ROSSO SI FA PARLARE, NON SI RILANCIA.** `prova-testolayer` era verde da sola e rossa nella
suite, con una causa invisibile: il doppio click cadeva sul vuoto. Ha parlato solo dopo aver
aggiunto **la domanda giusta** — *chi c'è sotto il puntatore* — e la risposta è stata `svg#mappaSvg`.
La diagnostica è rimasta nella prova.

**⚠️ UNA PROVA LASCIA IL BANCO COME L'HA TROVATO.** È il terzo modo in cui lo stato residuo avvelena
le prove successive, dopo la modalità e i pannellini. E il primo rimedio non funzionava perché
toglieva la chiave **morta** (`studia.banco`) invece di `studia.banco.c.<contenitore>`.
📌 `prova-b1` e `prova-mappe-ui` usano ancora quella morta: difetto latente identico, **non toccato**.

**⚠️ GLI APICI INVERSI DENTRO UN TEMPLATE LITERAL**, pagati altre due volte (la nona e la decima):
una in un commit passato con `-m` fra doppi apici — la shell li ha **eseguiti** e due nomi sono
spariti dal messaggio — e una in un commento dentro una prova CDP, che moriva in `SyntaxError`.
La forma sicura resta l'**heredoc quotato**.

---

## 5. Che cosa resta da fare

### Q9, in freezer (decisione dell'utente, 26 agosto)

**Le sottolineature del tutor arrivano come lettura.** Non è abbandonato: è in attesa. Quando si
riprende, il pacchetto raccomanda `/architetto`, e **due bivi veri vanno chiesti all'utente**:

1. **il canale**: un `_evidenze.json` trascinato, oppure un pacchetto vero con `lib/pacchetto.js`;
2. **quando l'impronta del documento non combacia**: si rifiuta tutto, o si importa lasciando i
   segni orfani?

⚠️ E il **vincolo non negoziabile**, dichiarato dall'utente: deve **aggiungere** uno strato, mai
sovrascrivere quelli che lo studente ha già. Il meccanismo esiste (`salva()` conserva il registro
quando nessuno glielo passa) e lo strato entra nel seme dell'identità **solo se non è vuoto** — è
ciò che permette a due persone di segnare le stesse parole.

### I debiti aperti

1. **Nessun pacchetto costruito**: `dist/` è vuota. `npm run pacchetto`, poi notarizzazione e
   installer Windows provato su Windows (`PIANO-ONBOARDING.md`).
2. **`App/guida-zaino/img/20-pdfbar-numerata.png`** mostra la barra di prima (col titolo).
3. **Le tre prove fuori elenco** (`prova-l1`, `prova-l2`, `prova-l3l4`).
4. **Il `frammento` della lente sfasato di uno** su un testo con «İ» (U+0130).
5. **Le 46 variabili morte** di `pdf_viewer.scoped.css`.
6. **La rinomina di una fonte**: il nome è citato per esteso in sei posti (`fonti.usi()`).
7. **La didascalia di un'immagine dell'album passa due volte dall'escape** (`albumHtml`).
8. 📌 **`prova-b1` e `prova-mappe-ui`** ripristinano il banco con la chiave morta (§4).

### Le code più vecchie

`PIANO-BRAYNR.md` §P1.1-quater e -quinquies, gli incrementi 2 e 3 dell'anteprima scrivibile, e le
bande orizzontali sui fondi sovrapposti.

---

## 6. ⚠️ Una cosa dell'AMBIENTE, non del codice

`npm start` è morto con `electron: command not found`: era sparita **l'intera `node_modules`**, non
solo Electron. Rimessa con `npm install` — il `package-lock.json` era intatto, quindi le versioni
sono quelle di prima. **Perché sia sparita non è noto**, e se ricapita vale la pena capire chi la
tocca.

⚠️ npm blocca gli script `postinstall` (`allow-scripts`), e quello di Electron è ciò che **scarica
il binario da 271 MB**. Se ricapita con la cartella presente:

```bash
npm approve-scripts electron && npm rebuild electron
```

---

## 7. Stato dichiarato, non ereditato

| | |
|---|---|
| **verificato oggi** | `npm test` exit 0 (49 file) · suite CDP intera verde (65 prove) · albero pulito · `origin/main` allineata · nessun ramo né worktree · i conti (49 · 65 · 68) · le righe del monolite (21.797) · l'app si avvia |
| **ereditato** | i debiti del §5, che vengono dagli handoff precedenti e non sono stati rimisurati |
| **misurato e lasciato aperto** | il `frammento` sfasato sulla «İ» · `dist/` che non esiste · la causa della sparizione di `node_modules` |

⚠️ Prima di dichiarare finito un lavoro, la suite CDP va **rieseguita per intera**, non per i file
toccati. È la lezione che in quattro giorni è tornata più spesso.

---

## 8. La catena degli handoff — dove sta che cosa

Gli handoff sono ventidue, e ognuno «sostituisce il precedente ma resta valido per ciò che non
ripete». Risalire la catena a memoria costa una sessione: questa tabella dice **dove guardare**.

**La regola**: il punto d'ingresso è sempre l'`HANDOFF-DEFINITIVO-*` con la **data più alta**.
Tutti gli altri sono storici. In conflitto vince il più recente — e se il conflitto è con
`GUIDA-ARCHITETTO.md`, vince ugualmente l'handoff, che è più recente per costruzione.

| se cerchi | il file |
|---|---|
| la **pipeline**: wizard a sette passi, composer, percorsi, il riquadro «Note e materiali», Chandra | `HANDOFF.md` — **è l'unica specifica di quell'area** |
| mappe personali L0–L4 · ancoraggio delle evidenze · banco B1 · pdf.js **legacy** | `HANDOFF-SESSIONE-2026-08-09.md` |
| mappe a **concetti** (G1–G2) · topbar su una riga · figure nel capitolo · album su disco | `HANDOFF-SESSIONE-2026-08-10.md` |
| rimandi fra lezioni · ritentativi negli SDK · registro dei costi · nodi-immagine | `HANDOFF-SESSIONE-2026-08-10-b.md` e `HANDOFF-DEFINITIVO-2026-08-10.md` |
| ZAINO Z1–Z6a · le barre come token unico · lapide delle fonti | `HANDOFF-DEFINITIVO-2026-08-11.md` |
| identità dei capitoli · P3.1, il ripasso su disco · i moduli UMD | `HANDOFF-DEFINITIVO-2026-08-12.md` |
| il ripasso come sistema (P3.2 · P3.3 · P3.6) | `HANDOFF-DEFINITIVO-2026-08-12b.md` |
| parole chiave: la regola delle tre parole · il tratto | `HANDOFF-DEFINITIVO-2026-08-12c.md` |
| OCR dello zaino sul documento vero · la cornice della mappa | `HANDOFF-DEFINITIVO-2026-08-13.md` |
| il banco che non teneva la disposizione · quale mappa si riapre | `HANDOFF-DEFINITIVO-2026-08-13b.md` |
| la carta e i PDF · trascinare un ritaglio · i numeri dello smontaggio | `HANDOFF-DEFINITIVO-2026-08-14.md` |
| zoom della fonte a tre stati · forbici con ⌘ · le foto nel vault | `HANDOFF-DEFINITIVO-2026-08-14b.md` |
| banco 3×3 e il pittore · il Confronto · i testi che diventano appunti | `HANDOFF-DEFINITIVO-2026-08-15.md` |
| i tre pacchetti · icona ed emoji generate · la caccia al flake | `HANDOFF-DEFINITIVO-2026-08-16.md` |
| lente negli appunti · rinomina di uno zaino · nomi dei tasti | `HANDOFF-DEFINITIVO-2026-08-16b.md` |
| anteprima scrivibile · la guida dentro l'app · i pacchetti del 17 | `HANDOFF-DEFINITIVO-2026-08-17.md` |
| evidenze negli appunti · interruttore dei segni · le **letture** · il grafo | `HANDOFF-DEFINITIVO-2026-08-18.md` |
| il pacchetto «Leggere» · il lavoro del 19 e del 22 · **la mappa della catena originale** | `HANDOFF-DEFINITIVO-2026-08-23.md` (§9) |
| Q2 (la lente al punto) · Q8 · Q7 · Q3 · e il primo racconto del guasto agli appunti | `HANDOFF-DEFINITIVO-2026-08-24.md` |
| **il pacchetto «Quaderno» chiuso a otto su nove · le due reti · le cinque lezioni** | **questo file** |
| il pacchetto «Quaderno» voce per voce, coi fatti misurati e i bivi | `HANDOFF-PACCHETTO-QUADERNO.md` |

⚠️ **Due decisioni scritte come vincolanti sono state poi rovesciate**, e stanno in
`HANDOFF-SESSIONE-2026-08-09.md` §6: la disposizione del banco («una sola, globale» → **una per
contenitore**) e la scala delle mappe generate. È la ragione per cui un handoff vecchio non si
legge mai come se fosse una legge ancora in vigore.

⚠️ **Che cosa NON sta in nessun handoff**: `PIANO-LEGGERE.md` e `IDEE-ZAINO.md` sono stati
consegnati in chat e **non sono versionati**. Di `IDEE-ZAINO` — il catalogo di 56 voci — resta
l'estratto nel §7 dell'handoff del 23.
