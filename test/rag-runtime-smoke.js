'use strict';
// Prova esplicita, esclusa da npm test: usa il modello già installato, MAI lo scarica.
// node test/rag-runtime-smoke.js /percorso/modello
if(process.argv[2]==='--worker'){
 globalThis.fetch=async()=>{throw Error('La prova vieta ogni accesso di rete.');};
 require('../lib/rag-worker');
}else{
 const assert=require('node:assert/strict'),{fork}=require('node:child_process'),M=require('../lib/rag-modello');
 async function run(dir){const child=fork(__filename,['--worker'],{env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},stdio:['ignore','ignore','pipe','ipc']});let seq=0;
  const embed=(text,query=false,title='Studio')=>new Promise((resolve,reject)=>{const id=String(++seq),timer=setTimeout(()=>{child.kill();reject(Error('Timeout'));},120000);const on=r=>{if(r.id!==id)return;child.off('message',on);clearTimeout(timer);if(r.error)reject(Error(r.error));else resolve(r);};child.on('message',on);child.send({id,dir,text,query,title});});
  try{const start=Date.now(),q=await embed('Quale organello fornisce energia alla cellula?',true),d=await embed('I mitocondri producono ATP attraverso la respirazione cellulare.'),bad=await embed('La rivoluzione francese cominciò nel 1789.');
   const dot=v=>v.reduce((s,n,i)=>s+n*q.vector[i],0);assert.equal(q.vector.length,768);assert(q.vector.every(Number.isFinite));assert(Math.abs(dot(q.vector)-1)<.02);assert(dot(d.vector)>dot(bad.vector)+.05);
   let schede;
   if(process.argv.includes('--schede')){
    const Piano=require('../App/assets/chat/schede-piano'),items=[
     {title:'Come producono energia i mitocondri?',text:'I mitocondri producono ATP attraverso la respirazione cellulare.'},
     {title:'In che modo i mitocondri ricavano ATP?',text:'La respirazione cellulare permette ai mitocondri di produrre ATP.'},
     {title:'Come avviene la fotosintesi?',text:'I cloroplasti convertono energia luminosa in energia chimica.'},
     {title:'Come producono energia i mitocondri?',text:'I mitocondri non producono ATP attraverso la respirazione cellulare.'},
     {title:'Che cosa causò la rivoluzione francese?',text:'La crisi economica e gli squilibri sociali contribuirono alla rivoluzione del 1789.'},
     {title:'Che cosa misura l’indice di rifrazione?',text:'È il rapporto tra la velocità della luce nel vuoto e nel materiale.'}
    ].map((i,n)=>({...i,refs:['prova-'+n]})),vectors=[];
    for(const i of items)vectors.push((await embed(i.title+'\n'+i.text,false,'none')).vector);
    const plan=Piano.confrontiLocali(items,vectors),presenti=new Set(plan.jobs.flatMap(g=>g.map(i=>i.id)));
    assert(presenti.has(0)&&presenti.has(1),'Le parafrasi reali devono essere candidate');assert(presenti.has(3),'La negazione richiede conferma, non unione automatica');
    assert(!presenti.has(4)&&!presenti.has(5),'Argomenti distinti non richiedono confronto cloud');assert.equal(Piano.unisci(items).length,items.length);
    assert.deepEqual(Piano.unisci(items,[[0,1]])[0].refs,['prova-0','prova-1']);
    schede={candidates:presenti.size,total:items.length,groups:plan.jobs.length,cloudInputCharacters:JSON.stringify(plan.jobs).length,fullInputCharacters:JSON.stringify(Piano.confronti(items)).length};
   }
   return {milliseconds:Date.now()-start,rss:q.memory,relevant:dot(d.vector),unrelated:dot(bad.vector),...(schede?{schede}:{})};
  }finally{child.kill();}
 }
 (async()=>{const dir=process.argv[2];if(!dir || !M.pronto(dir))throw Error('Passa una cartella del modello già installato.');console.log(JSON.stringify({offline:true,cold:await run(dir),reload:await run(dir)},null,2));})().catch(e=>{console.error(e);process.exitCode=1;});
}
