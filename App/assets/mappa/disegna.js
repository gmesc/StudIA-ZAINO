/* =========================================================================
   disegna — dal risultato di un layout al markup SVG.

   Funzione PURA che restituisce una stringa: il renderer la infila nel DOM e
   ci attacca gli ascoltatori, l'esportazione (fase C) la manda a svg2pdf senza
   passare dallo schermo. Una sola resa, due destinazioni.

   ⚠️ Tutta la grafica è ad ATTRIBUTI SVG, mai in classi CSS. È la lezione più
   cara imparata guardando MappAI: un colore che sta nel foglio di stile è un
   colore che il PDF perde, e la fedeltà dell'esportazione si decide qui, non
   quando si scrive l'esportazione. Le classi che restano (`mnodo`, `marco`)
   servono al click, non all'aspetto.

   Per la stessa ragione le frecce sono TRIANGOLI DISEGNATI e non `<marker>`:
   i marker sono la prima cosa che i convertitori SVG→PDF sbagliano.

   Un nodo può anche ESSERE un'immagine (`nodo.immagine`: un ritaglio dell'album
   del corso). La regola non cambia di una virgola: si disegna con un `<image>` e
   i suoi attributi, mai con un `foreignObject` — che a schermo sarebbe comodo e
   in PDF non arriva vivo. E la sorgente non si va a cercare sul disco: il modulo
   resta puro, l'indirizzo lo dà chi chiama con `opt.srcImmagine`.

   I colori arrivano da fuori (`opt.tema`, `opt.gruppi`): il modulo non sa
   nulla del tema chiaro o scuro, e il renderer glieli passa leggendoli dalle
   variabili CSS vere — così cambiando tema la mappa cambia con l'app.

   Modulo PURO, UMD (vedi relazioni.js).
   ========================================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(null);
  else root.MappaDisegna = factory(root);
}(typeof self !== 'undefined' ? self : this, function (glob) {
  'use strict';

  // il globale arriva come argomento: dentro la factory non è in scope
  var R = glob ? glob.MappaRelazioni : require('./relazioni');

  var TEMA = { panel: '#ffffff', ink: '#16181d', line: '#dcdcdc', muted: '#5b6069', bg: '#fbfbfa' };
  /* Palette dei rami: gli accenti dell'app (teal · giallo · blu) più i toni che
     il foglio di stile usa già per i riquadri. Non è una palette nuova. */
  var GRUPPI = ['#0f766e', '#a16207', '#1d4ed8', '#be123c', '#7c3aed', '#0891b2', '#65a30d', '#c2410c'];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function n1(v) { return Math.round(v * 10) / 10; }

  function colore(nodo, gruppi) {
    var g = nodo && nodo.gruppo != null ? nodo.gruppo : 0;
    if (!g) return gruppi[0];
    return gruppi[(Math.abs(g) - 1) % gruppi.length];
  }

  /**
   * Il colore di una card, in cascata — e l'ordine È la regola (§3, la
   * distinzione cromatica di Braynr).
   *
   *   1. il colore scelto a mano vince su tutto: un nodo estratto e poi
   *      ricolorato resta del colore che gli hai dato;
   *   2. altrimenti un nodo scritto ex novo (`origine:'utente'`) è GRIGIO,
   *      finché non lo si colora: la mappa distingue a colpo d'occhio ciò che
   *      viene dalla fonte da ciò che ci hai messo tu;
   *   3. altrimenti il colore del ramo, come sempre.
   *
   * Il grigio si prende dal tema (`tema.muted`) e non da un hex scritto qui:
   * un colore cablato nel modulo sarebbe l'unico pezzo di mappa che non cambia
   * passando al tema scuro.
   *
   * ⚠️ Colore e origine restano DUE canali: il bordo tratteggiato dell'utente
   * non dipende da questa funzione. Un nodo ricolorato a mano continua a dire
   * da dove viene, altrimenti la prima colorazione cancellerebbe la storia.
   */
  function coloreNodo(nodo, gruppi, tema) {
    if (nodo && nodo.colore) return nodo.colore;
    if (nodo && nodo.origine === 'utente') return tema.muted;
    return colore(nodo, gruppi);
  }

  /**
   * Le fonti che un nodo dichiara, ripulite.
   *
   * Le mappe concettuali nuove appendono al nodo un ARRAY (`nodo.fonti`),
   * perché un concetto onesto cita più di un punto: il minuto del video E la
   * tabella della dispensa dicono la stessa cosa, e tenerne una sola vorrebbe
   * dire scegliere al posto di chi studia. `rimando` e `capitolo` restano la via
   * vecchia — una fonte sola, quella dell'estrazione — e chi arriva di lì si
   * disegna esattamente come prima: il campo nuovo non cambia una virgola alle
   * mappe già salvate.
   *
   * Le voci vuote cadono QUI, una volta per tutte, e la funzione è esportata
   * apposta: il numero scritto sul segno è la promessa di quante righe troverà
   * chi apre la bolla, e la bolla la riempie il renderer. Se filtrasse con una
   * legge sua si arriverebbe a un «3» sul nodo e a due voci nel menu — cioè al
   * dubbio che la terza fonte sia andata persa.
   */
  function fontiDi(nodo) {
    return (nodo && Array.isArray(nodo.fonti)) ? nodo.fonti.filter(Boolean) : [];
  }

  /**
   * Il ritaglio che un nodo porta addosso (`{id, w, h}`), se c'è davvero.
   *
   * Basta l'`id` — il nome con cui l'album ritrova il file — perché il nodo sia
   * un nodo-immagine. Le misure servono solo al rapporto d'aspetto e possono
   * mancare: si ritaglia con un rapporto di ripiego, che è meno bello ma è
   * ancora il ritaglio giusto.
   *
   * ⚠️ Un `immagine` SENZA id non è un'immagine che non si trova: è un campo che
   * non vuol dire niente, e la card torna a essere una card qualsiasi. Il
   * segnaposto è riservato a chi un ritaglio ce l'ha e non si riesce a
   * mostrarlo: metterlo anche qui prometterebbe un'immagine che nessuno ha mai
   * messo lì.
   *
   * È esportata come `fontiDi` e per la stessa ragione: il renderer deve poter
   * decidere le stesse cose che decide il disegno, senza rifare la regola.
   */
  function immagineDi(nodo) {
    var im = nodo && nodo.immagine;
    if (!im || typeof im !== 'object') return null;
    return (im.id != null && String(im.id).trim() !== '') ? im : null;
  }

  /** Quanto è grande il riquadro di un ritaglio, in multipli della card.
   *  ⚠️ Sempre PROPORZIONALE: un solo numero per larghezza e altezza. Due
   *  manopole separate vorrebbero dire poter deformare uno schema, e uno schema
   *  deformato non si legge — è la stessa ragione dello `slice` sull'immagine. */
  var SCALA_MIN = 0.5, SCALA_MAX = 3;
  function scalaImmagine(im) {
    var k = Number(im && im.scala);
    if (!isFinite(k) || k <= 0) return 1;
    return Math.max(SCALA_MIN, Math.min(SCALA_MAX, k));
  }

  /** Manda a capo su una larghezza data. Helvetica non è monospazio: 0.55em per
   *  carattere è la media misurata sul testo italiano, e sbagliare in difetto
   *  taglia le parole — meglio una riga in più che una parola mangiata. */
  function righe(s, larghezza, fs, maxRighe) {
    var perRiga = Math.max(6, Math.floor(larghezza / (fs * 0.55)));
    var parole = String(s || '').split(/\s+/).filter(Boolean), out = [], cur = '';
    parole.forEach(function (p) {
      if (!cur) { cur = p; return; }
      if ((cur + ' ' + p).length <= perRiga) cur += ' ' + p;
      else { out.push(cur); cur = p; }
    });
    if (cur) out.push(cur);
    if (out.length > maxRighe) {
      out = out.slice(0, maxRighe);
      var ult = out[maxRighe - 1];
      out[maxRighe - 1] = (ult.length > perRiga - 1 ? ult.slice(0, perRiga - 1) : ult).replace(/\s+\S*$/, '') + '…';
    }
    return out;
  }

  /** Testo con alone: due copie sovrapposte, il contorno bianco DIETRO.
   *  `paint-order` farebbe la stessa cosa in una riga sola, ma non sopravvive
   *  alla conversione in PDF — e una linking word illeggibile sul foglio
   *  stampato vanifica il motivo per cui la si è scritta. */
  /* ⚠️ `pointer-events="none"`: la linking word sta SOPRA il suo arco, e un
     `<text>` intercetta il puntatore. Senza questa riga la parola copriva il
     bersaglio del proprio legame — cioè proprio dove la mano va a cercarlo — e
     il menu contestuale sull'arco non si apriva se lo si prendeva per la
     parola. Il segno resta visibile; a rispondere è l'arco che gli sta sotto. */
  /* `ancora` e `peso` sono aggiunte facoltative, e stanno qui invece che in una
     seconda funzione perché l'alone deve restare UNO: due copie della stessa
     ricetta divergerebbero al primo ritocco, e la prima a scolorire sarebbe
     quella usata meno. Senza di loro l'uscita è identica a prima, byte per
     byte — chi le omette non si accorge che esistono. */
  function testoConAlone(x, y, s, opt) {
    var comune = 'x="' + n1(x) + '" y="' + n1(y) + '" text-anchor="' + (opt.ancora || 'middle') +
      '" font-family="' + esc(opt.font) +
      '" font-size="' + opt.fs + '" dominant-baseline="middle" pointer-events="none"' +
      (opt.peso ? ' font-weight="' + opt.peso + '"' : '');
    return '<text ' + comune + ' fill="' + opt.alone + '" stroke="' + opt.alone +
      '" stroke-width="3.5" stroke-linejoin="round">' + esc(s) + '</text>' +
      '<text ' + comune + ' fill="' + opt.colore + '">' + esc(s) + '</text>';
  }

  /* Quanto stanno dentro dal bordo l'immagine e la sua didascalia. Cinque e non
     quattro: la barra d'accento è spessa 4px e corre sul bordo alto (td) o su
     quello sinistro (lr), e con quattro l'immagine la toccherebbe — il colore
     del ramo è la prima cosa che si legge su una mappa, e non deve stare sotto
     un ritaglio. */
  var PAD_IMM = 5;

  /**
   * Come si spartisce una card che porta un'immagine: il riquadro del ritaglio
   * sopra, la fascia della didascalia sotto.
   *
   * ⚠️ La card NON cresce. L'altezza la decide `layouts`, uguale per tutte, e un
   * nodo che si allargasse per far posto alla sua immagine sfonderebbe la
   * griglia di tutti gli altri: qui si divide lo spazio che c'è, non se ne
   * chiede dell'altro.
   *
   * La didascalia non prende mai più di metà: `layouts` accetta card alte fino a
   * 24px, e là una riga di testo a corpo pieno si mangerebbe il ritaglio
   * lasciando un nodo con la cornice e dentro niente.
   */
  /** La barra d'accento: lo stesso spessore che hanno tutte le card. */
  var BARRA = 4;

  /**
   * Le misure di un nodo-immagine: **le detta il ritaglio**, non la griglia.
   *
   * ⚠️ È il rovescio della regola di prima, ed è una scelta dell'utente. Fino a
   * ieri il rapporto d'aspetto non entrava MAI nella geometria: la card era
   * quella di tutte le altre e il ritaglio si tagliava per starci dentro
   * (`slice`). Il guadagno era una griglia perfettamente regolare; il prezzo era
   * che di uno schema si vedeva un pezzo — e uno schema di cui si vede un pezzo
   * non è uno schema. Adesso il nodo prende la forma dell'immagine e la mostra
   * INTERA.
   *
   * La larghezza parte da quella della card (per scala), l'altezza la ricava il
   * rapporto. ⚠️ Con un tetto: un ritaglio molto alto e stretto — una colonna di
   * testo presa da una dispensa — darebbe un nodo più alto dell'intera mappa. Al
   * tetto si arriva stringendo la LARGHEZZA, mai schiacciando l'altezza: il
   * rapporto non si tocca, o si torna alla deformazione da cui si scappava.
   *
   * Senza misure (`w`/`h` a zero, cioè «non si sa») si ricade sul rapporto della
   * card: un numero inventato darebbe una forma sbagliata con la stessa
   * sicurezza di una giusta.
   */
  function misureImmagine(im, W, H, k, conDidascalia, fs) {
    var hDid = conDidascalia ? Math.min(fs * 1.35, H * 0.34) : 0;
    var wi = Math.max(1, W * k - BARRA);
    var rap = (im && im.w > 0 && im.h > 0) ? (im.w / im.h) : (wi / Math.max(1, H * k - hDid));
    var hi = wi / rap;
    var tetto = H * k * 5;
    if (hi > tetto) { hi = tetto; wi = hi * rap; }
    return { wi: wi, hi: hi, hDid: hDid, W: wi + BARRA, H: hi + hDid };
  }

  function riquadroImmagine(x, y, m) {
    /* ⚠️ Un nodo-immagine non ha la cornice della card: tre lati sono nudi e a
       sinistra resta la sola barra del colore. Quindi il ritaglio non si ritira
       da un bordo che non c'è — parte subito dopo la barra e arriva ai tre lati. */
    return {
      x: x + BARRA, y: y,
      w: Math.max(1, m.wi),
      h: Math.max(1, m.hi),
      cyDid: y + m.hi + m.hDid / 2
    };
  }

  /** Quello che si legge — e quello che si sente leggere — quando il ritaglio non
   *  si riesce a mostrare. Una frase sola, in un posto solo: il segnaposto
   *  disegnato e l'etichetta della card devono dire la stessa cosa, altrimenti
   *  chi guarda e chi ascolta si troverebbero davanti a due nodi diversi. */
  var SEGNAPOSTO = 'immagine non disponibile';

  /**
   * Il riquadro dentro la card: o il ritaglio, o il segnaposto che dice perché
   * non c'è.
   *
   * ⚠️ Senza sorgente NON si emette un `<image>`. Un'immagine senza indirizzo è
   * un buco muto a schermo e un errore in conversione, e chi guarda non ha modo
   * di distinguerla da un nodo vuoto: al suo posto va un segnaposto, che almeno
   * dice che lì un ritaglio ci sarebbe e non lo si è trovato.
   *
   * `href` E `xlink:href` con lo stesso valore: i browser leggono il primo
   * (SVG 2), i convertitori in PDF cercano ancora il secondo (SVG 1.1), e questo
   * file esiste per servire tutti e due. La ripetizione è anche la ragione per
   * cui `srcImmagine` dovrebbe tornare un indirizzo CORTO — un `file://`, un
   * protocollo dell'app — e non un `data:` in base64, che finirebbe scritto due
   * volte per ogni nodo.
   *
   * `preserveAspectRatio="xMidYMid slice"`: il ritaglio RIEMPIE il riquadro e ciò
   * che avanza si taglia, invece di schiacciarsi per starci dentro. Uno schema
   * deformato non si legge; uno schema tagliato sì. Il taglio è simmetrico, così
   * ciò che si perde è la cornice e non il centro. Non serve nessun `clipPath`:
   * un `<image>` si limita da sé al proprio riquadro, e un riferimento a un
   * `clipPath` è proprio il genere di indirezione che i convertitori perdono.
   */
  function pezzoImmagine(r, src, tema, font, fs) {
    var box = 'x="' + n1(r.x) + '" y="' + n1(r.y) + '" width="' + n1(r.w) + '" height="' + n1(r.h) + '"';
    if (src) {
      /* Nessun filo di contorno attorno al ritaglio: la cornice della card non
         c'è più, e un rettangolo attorno all'immagine ne rifarebbe una — cioè
         proprio ciò che si è tolto. Dove finisce l'immagine lo dice l'immagine.
         `pointer-events="none"`: a rispondere al click resta il rettangolo del
         nodo, che sta sotto e copre tutto. */
      /* `meet` e non più `slice`: il riquadro ha ormai il rapporto dell'immagine,
         quindi non c'è niente da tagliare — e se le misure non si sapevano, far
         vedere tutto con una fascia vuota è meglio che nascondere un pezzo di
         schema senza dirlo. */
      return '<image ' + box + ' preserveAspectRatio="xMidYMid meet" href="' + esc(src) +
        '" xlink:href="' + esc(src) + '" pointer-events="none"/>';
    }
    var fsSeg = Math.max(8, fs - 3);
    return '<rect ' + box + ' fill="' + tema.bg + '" stroke="' + tema.line +
      '" stroke-width="1" stroke-dasharray="3 3" pointer-events="none"/>' +
      testoConAlone(r.x + r.w / 2, r.y + r.h / 2, righe(SEGNAPOSTO, r.w, fsSeg, 1)[0] || '',
        { fs: fsSeg, font: font, colore: tema.muted, alone: tema.bg });
  }

  /** Punta della freccia: triangolo pieno sull'ultimo segmento della polilinea. */
  function punta(punti, col, dim) {
    if (!punti || punti.length < 2) return '';
    var b = punti[punti.length - 1], a = null;
    for (var i = punti.length - 2; i >= 0; i--) {
      if (Math.abs(punti[i].x - b.x) > 0.6 || Math.abs(punti[i].y - b.y) > 0.6) { a = punti[i]; break; }
    }
    if (!a) return '';
    var dx = b.x - a.x, dy = b.y - a.y, L = Math.sqrt(dx * dx + dy * dy) || 1;
    var ux = dx / L, uy = dy / L, px = -uy, py = ux;
    var p1 = { x: b.x - ux * dim + px * dim * 0.45, y: b.y - uy * dim + py * dim * 0.45 };
    var p2 = { x: b.x - ux * dim - px * dim * 0.45, y: b.y - uy * dim - py * dim * 0.45 };
    return '<polygon points="' + n1(b.x) + ',' + n1(b.y) + ' ' + n1(p1.x) + ',' + n1(p1.y) + ' ' +
      n1(p2.x) + ',' + n1(p2.y) + '" fill="' + col + '"/>';
  }

  /** Da che parte escono i figli di un nodo, in versore.
   *  Non lo si ricava dagli archi disegnati: quando il ramo è chiuso quegli
   *  archi non esistono più, e il pallino salterebbe da un lato all'altro
   *  proprio nel momento in cui lo si preme. Lo dice il layout, che sa dove
   *  MANDEREBBE i figli: in basso se si legge dall'alto, a destra se si legge
   *  da sinistra, verso l'esterno del cerchio negli anelli. */
  function versoDeiFigli(res, p) {
    if (res.tipo === 'anelli') {
      var L = Math.sqrt(p.x * p.x + p.y * p.y);
      if (L > 1) return { x: p.x / L, y: p.y / L };   // il centro degli anelli è l'origine
    }
    return res.opt.orient === 'lr' ? { x: 1, y: 0 } : { x: 0, y: 1 };
  }

  /**
   * Da che parte sta la PORTA, il punto da cui si tira un arco (§4.2).
   *
   * ⚠️ Mai dalla parte dei figli: lì c'è già il pallino del ramo (`.mtoggle`),
   * e due bersagli nello stesso posto vogliono dire chiudere un ramo credendo
   * di collegare due nodi. La porta sta sul bordo PERPENDICOLARE.
   *
   * Sui due orientamenti la regola si dice in una riga: dei due bordi lontani —
   * il basso e il destro — il ramo ne prende uno e la porta l'altro. Se i figli
   * scendono la porta è a destra; se vanno a destra la porta è in basso. La
   * mano impara un posto solo, e non è mai in alto né a sinistra.
   *
   * Sugli anelli un «basso» non c'è: il verso dei figli è radiale, e l'unica
   * direzione perpendicolare a un raggio è la tangente. Delle due tangenti si
   * prende quella rivolta in basso a destra (`x+y` maggiore) — così la stessa
   * abitudine dei due orientamenti vale anche qui, e la scelta dipende solo da
   * dove sta il nodo, quindi non salta da un lato all'altro quando l'anello si
   * ridisegna. A 45° esatti le due tangenti pareggiano: vince la prima, perché
   * ciò che conta è che sia sempre la stessa.
   */
  function versoDellaPorta(d) {
    var t1 = { x: -d.y, y: d.x }, t2 = { x: d.y, y: -d.x };
    return (t1.x + t1.y >= t2.x + t2.y) ? t1 : t2;
  }

  /** Dove un versore uscente dal centro incontra il bordo della card. Uno solo
   *  per tutti: lo usano il pallino del ramo e la porta, e due copie della
   *  stessa aritmetica divergerebbero alla prima card non quadrata. */
  function sulBordo(p, d, W, H) {
    var tX = d.x ? (W / 2) / Math.abs(d.x) : Infinity;
    var tY = d.y ? (H / 2) / Math.abs(d.y) : Infinity;
    var t = Math.min(tX, tY);
    return { x: p.x + d.x * t, y: p.y + d.y * t };
  }

  /**
   * @param res  risultato di layouts.run
   * @param opt  { tema, gruppi, fsNodo, fsRel, etichette:'complete'|'brevi',
   *               evidenzia:id, font, titolo, margine, srcImmagine:fn }
   * @returns {{markup, viewBox, bbox}}
   */
  function svg(res, opt) {
    opt = opt || {};
    var tema = Object.assign({}, TEMA, opt.tema || {});
    var gruppi = (opt.gruppi && opt.gruppi.length) ? opt.gruppi : GRUPPI;
    var font = opt.font || 'Helvetica Neue, Helvetica, Arial, sans-serif';
    var fsNodo = +opt.fsNodo || 12, fsRel = +opt.fsRel || 10;
    var margine = opt.margine == null ? 44 : +opt.margine;
    var o = res.opt, W = o.w, H = o.h;
    var perId = {};
    (res.nodi || []).forEach(function (n) { perId[n.id] = n; });

    var b = res.bbox;
    var vb = [n1(b.minX - margine), n1(b.minY - margine), n1(b.w + margine * 2), n1(b.h + margine * 2)];

    var out = [];

    /* 1. filigrana: nel motore Percorso il filo numerato prende il posto degli
       archi, e le relazioni VERE passano di qui, in secondo piano.
       ⚠️ Sono comunque i legami della mappa, quindi devono restare afferrabili:
       ricevono il gruppo `.marco` e i loro capi come tutti gli altri. Senza,
       in Percorso il menu contestuale e il doppio click cadevano sui segmenti
       del filo — che non esistono nel grafo — mentre gli archi che l'utente ha
       davvero scritto non si potevano né etichettare né eliminare. */
    (res.extra || []).forEach(function (a) {
      if (!a.e) {
        out.push('<path d="' + a.d + '" fill="none" stroke="' + tema.line + '" stroke-width="1" stroke-dasharray="2 4" opacity="0.85"/>');
        return;
      }
      out.push('<g class="marco" data-da="' + esc(a.e.da) + '" data-a="' + esc(a.e.a) + '">' +
        '<path d="' + a.d + '" fill="none" stroke="#ffffff" stroke-opacity="0" stroke-width="12" ' +
          'stroke-linecap="round" stroke-linejoin="round" pointer-events="stroke"/>' +
        '<path d="' + a.d + '" fill="none" stroke="' + (a.e.rel ? R.coloreDi(a.e.rel) : tema.line) +
          '" stroke-width="1" stroke-dasharray="2 4" opacity="0.85"/>' +
        '</g>');
    });

    // 2. archi
    (res.archi || []).forEach(function (a, i) {
      var filo = a.e && a.e._filo;
      var col = filo ? tema.muted : (a.e.rel ? R.coloreDi(a.e.rel) : tema.line);
      var sw = filo ? 1.6 : (a.e.cross ? 1.2 : 1.4);
      var tratteggio = a.e.cross ? ' stroke-dasharray="5 4"' : '';
      /* `data-da`/`data-a` accanto a `data-arco`: l'indice cambia a ogni
         ridisegno — basta un ramo chiuso — e un menu contestuale che agisse
         sull'arco «numero 7» agirebbe su un altro arco appena la mappa cambia.
         I due capi, invece, l'arco lo nominano. */
      /* ⚠️ Il filo del Percorso NON è un legame: è il numero d'ordine reso
         visibile, e i suoi capi non corrispondono a nessun arco del grafo.
         Non prende la classe `.marco` né i `data-*`, così il menu contestuale
         non gli si apre sopra offrendo di invertire o eliminare qualcosa che
         non esiste. */
      if (filo) {
        out.push('<path d="' + a.d + '" fill="none" stroke="' + col + '" stroke-width="' + sw +
          '" stroke-linecap="round" stroke-linejoin="round" pointer-events="none"/>' + punta(a.punti, col, 9));
        return;
      }
      out.push('<g class="marco" data-arco="' + i + '" data-da="' + esc(a.e.da) + '" data-a="' + esc(a.e.a) + '">' +
        /* Bersaglio del mouse: lo stesso tracciato, invisibile e spesso. Una
           linea da 1,4px non si prende con la mano ferma, figurarsi con quella
           incerta, e il menu dell'arco senza bersaglio è un menu che non si
           apre — stessa medicina del pallino del ramo.
           `pointer-events` è un ATTRIBUTO di presentazione: la regola «tutto ad
           attributi, mai in CSS» regge, e l'export non lo perde. Il tratto è
           bianco a opacità zero, non «transparent», e sta PRIMA di quello
           visibile: se un convertitore in PDF ignorasse l'opacità, il segno
           che comparirebbe sarebbe bianco su fondo bianco e comunque coperto
           dall'arco vero, disegnato dopo. */
        '<path d="' + a.d + '" fill="none" stroke="#ffffff" stroke-opacity="0" stroke-width="12" ' +
          'stroke-linecap="round" stroke-linejoin="round" pointer-events="stroke"/>' +
        '<path d="' + a.d + '" fill="none" stroke="' + col + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round"' + tratteggio + '/>' +
        punta(a.punti, col, 9) +
        (a.e.bidir ? punta(a.punti.slice().reverse(), col, 9) : '') +
        '</g>');
    });

    // 3. linking words — dopo gli archi, prima delle card: una parola coperta da
    //    una card sarebbe peggio di una parola assente, perché sembra un errore
    /* ⚠️ Anche quelle della FILIGRANA (`res.extra`), non solo di `res.archi`.
       Nel motore Percorso i legami veri stanno lì — `res.archi` sono i segmenti
       del filo numerato — e iterando i soli `archi` il Percorso restava l'unico
       motore muto: gli archi c'erano, colorati per famiglia, ma senza il verbo
       sopra. È la stessa svista che aveva reso incliccabili i suoi legami
       (guasto 5.6): chi scrive un ciclo sugli archi dimentica che su un motore
       su quattro gli archi si chiamano `extra`.
       Il filo resta muto per costruzione — `rel` vuoto e `_filo` addosso — e va
       bene così: il numero del passo lo dice già la card, e una parola su ogni
       segmento del serpente sarebbe rumore su ciò che si legge per primo. */
    if (opt.etichette !== 'no') {
      (res.archi || []).concat(res.extra || []).forEach(function (a) {
        // in filigrana può esserci anche un tracciato senza legame dietro
        if (!a || !a.e || !a.e.rel || a.e._filo || !a.meta) return;
        var s = opt.etichette === 'brevi' ? String(a.e.rel).split(/\s+/)[0] : a.e.rel;
        out.push(testoConAlone(a.meta.x, a.meta.y, s,
          { fs: fsRel, font: font, colore: R.coloreDi(a.e.rel), alone: tema.panel }));
      });
    }

    // 4. card
    Object.keys(res.pos).forEach(function (id) {
      var p = res.pos[id], nodo = perId[id] || {};
      var col = coloreNodo(nodo, gruppi, tema);
      var x = p.x - W / 2, y = p.y - H / 2;
      var acceso = opt.evidenzia && opt.evidenzia === id;
      var suo = nodo.origine === 'utente';
      var nFonti = fontiDi(nodo).length;
      // le tre vie che rendono un nodo apribile: l'elenco nuovo, il rimando
      // dell'estrazione, il capitolo. Basta una
      var apribile = nFonti > 0 || !!nodo.rimando || nodo.capitolo != null;
      var stato = opt.chiudibili && opt.chiudibili[id];
      var testoN = nodo.testo || '';
      /* Il ritaglio dell'album, se il nodo ne porta uno. L'indirizzo lo dà chi
         chiama: qui non si sa né dove stia l'album né come lo si legga, e la
         funzione può anche tornare vuoto — un file cancellato fuori dall'app è
         un caso normale, non un guasto. */
      var imm = immagineDi(nodo);
      var srcImm = (imm && typeof opt.srcImmagine === 'function') ? String(opt.srcImmagine(imm) || '') : '';
      /* ⚠️ Un nodo-immagine ha le SUE misure: larghezza dalla card per la scala
         scelta, altezza dal rapporto del ritaglio, centrato sulla posizione che
         il motore gli ha dato. Il motore non lo sa: spaziature e attacchi degli
         archi restano calcolati sulla card di fabbrica.
         E NON è un debito da pagare. I nodi-immagine esistono solo sulle mappe
         dell'utente — `mappaNodoImmagine` è l'unica porta che li crea e sulla
         mappa generata rifiuta, e `genera.js` non emette mai `immagine` — cioè
         proprio dove la disposizione la fa la mano e non il motore. Insegnare le
         misure per nodo a quattro motori vorrebbe dire riscrivere la geometria
         su cui poggia tutto il resto del disegno per un caso che, per decisione
         dell'utente (10 agosto 2026), non si presenta. Chi legge questo commento
         cercando il debito: non c'è. */
      var kImm = imm ? scalaImmagine(imm) : 1;
      var mImm = imm ? misureImmagine(imm, W, H, kImm, !!(nodo.testo || '').trim(), fsNodo) : null;
      var Wn = imm ? mImm.W : W, Hn = imm ? mImm.H : H;
      if (imm) { x = p.x - Wn / 2; y = p.y - Hn / 2; }
      var riq = imm ? riquadroImmagine(x, y, mImm) : null;
      // il tasto del ramo sta SUL BORDO, fuori dallo specchio del testo: la
      // riga non si accorcia per fargli posto
      /* Con un'immagine il testo del nodo scende sotto e diventa DIDASCALIA: una
         riga sola, tagliata, nella fascia che il riquadro ha lasciato libera. Non
         è un ripiego — è la gerarchia giusta, perché su un nodo-immagine ciò che
         si legge per primo è lo schema, e la frase serve a dire quale schema è. */
      var ls = imm
        ? righe(testoN, Wn - 18, fsNodo, 1)
        : righe(testoN, W - 18, fsNodo, Math.max(1, Math.floor((H - 10) / (fsNodo * 1.25))));
      var y0 = imm ? riq.cyDid : p.y - (ls.length - 1) * fsNodo * 0.62;

      // il <title> è il suggerimento del sistema: su una card il testo è
      // troncato a due o tre righe, e questo è l'unico modo di leggerlo intero
      // senza aprire nulla
      var suggerimento = testoN + (nodo.nota ? '\n\n' + nodo.nota : '');
      /* L'etichetta della card dice anche QUANTE fonti ci sono. La mappa si
         percorre da tastiera, un nodo per volta, e senza il numero un concetto
         che cita tre punti si annuncia identico a uno che non ne cita nessuno:
         chi non vede lo schermo non ha modo di sapere che lì sotto c'è un menu
         da aprire invece di un rimando solo.
         Il conto lo dà unicamente il campo nuovo: sulla via vecchia (`rimando`,
         `capitolo`) l'etichetta resta il testo nudo, come è sempre stata. */
      /* ⚠️ E dice anche che la card È un'immagine. La mappa si percorre da
         tastiera, un nodo per volta: senza questa aggiunta un nodo che mostra uno
         schema si annuncerebbe con la sola didascalia — cioè come un nodo di
         testo qualsiasi, per giunta troncato — e chi non vede lo schermo non
         avrebbe modo di sapere che lì c'è un'immagine. Quando il ritaglio non si
         riesce a mostrare lo dice con le stesse parole che compaiono nel
         segnaposto: ciò che si legge e ciò che si sente devono coincidere. */
      var etichettaCard = testoN +
        (imm ? ' — ' + (srcImm ? 'immagine' : SEGNAPOSTO) : '') +
        (nFonti ? ' — ' + nFonti + (nFonti === 1 ? ' fonte' : ' fonti') : '');
      var g = ['<g class="mnodo" data-id="' + esc(id) + '"' + (apribile ? ' data-apri="1"' : '') +
        ' role="listitem" aria-label="' + esc(etichettaCard) + '"><title>' + esc(suggerimento) + '</title>'];
      /* ⚠️ Il nodo-immagine non ha la cornice: tre lati nudi, e a sinistra la
         sola barra del colore, dello stesso spessore delle altre card. Il
         rettangolo resta — è il bersaglio del click e il fondo su cui poggia la
         didascalia — ma senza tratto. Quando è selezionato il tratto torna: la
         selezione è un fatto momentaneo, non una cornice. */
      g.push('<rect x="' + n1(x) + '" y="' + n1(y) + '" width="' + n1(Wn) + '" height="' + n1(Hn) + '" fill="' + tema.panel +
        '" stroke="' + (acceso ? col : (imm ? 'none' : tema.line)) + '" stroke-width="' + (acceso ? 2.5 : 1) + '"' +
        (suo && !imm ? ' stroke-dasharray="4 3"' : '') + '/>');
      /* La barra d'accento dice il gruppo senza colorare il fondo, che renderebbe
         illeggibile il testo in tema scuro. Su una card sta sul lato da cui il
         ramo entra; su un'immagine sta SEMPRE a sinistra, perché lì è l'unica
         cosa che resta del riquadro e deve stare sempre nello stesso posto. */
      g.push(imm || o.orient === 'lr'
        ? '<rect x="' + n1(x) + '" y="' + n1(y) + '" width="' + BARRA + '" height="' + n1(Hn) + '" fill="' + col + '"/>'
        : '<rect x="' + n1(x) + '" y="' + n1(y) + '" width="' + n1(Wn) + '" height="' + BARRA + '" fill="' + col + '"/>');
      /* Il ritaglio va DENTRO la card, subito dopo il fondo e la barra: sotto ci
         deve restare il rettangolo che risponde al click, sopra ci passeranno il
         numero del passo e la didascalia. La card resta `.mnodo` e la sua
         identità non cambia di una virgola — un nodo-immagine si preme come
         qualunque altro nodo. */
      if (riq) g.push(pezzoImmagine(riq, srcImm, tema, font, fsNodo));
      if (res.passo && res.passo[id] != null) {
        g.push('<text x="' + n1(x + 7) + '" y="' + n1(y + Hn - 7) + '" font-family="' + esc(font) +
          '" font-size="' + Math.max(8, fsRel - 1) + '" font-weight="700" fill="' + tema.muted + '">' +
          res.passo[id] + '</text>');
      }
      /* Il pallino della fonte sta nell'angolo in alto a destra, quello del ramo
         sul bordo, al centro di un lato: due segni che non si confondono né per
         posto né per dimensione.

         Il pallino della fonte è disegnato dopo la card, come FRATELLO: nel
         registro «Mie» il click sulla card seleziona il nodo, e la fonte deve
         restare raggiungibile con un bersaglio suo. Dentro il gruppo della card
         erediterebbe il click della selezione — è la stessa ragione per cui il
         tasto del ramo sta fuori, e lì l'errore sarebbe stato aprire un PDF
         chiudendo un ramo.
         Il segno non cambia: resta il cerchietto piccolo nell'angolo, quello
         che già oggi dice «qui sotto c'è una fonte». Cambia solo che ora si può
         premere, con un bersaglio invisibile abbastanza largo da centrarlo.

         PIÙ FONTI SULLO STESSO NODO — `data-fonti="N"`.
         Chi preme deve sapere prima di premere che cosa succederà: con una
         fonte sola si apre l'anteprima, con tre si apre una bolla e si sceglie.
         Il numero sta in un `data-*` e non nel testo dell'etichetta perché lo
         legge il renderer, non un umano, e leggerlo da una frase vorrebbe dire
         analizzare l'italiano per decidere un ramo di codice.
         ⚠️ L'attributo compare SOLO se il nodo porta l'elenco nuovo. Sulla via
         vecchia (`rimando`, `capitolo`) non c'è: un `data-fonti="1"` messo lì
         per simmetria direbbe al renderer che esiste una lista da cui pescare,
         e la lista non c'è.

         Il caso multi-fonte si dice a colpo d'occhio con un NUMERINO alla
         sinistra del pallino — non con un pallino più grosso, che sarebbe
         cresciuto verso la porta (i due centri distano 15,8px: vedi sotto), e
         non con due pallini, che oltre il due non sanno contare. Il numerino
         cresce verso l'interno della card (`text-anchor="end"`), dove non c'è
         nessun altro bersaglio, e porta l'alone bianco perché lì sotto passa il
         testo del nodo. Oltre il nove diventa «9+»: la card di fabbrica è larga
         168px, e un conto che si allarga senza limite entra nelle parole.
         ⚠️ La GEOMETRIA DEL BERSAGLIO non cambia di un pixel: resta il cerchio
         invisibile r=11 centrato in (x+W−9, y+11), e il numerino è
         `pointer-events="none"` come ogni testo di questo file. Un segno che
         cambia dimensione a seconda del contenuto sposterebbe il punto in cui
         la mano ha imparato a premere. */
      var etichettaFonte = nFonti > 1
        ? nFonti + ' fonti — scegli quale aprire'
        : 'Apri la fonte';
      var cxF = n1(x + Wn - 9), cyF = n1(y + 11);
      var fonte = apribile
        ? '<g class="mfonte" data-id="' + esc(id) + '"' + (nFonti ? ' data-fonti="' + nFonti + '"' : '') +
          ' role="button" tabindex="0" aria-label="' + esc(etichettaFonte) + '">' +
          '<title>' + esc(etichettaFonte) + '</title>' +
          '<circle cx="' + cxF + '" cy="' + cyF + '" r="11" fill="#ffffff" fill-opacity="0"/>' +
          '<circle cx="' + cxF + '" cy="' + cyF + '" r="3" fill="' + col + '"/>' +
          (nFonti > 1
            ? testoConAlone(x + Wn - 15, y + 11, nFonti > 9 ? '9+' : String(nFonti),
                { fs: Math.max(8, fsRel - 1), font: font, colore: col, alone: tema.panel,
                  ancora: 'end', peso: 700 })
            : '') +
          '</g>'
        : '';
      ls.forEach(function (riga, i) {
        g.push('<text x="' + n1(p.x) + '" y="' + n1(y0 + i * fsNodo * 1.25) + '" text-anchor="middle" ' +
          'dominant-baseline="middle" font-family="' + esc(font) + '" font-size="' + fsNodo + '" ' +
          'font-weight="' + (nodo.genere === 'radice' ? 700 : 500) + '" fill="' + tema.ink + '">' + esc(riga) + '</text>');
      });
      g.push('</g>');
      out.push(g.join(''));

      /* La porta: il bersaglio da cui si TRASCINA un arco verso un altro nodo
         (§4.2). È un FRATELLO della card, come il pallino della fonte e quello
         del ramo: dentro il gruppo erediterebbe il click che seleziona il nodo,
         e il gesto finirebbe a selezionare invece che a collegare.

         Si emette solo su richiesta (`opt.maniglie`), perché è un attrezzo del
         registro «Mie»: nella vista generata non si collega niente, e
         soprattutto l'esportazione in PDF non deve stampare una maniglia su
         ogni card. Chi esporta non passa l'opzione e il markup non esiste
         proprio — più sicuro che affidarsi al fatto che sia invisibile.
         ⚠️ Si chiama `maniglie` e non `porte` perché `layouts` usa già `porte`
         per un'altra cosa (i punti d'attacco degli archi sul bordo): due
         significati per la stessa parola, in due oggetti di opzioni che si
         somigliano, sono un errore che si commette una volta sola ma in
         silenzio.

         La visibilità è del CSS (si vede al passaggio del mouse): qui si
         producono solo il markup e gli attributi. Il segno resta ad ATTRIBUTI,
         come tutto il resto del file.

         ⚠️ Va PRIMA della fonte, non dopo. Con la card di fabbrica (168×48) il
         centro della porta cade a 15,8px dal pallino della fonte, e i due
         bersagli invisibili si sovrappongono: in SVG vince l'ultimo disegnato,
         e la porta ruberebbe i click alla fonte. La fonte è il bersaglio più
         piccolo e più preciso dei due — la porta le cede la parte comune. */
      /* Le maniglie agli angoli di un nodo-immagine: si prende un angolo e si
         trascina per ingrandire.
         ⚠️ Solo sul nodo SELEZIONATO, e solo se è un'immagine. Quattro pallini
         su ogni ritaglio competerebbero con il ritaglio — che è la cosa che si
         deve leggere per prima — e su una mappa piena sarebbero decine di segni
         che nessuno ha chiesto. Si sceglie il nodo, poi lo si ridimensiona: è
         l'ordine in cui la mano già lavora.
         Fuori dal gruppo della card, come la porta e il pallino della fonte:
         dentro erediterebbero il click che seleziona, e prendere un angolo
         sposterebbe il nodo invece di ridimensionarlo. */
      if (imm && acceso && opt.maniglie) {
        [['nw', x, y], ['ne', x + Wn, y], ['sw', x, y + Hn], ['se', x + Wn, y + Hn]]
          .forEach(function (a) {
            out.push('<g class="mscala" data-id="' + esc(id) + '" data-ang="' + a[0] + '" ' +
              'role="button" tabindex="-1" aria-label="Ridimensiona l\'immagine">' +
              '<title>Trascina per ridimensionare</title>' +
              /* Bersaglio invisibile largo: un angolo si mira male, e 5px di
                 quadratino non si prendono con il trackpad. */
              '<circle cx="' + n1(a[1]) + '" cy="' + n1(a[2]) + '" r="11" fill="#ffffff" fill-opacity="0"/>' +
              '<rect x="' + n1(a[1] - 3.5) + '" y="' + n1(a[2] - 3.5) + '" width="7" height="7" ' +
                'fill="' + tema.panel + '" stroke="' + col + '" stroke-width="1.5"/></g>');
          });
      }
      if (opt.maniglie) {
        var dPorta = versoDellaPorta(versoDeiFigli(res, p));
        var pPorta = sulBordo(p, dPorta, Wn, Hn);
        out.push('<g class="mporta" data-id="' + esc(id) + '" role="button" tabindex="0" ' +
          'aria-label="Trascina da qui per collegare"><title>Trascina da qui per collegare</title>' +
          // bersaglio invisibile: sta fra i 13 del ramo e gli 11 della fonte —
          // largo per una mira incerta, non tanto da invadere i vicini
          '<circle cx="' + n1(pPorta.x) + '" cy="' + n1(pPorta.y) + '" r="12" fill="#ffffff" fill-opacity="0"/>' +
          '<circle cx="' + n1(pPorta.x) + '" cy="' + n1(pPorta.y) + '" r="5" fill="' + col +
          '" stroke="' + tema.panel + '" stroke-width="1.5"/></g>');
      }

      if (fonte) out.push(fonte);
      /* Tasto apri/chiudi del ramo: un pallino sul BORDO, al centro del lato da
         cui escono le diramazioni — cioè dove il ramo comincia davvero. Sta
         fuori dal gruppo della card perché dentro erediterebbe il click che
         apre la fonte, e chiudere un ramo aprirebbe un PDF: è un fratello, non
         un figlio.

         Niente «+» e «−»: la differenza la fa il pieno. Anello = il ramo è
         aperto, non c'è niente di riposto; pallino pieno = dentro c'è
         qualcosa. È la stessa convenzione dei dischi di un elenco, e non
         chiede di leggere un segno piccolo due pixel. */
      if (stato) {
        var d = versoDeiFigli(res, p);
        // il bordo nella direzione dei figli: per td è il basso, per lr la
        // destra, per gli anelli il punto rivolto all'esterno del cerchio
        var pT = sulBordo(p, d, Wn, Hn);
        var px2 = pT.x, py2 = pT.y;
        var quanti = (opt.nascosti && opt.nascosti[id]) || 0;
        var etichetta = stato === 'chiuso'
          ? 'Apri il ramo' + (quanti ? ' — ' + quanti + (quanti === 1 ? ' nodo nascosto' : ' nodi nascosti') : '')
          : 'Chiudi il ramo';
        out.push('<g class="mtoggle" data-id="' + esc(id) + '" data-stato="' + stato + '" role="button" ' +
          'tabindex="0" aria-label="' + esc(etichetta) + '"><title>' + esc(etichetta) + '</title>' +
          // bersaglio invisibile: il pallino è di 6px di raggio, ma per una mira
          // incerta 13 fanno la differenza
          '<circle cx="' + n1(px2) + '" cy="' + n1(py2) + '" r="13" fill="#ffffff" fill-opacity="0"/>' +
          '<circle cx="' + n1(px2) + '" cy="' + n1(py2) + '" r="6" ' +
          (stato === 'chiuso'
            ? 'fill="' + col + '" stroke="' + tema.panel + '" stroke-width="2"'
            : 'fill="' + tema.panel + '" stroke="' + col + '" stroke-width="2"') + '/>' +
          '</g>');
      }
    });

    var titolo = opt.titolo ? '<title>' + esc(opt.titolo) + '</title>' : '';
    return {
      markup: titolo + '<g class="mzoom">' + out.join('') + '</g>',
      viewBox: vb.join(' '),
      bbox: b
    };
  }

  return { svg: svg, righe: righe, esc: esc, colore: colore, coloreNodo: coloreNodo,
           fontiDi: fontiDi, immagineDi: immagineDi, riquadroImmagine: riquadroImmagine,
           SEGNAPOSTO: SEGNAPOSTO,
           versoDeiFigli: versoDeiFigli, versoDellaPorta: versoDellaPorta, sulBordo: sulBordo,
           TEMA: TEMA, GRUPPI: GRUPPI };
}));
