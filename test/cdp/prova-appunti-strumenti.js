'use strict';
const A=require('node:assert/strict'),c=require('./cdp'),q=JSON.stringify;
async function wait(e){for(let i=0;i<180;i++){if(await c.val(e))return;await c.pausa(100);}throw Error('Attesa: '+e);}
(async()=>{
 await c.collega();await wait("typeof AppuntiStrumenti!=='undefined'&&zainoAttivo()==='biologia'");await c.partiPulito();
 const prima=await c.val('({...localStorage})'),vault=await c.val('vault.path');A(vault.includes('studia-zaino-prova-'));let file;
 try{
 file=await c.val(`(()=>{const n=notesApi().save('biologia',null,{title:'Strumenti editor'},'Una parola importante nel paragrafo.');notesReload();bancoForma('uno');bancoAssegna('A','appunti');noteOpen(n.file,NOTES);return n.file;})()`);
 await wait("!!document.querySelector('#noteHost .note-stile-testo')");
 await c.clicca('#noteHost .note-stile-testo');
 A.equal(await c.val("document.querySelectorAll('.note-stili-menu:popover-open [data-livello]').length"),7);
 await c.clicca('.note-stili-menu:popover-open [data-livello="0"]');
 for(let n=1;n<=6;n++){
  await c.val(`(()=>{document.querySelector('#noteHost .note-stile-testo').click();document.querySelector('.note-stili-menu:popover-open [data-livello="${n}"]').click();})()`);
  A.equal(await c.val("NOTES.mde.codemirror.getLine(0)"),'#'.repeat(n)+' Una parola importante nel paragrafo.');
 }
 await c.val("NOTES.mde.codemirror.undo()");A.match(await c.val('NOTES.mde.value()'),/^##### /);
 await c.clicca('#noteHost [aria-label="Sommario dell’appunto"]');await wait("!!document.querySelector('.note-strumenti-menu button')");await c.clicca('.note-strumenti-menu button');
 A.equal(await c.val('NOTES.mde.codemirror.getCursor().line'),0);
 await c.val(`(()=>{const cm=NOTES.mde.codemirror;cm.setValue(${q('Prima.\n\nSeconda frase **importante** da correggere.')});})()`);
 await c.clicca('#noteHost [data-note-vista=a4]');await wait("!!document.querySelector('#noteHost .note-a4-paper strong')&&document.querySelector('#noteHost .note-a4').getAttribute('aria-busy')!=='true'");
 const punto=await c.val("(()=>{const r=document.querySelector('#noteHost .note-a4-paper strong').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()");
 for(const type of ['mousePressed','mouseReleased'])await c.invia('Input.dispatchMouseEvent',{type,...punto,button:'left',clickCount:2});
 A.equal(await c.val('AppuntiA4.attiva(NOTES)'),false);const cursor=await c.val('NOTES.mde.codemirror.getCursor()');A.equal(cursor.line,2);A(cursor.ch>10,'cursore nella parola, oltre inizio paragrafo');
 await c.val(`(()=>{const cm=NOTES.mde.codemirror;cm.setValue('');const dt=new DataTransfer();dt.setData('text/html','<h2>Titolo</h2><p>Un <strong>testo</strong> con <a href="https://example.org">fonte</a>.</p><script>alert(1)</script>');cm.getInputField().dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:dt}));})()`);
 const md=await c.val('NOTES.mde.value()');A.match(md,/## Titolo/);A.match(md,/\*\*testo\*\*/);A.match(md,/\[fonte\]\(https:\/\/example.org\)/);A(!md.includes('alert'));
 await c.val("NOTES.mde.codemirror.setValue('La conoscienza offre conoscenza.')");await c.clicca('#noteHost .note-lingua');await c.clicca('.note-dizionari-menu [data-lingua=it]');
 await wait("!!document.querySelector('#noteHost .note-errore-ortografico')");A.equal(await c.val("document.querySelector('#noteHost .note-errore-ortografico').textContent"),'conoscienza');
 const r=await c.val("document.querySelector('#noteHost .note-errore-ortografico').getBoundingClientRect().toJSON()");
 for(const type of ['mousePressed','mouseReleased'])await c.invia('Input.dispatchMouseEvent',{type,x:r.x+r.width/2,y:r.y+r.height/2,button:'right',clickCount:1});
 await wait("[...document.querySelectorAll('.note-strumenti-menu button')].some(b=>b.textContent==='conoscenza')");
 await c.val("[...document.querySelectorAll('.note-strumenti-menu button')].find(b=>b.textContent==='conoscenza').click()");A.match(await c.val('NOTES.mde.value()'),/La conoscenza/);
 await c.val("NOTES.mde.codemirror.undo()");A.match(await c.val('NOTES.mde.value()'),/conoscienza/);
 // I comandi di stile conservano caratteri letterali e ignorano il codice.
 await c.val(`(()=>{const cm=NOTES.mde.codemirror;cm.setValue(${q('C# #\n\n```js\nconst x = 1;\n```')});cm.setSelection({line:0,ch:0},{line:4,ch:3});document.querySelector('#noteHost .note-stile-testo').click();document.querySelector('.note-stili-menu:popover-open [data-livello="3"]').click();})()`);
 A.match(await c.val('NOTES.mde.value()'),/^### C# #/);
 A.match(await c.val('NOTES.mde.value()'),/```js\nconst x = 1;\n```/);
 await c.val(`(()=>{const cm=NOTES.mde.codemirror;cm.setValue(${q('Titolo storico\n==============')});cm.setCursor(0,0);document.querySelector('#noteHost .note-stile-testo').click();document.querySelector('.note-stili-menu:popover-open [data-livello="2"]').click();})()`);
 A.equal(await c.val('NOTES.mde.value()'),'## Titolo storico');
 await c.val('NOTES.mde.codemirror.undo()');A.equal(await c.val('NOTES.mde.value()'),'Titolo storico\n==============');
 console.log('✓ Titoli H1–H6, sommario, cursore A4, incolla strutturato, dizionario locale, suggerimenti e Undo');
 }finally{await c.val(`noteMolla();localStorage.clear();Object.entries(${q(prima)}).forEach(([k,v])=>localStorage.setItem(k,v));window.dispatchEvent(new Event('zaino:ortografia'));`);if(file)require('../../lib/appunti').remove(vault,'biologia',file);await c.val('notesReload()');c.ws().close();}
})().catch(e=>{console.error(e);c.ws()?.close();process.exitCode=1;});
