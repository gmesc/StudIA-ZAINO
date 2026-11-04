# Aspetto dell’interfaccia e delle mappe

## Interfaccia

**Impostazioni → Aspetto → Font** offre ZAINO (predefinito) e Atkinson Hyperlegible. La scelta è immediata, locale e persistente sul computer; **Ripristina carattere** torna al predefinito. I font sono già inclusi nell’app, senza download. Il token dell’interfaccia è distinto da quello dei documenti: APPUNTI, stampa ed export mantengono il carattere del documento, PRESENTA e MAPPE mantengono le proprie scelte.

## Mappe

**MAPPE → ingranaggio → Stile e sfondo** contiene i preset **ZAINO, Essenziale, Leggibile, Lavagna e Pastello**, con campioni visivi. I preset coordinano font, dimensioni dei testi, stile dei collegamenti, colori, angoli e spessore. Non modificano contenuti, rimandi, posizioni manuali, zoom o rami chiusi. I colori manuali che identificano i nodi e i segni della loro origine restano distinguibili.

Si possono poi regolare font (catalogo comune di ZAINO), fondo dei nodi, testo, bordi, collegamenti, angoli e spessore. Lo sfondo offre tinta piena, puntini e linee con colori e distanza regolabili, oltre a **Carta cotone, Carta naturale e Carta chiarissima**, le stesse texture locali di PRESENTA. Le carte hanno solo fibre e imperfezioni naturali, senza righe o quadretti. Restano ferme sul contenitore durante pan e zoom della mappa; sono incluse anche nella stampa/PDF. Colore di fondo e controlli del pattern sono disabilitati quando non si applicano alla scelta corrente. La griglia di sfondo non è una griglia di aggancio dei nodi. Le altre leve di disposizione rimangono sotto il pannello richiudibile.

Ogni scelta è annullabile con Undo/Redo e si salva nella `vista.aspetto` del file della mappa, comprese le memorie delle disposizioni. Il main normalizza gli stessi campi con il modulo UMD `mappa/aspetto.js`. Il disegno usa attributi SVG per portare colori, tratti e sfondo anche nella stampa/PDF. Le barre colorate dei nodi arrotondati seguono il profilo interno della cornice, sia in alto sia sul lato sinistro; usano tracciati autonomi senza riferimenti di clipping fra miniature. La tela mostra il pattern alla scala dell’interfaccia, indipendente dallo zoom dei nodi; la stampa lo include nel disegno completo.

## Drawably: fattibilità per MAPPE e PRESENTA

Valutazione del 4 novembre 2026; nessuna dipendenza Drawably installata e nessun preset Drawably attivato in questa modifica.

Il progetto [Drawably](https://github.com/danielwh2/drawably) offre controlli HTML decorati con SVG e funzioni pure che producono tracciati: rettangoli arrotondati, linee, ellissi, frecce e riempimenti tratteggiati. Il [renderer](https://github.com/danielwh2/drawably/blob/main/src/rough.ts) permette una casualità riproducibile tramite seed. `boil: 0` mantiene il tratto fermo. La [licenza MIT](https://github.com/danielwh2/drawably/blob/main/LICENSE) consente l’integrazione mantenendo gli avvisi dell’autore.

Per ZAINO è preferibile un preset opzionale **Schizzo**, con la generazione dei tracciati condivisa fra schermo ed export:

- MAPPE: bordi dei nodi, linee e frecce, campiture. Un seed derivato dall’identità dell’elemento mantiene lo stesso tratto nei ridisegni, nel salvataggio e nel PDF.
- PRESENTA: forme, cornici degli oggetti, separatori delle tabelle e parti grafiche della navbar. Titoli e testo conservano il font scelto dall’utente; foto, GIF, video e disegni importati conservano i propri contenuti e possono ricevere una cornice coerente.
- Lo stile viene salvato nel documento e applicato dalla resa comune, senza cambiare geometrie, contenuti o gerarchie. Il tremolio continuo resta disattivato per impostazione predefinita; eventuale movimento sarebbe una scelta esplicita e rispettosa della riduzione del movimento.

Non basta applicare una classe CSS a tutti gli item: MAPPE è SVG e PRESENTA comprende HTML, SVG e media. I wrapper HTML della libreria, che aggiungono SVG nel DOM e osservatori di dimensione, non sostituiscono il motore di disegno o il contratto di export. Si userebbe il renderer puro con un bundle locale e versione fissata, più prove di geometria, salvataggio ed export. La freccia DOM della libreria ha inoltre un limite dichiarato con gli elementi in contenitori scorrevoli; i collegamenti della mappa devono restare nel sistema di coordinate della mappa.

## Verifiche

- `test/aspetto-svg.js`: preset senza mutazione, persistenza su disco, attributi SVG, sfondi, input non validi e DOCX vettoriale con PNG.
- Controprova sul codice precedente: il salvataggio perde `vista.aspetto` e il controllo fallisce.
- `prova-aspetto-mappe.js`: font UI, riavvio, separazione da CodeMirror, preset tramite mouse, Undo/Redo, salvataggio/riapertura e stampa; pannello in finestra 800 px e tema scuro.
- 97 programmi Node verdi e prove mirate APPUNTI/PRESENTA/MAPPE/toolbar verdi. Suite UI generale non interamente verde: dieci fallimenti riprodotti anche sulla base; la nuova interferenza delle miniature con l’audit icone è stata corretta e verificata. Dettagli e log nel handoff corrente.

- Revisione carta/barre del 4 novembre: 97 programmi Node verdi; `prova-aspetto-mappe.js` verifica caricamento delle tre texture, sfondo fermo con rotella, persistenza, PDF reale e pixel degli angoli con raggi 8/24 nei due orientamenti. Toolbar verde. PDF renderizzato e ispezionato. Log `/private/tmp/zaino-mappe-carta-node.log` e `/private/tmp/zaino-mappe-carta-ui-finale.log`.
