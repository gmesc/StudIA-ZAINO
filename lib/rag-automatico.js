'use strict';
// Osserva solo le fonti dello zaino aperto: cache e salvataggi interni non
// devono innescare un nuovo giro. Le raffiche di salvataggi diventano un lavoro.
const fs=require('node:fs'),F=require('./fonti-ai'),P=require('./chat-profili'),R=require('./rag');
function rilevante(nome){
 if(nome==null)return true;
 const parti=String(nome).replace(/\\/g,'/').split('/');
 return ['APPUNTI','MATERIALI'].includes(parti[0]) && !parti.some(p=>p.startsWith('.')||p.startsWith('_')||['Indici-PDF','Trascrizioni','Analisi','Indici'].includes(p));
}
function crea({vault,zaino,runtime,onState=()=>{},delay=1200,watch=fs.watch,indicizza=R.indicizza}){
 const origine=F.identita(vault,zaino),scope={mode:'all',sourceIds:[],wikipedia:false};
 let timer,controller,running=null,closed=false,paused=false,dirty=false,force=false,signature='',watchError='';
 let state={zaino,phase:'queued',done:0,total:0,reused:0,warnings:[],indice:R.statoIndice(vault,zaino)};
 function publish(next){if(closed)return;state={...state,...next};onState({...state});}
 async function execute(){
  dirty=false;const forced=force;force=false;
  try{
   F.verificaIdentita(vault,zaino,origine);
   if(!runtime.ready()){publish({phase:'waiting-model'});return;}
   const inventory=F.sincronizza(vault,zaino),next=R.firmaIndice(inventory),indice=R.statoIndice(vault,zaino,inventory);
   if(!forced&&signature===next){publish({phase:state.warnings.length?'warning':'ready',indice});return;}
   controller=new AbortController();publish({phase:'extracting',done:0,total:0,reused:0,file:'',warnings:[],indice});
   const result=await indicizza(vault,zaino,{runtime,scope,signal:controller.signal,progress:p=>publish({phase:'indexing',...p})});
   if(controller.signal.aborted)return;
   signature=next;
   const warnings=[...result.warnings,...(watchError?[watchError]:[])];
   publish({...result,warnings,phase:warnings.length?'warning':'ready',file:'',updatedAt:new Date().toISOString(),indice:R.statoIndice(vault,zaino,F.sincronizza(vault,zaino))});
  }catch(e){signature='';if(!controller?.signal.aborted)publish({phase:'error',warnings:[e.message],file:'',indice:{...state.indice,current:false}});}
  finally{controller=null;}
 }
 function request(forced=false){
  if(closed)return;dirty=true;force=force||forced;clearTimeout(timer);
  if(paused||running)return;
  publish({phase:runtime.ready()?'queued':'waiting-model',indice:{...state.indice,current:false}});
  timer=setTimeout(()=>{
   if(closed||paused||running)return;
   running=execute().finally(()=>{running=null;if(dirty&&!closed&&!paused)request();});
  },delay);timer.unref?.();
 }
 const watcher=watch(P.percorsoSicuro(vault,F.parti(zaino)),{recursive:true},(_,name)=>{if(rilevante(name))request();});
 watcher.on('error',e=>{watchError='Osservazione delle fonti interrotta: '+e.message;publish({phase:'error',warnings:[watchError]});});
 request(true);
 return {vault,zaino,state:()=>({...state}),request,
  async pause(){paused=true;clearTimeout(timer);controller?.abort();await running;signature='';publish({phase:'paused'});},
  resume(){paused=false;request();},
  async close(){closed=true;clearTimeout(timer);watcher.close();controller?.abort();await running;}
 };
}
module.exports={crea,rilevante};
