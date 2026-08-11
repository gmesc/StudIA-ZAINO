# Handoff definitivo — 12 agosto 2026

> **A chi arriva adesso, in una chat nuova: questo file basta per ripartire.**
> Racconta la sessione dell'11-12 agosto — il **riordino delle barre**, lo **smontaggio del
> monolite**, e le due cose che chiudono rischi vecchi: **l'identità dei capitoli** e **la storia
> dei ripassi su disco**.
>
> Quello che riguarda lo ZAINO e non si nomina qui vale come scritto in
> [HANDOFF-DEFINITIVO-2026-08-11.md](HANDOFF-DEFINITIVO-2026-08-11.md); i corsi, in quello del
> [10 agosto](HANDOFF-DEFINITIVO-2026-08-10.md).
>
> **Il lavoro che continua per primo è P3.3** (§7): gli intervalli di ripasso. Senza, il campo
> `prossimo` resta vuoto e il sistema non dice mai *quando* tornare — che è tutto il punto.
>
> **Regola di lettura**: dove c'è ⚠️ c'è un guasto già pagato — successo davvero, misurato, col
> rimedio accanto. È la parte utile.

---

## 1. Stato

```bash
cd "/Users/giacomomeschini/Claude/StudIA/StudIA"
npm test                                              # 2195 controlli su 23 file
./test/cdp/con-vault-di-prova.sh                      # 26 prove sull'app viva
./test/cdp/con-vault-di-prova.sh prova-ripasso        # una sola
```

Tutto verde. `main` pulito, ultimo commit `c8c6acb`. Ramo di sicurezza e archivio dello stato di
ieri: tag **`freezer-2026-08-11`** e `../freezer-2026-08-11.bundle` (4,2 MB, verificato).

⚠️ Le prove CDP **non toccano niente di tuo**: copia magra del vault (23 GB → ~2 MB), cartella dati
tutta loro (`--user-data-dir`). StudIA può restare aperta mentre girano.

| | ieri mattina | adesso |
|---|---|---|
| `App/StudIA.html` | 13.072 righe · 804 KB | **13.019 righe · 746 KB** |
| logica del renderer provabile in Node | ~0 | **~1.300 righe** |
| suite di unità | 17 | **23** |
| prove sull'app viva | 17 | **26** |
| blocchi che `reader-parser` ritagliava dal sorgente | 4 | **0** |

⚠️ Le righe del renderer sono quasi ferme, ed è onesto dirlo: le estrazioni ne hanno tolte ~510, le
funzioni nuove della sessione ne hanno aggiunte altrettante. **Il numero che dice se il lavoro sta
funzionando è il secondo**, non il primo.

---

## 2. Le barre sono un token solo

Il modello dichiarato dall'utente è la barra della mappa:

```
GENERATA MIE  MAPPE ▾ + ✎ 🗑 │ 1 2 3 4 5 │ TD SX             ⚙ 🖨 ✕
└ segmentato ┘└── documento ──┘└─ modi ──┘└ vista ┘ └spazio┘ └ chiusura ┘
```

Adesso è `.tbar` + `.tbtn` + `.tbsep` + `.tbspazio`, misure dai token `--tb-*`. La **testata** è la
stessa barra ×1.1 (`.tbar-lg`), e non ricopia nessuna regola: **ridichiara i token** sul
contenitore, quindi tutto ciò che sta dentro cresce da sé. Il rapporto è un token solo,
`--tb-piu`.

Chi aggiunge un comando a una barra scrive `class="tbtn"` e ha finito. **Se ti trovi a scrivere
`height:` o `font-size:` su un bottone di barra, stai sbagliando.**

Guardie: `prova-tbar` (le cinque barre degli split sono la stessa barra) · `prova-topbar-stile`
(la testata è quella barra ×1.1, e le posizioni non si muovono) · `prova-appunti-barra` (EasyMDE
piegata al sistema) · `prova-maniglia-indice`.

Lo stesso sistema è nella skill globale `~/.claude/skills/studia-app-layout/` (§5bis), per riusarlo
altrove.

---

## 3. Il monolite si smonta — [PIANO-MODULI.md](PIANO-MODULI.md)

Il criterio è uno: **esce la logica che non tocca il DOM, resta ciò che è pagina.**

| modulo | righe | che cos'è |
|---|---|---|
| `App/assets/lettura/capitolo.js` | ~310 | il parser dei capitoli |
| `App/assets/lettura/identita.js` | 110 | chi è un capitolo, e come lo si ritrova domani (§5) |
| `App/assets/lettura/lezioni.js` | 97 | da un rimando alla lezione da aprire (varianti comprese) |
| `App/assets/tts/segmenta.js` | 207 | testo → segmenti da leggere ad alta voce |
| `App/assets/appunti/elenco.js` | ~150 | appunto ↔ capitolo, i tre gruppi della tendina |
| `App/assets/ricerca/indice.js` | 150 | che cosa entra nell'indice, e come si ordina |
| `App/assets/rimandi/sintassi.js` | 115 | `pdf:03#p=7`, `video:01#t=160`, `cap:…`, `fig:…` |
| `App/assets/dati/{icone,emoji}.js` | 64 KB | dati, non codice |

Tutti **UMD**, come `mappa/grafo.js`: `<script src>` nel browser, `require()` in Node, **lo stesso
file**. ⚠️ Niente moduli ES: da `file://` seguono le regole CORS e costerebbero un server locale o
un bundler — il primo dei non-obiettivi del piano.

⚠️ **`lib/reader-parser.js` non ritaglia più niente** (128 → 53 righe, senza `fs` né `vm`). Prima
prendeva il sorgente dell'HTML, ne tagliava quattro blocchi — uno fra due `indexOf`, tre fra
commenti-sentinella `@…-puro-inizio` — e li eseguiva in un sandbox. Più di mille controlli
pendevano da due marcatori di testo e tre commenti.

⚠️ **La stima per sezione è ottimista di cinque volte.** «La ricerca: ~700 righe su 866» contava la
SEZIONE; le funzioni senza DOM erano **81**. Rapporto osservato: su cento righe di sezione ne
escono venti. Chi pianifica il prossimo modulo tolga cinque volte prima di promettere.

Restano M4 (TTS, la parte oltre il blocco già uscito), M5 (album: la conversione PDF→viewport, dove
viveva il ritaglio ribaltato), M7 (evidenze), M8 (memorie), M9 (archi — per ultimo).

---

## 4. Le funzioni nuove della sessione

- **Una superficie sola sulla selezione.** La barra che compare da sé e il menu del tasto destro
  erano due disegni per le stesse cinque azioni. Adesso il menu lo scrive `selMenuHTML()` e le due
  porte lo mostrano; `#selBarra` porta le classi `ctxmenu selmenu` e aggiunge solo dove si posa.
- **I richiami di nota saltano.** `[^1]` era un `<sup>` colorato che non faceva niente. Ora è
  un'ancora alla voce in fondo, con la freccia che riporta indietro. ⚠️ Prefisso `nota-` e non
  `note-`: quello è **già** l'id dei bottoni di «Note e materiali» (`StudIA.html:3502`).
- **Nello zaino un appunto e una mappa dicono da quale DOCUMENTO nascono** (o `PERSONALE`), e lo si
  cambia dalla finestra di rinomina. ⚠️ Tre liste bianche hanno provato a mangiarsi il campo nuovo:
  `CHIAVI` in `lib/appunti.js`, la sua gemella nel renderer (`noteMeta`), `normalizza()` in
  `lib/mappe.js`. Il controllo che le smaschera non è «il campo esiste» ma **«il campo torna
  indietro dal disco»**.
- **Togliere una fonte dallo zaino** (`lib/fonti.js`), con la **lapide sul contenuto**: vedi §6.
- **`lib/evidenze.js` è tornato un file di testo**: conteneva due byte NUL letterali come
  separatore, e un NUL nel sorgente rende il file binario per git — niente `diff`, niente `blame`.
  Ora è la sequenza di escape; gli id delle evidenze sono identici (verificato su quattro casi).

---

## 5. ⚠️ L'identità dei capitoli — il rischio che era in cima da tre giorni

Era «l'unico modo rimasto di perdere lavoro dell'utente». **Chiuso.**

Il lettore **si inventava** l'id di un capitolo dalla posizione (`01-fondamenti-c03`) buttando
quello scritto nel frontmatter. Appunti, evidenze, nodi di mappa e rimandi `cap:…` nominano un
capitolo con quell'id: una rigenerazione che ne infila uno in mezzo li staccava tutti, in silenzio.

⚠️ E la soluzione ovvia — usare l'id del disco — **sarebbe stata il danno stesso**. Contato: tutti i
243 capitoli ne hanno uno, ma in TD74-DSA (210 su 210) NON coincide col posizionale, perché porta
il prefisso del corso; nei 33 di ai-literacy coincide. Tutto ciò che l'utente ha scritto nel primo
porta il nome vecchio.

Quindi una **catena di nomi** (`App/assets/lettura/identita.js`): id stabile + alias posizionale, e
un riferimento combacia con l'uno **o** con l'altro. I quattro punti che confrontavano con `===`
passano di lì: `trovaCapitolo`, le due liste di evidenze, `noteInChapter`. E `lib/genera.js`
**conserva** l'id se un capitolo con quel titolo c'era già.

Verificato sui dati veri: i due appunti di TD74-DSA che portano `01-fondamenti-c01` restano sotto
«Questo capitolo» del capitolo che oggi si chiama `td74-01-fondamenti-c01`.

**I due limiti, dichiarati**: un capitolo di cui cambia il TITOLO non si riconosce e prende un id
nuovo (l'identità vera andrebbe data alla scaletta, prima che il capitolo esista); e i riferimenti
scritti prima restano legati alla posizione — quel danno storico non si disfa a posteriori.

---

## 6. Il ripasso vive su disco (P3.1) — e la lapide delle fonti

**P3.1.** `RIPASSO/stato.json` dentro il contenitore, accanto ad `APPUNTI/` e `MAPPE/`.
`state.learn` non è più uno stato ma la **vista** di quel file: prima `loadLesson` faceva
`state.learn={}`, cioè il gesto più comune dell'app cancellava il dato più costoso che l'app
produce.

- ⚠️ L'identità di una carta è il suo **contenuto**: `hash(capitolo + domanda normalizzata)`. Spazi
  e maiuscole non contano; una domanda davvero diversa è una carta nuova che riparte da zero.
- ⚠️ L'hash si calcola **nel main**: il renderer non ha `crypto`, e due formule per la stessa
  identità divergono al primo ritocco.
- ⚠️ Le carte sparite si potano **dicendolo** («N carte non esistono più»): è il patto di
  `percorsi.invalida()`.
- «Azzera avanzamento» adesso chiede conferma dicendo quante carte si buttano: prima non c'era
  niente da perdere.

**La lapide delle fonti.** Togliendo un PDF dallo zaino, `MATERIALI/_rimossi.json` conserva
l'**impronta del contenuto** (sha1) col nome che aveva: se quel documento torna, riprende nome e
numero di prima e **tutto si riaggancia da sé**. ⚠️ Il numero si riusa **solo** su impronta uguale —
riciclarlo in generale farebbe puntare i vecchi `pdf:03` altrove — e le lapidi **prenotano** il loro
numero (senza, il documento importato dopo se lo prendeva, e al ritorno c'erano due «01»). Il file
va nel **Cestino di sistema**, e la conferma dice quanto lavoro ci si appoggia (`fonti.usi`).

---

## 7. Che cosa resta, in ordine

1. **P3.3 — i quattro esiti e gli intervalli.** `prossimoIntervallo(storia, esito)` in
   `lib/ripasso.js` (SM-2 semplificato, poche decine di righe pure con le prove sui casi limite) e
   l'interfaccia di ripasso: fronte → «mostra risposta» → quattro bottoni coi tempi previsti sopra.
   Il campo `prossimo` esiste già ed è vuoto. **È il passo che rende utile tutto il resto.**
2. **P3.2 — il glossario come seconda sorgente di carte**: `t`/`d` è un fronte-retro naturale, già
   scritto in 243 capitoli. Poche righe, molto valore.
3. **P3.6 — i conteggi in home**: mai studiate / in attesa / da ripassare oggi.
4. **M5** del piano moduli: `album/geometria.js`, dove viveva il ritaglio ribaltato.
5. Dallo zaino: **Z7** (impostazioni OCR), **rifare i ritagli storti**, **B3** (fonte a schede).
6. Del viewer: il documento non si chiude quando «fonte» esce dal banco; il tema scuro non arriva
   alla pagina; la stampa del PDF.
7. **La forma delle mappe di corso**: 65.158 × 358 px non è una mappa, è un nastro.
8. La **notarizzazione** del `.dmg` (PIANO-ONBOARDING).

---

## 8. Le trappole pagate in questa sessione

- ⚠️ **I confini di un blocco non si prendono da un `grep` di ieri**: il file si era accorciato di
  214 righe, e tre moduli sono nati a pezzi. Si calcolano dalle sentinelle.
- ⚠️ **`LESSONS` sono le LEZIONI, non i corsi.** Iterarle chiamando `cambiaCorso()` gira a vuoto.
- ⚠️ **Un click di CDP arriva a coordinate dello SCHERMO**: premere un elemento a y=1103 in una
  finestra alta 848 non preme niente, e il rosso accusa il gestore. Prima `scrollIntoView`, poi il
  click. Successo **due volte** (le note, il quiz).
- ⚠️ **Il tasto destro via CDP non genera `contextmenu`**: lo fa il sistema operativo. Si manda
  l'evento a mano, con le coordinate dentro i rettangoli del range.
- ⚠️ **Contare le righe di una barra dai bordi alti conta righe che non esistono**: una barretta da
  16 dentro una riga da 33 ha il `top` più basso. Si contano i centri.
- ⚠️ **Aggiungere una prova al runner sostituendo la prima occorrenza di un nome** la infila nel
  commento d'uso, non nell'array: due prove sono girate solo a mano per mezza giornata mentre il
  rapporto diceva «suite intera verde». Controllare che il nome compaia **dentro `PROVE=(`**.
- ⚠️ **Una cifra scritta in un commento va contata, non ricordata**: «nessuno dei 243 coincide» era
  falso (33 coincidono), e l'ha scoperto una prova che pretendeva una differenza inesistente.
- ⚠️ **`mappaFlush()` non salva se la mappa non è sporca**: scrivere nel documento in memoria e
  chiamare flush *sembra* salvare.
- ⚠️ **Niente apici inversi nei commenti dentro un template letterale** (settima volta).

---

## 9. Dove sta il codice

```
App/StudIA.html          il guscio: markup, <style>, e il renderer che cabla i moduli
  · i token --tb-* / --tb-piu e `.tbar`: il vestito di TUTTE le barre
  · selMenuHTML()        una funzione, due superfici sulla selezione
  · RIPASSO / ripasso*   la vista su RIPASSO/stato.json (P3.1)
  · curCtx()             ⚠️ il contesto porta `capitoloAlias`: i nomi vecchi del capitolo
App/assets/…             i nove moduli UMD (vedi §3)
lib/ripasso.js           la storia dei ripassi: identità, lettura, potatura, stato del capitolo
lib/fonti.js             i documenti dello zaino + elimina/lapide/riaggancio/usi
lib/genera.js            ⚠️ scriviCapitolo(): CONSERVA l'id di un capitolo che c'era già
lib/reader-parser.js     ⚠️ non ritaglia più niente: carica i moduli. 53 righe
```

Piani vivi: [PIANO-MODULI.md](PIANO-MODULI.md) (lo smontaggio, con le metriche aggiornate a ogni
passo) · [PIANO-BRAYNR.md](PIANO-BRAYNR.md) (flashcard e ripasso, P3.1 segnato fatto) ·
[PIANO-ZAINO.md](PIANO-ZAINO.md).

---

## 10. Come si lavora, qui

Il ritmo che ha funzionato in questa sessione, e che vale la pena ripetere:

1. **Un lavoro laterale a un agente in worktree isolato** mentre la sessione principale prosegue.
   ⚠️ Worktree obbligatorio se tocca `App/StudIA.html` — nella stessa cartella l'ultimo che salva
   cancella l'altro — e **vietargli la suite CDP**, che usa la porta 9333 dell'altra sessione.
2. **Non fidarsi del rapporto dell'agente**: verificare a mano le due o tre affermazioni che
   contano, e rieseguire tutto prima di unire. (Una collisione di id dichiarata era vera; una lista
   bianca dimenticata avrebbe cancellato un campo in silenzio.)
3. **Dopo ogni passo, una lista corta di gesti che l'utente prova di persona.** Le prove misurano,
   non guardano: il difetto dei numeretti delle note lo ha trovato lui, con tutte le suite verdi.
4. **Ogni ⚠️ in questo file è costato tempo una volta.** Rileggerle prima di toccare la stessa zona
   è il modo più economico di non ripagarle.
