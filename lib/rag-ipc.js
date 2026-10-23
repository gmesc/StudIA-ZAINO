'use strict';
const path=require('node:path'),R=require('./rag'),M=require('./rag-modello'),F=require('./fonti-ai');
function ponte(ipc){const call=(name,o)=>ipc.invoke('rag:'+name,o);return {
 state:()=>call('state'),install:modalita=>call('install',{modalita}),cancel:()=>call('cancel'),
 watch:zaino=>call('watch',{zaino}),
 onAuto:fn=>{const listener=(_,state)=>fn(state);ipc.on('rag:auto',listener);return ()=>ipc.removeListener('rag:auto',listener);},
 index:(zaino,scope)=>call('index',{zaino,scope}),search:(zaino,query,scope)=>call('search',{zaino,query,scope}),
 reset:zaino=>call('reset',{zaino}),resolve:(zaino,source)=>call('resolve',{zaino,source})
};}
function registra({ipcMain,app,vaultDir}){
 const runtime=require('./rag-runtime').crea(path.join(app.getPath('userData'),'rag-model',M.REV));
 const jobs=new Map(),automatici=new Map(),richieste=new Map();let download=null,progress=null;
 function vault(o){const v=vaultDir();if(!o || !require('./zaino-only').zainoValido(v,o.zaino))throw Error('Apri uno zaino valido.');return v;}
 const handle=(n,fn)=>ipcMain.handle('rag:'+n,async(e,o)=>{try{return {ok:true,...await fn(e,o)};}catch(err){return {ok:false,error:err.message};}});
 async function job(e,o,fn){if(jobs.has(e.sender.id))throw Error('Attendi o interrompi l’operazione locale.');const ctrl=new AbortController(),v=vault(o);jobs.set(e.sender.id,{ctrl,zaino:o.zaino,v,progress:null});try{return await fn(v,{runtime,scope:F.ambito(o.scope),signal:ctrl.signal,progress:p=>{const j=jobs.get(e.sender.id);if(j)j.progress=p;}});}finally{jobs.delete(e.sender.id);}}
 handle('watch',async(e,o)=>{
  const v=o?.zaino?vault(o):null,old=automatici.get(e.sender.id);
  if(old?.vault===v&&old?.zaino===o.zaino)return {auto:old.state()};
  const richiesta={};richieste.set(e.sender.id,richiesta);
  automatici.delete(e.sender.id);await old?.close();
  if(!v||richieste.get(e.sender.id)!==richiesta||e.sender.isDestroyed())return {auto:null};
  const auto=require('./rag-automatico').crea({vault:v,zaino:o.zaino,runtime,onState:state=>{if(!e.sender.isDestroyed())e.sender.send('rag:auto',state);}});
  automatici.set(e.sender.id,auto);return {auto:auto.state()};
 });
 handle('state',e=>({ready:runtime.ready(),model:M.INFO,packages:M.pacchetti(runtime.dir),download:!!download,progress,job:jobs.get(e.sender.id)?.progress || null,busy:jobs.has(e.sender.id),auto:automatici.get(e.sender.id)?.state()||null}));
 handle('install',async(e,o)=>{
  const modalita=M.valida(o?.modalita);
  if(download)throw Error('Download già in corso.');const ctrl=new AbortController();download={ctrl,sender:e.sender.id,modalita};
  try{progress=null;await M.installa(runtime.dir,{modalita,signal:ctrl.signal,progress:p=>{progress={...p,modalita};}});for(const a of automatici.values())a.request(true);return {ready:true};}
  finally{download=null;}
 });
 handle('cancel',e=>{jobs.get(e.sender.id)?.ctrl.abort();if(download?.sender===e.sender.id)download.ctrl.abort();return {};});
 async function indiceEsclusivo(e,o){
  return job(e,o,async(v,opts)=>{
   const autos=[...automatici.values()].filter(a=>a.vault===v&&a.zaino===o.zaino);
   await Promise.all(autos.map(a=>a.pause()));
   try{return await R.indicizza(v,o.zaino,opts);}
   finally{autos.forEach(a=>a.resume());}
  });
 }
 handle('index',(e,o)=>indiceEsclusivo(e,o));
 handle('search',(e,o)=>job(e,o,async(v,opts)=>{const data=await R.cerca(v,o.zaino,o.query,opts);return {...data,chunks:data.chunks.slice(0,30)};}));
 handle('resolve',(_,o)=>F.risolvi(vault(o),o.zaino,o.source));
 handle('reset',async(e,o)=>{const v=vault(o);if([...jobs.values()].some(j=>j.v===v && j.zaino===o.zaino))throw Error('Interrompi l’indicizzazione prima di ricostruire la cache.');
  const autos=[...automatici.values()].filter(a=>a.vault===v&&a.zaino===o.zaino);await Promise.all(autos.map(a=>a.pause()));
  try{return R.ricostruisci(v,o.zaino);}finally{autos.forEach(a=>a.resume());}
 });
 app.on('web-contents-created',(_,contents)=>{const cancel=()=>{jobs.get(contents.id)?.ctrl.abort();if(download?.sender===contents.id)download.ctrl.abort();};contents.on('destroyed',cancel);contents.on('did-start-navigation',d=>{if(d.isMainFrame && !d.isInPlace)cancel();});});
 app.on('web-contents-created',(_,contents)=>contents.on('destroyed',()=>{const a=automatici.get(contents.id);automatici.delete(contents.id);richieste.delete(contents.id);a?.close();}));
 app.on('before-quit',()=>{download?.ctrl.abort();for(const j of jobs.values())j.ctrl.abort();for(const a of automatici.values())a.close();runtime.close();});
 return {runtime,recupera:(v,z,q,opts)=>R.recupera(v,z,q,{...opts,runtime})};
}
module.exports={ponte,registra};
