'use strict';
// Cablaggio sul vault sintetico: la classificazione e la pila si provano in Node.
const assert=require('assert'),fs=require('fs'),c=require('./cdp');
const q=JSON.stringify;
let memoria;
async function attendi(expr){
  const fine=Date.now()+12000;
  while(Date.now()<fine){if(await c.val(expr))return;await c.pausa(80);}
  throw new Error('Attesa scaduta: '+expr);
}
async function click(sel){
  await c.val(`document.querySelector(${q(sel)}).scrollIntoView({block:'nearest'})`);
  await c.clicca(sel);await c.pausa(120);
}
async function foto(nome){
  const r=await c.invia('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync('/private/tmp/'+nome+'.png',Buffer.from(r.result.data,'base64'));
}
(async()=>{
  await c.collega();await attendi(`typeof noteStati==='function' && zainoAttivo()==='biologia'`);
  assert((await c.val('window.vault.path')).includes('studia-zaino-prova-'),'solo vault sintetico');
  memoria=await c.val('Object.fromEntries(Object.entries(localStorage))');
  await c.partiPulito();
  await c.val(`(async()=>{
    const r=notesApi().save(corsoAttivo(),null,{title:'Prova citazioni e cronologia '+Date.now()},'Spiegazione personale.');
    notesReload();bancoForma('due-col');bancoAssegna('A','appunti');bancoAssegna('C','mappa');
    noteOpen(r.file,NOTES); if(NOTES.mde.isPreviewActive()) NOTES.mde.togglePreview();
    appuntaStileScegli('');appuntaCitaScegli(true);
    const m=await mappeApi().salva(corsoAttivo(),null,{titolo:'Mappa cronologia',nodi:[{id:'u1',testo:'Radice'}],archi:[]});
    MAPPA.registro='mie';await mappaApriMia(m.file);return true;
  })()`);
  await attendi(`document.querySelector('#mAnnulla') && MAPPA.mia.grafo && NOTES.cur`);
  assert.equal(await c.val(`document.querySelector('#mAnnulla').getAttribute('aria-disabled')`),'true');
  await c.val(`mappaAnnullabile('Nuovo concetto');mappaApplica(MappaModifica.creaNodo(MAPPA.mia.grafo,{testo:'Concetto'}));`);
  await click('#mAnnulla');assert.equal(await c.val('MAPPA.mia.grafo.nodi.length'),1);
  await click('#mRipeti');assert.equal(await c.val('MAPPA.mia.grafo.nodi.length'),2);
  await click('#mAnnulla');
  // La scorciatoia di Ripeti deve fare lo stesso gesto del bottone.
  await c.val(`document.querySelector('#mappaSvg').dispatchEvent(new KeyboardEvent('keydown',{key:'z',metaKey:true,shiftKey:true,bubbles:true}));`);
  assert.equal(await c.val('MAPPA.mia.grafo.nodi.length'),2);
  await click('#mAnnulla');
  await c.val(`mappaAnnullabile('Altro concetto');mappaApplica(MappaModifica.creaNodo(MAPPA.mia.grafo,{testo:'Altro'}));`);
  assert.equal(await c.val(`document.querySelector('#mRipeti').getAttribute('aria-disabled')`),'true');
  console.log('  ok  mappa: Undo/Redo, scorciatoia e abbandono del futuro');

  await c.val(`(async()=>{const r=await mappeApi().salva(corsoAttivo(),null,{titolo:'Seconda mappa cronologia',nodi:[{id:'u1',testo:'Diversa'}],archi:[]});await mappaApriMia(r.file);})()`);
  assert.equal(await c.val(`document.querySelector('#mAnnulla').getAttribute('aria-disabled')`),'true');
  await click('#mAnnulla');assert.equal(await c.val('MAPPA.mia.grafo.nodi[0].testo'),'Diversa');
  console.log('  ok  il cambio mappa non eredita modifiche di un altro documento');

  await c.val(`noteAppend('Una frase completa con il punto.',{tipo:'pdf',file:'01 Botanica.pdf',pagina:2},'')`);
  await c.val(`noteAppend('alcune parole',{tipo:'pdf',file:'01 Botanica.pdf',pagina:2},'')`);
  await click('#noteHost .preview');
  assert.equal(await c.val(`document.querySelectorAll('#noteHost .editor-preview-active blockquote').length`),1);
  assert.equal(await c.val(`document.querySelector('#noteHost .editor-preview-active blockquote .plink').dataset.page`),'2');
  assert.equal(await c.val(`document.querySelector('#noteHost .editor-preview-active p em').textContent`),'alcune parole');
  assert.equal(await c.val(`getComputedStyle(document.querySelector('#noteHost blockquote')).fontStyle`),'normal');
  assert.equal(await c.val(`getComputedStyle(document.querySelector('#noteHost blockquote')).borderLeftWidth`),'2px');
  console.log('  ok  citazioni riconoscibili, rimando cliccabile e blocco leggero');

  await click('#noteHost .preview');
  await c.val(`NOTES.mde.codemirror.setCursor(NOTES.mde.codemirror.lastLine(),0);NOTES.mde.codemirror.focus()`);
  await c.invia('Input.insertText',{text:'Commento personale fuori dalla citazione.'});
  await click('#noteHost .preview');
  assert(!(await c.val(`document.querySelector('#noteHost blockquote').textContent`)).includes('Commento personale'));
  await click('#noteHost .preview');
  await c.val(`NOTES.mde.codemirror.setSelection({line:0,ch:0},{line:0,ch:23})`);
  await click('#noteHost .quote');
  await click('#noteHost .preview');
  assert((await c.val(`document.querySelector('#noteHost blockquote').textContent`)).includes('Spiegazione personale'));
  console.log('  ok  il cursore prosegue fuori e il tool Quote resta operativo');

  // La selezione viene dal PDF vero e attraversa il bottone Appunta già esistente.
  await click('#noteHost .preview');
  await c.val(`bancoMostra('fonte');openPdf('01 Botanica.pdf',1)`);
  await attendi(`document.querySelector('#pdfPane .textLayer span')?.textContent.includes('Botanica')`);
  const selezionato=await c.val(`(()=>{
    const el=document.querySelector('#pdfPane .textLayer span'),r=document.createRange();
    r.selectNodeContents(el);const s=getSelection();s.removeAllRanges();s.addRange(r);
    const box=r.getBoundingClientRect();selMenuApri(box.left,box.bottom,{testo:el.textContent,range:r});return el.textContent;
  })()`);
  await click('#selMenu [data-az="appunta"]');
  await attendi(`NOTES.mde.value().includes(${q(selezionato)})`);
  assert((await c.val('NOTES.mde.value()')).includes('«*'),'Appunta applica le virgolette senza un nuovo comando');
  await click('#noteHost .preview');
  assert((await c.val(`document.querySelector('#noteHost .editor-preview-active').textContent`)).includes(selezionato));
  assert(await c.val(`!!document.querySelector('#noteHost .editor-preview-active em .ev-ref, #noteHost .editor-preview-active em mark')`),
    'le parole chiave possono mantenere il segno dentro il corsivo');
  await c.val(`bancoForma('due-col');bancoAssegna('A','appunti');bancoAssegna('C','mappa')`);
  console.log('  ok  il bottone Appunta del PDF inserisce il frammento con fonte e segno');

  const segnoEstratto=`(()=>{
    const m=[...document.querySelectorAll('#noteHost mark.evid')].find(e=>e.textContent===${q(selezionato)});
    if(!m)return null;const s=getComputedStyle(m);
    return {colore:s.textDecorationColor,fondo:s.backgroundColor,tratto:m.dataset.tratto};
  })()`;
  await c.val(`kwRicolora(EVIDENZE.elenco.find(e=>e.exact===${q(selezionato)}).id,'#ff8ad0')`);
  const primaDellaGomma=await c.val(segnoEstratto);
  assert(primaDellaGomma,'il segno appuntato è visibile prima della cancellazione');
  assert.equal(primaDellaGomma.colore,'rgb(255, 138, 208)','segue il colore aggiornato sulla fonte');
  await c.val(`(()=>{
    const el=document.querySelector('#pdfPane .textLayer span'),r=document.createRange();
    r.selectNodeContents(el);evidenzaCancella(r);
  })()`);
  assert.equal(await c.val(`EVIDENZE.elenco.some(e=>e.exact===${q(selezionato)})`),false);
  assert.equal(await c.val(segnoEstratto),null,
    'cancellare sulla fonte toglie dagli appunti anche il segno colorato o grigio');
  assert((await c.val(`document.querySelector('#noteHost .editor-preview-active').textContent`)).includes(selezionato),
    'il testo citato resta leggibile');
  console.log('  ok  la gomma toglie keyword e colore, conservando il testo negli appunti');

  const misure=await c.val(`['#noteHost .ncb-undo','#noteHost .ncb-redo','#mAnnulla','#mRipeti'].map(sel=>{
    const e=document.querySelector(sel),r=e.getBoundingClientRect(),s=getComputedStyle(e);
    return {h:r.height,w:r.width,bordo:s.borderTopWidth,icona:e.querySelector('svg')?.dataset.icona||e.textContent.trim(),label:e.getAttribute('aria-label')};})`);
  assert(misure.every(m=>m.h===misure[0].h&&m.w>=30&&m.bordo==='0px'&&m.label),JSON.stringify(misure));
  assert(misure[0].icona&&misure[1].icona);assert.equal(misure[2].icona,'undo-2');assert.equal(misure[3].icona,'redo-2');
  await foto('studia-cronologia-citazioni');
  console.log('  ok  frecce coerenti per dimensioni, icone ed etichette accessibili');
  await c.val(`noteFlush();mappaFlush()`);
  const file=await c.val('NOTES.cur.file');
  await c.val('location.reload()');
  await attendi(`typeof noteOpen==='function' && zainoAttivo()==='biologia'`);
  await c.val(`bancoMostra('appunti');noteOpen(${q(file)},NOTES)`);
  await attendi(`typeof NOTES!=='undefined' && NOTES.cur?.file===${q(file)} && !!NOTES.mde`);
  if(!await c.val('NOTES.mde.isPreviewActive()'))await click('#noteHost .preview');
  assert.equal(await c.val(segnoEstratto),null,
    'il colore resta assente anche riaprendo l’appunto');
  assert((await c.val(`document.querySelector('#noteHost .editor-preview-active').textContent`)).includes(selezionato));
  console.log('✓ cronologia e citazioni verificate');
})().catch(async e=>{console.error(e);process.exitCode=1;try{await foto('studia-cronologia-citazioni-failure');}catch(_){}})
.finally(async()=>{
  if(memoria)await c.val(`localStorage.clear();Object.entries(${q(memoria)}).forEach(([k,v])=>localStorage.setItem(k,v));location.reload();`);
  process.exit(process.exitCode||0);
});
