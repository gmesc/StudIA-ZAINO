/* Schede e interrogazione condividono i servizi; il ripasso sceglie le proprie fonti. */
(function(root){
 'use strict';
 root.ZainoSchedeRipasso={crea:function(studio,state){
  const P=window.ZainoPercorso;
  const {box,el,$}=studio,api=window.vault.studio;
  const action=fn=>studio.action(fn,'zstudyStatus'),status=(text,error)=>studio.status(text,error,'zstudyStatus'),riferimento=s=>studio.riferimento(s,'zstudyStatus');
  const reviewState={zaino:state.zaino,scope:{mode:'all',sourceIds:[],wikipedia:false},sources:[]};
  const extra=el('div');extra.innerHTML=`
   <section id="zschede" class="zstudio-section" aria-labelledby="zschedeTitle"><h2 id="zschedeTitle">Schede e domande</h2>
    <p class="zchat-hint">Ritrova ciò che hai preparato e conservato. Scegli una scheda da leggere o una domanda su cui allenarti.</p>
    <h3>Raccoglitore delle schede</h3><p class="zchat-hint">Tutte le schede e le domande conservate nello zaino, anche fuori dalle fonti selezionate. Aprirle non avvia una nuova generazione AI.</p>
    <div class="zstudio-actions"><label for="zschedeFilter">Cerca nel raccoglitore</label><input id="zschedeFilter" class="ctl-input" placeholder="Titolo, fonte o tipo…"><button id="zschedeRefresh" class="tbtn" type="button">Aggiorna elenco</button></div>
    <label for="zschedeKind">Mostra<select id="zschedeKind"><option value="all">Schede e domande</option><option value="scheda">Schede delle fonti</option><option value="domanda">Domande conservate</option></select></label><p id="zschedeCollectionStatus" class="zchat-hint" role="status"></p><div id="zschedeCollection" class="zstudio-collection"></div>
    <div id="zschedeResult" class="zstudio-results"></div>
    <details id="zschedeNew" class="zstudio-section"><summary>Nuova scheda</summary><p class="zchat-hint">Scegli una fonte e il tipo di scheda. «Prepara analisi» mostra la stima; solo la conferma successiva avvia l’AI e salva la scheda nel raccoglitore.</p>
    <label>Fonte<select id="zschedeSource"></select></label><label>Tipo di scheda<select id="zschedePreset"></select></label>
    <p id="zschedeSourceStatus" class="zchat-hint" role="status"></p><p id="zschedeStatus" class="zchat-hint" role="status"></p><div class="zstudio-actions"><button class="tbtn" id="zschedeEstimate" type="button">Prepara analisi</button></div>
    <p id="zschedeEstimateText" class="zchat-hint"></p><details id="zschedeCost"><summary>Dettagli del consumo</summary><p id="zschedeTokens" class="zchat-hint"></p></details><button class="tbtn" id="zschedeGenerate" type="button" hidden>Genera e salva scheda</button>
    </details>
   </section>
   <section id="zinterroga" class="zstudio-panel" aria-label="Interrogazione e ripasso">
    <div class="tbar" id="zstudyToolbar" role="group" aria-label="Strumenti del ripasso"><button class="tbtn" id="zstudyCollection" type="button">Raccoglitore</button><span class="tbsep"></span><button class="tbtn" id="zstudyRefresh" type="button">Aggiorna</button><button class="tbtn" id="zstudyCancel" type="button" hidden>Interrompi</button></div>
    <div id="zstudyScopeHost"></div>
    <div class="zstudio zstudio-banco">
     <h2>Ripasso</h2><p class="zchat-hint">Riprendi una domanda conservata oppure creane una dalle fonti scelte. I tentativi e le date restano collegati alla stessa domanda nel raccoglitore.</p>
     <p id="zstudyCount" class="zchat-hint" role="status"></p>
     <label for="zstudyQueueFilter">Domande da mostrare<select id="zstudyQueueFilter"><option value="due">Da ripassare</option><option value="new">Nuove</option><option value="later">Più avanti</option><option value="all">Tutte le domande conservate</option></select></label>
     <div id="zstudyQueue" class="zstudio-actions"><label for="zstudySaved">Scegli una domanda</label><select id="zstudySaved" class="ctl-select"></select><button class="tbtn" id="zstudyResume" type="button">Riprendi</button></div>
     <p id="zstudyQueueEmpty" class="zchat-hint"></p>
     <div class="zstudio-actions"><button id="zstudyNext" class="tbtn acc" type="button">Prossima domanda</button><button id="zstudyPause" class="tbtn" type="button">Pausa</button></div>
     <p id="zstudySession" class="zchat-hint" role="status"></p><details id="zstudyNew" class="zstudio-section"><summary>Nuova domanda con AI</summary>
      <label class="zstudio-field" for="zstudyTopic">Argomento<input class="ctl-input" id="zstudyTopic" maxlength="3000" placeholder="Lascia vuoto per i concetti principali"></label>
      <div class="zstudio-actions"><button class="tbtn acc" id="zstudyStart" type="button">Crea domanda</button><button class="tbtn" id="zstudySelection" type="button">Usa selezione</button><button class="tbtn" id="zstudyUseSources" type="button">Usa fonti di Cerca e studia</button></div>
     </details>
     <p id="zstudyStatus" role="status" class="zchat-hint"></p>
     <div id="zstudyQuestion" class="zstudio-results"></div>
    </div>
   </section>`;box.append(extra);box.prepend($('zschede'));
  const pane=document.getElementById('ripassoPane');
  if(pane){const old=el('div');old.hidden=true;while(pane.firstChild)old.append(pane.firstChild);pane.append(old,$('zinterroga'));}
  if(!extra.children.length)extra.remove();
  const picker=window.ZainoSceltaFonti.crea({prefix:'zstudyScope',bar:$('zstudyToolbar'),host:$('zstudyScopeHost'),state:reviewState,onChange(){visitati.clear();drawQuestion(null);refresh().catch(e=>status(e.message,true));}});

  let estimate=null,question=null,attemptId=null,review=false,selection='',cards=[],savedQuestions=[],queueState={questions:[],due:[]},collectionWarnings=[],collectionTimer,collectionRun=0;const drafts=new Map(),visitati=new Set();let paused=false;
  const call=async(n,...args)=>{const r=await api[n](...args);if(!r?.ok)throw Error(r?.error || 'Operazione non riuscita.');return r;};
  const button=(text,fn)=>{const b=el('button',text,'tbtn');b.type='button';b.onclick=fn;return b;};
  function drawCollection(){
   const query=$('zschedeFilter').value.trim(),found=P.filtra(P.raccolta(cards,savedQuestions),query,$('zschedeKind').value),target=$('zschedeCollection');target.replaceChildren();
   $('zschedeCollectionStatus').textContent='Schede salvate: '+cards.length+' · domande conservate: '+savedQuestions.filter(q=>q.saved).length+(query?' · mostrate: '+found.length:'')+(collectionWarnings.length?' · '+collectionWarnings.join(' '):'');
   if(!found.length){target.append(el('p',cards.length||savedQuestions.some(q=>q.saved)?'Nessun contenuto corrisponde al filtro.':'Non ci sono ancora schede o domande conservate. Premi «Nuova scheda» per iniziare.','zchat-hint'));return;}
   for(const c of found){
    if(c.tipo==='domanda'){const row=el('article');row.dataset.questionId=c.id;const b=button('Apri domanda · '+c.question,()=>openQuestion(c.id));b.classList.add('zstudio-card-open');row.append(b,el('p',c.file+' · '+c.attempts.length+' tentativi'+(c.prossimo?' · prossimo: '+new Date(c.prossimo).toLocaleString('it-IT'):' · Nuova')+(c.sourcesCurrent===false?' · Fonti modificate o non disponibili':''),'zchat-hint'));target.append(row);continue;}

    const row=el('article'),open=button('Apri '+c.title+' · '+c.file.split('/').pop(),()=>studio.action(async current=>{const r=await call('card',state.zaino,c.sourceId,c.preset);if(current()){drawCard(r.card,r.status);$('zschedeResult').scrollIntoView({block:'nearest'});}}));open.classList.add('zstudio-card-open');open.title=c.title+' — '+c.file;
    const date=new Date(c.createdAt),label={current:'Aggiornata',changed:'Fonte modificata · da aggiornare',removed:'Fonte non disponibile'}[c.status];
    row.append(open,el('p',(Number.isNaN(date.getTime())?'Data non disponibile':date.toLocaleString('it-IT'))+' · '+label+(c.partial?' · analisi parziale':''),'zchat-hint'));if(c.status!=='removed'){const regenerate=button('Rigenera…',()=>studio.action(current=>prepare(current,c.sourceId,c.preset)));regenerate.classList.add('zstudio-card-regenerate');regenerate.title='Mostra prima la stima del consumo, senza avviare l’analisi.';row.append(regenerate);}target.append(row);
   }
  }
  async function collection(){const z=state.zaino,run=++collectionRun;const [r,q]=await Promise.allSettled([call('cards',z),call('state',z)]);if(z!==state.zaino||run!==collectionRun)return;
   cards=r.status==='fulfilled'?r.value.cards:[];savedQuestions=q.status==='fulfilled'?q.value.questions:[];collectionWarnings=[...(r.status==='fulfilled'?r.value.warnings:['Schede non leggibili: '+r.reason.message]),...(q.status==='fulfilled'?[]:['Domande non leggibili: '+q.reason.message])];drawCollection();}
  window.vault.rag.onAuto(s=>{if(s.zaino!==state.zaino||!['queued','waiting-model','ready','warning','error'].includes(s.phase))return;clearTimeout(collectionTimer);collectionTimer=setTimeout(()=>collection().catch(e=>studio.status(e.message,true,'zschedeCollectionStatus')),250);});
  $('zschedeFilter').oninput=drawCollection;$('zschedeKind').onchange=drawCollection;
  $('zschedeRefresh').onclick=()=>studio.action(collection);
  async function sources(prefer=false){const z=state.zaino,scope=JSON.stringify(state.scope),result=await window.vault.chat.sources(z);if(z!==state.zaino||scope!==JSON.stringify(state.scope))return;if(!result?.ok)throw Error(result?.error);const old=$('zschedeSource').value;$('zschedeSource').replaceChildren();for(const s of result.sources.filter(s=>state.scope.mode==='all'||state.scope.sourceIds.includes(s.id)))$('zschedeSource').append(new Option(s.file,s.id));const available=result.sources.filter(s=>state.scope.mode==='all'||state.scope.sourceIds.includes(s.id)),choice=P.fontePreferita(available,prefer?[studio.documento()]:[],old);if(choice)$('zschedeSource').value=choice;if(old!==$('zschedeSource').value)invalidateEstimate();$('zschedeEstimate').disabled=!$('zschedeSource').options.length;$('zschedeSourceStatus').textContent=$('zschedeSource').options.length?'':'Nessuna fonte disponibile nella selezione. Cambia il filtro «Fonti».';}
  function drawCard(c,st){
   const target=$('zschedeResult');target.replaceChildren();if(!c){target.append(el('p','Nessuna scheda disponibile.'));return;}
   target.append(el('h3',(cards.find(s=>s.sourceId===c.sourceId&&s.preset===c.preset)?.title||c.preset)+' — '+c.file.split('/').pop()));
   target.append(el('p',(st==='changed'?'Fonte modificata. ':st==='removed'?'Fonte rimossa. ':'')+'Copertura: '+c.covered+'/'+c.total+' passaggi'+(c.partial?' · analisi parziale':'')+' · '+c.provider+' / '+c.model));
   for(const [index,item] of c.items.entries()){const row=el('article'),body=el('div',undefined,'zstudio-card-text'),template=document.createElement('template');
    template.innerHTML=window.LetturaCapitolo.crea().mdToHtml(window.ZainoSchedeTesto.etichette(item.text),true);
    body.append(window.ZainoChatUI.copyFormatting(template.content,document));row.append(el('strong',item.title),body);for(const id of item.refs){const s=c.sources.find(s=>s.chunkId===id);if(s)row.append(studio.riferimento(s));}
    if(c.preset==='domande')row.append(button('Rispondi a questa domanda',()=>studio.action(async current=>{const r=await call('fromCard',state.zaino,c.sourceId,index,c.revision);if(current()){await collection();await loadQuestion(r.question.id,current);}})));target.append(row);}
   target.append(button('Conserva una copia negli appunti',()=>studio.action(async current=>{const r=await call('copyCard',state.zaino,c.sourceId,c.preset);if(current()){window.notesReload();window.refreshMyNotes();window.noteApriAttivo(r.file);studio.status(r.duplicate?'Copia già presente negli appunti.':'Copia personale conservata.');}})));
  }
  const nuova=button('Nuova scheda',async()=>{nuova.disabled=true;try{await sources(true);$('zschedeNew').open=true;$('zschedeNew').scrollIntoView({block:'start'});$('zschedeSource').focus();}catch(e){$('zschedeNew').open=true;studio.status(e.message,true,'zschedeStatus');$('zschedeStatus').scrollIntoView({block:'nearest'});}finally{nuova.disabled=false;}});nuova.id='zschedeNewButton';nuova.classList.add('acc');$('zragToolbar').insertBefore(nuova,$('zragToolbar').firstChild);
  function invalidateEstimate(){estimate=null;$('zschedeGenerate').hidden=true;$('zschedeEstimateText').textContent='';$('zschedeTokens').textContent='';$('zschedeCost').open=false;}
  for(const id of ['zschedeSource','zschedePreset'])$(id).onchange=invalidateEstimate;
  async function prepare(current,sourceId,preset){
   invalidateEstimate();$('zschedeNew').open=true;
   if(!await studio.ensureAI('zschedeStatus')||!current())return;
   if(!window.noteFlush())throw Error('Salva prima gli appunti aperti.');const r=await call('estimate',state.zaino,sourceId,preset);if(!current())return;
   if(![...$('zschedeSource').options].some(o=>o.value===sourceId))$('zschedeSource').append(new Option(r.file,sourceId));
   $('zschedeSource').value=sourceId;$('zschedePreset').value=preset;
   estimate=r;$('zschedeEstimateText').textContent='Materiale: '+r.file.split('/').pop()+' · '+r.covered+'/'+r.total+' passaggi'+(r.partial?' · analisi parziale':'')+'. AI cloud: '+r.provider+' / '+r.model+'. La conferma genera e salva la scheda nel raccoglitore. '+r.warnings.join(' ');
   $('zschedeTokens').textContent='Circa '+r.estimatedInputTokens+' token in ingresso per richiesta (risposta esclusa); un’eventuale correzione può richiedere una seconda chiamata.';$('zschedeGenerate').hidden=false;$('zschedeGenerate').scrollIntoView({block:'nearest'});

  }
  $('zschedeEstimate').onclick=()=>studio.action(current=>prepare(current,$('zschedeSource').value,$('zschedePreset').value),'zschedeStatus');
  $('zschedeGenerate').onclick=()=>studio.action(async current=>{if(!estimate)throw Error('Prepara prima l’analisi.');if(!await studio.ensureAI('zschedeStatus')||!current())return;const r=await call('analyze',state.zaino,{sourceId:estimate.sourceId,preset:estimate.preset,expectedRevision:estimate.revision,expectedProvider:estimate.provider,expectedModel:estimate.model});if(current()){await collection();drawCard(r.card,'current');$('zschedeNew').open=false;$('zschedeResult').scrollIntoView({block:'nearest'});studio.status('Scheda generata e aggiunta al raccoglitore.');}},'zschedeStatus');
  function drawQuestion(q){
   if(question && $('zstudyAttempt'))drafts.set(question.id,$('zstudyAttempt').value);question=q;const target=$('zstudyQuestion');target.replaceChildren();if(!q)return;
   const heading=el('h3',q.question);heading.tabIndex=-1;target.append(heading);target.append(el('p','Materiali della domanda: '+[...new Set(q.sources.map(s=>s.file.split('/').pop()))].join(' · '),'zchat-hint'));
   const hint=el('details');hint.append(el('summary','Indizio'),el('p',q.hint));target.append(hint);
   const proofs=el('details');proofs.append(el('summary','Fonti della domanda'));for(const s of q.sources)proofs.append(riferimento(s));target.append(proofs);
   if(q.sourcesCurrent===false)target.append(el('p','Fonti cambiate o non disponibili: la valutazione automatica sarà sospesa.'));
   const form=el('form'),label=el('label','Il tuo tentativo'),text=el('textarea');text.id='zstudyAttempt';text.maxLength=12000;text.rows=4;text.className='ctl-input';label.htmlFor=text.id;form.append(label,text);
   const send=button('Rispondi',()=>{});send.type='submit';form.append(send);target.append(form);
   const pending=q.attempts.findLast(a=>a.status==='error'||a.status==='pending');if(pending && !review){text.value=pending.text;attemptId=pending.id;}else {attemptId=crypto.randomUUID();text.value=drafts.get(q.id)||'';}
   form.onsubmit=e=>{e.preventDefault();const answer=text.value;action(async current=>{if(!await studio.ensureAI('zstudyStatus')||!current())return;const r=await call('answer',state.zaino,q.id,{attemptId,text:answer});if(current()){drafts.delete(q.id);text.value='';review=false;drawQuestion(r.question);await refresh();}});};
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
   if(!q.saved)target.append(button('Conserva nel ripasso',()=>action(async current=>{const r=await call('keep',state.zaino,q.id);if(current()){drawQuestion(r.question);await refresh();await collection();status('Domanda conservata nel raccoglitore e in Ripasso.');}})));
   else target.append(el('p','Domanda conservata nel ripasso'+(q.prossimo?' · prossimo: '+new Date(q.prossimo).toLocaleString('it-IT'):'')));
   if(q.attempts.length){const history=el('details');history.append(el('summary','Tentativi precedenti · '+q.attempts.length));for(const a of q.attempts){history.append(el('p',new Date(a.createdAt).toLocaleString('it-IT')+' — '+a.text+'\n'+(a.feedback?.summary||a.error||'Riscontro interrotto')));}target.append(history);}
  }
  async function refresh(){const z=state.zaino,scope=JSON.stringify(reviewState.scope),r=await call('state',z,reviewState.scope);if(z!==state.zaino||scope!==JSON.stringify(reviewState.scope))return;
   queueState=r;drawQueue();
   window.RIPCONTO={mai:r.questions.filter(q=>q.saved&&!q.esito).length,oggi:r.questions.filter(q=>q.saved&&q.esito&&r.due.includes(q.id)).length,attesa:r.counts.waiting,totale:r.counts.total,corso:z};window.ripassoContoDisegna?.();
   $('zstudyCount').textContent=r.counts.total+(r.counts.total===1?' carta conservata · ':' carte conservate · ')+r.counts.due+' da ripassare · '+r.counts.waiting+' in attesa';
   if(question && !r.questions.some(q=>q.id===question.id))drawQuestion(null);
   if(!question && r.active&&!paused){review=false;drawQuestion(r.active);}drawQueue();
  }
  function drawQueue(){const menu=$('zstudySaved'),selected=question?.id||menu.value,rows=P.coda(queueState.questions,queueState.due,$('zstudyQueueFilter').value);menu.replaceChildren();for(const q of rows)menu.append(new Option(q.question,q.id));if(rows.some(q=>q.id===selected))menu.value=selected;$('zstudyQueue').hidden=!rows.length;$('zstudyQueueEmpty').textContent=rows.length?'':queueState.questions.some(q=>q.saved)?'Nessuna domanda in questa vista. Puoi scegliere un altro filtro.':'Nessuna domanda conservata: creane una o apri una scheda di domande.';const remaining=rows.filter(q=>q.id!==question?.id&&!visitati.has(q.id));$('zstudyNext').disabled=!remaining.length;$('zstudyPause').disabled=!question;$('zstudySession').textContent=rows.length&&!remaining.length&&question?'Hai aperto tutte le domande di questa vista. Puoi riprenderne una dalla coda o tornare al raccoglitore.':'';}
  async function loadQuestion(id,current){const r=await call('resume',state.zaino,id);if(current()){paused=false;status('Domanda riaperta: puoi continuare il ripasso.');const scope=P.ambitoDomanda(reviewState.scope,r.question);if(JSON.stringify(scope)!==JSON.stringify(reviewState.scope)){picker.set(scope);status('Aggiunte alle fonti del ripasso quelle della domanda aperta.');}if(question)visitati.add(question.id);review=true;drawQuestion(r.question);window.bancoMostra('flashcard');await refresh();$('zstudyQuestion h3')?.focus();}}
  function openQuestion(id){return action(current=>loadQuestion(id,current));}
  // La domanda viene aperta dalla stessa identità, anche se il filtro corrente la esclude.
  $('zstudyResume').onclick=()=>openQuestion($('zstudySaved').value);
  $('zstudyNext').onclick=()=>{const next=P.coda(queueState.questions,queueState.due,$('zstudyQueueFilter').value).find(q=>q.id!==question?.id&&!visitati.has(q.id));if(next)openQuestion(next.id);};
  $('zstudyQueueFilter').onchange=()=>{visitati.clear();drawQueue();};
  function pause(){paused=true;visitati.clear();drawQuestion(null);drawQueue();status('Pausa. Domande e tentativi conservati; riprendi dalla coda.');($('zstudyQueue').hidden?$('zstudyQueueFilter'):$('zstudyResume')).focus();}
  $('zstudyPause').onclick=()=>{if(question&&!question.saved)return action(async current=>{await call('keep',state.zaino,question.id);if(current()){pause();await refresh();await collection();}});pause();};
  $('zstudyCollection').onclick=()=>{window.bancoMostra('studio');collection().catch(e=>studio.status(e.message,true,'zschedeCollectionStatus'));$('zschedeFilter').focus();};
  $('zstudyUseSources').onclick=()=>{picker.set(state.scope);status('Fonti trasferite da Cerca e studia.');};
  function openReview(){picker.set(state.scope);window.bancoMostra('flashcard');refresh().catch(e=>status(e.message,true));$('zstudyQueueFilter').focus();}
  function start(scope){paused=false;$('zstudyNew').open=true;action(async current=>{if(!await studio.ensureAI('zstudyStatus')||!current())return;if(!window.noteFlush())throw Error('Salva prima gli appunti aperti.');const r=await call('start',state.zaino,{scope:scope?.mode?scope:reviewState.scope,topic:$('zstudyTopic').value});if(current()){review=false;drawQuestion(r.question);await refresh();$('zstudyNew').open=false;$('zstudyQuestion h3')?.focus();status('Domanda pronta. Prova a rispondere prima di vedere la soluzione.');}});}
  $('zstudyCancel').onclick=()=>api.cancel();
  $('zstudyStart').onclick=start;$('zstudyRefresh').onclick=()=>action(async current=>{if(current())await refresh();});
  document.addEventListener('selectionchange',()=>{const sel=window.getSelection();if(sel?.toString().trim() && !box.contains(sel.anchorNode))selection=sel.toString().trim().slice(0,3000);});
  $('zstudySelection').onclick=()=>{const s=window.noteStatoAttivo?.(),selected=s?.mde?.codemirror.getSelection();$('zstudyTopic').value=selected||selection;if(!$('zstudyTopic').value)status('Seleziona prima un passaggio nel documento, negli appunti o una voce della mappa.',true);};
  window.zainoInterrogami=async function({text,file,rimando}={}){
   try{
    $('zstudyTopic').value=String(text||'').slice(0,3000);window.bancoMostra('flashcard');$('zstudyNew').open=true;
    let scope=reviewState.scope;
    if(rimando){const ref=window.RimandiSintassi.leggi(rimando);if(ref?.tipo==='pdf')file=window._pdfNum?.()[ref.numero]||file;}
    if(file){const r=await window.vault.chat.sources(state.zaino),found=r.sources?.filter(s=>s.file===file || s.file.endsWith('/'+file));
      if(found?.length===1)scope={mode:'selected',sourceIds:[found[0].id],wikipedia:false};else throw Error('Fonte della selezione non identificata: scegli le fonti nel Ripasso.');}
    picker.set(scope);status(file?'Interrogazione sulla fonte selezionata.':'Cerco prove per questo argomento nelle fonti scelte; il testo selezionato non è una fonte aggiuntiva.');start(scope);
   }catch(e){status(e.message,true);}
  };
  return {openReview,settled(){drawQueue();$('zschedeEstimate').disabled=!$('zschedeSource').options.length;},async sync(){reviewState.zaino=state.zaino;await picker.sync();if(state.zaino){await Promise.all([refresh(),sources(),collection()]);if(!$('zschedePreset').options.length){const r=await call('presets');for(const [id,label] of Object.entries(r.presets))$('zschedePreset').append(new Option(label,id));}}},scopeChanged(){invalidateEstimate();$('zschedeResult').replaceChildren();sources().catch(e=>status(e.message,true));},reset(){api.cancel();clearTimeout(collectionTimer);collectionRun++;cards=[];savedQuestions=[];queueState={questions:[],due:[]};collectionWarnings=[];$('zschedeKind').value='all';$('zstudyQueueFilter').value='due';$('zstudyNew').open=false;$('zstudySession').textContent='';$('zstudyQueueEmpty').textContent='';document.querySelectorAll('.zstudio-config').forEach(e=>{e.hidden=true;});$('zschedeStatus').textContent='';$('zstudyStatus').textContent='';$('zschedeTokens').textContent='';$('zschedeCollection').replaceChildren();$('zschedeCollectionStatus').textContent='';$('zschedeFilter').value='';$('zschedeNew').open=false;estimate=null;question=null;drafts.clear();visitati.clear();paused=false;review=false;selection='';$('zschedeResult').replaceChildren();$('zschedeSource').replaceChildren();$('zschedeSourceStatus').textContent='';$('zschedeGenerate').hidden=true;$('zschedeEstimateText').textContent='';$('zstudyQuestion').replaceChildren();$('zstudySaved').replaceChildren();$('zstudyQueue').hidden=true;$('zstudyTopic').value='';$('zstudyCount').textContent='';window.RIPCONTO={mai:0,oggi:0,attesa:0,totale:0,corso:state.zaino};window.ripassoContoDisegna?.();},refresh};
 }};
}(typeof self!=='undefined'?self:this));
