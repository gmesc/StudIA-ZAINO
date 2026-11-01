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
  pronto=false;root.dataset.pronto='false';canale=o.canale||canale;const r=o.documento,s=r.settings;
  document.documentElement.dataset.tema=s.theme;document.documentElement.dataset.movimentoRidotto=String(s.reducedMotion);
  for(const m of root.querySelectorAll('audio,video'))m.pause();
  root.querySelector('.slides').innerHTML=r.html;silenzia();
  const ridotto=s.reducedMotion||matchMedia('(prefers-reduced-motion: reduce)').matches;
  const config={width:s.width,height:s.height,navigationMode:s.navigationMode,embedded:!pubblico,hash:false,history:false,center:true,view:'slide',scrollActivationWidth:null,
   keyboard:pubblico?{83:null,70:null,27:null}:false,controls:pubblico,progress:pubblico,overview:false,help:false,showNotes:false,autoPlayMedia:pubblico?null:false,
   transition:ridotto?'none':'slide',autoAnimate:!ridotto};
  if(!deck){deck=new Reveal(root,config);await deck.initialize();for(const n of ['slidechanged','fragmentshown','fragmenthidden'])deck.on(n,conferma);}
  else{deck.configure(config);deck.sync();}
  await document.fonts.ready;pronto=true;root.dataset.pronto='true';deck.slide(o.posizione?.h||0,o.posizione?.v||0,o.posizione?.fragmentIndex??-1);deck.layout();silenzia();const slide=deck.getCurrentSlide()?.querySelector('.presenta-slide');invia('pronto',{errors:r.errors||[],overflow:!!slide&&slide.scrollHeight>s.height});
 }
 function comando(o){if(!pronto)throw Error('Il player non è ancora pronto.');PresentaNavigazione.comando(deck,o);silenzia();}
 function esegui(fn){coda=coda.then(fn).catch(e=>{inComando=false;document.body.dataset.errore=e.message;if(pubblico)console.error(e.message);else invia('errore',{error:e.message});});return coda;}
 if(pubblico){
  window.presentaPubblico.onComando(o=>esegui(async()=>{inComando=true;contesto=o;comando({...o,...o.destinazione});inComando=false;conferma();}));
  esegui(async()=>{const r=await window.presentaPubblico.pronto();if(!r.ok)throw Error(r.error);inComando=true;contesto={...r.stato,token:r.token};await aggiorna({documento:r.documento,posizione:r.stato});inComando=false;conferma();});
 }else{
  window.addEventListener('message',e=>{if(e.source!==parent||!['null','file://'].includes(e.origin)||!e.data?.presenta)return;
   const o=e.data;if(canale&&o.presenta!==canale)return;
   if(o.tipo==='quadro')esegui(()=>aggiorna({...o,canale:o.presenta}));
   else if(o.tipo==='vai')esegui(()=>{if(pronto)comando({azione:'vai',...o.posizione});});
  });parent.postMessage({tipo:'presenta-caricato'},'*');
 }
 root.addEventListener('click',e=>{const a=e.target.closest('a');if(a)e.preventDefault();if(!pubblico){const b=e.target.closest('[data-block-id]');if(b)invia('seleziona',{blockId:b.dataset.blockId});}});
 root.addEventListener('play',e=>{if(!pubblico){e.target.pause();e.target.muted=true;}},true);
 new ResizeObserver(()=>{if(pronto)deck.layout();}).observe(root);
 window.addEventListener('pagehide',()=>{pronto=false;for(const m of root.querySelectorAll('audio,video'))m.pause();deck?.destroy();});
})();
