'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),WS=require('ws'),c=require('./cdp');
const porta=process.env.STUDIA_PORTA||9353;
async function targets(){return (await fetch('http://localhost:'+porta+'/json')).json();}
async function wait(expr,client=c){for(let i=0;i<120;i++){if(await client.val(expr))return;await c.pausa(80);}throw Error('Attesa: '+expr);}
async function collega(t){const ws=new WS(t.webSocketDebuggerUrl),pending=new Map();let id=0;await new Promise(r=>ws.once('open',r));ws.on('message',s=>{const o=JSON.parse(s);if(pending.has(o.id)){pending.get(o.id)(o);pending.delete(o.id);}});const invia=(method,params)=>new Promise(r=>{pending.set(++id,r);ws.send(JSON.stringify({id,method,params}));});return {ws,invia,val:async expression=>{const r=await invia('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.result.exceptionDetails)throw Error(JSON.stringify(r.result.exceptionDetails));return r.result.result.value;}};}
async function mouse(type,x,y,buttons=0){await c.invia('Input.dispatchMouseEvent',{type,x,y,buttons,button:buttons===2||type==='mouseReleased'?'right':'none',clickCount:type==='mouseMoved'?0:1});}
(async()=>{
 await c.collega();await wait("typeof BancoPresentazione!=='undefined'&&zainoAttivo()==='biologia'");A((await c.val('vault.path')).includes('studia-zaino-prova-'));await c.partiPulito();
 const prima=await c.val('({banco:bancoStato(),attivo:BANCO.attivo,storage:{...localStorage}})'),vault=await c.val('vault.path');let esterna,file;
 try{
  file=await c.val(`(()=>{const n=notesApi().save('biologia',null,{title:'Finestra esterna stabile'},'# Appunto proiettato\\n\\nUn testo per guidare lo sguardo.');notesReload();bancoForma('due-col');bancoAssegna('A','appunti');bancoAssegna('C','studio');noteOpen(n.file,NOTES);return n.file;})()`);
  await wait('!!NOTES.cur&&!!NOTES.mde');await c.val("BancoPresentazione.apriProiezione('appunti')");await wait("!!document.querySelector('.proiezione-area')");
  const peer=(await targets()).find(t=>t.url.includes('/proiezione/index.html'));A(peer,'finestra esterna aperta');
  esterna=await collega(peer);await wait("document.querySelector('#contenuto').textContent.includes('Appunto proiettato')",esterna);
  for(const blocco of ['A','C']){
   await c.val(`bancoZoom('${blocco}')`);await c.pausa(600);
   A((await targets()).some(t=>t.id===peer.id),'la stessa finestra esterna resta aperta ingrandendo il banco '+blocco);
   A.equal(await c.val('BancoPresentazione.stato().proiezione'),'appunti');
   await c.val('bancoZoomTorna()');await c.pausa(350);A((await targets()).some(t=>t.id===peer.id),'ritorno ai banchi senza chiudere la finestra');
  }
  await wait("document.querySelector('.proiezione-area')&&!document.querySelector('.proiezione-area').hidden");await c.pausa(350);
  const md=await c.val('NOTES.mde.value()'),rect=await c.val("document.querySelector('.proiezione-area').getBoundingClientRect().toJSON()");
  const punto=(x,y)=>({x:rect.x+rect.width*x,y:rect.y+rect.height*y});let a=punto(.2,.3),b=punto(.7,.6);
  await mouse('mouseMoved',a.x,a.y);await c.pausa(100);A.equal(await esterna.val("document.querySelectorAll('#laser g').length"),0,'il mouse senza click non viene trasmesso');
  A.equal(await c.val("document.querySelectorAll('#laserBanco g').length"),0,'nessun laser locale durante hover');
  await mouse('mousePressed',a.x,a.y,2);await mouse('mouseMoved',b.x,b.y,2);await wait("!!document.querySelector('#laser .laser-punto')",esterna);await c.pausa(100);
  const posizione=await esterna.val("(()=>{const r=document.getElementById('vista').getBoundingClientRect(),p=document.querySelector('#laser .laser-punto').getBoundingClientRect();return {x:p.x+p.width/2-r.x,y:p.y+p.height/2-r.y,w:r.width};})()");
  A(Math.abs(posizione.x/posizione.w-.7)<.005,'x laser allineata al ritaglio');A(Math.abs(posizione.y/posizione.w-.6*rect.height/rect.width)<.005,'y laser tiene conto del rapporto fra le finestre');
  A(await esterna.val("document.querySelector('#laser .laser-tratto').getAttribute('d').includes('L')"),'il puntatore lascia una traccia');
  const locale=await c.val("(()=>{const r=document.querySelector('#laserBanco .laser-punto').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,traccia:document.querySelector('#laserBanco .laser-tratto').getAttribute('d')};})()");
  A(Math.abs(locale.x-b.x)<1&&Math.abs(locale.y-b.y)<1,'il laser locale segue esattamente il mouse nel banco');A(locale.traccia.includes('L'),'traccia visibile anche al relatore');
  const traccia=await esterna.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/private/tmp/zaino-laser-traccia.png',Buffer.from(traccia.result.data,'base64'));
  await c.pausa(2200);A.equal(await esterna.val("getComputedStyle(document.querySelector('#laser g')).opacity"),'1','la traccia resta viva finché il destro è premuto');
  A.equal(await c.val("getComputedStyle(document.querySelector('#laserBanco g')).opacity"),'1','anche la traccia locale resta viva');
  await mouse('mouseReleased',b.x,b.y);await c.pausa(550);const opacita=await esterna.val("Number(getComputedStyle(document.querySelector('#laser g')).opacity)");A(opacita>0&&opacita<1,'dissolvenza dopo il rilascio');
  const opLocale=await c.val("Number(getComputedStyle(document.querySelector('#laserBanco g')).opacity)");A(opLocale>0&&opLocale<1&&Math.abs(opLocale-opacita)<.12,'dissolvenza coordinata nei due schermi');
  await c.pausa(1550);A.equal(await esterna.val("document.querySelectorAll('#laser g').length"),0,'traccia eliminata dopo 2 secondi');A.equal(await c.val('NOTES.mde.value()'),md,'nessuna annotazione salvata nel documento');
  A.equal(await c.val("document.querySelectorAll('#laserBanco g').length"),0,'anche il laser locale scompare dopo 2 secondi');
  // Lo zoom della proiezione cambia il ritaglio, non la corrispondenza del laser.
  await esterna.val("document.getElementById('piu').click()");await c.pausa(400);const crop=await c.val("document.querySelector('.proiezione-area').getBoundingClientRect().toJSON()");a={x:crop.x+crop.width*.4,y:crop.y+crop.height*.4};
  await mouse('mousePressed',a.x,a.y,2);await wait("!!document.querySelector('#laser .laser-punto')",esterna);A(Math.abs((await esterna.val("+document.querySelector('#laser .laser-punto').getAttribute('cx')/document.getElementById('vista').clientWidth"))-.4)<.005);
  const shot=await esterna.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/private/tmp/zaino-laser-esterno.png',Buffer.from(shot.result.data,'base64'));
  // Rilascio fuori dall'area: la cattura del puntatore conclude il gesto.
  await mouse('mouseReleased',10,10);await c.pausa(2100);A.equal(await esterna.val("document.querySelectorAll('#laser g').length"),0);
  A((await targets()).some(t=>t.id===peer.id));
  // La pagina A4 proiettata mantiene colonne e posizioni del banco originale.
  await c.val("AppuntiA4.scegli(NOTES,'a4')");await wait("document.querySelector('#noteHost .note-a4-paper')&&document.querySelector('#noteHost .note-a4').getAttribute('aria-busy')!=='true'");
  await wait("!!document.querySelector('#contenuto footer')",esterna);await c.pausa(450);
  const origine=await c.val("(()=>{const a=document.querySelector('.proiezione-area').getBoundingClientRect(),p=document.querySelector('#noteHost .note-a4-flow p').getBoundingClientRect();return {x:(p.x-a.x)/a.width,y:(p.y-a.y)/a.width,w:p.width/a.width,h:p.height/a.width};})()");
  const destinazione=await esterna.val("(()=>{const p=document.querySelector('#contenuto p').getBoundingClientRect(),w=document.getElementById('vista').clientWidth;return {x:p.x/w,y:p.y/w,w:p.width/w,h:p.height/w};})()");
  for(const k of ['x','y','w','h'])A(Math.abs(origine[k]-destinazione[k])<.005,'A4 proiettato fedele: '+k+' '+JSON.stringify({origine,destinazione}));
  A(await esterna.val("[...document.querySelectorAll('#contenuto div')].some(d=>getComputedStyle(d).columnWidth!=='auto')"),'colonne A4 conservate nella copia');
  // Il ripristino ricomincia a trasmettere, con la stessa finestra.
  await c.val("bancoZoom('C')");await c.pausa(350);A((await targets()).some(t=>t.id===peer.id));await c.val('bancoZoomTorna()');await c.pausa(350);
  await c.val("NOTES.mde.codemirror.replaceRange('Aggiornamento dopo il ripristino.\\n\\n',{line:0,ch:0})");await wait("document.getElementById('contenuto').textContent.includes('Aggiornamento dopo il ripristino.')",esterna);
  // Nei pannelli catturati come immagine il laser non va impresso nel fotogramma.
  await c.val('BancoPresentazione.chiudiProiezione()');esterna.ws.close();
  await c.val("bancoAssegna('C','album');const campione=document.createElement('div');campione.id='campione-laser';campione.style.cssText='position:absolute;inset:0;background:#fff;color:#111;z-index:4';campione.textContent='Campione';bancoElemento('album').append(campione);BancoPresentazione.apriProiezione('album')");
  await c.pausa(400);esterna=await collega((await targets()).find(t=>t.url.includes('/proiezione/index.html')));await wait("document.getElementById('immagine').naturalWidth>0",esterna);
  const sfondo=await esterna.val("document.getElementById('immagine').src"),ritaglio=await c.val("document.querySelector('.proiezione-area').getBoundingClientRect().toJSON()");
  a={x:ritaglio.x+ritaglio.width*.3,y:ritaglio.y+ritaglio.height*.5};b={x:ritaglio.x+ritaglio.width*.7,y:a.y};
  await mouse('mousePressed',a.x,a.y,2);await mouse('mouseMoved',b.x,b.y,2);await c.pausa(120);
  await c.val("document.getElementById('campione-laser').textContent='Campione aggiornato'");await wait(`document.getElementById('immagine').src!==${JSON.stringify(sfondo)}`,esterna);
  A.equal(await esterna.val("(()=>{const i=document.getElementById('immagine'),c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;const x=c.getContext('2d');x.drawImage(i,0,0);const d=x.getImageData(0,0,c.width,c.height).data;let rossi=0;for(let j=0;j<d.length;j+=4)if(d[j]>180&&d[j+1]<100&&d[j+2]<100)rossi++;return rossi;})()"),0,'nessuna traccia laser impressa nello screenshot');
  await wait("getComputedStyle(document.getElementById('laserBanco')).visibility==='visible'");await mouse('mouseReleased',b.x,b.y);
  console.log('✓ proiezione: finestra stabile nei banchi, laser solo col destro, coordinate/zoom, persistenza durante il gesto, dissolvenza 2s e rilascio fuori area');
 }finally{
  await c.val('BancoPresentazione.chiudiProiezione()');await c.val('bancoZoomTorna();AppuntiA4.scegli(NOTES,"scrittura");noteMolla()');
  await c.val("document.getElementById('campione-laser')?.remove()");
  if(file)require('../../lib/appunti').remove(vault,'biologia',file);
  await c.val(`localStorage.clear();for(const[k,v]of Object.entries(${JSON.stringify(prima.storage)}))localStorage.setItem(k,v);BANCO.stato=${JSON.stringify(prima.banco)};BANCO.attivo=${JSON.stringify(prima.attivo)};bancoDisegna();notesReload()`);esterna?.ws.close();c.ws().close();
 }
})().catch(e=>{console.error(e);c.ws()?.close();process.exitCode=1;});
