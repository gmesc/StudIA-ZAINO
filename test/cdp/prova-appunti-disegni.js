'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{unzipSync,strFromU8}=require('fflate'),c=require('./cdp'),q=JSON.stringify;
async function wait(expr){for(let i=0;i<200;i++){if(await c.val(expr))return;await c.pausa(100);}throw Error('Attesa: '+expr+' '+JSON.stringify(await c.val(`({errore:document.querySelector('.note-disegno-dialog output')?.textContent,md:NOTES.mde?.value(),figure:[...document.querySelectorAll('#noteHost .note-visual')].map(e=>({testo:e.outerHTML.slice(0,400),parent:e.parentElement.className})),preview:NOTES.mde?.isPreviewActive()})`)));}
(async()=>{
 await c.collega();await wait(`typeof AppuntiFigureUI!=='undefined'&&zainoAttivo()==='biologia'`);const vault=await c.val('vault.path');A(vault.includes('studia-zaino-prova-'));await c.partiPulito();const prima=await c.val('({banco:bancoStato(),memoria:{...localStorage}})');let file;
 const marker=path.join(path.dirname(vault),'dati/dialogo-salvataggio.json');
 try{
  file=await c.val(`(()=>{const n=notesApi().save('biologia',null,{title:'Disegni modificabili'},'Testo prima.\\n\\nTesto che deve restare leggibile sotto la figura.');notesReload();bancoForma('uno');bancoAssegna('A','appunti');noteOpen(n.file,NOTES);return n.file;})()`);
  await wait('!!NOTES.mde&&!!NOTES.cur');await c.val(`(async()=>{await LavagnaUI.carica();window.__montaDisegno=LimEditor.monta;LimEditor.monta=(...args)=>{const r=__montaDisegno(...args);window.__disegnoAppunto=r;return r;};document.querySelector('#noteHost .ncb-disegno').click();})()`);
  await wait(`!!window.__disegnoAppunto?.api&&!document.querySelector('.note-disegno-dialog .tbar button:last-child').disabled`);
  await c.val(`__disegnoAppunto.api.setActiveTool({type:'rectangle'})`);
  const punto=await c.val(`(()=>{const r=document.querySelector('.note-disegno-tela').getBoundingClientRect();return {x:r.left+r.width*.35,y:r.top+r.height*.4};})()`);
  await c.invia('Input.dispatchMouseEvent',{type:'mousePressed',...punto,button:'left',buttons:1,clickCount:1});await c.invia('Input.dispatchMouseEvent',{type:'mouseMoved',x:punto.x+200,y:punto.y+100,button:'left',buttons:1});await c.invia('Input.dispatchMouseEvent',{type:'mouseReleased',x:punto.x+200,y:punto.y+100,button:'left',clickCount:1});await wait('__disegnoAppunto.api.getSceneElements().length===1');
  await c.val(`document.querySelector('.note-disegno-dialog .tbar button:last-child').click()`);await wait(`!document.querySelector('.note-disegno-dialog')`);
  const body=await c.val('NOTES.mde.value()'),id=/(_disegni\/[0-9a-f-]+\.png)/.exec(body)[1];A(body.includes('zaino-figura'));
  const origine=fs.readFileSync(path.join(vault,'Zaini/biologia/APPUNTI',id));A(origine.includes(Buffer.from('application/vnd.excalidraw+json')));
  await c.val(`if(!NOTES.mde.isPreviewActive())noteAlternaAnteprima(NOTES)`);await wait(`document.querySelector('#noteHost .note-visual img')?.naturalWidth>0`);
  await c.val(`document.querySelector('#noteHost .note-visual img').click()`);await wait(`!!document.querySelector('.note-figure-menu[open]')`);
  await c.val(`[...document.querySelectorAll('.note-figure-menu button')].find(b=>b.textContent==='Porta sotto').click()`);await wait(`!!document.querySelector('#noteHost .note-visual[data-layer=back]')`);
  await c.val(`document.querySelector('#noteHost .note-visual img').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))`);await wait(`!!document.querySelector('.note-disegno-dialog')&&__disegnoAppunto?.api?.getSceneElements().length===1`);
  await c.val(`(()=>{const api=__disegnoAppunto.api,nuovo=LimEditor.converti([{type:'arrow',x:100,y:100,width:120,height:80,points:[[0,0],[120,80]]}]);api.updateScene({elements:[...api.getSceneElements(),...nuovo],captureUpdate:LimEditor.CaptureUpdateAction.IMMEDIATELY});document.querySelector('.note-disegno-dialog .tbar button:last-child').click();})()`);await wait(`!document.querySelector('.note-disegno-dialog')`);
  A.notEqual(await c.val('NOTES.mde.value()'),body);A(fs.readFileSync(path.join(vault,'Zaini/biologia/APPUNTI',id)).equals(origine),'versione originale conservata per Undo');
  await c.val(`document.querySelector('#noteHost .note-visual img').click()`);await wait(`!!document.querySelector('.note-figure-menu')`);
  await c.val(`[...document.querySelectorAll('.note-figure-menu button')].find(b=>b.textContent==='Destra').click()`);
  await wait(`!!document.querySelector('#noteHost .note-visual[data-align=right]')`);
  await c.val(`document.querySelector('#noteHost .note-visual img').click();(()=>{const s=document.querySelector('.note-figure-menu input');s.value=45;s.dispatchEvent(new Event('change'));})()`);
  await wait(`NOTES.mde.value().includes('|45%')`);
  const dati=await c.val('documentoAppuntoDocx(NOTES)');A(JSON.stringify(dati).includes('"layer":"back"'));
  fs.writeFileSync(marker,JSON.stringify({filePath:'/private/tmp/zaino-disegni-prova.docx'}));A.equal(await c.val('salvaDocx(NOTES)'),'/private/tmp/zaino-disegni-prova.docx');
  const zip=unzipSync(fs.readFileSync('/private/tmp/zaino-disegni-prova.docx')),xml=strFromU8(zip['word/document.xml']);A(xml.includes('wp:anchor'));A(xml.includes('behindDoc="1"'));A(xml.includes('right'));A(Object.keys(zip).some(k=>k.startsWith('word/media/')));
  fs.writeFileSync(marker,JSON.stringify({filePath:'/private/tmp/zaino-disegni-prova.pdf'}));A.equal(await c.val(`salvaPdf('appunto',NOTES)`),'/private/tmp/zaino-disegni-prova.pdf');
  // Stessi controlli anche su una foto dell'album.
  await c.val(`(()=>{const cv=document.createElement('canvas');cv.width=160;cv.height=100;cv.getContext('2d').fillRect(0,0,160,100);const r=vault.album.salva('biologia',{origine:'foto',materiale:'Figura di prova.png',dati:cv.toDataURL('image/png')});if(r.error)throw Error(r.error);noteInserisci('![Foto](album:'+r.voce.id+')',NOTES);})()`);await wait(`document.querySelectorAll('#noteHost .note-visual').length===2`);
  await c.val(`document.querySelectorAll('#noteHost .note-visual img')[1].click()`);await c.val(`[...document.querySelectorAll('.note-figure-menu button')].find(b=>b.textContent==='Porta sopra').click()`);await wait(`!!document.querySelector('#noteHost .note-visual[data-layer=front]')`);
  console.log('✓ Disegno Excalidraw: mouse reale, PNG modificabile, riapertura, freccia aggiunta, allineamento/livelli, foto e PDF/DOCX');
 }finally{
  await c.val(`(()=>{document.querySelector('.note-disegno-dialog')?.close();AppuntiFigureUI.chiudi();if(window.__montaDisegno)LimEditor.monta=__montaDisegno;noteMolla();localStorage.clear();for(const[k,v]of Object.entries(${q(prima.memoria)}))localStorage.setItem(k,v);BANCO.stato=${q(prima.banco)};bancoDisegna();})()`);
  if(file)require('../../lib/appunti').remove(vault,'biologia',file);if(fs.existsSync(marker))fs.unlinkSync(marker);
 }
 c.ws().close();
})().catch(e=>{console.error(e);c.ws()?.close();process.exitCode=1;});
