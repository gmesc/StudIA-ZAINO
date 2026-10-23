'use strict';
const assert=require('assert/strict');
const c=require('./cdp');
async function wait(expr){for(let i=0;i<100;i++){if(await c.val(expr))return;await c.pausa(100);}throw Error('Attesa scaduta: '+expr);}
const scegli=val=>c.val(`(()=>{const s=document.getElementById('zainoSelect');s.value=${JSON.stringify(val)};s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
(async()=>{
 await c.collega();await wait(`!!document.getElementById('chatBtn') && zainoAttivo()==='biologia'`);
 assert.equal(await c.val(`document.getElementById('zainoEtichetta').textContent`),'ZAINO Biologia');
 assert.equal(await c.val(`document.getElementById('zainoSelect').closest('.brand')!==null`),true);
 assert.equal(await c.val(`document.getElementById('zainoSelect').options[document.getElementById('zainoSelect').options.length-1].value`),'__nuovo__');
 assert.equal(await c.val(`!!document.getElementById('zainoNuovo') || !!document.getElementById('fsPlus') || !!document.getElementById('fsMinus')`),false);
 await scegli('storia');await wait(`zainoAttivo()==='storia'`);
 assert.equal(await c.val(`document.getElementById('zainoEtichetta').textContent`),'ZAINO Storia');
 await scegli('__nuovo__');
 assert.equal(await c.val(`document.getElementById('zainoPop').hasAttribute('open')`),true);
 assert.equal(await c.val(`document.getElementById('zainoSelect').value`),'storia');
 await c.val(`document.getElementById('zainoNome').value='Geografia & società';`);await c.clicca('#zainoCrea');
 await wait(`document.getElementById('zainoEtichetta').textContent==='ZAINO Geografia & società'`);
 await c.val('location.reload()');await c.pausa(800);await c.collega();await wait(`!!document.getElementById('chatBtn') && document.getElementById('zainoEtichetta').textContent==='ZAINO Geografia & società'`);
 // Una sola icona visibile, che indica l'azione successiva.
 for(const tema of ['chiaro','scuro']){
  await c.val(`document.documentElement.dataset.theme=${JSON.stringify(tema)}`);
  assert.deepEqual(await c.val(`['.i-sun','.i-moon'].map(s=>!!document.querySelector('#themeToggle '+s).getBoundingClientRect().width)`),tema==='chiaro'?[false,true]:[true,false]);
  await c.clicca('#themeToggle');
  assert.equal(await c.val(`document.getElementById('themeToggle').getAttribute('aria-label')`),tema==='chiaro'?'Passa al tema chiaro':'Passa al tema scuro');
 }
 assert.deepEqual(await c.val(`['searchBtn','bancoBtn','chatBtn','settingsBtn'].map(id=>{const b=document.getElementById(id),r=b.querySelector('svg').getBoundingClientRect();return [b.textContent.trim(),Math.round(r.width*10)/10,Math.round(r.height*10)/10,!!b.getAttribute('aria-label')];})`),[['',23,23,true],['',23,23,true],['',23,23,true],['',23,23,true]]);
 await c.clicca('#bancoBtn');assert.equal(await c.val(`!!document.querySelector('#bancoPop[open]')`),true);await c.val('closePops()');
 await c.clicca('#chatBtn');await wait(`!document.getElementById('zchatWindow').hidden`);await c.clicca('#zchatCollapse');
 for(const width of [1470,800,390]){
  await c.invia('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await c.pausa(250);
  assert.equal(await c.val(`document.documentElement.scrollWidth<=innerWidth`),true,'Topbar senza overflow a '+width);
 }
 // Anche senza zaini il menu deve offrire la creazione.
 const fs=require('fs'),path=require('path'),vault=await c.val('window.vault.path');
 assert(vault.startsWith('/tmp/studia-zaino-prova-') || vault.startsWith('/private/tmp/studia-zaino-prova-'));
 const cartella=path.join(vault,'Zaini'),salvati=path.join(vault,'Zaini-salvati');
 fs.renameSync(cartella,salvati);
 try{
  await c.val('MODO.zaino=null;zainiAggiorna();');await wait(`document.getElementById('zainoEtichetta').textContent==='ZAINO'`);
  assert.equal(await c.val(`document.getElementById('zainoSelect').disabled`),false);
  await scegli('__nuovo__');assert.equal(await c.val(`document.getElementById('zainoPop').hasAttribute('open')`),true);
 }finally{fs.rmSync(cartella,{recursive:true,force:true});fs.renameSync(salvati,cartella);}
 await c.val(`closePops();zainiAggiorna();`);await wait(`!!zainoAttivo()`);await scegli('biologia');
 await c.invia('Emulation.setDeviceMetricsOverride',{width:1470,height:900,deviceScaleFactor:2,mobile:false});
 await c.val("document.documentElement.dataset.theme='chiaro'");await c.pausa(400);
 const shot=await c.invia('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:1470,height:60,scale:1}});
 fs.writeFileSync('/private/tmp/zaino-topbar-nuova.png',Buffer.from(shot.result.data,'base64'));
 // La chat ridotta resterebbe sopra il primo appunto della sidebar nella prova seguente.
 await c.clicca('#zchatClose');
 await c.invia('Emulation.clearDeviceMetricsOverride',{});
 console.log('OK: topbar, scelta e creazione zaini, ripristino, temi, icone e finestre strette.');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
