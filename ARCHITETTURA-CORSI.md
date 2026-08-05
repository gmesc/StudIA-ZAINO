# TD74 «I DSA» — Architettura definitiva dei corsi ✅ BLOCCATA (2026-07-23)

> Esito della verifica sul CONTENUTO REALE dei 40 materiali (3 agenti) + 3 decisioni dell'utente.
> Questo è il documento sorgente: da qui si generano i vault `.md`. Modello storage:
> [PIANO-VAULT-MD-EDITOR.md](PIANO-VAULT-MD-EDITOR.md). Progetto = `TD74-DSA`. Copertura **40/40**.

## Struttura: 6 aree · 15 corsi + 1 modulo-fonte

### AREA 1 — Fondamenti e quadro scientifico-diagnostico
- **C1 · `01 FONDAMENTI · Cosa sono i DSA`** — 01, 03, 28
  - *28 (comorbilità)* tenuto **intero** qui *(decisione utente)*; i suoi capitoli sul metodo START /
    funzioni esecutive portano un **rimando esplicito a C15** (metodo). Non spezzato.
- **RIF · `39-40 QUADRO SCIENTIFICO-DIAGNOSTICO (ISS/Min. Salute)`** — 39, 40
  - **Modulo-fonte consultabile** *(decisione utente)*, capitoli = quesiti (A/B/C/D per 39; 1-9 per 40).
    Non corso lineare. Etichetta **diagnostico** (la normativa scolastica L.170/PDP è nel video 27).

### AREA 2 — Presa in carico e documentazione
- **C2 · `02 LA CONSULENZA ALLA FAMIGLIA`** — 02
- **C3 · `25-27 DALLA CERTIFICAZIONE AL PDP`** — 25, 26, 27  *(25↔26 dittico P1/P2; 27 affondo sul PDP)*

### AREA 3 — I disturbi specifici *(ordine: C4→C5→C6→C7→C8→C9→C10)*
- **C4 · `04-06 DISLESSIA · Decodifica e compenso`** — 04, 05, 06
- **C5 · `07-08 DISLESSIA E LINGUE · Inglese e latino`** — 07, 08
- **C6 · `09-12 I DISTURBI DELLA SCRITTURA`** — 09, 10, 11, 12  *(09/10 disortografia · 11/12 disgrafia)*
- **C7 · `13-14 DISCALCULIA E COGNIZIONE NUMERICA`** — 13, 14
- **C8 · `15-16 LA COMPRENSIONE DEL TESTO`** — 15, 16
- **C9 · `17 LA SOLUZIONE DEI PROBLEMI ARITMETICI`** — 17
  - Posto **dopo la comprensione** *(decisione utente)*: NON è discalculia, il collo di bottiglia è la
    comprensione del testo del problema. Cerniera numero↔comprensione (sequenza 13→14→15→16→17).
- **C10 · `18 DISTURBO DI APPRENDIMENTO NON VERBALE (DANV)`** — 18  *(blocco a sé, profilo visuospaziale + socio-emotivo)*

### AREA 4 — La valutazione approfondita *(dopo i disturbi)*
- **C11 · `30 MEMORIA DI LAVORO · Il test PML-2`** — 30  *(standalone: WM è funzione trasversale)*
- **C12 · `31-35 VALUTAZIONE IN ADOLESCENTI E ADULTI · BDA 16-30`** — 31, 32, 33, 34, 35
  - 3 blocchi interni: **teoria** (31) · **la batteria** (32,33,34) · **oltre la diagnosi** (35, cerniera → C15/C4).

### AREA 5 — Prevenzione
- **C13 · `29·36-38 PREVENZIONE E PREREQUISITI`** — 29, 36, 37, 38
  - *29* qui (non in Area 4): screening precoce **non diagnostico**, stessi strumenti di 36 → gemello di 36-38.

### AREA 6 — Vissuto emotivo, metodo e autonomia
- **C14 · `19 ASPETTI EMOTIVI E AUTOSTIMA · Test TMA`** — 19
- **C15 · `20-24 METODO DI STUDIO, METACOGNIZIONE E MOTIVAZIONE`** — 20, 21, 22, 23, 24
  - Ordine interno: 23 (teoria) → 20, 21 (metodo) → 22 (compiti) → 24 (abilità+motivazione).
  - *24 tenuto UNITO* (test AMOS = abilità+motivazione insieme); anima motivazionale = capitolo con **ponte a C14/19**.

## Coppie e rimandi trasversali
- **19 ↔ 24** — coppia emotivo-motivazionale (autostima/TMA · motivazione/AMOS), aree diverse ma legate.
- **C9 (17) ↔ C8 (15-16)** — i problemi aritmetici richiedono la comprensione del testo.
- **28 (in C1) ↔ C15** · **35 (in C12) ↔ C15/C4** — rimandi verso metodo/intervento.

## Decisioni prese (2026-07-23)
- **A — 28:** intero in C1 (Fondamenti) + rimandi a C15. ✅
- **B — 17:** corso a sé (C9), sequenziato **dopo** la comprensione (13→14→15→16→17). ✅
- **C — 39/40:** modulo-fonte consultabile (capitoli = quesiti), non corso lineare. ✅

## Note di pipeline
- Ogni materiale ha i **capitoli proposti con minutaggi/pagine** (dalla verifica dei 3 agenti) → alimentano i `.md` e i link ai minuti.
- **Corpus 40/40**. Video 10 era troncato per un glitch AAC del file: risolto pre-estraendo l'audio con ffmpeg in `ingest.py` (fix robusto per tutti).
