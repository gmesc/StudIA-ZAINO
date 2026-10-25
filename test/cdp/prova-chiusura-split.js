'use strict';
const assert=require('node:assert/strict'),c=require('./cdp');
const q=JSON.stringify;
async function wait(expr){for(let i=0;i<150;i++){if(await c.val(expr))return;await c.pausa(80);}throw Error('Attesa: '+expr);}
const chiudi=b=>c.clicca('.blocco[data-blocco="'+b+'"] .bchiudi');
(async()=>{
 await c.collega();await wait(`typeof bancoStato==='function' && !!window.zainoStudio`);assert((await c.val('window.vault.path')).includes('studia-zaino-prova-'));
 await c.partiPulito();const prima=await c.val(`({stato:bancoStato(),attivo:BANCO.attivo,zoom:bancoZoomLeggi(),tema:document.documentElement.dataset.theme})`);
 try{
  await c.val(`BANCO.stato=BancoForme.normalizzaStato({forma:'quattro',blocchi:{A:'fonte',C:'appunti',B:'studio',D:'flashcard'}});BANCO.attivo='B';bancoSalva();bancoDisegna()`);
  assert.equal(await c.val(`document.querySelectorAll('#banco .blocco:not([hidden]) .bchiudi').length`),4);
  await wait(`!!NOTES.mde`);await c.val(`window.__chiusuraPane=document.getElementById('notePane');window.__chiusuraCM=NOTES.mde.codemirror;window.__chiusuraBody=NOTES.mde.value()`);
  // Una scrittura fallita impedisce di nascondere il documento interessato.
  await c.val(`window.__chiusuraFlush=noteFlush;noteFlush=()=>false`);await chiudi('C');assert.equal(await c.val('bancoBlocchiVisibili().length'),4);await c.val(`noteFlush=window.__chiusuraFlush`);
  await chiudi('C');await wait(`bancoBlocchiVisibili().length===3`);
  assert.deepEqual(await c.val(`BancoForme.blocchiInLettura(bancoStato().forma).map(b=>[bancoStrumentoIn(b),document.querySelector('.blocco[data-blocco="'+b+'"] .bnumero').textContent])`),[['fonte','1'],['studio','2'],['flashcard','3']]);
  assert(await c.val(`document.getElementById('notePane')===window.__chiusuraPane && NOTES.mde.codemirror===window.__chiusuraCM && NOTES.mde.value()===window.__chiusuraBody`));
  assert.equal(await c.val(`bancoStrumentoIn(bancoBloccoAttivo())`),'studio');assert.equal(await c.val(`document.activeElement.closest('.blocco').dataset.blocco`),await c.val('bancoBloccoAttivo()'));
  await c.val(`bancoForma('quattro')`);assert.equal(await c.val(`bancoVisibile('appunti')`),false,'la vista chiusa non ritorna cambiando forma');await c.val(`bancoForma('tre-sx')`);
  await chiudi('A');await wait(`bancoBlocchiVisibili().length===2`);await chiudi('C');await wait(`bancoBlocchiVisibili().length===1`);
  assert.equal(await c.val(`document.querySelector('#banco .blocco:not([hidden]) .bchiudi').disabled`),true);
  const salvato=await c.val('bancoStato()');await c.val('location.reload()');await c.pausa(500);await c.collega();await wait(`typeof bancoStato==='function' && !!window.zainoStudio`);assert.deepEqual(await c.val('bancoStato()'),salvato);
  for(const tema of ['chiaro','scuro']){
   await c.val(`document.documentElement.dataset.theme=${q(tema)}`);await c.pausa(300);
   assert(await c.val(`['.bhead .tendina','.bhead .bchiudi','#zainoNav .zs-azioni .tbtn'].every(sel=>getComputedStyle(document.querySelector(sel)).backgroundColor==='rgba(0, 0, 0, 0)')`));
   assert(await c.val(`(()=>{const area=document.createElement('div');area.className='ucallout';area.innerHTML='<button class="tbtn acc">Prova</button>';document.body.append(area);const ok=getComputedStyle(area.firstChild).backgroundColor==='rgba(0, 0, 0, 0)';area.remove();return ok;})()`));
  }
 }finally{await c.val(`if(window.__chiusuraFlush)noteFlush=window.__chiusuraFlush;BANCO.stato=${q(prima.stato)};BANCO.attivo=${q(prima.attivo)};bancoZoomScrivi(${q(prima.zoom)});document.documentElement.dataset.theme=${q(prima.tema)};bancoSalva();bancoDisegna()`);}
 console.log('chiusura split UI: ×, rinumerazione, ordine, documenti intatti, errore salvataggio, persistenza e fondi trasparenti OK');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
