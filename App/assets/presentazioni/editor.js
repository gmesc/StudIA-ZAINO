(function(){
 'use strict';
 const M=window.PresentaModello,api=window.vault?.presentazioni;
 if(!api||!M)return;
 const $=id=>document.getElementById(id),E=(tag,testo,classe)=>{const e=document.createElement(tag);if(testo!=null)e.textContent=testo;if(classe)e.className=classe;return e;};
 let selezioneGiro=0;
 let corso='',elenco=[],slideId='',giro=0,occupato=false,listaErrore='',regia=null,previewTimer=null,previewGiro=0,quadro=null,framePronto=false,firma='',canale=crypto.randomUUID();
 let avviso;
 let host,bar,corpo,scaletta,campi,frame,stato,vuoto,editor,gobbo,gobboBar,gobboCorpo,gobboStato;
 const bottoni={},D=PresentaDocumento.crea({salva:async(d,baseRevision)=>(await call({azione:'salva',documento:d,baseRevision})).documento,
  bozza:(d,baseRevision)=>call({azione:'bozza',documento:d,baseRevision}),cambiata:()=>{if(host)disegna();}});
 async function call(o,z=corso){const r=await api.comando({...o,corso:z});if(!r?.ok)throw Error(r?.error||'PRESENTA non disponibile.');return r;}
 async function azione(fn){try{return await fn();}catch(e){listaErrore=e.message;disegna();window.toast?.(e.message,false);}}
 function b(nome,icona,fn,chiave){const e=E('button',null,'tbtn');e.type='button';e.title=nome;e.setAttribute('aria-label',nome);if(icona)UiIcone.imposta(e,icona);else e.textContent=nome;e.onclick=()=>azione(fn);if(chiave){e.dataset.presentaAction=chiave;bottoni[chiave]=e;}return e;}
 function campo(nome,valore,fn,{tipo='text',opzioni,maxLength,min,max}={}){
  const label=E('label',nome,'presenta-campo'),input=E(tipo==='textarea'?'textarea':opzioni?'select':'input');input.setAttribute('aria-label',nome);
  if(opzioni)for(const [value,text]of opzioni)input.append(new Option(text,value));else if(tipo!=='textarea')input.type=tipo;
  if(maxLength)input.maxLength=maxLength;if(min!==undefined)input.min=min;if(max!==undefined)input.max=max;
  input.value=valore??'';input.addEventListener(opzioni||tipo==='number'?'change':'input',()=>azione(()=>{if(tipo==='number'&&(!input.value||!input.validity.valid)){input.reportValidity();return;}return fn(input.value,input);}));label.append(input);return label;
 }
 function posizione(){const d=D.documento;if(!d)return null;return M.posizioni(d).find(p=>p.slide.id===slideId)||M.posizioni(d)[0];}
 function modifica(o,{struttura=false,seleziona}={}){listaErrore='';const d=D.applica(o);if(seleziona)slideId=seleziona(d);if(struttura)campiSlide();disegna();return d;}
 function op(o,opts){return modifica({slideId:posizione().slide.id,...o},opts);}
 function memoria(){return 'studia.presenta.'+corso;}
 function ricorda(){if(corso&&D.documento)try{localStorage.setItem(memoria(),JSON.stringify({id:D.documento.id,slideId}));}catch(_){}window.bancoAggiornaDocumenti?.();}
 function anteprima(){
  clearTimeout(previewTimer);const d=D.documento;if(!d||!window.bancoVisibile?.('presenta'))return;
  const stamp=JSON.stringify({...d,revision:0});if(stamp===firma){vaiAnteprima();return;}const n=++previewGiro,z=corso;
  previewTimer=setTimeout(()=>azione(async()=>{const r=await call({azione:'vista',documento:d},z);if(n!==previewGiro||z!==corso||D.documento?.id!==d.id)return;
   firma=stamp;quadro={presenta:canale,tipo:'quadro',documento:r.documento,posizione:coordinate()};if(framePronto)frame.contentWindow.postMessage(quadro,'*');
  }),180);
 }
 function coordinate(){const p=posizione();return {h:p?.h||0,v:p?.v||0,fragmentIndex:-1};}
 function vaiAnteprima(){if(framePronto&&quadro)frame.contentWindow.postMessage({presenta:canale,tipo:'vai',posizione:coordinate()},'*');}
 function elencoBarra(){
  const sel=$('presentaDocumenti'),id=D.documento?.id||'';const entries=elenco.map(d=>[d.id,d.title]);
  if(id&&!entries.some(e=>e[0]===id))entries.push([id,D.documento.title]);
  const f=JSON.stringify(entries);if(sel.dataset.firma!==f){sel.replaceChildren(new Option('Apri una presentazione…',''),...entries.map(([v,t])=>new Option(t,v)));sel.dataset.firma=f;}sel.value=id;
  sel.disabled=occupato||D.bloccato||!corso;
 }
 function disegna(){
  if(!host)return;const d=D.documento,p=posizione(),disabled=occupato||D.bloccato;
  elencoBarra();vuoto.hidden=!!d;editor.hidden=!d;
  if(!d)vuoto.querySelector('p').textContent=corso?'Crea una presentazione o scegline una dalla tendina.':'Apri uno zaino per costruire una presentazione.';
  for(const [k,v]of Object.entries(bottoni))v.disabled=disabled||(!d&&!['nuova'].includes(k))||(!corso&&k==='nuova');
  bottoni.annulla.disabled=disabled||!D.annullabile;bottoni.ripeti.disabled=disabled||!D.ripetibile;
  bottoni.salva.disabled=disabled||!d;bottoni.nuova.disabled=disabled||!corso;
  const messaggio=listaErrore||D.errore;stato.textContent=messaggio?'Non salvato: '+messaggio:D.salvando?'Salvataggio…':D.sporco?'Modifiche da salvare':d?'Salvato':'PRESENTA';stato.dataset.errore=String(!!messaggio);
  for(const e of campi.querySelectorAll('input,textarea,select,button'))e.disabled=disabled||!d;const eliminaSlide=campi.querySelector('[aria-label="Elimina slide"]');if(eliminaSlide)eliminaSlide.disabled=disabled||!d||M.posizioni(d).length===1;
  scaletta.replaceChildren();if(d)for(const pos of M.posizioni(d)){
   const n=(pos.h+1)+(pos.v?'.'+pos.v:'')+' · '+(pos.slide.title||'Senza titolo'),button=b(n,null,()=>scegliSlide(pos.slide.id));
   button.dataset.slideId=pos.slide.id;button.dataset.verticale=String(pos.v>0);button.setAttribute('aria-pressed',String(pos.slide.id===p.slide.id));button.disabled=disabled;scaletta.append(button);
  }
  ricorda();sidebar();anteprima();disegnaGobbo();
 }
 function scegliSlide(id){selezioneGiro++;slideId=id;campiSlide();disegna();vaiAnteprima();}
 function nuovoBlocco(tipo){
  const block=tipo==='math'?{type:'math',slot:'formula',latex:'',display:true}:tipo==='list'?{type:'list',slot:'body',items:[]}:{type:tipo,slot:tipo==='title'?'title':'body',markdown:''};
  op({tipo:'inserisciBlocco',block},{struttura:true});campi.querySelector('.presenta-blocco-editor:last-of-type textarea')?.focus();
 }
 function cambiaBlocco(id,patch){const s=posizione().slide,b=s.blocks.find(b=>b.id===id);op({tipo:'blocco',blockId:id,block:{...b,...patch}});}
 function campiSlide(){
  const aperti=[...campi.querySelectorAll('.presenta-blocco-editor:has(details[open])')].map(e=>e.dataset.blockId);
  campi.replaceChildren();const p=posizione();if(!p)return;slideId=p.slide.id;const s=p.slide;
  campi.append(campo('Titolo della slide',s.title,t=>op({tipo:'titoloSlide',title:t}),{maxLength:140}));
  const row=E('div',null,'tbar presenta-bar');
  row.append(b('Nuova slide','plus',()=>aggiungi('aggiungiSlide','destra')),b('Nuovo approfondimento','arrow-down',()=>aggiungi('aggiungiSlide','sotto')),
   b('Duplica slide','copy',()=>aggiungi('duplicaSlide',p.v?'sotto':'destra')),b('Stato successivo animato','layers',()=>aggiungi('statoSuccessivo',p.v?'sotto':'destra')),
   b('Sposta prima','chevron-left',()=>sposta(-1)),b('Sposta dopo','chevron-right',()=>sposta(1)),b('Elimina slide','trash-2',()=>{if(confirm('Eliminare questa slide? Puoi ripristinarla con Annulla.'))op({tipo:'eliminaSlide'},{struttura:true});}));
  row.querySelector('[aria-label="Elimina slide"]').disabled=M.posizioni(D.documento).length===1;campi.append(row);
  campi.append(campo('Disposizione',s.layout,v=>op({tipo:'slide',layout:v}),{opzioni:[['title-text','Titolo e testo'],['text-image','Testo e immagine'],['image-caption','Immagine e didascalia'],['two-columns','Due colonne'],['formula-text','Formula e testo'],['media','Media']]}));
  for(const block of s.blocks){if(block.type==='title')continue;bloccoCampi(block);}
  const add=E('div',null,'tbar presenta-bar');add.append(b('Aggiungi testo','type',()=>nuovoBlocco('text')),b('Aggiungi elenco','list',()=>nuovoBlocco('list')),b('Aggiungi formula',null,()=>nuovoBlocco('math')),
   b('Inserisci dallo zaino','image',scegliMateriale));campi.append(add);
  const help=E('p','Puoi anche trascinare qui parole chiave, immagini, ritagli, audio e video dello stesso zaino.','presenta-aiuto');campi.append(help);
  const note=campo('Appunti del presentatore · privati',s.notes.markdown,v=>op({tipo:'slide',notes:{markdown:v}}),{tipo:'textarea',maxLength:100000});note.querySelector('textarea').dataset.presentaNote='1';campi.append(note);for(const id of aperti){const el=campi.querySelector('[data-block-id="'+CSS.escape(id)+'"] details');if(el)el.open=true;}
 }
 function bloccoCampi(block){
  const box=E('section',null,'presenta-blocco-editor');box.dataset.blockId=block.id;
  const patch=v=>cambiaBlocco(block.id,v),s=posizione().slide;
  if(['text','title'].includes(block.type))box.append(campo('Testo · Markdown e formule',block.markdown,v=>patch({markdown:v}),{tipo:'textarea',maxLength:100000}));
  else if(block.type==='math')box.append(campo('Formula · LaTeX',block.latex,v=>patch({latex:v}),{tipo:'textarea',maxLength:20000}));
  else if(block.type==='list')box.append(campo('Elenco · una voce per riga',block.items.map(i=>i.markdown).join('\n'),v=>{
   const corrente=posizione().slide.blocks.find(b=>b.id===block.id);patch({items:v.split('\n').map((markdown,i)=>({id:corrente.items[i]?.id||crypto.randomUUID(),markdown}))});
  },{tipo:'textarea',maxLength:100000}));
  else{
   box.append(E('p',({image:'Immagine',audio:'Audio',video:'Video'})[block.type],'presenta-aiuto'));
   if(block.type==='image')box.append(campo('Descrizione dell’immagine',block.alt,v=>patch({alt:v}),{maxLength:2000}));
   box.append(campo('Didascalia',block.caption,v=>patch({caption:v}),{maxLength:10000}));
  }
  const bar=E('div',null,'tbar presenta-bar');bar.append(b('Sposta blocco sopra','chevron-up',()=>muoviBlocco(block.id,-1)),b('Sposta blocco sotto','chevron-down',()=>muoviBlocco(block.id,1)),b('Elimina blocco','trash-2',()=>op({tipo:'eliminaBlocco',blockId:block.id},{struttura:true})));box.append(bar);
  const details=E('details'),summary=E('summary','Aspetto e animazioni'),props=E('div',null,'presenta-proprieta');details.append(summary,props);
  const stile=(k,v)=>{const corrente=posizione().slide.blocks.find(b=>b.id===block.id);patch({style:{...corrente.style,[k]:v}});};
  props.append(campo('Dimensione testo',block.style?.fontSize||32,v=>stile('fontSize',Number(v)),{tipo:'number',min:12,max:160}),campo('Allineamento',block.style?.align||'left',v=>stile('align',v),{opzioni:[['left','Sinistra'],['center','Centro'],['right','Destra']]}),campo('Colonne occupate',block.style?.span||12,v=>stile('span',Number(v)),{tipo:'number',min:1,max:12}));
  const actions=E('div');for(const a of s.animations.filter(a=>a.targetId===block.id)){
   const row=E('div',null,'presenta-azione'),aggiorna=patch=>{const animations=posizione().slide.animations.map(x=>x.targetId===a.targetId&&x.step===a.step?{...x,...patch}:x);op({tipo:'animazioni',animations},{struttura:true});};
   row.append(campo('Passaggio',a.step,v=>aggiorna({step:Number(v)}),{tipo:'number',min:1,max:1000}),campo('Effetto',a.effect,v=>aggiorna({effect:v}),{opzioni:Object.entries(M.EFFETTI)}),b('Rimuovi effetto','x',()=>op({tipo:'animazioni',animations:posizione().slide.animations.filter(x=>!(x.targetId===a.targetId&&x.step===a.step))},{struttura:true})));actions.append(row);
  }actions.append(b('Aggiungi passaggio','plus',()=>{const animations=posizione().slide.animations;op({tipo:'animazioni',animations:[...animations,{targetId:block.id,step:Math.max(0,...animations.map(a=>a.step))+1,effect:'fade-in'}]},{struttura:true});}));details.append(actions);box.append(details);campi.append(box);
 }
 function muoviBlocco(id,delta){const s=posizione().slide,index=s.blocks.findIndex(b=>b.id===id)+delta;if(index<0||index>=s.blocks.length)return;op({tipo:'spostaBlocco',blockId:id,index},{struttura:true});}
 function aggiungi(tipo,direzione){const prima=new Set(M.posizioni(D.documento).map(p=>p.slide.id));op({tipo,direzione},{struttura:true,seleziona:d=>M.posizioni(d).find(p=>!prima.has(p.slide.id)).slide.id});}
 function sposta(delta){const p=posizione();if(p.v===0){if(p.h+delta<0||p.h+delta>=D.documento.stacks.length)return;op({tipo:'spostaArgomento',delta},{struttura:true});}
  else{const index=p.v+delta;if(index<1||index>=p.stack.slides.length)return;op({tipo:'spostaSlide',stackId:p.stack.id,index},{struttura:true});}}
 async function ricaricaLista(){const z=corso,n=++giro;if(!z)return;const r=await call({azione:'elenco'},z);if(n!==giro||z!==corso)return;elenco=r.elenco;disegna();}
 async function carica(d){selezioneGiro++;D.apri(d);slideId=d.stacks[0].slides[0].id;firma='';quadro=null;campiSlide();disegna();}
 async function apri(id){if(occupato)return;const z=corso;occupato=true;disegna();try{await D.flush();if(z!==corso)return;const r=await call({azione:'apri',id},z);if(z!==corso)return;
  await carica(r.documento);const b=r.bozza;if(b&&b.baseRevision===r.documento.revision&&JSON.stringify(b.documento)!==JSON.stringify(r.documento)&&confirm('È disponibile una bozza non salvata di questa presentazione. Recuperarla?')){D.recupera(b.documento);campiSlide();disegna();}
  await ricaricaLista();
 }finally{occupato=false;disegna();}}
 async function nuova(){if(occupato)return;const title=await window.askText('Titolo della presentazione','Nuova presentazione');if(title===null)return;if(!title.trim())throw Error('Scrivi un titolo.');const z=corso;occupato=true;disegna();try{await D.flush();if(z!==corso)return;const r=await call({azione:'crea',title:title.trim()},z);if(z!==corso)return;await carica(r.documento);await ricaricaLista();}finally{occupato=false;disegna();}}
 async function pronta(){const z=corso,id=D.documento?.id;if(!id)throw Error('Crea o apri una presentazione.');await D.flush();if(z!==corso||id!==D.documento?.id)throw Error('La presentazione è cambiata durante il salvataggio. Ripeti il comando.');return {d:D.documento,z};}
 async function rinomina(){const t=await askText('Titolo della presentazione',D.documento.title);if(t!==null){modifica({tipo:'titolo',title:t.trim()});await D.flush();await ricaricaLista();}}
 async function chiudi(){selezioneGiro++;await D.flush();await call({azione:'lascia'});D.svuota();slideId='';previewGiro++;firma='';quadro=null;frame.contentWindow.postMessage({presenta:canale,tipo:'quadro',documento:{html:'',settings:{width:1280,height:720,theme:'zaino-light',navigationMode:'default'}}},'*');campiSlide();disegna();}
 async function elimina(){if(!confirm('Spostare questa presentazione e i suoi media nel Cestino di sistema?'))return;const {d,z}=await pronta();await call({azione:'lascia'},z);await call({azione:'elimina',id:d.id},z);if(z!==corso)return;D.svuota();await ricaricaLista();}
 async function importa(trasporto){
  if(typeof trasporto==='string')trasporto=JSON.parse(trasporto);
  if(!D.documento)throw Error('Crea o apri prima una presentazione.');const z=corso,id=D.documento.id,sid=posizione().slide.id,n=selezioneGiro;
  await D.flush();const r=await call({azione:'materiale',id,trasporto,baseRevision:D.documento.revision},z);
  if(z!==corso||id!==D.documento?.id||sid!==posizione()?.slide.id||n!==selezioneGiro)throw Error('La slide è cambiata durante il caricamento. Ripeti l’inserimento.');
  op({tipo:'inserisciBlocco',block:r.block,...(r.asset?{asset:r.asset,assetId:r.assetId}:{})},{struttura:true});
 }
 async function scegliMateriale(){
  const voci=[];for(const e of (window.vault.evidenze.leggi(corso)?.evidenze||[]).filter(e=>window.kwEParolaChiave(e)))voci.push({label:'Parola · '+(e.exact||e.id).slice(0,80),t:LimModello.trasporto('keyword',e.id,corso)});
  for(const e of window.vault.album.elenco(corso)?.voci||[])voci.push({label:'Immagine · '+(e.didascalia||e.titolo||e.title||e.id),t:LimModello.trasporto('album',e.id,corso)});
  const media=await window.vault.media.elenco(corso);for(const e of Array.isArray(media)?media:media?.elenco||[])voci.push({label:(e.tipo==='audio'?'Audio':'Video')+' · '+(e.nome||e.name||e.file),t:{version:1,tipo:e.tipo,file:e.file||e.nome||e.name,corso}});
  if(!voci.length){window.toast?.('Non ci sono ancora parole chiave o media in questo zaino.',false);return;}
  const scelta=await new Promise(resolve=>{
   const dialog=E('dialog',null,'lim-menu presenta-materiali'),bar=E('div',null,'tbar'),title=E('strong','Inserisci dallo zaino');let scelta=null;
   bar.append(title,E('span',null,'tbspazio'),b('Chiudi inserimento','x',()=>dialog.close()));dialog.append(bar);
   for(const [i,v]of voci.entries()){const button=E('button',v.label,'lim-menu-voce');button.type='button';button.onclick=()=>{scelta=i;dialog.close();};dialog.append(button);}
   dialog.addEventListener('close',()=>{dialog.remove();resolve(scelta);},{once:true});document.body.append(dialog);dialog.showModal();
  });if(scelta!==null)await importa(voci[scelta].t);
 }
 async function presenta(){const {d,z}=await pronta();if(regia?.stato.presentationId===d.id&&regia.stato.documentRevision===d.revision){await sessione('mostra');return;}const r=await call({azione:'presenta',id:d.id,baseRevision:d.revision},z);regia=r.regia;disegnaGobbo();}
 async function sessione(comando,extra={}){if(!regia)throw Error('Avvia prima una presentazione.');const r=await call({azione:'sessione',sessionId:regia.stato.sessionId,comando,...extra});regia=r.regia;disegnaGobbo();}
 function disegnaGobbo(){
  if(!gobbo)return;window.bancoAggiornaDocumenti?.();const r=regia;gobboCorpo.replaceChildren();
  for(const e of gobboBar.querySelectorAll('button,select'))e.disabled=!r;
  if(!r){$('gobboTempo').textContent='00:00';gobboStato.textContent='Le note restano private.';gobboCorpo.append(E('h2','GOBBO','gobbo-titolo'),E('p','Avvia la presentazione da PRESENTA. Qui compariranno le note della slide proiettata e i comandi del relatore.','presenta-aiuto'));return;}
  const s=r.stato;gobboStato.textContent='Slide '+(s.h+1)+(s.v?'.'+s.v:'')+' · '+(s.fragmentIndex<0?'Inizio slide':'Passaggio '+(s.fragmentIndex+1))+' · Revisione '+s.documentRevision;
  const seconds=Math.floor(s.timer.elapsedMs/1000);$('gobboTempo').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
  gobboCorpo.append(E('h2',r.title||'Senza titolo','gobbo-titolo'),E('p',r.notes.markdown||'Nessun appunto per questa slide.','gobbo-note'),E('p','Prossimo avanzamento: '+(r.prossimo==='passaggio'?'passaggio animato.':'slide.'),'presenta-aiuto'));
  const sel=$('gobboSchermi'),sig=JSON.stringify(r.schermi);if(sel.dataset.firma!==sig){sel.replaceChildren(...r.schermi.map(d=>new Option(d.nome,String(d.id))));sel.dataset.firma=sig;}sel.value=String(r.schermo);
 }
 function sidebar(){
  const old=$('zs-presenta');old?.remove();const nav=$('zainoNav');if(!nav||nav.hidden||nav.dataset.zaino!==corso||!elenco.length)return;
  const section=E('section',null,'zs-raccolta');section.id='zs-presenta';const head=E('div',null,'zs-tit'),title=E('span','PRESENTA'),ul=E('ul');head.append(title);section.append(head,ul);
  for(const d of elenco){const li=E('li',null,'zs-item'),button=E('button',d.title);button.type='button';button.title=d.title;if(D.documento?.id===d.id)button.classList.add('attivo');button.onclick=()=>azione(async()=>{bancoMostra('presenta');await apri(d.id);});li.append(button);ul.append(li);}nav.append(section);
 }
 async function contesto(){
  const z=window.zainoAttivo?.()||'';if(z===corso)return;
  if(D.sporco||D.salvando)throw Error('Salva la presentazione prima di cambiare zaino.');
  if(corso)await call({azione:'lascia'});corso=z;giro++;selezioneGiro++;previewGiro++;clearTimeout(previewTimer);D.svuota();elenco=[];slideId='';regia=null;listaErrore='';firma='';quadro=null;campiSlide();disegna();
  if(!z)return;await ricaricaLista();let m;try{m=JSON.parse(localStorage.getItem(memoria())||'null');}catch(_){}
  if(m&&elenco.some(d=>d.id===m.id)){await apri(m.id);if(M.posizioni(D.documento).some(p=>p.slide.id===m.slideId))scegliSlide(m.slideId);}
 }
 function molla(){if(D.sporco||D.salvando){window.toast?.('La presentazione contiene modifiche da salvare.',false);return false;}D.svuota();slideId='';regia=null;return true;}
 function monta(){
  host=$('presentaPane');gobbo=$('gobboPane');if(!host||!gobbo)return;
  bar=E('div',null,'tbar presenta-bar');const sel=E('select');sel.id='presentaDocumenti';sel.setAttribute('aria-label','Apri presentazione');sel.onchange=()=>azione(()=>sel.value?apri(sel.value):chiudi());bar.append(sel);
  bar.append(b('Nuova presentazione','plus',nuova,'nuova'),b('Rinomina presentazione','pencil',rinomina,'rinomina'),b('Salva presentazione','save',()=>D.flush(),'salva'),E('span',null,'tbsep'),
   b('Annulla nella presentazione','undo-2',()=>{D.annulla();campiSlide();disegna();},'annulla'),b('Ripeti nella presentazione','redo-2',()=>{D.ripeti();campiSlide();disegna();},'ripeti'),E('span',null,'tbsep'),
   b('Presenta a schermo intero','play',presenta,'presenta'),b('Apri GOBBO',null,()=>bancoMostra('gobbo'),'gobbo'),
   b('Esporta presentazione HTML','file-down',async()=>{const {d,z}=await pronta();const r=await call({azione:'esporta',id:d.id,baseRevision:d.revision},z);if(!r.annullato)toast('Presentazione esportata in '+r.cartella,true);},'esporta'),
   b('Elimina presentazione','trash-2',elimina,'elimina'),b('Chiudi presentazione','x',chiudi,'chiudi'));
  stato=E('div',null,'presenta-stato');stato.setAttribute('role','status');corpo=E('div',null,'presenta-corpo');vuoto=E('div',null,'presenta-vuoto');vuoto.append(E('h2','Costruisci la tua presentazione'),E('p'),b('Crea presentazione',null,nuova));
  editor=E('div',null,'presenta-editor');scaletta=E('nav',null,'presenta-scaletta');scaletta.setAttribute('aria-label','Slide della presentazione');
  const lavoro=E('div',null,'presenta-lavoro');frame=E('iframe',null,'presenta-anteprima');frame.title='Anteprima della slide';frame.setAttribute('sandbox','allow-scripts');call({azione:'frame'}).then(r=>{frame.src=r.url;}).catch(e=>window.toast?.(e.message,false));
  campi=E('div',null,'presenta-campi');avviso=E('p',null,'presenta-aiuto');avviso.setAttribute('role','status');avviso.hidden=true;lavoro.append(frame,avviso,campi);editor.append(scaletta,lavoro);corpo.append(vuoto,editor);host.append(bar,stato,corpo);
  window.tendinaViva?.(sel,{piccola:true,icona:'layers',fissa:'Presentazioni'});
  gobboBar=E('div',null,'tbar presenta-bar');for(const [nome,icona,cmd]of [['Indietro','chevron-left','indietro'],['Avanti','chevron-right','avanti'],['Argomento precedente','chevrons-left','argomentoPrecedente'],['Argomento successivo','chevrons-right','argomentoSuccessivo'],['Approfondisci','chevron-down','approfondisci'],['Risali','chevron-up','risali']])gobboBar.append(b(nome,icona,()=>sessione(cmd)));
  const tempo=E('output','00:00','gobbo-tempo');tempo.id='gobboTempo';tempo.setAttribute('aria-label','Tempo della presentazione');
  const schermi=E('select');schermi.id='gobboSchermi';schermi.setAttribute('aria-label','Schermo della presentazione');schermi.onchange=()=>azione(()=>sessione('schermo',{schermo:Number(schermi.value)}));
  gobboBar.append(tempo,b('Avvia timer','play',()=>sessione('timer',{timer:'avvia'})),b('Pausa timer','pause',()=>sessione('timer',{timer:'pausa'})),b('Azzera timer',null,()=>sessione('timer',{timer:'azzera'})),schermi,b('Schermo intero','maximize',()=>sessione('intero')),b('Termina presentazione','x',()=>sessione('chiudi')));
  gobboStato=E('div',null,'presenta-stato');gobboStato.setAttribute('role','status');gobboCorpo=E('div',null,'gobbo-corpo');gobbo.append(gobboBar,gobboStato,gobboCorpo);window.tendinaViva?.(schermi,{piccola:true,fissa:'Schermo'});
  host.addEventListener('keydown',e=>{if(!(e.metaKey||e.ctrlKey)||!['s','z','y'].includes(e.key.toLowerCase()))return;e.preventDefault();e.stopPropagation();azione(()=>{if(e.key.toLowerCase()==='s')return D.flush();if(e.key.toLowerCase()==='y'||e.shiftKey)D.ripeti();else D.annulla();campiSlide();disegna();});});
  host.addEventListener('dragover',e=>{if(![...e.dataTransfer.types].some(t=>['application/x-studia-lim','application/x-studia-presenta-media'].includes(t)))return;e.preventDefault();e.dataTransfer.dropEffect='copy';host.classList.add('presenta-drop');});
  host.addEventListener('dragleave',e=>{if(!host.contains(e.relatedTarget))host.classList.remove('presenta-drop');});
  host.addEventListener('drop',e=>{host.classList.remove('presenta-drop');const raw=e.dataTransfer.getData('application/x-studia-lim')||e.dataTransfer.getData('application/x-studia-presenta-media');if(!raw)return;e.preventDefault();e.stopPropagation();azione(()=>importa(JSON.parse(raw)));});
  window.addEventListener('message',e=>{if(e.source!==frame.contentWindow)return;if(e.data?.tipo==='presenta-caricato'){framePronto=true;if(quadro)frame.contentWindow.postMessage(quadro,'*');}
   else if(e.data?.presenta===canale){if(e.data.tipo==='seleziona'){const b=posizione()?.slide.blocks.find(b=>b.id===e.data.blockId);if(b){const el=b.type==='title'?campi.querySelector('[aria-label="Titolo della slide"]'):campi.querySelector('[data-block-id="'+CSS.escape(b.id)+'"] textarea,[data-block-id="'+CSS.escape(b.id)+'"] input');el?.focus();}}if(e.data.tipo==='pronto'){avviso.hidden=!e.data.overflow;avviso.textContent='Il contenuto supera l’altezza della slide: riduci il testo, la dimensione o dividi la slide.';}if(e.data.tipo==='errore')window.toast?.('Anteprima: '+e.data.error,false);if(e.data.tipo==='pronto'&&e.data.errors?.length)window.toast?.('Ci sono formule da correggere nella slide.',false);}});
  window.ZainoPresenta={nuova,apri,flush:()=>D.flush(),molla,importa,modifica,chiudi,presenta,get documento(){return D.documento;},get daSalvare(){return D.sporco||D.salvando;},get regia(){return regia;}};
  api.onCambiata(o=>{if(o.corso===corso)azione(ricaricaLista);});api.onSessione(o=>{regia=o.regia;if(regia?.corso!==corso)regia=null;disegnaGobbo();});
  api.onChiudi(o=>azione(async()=>{try{await D.transizione(()=>{});await api.comando({azione:'chiusuraPronta',id:o.id});}catch(e){await api.comando({azione:'chiusuraPronta',id:o.id,errore:true});throw e;}}));
  window.addEventListener('studia:zaino-changed',()=>azione(contesto));window.addEventListener('studia:sidebar-updated',sidebar);
  window.addEventListener('banco-layout',()=>{if(window.bancoVisibile?.('presenta'))azione(async()=>{await contesto();anteprima();});});
  window.addEventListener('beforeunload',e=>{if(D.sporco||D.salvando){e.preventDefault();e.returnValue=false;azione(()=>D.flush());}});
  window.addEventListener('blur',()=>{if(D.sporco)azione(()=>D.flush());});
  setInterval(()=>{if(regia&&window.bancoVisibile?.('gobbo'))azione(async()=>{const r=await call({azione:'regia'});regia=r.regia;disegnaGobbo();});},1000);
  api.comando({azione:'editorPronto'});azione(contesto);disegna();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',monta);else monta();
})();
