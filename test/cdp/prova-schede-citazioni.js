'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),c=require('./cdp');
const q=JSON.stringify;
async function wait(expr){for(let n=0;n<150;n++){if(await c.val(expr))return;await c.pausa(100);}throw Error('Attesa: '+expr);}
const click=sel=>c.val(`document.querySelector(${q(sel)}).click()`);
async function hover(sel){await c.val(`document.querySelector(${q(sel)}).scrollIntoView({block:'nearest'})`);const p=await c.val(`(()=>{const r=document.querySelector(${q(sel)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);await c.invia('Input.dispatchMouseEvent',{type:'mouseMoved',...p});await c.pausa(300);}
(async()=>{
 await c.collega();await wait(`!!window.zainoStudio && !!document.getElementById('zschedeKind')`);
 const vault=await c.val('window.vault.path');assert(vault.includes('studia-zaino-prova-'));
 const initial=await c.val(`({banco:bancoStato(),tema:document.documentElement.dataset.theme,storage:{...localStorage}})`);
 await c.val(`cambiaZaino('biologia',true);bancoForma('uno');bancoAssegna('A','studio')`);
 const source=(await c.val(`window.vault.chat.sources('biologia')`)).sources.find(s=>s.file.endsWith('01 Botanica.pdf'));assert(source);
 const cache=path.join(vault,'Zaini/biologia/_lavorazione/rag/schede',source.id+'-domande.json'),old=fs.existsSync(cache)?fs.readFileSync(cache):null;
 const pagina={sourceId:source.id,revision:source.revision,file:source.file,kind:'pdf',page:1,chunkId:'uno',quote:'Prima prova.',quoteComplete:true};
 const card={version:1,preset:'domande',sourceId:source.id,revision:source.revision,file:source.file,createdAt:new Date().toISOString(),provider:'prova',model:'sintetico',covered:3,total:3,partial:false,sources:[pagina,{...pagina,chunkId:'due',quote:'Seconda prova.'},{...pagina,chunkId:'tre',page:2}],items:[{title:'Come utilizzano la luce le piante?',text:'La luce permette la fotosintesi.\n**Prerequisiti:** energia.',refs:['uno','due','tre','tre']}]};
 fs.mkdirSync(path.dirname(cache),{recursive:true});fs.writeFileSync(cache,JSON.stringify(card));
 const noteDir=path.join(vault,'Zaini/biologia/APPUNTI'),notePrima=new Set(fs.readdirSync(noteDir));
 try{
  await click('#zschedeBack');await c.val(`document.getElementById('zschedeKind').value='scheda';document.getElementById('zschedeFilter').value='Botanica.pdf Domande per capire';`);await click('#zschedeBack');await wait(`document.querySelectorAll('#zschedeCollection article').length===1 && !document.getElementById('zschedeNewButton').disabled`);
  await click('#zschedeCollection button');await wait(`!!document.querySelector('#zschedeResult article') && !document.getElementById('zschedeNewButton').disabled`);
  assert.equal(await c.val(`document.querySelector('#zschedeResult article').firstElementChild.tagName`),'H4');
  assert.deepEqual(await c.val(`[...document.querySelectorAll('#zschedeResult article .zchat-citation')].map(b=>b.textContent)`),['01 Botanica.pdf · p. 1','01 Botanica.pdf · p. 2']);
  assert.equal(await c.val(`document.querySelector('#zschedeResult article>button:last-child').textContent`),'Rispondi');
  assert.deepEqual(await c.val(`[...document.querySelectorAll('#zschedeResult>button')].map(b=>b.textContent)`),['Crea appunti da domanda','Rigenera…']);
  assert(await c.val(`(()=>{const ref=document.createElement('button');ref.className='tbtn acc';ref.textContent='Verifica risposta';document.getElementById('zschedeResult').append(ref);const a=getComputedStyle(ref),ok=[...document.querySelectorAll('#zschedeResult>button,#zschedeResult article>button:last-child')].every(b=>{const s=getComputedStyle(b);return s.backgroundColor===a.backgroundColor&&s.color===a.color&&s.fontSize===a.fontSize&&s.fontWeight===a.fontWeight;});ref.remove();return ok;})()`));
  assert(await c.val(`(()=>{const t=document.querySelector('#zschedeResult h4'),p=document.createElement('span');p.style.fontSize='var(--tit-4)';t.append(p);const ok=getComputedStyle(t).fontSize===getComputedStyle(p).fontSize;p.remove();return ok;})()`));
  const shot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/zaino-scheda-citazioni.png',Buffer.from(shot.result.data,'base64'));
  await click('#zschedeResult>button');await wait(`noteStatoAttivo().cur?.title?.startsWith('Domande per capire')`);
  const body=await c.val(`noteStatoAttivo().mde.value()`);assert(body.startsWith('###### Domande per capire'));assert(body.includes('\n\n[01 Botanica.pdf · p. 1](pdf:01#p=1'));assert(body.includes('\n\n[01 Botanica.pdf · p. 2](pdf:01#p=2'));assert(!body.includes('[¹]'));
  await c.val(`bancoForma('uno');bancoAssegna('A','studio');document.getElementById('zschedeBack').click();zainoNavAggiorna()`);await wait(`document.querySelectorAll('#zainoNav .zs-raccolta').length===4`);
  for(const sezione of ['appunti','mappe','fonti','media']){
   const base='#zainoNav [data-sezione="'+sezione+'"]';
   if(await c.val(`document.querySelector(${q(base+' .zs-collapse')}).getAttribute('aria-expanded')==='true'`))await click(base+' .zs-collapse');
   assert(await c.val(`(()=>{const e=document.querySelector(${q(base)});return !e.querySelector('.zs-azioni').getClientRects().length&&!e.querySelector('.zs-collapse .zs-n').getClientRects().length;})()`));
   await click(base+' .zs-collapse');assert(await c.val(`document.querySelector(${q(base+' .zs-azioni')}).getClientRects().length>0`));
  }
  for(const tema of ['chiaro','scuro']){
   await c.val(`document.documentElement.dataset.theme=${q(tema)}`);await c.invia('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});await c.pausa(300);
   assert(await c.val(`(()=>{const e=document.createElement('span');e.style.background='transparent';e.style.color='var(--teal-strong)';document.body.append(e);const t=getComputedStyle(e),b=getComputedStyle(document.querySelector('#zschedeBack')),s=getComputedStyle(document.querySelector('#zainoNav [data-znav="ordina"]')),ok=b.backgroundColor===t.backgroundColor&&s.color===t.color;e.remove();return ok;})()`));
   await hover('#zragSearchButton');assert(await c.val(`(()=>{const e=document.createElement('button');e.className='tbtn acc';e.style.background='var(--comando-hover)';document.body.append(e);const a=getComputedStyle(e),b=getComputedStyle(document.getElementById('zragSearchButton')),ok=a.backgroundColor===b.backgroundColor&&a.color===b.color;e.remove();return ok;})()`));
  }
 }finally{
  if(old)fs.writeFileSync(cache,old);else fs.rmSync(cache,{force:true});
  await c.val(`noteFlush();cambiaZaino('storia',true)`);
  for(const file of fs.readdirSync(noteDir))if(file.startsWith('Scheda AI ')&&!notePrima.has(file))fs.rmSync(path.join(noteDir,file));
  require('../../lib/appunti').reindex(vault,'biologia');await c.val(`cambiaZaino('biologia',true)`);
  await c.val(`noteFlush();document.documentElement.dataset.theme=${q(initial.tema)};localStorage.clear();Object.entries(${q(initial.storage)}).forEach(([k,v])=>localStorage.setItem(k,v));BANCO.stato=${q(initial.banco)};bancoSalva();bancoDisegna();document.getElementById('zschedeFilter').value='';document.getElementById('zschedeKind').value='all';document.getElementById('zschedeBack').click()`);
 }
 console.log('schede-citazioni UI: H4/H6, rimandi unici per pagina, copia leggibile, azioni e sidebar nei due temi OK');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
