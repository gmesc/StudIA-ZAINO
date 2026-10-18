/* Schede e interrogazione condividono i servizi; il ripasso sceglie le proprie fonti. */
(function(root){
 'use strict';
 root.ZainoSchedeRipasso={crea:function(studio,state){
  const {box,el,$}=studio,api=window.vault.studio;
  const action=fn=>studio.action(fn,'zstudyStatus'),status=(text,error)=>studio.status(text,error,'zstudyStatus'),riferimento=s=>studio.riferimento(s,'zstudyStatus');
  const reviewState={zaino:state.zaino,scope:{mode:'all',sourceIds:[],wikipedia:false},sources:[]};
  const extra=el('div');extra.innerHTML=`
   <details id="zschede" class="zstudio-section"><summary>Schede delle fonti</summary>
    <h3>Raccoglitore delle schede</h3><p class="zchat-hint">Tutte le schede già generate in questo zaino. Aprirle non richiede una nuova analisi AI.</p>
    <div class="zstudio-actions"><label class="zchat-sr" for="zschedeFilter">Filtra le schede per fonte o tipo</label><input id="zschedeFilter" class="ctl-input" placeholder="Filtra per fonte o tipo di scheda…"><button id="zschedeRefresh" class="tbtn" type="button">Aggiorna elenco</button></div>
    <p id="zschedeCollectionStatus" class="zchat-hint" role="status"></p><div id="zschedeCollection" class="zstudio-collection"></div>
    <h3>Apri o prepara una scheda</h3>
    <label>Fonte<select id="zschedeSource"></select></label><label>Scheda<select id="zschedePreset"></select></label>
    <div class="zstudio-actions"><button class="tbtn" id="zschedeRead" type="button">Apri scheda</button><button class="tbtn" id="zschedeEstimate" type="button">Prepara analisi</button></div>
    <p id="zschedeEstimateText" class="zchat-hint"></p><button class="tbtn" id="zschedeGenerate" type="button" hidden>Analizza con il mio provider</button>
    <div id="zschedeResult" class="zstudio-results"></div>
   </details>
   <section id="zinterroga" class="zstudio-panel" aria-label="Interrogazione e ripasso">
    <div class="tbar" id="zstudyToolbar" role="toolbar" aria-label="Fonti del ripasso"><span class="tbsep"></span><button class="tbtn" id="zstudyRefresh" type="button">Aggiorna</button><button class="tbtn" id="zstudyCancel" type="button" hidden>Interrompi</button></div>
    <div id="zstudyScopeHost"></div>
    <div class="zstudio zstudio-banco">
     <h2>Interrogazione e ripasso</h2>
     <p class="zchat-hint">Scegli le fonti e affronta una domanda alla volta. Il tutor usa il provider AI configurato; le domande conservate restano nel tuo zaino.</p>
     <label class="zstudio-field" for="zstudyTopic">Argomento<input class="ctl-input" id="zstudyTopic" maxlength="3000" placeholder="Lascia vuoto per i concetti principali"></label>
     <div class="tbar zstudio-actions"><button class="tbtn acc" id="zstudyStart" type="button">Interrogami</button><button class="tbtn" id="zstudySelection" type="button">Usa selezione</button></div>
     <p id="zstudyStatus" role="status" class="zchat-hint"></p>
     <p id="zstudyCount" class="zchat-hint"></p>
     <div id="zstudyQueue" class="zstudio-actions"><label class="zchat-sr" for="zstudySaved">Domande nelle fonti selezionate</label><select id="zstudySaved" class="ctl-select"></select><button class="tbtn" id="zstudyResume" type="button">Riprendi</button></div>
     <div id="zstudyQuestion" class="zstudio-results"></div>
    </div>
   </section>`;box.append(extra);
  const pane=document.getElementById('ripassoPane');
  if(pane){const old=el('div');old.hidden=true;while(pane.firstChild)old.append(pane.firstChild);pane.append(old,$('zinterroga'));}
  const picker=window.ZainoSceltaFonti.crea({prefix:'zstudyScope',bar:$('zstudyToolbar'),host:$('zstudyScopeHost'),state:reviewState,onChange(){drawQuestion(null);refresh().catch(e=>status(e.message,true));}});

  let estimate=null,question=null,attemptId=null,review=false,selection='',cards=[];const drafts=new Map();
  const call=async(n,...args)=>{const r=await api[n](...args);if(!r?.ok)throw Error(r?.error || 'Operazione non riuscita.');return r;};
  const button=(text,fn)=>{const b=el('button',text,'tbtn');b.type='button';b.onclick=fn;return b;};
  function drawCollection(){
   const query=$('zschedeFilter').value.trim().toLocaleLowerCase('it'),found=cards.filter(c=>(c.file+' '+c.title).toLocaleLowerCase('it').includes(query)),target=$('zschedeCollection');target.replaceChildren();
   if(!found.length){target.append(el('p',cards.length?'Nessuna scheda corrisponde al filtro.':'Non ci sono ancora schede. Scegli una fonte e prepara la prima analisi.','zchat-hint'));return;}
   for(const c of found){
    const row=el('article'),open=button(c.title+' · '+c.file.split('/').pop(),()=>studio.action(async current=>{const r=await call('card',state.zaino,c.sourceId,c.preset);if(current()){drawCard(r.card,r.status);$('zschedeResult').scrollIntoView({block:'nearest'});}}));open.classList.add('zstudio-card-open');open.title=c.title+' — '+c.file;
    const date=new Date(c.createdAt),label={current:'Aggiornata',changed:'Fonte modificata · da aggiornare',removed:'Fonte non disponibile'}[c.status];
    row.append(open,el('p',(Number.isNaN(date.getTime())?'Data non disponibile':date.toLocaleString('it-IT'))+' · '+label+(c.partial?' · analisi parziale':''),'zchat-hint'));target.append(row);
   }
  }
  async function collection(){const z=state.zaino,r=await call('cards',z);if(z!==state.zaino)return;cards=r.cards;$('zschedeCollectionStatus').textContent=cards.length+' schede disponibili'+(r.warnings.length?' · '+r.warnings.join(' '):'');drawCollection();}
  $('zschedeFilter').oninput=drawCollection;
  $('zschedeRefresh').onclick=()=>studio.action(collection);
  async function sources(){const z=state.zaino,scope=JSON.stringify(state.scope),result=await window.vault.chat.sources(z);if(z!==state.zaino||scope!==JSON.stringify(state.scope))return;if(!result?.ok)throw Error(result?.error);const old=$('zschedeSource').value;$('zschedeSource').replaceChildren();for(const s of result.sources.filter(s=>state.scope.mode==='all'||state.scope.sourceIds.includes(s.id)))$('zschedeSource').append(new Option(s.file,s.id));if([...$('zschedeSource').options].some(o=>o.value===old))$('zschedeSource').value=old;}
  function drawCard(c,st){
   const target=$('zschedeResult');target.replaceChildren();if(!c){target.append(el('p','Nessuna scheda disponibile.'));return;}
   target.append(el('p',(st==='changed'?'Fonte modificata. ':st==='removed'?'Fonte rimossa. ':'')+'Copertura: '+c.covered+'/'+c.total+' passaggi'+(c.partial?' · analisi parziale':'')+' · '+c.provider+' / '+c.model));
   for(const item of c.items){const row=el('article'),body=el('div',undefined,'zstudio-card-text'),template=document.createElement('template');
    template.innerHTML=window.LetturaCapitolo.crea().mdToHtml(window.ZainoSchedeTesto.etichette(item.text),true);
    body.append(window.ZainoChatUI.copyFormatting(template.content,document));row.append(el('strong',item.title),body);for(const id of item.refs){const s=c.sources.find(s=>s.chunkId===id);if(s)row.append(studio.riferimento(s));}
    if(c.preset==='domande')row.append(button('Interrogami su questa',()=>{$('zstudyTopic').value=item.title;picker.set({mode:'selected',sourceIds:[c.sourceId],wikipedia:false});window.bancoMostra('flashcard');start();}));target.append(row);}
   target.append(button('Conserva una copia negli appunti',()=>studio.action(async current=>{const r=await call('copyCard',state.zaino,c.sourceId,c.preset);if(current()){window.notesReload();window.refreshMyNotes();window.noteApriAttivo(r.file);studio.status(r.duplicate?'Copia già presente negli appunti.':'Copia personale conservata.');}})));
  }
  $('zschede').addEventListener('toggle',()=>{if($('zschede').open)studio.action(async current=>{await sources();await collection();const r=await call('presets');if(current()&&!$('zschedePreset').options.length)for(const [id,label] of Object.entries(r.presets))$('zschedePreset').append(new Option(label,id));});});
  for(const id of ['zschedeSource','zschedePreset'])$(id).onchange=()=>{estimate=null;$('zschedeGenerate').hidden=true;$('zschedeEstimateText').textContent='';$('zschedeResult').replaceChildren();};
  $('zschedeRead').onclick=()=>studio.action(async current=>{const r=await call('card',state.zaino,$('zschedeSource').value,$('zschedePreset').value);if(current())drawCard(r.card,r.status);});
  $('zschedeEstimate').onclick=()=>studio.action(async current=>{
   if(!window.noteFlush())throw Error('Salva prima gli appunti aperti.');const r=await call('estimate',state.zaino,$('zschedeSource').value,$('zschedePreset').value);if(!current())return;
   estimate=r;$('zschedeEstimateText').textContent=r.covered+'/'+r.total+' passaggi'+(r.partial?' · analisi parziale':'')+'. Saranno inviati a '+(r.provider||'provider da configurare')+' / '+(r.model||'modello da scegliere')+'. Circa '+r.estimatedInputTokens+' token in ingresso per richiesta; un’eventuale correzione può richiedere una seconda chiamata. '+r.warnings.join(' ');$('zschedeGenerate').hidden=false;
  });
  $('zschedeGenerate').onclick=()=>studio.action(async current=>{if(!estimate)throw Error('Prepara prima l’analisi.');const r=await call('analyze',state.zaino,{sourceId:estimate.sourceId,preset:estimate.preset,expectedRevision:estimate.revision,expectedProvider:estimate.provider,expectedModel:estimate.model});if(current()){drawCard(r.card,'current');await collection();studio.status('Scheda generata.');}});
  function drawQuestion(q){
   if(question && $('zstudyAttempt'))drafts.set(question.id,$('zstudyAttempt').value);question=q;const target=$('zstudyQuestion');target.replaceChildren();if(!q)return;
   target.append(el('h3',q.question));
   const hint=el('details');hint.append(el('summary','Indizio'),el('p',q.hint));target.append(hint);
   const proofs=el('details');proofs.append(el('summary','Fonti della domanda'));for(const s of q.sources)proofs.append(riferimento(s));target.append(proofs);
   if(q.sourcesCurrent===false)target.append(el('p','Fonti cambiate o non disponibili: la valutazione automatica sarà sospesa.'));
   const form=el('form'),label=el('label','Il tuo tentativo'),text=el('textarea');text.id='zstudyAttempt';text.maxLength=12000;text.rows=4;text.className='ctl-input';label.htmlFor=text.id;form.append(label,text);
   const send=button('Rispondi',()=>{});send.type='submit';form.append(send);target.append(form);
   const pending=q.attempts.findLast(a=>a.status==='error'||a.status==='pending');if(pending && !review){text.value=pending.text;attemptId=pending.id;}else {attemptId=crypto.randomUUID();text.value=drafts.get(q.id)||'';}
   form.onsubmit=e=>{e.preventDefault();const answer=text.value;action(async current=>{const r=await call('answer',state.zaino,q.id,{attemptId,text:answer});if(current()){drafts.delete(q.id);text.value='';review=false;drawQuestion(r.question);await refresh();}});};
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
  async function refresh(){const z=state.zaino,scope=JSON.stringify(reviewState.scope),r=await call('state',z,reviewState.scope);if(z!==state.zaino||scope!==JSON.stringify(reviewState.scope))return;
   window.RIPCONTO={mai:r.questions.filter(q=>q.saved&&!q.esito).length,oggi:r.questions.filter(q=>q.saved&&q.esito&&r.due.includes(q.id)).length,attesa:r.counts.waiting,totale:r.counts.total,corso:z};window.ripassoContoDisegna?.();
   $('zstudyCount').textContent=r.counts.total+(r.counts.total===1?' carta conservata · ':' carte conservate · ')+r.counts.due+' da ripassare · '+r.counts.waiting+' in attesa';
   const menu=$('zstudySaved'),selected=menu.value;menu.replaceChildren();
   for(const q of r.questions)menu.append(new Option((q.saved?(r.due.includes(q.id)?'Da ripassare · ':'Conservata · '):'In corso · ')+q.question,q.id));
   if(r.questions.some(q=>q.id===selected))menu.value=selected;
   $('zstudyQueue').hidden=!r.questions.length;
   if(question && !r.questions.some(q=>q.id===question.id))drawQuestion(null);
   if(!question && r.active){review=false;drawQuestion(r.active);}
  }
  $('zstudyResume').onclick=()=>action(async current=>{const r=await call('resume',state.zaino,$('zstudySaved').value);if(current()){review=r.question.saved;drawQuestion(r.question);}});
  function start(scope){action(async current=>{if(!window.noteFlush())throw Error('Salva prima gli appunti aperti.');const r=await call('start',state.zaino,{scope:scope?.mode?scope:reviewState.scope,topic:$('zstudyTopic').value});if(current()){review=false;drawQuestion(r.question);await refresh();status('Domanda pronta. Prova a rispondere prima di vedere la soluzione.');}});}
  $('zstudyCancel').onclick=()=>api.cancel();
  $('zstudyStart').onclick=start;$('zstudyRefresh').onclick=()=>action(async current=>{if(current())await refresh();});
  document.addEventListener('selectionchange',()=>{const sel=window.getSelection();if(sel?.toString().trim() && !box.contains(sel.anchorNode))selection=sel.toString().trim().slice(0,3000);});
  $('zstudySelection').onclick=()=>{const s=window.noteStatoAttivo?.(),selected=s?.mde?.codemirror.getSelection();$('zstudyTopic').value=selected||selection;if(!$('zstudyTopic').value)status('Seleziona prima un passaggio nel documento, negli appunti o una voce della mappa.',true);};
  window.zainoInterrogami=async function({text,file,rimando}={}){
   try{
    $('zstudyTopic').value=String(text||'').slice(0,3000);window.bancoMostra('flashcard');
    let scope=reviewState.scope;
    if(rimando){const ref=window.RimandiSintassi.leggi(rimando);if(ref?.tipo==='pdf')file=window._pdfNum?.()[ref.numero]||file;}
    if(file){const r=await window.vault.chat.sources(state.zaino),found=r.sources?.filter(s=>s.file===file || s.file.endsWith('/'+file));
      if(found?.length===1)scope={mode:'selected',sourceIds:[found[0].id],wikipedia:false};else throw Error('Fonte della selezione non identificata: scegli le fonti nel Ripasso.');}
    picker.set(scope);status(file?'Interrogazione sulla fonte selezionata.':'Cerco prove per questo argomento nelle fonti scelte; il testo selezionato non è una fonte aggiuntiva.');start(scope);
   }catch(e){status(e.message,true);}
  };
  return {async sync(){reviewState.zaino=state.zaino;await picker.sync();if(state.zaino){await refresh();if($('zschede').open){await sources();await collection();}}},scopeChanged(){estimate=null;$('zschedeGenerate').hidden=true;$('zschedeResult').replaceChildren();$('zschedeEstimateText').textContent='';if($('zschede').open)sources().catch(e=>status(e.message,true));},reset(){api.cancel();cards=[];$('zschedeCollection').replaceChildren();$('zschedeCollectionStatus').textContent='';$('zschedeFilter').value='';estimate=null;question=null;drafts.clear();review=false;selection='';$('zschedeResult').replaceChildren();$('zschedeSource').replaceChildren();$('zschedeGenerate').hidden=true;$('zschedeEstimateText').textContent='';$('zstudyQuestion').replaceChildren();$('zstudySaved').replaceChildren();$('zstudyQueue').hidden=true;$('zstudyTopic').value='';$('zstudyCount').textContent='';window.RIPCONTO={mai:0,oggi:0,attesa:0,totale:0,corso:state.zaino};window.ripassoContoDisegna?.();},refresh};
 }};
}(typeof self!=='undefined'?self:this));
