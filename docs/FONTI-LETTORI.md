# FONTI nei banchi multipli

Fino a nove split FONTI offrono la stessa toolbar: pagina, tinta, righello, lettura
vocale, zoom, sottolineature, strati, ritaglio, ricerca, OCR, rinomina,
rimozione e chiusura, oltre ad Annota. Altezza, ordine e separatori provengono
dallo stesso markup. Voce rimane disponibile su macOS; OCR si abilita sulle
scansioni identificate dall'indice. Rinomina e rimozione appartengono allo zaino.

Pagina, zoom, righello e ricerca lavorano nel lettore dal quale sono richiamati.
La ricerca usa un solo bubble con un proprietario esplicito: passando all'altro
lettore termina la ricerca precedente; chiudere una fonte non chiude la ricerca
nell'altra. Cmd/Ctrl F nel secondo lettore cerca nel secondo documento.
La lettura vocale usa la pagina del proprio lettore e un solo motore vocale.
Tinta, visibilità delle sottolineature e strati sono preferenze condivise di
lettura, come prima: la seconda toolbar richiama gli stessi servizi.

Selezioni, parole chiave, postille e ritagli ricavano documento e pagina dalla
superficie del gesto. Un ritaglio conserva il documento anche durante il rendering
asincrono. La cache degli ancoraggi distingue le due viste dello stesso PDF;
le sottolineature restano dati condivisi, con intervalli DOM distinti.
Rinomina/rimozione aggiornano entrambe le viste solo se mostrano quel documento.

Il secondo contatore accetta il numero o l'etichetta PDF della pagina. Il menu
sommario rimane una funzione del primo lettore. Gli aiuti di studio e i disegni
Annota mantengono i rispettivi archivi e le rispettive modalità di esportazione.

I lettori aggiuntivi conservano documento, pagina e strumenti per banco. Il passaggio a tutto banco e il ripristino mantengono queste scelte. `test/cdp/prova-fonti-multipli.js` apre nove fonti e verifica toolbar, ricerca, righello, sottolineature, Annota e ripristino della disposizione.

Verifica: `test/cdp/prova-fonti-toolbar.js` nel runner sintetico
`bin/prova-zaino.sh`, insieme alle prove di sottolineature/layout, annotazioni
PDF e parità APPUNTI. `test/split-materiali.js` conserva la verifica delle
aperture concorrenti e del cambio zaino durante il caricamento.
