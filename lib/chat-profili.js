'use strict';

// Preferenze didattiche dichiarate dalla persona, mai diagnosi o valutazioni.
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const CAMPI = {
  lettura: ['semplice', 'standard', 'avanzata'],
  caricoCognitivo: ['ridotto', 'moderato', 'alto'],
  conoscenze: ['principiante', 'intermedio', 'esperto'],
  stile: ['passo-passo', 'dialogo', 'schema', 'analogie'],
  lunghezza: ['breve', 'media', 'dettagliata'],
  esempi: ['quotidiani', 'visivi-descritti', 'tecnici', 'nessuno'],
  verifiche: ['frequenti', 'alla-fine', 'su-richiesta']
};
const BASE = { nome: 'Equilibrato', lettura: 'standard', caricoCognitivo: 'moderato',
  conoscenze: 'intermedio', lingua: 'Italiano', stile: 'passo-passo', lunghezza: 'media',
  esempi: 'quotidiani', verifiche: 'alla-fine', preferenze: '' };
const PRESET = [
  { ...BASE, id: 'equilibrato' },
  { ...BASE, id: 'eli5', nome: "Explain like I'm 5", lettura: 'semplice',
    caricoCognitivo: 'ridotto', conoscenze: 'principiante', lunghezza: 'breve',
    preferenze: 'Usa parole comuni e un esempio concreto alla volta. Semplifica senza infantilizzare.' },
  { ...BASE, id: 'feynman', nome: 'Mr Feynman', stile: 'analogie', verifiche: 'frequenti',
    preferenze: 'Parti da un esempio intuitivo, chiarisci perché funziona e chiedimi di rispiegarlo con parole mie. Indica i limiti delle analogie.' }
];

function identificatore(id) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new Error('Identificatore del profilo non valido.');
  return id;
}

// La radice può essere quella scelta dall'utente tramite un alias; al suo interno
// nessun link simbolico è attraversato. O_NOFOLLOW protegge anche le foglie.
function percorsoSicuro(vault, parti, crea = false) {
  if (typeof vault !== 'string' || !path.isAbsolute(vault)) throw new Error('Vault non valido.');
  let corrente = fs.realpathSync(vault);
  if (!fs.statSync(corrente).isDirectory()) throw new Error('Vault non valido.');
  for (let i = 0; i < parti.length; i++) {
    const parte = parti[i];
    if (typeof parte !== 'string' || !parte || parte === '.' || parte === '..' || /[/\\\x00]/.test(parte)) throw new Error('Percorso non valido.');
    corrente = path.join(corrente, parte);
    let st;
    try { st = fs.lstatSync(corrente); }
    catch (e) {
      if (e.code !== 'ENOENT') throw e;
      if (crea && i < parti.length - 1) {
        fs.mkdirSync(corrente); st = fs.lstatSync(corrente);
      } else continue;
    }
    if (st.isSymbolicLink()) throw new Error('Collegamento simbolico non consentito nel vault.');
    if (i < parti.length - 1 && !st.isDirectory()) throw new Error('Cartella del vault non valida.');
  }
  return corrente;
}

function leggiFileSicuro(vault, parti, maxBytes = 4 * 1024 * 1024) {
  const file = percorsoSicuro(vault, parti);
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try {
    const st = fs.fstatSync(fd);
    if (!st.isFile()) throw new Error('Il percorso non è un file.');
    if (st.size > maxBytes) throw new Error('File troppo grande per la chat.');
    return fs.readFileSync(fd);
  } finally { fs.closeSync(fd); }
}

function scriviAtomico(vault, parti, testo) {
  const file = percorsoSicuro(vault, parti, true);
  const tmpParti = [...parti.slice(0, -1), '.' + parti.at(-1) + '.tmp-' + randomUUID()];
  const tmp = percorsoSicuro(vault, tmpParti);
  let fd;
  try {
    fd = fs.openSync(tmp, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW || 0), 0o600);
    fs.writeFileSync(fd, testo, 'utf8'); fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined;
    percorsoSicuro(vault, parti);
    fs.renameSync(tmp, file);
  } catch (e) {
    if (fd !== undefined) fs.closeSync(fd);
    try { fs.unlinkSync(tmp); } catch (_) {}
    throw e;
  }
}

function valida(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Profilo non valido.');
  const p = { id: identificatore(input.id || randomUUID()) };
  for (const [campo, max] of Object.entries({ nome: 80, lingua: 40, preferenze: 1200 })) {
    const valore = input[campo] === undefined ? BASE[campo] : input[campo];
    if (typeof valore !== 'string' || valore.length > max || (campo !== 'preferenze' && !valore.trim())) throw new Error('Campo del profilo non valido: ' + campo);
    p[campo] = valore.trim();
  }
  for (const [campo, valori] of Object.entries(CAMPI)) {
    p[campo] = input[campo] === undefined ? BASE[campo] : input[campo];
    if (!valori.includes(p[campo])) throw new Error('Campo del profilo non valido: ' + campo);
  }
  return p;
}

const PARTI = ['.studia', 'chat-profili.json'];
function leggi(vault) {
  let raw;
  try { raw = leggiFileSicuro(vault, PARTI); }
  catch (e) {
    if (e.code === 'ENOENT') return { profiles: PRESET.map((p) => ({ ...p })), activeId: 'equilibrato' };
    throw e;
  }
  const data = JSON.parse(raw.toString('utf8'));
  if (!Array.isArray(data.profiles) || !data.profiles.length || data.profiles.length > 100) throw new Error('Archivio dei profili non valido.');
  const profiles = data.profiles.map(valida);
  if (new Set(profiles.map((p) => p.id)).size !== profiles.length) throw new Error('Profili duplicati nell’archivio.');
  if (!profiles.some((p) => p.id === data.activeId)) throw new Error('Profilo attivo non trovato.');
  return { profiles, activeId: data.activeId };
}
function scrivi(vault, data) {
  scriviAtomico(vault, PARTI, JSON.stringify({ version: 1, ...data }, null, 2) + '\n');
  return data;
}
function salva(vault, input) {
  const p = valida(input), data = leggi(vault);
  const i = data.profiles.findIndex((x) => x.id === p.id);
  if (i < 0) {
    if (data.profiles.length >= 100) throw new Error('Limite di 100 profili raggiunto.');
    data.profiles.push(p);
  } else data.profiles[i] = p;
  return scrivi(vault, data);
}
function clona(vault, id) {
  const data = leggi(vault), p = data.profiles.find((x) => x.id === identificatore(id));
  if (!p) throw new Error('Profilo non trovato.');
  if (data.profiles.length >= 100) throw new Error('Limite di 100 profili raggiunto.');
  const copia = { ...p, id: randomUUID(), nome: p.nome.slice(0, 72) + ' (copia)' };
  data.profiles.push(copia); data.activeId = copia.id;
  return scrivi(vault, data);
}
function elimina(vault, id) {
  const data = leggi(vault); identificatore(id);
  if (!data.profiles.some((p) => p.id === id)) throw new Error('Profilo non trovato.');
  if (data.profiles.length === 1) throw new Error('Conserva almeno un profilo.');
  data.profiles = data.profiles.filter((p) => p.id !== id);
  if (data.activeId === id) data.activeId = data.profiles[0].id;
  return scrivi(vault, data);
}
function attiva(vault, id) {
  const data = leggi(vault); identificatore(id);
  if (!data.profiles.some((p) => p.id === id)) throw new Error('Profilo non trovato.');
  data.activeId = id; return scrivi(vault, data);
}

module.exports = { CAMPI, PRESET, valida, leggi, salva, clona, elimina, attiva,
  percorsoSicuro, leggiFileSicuro, scriviAtomico };
