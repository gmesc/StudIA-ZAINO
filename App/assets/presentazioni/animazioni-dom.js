/* Un solo esecutore Anime.js per campioni, anteprima e player offline. */
(function(){
 'use strict';
 const A=PresentaAnimazioni,NS='http://www.w3.org/2000/svg';
 function svg(tag,attrs){const e=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);return e;}
 // Le righe semplici riusano le misure Pretext. Markdown ricco, bidi e CSS
 // non rappresentabili mantengono la misura geometrica del testo effettivo.
 function gruppiPretext(el){
  const t=el.querySelector('.presenta-testo');if(!t||!window.ZainoImpaginazione)return null;
  let flow=t;if(t.children.length){if(t.children.length!==1||t.firstElementChild.tagName!=='P'||t.firstElementChild.children.length)return null;flow=t.firstElementChild;}
  const text=flow.textContent;if(/[\u0590-\u08ff\u200e-\u200f\u202a-\u202e\u2066-\u2069]/u.test(text))return null;
  const stile=getComputedStyle(flow),box=flow.closest('p,h1,h2,h3,h4,h5,h6')||el.querySelector('.presenta-contenuto')||el,cs=getComputedStyle(box),larghezza=box.clientWidth-parseFloat(cs.paddingLeft||0)-parseFloat(cs.paddingRight||0);
  if(!larghezza||!stile.font||stile.whiteSpace!=='normal'||stile.wordBreak!=='normal'||!['auto','normal'].includes(stile.textWrapStyle||'auto')||stile.fontKerning==='none'||!['0px','normal'].includes(stile.wordSpacing)||stile.textTransform!=='none')return null;
  try{if(!document.fonts.check(stile.font,text))return null;return ZainoImpaginazione.gruppiParole(text,{font:stile.font,larghezza,interlinea:parseFloat(stile.lineHeight)||parseFloat(stile.fontSize)*1.4,spaziatura:parseFloat(stile.letterSpacing)||0,lingua:document.documentElement.lang||'it',dpr:devicePixelRatio});}catch(_){return null;}
 }
 function righeCoerenti(gruppi,parti){
  let prima=0,yPrima=null;
  for(let i=0;i<parti.length;i++)if(i===parti.length-1||gruppi[i]!==gruppi[i+1]){
   const y=parti[prima].getBoundingClientRect().top,fine=parti[i].getBoundingClientRect().top;
   if(Math.abs(y-fine)>=3||yPrima!==null&&Math.abs(y-yPrima)<3)return false;yPrima=y;prima=i+1;
  }return true;
 }
 function partiTesto(el,righe,lettere=false){
  const previsti=righe?gruppiPretext(el):null;const ripristini=[],parti=[],walk=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.textContent.trim()&&!n.parentElement.closest('.katex,svg,code,script,style')?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT});
  const nodi=[];while(walk.nextNode())nodi.push(walk.currentNode);
  for(const n of nodi){const pezzi=lettere?[...new Intl.Segmenter('it',{granularity:'grapheme'}).segment(n.textContent)].map(s=>s.segment):n.textContent.split(/(\s+)/),frag=document.createDocumentFragment(),nuovi=[];for(const t of pezzi){const e=t.trim()?document.createElement('span'):document.createTextNode(t);if(e.nodeType===1){e.textContent=t;e.style.display=lettere?'inline':'inline-block';parti.push(e);}nuovi.push(e);frag.append(e);}n.replaceWith(frag);ripristini.push(()=>{nuovi[0]?.before(n);nuovi.forEach(e=>e.remove());});}
  let gruppi=parti.map((_,i)=>i);if(righe&&previsti?.length===parti.length&&righeCoerenti(previsti,parti)){gruppi=previsti;const prima=el.getAttribute('data-impaginazione');el.dataset.impaginazione='pretext';ripristini.push(()=>{if(prima===null)el.removeAttribute('data-impaginazione');else el.setAttribute('data-impaginazione',prima);});}else if(righe){const ys=[];gruppi=parti.map(e=>{const y=e.getBoundingClientRect().top;let i=ys.findIndex(v=>Math.abs(v-y)<3);if(i<0){i=ys.length;ys.push(y);}return i;});}
  return {parti,gruppi,revert(){ripristini.reverse().forEach(f=>f());}};
 }
 function esegui(el,a,{ridotto=false,finale=false}={}){
  const spec=A.effetti[a.effect];if(!spec)return {revert(){}};
  const handles=[],ripristini=[],dur=A.durata(a)*1000,attesa=(a.inizio??a.delay??0)*1000;
  function muovi(target,props,extra={}){const h=anime.animate(target,{duration:dur,delay:attesa,ease:'outQuad',autoplay:false,...props,...extra});handles.push(h);return h;}
  function salva(e){const style=e.getAttribute('style');ripristini.push(()=>style===null?e.removeAttribute('style'):e.setAttribute('style',style));}
  salva(el);
  if(a.effect==='fade-in')muovi(el,{opacity:[0,1]});
  else if(a.effect==='fade-up')muovi(el,{opacity:[0,1],translateY:[32,0]});
  else if(a.effect==='slide-left')muovi(el,{opacity:[0,1],translateX:[-48,0]});
  else if(a.effect==='fade-down')muovi(el,{opacity:[0,1],translateY:[-32,0]});
  else if(a.effect==='slide-right')muovi(el,{opacity:[0,1],translateX:[48,0]});
  else if(a.effect==='bounce-in')muovi(el,{opacity:[0,1],translateY:[{from:40,to:-8,duration:dur*.6},{to:3,duration:dur*.2},{to:0,duration:dur*.2}]});
  else if(a.effect==='rotate-in')muovi(el,{opacity:[0,1],rotate:[-20,0],scale:[.85,1]});
  else if(a.effect==='wipe-in')muovi(el,{clipPath:['inset(0% 100% 0% 0%)','inset(0% 0% 0% 0%)']});
  else if(a.effect==='unfold-in')muovi(el,{opacity:[0,1],scaleY:[0,1]});
  else if(a.effect==='zoom-in')muovi(el,{opacity:[0,1],scale:[.85,1]});
  else if(a.effect==='fade-out')muovi(el,{opacity:[1,0]});
  else if(a.effect.startsWith('slide-out-')){const direzione=a.effect.slice(10),asse=['left','right'].includes(direzione)?'translateX':'translateY';muovi(el,{opacity:[1,0],[asse]:[0,['left','up'].includes(direzione)?-48:48]});}
  else if(a.effect==='zoom-out')muovi(el,{opacity:[1,0],scale:[1,.2]});
  else if(a.effect==='blur')muovi(el,{filter:['blur(0px)','blur(8px)']});
  else if(a.effect==='focus-in')muovi(el,{filter:['blur(12px)','blur(0px)'],opacity:[0,1]});
  else if(a.effect==='grow')muovi(el,{scale:[1,1.15]});
  else if(a.effect==='shrink')muovi(el,{scale:[1,.85]});
  else if(a.effect==='highlight-red'){muovi(el,{color:[getComputedStyle(el).color,'#ef4444']});if(el.querySelector('img,audio,video,.presenta-immagine-ritagliata')){el.style.outline='2px solid transparent';muovi(el,{outlineColor:['rgba(239,68,68,0)','rgba(239,68,68,1)']});}}
  else if(a.effect==='pulse')muovi(el,{scale:[{to:1.12,duration:dur/2},{to:1,duration:dur/2}]});
  else if(a.effect==='shake')muovi(el,{translateX:[{from:0,to:-8,duration:dur*.2},{to:8,duration:dur*.2},{to:-5,duration:dur*.2},{to:5,duration:dur*.2},{to:0,duration:dur*.2}]});
  else if(a.effect==='wobble')muovi(el,{rotate:[{from:0,to:-8,duration:dur*.25},{to:8,duration:dur*.25},{to:-4,duration:dur*.25},{to:0,duration:dur*.25}]});
  else if(a.effect==='spin')muovi(el,{rotate:[0,360]},{ease:'inOutQuad'});
  else if(['letters','words','lines','list-items','table-rows','table-columns'].includes(a.effect)){
   let targets,gruppi;
   if(['letters','words','lines'].includes(a.effect)){const s=partiTesto(el,a.effect==='lines',a.effect==='letters');targets=s.parti;gruppi=s.gruppi;ripristini.push(()=>s.revert());}
   else{targets=[...el.querySelectorAll(a.effect==='list-items'?'li':a.effect==='table-columns'?'tr>th,tr>td':'tr')];gruppi=targets.map((e,i)=>a.effect==='table-columns'?e.cellIndex:i);}
   if(!targets.length){targets=[el];gruppi=[0];}
   const tempi=A.tempiSequenza(a,Math.max(...gruppi)+1);
   muovi(targets,{opacity:[0,1]}, {duration:tempi.durata,delay:(_,i)=>attesa+tempi.ritardi[gruppi[i]]});
  }else if(a.effect==='draw'){
   const forma=el.querySelector('.presenta-forma');if(forma){const originale=forma.innerHTML;ripristini.push(()=>forma.innerHTML=originale);const paths=[...forma.children];for(const p of paths){p.style.stroke='currentColor';p.style.strokeWidth='2';p.style.fillOpacity='0';}muovi(anime.svg.createDrawable(paths),{draw:['0 0','0 1']},{duration:dur*.75});muovi(paths,{fillOpacity:[0,1]},{duration:dur*.25,delay:attesa+dur*.75});}
  }else if(a.effect==='underline'){
   el.style.position='relative';const disegno=svg('svg',{viewBox:'0 0 100 4',preserveAspectRatio:'none','aria-hidden':'true'}),p=svg('path',{d:'M0 2H100',fill:'none',stroke:'currentColor','stroke-width':2});disegno.style.cssText='position:absolute;inset:auto 0 0;width:100%;height:4px;pointer-events:none';disegno.append(p);el.append(disegno);ripristini.push(()=>disegno.remove());muovi(anime.svg.createDrawable(p),{draw:['0 0','0 1']});
  }else if(a.effect.startsWith('path-')){
   // Un SVG staccato mantiene le coordinate del foglio, indipendenti dallo zoom Reveal.
   const p=svg('path',{d:A.percorso(a.effect,a.distance||80)}),percorso=anime.svg.createMotionPath(p);
   muovi(el,{translateX:percorso.translateX,translateY:percorso.translateY},{ease:'linear'});
  }
  for(const h of handles){if(finale||ridotto){h.seek(h.duration);h.pause();}else h.play();}
  let correvano=[];
  return {pausa(){correvano=handles.filter(h=>!h.paused);correvano.forEach(h=>h.pause());},riprendi(){correvano.forEach(h=>h.resume());correvano=[];},revert(){handles.forEach(h=>h.revert());ripristini.reverse().forEach(f=>f());},fine(){handles.forEach(h=>{h.seek(h.duration);h.pause();});}};
 }
 function collega(deck,{ridotto=false}={}){
  const attivi=new Map();let slide=null;
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  function pulisci(){for(const h of [...attivi.values()].reverse())h.revert();attivi.clear();}
  function aggiorna(){const corrente=deck.getCurrentSlide(),cambio=corrente!==slide;if(cambio){pulisci();slide=corrente;}
   const tutti=[...(slide?.querySelectorAll('.presenta-animazione')||[])];
   for(const e of [...tutti].reverse())if(!e.classList.contains('visible')&&attivi.has(e)){attivi.get(e).revert();attivi.delete(e);}
   for(const e of tutti)if(e.classList.contains('visible')&&!attivi.has(e)){const a=JSON.parse(e.dataset.animazione);attivi.set(e,esegui(e,a,{ridotto:ridotto||media.matches||document.documentElement.dataset.movimentoRidotto==='true',finale:cambio}));}
  }
  for(const n of ['slidechanged','fragmentshown','fragmenthidden'])deck.on(n,aggiorna);
  function riduci(){if(media.matches)for(const h of attivi.values())h.fine();}media.addEventListener('change',riduci);aggiorna();
  return {pausa(){for(const h of attivi.values())h.pausa();},riprendi(){for(const h of attivi.values())h.riprendi();},destroy(){for(const n of ['slidechanged','fragmentshown','fragmenthidden'])deck.off(n,aggiorna);media.removeEventListener('change',riduci);pulisci();}};
 }
 window.PresentaAnimazioniDOM={esegui,collega};
})();
