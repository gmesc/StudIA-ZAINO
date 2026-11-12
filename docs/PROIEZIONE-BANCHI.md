# Finestra esterna e puntatore laser

La finestra esterna resta aperta quando si ingrandisce un banco nella finestra principale. Se il banco proiettato viene temporaneamente nascosto dall’ingrandimento di un altro banco, la finestra esterna mantiene l’ultimo quadro. Tornando alla vista a banchi, riprende gli aggiornamenti. Rimuovere realmente il banco o cambiare zaino conserva il comportamento di chiusura esistente.

Dentro l’area arancione proiettata:

- Il semplice movimento del mouse non trasmette alcun puntatore.
- Tenere premuto il tasto destro mostra il puntatore sia nel banco principale sia nella finestra esterna. Il relatore vede subito il proprio gesto.
- La traccia resta visibile durante il gesto. Rilasciare il tasto, anche fuori dall’area, avvia la dissolvenza scelta, da 0 a 2 secondi. Con 0 il segno resta fino al nuovo clic destro.
- Esc cancella anche un segno lasciato fisso. Spostare o ridimensionare l’inquadratura rimuove la vecchia traccia per evitare indicazioni fuori posto.

L’ingranaggio a sinistra di **Area proiettata** apre i controlli compatti:

- **Laser**, **box** e **cerchio** a icona. Il box si trascina fra due angoli; il cerchio dal centro al bordo.
- **Spot** lascia nitido l’interno e applica dimmer nero al 50% e sfocatura di 8 px all’esterno. Il rettangolo ha angoli leggermente arrotondati, con lo stesso profilo per bordo e maschera nei due schermi. Con Laser il contorno si chiude automaticamente come un lazo.
- **Bordo** da 0 a 12 px; 0 spegne il contorno. Colori blu, rosso e verde.
- **Dissolvenza** da 0 a 2 secondi. Le preferenze rimangono disponibili alla prossima proiezione su questo Mac.

Il menu si chiude con ×, Esc o clic fuori. Aprirlo cancella il segno corrente.

Il gesto non modifica gli appunti, il PDF o altri documenti. Il menu contestuale è soppresso soltanto per il gesto laser nell’area proiettata. Fuori dall’area rimane disponibile.

Le coordinate sono normalizzate sul ritaglio arancione e trasmesse via IPC con sessione, origine e valori verificati. Forma, colore, spessore e durata sono validati prima della trasmissione. I due schermi usano un componente comune per geometria e dissolvenza; i livelli non intercettano clic. Nei pannelli proiettati come screenshot, traccia e maschera locale sono escluse dalla cattura: il dimmer non viene applicato due volte e non resta impresso nel contenuto. Il tooltip sulla maniglia arancione spiega il gesto.

Limite attuale: nella proiezione di FONTI le sottolineature vengono riprodotte, ma i disegni persistenti creati con Annota non sono ancora inclusi. Per mostrarli puoi aprire la copia PDF annotata esportata. Il laser e lo Spot funzionano direttamente nella proiezione.

Verifiche: `test/lettura-proiezione.js` copre il confine IPC; `test/cdp/prova-proiezione-laser.js` usa mouse reale, una finestra Electron esterna e un vault sintetico. Controlla identità della finestra durante ingrandimento/ripristino dei banchi, assenza del laser durante hover, coordinate anche con zoom esterno, persistenza e dissolvenza in entrambe le finestre, rilascio fuori area, documento invariato, proiezione del foglio A4 e assenza di tracce laser impresse negli screenshot.

`test/cdp/prova-proiezione-spot.js` verifica i comandi, le tre forme, la chiusura del lazo, bordo spento, colori, persistenza, dissolvenza e ripristino delle preferenze. Confronta i pixel dei due schermi per controllare che l’interno resti nitido e l’esterno sia oscurato; verifica che i fotogrammi trasmessi rimangano privi della maschera.
