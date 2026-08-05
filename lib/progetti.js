'use strict';
/**
 * progetti — piccole regole di sicurezza sui progetti del vault.
 *
 * Un progetto può essere marcato PROTETTO: è materiale di studio finito, che la
 * pipeline non deve toccare. Chi scrive nel vault chiede il permesso qui prima,
 * così la regola sta in un posto solo e non dipende dalla memoria di chi chiama.
 *
 * Marcatura: `protetto: true` nel frontmatter di `_progetto.md`, oppure la
 * presenza del file `_PROTETTO` nella cartella del progetto.
 */

const fs = require('fs');
const path = require('path');
const profilo = require('./profilo');   // riusa il parser del frontmatter ristretto

/** Cartella di un progetto. */
function cartella(vault, id) { return path.join(vault, 'Progetti', id); }

/**
 * La cartella dei file di servizio della pipeline: piano, schede, marcatore di
 * protezione. Stanno insieme e fuori strada, così aprendo un progetto si vedono
 * solo le cose che contano per chi studia: `_progetto.md`, i corsi, `APPUNTI/`,
 * `MATERIALI/`.
 */
const LAVORAZIONE = '_lavorazione';
function lavorazione(vault, id) { return path.join(cartella(vault, id), LAVORAZIONE); }

/**
 * I corsi stanno in `CORSI/`, così la radice del progetto resta leggibile: chi
 * apre la cartella vede quattro cose (`_progetto.md`, `CORSI/`, `APPUNTI/`,
 * `MATERIALI/`) e non sedici cartelle numerate mescolate al resto.
 *
 * I progetti fatti prima tengono i corsi nella radice: `cartellaCorsi()` li
 * riconosce e continua a funzionare senza migrazione obbligata.
 */
const CORSI = 'CORSI';
const NON_CORSI = ['APPUNTI', 'MATERIALI', LAVORAZIONE, CORSI, '_scarti'];

/** Dove stanno i corsi di questo progetto: `CORSI/` se c'è, altrimenti la radice. */
function cartellaCorsi(vault, id) {
  const nuova = path.join(cartella(vault, id), CORSI);
  if (fs.existsSync(nuova)) return nuova;
  return cartella(vault, id);
}

/** La cartella di un corso. */
function corsoDir(vault, id, folder) { return path.join(cartellaCorsi(vault, id), folder); }

/** I nomi delle cartelle-corso, in ordine. */
function elencoCorsi(vault, id) {
  try {
    return fs.readdirSync(cartellaCorsi(vault, id), { withFileTypes: true })
      .filter((x) => x.isDirectory() && !x.name.startsWith('.') && !NON_CORSI.includes(x.name))
      .map((x) => x.name).sort((a, b) => a.localeCompare(b, 'it'));
  } catch (e) { return []; }
}

/**
 * Dove creare un corso nuovo: in `CORSI/` sempre, anche se il progetto non ce
 * l'ha ancora — i progetti crescono verso la struttura ordinata, non indietro.
 */
function cartellaCorsiPerScrivere(vault, id) {
  const dir = path.join(cartella(vault, id), CORSI);
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
  return dir;
}

/**
 * Percorso di un file di servizio: quello nuovo se c'è, altrimenti il vecchio
 * nella radice del progetto (i vault già in uso non vanno migrati per forza).
 */
function servizio(vault, id, nome) {
  const nuovo = path.join(lavorazione(vault, id), nome);
  if (fs.existsSync(nuovo)) return nuovo;
  const vecchio = path.join(cartella(vault, id), nome);
  return fs.existsSync(vecchio) ? vecchio : nuovo;
}

/** Il progetto è marcato protetto? */
function protetto(vault, id) {
  if (!vault || !id) return false;
  const dir = cartella(vault, id);
  if (fs.existsSync(path.join(dir, LAVORAZIONE, '_PROTETTO')) || fs.existsSync(path.join(dir, '_PROTETTO'))) return true;
  try {
    const fm = profilo.parse(fs.readFileSync(path.join(dir, '_progetto.md'), 'utf-8'));
    return fm.protetto === true || fm.protetto === 'true';
  } catch (e) { return false; }
}

/** Marca (o smarca) un progetto come protetto. */
function proteggi(vault, id, attiva) {
  const dir = cartella(vault, id);
  const marcatore = servizio(vault, id, '_PROTETTO');
  const mdser = require('./mdser');
  const file = path.join(dir, '_progetto.md');
  try {
    let raw = fs.readFileSync(file, 'utf-8');
    raw = mdser.upsertFmLine(raw, 'protetto', 'protetto: ' + (attiva === false ? 'false' : 'true'));
    fs.writeFileSync(file, raw, 'utf-8');
  } catch (e) {}
  if (attiva === false) { try { fs.unlinkSync(marcatore); } catch (e) {} }
  else { try { fs.mkdirSync(path.dirname(marcatore), { recursive: true }); } catch (e) {} }
  if (attiva !== false) fs.writeFileSync(marcatore,'Progetto protetto: la pipeline di StudIA non deve scriverci.\nToglilo (o metti protetto: false in _progetto.md) per riaprirlo alla scrittura.\n', 'utf-8');
  return true;
}

/** Errore pronto da restituire quando qualcuno prova a scrivere in un progetto protetto. */
function motivoRifiuto(id) {
  return 'Il progetto «' + id + '» è protetto: è materiale di studio, la pipeline non ci scrive. ' +
    'Lavora su una copia (per esempio «' + id + '-LAB»).';
}

/** Solleva se il progetto è protetto; altrimenti non fa niente. */
function assicuraScrivibile(vault, id) {
  if (protetto(vault, id)) throw new Error(motivoRifiuto(id));
}

module.exports = { LAVORAZIONE, CORSI, NON_CORSI, lavorazione, servizio,
  cartellaCorsi, cartellaCorsiPerScrivere, corsoDir, elencoCorsi, cartella, protetto, proteggi, motivoRifiuto, assicuraScrivibile };
