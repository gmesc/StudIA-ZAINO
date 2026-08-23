# Handoff definitivo — 12 agosto 2026, sera

> 📍 **Storico.** Il punto d'ingresso è **sempre** l'`HANDOFF-DEFINITIVO-*` con la data più alta
> — oggi [23 agosto 2026](HANDOFF-DEFINITIVO-2026-08-23.md), che porta in §9 la mappa di tutta
> la catena.
> Qui resta: il ripasso che diventa un sistema (P3.2 · P3.3 · P3.6) e la regola «un file solo,
> non due copie confrontate».

> 🆕 **Dopo questo c'è [HANDOFF-DEFINITIVO-2026-08-12c.md](HANDOFF-DEFINITIVO-2026-08-12c.md)**
> (notte), che NON lo sostituisce: si occupa solo delle **evidenze e delle parole chiave** e della
> scorciatoia del player. Quel lavoro è provato e **committato** (`01b608e`, `8a90ff0`, `2ab9b03`).

> **A chi arriva adesso, in una chat nuova: questo file basta per ripartire.**
> Racconta la giornata del 12 agosto — il **ripasso che diventa un sistema vero** (P3.3, P3.2,
> P3.6, cioè tutta la riga 1 di PIANO-BRAYNR), la **guida dell'architetto** e le due skill che la
> usano, il **tetto dei quiz** alzato.
>
> ⚠️ **Sostituisce [HANDOFF-DEFINITIVO-2026-08-12.md](HANDOFF-DEFINITIVO-2026-08-12.md)** (di
> stamattina), che resta valido per ciò che non si ripete qui: le barre come token unico, lo
> smontaggio del monolite, l'identità dei capitoli, P3.1. Lo zaino sta nell'
> [11 agosto](HANDOFF-DEFINITIVO-2026-08-11.md); i corsi nel [10](HANDOFF-DEFINITIVO-2026-08-10.md).
>
> **Il lavoro che continua per primo**: non c'è un obbligo. La riga 1 del piano è chiusa e il
> sistema è utilizzabile. Le strade aperte, in §7.
>
> **Regola di lettura**: dove c'è ⚠️ c'è un guasto già pagato — successo davvero, misurato, col
> rimedio accanto. È la parte utile.
>
> **⚠️ Nuovo, e cambia il modo di lavorare**: da oggi c'è
> [GUIDA-ARCHITETTO.md](GUIDA-ARCHITETTO.md), che dice *come si costruisce qui* (invarianti,
> mappa, processo). Questo handoff dice *a che punto siamo*. In conflitto, vince questo — è più
> recente.

---

## 1. Stato

```bash
cd "/Users/giacomomeschini/Claude/StudIA/StudIA"
npm test                                                # 2.328 controlli su 23 file
STUDIA_PORTA=9334 ./test/cdp/con-vault-di-prova.sh      # 28 prove sull'app viva
STUDIA_PORTA=9334 ./test/cdp/con-vault-di-prova.sh prova-ripasso-vista   # una sola
```

Tutto verde. `main` pulita, ultimo commit `79b2521`, **un ramo solo** (i sei vecchi sono stati
esaminati e chiusi, §6). Rete: tag `freezer-2026-08-12b` e `../freezer-2026-08-12b.bundle`,
verificato riaprendolo.
⚠️ *Il `.bundle` non c'è più (tolto il 23 agosto): la sua punta era già antenata di `main`, e
`main` è spinta su `origin`. Il tag resta nel repo.*

⚠️ **La porta 9333 è a esemplare unico, e una corsa interrotta lascia l'app viva.** La corsa dopo
si attacca a *quella* — che punta a una cartella temporanea ormai cancellata — e falliscono venti
prove con messaggi che non c'entrano niente (`fetch failed`, ENOENT sul vault, banco che non
disegna). Mi ha fatto sospettare il mio codice per due giri. Prima di accusarsi: `lsof -ti :9333`
e, se risponde, `kill -9`; oppure girare su `STUDIA_PORTA=9334`, come sopra.

| | stamattina | adesso |
|---|---|---|
| controlli di unità | ~2.195 | **2.328** |
| prove sull'app viva | 26 | **28** |
| moduli UMD in `App/assets/` | 17 | **20** |
| `App/StudIA.html` | 13.019 righe | 14.099 righe |

⚠️ Il monolite è **cresciuto** di mille righe, ed è onesto dirlo: la vista di ripasso è pagina, e
la pagina sta lì. Il numero che dice se il lavoro sta funzionando resta il secondo — la logica
che si può provare in Node.

---

## 2. Il ripasso adesso è un sistema (riga 1 di PIANO-BRAYNR: chiusa)

| | che cosa fa |
|---|---|
| **P3.1** (11 ago) | la storia vive in `RIPASSO/stato.json` e non si perde più cambiando lezione |
| **P3.3** ✅ | gli intervalli dicono **quando** tornare |
| **P3.2** ✅ | due sorgenti di carte: quiz **e glossario** |
| **P3.6** ✅ | la testata dice se c'è da fare, senza aprire niente |

Misurato su ai-literacy: **93 carte da quiz + 114 da glossario = 207**. Il glossario più che
raddoppia il mazzo senza generare un contenuto nuovo — è la rilettura di ciò che c'era già.

**L'algoritmo** (`App/assets/ripasso/intervalli.js`): SM-2 semplificato, qualità 0/3/4/5,
facilità fra 1,3 e 2,7, due gradini a tabella (`1 min · 5 min · 10 min · 1 giorno`), poi × ef,
tetto a un anno.

⚠️ **Facilità e ripetizioni non si scrivono su disco**: si ricalcolano ogni volta dalla `storia`,
che è l'unico dato vero. Un contatore salvato accanto è un secondo posto dove sta la stessa cosa,
e i due divergono la prima volta che qualcuno ne scrive uno senza l'altro. Costo: venti passaggi
di aritmetica per carta. Guadagno: cambiare la formula domani ricalcola anche il passato.

**La coda**: prima gli arretrati (il più scaduto davanti), poi le mai viste. Chi ha trecento carte
in ritardo deve poterle smaltire. ⚠️ Le voci senza `prossimo` — scritte prima di P3.3 — contano
come arretrato, non come futuro: metterle in fondo vorrebbe dire non riproporle mai.

**La riga di stato sulla carta** (`vista 2 volte · ultimo intervallo 10 min · scaduta 3 giorni
fa`) non è un ornamento: ⚠️ senza, gli intervalli sono **invisibili**. Una carta risposta esce
dalla coda per dieci minuti, quindi in una sessione sola non si vede mai il secondo gradino e il
sistema sembra fermo. È stato l'utente a chiedere «dove dovrei vedere i tempi crescere?», e la
risposta onesta era: da nessuna parte.

---

## 3. ⚠️ La regola nuova: un file solo, non due copie confrontate

**Questa sostituisce l'avvertenza n.1 di PIANO-BRAYNR**, e vale per chiunque venga dopo.

Fino a ieri il rimedio alla trappola ④ era «due implementazioni e un test che le confronta».
Da oggi è **un file solo**: una regola pura che serve al main *e* al renderer nasce come modulo
**UMD** in `App/assets/…` (`<script src>` nel browser, `require()` in Node) e `lib/` lo richiama.

Due moduli nuovi lo dimostrano:

- **`ripasso/intervalli.js`** — i tempi servono al renderer (l'etichetta sul bottone) e al main
  (il campo `prossimo` sul disco). Con due copie il bottone prometterebbe dieci minuti e il file
  ne registrerebbe quindici, e non lo scoprirebbe nessuno perché nessuno confronta. `lib/ripasso.js`
  lo `require()` e ri-esporta senza avvolgere.
- **`ripasso/sorgenti.js`** — quali campi di un capitolo diventano carte. Decide tre cose insieme:
  che cosa entra nella coda, che cosa si conta, e **quali carte risultano vive alla potatura**.
  Finché stava dentro `ripassoDomandeVive()`, nel mezzo del renderer, era anche l'unico pezzo del
  ripasso che nessuna prova di unità poteva toccare.

La copia resta ammessa **solo** dove serve `crypto` o `fs`: l'identità della carta si calcola nel
main, e il renderer se la fa dare via IPC (`ripasso:ids`).

---

## 4. ⚠️ Le trappole pagate oggi

- **Un byte NUL letterale in `lib/ripasso.js`** (il separatore dell'identità, `join('\0')` scritto
  per davvero). Per git il file era **binario**: niente `diff`, niente `blame`. Stesso male di
  `lib/evidenze.js` l'11 agosto, mai cercato altrove. Sostituito con la sequenza di escape, id
  identici verificati su quattro casi. **Quando ne trovi uno, cercalo anche negli altri file**
  (`file lib/*.js` risponde `data`).
  ⚠️ Conseguenza residua: `git show d645454 -- lib/ripasso.js` dice ancora `Bin`, perché la
  versione *vecchia* era binaria. Da lì in avanti il file diffa normalmente.
- **Aggiornare due facce su quattro.** `doReset()` chiamava `refreshToc()` e `updateProgress()`:
  i pallini dell'indice si spegnevano, il contatore in testata restava fermo ai numeri di prima.
  Il disco *era* pulito, ma a schermo non c'era modo di saperlo — il modo peggiore di sbagliare,
  perché mette in dubbio il dato invece dell'interfaccia. Il rimedio non è aggiungere chiamate: è
  passare dal punto unico (`ripassoRifletti`).
- **Il numero e la parola devono dire la stessa cosa.** Il contatore mostrava «207 da rivedere»
  per carte mai studiate: il numero era la coda intera, la parola parlava di scadenze, e insieme
  mentivano. Ora mostra ciò che urge — le scadute — e ripiega su «N carte nuove» solo quando di
  arretrato non ce n'è.
- **Il `title` di sistema non è un suggerimento utilizzabile**: compare dopo un secondo, appeso al
  puntatore invece che all'elemento, e chi lo cerca non sa dove tenere fermo il mouse. Sostituito
  con un riquadro nostro (`data-tip` + `::after`), ancorato al bottone e immediato.
- **Un gesto irreversibile non sta accanto a ciò che si usa tutti i giorni.** «Azzera avanzamento»
  ha lasciato il fondo dell'indice ed è in **Impostazioni → Studio**: la conferma difende dal
  click, non dalla vicinanza.
- **La coda non si rifà se la chiave non cambia**: dopo un azzeramento serve `RIP.chiave=''`, o
  `ripassoVistaAggiorna` vede un contesto immutato ed esce senza fare niente.
- **`offsetTop` mente dentro riquadri annidati** se l'antenato non è posizionato: la prima
  versione dello scorrimento al retro della carta non scorreva mai. Si va in fondo e basta.

---

## 5. Il tetto dei quiz, e dove stanno davvero i limiti

Il numero di domande per capitolo non si governava dalle impostazioni: il limite vero era
`maxItems: 3` in **`schema/capitolo.schema.json`**, cioè lo schema che il modello riceve come
structured output e che la validazione applica. Chiedere più domande a parole non poteva
funzionare — la quarta veniva rifiutata.

⚠️ **Le due cose si alzano insieme**: schema a **6**, direttive del profilo a «5–6 quiz per
capitolo» (`frequenti`) e «2» (`pochi`), etichette in impostazioni che dicono i numeri. Vale sui
capitoli generati d'ora in poi.

---

## 6. Come si lavora, aggiornato

Il ritmo di ieri regge. Tre cose nuove:

1. **Il merge si dichiara, non si presume.** Quattro condizioni, tutte: (a) le due suite verdi;
   (b) i gesti provati **a mano dall'utente**; (c) piani e handoff aggiornati; (d) `main` non si è
   mossa — altrimenti rebase, risoluzione, e **si rieseguono le suite sul codice unito**, che non
   è mai girato prima. Successo oggi: mentre lavoravo su P3.3, un agente ha portato il player Z8
   su `main`; il rebase ha avuto un conflitto solo (due prove aggiunte alla stessa riga `PROVE=(`)
   e la risoluzione era tenerle entrambe.
2. **`-d` è il taglio sicuro, `-D` quello che insiste.** Prima di `-D` su un ramo, guardare che
   cosa contiene con `git log main..<ramo>` — e `git cherry -v main <ramo>` per sapere se le sue
   modifiche sono già in `main` sotto un altro hash.
3. **La guida dell'architetto e le due skill.** [GUIDA-ARCHITETTO.md](GUIDA-ARCHITETTO.md) sta nel
   repo e raccoglie ciò che cambia lentamente. Fuori dal repo, in `~/.claude/skills/`:
   `guida-architetto` (genera quel documento per qualunque progetto) e **`/architetto <braindump>`**
   (lo usa per trasformare un'idea grezza in un piano). P3.2 è nato così, ed è stato eseguito come
   pianificato.

---

## 7. Che cosa resta, in ordine

1. **P3.4 — il mazzo è un file di filtri** (`RIPASSO/mazzi.json`): «tutte le carte di queste due
   lezioni», «solo glossario». Il campo `sorgente` è già su ogni carta, pronto per il filtro.
2. **P1.3 — il callout `domanda` negli appunti**, la terza sorgente di carte: entra in
   `RipassoSorgenti.daCapitolo` e in nessun altro posto.
3. **P3.5 — il contesto dalla carta**: «vedi il capitolo» c'è; manca «vedi la fonte» (il capitolo
   ha già `videoRefs`/`sources`).
4. **I conteggi per TUTTI i corsi**, non solo quello aperto: serve che il main sappia quali
   cartelle-lezione sono visibili con quale percorso attivo — regola delicata, oggi solo nel
   renderer (`lezioniVisibili()`). È il pezzo mancante di P3.6, dichiarato.
5. **M5** del piano moduli: `album/geometria.js`, dove viveva il ritaglio ribaltato.
6. Dallo zaino: **Z7** (impostazioni OCR), **rifare i ritagli storti**, **B3** (fonte a schede).
7. Del viewer: il documento non si chiude quando «fonte» esce dal banco; il tema scuro non arriva
   alla pagina; la stampa del PDF.
8. **La forma delle mappe di corso**: 65.158 × 358 px non è una mappa, è un nastro.
9. La **notarizzazione** del `.dmg` (PIANO-ONBOARDING).

---

## 8. Dove sta il codice

```
App/StudIA.html            il guscio: markup, <style>, e il renderer che cabla i moduli
  · ripassoDomandeVive()   ⚠️ l'UNICO punto in cui entrano le sorgenti delle carte
  · ripassoCostruisci()    la coda: arretrati davanti, mai viste dopo
  · ripassoContoAggiorna() i tre numeri del corso aperto → il contatore in testata
  · doReset()              ⚠️ passa da `ripassoRifletti()`: tutte le facce, non due
App/assets/ripasso/
  intervalli.js            ⭐ SM-2: gli stessi minuti sul bottone e sul disco
  sorgenti.js              ⭐ quali campi diventano carte (coda + conteggi + potatura)
lib/ripasso.js             identità (sha1, nel main), lettura, scrittura, potatura
schema/capitolo.schema.json ⚠️ il tetto vero delle domande per capitolo
GUIDA-ARCHITETTO.md        come si costruisce qui: invarianti, mappa, protocollo braindump
```

Piani vivi: [PIANO-BRAYNR.md](PIANO-BRAYNR.md) (riga 1 chiusa) · [PIANO-MODULI.md](PIANO-MODULI.md) ·
[PIANO-ZAINO.md](PIANO-ZAINO.md) · [PIANO-BANCO.md](PIANO-BANCO.md).

---

## 9. Le tre cose che l'utente ha trovato guardando, con le suite verdi

Vale la pena tenerle insieme, perché sono lo stesso insegnamento:

1. «**Dove dovrei vedere i tempi crescere?**» → da nessuna parte: mancava la riga di stato.
2. «**Il pop-up è lento e non si capisce dove fermare il puntatore**» → era il `title` di sistema.
3. «**Ho azzerato ma la testata mostra numeri che non capisco**» → il contatore non si aggiornava.

Nessuna delle tre sarebbe uscita da una prova: le prove misurano ciò che qualcuno ha già pensato
di misurare. **Dopo ogni passo, una lista corta di gesti che l'utente prova di persona** — e uno
screenshot preso da qui prima di dichiarare finito un lavoro di interfaccia.
