'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),c=require('./cdp'),S=require('../../lib/schede-zaino');
async function wait(expr){for(let n=0;n<180;n++){if(await c.val(expr))return;await c.pausa(80);}throw Error('Attesa: '+expr+' '+JSON.stringify(await c.val(`({status:document.getElementById('zstudyStatus')?.textContent,focus:document.activeElement?.outerHTML,domanda:document.getElementById('zstudyQuestion')?.textContent})`)));}
async function click(sel){await c.val(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({block:'nearest'})`);await c.pausa(80);await c.clicca(sel);}
const set=(id,value)=>c.val(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);
(async()=>{
 await c.collega();await wait(`!!window.zainoStudio && document.getElementById('zschedePreset')?.options.length===5`);
 const vault=await c.val('window.vault.path');assert(vault.includes('studia-zaino-prova-'));
 const initial=await c.val(`({banco:bancoStato(),theme:document.documentElement.dataset.theme,storage:{...localStorage}})`),base=path.join(vault,'Zaini/biologia'),backups=new Map();
 const backup=file=>backups.set(file,fs.existsSync(file)?fs.readFileSync(file):null);
 const sources=(await c.val(`window.vault.chat.sources('biologia')`)).sources.filter(s=>s.kind==='pdf');assert(sources.length>=2);
 const requests=path.join(path.dirname(vault),'dati/chat-requests.jsonl'),sent=()=>fs.existsSync(requests)?fs.readFileSync(requests,'utf8'):'';
 const cards=sources.slice(0,2).map((s,i)=>({version:1,preset:'domande',sourceId:s.id,revision:s.revision,file:s.file,createdAt:new Date().toISOString(),provider:'prova',model:'sintetico',sources:[{sourceId:s.id,revision:s.revision,file:s.file,kind:'pdf',page:1,chunkId:'prova-elenco-'+i,quote:'Prova sintetica.'}],items:(i?['Quali organelli contengono le cellule?']:['Come utilizzano la luce le piante per produrre energia chimica e quale ruolo svolge la clorofilla in questo processo?','Perché le piante hanno bisogno di acqua?']).map(title=>({title,text:'Risposta sintetica da non anticipare.',refs:['prova-elenco-'+i]}))}));
 backup(path.join(base,'RIPASSO/active.json'));
 for(const card of cards){const file=path.join(base,'_lavorazione/rag/schede',card.sourceId+'-domande.json');backup(file);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(card));for(const item of card.items)backup(path.join(base,'RIPASSO/domande',S.idDomanda(card,item)+'.json'));}
 const single=path.join(base,'RIPASSO/domande/prova-domanda-singola.json');backup(single);fs.mkdirSync(path.dirname(single),{recursive:true});fs.writeFileSync(single,JSON.stringify({id:'prova-domanda-singola',question:'Quali materiali servono a una pianta?',createdAt:new Date().toISOString(),saved:true,attempts:[],sources:cards[0].sources,scope:{mode:'all',sourceIds:[],wikipedia:false}}));
 const id=S.idDomanda(cards[0],cards[0].items[0]),record=path.join(base,'RIPASSO/domande',id+'.json'),before=sent();assert(!fs.existsSync(record));
 try{
  await c.val(`bancoForma('uno');bancoAssegna('A','flashcard')`);await click('#zstudyBrowse');
  // Una prova precedente può aver limitato le fonti: il catalogo rispetta quel filtro.
  await click('#zstudyScopeButton');await wait(`document.querySelector('#zstudyScope input')`);
  if(!await c.val(`document.querySelector('#zstudyScope input').checked`))await click('#zstudyScope input');
  await click('#zstudyScopeButton');await set('zstudySearch','');await click('#zstudyQueueFilter [data-filter="all"]');
  await wait(`document.querySelector('#zstudyOrigin option[value="${cards[0].sourceId}"]')`);await set('zstudyOrigin','all');
  const fold='#zstudyQueue details[data-scheda-id="'+cards[0].sourceId+'"]';
  assert(await c.val(`document.querySelector(${JSON.stringify(fold)}).open`));await click(fold+' > summary');
  await wait(`!document.querySelector(${JSON.stringify(fold)}).open`);
  assert(await c.val(`document.querySelector('#zstudyQueue [data-question-id="prova-domanda-singola"]').checkVisibility()`),'Le domande singole non si chiudono insieme alla scheda');
  assert.equal(await c.val(`document.querySelector(${JSON.stringify(fold+' button')}).checkVisibility()`),false);
  await set('zstudyOrigin',cards[0].sourceId);assert.equal(await c.val(`document.querySelector(${JSON.stringify(fold)}).open`),false,'Il filtro conserva il gruppo chiuso');
  await click('#zstudyNewButton');await click('#zstudyBrowse');await wait(`document.querySelector(${JSON.stringify(fold+' > summary')})`);assert.equal(await c.val(`document.querySelector(${JSON.stringify(fold)}).open`),false);
  await c.val(`document.querySelector(${JSON.stringify(fold+' > summary')}).focus()`);await c.invia('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});await c.invia('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await wait(`document.querySelector(${JSON.stringify(fold)}).open`);
  assert.equal(await c.val(`document.querySelectorAll('#zstudyQueue .zstudy-question-open').length`),2);assert(!fs.existsSync(record));
  assert.equal(await c.val(`document.querySelectorAll('#zstudyQueue .zstudy-origin-chip').length`),2);
  await set('zstudySearch','LUCE');assert.equal(await c.val(`document.querySelectorAll('#zstudyQueue .zstudy-question-open').length`),1);
  await c.val(`document.querySelector('#zstudyQueue .zstudy-question-open').focus()`);await c.invia('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});await c.invia('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await wait(`!!document.getElementById('zstudyAttempt') && document.getElementById('zstudyCancel').hidden`);
  assert.equal(await c.val(`document.querySelector('#zstudyQuestion h3').textContent`),cards[0].items[0].title);assert(fs.existsSync(record));assert.equal(sent(),before,'Aprire e sfogliare non chiama AI');
  await set('zstudyAttempt','La mia risposta in corso');await click('#zstudyBrowse');await wait(`document.querySelectorAll('#zstudyQueue .zstudy-question-open').length===1`);
  assert.equal(await c.val(`document.getElementById('zstudyOrigin').value`),cards[0].sourceId);assert.equal(await c.val(`document.getElementById('zstudySearch').value`),'LUCE');
  await click('#zstudyQueue [data-question-id="'+id+'"]');await wait(`!!document.getElementById('zstudyAttempt') && document.getElementById('zstudyCancel').hidden`);assert.equal(await c.val(`document.getElementById('zstudyAttempt').value`),'La mia risposta in corso');
  await click('#zstudyBrowse');await set('zstudySearch','');await click('#zstudyQueueFilter [data-filter="later"]');assert(await c.val(`document.getElementById('zstudyQueue').hidden`));assert.match(await c.val(`document.getElementById('zstudyQueueEmpty').textContent`),/filtri/);
  await click('#zstudyQueueFilter [data-filter="new"]');assert.equal(await c.val(`document.querySelectorAll('#zstudyQueue .zstudy-question-open').length`),2);
  await set('zstudyOrigin',cards[1].sourceId);assert.equal(await c.val(`document.querySelectorAll('#zstudyQueue .zstudy-question-open').length`),1);
  await set('zstudyOrigin','all');await click('#zstudyQueueFilter [data-filter="all"]');
  assert.equal(await c.val(`document.querySelectorAll('#zstudyQueue [aria-current="true"]').length`),1);
  assert.equal(await c.val(`document.querySelector('#zstudyQueue .zstudy-current').textContent`),'Aperta');
  assert.equal(await c.val('RIPCONTO.totale'),await c.val(`document.querySelectorAll('#zstudyQueue .zstudy-question-open').length`));
  await c.invia('Emulation.setDeviceMetricsOverride',{width:900,height:900,deviceScaleFactor:1,mobile:false});
  for(const theme of ['chiaro','scuro']){await c.val(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);await c.pausa(250);assert(await c.val(`document.getElementById('zstudyBody').scrollWidth<=document.getElementById('zstudyBody').clientWidth+1`));
   const lines=await c.val(`(()=>{const current=document.querySelector('#zstudyQueue [aria-current="true"]').closest('li'),other=document.querySelector('#zstudyQueue [data-question-id="prova-domanda-singola"]').closest('li');return [current,other].map(e=>{const s=getComputedStyle(e,'::before');return {color:s.backgroundColor,width:s.width,height:s.height};});})()`);assert.notEqual(lines[0].color,lines[1].color);assert(lines.every(s=>s.width==='3px'&&parseFloat(s.height)>0));
   const shot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/zaino-ripasso-elenco-'+theme+'.png',Buffer.from(shot.result.data,'base64'));}
  assert.equal(sent(),before);
 }finally{
  for(const [file,old] of backups){if(old)fs.writeFileSync(file,old);else fs.rmSync(file,{force:true});}
  await c.val(`document.documentElement.dataset.theme=${JSON.stringify(initial.theme)};localStorage.clear();Object.entries(${JSON.stringify(initial.storage)}).forEach(([k,v])=>localStorage.setItem(k,v));BANCO.stato=${JSON.stringify(initial.banco)};bancoSalva();bancoDisegna();`);await c.invia('Emulation.clearDeviceMetricsOverride');
  await c.val(`location.reload()`);await c.pausa(800);await c.collega();await wait(`document.getElementById('zschedePreset')?.options.length===5`);
 }
 console.log('ripasso elenco: schede collassabili, domande singole, linee di stato, filtri, tastiera, identità, bozza, nessuna AI e due temi OK');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
