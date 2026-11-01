'use strict';
const path=require('node:path'),{pathToFileURL}=require('node:url');
const D=require('./permessi-disco'),P=require('./presentazioni'),M=require('../App/assets/presentazioni/modello');
function ponte(ipc){return {comando:o=>ipc.invoke('presenta:comando',o),onCambiata:fn=>{const h=(_e,d)=>fn(d);ipc.on('presenta:cambiata',h);return ()=>ipc.removeListener('presenta:cambiata',h);}};}
function installa({win,appDir,vaultDir,cestina,dialog}){
 const url=pathToFileURL(path.join(appDir,'StudIA.html')).href;
 win.webContents.ipc.handle('presenta:comando',async(e,o={})=>{
  try{
   if(e.sender!==win.webContents||e.senderFrame!==win.webContents.mainFrame||e.senderFrame.url.split('#')[0]!==url)throw Error('Richiesta PRESENTA non autorizzata.');
   const v=vaultDir(),z=o.corso;if(!v||!require('./zaini').nomeValido(z))throw Error('Apri uno zaino per usare PRESENTA.');
   const radice=D.percorso(v,path.join(v,...require('./fonti-ai').parti(z))),area=D.percorso(v,path.join(radice,P.CARTELLA));
   const scrive=['crea','salva','bozza','materiale','elimina'].includes(o.azione);
   const scrittura=scrive?[area]:[];
   if(o.azione==='crea')scrittura.push(D.percorso(v,path.join(radice,'_identita.json')));
   if(o.azione==='materiale')scrittura.push(...['_identita.json','_fonti-ai.json'].map(n=>D.percorso(v,path.join(radice,n))));
   const r=await D.esegui({metadati:[v],lettura:[radice,path.join(appDir,'..')],scrittura},async()=>{
    switch(o.azione){
     case 'strumenti':return {strumenti:M.STRUMENTI};
     case 'elenco':return {elenco:P.elenco(v,z)};
     case 'crea':return {documento:await P.crea(v,z,o.title)};
     case 'apri':return {documento:P.leggi(v,z,o.id),bozza:P.recupera(v,z,o.id)};
     case 'salva':return {documento:await P.salva(v,z,o.documento,o.baseRevision)};
     case 'bozza':return await P.bozza(v,z,o.documento,o.baseRevision);
     case 'recupera':return {bozza:P.recupera(v,z,o.id)};
     case 'precedente':return {documento:P.precedente(v,z,o.id)};
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
