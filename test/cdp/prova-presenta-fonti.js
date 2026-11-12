'use strict';
// Solo vault sintetico: keyword e ritaglio reali, menu, PDF e ripresa dei timer.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),WS=require('ws'),c=require('./cdp'),M=require('../../App/assets/presentazioni/modello');
const q=JSON.stringify,clients=[];
async function aspetta(expr,client=c){for(let i=0;i<180;i++){if(await client.val(expr))return;await c.pausa(70);}throw Error('Attesa: '+expr);}
async function collega(t){const ws=new WS(t.webSocketDebuggerUrl,{perMessageDeflate:false});await new Promise((ok,ko)=>{ws.on('open',ok);ws.on('error',ko);});let id=0;const pending=new Map();ws.on('message',b=>{const m=JSON.parse(b);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}});const invia=(method,params={})=>new Promise(ok=>{pending.set(++id,ok);ws.send(JSON.stringify({id,method,params}));});const client={ws,invia,val:async expression=>{const r=await invia('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.result?.exceptionDetails)throw Error(JSON.stringify(r.result.exceptionDetails));return r.result.result.value;}};clients.push(client);await invia('Emulation.setFocusEmulationEnabled',{enabled:true});return client;}
async function targets(){return (await fetch('http://localhost:'+(process.env.STUDIA_PORTA||8999)+'/json')).json();}
async function clicca(sel,client=c){const p=await client.val(`(()=>{const e=document.querySelector(${q(sel)}),r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);for(const type of ['mousePressed','mouseReleased'])await client.invia('Input.dispatchMouseEvent',{type,...p,button:'left',clickCount:1});}
async function tasto(key,client){for(const type of ['keyDown','keyUp'])await client.invia('Input.dispatchKeyEvent',{type,key,code:key===' '?'Space':key,text:type==='keyDown'&&key===' '?' ':undefined,windowsVirtualKeyCode:({Escape:27,Enter:13,' ':32})[key]||39});}
async function menu(id,client){await client.val(`(()=>{const b=document.querySelector('[data-block-id="${id}"]'),r=b.getBoundingClientRect();b.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+20,clientY:r.top+20}));})()`);}
async function testata(client,dialog,titolo,chiudi,origine,file){
 const atteso=require('../../App/assets/fonti/nomi').titoloAnteprima(origine,file);
 const misura=await client.val(`(()=>{const d=document.querySelector(${q(dialog)}),t=document.querySelector(${q(titolo)}),b=document.querySelector(${q(chiudi)}),stile=getComputedStyle(t),r=t.getBoundingClientRect(),x=b.getBoundingClientRect();return {testo:t.textContent,completo:t.title,accessibile:t.getAttribute('aria-label'),chiudi:b.textContent.trim(),svg:!!b.querySelector('svg.ui-icon'),nowrap:stile.whiteSpace,tagliato:t.scrollWidth>t.clientWidth,font:stile.fontSize,token:getComputedStyle(document.documentElement).getPropertyValue('--tb-fs').trim()||'11px',riga:d.firstElementChild.getBoundingClientRect().height,sovrapposto:r.right>x.left+1};})()`);
 assert.equal(misura.testo,atteso.testo);assert.equal(misura.completo,atteso.completo);assert.equal(misura.accessibile,atteso.completo);
 assert(!misura.tagliato,'i nomi abbreviati usano tutta la riga disponibile');assert.equal(misura.chiudi,'','chiusura con la sola X');assert(misura.svg);assert.equal(misura.nowrap,'nowrap');assert.equal(misura.font,misura.token);assert(!misura.sovrapposto&&misura.riga<48,'testata su una riga senza coprire la X');
}
(async()=>{
 await c.collega();await aspetta(`!!window.ZainoPresenta&&zainoAttivo()==='biologia'`);const vault=await c.val('vault.path');assert(vault.includes('studia-zaino-prova-'));await c.partiPulito();
 const prima=await c.val(`({banco:bancoStato(),attivo:BANCO.attivo,storage:{...localStorage},presentaId:ZainoPresenta.documento?.id,evidenze:vault.evidenze.leggi('biologia').evidenze})`);
 let id,immagine,spostato,altraFonte;const call=o=>c.val(`vault.presentazioni.comando(${q({corso:'biologia',...o})})`),regia=async()=>{const r=await call({azione:'regia'});assert(r.ok,r.error);return r.regia.stato;};
 try{
  const kw=await c.val(`(()=>{const r=vault.evidenze.aggiungi('biologia',{exact:'Botanica',prefix:'',suffix:'',materiale:'01 Botanica.pdf',pagina:2,colore:'#ffd966'});if(r.error)throw Error(r.error);return r.evidenze.find(e=>e.exact==='Botanica').id;})()`);
  immagine=await c.val(`(()=>{const cv=document.createElement('canvas');cv.width=180;cv.height=100;cv.getContext('2d').fillRect(0,0,180,100);const r=vault.album.salva('biologia',{origine:'ritaglio',materiale:'01 Botanica.pdf',pagina:1,rect:{x:0,y:0,w:180,h:100},didascalia:'Botanica ritagliata',dati:cv.toDataURL()});if(r.error)throw Error(r.error);return r.voce.id;})()`);
  const nuovo=await call({azione:'crea',title:'Fonti durante la lezione'});assert(nuovo.ok,nuovo.error);let d=nuovo.documento;id=d.id;const sid=d.stacks[0].slides[0].id;
  for(const [tipo,id]of [['keyword',kw],['album',immagine]]){const r=await call({azione:'materiale',id:d.id,baseRevision:d.revision,trasporto:{tipo,id,corso:'biologia'}});assert(r.ok,r.error);d=M.applica(d,{tipo:'inserisciBlocco',slideId:sid,...r});}
  const [parola,ritaglio]=d.stacks[0].slides[0].blocks;assert(parola.source.link.startsWith('zaino-pdf:'));assert(ritaglio.source.link.startsWith('zaino-pdf:'));
  // Riferimenti già presenti nella guida: keyword locale e ritaglio con origine file.
  parola.source.link='pdf:01#p=2';ritaglio.source={kind:'file',id:'01 Botanica.pdf',title:'Botanica',link:'pdf:0001#p=1',page:1};
  d=M.applica(d,{tipo:'posizionaBlocchi',slideId:sid,boxes:[{id:parola.id,box:{x:10,y:10,width:75,height:25}},{id:ritaglio.id,box:{x:10,y:45,width:45,height:40}}]});
  d=M.applica(d,{tipo:'animazioni',slideId:sid,animations:[{targetId:parola.id,effect:'grow',step:1,duration:10}]});d.stacks[0].slides[0].notes.markdown='NOTE_PRIVATE_DA_NON_TRASMETTERE';
  d=M.applica(d,{tipo:'aggiungiSlide',slideId:sid,direzione:'destra'});
  const seconda=d.stacks[1].slides[0].id;d=M.applica(d,{tipo:'inserisciBlocco',slideId:seconda,block:{type:'image',slot:'media',assetId:ritaglio.assetId,alt:'Ritaglio nella seconda slide',source:ritaglio.source}});
  const ritaglioSeconda=d.stacks[1].slides[0].blocks.find(b=>b.type==='image');
  const salvato=await call({azione:'salva',documento:d,baseRevision:d.revision});assert(salvato.ok,salvato.error);d=salvato.documento;
  await c.val(`bancoForma('due-col');bancoAssegna('A','presenta');bancoAssegna('C','gobbo');ZainoPresenta.apri(${q(id)})`);await aspetta(`document.querySelector('.presenta-slide-mini[aria-pressed=true]')`);
  let frame;for(let i=0;i<100&&!frame;i++){const t=(await targets()).find(t=>t.type==='iframe'&&t.url.includes('/presentazioni-player/index.html'));if(t)frame=await collega(t);else await c.pausa(70);}assert(frame);await aspetta(`document.querySelector('.reveal').dataset.modificaPronta==='true'`,frame);
  const bancoPrima=await c.val('JSON.stringify(bancoStato())');await menu(parola.id,frame);await aspetta(`!!document.querySelector('.presenta-bubble:popover-open [aria-label="Apri fonte"]')`);await clicca('.presenta-bubble:popover-open [aria-label="Apri fonte"]');
  await aspetta(`document.querySelector('#citazioneDialog').open&&document.querySelector('#citazioneConto').textContent==='2 DI 3'&&!!document.querySelector('#citazionePagine .page[data-page-number="2"] canvas')`);
  assert.equal(await c.val('JSON.stringify(bancoStato())'),bancoPrima);assert.equal(await c.val('zainoAttivo()'),'biologia');assert(await c.val(`document.querySelector('#citazioneCitaPdf').hidden&&document.querySelector('#citazioneVai').hidden`));await clicca('#citazioneChiudi');
  // La stessa clip degli Appunti sceglie una fonte; annullare non crea oggetti.
  const clip='#presentaPane [aria-label="Inserisci collegamento a una fonte"]';
  await clicca(clip);await aspetta(`!!document.querySelector('#matPop[open] .mat-voce[data-mat="01 Botanica.pdf"]')`);
  assert(await c.val(`[...document.querySelectorAll('#matLista .mat-voce')].every(b=>b.dataset.tipo==='pdf')`));
  await clicca('#matLista [data-mat="01 Botanica.pdf"]');await aspetta(`document.querySelector('#citazioneDialog').open&&!document.querySelector('#citazioneCitaPagina').disabled`);
  assert.equal(await c.val(`document.querySelector('#citazioneCitaPagina').textContent`),'Collega pagina');await clicca('#citazioneChiudi');
  assert.equal(await c.val('ZainoPresenta.documento.stacks[0].slides[0].blocks.length'),d.stacks[0].slides[0].blocks.length);
  // Collegare l’intero PDF di un altro zaino mantiene quello di lavoro e si annulla.
  altraFonte=path.join(vault,'Zaini/storia/MATERIALI/PDF/03 FLOW_Manuale_Fidelity_MONITORING_Implementation_Guide_IT_v2.0_REV.pdf');fs.mkdirSync(path.dirname(altraFonte),{recursive:true});fs.copyFileSync(path.join(vault,'Zaini/biologia/MATERIALI/PDF/01 Botanica.pdf'),altraFonte);
  await clicca(clip);await c.val(`document.querySelector('#matZaino').value='storia';document.querySelector('#matZaino').dispatchEvent(new Event('change',{bubbles:true}))`);await aspetta(`!!document.querySelector('#matPop[open] .mat-voce[data-mat="03 FLOW_Manuale_Fidelity_MONITORING_Implementation_Guide_IT_v2.0_REV.pdf"]')`);await clicca('#matLista [data-mat="03 FLOW_Manuale_Fidelity_MONITORING_Implementation_Guide_IT_v2.0_REV.pdf"]');
  await aspetta(`document.querySelector('#citazioneDialog').open&&!document.querySelector('#citazioneCitaPdf').disabled`);assert.equal(await c.val(`document.querySelector('#citazioneCitaPdf').textContent`),'Collega PDF');
  await c.val(`document.querySelector('#citazioneDialog').style.width='390px'`);await c.pausa(150);
  await testata(c,'#citazioneDialog','#citazioneTitolo','#citazioneChiudi','Storia',path.basename(altraFonte));
  fs.writeFileSync('/private/tmp/zaino-anteprima-fonte-testata.png',Buffer.from((await c.invia('Page.captureScreenshot',{format:'png'})).result.data,'base64'));
  await c.val(`document.querySelector('#citazioneDialog').style.width=''`);await clicca('#citazioneCitaPdf');
  await aspetta(`!document.querySelector('#citazioneDialog').open&&ZainoPresenta.documento.stacks[0].slides[0].blocks.some(b=>b.source?.kind==='pdf')`);assert(await c.val(`RimandiSintassi.leggi(ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.source?.kind==='pdf').source.link).intero`));assert.equal(await c.val('zainoAttivo()'),'biologia');
  await clicca('#presentaPane [aria-label="Annulla nella presentazione"]');await aspetta(`!ZainoPresenta.documento.stacks[0].slides[0].blocks.some(b=>b.source?.kind==='pdf')`);
  await clicca(clip);await aspetta(`!!document.querySelector('#matPop[open] .mat-voce[data-mat="01 Botanica.pdf"]')`);await clicca('#matLista [data-mat="01 Botanica.pdf"]');
  await aspetta(`document.querySelector('#citazioneDialog').open&&!document.querySelector('#citazioneCitaPagina').disabled`);await clicca('#citazioneDopo');await aspetta(`document.querySelector('#citazioneConto').textContent==='2 DI 3'`);await clicca('#citazioneCitaPagina');
  await aspetta(`!document.querySelector('#citazioneDialog').open&&ZainoPresenta.documento.stacks[0].slides[0].blocks.some(b=>b.source?.kind==='pdf')`);
  const diretto=await c.val(`ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.source?.kind==='pdf')`);assert(diretto.richText[0].text.endsWith(' · p. 2'));assert.equal(await c.val('zainoAttivo()'),'biologia');
  await c.val(`ZainoPresenta.modifica({tipo:'posizionaBlocchi',slideId:${q(sid)},boxes:ZainoPresenta.documento.stacks[0].slides[0].blocks.map(b=>({id:b.id,box:b.id===${q(diretto.id)}?{x:60,y:65,width:35,height:20}:b.style.box}))});ZainoPresenta.flush()`);d=await c.val('ZainoPresenta.documento');assert.deepEqual((await call({azione:'apri',id})).documento.stacks[0].slides[0].blocks.find(b=>b.id===diretto.id).source,diretto.source);
  await aspetta(`!!document.querySelector('[data-block-id="${diretto.id}"] .presenta-link-fonte')&&document.querySelector('.reveal').dataset.modificaPronta==='true'`,frame);
  const schermo=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/private/tmp/presenta-clip-editor.png',Buffer.from(schermo.result.data,'base64'));
  await clicca(`[data-block-id="${diretto.id}"] .presenta-link-fonte`,frame);await aspetta(`document.querySelector('#citazioneDialog').open&&document.querySelector('#citazioneConto').textContent==='2 DI 3'`);await clicca('#citazioneChiudi');
  await frame.val(`document.querySelector('[data-block-id="${diretto.id}"] .presenta-link-fonte').focus()`);await tasto('Enter',frame);await aspetta(`document.querySelector('#citazioneDialog').open&&document.querySelector('#citazioneConto').textContent==='2 DI 3'`);await clicca('#citazioneChiudi');
  // Durante la scrittura del nome il link non intercetta Spazio o i clic.
  await c.val(`document.querySelector('#presentaPane [aria-label="Scrivi sul foglio"]').scrollIntoView({block:'center',behavior:'instant'})`);await clicca('#presentaPane [aria-label="Scrivi sul foglio"]');await aspetta(`!!document.querySelector('.presenta-link-fonte [contenteditable=true]')`,frame);
  await tasto(' ',frame);assert.equal(await c.val(`document.querySelector('#citazioneDialog').open`),false);assert(await frame.val(`document.querySelector('[contenteditable=true]').textContent.endsWith(' ')`));await tasto('Escape',frame);await aspetta(`!document.querySelector('[contenteditable=true]')`,frame);await c.val('ZainoPresenta.flush()');d=await c.val('ZainoPresenta.documento');
  const p=await call({azione:'presenta',id,baseRevision:d.revision});assert(p.ok,p.error);
  const t=(await targets()).find(t=>t.type==='page'&&t.url.endsWith('/presentazioni-player/index.html'));assert(t);const pubblico=await collega(t);await aspetta(`document.querySelector('.reveal').dataset.pronto==='true'`,pubblico);
  assert(!await pubblico.val(`document.documentElement.outerHTML.includes('NOTE_PRIVATE_DA_NON_TRASMETTERE')`));assert.equal(await pubblico.val(`typeof vault`),'undefined');
  const avanza=await call({azione:'sessione',sessionId:p.regia.stato.sessionId,comando:'avanti'});assert(avanza.ok,avanza.error);await aspetta(`!!document.querySelector('[data-effetto="grow"].visible')`,pubblico);await c.pausa(250);
  await menu(parola.id,pubblico);await clicca('.presenta-fonte-menu button',pubblico);await aspetta(`!!document.querySelector('.presenta-fonte[open]')`,pubblico);
  const scala=()=>pubblico.val(`getComputedStyle(document.querySelector('[data-effetto="grow"]')).transform`),fermo=await scala(),statoPrima=await regia();
  await aspetta(`document.querySelector('.presenta-fonte output').textContent==='2 di 3'&&!!document.querySelector('.presenta-fonte .page[data-page-number="2"] canvas')`,pubblico);await c.pausa(450);assert.equal(await scala(),fermo,'il timer Anime resta esattamente fermo');
  await pubblico.val(`document.querySelector('.presenta-fonte').style.width='390px'`);await c.pausa(150);
  await testata(pubblico,'.presenta-fonte','#presentaFonteTitolo','.presenta-fonte [aria-label="Chiudi la fonte"]','Biologia','01 Botanica.pdf');
  fs.writeFileSync('/private/tmp/zaino-proiezione-fonte-testata.png',Buffer.from((await pubblico.invia('Page.captureScreenshot',{format:'png'})).result.data,'base64'));
  await pubblico.val(`document.querySelector('.presenta-fonte').style.width=''`);
  const negato=await call({azione:'sessione',sessionId:statoPrima.sessionId,comando:'avanti'});assert(!negato.ok,'GOBBO non avanza dietro il PDF');assert.deepEqual(await regia(),statoPrima);
  await clicca('.presenta-fonte [aria-label="Pagina successiva"]',pubblico);await aspetta(`document.querySelector('.presenta-fonte output').textContent==='3 di 3'`,pubblico);
  const shot=await pubblico.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/private/tmp/presenta-fonte-proiezione.png',Buffer.from(shot.result.data,'base64'));
  await tasto('Escape',pubblico);await aspetta(`!document.querySelector('.presenta-fonte')`,pubblico);assert((await targets()).some(t2=>t2.id===t.id),'Esc non chiude la proiezione');assert.deepEqual(await regia(),statoPrima);await c.pausa(300);assert.notEqual(await scala(),fermo,'lo stesso timer riprende dopo la chiusura');
  // Il link diretto si apre con un clic, senza avanzare il passaggio Reveal.
  await clicca(`[data-block-id="${diretto.id}"] .presenta-link-fonte`,pubblico);await aspetta(`document.querySelector('.presenta-fonte output').textContent==='2 di 3'`,pubblico);await tasto('Escape',pubblico);await aspetta(`!document.querySelector('.presenta-fonte')`,pubblico);assert.deepEqual(await regia(),statoPrima);
  console.log('✓ Clip PRESENTA: selettore PDF e altro zaino, PDF intero, annulla, pagina scelta, disco, link visibile, clic/Invio, nome modificabile e proiezione con sessione invariata');
  // Chiudere subito, prima della risposta IPC, non lascia il player bloccato.
  await menu(parola.id,pubblico);await pubblico.val(`document.querySelector('.presenta-fonte-menu button').click();document.querySelector('.presenta-fonte [aria-label="Chiudi la fonte"]').click()`);await aspetta(`!document.querySelector('.presenta-fonte')`,pubblico);
  // Escape sul solo menu lo chiude senza uscire dallo schermo intero.
  await menu(parola.id,pubblico);await tasto('Escape',pubblico);await aspetta(`!document.querySelector('.presenta-fonte-menu:popover-open')`,pubblico);assert((await targets()).some(t2=>t2.id===t.id));
  await menu(ritaglio.id,pubblico);await clicca('.presenta-fonte-menu button',pubblico);await aspetta(`document.querySelector('.presenta-fonte output').textContent==='1 di 3'`,pubblico);await clicca('.presenta-fonte [aria-label="Chiudi la fonte"]',pubblico);await aspetta(`!document.querySelector('.presenta-fonte')`,pubblico);assert.deepEqual(await regia(),statoPrima);
  // Navigazione diretta del pubblico: la fonte deve appartenere alla slide raggiunta.
  await clicca('[aria-label="Slide principale successiva"]',pubblico);await aspetta(`document.querySelector('[data-block-id="${ritaglioSeconda.id}"]').closest('section').classList.contains('present')`,pubblico);
  await menu(ritaglioSeconda.id,pubblico);await clicca('.presenta-fonte-menu button',pubblico);await aspetta(`document.querySelector('.presenta-fonte output').textContent==='1 di 3'`,pubblico);
  const secondaPrima=await regia();assert.equal(secondaPrima.slideId,seconda);await tasto('Escape',pubblico);await aspetta(`!document.querySelector('.presenta-fonte')`,pubblico);assert.deepEqual(await regia(),secondaPrima);
  await clicca('[aria-label="Slide principale precedente"]',pubblico);await c.pausa(100);const ritornoPrima=await regia();assert.equal(ritornoPrima.slideId,sid);
  console.log('✓ Fonte dopo navigazione diretta: slide corrente e ritorno invariati');
  spostato=path.join(vault,'Zaini/biologia/MATERIALI/PDF/01 Botanica.pdf');fs.renameSync(spostato,spostato+'.prova');await menu(parola.id,pubblico);await clicca('.presenta-fonte-menu button',pubblico);await aspetta(`/non.*disponibile|cambiata/.test(document.querySelector('.presenta-fonte-stato').textContent)`,pubblico);await clicca('.presenta-fonte [aria-label="Chiudi la fonte"]',pubblico);await aspetta(`!document.querySelector('.presenta-fonte')`,pubblico);assert.deepEqual(await regia(),ritornoPrima,'anche la fonte mancante conserva la sessione');
  console.log('✓ Apri fonte: keyword/ritaglio, editor, PDF 1/2/3, privacy, errore fonte, Esc, GOBBO e timer Anime sospeso/ripreso senza cambiare slide/passaggio');
 }finally{
  if(altraFonte)fs.rmSync(altraFonte,{force:true});
  if(spostato&&fs.existsSync(spostato+'.prova'))fs.renameSync(spostato+'.prova',spostato);
  await c.val('ZainoPresenta.chiudi()');if(immagine)await c.val(`vault.album.rimuovi('biologia',${q(immagine)},{insisti:true})`);
  if(id)fs.rmSync(path.join(vault,'Zaini/biologia/PRESENTAZIONI',id),{recursive:true,force:true});
  await c.val(`vault.evidenze.salva('biologia',${q(prima.evidenze)});localStorage.clear();Object.entries(${q(prima.storage)}).forEach(([k,v])=>localStorage.setItem(k,v));BANCO.stato=${q(prima.banco)};BANCO.attivo=${q(prima.attivo)};bancoDisegna()`);if(prima.presentaId&&fs.existsSync(path.join(vault,'Zaini/biologia/PRESENTAZIONI',prima.presentaId)))await c.val(`ZainoPresenta.apri(${q(prima.presentaId)})`);for(const p of clients)p.ws.close();c.ws()?.close();
 }
})().catch(e=>{console.error(e);for(const p of clients)p.ws.close();c.ws()?.close();process.exitCode=1;});
