'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),WS=require('ws'),c=require('./cdp');
const porta=process.env.STUDIA_PORTA||9458;
setTimeout(()=>{console.error('Tempo massimo della prova di presentazione superato');process.exit(1);},180000).unref();
let peer=null,initial=null;
async function wait(expr,client=c){for(let i=0;i<160;i++){if(await client.val(expr))return;await c.pausa(100);}throw Error('Attesa scaduta: '+expr);}
async function collegaProiezione(){
 let target;for(let i=0;i<80&&!target;i++){target=(await (await fetch('http://localhost:'+porta+'/json')).json()).find(t=>t.url.includes('/proiezione/index.html'));if(!target)await c.pausa(100);}
 assert(target,'finestra separata presente');const ws=new WS(target.webSocketDebuggerUrl),pending=new Map();let id=0;
 await new Promise((ok,ko)=>{ws.once('open',ok);ws.once('error',ko);});ws.on('message',raw=>{const r=JSON.parse(raw);if(pending.has(r.id)){pending.get(r.id)(r);pending.delete(r.id);}});
 const invia=(method,params)=>new Promise(resolve=>{pending.set(++id,resolve);ws.send(JSON.stringify({id,method,params}));});
 return {ws,invia,val:async expression=>{const r=await invia('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.result.exceptionDetails)throw Error(JSON.stringify(r.result.exceptionDetails));return r.result.result.value;}};
}
async function shot(name,client=c){const r=await client.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/zaino-presentazione-'+name+'.png',Buffer.from(r.result.data,'base64'));}
async function click(s){await c.clicca(s);await c.pausa(120);}
async function fedele(selector,tag){
 const origine=await c.val(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect(),b=document.querySelector('.proiezione-area').getBoundingClientRect();return {x:r.x-b.x,y:r.y-b.y,width:r.width,height:r.height,base:b.width,text:e.textContent};})()`);
 const destinazione=await peer.val(`(()=>{const e=[...document.querySelectorAll('#contenuto '+${JSON.stringify(tag)})].find(e=>e.textContent===${JSON.stringify(origine.text)}),r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,base:innerWidth};})()`);
 const k=destinazione.base/origine.base;
 for(const key of ['x','y','width','height'])assert(Math.abs(destinazione[key]-origine[key]*k)<3,JSON.stringify({selector,key,origine,destinazione,k}));
}

(async()=>{
 await c.collega();await wait('!!window.BancoPresentazione && !!window.zainoStudio');
 const vault=await c.val('window.vault.path');assert(vault.includes('studia-zaino-prova-'));
 initial=await c.val('({banco:bancoStato(),storage:{...localStorage},theme:document.documentElement.dataset.theme,zaino:corsoAttivo()})');
 await c.val(`cambiaZaino('biologia',true);bancoForma('uno');bancoAssegna('A','appunti')`);
 const body=Array.from({length:28},(_,i)=>'## Capitolo '+i+'\n\n'+('Il paragrafo '+i+' spiega come la luce diventa energia nelle cellule. ').repeat(8)).join('\n\n')+'\n\n> *Passaggio citato*\n> Botanica.pdf; p. 2\n> [Botanica.pdf · p. 2](pdf:01#p=2)';
 const file=require('../../lib/appunti').save(vault,'biologia',null,{title:'Proiezione di prova'},body).file;
 await c.val(`notesReload();noteOpen(${JSON.stringify(file)},noteStati()[0])`);await wait(`!!NOTES.mde && NOTES.cur?.file===${JSON.stringify(file)}`);
 await c.val('if(!NOTES.mde.isPreviewActive())NOTES.mde.togglePreview()');
 await c.invia('Emulation.setDeviceMetricsOverride',{width:1720,height:1000,deviceScaleFactor:1,mobile:false});await c.pausa(400);
 const geometry=()=>c.val(`(()=>{const e=document.querySelector('#noteHost .editor-preview-active'),s=getComputedStyle(e),p=e.querySelector('p');return {font:parseFloat(s.fontSize),width:p.getBoundingClientRect().width,available:e.clientWidth,overflow:e.scrollWidth>e.clientWidth+1};})()`);
 await c.val(`BancoPresentazione.zoom('appunti',100)`);await c.pausa(100);const small=await geometry();
 await click('[data-lettura]');await click('.lettura-pop [data-piu]');assert.equal(await c.val(`BancoPresentazione.percentuale('appunti')`),125);
 await c.val(`document.querySelector('.lettura-pop').hidePopover();BancoPresentazione.zoom('appunti',200)`);await c.pausa(150);const large=await geometry();
 assert.equal(large.font/small.font,2);assert(large.width>small.width*1.5,JSON.stringify({small,large}));assert(!large.overflow);assert(small.width<small.available*.8);
 await shot('lettura');
 await c.invia('Emulation.setDeviceMetricsOverride',{width:650,height:850,deviceScaleFactor:1,mobile:false});await c.pausa(200);
 assert(!(await geometry()).overflow,'testo grande senza scorrimento laterale nello split stretto');
 await c.invia('Emulation.clearDeviceMetricsOverride');await c.pausa(250);
 await c.val(`BancoPresentazione.zoom('appunti',125)`);await c.pausa(200);await c.val(`document.querySelector('#noteHost .editor-preview-active').scrollTop=500`);
 const original=await c.val(`({banco:JSON.stringify(bancoStato()),y:document.querySelector('#noteHost .editor-preview-active').scrollTop,body:NOTES.mde.value()})`);
 await click('[data-intero]');await wait(`document.documentElement.dataset.presentazione==='1'`);await c.pausa(800);
 assert(await c.val(`getComputedStyle(document.querySelector('body>.topbar')).display==='none'&&getComputedStyle(document.getElementById('menuBtn')).display==='none'`));
 await shot('intero');await c.invia('Input.dispatchMouseEvent',{type:'mouseMoved',x:900,y:600});await c.pausa(2500);
 assert(await c.val(`document.querySelector('.presentazione-bar').hasAttribute('data-nascosta')`),'barra si nasconde dopo inattività');
 await c.invia('Input.dispatchMouseEvent',{type:'mouseMoved',x:100,y:10});await wait(`!document.querySelector('.presentazione-bar').hasAttribute('data-nascosta')`);
 await c.invia('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await c.invia('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 await wait(`!document.documentElement.hasAttribute('data-presentazione')`);await c.pausa(1200);
 assert.equal(await c.val('JSON.stringify(bancoStato())'),original.banco);assert.equal(await c.val('NOTES.mde.value()'),original.body);assert.equal(await c.val(`BancoPresentazione.percentuale('appunti')`),125);
 const returnedY=await c.val(`document.querySelector('#noteHost .editor-preview-active').scrollTop`);assert(Math.abs(returnedY-original.y)<3,JSON.stringify({returnedY,originalY:original.y}));
 await c.val('NOTES.mde.togglePreview()');
 await click('[data-proietta]');await wait(`BancoPresentazione.stato().proiezione==='appunti'`);peer=await collegaProiezione();
 await wait(`document.querySelector('#contenuto').textContent.includes('Capitolo 27')`,peer);
 assert.equal(await peer.val('typeof window.vault'),'undefined','la proiezione non ha accesso al vault');
 assert(await c.val(`!!document.querySelector('.blocco[data-proiezione]')`));
 await wait(`!!document.querySelector('.proiezione-area')`);
 assert.equal(await peer.val(`document.body.dataset.tipo`),'clone');
 await c.pausa(350);await fedele('#noteHost .editor-preview-active p','p');
 const border=await c.val(`(()=>{const s=getComputedStyle(document.querySelector('[data-proiezione]'),'::after');return {width:s.borderLeftWidth,color:s.borderLeftColor};})()`);
 assert.equal(border.width,'2px');assert.equal(border.color,'rgb(249, 115, 22)');
 assert(!await peer.val(`document.querySelector('#contenuto').textContent.includes('pdf:01')`),'collegamento leggibile senza URL markdown');
 await peer.val(`document.getElementById('piu').click()`);assert.equal(await peer.val(`document.getElementById('scala').textContent`),'125%');assert.equal(await c.val(`BancoPresentazione.percentuale('appunti')`),125);
 await c.val(String.raw`NOTES.mde.togglePreview();NOTES.mde.codemirror.replaceRange('\n\n## AGGIORNAMENTO DAL PORTATILE\n\nUn altro passaggio.',{line:NOTES.mde.codemirror.lastLine(),ch:NOTES.mde.codemirror.getLine(NOTES.mde.codemirror.lastLine()).length});NOTES.mde.togglePreview();`);
 await wait(`document.querySelector('#contenuto').textContent.includes('AGGIORNAMENTO DAL PORTATILE')`,peer);
 await c.val(`document.querySelector('#noteHost .editor-preview-active').scrollTop=10000`);await c.pausa(500);
 assert(await peer.val(`Number(document.querySelector('#contenuto>[data-sy]').dataset.sy)>500`),'la proiezione segue il passaggio letto');
 await shot('proiettore',peer);await shot('cornice');
 await c.val(`document.documentElement.dataset.theme='scuro'`);await wait(`document.documentElement.dataset.theme==='dark'`,peer);
 assert.equal(await peer.val(`getComputedStyle(document.documentElement).backgroundColor`),'rgb(23, 26, 33)');
 await c.val(`document.documentElement.dataset.theme='chiaro';bancoForma('due-col');bancoAssegna('C','appunti2');BancoPresentazione.zoom('appunti2',75)`);
 assert.equal(await c.val(`BancoPresentazione.percentuale('appunti')`),125);assert.equal(await c.val(`BancoPresentazione.percentuale('appunti2')`),75);
 await c.val(`bancoScambia('A','C')`);
 assert.equal(await c.val(`document.querySelector('[data-proiezione]').dataset.blocco`),'C','la cornice segue lo split spostato');
 assert(await c.val(`(()=>{const b=document.querySelector('[data-proiezione]'),s=getComputedStyle(b,'::after');return Math.abs(parseFloat(s.width)-b.clientWidth)<3;})()`),'la cornice misura il solo split, non tutto il banco');
 await peer.val(`window.proiezione.comando({azione:'intero'})`);await wait(`document.getElementById('intero').title.startsWith('Esci')`,peer);
 await peer.invia('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 await peer.invia('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 await wait(`document.getElementById('intero').title.startsWith('Schermo')`,peer);
 assert.equal((await peer.val(`window.proiezione.comando({azione:'leggiVault'})`)).ok,false);
 // La chiusura della finestra libera la cornice senza chiudere l'appunto.
 await peer.val(`void window.proiezione.comando({azione:'chiudi'})`);peer.ws.close();peer=null;await wait(`!document.querySelector('[data-proiezione]')`);assert(await c.val('!!NOTES.cur'));assert.equal(await c.val('NOTES.mde.isPreviewActive()'),false,'ripristina la scrittura precedente alla proiezione');
 // Il PDF contiene anche caratteri piccoli: vengono ridisegnati dall'originale.
 const {PDFDocument,StandardFonts}=require('pdf-lib'),pdfFile=path.join(vault,'Zaini/biologia/MATERIALI/PDF/01 Botanica.pdf');
 const doc=await PDFDocument.load(fs.readFileSync(pdfFile)),font=await doc.embedFont(StandardFonts.Helvetica);
 for(let j=0;j<12;j++)doc.getPage(1).drawText('Testo vettoriale piccolo: cellule, fotosintesi e luce. Riga '+(j+1),{x:40,y:660-j*18,size:8,font});
 fs.writeFileSync(pdfFile,await doc.save());
 // Il PDF usa la vista reale: pagina, zoom e selezione vengono rispecchiati.
 await c.val(`bancoForma('due-col');bancoAssegna('A','fonte');bancoAssegna('C','fonte2');openPdf('01 Botanica.pdf',1)`);await wait(`!!document.querySelector('#pdfFrame canvas')`);
 await click('[data-proietta]');peer=await collegaProiezione();await wait(`document.getElementById('immagine').src.startsWith('data:image/')`,peer);
 const png=await peer.val(`document.getElementById('immagine').src`);await c.val('PDFJS.viewer.currentPageNumber=2');await c.pausa(1000);
 assert.notEqual(await peer.val(`document.getElementById('immagine').src`),png,'pagina PDF aggiornata sul proiettore');await shot('pdf',peer);
 await peer.invia('Emulation.setDeviceMetricsOverride',{width:1440,height:600,deviceScaleFactor:1,mobile:false});
 await wait(`(()=>{const b=document.querySelector('.proiezione-area');return b&&Math.abs(b.offsetWidth/b.offsetHeight-2.4)<.03;})()`);
 await c.pausa(500);
 const cornice=await c.val(`(()=>{const r=document.querySelector('.proiezione-area').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};})()`);
 const dimensioni=await peer.val(`(()=>{const i=document.getElementById('immagine'),r=i.getBoundingClientRect();return {width:r.width,height:r.height,nw:i.naturalWidth,nh:i.naturalHeight};})()`);
 assert.equal(dimensioni.width,1440,'nessun margine laterale aggiunto alla cattura');
 assert(Math.abs(dimensioni.nw/dimensioni.nh-cornice.width/cornice.height)<.01,'il pubblico vede il rettangolo indicato');
 assert(dimensioni.height<=601,'ritaglio verticale, senza deformazione');
 assert(dimensioni.nw>=1440,'PDF renderizzato almeno alla larghezza della destinazione, non screenshot dello split ingrandito');
 assert.equal(await peer.val(`(()=>{const i=document.getElementById('immagine'),c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;const x=c.getContext('2d');x.drawImage(i,0,0);const d=x.getImageData(0,0,c.width,c.height).data;let arancioni=0;for(let n=0;n<d.length;n+=4)if(d[n]===249&&d[n+1]===115&&d[n+2]===22)arancioni++;return arancioni;})()`),0,'cornice e maniglia rimangono sul Mac, fuori dalla cattura');
 await peer.invia('Emulation.setDeviceMetricsOverride',{width:1440,height:600,deviceScaleFactor:2,mobile:false});
 await wait(`document.getElementById('immagine').naturalWidth>=2880`,peer);
 await peer.val(`document.getElementById('piu').click()`);
 await wait(`document.querySelector('.proiezione-area').offsetWidth<${cornice.width}*.81`);
 const yPrima=await c.val(`document.querySelector('.proiezione-area').getBoundingClientRect().y`);
 await c.val(`document.querySelector('.proiezione-area button').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}))`);
 await wait(`document.querySelector('.proiezione-area').getBoundingClientRect().y>${yPrima}`);
 const handle=await c.val(`(()=>{const r=document.querySelector('.proiezione-area button').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
 const yDrag=await c.val(`document.querySelector('.proiezione-area').getBoundingClientRect().y`);
 await c.invia('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...handle});
 await c.invia('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,x:handle.x,y:handle.y+40});
 await c.invia('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:handle.x,y:handle.y+40});
 await wait(`document.querySelector('.proiezione-area').getBoundingClientRect().y>${yDrag}+30`);
 await peer.invia('Emulation.setDeviceMetricsOverride',{width:1200,height:800,deviceScaleFactor:1,mobile:false});
 await wait(`Math.abs(document.querySelector('.proiezione-area').offsetWidth/document.querySelector('.proiezione-area').offsetHeight-1.5)<.02`);
 await shot('inquadratura-origine');await shot('inquadratura-destinazione',peer);
 await peer.invia('Emulation.clearDeviceMetricsOverride');
 await c.val(`BancoPresentazione.chiudiProiezione()`);peer.ws.close();peer=null;
 assert.equal(await c.val(`document.querySelector('.proiezione-area')===null`),true);
 const pdfPrima=await c.val(`({scala:PDFJS.viewer.currentScaleValue,pagina:PDFJS.viewer.currentPageNumber})`);
 await click('[data-intero]');await c.pausa(900);await click('.presentazione-bar button[title="Adatta alla larghezza"]');
 assert.equal(await c.val('PDFJS.viewer.currentScaleValue'),'page-width');await shot('pdf-intero');
 await c.val(`BancoPresentazione.esciIntero()`);await c.pausa(1200);
 assert.deepEqual(await c.val(`({scala:PDFJS.viewer.currentScaleValue,pagina:PDFJS.viewer.currentPageNumber})`),pdfPrima);
 // Mappa reale: il disegno e i suoi spostamenti arrivano alla finestra separata.
 const mapFile=await c.val(`(async()=>{const r=await mappeApi().salva(corsoAttivo(),null,{titolo:'Mappa proiettata',nodi:[{id:'a',testo:'Energia',x:0,y:0},{id:'b',testo:'Fotosintesi',x:300,y:150}],archi:[{da:'a',a:'b'}]});await mappaApriMia(r.file);return r.file;})()`);
 await c.val(`bancoForma('uno');bancoAssegna('A','mappa')`);await wait(`!!document.querySelector('#mappaSvg .mzoom')`);
 await c.val(`MAPPA.z={k:1.3,x:30,y:20};mappaApplicaZoom()`);const mapZoom=await c.val('MAPPA.z');
 await click('[data-intero]');await c.pausa(900);await c.val(`MAPPA.z={k:2,x:90,y:40};mappaApplicaZoom()`);await shot('mappa-intera');
 await c.val(`BancoPresentazione.esciIntero()`);await c.pausa(1200);assert.deepEqual(await c.val('MAPPA.z'),mapZoom);
 await click('[data-proietta]');peer=await collegaProiezione();await wait(`document.getElementById('immagine').src.startsWith('data:image/')`,peer);const mapPng=await peer.val(`document.getElementById('immagine').src`);
 await c.val(`MAPPA.z.x+=80;mappaApplicaZoom()`);await wait(`document.getElementById('immagine').src!==${JSON.stringify(mapPng)}`,peer);
 await peer.invia('Emulation.setDeviceMetricsOverride',{width:1800,height:1000,deviceScaleFactor:2,mobile:false});
 await c.pausa(700);
 assert(await peer.val(`document.getElementById('immagine').naturalWidth>=3600`),'mappa ridisegnata alla risoluzione della destinazione Retina, senza ingrandire la cattura');
 await shot('mappa',peer);
 // Un'immagine incorporata funge anche da riferimento geometrico misurabile.
 const primaImmagine=await peer.val(`document.getElementById('immagine').src`);
 await c.val(`(()=>{const svg=document.getElementById('mappaSvg'),g=svg.querySelector('.mzoom'),b=document.querySelector('.proiezione-area').getBoundingClientRect(),pt=svg.createSVGPoint();pt.x=b.x+b.width/2;pt.y=b.y+b.height/2;const p=pt.matrixTransform(g.getScreenCTM().inverse()),n=document.createElementNS(svg.namespaceURI,'image'),c=document.createElement('canvas');c.width=c.height=32;const ctx=c.getContext('2d');ctx.fillStyle='rgb(17,190,103)';ctx.fillRect(0,0,32,32);n.id='immagine-prova';n.setAttribute('x',p.x);n.setAttribute('y',p.y);n.setAttribute('width','12');n.setAttribute('height','12');n.setAttribute('href',c.toDataURL());g.append(n);})()`);
 await wait(`document.getElementById('immagine').src!==${JSON.stringify(primaImmagine)}`,peer);
 async function geometriaMappa(){
  const origine=await c.val(`(()=>{const r=document.getElementById('immagine-prova').getBoundingClientRect(),b=document.querySelector('.proiezione-area').getBoundingClientRect();return {x:r.x-b.x,y:r.y-b.y,w:r.width,h:r.height,base:b.width};})()`);
  const pubblico=await peer.val(`(()=>{const i=document.getElementById('immagine'),c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(i,0,0);const d=ctx.getImageData(0,0,c.width,c.height).data;let minX=c.width,minY=c.height,maxX=-1,maxY=-1;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const n=(y*c.width+x)*4;if(d[n]===17&&d[n+1]===190&&d[n+2]===103){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}}return {x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1,base:c.width};})()`);
  assert(pubblico.w>0&&pubblico.h>0,'immagine della mappa conservata');
  for(const key of ['x','y','w','h'])assert(Math.abs(pubblico[key]-origine[key]*pubblico.base/origine.base)<3,JSON.stringify({key,origine,pubblico}));
 }
 await geometriaMappa();
 await peer.invia('Emulation.setDeviceMetricsOverride',{width:1200,height:700,deviceScaleFactor:1,mobile:false});
 await wait(`document.getElementById('immagine').naturalWidth===1200`,peer);await geometriaMappa();
 const primaZoom=await peer.val(`document.getElementById('immagine').src`);
 await peer.val(`document.getElementById('piu').click()`);await wait(`document.getElementById('immagine').src!==${JSON.stringify(primaZoom)}`,peer);await geometriaMappa();
 // Gesti reali sulla destinazione: nessuno zoom indipendente del browser.
 const larghezzaPrima=await c.val(`document.querySelector('.proiezione-area').offsetWidth`);
 await peer.invia('Input.dispatchMouseEvent',{type:'mouseWheel',x:400,y:300,deltaX:0,deltaY:-20,modifiers:2});
 await wait(`document.querySelector('.proiezione-area').offsetWidth<${larghezzaPrima}`);
 assert.equal(await peer.val('visualViewport.scale'),1,'il pinch modifica l’inquadratura, non lo zoom del browser');
 const yGesto=await c.val(`document.querySelector('.proiezione-area').getBoundingClientRect().y`);
 await peer.invia('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});
 await peer.invia('Input.dispatchMouseEvent',{type:'mousePressed',x:400,y:300,button:'left',clickCount:1});
 await peer.invia('Input.dispatchMouseEvent',{type:'mouseMoved',x:400,y:220,button:'left',buttons:1});
 await peer.invia('Input.dispatchMouseEvent',{type:'mouseReleased',x:400,y:220,button:'left',clickCount:1});
 await peer.invia('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
 await wait(`document.querySelector('.proiezione-area').getBoundingClientRect().y>${yGesto}`);
 async function treClic(){for(let n=1;n<=3;n++){await peer.invia('Input.dispatchMouseEvent',{type:'mousePressed',x:400,y:300,button:'left',clickCount:n});await peer.invia('Input.dispatchMouseEvent',{type:'mouseReleased',x:400,y:300,button:'left',clickCount:n});}}
 await treClic();await wait(`document.getElementById('scala').textContent==='100%'`,peer);
 await wait(`document.querySelector('.proiezione-area').offsetWidth>${larghezzaPrima}`);
 await peer.invia('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:300,y:300,id:1},{x:500,y:300,id:2}]});
 await peer.invia('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:250,y:300,id:1},{x:550,y:300,id:2}]});
 await peer.invia('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await wait(`parseInt(document.getElementById('scala').textContent)>100`,peer);
 for(let n=0;n<3;n++){await peer.invia('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:400,y:300,id:1}]});await peer.invia('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
 await wait(`document.getElementById('scala').textContent==='100%'`,peer);
 // Un dito trascina dalla LIM senza Spazio; un trascinamento non è un tap.
 await peer.val(`document.getElementById('piu').click()`);await wait(`document.getElementById('scala').textContent==='125%'`,peer);await c.pausa(300);
 const xDito=await c.val(`document.querySelector('.proiezione-area').getBoundingClientRect().x`);
 await peer.invia('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:400,y:300,id:1}]});
 await peer.invia('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:300,y:300,id:1}]});
 await peer.invia('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await wait(`document.querySelector('.proiezione-area').getBoundingClientRect().x>${xDito}+10`);
 assert.equal(await peer.val(`document.getElementById('scala').textContent`),'125%','un dito sposta senza cambiare zoom');
 for(let n=0;n<3;n++){await peer.invia('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:400,y:300,id:1}]});await peer.invia('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
 await wait(`document.getElementById('scala').textContent==='100%'`,peer);
 // La penna primaria trascina senza Spazio, il passaggio in aria non muove.
 await peer.val(`document.getElementById('piu').click()`);await c.pausa(300);
 const xPenna=await c.val(`document.querySelector('.proiezione-area').getBoundingClientRect().x`);
 await peer.invia('Input.dispatchMouseEvent',{type:'mousePressed',x:400,y:300,button:'left',buttons:1,clickCount:1,pointerType:'pen',force:.5});
 await peer.invia('Input.dispatchMouseEvent',{type:'mouseMoved',x:340,y:300,button:'left',buttons:1,pointerType:'pen',force:.5});
 await peer.invia('Input.dispatchMouseEvent',{type:'mouseReleased',x:340,y:300,button:'left',buttons:0,clickCount:1,pointerType:'pen'});
 await wait(`document.querySelector('.proiezione-area').getBoundingClientRect().x>${xPenna}+10`);
 assert.equal(await peer.val(`document.getElementById('scala').textContent`),'125%','la penna sposta senza cambiare zoom');
 const dopoPenna=await c.val(`document.querySelector('.proiezione-area').getBoundingClientRect().x`);
 await peer.invia('Input.dispatchMouseEvent',{type:'mouseMoved',x:280,y:300,buttons:0,pointerType:'pen'});await c.pausa(200);
 assert.equal(await c.val(`document.querySelector('.proiezione-area').getBoundingClientRect().x`),dopoPenna,'penna sollevata non trascina');
 async function toccoPenna(){await peer.invia('Input.dispatchMouseEvent',{type:'mousePressed',x:400,y:300,button:'left',buttons:1,clickCount:1,pointerType:'pen',force:.5});await peer.invia('Input.dispatchMouseEvent',{type:'mouseReleased',x:400,y:300,button:'left',buttons:0,clickCount:1,pointerType:'pen'});}
 const larghezzaPenna=await c.val(`document.querySelector('.proiezione-area').offsetWidth`);
 await toccoPenna();await toccoPenna();
 assert.equal(await peer.val(`document.getElementById('scala').textContent`),'125%','due tocchi di penna non adattano');
 await toccoPenna();await wait(`document.getElementById('scala').textContent==='100%'`,peer);
 await wait(`document.querySelector('.proiezione-area').offsetWidth>${larghezzaPenna}`);

 const mappaPrimaPan=await c.val('MAPPA.z.x');
 await peer.invia('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});
 await peer.invia('Input.dispatchMouseEvent',{type:'mousePressed',x:400,y:300,button:'left',clickCount:1});
 await peer.invia('Input.dispatchMouseEvent',{type:'mouseMoved',x:480,y:300,button:'left',buttons:1});
 await peer.invia('Input.dispatchMouseEvent',{type:'mouseReleased',x:480,y:300,button:'left',clickCount:1});
 await peer.invia('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
 await wait(`MAPPA.z.x>${mappaPrimaPan}`);
 assert(!await peer.val(`document.getElementById('vista').classList.contains('gesto-mano')`));
 await c.val(`bancoAssegna('A','studio')`);await wait(`!document.querySelector('[data-proiezione]')`);peer.ws.close();peer=null;
 // Il raccoglitore riformatta anche moduli e schede con la stessa misura.
 await c.val(`document.getElementById('zschedeNewButton').click();BancoPresentazione.zoom('studio',200)`);await c.pausa(200);
 assert.equal(await c.val(`getComputedStyle(document.getElementById('zschedeSource')).fontSize`),'34px');
 await click('[data-proietta]');peer=await collegaProiezione();await wait(`document.querySelector('#contenuto').textContent.includes('Tipo di scheda')`,peer);assert(await c.val(`!!document.querySelector('.proiezione-area')`));
 await c.val(`BancoPresentazione.chiudiProiezione()`);peer.ws.close();peer=null;
 const reviewDir=path.join(vault,'Zaini/biologia/RIPASSO'),activeFile=path.join(reviewDir,'active.json'),activeBefore=fs.existsSync(activeFile)?fs.readFileSync(activeFile):null;
 const questionFile=path.join(reviewDir,'domande/prova-proiezione-ripasso.json');fs.mkdirSync(path.dirname(questionFile),{recursive:true});
 fs.writeFileSync(questionFile,JSON.stringify({id:'prova-proiezione-ripasso',question:'Quale funzione svolge la clorofilla nella fotosintesi?',createdAt:new Date().toISOString(),saved:true,attempts:[],sources:[],scope:{mode:'all',sourceIds:[],wikipedia:false}}));
 await c.val(`zainoStudio.refresh();bancoAssegna('A','flashcard');document.getElementById('zstudyBrowse').click()`);await wait(`document.querySelector('[data-question-id="prova-proiezione-ripasso"]')`);
 await click('[data-question-id="prova-proiezione-ripasso"]');await wait(`!!document.getElementById('zstudyAttempt')`);await c.val(`BancoPresentazione.zoom('flashcard',200)`);
 await click('[data-proietta]');peer=await collegaProiezione();await wait(`document.querySelector('#contenuto').textContent.includes('Quale funzione svolge la clorofilla')`,peer);assert(await c.val(`!!document.querySelector('.proiezione-area')`));await c.pausa(400);await fedele('#zstudyQuestion h3','h3');
 await c.val(`document.getElementById('zstudyAttempt').value='Assorbe la luce per la fotosintesi';document.getElementById('zstudyAttempt').dispatchEvent(new Event('input',{bubbles:true}))`);
 await wait(`document.querySelector('#contenuto').textContent.includes('Assorbe la luce')`,peer);await shot('ripasso',peer);
 await c.val(`cambiaZaino('storia',true)`);await wait(`!document.querySelector('[data-proiezione]')`);peer.ws.close();peer=null;
 fs.rmSync(questionFile);if(activeBefore)fs.writeFileSync(activeFile,activeBefore);else fs.rmSync(activeFile,{force:true});
 await c.val(`cambiaZaino('biologia',true);noteStati().forEach(s=>{noteFlushStato(s);noteSvuota(s);});notesApi().remove('biologia',${JSON.stringify(file)});window.vault.mappe.rimuovi('biologia',${JSON.stringify(mapFile)});`);
 await c.val(`document.documentElement.dataset.theme=${JSON.stringify(initial.theme)};localStorage.clear();Object.entries(${JSON.stringify(initial.storage)}).forEach(([k,v])=>localStorage.setItem(k,v));BANCO.stato=${JSON.stringify(initial.banco)};bancoSalva();bancoDisegna();location.reload()`);await c.pausa(700);await c.collega();await wait('!!window.zainoStudio');
 console.log('Lettura, zoom indipendente, fullscreen/Esc, cornice arancione e proiezione note/PDF/mappe, due temi, cambio banco e zaino: OK');process.exit(0);
})().catch(async e=>{console.error(e);try{console.log(await c.val(`({stato:window.BancoPresentazione?.stato(),toast:document.querySelector('#toast')?.textContent,bar:document.querySelector('.blettura')?.textContent})`));await shot('errore');}catch(_){}process.exit(1);});
