/* I gesti comandano l'inquadratura di origine: nessuno zoom del browser
   separato, altrimenti la LIM e il riquadro arancione divergerebbero. */
(function(){
 'use strict';
 function collega(host,azioni){
  let spazio=false,pan=null,tocchi=new Map(),multiplo=false,tap=null,ignoraClick=false;
  const interattivo=n=>!!n.closest?.('button,input,textarea,select,a,[contenteditable="true"]');
  const ancora=(x,y)=>{const r=host.getBoundingClientRect();return {x:Math.max(0,Math.min(1,(x-r.x)/r.width)),y:Math.max(0,Math.min(1,(y-r.y)/r.height))};};
  function cursore(){host.classList.toggle('gesto-mano',spazio);host.classList.toggle('gesto-presa',!!pan||tocchi.size>1||[...tocchi.values()].some(p=>p.trascina));}
  function annulla(){const ids=[...tocchi.keys(),...(pan?[pan.id]:[])];tocchi.clear();pan=null;spazio=false;multiplo=false;tap=null;for(const id of ids)if(host.hasPointerCapture(id))host.releasePointerCapture(id);cursore();}
  function coppia(){const p=[...tocchi.values()];if(p.length!==2||p.some(t=>t.tipo!=='touch'))return null;return {x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2,d:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)};}
  host.addEventListener('wheel',e=>{
   if(!e.ctrlKey)return;e.preventDefault();
   if(Number.isFinite(e.deltaY))azioni.zoom(BancoLettura.pinch(azioni.leggiScala(),e.deltaY,e.deltaMode),ancora(e.clientX,e.clientY));
  },{passive:false});
  window.addEventListener('keydown',e=>{if((host.contains(e.target)||e.target===document.body)&&e.code==='Space'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!interattivo(e.target)){e.preventDefault();spazio=true;cursore();}if(e.key==='Escape')annulla();});
  window.addEventListener('keyup',e=>{if(e.code==='Space'){spazio=false;pan=null;cursore();}});
  host.addEventListener('pointerdown',e=>{
   if(interattivo(e.target))return;
   if(e.pointerType==='touch'||(e.pointerType==='pen'&&e.button===0)){
    e.preventDefault();ignoraClick=true;host.setPointerCapture(e.pointerId);tocchi.set(e.pointerId,{tipo:e.pointerType,x:e.clientX,y:e.clientY,inizioX:e.clientX,inizioY:e.clientY});
    if(tocchi.size>1){multiplo=true;tap=null;}cursore();return;
   }
   ignoraClick=false;
   if(!spazio||e.button!==0)return;
   e.preventDefault();host.focus({preventScroll:true});host.setPointerCapture(e.pointerId);pan={id:e.pointerId,x:e.clientX,y:e.clientY};ignoraClick=true;cursore();
  });
  host.addEventListener('pointermove',e=>{
   if(tocchi.has(e.pointerId)){
    e.preventDefault();const prima=coppia(),p=tocchi.get(e.pointerId),dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;const dopo=coppia();
    if(prima&&dopo&&prima.d>0){azioni.zoom(azioni.leggiScala()*dopo.d/prima.d,ancora(prima.x,prima.y));azioni.sposta(dopo.x-prima.x,dopo.y-prima.y);}
    // La soglia protegge i tre tocchi. Dopo un pinch si aspetta il rilascio
    // di tutte le dita: sollevarne una non deve avviare un nuovo trascinamento.
    else if(tocchi.size===1&&!multiplo&&(p.trascina||Math.hypot(p.x-p.inizioX,p.y-p.inizioY)>=8)){
     azioni.sposta(p.trascina?dx:p.x-p.inizioX,p.trascina?dy:p.y-p.inizioY);p.trascina=true;tap=null;cursore();
    }return;
   }
   if(!pan||pan.id!==e.pointerId)return;e.preventDefault();azioni.sposta(e.clientX-pan.x,e.clientY-pan.y);pan.x=e.clientX;pan.y=e.clientY;
  });
  host.addEventListener('pointerup',e=>{
   const p=tocchi.get(e.pointerId);
   if(p){
    e.preventDefault();
    if(!multiplo&&!p.trascina&&Math.hypot(e.clientX-p.inizioX,e.clientY-p.inizioY)<8){
     const ora=performance.now();tap=tap&&tap.tipo===e.pointerType&&ora-tap.ora<500&&Math.hypot(e.clientX-tap.x,e.clientY-tap.y)<30?{...tap,n:tap.n+1,ora}:{n:1,tipo:e.pointerType,ora,x:e.clientX,y:e.clientY};
     if(tap.n===3){azioni.adatta();tap=null;}
    }else tap=null;
    tocchi.delete(e.pointerId);if(!tocchi.size)multiplo=false;
   }
   if(pan?.id===e.pointerId){e.preventDefault();pan=null;}
   if(host.hasPointerCapture(e.pointerId))host.releasePointerCapture(e.pointerId);cursore();
  });
  host.addEventListener('click',e=>{if(ignoraClick){e.preventDefault();ignoraClick=false;return;}if(e.detail===3&&e.button===0&&!interattivo(e.target)&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.shiftKey){e.preventDefault();azioni.adatta();}});
  host.addEventListener('dragstart',e=>e.preventDefault());
  host.addEventListener('pointercancel',annulla);host.addEventListener('lostpointercapture',e=>{if(pan?.id===e.pointerId||tocchi.has(e.pointerId))annulla();});
  window.addEventListener('blur',annulla);document.addEventListener('visibilitychange',()=>{if(document.hidden)annulla();});
  return annulla;
 }
 window.ProiezioneGesti={collega};
}());
