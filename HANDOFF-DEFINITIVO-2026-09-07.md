# Handoff definitivo — fork StudIA - ZAINO, 7 settembre 2026

> **A chi arriva adesso: questo file basta per ripartire.** Sostituisce
> `HANDOFF-DEFINITIVO-2026-09-06.md`, che resta sul disco come documento della giornata
> precedente. Il *come si costruisce qui* sta in `GUIDA-ARCHITETTO.md`; la chat in `docs/CHAT.md`.

Base StudIA: `2644b1a5ed28cf0b6099e7bbbe58cd4ba859a5cd`. La richiesta del fork sostituisce le
decisioni storiche che vietavano qualunque AI nello zaino: c'è una chat didattica, senza
generazione di corsi. I file d'ingresso della pipeline sono rimossi; le librerie condivise
restano per gli strumenti dello zaino, ma i comandi CORSI non sono eseguibili dall'app.

## Dov'è il codice

- `lib/zaino-only.js` barriera IPC e preload · `lib/chat.js` contesto, ruoli, sessioni ·
  `lib/chat-profili.js` profili nel vault · `lib/chat-provider.js` sei provider ·
  `lib/chat-ipc.js` ponte, chiavi solo nel main.
- `App/assets/chat/ui.js` + `ui.css`: la finestra della chat e le due schede di Impostazioni.
- `test/electron-chat-app.js` e `bin/prova-zaino.sh`: le prove della chat sull'app viva, con
  provider e voce simulati **solo** dall'entry point di prova.

Le conversazioni stanno in `Zaini/<id>/CHAT`; le chiavi non viaggiano nel vault; i profili sono
comuni agli zaini dello stesso vault. L'appunto aperto viene salvato prima di ogni invio.

## Come si verifica, oggi

```bash
npm test                                              # 58 file in catena
npm run test:ui                                       # le prove della CHAT sull'app viva
STUDIA_SUITE=zaino ./test/cdp/con-vault-di-prova.sh   # 34 · il criterio (a) di un merge QUI
STUDIA_SUITE=corsi ./test/cdp/con-vault-di-prova.sh   # 35 · rosse qui, e va bene così
STUDIA_SORGENTE=~/Claude/StudIA/StudIA STUDIA_SUITE=zaino ./test/cdp/con-vault-di-prova.sh
                                                      # le STESSE prove contro l'app originale
```

⚠️ **La suite intera dà 43 rosse su 69, e non è una regressione**: quelle prove chiedono corsi,
lezioni, capitoli e quiz, che il fork ha rimosso. La stessa suite sull'app originale
(`~/Claude/StudIA/StudIA`, base `2644b1a`) è **69 su 69 verdi con 1786 controlli**. Il vault i
corsi ce li ha — `Corsi/` sta accanto a `Zaini/`, e i due repo leggono la stessa config: è il fork
che non li espone. Per questo esistono i due registri, e `PROVE_CORSI` è l'elenco che dovrà
tornare verde quando le due metà si rimetteranno insieme. Gli stessi registri stanno sul ramo
`registri-zaino-corsi` dell'app originale.

## La superficie CHAT AI, vestita col design system

Era arrivata con un dialetto suo. Misurato sull'app viva prima di toccare niente, 98 elementi:
**21 tondi**, 2 ombre a riposo scritte a mano (nere anche nel tema scuro), 3 stack di font senza
`--emoji-font`, 2 altezze fuori famiglia, 4 colori fissi, e una testa che somigliava a una barra
degli strumenti senza esserlo.

Adesso segue i token (invariante 8): la testa **è** la `.tbar` dell'app con la grammatica del
§5bis (ruolo · barretta · `+` · spazio · `⚙ − ×`), due sole altezze (`--tb-h` in barra, `--ctl-h`
altrove), `--sh-3d` solo su ciò che galleggia, e `--err`/`--err-ink` nei due temi — l'errore era
`#bd4444` fisso dietro un `var(--red-strong)` che non è mai esistito in nessun `:root`.

⚠️ La regola che vestiva i `select` della chat prendeva anche `#voceLettura`, un controllo
dell'app spostato in quella scheda: usciva tondo. Si è chiusa **togliendo** la regola.

`test/cdp/prova-chat-stile.js` tiene ferme queste promesse: 19 controlli per corsa, cinque
superfici, i due temi, con una conversazione vera aperta — bolla, markdown, fonti e comandi della
risposta non esistono finché nessuno parla. La prova è stata **fatta diventare rossa apposta**,
rimettendo le cinque cose di prima: le ha viste tutte e cinque.

Il mockup d'approvazione si genera dal codice vero: `node docs/mockup-chat/genera.js` (il CSS è il
blocco `<style>` del monolite, il markup è letto da `ui.js`, il tema scuro è estratto dai token e
la generazione **si ferma** se lì dentro finisse una regola di componente). Il file prodotto sta
fuori da git.

## I pacchetti (rifatti la mattina del 7, dopo il merge di tutto)

`main` = `a5e27f2`: dentro ci sono i registri, il guscio del CSS di pdf.js corretto, la guida con
gli screenshot rigenerati e il sito. Sul codice unito: `npm test` verde, ZAINO 34/34 (759).

- `dist/StudIA - ZAINO-1.1.0-arm64.dmg` (231 MB) — **notarizzato**: app e dmg `status: Accepted`,
  ticket cuciti a tutti e due; rimontato, l'app dentro è `accepted · source=Notarized Developer
  ID`. ⚠️ Il dmg in sé non porta una firma propria (`codesign -dv` → «not signed at all»): lo script
  lo notarizza e lo cuce ma non lo firma, e `spctl -t open --context context:primary-signature` sul
  file dice «rejected». Non cambia l'apertura col doppio click — la controprova è sull'app — ma
  firmare anche il dmg prima di notarizzarlo è la riga che manca a `bin/notarizza-mac.sh`.
- `dist/StudIA-ZAINO-1.1.0-setup-x64.exe` (168 MB) — NSIS x64, `PE32 executable (GUI) … Nullsoft
  Installer`; lista bianca rispettata, stessi file dell'app del dmg (6255 in `node_modules`, uguali).
  **Non firmato** (niente Authenticode: SmartScreen avvisa) e **non eseguito**: da qui si misura che
  sia valido e completo, non che parta.
- Tutti e due contengono la guida rigenerata e il guscio corretto (misurato dentro i bundle: stesso
  md5 dello screenshot della chat, 7 blocchi `&`, `color-scheme` tolto).

**GitHub.** Il fork ha il suo repo: `origin` = `git@github.com:gmesc/StudIA-ZAINO.git` (l'`upstream`
resta la cartella dell'app originale). `main` e il tag `v1.1.0` sono stati spinti il 7 settembre, su
richiesta esplicita. ⚠️ Il primo tentativo l'aveva fermato il classificatore dei permessi: in
`~/.claude/settings.json` la sezione `autoMode.environment`, scritta per un altro progetto
(rizzo-pii), dichiara fidato solo quel remote. Il push si fa solo quando lo chiede l'utente, e le
due strade per non farlo bloccare (regola `Bash(git push *)` in `.claude/settings.local.json`, o
una riga in `autoMode.environment` che nomina questo repo) stanno nella chat di quel giorno.
La **Release `v1.1.0`** è pubblicata (`gh release create`, dopo `gh auth login` fatto dall'utente):
`StudIA-ZAINO-1.1.0-arm64.dmg` (231 MB) e `StudIA-ZAINO-1.1.0-setup-x64.exe` (168 MB), e
`…/releases/latest` ci arriva — il bottone «Scarica» del sito funziona. ⚠️ GitHub trasforma gli
spazi del nome di un allegato in punti: il dmg dello script (`StudIA - ZAINO-…`) era diventato
`StudIA.-.ZAINO-…`, ed è stato ricaricato col nome pulito. Il nome senza spazi va messo in
`bin/notarizza-mac.sh`, accanto alla firma del dmg: sono le due righe che gli mancano.

A ogni versione: `npm run notarizza`, `npm run dist:win`, poi la Release nuova con i due file.

⚠️ Gli script adesso buttano il dmg che electron-builder fa per conto suo: ne restavano **due**
quasi omonimi, e il non notarizzato aveva il nome più pulito — cioè era quello che uno spedisce.

## Le trappole pagate, in ordine di quanto sono costate

1. ⚠️ **Un registro è una CATENA, non un insieme.** Sceglierlo fra le prove «verdi nella suite
   intera» non basta: quattro delle prime 19 di `PROVE_ZAINO` sono cadute subito. E l'**ordine**
   conta quanto i nomi — con gli stessi 43 in ordine alfabetico `STUDIA_SUITE=corsi` dava 4 rosse
   sull'originale; nel loro ordine, nessuna.
2. ⚠️ **Prima di leggere i rossi si guarda se l'app è arrivata VIVA alla fine.** Una corsa dava 55
   rosse invece di 43: 37 erano `fetch failed`, l'eco di un'app di prova **morta**. Il numero che
   lo rivela non è quello dei rossi ma quello dei **controlli eseguiti** — 488 invece di 1073.
   Contare i file rossi faceva sembrare 55 problemi; contarne i motivi ne mostrava 35 identici.
   **Spiegato il 7 settembre** (sotto): non era un crash, e adesso il runner si ferma da sé.
3. ⚠️ **Una prova si prepara lo stato che le serve, non lo eredita.** `prova-righello` passava
   nella suite intera e cadeva dentro un registro, con due sintomi diversi e una causa sola: un
   PDF ereditato **scrollato**, con 3 righe in vista su 149. Il rimedio non è abbassare la soglia.
4. ⚠️ **Un apice inverso dentro un template literal**, anche solo in un commento, lo chiude a metà
   e uccide il file in `SyntaxError`. È scritto nel `CLAUDE.md` e l'ho pagato lo stesso.
5. ⚠️ **Contare «una risposta» invece di «una in più»** rende un rosso alterno: la chat riapre la
   conversazione lasciata dalla prova precedente.
6. ⚠️ **Il click CDP va per COORDINATE**: se il bersaglio si muove ancora, il click cade accanto.
   La guardia sta nell'helper condiviso di `prova-chat-zaino.js`, che di click ne fa venti.

## Il «crash» di prova-righello, spiegato — 7 settembre

Non era un crash, e l'ho potuto dire perché la corsa incriminata era ancora sul disco: lo
scratchpad della sessione del 6 (`suite-cdp.txt`, finito alle 19:24:44), i rapporti in
`~/Library/Logs/DiagnosticReports/`, i transcript di tutte le sessioni Claude e Codex del giorno.

- **Nessun rapporto di crash alle 19:24.** I quattro `Electron*.ips` del 6 settembre sono altro: due
  aborti all'avvio in `NSApplication init` lanciati da un `node` con responsabile **ChatGPT** (14:13 e
  15:29, Codex che prova ad aprire l'app dentro la sua sandbox) e due renderer alle 16:37, quando la
  suite non girava. Per la regola della guida §6.1: niente rapporto = **terminata da fuori**.
- **Nessun agente l'ha uccisa.** Fra le 19:19:00 (lancio, porta 9346) e le 19:24:44 nessuna
  sessione Claude — nemmeno quelle di SCHOOL planner e MappAI, attive in quel minuto — ha eseguito
  un `kill`; Codex era fermo dalle 18:18. Resta una mano: la finestra di prova gira in primo piano,
  e un ⌘Q le fa fare esattamente questo. Misurato oggi: **un `kill -TERM` Electron lo trasforma in
  un'uscita ordinata, codice 0**, indistinguibile da un ⌘Q.
- ⚠️ **La prova non se n'è accorta.** La sezione di `prova-righello` nell'uscita è **vuota**: né
  controlli né `fetch failed`. Si era collegata, l'app le è morta sotto, la promessa CDP in attesa
  non si è mai chiusa, e node — senza più niente da fare — è uscito **zitto con codice 0**: il runner
  l'ha contata verde, e i 37 `fetch failed` sono finiti addosso alle prove dopo.

Tre rimedi, tutti misurati facendoli diventare rossi apposta (uccidendo l'app di prova **per porta**
a metà corsa, due volte):

- `con-vault-di-prova.sh` dopo ogni prova controlla che l'app sia viva; se non lo è, **si ferma**,
  dice il codice d'uscita e che cosa vuol dire, mette in salvo `app.log` in
  `~/Library/Logs/StudIA-prove/` **prima** che la cartella temporanea sparisca (è per questo che il
  perché non si è mai saputo), e conta le prove restanti come NON eseguite, con il comando per
  riprendere da lì. In coda stampa i **controlli eseguiti** — il numero che rivela una suite a metà.
- `cdp.js` chiude le due forme del silenzio: socket chiuso con comandi in viaggio, e `send` su un
  socket già chiuso (la libreria `ws` lo scarta senza dire niente). Entrambe ora stampano ed escono
  con codice 2. E `collega()` dice che cosa significa un `fetch failed`.
- La suite intera oggi: **43 rosse su 69, 1212 controlli (1073 ok, 139 KO), app viva fino alla
  fine** — identica al 6 settembre. Il crash non si ripresenta, perché non era suo.

## Le 54 prove fuori da PROVE_ZAINO, classificate

Misurate oggi sul fork, gruppo per gruppo, e non solo per nome: la suite intera (69), il gruppo dei
PDF da solo (8), `mappa-pallino` e `strati` da sole, la catena ZAINO con le 11 fuori registro (26),
e sull'originale i 44 CORSI nel nuovo ordine (44 su 44, 1289 controlli). Ogni gruppo nasce dal
**primo rosso misurato**, non dal nome della prova.

**Capitolo aperto (14)** — vogliono il testo di una lezione a schermo, che il fork non ha:
`b1`, `b2` (il capitolo nel blocco), `menu`, `selezione-menu`, `note`, `topbar` (`#content`),
`tasti-frecce` (→ cambia capitolo), `identita-capitoli`, `evidenziatore`, `evidenza-appunto`,
`postilla`, `strati` (evidenze sul capitolo: rossa anche da sola), `import` («sono capitoli, non
documenti»), `keyword` (parole chiave del corso, «sa a quale capitolo tornare»).

**Corso, o la commutazione ai corsi (11)** — `banco-contenuto`, `modo`, `primo-avvio`, `fonti`,
`confronto`, `player` (fabbrica i media in `Corsi/<c>/MATERIALI`), `wikilink` (il corso a varianti:
sul fork **rinuncia** con codice 0 e zero controlli — stava in `PROVE_ZAINO` come verde, ed è
passata qui), e quattro che sono ZAINO in tutto tranne l'epilogo «si torna ai corsi»: `zaino`
(4 KO su 53), `foto` (2 su 58), `lente-punto` (1 su 23), `media-nonapre` (1 su 14). Sul fork
`cambiaModo('corso')` non fa niente, e quel controllo cade.

**Registro Generata/Mie delle mappe (5)** — `mappe-ui`, `mappa-trascina`, `l1`, `l3l4`
(`#mRegistro` non cliccabile: nello zaino il registro non esiste), `l2` (legge un file del corso).

**Quiz e ripasso (2)** — `ripasso`, `ripasso-vista` («senza quiz nel corso»).

**Scheda Corsi delle Impostazioni e soglia della pipeline (3)** — `impostazioni-token`,
`onboarding-token`, `atlante` (il bottone sta nella scheda Corsi, che il fork nasconde con un
`display:none`).

**⚠️ PDF alla radice del vault, nascosto dallo zaino attivo (9, ora nello ZAINO)** — `pdf`,
`pagina-campo`, `righello`, `voce-pagina`, `ricerca-pannellino`, `testolayer`, `album`,
`album-trascina`, `mappa-pallino`. Non chiedono corsi: chiedono `Fonti/Piano-di-studio-….pdf`, che
sta alla **radice** del vault. `srcUrl` → `cartelle()` in `lib/materiali.js` mette in testa il
contenitore attivo e, se quello ha `MATERIALI/`, **si ferma lì**: la radice non si guarda più.
Sull'originale le prove «tornano ai corsi», e il corso nella copia magra non ha `MATERIALI/`; sul
fork non c'è dove tornare, e `prova-media-punto` lascia attivo `media-di-prova`, che l'ha. Stesso
motivo per `prova-evidenze-pdf`. Da sole, sul fork, erano verdi 8 su 9: sono passate nello ZAINO
(sotto, «La seconda tornata»).

**Le 11 fuori registro** — `lente-mappe`, `misura-immagine`, `memorie`, `tendine`, `fonte-rimossa`,
`crediti`, `emoji`, `sbircia`, `postilla-zaino`, `postille-vista` erano verdi lanciando la catena
ZAINO: **entrano in `PROVE_ZAINO`**; `evidenze-pdf` entra con i PDF.

Il conto, a fine giornata: **34 ZAINO + 35 CORSI = 69**, nessuna fuori.

## La seconda tornata: le nove PDF nello ZAINO, e appunti-barra

- **`pdfVisibile(nome)` in `cdp.js`**: prima di `openPdf`, chiede a `srcUrl` se il documento si vede
  dal contenitore attivo; se no, lo copia in `MATERIALI/PDF/` di quel contenitore — dove lo metterebbe
  chi studia — e dice di averlo fatto. Se si vede già, non tocca niente: sull'originale, in modalità
  corso, non cambia nulla. Le nove prove (più `evidenze-pdf`) lo chiamano una volta, prima della prima
  apertura. **`cartellaMateriale(sub)`** è la stessa idea per chi FABBRICA un media: `prova-album`
  scriveva il suo video in `Media/` alla radice, e nella catena ZAINO «il video si carica: null».
- **`prova-pdf` misurava la sidebar dei corsi** (`#toc` largo più di 180) per dire che il CSS di
  pdf.js non usciva dal suo riquadro: sul fork quell'indice è nascosto, e la prova diceva «riscritto»
  di un elemento che non c'è. Ora usa una **sonda**: un `div.messageBar` dentro `#pdfPane` prende lo
  stile del viewer (così si sa che il sensore sente), lo stesso fuori no. ⚠️ Le variabili dei blocchi
  `:root` del viewer non servono da sensore: nello scoped CSS sono riscritte `:is(#pdfPane, #pdfPane2)`
  ma **annidate** nel guscio, quindi non combaciano con niente — misurato: vuote anche dentro.
- **`prova-appunti-barra` azzerava `studia.banco`, la chiave MORTA** (guida §8): credeva di partire dal
  banco di fabbrica e al reload ereditava la disposizione salvata da un'altra prova sotto la chiave
  viva (`bancoChiave()` → `studia.banco.c.<id>`): un blocco, la mappa su una riga (39 px), gli appunti
  su due (71 px). Ora toglie la chiave viva, e pretende che le due barre stiano **nello stesso
  riquadro** (larghezza uguale) prima di confrontarne le righe: se il banco le separasse, il rosso
  parlerebbe del banco, non del vestito.
- **`prova-evidenze-pdf`**: la selezione col mouse rilasciava a `right-2` dello span; in un riquadro
  da 480 px la riga esce dal pannello e il `mouseup` cade sul bordo, dove il gestore della barra vede
  `#pdfPane` senza `.textLayer` e non la apre — la selezione riusciva, la barra no. Tre stesure: i
  rettangoli della finestra, poi quelli di `#pdfHost` (e sull'originale, con lo zoom ereditato —
  pagina larga 1190 px in un riquadro da 588 — non restava nessuna riga), infine **la domanda al
  browser**: un capo del gesto vale se `elementFromPoint` ci trova il layer di testo, e lo si cerca
  camminando dai bordi visibili verso l'interno. Prima di misurare il documento torna a `page-width`
  (lo zoom si eredita), la barra si aspetta invece di fotografarla, e quando nessuna riga si lascia
  prendere la prova stampa il **setaccio** (span, larghi, lunghi, colpibili, riquadro, pagina) e
  **che cosa c'è sotto il mouse** al rilascio.
- Un rosso uscito solo al terzo giro, di **stato ereditato**: `prova-pdf` misurava il
  `mix-blend-mode` sulla tela della PRIMA `.page` del DOM, che pdf.js smonta quando è fuori vista —
  in un riquadro stretto ne tiene meno, e leggeva `null` in tutte e quattro le tinte; ora misura su
  una pagina che la tela ce l'ha. E la sezione «Appunta» di `evidenze-pdf` dice se manca la
  selezione invece di morire in un `TypeError` su `null.origine`.
- **`STUDIA_SORGENTE=<cartella>`** nel runner lancia l'app di un'altra cartella con le prove di
  questa: è così che «verde in tutte e due le app» si misura senza toccare l'altro repo.

Misurato con i file definitivi: ZAINO **34 su 34 sul fork** (756 controlli) e **34 su 34
sull'originale** (754), CORSI **35 su 35 sull'originale** (1035), `npm test` verde (58 file). Le
catene ZAINO sono state lanciate sei volte per app nel corso della sera: ogni rosso ha prodotto una
causa e una riga di diagnostica che resta nella prova, mai un'attesa più lunga.

## Il sito: la guida e la presentazione per insegnai.ch

`node bin/sito.js` costruisce `dist/sito/`: `index.html` è la presentazione (→ `/studia-zaino/`),
`guida/` è la guida dell'app resa autonoma (→ `/studia-zaino/guida/`). La guida NON è una seconda
copia: è `App/guida-zaino/` — la stessa che l'app apre dal «?» — con dentro il marchio e il font
OpenMoji che stavano in `App/assets/`, e il marchio in testata che porta a `../`. Gli screenshot si
rigenerano prima, sull'app viva e su un vault di prova: `bash bin/guida-zaino.sh` (il 7 settembre
ne sono cambiati 48 su 125, perché quelli della chat erano di prima del suo vestito). Il generatore
si ferma se una `<img>` delle due pagine non esiste. La presentazione (`sito/index.html`,
`sito/presentazione.css`) usa gli stessi token della guida e le sue immagini (`guida/img/…`); il
download rimanda a `https://github.com/gmesc/StudIA-ZAINO/releases`. Verificate nel browser a 1280
e a 375 px: nessuna immagine rotta, nessuno scorrimento orizzontale, indice e lightbox della guida.

## Che cosa resta aperto

- Il ramo `registri-zaino-corsi` dell'app originale ha ancora i registri di ieri (15 e 43) e le prove
  di ieri: i 34 e i 35 nel nuovo ordine sono stati **misurati** lì con le prove di QUESTO repo
  (`STUDIA_SORGENTE`), ma né i registri né i nove file di prova sono stati scritti là — quel repo non
  l'ho toccato. Portarli è un lavoro di copia, da fare con le due suite verdi anche lì.
- ~~Il guscio del CSS di pdf.js: i sette `:root` riscritti e annidati non arrivano al viewer.~~
  **Chiuso** (sotto, «Il guscio del CSS di pdf.js»).

## Il guscio del CSS di pdf.js: i sette `:root` rinascono sul riquadro

`bin/pdfjs-css.js` avvolge `pdf_viewer.css` in `:is(#pdfPane, #pdfPane2) { … }` e riscriveva i
sette blocchi `:root` come `:is(#pdfPane, #pdfPane2)` — ma li lasciava DENTRO l'involucro, e nel
nesting un selettore senza `&` è relativo al genitore: «un `#pdfPane` dentro un `#pdfPane`», cioè
niente. Le 46 variabili del viewer erano vuote anche dentro il riquadro, e nessuno se n'era
accorto perché vestono cose che l'app non usa (editor di annotazioni, firme, XFA, alto contrasto)
e i margini delle pagine li governa `removePageBorders` (`.removePageBorders .page` vince sulle
variabili). Il commento dell'app in `StudIA.html` accanto a `removePageBorders` lo raccontava come
un fatto («quel bordo non c'è mai stato»): adesso racconta il perché vero.

Il rimedio è una parola nel generatore: i blocchi diventano **`&`**, il guscio stesso — la forma
che il nesting prevede per «questo elemento», valida anche dentro un `@media` annidato. Rigenerato
con `node bin/pdfjs-css.js`. Misurato sull'app viva prima e dopo, stessa pagina aperta:
`--xfa-focus-outline` da vuota ad `auto`, `--page-margin` da vuota a `1px auto -8px`, e la
geometria delle pagine **identica** (rettangolo, margine `0 … 10px`, bordo `none`, distanza fra
pagine 830 px, padding del viewer 0) — cambia solo il ritardo dell'icona di caricamento, da 0 a
400 ms come pdf.js vuole. `prova-pdf` ora misura che la variabile valga `auto` dentro `#pdfPane` e
nulla sulla radice dell'app: prima di rigenerare quel controllo è rosso, dopo verde.

⚠️ **E lo screenshot ha detto una cosa che i numeri non dicevano.** Fuori dalla striscia della barra
di scorrimento zero pixel diversi; dentro, la barra era diventata **scura** (grigio 249 → 47). Nel
blocco `:root` della riga 6130 c'è `color-scheme: light dark`: con `&` arrivava a `#pdfPane`, e su
un Mac in modalità scura il riquadro seguiva il sistema mentre l'app — che `color-scheme` non lo
dichiara — restava chiara. Il tema lo decide StudIA, non il viewer: il generatore adesso **toglie**
`color-scheme` dai blocchi ricollocati (trasformazione 3, contata nel file generato), e `prova-pdf`
misura che il riquadro abbia lo stesso `color-scheme` della radice dell'app. Una regola generata si
misura sull'app viva E si guarda: la sonda coi rettangoli e le variabili era verde, la foto no.

## Per provare a mano

Creare due zaini, aggiungere un PDF e un appunto, configurare una chiave, aprire Chat AI e provare
i tre ruoli; modificare l'appunto e fare una nuova domanda; cambiare zaino durante una risposta;
riaprire l'app e la conversazione; clone/modifica/elimina di un profilo. Per il vestito: la testa
della chat come barra, il bottone acceso in testata, la bolla della domanda, la commutazione del
tema con la chat aperta, le altezze in Impostazioni → AI, un'emoji in una risposta (OpenMoji).
