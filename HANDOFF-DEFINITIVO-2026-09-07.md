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
STUDIA_SUITE=zaino ./test/cdp/con-vault-di-prova.sh   # 15 · il criterio (a) di un merge QUI
STUDIA_SUITE=corsi ./test/cdp/con-vault-di-prova.sh   # 43 · rosse qui, e va bene così
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
3. ⚠️ **Una prova si prepara lo stato che le serve, non lo eredita.** `prova-righello` passava
   nella suite intera e cadeva dentro un registro, con due sintomi diversi e una causa sola: un
   PDF ereditato **scrollato**, con 3 righe in vista su 149. Il rimedio non è abbassare la soglia.
4. ⚠️ **Un apice inverso dentro un template literal**, anche solo in un commento, lo chiude a metà
   e uccide il file in `SyntaxError`. È scritto nel `CLAUDE.md` e l'ho pagato lo stesso.
5. ⚠️ **Contare «una risposta» invece di «una in più»** rende un rosso alterno: la chat riapre la
   conversazione lasciata dalla prova precedente.
6. ⚠️ **Il click CDP va per COORDINATE**: se il bersaglio si muove ancora, il click cade accanto.
   La guardia sta nell'helper condiviso di `prova-chat-zaino.js`, che di click ne fa venti.

## Che cosa resta aperto

- Il **crash** dell'app di prova visto una volta in `prova-righello` (37 `fetch failed` a valle)
  non è stato riprodotto né spiegato. Le correzioni fatte riguardano lo stato ereditato: **non è
  detto che c'entrino**. Se ricapita, il segnale è il crollo dei controlli eseguiti.
- **11 prove su 69** non stanno in nessuno dei due registri: sono verdi solo dentro la catena
  lunga (per esempio `prova-album-trascina` senza `prova-album` che le prepara il ritaglio).
- Il ramo `registri-zaino-corsi` dell'app originale porta lì gli stessi due registri e la guida
  aggiornata.

## Per provare a mano

Creare due zaini, aggiungere un PDF e un appunto, configurare una chiave, aprire Chat AI e provare
i tre ruoli; modificare l'appunto e fare una nuova domanda; cambiare zaino durante una risposta;
riaprire l'app e la conversazione; clone/modifica/elimina di un profilo. Per il vestito: la testa
della chat come barra, il bottone acceso in testata, la bolla della domanda, la commutazione del
tema con la chat aperta, le altezze in Impostazioni → AI, un'emoji in una risposta (OpenMoji).
