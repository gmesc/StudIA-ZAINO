'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),c=require('./cdp');
async function aspetta(expr){for(let i=0;i<150;i++){if(await c.val(expr))return;await c.pausa(100);}throw Error('Attesa: '+expr);}
const click=sel=>c.val(`document.querySelector(${JSON.stringify(sel)}).click()`);
(async()=>{
 await c.collega();await aspetta(`typeof zainoAttivo==='function' && zainoAttivo()==='biologia' && !!window.vault.chat`);
 const v=await c.val('window.vault.path');assert(v.includes('studia-zaino-prova-'));
 await c.val(`window.vault.chat.setKey({provider:'openai',value:'chiave-finta-della-prova'})`);
 await c.val(`window.vault.chat.saveSettings({provider:'openai',model:'modello-locale-di-prova'})`);
 await c.val('location.reload()');await c.pausa(800);await c.collega();await aspetta(`!!document.getElementById('chatBtn')`);
 await click('#chatBtn');await aspetta(`!document.getElementById('zchatInput').disabled`);
 await click('#zchatScopeAll');await aspetta(`!document.getElementById('zchatScopeAll').disabled`);
 const sources=(await c.val(`window.vault.chat.sources('biologia')`)).sources;
 const pdf=sources.find(s=>s.file.endsWith('/01 Botanica.pdf'));assert(pdf);
 await click(`[data-source-id="${pdf.id}"]`);await aspetta(`!document.getElementById('zchatScopeAll').disabled`);
 await c.val(`document.getElementById('zchatInput').value='Prova citazione botanica';document.getElementById('zchatInput').dispatchEvent(new Event('input',{bubbles:true}))`);await click('#zchatSend');
 await aspetta(`document.querySelectorAll('.zchat-message-assistant').length===1`);
 const session=(await c.val(`window.vault.chat.list('biologia')`)).sessions[0];
 const saved=(await c.val(`window.vault.chat.read('biologia',${JSON.stringify(session.id)})`)).session;
 assert.deepEqual(saved.scope.sourceIds,[pdf.id]);
 assert(saved.messages.at(-1).context.sources.every(s=>s.sourceId===pdf.id));
 assert.equal(await c.val(`document.querySelectorAll('.zchat-message-text .zchat-citation').length`),1);
 await click('.zchat-message-text .zchat-citation');await aspetta(`ANTEPRIMA.file==='01 Botanica.pdf' && !!PDFJS.doc`);
 // Il salvataggio passa dal pulsante reale e conserva la bozza ancora nell'editor.
 await click('.zn-appunto');await aspetta(`!!noteStatoAttivo().mde && !!noteStatoAttivo().cur`);
 const f=await c.val('noteStatoAttivo().cur.file');
 await c.val(`noteStatoAttivo().mde.codemirror.replaceRange('\\nLa mia bozza fresca.',{line:0,ch:0})`);
 await click('.zchat-note');await click('.zchat-note-target button');
 await aspetta(`document.getElementById('zchatStatus').textContent==='Risposta conservata negli appunti.'`);
 const text=fs.readFileSync(path.join(v,'Zaini','biologia','APPUNTI',f),'utf8');
 assert(text.includes('La mia bozza fresca.'));assert(text.includes('&s='+pdf.id));
 assert((await c.val('noteStatoAttivo().mde.value()')).includes('Il passaggio citato'));
 await click('.zchat-note');await click('.zchat-note-target button');
 assert.equal(fs.readFileSync(path.join(v,'Zaini','biologia','APPUNTI',f),'utf8'),text);
 // Una modifica esterna non viene cancellata dal flush dell'editor prima dell'append.
 const notePath=path.join(v,'Zaini','biologia','APPUNTI',f);
 fs.appendFileSync(notePath,'\nModifica esterna da preservare.');const external=fs.readFileSync(notePath,'utf8');
 await click('.zchat-note');await click('.zchat-note-target button');await aspetta(`document.getElementById('zchatStatus').textContent.startsWith('Appunto cambiato sul disco')`);
 assert.equal(fs.readFileSync(notePath,'utf8'),external);
 fs.appendFileSync(path.join(v,'Zaini','biologia',pdf.file),'\n');
 await click('.zchat-message-text .zchat-citation');await aspetta(`document.getElementById('zchatStatus').textContent.startsWith('Fonte aggiornata')`);
 await c.val(`document.getElementById('zchatWindow').hidden=true`);
 console.log('chat-fonti UI: selezione effettiva, alias, PDF, bozza preservata e doppio inserimento OK');
process.exit(0);
})().catch(async e=>{console.error(e);try{console.error(await c.val('document.getElementById("zchatStatus").textContent'));}catch(_){}process.exit(1);});
