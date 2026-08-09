/* =========================================================================
   genera — la VISTA GENERATA: la mappa ricavata dai file del corso.

   Deterministica: nessuna chiamata al modello, nessun costo, nessuna attesa.
   Legge ciò che il capitolo dichiara già — titoli di sezione, punti chiave,
   glossario, e i rimandi alle fonti che il testo contiene — e ne fa un grafo.

   Per questo la vista generata NON si salva su disco: è una proiezione del
   testo, e il testo è la verità. Rigeneri il capitolo e la mappa lo segue da
   sé; salvarla creerebbe una seconda versione destinata a divergere in
   silenzio. Chi vuole una mappa propria ne fa una copia, che diventa un
   artefatto suo in MAPPE/ e nessuna pipeline tocca più.

   Ogni nodo che nasce da una porzione di testo porta con sé il RIMANDO che
   quella porzione cita: il click riapre il PDF alla pagina o il video al
   minuto, riusando `openNote` del lettore — nessun secondo meccanismo.

   Modulo PURO, UMD (vedi relazioni.js). Lavora sui capitoli GIÀ PARSATI dal
   lettore (`mdChapter`), non sul markdown: il parser resta uno solo.
   ========================================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MappaGenera = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ENTITA = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ', '&hellip;': '…' };

  /** Da HTML a testo leggibile. Il lettore ci consegna HTML (i capitoli sono
   *  già resi); le etichette dei nodi vogliono il testo nudo. */
  function testo(html) {
    return String(html == null ? '' : html)
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]*>/g, '')
      .replace(/&[a-z#0-9]+;/gi, function (m) { return ENTITA[m] != null ? ENTITA[m] : m; })
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** I rimandi contenuti in una porzione di HTML, nell'ordine in cui compaiono.
   *  La forma è quella che `openNote` del lettore già sa aprire: non si inventa
   *  un secondo formato per dire la stessa cosa. */
  function rimandi(html) {
    var out = [], re = /<a\b[^>]*class="(vlink|plink)"[^>]*>/gi, m;
    var s = String(html == null ? '' : html);
    while ((m = re.exec(s))) {
      var tag = m[0];
      function attr(n) { var a = new RegExp(n + '="([^"]*)"').exec(tag); return a ? a[1] : ''; }
      var file = testo(attr('data-file'));
      if (!file) continue;
      if (m[1] === 'vlink') out.push({ type: 'video', file: file, t: parseInt(attr('data-t'), 10) || 0, label: testo(attr('data-label')) });
      else out.push({ type: 'pdf', file: file, page: parseInt(attr('data-page'), 10) || 1, label: testo(attr('data-label')) });
    }
    return out;
  }

  /** Spezza il corpo del capitolo nelle sue sezioni, seguendo i titoli.
   *  I livelli sono RELATIVI: `#` nel markdown esce come <h3>, ma qui conta
   *  solo che un h4 stia sotto l'h3 che lo precede. */
  function sezioni(html) {
    var s = String(html == null ? '' : html);
    var re = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, m, tappe = [];
    while ((m = re.exec(s))) tappe.push({ liv: +m[1], titolo: testo(m[2]), da: m.index, a: m.index + m[0].length });
    var out = [];
    if (!tappe.length) return out;
    var minLiv = Math.min.apply(null, tappe.map(function (t) { return t.liv; }));
    tappe.forEach(function (t, i) {
      var fine = i + 1 < tappe.length ? tappe[i + 1].da : s.length;
      out.push({ titolo: t.titolo, profondita: t.liv - minLiv, corpo: s.slice(t.a, fine) });
    });
    return out;
  }

  function taglia(s, n) {
    s = String(s || '');
    return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…';
  }

  /**
   * Mappa di UN capitolo.
   *   radice  = il titolo del capitolo
   *   rami    = i titoli di sezione (o, se non ce ne sono, i punti chiave)
   *   foglie  = i sotto-titoli, e i punti chiave sotto la sezione che li cita
   *   opzionali: un ramo «Glossario» con i termini definiti
   *
   * @param cap  capitolo già parsato dal lettore
   * @param opt  { glossario:bool, puntiChiave:bool, lezioneId, indice }
   */
  function daCapitolo(cap, opt) {
    opt = opt || {};
    var nodi = [], archi = [], n = 0;
    function nodo(testoN, extra) {
      var id = 'n' + (++n);
      var o = { id: id, testo: testoN };
      Object.keys(extra || {}).forEach(function (k) { if (extra[k] != null) o[k] = extra[k]; });
      nodi.push(o);
      return id;
    }
    function arco(da, a, rel) { archi.push({ da: da, a: a, rel: rel || '' }); }

    if (!cap) return { nodi: [], archi: [], titolo: '' };

    var radice = nodo(testo(cap.title), {
      genere: 'radice', origine: 'generata',
      rimando: rimandi(cap.brief || '')[0] || rimandi(cap.html || '')[0] || null,
      nota: testo(cap.brief).slice(0, 400) || null,
      capitolo: opt.indice != null ? opt.indice : null
    });

    var sez = sezioni(cap.html || '');
    var pila = [{ prof: -1, id: radice }];
    sez.forEach(function (s) {
      while (pila.length > 1 && pila[pila.length - 1].prof >= s.profondita) pila.pop();
      var padre = pila[pila.length - 1].id;
      var id = nodo(taglia(s.titolo, 90), {
        genere: 'sezione', origine: 'generata',
        rimando: rimandi(s.corpo)[0] || null,
        capitolo: opt.indice != null ? opt.indice : null
      });
      arco(padre, id, 'si articola in');
      pila.push({ prof: s.profondita, id: id });
    });

    var fonti = (opt.fonti || []).filter(function (f) { return f && f.label; });
    var conGlossario = !!opt.glossario && (cap.glossary || []).length > 0;
    /* Molti capitoli non hanno titoli di sezione: là i punti chiave SONO la
       mappa e vanno appesi alla radice, senza un raccoglitore che aggiunge un
       livello e non dice niente. Il raccoglitore serve solo quando alla radice
       arriva anche altro — le sezioni o il glossario — perché allora distingue
       due cose diverse invece di mescolarle. */
    var raggruppa = sez.length > 0 || conGlossario || fonti.length > 0;
    if (opt.puntiChiave !== false && (cap.keypoints || []).length) {
      var padreKp = radice;
      if (raggruppa) {
        padreKp = nodo('Punti chiave', { genere: 'raccolta', origine: 'generata' });
        arco(radice, padreKp, 'comprende');
      }
      (cap.keypoints || []).forEach(function (k) {
        var id = nodo(taglia(testo(k), 110), { genere: 'punto', origine: 'generata' });
        arco(padreKp, id, raggruppa ? '' : 'comprende');
      });
    }

    /* «Note e materiali»: i punti della fonte che il capitolo cita, con
       l'etichetta che l'autore ha dato loro. Non sono puntatori generici —
       misurato sul corpus TD74 sono frasi come «A1: il criterio della
       discrepanza rispetto al QI»: per i capitoli senza titoli di sezione
       (206 su 210) è la sola struttura argomentativa che i file contengano,
       ed è anche l'unico modo perché la mappa sia navigabile verso la fonte.
       Le etichette arrivano GIÀ RISOLTE da chi chiama (nel lettore è
       `chapterNotes`): qui non si ricostruisce il titolo di un materiale, che
       è logica di un altro modulo. */
    if (fonti.length) {
      var padreFo = nodo('Note e materiali', { genere: 'raccolta', origine: 'generata' });
      arco(radice, padreFo, 'comprende');
      fonti.forEach(function (f) {
        var id = nodo(taglia(testo(f.label), 90), { genere: 'fonte', origine: 'generata', rimando: f });
        arco(padreFo, id, '');
      });
    }

    if (conGlossario) {
      var padreGl = nodo('Glossario', { genere: 'raccolta', origine: 'generata' });
      arco(radice, padreGl, 'comprende');
      (cap.glossary || []).forEach(function (g) {
        // nessun verbo sull'arco: «Glossario» lo dice già, e cinque «definisce»
        // ripetuti sarebbero rumore su una mappa che si guarda a colpo d'occhio
        var id = nodo(taglia(testo(g.t), 60), { genere: 'termine', origine: 'generata', nota: testo(g.d).slice(0, 400) });
        arco(padreGl, id, '');
      });
    }

    return { nodi: nodi, archi: archi, titolo: testo(cap.title) };
  }

  /**
   * Mappa di UNA lezione: la panoramica prima del dettaglio.
   *   radice = la lezione · rami = i capitoli in ordine · foglie = le loro sezioni
   * Ogni nodo-capitolo porta l'indice del capitolo, così il click ci naviga.
   */
  function daLezione(lezione, opt) {
    opt = opt || {};
    var nodi = [], archi = [], n = 0;
    function nodo(testoN, extra) {
      var id = 'n' + (++n), o = { id: id, testo: testoN };
      Object.keys(extra || {}).forEach(function (k) { if (extra[k] != null) o[k] = extra[k]; });
      nodi.push(o); return id;
    }
    if (!lezione || !Array.isArray(lezione.chapters)) return { nodi: [], archi: [], titolo: '' };

    var radice = nodo(testo(lezione.title), { genere: 'radice', origine: 'generata' });
    var profMax = opt.profondita == null ? 1 : Math.max(0, +opt.profondita);

    lezione.chapters.forEach(function (cap, i) {
      var idCap = nodo(taglia(testo(cap.title), 90), {
        genere: 'capitolo', origine: 'generata', capitolo: i,
        nota: testo(cap.brief).slice(0, 400) || null,
        rimando: rimandi(cap.brief || '')[0] || rimandi(cap.html || '')[0] || null
      });
      archi.push({ da: radice, a: idCap, rel: 'si articola in' });
      if (profMax < 1) return;
      sezioni(cap.html || '').forEach(function (s) {
        if (s.profondita > profMax - 1) return;
        var id = nodo(taglia(s.titolo, 80), {
          genere: 'sezione', origine: 'generata', capitolo: i,
          rimando: rimandi(s.corpo)[0] || null
        });
        archi.push({ da: idCap, a: id, rel: '' });
      });
    });
    return { nodi: nodi, archi: archi, titolo: testo(lezione.title) };
  }

  return { testo: testo, rimandi: rimandi, sezioni: sezioni, taglia: taglia,
           daCapitolo: daCapitolo, daLezione: daLezione };
}));
