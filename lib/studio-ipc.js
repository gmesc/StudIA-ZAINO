'use strict';
function ponte(ipc){const call=(n,o)=>ipc.invoke('studio:'+n,o);return {
 presets:()=>call('presets'),estimate:(zaino,sourceId,preset)=>call('estimate',{zaino,sourceId,preset}),
 cards:zaino=>call('cards',{zaino}),
 card:(zaino,sourceId,preset)=>call('card',{zaino,sourceId,preset}),analyze:(zaino,o)=>call('analyze',{zaino,...o}),copyCard:(zaino,sourceId,preset)=>call('copyCard',{zaino,sourceId,preset}),
 state:(zaino,scope)=>call('state',{zaino,scope}),start:(zaino,o)=>call('start',{zaino,...o}),
 answer:(zaino,id,o)=>call('answer',{zaino,id,...o}),keep:(zaino,id)=>call('keep',{zaino,id}),
 outcome:(zaino,id,attemptId,outcome)=>call('outcome',{zaino,id,attemptId,outcome}),resume:(zaino,id)=>call('resume',{zaino,id}),cancel:()=>call('cancel')
};}
function registra({ipcMain,app,vaultDir,readCfg,readKey,recupera}){
 const S=require('./schede-zaino'),I=require('./interrogazione'),provider=require('./chat-provider'),pending=new Map();
 const handle=(n,fn)=>ipcMain.handle('studio:'+n,async(e,o)=>{try{return {ok:true,...await fn(e,o)};}catch(err){return {ok:false,error:err.message};}});
 function vault(o){const v=vaultDir();if(!o || !require('./zaino-only').zainoValido(v,o.zaino))throw Error('Apri uno zaino valido.');return v;}
 async function job(e,o,fn){
  if(pending.has(e.sender.id))throw Error('Attendi o interrompi l’operazione di studio.');
  const v=vault(o),settings=readCfg().chat || {},key=readKey(settings.provider);
  if(!provider.catalogo().some(p=>p.id===settings.provider) || !settings.model || !key)throw Error('Configura provider, chiave e modello nelle impostazioni.');
  if(o.expectedModel && (o.expectedModel!==settings.model || o.expectedProvider!==settings.provider))throw Error('Il modello è cambiato. Ricontrolla la stima.');
  const ctrl=new AbortController();pending.set(e.sender.id,ctrl);
  try{return await fn(v,{provider:settings.provider,model:settings.model,recupera,signal:ctrl.signal,chiama:request=>provider.rispondi({...request,provider:settings.provider,model:settings.model,apiKey:key})});}
  catch(error){throw Error(String(error.message).split(key).join('[chiave rimossa]'));}
  finally{pending.delete(e.sender.id);}
 }
 handle('presets',()=>({presets:S.PRESET}));
 handle('cards',(_,o)=>S.elenco(vault(o),o.zaino));
 handle('estimate',async(_,o)=>{const d=await S.prepara(vault(o),o.zaino,o.sourceId,o.preset);const {chunks,...info}=d;return {...info,...readCfg().chat};});
 handle('card',(_,o)=>S.leggi(vault(o),o.zaino,o.sourceId,o.preset));
 handle('analyze',(e,o)=>job(e,o,async(v,opts)=>({card:await S.genera(v,o.zaino,o.sourceId,o.preset,{...opts,expectedRevision:o.expectedRevision})})));
 handle('copyCard',(_,o)=>S.copia(vault(o),o.zaino,o.sourceId,o.preset));
 handle('state',(_,o)=>I.stato(vault(o),o.zaino,o.scope));
 handle('start',(e,o)=>job(e,o,async(v,opts)=>({question:await I.avvia(v,o.zaino,o,opts)})));
 handle('answer',(e,o)=>job(e,o,async(v,opts)=>({question:await I.rispondi(v,o.zaino,o.id,o,opts)})));
 handle('keep',(_,o)=>({question:I.conserva(vault(o),o.zaino,o.id)}));
 handle('outcome',(_,o)=>({question:I.esito(vault(o),o.zaino,o.id,o.attemptId,o.outcome)}));
 handle('resume',(_,o)=>({question:I.riprendi(vault(o),o.zaino,o.id)}));
 handle('cancel',e=>{pending.get(e.sender.id)?.abort();return {};});
 app.on('web-contents-created',(_,contents)=>{const cancel=()=>pending.get(contents.id)?.abort();contents.on('destroyed',cancel);contents.on('did-start-navigation',d=>{if(d.isMainFrame && !d.isInPlace)cancel();});});
 app.on('before-quit',()=>{for(const ctrl of pending.values())ctrl.abort();});
}
module.exports={ponte,registra};
