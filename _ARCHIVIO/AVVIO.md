# StudIA — avvio e uso

## 1. Installazione (una volta)
Nella cartella che contiene `package.json`:
```
npm install
```
Scarica Electron 39. Poi si avvia sempre con:
```
npm start
```

## 2. Primo avvio: scelta del Vault
Alla prima apertura l'app chiede **dove salvare il Vault** (la cartella dei tuoi dati).
- Puoi scegliere la cartella **StudIA-Vault** già esistente (così ritrovi subito i corsi e i PDF già dentro), oppure una cartella nuova e vuota.
- L'app crea da sola le sottocartelle: `Fonti/`, `Corsi/`, `Trascrizioni/`, `Indice-PDF/`.
- La scelta viene ricordata; per cambiarla, elimina il file di configurazione dell'app o riscegli dalla schermata iniziale.

## 3. Dove mettere i materiali
**PDF e video vanno TUTTI nella stessa cartella: `Fonti/`.** L'app li distingue dall'estensione:
`.pdf` → estrazione testo/pagine; `.mp4/.mov/.mkv/.m4a/.mp3/...` → trascrizione con timestamp.
(I video sono grandi: puoi copiarli o mettere dei symlink dentro `Fonti/`.)

## 4. Elaborazione con barra di avanzamento
Premi **«Elabora sorgenti»** nell'header. L'app:
1. **installa da sola i requisiti** la prima volta (crea un ambiente Python e installa `faster-whisper` e `pypdf`) — mostrando lo stato nella barra in basso;
2. elabora ogni file nuovo di `Fonti/` (PDF e video), con **barra di avanzamento** e nome del file in corso (per i video l'avanzamento è anche interno alla lezione);
3. al termine **rigenera i rimandi ai minutaggi** (`videoRefs`) nei corsi.
Serve **Python 3** sul Mac (di norma già presente; altrimenti `xcode-select --install`) e internet la prima volta (per il modello Whisper e i pacchetti).

## 5. Studio
I capitoli con la sezione **Fonti** (blu) aprono il PDF alla pagina giusta; quelli con **Videolezioni** (teal) aprono il video/audio al minuto giusto, affiancati. `Esc` o ✕ chiude l'anteprima.

> Nota: «installare l'app» qui significa il primo `npm start`. Creare un vero pacchetto `.app` doppio‑cliccabile (con `electron-builder`) è un passo successivo, quando vorrai distribuirla.
