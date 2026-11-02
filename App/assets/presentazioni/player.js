/* Player autonomo, privo del preload e delle note private di ZAINO. */
(function(){
 'use strict';
 const impostazioni=JSON.parse(document.getElementById('presenta-config').textContent),root=document.querySelector('.reveal');
 const ridotto=impostazioni.reducedMotion||matchMedia('(prefers-reduced-motion: reduce)').matches;
 const deck=new Reveal(root,{width:impostazioni.width,height:impostazioni.height,navigationMode:impostazioni.navigationMode,
  hash:false,history:false,center:true,margin:0,minScale:.01,maxScale:100,transition:ridotto?'none':'slide',autoAnimate:!ridotto,autoPlayMedia:null,
  showNotes:false,help:false,keyboard:{83:null},fragmentInURL:false,view:'slide',
  katex:{local:'runtime/katex',trust:false,throwOnError:false,maxExpand:1000,maxSize:20,ignoredClasses:['katex','presenta-formula-errore'],delimiters:[{left:'\\(',right:'\\)',display:false},{left:'\\[',right:'\\]',display:true},{left:'$$',right:'$$',display:true}]},
  plugins:[RevealMath.KaTeX]});
 let pronto=false,observer,animazioni;
 function silenzia(){const current=deck.getCurrentSlide();for(const m of root.querySelectorAll('audio,video'))if(!current?.contains(m)||document.documentElement.dataset.passiva==='true'){m.pause();m.muted=document.documentElement.dataset.passiva==='true';}}
 function stato(){return PresentaNavigazione.stato(deck);}
 function cambiata(){silenzia();window.dispatchEvent(new CustomEvent('presenta:stato',{detail:stato()}));}
 function comando(o){if(!pronto)throw Error('Player non ancora pronto.');return PresentaNavigazione.comando(deck,o);}
 const ready=(async()=>{await document.fonts.ready;await deck.initialize();await document.fonts.ready;pronto=true;animazioni=PresentaAnimazioniDOM.collega(deck,{ridotto});observer=new ResizeObserver(()=>deck.layout());observer.observe(root);
  for(const event of ['slidechanged','fragmentshown','fragmenthidden'])deck.on(event,cambiata);deck.slide(0,0,-1);deck.layout();cambiata();return stato();})();
 window.PresentaPlayer=Object.freeze({ready,stato,comando,destroy(){pronto=false;animazioni?.destroy();observer?.disconnect();for(const m of root.querySelectorAll('audio,video'))m.pause();return deck.destroy();}});
 window.addEventListener('pagehide',()=>{animazioni?.destroy();for(const m of root.querySelectorAll('audio,video'))m.pause();});
})();
