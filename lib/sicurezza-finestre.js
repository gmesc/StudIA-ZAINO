'use strict';
const path=require('node:path');
const {urlEsterna,percorsoUrl}=require('./sicurezza-app');
const D=require('./permessi-disco'),formati=require('./formati-sicuri');
function installaSessione(sessione,{appDir,vaultDir,temporanei,documento,verificaPdf}) {
  // Negare anche la scrittura impediva ogni «Copia», pur lasciando cliccabile il
  // comando. Solo l'interfaccia principale può scrivere contenuti sanitizzati;
  // leggere la clipboard e tutti gli altri permessi restano negati.
  function puoCopiare(wc,perm,details) {
    const file=path.join(appDir,'StudIA.html');
    return perm==='clipboard-sanitized-write' && details?.isMainFrame===true &&
      percorsoUrl(wc?.mainFrame?.url)===file && percorsoUrl(details.requestingUrl)===file;
  }
  sessione.setPermissionRequestHandler((wc,perm,rispondi,details)=>rispondi(puoCopiare(wc,perm,details)));
  sessione.setPermissionCheckHandler((wc,perm,_origine,details)=>puoCopiare(wc,perm,details));
  sessione.webRequest.onBeforeRequest({urls:['<all_urls>']},async(d,done)=>{
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
              if(esito.ok){
                if(esito.ext==='.pdf'&&verificaPdf){
                  const redirectURL=await D.esegui({lettura:[root]},()=>verificaPdf(p));
                  if(redirectURL){done({redirectURL});return;}
                }
                permesso=true;break;
              }
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
