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
  if (!['fonti', 'media', 'appunti', 'mappe'].includes(sezione)) throw new Error('Sezione non valida.');
  if (typeof id !== 'string' || /[\\/\x00]/.test(id) || !zainoValido(vault, id)) throw new Error('Apri uno zaino valido.');
  const dir = path.join(fs.realpathSync(vault), 'Zaini', id, sezione === 'appunti' ? 'APPUNTI' : sezione === 'mappe' ? 'MAPPE' : materiali.CARTELLA);
  verifica(path.join(path.dirname(dir), '_zaino.md'), 'file');
  verifica(dir, 'dir');
  return dir;
}
function nomiReali(dir, sezione) {
  if (sezione === 'appunti' || sezione === 'mappe') {
    if (!verifica(dir, 'dir')) return [];
    // Stessa selezione degli elenchi: le note ammettono nomi inizianti per punto, le mappe no.
    return fs.readdirSync(dir).sort().filter(f => !f.startsWith('_') &&
      (sezione === 'appunti' ? /\.md$/i.test(f) : !f.startsWith('.') && /\.json$/i.test(f)) && verifica(path.join(dir, f), 'file'));
  }
  const nomi = new Set();
  // Le cartelle storiche seguono la stessa regola di materiali.js; mai altri zaini o il corpus globale.
  const cartelle = new Set(['Media', 'Fonti'].flatMap((sub) => materiali.nomiInCorso(sub).concat(sub)));
  for (const nome of cartelle) {
    const sotto = path.join(dir, nome);
    if (!verifica(sotto, 'dir')) continue;
    for (const percorso of nome === 'PDF' ? materiali.cartellePdf(sotto) : [sotto]) {
      for (const f of fs.readdirSync(percorso).sort()) {
        if (f.startsWith('.') || !ESTENSIONI.has(path.extname(f).toLowerCase())) continue;
        if (verifica(path.join(percorso, f), 'file')) nomi.add(f);
      }
    }
  }
  if (sezione === 'media') {
    const foto = require('./album').elenco(path.resolve(dir, '../../..'), path.basename(path.dirname(dir)), 'foto');
    if (foto.error) throw new Error(foto.error);
    foto.voci.forEach(v => nomi.add('album:' + v.id));
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
// I vecchi registri hanno copiato gli stessi id nelle due sezioni. Si tolgono
// solo le copie vuote ancora omonime: gruppi distinti, rinominati o con file restano.
// Se entrambi sono vuoti, il gruppo storico appartiene a Fonti, dove era stato creato.
function separaVecchio(registro) {
  const risultato = { versione: 3 };
  for (const sezione of ['fonti', 'media']) {
    const stato = registro[sezione], altri = registro[sezione === 'fonti' ? 'media' : 'fonti'].gruppi;
    risultato[sezione] = { ...stato, gruppi: stato.gruppi.filter(g => {
      const copia = altri.find(a => a.id === g.id && a.nome === g.nome);
      return g.files.length || !copia || (sezione === 'fonti' && !copia.files.length);
    }) };
  }
  return risultato;
}
function leggiFile(file, singola) {
  if (!verifica(file, 'file')) return singola ? vuoto() : { versione: 3, fonti: vuoto(), media: vuoto() };
  const stato = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (formaValida(stato)) {
    if (singola) return stato;
    // La proprietà del gruppo segue i file storici, anche se oggi non sono più sul disco.
    const files = stato.gruppi.flatMap(g => g.files).concat(stato.liberi);
    const pdf = f => path.extname(f).toLowerCase() === '.pdf';
    return separaVecchio({
      fonti: gruppi.normalizza(stato, files.filter(pdf)),
      media: gruppi.normalizza(stato, files.filter(f => !pdf(f)))
    });
  }
  if (!singola && stato && [2, 3].includes(stato.versione) && formaValida(stato.fonti) && formaValida(stato.media)) {
    // La versione 3 fissa la separazione: svuotare un gruppo non lo cancellerà in futuro.
    return stato.versione === 2 ? separaVecchio(stato) : stato;
  }
  throw new Error('Il file dei gruppi ha un formato non valido.');
}
function fallito(e) { return { stato: null, error: 'Gruppi: ' + e.message }; }
function leggi(vault, id, sezione = 'fonti') {
  try {
    const dir = cartella(vault, id, sezione), singola = sezione === 'appunti' || sezione === 'mappe';
    const registro = leggiFile(path.join(dir, FILE), singola);
    return { stato: gruppi.normalizza(singola ? registro : registro[sezione], nomiReali(dir, sezione)), error: '' };
  } catch (e) { return fallito(e); }
}
function salva(vault, id, stato, sezione = 'fonti') {
  try {
    if (!formaValida(stato)) throw new Error('Lo stato dei gruppi non è valido.');
    const dir = cartella(vault, id, sezione), file = path.join(dir, FILE), singola = sezione === 'appunti' || sezione === 'mappe';
    // Si conserva anche l'altra sezione e si rifiuta un registro danneggiato.
    const registro = leggiFile(file, singola);
    const nuovo = gruppi.normalizza(stato, nomiReali(dir, sezione));
    const completo = singola ? nuovo : {
      versione: 3,
      fonti: sezione === 'fonti' ? nuovo : gruppi.normalizza(registro.fonti, nomiReali(dir, 'fonti')),
      media: sezione === 'media' ? nuovo : gruppi.normalizza(registro.media, nomiReali(dir, 'media'))
    };
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    const tmp = file + '.tmp-' + process.pid;
    if (verifica(tmp, 'file')) throw new Error('Esiste già un file temporaneo dei gruppi.');
    const scrivi = () => writeAtomic(file, JSON.stringify(completo, null, 2) + '\n');
    if (sezione === 'fonti') require('./cartelle-fonti').sincronizza(dir, registro.fonti, nuovo, scrivi);
    else scrivi();
    return { stato: nuovo, error: '' };
  } catch (e) { return fallito(e); }
}

module.exports = { FILE, leggi, salva };
