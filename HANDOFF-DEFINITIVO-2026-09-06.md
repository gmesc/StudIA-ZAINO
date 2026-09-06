# Handoff definitivo — fork StudIA - ZAINO, 6 settembre 2026

Questo è il punto d'ingresso del fork. Base StudIA: `2644b1a5ed28cf0b6099e7bbbe58cd4ba859a5cd`. Branch locale `studia-zaino`; upstream locale in sola lettura operativa, nessun push effettuato.

Aggiornamento 1.1.0: branch `chat-messenger-materiali-paralleli`, successivo a `09bd13b`. Implementa la revisione richiesta dopo gli screenshot del 6 settembre: profili allineati, chat essenziale e materiali paralleli.

La richiesta del fork sostituisce le decisioni storiche che vietavano qualunque AI nello zaino: è stata aggiunta una chat didattica, senza generazione di corsi. I piani precedenti restano documentazione dell'app originale; per questo fork partire dal README e da `docs/CHAT.md`.

- `lib/zaino-only.js`: barriera IPC e preload, esclusione pipeline e accesso ai corsi; protezione id ambigui e symlink dello zaino.
- `lib/chat.js`: contesto aggiornato da PDF/testi/appunti, ruoli, Wikipedia, sessioni JSON/Markdown, annullamento e concorrenza.
- `lib/chat-profili.js`: profili nel vault con campi validati e scrittura atomica.
- `lib/chat-provider.js`: sei provider, cataloghi autenticati, errori senza credenziali.
- `lib/chat-ipc.js`: ponte, chiavi nel solo main, annullamento su reload e chiusura.
- `App/assets/chat/ui.js` e `ui.css`: finestra chat e nuove impostazioni Utente/AI; vecchi nodi conservati nascosti per il cablaggio condiviso.
- `test/electron-chat-app.js`, `bin/prova-zaino.sh`: test Electron con mock caricati esclusivamente dall'entry point di test; nessuna opzione di produzione attiva i mock.

Originale e fork hanno configurazioni personali separate. Le conversazioni sono in `Zaini/<id>/CHAT`. Le chiavi non viaggiano nel vault. I profili sono comuni agli zaini dello stesso vault; ogni invio applica il profilo selezionato aggiornato. L'appunto aperto viene salvato prima dell'invio.

I file d'ingresso della pipeline (`ingest.py`, `index_videos.py`, CLI, wizard e composer) sono rimossi. Le librerie condivise storiche restano per preservare gli strumenti dello zaino; i relativi comandi CORSI non sono eseguibili attraverso l'app.

Per provare a mano: creare due zaini, aggiungere un PDF e un appunto, configurare una chiave, aprire Chat AI e provare i tre ruoli; modificare l'appunto e fare una nuova domanda; cambiare zaino durante una risposta; riaprire l'app e la conversazione. Provare clone/modifica/elimina di un profilo.

## Verifiche concluse

- Suite originale: 51 file di test passati; 6 nuovi file passati, per 57 nella catena `npm test`. La prova vocale macOS richiede accesso ai servizi di sistema.
- `npm run test:ui`: creazione/modifica profilo, chiave simulata, catalogo modello, chat persistita, aggiornamento appunti, cambio zaino durante invio e riapertura verificati con click reali e screenshot.
- Pacchetto arm64 in `dist/mac-arm64/StudIA - ZAINO.app`, firmato ad hoc e verificato con codesign. Primo avvio, ponte chat, editor e lettura di PDF/appunti verificati nel runtime incluso. Non notarizzato.
- Le API esterne sono provate con mock: nessuna chiave o credito reale è stato usato.
- La verifica visiva ha portato a caricare EasyMDE prima dell’inizializzazione diretta dello zaino; la regressione apre un appunto nell’app.

## Revisione 1.1.0 — chat e split view

- La testata chat mostra soltanto ruolo, ingranaggio AI, +, − e ×. All’apertura compare la cronologia dello zaino; minimizzare conserva la sessione. Chiudere o iniziare una nuova chat chiede il nome dopo aver salvato/annullato la risposta. Il titolo iniziale è la data; Esc conserva il nome già salvato.
- `chat.rinomina` e `chat.ramifica`, esposte dal ponte come `rename` e `branch`, scrivono JSON e Markdown. Il ramo copia solo i messaggi fino alla risposta scelta, con `parentId` e `parentMessageId`; non modifica la sessione di origine.
- Risposte con copia, voce di sistema e ramo. Markdown reso dal parser già incluso e ricopiato senza attributi, link attivi, immagini o elementi eseguibili. Le fonti hanno i propri collegamenti verificati.
- `App/assets/banco/materiali.js` sceglie l’istanza libera dalla singola voce Appunti/Fonti e gestisce il secondo EasyMDE. Il renderer mantiene `fonte2` e `appunti2` come identità interne. Massimo due istanze per tipo; niente modifiche simultanee dello stesso appunto. Seconda fonte: lettura, pagina, zoom e copia; annotazioni/ritagli restano sulla prima.
- File, pagina, zoom e posizione vengono ripristinati per zaino. Entrambi gli appunti vengono salvati prima della chat; un editor ancora modificato o un flush fallito blocca l’invio. Una bozza del secondo editor resta locale se il vault non è scrivibile.
- `npm test`: 58 file passati. Dopo l’ultima rifinitura Markdown, ripassato `test/chat-ui.js`. `npm run test:ui` verifica con click reali header, cronologia, nome/data, ramo, copia, TTS tramite adattatore audio silenzioso, Markdown, impostazioni, due note e due PDF, aggiornamento contesto, cambio zaino e reload. Nessuna API o chiave reale usata.
- Build arm64 1.1.0 firmata ad hoc, verificata con codesign e avviata in un vault temporaneo per provare editor doppio, cronologia, rinomina e ramo. Build stabile in `dist/mac-arm64/StudIA - ZAINO.app`; precedente conservata in `dist/precedente-1.0/mac-arm64`.


## Icona e guida del fork — distribuzione in attesa

Branch `icona-zaino-guida`, successivo ad `a5f59ba`. Su richiesta dell’utente,
**non rigenerare né aggiornare `dist`**: i pacchetti presenti restano quelli precedenti.

- Zaino OpenMoji 1F392, versione 16.0.0, in `App/assets/1F392.svg`: condiviso tra
  topbar, guida e generatore delle icone. Attribuzione e derivazioni CC BY-SA 4.0
  documentate nel file LICENSE accanto all’SVG e nei crediti rigenerati.
- Ricetta StudIA conservata: tela logica 1024, riquadro bianco 824, margini 100,
  stessa curva del contorno; emoji proporzionata nel lato maggiore di 660.
  PNG/ICNS/ICO rigenerati in `build`, senza eseguire electron-builder.
- Guida aggiornata al fork: tutor Messenger, cronologia, rinomina/data, copia/voce/rami,
  profili accessibili, sei provider e due appunti/due fonti. Rimossi i passaggi di
  commutazione CORSI e la vecchia presentazione di Confronto.
- Screenshot aggiornati con `bash bin/guida-zaino.sh`: vault e dati temporanei,
  risposte simulate dichiarate nelle didascalie, nessuna chiave reale. Il laboratorio
  controlla il percorso prima di cancellare i materiali sintetici e segnala errori.
- Suite `npm test` completata (58 file); crediti: 10 controlli. Verificati immagini caricate, indice, ingrandimento e
  impaginazione della guida. Confrontati dimensioni e timestamp di tutti i 13713
  file di `dist`: invariati. Per la verifica manuale aprire la guida, ingrandire una
  schermata e controllare il nuovo marchio nella topbar avviando il sorgente.


## La superficie CHAT AI vestita col design system — 6 settembre, sera

Branch `chat-vestita-studia`, successivo a `cf09937`. ⚠️ Questa sezione sta nell'handoff di oggi
invece che in un file nuovo: la data sarebbe la stessa, e due `HANDOFF-DEFINITIVO-2026-09-06`
sarebbero la trappola ④ in forma di nome di file.

La chat era arrivata col vestito suo. Misurato sull'app viva prima di toccare niente — 98 elementi
su quattro superfici: **21 tondi** (finestra, tendine, bolle, voci di cronologia, perfino il 50%
sul bottone d'invio), **2 ombre a riposo** scritte a mano che nel tema scuro restavano nere,
**3 stack di font senza `--emoji-font`** (cioè emoji di sistema al posto di OpenMoji, contro il
default globale), **2 altezze fuori famiglia** e **4 colori fissi**. E una testa che somigliava a
una barra degli strumenti senza esserlo: zero `.tbar`, zero `.tbsep`, zero `.tbspazio`.

Adesso è vestita coi token dell'app (invariante 8). `App/assets/chat/ui.css` passa da 80 a 139
righe — cresce perché adesso ogni scelta porta scritto il *perché*, non perché faccia di più.

- **La testa È la `.tbar`** di tutte le altre barre, con la grammatica del §5bis: il ruolo dice
  *che cosa* guardi, la barretta, il verbo che agisce su quel documento (`+`), lo spazio elastico,
  e in coda i comandi che si premono per ultimi (`⚙ − ×`). Prima erano quattro bottoni schiacciati
  a destra, senza gerarchia e con `font-size` e `border-radius` scritti a mano su una classe
  `.tbtn` che quindi non era più una `.tbtn`.
- **Due sole altezze.** `--tb-h` in barra, `--ctl-h` per i controlli. Il campo della chiave API
  stava a 38,2px in un pannello in cui tutto è a 40 (gli manca(va) `.ctl-input`); la riga di
  cronologia a 63,8px con titolo e data impilati — ora è una riga sola, titolo a sinistra e data a
  destra, alta come un controllo.
- **`--sh-3d` solo su ciò che galleggia** (finestra e dialogo del nome), angoli vivi ovunque,
  velo del modale allineato a quello di `#mediaModal`.
- **`--err` e `--err-ink` aggiunti al `:root` dei due temi.** L'errore della chat era `#bd4444`
  fisso dietro un `var(--red-strong)` che **non è mai esistito in nessun `:root`**: sul fondo
  scuro non si leggeva. È l'unico token nuovo, e c'è perché *mancava* rispetto alla skill.
- ⚠️ **La regola che vestiva i `select` della chat prendeva anche `#voceLettura`**, che è un
  controllo dell'app spostato in quella scheda: usciva tondo a 5px. È l'omonimia del §8bis, e si
  chiude **togliendo** la regola — quei campi l'app li veste già meglio da sola.

### Che cosa tiene ferme queste promesse

`test/cdp/prova-chat-stile.js`, nel registro `PROVE=(` di `bin/prova-zaino.sh`. **19 controlli per
corsa** su cinque superfici (finestra, bottone in testata, dialogo del nome, le due schede di
Impostazioni), **nei due temi** e con una **conversazione vera** aperta col provider simulato —
bolla, markdown, fonti e i tre comandi sotto la risposta non esistono finché nessuno parla.

⚠️ **Gli stati dinamici non sono un dettaglio**: l'audit statico sulla stessa superficie dava zero
anomalie mentre il campo della chiave stava a 38,2px.

La prova è stata **fatta diventare rossa apposta**, rimettendo le cinque cose di prima (angolo,
ombra a mano, stack senza emoji, campo senza classe, grammatica vecchia): le ha viste tutte e
cinque. Un suo controllo mentiva — senza `.tbspazio` diceva comunque «la coda sta dopo lo spazio»,
perché l'indice era `-1` — ed è stato chiuso.

### Il mockup d'approvazione

`docs/mockup-chat/genera.js`: **non si disegna a mano**. Prende il CSS vero dal blocco `<style>`
del monolite, e il markup di testa, dialogo e scheda AI lo **legge da `ui.js`**; se quelli
cambiano, o cambia il mockup o la generazione si ferma dicendolo. Il tema scuro lo estrae dai
token e **verifica** che dentro `html[data-theme="scuro"]` ci siano solo token: se ci finisse una
regola di componente, si rifiuta di generare invece di mentire sul tema. Il file prodotto è in
`.gitignore` — versionarlo vorrebbe dire 250 KB di diff a ogni ritocco del CSS.

```bash
node docs/mockup-chat/genera.js && open docs/mockup-chat/index.html
```

### Il flake che è costato quattro tornate

`prova-chat-zaino.js` falliva una corsa su otto, con **due sintomi diversi per una causa sola**:
`TypeError: null.scrollIntoView` sul click di `.zn-appunto`, oppure l'attesa scaduta su
`NOTES.mde`. L'attesa d'ingresso controlla `chatBtn` e lo zaino attivo, ma la navigazione dello
zaino si disegna dopo — e ⚠️ **il click CDP va per COORDINATE**: fra il calcolo del rettangolo e i
due eventi di mouse l'elenco cresce ancora. Nel caso peggiore l'elemento non c'è; in quello più
comune c'è ma si è spostato, e il click cade accanto.

La guardia sta nell'helper `click` **condiviso** — quella prova ne fa venti, e ognuno correva lo
stesso rischio: si aspetta che l'elemento esista, poi che la sua posizione resti la stessa per due
misure di fila.

⚠️ E adesso **le attese parlano**: quando scadono stampano che cosa avevano davanti (quante voci,
quali oggetti, quale modello scelto). Le prime otto corse le ho spese a indovinare quale predicato
fosse falso.

Nello stesso giro è emerso un difetto della prova di stile: riconfigurava provider, chiave e
modello che `prova-chat-zaino.js` aveva **già** impostato, e risalvare la chiave fa ricaricare
l'elenco dei modelli — nella finestra in cui si ricarica, l'invio è spento a ragione. Ora tocca
solo ciò che manca e aspetta che la configurazione sia **assestata**, non che sia passato del
tempo.

### Verifiche

- `npm test`: **58 file** in catena, verde.
- `npm run test:ui`: **8 corse su 8 verdi** dopo la guardia. Il conto onesto delle tornate
  precedenti: 5/6, poi 7/8, poi 7/8 — ogni rosso ha prodotto una causa, non un timeout più lungo.
- Mockup approvato a video nei due temi; gesti provati a mano dall'utente: testa della chat,
  bottone acceso in testata, bolla, commutazione del tema con la chat aperta, altezze in
  Impostazioni → AI, emoji OpenMoji in una risposta.
- `./test/cdp/con-vault-di-prova.sh`: **43 rosse su 69** qui, **0 su 69 sull'app originale**
  (stesso runner, stesso vault). `main` pre-merge ne dava 44: il vestito non ha rotto niente.
  ⚠️ Una corsa intermedia diceva 55, ma 37 erano `fetch failed` — l'eco di un'app di prova morta
  a metà, mai più riprodotta; se ne accorge chi guarda i CONTROLLI eseguiti (488 invece di 1073),
  non chi conta i file rossi. Vedi la §6 della guida, riscritta.
- ⚠️ `dist` **non è stato rigenerato**, coerentemente con la sezione precedente: i pacchetti
  presenti restano quelli di prima.

### I due registri di prove — e il pacchetto notarizzato

`con-vault-di-prova.sh` ha adesso **due registri**, misurati contro l'app originale
(`~/Claude/StudIA/StudIA`, base `2644b1a`), dove la suite intera è **69 su 69 verdi** con 1786
controlli:

```bash
STUDIA_SUITE=zaino ./test/cdp/con-vault-di-prova.sh   # 15 · verde in TUTTE E DUE le app
STUDIA_SUITE=corsi ./test/cdp/con-vault-di-prova.sh   # 42 · verde 42/42 sull'originale, rosso qui
```

`PROVE_CORSI` non è dedotto per esclusione: sono le prove che con lo stesso runner e lo stesso
vault falliscono qui e passano lì. Il vault i corsi ce li ha (`Corsi/` accanto a `Zaini/`, stessa
config per i due repo) — è il fork che non li espone. Servono a chi rimetterà insieme ZAINO e
CORSI: sono l'elenco che dovrà tornare verde. Gli stessi due registri stanno sul ramo
`registri-zaino-corsi` dell'app originale.

⚠️ Un registro è una **catena, non un insieme**, e l'ORDINE conta quanto i nomi: con gli stessi 43
nomi in ordine alfabetico `STUDIA_SUITE=corsi` dava 4 rosse sull'originale; nell'ordine di
`PROVE=(`, nessuna.

⚠️ **Prima di leggere i rossi si guarda se l'app è arrivata VIVA alla fine**: il numero da
guardare non è quello dei rossi ma quello dei CONTROLLI eseguiti.

Il pacchetto è stato **rigenerato e notarizzato**: `dist/StudIA - ZAINO-1.1.0-arm64.dmg`,
`status: Accepted`, `source=Notarized Developer ID`, ticket cucito all'app e al dmg. ⚠️ Gli script
adesso buttano il dmg che electron-builder fa per conto suo: ne restavano due quasi omonimi e il
non notarizzato aveva il nome più pulito, quindi era quello che uno spedisce.

### Per chi arriva dopo

Una superficie nuova si guarda **prima** d'innestarla (`docs/mockup-chat/genera.js` è il modello:
codice vero, non disegno), e si misura **dopo** negli stati dinamici. Le prove della chat hanno un
runner e un registro **tutti loro** — `bin/prova-zaino.sh`, che si fabbrica lo zaino «biologia» e
simula il provider: non stanno nel `PROVE=(` di `con-vault-di-prova.sh`, che gira sulla copia del
vault vero e quello zaino non ce l'ha.
