# Handoff definitivo — 16 agosto 2026

> **A chi arriva adesso: questo file basta per ripartire.** Dice dov'è il codice, che cosa è appena
> entrato, che cosa resta aperto e in che ordine — e le trappole fresche, che sono la parte utile.
>
> Sostituisce [HANDOFF-DEFINITIVO-2026-08-15.md](HANDOFF-DEFINITIVO-2026-08-15.md), che resta la
> lettura di dettaglio su Album Foto, banco 3×3, Confronto. Il **§4 del
> [14 agosto](HANDOFF-DEFINITIVO-2026-08-14.md)** — le quattro cose che contano prima del beta —
> è ancora la lista giusta; la prima, il pacchetto, oggi è fatta.
>
> **Come si costruisce qui** lo dice [GUIDA-ARCHITETTO.md](GUIDA-ARCHITETTO.md), aggiornata oggi al §6.
> **Regola di lettura**: dove c'è ⚠️ c'è un guasto già pagato, col rimedio accanto.

---

## 1. Dove sono i lavori

| | |
|---|---|
| ramo | **`pacchetto`** — due commit, non ancora unito a `main` |
| commit | `b1d87f1` (16 agosto) · `main` ferma a `b005214` |
| remoto | `git@github.com:gmesc/StudIA.git` (privato); il ramo `pacchetto` **non è salito** |
| suite | ✅ **34** file di unità · ✅ **43** prove CDP sul codice · ✅ **43** prove CDP **dentro il pacchetto** |

```bash
cd "/Users/giacomomeschini/Claude/StudIA/StudIA"
npm test                                                   # 34 file, exit 0
STUDIA_PORTA=9346 ./test/cdp/con-vault-di-prova.sh         # 43 prove sull'app viva
STUDIA_PORTA=9346 STUDIA_APP="$PWD/dist/mac-arm64/StudIA.app" \
  ./test/cdp/con-vault-di-prova.sh                         # le stesse 43 DENTRO il pacchetto
npm run pacchetto                                          # bundle + firma + dmg + controprova
```

**Il rosso di `prova-testolayer` non esiste più**: non era ambientale (§3).

---

## 2. Che cosa è entrato oggi

### Il pacchetto — `npm run pacchetto`
`dist/StudIA-1.0.0-arm64.dmg` è di oggi, **195 MB**, e dentro c'è l'app firmata. Ci sono voluti tre
guasti prima di arrivarci, tutti invisibili finché non si guarda la copia giusta:

1. **`npm run dist:mac` non funzionava più.** electron-builder 25 rifiuta la chiave `"//"` che
   teneva il commento dentro `extraResources` (lo schema ammette solo `filter`/`from`/`to`). Il
   perché di quel file — le licenze dei componenti di Chromium, 14 MB, che vanno accompagnate al
   binario — ora sta nel commit, non in un JSON che non ammette commenti.
2. ⚠️ **Il dmg conteneva l'app NON firmata.** `mac.identity: null` fa saltare la firma, e su arm64
   un bundle non sigillato è quello che macOS chiama «danneggiato». Il rimedio noto era firmare a
   mano dopo il build — ma electron-builder il dmg lo ha già fatto **prima**, con dentro la copia
   non firmata. Firmare `dist/mac-arm64/StudIA.app` e spedire quel dmg è il modo più facile di
   credere di aver rimediato senza aver rimediato. `bin/pacchetto-mac.sh` fa i quattro passi in
   fila e chiude con **la controprova che conta**: monta il dmg e verifica la firma dell'app **lì
   dentro**, l'unica copia che il tester eseguirà davvero.
3. **`prompts/**` era ancora nella whitelist `files`** e quella cartella non esiste più. Una voce
   morta non rompe niente e nasconde che nessuno guarda quella lista.

Il pacchetto è stato provato, non solo costruito: l'app estratta dal dmg parte su un vault suo, la
card di primo avvio compare, **zero errori di console**, e le **43 prove CDP girano dentro il
bundle** (`STUDIA_APP=…`, interruttore nuovo del runner). Quindi pdf.js vendorizzato, tesseract,
OCR, album e stampa funzionano *impacchettati*, non solo in cartella.

⚠️ La firma resta **ad-hoc**: `spctl` dirà sempre «rejected» e al primo avvio serve Impostazioni di
Sistema → Privacy e sicurezza → «Apri comunque». Per togliere quel passo servono l'Apple Developer
Program e la notarizzazione — e allora `bin/pacchetto-mac.sh` **si butta, non si adatta**: esiste
solo per compensare `identity: null`.

### `prova-testolayer` — chiuso, e non era il layer
Vedi §3: era la prova, in tre modi diversi.

---

## 3. ⚠️ La caccia che ha insegnato di più

Il rosso «a corse alterne» dell'11–15 agosto era **sistematico dentro la suite e verde da solo**.
Tre corse su tre lo hanno riprodotto appena si è smesso di chiamarlo flake.

Il metodo che l'ha sciolto: **far portare al rosso la sua diagnosi**. «Il testo non sta nella pagina
30» non dice *dove* sta; aggiunto il dump della provenienza, la prima corsa ha risposto
`daPagina: "1"` con `viewerAllaPagina: 30`. Da lì, tre strati:

1. ⚠️ **Il trascinamento finiva fuori dalla finestra.** Il filtro degli span guardava `top` e
   `bottom` e non `left` e `right`: se il riquadro della Fonte è più stretto della pagina, la riga
   esce a destra (misurato: da x=1243 a x=1759, finestra larga 1320). Lì Chrome non trova nessun
   carattere e porta il fuoco all'inizio del contenitore: la selezione diventa **all'indietro**,
   dalla pagina 1 — che nel DOM c'è ancora, sei span, il frontespizio — fino al punto di partenza.
   E siccome `getRangeAt(0)` mette sempre in ordine di documento, il rosso mostrava il frontespizio.
   **Il press era sempre stato giusto**: «caret alla pagina 30, collassato».
2. ⚠️ **Lo zoom era ereditato dalla prova precedente**, non dichiarato. Con una scala alta nessuna
   riga sta dentro la finestra. Ora la prova dichiara `page-width` — e **torna alla pagina 30**,
   perché cambiare scala fa smontare a pdf.js le pagine lontane (senza quel ritorno la prova
   accusava il layer di un'assenza causata da lei).
3. ⚠️ **Il menu della selezione restava aperto sopra il testo.** I doppi click lo aprono e
   `closePops()` **non lo chiude**: `#selMenu` e `#selBarra` non sono nel suo elenco e si chiudono
   con funzioni proprie. `elementFromPoint` sul punto di partenza restituiva `button.ctx-item`.

**Questo terzo strato riguarda anche l'app**, non solo la prova: è la stessa forma del pittore che
restava aperto (15 agosto), e il commento ⚠️ dentro `closePops()` la annuncia da sé. Valutare se
aggiungere `selMenuChiudi()`/`selBarraChiudi()` a quell'elenco — prima verificando chi chiama
`closePops()` e quando, perché chiudere il menu della selezione *mentre l'utente lo sta per usare*
sarebbe un guasto nuovo al posto di uno vecchio.

E la regola di sempre: **una misura che contraddice un esperimento minimo identico va sospettata
prima del codice**. Qui la prova isolata era verde e la suite rossa: la differenza non era il layer,
era ciò che le altre prove lasciavano dietro (zoom, menu, larghezza del riquadro).

---

## 4. Che cosa resta aperto, in ordine

### 1. Unire `pacchetto` a `main`
Le quattro condizioni: (a) le suite sono verdi — anche dentro il bundle; (b) **mancano i gesti
provati a mano** (§5); (c) piani e handoff aggiornati — fatto; (d) `main` ferma, **da riverificare
al momento del merge**, non ricordata.

### 2. F3 — gli usi e le lapidi delle immagini → [PIANO-FOTO §3](PIANO-FOTO.md)
Chiesto esplicitamente da Giacomo, non ancora iniziato. Le tre regole già decise (invariate):
il click su un'immagine usata in più posti **chiede all'indice degli usi** (`album.usi`); cancellare
una foto con ritagli figli è permesso e i figli **dicono** che la fonte non c'è più (regola delle
lapidi); il ritaglio di un ritaglio si ancora **sempre all'immagine originale**, componendo i
rettangoli.

### 3. La notarizzazione
L'unico modo di togliere «Apri comunque» ai tester. Serve l'Apple Developer Program (99 €/anno);
i dettagli operativi stanno in `PIANO-ONBOARDING.md` in fondo. Il beta è **fra sette giorni**.

### 4. B2 vero — il multi-istanza
Invariato: va dopo lo smontaggio degli stati (M4–M9 di [PIANO-MODULI](PIANO-MODULI.md)).

### 5. Il resto, invariato
Il motore invisibile sulle mappe tue, il limite del nodo all'area visibile, M4–M9, le pillole delle
Lenti. E le due idee messe da parte con la loro ragione (lettore di testo come fonte; `.docx` via
`textutil`).

---

## 5. I gesti da provare a mano

Le suite misurano, non guardano — e più di un difetto vero l'ha trovato Giacomo con tutto verde.

1. **Apri il dmg** (`dist/StudIA-1.0.0-arm64.dmg`), trascina StudIA in Applicazioni, aprila:
   la prima volta serve Impostazioni di Sistema → Privacy e sicurezza → «Apri comunque». Non deve
   mai dire «danneggiata».
2. **Nel pacchetto, con il tuo vault vero**: apri una lezione, apri una Fonte PDF, evidenzia,
   ritaglia, apri il Confronto. È l'app che eseguiranno i tester, non quella in cartella.
3. **La pipeline nel pacchetto**: un ingest vero (python + whisper) — è l'unico pezzo che le prove
   CDP non toccano, e nel bundle i percorsi sono altri (`Resources/app/ingest.py`, venv in
   `userData`).
4. **Selezione su PDF**: doppio click su una parola, poi trascina una riga **senza** chiudere il
   menu. Se il menu ti copre il testo che vuoi prendere, è il difetto del §3.3.
