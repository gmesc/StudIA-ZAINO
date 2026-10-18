'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),c=require('./cdp');
async function wait(expr){for(let n=0;n<180;n++){if(await c.val(expr))return;await c.pausa(100);}throw Error('Attesa: '+expr);}
const click=sel=>c.val(`document.querySelector(${JSON.stringify(sel)}).click()`);
const set=(id,value)=>c.val(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
(async()=>{
 await c.collega();await wait(`typeof zainoAttivo==='function' && zainoAttivo()==='biologia' && !!window.vault.studio`);
 const vault=await c.val('window.vault.path');assert(vault.includes('studia-zaino-prova-'));
 await c.val(`window.vault.chat.setKey({provider:'openai',value:'chiave-finta-della-prova'})`);await c.val(`window.vault.chat.saveSettings({provider:'openai',model:'modello-locale-di-prova'})`);
 await c.val('location.reload()');await c.pausa(800);await c.collega();await wait(`!!document.getElementById('zstudio')`);
 await c.val(`bancoMostra('studio')`);await wait(`bancoVisibile('studio')`);assert.equal(await c.val(`!!document.querySelector('#zchatWindow #zstudio')`),false);await set('zragQuery','energia');await c.val(`document.getElementById('zragForm').requestSubmit()`);
 await wait(`document.querySelectorAll('#zragResults article').length>0`);assert((await c.val(`document.getElementById('zragStatus').textContent`)).includes('lessicale'));
 await c.val(`document.getElementById('zschede').open=true`);await wait(`document.getElementById('zschedePreset').options.length===5`);
 await click('#zschedeEstimate');await wait(`!document.getElementById('zschedeGenerate').hidden`);assert((await c.val(`document.getElementById('zschedeEstimateText').textContent`)).includes('token'));
 await click('#zschedeGenerate');await wait(`document.querySelectorAll('#zschedeResult article').length===1`);
 assert.equal(await c.val(`document.querySelector('#zschedeResult strong').textContent`),'Energia cellulare');
 assert.deepEqual(await c.val(`[...document.querySelectorAll('#zschedeResult .zstudio-card-text strong')].map(e=>e.textContent)`),['Concetti:','Prerequisiti:','Esempi:']);
 await click('#zschedeResult>button');await wait(`document.getElementById('zragStatus').textContent.includes('conservata')`);
 assert(fs.readdirSync(path.join(vault,'Zaini','biologia','APPUNTI')).some(f=>f.startsWith('Scheda AI')));
 const note=await c.val(`({title:noteStatoAttivo().cur.title,body:noteStatoAttivo().mde.value()})`);assert(note.title.startsWith('Sintesi — '));assert(note.body.startsWith('### '+note.title+'\n'));assert(note.body.includes('**Prerequisiti:**'));
 assert.equal(await c.val(`document.getElementById('zragOpenReview').textContent`),'Apri Ripasso');
 for(const theme of ['chiaro','scuro']){
  await c.val(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
  assert(await c.val(`['zragIndexOptions','zschede'].every(id=>{const s=getComputedStyle(document.querySelector('#'+id+'>summary'));return s.backgroundColor!=='rgba(0, 0, 0, 0)' && parseFloat(s.fontWeight)>=600;})`));
 }
 await c.val(`document.documentElement.dataset.theme='chiaro'`);
 await c.val(`document.getElementById('zchatWindow').hidden=true;bancoMostra('flashcard')`);await wait(`bancoVisibile('flashcard')`);
 assert.equal(await c.val(`document.getElementById('zinterroga').tagName`),'SECTION');
 assert.equal(await c.val(`document.getElementById('zstudyCancel').hidden`),true);
 const sources=(await c.val(`window.vault.chat.sources('biologia')`)).sources,selected=sources.find(s=>s.file.includes('Fotosintesi'));
 await click('#zstudyScopeButton');await wait(`document.querySelectorAll('#zstudyScope input').length>1`);
 await click('#zstudyScope input');await click('#zstudyScope [data-source-id="'+selected.id+'"]');await click('#zstudyScopeButton');
 assert.equal(await c.val(`document.querySelector('#zragScopeButton span').textContent`),'Fonti: tutte');
 await set('zstudyTopic','fotosintesi');await click('#zstudyStart');await wait(`!!document.querySelector('#zstudyQuestion h3')`);
 assert.equal(await c.val(`document.querySelector('#zstudyQuestion h3').textContent`),'Quale processo converte la luce?');
 assert(!(await c.val(`document.getElementById('zstudyQuestion').textContent`)).includes('Risposta attesa e criteri'));
 await wait(`!document.getElementById('zstudyScopeButton').disabled`);
 await set('zstudyAttempt','Bozza da preservare');
 await click('#zstudyScopeButton');await click('#zstudyScope [data-source-id="'+selected.id+'"]');await wait(`!document.querySelector('#zstudyQuestion h3')`);
 assert.equal(await c.val(`document.getElementById('zstudyQueue').hidden`),true);
 await click('#zstudyScope [data-source-id="'+selected.id+'"]');await wait(`!!document.getElementById('zstudyAttempt')`);
 assert.equal(await c.val(`document.getElementById('zstudyAttempt').value`),'Bozza da preservare');await click('#zstudyScopeButton');
 await set('zstudyAttempt','La fotosintesi.');await c.val(`document.querySelector('#zstudyQuestion form').requestSubmit()`);await wait(`document.getElementById('zstudyQuestion').textContent.includes('Il tentativo è coerente')`);
 await c.val(`[...document.querySelectorAll('#zstudyQuestion button')].find(b=>b.textContent==='Conserva nel ripasso').click()`);await wait(`document.getElementById('zstudyCount').textContent.startsWith('1 carta')`);
 await c.val(`[...document.querySelectorAll('#zstudyQuestion button')].find(b=>b.textContent.startsWith('buono')).click()`);await wait(`document.getElementById('zstudyQuestion').textContent.includes('prossimo:')`);
 const state=await c.val(`window.vault.studio.state('biologia')`),q=state.questions.find(q=>q.saved);assert(q);assert.equal(q.attempts.length,1);assert.equal(q.esito,'buono');assert.deepEqual(q.scope.sourceIds,[selected.id]);assert(q.sources.every(s=>s.sourceId===selected.id));
 await c.val(`window.vault.rag.reset('biologia')`);assert.equal((await c.val(`window.vault.studio.state('biologia')`)).questions.find(x=>x.id===q.id).attempts.length,1);
 await c.val('location.reload()');await c.pausa(800);await c.collega();await wait(`!!document.getElementById('zstudyRefresh') && typeof bancoMostra==='function'`);await c.val(`bancoMostra('flashcard')`);await click('#zstudyRefresh');await wait(`document.getElementById('zstudyQuestion').textContent.includes('Il tentativo è coerente')`);
 assert.equal(await c.val(`document.querySelector('#zstudyScopeButton span').textContent`),'Fonti: 1');
 for(const theme of ['chiaro','scuro']){
  await c.val(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
  const layout=await c.val(`(()=>{const root=getComputedStyle(document.documentElement),ids=['zstudyTopic','zstudySaved','zstudyStart','zstudyRefresh'];return ids.map(id=>{const e=document.getElementById(id),s=getComputedStyle(e);return {id,height:e.getBoundingClientRect().height,expected:parseFloat(root.getPropertyValue(e.tagName==='BUTTON'?'--tb-h':'--ctl-h')),radius:s.borderRadius};});})()`);
  for(const e of layout){assert(Math.abs(e.height-e.expected)<1.2,JSON.stringify(e));assert.equal(e.radius,'0px');}
  assert(await c.val(`document.getElementById('zstudyAttempt').getBoundingClientRect().height>parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ctl-h'))*2`),'Il tentativo offre più righe per scrivere');
 }
 await c.val(`document.documentElement.dataset.theme='chiaro'`);
 const shot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/private/tmp/zaino-rag-ripasso.png',Buffer.from(shot.result.data,'base64'));
 console.log('studio UI: ricerca, stima, scheda, copia, Banco, tentativo, esito, persistenza e cache indipendente OK');process.exit(0);
})().catch(async e=>{console.error(e);try{console.error(await c.val(`({rag:document.getElementById('zragStatus')?.textContent,studio:document.getElementById('zstudyStatus')?.textContent,chat:document.getElementById('zchatStatus')?.textContent})`));}catch(_){}process.exit(1);});
