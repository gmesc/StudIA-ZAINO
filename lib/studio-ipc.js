'use strict';
function ponte(ipc){const call=(n,o)=>ipc.invoke('studio:'+n,o);return {
 onProgress:fn=>{const listener=(_,state)=>fn(state);ipc.on('studio:progress',listener);return ()=>ipc.removeListener('studio:progress',listener);},
 presets:()=>call('presets'),estimate:(zaino,sourceId,preset)=>call('estimate',{zaino,sourceId,preset}),
 cards:zaino=>call('cards',{zaino}),
 fromCard:(zaino,sourceId,index,revision,expectedId)=>call('fromCard',{zaino,sourceId,index,revision,expectedId}),
 card:(zaino,sourceId,preset)=>call('card',{zaino,sourceId,preset}),analyze:(zaino,o)=>call('analyze',{zaino,...o}),copyCard:(zaino,sourceId,preset)=>call('copyCard',{zaino,sourceId,preset}),
 remove:(zaino,ids)=>call('remove',{zaino,ids}),undoRemove:(zaino,token)=>call('undoRemove',{zaino,token}),
 removeCards:(zaino,ids)=>call('removeCards',{zaino,ids}),undoRemoveCards:(zaino,token)=>call('undoRemoveCards',{zaino,token}),
 state:(zaino,scope)=>call('state',{zaino,scope}),start:(zaino,o)=>call('start',{zaino,...o}),
 answer:(zaino,id,o)=>call('answer',{zaino,id,...o}),keep:(zaino,id)=>call('keep',{zaino,id}),
 outcome:(zaino,id,attemptId,outcome)=>call('outcome',{zaino,id,attemptId,outcome}),resume:(zaino,id)=>call('resume',{zaino,id}),cancel:()=>call('cancel')
};}
function registra({ipcMain,app,vaultDir,readCfg,readKey,recupera,runtime}){
 const S=require('./schede-zaino'),I=require('./interrogazione'),provider=require('./chat-provider'),pending=new Map();
 const handle=(n,fn)=>ipcMain.handle('studio:'+n,async(e,o)=>{try{return {ok:true,...await fn(e,o)};}catch(err){return {ok:false,error:err.message};}});
 function vault(o){const v=vaultDir();if(!o || !require('./zaino-only').zainoValido(v,o.zaino))throw Error('Apri uno zaino valido.');return v;}
 async function job(e,o,fn){
  if(pending.has(e.sender.id))throw Error('Attendi o interrompi l’operazione di studio.');
  const v=vault(o),settings=readCfg().chat || {},key=readKey(settings.provider);
  if(!provider.catalogo().some(p=>p.id===settings.provider) || !settings.model || !key)throw Error('Configura provider, chiave e modello nelle impostazioni.');
  if(o.expectedModel && (o.expectedModel!==settings.model || o.expectedProvider!==settings.provider))throw Error('Il modello è cambiato. Ricontrolla la stima.');
  const costSourceIds=o.sourceId?[o.sourceId]:o.id?I.leggi(v,o.zaino,o.id).sources.map(s=>s.sourceId):o.scope?.sourceIds||[];
  const ctrl=new AbortController(),costWarnings=[];pending.set(e.sender.id,ctrl);
  try{const result=await fn(v,{provider:settings.provider,model:settings.model,recupera,runtime,signal:ctrl.signal,onProgress:p=>{if(!e.sender.isDestroyed())e.sender.send('studio:progress',{...p,zaino:o.zaino});},chiama:async request=>{
   const r=await require('./costi-zaino').misura(v,o.zaino,{provider:settings.provider,model:settings.model,operation:o.preset?'Scheda: '+S.PRESET[o.preset]:'Ripasso',sourceIds:costSourceIds},()=>provider.rispondi({...request,provider:settings.provider,model:settings.model,apiKey:key,productId:settings.infomaniakProductId}));
   if(r?.costWarning)costWarnings.push(r.costWarning);if(!e.sender.isDestroyed?.())e.sender.send?.('costs:updated');return r;
  }});return {...result,...(costWarnings.length?{costWarnings:[...new Set(costWarnings)]}:{})};}
  catch(error){throw Error(String(error.message).split(key).join('[chiave rimossa]'));}
  finally{pending.delete(e.sender.id);}
 }
 handle('presets',()=>({presets:S.PRESET}));
 handle('cards',async(_,o)=>{const v=vault(o),data=S.elenco(v,o.zaino);for(const c of data.cards){const r=await S.aggiornaLettura(v,o.zaino,c.sourceId,c.preset);if(r.card)c.partial=r.card.partial;}return data;});
 handle('estimate',(e,o)=>job(e,o,async(v,opts)=>{const d=await S.prepara(v,o.zaino,o.sourceId,o.preset,opts);const {chunks,...info}=d;return {...info,provider:opts.provider,model:opts.model,prices:require('../App/assets/chat/schede-piano').tariffa(opts.provider,opts.model)};}));
 handle('fromCard',(_,o)=>({question:I.daScheda(vault(o),o.zaino,o.sourceId,o.index,o.revision,o.expectedId)}));
 handle('card',(_,o)=>S.aggiornaLettura(vault(o),o.zaino,o.sourceId,o.preset));
 handle('analyze',(e,o)=>job(e,o,async(v,opts)=>({card:await S.genera(v,o.zaino,o.sourceId,o.preset,{...opts,expectedRevision:o.expectedRevision})})));
 handle('copyCard',async(_,o)=>{const v=vault(o);await S.aggiornaLettura(v,o.zaino,o.sourceId,o.preset);return S.copia(v,o.zaino,o.sourceId,o.preset);});
 handle('remove',(_,o)=>I.elimina(vault(o),o.zaino,o.ids));
 handle('undoRemove',(_,o)=>I.annullaEliminazione(vault(o),o.zaino,o.token));
 for(const [name,fn] of [['removeCards',S.elimina],['undoRemoveCards',S.annullaEliminazione]])handle(name,(e,o)=>{
  if(pending.has(e.sender.id))throw Error('Attendi o interrompi l’operazione di studio prima di modificare le schede.');
  return fn(vault(o),o.zaino,name==='removeCards'?o.ids:o.token);
 });
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
