'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),c=require('./cdp'),q=JSON.stringify;
async function wait(e){for(let i=0;i<150;i++){if(await c.val(e))return;await c.pausa(80);}throw Error(e);}
(async()=>{await c.collega();await wait("typeof zainoAttivo==='function'&&typeof noteOpen==='function'&&zainoAttivo()==='biologia'");const vault=await c.val('vault.path');A(vault.includes('studia-zaino-prova-'));await c.partiPulito();const prima=await c.val('({banco:bancoStato(),memoria:{...localStorage}})');let file;
try{
 file=await c.val(`(()=>{const body=Array.from({length:18},(_,i)=>'Riga '+String(i).padStart(2,'0')+' testo di prova').join('\\n'),r=notesApi().save('biologia',null,{title:'Cursore negli split'},body);notesReload();bancoForma('due-col');bancoAssegna('A','fonte');bancoAssegna('C','appunti');noteOpen(r.file,NOTES);return r.file;})()`);
 await wait('!!NOTES.mde&&!!NOTES.cur');await c.pausa(200);
 await c.val(`(()=>{const cm=NOTES.mde.codemirror;cm.setOption('cursorBlinkRate',0);cm.refresh();cm.focus();cm.setCursor({line:7,ch:5});})()`);
 const posizione=await c.val(`(()=>{const line=[...document.querySelectorAll('#noteHost .CodeMirror-line')].find(e=>e.textContent.includes('Riga 07')),walker=document.createTreeWalker(line,NodeFilter.SHOW_TEXT);let t;while(t=walker.nextNode())if(t.textContent.includes('Riga 07'))break;const r=document.createRange();r.setStart(t,5);r.setEnd(t,6);const testo=r.getBoundingClientRect(),cursor=document.querySelector('#noteHost .CodeMirror-cursor').getBoundingClientRect();return {testo:testo.toJSON(),cursor:cursor.toJSON(),zoom:getComputedStyle(document.querySelector('#noteHost .CodeMirror')).zoom};})()`);
 console.log('Misure cursore',JSON.stringify(posizione));
 const cursoreAllineato=Math.abs(posizione.cursor.top+posizione.cursor.height/2-posizione.testo.top-posizione.testo.height/2)<4;
 const point={x:posizione.testo.left+1,y:posizione.testo.top+posizione.testo.height/2};for(const type of ['mousePressed','mouseReleased'])await c.invia('Input.dispatchMouseEvent',{type,...point,button:'left',clickCount:1});await c.invia('Input.insertText',{text:'X'});
 const rigaDopoClick=await c.val('NOTES.mde.codemirror.getCursor().line');console.log('Riga dopo click',rigaDopoClick);
 // Le transizioni non devono lasciare misure del cursore nella scala precedente.
 for(const forma of ['quattro','due-righe','uno','due-col']){
  await c.val(`bancoAttivaBlocco(bancoBloccoDi('appunti'));bancoForma(${q(forma)});NOTES.mde.codemirror.refresh();NOTES.mde.codemirror.focus();NOTES.mde.codemirror.setCursor({line:7,ch:5})`);
  const m=await c.val(`(()=>{const line=[...document.querySelectorAll('#noteHost .CodeMirror-line')].find(e=>e.textContent.includes('07')),t=document.createTreeWalker(line,NodeFilter.SHOW_TEXT).nextNode(),r=document.createRange();r.setStart(t,5);r.setEnd(t,6);const a=r.getBoundingClientRect(),b=document.querySelector('#noteHost .CodeMirror-cursor').getBoundingClientRect();return {dx:Math.abs(a.left-b.left),dy:Math.abs(a.top+a.height/2-b.top-b.height/2),font:getComputedStyle(document.querySelector('#noteHost .CodeMirror')).fontSize};})()`);
  A(m.dx<2&&m.dy<4,'Cambio forma '+forma+': '+JSON.stringify(m));A.equal(parseFloat(m.font),forma==='uno'?17:12.75);
 }
 // Il comando fisico funziona anche dal textarea di CodeMirror, senza scrivere Invio.
 const primaTasto=await c.val(`({testo:NOTES.mde.codemirror.getValue(),cursor:NOTES.mde.codemirror.getCursor(),banco:bancoStato()})`);
 for(const intero of [true,false]){
  for(const type of ['keyDown','keyUp'])await c.invia('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',modifiers:1});
  await wait(`Boolean(bancoZoomLeggi())===${intero}`);await c.pausa(150);
  const dopo=await c.val(`({testo:NOTES.mde.codemirror.getValue(),cursor:NOTES.mde.codemirror.getCursor(),focus:NOTES.mde.codemirror.hasFocus(),font:parseFloat(getComputedStyle(document.querySelector('#noteHost .CodeMirror')).fontSize)})`);
  A.equal(dopo.testo,primaTasto.testo);A.deepEqual(dopo.cursor,primaTasto.cursor);A(dopo.focus,'Alt+Invio conserva il focus nell’appunto');A.equal(dopo.font,intero?17:12.75);
 }
 A.deepEqual(await c.val('bancoStato()'),primaTasto.banco);
 await c.val(`BancoPresentazione.schermoIntero('appunti')`);await c.pausa(150);A.equal(await c.val(`parseFloat(getComputedStyle(document.querySelector('#noteHost .CodeMirror')).fontSize)`),17);await c.val('BancoPresentazione.esciIntero()');await c.pausa(150);A.equal(await c.val(`parseFloat(getComputedStyle(document.querySelector('#noteHost .CodeMirror')).fontSize)`),12.75);
 await c.val('noteAlternaAnteprima(NOTES)');A.equal(await c.val(`getComputedStyle(document.querySelector('#noteHost .editor-preview')).zoom`),'0.75');await c.val('noteAlternaAnteprima(NOTES)');
 fs.writeFileSync('/private/tmp/zaino-appunti-cursore.png',Buffer.from((await c.invia('Page.captureScreenshot',{format:'png'})).result.data,'base64'));
 await c.val('apriGuida()');
 const rientro=await c.val(`(()=>{const row=[...document.querySelectorAll('table.guida tr')].find(e=>e.textContent.includes('Testo ed elenco insieme')),out=row.querySelector('.g-out'),p=out.querySelector('p'),li=out.querySelector('li');return {testo:p.getBoundingClientRect().left,voce:li.getBoundingClientRect().left};})()`);
 console.log('Rientro guida',JSON.stringify(rientro));A(rientro.voce-rientro.testo>=20,'La guida mostra il rientro degli elenchi');A(cursoreAllineato,'Cursore sulla stessa riga del testo a metà schermo');A.equal(rigaDopoClick,7,'Il click scrive sulla riga indicata');
 await c.val(`[...document.querySelectorAll('table.guida tr')].find(e=>e.textContent.includes('Testo ed elenco insieme')).scrollIntoView({block:'center'})`);fs.writeFileSync('/private/tmp/zaino-appunti-guida-rientri.png',Buffer.from((await c.invia('Page.captureScreenshot',{format:'png'})).result.data,'base64'));
 console.log('✓ APPUNTI: cursore e click allineati al testo nello split ridotto; guida con rientri');
}finally{await c.val(`chiudiGuida();noteMolla();localStorage.clear();for(const[k,v]of Object.entries(${q(prima.memoria)}))localStorage.setItem(k,v);BANCO.stato=${q(prima.banco)};bancoDisegna()`);if(file)require('../../lib/appunti').remove(vault,'biologia',file);}c.ws().close();})().catch(e=>{console.error(e);c.ws()?.close();process.exitCode=1;});
