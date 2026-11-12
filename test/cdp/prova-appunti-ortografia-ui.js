'use strict';
const A=require('node:assert/strict'),c=require('./cdp'),q=JSON.stringify;
async function wait(expr){for(let i=0;i<160;i++){if(await c.val(expr))return;await c.pausa(100);}throw Error('Attesa: '+expr);}
(async()=>{
 await c.collega();await wait("typeof AppuntiStrumenti!=='undefined'&&zainoAttivo()==='biologia'");await c.partiPulito();
 const prima=await c.val('({...localStorage})'),vault=await c.val('vault.path'),fontPrima=await c.val('document.documentElement.dataset.fontUi');A(vault.includes('studia-zaino-prova-'));let file;const errori=[];
 try{
  file=await c.val(`(()=>{const n=notesApi().save('biologia',null,{title:'Ortografia UI'},${q('# Titolo\n\nUna prova della correzione.\n\nLa conoscienza offre conoscenza.')} );notesReload();bancoForma('uno');bancoAssegna('A','appunti');noteOpen(n.file,NOTES);AppuntiA4.scegli(NOTES,'scrittura');return n.file;})()`);
  for(const font of ['atkinson','zaino']){
   await c.val(`document.getElementById('aspettoFont').value=${q(font)};document.getElementById('aspettoFont').dispatchEvent(new Event('change'));document.fonts.ready`);
   const misure=await c.val(`(()=>{const base=getComputedStyle(document.querySelector('.mtoolbar select'));return [...document.querySelectorAll('#noteHost .note-lingua')].map(e=>{const s=getComputedStyle(e);return {font:s.fontFamily,dimensione:s.fontSize,atteso:base.fontFamily,dimensioneAttesa:base.fontSize};});})()`);
   console.log('Font',font,JSON.stringify(misure));if(misure.some(m=>m.font!==m.atteso||m.dimensione!==m.dimensioneAttesa))errori.push('Tendine disallineate con font UI '+font);
  }
  await c.clicca('#noteHost .note-lingua');await c.clicca('.note-dizionari-menu [data-lingua=it]');
  await wait("!!document.querySelector('#noteHost .note-errore-ortografico')");
  const r=await c.val("document.querySelector('#noteHost .note-errore-ortografico').getBoundingClientRect().toJSON()");
  for(const type of ['mousePressed','mouseReleased'])await c.invia('Input.dispatchMouseEvent',{type,x:r.x+r.width/2,y:r.y+r.height/2,button:'right',clickCount:1});
  await wait("[...document.querySelectorAll('.note-strumenti-menu:popover-open button')].some(b=>b.textContent==='conoscenza')");
  await c.pausa(200);
  const b=await c.val("document.querySelector('.note-strumenti-menu:popover-open').getBoundingClientRect().toJSON()");
  console.log('Bubble',JSON.stringify({parola:r,menu:b}));if(Math.abs(b.top-r.bottom)>35||Math.abs(b.left-r.left)>r.width+15)errori.push('Bubble lontano dalla parola cliccata');
  const p=await c.val("(()=>{const e=[...document.querySelectorAll('.note-strumenti-menu button')].find(b=>b.textContent==='conoscenza'),r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
  for(const type of ['mousePressed','mouseReleased'])await c.invia('Input.dispatchMouseEvent',{type,...p,button:'left',clickCount:1});
  await c.pausa(100);A.match(await c.val('NOTES.mde.value()'),/La conoscenza/,'un clic sul suggerimento corregge la parola');
  await c.val('NOTES.mde.codemirror.undo()');A.match(await c.val('NOTES.mde.value()'),/La conoscienza/);
  for(const chiusura of ['Escape','fuori','lingua']){
   await wait("!!document.querySelector('#noteHost .note-errore-ortografico')");
   const r=await c.val("document.querySelector('#noteHost .note-errore-ortografico').getBoundingClientRect().toJSON()");
   for(const type of ['mousePressed','mouseReleased'])await c.invia('Input.dispatchMouseEvent',{type,x:r.x+r.width/2,y:r.y+r.height/2,button:'right',clickCount:1});
   await wait("!!document.querySelector('.note-strumenti-menu:popover-open button')");
   if(chiusura==='Escape')for(const type of ['keyDown','keyUp'])await c.invia('Input.dispatchKeyEvent',{type,key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
   if(chiusura==='fuori')await c.clicca('#noteHost .CodeMirror-line');
   if(chiusura==='lingua'){await c.clicca('#noteHost .note-lingua');await c.clicca('.note-dizionari-menu [data-lingua=en]');}
   await wait("!document.querySelector('.note-strumenti-menu:popover-open')");
   A.match(await c.val('NOTES.mde.value()'),/La conoscienza/,'chiusura senza correzioni implicite');
  }
  A.deepEqual(errori,[]);
  console.log('✓ Font UI condiviso nelle due tendine; un clic destro apre il bubble sulla parola, scelta reale e Undo');
 }finally{
  await c.val(`document.querySelectorAll('.note-strumenti-menu:popover-open').forEach(e=>e.hidePopover());noteMolla();localStorage.clear();Object.entries(${q(prima)}).forEach(([k,v])=>localStorage.setItem(k,v));document.getElementById('aspettoFont').value=${q(fontPrima)};document.getElementById('aspettoFont').dispatchEvent(new Event('change'));window.dispatchEvent(new Event('zaino:ortografia'));`);
  if(file)require('../../lib/appunti').remove(vault,'biologia',file);await c.val('notesReload()');c.ws().close();
 }
})().catch(e=>{console.error(e);c.ws()?.close();process.exitCode=1;});
