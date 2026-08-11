'use strict';
/**
 * lettura — a che pagina si era arrivati.
 *
 * Chi studia su un documento di trecento pagine non lo riapre dall'inizio. Il
 * segno lo mette l'app: per ogni documento di un contenitore — un corso o uno
 * zaino — l'ultima pagina guardata.
 *
 * ── Tre decisioni, e il perché ──────────────────────────────────────────────
 *
 * 1. **Sta nel vault, non nel `localStorage`.** È un fatto del documento, non
 *    della macchina: passando lo zaino a un altro computer il segno viaggia con
 *    lui. Lo zoom invece resta nel `localStorage`, ed è la distinzione giusta —
 *    quello è un modo di guardare, questo è un punto in cui si è arrivati.
 *
 * 2. **Un file solo per contenitore**, non uno per documento: un segnalibro è
 *    una riga, non un documento. Stessa scelta di `_evidenze.json`, e stessa
 *    ragione.
 *
 * 3. **Non si crea niente per dire «zero».** Se non c'è nessun segno il file non
 *    nasce: nel vault di chi apre le cartelle, un file vuoto è rumore. È la
 *    regola già pagata in `evidenze.salva`.
 *
 * ⚠️ Il file non è la verità di niente: se sparisce, si riparte da pagina 1. Per
 * questo qui non si solleva mai — si torna un valore neutro e si va avanti.
 *
 * Niente DOM, niente Electron: gira in Node e si prova con `node test/lettura.js`.
 */

const fs = require('fs');
const path = require('path');
const appunti = require('./appunti');   // writeAtomic: una copia sola, come per le evidenze
const corsi = require('./corsi');       // cartella(): risolve `Corsi/` e `Zaini/`

const FILE = '_lettura.json';

function str(v) { return typeof v === 'string' ? v : (v == null ? '' : String(v)); }

/** Il contenitore è una cartella dentro `Corsi/` o `Zaini/`, e nient'altro. */
function idValido(id) {
  const s = str(id);
  return !!s && s.indexOf('/') < 0 && s.indexOf('\\') < 0 && s.indexOf('..') < 0;
}
/** Un documento è un nome di file, non un percorso. */
function fileValido(nome) {
  const s = str(nome);
  return !!s && s === path.basename(s) && s !== '.' && s !== '..';
}

function percorso(vault, id) { return path.join(corsi.cartella(vault, id), FILE); }

/**
 * Una pagina è un intero ≥ 1. Lo zero non esiste: i documenti cominciano da 1,
 * ed è la stessa regola dell'album — «pagina 0» è un errore, non un valore.
 */
function paginaValida(p) {
  const n = Number(p);
  return Number.isFinite(n) && n >= 1 ? Math.trunc(n) : null;
}

/**
 * I segni di un contenitore: `{ documenti: { '<file>': { pagina, quando } } }`.
 * Un file assente non è un errore: è la condizione normale di chi non ha ancora
 * letto niente.
 */
function leggi(vault, id) {
  if (!vault || !idValido(id)) return { documenti: {}, error: 'contenitore non valido' };
  let grezzo;
  try { grezzo = fs.readFileSync(percorso(vault, id), 'utf-8'); }
  catch (e) { return { documenti: {}, error: e.code === 'ENOENT' ? '' : (e.message || 'lettura fallita') }; }
  let dati;
  try { dati = JSON.parse(grezzo); }
  catch (e) { return { documenti: {}, error: 'il file non è JSON valido' }; }
  const dentro = (dati && typeof dati.documenti === 'object' && dati.documenti) || {};
  const out = {};
  for (const k of Object.keys(dentro)) {
    if (!fileValido(k)) continue;
    const p = paginaValida(dentro[k] && dentro[k].pagina);
    if (p == null) continue;
    out[k] = { pagina: p, quando: str(dentro[k].quando) };
  }
  return { documenti: out, error: '' };
}

/** A che pagina si era arrivati su questo documento, o `null`. */
function pagina(vault, id, file) {
  const r = leggi(vault, id);
  const v = r.documenti[str(file)];
  return v ? v.pagina : null;
}

/**
 * Segna la pagina. Torna i segni come sono rimasti, perché chi chiama adotti
 * quelli e non la propria idea di prima.
 *
 * ⚠️ Pagina 1 si scrive come tutte le altre. Sembra inutile — è il valore di
 * partenza — ma «non l'ho mai aperto» e «l'ho riportato in cima» sono due fatti
 * diversi, e il secondo va rispettato.
 */
function segna(vault, id, file, pag, quando) {
  if (!vault || !idValido(id)) return { documenti: {}, error: 'contenitore non valido' };
  if (!fileValido(file)) return { documenti: {}, error: 'documento non valido' };
  const p = paginaValida(pag);
  if (p == null) return { documenti: {}, error: 'pagina non valida' };
  const letto = leggi(vault, id);
  if (letto.error) return { documenti: {}, error: letto.error };
  const documenti = Object.assign({}, letto.documenti);
  documenti[str(file)] = { pagina: p, quando: str(quando) || new Date().toISOString() };
  return scrivi(vault, id, documenti);
}

/** Toglie il segno di un documento (per esempio quando il file non c'è più). */
function dimentica(vault, id, file) {
  const letto = leggi(vault, id);
  if (letto.error) return { documenti: {}, error: letto.error };
  if (!letto.documenti[str(file)]) return { documenti: letto.documenti, error: '' };
  const documenti = Object.assign({}, letto.documenti);
  delete documenti[str(file)];
  return scrivi(vault, id, documenti);
}

function scrivi(vault, id, documenti) {
  const p = percorso(vault, id);
  const quanti = Object.keys(documenti).length;
  /* Niente segni e nessun file: non se ne crea uno per dire «zero». Se il file
     c'è, invece, lo si riscrive: lì «vuoto» è un fatto nuovo. */
  if (!quanti && !fs.existsSync(p)) return { documenti: {}, error: '' };
  try { fs.mkdirSync(path.dirname(p), { recursive: true }); } catch (e) { /* c'è già */ }
  try { appunti.writeAtomic(p, JSON.stringify({ documenti }, null, 2) + '\n'); }
  catch (e) { return { documenti: {}, error: e.message || 'scrittura fallita' }; }
  return { documenti, error: '' };
}

module.exports = { FILE, percorso, idValido, fileValido, paginaValida, leggi, pagina, segna, dimentica };
