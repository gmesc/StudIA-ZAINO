# Handoff definitivo — 14 agosto 2026

> **A chi arriva adesso: questo file basta per ripartire.** Dice dov'è il codice (tutto in `main`,
> nessun ramo aperto), che cosa è stato chiuso nell'ultimo giro, come stanno i numeri dello
> smontaggio del monolite **misurati oggi**, e che cosa resta aperto — con il beta a dieci giorni
> come contesto di tutte le scelte.
>
> Sostituisce [HANDOFF-DEFINITIVO-2026-08-13b.md](HANDOFF-DEFINITIVO-2026-08-13b.md), che resta la
> lettura di dettaglio sui tre difetti del 13-14 (banco, mappa ricordata, TD/SX) e sulle loro
> trappole. Il 13 e il 12c restano validi per OCR, evidenze, parole chiave, tratto.
>
> **Regola di lettura**: dove c'è ⚠️ c'è un guasto già pagato, col rimedio accanto. È la parte utile.

---

## 1. Dove sono i lavori

| ramo | commit | suite |
|---|---|---|
| `main` | `c0c0ad9` (14 ago, dopo il merge) | ✅ 27 file di unità · 34 prove CDP |

**Non c'è nessun ramo aperto.** Il 14 agosto `mappa-limiti` è entrato in `main` in fast-forward
(`main` non si era mossa, quindi il codice unito è **esattamente** quello su cui erano girate le
suite: niente da rieseguire) e i cinque rami già uniti — `mappa-limiti`, `deskew-ocr`, `ocr-zaino`,
`banco-avvio`, `banco-contenuto` — sono stati cancellati con `-d`. Le loro punte restano nel reflog.

```bash
cd "/Users/giacomomeschini/Claude/StudIA/StudIA"
npm test                                              # 27 file, exit 0
STUDIA_PORTA=9334 ./test/cdp/con-vault-di-prova.sh    # 34 prove sull'app viva
```

⚠️ Il prossimo lavoro parte da un ramo nuovo (`git switch -c <nome>`), e al momento del merge la
condizione «`main` ferma» va **riverificata**: una sessione parallela l'ha già mossa una volta.

---

## 2. Che cosa è stato chiuso nell'ultimo giro (13-14 agosto)

Tre difetti, tutti arrivati dalle prove a mano di Giacomo, tutti confermati da lui dopo il rimedio.
Il dettaglio e le trappole stanno in [13b](HANDOFF-DEFINITIVO-2026-08-13b.md); qui la sostanza:

1. **Il banco non teneva la disposizione.** Riaprire l'app faceva *crescere* il banco: il
   ripristino del contenuto (`openPdf`, `playerApri`, `noteOpen`) chiamava `bancoMostra`, che
   faceva posto allo strumento e **salvava**. ⚠️ Il salvataggio funzionava benissimo: era qualcun
   altro a riscrivere, dopo. Ora `APERTO.ripristinando` distingue un gesto da un ripristino.
2. **Riaprendo tornava la mappa generata**, anche a chi aveva lasciato a schermo una mappa sua: il
   banco ricordava il riquadro, non che cosa c'era dentro. Ora il segno di QUALE mappa
   (`mie:<file>` · `gen:<ambito>`) sta in `studia.aperto`, e **lo scrive solo un gesto**.
3. **TD/SX inerti sulle mappe tue**: erano spenti apposta (motore *anelli*) e non lo dicevano —
   un bottone `disabled` non emette il click, quindi non può spiegarsi. Ora si spengono con
   `aria-disabled` e rispondono, dicendo anche dove si cambia motore.

Prove nuove: `test/cdp/prova-banco-ripristino.js` e la sezione sugli anelli in
`prova-mappa-trascina.js`. Entrambe verificate **anche in rosso**, togliendo il rimedio.

---

## 3. Lo smontaggio del monolite: i numeri di oggi

Misurati il 14 agosto, non ricordati. La tabella viva sta in [PIANO-MODULI §11](PIANO-MODULI.md).

| metrica | inizio | 11 ago | **14 ago** | obiettivo |
|---|---|---|---|---|
| righe di `App/StudIA.html` | 13.072 | 12.866 | **15.503** | < 9.000 |
| logica del renderer provabile in Node | ~0 | 1.138 | **~1.700** | ~2.600 |
| suite di unità | 17 | 21 | **27** ✅ | 26 |

Lavori del piano: **fatti** M1 (parser) · M2 (icone/emoji) · M3 (ricerca) · M6 (rimandi);
**a metà** M4 (TTS); **aperti** M5 album · M7 evidenze · M8 memorie · M9 archi.

⚠️ **Il file è cresciuto di 2.637 righe in tre giorni, e non è un fallimento**: in quei giorni sono
entrate tre feature. Dove sono finite le righe nuove, misurato: **+1.469 in `lib/`** (4 file nuovi,
con le loro prove), **+473 nei moduli `App/assets/`**, **+2.793 nel monolite**. Cioè il **nocciolo
puro di ogni feature è nato fuori** e il **lato pagina è finito dentro** — che è il criterio del
piano, non una deroga. Rapporto osservato: **1 riga pura fuori ogni 6 di pagina dentro**.

**La percentuale, secondo come la si misura**: logica estratta ~65% · lavori M1-M9 ~50% · budget
righe 0% (il numero va indietro finché si aggiungono feature: è previsto, e la riga che conta è la
seconda).

---

## 3-bis. La carta: i PDF di appunti e mappe (`6ed4e66`)

Richiesta di Giacomo: «i PDF hanno bisogno di margini e di un layout migliore — guarda in MappAI
se c'è qualcosa da adattare». Misurato prima di toccare niente, sul PDF vero (reso a 150 dpi,
cercando il riquadro dell'inchiostro — non a occhio):

| misura | prima | adesso |
|---|---|---|
| foglio | **215,9 × 279,4 mm (Letter)** | 210 × 297 (A4) |
| colonna di testo | 188 mm (~110 battute per riga) | **170 mm** (~80) |
| corpo | 10,9 pt | **12 pt** |
| numeri di pagina | nessuno | «pagina 1 di 3», dalla prima |
| mappa coricata | 132 mm di 184, ancorata in alto | **190 mm** |

⚠️ **Il foglio Letter non era una scelta**: `@page` dichiarava solo il margine, e senza `size`
decide Chromium — il cui default è la carta americana. E il `@page mappa` **con nome** non veniva
applicato: la mappa usciva sul foglio verticale del testo.

**Che cosa si è preso da MappAI**: il metodo, non il codice (`mappai-doc-head.js` e il blocco di
stampa di `mappai-doc-bar.js`). Tre lezioni, tutte già pagate là: il piè vive nei **margin-box di
`@page`**, unico posto da cui `counter(page)` funziona — `position:fixed` salta la prima pagina e
il `footerTemplate` esiste solo per i PDF che scrive l'app; i **corpi in punti**, derivati da uno
solo; l'**imbottitura dei riquadri si somma** al margine di `@page` e va azzerata.

Le regole stanno in `App/assets/stampa/foglio.js` (puro, provato in Node) e le scrive
`stampaPrepara()` al momento, per TIPO di foglio. ⚠️ `stampaPrepara` è separata da `stampaFoglio`
apposta: col dialogo di stampa in mezzo il foglio si potrebbe misurare solo a mano, e così ci
passa anche la prova CDP.

**Aperto, e sono due decisioni**:
1. **le citazioni `>` restano letterali** — `mdToHtml` conosce solo i callout (`> [!nota]`), quindi
   un `> testo` finisce in pagina col cancelletto a vista. È un difetto della RESA degli appunti,
   non della carta: si vede anche a schermo;
2. **gli sfondi non si stampano** se chi stampa non accende «grafica di sfondo» nel dialogo (di
   norma è spenta). Il filo a sinistra dei riquadri regge lo stesso. Il rimedio vero è un
   «Salva come PDF» che scriva il file dall'app — MappAI ce l'ha (`html-to-pdf` con
   `printBackground:true`), StudIA no: è un IPC nuovo, e vale la pena solo se il beta lo chiede.

---

## 4. Il beta fra dieci giorni: che cosa conta davvero

Lo scorporo **non è un bloccante**: è manutenzione, e il tester non lo vede. Fino al beta niente
estrazioni dichiarate (vedi PIANO-MODULI §12-bis). Quello che invece va guardato, in ordine:

1. ⚠️ **Il pacchetto.** `dist/StudIA-1.0.0-arm64.dmg` è del **23 luglio**: tre settimane di lavoro
   non ci sono dentro, e la build non è mai stata provata con questo codice. È l'unica cosa che i
   tester eseguono davvero — `asar:false`, pyenv, cache Tesseract, percorsi del vault fuori dal
   repo. `npm run dist:mac`.
2. **Il primo avvio su una macchina che non è la tua**: profilo vergine, nessuna config, nessun
   vault, nessuna chiave API, nessun Python. L'onboarding esiste (PIANO-ONBOARDING, fatto il 26/7)
   ma in quello stato non è stato guardato di recente.
3. **Come ti arrivano i difetti**: dove finiscono log ed errori, e che cosa chiedi al tester di
   mandare.
4. **Un giro dei gesti a mano su un vault che non è il tuo**: le suite girano sul tuo.

---

## 5. Che cosa resta aperto (nessuno di questi è urgente)

- **Il motore invisibile sulle mappe tue** (§3 di 13b): la barra mostra le memorie al posto dei
  motori, quindi non si vede su quale motore è la mappa. Decisione di Giacomo: etichetta in barra
  sì o no.
- **Il limite del nodo all'area visibile** (`PIANO-MAPPE-EDITOR`): rete non scritta, serve solo se
  si riesce ancora a perdere un nodo.
- **M4-M9** dello smontaggio, dopo il beta.
- **Le pillole delle Lenti / il CSS in `<style>`** (PIANO-MODULI §9): lavoro a sé, nessun guadagno
  di prove.

---

## 6. Come si lavora qui (il minimo per non sbagliare)

Il resto sta in [GUIDA-ARCHITETTO.md](GUIDA-ARCHITETTO.md), che è la fonte su *come si costruisce*.
Le tre cose che valgono a ogni sessione:

1. **Ramo per ogni lavoro**, commit con la prosa che spiega il *perché* e le ⚠️ pagate.
2. **Le prove misurano, non guardano**: `npm test` + suite CDP intera, e poi una lista corta di
   gesti da provare a mano — più di un difetto reale è uscito solo da lì (tre, in questo giro).
3. **A fine sessione un HANDOFF datato** che rimpiazza questo come punto d'ingresso, e i PIANO-*
   aggiornati se il lavoro li tocca.

⚠️ Due trappole fresche, che valgono oltre il caso in cui sono nate:
- **«Non salva» è quasi sempre «qualcun altro riscrive»**: cerca chi scrive quella chiave *senza
  essere stato chiamato da un gesto*.
- **Quando una misura e l'utente si contraddicono, apri il file dell'utente**: tre prove verdi
  contro «non funziona», e la differenza era un campo dentro la sua mappa.
