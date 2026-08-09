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

// dal primo `function _unq(` fino alla chiusura di mdChapter
const START = 'function _unq(';
const END_MARK = 'function buildVaultCourses(';

function load(opts) {
  const src = fs.readFileSync(HTML, 'utf8');
  const a = src.indexOf(START);
  const b = src.indexOf(END_MARK);
  if (a < 0 || b < 0 || b <= a) throw new Error('reader-parser: blocco di parsing non trovato in StudIA.html');
  const code = src.slice(a, b);

  const sandbox = {
    MEDIA_BY_NUM: (opts && opts.mediaByNum) || {},
    PDF_BY_NUM: (opts && opts.pdfByNum) || {},
    /* Nel renderer le mappe NN→file si scelgono in base al corso in
       lavorazione, e i due accessori stanno FUORI dal blocco estratto qui
       (che parte da `_unq`). Nel test non c'è un corso: si risolve sulle
       mappe passate, che è esattamente il ripiego del renderer. */
    _mediaNum: function () { return (opts && opts.mediaByNum) || {}; },
    _pdfNum: function () { return (opts && opts.pdfByNum) || {}; },
    // stub minimale: nel renderer escHtml fa l'escape delle entità
    escHtml: (s) => String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;'),
    console
  };
  vm.createContext(sandbox);
  vm.runInContext(code + '\nthis.__api = { parseFrontmatter, parseFenced, mdToHtml, mdChapter, _mdInline, _stripFm };', sandbox);
  return sandbox.__api;
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

module.exports = { load, loadTts, loadNotes };
