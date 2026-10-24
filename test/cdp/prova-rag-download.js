'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),c=require('./cdp');
async function wait(expr){const fine=Date.now()+10000;while(Date.now()<fine){if(await c.val(expr))return;await c.pausa(80);}throw Error('Attesa: '+expr);}
async function click(sel){await c.val(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({block:'nearest'})`);await c.clicca(sel);}
(async()=>{
 await c.collega();await c.invia('Emulation.setFocusEmulationEnabled',{enabled:true});
 await wait(`typeof zainoAttivo==='function' && zainoAttivo()==='biologia' && !!document.getElementById('zragIndexOptions')`);
 const vault=await c.val('window.vault.path');assert(vault.includes('studia-zaino-prova-'));
 await c.partiPulito();
 const prima=await c.val(`({stato:JSON.parse(JSON.stringify(bancoStato())),attivo:BANCO.attivo,salvato:localStorage.getItem(bancoChiave()),tema:document.documentElement.dataset.theme,aperto:document.getElementById('zragIndexOptions').open,locale:Object.assign({},localStorage),zaino:MODO.zaino})`);
 const registro=path.join(path.dirname(vault),'dati','rag-downloads.jsonl');
 const richieste=()=>fs.existsSync(registro)?fs.readFileSync(registro,'utf8').trim().split('\n').filter(Boolean).map(s=>JSON.parse(s).modalita):[];
 const iniziali=richieste().length,cfg=await c.val('window.vault.chat.settings()'),chiavi=await c.val('window.vault.chat.keysStatus()');
 try{
  assert.equal(await c.val(`!!document.querySelector('#studioPane [data-download]')`),false,'I download sono usciti da Cerca e studia');
  await click('#settingsBtn');await click('.set-tab[data-tab="ai"]');
  assert.deepEqual(await c.val(`Array.from(document.querySelectorAll('.zchat-ai-section>.set-sec-h')).map(e=>e.textContent)`),['AI cloud','AI locale']);
  await wait(`document.getElementById('zchatSettingsProvider').options.length===5`);
  assert.deepEqual(await c.val(`Array.from(document.getElementById('zchatSettingsProvider').options).map(o=>o.value).filter(Boolean)`),['google','openai','anthropic','infomaniak']);
  await c.val(`document.getElementById('zchatSettingsProvider').value='infomaniak';document.getElementById('zchatSettingsProvider').dispatchEvent(new Event('change',{bubbles:true}))`);
  await wait(`!document.getElementById('zchatInfomaniak').hidden && !document.getElementById('zchatKeySave').disabled`);
  await c.val(`document.getElementById('zchatProductId').value='12345';document.getElementById('zchatKeyInput').value='chiave-infomaniak-finta'`);
  await click('#zchatKeySave');
  await wait(`window.vault.chat.keysStatus().then(r=>r.infomaniak.set)`);
  assert.equal((await c.val('window.vault.chat.settings()')).infomaniakProductId,'12345');
  assert.equal(await c.val(`document.getElementById('zchatKeyInput').value`),'');
  assert(await c.val(`!!document.querySelector('#zchatLocalSettings #zragDownloads')`));
  await c.val(`MODO.zaino=null;zainoStudio.refresh()`);

  await wait(`document.getElementById('zragModelSize-video').textContent.includes('MB')`);
  assert.equal(await c.val(`document.getElementById('zragModelName').textContent`),'EmbeddingGemma 2 · ONNX');
  assert.equal(await c.val(`document.getElementById('zragModelInfo').href`),'https://huggingface.co/onnx-community/embeddinggemma-2-ONNX');
  assert.equal(await c.val(`document.getElementById('zragModelInfo').target`),'_blank');
  assert.deepEqual(await c.val(`Array.from(document.querySelectorAll('.zrag-modelli strong')).map(e=>e.textContent)`),['text','vision','video']);
  assert(await c.val(`document.querySelector('#zragDownloads').textContent.includes('condividono i file') && document.querySelector('#zragDownloads').textContent.includes('ricerca nei contenuti visivi non è ancora attiva')`));
  for(const tema of ['chiaro','scuro']){
   await c.val(`document.documentElement.dataset.theme=${JSON.stringify(tema)};document.getElementById('zchatLocalSettings').scrollIntoView({block:'start'})`);
   const r=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/zaino-ai-impostazioni-'+tema+'.png',Buffer.from(r.result.data,'base64'));
  }
  for(const modalita of ['testo','vision','video']){
   const b=`[data-download="${modalita}"]`;
   if(await c.val(`document.querySelector(${JSON.stringify(b)}).disabled`))continue;
   await click(b);
   await wait(`window.vault.rag.state().then(r=>r.download && r.progress?.modalita===${JSON.stringify(modalita)})`);
   assert(await c.val(`Array.from(document.querySelectorAll('[data-download]')).every(b=>b.disabled)`));
   if(modalita==='vision'){
    await wait(`document.getElementById('zragDownloadStatus').textContent.includes('10%')`);
    await click('#zragDownloadCancel');await wait(`document.getElementById('zragDownloadStatus').textContent.includes('interrotto')`);
   }else{
    if(modalita==='video')await c.val(`MODO.zaino=${JSON.stringify(prima.zaino)};zainoStudio.refresh()`);
    await wait(`document.getElementById('zragDownloadStatus').textContent.includes('Download simulato')`);
   }
   await wait(`document.getElementById('zragDownloadCancel').hidden && !document.querySelector(${JSON.stringify(b)}).disabled`);
  }
  const scaricati=richieste().slice(iniziali);
  assert(scaricati.includes('vision'));assert(scaricati.includes('video'));
  if(!(await c.val('window.vault.rag.state()')).ready)assert(scaricati.includes('testo'));
  const nonValido=await c.val(`window.vault.rag.install('non-valido')`);assert.equal(nonValido.ok,false);assert.match(nonValido.error,/Modalità/);
  await click('#settingsClose');
  await c.val(`bancoForma('uno');bancoAssegna('A','studio');document.getElementById('zragIndexOptions').open=true`);
  await click('#zragSettings');
  assert(await c.val(`!document.getElementById('settingsModal').hidden && document.querySelector('.set-tab[data-tab="ai"]').getAttribute('aria-selected')==='true'`));
  console.log('✓ impostazioni AI: quattro provider, chiave Infomaniak, download text/vision/video senza zaino, progresso, annullamento, cambio zaino e scorciatoia');
 }finally{
  await c.val(`MODO.zaino=${JSON.stringify(prima.zaino)};document.getElementById('settingsClose').click()`);
  await c.val(`document.documentElement.dataset.theme=${JSON.stringify(prima.tema)};document.getElementById('zragIndexOptions').open=${prima.aperto};BANCO.stato=${JSON.stringify(prima.stato)};BANCO.attivo=${JSON.stringify(prima.attivo)};bancoDisegna();`);
  await c.val(`window.vault.chat.saveSettings(${JSON.stringify({...cfg,infomaniakProductId:cfg.infomaniakProductId||''})})`);
  if(!chiavi.infomaniak?.set)await c.val(`window.vault.chat.clearKey({provider:'infomaniak'})`);
  await c.val(`localStorage.clear();Object.entries(${JSON.stringify(prima.locale)}).forEach(([k,v])=>localStorage.setItem(k,v))`);
  await c.val(`(()=>{const v=${JSON.stringify(prima.salvato)};if(v===null)localStorage.removeItem(bancoChiave());else localStorage.setItem(bancoChiave(),v);})()`);
 }
 await c.val('location.reload()');c.ws().close();
})().catch(e=>{console.error(e);if(c.ws())c.ws().close();process.exitCode=1;});
