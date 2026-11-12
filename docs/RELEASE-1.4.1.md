## Novità

- Guida aggiornata con screenshot, miniguida PDF di dodici pagine e zaino dimostrativo «Intro a ZAINO», con appunti, mappa e presentazione.

- Corretto il cursore degli APPUNTI negli split ridotti: il punto di scrittura coincide con il testo anche al 75%, nei banchi a metà e a un quarto, e dopo il ritorno dallo schermo intero.
- La guida degli APPUNTI mostra correttamente i rientri degli elenchi, come il documento scritto.

- PRESENTA: editor sul foglio, font e stili, tabelle, disegni vettoriali, navbar e numerazione dinamiche, navigazione per capitoli e approfondimenti. Animazioni con Anime.js e sfondi condivisi con texture di carta, immagini, GIF e video.
- APPUNTI: tabelle modificabili e trasferimento formattato da PRESENTA; disegni Excalidraw modificabili e vettoriali; posizionamento libero e livelli delle figure. Export PDF e DOCX locale con formattazione, immagini, callout, fonti e footer.
- MAPPE: preset grafici, carta fissa, palette Tailwind condivisa, nodi senza sfondo/bordo, cornici delle immagini e fusione Multiply. Video trascinabili dall’ALBUM con miniatura e riproduzione nel nodo; nel PDF restano miniatura e collegamento al file originale.
- Banco: selettori dei documenti nelle testate, toolbar più compatte, numeri degli split e titoli allineati nella sidebar. Zoom automatico del contenuto nei banchi piccoli con eccezioni per PDF, elenchi e messaggi.
- Impostazioni → Aspetto: font Atkinson Hyperlegible per l’interfaccia.

## Download

- **Mac Apple Silicon (arm64)**: DMG firmato Developer ID e notarizzato da Apple.
- **Windows x64**: installer `.exe`; privo di firma Authenticode.
- **Debian 12 e sistemi compatibili, amd64**: pacchetto `.deb`.

`SHA256SUMS.txt` permette di verificare gli installer e l’archivio dei sorgenti dei componenti nativi. L’archivio accompagna qpdf, ClamAV, licenze e ricette di preparazione.

Il collegamento video esportato nel PDF punta al file originale nello zaino: il video non è incorporato nel PDF. La resa DOCX può variare secondo il lettore Word.

Verifiche del codice: 97 programmi Node verdi e prove mirate di PRESENTA, APPUNTI, MAPPE, video, palette, toolbar e indicatori. I pacchetti vengono ricostruiti dalla stessa versione del repository e verificati per contenuti, versione e hash.
