'use strict';
// Schermate aggiuntive del fork, su materiali sintetici e provider del test.
const L=require('./lab'),fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'../../..'),vault=process.env.GUIDA_VAULT;
const {PDFDocument,StandardFonts}=require(path.join(root,'node_modules/pdf-lib'));
async function value(id,v,event='input'){await L.val(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(v)};e.dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}));})()`);}
async function click(sel){await L.val(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({block:'center'})`);await L.pausa(100);await L.clicca(sel);await L.pausa(200);}
async function shot(name,sel){await L.pausa(400);await L.scatta(name,sel?{sel,scala:2}:undefined);}
(async()=>{
 await L.collega();assert(fs.realpathSync(vault).startsWith('/private/tmp/studia-guida-'));assert.equal(await L.val('window.vault.path'),vault);
 require(path.join(root,'lib/zaini')).crea(vault,'Biologia');
 const notes=require(path.join(root,'lib/appunti'));
 notes.save(vault,'biologia',null,{title:'Fotosintesi'},'## La fotosintesi\n\nLa clorofilla assorbe la luce solare. Le piante usano acqua e anidride carbonica per produrre zuccheri.\n\n### Da ripassare\n- Il ruolo della luce\n- I cloroplasti\n- L’ossigeno liberato');
 notes.save(vault,'biologia',null,{title:'Le cellule'},'## Le cellule\n\nLe cellule sono le unità fondamentali degli organismi.\n\n### Organelli\n- Nucleo: contiene il DNA\n- Mitocondri: trasformano energia\n- Cloroplasti: presenti nelle cellule vegetali');
 for(const title of ['Botanica','La cellula vegetale']){
  const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica);
  const p=doc.addPage();p.drawText(title,{x:55,y:730,size:28,font});p.drawText('Materiale di esempio per la guida di StudIA - ZAINO.',{x:55,y:685,size:12,font});
  p.drawText(title==='Botanica'?'La luce alimenta la fotosintesi.':'I cloroplasti permettono la fotosintesi.',{x:55,y:640,size:15,font});
  const file=path.join(path.dirname(vault),title+'.pdf');fs.writeFileSync(file,await doc.save());require(path.join(root,'lib/fonti')).importa(vault,'biologia',[file]);
 }
 await L.val(`location.reload()`);await L.pausa(2200);await L.collega();
 await L.invia('Emulation.setDeviceMetricsOverride',{width:1470,height:956,deviceScaleFactor:2,mobile:false});
 await L.val(`cambiaZaino('biologia');bancoForma('quattro');bancoAssegnaDaMenu('A','fonte');bancoAssegnaDaMenu('B','fonte');bancoAssegnaDaMenu('C','appunti');bancoAssegnaDaMenu('D','appunti');`);
 await L.pausa(1300);
 await L.val(`notesReload();noteOpen(NOTES.list.find(n=>n.title==='Le cellule').file);appuntiParalleli.open(NOTES.list.find(n=>n.title==='Fotosintesi').file);openPdf('01 Botanica.pdf');fonte2Apri('02 La cellula vegetale.pdf');`);
 await L.finoA(`!!PDFJS.doc && !!FONTE2.doc`,15000);await L.pausa(1500);await shot('187-materiali-paralleli');
 await click('#settingsBtn');await click('[data-tab="utente"]');await L.finoA(`document.getElementById('zchatProfileEdit').options.length>=3`,8000);
 await shot('184-profilo-utente','#settingsModal .media-card');
 await click('[data-tab="ai"]');await value('zchatSettingsProvider','openai','change');
 await value('zchatKeyInput','chiave-finta-per-la-guida');await click('#zchatKeySave');await L.finoA(`document.getElementById('zchatSettingsModel').options.length>1`,8000);
 await value('zchatSettingsModel','modello-locale-di-prova','change');await shot('185-impostazioni-ai','#settingsModal .media-card');
 await click('#settingsClose');await click('#chatBtn');await value('zchatInput','Mi aiuti a capire come la luce viene usata nella fotosintesi?');await click('#zchatSend');
 await L.finoA(`document.querySelectorAll('.zchat-message-assistant').length===1`,12000);await shot('180-chat-tutor','#zchatWindow');
 await click('#zchatClose');await L.finoA(`document.getElementById('zchatRenameDialog').open`,5000);await shot('182-nome-conversazione','#zchatRenameDialog');
 await value('zchatRenameInput','La luce e le piante');await click('#zchatRenameSave');await click('#chatBtn');await L.finoA(`document.querySelectorAll('.zchat-history-item').length===1`,5000);await shot('181-cronologia-chat','#zchatWindow');
 await click('.zchat-history-item');await click('#zchatCollapse');await shot('183-chat-collassata','#zchatWindow');
 await click('#zchatCollapse');await click('#zchatClose');await L.finoA(`document.getElementById('zchatRenameDialog').open`,5000);await click('#zchatRenameSave');
 await shot('188-topbar-fork','header.topbar');
 console.log('Schermate del fork completate: materiali, profili, AI, chat, nome e cronologia.');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
