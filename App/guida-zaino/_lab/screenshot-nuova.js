'use strict';
const L=require('./lab'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..'),v=process.env.GUIDA_VAULT;
assert(v?.startsWith('/private/tmp/studia-guida-20261105-'));
const z='intro-a-zaino',meta=JSON.parse(fs.readFileSync(path.join(v,'demo.json'))),errori=[];
const finestraIntera=new Set([
 'banco','search','proiezione','presenta','album','citazione','mappa','gobbo','lim','ricerca-materiali','schede','ripasso'
]);
async function sidebar(chiusa){
 await L.val(`document.documentElement.dataset.sidebar=${JSON.stringify(chiusa?'collapsed':'')};window.dispatchEvent(new Event('resize'))`);
 await wait(`document.getElementById('menuBtn').getAttribute('aria-expanded')===${JSON.stringify(String(!chiusa))}`);
}
async function wait(expr){assert(await L.finoA(expr,15000),expr);}
async function shot(n,opt){if(opt?.sel&&!n.startsWith('lim-')){const r=await L.rect(opt.sel);assert(r.w>80&&r.h>25,'Superficie visibile: '+opt.sel);}await L.overlayPulisci();await L.muovi(1460,990);await L.pausa(500);await L.scatta('nuova-'+n,opt||{scala:1});}
async function prova(nome,fn){if(process.env.GUIDA_PASSI&&!new RegExp(process.env.GUIDA_PASSI).test(nome))return;try{await sidebar(finestraIntera.has(nome));await fn();console.log('OK '+nome);}catch(e){errori.push(nome);console.error(nome,e.message);}finally{await L.val(`document.querySelector('#settingsClose')?.click();document.querySelector('#creditsClose')?.click();if(document.getElementById('citazioneDialog').open)document.getElementById('citazioneChiudi').click()`);await L.pulito();await L.invia('Emulation.setDeviceMetricsOverride',{width:1470,height:1000,deviceScaleFactor:1.5,mobile:false});}}
async function banco(a='fonte',b='appunti'){await L.val(`bancoZoomTorna();bancoForma('due-col');bancoAssegna('A',${JSON.stringify(a)});bancoAssegna('C',${JSON.stringify(b)})`);await L.pausa(600);}
async function settings(tab){await L.val(`document.getElementById('settingsClose').click();document.getElementById('settingsBtn').click()`);await L.val(`document.querySelector('.set-tab[data-tab="${tab}"]').click()`);await L.pausa(400);}
(async()=>{
 await L.collega();assert((await L.val('location.href')).startsWith(require('node:url').pathToFileURL(path.join(root,'App')).href));await L.invia('Emulation.setDeviceMetricsOverride',{width:1470,height:1000,deviceScaleFactor:1.5,mobile:false});
 await L.invia('Page.navigate',{url:require('node:url').pathToFileURL(path.join(root,'App/StudIA.html')).href});await L.pausa(2200);await wait('!!window.ZainoPresenta&&!!window.ZainoLim');assert.equal(await L.val('window.vault.path'),v);
 await L.val(`document.documentElement.dataset.theme='chiaro';cambiaZaino('${z}',true);zainiAggiorna();document.getElementById('aspettoFont').value='atkinson';document.getElementById('aspettoFont').dispatchEvent(new Event('change'))`);
 await banco();await L.val(`openPdf(${JSON.stringify(meta.pdf)},2,'Miniguida ZAINO',false);notesReload();noteApriAttivo('01 - Inizia qui.md')`);await wait('!!NOTES.mde');
 await L.val(`if(!NOTES.mde.isPreviewActive())NOTES.mde.togglePreview()`);await L.pausa(1500);
 await prova('banco',()=>shot('banco'));
 await prova('fonti',()=>shot('fonti',{sel:'#pdfPane',scala:1}));
 await prova('split',()=>shot('split',{sel:'.blocco[data-blocco="C"] .bhead',scala:2}));
 await prova('sidebar',()=>shot('sidebar',{clip:{x:0,y:40,width:302,height:370},scala:1.5}));
 await prova('impostazioni',async()=>{await settings('aspetto');await shot('impostazioni',{sel:'#settingsModal .media-card',scala:1,margine:0});});
 await prova('file',async()=>{await settings('zaino');await shot('file',{sel:'#settingsModal .media-card',scala:1,margine:0});});
 await prova('modelli',async()=>{await L.invia('Emulation.setDeviceMetricsOverride',{width:1470,height:1800,deviceScaleFactor:1.5,mobile:false});await settings('ai');await L.val(`document.querySelector('#settingsModal .set-body').scrollTop=0`);await L.pausa(300);assert(await L.val(`(()=>{const r=document.getElementById('zchatLocalSettings').getBoundingClientRect(),b=document.querySelector('#settingsModal .set-body').getBoundingClientRect();return r.top>=b.top&&r.bottom<=b.bottom&&r.bottom<=innerHeight})()`),'Pannello AI locale interamente visibile');await shot('modelli',{sel:'#zchatLocalSettings',scala:1.5,margine:16});});
 await prova('sicurezza',async()=>{await settings('sicurezza');await L.val(`document.querySelector('#settingsModal .set-body').scrollTop=0`);await shot('sicurezza',{sel:'#settingsModal .media-card',scala:1.5,margine:0});});
 await prova('ocr',async()=>{await L.val(`bancoZoomTorna();bancoForma('uno');bancoAssegna('A','fonte');openPdf('0002 - Scheda fotografata.pdf',1,'Scheda fotografata',false)`);await L.val(`fontiIndicizza('0002 - Scheda fotografata.pdf','intro-a-zaino')`);await L.val(`fontiIndiciCarica()`);await L.val('pdfOcrAggiorna()');assert(await L.val(`!document.querySelector('#pdfOcr').disabled`));await L.cornice('#pdfOcr',{colore:'#f97316',etichetta:''});const r=await L.rect('#pdfPane');await L.scatta('nuova-ocr',{clip:{x:r.x,y:r.y,width:r.w,height:600},scala:1.5});});
 await prova('crediti',async()=>{await settings('zaino');await shot('crediti',{sel:'#settingsModal .media-card',scala:1,margine:0});});
 await prova('banchi',async()=>{await L.clicca('#bancoBtn');await shot('banchi',{sel:'#bancoPop',scala:1.5});});
 await prova('search',async()=>{await L.clicca('#searchBtn');await L.clicca('#searchInput');await L.scrivi('banco');await L.pausa(1300);await shot('search');});
 await prova('appunti',async()=>{await banco();await L.val(`if(NOTES.mde.isPreviewActive())NOTES.mde.togglePreview()`);await shot('appunti',{sel:'#notePane',scala:1});});
 await prova('mappa',async()=>{await banco('mappa','appunti');await L.val(`mappaApriMia('Come si usa ZAINO.json')`);await L.pausa(700);await L.val('mappaAdatta();mappaRidisegna()');await shot('mappa');});
 await prova('album',async()=>{
  await banco('album','keyword');
  await L.clicca('[data-album-tab="immagini"]');
  await wait("!!document.querySelector('#fotoLista img')");
  await shot('album');
 });
 await prova('presenta',async()=>{await banco('presenta','appunti');await L.val(`ZainoPresenta.apri('${meta.presentazione}')`);await wait('!!ZainoPresenta.documento');
  await L.val(`document.querySelectorAll('button[data-slide-id]')[1]?.click()`);
  await L.pausa(1000);await shot('presenta');});
 await prova('gobbo',async()=>{await L.val('ZainoPresenta.presenta()');await L.pausa(1200);await banco('gobbo','presenta');await shot('gobbo');await L.val(`window.vault.presentazioni.comando({azione:'sessione',corso:zainoAttivo(),sessionId:ZainoPresenta.regia.stato.sessionId,comando:'chiudi'})`);});
 await prova('lim',async()=>{await banco('lim','appunti');await wait('!!ZainoLim.editor.api');await L.val(`ZainoLim.editor.nuova()`);await L.pausa(350);
  await L.val(`(()=>{const api=ZainoLim.editor.api,els=LimEditor.converti([{type:'text',x:40,y:150,text:'La mia lezione',fontSize:24},{type:'rectangle',x:40,y:240,width:190,height:90,backgroundColor:'#ccfbf1',fillStyle:'solid'},{type:'text',x:60,y:270,text:'Fonte',fontSize:20},{type:'arrow',x:240,y:285,width:70,height:0,points:[[0,0],[70,0]],endArrowhead:'arrow'},{type:'rectangle',x:320,y:240,width:200,height:90,backgroundColor:'#fef9c3',fillStyle:'solid'},{type:'text',x:337,y:270,text:'Spiegazione',fontSize:20}]);api.updateScene({elements:els});api.updateScene({appState:{scrollX:0,scrollY:0,zoom:{value:1}}});})()`);await shot('lim');
  await shot('lim-menu',{sel:'.excalidraw .dropdown-menu-button',scala:1.5,margine:0});
  await shot('lim-selezione',{sel:'.excalidraw label:has(input[data-testid="toolbar-selection"])',scala:1.5,margine:0});
  for(const [nome,valore] of [['penna','freedraw'],['testo','text'],['forma','rectangle'],['freccia','arrow']]){
   await shot('lim-'+nome,{sel:`.excalidraw label:has(input[data-testid="toolbar-${valore}"])`,scala:1.5,margine:0});
  }
 });
 await prova('ricerca-materiali',async()=>{await banco('studio','appunti');await L.val(`document.getElementById('zragSearchButton').click()`);await shot('ricerca-materiali');});
 await prova('schede',async()=>{await banco('studio','appunti');await L.val(`document.getElementById('zschedeNewButton').click()`);await shot('schede');});
 await prova('ripasso',async()=>{await banco('flashcard','appunti');await shot('ripasso');});
 await prova('proiezione',async()=>{await banco();await L.val(`if(!NOTES.mde.isPreviewActive())NOTES.mde.togglePreview();openPdf(${JSON.stringify(meta.pdf)},2,'Miniguida ZAINO',false);BancoPresentazione.apriProiezione('appunti')`);await L.pausa(900);await shot('proiezione');await L.val('BancoPresentazione.chiudiProiezione()');});
 await prova('citazione',async()=>{
  const Z=require(path.join(root,'lib/zaini'));if(!Z.esiste(v,'archivio-fonti-demo'))Z.crea(v,'Archivio fonti demo');const dest=path.join(v,'Zaini/archivio-fonti-demo/MATERIALI/PDF');fs.copyFileSync(path.join(v,'Zaini',z,'MATERIALI/PDF',meta.pdf),path.join(dest,meta.pdf));
  const pagina=JSON.parse(fs.readFileSync(path.join(__dirname,'percorso-base.json'))).find(b=>b.id==='search').page;const r=require(path.join(root,'lib/citazioni-zaini')).crea(v,'archivio-fonti-demo',meta.pdf,pagina,'La lente della topbar cerca nello zaino aperto.');await L.val(`citazioneZainoApri(${JSON.stringify(r.rimando)})`);await wait('document.getElementById("citazioneDialog").open');await L.pausa(1000);await shot('citazione');await L.clicca('#citazioneChiudi');
 });
 console.log('Errori',errori);process.exit(errori.length?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
