# Handoff definitivo — 15 agosto 2026, sera

> **A chi arriva adesso: questo file basta per ripartire.** Dice dov'è il codice, che cosa è appena
> entrato, che cosa resta aperto e in che ordine — e le trappole fresche, che sono la parte utile.
>
> Sostituisce [HANDOFF-DEFINITIVO-2026-08-14b.md](HANDOFF-DEFINITIVO-2026-08-14b.md), che resta la
> lettura di dettaglio su zoom della fonte, forbici con ⌘ e Album Foto. Il **§4 del
> [14 agosto](HANDOFF-DEFINITIVO-2026-08-14.md)** — le quattro cose che contano prima del beta — è
> ancora la lista giusta, e il pacchetto è ancora la prima.
>
> **Come si costruisce qui** lo dice [GUIDA-ARCHITETTO.md](GUIDA-ARCHITETTO.md), aggiornata oggi.
> **Regola di lettura**: dove c'è ⚠️ c'è un guasto già pagato, col rimedio accanto.

---

## 1. Dove sono i lavori

| | |
|---|---|
| ramo | `main` — **nessun ramo aperto** |
| commit | `1a28484` (15 agosto sera) |
| remoto | **`git@github.com:gmesc/StudIA.git`** (privato), `main` tracciante e allineata |
| suite | ✅ **34** file di unità · **43** prove CDP, con l'eccezione qui sotto |

```bash
cd "/Users/giacomomeschini/Claude/StudIA/StudIA"
npm test                                              # 34 file, exit 0
STUDIA_PORTA=9334 ./test/cdp/con-vault-di-prova.sh    # 43 prove sull'app viva
npm start                                             # l'app
```

⚠️ **`prova-testolayer` è rossa a corse alterne**, e lo è **anche su `main` pulita**: verificato
tornando indietro col `git stash`. I sintomi cambiano da una corsa all'altra (una volta il
trascinamento non seleziona niente, un'altra seleziona ma il testo non combacia con la pagina), la
prova è invariata dall'11 agosto e la porta 9333/9334 era libera. È **ambientale o preesistente,
non una regressione**: va capito, ma non ferma niente.

⚠️ **Il remoto è nuovo (15 agosto)**: i **tag non sono saliti** (`git push --tags` se li vuoi), e i
rami di lavoro salgono solo se lo si chiede. La chiave SSH è quella che c'era già
(`~/.ssh/github_mappai`, account `gmesc`): una chiave vale per **macchina + account**, non per
repository, e non ne serviva una nuova.

⚠️ **`main` si è mossa due volte oggi sotto una sessione parallela.** La condizione «`main` ferma»
si verifica **al momento del merge**, non si ricorda: una volta è costata un rebase con due
conflitti — due ELENCHI, la catena di `npm test` e `PROVE=(` — e la rilettura di tutte le suite sul
codice unito, che non era mai girato prima.

---

## 2. Che cosa è entrato oggi

Quattro giri, tutti chiusi e uniti. Il dettaglio nei piani; qui la sostanza e le trappole.

### Le immagini dell'utente — F1 · F2 · F2-bis → [PIANO-FOTO.md](PIANO-FOTO.md)
In uno zaino si trascinano dentro immagini (`.jpg .png .gif .webp .heic`), che entrano in `ALBUM/`
con la loro miniatura. **Un archivio solo, due viste**: «Ritagli» (i crop, anche dai fermi immagine)
e «Album Foto» (le importate), filtrate da `origine`. Un'immagine si apre nel **visualizzatore** —
seconda faccia dello stesso riquadro — con la grammatica di zoom delle fonti e ⌘ per ritagliare.
Mettendola in un appunto o in una mappa entra **intera**, e una bolla offre «solo una parte…»: il
ritaglio **prende il posto** dell'intera.

⚠️ Le tre trappole che valgono oltre il caso: l'**orientamento EXIF**, che `<img>` applica e un
canvas no (un ritaglio fatto dopo prenderebbe l'area ruotata di 90°); la **miniatura**, che non è un
vezzo (una foto da 12 MP dentro una card da 104px è una decodifica intera per un francobollo); e
`scrollbar-gutter:stable`, perché adattare alla larghezza fa comparire la barra che cambia la
larghezza che rifà la scala che fa sparire la barra.

### I testi che diventano appunti — F1-bis → [PIANO-ZAINO §Z5-bis](PIANO-ZAINO.md)
`.md`, `.markdown`, `.txt` trascinati in uno zaino diventano appunti. Titolo cercato in tre posti;
il frontmatter di un altro programma **non sparisce** (le chiavi che la lista bianca di
`lib/appunti.js` mangerebbe restano nel corpo, in un blocco `yaml`); wikilink e immagini relative si
**dichiarano**. Oltre i 2 MB si rimanda alle fonti: «quella è un'altra strada».

### Il banco a 3×3 e il pittore — B1 → [PIANO-BANCO §2.0](PIANO-BANCO.md)
Nove blocchi, dodici forme (quattro nuove a tre colonne, per gli schermi larghi), fino a quattro
divisori, e l'utente può **disegnare** le sue forme su una griglia 3×3 (casella «+» nel selettore).

⚠️ Tarature **separate** fra due e tre colonne — una frazione scelta con due colonne, portata su
tre, faceva la prima doppia delle altre; ⚠️ il pittore non fa nascere blocchi a L; ⚠️ tutta la
geometria (griglia, divisori veri, bordi) si **legge dalle aree**.

### Il Confronto — due fonti affiancate
Strumento nuovo (`fonte2`), con un pdf.js **tutto suo**: documento, pagina, zoom e memoria separati.
È **dichiaratamente più semplice** e lo dice: si legge, si zooma, si copia — evidenze, ritagli e
«appunta» stanno nella Fonte, e la selezione lì **non apre menu** apposta, perché citerebbe il
documento sbagliato.

⚠️ **Il guasto che ha insegnato di più**: 266 pagine nel DOM, nessun canvas, nessun errore. Il CSS
del viewer è incapsulato sotto un selettore (`bin/pdfjs-css.js`), e dentro il secondo riquadro le
pagine erano ad **altezza zero**, quindi `_getVisiblePages()` vuota e rendering mai chiesto. Ora il
guscio è `:is(#pdfPane, #pdfPane2)`: **un terzo riquadro col viewer si aggiunge LÌ**.

---

## 3. ⚠️ Le tre trappole di processo pagate oggi

1. **Un elenco che sembra dire «tutto» e dice «questi».** Tre volte in un giorno: `closePops()` non
   conosceva il pittore (che restava in overlay dopo il salvataggio); `test/atlante.js` non era
   nella catena di `npm test` (la prova esisteva e non girava mai); le regole CSS della `.pdfbar`
   erano ancorate a `#pdfPane` (la barra del Confronto usciva fuori misura). **Chi aggiunge una cosa
   la aggiunge nell'elenco che la esegue** — e gli elenchi sono più di uno.
2. **La suite intera al cancelletto, non a ogni passo.** Durante il lavoro si lanciano le prove che
   si toccano (quaranta secondi invece di sei minuti); la suite intera prima di dichiarare finito,
   prima di un merge, e dopo un rebase.
3. **Guardare su che ramo si è, prima di committare.** Tre commit sono partiti su `main` e sono
   stati spostati su un ramo con `git branch` + `reset --hard`.

E la regola di sempre, che oggi ha pagato quattro volte: **i gesti provati a mano da Giacomo trovano
quello che le suite verdi non vedono** — il «timbro» di pdf.js sulle immagini trascinate, il rifiuto
che negli zaini parlava di lezioni, il `⤢` che sulle immagini non cambiava niente, il pittore che
restava aperto.

---

## 4. Che cosa resta aperto, in ordine

### 1. Il pacchetto — la prima cosa
`dist/StudIA-1.0.0-arm64.dmg` è del **23 luglio**: quasi un mese di lavoro non ci sta dentro, e la
build **non è mai stata provata con questo codice**. È l'unica cosa che i tester eseguono davvero.
`npm run dist:mac`, poi la firma ad-hoc a mano, `asar:false`, pyenv, cache Tesseract, percorsi del
vault fuori dal repo. Il beta è **fra otto giorni**.

### 2. F3 — gli usi e le lapidi delle immagini → [PIANO-FOTO §3](PIANO-FOTO.md)
Chiesto esplicitamente da Giacomo, in coda a B1 e al Confronto. Tre regole già decise:
- **il click su un'immagine usata in più posti** non segue una regola cablata ma **chiede
  all'indice degli usi** (`album.usi`, che esiste già): un uso → ci si va; più usi → si sceglie da un
  elenco; nessun uso → la sua scheda. Così non cambia niente quando gli usi diventano dieci;
- **cancellare una foto che ha ritagli figli** è permesso, e i figli sopravvivono **dicendo** che la
  fonte non c'è più — la regola delle lapidi (`MATERIALI/_rimossi.json`), non il silenzio;
- **il ritaglio di un ritaglio** si ancora sempre all'immagine originale, componendo i rettangoli:
  una catena renderebbe orfano il figlio quando si cancella l'anello di mezzo.

### 3. `prova-testolayer` — il rosso a corse alterne
Capire se è flake d'ambiente o un guasto vero del layer di testo (§1).

### 4. B2 vero — il multi-istanza
Due Fonti **complete** e due Appunti, con lo «strumento attivo»: la regola approvata da Giacomo è
**«l'ultimo riquadro toccato è quello che riceve»**. Va dopo lo smontaggio degli stati (M4–M9 di
[PIANO-MODULI](PIANO-MODULI.md)): rendere multi-istanza uno strumento È far ricevere alle funzioni
il proprio stato invece di leggere un globale, cioè quel lavoro lì. Misurato il 15 agosto: `MAPPA.`
493 usi, `NOTES.` 187, `PDFJS.` 92, `ANTEPRIMA.` 67, più 142 riferimenti nelle prove CDP. Il
Confronto di oggi è il passo uno, dichiaratamente asimmetrico.

### 5. Il resto, invariato
Il motore invisibile sulle mappe tue, il limite del nodo all'area visibile, M4–M9, le pillole delle
Lenti. E due idee messe da parte **con la loro ragione**: il **lettore di testo** come fonte (fuori
lista — la regola di Giacomo «testo lungo → lo converto in PDF, testo breve → è un appunto» lo
lascia senza mestiere) e i **`.docx`** via `textutil`, dichiaratamente lossy, semmai come
import→appunto.

---

## 5. Come si lavora qui (il minimo per non sbagliare)

Il resto sta in [GUIDA-ARCHITETTO.md](GUIDA-ARCHITETTO.md), che è la fonte su *come si costruisce*.

1. **Ramo per ogni lavoro** (`git switch -c <nome>`), commit con la prosa che spiega il *perché* e
   le ⚠️ pagate.
2. **Le prove misurano, non guardano**: prove mirate durante il lavoro, suite intere al cancelletto,
   e poi una lista corta di gesti che Giacomo prova di persona.
3. **Il merge si dichiara**: suite verdi · gesti provati · piani e handoff aggiornati · `main` ferma
   **riverificata al momento**.
4. **A fine sessione un handoff datato** che rimpiazza questo, e i `PIANO-*` aggiornati se il lavoro
   li tocca.
