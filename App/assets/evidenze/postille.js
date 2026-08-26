/* ============================================================================
   evidenze/postille.js — quali postille si mostrano, e in che ordine
   ============================================================================
   La POSTILLA è il corpo di un'annotazione: il perché di una sottolineatura,
   scritto in una riga (`nota` in `APPUNTI/_evidenze.json`). Questo file
   risponde a una domanda sola: **date tutte le evidenze di un contenitore,
   quali hanno una postilla e come si presentano in elenco.**

   ⚠️ Perché un modulo e non tre righe nel renderer. Il pannello è una vista, e
   la parte che si sbaglia non è disegnarla: è decidere che cosa entra
   nell'elenco (una postilla di soli spazi?), come si raggruppa — per documento,
   per capitolo, e chi non ha né l'uno né l'altro — e in che ordine, con le
   pagine che sono numeri e i titoli che sono stringhe. Tutto ciò si prova in
   Node, senza aprire l'app.

   ⚠️ NON SI DECIDE QUI CHE COSA SIA VISIBILE. Quali evidenze siano accese lo
   dice `evidenze/strati.js`, e questo file riceve già l'elenco che deve
   mostrare: due giudici sulla stessa domanda divergono al primo cambiamento.
   ============================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EvidenzePostille = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function str(v) { return typeof v === 'string' ? v : (v == null ? '' : String(v)); }

  /** La postilla di un'evidenza, ripulita — o `''`. Una riga sola, come la
   *  scrive `lib/evidenze.js`: qui ci si difende dai file toccati a mano. */
  function nota(e) { return str(e && e.nota).replace(/\s+/g, ' ').trim(); }

  /** Ha una postilla? È il filtro dell'elenco, e sta in un posto solo. */
  function haPostilla(e) { return !!nota(e); }

  /**
   * Dove sta un'evidenza, come CHIAVE di raggruppamento — non come etichetta.
   *
   * ⚠️ La chiave è il dato grezzo (`materiale`, o `capitoloId`), non il titolo
   * leggibile: due capitoli possono chiamarsi uguale, e due documenti pure se
   * uno è stato rinominato. Il titolo lo mette il renderer, che sa tradurre un
   * nome di file nel suo titolo; qui si raggruppa su ciò che non cambia.
   */
  function chiaveDove(e) {
    var m = str(e && e.materiale);
    if (m) return 'pdf ' + m;
    var c = str(e && e.capitoloId);
    if (c) return 'cap ' + c;
    return 'altro';
  }

  /** La pagina come NUMERO, o `null`: serve a ordinare, e «10» prima di «9» è
   *  l'ordinamento di chi confronta stringhe. */
  function pagina(e) {
    var n = Number(e && e.pagina);
    return (isFinite(n) && str(e && e.pagina) !== '') ? Math.trunc(n) : null;
  }

  /**
   * Le postille, raggruppate per dove stanno.
   *
   * `opz.materialeAperto` mette **in cima** il gruppo del documento che si sta
   * leggendo: chi apre questo pannello mentre legge cerca quasi sempre le
   * postille di QUELLA pagina, e farlo scorrere fino a trovarle sarebbe
   * chiedergli di cercare due volte. Gli altri gruppi restano, sotto: un elenco
   * che nasconde il resto fa credere che il resto non ci sia.
   *
   * Torna `[{ chiave, materiale, capitoloId, capitolo, voci }]`, con le voci
   * ordinate per pagina e, a parità, per il testo segnato.
   */
  function gruppi(evidenze, opz) {
    var o = opz || {};
    var aperto = str(o.materialeAperto);
    var per = {};
    var ordine = [];
    var lista = Array.isArray(evidenze) ? evidenze : [];
    for (var i = 0; i < lista.length; i++) {
      var e = lista[i];
      if (!haPostilla(e)) continue;
      var k = chiaveDove(e);
      if (!per[k]) {
        per[k] = { chiave: k, materiale: str(e.materiale), capitoloId: str(e.capitoloId),
          capitolo: str(e.capitolo), voci: [] };
        ordine.push(k);
      }
      per[k].voci.push(e);
    }
    var out = ordine.map(function (k) { return per[k]; });
    out.forEach(function (g) {
      g.voci.sort(function (a, b) {
        var pa = pagina(a), pb = pagina(b);
        if (pa !== pb) {
          if (pa === null) return 1;          // chi non ha pagina va in fondo
          if (pb === null) return -1;
          return pa - pb;
        }
        return str(a.exact).localeCompare(str(b.exact), 'it');
      });
    });
    /* L'ordine dei gruppi: il documento aperto per primo, poi gli altri
       documenti, poi i capitoli, e in fondo chi non è né l'uno né l'altro.
       ⚠️ `numeric: true`: senza, «10 dispensa» viene prima di «9 dispensa»,
       che è l'ordine di nessuno. */
    function rango(g) {
      if (aperto && g.materiale === aperto) return 0;
      if (g.materiale) return 1;
      if (g.capitoloId) return 2;
      return 3;
    }
    out.sort(function (a, b) {
      var ra = rango(a), rb = rango(b);
      if (ra !== rb) return ra - rb;
      var na = a.materiale || a.capitolo || '';
      var nb = b.materiale || b.capitolo || '';
      return na.localeCompare(nb, 'it', { numeric: true });
    });
    return out;
  }

  /** Quante postille ci sono in tutto: il numero che la barra mostra, contato
   *  dalla stessa legge che riempie l'elenco — un conto calcolato a parte
   *  diverge dal suo elenco al primo caso limite. */
  function quante(evidenze) {
    return (Array.isArray(evidenze) ? evidenze : []).filter(haPostilla).length;
  }

  return { nota: nota, haPostilla: haPostilla, chiaveDove: chiaveDove, pagina: pagina,
    gruppi: gruppi, quante: quante };
}));
