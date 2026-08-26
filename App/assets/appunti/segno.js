/* ============================================================================
   appunti/segno.js — a che riga si riapre un appunto
   ============================================================================
   Due domande sole, e sono quelle che si sbagliano:

     · **che cosa è una riga valida** (lo zero lo è, la stringa vuota no);
     · **dove si apre davvero** un appunto che nel frattempo si è ACCORCIATO.

   ⚠️ Perché un modulo UMD e non due funzioni in `lib/riga.js`. Servono a tutti
   e due i lati: il main le usa per scrivere il segno nel vault, il renderer per
   portarci il cursore. Una regola che vale per due lati nasce qui e la si
   richiama da `lib/` — due copie divergono, e il giorno che divergessero
   l'appunto si riaprirebbe in un punto e il file ne direbbe un altro
   (invariante 5).

   Niente DOM, niente `fs`: si prova in Node con `node test/riga.js`.
   ============================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AppuntiSegno = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function str(v) { return typeof v === 'string' ? v : (v == null ? '' : String(v)); }

  /**
   * Una riga è un intero ≥ 0.
   *
   * ⚠️ LO ZERO È UNA RIGA, a differenza della pagina di un documento, che
   * comincia da 1: la prima riga di un testo è la 0 in ogni editor, e trattarla
   * come «nessun segno» vorrebbe dire non poter più tornare in cima di
   * proposito. È la stessa distinzione già scritta per `_ascolto.json`, dove il
   * secondo zero esiste — «riportato all'inizio» è un fatto.
   *
   * ⚠️ E `null` quando non si è capito, che NON è «riga 0» — la distinzione
   * conta in LETTURA: chi legge il file scarta la voce storta invece di
   * trasformarla in un segno a riga 0. Un file toccato a mano che contiene
   * `riga: "sette"` non deve diventare un segno vero: sul disco resterebbe uno
   * zero che nessuno ha mai messo, indistinguibile da un «sono tornato in cima».
   */
  function rigaValida(r) {
    var n = Number(r);
    return (isFinite(n) && n >= 0 && str(r).trim() !== '') ? Math.trunc(n) : null;
  }

  /**
   * DOVE SI APRE DAVVERO, dato quanto è lungo l'appunto ADESSO.
   *
   * Fra il momento in cui il segno è stato scritto e quello in cui si riapre,
   * il testo può essere stato accorciato — da un altro computer, da Obsidian, o
   * da chi ha cancellato mezzo appunto ieri sera.
   *
   * ⚠️ Si STRINGE all'ultima riga vera invece di rifiutare: è la stessa regola
   * di `vaiAPagina`, che su un documento accorciato porta all'ultima pagina.
   * Rispondere «il segno non vale più» vorrebbe dire riaprire in cima proprio
   * l'appunto su cui si stava lavorando di più.
   */
  function dove(segnata, righeOra) {
    var r = rigaValida(segnata);
    var n = Number(righeOra);
    if (!isFinite(n) || n <= 0) return 0;      // un appunto vuoto ha la sola riga 0
    if (r === null) return 0;                  // nessun segno: dove si aprirebbe da solo
    return Math.min(r, Math.trunc(n) - 1);
  }

  return { rigaValida: rigaValida, dove: dove };
}));
