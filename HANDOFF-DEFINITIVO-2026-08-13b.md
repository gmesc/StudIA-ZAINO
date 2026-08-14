# Handoff definitivo — 13 agosto 2026, secondo giro

> ⚠️ **Non è più il punto d'ingresso**: lo è [HANDOFF-DEFINITIVO-2026-08-14.md](HANDOFF-DEFINITIVO-2026-08-14.md).
> Questo file resta la lettura di DETTAGLIO sui tre difetti del 13-14 e sulle loro trappole.

> **A chi arriva adesso: questo file basta per ripartire.** Racconta il giro pomeridiano e i tre
> difetti che ha chiuso, tutti arrivati dalle prove a mano di Giacomo: il banco che «non teneva»
> la disposizione, la mappa TUA che riaprendo tornava generata, e TD/SX — che erano spenti
> apposta (motore ad anelli) senza dirlo a nessuno.
> Sostituisce [HANDOFF-DEFINITIVO-2026-08-13.md](HANDOFF-DEFINITIVO-2026-08-13.md), che resta
> valido per tutto ciò che qui non si nomina (OCR, unione con banco/zaini, mappa che non si
> rimpicciolisce più).
>
> **Regola di lettura**: dove c'è ⚠️ c'è un guasto già pagato, col rimedio accanto.

---

## 1. Dove sono i lavori

| ramo | commit | suite | manca |
|---|---|---|---|
| `main` | `e40520c` | ✅ 27 file di unità · **34 prove CDP** | niente: **il merge è fatto** (14 agosto) |
| `mappa-limiti` · `deskew-ocr` | uniti in `main` | — | si possono cancellare quando si vuole |

**Merge fatto il 14 agosto**, in fast-forward: `main` non si era mossa da `3419ae7`, quindi il
codice unito è **esattamente** quello su cui sono girate le suite — non c'era niente di nuovo da
rieseguire. Le quattro condizioni erano tutte verdi: suite ✅, gesti provati a mano da Giacomo
(banco, mappa, TD/SX **e OCR**) ✅, piani e handoff aggiornati ✅, `main` ferma ✅.
Con questo entrano in `main` anche l'OCR dello zaino e la mappa che non si rimpicciolisce più,
che erano rimasti fuori dal 13.

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

## 2-bis. ⚠️ Il seguito, dalla prova di Giacomo: QUALE mappa (`381697a`)

Rimesso a posto il banco, il difetto è venuto fuori di sotto: **il riquadro tornava a tutto
banco, ma dentro c'era la mappa GENERATA** anche a chi aveva lasciato a schermo una mappa sua.
Il banco ricordava il riquadro; la mappa dentro no. `MAPPA.mia.file` bastava a ritrovarla dentro
la sessione (`mappaApri` la riapre), ma viveva **in memoria**, e un riavvio la portava via.

Ora il segno di QUALE mappa sta in `studia.aperto`, accanto a fonte, media e appunto — il posto
che risponde già a «che cosa era aperto in questo contenitore». Le leve della vista restano dove
erano (per corso, in `mappaChiave()`): dicono **come** la guardavi, questo dice **quale**.
Forma breve, come i vicini che sono stringhe: `mie:<file>` · `mie` · `gen:<ambito>`.

⚠️ **Lo scrive solo chi sceglie** — `mappaApriMia`, il cambio registro, il cambio ambito — e
**mai `mappaApri`**: entrare in scena non è scegliere, e scrivere da lì vorrebbe dire che il
banco, montando la mappa all'avvio, sovrascrive il segno prima ancora che il ripristino lo legga.
È il guasto del §2 in un'altra veste, evitato prima di pagarlo.

⚠️ Corretta anche la guardia d'ingresso di `apertoRipristina`: usciva se non c'erano né fonte né
media, quindi da quando il segno porta anche **l'appunto** (e adesso la mappa) c'era un
ripristino che per loro non partiva mai.

⚠️ **Due prove ripulite, ed è il difetto stesso a chiederlo**: `prova-menu` portava il registro
su «Mie» creando una mappa dal frammento e toglieva il file **senza rimettere lo scaffale** —
con la memoria nuova quello stato sopravvive al reload, e `prova-mappe-ui` (che misura la tendina
della generata) andava rossa su tre controlli. Ora `prova-menu` lascia anche l'app come l'ha
trovata, e `prova-mappe-ui` mette `studia.aperto` fra le chiavi dello «stato di fabbrica» che
azzera. **Una memoria nuova rende visibili le prove che sporcano**: è il prezzo, ed è giusto.

Misurato con riavvii veri: mappa tua → riavvio → registro «mie», stesso file, i suoi nodi a
schermo; generata con ambito «corso» → riavvio → generata su «corso».

---

## 3. TD/SX: chiuso — erano spenti, e non lo dicevano (`e5cfb87`)

**La risposta vera**, trovata leggendo la mappa di Giacomo invece di ipotizzare: la sua mappa è
salvata sul motore **anelli**, dove il verso è spento **apposta** — gli anelli si dispongono
attorno a un centro, non lungo una direzione.

⚠️ Il difetto non era la regola: era il **silenzio**. Sulle mappe tue i quattro motori escono
dalla barra (al loro posto ci sono le memorie), quindi non si vede nemmeno **quale** motore è
attivo; e un bottone `disabled` non emette il click, quindi non può spiegarsi. Il suggerimento
c'era, ma sta sotto il puntatore — e chi preme un tasto che non fa niente non passa il mouse
sopra: riprova.

Adesso i due tasti sono spenti con `aria-disabled` (stessa veste, ma il click arriva) e premerli
**risponde**: perché non hanno un verso, e **dove** si cambia motore — tasto destro sulla tela.
Il rifiuto sta dentro `mappaOrientamento`, non nel gestore del click, così vale da qualunque
porta arrivi. Prova: sezione nuova in `prova-mappa-trascina.js`.

Misurato sulla mappa VERA di Giacomo, copiata nel vault di prova: motore anelli, tasto a
opacità .6, clic → messaggio, verso invariato; cambiato motore in albero, il verso funziona e i
nodi si ridispongono.

**Aperto, ed è una decisione sua**: su una mappa tua il motore attivo resta invisibile finché non
si apre il menu della tela. Un'etichetta in barra («Anelli») lo direbbe, ma rimetterebbe in
barra ciò che era stato tolto di proposito.

### Il contorno: sul codice di oggi il verso funziona — misurato tre volte

Era il punto §5 dell'handoff precedente («Giacomo dice che nell'app non funzionano»). Sul ramo
`mappa-limiti`, nell'app viva:

- **mappa generata**: clic vero sul bottone SX → le card si ridispongono (da `262,474 …` a
  `752,133 …`), `aria-pressed` si sposta;
- **i quattro motori**: albero · dag · percorso cambiano tutti disegno col verso;
- **mappa tua** (`prova-mappa-trascina.js`, sezione «Il VERSO cambia davvero»): verso cambiato,
  posizioni a mano azzerate e dichiarate, disegno ridisposto, ⌘Z che le rimette.

⚠️ E qui la lezione di metodo: tre misure verdi dicevano «funziona», e l'utente diceva di no.
**Avevano ragione tutti e due** — le mie prove giravano su mappe con motore *albero*, la sua è
sugli anelli. Finché non ho aperto il SUO file (`Zaini/…/MAPPE/*.json`, campo `vista.motore`) ho
inseguito ipotesi (app stantia, barra stretta) tutte plausibili e tutte false. **Quando una
misura e l'utente si contraddicono, il dato dell'utente è un file: aprilo.**

⚠️ E una nota che era rimasta aperta ieri, ora chiusa in senso opposto: chiamando
`mappaOrientamento` a mano sugli anelli il disegno *cambiava lo stesso* (le card ruotano
`along`/`across`, quindi i raggi respirano). Non è un verso, è un effetto collaterale: adesso il
rifiuto è esplicito, e quella strada non esiste più.

---

## 4. Che cosa fare, in ordine

1. ✅ **Fatta da Giacomo (14 agosto)** — banco a tutto schermo e mappa: riaprendo l'app la
   disposizione e la mappa tua tornano com'erano.
2. ✅ **Fatta da Giacomo (14 agosto)** — TD/SX: sugli anelli dicono perché non si muovono,
   cambiato motore ridispongono.
3. ✅ **Fatta da Giacomo (14 agosto)** — l'OCR sul documento vero: funziona.
4. ✅ **Merge fatto (14 agosto)**, fast-forward su `main` (vedi §1). ⚠️ Al prossimo lavoro la
   condizione (d) — `main` ferma — va **riverificata al momento**: una sessione parallela l'ha
   già mossa una volta.

**Che cosa resta aperto**, per chi riprende: l'etichetta del motore sulle mappe tue (§3, decisione
di Giacomo) e il punto 2 del piano mappa — il limite all'area visibile — che resta in
`PIANO-MAPPE-EDITOR.md` come rete, da scrivere solo se si riesce ancora a perdere un nodo.

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
- **Una memoria nuova rende visibili le prove che sporcano**: appena l'app ha ricordato quale
  mappa guardavi, `prova-menu` — che il registro lo cambiava e non lo rimetteva — ha fatto cadere
  `prova-mappe-ui`. Non era un guasto dell'app: era una prova che lasciava lo stato addosso alla
  prossima, e prima nessuno se ne accorgeva perché il reload cancellava le tracce.
- **Un comando spento che non può parlare**: `disabled` non emette il click, quindi un comando
  che ha una *ragione* per non fare niente va spento con `aria-disabled` — la veste è la stessa,
  ma il click arriva e la ragione si può dire. Il `title` non basta: chi preme un tasto morto non
  ci passa sopra col mouse, riprova.
- **Quando una misura e l'utente si contraddicono, apri il suo file**: tre prove verdi contro
  «non funziona» — la differenza era un campo (`vista.motore`) dentro la sua mappa.
- **Chi ricorda deve dire chi scrive**: il segno di ciò che era aperto lo scrive solo un gesto.
  Se lo scrivesse anche chi *ripristina* o chi *monta*, il ripristino successivo troverebbe il
  proprio riflesso invece della scelta dell'utente. Vale per il banco e per la mappa, ed è la
  stessa frase due volte.
