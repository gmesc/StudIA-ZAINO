# StudIA — Vault

Vault di studio del corso **Tutor DSA (Galton)**. Puoi aprire questa cartella come vault in Obsidian, oppure aprire direttamente l'app di studio.

## Come si usa
- **App di studio**: apri `App/StudIA.html` nel browser (o in Electron). Dall'header usa **Importa** per caricare le lezioni dalla cartella `Lezioni/` (oppure trascinale dentro la finestra).
- I capitoli che hanno la sezione **Fonti** mostrano dei chip cliccabili: aprono il PDF originale (cartella `Fonti/`) alla pagina giusta, in **anteprima affiancata** (split view). Con `Esc` o il tasto ✕ chiudi l'anteprima.

## Struttura delle cartelle
- `App/` — l'app lettore StudIA (un unico file HTML).
- `Lezioni/` — i "database lezione" in formato JSON, importabili nell'app.
- `Fonti/` — i PDF originali delle dispense (le fonti a cui puntano i link dei capitoli).
- `Trascrizioni/` — le trascrizioni testuali delle videolezioni.
- `Media/` — audio/video delle lezioni (o symlink); l'app li apre affiancati ai capitoli.
- `index_videos.py` — genera i rimandi ai minutaggi dei video (vedi sotto).

## Lezioni disponibili
- **Processi di apprendimento e Dislessia** — `Lezioni/td74-03-04-processi-dislessia.json` (materiali 03–04, con link cliccabili alle pagine dei PDF)
- **I DSA in una prospettiva life-span** — `Lezioni/td74-01-dsa-life-span.json` (videolezione 01)
- **La consulenza alla famiglia** — `Lezioni/td74-02-consulenza-famiglia.json` (videolezione 02)

## Nota sulle pagine PDF
I numeri di pagina nei link si riferiscono alla **pagina fisica del PDF** (non a quella stampata sul foglio). L'anteprima affiancata funziona con i file in locale nel browser e **nativamente in Electron**; se un browser blocca l'anteprima del PDF locale, usa il link **«Apri in una scheda»** nel pannello.

## Rimandi ai video (minutaggi)
I capitoli possono avere una sezione **Videolezioni** con chip che aprono il video/audio affiancato al minuto giusto. Per generarli:
1. Trascrivi con timestamp: esegui `Trascrivi-lezioni_Whisper.command` → crea in `Trascrizioni/` i `.json` (segmenti con tempi).
2. Indicizza: `python3 index_videos.py --transcripts Trascrizioni/ --lesson Lezioni/<lezione>.json --out Lezioni/<lezione>.json --video-ext .mp4`
3. Metti i file `.mp4`/`.mp3` (o symlink) in `Media/`.
Il match è per parole chiave (deterministico); upgrade futuro: semantico con embeddings (in locale).
