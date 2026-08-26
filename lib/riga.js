'use strict';
/**
 * riga — a che riga si era arrivati, in un appunto.
 *
 * Il terzo gemello di `lettura.js` (la pagina di un documento) e `ascolto.js`
 * (il secondo di un media). L'app ricordava dove eri in ogni documento e in
 * ogni video; l'appunto — il pezzo su cui si torna più spesso, e l'unico che
 * l'utente ha scritto lui — si riapriva sempre in cima. Su un appunto di un
 * semestre vuol dire scorrere ogni volta.
 *
 * ── Le decisioni, e il perché ───────────────────────────────────────────────
 *
 * 1. **Sta nel vault**, come la pagina e il secondo. La linea è quella fissata
 *    il 19 agosto: nel vault sta lo stato dei CONTENUTI, che viaggia con
 *    l'esportazione; nel `localStorage` sta come si vede lo schermo di questa
 *    macchina. Dove sei arrivato a leggere è un fatto del contenuto — passando
 *    lo zaino a un altro computer viaggia con lui.
 *
 * 2. **Il file sta in `APPUNTI/`**, non nella radice del contenitore come
 *    `_lettura.json`. Non è un vezzo: `lib/pacchetto.js` esclude `APPUNTI/*`
 *    quando l'autore sceglie di non dare i suoi appunti, e il punto in cui era
 *    arrivato a leggerli è roba sua quanto il testo. Fuori di lì viaggerebbe
 *    anche in un pacchetto che gli appunti non li contiene.
 *
 * 3. **Si ricorda la RIGA, non il carattere.** Un appunto si riscrive: salvare
 *    l'offset assoluto vuol dire riaprirlo a metà parola dopo una modifica
 *    fatta altrove. La riga regge le riscritture, e se il file si accorcia si
 *    stringe all'ultima — la stessa regola di `vaiAPagina`.
 *
 * ⚠️ **Lo ZERO è una riga**, a differenza della pagina, che comincia da 1: la
 * prima riga di un testo è la riga 0 in ogni editor, e trattarla come «nessun
 * segno» vorrebbe dire non poter più tornare in cima di proposito. È la stessa
 * distinzione già scritta per `_ascolto.json`, dove il secondo zero esiste.
 *
 * ⚠️ Il file non è la verità di niente: se sparisce, si riparte dalla prima
 * riga. Per questo qui non si solleva mai — si torna un valore neutro e si va
 * avanti.
 *
 * Niente DOM, niente Electron: gira in Node e si prova con `node test/riga.js`.
 */

const fs = require('fs');
const path = require('path');
const appunti = require('./appunti');   // dir() e writeAtomic(): una copia sola
/* ⚠️ La DECISIONE — che cosa è una riga valida, e dove si apre un appunto che
   si è accorciato — sta in un modulo UMD, perché serve a tutti e due i lati:
   qui per scrivere il segno, al renderer per portarci il cursore. Due copie
   divergono, e il giorno che divergessero l'appunto si riaprirebbe in un punto
   e il file ne direbbe un altro (invariante 5). */
const segno = require('../App/assets/appunti/segno.js');

const FILE = '_riga.json';

function str(v) { return typeof v === 'string' ? v : (v == null ? '' : String(v)); }

/** Il file dei segni di un contenitore, dentro `APPUNTI/`. */
function percorso(vault, id) { return path.join(appunti.dir(vault, id), FILE); }

/** Un appunto è un nome di file, non un percorso: la stessa guardia che
 *  difende ogni porta di `lib/appunti.js`. */
function fileValido(nome) {
  const s = str(nome);
  return !!s && s.indexOf('/') < 0 && s.indexOf('\\') < 0 && s.indexOf('..') < 0;
}

/**
 * I segni di un contenitore: `{ appunti: { '<file>': { riga, quando } } }`.
 * Un file assente non è un errore: è la condizione di chi non ha ancora
 * riaperto niente.
 */
function leggi(vault, id) {
  if (!vault || !str(id)) return { appunti: {}, error: 'contenitore non valido' };
  let grezzo;
  try { grezzo = fs.readFileSync(percorso(vault, id), 'utf-8'); }
  catch (e) { return { appunti: {}, error: e.code === 'ENOENT' ? '' : (e.message || 'lettura fallita') }; }
  let dati;
  try { dati = JSON.parse(grezzo); }
  catch (e) { return { appunti: {}, error: 'il file non è JSON valido' }; }
  const dentro = (dati && typeof dati.appunti === 'object' && dati.appunti) || {};
  const out = {};
  for (const k of Object.keys(dentro)) {
    if (!fileValido(k)) continue;
    const r = segno.rigaValida(dentro[k] && dentro[k].riga);
    if (r == null) continue;
    out[k] = { riga: r, quando: str(dentro[k].quando) };
  }
  return { appunti: out, error: '' };
}

/** A che riga si era arrivati su questo appunto, o `null`. */
function riga(vault, id, file) {
  const r = leggi(vault, id);
  const v = r.appunti[str(file)];
  return v ? v.riga : null;
}

/**
 * Segna la riga. Torna i segni come sono rimasti, perché chi chiama adotti
 * quelli e non la propria idea di prima.
 *
 * ⚠️ La riga 0 si scrive come tutte le altre: «non l'ho mai riaperto» e «sono
 * tornato in cima» sono due fatti diversi, e il secondo va rispettato.
 */
function segna(vault, id, file, r, quando) {
  if (!vault || !str(id)) return { appunti: {}, error: 'contenitore non valido' };
  if (!fileValido(file)) return { appunti: {}, error: 'appunto non valido' };
  const n = segno.rigaValida(r);
  if (n == null) return { appunti: {}, error: 'riga non valida' };
  const letto = leggi(vault, id);
  if (letto.error) return { appunti: {}, error: letto.error };
  const elenco = Object.assign({}, letto.appunti);
  elenco[str(file)] = { riga: n, quando: str(quando) || new Date().toISOString() };
  return scrivi(vault, id, elenco);
}

/** Toglie il segno di un appunto (quando il file non c'è più, o è stato
 *  rinominato: là il segno lo riscrive chi rinomina, col nome nuovo). */
function dimentica(vault, id, file) {
  const letto = leggi(vault, id);
  if (letto.error) return { appunti: {}, error: letto.error };
  if (!letto.appunti[str(file)]) return { appunti: letto.appunti, error: '' };
  const elenco = Object.assign({}, letto.appunti);
  delete elenco[str(file)];
  return scrivi(vault, id, elenco);
}

function scrivi(vault, id, elenco) {
  const p = percorso(vault, id);
  const quanti = Object.keys(elenco).length;
  /* Niente segni e nessun file: non se ne crea uno per dire «zero». Se il file
     c'è, invece, lo si riscrive: lì «vuoto» è un fatto nuovo. */
  if (!quanti && !fs.existsSync(p)) return { appunti: {}, error: '' };
  try { fs.mkdirSync(path.dirname(p), { recursive: true }); } catch (e) { /* c'è già */ }
  try { appunti.writeAtomic(p, JSON.stringify({ appunti: elenco }, null, 2) + '\n'); }
  catch (e) { return { appunti: {}, error: e.message || 'scrittura fallita' }; }
  return { appunti: elenco, error: '' };
}

/* Le due regole pure si RI-esportano da qui: chi ha in mano `lib/riga.js` non
   deve sapere che vivono in `App/assets/` — sa che sono le regole del segno. */
module.exports = { FILE, percorso, fileValido,
  rigaValida: segno.rigaValida, dove: segno.dove,
  leggi, riga, segna, dimentica };
