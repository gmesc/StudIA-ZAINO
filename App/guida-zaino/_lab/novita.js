'use strict';
// Le schermate usano i servizi reali e il provider simulato del laboratorio isolato.
const L=require('./lab'),fs=require('fs'),assert=require('node:assert/strict');
async function wait(expr){assert(await L.finoA(expr,18000),'Attesa non soddisfatta: '+expr);}
async function click(sel){await L.val(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({block:'nearest'})`);await L.pausa(150);await L.clicca(sel);await L.pausa(150);}
async function set(id,value){await L.val(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);}
async function shot(name,sel){await L.muovi(10,940);await L.pausa(600);await L.scatta(name,sel?{sel,scala:2,margine:4}:undefined);}
(async()=>{
 await L.collega();const vault=process.env.GUIDA_VAULT;
 assert(vault && fs.realpathSync(vault).startsWith('/private/tmp/studia-guida-'));assert.equal(await L.val('window.vault.path'),vault);
 if(process.argv.includes('--solo-studio'))await L.val(`(async()=>{await window.vault.chat.setKey({provider:'openai',value:'chiave-finta-guida'});await window.vault.chat.saveSettings({provider:'openai',model:'modello-locale-di-prova'});})()`);
 await L.pulito();await L.invia('Emulation.setDeviceMetricsOverride',{width:1470,height:956,deviceScaleFactor:2,mobile:false});
 await L.val(`cambiaZaino('biologia')`);await wait(`zainoAttivo()==='biologia' && !!document.getElementById('zstudio')`);
 await L.val(`bancoAssegna('A','studio');bancoForma('due-col');bancoAssegna('A','studio');bancoAssegna('C','fonte');bancoAttivaBlocco('A');openPdf('01 Botanica.pdf');`);await wait(`!!PDFJS.doc`);await L.pausa(3800);
 await L.val(`bancoAssegna('A','studio');bancoForma('due-col');bancoAssegna('A','studio');bancoAssegna('C','fonte');bancoAttivaBlocco('A')`);await L.pausa(3800);
 assert.equal(await L.val('bancoBlocchiVisibili().length'),2);assert(await L.val("bancoVisibile('studio') && bancoVisibile('fonte')"));await shot('192-cerca-studia');
 await L.val(`document.getElementById('zragSearch').open=true;document.getElementById('zragSearch').scrollIntoView({block:'start'})`);await set('zragQuery','fotosintesi');await L.val(`document.getElementById('zragForm').requestSubmit()`);
 await wait(`document.querySelectorAll('#zragResults article').length>0 && document.getElementById('zragCancel').hidden`);
 await shot('193-ricerca-passaggi','#studioPane');
 await click('#settingsBtn');await click('.set-tab[data-tab="ai"]');await L.val(`document.getElementById('zragIndexOptions').open=true;document.getElementById('zragIndexOptions').scrollIntoView({block:'start'})`);await shot('194-indice-dispositivo','#zragIndexOptions');
 await L.val(`document.getElementById('zragIndexOptions').open=false;document.getElementById('zchatLocalSettings').scrollIntoView({block:'start'})`);await shot('203-impostazioni-ai-locale','#zchatLocalSettings');await click('#settingsClose');
 await click('#zschedeBack');await click('#zschedeNewButton');
 await wait(`document.getElementById('zschedeNew').open && !document.getElementById('zschedeNewButton').disabled && document.getElementById('zschedePreset').options.length===5 && !document.getElementById('zschedeEstimate').disabled`);
 const sources=(await L.val(`window.vault.chat.sources('biologia')`)).sources,source=sources.find(s=>s.file.endsWith('01 Botanica.pdf'));assert(source);
 await set('zschedeSource',source.id);await set('zschedePreset','sintesi');await click('#zschedeEstimate');
 await wait(`!document.getElementById('zschedeGenerate').hidden && !document.getElementById('zschedeGenerate').disabled`);
 await shot('195-scheda-stima','#studioPane');
 await click('#zschedeGenerate');await wait(`!!document.querySelector('#zschedeResult article') && !document.getElementById('zschedeNewButton').disabled`);
 await click('#zschedeBack');await shot('196-scheda-raccoglitore','#studioPane');await click('#zschedeCollection .zstudio-card-open');await wait(`!!document.querySelector('#zschedeResult article') && !document.getElementById('zschedeNewButton').disabled`);
 await L.val(`document.getElementById('zschedeResult').scrollIntoView({block:'end'})`);await shot('201-scheda-copia','#studioPane');
 await L.val(`bancoMostra('flashcard')`);await wait(`bancoVisibile('flashcard')`);await L.val(`bancoZoom(bancoBloccoDi('flashcard'))`);await L.pausa(3800);
 await click('#zstudyNewButton');await set('zstudyTopic','luce e fotosintesi');await click('#zstudyStart');await wait(`!!document.getElementById('zstudyAttempt') && document.getElementById('zstudyCancel').hidden`);
 await set('zstudyAttempt','La fotosintesi permette alle piante di usare la luce.');await L.val(`document.getElementById('zstudyQuestion').scrollIntoView({block:'start'})`);await shot('197-ripasso-tentativo','#zinterroga');
 await L.val(`document.querySelector('#zstudyQuestion form').requestSubmit()`);
 await wait(`document.getElementById('zstudyQuestion').textContent.includes('Scegli o correggi il tuo esito') && document.getElementById('zstudyCancel').hidden`);
 await L.val(`document.getElementById('zstudyQuestion').scrollIntoView({block:'start'})`);await shot('198-ripasso-riscontro','#zinterroga');
 if(process.argv.includes('--solo-studio')){console.log('Nove schermate di studio aggiornate.');process.exit(0);}
 // I gruppi si costruiscono con gli stessi moduli dell'interfaccia, sul solo vault dimostrativo.
 await L.val(`(async()=>{await zainoNavAggiorna();let s=ZNAV.gruppi.fonti;s=FontiGruppi.crea(s,'guida-da-studiare','Da studiare');s=FontiGruppi.sposta(s,'01 Botanica.pdf','guida-da-studiare');await znavSalva(s,zainoAttivo(),'fonti');ZNAV.organizza.fonti=true;await zainoNavAggiorna();})()`);
 await shot('199-sidebar-gruppi','#zainoNav');
 await L.val(`bancoForma('quattro');bancoAssegna('A','fonte');bancoAssegna('B','studio');bancoAssegna('C','appunti');bancoAssegna('D','flashcard');bancoAttivaBlocco('D')`);
 await click('#bancoBtn');const target=await L.centro('#bForme .bforma[data-forma="due-col"]');await L.muovi(target.x,target.y);
 await shot('200-banco-riduzione','#bancoPop');await L.pulito();
 await click('#chatBtn');await wait(`!document.getElementById('zchatWindow').hidden`);
 const history=await L.val(`!!document.querySelector('.zchat-history-item')`);if(history)await click('.zchat-history-item');
 await click('#zchatScopeButton');await wait(`!document.getElementById('zchatScope').hidden && document.querySelectorAll('#zchatScopeList input').length>0`);
 await shot('190-chat-scelta-fonti','#zchatWindow');await click('#zchatScopeButton');
 await set('zchatInput','Prova citazione: quale ruolo ha la luce?');await click('#zchatSend');
 await wait(`!!document.querySelector('.zchat-message-assistant:last-child .zchat-sources button') && document.getElementById('zchatStop').hidden`);
 await L.val(`document.querySelector('.zchat-message-assistant:last-child .zchat-sources').scrollIntoView({block:'center'})`);
 await shot('191-chat-fonti-citate','.zchat-message-assistant:last-child .zchat-sources');
 await click('.zchat-message-assistant:last-child .zchat-note');await shot('202-chat-appunti','.zchat-message-assistant:last-child .zchat-note-target');
 // Ripresa delle barre con i comandi Annulla/Ripeti, anche dopo una campagna precedente.
 await L.val(`document.getElementById('zchatWindow').hidden=true;bancoForma('uno');bancoAssegna('A','appunti');`);await L.pausa(700);await require('./barre').appunti(L);
 await L.val(`bancoZoomTorna();cambiaZaino('sistema-solare')`);await wait(`zainoAttivo()==='sistema-solare'`);
 await L.val(`(async()=>{const r=await window.vault.mappe.elenco(corsoAttivo());const m=(r.mappe||r)[0];if(!m)throw Error('Manca la mappa dimostrativa');await mappaApriMia(m.file);bancoForma('uno');bancoAssegna('A','mappa');})()`);await L.pausa(900);await require('./barre').mappa(L);
 console.log('Novità: ricerca, indice, schede, tentativo, riscontro, gruppi, Banco e fonti chat acquisiti.');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
