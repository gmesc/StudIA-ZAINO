# Handoff definitivo — 16 agosto 2026, sera

> **A chi arriva adesso: questo file basta per ripartire.** Sostituisce
> [HANDOFF-DEFINITIVO-2026-08-16.md](HANDOFF-DEFINITIVO-2026-08-16.md), che resta la lettura di
> dettaglio su pacchetti, installer Windows e primo avvio.
>
> **Come si costruisce qui** lo dice [GUIDA-ARCHITETTO.md](GUIDA-ARCHITETTO.md).
> **Regola di lettura**: dove c'è ⚠️ c'è un guasto già pagato, col rimedio accanto.

---

## 1. Dove sono i lavori

| | |
|---|---|
| rami | quattro, in fila: `pacchetto` → `selmenu-closepops` → `installer-windows` → **`zaino-ricerca-rinomina`** (oggi). L'ultimo contiene tutti: unendo quello entra tutto in un colpo |
| commit | `zaino-ricerca-rinomina` alla testa · `main` ferma a `b005214` |
| suite | ✅ **37** file di unità · ✅ **45** prove CDP sull'app viva |
| fuori dal repo | `../StudIA - tutorial ZAINO/` — la guida illustrata della modalità ZAINO (99 immagini scattate sull'app viva, aggiornata oggi con le cose nuove) |

```bash
cd "/Users/giacomomeschini/Claude/StudIA/StudIA"
npm test                                                   # 37 file, exit 0
STUDIA_PORTA=9346 ./test/cdp/con-vault-di-prova.sh         # 45 prove sull'app viva
```

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

---

## 3. Una trappola pagata nelle prove

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
