'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),c=require('./cdp'),WS=require('ws'),q=JSON.stringify;
async function aspetta(e,client=c){for(let i=0;i<180;i++){if(await client.val(e))return;await c.pausa(80);}throw Error('Attesa: '+e+' · '+await c.val('JSON.stringify({toast:document.getElementById("toast")?.textContent,stato:document.querySelector(".presenta-stato")?.textContent,errori:window.__erroriDrawably})'));}
async function clic(sel){await aspetta('!!document.querySelector('+q(sel)+')&&!document.querySelector('+q(sel)+').disabled');await c.val('document.querySelector('+q(sel)+').scrollIntoView({block:"center",behavior:"instant"})');await c.clicca(sel);}
async function comando(nome,menu){if(menu)await comando(menu);await clic('#presentaPane [aria-label='+q(nome)+']');}
async function bottone(nome){const sel='[...document.querySelectorAll(".drawably-dialog button")].find(e=>e.textContent==='+q(nome)+')';await c.val(sel+'.click()');}
async function campo(nome,val){await c.val('(()=>{const e=document.querySelector('+q('.drawably-dialog [aria-label='+q(nome)+']')+');e.value='+q(val)+';e.dispatchEvent(new Event("change",{bubbles:true}));})()');}
async function foto(nome){fs.writeFileSync('/private/tmp/zaino-drawably-'+nome+'.png',Buffer.from((await c.invia('Page.captureScreenshot',{format:'png'})).result.data,'base64'));}
let socket;
async function frame(espressione='document.querySelector("#presentaPane iframe").src',pubblico=false){
 const url=await c.val(espressione),targets=await(await fetch('http://localhost:'+(process.env.STUDIA_PORTA||8999)+'/json')).json();socket?.close();
 // L’URL a capacità è condiviso: la demo TUNING è annidata, l’editor principale no.
 for(const t of targets.filter(t=>t.type===(pubblico?'page':'iframe')&&t.url===url)){
  const ws=new WS(t.webSocketDebuggerUrl);await new Promise(r=>ws.once('open',r));let id=0;const attese=new Map();ws.on('message',raw=>{const m=JSON.parse(raw);if(m.id){attese.get(m.id)?.(m);attese.delete(m.id);}});
  const client={val:async expression=>{const m=await new Promise(r=>{const n=++id;attese.set(n,r);ws.send(JSON.stringify({id:n,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}));});if(m.result.exceptionDetails)throw Error(JSON.stringify(m.result.exceptionDetails));return m.result.result.value;}};
  if(pubblico||await client.val('window.parent!==window.top')===espressione.includes('contentWindow')){socket=ws;return client;}ws.close();
 }throw Error('Iframe PRESENTA non trovato nel contesto atteso.');
}
(async()=>{
 await c.collega();await aspetta('!!window.ZainoDrawablyUI&&!!window.ZainoPresenta');A((await c.val('vault.path')).includes('studia-zaino-prova-'));await c.partiPulito();await c.val('window.__erroriDrawably=[];window.addEventListener("error",e=>__erroriDrawably.push(e.message));window.addEventListener("unhandledrejection",e=>__erroriDrawably.push(String(e.reason)))');
 const prima=await c.val('({banco:bancoStato(),attivo:BANCO.attivo,storage:{...localStorage}})');let doc;
 try{
  await c.invia('Emulation.setDeviceMetricsOverride',{width:1400,height:1000,deviceScaleFactor:1,mobile:false});
  await c.val("cambiaZaino('biologia',true);bancoForma('uno');bancoAssegna('A','presenta')");await aspetta('!!document.querySelector("#presentaPane [aria-label=Documento]")');
  await comando('Nuova presentazione','Documento');await aspetta('document.getElementById("uiModal").hasAttribute("open")');await c.val("document.getElementById('umInput').value='Drawably: prova isolata';document.getElementById('umOk').click()");await aspetta('!!ZainoPresenta.documento');doc=await c.val('ZainoPresenta.documento.id');
  await comando('Componenti Drawably…','Inserisci');await aspetta('!!document.querySelector(".drawably-dialog[open] .drawably-scelta")');A.equal(await c.val('document.querySelectorAll(".drawably-scelta").length'),23);
  for(const width of [1400,700,390,1400]){await c.invia('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await c.val('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');A(await c.val('(()=>{const d=document.querySelector(".drawably-dialog"),b=d.querySelector(".drawably-scelta"),r=b.getBoundingClientRect(),s=b.querySelector("svg").getBoundingClientRect();return d.scrollWidth<=d.clientWidth+1&&r.height>=120&&s.bottom<=r.bottom;})()'),'galleria senza tagli a '+width);}
  await campo('Testo','Il mio percorso');await campo('Colore del tratto e del testo','#087f3c');await campo('Colore del riempimento','#087f3c');await campo('Variante','solid');
  A(await c.val('document.querySelector(".drawably-anteprima text").textContent.includes("percorso")'));await c.val('document.fonts.ready');A(await c.val('document.fonts.check("16px Patrick Hand")'));
  await foto('libreria');await bottone('Inserisci componente');await aspetta('ZainoPresenta.documento.stacks[0].slides[0].blocks.some(b=>b.drawing?.drawably)');
  const f=await frame();await aspetta('document.querySelector("section.present [data-type=drawing] svg text")?.textContent.includes("percorso")',f);A.equal(await f.val('getComputedStyle(document.querySelector("section.present [data-type=drawing] svg path")).fill'),'rgb(8, 127, 60)');
  const blocco=await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.drawing?.drawably).id');
  await comando('Modifica componente Drawably');await aspetta('!!document.querySelector(".drawably-dialog[open]")');await campo('Testo','Percorso aggiornato');await campo('Larghezza del componente','240');await bottone('Aggiorna componente');
  await aspetta('document.querySelector("section.present [data-type=drawing] svg text")?.textContent==="Percorso aggiornato"',f);
  await comando('Annulla nella presentazione');await aspetta('document.querySelector("section.present [data-type=drawing] svg text")?.textContent.includes("Il mio")',f);await comando('Ripeti nella presentazione');await aspetta('document.querySelector("section.present [data-type=drawing] svg text")?.textContent==="Percorso aggiornato"',f);await foto('slide');
  await c.val('ZainoPresenta.flush()');await c.val('ZainoPresenta.chiudi()');await c.val('ZainoPresenta.apri('+q(doc)+')');await aspetta('ZainoPresenta.documento?.id==='+q(doc));A.equal(await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.id==='+q(blocco)+').drawing.drawably.proprieta.testo'),'Percorso aggiornato');
  await c.val('ZainoPresenta.presenta()');await aspetta('!!ZainoPresenta.regia');
  const pubblico=await frame('new URL("presentazioni-player/index.html",document.baseURI).href',true);
  A.equal(await pubblico.val('typeof window.ZainoDrawablyTratti?.contorno'),'function','il player pubblico carica il motore Drawably nella sessione isolata');
  await aspetta('document.querySelector("section.present [data-type=drawing] svg text")?.textContent==="Percorso aggiornato"',pubblico);
  A.equal(await pubblico.val('getComputedStyle(document.querySelector("section.present [data-type=drawing] svg path")).fill'),'rgb(8, 127, 60)');
  A(await pubblico.val(`document.fonts.load('16px "Patrick Hand"').then(f=>f.length===1&&f[0].status==="loaded")`));
  await c.val('vault.presentazioni.comando({azione:"sessione",corso:"biologia",sessionId:ZainoPresenta.regia.stato.sessionId,comando:"chiudi"})');await aspetta('!ZainoPresenta.regia');
  for(let i=0;i<120;i++){const t=await(await fetch('http://localhost:'+(process.env.STUDIA_PORTA||8999)+'/json')).json();if(!t.some(t=>t.type==='page'&&t.url.endsWith('/presentazioni-player/index.html')))break;if(i===119)throw Error('Player pubblico rimasto aperto');await c.pausa(100);}
  console.log('✓ Drawably UI: 23 elementi, galleria responsive, testo/colore/variante, SVG reale, modifica, annulla/ripeti, riapertura e player pubblico.');
 }finally{
  await c.val('ZainoPresenta.regia&&vault.presentazioni.comando({azione:"sessione",corso:"biologia",sessionId:ZainoPresenta.regia.stato.sessionId,comando:"chiudi"})');
  await c.val('document.querySelector(".drawably-dialog")?.close();ZainoPresenta.chiudi()');if(doc)await c.val('vault.presentazioni.comando({azione:"elimina",corso:"biologia",id:'+q(doc)+'})');await c.invia('Emulation.clearDeviceMetricsOverride');await c.val('localStorage.clear();Object.entries('+q(prima.storage)+').forEach(([k,v])=>localStorage.setItem(k,v));BANCO.stato='+q(prima.banco)+';BANCO.attivo='+q(prima.attivo)+';bancoDisegna()');socket?.close();const avvio=await c.val('performance.timeOrigin');await c.invia('Page.reload');await aspetta('performance.timeOrigin!=='+avvio+'&&!!window.ZainoPresenta');
 }process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
