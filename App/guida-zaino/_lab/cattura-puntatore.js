/* Catture dall'app reale isolata: menu ¶ misurato e nove effetti del puntatore. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const L=require(path.join(process.cwd(),'App/guida-zaino/_lab/lab'));
const WS=require(path.join(process.cwd(),'node_modules/ws'));
const out=process.env.IMG_DIR;assert(out,'IMG_DIR obbligatorio');fs.mkdirSync(out,{recursive:true});
const q=JSON.stringify;
async function collega(t){const ws=new WS(t.webSocketDebuggerUrl),pending=new Map();let id=0;await new Promise(r=>ws.once('open',r));ws.on('message',s=>{const o=JSON.parse(s);if(pending.has(o.id)){pending.get(o.id)(o);pending.delete(o.id);}});const invia=(method,params)=>new Promise(r=>{pending.set(++id,r);ws.send(JSON.stringify({id,method,params}));});return {ws,invia,val:async expression=>{const r=await invia('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.result.exceptionDetails)throw Error(JSON.stringify(r.result.exceptionDetails));return r.result.result.value;}};}
async function aspetta(expr,c=L){for(let i=0;i<100;i++){if(await c.val(expr))return;await L.pausa(100);}throw Error(expr);}
async function mouse(type,p,buttons=0){await L.invia('Input.dispatchMouseEvent',{type,...p,buttons,button:'right',clickCount:type==='mouseMoved'?0:1});}
(async()=>{
 await L.collega();assert((await L.val('vault.path')).startsWith('/private/tmp/studia-guida-'));assert.equal(await L.val('zainoAttivo()'),'intro-a-zaino');
 const prima=await L.val('({laser:localStorage.getItem("zaino.proiezione.puntatore"),nota:NOTES.mde.value(),file:NOTES.cur.file,stato:BancoPresentazione.stato()})');assert(!prima.stato.proiezione,'Chiudere la proiezione nel solo runtime di prova');let peer,demo;
 try{
  await L.val("if(!document.querySelector('.note-stili-menu:popover-open'))document.querySelector('.note-stile-testo').click()");
  const misure=await L.val(`(()=>{const sels=['.note-stile-testo','.note-stili-menu [data-livello="0"]','.note-stili-menu [data-livello="1"]','.note-stili-menu [data-livello="2"]','.note-stili-menu [data-livello="6"]'];const rr=sels.map(s=>document.querySelector(s).getBoundingClientRect().toJSON()),menu=document.querySelector('.note-stili-menu').getBoundingClientRect();const x=Math.floor(Math.min(rr[0].x,menu.x)-12),y=Math.floor(Math.min(rr[0].y,menu.y)-12),right=Math.ceil(Math.max(rr[0].right,menu.right)+12),bottom=Math.ceil(menu.bottom+12);const clip={x,y,width:right-x,height:bottom-y};rr[3].height=rr[4].bottom-rr[3].y;return {clip,boxes:rr.slice(0,4).map(r=>[(r.x-x)/clip.width*100,(r.y-y)/clip.height*100,r.width/clip.width*100,r.height/clip.height*100])}})()`);
  await L.muovi(5,5);await L.pausa(200);await L.scatta('menu-paragrafo-20261112',{clip:misure.clip,scala:2});fs.writeFileSync(path.join(out,'menu-geometria.json'),q(misure));await L.tasto('Escape');
  demo=await L.val("(()=>{const n=notesApi().save('intro-a-zaino',null,{title:'Esempio del puntatore'},'# Studiare una fonte\\n\\nLeggi un breve passaggio.\\n\\nIndividua l’idea principale.\\n\\nSpiegala con parole tue.\\n\\n## Un esempio\\n\\nLe radici assorbono acqua.\\n\\nLe foglie ricevono luce.\\n\\nCollega le due informazioni.\\n\\n## Controlla\\n\\nRileggi la fonte per verificare.');notesReload();noteOpen(n.file,NOTES);return n.file;})()");
  await L.pausa(200);
  await L.val("BancoPresentazione.apriProiezione('appunti')");await aspetta("!!document.querySelector('.proiezione-laser-setting')");
  const targets=await(await fetch('http://localhost:'+process.env.STUDIA_PORTA+'/json')).json();peer=await collega(targets.find(t=>t.url.includes('/proiezione/index.html')));
  await peer.invia('Emulation.setDeviceMetricsOverride',{width:1000,height:700,deviceScaleFactor:1,mobile:false});await aspetta("document.querySelector('#contenuto').textContent.includes('Studiare una fonte')",peer);await aspetta("getComputedStyle(document.getElementById('barra')).visibility==='hidden'",peer);
  const report=[];
  for(const forma of ['laser','box','cerchio'])for(const [spot,spessore] of [[false,3],[true,3],[true,0]]){
   await L.clicca('.proiezione-laser-setting');await aspetta("!!document.querySelector('.laser-pop:popover-open')");await L.clicca('[data-laser-forma='+forma+']');
   if(await L.val("document.querySelector('[data-laser-spot]').getAttribute('aria-pressed')==='true'")!==spot)await L.clicca('[data-laser-spot]');
   await L.clicca('[data-laser-colore=rosso]');
   await L.val("{const a=document.querySelector('[data-laser-durata]');a.value=0;a.dispatchEvent(new Event('input',{bubbles:true}));const b=document.querySelector('[data-laser-spessore]');b.value="+spessore+";b.dispatchEvent(new Event('change',{bubbles:true}));}");await L.tasto('Escape');
   const r=await L.val("document.querySelector('.proiezione-area').getBoundingClientRect().toJSON()");
   const pts=forma==='box'?[[.25,.38],[.65,.62]]:forma==='cerchio'?[[.42,.46],[.60,.46]]:[[.26,.57],[.25,.43],[.28,.38],[.43,.37],[.58,.38],[.65,.44],[.64,.59],[.52,.63],[.33,.63]];
   const point=([x,y])=>({x:r.x+r.width*x,y:r.y+r.height*y});await mouse('mousePressed',point(pts[0]),2);
   for(const p of pts.slice(1)){await mouse('mouseMoved',point(p),2);await L.pausa(35);}await mouse('mouseReleased',point(pts.at(-1)));
   await aspetta("!!document.querySelector('#laser g')",peer);await L.pausa(180);
   const state=await peer.val("({forma:document.querySelector('#laser g').dataset.forma,spot:!document.getElementById('laserSpot').hidden,bordo:document.querySelector('#laser g').dataset.bordo,percorso:document.querySelector('#laser .laser-tratto').getAttribute('d')})");assert.equal(state.forma,forma);assert.equal(state.spot,spot);assert.equal(state.bordo,String(spessore>0));
   const name='laser-'+forma+'-spot-'+(spot?(spessore===0?'senza-bordo':'acceso'):'spento')+'.png';const shot=await peer.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name),Buffer.from(shot.result.data,'base64'));report.push({name,...state});console.log(name);
  }
  fs.writeFileSync(path.join(out,'effetti-verificati.json'),JSON.stringify(report,null,2));

 }finally{
  await L.val('BancoPresentazione.chiudiProiezione()');
  await L.val('noteOpen('+q(prima.file)+',NOTES)');
  if(demo){require(path.join(process.cwd(),'lib/appunti')).remove(await L.val('vault.path'),'intro-a-zaino',demo);await L.val('notesReload()');}
  assert.equal(await L.val('NOTES.mde.value()'),prima.nota,'Appunto originale conservato');
  await L.val(prima.laser===null?"localStorage.removeItem('zaino.proiezione.puntatore')":"localStorage.setItem('zaino.proiezione.puntatore',"+q(prima.laser)+")");peer?.ws.close();
 }
 process.exit();
})().catch(e=>{console.error(e);process.exit(1)});
