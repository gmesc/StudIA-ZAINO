'use strict';
// Attraversa il preload e l'IPC dell'app, senza richiedere un'interfaccia ancora da progettare.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),c=require('./cdp');
const M=require('../../App/assets/presentazioni/modello');
(async()=>{
 await c.collega();let documento;
 try{
  for(let n=0;n<100&&!await c.val('!!window.vault?.presentazioni');n++)await c.pausa(100);
  const vault=await c.val('window.vault.path');assert(vault.includes('studia-zaino-prova-'),'Solo vault sintetico');
  const call=o=>c.val('window.vault.presentazioni.comando('+JSON.stringify({corso:'biologia',...o})+')');
  assert.deepEqual((await call({azione:'strumenti'})).strumenti,{presenta:'PRESENTA',gobbo:'GOBBO'});
  const iniziale=await call({azione:'crea',title:'Fondazioni PRESENTA'});assert(iniziale.ok,iniziale.error);documento=iniziale.documento;
  let d=M.applica(documento,{tipo:'inserisciBlocco',slideId:documento.stacks[0].slides[0].id,block:{type:'text',slot:'body',markdown:'Contenuto conservato \\(x^2\\)'}});
  d.stacks[0].slides[0].notes.markdown='PRIVATO_CDP';
  const salvato=await call({azione:'salva',documento:d,baseRevision:1});assert(salvato.ok,salvato.error);d=salvato.documento;
  const aperto=await call({azione:'apri',id:d.id});assert.equal(aperto.documento.stacks[0].slides[0].blocks[0].markdown,'Contenuto conservato \\(x^2\\)');
  const html=await call({azione:'compila',documento:d});assert(html.ok,html.error);assert(html.html.includes('katex'));assert(!html.html.includes('PRIVATO_CDP'));
  assert(!(await call({azione:'salva',documento:d,baseRevision:1})).ok,'revisione obsoleta rifiutata anche dal ponte reale');
  const bozza={...d,title:'Bozza recuperabile'};assert((await call({azione:'bozza',documento:bozza,baseRevision:2})).ok);
  assert.equal((await call({azione:'recupera',id:d.id})).bozza.documento.title,'Bozza recuperabile');
  assert(!(await call({azione:'apri',id:d.id,corso:'storia'})).ok,'nessun trasferimento implicito tra zaini');
  assert.equal((await call({azione:'apri',id:d.id})).documento.title,'Fondazioni PRESENTA');
  console.log('✓ PRESENTA nell’app ZAINO: preload, salvataggio, riapertura, conflitti, recupero, formule e note private');
 }finally{
  if(documento){const vault=await c.val('window.vault.path');if(vault.includes('studia-zaino-prova-'))fs.rmSync(path.join(vault,'Zaini/biologia/PRESENTAZIONI',documento.id),{recursive:true,force:true});}
  c.ws()?.close();
 }
})().catch(e=>{console.error(e);c.ws()?.close();process.exitCode=1;});
