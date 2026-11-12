'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),c=require('./cdp'),WS=require('ws'),q=JSON.stringify;
async function aspetta(e,client=c){for(let i=0;i<180;i++){if(await client.val(e))return;await c.pausa(80);}throw Error('Attesa: '+e);}
async function clic(sel){await aspetta('!!document.querySelector('+q(sel)+')&&!document.querySelector('+q(sel)+').disabled');await c.val('document.querySelector('+q(sel)+').scrollIntoView({block:"center",behavior:"instant"})');await c.clicca(sel);}
async function comando(nome,menu){if(menu)await comando(menu);await clic('#presentaPane [aria-label='+q(nome)+']');}
async function bottone(nome){const sel='[...document.querySelectorAll(".squig-dialog button")].find(e=>e.textContent==='+q(nome)+')';await c.val(sel+'.click()');}
async function campo(nome,val){await c.val('(()=>{const e=document.querySelector('+q('.squig-dialog [aria-label='+q(nome)+']')+');e.value='+q(val)+';e.dispatchEvent(new Event("change",{bubbles:true}));})()');}
async function foto(nome){fs.writeFileSync('/private/tmp/zaino-squig-'+nome+'.png',Buffer.from((await c.invia('Page.captureScreenshot',{format:'png'})).result.data,'base64'));}
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
 await c.collega();await aspetta('!!window.ZainoSquigUI&&!!window.ZainoPresenta');A((await c.val('vault.path')).includes('studia-zaino-prova-'));await c.partiPulito();
 const prima=await c.val('({banco:bancoStato(),attivo:BANCO.attivo,storage:{...localStorage},raccolta:JSON.stringify(ZainoRaccolta.leggi())})');let doc;
 try{
  await c.invia('Emulation.setDeviceMetricsOverride',{width:1400,height:1000,deviceScaleFactor:1,mobile:false});
  await c.val("cambiaZaino('biologia',true);bancoForma('uno');bancoAssegna('A','presenta')");await aspetta('!!document.querySelector("#presentaPane [aria-label=Documento]")');
  await comando('Nuova presentazione','Documento');await aspetta('document.getElementById("uiModal").hasAttribute("open")');await c.val("document.getElementById('umInput').value='Squig: prova isolata';document.getElementById('umOk').click()");await aspetta('!!ZainoPresenta.documento');doc=await c.val('ZainoPresenta.documento.id');
  await comando('Componenti Squig…','Inserisci');await aspetta('!!document.querySelector(".squig-dialog[open] .squig-scelta")');A.equal(await c.val('document.querySelectorAll(".squig-scelta").length'),24);
  for(const width of [1400,700,390,1400]){await c.invia('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await c.val('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');A(await c.val('(()=>{const d=document.querySelector(".squig-dialog"),b=d.querySelector(".squig-scelta"),r=b.getBoundingClientRect(),s=b.querySelector("svg").getBoundingClientRect();return d.scrollWidth<=d.clientWidth+1&&r.height>=120&&s.bottom<=r.bottom;})()'),'galleria e miniature senza tagli a '+width);}
  await campo('Testo','Il mio percorso');await campo('Palette Squig','terminal-green');
  A(await c.val('document.querySelector(".squig-anteprima text").textContent.includes("percorso")'));await c.val('document.fonts.ready');A(await c.val('document.fonts.check("16px Patrick Hand")'));
  await foto('libreria');await bottone('Inserisci componente');await aspetta('ZainoPresenta.documento.stacks[0].slides[0].blocks.some(b=>b.drawing?.squig)');
  const f=await frame();await aspetta('document.querySelector("section.present [data-type=drawing] svg text")?.textContent.includes("percorso")',f);
  A(await f.val('document.querySelector("section.present [data-type=drawing] svg path").getBBox().width>30'));
  const blocco=await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.drawing?.squig).id');
  await comando('Modifica componente Squig');await aspetta('!!document.querySelector(".squig-dialog[open]")');await campo('Testo','Percorso aggiornato');await campo('Larghezza del componente','220');await bottone('Aggiorna componente');
  await aspetta('document.querySelector("section.present [data-type=drawing] svg text")?.textContent==="Percorso aggiornato"',f);
  await comando('Annulla nella presentazione');await aspetta('document.querySelector("section.present [data-type=drawing] svg text")?.textContent.includes("Il mio")',f);await comando('Ripeti nella presentazione');await aspetta('document.querySelector("section.present [data-type=drawing] svg text")?.textContent==="Percorso aggiornato"',f);
  await comando('Navbar','Inserisci');await c.val(`(()=>{const z=ZainoPresenta,s=z.documento.stacks[0].slides[0],b=s.blocks.find(b=>b.type==='navbar'),p=ZainoRaccolta.elenco('navbar').find(r=>r.id==='navbar-squig-internet-blue').pacchetto;z.modifica({tipo:'blocco',slideId:s.id,blockId:b.id,block:ZainoStili.bloccoNavbar(b,p.stile)});})()`);
  await aspetta('!!document.querySelector(".presenta-comuni .presenta-squig-cornice path")',f);A.equal(await f.val('getComputedStyle(document.querySelector(".presenta-comuni .presenta-squig-cornice path")).stroke'),'rgb(36, 56, 255)');A.equal(await f.val('getComputedStyle(document.querySelector(".presenta-comuni button[aria-current] .presenta-squig-fondo")).fill'),'rgb(211, 215, 255)');await foto('slide');
  await c.val('ZainoPresenta.flush()');await c.val('ZainoPresenta.chiudi()');await c.val('ZainoPresenta.apri('+q(doc)+')');await aspetta('ZainoPresenta.documento?.id==='+q(doc));A.equal(await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.id==='+q(blocco)+').drawing.squig.proprieta.label'),'Percorso aggiornato');
  await c.val('ZainoPresenta.presenta()');await aspetta('!!ZainoPresenta.regia');
  const pubblico=await frame('new URL("presentazioni-player/index.html",document.baseURI).href',true);
  A.equal(await pubblico.val('typeof window.ZainoSquigTratti?.contorno'),'function','il player pubblico carica il motore Squig nella propria sessione isolata');
  await aspetta('document.querySelector("section.present [data-type=drawing] svg text")?.textContent==="Percorso aggiornato"',pubblico);
  A.equal(await pubblico.val('getComputedStyle(document.querySelector(".presenta-comuni button[aria-current] .presenta-squig-fondo")).fill'),'rgb(211, 215, 255)');
  A(await pubblico.val(`document.fonts.load('16px "Patrick Hand"').then(f=>f.length===1&&f[0].status==="loaded")`));
  await c.val('vault.presentazioni.comando({azione:"sessione",corso:"biologia",sessionId:ZainoPresenta.regia.stato.sessionId,comando:"chiudi"})');await aspetta('!ZainoPresenta.regia');
  await c.val('ZainoPresenta.chiudi()');await c.val("ZainoTuning.apri('mappa','mappa-squig-graphite')");
  const W='document.querySelector(".tuning-finestra>iframe")?.contentWindow';await aspetta('!!'+W+'?.ZainoTuningAmbiente');A.equal(await c.val(W+'.document.querySelectorAll(".mcontorno-squig").length'),7);await foto('mappa');
  await c.val('[...document.querySelectorAll(".tuning-finestra button")].find(e=>e.textContent==="Chiudi").click()');await aspetta('!document.querySelector(".tuning-finestra")');await clic('#settingsClose');
  await c.val('ZainoTuning.apri("navbar")');const root=(await c.invia('DOM.getDocument')).result.root.nodeId,nodeId=(await c.invia('DOM.querySelector',{nodeId:root,selector:'#tuningFile'})).result.nodeId;
  await c.invia('DOM.setFileInputFiles',{nodeId,files:[path.resolve(__dirname,'../../App/guida-zaino/download/stili/taccuino-blu.zaino-stile.json')]});await aspetta('ZainoRaccolta.elenco("navbar").some(r=>r.pacchetto.nome==="Taccuino blu")');
  const importato=await c.val('ZainoRaccolta.elenco("navbar").find(r=>r.pacchetto.nome==="Taccuino blu").id');await clic('.tuning-card[data-stile-id="'+importato+'"] [aria-haspopup=menu]');await c.val('[...document.querySelectorAll(".tuning-menu button")].find(e=>e.textContent==="Aspetto").click()');await aspetta('!!'+W+'?.ZainoTuningAmbiente');
  A.equal(await c.val(W+'.ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="navbar").style.navbar.tratto'),'squig');
  await c.val(`(()=>{const d=${W}.document,e=d.querySelector('[aria-label="Step della navbar"]');e.value='main';e.dispatchEvent(new Event('change',{bubbles:true}));d.querySelectorAll('.presenta-slide-mini')[3].click();})()`);const demo=await frame(W+'.document.querySelector("#presentaPane iframe").src');await aspetta('document.querySelector(".reveal").dataset.modificaPronta==="true"&&!document.getAnimations().some(a=>a.playState==="running")',demo);await aspetta('document.querySelector(".presenta-comuni button[aria-current]")?.dataset.navH==="1"',demo);await demo.val('document.fonts.ready');A.equal(await demo.val('getComputedStyle(document.querySelector(".presenta-comuni button[aria-current] .presenta-squig-fondo")).fill'),'rgb(214, 218, 255)');await foto('taccuino');
  await c.val('[...document.querySelectorAll(".tuning-finestra button")].find(e=>e.textContent==="Salva stile").click()');await aspetta('document.querySelector(".tuning-finestra>output").textContent==="Stile salvato."');await c.val('[...document.querySelectorAll(".tuning-finestra button")].find(e=>e.textContent==="Chiudi").click()');await aspetta('!document.querySelector(".tuning-finestra")');await clic('#settingsClose');
  console.log('✓ Squig UI: libreria, testo e palette, rendering reale, modifica, annulla/ripeti, riapertura, player pubblico, navbar e mappa demo.');
 }finally{
  await c.val('ZainoPresenta.regia&&vault.presentazioni.comando({azione:"sessione",corso:"biologia",sessionId:ZainoPresenta.regia.stato.sessionId,comando:"chiudi"})');
  await c.val('document.querySelector(".squig-dialog")?.close();document.querySelector(".tuning-finestra")?.close();ZainoPresenta.chiudi()');if(doc)await c.val('vault.presentazioni.comando({azione:"elimina",corso:"biologia",id:'+q(doc)+'})');await c.invia('Emulation.clearDeviceMetricsOverride');await c.val('vault.stili.raccoltaSalva('+q(prima.raccolta)+');localStorage.clear();Object.entries('+q(prima.storage)+').forEach(([k,v])=>localStorage.setItem(k,v));BANCO.stato='+q(prima.banco)+';BANCO.attivo='+q(prima.attivo)+';bancoDisegna()');socket?.close();const avvio=await c.val('performance.timeOrigin');await c.invia('Page.reload');await aspetta('performance.timeOrigin!=='+avvio+'&&!!window.ZainoPresenta');
 }process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
