/* Un'istanza Reveal per superficie. Anteprima passiva, player pubblico autorevole. */
(function(){
 'use strict';
 const pubblico=window.top===window&&!!window.presentaPubblico,root=document.querySelector('.reveal');
 let deck=null,canale='',contesto=null,pronto=false,inComando=false,coda=Promise.resolve();
 function stato(){return PresentaNavigazione.stato(deck);}
 function silenzia(){const current=deck?.getCurrentSlide();for(const m of root.querySelectorAll('audio,video')){if(!pubblico||!current?.contains(m))m.pause();m.muted=!pubblico;}}
 function invia(tipo,d={}){if(!pubblico)parent.postMessage({presenta:canale,tipo,...d},'*');}
 function conferma(){silenzia();if(pubblico&&contesto&&!inComando)window.presentaPubblico.conferma({...contesto,...stato()}).then(r=>{if(!r.ok)console.warn(r.error);});}
 async function aggiorna(o){
  termina(true);inAttesa=false;modificaFoglio=o.editor||null;pronto=false;root.dataset.pronto='false';canale=o.canale||canale;const r=o.documento,s=r.settings;
  document.documentElement.dataset.tema=s.theme;document.documentElement.dataset.movimentoRidotto=String(s.reducedMotion);
  for(const m of root.querySelectorAll('audio,video'))m.pause();
  root.querySelector('.slides').innerHTML=r.html;silenzia();
  const ridotto=s.reducedMotion||matchMedia('(prefers-reduced-motion: reduce)').matches;
  const config={width:s.width,height:s.height,navigationMode:s.navigationMode,embedded:!pubblico,hash:false,history:false,center:true,...(!pubblico?{margin:0,minScale:.01,maxScale:100}:{}),view:'slide',scrollActivationWidth:null,
   keyboard:pubblico?{83:null,70:null,27:null}:false,controls:pubblico,progress:pubblico,overview:false,help:false,showNotes:false,autoPlayMedia:pubblico?null:false,
   transition:ridotto?'none':'slide',autoAnimate:!ridotto};
  if(!deck){deck=new Reveal(root,config);await deck.initialize();for(const n of ['slidechanged','fragmentshown','fragmenthidden'])deck.on(n,conferma);}
  else{deck.configure(config);deck.sync();}
  await document.fonts.ready;pronto=true;root.dataset.pronto='true';deck.slide(o.posizione?.h||0,o.posizione?.v||0,o.posizione?.fragmentIndex??-1);deck.layout();silenzia();if(modificaFoglio&&!pubblico){selezione(modificaFoglio);root.dataset.modificaPronta='true';}const slide=deck.getCurrentSlide()?.querySelector('.presenta-slide');invia('pronto',{errors:r.errors||[],overflow:!!slide&&(slide.scrollHeight>s.height||[...slide.querySelectorAll('.presenta-blocco,.presenta-contenuto')].some(b=>b.scrollHeight>b.clientHeight+1||b.scrollWidth>b.clientWidth+1))});
 }
 function comando(o){if(gesto&&(o.h!==stato().h||o.v!==stato().v))termina(true);if(!pronto)throw Error('Il player non è ancora pronto.');PresentaNavigazione.comando(deck,o);silenzia();}
 function esegui(fn){coda=coda.then(fn).catch(e=>{inComando=false;document.body.dataset.errore=e.message;if(pubblico)console.error(e.message);else invia('errore',{error:e.message});});return coda;}
 // La superficie isolata invia soltanto misure; il documento e la cronologia restano nel padre.
 let modificaFoglio=null,gesto=null,inAttesa=false;
 function corrente(){return deck?.getCurrentSlide()?.querySelector('.presenta-slide');}
 function elementi(){return [...(corrente()?.querySelectorAll('.presenta-blocco[data-block-id]')||[])];}
 function selezione(o){
  if(gesto&&o.slideId!==modificaFoglio?.slideId)termina(true);root.dataset.bloccato=String(!!o.bloccato);
  modificaFoglio={...modificaFoglio,...o};root.dataset.editor='true';root.style.setProperty('--selezione',o.colore||'#0f766e');
  for(const b of elementi()){
   b.tabIndex=o.bloccato?-1:0;b.setAttribute('role','button');b.setAttribute('aria-label','Seleziona oggetto');b.setAttribute('aria-pressed',String(b.dataset.blockId===o.selezionato));b.dataset.selezionato=String(b.dataset.blockId===o.selezionato);
   b.querySelector('.presenta-maniglia')?.remove();if(b.dataset.selezionato==='true'){const h=document.createElement('span');h.className='presenta-maniglia';h.setAttribute('aria-hidden','true');b.append(h);}
  }
 }
 function misure(){
  const area=corrente(),a=root.querySelector('.slides').getBoundingClientRect(),lim=n=>Math.max(0,Math.min(98,n));
  return elementi().map(b=>{const r=b.getBoundingClientRect(),x=lim((r.left-a.left)/a.width*100),y=lim((r.top-a.top)/a.height*100);return {id:b.dataset.blockId,box:{x,y,width:Math.max(2,Math.min(100-x,r.width/a.width*100)),height:Math.max(2,Math.min(100-y,r.height/a.height*100))},fontSize:Math.max(12,Math.min(160,parseFloat(getComputedStyle(b.querySelector('h2')||b).fontSize)))};});
 }
 function mostraBubble(b){if(pubblico||!b||modificaFoglio?.bloccato||inAttesa)return;const r=b.getBoundingClientRect();invia('menuOggetto',{blockId:b.dataset.blockId,rect:{x:r.x,y:r.y,width:r.width,height:r.height}});}
 function adatta(id){
  const b=elementi().find(b=>b.dataset.blockId===id);if(!b||!avvia(b))return;const v=gesto.boxes.find(x=>x.id===id),img=b.querySelector('img'),contenuto=b.querySelector('.presenta-contenuto');let altezza;
  if(img?.naturalWidth)altezza=(v.box.width/100*deck.getConfig().width-16)*img.naturalHeight/img.naturalWidth+(b.querySelector('figcaption')?.offsetHeight||0)+24;
  else{const clone=contenuto.cloneNode(true);Object.assign(clone.style,{position:'absolute',width:Math.max(1,b.clientWidth-16)+'px',height:'auto',maxHeight:'none'});b.append(clone);altezza=clone.scrollHeight+16;clone.remove();}
  v.box=PresentaModello.muovi(v.box,0,altezza/deck.getConfig().height*100-v.box.height,true);gesto.mosso=true;mostraMisure();termina();
 }
 root.addEventListener('contextmenu',e=>{if(pubblico)return;const b=e.target.closest('.presenta-blocco');if(!b)return;e.preventDefault();invia('seleziona',{blockId:b.dataset.blockId});mostraBubble(b);});
 function avvia(b){
  if(!modificaFoglio||modificaFoglio.bloccato||inAttesa||!pronto)return false;
  const area=corrente();gesto={id:b.dataset.blockId,boxes:misure(),prima:elementi().map(e=>[e,e.getAttribute('style')]),layout:area.dataset.layout};
  area.dataset.layout='free';for(const v of gesto.boxes){const e=elementi().find(b=>b.dataset.blockId===v.id);Object.assign(e.style,{left:v.box.x+'%',top:v.box.y+'%',width:v.box.width+'%',height:v.box.height+'%',fontSize:v.fontSize+'px'});}
  selezione({...modificaFoglio,selezionato:b.dataset.blockId});invia('seleziona',{blockId:b.dataset.blockId});return true;
 }
 function mostraMisure(){for(const v of gesto.boxes){const b=elementi().find(e=>e.dataset.blockId===v.id);Object.assign(b.style,{left:v.box.x+'%',top:v.box.y+'%',width:v.box.width+'%',height:v.box.height+'%'});}}
 function termina(annulla=false){
  if(!gesto)return;const g=gesto;gesto=null;
  if(annulla||!g.mosso){corrente().dataset.layout=g.layout;for(const [e,style]of g.prima)e.setAttribute('style',style||'');return;}
  inAttesa=true;root.dataset.modificaPronta='false';invia('geometria',{blockId:g.id,slideId:modificaFoglio.slideId,firma:modificaFoglio.firma,boxes:g.boxes});
 }
 root.addEventListener('pointerdown',e=>{
  if(pubblico||e.button!==0)return;invia('nascondiBubble');const b=e.target.closest('.presenta-blocco');if(!b){invia('seleziona',{blockId:null});return;}
  const ridimensiona=!!e.target.closest('.presenta-maniglia');if(!avvia(b))return;e.preventDefault();b.focus({preventScroll:true});b.setPointerCapture(e.pointerId);gesto.x=e.clientX;gesto.y=e.clientY;gesto.ridimensiona=ridimensiona;gesto.box={...gesto.boxes.find(x=>x.id===gesto.id).box};gesto.area=corrente().getBoundingClientRect();
 });
 root.addEventListener('pointermove',e=>{if(!gesto||gesto.tastiera)return;const dx=(e.clientX-gesto.x)/gesto.area.width*100,dy=(e.clientY-gesto.y)/gesto.area.height*100;if(!gesto.mosso&&Math.abs(dx)+Math.abs(dy)<.35)return;gesto.mosso=true;gesto.boxes.find(x=>x.id===gesto.id).box=PresentaModello.muovi(gesto.box,dx,dy,gesto.ridimensiona);mostraMisure();});
 root.addEventListener('pointerup',()=>termina());root.addEventListener('pointercancel',()=>termina(true));
 root.addEventListener('keydown',e=>{
  if(pubblico)return;if((e.metaKey||e.ctrlKey)&&['s','z','y'].includes(e.key.toLowerCase())){e.preventDefault();termina(true);invia('cronologia',{comando:e.key.toLowerCase()==='s'?'salva':e.key.toLowerCase()==='y'||e.shiftKey?'ripeti':'annulla'});return;}if(e.key==='Escape'){termina(true);invia('seleziona',{blockId:null});return;}
  const b=e.target.closest('.presenta-blocco');if(!b)return;
  if(['Enter',' '].includes(e.key)){e.preventDefault();selezione({...modificaFoglio,selezionato:b.dataset.blockId});invia('seleziona',{blockId:b.dataset.blockId});return;}
  if(!e.key.startsWith('Arrow'))return;e.preventDefault();if(!gesto&&!avvia(b))return;gesto.tastiera=true;gesto.mosso=true;const v=gesto.boxes.find(x=>x.id===gesto.id),d=e.shiftKey?3:1;v.box=PresentaModello.muovi(v.box,({ArrowLeft:-d,ArrowRight:d})[e.key]||0,({ArrowUp:-d,ArrowDown:d})[e.key]||0,e.altKey);mostraMisure();
 });
 root.addEventListener('keyup',e=>{if(gesto?.tastiera&&e.key.startsWith('Arrow'))termina();});
 window.addEventListener('blur',()=>termina(true));

 if(pubblico){
  window.presentaPubblico.onComando(o=>esegui(async()=>{inComando=true;contesto=o;comando({...o,...o.destinazione});inComando=false;conferma();}));
  esegui(async()=>{const r=await window.presentaPubblico.pronto();if(!r.ok)throw Error(r.error);inComando=true;contesto={...r.stato,token:r.token};await aggiorna({documento:r.documento,posizione:r.stato});inComando=false;conferma();});
 }else{
  window.addEventListener('message',e=>{if(e.source!==parent||!['null','file://'].includes(e.origin)||!e.data?.presenta)return;
   const o=e.data;if(canale&&o.presenta!==canale)return;
   if(o.tipo==='quadro')esegui(()=>aggiorna({...o,canale:o.presenta}));
   else if(o.tipo==='selezione'){if(!pubblico)selezione({...modificaFoglio,...o.editor});}
   else if(o.tipo==='adatta')esegui(()=>adatta(o.blockId));
   else if(o.tipo==='misure'){if(!pubblico&&pronto&&!gesto)invia('misure',{boxes:misure(),firma:modificaFoglio?.firma,slideId:modificaFoglio?.slideId,richiesta:o.richiesta});}
   else if(o.tipo==='vai')esegui(()=>{if(pronto){comando({azione:'vai',...o.posizione});if(o.editor)selezione({...modificaFoglio,...o.editor});}});
  });parent.postMessage({tipo:'presenta-caricato'},'*');
 }
 root.addEventListener('click',e=>{const a=e.target.closest('a');if(a)e.preventDefault();if(!pubblico){const b=e.target.closest('[data-block-id]');if(b){invia('seleziona',{blockId:b.dataset.blockId});mostraBubble(b);}}});
 root.addEventListener('play',e=>{if(!pubblico){e.target.pause();e.target.muted=true;}},true);
 new ResizeObserver(()=>{if(pronto)deck.layout();}).observe(root);
 window.addEventListener('pagehide',()=>{pronto=false;for(const m of root.querySelectorAll('audio,video'))m.pause();deck?.destroy();});
})();
