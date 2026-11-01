'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),c=require('./cdp');
const q=JSON.stringify;
async function wait(expr,client=c){for(let n=0;n<120;n++){if(await client.val(expr))return;await c.pausa(100);}throw Error('Attesa: '+expr);}
async function click(nome){const sel='#presentaPane [aria-label='+JSON.stringify(nome)+']';await c.val(`document.querySelector(${q(sel)}).scrollIntoView({block:'nearest'})`);await c.clicca(sel);}
async function scrivi(nome,valore){await c.val(`(()=>{const e=document.querySelector('#presentaPane [aria-label='+${q(JSON.stringify(nome))}+']');e.value=${q(valore)};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);}
const WS=require('ws');let frameClient=null;const clients=[];
async function collegaTarget(target){
 const ws=new WS(target.webSocketDebuggerUrl,{perMessageDeflate:false});await new Promise((ok,ko)=>{ws.on('open',ok);ws.on('error',ko);});let id=0;const attesi=new Map();ws.on('message',raw=>{const m=JSON.parse(raw);if(m.id&&attesi.has(m.id)){attesi.get(m.id)(m);attesi.delete(m.id);}});
 const invia=(method,params)=>new Promise(resolve=>{const n=++id;attesi.set(n,resolve);ws.send(JSON.stringify({id:n,method,params}));});
 const client={id:target.id,ws,invia,val:async expression=>{const r=await invia('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.result.exceptionDetails)throw Error(JSON.stringify(r.result.exceptionDetails));return r.result.result.value;}};clients.push(client);return client;
}
async function frameVal(expr){
 const targets=await (await fetch('http://localhost:'+(process.env.STUDIA_PORTA||9333)+'/json')).json(),url=await c.val('document.querySelector("#presentaPane iframe").src');
 const target=targets.find(t=>t.type==='iframe'&&t.url===url);assert(target,'iframe isolato presente');if(frameClient?.id!==target.id)frameClient=await collegaTarget(target);return frameClient.val(expr);
}
async function frameWait(expr){for(let n=0;n<80;n++){if(await frameVal(expr))return;await c.pausa(100);}console.log(await frameVal('({errore:document.body.dataset.errore,pronto:document.querySelector(".reveal").dataset.pronto,fonts:document.fonts.status,classi:document.querySelector(".reveal").className,audio:document.querySelector("audio")?.outerHTML})'));throw Error('Anteprima: '+expr);}
(async()=>{
 await c.collega();await c.invia('Page.enable');await c.invia('Runtime.enable');c.ws().on('message',raw=>{const m=JSON.parse(raw);if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')console.log('renderer',m.params.args.map(a=>a.value));if(m.method==='Runtime.exceptionThrown')console.log('eccezione',JSON.stringify(m.params));});await wait('!!window.ZainoPresenta');const v=await c.val('window.vault.path');assert(v.includes('studia-zaino-prova-'));
 const banco=await c.val('bancoStato()');let id;
 try{
  await c.val("cambiaZaino('biologia',true);bancoForma('due-col');bancoAssegna('A','presenta');bancoAssegna('C','gobbo')");
  assert(!await c.val(`!!document.querySelector('#gobboPane').closest('.blocco').querySelector('[data-proietta]')`),'le note private non offrono la proiezione generica');
  await wait('document.querySelector(\'#presentaPane [data-presenta-action="nuova"]\')?.disabled===false');
  assert(await c.val(`['presenta','gobbo'].every(k=>[...document.querySelector('.bsel').options].some(o=>o.value===k))`));
  await click('Nuova presentazione');await wait('document.getElementById("uiModal").hasAttribute("open")');
  await c.val(`document.getElementById('umInput').value='Lezione della foglia';document.getElementById('umOk').click()`);await wait('!!ZainoPresenta.documento');id=await c.val('ZainoPresenta.documento.id');
  await scrivi('Titolo della slide','Una foglia al sole');await click('Aggiungi testo');await scrivi('Testo · Markdown e formule','La clorofilla cattura la luce. Formula: \\(x^2\\)');
  await scrivi('Appunti del presentatore · privati','NOTA_PRIVATA_UI · Chiedere un esempio alla classe.');
  await c.val('ZainoPresenta.flush()');await frameWait('document.querySelector(".presenta-slide")?.textContent.includes("clorofilla")');
  assert(await frameVal('!!document.querySelector(".katex")'),'matematica effettivamente renderizzata');assert(await frameVal('document.querySelector(".reveal").clientHeight>100'),'anteprima visibile');
  assert(!await frameVal('document.body.innerHTML.includes("NOTA_PRIVATA_UI")'));assert.equal(await frameVal('typeof window.vault'),'undefined');
  // I payload vengono dai produttori reali del drag, poi il ricevitore del pannello li risolve.
  const png=require('../fixtures/presentazioni').png.toString('base64');
  const aid=await c.val(`(()=>{const r=window.vault.album.salva('biologia',{origine:'foto',materiale:'foglia.png',didascalia:'Foglia sintetica',dati:'data:image/png;base64,${png}'});fotoAggiorna();return r.voce.id;})()`);
  await wait(`!!document.querySelector('#fotoLista [data-id="'+${q(aid)}+'"]')`);
  const drag=await c.val(`(()=>{const dt=new DataTransfer();document.querySelector('#fotoLista [data-id="'+${q(aid)}+'"]').dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:dt}));return dt.getData('application/x-studia-lim');})()`);assert(drag);
  await c.val(`(()=>{const dt=new DataTransfer();dt.setData('application/x-studia-lim',${q(drag)});document.getElementById('presentaPane').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));})()`);
  await wait('ZainoPresenta.documento.stacks[0].slides[0].blocks.some(b=>b.type==="image")');await c.val('ZainoPresenta.flush()');
  await frameWait('document.querySelector("img")?.naturalWidth>0');
  const audioDir=path.join(v,'Zaini/biologia/MATERIALI/Audio');fs.mkdirSync(audioDir,{recursive:true});fs.writeFileSync(path.join(audioDir,'03 Tono.wav'),require('../fixtures/presentazioni').audio());
  await c.val("AlbumSpazio.scegli('audio');AlbumSpazio.aggiorna()");await wait(`!!document.querySelector('[data-album-media="03 Tono.wav"]')`);
  const audioDrag=await c.val(`(()=>{const dt=new DataTransfer();document.querySelector('[data-album-media="03 Tono.wav"]').dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:dt}));return dt.getData('application/x-studia-presenta-media');})()`);assert(audioDrag);
  await c.val(`(()=>{const dt=new DataTransfer();dt.setData('application/x-studia-presenta-media',${q(audioDrag)});document.getElementById('presentaPane').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));})()`);
  await wait('ZainoPresenta.documento.stacks[0].slides[0].blocks.some(b=>b.type==="audio")');await c.val('ZainoPresenta.flush()');await frameWait('!!document.querySelector("audio")');await frameWait('document.querySelector("audio").muted===true');await frameWait('document.querySelector(".reveal").dataset.pronto==="true"');
  await click('Inserisci dallo zaino');await wait('!!document.querySelector(".presenta-materiali[open]")');assert(await c.val(`document.querySelector('.presenta-materiali').textContent.includes('Foglia sintetica')`));await c.val(`document.querySelector('.presenta-materiali [aria-label="Chiudi inserimento"]').click()`);
  await click('Nuova slide');await scrivi('Titolo della slide','Secondo argomento');await click('Nuovo approfondimento');await scrivi('Titolo della slide','Dettaglio verticale');await c.val('ZainoPresenta.flush()');
  assert.equal(await c.val('PresentaModello.posizioni(ZainoPresenta.documento).length'),3);assert.equal(await c.val('ZainoPresenta.documento.stacks[1].slides.length'),2);
  await click('Duplica slide');assert.equal(await c.val('PresentaModello.posizioni(ZainoPresenta.documento).length'),4);await click('Annulla nella presentazione');assert.equal(await c.val('PresentaModello.posizioni(ZainoPresenta.documento).length'),3);await click('Ripeti nella presentazione');assert.equal(await c.val('PresentaModello.posizioni(ZainoPresenta.documento).length'),4);await click('Annulla nella presentazione');
  await c.val('ZainoPresenta.flush()');await click('Chiudi presentazione');await wait('!ZainoPresenta.documento');
  await c.val(`ZainoPresenta.apri(${q(id)})`);assert.equal(await c.val('ZainoPresenta.documento.stacks[0].slides[0].notes.markdown'),'NOTA_PRIVATA_UI · Chiedere un esempio alla classe.');
  // La disposizione cambia; il DOM dell'editor e la bozza restano gli stessi.
  await c.val(`window.__presentaPane=document.getElementById('presentaPane');bancoForma('quattro');bancoScambia('A','D');bancoForma('due-col');bancoMostra('presenta')`);
  assert(await c.val('window.__presentaPane===document.getElementById("presentaPane")'));assert.equal(await c.val('ZainoPresenta.documento.id'),id);
  await c.val(`bancoForma('due-col');bancoAssegna('A','presenta');bancoAssegna('C','gobbo')`);
  await scrivi('Titolo della slide','Ultima battuta prima del cambio');await c.val("cambiaZaino('storia',true)");await wait('zainoAttivo()==="storia" && !ZainoPresenta.documento');
  assert.equal(JSON.parse(fs.readFileSync(path.join(v,'Zaini/biologia/PRESENTAZIONI',id,'presentazione.json'))).stacks[0].slides[0].title,'Ultima battuta prima del cambio');
  await c.val("cambiaZaino('biologia',true)");await wait('!!ZainoPresenta.documento');assert.equal(await c.val('ZainoPresenta.documento.id'),id);
  await c.val('ZainoPresenta.presenta()');await wait('!!ZainoPresenta.regia');
  await wait('document.querySelector("#gobboPane .gobbo-note")?.textContent.includes("NOTA_PRIVATA_UI")');
  const sid=await c.val('ZainoPresenta.regia.stato.sessionId');
  const target=(await (await fetch('http://localhost:'+(process.env.STUDIA_PORTA||9333)+'/json')).json()).find(t=>t.type==='page'&&t.url.endsWith('/presentazioni-player/index.html'));assert(target);const pubblico=await collegaTarget(target);
  assert.equal(await pubblico.val('typeof window.vault'),'undefined');assert(!await pubblico.val('document.documentElement.outerHTML.includes("NOTA_PRIVATA_UI")'));
  await wait('document.querySelector("img")?.naturalWidth>0',pubblico);
  await pubblico.val('document.querySelector("audio").play()');assert.equal(await pubblico.val('document.querySelector("audio").paused'),false);

  assert((await c.val(`window.vault.presentazioni.comando({azione:'sessione',corso:'biologia',sessionId:${q(sid)},comando:'avanti'})`)).ok);
  await wait('ZainoPresenta.regia?.stato.h===1');assert.equal(await pubblico.val('document.querySelector(\"audio\").paused'),true);assert.equal(await c.val('document.querySelector("#gobboPane .gobbo-titolo").textContent'),'Secondo argomento');
  assert((await c.val(`window.vault.presentazioni.comando({azione:'sessione',corso:'biologia',sessionId:${q(sid)},comando:'approfondisci'})`)).ok);await wait('ZainoPresenta.regia?.stato.v===1');
  for(const tema of ['chiaro','scuro']){
   await c.val(`document.documentElement.dataset.theme=${q(tema)}`);
   const stile=await c.val(`(()=>{const b=getComputedStyle(document.querySelector('#presentaPane [data-presenta-action="nuova"]')),r=getComputedStyle(document.querySelector('#limPane .tbtn'));return {altezza:b.height,riferimento:r.height,font:b.fontSize,fontRiferimento:r.fontSize,angoli:b.borderRadius};})()`);
   assert.equal(stile.altezza,stile.riferimento);assert.equal(stile.font,stile.fontRiferimento);assert.equal(stile.angoli,'0px');
   const shot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/private/tmp/zaino-presenta-'+tema+'.png',Buffer.from(shot.result.data,'base64'));
  }await c.val(`document.documentElement.dataset.theme='chiaro'`);
  const screenshot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/private/tmp/zaino-presenta-editor.png',Buffer.from(screenshot.result.data,'base64'));
  assert((await c.val(`window.vault.presentazioni.comando({azione:'sessione',corso:'biologia',sessionId:${q(sid)},comando:'chiudi'})`)).ok);await wait('!ZainoPresenta.regia');
  await c.val('ZainoPresenta.chiudi()');
  console.log('✓ PRESENTA e GOBBO: Banco, gesti editor, matematica visibile, anteprima isolata, autosave, undo/redo, riapertura, cambio zaino, player e note sincronizzate');
 }finally{
  try{await c.val('ZainoPresenta.chiudi()');await c.val(`BANCO.stato=${q(banco)};bancoSalva();bancoDisegna()`);}catch(_){}
  if(id)fs.rmSync(path.join(v,'Zaini/biologia/PRESENTAZIONI',id),{recursive:true,force:true});for(const cl of clients)cl.ws.close();c.ws()?.close();
 }
})().catch(e=>{console.error(e);c.ws()?.close();process.exitCode=1;});
