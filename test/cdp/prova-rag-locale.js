'use strict';
// Richiede un modello già installato: il runner lo collega al solo profilo sintetico.
const assert=require('node:assert/strict'),c=require('./cdp'),fs=require('node:fs'),path=require('node:path');
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
 const vault=await c.val('window.vault.path');assert(vault.includes('studia-zaino-prova-'));
 await c.val(`window.__autoSteps=[];window.__autoOff=window.vault.rag.onAuto(s=>window.__autoSteps.push({phase:s.phase,done:s.done,total:s.total,visible:!document.getElementById('zragAutoProgress').hidden}));document.getElementById('zragIndexOptions').open=false`);
 await wait(`window.vault.rag.state().then(r=>r.auto?.phase==='ready')`);
 const previous=(await c.val('window.vault.rag.state()')).auto.updatedAt;
 const file=path.join(vault,'Zaini','biologia',one.file),old=fs.readFileSync(file,'utf8');
 fs.writeFileSync(file,old+'\n\n'+('Le foglie trasformano la luce in energia chimica. '.repeat(90)));
 await wait(`window.vault.rag.state().then(r=>r.auto?.phase==='ready'&&r.auto.updatedAt!==${JSON.stringify(previous)})`);
 assert(await c.val(`window.__autoSteps.some(s=>s.phase==='indexing'&&s.total>0&&s.visible)`),'Avanzamento visibile anche con la sezione Indice chiusa');
 const updated=await c.val(`window.vault.rag.search('biologia','foglie ed energia',${JSON.stringify(scope)})`);assert(updated.indexed>1);assert.equal(updated.mode,'ibrida');
 const beforeAdd=(await c.val('window.vault.rag.state()')).auto.updatedAt;
 const imported=path.join(vault,'Zaini','biologia','MATERIALI','importato.txt');fs.writeFileSync(imported,'Le radici assorbono acqua e minerali.');
 await wait(`window.vault.rag.state().then(r=>r.auto?.phase==='ready'&&r.auto.updatedAt!==${JSON.stringify(beforeAdd)})`);
 const rootSearch=await c.val(`window.vault.rag.search('biologia','radici e acqua',{mode:'all',sourceIds:[],wikipedia:false})`);assert(rootSearch.chunks.some(s=>s.file.endsWith('importato.txt')));
 assert(rootSearch.indexed>=rootSearch.chunks.length);
 await c.val(`window.__autoOff();delete window.__autoOff;delete window.__autoSteps;`);fs.writeFileSync(file,old);fs.unlinkSync(imported);
 console.log('rag Electron: modello reale locale, indice incrementale, ricerca ibrida via IPC e ambito isolato OK');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
