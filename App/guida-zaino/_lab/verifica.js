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
 assert(await L.val(`document.querySelectorAll('#toc>li').length===document.querySelectorAll('section.cap').length`));
 assert.equal(await L.val(`document.querySelector('.brand img').getAttribute('src')`),'../assets/1F392.svg');
 await L.invia('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await L.pausa(300);
 async function shot(file){const r=await L.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync(file,Buffer.from(r.result.data,'base64'));}
 await shot('/tmp/studia-guida-desktop.png');
 await L.val(`document.getElementById('chat-ai').scrollIntoView()`);await L.pausa(400);await shot('/tmp/studia-guida-chat.png');
 await L.val(`document.querySelector('#chat-ai figure img').scrollIntoView({block:'center'})`);await L.pausa(300);await L.clicca('#chat-ai figure img');await L.pausa(200);assert(await L.val(`document.getElementById('lb').classList.contains('aperto')`));await L.clicca('.lbx');
 await L.invia('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});await L.val('scrollTo(0,0)');await L.pausa(400);await shot('/tmp/studia-guida-mobile.png');
 assert(await L.val(`document.documentElement.scrollWidth<=innerWidth+1`));
 console.log('Guida: tutte le immagini caricate, indice e lightbox funzionanti, desktop e mobile verificati.');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
