'use strict';
const path=require('node:path'),{randomUUID}=require('node:crypto');
const D=require('./permessi-disco'),fs=D.fs,F=require('./fonti-ai'),A=require('./appunti');
const M=require('../App/assets/presentazioni/modello'),V=require('./validate');
const CARTELLA='PRESENTAZIONI',MAX=8*1024*1024,ID=/^[a-f0-9-]{36}$/;
const coda=require('./appunti-coda').crea();
function directory(v,z,id){F.verifica(v,z);const parti=[...F.parti(z),CARTELLA];if(id!==undefined){if(!ID.test(id))throw Error('Presentazione non valida.');parti.push(id);}return D.percorso(v,path.join(v,...parti));}
function file(v,z,id,nome='presentazione.json'){return D.percorso(v,path.join(directory(v,z,id),nome));}
function verifica(d,z,id){
 const r=V.validatePresentazione(d);if(!r.ok)throw Error('Presentazione non valida: '+r.errors.join('; '));
 if(d.zainoId!==z||d.id!==id)throw Error('La presentazione appartiene a un altro contesto.');
 if(Buffer.byteLength(JSON.stringify(d))>MAX)throw Error('Presentazione troppo grande (massimo 8 MiB di testo).');return d;
}
function leggiJson(p){const st=fs.statSync(p);if(st.size>MAX)throw Error('Documento troppo grande.');return JSON.parse(fs.readFileSync(p,'utf8'));}
function leggi(v,z,id){return verifica(leggiJson(file(v,z,id)),require('./citazioni-zaini').identita(v,z),id);}
function elenco(v,z){
 const dir=directory(v,z);if(!fs.existsSync(dir))return [];
 return fs.readdirSync(dir,{withFileTypes:true}).filter(e=>!e.name.startsWith('.')).map(e=>{
  if(e.isSymbolicLink()||!e.isDirectory()||!ID.test(e.name))throw Error('Archivio PRESENTA non valido: '+e.name);
  try{const d=leggi(v,z,e.name);return {id:d.id,title:d.title,revision:d.revision,slides:M.posizioni(d).length};}
  catch(err){throw Error('Impossibile aprire la presentazione '+e.name+': '+err.message);}
 }).sort((a,b)=>a.title.localeCompare(b.title,'it'));
}
function accoda(v,z,id,fn){const dir=directory(v,z,id);const identita=F.identita(v,z);return coda.esegui(dir,id,()=>{F.verificaIdentita(v,z,identita);return fn();});}
async function crea(v,z,title){
 const zainoId=require('./citazioni-zaini').identita(v,z,true),d=M.crea(zainoId,title,randomUUID);verifica(d,zainoId,d.id);
 return accoda(v,z,d.id,async()=>{
  const dir=directory(v,z,d.id);await fs.promises.mkdir(path.dirname(dir),{recursive:true});await fs.promises.mkdir(dir);
  try{d.revision=1;await A.writeAtomicAsync(file(v,z,d.id),JSON.stringify(d,null,2)+'\n');return d;}
  catch(err){try{await fs.promises.rmdir(dir);}catch(_){}throw err;}
 });
}
function verificaRisorse(v,z,d){
 for(const id of M.risorseUsate(d)){const a=d.assets[id],p=D.percorso(v,path.join(directory(v,z,d.id),a.path)),st=fs.statSync(p);if(!st.isFile()||st.size!==a.size)throw Error('Risorsa mancante o cambiata: '+id);}
}
async function salva(v,z,documento,baseRevision){
 const d=M.copia(documento);verifica(d,require('./citazioni-zaini').identita(v,z),d.id);
 if(!Number.isSafeInteger(baseRevision)||baseRevision<1||d.revision!==baseRevision)throw Error('Revisione di partenza non valida.');
 return accoda(v,z,d.id,async()=>{
  const precedente=leggi(v,z,d.id);if(precedente.revision!==baseRevision)throw Error('La presentazione è cambiata: conserva la bozza e riapri l’ultima revisione.');
  verificaRisorse(v,z,d);if(baseRevision===Number.MAX_SAFE_INTEGER)throw Error('Revisione esaurita.');d.revision=baseRevision+1;
  // Anche l'ultima copia valida resta recuperabile; un errore non altera il documento corrente.
  await A.writeAtomicAsync(file(v,z,d.id,'_precedente.json'),JSON.stringify(precedente,null,2)+'\n');
  await A.writeAtomicAsync(file(v,z,d.id),JSON.stringify(d,null,2)+'\n');return d;
 });
}
async function bozza(v,z,documento,baseRevision){
 const d=M.copia(documento);verifica(d,require('./citazioni-zaini').identita(v,z),d.id);
 if(!Number.isSafeInteger(baseRevision)||d.revision!==baseRevision)throw Error('Revisione della bozza non valida.');
 return accoda(v,z,d.id,async()=>{leggi(v,z,d.id);verificaRisorse(v,z,d);await A.writeAtomicAsync(file(v,z,d.id,'_bozza.json'),JSON.stringify({baseRevision,documento:d},null,2)+'\n');return {baseRevision};});
}
function recupera(v,z,id){
 const p=file(v,z,id,'_bozza.json');if(!fs.existsSync(p))return null;const b=leggiJson(p);verifica(b.documento,require('./citazioni-zaini').identita(v,z),id);
 if(b.baseRevision!==b.documento.revision)throw Error('Bozza non valida.');return b;
}
function precedente(v,z,id){return verifica(leggiJson(file(v,z,id,'_precedente.json')),require('./citazioni-zaini').identita(v,z),id);}
function elimina(v,z,id,cestina){
 if(typeof cestina!=='function')throw Error('Cestino di sistema non disponibile.');
 return accoda(v,z,id,async()=>{leggi(v,z,id);const p=directory(v,z,id);D.verifica(p,'scrittura');await cestina(p);return {id};});
}
module.exports={CARTELLA,MAX,directory,file,verifica,leggi,elenco,accoda,crea,salva,bozza,recupera,precedente,elimina,verificaRisorse};
