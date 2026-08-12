/* ============================================================================
   ripasso/intervalli.js — quando rivedere una carta (P3.3, SM-2 semplificato)
   ============================================================================
   ⚠️ PERCHÉ È UN MODULO E NON UN PEZZO DI `lib/ripasso.js`. Questa formula serve
   in due posti: il MAIN la usa per scrivere `prossimo` su disco a ogni risposta,
   il RENDERER per stampare i tempi previsti sopra i quattro bottoni («1 min ·
   10 min · 1 giorno · 4 giorni»). Scriverla due volte vorrebbe dire che il
   bottone promette un tempo e il disco ne registra un altro — un errore che non
   si vede finché qualcuno non confronta, cioè mai. Qui è un file solo: `<script
   src>` nel browser, `require()` in Node, come `lettura/identita.js`.

   ⚠️ E NON entra qui l'identità della carta, che resta nel main: quella ha
   bisogno di `crypto`, che nel renderer non c'è. Questo file è pura aritmetica —
   nessun `fs`, nessun `crypto`, nessun DOM.

   ⚠️ LA SECONDA SCELTA CHE CONTA: il fattore di facilità e il numero di
   ripetizioni **non si scrivono sul disco**. Si ricalcolano ogni volta
   ripercorrendo la `storia`, che è l'unico dato vero. Un contatore salvato
   accanto alla storia è un secondo posto dove sta la stessa cosa, e i due
   divergono la prima volta che qualcuno ne scrive uno senza l'altro. Costo:
   venti passaggi di aritmetica per carta, cioè niente. Guadagno: cambiare la
   formula domani ricalcola anche il passato, invece di lasciare metà archivio
   coi numeri della formula vecchia.

   L'algoritmo, dichiarato per intero perché nessuno debba dedurlo dal codice:

     qualità:  di-nuovo 0 · difficile 3 · buono 4 · facile 5
     facilità: parte da 2,5; ef += 0,1 − (5−q)·(0,08 + (5−q)·0,02); fra 1,3 e 2,7
     «di nuovo» azzera le ripetizioni e rimanda la carta fra un minuto
     le prime due volte gli intervalli sono una TABELLA (`GRADINI`), non una
       formula: una carta appena vista non ha una storia da cui dedurre nulla
     dalla terza in poi: nuovo = vecchio × ef  (difficile ×1,2 · facile × ef ×1,3)
     tetto a un anno: un intervallo di dieci anni è indistinguibile da «mai più»

   Perché SM-2 e non FSRS: FSRS stima diciassette parametri su migliaia di
   ripetizioni. Qui le carte sono centinaia e la storia comincia oggi — la
   sofisticazione non avrebbe dati da cui imparare, e costerebbe un modello da
   mantenere in cambio di niente.

     node test/ripasso.js
   ============================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RipassoIntervalli = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MINUTO = 1, ORA = 60, GIORNO = 1440, ANNO = 365 * GIORNO;
  /** I quattro esiti, nell'ordine in cui si mostrano sui bottoni. */
  const ESITI = ['di-nuovo', 'difficile', 'buono', 'facile'];
  const QUALITA = { 'di-nuovo': 0, difficile: 3, buono: 4, facile: 5 };
  /** I due gradini prima che una carta sia «matura». ⚠️ Tabella e non formula:
   *  alla prima risposta la storia non dice ancora niente da cui dedurre. */
  const GRADINI = [
    { difficile: 5 * MINUTO, buono: 10 * MINUTO, facile: 1 * GIORNO },
    { difficile: 10 * MINUTO, buono: 1 * GIORNO, facile: 4 * GIORNO }
  ];

  function str(v) { return v == null ? '' : String(v); }

  /** Un passo dell'algoritmo: da `{ef, n, minuti}` allo stato dopo `esito`. */
  function passo(st, esito) {
    const e = str(esito);
    const q = QUALITA[e];
    if (q == null) return st;                    // un esito che non conosciamo non muove niente
    const d = 5 - q;
    let ef = st.ef + (0.1 - d * (0.08 + d * 0.02));
    if (ef < 1.3) ef = 1.3;
    if (ef > 2.7) ef = 2.7;
    if (q < 3) return { ef: ef, n: 0, minuti: 1 * MINUTO };
    const n = st.n + 1;
    let minuti;
    if (st.n < GRADINI.length) minuti = GRADINI[st.n][e];
    else if (e === 'difficile') minuti = st.minuti * 1.2;
    else if (e === 'facile') minuti = st.minuti * ef * 1.3;
    else minuti = st.minuti * ef;
    minuti = Math.round(Math.min(minuti, ANNO));
    /* Oltre il giorno si arrotonda al giorno: «13 giorni e 7 ore» è una
       precisione che nessuno percepisce, e fa ballare l'etichetta sul bottone. */
    if (minuti >= GIORNO) minuti = Math.round(minuti / GIORNO) * GIORNO;
    return { ef: ef, n: n, minuti: minuti };
  }

  /** Lo stato dell'algoritmo dopo una storia intera. Le risposte senza esito
   *  riconosciuto si saltano: una voce storta non deve spostare i tempi. */
  function motore(storia) {
    let st = { ef: 2.5, n: 0, minuti: 0 };
    (Array.isArray(storia) ? storia : []).forEach(function (p) { st = passo(st, p && p.esito); });
    return st;
  }

  /**
   * ⭐ Quanto aspettare prima di rivedere questa carta, se adesso rispondo
   * `esito`: `{ minuti, testo, ef, ripetizioni }`. `testo` è già l'etichetta da
   * scrivere sopra il bottone, perché la stessa cifra formattata in due posti
   * diversi è due cifre diverse il giorno che si cambia il formato.
   */
  function prossimoIntervallo(storia, esito) {
    const st = passo(motore(storia), esito);
    return { minuti: st.minuti, testo: formattaIntervallo(st.minuti), ef: st.ef, ripetizioni: st.n };
  }

  /** Il momento in cui rivederla, in ISO. `da` per le prove; altrimenti adesso. */
  function prossimaData(storia, esito, da) {
    const iv = prossimoIntervallo(storia, esito);
    const base = da ? new Date(da) : new Date();
    if (isNaN(base.getTime())) return '';
    return new Date(base.getTime() + iv.minuti * 60000).toISOString();
  }

  /**
   * I quattro bottoni del ripasso, coi tempi previsti sopra — nell'ordine in cui
   * si mostrano. Sta qui e non nel renderer perché l'ordine e i tempi sono parte
   * dell'algoritmo: chi disegna la vista non deve poterli scegliere.
   */
  function anteprima(storia) {
    return ESITI.map(function (e) {
      const iv = prossimoIntervallo(storia, e);
      return { esito: e, minuti: iv.minuti, testo: iv.testo };
    });
  }

  /** «1 min» · «2 h» · «13 giorni» · «5 mesi» · «1 anno». Corto: sta su un bottone. */
  function formattaIntervallo(minuti) {
    const m = Math.max(0, Math.round(Number(minuti) || 0));
    if (m < ORA) return m + ' min';
    if (m < GIORNO) return Math.round(m / ORA) + ' h';
    const g = Math.round(m / GIORNO);
    if (g < 30) return g + (g === 1 ? ' giorno' : ' giorni');
    if (g < 365) { const me = Math.round(g / 30); return me + (me === 1 ? ' mese' : ' mesi'); }
    const a = Math.round(g / 365);
    return a + (a === 1 ? ' anno' : ' anni');
  }

  /**
   * La carta è dovuta adesso?
   *
   * ⚠️ Una voce senza `prossimo` è dovuta. Sono le carte risposte prima di P3.3,
   * quando il campo esisteva vuoto: metterle in fondo alla coda vorrebbe dire
   * non riproporle mai, e la storia che l'utente ha già pagato varrebbe zero.
   */
  function dovuta(voce, ora) {
    if (!voce || !voce.esito) return true;
    const p = str(voce.prossimo);
    if (!p) return true;
    const t = new Date(p).getTime();
    if (isNaN(t)) return true;
    return t <= new Date(ora || Date.now()).getTime();
  }

  /** Le carte da rivedere adesso, la più scaduta per prima. Chi non ha
   *  `prossimo` passa davanti: è arretrato, non futuro. */
  function coda(carte, ora) {
    function quando(v) {
      const t = str(v.prossimo) ? new Date(v.prossimo).getTime() : NaN;
      return isNaN(t) ? -Infinity : t;
    }
    return Object.keys(carte || {}).map(function (k) { return carte[k]; })
      .filter(function (v) { return v && dovuta(v, ora); })
      .sort(function (a, b) { return quando(a) - quando(b); });
  }

  return {
    ESITI: ESITI, GRADINI: GRADINI, MINUTO: MINUTO, ORA: ORA, GIORNO: GIORNO,
    prossimoIntervallo: prossimoIntervallo, prossimaData: prossimaData,
    anteprima: anteprima, formattaIntervallo: formattaIntervallo,
    dovuta: dovuta, coda: coda
  };
}));
