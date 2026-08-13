# Handoff definitivo — 13 agosto 2026, secondo giro

> **A chi arriva adesso: questo file basta per ripartire.** Racconta il giro pomeridiano: il
> banco che «non teneva» la disposizione (guasto vero, trovato e chiuso) e TD/SX, che il codice
> di oggi fa funzionare — misurato tre volte sull'app viva.
> Sostituisce [HANDOFF-DEFINITIVO-2026-08-13.md](HANDOFF-DEFINITIVO-2026-08-13.md), che resta
> valido per tutto ciò che qui non si nomina (OCR, unione con banco/zaini, mappa che non si
> rimpicciolisce più).
>
> **Regola di lettura**: dove c'è ⚠️ c'è un guasto già pagato, col rimedio accanto.

---

## 1. Dove sono i lavori

| ramo | commit | suite | manca |
|---|---|---|---|
| `main` | `3419ae7` | ⚠️ 3 prove rosse (riparate su `deskew-ocr`) | è indietro: né OCR né mappa né questo |
| `mappa-limiti` | `6262945` | ✅ 27 file di unità · **34 prove CDP** | la prova a mano di Giacomo (§4) |

`mappa-limiti` contiene `deskew-ocr` e il merge di `main`: unendo lei si porta dentro tutto.

```bash
cd "/Users/giacomomeschini/Claude/StudIA/StudIA"
npm test                                              # 27 file, exit 0
STUDIA_PORTA=9334 ./test/cdp/con-vault-di-prova.sh    # 34 prove, tutte verdi
```

---

## 2. ⚠️ Il banco che «non teneva la disposizione» — trovato e chiuso (`6262945`)

**Il sintomo, com'è arrivato**: «ho chiuso l'app con la mappa a banco pieno e quando la riapro
compare la vista precedente, il banco in tre split; ho provato a cambiare la composizione del
banco e la pagina della fonte — il banco non tiene, la fonte sì».

**La diagnosi che viene in mente è falsa**, ed è la parte istruttiva. «Il banco non salva» era
sbagliato: salvava benissimo — misurato, `localStorage` scritto a ogni comando, e il valore
sopravviveva al riavvio del processo. È proprio perché salvava che il danno restava.

**La causa vera**: `apertoRipristina` riapre ciò che era aperto chiamando `openPdf`,
`playerApri` e `noteOpen`; ognuna di loro chiama `bancoMostra`. Non trovando il proprio
strumento a schermo, `bancoMostra` fa **crescere la forma** per fargli posto — e `bancoAssegna`
la **salva**. Chiudendo con la mappa a tutto banco e tre cose aperte, all'avvio il banco cresceva
di un riquadro per ciascuna: «tre split», con la disposizione scelta già sovrascritta sul disco.
La pagina del documento invece tornava giusta perché **sta nel vault, e nessuno la riscriveva**:
i due sintomi insieme puntavano al posto sbagliato.

**Il rimedio è una distinzione, non una toppa**: un gesto e un ripristino passavano dalla stessa
porta senza distinguersi. Ora `APERTO.ripristinando` è alzata per i pochi millisecondi (tutti
sincroni, di proposito) in cui si riaprono documento, media e appunto, e in quel tratto
`bancoMostra` non fa posto a nessuno. Il contenuto torna lo stesso — segno, pagina, secondo — e
**compare appena il suo strumento rientra nel banco**: uno strumento fuori dal banco non è chiuso.

**Misurato sull'app viva, con riavvii veri del processo** (non `location.reload()`): prima
«uno» + una fonte tornava «due-col» e la chiave sul disco era già riscritta; adesso «uno» resta
«uno» e la chiave è intatta, e mettendo le Fonti in un blocco il documento si disegna alla sua
pagina.

⚠️ **La conferma sui dati veri di Giacomo**: nel suo profilo `Local Storage` si legge la storia
del difetto — scritture che si alternano `uno` ↔ `tre-sx` sullo stesso contenitore. È il ciclo
«tu ingrandisci, l'avvio ti riapre in tre».

**La prova**: `test/cdp/prova-banco-ripristino.js`, dentro `PROVE=(` (34, contate). Passa dal boot
vero e **va rossa su tre controlli** se si toglie la guardia — provato togliendola davvero.
⚠️ Si porta la fonte dentro il contenitore con `fonti.importa` e la rimette via alla fine: il
ripristino controlla il segno contro `corpus.list(corso)`, e la copia magra del vault non ha
`MATERIALI/` — con una fonte del vault globale la prova sarebbe verde **senza aver misurato
niente**.

---

## 3. TD/SX: il codice di oggi funziona — misurato tre volte

Era il punto §5 dell'handoff precedente («Giacomo dice che nell'app non funzionano»). Sul ramo
`mappa-limiti`, nell'app viva:

- **mappa generata**: clic vero sul bottone SX → le card si ridispongono (da `262,474 …` a
  `752,133 …`), `aria-pressed` si sposta;
- **i quattro motori**: albero · dag · percorso cambiano tutti disegno col verso;
- **mappa tua** (`prova-mappa-trascina.js`, sezione «Il VERSO cambia davvero»): verso cambiato,
  posizioni a mano azzerate e dichiarate, disegno ridisposto, ⌘Z che le rimette.

Quindi resta in piedi l'ipotesi 1 dell'handoff precedente: **l'app di Giacomo era partita prima
del commit** `dcb5765` (Electron legge i file all'avvio). Adesso non c'è nessuna istanza sua in
esecuzione: al prossimo avvio prenderà sia quel commit sia questo. Se dopo il riavvio TD/SX non
si muovono ancora, le due cose da guardare, in ordine: **quale motore è attivo** (sugli *anelli* i
due tasti sono spenti apposta, e il `title` lo dice) e se la mappa è **tua** o **generata**.

⚠️ **Aperto, e piccolo**: sugli anelli i due tasti sono disabilitati perché «non hanno un verso»,
ma il motore, chiamato a mano, **cambia davvero il disegno** (`td` ≠ `lr`, deterministico). O la
frase è sbagliata o lo è la disabilitazione: è una decisione, non un guasto, e non l'ho toccata.

---

## 4. Che cosa fare, in ordine

1. **La prova a mano del banco** (è l'unica che manca a questo lavoro): apri una fonte, ingrandisci
   un blocco a tutto banco, chiudi l'app, riaprila. Deve tornare **a tutto banco**; scegliendo
   «Fonti» in un blocco, il documento è lì alla sua pagina.
2. **TD/SX**, dopo un avvio nuovo (§3). Se ancora fermi, dire quale motore è attivo.
3. **La prova a mano dell'OCR**, mai completata (§6 dell'handoff precedente): togliere la fonte,
   ritrascinare, riconoscere, e guardare il bordo destro e l'altezza sui filetti.
4. **Il merge**, quando 1-3 sono verdi: `git checkout main && git merge mappa-limiti`.
   ⚠️ La condizione (d) — `main` ferma — va **riverificata**: una sessione parallela l'ha già
   mossa una volta oggi.

---

## 5. Trappole nuove

- **«Non salva» è quasi sempre «qualcun altro riscrive»**: qui il salvataggio funzionava a ogni
  comando, e il dato veniva sovrascritto **dopo**, all'avvio successivo. Prima di cercare il
  salvataggio che manca, guardare chi scrive quella chiave *senza essere stato chiamato da un
  gesto*.
- **Due sintomi insieme sono un indizio**: «il banco no, la fonte sì» diceva già che i due dati
  vivono in posti diversi (uno in `localStorage`, uno nel vault) e che il colpevole stava dalla
  parte di chi li riscrive.
- **`location.reload()` non è un riavvio**: per misurare il ripristino serve un processo nuovo
  (`--user-data-dir` persistente e app rilanciata). Per le prove il reload basta — il guasto è nel
  boot — ma per la diagnosi no.
- **Una prova che non sa andare rossa non prova niente**: la guardia è stata tolta apposta per
  vederla fallire (tre controlli), poi rimessa.
- **La copia magra del vault non ha `MATERIALI/`**: chi prova qualcosa che passa da
  `corpus.list(corso)` deve portarsi dentro il materiale da sé, o misura un ramo che non gira.
