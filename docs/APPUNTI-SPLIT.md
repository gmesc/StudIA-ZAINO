# APPUNTI su più banchi

Ogni posizione del banco può ospitare APPUNTI, fino ai nove riquadri previsti
dal sistema delle disposizioni. Selezionare Appunti nella testata di ciascuno
split e scegliere il documento da aprire.

Tutti i riquadri usano lo stesso editor e la stessa toolbar completa, compresi
formattazione, callout, tabelle, disegni, stampa ed export PDF/DOCX. Negli split
stretti i comandi che non entrano restano nel menu di espansione della toolbar.
Il comando «Annota» usa una matita con tratto riccio e apre gli strumenti di disegno dentro il banco;
la matita semplice resta «Rinomina appunto». Entrambi conservano il tooltip.
Ogni riquadro conserva documento, selezione, cronologia e punto di lettura.
Le istanze si inizializzano quando servono, senza creare nove editor all'avvio.

Il selettore del documento resta nella testata del proprio split. Lo stesso
appunto segue le regole esistenti di trasferimento fra editor, per evitare due
copie modificabili in conflitto. Il cambio di disposizione o il ritorno da tutto
banco non modifica il contenuto degli appunti esclusi temporaneamente dalla vista.

`test/split-materiali.js` verifica assegnazione, editor comune e isolamento.
`test/cdp/prova-appunti-multipli.js` apre nove appunti sintetici, confronta le
toolbar, scrive e salva in ogni file, controlla le memorie di riapertura e il
ritorno dal tutto banco. Il ripristino temporaneo del vecchio limite di due
istanze fa fallire la prova Node, poi verde con il nuovo pool.

**Alt/⌥ Invio** espande il banco attivo e, premuto di nuovo, ripristina la vista
a banchi precedente. Funziona anche con il cursore negli appunti; i dialoghi
modali sospendono il comando. La scorciatoia compare nel tooltip della testata.
