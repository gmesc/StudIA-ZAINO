'use strict';
// Il confine del fork vive anche fuori dal DOM: nessun comando CORSI viene registrato.
const fs = require('fs');
const path = require('path');
const zaini = require('./zaini');
const ESCLUSI = new Set(['course', 'brief', 'plan', 'ingest', 'schede', 'scaletta', 'scalette', 'composer', 'percorsi', 'expand', 'gen', 'ocr', 'claudecode', 'models', 'files', 'import']);
const errore = () => ({ ok: false, error: 'Funzione CORSI non disponibile in StudIA - ZAINO.' });
function consentito(canale) { return !ESCLUSI.has(canale.split(':')[0]) && !['fonti:set', 'media:list'].includes(canale); }
function zainoValido(vault, id) {
  if (!zaini.esiste(vault, id)) return false;
  try {
    const root = fs.realpathSync(vault);
    const dir = path.join(root, 'Zaini', id);
    return fs.realpathSync(dir) === dir && fs.realpathSync(require('./corsi').cartella(root, id)) === dir;
  } catch (_) { return false; }
}
function proteggiIpc(ipc, vaultDir) {
  const handle = ipc.handle.bind(ipc), on = ipc.on.bind(ipc);
  ipc.handle = (canale, fn) => {
    if (!consentito(canale)) return handle(canale, () => canale === 'course:list' ? [] : errore());
    return handle(canale, (e, o, ...rest) => {
      if (o && typeof o === 'object' && Object.hasOwn(o, 'corso') && !zainoValido(vaultDir(), o.corso)) {
        return { ok: false, error: 'Apri uno zaino valido.' };
      }
      return fn(e, o, ...rest);
    });
  };
  ipc.on = (canale, fn) => consentito(canale) ? on(canale, fn) : ipc;
}
function proteggiPreload(api, vault) {
  // Gli adattatori vuoti mantengono compatibile il guscio condiviso, senza accesso a pipeline o corsi.
  for (const nome of ['schede','plan','ingest','course','brief','claudecode','modelli','scaletta','composer','percorsi','gen','files','cartella','ocr']) {
    if (!api[nome]) continue;
    for (const metodo of Object.keys(api[nome])) {
      api[nome][metodo] = metodo.startsWith('on') ? () => () => {} : () => Promise.resolve(errore());
    }
  }
  api.course.list = async () => [];
  api.percorsi.list = async () => [];
  api.profile = { read: () => ({}), save: errore };
  api.onboarding.stato = async () => ({ fatto: true, profiloSaltato: true, pipelineVista: true });
  api.ambiente.rileva = async () => ({});
  api.lessons = []; api.courses = []; api.mediaByNum = {}; api.pdfByNum = {};
  for (const nome of ['notes', 'evidenze', 'album', 'mappe']) {
    for (const [metodo, fn] of Object.entries(api[nome])) {
      if (typeof fn !== 'function' || ['identita','percorsoDi','heic','heicDisponibile'].includes(metodo)) continue;
      api[nome][metodo] = (id, ...args) => {
        if (!zainoValido(vault, id)) return { ok: false, error: 'Apri uno zaino valido.', notes: [], voci: [], mappe: [], evidenze: [], strati: [] };
        return fn(id, ...args);
      };
    }
  }
  const src = api.srcUrl;
  api.srcUrl = (file, id) => zainoValido(vault, id) ? src(file, id) : '';
}
module.exports = { consentito, zainoValido, proteggiIpc, proteggiPreload };
