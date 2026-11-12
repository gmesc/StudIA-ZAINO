'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),c=require('./cdp'),q=JSON.stringify;
async function aspetta(expr){for(let i=0;i<180;i++){if(await c.val(expr))return;await c.pausa(80);}throw Error('Attesa: '+expr);}
async function click(sel){await aspetta(`!!document.querySelector(${q(sel)})`);if(sel.includes('.zaino-palette'))await c.val(`document.querySelector(${q(sel)}).scrollIntoView({block:'nearest'})`);await c.clicca(sel);}
async function traccia(sel,a,b,modifiers=0){const r=await c.val(`(()=>{const r=document.querySelector(${q(sel)}).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};})()`);assert(r.w&&r.h);const p=t=>({x:r.x+t[0]*r.w,y:r.y+t[1]*r.h});await c.invia('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,modifiers,...p(a)});for(let i=1;i<=6;i++)await c.invia('Input.dispatchMouseEvent',{type:'mouseMoved',buttons:1,modifiers,...p([a[0]+(b[0]-a[0])*i/6,a[1]+(b[1]-a[1])*i/6])});await c.invia('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,modifiers,...p(b)});}
async function trascinaManiglia(layer,id,dx,dy,modifiers=0){const r=await c.val(`(()=>{const r=document.querySelector(${q(layer+' [data-maniglia="'+id+'"]')}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);await c.invia('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,modifiers,...r});await c.invia('Input.dispatchMouseEvent',{type:'mouseMoved',buttons:1,modifiers,x:r.x+dx,y:r.y+dy});await c.invia('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,modifiers,x:r.x+dx,y:r.y+dy});}
const doc=()=>c.val(`vault.pdfSegni.leggi('biologia','01 Botanica.pdf')`);
async function salvato(n){await aspetta(`document.querySelector('#pdfPane .pdf-segni-bar output').textContent==='Salvato'`);assert.equal((await doc()).segni.length,n);}
async function tasto(key,code,modifiers=0){await c.invia('Input.dispatchKeyEvent',{type:'keyDown',key,code,modifiers});await c.invia('Input.dispatchKeyEvent',{type:'keyUp',key,code,modifiers});}
(async()=>{
 await c.collega();await aspetta(`typeof bancoStato==='function'&&zainoAttivo()==='biologia'`);assert((await c.val('vault.path')).includes('studia-zaino-prova-'));await c.partiPulito();
 const prima=await c.val(`({banco:bancoStato(),memoria:{...localStorage},vault:vault.path})`),file=path.join(prima.vault,'Zaini/biologia/MATERIALI/PDF/01 Botanica.pdf'),originale=fs.readFileSync(file);
 try{
  await c.val(`bancoForma('due-col');bancoAssegna('A','fonte');bancoAssegna('C','fonte2');openPdf('01 Botanica.pdf',1,'Botanica',true)`);
  await aspetta(`!!document.querySelector('#pdfFrame .textLayer span')&&!document.querySelector('#pdfPane [data-pdf-annota]').disabled`);
  await click('#pdfPane [data-pdf-annota]');await click('#pdfPane [data-tool="freccia"]');
  const layer='#pdfFrame .page[data-page-number="1"] > .pdf-segni';
  await traccia(layer,[.15,.2],[.5,.3]);await salvato(1);let r=await doc();assert.equal(r.segni[0].tipo,'freccia');const iniziale=r.segni[0];
  // Sposta prendendo il tratto a un quarto: al centro ora vive la maniglia di curvatura.
  await traccia(layer,[.2375,.225],[.3375,.275]);await salvato(1);r=await doc();assert.notDeepEqual(r.segni[0].punti,iniziale.punti,'il drag sposta il segno');
  const man=await c.val(`(()=>{const e=document.querySelector(${q(layer+' [data-maniglia="1"]')}),r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await c.invia('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...man});await c.invia('Input.dispatchMouseEvent',{type:'mouseMoved',buttons:1,x:man.x+20,y:man.y+10});await c.invia('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:man.x+20,y:man.y+10});await salvato(1);
  assert.notDeepEqual((await doc()).segni[0].punti,r.segni[0].punti,'la maniglia cambia la forma');
  const primaCurva=(await doc()).segni[0];await trascinaManiglia(layer,'curva',0,-55);await salvato(1);
  assert.deepEqual((await doc()).segni[0].punti,primaCurva.punti,'la maniglia centrale lascia fisse le estremità');assert((await doc()).segni[0].curva);
  assert(await c.val(`document.querySelector(${q(layer+' [data-segno] path')}).getAttribute('d').includes('Q')`),'la curva è visibile');
  await click('.pdf-segni-bubble [data-parametro=bidirezionale]');await click('.pdf-segni-opzioni [data-valore=true]');await salvato(1);assert.equal((await doc()).segni[0].bidirezionale,true);
  await click('.pdf-segni-bubble [data-parametro=colore]');
  assert(await c.val(`!document.querySelector('.zaino-palette button[data-colore="#ffffff"]')&&!document.querySelector('.zaino-palette button[data-colore="#000000"]')`),'la palette Annota non mostra i pulsanti Bianco e Nero');
  assert(await c.val(`!document.querySelector('.zaino-palette [data-pipetta]').textContent.trim()&&!!document.querySelector('.zaino-palette [data-pipetta] svg')`),'la pipetta è una icona con tooltip');
  const paletteShot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/private/tmp/zaino-pdf-palette-icone.png',Buffer.from(paletteShot.result.data,'base64'));
  await click('.zaino-palette button[data-colore="#3b82f6"]');await salvato(1);assert.equal((await doc()).segni[0].colore,'#3b82f6');
  assert(await c.val(`Array.from(document.querySelectorAll('#pdfPane button[data-tool]')).every(b=>!b.textContent.trim()&&b.title.includes(b.getAttribute('aria-keyshortcuts')))`),'gli strumenti hanno icone, tooltip e scorciatoie accessibili');
  for(const punta of ['pallino','aperta','triangolo','t']){
   await click('.pdf-segni-bubble [data-parametro=punta]');assert.equal(await c.val(`document.querySelectorAll('.pdf-segni-opzioni button').length`),4);
   await click('.pdf-segni-opzioni [data-valore="'+punta+'"]');await salvato(1);assert.equal((await doc()).segni[0].punta,punta);
  }
  await click('.pdf-segni-bubble [data-parametro=spessore]');assert.equal(await c.val(`document.querySelectorAll('.pdf-segni-opzioni button svg').length`),4);
  await click('.pdf-segni-opzioni [data-valore="4"]');await salvato(1);assert.equal((await doc()).segni[0].spessore,4);
  for(const colore of ['#ef4444','#f97316','#eab308','#22c55e']){await click('.pdf-segni-bubble [data-parametro=colore]');await click('.zaino-palette button[data-colore="'+colore+'"]');await salvato(1);}
  await click('.pdf-segni-bubble [data-parametro=colore]');
  assert.deepEqual(await c.val(`Array.from(document.querySelectorAll('.zaino-palette [data-recente]')).map(b=>b.dataset.colore)`),['#22c55e','#eab308','#f97316','#ef4444']);
  assert(await c.val(`!!document.querySelector('.zaino-palette').firstElementChild.matches('[data-pipetta]')`));
  // Si prova il raccordo della pipetta senza comandare il selettore nativo del sistema.
  await c.val(`window.pipettaReale=window.EyeDropper;window.EyeDropper=class{async open(){return {sRGBHex:'#0d9488'};}};document.querySelector('.zaino-palette [data-pipetta]').disabled=false`);
  await click('.zaino-palette [data-pipetta]');await salvato(1);assert.equal((await doc()).segni[0].colore,'#0d9488');await c.val(`window.EyeDropper=window.pipettaReale;delete window.pipettaReale`);
  const bubbleShot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/private/tmp/zaino-pdf-bubble.png',Buffer.from(bubbleShot.result.data,'base64'));
  await click('.pdf-segni-bubble-head button');await c.val(`PdfSegniUI.aggiorna()`);await c.pausa(100);
  assert.equal(await c.val(`document.querySelectorAll('.pdf-segni-bubble').length`),0,'chiudere il bubble resta valido dopo il ridisegno');
  await click('#pdfPane [data-tool="rettangolo"]');await click('#pdfPane [data-pdf-preferenze]');
  assert(await c.val(`document.querySelector('.pdf-segni-bubble-head strong').textContent.includes('Stile di disegno')`));await click('.pdf-segni-bubble-head button');
  await traccia(layer,[.15,.35],[.5,.45],8);await salvato(2);
  const rapporto=s=>Math.abs((s.punti[1][0]-s.punti[0][0])/(s.punti[1][1]-s.punti[0][1]));assert(Math.abs(rapporto((await doc()).segni[1])-1)<.01,'Maiusc disegna un quadrato');
  await trascinaManiglia(layer,'1',24,8,8);await salvato(2);assert(Math.abs(rapporto((await doc()).segni[1])-1)<.01,'Maiusc conserva le proporzioni durante il resize');
  for(const forma of ['pentagono','esagono','ottagono','rettangolo','triangolo']){
   await click('.pdf-segni-bubble [data-parametro=forma]');assert.equal(await c.val(`document.querySelectorAll('.pdf-segni-forme button svg').length`),5);
   assert(await c.val(`Array.from(document.querySelectorAll('.pdf-segni-forme button')).every(b=>!b.textContent.trim()&&b.title&&b.getAttribute('aria-label'))`));
   await click('.pdf-segni-forme [data-valore="'+forma+'"]');await salvato(2);assert.equal((await doc()).segni[1].forma,forma);
  }
  const formeShot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/private/tmp/zaino-pdf-forme.png',Buffer.from(formeShot.result.data,'base64'));

  await click('#pdfPane [data-tool="penna"]');await traccia(layer,[.2,.5],[.6,.6]);await salvato(3);
  await click('#pdfPane [data-tool="ellisse"]');await traccia(layer,[.15,.65],[.45,.7]);await salvato(4);
  await c.val(`document.querySelector('#pdfPane .pdf-segni-bar').querySelectorAll('button')[0].focus()`);
  await c.val(`document.querySelector('#pdfPane [data-pdf-annulla]').click()`);await salvato(3);
  await c.val(`document.querySelector('#pdfPane [data-pdf-ripeti]').click()`);await salvato(4);
  await c.val(`fonte2Apri('01 Botanica.pdf')`);await aspetta(`document.querySelectorAll('#pdf2Frame .pdf-segni [data-segno]').length>=4`);
  const primaZoom=await doc();await c.val(`pdfZoomPasso(true);bancoZoom('C')`);await c.pausa(400);await c.val(`bancoZoomTorna()`);await c.pausa(800);
  assert.deepEqual((await doc()).segni,primaZoom.segni,'zoom e layout lasciano le coordinate intatte');
  assert.equal(await c.val(`document.querySelectorAll(${q(layer+' [data-segno]')}).length`),4);
  await click('#pdfPane [data-tool="seleziona"]');
  const bancoPrima=await c.val('bancoStato()');await tasto('Enter','Enter',1);await aspetta(`!!bancoZoomLeggi()`);
  assert(await c.val(`document.querySelector('.blocco[data-blocco="A"] .bhead').title.includes('⌥Invio')`));
  await tasto('Enter','Enter',1);await aspetta(`!bancoZoomLeggi()`);assert.deepEqual(await c.val('bancoStato()'),bancoPrima,'Alt+Invio torna alla stessa disposizione');
  await click('#pdfPane [data-tool="testo"]');
  const pt=await c.val(`(()=>{const r=document.querySelector(${q(layer)}).getBoundingClientRect();return {x:r.x+r.width*.3,y:r.y+r.height*.12};})()`);
  await c.invia('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...pt});await c.invia('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...pt});
  await aspetta(`document.getElementById('uiModal').hasAttribute('open')`);
  await c.val(`document.getElementById('umInput').value='È una nota sul PDF'`);await click('#umOk');await salvato(5);
  assert.equal((await doc()).segni.at(-1).testo,'È una nota sul PDF');
  assert(await c.val(`(()=>{const t=document.querySelector(${q(layer+' text')} ).getBoundingClientRect(),r=document.querySelector(${q(layer+' [data-selezione]')}).getBoundingClientRect();return t.top>=r.top&&t.bottom<=r.bottom&&t.left>=r.left&&t.right<=r.right;})()`),'la selezione contiene davvero tutto il testo');
  const tp=await c.val(`(()=>{const r=document.querySelector(${q(layer+' text')}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  for(const type of ['mousePressed','mouseReleased'])await c.invia('Input.dispatchMouseEvent',{type,button:'left',clickCount:2,...tp});
  await aspetta(`document.getElementById('uiModal').hasAttribute('open')`);await c.val(`document.getElementById('umInput').value='È una nota sul PDF modificata'`);await click('#umOk');await salvato(5);
  await c.val(`document.querySelector(${q(layer)}).focus()`);
  await c.invia('Input.dispatchKeyEvent',{type:'keyDown',key:'Delete',code:'Delete',windowsVirtualKeyCode:46});await salvato(4);
  await c.invia('Input.dispatchKeyEvent',{type:'keyDown',key:'z',code:'KeyZ',modifiers:4,windowsVirtualKeyCode:90});await salvato(5);
  assert.equal((await doc()).segni.at(-1).testo,'È una nota sul PDF modificata');
  await c.val(`document.querySelector('#aspettoFont').value='atkinson';document.querySelector('#aspettoFont').dispatchEvent(new Event('change',{bubbles:true}))`);
  await c.val(`document.fonts.ready`);await c.val(`document.querySelector(${q(layer)}).focus()`);await tasto('n','KeyN');
  assert.equal(await c.val(`document.querySelector('#pdfPane [data-tool=postit]').getAttribute('aria-pressed')`),'true','N seleziona Post-it');
  await traccia(layer,[.35,.18],[.35,.18]);await aspetta(`!!document.querySelector('.pdf-postit-editor[open]')`);
  const primaDialogo=await c.val('bancoStato()');await tasto('Enter','Enter',1);assert.deepEqual(await c.val('bancoStato()'),primaDialogo,'il banco non cambia mentre un dialogo è aperto');
  await tasto('p','KeyP');assert.equal(await c.val(`document.querySelector('#pdfPane [data-tool=postit]').getAttribute('aria-pressed')`),'true','le lettere nel testo non cambiano strumento');
  await c.val(`document.querySelector('.pdf-postit-editor textarea').value=${q('Ricorda la fotosintesi.\nLuce, acqua e anidride carbonica.')}`);await tasto('Enter','Enter',4);await salvato(6);
  assert.equal((await doc()).segni.at(-1).fontUi,'atkinson');assert.equal((await doc()).segni.at(-1).tipo,'postit');
  assert(await c.val(`getComputedStyle(Array.from(document.querySelectorAll(${q(layer+' [data-segno] text')})).at(-1)).fontFamily.includes('Atkinson Hyperlegible')`),'il post-it usa il font scelto anche a schermo');
  const postitShot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/private/tmp/zaino-pdf-postit.png',Buffer.from(postitShot.result.data,'base64'));
  // Export tramite il dialogo nativo della fixture, non una scrittura arbitraria del renderer.
  const out=path.join(path.dirname(prima.vault),'annotato.pdf'),profilo=path.join(path.dirname(prima.vault),'dati');fs.writeFileSync(path.join(profilo,'dialogo-salvataggio.json'),JSON.stringify({canceled:false,filePath:out}));
  const alias=path.join(path.dirname(file),path.basename(file).toUpperCase());
  const stessaFonte=fs.existsSync(alias)&&fs.statSync(alias).dev===fs.statSync(file).dev&&fs.statSync(alias).ino===fs.statSync(file).ino;
  for(const destinazione of [file,...(stessaFonte?[alias]:[])]){
   fs.writeFileSync(path.join(profilo,'dialogo-salvataggio.json'),JSON.stringify({canceled:false,filePath:destinazione}));
   const rifiuto=await c.val(`vault.pdfSegni.esporta('biologia','01 Botanica.pdf')`);
   assert(rifiuto.error?.includes('PDF originale'),'export sulla fonte originale rifiutato anche con grafia diversa: '+JSON.stringify(rifiuto));assert.deepEqual(fs.readFileSync(file),originale);
  }
  if(!stessaFonte)console.log('  skip alias maiuscolo: volume case-sensitive');
  fs.writeFileSync(path.join(profilo,'dialogo-salvataggio.json'),JSON.stringify({canceled:false,filePath:out}));
  const ex=await c.val(`vault.pdfSegni.esporta('biologia','01 Botanica.pdf')`);assert(ex.ok,JSON.stringify(ex));assert(fs.statSync(out).size>originale.length);assert.deepEqual(fs.readFileSync(file),originale);
  const verifica=await c.val(`(async()=>{const {getDocument}=await import('./assets/pdfjs/pdf.min.mjs');const bytes=Uint8Array.from(atob(${q(fs.readFileSync(out).toString('base64'))}),c=>c.charCodeAt(0));const task=getDocument({data:bytes}),pdf=await task.promise;const p=await pdf.getPage(1),txt=await p.getTextContent(),ops=await p.getOperatorList();const vp=p.getViewport({scale:1}),canvas=document.createElement('canvas');canvas.width=vp.width;canvas.height=vp.height;await p.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;const risultato={pagine:pdf.numPages,testo:txt.items.map(i=>i.str).join(' '),operatori:ops.fnArray.length,png:canvas.toDataURL('image/png').split(',')[1]};await task.destroy();return risultato;})()`);assert.equal(verifica.pagine,3);assert(verifica.testo.includes('Botanica'));assert(verifica.testo.includes('È una nota sul PDF'));assert(verifica.operatori>30,'i vettori sono nella copia esportata');
  assert(verifica.testo.includes('Ricorda la fotosintesi.'));assert(verifica.testo.includes('anidride carbonica.'));
  fs.writeFileSync('/private/tmp/zaino-pdf-esportato.png',Buffer.from(verifica.png,'base64'));
  const shot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/private/tmp/zaino-pdf-annotazioni.png',Buffer.from(shot.result.data,'base64'));
  await click('#pdfPane [data-pdf-annota]');assert.equal(await c.val(`getComputedStyle(document.querySelector(${q(layer+' path')})).pointerEvents`),'none','lettura normale senza intercettare la selezione');
  await c.invia('Page.reload');await c.pausa(1000);await aspetta(`typeof bancoStato==='function'&&zainoAttivo()==='biologia'`);
  await c.val(`bancoForma('due-col');bancoAssegna('A','fonte');openPdf('01 Botanica.pdf',1,'Botanica',true)`);
  await aspetta(`document.querySelectorAll(${q(layer+' [data-segno]')}).length===6`);
  assert.equal(await c.val(`document.querySelector(${q(layer+' text')}).textContent`),'È una nota sul PDF modificata','dopo il riavvio del renderer i segni tornano dal disco');
  assert.equal((await doc()).segni[0].bidirezionale,true);assert((await doc()).segni[0].curva);assert.equal((await doc()).segni[1].forma,'triangolo');
  assert.deepEqual(await c.val(`JSON.parse(localStorage.getItem('zaino.pdfsegni.colori'))`),['#0d9488','#22c55e','#eab308','#f97316']);
  console.log('✓ segni PDF: icone, curve, due punte, Maiusc e cinque forme, colori recenti, post-it Atkinson, scorciatoie, due viste, export e riapertura');
 }finally{await c.val(`closePdf();fonte2Chiudi();document.querySelector('#aspettoFont').value=${q(prima.memoria['zaino.aspetto.font']||'zaino')};document.querySelector('#aspettoFont').dispatchEvent(new Event('change',{bubbles:true}));localStorage.clear();Object.entries(${q(prima.memoria)}).forEach(([k,v])=>localStorage.setItem(k,v));BANCO.stato=${q(prima.banco)};bancoDisegna()`);fs.rmSync(path.join(prima.vault,'Zaini/biologia/APPUNTI/_annotazioni-pdf'),{recursive:true,force:true});if(!fs.readFileSync(file).equals(originale))fs.writeFileSync(file,originale);}
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
