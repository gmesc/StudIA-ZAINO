'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{unzipSync,strFromU8}=require('fflate'),c=require('./cdp'),q=JSON.stringify;
async function wait(s){for(let i=0;i<160;i++){if(await c.val(s))return;await c.pausa(80);}throw Error('Attesa: '+s);}
async function click(nome){const s=(nome==='Copia oggetto'?'.presenta-bubble':'#presentaPane')+' [aria-label='+q(nome)+']';await wait(`!!document.querySelector(${q(s)})&&!document.querySelector(${q(s)}).disabled`);await c.val(`document.querySelector(${q(s)}).scrollIntoView({block:'center'})`);await c.clicca(s);await c.val('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');}
(async()=>{
 await c.collega();await wait(`typeof AppuntiTabelleUI!=='undefined'&&zainoAttivo()==='biologia'`);const vault=await c.val('window.vault.path');A(vault.includes('studia-zaino-prova-'));await c.partiPulito();
 const prima=await c.val(`({banco:bancoStato(),memoria:{...localStorage}})`),marker=path.join(path.dirname(vault),'dati/dialogo-salvataggio.json');let file,doc;
 try{
  file=await c.val(`(()=>{const r=notesApi().save(corsoAttivo(),null,{title:'Tabelle di prova'},'Prima della tabella.');notesReload();bancoForma('uno');bancoAssegna('A','appunti');noteOpen(r.file,NOTES);return r.file;})()`);
  await wait('!!NOTES.cur&&!!NOTES.mde');
  await c.val(`document.querySelector('#noteHost .ncb-tabella').click()`);await wait(`!!document.querySelector('.note-tabella-dialog[open]')`);
  await c.val(`(()=>{const x=document.querySelector('.note-tabella-celle textarea');x.value='Intestazione modificata';x.dispatchEvent(new Event('input'));[...document.querySelectorAll('.note-tabella-dialog button')].find(x=>x.textContent==='Applica').click();})()`);
  A((await c.val('NOTES.mde.value()')).includes('Intestazione modificata'));
  await c.val(`if(!NOTES.mde.isPreviewActive())noteAlternaAnteprima(NOTES)`);await wait(`!!document.querySelector('#noteHost .note-tabella')`);
  await c.val(`document.querySelector('#noteHost .note-tabella td').click()`);await wait(`!!document.querySelector('.note-tabella-dialog[open]')`);
  await c.val(`[...document.querySelectorAll('.note-tabella-dialog button')].find(x=>x.textContent==='+ Riga').click();[...document.querySelectorAll('.note-tabella-dialog button')].find(x=>x.textContent==='Applica').click()`);
  await wait(`document.querySelectorAll('#noteHost .note-tabella tr').length===4`);
  await c.val(`bancoAssegna('A','presenta')`);await wait(`!!document.querySelector('#presentaPane [aria-label=Documento]')`);await click('Documento');await click('Nuova presentazione');await wait(`document.querySelector('#uiModal[open]')`);await c.val(`document.getElementById('umInput').value='Tabella da copiare';document.getElementById('umOk').click()`);await wait('!!ZainoPresenta.documento');doc=await c.val('ZainoPresenta.documento.id');
  await click('Inserisci');await click('Aggiungi tabella');await c.clicca('.presenta-tabella-dialog [aria-label="Applica tabella"]');
  await c.val(`(()=>{const d=ZainoPresenta.documento,s=d.stacks[0].slides[0],b=s.blocks.find(b=>b.type==='table');ZainoPresenta.modifica({tipo:'blocco',slideId:s.id,blockId:b.id,block:{...b,table:[['Corpo','Valore'],['**Terra**','12']],style:{...b.style,color:'#123456',fontFamily:'georgia',fontSize:24,align:'center',italic:true}}});window.__tabClip=navigator.clipboard;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async t=>{window.__tabCopia=t;}}});})()`);
  await wait(`!document.querySelector('#presentaPane [aria-label="Comandi dell’oggetto"]').disabled`);await c.val(`document.querySelector('#presentaPane [aria-label="Comandi dell’oggetto"]').focus()`);await c.invia('Input.dispatchKeyEvent',{type:'keyDown',key:'c',code:'KeyC',modifiers:4,windowsVirtualKeyCode:67});await c.invia('Input.dispatchKeyEvent',{type:'keyUp',key:'c',code:'KeyC',modifiers:4,windowsVirtualKeyCode:67});await wait('!!window.__tabCopia');
  const copied=await c.val('AppuntiTabelle.leggi(window.__tabCopia.split("\\n")).tabella');A.equal(copied.style.color,'#123456');A.equal(copied.style.font,'Georgia,"Times New Roman",serif');A.equal(copied.style.size,24);
  await c.val(`bancoAssegna('A','appunti');(()=>{const d=new DataTransfer();d.setData('text/plain',window.__tabCopia);document.querySelector('#noteHost .editor-preview').dispatchEvent(new ClipboardEvent('paste',{clipboardData:d,bubbles:true,cancelable:true}));})()`);
  await wait(`document.querySelectorAll('#noteHost .note-tabella').length===2`);
  A.equal(await c.val(`getComputedStyle(document.querySelectorAll('#noteHost .note-tabella')[1].querySelector('td')).textAlign`),'center');
  const exporte=await c.val('documentoAppuntoDocx(NOTES)');A(JSON.stringify(exporte).includes('123456'));
  const dest='/private/tmp/zaino-tabelle-prova.docx';fs.writeFileSync(marker,JSON.stringify({filePath:dest}));A.equal(await c.val('salvaDocx(NOTES)'),dest);
  const zip=unzipSync(fs.readFileSync(dest)),xml=strFromU8(zip['word/document.xml']);A(xml.includes('123456'));A(xml.includes('Georgia'));A(xml.includes('w:val="center"'));A(xml.includes('Terra'));A(xml.includes('<w:tbl>'));A(xml.includes('w:val="36"'),'dimensione 24px → 18pt');
  fs.writeFileSync(marker,JSON.stringify({filePath:'/private/tmp/zaino-tabelle-prova.pdf'}));A.equal(await c.val(`salvaPdf('appunto',NOTES)`),'/private/tmp/zaino-tabelle-prova.pdf');
  const raw=await c.val('NOTES.mde.value()');await c.val('noteSave(false,NOTES)');await wait('!NOTES.dirty');await c.val(`noteOpen(${q(file)},NOTES)`);await wait(`NOTES.mde.value().trim()===${q(raw.trim())}`);
  console.log('✓ Tabelle: crea/modifica in anteprima, righe, copia PRESENTA con stile, incolla, riapertura e PDF/DOCX reali');
 }finally{
  await c.val(`(()=>{if(window.__tabClip)Object.defineProperty(navigator,'clipboard',{configurable:true,value:window.__tabClip});document.querySelector('.note-tabella-dialog')?.close();noteMolla();localStorage.clear();for(const [k,v]of Object.entries(${q(prima.memoria)}))localStorage.setItem(k,v);BANCO.stato=${q(prima.banco)};bancoDisegna();})()`);
  if(doc){await c.val('ZainoPresenta.chiudi()');await c.val(`vault.presentazioni.comando({azione:'elimina',corso:'biologia',id:${q(doc)}})`);}
  if(file)require('../../lib/appunti').remove(vault,'biologia',file);
  if(fs.existsSync(marker))fs.unlinkSync(marker);
 }
 c.ws().close();
})().catch(e=>{console.error(e);c.ws()?.close();process.exitCode=1;});
