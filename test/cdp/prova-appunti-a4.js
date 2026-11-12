'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),c=require('./cdp'),q=JSON.stringify;
async function wait(expr){for(let i=0;i<180;i++){if(await c.val(expr))return;await c.pausa(80);}throw Error('Attesa: '+expr+' '+await c.val('document.body.innerText.slice(-500)'));}
async function shot(nome){fs.writeFileSync('/private/tmp/'+nome+'.png',Buffer.from((await c.invia('Page.captureScreenshot',{format:'png'})).result.data,'base64'));}
async function drag(sel,a,b){const r=await c.val(`(()=>{const r=document.querySelector(${q(sel)}).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};})()`),p=t=>({x:r.x+t[0]*r.w,y:r.y+t[1]*r.h});await c.invia('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...p(a)});for(let i=1;i<=5;i++)await c.invia('Input.dispatchMouseEvent',{type:'mouseMoved',buttons:1,...p([a[0]+(b[0]-a[0])*i/5,a[1]+(b[1]-a[1])*i/5])});const live=await c.val(`document.querySelector(${q(sel)}).getBoundingClientRect().toJSON()`);await c.invia('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p(b)});return live;}
const pronto="!!document.querySelector('#noteHost .note-a4-paper')&&document.querySelector('#noteHost .note-a4').getAttribute('aria-busy')!=='true'";
async function misure(){return c.val(`(()=>{const p=document.querySelector('#noteHost .note-a4-paper'),f=p.querySelector('.note-a4-flow'),r=p.getBoundingClientRect(),k=r.width/parseFloat(getComputedStyle(p).width);const items=[...f.querySelectorAll('h3,p,li,th,td')].map(e=>{const b=e.getClientRects()[0]||e.getBoundingClientRect();return {t:e.textContent,x:(b.x-r.x)/k,y:(b.y-r.y)/k,w:b.width/k,h:b.height/k};});return {pagina:p.dataset.pagina,items,numero:document.querySelector('#noteHost .note-a4-nav input').max,zoom:k};})()`);}
(async()=>{
 await c.collega();await wait("typeof AppuntiA4!=='undefined'&&zainoAttivo()==='biologia'");await c.partiPulito();const vault=await c.val('vault.path');A(vault.includes('studia-zaino-prova-'));
 const marker=path.join(path.dirname(vault),'dati/dialogo-salvataggio.json'),stato=await c.val('({banco:bancoStato(),attivo:BANCO.attivo,storage:{...localStorage}})');let file,secondo,album;
 try{
  album=await c.val(`(()=>{const t=document.createElement('canvas');t.width=160;t.height=40;const ctx=t.getContext('2d');ctx.fillStyle='#f97316';ctx.fillRect(0,0,160,40);const r=window.vault.album.salva('biologia',{origine:'foto',materiale:'campione-a4.png',didascalia:'Campione A4',dati:t.toDataURL('image/png')});if(r.error)throw Error(r.error);return r.voce.id;})()`);
  const testo='# Il sistema solare\n\nTesto introduttivo con **grassetto**, *corsivo* e [un collegamento](https://example.org).\n\n- primo pianeta\n- secondo pianeta\n\n> [!nota] Osserva\n> Un riquadro che conserva il colore.\n\n| Pianeta | Diametro |\n| --- | --- |\n| Terra | 12 742 km |\n| Marte | 6 779 km |\n\n![Campione|30%](album:'+album+')\n\n'+Array.from({length:38},(_,i)=>'Paragrafo '+(i+1)+'. '+('Gli studenti osservano il cielo e descrivono le orbite dei pianeti. ').repeat(4)).join('\n\n');
  file=await c.val(`(()=>{const n=notesApi().save('biologia',null,{title:'Prova A4'},${q(testo)});notesReload();bancoForma('uno');bancoAssegna('A','appunti');noteOpen(n.file,NOTES);return n.file;})()`);await wait('!!NOTES.mde&&!!NOTES.cur');
  const original=await c.val('NOTES.mde.value()');await c.clicca('#noteHost [data-note-vista=a4]');await wait(pronto);A.equal(await c.val('NOTES.mde.value()'),original,'cambio vista non riscrive il Markdown');let prima=await misure();A(+prima.numero>2,'testo su più pagine');await shot('zaino-a4-intero');
  A(await c.val("(()=>{const g=document.querySelector('#noteHost .editor-toolbar .notectl-fine .note-viste');return g&&g.querySelectorAll('button').length===2&&[...g.querySelectorAll('button')].every(b=>b.querySelector('svg')&&!b.textContent.trim()&&b.getAttribute('aria-label'));})()"),'due icone con tooltip nel gruppo destro della toolbar');
  await c.invia('Input.dispatchKeyEvent',{type:'keyDown',key:'j',code:'KeyJ',modifiers:4,windowsVirtualKeyCode:74});A.equal(await c.val('AppuntiA4.attiva(NOTES)'),false);
  await c.invia('Input.dispatchKeyEvent',{type:'keyDown',key:'j',code:'KeyJ',modifiers:4,windowsVirtualKeyCode:74});await wait(pronto);A(await c.val('AppuntiA4.attiva(NOTES)'),'Anteprima da tastiera mostra A4');
  for(const forma of ['due-col','quattro']){
   await c.val(`bancoForma(${q(forma)})`);await c.pausa(220);const dopo=await misure();A.equal(dopo.numero,prima.numero);A.equal(dopo.items.length,prima.items.length);dopo.items.forEach((e,i)=>{for(const k of ['x','y','w','h'])A(Math.abs(e[k]-prima.items[i][k])<.2,'misura invariata '+forma+' '+i+' '+k);});
  }
  await shot('zaino-a4-banchi');await c.val("bancoZoom(bancoBloccoDi('appunti'))");await c.pausa(180);const intero=await misure();A.equal(intero.numero,prima.numero);await c.val('bancoZoomTorna()');await c.val("bancoForma('uno');bancoAssegna('A','appunti')");await c.pausa(150);
  await c.clicca('#noteHost .ncb-disegno');await wait("!!document.querySelector('#noteHost .note-annota-foglio svg')");A(await c.val("document.querySelector('.note-annota .note-a4-paper').textContent.includes('sistema solare')"),'testo sotto la tela A4');
  A(await c.val("AppuntiA4.documento(NOTES).then(()=>false,e=>/Applica o annulla/.test(e.message))"),'una bozza di disegno non può sparire silenziosamente dall’export');
  await c.clicca('#noteHost .note-annota-bar [data-tool=freccia]');await drag('#noteHost .note-annota-foglio svg',[.2,.16],[.7,.24]);await c.clicca('.pdf-segni-bubble-head button');await shot('zaino-a4-annota');await c.clicca('#noteHost [data-applica-disegno]');await wait("!document.querySelector('#noteHost .note-annota')");await wait(pronto);
  const md=await c.val('NOTES.mde.value()');A(md.includes('"a4":'));A(md.includes('"pagina":1'));A.equal(await c.val("document.querySelector('#noteHost .note-a4-nav input').max"),prima.numero,'disegno sovrapposto non sposta i paragrafi');
  const figura='#noteHost .note-a4-figure img';await wait(`document.querySelector(${q(figura)})?.naturalWidth>0`);
  const live=await drag(figura,[.45,.20],[.5,.23]);await wait(pronto);const finale=await c.val(`document.querySelector(${q(figura)}).getBoundingClientRect().toJSON()`);A(Math.abs(live.x-finale.x)<1&&Math.abs(live.y-finale.y)<1,'la figura non salta al rilascio del drag');A.notEqual(await c.val('NOTES.mde.value()'),md,'il drag cambia le coordinate fisiche');
  const xPrima=await c.val("AppuntiFigure.leggi(NOTES.mde.value().split('\\n'),0).style.a4.x");
  await c.val(`AppuntiFigureUI.posiziona(document.querySelector(${q(figura)}))`);
  for(let i=0;i<3;i++)await c.invia('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
  await wait(pronto);const xDopo=await c.val("AppuntiFigure.leggi(NOTES.mde.value().split('\\n'),0).style.a4.x");A(xDopo-xPrima>.7&&xDopo-xPrima<.9,'le frecce ripetute si accumulano anche durante il ridisegno');
  A(await c.val("(()=>{const h=document.querySelector('.note-figure-posizione'),i=document.querySelector('#noteHost .note-a4-figure img');return document.activeElement===h&&Math.abs(h.getBoundingClientRect().x-AppuntiFigureUI.rettangolo(i).x)<1;})()"),'selezione e focus seguono la figura ridisegnata');
  await c.invia('Input.dispatchKeyEvent',{type:'keyDown',key:'z',code:'KeyZ',modifiers:4,windowsVirtualKeyCode:90});await wait(pronto);
  A((await c.val("AppuntiFigure.leggi(NOTES.mde.value().split('\\n'),0).style.a4.x"))<xDopo,'Cmd Z annulla lo spostamento selezionato');
  await c.invia('Input.dispatchKeyEvent',{type:'keyDown',key:'Z',code:'KeyZ',modifiers:12,windowsVirtualKeyCode:90});await wait(pronto);
  A.equal(await c.val("AppuntiFigure.leggi(NOTES.mde.value().split('\\n'),0).style.a4.x"),xDopo,'Cmd Shift Z ripristina lo spostamento');
  fs.writeFileSync(marker,JSON.stringify({filePath:'/private/tmp/zaino-prova-a4.pdf'}));A.equal(await c.val("salvaPdf('appunto',NOTES)"),'/private/tmp/zaino-prova-a4.pdf');
  const pdf=await require('pdf-lib').PDFDocument.load(fs.readFileSync('/private/tmp/zaino-prova-a4.pdf'));A.equal(pdf.getPageCount(),+prima.numero,'numero pagine del PDF identico alla vista');
  // Confronto reale del PDF: posizioni delle righe e disegno, non solo il DOM.
  const datiPdf=await c.val(`(async()=>{pdfjsAvvia();const task=pdfjsLib.getDocument({data:Uint8Array.from(atob(${q(fs.readFileSync('/private/tmp/zaino-prova-a4.pdf').toString('base64'))}),c=>c.charCodeAt(0))}),pdf=await task.promise;const pagine=[];for(let n=1;n<=pdf.numPages;n++){const p=await pdf.getPage(n),t=await p.getTextContent();pagine.push(t.items.filter(i=>i.str).map(i=>({t:i.str,x:i.transform[4],y:p.view[3]-i.transform[5],h:i.height})));}await task.destroy();return pagine;})()`);
  const primaPdf=datiPdf[0].filter(i=>i.t.startsWith('Paragrafo '));A(primaPdf.length>=3);const mis=await misure(),par=mis.items.filter(i=>i.t.startsWith('Paragrafo '));
  for(let i=1;i<primaPdf.length;i++){A(Math.abs((par[i].y-par[0].y)*.75-(primaPdf[i].y-primaPdf[0].y))<.85,'PDF mantiene gli intervalli verticali '+JSON.stringify({i,dom:(par[i].y-par[0].y)*.75,pdf:primaPdf[i].y-primaPdf[0].y}));A(Math.abs(par[i].x*.75-primaPdf[i].x)<.5,'PDF mantiene il margine sinistro');}
  for(let n=1;n<=38;n++)A.equal(datiPdf.flat().filter(i=>i.t.startsWith('Paragrafo '+n+'.')).length,1,'nessun paragrafo perso o duplicato: '+n);
  A.equal((datiPdf.flat().map(i=>i.t).join(' ').match(/Gli\s+studenti/g)||[]).length,38*4,'tutte le righe del testo sono presenti nel PDF');
  A(datiPdf.every((items,i)=>items.some(t=>t.t==='pagina '+(i+1)+' di '+prima.numero)),'footer su tutte le pagine');
  await c.invia('Emulation.setDeviceMetricsOverride',{width:1320,height:1500,deviceScaleFactor:1,mobile:false});await c.pausa(180);
  await c.val("document.querySelector('#noteHost .note-a4').scrollTop=0;AppuntiFigureUI.chiudi()");
  const rett=await c.val("(()=>{const r=document.querySelector('#noteHost .note-a4-paper').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1};})()");
  fs.writeFileSync('/private/tmp/zaino-a4-carta-schermo.png',Buffer.from((await c.invia('Page.captureScreenshot',{format:'png',clip:rett,captureBeyondViewport:true})).result.data,'base64'));
  fs.writeFileSync('/private/tmp/zaino-a4-geometria.json',JSON.stringify({schermo:mis,pdf:datiPdf,rett},null,2));
  await c.invia('Emulation.clearDeviceMetricsOverride');
  await c.val('AppuntiA4.pagina(NOTES,1)');A.equal(await c.val("document.querySelector('#noteHost .note-a4-paper').dataset.pagina"),'2');await shot('zaino-a4-pagina2');
  await c.clicca('#noteHost [data-note-vista=scrittura]');A.equal(await c.val('AppuntiA4.attiva(NOTES)'),false);A(await c.val("getComputedStyle(NOTES.mde.codemirror.getWrapperElement()).display!=='none'"));
  fs.writeFileSync(marker,JSON.stringify({filePath:'/private/tmp/zaino-prova-a4-scrittura.pdf'}));A.equal(await c.val("salvaPdf('appunto',NOTES)"),'/private/tmp/zaino-prova-a4-scrittura.pdf');
  A.equal((await require('pdf-lib').PDFDocument.load(fs.readFileSync('/private/tmp/zaino-prova-a4-scrittura.pdf'))).getPageCount(),pdf.getPageCount());
  // La posizione sopravvive al salvataggio e alla riapertura del file.
  const coordinate=await c.val("AppuntiFigure.leggi(NOTES.mde.value().split('\\n'),0).style.a4");
  await c.val(`noteFlushStato(NOTES);closeEditor(NOTES);notesReload();noteOpen(${q(file)},NOTES);AppuntiA4.scegli(NOTES,'a4')`);await wait(pronto);
  A.deepEqual(await c.val("AppuntiFigure.leggi(NOTES.mde.value().split('\\n'),0).style.a4"),coordinate);
  // Le due viste sono indipendenti per banco.
  secondo=await c.val(`(()=>{const n=notesApi().save('biologia',null,{title:'Secondo foglio A4'},'Solo il secondo documento.');notesReload();bancoForma('due-col');bancoAssegna('A','appunti');bancoAssegna('C','appunti2');noteOpen(n.file,noteStati()[1]);return n.file;})()`);
  A.equal(await c.val('AppuntiA4.attiva(noteStati()[1])'),false);A.equal(await c.val('AppuntiA4.attiva(NOTES)'),true);
  await c.val("AppuntiA4.scegli(noteStati()[1],'a4')");await wait("document.querySelector('#noteHost2 .note-a4-paper')&&document.querySelector('#noteHost2 .note-a4').getAttribute('aria-busy')!=='true'");
  A.equal(await c.val("document.querySelector('#noteHost2 .note-a4-nav input').max"),'1');A.equal(await c.val("document.querySelector('#noteHost .note-a4-nav input').max"),prima.numero);
  A(await c.val("document.querySelector('#noteHost2 .note-a4-paper').textContent.includes('Solo il secondo documento.')"));
  // Clic sul testo A4 non apre riquadri. Doppio clic torna alla Scrittura.
  const punto=await c.clicca('#noteHost2 .note-a4-flow p');A.equal(await c.val("document.querySelectorAll('#noteHost2 .mdb-edit').length"),0);
  for(const type of ['mousePressed','mouseReleased'])await c.invia('Input.dispatchMouseEvent',{type,button:'left',clickCount:2,...punto});
  A.equal(await c.val('AppuntiA4.attiva(noteStati()[1])'),false);A(await c.val('noteStati()[1].mde.codemirror.hasFocus()'));
  console.log('✓ APPUNTI: due viste, pagina fissa in 1/2 e 1/4 banco, ritorno fullscreen, disegno sopra il testo, drag in mm ed export PDF condiviso');
 }finally{await c.invia('Emulation.clearDeviceMetricsOverride');await c.val("AppuntiAnnotaUI.chiudi(NOTES);AppuntiFigureUI.chiudi();noteStati().filter(s=>s.mde).forEach(s=>AppuntiA4.scegli(s,'scrittura'));noteMolla()");for(const f of [file,secondo].filter(Boolean))require('../../lib/appunti').remove(vault,'biologia',f);if(album){const r=require('../../lib/album').rimuovi(vault,'biologia',album);A(r.tolto,r.error);}if(fs.existsSync(marker))fs.unlinkSync(marker);await c.val(`localStorage.clear();for(const[k,v]of Object.entries(${q(stato.storage)}))localStorage.setItem(k,v);BANCO.stato=${q(stato.banco)};BANCO.attivo=${q(stato.attivo)};bancoDisegna();notesReload()`);c.ws().close();}
})().catch(e=>{console.error(e);c.ws()?.close();process.exitCode=1;});
