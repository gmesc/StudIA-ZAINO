'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),c=require('./cdp'),q=JSON.stringify;
async function wait(expr){for(let i=0;i<180;i++){if(await c.val(expr))return;await c.pausa(100);}throw Error('Attesa: '+expr+'; '+JSON.stringify(await c.val(`({dialog:document.getElementById('citazioneDialog').open,stato:document.getElementById('citazioneStato').textContent})`)));}
async function provaGesti(){
 await c.val(`cambiaZaino('biologia',true);bancoForma('due-col');bancoAssegna('A','fonte');bancoAssegna('C','fonte2');openPdf('01 Botanica.pdf',1,'Botanica',true);fonte2Apri('02 Biologia cellulare.pdf',1)`);
 await wait(`PDFJS.pronto&&!!PDFJS.doc&&!!FONTE2.doc&&document.querySelector('#pdf2Frame .textLayer span')`);
 const mouse=(type,p,extra={})=>c.invia('Input.dispatchMouseEvent',{type,...p,...extra});
 const spazio=type=>c.invia('Input.dispatchKeyEvent',{type,key:' ',code:'Space',windowsVirtualKeyCode:32});
 for(const [id,v,altro,chiave] of [['pdfFrame','PDFJS.viewer','FONTE2.viewer','studia.pdf.zoom'],['pdf2Frame','FONTE2.viewer','PDFJS.viewer','studia.pdf2.zoom']]){
  await c.val(`${v}.currentScaleValue='1.8'`);await c.pausa(500);
  await c.val(`(()=>{const h=document.getElementById('${id}');h.scrollLeft=120;h.scrollTop=200;h.focus();})()`);
  const p=await c.val(`(()=>{const r=document.getElementById('${id}').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/3};})()`);
  const fermo=await c.val(`${altro}.currentScale`);
  const ancora=()=>c.val(`(()=>{const r=document.querySelector('#${id} .page').getBoundingClientRect();return {x:(${p.x}-r.x)/${v}.currentScale,y:(${p.y}-r.y)/${v}.currentScale};})()`);
  const prima=await ancora();
  await mouse('mouseWheel',p,{deltaX:0,deltaY:-12,modifiers:2});await c.pausa(500);
  const scala=await c.val(`${v}.currentScale`);assert(scala>1.8&&scala<2.1,'pinch continuo nel '+id+': '+scala);
  const dopo=await ancora();assert(Math.hypot(prima.x-dopo.x,prima.y-dopo.y)<3,'ancora del pinch nel '+id+': '+JSON.stringify({prima,dopo}));
  assert.equal(await c.val(`${altro}.currentScale`),fermo,'pinch indipendente');
  const scroll=()=>c.val(`(()=>{const h=document.getElementById('${id}');return {x:h.scrollLeft,y:h.scrollTop};})()`);
  const s0=await scroll();await mouse('mouseWheel',p,{deltaX:45,deltaY:70});await c.pausa(250);const s1=await scroll();
  assert(s1.x>s0.x&&s1.y>s0.y,'scorrimento nativo su entrambi gli assi');assert.equal(await c.val(`${v}.currentScale`),scala);
  await mouse('mouseMoved',p);await spazio('keyDown');
  assert(await c.val(`document.getElementById('${id}').classList.contains('pdf-spazio')`),'Spazio arma solo il lettore');
  await mouse('mousePressed',p,{button:'left',buttons:1,clickCount:1});
  await mouse('mouseMoved',{x:p.x-65,y:p.y-80},{button:'left',buttons:1});
  await mouse('mouseReleased',{x:p.x-65,y:p.y-80},{button:'left',buttons:0,clickCount:1});await spazio('keyUp');
  const s2=await scroll();assert(Math.abs(s2.x-s1.x-65)<2&&Math.abs(s2.y-s1.y-80)<2,'Spazio+trascina sposta il documento '+JSON.stringify({s1,s2}));
  assert.equal(await c.val(`getSelection().toString()`),'','pan senza selezione');
  assert(await c.val(`!document.querySelector('.pdf-spazio,.pdf-trascina')`),'rilascio pulisce il cursore');
  await mouse('mouseMoved',p);
  await c.val(`window.__clicGesti=[];window.__ascoltaClic=new AbortController();window.addEventListener('click',e=>window.__clicGesti.push({n:e.detail,target:e.target.className,tempo:e.timeStamp}),{capture:true,signal:window.__ascoltaClic.signal})`);
  // Tre clic da scala manuale e da larghezza: sempre larghezza, mai pagina intera.
  for(let giro=0;giro<2;giro++){
   for(let n=1;n<=3;n++)for(const type of ['mousePressed','mouseReleased'])await mouse(type,p,{button:'left',buttons:type==='mousePressed'?1:0,clickCount:n});
   await c.pausa(150);assert.equal(await c.val(`${v}.currentScaleValue`),'page-width','triplo click nel '+id+': '+JSON.stringify(await c.val(`({clic:window.__clicGesti,hit:document.elementFromPoint(${p.x},${p.y})?.outerHTML.slice(0,180)})`)));
  }
  await c.val('window.__ascoltaClic.abort();delete window.__ascoltaClic;delete window.__clicGesti');
  assert.equal(await c.val(`localStorage.getItem('${chiave}')`),'page-width','adattamento salvato');
  assert.equal(await c.val(`${altro}.currentScale`),fermo,'reset indipendente');
  const adattata=await c.val(`${v}.currentScale`);
  await c.val(`document.getElementById('${id}').style.right='100px'`);await c.pausa(200);
  assert(await c.val(`${v}.currentScale<${adattata}`),'dopo tre clic segue la nuova larghezza');
  await c.val(`document.getElementById('${id}').style.right=''`);await c.pausa(200);
  // Perdita del focus: nessuna mano rimane attiva al ritorno.
  await c.val(`document.getElementById('${id}').focus()`);await spazio('keyDown');await c.val(`window.dispatchEvent(new Event('blur'))`);
  assert(await c.val(`!document.querySelector('.pdf-spazio,.pdf-trascina')`));await spazio('keyUp');
 }
 // Il trascinamento normale sul testo mantiene selezione e menu.
 await c.val(`PDFJS.viewer.currentPageNumber=1;document.getElementById('pdfFrame').scrollTop=0;document.getElementById('pdfFrame').scrollLeft=0;`);await c.pausa(300);
 const r=await c.val(`(()=>{const r=document.querySelector('#pdfFrame .textLayer span').getBoundingClientRect();return {x:r.x+2,y:r.y+r.height/2,end:r.right-2};})()`);
 await mouse('mousePressed',{x:r.x,y:r.y},{button:'left',buttons:1,clickCount:1});
 await mouse('mouseMoved',{x:r.end,y:r.y},{button:'left',buttons:1});await mouse('mouseReleased',{x:r.end,y:r.y},{button:'left',buttons:0,clickCount:1});
 assert((await c.val('getSelection().toString()')).includes('Botanica'),'trascinamento normale seleziona il testo');
 for(let n=1;n<=3;n++)for(const type of ['mousePressed','mouseReleased'])await mouse(type,{x:r.x+12,y:r.y},{button:'left',clickCount:n});
 await c.pausa(100);assert.equal(await c.val('getSelection().toString()'),'','tre clic sul testo non lasciano una selezione');
 assert(!await c.val('selBarraAperta()'),'tre clic non aprono il menu di selezione');
 const shot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/zaino-gesti-fonti.png',Buffer.from(shot.result.data,'base64'));

 await c.val(`getSelection().removeAllRanges();selMenuChiudi();selBarraChiudi();window.__campoProva=document.createElement('input');document.body.append(window.__campoProva);window.__campoProva.focus()`);
 await mouse('mouseMoved',{x:r.x,y:r.y});await c.invia('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32,text:' '});await spazio('keyUp');
 assert.equal(await c.val('window.__campoProva.value'),' ','lo spazio scritto non viene rubato dal PDF');
 assert(await c.val(`!document.querySelector('.pdf-spazio,.pdf-trascina')`));await c.val('window.__campoProva.remove();fonte2Chiudi();closePdf()');
 console.log('Fonti: pinch ancorato, scroll, Spazio+trascina, tre clic e riadattamento in entrambi gli split OK');
}

async function provaGestiCitazione(rimando){
 const mouse=(type,p,extra={})=>c.invia('Input.dispatchMouseEvent',{type,...p,...extra});
 const spazio=type=>c.invia('Input.dispatchKeyEvent',{type,key:' ',code:'Space',windowsVirtualKeyCode:32});
 const pagina=`document.querySelector('#citazionePagine .page[data-page-number="2"]')`;
 const larghezza=()=>c.val(`${pagina}.getBoundingClientRect().width`);
 const originale=await larghezza(),locale=await c.val('PDFJS.viewer.currentScale');
 assert.equal(await c.val('document.activeElement.id'),'citazioneFrame','focus iniziale sul PDF, pronto a ricevere Spazio');
 assert.equal(await c.val(`document.querySelectorAll('#citazioneZoom button:not([disabled])').length`),3,'tre controlli di zoom pronti');
 assert.deepEqual(await c.val(`[...document.querySelectorAll('#citazioneZoom svg')].map(e=>e.dataset.icona)`),['minus','move-horizontal','plus'],'stesse icone di Fonti');
 for(const [nuovo,fonte] of [['citazioneZoomOut','pdfZoomOut'],['citazioneZoomIn','pdfZoomIn']])assert.equal(await c.val(`document.getElementById('${nuovo}').title`),await c.val(`document.getElementById('${fonte}').title`),'stesso tooltip');
 const titoloAdatta=await c.val(`document.getElementById('citazioneZoomLvl').title.replace(/\\d+%/g,'N%')`);
 assert.equal(titoloAdatta,await c.val(`document.getElementById('pdfZoomLvl').title.replace(/\\d+%/g,'N%')`),'stesso tooltip dinamico di Fonti');
 await c.clicca('#citazioneZoomIn');await c.pausa(150);const piu=await larghezza();assert(piu>originale,'più ingrandisce');
 assert((await c.val(`document.getElementById('citazioneZoomLvl').title`)).includes('Zoom scelto a mano'),'tooltip aggiornato sullo zoom manuale');
 await c.clicca('#citazioneZoomOut');await c.pausa(150);assert(await larghezza()<piu,'meno riduce');
 await c.clicca('#citazioneZoomLvl');await c.pausa(150);assert(Math.abs(await larghezza()-originale)<2,'il bottone rientra dalla larghezza');
 await c.clicca('#citazioneZoomLvl');await c.pausa(150);assert(await larghezza()<originale,'stesso ciclo di Fonti: pagina intera');
 assert.equal(await c.val(`document.querySelector('#citazioneZoomLvl svg').dataset.icona`),'maximize');
 await c.clicca('#citazioneZoomLvl');await c.pausa(150);assert(Math.abs(await larghezza()-originale)<2,'ritorno alla larghezza');
 await c.val(`document.getElementById('citazioneFrame').focus()`);

 const p=await c.val(`(()=>{const h=document.getElementById('citazioneFrame');const r=h.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/3};})()`);
 const ancora=()=>c.val(`(()=>{const r=${pagina}.getBoundingClientRect();return {x:(${p.x}-r.x)/r.width,y:(${p.y}-r.y)/r.width};})()`);
 const prima=await ancora();await mouse('mouseWheel',p,{deltaX:0,deltaY:-45,modifiers:2});await c.pausa(500);
 assert((await c.val(`document.getElementById('citazioneZoomLvl').title`)).includes('Zoom scelto a mano'),'pinch aggiorna il tooltip del bottone');
 const ingrandita=await larghezza();assert(ingrandita>originale*1.4,'pinch nell’anteprima della citazione: '+JSON.stringify({originale,ingrandita}));
 const dopo=await ancora();assert(Math.hypot(prima.x-dopo.x,prima.y-dopo.y)<.003,'pinch ancorato al puntatore');
 // Uno zoom scelto a mano resiste al resize; solo tre clic riattivano la larghezza.
 await c.val(`document.getElementById('citazioneFrame').style.right='100px'`);await c.pausa(200);
 assert(Math.abs(await larghezza()-ingrandita)<2,'resize conserva lo zoom manuale');
 await c.val(`document.getElementById('citazioneFrame').style.right=''`);await c.pausa(200);
 await c.val(`document.getElementById('citazioneFrame').scrollLeft=120`);
 const scroll=()=>c.val(`(()=>{const h=document.getElementById('citazioneFrame');return {x:h.scrollLeft,y:h.scrollTop};})()`);
 const s0=await scroll();await mouse('mouseWheel',p,{deltaX:30,deltaY:60});await c.pausa(250);const s1=await scroll();
 assert(s1.x>s0.x&&s1.y>s0.y,'due dita scorrono su entrambi gli assi');
 await mouse('mouseMoved',p);await spazio('keyDown');assert(await c.val(`document.getElementById('citazioneFrame').classList.contains('pdf-spazio')`),'Spazio funziona nel dialogo modale');
 await mouse('mousePressed',p,{button:'left',buttons:1,clickCount:1});await mouse('mouseMoved',{x:p.x-60,y:p.y-70},{button:'left',buttons:1});
 await mouse('mouseReleased',{x:p.x-60,y:p.y-70},{button:'left',buttons:0,clickCount:1});await spazio('keyUp');
 const s2=await scroll();assert(Math.abs(s2.x-s1.x-60)<2&&Math.abs(s2.y-s1.y-70)<2,'Spazio + trascina nell’anteprima');
 assert.equal(await c.val('getSelection().toString()'),'','pan senza selezionare testo');
 assert(await c.val(`!document.querySelector('.pdf-spazio,.pdf-trascina')`),'rilascio pulisce i cursori');
 await mouse('mouseMoved',p);
 await c.val(`window.__clicGesti=[];window.__ascoltaClic=new AbortController();window.addEventListener('click',e=>window.__clicGesti.push({n:e.detail,target:e.target.className,tempo:e.timeStamp}),{capture:true,signal:window.__ascoltaClic.signal})`);
 for(let giro=0;giro<2;giro++){
  for(let n=1;n<=3;n++)for(const type of ['mousePressed','mouseReleased'])await mouse(type,p,{button:'left',buttons:type==='mousePressed'?1:0,clickCount:n});
  await c.pausa(150);const dopoTre=await larghezza();
  if(Math.abs(dopoTre-originale)>=2){const shot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/zaino-treclick-debug.png',Buffer.from(shot.result.data,'base64'));}
  assert(Math.abs(dopoTre-originale)<2,'tre clic ripristinano sempre la larghezza: '+JSON.stringify({giro,originale,dopoTre,stato:await c.val(`({hit:document.elementFromPoint(${p.x},${p.y})?.outerHTML.slice(0,180),frame:document.getElementById('citazioneFrame').clientWidth,tooltip:document.getElementById('citazioneZoomLvl').title,menu:selBarraAperta(),clic:window.__clicGesti})`)}));
  assert((await c.val(`document.getElementById('citazioneZoomLvl').title`)).startsWith('Adattata alla larghezza'),'tre clic aggiornano il tooltip');
 }
 await c.val('window.__ascoltaClic.abort();delete window.__ascoltaClic;delete window.__clicGesti');
 await c.val(`document.getElementById('citazioneFrame').style.right='100px'`);await c.pausa(200);
 assert(await larghezza()<originale-80,'dopo il reset segue la larghezza della finestra');
 await c.val(`document.getElementById('citazioneFrame').style.right='';${pagina}.querySelector('.textLayer span').scrollIntoView({block:'center'});`);await c.pausa(300);
 const r=await c.val(`(()=>{const r=${pagina}.querySelector('.textLayer span').getBoundingClientRect();return {x:r.x+2,y:r.y+r.height/2,end:r.right-2};})()`);
 await mouse('mousePressed',{x:r.x,y:r.y},{button:'left',buttons:1,clickCount:1});await mouse('mouseMoved',{x:r.end,y:r.y},{button:'left',buttons:1});await mouse('mouseReleased',{x:r.end,y:r.y},{button:'left',buttons:0,clickCount:1});
 assert((await c.val('getSelection().toString()')).includes('Botanica'),'il drag normale seleziona ancora il testo');
 await wait('selBarraAperta()');assert(await c.val(`document.getElementById('selBarra').parentElement.id==='citazioneDialog'`));
 assert.equal(await c.val('PDFJS.viewer.currentScale'),locale,'il PDF sotto la finestra non cambia zoom');
 const shot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/zaino-gesti-citazione.png',Buffer.from(shot.result.data,'base64'));
 // Chiudere tenendo Spazio non deve lasciare la mano attiva alla riapertura.
 await c.val(`selBarraChiudi();getSelection().removeAllRanges();document.getElementById('citazioneFrame').focus()`);await spazio('keyDown');
 await c.val(`document.getElementById('citazioneChiudi').click()`);await c.pausa(100);
 assert(await c.val(`!document.querySelector('.pdf-spazio,.pdf-trascina')`),'chiusura ripulisce il gesto');await spazio('keyUp');
 await c.val(`citazioneZainoApri(${q(rimando)},NOTES)`);await wait(`!!document.querySelector('#citazionePagine .page[data-page-number="2"] .textLayer span')`);
 assert(Math.abs(await larghezza()-originale)<2,'riapertura adattata alla larghezza');
 console.log('Anteprima citazioni: pinch, scroll, Spazio+trascina, tre clic, resize, selezione e riapertura OK');
}

async function provaCitazioniClip(fileNota){
 await c.val(`if(!NOTES.mde.isPreviewActive())NOTES.mde.togglePreview()`);
 const apri=async()=>{
  await c.val(`NOTES.mde.codemirror.setCursor(NOTES.mde.codemirror.lineCount(),0)`);
  const prima=await c.val('NOTES.mde.value()');
  await c.val(`apriMateriali(document.querySelector('#noteHost .ncb-mat'),NOTES)`);await wait(`!!document.getElementById('matZaino')`);
  await c.val(`document.getElementById('matZaino').value='biologia';document.getElementById('matZaino').dispatchEvent(new Event('change',{bubbles:true}))`);
  await wait(`!!document.querySelector('#matLista [data-mat="01 Botanica.pdf"]')`);
  await c.clicca('#matLista [data-mat="01 Botanica.pdf"]');
  await wait(`document.getElementById('citazioneDialog').open&&!!document.querySelector('#citazionePagine .page[data-page-number="1"] .textLayer span')`);
  assert.equal(await c.val('NOTES.mde.value()'),prima,'scegliere il PDF apre l’anteprima senza inserire');
 };
 const ultima=()=>c.val(String.raw`(()=>{const links=[...NOTES.mde.value().matchAll(/\]\((zaino-pdf:[^)]+)\)/g)];return RimandiSintassi.leggi(links.at(-1)[1]);})()`);
 const pagina=async n=>{
  await c.clicca('#citazioneConto');assert(await c.val(`!document.getElementById('citazionePaginaIn').hidden`));
  await c.invia('Input.insertText',{text:String(n)});await c.invia('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await c.invia('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await wait(`document.getElementById('citazioneConto').textContent==='${n} DI 3'`);
 };
 await apri();assert(await c.val(`!document.getElementById('citazioneCitaEstratto')`),'estratto solo nel menu della selezione');
 await c.clicca('#citazioneCitaPdf');await wait(`!document.getElementById('citazioneDialog').open`);
 assert.equal((await ultima()).intero,true);assert(await c.val('NOTES.mde.isPreviewActive()'));
 await apri();await pagina(3);await c.clicca('#citazioneCitaPagina');await wait(`!document.getElementById('citazioneDialog').open`);
 assert.equal((await ultima()).pagina,3);assert(!(await ultima()).intero);
 await apri();await pagina(2);await wait(`!!document.querySelector('#citazionePagine .page[data-page-number="2"] .textLayer span')`);
 await c.val(`(()=>{const n=document.querySelector('#citazionePagine .page[data-page-number="2"] .textLayer span').firstChild,r=document.createRange(),i=n.textContent.indexOf('pagina');r.setStart(n,i);r.setEnd(n,i+6);getSelection().removeAllRanges();getSelection().addRange(r);const b=r.getBoundingClientRect();n.parentElement.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0,clientX:b.x+4,clientY:b.y+4}));})()`);
 await wait(`selBarraAperta()`);await c.clicca('#selBarra [data-az="inserisci-citazione"]');await wait(`!document.getElementById('citazioneDialog').open`);
 const ref=await ultima();assert.equal(ref.pagina,2);assert.equal(ref.selezione.testo,'pagina');
 assert((await c.val('NOTES.mde.value()')).includes('> *pagina*'));
 await c.val(`noteAnteprimaRidisegna(NOTES)`);
 assert(await c.val(`(()=>{const a=[...document.querySelectorAll('#noteHost .editor-preview-active a[data-citazione-zaino]')].at(-1),q=a.closest('blockquote');return !!q?.querySelector('em')&&q.textContent.includes('Botanica.pdf; p. 2')&&!q.textContent.includes('01 Botanica.pdf; p. 2')&&getComputedStyle(q).borderLeftWidth!=='0px';})()`),'testo corsivo, titolo senza numero e link dentro un’unica barra');
 await c.val(`(()=>{const a=[...document.querySelectorAll('#noteHost .editor-preview-active a[data-citazione-zaino]')].at(-1);a.dataset.provaCitazione='1';a.scrollIntoView({block:'center',behavior:'instant'});})()`);
 // Un link inline può avere più rettangoli: il centro del loro inviluppo
 // può cadere fra due righe. Si preme una porzione di testo davvero raggiungibile.
 const puntoLink=await c.val(`(()=>{const a=document.querySelector('[data-prova-citazione]'),r=a.getClientRects()[0];const p={x:r.x+Math.min(30,r.width/2),y:r.y+r.height/2};return {...p,hit:!!document.elementFromPoint(p.x,p.y)?.closest('[data-prova-citazione]')};})()`);
 assert(puntoLink.hit,'testo del rimando raggiungibile prima del clic: '+JSON.stringify(puntoLink));
 for(const type of ['mousePressed','mouseReleased'])await c.invia('Input.dispatchMouseEvent',{type,x:puntoLink.x,y:puntoLink.y,button:'left',clickCount:1});
 await wait(`document.getElementById('citazioneDialog').open&&getSelection().toString()==='pagina'`);
 assert.equal(await c.val(`document.querySelectorAll('#citazionePagine mark').length`),0,'solo selezione, nessuna evidenziatura');
 let shot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/zaino-citazioni-selezione.png',Buffer.from(shot.result.data,'base64'));
 const testo=await c.val('NOTES.mde.value()');await c.clicca('#citazioneVai');await wait(`zainoAttivo()==='biologia'&&!document.getElementById('citazioneTorna').hidden`);
 assert.equal(await c.val(`document.getElementById('citazioneTorna').textContent`),'Torna a Storia');
 await wait(`ANTEPRIMA.file==='01 Botanica.pdf'&&PDFJS.viewer?.currentPageNumber===2&&!!document.querySelector('#pdfFrame .page[data-page-number="2"] .textLayer span')`);
 assert(await c.val(`(()=>{const s=getSelection(),r=s.rangeCount&&s.getRangeAt(0),p=document.querySelector('#pdfFrame .page[data-page-number="2"] .textLayer');return s.toString()==='pagina'&&p.contains(r.startContainer)&&p.contains(r.endContainer);})()`),'Apri zaino di origine seleziona il passaggio nella pagina citata di Fonti');
 shot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/zaino-citazioni-ritorno.png',Buffer.from(shot.result.data,'base64'));
 // Anche se si sta già consultando lo zaino di origine, il rimando prevale
 // sulla pagina corrente senza ricaricare il documento né creare evidenze.
 const evidenze=await c.val('JSON.stringify(EVIDENZE.elenco)'),url=await c.val(`RimandiSintassi.scriviPdfZaino(${q(ref.zainoId)},${q(ref.sourceId)},2,${q(ref.revision)},${q(ref.selezione)})`);
 await c.val(`window.__docOrigine=PDFJS.doc;vaiAPagina(1);citazioneZainoApri(${q(url)})`);
 await wait(`document.getElementById('citazioneDialog').open&&getSelection().toString()==='pagina'&&!!document.querySelector('#citazionePagine .page[data-page-number="2"] .textLayer span')`);
 await c.clicca('#citazioneVai');await wait(`!document.getElementById('citazioneDialog').open&&PDFJS.viewer.currentPageNumber===2&&getSelection().toString()==='pagina'`);
 assert(await c.val(`PDFJS.doc===window.__docOrigine&&document.getElementById('pdfFrame').contains(getSelection().anchorNode)`),'PDF già aperto riusato, selezione nel lettore Fonti');
 assert.equal(await c.val('JSON.stringify(EVIDENZE.elenco)'),evidenze,'richiamo senza sottolineature salvate');await c.val('delete window.__docOrigine');
 await c.clicca('#citazioneTorna');await wait(`zainoAttivo()==='storia'&&NOTES.cur?.file===${q(fileNota)}`);await c.pausa(180);
 assert.equal((await c.val('NOTES.mde.value()')).trimEnd(),testo.trimEnd(),'ritorno conserva appunto e testo');assert(await c.val('NOTES.mde.isPreviewActive()'),'ritorno conserva l’anteprima');
 shot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/zaino-citazioni-blocchi.png',Buffer.from(shot.result.data,'base64'));
 await apri();const primaEsc=await c.val('NOTES.mde.value()');await c.invia('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 await c.invia('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 await wait(`!document.getElementById('citazioneDialog').open`);assert.equal(await c.val('NOTES.mde.value()'),primaEsc,'Esc non inserisce');
 await c.val('noteFlushStato(NOTES)');console.log('Clip: anteprima prima della citazione, pagina diretta, tre modalità, barra unica, selezione ripristinata, Esc e ritorno allo zaino OK');
}

(async()=>{
 await c.collega();await wait(`typeof zainiMenuApri==='function'&&!!zainoAttivo()`);await c.partiPulito();
 const vault=await c.val('window.vault.path');assert(vault.includes('studia-zaino-prova-'));
 let fileCreato,secondoCreato;
 const locale=path.join(vault,'Zaini/storia/MATERIALI/PDF/01 Fonte locale.pdf');
 const letture=['biologia','storia'].map(z=>{const p=path.join(vault,'Zaini',z,'_lettura.json');return [p,fs.existsSync(p)?fs.readFileSync(p):null];});
 const prima=await c.val(`({z:zainoAttivo(),banco:bancoStato(),storage:{...localStorage},tema:document.documentElement.dataset.theme})`);
 const gruppo=path.join(vault,'Zaini/biologia/MATERIALI/PDF/Gruppi/Nuovi'),extra=path.join(gruppo,'03 Aggiunta.pdf');fs.mkdirSync(gruppo,{recursive:true});
 try{
  await c.clicca('#zainoScegli');await wait(`!!document.querySelector('#zainiMenu[open] .zaini-voce')`);
  assert((await c.val(`document.querySelector('[data-zaino-scegli="biologia"] .zaini-conto').textContent`)).includes('2 PDF'));
  await c.val('closePops()');fs.copyFileSync(path.join(vault,'Zaini/biologia/MATERIALI/PDF/01 Botanica.pdf'),extra);
  await c.clicca('#zainoScegli');await wait(`document.querySelector('[data-zaino-scegli="biologia"] .zaini-conto')?.textContent==='3 PDF'`);
  assert.equal(await c.val(`document.querySelector('[data-zaino-scegli="storia"] .zaini-conto').textContent`),'0 PDF');
  assert(await c.val(`parseFloat(getComputedStyle(document.getElementById('zainoScegli')).paddingLeft)>=8`),'area del bottone più larga del titolo');
  await c.clicca('#zainiAlfa');assert.equal(await c.val(`document.getElementById('zainiAlfa').textContent`),'AZ');
  await c.clicca('#zainiData');assert.equal(await c.val(`document.querySelector('#zainiData svg:last-child').dataset.icona`),'chevron-down');
  await c.clicca('#zainiData');assert.equal(await c.val(`document.querySelector('#zainiData svg:last-child').dataset.icona`),'chevron-up');
  for(const tema of ['chiaro','scuro']){await c.val(`document.documentElement.dataset.theme=${q(tema)}`);assert(await c.val(`document.getElementById('zainiMenu').getBoundingClientRect().right<=innerWidth`));}
  await c.val(`document.documentElement.dataset.theme='chiaro'`);
  let shot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/zaino-menu-citazioni.png',Buffer.from(shot.result.data,'base64'));
  await c.clicca('[data-zaino-scegli="biologia"]');
  await c.val(`bancoForma('due-col');bancoAssegna('A','fonte');bancoAssegna('C','appunti');openPdf('01 Botanica.pdf',2,'Botanica',true)`);
  await wait(`!!document.querySelector('#pdfHost .page[data-page-number="2"] .textLayer span')`);
  await c.val(`window.__copiaPrima=navigator.clipboard.writeText;navigator.clipboard.writeText=async t=>{window.__citazioneCopiata=t;};window.__selezionaPdf=()=>{const n=document.querySelector('#pdfHost .page[data-page-number="2"] .textLayer span').firstChild,r=document.createRange();r.selectNodeContents(n);const s=getSelection();s.removeAllRanges();s.addRange(r);return r;};selMenuApri(350,250,{range:window.__selezionaPdf(),testo:'Botanica - pagina 2'});`);
  await c.clicca('#selMenu [data-az="cita-pdf"]');await wait(`window.__citazioneCopiata?.includes('zaino-pdf:')`);
  assert((await c.val('window.__citazioneCopiata')).includes('> *Botanica - pagina 2*'));
  const cita=await c.val(`window.vault.citazioni.crea('biologia','01 Botanica.pdf',2,'Botanica - pagina 2')`);
  assert(cita.markdown?.includes('Biologia › 01 Botanica.pdf · p. 2'),JSON.stringify(cita));
  await c.val(`cambiaZaino('storia',true);bancoForma('due-col');bancoAssegna('A','appunti');bancoAssegna('C','fonte')`);
  fs.copyFileSync(path.join(vault,'Zaini/biologia/MATERIALI/PDF/02 Biologia cellulare.pdf'),locale);
  await c.val(`openPdf('01 Fonte locale.pdf',1,'Fonte locale',true)`);
  await wait(`!!document.querySelector('#pdfHost .page[data-page-number="1"] .textLayer span')`);
  const nota=await c.val(`window.vault.notes.save('storia',null,{title:'Citazione incrociata'},${q(cita.markdown)})`);assert(!nota.error,JSON.stringify(nota));fileCreato=path.join(vault,'Zaini/storia/APPUNTI',nota.file);
  await c.val(`notesReload();noteOpen(${q(nota.file)},NOTES)`);await wait(`NOTES.cur?.file===${q(nota.file)}`);
  // Lo stesso parser usato nell'anteprima e nella stampa deve mantenere il riferimento qualificato.
  const html=await c.val(`renderNoteMd(${q(cita.markdown)})`);assert(html.includes('data-citazione-zaino'));
  await c.val(`window.__linkProva=document.createElement('div');window.__linkProva.innerHTML=${q(html)};document.body.append(window.__linkProva);window.__linkProva.querySelector('a').click();window.__linkProva.remove()`);
  await wait(`document.getElementById('citazioneConto').textContent==='2 DI 3'`);
  assert.equal(await c.val('zainoAttivo()'),'storia');assert.equal(await c.val('NOTES.cur.file'),nota.file);
  await wait(`!!document.querySelector('#citazionePagine .page[data-page-number="2"] canvas')`);
  await wait(`!!document.querySelector('#citazionePagine .page[data-page-number="2"] .textLayer span')`);
  assert((await c.val(`document.getElementById('citazioneTitolo').textContent`)).includes('Biologia'));
  assert.equal(await c.val(`document.getElementById('citazioneCopia')`),null,'niente copia con fonte nella toolbar dell’anteprima');
  assert(await c.val(`document.getElementById('citazioneCitaPagina').parentElement===document.getElementById('citazioneConto').closest('.tbar')`),'citazioni nella stessa toolbar di pagine e zoom');
  assert.equal(await c.val(`document.getElementById('citazioneCitaPagina').textContent`),'Cita la pagina');
  assert.equal(await c.val(`document.getElementById('citazioneCitaEstratto')`),null,'il passaggio si cita dal menu della selezione');
  assert.equal(await c.val(`document.querySelectorAll('#citazioneDialog > .tbar').length`),2,'testata e una sola toolbar');
  assert(await c.val(`!!document.querySelector('#citazionePagine .page[data-page-number="2"] canvas').getBoundingClientRect().height`));
  await provaGestiCitazione(cita.rimando);
  // Opt-in: copia del sistema e gesto Incolla reali, senza il doppio usato dalle altre prove.
  // Il lanciatore locale conserva e ripristina la pasteboard del Mac in memoria.
  if(process.env.STUDIA_PROVA_CLIPBOARD==='1'){
   await c.val(`navigator.clipboard.writeText=window.__copiaPrima;NOTES.mde.codemirror.setCursor(NOTES.mde.codemirror.lineCount(),0);if(!NOTES.mde.isPreviewActive())NOTES.mde.togglePreview();`);
   await c.val(`(()=>{const el=document.querySelector('#citazionePagine .page[data-page-number="2"] .textLayer span'),r=document.createRange();r.selectNodeContents(el);getSelection().removeAllRanges();getSelection().addRange(r);const b=r.getBoundingClientRect();el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0,clientX:b.x+4,clientY:b.y+4}));})()`);
   await wait('selBarraAperta()');await c.clicca('#selBarra [data-az="copia"]');await c.pausa(200);
   assert(await c.val('navigator.clipboard.readText().then(()=>false,()=>true)'), 'la lettura automatica della clipboard resta negata');
   await c.clicca('#citazioneChiudi');await c.clicca('#noteHost .editor-toolbar .preview');
   const primaIncolla=await c.val('NOTES.mde.value()');
   assert(await c.val('NOTES.mde.codemirror.hasFocus()'), 'uscire da Anteprima deve restituire il focus all’editor: '+await c.val('document.activeElement.outerHTML.slice(0,160)'));
   await c.invia('Input.dispatchKeyEvent',{type:'keyDown',modifiers:4,key:'v',code:'KeyV',windowsVirtualKeyCode:86,commands:['paste']});
   await c.invia('Input.dispatchKeyEvent',{type:'keyUp',modifiers:4,key:'v',code:'KeyV',windowsVirtualKeyCode:86});
   await wait(`NOTES.mde.value()!==${q(primaIncolla)}`);
   assert.equal((await c.val('NOTES.mde.value()')).split('Botanica - pagina 2').length,primaIncolla.split('Botanica - pagina 2').length+1,'Copia incolla il solo testo selezionato dopo uscita da anteprima');
   assert.equal((await c.val('NOTES.mde.value()')).split('zaino-pdf:').length,primaIncolla.split('zaino-pdf:').length,'Copia non aggiunge la fonte');
   await c.val(`navigator.clipboard.writeText=async t=>{window.__citazioneCopiata=t;};citazioneZainoApri(${q(cita.rimando)})`);
   await wait(`!!document.querySelector('#citazionePagine .page[data-page-number="2"] .textLayer span')`);
  }
  // Il PDF locale rimane sotto il dialogo: la selezione esterna non può usare il suo menu.
  await c.val(`window.__selezionaCitazione=()=>{const el=document.querySelector('#citazionePagine .page[data-page-number="2"] .textLayer span'),r=document.createRange();r.selectNodeContents(el);getSelection().removeAllRanges();getSelection().addRange(r);const b=r.getBoundingClientRect();el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0,clientX:b.x+4,clientY:b.y+4}));};window.__selezionaCitazione()`);
  await wait(`document.getElementById('selBarra').classList.contains('aperta')`);
  shot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/zaino-citazione-menu.png',Buffer.from(shot.result.data,'base64'));
  const livello=await c.val(`(()=>{const b=document.querySelector('#selBarra .ctx-item'),r=b.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {raggiungibile:!!hit?.closest('#selBarra'),sopra:hit?.outerHTML.slice(0,180),contenitore:document.getElementById('selBarra').parentElement.id};})()`);
  assert(livello.raggiungibile,'Menu della citazione davanti al PDF e cliccabile: '+JSON.stringify(livello));
  assert.deepEqual(await c.val(`[...document.querySelectorAll('#selBarra .ctx-item')].map(b=>b.textContent)`),['Copia','Cita dalla pagina']);
  assert.equal(await c.val(`evSupDaRange(SELMENU.range)`),null,'nessuna annotazione sulla fonte sottostante');
  // Anche senza un PDF sottostante, il tasto destro apre il menu dentro il dialogo.
  await c.val(`closePdf();window.__selezionaCitazione()`);await wait(`selBarraAperta()`);
  const punto=await c.val(`(()=>{const r=getSelection().getRangeAt(0).getBoundingClientRect();return {x:r.x+4,y:r.y+4};})()`);
  for(const type of ['mousePressed','mouseReleased'])await c.invia('Input.dispatchMouseEvent',{type,...punto,button:'right',clickCount:1});
  await wait(`selMenuAperto()`);
  assert.deepEqual(await c.val(`[...document.querySelectorAll('#selMenu .ctx-item')].map(b=>b.textContent)`),['Copia','Cita dalla pagina'],'menu automatico e tasto destro coerenti');
  assert(await c.val(`(()=>{const b=document.querySelector('#selMenu [data-az="copia"]'),r=b.getBoundingClientRect();return !!document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#selMenu');})()`));
  await c.val(`window.__citazioneCopiata=''`);await c.clicca('#selMenu [data-az="copia"]');
  await wait(`window.__citazioneCopiata==='Botanica - pagina 2'`);
  shot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/zaino-citazione-anteprima.png',Buffer.from(shot.result.data,'base64'));
  // Gesto reale dal secondo appunto in anteprima: destinazione stabile, inserimento
  // senza sostituire il testo selezionato e un solo Annulla per tornare all'originale.
  await c.clicca('#citazioneChiudi');
  const primoPrima=await c.val('NOTES.mde.value()'),corpoSecondo='Inizio\n\n'+cita.markdown+'\n\n'+Array.from({length:30},(_,i)=>'Paragrafo di studio '+(i+1)+'.').join('\n\n')+'\n\nFine';
  const seconda=await c.val(`window.vault.notes.save('storia',null,{title:'Appunto di destinazione'},${q(corpoSecondo)})`);
  assert(!seconda.error,JSON.stringify(seconda));secondoCreato=path.join(vault,'Zaini/storia/APPUNTI',seconda.file);
  await c.val(`bancoAssegna('C','appunti2');notesReload();noteOpen(${q(seconda.file)},NOTE_ISTANZE[1])`);await c.pausa(120);
  const secondoPrima=await c.val('NOTE_ISTANZE[1].mde.value()');
  await c.val(`(()=>{const s=NOTE_ISTANZE[1];if(s.mde.isPreviewActive())s.mde.togglePreview();const ultima=s.mde.value().split('\\n').findIndex(r=>r==='Fine');s.mde.codemirror.setSelection({line:ultima,ch:0},{line:ultima,ch:4});s.mde.togglePreview();})()`);
  await wait(`!!document.querySelector('#noteHost2 .editor-preview-active a[data-citazione-zaino]')`);
  await c.clicca('#noteHost2 .editor-preview-active a[data-citazione-zaino]');
  await wait(`!!document.querySelector('#citazionePagine .page[data-page-number="2"] .textLayer span')`);
  await c.val(`noteAttiva(NOTES);window.__selezionaCitazione()`);await wait(`selBarraAperta()`);
  assert((await c.val(`document.querySelector('#selBarra [data-az="inserisci-citazione"]').title`)).includes('Appunto di destinazione'));
  await c.clicca('#selBarra [data-az="inserisci-citazione"]');
  await wait(`!document.getElementById('citazioneDialog').open`);
  const inserito=await c.val('NOTE_ISTANZE[1].mde.value()');
  assert(inserito.includes('Fine\n\n> *Botanica - pagina 2*'),'non sostituisce la selezione precedente: '+inserito.slice(-300));
  assert.equal(inserito.split(cita.rimando).length,3,'testo con origine e pagina corrette');
  await c.pausa(300);
  assert.equal(await c.val('NOTE_ISTANZE[1].mde.isPreviewActive()'),true,'resta in anteprima');
  assert(await c.val(`(()=>{const pv=document.querySelector('#noteHost2 .editor-preview-active'),b=[...pv.querySelectorAll('blockquote')].at(-1),r=b.getBoundingClientRect(),v=pv.getBoundingClientRect();return r.top>=v.top && r.bottom<=v.bottom && document.activeElement===b;})()`),'il nuovo estratto, non quello identico già presente, è visibile e riceve il focus');
  assert.equal(await c.val('NOTES.mde.value()'),primoPrima,'il primo appunto resta intatto');
  assert.equal(await c.val('zainoAttivo()'),'storia');
  shot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/zaino-citazione-inserita.png',Buffer.from(shot.result.data,'base64'));
  await c.val('noteCronologia(NOTE_ISTANZE[1],false)');assert.equal(await c.val('NOTE_ISTANZE[1].mde.value()'),secondoPrima,'un solo Annulla');
  await c.val('noteCronologia(NOTE_ISTANZE[1],true);noteFlushStato(NOTE_ISTANZE[1])');
  assert(fs.readFileSync(secondoCreato,'utf8').includes(inserito.trimEnd()),'inserimento salvato sul disco');

  // La destinazione chiusa mentre il PDF carica non autorizza la scrittura altrove.
  await c.val(`citazioneZainoApri(${q(cita.rimando)},NOTE_ISTANZE[1]);closeEditor(NOTE_ISTANZE[1])`);
  await wait(`!!document.querySelector('#citazionePagine .page[data-page-number="2"] .textLayer span')`);
  await c.val('window.__selezionaCitazione()');await wait('selBarraAperta()');
  assert(await c.val(`document.querySelector('#selBarra [data-az="inserisci-citazione"]').disabled`));
  await c.val('citazioneInserisciDaRange(SELMENU.range)');
  assert((await c.val(`document.getElementById('citazioneStato').textContent`)).includes('destinazione non è più aperto'));
  assert.equal(await c.val('NOTES.mde.value()'),primoPrima);
  await c.clicca('#citazioneDopo');await wait(`document.getElementById('citazioneConto').textContent==='3 DI 3'`);
  // Riapri nello stesso gesto: l'evento close precedente non deve cancellare la nuova richiesta.
  await c.val(`document.getElementById('citazioneChiudi').click();citazioneZainoApri(${q(cita.rimando.replace(/r=[a-f0-9]+/,'r='+'0'.repeat(64)))})`);
  assert.equal(await c.val('zainoAttivo()'),'storia');
  await wait(`document.getElementById('citazioneStato').textContent.includes('La fonte è cambiata')`);
  assert.equal(await c.val(`document.querySelectorAll('#citazioneZoom button[disabled]').length`),3,'zoom disabilitato quando la fonte non è disponibile');
  assert.equal(await c.val(`document.querySelectorAll('#citazionePagine canvas').length`),0);await c.clicca('#citazioneChiudi');
  await wait(`document.getElementById('selBarra').parentElement===document.body&&document.getElementById('selMenu').parentElement===document.body`);
  await provaCitazioniClip(nota.file);
  // Riapertura della citazione dopo rinomina del PDF: identità, non nome o numero.
  const old=path.join(vault,'Zaini/biologia/MATERIALI/PDF/01 Botanica.pdf'),ren=path.join(gruppo,'01 Botanica rinominata.pdf');fs.renameSync(old,ren);
  try{await c.val(`citazioneZainoApri(${q(cita.rimando)})`);await wait(`document.getElementById('citazioneTitolo').textContent.includes('rinominata')`);await c.clicca('#citazioneChiudi');}
  finally{fs.renameSync(ren,old);}
  await c.clicca('#noteClose');
  await provaGesti();
 }finally{
  fs.rmSync(extra,{force:true});
  fs.rmSync(locale,{force:true});
  await c.val(`if(document.getElementById('citazioneDialog').open)document.getElementById('citazioneDialog').close();if(window.__askCross)askText=window.__askCross;if(window.__copiaPrima)navigator.clipboard.writeText=window.__copiaPrima;closePops();localStorage.clear();Object.entries(${q(prima.storage)}).forEach(([k,v])=>localStorage.setItem(k,v));cambiaZaino(${q(prima.z)},true);BANCO.stato=${q(prima.banco)};bancoSalva();bancoDisegna();document.documentElement.dataset.theme=${q(prima.tema)}`);
  if(fileCreato)fs.rmSync(fileCreato,{force:true});
  if(secondoCreato)fs.rmSync(secondoCreato,{force:true});
  await c.val(`closePdf();clearTimeout(LETTURA.timer);LETTURA.timer=null;LETTURA.attesa=null;`);await c.pausa(150);
  for(const [p,b] of letture){if(b)fs.writeFileSync(p,b);else fs.rmSync(p,{force:true});}
  await c.val(`letturaCarica()`);
 }
 console.log('citazioni tra zaini: menu aggiornato, ordine, inserimento e anteprima senza cambio del contesto OK');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
