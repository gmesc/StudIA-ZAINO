'use strict';
const path=require('node:path'),{pathToFileURL}=require('node:url');
const D=require('./permessi-disco'),P=require('./presentazioni'),M=require('../App/assets/presentazioni/modello');
function ponte(ipc){return {
 comando:o=>ipc.invoke('presenta:comando',o),
 onCambiata:fn=>{const h=(_e,d)=>fn(d);ipc.on('presenta:cambiata',h);return ()=>ipc.removeListener('presenta:cambiata',h);},
 onSessione:fn=>{const h=(_e,d)=>fn(d);ipc.on('presenta:sessione',h);return ()=>ipc.removeListener('presenta:sessione',h);},
 onChiudi:fn=>{const h=(_e,d)=>fn(d);ipc.on('presenta:chiudi',h);return ()=>ipc.removeListener('presenta:chiudi',h);}
};}
function installa({win,shell,appDir,vaultDir,cestina,dialog,BrowserWindow,screen,net,app,nativeImage}){
 let cornice=null;
 const immaginiMiniatura=new Map();
 let anteprima=null,anteprimaId='',chiusura='',consentiChiusura=false,uscita=false,editorPronto=false;
 const player=BrowserWindow?require('./presentazioni-player').installa({win,shell,appDir,BrowserWindow,screen,net}):null;
 function scartaVista(){immaginiMiniatura.clear();anteprima?.chiudi();anteprima=null;anteprimaId='';}
 if(app){
  const esce=()=>{uscita=true;};app.on('before-quit',esce);
  win.on('close',e=>{if(consentiChiusura){consentiChiusura=false;return;}if(!editorPronto||win.webContents.isCrashed())return;e.preventDefault();if(chiusura)return;chiusura=require('node:crypto').randomUUID();win.webContents.send('presenta:chiudi',{id:chiusura});});
  win.on('closed',()=>{scartaVista();cornice?.chiudi();app.removeListener('before-quit',esce);});
 }
 const url=pathToFileURL(path.join(appDir,'StudIA.html')).href;
 win.webContents.ipc.handle('presenta:comando',async(e,o={})=>{
  try{
   if(e.sender!==win.webContents||e.senderFrame!==win.webContents.mainFrame||e.senderFrame.url.split('#')[0]!==url)throw Error('Richiesta PRESENTA non autorizzata.');
   if(o.azione==='frame'){if(!cornice)cornice=D.esegui({lettura:[appDir]},()=>require('./presentazioni-vista').frame({session:win.webContents.session,net,appDir}));return {ok:true,url:cornice.url};}
   if(o.azione==='editorPronto'){editorPronto=true;return {ok:true};}
   if(o.azione==='chiusuraPronta'){
    if(!chiusura||o.id!==chiusura)throw Error('Richiesta di chiusura superata.');chiusura='';
    if(o.errore){uscita=false;return {ok:true};}consentiChiusura=true;if(uscita)app.quit();else win.close();return {ok:true};
   }
   const v=vaultDir(),z=o.corso;if(!v||!require('./zaini').nomeValido(z))throw Error('Apri uno zaino per usare PRESENTA.');
   const radice=D.percorso(v,path.join(v,...require('./fonti-ai').parti(z))),area=D.percorso(v,path.join(radice,P.CARTELLA));
   const scrive=['crea','salva','bozza','materiale','file','elimina'].includes(o.azione);
   const scrittura=scrive?[area]:[];
   if(o.azione==='crea')scrittura.push(D.percorso(v,path.join(radice,'_identita.json')));
   if(o.azione==='materiale')scrittura.push(...['_identita.json','_fonti-ai.json'].map(n=>D.percorso(v,path.join(radice,n))));
   const r=await D.esegui({metadati:[v],lettura:[radice,path.join(appDir,'..')],scrittura},async()=>{
    switch(o.azione){
     case 'immagineRitaglio':{
      const d=o.documento;P.verifica(d,require('./citazioni-zaini').identita(v,z),d?.id);
      const b=M.posizioni(d).flatMap(p=>p.slide.blocks).find(b=>b.id===o.blockId);if(b?.type!=='image')throw Error('Immagine non disponibile.');
      const file=await require('./presentazioni-risorse').verifica(v,z,d.id,d.assets[b.assetId]),originale=nativeImage.createFromPath(file),size=originale.getSize();
      if(!size.width||!size.height)throw Error('Immagine non leggibile.');const scala=Math.min(1600/size.width,1600/size.height,1);
      return {immagine:originale.resize({width:Math.max(1,Math.round(size.width*scala)),height:Math.max(1,Math.round(size.height*scala))}).toDataURL(),width:size.width,height:size.height};
     }
     case 'vista':{
      const key=v+'\n'+z+'\n'+o.documento?.id;
      if(key!==anteprimaId){scartaVista();anteprima=require('./presentazioni-vista').crea({session:win.webContents.session,net,v,z,id:o.documento?.id});anteprimaId=key;}
      const documento=anteprima.compila(o.documento),immagini={};
      for(const a of M.risorseUsate(o.documento).map(id=>o.documento.assets[id]).filter(a=>a.kind==='image')){
       if(!immaginiMiniatura.has(a.sha256)){immaginiMiniatura.set(a.sha256,null);const file=D.percorso(area,path.join(P.directory(v,z,o.documento.id),a.path)),native=nativeImage.createFromPath(file),size=native.getSize();
        if(size.width&&size.height){const scala=Math.min(240/size.width,160/size.height,1);immaginiMiniatura.set(a.sha256,native.resize({width:Math.max(1,Math.round(size.width*scala)),height:Math.max(1,Math.round(size.height*scala))}).toDataURL());}
       }immagini[a.path]=immaginiMiniatura.get(a.sha256)||null;
      }
      const carte=new Set(M.posizioni(o.documento).map(p=>M.sfondoSlide(o.documento,p.slide).backgroundPattern).filter(Boolean));
      for(const nome of carte){const key='carta-'+nome;if(!immaginiMiniatura.has(key)){const file=path.join(appDir,'assets/presentazioni/carte',nome+'.png'),native=nativeImage.createFromPath(file);immaginiMiniatura.set(key,native.resize({width:240}).toDataURL());}immagini['carte/'+nome+'.png']=immaginiMiniatura.get(key);}
      return {documento,immagini};
     }
     case 'lascia':scartaVista();player?.chiudi();return {};
     case 'presenta':return await player.apri(v,z,o.id,o.baseRevision);
     case 'sessione':return player.comando(v,z,o);
     case 'regia':return {regia:player.regia()};
     case 'strumenti':return {strumenti:M.STRUMENTI,effetti:Object.keys(M.EFFETTI),sfondiMedia:true,importaFile:true,limiteMedia:M.LIMITE_MEDIA};
     case 'elenco':return {elenco:P.elenco(v,z)};
     case 'crea':return {documento:await P.crea(v,z,o.title)};
     case 'apri':return {documento:P.leggi(v,z,o.id),bozza:P.recupera(v,z,o.id)};
     case 'salva':return {documento:await P.salva(v,z,o.documento,o.baseRevision)};
     case 'bozza':return await P.bozza(v,z,o.documento,o.baseRevision);
     case 'recupera':return {bozza:P.recupera(v,z,o.id)};
     case 'precedente':return {documento:P.precedente(v,z,o.id)};
     case 'file':{
      const identita=require('./fonti-ai').identita(v,z);P.leggi(v,z,o.id);
      const estensioni=Object.entries(require('./presentazioni-risorse').MIME).filter(([,v])=>['image','video'].includes(v[0])).map(([k])=>k.slice(1));
      const scelta=await dialog.showOpenDialog(win,{title:'Carica immagine, GIF o video',properties:['openFile'],filters:[{name:'Immagini, GIF e video · massimo 512 MiB',extensions:estensioni}]});if(scelta.canceled||!scelta.filePaths[0])return {annullato:true};
      if(vaultDir()!==v)throw Error('Il vault è cambiato: ripeti il caricamento.');require('./fonti-ai').verificaIdentita(v,z,identita);
      const file=scelta.filePaths[0];return D.esegui({metadati:[v],lettura:[radice,file],scrittura:[area]},()=>require('./presentazioni-risorse').importaFile(v,z,o.id,file,o.baseRevision));
     }
     case 'materiale':return await require('./presentazioni-risorse').importa(v,z,o.id,o.trasporto,o.baseRevision);
     case 'compila':{P.verifica(o.documento,require('./citazioni-zaini').identita(v,z),o.documento?.id);return require('./presentazioni-export').html(o.documento);}
     case 'esporta':{
      const d=P.leggi(v,z,o.id),identita=require('./fonti-ai').identita(v,z);if(d.revision!==o.baseRevision)throw Error('Salva prima di esportare.');
      const scelta=await dialog.showOpenDialog(win,{title:'Esporta presentazione HTML',properties:['openDirectory','createDirectory']});if(scelta.canceled)return {annullato:true};
      require('./fonti-ai').verificaIdentita(v,z,identita);if(vaultDir()!==v)throw Error('Il vault è cambiato: ripeti l’esportazione.');
      const destinazione=scelta.filePaths[0];return D.esegui({metadati:[v],lettura:[radice,path.join(appDir,'..')],scrittura:[destinazione]},()=>require('./presentazioni-export').esporta(v,z,o.id,destinazione,o.baseRevision));
     }
     case 'elimina':return await P.elimina(v,z,o.id,cestina);
     default:throw Error('Comando PRESENTA non disponibile.');
    }
   });
   if(['crea','salva','elimina'].includes(o.azione)&&!win.isDestroyed())win.webContents.send('presenta:cambiata',{corso:z,id:r.documento?.id||r.id,revision:r.documento?.revision});
   return {ok:true,...r};
  }catch(err){return {ok:false,error:err.message};}
 });
}
module.exports={ponte,installa};
