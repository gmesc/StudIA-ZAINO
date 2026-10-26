'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),c=require('./cdp');
const q=JSON.stringify;
async function wait(expr){for(let i=0;i<160;i++){if(await c.val(expr))return;await c.pausa(100);}throw Error('Attesa: '+expr);}
(async()=>{
 await c.collega();await wait(`typeof bancoStato==='function' && !!window.zainoStudio`);
 assert((await c.val('window.vault.path')).includes('studia-zaino-prova-'));
 const prima=await c.val(`({banco:bancoStato(),attivo:BANCO.attivo,tema:document.documentElement.dataset.theme,organizza:{...ZNAV.organizza},storage:{...localStorage}})`);
 const evFile=path.join(await c.val('window.vault.path'),'Zaini/biologia/APPUNTI/_evidenze.json'),evPrima=fs.existsSync(evFile)?fs.readFileSync(evFile):null;
 try{
  await c.partiPulito();await c.val(`cambiaZaino('storia',true);cambiaZaino('biologia',true);bancoForma('due-col');bancoAssegna('A','fonte');bancoAssegna('C','appunti')`);
  await c.invia('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});await c.pausa(250);
  assert.equal(await c.val(`getComputedStyle(document.getElementById('settingsBtn')).backgroundColor`),'rgba(0, 0, 0, 0)');
  await wait(`NOTES.list.length>0 && !!NOTES.mde`);
  const file=await c.val(`NOTES.list[0].file`);await c.val(`noteOpen(${q(file)},NOTES)`);
  const body=await c.val(`NOTES.mde.value()`);assert(body);
  await c.val(`ZNAV.organizza.fonti=true;ZNAV.organizza.media=true;zainoNavAggiorna()`);
  await wait(`!!document.querySelector('[data-sezione="fonti"] .zs-tit [data-znav="crea"]')`);
  assert(await c.val(`['fonti','media'].every(s=>Array.from(document.querySelectorAll('[data-sezione="'+s+'"] .zs-tit .zs-azioni button')).map(b=>b.dataset.znav).join(',')==='crea,ordina,organizza')`),'sidebar: + prima di A–Z, ordinamento accanto alla matita');
  await c.val(`ZNAV.organizza.fonti=false;ZNAV.organizza.media=false;zainoNavAggiorna()`);
  const quaderni=await c.val(`(()=>{ensureMde(noteStati()[1]);return ['noteSelect','noteSelect2'].map(id=>{const s=document.getElementById(id),g=s.closest('.tendina');return {id,icona:!!g.querySelector('.tlab svg[data-icona="notebook"]'),testo:g.querySelector('.tlab').textContent,tooltip:g.title,nome:s.getAttribute('aria-label'),select:s.getBoundingClientRect().width,guscio:g.getBoundingClientRect().width};});})()`);
  assert(quaderni.every(g=>g.icona&&!g.testo.trim()&&g.tooltip.includes('Quaderno')&&g.nome&&g.select<=g.guscio+1),'Quaderno: icona, tooltip e area cliccabile confinata: '+JSON.stringify(quaderni));
  const layout=await c.val('bancoStato().col');
  for(const larghezza of [420,280]){
   await c.val(`BANCO.stato.col=1-${larghezza}/document.getElementById('banco').getBoundingClientRect().width;bancoDisegna()`);await c.pausa(150);
   assert(await c.val(`(()=>{const b=document.querySelector('#noteHost .ncb-more');return !!b.getClientRects().length&&!!b.querySelector('svg[data-icona="chevrons-right"]')&&getComputedStyle(b.querySelector('svg')).display!=='none'&&!b.textContent.trim()&&b.title==='Altri strumenti'&&b.getAttribute('aria-label')===b.title;})()`),'toolbar a '+larghezza+'px: solo doppio chevron con tooltip');
  }
  const compatta=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/zaino-toolbar-quaderno.png',Buffer.from(compatta.result.data,'base64'));
  await c.val(`BANCO.stato.col=${q(layout)};bancoDisegna()`);
  assert(await c.val(`['.bold','.italic','.heading','.quote','.unordered-list','.ordered-list','.link','.code','.preview','.side-by-side','.ncb-undo','.ncb-redo','.ncb-callout','.ncb-emoji','.ncb-guida','.ncb-cita','.ncb-mat'].every(sel=>{const b=document.querySelector('#noteHost .editor-toolbar '+sel);return b?.querySelector('svg.ui-icon')&&b.title;})`),'Appunti: tutti i simboli sono SVG con tooltip');
  assert(await c.val(`(()=>{const b=document.querySelector('#noteHost .editor-toolbar .bold');return b.title.startsWith('Grassetto (')&&b.getAttribute('aria-label')===b.title;})()`),'tooltip e nome accessibile in italiano, con scorciatoia');
  assert(await c.val(`!!document.querySelector('#menuBtn img.oi') && !!document.querySelector('#creditsBtn .btn-emoji') && !!document.querySelector('#modoBtn img.oi')`),'fantasma, mago e marchio conservati');
  assert(await c.val(`[...document.querySelectorAll('#zainoNav [data-znav="organizza"]')].every(b=>b.querySelector('svg.ui-icon')&&b.title)`),'sidebar: SVG con tooltip');

  await c.val(`window.__toolbarFlush=noteFlushStato;noteFlushStato=()=>false`);
  await c.clicca('#noteClose');assert.equal(await c.val(`NOTES.cur.file`),file);
  await c.val(`noteFlushStato=window.__toolbarFlush`);
  await c.clicca('#noteClose');assert.equal(await c.val(`NOTES.cur`),null);
  assert(await c.val(`['noteSave','noteRen','noteDel','noteStampa','notePdf','noteClose'].every(id=>{const b=document.getElementById(id);return b.disabled&&Number(getComputedStyle(b).opacity)<1;})`),'azioni senza appunto visibilmente disabilitate');
  assert(await c.val(`bancoVisibile('appunti') && !!document.querySelector('#noteHost .editor-toolbar').getClientRects().length`));
  await c.val(`noteOpen(${q(file)},NOTES)`);assert.equal(await c.val(`NOTES.mde.value()`),body);
  await c.val(`openPdf('01 Botanica.pdf',1,'Botanica',true)`);await wait(`PDFJS.pronto && !!PDFJS.doc`);
  assert.equal((await c.val(`document.getElementById('pdfPagN').textContent`)).toLowerCase(),'1 di 3');
  await wait(`!!document.querySelector('#pdfHost .textLayer span')`);
  await c.val(`window.__toolbarRange=()=>{const t=document.querySelector('#pdfHost .textLayer span').firstChild,r=document.createRange();r.setStart(t,0);r.setEnd(t,Math.min(8,t.textContent.length));return r;};evStratoAttivoScegli('');evVisteScegli({tutte:true});evidenzeBottoni()`);
  await c.clicca('#pdfEvid');
  const n=await c.val(`EVIDENZE.elenco.length`);
  assert.equal(await c.val(`evidenzia(window.__toolbarRange(),'#ffcc00')`),false);
  assert.equal(await c.val(`EVIDENZE.elenco.length`),n);
  assert((await c.val(`document.getElementById('toast').textContent`)).includes('mostra le sottolineature'));
  assert.equal(await c.val(`document.querySelector('#pdfEvid svg').dataset.icona`),'eye-off');
  await c.val(`evVisteScegli({tutte:true,spenti:['']});evidenzeBottoni()`);
  assert.equal(await c.val(`evidenzia(window.__toolbarRange(),'#ffcc00')`),false,'layer di destinazione spento');
  assert((await c.val(`document.getElementById('toast').textContent`)).includes('Base'));
  await c.val(`evVisteScegli({tutte:true});window.__toolbarPrep=evidenzaPrepara(window.__toolbarRange(),'#ffcc00');evVisteScegli({tutte:true,spenti:['']})`);
  assert.equal(await c.val(`evidenzaScrivi(window.__toolbarPrep)`),false,'ricontrolla dopo un dialogo');
  await c.val(`evVisteScegli({tutte:true});evidenzeBottoni()`);
  assert.equal(await c.val(`evidenzia(window.__toolbarRange(),'#ffcc00')`),true);
  assert.equal(await c.val(`EVIDENZE.elenco.length`),n+1);
  assert.equal(await c.val(`document.querySelector('#pdfEvid svg').dataset.icona`),'eye');
  await c.val(`evVisteScegli({tutte:true,spenti:['']});stratiPopDisegna()`);
  assert.equal(await c.val(`document.querySelector('.stratoriga [data-str="occhio"] svg').dataset.icona`),'eye-off');
  assert.equal(await c.val(`getComputedStyle(document.querySelector('.stratoriga .stratonome')).textDecorationLine`),'none');
  await c.val(`evVisteScegli({tutte:true})`);
  await c.clicca('#pdfClose');
  assert.equal((await c.val(`document.getElementById('pdfPagN').textContent`)).toLowerCase(),'- di -');
  assert(await c.val(`['pdfZoomIn','pdfFindBtn','pdfRinomina','pdfEvid','pdfPagN'].every(id=>{const b=document.getElementById(id);return !!b.getClientRects().length&&b.disabled;})`));
  assert(await c.val(`['pdfRinomina','pdfEvid','pdfFindBtn','pdfClose'].every(id=>!!document.querySelector('#'+id+' svg.ui-icon'))`));
  await c.val(`bancoForma('quattro');bancoAssegna('A','keyword');bancoAssegna('C','mappa');bancoAssegna('B','album');bancoAssegna('D','studio')`);
  await c.val(`EVIDENZE.elenco=[{id:'uno',exact:'Beta',creato:'2026-10-16T12:00:00Z'},{id:'due',exact:'Alfa',creato:'2026-10-17T12:00:00Z'}];KW.ordine={criterio:'alfa',verso:'asc'};keywordDisegna()`);
  assert.equal(await c.val(`document.getElementById('kwOrdine').textContent`),'ZA');
  await c.clicca('#kwOrdine');assert.equal(await c.val(`document.getElementById('kwOrdine').textContent`),'AZ');
  assert.deepEqual(await c.val(`[...document.querySelectorAll('#kwLista .kwtxt')].map(e=>e.textContent)`),['Beta','Alfa']);
  await c.clicca('#kwData');assert.equal(await c.val(`document.querySelector('#kwData svg:last-child').dataset.icona`),'chevron-down');
  assert.deepEqual(await c.val(`[...document.querySelectorAll('#kwLista .kwtxt')].map(e=>e.textContent)`),['Alfa','Beta']);
  await c.clicca('#kwData');assert.equal(await c.val(`document.querySelector('#kwData svg:last-child').dataset.icona`),'chevron-up');
  assert.deepEqual(await c.val(`[...document.querySelectorAll('#kwLista .kwtxt')].map(e=>e.textContent)`),['Beta','Alfa']);
  assert((await c.val(`document.querySelector('#kwLista .kwchip').title`)).endsWith('16 ottobre 2026'));
  assert.notEqual(await c.val(`getComputedStyle(document.querySelector('#mOrient [aria-pressed="true"]')).backgroundColor`),'rgba(0, 0, 0, 0)','orientamento selezionato visibile');
  assert(await c.val(`['mNuova','mRinomina','mCestino','mAnnulla','mRipeti','mVista','mStampa','mPdf','mChiudi'].every(id=>!!document.querySelector('#'+id+' svg.ui-icon'))`));
  for(const tema of ['chiaro','scuro']){
   await c.val(`document.documentElement.dataset.theme=${q(tema)}`);await c.invia('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});await c.pausa(250);
   assert(await c.val(`['#settingsBtn','#zschedeNewButton','#mNuova','#kwEvid','#albumOrdina'].every(sel=>{const e=document.querySelector(sel);return e&&getComputedStyle(e).backgroundColor==='rgba(0, 0, 0, 0)';})`),'azioni trasparenti in '+tema);
   assert.equal(await c.val(`getComputedStyle(document.getElementById('menuBtn')).backgroundColor`),'rgb(255, 255, 255)','la maniglia della sidebar resta bianca in '+tema);
   assert.equal(await c.val(`getComputedStyle(document.querySelector('[data-album-tab][aria-pressed="true"]')).boxShadow`),'none');
   assert.notEqual(await c.val(`getComputedStyle(document.querySelector('[data-album-tab][aria-pressed="true"]')).backgroundColor`),'rgba(0, 0, 0, 0)');
   const b=await c.val(`(()=>{const r=document.getElementById('mNuova').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);await c.invia('Input.dispatchMouseEvent',{type:'mouseMoved',...b});await c.pausa(250);
   assert(await c.val(`(()=>{const p=document.createElement('span');p.style.background='var(--comando-hover)';document.body.append(p);const ok=getComputedStyle(p).backgroundColor===getComputedStyle(document.getElementById('mNuova')).backgroundColor;p.remove();return ok;})()`));
  }
  await c.val(`document.documentElement.dataset.theme='chiaro'`);await c.invia('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});await c.pausa(250);
  const shot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/zaino-toolbar-essenziali.png',Buffer.from(shot.result.data,'base64'));
  await c.val(`document.getElementById('chatBtn').click()`);await wait(`!document.getElementById('zchatWindow').hidden`);
  assert(await c.val(`['zchatNew','zchatScopeButton','zchatSettings','zchatCollapse','zchatClose'].every(id=>!!document.querySelector('#'+id+' svg.ui-icon'))`));
  await c.clicca('#zchatCollapse');assert.equal(await c.val(`document.querySelector('#zchatCollapse svg').dataset.icona`),'maximize');
  await c.clicca('#zchatCollapse');await c.clicca('#zchatClose');
  await c.val(`document.getElementById('bancoBtn').click()`);
  assert(await c.val(`!!document.querySelector('#bFormaNuova svg.ui-icon') && !!document.getElementById('bFormaNuova').title`),'anche Nuova forma usa SVG e tooltip');
  await c.val('closePops()');
  await c.val(`document.getElementById('settingsBtn').click()`);
  assert.equal(await c.val(`getComputedStyle(document.querySelector('.set-tab[aria-selected="true"]')).boxShadow`),'none');
  assert.deepEqual(await c.val(`[...document.querySelectorAll('button:has(svg.ui-icon),a:has(svg.ui-icon),button.tendina')].filter(b=>!b.title&&!b.getAttribute('aria-describedby')).map(b=>b.id||b.className)`),[],'ogni comando con icona ha un tooltip');
  assert.deepEqual(await c.val(`[...document.querySelectorAll('button svg:not(.ui-icon)')].map(s=>s.closest('button').id)`),[],'i simboli dei comandi provengono tutti da Lucide');
 }finally{
  if(evPrima)fs.writeFileSync(evFile,evPrima);else fs.rmSync(evFile,{force:true});
  await c.val(`document.getElementById('settingsClose').click();if(window.__toolbarFlush)noteFlushStato=window.__toolbarFlush;localStorage.clear();Object.entries(${q(prima.storage)}).forEach(([k,v])=>localStorage.setItem(k,v));ZNAV.organizza=${q(prima.organizza)};zainoNavAggiorna();EVIDENZE.viste=null;evidenzeCarica();KW.ordine={criterio:'alfa',verso:'asc'};keywordDisegna();BANCO.stato=${q(prima.banco)};BANCO.attivo=${q(prima.attivo)};document.documentElement.dataset.theme=${q(prima.tema)};bancoSalva();bancoDisegna()`);}
 console.log('toolbar essenziali: trasparenza, chiusura documenti, strumenti e SVG OK');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
