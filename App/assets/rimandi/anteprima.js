/* ============================================================================
   rimandi/anteprima.js — che cosa c'è dall'altra parte di un rimando
   ============================================================================
   «Hover = anteprima; click = torni lì» è il principio fondante di
   `PIANO-BRAYNR.md` §0, e nello zaino non c'era: rileggere un appunto pieno di
   rimandi costava un salto per ciascuno, e **ogni salto butta via il filo**.
   Per chi legge con una dislessia è il costo più alto, e chi rilegge appunti
   vecchi verifica la fonte dieci volte al minuto.

   Questo file risponde a una domanda sola: **dato un rimando già letto e i dati
   grezzi che il renderer ha in mano, che cosa si mostra nella bolla.** Torna una
   struttura; il DOM lo costruisce chi chiama.

   ⚠️ NON INTERPRETA I RIMANDI. La lettura è di `rimandi/sintassi.js`
   (`leggi`), che è la porta unica: qui si riceve il risultato. Se questo file
   cominciasse a riconoscere `pdf:` da sé sarebbe il secondo lettore che
   l'invariante 7 vieta — e il giorno che le due letture divergessero, la bolla
   mostrerebbe una cosa e il click ne aprirebbe un'altra.

   ⚠️ E NON VA A PRENDERE NIENTE: i dati si fanno PASSARE. È la regola di
   `suMac(nav)` in `tasti/nomi.js` — il modulo si fa dare quello che non può
   leggere. Qui vuol dire che l'anteprima è provabile in Node senza vault,
   senza indici caricati e senza DOM.
   ============================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RimandiAnteprima = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function str(v) { return typeof v === 'string' ? v : (v == null ? '' : String(v)); }

  /** Il tempo scritto come lo scrive il player: `m:ss`, e `h:mm:ss` quando
   *  l'ora c'è. ⚠️ Una copia dichiarata di `Lettore.tempo`, e piccola: questo
   *  modulo gira anche dove il player non è caricato (la stampa, Node), e
   *  chiedergli una dipendenza per otto righe sarebbe peggio. Se le due forme
   *  divergessero se ne accorgerebbe `test/anteprima.js`, che le confronta. */
  function tempo(sec) {
    var s = Math.max(0, Math.floor(Number(sec) || 0));
    var h = Math.floor(s / 3600); s -= h * 3600;
    var m = Math.floor(s / 60); s -= m * 60;
    var due = function (n) { return n < 10 ? '0' + n : String(n); };
    return h ? (h + ':' + due(m) + ':' + due(s)) : (m + ':' + due(s));
  }

  /**
   * Le tre-quattro righe attorno a un punto del testo.
   *
   * ⚠️ Si taglia sui CONFINI DI PAROLA, non a metà: un'anteprima che comincia
   * con «…zione della memoria» fa perdere tempo invece di darne, e chi legge
   * deve capire in un colpo d'occhio se è il punto giusto.
   */
  function attorno(testo, quanti) {
    var t = str(testo).replace(/\s+/g, ' ').trim();
    var max = quanti || 240;
    if (t.length <= max) return t;
    var taglio = t.slice(0, max);
    var sp = taglio.lastIndexOf(' ');
    return (sp > max * 0.6 ? taglio.slice(0, sp) : taglio) + '…';
  }

  /**
   * Il contenuto della bolla.
   *
   * `rim` è quello che ha letto `RimandiSintassi.leggi`. `dati` è quello che il
   * renderer ha già in mano, e ogni campo è FACOLTATIVO: quando manca, la bolla
   * dice quello che sa invece di non comparire.
   *
   *   dati.titoloMateriale(numeroOfile) → il titolo leggibile, o ''
   *   dati.testoPagina(numero, pagina)  → il testo di quella pagina, o ''
   *   dati.evidenza(id)   → { exact, prefix, suffix, colore, nota }, o null
   *   dati.immagine(id)   → { didascalia, src }, o null
   *   dati.capitolo(id)   → { titolo, lezione }, o null
   *
   * Torna `{ tipo, titolo, dove, testo, colore, immagine, nota, vuoto }`, dove
   * `vuoto` dice che non si è potuto sapere niente — e allora chi chiama NON
   * apre la bolla: una bolla che si apre per dire «non lo so» è peggio di
   * nessuna bolla, perché ruba il testo sotto senza dare niente in cambio.
   */
  function contenuto(rim, dati) {
    var d = dati || {};
    if (!rim || !rim.tipo) return { tipo: '', vuoto: true };

    function chiedi(fn, a, b) {
      if (typeof fn !== 'function') return null;
      try { return fn(a, b); } catch (e) { return null; }
    }

    if (rim.tipo === 'pdf') {
      var tit = str(chiedi(d.titoloMateriale, rim.numero)) || ('Documento ' + str(rim.numero));
      var testo = attorno(str(chiedi(d.testoPagina, rim.numero, rim.pagina)));
      return { tipo: 'pdf', titolo: tit, dove: 'p. ' + rim.pagina, testo: testo,
        vuoto: false };
    }

    if (rim.tipo === 'video') {
      var tv = str(chiedi(d.titoloMateriale, rim.numero)) || ('Media ' + str(rim.numero));
      /* ⚠️ Su un media non c'è testo da mostrare: la bolla dice il titolo e il
         MINUTO, che è l'unica cosa che chi passa sopra vuole sapere — «dove mi
         porta». Fingere un'anteprima del contenuto vorrebbe dire trascrivere,
         e qui non si trascrive niente. */
      return { tipo: 'video', titolo: tv, dove: tempo(rim.t), testo: '', vuoto: false };
    }

    if (rim.tipo === 'ev') {
      var e = chiedi(d.evidenza, rim.id);
      if (!e) return { tipo: 'ev', vuoto: true };
      /* La frase COL SUO CONTORNO: `prefix` e `suffix` sono lì apposta — sono
         ciò che distingue «la memoria» ripetuta in tre punti diversi. */
      return { tipo: 'ev', titolo: '', dove: '',
        prefix: str(e.prefix), esatto: str(e.exact), suffix: str(e.suffix),
        colore: str(e.colore), nota: str(e.nota),
        testo: (str(e.prefix) + str(e.exact) + str(e.suffix)).trim(),
        vuoto: !str(e.exact) };
    }

    if (rim.tipo === 'album') {
      var im = chiedi(d.immagine, rim.id);
      if (!im) return { tipo: 'album', vuoto: true };
      return { tipo: 'album', titolo: str(im.didascalia), dove: '', testo: '',
        immagine: str(im.src), vuoto: !str(im.src) && !str(im.didascalia) };
    }

    if (rim.tipo === 'cap') {
      var c = chiedi(d.capitolo, rim.capitoloId);
      if (!c) return { tipo: 'cap', vuoto: true };
      return { tipo: 'cap', titolo: str(c.titolo), dove: str(c.lezione), testo: '',
        vuoto: !str(c.titolo) };
    }

    /* ⚠️ `fig:` e `esterno` NON hanno anteprima, ed è una scelta: una figura è
       già un'immagine a schermo — mostrarne una copia in una bolla non aggiunge
       niente — e per un link esterno l'unica anteprima onesta sarebbe andare a
       prendere la pagina, cioè una richiesta di rete che nessuno ha chiesto. */
    return { tipo: str(rim.tipo), vuoto: true };
  }

  return { contenuto: contenuto, attorno: attorno, tempo: tempo };
}));
