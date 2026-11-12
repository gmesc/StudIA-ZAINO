'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),c=require('./cdp'),q=JSON.stringify;
const pronto="!!document.querySelector('#noteHost .note-a4-paper')&&document.querySelector('#noteHost .note-a4').getAttribute('aria-busy')!=='true'";
async function wait(e){for(let i=0;i<160;i++){if(await c.val(e))return;await c.pausa(70);}throw Error('Attesa: '+e);}
async function mouse(type,p,buttons=0){await c.invia('Input.dispatchMouseEvent',{type,...p,button:type==='mouseMoved'?'none':'left',buttons,clickCount:type==='mouseMoved'?0:1});}
(async()=>{
 await c.collega();await wait("typeof AppuntiA4!=='undefined'&&zainoAttivo()==='biologia'");await c.partiPulito();const vault=await c.val('vault.path');A(vault.includes('studia-zaino-prova-'));const stato=await c.val('({banco:bancoStato(),attivo:BANCO.attivo,storage:{...localStorage}})');let file;
 try{
  file=await c.val(`(()=>{const n=notesApi().save('biologia',null,{title:'Gesti su carta'},${q(Array.from({length:50},(_,i)=>'Paragrafo '+(i+1)+'. '+('Testo della pagina da leggere e annotare. ').repeat(6)).join('\n\n'))});notesReload();bancoForma('uno');bancoAssegna('A','appunti');noteOpen(n.file,NOTES);AppuntiA4.scegli(NOTES,'a4');return n.file;})()`);await wait(pronto);
  // La vista conserva pagina e zoom fra appunti: questa prova parte dal primo foglio adattato.
  await c.val('AppuntiA4.pagina(NOTES,0,0)');await c.clicca('#noteHost [aria-label="Adatta il foglio al banco"]');
  await c.clicca('#noteHost .ncb-disegno');await wait("!!document.querySelector('#noteHost .note-annota-foglio svg')");await c.clicca('#noteHost [data-tool=freccia]');
  const r=await c.val("document.querySelector('#noteHost .note-annota-foglio svg').getBoundingClientRect().toJSON()");const a={x:r.x+r.width*.2,y:r.y+r.height*.1},b={x:r.x+r.width*.5,y:r.y+r.height*.2};
  await mouse('mousePressed',a,1);await mouse('mouseMoved',b,1);await mouse('mouseReleased',b);await c.clicca('.pdf-segni-bubble-head button');await c.clicca('#noteHost [data-applica-disegno]');await wait(pronto);
  const img='#noteHost .note-a4-figure img';await wait(`document.querySelector(${q(img)})?.naturalWidth>0`);await c.val(`AppuntiFigureUI.menu(document.querySelector(${q(img)}))`);
  const controlli=await c.val(`(()=>{const h=document.querySelector('.note-figure-posizione').getBoundingClientRect(),i=document.querySelector(${q(img)}).getBoundingClientRect();return {riquadro:h.width<i.width*.6&&h.height<i.height*.4,allineamenti:!document.querySelector('.note-figure-menu [data-allineamento]'),zoom:!!document.querySelector('#noteHost .note-a4-zoom input'),selezione:!!document.querySelector('#noteHost .ncb-seleziona-figure')};})()`);
  await c.val("AppuntiFigureUI.chiudi();document.querySelector('#noteHost .note-a4').focus()");await c.invia('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});await c.pausa(100);controlli.frecce=await c.val("document.querySelector('#noteHost .note-a4-paper').dataset.pagina==='2'");
  console.log('Controlli A4',controlli);A(Object.values(controlli).every(Boolean),'riquadro del tratto, selezione dietro al testo, zoom e navigazione disponibili');
  await c.invia('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});
  const pagina=()=>c.val("+document.querySelector('#noteHost .note-a4-paper').dataset.pagina");A.equal(await pagina(),1);
  const md=await c.val('NOTES.mde.value()');const base=await c.val("document.querySelector('#noteHost .note-a4-paper').getBoundingClientRect().width");
  await c.val("const z=document.querySelector('#noteHost .note-a4-zoom input');z.value=150;z.dispatchEvent(new Event('change',{bubbles:true}))");
  A(Math.abs(await c.val("document.querySelector('#noteHost .note-a4-paper').getBoundingClientRect().width")/base-1.5)<.01,'150% ingrandisce solo il foglio');
  await c.clicca('#noteHost [aria-label="Riduci il foglio A4"]');A.equal(await c.val("+document.querySelector('#noteHost .note-a4-zoom input').value"),125);
  await c.clicca('#noteHost [aria-label="Ingrandisci il foglio A4"]');A.equal(await c.val("+document.querySelector('#noteHost .note-a4-zoom input').value"),150);
  await c.clicca('#noteHost [aria-label="Adatta il foglio al banco"]');A.equal(await c.val('NOTES.mde.value()'),md,'zoom non modifica testo o coordinate dei disegni');
  await c.val("document.querySelector('#noteHost .note-a4').scrollTop=0");
  let box=await c.val("document.querySelector('#noteHost .note-a4').getBoundingClientRect().toJSON()"),p={x:box.right-35,y:box.y+80};
  await c.invia('Input.dispatchMouseEvent',{type:'mouseWheel',...p,deltaX:100,deltaY:0});await c.pausa(100);A.equal(await pagina(),2,'scroll laterale avanza');
  await c.invia('Input.dispatchMouseEvent',{type:'mouseWheel',...p,deltaX:100,deltaY:0});await c.pausa(100);A.equal(await pagina(),2,'inerzia non salta altre pagine');
  await c.pausa(260);await c.invia('Input.dispatchMouseEvent',{type:'mouseWheel',...p,deltaX:-100,deltaY:0});await c.pausa(100);A.equal(await pagina(),1,'scroll inverso torna indietro');
  await c.pausa(260);await c.val("const b=document.querySelector('#noteHost .note-a4');b.scrollTop=b.scrollHeight");await c.invia('Input.dispatchMouseEvent',{type:'mouseWheel',...p,deltaX:0,deltaY:160});await c.pausa(100);A.equal(await pagina(),2,'scroll verticale oltre il fondo continua alla pagina successiva');
  // Swipe reale, dall'esterno del disegno per non trascinare la figura.
  const touch=(x,y)=>({x,y,radiusX:3,radiusY:3,force:1,id:1});
  await c.invia('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(p.x-160,p.y)]});await c.invia('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch(p.x-80,p.y+2)]});await c.invia('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await c.pausa(100);A.equal(await pagina(),1,'swipe a destra torna alla pagina precedente');
  await c.val(`AppuntiFigureUI.menu(document.querySelector(${q(img)}))`);await c.clicca('.note-figure-menu [data-livello=back]');await wait(pronto);
  A.equal(await c.val("document.querySelector('#noteHost .ncb-seleziona-figure').getAttribute('aria-pressed')"),'true','portare sotto attiva la selezione delle figure');
  A(await c.val("getComputedStyle(document.querySelector('#noteHost .ncb-seleziona-figure')).backgroundColor!=='rgba(0, 0, 0, 0)'"),'la selezione delle figure ha uno stato visivo acceso');
  const punto=await c.val(`(()=>{const i=document.querySelector(${q(img)}),r=AppuntiFigureUI.rettangolo(i);return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  A(await c.val(`!document.elementFromPoint(${punto.x},${punto.y}).closest('.note-visual')`),'il testo copre il disegno nel punto di prova');
  await mouse('mousePressed',punto,1);await mouse('mouseReleased',punto);A(await c.val("!!document.querySelector('.note-figure-menu')&&!!document.querySelector('.note-figure-posizione')"),'clic sopra il testo seleziona il disegno sottostante');
  await c.val("document.querySelector('.note-figure-posizione').focus()");const prima=await c.val("AppuntiFigure.leggi(NOTES.mde.value().split('\\n'),0).style.a4.x");
  await c.invia('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});await wait(pronto);A.equal(await pagina(),1,'freccia sulla figura non cambia pagina');A(await c.val("AppuntiFigure.leggi(NOTES.mde.value().split('\\n'),0).style.a4.x")>prima,'freccia muove la figura dietro al testo');
  // Il riquadro segue i tratti anche quando cambia lo zoom del banco.
  await c.val("AppuntiFigureUI.chiudi();bancoForma('due-col')");await c.pausa(180);await c.val(`AppuntiFigureUI.menu(document.querySelector(${q(img)}))`);
  A(await c.val(`(()=>{const a=document.querySelector('.note-figure-posizione').getBoundingClientRect(),b=AppuntiFigureUI.rettangolo(document.querySelector(${q(img)}));return Math.abs(a.x-b.x)<1&&Math.abs(a.width-b.width)<1&&Math.abs(a.height-b.height)<1;})()`));
  fs.writeFileSync('/private/tmp/zaino-a4-selezione.png',Buffer.from((await c.invia('Page.captureScreenshot',{format:'png'})).result.data,'base64'));
  console.log('✓ A4: zoom senza reimpaginare, scroll/swipe/frecce, inerzia, selezione dietro al testo e riquadro aderente');
 }finally{await c.val("AppuntiAnnotaUI.chiudi(NOTES);AppuntiFigureUI.chiudi();AppuntiA4.scegli(NOTES,'scrittura');noteMolla()");if(file)require('../../lib/appunti').remove(vault,'biologia',file);await c.val(`localStorage.clear();for(const[k,v]of Object.entries(${q(stato.storage)}))localStorage.setItem(k,v);BANCO.stato=${q(stato.banco)};BANCO.attivo=${q(stato.attivo)};bancoDisegna();notesReload()`);c.ws().close();}
})().catch(e=>{console.error(e);c.ws()?.close();process.exitCode=1;});
