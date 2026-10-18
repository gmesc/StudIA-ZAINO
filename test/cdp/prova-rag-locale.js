'use strict';
// Richiede un modello già installato: il runner lo collega al solo profilo sintetico.
const assert=require('node:assert/strict'),c=require('./cdp');
async function wait(expr){for(let n=0;n<100;n++){if(await c.val(expr))return;await c.pausa(100);}throw Error('Attesa: '+expr);}
(async()=>{
 await c.collega();await wait(`typeof zainoAttivo==='function' && zainoAttivo()==='biologia' && !!window.vault.rag`);
 if(!(await c.val('window.vault.rag.state()')).ready){console.log('SKIP: prova reale RAG richiede STUDIA_RAG_MODEL con il modello già installato.');process.exit(0);}
 const sources=(await c.val(`window.vault.chat.sources('biologia')`)).sources;
 const one=sources.find(s=>s.kind==='appunto'&&s.file.includes('Fotosintesi'));
 const scope={mode:'selected',sourceIds:[one.id],wikipedia:false};
 const indexed=await c.val(`window.vault.rag.index('biologia',${JSON.stringify(scope)})`);assert(indexed.ok);assert.equal(indexed.done,1);
 const search=await c.val(`window.vault.rag.search('biologia','Come le piante ottengono nutrimento dal sole?',${JSON.stringify(scope)})`);assert(search.ok);assert.equal(search.mode,'ibrida');assert.equal(search.indexed,1);assert.equal(search.chunks[0].sourceId,one.id);
 const again=await c.val(`window.vault.rag.index('biologia',${JSON.stringify(scope)})`);assert.equal(again.reused,1);
 console.log('rag Electron: modello reale locale, indice incrementale, ricerca ibrida via IPC e ambito isolato OK');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
