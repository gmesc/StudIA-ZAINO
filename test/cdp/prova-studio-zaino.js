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
 assert.equal(await c.val(`!!document.querySelector('#studioPane #zragIndexOptions')`),false,'La spiegazione dell’indice vive solo in AI locale');
 assert.equal(await c.val(`document.getElementById('zschede').tagName`),'SECTION','Le schede sono la superficie principale sempre visibile');
 assert(await c.val(`document.getElementById('zstudio').firstElementChild.id==='zschede' && !document.getElementById('zschedeRead')`));
 await c.val(`bancoMostra('studio');document.getElementById('zragSearch').open=true`);await wait(`bancoVisibile('studio')`);assert.equal(await c.val(`!!document.querySelector('#zchatWindow #zstudio')`),false);await set('zragQuery','energia');await c.val(`document.getElementById('zragForm').requestSubmit()`);
 await wait(`document.querySelectorAll('#zragResults article').length>0`);assert(/Ricerca (lessicale|ibrida)/.test(await c.val(`document.getElementById('zragStatus').textContent`)));
 await wait(`document.getElementById('zschedePreset').options.length===5`);await click('#zschedeBack');await click('#zschedeNewButton');await wait(`document.getElementById('zschedeNew').open`);assert.equal(await c.val(`document.getElementById('zschedeNew').open`),true);
 await click('#zschedeEstimate');await wait(`!document.getElementById('zschedeGenerate').hidden`);assert((await c.val(`document.getElementById('zschedeTokens').textContent`)).includes('token'));
 await click('#zschedeGenerate');await wait(`document.querySelectorAll('#zschedeResult article').length===1`);
 assert.equal(await c.val(`document.querySelector('#zschedeResult strong').textContent`),'Energia cellulare');
 await wait(`document.querySelectorAll('#zschedeCollection article').length===1 && !document.getElementById('zschedeNewButton').disabled`);
 await click('#zschedeBack');await set('zschedeFilter','inesistente');assert.equal(await c.val(`document.querySelectorAll('#zschedeCollection article').length`),0);await set('zschedeFilter','Sintesi');
 await c.val(`document.getElementById('zschedeResult').replaceChildren()`);await click('#zschedeCollection button');await wait(`!!document.querySelector('#zschedeResult article')`);
 assert.deepEqual(await c.val(`[...document.querySelectorAll('#zschedeResult .zstudio-card-text strong')].map(e=>e.textContent)`),['Concetti:','Prerequisiti:','Esempi:']);
 // Il raccoglitore resta generale anche quando la ricerca ammette una sola fonte.
 const firstCard=(await c.val(`window.vault.studio.cards('biologia')`)).cards[0],other=(await c.val(`window.vault.chat.sources('biologia')`)).sources.find(s=>s.kind==='appunto'&&s.id!==firstCard.sourceId);assert(other);
 await click('#zschedeBack');await click('#zschedeNewButton');await wait(`document.getElementById('zschedeNew').open`);await set('zschedeSource',other.id);await set('zschedePreset','concetti');await click('#zschedeEstimate');await wait(`!document.getElementById('zschedeGenerate').hidden && !document.getElementById('zschedeGenerate').disabled`);await click('#zschedeGenerate');
 await wait(`document.getElementById('zschedeCollectionStatus').textContent.includes('2 schede') && !document.getElementById('zschedeNewButton').disabled`);
 await set('zschedeFilter','');assert.equal(await c.val(`document.querySelectorAll('#zschedeCollection article').length`),2);
 await click('#zschedeBack');await click('#zragSearchButton');await click('#zragScopeButton');await click('#zragScope input');await click('#zragScope [data-source-id="'+other.id+'"]');await click('#zragScopeButton');
 assert(await c.val(`document.getElementById('zschedeSource').options.length>1`),'il filtro della ricerca non limita la scheda');assert.equal(await c.val(`document.querySelectorAll('#zschedeCollection article').length`),2);await click('#zschedeBack');
 await set('zschedeFilter',firstCard.file);assert.equal(await c.val(`document.querySelectorAll('#zschedeCollection article').length`),1);
 const requests=path.join(path.dirname(vault),'dati/chat-requests.jsonl'),sent=fs.readFileSync(requests,'utf8');
 await click('#zschedeCollection .zstudio-card-open');await wait(`!!document.querySelector('#zschedeResult article') && !document.getElementById('zschedeNewButton').disabled`);assert.equal(fs.readFileSync(requests,'utf8'),sent,'Aprire una scheda salvata non chiama il provider');
 await click('#zschedeBack');await click('#zragSearchButton');await click('#zragScopeButton');await click('#zragScope input');await click('#zragScopeButton');await click('#zschedeBack');
 // Una modifica esterna aggiorna il raccoglitore aperto; la stima non rigenera.
 const cached=(await c.val(`window.vault.studio.cards('biologia')`)).cards.find(c=>c.preset==='sintesi');
 const sourceFile=path.join(vault,'Zaini/biologia',cached.file),original=fs.readFileSync(sourceFile),cacheFile=path.join(vault,'Zaini/biologia/_lavorazione/rag/schede',cached.sourceId+'-'+cached.preset+'.json'),before=fs.readFileSync(cacheFile,'utf8');
 try{
  fs.appendFileSync(sourceFile,'\nNuovo paragrafo di prova: energia conservata nei legami chimici.\n');
  await wait(`document.getElementById('zschedeCollection').textContent.includes('Fonte modificata')`);
  await click('#zschedeBack');await click('#zschedeCollection .zstudio-card-open');await wait(`!document.getElementById('zschedeNewButton').disabled`);await click('#zschedeResult .zstudio-card-regenerate');await wait(`!document.getElementById('zschedeGenerate').hidden && !document.getElementById('zschedeGenerate').disabled`);
  assert.equal(fs.readFileSync(cacheFile,'utf8'),before,'Mostrare la stima non deve chiamare il provider o modificare la scheda');
  assert((await c.val(`document.getElementById('zschedeEstimateText').textContent`)).includes(cached.file.split('/').pop()));
  await click('#zschedeGenerate');await wait(`!document.getElementById('zschedeNewButton').disabled && document.getElementById('zschedeCollection').textContent.includes('Aggiornata') && !document.getElementById('zschedeCollection').textContent.includes('Fonte modificata')`);
  assert.notEqual(fs.readFileSync(cacheFile,'utf8'),before,'La conferma rigenera la scheda');
 }finally{fs.writeFileSync(sourceFile,original);}
 await click('#zschedeResult>button');await wait(`document.getElementById('zragStatus').textContent.includes('conservata')`);
 assert(fs.readdirSync(path.join(vault,'Zaini','biologia','APPUNTI')).some(f=>f.startsWith('Scheda AI')));
 const note=await c.val(`({title:noteStatoAttivo().cur.title,body:noteStatoAttivo().mde.value()})`);assert(note.title.startsWith('Sintesi — '));assert(note.body.startsWith('### '+note.title+'\n'));assert(note.body.includes('**Prerequisiti:**'));
 // Integrazione: la copia RAG usa anche la cronologia aggiunta dalla demo.
 const copied=await c.val(`noteStatoAttivo().mde.value()`);
 await c.val(`(()=>{const cm=noteStatoAttivo().mde.codemirror;cm.replaceRange(' Verifica cronologia RAG.',{line:cm.lastLine(),ch:cm.getLine(cm.lastLine()).length},undefined,'prova-merge');})()`);
 assert((await c.val(`noteStatoAttivo().mde.value()`)).endsWith('Verifica cronologia RAG.'));
 await c.val(`noteHost(noteStatoAttivo()).querySelector('.ncb-undo').click()`);assert.equal(await c.val(`noteStatoAttivo().mde.value()`),copied);
 await c.val(`noteHost(noteStatoAttivo()).querySelector('.ncb-redo').click()`);assert((await c.val(`noteStatoAttivo().mde.value()`)).endsWith('Verifica cronologia RAG.'));
 await c.val(`noteHost(noteStatoAttivo()).querySelector('.ncb-undo').click()`);assert.equal(await c.val(`noteStatoAttivo().mde.value()`),copied);
 assert.equal(await c.val(`document.getElementById('zragOpenReview')`),null);
 await click('#zstudyQueueFilter [data-filter="all"]');
 for(const theme of ['chiaro','scuro']){
  await c.val(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
  assert(await c.val(`['#zragSearch>summary'].every(sel=>{const s=getComputedStyle(document.querySelector(sel));return s.backgroundColor!=='rgba(0, 0, 0, 0)' && parseFloat(s.fontWeight)>=600;})`));
 }
 await c.val(`document.documentElement.dataset.theme='chiaro'`);
 await c.val(`document.getElementById('zchatWindow').hidden=true;bancoMostra('flashcard')`);await wait(`bancoVisibile('flashcard')`);
 assert.equal(await c.val(`document.getElementById('zinterroga').tagName`),'SECTION');
 assert.equal(await c.val(`document.getElementById('zstudyCancel').hidden`),true);
 const sources=(await c.val(`window.vault.chat.sources('biologia')`)).sources,selected=sources.find(s=>s.file.includes('Fotosintesi'));
 await click('#zstudyScopeButton');await wait(`document.querySelectorAll('#zstudyScope input').length>1`);
 await click('#zstudyScope input');await click('#zstudyScope [data-source-id="'+selected.id+'"]');await click('#zstudyScopeButton');
 assert.equal(await c.val(`document.querySelector('#zragScopeButton span').textContent`),'Fonti: tutte');
 await c.val(`document.getElementById('zstudyNew').open=true`);await set('zstudyTopic','fotosintesi');await click('#zstudyStart');await wait(`!!document.querySelector('#zstudyQuestion h3')`);
 assert.equal(await c.val(`document.querySelector('#zstudyQuestion h3').textContent`),'Quale processo converte la luce?');
 assert(!(await c.val(`document.getElementById('zstudyQuestion').textContent`)).includes('Risposta attesa e criteri'));
 await wait(`!document.getElementById('zstudyScopeButton').disabled`);
 await set('zstudyAttempt','Bozza da preservare');
 await click('#zstudyScopeButton');await click('#zstudyScope [data-source-id="'+selected.id+'"]');await wait(`!document.querySelector('#zstudyQuestion h3')`);
 assert.equal(await c.val(`document.getElementById('zstudyQueue').hidden`),true);
 await click('#zstudyScope [data-source-id="'+selected.id+'"]');await wait(`!!document.getElementById('zstudyAttempt')`);
 assert.equal(await c.val(`document.getElementById('zstudyAttempt').value`),'Bozza da preservare');await click('#zstudyScopeButton');
 await set('zstudyAttempt','La fotosintesi.');await c.val(`document.querySelector('#zstudyQuestion form').requestSubmit()`);await wait(`document.getElementById('zstudyQuestion').textContent.includes('Il tentativo è coerente')`);
 await c.val(`[...document.querySelectorAll('#zstudyQuestion button')].find(b=>b.textContent==='Conserva nel ripasso').click()`);await wait(`document.getElementById('zstudyCount').textContent.startsWith('1 domanda')`);
 await c.val(`[...document.querySelectorAll('#zstudyQuestion button')].find(b=>b.textContent.startsWith('buono')).click()`);await wait(`document.getElementById('zstudyQuestion').textContent.includes('prossimo:')`);
 const state=await c.val(`window.vault.studio.state('biologia')`),q=state.questions.find(q=>q.saved);assert(q);assert.equal(q.attempts.length,1);assert.equal(q.esito,'buono');assert.deepEqual(q.scope.sourceIds,[selected.id]);assert(q.sources.every(s=>s.sourceId===selected.id));
 await c.val(`window.vault.rag.reset('biologia')`);assert.equal((await c.val(`window.vault.studio.state('biologia')`)).questions.find(x=>x.id===q.id).attempts.length,1);
 await c.val('location.reload()');await c.pausa(800);await c.collega();await wait(`!!document.getElementById('zstudyBrowse') && typeof bancoMostra==='function'`);await c.val(`bancoMostra('flashcard')`);await c.val(`window.zainoRipasso.refresh()`);await wait(`document.getElementById('zstudyQuestion').textContent.includes('Il tentativo è coerente')`);
 assert.equal(await c.val(`document.querySelector('#zstudyScopeButton span').textContent`),'Fonti: 1');
 await click('#zstudyQueueFilter [data-filter="all"]');
 for(const theme of ['chiaro','scuro']){
  await c.val(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
  for(const [nav,ids] of [['zstudyNewButton',['zstudyTopic','zstudyStart']],['zstudyBrowse',['zstudySearch','zstudyOrigin']]]){
   await click('#'+nav);
   const layout=await c.val(`(()=>{const root=getComputedStyle(document.documentElement);return ${JSON.stringify(ids)}.map(id=>{const e=document.getElementById(id),s=getComputedStyle(e);return {id,height:e.getBoundingClientRect().height,expected:parseFloat(root.getPropertyValue(e.tagName==='BUTTON'?'--tb-h':'--ctl-h')),radius:s.borderRadius};});})()`);
   for(const e of layout){assert(Math.abs(e.height-e.expected)<1.2,JSON.stringify(e));assert.equal(e.radius,'0px');}
   await click('#zstudyBack');
  }
  await click('#zstudyRetry');
  assert(await c.val(`document.getElementById('zstudyAttempt').getBoundingClientRect().height>parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ctl-h'))*2`),'Il tentativo offre più righe per scrivere');
 }
 await c.val(`document.documentElement.dataset.theme='chiaro'`);
 const shot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/private/tmp/zaino-rag-ripasso.png',Buffer.from(shot.result.data,'base64'));
 console.log('studio UI: ricerca, stima, scheda, copia, Banco, tentativo, esito, persistenza e cache indipendente OK');process.exit(0);
})().catch(async e=>{console.error(e);try{console.error(await c.val(`({rag:document.getElementById('zragStatus')?.textContent,studio:document.getElementById('zstudyStatus')?.textContent,chat:document.getElementById('zchatStatus')?.textContent})`));}catch(_){}process.exit(1);});
