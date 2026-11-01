/* Player autonomo, privo del preload e delle note private di ZAINO. */
(function(){
 'use strict';
 const impostazioni=JSON.parse(document.getElementById('presenta-config').textContent),root=document.querySelector('.reveal');
 const ridotto=impostazioni.reducedMotion||matchMedia('(prefers-reduced-motion: reduce)').matches;
 const deck=new Reveal(root,{width:impostazioni.width,height:impostazioni.height,navigationMode:impostazioni.navigationMode,
  hash:false,history:false,center:true,transition:ridotto?'none':'slide',autoAnimate:!ridotto,autoPlayMedia:null,
  showNotes:false,help:false,keyboard:{83:null},fragmentInURL:false,view:'slide',
  katex:{local:'runtime/katex',trust:false,throwOnError:false,maxExpand:1000,maxSize:20,ignoredClasses:['katex','presenta-formula-errore'],delimiters:[{left:'\\(',right:'\\)',display:false},{left:'\\[',right:'\\]',display:true},{left:'$$',right:'$$',display:true}]},
  plugins:[RevealMath.KaTeX]});
 let pronto=false,observer;
 function silenzia(){const current=deck.getCurrentSlide();for(const m of root.querySelectorAll('audio,video'))if(!current?.contains(m)||document.documentElement.dataset.passiva==='true'){m.pause();m.muted=document.documentElement.dataset.passiva==='true';}}
 function stato(){const p=deck.getIndices();return {h:p.h,v:p.v||0,fragmentIndex:p.f??-1};}
 function cambiata(){silenzia();window.dispatchEvent(new CustomEvent('presenta:stato',{detail:stato()}));}
 function comando(o){
  if(!pronto)throw Error('Player non ancora pronto.');const p=stato(),stacks=deck.getHorizontalSlides();
  switch(o.azione){
   case 'avanti':deck.next();break;case 'indietro':deck.prev();break;
   case 'argomentoSuccessivo':if(p.h+1<stacks.length)deck.slide(p.h+1,0,-1);break;
   case 'argomentoPrecedente':if(p.h>0)deck.slide(p.h-1,0,-1);break;
   case 'approfondisci':if(stacks[p.h].querySelectorAll(':scope > section').length>p.v+1)deck.slide(p.h,p.v+1,-1);break;
   case 'risali':if(p.v>0)deck.slide(p.h,p.v-1,-1);break;
   case 'vai':if(!Number.isInteger(o.h)||!Number.isInteger(o.v)||!Number.isInteger(o.fragmentIndex)||!deck.getSlide(o.h,o.v))throw Error('Posizione non valida.');deck.slide(o.h,o.v,o.fragmentIndex);break;
   default:throw Error('Comando non disponibile.');
  }
  return stato();
 }
 const ready=(async()=>{await document.fonts.ready;await deck.initialize();await document.fonts.ready;pronto=true;observer=new ResizeObserver(()=>deck.layout());observer.observe(root);
  for(const event of ['slidechanged','fragmentshown','fragmenthidden'])deck.on(event,cambiata);deck.slide(0,0,-1);deck.layout();cambiata();return stato();})();
 window.PresentaPlayer=Object.freeze({ready,stato,comando,destroy(){pronto=false;observer?.disconnect();for(const m of root.querySelectorAll('audio,video'))m.pause();return deck.destroy();}});
 window.addEventListener('pagehide',()=>{for(const m of root.querySelectorAll('audio,video'))m.pause();});
})();
