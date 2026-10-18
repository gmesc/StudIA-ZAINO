'use strict';
const L=require('./lab'),fs=require('fs'),path=require('path'),assert=require('assert');
(async()=>{
 await L.collega();const vault=process.env.GUIDA_VAULT;
 await L.finoA(`window.vault && window.vault.path && document.getElementById('settingsBtn')`,15000);
 assert(vault && fs.realpathSync(vault).startsWith('/private/tmp/studia-guida-'));assert.equal(await L.val('window.vault.path'),vault);
 await L.invia('Emulation.setDeviceMetricsOverride',{width:1470,height:956,deviceScaleFactor:2,mobile:false});
 await L.pulito();await L.clicca('#settingsBtn');await L.pausa(200);await L.clicca('[data-tab="zaino"]');await L.pausa(400);
 await L.clicca('.zx-rinomina[data-zaino="sistema-solare"]');await L.finoA(`document.getElementById('uiModal').hasAttribute('open')`,3000);
 await L.scatta('93-rinomina-zaino',{sel:'#uiModal .um-card',scala:2});
 await L.clicca('#umCancel');
 const url=require('url').pathToFileURL(path.resolve(__dirname,'../index.html')).href;
 await L.invia('Page.navigate',{url});await L.pausa(1800);await L.collega();
 await L.val(`document.documentElement.style.scrollBehavior='auto'; document.querySelectorAll('img[loading]').forEach(i=>i.loading='eager')`);
 await L.finoA(`Array.from(document.querySelectorAll('figure img')).every(i=>i.complete && i.naturalWidth>0)`,15000);
 assert(await L.val(`Array.from(document.querySelectorAll('figure img')).every(i=>i.complete && i.naturalWidth>0)`),'Tutte le immagini devono caricarsi');
 assert.deepEqual(await L.val(`Array.from(document.querySelectorAll('a[href^="#"]')).map(a=>a.getAttribute('href').slice(1)).filter(id=>id && !document.getElementById(id))`),[],'Collegamenti interni esistenti');
 assert(await L.val(`(()=>{const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);return new Set(ids).size===ids.length;})()`),'Identificatori unici');
 assert(await L.val(`document.querySelectorAll('#toc>li').length===document.querySelectorAll('section.cap').length`));
 assert(await L.val(`[...document.querySelectorAll('section.cap h2')].every((h,i)=>Number(h.dataset.n)===i+1)`),'Capitoli in sequenza');
 assert(await L.val(`[...document.querySelectorAll('ol.legenda')].every(ol=>[...ol.children].every((li,i)=>Number(li.dataset.n)===i+1))`),'Legende in sequenza');
 assert.equal(await L.val(`document.querySelector('.brand img').getAttribute('src')`),'../assets/1F392.svg');
 await L.invia('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await L.pausa(300);
 async function shot(file){const r=await L.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync(file,Buffer.from(r.result.data,'base64'));}
 await shot('/tmp/studia-guida-desktop.png');
 await L.val(`document.getElementById('chat-ai').scrollIntoView()`);await L.pausa(400);await shot('/tmp/studia-guida-chat.png');
 await L.val(`document.querySelector('#chat-ai figure img').scrollIntoView({block:'center'})`);await L.pausa(300);await L.clicca('#chat-ai figure img');await L.pausa(200);assert(await L.val(`document.getElementById('lb').classList.contains('aperto')`));await L.clicca('.lbx');
 for(const [id,nome] of [['cerca-studia','ricerca'],['ripasso-guidato','ripasso'],['finestra-gruppi','gruppi']]){
  await L.val(`document.getElementById(${JSON.stringify(id)}).scrollIntoView()`);await L.pausa(300);await shot('/tmp/studia-guida-'+nome+'.png');
 }
 await L.invia('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});await L.val('scrollTo(0,0)');await L.pausa(400);await shot('/tmp/studia-guida-mobile.png');
 for(const tema of ['chiaro','scuro']){
  await L.val(`document.documentElement.dataset.theme=${JSON.stringify(tema)}`);
  assert(await L.val(`document.documentElement.scrollWidth<=innerWidth+1`),'Nessun overflow nel tema '+tema);
 }
 await L.val(`document.documentElement.dataset.theme='chiaro'`);
 await L.clicca('#menuBtn');assert.equal(await L.val(`document.documentElement.dataset.nav`),'open');
 await L.val(`document.querySelector('#toc a[href="#cerca-studia"]').click()`);
 assert.notEqual(await L.val(`document.documentElement.dataset.nav`),'open','L’indice mobile si chiude dopo la scelta');
 await L.val(`document.querySelector('#cerca-studia figure img').scrollIntoView({block:'center'})`);await L.pausa(150);await L.clicca('#cerca-studia figure img');
 assert(await L.val(`document.getElementById('lb').classList.contains('aperto')`));
 const primo=await L.val(`document.querySelector('#lb img').src`);await L.tasto('ArrowRight');assert.notEqual(await L.val(`document.querySelector('#lb img').src`),primo);
 await L.tasto('Escape');assert(!await L.val(`document.getElementById('lb').classList.contains('aperto')`));
 console.log(await L.val(`({capitoli:document.querySelectorAll('section.cap').length,immagini:document.querySelectorAll('figure img').length,passaggi:document.querySelectorAll('ol.passi>li').length})`));
 console.log('Guida: tutte le immagini caricate, indice e lightbox funzionanti, desktop e mobile verificati.');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
