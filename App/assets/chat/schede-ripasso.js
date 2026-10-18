/* Le analisi e il ripasso riusano ambito, riferimenti e stato del pannello di ricerca. */
(function(root){
 'use strict';
 root.ZainoSchedeRipasso={crea:function(studio,state){
  const {box,el,$,action,status,riferimento}=studio,api=window.vault.studio;
  const extra=el('div');extra.innerHTML=`
   <details id="zschede"><summary>Schede delle fonti</summary>
    <label>Fonte<select id="zschedeSource"></select></label><label>Scheda<select id="zschedePreset"></select></label>
    <div class="zstudio-actions"><button class="tbtn" id="zschedeRead" type="button">Apri scheda</button><button class="tbtn" id="zschedeEstimate" type="button">Prepara analisi</button></div>
    <p id="zschedeEstimateText" class="zchat-hint"></p><button class="tbtn" id="zschedeGenerate" type="button" hidden>Analizza con il mio provider</button>
    <div id="zschedeResult" class="zstudio-results"></div>
   </details>
   <details id="zinterroga"><summary>Interrogazione e ripasso</summary>
    <p class="zchat-hint">Una domanda alla volta, sulle fonti selezionate. Le domande conservate restano nel ripasso anche ricostruendo l’indice.</p>
    <label>Argomento o selezione<input class="ctl-input" id="zstudyTopic" maxlength="3000" placeholder="Lascia vuoto per i concetti principali"></label>
    <div class="zstudio-actions"><button class="tbtn" id="zstudyStart" type="button">Interrogami</button><button class="tbtn" id="zstudySelection" type="button">Usa selezione</button><button class="tbtn" id="zstudyRefresh" type="button">Riprendi e ripassa</button></div>
    <p id="zstudyStatus" role="status" class="zchat-hint"></p><button class="tbtn" id="zstudyCancel" type="button">Interrompi riscontro</button>
    <p id="zstudyCount" class="zchat-hint"></p><div id="zstudyQueue" class="zstudio-results"></div><div id="zstudyQuestion" class="zstudio-results"></div>
   </details>`;box.append(extra);
  const pane=document.getElementById('ripassoPane');
  if(pane){const old=el('div');old.hidden=true;while(pane.firstChild)old.append(pane.firstChild);pane.append(old);
   const mount=el('div',undefined,'zstudio zstudio-banco');mount.append($('zinterroga'));pane.append(mount);$('zinterroga').open=true;
   box.append(buttonBanco());
  }
  function buttonBanco(){const b=el('button','Apri interrogazione e ripasso','tbtn');b.type='button';b.onclick=()=>{window.bancoMostra('flashcard');refresh().catch(e=>status(e.message,true));};return b;}

  let estimate=null,question=null,attemptId=null,review=false,selection='';
  const call=async(n,...args)=>{const r=await api[n](...args);if(!r?.ok)throw Error(r?.error || 'Operazione non riuscita.');return r;};
  const button=(text,fn)=>{const b=el('button',text,'tbtn');b.type='button';b.onclick=fn;return b;};
  async function sources(){const result=await window.vault.chat.sources(state.zaino);if(!result?.ok)throw Error(result?.error);const old=$('zschedeSource').value;$('zschedeSource').replaceChildren();for(const s of result.sources.filter(s=>state.scope.mode==='all'||state.scope.sourceIds.includes(s.id)))$('zschedeSource').append(new Option(s.file,s.id));if([...$('zschedeSource').options].some(o=>o.value===old))$('zschedeSource').value=old;}
  async function card(){const r=await call('card',state.zaino,$('zschedeSource').value,$('zschedePreset').value);drawCard(r.card,r.status);}
  function drawCard(c,st){
   const target=$('zschedeResult');target.replaceChildren();if(!c){target.append(el('p','Nessuna scheda disponibile.'));return;}
   target.append(el('p',(st==='changed'?'Fonte modificata. ':st==='removed'?'Fonte rimossa. ':'')+'Copertura: '+c.covered+'/'+c.total+' passaggi'+(c.partial?' · analisi parziale':'')+' · '+c.provider+' / '+c.model));
   for(const item of c.items){const row=el('article');row.append(el('strong',item.title),el('p',item.text));for(const id of item.refs){const s=c.sources.find(s=>s.chunkId===id);if(s)row.append(riferimento(s));}
    if(c.preset==='domande')row.append(button('Interrogami su questa',()=>{$('zstudyTopic').value=item.title;$('zinterroga').open=true;start({mode:'selected',sourceIds:[c.sourceId],wikipedia:false});}));target.append(row);}
   target.append(button('Conserva una copia negli appunti',()=>action(async current=>{const r=await call('copyCard',state.zaino,c.sourceId,c.preset);if(current()){window.notesReload();window.refreshMyNotes();window.noteApriAttivo(r.file);status(r.duplicate?'Copia già presente negli appunti.':'Copia personale conservata.');}})));
  }
  $('zschede').addEventListener('toggle',()=>{if($('zschede').open)action(async current=>{await sources();const r=await call('presets');if(current()&&!$('zschedePreset').options.length)for(const [id,label] of Object.entries(r.presets))$('zschedePreset').append(new Option(label,id));});});
  for(const id of ['zschedeSource','zschedePreset'])$(id).onchange=()=>{estimate=null;$('zschedeGenerate').hidden=true;$('zschedeEstimateText').textContent='';$('zschedeResult').replaceChildren();};
  $('zschedeRead').onclick=()=>action(async current=>{const r=await call('card',state.zaino,$('zschedeSource').value,$('zschedePreset').value);if(current())drawCard(r.card,r.status);});
  $('zschedeEstimate').onclick=()=>action(async current=>{
   if(!window.noteFlush())throw Error('Salva prima gli appunti aperti.');const r=await call('estimate',state.zaino,$('zschedeSource').value,$('zschedePreset').value);if(!current())return;
   estimate=r;$('zschedeEstimateText').textContent=r.covered+'/'+r.total+' passaggi'+(r.partial?' · analisi parziale':'')+'. Saranno inviati a '+(r.provider||'provider da configurare')+' / '+(r.model||'modello da scegliere')+'. Circa '+r.estimatedInputTokens+' token in ingresso per richiesta; un’eventuale correzione può richiedere una seconda chiamata. '+r.warnings.join(' ');$('zschedeGenerate').hidden=false;
  });
  $('zschedeGenerate').onclick=()=>action(async current=>{if(!estimate)throw Error('Prepara prima l’analisi.');const r=await call('analyze',state.zaino,{sourceId:estimate.sourceId,preset:estimate.preset,expectedRevision:estimate.revision,expectedProvider:estimate.provider,expectedModel:estimate.model});if(current()){drawCard(r.card,'current');status('Scheda generata.');}});
  function drawQuestion(q){
   question=q;const target=$('zstudyQuestion');target.replaceChildren();if(!q)return;
   target.append(el('h3',q.question));
   const hint=el('details');hint.append(el('summary','Indizio'),el('p',q.hint));target.append(hint);
   const proofs=el('details');proofs.append(el('summary','Prove della domanda'));for(const s of q.sources)proofs.append(riferimento(s));target.append(proofs);
   if(q.sourcesCurrent===false)target.append(el('p','Fonti cambiate o non disponibili: la valutazione automatica sarà sospesa.'));
   const form=el('form'),label=el('label','Il tuo tentativo'),text=el('textarea');text.id='zstudyAttempt';text.maxLength=12000;text.rows=4;label.htmlFor=text.id;form.append(label,text);
   const send=button('Rispondi',()=>{});send.type='submit';form.append(send);target.append(form);
   const pending=q.attempts.findLast(a=>a.status==='error'||a.status==='pending');if(pending && !review){text.value=pending.text;attemptId=pending.id;}else attemptId=crypto.randomUUID();
   form.onsubmit=e=>{e.preventDefault();const answer=text.value;action(async current=>{const r=await call('answer',state.zaino,q.id,{attemptId,text:answer});if(current()){review=false;drawQuestion(r.question);await refresh();}});};
   text.oninput=()=>{if(pending && text.value!==pending.text)attemptId=crypto.randomUUID();};
   const last=!review?q.attempts.at(-1):null;
   if(last?.status==='done'){
    const fb=el('article');fb.append(el('p',last.feedback.summary));for(const [key,label] of [['correct','Parti corrette'],['missing','Da completare'],['contradictory','Da correggere']])if(last.feedback[key].length)fb.append(el('strong',label),el('p',last.feedback[key].join('\n')));
    if(!last.feedback.assessable)fb.append(el('p','Non valutabile automaticamente. Puoi scegliere tu l’esito del ripasso.'));
    const solution=el('details');solution.append(el('summary','Risposta attesa e criteri'),el('p',q.answer),el('p',(q.rubric||[]).join('\n')));fb.append(solution);
    fb.append(el('p','Scegli o correggi il tuo esito:'));
    for(const es of q.anteprima)fb.append(button(es.esito.replace('-',' ')+' · '+es.testo,()=>action(async current=>{const r=await call('outcome',state.zaino,q.id,last.id,es.esito);if(current()){drawQuestion(r.question);await refresh();status('Esito conservato; puoi correggerlo.');}})));
    target.append(fb);
   }else if(last?.error)target.append(el('p','Tentativo conservato: '+last.error));
   if(!q.saved)target.append(button('Conserva nel ripasso',()=>action(async current=>{const r=await call('keep',state.zaino,q.id);if(current()){drawQuestion(r.question);await refresh();}})));
   else target.append(el('p','Domanda conservata nel ripasso'+(q.prossimo?' · prossimo: '+new Date(q.prossimo).toLocaleString('it-IT'):'')));
   if(q.attempts.length){const history=el('details');history.append(el('summary','Tentativi precedenti · '+q.attempts.length));for(const a of q.attempts){history.append(el('p',new Date(a.createdAt).toLocaleString('it-IT')+' — '+a.text+'\n'+(a.feedback?.summary||a.error||'Riscontro interrotto')));}target.append(history);}
  }
  async function refresh(){const z=state.zaino,r=await call('state',z,state.scope);if(z!==state.zaino)return;
   window.RIPCONTO={mai:r.questions.filter(q=>q.saved&&!q.esito).length,oggi:r.questions.filter(q=>q.saved&&q.esito&&r.due.includes(q.id)).length,attesa:r.counts.waiting,totale:r.counts.total,corso:z};window.ripassoContoDisegna?.();
   $('zstudyCount').textContent=r.counts.total+' carte conservate · '+r.counts.due+' da ripassare · '+r.counts.waiting+' in attesa';
   const queue=$('zstudyQueue');queue.replaceChildren();
   for(const q of r.questions){const row=el('article');row.append(button((q.saved?(r.due.includes(q.id)?'Da ripassare: ':'Conservata: '):'Riprendi: ')+q.question,()=>action(async current=>{const r=await call('resume',state.zaino,q.id);if(current()){review=q.saved;drawQuestion(r.question);}})));queue.append(row);}
   if(!question && r.active){review=false;drawQuestion(r.active);}
  }
  function start(scope){action(async current=>{if(!window.noteFlush())throw Error('Salva prima gli appunti aperti.');const r=await call('start',state.zaino,{scope:scope?.mode?scope:state.scope,topic:$('zstudyTopic').value});if(current()){review=false;drawQuestion(r.question);await refresh();status('Domanda pronta. Prova a rispondere prima di vedere la soluzione.');}});}
  $('zstudyCancel').onclick=()=>Promise.all([api.cancel(),window.vault.rag.cancel()]);
  $('zstudyStart').onclick=start;$('zstudyRefresh').onclick=()=>action(async current=>{if(current())await refresh();});
  document.addEventListener('selectionchange',()=>{const sel=window.getSelection();if(sel?.toString().trim() && !box.contains(sel.anchorNode))selection=sel.toString().trim().slice(0,3000);});
  $('zstudySelection').onclick=()=>{const s=window.noteStatoAttivo?.(),selected=s?.mde?.codemirror.getSelection();$('zstudyTopic').value=selected||selection;if(!$('zstudyTopic').value)status('Seleziona prima un passaggio nel documento, negli appunti o una voce della mappa.',true);};
  $('zinterroga').addEventListener('toggle',()=>{if($('zinterroga').open)action(async current=>{if(current())await refresh();});});
  window.zainoInterrogami=async function({text,file,rimando}={}){
   try{
    $('zstudyTopic').value=String(text||'').slice(0,3000);window.bancoMostra('flashcard');
    let scope=state.scope;
    if(rimando){const ref=window.RimandiSintassi.leggi(rimando);if(ref?.tipo==='pdf')file=window._pdfNum?.()[ref.numero]||file;}
    if(file){const r=await window.vault.chat.sources(state.zaino),found=r.sources?.filter(s=>s.file===file || s.file.endsWith('/'+file));
      if(found?.length===1)scope={mode:'selected',sourceIds:[found[0].id],wikipedia:false};else throw Error('Fonte della selezione non identificata: scegli le fonti nella chat.');}
    status(file?'Interrogazione sulla fonte selezionata.':'Cerco prove per questo argomento nelle fonti scelte; il testo selezionato non è una fonte aggiuntiva.');start(scope);
   }catch(e){status(e.message,true);}
  };
  window.zainoRipasso={refresh:()=>refresh().catch(e=>status(e.message,true))};
  return {scopeChanged(){estimate=null;$('zschedeGenerate').hidden=true;$('zschedeResult').replaceChildren();$('zschedeEstimateText').textContent='';if($('zschede').open)sources().catch(e=>status(e.message,true));},reset(){api.cancel();estimate=null;question=null;review=false;selection='';$('zschedeResult').replaceChildren();$('zschedeSource').replaceChildren();$('zschedeGenerate').hidden=true;$('zschedeEstimateText').textContent='';$('zstudyQuestion').replaceChildren();$('zstudyQueue').replaceChildren();$('zstudyTopic').value='';$('zstudyCount').textContent='';window.RIPCONTO={mai:0,oggi:0,attesa:0,totale:0,corso:state.zaino};window.ripassoContoDisegna?.();},refresh};
 }};
}(typeof self!=='undefined'?self:this));
