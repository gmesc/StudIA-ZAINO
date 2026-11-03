'use strict';
// URL temporanei a capacità: il player conosce soltanto i media del deck aperto.
const path=require('node:path'),{pathToFileURL}=require('node:url'),{randomUUID}=require('node:crypto');
const D=require('./permessi-disco'),M=require('../App/assets/presentazioni/modello'),P=require('./presentazioni');
const registri=new WeakMap();
// L’iframe ha origine opaca: i font richiedono CORS anche per URL locali a capacità.
function registra(protocol){protocol.registerSchemesAsPrivileged([{scheme:'presenta',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);}
function installa(session,net){
 if(registri.has(session))return registri.get(session);
 const map=new Map();registri.set(session,map);
 session.protocol.handle('presenta',async request=>{
  try{
   const u=new URL(request.url),r=map.get(u.host),a=r?.assets.get(u.pathname);
   if(!r||!a||u.search||u.username||u.password)return new Response(null,{status:404});
   return await D.esegui({lettura:[r.root]},()=>{const p=D.percorso(r.root,path.join(r.root,a.path));return net.fetch(pathToFileURL(p).href,{headers:request.headers}).then(response=>{const headers=new Headers(response.headers);headers.set('Access-Control-Allow-Origin','*');return new Response(response.body,{status:response.status,headers});});});
  }catch(_){return new Response(null,{status:404});}
 });return map;
}
function consentita(url,session){try{const u=new URL(url);return u.protocol==='presenta:'&&!u.search&&!u.username&&!u.password&&!!registri.get(session)?.get(u.host)?.assets.has(u.pathname);}catch(_){return false;}}
function frame({session,net,appDir}){
 const map=installa(session,net),token=randomUUID(),vendor=require('./presentazioni-export').runtime();
 const paths=['presentazioni-player/index.html','presentazioni-player/frame.js','presentazioni-player/scrittura.js','presentazioni-player/frame.css','assets/presentazioni/deck.css','assets/presentazioni/caratteri.css',...require('./presentazioni-export').caratteri().map(f=>'assets/presentazioni/fonts/'+f.nome),'assets/presentazioni/animazioni.js','assets/presentazioni/animazioni-dom.js','assets/presentazioni/navigazione.js','assets/presentazioni/vettori.js','assets/presentazioni/modello.js','assets/presentazioni/testo.js',...vendor.map(f=>'assets/presentazioni/vendor/'+f.nome)];
 map.set(token,{root:appDir,frame:true,assets:new Map(paths.map(p=>['/'+p,{path:p}]))});
 return {url:'presenta://'+token+'/presentazioni-player/index.html',chiudi(){map.delete(token);}};
}
function frameConsentito(url,session){try{const u=new URL(url);return consentita(url,session)&&u.pathname==='/presentazioni-player/index.html'&&!!registri.get(session)?.get(u.host)?.frame;}catch(_){return false;}}
function crea({session,net,v,z,id}){
 const map=installa(session,net),token=randomUUID(),root=P.directory(v,z,id);
 const entry={root,assets:new Map()},carteToken=randomUUID();map.set(token,entry);map.set(carteToken,{root:path.join(__dirname,'../App/assets/presentazioni'),assets:new Map(Object.keys(M.CARTE).map(k=>['/carte/'+k+'.png',{path:'carte/'+k+'.png'}]))});
 return {compila(d){
  P.verifica(d,require('./citazioni-zaini').identita(v,z),id);P.verificaRisorse(v,z,d);
  const r=require('../App/assets/presentazioni/reveal-adapter').compila(d);
  entry.assets=new Map(M.risorseUsate(d).map(k=>['/'+d.assets[k].path,d.assets[k]]));
  return {...r,html:r.html.replace(/(src|href|data-background-image|data-background-video|data-common-image|data-common-video)="assets\//g,'$1="presenta://'+token+'/assets/').replace(/src="carte\//g,'src="presenta://'+carteToken+'/carte/')};
 },chiudi(){map.delete(token);map.delete(carteToken);}};
}
module.exports={registra,crea,frame,frameConsentito,consentita};
