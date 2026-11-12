# PRESENTA e GOBBO nel Banco

Il selettore della presentazione si trova a destra nella testata dello split: mostra il titolo aperto e permette di passare a un’altra presentazione. La toolbar sottostante contiene Documento, Annulla/Ripeti, Inserisci, la clip delle fonti e i comandi di presentazione. Quando non è aperto alcun documento, nel corpo dello split compare soltanto **+ NUOVA PRESENTAZIONE**.

PRESENTA è lo strumento del Banco per comporre le presentazioni. GOBBO è il pannello indipendente con note private, timer e comandi del relatore. Il primo percorso utilizzabile è collegato: creazione, modifica, autosave, riapertura, anteprima isolata, player nativo Reveal.js ed esportazione HTML offline. L’editor usa il layout **B · Sul foglio**, scelto nel confronto dei mockup, con i componenti ZAINO esistenti: selezione e manipolazione sulla slide, barra TITOLO/TESTO/IMMAGINE/SFONDO sotto l’anteprima e impostazioni della sola voce selezionata. La sidebar contiene miniature e + SLIDE.

Le prove UI usano la porta **8999** come valore predefinito nei runner e nel client CDP. Il runner rifiuta la partenza se la porta è già occupata.

## Pretext: righe di testo nelle animazioni

L’effetto **Una riga alla volta** usa Pretext per raggruppare le parole dei titoli
e dei paragrafi semplici. Il testo rimane nel DOM: scrittura, selezione,
salvataggio, annulla/ripeti e formato dei documenti restano quelli di PRESENTA.
Lo stesso percorso è caricato nella galleria delle animazioni, nell’anteprima,
nella proiezione pubblica e nell’HTML esportato.

Le misure preparate vengono riutilizzate quando cambia la larghezza; il
caricamento dei font e i cambi di lingua o densità dello schermo le invalidano.
Prima di applicare il raggruppamento si controlla che gli estremi delle righe
corrispondano al testo disegnato dal browser. Markdown ricco, testo bidirezionale,
parole spezzate o proprietà tipografiche non supportate usano la misura DOM già
esistente. Non viene modificato il contenuto per adattarlo al motore.

La prima integrazione riguarda questo effetto di PRESENTA. Il layout delle mappe
e le dimensioni dei riquadri continuano a usare i motori esistenti.

Pretext è incluso localmente, senza CDN né dipendenze npm aggiuntive a runtime.
I sorgenti originali sono in `vendor/pretext`, fissati alla revisione
`0d102a5cd933611e86a7e60bda7b4baa5995c6b0` di
[chenglou/pretext](https://github.com/chenglou/pretext). Il manifest di provenienza
registra l’hash di ogni sorgente. Il bundle IIFE si genera con
`npm run pretext:build` e si confronta byte per byte con
`npm run pretext:verifica`; usa esbuild già presente nel progetto. La licenza MIT
e gli avvisi aggiuntivi Chromium, WebKit, Unicode e ICU sono conservati per
intero nei crediti e in `runtime/licenze/pretext.txt` dell’esportazione.

Verifiche ripetibili: `node test/pretext.js` controlla il motore reale con metriche
iniettate, cache, righe, fallback, provenienza e runtime esportato.
`npm run test:pretext-offline` esporta un documento sintetico, sposta la cartella
e lo apre con rete negata e senza preload. Controlla il percorso Pretext effettivo,
i font disponibili, il ripristino, il movimento ridotto e Unicode.
`bash bin/prova-zaino.sh prova-pretext.js` verifica il cablaggio nell’anteprima
e nella proiezione pubblica. Eseguire le prove Electron una campagna alla volta.

## Clip: inserire una fonte nella slide

La clip nella toolbar di PRESENTA riusa il selettore degli Appunti. Si sceglie
un PDF, anche da un altro zaino, senza cambiare quello di lavoro. L’anteprima
permette di sfogliare il documento: **Collega PDF** inserisce il riferimento
all’intero documento, **Collega pagina** quello alla pagina visualizzata.
Chiudere l’anteprima prima della scelta non aggiunge nulla.

Il riferimento è un oggetto di testo sottolineato, con nome del PDF e pagina:
si può spostare, formattare, rinominare o annullare come gli altri testi. Il
rimando resta nella provenienza dell’oggetto (`source.kind: pdf`), separato
dall’etichetta visibile. Un clic sul testo apre la fonte nell’editor e nella
proiezione nativa; anche il menu contestuale offre **Apri fonte**. La chiusura
mantiene slide e passaggio animato, come descritto sotto. Per modificare
l’etichetta si usa il campo Testo o Scrivi sul foglio.

## Apri fonte da keyword e ritagli

Gli oggetti importati da Parole chiave o dall’Album conservano la provenienza.
Se è un PDF, il menu dell’oggetto offre **Apri fonte**, nell’editor e durante
la proiezione nativa di ZAINO. Nel player il menu si apre con clic destro;
con l’oggetto a fuoco anche con Maiusc+F10. Immagini caricate dal computer e
oggetti senza un riferimento PDF non offrono un collegamento inventato.

Anche i riferimenti PDF locali delle presentazioni precedenti (`pdf:…#p=…`),
compresi gli oggetti con provenienza `file` della guida, offrono il comando.
Il numero viene risolto nello zaino della presentazione al momento del clic,
poi passa agli stessi controlli di identità, revisione e sicurezza del PDF.
Il documento non viene riscritto; fonti assenti o numeri ambigui danno un errore.

L’editor riusa l’anteprima delle citazioni in modalità consultazione:
nessun appunto destinatario, nessun cambio di zaino o di Banco. La proiezione
mostra il PDF sopra la slide, con pagina citata, selezione del passaggio quando
identificabile, pagine precedente/successiva, zoom e **Chiudi**.

La richiesta della fonte usa lo stato confermato dal player anche dopo
la navigazione diretta con frecce, tastiera o indice. La consultazione mantiene
lo stesso DOM della slide e lo stesso indice dei passaggi Reveal. I timer Anime in esecuzione si fermano e riprendono dalla
posizione raggiunta; quelli già terminati non ripartono. I comandi di
avanzamento del GOBBO sono bloccati mentre la fonte è aperta. **Esc** chiude
prima il menu della fonte o l’anteprima; dopo la chiusura torna il comportamento
normale di uscita dallo schermo intero. Anche chiudere durante il caricamento
lascia utilizzabile la presentazione.

La chiusura usa soltanto la **X**, come nelle impostazioni. Le anteprime
dell’editor, degli Appunti e della proiezione mostrano **zaino › documento**
su una riga, con il token tipografico delle toolbar. Lo zaino occupa al massimo
15 caratteri; il documento ne riceve 15 più quelli lasciati liberi dallo zaino.
Le ellissi sono comprese nel limite; il tooltip e il nome accessibile conservano
entrambi i nomi completi, senza il numero interno del PDF.

Il player chiede soltanto l’oggetto della slide corrente: il main controlla
sessione, token, revisione, sequenza e passaggio e risolve il rimando conservato
nel documento. Il PDF attraversa gli stessi controlli di sicurezza, hash e
limite di40MB delle citazioni. File rimossi o modificati producono un messaggio
nell’anteprima, senza spostare la presentazione. Il player non riceve API del
vault, note private o l’elenco delle altre fonti.

Questa consultazione richiede ZAINO e il vault originale; l’export HTML
continua a escludere provenienza e PDF: dei collegamenti inseriti con la clip
resta l’etichetta leggibile, senza un pulsante che prometta di aprire il vault.
**Collegamento delle parole** resta un comando per URL HTTP/HTTPS.

Verifiche: `node test/presentazioni-fonti.js` e
`bash bin/prova-zaino.sh prova-presenta-fonti.js` (porta8999, solo fixture).

## Come provarlo nell’app

1. Aprire uno zaino e scegliere **PRESENTA** nella tendina di uno split.
2. Premere **Nuova presentazione** (nel menu **Documento**), scegliere il titolo e compilare il titolo della prima slide.
3. Usare **Inserisci** per testo, elenco, formula o materiali dello zaino; **+ SLIDE** offre i modelli Vuota, Solo titolo, Titolo e testo, Due colonne e Domanda. Gli approfondimenti si aggiungono dal menu della miniatura. Duplicazione, riordino, eliminazione e annulla/ripeti sono nella stessa superficie.
4. Trascinare parole chiave o elementi dell’Album nel pannello, oppure immagini/audio/video dalla sidebar principale; in alternativa usare **Inserisci dallo zaino** oppure **Carica dal computer** per immagini, GIF e video. Il gesto inserisce nella slide selezionata; la creazione di slide tramite drop nella panoramica resta P1.
5. Attendere **Salvato**, chiudere il documento e riaprirlo dalla tendina o dalla sezione PRESENTA in sidebar. Anche l’ultima presentazione e la slide selezionata si ricordano per zaino.
6. Scegliere **Presenta a schermo intero**. Aprire **GOBBO** in un altro split per leggere le note e comandare la sessione. `Esc` esce dallo schermo intero della finestra pubblica; un altro `Esc` chiude quella finestra. `F` commuta lo schermo intero.
7. **Esporta presentazione HTML** apre il selettore della cartella e produce un pacchetto offline senza note.

Il campo titolo modifica anche il titolo visibile nella slide. Selezionare un oggetto sul foglio o nella barra sotto l’anteprima: i comandi sotto mostrano contenuto, dimensione e colore del testo, allineamento delle righe e posizione verticale nel riquadro. Trascinare per spostare; usare il quadratino nell’angolo per ridimensionare. Le frecce spostano, Maiusc aumenta il passo e Alt + frecce ridimensiona. La griglia POSIZIONE offre un’alternativa al trascinamento: celle contigue, hover verde e selezione di cella, intera riga o colonna. Segue lo schema attivo dei righelli; senza righelli torna a 3×3. **DISPOSIZIONE**, separato da SFONDO, mostra le disposizioni illustrate **Immagine a sinistra**, **Testo a sinistra** e **Immagine sopra**; **Sfondo della slide** offre colori pronti e selettore personalizzato, indipendenti dal tema dell’app. Il testo usa un colore automatico leggibile, salvo una scelta sul singolo oggetto. I soli colori predefiniti sono **Bianco** e **Nero**. Il pulsante **Nuovo colore** resta sempre visibile come icona della palette in un bottone quadrato, con nome nel tooltip e per i lettori di schermo; ha la stessa altezza degli altri comandi e ricorda l’ultimo colore nel tooltip con il suo identificatore Tailwind (per esempio `sky-500`). Apre le 22 famiglie e le 11 gradazioni della [palette HEX ufficiale Tailwind 3.4.17](https://github.com/tailwindlabs/tailwindcss/blob/v3.4.17/src/public/colors.js), disponibile anche offline senza introdurre il framework CSS. A fianco sono visibili cinque slot autosalvati: clic per usare o scegliere un colore, clic destro per aprire **Modifica colore / Elimina colore**. Eliminare svuota solo lo slot, senza cambiare il colore già applicato alla slide o al testo. Lo stesso menu si apre con Maiusc+F10 sullo slot. I colori liberi salvati in precedenza conservano il valore esatto: un identificatore preceduto da `≈` indica il colore Tailwind più vicino. Queste preferenze restano in localStorage e sono condivise fra colore del testo e sfondo. **Automatico** elimina il colore manuale del solo oggetto. Le spiegazioni delle impostazioni sono tooltip. Gli appunti privati sono nel popup **Appunti privati**, le animazioni nella sezione espandibile dell’oggetto; **Stato successivo animato** collega le corrispondenze fra le due slide. Le formule usano LaTeX; il testo accetta Markdown e delimitatori matematici espliciti. I bottoni hanno etichette accessibili e tooltip italiani; `⌘/Ctrl+S`, `⌘/Ctrl+Z`, `⌘/Ctrl+Shift+Z` agiscono sull’editor.

La griglia Tailwind è condivisa con gli altri editor: campioni da 24 px, 2 px fra colonne e 6 px fra righe, navigazione con le frecce. I cinque slot personali e le opzioni Automatico/Bianco/Nero conservano il proprio funzionamento. Vedi [ASPETTO.md](ASPETTO.md).

L’anteprima occupa tutta la larghezza disponibile e conserva le proporzioni impostate per il documento, senza il precedente limite di altezza né margini Reveal interni. Il contorno grigio appare soltanto sul bianco (compreso il bianco del tema chiaro precedente). Negli split larghi il foglio cresce in altezza e le proprietà rimangono raggiungibili scorrendo. Il separatore fra miniature e area di lavoro prosegue anche lungo tutte le impostazioni sotto il foglio.

L’avviso di contenuto fuori misura riguarda l’intera slide: resta quindi visibile cambiando tab se almeno un elemento è tagliato. Si aggiorna anche passando tra slide già compilate e non viene ereditato dalla precedente; i messaggi sono associati a slide e versione dell’anteprima. La misura controlla i riquadri esterni che tagliano il contenuto: piccole eccedenze delle metriche del font sulla propria riga interna non sono un problema se il testo entra nel riquadro.

Il player nativo e l’export HTML adattano il foglio alla massima area disponibile senza deformarlo, con margine Reveal pari a zero. La ricetta `bin/presenta-runtime.js` conserva la scala esatta, rimuovendo l’arrotondamento al centesimo di Reveal che poteva tagliare alcuni pixel ai bordi su determinate larghezze; player nativo, anteprima e HTML offline usano lo stesso runtime. Se lo schermo ha proporzioni diverse dalla slide, lo spazio residuo usa lo stesso sfondo della slide corrente, anche negli approfondimenti; le frecce restano leggibili su sfondi chiari e scuri. Per i pacchetti già esportati occorre una nuova esportazione.

La testata di PRESENTA avvia il deck reale. GOBBO è marcato privato nel registro e non offre la proiezione generica, neppure nella barra a schermo intero. Una sessione usa la revisione fissata all’avvio: eventuali modifiche successive nell’editor non cambiano in silenzio le note o le slide già proiettate.

Nel player nativo e nell’HTML offline, **← / →** passano alla principale precedente/successiva, arrivando sempre alla prima slide del capitolo e ignorando l’ultimo approfondimento visitato. **↓** scorre gli approfondimenti e, dopo l’ultimo, passa alla principale seguente. **↑** fa il percorso inverso: dalla principale torna all’ultimo approfondimento del capitolo precedente, oppure alla sua principale se non ne ha. Tastiera e frecce a schermo seguono la stessa regola; all’inizio e alla fine del percorso si fermano. Le frecce cambiano slide direttamente: **Spazio / Maiusc+Spazio** e **Avanti / Indietro** di GOBBO mantengono l’avanzamento dei passaggi animati. Nell’editor le frecce continuano a spostare gli oggetti selezionati.


Gli sfondi **SFONDO → Immagine/GIF** e **SFONDO → Video** scelgono una risorsa da MEDIA dello stesso zaino. **Carica dal PC** apre il selettore nativo; **Carica immagine o video dal computer**, nella sezione IMMAGINE, e **Inserisci → Carica dal computer** inseriscono un nuovo oggetto. Sono accettati PNG, JPEG, WebP, GIF e i formati video dichiarati nel selettore; la decodifica video dipende dai codec disponibili. Il limite è **512 MiB per file (536.870.912 byte)**, indicato nei tooltip e verificato prima della copia. L’originale resta sul computer e una copia deduplicata viene conservata tra le risorse della presentazione. Il percorso esterno non viene salvato né passato dal renderer al processo principale. Il media resta dietro tutti gli oggetti e non è selezionabile sul foglio. **Riempi slide** copre il foglio ritagliando i bordi; **Mostra tutto** conserva l’intera immagine o il video. Il colore già scelto rimane sotto al media e ricompare tornando a **Colore** o usando il cestino. Queste azioni e la sostituzione si possono annullare.

Le GIF conservano l’originale animato. I video partono **muti e in ripetizione**: **Audio** e **Ripeti** modificano queste opzioni. Nell’editor il video è fermo e muto; **Prova sfondo** apre la prova in movimento. Per gli sfondi autonomi, in presentazione il video parte entrando nella slide e si ferma quando la si lascia. Le immagini/GIF compaiono nelle miniature come fotogrammi statici; gli sfondi video sono indicati con «Video». Il file viene copiato nell’archivio della presentazione e incluso nell’HTML offline, con controllo dell’impronta anche se usato soltanto come sfondo. GIF e video non vengono convertiti; la compatibilità video dipende dai codec del browser.

**SFONDO → Carta** apre un bubble menu con le anteprime selezionabili di **Carta cotone**, **Carta naturale** e **Carta chiarissima**. Sono tre texture raster di carta, con fibre, imperfezioni e ombreggiatura lieve; non hanno righe, puntinature o quadrettature. La terza ha un tono quasi bianco. Sono incluse nell’app e funzionano offline; l’export copia soltanto le texture usate. File e prompt originali del generatore integrato sono in `App/assets/presentazioni/carte/provenienza.json`. La carta selezionata è evidenziata nel menu; Esc lo chiude e riporta il focus al bottone. Negli split stretti, i comandi che non entrano nella riga sono disponibili in **…**, compreso Carta.

**Applica a tutte le slide** collega lo sfondo corrente (colore, carta, immagine, GIF o video) alle slide esistenti e future. Le successive modifiche da una slide collegata aggiornano lo sfondo comune. Nel menu contestuale delle miniature, **Sfondo autonomo** crea un’eccezione mantenendo inizialmente lo stesso aspetto: da lì lo sfondo della slide si modifica separatamente. Disattivare la voce ricollega la slide. Applicare di nuovo a tutte elimina le eccezioni. Incolla stile conserva il collegamento esistente; le azioni si possono annullare.

Lo sfondo condiviso usa un unico elemento dietro alle slide: rimane fermo mentre i contenuti entrano/escono. Immagini e GIF conservano lo stesso elemento, il video mantiene il punto di riproduzione passando fra slide collegate, compresi gli approfondimenti. Si nasconde sulle slide autonome e riprende tornando a quelle collegate. Nell’editor il video rimane passivo; Prova sfondo, player ed export lo riproducono.

Il contratto conserva `background` per il colore, `backgroundMedia` (`assetId`, `fit`, `loop`, `muted`) per i media e aggiunge `backgroundPattern`, `backgroundIndependent` e il fondo documento `backgroundCommon`; valgono le stesse risorse locali verificate degli oggetti. Nessun URL arbitrario e nessun iframe/web incorporato. `risorseUsate`, pubblicazione, anteprima a capacità, export e cronologia includono lo sfondo. Duplicazione, nuove slide da modello e copia dello stile lo conservano. Il main dichiara la capacità `sfondiMedia`: una finestra aggiornata sopra un main precedente chiede il riavvio prima di importare.


Nel player pubblico e nell’HTML offline, un clic sul corpo della slide avanza di un effetto (o alla slide successiva, terminati gli effetti), come Spazio. Le frecce conservano la navigazione fra principali e approfondimenti. Link, navbar, pulsanti, media e selezione del testo non generano avanzamenti aggiuntivi. Nei comandi Animazioni, Avvio, Durata e Attesa usano il padding compatto coerente con la loro altezza, senza tagliare il valore selezionato.

## Annulla, Ripeti e avvisi di spazio

**Cmd+Z** e **Maiusc+Cmd+Z** (Windows/Linux: **Ctrl+Z**, **Ctrl+Maiusc+Z** oppure **Ctrl+Y**) agiscono sulla cronologia della presentazione. Funzionano nel foglio, durante la scrittura, nelle proprietà e con PRESENTA attivo senza un campo a fuoco. Il testo in modifica viene sincronizzato prima dell’operazione; il ridisegno del foglio non disattiva il gesto successivo. Un altro split o un dialogo conserva la propria gestione dei tasti.

L’avviso «Parte del contenuto non entra…» segnala contenuto effettivamente fuori dal riquadro, anche quando la navbar verticale restringe l’area utile e manda un titolo su due righe. Il font mantiene la dimensione scelta. Nella guida con navbar laterale larga 24,29%, per esempio, i titoli di 2.1, 6.1, 9.1 e 11.1 a 46 px richiedono circa 106 px per due righe, mentre il riquadro alto 108 px offre solo 92 px dopo il padding. Aumentare il riquadro o ridurre il font elimina l’avviso; questi quattro titoli della guida distribuita, con navbar orizzontale, entrano già nei riquadri.

Durante la modifica, una cornice rossa identifica ogni riquadro che taglia testo, tabelle, immagini o altri media. Se a eccedere è l’altezza complessiva della slide, la cornice segnala il foglio. Rimane visibile anche selezionando il riquadro e scompare dopo la correzione. È un’indicazione dell’editor: non viene salvata nel documento e non compare nella vista pulita, nel player o negli export.

## Navbar, numerazione, aspetto e disegno vettoriale

Tutti i tab delle proprietà hanno una distanza ridotta fra la riga di selezione e le opzioni. Le azioni **Nascondi/Mostra su questa slide** sono compatte e allineate a sinistra, con una nota breve nella stessa riga. In SFONDO, **Applica a tutte le slide** è nella barra dei tipi di sfondo; le spiegazioni restano nei tooltip e il messaggio sullo sfondo comune è stato rimosso. Gli altri testi di aiuto usano la stessa dimensione dei normali messaggi dell’editor.

**Inserisci → Navbar** aggiunge una barra comune a tutte le slide, comprese quelle create in seguito. **Step numerati**, **Schede** e **Linea di avanzamento** leggono i titoli delle slide e aggiornano quantità, ordine e indicatore corrente. I campi **Tipo**, **Step**, **Orientamento** e **Zoom** sono su una sola riga; negli split stretti i comandi che non entrano passano in **…**. **Step** sceglie tutte le slide oppure le sole principali. Gli approfondimenti usano lettere. I clic navigano nel player pubblico e nell’HTML offline; nell’editor selezionano l’oggetto. Navbar e numeratore vivono su un unico livello fisso esterno alle transizioni: i riquadri restano fermi mentre cambiano slide e approfondimenti, anche nell’editor e nell’HTML offline. **Orientamento** dispone gli step in orizzontale o verticale. Passando a un orientamento incompatibile con la forma del riquadro, assegna un riquadro laterale o a piè di pagina; il riquadro si può poi spostare e ridimensionare sulla slide. **Zoom** ingrandisce lo step attivo al 110%, 120% o 130%, con un’animazione di 220 ms; **Disattivato** conserva la misura normale. Con movimento ridotto si applica subito la misura finale. Nel cambio di step, quello precedente torna alla scala normale mentre il nuovo si ingrandisce, senza far rientrare tutti i pulsanti. Clic rapidi ripartono dalla scala corrente; i frammenti e gli approfondimenti dello stesso argomento, con Step impostato alle sole principali, non rilanciano lo zoom. Se gli step non entrano, la barra scorre lungo il proprio orientamento e nel player porta in vista quello corrente.

**Inserisci → Numera pagine** crea un contatore comune con font, dimensione, colore, allineamento e posizione modificabili. Mostra `1/12`, `2/12`, ecc.; gli approfondimenti della seconda principale diventano `2a/12`, `2b/12`, fino a `2aa/12` oltre la ventiseiesima. Il denominatore conta le principali. Solo il valore del contatore cambia con una breve dissolvenza e uno spostamento verticale di 6 px in 200 ms, invertito tornando indietro; il riquadro conserva posizione e dimensioni. Con movimento ridotto il numero cambia subito. Posizione e stile si aggiornano insieme in tutte le slide, anche trascinando l’oggetto. Dal menu contestuale scegliere **Nascondi su questa slide**; la voce **Numero pagina · nascosto** nelle proprietà permette di selezionarlo e usare **Mostra su questa slide**. Vale anche per le navbar. **Rimuovi da tutte le slide** elimina l’oggetto comune; Annulla lo recupera.

**Aspetto** della navbar presenta tre gruppi affiancati, che vanno a capo nello split stretto: **Colori degli step**, **Dimensioni e distanze** e **Intera navbar**. Quest’ultimo contiene anche **Separatori tra gli step**. I gruppi conservano l’apertura o la chiusura mentre si cambiano i valori. In Colori, **Non selezionati / Selezionato** sceglie quale aspetto modificare senza cambiare slide. Qui si trova anche il colore del testo (numero e titolo), insieme a bordo e riempimento del cerchio negli Step numerati, bordo e riempimento dell’intera Scheda, oppure colore della Linea di avanzamento. I controlli non pertinenti al tipo scelto non compaiono. Ogni bordo, riempimento e linea ha la propria opacità: il bordo selezionato non dipende dall’opacità degli altri bordi né attenua il riempimento. **Senza bordo** e **Riempimento trasparente** agiscono soltanto sullo stato scelto. Scegliere un colore su una parte trasparente la rende visibile. Ogni riga colore mostra un campione e, quando pertinente, la percentuale di opacità digitabile accanto: clic sul campione apre la palette Tailwind, con Automatico, Bianco, Nero e i colori personali.

Pulsanti, palette e sezioni usano la scala compatta delle toolbar; i gruppi non hanno linee divisorie e le sottovoci sono rientrate. Gli slider sono corti (traccia entro 192 px), con il valore accanto; anche nelle finestre ampie le misure restano raggruppate. Le etichette sono vicine ai campi; i titoletti usano il token esistente `--tbig-fs`, leggermente maggiore del testo delle toolbar. I controlli dimensionali che non entrano passano in **…**. **Dimensioni e distanze** conserva spessori e distanza comuni ai due stati; **Diametro dei cerchi**, presente soltanto negli Step numerati, regola la misura minima, distinta dalla dimensione del font. Tutti i cerchi si allargano quanto serve per il numero più lungo, compresi `12` e `12a`, mantenendo le cifre centrate su una sola riga.

**Clic sul numero o sulla forma** della navbar apre un bubble con bordo/riempimento o linea; **clic sul titolo** apre il colore del testo. Lo stato corrisponde allo step cliccato e si può cambiare con **Non selezionati / Selezionato**. **Tutti i comandi** apre il pannello completo sotto la slide. Il bubble cerca spazio libero sopra, sotto o ai lati della navbar, restando dentro la porzione visibile dell’anteprima. Se manca spazio per un pannello utilizzabile, si aggancia subito sotto il foglio. Si riposiziona durante resize, scorrimento e cambio Banco; anche la palette aperta dal bubble rimane nel suo riquadro, senza sovrapporsi alla navbar. Si chiude con X o clic esterno; Esc funziona quando il focus è nel bubble.

**Aspetto**, nella sezione dell’oggetto o nel suo bubble menu, offre **Fusione** (Normale, Moltiplica, Scolora, Sovrapponi, Scurisci e Schiarisci) e opacità 0–100%. Su testi, titoli, elenchi, formule, tabelle e numeratore si vedono solo questi controlli. Nella navbar sono nella sottosezione **Intera navbar**, con il nome **Opacità complessiva**. Immagini, forme e disegni hanno anche bianco e nero/scala di grigi, seppia, luminosità, contrasto, saturazione e sfocatura statica. Video, audio e GIF sono esclusi. Eventuali filtri già salvati sui testi restano leggibili e si eliminano con **Ripristina aspetto**. Gli effetti statici restano separati dai wrapper delle animazioni: un’entrata non ripristina l’opacità dell’oggetto al 100%. Miniature, player ed esportazione usano lo stesso stile.

**Mostra separatori** rende disponibili colore, spessore e opacità delle linee fra gli step; nasconderle conserva il loro spessore. Sono verticali nella barra orizzontale e orizzontali nella verticale. Il loro colore Automatico segue il testo non selezionato, restando uguale durante la navigazione. Gli altri Automatico hanno tooltip specifici: testo normale adattato allo sfondo, testo selezionato uguale al normale, grafica nel colore del testo del proprio stato, riempimento selezionato nel colore del bordo selezionato. **Ripristina aspetto** elimina i colori e le personalizzazioni grafiche della navbar, compreso il colore del testo.

Le navbar già salvate restano leggibili e conservano la resa delle vecchie opacità concatenate. La prima modifica grafica memorizza le opacità risultanti come valori indipendenti, senza riscrivere documenti alla semplice apertura. Il vecchio `activeGraphicOpacity` resta accettato in lettura; il formato aggiornato usa `activeBorderOpacity`, `activeLineOpacity` e `activeBackground.opacity`. Miniature, player ed export condividono la conversione e lo stesso CSS.

La griglia, il comando **Posizione**, le guide magnetiche, il trascinamento (anche di gruppi) e le disposizioni usano l’**area utile**: la navbar verticale riserva la fascia del bordo sinistro/destro più vicino; quella orizzontale e il numeratore riservano testa/piede. La distanza di sicurezza è il 2% del foglio. Creare, spostare o nascondere questi oggetti aggiorna i riquadri dei contenuti in tutte le slide interessate, mantenendo la distribuzione relativa dei contenuti. Le dimensioni dei font restano quelle scelte; il normale avviso segnala contenuti che richiedono un riquadro più grande. Gli oggetti comuni mantengono posizione e stile applicando disposizioni, Sistema o Incolla stile; sono esclusi dagli allineamenti di gruppo. Se manca spazio, un messaggio chiede di spostare o ridurre la barra/il numeratore. Le modifiche si annullano con la cronologia.

**Inserisci → Disegno vettoriale** apre Excalidraw locale, già incluso nella LIM, con forme, frecce, testo e tratto libero. **Inserisci disegno** aggiunge un singolo oggetto ridimensionabile; **Modifica disegno vettoriale** riapre la scena originale. Annullare la finestra conserva il disegno precedente. Il testo interno al disegno è reso in Arial nell’output, come indicato nella finestra; per i font della presentazione usare i normali oggetti Testo. I controlli Aspetto e Posizione restano disponibili sul vettore.

Il documento conserva la scena modificabile e un albero SVG ristretto, senza immagini raster, HTML, script, URL remoti o attributi evento. `vettori.js` valida il medesimo albero in Node e nel browser; il compilatore produce gli elementi SVG consentiti con ID distinti per oggetto. Il payload pubblico esclude la scena di editing. Limiti: 2.000 elementi Excalidraw, 15.000 nodi SVG, profondità 40 e 2 MiB per disegno, entro gli 8 MiB complessivi del documento. Nessuna nuova dipendenza, nessun accesso al vault della LIM.

Le operazioni passano dal modello e dalla cronologia esistenti. `test/presentazioni-elementi.js` copre calcoli, sincronizzazione, visibilità, gerarchia, undo/redo, filtri, SVG e pubblicazione; è rosso caricando il modello precedente `19f5dcb`. `test/cdp/prova-presenta-elementi.js` attraversa i comandi reali, disegna con eventi del mouse, verifica la resa nell’iframe e riapre il vettore salvato sul vault sintetico. La prova del player controlla anche clic nella navbar, colori distinti di testo e grafica, sfocatura e contatore nell’HTML offline spostato. Campiona tutti i frame delle transizioni orizzontali e verticali per misurare l’immobilità dei riquadri, lo zoom in entrambe le direzioni e l’opacità del valore della pagina; verifica clic rapidi, scala dopo resize e comuni nascosti. La prova UI muove il contatore fisso con la tastiera, conserva le modifiche comuni e controlla la chiusura del documento. La nuova prova geometrica è rossa sul modello `2bc66e0`: disposizioni che entravano nella fascia della navbar. I test misurano i quattro bordi, la sincronizzazione, i margini della griglia e la conservazione degli oggetti comuni.

## Strumenti di base e mockup dell’evoluzione

La barra espone **Documento**, **Inserisci**, **Presenta** e **Apri GOBBO**. Nel menu Documento restano creazione, rinomina, salvataggio, esportazione HTML, eliminazione e chiusura. **Anteprima pulita** è stata rimossa: Escape o un clic sul foglio vuoto deselezionano l’oggetto e chiudono la bolla. Escape funziona anche dal pannello delle proprietà; i menu e le finestre aperte si chiudono per primi. Il menu **…** sotto il foglio rende raggiungibili le azioni dell’oggetto selezionato senza click destro.

Le proprietà e il bubble offrono nove famiglie con anteprima visiva: ZAINO, Arial, Verdana, Georgia, Courier, **Atkinson Hyperlegible**, **Atkinson Hyperlegible Next**, **TestMe Sans** e **TestMe Sans Alternate**. Le famiglie Atkinson e TestMe sono distribuite nell’app con licenze OFL e copiate nell’export; non richiedono installazione o connessione. Il selettore **Peso** offre i pesi originali della famiglia: Next comprende ExtraLight (200), Light (300), Regular, Medium, SemiBold, Bold ed ExtraBold (800), tutti anche in corsivo originale. L’Atkinson precedente resta separato e conserva i suoi quattro disegni. TestMe Sans e Alternate hanno Regular e Bold; il repository originale non distribuisce Light né corsivi disegnati (il browser sintetizza il corsivo). Provenienza e impronte sono in `App/assets/presentazioni/fonts/README.md` e `manifest.json`.

Carattere, Peso e Dimensione condividono corpo tipografico e `--tb-h`, alla scala `tbar-ctl` nei pannelli e alla scala compatta nel bubble. **G/C/S sono nella stessa riga dei controlli del font**, anche per didascalie e altri oggetti; negli split stretti la riga scorre orizzontalmente. Le lettere C e S sono visivamente corsiva e sottolineata anche nel bubble. Durante la scrittura font/peso/dimensione/colore e G/C/S operano sulle parole selezionate; interlinea e allineamento rimangono proprietà del riquadro. G imposta Bold/Regular; una scelta esplicita di Peso aggiorna anche lo stato di G. Cambiando famiglia, un peso non disponibile torna al normale o al grassetto compatibile, senza simulare un Light inesistente.

Le aree **TITOLO** e **TESTO** condividono campi brevi Font/Peso/Dimensione, selettori a icona per allineamento orizzontale e verticale e Interlinea compatta. **Posizione** è un comando nella stessa riga: apre la griglia adattiva in un bubble, senza una colonna permanente nelle proprietà. Celle, righe e colonne conservano hover e selezione verdi; Escape chiude prima la griglia, mantenendo l’oggetto selezionato. Tooltip e nomi accessibili distinguono ogni comando; nessuna modifica al titolo cambia lo stile del corpo. Scrivi sul foglio e Modifica sorgente Markdown sono affiancati quando c’è spazio.

In **TITOLO**, l’anteprima modificabile è larga 160px, con il titoletto Titolo sopra il campo, e precede il font nella prima riga. In **TABELLA**, **Modifica celle** occupa solo la larghezza del contenuto ed è nella stessa riga dei controlli tipografici. Negli split stretti i gruppi di controlli che non entrano passano nel bubble **… → Altri comandi di testo**, conservando ordine, dimensioni e valori. Il menu compare soltanto quando serve; riallargando lo split i controlli originali tornano nella riga. Posizione segue la stessa regola. Escape chiude prima l’eventuale menu interno, poi Altri, restituendo il focus al bottone; anche il clic esterno chiude il bubble. **SFONDO** mostra direttamente i colori, senza il titolo ripetuto; i comandi mantengono i nomi accessibili. L’icona della posizione verticale nel riquadro rappresenta il contenuto con un rettangolo, tra due guide grigie, anche nelle tre opzioni del menu.

I campi di contenuto (titolo, testo, elenco, formule, descrizione immagine e didascalie) mostrano un’anteprima breve con matita. Il clic apre un bubble di scrittura: autosalvataggio a ogni modifica, chiusura con la spunta, Escape o clic esterno. Per il testo già formattato il bubble riusa `PresentaScrittura`, lo stesso editor del foglio: font, dimensione e G/C/S sulle parole, formule e atomi conservati, senza conversione a testo semplice. Sorgente Markdown resta un’azione esplicita. Il salvataggio e la chiusura interrogano anche l’ultima modifica DOM non ancora notificata; un valore fuori limite resta visibile e correggibile. In IMMAGINE, Sostituisci/Ritaglia sono affiancati e descrizione/didascalia occupano due mezze colonne, impilate negli split stretti.

**Animazioni** è una sezione compatta per l’oggetto selezionato: ogni riga mostra Passaggio, Effetto ed elimina, alla stessa altezza dei campi. Passaggio è largo 72px, Effetto 208px; Aggiungi effetto occupa solo la larghezza utile. Le righe seguono l’ordine dei passaggi. Il menu distingue Entrata, Uscita ed Evidenza; il tooltip del numero spiega la simultaneità fra oggetti con lo stesso passaggio. I numeri indicano ordine e gruppi: la sequenza viene rinumerata senza salti e non inserisce clic vuoti. Aggiunta, modifica ed eliminazione restano annullabili. Negli split stretti scorre soltanto l’elenco dei controlli, senza allargare il foglio.

**Stile → Font** uniforma titolo, testo, elenco e didascalie. Conserva dimensioni, colori, contenuto e geometria; rimuove le eccezioni di famiglia degli oggetti e delle singole parole. Conserva gli altri formati e i pesi disponibili nella famiglia scelta; i pesi non disponibili tornano al normale/grassetto compatibile. Il valore è salvato in `settings.fontFamily`, ereditato anche dalle nuove slide, e una singola operazione Annulla ripristina le famiglie precedenti. La scelta del font del singolo oggetto può creare una nuova eccezione.

**Immagine → Ritaglia immagine** apre la sorgente originale: otto maniglie cambiano liberamente le proporzioni, il riquadro si sposta, i preset 1:1 / 4:3 / 16:9 / 3:4 accelerano la scelta. Frecce spostano, Maiusc aumenta il passo, Alt e frecce modificano larghezza e altezza. Applica registra un solo comando annullabile; Annulla lascia intatto il documento. Il ritaglio può essere riaperto o rimosso. `crop` conserva percentuali della sorgente e rapporto originale; la compilazione produce una viewport SVG locale. Originali e riquadro sulla slide non vengono modificati. Player, miniature ed export usano lo stesso ritaglio.

Audio e video espongono **Inizio (secondi)**, **Fine (secondi)** e **Usa media intero**; fine vuota significa fino al termine. Gli intervalli incoerenti sono rifiutati prima del salvataggio. Il player usa il media fragment dell’URL; l’anteprima dell’editor rimane muta. **Scegli e prova il frammento** apre il media reale in una vista isolata, con due cursori Inizio/Fine, durata e comandi Prova/Pausa. La durata viene letta dal file; Applica registra un solo comando, Annulla lascia intatto il documento. Non viene mostrata una forma d’onda inventata.

I gesti conservano le coordinate esatte degli altri oggetti. Il bubble segue lo spostamento; durante la scrittura resta disponibile e si riposiziona anche quando il pannello scorre o la finestra cambia dimensione. I puntatori cancellati non restano attivi e la generazione della selezione impedisce ai messaggi vecchi del frame di interrompere un gesto nuovo. Lo schema `presenta:` abilita CORS per i font dell’iframe a origine opaca, compresi quelli KaTeX, mantenendo URL temporanei e lista dei soli file autorizzati.

Le nuove slide da modello ereditano lo sfondo e gli stili per tipo dalla slide corrente, con riquadri nuovi e campi vuoti; nessun testo dimostrativo entra nella lezione. Una sola operazione Annulla rimuove la slide creata. Copia/incolla dell’oggetto funziona tra slide della stessa presentazione, con nuove identità e riferimenti ai media conservati. Si può usare il menu dell’oggetto e **Inserisci → Incolla oggetto**, oppure `⌘/Ctrl+C`, `⌘/Ctrl+V`; `⌘/Ctrl+D` duplica e Canc/Backspace elimina. Queste scorciatoie non sottraggono copia/incolla/cancellazione ai campi di testo. Gli appunti sono interni alla presentazione, non il clipboard di sistema, e non attraversano un cambio di documento. Il frame invia slide/versione insieme ai comandi: un evento riferito a un’anteprima superata non può eliminare un oggetto diverso.

Il prototipo separato `docs/mockup-presenta/prototipo-strumenti.html` esplora tre flussi dentro **B · Sul foglio**, senza riaprire la scelta del layout:

- `?variant=testo`: doppio clic per scrivere sul foglio, bolla contestuale, alternativa nei campi sotto, adattamento allo spazio e guide.
- `?variant=materiali`: inserimento dalla sidebar dimostrativa, sostituzione dell’immagine mantenendo il riquadro, zoom/posizione del ritaglio e scelta dell’intervallo audio/video. La riproduzione della clip è simulata, senza media reali.
- `?variant=stile`: modelli illustrati, anteprima degli stili, ambito slide/tutta la presentazione e proposta deterministica **Sistema la slide** con conferma/annulla.

Avvio: `node docs/mockup-presenta/prototipo-strumenti.js`, poi `http://127.0.0.1:8773/?variant=testo`. Le frecce nella barra in basso cambiano scenario. Dati sintetici solo in memoria; nessun accesso al vault o salvataggio dei contenuti. Il server serve soltanto questa pagina e legge CSS, token, icone e palette dal checkout. Il prototipo non è incluso nel runtime dell’app; quando le interazioni saranno validate, riscriverle nei moduli di produzione e archiviare il prototipo.

Questi flussi sono ora collegati al documento reale: scrittura e formati per parola, stili pronti, frammenti media con riproduzione, inserimento dalla sidebar principale e Sistema la slide. Il mockup rimane un riferimento storico in memoria. L’anteprima resta sempre alla massima larghezza disponibile, come richiesto; non torna il pulsante Adatta al foglio.

## Trascinare una slide come approfondimento

Trascinare la miniatura **al centro** di un’altra miniatura finché compare **Come approfondimento**, poi rilasciare. I bordi superiore e inferiore mostrano invece **Prima di questa slide** e **Dopo questa slide** per riordinare. Una principale porta con sé i suoi approfondimenti, mantenendo i contenuti e le note; la destinazione usa il solo livello verticale supportato da Reveal. Non è possibile inserire una principale sotto una propria slide. Annulla ripristina l’intero spostamento. Il menu della miniatura offre anche **Rendi approfondimento della slide precedente** e, per le slide verticali, **Rendi slide principale**.

## Scrittura e impaginazione nell’editor reale

Doppio clic su titolo, testo o voce di elenco (oppure **Scrivi sul foglio** / Invio sull’oggetto) entra nella scrittura. La bolla offre campioni dei font, dimensione, G/C/S, colore Tailwind, Automatico, collegamento web e rimozione dei formati. La selezione delle parole si conserva quando il menu prende il focus. Escape termina la scrittura e deseleziona; i gesti di trascinamento non muovono il box mentre si seleziona il testo. Anche le proprietà sotto il foglio agiscono sulle parole durante questa modalità.

I formati sono sequenze `richText` validate, mai HTML arbitrario: testo, stili consentiti, link HTTP(S), formule e blocchi Markdown conservati. `markdown` rimane una rappresentazione leggibile; `richText`, quando presente, è autorevole. Formule, codice e strutture Markdown complesse restano atomiche nel foglio. Per il corpo formattato, **Modifica sorgente Markdown** richiede la conferma della rimozione di font/colori/dimensioni per parola, ed è annullabile. La modifica ordinaria del titolo conserva gli stili delle parti rimaste uguali. Il testo viene salvato durante la digitazione, senza ricostruire il DOM sotto il cursore; salvataggio esplicito, cambio documento, presentazione ed uscita attendono una conferma dall’iframe per includere l’ultima battuta. Un testo fuori dai limiti di validazione impedisce la chiusura e rimane correggibile sul foglio. Nel player nativo i collegamenti web aprono il browser tramite il controllo URL già usato dall’app; l’anteprima di editing non naviga.

**Stile** raccoglie Font e Applica a in due campi compatti. A fianco, una galleria orizzontale mostra Essenziale, Leggibile (Atkinson), Lavagna (TestMe) e sei slot personali, tutti con campioni di titolo, testo e immagine. Il pulsante + di uno slot apre la personalizzazione: nome, famiglia, dimensioni di titolo/testo e tre colori Tailwind. Salva stile registra la preferenza, senza applicarla al documento; clic sulla tessera la applica a Questa slide o Tutte le slide, la matita la modifica e Svuota slot la rimuove. Gli slot sono conservati in questo profilo dell’app, condivisi fra presentazioni; i valori applicati fanno parte del documento e dell’export. Il selettore Font agisce sempre su tutte le slide, mentre Applica a riguarda le tessere. Uniforma font, dimensioni e colori, conservando contenuti, posizioni e G/C/S delle parole. **Disposizione** presenta tre miniature senza didascalie, con nomi nei tooltip: immagine a sinistra, testo a sinistra, immagine sopra. La bacchetta **Sistema la slide**, nella quarta tessera delle stesse dimensioni dei modelli, propone titolo in alto e contenuti distribuiti, senza eliminarli: la proposta appare in una finestra separata e solo Applica cambia il documento. Una sola operazione Annulla ripristina la disposizione precedente.

**Colori**: Bianco, Nero, **Nuovo colore** (palette Tailwind) e cinque slot personali stanno sulla stessa riga finché c’è spazio, poi vanno a capo. Non esiste più un comando Salva colore: scegliere nella palette memorizza subito il colore nel primo slot libero, senza duplicati; a slot pieni il nuovo colore sostituisce quello inserito per primo. Clic su uno slot pieno applica il colore; clic destro (oppure Maiusc+F10) apre il bubble menu **Modifica colore / Elimina colore**. Modifica apre la palette per sostituire quello slot; Elimina svuota la preferenza senza modificare il documento o l’ultimo colore ricordato. Uno slot vuoto mostra «–» e apre direttamente la palette. Tutti i pulsanti colore hanno la stessa altezza e hover verde, senza cornice esterna sugli slot. Le etichette sono identificatori Tailwind; i vecchi colori fuori palette restano conservati e indicano il campione più vicino con ≈. Memoria locale al profilo, conservata anche dopo la chiusura dell’app.

**Maiusc + clic** aggiunge o toglie oggetti dalla selezione. I comandi sotto il foglio allineano bordi e centri e distribuiscono tre o più oggetti; Duplica selezionati ed Elimina selezionati sono operazioni singole annullabili. Trascinamento e frecce muovono insieme gli oggetti selezionati, mantenendoli sul foglio. La copia fra slide resta per singolo oggetto. **Maiusc + trascinamento** vincola il movimento all’asse orizzontale o verticale scelto dal primo movimento significativo; il vincolo vale anche con guide magnetiche e selezioni multiple. Rilascia Maiusc per tornare al movimento libero. **RIGHELLI** ospita il ciclo spenti → 2×2 → 3×3 → 4×4, **Guide magnetiche**, attivabile indipendentemente, e **Passo delle frecce**: 0,1%, 0,25%, 0,5%, 1%, 2% o 5% della slide (default 1%). La percentuale si riferisce alla larghezza per destra/sinistra e all’altezza per su/giù; Maiusc triplica il passo. La scelta si ricorda su questo Mac e non entra nel file della presentazione. Durante la scrittura le frecce continuano a muovere il cursore. Gli schemi suddividono l’area entro i margini 7–93% e restano visibili anche durante la scrittura. Con l’aggancio attivo, margini, centri, griglia corrente e altri oggetti diventano riferimenti magnetici; Alt sospende temporaneamente l’aggancio. I selettori lungo il bordo di POSIZIONE scelgono una riga o una colonna, spostando l’oggetto soltanto su quell’asse; tutte le celle interessate sono evidenziate in verde. Le guide restano un aiuto dell’editor e non compaiono in proiezione o nell’export.

**Sostituisci immagine** sceglie un’altra immagine dello zaino conservando identità, riquadro e stile. Il vecchio ritaglio viene rimosso perché riguarda una sorgente diversa; Annulla ripristina anche quello. Il trascinamento dalla sidebar copia il materiale nella slide e non lo rimuove dalla raccolta.

**Inserisci → Aggiungi forma** offre rettangolo, ellisse e freccia con colore modificabile. **Aggiungi tabella / Modifica celle** apre una griglia con etichette per riga e colonna, aggiunta/rimozione di righe e colonne (massimo 20 × 10) e conferma prima di eliminare celle non vuote. La prima riga è di intestazione. Tabelle, forme, font e formati delle parole passano attraverso lo stesso compilatore in miniature, proiezione ed export.

### Prove manuali consigliate

1. Scrivere direttamente nella slide, selezionare una parola e cambiarne font/colore/G/C/S; provare Escape e Annulla/Ripeti. Chiudere e riaprire il documento.
2. Applicare un font comune e uno stile a tutta la presentazione; annullare. Aprire Sistema la slide, prima annullare la proposta, poi applicarla.
3. Ritagliare un’immagine e riaprire il crop; sostituire l’immagine mantenendo il riquadro. Trascinare un’immagine o un audio dalla sidebar.
4. Scegliere e riprodurre un frammento audio/video reale. Selezionare più oggetti con Maiusc, allinearli e muoverli insieme; provare le guide.
5. Inserire una forma, una tabella e un collegamento; presentare ed esportare in una cartella diversa, verificando il risultato dopo la riapertura.

Verifiche automatiche: suite Node completa di 91 programmi; campagna editor con selezione per parola, disco/riapertura, formule conservate, stili/proposta/annulla, clip, drag sidebar, gruppi, sostituzione, forme e tabelle; sicurezza e toolbar; player offline dopo spostamento e chiusura reale con disco guasto e ultima battuta ancora nell’iframe. I gesti su LIM, più monitor fisici e Windows richiedono ancora prova manuale.

## Decisioni già fissate

- Documento JSON strutturato, con blocchi e layout guidati; l’HTML è un risultato della compilazione.
- Percorso principale orizzontale e approfondimenti verticali, con due soli assi.
- Reveal.js 6.0.2 e KaTeX 0.18.2 locali; Markdown analizzato con Marked 16.4.2 e renderizzato attraverso una lista consentita di token.
- Note private escluse dal documento pubblico e dal pacchetto HTML. Le citazioni interne nel Markdown diventano etichette statiche nell’esportazione.
- Duplicazione ordinaria con nuove identità. L’operazione esplicita `statoSuccessivo` conserva le corrispondenze Auto-Animate, distinte dalle identità dei blocchi.
- Le toolbar riusano `.tbar`, `.tbtn`, `--tb-*`, la palette dei comandi e `UiIcone`. Le misure e gli stati dei comandi sono ereditati dal design system; il layout del Banco resta quello esistente.
- Creazione di slide mediante drop nella panoramica ancora P1; possibile anticipazione soltanto se riusa le operazioni esistenti senza un secondo meccanismo. Generazione AI e PDF restano P1.

## Mappa degli innesti

| Punto reale | Uso |
| --- | --- |
| `main.js::createWindow` | Installa il servizio PRESENTA sulla WebContents della finestra principale |
| `lib/presentazioni-ipc.js::installa` | Controlla mittente, frame principale, zaino e privilegi del disco per ogni richiesta |
| `lib/presentazioni-ipc.js::ponte` e `bin/preload.js::genera` | Generano `window.vault.presentazioni`; il preload generato non si modifica a mano |
| `App/StudIA.html::bancoStrumenti`, `bancoAggiornaDocumenti` | Registro di PRESENTA/GOBBO, titoli dei documenti e protezione del pannello privato |
| Evento `studia:zaino-changed` | Riallineamento dell’editor, annullamento dei risultati obsoleti e chiusura della sessione al cambio di contesto |
| `App/assets/lim/modello.js::trasporto/leggiTrasporto` | Envelope esistente con tipo, ID e zaino, già prodotto dai drag di Parole e Album |
| `lib/lim.js::comando`, azione `materiale` | Risolve le identità reali delle parole e delle immagini con provenienza e byte originali |
| `lib/materiali.js::trova` | Risolve audio/video nello stesso zaino, senza accettare percorsi assoluti dal trasferimento |
| `lib/citazioni-zaini.js::identita` | Riusa l’UUID di `_identita.json`, stabile dopo la rinomina dello zaino |
| `lib/appunti.js::writeAtomicAsync` e `lib/appunti-coda.js::crea` | Scritture atomiche e coda seriale per documento |
| `lib/validate.js::validatePresentazione` | Schema Ajv e integrità referenziale del modello |
| `lib/pacchetto.js` | Presentazioni condivise con l’opzione dei contenuti personali; bozze e copia precedente sempre escluse |

I contratti drag `application/x-studia-album` e `application/x-studia-evidenza` non cambiano. Il ricevitore può usare l’envelope aggiuntivo `application/x-studia-lim` già emesso dal checkout: conserva anche lo zaino d’origine. Per i media è predisposto un ingresso versionato `{version:1,tipo:'audio'|'video',file,corso}`; l’Album produce `application/x-studia-presenta-media` per audio/video. I payload preesistenti di Parole e immagini sono conservati.

## Archivio e risorse

```text
Zaini/<cartella dello zaino>/PRESENTAZIONI/<UUID presentazione>/
  presentazione.json
  _precedente.json
  _bozza.json
  assets/<SHA256>.<estensione>
```

La lettura non crea cartelle. `schemaVersion` identifica il formato; `revision` cresce soltanto nel main dopo il salvataggio. Il documento contiene l’UUID stabile dello zaino, non il nome della sua cartella. Un salvataggio deve indicare la revisione di partenza: se è cambiata, viene rifiutato senza sovrascrivere il documento. Le versioni di formato sconosciute e i campi non riconosciuti vengono rifiutati, senza riscritture distruttive.

`bozza` registra esplicitamente il contenuto da recuperare; `recupera` può leggerlo separatamente da `apri`, anche se il documento principale è illeggibile. Il consumatore deve confrontare la sua revisione di partenza con quella aperta: una bozza vecchia non si applica automaticamente. `_precedente.json` conserva la revisione precedente. Un errore nella sostituzione atomica conserva il file corrente. La coda continua a funzionare dopo l’errore.

Immagini e media vengono copiati nella cartella della presentazione prima di inserirne il riferimento. Le copie identiche dello stesso formato riusano il file con impronta SHA256. I ritagli portano soltanto i pixel dell’Album, non il PDF completo. Rimandi e provenienza sono separati dalla copia. Gli originali restano nelle raccolte. Non c’è ancora raccolta automatica delle risorse inutilizzate: devono restare disponibili per annulla/ripeti e bozze.

Limiti iniziali: 8 MiB di JSON, 300 slide totali, 200 blocchi per slide, 512 MiB per singolo media. Formati supportati dal catalogo e riproducibilità nel browser sono due verifiche distinte: una firma riconosciuta non garantisce che il codec sia disponibile.

## Galleria delle animazioni

Selezionare un oggetto e aprire **ANIMAZIONI → Scegli un’animazione**. Il comando ANIMAZIONI usa gli stessi token dei pulsanti, con chevron e stato aperto evidenziato in verde. La galleria offre 38 effetti in sei categorie, con campioni di testo, elenco, tabella, forma e pianeta. Scorre soltanto la griglia: filtri, esempio e conferma rimangono visibili. Hover/focus riproducono la tessera; il clic seleziona l’esempio grande, **Rivedi esempio** lo ripete. Solo **Applica all’oggetto** modifica la slide. Gli effetti riservati a un altro tipo di oggetto restano esplorabili con il motivo dell’incompatibilità; non possono essere applicati.

**Sfoca**, in Evidenza, applica una sfocatura di 8 px dopo il clic. **Messa a fuoco**, in Entrata, passa da sfocato a nitido. Sono disponibili sugli oggetti visivi, esclusi navbar e numeratore; funzionano anche sui testi senza aggiungere filtri fotografici nei loro pannelli. Tornando indietro si ripristina l’aspetto precedente. Con movimento ridotto il risultato finale è immediato.

- Entrata: Comparsa, Dal basso, Dall’alto, Da sinistra, Da destra, Zoom leggero, Rimbalzo, Ruota ed entra, Tendina, Apri.
- Uscita: Scomparsa, Esci a sinistra/destra/in alto/in basso, Riduci e scompari.
- Evidenza: Ingrandisci, Riduci, Evidenzia, Pulsazione, Scuoti, Oscilla, Giro completo.
- Sequenza: Una lettera alla volta, Una parola alla volta, Una riga alla volta, Punti in sequenza, Righe in sequenza e Colonne in sequenza (tabella).
- Disegno: Disegna la forma, Sottolinea.
- Percorso: rettilineo, arco, orbita, onda, zig-zag; tutti tornano al punto iniziale.

La galleria verifica gli effetti riconosciuti dal processo che salva. Se il codice dell’app è cambiato mentre ZAINO era aperto, gli effetti non ancora disponibili sono indicati con **Richiede riavvio**, con Applica disabilitato: occorre salvare, chiudere e riaprire tutta l’app. Ricaricare soltanto la finestra non aggiorna lo schema e il motore nel processo principale.

Ogni effetto mostra il clic e il numero nella sequenza della slide. **Avvio** sceglie **Al clic**, **Insieme al precedente** o **Dopo il precedente**; il precedente è l’effetto subito prima nell’ordine globale, anche su un altro oggetto. **Durata (s)** regola il tempo totale, **Attesa (s)** aggiunge una pausa rispetto all’avvio scelto. Per i percorsi, **Distanza** offre Breve/Media/Ampia. Le frecce riordinano gli effetti nella slide, il cestino elimina; il nome dell’effetto riapre la galleria per sostituirlo. Tutte le modifiche sono annullabili e autosalvate. I controlli vanno a capo negli split stretti.

**Prova la slide** apre il contenuto corrente con **Avanti**, **Indietro** e **Ricomincia**. La prova non cambia il documento. L’editor resta statico per consentire selezione e scrittura. Le sequenze di lettere, parole, righe e celle si svolgono automaticamente nel singolo clic; non sono clic distinti per ogni elemento. Le formule e i frammenti di codice sono esclusi dalla divisione del testo. La divisione in lettere usa i grafemi Unicode, preservando accenti ed emoji composti. I percorsi sono preset, non tracciati disegnabili liberamente.

L’esecutore condiviso `animazioni-dom.js` usa **Anime.js 4.5.0**, inclusa localmente con licenza MIT e impronta SHA-256. Il modulo puro `animazioni.js` gestisce catalogo, compatibilità e tempi. Reveal conserva il controllo di slide e passaggi. Navigazione indietro, cambio slide e chiusura ripristinano stili e contenuti; con movimento ridotto si applica subito il risultato finale al clic. L’HTML esportato contiene lo stesso motore e funziona offline; i pacchetti esportati prima dell’aggiornamento devono essere esportati di nuovo.

## Modello, animazioni e matematica

`App/assets/presentazioni/modello.js` contiene operazioni pure e cronologia annulla/ripeti. Sono previsti titolo, testo Markdown, lista con ID stabili delle voci, formula, immagine, audio e video. Ogni blocco ha contenuto, stile e provenienza separati. La disposizione libera usa `style.box` con x/y/larghezza/altezza in percentuale, validate entro il foglio. Sfondo della slide e posizione verticale del contenuto sono opzionali e seguono anche il player e l’export. Le disposizioni precedenti continuano ad aprirsi senza riscrittura: il primo gesto sul foglio converte le misure visualizzate in posizioni libere, con un’unica operazione annullabile. La selezione e i movimenti intermedi del mouse non scrivono sul disco; il rilascio registra il gesto nella cronologia. Un singolo comando di inserimento può portare insieme blocco e descrittore della risorsa.

Le animazioni sono azioni ordinate, anche multiple sullo stesso bersaglio. Le azioni nello stesso passaggio possono partire insieme o in successione; effetti successivi generano wrapper annidati. `start` distingue `click`, `with` e `after`; `duration` e `delay` sono espressi in secondi, `distance` in coordinate della slide. I documenti precedenti, privi di queste proprietà, mantengono i gruppi simultanei originali. Il primo effetto sul bersaglio determina la visibilità iniziale: un ingresso successivo non nasconde quello precedente. Gli indici visuali sono consecutivi e partono da 1; `indiceFragment` è l’adattatore verso gli indici Reveal, che partono da 0. L’eliminazione di un bersaglio ricompatta i gruppi rimasti.

Il player distingue avanzamento sequenziale, salto di argomento e movimento verticale. Il comando diretto `vai` e i salti direzionali riaprono la destinazione dal passaggio iniziale; Avanti/Indietro seguono la sequenza nativa di Reveal, compresi i fragment. La preferenza di movimento ridotto elimina le transizioni e le interpolazioni, conservando i passaggi didattici.

Il renderer preserva `\(...\)`, `\[...\]` e `$$...$$`; il singolo dollaro non è un delimitatore automatico. Analizza il Markdown prima di generare il solo HTML consentito. HTML grezzo, handler e URL eseguibili non sono accettati come markup della presentazione. Le formule vengono compilate con KaTeX, `trust:false` e limiti di espansione; una formula errata produce un errore locale senza bloccare le altre. Il player include anche il plugin Math ufficiale configurato con i file locali e attende i font prima del layout.

## Sessione e vista pubblica

`lib/presentazioni-sessione.js` conserva una revisione fissata, un solo player autorevole e l’ultimo stato confermato. I messaggi sono associati a sessione, identità dello zaino, presentazione, revisione e sequenza. Il cambio di autorità revoca il token precedente; i messaggi obsoleti vengono rifiutati. Il timer usa un orologio monotono e vive nel coordinatore, non nel pannello.

La regia privata riceve le note della revisione fissata. Il player riceve HTML compilato e metadati delle sole risorse usate: niente note né provenienza. Il player autonomo non ha un preload del vault e non carica il plugin note standard. I media partono tramite controllo esplicito, salvo l’opzione sul singolo blocco; cambiare slide ferma quelli lasciati indietro.

`lib/presentazioni-player.js` collega il coordinatore alla finestra pubblica sandboxed. Il preload pubblico espone soltanto pronto/conferma e ricezione dei comandi, senza `vault`. GOBBO segue la posizione confermata dal player; le richieste di una sessione vecchia sono rifiutate. Chiudere e riavviare crea una nuova sessione. La finestra si apre sul secondo schermo se presente; il selettore in GOBBO permette di spostarla. La proiezione esistente di PDF, appunti e lavagna conserva il proprio percorso.

`lib/presentazioni-vista.js` serve il runtime e i media tramite URL `presenta://` a capacità temporanea. Ogni URL identifica un file espressamente autorizzato; nessun percorso arbitrario o file JSON del vault può essere richiesto. Le capacità dei media sono revocate alla chiusura del documento/sessione. L’anteprima è un iframe `sandbox="allow-scripts"`, senza `allow-same-origin`, senza preload e con media passivi; i messaggi controllano la finestra sorgente e il canale. Il player imposta esplicitamente la modalità slide, anche negli split stretti. La navigazione è condivisa con il pacchetto esportato in `navigazione.js`.

## Autosave e transizioni

`App/assets/presentazioni/documento.js` conserva cronologia, revisione del disco e bozza separatamente. Autosave dopo 600 ms; una scrittura per volta. Il testo digitato durante una scrittura rimane da salvare e viene scritto nel giro seguente. Annulla/ripeti non riportano indietro la revisione del disco.

Cambio zaino, rinomina/eliminazione dello zaino, cambio documento, esportazione e presentazione attendono le scritture necessarie. Anche il cambio della cartella vault passa da un flush prima del selettore. Per la chiusura nativa, il main intercetta `close`, richiede il flush al renderer e prosegue soltanto dopo la conferma associata a quella richiesta; non dipende da un `beforeunload` asincrono. Una ricarica con modifiche pendenti viene bloccata e avvia il salvataggio; può essere ripetuta dopo **Salvato**.

Un errore conserva la bozza in memoria e tenta una copia di recupero; se anche quella fallisce lo dice. Cambio contesto e chiusura sono impediti. Una bozza dello stesso documento e della stessa revisione può essere recuperata esplicitamente alla riapertura. L’errore non viene spacciato per un salvataggio riuscito.

## Build, dimostrazione e verifiche

Il runtime sotto `App/assets/presentazioni/vendor/` contiene script, CSS, font e licenze. Il manifest registra versione e impronte; la ricetta confronta i file con le dipendenze fissate nel lockfile. Il percorso `App/**` è incluso nel packaging desktop esistente.

```bash
npm run presenta:build
npm run presenta:verifica
node test/presentazioni.js
node test/presentazioni-elementi.js
npm run test:presenta-player
npm run test:presenta-chiusura
npm run presenta:demo -- /percorso/assoluto/destinazione
```

La dimostrazione usa un vault temporaneo sintetico. Genera Sistema solare, Pianeti, Orbite e approfondimenti, formule valide e una volutamente errata, un’immagine tecnica minima e un tono WAV. Stampa la cartella da cui aprire `index.html`; non usa i dati personali. Il pacchetto HTML può essere spostato e aperto senza server e senza rete. Un media mancante o con impronta diversa interrompe l’esportazione prima di dichiarare successo.

Le prove Node coprono operazioni, undo/redo, struttura verticale, corrispondenze, serializzazione, conflitti, disco guasto, bozze, risorse, isolamento, rinomina dello zaino, rendering, privacy, sessione ed esportazione. La prova della privacy è stata fatta diventare rossa reinserendo le note nel payload pubblico in un processo di test separato.

`test/presentazioni-player.js` usa Electron con profilo e vault sintetici: verifica il player reale dopo lo spostamento del pacchetto, i passaggi simultanei e inversi, gli elementi riconosciuti da Auto-Animate verticale, le formule, pausa dei media e assenza di richieste remote. Non è una prova su una LIM fisica.

```bash
npm test
bash bin/prova-zaino.sh prova-presenta-fondazioni.js prova-presenta-editor.js prova-presenta-elementi.js prova-sicurezza.js
```

La prova CDP attraversa il preload e l’IPC reali di ZAINO. È registrata nel runner sintetico e ora usa anche eventi nativi del mouse per spostamento e ridimensionamento degli oggetti. Il test esistente `prova-presentazione.js` si ferma sul passaggio nativo a schermo intero della finestra esterna, nello stesso punto sia sul ramo sia sulla copia del commit iniziale `20a314b`. Le altre verifiche passate non vengono presentate come collaudo di quel passaggio, degli schermi esterni, di Windows o degli installatori.

## Verifiche dell’integrazione e limiti

`test/presentazioni-editor.js` prova scrittura durante autosave, revisioni dopo undo/redo, flush, recupero dopo errore e limiti/revoca degli URL media. Il controllo del flush è stato fatto diventare rosso sostituendo la transizione con una che non salva, in un processo separato.

`test/cdp/prova-presenta-editor.js` attraversa la UI vera e i produttori drag di Album: creazione da modale, campi, matematica effettivamente visibile, immagini caricate, audio passivo nell’anteprima, menu alternativo, riapertura, spostamento/riduzione del Banco, cambio zaino con ultima battuta pendente, player pubblico senza note/API vault, pausa del media uscendo dalla slide e GOBBO sincronizzato. Le prove aggiunte controllano anche caricamento reale dei font (font-face, non solo CSS dichiarato), altezza dei campi, font comune e undo, ritaglio riapribile/persistente e intervalli media. I drag consegnati da CDP restano prove degli handler, non un collaudo fisico su LIM.

`test/presentazioni-chiusura.js` chiude davvero la finestra con un disco guasto simulato, controlla che restino finestra, ultima revisione e bozza, poi riprova con una scrittura rallentata e controlla l’ultima battuta sul disco dopo la chiusura.

La composizione libera è disponibile: il click seleziona l’oggetto, trascinamento e maniglia modificano il riquadro, i campi contestuali modificano il contenuto. Un gesto corrisponde a un solo Annulla e le coordinate sono indipendenti dalle dimensioni dello split. L’anteprima mostra tutti i passaggi animati per consentire la selezione; il pubblico mantiene la sequenza prevista. Un avviso segnala contenuto che non entra nel riquadro. Per il testo verifica i glifi visibili, separandoli dallo spazio vuoto delle metriche del font: un titolo Atkinson grande non viene segnalato se le lettere entrano. I tagli reali di testo, tabelle e media continuano a essere controllati. Le note private non entrano neppure nei metadati dei messaggi dell’anteprima. Le miniature usano il contenuto compilato e il CSS condiviso; le immagini sono ridotte in memoria nel main dopo la verifica delle risorse, senza estendere il CSP della finestra. Il drag riordina gli argomenti insieme ai loro approfondimenti; un approfondimento può essere spostato fra sequenze o reso autonomo. Il menu visibile **…** di ogni miniatura, disponibile anche con click destro o Maiusc+F10, offre nuova slide/approfondimento, duplica, copia/incolla stile, stato animato, spostamenti ed elimina. Lo stile copiato contiene solo layout, sfondo e proprietà visuali per tipo di oggetto. Il bubble menu del canvas offre adatta riquadro al contenuto, centra, duplica, livelli ed elimina. Resta la rotazione libera degli oggetti; scrittura sul foglio, guide e galleria delle animazioni sono disponibili.

La riapertura di una finestra pubblica chiusa avvia una nuova sessione dall’inizio; il trasferimento dell’autorità fra un player locale e quello esterno, preservando il passaggio in corso, resta da aggiungere. GOBBO mostra le note della slide attuale, non un’anteprima grafica della successiva. La riparazione da UI di un archivio con JSON principale corrotto non è ancora offerta: l’errore è dichiarato e le copie restano sul disco.

Restano i collaudi con trascinamento fisico, LIM, più monitor fisici, Windows e installatori. PDF, AI, PPTX e drop che crea nuove slide nella panoramica restano fuori da questa consegna. Non dichiarare P0 completo sulla sola base del percorso iniziale utilizzabile.

Per riprodurre il controllo visuale sintetico con il CSS e l’editor veri: `./node_modules/.bin/electron docs/mockup-presenta/avvia.js`. Usa un profilo temporaneo e non apre un vault personale. Non sostituisce le prove della UI nell’app.

## Correzioni dei gesti nel mockup Sul foglio

Il prototipo `docs/mockup-presenta/prototipo-strumenti.html` conserva in memoria anche il markup del testo e le dimensioni dei riquadri. Il doppio clic entra nella scrittura; font, dimensione, colore e G/C/S rispettano la selezione sul foglio. Un clic sullo spazio libero o Escape chiude la modifica e nasconde la selezione e il bubble menu. I controlli contestuali conservano la selezione delle parole mentre vengono usati.

Un solo gesto di puntatore può essere attivo: cattura immediata, soglia prima della modifica, fine su rilascio/cancellazione/perdita della cattura o del focus. Il bubble menu segue il riquadro anche durante lo spostamento e il ridimensionamento del foglio. Le modifiche alle proprietà conservano le coordinate e le dimensioni degli altri oggetti.

Ritaglia offre otto maniglie libere e proporzioni Libero, 1:1, 4:3, 16:9 e 3:4. Conferma ritaglio nasconde le maniglie; Ritaglia riapre la stessa geometria. Ingrandimento e trascinamento all’interno spostano l’immagine nel riquadro; Adatta/Ripristina immagine riportano alla vista iniziale. Annulla e Ripeti comprendono il ritaglio. È ancora una dimostrazione SVG in memoria, senza modifica dei file originali o integrazione del crop nell’app.

Verificati nel browser incorporato: deselezione, grassetto/font/colore/dimensione su una sola parola e conservazione dopo ridisegno, spostamento con menu solidale, coordinate degli altri oggetti invariate, rapporto quadrato/panoramico, maniglia laterale, conferma/riapertura e annullamento. Le prove dell’app descritte sopra si riferiscono alla tranche precedente; questa correzione interessa soltanto il prototipo.

Nel mockup le proprietà tipografiche usano la scala `tbar-ctl`: selettore del carattere e Dimensione leggono entrambi `--tb-h`, che in questa scala deriva da `--ctl-h` (40px). Il bubble mantiene la scala normale della toolbar. In **Stile → Font** la scelta applica un font comune a titolo, testo, didascalie e miniature, rimuovendo solo le eccezioni di famiglia dai formati delle parole. Una sola operazione Annulla ripristina i font precedenti; le nuove slide ereditano il carattere corrente. Verificati nel browser i due campi allineati, l’uniformazione su tre slide, nuova slide, undo/redo e conservazione di grassetto e colore. Questa impostazione e la formattazione delle singole parole sono state trasferite nell’editor reale; i paragrafi di questa sezione descrivono le verifiche storiche del prototipo.

### Regressioni dei controlli e del trascinamento

`bash bin/prova-zaino.sh prova-presenta-controlli.js` usa esclusivamente un vault sintetico. Controlla trascinamenti dopo modifiche, gesti fermati al margine, griglia con guide magnetiche, scrittura e ritorno fra mezzo schermo, tutto banco e quarti. Misura inoltre i cerchi a diametro minimo e le distanze/altezza dei controlli a 1900, 700 e 390 px. La conferma della geometria usa un identificatore di richiesta: anche un movimento senza variazione di posizione termina l’attesa del frame, senza affidarsi a una ricompilazione o al resize.

## Revisione INTRO ZAINO e sequenze — 12 novembre 2026

«Una lettera alla volta» anima l’opacità di elementi inline: i contenitori inline-block consentivano interruzioni fra le lettere e spostavano parole fra le righe. La regressione dell’export misura ora la riga di ogni carattere prima e durante l’effetto, conservando corsivo, grassetto e ripristino del DOM.

Le sequenze hanno Ordine (dall’inizio/dalla fine) e Sovrapposizione (automatica oppure 0–100%). La durata comprende tutta la sequenza; il ritmo automatico conserva quello dei documenti precedenti. Schema, modello pubblico, editor, player ed export conservano `sequenceOrder` e `sequenceOverlap`. Il calcolo dei tempi è nel catalogo puro. Font, larghezza, interlinea e spaziatura di Pretext continuano a provenire dal testo e dal riquadro; le misure DOM restano il fallback dei contenuti ricchi. I nuovi selettori riusano i campi e i token di Avvio/Durata/Attesa, verificati nella UI.

Verifiche: 110 programmi Node completati con dipendenze isolate; catalogo di 38 effetti nel player offline con controlli di movimento, ritorno e movimento ridotto; `test/pretext-offline.js` (righe, ordine inverso esportato, Unicode, font e più viewport); `prova-pretext.js` e `prova-presenta-controlli.js` nell’app reale. Il primo controllo dei crediti è stato falsato da un `node_modules` condiviso via symlink: una reinstallazione dal lockfile in una cartella indipendente ha eliminato l’errore, senza modificare i crediti.
