'use strict';
// Cablaggio reale: anteprima nell’iframe opaco e player nella sessione pubblica.
const A=require('node:assert/strict'),fs=require('node:fs'),c=require('./cdp'),WS=require('ws'),q=JSON.stringify;
let socket;
async function aspetta(e,client=c){for(let n=0;n<150;n++){if(await client.val(e))return;await c.pausa(80);}throw Error('Attesa: '+e+' '+JSON.stringify(await client.val('({url:location.href,visibilita:document.visibilityState,viewport:{w:innerWidth,h:innerHeight,dpr:devicePixelRatio},foglio:document.querySelector("section.present>.presenta-slide")?.getBoundingClientRect().toJSON(),contenitore:document.querySelector(".reveal .slides")?.getBoundingClientRect().toJSON(),motore:typeof anime!=="undefined"?{pausa:anime.engine.paused,frame:anime.engine.reqId,tempo:anime.engine._head?.currentTime,durata:anime.engine._head?.duration,pausaEffetto:anime.engine._head?.paused}:null,root:{...document.querySelector(".reveal")?.dataset},fragments:[...document.querySelectorAll("section.present>.presenta-slide .fragment")].map(e=>e.outerHTML.slice(0,1200))})')));}
async function clic(sel){await aspetta('!!document.querySelector('+q(sel)+')&&!document.querySelector('+q(sel)+').disabled');await c.val('document.querySelector('+q(sel)+').scrollIntoView({block:"center",behavior:"instant"})');await c.clicca(sel);}
async function comando(nome){await clic('#presentaPane [aria-label='+q(nome)+']');}
async function frame(pubblico=false){
 const url=await c.val(pubblico?'new URL("presentazioni-player/index.html",document.baseURI).href':'document.querySelector(".presenta-prova-animazioni iframe").src');
 let frameId;if(!pubblico){const root=(await c.invia('DOM.getDocument')).result.root.nodeId,nodeId=(await c.invia('DOM.querySelector',{nodeId:root,selector:'.presenta-prova-animazioni iframe'})).result.nodeId;frameId=(await c.invia('DOM.describeNode',{nodeId})).result.node.frameId;A(frameId);}
 const targets=await(await fetch('http://localhost:'+(process.env.STUDIA_PORTA||8999)+'/json')).json();socket?.close();
 for(const t of targets.filter(t=>t.type===(pubblico?'page':'iframe')&&t.url===url&&(pubblico||t.id===frameId))){
  const ws=new WS(t.webSocketDebuggerUrl);await new Promise((ok,ko)=>{ws.once('open',ok);ws.once('error',ko);});let id=0;const attese=new Map();
  ws.on('message',raw=>{const m=JSON.parse(raw);if(m.id){attese.get(m.id)?.(m);attese.delete(m.id);}});ws.on('close',()=>{if(attese.size){console.error('Iframe chiuso con comandi in attesa.');process.exit(2);}});
  const client={invia:(method,params)=>new Promise(r=>{const n=++id;attese.set(n,r);ws.send(JSON.stringify({id:n,method,params}));}),val:async expression=>{A.equal(ws.readyState,WS.OPEN);const m=await new Promise(r=>{const n=++id;attese.set(n,r);ws.send(JSON.stringify({id:n,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}));});if(m.error||m.result.exceptionDetails)throw Error(JSON.stringify(m));return m.result.result.value;}};
  socket=ws;return client;
 }throw Error('Anteprima PRESENTA non trovata.');
}
(async()=>{
 await c.collega();await aspetta('!!window.ZainoPresenta');A((await c.val('vault.path')).includes('studia-zaino-prova-'));await c.partiPulito();
 const prima=await c.val('({banco:bancoStato(),attivo:BANCO.attivo,storage:{...localStorage}})');let doc;
 try{
  await c.invia('Emulation.setDeviceMetricsOverride',{width:1400,height:1000,deviceScaleFactor:1,mobile:false});
  A.equal(await c.val('typeof ZainoPretext.layoutWithLines'),'function');A.equal(await c.val('typeof ZainoImpaginazione.gruppiParole'),'function');
  await c.val("cambiaZaino('biologia',true);bancoForma('uno');bancoAssegna('A','presenta')");await comando('Documento');await comando('Nuova presentazione');await aspetta('document.querySelector("#uiModal[open]")');await c.val("document.querySelector('#umInput').value='Pretext: righe e font locali';document.querySelector('#umOk').click()");await aspetta('!!ZainoPresenta.documento');doc=await c.val('ZainoPresenta.documento.id');
  await c.val(`(()=>{const z=ZainoPresenta,s=z.documento.stacks[0].slides[0];z.modifica({tipo:'titoloSlide',slideId:s.id,title:'La foresta è una rete di relazioni tra piante, animali e ambiente'});const b=z.documento.stacks[0].slides[0].blocks[0];z.modifica({tipo:'blocco',slideId:s.id,blockId:b.id,block:{...z.documento.stacks[0].slides[0].blocks[0],style:{fontFamily:'atkinson',fontSize:48,box:{x:10,y:10,width:50,height:65}}}});z.modifica({tipo:'animazioni',slideId:s.id,animations:[{targetId:b.id,effect:'lines',step:1,start:'click',duration:.4}]});z.selezionaOggetto(b.id);})()`);
  await c.val('document.querySelector(".presenta-animazioni").open=true');
  const variabili=await c.val(`(()=>{const r=document.querySelector('.presenta-azione'),f=l=>r.querySelector('[aria-label="'+l+'"]');const o=f('Ordine'),s=f('Sovrapposizione'),d=f('Durata (s)');return {ordine:!!o,sovrapposizione:!!s,stili:[o,s,d].map(e=>{if(!e)return null;const c=getComputedStyle(e);return [c.height,c.fontFamily,c.fontSize,c.borderColor,c.paddingTop,c.paddingBottom];})};})()`);
  A(variabili.ordine&&variabili.sovrapposizione,'variabili delle sequenze presenti');A.deepEqual(variabili.stili[0],variabili.stili[2]);A.deepEqual(variabili.stili[1],variabili.stili[2]);
  await c.val(`(()=>{const e=document.querySelector('.presenta-azione [aria-label="Ordine"]');e.value='reverse';e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await c.val(`(()=>{const e=document.querySelector('.presenta-azione [aria-label="Sovrapposizione"]');e.value='50';e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  A(await c.val(`ZainoPresenta.documento.stacks[0].slides[0].animations[0].sequenceOverlap===50&&ZainoPresenta.documento.stacks[0].slides[0].animations[0].sequenceOrder==='reverse'`));
  await c.val('document.querySelector(".presenta-animazioni").open=true');await comando('Prova la slide');await aspetta('document.querySelector(".presenta-prova-animazioni")?.dataset.pronto==="true"');
  const f=await frame();await clic('.presenta-prova-animazioni [aria-label=Avanti]');await aspetta('document.querySelector(".fragment[data-effetto=lines]")?.dataset.impaginazione==="pretext"',f);
  await aspetta('[...document.querySelectorAll(".presenta-testo span")].every(e=>Number(getComputedStyle(e).opacity)===1)',f);
  await clic('.presenta-prova-animazioni [aria-label=Indietro]');await aspetta('document.querySelector(".presenta-testo").children.length===0',f);
  await clic('.presenta-prova-animazioni [aria-label="Chiudi prova"]');socket.close();socket=null;
  const effetti=['focus-in','letters','fade-up'];
  for(const effect of effetti)await c.val(`(()=>{const z=ZainoPresenta;z.modifica({tipo:'aggiungiSlide',slideId:z.documento.stacks.at(-1).slides[0].id,direzione:'destra'});const s=z.documento.stacks.at(-1).slides[0];z.modifica({tipo:'titoloSlide',slideId:s.id,title:'Prova effetto '+${q(effect)}});const b=z.documento.stacks.at(-1).slides[0].blocks[0];z.modifica({tipo:'animazioni',slideId:s.id,animations:[{targetId:b.id,effect:${q(effect)},step:1,start:'click',duration:.8,delay:.2}]});})()`);
  const slidesEffetti=await c.val('ZainoPresenta.documento.stacks.slice(1).map(s=>({id:s.slides[0].id,effect:s.slides[0].animations[0].effect}))');
  await c.val('document.querySelector(".presenta-slide-mini").click()');
  await c.val('ZainoPresenta.flush()');await c.val('ZainoPresenta.presenta()');await aspetta('!!ZainoPresenta.regia');
  const pubblico=await frame(true);await aspetta('document.querySelector(".reveal")?.dataset.pronto==="true"',pubblico);A.equal(await pubblico.val('typeof ZainoPretext.layoutWithLines'),'function');
  await c.val('vault.presentazioni.comando({azione:"sessione",corso:"biologia",sessionId:ZainoPresenta.regia.stato.sessionId,comando:"avanti"})');
  await aspetta('document.querySelector(".fragment[data-effetto=lines]")?.dataset.impaginazione==="pretext"',pubblico);await aspetta('[...document.querySelectorAll(".presenta-testo span")].every(e=>Number(getComputedStyle(e).opacity)===1)',pubblico);
  A.equal(await pubblico.val('typeof window.vault'),'undefined');
  for(let giro=0;giro<3;giro++)for(const s of slidesEffetti){
   const cmd=comando=>c.val(`vault.presentazioni.comando({azione:'sessione',corso:'biologia',sessionId:ZainoPresenta.regia.stato.sessionId,comando:${q(comando)},slideId:${q(s.id)}})`);
   await cmd('vai');await aspetta(`!!document.querySelector('section.present>.presenta-slide .fragment[data-effetto="${s.effect}"]:not(.visible)')`,pubblico);
   await aspetta(`(()=>{const r=document.querySelector('section.present>.presenta-slide').getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1;})()`,pubblico);
   const punto=await pubblico.val(`(()=>{const r=document.querySelector('section.present>.presenta-slide').getBoundingClientRect();return {x:r.x+12,y:r.y+12};})()`);
   A(await pubblico.val(`!!document.elementFromPoint(${punto.x},${punto.y})?.closest('.presenta-slide')`),'clic dentro il foglio dopo la transizione');
   for(const type of ['mousePressed','mouseReleased'])await pubblico.invia('Input.dispatchMouseEvent',{type,...punto,button:'left',buttons:type==='mousePressed'?1:0,clickCount:1});
   await aspetta(`(()=>{const e=document.querySelector('section.present>.presenta-slide .fragment[data-effetto="${s.effect}"].visible');if(!e)return false;const st=getComputedStyle(e);return Number(st.opacity)===1&&${s.effect==='focus-in'?"st.filter==='blur(0px)'":s.effect==='letters'?"[...e.querySelectorAll('.presenta-testo span')].every(t=>Number(getComputedStyle(t).opacity)===1)":'true'};})()`,pubblico);
   await cmd('indietro');await aspetta(`!document.querySelector('section.present>.presenta-slide .fragment.visible')`,pubblico);
  }
  fs.writeFileSync('/private/tmp/zaino-pretext-app.png',Buffer.from((await c.invia('Page.captureScreenshot',{format:'png'})).result.data,'base64'));
  console.log('✓ Pretext UI e player: clic reale avvia Messa a fuoco, lettere e dissolvenza per tre giri, attese e ritorno; motore locale e isolamento.');
 }finally{
  await c.val('document.querySelector(".presenta-prova-animazioni")?.close();ZainoPresenta.regia&&vault.presentazioni.comando({azione:"sessione",corso:"biologia",sessionId:ZainoPresenta.regia.stato.sessionId,comando:"chiudi"})');
  socket?.close();await c.val('ZainoPresenta.chiudi()');if(doc)await c.val('vault.presentazioni.comando({azione:"elimina",corso:"biologia",id:'+q(doc)+'})');await c.invia('Emulation.clearDeviceMetricsOverride');await c.val('localStorage.clear();Object.entries('+q(prima.storage)+').forEach(([k,v])=>localStorage.setItem(k,v));BANCO.stato='+q(prima.banco)+';BANCO.attivo='+q(prima.attivo)+';bancoDisegna()');
 }process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
