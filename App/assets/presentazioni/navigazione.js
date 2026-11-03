/* Una sola grammatica dei comandi per anteprima, finestra pubblica e HTML esportato. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.PresentaNavigazione=factory();})(typeof window==='undefined'?this:window,function(){
 'use strict';
 function stato(deck){const p=deck.getIndices();return {h:p.h,v:p.v||0,fragmentIndex:p.f??-1};}
 function comando(deck,o){
  const p=stato(deck),stacks=deck.getHorizontalSlides();
  switch(o.azione){
   case 'avanti':deck.next();break;case 'indietro':deck.prev();break;
   case 'argomentoSuccessivo':if(p.h+1<stacks.length)deck.slide(p.h+1,0,-1);break;
   case 'argomentoPrecedente':if(p.h>0)deck.slide(p.h-1,0,-1);break;
   case 'approfondisci':if(stacks[p.h].querySelectorAll(':scope > section').length>p.v+1)deck.slide(p.h,p.v+1,-1);break;
   case 'risali':if(p.v>0)deck.slide(p.h,p.v-1,-1);break;
   case 'vai':if(!Number.isInteger(o.h)||!Number.isInteger(o.v)||!Number.isInteger(o.fragmentIndex)||!deck.getSlide(o.h,o.v))throw Error('Posizione non valida.');deck.slide(o.h,o.v,o.fragmentIndex);break;
   default:throw Error('Comando non disponibile.');
  }return stato(deck);
 }
 function sincronizzaMedia(deck,root,passivo){
  const slide=deck?.getCurrentSlide(),p=deck?.getIndices(),sfondo=p&&deck.getSlideBackground(p.h,p.v);
  for(const m of root.querySelectorAll('audio,video')){const dietro=!!m.closest('.slide-background'),comune=!!m.closest('.presenta-sfondo-comune');if(passivo||!(slide?.contains(m)||sfondo?.contains(m)||comune&&slide?.dataset.sfondoComune==='true'))m.pause();m.muted=passivo||(comune?m.dataset.silenzioso!=='false':dietro&&!!slide?.hasAttribute('data-background-video-muted'));}
 }
 // Un solo elemento vive fuori dalle slide: GIF e video non ripartono al cambio.
 function sfondoComune(deck,root,{passivo=()=>false,errore=()=>{}}={}){
  const template=root.querySelector('.presenta-sfondo-template');if(!template)return {destroy(){}};
  const layer=template.content.firstElementChild.cloneNode(true),video=layer.querySelector('video');root.append(layer);
  function aggiorna(){layer.hidden=deck.getCurrentSlide()?.dataset.sfondoComune!=='true';if(video){video.muted=passivo()||video.dataset.silenzioso!=='false';if(layer.hidden||passivo())video.pause();else if(video.paused)video.play().catch(e=>{if(e.name!=='AbortError'&&video.isConnected)errore('Video di sfondo non riproducibile. Verifica il formato e il codec.');});}}
  deck.on('slidechanged',aggiorna);aggiorna();return {firma:template.innerHTML,aggiorna,destroy(){video?.pause();deck.off('slidechanged',aggiorna);layer.remove();}};
 }
 // Il player autonomo e la finestra pubblica condividono clic e movimento ridotto.
 function navbar(deck,root,{ridotto=false,attiva=()=>true}={}){
  function click(e){const b=e.target.closest('[data-nav-h]');if(!b||!root.contains(b)||!attiva())return;e.preventDefault();e.stopPropagation();deck.slide(Number(b.dataset.navH),Number(b.dataset.navV),-1);}
  let animazione,zoom;
  function anima(){
   animazione?.revert();zoom?.revert();const nav=deck.getCurrentSlide()?.querySelector('.presenta-navbar');if(!nav)return;
   const active=nav.querySelector('[aria-current]'),verticale=nav.dataset.orientamento==='vertical';
   if(active){if(verticale)nav.scrollTop=Math.max(0,active.offsetTop-nav.offsetTop-(nav.clientHeight-active.offsetHeight)/2);else nav.scrollLeft=Math.max(0,active.offsetLeft-nav.offsetLeft-(nav.clientWidth-active.offsetWidth)/2);}
   if(ridotto||root.ownerDocument.documentElement.dataset.movimentoRidotto==='true'||!globalThis.anime?.animate)return;
   const buttons=nav.querySelectorAll('button');animazione=globalThis.anime.animate(buttons,{opacity:{from:0,to:1},[verticale?'translateX':'translateY']:{from:6,to:0},delay:globalThis.anime.stagger(Math.min(20,120/Math.max(1,buttons.length-1))),duration:180,ease:'outQuad'});
   const target=active?.querySelector('.presenta-step-contenuto'),scala=Number(nav.dataset.zoom)||1;if(target&&scala>1)zoom=globalThis.anime.animate(target,{scale:{from:1,to:scala},duration:220,ease:'outQuad'});
  }
  root.addEventListener('click',click,true);deck.on('slidechanged',anima);anima();return {destroy(){animazione?.revert();zoom?.revert();root.removeEventListener('click',click,true);deck.off('slidechanged',anima);}};
 }
 return {stato,comando,sincronizzaMedia,sfondoComune,navbar};
});
