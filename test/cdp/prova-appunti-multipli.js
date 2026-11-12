'use strict';
const assert=require('node:assert/strict'),c=require('./cdp'),fs=require('node:fs'),q=JSON.stringify;
async function aspetta(expr){for(let i=0;i<150;i++){if(await c.val(expr))return;await c.pausa(80);}throw Error('Attesa: '+expr);}
(async()=>{
 await c.collega();await aspetta(`typeof bancoStato==='function'&&zainoAttivo()==='biologia'`);assert((await c.val('vault.path')).includes('studia-zaino-prova-'));await c.partiPulito();
 const prima=await c.val(`({banco:bancoStato(),memoria:{...localStorage}})`);let files=[];
 try{
  files=await c.val(`(()=>{const files=Array.from({length:9},(_,i)=>notesApi().save(corsoAttivo(),null,{title:'Prova multi '+i},'Appunto '+i).file);notesReload();bancoForma('quattro');bancoBlocchiVisibili().forEach(b=>bancoAssegnaDaMenu(b,'appunti'));return files;})()`);
  assert.equal(await c.val(`noteStati().filter(s=>bancoVisibile(s.id)).length`),4,'quattro istanze scelte dalla stessa voce Appunti');
  await c.val(`BancoForme.registraForma('mia-prova-nove','Nove','"A C E" "B D F" "G H I"');bancoForma('mia-prova-nove');bancoBlocchiVisibili().forEach(b=>bancoAssegnaDaMenu(b,'appunti'));noteStati().forEach((s,i)=>noteOpen(${q(files)}[i],s))`);
  await aspetta(`noteStati().length===9&&noteStati().every(s=>s.cur&&s.mde)`);
  const righe=await c.val(`noteStati().map(s=>{const h=noteHost(s),bar=h.querySelector('.editor-toolbar');return {file:s.cur.file,comandi:[...bar.querySelectorAll('button')].map(b=>b.className.replace(/\\bactive\\b/g,'').trim()),altezza:getComputedStyle(bar.querySelector('button')).height,host:h.clientHeight,pdf:!!noteEl('notePdf',s),select:noteEl('noteSelect',s).closest('.bhead')!=null};})`);
  assert.equal(righe.length,9);assert(righe[0].comandi.length>15);for(const r of righe){assert.deepEqual(r.comandi,righe[0].comandi);assert.equal(r.altezza,righe[0].altezza);assert(r.host>0&&r.pdf&&r.select);}
  console.log('  ok nove editor con toolbar completa identica e selettore nella testata');
  for(let i=0;i<9;i++){
   await c.val(`(()=>{const s=noteStati()[${i}],cm=s.mde.codemirror;noteAttiva(s);cm.setCursor(cm.lastLine(),cm.getLine(cm.lastLine()).length);cm.focus();})()`);
   await c.invia('Input.insertText',{text:' testo '+i});await c.val(`noteSave(true,noteStati()[${i}])`);
  }
  assert.deepEqual(await c.val(`notesApi().list(corsoAttivo()).filter(n=>${q(files)}.includes(n.file)).sort((a,b)=>${q(files)}.indexOf(a.file)-${q(files)}.indexOf(b.file)).map(n=>n.body.replace(/\\s+/g,' ').trim())`),files.map((_,i)=>'Appunto '+i+' testo '+i),'ogni editor scrive nel proprio file');
  const memoria=await c.val(`apertoLeggi()[corsoAttivo()]`);files.forEach((f,i)=>assert.equal(memoria['appunto'+(i?i+1:'')],f));
  await c.val(`noteStati().forEach(noteSvuota);APERTO.ripristinato='';apertoRipristina()`);await aspetta(`noteStati().every(s=>s.cur)`);
  assert.deepEqual(await c.val(`noteStati().map(s=>s.cur.file)`),files,'ripristino indipendente delle nove note');
  await c.val(`bancoZoom(bancoBloccoDi('appunti9'))`);await c.pausa(150);await c.val(`bancoZoomTorna()`);
  assert.equal(await c.val(`noteStati()[8].mde.value().replace(/\\s+/g,' ').trim()`),'Appunto 8 testo 8');
  const foto=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/private/tmp/zaino-appunti-nove.png',Buffer.from(foto.result.data,'base64'));
  console.log('✓ nove appunti: comandi, scrittura, salvataggi, memorie e ritorno ai banchi');
 }finally{
  await c.val(`(async()=>{noteFlush();noteStati().forEach(noteSvuota);for(const f of ${q(files)})await notesApi().remove(corsoAttivo(),f);notesReload();localStorage.clear();Object.entries(${q(prima.memoria)}).forEach(([k,v])=>localStorage.setItem(k,v));BANCO.stato=${q(prima.banco)};bancoDisegna();})()`);
 }
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
