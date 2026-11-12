'use strict';
const A=require('node:assert/strict'),c=require('./cdp'),q=JSON.stringify;
async function wait(e){for(let i=0;i<100;i++){if(await c.val(e))return;await c.pausa(100);}throw Error('Attesa: '+e);}
async function mouse(p,button='left',clickCount=1){for(const type of ['mousePressed','mouseReleased'])await c.invia('Input.dispatchMouseEvent',{type,...p,button,clickCount});}
async function trascina(origine,destinazione){
 const pos=await c.val(`(()=>{const a=document.querySelector(${q(origine)}).getBoundingClientRect(),b=document.querySelector(${q(destinazione)}).getBoundingClientRect();return {x:a.x+a.width/2,y:a.y+a.height/2,dx:b.x+b.width/2,dy:b.y+b.height/2};})()`);
 let data;const ascolta=raw=>{const m=JSON.parse(raw);if(m.method==='Input.dragIntercepted')data=m.params.data;};c.ws().on('message',ascolta);await c.invia('Input.setInterceptDrags',{enabled:true});
 try{
  await c.invia('Input.dispatchMouseEvent',{type:'mouseMoved',x:pos.x,y:pos.y});await c.invia('Input.dispatchMouseEvent',{type:'mousePressed',x:pos.x,y:pos.y,button:'left',buttons:1,clickCount:1});
  for(let i=1;i<=8&&!data;i++){await c.invia('Input.dispatchMouseEvent',{type:'mouseMoved',x:pos.x+(pos.dx-pos.x)*i/8,y:pos.y+(pos.dy-pos.y)*i/8,button:'left',buttons:1});await c.pausa(40);}
  for(let i=0;i<20&&!data;i++)await c.pausa(50);A(data,'trascinamento nativo avviato');
  for(const type of ['dragEnter','dragOver','drop'])await c.invia('Input.dispatchDragEvent',{type,x:pos.dx,y:pos.dy,data});
 }finally{await c.invia('Input.dispatchMouseEvent',{type:'mouseReleased',x:pos.dx,y:pos.dy,button:'left',buttons:0,clickCount:1});await c.invia('Input.setInterceptDrags',{enabled:false});c.ws().off('message',ascolta);}
}
async function punto(line,ch){return c.val(`(()=>{const r=NOTES.mde.codemirror.charCoords({line:${line},ch:${ch}},'window');return {x:r.left+2,y:(r.top+r.bottom)/2};})()`);}
(async()=>{
 await c.collega();await wait("typeof EvidenzeAppunti!=='undefined'&&zainoAttivo()==='biologia'");await c.partiPulito();
 const vault=await c.val('vault.path');A(vault.includes('studia-zaino-prova-'));
 const prima=await c.val('({...localStorage})'),precedenti=await c.val('evidenzeApi().leggi(corsoAttivo()).evidenze');let file,destinazione,mappa;
 try{
  file=await c.val(`(()=>{const n=notesApi().save('biologia',null,{title:'Keyword appunti'},${q('I mitocondri producono energia.\n\nLa conoscienza aiuta.\n\nQuattro termini distinti importanti.')});notesReload();bancoForma('uno');bancoAssegna('A','appunti');noteOpen(n.file,NOTES);AppuntiA4.scegli(NOTES,'scrittura');return n.file;})()`);
  await c.pausa(300);
  // Doppio clic reale e poi destro: prima della selezione il menu non compare.
  const p=await punto(0,5);await mouse(p);await mouse(p,'left',2);
  A.equal(await c.val('NOTES.mde.codemirror.getSelection()'),'mitocondri');
  A.equal(await c.val('selMenuAperto()'),false);
  await mouse(p,'right');await wait('selMenuAperto()');
  require('node:fs').writeFileSync('/private/tmp/zaino-appunti-keyword-menu.png',Buffer.from((await c.invia('Page.captureScreenshot',{format:'png'})).result.data,'base64'));
  A.deepEqual(await c.val("[...document.querySelectorAll('#selMenu [data-az]')].filter(b=>!b.disabled).map(b=>b.dataset.az)"),['appunta','mappa','keyword','postilla','interrogami','copia']);
  await c.clicca('#selMenu [data-az="keyword"]');
  await wait(`EVIDENZE.elenco.some(e=>e.appunto===${q(file)}&&e.exact==='mitocondri')`);
  A(await c.val("!!document.querySelector('#noteHost .note-evidenza')"));
  // Selezione esplicita anche su errore: precede i suggerimenti ortografici.
  await c.clicca('#noteHost .note-lingua');await c.clicca('.note-dizionari-menu [data-lingua=it]');
  await wait("!!document.querySelector('#noteHost .note-errore-ortografico')");
  const err=await punto(2,6);await mouse(err);await mouse(err,'left',2);await mouse(err,'right');await wait('selMenuAperto()');
  A.equal(await c.val("!!document.querySelector('.note-strumenti-menu:popover-open')"),false);
  await c.val('selMenuChiudi();NOTES.mde.codemirror.setCursor({line:2,ch:0})');
  await mouse(err,'right');await wait("!!document.querySelector('.note-strumenti-menu:popover-open button')");
  A.equal(await c.val('selMenuAperto()'),false);
  await c.val("document.querySelector('.note-strumenti-menu:popover-open').hidePopover()");
  // Frase trascinata: si conserva evidenziata, ma oltre tre parole non entra nei chip.
  const start=await punto(4,0),end=await punto(4,34);
  await c.invia('Input.dispatchMouseEvent',{type:'mousePressed',...start,button:'left',clickCount:1});
  await c.invia('Input.dispatchMouseEvent',{type:'mouseMoved',...end,button:'left',buttons:1});
  await c.invia('Input.dispatchMouseEvent',{type:'mouseReleased',...end,button:'left',clickCount:1});
  await mouse(await punto(4,8),'right');await wait('selMenuAperto()');await c.clicca('#selMenu [data-az="keyword"]');
  A.equal(await c.val(`EVIDENZE.elenco.filter(e=>e.appunto===${q(file)}).length`),2);
  A.equal(await c.val(`EVIDENZE.elenco.filter(e=>e.appunto===${q(file)}).filter(kwEParolaChiave).length`),1);
  await c.val("evidenzeApi().aggiungi(corsoAttivo(),{materiale:'01 Botanica.pdf',pagina:1,exact:'botanica'});evidenzeCarica();bancoForma('due');bancoMostra('keyword');keywordDisegna()");
  await c.clicca('[data-kw-origine="appunti"]');
  A.deepEqual(await c.val("[...document.querySelectorAll('.kwchip')].map(b=>kwDaId(b.dataset.kw).appunto)"),[file]);
  await c.clicca('[data-kw-origine="fonti"]');
  A(await c.val("[...document.querySelectorAll('.kwchip')].every(b=>!kwDaId(b.dataset.kw).appunto)"));
  await c.clicca('[data-kw-origine="appunti"]');
  await c.invia('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1});await c.pausa(250);
  A(await c.val(`(()=>{const a=document.querySelector('.albumTabs [aria-pressed="true"]'),b=document.querySelector('[data-kw-origine="appunti"]');return ['fontFamily','fontSize','color','backgroundColor','height'].every(k=>getComputedStyle(a)[k]===getComputedStyle(b)[k]);})()`),'Filtri con gli stessi token di ALBUM');
  await c.pausa(250);A.equal(await c.val("getComputedStyle(document.querySelector('[data-kw-origine=appunti]')).backgroundColor"),'rgb(229, 231, 235)','Filtro selezionato grigio fuori dal mouse');
  const id=await c.val(`EVIDENZE.elenco.find(e=>e.appunto===${q(file)}&&e.exact==='mitocondri').id`);
  destinazione=await c.val(`(()=>{const n=notesApi().save('biologia',null,{title:'Destinazione keyword'},'Appunto di destinazione.');notesReload();noteOpen(n.file,NOTES);return n.file;})()`);
  await c.pausa(150);await trascina('[data-kw="'+id+'"]','#noteHost .CodeMirror');
  await wait(`NOTES.mde.value().includes('ev:${id}')`);A.equal(await c.val('noteFlush()'),true);
  A((await c.val(`notesApi().leggi(corsoAttivo()).notes.find(n=>n.file===${q(destinazione)}).body`)).includes(`[==mitocondri==](ev:${id})`));
  mappa=await c.val(`(async()=>{const r=await mappeApi().salva(corsoAttivo(),null,{titolo:'Prova keyword',nodi:[],archi:[]});bancoMostra('mappa');await mappaApriMia(r.file);bancoMostra('keyword');return r.file;})()`);
  await c.pausa(150);await trascina('[data-kw="'+id+'"]','#mappaSvg');
  await wait(`MAPPA.mia.grafo.nodi.some(n=>n.rimando?.file==='${id}')`);
  A.equal(await c.val(`MAPPA.mia.grafo.nodi.find(n=>n.rimando?.file==='${id}').rimando.type`),'evidenza');
  await c.val('mappaFlush()');
  await c.val(`openNote({type:'evidenza',file:'${id}'})`);await c.pausa(120);
  A.equal(await c.val('NOTES.mde.codemirror.getSelection()'),'mitocondri');
  A.equal(await c.val(`evidenzeApi().leggi(corsoAttivo()).evidenze.find(e=>e.id==='${id}').appunto`),file);
  await c.val("bancoMostra('appunti');NOTES.mde.togglePreview()");await c.pausa(100);
  const lettura=await c.val(`(()=>{const pv=document.querySelector('#noteHost .editor-preview-active'),w=document.createTreeWalker(pv,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){const i=n.textContent.indexOf('mitocondri');if(i<0)continue;const r=document.createRange();r.setStart(n,i);r.setEnd(n,i+10);getSelection().removeAllRanges();getSelection().addRange(r);const b=r.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2};}})()`);
  A(lettura);await mouse(lettura,'right');await wait('selMenuAperto()');
  A.equal(await c.val("document.querySelector('#selMenu [data-az=keyword]').textContent"),'Ricolora la parola chiave');
  await c.clicca('#selMenu .ctx-col');
  A.equal(await c.val(`EVIDENZE.elenco.filter(e=>e.appunto===${q(file)}&&e.exact==='mitocondri').length`),1,'Lettura e Scrittura condividono la stessa evidenza');
  A.equal(await c.val(`EVIDENZE.elenco.find(e=>e.id==='${id}').exact`),'mitocondri');
  A(await c.val("[...CSS.highlights.values()].some(h=>[...h].some(r=>r.startContainer.isConnected&&r.toString()==='mitocondri'))"),'Evidenza visibile in lettura dopo il ridisegno');
  await c.val('NOTES.mde.togglePreview()');
  console.log('✓ Selezione + destro, precedenza sul correttore, tre parole, filtri origine, trasporto e ritorno alla nota');
 }finally{
  await c.val(`selMenuChiudi();document.querySelectorAll('.note-strumenti-menu:popover-open').forEach(e=>e.hidePopover());noteMolla();localStorage.clear();Object.entries(${q(prima)}).forEach(([k,v])=>localStorage.setItem(k,v));window.dispatchEvent(new Event('zaino:ortografia'));KW.origini={fonti:true,appunti:true}`);
  require('../../lib/evidenze').salva(vault,'biologia',precedenti);if(file)require('../../lib/appunti').remove(vault,'biologia',file);if(destinazione)require('../../lib/appunti').remove(vault,'biologia',destinazione);
  if(mappa){await c.val('mappaFlush();MAPPA.mia.file="";MAPPA.mia.grafo=null');require('../../lib/mappe').rimuovi(vault,'biologia',mappa);}
  await c.val('notesReload();evidenzeCarica();evidenzeDisegna()');c.ws().close();
 }
})().catch(e=>{console.error(e);c.ws()?.close();process.exitCode=1;});
