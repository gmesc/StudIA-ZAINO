'use strict';
const path=require('node:path'),{pathToFileURL}=require('node:url'),{randomUUID}=require('node:crypto');
const L=require('../App/assets/banco/lettura');
/* Canali legati alla singola WebContents: la finestra di proiezione non riceve
   il preload del vault e non può usare i canali dell'app principale. */
function installa({lim,win,BrowserWindow,screen,appDir}){
 const file=path.join(appDir,'proiezione/index.html'),url=pathToFileURL(file).href,origine=pathToFileURL(path.join(appDir,'StudIA.html')).href;
 let finestra=null,sessione='',ultimo=null,catturando=false,intero=false,eraIntero=false;
 function invia(c,d){if(!win.isDestroyed())win.webContents.send(c,d);}
 function collega(w,canale,indirizzo,fn){w.webContents.ipc.handle(canale,async(e,o)=>{
  try{if(!L.mittente(e,w,indirizzo))throw Error('Richiesta non autorizzata da questa finestra.');return await fn(o||{});}
  catch(e){return {ok:false,error:e.message};}
 });}
 function schermi(){return screen.getAllDisplays().map((s,i)=>({id:s.id,nome:s.label||'Schermo '+(i+1)}));}
 function inviaSchermi(){if(finestra&&!finestra.isDestroyed())finestra.webContents.send('proiezione:schermi',{schermi:schermi(),corrente:screen.getDisplayMatching(finestra.getBounds()).id});}
 function termina(){if(finestra&&!finestra.isDestroyed())finestra.close();}
 function esci(){if(!intero)return;intero=false;if(!eraIntero)win.setFullScreen(false);invia('presentazione:uscita',{});}
 collega(win,'presentazione:intero',origine,o=>{
  if(o.attivo){if(!intero){eraIntero=win.isFullScreen();intero=true;win.setFullScreen(true);}}
  else esci();return {ok:true};
 });
 win.on('leave-full-screen',esci);
 win.webContents.on('did-start-navigation',(_e,_url,_stessaPagina,principale)=>{if(principale){termina();esci();}});
 win.webContents.on('before-input-event',(e,input)=>{if(input.type==='keyDown'&&input.key==='Escape'&&intero){e.preventDefault();esci();}});
 collega(win,'proiezione:apri',origine,async(o)=>{
  if(lim&&!require('./zaini').nomeValido(o.corso))throw Error('Apri uno zaino per proiettare.');
  termina();sessione=randomUUID();ultimo=null;const corrente=sessione;
  const esterno=screen.getAllDisplays().find(s=>s.id!==screen.getDisplayMatching(win.getBounds()).id);
  const bounds=esterno?.workArea;
  const w=new BrowserWindow({width:bounds?Math.min(1280,bounds.width):1000,height:bounds?Math.min(900,bounds.height):760,
   ...(bounds?{x:bounds.x,y:bounds.y}:{}),show:false,title:'Proiezione — StudIA ZAINO',backgroundColor:'#fbfbfa',
   webPreferences:{preload:path.join(appDir,'proiezione/preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,webviewTag:false,backgroundThrottling:false,partition:'proiezione-'+corrente}});
  finestra=w;
  if(lim)lim.collega(w,url,o.corso);
  const [vw,vh]=w.getContentSize();let vista={width:vw,height:vh,scala:100,dpr:1};
  const session=w.webContents.session;
  session.setPermissionRequestHandler((_w,_p,cb)=>cb(false));session.setPermissionCheckHandler(()=>false);
  session.webRequest.onBeforeRequest({urls:['<all_urls>']},(d,done)=>{
   const p=require('./sicurezza-app').percorsoUrl(d.url);
   done({cancel:!(p&&p.startsWith(appDir+path.sep)||/^data:image\/(png|jpeg|webp);base64,/.test(d.url))});
  });
  require('./sicurezza-finestre').proteggiFinestra(w,{file,esterni:false});
  collega(w,'proiezione:comando',url,o=>{
   if(o.azione==='vista'){
    if(o.dpr!=null&&(!Number.isFinite(o.dpr)||o.dpr<=0))throw Error('Densità della proiezione non valida.');
    if(!['width','height','scala'].every(k=>Number.isFinite(o[k]))||o.width<1||o.height<1||o.width>32768||o.height>32768)throw Error('Misure della proiezione non valide.');
    if(finestra!==w||sessione!==corrente)throw Error('Proiezione terminata.');
    if(o.ancora&&(!['x','y'].every(k=>Number.isFinite(o.ancora[k])&&o.ancora[k]>=0&&o.ancora[k]<=1)))throw Error('Ancora non valida.');
    vista={width:o.width,height:o.height,scala:Math.max(100,L.scala(o.scala)),dpr:Math.max(1,Math.min(3,o.dpr||1))};
    invia('proiezione:vista',{sessione:corrente,vista,...(o.ancora?{ancora:o.ancora}:{})});
   }else if(o.azione==='sposta'){
    if(finestra!==w||sessione!==corrente||!['dx','dy'].every(k=>Number.isFinite(o[k])&&Math.abs(o[k])<=32768))throw Error('Spostamento non valido.');
    invia('proiezione:sposta',{sessione:corrente,dx:o.dx,dy:o.dy});
   }else if(o.azione==='fonte'){if(!require('../App/assets/rimandi/sintassi').leggi(o.link))throw Error('Rimando non valido.');invia('proiezione:fonte',{link:o.link});
   }else if(o.azione==='intero')w.setFullScreen(!w.isFullScreen());
   else if(o.azione==='chiudi')w.close();
   else if(o.azione==='schermo'){
    const schermo=screen.getAllDisplays().find(s=>s.id===o.id);if(!schermo)throw Error('Schermo non disponibile.');
    const applica=()=>{w.setBounds(schermo.workArea);w.show();};
    if(w.isFullScreen()){w.once('leave-full-screen',applica);w.setFullScreen(false);}else applica();
   }else throw Error('Comando non disponibile.');return {ok:true};
  });
  w.webContents.on('before-input-event',(e,input)=>{if(input.type==='keyDown'&&input.key==='Escape'&&w.isFullScreen()){e.preventDefault();w.setFullScreen(false);}});
  w.on('enter-full-screen',()=>w.webContents.send('proiezione:intero',true));
  w.on('leave-full-screen',()=>w.webContents.send('proiezione:intero',false));
  w.on('move',inviaSchermi);
  w.on('closed',()=>{if(finestra===w){finestra=null;sessione='';ultimo=null;}invia('proiezione:chiusa',{sessione:corrente});});
  try{await w.loadFile(file);}catch(e){w.close();throw e;}inviaSchermi();if(ultimo)w.webContents.send('proiezione:quadro',ultimo);w.showInactive();
  return {ok:true,sessione:corrente,vista};
 });
 collega(win,'proiezione:aggiorna',origine,async o=>{
  if(!finestra||finestra.isDestroyed()||o.sessione!==sessione)return {ok:false,chiusa:true};
  const w=finestra,id=sessione;
  const quadro={titolo:String(o.titolo||'Proiezione').slice(0,400),tema:o.tema==='dark'?'dark':'light',ancora:o.ancora,tipo:o.tipo};
  if(o.tipo==='clone'||o.tipo==='testo'){
   if(o.html!=null){if(typeof o.html!=='string'||o.html.length>8_000_000)throw Error('Il contenuto è troppo grande per questa proiezione.');quadro.html=o.html;}
   if(o.tipo==='clone'){
    if(!o.layout||!['x','y','width','height'].every(k=>Number.isFinite(o.layout[k]))||o.layout.width<=0||o.layout.height<=0)throw Error('Impaginazione non valida.');
    quadro.layout=o.layout;
   }
  }else if(o.tipo==='pdf'||o.tipo==='mappa'||o.tipo==='lavagna'){
   if(typeof o.immagine!=='string'||o.immagine.length>64000000||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(o.immagine))throw Error('Pagina proiettata non valida.');
   quadro.immagine=o.immagine;
   if(o.fonte){if(typeof o.fonte.testo!=='string'||o.fonte.testo.length>100000||typeof o.fonte.titolo!=='string'||o.fonte.titolo.length>500||!require('../App/assets/rimandi/sintassi').leggi(o.fonte.link))throw Error('Fonte della proiezione non valida.');quadro.fonte=o.fonte;}else quadro.fonte=null;
  }else if(o.tipo==='immagine'){
   if(catturando)return {ok:true};
   const [width,height]=win.getContentSize(),rect=L.rettangolo(o.area,{width,height});
   catturando=true;
   try{const img=await win.webContents.capturePage(rect);quadro.immagine=img.toDataURL();}finally{catturando=false;}
  }else throw Error('Contenuto di proiezione non valido.');
  if(id!==sessione||w.isDestroyed())return {ok:false,chiusa:true};
  ultimo={...ultimo,...quadro};w.webContents.send('proiezione:quadro',quadro);return {ok:true};
 });
 collega(win,'proiezione:lavagna',origine,o=>{if(!finestra||finestra.isDestroyed())return {aperta:false};if(!/^[0-9a-f-]{36}$/.test(o.id))throw Error('Lavagnata non valida.');finestra.webContents.send('proiezione:lavagna',{id:o.id});return {aperta:true};});
 collega(win,'proiezione:chiudi',origine,()=>{termina();return {ok:true};});
 const schermiCambiati=()=>{inviaSchermi();if(finestra&&!finestra.isDestroyed()){
  const r=finestra.getBounds();if(!screen.getAllDisplays().some(s=>r.x<s.bounds.x+s.bounds.width&&r.x+r.width>s.bounds.x&&r.y<s.bounds.y+s.bounds.height&&r.y+r.height>s.bounds.y)){
   finestra.setFullScreen(false);finestra.setBounds(screen.getPrimaryDisplay().workArea);
  }
 }};
 screen.on('display-added',schermiCambiati);screen.on('display-removed',schermiCambiati);
 win.on('closed',()=>{termina();screen.removeListener('display-added',schermiCambiati);screen.removeListener('display-removed',schermiCambiati);});
}
module.exports={installa};
