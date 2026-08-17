/* ============================================================================
   evidenze/strati.js — quali segni si accendono, e quali restano spenti
   ============================================================================
   Un'evidenza è un segno sul testo. Questo file risponde a una domanda sola:
   **fra quelle che ci sono, quali si dipingono adesso.**

   Oggi la risposta dipende da un interruttore solo — le evidenze si vedono, o
   non si vedono. Domani dipenderà anche dallo STRATO in cui l'evidenza vive
   (`{ tutte:true, spenti:['metrica'] }`): due letture dello stesso testo, ognuna
   che si accende per conto suo. La forma dello stato è già quella, e questo è il
   motivo per cui esiste un file invece di un booleano nel renderer.

   ⚠️ QUI NON SI DECIDE CHE COSA APPARTIENE A CHE COSA. Quali evidenze siano di
   una pagina o di un capitolo lo dice `evidenzeDi(sup)` nel renderer, ed è un
   FATTO: non cambia perché uno guarda o non guarda. Questo file dice solo che
   cosa si vede — e la differenza non è filosofia, è un guasto evitato: se il
   filtro stesse dentro `evidenzeDi`, con i segni nascosti anche `evidenzaSotto`
   direbbe «qui non c'è niente», e ri-evidenziare una frase già segnata le
   cambierebbe il colore invece di riconoscerla. Nascondere deve cambiare come si
   VEDE, mai che cosa SUCCEDE.

   ⚠️ Lo stato è una PREFERENZA DI LETTURA, non un dato del vault: vive nel
   `localStorage` di questo computer, come il colore e il tratto correnti
   (`evidenzeTratto`). Nessun file dell'utente cambia perché ha spento i segni per
   rileggere una pagina. Se un giorno dovrà viaggiare col vault, è questo il file
   da cui si parte — e la decisione sta in PIANO-BRAYNR.

   Niente DOM, niente Electron: gira in Node e si prova con `node test/strati.js`.
   ============================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EvidenzeStrati = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Di fabbrica i segni si vedono: chi non ha mai toccato niente deve trovare
   *  l'app com'era il giorno prima. */
  function diFabbrica() { return { tutte: true }; }

  /**
   * Raddrizza uno stato che arriva da fuori — dal `localStorage`, che è una
   * stringa scritta da una versione dell'app che magari non è questa.
   *
   * ⚠️ Tutto ciò che non si capisce diventa «si vedono». Il ripiego non è
   * neutro: uno stato illeggibile che spegnesse i segni farebbe sparire il
   * lavoro dell'utente per un carattere storto in una preferenza, e lui non
   * saprebbe nemmeno dove guardare.
   */
  function normalizza(v) {
    var g = v;
    if (typeof g === 'string') {
      try { g = JSON.parse(g); } catch (e) { return diFabbrica(); }
    }
    if (!g || typeof g !== 'object') return diFabbrica();
    return { tutte: g.tutte !== false };
  }

  /** Quello che si scrive nel `localStorage`. Stringa, perché è lì che va. */
  function scrivi(stato) { return JSON.stringify(normalizza(stato)); }

  /** Lo stato con l'interruttore generale girato. Una funzione e non due righe
   *  nel renderer: il bottone della Fonte e quello delle Parole chiave la
   *  chiamano tutti e due, e due riti per lo stesso verbo divergono. */
  function commuta(stato) {
    var s = normalizza(stato);
    return { tutte: !s.tutte };
  }

  /** Si vedono, sì o no. */
  function accese(stato) { return normalizza(stato).tutte; }

  /**
   * Le evidenze da dipingere adesso.
   *
   * ⚠️ Torna SEMPRE un array nuovo e non tocca le voci: chi chiama le riconosce
   * per identità (`EvidenzeAncoraggio.risolvi` restituisce la voce per
   * riferimento), e una copia in mezzo romperebbe quel patto.
   */
  function visibili(elenco, stato) {
    var lista = Array.isArray(elenco) ? elenco : [];
    return accese(stato) ? lista.slice() : [];
  }

  /**
   * Quante se ne vedono e quante no. Serve a DIRLO: un elenco che si accorcia
   * senza spiegare perché è la stessa forma di una perdita silenziosa
   * (invariante 4), e «nessuna parola chiave» detto a chi ne ha trenta spente è
   * una bugia comoda.
   */
  function conta(elenco, stato) {
    var lista = Array.isArray(elenco) ? elenco : [];
    var viste = visibili(lista, stato).length;
    return { viste: viste, nascoste: lista.length - viste, tutte: lista.length };
  }

  return {
    diFabbrica: diFabbrica, normalizza: normalizza, scrivi: scrivi,
    commuta: commuta, accese: accese, visibili: visibili, conta: conta
  };
}));
