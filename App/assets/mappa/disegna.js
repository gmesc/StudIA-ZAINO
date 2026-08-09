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
  function testoConAlone(x, y, s, opt) {
    var comune = 'x="' + n1(x) + '" y="' + n1(y) + '" text-anchor="middle" font-family="' + esc(opt.font) +
      '" font-size="' + opt.fs + '" dominant-baseline="middle" pointer-events="none"';
    return '<text ' + comune + ' fill="' + opt.alone + '" stroke="' + opt.alone +
      '" stroke-width="3.5" stroke-linejoin="round">' + esc(s) + '</text>' +
      '<text ' + comune + ' fill="' + opt.colore + '">' + esc(s) + '</text>';
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
   *               evidenzia:id, font, titolo, margine }
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
    if (opt.etichette !== 'no') {
      (res.archi || []).forEach(function (a) {
        if (!a.e.rel || a.e._filo) return;
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
      var apribile = !!nodo.rimando || nodo.capitolo != null;
      var stato = opt.chiudibili && opt.chiudibili[id];
      var testoN = nodo.testo || '';
      // il tasto del ramo sta SUL BORDO, fuori dallo specchio del testo: la
      // riga non si accorcia per fargli posto
      var ls = righe(testoN, W - 18, fsNodo, Math.max(1, Math.floor((H - 10) / (fsNodo * 1.25))));
      var y0 = p.y - (ls.length - 1) * fsNodo * 0.62;

      // il <title> è il suggerimento del sistema: su una card il testo è
      // troncato a due o tre righe, e questo è l'unico modo di leggerlo intero
      // senza aprire nulla
      var suggerimento = testoN + (nodo.nota ? '\n\n' + nodo.nota : '');
      var g = ['<g class="mnodo" data-id="' + esc(id) + '"' + (apribile ? ' data-apri="1"' : '') +
        ' role="listitem" aria-label="' + esc(testoN) + '"><title>' + esc(suggerimento) + '</title>'];
      g.push('<rect x="' + n1(x) + '" y="' + n1(y) + '" width="' + W + '" height="' + H + '" fill="' + tema.panel +
        '" stroke="' + (acceso ? col : tema.line) + '" stroke-width="' + (acceso ? 2.5 : 1) + '"' +
        (suo ? ' stroke-dasharray="4 3"' : '') + '/>');
      // barra d'accento sul lato da cui il ramo entra: dice il gruppo senza
      // colorare il fondo, che renderebbe illeggibile il testo in tema scuro
      g.push(o.orient === 'lr'
        ? '<rect x="' + n1(x) + '" y="' + n1(y) + '" width="4" height="' + H + '" fill="' + col + '"/>'
        : '<rect x="' + n1(x) + '" y="' + n1(y) + '" width="' + W + '" height="4" fill="' + col + '"/>');
      if (res.passo && res.passo[id] != null) {
        g.push('<text x="' + n1(x + 7) + '" y="' + n1(y + H - 7) + '" font-family="' + esc(font) +
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
         premere, con un bersaglio invisibile abbastanza largo da centrarlo. */
      var fonte = apribile
        ? '<g class="mfonte" data-id="' + esc(id) + '" role="button" tabindex="0" aria-label="Apri la fonte">' +
          '<title>Apri la fonte</title>' +
          '<circle cx="' + n1(x + W - 9) + '" cy="' + n1(y + 11) + '" r="11" fill="#ffffff" fill-opacity="0"/>' +
          '<circle cx="' + n1(x + W - 9) + '" cy="' + n1(y + 11) + '" r="3" fill="' + col + '"/></g>'
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
      if (opt.maniglie) {
        var dPorta = versoDellaPorta(versoDeiFigli(res, p));
        var pPorta = sulBordo(p, dPorta, W, H);
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
        var pT = sulBordo(p, d, W, H);
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
           versoDeiFigli: versoDeiFigli, versoDellaPorta: versoDellaPorta, sulBordo: sulBordo,
           TEMA: TEMA, GRUPPI: GRUPPI };
}));
