/* ============================================================================
   lettura/lezioni.js — da un NOME DI RIMANDO alla lezione da aprire
   ============================================================================
   Una lezione può avere varianti (`01-fondamenti` e `01-fondamenti--breve`), e
   un rimando scritto a mano nomina la BASE. Qui si decide quale cartella si
   apre davvero: la variante scelta nel percorso attivo se c'è, la base se no.

   ⚠️ Era un blocco marcato `@lezioni-puro-inizio` dentro `App/StudIA.html`,
   ritagliato a runtime per essere provato in Node. Stesso codice, adesso
   caricato invece che ritagliato.
   ============================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LetturaLezioni = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Base e variante di un nome di cartella. Gemella di `percorsi.scomponi` in
      lib/ — là è la stessa regola per chi scrive su disco. */
  function scomponiLezione(folder){
    var s=String(folder||''), i=s.indexOf('--');
    return i<0 ? {base:s, variante:''} : {base:s.slice(0,i), variante:s.slice(i+2)};
  }
  /**
   * Quale lezione aprire per un rimando `[[target]]`, o `null` se non c'è.
   *
   * ⚠️ Il target si normalizza SEMPRE alla base, anche quando nomina per esteso
   * una variante esistente. Sembra una perdita di precisione ed è il contrario:
   * un rimando che punta a `04-…--scaletta-a` mentre stai leggendo il percorso
   * «per domande» ti sposterebbe di percorso a metà corso, in silenzio. Il testo
   * dice QUALE LEZIONE; quale versione di quella lezione lo dice il percorso.
   *
   * @param ctx.lezioni  le lezioni caricate, per id (LESSONS)
   * @param ctx.meta     VAULT_META: da ogni id, `base` e `courseId`
   * @param ctx.scelte   base → cartella rivendicata dal percorso attivo
   * @param ctx.corso    il corso attivo: fuori di lì non si salta
   */
  /**
   * Fra più cartelle della STESSA lezione, quella che si guarda.
   *
   * ⚠️ Il ripiego quando il percorso non dice niente non è un lusso: `conCartelle`
   * ha scritto `cartella: null` dentro i percorsi salvati ogni volta che la cache
   * delle scalette non c'era, e senza questo ramo la lezione spariva dalla
   * tendina, dal lettore e dai rimandi — con i capitoli intatti sul disco. Il
   * percorso comanda; quando tace si sceglie comunque, e in modo DETERMINISTICO,
   * perché una lezione che cambia versione a ogni apertura è peggio di una che
   * non si apre: non si vede.
   */
  function preferitaFra(cand, base, scelte){
    if(!cand.length) return null;
    if(cand.length===1) return cand[0];
    var scelta=(scelte||{})[base];
    if(scelta && cand.indexOf(scelta)>=0) return scelta;
    /* La cartella base fra i candidati sono i capitoli scritti una lezione per
       volta, fuori dai percorsi: valgono più di una variante non rivendicata. */
    if(cand.indexOf(base)>=0) return base;
    return cand.slice().sort(function(a,b){ return a.localeCompare(b,'it'); })[0];
  }
  /**
   * Per ogni lezione, la cartella da mostrare: `base → cartella`.
   *
   * È la regola UNICA di «una lezione, una versione per volta». Ci passano il
   * rimando `[[…]]`, l'elenco della tendina e la ricerca — perché tre idee di
   * quale variante sia quella buona sono tre app diverse nella stessa finestra.
   */
  function cartelleScelte(ids, meta, scelte){
    var perBase={}, out={};
    (ids||[]).forEach(function(id){
      var m=(meta||{})[id], b=(m && m.base) || id;
      (perBase[b]=perBase[b]||[]).push(id);
    });
    Object.keys(perBase).forEach(function(b){ out[b]=preferitaFra(perBase[b], b, scelte); });
    return out;
  }
  function risolviLezione(target, ctx){
    var c=ctx||{}, lez=c.lezioni||{}, meta=c.meta||{};
    var base=scomponiLezione(String(target||'').split('|')[0].trim()).base;
    if(!base) return null;
    var cand=Object.keys(lez).filter(function(id){
      var m=meta[id];
      /* Senza meta è una lezione importata da JSON: non ha né corso né variante,
         e l'unico nome che ha è il suo id. */
      if(!m) return id===base;
      if(c.corso && m.courseId && m.courseId!==c.corso) return false;
      return m.base===base;
    });
    return preferitaFra(cand, base, c.scelte);
  }

  return {
    scomponiLezione: scomponiLezione,
    preferitaFra: preferitaFra,
    cartelleScelte: cartelleScelte,
    risolviLezione: risolviLezione
  };
}));
