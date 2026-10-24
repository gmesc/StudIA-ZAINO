'use strict';
const path=require('node:path');
const {urlEsterna,percorsoUrl}=require('./sicurezza-app');
const D=require('./permessi-disco'),formati=require('./formati-sicuri');
function installaSessione(sessione,{appDir,vaultDir,temporanei,documento}) {
  sessione.setPermissionRequestHandler((_wc,_perm,rispondi)=>rispondi(false));
  sessione.setPermissionCheckHandler(()=>false);
  sessione.webRequest.onBeforeRequest({urls:['<all_urls>']},(d,done)=>{
    let permesso=false;
    const file=percorsoUrl(d.url);
    if(file) {
      try {
        // Il codice dell'app è di sola lettura. I dati dell'utente sono soltanto
        // documenti/immagini/media: mai script, HTML, oggetti o sottopagine.
        if(file===documento || file===appDir||file.startsWith(appDir+path.sep)) {if(file!==documento)D.percorso(appDir,file);permesso=true;}
        else if(['image','media','xhr','other'].includes(d.resourceType)) {
          const v=vaultDir(),roots=[v&&D.percorso(v,path.join(v,'Zaini')),temporanei()].filter(Boolean);
          for(const root of roots) {
            try {
              const p=D.percorso(root,file);
              const esito=D.esegui({lettura:[root]},()=>formati.verificaFile(p,{estensioni:[...formati.PDF,...formati.IMMAGINI,...formati.MEDIA]}));
              if(esito.ok){permesso=true;break;}
            }catch(_){}
          }
        }
      }catch(_){}
    } else if(d.url.startsWith('blob:') && ['image','media','other'].includes(d.resourceType))permesso=true;
    // Le chiamate ai provider e i download passano dal main, non dai documenti.
    done({cancel:!permesso});
  });
}
function proteggiFinestra(win,{file,shell,esterni=true}) {
  win.webContents.setWindowOpenHandler(({url})=>{
    if(esterni && urlEsterna(url))shell.openExternal(url).catch(()=>{});
    return {action:'deny'};
  });
  win.webContents.on('will-navigate',(e,url)=>{
    if(percorsoUrl(url)!==file)e.preventDefault();
  });
  win.webContents.on('will-frame-navigate',e=>{if(!e.isMainFrame)e.preventDefault();});
  win.webContents.on('will-attach-webview',e=>e.preventDefault());
  win.webContents.on('will-redirect',e=>e.preventDefault());
}
module.exports={installaSessione,proteggiFinestra};
