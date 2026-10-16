'use strict';

const fs = require('fs');
const path = require('path');
const gruppi = require('../App/assets/fonti/gruppi');
const materiali = require('./materiali');
const { writeAtomic } = require('./appunti');
const { zainoValido } = require('./zaino-only');
const FILE = '_gruppi.json';
const ESTENSIONI = new Set(['.pdf'].concat(materiali.EXT_MEDIA));

function verifica(percorso, tipo) {
  let st;
  try { st = fs.lstatSync(percorso); }
  catch (e) { if (e.code === 'ENOENT') return false; throw e; }
  if (st.isSymbolicLink() || (tipo === 'dir' ? !st.isDirectory() : !st.isFile())) {
    throw new Error('Percorso delle fonti non valido: ' + path.basename(percorso));
  }
  return true;
}
function cartella(vault, id) {
  if (typeof id !== 'string' || /[\\/\x00]/.test(id) || !zainoValido(vault, id)) throw new Error('Apri uno zaino valido.');
  const dir = path.join(fs.realpathSync(vault), 'Zaini', id, materiali.CARTELLA);
  verifica(path.join(path.dirname(dir), '_zaino.md'), 'file');
  verifica(dir, 'dir');
  return dir;
}
function nomiReali(dir) {
  const nomi = new Set();
  // Le cartelle storiche seguono la stessa regola di materiali.js; mai altri zaini o il corpus globale.
  const cartelle = new Set(['Media', 'Fonti'].flatMap((sub) => materiali.nomiInCorso(sub).concat(sub)));
  for (const nome of cartelle) {
    const sotto = path.join(dir, nome);
    if (!verifica(sotto, 'dir')) continue;
    for (const f of fs.readdirSync(sotto).sort()) {
      if (f.startsWith('.') || !ESTENSIONI.has(path.extname(f).toLowerCase())) continue;
      if (verifica(path.join(sotto, f), 'file')) nomi.add(f);
    }
  }
  return Array.from(nomi).sort((a, b) => a.localeCompare(b, 'it', { numeric: true }));
}
function formaValida(stato) {
  const fileValido = (f) => typeof f === 'string' && !!f && !/[\\/\x00]/.test(f) && f !== '.' && f !== '..';
  const listaValida = (v) => Array.isArray(v) && v.every(fileValido);
  return !!stato && stato.versione === 1 && Array.isArray(stato.gruppi) && listaValida(stato.liberi) &&
    stato.gruppi.every((g) => g && typeof g.id === 'string' && !!g.id.trim() && typeof g.nome === 'string' &&
      !!g.nome.trim() && typeof g.chiuso === 'boolean' && listaValida(g.files)) &&
    new Set(stato.gruppi.map((g) => g.id)).size === stato.gruppi.length;
}
function leggiFile(file) {
  if (!verifica(file, 'file')) return { versione: 1, gruppi: [], liberi: [] };
  const stato = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!formaValida(stato)) throw new Error('Il file dei gruppi delle fonti ha un formato non valido.');
  return stato;
}
function fallito(e) { return { stato: null, error: 'Gruppi delle fonti: ' + e.message }; }
function leggi(vault, id) {
  try {
    const dir = cartella(vault, id);
    return { stato: gruppi.normalizza(leggiFile(path.join(dir, FILE)), nomiReali(dir)), error: '' };
  } catch (e) { return fallito(e); }
}
function salva(vault, id, stato) {
  try {
    if (!formaValida(stato)) throw new Error('Lo stato dei gruppi delle fonti non è valido.');
    const dir = cartella(vault, id), file = path.join(dir, FILE);
    // Un registro danneggiato si segnala e si conserva: un salvataggio non deve cancellarne la traccia.
    leggiFile(file);
    const nuovo = gruppi.normalizza(stato, nomiReali(dir));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    // writeAtomic usa questo nome temporaneo: anche un collegamento rimasto qui va rifiutato prima di scrivere.
    const tmp = file + '.tmp-' + process.pid;
    if (verifica(tmp, 'file')) {
      throw new Error('Esiste già un file temporaneo dei gruppi delle fonti.');
    }
    writeAtomic(file, JSON.stringify(nuovo, null, 2) + '\n');
    return { stato: nuovo, error: '' };
  } catch (e) { return fallito(e); }
}

module.exports = { FILE, leggi, salva };
