# Handoff definitivo — 18 agosto 2026

> **A chi arriva adesso: questo file basta per ripartire.** Sostituisce
> [HANDOFF-DEFINITIVO-2026-08-17.md](HANDOFF-DEFINITIVO-2026-08-17.md), che resta la lettura di
> dettaglio sull'anteprima scrivibile, sulla guida dentro l'app e sui tre pacchetti.
>
> **Come si costruisce qui** lo dice [GUIDA-ARCHITETTO.md](GUIDA-ARCHITETTO.md); il dettaglio del
> lavoro di oggi sta in [PIANO-BRAYNR.md](PIANO-BRAYNR.md) §P1.1-bis / -ter / -quater.
> **Regola di lettura**: dove c'è ⚠️ c'è un guasto già pagato, col rimedio accanto.

---

## 0. Da dove ripartire, in tre righe

Il lavoro del 18 agosto — **le evidenze che arrivano negli appunti, l'interruttore dei segni, le
letture, e i segni sovrapposti che si vedono tutti** — è **su `main` e spinto sul remoto**
(`060ee47`). Albero pulito, nessun ramo aperto, `origin/main` allineata. Le due suite sono verdi e i
gesti sono stati provati a mano.

Il primo gesto di una chat nuova non è più «unire»: è **scegliere il prossimo lavoro** (§7). L'unica
cosa lasciata a metà, e piccola, è al §5 in fondo: i segni sovrapposti **sul PDF** non sono stati
guardati con gli occhi — le prove passano, ma «passa» e «si legge» sono due cose diverse.

⚠️ **Prima di lanciare qualunque cosa che apra Electron**, leggi GUIDA-ARCHITETTO §6.1: due istanze
sulla stessa macchina si contendono la porta di debug, e il client CDP finisce a pilotare l'app
sbagliata.

---

## 1. Dove sono i lavori

| | |
|---|---|
| `main` | **`060ee47`** — tutto unito, nessun ramo aperto (`strati-evidenze`, `evidenze-appunti` e `sovrapposte` sono stati cancellati dopo il merge) |
| remoto | `git@github.com:gmesc/StudIA.git` — **allineato**: `origin/main` è a `060ee47` |
| oggi | quattro lavori più i loro merge e un commit di documenti (§2) |
| suite | ✅ **40 file di unità** (`npm test`, exit 0) · **48 prove CDP** sull'app viva |
| pacchetti | i tre installer sono quelli del 17 agosto, in `dist/`: **non contengono il lavoro di oggi** |

```bash
cd "/Users/giacomomeschini/Claude/StudIA/StudIA"
npm test                                                   # 40 file, exit 0
STUDIA_PORTA=9346 ./test/cdp/con-vault-di-prova.sh         # le 48 prove sull'app viva
STUDIA_PORTA=9346 ./test/cdp/con-vault-di-prova.sh prova-strati.js   # una sola
```

⚠️ Il `cd` fa parte del comando: la cartella di lavoro delle chat è `StudIA/` (quella di fuori), e
da lì `./test/cdp/…` non esiste.

---

## 2. Che cosa è entrato oggi, e perché

Tre commit, un lavoro solo in tre tempi: **il colore dell'evidenza esce dalla fonte** (M0), **i
segni si spengono** (M1), **le letture** (M2). Il racconto lungo, con tutte le decisioni, è nei
messaggi di commit e in PIANO-BRAYNR; qui c'è ciò che serve per rimetterci le mani.

**`44f27ce` · Il colore di un'evidenza arriva dentro l'appunto.** «Appunta» e «Negli appunti»
scrivono `[==la frase==](ev:9f2c1a4b7e01)`: il segno di Obsidian attorno al testo, l'indirizzo
dell'evidenza fra parentesi.

- ⚠️ **Nel markdown il colore non c'è: c'è la citazione.** Il colore vive in un posto solo
  (`APPUNTI/_evidenze.json`) e l'appunto lo *chiede* al momento di disegnare, col gancio
  `evidenza(id)` di `lettura/capitolo.js`. Ricolorare una parola chiave cambia anche gli appunti che
  la citano **perché non c'è niente da aggiornare**. Scrivere il colore anche nel `.md` avrebbe
  costretto l'app a riscrivere i file dell'utente per un gesto fatto altrove.
- ⚠️ `ev:<id>` entra in `rimandi/sintassi.js` come le altre forme (invariante 7), ma è il solo che
  **non nomina un posto**: nomina un'annotazione, e dove porti lo decide lei (`evidenzaVai`).
- ⚠️ L'id si sa **prima** di scrivere, e lo calcola il main (`evidenze.identita` via preload):
  eccezione all'invariante 5 già presa per `ripasso:ids`, perché è uno sha1.
- ⚠️ Un'evidenza tolta non porta via la frase: il segno resta scolorito (`.evorfana`), col perché
  nel `title`.

**`3f83c81` · Un interruttore per rileggere il testo senza i segni.** `#pdfEvid` sulla barra della
Fonte e il gemello `#kwEvid` su quella delle Parole chiave nascondono le sottolineature senza
cancellarle.

- ⚠️ **Il filtro sta dove si dipinge, non dentro `evidenzeDi`**: quella funzione risponde a «quali
  evidenze sono di questa superficie», e la usano anche i **gesti**. Filtrando là, con i segni
  spenti ri-evidenziare una frase già segnata le avrebbe cambiato il colore di nascosto.
  *Nascondere cambia come si vede, mai che cosa succede.*
- ⚠️ La memoria è **per contenitore** (`studia.evidenze.viste.<corso>`) e sta nel `localStorage`: è
  una preferenza di lettura, non un dato del vault.
- ⚠️ Il rosso pagato: l'inline sta in cima al corpo e i riquadri in fondo, quindi al primo giro
  `#pdfEvid` non esiste e `$` torna `null` in silenzio. Si aspetta il documento (come PIANO-FOTO §F2).

**`a57ebc1` · Le letture — le stesse parole, analisi diverse.** Uno **strato** è una lettura del
testo: l'analisi metrica, le figure retoriche, il lessico. Il pannellino è la pila di Photoshop
scritta con la grammatica di casa: ogni riga una `.tbar`, ogni comando un `.tbtn`.

- ⚠️ **Lo strato entra nel seme dell'identità, e solo quando c'è.** È il cuore del lavoro: prima, le
  stesse parole avevano lo stesso id, quindi segnarle una seconda volta *cambiava il colore della
  prima*. Chi ha lo strato usa il seme dello strato, chi non l'ha quello di sempre — così le
  evidenze già scritte conservano l'id byte per byte (`test/evidenze.js` lo tiene fermo con un
  valore d'oro): nessuna migrazione, nessun `ev:<id>` rotto.
- ⚠️ Lo strato **«Base» non esiste su disco**: è l'assenza di strato. Un vault che non ha mai visto
  una lettura non ha nemmeno la chiave `strati`.
- ⚠️ Il registro sta **nello stesso file** delle evidenze, e `salva()` lo **conserva** quando nessuno
  glielo passa: senza quella riga il primo cambio di colore avrebbe cancellato il nome di ogni
  lettura. È la trappola delle liste bianche applicata a una chiave intera.
- ⚠️ `evidenzaSotto` guarda **solo dentro la lettura attiva**: «cambia colore» vale dentro una
  lettura, non fra letture diverse.
- ⚠️ Sulle stesse identiche parole si dipinge **un segno solo** — è come funziona l'ancoraggio, non
  un difetto degli strati. Con le letture il limite diventa il gesto: si guarda l'analisi che si sta
  facendo e si spegne l'altra.
- ⚠️ Togliere una lettura **si chiede**: `rimuoviStrato` risponde con quanti segni ha spostato e con
  i loro cambi di identità (`rinati`), perché spostandoli l'id cambia e un `ev:<id>` in un appunto
  non li ritrova più (invariante 4).

---

**`a197d32` · Più letture sulla stessa parola si vedono tutte** (M3). Prima se ne dipingeva una:
`EvidenzeAncoraggio.risolvi` elegge un vincitore fra i segni che si accavallano, e `evidenzeDisegna`
ignorava il resto.

- ⚠️ **Quel vincolo era caduto e nessuno se n'era accorto.** `risolvi` sceglie un vincitore perché fu
  scritto quando i segni si facevano **marcando il DOM**, dove due `<span>` sugli stessi caratteri non
  si annidano. Con la Custom Highlight API un intervallo può stare in dieci `Highlight` diversi — e
  intanto si buttavano via segni che l'utente aveva fatto, contati nel pannellino e invisibili sul
  testo. **Quando una regola ha una ragione scritta, va riletta dopo un cambio di tecnica.**
- Come si distinguono, per posto nella pila (due pile separate, fondi e righe, perché non si danno
  fastidio): **righe** piena · tratteggiata sopra la piena · punteggiata · piena più in basso;
  **fondi** pieno · semitrasparenti che si **mescolano**.
- ⚠️ **La riga bicolore non si disegna: la fa il browser.** Una riga tratteggiata sopra una piena
  lascia vedere l'altra fra i trattini. Misurato con due sonde usa-e-getta **prima** di scrivere
  codice.
- ⚠️ **Le bande orizzontali non si possono fare**, ed è misurato: `::highlight()` applica solo
  `background-color`, un `linear-gradient` viene ignorato. Per averle servirebbe abbandonare gli
  highlight e disegnare rettangoli da `getClientRects()` — un motore di pittura da risincronizzare a
  ogni scorrimento, zoom e ricostruzione del text layer di pdf.js.
- ⚠️ **Ciò che è solo resta com'era**: un fondo senza compagnia è pieno, una riga sola è piena. Il
  tetto è **4 + 4** per parola, e il pannellino dice che cosa taglia.

**`3c53a6a`, `060ee47`, `2bc1525`** — i due merge su `main` e il commit dei documenti (questo
handoff, il README, `graphify-out/` fuori dal versionato).

## 3. Le prove nuove, e che cosa misurano

| file | dove | che cosa misura |
|---|---|---|
| `test/evidenze-appunti.js` | `npm test` | 35 controlli sul markdown `[==…==](ev:…)` e sul gancio del colore |
| `test/strati.js` | `npm test` | 68 controlli: filtro, registro, righe del pannello, **posto nella pila e tetto** |
| `test/evidenze.js` | `npm test` | la sezione degli strati, col **valore d'oro** dell'id già scritto |
| `test/cdp/prova-evidenza-appunto.js` | `PROVE=(` | confronta il colore **calcolato** nell'appunto con quello dell'evidenza sulla fonte |
| `test/cdp/prova-strati.js` | `PROVE=(` | segna **le stesse parole due volte** e misura che su disco ce ne siano due; poi quattro letture sulla stessa parola e **quattro segni accesi** — la misura che ieri valeva 1 |

⚠️ Tre rossi pagati scrivendo queste prove, e valgono per le prossime:

- **Un'uscita anticipata «tanto non c'è niente da fare» salta anche la coda che serviva.**
  `evidenzeDisegna()` tornava subito con zero evidenze da accendere — ma zero è **anche** l'istante
  in cui si toglie l'ultima, cioè quando gli appunti devono scolorirsi.
- **Una prova verde da sola può essere rossa nella suite.** `prova-evidenziatore` gira prima e
  lascia il vault di prova segnato: evidenziando lì sopra, `evidenzaPrepara` **eredita** quel colore
  (e fa bene). Lo stato lasciato dalle prove precedenti fa parte dell'ingresso.
- **Un'asserzione può diventare falsa perché il codice è migliorato.** `prova-strati` sorvegliava
  «sulle stesse parole se ne dipinge una»: era la fotografia di un limite, e M3 l'ha tolto. Una
  prova che descrive un limite va riscritta insieme al limite.

---

## 4. L'esito delle suite

**Verde, tutto**, sul codice che sta su `main`:

- `npm test` → **40 file**, exit 0;
- `STUDIA_PORTA=9346 ./test/cdp/con-vault-di-prova.sh` → **48 prove**, nessun rosso.

⚠️ I giri sono stati fatti su una porta esplicita dopo aver controllato che `lsof -ti :9346` non
desse nulla: è la regola di GUIDA-ARCHITETTO §6.1 applicata, non un dettaglio. Una volta la porta
era occupata da un'istanza orfana di una corsa interrotta, e si è chiusa **per porta di debug**
(`pkill -f "remote-debugging-port=9346"`), mai per nome.

---

## 5. I gesti provati a mano

✅ **Tutti provati, tutti verdi.** Su un contenitore vero:

1. evidenzia una frase su un PDF, «Appunta» → nell'appunto si vede col suo colore e col suo tratto;
   ricolora la parola chiave → l'appunto cambia da sé;
2. togli l'evidenza → la frase resta, **scolorita**, e il `title` dice perché;
3. clicca la frase dentro l'appunto → porta all'evidenza sulla fonte;
4. spegni i segni, chiudi e riapri l'app → restano spenti, e il bottone lo dice subito;
5. due letture, lo **stesso verso** → due evidenze, due colori, una per volta o tutte insieme;
6. rinomina una lettura; togline una → arriva la domanda, e dice quanti segni sposta;
7. quattro letture sulla stessa parola → due fondi mescolati, due righe (piena + tratteggiata).

⏳ **L'unica cosa non guardata**: i segni sovrapposti **sul PDF**. Là il testo sta in un canvas e il
layer si compone in `multiply`, quindi la mescolanza dei fondi e i tratteggi potrebbero rendere
diversamente da come rendono nel capitolo. Le prove passano — ma misurano che i segni si accendano,
non che si leggano. È il primo controllo da fare, e costa un minuto.

---

## 6. Il merge: fatto

Le quattro condizioni erano tutte soddisfatte, e `main` è stata spinta sul remoto.

```
060ee47  merge: piu letture sulla stessa parola si vedono tutte
a197d32  feat(evidenze): piu letture sulla stessa parola si vedono tutte
2bc1525  docs: handoff del 18 agosto, e il grafo fuori da git
3c53a6a  merge: le evidenze negli appunti, l'interruttore dei segni, le letture
a57ebc1  feat(evidenze): le letture — le stesse parole, analisi diverse
3f83c81  feat(evidenze): un interruttore per rileggere il testo senza i segni
44f27ce  feat(evidenze): il colore di un'evidenza arriva dentro l'appunto
```

⚠️ La regola resta quella di GUIDA-ARCHITETTO §7.2, e vale per il prossimo lavoro: **il merge si
dichiara, non si presume** — due suite verdi, gesti provati a mano, documenti aggiornati, e `main`
ferma (altrimenti rebase **e suite rieseguite sul codice unito**, che non è mai girato prima).

---

## 7. Che cosa viene dopo, in ordine di maturità

1. **Guardare i segni sovrapposti sul PDF** (§5): un minuto, ed è l'unica cosa lasciata a metà.
2. **I seguiti delle letture** (PIANO-BRAYNR §P1.1-quater e -quinquies): un colore di default per
   lettura, applicato ai segni nuovi; il riordino delle righe; l'elenco delle parole chiave che
   segue la **visibilità** delle letture — oggi mostra tutto, e la nota nel codice dice da dove
   ripartire.
3. **Le bande orizzontali sui fondi sovrapposti**, se le si vuole davvero: non si ottengono con
   `::highlight()` (misurato), servirebbe un motore di pittura con `getClientRects()` da
   risincronizzare a ogni scorrimento, zoom e ricostruzione del text layer. È il lavoro più grosso
   e più fragile di questa lista: si decide sapendo che costa quello.
4. **Gli incrementi 2 e 3 dell'anteprima scrivibile** (handoff del 17, §3): elenchi e riquadri
   modificabili riga per riga; il cursore **dove hai cliccato** invece che in fondo al blocco — è il
   passo più piccolo e utile.
5. **Le 46 variabili morte di `pdf_viewer.scoped.css`.** `bin/pdfjs-css.js` riscrive i blocchi
   `:root` ma li lascia annidati dentro il guscio, e `#pdfPane #pdfPane` non corrisponde a niente.
   ⚠️ Rianimarle rimette bordi e margini che l'app non ha mai avuto: è un lavoro con le sue prove.
6. **Tre prove CDP che non girano da sempre**: `prova-l1.js`, `prova-l2.js`, `prova-l3l4.js` sono
   nel repo ma fuori da `PROVE=(`, e chiedono un `cdp.js` in uno scratchpad di luglio che non esiste
   più. O si riportano al `test/cdp/cdp.js` di casa e si mettono nell'elenco, o si tolgono.
7. **La rinomina di una fonte** (dal 16 agosto): si può, tenendo il numero, ma il nome del file è
   citato per esteso in sei posti — l'elenco è quello di `fonti.usi()`.
8. **Pacchetti nuovi** col lavoro di oggi (quelli in `dist/` sono del 17), poi **notarizzazione** e
   **installer Windows provato su Windows**: PIANO-ONBOARDING.

Un lavoro fuori dal codice, segnalato durante la sessione: **la didascalia di un'immagine dell'album
passa due volte dall'escape** (`albumHtml` in `lettura/capitolo.js`), quindi una «e» commerciale
esce come `&amp;amp;`. La gemella `figuraHtml` non ha il difetto. Piccolo, isolato, con la sua prova.

## 8. Il grafo della conoscenza

Dal 18 agosto il progetto ha un **grafo**: **4.454 nodi e 6.400 archi** da 215 file — codice
(estrazione AST, deterministica) e documenti (sotto-agenti in parallelo), in 262 community. Sta in
`graphify-out/`, **non è versionato** (7 MB che si rifanno da soli), e serve a rispondere a domande
che attraversano più documenti senza rileggerli tutti.


⚠️ **Il primo `--update` ha tolto 363 nodi e ne ha aggiunti 66**, e il guardiano di graphify si è
rifiutato di scrivere finché non gli si è detto di sì: un grafo che *si accorcia* di solito vuol dire
chunk persi. Qui no — erano **doppioni**: 313 dei 363 spariti avevano un gemello con la stessa
etichetta, e il resto erano nodi-spazzatura nati dagli import destrutturati delle prove CDP
(`{ collega, val, pausa… }`). La costruzione a otto sotto-agenti in parallelo li produce, e il merge
li pulisce. Il numero è sceso perché il grafo è **più pulito**, non più povero — ma la prossima volta
che il guardiano parla, si guarda prima di forzare.

⚠️ **`--update` non conosce il perimetro** deciso al primo giro: `detect_incremental` ha proposto 297
file, comprese le 184 immagini della guida illustrata e i bundle vendorizzati di pdf.js. Il corpus
vero è quello del manifest (215 file), e l'aggiornamento va filtrato sullo stesso perimetro —
altrimenti il grafo si riempie di materiale di prova.

```bash
open graphify-out/graph.html          # il grafo, nel browser
/graphify query "…"                   # una domanda, dentro Claude Code
/graphify . --update                  # riestrae solo i file cambiati
```

⚠️ Che cosa **non** c'è dentro, e di proposito: `_ARCHIVIO/` (le trascrizioni TD74 sono corpus di
studio, non conoscenza del progetto), `App/guida-zaino/` (immagini e materiali di prova), le licenze
di terze parti, e il monolite `App/StudIA.html` — un solo file da 1 MB che nessun estrattore legge
utilmente: la sua struttura arriva dai moduli di `App/assets/`, ed è un'altra ragione per andare
avanti con PIANO-MODULI.

---

## 9. Il laboratorio degli screenshot

`App/guida-zaino/_lab/` — `lab.js` pilota l'app viva via CDP (porta **9345**) e scatta;
`campagna.js` rifà tutte le immagini della guida in un giro. Le immagini finiscono in `../img/`,
cioè dentro la guida che l'app spedisce.

⚠️ Prima di scattare, `pgrep -f "remote-debugging-port=9345"` deve dare **una** riga, e il codice
caricato deve essere quello nuovo.
