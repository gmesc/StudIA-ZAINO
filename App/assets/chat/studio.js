/* Ricerca e schede sono uno strumento del Banco, con un ambito proprio. */
(function(root,factory){
 if(typeof module==='object' && module.exports)module.exports=factory();
 else {root.ZainoStudio=factory();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',root.ZainoStudio.crea);else root.ZainoStudio.crea();}
}(typeof self!=='undefined'?self:this,function(){
 'use strict';
 function azioneIndice({zaino,ready,busy=false,auto}){
  if(!zaino)return {text:'Crea indice',action:'index',disabled:true,title:'Apri uno zaino per prepararne l’indice.'};
  if(['extracting','indexing','paused'].includes(auto?.phase))return {text:'Indicizzazione…',action:'index',disabled:true,title:'Preparazione dei passaggi per la ricerca in corso.'};
  if(busy)return {text:'Attendi…',action:'index',disabled:true,title:'Attendi il termine dell’operazione in corso.'};
  if(!ready)return {text:'Attiva indice',action:'settings',disabled:false,title:'Apri AI locale e scarica text per attivare la ricerca per significato.'};
  if(!auto?.indice?.exists)return {text:'Crea indice',action:'index',disabled:false,title:'Prepara tutte le fonti leggibili dello zaino per la ricerca sul computer.'};
  if(auto.indice.current && auto.phase==='ready')return {text:'Ricostruisci indice',action:'reset',disabled:false,title:'L’indice è aggiornato. Ricrealo da zero conservando appunti, schede e ripassi.'};
  return {text:'Aggiorna indice',action:'index',disabled:false,title:'Aggiorna l’indice riutilizzando i passaggi invariati.'};
 }
 function crea(){
  const host=document.getElementById('studioPane');if(!host||host.children.length)return;
  const state={zaino:null,scope:{mode:'all',sourceIds:[],wikipedia:false},sources:[]},api=window.vault.rag;
  host.innerHTML=`<div class="tbar" id="zragToolbar" role="group" aria-label="Strumenti del raccoglitore"><button class="tbtn" id="zragIndex" type="button" disabled>Crea indice</button></div><div id="zragScopeHost"></div>
   <div id="zstudio" class="zstudio zstudio-banco"><details id="zragSearch" class="zstudio-section"><summary>Cerca nei materiali</summary>
   <p class="zchat-hint">Trova passaggi nei documenti e negli appunti selezionati. I risultati rimandano alle fonti originali.</p>
   <form id="zragForm" class="zstudio-actions"><label class="zchat-sr" for="zragQuery">Cerca nei materiali per parole o significato</label><input class="ctl-input" id="zragQuery" placeholder="Che cosa vuoi trovare?" maxlength="12000"><button class="tbtn acc" type="submit">Cerca</button></form>
   <div id="zragResults" class="zstudio-results"></div></details>
   <div class="zstudio-index-state"><p id="zragAutoStatus" role="status" class="zchat-hint"></p><progress id="zragAutoProgress" aria-label="Avanzamento indicizzazione automatica" hidden></progress></div>
   <button class="tbtn" id="zragCancel" type="button" hidden>Interrompi</button><p id="zragStatus" role="status" class="zchat-hint"></p>
   <section id="zragDownloads" hidden><p class="set-note">EmbeddingGemma 2 è un modello di embedding multilingue. La versione ONNX viene eseguita localmente; scegli i componenti da scaricare.</p>
   <p class="zrag-modello-info"><strong id="zragModelName">EmbeddingGemma 2 · ONNX</strong> · <a id="zragModelInfo" href="https://huggingface.co/onnx-community/embeddinggemma-2-ONNX" target="_blank" rel="noopener noreferrer">Informazioni su Hugging Face ↗</a></p>
   <div class="zrag-modelli">
    <article data-modello="testo"><div><strong>text</strong><p class="zchat-hint">Ricerca per significato nei documenti e negli appunti.</p><p class="zchat-hint" id="zragModelSize-testo"></p></div><button class="tbtn acc" id="zragInstall" data-download="testo" type="button" aria-label="Scarica EmbeddingGemma 2 ONNX: Testo">Scarica</button></article>
    <article data-modello="vision"><div><strong>vision</strong><p class="zchat-hint">Componenti per le immagini. Ricerca visiva non ancora attiva.</p><p class="zchat-hint" id="zragModelSize-vision"></p></div><button class="tbtn acc" id="zragInstallVision" data-download="vision" type="button" aria-label="Scarica EmbeddingGemma 2 ONNX: Visione">Scarica</button></article>
    <article data-modello="video"><div><strong>video</strong><p class="zchat-hint">Componenti per i fotogrammi. Ricerca video non ancora attiva.</p><p class="zchat-hint" id="zragModelSize-video"></p></div><button class="tbtn acc" id="zragInstallVideo" data-download="video" type="button" aria-label="Scarica EmbeddingGemma 2 ONNX: Video">Scarica</button></article>
   </div>
   <p class="zchat-hint">Visione e Video condividono i file: scaricandone uno, sono disponibili entrambi. Questi download preparano i componenti; la ricerca nei contenuti visivi non è ancora attiva.</p>
   <button class="tbtn" id="zragDownloadCancel" type="button" hidden>Interrompi download</button><p id="zragDownloadStatus" class="set-note" role="status" aria-live="polite"></p>
   <details id="zragIndexOptions" class="zstudio-section"><summary>Come funziona l’indice locale</summary><p class="zchat-hint">L’indice è un archivio tecnico usato dalla ricerca: vedi i risultati e i rimandi alle fonti, non un documento da leggere. Resta salvato sul disco nella cartella dello zaino <code>_lavorazione/rag</code>, anche dopo la chiusura dell’app. Se lo zaino è sincronizzato, anche l’indice può esserlo.</p><p class="zchat-hint">Si aggiorna automaticamente dopo aggiunte e modifiche salvate finché lo zaino è aperto. Il pulsante nella sezione Cerca nei materiali crea l’indice se manca, aggiorna i passaggi modificati oppure ricostruisce un indice già aggiornato. Appunti, schede e ripassi sono conservati. L’indice prepara tutte le fonti leggibili; la selezione Fonti limita solo la ricerca.</p></details>
   </section></div>`;
  const box=document.getElementById('zstudio'),$=id=>document.getElementById(id),el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
  let busy=false,downloadBusy=false,epoch=0,study,ready=false,auto=null;
  $('zragSearch').append($('zragIndex'),document.querySelector('.zstudio-index-state'));
  const downloads=$('zragDownloads'),nomi={testo:'text',vision:'vision',video:'video'};
  function status(text,error,id='zragStatus'){const e=$(id);if(e){e.textContent=text||'';e.classList.toggle('zchat-error',!!error);if(error)e.scrollIntoView({block:'nearest'});}}
  function indiceButton(){const b=$('zragIndex'),a=azioneIndice({zaino:state.zaino,ready,busy,auto});b.textContent=a.text;b.title=a.title;b.disabled=a.disabled;return a;}
  function autoState(s){
   if(!s||s.zaino!==state.zaino)return;
   auto=s;indiceButton();
   const progress=$('zragAutoProgress'),active=['queued','extracting','indexing'].includes(s.phase);
   progress.hidden=!active;progress.max=Math.max(1,s.total||0);
   if(s.phase==='indexing'&&s.total)progress.value=s.done;else progress.removeAttribute('value');
   const messages={queued:'Indice automatico: aggiornamento in attesa…',extracting:'Indice automatico: lettura dei materiali…',indexing:'Indicizzazione automatica: '+s.done+'/'+s.total+' passaggi'+(s.file?' · '+s.file.split('/').pop():''),ready:'Indice aggiornato · '+s.total+' passaggi · '+s.reused+' riutilizzati.',warning:'Indice con avvisi · '+s.done+'/'+s.total+' passaggi.',error:'Indice automatico da controllare.',paused:'Indice automatico: aggiornamento manuale in corso.', 'waiting-model':'Per la ricerca per significato, premi «Attiva indice» e scarica text in AI locale. La ricerca per parole è già disponibile.'};
   $('zragAutoStatus').textContent=(messages[s.phase]||'')+(s.warnings?.length?' '+s.warnings.join(' '):'');
   $('zragAutoStatus').classList.toggle('zchat-error',s.phase==='error');
  }
  async function call(name,...args){const r=await api[name](...args);if(!r?.ok)throw Error(r?.error || 'Operazione non riuscita.');return r;}
  function dimensione(bytes){return (bytes/1000000).toLocaleString('it-IT',{maximumFractionDigits:1})+' MB';}
  async function stato(){const r=await call('state');ready=r.ready;
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
   autoState(r.auto);indiceButton();return r;}
  async function action(fn,area='zragStatus'){
   if(busy){status('Attendi il termine dell’operazione in corso.',false,area);return;}if(!state.zaino){status('Apri uno zaino.',true,area);return;}
   const run=epoch,z=state.zaino,origin=document.activeElement;busy=true;indiceButton();
   const controls=[...document.querySelectorAll('#studioPane button,#studioPane input,#studioPane select,#zinterroga button,#zinterroga input,#zinterroga select,#zinterroga textarea')].filter(e=>!['zragCancel','zstudyCancel','zschedeCancel'].includes(e.id)).map(e=>[e,e.disabled]);controls.forEach(([e])=>{e.disabled=true;});
   const cancel=$(area==='zstudyStatus'?'zstudyCancel':area==='zschedeStatus'?'zschedeCancel':'zragCancel');cancel.hidden=false;
   const poll=area==='zragStatus'?setInterval(()=>stato().catch(()=>{}),750):null;
   try{await fn(()=>run===epoch && z===state.zaino);}catch(e){if(run===epoch)status(e.message,true,area);}
   finally{clearInterval(poll);busy=false;cancel.hidden=true;controls.forEach(([e,disabled])=>{e.disabled=disabled;});study?.settled();if(document.activeElement===document.body&&origin?.isConnected&&origin.getClientRects().length)origin.focus();await stato().catch(()=>{});}
  }
  async function apri(source){const z=state.zaino,r=await call('resolve',z,source);if(z!==state.zaino)return;
   if(r.status!=='available')throw Error(r.status==='changed'?'Fonte modificata: il riferimento conserva la versione precedente.':'Fonte non più disponibile.');
   if(r.source.kind==='pdf')window.openPdf(r.source.file.split('/').pop(),source.page||1,window.ZainoCitazioni.nome(r.source),false,window.ZainoCitazioni.selezione(source));
   else if(r.source.kind==='appunto')window.noteApriAttivo(r.source.file.slice('APPUNTI/'.length));
   else status(r.source.file+': '+(source.text||source.quote||''));
  }
  function riferimento(source,area='zragStatus'){const b=el('button',window.ZainoCitazioni.nome(source)+(source.page?' · p. '+source.page:''),'tbtn zchat-citation');b.type='button';b.title=b.textContent;b.onclick=()=>apri(source).catch(e=>status(e.message,true,area));return b;}
  const picker=window.ZainoSceltaFonti.crea({prefix:'zragScope',bar:$('zragToolbar'),host:$('zragScopeHost'),state,onChange(){epoch++;api.cancel('index');$('zragResults').replaceChildren();if(box.dataset.vista==='search')status('Fonti della ricerca aggiornate.');}});
  api.onAuto(autoState);
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
  function impostazioniLocali(){$('settingsBtn').click();document.querySelector('.set-tab[data-tab="ai"]').click();$('zchatLocalSettings')?.scrollIntoView({block:'start'});}
  $('zragIndex').onclick=()=>{
   const a=indiceButton();if(a.disabled)return;if(a.action==='settings')return impostazioniLocali();
   action(async current=>{
    if(!window.noteFlush())throw Error('Salva prima gli appunti aperti.');
    if(a.action==='reset')await call('reset',state.zaino);
    if(!current())return;
    const r=await call('index',state.zaino,{mode:'all',sourceIds:[],wikipedia:false});
    if(current())status('Indice: '+r.done+'/'+r.total+' passaggi, '+r.reused+' riutilizzati. '+r.warnings.join(' '));
   });
  };
  $('zragCancel').onclick=()=>call('cancel','index').catch(e=>status(e.message,true));
  $('zragForm').onsubmit=e=>{e.preventDefault();action(async current=>{
   if(!window.noteFlush())throw Error('Salva prima gli appunti aperti.');
   const r=await call('search',state.zaino,$('zragQuery').value,state.scope);if(!current())return;
   const results=$('zragResults');results.replaceChildren();
   for(const source of r.chunks){const row=el('article');row.append(riferimento(source),el('p',source.text));results.append(row);}
   status((r.chunks.length?'Ricerca '+r.mode+' · '+r.chunks.length+' passaggi mostrati.':'Nessun passaggio disponibile.')+' '+r.warnings.join(' '));
  });};
  $('zragIndexOptions').addEventListener('toggle',()=>{if($('zragIndexOptions').open)stato().catch(e=>status(e.message,true));});
  let ritornoAI=null;
  function configuraAI(target){ritornoAI=target;$('settingsBtn').click();document.querySelector('.set-tab[data-tab="ai"]').click();$('zchatCloudSettings')?.scrollIntoView({block:'start'});$('zchatSettingsProvider')?.focus();}
  async function ensureAI(area,returnFocus){
   const z=state.zaino;const [config,keys]=await Promise.all([window.vault.chat.settings(),window.vault.chat.keysStatus()]);
   if(z!==state.zaino)return null;
   if(config?.ok===false||keys?.ok===false)throw Error(config.error||keys.error);
   const ready=window.ZainoPercorso.configurato(config,keys);
   const target=$(area);let notice=$(area+'Config');
   if(!notice){notice=el('div',undefined,'zstudio-config');notice.id=area+'Config';target.after(notice);}
   notice.replaceChildren();notice.hidden=ready;notice.dataset.returnFocus=returnFocus||(area==='zstudyStatus'?'zstudyTopic':'zschedeEstimate');
   if(ready)status('AI cloud: '+config.provider+' / '+config.model,false,area);
   if(!ready){notice.append(el('p','Per generare o valutare, configura AI cloud. I materiali già salvati restano disponibili.'));const b=el('button','Configura AI cloud','tbtn acc');b.type='button';b.onclick=()=>configuraAI(b);notice.append(b);status('Configurazione AI necessaria.',true,area);}
   if(!ready){notice.scrollIntoView({block:'nearest'});}
   return ready?config:null;
  }
  $('settingsClose')?.addEventListener('click',()=>{if(ritornoAI){const target=ritornoAI,area=target.closest('.zstudio-config').id.replace(/Config$/,''),focusId=target.closest('.zstudio-config').dataset.returnFocus;ritornoAI=null;ensureAI(area).then(()=>{if(target.isConnected&&!target.closest('[hidden]'))target.focus();else ($(area+'Config').querySelector('button')||$(focusId)).focus();}).catch(e=>status(e.message,true));}});
  // Il documento selezionato viene ricordato prima che il click nello studio cambi il riquadro attivo.
  let documento='';
  document.addEventListener('focusin',ricordaDocumento,true);document.addEventListener('pointerdown',ricordaDocumento,true);
  function ricordaDocumento(e){const pane=e.target.closest?.('#pdfPane,#pdfPane2,#notePane,#notePane2');if(!pane)return;if(pane.id==='pdfPane')documento=window.ANTEPRIMA?.file||'';else if(pane.id==='pdfPane2')documento=window.FONTE2?.file||'';else {const n=window.noteStati?.().find(n=>n.id===(pane.id==='notePane2'?'appunti2':'appunti'));documento=n?.cur?.file?'APPUNTI/'+n.cur.file:'';}}
  const apiUi={box,el,$,action,status,call,apri,riferimento,stato,ensureAI,picker,documento:()=>documento};
  study=window.ZainoSchedeRipasso.crea(apiUi,state);
  async function sync(){
   const z=window.zainoAttivo?.();if(z===state.zaino)return;
   epoch++;documento='';api.cancel('index');state.zaino=z;auto=null;indiceButton();study.reset();$('zragResults').replaceChildren();$('zragQuery').value='';status('');
   $('zragAutoStatus').textContent='';$('zragAutoProgress').hidden=true;
   autoState((await call('watch',z)).auto);await picker.sync();await study.sync();await stato();
  }
  window.addEventListener('studia:zaino-changed',()=>sync().catch(e=>status(e.message,true)));
  window.zainoRipasso={refresh:async()=>{try{await sync();if(state.zaino)await study.refresh();}catch(e){status(e.message,true,'zstudyStatus');}}};
  window.zainoStudio={refresh:sync,scope:()=>structuredClone(state.scope),usaFonti:scope=>picker.set(scope),impostazioni:target=>{if(!target)return;target.appendChild(downloads);downloads.hidden=false;stato().catch(()=>{});}};
  document.querySelector('.set-tab[data-tab="ai"]')?.addEventListener('click',()=>stato().catch(()=>{}));
  $('settingsBtn')?.addEventListener('click',()=>stato().catch(()=>{}));sync().catch(e=>status(e.message,true));
  return apiUi;
 }
 return {crea,azioneIndice};
}));
