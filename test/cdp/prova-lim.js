'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),WS=require('ws'),c=require('./cdp');
setTimeout(()=>{console.error('Tempo massimo LIM');process.exit(1);},180000).unref();let peer;
async function wait(expr,client=c){for(let n=0;n<150;n++){if(await client.val(expr))return;await c.pausa(100);}throw Error('Attesa: '+expr);}
async function collega(){let t;for(let n=0;n<50&&!t;n++){t=(await(await fetch('http://localhost:'+(process.env.STUDIA_PORTA||9467)+'/json')).json()).find(t=>t.url.includes('/proiezione/index.html'));if(!t)await c.pausa(100);}assert(t);const ws=new WS(t.webSocketDebuggerUrl),pending=new Map();let id=0;await new Promise(r=>ws.once('open',r));ws.on('message',s=>{const o=JSON.parse(s);if(pending.has(o.id)){pending.get(o.id)(o);pending.delete(o.id);}});const invia=(method,params)=>new Promise(r=>{pending.set(++id,r);ws.send(JSON.stringify({id,method,params}));});return {ws,invia,val:async expression=>{const r=await invia('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.result.exceptionDetails)throw Error(JSON.stringify(r.result.exceptionDetails));return r.result.result.value;}};}
async function shot(nome,client=c){const r=await client.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/zaino-lim-'+nome+'.png',Buffer.from(r.result.data,'base64'));}
(async()=>{
 await c.collega();await wait('!!window.ZainoLim');const vault=await c.val('window.vault.path');assert(vault.includes('studia-zaino-prova-'));
 await c.val("cambiaZaino('biologia',true);bancoForma('due-col');bancoAssegna('A','lim')");await c.pausa(400);assert.equal(await c.val("!!document.querySelector('#zs-lim')"),false,'sidebar assente prima della prima lavagnata');
 await c.val('ZainoLim.editor.nuova()');await wait('!!ZainoLim.editor.api');await wait("!!document.querySelector('#zs-lim')");
 const id=await c.val('ZainoLim.doc.studia.id');
 await c.val("ZainoLim.editor.inserisci({testo:'Nucleo e membrana',titolo:'Botanica.pdf; p. 1',link:'pdf:01#p=1'})");
 await wait("ZainoLim.editor.api.getSceneElements().some(e=>e.text?.includes('Nucleo'))");
 const file=path.join(vault,'Zaini/biologia/LIM',id+'.excalidraw');assert(fs.existsSync(file));assert(JSON.parse(fs.readFileSync(file)).elements.some(e=>e.text?.includes('Nucleo')));
 await shot('banco');
 await c.val("bancoAssegna('C','fonte');openPdf('01 Botanica.pdf',1)");await wait('PDFJS.pronto&&!!PDFJS.viewer?.pdfDocument');await c.val("BancoPresentazione.apriProiezione('fonte')");peer=await collega();await wait("document.body.dataset.tipo==='immagine'",peer);await wait("!!document.querySelector('.proiezione-area')");
 await peer.val('ProiezioneLavagna.apri()');await wait('!!ProiezioneLavagna.editor?.api',peer);assert.equal(await peer.val('ProiezioneLavagna.editor.doc.studia.id'),id);
 await wait("document.getElementById('vista').clientWidth<innerWidth*.6",peer);await c.pausa(600);
 const mis=await peer.val("({w:document.getElementById('vista').clientWidth,h:document.getElementById('vista').clientHeight})");const crop=await c.val("(()=>{const r=document.querySelector('.proiezione-area').getBoundingClientRect();return {w:r.width,h:r.height};})()");assert(Math.abs(crop.w/crop.h-mis.w/mis.h)<.02,'cornice segue porzione della fonte');
 await peer.val("ProiezioneLavagna.editor.inserisci({testo:'Disegnato sulla LIM'})");await wait("ZainoLim.editor.api.getSceneElements().some(e=>e.text?.includes('Disegnato'))");
 await peer.val("ProiezioneLavagna.editor.api.setActiveTool({type:'freedraw'})");
 const pen=await peer.val("(()=>{const r=document.querySelector('#limProiezione .lim-editor').getBoundingClientRect();return {x:r.x+r.width*.4,y:r.y+r.height*.4};})()");
 await peer.invia('Input.dispatchMouseEvent',{type:'mousePressed',x:pen.x,y:pen.y,button:'left',buttons:1,clickCount:1,pointerType:'pen',force:.5});
 for(let n=1;n<=12;n++)await peer.invia('Input.dispatchMouseEvent',{type:'mouseMoved',x:pen.x+n*5,y:pen.y+Math.sin(n/2)*20,button:'left',buttons:1,pointerType:'pen',force:.5});
 await peer.invia('Input.dispatchMouseEvent',{type:'mouseReleased',x:pen.x+60,y:pen.y,button:'left',buttons:0,clickCount:1,pointerType:'pen'});
 await wait("ProiezioneLavagna.editor.api.getSceneElements().some(e=>e.type==='freedraw'&&e.points.length>3)",peer);await wait("ZainoLim.editor.api.getSceneElements().some(e=>e.type==='freedraw')");
 await peer.val("document.getElementById('limDivisore').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}))");await c.pausa(500);assert(await peer.val("document.getElementById('vista').clientWidth<innerWidth*.48"));
 await shot('affiancata',peer);await shot('cornice');
 assert(await peer.val("typeof window.vault==='undefined'"));const refused=await peer.val("proiezione.lim.comando({azione:'apri',corso:'storia',id:'../x'})");assert(!refused.ok);
 await peer.val("document.getElementById('citaLim').click()");await wait("document.getElementById('limCitazione').open",peer);await peer.val("document.getElementById('limInserisciCitazione').click()");await wait("ProiezioneLavagna.editor.api.getSceneElements().some(e=>e.text?.includes('Botanica'))",peer);
 await wait("ProiezioneLavagna.editor.api.getSceneElements().some(e=>e.link?.startsWith('zaino-pdf:'))",peer);
 await peer.val("document.getElementById('ritagliaLim').click()");
 await peer.invia('Input.dispatchMouseEvent',{type:'mousePressed',x:30,y:90,button:'left',buttons:1,clickCount:1,pointerType:'pen'});
 await peer.invia('Input.dispatchMouseEvent',{type:'mouseMoved',x:270,y:180,button:'left',buttons:1,pointerType:'pen'});
 await peer.invia('Input.dispatchMouseEvent',{type:'mouseReleased',x:270,y:180,button:'left',buttons:0,clickCount:1,pointerType:'pen'});
 await wait("ProiezioneLavagna.editor.api.getSceneElements().some(e=>e.type==='image')",peer);await wait("ZainoLim.editor.api.getSceneElements().some(e=>e.type==='image')");
 await c.val('BancoPresentazione.chiudiProiezione()');peer.ws.close();peer=null;
 await c.val("cambiaZaino('storia',true)");await c.pausa(350);assert.equal(await c.val("!!document.getElementById('zs-lim')"),false);
 await c.val("cambiaZaino('biologia',true)");await wait("!!document.getElementById('zs-lim')");await c.val(`ZainoLim.apri(${JSON.stringify(id)})`);await wait('!!ZainoLim.editor.api');assert(await c.val("ZainoLim.editor.api.getSceneElements().some(e=>e.text?.includes('Disegnato'))"));
 await c.val("(async()=>{const r=document.querySelector('#limPane .lim-editor').getBoundingClientRect();return (await ZainoLim.editor.immagine({x:r.x,y:r.y,width:r.width,height:r.height},{width:800,height:600,dpr:2})).slice(0,22);})()");await c.val("BancoPresentazione.apriProiezione('lim')");peer=await collega();await wait("document.body.dataset.tipo==='immagine'",peer);assert(await peer.val("document.getElementById('immagine').naturalWidth>=document.getElementById('vista').clientWidth"));await shot('lavagna-proiettata',peer);
 await c.val('BancoPresentazione.chiudiProiezione()');peer.ws.close();peer=null;
 await c.val('ZainoLim.editor.nuova()');await wait('!!ZainoLim.editor.api');await wait("document.querySelectorAll('#zs-lim .lim-voce').length===2");
 await c.val("document.querySelector('#zs-lim [aria-label=\"Modifica elenco LIM\"]').click();document.querySelector('#zs-lim [aria-label=\"Seleziona tutte le lavagnate\"]').click();document.querySelector('#zs-lim [aria-label=\"Elimina selezionate\"]').click()");
 await wait("!document.getElementById('zs-lim')&&!!document.getElementById('limAnnulla')");await c.val("document.getElementById('limAnnulla').click()");await wait("document.querySelectorAll('#zs-lim .lim-voce').length===2");
 console.log('✓ LIM: editor, persistenza, fonte/citazione, divisore, sincronizzazione, riapertura e zaini');
})().catch(async e=>{console.error(e);try{await shot('errore');if(peer)await shot('errore-proiezione',peer);}catch(_){}process.exitCode=1;}).finally(async()=>{peer?.ws.close();try{await c.val('BancoPresentazione.chiudiProiezione()');}catch(_){}process.exit(process.exitCode||0);});
