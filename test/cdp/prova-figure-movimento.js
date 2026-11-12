'use strict';
const A=require('node:assert/strict'),c=require('./cdp');
async function wait(e){for(let i=0;i<180;i++){if(await c.val(e))return;await c.pausa(80);}throw Error('Attesa: '+e);}
async function mouse(type,x,y){await c.invia('Input.dispatchMouseEvent',{type,x,y,button:'left',buttons:type==='mouseReleased'?0:1,clickCount:1});}
(async()=>{await c.collega();await wait("typeof AppuntiFigureUI!=='undefined'&&zainoAttivo()==='biologia'");A((await c.val('vault.path')).includes('studia-zaino-prova-'));await c.partiPulito();
 await c.val(`(()=>{const n=notesApi().save('biologia',null,{title:'Movimento figura'},'Titolo\\n\\nTesto prima.\\n\\nTesto dopo.\\n\\nAltro paragrafo.');notesReload();bancoForma('uno');bancoAssegna('A','appunti');noteOpen(n.file,NOTES);})()`);await wait('!!NOTES.mde&&!!NOTES.cur');
 await c.val('NOTES.mde.codemirror.setCursor({line:2,ch:0});AppuntiFigureUI.annota(NOTES)');await wait("!!document.querySelector('.note-annota-foglio svg')");await c.clicca('.note-annota-bar [data-tool=freccia]');
 const p=await c.val("(()=>{const r=document.querySelector('.note-annota-foglio svg').getBoundingClientRect();return {x:r.left+r.width*.3,y:r.top+r.height*.3,dx:r.width*.3,dy:r.height*.2};})()");await mouse('mousePressed',p.x,p.y);await mouse('mouseMoved',p.x+p.dx,p.y+p.dy);await mouse('mouseReleased',p.x+p.dx,p.y+p.dy);await c.clicca('[data-applica-disegno]');await wait("!document.querySelector('.note-annota')");await c.val('if(!NOTES.mde.isPreviewActive())noteAlternaAnteprima(NOTES)');await wait("document.querySelector('#noteHost .note-visual img')?.naturalWidth>0");
 await c.val(`document.querySelector('#noteHost .note-visual img').click();AppuntiFigureUI.posiziona(document.querySelector('#noteHost .note-visual img'))`);
 const before=await c.val("document.querySelector('#noteHost .note-visual img').getBoundingClientRect().toJSON()"),h=await c.val("document.querySelector('.note-figure-posizione').getBoundingClientRect().toJSON()");
 await mouse('mousePressed',h.x+h.width/2,h.y+h.height/2);await mouse('mouseMoved',h.x+h.width/2+35,h.y+h.height/2+30);
 const during=await c.val("({img:document.querySelector('#noteHost .note-visual img').getBoundingClientRect().toJSON(),handle:document.querySelector('.note-figure-posizione').getBoundingClientRect().toJSON()})");
 await mouse('mouseReleased',h.x+h.width/2+35,h.y+h.height/2+30);
 A(Math.abs(during.img.x-before.x-35)<2,'Anche una tela larga al 100% si sposta se il tratto lascia margine');
 A(Math.abs((during.img.x-before.x)-(during.handle.x-h.x))<2,'Il disegno deve seguire la maniglia durante il trascinamento: '+JSON.stringify({before,h,during}));
 A(Math.abs((during.img.y-before.y)-(during.handle.y-h.y))<2,'Il disegno segue verticalmente la maniglia');// Il pannello sopra una figura alta resta cliccabile; chiusura con X, Esc e click fuori.
 await c.pausa(100);await c.val(`document.querySelector('#noteHost .note-visual img').click()`);
 await wait("!!document.querySelector('.note-figure-menu')");A(await c.val("[...document.querySelectorAll('.note-figure-menu [data-allineamento]')].every(b=>!!b.querySelector('svg')&&!b.textContent.trim())"));
 await c.clicca('.note-figure-head button');A.equal(await c.val("document.querySelectorAll('.note-figure-menu').length"),0);
 await c.val(`document.querySelector('#noteHost .note-visual img').click()`);
 await c.invia('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});A.equal(await c.val("document.querySelectorAll('.note-figure-menu,.note-figure-posizione').length"),0);
 await c.val(`document.querySelector('#noteHost .note-visual img').click()`);await c.clicca('.topbar');A.equal(await c.val("document.querySelectorAll('.note-figure-menu').length"),0);
 console.log('✓ disegno e selezione seguono il mouse; icone, X, Esc e click fuori');c.ws().close();
})().catch(e=>{console.error(e);c.ws()?.close();process.exitCode=1;});
