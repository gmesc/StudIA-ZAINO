'use strict';
// Il registro è durevole: ricostruire il recupero non cambia le fonti delle vecchie risposte.
const fs = require('./permessi-disco').fs;
const { createHash, randomUUID } = require('node:crypto');
const { percorsoSicuro, leggiFileSicuro, scriviAtomico } = require('./chat-profili');
const ID = /^[a-zA-Z0-9_-]{1,100}$/;
const ESTENSIONI = /\.(pdf|txt|text|md|markdown|csv|tsv)$/i;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function parti(zaino) {
  if (typeof zaino !== 'string' || !zaino || zaino.startsWith('.') || /[/\\\x00]/.test(zaino)) throw new Error('Zaino non valido.');
  return ['Zaini', zaino];
}
function verifica(vault, zaino) { leggiFileSicuro(vault, [...parti(zaino), '_zaino.md']); }
function identita(vault,zaino){verifica(vault,zaino);const st=fs.statSync(percorsoSicuro(vault,parti(zaino)));return JSON.stringify([fs.realpathSync(vault),st.dev,st.ino]);}
function verificaIdentita(vault,zaino,prima){if(identita(vault,zaino)!==prima)throw Error('Lo zaino è cambiato durante l’operazione.');}
function ambito(value) {
  if (value === undefined) return { mode: 'all', sourceIds: [], wikipedia: true };
  if (!value || !['all', 'selected'].includes(value.mode) || !Array.isArray(value.sourceIds) || value.sourceIds.length > 1000 || value.sourceIds.some(id => typeof id !== 'string' || !ID.test(id)) || (value.wikipedia !== undefined && typeof value.wikipedia !== 'boolean')) throw new Error('Ambito delle fonti non valido.');
  return { mode: value.mode, sourceIds: value.mode === 'all' ? [] : [...new Set(value.sourceIds)].sort(), wikipedia: value.wikipedia === true };
}
function registro(vault, zaino) {
  verifica(vault, zaino);
  let raw;
  try { raw = leggiFileSicuro(vault, [...parti(zaino), '_fonti-ai.json'], 8 * 1024 * 1024); }
  catch (e) { if (e.code === 'ENOENT') return { version: 1, sources: [] }; throw e; }
  const data = JSON.parse(raw);
  if (data.version !== 1 || !Array.isArray(data.sources) || data.sources.some(s => !s || !ID.test(s.id) || typeof s.file !== 'string' || typeof s.revision !== 'string')) throw new Error('Il registro delle fonti non è leggibile.');
  return data;
}
function sincronizza(vault, zaino) {
  const data = registro(vault, zaino), prima = JSON.stringify(data), files = [], warnings = [], unavailable = new Set();
  let limited=false;
  function visita(rel, depth = 0) {
    if (depth > 8 || files.length >= 1000) { limited=true; warnings.push('Inventario limitato a 1000 fonti e 8 livelli.'); return; }
    let entries;
    try { entries = fs.readdirSync(percorsoSicuro(vault, [...parti(zaino), ...rel]), { withFileTypes: true }); }
    catch (e) { if (e.code === 'ENOENT') return; throw e; }
    for (const e of entries.sort((a,b) => a.name.localeCompare(b.name))) {
      if (e.name.startsWith('.') || e.name.startsWith('_') || ['Indici-PDF', 'Trascrizioni', 'Analisi', 'Indici'].includes(e.name)) continue;
      const next = [...rel, e.name], file = next.join('/');
      if (e.isSymbolicLink()) { warnings.push('Collegamento simbolico escluso: ' + file); continue; }
      if (e.isDirectory()) visita(next, depth + 1);
      else if (e.isFile() && ESTENSIONI.test(e.name) && files.length < 1000) {
        try {
          const st = fs.statSync(percorsoSicuro(vault, [...parti(zaino), ...next]));
          const inode=String(st.dev)+':'+String(st.ino), old=data.sources.find(s=>!s.removed && s.file===file);
          const same=old && old.inode===inode && old.size===st.size && old.mtime===st.mtimeMs && old.ctime===st.ctimeMs;
          const revision=same?old.revision:hash(leggiFileSicuro(vault,[...parti(zaino),...next],/\.pdf$/i.test(file)?40*1024*1024:2*1024*1024));
          files.push({file,revision,inode,kind:/\.pdf$/i.test(file)?'pdf':rel[0]==='APPUNTI'?'appunto':'testo',size:st.size,mtime:st.mtimeMs,ctime:st.ctimeMs});
        } catch (e) { unavailable.add(file); warnings.push(file + ': ' + e.message); }
      }
    }
  }
  visita(['APPUNTI']); visita(['MATERIALI']);
  const paths = new Set(files.map(f => f.file)), used = new Set();
  for (const f of files) {
    let old = data.sources.find(s => !s.removed && s.file === f.file);
    if (!old) {
      // Una rinomina si riconosce solo se univoca; una lapide non si riusa per una nuova fonte.
      const precedenti = data.sources.filter(s => !s.removed && !paths.has(s.file) && !used.has(s.id));
      const stessoFile = precedenti.filter(s => s.inode === f.inode);
      // Lo spostamento fra gruppi conserva l'inode anche con due copie identiche del PDF.
      if (stessoFile.length === 1 && files.filter(x => x.inode === f.inode).length === 1) old = stessoFile[0];
      else {
        const candidates = precedenti.filter(s => s.revision === f.revision);
        if (candidates.length === 1 && files.filter(x => x.revision === f.revision).length === 1) old = candidates[0];
      }
    }
    if (!old) { old = { id: randomUUID() }; data.sources.push(old); }
    Object.assign(old, f, { removed: false, unavailable:false }); used.add(old.id);
  }
  for (const s of data.sources) if (!used.has(s.id)) { if(unavailable.has(s.file)||limited)s.unavailable=true;else s.removed=true; }
  if (JSON.stringify(data) !== prima) scriviAtomico(vault, [...parti(zaino), '_fonti-ai.json'], JSON.stringify(data, null, 2) + '\n');
  return { sources: data.sources.filter(s => !s.removed && !s.unavailable).map(s => ({ ...s })), warnings };
}
function risolvi(vault, zaino, snapshot) {
  if (!snapshot || !ID.test(snapshot.id || snapshot.sourceId || '')) throw new Error('Riferimento alla fonte non valido.');
  const data = sincronizza(vault, zaino);
  const source = data.sources.find(s => s.id === (snapshot.sourceId || snapshot.id));
  if (!source) return { status: 'removed', quote: snapshot.quote || '' };
  if (source.revision !== snapshot.revision) return { status: 'changed', quote: snapshot.quote || '', title: source.file };
  return { status: 'available', source, quote: snapshot.quote || '', page: snapshot.page, offset: snapshot.offset };
}
module.exports = { identita,verificaIdentita,hash, parti, verifica, ambito, registro, sincronizza, risolvi };
