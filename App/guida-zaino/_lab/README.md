# Come sono stati fatti gli screenshot (per rifarli)

La guida vive **dentro l'app** (`App/guida-zaino/`) e viaggia col pacchetto: si apre dal
bottone «📖 Apri la guida allo ZAINO» in Impostazioni › Zaino. Questa cartella `_lab/` è la
ricetta per rifare le immagini, e **non entra nel pacchetto** (`!App/guida-zaino/_lab/**` in
`package.json`): sta accanto alla guida perché la guida e il modo di rifarla sono una cosa sola.

- `lab.js` — pilota l'app viva via CDP (Chrome DevTools Protocol) e scatta screenshot interi o
  ritagliati, con puntatore evidenziato, cornici, numeri cerchiati, banda bianca per le legende,
  tendine «finte» (i `<select>` nativi non si fotografano aperti) e dialoghi «finti» col testo
  vero dei `confirm()`. Scrive in `../img/`.
- `campagna.js` — la sequenza completa, in ordine di guida: azzera il vault di prova, crea lo
  zaino «Sistema solare», importa i materiali e fotografa ogni stato. Finestra 1470×956 @2x =
  MacBook Air 13″ a schermo intero.
- `scatto-24.js` — la ricetta per rifare **una sola** figura (`24-confronto`), quando cambia la
  barra del Confronto: ricostruisce a mano lo stato che il passo 24 eredita dai passi 21-23
  (pagina 9, ricerca «pianeti» aperta, zoom alla larghezza) invece di riscrivere tutte e 117 le
  immagini. Stesso modo di lanciarlo della campagna: `GUIDA_VAULT=<vault> node scatto-24.js`.
- `materiali/` — i sei file che la campagna importa (PDF, video, audio, foto, `.md`, «scheda
  fotografata» = PDF di sole immagini). Stanno qui e non in una cartella temporanea perché la
  campagna deve potersi rifare fra un anno.

Ricetta:
1. Vault di prova **vuoto** e cartella dati a parte (mai quelli veri):
   ```
   electron . --user-data-dir=<dati> --remote-debugging-port=9345
   ```
   con `<dati>/config.json` = `{ "vaultPath": "<vault>", "profiloSaltato": true, "onboardingFatto": true }`.
2. `GUIDA_VAULT=<vault> node campagna.js > campagna.log` da questa cartella. Le immagini
   finiscono in `../img/`, cioè direttamente nella guida che l'app spedisce: non c'è nessuna
   copia da fare dopo.
3. Se resta un'istanza orfana: `pgrep -f "remote-debugging-port=9345"` e `kill`.

⚠️ **I numeri di una barra stanno su una RIGA SOLA**: si passa `{ filo: <y> }` a
`L.numeri(...)`, non si lascia che ogni pallino si appenda al proprio elemento. In una barra i
bottoni sono alti uguali ma un'etichetta di testo e un link no, e i loro numeri uscivano storti
in mezzo agli altri (misurato sulla barra del documento: «p. 1 di 24» e «Apri in una scheda»).

⚠️ **I dialoghi finti portano l'icona dell'app, che è OpenMoji.** Il `🎓` del dialogo si
disegna col font `OpenMoji` che l'app ha già caricato: senza dichiararlo, l'overlay ereditava
`-apple-system` e usciva il cappello di Apple — che non è l'icona che l'utente vede nel
`confirm()` vero.

Dipendenza: il modulo `ws` del repo di StudIA (`node_modules/ws`), tre livelli sopra.
