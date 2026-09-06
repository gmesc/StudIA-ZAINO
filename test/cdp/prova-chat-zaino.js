'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const c=require('./cdp');
async function aspetta(expr){const end=Date.now()+10000;while(Date.now()<end){if(await c.val(expr))return;await c.pausa(100);}throw new Error('Attesa scaduta: '+expr);}
async function click(sel){await c.val(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({block:'center'})`);await c.pausa(80);return c.clicca(sel);}
async function testo(id, value){await c.val(`(()=>{const el=document.getElementById(${JSON.stringify(id)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`);}
async function scegli(id,value){await c.val(`(()=>{const el=document.getElementById(${JSON.stringify(id)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);}
(async()=>{
 await c.collega();await aspetta(`!!document.getElementById('chatBtn') && zainoAttivo()==='biologia'`);
 assert.equal(await c.val('typeof EasyMDE'),'function');
 await click('.zn-appunto');await aspetta(`!!NOTES.mde && !!NOTES.cur`);
 const vault=await c.val('window.vault.path');assert(vault.includes('studia-zaino-prova-'));
 assert.equal(await c.val('modoAttivo()'),'zaino');await c.val(`cambiaModo('corso')`);assert.equal(await c.val('modoAttivo()'),'zaino');
 assert.deepEqual(await c.val('window.vault.course.list()'),[]);
 assert.equal((await c.val(`window.vault.course.create('Non deve esistere')`)).ok,false);
 assert.equal((await c.val(`window.vault.notes.save('corso-nascosto',null,{title:'Vietato'},'No')`)).ok,false);
 await click('#settingsBtn');await click('[data-tab="utente"]');
 assert.equal(await c.val(`!!document.getElementById('voceBox').closest('.zchat-legacy')`),false);
 await aspetta(`document.getElementById('zchatProfileEdit').options.length===3`);
 await click('#zchatProfileClone');await aspetta(`document.getElementById('zchatProfileEdit').options.length===4`);
 await testo('zchatProfileName','Profilo di prova');await click('#zchatProfileForm button[type=submit]');
 await aspetta(`document.getElementById('zchatProfileStatus').textContent.includes('salvat')`);
 assert((await c.val('window.vault.chat.profiles()')).profiles.some(p=>p.nome==='Profilo di prova'));
 await click('[data-tab="ai"]');await scegli('zchatSettingsProvider','openai');
 await testo('zchatKeyInput','chiave-finta-della-prova');await click('#zchatKeySave');
 await aspetta(`document.getElementById('zchatSettingsModel').options.length>1`);
 await scegli('zchatSettingsModel','modello-locale-di-prova');await c.pausa(150);
 assert.equal((await c.val('window.vault.chat.settings()')).model,'modello-locale-di-prova');
 await click('#settingsClose');await click('#chatBtn');
 await testo('zchatInput','Che cosa è la fotosintesi?');await click('#zchatSend');
 await aspetta(`document.querySelectorAll('.zchat-message-assistant').length===1`);
 assert((await c.val(`document.getElementById('zchatMessages').textContent`)).includes('luce solare'));
 let sessions=await c.val(`window.vault.chat.list('biologia')`);assert.equal(sessions.sessions.length,1);
 const id=sessions.sessions[0].id;assert(fs.existsSync(path.join(vault,'Zaini','biologia','CHAT',id+'.md')));
 const nota=path.join(vault,'Zaini','biologia','APPUNTI');const file=fs.readdirSync(nota).find(n=>!n.startsWith('_')&&n.endsWith('.md'));
 fs.appendFileSync(path.join(nota,file),'\nLa clorofilla assorbe energia luminosa.\n');
 await testo('zchatInput','Cosa fa la clorofilla?');await click('#zchatSend');
 await aspetta(`document.querySelectorAll('.zchat-message-assistant').length===2`);
 assert((await c.val(`document.getElementById('zchatMessages').textContent`)).includes('assorbe energia luminosa'));
 await testo('zchatInput','Risposta lenta per cambio zaino');await click('#zchatSend');
 await aspetta(`!document.getElementById('zchatStop').hidden`);
 await scegli('zainoSelect','storia');await aspetta(`zainoAttivo()==='storia' && document.getElementById('zchatZaino').textContent.includes('Storia')`);
 assert.equal((await c.val(`window.vault.chat.list('storia')`)).sessions.length,0);
 assert(!(await c.val(`document.getElementById('zchatMessages').textContent`)).includes('luce solare'));
 await c.pausa(250);await scegli('zainoSelect','biologia');await aspetta(`document.querySelectorAll('.zchat-message-assistant').length===2`);
 assert.equal((await c.val(`window.vault.chat.read('biologia',${JSON.stringify(id)})`)).session.status,'error');
 await c.val('location.reload()');await c.pausa(1000);await c.collega();await aspetta(`!!document.getElementById('chatBtn')`);await click('#chatBtn');
 await aspetta(`document.querySelectorAll('.zchat-message-assistant').length===2`);
 const shot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync(process.env.STUDIA_SCREENSHOT||'/tmp/studia-zaino-chat.png',Buffer.from(shot.result.data,'base64'));
 console.log('OK: UI chat, profili, chiavi, modelli, contesto aggiornato, salvataggio, cambio zaino, annullamento e riapertura.');process.exit(0);
})().catch(async e=>{console.error(e);try{console.error(await c.val(`({profile:document.getElementById('zchatProfileStatus')?.textContent,ai:document.getElementById('zchatAIStatus')?.textContent,chat:document.getElementById('zchatStatus')?.textContent})`));const r=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/studia-zaino-failure.png',Buffer.from(r.result.data,'base64'));}catch(_){}process.exit(1)});
