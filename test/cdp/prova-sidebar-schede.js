'use strict';
// Dati solo nel vault sintetico; nessuna generazione o richiesta cloud.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),c=require('./cdp');
const S=require('../../lib/schede-zaino'),F=require('../../lib/fonti-ai');
const q=JSON.stringify,base='#zs-schede';let folder,backup,keys,registro,registroPrima;
async function wait(expr){for(let n=0;n<160;n++){if(await c.val(expr))return;await c.pausa(100);}throw Error('Attesa: '+expr);}
async function click(sel){await c.val(`document.querySelector(${q(sel)}).scrollIntoView({block:'nearest'})`);await c.clicca(sel);}
async function reload(){await c.val('location.reload()');await c.pausa(700);await c.collega();await wait(`!!document.getElementById('zschedeBack') && !ZNAV.carico && document.getElementById('zainoNav').dataset.zaino===zainoAttivo()`);}
async function refresh(){await c.val(`document.getElementById('zschedeBack').click()`);}
function saveCard(plan,preset,n=1){const {chunks,...info}=plan,card={...info,preset,version:1,readingVersion:1,createdAt:new Date().toISOString(),provider:'prova',model:'locale',sources:chunks,items:Array.from({length:n},(_,i)=>({title:'Domanda di prova '+(i+1),text:'Testo della scheda conservata.',refs:[chunks[0].chunkId]}))};fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,card.sourceId+'-'+preset+'.json'),JSON.stringify(card));return card;}
(async()=>{
 await c.collega();await wait(`!!window.zainoStudio && zainoAttivo()==='biologia'`);
 const vault=await c.val('window.vault.path');assert(vault.includes('studia-zaino-prova-'),'Solo vault sintetico');
 const before=await c.val(`({banco:localStorage.getItem(bancoChiave()),theme:document.documentElement.dataset.theme,sidebar:document.documentElement.dataset.sidebar})`);
 keys=await c.val(`Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('studia-zaino.sezione.')))`) ;
 folder=path.join(vault,'Zaini/biologia/_lavorazione/rag/schede');backup=fs.existsSync(folder)?Object.fromEntries(fs.readdirSync(folder).map(f=>[f,fs.readFileSync(path.join(folder,f))])):{};
 registro=path.join(path.dirname(folder),'schede-rimosse.json');registroPrima=fs.existsSync(registro)?fs.readFileSync(registro):null;
 try{
  fs.rmSync(folder,{recursive:true,force:true});fs.rmSync(registro,{force:true});await reload();
  await c.val(`bancoForma('uno');bancoAssegna('A','studio');document.documentElement.dataset.sidebar='';document.documentElement.dataset.theme='chiaro'`);
  await refresh();await wait(`document.getElementById('zschedeCollectionStatus').textContent.startsWith('0 schede')`);
  assert.equal(await c.val(`!!document.querySelector('${base}')`),false);assert(await c.val(`!document.getElementById('zschedeNewButton').hidden`));
  const sources=F.sincronizza(vault,'biologia').sources.filter(s=>s.kind==='pdf');assert(sources.length>=2);
  const plans=await Promise.all(sources.slice(0,2).map(s=>S.prepara(vault,'biologia',s.id,'sintesi')));
  const first=saveCard(plans[0],'sintesi');await refresh();await wait(`document.querySelectorAll('${base} .zn-scheda').length===1`);
  const firstSource=base+' [data-schede-fonte="'+first.sourceId+'"]',group=firstSource+' .zs-gruppo-testa button';
  assert.equal(await c.val(`document.querySelector('${base} .zs-collapse .zs-n').textContent`),'1');
  assert.equal(await c.val(`document.querySelector('${base}').previousElementSibling.dataset.sezione`),'fonti');
  assert(!/MATERIALI|^\d+ /.test(await c.val(`document.querySelector(${q(group+' .zs-nome')}).textContent`)));
  saveCard(plans[0],'domande',2);saveCard(plans[1],'concetti');await refresh();await wait(`document.querySelectorAll('${base} .zn-scheda').length===3`);
  assert.equal(await c.val(`document.querySelectorAll('${base} [data-schede-fonte]').length`),2);
  assert.equal(await c.val(`document.querySelectorAll(${q(firstSource+' .zn-scheda')}).length`),2,'Domande per capire resta una sola voce');
  await click(group);assert.equal(await c.val(`document.querySelector(${q(group)}).getAttribute('aria-expanded')`),'false');
  await click(base+' .zs-collapse');await c.val('zainoNavAggiorna()');
  assert.equal(await c.val(`document.querySelector('${base} .zs-collapse').getAttribute('aria-expanded')`),'false');
  await reload();await wait(`document.querySelectorAll('${base} .zn-scheda').length===3`);
  assert.equal(await c.val(`document.querySelector('${base} .zs-collapse').getAttribute('aria-expanded')`),'false');
  await click(base+' .zs-collapse');assert.equal(await c.val(`document.querySelector(${q(group)}).getAttribute('aria-expanded')`),'false');
  await c.val(`document.querySelector(${q(group)}).focus()`);
  for(const type of ['keyDown','keyUp'])await c.invia('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13,...(type==='keyDown'?{text:'\r'}:{})});
  assert.equal(await c.val(`document.querySelector(${q(group)}).getAttribute('aria-expanded')`),'true','Il gruppo si apre anche da tastiera');
  const requests=path.join(path.dirname(vault),'dati/chat-requests.jsonl'),sent=fs.existsSync(requests)?fs.readFileSync(requests,'utf8'):'';
  const open=firstSource+' [data-preset="sintesi"]';await click(open);await wait(`!document.getElementById('zschedeResult').hidden && document.querySelector('${base} .attivo')?.dataset.preset==='sintesi' && !document.getElementById('zschedeNewButton').disabled`);
  assert(await c.val(`bancoVisibile('studio') && document.getElementById('zschedeResult').textContent.includes('Testo della scheda conservata.')`));
  assert.equal(await c.val(`document.querySelector(${q(open)}).getAttribute('aria-current')`),'page');
  await click('#zschedeBack');assert.equal(await c.val(`document.querySelectorAll('${base} .attivo').length`),0);
  // Il filtro della ricerca non limita la sidebar; lo zaino sì, anche con letture in volo.
  await c.val(`document.getElementById('zschedeFilter').value='inesistente';document.getElementById('zschedeFilter').dispatchEvent(new Event('input'))`);
  assert.equal(await c.val(`document.querySelectorAll('${base} .zn-scheda').length`),3);
  await click(base+' .zs-collapse');await c.val(`cambiaZaino('storia',true)`);await wait(`document.getElementById('zainoNav').dataset.zaino==='storia' && document.getElementById('zschedeCollectionStatus').textContent.startsWith('0 schede')`);
  assert.equal(await c.val(`!!document.querySelector('${base}')`),false);
  await c.val(`cambiaZaino('biologia',true);cambiaZaino('storia',true);cambiaZaino('biologia',true)`);await wait(`document.getElementById('zainoNav').dataset.zaino==='biologia' && document.querySelectorAll('${base} .zn-scheda').length===3`);
  assert.equal(await c.val(`document.querySelector('${base} .zs-collapse').getAttribute('aria-expanded')`),'false');await click(base+' .zs-collapse');
  for(const theme of ['chiaro','scuro']){
   await c.val(`document.documentElement.dataset.theme=${q(theme)}`);
   await c.invia('Input.dispatchMouseEvent',{type:'mouseMoved',x:900,y:300});
   assert(await c.val(`[...document.querySelectorAll('${base} button')].every(b=>b.title)`));
   const shot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/zaino-sidebar-schede-'+theme+'.png',Buffer.from(shot.result.data,'base64'));
  }
  assert.equal(await c.val(`document.querySelectorAll('${base} input').length`),0);
  assert(await c.val(`document.getElementById('zs-schede-delete').hidden && !!document.querySelector('#zs-schede-edit svg[data-icona="pencil"]')`));
  await click(open);await wait(`!document.getElementById('zschedeResult').hidden && !document.getElementById('zschedeNewButton').disabled`);
  await click('#zs-schede-edit');assert.equal(await c.val(`document.getElementById('zs-schede-edit').getAttribute('aria-pressed')`),'true');
  assert(await c.val(`!document.getElementById('zs-schede-delete').hidden && document.getElementById('zs-schede-delete').disabled`));
  const firstCheck=firstSource+' .zs-item:has([data-preset="sintesi"]) input',groupCheck=firstSource+' .zs-gruppo-testa input';
  await click(firstCheck);assert(await c.val(`document.querySelector(${q(groupCheck)}).indeterminate`));
  await click(groupCheck);assert.equal(await c.val(`document.getElementById('zs-schede-selected').textContent`),'2 selezionate');
  await click(group);assert.equal(await c.val(`document.querySelector(${q(group)}).getAttribute('aria-expanded')`),'false');
  const shotEdit=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/zaino-schede-selezionate.png',Buffer.from(shotEdit.result.data,'base64'));
  await click('#zs-schede-delete');await wait(`document.querySelectorAll('${base} .zn-scheda').length===1 && !document.getElementById('zschedeUndoBar').hidden && !document.getElementById('zschedeUndo').disabled`);
  assert(await c.val(`document.getElementById('zschedeResult').hidden && !document.getElementById('zschedeLibrary').hidden`),'La scheda eliminata si chiude');
  assert.equal((await c.val(`window.vault.studio.card('biologia',${q(first.sourceId)},'sintesi')`)).status,'deleted');
  assert.equal((await c.val(`window.vault.studio.cards('biologia')`)).cards.length,1);
  await click('#zschedeUndo');await wait(`document.querySelectorAll('${base} .zn-scheda').length===3 && document.getElementById('zschedeUndoBar').hidden && !document.getElementById('zschedeNewButton').disabled`);
  assert.equal(await c.val(`document.getElementById('zs-schede-selected').textContent`),'0 selezionate');
  await reload();await wait(`document.querySelectorAll('${base} .zn-scheda').length===3`);
  assert.equal(await c.val(`document.querySelectorAll('${base} input').length`),0);
  await click('#zs-schede-edit');await click(base+' .zs-schede-selection input');
  assert.equal(await c.val(`document.getElementById('zs-schede-selected').textContent`),'3 selezionate');
  assert(await c.val(`[...document.querySelectorAll('${base} input')].every(c=>c.checked && !c.indeterminate)`),'Seleziona tutte comprende i gruppi chiusi');
  await click('#zs-schede-delete');await wait(`!document.querySelector('${base}') && !document.getElementById('zschedeUndoBar').hidden && !document.getElementById('zschedeUndo').disabled`);
  assert.equal((await c.val(`window.vault.studio.cards('biologia')`)).cards.length,0);assert(await c.val(`!document.getElementById('zschedeNewButton').hidden`));
  await reload();await wait(`!document.getElementById('zschedeUndoBar').hidden`);assert.equal(await c.val(`!!document.querySelector('${base}')`),false);
  await c.val(`cambiaZaino('storia',true)`);await wait(`document.getElementById('zainoNav').dataset.zaino==='storia'`);assert(await c.val(`document.getElementById('zschedeUndoBar').hidden`));
  await c.val(`cambiaZaino('biologia',true)`);await wait(`!document.getElementById('zschedeUndoBar').hidden && document.getElementById('zainoNav').dataset.zaino==='biologia'`);
  await click('#zschedeUndo');await wait(`document.querySelectorAll('${base} .zn-scheda').length===3 && document.getElementById('zschedeUndoBar').hidden && !document.getElementById('zschedeNewButton').disabled`);
  await click('#zs-schede-edit');await click(base+' .zs-schede-selection input');await click('#zs-schede-edit');
  assert.equal(await c.val(`document.querySelectorAll('${base} input').length`),0);await click('#zs-schede-edit');assert(await c.val(`document.getElementById('zs-schede-delete').disabled`));await click('#zs-schede-edit');
  assert.equal(fs.existsSync(requests)?fs.readFileSync(requests,'utf8'):'',sent,'Aprire, eliminare e annullare non chiamano il provider');
  fs.rmSync(folder,{recursive:true,force:true});await refresh();await wait(`document.getElementById('zschedeCollectionStatus').textContent.startsWith('0 schede')`);
  assert.equal(await c.val(`!!document.querySelector('${base}')`),false,'L’ultima scheda rimossa nasconde la sezione');
  assert(await c.val(`!document.getElementById('zschedeNewButton').hidden`));
 }finally{
  fs.rmSync(folder,{recursive:true,force:true});fs.mkdirSync(folder,{recursive:true});for(const [f,data] of Object.entries(backup))fs.writeFileSync(path.join(folder,f),data);
  if(registroPrima)fs.writeFileSync(registro,registroPrima);else fs.rmSync(registro,{force:true});
  await c.val(`(()=>{for(const k of Object.keys(localStorage))if(k.startsWith('studia-zaino.sezione.'))localStorage.removeItem(k);for(const [k,v] of Object.entries(${q(keys)}))localStorage.setItem(k,v);document.documentElement.dataset.theme=${q(before.theme)};document.documentElement.dataset.sidebar=${q(before.sidebar||'')};if(${q(before.banco)}===null)localStorage.removeItem(bancoChiave());else localStorage.setItem(bancoChiave(),${q(before.banco)});bancoRicarica();document.getElementById('zschedeBack').click();})()`);
 }
 console.log('✓ Sidebar Schede: gruppi, collasso, apertura, matita, selezione multipla, eliminazione e Annulla persistenti, isolamento e zero AI');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
