/* Ricerca e studio: usa l'ambito della chat e i visualizzatori già presenti. */
(function(root,factory){if(typeof module==='object' && module.exports)module.exports=factory();else root.ZainoStudio=factory();}(typeof self!=='undefined'?self:this,function(){
 'use strict';
 function crea({host,state,refreshSources,busyChanged}){
  const api=window.vault.rag;
  const box=document.createElement('details');box.id='zstudio';box.className='zchat-scope zstudio';
  box.innerHTML=`<summary>Cerca e studia le fonti</summary>
   <p class="zchat-hint"><strong>Trova un passaggio per significato.</strong> Premi «Indicizza sul dispositivo», poi scrivi ciò che cerchi: la ricerca usa le fonti scelte con l’icona elenco nella toolbar e funziona anche senza rete.</p>
   <p class="zchat-hint"><strong>Studia i materiali.</strong> Qui sotto puoi creare sintesi, concetti e domande, oppure aprire interrogazione e ripasso. Queste attività usano il tuo provider AI.</p>
   <div class="zstudio-actions"><button class="tbtn" id="zragInstall" type="button">Scarica modello · 346 MB</button><button class="tbtn" id="zragIndex" type="button">Indicizza sul dispositivo</button><button class="tbtn" id="zragCancel" type="button">Interrompi</button><button class="tbtn" id="zragReset" type="button">Ricostruisci indice</button></div>
   <p id="zragStatus" role="status" class="zchat-hint"></p>
   <form id="zragForm" class="zstudio-actions"><label for="zragQuery" class="zchat-sr">Cerca nei materiali per parole o significato</label><input class="ctl-input" id="zragQuery" placeholder="Cerca nei materiali…" maxlength="12000"><button class="tbtn" type="submit">Cerca</button></form>
   <div id="zragResults" class="zstudio-results"></div>`;
  host.querySelector('#zchatScope').after(box);
  const $=id=>document.getElementById(id),el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
  let busy=false,epoch=0;
  function status(text,error){for(const id of ['zragStatus','zstudyStatus']){const e=$(id);if(e){e.textContent=text||'';e.classList.toggle('zchat-error',!!error);}}}
  async function call(name,...args){const r=await api[name](...args);if(!r?.ok)throw Error(r?.error || 'Operazione non riuscita.');return r;}
  async function stato(){const r=await call('state');$('zragInstall').hidden=r.ready;$('zragIndex').disabled=!r.ready || busy;$('zragReset').disabled=busy;$('zragCancel').hidden=!busy && !r.download;
   if(r.download && r.progress)status('Download: '+Math.round(100*r.progress.bytes/r.progress.total)+'%');
   else if(r.busy && r.job)status('Indicizzazione: '+r.job.done+'/'+r.job.total+' passaggi · '+r.job.file);
   return r;}
  async function action(fn){if(busy)return;const run=epoch,z=state.zaino;busy=true;state.studying=true;busyChanged?.();
   const controls=[...document.querySelectorAll('.zstudio button,.zstudio input,.zstudio select,.zstudio textarea')].filter(e=>!['zragCancel','zstudyCancel'].includes(e.id)).map(e=>[e,e.disabled]);controls.forEach(([e])=>{e.disabled=true;});
   let poll=setInterval(()=>stato().catch(()=>{}),750);try{await stato();await fn(()=>run===epoch && z===state.zaino);}catch(e){if(run===epoch)status(e.message,true);}finally{clearInterval(poll);busy=false;state.studying=false;controls.forEach(([e,disabled])=>{e.disabled=disabled;});busyChanged?.();await stato().catch(()=>{});}}
  async function apri(source){const z=state.zaino,r=await call('resolve',z,source);if(z!==state.zaino)return;
   if(r.status!=='available'){status((r.status==='changed'?'Fonte modificata: il riferimento conserva la versione precedente.':'Fonte non più disponibile.')+' '+(source.quote||source.text||''),true);return;}
   if(r.source.kind==='pdf')window.openPdf(r.source.file.split('/').pop(),source.page||1,r.source.file.split('/').pop());
   else if(r.source.kind==='appunto')window.noteApriAttivo(r.source.file.slice('APPUNTI/'.length));
   else status(r.source.file+': '+(source.text||source.quote||''));
  }
  function riferimento(source){const b=el('button',source.file+(source.page?', p. '+source.page:''),'tbtn zchat-citation');b.type='button';b.title=source.text||source.quote||'';b.onclick=()=>apri(source).catch(e=>status(e.message,true));return b;}
  $('zragInstall').onclick=()=>action(async current=>{status('Download del modello locale…');await call('install');if(current())status('Modello installato. Puoi indicizzare le fonti.');});
  $('zragIndex').onclick=()=>action(async current=>{if(!window.noteFlush())throw Error('Salva prima gli appunti aperti.');const r=await call('index',state.zaino,state.scope);if(current())status('Indicizzazione: '+r.done+'/'+r.total+' passaggi, '+r.reused+' già pronti. '+r.warnings.join(' '));});
  $('zragCancel').onclick=()=>Promise.all([call('cancel'),window.vault.studio.cancel()]).catch(e=>status(e.message,true));
  $('zragReset').onclick=()=>action(async current=>{await call('reset',state.zaino);const r=await call('index',state.zaino,state.scope);if(current())status('Indice ricostruito: '+r.done+'/'+r.total+' passaggi. '+r.warnings.join(' '));});
  $('zragForm').onsubmit=e=>{e.preventDefault();action(async current=>{
   if(!window.noteFlush())throw Error('Salva prima gli appunti aperti.');
   const r=await call('search',state.zaino,$('zragQuery').value,state.scope);if(!current())return;
   const results=$('zragResults');results.replaceChildren();
   for(const source of r.chunks){const row=el('article');row.append(riferimento(source),el('p',source.text));results.append(row);}
   status((r.chunks.length?'Ricerca '+r.mode+' · '+r.chunks.length+' passaggi mostrati.':'Nessun passaggio disponibile.')+' '+r.warnings.join(' '));
  });};
  box.addEventListener('toggle',()=>{if(box.open)stato().catch(e=>status(e.message,true));});
  const apiUi={box,el,$,action,status,call,apri,riferimento,scopeChanged(){epoch++;api.cancel();$('zragResults').replaceChildren();study?.scopeChanged();},reset(){epoch++;api.cancel();study?.reset();$('zragResults').replaceChildren();status('');},stato};
  const study=window.ZainoSchedeRipasso?.crea(apiUi,state);
  return apiUi;
 }
 return {crea};
}));
