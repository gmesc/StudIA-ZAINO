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

Il lavoro di oggi — **le evidenze che arrivano negli appunti, l'interruttore dei segni, e le
letture** — è tutto committato, ma sta sul ramo **`strati-evidenze`**, non su `main`. Niente da
committare: l'albero è pulito. Il primo gesto di una chat nuova è **provare i gesti a mano** (§5) e
poi unire (§6): `main` non si è mossa, quindi il merge è un fast-forward.

⚠️ **Prima di lanciare qualunque cosa che apra Electron**, leggi GUIDA-ARCHITETTO §6.1: due istanze
sulla stessa macchina si contendono la porta di debug, e il client CDP finisce a pilotare l'app
sbagliata.

---

## 1. Dove sono i lavori

| | |
|---|---|
| ramo | **`strati-evidenze`** (HEAD, `a57ebc1`), tre commit avanti a `main`. `evidenze-appunti` è solo un'etichetta rimasta indietro sullo stesso filo: è contenuta in `strati-evidenze`, non è un lavoro separato |
| `main` | `fff8c76` — ferma dal 17 agosto sera, quindi il merge è un **fast-forward** |
| remoto | `git@github.com:gmesc/StudIA.git` — allineato solo fino a `51859a4`: **sette commit sono locali** (i quattro del 17 su `main` più i tre di oggi) |
| oggi | tre commit (§2), niente di non committato |
| suite | ✅ **39 file di unità** (`npm test`, exit 0) · **47 prove CDP** sull'app viva — l'esito del giro di stanotte è al §4 |
| pacchetti | i tre installer sono quelli del 17 agosto, in `dist/`: **non contengono il lavoro di oggi** |

```bash
cd "/Users/giacomomeschini/Claude/StudIA/StudIA"
npm test                                                   # 39 file, exit 0
STUDIA_PORTA=9346 ./test/cdp/con-vault-di-prova.sh         # le 47 prove sull'app viva
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

## 3. Le prove nuove, e che cosa misurano

| file | dove | che cosa misura |
|---|---|---|
| `test/evidenze-appunti.js` | `npm test` | 35 controlli sul markdown `[==…==](ev:…)` e sul gancio del colore |
| `test/strati.js` | `npm test` | 51 controlli: filtro, registro, righe del pannello |
| `test/evidenze.js` | `npm test` | la sezione degli strati, col **valore d'oro** dell'id già scritto |
| `test/cdp/prova-evidenza-appunto.js` | `PROVE=(` | confronta il colore **calcolato** nell'appunto con quello dell'evidenza sulla fonte |
| `test/cdp/prova-strati.js` | `PROVE=(` | segna **le stesse parole due volte** e misura che su disco ce ne siano **due**, non una ricolorata |

⚠️ Due rossi pagati scrivendo queste prove, e valgono per le prossime:

- **Un'uscita anticipata «tanto non c'è niente da fare» salta anche la coda che serviva.**
  `evidenzeDisegna()` tornava subito con zero evidenze da accendere — ma zero è **anche** l'istante
  in cui si toglie l'ultima, cioè quando gli appunti devono scolorirsi.
- **Una prova verde da sola può essere rossa nella suite.** `prova-evidenziatore` gira prima e
  lascia il vault di prova segnato: evidenziando lì sopra, `evidenzaPrepara` **eredita** quel colore
  (e fa bene). Lo stato lasciato dalle prove precedenti fa parte dell'ingresso.

---

## 4. L'esito del giro CDP di stanotte

**Verde, tutto.** Il giro completo — `STUDIA_PORTA=9346 ./test/cdp/con-vault-di-prova.sh` — è stato
lanciato sul codice di `strati-evidenze` la notte del 18 agosto: **47 prove, nessun rosso**, uscita 0,
comprese le due nuove (`prova-evidenza-appunto.js`, `prova-strati.js`). Insieme a `npm test` (39 file,
verde) sono le due suite intere sul codice committato.

⚠️ Il giro è stato fatto su una porta esplicita (`STUDIA_PORTA=9346`) dopo aver controllato che
`pgrep -f remote-debugging-port` non desse nulla: è la regola di GUIDA-ARCHITETTO §6.1 applicata, non
un dettaglio.

---

## 5. I gesti da provare a mano prima del merge

Le prove misurano, non guardano. Su un contenitore vero:

1. evidenzia una frase su un PDF, «Appunta» → nell'appunto la frase si vede **col suo colore e col
   suo tratto**; ricolora la parola chiave → l'appunto cambia da sé;
2. togli l'evidenza → nell'appunto la frase resta, **scolorita**, e il `title` dice perché;
3. clicca la frase dentro l'appunto → porta all'evidenza sulla fonte;
4. spegni i segni dalla barra della Fonte, chiudi e riapri l'app → **restano spenti**, e il bottone
   lo dice; con l'elenco delle parole chiave vuoto la riga «i segni sono nascosti» si vede comunque;
5. crea una lettura «metrica», segna un verso; passa a una lettura «retorica» e segna **lo stesso
   verso** → sono due evidenze, con due colori, e si guarda una per volta;
6. rinomina una lettura; **togline una** → arriva la domanda, e dice quanti segni sposta.

---

## 6. Il merge: è il momento?

**Non ancora — manca solo la §5.** Le quattro condizioni:

1. ✅ `npm test` verde (39 file) e le 47 prove CDP (§4);
2. ⏳ **i gesti provati a mano da te** (§5) — questo è ciò che manca;
3. ✅ piani e documenti aggiornati: PIANO-BRAYNR ha i tre paragrafi nuovi, GUIDA-ARCHITETTO il
   vocabolario di `ev:` e due trappole in più, e questo handoff;
4. ✅ `main` non si è mossa da `fff8c76`: **fast-forward**, nessun conflitto possibile.

Appena la 2 è fatta:

```bash
cd "/Users/giacomomeschini/Claude/StudIA/StudIA"
git checkout main && git merge --ff-only strati-evidenze
git branch -d evidenze-appunti          # etichetta indietro sullo stesso filo
git push origin main                    # sette commit da mandare su
```

---

## 7. Che cosa viene dopo, in ordine di maturità

1. **I seguiti delle letture** (PIANO-BRAYNR §P1.1-quater, in fondo): un colore di default per
   lettura, applicato ai segni nuovi; il riordino delle righe; l'elenco delle parole chiave che
   segue la **visibilità** delle letture — oggi mostra tutto, e la nota nel codice dice da dove
   ripartire.
2. **Gli incrementi 2 e 3 dell'anteprima scrivibile** (handoff del 17, §3): elenchi e riquadri
   modificabili riga per riga; il cursore **dove hai cliccato** invece che in fondo al blocco — è il
   passo più piccolo e utile.
3. **Le 46 variabili morte di `pdf_viewer.scoped.css`.** `bin/pdfjs-css.js` riscrive i blocchi
   `:root` ma li lascia annidati dentro il guscio, e `#pdfPane #pdfPane` non corrisponde a niente.
   ⚠️ Rianimarle rimette bordi e margini che l'app non ha mai avuto: è un lavoro con le sue prove.
4. **Tre prove CDP che non girano da sempre**: `prova-l1.js`, `prova-l2.js`, `prova-l3l4.js` sono
   nel repo ma fuori da `PROVE=(`, e chiedono un `cdp.js` in uno scratchpad di luglio che non esiste
   più. O si riportano al `test/cdp/cdp.js` di casa e si mettono nell'elenco, o si tolgono.
5. **La rinomina di una fonte** (dal 16 agosto): si può, tenendo il numero, ma il nome del file è
   citato per esteso in sei posti — l'elenco è quello di `fonti.usi()`.
6. **Pacchetti nuovi** col lavoro di oggi (quelli in `dist/` sono del 17), poi **notarizzazione** e
   **installer Windows provato su Windows**: PIANO-ONBOARDING.

---

## 8. Il grafo della conoscenza

Dal 18 agosto il progetto ha un **grafo**: 4.751 nodi e 6.293 archi da 215 file — 184 di codice
(estrazione AST, deterministica) e 31 documenti (otto sotto-agenti in parallelo). Sta in
`graphify-out/`, **non è versionato** (7 MB che si rifanno da soli), e serve a rispondere a domande
che attraversano più documenti senza rileggerli tutti.

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
