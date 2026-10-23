'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),c=require('./cdp');
async function wait(expr){const fine=Date.now()+10000;while(Date.now()<fine){if(await c.val(expr))return;await c.pausa(80);}throw Error('Attesa: '+expr);}
async function click(sel){await c.val(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({block:'nearest'})`);await c.clicca(sel);}
(async()=>{
 await c.collega();await c.invia('Emulation.setFocusEmulationEnabled',{enabled:true});
 await wait(`typeof zainoAttivo==='function' && zainoAttivo()==='biologia' && !!document.getElementById('zragIndexOptions')`);
 const vault=await c.val('window.vault.path');assert(vault.includes('studia-zaino-prova-'));
 await c.partiPulito();
 const prima=await c.val(`({stato:JSON.parse(JSON.stringify(bancoStato())),attivo:BANCO.attivo,salvato:localStorage.getItem(bancoChiave()),tema:document.documentElement.dataset.theme,aperto:document.getElementById('zragIndexOptions').open})`);
 const registro=path.join(path.dirname(vault),'dati','rag-downloads.jsonl');
 const richieste=()=>fs.existsSync(registro)?fs.readFileSync(registro,'utf8').trim().split('\n').filter(Boolean).map(s=>JSON.parse(s).modalita):[];
 const iniziali=richieste().length;
 try{
  await c.val(`bancoForma('uno');bancoAssegna('A','studio');document.getElementById('zragIndexOptions').open=true`);
  await wait(`document.getElementById('zragModelSize-video').textContent.includes('MB')`);
  assert.equal(await c.val(`document.getElementById('zragModelName').textContent`),'EmbeddingGemma 2 · ONNX');
  assert.equal(await c.val(`document.getElementById('zragModelInfo').href`),'https://huggingface.co/onnx-community/embeddinggemma-2-ONNX');
  assert.equal(await c.val(`document.getElementById('zragModelInfo').target`),'_blank');
  assert.deepEqual(await c.val(`Array.from(document.querySelectorAll('.zrag-modelli strong')).map(e=>e.textContent)`),['Testo','Visione','Video']);
  assert(await c.val(`document.querySelector('#zragIndexOptions').textContent.includes('condividono i file') && document.querySelector('#zragIndexOptions').textContent.includes('ricerca nei contenuti visivi non è ancora attiva')`));
  for(const tema of ['chiaro','scuro']){
   await c.val(`document.documentElement.dataset.theme=${JSON.stringify(tema)}`);
   const r=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/zaino-modelli-'+tema+'.png',Buffer.from(r.result.data,'base64'));
  }
  for(const modalita of ['testo','vision','video']){
   const b=`[data-download="${modalita}"]`;
   if(await c.val(`document.querySelector(${JSON.stringify(b)}).disabled`))continue;
   await click(b);
   await wait(`window.vault.rag.state().then(r=>r.download && r.progress?.modalita===${JSON.stringify(modalita)})`);
   assert(await c.val(`Array.from(document.querySelectorAll('[data-download]')).every(b=>b.disabled)`));
   if(modalita==='vision'){
    await wait(`document.getElementById('zragStatus').textContent.includes('10%')`);
    await click('#zragCancel');await wait(`document.getElementById('zragStatus').textContent.includes('interrotto')`);
   }else await wait(`document.getElementById('zragStatus').textContent.includes('Download simulato')`);
   await wait(`document.getElementById('zragCancel').hidden && !document.querySelector(${JSON.stringify(b)}).disabled`);
  }
  const scaricati=richieste().slice(iniziali);
  assert(scaricati.includes('vision'));assert(scaricati.includes('video'));
  if(!(await c.val('window.vault.rag.state()')).ready)assert(scaricati.includes('testo'));
  const nonValido=await c.val(`window.vault.rag.install('non-valido')`);assert.equal(nonValido.ok,false);assert.match(nonValido.error,/Modalità/);
  console.log('✓ download: Testo/Visione/Video, identità ONNX e link HF, IPC, progresso, annullamento e errori');
 }finally{
  await c.val(`document.documentElement.dataset.theme=${JSON.stringify(prima.tema)};document.getElementById('zragIndexOptions').open=${prima.aperto};BANCO.stato=${JSON.stringify(prima.stato)};BANCO.attivo=${JSON.stringify(prima.attivo)};bancoDisegna();`);
  await c.val(`(()=>{const v=${JSON.stringify(prima.salvato)};if(v===null)localStorage.removeItem(bancoChiave());else localStorage.setItem(bancoChiave(),v);})()`);
 }
 c.ws().close();
})().catch(e=>{console.error(e);if(c.ws())c.ws().close();process.exitCode=1;});
