'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),c=require('./cdp');
const q=JSON.stringify;
async function wait(expr,client=c){for(let n=0;n<120;n++){if(await client.val(expr))return;await c.pausa(100);}throw Error('Attesa: '+expr);}
async function click(nome){
 const sel='#presentaPane [aria-label='+JSON.stringify(nome)+']';
 if(['Nuovo approfondimento','Duplica slide','Stato successivo animato','Copia stile','Incolla stile','Elimina slide'].includes(nome)){
  await c.val('document.querySelector(".presenta-scaletta [aria-pressed=true]").scrollIntoView({block:"center",behavior:"instant"});new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  const r=await c.val('(()=>{const e=document.querySelector(".presenta-scaletta [aria-pressed=true]"),r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
  for(const type of ['mousePressed','mouseReleased'])await c.invia('Input.dispatchMouseEvent',{type,...r,button:'right',clickCount:1});await wait('!!document.querySelector(".presenta-menu:popover-open")');
 }
 await c.val(`document.querySelector(${q(sel)}).scrollIntoView({block:'center',behavior:'instant'});new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);await c.clicca(sel);await c.val('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
}

async function scrivi(nome,valore){if(nome==='Titolo della slide')await click('Titolo');await c.val(`(()=>{const e=document.querySelector('#presentaPane [aria-label='+${q(JSON.stringify(nome))}+']');e.value=${q(valore)};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);}
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
async function trascinaOggetto(blockId,ridimensiona=false){
 await c.val('document.querySelector("#presentaPane iframe").scrollIntoView({block:"center",behavior:"instant"});new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
 const iframe=await c.val('(()=>{const r=document.querySelector("#presentaPane iframe").getBoundingClientRect();return {x:r.x+1,y:r.y+1};})()');
 const r=await frameVal(`(()=>{const b=document.querySelector('[data-block-id="'+${q(blockId)}+'"]'),e=${ridimensiona?'b.querySelector(".presenta-maniglia")':'b'},r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+Math.min(16,r.height/2)};})()`);
 const x=iframe.x+r.x,y=iframe.y+r.y;
 await c.invia('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await c.val('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
 await c.invia('Input.dispatchMouseEvent',{type:'mouseMoved',x:x+24,y:y+16,button:'left',buttons:1});
 await c.invia('Input.dispatchMouseEvent',{type:'mouseReleased',x:x+24,y:y+16,button:'left',clickCount:1});await c.val('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
}
async function riordinaMiniature(da,a){
 const pos=await c.val(`(()=>{const d=document.querySelector('[data-slide-id="'+${q(da)}+'"]'),t=document.querySelector('[data-slide-id="'+${q(a)}+'"]');d.scrollIntoView({block:'center',behavior:'instant'});const r=d.getBoundingClientRect(),s=t.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,dx:s.x+s.width/2,dy:s.bottom-8};})()`);
 let data;const ascolta=raw=>{const m=JSON.parse(raw);if(m.method==='Input.dragIntercepted')data=m.params.data;};c.ws().on('message',ascolta);await c.invia('Input.setInterceptDrags',{enabled:true});
 try{
  await c.invia('Input.dispatchMouseEvent',{type:'mouseMoved',x:pos.x,y:pos.y});await c.invia('Input.dispatchMouseEvent',{type:'mousePressed',x:pos.x,y:pos.y,button:'left',buttons:1,clickCount:1});
  for(let i=1;i<=8&&!data;i++){await c.invia('Input.dispatchMouseEvent',{type:'mouseMoved',x:pos.x+(pos.dx-pos.x)*i/8,y:pos.y+(pos.dy-pos.y)*i/8,button:'left',buttons:1});await c.pausa(40);}
  for(let i=0;i<20&&!data;i++)await c.pausa(50);assert(data,'trascinamento nativo della miniatura avviato');
  for(const type of ['dragEnter','dragOver','drop'])await c.invia('Input.dispatchDragEvent',{type,x:pos.dx,y:pos.dy,data});
 }finally{await c.invia('Input.dispatchMouseEvent',{type:'mouseReleased',x:pos.dx,y:pos.dy,button:'left',buttons:0,clickCount:1});await c.invia('Input.setInterceptDrags',{enabled:false});c.ws().off('message',ascolta);}
}
(async()=>{
 await c.collega();await c.invia('Page.enable');await c.invia('Runtime.enable');await c.invia('Log.enable');c.ws().on('message',raw=>{const m=JSON.parse(raw);if(m.method==='Log.entryAdded'&&m.params.entry.level==='error')console.log('rete',m.params.entry.text);if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')console.log('renderer',m.params.args.map(a=>a.value));if(m.method==='Runtime.exceptionThrown')console.log('eccezione',JSON.stringify(m.params));});await wait('!!window.ZainoPresenta');const v=await c.val('window.vault.path');assert(v.includes('studia-zaino-prova-'));
 const banco=await c.val('bancoStato()');let id;
 try{
  await c.val("cambiaZaino('biologia',true);bancoForma('due-col');bancoAssegna('A','presenta');bancoAssegna('C','gobbo')");
  assert(!await c.val(`!!document.querySelector('#gobboPane').closest('.blocco').querySelector('[data-proietta]')`),'le note private non offrono la proiezione generica');
  await wait('document.querySelector(\'#presentaPane [data-presenta-action="nuova"]\')?.disabled===false');
  assert(await c.val(`['presenta','gobbo'].every(k=>[...document.querySelector('.bsel').options].some(o=>o.value===k))`));
  await click('Nuova presentazione');await wait('document.getElementById("uiModal").hasAttribute("open")');
  await c.val(`document.getElementById('umInput').value='Lezione della foglia';document.getElementById('umOk').click()`);await wait('!!ZainoPresenta.documento');id=await c.val('ZainoPresenta.documento.id');
  await scrivi('Titolo della slide','Una foglia al sole');await click('Aggiungi testo');await scrivi('Testo · Markdown e formule','La clorofilla cattura la luce. Formula: \\(x^2\\)');
  await frameVal('window.__privatoRicevuto=false;window.addEventListener("message",e=>{if(JSON.stringify(e.data).includes("NOTA_PRIVATA_UI"))window.__privatoRicevuto=true})');
  await scrivi('Appunti del presentatore · privati','NOTA_PRIVATA_UI · Chiedere un esempio alla classe.');
  await c.val('ZainoPresenta.flush()');await frameWait('document.querySelector(".presenta-slide")?.textContent.includes("clorofilla")');
  await frameWait('!!document.querySelector(".katex")');
  assert(await frameVal('!!document.querySelector(".katex")'),'matematica effettivamente renderizzata');assert(await frameVal('document.querySelector(".reveal").clientHeight>100'),'anteprima visibile');
  assert(!await frameVal('document.body.innerHTML.includes("NOTA_PRIVATA_UI")'));assert.equal(await frameVal('typeof window.vault'),'undefined');assert.equal(await frameVal('window.__privatoRicevuto'),false,'nessuna nota privata neppure nei metadati dei messaggi');
  // I payload vengono dai produttori reali del drag, poi il ricevitore del pannello li risolve.
  const png=await c.val(`(()=>{const a=document.createElement('canvas');a.width=400;a.height=260;const g=a.getContext('2d');g.fillStyle='#f3f6ed';g.fillRect(0,0,400,260);g.fillStyle='#527c42';g.beginPath();g.ellipse(200,118,106,64,-.5,0,Math.PI*2);g.fill();g.strokeStyle='#d7e8bf';g.lineWidth=4;g.beginPath();g.moveTo(112,165);g.lineTo(286,70);g.moveTo(166,134);g.lineTo(159,84);g.moveTo(211,110);g.lineTo(244,140);g.stroke();return a.toDataURL('image/png').split(',')[1];})()`);
  const aid=await c.val(`(()=>{const r=window.vault.album.salva('biologia',{origine:'foto',materiale:'foglia.png',didascalia:'Foglia sintetica',dati:'data:image/png;base64,${png}'});fotoAggiorna();return r.voce.id;})()`);
  await wait(`!!document.querySelector('#fotoLista [data-id="'+${q(aid)}+'"]')`);
  const drag=await c.val(`(()=>{const dt=new DataTransfer();document.querySelector('#fotoLista [data-id="'+${q(aid)}+'"]').dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:dt}));return dt.getData('application/x-studia-lim');})()`);assert(drag);
  await c.val(`(()=>{const dt=new DataTransfer();dt.setData('application/x-studia-lim',${q(drag)});document.getElementById('presentaPane').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));})()`);
  await wait('ZainoPresenta.documento.stacks[0].slides[0].blocks.some(b=>b.type==="image")');await c.val('ZainoPresenta.flush()');
  await frameWait('document.querySelector("img")?.naturalWidth>0');await wait('document.querySelector(".presenta-mini img")?.naturalWidth>0');
  await click('Sfondo');await click('Immagine a sinistra');await click('Crema');
  const imageId=await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="image").id');
  const textId=await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="text").id');
  assert.equal(await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="image").style.box.x'),7);
  assert.equal(await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="text").style.box.x'),53);
  await frameWait('getComputedStyle(document.querySelector(".presenta-slide")).backgroundColor==="rgb(255, 247, 214)"');
  await trascinaOggetto(imageId);await wait('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="image").style.box.x>7');
  const spostata=await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="image").style.box');
  await click('Annulla nella presentazione');assert.equal(await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="image").style.box.x'),7);
  await click('Ripeti nella presentazione');await frameWait('document.querySelector(".reveal").dataset.modificaPronta==="true" && !!document.querySelector(".presenta-maniglia")');
  assert.deepEqual(await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="image").style.box'),spostata);
  await trascinaOggetto(imageId,true);await wait('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="image").style.box.width>40');
  await click('Titolo');await c.val(`(()=>{const e=document.querySelector('#presentaPane [aria-label="Allineamento del testo"]');e.value='center';e.dispatchEvent(new Event('change'));})()`);
  await click('Sfondo');assert.equal(await c.val('document.querySelectorAll('+q('.presenta-campi [aria-label="Titolo della slide"]')+').length'),0);
  await c.val(`(()=>{const e=document.querySelector('#presentaPane [aria-label="Colore personalizzato dello sfondo"]');e.value='#aabbcc';e.dispatchEvent(new Event('change'));})()`);await click('Crema');
  assert.equal(await c.val('document.querySelector('+q('#presentaPane [aria-label="Colore personalizzato dello sfondo"]')+').value'),'#aabbcc','l’ultimo colore manuale resta disponibile dopo un preset');
  const misureColore=await c.val('(()=>{const p=document.querySelector(".presenta-personalizzato"),b=document.querySelector("#presentaPane [aria-label=Crema]");return [p.getBoundingClientRect().height,b.getBoundingClientRect().height];})()');assert.equal(misureColore[0],misureColore[1]);
  await click('Colori salvati');await click('Memorizza colore nello slot 1');assert.equal(await c.val('JSON.parse(localStorage.getItem("studia.presenta.colori")).slots[0]'),'#aabbcc');await c.val('document.querySelector(".presenta-palette:popover-open").hidePopover()');
  await click('Copia stile');await click('Sfondo');await click('Scuro');await click('Incolla stile');assert.equal(await c.val('ZainoPresenta.documento.stacks[0].slides[0].background'),'#fff7d6');
  await click('Testo');await c.val(`(()=>{const e=document.querySelector('#presentaPane [aria-label="Allineamento del testo"]');e.value='right';e.dispatchEvent(new Event('change'));})()`);
  await frameWait(`getComputedStyle(document.querySelector('[data-block-id="'+${q(textId)}+'"]')).textAlign==="right"`);
  assert.equal(await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="title").style.align'),'center','il testo non cambia l’allineamento del titolo');
  await c.val(`(()=>{const e=document.querySelector('#presentaPane [aria-label="Colore manuale del testo"]');e.value='#234567';e.dispatchEvent(new Event('change'));})()`);assert.equal(await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="text").style.color'),'#234567');
  await click('Automatico');assert.equal(await c.val('Object.hasOwn(ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="text").style,"color")'),false);
  await click('Alto destra');assert.equal(await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="text").style.box.y'),7);
  const layoutProva=await c.val('bancoStato()');await c.val('bancoForma("uno");bancoAssegna("A","presenta")');await click('Sfondo');await click('Immagine a sinistra');await click('Testo');
  await c.val('document.querySelector("#presentaPane iframe").scrollIntoView({block:"start",behavior:"instant"});new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  await c.val('ZainoPresenta.flush()');await wait('!document.querySelector("#toast")?.classList.contains("show")');await c.invia('Input.dispatchMouseEvent',{type:'mouseMoved',x:20,y:20});await frameWait('document.querySelector(".reveal").dataset.bloccato==="false"');const foglioShot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/private/tmp/presenta-sul-foglio.png',Buffer.from(foglioShot.result.data,'base64'));
  await click('Sfondo');await click('Colori salvati');const paletteShot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/private/tmp/presenta-colori-personali.png',Buffer.from(paletteShot.result.data,'base64'));await c.val('document.querySelector(".presenta-palette:popover-open").hidePopover()');
  await c.val(`BANCO.stato=${q(layoutProva)};bancoSalva();bancoDisegna()`);

  await frameWait('document.querySelector(".reveal").dataset.bloccato==="false"');
  const altezzaPrima=await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="image").style.box.height');
  await frameVal(`document.querySelector('[data-block-id="'+${q(imageId)}+'"]').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}))`);await wait('!!document.querySelector(".presenta-bubble:popover-open")');await click('Adatta riquadro al contenuto');
  await wait('Math.abs(ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="image").style.box.height-'+altezzaPrima+')>.1');
  await frameWait('document.querySelector(".reveal").dataset.modificaPronta==="true"');
  // Una slide precedente a Sul foglio conserva i pixel degli altri oggetti quando si trascina.
  await c.val('ZainoPresenta.modifica({tipo:"slide",slideId:ZainoPresenta.documento.stacks[0].slides[0].id,layout:"text-image"},{struttura:true})');
  await frameWait('document.querySelector(".presenta-slide").dataset.layout==="text-image" && document.querySelector(".reveal").dataset.bloccato==="false"');
  const titoloPrima=await frameVal('(()=>{const r=document.querySelector("[data-slot=title]").getBoundingClientRect();return {x:r.x,y:r.y};})()');
  await trascinaOggetto(imageId);await wait('ZainoPresenta.documento.stacks[0].slides[0].layout==="free"');await frameWait('document.querySelector(".presenta-slide").dataset.layout==="free" && document.querySelector(".reveal").dataset.modificaPronta==="true"');
  const titoloDopo=await frameVal('(()=>{const r=document.querySelector("[data-slot=title]").getBoundingClientRect();return {x:r.x,y:r.y};})()');
  assert(Math.abs(titoloPrima.x-titoloDopo.x)<2&&Math.abs(titoloPrima.y-titoloDopo.y)<2,'conversione della griglia senza spostare il titolo');
  const geometriaSalvata=await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="image").style.box');

  const audioDir=path.join(v,'Zaini/biologia/MATERIALI/Audio');fs.mkdirSync(audioDir,{recursive:true});fs.writeFileSync(path.join(audioDir,'03 Tono.wav'),require('../fixtures/presentazioni').audio());
  await c.val("AlbumSpazio.scegli('audio');AlbumSpazio.aggiorna()");await wait(`!!document.querySelector('[data-album-media="03 Tono.wav"]')`);
  const audioDrag=await c.val(`(()=>{const dt=new DataTransfer();document.querySelector('[data-album-media="03 Tono.wav"]').dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:dt}));return dt.getData('application/x-studia-presenta-media');})()`);assert(audioDrag);
  await c.val(`(()=>{const dt=new DataTransfer();dt.setData('application/x-studia-presenta-media',${q(audioDrag)});document.getElementById('presentaPane').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));})()`);
  await wait('ZainoPresenta.documento.stacks[0].slides[0].blocks.some(b=>b.type==="audio")');await c.val('ZainoPresenta.flush()');await frameWait('!!document.querySelector("audio")');await frameWait('document.querySelector("audio").muted===true');await frameWait('document.querySelector(".reveal").dataset.pronto==="true"');
  await click('Inserisci dallo zaino');await wait('!!document.querySelector(".presenta-materiali[open]")');assert(await c.val(`document.querySelector('.presenta-materiali').textContent.includes('Foglia sintetica')`));await c.val(`document.querySelector('.presenta-materiali [aria-label="Chiudi inserimento"]').click()`);
  await click('Nuova slide');await scrivi('Titolo della slide','Secondo argomento');await click('Nuovo approfondimento');await scrivi('Titolo della slide','Dettaglio verticale');await c.val('ZainoPresenta.flush()');
  assert.equal(await c.val('PresentaModello.posizioni(ZainoPresenta.documento).length'),3);assert.equal(await c.val('ZainoPresenta.documento.stacks[1].slides.length'),2);
  const ordinePrima=await c.val('ZainoPresenta.documento.stacks.map(s=>s.slides.map(s=>s.id))');await riordinaMiniature(ordinePrima[0][0],ordinePrima[1][0]);await wait('ZainoPresenta.documento.stacks[0].slides[0].id==='+q(ordinePrima[1][0]));assert.equal(await c.val('ZainoPresenta.documento.stacks[0].slides.length'),2);await click('Annulla nella presentazione');assert.deepEqual(await c.val('ZainoPresenta.documento.stacks.map(s=>s.slides.map(s=>s.id))'),ordinePrima);
  await click('Duplica slide');assert.equal(await c.val('PresentaModello.posizioni(ZainoPresenta.documento).length'),4);await click('Annulla nella presentazione');assert.equal(await c.val('PresentaModello.posizioni(ZainoPresenta.documento).length'),3);await click('Ripeti nella presentazione');assert.equal(await c.val('PresentaModello.posizioni(ZainoPresenta.documento).length'),4);await click('Annulla nella presentazione');
  await c.val('ZainoPresenta.flush()');await click('Chiudi presentazione');await wait('!ZainoPresenta.documento');
  await c.val(`ZainoPresenta.apri(${q(id)})`);assert.deepEqual(await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="image").style.box'),geometriaSalvata);assert.equal(await c.val('ZainoPresenta.documento.stacks[0].slides[0].notes.markdown'),'NOTA_PRIVATA_UI · Chiedere un esempio alla classe.');
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
  console.log('✓ PRESENTA e GOBBO: tab contestuali, colori e cinque slot, titolo/testo indipendenti, miniature e riordino nativo, stile, adatta riquadro, media, autosave, riapertura, player e note private');
 }finally{
  try{await c.val('ZainoPresenta.chiudi()');await c.val(`BANCO.stato=${q(banco)};bancoSalva();bancoDisegna()`);}catch(_){}
  if(id)fs.rmSync(path.join(v,'Zaini/biologia/PRESENTAZIONI',id),{recursive:true,force:true});for(const cl of clients)cl.ws.close();c.ws()?.close();
 }
})().catch(e=>{console.error(e);c.ws()?.close();process.exitCode=1;});
