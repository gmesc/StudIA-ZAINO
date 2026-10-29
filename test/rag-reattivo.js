'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const C=require('../lib/chat'),R=require('../lib/rag');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'zaino-rag-reattivo-')),d=path.join(root,'Zaini/test');
const runtime={ready:()=>true,embed:async()=>({vector:Array(768).fill(0)})};
(async()=>{
 fs.mkdirSync(path.join(d,'MATERIALI'),{recursive:true});fs.writeFileSync(path.join(d,'_zaino.md'),'# Test');
 for(let i=0;i<12;i++)fs.writeFileSync(path.join(d,'MATERIALI',i+'.txt'),'Testo della fonte '+i);
 await R.indicizza(root,'test',{runtime});
 let risposta=false;setImmediate(()=>{risposta=true;});
 const contesto=await C.contesto(root,'test','',{allChunks:true});assert.equal(contesto.documents,12);
 assert(risposta,'la lettura della cache deve lasciare rispondere il main fra due documenti');
 let intermedio=false,programmato=false,completo=false;
 const indice=await R.indicizza(root,'test',{runtime,progress:p=>{
  if(!programmato&&p.done>0){programmato=true;setImmediate(()=>{intermedio=!completo;});}
  if(p.done===p.total)completo=true;
 }});
 assert.equal(indice.reused,12);assert(intermedio,'anche il riuso dei vettori deve lasciare rispondere il main');
 const ctrl=new AbortController();setImmediate(()=>ctrl.abort());
 await assert.rejects(C.contesto(root,'test','',{allChunks:true,signal:ctrl.signal}),/interrott/i,'Annulla deve arrivare durante la lettura della cache');
 console.log('✓ RAG reattivo: main disponibile fra fonti e vettori in cache, annullamento durante il recupero');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>fs.rmSync(root,{recursive:true,force:true}));
