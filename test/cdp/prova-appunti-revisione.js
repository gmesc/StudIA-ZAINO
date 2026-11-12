'use strict';
const A=require('node:assert/strict'),c=require('./cdp'),q=JSON.stringify;
async function wait(e){for(let i=0;i<120;i++){if(await c.val(e))return;await c.pausa(100);}throw Error('Attesa: '+e);}
(async()=>{
 await c.collega();await wait("typeof EvidenzeAppunti!=='undefined'&&zainoAttivo()==='biologia'");await c.partiPulito();
 const vault=await c.val('vault.path');A(vault.includes('studia-zaino-prova-'));const precedenti=await c.val('evidenzeApi().leggi(corsoAttivo()).evidenze');let origine,dest;const errori=[];
 try{
  const dati=await c.val(`(()=>{const n=notesApi().save('biologia',null,{title:'Origine revisione'},'I mitocondri producono energia.');const ev=evidenzeApi().aggiungi(corsoAttivo(),{appunto:n.file,exact:'mitocondri',prefix:'I ',suffix:' producono energia.',tratto:'overlay',colore:'#ffeb3b'}).evidenza;const d=notesApi().save('biologia',null,{title:'Destinazione revisione'},kwMarkdown(ev));evidenzeApi().aggiungi(corsoAttivo(),{materiale:'01 Botanica.pdf',pagina:1,exact:'botanica'});notesReload();evidenzeCarica();bancoForma('due-col');bancoAssegna('A','appunti');bancoAssegna('C','keyword');noteOpen(n.file,NOTES);AppuntiA4.scegli(NOTES,'scrittura');evidenzeDisegna();return {origine:n.file,dest:d.file,id:ev.id};})()`);({origine,dest}=dati);
  await wait("!!document.querySelector('.note-evidenza')");
  const colore=await c.val("getComputedStyle(document.querySelector('.note-evidenza')).backgroundColor");if(colore!=='rgb(255, 235, 59)')errori.push('Saturazione APPUNTI: '+colore+'; atteso rgb(255, 235, 59)');
  await c.clicca('[data-kw-origine=fonti]');
  if(!await c.val("document.querySelector('[data-kw-origine=fonti]').getAttribute('aria-pressed')==='true'&&document.querySelector('[data-kw-origine=appunti]').getAttribute('aria-pressed')==='false'&&[...document.querySelectorAll('.kwchip')].every(b=>!kwDaId(b.dataset.kw).appunto)"))errori.push('FONTI non esclude APPUNTI');
  await c.val(`noteOpen(${q(dest)},NOTES);NOTES.mde.togglePreview()`);await wait("!!document.querySelector('#noteHost .editor-preview-active a.evlink')");
  await c.clicca('#noteHost .editor-preview-active a.evlink');await c.pausa(200);
  const stati=await c.val('noteStati().filter(s=>s.cur).map(s=>({file:s.cur.file,preview:s.mde.isPreviewActive()||AppuntiA4.attiva(s),visibile:noteHost(s).getBoundingClientRect().width>0}))');
  if(!stati.some(s=>s.file===dest&&s.preview&&s.visibile)||!stati.some(s=>s.file===origine&&s.preview&&s.visibile))errori.push('Rimando non apre un banco separato in anteprima: '+JSON.stringify(stati));
  const icone=await c.val(`(()=>{const pv=noteHost(noteStati().find(s=>s.cur?.file===${q(origine)})).querySelector('.editor-preview-active'),w=document.createTreeWalker(pv,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){const i=n.textContent.indexOf('mitocondri');if(i<0)continue;const r=document.createRange();r.setStart(n,i);r.setEnd(n,i+10);const sel={range:r,testo:'mitocondri'},misura=id=>[...document.querySelectorAll(id+' .ctx-cal .ui-icon')].map(e=>{const s=getComputedStyle(e);return {w:s.width,h:s.height,tratto:s.strokeWidth};});selBarraApri(sel);const fonti=misura('#selBarra');selMenuApri(100,100,sel);const appunti=misura('#selMenu');selMenuChiudi();return {fonti,appunti};}})()`);
  A(icone.fonti.length>0);A.deepEqual(icone.fonti,icone.appunti);A(icone.appunti.every(i=>i.w==='18px'&&i.h==='18px'));
  await c.val(`AppuntiA4.scegli(noteStati().find(s=>s.cur?.file===${q(dest)}),'a4')`);
  await wait("!!document.querySelector('#noteHost .note-a4 a.evlink')");await c.clicca('#noteHost .note-a4 a.evlink');
  A(await c.val(`noteStati().filter(s=>[${q(origine)},${q(dest)}].includes(s.cur?.file)).every(s=>AppuntiA4.attiva(s))`),'Rimando conserva anche la modalità A4');
  A.deepEqual(errori,[]);console.log('✓ Colore pieno come FONTI, filtro esclusivo e origine in un altro banco in anteprima');
 }finally{
  await c.val("noteStati().filter(s=>s.mde).forEach(s=>AppuntiA4.scegli(s,'scrittura'));noteMolla();KW.origini={fonti:true,appunti:true}");const N=require('../../lib/appunti');for(const f of [origine,dest])if(f)N.remove(vault,'biologia',f);require('../../lib/evidenze').salva(vault,'biologia',precedenti);await c.val('notesReload();evidenzeCarica();evidenzeDisegna()');c.ws().close();
 }
})().catch(e=>{console.error(e);c.ws()?.close();process.exitCode=1;});
