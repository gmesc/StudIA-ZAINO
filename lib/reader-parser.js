'use strict';
/**
 * reader-parser — estrae a runtime le funzioni di parsing markdown DAL renderer
 * reale (App/StudIA.html) e le rende chiamabili da Node.
 *
 * Serve ai test di round-trip: garantisce che il serializzatore sia validato
 * contro il parser che l'app usa davvero, non contro una copia che può divergere.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = path.join(__dirname, '..', 'App', 'StudIA.html');

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

// blocco delle funzioni di lettura vocale che non toccano il DOM
const TTS_START = '/* @tts-puro-inizio';
const TTS_END = '/* @tts-puro-fine */';

function loadTts() {
  const src = fs.readFileSync(HTML, 'utf8');
  const a = src.indexOf(TTS_START);
  const b = src.indexOf(TTS_END);
  if (a < 0 || b < 0 || b <= a) throw new Error('reader-parser: blocco TTS non trovato in StudIA.html');
  const code = src.slice(a, b);
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(code + '\nthis.__tts = { ttsNormalizza, ttsFrasi, ttsSpezzaLunga, ttsProsodia, ttsSegmenti };', sandbox);
  return sandbox.__tts;
}

// blocco degli appunti che non tocca il DOM: legame appunto↔capitolo ed elenco
const NOTE_START = '/* @appunti-puro-inizio';
const NOTE_END = '/* @appunti-puro-fine */';

function loadNotes() {
  const src = fs.readFileSync(HTML, 'utf8');
  const a = src.indexOf(NOTE_START);
  const b = src.indexOf(NOTE_END);
  if (a < 0 || b < 0 || b <= a) throw new Error('reader-parser: blocco appunti non trovato in StudIA.html');
  const code = src.slice(a, b);
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(code + '\nthis.__notes = { noteInChapter, noteStessoLezione, noteEtichetta, noteEtichettaAltrove, noteDove, noteGroups };', sandbox);
  return sandbox.__notes;
}

// blocco della risoluzione base→variante: da un nome di rimando alla lezione da aprire
const LEZ_START = '/* @lezioni-puro-inizio';
const LEZ_END = '/* @lezioni-puro-fine */';

function loadLezioni() {
  const src = fs.readFileSync(HTML, 'utf8');
  const a = src.indexOf(LEZ_START);
  const b = src.indexOf(LEZ_END);
  if (a < 0 || b < 0 || b <= a) throw new Error('reader-parser: blocco lezioni non trovato in StudIA.html');
  const code = src.slice(a, b);
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(code + '\nthis.__lez = { scomponiLezione, risolviLezione, preferitaFra, cartelleScelte };', sandbox);
  return sandbox.__lez;
}

module.exports = { load, loadTts, loadNotes, loadLezioni };
