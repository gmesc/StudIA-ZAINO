'use strict';
// Prova esplicita, esclusa da npm test: usa il modello già installato, MAI lo scarica.
// node test/rag-runtime-smoke.js /percorso/modello
if(process.argv[2]==='--worker'){
 globalThis.fetch=async()=>{throw Error('La prova vieta ogni accesso di rete.');};
 require('../lib/rag-worker');
}else{
 const assert=require('node:assert/strict'),{fork}=require('node:child_process'),M=require('../lib/rag-modello');
 async function run(dir){const child=fork(__filename,['--worker'],{env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},stdio:['ignore','ignore','pipe','ipc']});let seq=0;
  const embed=(text,query=false)=>new Promise((resolve,reject)=>{const id=String(++seq),timer=setTimeout(()=>{child.kill();reject(Error('Timeout'));},120000);const on=r=>{if(r.id!==id)return;child.off('message',on);clearTimeout(timer);if(r.error)reject(Error(r.error));else resolve(r);};child.on('message',on);child.send({id,dir,text,query,title:'Studio'});});
  try{const start=Date.now(),q=await embed('Quale organello fornisce energia alla cellula?',true),d=await embed('I mitocondri producono ATP attraverso la respirazione cellulare.'),bad=await embed('La rivoluzione francese cominciò nel 1789.');
   const dot=v=>v.reduce((s,n,i)=>s+n*q.vector[i],0);assert.equal(q.vector.length,768);assert(q.vector.every(Number.isFinite));assert(Math.abs(dot(q.vector)-1)<.02);assert(dot(d.vector)>dot(bad.vector)+.05);return {milliseconds:Date.now()-start,rss:q.memory,relevant:dot(d.vector),unrelated:dot(bad.vector)};
  }finally{child.kill();}
 }
 (async()=>{const dir=process.argv[2];if(!dir || !M.pronto(dir))throw Error('Passa una cartella del modello già installato.');console.log(JSON.stringify({offline:true,cold:await run(dir),reload:await run(dir)},null,2));})().catch(e=>{console.error(e);process.exitCode=1;});
}
