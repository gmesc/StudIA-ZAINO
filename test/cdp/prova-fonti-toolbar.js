'use strict';
// Due lettori: verificare la sola presenza delle icone non basta. Ogni gesto
// deve usare il documento del suo split, anche quando mostrano lo stesso PDF.
const assert=require('node:assert/strict'),fs=require('node:fs'),c=require('./cdp'),q=JSON.stringify;
async function aspetta(expr){for(let i=0;i<180;i++){if(await c.val(expr))return;await c.pausa(80);}throw Error('Attesa: '+expr);}
async function tasto(key,code,vk,modifiers=0){for(const type of ['keyDown','keyUp'])await c.invia('Input.dispatchKeyEvent',{type,key,code,windowsVirtualKeyCode:vk,modifiers});}
const dipinti=`(()=>{const out=[];for(const [n,h]of CSS.highlights)if(n.startsWith('ev-'))for(const r of h){const e=r.startContainer.parentElement,b=r.getBoundingClientRect();if(b.width&&b.height)out.push({pane:e.closest('section')?.id,testo:r.toString()});}return out;})()`;
(async()=>{
 await c.collega();await aspetta(`typeof bancoStato==='function'&&zainoAttivo()==='biologia'`);
 assert((await c.val('vault.path')).includes('studia-zaino-prova-'));await c.partiPulito();
 const prima=await c.val(`({banco:bancoStato(),attivo:BANCO.attivo,zoom:bancoZoomLeggi(),memoria:{...localStorage},evidenze:vault.evidenze.leggi(corsoAttivo()).evidenze.map(e=>e.id),ritagli:vault.album.elenco(corsoAttivo(),'ritaglio').voci.map(e=>e.id)})`);
 try{
  await c.val(`bancoForma('due-col');bancoAssegna('A','fonte');bancoAssegna('C','fonte2');openPdf('01 Botanica.pdf',1,'Botanica',true);fonte2Apri('02 Biologia cellulare.pdf')`);
  await aspetta(`!!document.querySelector('#pdfFrame .textLayer span')&&!!document.querySelector('#pdf2Frame .textLayer span')`);
  const comandi=['Tinta','RighelloBtn','Voce','Evid','Strati','Ritaglia','FindBtn','Ocr','Rinomina','Elimina'];
  assert.deepEqual(await c.val(`${q(comandi)}.filter(n=>!document.getElementById('pdf2'+n))`),[],'La seconda fonte deve avere la toolbar FONTI completa');
  const misure=await c.val(`${q(comandi)}.filter(n=>n!=='Voce'||ttsSistema()).map(n=>{const e=document.getElementById('pdf2'+n);return {n,h:e.getBoundingClientRect().height};})`);
  const h=await c.val(`document.getElementById('pdfNext').getBoundingClientRect().height`);
  assert(misure.every(m=>m.h===h&&h>0),JSON.stringify(misure));
  await c.clicca('#pdf2Next');assert.deepEqual(await c.val('[ANTEPRIMA.page,FONTE2.page]'),[1,2]);
  await c.clicca('#pdf2PagN');await c.invia('Input.insertText',{text:'3'});await tasto('Enter','Enter',13);
  assert.deepEqual(await c.val('[ANTEPRIMA.page,FONTE2.page]'),[1,3]);
  await c.clicca('#pdf2FindBtn');await c.invia('Input.insertText',{text:'cellulare'});
  await aspetta(`document.getElementById('pdfFindCount').textContent.includes('di 3')`);
  assert.equal(await c.val(`PDFJS.find.state?.query||''`),'','La ricerca non deve partire sulla prima fonte');
  await c.val(`pdfFindApri({fuoco:false,query:'Botanica'})`);
  await aspetta(`!PDFFIND.seconda&&document.getElementById('pdfFindCount').textContent.includes('di 3')`);
  assert.equal(await c.val(`document.getElementById('pdfFindInput').value`),'Botanica','La query della lente attraversa il cambio lettore');
  await c.clicca('#pdfFindClose');
  await c.val(`document.getElementById('pdf2Frame').focus()`);await tasto('f','KeyF',70,4);
  assert.equal(await c.val(`PDFFIND.seconda&&document.getElementById('pdfFindPop').hasAttribute('open')`),true);
  await c.clicca('#pdfFindClose');
  await c.clicca('#pdf2RighelloBtn');
  await aspetta(`!document.getElementById('pdf2Righello').hidden`);
  assert.deepEqual(await c.val('[RIGHELLO.acceso,RIGHELLO2.acceso]'),[false,true]);
  await c.clicca('#pdf2RighelloBtn');
  await c.clicca('#pdf2Tinta');assert.equal(await c.val(`!!document.querySelector('.zaino-palette')`),true);await c.val('closePops()');
  await c.clicca('#pdf2Strati');assert.equal(await c.val(`document.getElementById('stratiPop').hasAttribute('open')`),true);await c.val('closePops()');
  assert.match(await c.val('vocePaginaTesto(true).testo'),/Biologia cellulare/);
  assert.match(await c.val('vocePaginaTesto(false).testo'),/Botanica/);
  await c.clicca('#pdf2Rinomina');assert.equal(await c.val(`document.getElementById('umInput').value`),'Biologia cellulare');await c.clicca('#umCancel');
  await c.val(`window.__confermaFonti=window.confirm;window.__testoFonti='';window.confirm=t=>{window.__testoFonti=t;return false;}`);
  await c.clicca('#pdf2Elimina');await aspetta(`window.__testoFonti.includes('Biologia cellulare')`);
  await c.val(`window.confirm=window.__confermaFonti;delete window.__confermaFonti;delete window.__testoFonti`);

  // Una selezione nella seconda vista salva la fonte giusta, non ANTEPRIMA.file.
  await c.val(`FONTE2.viewer.currentPageNumber=1`);await aspetta(`!!document.querySelector('#pdf2Frame .page[data-page-number="1"] .textLayer span')`);
  await c.val(`(()=>{const n=document.querySelector('#pdf2Frame .page[data-page-number="1"] .textLayer span').firstChild,r=document.createRange();r.setStart(n,0);r.setEnd(n,'Biologia cellulare'.length);evidenzia(r,'#ef4444');})()`);
  assert.equal(await c.val(`EVIDENZE.elenco.find(e=>e.exact==='Biologia cellulare')?.materiale`),'02 Biologia cellulare.pdf');
  assert((await c.val(dipinti)).some(x=>x.pane==='pdfPane2'&&x.testo==='Biologia cellulare'));
  await c.clicca('#pdf2Evid');assert.equal((await c.val(dipinti)).length,0);await c.clicca('#pdf2Evid');
  // Un ritaglio vero, dal PDF sotto il puntatore; pixel e provenienza devono coincidere.
  await c.clicca('#pdf2Ritaglia');
  const r=await c.val(`(()=>{const b=document.querySelector('#pdf2Frame .page[data-page-number="1"] canvas').getBoundingClientRect(),h=document.getElementById('pdf2Frame').getBoundingClientRect();return {x:b.left+30,y:Math.max(h.top,b.top)+35};})()`);
  await c.invia('Input.dispatchMouseEvent',{type:'mousePressed',x:r.x,y:r.y,button:'left',clickCount:1});
  await c.invia('Input.dispatchMouseEvent',{type:'mouseMoved',x:r.x+100,y:r.y+70,button:'left',buttons:1});
  await c.invia('Input.dispatchMouseEvent',{type:'mouseReleased',x:r.x+100,y:r.y+70,button:'left',clickCount:1});
  await aspetta(`vault.album.elenco(corsoAttivo(),'ritaglio').voci.some(v=>v.materiale==='02 Biologia cellulare.pdf')`);
  await c.val('albumChiudiMenu();albumRitaglioModo(false)');
  // Stesso file in due viewer: due mappe DOM distinte, un unico dato sul disco.
  await c.val(`openPdf('02 Biologia cellulare.pdf',1,'Biologia cellulare',true)`);
  await aspetta(`!!document.querySelector('#pdfFrame .textLayer span')&&evSupPdf().filter(s=>s.pagina===1&&s.file==='02 Biologia cellulare.pdf').length===2`);
  await c.val('evidenzeDisegna()');
  for(const pane of ['pdfPane','pdfPane2'])assert((await c.val(dipinti)).some(x=>x.pane===pane&&x.testo==='Biologia cellulare'),pane);
  for(let i=0;i<2;i++){await c.val(`bancoZoom('C')`);await c.pausa(200);await c.val('bancoZoomTorna()');await c.pausa(500);}
  for(const pane of ['pdfPane','pdfPane2'])assert((await c.val(dipinti)).some(x=>x.pane===pane&&x.testo==='Biologia cellulare'),'Ritorno al banco: '+pane);
  const sc=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/private/tmp/zaino-fonti-toolbar.png',Buffer.from(sc.result.data,'base64'));
  // Chiudere l'altra fonte lascia aperta la ricerca di questa e il suo documento.
  await c.clicca('#pdf2FindBtn');await c.val('closePdf()');
  assert.equal(await c.val(`PDFFIND.seconda&&document.getElementById('pdfFindPop').hasAttribute('open')&&!!FONTE2.doc`),true);
  await c.clicca('#pdfFindClose');
  await c.val(`openPdf('02 Biologia cellulare.pdf',1,'Biologia cellulare',true)`);await aspetta('!!PDFJS.doc');
  await c.clicca('#pdf2Close');assert.equal(await c.val('!!PDFJS.doc&&ANTEPRIMA.file'), '02 Biologia cellulare.pdf');
  assert.equal(await c.val(`document.getElementById('pdf2FindBtn').disabled`),true);
  console.log('✓ seconda Fonte: toolbar, pagina, ricerca, righello, tinta, strati, rinomina, sottolineature e ritagli');
 }finally{
  await c.val(`(async()=>{for(const v of vault.album.elenco(corsoAttivo(),'ritaglio').voci)if(!${q(prima.ritagli)}.includes(v.id))await vault.album.rimuovi(corsoAttivo(),v.id,{insisti:true});})()`);
  await c.val(`if(window.__confermaFonti){window.confirm=window.__confermaFonti;delete window.__confermaFonti;delete window.__testoFonti;}closePops();albumChiudiMenu();albumRitaglioModo(false);pdfFindChiudi();closePdf();fonte2Chiudi();
   for(const e of vault.evidenze.leggi(corsoAttivo()).evidenze)if(!${q(prima.evidenze)}.includes(e.id))vault.evidenze.rimuovi(corsoAttivo(),e.id);
   evidenzeCarica();evidenzeDisegna();
   localStorage.clear();Object.entries(${q(prima.memoria)}).forEach(([k,v])=>localStorage.setItem(k,v));BANCO.stato=${q(prima.banco)};BANCO.attivo=${q(prima.attivo)};bancoZoomScrivi(${q(prima.zoom)});bancoDisegna();`);
 }
 c.ws().close();
})().catch(e=>{console.error(e);c.ws()?.close();process.exitCode=1;});
