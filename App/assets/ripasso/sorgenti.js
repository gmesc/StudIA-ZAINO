/* ============================================================================
   ripasso/sorgenti.js — quali pezzi di un capitolo diventano carte
   ============================================================================
   ⚠️ PERCHÉ ESISTE. Questa regola decide tre cose insieme, e nessuna sopporta
   una seconda versione:

     · quali carte finiscono nella CODA di ripasso;
     · quali carte si CONTANO (P3.6: mai studiate / in attesa / da rivedere oggi);
     · quali carte risultano VIVE alla potatura — ed è la più pericolosa, perché
       una sorgente dimenticata lì fa cancellare le storie di quelle carte, in
       silenzio, al primo avvio del corso.

   Finché stava dentro `ripassoDomandeVive()`, nel mezzo del renderer, era anche
   l'unico pezzo del ripasso che nessuna prova di unità poteva toccare: si
   misurava solo dall'app viva. Qui è puro — niente DOM, niente `fs` — quindi
   `node test/ripasso.js` lo prova direttamente, e il giorno che il main dovrà
   contare le carte di un corso chiuso troverà la regola già pronta.

   ⚠️ Che cosa NON c'è qui: l'identità della carta (serve `crypto`, sta nel main)
   e da dove viene il capitolo (lezione, titoli, ambito): quelli li aggiunge chi
   chiama, perché li sa lui.

     node test/ripasso.js
   ============================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RipassoSorgenti = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function str(v) { return v == null ? '' : String(v); }

  /**
   * Le carte che un capitolo produce, nell'ordine in cui si studiano: prima il
   * quiz, poi il glossario.
   *
   * Ogni carta: `{ sorgente, domanda, risposta, spiegazione, tf }`.
   * ⚠️ `domanda` è ciò che entra nell'identità (`hash(capitolo + domanda)`):
   * per il quiz è l'affermazione, per il glossario è il TERMINE. Una
   * rigenerazione che riscrive la definizione conserva quindi la storia, come un
   * quiz a cui cambia il «perché» resta la stessa carta.
   *
   * ⚠️ `risposta` di una carta di glossario è HTML (il parser dei capitoli passa
   * `d` per `_mdInline`): porta corsivi e rimandi vivi, e chi la mostra non deve
   * escaparla. Quella di un quiz è testo nudo.
   */
  function daCapitolo(cap) {
    const c = cap || {};
    const out = [];
    (c.quiz || []).forEach(function (q) {
      const domanda = str(q && q.q).trim();
      if (!domanda) return;
      const opzioni = (q.type === 'tf') ? ['Vero', 'Falso'] : ((q && q.options) || []);
      const giusta = (q.type === 'tf') ? (q.answer ? 0 : 1) : (q && q.answer);
      out.push({
        sorgente: 'quiz',
        domanda: domanda,
        tf: q.type === 'tf',
        risposta: str(opzioni[giusta] != null ? opzioni[giusta] : ''),
        spiegazione: str(q && q.explain)
      });
    });
    (c.glossary || c.glossario || []).forEach(function (g) {
      const t = str(g && g.t).trim();
      if (!t) return;
      out.push({
        sorgente: 'glossario',
        domanda: t,
        tf: false,
        risposta: str(g && g.d),
        spiegazione: ''
      });
    });
    return out;
  }

  /** Le coppie `{capitolo, domanda}` di un capitolo: è la forma che vogliono
   *  l'identità (nel main) e la potatura. */
  function chiaviDi(capitoloId, cap) {
    return daCapitolo(cap).map(function (k) {
      return { capitolo: str(capitoloId), domanda: k.domanda };
    });
  }

  return { daCapitolo: daCapitolo, chiaviDi: chiaviDi };
}));
