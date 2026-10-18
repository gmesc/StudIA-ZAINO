/* Ricerca e schede sono uno strumento del Banco, con un ambito proprio. */
(function(root,factory){
 if(typeof module==='object' && module.exports)module.exports=factory();
 else {root.ZainoStudio=factory();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',root.ZainoStudio.crea);else root.ZainoStudio.crea();}
}(typeof self!=='undefined'?self:this,function(){
 'use strict';
 function crea(){
  const host=document.getElementById('studioPane');if(!host||host.children.length)return;
  const state={zaino:null,scope:{mode:'all',sourceIds:[],wikipedia:false},sources:[]},api=window.vault.rag;
  host.innerHTML=`<div class="tbar" id="zragToolbar" role="toolbar" aria-label="Ricerca e fonti"><span class="tbsep"></span><button class="tbtn" id="zragOpenReview" type="button">Ripasso</button></div><div id="zragScopeHost"></div>
   <div id="zstudio" class="zstudio zstudio-banco"><h2>Cerca e studia le fonti</h2>
   <p class="zchat-hint">Trova passaggi per significato nelle fonti selezionate. L’indice e la ricerca funzionano sul dispositivo; sintesi e domande usano il provider AI configurato.</p>
   <form id="zragForm" class="zstudio-actions"><label class="zchat-sr" for="zragQuery">Cerca nei materiali per parole o significato</label><input class="ctl-input" id="zragQuery" placeholder="Che cosa vuoi trovare?" maxlength="12000"><button class="tbtn acc" type="submit">Cerca</button></form>
   <details id="zragIndexOptions"><summary>Indice sul dispositivo</summary><p class="zchat-hint">Indicizza le fonti prima della prima ricerca per significato. I passaggi già pronti vengono riutilizzati.</p>
   <div class="tbar zstudio-actions"><button class="tbtn" id="zragInstall" type="button">Scarica modello · 346 MB</button><button class="tbtn" id="zragIndex" type="button">Indicizza sul dispositivo</button><button class="tbtn" id="zragReset" type="button">Ricostruisci indice</button></div></details>
   <button class="tbtn" id="zragCancel" type="button" hidden>Interrompi</button><p id="zragStatus" role="status" class="zchat-hint"></p>
   <div id="zragResults" class="zstudio-results"></div></div>`;
  const box=document.getElementById('zstudio'),$=id=>document.getElementById(id),el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
  let busy=false,epoch=0,study;
  function status(text,error,id='zragStatus'){const e=$(id);if(e){e.textContent=text||'';e.classList.toggle('zchat-error',!!error);}}
  async function call(name,...args){const r=await api[name](...args);if(!r?.ok)throw Error(r?.error || 'Operazione non riuscita.');return r;}
  async function stato(){const r=await call('state');$('zragInstall').hidden=r.ready;$('zragIndex').disabled=!r.ready || busy;$('zragReset').disabled=busy;
   if(r.download && r.progress)status('Download: '+Math.round(100*r.progress.bytes/r.progress.total)+'%');
   else if(r.busy && r.job)status('Indicizzazione: '+r.job.done+'/'+r.job.total+' passaggi · '+r.job.file);
   return r;}
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
  const picker=window.ZainoSceltaFonti.crea({prefix:'zragScope',bar:$('zragToolbar'),host:$('zragScopeHost'),state,onChange(){epoch++;api.cancel();$('zragResults').replaceChildren();study?.scopeChanged();status('Fonti della ricerca aggiornate.');}});
  $('zragOpenReview').onclick=()=>{window.bancoMostra('flashcard');study.refresh().catch(e=>status(e.message,true,'zstudyStatus'));};
  $('zragInstall').onclick=()=>action(async current=>{status('Download del modello locale…');await call('install');if(current())status('Modello installato. Puoi indicizzare le fonti.');});
  $('zragIndex').onclick=()=>action(async current=>{if(!window.noteFlush())throw Error('Salva prima gli appunti aperti.');const r=await call('index',state.zaino,state.scope);if(current())status('Indicizzazione: '+r.done+'/'+r.total+' passaggi, '+r.reused+' già pronti. '+r.warnings.join(' '));});
  $('zragCancel').onclick=()=>call('cancel').catch(e=>status(e.message,true));
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
   epoch++;api.cancel();state.zaino=z;study.reset();$('zragResults').replaceChildren();$('zragQuery').value='';status('');
   await picker.sync();await study.sync();await stato();
  }
  window.addEventListener('studia:zaino-changed',()=>sync().catch(e=>status(e.message,true)));
  window.zainoRipasso={refresh:async()=>{try{await sync();if(state.zaino)await study.refresh();}catch(e){status(e.message,true,'zstudyStatus');}}};
  window.zainoStudio={refresh:sync};sync().catch(e=>status(e.message,true));
  return apiUi;
 }
 return {crea};
}));
