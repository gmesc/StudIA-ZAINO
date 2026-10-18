'use strict';
const path=require('node:path'),R=require('./rag'),M=require('./rag-modello'),F=require('./fonti-ai');
function ponte(ipc){const call=(name,o)=>ipc.invoke('rag:'+name,o);return {
 state:()=>call('state'),install:()=>call('install'),cancel:()=>call('cancel'),
 index:(zaino,scope)=>call('index',{zaino,scope}),search:(zaino,query,scope)=>call('search',{zaino,query,scope}),
 reset:zaino=>call('reset',{zaino}),resolve:(zaino,source)=>call('resolve',{zaino,source})
};}
function registra({ipcMain,app,vaultDir}){
 const runtime=require('./rag-runtime').crea(path.join(app.getPath('userData'),'rag-model',M.REV));
 const jobs=new Map();let download=null,progress=null;
 function vault(o){const v=vaultDir();if(!o || !require('./zaino-only').zainoValido(v,o.zaino))throw Error('Apri uno zaino valido.');return v;}
 const handle=(n,fn)=>ipcMain.handle('rag:'+n,async(e,o)=>{try{return {ok:true,...await fn(e,o)};}catch(err){return {ok:false,error:err.message};}});
 async function job(e,o,fn){if(jobs.has(e.sender.id))throw Error('Attendi o interrompi l’operazione locale.');const ctrl=new AbortController(),v=vault(o);jobs.set(e.sender.id,{ctrl,zaino:o.zaino,v,progress:null});try{return await fn(v,{runtime,scope:F.ambito(o.scope),signal:ctrl.signal,progress:p=>{const j=jobs.get(e.sender.id);if(j)j.progress=p;}});}finally{jobs.delete(e.sender.id);}}
 handle('state',e=>({ready:runtime.ready(),download:!!download,progress,job:jobs.get(e.sender.id)?.progress || null,busy:jobs.has(e.sender.id)}));
 handle('install',async e=>{
  if(download)throw Error('Download già in corso.');const ctrl=new AbortController();download={ctrl,sender:e.sender.id};
  try{await M.installa(runtime.dir,{signal:ctrl.signal,progress:p=>{progress=p;}});return {ready:true};}
  finally{download=null;}
 });
 handle('cancel',e=>{jobs.get(e.sender.id)?.ctrl.abort();if(download?.sender===e.sender.id)download.ctrl.abort();return {};});
 handle('index',(e,o)=>job(e,o,(v,opts)=>R.indicizza(v,o.zaino,opts)));
 handle('search',(e,o)=>job(e,o,async(v,opts)=>{const data=await R.cerca(v,o.zaino,o.query,opts);return {...data,chunks:data.chunks.slice(0,30)};}));
 handle('resolve',(_,o)=>F.risolvi(vault(o),o.zaino,o.source));
 handle('reset',(_,o)=>{const v=vault(o);if([...jobs.values()].some(j=>j.v===v && j.zaino===o.zaino))throw Error('Interrompi l’indicizzazione prima di ricostruire la cache.');return R.ricostruisci(v,o.zaino);});
 app.on('web-contents-created',(_,contents)=>{const cancel=()=>{jobs.get(contents.id)?.ctrl.abort();if(download?.sender===contents.id)download.ctrl.abort();};contents.on('destroyed',cancel);contents.on('did-start-navigation',d=>{if(d.isMainFrame && !d.isInPlace)cancel();});});
 app.on('before-quit',()=>{download?.ctrl.abort();for(const j of jobs.values())j.ctrl.abort();runtime.close();});
 return {runtime,recupera:(v,z,q,opts)=>R.recupera(v,z,q,{...opts,runtime})};
}
module.exports={ponte,registra};
