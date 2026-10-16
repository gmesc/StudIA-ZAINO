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
function cartella(vault, id, sezione) {
  if (!['fonti', 'media', 'appunti'].includes(sezione)) throw new Error('Sezione non valida.');
  if (typeof id !== 'string' || /[\\/\x00]/.test(id) || !zainoValido(vault, id)) throw new Error('Apri uno zaino valido.');
  const dir = path.join(fs.realpathSync(vault), 'Zaini', id, sezione === 'appunti' ? 'APPUNTI' : materiali.CARTELLA);
  verifica(path.join(path.dirname(dir), '_zaino.md'), 'file');
  verifica(dir, 'dir');
  return dir;
}
function nomiReali(dir, sezione) {
  if (sezione === 'appunti') {
    if (!verifica(dir, 'dir')) return [];
    // Stessa selezione di appunti.list: anche una nota importata con nome iniziante per punto resta visibile.
    return fs.readdirSync(dir).sort().filter(f => !f.startsWith('_') && /\.md$/i.test(f) && verifica(path.join(dir, f), 'file'));
  }
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
  return Array.from(nomi).filter(f => sezione === 'media' ? path.extname(f).toLowerCase() !== '.pdf' : path.extname(f).toLowerCase() === '.pdf').sort((a, b) => a.localeCompare(b, 'it', { numeric: true }));
}
function formaValida(stato) {
  const fileValido = (f) => typeof f === 'string' && !!f && !/[\\/\x00]/.test(f) && f !== '.' && f !== '..';
  const listaValida = (v) => Array.isArray(v) && v.every(fileValido);
  return !!stato && stato.versione === 1 && Array.isArray(stato.gruppi) && listaValida(stato.liberi) &&
    stato.gruppi.every((g) => g && typeof g.id === 'string' && !!g.id.trim() && typeof g.nome === 'string' &&
      !!g.nome.trim() && typeof g.chiuso === 'boolean' && listaValida(g.files)) &&
    new Set(stato.gruppi.map((g) => g.id)).size === stato.gruppi.length;
}
function vuoto() { return { versione: 1, gruppi: [], liberi: [] }; }
function leggiFile(file, appunti) {
  if (!verifica(file, 'file')) return appunti ? vuoto() : { versione: 2, fonti: vuoto(), media: vuoto() };
  const stato = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (formaValida(stato)) {
    // Il registro storico mescolava PDF e media: separiamo le viste senza riscriverlo in lettura.
    return appunti ? stato : { versione: 2, fonti: stato, media: stato };
  }
  if (!appunti && stato && stato.versione === 2 && formaValida(stato.fonti) && formaValida(stato.media)) return stato;
  throw new Error('Il file dei gruppi ha un formato non valido.');
}
function fallito(e) { return { stato: null, error: 'Gruppi: ' + e.message }; }
function leggi(vault, id, sezione = 'fonti') {
  try {
    const dir = cartella(vault, id, sezione), appunti = sezione === 'appunti';
    const registro = leggiFile(path.join(dir, FILE), appunti);
    return { stato: gruppi.normalizza(appunti ? registro : registro[sezione], nomiReali(dir, sezione)), error: '' };
  } catch (e) { return fallito(e); }
}
function salva(vault, id, stato, sezione = 'fonti') {
  try {
    if (!formaValida(stato)) throw new Error('Lo stato dei gruppi non è valido.');
    const dir = cartella(vault, id, sezione), file = path.join(dir, FILE), appunti = sezione === 'appunti';
    // Si conserva anche l'altra sezione e si rifiuta un registro danneggiato.
    const registro = leggiFile(file, appunti);
    const nuovo = gruppi.normalizza(stato, nomiReali(dir, sezione));
    const completo = appunti ? nuovo : {
      versione: 2,
      fonti: sezione === 'fonti' ? nuovo : gruppi.normalizza(registro.fonti, nomiReali(dir, 'fonti')),
      media: sezione === 'media' ? nuovo : gruppi.normalizza(registro.media, nomiReali(dir, 'media'))
    };
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    const tmp = file + '.tmp-' + process.pid;
    if (verifica(tmp, 'file')) throw new Error('Esiste già un file temporaneo dei gruppi.');
    writeAtomic(file, JSON.stringify(completo, null, 2) + '\n');
    return { stato: nuovo, error: '' };
  } catch (e) { return fallito(e); }
}

module.exports = { FILE, leggi, salva };
