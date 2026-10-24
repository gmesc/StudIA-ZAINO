/* Ricerca e schede sono uno strumento del Banco, con un ambito proprio. */
(function(root,factory){
 if(typeof module==='object' && module.exports)module.exports=factory();
 else {root.ZainoStudio=factory();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',root.ZainoStudio.crea);else root.ZainoStudio.crea();}
}(typeof self!=='undefined'?self:this,function(){
 'use strict';
 function crea(){
  const host=document.getElementById('studioPane');if(!host||host.children.length)return;
  const state={zaino:null,scope:{mode:'all',sourceIds:[],wikipedia:false},sources:[]},api=window.vault.rag;
  host.innerHTML=`<div class="tbar" id="zragToolbar" role="toolbar" aria-label="Ricerca e fonti"><span class="tbsep"></span><button class="tbtn" id="zragOpenReview" type="button" title="Apre lo split Ripasso: scegli le fonti e allenati con domande e risposte.">Apri Ripasso</button></div><div id="zragScopeHost"></div>
   <div id="zstudio" class="zstudio zstudio-banco"><h2>Cerca e studia le fonti</h2>
   <p class="zchat-hint">Cerca nei documenti e negli appunti selezionati, usando l’indice locale. Le schede generate si consultano nella sezione Schede; sintesi e domande usano il provider AI configurato.</p>
   <form id="zragForm" class="zstudio-actions"><label class="zchat-sr" for="zragQuery">Cerca nei materiali per parole o significato</label><input class="ctl-input" id="zragQuery" placeholder="Che cosa vuoi trovare?" maxlength="12000"><button class="tbtn acc" type="submit">Cerca</button></form>
   <div class="zstudio-index-state"><p id="zragAutoStatus" role="status" class="zchat-hint"></p><progress id="zragAutoProgress" aria-label="Avanzamento indicizzazione automatica" hidden></progress></div>
   <details id="zragIndexOptions" class="zstudio-section"><summary>Indice sul dispositivo</summary><p class="zchat-hint">L’indice si aggiorna automaticamente dopo aggiunte e modifiche salvate, anche fuori dall’app, finché questo zaino è aperto. Prepara tutte le fonti leggibili dello zaino sul dispositivo; la ricerca usa solo quelle selezionate. I passaggi invariati vengono riutilizzati. «Ricostruisci indice» rifà l’indice di ricerca conservando appunti, schede e ripassi.</p>
   <section id="zragDownloads" hidden><p class="set-note">EmbeddingGemma 2 è un modello di embedding multilingue. La versione ONNX viene eseguita localmente; scegli i componenti da scaricare.</p>
   <p class="zrag-modello-info"><strong id="zragModelName">EmbeddingGemma 2 · ONNX</strong> · <a id="zragModelInfo" href="https://huggingface.co/onnx-community/embeddinggemma-2-ONNX" target="_blank" rel="noopener noreferrer">Informazioni su Hugging Face ↗</a></p>
   <div class="zrag-modelli">
    <article data-modello="testo"><div><strong>text</strong><p class="zchat-hint">Ricerca per significato nei documenti e negli appunti.</p><p class="zchat-hint" id="zragModelSize-testo"></p></div><button class="tbtn" id="zragInstall" data-download="testo" type="button" aria-label="Scarica EmbeddingGemma 2 ONNX: Testo">Scarica</button></article>
    <article data-modello="vision"><div><strong>vision</strong><p class="zchat-hint">Componenti per le immagini, inclusa la parte testuale.</p><p class="zchat-hint" id="zragModelSize-vision"></p></div><button class="tbtn" id="zragInstallVision" data-download="vision" type="button" aria-label="Scarica EmbeddingGemma 2 ONNX: Visione">Scarica</button></article>
    <article data-modello="video"><div><strong>video</strong><p class="zchat-hint">Componenti per i fotogrammi video, inclusa la parte testuale.</p><p class="zchat-hint" id="zragModelSize-video"></p></div><button class="tbtn" id="zragInstallVideo" data-download="video" type="button" aria-label="Scarica EmbeddingGemma 2 ONNX: Video">Scarica</button></article>
   </div>
   <p class="zchat-hint">Visione e Video condividono i file: scaricandone uno, sono disponibili entrambi. Questi download preparano i componenti; la ricerca nei contenuti visivi non è ancora attiva.</p>
   <button class="tbtn" id="zragDownloadCancel" type="button" hidden>Interrompi download</button><p id="zragDownloadStatus" class="set-note" role="status" aria-live="polite"></p></section>
   <div class="tbar zstudio-actions"><button class="tbtn" id="zragSettings" type="button">AI locale…</button><button class="tbtn" id="zragIndex" type="button">Aggiorna ora</button><button class="tbtn" id="zragReset" type="button">Ricostruisci indice</button></div></details>
   <button class="tbtn" id="zragCancel" type="button" hidden>Interrompi</button><p id="zragStatus" role="status" class="zchat-hint"></p>
   <div id="zragResults" class="zstudio-results"></div></div>`;
  const box=document.getElementById('zstudio'),$=id=>document.getElementById(id),el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
  let busy=false,downloadBusy=false,epoch=0,study;
  const downloads=$('zragDownloads'),nomi={testo:'text',vision:'vision',video:'video'};
  function status(text,error,id='zragStatus'){const e=$(id);if(e){e.textContent=text||'';e.classList.toggle('zchat-error',!!error);}}
  function autoState(s){
   if(!s||s.zaino!==state.zaino)return;
   const progress=$('zragAutoProgress'),active=['queued','extracting','indexing'].includes(s.phase);
   progress.hidden=!active;progress.max=Math.max(1,s.total||0);
   if(s.phase==='indexing'&&s.total)progress.value=s.done;else progress.removeAttribute('value');
   const messages={queued:'Indice automatico: aggiornamento in attesa…',extracting:'Indice automatico: lettura dei materiali…',indexing:'Indicizzazione automatica: '+s.done+'/'+s.total+' passaggi'+(s.file?' · '+s.file.split('/').pop():''),ready:'Indice aggiornato · '+s.total+' passaggi · '+s.reused+' riutilizzati.',warning:'Indice aggiornato con avvisi · '+s.done+'/'+s.total+' passaggi.',error:'Indice automatico da controllare.',paused:'Indice automatico: aggiornamento manuale in corso.', 'waiting-model':'Per la ricerca per significato, scarica text in Impostazioni → AI → AI locale. La ricerca per parole è già disponibile.'};
   $('zragAutoStatus').textContent=(messages[s.phase]||'')+(s.warnings?.length?' '+s.warnings.join(' '):'');
   $('zragAutoStatus').classList.toggle('zchat-error',s.phase==='error');
  }
  async function call(name,...args){const r=await api[name](...args);if(!r?.ok)throw Error(r?.error || 'Operazione non riuscita.');return r;}
  function dimensione(bytes){return (bytes/1000000).toLocaleString('it-IT',{maximumFractionDigits:1})+' MB';}
  async function stato(){const r=await call('state');$('zragIndex').disabled=!r.ready || busy;$('zragReset').disabled=busy;
   if(r.model){$('zragModelName').textContent=r.model.nome+' · '+r.model.formato;$('zragModelInfo').href=r.model.url;}
   for(const p of r.packages||[]){
    const b=downloads.querySelector('[data-download="'+p.id+'"]'),conto=$('zragModelSize-'+p.id);if(!b || !conto)continue;
    b.disabled=p.pronto || downloadBusy || r.download;
    b.textContent=nomi[p.id]+' · '+(p.pronto?'Scaricato':p.daScaricare?'Scarica':'Verifica');
    b.setAttribute('aria-label',(p.pronto?'Componenti scaricati':p.daScaricare?'Scarica':'Verifica')+' · EmbeddingGemma 2 ONNX · '+p.nome);
    conto.textContent=dimensione(p.totale)+(p.pronto?' · componenti scaricati':p.daScaricare<p.totale?' totali · '+dimensione(p.daScaricare)+' da scaricare':' da scaricare');
   }
   if(r.download && r.progress){const p=(r.packages||[]).find(p=>p.id===r.progress.modalita);status('Download '+(nomi[p?.id]||'modello')+': '+Math.round(100*r.progress.bytes/r.progress.total)+'%',false,'zragDownloadStatus');}
   else if(r.busy && r.job)status('Indicizzazione: '+r.job.done+'/'+r.job.total+' passaggi · '+r.job.file);
   autoState(r.auto);return r;}
  async function action(fn,area='zragStatus'){
   if(busy){status('Attendi il termine dell’operazione in corso.',false,area);return;}if(!state.zaino){status('Apri uno zaino.',true,area);return;}
   const run=epoch,z=state.zaino;busy=true;
   const controls=[...document.querySelectorAll('#studioPane button,#studioPane input,#studioPane select,#zinterroga button,#zinterroga input,#zinterroga select,#zinterroga textarea')].filter(e=>!['zragCancel','zstudyCancel'].includes(e.id)).map(e=>[e,e.disabled]);controls.forEach(([e])=>{e.disabled=true;});
   const cancel=$(area==='zstudyStatus'?'zstudyCancel':'zragCancel');cancel.hidden=false;
   const poll=area==='zragStatus'?setInterval(()=>stato().catch(()=>{}),750):null;
   try{await fn(()=>run===epoch && z===state.zaino);}catch(e){if(run===epoch)status(e.message,true,area);}
   finally{clearInterval(poll);busy=false;cancel.hidden=true;controls.forEach(([e,disabled])=>{e.disabled=disabled;});await stato().catch(()=>{});}
  }
  async function apri(source){const z=state.zaino,r=await call('resolve',z,source);if(z!==state.zaino)return;
   if(r.status!=='available')throw Error(r.status==='changed'?'Fonte modificata: il riferimento conserva la versione precedente.':'Fonte non più disponibile.');
   if(r.source.kind==='pdf')window.openPdf(r.source.file.split('/').pop(),source.page||1,r.source.file.split('/').pop());
   else if(r.source.kind==='appunto')window.noteApriAttivo(r.source.file.slice('APPUNTI/'.length));
   else status(r.source.file+': '+(source.text||source.quote||''));
  }
  function riferimento(source,area='zragStatus'){const b=el('button',source.file.split('/').pop()+(source.page?' · p. '+source.page:''),'tbtn zchat-citation');b.type='button';b.title=source.file;b.onclick=()=>apri(source).catch(e=>status(e.message,true,area));return b;}
  const picker=window.ZainoSceltaFonti.crea({prefix:'zragScope',bar:$('zragToolbar'),host:$('zragScopeHost'),state,onChange(){epoch++;api.cancel('index');$('zragResults').replaceChildren();study?.scopeChanged();status('Fonti della ricerca aggiornate.');}});
  api.onAuto(autoState);
  $('zragOpenReview').onclick=()=>{window.bancoMostra('flashcard');study.refresh().catch(e=>status(e.message,true,'zstudyStatus'));};
  downloads.querySelectorAll('[data-download]').forEach(b=>{b.onclick=async()=>{
   if(downloadBusy)return;downloadBusy=true;
   downloads.querySelectorAll('button[data-download]').forEach(b=>b.disabled=true);
   $('zragDownloadCancel').hidden=false;status('Download di EmbeddingGemma 2 · '+nomi[b.dataset.download]+'…',false,'zragDownloadStatus');
   const poll=setInterval(()=>stato().catch(()=>{}),750);
   try{await call('install',b.dataset.download);status('Componenti '+nomi[b.dataset.download]+' scaricati.',false,'zragDownloadStatus');}
   catch(e){status(e.message,true,'zragDownloadStatus');}
   finally{clearInterval(poll);downloadBusy=false;$('zragDownloadCancel').hidden=true;await stato().catch(()=>{});}
  };});
  $('zragDownloadCancel').onclick=()=>call('cancel','download').catch(e=>status(e.message,true,'zragDownloadStatus'));
  $('zragSettings').onclick=()=>{$('settingsBtn').click();document.querySelector('.set-tab[data-tab="ai"]').click();$('zchatLocalSettings')?.scrollIntoView({block:'start'});};
  $('zragIndex').onclick=()=>action(async current=>{if(!window.noteFlush())throw Error('Salva prima gli appunti aperti.');const r=await call('index',state.zaino,state.scope);if(current())status('Indicizzazione: '+r.done+'/'+r.total+' passaggi, '+r.reused+' già pronti. '+r.warnings.join(' '));});
  $('zragCancel').onclick=()=>call('cancel','index').catch(e=>status(e.message,true));
  $('zragReset').onclick=()=>action(async current=>{await call('reset',state.zaino);const r=await call('index',state.zaino,state.scope);if(current())status('Indice ricostruito: '+r.done+'/'+r.total+' passaggi. '+r.warnings.join(' '));});
  $('zragForm').onsubmit=e=>{e.preventDefault();action(async current=>{
   if(!window.noteFlush())throw Error('Salva prima gli appunti aperti.');
   const r=await call('search',state.zaino,$('zragQuery').value,state.scope);if(!current())return;
   const results=$('zragResults');results.replaceChildren();
   for(const source of r.chunks){const row=el('article');row.append(riferimento(source),el('p',source.text));results.append(row);}
   status((r.chunks.length?'Ricerca '+r.mode+' · '+r.chunks.length+' passaggi mostrati.':'Nessun passaggio disponibile.')+' '+r.warnings.join(' '));
  });};
  $('zragIndexOptions').addEventListener('toggle',()=>{if($('zragIndexOptions').open)stato().catch(e=>status(e.message,true));});
  const apiUi={box,el,$,action,status,call,apri,riferimento,stato};
  study=window.ZainoSchedeRipasso.crea(apiUi,state);
  async function sync(){
   const z=window.zainoAttivo?.();if(z===state.zaino)return;
   epoch++;api.cancel('index');state.zaino=z;study.reset();$('zragResults').replaceChildren();$('zragQuery').value='';status('');
   $('zragAutoStatus').textContent='';$('zragAutoProgress').hidden=true;
   autoState((await call('watch',z)).auto);await picker.sync();await study.sync();await stato();
  }
  window.addEventListener('studia:zaino-changed',()=>sync().catch(e=>status(e.message,true)));
  window.zainoRipasso={refresh:async()=>{try{await sync();if(state.zaino)await study.refresh();}catch(e){status(e.message,true,'zstudyStatus');}}};
  window.zainoStudio={refresh:sync,impostazioni:target=>{if(!target)return;target.appendChild(downloads);downloads.hidden=false;stato().catch(()=>{});}};
  document.querySelector('.set-tab[data-tab="ai"]')?.addEventListener('click',()=>stato().catch(()=>{}));
  $('settingsBtn')?.addEventListener('click',()=>stato().catch(()=>{}));sync().catch(e=>status(e.message,true));
  return apiUi;
 }
 return {crea};
}));
