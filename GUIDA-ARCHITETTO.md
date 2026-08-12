# Guida dell'architetto — come si costruisce StudIA

> **A chi serve questo documento.** A chi riceve un braindump dell'utente e deve trasformarlo in
> un piano di implementazione: un agente, una skill, o un collaboratore nuovo. Contiene ciò che
> del progetto **cambia lentamente** — filosofia, invarianti, mappa, vocabolario, processo,
> trappole permanenti.
>
> **La regola di lettura**: questo documento dice *come si costruisce qui*; **a che punto siamo**
> lo dice l'HANDOFF-DEFINITIVO più recente, e il dettaglio di ogni area sta nei PIANO-*.
> Se questo documento e un handoff sembrano in conflitto, ha ragione l'handoff: è più recente.
>
> **La regola di manutenzione**: si aggiorna quando cambia un invariante o la mappa — cioè di
> rado, e mai per registrare lo stato di una sessione. Un riferimento che fotografa lo stato è
> la trappola ④ (la seconda copia che diverge) in forma di documento.

---

## 1. Che cos'è StudIA

Un'app desktop (Electron, arm64) per **studiare da un corpus di materiali propri**: decine di
videolezioni e PDF entrano in un *vault*, una pipeline multiagente li trascrive, li indicizza, li
legge per intero e ne costruisce corsi strutturati; un lettore li presenta con quiz, glossari,
mappe concettuali, appunti, evidenze, album di ritagli e ripasso programmato. Il contesto d'uso
originario è la formazione Tutor DSA/BES, ma l'architettura è generale.

Due proprietà la definiscono più di ogni funzione:

1. **Il vault è dell'utente.** Cartelle di file `.md` e JSON leggibili anche in Obsidian, senza
   database. L'app è un'interfaccia sul disco, non il contrario.
2. **I contenuti generati sono rigenerabili; quelli dell'utente no.** Tutta l'architettura ruota
   attorno a questa asimmetria (vedi invarianti 2 e 3).

## 2. Vocabolario

| termine | che cos'è | ⚠️ da non confondere |
|---|---|---|
| **Corso › Lezione › Capitolo** | i tre livelli dei contenuti | nel codice `LESSONS` sono le **lezioni**, non i corsi; nei documenti prima del 9 ago 2026 «progetto» = corso e «corso» = lezione |
| **vault** | la cartella dati (`…/StudIA - file/`), separata dal codice (`…/StudIA/`) dal 3 ago 2026 | il README nella radice descrive un layout più vecchio: non farci affidamento |
| **zaino** | contenitore di documenti *senza* lezioni generate: si studia direttamente sulle fonti | vive in `Zaini/`, parallelo a `Corsi/` |
| **banco** | lo spazio di lavoro del lettore: griglia 2×2 di blocchi, otto forme, ogni blocco ospita uno *strumento* | |
| **strumento** | capitolo, fonti, appunti, mappa, parole chiave, album, ripasso — registrati in `bancoStrumenti()` | la chiave `flashcard` mostra «Ripasso»: la chiave resta per le disposizioni salvate |
| **materiale** | un file sorgente in `MATERIALI/`, numerato (`01 dispensa.pdf`); il numero è ciò che i rimandi citano | il numero si riusa **solo** a impronta (sha1) uguale |
| **rimando** | la grammatica dei link: `pdf:NN#p=7`, `video:NN#t=160`, `cap:<id>`, `fig:…`, `[[lezione]]` | è UNA: mai inventarne una seconda (invariante 7) |
| **evidenza / parola chiave** | testo evidenziato dall'utente, ancorato con TextQuoteSelector | l'ancoraggio è `App/assets/evidenze/ancoraggio.js`, scritto da zero: non deriva dai marker degli appunti |
| **carta** | un'unità di ripasso; identità = `hash(capitolo + domanda normalizzata)`, calcolata **nel main** | non si copia mai: è una *vista* sul quiz/glossario del capitolo |
| **percorso / variante** | scalette alternative sugli stessi capitoli (`PERCORSI/*.json`, otto personaggi) | rimandi/tendina/ricerca seguono il percorso attivo; evidenze, mappe e appunti restano nella variante in cui sono nati |

## 3. Gli invarianti

Numerati per poterli citare nei piani («viola l'invariante 5»). Ogni violazione qui sotto è già
stata pagata almeno una volta.

1. **Il disco è la verità.** Lo stato in memoria del renderer è una *vista* di ciò che sta su
   disco, mai l'originale. `state.learn` è la vista di `RIPASSO/stato.json`; prima era memoria
   pura e il gesto più comune dell'app (`loadLesson`) cancellava il dato più costoso.
2. **Generato e dell'utente non si mescolano.** `LEZIONI/` è della pipeline; `APPUNTI/`,
   `MAPPE/`, `RIPASSO/`, `ALBUM/`, `PERCORSI/` sono dell'utente e la pipeline **non le tocca
   mai**. La distinzione è architetturale (le cartelle), non un'etichetta sui contenuti.
3. **Una rigenerazione non porta via il lavoro dell'utente.** Gli strumenti: l'identità stabile
   dei capitoli con la catena di alias (`lettura/identita.js`, e `genera.js` che *conserva* l'id
   di un capitolo con lo stesso titolo); le lapidi delle fonti (`MATERIALI/_rimossi.json`: un
   documento che torna riprende nome e numero); la potatura **dichiarata** (vedi 4).
4. **Perdere in silenzio è l'unica cosa peggiore di perdere.** Ciò che sparisce si dice («N
   carte non esistono più»); un file illeggibile è un errore dichiarato, non uno stato vuoto —
   «non hai ancora ripassato» e «la tua storia non si è potuta leggere» sono due messaggi diversi.
5. **Una logica, un file.** Una regola pura che serve al main *e* al renderer nasce come modulo
   **UMD** in `App/assets/…` (`<script src>` nel browser, `require()` in Node) e `lib/` la
   richiama. Niente moduli ES: da `file://` costerebbero un server o un bundler. La copia è
   ammessa **solo** dove serve `crypto`/`fs`: allora la logica vive nel main e il renderer se la
   fa dare via IPC (es. `ripasso:ids`).
6. **Una responsabilità per funzione.** Il gesto, il menu e la scorciatoia chiamano **la stessa
   funzione**; la reazione a un cambiamento sta in un punto solo (es. `bancoSincronizzaMappa`:
   i gesti spostano lo strumento, il rilevatore reagisce). Tre porte con tre riti = trappola ④.
7. **Una grammatica sola per i rimandi.** Ogni artefatto nuovo che cita una fonte usa
   `rimandi/sintassi.js` e i gestori esistenti (`openPdf`, `openVideo`, `vaiAlCapitolo`). Zero
   codice nuovo per il click.
8. **Il vestito non si ricopia.** Le barre sono un token (`.tbar`/`.tbtn`, misure dai `--tb-*`;
   la testata è la stessa barra ×1,1 via `.tbar-lg`). Un'interfaccia che deve «sembrare un quiz»
   **usa le classi del quiz**, non colori che gli somigliano. Se ti trovi a scrivere `height:` su
   un bottone di barra, stai sbagliando. Il design system è anche skill globale:
   `~/.claude/skills/studia-app-layout/`.
9. **Scrittura atomica, file leggibili.** Tutte le scritture passano da `appunti.writeAtomic`;
   i file dell'utente restano `.md`/JSON ordinati e stabili (un file che cambia ordine a ogni
   salvataggio non si può leggere in un diff).
10. **Lo schema è il contratto col modello.** `schema/*.json` è ciò che il modello riceve come
    structured output *e* ciò che la validazione (ajv, `lib/validate.js`) applica. Un limite che
    vuoi cambiare (es. quanti quiz per capitolo) si cambia **lì**, insieme alle direttive del
    profilo (`lib/profilo.js`) — chiedere di più a parole produce output che la validazione
    rifiuta.

## 4. Mappa del codice

```
App/StudIA.html          il guscio: markup, <style>, e il renderer che CABLA i moduli.
                         Monolite in smontaggio controllato: criterio e metriche in PIANO-MODULI.md
App/assets/…             i moduli UMD (lettura, mappa, banco, evidenze, rimandi, ripasso, tts,
                         appunti, ricerca, player, dati). Provabili in Node, caricati con <script src>
lib/                     logica Node del main: corsi, appunti, evidenze, fonti, ripasso, genera,
                         mdser (serializzazione .md), validate (ajv), profilo, percorsi, pacchetto…
lib/ai/                  i provider (anthropic, openai, google, claudecode) dietro provider.js;
                         modelli.js è l'elenco; STUDIA_FINTO=1 = modello finto per provare a vuoto
main.js / preload.js     IPC: canali corti («leggi tutto, scrivi tutto»), l'identità si calcola
                         nel main. preload espone window.vault.*
schema/                  i contratti (capitolo, profilo, …) — vedi invariante 10
bin/studia.js            la stessa pipeline da terminale, senza Electron: ingest, schede,
                         architettura, tutto. Stessi moduli dell'app, nessuna logica doppia
test/*.js                unità (npm test): ogni file gira anche da solo con node test/<file>.js
test/cdp/                le prove sull'app viva + con-vault-di-prova.sh (vedi §6)
```

## 5. Mappa dei dati (il vault)

```
StudIA - file/
  Corsi/<id>/
    _corso.md            frontmatter del corso (nascosto: true = corso-laboratorio, non nel lettore)
    LEZIONI/<lezione>/    _lezione.md + NN-*.md   ← della PIPELINE, rigenerabile
    MATERIALI/           i file sorgente numerati + _rimossi.json (lapidi)
    APPUNTI/ MAPPE/ RIPASSO/ ALBUM/ PERCORSI/     ← dell'UTENTE, mai toccate dalla pipeline
    _lavorazione/        stato intermedio della pipeline
  Zaini/<id>/            come un corso, ma senza LEZIONI/
```

Le cartelle dell'utente nascono **quando servono**, mai perché qualcuno ha guardato. Ogni
cartella nuova entra in `lib/pacchetto.js` (export) dal primo giorno, o l'esportazione la perde
in silenzio.

## 6. Come si verifica

```bash
npm test                                   # unità: tutti i file di test/, in catena
./test/cdp/con-vault-di-prova.sh           # tutte le prove sull'app viva
./test/cdp/con-vault-di-prova.sh <nome>    # una sola
```

- Le prove CDP girano su una **copia magra del vault** (23 GB → ~2 MB) e una cartella dati tutta
  loro: non toccano niente dell'utente, e la sua app può restare aperta.
- ⚠️ Porta 9333 a esemplare unico: un'istanza orfana di una corsa interrotta falsa **tutta** la
  suite con errori che non c'entrano (`fetch failed`, ENOENT). Prima di accusare il codice:
  `lsof -ti :9333`, oppure `STUDIA_PORTA=9334`.
- **Le prove misurano, non guardano.** Dopo ogni passo si consegna all'utente una lista corta di
  gesti da provare a mano: più di un difetto reale è stato trovato da lui con tutte le suite
  verdi. Uno screenshot via CDP prima di dichiarare finito un lavoro di UI.

## 7. Come si lavora

1. **Ramo per ogni lavoro** se si parte da `main`; commit frequenti con messaggi che spiegano il
   *perché* (lo stile è nei commit esistenti: prosa, ⚠️ per le trappole pagate).
2. **Il merge si dichiara, non si presume.** Quattro condizioni, tutte: (a) le due suite verdi;
   (b) i gesti provati a mano dall'utente; (c) piani e handoff aggiornati se il lavoro li tocca;
   (d) `main` non si è mossa — altrimenti rebase, risoluzione, e **si rieseguono le suite sul
   codice unito**, che non è mai girato prima.
3. **Lavori laterali a un agente in worktree isolato** — obbligatorio se tocca `App/StudIA.html`
   (nella stessa cartella l'ultimo che salva cancella l'altro) — e **vietargli la suite CDP**
   (userebbe la porta dell'altra sessione). Il rapporto dell'agente non si prende per buono: si
   verificano a mano le due o tre affermazioni che contano, e si riesegue tutto prima di unire.
4. **Le stime sulle sezioni del monolite si dividono per cinque**: su cento righe di sezione ne
   escono venti come modulo (misurato, PIANO-MODULI §3).
5. A fine sessione: **HANDOFF-DEFINITIVO datato**, che rimpiazza il precedente come punto
   d'ingresso e ne eredita per riferimento ciò che non ripete.

## 8. Trappole permanenti

Le più costose, distillate dagli handoff. Ogni ⚠️ è stato pagato almeno una volta.

- **Confini di un blocco del monolite**: si calcolano dalle sentinelle al momento, mai da un
  `grep` di ieri — il file si muove sotto i piedi.
- **Byte NUL letterali nei sorgenti**: `file` dice `data`, git tratta il file da binario (niente
  diff/blame). Trovatone uno, cercarlo **anche altrove**; sostituire con `\0` di escape
  verificando che gli id derivati non cambino.
- **CDP**: i click arrivano a coordinate dello **schermo** (`scrollIntoView` prima di premere);
  il tasto destro non genera `contextmenu` (evento a mano); il `localStorage` sopravvive al
  cambio di vault e falsa le prove («forma di fabbrica» che non è di fabbrica).
- **Niente apici inversi nei commenti dentro un template literal** (pagata sette volte).
- **Una prova nuova va DENTRO `PROVE=(`** nel runner: sostituire la prima occorrenza del nome la
  infila nel commento d'uso, e la suite dice «verde» senza averla mai eseguita.
- **Una cifra scritta in un commento va contata, non ricordata** («nessuno dei 243 coincide» era
  falso: 33 coincidono).
- **`mappaFlush()` non salva se la mappa non è sporca**: scrivere nel documento in memoria e
  chiamare flush *sembra* salvare.
- **Le liste bianche mangiano i campi nuovi**: `CHIAVI` in `lib/appunti.js`, `noteMeta` nel
  renderer, `normalizza()` in `lib/mappe.js`. Il controllo giusto non è «il campo esiste» ma
  **«il campo torna indietro dal disco»**.

## 9. Protocollo per un braindump

Chi riceve un braindump dell'utente e deve produrne un piano:

1. **Leggere, in quest'ordine**: questo documento → l'HANDOFF-DEFINITIVO più recente → il
   PIANO-* dell'area toccata (BRAYNR = appunti/mappe/ripasso; MODULI = smontaggio del monolite;
   ZAINO; BANCO; MAPPE-EDITOR; ONBOARDING). Se il braindump attraversa più aree, tutti i piani
   toccati.
2. **Tradurre nel vocabolario del progetto** (§2) prima di ragionare: mezzo fraintendimento
   classico è «corso» per «lezione».
3. **Passare il piano contro gli invarianti** (§3), uno per uno. Le domande che smascherano il
   90% dei piani sbagliati: *questa logica vivrà in un posto solo? questa cartella è della
   pipeline o dell'utente? che cosa succede a questo dato quando il corso viene rigenerato? chi
   riempie questo campo nuovo, e torna indietro dal disco?*
4. **Il piano dichiara**: che cosa tocca (file per file), dove vive la logica nuova (UMD / lib /
   renderer, e perché), quali prove nuove (unità *e* CDP se c'è UI), quali gesti l'utente
   proverà a mano, e che cosa NON si fa (i non-obiettivi evitano lo scope creep).
5. **All'utente si chiede solo per i bivi veri** — dove due letture del braindump producono
   lavori materialmente diversi. Il resto si decide e si dichiara.
6. **Il lavoro non è finito** finché: suite verdi, gesti consegnati, piani/handoff aggiornati,
   e — se il lavoro ha toccato un invariante — questo documento aggiornato.

## 10. Fonti vive

| documento | che cosa dice |
|---|---|
| `HANDOFF-DEFINITIVO-<data>.md` (il più recente) | lo stato: che cosa è appena successo, che cosa viene dopo, le trappole fresche |
| `PIANO-BRAYNR.md` | appunti, evidenze, mappe, flashcard/ripasso (aree P1–P3) |
| `PIANO-MODULI.md` | lo smontaggio del monolite: criterio, albero dei moduli, metriche |
| `PIANO-ZAINO.md` · `PIANO-BANCO.md` · `PIANO-MAPPE-EDITOR.md` · `PIANO-ONBOARDING.md` | le altre aree |
| `~/.claude/skills/studia-app-layout/` | il design system, riusabile fuori da StudIA |
| `README.md` | ⚠️ fotografa il layout **vecchio** (pre 3 ago 2026): non è una fonte |
