# Handoff definitivo — 15 agosto 2026

> **A chi arriva adesso: questo file basta per ripartire.** Sostituisce
> [HANDOFF-DEFINITIVO-2026-08-14b.md](HANDOFF-DEFINITIVO-2026-08-14b.md), che resta la lettura di
> dettaglio su zoom della fonte, forbici con ⌘ e Album Foto (F1–F2, ormai in `main`). Il §4 del
> [14](HANDOFF-DEFINITIVO-2026-08-14.md) — le quattro cose che contano prima del beta — vale ancora,
> e il **pacchetto è sempre la prima**: `dist/` è del 23 luglio, mai provata con questo codice.
>
> **Regola di lettura**: dove c'è ⚠️ c'è un guasto già pagato, col rimedio accanto.

---

## 1. Dove sono i lavori

| ramo | commit | suite |
|---|---|---|
| `main` | `5dc51b6` (15 ago sera, dopo il merge dei tre lavori) | ✅ **34** unità · **43** CDP, meno la nota qui sotto |

**Non c'è nessun ramo aperto.** `lavori-fotografie-banco` (F1-bis · B1 · Confronto) è entrato in
`main` in fast-forward dopo che i gesti erano stati provati a mano — e da quelle prove sono usciti
due difetti veri, il pittore che restava in overlay e la barra del Confronto fuori dal token, tutti
e due rimediati prima del merge.

```bash
cd "/Users/giacomomeschini/Claude/StudIA/StudIA"
npm test
STUDIA_PORTA=9334 ./test/cdp/con-vault-di-prova.sh
```

⚠️ **`prova-testolayer` è rossa da stasera ANCHE su `main` pulita** («il trascinamento seleziona
qualcosa» → selezione vuota). La prova è invariata dall'11 agosto, la porta 9333/9334 è libera, e la
stessa prova era verde più volte oggi: guasto **preesistente o ambientale**, non di questo ramo.
Da riguardare al momento del merge; se è un flake, ripasserà.

⚠️ Due lezioni di processo pagate oggi: (1) una sessione parallela ha mosso `main` a metà lavoro —
il ramo delle foto è stato **rifondato** e le suite rieseguite sul codice unito; la condizione
«`main` ferma» si verifica AL momento, non si ricorda. (2) Tre commit sono partiti per sbaglio su
`main` e sono stati spostati su un ramo con `git branch` + `reset`: prima di committare, guardare
su che ramo si è.

---

## 2. Che cosa c'è di nuovo sul ramo (in ordine di commit)

### F1-bis — un `.md` trascinato in uno zaino diventa un appunto (`56cb0d6`)
`.md`, `.markdown`, `.txt`. Titolo cercato in tre posti (frontmatter → primo `#` → nome del file);
il frontmatter di un altro programma **non sparisce** — le chiavi che la lista bianca di
`lib/appunti.js` mangerebbe restano nel corpo, in un blocco `yaml` — e i `[[wikilink]]` e le
immagini relative si **dichiarano**. Oltre i 2 MB si rimanda alle fonti («quella è un'altra
strada»). Modulo puro `App/assets/appunti/importa.js` + `test/importa-testi.js`; sezione CDP in
`prova-zaino.js`.

### B1 — la griglia del banco arriva a 3×3, e le forme si disegnano (`e9fe3d2`)
Quattro forme nuove a tre colonne più il **pittore**: casella «+» nel selettore, griglia 3×3, ogni
rettangolo trascinato è un blocco, la forma salvata entra nel selettore (tasto destro per
eliminarla). I blocchi diventano nove (A–I), le otto forme del piano non cambiano significato.

- ⚠️ **Tarature separate per due e tre colonne** (`col` vs `col3`/`col3b`): una frazione scelta con
  due colonne portata su tre faceva la prima colonna doppia delle altre. Misurato dalla prova.
- ⚠️ **Tutta la geometria si legge dalle aree** (griglia, divisori veri, bordi): con dodici forme
  più quelle dell'utente, un elenco scritto a mano diverge alla prima.
- ⚠️ **Il pittore non permette la L**: ricoprire è il modo di correggersi, ma le celle orfane di un
  rettangolo spezzato tornano vuote — il CSS scarterebbe la regola intera senza dire niente.
- Le forme personali: `localStorage` (preferenza dello schermo), prefisso obbligato `mia-`, e si
  ricaricano all'avvio PRIMA che il banco rilegga lo stato.
- Prove: sezione banco di `test/roundtrip.js` riscritta (930 ok) + `prova-banco-griglia.js`.

### Il Confronto — due fonti fianco a fianco (`f11e051`, rifinito in `5dc51b6`)
Strumento nuovo «Confronto» (`fonte2`), famiglia fonte, tutte le modalità: un secondo visualizzatore
pdf.js **tutto suo** — documento, pagina, zoom e memoria separati. La porta è il suo «Documenti ▾»;
i rimandi dei capitoli restano della Fonte.

- ⚠️ **Dichiaratamente più semplice, e lo dice**: si legge, si scorre, si zooma (⟷/⤢/%, ⇧+rotella)
  e si copia. Evidenze, ritagli e «appunta» stanno nella Fonte — un corredo a metà che sembra
  intero produrrebbe un «appunta» che cita il documento sbagliato. La selezione lì **non apre**
  menu né barra, apposta.
- ⚠️ **Il guasto che ha insegnato di più**: 266 pagine nel DOM, nessun canvas, nessun errore. Il
  CSS del viewer è incapsulato sotto `#pdfPane` (`bin/pdfjs-css.js`): dentro `#pdfPane2` le pagine
  erano ad altezza ZERO e `_getVisiblePages()` vuota. Ora il guscio è `:is(#pdfPane, #pdfPane2)` —
  un terzo riquadro si aggiunge LÌ.
- ⚠️ `GlobalWorkerOptions.workerSrc` si dichiara anche in `fonte2Avvia`: il Confronto deve poter
  partire prima che la Fonte sia mai stata aperta.
- Cambiando contenitore il Confronto si chiude: quel documento era di un altro.
- Prova: `prova-confronto.js`.

---

## 3. I gesti provati a mano ✅ *il 15 agosto sera*

Provati tutti da Giacomo: funzionano. Da lì sono usciti due difetti, tutti e due la STESSA forma di
guasto — un elenco che sembrava dire «tutto» e diceva «questi»:

⚠️ **il pittore restava in overlay** dopo il salvataggio, perché `closePops()` chiude i pannellini
scritti nel suo elenco e `#pittorePop` non c'era (la trappola del `PROVE=(` in salsa DOM);
⚠️ **la barra del Confronto aveva i caratteri di fabbrica**, perché le regole della `.pdfbar` erano
ancorate a `#pdfPane` — ora `:is(#pdfPane, #pdfPane2)`, come il guscio CSS di pdf.js.

La lista, per quando servirà rifarla:

**Testi (F1-bis)**
1. Trascina in uno zaino un `.md` con frontmatter di Obsidian: diventa un appunto col titolo
   giusto, e le chiavi extra stanno in un blocco in cima.
2. Trascina un `.txt`: entra come appunto.

**Banco (B1)**
3. Dal selettore delle forme scegli «Tre · colonne affiancate»: tre colonne uguali, due divisori
   verticali che si muovono indipendenti; doppio click su un divisore → si torna ai terzi.
4. «+» nel selettore → dipingi una forma sulla 3×3 (due-tre rettangoli) → salvala: il banco la usa
   subito. Riavvia l'app: c'è ancora. Tasto destro sulla sua miniatura: si elimina.
5. Le vecchie forme (due affiancati, quattro) sono dove erano e come erano.

**Confronto**
6. Metti «Fonti» in un blocco e «Confronto» in un altro; dal suo «Documenti ▾» apri un secondo
   documento (anche lo stesso della Fonte): sfoglia e zooma ognuno per conto suo.
7. Seleziona del testo nel Confronto: si copia con ⌘C, ma la barretta delle evidenze NON compare.
8. Chiudi il Confronto con la ✕: la Fonte resta dov'era.
9. Su uno schermo largo: tre colonne con Fonte · Confronto · Appunti è il caso d'uso vero.

---

## 4. Che cosa resta

- **Il pacchetto** (`npm run dist:mac`) — resta la prima cosa: il beta è vicino e `dist/` è del 23
  luglio.
- **F3** — l'elenco degli usi al click su un'immagine usata in più posti (`album.usi` c'è già), e
  le lapidi per una foto cancellata che ha ritagli figli. In coda, chiesto da Giacomo.
- **`prova-testolayer`** — capire il rosso ambientale (sopra).
- **B2 vero** — il multi-istanza con lo «strumento attivo» («l'ultimo riquadro toccato è quello che
  riceve», regola approvata): dopo lo smontaggio degli stati (M4-M9). Il Confronto di oggi è il
  passo uno, dichiaratamente asimmetrico.
- Il resto invariato dal [14b §5](HANDOFF-DEFINITIVO-2026-08-14b.md).
