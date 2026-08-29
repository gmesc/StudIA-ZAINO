# Handoff definitivo — 24 agosto 2026

> **A chi arriva adesso: questo file basta per ripartire.** Sostituisce
> `HANDOFF-DEFINITIVO-2026-08-23.md` come punto d'ingresso e ne eredita per riferimento ciò che non
> ripete. Il *come si costruisce qui* sta in `GUIDA-ARCHITETTO.md` e non cambia; il dettaglio di
> ogni area sta nei `PIANO-*`.

---

## 0. Da dove ripartire, in tre righe

`main` porta i merge di **Q8**, **Q7**, **Q3** e **Q6**, più le **due reti sotto gli appunti**
(§3-bis), albero pulito, **nessun ramo, nessun worktree**.

⚠️ **Se leggi una cosa sola, leggi il §3-bis**: il 26 agosto un appunto dell'utente è stato trovato
col corpo vuoto. È stato ricostruito, la causa ha un nome, e sotto ci sono adesso due reti.

I prossimi lavori sono i due **M** del pacchetto «Quaderno» — **Q4** (sbirciare senza saltare) e
**Q9** (le sottolineature del tutor) — e il pacchetto stesso raccomanda **un piano ciascuno con
`/architetto`** prima di scriverli. Il file di riferimento è
**`HANDOFF-PACCHETTO-QUADERNO.md`**, che è autosufficiente — dice che cosa costruire, dove vive ogni
pezzo, quali fatti sono già misurati e quali trappole già pagate.

⚠️ **Prima di lanciare qualunque cosa che apra Electron**, leggi GUIDA-ARCHITETTO §6.1: la porta di
debug è a esemplare unico e il client CDP finisce a pilotare l'app sbagliata. E **non si chiude mai
un processo per nome**.

📍 **Gli altri venti handoff sono storici**, e non si risalgono a memoria: il **§9 di
`HANDOFF-DEFINITIVO-2026-08-23.md`** tiene la mappa di quale file porta quale argomento, e la regola
è sempre la stessa — il punto d'ingresso è l'`HANDOFF-DEFINITIVO-*` con la **data più alta**.

---

## 1. Lo stato, in cifre

| | |
|---|---|
| `main` | **`6c3c691`** — «merge: la lente vede anche le mappe e le didascalie (Q5)» |
| remoto | `git@github.com:gmesc/StudIA.git` — ✅ **allineato** (`0 0`) |
| rami · worktree | **nessuno** |
| unità | ✅ **48 file**, tutti dentro la catena di `npm test`, exit 0 |
| CDP | ✅ **64 prove** in elenco · 67 file `prova-*.js` sul disco (i 3 fuori sono i noti di luglio) |
| monolite | `App/StudIA.html` **21.621 righe** · moduli in `App/assets/` (pdf.js escluso): **36** |
| pacchetti | ⚠️ **nessuno**: `dist/` è stata svuotata il 23 agosto (2,3 GB). I tre installer che c'erano erano del **17 agosto** e saltavano il lavoro del 18, 19 e 22 — andavano rifatti comunque. Si rifanno con `npm run pacchetto` |

```bash
cd "/Users/giacomomeschini/Claude/StudIA/StudIA"
npm test                                                   # 48 file, exit 0
STUDIA_PORTA=9346 ./test/cdp/con-vault-di-prova.sh         # le 64 prove sull'app viva
STUDIA_PORTA=9346 ./test/cdp/con-vault-di-prova.sh prova-lente-punto.js   # una sola
```

⚠️ Il `cd` fa parte del comando: la cartella di lavoro delle chat è `StudIA/` (quella **di fuori**),
e da lì `./test/cdp/…` non esiste.

⚠️ **E se il lavoro sta su un ramo, il comando per provarlo a mano si dà SEMPRE**, in un blocco a sé
— è una regola dichiarata dall'utente il 23 agosto: `git checkout <ramo> && npm start`. È già
successo che provasse su `main` credendo di essere sul ramo, e che un difetto risultasse «non
corretto» solo perché guardava un'altra build.

⚠️ **Tre file di prova restano fuori dall'elenco**: `prova-l1.js`, `prova-l2.js`, `prova-l3l4.js`
chiedono un `cdp.js` dentro uno scratchpad di luglio che non esiste più. Il conto si fa, non si
ricorda: **67 file, 64 in elenco, 3 fuori** (contati il 26 agosto).

---

## 2. La regola di forma, dichiarata dall'utente e valida oltre ogni pacchetto

**Si scrive sempre pensando alla prova in NODE, non a quella CDP.** Non è «aggiungere una prova
dopo»: è **scegliere la forma del codice prima**, così che la parte che si sbaglia stia in una
funzione pura richiamabile da `node test/<file>.js`.

Il perché è misurato (`PIANO-MODULI.md` §1): una prova CDP costa ~40 secondi e un'istanza di
Electron, una di unità ~40 millisecondi.

**Come si applica**: la decisione (aritmetica, stringhe, tabelle di priorità, «che cosa si fa di un
valore che arriva dal disco») diventa un modulo UMD in `App/assets/…`; al renderer resta leggere il
DOM, chiamare il modulo, fare quello che dice. Alla prova CDP resta **il cablaggio**, mai la logica.

⚠️ **E una prova non si crede finché non la si sa far diventare rossa.** Si rimette il codice di
prima, si rilancia, si guarda che il controllo nuovo fallisca. In due giorni questo metodo ha
trovato: una prova che restava verde col difetto dentro, una che difendeva dal numero di ieri invece
che dalla sua forma, e tre che accusavano l'app per difetti propri.

---

## 3. Che cosa è stato fatto il 23 e il 24 agosto

**35 commit.** Due pacchetti chiusi, più tre lavori laterali.

### Il pacchetto «Leggere» — sette aiuti alla lettura (23 agosto)

Il dettaglio è in `PIANO-ZAINO.md` **§Z12**. In breve: il numero di pagina si scrive (col sommario
del PDF), la voce legge la pagina (macOS), il righello isola la riga, quattro tinte per il foglio,
le frecce voltano pagina invece di sfogliare il corso fantasma, tema e corpo del testo si ricordano,
ed **Esc non costa più niente in nessuno dei suoi gradini**.

Quattro moduli puri: `tasti/lettura.js` · `aspetto/stanza.js` · `fonti/pagina.js` ·
`fonti/righello.js`.

### Il pacchetto «Quaderno» — Q2, la lente porta al punto (24 agosto)

Il dettaglio è in `PIANO-ZAINO.md` **§Z13** e in `HANDOFF-PACCHETTO-QUADERNO.md`. La lente
prometteva «ti porto dove l'ho trovato» e la manteneva a metà: sul PDF **solo quando faceva in
tempo** (un `setTimeout` di 600 ms contro un layer di testo che su un Intel arriva dopo 12,4
secondi), nell'editor **per niente**.

Due moduli: `fonti/attesa.js` e `RicercaIndice.punto`.

### Il pacchetto «Quaderno» — Q8, il quaderno va nel Cestino (24 agosto, sera)

Il racconto è in `PIANO-ZAINO.md` **§Z14**. In breve: appunti, mappe e immagini dell'album — i file
che l'utente ha scritto, gli unici senza seconda copia — ora vanno nel **Cestino di sistema** come
già documenti, media e zaini. Pattern dei fratelli maggiori: `lib/` non conosce Electron, il main
inietta `cestina = shell.trashItem`; con `cestina` la risposta è una Promise, senza resta sincrona.
`note:rimuovi` e `album:rimuovi` sono canali IPC nuovi (solo il main ha `trashItem`); i messaggi
dicono «Va nel Cestino di sistema» invece di «non è reversibile». Le prove nuove sono state fatte
diventare **rosse** sul codice di prima. ⚠️ Pagata di nuovo (l'ottava volta) la trappola degli
apici inversi in un commento dentro un template literal: la suite CDP moriva in `SyntaxError`
prima di partire, in `prova-album-trascina.js`.

### Il pacchetto «Quaderno» — Q7, o entra e si vede, o si ferma sulla soglia (24 agosto, notte)

Il racconto è in `PIANO-ZAINO.md` **§Z15**. Le copie della lista dei media erano **sette, non
cinque**: `preload.js` ne aveva una che l'elenco del 23 agosto non nominava, ed è quella da cui
nascono i rimandi `video:NN`. Ora la sorgente è `mat.EXT_MEDIA`; la copia col player resta,
dichiarata e inchiodata.

Il caso opposto è stato **misurato** con file veri dentro l'Electron del progetto: `.aiff`, `.avi` e
`.mpg`/`.mpeg` Chromium non li apre. Nei corsi restano (la pipeline li trascrive), nello **zaino si
fermano sulla soglia** — e la soglia non consulta nessuna lista: prova ad aprire il file vero, così
due `.mkv` con codec diversi ricevono verdetti diversi e un formato che Chromium imparerà domani
entra da solo. ⚠️ **Nel dubbio si lascia entrare**: il conto è asimmetrico.

⚠️ **Tre difetti li ha trovati l'utente provando a mano, con tutte le suite verdi**: il player
restava con un media morto in mano dopo aver detto perché; il nome del materiale era scritto due
volte nella barra (la stessa forma tolta dalle Fonti il 23); e il rimedio prometteva la trascrizione
**dentro uno zaino**, dove non esiste. Le prove guardavano che l'app *parlasse*, non che cosa
dicesse, e non guardavano affatto che cosa restasse a schermo dopo.

⚠️ E la causa dietro tutti e tre: **le prove del player giravano su media che non esistevano**.
Reggeva finché un media che non si apriva falliva in silenzio.

### Il pacchetto «Quaderno» — Q3, il pallino apre davvero (24 agosto, notte)

Il racconto è in `PIANO-ZAINO.md` **§Z16**. Un frammento preso da un documento nasceva con
`capitolo: state.current` — il capitolo che si stava *leggendo*, che con un PDF davanti non c'entra
e in uno zaino non esiste — quindi il pallino compariva e non apriva. Adesso `mappaEstrai` passa al
nodo il rimando che **«Appunta» ha già in mano** (`origineDaRange`), e `MAPPE/*.json` non cambia
forma. ⚠️ La severità sta in `copiaRimando`, l'unico punto da cui un rimando entra su un nodo: senza
`file` o senza pagina il pallino **non compare affatto**, che è lo stesso difetto al contrario.

### ⚠️ §3-bis — UN APPUNTO SVUOTATO, e le due reti che ne sono nate (26 agosto)

**Il fatto.** Un appunto dello zaino `flow` è stato trovato col frontmatter intatto e il **corpo
vuoto**: il file c'era, il lavoro no. Nel Cestino non c'era niente — quindi non una cancellazione.
Ricostruito da un PDF che l'utente aveva stampato, ricollegando le **36 evidenze** ai loro id veri
(`_evidenze.json` era intatto).

**La causa**, riconosciuta dall'utente: **⌘Z** su un editor la cui cronologia era stata azzerata da
un `setValue` riporta l'editor a uno stato **vuoto**, e il salvataggio automatico scriveva.

⚠️ **Tre riproduzioni sull'app viva erano risultate innocue.** Per questo la difesa non sta nel
gesto sospettato ma nei punti da cui passano **tutte** le scritture — il racconto intero è in
`PIANO-ZAINO.md` **§Z17**:

1. **`appunti.save` rifiuta di svuotare** un appunto che ha del testo, salvo `opt.svuota`: il
   salvataggio automatico non lo dichiara mai, quello esplicito sì. E il rifiuto **si dice**.
   ⚠️ E il **26 agosto** si è aggiunto un terzo pezzo: la postilla era **scritta e invisibile**, e
   ne è nato lo strumento **«Postille»** (`PIANO-ZAINO.md` §Z18). La lezione vale oltre: *provare
   che il dato è sul disco non basta* — nessuna delle tre prove di Q6 guardava se qualcosa
   comparisse a schermo.
2. **`APPUNTI/_versioni/`**: una copia di ciò che sta per essere perso, **solo quando un
   salvataggio accorcia il testo**. `.md` leggibili col Finder, le 10 più recenti, fuori
   dall'esportazione.

⚠️ E due volte lo stesso difetto dentro la rete stessa: **due copie nello stesso istante
diventavano una sola**, con la più vecchia — quella che serviva — sovrascritta. Trovato da un rosso
**a corse alterne**, fatto parlare invece che rilanciato.

### Il pacchetto «Quaderno» — Q1, il quaderno si riapre alla riga (26 agosto)

Il racconto è in `PIANO-ZAINO.md` **§Z19**. Il terzo gemello di `lettura` e `ascolto`. **Il bivio è
stato deciso: la riga viaggia col vault**, in `APPUNTI/_riga.json` — dentro `APPUNTI/` perché
`lib/pacchetto.js` esclude quella cartella quando l'autore non dà i suoi appunti, e dove era
arrivato a leggerli è roba sua quanto il testo. ⚠️ Lo zero è una riga; se l'appunto si accorcia il
segno si **stringe** all'ultima; il cursore ci va **dopo** il `refresh()` di CodeMirror. La
decisione sta in un UMD richiamato da tutti e due i lati.

⚠️ E la trappola degli **apici inversi** è stata pagata di nuovo, sul messaggio del merge: passato
con `-m` fra doppi apici, la shell li ha eseguiti e due nomi sono spariti dal testo. Riscritto con
l'heredoc quotato, che è la forma sicura.

### Il pacchetto «Quaderno» — Q5, la lente vede mappe e didascalie (26 agosto)

Il racconto è in `PIANO-ZAINO.md` **§Z20**. I nodi di mappa e le didascalie erano l'altro testo
scritto dall'utente che la lente non guardava. **Il bivio §6.4 è deciso**: appunti → mappe → ritagli
→ ciò che si è letto, e vale **anche quando un documento vince per punteggio**. Sul nodo il click
**mette a fuoco**.

⚠️ E una lezione di metodo che vale oltre il caso: `prova-testolayer` era **verde da sola e rossa
nella suite**, con una causa invisibile. L'ha detta solo la domanda giusta — *chi c'è sotto il
puntatore* — e la risposta è stata `svg#mappaSvg`: una prova che lasciava la mappa a schermo. **La
diagnostica è rimasta nella prova.** E il primo rimedio non funzionava perché toglieva la chiave
del banco SBAGLIATA (`studia.banco`, morta dal 13 agosto, invece di `studia.banco.c.<contenitore>`).
📌 `prova-b1` e `prova-mappe-ui` usano ancora quella morta: difetto latente identico, non toccato.

### I tre lavori laterali

- il **pannellino della ricerca** nel documento: una riga sola, campo a larghezza costante;
- il **titolo del documento** tolto dalla barra delle Fonti — era la terza copia di due cose già
  dette dal selettore e dal chip, ed era quella che mandava la barra a capo;
- l'**Esc della mappa** che svuotava il blocco invece di chiudere.

---

## 4. Le trappole pagate in questi due giorni

Ognuna è costata almeno una volta, e nessuna si vedeva guardando.

**⚠️ Fermare la propagazione è un ATTO, e si paga solo se si è consumato il tasto.** Un gestore in
cattura su `window` che chiamava `stopPropagation()` *prima* di decidere si è messo a ingoiare l'Esc
senza usarlo — e con lui è sparito l'Esc di mezza app.

**⚠️ La suite INTERA al cancelletto, non solo le prove che tocchi.** Quattro dei difetti peggiori
erano **verdi lanciati da soli** e rossi solo nella suite: dipendevano da che cosa avevano lasciato
le prove precedenti.

**⚠️ Una prova che dice il contrario si RISCRIVE con la promessa, non si aggira.** Sei volte in due
giorni. E in un caso il controllo si **chiamava** «e la mappa non è stata trascinata via con lui» e
**affermava** che la mappa fosse chiusa: passava proprio grazie al difetto.

**⚠️ Un rosso «a corse alterne» si fa PARLARE, non si rilancia.** Tre volte il rosso era della
**prova**, non dell'app: un bersaglio a due parole in cui il doppio click cadeva sullo spazio, una
riga cercata dove lo scorrimento del momento la metteva, e una parola spezzata dalla sillabazione.

**⚠️ Il righello prima del codice.** Tre misure sbagliate hanno quasi fatto correggere il codice
giusto: contare i `top` dei figli di una barra `align-items:center` (diversi *sulla stessa riga*);
misurare un testo con `getComputedStyle().font`, che per la shorthand torna vuota; e credere che una
normalizzazione preservasse la lunghezza.

**⚠️ Le virgolette inverse dentro un comando di shell fra doppi apici vengono ESEGUITE.** Tre volte,
due delle quali in un messaggio di commit finito corrotto. La forma sicura è l'**heredoc quotato**.

**⚠️ Un `replace` che non trova niente NON fallisce**: riscrive il file identico e dichiara di aver
funzionato. Ogni sostituzione automatica va col suo `assert`.

**⚠️ `git merge -F -` non legge da stdin**: il merge non avviene e il comando *sembra* riuscito. Si
scrive il messaggio in un file.

**⚠️ Un agente in worktree isolato non si prende per buono.** Uno aveva misurato una larghezza in un
banco di prova fuori dall'app, e il numero era sbagliato del 38%.

---

## 5. Che cosa resta da fare

### Il prossimo lavoro: il pacchetto «Quaderno», DUE voci su nove

`HANDOFF-PACCHETTO-QUADERNO.md` è autosufficiente. **Sette voci su nove sono fatte** (Q1, Q2, Q3,
Q5, Q6, Q7, Q8); restano i due **M**, e meritano un piano ciascuno:

| | | costo |
|---|---|---|
| **Q4** | sbirciare senza saltare (hover = anteprima) — **il prossimo** | M |
| Q9 | le sottolineature del tutor arrivano come lettura | M |

⚠️ **Q9 ha un vincolo dichiarato dall'utente e non negoziabile**: deve **aggiungere** uno strato,
mai sovrascrivere quelli che lo studente ha già. Il meccanismo esiste (`salva()` conserva il
registro quando nessuno glielo passa), e lo strato entra nel seme dell'identità — è ciò che permette
a due persone di segnare le stesse parole senza scavalcarsi.

### I debiti aperti, piccoli e dichiarati

1. **La schermata `App/guida-zaino/img/20-pdfbar-numerata.png`** mostra la barra di prima: col
   titolo, e senza i tre comandi nuovi di «Leggere». Si rigenera con la campagna CDP del
   laboratorio (skill `guida-app-screenshot`).
2. **Nessun pacchetto costruito**: `dist/` è stata svuotata apposta il 23 agosto, e quello che
   c'era dentro era comunque vecchio di sei giorni. Si rifanno con `npm run pacchetto` (e
   `npm run pacchetto -- x64`, `npm run dist:win`); poi notarizzazione e installer Windows provato
   su Windows — `PIANO-ONBOARDING.md`.
3. **Le tre prove fuori elenco** (`prova-l1`, `prova-l2`, `prova-l3l4`): si riportano al
   `test/cdp/cdp.js` di casa e si mettono in `PROVE=(`, o si tolgono.
4. **Il `frammento` della lente parte sfasato di uno** su un testo che contiene «İ» (U+0130). Il
   confine è misurato e ha il suo controllo in `test/ricerca.js`; chi vuole chiuderlo tocca
   `frammento`, che oggi suppone che la normalizzazione conservi la lunghezza.
5. **Le 46 variabili morte di `pdf_viewer.scoped.css`** (⚠️ rianimarle rimette bordi e margini che
   l'app non ha mai avuto).
6. **La rinomina di una fonte**: si può tenendo il numero, ma il nome del file è citato per esteso
   in sei posti — l'elenco è quello di `fonti.usi()`.
7. **La didascalia di un'immagine dell'album passa due volte dall'escape** (`albumHtml` in
   `lettura/capitolo.js`): una «e» commerciale esce come `&amp;amp;`. La gemella `figuraHtml` no.

### Le code più vecchie, ereditate

`PIANO-BRAYNR.md` §P1.1-quater e -quinquies (i seguiti delle letture), gli incrementi 2 e 3
dell'anteprima scrivibile, e le bande orizzontali sui fondi sovrapposti — che restano il lavoro più
grosso e più fragile della lista.

### Il catalogo, per non ricominciare da capo

La ricognizione del 23 agosto ha prodotto **56 voci** con gesto, bisogno, pezzi esistenti su cui si
appoggiano, rischio e tre voti ciascuna. Il documento è stato consegnato in chat (`IDEE-ZAINO.md`) e
**non è versionato**: le nove voci scelte sono in `HANDOFF-PACCHETTO-QUADERNO.md`. Fra quelle
rimaste fuori, le più votate sono «Il velo», «Lo spoglio», «Con parole tue» e «Le carte le hai già
scritte».

---

## 6. Stato dichiarato, non ereditato

| | |
|---|---|
| **verificato oggi** | `npm test` exit 0 (48 file) · suite CDP intera verde · albero pulito · nessun ramo né worktree · i conti delle prove (48 · 64 · 67) · le righe del monolite (21.621) |
| **ereditato** | i debiti al §5, che vengono dagli handoff precedenti e non sono stati rimisurati |
| **misurato e lasciato aperto** | il `frammento` sfasato sulla «İ» · `dist/` che non esiste |

⚠️ Prima di dichiarare finito un lavoro, la suite CDP va **rieseguita per intera**, non per i file
toccati. In due giorni è la lezione che è tornata più spesso.
