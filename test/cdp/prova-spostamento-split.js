'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),c=require('./cdp'),q=JSON.stringify;
const storia=v=>JSON.parse(JSON.stringify(v,(k,x)=>k==='sticky'?undefined:x));
async function wait(expr){for(let i=0;i<120;i++){if(await c.val(expr))return;await c.pausa(80);}throw Error('Attesa: '+expr);}
async function trascina(da,a){
 const p=await c.val(`(()=>{const a=document.querySelector(${q(da)}).getBoundingClientRect(),b=document.querySelector(${q(a)}).getBoundingClientRect();return {x:a.x+a.width/2,y:a.y+a.height/2,dx:b.x+b.width/2,dy:b.y+Math.min(100,b.height/2)};})()`);
 await c.invia('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x,y:p.y});
 await c.invia('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',buttons:1,clickCount:1});
 for(let i=1;i<=10;i++){await c.invia('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x+(p.dx-p.x)*i/10,y:p.y+(p.dy-p.y)*i/10,button:'left',buttons:1});await c.pausa(40);}
 await c.invia('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.dx+1,y:p.dy,button:'left',buttons:1});await c.pausa(120);
 await c.invia('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.dx+1,y:p.dy,button:'left',buttons:0,clickCount:1});await c.pausa(180);
}
(async()=>{
 await c.collega();await wait(`typeof bancoStato==='function' && !!window.zainoStudio`);
 assert((await c.val('window.vault.path')).includes('studia-zaino-prova-'),'solo vault sintetico');
 await c.partiPulito();
 const prima=await c.val(`(()=>{noteFlush();return {banco:bancoStato(),attivo:BANCO.attivo,storage:{...localStorage},note:noteStati().map(s=>({file:s.cur?.file||'',body:s.mde?.value()||''}))};})()`);
 let file=[];
 try{
  file=await c.val(`(()=>{const f=[1,2].map(i=>notesApi().save(corsoAttivo(),null,{title:'Trasferimento prova '+Date.now()+' '+i},'Prima riga\\nSeconda riga\\nTerza riga').file);notesReload();bancoForma('due-col');bancoAssegna('A','appunti');bancoAssegna('C','appunti2');noteOpen(f[0],NOTES);noteOpen(f[1],noteStati()[1]);return f;})()`);
  await wait(`noteStati().every(s=>!!s.cur)`);await c.pausa(150);
  assert(await c.val(`!Array.from(document.querySelector('#noteSelect2').options).find(o=>o.value===${q(file[0])}).disabled`),'un appunto aperto altrove deve restare selezionabile');
  await c.val(`(()=>{window.__trasferimentoCM=noteStati().map(s=>s.mde.codemirror);const cm=NOTES.mde.codemirror;cm.replaceRange(' modificata',{line:1,ch:12});cm.setCursor({line:1,ch:5});noteStati()[1].mde.codemirror.replaceRange(' salvata',{line:0,ch:10});window.__trasferimentoStoria=cm.getHistory();window.__trasferimentoCorpo=cm.getValue();window.__trasferimentoSecondo=noteStati()[1].mde.value();})()`);
  // Un salvataggio fallito non deve spostare né svuotare nessuno dei due editor.
  await c.val(`window.__trasferimentoSave=noteSave;noteSave=()=>false;noteOpen(${q(file[0])},noteStati()[1]);noteSave=window.__trasferimentoSave`);
  assert.deepEqual(await c.val('noteStati().map(s=>s.cur.file)'),file);
  await c.val(`(()=>{const s=document.querySelector('#noteSelect2');s.value=${q(file[0])};s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await wait(`!NOTES.cur && noteStati()[1].cur?.file===${q(file[0])}`);await c.pausa(150);
  assert(await c.val(`noteStati()[1].mde.value()===__trasferimentoCorpo && NOTES.mde.value()===''`));
  assert.deepEqual(storia(await c.val('noteStati()[1].mde.codemirror.getHistory()')),storia(await c.val('__trasferimentoStoria')));
  assert.deepEqual(storia(await c.val('noteStati()[1].mde.codemirror.getCursor()')),{line:1,ch:5});
  assert(await c.val(`notesApi().list(corsoAttivo()).find(n=>n.file===${q(file[1])}).body===__trasferimentoSecondo`),'l’appunto sostituito è salvato');
  assert(await c.val(`noteStati().every((s,i)=>s.mde.codemirror===__trasferimentoCM[i])`),'editor non ricreati');
  await c.val(`NOTES.mde.value('bozza');noteOpen(${q(file[0])},NOTES)`);
  assert(await c.val(`!NOTES.cur && NOTES.mde.value()==='bozza' && !!noteStati()[1].cur`),'bozza senza nome protetta');
  await c.val(`noteSvuota(NOTES);noteOpen(${q(file[0])},NOTES)`);await c.pausa(150);
  assert.deepEqual(await c.val('noteStati().map(s=>s.cur?.file||null)'),[file[0],null]);
  console.log('  ok  appunto trasferito in entrambe le direzioni, cronologia, cursore e salvataggio protetti');

  await c.val(`BANCO.stato.col=.65;bancoSalva();bancoDisegna();window.__trasferimentoNodo=document.querySelector('#notePane');window.__trasferimentoBanco=JSON.parse(JSON.stringify(bancoStato()));window.__trasferimentoMisure=Array.from(document.querySelectorAll('#banco .blocco:not([hidden])')).map(e=>({b:e.dataset.blocco,w:e.getBoundingClientRect().width}));`);
  await c.pausa(200);
  await trascina('.blocco[data-blocco="A"] .bnumero','.blocco[data-blocco="C"] .CodeMirror');
  assert.deepEqual(await c.val(`[bancoStrumentoIn('A'),bancoStrumentoIn('C')]`),['appunti2','appunti'],'drop sul corpo sposta i pannelli');
  assert.equal(await c.val('bancoStato().col'),.65);
  assert(await c.val(`document.querySelector('#notePane')===__trasferimentoNodo && NOTES.mde.value()===__trasferimentoCorpo`),'il trascinamento non inserisce testo nell’appunto né ricrea il pannello');
  assert.equal(await c.val('BANCO.attivo'),'C');
  assert(await c.val(`__trasferimentoMisure.every(m=>Math.abs(document.querySelector('.blocco[data-blocco="'+m.b+'"]').getBoundingClientRect().width-m.w)<1)`));
  await c.val(`document.querySelector('.blocco[data-blocco="C"] .bhead').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',altKey:true,bubbles:true,cancelable:true}))`);
  assert.deepEqual(await c.val(`[bancoStrumentoIn('A'),bancoStrumentoIn('C')]`),['appunti','appunti2']);
  // Un drop fuori dal banco annulla lo spostamento e ripulisce l’indicatore.
  await trascina('.blocco[data-blocco="A"] .bnumero','.topbar');
  assert.deepEqual(await c.val(`[bancoStrumentoIn('A'),bancoStrumentoIn('C')]`),['appunti','appunti2']);
  assert.equal(await c.val(`document.querySelectorAll('[data-banco-drop],[data-banco-drag]').length`),0);
  console.log('  ok  drag nativo, dimensioni della destinazione, tastiera e annullamento');

  await c.val(`BANCO.stato.col=.25;bancoSalva();bancoDisegna()`);await c.pausa(250);
  assert(await c.val(`(()=>{const b=document.querySelector('#noteHost .ncb-more');return !!b.getClientRects().length&&!!b.querySelector('svg[data-icona="chevrons-right"]')&&getComputedStyle(b.querySelector('span')).display==='none'&&b.title==='Altri strumenti';})()`),'toolbar stretta: doppio chevron SVG, tooltip e testo nascosto');
  await c.clicca('#noteHost .ncb-more');assert.equal(await c.val(`document.querySelector('#noteHost .ncb-more').getAttribute('aria-expanded')`),'true');
  const immagine=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/zaino-spostamento-toolbar.png',Buffer.from(immagine.result.data,'base64'));
  await c.val(`document.querySelector('#noteHost .ncb-more').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
  assert.equal(await c.val(`document.querySelector('#noteHost .ncb-more').getAttribute('aria-expanded')`),'false');
  const salvato=await c.val('bancoStato()');await c.val('location.reload()');await c.pausa(600);await c.collega();await wait(`typeof noteStati==='function' && NOTES.cur?.file===${q(file[0])}`);
  assert.deepEqual(await c.val('bancoStato()'),salvato);assert.equal(await c.val('noteStati()[1].cur'),null);
  console.log('  ok  toolbar compatta, Escape e riapertura coerente');
 }finally{
  await c.val(`(()=>{if(window.__trasferimentoSave)noteSave=__trasferimentoSave;noteStati().forEach(s=>{noteFlushStato(s);noteSvuota(s);});${q(file)}.forEach(f=>notesApi().remove(corsoAttivo(),f));notesReload();${q(prima.note)}.forEach((n,i)=>{if(n.file)noteOpen(n.file,noteStati()[i]);else noteCaricaCorpo(n.body,noteStati()[i]);});localStorage.clear();Object.entries(${q(prima.storage)}).forEach(([k,v])=>localStorage.setItem(k,v));BANCO.stato=${q(prima.banco)};BANCO.attivo=${q(prima.attivo)};bancoDisegna();})()`);
 }
 console.log('spostamento-split UI OK');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
