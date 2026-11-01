'use strict';
const path=require('node:path'),{pathToFileURL}=require('node:url');
const S=require('./presentazioni-sessione'),P=require('./presentazioni'),L=require('../App/assets/banco/lettura');
function installa({win,appDir,BrowserWindow,screen,net}){
 let w=null,sessione=null,inizio=null,vista=null,contesto=null;
 const file=path.join(appDir,'presentazioni-player/index.html'),url=pathToFileURL(file).href;
 function invia(d){if(!win.isDestroyed())win.webContents.send('presenta:sessione',d);}
 function regia(){return sessione?{...sessione.regia(),corso:contesto.z,schermi:screen.getAllDisplays().map((d,i)=>({id:d.id,nome:d.label||'Schermo '+(i+1)})),schermo:w&&!w.isDestroyed()?screen.getDisplayMatching(w.getBounds()).id:null}:null;}
 function aggiorna(){invia({regia:regia()});}
 function chiudi(){const old=w;w=null;if(sessione)sessione.chiudi(sessione.stato());sessione=null;inizio=null;contesto=null;vista?.chiudi();vista=null;if(old&&!old.isDestroyed())old.close();aggiorna();}
 async function apri(v,z,id,revisione){
  chiudi();const doc=P.leggi(v,z,id);if(doc.revision!==revisione)throw Error('Salva prima di presentare.');
  sessione=S.crea();inizio=sessione.avvia(doc,'pubblico');contesto={v,z,id};
  const esterno=screen.getAllDisplays().find(d=>d.id!==screen.getDisplayMatching(win.getBounds()).id),b=esterno?.workArea;
  const current=new BrowserWindow({width:b?Math.min(1280,b.width):1100,height:b?Math.min(800,b.height):760,...(b?{x:b.x,y:b.y}:{}),show:false,title:doc.title+' — PRESENTA',backgroundColor:'#fbfbfa',
   webPreferences:{preload:path.join(appDir,'presentazioni-player/preload.js'),sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,webviewTag:false,backgroundThrottling:false,partition:'presenta-'+inizio.stato.sessionId}});w=current;
  vista=require('./presentazioni-vista').crea({session:current.webContents.session,net,v,z,id});inizio.documento=vista.compila(doc);
  const ses=current.webContents.session;
  ses.setPermissionRequestHandler((_w,_p,cb)=>cb(false));ses.setPermissionCheckHandler(()=>false);
  ses.webRequest.onBeforeRequest({urls:['<all_urls>']},(r,cb)=>{const p=require('./sicurezza-app').percorsoUrl(r.url);cb({cancel:!(p&&(p===file||p===path.join(appDir,'presentazioni-player/frame.js')||p===path.join(appDir,'presentazioni-player/frame.css')||p.startsWith(path.join(appDir,'assets/presentazioni')+path.sep))||require('./presentazioni-vista').consentita(r.url,ses))});});
  require('./sicurezza-finestre').proteggiFinestra(current,{file,esterni:false});
  current.webContents.ipc.handle('presenta:player',async(e,o={})=>{
   try{
    if(w!==current||!sessione||!L.mittente(e,current,url))throw Error('Player non autorizzato o sessione terminata.');
    if(o.azione==='pronto')return {ok:true,...inizio};
    if(o.azione!=='conferma')throw Error('Comando del player non disponibile.');
    const stato=sessione.conferma(o);aggiorna();return {ok:true,stato};
   }catch(e){return {ok:false,error:e.message};}
  });
  current.webContents.on('before-input-event',(e,i)=>{if(i.type!=='keyDown')return;
   if(i.key==='Escape'){e.preventDefault();if(current.isFullScreen())current.setFullScreen(false);else chiudi();}
   if(i.key.toLowerCase()==='f'){e.preventDefault();current.setFullScreen(!current.isFullScreen());}
  });
  current.on('closed',()=>{if(w===current)chiudi();});
  try{await current.loadFile(file);if(w!==current)throw Error('Avvio annullato.');current.show();current.setFullScreen(true);aggiorna();return {regia:regia()};}
  catch(e){if(w===current)chiudi();throw e;}
 }
 function verifica(v,z){if(!sessione||contesto.v!==v||contesto.z!==z)throw Error('Nessuna presentazione in corso in questo zaino.');}
 function comando(v,z,o){
  verifica(v,z);
  if(o.sessionId!==sessione.stato().sessionId)throw Error('Comando di una sessione precedente.');
  if(S.COMANDI.includes(o.comando)){const r=sessione.comando({...sessione.stato(),azione:o.comando,slideId:o.slideId});w.webContents.send('presenta:player-comando',r);}
  else if(o.comando==='timer'){sessione.timer(sessione.stato(),o.timer);aggiorna();}
  else if(o.comando==='mostra'){w.show();w.focus();}
  else if(o.comando==='intero')w.setFullScreen(!w.isFullScreen());
  else if(o.comando==='schermo'){
   const d=screen.getAllDisplays().find(d=>d.id===o.schermo);if(!d)throw Error('Schermo non disponibile.');
   const current=w,sposta=()=>{if(w===current&&!current.isDestroyed()){current.setBounds(d.workArea);current.show();aggiorna();}};
   if(w.isFullScreen()){w.once('leave-full-screen',sposta);w.setFullScreen(false);}else sposta();
  }else if(o.comando==='chiudi')chiudi();else throw Error('Comando di sessione non disponibile.');
  return {regia:regia()};
 }
 const schermi=()=>{if(w){const b=w.getBounds();if(!screen.getAllDisplays().some(d=>b.x<d.bounds.x+d.bounds.width&&b.x+b.width>d.bounds.x&&b.y<d.bounds.y+d.bounds.height&&b.y+b.height>d.bounds.y)){w.setFullScreen(false);w.setBounds(screen.getPrimaryDisplay().workArea);}aggiorna();}};
 screen.on('display-added',schermi);screen.on('display-removed',schermi);
 win.on('closed',()=>{chiudi();screen.removeListener('display-added',schermi);screen.removeListener('display-removed',schermi);});
 win.webContents.on('did-start-navigation',(_e,_url,_stessaPagina,principale)=>{if(principale)chiudi();});
 return {apri,comando,chiudi,regia};
}
module.exports={installa};
