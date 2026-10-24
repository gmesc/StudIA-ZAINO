'use strict';
// Confine applicativo, non sandbox del sistema operativo. Le librerie e i test
// restano riusabili senza ambito: main/preload devono aprirne uno a ogni ingresso.
const nativo = require('node:fs');
const path = require('node:path');
const { fileURLToPath } = require('node:url');
const { AsyncLocalStorage } = require('node:async_hooks');
const ambiti = new AsyncLocalStorage(), descriptor = new Map();
const C = nativo.constants;
function vietato(motivo) {
  const errore = new Error('Accesso al disco negato: ' + motivo);
  errore.code = 'EACCES';
  return errore;
}
function assoluto(p) {
  if (p instanceof URL) p = fileURLToPath(p);
  if (Buffer.isBuffer(p)) p = p.toString();
  if (typeof p !== 'string' || !path.isAbsolute(p) || p.includes('\0')) throw vietato('percorso non assoluto.');
  return path.resolve(p);
}
function dentro(root, p) { return p === root || p.startsWith(root + path.sep); }
// Consente una destinazione ancora inesistente. La radice viene dall'utente o
// dal main; un'area interna va prima validata contro il vault con percorso().
function radice(p) {
  p = assoluto(p);
  const coda = [];
  while (true) {
    try { return path.join(nativo.realpathSync(p), ...coda.reverse()); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
    const padre = path.dirname(p);
    if (padre === p) throw vietato('radice inesistente.');
    coda.push(path.basename(p)); p = padre;
  }
}
function percorso(root, target) {
  const originale = assoluto(root), base = radice(originale), richiesto = assoluto(target);
  let p;
  if (dentro(originale, richiesto)) p = path.join(base, path.relative(originale, richiesto));
  else if (dentro(base, richiesto)) p = richiesto;
  else {
    // /var e /tmp su macOS sono alias di sistema. Si accetta un alias della
    // radice, mai un link trovato al suo interno, nemmeno se torna nel vault.
    let antenato = richiesto;
    while (true) {
      try {
        if (nativo.realpathSync(antenato) === base) {
          p = path.join(base, path.relative(antenato, richiesto)); break;
        }
      } catch (_) { /* il file potrebbe non esistere ancora */ }
      const padre = path.dirname(antenato);
      if (padre === antenato) break;
      antenato = padre;
    }
  }
  if (!p || !dentro(base, p)) throw vietato('percorso fuori dall’area autorizzata.');
  const rel = path.relative(base, p), parti = rel ? rel.split(path.sep) : [];
  let corrente = base;
  for (let i = -1; i < parti.length; i++) {
    if (i >= 0) corrente = path.join(corrente, parti[i]);
    let st;
    try { st = nativo.lstatSync(corrente); }
    catch (e) { if (e.code === 'ENOENT') continue; throw e; }
    if (st.isSymbolicLink()) throw vietato('collegamento simbolico nell’area autorizzata.');
    if (!st.isFile() && !st.isDirectory()) throw vietato('file speciale non consentito.');
    if (st.isFile() && st.nlink > 1) throw vietato('hard link non consentito.');
    if (i < parti.length - 1 && !st.isDirectory()) throw vietato('componente non cartella.');
  }
  return p;
}
function esegui(regole, fn) {
  if (!regole || typeof fn !== 'function') throw vietato('ambito non valido.');
  const prepara = key => {
    const roots = regole[key] || [];
    if (!Array.isArray(roots)) throw vietato('elenco delle aree non valido.');
    return roots.map(root => {
      if (regole.radice) percorso(regole.radice, root);
      return { originale: assoluto(root), canonica: radice(root) };
    });
  };
  return ambiti.run({ lettura: prepara('lettura'), scrittura: prepara('scrittura'), metadati: prepara('metadati') }, fn);
}
function corrente() {
  const ambito = ambiti.getStore();
  if (!ambito) return undefined;
  return Object.fromEntries(['lettura', 'scrittura', 'metadati'].map(key => [key, ambito[key].map(root => root.originale)]));
}
function verifica(p, modo = 'lettura') {
  if (!['lettura', 'scrittura', 'metadati'].includes(modo)) throw vietato('privilegio non valido.');
  return autorizza(p, modo === 'scrittura' ? true : modo === 'metadati' ? 'metadati' : false);
}
function autorizza(p, scrittura = false) {
  const ambito = ambiti.getStore();
  if (!ambito) return p;
  if (typeof p === 'number') return autorizzaFd(p, scrittura);
  const roots = scrittura === 'metadati' ? ambito.metadati.concat(ambito.lettura) : ambito[scrittura ? 'scrittura' : 'lettura'];
  for (const root of roots) {
    try {
      // Una radice sostituita dopo l'apertura dell'ambito non concede nuovi diritti.
      if (radice(root.originale) !== root.canonica) continue;
      return percorso(root.originale, p);
    } catch (e) { if (e.code !== 'EACCES' && e.code !== 'ENOENT') throw e; }
  }
  throw vietato((scrittura === 'metadati' ? 'metadati' : scrittura ? 'scrittura' : 'lettura') + ' fuori dalle aree consentite: ' + String(p));
}
function autorizzaFd(fd, scrittura) {
  const d = descriptor.get(fd);
  if (!d || !(scrittura === 'metadati' ? d.scrittura || d.lettura : scrittura ? d.scrittura : d.lettura)) throw vietato('descrittore non autorizzato.');
  autorizza(d.percorso, scrittura);
  const st = nativo.fstatSync(fd);
  if (!st.isFile() || st.nlink > 1 || st.dev !== d.dev || st.ino !== d.ino) throw vietato('descrittore cambiato o non regolare.');
  return fd;
}
function registraFd(fd, p, accesso) {
  const st = nativo.fstatSync(fd);
  descriptor.set(fd, { percorso: assoluto(p), ...accesso, dev: st.dev, ino: st.ino });
  return fd;
}
const FLAGS = {
  r: C.O_RDONLY, rs: C.O_RDONLY | C.O_SYNC, 'sr': C.O_RDONLY | C.O_SYNC,
  'r+': C.O_RDWR, 'rs+': C.O_RDWR | C.O_SYNC, 'sr+': C.O_RDWR | C.O_SYNC,
  w: C.O_WRONLY | C.O_CREAT | C.O_TRUNC, wx: C.O_WRONLY | C.O_CREAT | C.O_TRUNC | C.O_EXCL,
  'w+': C.O_RDWR | C.O_CREAT | C.O_TRUNC, 'wx+': C.O_RDWR | C.O_CREAT | C.O_TRUNC | C.O_EXCL,
  a: C.O_WRONLY | C.O_CREAT | C.O_APPEND, ax: C.O_WRONLY | C.O_CREAT | C.O_APPEND | C.O_EXCL,
  'a+': C.O_RDWR | C.O_CREAT | C.O_APPEND, 'ax+': C.O_RDWR | C.O_CREAT | C.O_APPEND | C.O_EXCL,
  as: C.O_WRONLY | C.O_CREAT | C.O_APPEND | C.O_SYNC,
  'as+': C.O_RDWR | C.O_CREAT | C.O_APPEND | C.O_SYNC
};
function apertura(p, flags) {
  if (flags === undefined) flags = 'r';
  const valore = typeof flags === 'number' ? flags : FLAGS[flags];
  if (valore === undefined) throw vietato('modalità di apertura non consentita.');
  const lettura = (valore & (C.O_WRONLY | C.O_RDWR)) !== C.O_WRONLY;
  const scrittura = !!(valore & (C.O_WRONLY | C.O_RDWR | C.O_CREAT | C.O_TRUNC | C.O_APPEND));
  if (lettura) p = autorizza(p);
  if (scrittura) p = autorizza(p, true);
  return { percorso: p, flags: valore | (ambiti.getStore() ? C.O_NOFOLLOW || 0 : 0), lettura, scrittura };
}
const LEGGI = new Set(['exists','stat','lstat','statfs','realpath','readdir','readFile','readlink','watch','watchFile','access']);
const METADATI = new Set(['exists','stat','lstat','statfs','realpath','access']);
const SCRIVI = new Set(['writeFile','appendFile','mkdir','mkdtemp','unlink','rmdir','rm','truncate','chmod','chown','utimes','lutimes']);
const FD_LEGGI = new Set(['read','readv','fstat']);
const FD_SCRIVI = new Set(['write','writev','ftruncate','fchmod','fchown','futimes','fsync','fdatasync']);
function visita(p, scrittura) {
  p = autorizza(p, scrittura);
  let st;
  try { st = nativo.lstatSync(p); } catch (e) { if (e.code === 'ENOENT') return; throw e; }
  if (st.isDirectory()) for (const nome of nativo.readdirSync(p)) visita(path.join(p, nome), scrittura);
}
function argomenti(nome, args) {
  if (!ambiti.getStore()) return args;
  args = [...args];
  if (LEGGI.has(nome)) {
    args[0] = autorizza(args[0], METADATI.has(nome) ? 'metadati' : false);
    if (nome === 'access' && (args[1] & C.W_OK)) autorizza(args[0], true);
    if (['watch', 'readdir'].includes(nome) && args[1]?.recursive) visita(args[0], false);
  } else if (SCRIVI.has(nome)) {
    const creaCartella = p => {
      // Si può creare soltanto la catena necessaria a un'area scrivibile;
      // osservare una cartella già esistente non attribuisce diritti sui file.
      const antenato=ambiti.getStore().scrittura.some(r=>r.canonica.startsWith(radice(p)+path.sep));
      const esiste=args[1]?.recursive && nativo.existsSync(p) && nativo.statSync(p).isDirectory();
      return antenato||esiste ? autorizza(p,'metadati') : autorizza(p,true);
    };
    args[0] = nome==='mkdir' ? creaCartella(args[0]) : autorizza(args[0], true);
    if (nome === 'mkdtemp') autorizza(path.dirname(args[0]), true);
    if (nome === 'mkdir' && args[1]?.recursive) {
      let padre = path.dirname(args[0]);
      while (!nativo.existsSync(padre)) { creaCartella(padre); const prima=padre;padre=path.dirname(padre);if(prima===padre)break; }
    }
    if (nome === 'rm' && args[1]?.recursive) visita(args[0], true);
  } else if (nome === 'copyFile') {
    args[0] = autorizza(args[0]); args[1] = autorizza(args[1], true);
  } else if (nome === 'rename') {
    args[0] = autorizza(args[0], true); args[1] = autorizza(args[1], true);
    visita(args[0], true);
  } else if (FD_LEGGI.has(nome)) autorizzaFd(args[0], nome === 'fstat' ? 'metadati' : false);
  else if (FD_SCRIVI.has(nome)) autorizzaFd(args[0], true);
  else if (nome === 'close') {
    if (!descriptor.has(args[0])) throw vietato('descrittore sconosciuto.');
  } else if (nome === 'unwatchFile') args[0] = autorizza(args[0]);
  else throw vietato('operazione non consentita: ' + nome);
  return args;
}
function maniglia(handle, info) {
  registraFd(handle.fd, info.percorso, info);
  const leggi = new Set(['read','readv','readFile','stat']);
  const scrivi = new Set(['write','writev','writeFile','appendFile','truncate','chmod','chown','utimes','sync','datasync']);
  const fd = handle.fd;
  return new Proxy(handle, {
    get(target, prop) {
      if (prop === 'fd') return fd;
      if (prop === 'then') return undefined;
      if (prop === 'close' || prop === Symbol.asyncDispose) return async () => {
        try { return await target.close(); } finally { descriptor.delete(fd); }
      };
      if (leggi.has(prop) || scrivi.has(prop)) return async (...args) => {
        if (ambiti.getStore()) autorizzaFd(fd, prop === 'stat' ? 'metadati' : scrivi.has(prop));
        return target[prop](...args);
      };
      if (ambiti.getStore()) throw vietato('operazione del descrittore non consentita.');
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    }
  });
}
const promiseCache = new Map();
const promises = new Proxy({}, { get(_, nome) {
  if (promiseCache.has(nome)) return promiseCache.get(nome);
  const fn = async (...args) => {
    if (nome === 'open') {
      const info = apertura(args[0], args[1]);
      const handle = await nativo.promises.open(info.percorso, info.flags, args[2]);
      return maniglia(handle, info);
    }
    args = argomenti(nome, args);
    if (typeof nativo.promises[nome] !== 'function') throw vietato('operazione non disponibile.');
    return nativo.promises[nome](...args);
  };
  promiseCache.set(nome, fn); return fn;
} });
const cache = new Map();
const fs = new Proxy({}, { get(_, nome) {
  if (nome === 'constants') return C;
  if (nome === 'promises') return promises;
  if (cache.has(nome)) return cache.get(nome);
  if (typeof nativo[nome] !== 'function') {
    if (ambiti.getStore()) throw vietato('proprietà filesystem non disponibile.');
    return nativo[nome];
  }
  const fn = (...args) => {
    const sync = typeof nome === 'string' && nome.endsWith('Sync');
    const base = sync ? nome.slice(0, -4) : nome;
    if (base === 'open') {
      const info = apertura(args[0], args[1]);
      if (sync) return registraFd(nativo.openSync(info.percorso, info.flags, args[2]), info.percorso, info);
      const cb = args.at(-1), mode = typeof args[2] === 'function' ? undefined : args[2];
      return nativo.open(info.percorso, info.flags, mode, (err, fd) => {
        if (!err) registraFd(fd, info.percorso, info);
        cb(err, fd);
      });
    }
    if (base === 'createReadStream' || base === 'createWriteStream') {
      const scrittura = base === 'createWriteStream', opts = args[1];
      if (ambiti.getStore() && opts?.fs) throw vietato('filesystem alternativo non consentito.');
      if (opts?.fd !== undefined && opts.fd !== null) {
        if (ambiti.getStore()) autorizzaFd(opts.fd, scrittura);
      } else args[0] = autorizza(args[0], scrittura);
      if (ambiti.getStore()) args[1] = { ...opts, fs };
      return nativo[nome](...args);
    }
    const checked = argomenti(base, args);
    if (base === 'close') {
      if (sync) { try { return nativo[nome](...checked); } finally { descriptor.delete(args[0]); } }
      const cb = checked.at(-1);
      checked[checked.length - 1] = err => { descriptor.delete(args[0]); cb(err); };
    }
    return nativo[nome](...checked);
  };
  cache.set(nome, fn); return fn;
} });
module.exports = { fs, esegui, percorso, verifica, corrente };
