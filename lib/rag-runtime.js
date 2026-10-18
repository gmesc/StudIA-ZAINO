'use strict';
const {fork}=require('node:child_process'),path=require('node:path'),{randomUUID}=require('node:crypto');
const M=require('./rag-modello');
function crea(dir){
 let child=null,active=null,timer=null,idle=null;const queue=[];
 function fail(error){if(active){active.reject(error);active=null;}clearTimeout(timer);const old=child;child=null;old?.kill();run();}
 function run(){
  if(active || !queue.length)return;
  clearTimeout(idle);queue.sort((a,b)=>b.priority-a.priority);active=queue.shift();
  if(active.signal?.aborted){active.reject(Error('Ricerca interrotta.'));active=null;return run();}
  if(!child){
   child=fork(path.join(__dirname,'rag-worker.js'),[],{env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},stdio:['ignore','ignore','pipe','ipc']});
   const current=child;child.stderr.on('data',()=>{});
   child.on('error',e=>{if(child===current)fail(e);});
   child.on('exit',()=>{if(child===current)fail(Error('Motore locale interrotto.'));});
   child.on('message',r=>{
    if(!active || r.id!==active.id)return;clearTimeout(timer);
    const a=active;active=null;
    if(r.error)a.reject(Error(r.error));else a.resolve({vector:r.vector,memory:r.memory});
    idle=setTimeout(()=>{const old=child;child=null;old?.kill();},60000);idle.unref();run();
   });
  }
  timer=setTimeout(()=>fail(Error('Tempo del motore locale scaduto.')),120000);
  child.send({id:active.id,dir,...active.input});
 }
 return {ready:()=>M.pronto(dir),dir,
  embed(text,{query=false,title='none',signal,priority=1}={}){
   if(!M.pronto(dir))return Promise.reject(Error('Installa prima il modello locale.'));
   if(typeof text!=='string' || text.length>16000)return Promise.reject(Error('Testo per ricerca non valido.'));
   return new Promise((resolve,reject)=>{
    const a={id:randomUUID(),input:{text,query,title},signal,priority,resolve,reject};
    if(signal?.aborted){reject(Error('Ricerca interrotta.'));return;}
    const cancel=()=>{const i=queue.indexOf(a);if(i>=0){queue.splice(i,1);a.reject(Error('Ricerca interrotta.'));}else if(active===a)fail(Error('Ricerca interrotta.'));};
    signal?.addEventListener('abort',cancel,{once:true});
    a.resolve=r=>{signal?.removeEventListener('abort',cancel);resolve(r);};a.reject=e=>{signal?.removeEventListener('abort',cancel);reject(e);};
    queue.push(a);run();
   });
  },close(){clearTimeout(idle);clearTimeout(timer);for(const a of queue.splice(0))a.reject(Error('Motore chiuso.'));const a=active;active=null;a?.reject(Error('Motore chiuso.'));const old=child;child=null;old?.kill();}
 };
}
module.exports={crea};
