'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),c=require('./cdp'),q=JSON.stringify;
async function wait(expr){for(let i=0;i<180;i++){if(await c.val(expr))return;await c.pausa(100);}throw Error('Attesa: '+expr+'; '+JSON.stringify(await c.val(`({dialog:document.getElementById('citazioneDialog').open,stato:document.getElementById('citazioneStato').textContent})`)));}
(async()=>{
 await c.collega();await wait(`typeof zainiMenuApri==='function'&&!!zainoAttivo()`);await c.partiPulito();
 const vault=await c.val('window.vault.path');assert(vault.includes('studia-zaino-prova-'));
 let fileCreato,secondoCreato;
 const locale=path.join(vault,'Zaini/storia/MATERIALI/PDF/01 Fonte locale.pdf');
 const letture=['biologia','storia'].map(z=>{const p=path.join(vault,'Zaini',z,'_lettura.json');return [p,fs.existsSync(p)?fs.readFileSync(p):null];});
 const prima=await c.val(`({z:zainoAttivo(),banco:bancoStato(),storage:{...localStorage},tema:document.documentElement.dataset.theme})`);
 const gruppo=path.join(vault,'Zaini/biologia/MATERIALI/PDF/Gruppi/Nuovi'),extra=path.join(gruppo,'03 Aggiunta.pdf');fs.mkdirSync(gruppo,{recursive:true});
 try{
  await c.clicca('#zainoScegli');await wait(`!!document.querySelector('#zainiMenu[open] .zaini-voce')`);
  assert((await c.val(`document.querySelector('[data-zaino-scegli="biologia"] .zaini-conto').textContent`)).includes('2 PDF'));
  await c.val('closePops()');fs.copyFileSync(path.join(vault,'Zaini/biologia/MATERIALI/PDF/01 Botanica.pdf'),extra);
  await c.clicca('#zainoScegli');await wait(`document.querySelector('[data-zaino-scegli="biologia"] .zaini-conto')?.textContent==='3 PDF'`);
  assert.equal(await c.val(`document.querySelector('[data-zaino-scegli="storia"] .zaini-conto').textContent`),'0 PDF');
  assert(await c.val(`parseFloat(getComputedStyle(document.getElementById('zainoScegli')).paddingLeft)>=8`),'area del bottone più larga del titolo');
  await c.clicca('#zainiAlfa');assert.equal(await c.val(`document.getElementById('zainiAlfa').textContent`),'AZ');
  await c.clicca('#zainiData');assert.equal(await c.val(`document.querySelector('#zainiData svg:last-child').dataset.icona`),'chevron-down');
  await c.clicca('#zainiData');assert.equal(await c.val(`document.querySelector('#zainiData svg:last-child').dataset.icona`),'chevron-up');
  for(const tema of ['chiaro','scuro']){await c.val(`document.documentElement.dataset.theme=${q(tema)}`);assert(await c.val(`document.getElementById('zainiMenu').getBoundingClientRect().right<=innerWidth`));}
  await c.val(`document.documentElement.dataset.theme='chiaro'`);
  let shot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/zaino-menu-citazioni.png',Buffer.from(shot.result.data,'base64'));
  await c.clicca('[data-zaino-scegli="biologia"]');
  await c.val(`bancoForma('due-col');bancoAssegna('A','fonte');bancoAssegna('C','appunti');openPdf('01 Botanica.pdf',2,'Botanica',true)`);
  await wait(`!!document.querySelector('#pdfHost .page[data-page-number="2"] .textLayer span')`);
  await c.val(`window.__copiaPrima=navigator.clipboard.writeText;navigator.clipboard.writeText=async t=>{window.__citazioneCopiata=t;};window.__selezionaPdf=()=>{const n=document.querySelector('#pdfHost .page[data-page-number="2"] .textLayer span').firstChild,r=document.createRange();r.selectNodeContents(n);const s=getSelection();s.removeAllRanges();s.addRange(r);return r;};selMenuApri(350,250,{range:window.__selezionaPdf(),testo:'Botanica - pagina 2'});`);
  await c.clicca('#selMenu [data-az="cita-pdf"]');await wait(`window.__citazioneCopiata?.includes('zaino-pdf:')`);
  assert((await c.val('window.__citazioneCopiata')).includes('> Botanica - pagina 2'));
  const cita=await c.val(`window.vault.citazioni.crea('biologia','01 Botanica.pdf',2,'Botanica - pagina 2')`);
  assert(cita.markdown?.includes('Biologia › 01 Botanica.pdf · p. 2'),JSON.stringify(cita));
  await c.val(`cambiaZaino('storia',true);bancoForma('due-col');bancoAssegna('A','appunti');bancoAssegna('C','fonte')`);
  fs.copyFileSync(path.join(vault,'Zaini/biologia/MATERIALI/PDF/02 Biologia cellulare.pdf'),locale);
  await c.val(`openPdf('01 Fonte locale.pdf',1,'Fonte locale',true)`);
  await wait(`!!document.querySelector('#pdfHost .page[data-page-number="1"] .textLayer span')`);
  const nota=await c.val(`window.vault.notes.save('storia',null,{title:'Citazione incrociata'},${q(cita.markdown)})`);assert(!nota.error,JSON.stringify(nota));fileCreato=path.join(vault,'Zaini/storia/APPUNTI',nota.file);
  await c.val(`notesReload();noteOpen(${q(nota.file)},NOTES)`);await wait(`NOTES.cur?.file===${q(nota.file)}`);
  // Lo stesso parser usato nell'anteprima e nella stampa deve mantenere il riferimento qualificato.
  const html=await c.val(`renderNoteMd(${q(cita.markdown)})`);assert(html.includes('data-citazione-zaino'));
  await c.val(`window.__linkProva=document.createElement('div');window.__linkProva.innerHTML=${q(html)};document.body.append(window.__linkProva);window.__linkProva.querySelector('a').click();window.__linkProva.remove()`);
  await wait(`document.getElementById('citazioneConto').textContent==='2 DI 3'`);
  assert.equal(await c.val('zainoAttivo()'),'storia');assert.equal(await c.val('NOTES.cur.file'),nota.file);
  await wait(`!!document.querySelector('#citazionePagine .page[data-page-number="2"] canvas')`);
  await wait(`!!document.querySelector('#citazionePagine .page[data-page-number="2"] .textLayer span')`);
  assert((await c.val(`document.getElementById('citazioneTitolo').textContent`)).includes('Biologia'));
  assert(await c.val(`!!document.querySelector('#citazionePagine .page[data-page-number="2"] canvas').getBoundingClientRect().height`));
  // Opt-in: copia del sistema e gesto Incolla reali, senza il doppio usato dalle altre prove.
  // Il lanciatore locale conserva e ripristina la pasteboard del Mac in memoria.
  if(process.env.STUDIA_PROVA_CLIPBOARD==='1'){
   await c.val(`navigator.clipboard.writeText=window.__copiaPrima;NOTES.mde.codemirror.setCursor(NOTES.mde.codemirror.lineCount(),0);if(!NOTES.mde.isPreviewActive())NOTES.mde.togglePreview();`);
   await c.val(`(()=>{const r=document.createRange();r.selectNodeContents(document.querySelector('#citazionePagine .page[data-page-number="2"] .textLayer span'));getSelection().removeAllRanges();getSelection().addRange(r);})()`);
   await c.clicca('#citazioneCopia');await c.pausa(200);
   assert((await c.val(`document.getElementById('citazioneStato').textContent`)).startsWith('Citazione copiata.'),'la copia reale deve riuscire: '+await c.val(`document.getElementById('citazioneStato').textContent`));
   assert(await c.val('navigator.clipboard.readText().then(()=>false,()=>true)'), 'la lettura automatica della clipboard resta negata');
   await c.clicca('#citazioneChiudi');await c.clicca('#noteHost .editor-toolbar .preview');
   const primaIncolla=await c.val('NOTES.mde.value()');
   assert(await c.val('NOTES.mde.codemirror.hasFocus()'), 'uscire da Anteprima deve restituire il focus all’editor: '+await c.val('document.activeElement.outerHTML.slice(0,160)'));
   await c.invia('Input.dispatchKeyEvent',{type:'keyDown',modifiers:4,key:'v',code:'KeyV',windowsVirtualKeyCode:86,commands:['paste']});
   await c.invia('Input.dispatchKeyEvent',{type:'keyUp',modifiers:4,key:'v',code:'KeyV',windowsVirtualKeyCode:86});
   await wait(`NOTES.mde.value()!==${q(primaIncolla)}`);
   assert.equal((await c.val('NOTES.mde.value()')).split('> Botanica - pagina 2').length,3,'incolla dopo uscita da anteprima');
   await c.val(`navigator.clipboard.writeText=async t=>{window.__citazioneCopiata=t;};citazioneZainoApri(${q(cita.rimando)})`);
   await wait(`!!document.querySelector('#citazionePagine .page[data-page-number="2"] .textLayer span')`);
  }
  // Il PDF locale rimane sotto il dialogo: la selezione esterna non può usare il suo menu.
  await c.val(`window.__selezionaCitazione=()=>{const el=document.querySelector('#citazionePagine .page[data-page-number="2"] .textLayer span'),r=document.createRange();r.selectNodeContents(el);getSelection().removeAllRanges();getSelection().addRange(r);const b=r.getBoundingClientRect();el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0,clientX:b.x+4,clientY:b.y+4}));};window.__selezionaCitazione()`);
  await wait(`document.getElementById('selBarra').classList.contains('aperta')`);
  shot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/zaino-citazione-menu.png',Buffer.from(shot.result.data,'base64'));
  const livello=await c.val(`(()=>{const b=document.querySelector('#selBarra .ctx-item'),r=b.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {raggiungibile:!!hit?.closest('#selBarra'),sopra:hit?.outerHTML.slice(0,180),contenitore:document.getElementById('selBarra').parentElement.id};})()`);
  assert(livello.raggiungibile,'Menu della citazione davanti al PDF e cliccabile: '+JSON.stringify(livello));
  assert.deepEqual(await c.val(`[...document.querySelectorAll('#selBarra .ctx-item')].map(b=>b.textContent)`),['Inserisci nell’appunto','Copia testo con fonte','Copia']);
  assert.equal(await c.val(`evSupDaRange(SELMENU.range)`),null,'nessuna annotazione sulla fonte sottostante');
  await c.val(`window.__citazioneCopiata=''`);await c.clicca('#selBarra [data-az="cita-pdf"]');
  await wait(`window.__citazioneCopiata?.includes('Biologia › 01 Botanica.pdf · p. 2')`);
  assert(!(await c.val('window.__citazioneCopiata')).includes('Fonte locale'));
  // Anche senza un PDF sottostante, il tasto destro apre il menu dentro il dialogo.
  await c.val(`closePdf();window.__selezionaCitazione()`);await wait(`selBarraAperta()`);
  const punto=await c.val(`(()=>{const r=getSelection().getRangeAt(0).getBoundingClientRect();return {x:r.x+4,y:r.y+4};})()`);
  for(const type of ['mousePressed','mouseReleased'])await c.invia('Input.dispatchMouseEvent',{type,...punto,button:'right',clickCount:1});
  await wait(`selMenuAperto()`);
  assert(await c.val(`(()=>{const b=document.querySelector('#selMenu [data-az="copia"]'),r=b.getBoundingClientRect();return !!document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#selMenu');})()`));
  await c.val(`window.__citazioneCopiata=''`);await c.clicca('#selMenu [data-az="copia"]');
  await wait(`window.__citazioneCopiata==='Botanica - pagina 2'`);
  await c.val(`(()=>{const r=document.createRange();r.selectNodeContents(document.querySelector('#citazionePagine .page[data-page-number="2"] .textLayer span'));getSelection().removeAllRanges();getSelection().addRange(r);window.__citazioneCopiata='';})()`);
  await c.clicca('#citazioneCopia');await wait(`window.__citazioneCopiata?.includes('> Botanica - pagina 2')`);
  shot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/zaino-citazione-anteprima.png',Buffer.from(shot.result.data,'base64'));
  // Gesto reale dal secondo appunto in anteprima: destinazione stabile, inserimento
  // senza sostituire il testo selezionato e un solo Annulla per tornare all'originale.
  await c.clicca('#citazioneChiudi');
  const primoPrima=await c.val('NOTES.mde.value()'),corpoSecondo='Inizio\n\n'+cita.markdown+'\n\nFine';
  const seconda=await c.val(`window.vault.notes.save('storia',null,{title:'Appunto di destinazione'},${q(corpoSecondo)})`);
  assert(!seconda.error,JSON.stringify(seconda));secondoCreato=path.join(vault,'Zaini/storia/APPUNTI',seconda.file);
  await c.val(`bancoAssegna('C','appunti2');notesReload();noteOpen(${q(seconda.file)},NOTE_ISTANZE[1])`);await c.pausa(120);
  const secondoPrima=await c.val('NOTE_ISTANZE[1].mde.value()');
  await c.val(`(()=>{const s=NOTE_ISTANZE[1];if(s.mde.isPreviewActive())s.mde.togglePreview();s.mde.codemirror.setSelection({line:0,ch:0},{line:0,ch:6});s.mde.togglePreview();})()`);
  await wait(`!!document.querySelector('#noteHost2 .editor-preview-active a[data-citazione-zaino]')`);
  await c.clicca('#noteHost2 .editor-preview-active a[data-citazione-zaino]');
  await wait(`!!document.querySelector('#citazionePagine .page[data-page-number="2"] .textLayer span')`);
  await c.val(`noteAttiva(NOTES);window.__selezionaCitazione()`);await wait(`selBarraAperta()`);
  assert((await c.val(`document.querySelector('#selBarra [data-az="inserisci-citazione"]').title`)).includes('Appunto di destinazione'));
  await c.clicca('#selBarra [data-az="inserisci-citazione"]');
  await wait(`!document.getElementById('citazioneDialog').open && NOTE_ISTANZE[1].mde.codemirror.hasFocus()`);
  const inserito=await c.val('NOTE_ISTANZE[1].mde.value()');
  assert(inserito.startsWith('Inizio\n\n> Botanica - pagina 2'),'non sostituisce la selezione precedente');
  assert.equal(inserito.split(cita.rimando).length,3,'testo con origine e pagina corrette');
  assert.equal(await c.val('NOTE_ISTANZE[1].mde.isPreviewActive()'),false,'inserimento visibile nella scrittura');
  assert.equal(await c.val('NOTES.mde.value()'),primoPrima,'il primo appunto resta intatto');
  assert.equal(await c.val('zainoAttivo()'),'storia');
  await c.val('noteCronologia(NOTE_ISTANZE[1],false)');assert.equal(await c.val('NOTE_ISTANZE[1].mde.value()'),secondoPrima,'un solo Annulla');
  await c.val('noteCronologia(NOTE_ISTANZE[1],true);noteFlushStato(NOTE_ISTANZE[1])');
  assert(fs.readFileSync(secondoCreato,'utf8').includes(inserito),'inserimento salvato sul disco');
  shot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/zaino-citazione-inserita.png',Buffer.from(shot.result.data,'base64'));
  // La destinazione chiusa mentre il PDF carica non autorizza la scrittura altrove.
  await c.val(`citazioneZainoApri(${q(cita.rimando)},NOTE_ISTANZE[1]);closeEditor(NOTE_ISTANZE[1])`);
  await wait(`!!document.querySelector('#citazionePagine .page[data-page-number="2"] .textLayer span')`);
  await c.val('window.__selezionaCitazione()');await wait('selBarraAperta()');
  assert(await c.val(`document.querySelector('#selBarra [data-az="inserisci-citazione"]').disabled`));
  await c.val('citazioneInserisciDaRange(SELMENU.range)');
  assert((await c.val(`document.getElementById('citazioneStato').textContent`)).includes('destinazione non è più aperto'));
  assert.equal(await c.val('NOTES.mde.value()'),primoPrima);
  await c.clicca('#citazioneDopo');await wait(`document.getElementById('citazioneConto').textContent==='3 DI 3'`);
  // Riapri nello stesso gesto: l'evento close precedente non deve cancellare la nuova richiesta.
  await c.val(`document.getElementById('citazioneChiudi').click();citazioneZainoApri(${q(cita.rimando.replace(/r=[a-f0-9]+/,'r='+'0'.repeat(64)))})`);
  assert.equal(await c.val('zainoAttivo()'),'storia');
  await wait(`document.getElementById('citazioneStato').textContent.includes('La fonte è cambiata')`);
  assert.equal(await c.val(`document.querySelectorAll('#citazionePagine canvas').length`),0);await c.clicca('#citazioneChiudi');
  await wait(`document.getElementById('selBarra').parentElement===document.body&&document.getElementById('selMenu').parentElement===document.body`);
  // Il selettore dell'editor legge A ma scrive nell'appunto B catturato all'apertura.
  await c.val(`apriMateriali(document.querySelector('#noteHost .ncb-mat'),NOTES)`);await wait(`!!document.getElementById('matZaino')`);
  await c.val(`document.getElementById('matZaino').value='biologia';document.getElementById('matZaino').dispatchEvent(new Event('change',{bubbles:true}))`);
  await wait(`!!document.querySelector('#matLista [data-mat="01 Botanica.pdf"]')`);
  await c.val(`window.__askCross=askText;askText=()=>Promise.resolve('1');scegliMateriale('01 Botanica.pdf','pdf','01')`);
  await wait(`NOTES.mde.value().includes('p. 1]')`);await c.val(`askText=window.__askCross;noteFlushStato(NOTES)`);
  assert(fs.readFileSync(path.join(vault,'Zaini/storia/APPUNTI',nota.file),'utf8').includes('zaino-pdf:'));
  // Riapertura della citazione dopo rinomina del PDF: identità, non nome o numero.
  const old=path.join(vault,'Zaini/biologia/MATERIALI/PDF/01 Botanica.pdf'),ren=path.join(gruppo,'01 Botanica rinominata.pdf');fs.renameSync(old,ren);
  try{await c.val(`citazioneZainoApri(${q(cita.rimando)})`);await wait(`document.getElementById('citazioneTitolo').textContent.includes('rinominata')`);await c.clicca('#citazioneChiudi');}
  finally{fs.renameSync(ren,old);}
  await c.clicca('#noteClose');
 }finally{
  fs.rmSync(extra,{force:true});
  fs.rmSync(locale,{force:true});
  await c.val(`if(document.getElementById('citazioneDialog').open)document.getElementById('citazioneDialog').close();if(window.__askCross)askText=window.__askCross;if(window.__copiaPrima)navigator.clipboard.writeText=window.__copiaPrima;closePops();localStorage.clear();Object.entries(${q(prima.storage)}).forEach(([k,v])=>localStorage.setItem(k,v));cambiaZaino(${q(prima.z)},true);BANCO.stato=${q(prima.banco)};bancoSalva();bancoDisegna();document.documentElement.dataset.theme=${q(prima.tema)}`);
  if(fileCreato)fs.rmSync(fileCreato,{force:true});
  if(secondoCreato)fs.rmSync(secondoCreato,{force:true});
  await c.val(`closePdf();clearTimeout(LETTURA.timer);LETTURA.timer=null;LETTURA.attesa=null;`);await c.pausa(150);
  for(const [p,b] of letture){if(b)fs.writeFileSync(p,b);else fs.rmSync(p,{force:true});}
  await c.val(`letturaCarica()`);
 }
 console.log('citazioni tra zaini: menu aggiornato, ordine, inserimento e anteprima senza cambio del contesto OK');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
