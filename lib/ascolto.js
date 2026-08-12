'use strict';
/**
 * ascolto — a che punto si era arrivati in un video o in un audio.
 *
 * È `lib/lettura.js` per ciò che scorre nel tempo: là un documento e la sua
 * pagina, qui un media e il suo secondo. Le tre decisioni sono le stesse, e non
 * per simmetria — sono la stessa decisione applicata due volte:
 *
 * 1. **sta nel vault, non nel `localStorage`**: è un fatto del materiale, non
 *    della macchina. Lo zaino portato su un altro computer riprende la lezione
 *    dove l'avevi lasciata;
 * 2. **un file solo per contenitore** (`_ascolto.json`), non uno per media: un
 *    segnalibro è una riga, non un documento;
 * 3. **non si crea niente per dire «zero»**: senza nessun segno il file non
 *    nasce, perché in una cartella che l'utente apre un file vuoto è rumore.
 *
 * ⚠️ **Perché un file a parte e non una chiave in più in `_lettura.json`.**
 * Una pagina e un secondo si somigliano solo a guardarli da lontano: la pagina
 * è un intero ≥ 1 che il documento contiene davvero, il secondo è un tempo che
 * comincia da zero e che può cadere in mezzo a un fotogramma. Mescolarli in una
 * struttura sola vorrebbe dire una funzione che chiede «pagina o secondo?» a
 * ogni riga — e il giorno in cui un materiale è tutti e due (un PDF con
 * l'audio della lezione) i due segni devono poter convivere, non escludersi.
 *
 * ⚠️ Il file non è la verità di niente: se sparisce, si riparte da capo. Qui
 * non si solleva mai — si torna un valore neutro e si va avanti.
 *
 * Niente DOM, niente Electron: gira in Node e si prova con `node test/ascolto.js`.
 */

const fs = require('fs');
const path = require('path');
const appunti = require('./appunti');   // writeAtomic: una copia sola, come per le evidenze
const corsi = require('./corsi');       // cartella(): risolve `Corsi/` e `Zaini/`

const FILE = '_ascolto.json';

function str(v) { return typeof v === 'string' ? v : (v == null ? '' : String(v)); }

/** Il contenitore è una cartella dentro `Corsi/` o `Zaini/`, e nient'altro. */
function idValido(id) {
  const s = str(id);
  return !!s && s.indexOf('/') < 0 && s.indexOf('\\') < 0 && s.indexOf('..') < 0;
}
/** Un media è un nome di file, non un percorso. */
function fileValido(nome) {
  const s = str(nome);
  return !!s && s === path.basename(s) && s !== '.' && s !== '..';
}

function percorso(vault, id) { return path.join(corsi.cartella(vault, id), FILE); }

/**
 * Un secondo è un numero ≥ 0, e si tiene INTERO.
 *
 * ⚠️ Lo zero esiste, al contrario della pagina: «riportato all'inizio» è un
 * fatto, e va rispettato come tutti gli altri. Quello che non esiste è il
 * secondo negativo, e nemmeno l'infinito — `currentTime` di un media non ancora
 * caricato vale `NaN`, e scriverlo vorrebbe dire un segnalibro che al ritorno
 * fa saltare il lettore in un punto che non c'è.
 */
function secondoValido(s) {
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
}

/**
 * I segni di un contenitore: `{ media: { '<file>': { secondo, quando } } }`.
 * Un file assente non è un errore: è chi non ha ancora ascoltato niente.
 */
function leggi(vault, id) {
  if (!vault || !idValido(id)) return { media: {}, error: 'contenitore non valido' };
  let grezzo;
  try { grezzo = fs.readFileSync(percorso(vault, id), 'utf-8'); }
  catch (e) { return { media: {}, error: e.code === 'ENOENT' ? '' : (e.message || 'lettura fallita') }; }
  let dati;
  try { dati = JSON.parse(grezzo); }
  catch (e) { return { media: {}, error: 'il file non è JSON valido' }; }
  const dentro = (dati && typeof dati.media === 'object' && dati.media) || {};
  const out = {};
  for (const k of Object.keys(dentro)) {
    if (!fileValido(k)) continue;
    const s = secondoValido(dentro[k] && dentro[k].secondo);
    if (s == null) continue;
    out[k] = { secondo: s, quando: str(dentro[k].quando) };
  }
  return { media: out, error: '' };
}

/** A che secondo si era arrivati su questo media, o `null`. */
function secondo(vault, id, file) {
  const r = leggi(vault, id);
  const v = r.media[str(file)];
  return v ? v.secondo : null;
}

/**
 * Segna il secondo. Torna i segni come sono rimasti, perché chi chiama adotti
 * quelli e non la propria idea di prima.
 */
function segna(vault, id, file, sec, quando) {
  if (!vault || !idValido(id)) return { media: {}, error: 'contenitore non valido' };
  if (!fileValido(file)) return { media: {}, error: 'media non valido' };
  const s = secondoValido(sec);
  if (s == null) return { media: {}, error: 'secondo non valido' };
  const letto = leggi(vault, id);
  if (letto.error) return { media: {}, error: letto.error };
  const media = Object.assign({}, letto.media);
  media[str(file)] = { secondo: s, quando: str(quando) || new Date().toISOString() };
  return scrivi(vault, id, media);
}

/** Toglie il segno di un media (per esempio quando il file non c'è più). */
function dimentica(vault, id, file) {
  const letto = leggi(vault, id);
  if (letto.error) return { media: {}, error: letto.error };
  if (!letto.media[str(file)]) return { media: letto.media, error: '' };
  const media = Object.assign({}, letto.media);
  delete media[str(file)];
  return scrivi(vault, id, media);
}

function scrivi(vault, id, media) {
  const p = percorso(vault, id);
  const quanti = Object.keys(media).length;
  /* Niente segni e nessun file: non se ne crea uno per dire «zero». Se il file
     c'è, invece, lo si riscrive: lì «vuoto» è un fatto nuovo. */
  if (!quanti && !fs.existsSync(p)) return { media: {}, error: '' };
  try { fs.mkdirSync(path.dirname(p), { recursive: true }); } catch (e) { /* c'è già */ }
  try { appunti.writeAtomic(p, JSON.stringify({ media }, null, 2) + '\n'); }
  catch (e) { return { media: {}, error: e.message || 'scrittura fallita' }; }
  return { media, error: '' };
}

module.exports = { FILE, percorso, idValido, fileValido, secondoValido, leggi, secondo, segna, dimentica };
