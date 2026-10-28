'use strict';
const path=require('node:path'),{randomUUID}=require('node:crypto'),{pathToFileURL}=require('node:url');
const D=require('./permessi-disco'),fs=D.fs,M=require('../App/assets/lim/modello'),F=require('./fonti-ai'),A=require('./appunti');
const ID=/^[0-9a-f-]{36}$/;
function directory(v,z){F.verifica(v,z);return D.percorso(v,path.join(v,...F.parti(z),'LIM'));}
function file(v,z,id,cestino=false){if(!ID.test(id))throw Error('Lavagnata non valida.');return D.percorso(v,path.join(directory(v,z),...(cestino?['_cestino']:[]),id+'.excalidraw'));}
function leggi(v,z,id,cestino=false){const p=file(v,z,id,cestino);if(fs.statSync(p).size>65*1024*1024)throw Error('Lavagnata troppo grande.');const r=JSON.parse(fs.readFileSync(p,'utf8'));if(r.type!=='excalidraw'||r.studia?.id!==id)throw Error('Lavagnata illeggibile.');return {...M.scena(r),studia:r.studia};}
function titolo(t){if(typeof t!=='string'||!t.trim()||t.length>140)throw Error('Scrivi un titolo fra 1 e 140 caratteri.');return t.trim();}
function scrivi(v,z,d){const p=file(v,z,d.studia.id);fs.mkdirSync(path.dirname(p),{recursive:true});A.writeAtomic(p,JSON.stringify({type:'excalidraw',version:2,source:'StudIA ZAINO',...d},null,2)+'\n');return d;}
function elenco(v,z){const dir=directory(v,z);if(!fs.existsSync(dir))return [];return fs.readdirSync(dir).filter(n=>n.endsWith('.excalidraw')).map(n=>leggi(v,z,n.slice(0,-11)).studia).sort((a,b)=>a.title.localeCompare(b.title,'it'));}
function prossimoNumero(v,z){
 const dir=directory(v,z),registro=D.percorso(v,path.join(dir,'_sequenza.json'));let numero=0;
 if(fs.existsSync(registro)){numero=JSON.parse(fs.readFileSync(registro,'utf8')).ultimo;if(!Number.isSafeInteger(numero)||numero<0)throw Error('Progressivo delle lavagne illeggibile.');}
 // Il registro non torna indietro con rinomina, cestino o cambio di data.
 for(const cestino of [false,true]){const cartella=cestino?path.join(dir,'_cestino'):dir;if(!fs.existsSync(cartella))continue;
  for(const n of fs.readdirSync(cartella).filter(n=>n.endsWith('.excalidraw'))){const s=leggi(v,z,n.slice(0,-11),cestino).studia,usato=s.numero||Number(/^LAVAGNA (\d+) \[/.exec(s.title)?.[1])||0;numero=Math.max(numero,usato);}
 }
 if(!Number.isSafeInteger(numero+1))throw Error('Progressivo delle lavagne esaurito.');
 fs.mkdirSync(dir,{recursive:true});A.writeAtomic(registro,JSON.stringify({ultimo:numero+1})+'\n');return numero+1;
}
function comando(v,z,o){
 switch(o.azione){
  case 'elenco':return {elenco:elenco(v,z)};
  case 'apri':return {lavagna:leggi(v,z,o.id)};
  case 'crea':{const scena=M.scena(o.scena||{elements:[],files:{},appState:{viewBackgroundColor:'#ffffff'}}),nome=o.titolo==null?null:titolo(o.titolo),numero=prossimoNumero(v,z);
   return {lavagna:scrivi(v,z,{...scena,studia:{id:randomUUID(),title:nome||M.titoloAutomatico(numero,new Date()),numero,revision:1,updated:Date.now()}})};}
  case 'salva':{const p=leggi(v,z,o.id),s=M.scena(o.scena);return {lavagna:scrivi(v,z,{...M.unisci(p,s),studia:{...p.studia,revision:p.studia.revision+1,updated:Date.now()}})};}
  case 'rinomina':{const p=leggi(v,z,o.id);p.studia={...p.studia,title:titolo(o.titolo),revision:p.studia.revision+1,updated:Date.now()};return {lavagna:scrivi(v,z,p)};}
  case 'elimina':{
   if(!Array.isArray(o.ids)||!o.ids.length||o.ids.length>1000)throw Error('Seleziona le lavagnate da eliminare.');
   const ids=[...new Set(o.ids)],pairs=ids.map(id=>[file(v,z,id),file(v,z,id,true)]);pairs.forEach(([p])=>fs.accessSync(p));
   fs.mkdirSync(path.dirname(pairs[0][1]),{recursive:true});for(const [p,q] of pairs)fs.renameSync(p,q);return {rimossi:ids};
  }
  case 'ripristina':{
   if(!Array.isArray(o.ids)||o.ids.length>1000)throw Error('Selezione non valida.');
   for(const id of o.ids){const q=file(v,z,id);if(fs.existsSync(q))throw Error('Una lavagnata con questa identità esiste già.');leggi(v,z,id,true);}
   for(const id of o.ids)fs.renameSync(file(v,z,id,true),file(v,z,id));return {ripristinati:o.ids};
  }
  default:throw Error('Comando LIM non disponibile.');
 }
}
function installa({win,appDir,vaultDir}){
 const finestre=new Map(),attive=new Map();
 function collega(w,url,zaino){
  finestre.set(w,{zaino});w.on('closed',()=>finestre.delete(w));
  const esegui=(e,o={})=>{
   if(e.sender!==w.webContents||e.senderFrame!==w.webContents.mainFrame||e.senderFrame.url.split('#')[0]!==url)throw Error('Richiesta LIM non autorizzata.');
   const v=vaultDir(),z=zaino||o.corso;if(!v||!require('./zaini').nomeValido(z))throw Error('Apri uno zaino per usare la LIM.');
   const radice=D.percorso(v,path.join(v,'Zaini',z));
   const r=D.esegui({metadati:[v],lettura:[radice],scrittura:[D.percorso(v,path.join(radice,'LIM'))]},()=>comando(v,z,o));
   if(!['elenco','apri'].includes(o.azione))for(const [f,info] of finestre)if(!f.isDestroyed()&&(!info.zaino||info.zaino===z))f.webContents.send('lim:cambiata',{corso:z,id:r.lavagna?.studia.id,rimossi:r.rimossi,mittente:o.mittente});
   if(r.lavagna&&['apri','crea'].includes(o.azione))attive.set(z,r.lavagna.studia.id);
   if(r.rimossi?.includes(attive.get(z)))attive.delete(z);
   return {ok:true,corso:z,attiva:attive.get(z),...r};
  };
  w.webContents.ipc.handle('lim:comando',(e,o)=>{try{return esegui(e,o);}catch(err){return {ok:false,error:err.message};}});
  w.webContents.ipc.on('lim:flush',(e,o)=>{try{e.returnValue=esegui(e,o);}catch(err){e.returnValue={ok:false,error:err.message};}});
 }
 collega(win,pathToFileURL(path.join(appDir,'StudIA.html')).href);
 return {collega};
}
module.exports={comando,elenco,leggi,installa};
