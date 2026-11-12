'use strict';
const A=require('node:assert/strict'),c=require('./cdp'),q=JSON.stringify,fs=require('node:fs');
async function wait(e){for(let i=0;i<300;i++){if(await c.val(e))return;await c.pausa(100);}throw Error('Attesa: '+e);}
async function scegli(id){await c.clicca('#noteHost .note-lingua');await c.clicca('.note-dizionari-menu [data-lingua="'+id+'"]');}
(async()=>{
 await c.collega();await wait("typeof AppuntiDizionari!=='undefined'&&zainoAttivo()==='biologia'");await c.partiPulito();const prima=await c.val('({...localStorage})'),vault=await c.val('vault.path');A(vault.includes('studia-zaino-prova-'));let file;
 try{
  file=await c.val("(()=>{const n=notesApi().save('biologia',null,{title:'Dizionari UI'},'La conoscenza è utile.');notesReload();bancoForma('uno');bancoAssegna('A','appunti');noteOpen(n.file,NOTES);AppuntiA4.scegli(NOTES,'scrittura');return n.file;})()");
  await scegli('it-en');
  const misura=await c.val("(()=>{const b=document.querySelector('#noteHost .note-lingua'),r=b.getBoundingClientRect(),t=b.querySelector('.note-lingua-misura').getBoundingClientRect(),i=b.querySelector('svg').getBoundingClientRect();return {testo:b.querySelector('.note-lingua-misura span').textContent,w:r.width,tw:t.width,iw:i.width,dx:i.right-r.right,font:getComputedStyle(b).fontFamily};})()");
  A.equal(misura.testo,'ITA + ENG');A(misura.w>=misura.tw+misura.iw+16&&misura.w<=misura.tw+misura.iw+40,JSON.stringify(misura));A(misura.dx<0,'chevron dentro il bottone');
  await c.clicca('#noteHost .note-lingua');
  A.deepEqual(await c.val("[...document.querySelectorAll('.note-dizionari-menu button')].slice(-2).map(b=>b.dataset.dizionariAzione)"),['scarica','abbina']);
  fs.writeFileSync('/private/tmp/zaino-dizionari-menu.png',Buffer.from((await c.invia('Page.captureScreenshot',{format:'png'})).result.data,'base64'));
  await c.clicca('[data-dizionari-azione=scarica]');await wait("document.querySelectorAll('[data-dizionario-scarica]').length===3");
  if(process.env.STUDIA_DIZIONARI_RETE==='1'){
   for(const id of ['fr','de','es']){
    if(!await c.val(`document.querySelector('[data-dizionario-scarica=${id}]').disabled`)){await c.clicca('[data-dizionario-scarica='+id+']');await wait(`document.querySelector('[data-dizionario-scarica=${id}]').textContent==='Installato'||!document.querySelector('[data-dizionario-scarica=${id}]').disabled`);A.equal(await c.val(`document.querySelector('[data-dizionario-scarica=${id}]').textContent`),'Installato',await c.val("document.querySelector('.note-dizionari-dialog').innerText"));}
   }
   A((await c.val('vault.dizionari.catalogo()')).lingue.every(l=>l.installato));
  }
  await c.clicca('.note-dizionari-dialog [aria-label=Chiudi]');
  if(process.env.STUDIA_DIZIONARI_RETE==='1'){
   for(const [id,testo,errore] of [['de','Schule Wörterbuch Wörterbuhc','Wörterbuhc'],['es','escuela corazón corasón','corasón']]){
    await scegli(id);await c.val(`NOTES.mde.codemirror.setValue(${q(testo)})`);await wait(`[...document.querySelectorAll('#noteHost .note-errore-ortografico')].some(e=>e.textContent===${q(errore)})`);
    A.deepEqual(await c.val("[...document.querySelectorAll('#noteHost .note-errore-ortografico')].map(e=>e.textContent)"),[errore]);
   }
  }

  await c.clicca('#noteHost .note-lingua');await c.clicca('[data-dizionari-azione=abbina]');await wait("!!document.querySelector('[aria-label=\"Secondo dizionario\"]')");
  const seconda=process.env.STUDIA_DIZIONARI_RETE==='1'?'fr':'en';
  await c.val(`(()=>{const s=document.querySelector('[aria-label="Secondo dizionario"]');s.value='${seconda}';s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await c.clicca('.note-dizionari-dialog .tbar:last-child button:last-child');
  A.equal(await c.val('localStorage.getItem("zaino.appunti.secondaLingua")'),seconda);
  await scegli('it-'+seconda);
  if(seconda==='fr'){
   await c.val("NOTES.mde.codemirror.setValue('La conoscenza bonjour école bonjouur.');noteFlush()");
   await wait("[...document.querySelectorAll('#noteHost .note-errore-ortografico')].some(e=>e.textContent==='bonjouur')");
   A.deepEqual(await c.val("[...document.querySelectorAll('#noteHost .note-errore-ortografico')].map(e=>e.textContent)"),['bonjouur']);
   await c.invia('Page.reload');await wait("typeof AppuntiDizionari!=='undefined'&&!!NOTES.mde&&NOTES.cur?.file==="+q(file));
   await wait("document.querySelector('#noteHost .note-lingua')?.dataset.lingua==='it-fr'");
   await wait("!!document.querySelector('#noteHost .note-errore-ortografico')");
   A.deepEqual(await c.val("[...document.querySelectorAll('#noteHost .note-errore-ortografico')].map(e=>e.textContent)"),['bonjouur']);
   console.log('✓ Download reali FRA/TED/SPA, coppia ITA + FRA e controllo locale dopo riapertura');
  }
  console.log('✓ Sigle compatte, chevron senza sovrapposizione, azioni reali e preferenza della coppia persistente');
 }finally{
  await c.val(`document.querySelectorAll('.note-dizionari-dialog').forEach(d=>d.close());document.querySelectorAll('.note-dizionari-menu').forEach(d=>d.remove());noteMolla();localStorage.clear();Object.entries(${q(prima)}).forEach(([k,v])=>localStorage.setItem(k,v));window.dispatchEvent(new Event('zaino:ortografia'))`);
  if(file)require('../../lib/appunti').remove(vault,'biologia',file);await c.val('notesReload()');c.ws().close();
 }
})().catch(e=>{console.error(e);c.ws()?.close();process.exitCode=1;});
