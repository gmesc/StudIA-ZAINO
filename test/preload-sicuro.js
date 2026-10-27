'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');
const S = require('../lib/vault-sincrono');
const build = require('../bin/preload');
const disco = require('../lib/permessi-disco');
const v = fs.mkdtempSync(path.join(os.tmpdir(), 'zaino-preload-sicuro-'));
try {
  require('../lib/zaini').crea(v, 'Scienze');
  const ask = (gruppo, metodo, ...args) => S.esegui(v, gruppo, metodo, args);
  assert(ask('fs', 'readFileSync', '/etc/passwd').error, 'Nessuna API filesystem generica');
  assert(ask('__proto__', 'toString').error, 'Nessun metodo ereditato');
  assert(ask('notes', 'save', '../fuori', '', {title:'No'}, 'No').error, 'Contenitore esterno rifiutato');
  assert(ask('notes', 'save', 'scienze', '../../fuori.md', {title:'No'}, 'No').error, 'File esterno rifiutato');
  const saved = ask('notes', 'save', 'scienze', '', {title:'Appunto'}, 'Testo conservato');
  assert(!saved.error, saved.error);
  assert.equal(ask('notes', 'leggi', 'scienze').notes[0].body, 'Testo conservato\n');
  assert(!ask('notes', 'rename', 'scienze', saved.file, 'Nuovo titolo').error);
  assert.equal(ask('notes', 'leggi', 'scienze').notes[0].title, 'Nuovo titolo');
  assert.equal(ask('album', 'heic', '/etc/passwd').dati, '');
  assert(ask('album', 'heic', '/etc/passwd').error, 'HEIC richiede grant esplicito');
  assert.equal(ask('materiali', 'srcUrl', '../segreto.pdf', 'scienze'), '');
  const txt = path.join(v, 'Zaini/scienze/MATERIALI/PDF/0001 - finto.pdf');
  fs.mkdirSync(path.dirname(txt), {recursive:true}); fs.writeFileSync(txt, '<script>bad</script>');
  assert.equal(ask('materiali', 'srcUrl', path.basename(txt), 'scienze'), '', 'Anche apertura verifica firma');
  const lettura = {lettura:[v],scrittura:[],metadati:[v]};
  assert(disco.esegui(lettura,()=>ask('prefs','save',{voce:'x'})).error,'Sola lettura non salva preferenze');
  assert(!disco.esegui({lettura:[v],scrittura:[path.join(v,'Zaini/scienze/APPUNTI')],metadati:[v]},()=>ask('notes','save','scienze','',{title:'Secondo'},'Salvato nel suo ambito')).error);
  const fuori=path.join(v,'esterno.md'), link=path.join(v,'Zaini/scienze/APPUNTI/link.md');
  fs.writeFileSync(fuori,'Intatto');fs.symlinkSync(fuori,link);
  assert(disco.esegui({lettura:[v],scrittura:[path.join(v,'Zaini/scienze/APPUNTI')],metadati:[v]},()=>ask('notes','save','scienze','link.md',{title:'No'},'No')).error,'Symlink non scrivibile');
  assert.equal(fs.readFileSync(fuori,'utf8'),'Intatto');fs.unlinkSync(link);
  const built = build.genera();
  assert.equal(fs.readFileSync(path.join(__dirname, '../preload.js'), 'utf8'), built, 'Preload generato aggiornato');
  let api, grants = 0; const realFile = {};
  const ipc = {invoke:async()=>({}), send(){}, on(){}, removeListener(){}, sendSync(channel, data) {
    if(channel === 'cfg:get') return {vaultPath:v};
    if(channel === 'file:selezionato'){grants++;return {ok:true,cartella:false};}
    if(channel === 'file:verifica') return {ok:false,error:'PDF contraffatto',cartella:false};
    if(channel === 'vault:sync') return S.esegui(v,data.gruppo,data.metodo,data.args);
    throw new Error(channel);
  }};
  vm.runInNewContext(built, {require(name) {assert.equal(name, 'electron', 'Solo Electron nel preload sandbox'); return {
    contextBridge:{exposeInMainWorld(name,value){assert.equal(name,'vault');api=value;}}, ipcRenderer:ipc,
    webUtils:{getPathForFile(file){if(file!==realFile) throw new Error('Non è un File');return txt;}}
  };}, console});
  assert.equal(api.fonti.percorsoDi('/etc/passwd'), ''); assert.equal(grants,0);
  assert.equal(api.fonti.percorsoDi(realFile),txt); assert.equal(grants,1);
  assert.equal(api.fonti.eCartella(realFile),false);
  assert.equal(api.fonti.verifica('/etc/passwd').ok,false);
  assert.equal(api.fonti.verifica(realFile).error,'PDF contraffatto');
  assert(api.notes.leggi('scienze').notes.some(n=>n.body==='Testo conservato\n'));
  assert.equal(typeof api.chat.saveAnswer,'function'); assert.equal(typeof api.rag.watch,'function'); assert.equal(typeof api.studio.copyCard,'function');assert.equal(typeof api.studio.removeCards,'function');assert.equal(typeof api.studio.undoRemoveCards,'function');
  assert.deepEqual(api.profile.read(),{});
  console.log('OK: preload sandbox, whitelist sincrona, note conservate e grant solo da File.');
} finally {fs.rmSync(v,{recursive:true,force:true});}
