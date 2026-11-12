'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),c=require('./cdp');
async function wait(expr){for(let n=0;n<180;n++){if(await c.val(expr))return;await c.pausa(80);}throw Error('Attesa: '+expr+'; stato: '+JSON.stringify(await c.val('({bottone:document.getElementById("zragIndex").textContent,automatico:document.getElementById("zragAutoStatus").textContent,stato:document.getElementById("zragStatus").textContent,opzioni:document.getElementById("zragIndexOptions").open})')));}
async function click(sel){await c.val(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({block:'nearest'})`);await c.clicca(sel);}
(async()=>{
 await c.collega();await wait(`typeof zainoAttivo==='function' && !!zainoAttivo() && !!document.getElementById('zragIndex')`);
 if(process.env.STUDIA_RAG_MODEL){console.log('SKIP: indice adattivo simulato; il modello reale è verificato da prova-rag-locale.');c.ws().close();return;}
 const vault=await c.val('window.vault.path');assert(vault.includes('studia-zaino-prova-'));
 await c.partiPulito();
 const prima=await c.val(`({zaino:zainoAttivo(),banco:JSON.parse(JSON.stringify(bancoStato())),attivo:BANCO.attivo,locale:Object.assign({},localStorage),tema:document.documentElement.dataset.theme})`);
 // Un indice precedente è uno stato legittimo: la prova della creazione usa uno zaino proprio.
 const Z=require('../../lib/zaini'),N=require('../../lib/appunti'),z=Z.crea(vault,'Indice adattivo '+Date.now()).id;assert(z);
 const nota=N.save(vault,z,null,{title:'Fonte indice'},'La fotosintesi converte la luce in energia chimica.'),file=path.join(vault,'Zaini',z,'APPUNTI',nota.file),old=fs.readFileSync(file),dir=path.join(vault,'Zaini',z,'_lavorazione/rag'),marker=path.join(path.dirname(vault),'dati/rag-runtime-finto'),markerPrima=fs.existsSync(marker)?fs.readFileSync(marker):null;
 try{
  await c.val(`zainiAggiorna();cambiaZaino(${JSON.stringify(z)},true)`);await wait(`zainoAttivo()===${JSON.stringify(z)}`);
  await c.val(`bancoForma('due-col');bancoAssegna('A','studio');bancoAssegna('C','appunti');bancoAttivaBlocco('A');document.getElementById('zragIndexOptions').open=false;document.getElementById('zragSearch').open=true`);
  await wait(`document.getElementById('zragIndex').textContent==='Attiva indice'`);
  assert(await c.val(`!!document.querySelector('#zragSearch>#zragIndex') && !document.getElementById('zragReset')`));
  await click('#zragIndex');assert(await c.val(`!document.getElementById('settingsModal').hidden && !!document.querySelector('#zchatLocalSettings #zragDownloads')`));await click('#settingsClose');
  // Il modello finto si attiva fuori dall'app: evita che il timer automatico anticipi il clic manuale.
  await c.val('window.vault.rag.watch(null)');fs.writeFileSync(marker,'solo prova');
  await c.val(`document.getElementById('zragIndexOptions').open=true`);await wait(`document.getElementById('zragIndex').textContent==='Crea indice'`);
  await c.val(`document.getElementById('zragIndexOptions').open=false;document.getElementById('zragSearch').open=true`);await click('#zragIndex');
  for(let n=0;n<180&&!fs.existsSync(path.join(dir,'indice.json'));n++)await c.pausa(80);assert(fs.existsSync(path.join(dir,'indice.json')));await c.val(`window.vault.rag.watch(${JSON.stringify(z)})`);
  await wait(`document.getElementById('zragIndex').textContent==='Ricostruisci indice' && !document.getElementById('zragIndex').disabled`);
  assert(fs.existsSync(path.join(dir,'indice.json')));assert(fs.readdirSync(path.join(dir,'vettori')).some(f=>f.endsWith('.bin')));
  fs.writeFileSync(file,Buffer.concat([old,Buffer.from('\nUna modifica per la prova dell’indice adattivo.')]));
  await wait(`document.getElementById('zragIndex').textContent==='Aggiorna indice'`);await click('#zragIndex');
  await wait(`document.getElementById('zragIndex').textContent==='Ricostruisci indice' && !document.getElementById('zragIndex').disabled`);
  await click('#zragIndex');await wait(`document.getElementById('zragStatus').textContent.includes('0 riutilizzati')`);
  await wait(`document.getElementById('zragIndex').textContent==='Ricostruisci indice' && !document.getElementById('zragIndex').disabled`);
  assert(fs.readFileSync(file,'utf8').includes('Una modifica per la prova'));
  for(const tema of ['chiaro','scuro']){
   await c.val(`document.documentElement.dataset.theme=${JSON.stringify(tema)}`);
   assert(await c.val(`(()=>{const b=document.getElementById('zragIndex').getBoundingClientRect(),p=document.getElementById('studioPane').getBoundingClientRect();return b.width>0 && b.left>=p.left && b.right<=p.right+1;})()`),'Il comando è accessibile anche nello split affiancato');
   const r=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/zaino-indice-'+tema+'.png',Buffer.from(r.result.data,'base64'));
  }
  console.log('✓ indice adattivo: attivazione, creazione, aggiornamento, ricostruzione, cache su disco, appunti conservati e barra accessibile nei due temi');
 }finally{
  await c.val(`(async()=>{await vault.rag.cancel('index');await vault.rag.watch(null);})()`);if(markerPrima)fs.writeFileSync(marker,markerPrima);else fs.rmSync(marker,{force:true});
  await c.val(`cambiaZaino(${JSON.stringify(prima.zaino)},true)`);await wait(`zainoAttivo()===${JSON.stringify(prima.zaino)}`);fs.rmSync(path.join(vault,'Zaini',z),{recursive:true,force:true});
  await c.val(`document.documentElement.dataset.theme=${JSON.stringify(prima.tema)};document.getElementById('zragIndexOptions').open=false;BANCO.stato=${JSON.stringify(prima.banco)};BANCO.attivo=${JSON.stringify(prima.attivo)};bancoDisegna();localStorage.clear();Object.entries(${JSON.stringify(prima.locale)}).forEach(([k,v])=>localStorage.setItem(k,v));location.reload()`);

 }
 c.ws().close();
})().catch(e=>{console.error(e);if(c.ws())c.ws().close();process.exitCode=1;});
