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
  for(const m of root.querySelectorAll('audio,video')){const dietro=!!m.closest('.slide-background');if(passivo||!(slide?.contains(m)||sfondo?.contains(m)))m.pause();m.muted=passivo||dietro&&!!slide?.hasAttribute('data-background-video-muted');}
 }
 return {stato,comando,sincronizzaMedia};
});
