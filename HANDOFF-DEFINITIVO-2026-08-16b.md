# Handoff definitivo — 16 agosto 2026, sera

> **A chi arriva adesso: questo file basta per ripartire.** Sostituisce
> [HANDOFF-DEFINITIVO-2026-08-16.md](HANDOFF-DEFINITIVO-2026-08-16.md), che resta la lettura di
> dettaglio su pacchetti, installer Windows e primo avvio.
>
> **Come si costruisce qui** lo dice [GUIDA-ARCHITETTO.md](GUIDA-ARCHITETTO.md).
> **Regola di lettura**: dove c'è ⚠️ c'è un guasto già pagato, col rimedio accanto.

---

## 0. Da dove ripartire, in tre righe

**Il lavoro di oggi è finito e verificato; manca UNA decisione: unire in `main`.** Le quattro
condizioni del merge (GUIDA-ARCHITETTO §7.2) sono soddisfatte tranne una riga — vedi §5. Se Giacomo
dice di sì, si fa il merge; se invece si riparte a costruire, la cosa più matura è la proposta del §4
(«rinominare una fonte»), che è già istruita e aspetta solo il via.

⚠️ **Non ricominciare da capo la lettura del codice**: la mappa di tutta la modalità ZAINO — etichette
esatte, selettori, gesti, che cosa succede su disco — è già scritta e verificata nella **guida
illustrata** (`../StudIA - tutorial ZAINO/index.html`, 93 immagini scattate sull'app viva). È la
documentazione utente, ma è anche il censimento più aggiornato di che cosa l'app fa davvero.

---

## 1. Dove sono i lavori

| | |
|---|---|
| rami | quattro, in fila: `pacchetto` → `selmenu-closepops` → `installer-windows` → **`zaino-ricerca-rinomina`** (oggi). L'ultimo contiene tutti: unendo quello entra tutto in un colpo |
| commit | `3bb8f6c` alla testa di `zaino-ricerca-rinomina`, **18 avanti** a `main` (ferma a `b005214`); albero pulito, niente in sospeso |
| oggi | `d391a50` (lente negli appunti · rinomina zaino · nomi dei tasti · etichette) e `3bb8f6c` (i titoli degli appunti) |
| suite | ✅ **37** file di unità · ✅ **45** prove CDP sull'app viva, rieseguite sul codice committato |
| remoto | `git@github.com:gmesc/StudIA.git` (privato); **nessun ramo è salito** |
| fuori dal repo | `../StudIA - tutorial ZAINO/` — la guida illustrata (93 immagini, `_lab/` con la ricetta per rifarle) · la skill globale `~/.claude/skills/guida-app-screenshot/` |

```bash
cd "/Users/giacomomeschini/Claude/StudIA/StudIA"
npm test                                                   # 37 file, exit 0
STUDIA_PORTA=9346 ./test/cdp/con-vault-di-prova.sh         # 45 prove sull'app viva
STUDIA_PORTA=9346 ./test/cdp/con-vault-di-prova.sh prova-zaino.js   # una sola
```

⚠️ **La porta 9346 e non la 9333**: 9333 è quella di fabbrica del runner, e se un'altra sessione la
sta usando le due corse si contendono la stessa app — misure rosse a caso. Con `STUDIA_PORTA` non
succede.

---

## 2. Che cosa è entrato oggi

Tre buchi che **la guida illustrata ha fatto emergere elencandoli**: scritti in un capitolo intitolato
«che cosa non esiste», si vedeva che non erano scelte ma dimenticanze. È il modo più economico di
trovarle che abbiamo usato finora — scrivere la documentazione per l'utente e guardare che cosa si è
costretti a scusare.

### La lente cerca anche negli APPUNTI
Erano l'unica cosa che l'utente **scrive** e non poteva rileggere cercando: la lente guardava i capitoli
(nei corsi) o le pagine dei documenti (negli zaini), mai il quaderno. Chi cercava una frase che sapeva
di aver scritto concludeva di non averla scritta.
`RicercaIndice.docAppunto(nota, gruppo, idx)` — titolo + corpo, e il titolo pesa 30 come per i capitoli.
Vale in **tutte e due** le modalità: non era un buco dello zaino, era un buco della lente.
Il risultato si apre con `bancoMostra('appunti') + noteOpen`, le due chiamate della voce in sidebar.

⚠️ **L'indice della lente è una copia.** Senza invalidarlo, un appunto appena scritto non si troverebbe
fino al cambio di contenitore. Il punto da cui si sa che l'elenco è cambiato è **uno solo** —
`notesReload()` — e lì adesso c'è `SEARCH.docs=null`.
⚠️ **E gli appunti si rileggono PRIMA di aprire `SEARCH.docs`**, non dopo: `notesReload()` azzera
l'indice, e chiamarlo a metà costruzione lo toglierebbe da sotto i piedi alla funzione che lo sta
riempiendo — `push` su `null`, cioè la lente che smette di funzionare la prima volta che si cerca in un
contenitore appena aperto.
⚠️ Dentro l'editor la parola trovata **non** si riaccende: CodeMirror ha una selezione sua, e accendere
lì dentro vorrebbe dire un secondo motore di evidenziazione che nessuno spegne.

### Rinominare uno zaino — ✎ accanto al 🗑 in Impostazioni › Zaino
Cambia il titolo **e la cartella**: l'id di uno zaino *è* il suo titolo ridotto a nome di cartella
(`crea` fa `slugify` e nient'altro), e lasciare `Zaini/diritto-pubblico/` intitolato «Storia romana»
sarebbe una seconda verità dentro un vault che l'utente apre col Finder.
Non fa paura perché **dentro la cartella nessuno cita lo zaino per id**: i rimandi (`pdf:03#p=7`) sono
relativi al contenitore, evidenze e ritagli citano il *nome del file*, appunti e mappe stanno lì dentro.
L'unico riferimento esterno è la memoria della macchina, che il renderer trasloca.

⚠️ **Il riaggancio va fatto PRIMA di `zainiAggiorna()`.** Quella funzione, vedendo che lo zaino attivo
non è più nell'elenco (l'id è cambiato), lo azzera e apre **il primo della lista**: rinominare lo zaino
aperto avrebbe portato dentro un altro zaino. Si passa da `cambiaZaino`, che è la porta vera di «adesso
il contenitore è quest'altro», e `MODO.zaino=null` è ciò che le impedisce di uscire alla prima riga.
⚠️ **La memoria della macchina trasloca** (`zainoMemoriaSposta`): `studia.banco.c.<id>`, `.zoom`, la voce
in `studia.aperto`. Senza, rinominare sembrerebbe aver **resettato lo zaino** — banco di fabbrica,
riquadri vuoti — mentre sul disco non si è perso niente. È lo stesso elenco di chiavi che `zainoElimina`
cancella: se un giorno se ne aggiunge una, va aggiunta in tutti e due i posti.
⚠️ Resta un timbro vecchio nel campo `corso` delle mappe già salvate (`lib/mappe.js:629` conserva quello
che trova). Nessuno lo legge — è una firma, non un puntatore — ma è la sola cosa che dopo una rinomina
dice ancora il nome di prima.

### I nomi dei tasti secondo la tastiera che si ha davvero sotto le mani
`App/assets/tasti/nomi.js` (UMD, `test/tasti.js`, 27 controlli): «⌘F» su un Mac, «Ctrl+F» altrove.
Il codice funzionava già su Windows — le guardie sono tutte `e.metaKey || e.ctrlKey` — ma i suggerimenti
nominavano un tasto che là non esiste: chi legge «⌘F» cerca un tasto che non ha e conclude che la
scorciatoia non c'è.

⚠️ **Non è una sostituzione, è una regola.** «⌘F» → «Ctrl+F», ma «tieni premuto ⌘» → «tieni premuto
Ctrl», senza il più: il «+» appartiene alla combinazione, non al tasto. Un `replace` secco sbaglia una
delle due frasi, e sbagliarla non si vede finché non si leggono tutte e due.
⚠️ **La spazzata entra nei `<template>`.** La barra dell'editor si clona da `#noteCtlTpl` a ogni
apertura: un template non riscritto rimetterebbe «Cmd+S» a ogni clone — un guasto che *ricompare da
solo* dopo essere stato corretto.
⚠️ **E si richiama dopo `ensureMde()`**: i suggerimenti dei bottoni di EasyMDE li scrive la libreria in
quel momento, dopo la spazzata di partenza. Chi fabbrica markup che nomina tasti lo ridà a
`tastiNelDom(host)`: è la stessa regola applicata una seconda volta, non una seconda regola.
⚠️ **«Maiusc» non si traduce**: su una tastiera italiana quel tasto si chiama così su tutte e due le
piattaforme, e tradurlo in «Shift» sarebbe inventare un tasto che chi legge non ha davanti.

**Misurato su un Windows finto** (`Emulation.setUserAgentOverride` + reload, nel laboratorio della
guida): «Cerca nello zaino (Ctrl+F)», «Salva (Ctrl+S)», «Segna questo minuto negli appunti
(Ctrl+Shift+C)», «tieni premuto Ctrl», e **zero** suggerimenti col simbolo ⌘ rimasti in giro.

### Le etichette che dicevano «corso» dentro uno zaino
La lente («Cerca nel corso…» anche quando cerca fra i documenti), il rimando orfano («non è fra i
materiali del corso»), il 📎 dell'editor («Cita un materiale del corso»), l'aria-label della tendina del
quaderno. `ricercaEtichette()` sta in un posto solo e la chiama `modoAggiorna()`, che è il punto da cui
passa ogni cambio di modalità.
⚠️ Va chiamata **anche a `DOMContentLoaded`**: `#searchPop` sta in fondo al documento, e il primo
`modoAggiorna()` del disegno iniziale non lo trova ancora.

### I titoli di un appunto hanno la misura che si scrive
Nell'editor «# sole» era alto 44px, nell'anteprima 24: scrivere e rileggere sembravano due documenti.
Due difetti sotto, e il secondo peggiore del primo: la **scala** (due tabelle diverse, una fissa e una
elastica) e i **livelli** (`mdToHtml` spostava di due e schiacciava a h6, quindi «####», «#####» e
«######» uscivano identici — tre livelli scritti diversi, resi uguali).
Adesso: una scala sola in sei variabili (`--tit-1`…`--tit-6`) letta **sia** da `.cm-header-N` **sia**
dall'anteprima, e in un appunto i sei livelli restano sei (`#` = h1). Nei capitoli lo spostamento resta:
là la pagina ha già il suo h1 e `mappa/genera.js` conta sulla relatività. La discriminante c'era già ed
è `aCapo`, la stessa che distingue un testo scritto a mano.
⚠️ Dove un appunto è reso DENTRO qualcos'altro (riquadri, «I miei appunti», tabella della guida) servono
le regole per tutti e sei i livelli, o l'h1 dell'appunto eredita quello della pagina: 44px, MAIUSCOLO.
⚠️ La prova non fissa numeri — cambierebbero con la finestra: pretende che le due scale **coincidano** e
che nessun livello resti senza misura (due elenchi vuoti sono uguali: sarebbe un verde che non prova
niente, ed è successo davvero mentre la scrivevo).

---

## 3. Una trappola pagata nelle prove

**Due**, tutte e due nelle prove nuove.

`prova-note.js` ha fatto fallire **nove prove dopo di lei**: la sezione nuova cambiava modalità
(`cambiaModo('zaino')`) e non la rimetteva a posto. Le prove girano contro la stessa istanza, una dopo
l'altra, e quella che esce lasciando l'app da un'altra parte le fa cadere con errori che non c'entrano
(«la barra flottante non compare», «nei Ritagli non ce n'è nessuna»). Rimedio: la scala dei titoli non
dipende dalla modalità, quindi la prova non la tocca più — e richiude l'editor che ha aperto.
Nella stessa sezione, un secondo inciampo: l'appunto di prova era salvato in `corsoAttivo()` mentre
l'editor legge da `curMeta().courseId`, e questa prova apre un capitolo cercandolo **anche negli altri
corsi del vault**: i due possono essere due contenitori diversi, e `noteOpen` rispondeva «Appunto non
trovato».

`prova-wikilink.js` è diventata rossa per una misura, non per una regola: contava le voci dell'indice con
`SEARCH.docs.map(d=>d.lessonId)` e le voci senza lezione — gli appunti — risultavano «una variante fuori
percorso» che si chiamava `undefined`. La regola («niente capitoli di varianti fuori percorso») valeva
ancora. Adesso la prova filtra i capitoli (`!d.appunto && !d.materiale`) **e dichiara il fatto nuovo**:
«gli appunti del corso sono nell'indice», col conto vero letto dal disco. Una prova che si adatta senza
dire che cosa è cambiato è una prova che smette di sorvegliare.

---

## 4. Che cosa viene dopo — «rinominare una fonte» (proposta, non fatta)

La domanda di Giacomo: un modale che cambia il nome della fonte **tenendo il numero** dell'upload, e la
sincronizzazione del nome dentro le citazioni già scritte negli appunti. Si può fare, e il numero si
tiene senza sforzo (è il prefisso `NN `, e i rimandi citano quello). La parte vera è **il corteo**: il
nome del file è citato per esteso in sei posti, tutti già enumerati da `fonti.usi()` —

| dove | campo | che cosa succede se lo si dimentica |
|---|---|---|
| `APPUNTI/_evidenze.json` | `materiale` | le evidenze smettono di dipingersi, in silenzio |
| `ALBUM/_album.json` | `materiale` | i ritagli perdono «Alla fonte» e la provenienza |
| `MATERIALI/Indici-PDF/<stem>.json` | nome del file **e** campo `pdf` | la lente perde il documento |
| `_lettura.json` | chiave | il segno di lettura riparte da pagina 1 |
| `MATERIALI/_rimossi.json` | `nome` | la lapide non riaggancia più |
| `MAPPE/*.json` | `rimando.file` dei nodi | «Vai alla fonte» non apre niente |

I rimandi `pdf:NN#p=7` **non** vanno toccati: puntano al numero, che non cambia. Il testo dell'etichetta
(`[Sistema solare, p. 3](pdf:01#p=3)`) invece è prosa dell'utente, e va trattato come tale: si riscrive
**solo** l'etichetta ancora identica alla forma generata dall'app, si lascia stare quella che l'utente ha
riscritto, e si dice quante ne sono state cambiate e quante lasciate. La forma: una funzione sola in
`lib/fonti.js` che torna un rapporto, il rapporto mostrato nella conferma **prima** di agire (come fa già
`fonteElimina` con «Ci si appoggiano: …»), e il rifiuto se un file è illeggibile — «non lo so» non è «no».

Le altre cose ancora aperte restano quelle del §4 del [14 agosto](HANDOFF-DEFINITIVO-2026-08-14.md).

---

## 5. Prima del merge: che cosa c'è e che cosa manca

Le quattro condizioni (GUIDA-ARCHITETTO §7.2):

| condizione | stato |
|---|---|
| le due suite verdi | ✅ 37 unità · 45 CDP, sul codice committato |
| i gesti provati a mano da Giacomo | ✅ per `d391a50` — «tutti i gesti li ho provati e funzionano» · ⚠️ **restano da provare quelli di `3bb8f6c`** (i titoli) |
| piani e handoff aggiornati | ✅ PIANO-ZAINO §Z9, PIANO-BRAYNR §0-quater, GUIDA-ARCHITETTO (mappa + conto), questo file, e la guida illustrata |
| `main` non si è mossa | ✅ ferma a `b005214` |

**I gesti che restano** (dieci minuti, in un appunto qualunque):

1. Scrivi `#` … `######` su sei righe e guarda l'anteprima **▣**: sette misure distinte, uguali a
   quelle che vedi mentre scrivi. Poi allarga la finestra: devono crescere insieme.
2. La stessa cosa in affiancata **◫**.
3. Un titolo dentro un riquadro (`> [!nota]` e sotto `> # titolo`): grande come nell'editor, ma dentro
   il suo box.
4. **🖨 Stampa** un appunto con i titoli: sulla carta la scala è in punti e resta piccola — è giusto.

Se sono verdi: `git checkout main && git merge zaino-ricerca-rinomina` — e ⚠️ **la suite intera si
riesegue sul codice unito**, che non è mai girato prima (GUIDA-ARCHITETTO §7.2d).

---

## 6. Il laboratorio degli screenshot (serve se si tocca l'interfaccia)

`../StudIA - tutorial ZAINO/_lab/` — `lab.js` pilota l'app viva via CDP e scatta: puntatore
evidenziato, cornici, numeri cerchiati, ritagli, tendine e `confirm()` nativi «ridisegnati» col testo
vero. `campagna.js` rifà tutte le 93 immagini della guida in un colpo, su un vault di prova vuoto,
finestra **1470×956 @2x** (il MacBook Air 13" a schermo intero: è la misura che Giacomo ha chiesto).
La ricetta e le trappole stanno in `_lab/README.md` e nella skill `guida-app-screenshot`.

⚠️ Il laboratorio usa la porta **9345** e una cartella dati sua: non tocca né il vault vero né la
config. Se resta un'istanza orfana, `pgrep -f "remote-debugging-port=9345"` e `kill`.
