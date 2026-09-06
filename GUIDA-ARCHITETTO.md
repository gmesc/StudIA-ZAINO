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
| **rimando** | la grammatica dei link: `pdf:NN#p=7`, `video:NN#t=160`, `cap:<id>`, `fig:…`, `ev:<id>`, `[[lezione]]` | è UNA: mai inventarne una seconda (invariante 7). ⚠️ `ev:` è il solo che non nomina un posto ma un'**annotazione**: dove porti lo dice lei, e chi lo scrive ne prende anche l'aspetto invece di copiarselo accanto |
| **evidenza / parola chiave** | testo evidenziato dall'utente, ancorato con TextQuoteSelector | l'ancoraggio è `App/assets/evidenze/ancoraggio.js`, scritto da zero: non deriva dai marker degli appunti |
| **strato / lettura** | un insieme di evidenze che si accende e si spegne per intero (l'analisi metrica, le figure retoriche) | lo strato **entra nell'identità** di un'evidenza, e solo quando c'è: è ciò che permette di segnare le stesse parole due volte. Lo strato «Base» non è un record — è l'**assenza** di strato. Visibilità e lettura attiva stanno nel `localStorage`, il registro nel vault |
| **carta** | un'unità di ripasso; identità = `hash(capitolo + domanda normalizzata)`, calcolata **nel main** | non si copia mai: è una *vista* sul quiz/glossario del capitolo |
| **percorso / variante** | scalette alternative sugli stessi capitoli (`PERCORSI/*.json`, otto personaggi) | rimandi/tendina/ricerca seguono il percorso attivo; evidenze, mappe e appunti restano nella variante in cui sono nati |
| **Ritagli / Album Foto** | le due VISTE dello stesso archivio `ALBUM/`: le voci dichiarano `origine` (`ritaglio` · `foto`) | non sono due cartelle: un archivio solo, due filtri — `album:<id>` non deve sapere che cosa ha dietro (invariante 7). La chiave dello strumento resta `album` |
| **foto** | un'immagine portata dentro dall'utente; la sua identità sono i **byte** | un *ritaglio* invece ha materiale + punto + rettangolo. Un ritaglio preso da una foto ha `da` (l'id della madre) come punto |
| **Confronto** | il SECONDO riquadro delle fonti (`fonte2`), con un pdf.js tutto suo | si legge, si zooma, si copia — evidenze, ritagli e «appunta» stanno nella Fonte, e la selezione lì non apre menu apposta |

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
   `~/.claude/skills/studia-app-layout/`. Chi lo tiene fermo: `prova-tbar.js` e
   `prova-topbar-stile.js` per le barre del monolite, **`prova-chat-stile.js`** per la superficie
   CHAT AI (angoli, le due altezze, `--sh-3d`, emoji-font e la grammatica della barra, **nei due
   temi e negli stati dinamici** — un audit statico su quella superficie dava zero anomalie
   mentre il campo della chiave stava a 38,2px). Una superficie nuova si guarda **prima**
   d'innestarla, con un mockup generato dal codice vero: `node docs/mockup-chat/genera.js`.
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
App/assets/…             i moduli UMD (lettura, mappa, banco, evidenze, rimandi, ripasso, tts, stampa,
                         appunti, ricerca, player, dati, fonti/zoom, album/foto, appunti/importa,
                         tasti/nomi = i nomi dei tasti secondo la piattaforma).
                         Provabili in Node, caricati con <script src>.
                         Dal 26 ago: evidenze/postille (che cosa entra nell'elenco delle postille),
                         appunti/segno (dove si riapre un appunto), rimandi/anteprima (che cosa
                         mostra la bolla di un rimando)
App/assets/pdfjs/        pdf.js vendorizzato (build LEGACY) + `pdf_viewer.scoped.css`, GENERATO da
                         bin/pdfjs-css.js: il foglio del viewer incapsulato sotto
                         `:is(#pdfPane, #pdfPane2)`. ⚠️ Chi aggiunge un terzo riquadro col viewer
                         aggiunge il selettore LÌ, o quelle pagine restano ad altezza zero — niente
                         canvas, nessun errore (pagato il 15 agosto col Confronto)
lib/                     logica Node del main: corsi, appunti, evidenze, fonti, ripasso, genera,
                         mdser (serializzazione .md), validate (ajv), profilo, percorsi, pacchetto…
lib/crediti.js           l'inventario delle licenze: lo RICAVA da node_modules + crediti-extra.json
                         (`npm run crediti` → App/assets/dati/crediti.json). Mai scriverlo a mano:
                         un elenco di licenze fermo è una dichiarazione falsa (test/crediti.js lo difende)
lib/ai/                  i provider (anthropic, openai, google, claudecode) dietro provider.js;
                         modelli.js è l'elenco; STUDIA_FINTO=1 = modello finto per provare a vuoto
main.js / preload.js     IPC: canali corti («leggi tutto, scrivi tutto»), l'identità si calcola
                         nel main. preload espone window.vault.*
schema/                  i contratti (capitolo, profilo, …) — vedi invariante 10
bin/studia.js            la stessa pipeline da terminale, senza Electron: ingest, schede,
                         architettura, tutto. Stessi moduli dell'app, nessuna logica doppia
bin/pacchetto-mac.sh     il pacchetto per macOS in un comando (`npm run pacchetto [-- x64]`):
                         bundle, firma ad-hoc, dmg RIFATTO dall'app firmata, e la controprova che
                         monta il dmg. ⚠️ electron-builder fa il dmg PRIMA della firma: sono due
                         copie diverse, e solo una viene spedita
bin/icona.js             l'icona, GENERATA dal tocco OpenMoji (`npm run icona`): .png, .icns e .ico
                         dalla stessa sorgente. La forma dell'angolo è misurata su un'icona di
                         sistema, non indovinata
bin/emoji.js             la tavolozza del selettore, GENERATA (`npm run emoji`) da OpenMoji +
                         Unicode CLDR: verifica che il font disegni ogni carattere prima di
                         offrirlo. Ciò che si cura a mano sta in dati/emoji-curate.json
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
      APPUNTI/_riga.json      a che riga si era arrivati in ogni appunto (il terzo gemello di
                              _lettura.json e _ascolto.json). Sta QUI e non nella radice perché
                              pacchetto.js esclude APPUNTI/ quando l'autore non dà i suoi appunti
      APPUNTI/_versioni/      le copie di ciò che stava per essere perso: si scrive una copia solo
                              quando un salvataggio ACCORCIA il testo, le 10 più recenti per
                              appunto. Non escono mai nell'esportazione
    _lavorazione/        stato intermedio della pipeline
  Zaini/<id>/            come un corso, ma senza LEZIONI/
```

Le cartelle dell'utente nascono **quando servono**, mai perché qualcuno ha guardato. Ogni
cartella nuova entra in `lib/pacchetto.js` (export) dal primo giorno, o l'esportazione la perde
in silenzio.

## 6. Come si verifica

```bash
npm test                                   # unità: tutti i file di test/, in catena (45 al 23 ago)
./test/cdp/con-vault-di-prova.sh           # tutte le prove sull'app viva (56 al 23 ago)
./test/cdp/con-vault-di-prova.sh <nome>    # una sola — è così che si lavora
STUDIA_APP=dist/mac-arm64/StudIA.app \
  ./test/cdp/con-vault-di-prova.sh         # le stesse prove DENTRO il pacchetto
npm run pacchetto                          # bundle + firma ad-hoc + dmg, con la controprova
npm run pacchetto -- x64                   # …e per i Mac Intel (gira qui con Rosetta)
npm run dist:win                           # l'installer per Windows 11
npm run test:ui                            # le prove della CHAT sull'app viva (registro a sé)
STUDIA_SUITE=zaino \
  ./test/cdp/con-vault-di-prova.sh         # SOLO le prove che su questo fork possono passare
```

⚠️ **Le prove della chat hanno un runner e un registro tutti loro**: `bin/prova-zaino.sh`, che si
fabbrica uno zaino «biologia» con due appunti e due PDF e simula il provider. Non stanno in
`PROVE=(` di `con-vault-di-prova.sh`, che gira invece sulla copia del vault vero e quello zaino non
ce l'ha. Una prova nuova della chat va scritta **nel `PROVE=(` di `bin/prova-zaino.sh`**.

⚠️ **La suite intera si lancia al CANCELLETTO, non a ogni passo**: durante il lavoro si lanciano le
prove che si toccano (quaranta secondi invece di sei minuti); la suite intera prima di dichiarare
finito, prima di un merge, e **dopo un rebase** — dove il codice unito non è mai girato.

⚠️ **Una prova nuova va DENTRO l'elenco che la esegue**, e gli elenchi sono DUE: `PROVE=(` nel
runner CDP e la catena di `npm test` in `package.json`. Il 15 agosto `test/atlante.js` è stato
trovato fuori dalla catena: esisteva e non girava mai. È la stessa forma del guasto di
`closePops()`, che chiude i pannellini scritti nel suo elenco e non «tutti».
⚠️ E il conto si fa, non si ricorda: al 23 agosto in `test/cdp/` ci sono **59** file `prova-*.js` e
l'elenco del runner ne nomina **56**. I tre fuori (`prova-l1`, `prova-l2`, `prova-l3l4`) non sono
dimenticati per caso: chiedono un `cdp.js` dentro uno scratchpad temporaneo di luglio, quindi non
partirebbero nemmeno. Un file di prove che non gira è la stessa bugia di un verde che non prova
niente — si riporta a casa o si toglie.

⚠️ **Su questo FORK la suite `con-vault-di-prova.sh` non può essere verde, e va letta sapendo
perché.** Misurato il 6 settembre 2026, stesso runner e stesso vault copiato: **43 rosse su 69
qui** (1073 controlli eseguiti), **0 su 69 nell'app originale** (`~/Claude/StudIA/StudIA`, base
2644b1a — 1786 controlli). Non sono prove rotte: chiedono corsi, lezioni, capitoli e quiz, che il
fork ha rimosso. Il vault ce li ha — `Corsi/` sta accanto a `Zaini/` e i due repo leggono la
stessa config: è il fork che non li espone.

Per questo il runner ha **tre registri**, e i primi due sono quelli che si lanciano davvero:

```bash
STUDIA_SUITE=zaino ./test/cdp/con-vault-di-prova.sh   # 15 · il criterio (a) di un merge QUI
STUDIA_SUITE=corsi ./test/cdp/con-vault-di-prova.sh   # 42 · ciò che dovrà tornare verde con i corsi
```

`PROVE_ZAINO` è verde 15 su 15 **in tutte e due le app**; `PROVE_CORSI` è verde 42 su 42
sull'originale, e qui è rosso per costruzione.

⚠️ **Un registro è una CATENA, non un insieme**, e questa è la trappola che è costata tre corse:
1. sceglierlo fra le prove «verdi nella suite intera» non basta — quattro delle prime 19 di
   `PROVE_ZAINO` sono cadute subito: due (`prova-note`, `prova-topbar`) vogliono un CAPITOLO, due
   (`prova-album-trascina`, `prova-mappa-trascina`) erano verdi solo perché `prova-album` e
   `prova-mappe-ui` giravano prima a preparare i dati;
2. e l'ORDINE conta quanto i nomi: con gli stessi 43 nomi in ordine alfabetico `STUDIA_SUITE=corsi`
   dava 4 rosse sull'originale; nell'ordine di `PROVE=(`, nessuna. I registri lo seguono.

⚠️ **Prima di leggere i rossi si guarda se l'app è arrivata VIVA alla fine.** Una corsa dava 55
rosse invece di 43: 37 erano `fetch failed`, cioè l'eco di un'app di prova **morta** durante
`prova-righello` — un evento solo, mai più riprodotto. Il numero che lo dice non è quello dei
rossi ma quello dei CONTROLLI eseguiti: 488 invece di 1073, cioè metà suite mai girata. Contare i
file rossi faceva sembrare 55 problemi; contarne i motivi ne mostrava 35 identici.

⚠️ `prova-righello.js` è fuori da entrambi i registri: nella suite intera passa, dentro un
registro no (dipende da uno stato che solo la catena lunga prepara), ed è l'unica prova che ha
fatto morire l'app. Ha un guaio suo, da guardare a parte.

⚠️ E il runner **dice i nomi** delle prove rosse, non solo quante: ricostruirli dall'uscita con un
grep ne trova meno del vero, perché una prova che muore in un'eccezione non stampa né «KO» né «✗».

- Le prove CDP girano su una **copia magra del vault** (23 GB → ~2 MB) e una cartella dati tutta
  loro: non toccano niente dell'utente, e la sua app può restare aperta.
- ⚠️ Porta 9333 a esemplare unico: un'istanza orfana di una corsa interrotta falsa **tutta** la
  suite con errori che non c'entrano (`fetch failed`, ENOENT). Prima di accusare il codice:
  `lsof -ti :9333`, oppure `STUDIA_PORTA=9334`.

### 6.1 Convivere con un altro Electron sulla macchina

Sulla macchina dell'utente girano più progetti Electron (StudIA, MappAI, e Claude.app stessa è
Electron), e in sviluppo `npm start` è `electron .` per tutti: nella lista dei processi le
istanze sono **binari con lo stesso nome**. Da qui tre regole, tutte pagate.

1. ⚠️ **Non si chiude MAI per nome dell'applicazione.** `pkill -f Electron`, `killall Electron`,
   `pkill -f "electron ."`: qualunque pattern su un nome di app prende **ogni** Electron della
   macchina — l'app che l'utente sta usando a mano, quella dell'altro progetto, e Claude.app. Si
   chiude **solo per PID annotato al lancio** — è ciò che fa il runner (`PID_APP=$!`, `kill
   "$PID_APP"` dentro un `trap EXIT INT TERM`) — oppure per la **porta di debug**
   (`pkill -f "remote-debugging-port=9345"`), che è un numero che nessun altro apre.
   Misurato due volte: in MappAI il 9 agosto (chiuse le app aperte dell'utente nella notte), e in
   StudIA il 17 agosto — l'app aperta a mano che «si chiudeva all'improvviso» mentre l'altra
   sessione lavorava, senza nessun crash.
2. ⚠️ **La porta di debug è a esemplare unico, e il guasto peggiore non è «occupata».** Se due
   progetti scelgono lo stesso numero, la seconda app non riesce ad aprirla ma il client CDP, che
   cerca `localhost:<porta>/json`, trova comunque un bersaglio: **quello dell'altro progetto**, e
   comincia a pilotarlo — cioè prove che cliccano dentro un'altra app, con dietro un vault vero.
   Per questo il runner controlla la porta con `lsof` **prima** di partire e si rifiuta di
   continuare. I numeri dichiarati: **9333** la suite, **9345** il laboratorio degli screenshot,
   **9222** MappAI — che è la porta di fabbrica di Chrome, quindi la più esposta agli incroci. Un
   numero nuovo si dichiara qui.
3. ⚠️ **Due campagne insieme si rubano il fuoco e si accorciano le attese.** Una finestra che si
   apre viene davanti, e i gesti CDP passano da coordinate vere: la prova dell'altro progetto può
   premere mentre è coperta — è la stessa trappola che `prova-wikilink` documenta per il divisore
   del banco, e il rosso accusa la cosa sbagliata. E due Electron con PDF e OCR insieme allungano
   tutto: le attese scritte per una macchina scarica diventano corte (è la forma delle 8 rosse
   dell'Intel: attese, non guasti). Mentre gira una campagna, l'app **non** si tiene aperta a mano.

Ciò che rende innocuo il resto è l'isolamento: `--user-data-dir` nella cartella temporanea e la
copia magra del vault. Un progetto che non isola la cartella dati scrive nella config dell'app
vera — ed è il motivo per cui quella riga esiste.

**La diagnosi, quando un'app sparisce**: un crash lascia un rapporto in
`~/Library/Logs/DiagnosticReports/` col nome `Electron-…`. Se lì non c'è niente all'ora giusta,
non è crashata: è stata terminata da fuori, e il colpevole è la regola 1.
- **Le prove misurano, non guardano.** Dopo ogni passo si consegna all'utente una lista corta di
  gesti da provare a mano: più di un difetto reale è stato trovato da lui con tutte le suite
  verdi. Uno screenshot via CDP prima di dichiarare finito un lavoro di UI.
- ⚠️ **Il pacchetto è un secondo esemplare, e va provato come tale**: quello che i tester
  eseguono non è la cartella ma il bundle, dove la whitelist `files` può aver lasciato fuori
  qualcosa e la firma può mancare. `STUDIA_APP=…` esegue le stesse prove lì dentro; `npm run
  pacchetto` chiude verificando la firma dell'app **dentro il dmg**, non di quella in `dist/`
  (electron-builder fa il dmg *prima* della firma ad-hoc: sono due copie diverse).
- ⚠️ **Gli esemplari sono più di due**: arm64, Intel, Windows. Un binario x64 si può *eseguire* su
  Apple Silicon con Rosetta, quindi il pacchetto Intel si prova davvero invece di supporlo — e le
  prove là sono più lente: le 8 rosse misurate il 16 agosto erano attese troppo corte, non guasti
  (il layer di testo di un PDF da 266 pagine arriva dopo 12,4 s invece di 1-2). Windows invece **non
  si prova da qui**: si misura che l'installer sia valido e completo, non che parta.
- **Una macchina piccola è un requisito, non un'ipotesi**: 560 MB a riposo, 670 con PDF e mappa,
  1,3 GB al picco dell'OCR — e quel picco **non cresce con le pagine**. I numeri stanno in
  PIANO-ONBOARDING e nel README perché servono a rispondere «ci gira?» senza riaprire il profiler.

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
   ⚠️ E con lui **due righe di manutenzione, o la catena torna illeggibile**: si riporta nel nuovo
   handoff la **mappa della catena** (§9 di quello del 23 agosto) con una riga in più per il
   precedente, e in testa a quello che si lascia indietro si mette il riquadro `📍 **Storico.**`
   che dice che cosa resta valido lì. Diciannove handoff senza quella mappa costano una sessione a chi
   arriva: è la trappola ④ in forma di documento.

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
- **Un processo si chiude per PID o per porta di debug, mai per nome**: `pkill -f Electron` prende
  ogni app Electron della macchina, comprese quelle dell'utente e Claude.app. Regole intere in
  §6.1 — è la trappola che si paga *sull'app di qualcun altro*, quindi non la si scopre da un
  rosso nella propria suite.
- **Niente apici inversi nei commenti dentro un template literal** (pagata sette volte).
- **Una prova nuova va DENTRO `PROVE=(`** nel runner: sostituire la prima occorrenza del nome la
  infila nel commento d'uso, e la suite dice «verde» senza averla mai eseguita.
- **Una cifra scritta in un commento va contata, non ricordata** («nessuno dei 243 coincide» era
  falso: 33 coincidono).
- **`mappaFlush()` non salva se la mappa non è sporca**: scrivere nel documento in memoria e
  chiamare flush *sembra* salvare.
- **Un valore scritto a mano dove ce n'è uno vero**: `artifactName` conteneva «arm64» invece di
  `${arch}`, e la build Intel provava a sovrascrivere il dmg dell'altra architettura, morendo
  dentro `hdiutil` con un errore che parlava d'altro. La stessa forma della lista bianca: qualcosa
  che *sembra* generico e invece nomina un caso solo.
- **Quello che si genera si genera**, e la ricetta si versiona al posto del prodotto: crediti,
  icona (`.png`/`.icns`/`.ico`), tavolozza delle emoji. Un binario rigenerabile messo in git e poi
  ritoccato a mano è la trappola ④ in forma di file: fra sei mesi nessuno sa più da quale sorgente
  venisse. E il generatore **misura invece di assumere** — il font disegna davvero quel carattere?
  la forma dell'angolo coincide con quella di sistema? — perché è lì che si nascondono le bugie
  silenziose.
- **Un vincolo può essere caduto senza che il codice se ne accorga**: `risolvi` elegge un vincitore
  fra i segni che si accavallano perché fu scritto per marcare il DOM, dove due `<span>` sugli
  stessi caratteri non si annidano. Con gli highlight quel problema non esisteva più da mesi, e
  intanto si continuavano a buttare via segni che l'utente aveva fatto. Quando una regola ha una
  ragione scritta, rileggerla dopo un cambio di tecnica.
- **Un filtro «che cosa si vede» non va messo nella funzione che dice «che cosa c'è»**: `evidenzeDi`
  risponde a quali evidenze appartengono a una superficie — un fatto — e la usano sia chi dipinge sia
  chi risponde ai gesti. Filtrandoci dentro l'interruttore delle sottolineature, con i segni spenti
  `evidenzaSotto` avrebbe detto «qui non c'è niente» e ri-evidenziare una frase le avrebbe cambiato
  il colore di nascosto. *Nascondere cambia come si vede, mai che cosa succede.*
- **Un'uscita anticipata «tanto non c'è niente da fare» salta anche la coda che serviva**:
  `evidenzeDisegna()` tornava subito quando non c'era nessuna evidenza da accendere — e «zero
  evidenze a schermo» è **anche** l'istante in cui si toglie l'ultima, cioè quando gli appunti che
  la citavano devono scolorirsi. Ricolorare aggiornava, togliere no. Prima di mettere una scorciatoia
  sul caso vuoto, guardare che cosa sta **dopo** di lei.
- **Aggiungere un campo al SEME di un'identità cambia gli id di ciò che è già nei vault**: si fa
  solo *condizionalmente* — «chi ce l'ha usa il seme nuovo, chi non ce l'ha quello di sempre» — o
  tutto ciò che cita quegli id (i rimandi `ev:`, `album:`, `cap:` scritti negli appunti) smette di
  ritrovarli, in silenzio. Un valore d'oro nella prova è ciò che tiene ferma la promessa.
- **Una chiave nuova nel file la cancella il primo salvataggio che non la conosce**: `salva()` di
  `lib/evidenze.js` riscrive l'intero JSON, e il registro degli strati sarebbe sparito al primo
  cambio di colore. La difesa sta *dentro la funzione che scrive* — rilegge ciò che non le è stato
  passato — perché è l'unico punto da cui passano tutte le scritture.
- **Copiare un colore è peggio che citarlo**: un aspetto scritto in due posti (l'indice *e* il file
  dell'utente) diverge al primo ritocco, e per non farlo divergere si finirebbe a riscrivere i file
  dell'utente per un gesto fatto altrove. Nel markdown va l'**indirizzo** (`ev:<id>`), e l'aspetto si
  chiede a chi lo possiede — è il motivo per cui ricolorare una parola chiave cambia anche gli
  appunti che la citano senza toccarne uno.
- **Le liste bianche mangiano i campi nuovi**: `CHIAVI` in `lib/appunti.js`, `noteMeta` nel
  renderer, `normalizza()` in `lib/mappe.js`. Il controllo giusto non è «il campo esiste» ma
  **«il campo torna indietro dal disco»**. (E la stessa forma prende anche le **guardie**: la
  condizione d'uscita di `apertoRipristina` guardava due campi su quattro.)
- **«Non salva» è quasi sempre «qualcun altro riscrive»**: prima di cercare il salvataggio che
  manca, cercare chi scrive quella chiave *senza essere stato chiamato da un gesto*. Un ripristino
  che riapre il contenuto non deve toccare lo stato che l'utente ha scelto — e ciò che è ricordato
  lo scrive **solo un gesto**, mai chi monta o chi ripristina.
- **Un comando spento che deve poter spiegarsi non si spegne con `disabled`**: quell'attributo non
  emette il click, quindi il comando resta grigio e muto e il `title` non lo legge nessuno (chi
  preme un tasto morto non ci passa sopra col mouse). Si usa `aria-disabled` — stessa veste, ma il
  click arriva — e la risposta dice **perché** e **dove si rimedia**.
- **Quando una misura e l'utente si contraddicono, apri il file dell'utente**: tre prove verdi
  contro «non funziona», e la differenza stava in un campo dentro la sua mappa (`vista.motore`).
- **Provare che il dato è SUL DISCO non basta**: una funzione può scrivere benissimo e restare
  INVISIBILE. Le evidenze sul PDF si dipingono con la Custom Highlight API, che non crea elementi
  su cui passare il mouse; una frase lunga non diventa parola chiave, quindi non ha un chip. La
  postilla era scritta e non aveva nessun posto dove mostrarsi, e per chi la usa invisibile e non
  salvato sono la stessa cosa. Una prova che verifica la scrittura e non guarda lo schermo è mezza
  prova.
- **Una prova lascia il BANCO come l'ha trovato.** È il terzo modo in cui lo stato residuo avvelena
  le prove successive, dopo la modalità e i pannellini: `partiPulito()` non tocca il banco, e più
  blocchi vuol dire riquadri più bassi — chi calcola un bersaglio su un layout e ci clicca con un
  altro accusa l'app per colpa propria. ⚠️ E la chiave è `bancoChiave()` →
  `studia.banco.c.<contenitore>`: `studia.banco` è la chiave di modalità, **morta dal 13 agosto**.
- **Un rosso invisibile si fa PARLARE aggiungendo la domanda giusta**, non rilanciando: davanti a un
  doppio click che «non seleziona», la domanda che ha risolto in un colpo è stata *chi c'è sotto il
  puntatore* (`document.elementFromPoint`). La diagnostica poi RESTA nella prova, perché quel rosso
  non si distingueva da un guasto vero.
- **Un salvataggio automatico non può distruggere il lavoro di chi scrive**: `appunti.save` rifiuta
  di scrivere il vuoto sopra un appunto che ha del testo, salvo che chi chiama lo dichiari
  (`opt.svuota`) — e solo un gesto esplicito lo dichiara. Nato da un appunto vero trovato col corpo
  vuoto (26 agosto): la causa era un ⌘Z su una cronologia azzerata da un `setValue`, ma la difesa
  non sta nel gesto sospettato — sta nel punto da cui passano tutte le scritture.

## 9. Protocollo per un braindump

Chi riceve un braindump dell'utente e deve produrne un piano:

1. **Leggere, in quest'ordine**: questo documento → l'HANDOFF-DEFINITIVO più recente → il
   PIANO-* dell'area toccata (BRAYNR = appunti/mappe/ripasso; MODULI = smontaggio del monolite;
   ZAINO; BANCO; MAPPE-EDITOR; ONBOARDING; FOTO = immagini dell'utente). Se il braindump
   attraversa più aree, tutti i piani toccati.
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
| `HANDOFF-DEFINITIVO-<data>.md`, quello con la **data più alta** (oggi: **30 agosto 2026**) | lo stato: che cosa è appena successo, che cosa viene dopo, le trappole fresche. ⚠️ Dal 30 agosto è **l'unico**: i venti storici sono stati eliminati e vivono in git (il suo **§7** dice come si riprendono). Un handoff vecchio non è una legge in vigore — due decisioni scritte lì come vincolanti sono state poi rovesciate |
| `HANDOFF.md` | ⚠️ è vecchio nei numeri, ma è l'**unica specifica della pipeline**: wizard, composer, percorsi, figure, Chandra. Finché quell'area non ha un `PIANO-*` suo, si legge lì |
| `PIANO-BRAYNR.md` | appunti, evidenze, mappe, flashcard/ripasso (aree P1–P3) |
| `PIANO-MODULI.md` | lo smontaggio del monolite: criterio, albero dei moduli, metriche |
| `PIANO-ZAINO.md` · `PIANO-BANCO.md` · `PIANO-MAPPE-EDITOR.md` · `PIANO-ONBOARDING.md` | le altre aree |
| `PIANO-FOTO.md` | le immagini dell'utente: import, Album Foto, visualizzatore, ritagli sulle foto |
| `PIANO-ONBOARDING.md` | il primo avvio, **i tre pacchetti** (mac arm64 · mac Intel · Windows) e i requisiti misurati |
| `~/.claude/skills/studia-app-layout/` | il design system, riusabile fuori da StudIA |
| `graphify-out/` (non versionato) | il grafo della conoscenza del progetto: `graph.html`, `GRAPH_REPORT.md`, `graph.json` interrogabile. Si rifà con `/graphify .` e si aggiorna con `/graphify . --update` — si versiona la ricetta, non il prodotto |
| `README.md` | riscritto il 16 ago 2026: che cos'è, come si comincia, i pacchetti, come si verifica. Ora è una fonte (prima fotografava il layout pre 3 agosto) |
