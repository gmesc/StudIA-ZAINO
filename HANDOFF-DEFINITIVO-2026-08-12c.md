# Handoff — 12 agosto 2026, notte

> **Si AGGIUNGE a [HANDOFF-DEFINITIVO-2026-08-12b.md](HANDOFF-DEFINITIVO-2026-08-12b.md), non lo
> sostituisce.** Quello racconta la giornata (il ripasso come sistema, la guida dell'architetto, il
> tetto dei quiz) e resta valido per tutto ciò che qui non si nomina. Questo file copre una cosa
> sola: **le evidenze e le parole chiave**, più la scorciatoia del player.
>
> ✅ **Committato il 12 agosto a notte, nei tre commit previsti dal §5** — `01b608e` la scorciatoia,
> `8a90ff0` le parole chiave, `2ab9b03` il tratto. `App/StudIA.html` e `test/evidenze.js` sono stati
> spezzati per righe, non buttati in un lotto solo: i tre commit si leggono uno per uno. La copia di
> sicurezza (`lavoro-evidenze-keyword-2026-08-12.patch`) è stata cancellata: il codice è in git.
>
> **Regola di lettura**: dove c'è ⚠️ c'è un guasto già pagato — successo davvero, misurato, col
> rimedio accanto. È la parte utile.

---

## 1. Stato

```bash
cd "/Users/giacomomeschini/Claude/StudIA/StudIA"
npm test          # verde; test/evidenze.js passa da 137 a 149 controlli
```

Sei file toccati, nessuno committato:

| File | Che cosa ci è cambiato |
|---|---|
| `App/StudIA.html` | scorciatoia, `appuntaSelezione`, evidenza in due tempi, filtro dell'elenco, riga dei tratti, toast spegnibile |
| `App/assets/evidenze/ancoraggio.js` | `parolePiene` (puro, provato in Node) |
| `lib/evidenze.js` | campo `tratto` + `tratta()`, e un commento stantio corretto |
| `preload.js` | ponte `evidenze.tratta` |
| `test/evidenze.js` | +12 controlli |
| `PIANO-ZAINO.md` | ⌘⇧M → ⌘⇧C |

Tutto **provato in Electron da Giacomo**: la scorciatoia col video aperto, l'evidenza che finisce
davvero nel `_evidenze.json`, il fondo pieno sul capitolo **e sopra il PDF**.

---

## 2. La scorciatoia del player: ⌘⇧M → ⌘⇧C

`playerAppunta` — «segna questo minuto negli appunti» — risponde ora a **⌘⇧C**. Cambiata anche in
`PIANO-ZAINO.md`, che è il documento in cui quella scelta era motivata.

⚠️ **⌘⇧C era già scritta altrove, e non funzionava**: il `title` del bottone 🔖 «cita» la
prometteva in due punti senza che nessun `keydown` la ascoltasse. La promessa è stata tolta di lì,
o due comandi avrebbero dichiarato la stessa combinazione.

---

## 3. Le parole chiave: la regola delle tre parole

**Appuntare una selezione da ≤ 3 parole la fa entrare anche nell'elenco delle parole chiave.**
Sopra le tre, si appunta e basta.

Le parole si contano **piene**: articoli e preposizioni non contano
(`EvidenzeAncoraggio.parolePiene`). «Stati Uniti d'America» = 3, dentro; «la legge della
gravitazione» = 2, dentro; «il sistema nervoso centrale periferico» = 4, fuori. L'apostrofo separa,
la punteggiatura ai bordi si toglie, il trattino **non** separa (`pesco-mandorlo` è una parola).

Il gesto passa da **`appuntaSelezione`**, porta unica di «Appunta» e dei bottoni-riquadro: la regola
non può dipendere da quale dei due si preme.

**L'elenco filtra** (`kwEParolaChiave`). Evidenziare e fare una parola chiave sono due gesti con lo
stesso strumento: si sottolinea una frase per ritrovarla rileggendo, si segna un termine perché è un
termine. Le sottolineature lunghe **restano accese nel testo** e non affollano la lista.
Filtra la vista, **non il file** — niente da migrare, e alzando `KW_MAX_PAROLE` tornerebbero da sole.

Conseguenze che hanno richiesto codice, non solo una condizione:
- il toast non può più dire «Parola chiave aggiunta» quando la parola nell'elenco non ci va: dice
  *«Sottolineato. Troppo lungo per l'elenco delle parole chiave»*;
- l'elenco vuoto ha **tre** messaggi, non due. Il terzo — «le sottolineature che hai fatto sono più
  lunghe di 3 parole» — è quello che impedisce di leggere il filtro come un guasto;
- gli avvisi della regola passano da **`toastSpegnibile`**, un toast con la casella «Non avvisarmi
  più» (chiave `studia.avvisi.kwAuto`): la prima volta rende visibile la regola, la ventesima è
  rumore su un gesto che si fa venti volte per lezione.

---

## 4. Il tratto: sottolineatura o fondo pieno

Riga di due bottoni — **«Aa Sottolinea | Aa Evidenzia»** — sotto quella dei colori, nel menu della
selezione **e** in quello del chip. La costruisce `trattoRiga`, una funzione sola per le due
superfici: due costruzioni sono due etichette che un giorno divergono.

Sul disco: campo **`tratto`** (`'sotto'` | `'overlay'`) accanto a `colore`, stessa natura — aspetto,
non identità — e infatti **fuori dal semi da cui nasce l'`id`**: cambiare tratto non fa nascere una
seconda evidenza. Default `sotto`, quindi i vault esistenti non cambiano faccia.
`evidenze.tratta()` è il gemello di `colora()`.

L'overlay usa il colore **diluito al 34%** (`color-mix`): i preset sono tinte sature scelte per una
riga *sotto* il testo, stese *dietro* le lettere darebbero scuro su scuro. Nessun `color` imposto,
così il testo segue il tema chiaro e scuro senza una seconda palette.

⚠️ **Il default resta la sottolineatura, e non per abitudine**: il fondo pieno litiga col giallo che
la lettura vocale accende sul paragrafo in corso, e chi legge lentamente è proprio chi usa le due
cose insieme. La motivazione era già nel codice dal giorno in cui la sottolineatura fu scelta; ora
chi vuole l'evidenziatore vero lo sceglie, e chi non tocca niente non vede cambiare nulla.

### Le tre trappole di questa sessione

1. **Un `Range` non sopravvive a un `await`.** Scrivere l'appunto apre l'editor, il layout cambia e
   pdf.js **ricostruisce il text layer**: al ritorno i nodi puntati non ci sono più e l'ancoraggio
   fallirebbe su una selezione che c'era. Da qui l'evidenza in **due tempi** — `evidenzaPrepara`
   (dal Range vivo, produce solo testo `{exact, prefix, suffix}`) e `evidenzaScrivi` (dopo). La
   preparazione si porta dietro anche il corso: fra i due tempi l'utente può averne aperto un altro.
2. **Colore e tratto sono indipendenti, e i comandi se li rubavano.** Cliccare «Evidenzia» su una
   parola verde la faceva diventare gialla; cliccare un colore su una a fondo pieno la riportava
   sottolineata. Precedenza ora dichiarata in un posto solo (`evidenzaPrepara`): **quello che il
   comando dichiara → quello che l'evidenza ha già addosso → la memoria**.
   ⚠️ Trovato **cliccando il bottone vero**, non leggendo il codice: con le funzioni chiamate a mano
   non si vedeva.
3. **Un commento stantio ha fatto concludere il contrario di quello che l'app faceva.**
   `lib/evidenze.js` diceva che `materiale`/`pagina` «restano vuoti finché le evidenze non
   arriveranno anche sul PDF». Ci erano arrivate da tempo. Corretto e datato: chi legge il file
   invece dell'app non deve ricascarci.

---

## 5. Che cosa fare per primo

**I tre commit**, separati perché sono tre cose che si leggono meglio distinte:

1. la scorciatoia (`App/StudIA.html`, `PIANO-ZAINO.md`);
2. le parole chiave — regola delle tre parole, elenco filtrato, evidenza in due tempi, toast
   spegnibile (`App/StudIA.html`, `App/assets/evidenze/ancoraggio.js`, `test/evidenze.js`);
3. il tratto — campo, `tratta()`, riga dei due bottoni (`lib/evidenze.js`, `preload.js`,
   `App/StudIA.html`, `test/evidenze.js`).

⚠️ `App/StudIA.html` e `test/evidenze.js` sono toccati da più commit: vanno spezzati per righe, o
committati insieme al lotto a cui appartengono di più.

**Aperto, se un domani dà fastidio**: il 34% dell'overlay è tarato a occhio sul capitolo e verificato
sul PDF; se su una pagina fitta coprisse troppo, la leva è una sola riga in `evidenzeStile`.
