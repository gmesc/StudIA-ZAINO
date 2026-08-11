/* =========================================================================
   modifica — le OPERAZIONI di modifica del grafo di una mappa.

   Ogni operazione è PURA: prende un grafo, ne restituisce uno NUOVO, e non
   tocca quello che ha ricevuto. Non è purismo. L'annullamento qui è una pila
   di stati interi, e una pila di stati funziona solo se gli stati non cambiano
   sotto: basterebbe un'operazione che scrive dentro il grafo passato perché lo
   stato messo da parte per il ⌘Z diventasse identico a quello corrente — e
   l'annulla non annullerebbe più niente, in silenzio.

   Che cosa NON sta qui, e non ci deve entrare:
     · la famiglia e il colore di un arco — si RICAVANO leggendo il verbo
       (`relazioni.famigliaDi`), non si salvano (vedi `etichetta`);
     · i livelli, il genitore, il gruppo — li ricalcola `grafo.sanitizza` a ogni
       lettura, perché un livello dichiarato è un'opinione;
     · l'origine `'generata'` — la mette solo `lib/mappe.js → daGrafo()`, e solo
       a tutti i nodi in blocco quando semina la copia di una vista generata
       (vedi `origineChiesta`);
     · qualunque tocco al DOM o al disco: questo modulo non sa che esistano.

   Modulo PURO, UMD (vedi relazioni.js). Il globale arriva come ARGOMENTO alla
   factory: dentro la factory `root` non è in scope, ed è un errore che qui
   abbiamo già pagato una volta.
   ========================================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(null);
  else root.MappaModifica = factory(root);
}(typeof self !== 'undefined' ? self : this, function (glob) {
  'use strict';

  // il globale arriva come argomento: dentro la factory non è in scope
  var G = glob ? glob.MappaGrafo : require('./grafo');

  var TETTO = 20;          // quanti stati tiene la pila degli annullamenti
  var PREFISSO = 'u';      // i nodi dell'utente: 'u1', 'u2'… (i generati sono 'n1', 'n2'…)

  /* ------------------------------------------------------------- fondamenta */

  /**
   * Copia di lavoro del grafo. Nodi e archi sono oggetti NUOVI, così scrivere
   * su un nodo della copia non si vede nell'originale; le chiavi in più del
   * grafo (`titolo`, e qualunque cosa il chiamante ci appoggi) restano dov'erano
   * — un'operazione sui nodi non ha nessun motivo di perdere il titolo.
   *
   * Non è una copia profonda: `rimando` resta condiviso. È voluto — è un dato
   * del lettore che nessuna operazione qui dentro modifica, e duplicarlo a ogni
   * tasto premuto costerebbe senza comprare niente.
   */
  function copia(g) {
    var out = {};
    Object.keys(g || {}).forEach(function (k) { out[k] = g[k]; });
    out.nodi = ((g && g.nodi) || []).map(function (n) { return Object.assign({}, n); });
    out.archi = ((g && g.archi) || []).map(function (e) { return Object.assign({}, e); });
    return out;
  }

  function indiceNodo(g, id) {
    var nodi = (g && g.nodi) || [];
    for (var i = 0; i < nodi.length; i++) if (nodi[i].id === id) return i;
    return -1;
  }

  function esiste(g, id) { return id != null && indiceNodo(g, id) >= 0; }

  /**
   * L'arco fra due nodi, se c'è. Trova `da→a`; in mancanza trova `a→da` SOLO
   * se quello è bidirezionale.
   *
   * Il motivo: un arco a doppia punta non ha un capo privilegiato. Chi lo
   * guarda a schermo vede un legame fra A e B, non «da A verso B»; se
   * `eliminaArco(g, B, A)` non lo trovasse, cancellare un legame funzionerebbe
   * o no a seconda di come è stato disegnato mesi prima. Un'unica funzione per
   * tutti — eliminare, invertire, etichettare — così la regola non può valere
   * in un posto e non nell'altro.
   */
  function trovaArco(g, da, a) {
    var archi = (g && g.archi) || [], i;
    for (i = 0; i < archi.length; i++) if (archi[i].da === da && archi[i].a === a) return i;
    for (i = 0; i < archi.length; i++) if (archi[i].bidir && archi[i].da === a && archi[i].a === da) return i;
    return -1;
  }

  /** Il primo id libero. Non si conta quanti nodi ci sono — si guarda quali id
   *  sono occupati: dopo una manciata di eliminazioni i due numeri divergono, e
   *  un id riassegnato attaccherebbe alla mappa gli archi di un nodo morto. */
  function prossimoId(g) {
    var presi = {};
    ((g && g.nodi) || []).forEach(function (n) { presi[n.id] = true; });
    var i = 1;
    while (presi[PREFISSO + i]) i++;
    return PREFISSO + i;
  }

  /** Attacca al grafo una cosa da sapere sull'OPERAZIONE appena fatta — quale
   *  nodo è nato (`.nuovo`), quante posizioni sono state azzerate (`.liberate`)
   *  — senza scriverla DENTRO il grafo: la proprietà non è enumerabile, quindi
   *  `JSON.stringify` non la vede e non finisce nel file. È un'informazione
   *  sull'operazione, non un dato della mappa, e su disco sarebbe solo rumore da
   *  riparare poi.
   *
   *  Una funzione sola per tutte: la trappola del `defineProperty` copiato a
   *  mano è dimenticare `enumerable:false` alla terza volta, e allora quel campo
   *  finisce nel file mentre gli altri due no. */
  function segna(g, chiave, valore) {
    Object.defineProperty(g, chiave, { value: valore, enumerable: false, configurable: true });
    return g;
  }

  /* ----------------------------------------------------------------- nodi */

  /** Le origini che si possono CHIEDERE a mano. */
  var ORIGINI_A_MANO = ['utente', 'fonte'];

  /**
   * L'origine di un nodo nato qui. Tutto ciò che non è ammesso ricade su
   * `'utente'`, e il nodo nasce lo stesso: un'opzione sbagliata è un errore di
   * chi chiama, e farne sparire il nodo lascerebbe l'utente col gesto fatto e
   * niente a schermo (la stessa regola di `comeFiglioDi` con un id inesistente).
   *
   * ⚠️ `'generata'` NON è nell'elenco, e non è una dimenticanza. Quella marca la
   * mette solo `lib/mappe.js → daGrafo()`, e la mette a TUTTI i nodi in blocco,
   * perché lì è vera di tutti: la mappa nasce come copia di una vista generata.
   * Lasciarla passare da qui vorrebbe dire poter fabbricare a mano un nodo che
   * dichiara di venire da una generazione che non c'è stata — e lo dichiara nel
   * file, dove nessuno va a rileggerlo per smentirlo.
   */
  function origineChiesta(v) {
    return ORIGINI_A_MANO.indexOf(v) >= 0 ? v : 'utente';
  }

  /**
   * Il rimando che si appende al nodo è sempre una COPIA dell'oggetto ricevuto.
   *
   * ⚠️ Qui `copia()` non basta, e non deve bastare: quella CONDIVIDE `rimando`
   * di proposito (nessuna operazione di questo modulo lo tocca, e duplicarlo a
   * ogni tasto premuto costerebbe senza comprare niente). Ma un oggetto che
   * arriva da FUORI — dal punto corrente del lettore, catturato con ⌘⇧C — e
   * appeso al grafo così com'è lega la mappa a chi te l'ha passato: chi riusa
   * quell'oggetto per la cattura successiva riscriverebbe il minuto di un nodo
   * già posato, e lo riscriverebbe in silenzio, cioè nel modo che qui costa di
   * più.
   *
   * La copia è piatta perché piatta è la struttura (`{type, file, t|page,
   * label}`, quella che `openNote()` del lettore già sa aprire), ed è la stessa
   * che fa `mappe.normalizzaNodo`: due strati che copiano allo stesso modo non
   * possono divergere sul salvataggio. Il vocabolario del rimando sta lì, non
   * qui: questo modulo lo trasporta, non lo giudica.
   */
  function copiaRimando(r) {
    return (r && typeof r === 'object') ? Object.assign({}, r) : null;
  }

  /**
   * Una coordinata, o `null` se ciò che è arrivato non è un punto sul piano.
   *
   * ⚠️ Non `isFinite(+v)`, che è quello che c'era: `+null`, `+''` e `+false`
   * valgono ZERO, cioè un nodo inchiodato nell'angolo in alto a sinistra da un
   * campo che era semplicemente vuoto. Finché nessun motore leggeva le
   * coordinate il difetto era innocuo; da quando `layouts.run` le onora, un
   * chiamante distratto sposterebbe un nodo nell'origine senza volerlo e senza
   * vederlo, e per il motore quel nodo sarebbe fissato per sempre.
   *
   * Il controllo è sul TIPO, come in `grafo.fissato`, ed è deliberatamente
   * severo: `"120"` non è una coordinata. Le stringhe le raddrizza `lib/mappe.js`
   * in lettura, dove arrivano davvero (un file scritto a mano, una versione
   * vecchia); qui i numeri arrivano da un evento del puntatore, e accettare una
   * stringa vorrebbe dire scrivere sul nodo qualcosa che `fissato()` poi non
   * riconoscerebbe. L'invariante che vale la pena avere è: **ciò che questo
   * modulo scrive soddisfa sempre `fissato()`.**
   */
  function coordinata(v) {
    return (typeof v === 'number' && isFinite(v)) ? v : null;
  }

  /** L'indice del capitolo, o `null` se non ce n'è uno. Si distingue apposta lo
   *  ZERO dall'assenza: `capitolo:0` è il primo capitolo, e `+''` farebbe zero
   *  anche lui — un frammento senza capitolo finirebbe agganciato al primo. */
  function numeroCapitolo(v) {
    if (v == null || v === '') return null;
    return isFinite(+v) ? +v : null;
  }

  /**
   * Nodo nuovo.
   *
   * @param opt.testo         il testo (vuoto va benissimo: l'interfaccia apre
   *                          subito la casella di scrittura)
   * @param opt.comeFiglioDi  id del genitore → nasce un arco genitore→nuovo
   * @param opt.vicinoA       id di un fratello → il nuovo prende lo STESSO
   *                          genitore di quello, letto dalla foresta portante.
   *                          Se il fratello è una radice, anche il nuovo lo è:
   *                          il fratello di una radice non può che essere una
   *                          radice, e appenderlo altrove sposterebbe di nascosto
   *                          il ramo che l'utente stava guardando.
   * @param opt.origine       `'utente'` di fabbrica, `'fonte'` per un nodo
   *                          estratto (vedi `estrai`). `'generata'` no, mai:
   *                          vedi `origineChiesta`.
   * @param opt.rimando       il puntatore alla fonte, `{type, file, t|page,
   *                          label}` — copiato, non condiviso (`copiaRimando`)
   * @param opt.nota          testo libero. È dove finisce l'`anchor`: la frase
   *                          attorno al frammento estratto, la stessa idea che
   *                          hanno gli appunti. `disegna.js` la mostra nel
   *                          suggerimento della card.
   * @param opt.capitolo      l'indice del capitolo da cui viene il frammento.
   *                          Con `rimando` è l'altro modo di rendere navigabile
   *                          un nodo: `disegna.js` accende il segno della fonte
   *                          se c'è l'uno OPPURE l'altro.
   * @param opt.immagine     un ritaglio dell'album: `{id, w, h}`. Un nodo può
   *                          ESSERE un'immagine — `disegna.js` lo sa già fare —
   *                          ma finora nessuno gliela metteva.
   *                          ⚠️ Si copia, non si condivide, per la stessa ragione
   *                          di `rimando`: due nodi che puntano allo stesso
   *                          oggetto divergerebbero al primo salvataggio. E senza
   *                          `id` non si scrive niente: `disegna.js` promette
   *                          un'immagine solo se sa quale, altrimenti un nodo
   *                          mostrerebbe un segnaposto che nessuno può riempire.
   * @param opt.x, opt.y      posizione fissata a mano (vedi `sposta`)
   * @param opt.colore        colore scelto a mano
   * @returns un grafo nuovo; l'id del nodo appena creato è in `.nuovo`
   *          (proprietà non enumerabile: non finisce su disco)
   */
  /**
   * Un ritaglio dell'album ridotto a ciò che il disegno usa: `{id, w, h}`.
   * `null` se non c'è un id — le misure da sole non identificano niente.
   */
  function copiaImmagine(im) {
    if (!im || typeof im !== 'object') return null;
    var id = String(im.id == null ? '' : im.id).trim();
    if (!id) return null;
    var out = { id: id };
    var w = Number(im.w), h = Number(im.h);
    if (isFinite(w) && w > 0) out.w = Math.round(w);
    if (isFinite(h) && h > 0) out.h = Math.round(h);
    /* La scala del riquadro sulla mappa, in multipli della card. Un solo numero:
       il ridimensionamento è sempre proporzionale, perché due manopole
       separate vorrebbero dire poter deformare uno schema — e uno schema
       deformato non si legge. `1` non si scrive: ciò che è di fabbrica non
       sporca il file, come già per il colore. */
    var k = Number(im.scala);
    if (isFinite(k) && k > 0 && Math.round(k * 100) !== 100) {
      out.scala = Math.max(0.5, Math.min(3, Math.round(k * 100) / 100));
    }
    return out;
  }

  /**
   * Ridimensiona il ritaglio di un nodo, sempre in proporzione.
   * Torna il grafo invariato se il nodo non porta un'immagine: ridimensionare
   * ciò che non è un'immagine non vuol dire niente, e inventare un campo su un
   * nodo di testo lo farebbe disegnare come un ritaglio senza sorgente.
   */
  function ridimensionaImmagine(g, id, scala) {
    var out = copia(g), i = indiceNodo(out, id);
    if (i < 0 || !out.nodi[i].immagine) return g;
    var k = Number(scala);
    if (!isFinite(k) || k <= 0) return g;
    k = Math.max(0.5, Math.min(3, Math.round(k * 100) / 100));
    var im = Object.assign({}, out.nodi[i].immagine);
    if (Math.round(k * 100) === 100) delete im.scala; else im.scala = k;
    out.nodi[i].immagine = im;
    return out;
  }

  function creaNodo(g, opt) {
    opt = opt || {};
    var out = copia(g);
    var id = prossimoId(out);
    var n = {
      id: id,
      testo: String(opt.testo == null ? '' : opt.testo),
      origine: origineChiesta(opt.origine)
    };
    /* Ciò che è vuoto non si scrive: una chiave con dentro il niente sul disco
       è indistinguibile da una scelta, ed è la regola che `colora` applica già
       al colore. Vale per `rimando`, `nota`, `capitolo` e `colore`. */
    var r = copiaRimando(opt.rimando);
    if (r) n.rimando = r;
    if (opt.nota) n.nota = String(opt.nota);
    var cap = numeroCapitolo(opt.capitolo);
    if (cap !== null) n.capitolo = cap;
    var nx = coordinata(opt.x), ny = coordinata(opt.y);
    if (nx !== null && ny !== null) { n.x = nx; n.y = ny; }
    if (opt.colore) n.colore = String(opt.colore);
    var im = copiaImmagine(opt.immagine);
    if (im) n.immagine = im;
    out.nodi.push(n);

    var padre = null;
    if (esiste(out, opt.comeFiglioDi)) padre = opt.comeFiglioDi;
    else if (esiste(out, opt.vicinoA)) {
      var p = G.sanitizza(g).genitore[opt.vicinoA];
      if (p != null) padre = p;
    }
    if (padre != null) out.archi.push({ da: padre, a: id, rel: '' });
    return segna(out, 'nuovo', id);
  }

  /**
   * Nodo ESTRATTO da una fonte (§3 del piano): `creaNodo` con `origine:'fonte'`
   * e il vincolo che rende onesto il nome. Prende le stesse opzioni.
   *
   * Un nodo estratto deve poter tornare da dove viene, quindi serve ALMENO UNO
   * fra `rimando` (il minuto del video, la pagina del PDF) e `capitolo` (il
   * frammento preso dal testo). Senza nessuno dei due non è un'estrazione: è un
   * nodo che dichiara una fonte e non sa indicarla — a schermo prenderebbe il
   * colore pieno del gruppo e il segno della fonte, e al click non succederebbe
   * niente.
   *
   * DECISIONE — senza puntatore il nodo nasce lo stesso, con `origine:'utente'`.
   * Rifiutare e restituire il grafo invariato sarebbe stata l'altra strada, ed è
   * la convenzione del modulo per le operazioni impossibili (`creaArco` con un
   * cappio, `sposta` con una coordinata non numerica). Qui però non è la stessa
   * cosa: là non c'è niente da perdere, si riprova; qui il testo del frammento è
   * lavoro dell'utente, già selezionato o già catturato, e il puntatore è solo
   * il contorno. Buttare via la frase perché il minuto non è arrivato vuol dire
   * un gesto che non fa niente e non lo dice — la classe di guasto che in questa
   * app è già costata cara. Meglio un nodo grigio, visibile e riparabile:
   * è lo stesso ragionamento con cui `eliminaNodo` lascia i figli flottanti.
   * Chi chiama distingue i due esiti leggendo l'`origine` del nodo nato (l'id è
   * in `.nuovo` come sempre), e può dirlo col toast.
   */
  function estrai(g, opt) {
    opt = opt || {};
    var puntato = !!copiaRimando(opt.rimando) || numeroCapitolo(opt.capitolo) !== null;
    return creaNodo(g, Object.assign({}, opt, { origine: puntato ? 'fonte' : 'utente' }));
  }

  /** Il testo si salva COME È STATO BATTUTO. Le maiuscole e gli spazi interni
   *  sono scelte di chi scrive, non sporcizia da lavare. */
  function rinomina(g, id, testo) {
    var out = copia(g), i = indiceNodo(out, id);
    if (i >= 0) out.nodi[i].testo = String(testo == null ? '' : testo);
    return out;
  }

  /**
   * Elimina un nodo. I figli NON muoiono: restano nel grafo come flottanti,
   * senza genitore (è la regola di Braynr, §4.1 del piano).
   *
   * Cancellare a cascata sarebbe la cosa facile da scrivere e la peggiore da
   * usare: eliminare un nodo intermedio per riagganciare il ramo altrove è la
   * manovra più comune di chi riordina una mappa, e farebbe sparire mezzo
   * lavoro con un tasto. Che restino scollegati è visibile e riparabile; che
   * spariscano si scopre dopo.
   *
   * Se ne vanno solo gli archi che TOCCANO il nodo — quelli fra i figli, o fra
   * i figli e il resto della mappa, sopravvivono.
   */
  function eliminaNodo(g, id) {
    var out = copia(g);
    if (indiceNodo(out, id) < 0) return out;
    out.nodi = out.nodi.filter(function (n) { return n.id !== id; });
    out.archi = out.archi.filter(function (e) { return e.da !== id && e.a !== id; });
    return out;
  }

  /* ---------------------------------------------------------------- archi */

  /**
   * Arco nuovo da `da` a `a`. Rifiuta i cappi e i doppioni nello stesso verso:
   * `grafo.archi()` li scarterebbe comunque in lettura, e un arco che c'è nel
   * file ma non nel disegno è la peggiore delle due condizioni — l'utente lo
   * cerca a schermo, non lo trova, e ne fa un altro.
   *
   * Il verso opposto invece è legittimo: A→B «causa» e B→A «limita» sono due
   * affermazioni diverse, non un doppione.
   *
   * @param opt.rel    la linking word (salvata com'è battuta, vedi `etichetta`)
   * @param opt.bidir  doppia punta
   */
  function creaArco(g, da, a, opt) {
    opt = opt || {};
    var out = copia(g);
    if (da === a) return out;
    if (!esiste(out, da) || !esiste(out, a)) return out;
    if (trovaArco(out, da, a) >= 0) return out;
    var e = { da: da, a: a, rel: String(opt.rel == null ? '' : opt.rel) };
    if (opt.bidir) e.bidir = true;   // scritto solo se vero: `false` sul disco è rumore
    out.archi.push(e);
    return out;
  }

  function eliminaArco(g, da, a) {
    var out = copia(g), i = trovaArco(out, da, a);
    if (i >= 0) out.archi.splice(i, 1);
    return out;
  }

  /**
   * Inverte i capi di un arco E NE SVUOTA IL VERBO.
   *
   * Il verbo si perde apposta. «A richiede B» invertito non è «B richiede A»:
   * è falso. Quasi tutte le famiglie di relazione sono asimmetriche — causa,
   * dipendenza, sequenza, gerarchia, controllo, opposizione — e solo l'analogia
   * regge l'inversione. Tenere il verbo dopo lo scambio produrrebbe mappe che
   * affermano il falso senza dirlo: l'errore più caro, perché è invisibile e si
   * studia sopra. Meglio un arco muto, che si vede subito e chiede una parola.
   *
   * Se l'arco nel verso opposto esiste già, l'inversione ci finirebbe sopra:
   * i due sarebbero indistinguibili e `grafo.archi()` ne butterebbe uno a caso
   * in lettura. Qui l'originale se ne va e resta quello che c'era, col suo verbo.
   */
  function inverti(g, da, a) {
    var out = copia(g), i = trovaArco(out, da, a);
    if (i < 0) return out;
    var e = out.archi[i];
    var nuovoDa = e.a, nuovoA = e.da;
    out.archi.splice(i, 1);
    if (trovaArco(out, nuovoDa, nuovoA) >= 0) return out;
    e.da = nuovoDa; e.a = nuovoA;
    e.rel = '';
    out.archi.splice(i, 0, e);   // torna al suo posto: l'ordine degli archi è l'ordine in cui si leggono
    return out;
  }

  /**
   * Mette (o cambia) la linking word di un arco.
   *
   * Il verbo si salva COME BATTUTO: niente minuscole forzate, niente spazi
   * limati. La normalizzazione di `relazioni.normalizza` serve a CERCARE la
   * famiglia in lettura, non a riscrivere quello che l'utente ha pensato: «È
   * condizione di» e «è condizione di» trovano la stessa famiglia, ma solo la
   * prima è la frase che quella persona ha scritto.
   *
   * E soprattutto: qui NON si salva mai la famiglia, né il colore. Si ricavano
   * leggendo, con `relazioni.famigliaDi` e `relazioni.coloreDi`. Una cosa
   * scritta due volte prima o poi diverge, e qui divergerebbe così: l'utente
   * corregge il verbo, il colore salvato resta quello di prima, e la mappa dice
   * una cosa mentre ne mostra un'altra.
   */
  function etichetta(g, da, a, rel) {
    var out = copia(g), i = trovaArco(out, da, a);
    if (i >= 0) out.archi[i].rel = String(rel == null ? '' : rel);
    return out;
  }

  /** Doppia punta sì o no. Un arco bidirezionale è un legame senza verso, e il
   *  disegno lo dice con due frecce: `trovaArco` lo raggiunge da tutti e due i
   *  capi, quindi il menu contestuale funziona da qualunque estremo lo si apra. */
  function direzione(g, da, a, bidir) {
    var out = copia(g), i = trovaArco(out, da, a);
    if (i < 0) return out;
    if (bidir) out.archi[i].bidir = true; else delete out.archi[i].bidir;
    return out;
  }

  /* ------------------------------------------------------ colore e posizione */

  /**
   * Colora un nodo. Con `aCascata` il colore scende su tutto il sottoalbero,
   * lungo la foresta portante di `grafo.discendenti` — la stessa che disegna
   * l'albero, così il colore segue esattamente il ramo che si vede.
   *
   * Il sottoalbero è quello del grafo RICEVUTO: se il chiamante passa il grafo
   * potato da `senzaRami`, la cascata si ferma dove si ferma il disegno, ed è
   * quello che ci si aspetta guardando lo schermo. La scelta resta di chi
   * chiama, e qui non c'è una seconda regola nascosta.
   *
   * `colore` vuoto o nullo TOGLIE la proprietà invece di scrivere un vuoto:
   * `disegna.js` fa `nodo.colore || colore(nodo, gruppi)`, quindi togliendola
   * il nodo torna al colore automatico del suo gruppo. Una stringa vuota
   * salvata farebbe la stessa cosa a schermo ma resterebbe nel file, e al
   * prossimo che legge sembrerebbe una scelta.
   */
  function colora(g, id, colore, opt) {
    opt = opt || {};
    var out = copia(g);
    if (indiceNodo(out, id) < 0) return out;
    var bersagli = {};
    bersagli[id] = true;
    if (opt.aCascata) G.discendenti(g, id).forEach(function (d) { bersagli[d] = true; });
    out.nodi.forEach(function (n) {
      if (!bersagli[n.id]) return;
      if (colore) n.colore = String(colore); else delete n.colore;
    });
    return out;
  }

  /**
   * Posizione fissata a mano.
   *
   * Non c'è nessun flag «fissato» accanto alle coordinate: la PRESENZA di x e y
   * è il flag. Due modi di dire la stessa cosa sono due modi di dirla diversa
   * appena qualcuno ne aggiorna uno solo.
   */
  function sposta(g, id, p) {
    p = p || {};
    var out = copia(g), i = indiceNodo(out, id);
    if (i < 0) return out;
    var px = coordinata(p.x), py = coordinata(p.y);
    if (px === null || py === null) return out;
    out.nodi[i].x = px;
    out.nodi[i].y = py;
    return out;
  }

  /**
   * Un nodo è FISSATO se e solo se ha `x` e `y`, ed entrambe sono numeri finiti.
   * Non c'è nessun flag accanto: la presenza delle coordinate È il flag.
   *
   * ⚠️ La definizione NON sta qui: sta in `grafo.fissato`, ed è giusto che stia
   * là. La stessa domanda la fanno in tre — il motore (`layouts.run`, per sapere
   * quali posizioni non ricalcolare), il menu contestuale («Libera la posizione»
   * compare solo su un nodo spostato a mano, §5) e `liberaTutte` qui sotto, per
   * contare che cosa sta buttando — e `layouts.js` non può chiedere niente a
   * questo modulo: la modifica sta SOPRA i motori, e farla richiedere dal basso
   * invertirebbe le dipendenze. `grafo.js`, che è il vocabolario del modello, lo
   * richiedono già tutti e due.
   *
   * Resta esportata da qui perché chi lavora sulle operazioni la cerca dove sono
   * le operazioni. È una porta, non una seconda copia.
   */
  function fissato(n) { return G.fissato(n); }

  /**
   * Toglie la posizione fissata a mano: il nodo torna a farsi collocare dal
   * motore. È la voce «Libera la posizione» del menu contestuale.
   *
   * ⚠️ Liberare vuol dire TOGLIERE `x` e `y`, non azzerarle. Uno zero salvato è
   * una posizione, non un'assenza — è la stessa regola con cui `colora` cancella
   * la chiave invece di scriverci dentro il vuoto. Scrivere `x:0` qui vorrebbe
   * dire spedire tutti i nodi «liberati» nell'angolo, e per il motore sarebbero
   * ancora nodi fissati.
   *
   * @returns un grafo nuovo, con in `.liberate` (non enumerabile) quante
   *          posizioni ha davvero azzerato — 0 se il nodo non era spostato.
   */
  function libera(g, id) {
    var out = copia(g), i = indiceNodo(out, id);
    if (i < 0) return segna(out, 'liberate', 0);
    var era = fissato(out.nodi[i]);
    delete out.nodi[i].x;
    delete out.nodi[i].y;
    return segna(out, 'liberate', era ? 1 : 0);
  }

  /**
   * Libera TUTTE le posizioni. Serve al cambio motore, che per decisione presa
   * (§12.2 punto 3 del piano) azzera le sistemazioni fatte a mano — e diventa
   * per questo un'operazione distruttiva come le altre: chi la chiama passa
   * prima da `annullabile()`, altrimenti sarebbe un tasto che butta via mezz'ora
   * di lavoro senza nemmeno nominarla.
   *
   * `.liberate` è il numero da scrivere nell'etichetta e nel toast («12
   * posizioni azzerate»). Torna da qui e non si conta fuori: il chiamante che se
   * lo calcolasse da sé riscriverebbe la regola di `fissato`, e sarebbe la
   * seconda copia di una condizione che deve restare una.
   */
  function liberaTutte(g) {
    var out = copia(g), n = 0;
    out.nodi.forEach(function (nodo) {
      if (fissato(nodo)) n++;
      delete nodo.x;
      delete nodo.y;
    });
    return segna(out, 'liberate', n);
  }

  /* ------------------------------------------------- pila degli annullamenti */

  /**
   * La pila è l'UNICA cosa mutabile del modulo, e lo è di proposito: una pila
   * che restituisce una pila nuova obbliga chi chiama a riassegnarla ogni
   * volta, e la volta che se lo dimentica non si rompe niente — si perde solo
   * la memoria dell'annulla, in silenzio, che è il modo peggiore di rompersi.
   *
   * @param max quanti stati tenere (default 20). Il tetto non è avarizia di
   *            memoria: è che oltre una ventina di passi indietro nessuno
   *            ricorda più che cosa stava annullando.
   */
  function pila(max) {
    return { max: Math.max(1, +max || TETTO), stati: [] };
  }

  /**
   * Da chiamare PRIMA di ogni operazione distruttiva. Mette da parte una copia
   * dello stato attuale con l'etichetta di che cosa sta per succedere.
   *
   * L'etichetta deve dire COSA si annulla («Elimina nodo: Economia»): un
   * annulla che non lo dice costringe a provarlo per saperlo, e provarlo su una
   * mappa vuol dire farle fare un salto sotto gli occhi.
   */
  /* ⚠️ `extra` è il quarto argomento: TUTTO ciò che si può perdere con quel
     gesto e che non sta nel grafo. Oggi sono le leve della vista e le
     disposizioni salvate; domani sarà quello che si aggiunge al documento.
     È facoltativo perché non ogni operazione le tocca — aggiungere un nodo
     cambia il grafo e basta.
     Il nome non è `vista` di proposito, e ci sono già cascato: la prima versione
     copiava solo le leve, e svuotare uno slot mostrava un toast che PROMETTEVA
     «⌘Z lo riporta» mentre l'annulla non aveva le memorie. Una promessa scritta
     e non mantenuta è peggio di una funzione che manca. Se un pezzo di stato può
     sparire con un gesto, o entra qui o quel gesto non è annullabile.
     Si copia in profondità: è roba di chi chiama, e fra un annulla e l'altro
     cambia sotto. */
  function annullabile(p, etichettaAzione, g, extra) {
    if (!p || !p.stati) return p;
    var voce = { etichetta: String(etichettaAzione == null ? '' : etichettaAzione), grafo: copia(g) };
    if (extra && typeof extra === 'object') { try { voce.extra = JSON.parse(JSON.stringify(extra)); } catch (e) {} }
    p.stati.push(voce);
    while (p.stati.length > p.max) p.stati.shift();   // il più vecchio se ne va per primo
    return p;
  }

  /**
   * Torna indietro di un passo.
   * @returns {{grafo, etichetta, extra}} oppure `null` se non c'è più niente da
   *          annullare — `null` e non un grafo vuoto: chi chiama deve poter
   *          distinguere «non c'è nulla da fare» da «ecco la mappa, ora è vuota».
   *          `extra` c'è solo se chi ha messo lo stato l'aveva dato: assente vuol
   *          dire «questa operazione toccava il solo grafo», non «stato vuoto».
   */
  function annulla(p) {
    if (!p || !p.stati || !p.stati.length) return null;
    var s = p.stati.pop();
    var out = { grafo: s.grafo, etichetta: s.etichetta };
    if (s.extra) out.extra = s.extra;
    return out;
  }

  /** Che cosa annullerebbe il prossimo ⌘Z, per scriverlo nel menu. `''` se la
   *  pila è vuota, così la voce si può spegnere senza interrogare `stati`. */
  function daAnnullare(p) {
    if (!p || !p.stati || !p.stati.length) return '';
    return p.stati[p.stati.length - 1].etichetta;
  }

  function svuota(p) {
    if (p && p.stati) p.stati.length = 0;
    return p;
  }

  /** Etichetta pronta: `('Elimina nodo', g, 'n3')` → «Elimina nodo: Economia».
   *  Il taglio del testo lungo sta qui e non nei cinque punti dell'interfaccia
   *  che costruiscono un'etichetta, altrimenti sono cinque tagli diversi. */
  function descriviAzione(azione, g, id) {
    var i = indiceNodo(g, id);
    var t = i >= 0 ? String((g.nodi[i].testo || '')).replace(/\s+/g, ' ').trim() : '';
    if (!t) return String(azione == null ? '' : azione);
    if (t.length > 40) t = t.slice(0, 39) + '…';
    return azione + ': ' + t;
  }

  return {
    copia: copia, prossimoId: prossimoId, trovaArco: trovaArco,
    ridimensionaImmagine: ridimensionaImmagine,
    creaNodo: creaNodo, estrai: estrai, rinomina: rinomina, eliminaNodo: eliminaNodo,
    creaArco: creaArco, eliminaArco: eliminaArco, inverti: inverti,
    etichetta: etichetta, direzione: direzione,
    colora: colora, sposta: sposta,
    fissato: fissato, libera: libera, liberaTutte: liberaTutte,
    pila: pila, annullabile: annullabile, annulla: annulla,
    daAnnullare: daAnnullare, svuota: svuota, descriviAzione: descriviAzione
  };
}));
