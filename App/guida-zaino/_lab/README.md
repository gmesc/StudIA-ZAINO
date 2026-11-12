# Guida ZAINO del 5 novembre 2026

Questa edizione descrive ZAINO 1.4.1 e usa sei sezioni. Il carattere locale è
Atkinson Hyperlegible; colori e misure dei comandi corrispondono ai token dell’app.

## Rigenerare l’edizione completa

Dalla radice del repository:

```bash
# Il Python scelto deve avere reportlab, Pillow, fonttools e brotli.
GUIDA_PYTHON=/percorso/al/python STUDIA_PORTA=9465 bash bin/guida-zaino.sh
```

Il runner crea un vault sintetico in `/private/tmp/studia-guida-20261105-*`.
Avvia esclusivamente il runtime reale isolato, senza chiavi AI o chiamate cloud. Rigenera gli
screenshot, la miniguida PDF, i contenuti nativi e lo ZIP, poi verifica il risultato.
Non legge gli zaini dell’utente, non installa l’app e non modifica `dist`.
La porta va scelta libera. Il processo avviato viene chiuso alla fine; i log restano.

- `genera-guida.py`: testo HTML e dodici tappe in `percorso-base.json`.
- `screenshot-nuova.js`: acquisizioni reali dei pannelli e degli strumenti;
  `GUIDA_PASSI` permette di riprendere singole acquisizioni con una regex.
- `genera-miniguida.py`: PDF di dodici pagine, con Atkinson incorporato.
  Usa Poppler (`pdftoppm`) per il successivo controllo visivo.
- `genera-percorso.js`: dodici appunti, una mappa e una presentazione con capitoli
  e approfondimenti. I modelli nativi sono validati dalle librerie dell’app.
  Le figure Markdown `fig:0001#p=N&i=1` aprono la pagina del PDF; l’Album conserva
  anche le immagini riutilizzabili. Non si usano immagini annidate in link Markdown.
- `pacchetto-percorso.py`: raccoglie solo i materiali del percorso e le risorse
  referenziate, escludendo versioni, conversazioni e file di lavorazione.
- `verifica-nuova.js`: apre immagini e PDF negli Appunti, avvia PRESENTA, verifica
  token/font, link, indice e lightbox della guida, temi e larghezze 1280/390 px.

Lo zaino dimostrativo si chiama **Intro a ZAINO** (`intro-a-zaino/`).
I due download finali, `Intro-a-ZAINO.zip` e `Miniguida-ZAINO.pdf`, sono in `App/guida-zaino/download/`. Lo ZIP include un
LEGGIMI con istruzioni per copiare lo zaino: questa versione dell’app non ha un
comando per importare uno ZIP di zaino. Non presentarlo come pacchetto corso.

Gli screenshot non simulano risposte AI o modelli installati. Il pannello crediti
è illustrato tramite il pulsante del mago nelle Impostazioni; la tabella della
guida deriva dall’inventario reale `App/assets/dati/crediti.json`.

## Aggiornamento didattico del 12 novembre 2026

Le legende usano `comandi.json`: i numeri, i nomi e le descrizioni delle 33 tabelle
sono generati dallo stesso dato dei rettangoli sulle 33 catture `img/comandi-*`.
`box` contiene x, y, larghezza e altezza in percentuale rispetto al ritaglio;
`selector` conserva il comando misurato nell’app dimostrativa. Non spostare i
rettangoli a occhio quando cambia una toolbar: riprendere e misurare insieme
immagine e controllo. I 12 scatti `didattica-*` sono separati dalle immagini del
PDF e sono elencati in `didattica.json`; le loro misure stanno in `schermate.js`.

La struttura dell’indice deriva da h2, h3 e h4 con ID. Il generatore colloca i
comandi comuni per primi, gli approfondimenti sotto Appunti e PRESENTA, e gli
stili della community dopo gli strumenti. Le gallerie rimangono senza annotazioni:
solo la lightbox mostra titolo, posizione e frecce.

Per rigenerare soltanto l’HTML, senza toccare PDF, ZIP o vault:

```bash
ZAINO_GUIDA_ROOT="$PWD" python3 App/guida-zaino/_lab/genera-guida.py
```

Per il collaudo nel browser di prova già aperto sulla guida, usare la sua porta
CDP e una cartella temporanea per le immagini di verifica:

```bash
STUDIA_PORTA=9495 IMG_DIR=/private/tmp/zaino-guida-qa node App/guida-zaino/_lab/verifica-rimandi.js
```

`GUIDA_URL` permette di verificare la stessa pagina pubblicata. Il controllo
esamina 47 voci dell’indice, abbinamenti figura/tabella, limiti dei rettangoli,
colore blue-500, immagini caricate, assenza di cornici e comandi nelle gallerie,
tastiera, chiusura e ritorno del focus nelle 21 lightbox, a 1440 e 375 pixel.

## Ricette delle edizioni precedenti

Le ricette sotto sono conservate per le vecchie immagini. Non sono il runner
dell’edizione nuova e alcuni selettori appartengono alle versioni precedenti.

## Numeri uniformi e confronto Spot

`--numero-diametro` (28 px) e `--numero-font` (18 px) sono condivisi da tutte
le annotazioni blu, dalle legende e dai cerchi arancioni dei passaggi. Le misure
rimangono uguali su mobile e nella lightbox. I cerchi dei passaggi hanno solo
bordo e numero arancioni, senza riempimento; i numeri presenti nella UI reale
fotografata conservano l’aspetto dell’app.

`cattura-puntatore.js` usa soltanto il runtime dimostrativo `studia-guida-*`
con lo zaino `intro-a-zaino`. Acquisisce il menu ¶ e misura i suoi pulsanti,
poi crea un breve appunto temporaneo per nove catture reali: Laser, Box e
Cerchio, ciascuno con Spot spento, acceso e acceso con Bordo = 0. Alla fine
riapre l’appunto precedente, elimina quello temporaneo e ripristina le preferenze
del puntatore. Esempio, dopo aver aperto Appunti nel runtime di prova:

```bash
STUDIA_PORTA=9494 IMG_DIR=/private/tmp/zaino-guida-catture node App/guida-zaino/_lab/cattura-puntatore.js
```

`menu-paragrafo-geometria.json` conserva le misure del ritaglio e dei riquadri
usati in `schermate.js`. Le tre gallerie di effetti mostrano titolo e posizione
solo nella lightbox. `verifica-rimandi.js` controlla anche il terzo fotogramma,
i token in tema chiaro/scuro e l’ordine Appunti → citazione finale → Parole/Album.
