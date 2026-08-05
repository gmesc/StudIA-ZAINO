# StudIA — Storage vault/Markdown + Editor in-app

> Documento di design + **tree of thoughts**. Serve a progettare (a) il passaggio dei corsi da JSON a
> **vault stile Obsidian** (progetto > corso = vault > capitolo = file `.md`), e (b) il pannello editor
> in-app (carica → estrai → riorganizza → modifica). Da leggere PRIMA di generare/impacchettare i corsi.
> Stato: bozza viva (2026-07-23). Le collocazioni dei 40 materiali sono in verifica sul contenuto reale.

---

## 1. Il pivot

**Prima:** un corso = un file JSON in `Corsi/*.json`; i capitoli sono un array dentro il JSON; il reader
legge il JSON e renderizza.

**Ora:** modello **Obsidian-like**, tre livelli di cartella + file:

```
Progetti/                         ← radice di tutti i progetti di studio
  TD74-DSA/                       ← un PROGETTO di apprendimento
    _progetto.md                  ← manifest progetto (titolo, ordine corsi, fonti globali)
    01-fondamenti/                ← un CORSO = un VAULT (cartella)
      _corso.md                   ← manifest corso (titolo, sottotitolo, ordine capitoli, source)
      01-cosa-sono-i-dsa.md       ← un CAPITOLO = un file .md
      02-processi-di-apprendimento.md
      03-comorbilita.md
      assets/                     ← immagini/allegati del corso (opzionale)
    02-presa-in-carico/
      _corso.md
      01-relazione-e-famiglia.md
      ...
    ...
  (altro progetto)/
```

I **media e le fonti** originali (video, PDF) e i loro derivati restano condivisi a livello progetto
(un video può alimentare più corsi/capitoli): `Media/`, `Fonti/`, `Trascrizioni/`, `Indice-PDF/`
rimangono dove sono. I `.md` dei capitoli **puntano** a quei materiali, non li duplicano.

**Perché:** i capitoli diventano oggetti di prima classe — editabili singolarmente, riordinabili
(spostare = spostare un file), collegabili con `[[wiki-link]]`, e — se manteniamo la compatibilità —
apribili anche in Obsidian vero. Il riordino/riorganizzazione che è lo scopo di tutto il progetto
diventa **operazioni su file** invece che editing di grossi JSON.

---

## 2. Schema del capitolo `.md`

Mappatura dallo schema attuale (`{id,title,brief,html,keypoints,glossary,quiz,videoRefs}`) a Markdown:

```markdown
---
id: td74-fond-01
title: Cosa sono i DSA
order: 1
tags: [dsa, definizione, life-span]
videoRefs:
  - { video: "01 TD 74 I DSA...", t: 160, label: "Definizione condivisa" }
sources:
  - { pdf: "03 I processi...", page: 12, label: "Modello di Frith" }
status: draft        # draft | review | done
---

## In breve
Testo del *brief* in markdown vero. Qui si scrive e si rilegge liberamente. [^1]

## Contenuto
Corpo del capitolo (l'attuale `html` convertito in markdown). Immagini, tabelle, code block ok.
Riferimento cliccabile a un minuto del video: [vai a 2:40](video:01#t=160).

## Punti chiave
- primo keypoint
- secondo keypoint

```quiz
- q: "La comprensione del testo è certificabile come DSA in Italia?"
  a: false
  perche: "In Italia la comprensione non è tra i DSA certificabili."
```

```glossario
- t: eterogeneità
  d: i DSA sono un gruppo eterogeneo di disturbi, diversi tra loro e dentro ciascun profilo
```

[^1]: nota/fonte (footnote markdown-standard, sostituisce i marcatori `[[n]]`).
```

**Regola di divisione testo vs dati strutturati:**
- **Corpo markdown** (editabile a mano, Obsidian-friendly): brief, contenuto, punti chiave, note.
- **Blocchi fenced** ` ```quiz ` / ` ```glossario ` (YAML dentro): dati che il reader deve renderizzare
  in modo interattivo/strutturato, ma che restano leggibili e modificabili come testo.
- **Frontmatter YAML**: metadati e riferimenti (`id`, `title`, `order`, `tags`, `videoRefs`, `sources`,
  `status`). Standard → compatibile Obsidian.

**Link ai minutaggi:** schema custom `video:NN#t=SECONDI` reso cliccabile dal reader (apre il player al
secondo). In Obsidian vero non fa danni (link non risolto, ma non rompe). I marcatori nota passano da
`[[n]]` a **footnote markdown** `[^n]` (standard, portabile).

**Manifest `_corso.md`:** frontmatter con `id, title, subtitle, source, videos[]` + una lista ordinata dei
capitoli (o si usa il prefisso numerico dei filename come ordine — vedi tree of thoughts §4, Decisione 6).

---

## 3. Editor in-app — flusso e pannello (design)

Sei fasi, dallo stesso pannello:

1. **Carica** — drop di video/PDF → finiscono in `Media/` / `Fonti/`.
2. **Estrai** — pulsante ingest (già esistente): trascrizioni + indici PDF. Ora veloce (mlx GPU).
3. **Proponi** *(futuro, AI)* — suggerisce raggruppamento materiali → corsi → capitoli. Per ora la
   proposta è questo lavoro di verifica; poi si automatizza con le chiavi API + dashboard costi già presenti.
4. **Riorganizza** — UI per assegnare materiali a corsi, creare/rinominare corsi (= cartelle-vault),
   spostare capitoli tra corsi (= spostare `.md`), riordinare. Personalizzazione = cuore del progetto.
5. **Modifica** — editor markdown (funzioni portate da **Marino**) sul singolo `.md`, toggle
   lettura/modifica (il bottone di toggle: posizione da decidere dopo).
6. **Studia** — il reader renderizza i `.md` (frontmatter + markdown + blocchi quiz/glossario + link video).

Tutte le operazioni su file passano da IPC → `fs` nel main process. Nessun database: il filesystem *è* il DB.

---

## 4. Tree of thoughts (decisioni, rami, alternative)

### Decisione 1 — Unità di file = il capitolo
- **Ramo A (scelto):** 1 file `.md` per capitolo. + editabile/riordinabile/linkabile singolarmente,
  Obsidian-native.
- Ramo B: 1 file per corso, capitoli come `##`. − file enormi, riordino scomodo, niente link granulare.

### Decisione 2 — Gerarchia: progetto > corso(vault) > capitolo
- Il **corso è il vault** (cartella con i suoi `.md`). Il **progetto** raccoglie i corsi.
- Alternativa scartata: progetto unico vault con sottocartelle-corso → meno isolamento, ma è quasi
  equivalente; la differenza è solo *cosa chiami "vault"*. Teniamo "corso = vault" perché l'utente
  vuole poter trattare un corso come unità portabile.
- **Aperto:** i media/fonti restano a livello progetto (condivisi) — confermato, un video serve più capitoli.

### Decisione 3 — Frontmatter vs corpo vs blocchi fenced
- Tensione: più dati nel frontmatter = meno "markdown puro"; più convenzioni nel corpo = serve parser.
- **Scelto:** testo didattico nel corpo (markdown vero); dati strutturati (quiz, glossario) in blocchi
  fenced; metadati/riferimenti nel frontmatter. Compromesso tra editabilità a mano e resa nel reader.

### Decisione 4 — Link ai minutaggi
- **Scelto:** schema custom `video:NN#t=sec` intercettato dal reader. Non standard Obsidian ma innocuo lì.
- Note: **footnote `[^n]`** invece di `[[n]]` → standard, portabile. (Da confermare: comodità di mapping
  n → fonte quando si rigenerano i `videoRefs`.)

### Decisione 5 — Riordino = operazioni su file
- Spostare capitolo tra corsi = spostare il `.md` + aggiornare ordine. Creare corso = creare cartella +
  `_corso.md`. L'editor fa fs-ops via IPC. Niente stato nascosto.

### Decisione 6 — Ordinamento dei capitoli
- **Ramo A (propendo):** prefisso numerico nel filename (`01-…md`) → ordina nativamente in Obsidian e nel
  file system; rinominare per riordinare (o l'editor rinumera).
- Ramo B: campo `order:` in frontmatter → più stabile ai rename, ma l'ordine non si vede nella sidebar.
- Probabile: **entrambi** (prefisso per l'occhio + `order` come verità per il reader).

### Decisione 7 — Compatibilità con Obsidian *vero*
- **Obiettivo:** puntare a "apribile in Obsidian" (wiki-link, frontmatter YAML, footnote standard), così
  l'utente può editare i corsi anche lì. Vincola le scelte sopra a restare dentro il markdown standard +
  estensioni innocue.

### Domande aperte (rami non ancora chiusi)
- Un capitolo può appartenere a **più corsi**? Propensione: no (1 capitolo = 1 file = 1 corso), riuso via
  `[[link]]`. Da confermare col caso d'uso reale.
- **Progetti multipli** oltre TD74: la radice `Progetti/` li regge già. Serve un selettore di progetto nel reader.
- **Migrazione** dei 4 corsi JSON esistenti → vault `.md` (script one-shot).
- Il reader attuale legge `Corsi/*.json`: va esteso a leggere `Progetti/**/**.md` (parser frontmatter +
  markdown + blocchi fenced). Convivenza temporanea coi vecchi JSON durante la migrazione?
- **Quiz/glossario**: blocco fenced YAML vs frontmatter — verificare quale rende l'editing a mano più comodo.

---

## 5. Da portare da "Marino"

Marino = `/Users/giacomomeschini/Claude/Marino VIGANÒ - testi vari` — è una web-app **PHP** (non Electron),
ma l'editor è HTML+CSS+JS inline in un unico `studio-mv/app/index.php` (struttura gemella di StudIA):
il JS/CSS si porta quasi tal-quale, si sostituisce solo il layer di persistenza (fetch→PHP) con **IPC→`fs`**.

**Tecnologia:** **EasyMDE v2.21.0** (fork di SimpleMDE, su **CodeMirror 5**, con `marked` **bundlato dentro**
per la preview). Vendorizzato in locale = **2 soli file** da copiare in `App/assets/easymde/`:
`easymde.min.js` (327 KB, include CodeMirror5 + marked) + `easymde.min.css` (13 KB). **Gira 100% offline**
con la config `autoDownloadFontAwesome:false` + `spellChecker:false` (verificato: gli unici richiami CDN
scattano solo se quelle opzioni sono true). Toggle **preview (Cmd-P)** e **side-by-side (F9)** nativi.

**Copia diretta (auto-contenuto):** init+config `mvInit()` (index.php:1544-1578) · toolbar `mvToolbar()`
(1510-1539) + `mvHeading/mvInserisci/mvValore` · icone toolbar come glifi CSS `.mvi-*::before` (189-222,
niente Font Awesome — copiare anche le CSS var `--nero/--bianco/--rosso/--grigio-chiaro`) · rimappatura
scorciatoie su localStorage (1485-1497, 1722-1740) · guida markdown modale (538-562) · inserimento emoji
(1601-1608) · import `.md` (#ms-file 1611-1617) · helper `esc()`/`toast()`.

**Da adattare:** salvataggio (client #ms-salva 1688-1700 → rotta PHP `mano-salva` api.php:554-568). In StudIA:
`api()` fetch/CSRF → **IPC verso main.js + `fs`** che scrive il `.md` nella cartella-corso. Logica slugify +
`{nome,testo,aggiornato}` è un buon template; il CSRF si butta. Save **esplicito e mono-documento**;
autosave facile da aggiungere (`cm.on("changes")` + debounce, gancio già presente a 1568).

**Da riciclare (ottimo per noi):** la macchina dell'**autocomplete a cursore** `mvAuto*` (1619-1669, popup
sotto il cursore con `cursorCoords`, navigazione frecce/enter) — nata per le citazioni `[@scheda-id]`, si
**ricicla come autocomplete dei `[[wiki-link]]`** tra capitoli/corsi. Codice ben fatto e riusabile.

**Da NON portare:** la pipeline "Risolvi ed esporta" (pandoc + `manoscritto.py` + PHP `exec()`, api.php:459-536)
e il sistema di citazioni `[@scheda-id]` — specifici di Marino, pesanti, non pertinenti.

### ⚠️ Il gap: cosa EasyMDE NON fa (e va costruito SOPRA in StudIA)
EasyMDE base **non ha wiki-link `[[...]]`, né frontmatter, né vault/albero cartelle, né grafo note** —
cioè esattamente le feature Obsidian-like del §1-2. Vanno **aggiunte** come layer StudIA:
1. **Renderer markdown esteso** (per il reader E per la preview): partire da `marked` (già dentro easymde)
   con regole custom per → `[[wiki-link]]`, schema `video:NN#t=sec` (link cliccabile al minuto), blocchi
   fenced ` ```quiz `/` ```glossario ` (resa interattiva), e **parse+nascondi il frontmatter YAML**.
2. **Navigazione vault:** sidebar progetto→corsi→capitoli (l'albero cartelle che Marino non ha).
3. **Fs-ops di riorganizzazione:** crea/rinomina/sposta corso (cartella) e capitolo (`.md`) via IPC.
L'editor di Marino dà la *superficie di scrittura*; questo layer dà l'*anima Obsidian*.

---

## 6. Prossimi passi

1. Chiudere la verifica delle collocazioni dei 40 sul contenuto reale → **architettura definitiva** ("blocco").
2. Definire lo **schema `.md` finale** (questo doc, §2) e scrivere il **convertitore JSON→md** + il
   **parser md→reader**.
3. Portare l'**editor di Marino** e cablare le fs-ops (crea/sposta/rinomina corso e capitolo).
4. Migrare i 4 corsi esistenti; generare i restanti come vault `.md`.
5. Decidere dove mettere il **toggle modalità edit** (rimandato, come da richiesta).
