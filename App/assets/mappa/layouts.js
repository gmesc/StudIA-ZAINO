/* =========================================================================
   layouts — i motori di disposizione della mappa.

   Quattro motori sullo STESSO grafo, perché sono quattro domande diverse:
     albero   · la gerarchia pura                      «da cosa discende cosa»
     dag      · livelli con archi che saltano          «cosa dipende da cosa»
     percorso · ordine topologico a serpentina         «in che ordine studio»
     anelli   · distanza da un centro                  «cosa sta a un passo da qui»

   Tre stadi separati, così ogni opzione è una leva vera e non un preset:
     1. POSIZIONAMENTO   dove stanno i nodi
     2. INSTRADAMENTO    che strada fanno gli archi (dritto · curva · orto)
     3. MISURA           sulla geometria EFFETTIVAMENTE disegnata

   Il motore propone, la mano dispone: un nodo che porta `x` e `y` sta dove
   l'utente l'ha messo, e gli archi si tracciano DOPO, sulle posizioni
   definitive (vedi `finisci`). Il primo stadio è quindi il motore *più* le
   posizioni fissate, non il motore da solo.

   Le coordinate interne sono (al, ac): «lungo il livello» e «attraverso i
   livelli». L'orientamento — dall'alto o da sinistra — è UNA trasformazione
   finale, non un secondo ramo di codice: `td` e `lr` non possono divergere
   perché è lo stesso codice.

   Deterministico: stesso grafo e stesse opzioni ⇒ stesso disegno, sempre.
   Nessuna fisica, nessun caso: la memoria visiva di dove sta un concetto è
   parte di ciò che si impara, e un layout che si riassesta a ogni apertura la
   manda a monte.

   Modulo PURO, UMD (vedi relazioni.js).
   ========================================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(null);
  else root.MappaLayouts = factory(root);
}(typeof self !== 'undefined' ? self : this, function (glob) {
  'use strict';

  // il globale arriva come argomento: dentro la factory non è in scope
  var G = glob ? glob.MappaGrafo : require('./grafo');

  var DEFAULT = {
    motore: 'albero',
    orient: 'td',        // 'td' dall'alto · 'lr' da sinistra
    w: 168, h: 48,       // la card
    gapNodo: 26,         // fra card dello stesso livello
    gapLivello: 92,      // fra un livello e il successivo
    linee: 'curva',      // 'curva' · 'dritto' · 'orto'
    porte: true,         // punti di attacco distinti sul bordo
    centro: null,        // solo per 'anelli'
    gapRadici: 90        // fra due alberi separati
  };

  function opzioni(opt) {
    var o = {};
    Object.keys(DEFAULT).forEach(function (k) { o[k] = DEFAULT[k]; });
    Object.keys(opt || {}).forEach(function (k) { if (opt[k] !== undefined && opt[k] !== null) o[k] = opt[k]; });
    o.w = Math.max(40, +o.w || DEFAULT.w);
    o.h = Math.max(24, +o.h || DEFAULT.h);
    o.gapNodo = Math.max(4, +o.gapNodo || 0);
    o.gapLivello = Math.max(16, +o.gapLivello || 0);
    return o;
  }

  /* Il solo punto in cui l'orientamento esiste. `along` è la misura della card
     nella direzione in cui i pari si affiancano, `across` quella in cui i
     livelli si succedono: scambiarle è tutto ciò che distingue td da lr. */
  function metriche(o) {
    var td = o.orient !== 'lr';
    return { td: td, along: td ? o.w : o.h, across: td ? o.h : o.w };
  }
  function aXY(p, o) { return metriche(o).td ? { x: p.al, y: p.ac } : { x: p.ac, y: p.al }; }

  /* ----------------------------------------------------------- instradamento */

  function campiona(a, b, n) {
    var out = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
    return out;
  }
  function bezier(a, b, o, n) {
    var td = metriche(o).td;
    var c1 = td ? { x: a.x, y: a.y + (b.y - a.y) * 0.45 } : { x: a.x + (b.x - a.x) * 0.45, y: a.y };
    var c2 = td ? { x: b.x, y: b.y - (b.y - a.y) * 0.45 } : { x: b.x - (b.x - a.x) * 0.45, y: b.y };
    var out = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n, u = 1 - t;
      out.push({
        x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
        y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y
      });
    }
    out._d = 'M' + r1(a.x) + ',' + r1(a.y) + ' C' + r1(c1.x) + ',' + r1(c1.y) + ' ' +
             r1(c2.x) + ',' + r1(c2.y) + ' ' + r1(b.x) + ',' + r1(b.y);
    return out;
  }
  function orto(a, b, o) {
    var td = metriche(o).td;
    var m = td ? (a.y + b.y) / 2 : (a.x + b.x) / 2;
    var pts = td
      ? [a, { x: a.x, y: m }, { x: b.x, y: m }, b]
      : [a, { x: m, y: a.y }, { x: m, y: b.y }, b];
    // due segmenti allineati non aggiungono informazione e sporcano la misura
    return pts.filter(function (p, i) {
      if (i === 0 || i === pts.length - 1) return true;
      return Math.abs(p.x - pts[i - 1].x) > 0.5 || Math.abs(p.y - pts[i - 1].y) > 0.5;
    });
  }
  function r1(v) { return Math.round(v * 10) / 10; }
  function dDa(pts) {
    if (pts._d) return pts._d;
    return pts.map(function (p, i) { return (i ? 'L' : 'M') + r1(p.x) + ',' + r1(p.y); }).join(' ');
  }

  /** Punti d'attacco sul bordo della card. Senza porte tutti gli archi partono
   *  dal centro del lato e si sovrappongono nei primi venti pixel, che è
   *  proprio dove servirebbe distinguerli. */
  function porta(pos, o, verso, indice, totale) {
    var m = metriche(o);
    var frazione = totale > 1 ? (indice + 1) / (totale + 1) : 0.5;
    var scarto = o.porte ? (frazione - 0.5) * (m.along * 0.72) : 0;
    if (m.td) return { x: pos.x + scarto, y: pos.y + verso * o.h / 2 };
    return { x: pos.x + verso * o.w / 2, y: pos.y + scarto };
  }

  /** Instrada tutti gli archi fra posizioni già decise. */
  function instrada(pos, es, o, viaDi) {
    // le porte si assegnano in ordine di posizione del capo opposto: così due
    // archi che vanno a destra e a sinistra non si incrociano appena usciti
    var usc = {}, ent = {};
    es.forEach(function (e) {
      (usc[e.da] = usc[e.da] || []).push(e);
      (ent[e.a] = ent[e.a] || []).push(e);
    });
    var m = metriche(o);
    function chiave(p) { return m.td ? p.x : p.y; }
    function ordina(lista, verso) {
      lista.sort(function (a, b) {
        var pa = pos[verso === 'usc' ? a.a : a.da], pb = pos[verso === 'usc' ? b.a : b.da];
        return (pa && pb) ? chiave(pa) - chiave(pb) : 0;
      });
    }
    Object.keys(usc).forEach(function (k) { ordina(usc[k], 'usc'); });
    Object.keys(ent).forEach(function (k) { ordina(ent[k], 'ent'); });

    return es.map(function (e) {
      var pa = pos[e.da], pb = pos[e.a];
      if (!pa || !pb) return null;
      var m2 = metriche(o);
      var giu = m2.td ? (pb.y >= pa.y) : (pb.x >= pa.x);
      var a = porta(pa, o, giu ? 1 : -1, usc[e.da].indexOf(e), usc[e.da].length);
      var b = porta(pb, o, giu ? -1 : 1, ent[e.a].indexOf(e), ent[e.a].length);
      var via = viaDi ? viaDi(e) : null;
      var pts;
      if (via && via.length) {
        pts = [a];
        via.forEach(function (p) { pts.push(p); });
        pts.push(b);
        if (o.linee === 'curva') pts = lisci(pts);
      } else if (o.linee === 'orto') pts = orto(a, b, o);
      else if (o.linee === 'dritto') pts = campiona(a, b, 1);
      else pts = bezier(a, b, o, 12);
      var mid = pts[Math.floor(pts.length / 2)];
      return { e: e, punti: pts, d: dDa(pts), meta: mid };
    }).filter(Boolean);
  }

  /* Polilinea addolcita: media mobile sui punti interni. Serve agli archi che
     passano per i nodi-fantasma del DAG, che a spigoli vivi sembrano rotti. */
  function lisci(pts) {
    if (pts.length < 3) return pts;
    var out = [pts[0]];
    for (var i = 1; i < pts.length - 1; i++) {
      var a = pts[i - 1], c = pts[i], b = pts[i + 1];
      out.push({ x: (a.x + c.x * 2 + b.x) / 4, y: (a.y + c.y * 2 + b.y) / 4 });
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  /* ------------------------------------------------------------------ albero */

  /** Reingold-Tilford semplificato: le foglie prendono uno slot in fila, ogni
   *  genitore si centra sui propri figli. Con card di larghezza uniforme dà lo
   *  stesso risultato dell'algoritmo completo, in un quarto delle righe. */
  function layoutAlbero(g, o) {
    var s = G.sanitizza(g);
    var m = metriche(o);
    var passo = m.along + o.gapNodo;
    var P = {}, cursore = 0;

    function posa(id, prof) {
      var figli = (s.figli[id] || []);
      var al;
      if (!figli.length) { al = cursore; cursore += passo; }
      else {
        var primi = [];
        figli.forEach(function (f) { primi.push(posa(f, prof + 1)); });
        al = (primi[0] + primi[primi.length - 1]) / 2;
      }
      P[id] = { al: al, ac: prof * (m.across + o.gapLivello), livello: prof };
      return al;
    }
    s.radici.forEach(function (r, i) {
      if (i) cursore += o.gapRadici;
      posa(r, 0);
    });
    // nodi rimasti fuori (non dovrebbe accadere dopo sanitizza: rete di sicurezza)
    s.nodi.forEach(function (n) { if (!P[n.id]) { P[n.id] = { al: cursore, ac: 0, livello: 0 }; cursore += passo; } });

    var pos = {};
    Object.keys(P).forEach(function (k) { pos[k] = aXY(P[k], o); pos[k].livello = P[k].livello; });
    var albero = {}, fuori = [];
    s.archi.forEach(function (e) { if (s.genitore[e.a] === e.da) albero[e.da + '␟' + e.a] = true; });
    s.archi.forEach(function (e) { if (!albero[e.da + '␟' + e.a]) fuori.push(e); });

    return finisci({ tipo: 'albero', pos: pos, nodi: s.nodi,
                     stats: { radici: s.radici.length, fuoriAlbero: fuori.length }, opt: o },
                   [{ campo: 'archi', es: s.archi }]);
  }

  /* --------------------------------------------------------------------- dag */

  /** Sugiyama: livelli per cammino più lungo, nodi-fantasma per gli archi che
   *  saltano un livello, ordinamento a baricentro, poi raddrizzamento. */
  function layoutDag(g, o) {
    var s = G.sanitizza(g);
    var m = metriche(o);
    var p = G.profondita(s.nodi, s.archi);
    var es = p.archi;                          // archi con i cicli già rotti
    var liv = p.livello;

    // 1. nodi-fantasma: un arco lungo diventa una catena di segmenti corti
    var fant = [], catena = {};
    var esCorti = [];
    es.forEach(function (e, i) {
      var d = liv[e.a] - liv[e.da];
      if (d <= 1) { esCorti.push({ da: e.da, a: e.a, _e: e }); catena[i] = []; return; }
      var prev = e.da, via = [];
      for (var k = liv[e.da] + 1; k < liv[e.a]; k++) {
        var id = '␆f' + i + '_' + k;
        fant.push({ id: id, livello: k });
        liv[id] = k;
        esCorti.push({ da: prev, a: id, _e: e, _fant: true });
        via.push(id);
        prev = id;
      }
      esCorti.push({ da: prev, a: e.a, _e: e, _fant: true });
      catena[i] = via;
    });

    // 2. ordinamento dentro ogni livello
    var perLiv = {};
    s.nodi.forEach(function (n) { (perLiv[liv[n.id]] = perLiv[liv[n.id]] || []).push(n.id); });
    fant.forEach(function (f) { (perLiv[f.livello] = perLiv[f.livello] || []).push(f.id); });
    var livelli = Object.keys(perLiv).map(Number).sort(function (a, b) { return a - b; });
    // ordine di partenza stabile: gruppo, poi id — mai casuale
    var gruppoDi = {};
    s.nodi.forEach(function (n) { gruppoDi[n.id] = n.gruppo == null ? 0 : n.gruppo; });
    livelli.forEach(function (L) {
      perLiv[L].sort(function (a, b) {
        var ga = gruppoDi[a] == null ? 99 : gruppoDi[a], gb = gruppoDi[b] == null ? 99 : gruppoDi[b];
        return ga - gb || String(a).localeCompare(String(b));
      });
    });
    var su = {}, giu = {};
    esCorti.forEach(function (e) { (giu[e.da] = giu[e.da] || []).push(e.a); (su[e.a] = su[e.a] || []).push(e.da); });

    function indice(L) { var m2 = {}; perLiv[L].forEach(function (id, i) { m2[id] = i; }); return m2; }
    function baricentro(L, rif, mappa) {
      var idx = indice(rif);
      var chiavi = {};
      perLiv[L].forEach(function (id, i) {
        var v = (mappa[id] || []).map(function (x) { return idx[x]; }).filter(function (x) { return x != null; });
        chiavi[id] = v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : i;
      });
      perLiv[L].sort(function (a, b) { return chiavi[a] - chiavi[b] || String(a).localeCompare(String(b)); });
    }
    for (var giro = 0; giro < 4; giro++) {
      for (var i2 = 1; i2 < livelli.length; i2++) baricentro(livelli[i2], livelli[i2 - 1], su);
      for (var j2 = livelli.length - 2; j2 >= 0; j2--) baricentro(livelli[j2], livelli[j2 + 1], giu);
    }

    // 3. posizioni: slot regolari, poi tre passate che tirano ogni nodo verso la
    //    mediana dei vicini senza mai violare la distanza minima
    var passo = m.along + o.gapNodo;
    var AL = {};
    livelli.forEach(function (L) { perLiv[L].forEach(function (id, i) { AL[id] = i * passo; }); });
    function raddrizza(mappa) {
      livelli.forEach(function (L) {
        var lista = perLiv[L];
        var voluto = lista.map(function (id) {
          var v = (mappa[id] || []).map(function (x) { return AL[x]; }).filter(function (x) { return x != null; });
          if (!v.length) return AL[id];
          v.sort(function (a, b) { return a - b; });
          return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
        });
        for (var i3 = 0; i3 < lista.length; i3++) {
          var min = i3 ? AL[lista[i3 - 1]] + passo : -Infinity;
          AL[lista[i3]] = Math.max(min, voluto[i3]);
        }
        for (var k3 = lista.length - 2; k3 >= 0; k3--) {
          AL[lista[k3]] = Math.min(AL[lista[k3]], AL[lista[k3 + 1]] - passo);
        }
      });
    }
    for (var t = 0; t < 3; t++) { raddrizza(su); raddrizza(giu); }

    var pos = {}, posFant = {};
    s.nodi.forEach(function (n) {
      var q = aXY({ al: AL[n.id] || 0, ac: liv[n.id] * (m.across + o.gapLivello) }, o);
      q.livello = liv[n.id]; pos[n.id] = q;
    });
    fant.forEach(function (f) {
      posFant[f.id] = aXY({ al: AL[f.id] || 0, ac: f.livello * (m.across + o.gapLivello) }, o);
    });

    /* ⚠️ I nodi-fantasma NON si spostano dietro a un nodo fissato: restano dove
       il motore li ha messi, e l'arco lungo li usa ancora come appigli prima di
       chiudere sulla porta del nodo. È voluto — un fantasma è un punto di
       passaggio fra due livelli, non un pezzo del nodo. */
    return finisci({ tipo: 'dag', pos: pos, nodi: s.nodi,
                     stats: { livelli: livelli.length, fantasmi: fant.length, invertiti: p.invertiti }, opt: o },
                   [{ campo: 'archi', es: es, viaDi: function (e) {
                     var i4 = es.indexOf(e);
                     return (catena[i4] || []).map(function (id) { return posFant[id]; });
                   } }]);
  }

  /* ---------------------------------------------------------------- percorso */

  /** Ordine topologico (i prerequisiti prima) disposto a serpentina, col numero
   *  del passo. È la mappa che diventa scaletta: si legge come una lista, ma
   *  conserva i legami — che restano disegnati sotto, in filigrana. */
  function layoutPercorso(g, o) {
    var s = G.sanitizza(g);
    var m = metriche(o);
    var p = G.profondita(s.nodi, s.archi);
    var es = p.archi;
    var ids = s.nodi.map(function (n) { return n.id; });
    var gruppoDi = {};
    s.nodi.forEach(function (n) { gruppoDi[n.id] = n.gruppo == null ? 0 : n.gruppo; });

    var inGrado = {}, succ = {};
    ids.forEach(function (i) { inGrado[i] = 0; succ[i] = []; });
    es.forEach(function (e) { inGrado[e.a]++; succ[e.da].push(e.a); });
    var pronti = ids.filter(function (i) { return !inGrado[i]; });
    var ordine = [], gCorrente = null;
    while (pronti.length) {
      // a pari merito si resta nel ramo che si sta percorrendo: i rami escono
      // contigui invece di alternarsi passo per passo
      pronti.sort(function (a, b) {
        var pa = gruppoDi[a] === gCorrente ? 0 : 1, pb = gruppoDi[b] === gCorrente ? 0 : 1;
        return pa - pb || gruppoDi[a] - gruppoDi[b] || p.livello[a] - p.livello[b] || String(a).localeCompare(String(b));
      });
      var u = pronti.shift();
      ordine.push(u); gCorrente = gruppoDi[u];
      succ[u].forEach(function (v) { if (--inGrado[v] === 0) pronti.push(v); });
    }
    ids.forEach(function (i) { if (ordine.indexOf(i) < 0) ordine.push(i); });   // rete di sicurezza

    var n = ordine.length;
    var perRiga = Math.max(2, Math.ceil(Math.sqrt(n * 1.7 * (m.across + o.gapLivello) / (m.along + o.gapNodo))));
    var pos = {}, passo = {};
    ordine.forEach(function (id, i) {
      var riga = Math.floor(i / perRiga), col = i % perRiga;
      var vera = riga % 2 === 0 ? col : (perRiga - 1 - col);   // serpentina: si legge senza tornare a capo
      pos[id] = aXY({ al: vera * (m.along + o.gapNodo), ac: riga * (m.across + o.gapLivello) }, o);
      pos[id].livello = riga;
      passo[id] = i + 1;
    });

    // il filo del percorso è il contenuto; le relazioni vere restano in filigrana
    var filo = [];
    for (var i5 = 0; i5 < ordine.length - 1; i5++) filo.push({ da: ordine[i5], a: ordine[i5 + 1], rel: '', _filo: true });
    return finisci({ tipo: 'percorso', pos: pos, nodi: s.nodi, passo: passo,
                     stats: { passi: n, righe: Math.ceil(n / perRiga) }, opt: o },
                   [{ campo: 'archi', es: filo },
                    { campo: 'extra', es: es, o: Object.assign({}, o, { linee: 'dritto', porte: false }) }]);
  }

  /* Due insiemi di card si toccano? `stesso` salta la coppia (i,i) quando le due
     liste sono la stessa. Margine di 2px: due bordi che si sfiorano si leggono
     come un errore di disegno anche se tecnicamente non si sovrappongono. */
  function tocca(A, B, o, stesso) {
    for (var i = 0; i < A.length; i++) {
      for (var j = stesso ? i + 1 : 0; j < B.length; j++) {
        if (Math.abs(A[i].x - B[j].x) < o.w + 2 && Math.abs(A[i].y - B[j].y) < o.h + 2) return true;
      }
    }
    return false;
  }

  /* ------------------------------------------------------------------ anelli */

  /** Anelli concentrici: il centro è il nodo scelto (o la radice, o il più
   *  connesso), ogni anello è una distanza. È il layout naturale della mappa
   *  mentale, e risponde a «cosa sta a un passo, a due passi da qui». */
  function layoutAnelli(g, o) {
    var s = G.sanitizza(g);
    var m = metriche(o);
    var ids = s.nodi.map(function (n) { return n.id; });
    if (!ids.length) return finisci({ tipo: 'anelli', pos: {}, nodi: [], stats: {}, opt: o }, [{ campo: 'archi', es: [] }]);

    var adj = G.adiacenza(s.nodi, s.archi);
    var grado = {};
    ids.forEach(function (i) { grado[i] = adj[i].length; });
    var centro = (o.centro && adj[o.centro]) ? o.centro
      : (s.radici.length ? s.radici[0]
        : ids.slice().sort(function (a, b) { return grado[b] - grado[a] || String(a).localeCompare(String(b)); })[0]);

    var dist = {}; dist[centro] = 0;
    var coda = [centro], testa = 0;
    while (testa < coda.length) {
      var u = coda[testa++];
      adj[u].slice().sort().forEach(function (v) { if (dist[v] == null) { dist[v] = dist[u] + 1; coda.push(v); } });
    }
    var maxD = 0;
    ids.forEach(function (i) { if (dist[i] != null && dist[i] > maxD) maxD = dist[i]; });
    ids.forEach(function (i) { if (dist[i] == null) dist[i] = maxD + 1; });   // scollegati: anello esterno
    maxD = Math.max(maxD, Math.max.apply(null, ids.map(function (i) { return dist[i]; })));

    var pos = {}, angolo = {};
    pos[centro] = { x: 0, y: 0, livello: 0 };
    angolo[centro] = 0;
    /* Passo radiale: la distanza fra due anelli è quella fra due livelli, non la
       larghezza della card — che qui non conta, perché due card dello stesso
       anello si separano lungo la circonferenza (il termine sotto). Con un
       anello affollato è la circonferenza a decidere il raggio. */
    var base = Math.max(m.across + o.gapLivello, m.along * 0.7);
    for (var d = 1; d <= maxD; d++) {
      var anello = ids.filter(function (i) { return dist[i] === d; });
      if (!anello.length) continue;
      // angolo desiderato = media dei vicini dell'anello interno: i figli
      // restano sotto il proprio genitore invece di sparpagliarsi
      anello.forEach(function (id) {
        var dentro = adj[id].filter(function (v) { return dist[v] === d - 1 && angolo[v] != null; });
        angolo[id] = dentro.length
          ? dentro.reduce(function (a, v) { return a + angolo[v]; }, 0) / dentro.length
          : null;
      });
      anello.sort(function (a, b) {
        var aa = angolo[a], ab = angolo[b];
        if (aa == null && ab == null) return String(a).localeCompare(String(b));
        if (aa == null) return 1;
        if (ab == null) return -1;
        return aa - ab;
      });
      var circonf = anello.length * (m.along + o.gapNodo);
      var r = Math.max(base * d, circonf / (2 * Math.PI));
      var angoli = anello.map(function (id, i) {
        return 2 * Math.PI * i / anello.length + (d % 2) * (Math.PI / anello.length);
      });
      function posa(raggio) {
        return angoli.map(function (a2) {
          return { x: raggio * Math.cos(a2 - Math.PI / 2), y: raggio * Math.sin(a2 - Math.PI / 2) };
        });
      }
      /* Un anello si allarga finché le sue card non toccano né le vicine né
         quelle dell'anello dentro. La formula analitica non basta: due card
         adiacenti si sfiorano in orizzontale in cima al cerchio e in verticale
         ai fianchi, e il caso peggiore dipende dall'angolo. Meglio provare la
         geometria vera — è deterministico e finisce sempre. */
      var interno = ids.filter(function (i) { return dist[i] === d - 1 && pos[i]; }).map(function (i) { return pos[i]; });
      for (var giro = 0; giro < 60; giro++) {
        var p2 = posa(r);
        if (!tocca(p2, p2, o, true) && !tocca(p2, interno, o, false)) break;
        r += Math.max(12, base * 0.12);
      }
      var finali = posa(r);
      anello.forEach(function (id, i) { angolo[id] = angoli[i]; pos[id] = { x: finali[i].x, y: finali[i].y, livello: d }; });
    }
    var oDritto = Object.assign({}, o, { linee: o.linee === 'orto' ? 'dritto' : o.linee });
    return finisci({ tipo: 'anelli', pos: pos, nodi: s.nodi,
                     stats: { anelli: maxD + 1, centro: centro }, opt: o },
                   [{ campo: 'archi', es: s.archi, o: oDritto }]);
  }

  /* ------------------------------------------------------------- rifinitura */

  /** Le posizioni messe a mano vincono sul motore, su tutti e quattro. La
   *  passata sta qui e non dentro i motori perché una regola scritta quattro
   *  volte è una regola che fra un mese vale tre volte su quattro.
   *
   *  Che cosa voglia dire «fissato» non lo decide questo modulo: lo dice
   *  `grafo.fissato` — x e y, entrambe numeri finiti, e nessun flag accanto
   *  (⚠️ il perché del controllo sul tipo sta scritto lì). La stessa domanda la
   *  fanno anche `modifica.libera` e il menu contestuale, e tre letture a
   *  occhio della stessa condizione sono tre condizioni diverse. */
  function fissaPosizioni(res) {
    var quante = 0;
    (res.nodi || []).forEach(function (n) {
      if (!G.fissato(n) || !res.pos[n.id]) return;
      res.pos[n.id].x = n.x;   // il `livello` resta quello che il motore ha
      res.pos[n.id].y = n.y;   // calcolato: dice il rango, non il posto
      quante++;
    });
    return quante;
  }

  /**
   * Chiude il lavoro del motore, nell'ordine che conta: posizioni fissate,
   * archi, riquadro.
   *
   * L'instradamento sta QUI e non dentro i motori proprio per l'ordine: gli
   * archi si tracciano sulle posizioni DEFINITIVE. Un motore che instradasse
   * per conto suo lascerebbe ogni arco attaccato a dov'era il nodo prima che
   * l'utente lo trascinasse, e `misura()` — che conta gli incroci sulla
   * geometria disegnata — direbbe il falso proprio sulle mappe sistemate a
   * mano, cioè quelle di cui ci si fida di più.
   *
   * Il riquadro contiene TUTTO — card e archi, filigrana compresa. Chi disegna
   * riceve un sistema già pronto, e il viewBox del PDF potrà essere lo stesso
   * dello schermo invece di una seconda misura che diverge.
   *
   * @param rotte [{campo, es, o, viaDi}] che cosa instradare e sotto che nome:
   *              `o` di suo è quello del layout (il percorso e gli anelli
   *              instradano con opzioni loro), `viaDi` sono i punti di
   *              passaggio (i fantasmi del DAG).
   */
  function finisci(res, rotte) {
    var o = res.opt;
    res.stats = res.stats || {};
    res.stats.fissate = fissaPosizioni(res);
    (rotte || []).forEach(function (r) {
      res[r.campo] = instrada(res.pos, r.es, r.o || o, r.viaDi);
    });
    var ids = Object.keys(res.pos);
    if (!ids.length) { res.bbox = { minX: 0, minY: 0, maxX: 10, maxY: 10, w: 10, h: 10 }; return res; }
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    ids.forEach(function (k) {
      var p = res.pos[k];
      minX = Math.min(minX, p.x - o.w / 2); maxX = Math.max(maxX, p.x + o.w / 2);
      minY = Math.min(minY, p.y - o.h / 2); maxY = Math.max(maxY, p.y + o.h / 2);
    });
    (res.archi || []).concat(res.extra || []).forEach(function (a) {
      a.punti.forEach(function (p) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      });
    });
    res.bbox = { minX: minX, minY: minY, maxX: maxX, maxY: maxY, w: maxX - minX, h: maxY - minY };
    return res;
  }

  /* ------------------------------------------------------------------ misura */

  function segIncrocio(a, b, c, d) {
    function cr(p, q, r) { return (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x); }
    var d1 = cr(c, d, a), d2 = cr(c, d, b), d3 = cr(a, b, c), d4 = cr(a, b, d);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  }

  /**
   * Qualità del disegno, misurata sulla geometria vera — non stimata.
   * Un layout non si giudica a occhio: `incroci` e `archiSuCard` sono i due
   * numeri che dicono se una mappa si legge, e stanno sotto agli occhi mentre
   * si girano le leve. Sono anche la rete dei test: «la lezione demo non supera
   * N incroci» è una regressione che nessun ritocco estetico può nascondere.
   */
  function misura(res) {
    var o = res.opt;
    var segs = [];
    (res.archi || []).forEach(function (a, i) {
      for (var k = 0; k < a.punti.length - 1; k++) segs.push({ a: a.punti[k], b: a.punti[k + 1], e: a.e, i: i });
    });
    var incroci = 0;
    for (var i = 0; i < segs.length; i++) {
      for (var j = i + 1; j < segs.length; j++) {
        var A = segs[i], B = segs[j];
        if (A.i === B.i) continue;
        // due archi che condividono un capo non si «incrociano»: si toccano
        if (A.e.da === B.e.da || A.e.a === B.e.a || A.e.da === B.e.a || A.e.a === B.e.da) continue;
        if (segIncrocio(A.a, A.b, B.a, B.b)) incroci++;
      }
    }
    var rett = Object.keys(res.pos).map(function (id) {
      var p = res.pos[id];
      return { id: id, x0: p.x - o.w / 2, x1: p.x + o.w / 2, y0: p.y - o.h / 2, y1: p.y + o.h / 2 };
    });
    var sovrapposte = 0;
    for (var a2 = 0; a2 < rett.length; a2++) {
      for (var b2 = a2 + 1; b2 < rett.length; b2++) {
        var r1c = rett[a2], r2 = rett[b2];
        if (r1c.x0 < r2.x1 && r2.x0 < r1c.x1 && r1c.y0 < r2.y1 && r2.y0 < r1c.y1) sovrapposte++;
      }
    }
    function dentro(p, r) { return p.x > r.x0 && p.x < r.x1 && p.y > r.y0 && p.y < r.y1; }
    var suCard = {};
    (res.archi || []).forEach(function (a, ai) {
      rett.forEach(function (r) {
        if (r.id === a.e.da || r.id === a.e.a) return;
        for (var k2 = 0; k2 < a.punti.length - 1; k2++) {
          var p = a.punti[k2], q = a.punti[k2 + 1];
          if (dentro(p, r) || dentro(q, r)) { suCard[ai + '␟' + r.id] = true; return; }
          var ang = [{ x: r.x0, y: r.y0 }, { x: r.x1, y: r.y0 }, { x: r.x1, y: r.y1 }, { x: r.x0, y: r.y1 }];
          for (var l = 0; l < 4; l++) {
            if (segIncrocio(p, q, ang[l], ang[(l + 1) % 4])) { suCard[ai + '␟' + r.id] = true; return; }
          }
        }
      });
    });
    return {
      nodi: rett.length, archi: (res.archi || []).length,
      incroci: incroci, cardSovrapposte: sovrapposte, archiSuCard: Object.keys(suCard).length,
      larghezza: Math.round(res.bbox.w), altezza: Math.round(res.bbox.h)
    };
  }

  /* ---------------------------------------------------------------- ingresso */

  var MOTORI = { albero: layoutAlbero, dag: layoutDag, percorso: layoutPercorso, anelli: layoutAnelli };

  function run(g, opt) {
    var o = opzioni(opt);
    var f = MOTORI[o.motore] || MOTORI.albero;
    return f(g || { nodi: [], archi: [] }, o);
  }

  return { DEFAULT: DEFAULT, MOTORI: Object.keys(MOTORI), run: run, misura: misura,
           opzioni: opzioni, metriche: metriche, instrada: instrada };
}));
