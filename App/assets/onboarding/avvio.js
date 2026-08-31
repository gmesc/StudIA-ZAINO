/* ============================================================================
   onboarding/avvio.js — da quale metà dell'app si comincia, e che cosa si chiede
   ============================================================================
   Due decisioni sole, e sono decisioni: perciò stanno qui, in un modulo puro che
   `node test/onboarding-avvio.js` prova senza vault, senza DOM e senza Electron.

   ⚠️ IL PERCHÉ, CHE È IL PUNTO. Fino al 31 agosto 2026 l'app apriva sempre nei
   CORSI, e il primo avvio chiedeva subito un motore AI, una chiave API e Python.
   Sono i requisiti della PIPELINE, non dell'app: chi vuole solo aprire un PDF,
   evidenziarlo e prenderci appunti — cioè lo ZAINO, che di Python non sa che
   farsene perché l'OCR è `tesseract.js` in-process — si trovava davanti tre
   schermate tecniche prima di vedere una riga di testo. Un requisito chiesto
   prima del bisogno è attrito puro: non aiuta chi lo capisce e ferma chi no.

   Le due domande, separate apposta:
     `modoIniziale`      da dove si parte
     `passiPrimoAvvio`   che cosa si chiede prima di cominciare

   ⚠️ Nessuna delle due «nasconde» la pipeline: `passiPrimoAvvio` in modalità
   CORSO restituisce esattamente i pannelli di sempre. Cambia QUANDO li si
   propone — alla soglia dei Corsi invece che all'ingresso dell'app.
   ============================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OnboardingAvvio = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function quanti(v) { return Array.isArray(v) ? v.length : (Number(v) > 0 ? Number(v) : 0); }

  /**
   * In quale modalità aprire l'app.
   *
   * L'ordine delle domande è l'ordine di ciò che si sa dell'utente:
   *
   *  1. **la modalità di ieri vince su tutto.** È una scelta già fatta, e
   *     ignorarla per una regola nostra sarebbe spostargli l'app sotto i piedi.
   *  2. **un vault che ha già dei CORSI apre nei corsi**, anche la primissima
   *     volta: chi apre un vault esistente — o lo porta su un computer nuovo —
   *     si aspetta il suo lavoro, non la metà vuota.
   *  3. **altrimenti si comincia dallo ZAINO**: è la metà che funziona senza
   *     motore AI, senza chiavi e senza Python, cioè l'unica in cui un utente
   *     nuovo può fare qualcosa nei primi due minuti.
   *
   * ⚠️ «Ieri» si legge dal `localStorage` e i corsi dal disco: due fonti diverse
   * apposta. La modalità è una preferenza di vista, i corsi sono un fatto —
   * scrivere la preferenza nel vault la farebbe viaggiare fra computer che
   * hanno schermi e abitudini diverse, e leggere i corsi dal `localStorage`
   * direbbe che ci sono corsi quando la cartella è stata svuotata.
   */
  function modoIniziale(o) {
    var s = o || {};
    var salvato = s.salvato === 'zaino' || s.salvato === 'corso' ? s.salvato : null;
    if (salvato) return salvato;
    if (quanti(s.corsi) > 0) return 'corso';
    return 'zaino';
  }

  /**
   * I pannelli del primo avvio, per la modalità da cui si comincia.
   *
   * In CORSO sono quelli di sempre — motore e Python — più lo spazio se scarso.
   * In ZAINO **non ce n'è nessuno**: né motore né Python servono, e per il solo
   * spazio libero non si apre un dialogo modale. Chi chiama, trovando la lista
   * vuota, non deve mostrare la card affatto.
   *
   * ⚠️ Una card con un pannello solo NON è la risposta giusta al «togliamo
   * l'attrito»: è lo stesso muro, più basso. Lo spazio scarso si dice con un
   * avviso di passaggio, che non chiede di premere niente per continuare.
   */
  function passiPrimoAvvio(o) {
    var s = o || {};
    var modo = s.modo === 'zaino' ? 'zaino' : 'corso';
    var avvisi = (s.consiglio && Array.isArray(s.consiglio.avvisi)) ? s.consiglio.avvisi : [];
    var spazioScarso = avvisi.some(function (a) { return a && /spazio/.test(String(a.id || '')); });
    if (modo === 'zaino') return { pannelli: [], toastSpazio: spazioScarso };
    var p = ['motore', 'python'];
    if (spazioScarso) p.push('spazio');
    return { pannelli: p, toastSpazio: false };
  }

  /**
   * Alla soglia dei CORSI, c'è qualcosa da chiedere?
   *
   * ⚠️ Sì SOLO se manca qualcosa. La card del primo avvio ha senso anche quando
   * va tutto bene — è una presentazione, dice che cosa userà l'app e come — ma
   * alla soglia no: chi passa ai corsi sta andando a fare una cosa, e una
   * finestra che gli dice «tutto a posto» è una porta da aprire per niente. Se
   * motore e Python ci sono, si segna che la domanda è stata fatta e non si
   * disturba nessuno.
   *
   * ⚠️ Lo SPAZIO non conta qui: è un avviso, non un requisito. Su un disco
   * quasi pieno si generano lezioni lo stesso, si scarica un modello in meno.
   */
  function serveSoglia(consiglio) {
    var avvisi = (consiglio && Array.isArray(consiglio.avvisi)) ? consiglio.avvisi : [];
    return avvisi.some(function (a) {
      var id = String((a && a.id) || '');
      return id === 'motore-assente' || id.indexOf('python') === 0;
    });
  }

  return { modoIniziale: modoIniziale, passiPrimoAvvio: passiPrimoAvvio, serveSoglia: serveSoglia };
}));
