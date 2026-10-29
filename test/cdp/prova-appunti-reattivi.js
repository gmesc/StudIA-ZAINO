'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),c=require('./cdp');
let prima,marker;
async function aspetta(expr){for(let i=0;i<100;i++){if(await c.val(expr))return;await c.pausa(100);}throw Error('Attesa scaduta: '+expr);}
(async()=>{
 await c.collega();await c.partiPulito();
 const vault=await c.val('window.vault.path');assert(vault.includes('studia-zaino-prova-'),'solo vault sintetico');
 const dati=path.join(path.dirname(vault),'dati'),log=path.join(dati,'scansioni.jsonl');marker=path.join(dati,'misura-scansioni');
 prima=await c.val(`(()=>{noteFlush();return {banco:JSON.parse(JSON.stringify(bancoStato())),file:NOTES.cur?.file,body:NOTES.mde?.value()||''};})()`);
 await c.val(`(()=>{bancoForma('quattro');bancoAssegna('A','fonte');bancoAssegna('C','fonte2');bancoAssegna('B','appunti');bancoAssegna('D','lim');notesReload();noteOpen(NOTES.list[0].file,NOTES);if(NOTES.mde.isPreviewActive())NOTES.mde.togglePreview();if(NOTES.mde.isSideBySideActive())NOTES.mde.toggleSideBySide();window.__navPrima=zainoNavAggiorna;window.__navSalvataggi=0;zainoNavAggiorna=function(...a){__navSalvataggi++;return __navPrima(...a);};})()`);
 await c.pausa(2500);fs.writeFileSync(log,'');fs.writeFileSync(marker,'1');
 const originale=await c.val('({file:NOTES.cur.file,body:NOTES.mde.value()})');
 try{
  await c.val(`__navSalvataggi=0;NOTES.mde.codemirror.focus();NOTES.mde.codemirror.setCursor({line:0,ch:0})`);
  await c.invia('Input.insertText',{text:'Testo autosalvato. '});
  await aspetta('!NOTES.dirty');await c.pausa(1700);
  const testo=fs.readFileSync(path.join(vault,'Zaini/biologia/APPUNTI',originale.file),'utf8');assert(testo.includes('Testo autosalvato. '));
  assert((await c.val('NOTES.mde.value()')).includes('Testo autosalvato. '),'il testo resta visibile');
  assert.equal(await c.val('__navSalvataggi'),0,'nessuna ricostruzione sidebar al salvataggio');
  assert.equal(fs.readFileSync(log,'utf8').trim(),'','Schede e Ripasso nascosti non rileggono le fonti');
  await c.val(`bancoMostra('studio')`);await aspetta(`document.querySelector('#zschedeCollectionStatus').textContent.includes('schede')`);await c.pausa(600);
  assert(fs.readFileSync(log,'utf8').trim(),'riaprire Schede aggiorna i contenuti rimasti in attesa');
  console.log('✓ autosalvataggio visibile e su disco; nessuna scansione nascosta; aggiornamento alla riapertura');
 }finally{
  fs.rmSync(marker,{force:true});
  await c.val(`(()=>{zainoNavAggiorna=__navPrima;NOTES.mde.value(${JSON.stringify(originale.body)});noteSave(true,NOTES);if(${JSON.stringify(prima.file||'')})noteOpen(${JSON.stringify(prima.file||'')},NOTES);BANCO.stato=${JSON.stringify(prima.banco)};bancoSalva();bancoDisegna();delete window.__navPrima;delete window.__navSalvataggi;})()`);
 }
 process.exit(0);
})().catch(e=>{if(marker)fs.rmSync(marker,{force:true});console.error(e);process.exit(1);});
