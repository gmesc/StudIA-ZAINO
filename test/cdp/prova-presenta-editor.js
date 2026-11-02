'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),c=require('./cdp');
const q=JSON.stringify;
async function wait(expr,client=c){for(let n=0;n<120;n++){if(await client.val(expr))return;await c.pausa(100);}throw Error('Attesa: '+expr);}
async function click(nome){
 if(/^(Riga [1-4]|Colonna [1-4]|(Alto|Centro|Basso) (sinistra|centro|destra))$/.test(nome)&&!await c.val('!!document.querySelector(".presenta-posizione-popup:popover-open")'))await click('Posizione');
 if(['Nuova presentazione','Rinomina presentazione','Salva presentazione','Esporta presentazione HTML','Elimina presentazione','Chiudi presentazione'].includes(nome))await click('Documento');
 if(['Aggiungi testo','Aggiungi elenco','Aggiungi formula','Aggiungi forma','Aggiungi tabella','Inserisci dallo zaino','Incolla oggetto'].includes(nome))await click('Inserisci');
 const sel='#presentaPane [aria-label='+JSON.stringify(nome)+']';
 if(['Nuovo approfondimento','Duplica slide','Stato successivo animato','Copia stile','Incolla stile','Elimina slide'].includes(nome)){
  await c.val('document.querySelector(".presenta-scaletta [aria-pressed=true]").scrollIntoView({block:"center",behavior:"instant"});new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  const r=await c.val('(()=>{const e=document.querySelector(".presenta-scaletta [aria-pressed=true]"),r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
  for(const type of ['mousePressed','mouseReleased'])await c.invia('Input.dispatchMouseEvent',{type,...r,button:'right',clickCount:1});await wait('!!document.querySelector(".presenta-menu:popover-open")');
 }
 await c.val(`document.querySelector(${q(sel)}).scrollIntoView({block:'center',behavior:'instant'});new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);await c.clicca(sel);await c.val('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
 if(nome==='Nuova slide'){await wait('!!document.querySelector(".presenta-scelta-modello[open]")');await c.clicca('.presenta-scelta-modello [data-modello=vuota]');}
}

async function scrivi(nome,valore){
 if(nome==='Titolo della slide')await click('Titolo');
 const tipo=await c.val(`document.querySelector('#presentaPane [aria-label='+${q(JSON.stringify(nome))}+']')?.tagName`);
 if(tipo==='BUTTON'){await click(nome);await wait('!!document.querySelector(".presenta-input-popup:popover-open")');}
 await c.val(`(()=>{const e=document.querySelector('.presenta-input-popup [aria-label='+${q(JSON.stringify(nome))}+']')||document.querySelector('#presentaPane [aria-label='+${q(JSON.stringify(nome))}+']');e.value=${q(valore)};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 if(tipo==='BUTTON')await c.clicca('.presenta-input-popup [aria-label="Chiudi campo"]');
}
async function cicloRighelli(n){await click('Righelli');for(let i=0;i<n;i++)await click('Cambia griglia di riferimento');}

const WS=require('ws');let frameClient=null;const clients=[];
async function collegaTarget(target){
 const ws=new WS(target.webSocketDebuggerUrl,{perMessageDeflate:false});await new Promise((ok,ko)=>{ws.on('open',ok);ws.on('error',ko);});let id=0;const attesi=new Map();ws.on('message',raw=>{const m=JSON.parse(raw);if(m.id&&attesi.has(m.id)){attesi.get(m.id)(m);attesi.delete(m.id);}});
 const invia=(method,params)=>new Promise(resolve=>{const n=++id;attesi.set(n,resolve);ws.send(JSON.stringify({id:n,method,params}));});
 const client={id:target.id,ws,invia,val:async expression=>{const r=await invia('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.result.exceptionDetails)throw Error(JSON.stringify(r.result.exceptionDetails));return r.result.result.value;}};clients.push(client);ws.on('message',raw=>{const m=JSON.parse(raw);if(m.method==='Network.loadingFailed'||m.method==='Log.entryAdded')console.log('frame-network',JSON.stringify(m.params));});await invia('Network.enable',{});await invia('Log.enable',{});return client;
}
async function frameVal(expr){
 const targets=await (await fetch('http://localhost:'+(process.env.STUDIA_PORTA||8999)+'/json')).json(),url=await c.val('document.querySelector("#presentaPane iframe").src');
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
async function riordinaMiniature(da,a,dentro=false){
 const pos=await c.val(`(()=>{const d=document.querySelector('[data-slide-id="'+${q(da)}+'"]'),t=document.querySelector('[data-slide-id="'+${q(a)}+'"]');d.scrollIntoView({block:'center',behavior:'instant'});const r=d.getBoundingClientRect(),s=t.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,dx:s.x+s.width/2,dy:${dentro?'s.y+s.height/2':'s.bottom-8'}};})()`);
 let data;const ascolta=raw=>{const m=JSON.parse(raw);if(m.method==='Input.dragIntercepted')data=m.params.data;};c.ws().on('message',ascolta);await c.invia('Input.setInterceptDrags',{enabled:true});
 try{
  await c.invia('Input.dispatchMouseEvent',{type:'mouseMoved',x:pos.x,y:pos.y});await c.invia('Input.dispatchMouseEvent',{type:'mousePressed',x:pos.x,y:pos.y,button:'left',buttons:1,clickCount:1});
  for(let i=1;i<=8&&!data;i++){await c.invia('Input.dispatchMouseEvent',{type:'mouseMoved',x:pos.x+(pos.dx-pos.x)*i/8,y:pos.y+(pos.dy-pos.y)*i/8,button:'left',buttons:1});await c.pausa(40);}
  for(let i=0;i<20&&!data;i++)await c.pausa(50);assert(data,'trascinamento nativo della miniatura avviato');
  for(const type of ['dragEnter','dragOver','drop'])await c.invia('Input.dispatchDragEvent',{type,x:pos.dx,y:pos.dy,data});
 }finally{await c.invia('Input.dispatchMouseEvent',{type:'mouseReleased',x:pos.dx,y:pos.dy,button:'left',buttons:0,clickCount:1});await c.invia('Input.setInterceptDrags',{enabled:false});c.ws().off('message',ascolta);}
}
(async()=>{
 await c.collega();await c.invia('Page.enable');await c.invia('Runtime.enable');await c.invia('Log.enable');c.ws().on('message',raw=>{const m=JSON.parse(raw);if(m.method==='Log.entryAdded'&&m.params.entry.level==='error')console.log('rete',m.params.entry.text);if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')console.log('renderer',m.params.args.map(a=>a.value));if(m.method==='Runtime.exceptionThrown')console.log('eccezione',JSON.stringify(m.params));});await wait('!!window.ZainoPresenta');await c.val(`window.__erroriPresenta=[];window.addEventListener('message',e=>{if(e.data?.presenta&&e.data.tipo==='errore')window.__erroriPresenta.push(e.data.error);});`);const v=await c.val('window.vault.path');assert(v.includes('studia-zaino-prova-'));
 const banco=await c.val('bancoStato()');let id;
 try{
  await c.val("cambiaZaino('biologia',true);bancoForma('due-col');bancoAssegna('A','presenta');bancoAssegna('C','gobbo')");
  assert(!await c.val(`!!document.querySelector('#gobboPane').closest('.blocco').querySelector('[data-proietta]')`),'le note private non offrono la proiezione generica');
  await wait('!!document.querySelector(\'#presentaPane [aria-label="Documento"]\')');
  assert(await c.val(`['presenta','gobbo'].every(k=>[...document.querySelector('.bsel').options].some(o=>o.value===k))`));
  await click('Nuova presentazione');await wait('document.getElementById("uiModal").hasAttribute("open")');
  await c.val(`document.getElementById('umInput').value='Lezione della foglia';document.getElementById('umOk').click()`);await wait('!!ZainoPresenta.documento');id=await c.val('ZainoPresenta.documento.id');
  await scrivi('Titolo della slide','Una foglia al sole');await click('Aggiungi testo');await scrivi('Testo · Markdown e formule','La clorofilla cattura la luce. Formula: \\(x^2\\)');
  await frameVal('window.__privatoRicevuto=false;window.addEventListener("message",e=>{if(JSON.stringify(e.data).includes("NOTA_PRIVATA_UI"))window.__privatoRicevuto=true})');
  await scrivi('Appunti del presentatore · privati','NOTA_PRIVATA_UI · Chiedere un esempio alla classe.');
  await c.val('ZainoPresenta.flush()');await frameWait('document.querySelector(".presenta-slide")?.textContent.includes("clorofilla")');
  await frameWait('!!document.querySelector(".katex")');
  await cicloRighelli(1);
  await frameWait('document.querySelector(".reveal").dataset.bloccato==="false"');
  assert.equal(await frameVal('document.querySelectorAll(".presenta-guide-fisse").length'),1,'il righello mostra le guide anche senza trascinare');
  await cicloRighelli(3);
  await frameWait('!document.querySelector(".presenta-guide-fisse")');
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
  await click('Disposizione');await click('Immagine a sinistra');await click('Sfondo');await click('Colore personalizzato dello sfondo');await click('yellow-100');assert.equal(await c.val('ZainoPresenta.documento.stacks[0].slides[0].background'),'#fef9c3');
  const imageId=await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="image").id');
  const textId=await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="text").id');
  assert.equal(await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="image").style.box.x'),7);
  assert.equal(await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="text").style.box.x'),53);
  await frameWait('getComputedStyle(document.querySelector(".presenta-slide")).backgroundColor==="rgb(254, 249, 195)"');
  const altriPrima=await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.filter(b=>b.type!=="image")');
  await trascinaOggetto(imageId);await wait('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="image").style.box.x>7');
  assert.deepEqual(await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.filter(b=>b.type!=="image")'),altriPrima,'il gesto conserva esattamente gli altri oggetti');
  const spostata=await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="image").style.box');
  await click('Annulla nella presentazione');assert.equal(await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="image").style.box.x'),7);
  await click('Ripeti nella presentazione');await frameWait('document.querySelector(".reveal").dataset.modificaPronta==="true" && !!document.querySelector(".presenta-maniglia")');
  assert.deepEqual(await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="image").style.box'),spostata);
  await trascinaOggetto(imageId,true);await wait('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="image").style.box.width>40');
  await click('Titolo');await click('Allineamento del testo');await click('Allineamento del testo · Centro');
  // Campi brevi e comandi immagine allineati: la didascalia si modifica davvero nel popup.
  await click('Immagine');assert.equal(await c.val('document.querySelectorAll(".presenta-proprieta-foglio input[type=text],.presenta-proprieta-foglio textarea").length'),0);assert(await c.val(`(()=>{const a=document.querySelector('[aria-label="Sostituisci immagine"]').getBoundingClientRect(),b=document.querySelector('[aria-label="Ritaglia immagine"]').getBoundingClientRect();return Math.abs(a.top-b.top)<1;})()`));
  await scrivi('Didascalia','Foglia sintetica · prova');assert.equal(await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="image").caption'),'Foglia sintetica · prova');
  await click('Annulla nella presentazione');await click('Didascalia');await click('Testo');
  assert(await c.val(`!document.querySelector('.presenta-input-popup:popover-open')&&document.querySelector('#presentaPane [aria-label="Testo"]').getAttribute('aria-pressed')==='true'`),'clic fuori chiude il campo e cambia tab con un solo gesto');
  await click('Riga 2');assert.equal(await c.val('document.querySelectorAll(".presenta-posizioni [data-cella][aria-pressed=true]").length'),3);
  await click('Colonna 1');assert.equal(await c.val('document.querySelectorAll(".presenta-posizioni [data-cella][aria-pressed=true]").length'),3);
  await cicloRighelli(3);await click('Guide magnetiche');assert.equal(await c.val(`document.querySelector('[aria-label="Guide magnetiche"]').getAttribute('aria-pressed')`),'true');await click('Guide magnetiche');
  await click('Testo');await click('Posizione');assert.equal(await c.val('document.querySelectorAll(".presenta-posizioni [data-cella]").length'),16);
  for(const type of ['keyDown','keyUp'])await c.invia('Input.dispatchKeyEvent',{type,key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await wait('!document.querySelector(".presenta-posizione-popup:popover-open")');
  assert.equal(await c.val(`document.querySelector('#presentaPane [aria-label="Testo"]').getAttribute('aria-pressed')`),'true','Escape chiude prima la griglia e conserva l’oggetto');
  await click('Riga 2');assert.equal(await c.val('document.querySelectorAll(".presenta-posizioni [data-cella][aria-pressed=true]").length'),4);
  await cicloRighelli(1);await click('Testo');await click('Posizione');assert.equal(await c.val('document.querySelectorAll(".presenta-posizioni [data-cella]").length'),9);
  await click('Sfondo');assert.equal(await c.val('document.querySelectorAll('+q('.presenta-campi [aria-label="Titolo della slide"]')+').length'),0);
  await click('Colore personalizzato dello sfondo');await click('sky-500');await click('Bianco');
  assert.equal(await c.val('document.querySelector('+q('#presentaPane [aria-label="Colore personalizzato dello sfondo"]')+').dataset.colore'),'#0ea5e9','l’ultimo colore manuale resta disponibile dopo un preset');
  const misureColore=await c.val('(()=>{const p=document.querySelector(".presenta-personalizzato"),b=document.querySelector("#presentaPane [aria-label=Bianco]");return [p.getBoundingClientRect().height,b.getBoundingClientRect().height];})()');assert.equal(misureColore[0],misureColore[1]);
  assert.equal(await c.val('getComputedStyle(document.querySelector("#presentaPane iframe")).outlineWidth'),'1px','cornice sullo sfondo bianco');
  assert.equal(await c.val('document.querySelectorAll(".presenta-slot-colori>div").length'),5,'cinque slot direttamente nelle proprietà');
  assert.equal(await c.val('document.querySelector('+q('#presentaPane [aria-label="Usa colore 5"]')+').disabled'),false,'uno slot vuoto apre la palette');
  assert.equal(await c.val('JSON.parse(localStorage.getItem("studia.presenta.colori")).slots[1]'),'#0ea5e9','la palette salva automaticamente');
  assert.equal(await c.val('document.querySelectorAll(".presenta-slot-colori [data-icona=save]").length'),0);
  await click('Usa colore 5');await click('rose-500');assert.equal(await c.val('JSON.parse(localStorage.getItem("studia.presenta.colori")).slots[4]'),'#f43f5e');
  await click('Usa colore 2');await click('Copia stile');await click('Sfondo');await click('Nero');await click('Incolla stile');assert.equal(await c.val('ZainoPresenta.documento.stacks[0].slides[0].background'),'#0ea5e9');
  assert.equal(await c.val('getComputedStyle(document.querySelector("#presentaPane iframe")).outlineWidth'),'0px','nessuna cornice sullo sfondo colorato');
  await click('Testo');await click('Allineamento del testo');await click('Allineamento del testo · Destra');
  await frameWait(`getComputedStyle(document.querySelector('[data-block-id="'+${q(textId)}+'"]')).textAlign==="right"`);
  assert.equal(await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="title").style.align'),'center','il testo non cambia l’allineamento del titolo');
  await click('Colore manuale del testo');await click('slate-800');assert.equal(await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="text").style.color'),'#1e293b');
  await click('Automatico');assert.equal(await c.val('Object.hasOwn(ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="text").style,"color")'),false);
  await click('Alto destra');assert.equal(await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="text").style.box.y'),7);
  const layoutProva=await c.val('bancoStato()');await c.val('bancoForma("uno");bancoAssegna("A","presenta")');await click('Disposizione');await click('Immagine a sinistra');await click('Sfondo');await click('Testo');
  await c.val('document.querySelector("#presentaPane iframe").scrollIntoView({block:"start",behavior:"instant"});new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  await c.val('ZainoPresenta.flush()');await wait('!document.querySelector("#toast")?.classList.contains("show")');await c.invia('Input.dispatchMouseEvent',{type:'mouseMoved',x:20,y:20});await frameWait('document.querySelector(".reveal").dataset.bloccato==="false"');assert(await c.val('(()=>{const f=document.querySelector("#presentaPane iframe"),p=f.parentElement;return Math.abs(f.clientWidth-(p.clientWidth-24))<2 && Math.abs(f.clientWidth/f.clientHeight-16/9)<.01})()'),'anteprima a tutta larghezza e proporzioni conservate');assert(await frameVal('(()=>{const r=document.querySelector(".slides").getBoundingClientRect();return Math.abs(r.width-innerWidth)<2 && Math.abs(r.height-innerHeight)<2})()'),'Reveal riempie davvero il frame senza margini laterali');const foglioShot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/private/tmp/presenta-sul-foglio.png',Buffer.from(foglioShot.result.data,'base64'));
  await click('Sfondo');
  await c.val('document.querySelector(".presenta-slot-colori").scrollIntoView({block:"center",behavior:"instant"});new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  assert(await c.val('Array.from(document.querySelectorAll(".presenta-slot-colori>div")).every(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})'),'tutti i cinque slot sono visibili senza aprire popup');
  assert.equal(await c.val('document.querySelector(".presenta-personalizzato").textContent'),'slate-800','anche il picker usa solo l’identificatore Tailwind');
  const slotsShot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/private/tmp/presenta-slot-visibili.png',Buffer.from(slotsShot.result.data,'base64'));
  await click('Colore personalizzato dello sfondo');const paletteShot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/private/tmp/presenta-colori-personali.png',Buffer.from(paletteShot.result.data,'base64'));await c.invia('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await c.invia('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await wait('!document.querySelector(".presenta-palette:popover-open")');
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
  // Stili reali: campo -> modello -> iframe isolato -> salvataggio/riapertura.
  await click('Testo');
  await click('Carattere');await click('Georgia');
  await click('Grassetto');await click('Corsivo');await click('Sottolineato');
  await frameWait(`(()=>{const b=document.querySelector('[data-block-id="'+${q(textId)}+'"]'),s=getComputedStyle(b.querySelector('.presenta-contenuto'));return s.fontFamily.includes('Georgia')&&s.fontWeight==='700'&&s.fontStyle==='italic'&&getComputedStyle(b).getPropertyValue('--sottolineato-testo')==='underline';})()`);
  assert.equal(await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="title").style.fontFamily'),undefined);
  const misureFont=await c.val(`(()=>{const a=document.querySelector('#presentaPane [aria-label="Carattere"]').getBoundingClientRect(),b=document.querySelector('#presentaPane [aria-label="Dimensione testo"]').getBoundingClientRect();return [a.height,b.height,a.y,b.y];})()`);assert.equal(misureFont[0],misureFont[1]);assert.equal(misureFont[2],misureFont[3]);
  await click('Stile');await click('Carattere per tutte le slide');
  assert.equal(await c.val('document.querySelectorAll(".presenta-font-opzione").length'),9);assert((await c.val(`getComputedStyle(document.querySelector('.presenta-font-opzione[aria-label="Atkinson Hyperlegible"]')).fontFamily`)).includes('Atkinson'));
  fs.writeFileSync('/private/tmp/presenta-font-reale.png',Buffer.from((await c.invia('Page.captureScreenshot',{format:'png'})).result.data,'base64'));
  await click('Atkinson Hyperlegible');await frameWait('getComputedStyle(document.querySelector(".presenta-slide")).fontFamily.includes("Atkinson")');
  assert.equal(await frameVal(`document.fonts.load('32px "Atkinson Hyperlegible"').then(f=>f.length===1&&f[0].status==='loaded')`),true);assert.equal(await c.val('ZainoPresenta.documento.settings.fontFamily'),'atkinson');
  await click('Carattere per tutte le slide');await click('TestMe Sans');await frameWait('getComputedStyle(document.querySelector(".presenta-slide")).fontFamily.includes("TestMe")');
  assert.equal(await frameVal(`document.fonts.load('32px "TestMe Sans"').then(f=>f.length===1&&f[0].status==='loaded')`),true);
  await c.val('ZainoPresenta.flush()');assert.equal(JSON.parse(fs.readFileSync(path.join(v,'Zaini/biologia/PRESENTAZIONI',id,'presentazione.json'),'utf8')).settings.fontFamily,'testme');
  await click('Annulla nella presentazione');await click('Annulla nella presentazione');await click('Testo');
  const contaOggetti=await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.length');
  await frameWait('document.querySelector(".reveal").dataset.bloccato==="false"');
  await frameVal(`document.querySelector('[data-block-id="'+${q(textId)}+'"]').focus()`);
  await frameClient.invia('Input.dispatchKeyEvent',{type:'keyDown',key:'d',code:'KeyD',modifiers:4,windowsVirtualKeyCode:68});await frameClient.invia('Input.dispatchKeyEvent',{type:'keyUp',key:'d',code:'KeyD',modifiers:4,windowsVirtualKeyCode:68});
  await wait('ZainoPresenta.documento.stacks[0].slides[0].blocks.length==='+String(contaOggetti+1));
  await click('Annulla nella presentazione');await click('Testo');
  assert.equal(await c.val(`(()=>{const e=document.querySelector('#presentaPane textarea'),k=new KeyboardEvent('keydown',{key:'Backspace',bubbles:true,cancelable:true});e.dispatchEvent(k);return k.defaultPrevented;})()`),false,'cancellare nel campo di testo non elimina l’oggetto');
  // Escape funziona anche quando il fuoco è nel pannello delle proprietà.
  await c.val(`document.querySelector('#presentaPane [aria-label="Dimensione testo"]').focus()`);
  for(const type of ['keyDown','keyUp'])await c.invia('Input.dispatchKeyEvent',{type,key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await frameWait(`!document.querySelector('.presenta-blocco[data-selezionato="true"]')`);assert(!await c.val(`!!document.querySelector(".presenta-bubble:popover-open")`));
  await click('Testo');await frameVal('document.activeElement.blur()');
  for(const type of ['keyDown','keyUp'])await frameClient.invia('Input.dispatchKeyEvent',{type,key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await frameWait(`!document.querySelector('.presenta-blocco[data-selezionato="true"]')`);
  await click('Testo');await click('Comandi dell’oggetto');await click('Copia oggetto');
  await c.val(`document.querySelector('.presenta-scaletta [aria-label="Nuova slide"]').scrollIntoView({block:"center"})`);await c.clicca('.presenta-scaletta [aria-label="Nuova slide"]');await wait('!!document.querySelector(".presenta-scelta-modello[open]")');
  await c.clicca('.presenta-scelta-modello [data-modello=colonne]');
  assert.equal(await c.val('ZainoPresenta.documento.stacks[1].slides[0].blocks.length'),3);
  await click('Incolla oggetto');assert.equal(await c.val('ZainoPresenta.documento.stacks[1].slides[0].blocks.at(-1).markdown'),'La clorofilla cattura la luce. Formula: \\(x^2\\)');
  assert.equal(await c.val('ZainoPresenta.documento.stacks[1].slides[0].blocks.at(-1).style.fontFamily'),'georgia');
  await click('Annulla nella presentazione');assert.equal(await c.val('ZainoPresenta.documento.stacks[1].slides[0].blocks.length'),3);await click('Annulla nella presentazione');assert.equal(await c.val('ZainoPresenta.documento.stacks.length'),1);await click('Testo');
  await click('Immagine');await frameWait('document.querySelector(".reveal").dataset.bloccato==="false"');await click('Ritaglia immagine');
  await wait('!!document.querySelector(".presenta-ritaglio-dialog[open]") && document.querySelector(".presenta-ritaglio-editor img").naturalWidth>0');
  await click('1:1');await c.clicca('.presenta-area-ritaglio');
  for(const type of ['keyDown','keyUp'])await c.invia('Input.dispatchKeyEvent',{type,key:'ArrowRight',code:'ArrowRight',modifiers:1,windowsVirtualKeyCode:39});
  fs.writeFileSync('/private/tmp/presenta-ritaglio-reale.png',Buffer.from((await c.invia('Page.captureScreenshot',{format:'png'})).result.data,'base64'));
  await click('Applica ritaglio');
  const ritaglioSalvato=await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="image").crop');assert(ritaglioSalvato);assert(Math.abs(ritaglioSalvato.width*ritaglioSalvato.aspect/ritaglioSalvato.height-1)>.001,'il bordo cambia le proporzioni del ritaglio');
  await frameWait('!!document.querySelector(".presenta-immagine-ritagliata image") && document.querySelector(".reveal").dataset.bloccato==="false"');
  assert((await frameVal('document.querySelector(".presenta-immagine-ritagliata image").getAttribute("href")')).startsWith('presenta:'));
  await click('Ritaglia immagine');await wait('document.querySelector(".presenta-ritaglio-editor img").naturalWidth>0');await click('16:9');await click('Annulla ritaglio');assert.deepEqual(await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="image").crop'),ritaglioSalvato);
  await click('Ritaglia immagine');await wait('document.querySelector(".presenta-ritaglio-editor img").naturalWidth>0');await click('Rimuovi ritaglio');assert.equal(await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="image").crop'),undefined);await click('Annulla nella presentazione');
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
  await riordinaMiniature(ordinePrima[0][0],ordinePrima[1][0],true);await wait('ZainoPresenta.documento.stacks.length===1');
  assert.deepEqual(await c.val('ZainoPresenta.documento.stacks[0].slides.map(s=>s.id)'),[ordinePrima[1][0],...ordinePrima[0],...ordinePrima[1].slice(1)]);
  await c.val('ZainoPresenta.flush()');assert.equal(JSON.parse(fs.readFileSync(path.join(v,'Zaini/biologia/PRESENTAZIONI',id,'presentazione.json'))).stacks.length,1);
  await click('Annulla nella presentazione');assert.deepEqual(await c.val('ZainoPresenta.documento.stacks.map(s=>s.slides.map(s=>s.id))'),ordinePrima);

  await click('Duplica slide');assert.equal(await c.val('PresentaModello.posizioni(ZainoPresenta.documento).length'),4);await click('Annulla nella presentazione');assert.equal(await c.val('PresentaModello.posizioni(ZainoPresenta.documento).length'),3);await click('Ripeti nella presentazione');assert.equal(await c.val('PresentaModello.posizioni(ZainoPresenta.documento).length'),4);await click('Annulla nella presentazione');
  await c.val('ZainoPresenta.flush()');await click('Chiudi presentazione');await wait('!ZainoPresenta.documento');
  await c.val(`ZainoPresenta.apri(${q(id)})`);assert.equal(await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="text").style.fontFamily'),'georgia');assert.deepEqual(await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="image").style.box'),geometriaSalvata);assert.deepEqual(await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="image").crop'),ritaglioSalvato);assert.equal(await c.val('ZainoPresenta.documento.stacks[0].slides[0].notes.markdown'),'NOTA_PRIVATA_UI · Chiedere un esempio alla classe.');
  await click('Audio');await c.val(`(()=>{const e=document.querySelector('#presentaPane [aria-label="Fine (secondi)"]');e.value='.8';e.dispatchEvent(new Event('change'));})()`);await frameWait('document.querySelector("audio")?.getAttribute("src")?.endsWith("#t=0,0.8")');
  await click('Usa media intero');assert.equal(await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="audio").end'),undefined);
  // La selezione delle parole attraversa iframe, menu del padre, disco e riapertura.
  await click('Testo');await frameWait('document.querySelector(".reveal").dataset.bloccato==="false"');
  const geometrieTesto=await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.map(b=>b.style?.box)');
  await frameVal(`document.querySelector('[data-testo-id="'+${q(textId)}+'"]').dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true}))`);
  await wait(`!!document.querySelector('[aria-label="Carattere delle parole"]')`);
  assert.equal(await c.val(`getComputedStyle(document.querySelector('[aria-label="Corsivo sulle parole"]')).fontStyle`),'italic');
  assert.equal(await c.val(`getComputedStyle(document.querySelector('[aria-label="Sottolineato sulle parole"]')).textDecorationLine`),'underline');
  await cicloRighelli(1);await click('Testo');await click('Scrivi sul foglio');await frameWait('!!document.querySelector("[contenteditable=true]")');assert(await frameVal('!!document.querySelector(".presenta-guide-fisse")'),'guide conservate durante la scrittura');fs.writeFileSync('/private/tmp/presenta-guide-reali.png',Buffer.from((await c.invia('Page.captureScreenshot',{format:'png'})).result.data,'base64'));await cicloRighelli(3);await click('Testo');await click('Scrivi sul foglio');await frameWait('!!document.querySelector("[contenteditable=true]")');

  await frameVal(`(()=>{const el=document.querySelector('[data-testo-id="'+${q(textId)}+'"]'),n=el.firstChild.firstChild,r=document.createRange();r.setStart(n,3);r.setEnd(n,13);const s=getSelection();s.removeAllRanges();s.addRange(r);document.dispatchEvent(new Event('selectionchange'));})()`);
  await wait(`!!document.querySelector('[aria-label="Carattere delle parole"]')`);
  await c.val('document.querySelector(".presenta-corpo").dispatchEvent(new Event("scroll"));new Promise(r=>requestAnimationFrame(r))');
  assert(await c.val('!!document.querySelector(".presenta-bubble:popover-open")'),'il menu di scrittura rimane disponibile dopo lo scorrimento');
  await click('Carattere delle parole');
  await click('Atkinson Hyperlegible');
  await wait('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="text").richText?.some(n=>n.text==="clorofilla"&&n.style?.fontFamily==="atkinson")');
  assert.equal(await c.val(`document.querySelector('[aria-label="Carattere delle parole"]').textContent`),'Atkinson Hyperlegible');
  assert(await c.val(`(()=>{const a=document.querySelector('[aria-label="Carattere delle parole"]').getBoundingClientRect(),b=document.querySelector('[aria-label="Dimensione delle parole"]').getBoundingClientRect();return Math.abs(a.height-b.height)<1&&Math.abs(a.y-b.y)<1;})()`),'altezza e allineamento del bubble uguali');
  await click('Collegamento delle parole');await wait('document.getElementById("uiModal").hasAttribute("open")');await c.val(`document.getElementById('umInput').value='https://example.org/lezione';document.getElementById('umOk').click()`);await wait('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="text").richText.some(n=>n.link==="https://example.org/lezione")');
  await click('Grassetto sulle parole');await click('Colore delle parole');await click('teal-700');
  await frameWait(`(()=>{const ns=[...document.querySelector('[data-testo-id="'+${q(textId)}+'"]').children],n=ns.find(n=>n.textContent==='clorofilla');return n&&getComputedStyle(n).fontFamily.includes('Atkinson')&&getComputedStyle(n).color==='rgb(15, 118, 110)';})()`);
  await click('Carattere delle parole');await click('Atkinson Hyperlegible Next');await c.val(`(()=>{const e=document.querySelector('[aria-label="Peso delle parole"]');e.value='300';e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await frameWait(`(()=>{const n=[...document.querySelectorAll('[data-testo-id="'+${q(textId)}+'"] span')].find(n=>n.textContent==='clorofilla');return n&&getComputedStyle(n).fontWeight==='300'&&getComputedStyle(n).fontFamily.includes('Next');})()`);
  assert.equal(await c.val(`document.querySelector('[aria-label="Peso delle parole"]').value`),'300');
  assert.equal(await c.val(`document.querySelector('[aria-label="Grassetto sulle parole"]').getAttribute('aria-pressed')`),'false');
  for(const stile of ['normal','italic'])for(const peso of [200,300,400,500,600,700,800])assert(await frameVal(`document.fonts.load('${stile} ${peso} 32px "Atkinson Hyperlegible Next"').then(f=>f.length===1&&f[0].status==='loaded')`));
  assert(await frameVal(`document.fonts.load('32px "TestMe Sans Alternate"').then(f=>f.length===1)`));
  fs.writeFileSync('/private/tmp/presenta-parole-selezionate.png',Buffer.from((await c.invia('Page.captureScreenshot',{format:'png'})).result.data,'base64'));
  const testoRicco=await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="text").richText');
  assert.equal(testoRicco[0].style,undefined);assert(testoRicco.some(n=>n.latex==='x^2'));assert.equal(testoRicco.find(n=>n.text==='clorofilla').style.bold,false);
  await c.val('ZainoPresenta.flush()');assert.deepEqual(JSON.parse(fs.readFileSync(path.join(v,'Zaini/biologia/PRESENTAZIONI',id,'presentazione.json'))).stacks[0].slides[0].blocks.find(b=>b.type==='text').richText,testoRicco);
  assert.deepEqual(await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.map(b=>b.style?.box)'),geometrieTesto);
  for(const type of ['keyDown','keyUp'])await frameClient.invia('Input.dispatchKeyEvent',{type,key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await frameWait('!document.querySelector("[contenteditable=true]") && document.querySelector(".reveal").dataset.bloccato==="false"');
  await c.val(`ZainoPresenta.apri(${q(id)})`);await frameWait('document.querySelector(".reveal").dataset.bloccato==="false"');
  assert.deepEqual(await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="text").richText'),testoRicco);
  assert(await frameVal('!!document.querySelector(".katex")'));
  await click('Testo');await click('Scrivi sul foglio');await frameWait('!!document.querySelector("[contenteditable=true]")');
  await frameClient.invia('Input.insertText',{text:' Fine della spiegazione.'});
  await wait('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="text").richText.some(n=>n.text?.includes("Fine della spiegazione"))');
  await click('Termina scrittura');await frameWait('!document.querySelector("[contenteditable=true]")');
  await click('Annulla nella presentazione');assert.deepEqual(await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="text").richText'),testoRicco);
  await click('Ripeti nella presentazione');await c.val('ZainoPresenta.flush()');
  fs.writeFileSync('/private/tmp/presenta-parole-reale.png',Buffer.from((await c.invia('Page.captureScreenshot',{format:'png'})).result.data,'base64'));
  // Il popup ricco riusa l’editor sul foglio e conserva formule e stili delle altre parole.
  const primaPopup=await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="text").richText');
  await click('Testo');await click('Modifica testo');await wait('!!document.querySelector(".presenta-input-popup [contenteditable=true]")');
  assert(await c.val('!!document.querySelector(".presenta-input-popup [data-atomo]")'),'formula presente anche nel campo popup');
  assert.equal(await c.val('parseFloat(getComputedStyle(document.querySelector(".presenta-input-ricco [contenteditable]")).fontSize)'),await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="text").style.fontSize'),'il popup eredita le dimensioni del riquadro');
  fs.writeFileSync('/private/tmp/presenta-popup-testo.png',Buffer.from((await c.invia('Page.captureScreenshot',{format:'png'})).result.data,'base64'));
  await c.invia('Input.insertText',{text:' Nel popup.'});await c.val('ZainoPresenta.flush()');
  assert(await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="text").richText.some(n=>n.text?.includes("Nel popup."))'));
  await c.val(`(()=>{const el=[...document.querySelectorAll('.presenta-input-ricco [data-stile]')].find(e=>e.textContent==='clorofilla'),r=document.createRange();r.selectNodeContents(el);const s=getSelection();s.removeAllRanges();s.addRange(r);document.dispatchEvent(new Event('selectionchange'));})()`);
  await click('Carattere delle parole');await click('TestMe Sans');await wait('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="text").richText.some(n=>n.text==="clorofilla"&&n.style?.fontFamily==="testme")');
  const dopoPopup=await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="text").richText');
  assert.deepEqual(dopoPopup.filter(n=>n.text===undefined),primaPopup.filter(n=>n.text===undefined));
  const attesoPopup={...primaPopup.find(n=>n.text==='clorofilla')?.style,fontFamily:'testme'};delete attesoPopup.fontWeight;assert.deepEqual(dopoPopup.find(n=>n.text==='clorofilla')?.style,attesoPopup,'TestMe usa Regular e conserva gli altri formati della parola');
  await c.clicca('.presenta-input-popup [aria-label="Chiudi campo"]');await click('Annulla nella presentazione');await click('Annulla nella presentazione');
  assert.deepEqual(await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="text").richText'),primaPopup);
  // Stili annullabili e proposta di disposizione che non modifica nulla prima di Applica.
  const primaStile=await c.val('ZainoPresenta.documento.stacks');
  await click('Stile');
  assert.equal(await c.val('document.querySelectorAll(".presenta-stile-tessera").length'),9);
  assert.equal(await c.val('document.querySelectorAll("[data-slot-stile]").length'),6);
  assert(await c.val('(()=>{const g=document.querySelector(".presenta-stili-galleria"),p=document.querySelector(".presenta-lavoro");return g.scrollWidth>g.clientWidth&&p.scrollWidth<=p.clientWidth+1;})()'),'la galleria scorre dentro il pannello');
  assert(await c.val('(()=>{const f=document.querySelector(".presenta-stili-controlli .tbtn").getBoundingClientRect(),s=document.querySelector(".presenta-stili-controlli select").getBoundingClientRect();return f.height===s.height&&f.width<=201;})()'),'campi compatti con altezza comune');
  await click('Crea stile 1');await wait('!!document.querySelector(".presenta-tema-dialog[open]")');
  await c.val(`(()=>{const e=document.querySelector('.presenta-tema-dialog [aria-label="Nome"]');e.value="Scienze";e.dispatchEvent(new Event("input"));})()`);
  await c.clicca('.presenta-tema-dialog [aria-label="Colore sfondo dello stile"]');await c.clicca('.presenta-tema-dialog [aria-label="sky-100"]');
  await c.clicca('.presenta-tema-dialog [aria-label="Salva stile"]');
  assert.equal(await c.val('JSON.parse(localStorage.getItem("studia.presenta.stili"))[0].sfondo'),'#e0f2fe');
  assert.deepEqual(await c.val('ZainoPresenta.documento.stacks'),primaStile,'salvare il tema non modifica la slide');
  await c.val(`(()=>{const e=document.querySelector('[aria-label="Applica lo stile a"]');e.value='tutte';e.dispatchEvent(new Event('change'));})()`);
  await click('Scienze');assert.equal(await c.val('ZainoPresenta.documento.stacks[0].slides[0].background'),'#e0f2fe');
  assert(await c.val('ZainoPresenta.documento.stacks.every(p=>p.slides.every(s=>s.background==="#e0f2fe"))'));
  assert.equal(await c.val(`document.querySelector('[aria-label="Applica lo stile a"]').value`),'tutte','ambito conservato dopo il ridisegno');
  await click('Annulla nella presentazione');assert.deepEqual(await c.val('ZainoPresenta.documento.stacks'),primaStile);
  await click('Stile');await c.val(`(()=>{const e=document.querySelector('[aria-label="Applica lo stile a"]');e.value='slide';e.dispatchEvent(new Event('change'));})()`);await click('Modifica stile 1');assert.equal(await c.val(`document.querySelector('.presenta-tema-dialog [aria-label="Nome"]').value`),'Scienze');await c.clicca('.presenta-tema-dialog [aria-label="Chiudi"]');
  await c.val('document.querySelector(".presenta-stili-galleria").scrollLeft=0;document.querySelector(".presenta-stili-compatti").scrollIntoView({block:"center",behavior:"instant"})');
  fs.writeFileSync('/private/tmp/presenta-stile-compatto.png',Buffer.from((await c.invia('Page.captureScreenshot',{format:'png'})).result.data,'base64'));
  const layoutCompatto=await c.val('bancoStato()');await c.val('bancoForma("uno");bancoAssegna("A","presenta")');await wait('!document.querySelector("#toast")?.classList.contains("show")');
  for(const tab of ['Stile','Disposizione','Testo','Titolo','Immagine','Righelli']){
   await click(tab);await c.val('document.querySelector(".presenta-proprieta-foglio").scrollIntoView({block:"end",behavior:"instant"});new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
   assert(await c.val('(()=>{const p=document.querySelector(".presenta-lavoro");return p.scrollWidth<=p.clientWidth+1;})()'),tab+' senza overflow orizzontale');
   if(tab==='Stile')assert(await c.val('(()=>{const g=document.querySelector(".presenta-stili-galleria").getBoundingClientRect(),c=document.querySelector(".presenta-stili-controlli").getBoundingClientRect();return g.left>c.right&&Math.abs(g.top-c.top)<2;})()'),'galleria affiancata nello split largo');
   if(['Testo','Titolo'].includes(tab))assert(await c.val(`(()=>{const p=document.querySelector('[aria-label="Posizione"]').getBoundingClientRect(),i=document.querySelector(".presenta-interlinea").getBoundingClientRect();return p.width<=90&&i.width<=161;})()`),'Posizione e interlinea compatti');
   if(['Testo','Titolo','Immagine'].includes(tab))assert(await c.val(`(()=>{const a=document.querySelector('#presentaPane [aria-label="Carattere"]').getBoundingClientRect();return ['Grassetto','Corsivo','Sottolineato','Posizione'].every(n=>{const b=document.querySelector('#presentaPane [aria-label="'+n+'"]').getBoundingClientRect();return Math.abs(b.bottom-a.bottom)<1&&Math.abs(b.height-a.height)<1;});})()`) ,'formati e posizione nella riga del font');
   fs.writeFileSync('/private/tmp/presenta-'+tab.toLowerCase()+'-largo.png',Buffer.from((await c.invia('Page.captureScreenshot',{format:'png'})).result.data,'base64'));
   if(tab==='Titolo'){await click('Posizione');fs.writeFileSync('/private/tmp/presenta-posizione-bubble.png',Buffer.from((await c.invia('Page.captureScreenshot',{format:'png'})).result.data,'base64'));await click('Posizione');}
  }
  await c.val(`BANCO.stato=${q(layoutCompatto)};bancoSalva();bancoDisegna()`);await click('Stile');
  await click('Lavagna');assert.equal(await c.val('ZainoPresenta.documento.stacks[0].slides[0].background'),'#0f172a');
  await click('Annulla nella presentazione');assert.deepEqual(await c.val('ZainoPresenta.documento.stacks'),primaStile);
  await click('Disposizione');assert.equal(await c.val('document.querySelectorAll(".presenta-disposizione-compatta h3").length'),0);assert(await c.val('(()=>{const a=document.querySelector(".presenta-modelli").getBoundingClientRect(),b=document.querySelector(".presenta-bacchetta").getBoundingClientRect();const c=document.querySelector(".presenta-modello").getBoundingClientRect();return Math.abs(b.width-c.width)<1&&Math.abs(b.height-c.height)<1;})()'));await click('Sistema la slide');await wait('!!document.querySelector(".presenta-sistema-dialog[open]")');
  assert.deepEqual(await c.val('ZainoPresenta.documento.stacks'),primaStile);await c.clicca('[aria-label="Annulla proposta"]');
  assert.deepEqual(await c.val('ZainoPresenta.documento.stacks'),primaStile);
  await click('Sistema la slide');await wait('!!document.querySelector(".presenta-sistema-dialog[open]")');await c.clicca('[aria-label="Applica disposizione"]');
  assert.notDeepEqual(await c.val('ZainoPresenta.documento.stacks'),primaStile);await click('Annulla nella presentazione');assert.deepEqual(await c.val('ZainoPresenta.documento.stacks'),primaStile);
  await click('Audio');await click('Scegli e prova il frammento');
  await wait(`!!document.querySelector('.presenta-clip-dialog[open]') && !document.querySelector('[aria-label="Inizio del frammento"]').disabled`);
  await c.val(`(()=>{const a=document.querySelector('[aria-label="Inizio del frammento"]'),b=document.querySelector('[aria-label="Fine del frammento"]');a.value='.2';b.value='.6';b.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await c.clicca('[aria-label="Prova il frammento"]');await c.clicca('[aria-label="Pausa frammento"]');await c.clicca('[aria-label="Applica frammento"]');
  assert.equal(await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="audio").start'),.2);
  assert.equal(await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="audio").end'),.6);await click('Annulla nella presentazione');
  // Trasporto reale dalla sidebar principale; la raccolta resta intatta.
  await c.val('zainoNavAggiorna()');await wait(`!!document.querySelector('#zainoNav [data-file="album:'+${q(aid)}+'"]')`);
  const primaDrop=await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.length');
  await c.val(`(()=>{const el=document.querySelector('#zainoNav [data-file="album:'+${q(aid)}+'"]'),dt=new DataTransfer();el.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:dt}));if(!dt.getData('application/x-studia-presenta-media'))throw Error('Trasporto media assente');document.getElementById('presentaPane').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));el.dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer:dt}));})()`);
  await wait('ZainoPresenta.documento.stacks[0].slides[0].blocks.length==='+String(primaDrop+1));await click('Annulla nella presentazione');
  // Selezione multipla: allinea in una sola operazione senza cambiare testo o immagini.
  await click('Testo');await frameWait('document.querySelector(".reveal").dataset.bloccato==="false"');
  const primaGruppo=await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks');
  await frameVal(`document.querySelector('[data-block-id="'+${q(imageId)}+'"]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,button:0,shiftKey:true,pointerId:15}))`);
  await wait(`!!document.querySelector('#presentaPane [aria-label="Allinea in alto"]')`);await click('Allinea in alto');
  assert.equal(await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="image").style.box.y'),await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="text").style.box.y'));
  await click('Annulla nella presentazione');assert.deepEqual(await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks'),primaGruppo);
  await click('Duplica selezionati');assert.equal(await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.length'),primaGruppo.length+2);await click('Annulla nella presentazione');
  await click('Immagine');await click('Sostituisci immagine');await wait('!!document.querySelector(".presenta-materiali[open] .lim-menu-voce")');
  await c.clicca('.presenta-materiali[open] .lim-menu-voce');await wait('!ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="image").crop');
  assert.deepEqual(await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="image").style.box'),primaGruppo.find(b=>b.type==='image').style.box);await click('Annulla nella presentazione');
  await click('Aggiungi forma');await wait('ZainoPresenta.documento.stacks[0].slides[0].blocks.some(b=>b.type==="shape")');
  await c.val(`(()=>{const e=document.querySelector('select[aria-label="Forma"]');e.value='ellipse';e.dispatchEvent(new Event('change'));})()`);await frameWait('!!document.querySelector(".presenta-forma ellipse")');
  await click('Annulla nella presentazione');await click('Annulla nella presentazione');
  await click('Aggiungi tabella');await wait('!!document.querySelector(".presenta-tabella-dialog[open]")');
  await c.val(`(()=>{const e=document.querySelector('[aria-label="Riga 1 · colonna 1"]');e.value='Organismo';e.dispatchEvent(new Event('input'));})()`);
  await c.clicca('[aria-label="Applica tabella"]');await frameWait('document.querySelector(".presenta-slide table th")?.textContent==="Organismo"');
  await click('Annulla nella presentazione');await click('Annulla nella presentazione');
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
  const target=(await (await fetch('http://localhost:'+(process.env.STUDIA_PORTA||8999)+'/json')).json()).find(t=>t.type==='page'&&t.url.endsWith('/presentazioni-player/index.html'));assert(target);const pubblico=await collegaTarget(target);
  assert.equal(await pubblico.val('typeof window.vault'),'undefined');assert(!await pubblico.val('document.documentElement.outerHTML.includes("NOTA_PRIVATA_UI")'));
  await wait('!!document.querySelector(".presenta-immagine-ritagliata image")',pubblico);
  assert(await pubblico.val(`(async()=>{const e=document.querySelector('.presenta-immagine-ritagliata image'),img=new Image();img.src=e.getAttribute('href');await img.decode();return img.naturalWidth>0;})()`),'la sorgente del ritaglio si decodifica nel player pubblico');
  await pubblico.val('document.querySelector("audio").play()');assert.equal(await pubblico.val('document.querySelector("audio").paused'),false);

  assert((await c.val(`window.vault.presentazioni.comando({azione:'sessione',corso:'biologia',sessionId:${q(sid)},comando:'avanti'})`)).ok);
  await wait('ZainoPresenta.regia?.stato.h===1');assert.equal(await pubblico.val('document.querySelector(\"audio\").paused'),true);assert.equal(await c.val('document.querySelector("#gobboPane .gobbo-titolo").textContent'),'Secondo argomento');
  assert((await c.val(`window.vault.presentazioni.comando({azione:'sessione',corso:'biologia',sessionId:${q(sid)},comando:'approfondisci'})`)).ok);await wait('ZainoPresenta.regia?.stato.v===1');
  for(const tema of ['chiaro','scuro']){
   await c.val(`document.documentElement.dataset.theme=${q(tema)}`);
   const stile=await c.val(`(()=>{const b=getComputedStyle(document.querySelector('#presentaPane [aria-label="Inserisci"]')),r=getComputedStyle(document.querySelector('#limPane .tbtn'));return {altezza:b.height,riferimento:r.height,font:b.fontSize,fontRiferimento:r.fontSize,angoli:b.borderRadius};})()`);
   assert.equal(stile.altezza,stile.riferimento);assert.equal(stile.font,stile.fontRiferimento);assert.equal(stile.angoli,'0px');
   const shot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/private/tmp/zaino-presenta-'+tema+'.png',Buffer.from(shot.result.data,'base64'));
  }await c.val(`document.documentElement.dataset.theme='chiaro'`);
  assert.deepEqual(await c.val('window.__erroriPresenta'),[],'nessun errore nascosto durante le interazioni');
  const screenshot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/private/tmp/zaino-presenta-editor.png',Buffer.from(screenshot.result.data,'base64'));
  assert((await c.val(`window.vault.presentazioni.comando({azione:'sessione',corso:'biologia',sessionId:${q(sid)},comando:'chiudi'})`)).ok);await wait('!ZainoPresenta.regia');
  // La regia si svuota prima della chiusura nativa: non lasciare al test successivo il target morente.
  let playerChiuso=false;for(let n=0;n<120;n++){const targets=await (await fetch('http://localhost:'+(process.env.STUDIA_PORTA||8999)+'/json')).json();if(!targets.some(t=>t.id===target.id)){playerChiuso=true;break;}await c.pausa(100);}assert(playerChiuso,'finestra pubblica davvero chiusa');
  await c.val('ZainoPresenta.chiudi()');
  console.log('✓ PRESENTA e GOBBO: tab contestuali, colori e cinque slot, titolo/testo indipendenti, miniature e riordino nativo, stile, adatta riquadro, media, autosave, riapertura, player e note private');
 }finally{
  try{await c.val('ZainoPresenta.chiudi()');await c.val(`BANCO.stato=${q(banco)};bancoSalva();bancoDisegna()`);}catch(_){}
  if(id)fs.rmSync(path.join(v,'Zaini/biologia/PRESENTAZIONI',id),{recursive:true,force:true});for(const cl of clients)cl.ws.close();c.ws()?.close();
 }
})().catch(e=>{console.error(e);c.ws()?.close();process.exitCode=1;});
