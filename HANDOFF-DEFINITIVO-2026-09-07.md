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
STUDIA_SUITE=zaino ./test/cdp/con-vault-di-prova.sh   # 24 · il criterio (a) di un merge QUI
STUDIA_SUITE=corsi ./test/cdp/con-vault-di-prova.sh   # 44 · rosse qui, e va bene così
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

## Il pacchetto

`dist/StudIA - ZAINO-1.1.0-arm64.dmg` — **notarizzato**: `status: Accepted`,
`source=Notarized Developer ID`, ticket cucito all'app *e* al dmg, verificato rimontandolo. Si
apre col doppio click, senza «Apri comunque», anche senza rete.

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

**⚠️ PDF alla radice del vault, nascosto dallo zaino attivo (9)** — `pdf`, `pagina-campo`,
`righello`, `voce-pagina`, `ricerca-pannellino`, `testolayer`, `album`, `album-trascina`,
`mappa-pallino`. Non chiedono corsi: chiedono `Fonti/Piano-di-studio-….pdf`, che sta alla **radice**
del vault. `srcUrl` → `cartelle()` in `lib/materiali.js` mette in testa il contenitore attivo e, se
quello ha `MATERIALI/`, **si ferma lì**: la radice non si guarda più. Sull'originale le prove
«tornano ai corsi», e il corso nella copia magra non ha `MATERIALI/`; sul fork non c'è dove tornare,
e `prova-media-punto` lascia attivo `media-di-prova`, che l'ha. **Da sole, sul fork, 8 su 9 sono
verdi** (`pdf` ha un solo KO su un centinaio, sulla sidebar dei corsi). È lo stesso motivo per cui
`prova-evidenze-pdf` — l'unica rimasta fuori da entrambi i registri — è verde nella suite intera e
rossa nella catena ZAINO. Per portarle nello ZAINO basta che ognuna metta il PDF **dentro** lo zaino
che usa, che è anche l'uso vero del prodotto: è la prossima mossa, non fatta oggi.

**Le 11 fuori registro** — `lente-mappe`, `misura-immagine`, `memorie`, `tendine`, `fonte-rimossa`,
`crediti`, `emoji`, `sbircia`, `postilla-zaino`, `postille-vista` sono verdi lanciando la catena
ZAINO: **entrano in `PROVE_ZAINO`, che diventa 24**. `evidenze-pdf` resta fuori (sopra).

Il conto: 24 ZAINO + 44 CORSI + 1 = 69.

## Che cosa resta aperto

- ⚠️ **`prova-appunti-barra` è rossa in ogni catena ZAINO di oggi (3 su 3) e verde da sola e nella
  suite intera.** Misura che la barra degli appunti non abbia più righe di quella della mappa: nella
  catena eredita un banco a **un** blocco (mappa 39 px, 1 riga; appunti 71 px, 2 righe), altrove due
  blocchi (74 px, 2 righe). È un controllo sullo stato ereditato. Da decidere se la promessa vale
  anche a tutta larghezza — allora è un difetto del vestito degli appunti — o se la prova deve
  prepararsi il banco; il registro ZAINO è 23 su 24 finché non si decide.
- Le **9 prove dei PDF** possono entrare nello ZAINO mettendo il PDF dentro lo zaino che usano.
- Il ramo `registri-zaino-corsi` dell'app originale ha ancora i registri di ieri (15 e 43): i 44
  nel nuovo ordine sono stati **misurati** lì (44 su 44) ma non scritti — quel repo non l'ho toccato.

## Per provare a mano

Creare due zaini, aggiungere un PDF e un appunto, configurare una chiave, aprire Chat AI e provare
i tre ruoli; modificare l'appunto e fare una nuova domanda; cambiare zaino durante una risposta;
riaprire l'app e la conversazione; clone/modifica/elimina di un profilo. Per il vestito: la testa
della chat come barra, il bottone acceso in testata, la bolla della domanda, la commutazione del
tema con la chat aperta, le altezze in Impostazioni → AI, un'emoji in una risposta (OpenMoji).
