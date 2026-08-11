'use strict';
/**
 * reader-parser — il ponte fra le prove in Node e il codice del lettore.
 *
 * ⚠️ NON ESTRAE PIÙ NIENTE, e il nome è rimasto solo perché lo scrivono tre file
 * di prova. Fino all'11 agosto 2026 questo modulo prendeva il sorgente di
 * `App/StudIA.html`, ne ritagliava quattro blocchi — uno fra due `indexOf`, tre
 * fra commenti-sentinella `@…-puro-inizio` — e li eseguiva in sandbox `vm` con
 * dei finti globali. Reggeva più di mille controlli su dei marcatori di testo:
 * rinominare una funzione o cancellare un commento riordinando portava via le
 * prove senza un errore.
 *
 * Adesso quei quattro blocchi sono quattro moduli veri, e qui restano quattro
 * righe che li caricano. L'app e le prove usano lo STESSO file — che è la
 * garanzia che il ritaglio prometteva di dare e non poteva mantenere.
 *
 * Il giorno in cui le prove chiameranno i moduli per nome, questo file sparisce.
 */
const path = require('path');

/**
 * Il parser dei capitoli non si ritaglia più: è un modulo, e questa funzione lo
 * carica e basta.
 *
 * ⚠️ Che cosa c'era prima, perché non torni. `load()` prendeva il sorgente di
 * `StudIA.html`, ne tagliava 241 righe fra due `indexOf` (`function _unq(` →
 * `function buildVaultCourses(`) e le eseguiva in un sandbox `vm` con quattro
 * finti globali. Reggeva 915 controlli di round-trip su una coppia di marcatori
 * di testo: rinominare una funzione, o spostarne una fuori dal recinto, faceva
 * prendere al ritaglio il pezzo sbagliato senza un errore. Adesso l'app e le
 * prove caricano LO STESSO file — che è la garanzia che il round-trip prometteva.
 *
 * L'escape di ripiego e le mappe vuote li mette il modulo: qui si passano solo
 * i numeri del corso, quando la prova ne ha.
 */
function load(opts) {
  const CAP = require(path.join(__dirname, '..', 'App', 'assets', 'lettura', 'capitolo.js'));
  return CAP.crea({
    mediaNum: function () { return (opts && opts.mediaByNum) || {}; },
    pdfNum: function () { return (opts && opts.pdfByNum) || {}; }
  });
}

/* Gli altri tre blocchi erano marcati nel sorgente con dei commenti-sentinella
   (`@tts-puro-inizio`, `@appunti-puro-inizio`, `@lezioni-puro-inizio`) e
   ritagliati fra quelli. Adesso sono moduli: queste funzioni restano solo
   perché le prove le chiamano per nome, e caricano il file vero. */
const MODULI = path.join(__dirname, '..', 'App', 'assets');
function loadTts() { return require(path.join(MODULI, 'tts', 'segmenta.js')); }
function loadNotes() { return require(path.join(MODULI, 'appunti', 'elenco.js')); }
function loadLezioni() { return require(path.join(MODULI, 'lettura', 'lezioni.js')); }

module.exports = { load, loadTts, loadNotes, loadLezioni };
