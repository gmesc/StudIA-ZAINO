'use strict';
// Solo vault sintetico. Modello per preparare le slide, mouse reale per i comandi.
const assert=require('node:assert/strict'),fs=require('node:fs'),c=require('./cdp'),q=JSON.stringify,WS=require('ws');
let fc,wsf,id=0;const attese=new Map();
async function wait(expr,client=c){for(let i=0;i<150;i++){if(await client.val(expr))return;await c.pausa(80);}throw Error('Attesa: '+expr);}
async function frame(){
 const url=await c.val('document.querySelector("#presentaPane iframe").src'),ts=await(await fetch('http://localhost:'+(process.env.STUDIA_PORTA||8999)+'/json')).json(),t=ts.find(t=>t.type==='iframe'&&t.url===url);if(fc?.id===t?.id)return fc;assert(t,'frame isolato');wsf?.close();wsf=new WS(t.webSocketDebuggerUrl);await new Promise(r=>wsf.once('open',r));wsf.on('message',raw=>{const m=JSON.parse(raw);if(m.id){attese.get(m.id)?.(m);attese.delete(m.id);}});fc={id:t.id,val:async expr=>{const m=await new Promise(r=>{const n=++id;attese.set(n,r);wsf.send(JSON.stringify({id:n,method:'Runtime.evaluate',params:{expression:expr,awaitPromise:true,returnByValue:true}}));});if(m.result.exceptionDetails)throw Error(JSON.stringify(m.result.exceptionDetails));return m.result.result.value;}};return fc;
}
async function clic(nome,menu){if(menu)await clic(menu);const sel='#presentaPane [aria-label='+q(nome)+']';await c.val(`document.querySelector(${q(sel)}).scrollIntoView({block:'center',behavior:'instant'})`);await c.clicca(sel);await c.val('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');}
async function disegnoClick(nome){await c.clicca('.presenta-disegno-dialog [aria-label='+q(nome)+']');}
(async()=>{
 await c.collega();await c.invia('Runtime.enable',{});c.ws().on('message',raw=>{const m=JSON.parse(raw);if(m.method==='Runtime.exceptionThrown')console.log('eccezione',JSON.stringify(m.params));});await c.invia('Page.reload',{});await wait('!!window.ZainoPresenta');assert((await c.val('vault.path')).includes('studia-zaino-prova-'));await c.partiPulito();const prima=await c.val('({banco:bancoStato(),attivo:BANCO.attivo,storage:{...localStorage}})');let doc;
 try{
  await c.val("cambiaZaino('biologia',true);bancoForma('uno');bancoAssegna('A','presenta')");await wait('!!document.querySelector("#presentaPane [aria-label=Documento]")');
  await clic('Nuova presentazione','Documento');await wait('document.getElementById("uiModal").hasAttribute("open")');await c.val("document.getElementById('umInput').value='Navigazione e disegni';document.getElementById('umOk').click()");await wait('!!ZainoPresenta.documento');doc=await c.val('ZainoPresenta.documento.id');
  await c.val(`(()=>{const z=ZainoPresenta,s=z.documento.stacks[0].slides[0].id;z.modifica({tipo:'titoloSlide',slideId:s,title:'Partenza'});z.modifica({tipo:'aggiungiSlide',slideId:s,direzione:'destra'});const t=z.documento.stacks[1].slides[0].id;z.modifica({tipo:'titoloSlide',slideId:t,title:'Arrivo'});z.modifica({tipo:'aggiungiSlide',slideId:s,direzione:'sotto'});})()`);
  await clic('Navbar','Inserisci');await clic('Numera pagine','Inserisci');await wait('!!document.querySelector("#presentaPane .presenta-aspetto")');
  assert(await c.val('PresentaModello.posizioni(ZainoPresenta.documento).every(p=>p.slide.blocks.some(b=>b.type==="page-number"))'));
  await c.clicca('.presenta-aspetto summary');
  await c.val(`(()=>{const e=document.querySelector('.presenta-aspetto [aria-label="Opacità"]');e.value='45';e.dispatchEvent(new Event('input',{bubbles:true}));const b=document.querySelector('.presenta-aspetto [aria-label="Fusione"]');b.value='multiply';b.dispatchEvent(new Event('change',{bubbles:true}));})()`);await c.clicca('.presenta-aspetto [aria-label="Bianco e nero"]');
  await c.val('ZainoPresenta.flush()');const f=await frame();await wait('document.querySelector("section.present [data-type=page-number]")?.style.opacity==="0.45"',f);
  assert.equal(await f.val('getComputedStyle(document.querySelector("section.present [data-type=page-number]")).mixBlendMode'),'multiply');
  assert((await f.val('document.querySelector("section.present .presenta-numero-pagina").textContent')).endsWith('/2'));
  assert.equal(await f.val('document.querySelector("section.present .presenta-navbar").querySelectorAll("button").length'),3);
  assert.equal(await f.val('document.querySelector("section.present .presenta-navbar button:last-child .presenta-step-titolo").textContent'),'Arrivo');
  await clic('Comandi dell’oggetto');await wait('!!document.querySelector(".presenta-bubble:popover-open")');await clic('Aspetto dell’oggetto');assert(await c.val('!!document.querySelector(".presenta-aspetto-popup [aria-label=Opacità]")'));await c.val('document.querySelector(".presenta-aspetto-popup").hidePopover()');
  await clic('Comandi dell’oggetto');await clic('Nascondi su questa slide');await wait('document.querySelector("section.present [data-type=page-number]")?.hidden',f);assert.equal(await c.val('PresentaModello.posizioni(ZainoPresenta.documento).filter(p=>p.slide.blocks.find(b=>b.type==="page-number").hidden).length'),1);const primaBox=await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="page-number").style.box');await c.val('ZainoPresenta.modifica({tipo:"slide",slideId:ZainoPresenta.documento.stacks[0].slides[0].id,layout:"title-text"})');await wait('document.querySelector("section.present > .presenta-slide")?.dataset.layout==="title-text"',f);await clic('Posizione');await clic('Basso destra');await wait('ZainoPresenta.documento.stacks[0].slides[0].layout==="free"');assert.equal(await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==="page-number").style.box.width'),primaBox.width,'un contatore nascosto conserva le misure durante la conversione della griglia');await clic('Mostra su questa slide');
  await clic('Navbar');await c.val(`(()=>{const e=document.querySelector('[aria-label="Tipo di navbar"]');e.value='progress';e.dispatchEvent(new Event('change',{bubbles:true}));})()`);await wait('document.querySelector("section.present .presenta-navbar")?.dataset.variante==="progress"',f);
  // Excalidraw reale: si sceglie il tool con la sua API e si disegna col puntatore.
  await c.val(`LavagnaUI.carica().then(()=>{const monta=LimEditor.monta;LimEditor.monta=(...args)=>{const editor=monta(...args);window.__disegnoProva=editor;return editor;};})`);await clic('Disegno vettoriale','Inserisci');await wait('!!window.__disegnoProva?.api');
  await c.val("__disegnoProva.api.setActiveTool({type:'rectangle'})");
  const r=await c.val('(()=>{const r=document.querySelector(".presenta-disegno-tela").getBoundingClientRect();return {x:r.x+r.width*.55,y:r.y+r.height*.4};})()');
  await c.invia('Input.dispatchMouseEvent',{type:'mousePressed',...r,button:'left',buttons:1,clickCount:1});await c.invia('Input.dispatchMouseEvent',{type:'mouseMoved',x:r.x+120,y:r.y+80,button:'left',buttons:1});await c.invia('Input.dispatchMouseEvent',{type:'mouseReleased',x:r.x+120,y:r.y+80,button:'left',clickCount:1});await wait('__disegnoProva.api.getSceneElements().length===1');
  // Il testo percorre la stessa esportazione vettoriale delle forme.
  await c.val(`__disegnoProva.api.updateScene({elements:[...__disegnoProva.api.getSceneElements(),...LimEditor.converti([{type:'text',x:0,y:0,text:'Energia & luce'}])]})`);
  await disegnoClick('Inserisci disegno');await wait('!document.querySelector(".presenta-disegno-dialog")');await wait('!!document.querySelector("section.present .presenta-vettore path")',f);
  assert((await f.val('document.querySelector("section.present .presenta-vettore").textContent')).includes('Energia & luce'));
  assert.equal(await c.val('ZainoPresenta.documento.stacks.flatMap(p=>p.slides).flatMap(s=>s.blocks).find(b=>b.type==="drawing").drawing.scene.length'),2);
  await clic('Modifica disegno vettoriale');await wait('__disegnoProva.api.getSceneElements().length===2');await disegnoClick('Annulla disegno');await c.val('ZainoPresenta.flush()');
  const riaperta=await c.val(`vault.presentazioni.comando({azione:'apri',corso:'biologia',id:${q(doc)}})`);assert(riaperta.ok);assert(riaperta.documento.stacks.flatMap(p=>p.slides).some(s=>s.blocks.some(b=>b.type==='drawing'&&b.drawing.scene.length===2)));
  const shot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/private/tmp/presenta-elementi-editor.png',Buffer.from(shot.result.data,'base64'));
  console.log('✓ PRESENTA UI: navbar e titoli, contatore comune, aspetto su foglio e bubble, nascondi/ripristina, Excalidraw col mouse, SVG, riapertura e salvataggio');
 }finally{
  await c.val('document.querySelector(".presenta-disegno-dialog")?.close();ZainoPresenta.chiudi()');if(doc)await c.val(`vault.presentazioni.comando({azione:'elimina',corso:'biologia',id:${q(doc)}})`);await c.val(`localStorage.clear();Object.entries(${q(prima.storage)}).forEach(([k,v])=>localStorage.setItem(k,v));BANCO.stato=${q(prima.banco)};BANCO.attivo=${q(prima.attivo)};bancoDisegna()`);wsf?.close();
 }
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
