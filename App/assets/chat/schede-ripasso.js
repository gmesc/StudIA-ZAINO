/* Schede e interrogazione condividono i servizi; il ripasso sceglie le proprie fonti. */
(function(root){
 'use strict';
 root.ZainoSchedeRipasso={crea:function(studio,state){
  const P=window.ZainoPercorso;
  const {box,el,$}=studio,api=window.vault.studio;
  const action=fn=>studio.action(fn,'zstudyStatus'),status=(text,error)=>studio.status(text,error,'zstudyStatus'),riferimento=s=>studio.riferimento(s,'zstudyStatus');
  const reviewState={zaino:state.zaino,scope:{mode:'all',sourceIds:[],wikipedia:false},sources:[]};
  const extra=el('div');extra.innerHTML=`
   <section id="zschede" aria-label="Schede dello zaino">
    <section id="zschedeLibrary" aria-labelledby="zschedeTitle">
     <div class="zstudio-heading"><h2 id="zschedeTitle">Raccoglitore</h2></div>
     <div class="zstudio-filters"><label for="zschedeFilter">Cerca<input id="zschedeFilter" class="ctl-input" placeholder="Titolo o fonte"></label><label for="zschedeKind">Tipo<select id="zschedeKind"><option value="all">Tutto</option><option value="scheda">Schede</option><option value="domanda">Domande</option></select></label></div>
     <p id="zschedeCollectionStatus" class="zchat-hint" role="status"></p><div id="zschedeCollection" class="zstudio-collection"></div>
    </section>
    <div id="zschedeResult" class="zstudio-results" hidden></div>
    <details id="zschedeNew" class="zstudio-section zstudio-view" hidden><summary>Nuova scheda</summary><p class="zchat-hint">Scegli la fonte e la scheda. Vedrai una stima prima di confermare l’uso dell’AI.</p>
     <label>Fonte<select id="zschedeSource"></select></label><label>Tipo di scheda<select id="zschedePreset"></select></label>
     <p id="zschedeSourceStatus" class="zchat-hint" role="status"></p><p id="zschedeStatus" class="zchat-hint" role="status"></p><div class="zstudio-actions"><button class="tbtn acc" id="zschedeEstimate" type="button">Prepara analisi</button></div>
     <p id="zschedeEstimateText" class="zchat-hint"></p><details id="zschedeCost" hidden><summary>Dettagli del consumo</summary><p id="zschedeTokens" class="zchat-hint"></p></details><button class="tbtn acc" id="zschedeGenerate" type="button" hidden>Genera e salva scheda</button>
    </details>
   </section>
   <section id="zinterroga" class="zstudio-panel" aria-label="Interrogazione e ripasso">
    <div class="tbar" id="zstudyToolbar" role="group" aria-label="Strumenti del ripasso"><button class="tbtn" id="zstudyBack" type="button" hidden>Torna alla domanda</button><button class="tbtn" id="zstudyBrowse" type="button">Domande</button><button class="tbtn" id="zstudyNewButton" type="button">Nuova domanda</button><button class="tbtn" id="zstudyCollection" type="button">Raccoglitore</button><button class="tbtn" id="zstudyCancel" type="button" hidden>Interrompi</button></div>
    <div id="zstudyScopeHost" hidden></div>
    <div id="zstudyBody" class="zstudio zstudio-banco">
     <section id="zstudyHome"><h2 id="zstudyHomeTitle" tabindex="-1">Pronto per ripassare?</h2><p id="zstudyCount" class="zchat-hint" role="status"></p><button id="zstudyBegin" class="tbtn acc" type="button">Inizia ripasso</button><p id="zstudyHomeEmpty" class="zchat-hint">Crea una domanda con AI oppure aprine una dal raccoglitore.</p></section>
     <section id="zstudyChoose" hidden aria-labelledby="zstudyChooseTitle"><div class="zstudio-heading"><h2 id="zstudyChooseTitle" tabindex="-1">Domande</h2><button id="zstudyEdit" class="tbtn" type="button" aria-pressed="false" title="Modifica l’elenco delle domande" aria-label="Modifica l’elenco delle domande"></button></div>
      <div id="zstudyEditBar" class="zstudy-editbar" hidden><label class="zstudy-selection"><input id="zstudySelectAll" type="checkbox">Seleziona elenco</label><span id="zstudySelected" role="status" class="zchat-hint"></span><button id="zstudyDelete" type="button" class="tbtn" title="Elimina dal ripasso le domande selezionate; potrai annullare" disabled>Elimina selezionate</button></div>
      <div id="zstudyUndoBar" class="zstudy-editbar" hidden><span id="zstudyRemoved" class="zchat-hint" role="status"></span><button id="zstudyUndo" type="button" class="tbtn" title="Ripristina l’ultima eliminazione, con i tentativi precedenti">Annulla</button></div>
      <div class="zstudio-filters"><label for="zstudySearch">Cerca domanda o fonte<input id="zstudySearch" type="search" class="ctl-input"></label><label for="zstudyOrigin">Scheda di origine<select id="zstudyOrigin"><option value="all">Tutte le origini</option></select></label></div>
      <div id="zstudyQueueFilter" class="zstudy-filters" role="group" aria-label="Mostra domande"><button type="button" class="tbtn" data-filter="all" aria-pressed="true">Tutte</button><button type="button" class="tbtn" data-filter="due" aria-pressed="false">Da ripassare</button><button type="button" class="tbtn" data-filter="new" aria-pressed="false">Nuove</button><button type="button" class="tbtn" data-filter="later" aria-pressed="false">Più avanti</button></div>
      <p id="zstudyQueueCount" class="zchat-hint" role="status"></p><div id="zstudyQueue" class="zstudy-queue"></div><p id="zstudyQueueEmpty" class="zchat-hint"></p>
     </section>
     <details id="zstudyNew" class="zstudio-section zstudio-view" hidden><summary>Nuova domanda con AI</summary>
      <label class="zstudio-field" for="zstudyTopic">Argomento (facoltativo)<input class="ctl-input" id="zstudyTopic" maxlength="3000" placeholder="I concetti principali delle fonti scelte"></label>
      <div class="zstudio-actions"><button class="tbtn acc" id="zstudyStart" type="button">Crea domanda</button><button class="tbtn" id="zstudySelection" type="button">Usa selezione</button></div>
      <details><summary>Altre fonti</summary><button class="tbtn" id="zstudyUseSources" type="button" title="Sostituisce le fonti del Ripasso con quelle scelte in Cerca nei materiali. Non copia documenti.">Usa fonti della ricerca</button></details>
     </details>
     <p id="zstudyProgress" class="zchat-hint"></p><div id="zstudyQuestion" class="zstudio-results" hidden></div>
     <div id="zstudyNavigation" hidden><div class="zstudio-actions"><button id="zstudyNext" class="tbtn" type="button">Prossima domanda</button><button id="zstudyPause" class="tbtn" type="button">Pausa</button></div><p id="zstudySession" class="zchat-hint" role="status"></p></div>
     <p id="zstudyStatus" role="status" class="zchat-hint"></p>
    </div>
   </section>`;box.append(extra);box.prepend($('zschede'));
  const pane=document.getElementById('ripassoPane');
  if(pane){const old=el('div');old.hidden=true;while(pane.firstChild)old.append(pane.firstChild);pane.append(old,$('zinterroga'));}
  if(!extra.children.length)extra.remove();
  const picker=window.ZainoSceltaFonti.crea({prefix:'zstudyScope',bar:$('zstudyToolbar'),host:$('zstudyScopeHost'),state:reviewState,onChange(){visitati.clear();drawQuestion(null);refresh().catch(e=>status(e.message,true));}});

  let estimate=null,question=null,attemptId=null,review=false,selection='',cards=[],savedQuestions=[],queueState={questions:[],due:[]},collectionWarnings=[],collectionTimer,collectionRun=0;const drafts=new Map(),visitati=new Set();let paused=false,pausedId=null,schedeView='library',ripassoView='home',queueFilter='all';
  const schedeChiuse=new Set(),selezionate=new Set();let modifica=false;
  window.UiIcone.imposta($('zstudyEdit'),'pencil');
  const call=async(n,...args)=>{const r=await api[n](...args);if(!r?.ok)throw Error(r?.error || 'Operazione non riuscita.');return r;};
  const button=(text,fn,principale=false)=>{const b=el('button',text,principale?'tbtn acc':'tbtn');b.type='button';b.onclick=fn;return b;};
  // Una sola attività per superficie; il DOM nascosto conserva filtri e risposte in corso.
  function vistaSchede(view,focus){
   if(view!==schedeView){studio.status('');$('zschedeStatusConfig')?.setAttribute('hidden','');}schedeView=view;box.dataset.vista=view;
   for(const [id,v] of [['zschedeLibrary','library'],['zschedeResult','card'],['zschedeNew','new'],['zragSearch','search']])$(id).hidden=view!==v;
   $('zschedeNew').open=view==='new';$('zragSearch').open=view==='search';
   $('zragScopeButton').hidden=view!=='search';$('zragScopeHost').hidden=view!=='search';$('zragScopeSummary').hidden=view!=='search';
   for(const [id,attivo] of [['zschedeBack',view==='library'],['zschedeNewButton',view==='new']]){const b=$(id);b.hidden=false;b.classList.toggle('acc',attivo);if(attivo)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}
   $('zragScopeSep').hidden=view!=='search';
   box.scrollTop=0;if(focus)$(focus)?.focus();
  }
  function vistaRipasso(view,focus){
   if(view!=='queue'){modifica=false;selezionate.clear();}ripassoView=view;$('zstudyBody').dataset.vista=view;
   for(const [id,v] of [['zstudyHome','home'],['zstudyChoose','queue'],['zstudyNew','new'],['zstudyQuestion','question'],['zstudyProgress','question'],['zstudyNavigation','question']])$(id).hidden=view!==v;
   $('zstudyNew').open=view==='new';
   $('zstudyScopeButton').hidden=!['new','queue'].includes(view);$('zstudyScopeHost').hidden=!['new','queue'].includes(view);
   $('zstudyBack').hidden=!['new','queue'].includes(view);$('zstudyBack').textContent=question?'Torna alla domanda':'Indietro';
   $('zstudyBrowse').hidden=view==='queue';$('zstudyNewButton').hidden=view==='new';
   $('zstudyBody').scrollTop=0;if(focus)$(focus)?.focus();
  }
  function pulisciAvvisoRipasso(){status('');$('zstudyStatusConfig')?.setAttribute('hidden','');}
  function tornaRipasso(){pulisciAvvisoRipasso();vistaRipasso(question?'question':'home');(question?$('zstudyQuestion h3'):$('zstudyHomeTitle'))?.focus();}
  $('zstudyBrowse').onclick=()=>{pulisciAvvisoRipasso();vistaRipasso('queue','zstudySearch');refresh().catch(e=>status(e.message,true));};
  $('zstudyNewButton').onclick=()=>{pulisciAvvisoRipasso();vistaRipasso('new','zstudyTopic');};$('zstudyBack').onclick=tornaRipasso;
  $('zstudyBegin').onclick=()=>{const q=P.riprendi(domandeDisponibili(),queueState.due,pausedId);if(q)openQuestion(q.id);else {queueFilter='all';drawQueue();vistaRipasso('queue','zstudySearch');}};
  // Mantiene compatibili i collegamenti diretti che aprono una sezione.
  for(const [id,view] of [['zschedeNew','new'],['zragSearch','search']])$(id).addEventListener('toggle',()=>{if($(id).open&&schedeView!==view)vistaSchede(view);else if(!$(id).open&&schedeView===view)vistaSchede('library');});
  $('zstudyNew').addEventListener('toggle',()=>{if($('zstudyNew').open&&ripassoView!=='new')vistaRipasso('new');else if(!$('zstudyNew').open&&ripassoView==='new')tornaRipasso();});
  function drawCollection(){
   const query=$('zschedeFilter').value.trim(),found=P.filtra(P.raccolta(cards,savedQuestions),query,$('zschedeKind').value),target=$('zschedeCollection');target.replaceChildren();
   $('zschedeCollectionStatus').textContent=cards.length+(cards.length===1?' scheda · ':' schede · ')+savedQuestions.filter(q=>q.saved).length+' domande'+(query?' · mostrate: '+found.length:'')+(collectionWarnings.length?' · '+collectionWarnings.join(' '):'');
   if(!found.length){target.append(el('p',cards.length||savedQuestions.some(q=>q.saved)?'Nessun contenuto corrisponde al filtro.':'Non ci sono ancora schede o domande conservate. Premi «Nuova scheda» per iniziare.','zchat-hint'));return;}
   for(const c of found){
    if(c.tipo==='domanda'){const row=el('article');row.dataset.questionId=c.id;const b=button(c.question,()=>openQuestion(c.id));b.setAttribute('aria-label','Apri domanda: '+c.question);b.title=c.question;row.append(el('span','Domanda','zstudio-item-type'));b.classList.add('zstudio-card-open');row.append(b,el('p',[...new Set(c.sources.map(s=>s.file.split('/').pop()))].join(' · ')+' · '+c.attempts.length+' tentativi'+(c.prossimo?' · prossimo: '+new Date(c.prossimo).toLocaleString('it-IT'):' · Nuova')+(c.sourcesCurrent===false?' · Fonti modificate o non disponibili':''),'zchat-hint'));target.append(row);continue;}

    const row=el('article'),open=button(c.file.split('/').pop(),()=>studio.action(async current=>{const r=await call('card',state.zaino,c.sourceId,c.preset);if(current()){drawCard(r.card,r.status);$('zschedeResult').scrollIntoView({block:'nearest'});}}));open.classList.add('zstudio-card-open');open.title=c.title+' — '+c.file;open.setAttribute('aria-label','Apri '+c.title+': '+c.file.split('/').pop());
    const label={current:'Aggiornata',changed:'Fonte modificata · da aggiornare',removed:'Fonte non disponibile'}[c.status];
    row.append(el('span',c.title,'zstudio-item-type'),open,el('p',label+(c.partial?' · analisi parziale':''),'zchat-hint'));target.append(row);
   }
  }
  async function collection(){const z=state.zaino,run=++collectionRun;const [r,q]=await Promise.allSettled([call('cards',z),call('state',z)]);if(z!==state.zaino||run!==collectionRun)return;
   cards=r.status==='fulfilled'?r.value.cards:[];savedQuestions=q.status==='fulfilled'?q.value.questions:[];collectionWarnings=[...(r.status==='fulfilled'?r.value.warnings:['Schede non leggibili: '+r.reason.message]),...(q.status==='fulfilled'?[]:['Domande non leggibili: '+q.reason.message])];drawCollection();}
  window.vault.rag.onAuto(s=>{if(s.zaino!==state.zaino||!['queued','waiting-model','ready','warning','error'].includes(s.phase))return;clearTimeout(collectionTimer);collectionTimer=setTimeout(()=>Promise.all([collection(),refresh()]).catch(e=>studio.status(e.message,true,'zschedeCollectionStatus')),250);});
  $('zschedeFilter').oninput=drawCollection;$('zschedeKind').onchange=drawCollection;
  function mostraRaccolta(){vistaSchede('library','zschedeFilter');collection().catch(e=>studio.status(e.message,true,'zschedeCollectionStatus'));}
  async function sources(prefer=false){const z=state.zaino,result=await window.vault.chat.sources(z);if(z!==state.zaino)return;if(!result?.ok)throw Error(result?.error);const old=$('zschedeSource').value,available=result.sources;$('zschedeSource').replaceChildren();for(const source of available)$('zschedeSource').append(new Option(source.file,source.id));const choice=P.fontePreferita(available,prefer?[studio.documento()]:[],old);if(choice)$('zschedeSource').value=choice;if(old!==$('zschedeSource').value)invalidateEstimate();$('zschedeEstimate').disabled=!$('zschedeSource').options.length;$('zschedeSourceStatus').textContent=$('zschedeSource').options.length?'':'Nessuna fonte disponibile nello zaino.';}
  function drawCard(c,st){
   vistaSchede('card');const target=$('zschedeResult');target.replaceChildren();if(!c){target.append(el('p','Nessuna scheda disponibile.'));return;}
   target.append(el('h3',(cards.find(s=>s.sourceId===c.sourceId&&s.preset===c.preset)?.title||c.preset)+' — '+c.file.split('/').pop()));
   target.append(el('p',(st==='changed'?'Fonte modificata. ':st==='removed'?'Fonte rimossa. ':'')+'Copertura: '+c.covered+'/'+c.total+' passaggi'+(c.partial?' · analisi parziale':'')+' · '+c.provider+' / '+c.model));
   const heading=target.querySelector('h3');heading.tabIndex=-1;heading.focus();
   for(const [index,item] of c.items.entries()){const row=el('article'),body=el('div',undefined,'zstudio-card-text'),template=document.createElement('template');
    template.innerHTML=window.LetturaCapitolo.crea().mdToHtml(window.ZainoSchedeTesto.etichette(item.text),true);
    body.append(window.ZainoChatUI.copyFormatting(template.content,document));row.append(el(c.preset==='domande'?'h4':'strong',item.title),body);const refs=el('div',undefined,'zstudio-card-refs');for(const s of window.ZainoCitazioni.perRiferimenti(item.refs,c.sources))refs.append(studio.riferimento(s));row.append(refs);
    if(c.preset==='domande')row.append(button('Rispondi',()=>studio.action(async current=>{const r=await call('fromCard',state.zaino,c.sourceId,index,c.revision);if(current()){await collection();await loadQuestion(r.question.id,current);}}),true));target.append(row);}
   target.append(button(c.preset==='domande'?'Crea appunti da domanda':'Crea appunti da scheda',()=>studio.action(async current=>{const r=await call('copyCard',state.zaino,c.sourceId,c.preset);if(current()){window.notesReload();window.refreshMyNotes();window.noteApriAttivo(r.file);studio.status(r.duplicate?'Copia già presente negli appunti.':'Copia personale conservata.');}}),true));
   if(st!=='removed'){const regenerate=button('Rigenera…',()=>studio.action(current=>prepare(current,c.sourceId,c.preset)),true);regenerate.classList.add('zstudio-card-regenerate');regenerate.title='Mostra la stima prima di confermare l’uso dell’AI.';target.append(regenerate);}
  }
  const nuova=button('Scheda',async()=>{if(schedeView==='new'){$('zschedeSource').focus();return;}nuova.disabled=true;try{await sources(true);vistaSchede('new','zschedeSource');}catch(e){vistaSchede('new');studio.status(e.message,true,'zschedeStatus');$('zschedeStatus').scrollIntoView({block:'nearest'});}finally{nuova.disabled=false;}});nuova.id='zschedeNewButton';nuova.title='Crea una nuova scheda da una fonte';nuova.setAttribute('aria-label','Nuova scheda');nuova.insertAdjacentHTML('afterbegin',window.UiIcone.svg('plus'));$('zragToolbar').prepend(nuova);
  const back=button('Raccoglitore',mostraRaccolta);back.id='zschedeBack';back.title='Mostra le schede e le domande salvate';const sep=el('span',undefined,'tbsep');nuova.after(sep,back);const scopeSep=el('span',undefined,'tbsep');scopeSep.id='zragScopeSep';back.after(scopeSep);const search=button('Cerca nei materiali',()=>vistaSchede('search','zragQuery'));search.id='zragSearchButton';search.title='Cerca parole e passaggi nei documenti e negli appunti dello zaino';document.querySelector('#zschedeLibrary .zstudio-heading').append(search);
  function invalidateEstimate(){estimate=null;$('zschedeGenerate').hidden=true;$('zschedeEstimateText').textContent='';$('zschedeTokens').textContent='';$('zschedeCost').open=false;$('zschedeCost').hidden=true;$('zschedeEstimate').textContent='Prepara analisi';$('zschedeEstimate').classList.add('acc');}
  for(const id of ['zschedeSource','zschedePreset'])$(id).onchange=invalidateEstimate;
  async function prepare(current,sourceId,preset){
   invalidateEstimate();vistaSchede('new');
   if(!await studio.ensureAI('zschedeStatus')||!current())return;
   if(!window.noteFlush())throw Error('Salva prima gli appunti aperti.');const r=await call('estimate',state.zaino,sourceId,preset);if(!current())return;
   if(![...$('zschedeSource').options].some(o=>o.value===sourceId))$('zschedeSource').append(new Option(r.file,sourceId));
   $('zschedeSource').value=sourceId;$('zschedePreset').value=preset;
   estimate=r;studio.status('',false,'zschedeStatus');$('zschedeCost').hidden=false;$('zschedeEstimate').textContent='Ricalcola stima';$('zschedeEstimate').classList.remove('acc');$('zschedeEstimateText').textContent='Materiale: '+r.file.split('/').pop()+' · '+r.covered+'/'+r.total+' passaggi'+(r.partial?' · analisi parziale':'')+'. AI cloud: '+r.provider+' / '+r.model+'. La conferma genera e salva la scheda nel raccoglitore. '+r.warnings.join(' ');
   $('zschedeTokens').textContent='Circa '+r.estimatedInputTokens+' token in ingresso per richiesta (risposta esclusa); un’eventuale correzione può richiedere una seconda chiamata.';$('zschedeGenerate').hidden=false;$('zschedeGenerate').scrollIntoView({block:'nearest'});

  }
  $('zschedeEstimate').onclick=()=>studio.action(current=>prepare(current,$('zschedeSource').value,$('zschedePreset').value),'zschedeStatus');
  $('zschedeGenerate').onclick=()=>studio.action(async current=>{if(!estimate)throw Error('Prepara prima l’analisi.');if(!await studio.ensureAI('zschedeStatus')||!current())return;const r=await call('analyze',state.zaino,{sourceId:estimate.sourceId,preset:estimate.preset,expectedRevision:estimate.revision,expectedProvider:estimate.provider,expectedModel:estimate.model});if(current()){await collection();await refresh();drawCard(r.card,'current');$('zschedeNew').open=false;$('zschedeResult').scrollIntoView({block:'nearest'});studio.status('Scheda generata e aggiunta al raccoglitore.');}},'zschedeStatus');
  function drawQuestion(q,navigate=true){
   if(question && $('zstudyAttempt'))drafts.set(question.id,$('zstudyAttempt').value);question=q;const target=$('zstudyQuestion');target.replaceChildren();if(!q){if(ripassoView==='question')vistaRipasso('home');return;}if(navigate)vistaRipasso('question');
   const heading=el('h3',q.question);heading.tabIndex=-1;target.append(heading);target.append(el('p','Materiali della domanda: '+[...new Set(q.sources.map(s=>s.file.split('/').pop()))].join(' · '),'zchat-hint'));
   const aids=el('div',undefined,'zstudy-aids');target.append(aids);const hint=el('details');hint.append(el('summary','Indizio'),el('p',q.hint));aids.append(hint);
   const proofs=el('details');proofs.append(el('summary','Fonti della domanda'));for(const s of q.sources)proofs.append(riferimento(s));aids.append(proofs);
   if(q.sourcesCurrent===false)target.append(el('p','Fonti cambiate o non disponibili: la valutazione automatica sarà sospesa.'));
   const form=el('form'),label=el('label','Il tuo tentativo'),text=el('textarea');text.id='zstudyAttempt';text.maxLength=12000;text.rows=4;text.className='ctl-input';label.htmlFor=text.id;form.append(label,text);
   const send=button('Verifica risposta',()=>{});send.type='submit';send.classList.add('acc');form.append(send);target.append(form);
   const pending=q.attempts.findLast(a=>a.status==='error'||a.status==='pending');if(pending && !review){text.value=pending.text;attemptId=pending.id;}else {attemptId=crypto.randomUUID();text.value=drafts.get(q.id)||'';}
   form.onsubmit=e=>{e.preventDefault();const answer=text.value;action(async current=>{if(!await studio.ensureAI('zstudyStatus','zstudyAttempt')||!current())return;const r=await call('answer',state.zaino,q.id,{attemptId,text:answer});if(current()){drafts.delete(q.id);text.value='';review=false;drawQuestion(r.question);await refresh();($('zstudyFeedbackTitle')||$('zstudyAttempt'))?.focus();}});};
   text.oninput=()=>{if(pending && text.value!==pending.text)attemptId=crypto.randomUUID();};
   const last=!review?q.attempts.at(-1):null;
   if(last?.status==='done'){
    form.hidden=true;const sent=el('details');sent.append(el('summary','La tua risposta'),el('p',last.text));target.append(sent);
    const fb=el('article');fb.className='zstudy-feedback';const fbTitle=el('h4','Riscontro');fbTitle.id='zstudyFeedbackTitle';fbTitle.tabIndex=-1;fb.append(fbTitle);fb.append(el('p',last.feedback.summary));for(const [key,label] of [['correct','Parti corrette'],['missing','Da completare'],['contradictory','Da correggere']])if(last.feedback[key].length)fb.append(el('strong',label),el('p',last.feedback[key].join('\n')));
    if(!last.feedback.assessable)fb.append(el('p','Non valutabile automaticamente. Puoi scegliere tu l’esito del ripasso.'));
    const solution=el('details');solution.append(el('summary','Risposta attesa e criteri'),el('p',q.answer),el('p',(q.rubric||[]).join('\n')));fb.append(solution);
    fb.append(el('p','Scegli o correggi il tuo esito:'));
    for(const es of q.anteprima){const outcome=button(es.esito.replace('-',' ')+' · '+es.testo,()=>action(async current=>{const r=await call('outcome',state.zaino,q.id,last.id,es.esito);if(current()){drawQuestion(r.question);await refresh();status('Esito conservato; puoi correggerlo.');$('zstudyQuestion').querySelector('[data-esito="'+es.esito+'"]')?.focus();}}));outcome.dataset.esito=es.esito;fb.append(outcome);}
    target.append(fb);const retry=button('Riprova',()=>{form.hidden=false;text.focus();});retry.id='zstudyRetry';target.append(retry);
   }else if(last?.error)target.append(el('p','Tentativo conservato: '+last.error));
   if(!q.saved)target.append(button('Conserva nel ripasso',()=>action(async current=>{const r=await call('keep',state.zaino,q.id);if(current()){drawQuestion(r.question);await refresh();await collection();status('Domanda conservata nel raccoglitore e in Ripasso.');$('zstudyQuestion h3')?.focus();}}),true));
   else if(q.prossimo)target.append(el('p','Ripasso prossimo: '+new Date(q.prossimo).toLocaleString('it-IT'),'zchat-hint'));
   if(q.attempts.length){const history=el('details');history.append(el('summary','Tentativi precedenti · '+q.attempts.length));for(const a of q.attempts){history.append(el('p',new Date(a.createdAt).toLocaleString('it-IT')+' — '+a.text+'\n'+(a.feedback?.summary||a.error||'Riscontro interrotto')));}target.append(history);}
  }
  async function refresh(){const z=state.zaino,scope=JSON.stringify(reviewState.scope),r=await call('state',z,reviewState.scope);if(z!==state.zaino||scope!==JSON.stringify(reviewState.scope))return;
   queueState=r;drawQueue();
   const all=domandeDisponibili(),due=P.coda(all,r.due,'due').length;
   window.RIPCONTO={mai:P.coda(all,r.due,'new').length,oggi:all.filter(q=>q.esito&&r.due.includes(q.id)).length,attesa:all.length-due,totale:all.length,corso:z};window.ripassoContoDisegna?.();
   $('zstudyCount').textContent=all.length+(all.length===1?' domanda disponibile · ':' domande disponibili · ')+due+' da ripassare · '+(all.length-due)+' più avanti';
   if(question && !r.questions.some(q=>q.id===question.id))drawQuestion(null);
   if(!question && r.active&&!paused){review=false;drawQuestion(r.active,ripassoView==='home'||ripassoView==='question');}drawQueue();
  }
  function domandeDisponibili(){return P.domande(queueState.questions,queueState.cardQuestions);}
  function domandeFiltrate(){return P.coda(domandeDisponibili(),queueState.due,queueFilter,$('zstudySearch').value,$('zstudyOrigin').value);}
  function selezioneDisegna(){
   const rows=domandeFiltrate(),ids=new Set(rows.map(q=>q.id));for(const q of selezionate)if(!ids.has(q))selezionate.delete(q);
   $('zstudyEdit').setAttribute('aria-pressed',String(modifica));$('zstudyEdit').title=modifica?'Termina le modifiche':'Modifica l’elenco delle domande';$('zstudyEdit').setAttribute('aria-label',$('zstudyEdit').title);
   $('zstudyEditBar').hidden=!modifica;$('zstudyDelete').disabled=!selezionate.size;
   $('zstudySelected').textContent=selezionate.size+(selezionate.size===1?' selezionata':' selezionate');
   const all=$('zstudySelectAll');all.checked=!!rows.length&&rows.every(q=>selezionate.has(q.id));all.indeterminate=!!selezionate.size&&!all.checked;all.disabled=!rows.length;
   all.title='Seleziona tutte le domande dell’elenco con i filtri attuali, anche nei gruppi chiusi';
   for(const cb of $('zstudyQueue').querySelectorAll('input[type="checkbox"]')){const chosen=cb._questionIds.filter(id=>selezionate.has(id)).length;cb.checked=chosen===cb._questionIds.length;cb.indeterminate=chosen>0&&!cb.checked;}
   const removed=queueState.rimozione;$('zstudyUndoBar').hidden=!removed;
   $('zstudyRemoved').textContent=removed?removed.count+(removed.count===1?' domanda eliminata':' domande eliminate')+' dal ripasso.':'';
  }
  function spunta(ids,label){
   const wrap=el('label',undefined,'zstudy-selection'),input=el('input');input.type='checkbox';input._questionIds=ids;input.setAttribute('aria-label',label);input.title=label;
   input.onchange=()=>{for(const id of ids){if(input.checked)selezionate.add(id);else selezionate.delete(id);}selezioneDisegna();};
   wrap.onclick=e=>e.stopPropagation();wrap.append(input);return wrap;
  }
  $('zstudyEdit').onclick=()=>{modifica=!modifica;selezionate.clear();drawQueue();};
  $('zstudySelectAll').onchange=e=>{for(const q of domandeFiltrate()){if(e.target.checked)selezionate.add(q.id);else selezionate.delete(q.id);}selezioneDisegna();};
  $('zstudyDelete').onclick=()=>{const ids=[...selezionate];if(!ids.length)return;action(async current=>{
   await call('remove',state.zaino,ids);if(!current())return;
   if(ids.includes(question?.id))drawQuestion(null);if(ids.includes(pausedId))pausedId=null;
   for(const id of ids)visitati.delete(id);selezionate.clear();await refresh();await collection();$('zstudyUndo').focus();
  });};
  $('zstudyUndo').onclick=()=>{const token=queueState.rimozione?.token;if(!token)return;action(async current=>{const r=await call('undoRemove',state.zaino,token);if(current()){await refresh();await collection();status(r.count+(r.count===1?' domanda ripristinata.':' domande ripristinate.'));$('zstudyEdit').focus();}});};
  function drawQueue(){
   const all=domandeDisponibili(),resume=P.riprendi(all,queueState.due,pausedId);
   $('zstudyHomeTitle').textContent=paused?'Ripasso in pausa':'Pronto per ripassare?';$('zstudyBegin').textContent=paused&&resume?'Riprendi':resume?'Inizia ripasso':'Scegli una domanda';
   $('zstudyBegin').hidden=!all.length;$('zstudyHomeEmpty').hidden=!!all.length;
   const origin=$('zstudyOrigin'),selected=origin.value,origins=new Map();for(const q of all)if(q.scheda)origins.set(q.scheda.sourceId,q.scheda);
   origin.replaceChildren(new Option('Tutte le origini','all'));
   for(const s of [...origins.values()].sort((a,b)=>a.file.localeCompare(b.file,'it')))origin.append(new Option(s.title+' — '+s.file.split('/').pop(),s.sourceId));
   if(all.some(q=>!q.scheda))origin.append(new Option('Senza scheda','none'));
   // Un filtro su una scheda rimossa resta esplicito, senza passare in silenzio a tutte.
   if(selected && ![...origin.options].some(o=>o.value===selected))origin.append(new Option('Scheda non disponibile nelle fonti scelte',selected));
   origin.value=selected||'all';
   const rows=domandeFiltrate(),target=$('zstudyQueue'),focused=target.contains(document.activeElement)?{...document.activeElement.dataset}:null;
   for(const d of target.querySelectorAll('details[data-scheda-id]')){if(d.open)schedeChiuse.delete(d.dataset.schedaId);else schedeChiuse.add(d.dataset.schedaId);}
   target.replaceChildren();
   function listaDomande(questions){
    const list=el('ul');
    for(const q of questions){
     const row=el('li'),open=button(q.question,()=>openQuestion(q.id));open.classList.add('zstudy-question-open');open.dataset.questionId=q.id;
     const current=q.id===question?.id;if(current)open.setAttribute('aria-current','true');
     if(modifica){row.classList.add('zstudy-editing');const check=spunta([q.id],'Seleziona domanda: '+q.question);check.querySelector('input').dataset.selectionId=q.id;row.append(check);}row.append(open);
     const meta=el('div',undefined,'zstudy-question-meta');
     if(current)meta.append(el('span','Aperta','zstudy-current'));
     if(q.scheda){const chip=el('span','Scheda · '+q.scheda.title,'zstudy-origin-chip');chip.title=q.scheda.title+' — '+q.scheda.file;meta.append(chip);}
     const due=queueState.due.includes(q.id),label=!q.esito?'Nuova':due?'Da ripassare':'Più avanti';
     meta.append(el('span',label+' · '+q.attempts.length+(q.attempts.length===1?' tentativo':' tentativi')+(q.prossimo&&!due?' · '+new Date(q.prossimo).toLocaleDateString('it-IT'):'')));
     if(q.sourcesCurrent===false)meta.append(el('span','Fonti modificate o non disponibili'));
     row.append(meta);list.append(row);
    }return list;
   }
   for(const group of P.gruppiDomande(rows)){
    const section=el('section',undefined,'zstudy-source-group'),heading=el('h3',group.files.map(f=>f.split('/').pop()).join(' · '));heading.title=group.files.join(' · ');section.append(heading);
    for(const card of group.schede){
     const details=el('details',undefined,'zstudy-card-group'),summary=el('summary');summary.append(el('span',card.title+' · '+card.questions.length+(card.questions.length===1?' domanda':' domande')));
     if(modifica)summary.append(spunta(card.questions.map(q=>q.id),'Seleziona le domande della scheda '+card.title+' nell’elenco'));
     details.dataset.schedaId=summary.dataset.schedaId=card.sourceId;details.open=!schedeChiuse.has(card.sourceId);
     const tooltip=()=>{summary.title=(details.open?'Comprimi':'Espandi')+' le domande della scheda';};tooltip();
     details.ontoggle=()=>{if(!details.isConnected)return;if(details.open)schedeChiuse.delete(card.sourceId);else schedeChiuse.add(card.sourceId);tooltip();};
     details.append(summary,listaDomande(card.questions));section.append(details);
    }
    if(group.questions.length)section.append(listaDomande(group.questions));
    target.append(section);
   }
   for(const b of $('zstudyQueueFilter').querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.filter===queueFilter));
   $('zstudyQueue').hidden=!rows.length;
   $('zstudyQueueCount').textContent=rows.length+(rows.length===1?' domanda':' domande')+(rows.length!==all.length?' su '+all.length:'')+(queueState.warnings?.length?' · '+queueState.warnings.join(' '):'');
   $('zstudyQueueEmpty').textContent=rows.length?'':all.length?'Nessuna domanda corrisponde ai filtri. Cambia lo stato, la ricerca o la scheda di origine.':'Nessuna domanda disponibile nelle fonti scelte. Crea una domanda o prepara una scheda «Domande per capire».';
   $('zstudyProgress').textContent=question?(rows.some(q=>q.id===question.id)?'Domanda '+(rows.findIndex(q=>q.id===question.id)+1)+' di '+rows.length:'Domanda di ripasso'):'';
   const remaining=rows.filter(q=>q.id!==question?.id&&!visitati.has(q.id));$('zstudyNext').disabled=!remaining.length;$('zstudyNext').classList.toggle('acc',!!question?.attempts.at(-1)?.corrections?.length);$('zstudyPause').disabled=!question;
   $('zstudySession').textContent=rows.length&&!remaining.length&&question?'Hai aperto tutte le domande. Scegline un’altra da «Domande».':'';
   selezioneDisegna();
   if(focused)[...target.querySelectorAll('button,summary,input')].find(b=>focused.selectionId?b.dataset.selectionId===focused.selectionId:focused.questionId?b.dataset.questionId===focused.questionId:b.dataset.schedaId===focused.schedaId)?.focus({preventScroll:true});
  }
  async function loadQuestion(id,current){const preview=queueState.cardQuestions?.find(q=>q.id===id),saved=queueState.questions.some(q=>q.id===id);const r=preview&&!saved?await call('fromCard',state.zaino,preview.scheda.sourceId,preview.scheda.index,preview.scheda.revision,preview.id):await call('resume',state.zaino,id);if(current()){paused=false;pausedId=null;pulisciAvvisoRipasso();const scope=P.ambitoDomanda(reviewState.scope,r.question);if(JSON.stringify(scope)!==JSON.stringify(reviewState.scope)){picker.set(scope);status('Aggiunte alle fonti del ripasso quelle della domanda aperta.');}if(question)visitati.add(question.id);review=true;drawQuestion(r.question);window.bancoMostra('flashcard');await refresh();await collection();$('zstudyQuestion h3')?.focus();}}
  function openQuestion(id){return action(current=>loadQuestion(id,current));}
  $('zstudyNext').onclick=()=>{const next=domandeFiltrate().find(q=>q.id!==question?.id&&!visitati.has(q.id));if(next)openQuestion(next.id);};
  $('zstudyQueueFilter').onclick=e=>{const b=e.target.closest('button[data-filter]');if(b){queueFilter=b.dataset.filter;visitati.clear();drawQueue();}};
  $('zstudySearch').oninput=$('zstudyOrigin').onchange=()=>{visitati.clear();drawQueue();};
  function pause(){pausedId=question?.id||pausedId;paused=true;visitati.clear();drawQuestion(null);drawQueue();pulisciAvvisoRipasso();vistaRipasso('home','zstudyBegin');}
  $('zstudyPause').onclick=()=>{if(question&&!question.saved)return action(async current=>{await call('keep',state.zaino,question.id);if(current()){pause();await refresh();await collection();}});pause();};
  $('zstudyCollection').onclick=()=>{window.bancoMostra('studio');mostraRaccolta();};
  $('zstudyUseSources').onclick=()=>{picker.set(state.scope);status('Fonti della ricerca applicate al Ripasso.');};
  function start(scope){paused=false;vistaRipasso('new');action(async current=>{if(!await studio.ensureAI('zstudyStatus')||!current())return;if(!window.noteFlush())throw Error('Salva prima gli appunti aperti.');const r=await call('start',state.zaino,{scope:scope?.mode?scope:reviewState.scope,topic:$('zstudyTopic').value});if(current()){review=false;drawQuestion(r.question);await refresh();$('zstudyNew').open=false;$('zstudyQuestion h3')?.focus();status('');}});}
  $('zstudyCancel').onclick=()=>api.cancel();
  $('zstudyStart').onclick=start;
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
  vistaSchede('library');vistaRipasso('home');
  return {settled(){drawQueue();$('zschedeEstimate').disabled=!$('zschedeSource').options.length;},async sync(){reviewState.zaino=state.zaino;await picker.sync();if(state.zaino){await Promise.all([refresh(),sources(),collection()]);if(!$('zschedePreset').options.length){const r=await call('presets');for(const [id,label] of Object.entries(r.presets))$('zschedePreset').append(new Option(label,id));}}},reset(){api.cancel();clearTimeout(collectionTimer);collectionRun++;cards=[];savedQuestions=[];queueState={questions:[],due:[]};collectionWarnings=[];$('zschedeKind').value='all';queueFilter='all';$('zstudySearch').value='';$('zstudyOrigin').replaceChildren(new Option('Tutte le origini','all'));$('zstudyQueueCount').textContent='';$('zstudyNew').open=false;$('zstudySession').textContent='';$('zstudyQueueEmpty').textContent='';document.querySelectorAll('.zstudio-config').forEach(e=>{e.hidden=true;});$('zschedeStatus').textContent='';$('zstudyStatus').textContent='';$('zschedeTokens').textContent='';$('zschedeCollection').replaceChildren();$('zschedeCollectionStatus').textContent='';$('zschedeFilter').value='';$('zschedeNew').open=false;estimate=null;question=null;drafts.clear();visitati.clear();schedeChiuse.clear();selezionate.clear();modifica=false;selezioneDisegna();paused=false;pausedId=null;review=false;selection='';vistaSchede('library');vistaRipasso('home');$('zschedeResult').replaceChildren();$('zschedeSource').replaceChildren();$('zschedeSourceStatus').textContent='';$('zschedeGenerate').hidden=true;$('zschedeEstimateText').textContent='';$('zstudyQuestion').replaceChildren();$('zstudyQueue').replaceChildren();$('zstudyQueue').hidden=true;$('zstudyTopic').value='';$('zstudyCount').textContent='';window.RIPCONTO={mai:0,oggi:0,attesa:0,totale:0,corso:state.zaino};window.ripassoContoDisegna?.();},refresh};
 }};
}(typeof self!=='undefined'?self:this));
