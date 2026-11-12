/* Prova del cablaggio della guida: geometria, indice gerarchico e gallerie senza comandi inline. */
const path=require('node:path'),assert=require('node:assert/strict');
const L=require(path.join(process.cwd(),'App/guida-zaino/_lab/lab'));
(async()=>{
 await L.collega();await L.invia('Network.setCacheDisabled',{cacheDisabled:true});
 const url=process.env.GUIDA_URL||'http://127.0.0.1:8879/guida-zaino/index.html';
 for(const width of [1440,375]){
  await L.invia('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
  await L.invia('Page.navigate',{url:url+'?test='+Date.now()+'#drawably-in-zaino'});
  assert(await L.finoA(`document.readyState==='complete'&&document.querySelectorAll('.galleria').length===21`,20000),'Caricamento guida');
  await L.val(`Promise.all([...document.querySelectorAll('article img')].map(i=>{i.loading='eager';return i.decode().catch(()=>null)}))`);
  await L.pausa(300);
  assert(await L.val(`!document.querySelector('.riferimenti-ui,.riferimento-ui,.galleria-controlli,.rimando-punto')`),'Niente icone nelle tabelle o vecchi dischetti');
  assert(await L.val(`!document.querySelector('.galleria figcaption')`),'Titoli solo in lightbox');
  assert(await L.val(`[...document.querySelectorAll('article img')].every(i=>i.complete&&i.naturalWidth>0)`),'Immagini disponibili');
  const headings=await L.val(`[...document.querySelectorAll('#toc a')].map(a=>a.hash)`);
  for(const id of headings){
   await L.val(`document.querySelector('#toc a[href="${id}"]').click()`);
   await L.pausa(45);
   assert.equal(await L.val(`document.querySelector('#toc a[aria-current]')?.hash`),id,'Indice '+width+' '+id);
  }
  for(const id of ['menu-stili-paragrafo','icone-callout','dizionari-appunti','appunti-a4-disegni','citazione-altro-zaino']){
   assert.equal(await L.val(`document.querySelector('#toc a[href="#${id}"]').closest('ul').parentElement.querySelector(':scope > a').hash`),'#appunti');
  }
  for(const id of ['finestra-esterna-strumenti','laser-spot']){
   assert.equal(await L.val(`document.querySelector('#toc a[href="#${id}"]').closest('ul').parentElement.querySelector(':scope > a').hash`),'#barra-comune');
  }
  const ordine=await L.val(`[...document.querySelectorAll('#strumenti h3[id],#strumenti h4[id]')].map(e=>e.id)`);
  assert(ordine.indexOf('appunti')<ordine.indexOf('parole-album'),'Appunti prima di Parole e Album');
  assert.equal(ordine[ordine.indexOf('parole-album')-1],'citazione-altro-zaino','Citazione in fondo ad Appunti');
  const verificaNumeri=()=>L.val(`(()=>{const blu=[...document.querySelectorAll('article .numero-rimando,#lb[open] .numero-rimando')].filter(e=>e.getClientRects().length).map(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return [r.width,r.height,s.fontSize,s.lineHeight]});const arancio=[...document.querySelectorAll('ol.passi>li')].map(e=>{const s=getComputedStyle(e,'::before');return [parseFloat(s.width),parseFloat(s.height),s.fontSize,s.lineHeight,s.backgroundColor,s.color,s.borderTopColor,s.borderTopWidth,s.boxSizing]});return {blu,arancio}})()`);
  for(const tema of ['chiaro','scuro']){
   await L.val(`document.documentElement.dataset.theme='${tema}'`);
   const n=await verificaNumeri();assert(n.blu.length>100&&n.arancio.length>100);
   for(const b of n.blu)assert.deepEqual(b,[28,28,'18px','18px'],'Misure blu uniformi a '+width);
   for(const a of n.arancio)assert.deepEqual(a,[28,28,'18px','18px','rgba(0, 0, 0, 0)','rgb(249, 115, 22)','rgb(249, 115, 22)','2px','border-box'],'Passaggi senza riempimento a '+width);
  }
  await L.val("document.documentElement.dataset.theme='chiaro'");
  const figures=await L.val(`document.querySelectorAll('.figura-comandi').length`);
  for(let i=0;i<figures;i++){
   const f=`document.querySelectorAll('.figura-comandi')[${i}]`;
   assert(await L.val(`(()=>{const f=${f},pts=JSON.parse(f.dataset.rimandi),nums=[...f.nextElementSibling.querySelectorAll('tbody .numero-rimando')].map(e=>Number(e.textContent));return pts.every((p,i)=>p.numero===nums[i]&&p.box.every(Number.isFinite)&&p.box[0]>=0&&p.box[1]>=0&&p.box[0]+p.box[2]<=100.01&&p.box[1]+p.box[3]<=100.01)})()`),'Abbinamento figura/tabella '+i);
  }
  assert(await L.val(`[...document.querySelectorAll('article figure:not(.galleria figure)')].every(f=>f.querySelector('.rimando-area'))`),'Tutte le immagini didattiche hanno richiami');
  for(let i=0;i<21;i++){
   const g=`document.querySelectorAll('.galleria')[${i}]`;
   const state=await L.val(`(()=>{const g=${g},b=g.querySelector('button'),im=b.querySelector('img'),r=b.getBoundingClientRect(),ir=im.getBoundingClientRect();return {b:getComputedStyle(g).borderWidth,ib:getComputedStyle(im).borderWidth,h:r.height,ih:ir.height,over:document.documentElement.scrollWidth>innerWidth}})()`);
   assert.equal(state.b,'0px');assert.equal(state.ib,'0px');assert(Math.abs(state.h-state.ih)<2);assert(!state.over,'Overflow '+width);
   await L.val(`${g}.querySelector('button').focus();${g}.querySelector('button').click()`);
   assert(await L.val(`document.querySelector('#lb').open&&document.querySelector('#lb .rimandi').hidden`));
   assert.match(await L.val(`document.querySelector('#lb figcaption').textContent`),/1 \/ [23]/);
   await L.val(`document.querySelector('#lb').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))`);
   assert.match(await L.val(`document.querySelector('#lb figcaption').textContent`),/2 \/ [23]/);
   if(await L.val(`${g}.querySelectorAll('img').length===3`)){
    await L.val(`document.querySelector('#lb .lbn').click()`);
    assert.match(await L.val(`document.querySelector('#lb figcaption').textContent`),/3 \/ 3/);
    if(await L.val(`${g}.previousElementSibling.previousElementSibling?.id.startsWith('esempio-')`)){
     assert.match(await L.val(`document.querySelector('#lb img').src`),/spot-senza-bordo/);
     assert.match(await L.val(`document.querySelector('#lb figcaption').textContent`),/Bordo = 0/);
    }
   }
   await L.tasto('Escape');await L.pausa(25);
   assert(await L.val(`!document.querySelector('#lb').open&&document.activeElement===${g}.querySelector('button')`));
  }
  const f=`document.querySelector('.figura-comandi:has(img[src*="appunti-file"])')`;
  await L.val(`${f}.scrollIntoView()`);await L.pausa(100);await L.scatta('verifica-toolbar-'+width);
  await L.val(`${f}.querySelector('button').click()`);await L.pausa(100);await L.scatta('verifica-lightbox-'+width);
  assert.equal(await L.val(`getComputedStyle(document.querySelector('#lb .numero-rimando')).backgroundColor`),'rgb(59, 130, 246)');
  for(const b of (await verificaNumeri()).blu)assert.deepEqual(b,[28,28,'18px','18px'],'Numeri nella lightbox');
  await L.val(`document.querySelector('#lb').close()`);
  console.log('OK',width,headings.length,'voci indice;',figures,'tabelle;',21,'gallerie');
 }
 process.exit();
})().catch(e=>{console.error(e);process.exit(1)});
