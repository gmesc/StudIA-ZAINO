'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),WS=require('ws'),c=require('./cdp'),q=JSON.stringify;
const porta=process.env.STUDIA_PORTA||9353;
async function targets(){return (await fetch('http://localhost:'+porta+'/json')).json();}
async function wait(expr,client=c){for(let i=0;i<140;i++){if(await client.val(expr))return;await c.pausa(70);}throw Error('Attesa: '+expr);}
async function collega(t){const ws=new WS(t.webSocketDebuggerUrl),pending=new Map();let id=0;await new Promise(r=>ws.once('open',r));ws.on('message',s=>{const o=JSON.parse(s);if(pending.has(o.id)){pending.get(o.id)(o);pending.delete(o.id);}});const invia=(method,params)=>new Promise(r=>{pending.set(++id,r);ws.send(JSON.stringify({id,method,params}));});return {ws,invia,val:async expression=>{const r=await invia('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.result.exceptionDetails)throw Error(JSON.stringify(r.result.exceptionDetails));return r.result.result.value;}};}
async function mouse(type,p,buttons=0){await c.invia('Input.dispatchMouseEvent',{type,...p,buttons,button:'right',clickCount:type==='mouseMoved'?0:1});}
async function screenshot(client,nome){const data=(await client.invia('Page.captureScreenshot',{format:'png'})).result.data;fs.writeFileSync('/private/tmp/'+nome+'.png',Buffer.from(data,'base64'));return data;}
async function esc(){await c.invia('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});}
async function imposta({forma,spot,colore,spessore,durata}){
 await c.clicca('.proiezione-laser-setting');await wait("!!document.querySelector('.laser-pop:popover-open')");
 if(forma)await c.clicca('[data-laser-forma='+forma+']');
 if(spot!==undefined&&await c.val("document.querySelector('[data-laser-spot]').getAttribute('aria-pressed')==='true'")!==spot)await c.clicca('[data-laser-spot]');
 if(colore)await c.clicca('[data-laser-colore='+colore+']');
 for(const [campo,valore,event]of [['spessore',spessore,'change'],['durata',durata,'input']])if(valore!==undefined)await c.val(`{const e=document.querySelector('[data-laser-${campo}]');e.value=${valore};e.dispatchEvent(new Event(${q(event)},{bubbles:true}));}`);
}
(async()=>{
 await c.collega();await wait("typeof ProiezioneLaser!=='undefined'&&zainoAttivo()==='biologia'");await c.partiPulito();
 const prima=await c.val('({banco:bancoStato(),attivo:BANCO.attivo,storage:{...localStorage}})'),vault=await c.val('vault.path');A(vault.includes('studia-zaino-prova-'));let esterna,file;
 try{
  await c.val("localStorage.removeItem('zaino.proiezione.puntatore')");
  file=await c.val(`(()=>{const n=notesApi().save('biologia',null,{title:'Spot di prova'},${q('# Il sistema solare\n\n'+Array.from({length:8},()=> 'Leggere una frase, confrontare due idee, osservare un particolare.').join('\n\n'))});notesReload();bancoForma('due-col');bancoAssegna('A','appunti');bancoAssegna('C','studio');noteOpen(n.file,NOTES);return n.file;})()`);
  await c.val("BancoPresentazione.apriProiezione('appunti')");await wait("!!document.querySelector('.proiezione-area')");esterna=await collega((await targets()).find(t=>t.url.includes('/proiezione/index.html')));await wait("document.getElementById('contenuto').textContent.includes('sistema solare')",esterna);await c.pausa(400);
  const cornice=()=>c.val("document.querySelector('.proiezione-area').getBoundingClientRect().toJSON()");let r=await cornice();let punto=(x,y)=>({x:r.x+r.width*x,y:r.y+r.height*y});
  A(await c.val("(()=>{const a=document.querySelector('.proiezione-laser-setting').getBoundingClientRect(),b=document.querySelector('.proiezione-area-comandi button:last-child').getBoundingClientRect();return Math.abs(a.right-b.left)<1&&Math.abs(a.height-b.height)<1;})()"),'ingranaggio attaccato a sinistra della testata');
  const originale=await c.val('NOTES.mde.value()');
  await imposta({forma:'box',spot:true,colore:'blu',spessore:0,durata:0});
  A(await c.val("(()=>{const m=document.querySelector('.laser-pop'),r=m.getBoundingClientRect();return r.width<=320&&r.height<340&&m.querySelectorAll('[data-laser-forma] svg').length===3&&m.querySelectorAll('[data-laser-colore][aria-pressed=true]').length===1;})()"),'bubble compatto, icone ed evidenziazione esclusiva');
  await mouse('mouseMoved',{x:4,y:4});await c.pausa(250);
  A(await c.val("[...document.querySelectorAll('.laser-pop [aria-pressed=false]')].every(b=>getComputedStyle(b).backgroundColor==='rgba(0, 0, 0, 0)')"),'i comandi non selezionati non restano evidenziati');
  await screenshot(c,'zaino-menu-laser');await esc();await wait("!document.querySelector('.laser-pop:popover-open')");
  const primaFonte=await screenshot(c,'zaino-spot-base-banco'),primaPubblico=await screenshot(esterna,'zaino-spot-base-pubblico');
  await mouse('mousePressed',punto(.25,.25),2);await mouse('mouseMoved',punto(.75,.75),2);await c.pausa(80);await mouse('mouseReleased',punto(.75,.75));await wait("!document.getElementById('laserSpot').hidden",esterna);
  A(await c.val("getComputedStyle(document.getElementById('laserBancoSpot')).backdropFilter==='blur(8px)'"));A(await esterna.val("getComputedStyle(document.getElementById('laserSpot')).backgroundColor==='rgba(0, 0, 0, 0.5)'"));
  A.equal(await esterna.val("getComputedStyle(document.querySelector('#laser .laser-tratto')).stroke"),'none','bordo 0 nasconde anche il contorno bianco');
  const dopoFonte=await screenshot(c,'zaino-spot-banco'),dopoPubblico=await screenshot(esterna,'zaino-spot-pubblico');
  async function differenze(client,base,spot,area){return client.val(`(async()=>{const leggi=async d=>{const i=new Image();i.src='data:image/png;base64,'+d;await i.decode();const c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;const x=c.getContext('2d');x.drawImage(i,0,0);return {w:c.width,k:c.width/innerWidth,data:x.getImageData(0,0,c.width,c.height).data};};const a=await leggi(${q(base)}),b=await leggi(${q(spot)}),r=${q(area)};let interno=0,esterno=0,ni=0,no=0,chiari=0;for(let y=.05;y<.95;y+=.02)for(let x=.05;x<.95;x+=.02){if(x>.22&&x<.78&&!(x>.3&&x<.7&&y>.3&&y<.7))continue;const i=(Math.floor((r.y+r.height*y)*a.k)*a.w+Math.floor((r.x+r.width*x)*a.k))*4;if(x>.3&&x<.7&&y>.3&&y<.7){interno+=Math.abs(a.data[i]-b.data[i]);ni++;}else{esterno+=a.data[i]-b.data[i];no++;if(a.data[i]>240&&b.data[i]<150)chiari++;}}return {interno:interno/ni,esterno:esterno/no,chiari};})()`);}
  const areaPubblica=await esterna.val("document.getElementById('vista').getBoundingClientRect().toJSON()");
  for(const d of [await differenze(c,primaFonte,dopoFonte,r),await differenze(esterna,primaPubblico,dopoPubblico,areaPubblica)]){A(d.interno<2,'interno nitido e identico: '+JSON.stringify(d));A(d.esterno>60&&d.chiari>20,'esterno oscurato realmente: '+JSON.stringify(d));}
  await c.pausa(2200);A.equal(await esterna.val("getComputedStyle(document.querySelector('#laser g')).opacity"),'1','durata 0 resta visibile');
  await mouse('mousePressed',punto(.4,.4),2);await c.pausa(60);A(await esterna.val("document.getElementById('laserSpot').hidden"),'nuovo clic destro cancella lo spot precedente');await mouse('mouseReleased',punto(.4,.4));await esc();await wait("document.querySelectorAll('#laser g').length===0",esterna);
  // Lazo automatico: tre lati del contorno, l'ultimo viene chiuso dall'app.
  await imposta({forma:'laser',spot:true,colore:'rosso',spessore:3,durata:.5});await esc();
  await mouse('mousePressed',punto(.25,.3),2);for(const p of [[.75,.3],[.75,.7],[.25,.7]]){await mouse('mouseMoved',punto(...p),2);await c.pausa(35);}
  await wait("document.querySelector('#laser .laser-tratto')?.getAttribute('d').endsWith('Z')",esterna);A(await c.val("document.querySelector('#laserBanco .laser-tratto').getAttribute('d').endsWith('Z')"));
  await mouse('mouseReleased',punto(.25,.7));await c.pausa(180);for(const [client,id]of [[c,'laserBanco'],[esterna,'laser']])A(await client.val(`Number(getComputedStyle(document.querySelector('#${id} g')).opacity)<1&&Number(getComputedStyle(document.querySelector('#${id} g')).opacity)>0`),'fade in entrambi gli schermi');await c.pausa(400);A(await esterna.val("document.querySelectorAll('#laser g').length===0&&document.getElementById('laserSpot').hidden"));
  // Cerchio: raggio dal punto iniziale, stesso rapporto sui due schermi.
  await imposta({forma:'cerchio',spot:false,colore:'verde',spessore:6,durata:0});await esc();await mouse('mousePressed',punto(.5,.5),2);await mouse('mouseMoved',punto(.65,.5),2);await c.pausa(100);await mouse('mouseReleased',punto(.65,.5));
  for(const [client,id]of [[c,'laserBanco'],[esterna,'laser']]){A.equal(await client.val(`getComputedStyle(document.querySelector('#${id} .laser-tratto')).stroke`),'rgb(34, 197, 94)');const dim=await client.val(`(()=>{const r=document.querySelector('#${id} .laser-tratto').getBBox(),w=document.getElementById('${id}').getBoundingClientRect().width;return {w:r.width/w,h:r.height/w};})()`);A(Math.abs(dim.w-.3)<.002&&Math.abs(dim.w-dim.h)<.002);}
  A.equal(await c.val('NOTES.mde.value()'),originale,'nessuna modifica all’appunto');
  await c.val('BancoPresentazione.chiudiProiezione()');esterna.ws.close();await c.val("BancoPresentazione.apriProiezione('appunti')");await wait("!!document.querySelector('.proiezione-laser-setting')");await c.clicca('.proiezione-laser-setting');A(await c.val("document.querySelector('[data-laser-forma=cerchio]').getAttribute('aria-pressed')==='true'&&document.querySelector('[data-laser-durata]').value==='0'"),'preferenze conservate alla riapertura');
  // Una cattura deve contenere solo il materiale: altrimenti il pubblico vedrebbe il dimmer due volte.
  await c.val("(()=>{BancoPresentazione.chiudiProiezione();bancoAssegna('C','album');const campione=document.createElement('div');campione.id='campione-spot';campione.style.cssText='position:absolute;inset:0;background:#fff;color:#111;z-index:4';campione.textContent='Campione';bancoElemento('album').append(campione);BancoPresentazione.apriProiezione('album');})()");
  await c.pausa(400);esterna=await collega((await targets()).find(t=>t.url.includes('/proiezione/index.html')));await wait("document.getElementById('immagine').naturalWidth>0",esterna);
  await imposta({forma:'box',spot:true,spessore:0,durata:0});await esc();r=await cornice();
  await mouse('mousePressed',punto(.3,.3),2);await mouse('mouseMoved',punto(.7,.7),2);await c.pausa(100);await mouse('mouseReleased',punto(.7,.7));await wait("!document.getElementById('laserSpot').hidden",esterna);
  const fotogramma=await esterna.val("document.getElementById('immagine').src");await c.val("document.getElementById('campione-spot').textContent='Campione aggiornato'");await wait(`document.getElementById('immagine').src!==${q(fotogramma)}`,esterna);
  A(await esterna.val("(()=>{const i=document.getElementById('immagine'),c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;const x=c.getContext('2d');x.drawImage(i,0,0);return [.1,.2,.8,.9].every(f=>[...x.getImageData(Math.floor(c.width*f),Math.floor(c.height*.5),1,1).data].every(v=>v===255));})()"),'il dimmer non viene impresso nei fotogrammi trasmessi');
  await wait("!document.getElementById('laserBancoSpot').hidden&&getComputedStyle(document.getElementById('laserBancoSpot')).visibility==='visible'");
  console.log('✓ Puntatore: menu compatto, box/cerchio/lazo, spot nitido, dim/blur, bordo 0, colori, fade 0–2, persistenza, feedback e catture pulite nei due schermi');
 }finally{await c.val("BancoPresentazione.chiudiProiezione();document.getElementById('campione-spot')?.remove();bancoZoomTorna();noteMolla()");if(file)require('../../lib/appunti').remove(vault,'biologia',file);await c.val(`localStorage.clear();for(const[k,v]of Object.entries(${q(prima.storage)}))localStorage.setItem(k,v);BANCO.stato=${q(prima.banco)};BANCO.attivo=${q(prima.attivo)};bancoDisegna();notesReload()`);esterna?.ws.close();c.ws().close();}
})().catch(e=>{console.error(e);c.ws()?.close();process.exitCode=1;});
