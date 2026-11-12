# Annotare le fonti PDF

Nella toolbar di **FONTI**, **Annota** apre gli strumenti per penna libera,
linea, freccia, rettangolo, ellisse, testo e post-it. La barra usa icone con
nomi e scorciatoie nei tooltip. Sono disponibili in tutti i
lettori PDF. Fuori da Annota i segni restano visibili e non intercettano la
selezione del testo del documento.

- Trascinare sulla pagina per disegnare. Dopo il gesto torna Seleziona.
- Trascinare un segno per spostarlo; usare le maniglie per ridimensionarlo.
- Maiusc durante il disegno vincola linee/frecce a un asse e rettangoli/ellissi
  a quadrato/cerchio. Durante il trascinamento delle maniglie delle forme,
  Maiusc conserva il rapporto tra larghezza e altezza della forma originale.
- Nelle frecce, **Direzione → Due punte** applica il terminale scelto a entrambe
  le estremità. La maniglia centrale piena incurva la freccia; quelle alle
  estremità modificano la posizione dei capi. Spostare il tratto muove anche
  la curva. Le punte seguono la tangente e le curve restano Bézier nell'export.
- Il menu **Forma** usa cinque icone: triangolo, rettangolo/quadrato,
  pentagono, esagono e ottagono. Il cambio conserva posizione, dimensioni e stile.
- Fare doppio clic su testo o post-it per modificarli. Il post-it accetta più righe;
  ⌘/Ctrl Invio conferma il testo.
- Il bubble dell'oggetto mostra soltanto i parametri pertinenti: colore, quattro
  spessori (1/2/4/8 pt), quattro punte (pallino, due lati, triangolo pieno, T),
  opacità e dimensione del testo. Il post-it ha anche il colore di sfondo.
- La palette Tailwind offre quattro colori recenti, conservati fra riaperture,
  e la pipetta a icona in cima. In Annota non ci sono i pulsanti separati
  Bianco e Nero. La pipetta richiede il supporto del browser; Esc annulla
  il prelievo. Se non supportata, il comando è disabilitato con spiegazione.
- L'ingranaggio apre **Stile di disegno**, cioè i parametri dei nuovi segni:
  non modifica quelli già presenti. Il tooltip della testata lo spiega.
- Testo e post-it usano il font scelto in Impostazioni → Aspetto al momento
  dell'inserimento. Il cambio successivo del font dell'app non riscrive i segni.
- Frecce per piccoli spostamenti, Maiusc per spostamenti maggiori; Canc elimina,
  ⌘/Ctrl Z annulla e Maiusc ⌘/Ctrl Z ripete. Escape deseleziona.
- Spazio + trascinamento conserva lo spostamento della pagina del lettore.

Scorciatoie degli strumenti: **V** seleziona, **P** penna, **L** linea,
**F** freccia, **R** rettangolo, **O** ellisse, **T** testo, **N** post-it.
Agiscono solo nel banco attivo con Annota acceso, fuori dai campi di testo e dai
menu. **Alt/⌥ Invio** espande il banco attivo e torna alla disposizione precedente;
il tooltip della testata ricorda il comando, disponibile anche negli altri split.
Non attiva la proiezione nativa a schermo intero e non agisce nei dialoghi modali.

I segni sono modificabili in ZAINO e si salvano automaticamente nello zaino,
in `APPUNTI/_annotazioni-pdf/<impronta-del-PDF>.json`. Lo stesso PDF aperto in
due split condivide le annotazioni. L'impronta segue la rinomina del file;
una sostituzione del contenuto del PDF, compresa una riscrittura OCR, identifica
invece un documento nuovo. I registri precedenti restano sul disco.

**Esporta PDF** salva una copia con i disegni vettoriali e le caselle di testo.
Il PDF originale non viene modificato; la sua destinazione è rifiutata anche
se scelta nel dialogo di esportazione, anche con una grafia diversa che sul Mac
identifica lo stesso file. La copia contiene i segni aggiunti con
Annota; le sottolineature di studio e le postille usano il proprio archivio.
I segni nella copia sono contenuto PDF, mentre la modifica dei singoli oggetti
continua a usare il registro di ZAINO.

Limiti attuali: PDF fino a 128 MB, 2.000 segni e 100.000 punti complessivi.
Il font standard dell'interfaccia viene esportato come Helvetica; Atkinson
Hyperlegible viene incorporato nella copia PDF. I caratteri non presenti nel font,
come alcune emoji o simboli, causano un messaggio esplicito e interrompono l'export.
Non vengono eliminati né sostituiti silenziosamente.

L'export usa @pdf-lib/fontkit e il TTF ufficiale di Atkinson Hyperlegible Regular
([Google Fonts](https://github.com/google/fonts/tree/main/ofl/atkinsonhyperlegible)),
incluso in App/assets/presentazioni/fonts con la licenza OFL già distribuita.
Il WOFF2 rimane destinato allo schermo: il suo decoder in fontkit non genera
correttamente i subset PDF. L'app non scarica font durante l'esportazione.

## Verifiche

`test/pdf-annotazioni.js` verifica geometria, validazione, revisioni concorrenti,
rinomina, rotazione della pagina, export e permessi di scrittura. Il salvataggio
è atomico; un registro corrotto è un errore dichiarato.

`test/cdp/prova-pdf-annotazioni.js` disegna con il mouse, sposta/ridimensiona,
cambia colori/punte/spessori, verifica i quattro recenti, crea un post-it Atkinson,
modifica testo con doppio clic, cancella e annulla da tastiera,
confronta due lettori, cambia zoom/layout e riapre il renderer. Esporta tramite
il dialogo nativo della fixture, rifiuta l’originale anche con alias maiuscolo
su un volume non sensibile alle maiuscole, legge la copia con PDF.js e confronta
i byte dell'originale. Nessuna prova usa il vault personale.

La prova UI simula il risultato della pipetta per verificarne il raccordo con
colore e salvataggio; il prelievo nativo dal desktop resta un gesto da provare
a mano. La prova misura Alt/⌥ Invio in entrambe le direzioni e il rispetto dei
campi di testo e dei dialoghi.

## APPUNTI e PRESENTA

In FONTI e FONTI2 il pulsante **Annota** mostra solo la matita con ricciolo; nome e descrizione restano nel tooltip e nel nome accessibile.

APPUNTI usa ora la stessa barra, gli stessi bubble e gesti, tramite `AnnotazioniUI.monta`. Il compositore è dentro il banco e salva un disegno SVG ancorato al Markdown, con scena modificabile distinta dai dati PDF. Le opzioni davanti/dietro al testo restano nei comandi delle figure. I disegni Excalidraw preesistenti conservano editor e metadati. Dettagli in [APPUNTI-DISEGNI.md](APPUNTI-DISEGNI.md).

PRESENTA non è ancora collegato ad Annota: servono oggetti vettoriali con i dati modificabili nativi e il collegamento alla cronologia della presentazione. Il motore di gesti e bubble è disponibile per questa futura integrazione.
