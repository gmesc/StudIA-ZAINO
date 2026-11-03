/* Un'istanza Reveal per superficie. Anteprima passiva, player pubblico autorevole. */
(function(){
 'use strict';
 const pubblico=window.top===window&&!!window.presentaPubblico,root=document.querySelector('.reveal');
 let testi={},clip=null,clipGiro=0,intervalloClip={start:0,end:0};
 const scrittura=PresentaScrittura({invia,metadati:()=>({...modificaFoglio,testi}),pronto:()=>!pubblico&&pronto&&!modificaFoglio?.bloccato,seleziona:b=>{termina(true);selezione({...modificaFoglio,selezionato:b.dataset.blockId});invia('seleziona',{blockId:b.dataset.blockId});},bubble:aggiornaBubble});
 let animazioni=null,navbar=null,sfondo=null;
 let prova=false,deck=null,canale='',contesto=null,pronto=false,inComando=false,coda=Promise.resolve();
 function stato(){return PresentaNavigazione.stato(deck);}
 function silenzia(){PresentaNavigazione.sincronizzaMedia(deck,root,!pubblico&&!prova);}
 function invia(tipo,d={}){if(!pubblico)parent.postMessage({presenta:canale,tipo,...d},'*');}
 function conferma(){silenzia();if(pubblico&&contesto&&!inComando)window.presentaPubblico.conferma({...contesto,...stato()}).then(r=>{if(!r.ok)console.warn(r.error);});}
 async function aggiorna(o){
  animazioni?.destroy();animazioni=null;scrittura.termina(false);testi=o.documento.testi||{};prova=!!o.provaAnimazioni;termina(true);inAttesa=false;modificaFoglio=o.editor||null;pronto=false;root.dataset.pronto='false';canale=o.canale||canale;const r=o.documento,s=r.settings;
  document.documentElement.dataset.tema=s.theme;document.documentElement.dataset.movimentoRidotto=String(s.reducedMotion);
  for(const m of root.querySelectorAll('audio,video'))if(!m.closest('.presenta-sfondo-comune'))m.pause();
  root.querySelector('.slides').innerHTML=r.html;silenzia();
  const ridotto=s.reducedMotion||matchMedia('(prefers-reduced-motion: reduce)').matches;
  const config={width:s.width,height:s.height,navigationMode:s.navigationMode,embedded:!pubblico,hash:false,history:false,center:true,margin:0,minScale:.01,maxScale:100,view:'slide',scrollActivationWidth:null,
   keyboard:pubblico?{83:null,70:null,27:null}:false,controls:pubblico,progress:pubblico,overview:false,help:false,showNotes:false,autoPlayMedia:pubblico||prova?null:false,
   transition:ridotto?'none':'slide',autoAnimate:!ridotto};
  if(!deck){deck=new Reveal(root,config);await deck.initialize();for(const n of ['slidechanged','fragmentshown','fragmenthidden'])deck.on(n,conferma);}
  else{deck.configure(config);deck.sync();}
  // Anche un salvataggio o una ricompilazione dell'editor conserva il playback.
  if(!sfondo||sfondo.firma!==root.querySelector('.presenta-sfondo-template')?.innerHTML){sfondo?.destroy();sfondo=PresentaNavigazione.sfondoComune(deck,root,{passivo:()=>!pubblico&&!prova,errore:error=>invia('errore',{error})});}
  await document.fonts.ready;pronto=true;root.dataset.pronto='true';deck.slide(o.posizione?.h||0,o.posizione?.v||0,o.posizione?.fragmentIndex??-1);deck.layout();silenzia();sfondo?.aggiorna?.();
  if(!navbar)navbar=PresentaNavigazione.navbar(deck,root,{attiva:()=>pubblico||prova||!!modificaFoglio?.pulita});else navbar.aggiorna();
  // Nell’iframe il media può essere pronto dopo il primo tentativo di autoplay di Reveal.
  if(pubblico||prova){const p=deck.getIndices(),video=deck.getSlideBackground(p.h,p.v)?.querySelector('video');video?.play().catch(e=>{if(video.isConnected&&e.name!=='AbortError')invia('errore',{error:'Video di sfondo non riproducibile. Verifica il formato e il codec.'});});}
  if(pubblico||o.provaAnimazioni)animazioni=PresentaAnimazioniDOM.collega(deck,{ridotto});if(modificaFoglio&&!pubblico){selezione(modificaFoglio);root.dataset.modificaPronta='true';}invia('pronto',{firma:modificaFoglio?.firma,errors:r.errors||[]});segnalaIngombro();
 }
 // La navigazione riusa il documento: le misure devono seguire la slide, non solo la compilazione.
 function contenutoTagliato(b){
  if(b.scrollHeight<=b.clientHeight+1&&b.scrollWidth<=b.clientWidth+1)return false;
  const limite=b.getBoundingClientRect(),scala=deck.getScale(),tolleranza=scala;
  const fuori=r=>r.left<limite.left-tolleranza||r.right>limite.right+tolleranza||r.top<limite.top-tolleranza||r.bottom>limite.bottom+tolleranza;
  const c=b.querySelector('.presenta-contenuto');if(!c)return false;
  if([...c.querySelectorAll('img,video,audio,svg,table,.katex')].some(e=>fuori(e.getBoundingClientRect())))return true;
  const nodi=document.createTreeWalker(c,NodeFilter.SHOW_TEXT),misura=document.createElement('canvas').getContext('2d'),range=document.createRange();let n;
  while((n=nodi.nextNode())){
   if(!n.textContent.trim()||n.parentElement.closest('svg,.katex'))continue;
   misura.font=getComputedStyle(n.parentElement).font;const metriche=misura.measureText(n.textContent);
   range.selectNodeContents(n);
   if([...range.getClientRects()].some(r=>fuori(PresentaTesto.limitiInchiostro(r,metriche,scala))))return true;
  }return false;
 }
 function segnalaIngombro(){
  // Il solo scrollHeight può contare spazio vuoto del font anche oltre il riquadro esterno.
  if(pubblico||!pronto)return;const slide=corrente();invia('ingombro',{firma:modificaFoglio?.firma,slideId:modificaFoglio?.slideId,overflow:!!slide&&(slide.scrollHeight>deck.getConfig().height||[...slide.querySelectorAll('.presenta-blocco')].some(contenutoTagliato))});
 }
 function comando(o){if(gesto&&(o.h!==stato().h||o.v!==stato().v))termina(true);if(!pronto)throw Error('Il player non è ancora pronto.');PresentaNavigazione.comando(deck,o);silenzia();}
 function esegui(fn){coda=coda.then(fn).catch(e=>{inComando=false;document.body.dataset.errore=e.message;if(pubblico)console.error(e.message);else invia('errore',{error:e.message});});return coda;}
 // La superficie isolata invia soltanto misure; il documento e la cronologia restano nel padre.
 let modificaFoglio=null,gesto=null,inAttesa=false;
 function corrente(){return deck?.getCurrentSlide()?.querySelector('.presenta-slide');}
 function elementi(){return [...(corrente()?.querySelectorAll('.presenta-blocco[data-block-id]:not(.presenta-comune-sorgente)')||[]),...(navbar?.elementi()||[])];}
 function disegnaGuide(){
  root.querySelectorAll('.presenta-guide-fisse').forEach(e=>e.remove());
  const area=corrente();if(pubblico||!area||!modificaFoglio?.griglia)return;
  const griglia=document.createElement('div');griglia.className='presenta-guide-fisse';griglia.setAttribute('aria-hidden','true');
  for(const asse of ['x','y'])for(const pos of PresentaModello.righelli(modificaFoglio.griglia,modificaFoglio.areaUtile)[asse]){const linea=document.createElement('i');linea.dataset.asse=asse;linea.style[asse==='x'?'left':'top']=pos+'%';griglia.append(linea);}area.append(griglia);
 }
 function selezione(o){
  // Un messaggio già in coda non deve cancellare il gesto appena iniziato nel frame.
  if(PresentaModello.selezioneObsoleta(o,modificaFoglio,gesto))return;
  if(gesto&&(o.slideId!==modificaFoglio?.slideId||o.selezionato!==gesto.id))termina(true);root.dataset.bloccato=String(!!o.bloccato);
  modificaFoglio={...modificaFoglio,...o};disegnaGuide();root.dataset.editor='true';root.dataset.pulita=String(!!o.pulita);root.style.setProperty('--selezione',o.colore||'#0f766e');
  for(const b of elementi()){
   b.tabIndex=o.bloccato||o.pulita?-1:0;b.setAttribute('role','button');b.setAttribute('aria-label','Seleziona oggetto');b.setAttribute('aria-pressed',String((o.selezionati?.length>1?o.selezionati.includes(b.dataset.blockId):b.dataset.blockId===o.selezionato)));b.dataset.selezionato=String((o.selezionati?.length>1?o.selezionati.includes(b.dataset.blockId):b.dataset.blockId===o.selezionato));
   b.querySelector('.presenta-maniglia')?.remove();if(b.dataset.selezionato==='true'&&!(o.selezionati?.length>1)){const h=document.createElement('span');h.className='presenta-maniglia';h.setAttribute('aria-hidden','true');b.append(h);}
   for(const bt of b.querySelectorAll('[data-nav-h]'))bt.tabIndex=o.pulita?0:-1;
  }
  const scelto=elementi().find(b=>(o.selezionati?.length>1?o.selezionati.includes(b.dataset.blockId):b.dataset.blockId===o.selezionato));if(scelto)aggiornaBubble(scelto);
 }
 function misure(){
  const area=corrente(),a=root.querySelector('.slides').getBoundingClientRect(),lim=n=>Math.max(0,Math.min(98,n));
  return elementi().map(b=>{const salvata=modificaFoglio?.boxes?.find(v=>v.id===b.dataset.blockId);if((area.dataset.layout==='free'||['navbar','page-number'].includes(b.dataset.type))&&PresentaModello.riquadro(salvata?.box))return {id:b.dataset.blockId,box:{...salvata.box}};const r=b.getBoundingClientRect(),x=lim((r.left-a.left)/a.width*100),y=lim((r.top-a.top)/a.height*100);return {id:b.dataset.blockId,box:{x,y,width:Math.max(2,Math.min(100-x,r.width/a.width*100)),height:Math.max(2,Math.min(100-y,r.height/a.height*100))},fontSize:Math.max(12,Math.min(160,parseFloat(getComputedStyle(b.querySelector('h2')||b).fontSize)))};});
 }
 function aggiornaBubble(b){if(!b)return;const r=b.getBoundingClientRect();invia('muoviBubble',{blockId:b.dataset.blockId,rect:{x:r.x,y:r.y,width:r.width,height:r.height}});}
 function deseleziona(){scrittura.termina();termina(true);if(!modificaFoglio)return;selezione({...modificaFoglio,selezionato:'',selezionati:[]});document.activeElement?.blur();invia('seleziona',{blockId:null});invia('nascondiBubble');}
 function mostraBubble(b){if(pubblico||!b||modificaFoglio?.bloccato||modificaFoglio?.pulita||inAttesa)return;const r=b.getBoundingClientRect();invia('menuOggetto',{blockId:b.dataset.blockId,rect:{x:r.x,y:r.y,width:r.width,height:r.height}});}
 function adatta(id){
  const b=elementi().find(b=>b.dataset.blockId===id);if(!b||!avvia(b))return;const v=gesto.boxes.find(x=>x.id===id),img=b.querySelector('img'),contenuto=b.querySelector('.presenta-contenuto');let altezza;
  if(img?.naturalWidth)altezza=(v.box.width/100*deck.getConfig().width-16)*img.naturalHeight/img.naturalWidth+(b.querySelector('figcaption')?.offsetHeight||0)+24;
  else{const clone=contenuto.cloneNode(true);Object.assign(clone.style,{position:'absolute',width:Math.max(1,b.clientWidth-16)+'px',height:'auto',maxHeight:'none'});b.append(clone);altezza=clone.scrollHeight+16;clone.remove();}
  v.box=PresentaModello.muovi(v.box,0,altezza/deck.getConfig().height*100-v.box.height,true);gesto.mosso=true;mostraMisure();termina();
 }
 root.addEventListener('contextmenu',e=>{if(pubblico||modificaFoglio?.pulita)return;const b=e.target.closest('.presenta-blocco');if(!b)return;e.preventDefault();invia('seleziona',{blockId:b.dataset.blockId});mostraBubble(b);});
 function avvia(b){
  if(gesto||!modificaFoglio||modificaFoglio.bloccato||modificaFoglio.pulita||inAttesa||!pronto)return false;
  const area=corrente(),ids=modificaFoglio.selezionati?.includes(b.dataset.blockId)?modificaFoglio.selezionati:[b.dataset.blockId];if(ids.length>1&&ids.some(id=>!areaOggetto(id)))return false;gesto={ids,id:b.dataset.blockId,generazione:modificaFoglio.selezioneGiro,boxes:misure(),prima:elementi().map(e=>[e,e.getAttribute('style')]),layout:area.dataset.layout};
  area.dataset.layout='free';for(const v of gesto.boxes){const e=elementi().find(b=>b.dataset.blockId===v.id);Object.assign(e.style,{left:v.box.x+'%',top:v.box.y+'%',width:v.box.width+'%',height:v.box.height+'%',...(v.fontSize?{fontSize:v.fontSize+'px'}:{})});}
  selezione({...modificaFoglio,selezionato:b.dataset.blockId});if(ids.length<2)invia('seleziona',{blockId:b.dataset.blockId});return true;
 }
 function areaOggetto(id){return ['navbar','page-number'].includes(elementi().find(b=>b.dataset.blockId===id)?.dataset.type)?null:modificaFoglio?.areaUtile;}
 function limitaContenuto(box,id){const area=areaOggetto(id);return area?PresentaModello.limitaArea(box,area):box;}
 function mostraMisure(){
  for(const v of gesto.boxes)if(gesto.ids.includes(v.id))v.box=limitaContenuto(v.box,v.id);for(const v of gesto.boxes){const b=elementi().find(e=>e.dataset.blockId===v.id);Object.assign(b.style,{left:v.box.x+'%',top:v.box.y+'%',width:v.box.width+'%',height:v.box.height+'%'});}aggiornaBubble(elementi().find(b=>b.dataset.blockId===gesto.id));}
 function termina(annulla=false){
  if(!gesto)return;corrente()?.querySelectorAll('.presenta-guida').forEach(e=>e.remove());const g=gesto;gesto=null;if(g.elemento?.hasPointerCapture(g.pointerId))g.elemento.releasePointerCapture(g.pointerId);
  if(annulla||!g.mosso){corrente().dataset.layout=g.layout;for(const [e,style]of g.prima)e.setAttribute('style',style||'');return;}
  inAttesa=true;root.dataset.modificaPronta='false';invia('geometria',{blockId:g.id,slideId:modificaFoglio.slideId,firma:modificaFoglio.firma,boxes:g.boxes});
 }
 root.addEventListener('pointerdown',e=>{
  if(pubblico||modificaFoglio?.pulita||e.button!==0)return;const b=e.target.closest('.presenta-blocco');if(!b){deseleziona();return;}
  if(e.shiftKey&&!scrittura.attiva){const ids=new Set(modificaFoglio.selezionati?.length?modificaFoglio.selezionati:[modificaFoglio.selezionato].filter(Boolean));if(ids.has(b.dataset.blockId))ids.delete(b.dataset.blockId);else ids.add(b.dataset.blockId);selezione({...modificaFoglio,selezionati:[...ids],selezionato:[...ids].at(-1)||''});invia('selezionaGruppo',{ids:[...ids]});e.preventDefault();return;}
  if(scrittura.attiva?.el.contains(e.target))return;scrittura.termina();
  const ridimensiona=!!e.target.closest('.presenta-maniglia');if(!avvia(b))return;e.preventDefault();b.focus({preventScroll:true});b.setPointerCapture(e.pointerId);gesto.pointerId=e.pointerId;gesto.elemento=b;gesto.x=e.clientX;gesto.y=e.clientY;gesto.ridimensiona=ridimensiona;gesto.origini=gesto.boxes.map(v=>({id:v.id,box:{...v.box}}));gesto.box={...gesto.boxes.find(x=>x.id===gesto.id).box};gesto.area=corrente().getBoundingClientRect();
 });
 root.addEventListener('pointermove',e=>{if(!gesto||gesto.tastiera||e.pointerId!==gesto.pointerId)return;const dx=(e.clientX-gesto.x)/gesto.area.width*100,dy=(e.clientY-gesto.y)/gesto.area.height*100;if(!gesto.mosso&&Math.abs(dx)+Math.abs(dy)<.35)return;gesto.mosso=true;if(gesto.ids.length>1){const origini=gesto.origini.filter(v=>gesto.ids.includes(v.id)),[x,y]=PresentaModello.limitaDelta(origini.map(v=>v.box),dx,dy,modificaFoglio.areaUtile);for(const v of origini)gesto.boxes.find(b=>b.id===v.id).box=PresentaModello.muovi(v.box,x,y);}
  else{let box=PresentaModello.muovi(gesto.box,dx,dy,gesto.ridimensiona);corrente().querySelectorAll('.presenta-guida').forEach(e=>e.remove());if(modificaFoglio.magnetiche&&!e.altKey&&!gesto.ridimensiona){const r=PresentaModello.aggancia(box,gesto.boxes.filter(v=>v.id!==gesto.id).map(v=>v.box),.7,modificaFoglio.griglia?PresentaModello.righelli(modificaFoglio.griglia,modificaFoglio.areaUtile)[asse]:[7,50,93]);box=r.box;for(const g of r.guide){const linea=document.createElement('i');linea.className='presenta-guida';linea.dataset.asse=g.asse;linea.style[g.asse==='x'?'left':'top']=g.pos+'%';corrente().append(linea);}}gesto.boxes.find(x=>x.id===gesto.id).box=box;}mostraMisure();});
 root.addEventListener('pointerup',e=>{if(gesto?.pointerId===e.pointerId)termina();});root.addEventListener('pointercancel',e=>{if(gesto?.pointerId===e.pointerId)termina(true);});root.addEventListener('lostpointercapture',e=>{if(gesto?.pointerId===e.pointerId)termina(true);});
 document.addEventListener('keydown',e=>{if(!pubblico&&e.key==='Escape'){e.preventDefault();e.stopPropagation();deseleziona();}},true);
 root.addEventListener('keydown',e=>{
  if(pubblico)return;if(scrittura.keydown(e))return;if((e.metaKey||e.ctrlKey)&&['s','z','y'].includes(e.key.toLowerCase())){e.preventDefault();scrittura.termina();termina(true);invia('cronologia',{comando:e.key.toLowerCase()==='s'?'salva':e.key.toLowerCase()==='y'||e.shiftKey?'ripeti':'annulla'});return;}if(e.key==='Escape'){deseleziona();return;}
  if(modificaFoglio?.pulita||modificaFoglio?.bloccato)return;
  const b=e.target.closest('.presenta-blocco'),key=e.key.toLowerCase(),cmd=(e.metaKey||e.ctrlKey)?({c:'copia',v:'incolla',d:'duplica'})[key]:['Delete','Backspace'].includes(e.key)?'elimina':null;
  if(cmd&&(b||cmd==='incolla')){e.preventDefault();termina(true);invia('comandoOggetto',{comando:cmd,blockId:b?.dataset.blockId,slideId:modificaFoglio.slideId,firma:modificaFoglio.firma});return;}if(!b)return;
  if(e.key==='Enter'&&b.querySelector('[data-testo-id]')){e.preventDefault();scrittura.avvia(b.querySelector('[data-testo-id]'));return;}
  if(['Enter',' '].includes(e.key)){e.preventDefault();selezione({...modificaFoglio,selezionato:b.dataset.blockId});invia('seleziona',{blockId:b.dataset.blockId});return;}
  if(!e.key.startsWith('Arrow'))return;e.preventDefault();if(!gesto&&!avvia(b))return;gesto.tastiera=true;gesto.mosso=true;const d=e.shiftKey?3:1,scelti=gesto.boxes.filter(x=>gesto.ids.includes(x.id));let dx=({ArrowLeft:-d,ArrowRight:d})[e.key]||0,dy=({ArrowUp:-d,ArrowDown:d})[e.key]||0;if(scelti.length>1){[dx,dy]=PresentaModello.limitaDelta(scelti.map(v=>v.box),dx,dy,modificaFoglio.areaUtile);}for(const v of scelti)v.box=PresentaModello.muovi(v.box,dx,dy,e.altKey&&scelti.length===1);mostraMisure();
 });
 root.addEventListener('keyup',e=>{if(gesto?.tastiera&&e.key.startsWith('Arrow'))termina();});
 window.addEventListener('blur',()=>termina(true));

 if(pubblico){
  window.presentaPubblico.onComando(o=>esegui(async()=>{inComando=true;contesto=o;comando({...o,...o.destinazione});inComando=false;conferma();}));
  esegui(async()=>{const r=await window.presentaPubblico.pronto();if(!r.ok)throw Error(r.error);inComando=true;contesto={...r.stato,token:r.token};await aggiorna({documento:r.documento,posizione:r.stato});inComando=false;conferma();});
 }else{
  window.addEventListener('message',e=>{if(e.source!==parent||!['null','file://'].includes(e.origin)||!e.data?.presenta)return;
   const o=e.data;if(canale&&o.presenta!==canale)return;
   if(o.tipo==='apriClip'&&['audio','video'].includes(o.mediaType)&&/^presenta:\/\//.test(o.src)){
    canale=o.presenta;root.hidden=true;clipGiro++;clip?.pause();clip?.remove();clip=document.createElement(o.mediaType);clip.controls=true;clip.className='presenta-clip';clip.preload='metadata';clip.src=o.src;document.body.append(clip);
    clip.addEventListener('loadedmetadata',()=>invia('durataClip',{duration:clip.duration}));clip.addEventListener('error',()=>invia('errore',{error:'Impossibile riprodurre questo media. Verifica file e codec.'}));clip.addEventListener('timeupdate',()=>{if(intervalloClip.end&&clip.currentTime>=intervalloClip.end)clip.pause();});
   }
   else if(o.tipo==='intervalloClip'&&clip&&Number.isFinite(o.start)&&Number.isFinite(o.end)&&o.start>=0&&o.end>o.start&&o.end<=clip.duration){clipGiro++;clip.pause();intervalloClip={start:o.start,end:o.end};clip.currentTime=o.start;}
   else if(o.tipo==='riproduciClip'&&clip){const n=++clipGiro,media=clip;media.currentTime=intervalloClip.start;media.play().catch(e=>{if(n===clipGiro&&clip===media)invia('errore',{error:e.message});});}
   else if(o.tipo==='pausaClip'&&clip){clipGiro++;clip.pause();}
   else if(o.tipo==='quadro')esegui(()=>aggiorna({...o,canale:o.presenta}));
   else if(o.tipo==='guide'){if(modificaFoglio){modificaFoglio.griglia=[0,2,3,4].includes(o.griglia)?o.griglia:0;modificaFoglio.magnetiche=!!o.magnetiche;disegnaGuide();}}
   else if(o.tipo==='selezione'){if(!pubblico)selezione({...modificaFoglio,...o.editor});}
   else if(o.tipo==='modificaTesto'){scrittura.avvia(elementi().find(b=>b.dataset.blockId===o.blockId)?.querySelector('[data-testo-id]'));}
   else if(o.tipo==='formatoTesto'){if(scrittura.attiva?.identita.sessione===o.sessione)scrittura.formatta(o.patch);}
   else if(o.tipo==='salvaScrittura'){const errore=scrittura.salva();invia('scritturaSalvata',{richiesta:o.richiesta,errore});}
   else if(o.tipo==='fineScrittura')scrittura.termina(false);
   else if(o.tipo==='adatta')esegui(()=>adatta(o.blockId));
   else if(o.tipo==='misure'){if(!pubblico&&pronto&&!gesto)invia('misure',{boxes:misure(),firma:modificaFoglio?.firma,slideId:modificaFoglio?.slideId,richiesta:o.richiesta});}
   else if(o.tipo==='passoAnimazione'&&!modificaFoglio)esegui(()=>comando({azione:o.indietro?'indietro':'avanti'}));
   else if(o.tipo==='vai')esegui(()=>{if(pronto){comando({azione:'vai',...o.posizione});if(o.editor)selezione({...modificaFoglio,...o.editor});segnalaIngombro();}});
  });parent.postMessage({tipo:'presenta-caricato'},'*');
 }
 root.addEventListener('dblclick',e=>{if(pubblico)return;const el=e.target.closest('[data-testo-id]');if(el){e.preventDefault();scrittura.avvia(el);}});
 root.addEventListener('click',e=>{if(e.shiftKey||modificaFoglio?.selezionati?.length>1)return;if(scrittura.attiva?.el.contains(e.target))return;const a=e.target.closest('a');if(a&&!pubblico)e.preventDefault();if(!pubblico&&!modificaFoglio?.pulita){const b=e.target.closest('[data-block-id]');if(b){invia('seleziona',{blockId:b.dataset.blockId});mostraBubble(b);}}});
 root.addEventListener('play',e=>{if(!pubblico&&!prova){e.target.pause();e.target.muted=true;}},true);
 new ResizeObserver(()=>{if(pronto){deck.layout();aggiornaBubble(elementi().find(b=>b.dataset.blockId===modificaFoglio?.selezionato));}}).observe(root);
 window.addEventListener('pagehide',()=>{animazioni?.destroy();navbar?.destroy();sfondo?.destroy();pronto=false;for(const m of root.querySelectorAll('audio,video'))m.pause();deck?.destroy();});
})();
