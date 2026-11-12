'use strict';
const L=require('./lab'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..'),G=path.resolve(__dirname,'..'),v=process.env.GUIDA_VAULT;
async function shot(file){const r=await L.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync(file,Buffer.from(r.result.data,'base64'));}
(async()=>{
 await L.collega();if(await L.val(`location.pathname.includes('/guida-zaino/')`)){await L.invia('Page.navigate',{url:require('node:url').pathToFileURL(path.join(root,'App/StudIA.html')).href});await L.pausa(2200);}
 assert(v?.startsWith('/private/tmp/studia-guida-20261105-'));assert.equal(await L.val('window.vault.path'),v);
 const m=JSON.parse(fs.readFileSync(path.join(v,'demo.json'))),P=require(path.join(root,'lib/presentazioni')),M=require(path.join(root,'lib/mappe')),A=require(path.join(root,'lib/appunti'));
 const percorso=JSON.parse(fs.readFileSync(path.join(G,'_lab/percorso-base.json'))),n=percorso.length,sidebar=percorso.findIndex(b=>b.id==='sidebar');assert.equal(percorso[2].id,'ocr');assert.equal(percorso[4].id,'sicurezza');
 const d=P.leggi(v,m.zaino,m.presentazione);P.verificaRisorse(v,m.zaino,d);assert.equal(d.stacks.length,n);assert(d.stacks.every(s=>s.slides.length===2));
 assert(M.apri(v,m.zaino,'Come si usa ZAINO.json').nodi?.length>=1+3*n||M.apri(v,m.zaino,'Come si usa ZAINO.json').mappa?.nodi?.length>=1+3*n);
 assert(m.noteFiles.every(f=>fs.existsSync(path.join(v,'Zaini',m.zaino,'APPUNTI',f))));
 await L.invia('Page.reload',{});await L.pausa(2200);
 await L.val(`bancoForma('due-col');bancoAssegna('A','fonte');bancoAssegna('C','appunti');noteApriAttivo(${JSON.stringify(m.noteFiles[sidebar])})`);await L.pausa(400);await L.val('if(!NOTES.mde.isPreviewActive())NOTES.mde.togglePreview()');
 assert(await L.finoA(`document.querySelector('#noteHost .editor-preview-active .figimg')?.naturalWidth>0`,10000));
 assert.equal(await L.val(`document.querySelector('#noteHost .editor-preview-active a.figlink').dataset.page`),String(percorso[sidebar].page));
 await L.val(`document.querySelector('#noteHost .editor-preview-active a.figlink').click()`);await L.pausa(500);
 assert.equal(await L.val('ANTEPRIMA.file'),m.pdf);
 await L.val(`bancoAssegna('A','presenta');ZainoPresenta.apri('${m.presentazione}')`);await L.pausa(900);
 assert.equal(await L.val('ZainoPresenta.documento?.stacks.length'),n);
 await L.val('ZainoPresenta.presenta()');await L.pausa(1000);assert(await L.val('!!ZainoPresenta.regia?.stato.sessionId'));
 await L.val(`window.vault.presentazioni.comando({azione:'sessione',corso:zainoAttivo(),sessionId:ZainoPresenta.regia.stato.sessionId,comando:'chiudi'})`);
 console.log('Zaino: '+n+' appunti, '+(1+3*n)+' nodi, '+(2*n)+' slide; immagini cliccabili e player verificati.');
 await L.invia('Page.navigate',{url:require('node:url').pathToFileURL(path.join(G,'index.html')).href});await L.pausa(1000);
 await L.val(`document.querySelectorAll('article img[loading]').forEach(i=>i.loading='eager')`);
 assert(await L.finoA(`document.fonts.status==='loaded'&&[...document.querySelectorAll('article figure img')].every(i=>i.complete&&i.naturalWidth>100)`,15000),'Screenshot e font caricati');
 assert.equal(await L.val(`document.querySelectorAll('section.cap').length`),6);
 assert.deepEqual(await L.val(`[...document.querySelectorAll('a[href^="#"]')].map(a=>a.hash.slice(1)).filter(id=>id&&!document.getElementById(id))`),[]);
 assert(await L.val(`(()=>{const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);return new Set(ids).size===ids.length})()`));
 assert.equal(await L.val(`document.querySelectorAll('#toc>li').length`),6);
 assert(await L.val(`document.fonts.check('17px "Atkinson Hyperlegible"')&&getComputedStyle(document.body).fontFamily.startsWith('"Atkinson Hyperlegible"')`));
 const app=fs.readFileSync(path.join(root,'App/StudIA.html'),'utf8');
 const token=['teal','yellow','blue','teal-strong','yellow-strong','blue-strong','bg','panel','ink','muted','line','line-weak','hover','orange','tb-h','tb-min','tb-fs','tb-pad-x','tb-peso','tb-track','ctl-h'];
 for(const key of token){const expected=app.match(new RegExp('--'+key+':([^;]+);'))?.[1].trim();assert.equal(await L.val(`getComputedStyle(document.documentElement).getPropertyValue('--${key}').trim()`),expected,key);}
 assert(fs.statSync(path.join(G,'download/Miniguida-ZAINO.pdf')).size>100000);assert(fs.statSync(path.join(G,'download/Intro-a-ZAINO.zip')).size>100000);
 for(const width of [1280,390])for(const tema of ['chiaro','scuro']){
  await L.invia('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await L.val(`document.documentElement.dataset.theme='${tema}';scrollTo(0,0)`);await L.pausa(150);
  assert(await L.val('document.documentElement.scrollWidth<=innerWidth+1'),width+'/'+tema);
  await shot('/private/tmp/studia-guida-20261105-'+width+'-'+tema+'.png');
  for(const id of ['base-search','base-file-cartelle','appunti','presentazioni','condizioni-privacy']){await L.val(`document.getElementById('${id}').scrollIntoView()`);await L.pausa(60);assert(await L.val('document.documentElement.scrollWidth<=innerWidth+1'),id);}
 }
 await L.val(`document.getElementById('base-search').scrollIntoView();document.documentElement.dataset.theme='chiaro'`);await L.pausa(120);
 await L.clicca('#menuBtn');assert.equal(await L.val('document.documentElement.dataset.nav'),'open');
 await L.val(`document.querySelector('#toc a[href="#strumenti"]').click()`);assert.notEqual(await L.val('document.documentElement.dataset.nav'),'open');
 await L.val(`document.querySelector('article figure img').scrollIntoView({block:'center'})`);await L.pausa(100);await L.clicca('article figure img');assert(await L.val('document.getElementById("lb").classList.contains("aperto")'));
 const first=await L.val(`document.querySelector('#lb figcaption').textContent`);await L.tasto('ArrowRight');assert.notEqual(await L.val(`document.querySelector('#lb figcaption').textContent`),first);await L.tasto('Escape');assert(!await L.val(`document.getElementById('lb').classList.contains('aperto')`));
 console.log(await L.val(`({capitoli:document.querySelectorAll('section.cap').length,schermate:document.querySelectorAll('article figure img').length,passi:document.querySelectorAll('ol.passi>li').length,font:getComputedStyle(document.body).fontFamily})`));
 console.log('Guida verificata: token, font, immagini, link, indice, ingrandimento e temi su desktop e mobile.');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
