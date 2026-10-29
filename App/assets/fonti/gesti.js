/* Gesti dei lettori PDF: il viewer mantiene scala e scroll, senza copie dello stato. */
(function(){
 'use strict';
 var sopra=null,spazio=false,pan=null,ignoraMouse=false,ignoraClick=false,lettori=Object.create(null);
 var tocchi=new Map(),multipli=new Set(),tap=null;
 // Ogni superficie offre il proprio viewer: gesti, limiti e coordinate restano comuni.
 window.FontiGesti={registra:function(id,leggi){
  lettori[id]=leggi;document.getElementById(id).dataset.pdfGesti='';
 }};
 FontiGesti.registra('pdfFrame',function(){return ANTEPRIMA.tipo==='pdf'&&PDFJS.pronto&&PDFJS.doc?
  {viewer:PDFJS.viewer,ricorda:pdfZoomRicorda,aggiorna:pdfZoomAggiorna,adatta:pdfZoomAdatta}:null;});
 FontiGesti.registra('pdf2Frame',function(){return fonte2Aperta()?
  {viewer:FONTE2.viewer,ricorda:fonte2ZoomRicorda,aggiorna:fonte2Aggiorna,adatta:fonte2ZoomAdatta}:null;});
 function lettore(n){
  var host=n?.closest?.('[data-pdf-gesti]'),l=host&&lettori[host.id]?.();
  if(l)l.host=host;
  return l;
 }
 function interattivo(n){return !!n?.closest?.('input,textarea,select,button,a,[contenteditable="true"],[role="button"]');}
 function chiudiSelezione(){getSelection()?.removeAllRanges();selMenuChiudi();selBarraChiudi();}
 function cursore(){
  Object.keys(lettori).forEach(function(id){var h=document.getElementById(id);h.classList.toggle('pdf-spazio',spazio&&sopra===h);h.classList.toggle('pdf-trascina',pan?.host===h||Array.from(tocchi.values()).some(p=>p.l.host===h&&p.trascina));});
 }
 function termina(){
  var p=pan;pan=null;
  if(p?.host.hasPointerCapture(p.id))p.host.releasePointerCapture(p.id);
  cursore();
 }
 function annulla(){
  var attivi=Array.from(tocchi.entries());tocchi.clear();multipli.clear();tap=null;spazio=false;
  attivi.forEach(([id,p])=>{if(p.l.host.hasPointerCapture(id))p.l.host.releasePointerCapture(id);});termina();
 }
 function dita(host){return Array.from(tocchi.values()).filter(p=>p.l.host===host);}
 function coppia(host){
  var d=dita(host);if(d.length!==2)return null;
  return {x:(d[0].x+d[1].x)/2,y:(d[0].y+d[1].y)/2,d:Math.hypot(d[0].x-d[1].x,d[0].y-d[1].y)};
 }
 function zoom(l,n,x,y){
  var s=l.viewer.currentScale||1,r=l.host.getBoundingClientRect();
  // PDF.js sottrae offsetLeft/Top: l'ancora deve restare nello split toccato.
  l.viewer.updateScale({scaleFactor:n/s,origin:[x-r.left+l.host.offsetLeft,y-r.top+l.host.offsetTop],drawingDelay:400});
  l.ricorda?.(l.viewer.currentScale);l.aggiorna?.();
 }
 document.addEventListener('wheel',function(e){
  var l=lettore(e.target);if(!l||(!e.ctrlKey&&!e.shiftKey))return;
  // Blocca lo zoom della finestra anche quando il PDF ha raggiunto il limite.
  e.preventDefault();
  if(pan||tocchi.size||ALBUM.giu)return;
  var s=l.viewer.currentScale||1,n=FontiZoom.daRotella(s,e);if(n===null)return;
  zoom(l,n,e.clientX,e.clientY);
 },{passive:false});
 window.addEventListener('keydown',function(e){
  if(e.key==='Escape'){annulla();return;}
  if(e.code!=='Space'||e.ctrlKey||e.metaKey||e.altKey||interattivo(e.target))return;
  var dialog=document.querySelector('dialog[open]');if(dialog&&!dialog.contains(e.target))return;
  // Uno spazio scritto nell'appunto o usato per scorrerlo non deve armare il PDF.
  if(!lettore(e.target) && !(e.target===document.body&&lettore(sopra)))return;
  e.preventDefault();e.stopPropagation();spazio=true;cursore();
 },true);
 window.addEventListener('keyup',function(e){if(e.code==='Space'&&spazio){e.preventDefault();annulla();}},true);
 window.addEventListener('pointermove',function(e){
  var t=tocchi.get(e.pointerId);
  if(t){
   e.preventDefault();e.stopPropagation();
   var h=t.l.host,prima=coppia(h),dx=e.clientX-t.x,dy=e.clientY-t.y;t.x=e.clientX;t.y=e.clientY;
   var dopo=coppia(h);
   if(prima&&dopo&&prima.d>0){
    var s=t.l.viewer.currentScale||1,n=FontiZoom.daRotella(s,{ctrlKey:true,deltaY:-Math.log(dopo.d/prima.d)*100});
    if(n!==null)zoom(t.l,n,prima.x,prima.y);
    h.scrollLeft-=dopo.x-prima.x;h.scrollTop-=dopo.y-prima.y;
   }else if(dita(h).length===1&&!multipli.has(h)&&(t.trascina||Math.hypot(t.x-t.inizioX,t.y-t.inizioY)>=8)){
    h.scrollLeft-=t.trascina?dx:t.x-t.inizioX;h.scrollTop-=t.trascina?dy:t.y-t.inizioY;t.trascina=true;tap=null;cursore();
   }
   return;
  }
  if(!pan){var h=lettore(e.target)?.host||null;if(h!==sopra){sopra=h;cursore();}return;}
  if(e.pointerId!==pan.id)return;
  if(!(e.buttons&1)){termina();return;}
  e.preventDefault();e.stopPropagation();
  pan.host.scrollLeft=pan.left+pan.x-e.clientX;pan.host.scrollTop=pan.top+pan.y-e.clientY;
 },true);
 // In cattura sulla finestra, prima dei ritagli e della selezione del testo.
 window.addEventListener('pointerdown',function(e){
  ignoraClick=false;ignoraMouse=false;
  var l=lettore(e.target);
  if(!l||interattivo(e.target)||ALBUM.giu)return;
  if(e.pointerType==='touch'){
   // Con le forbici esplicitamente attive il dito continua a ritagliare.
   if(l.host.id==='pdfFrame'&&albumForbici())return;
   e.preventDefault();e.stopPropagation();chiudiSelezione();termina();sopra=l.host;
   tocchi.set(e.pointerId,{l:l,x:e.clientX,y:e.clientY,inizioX:e.clientX,inizioY:e.clientY});
   if(dita(l.host).length>1){multipli.add(l.host);tap=null;}
   ignoraMouse=true;ignoraClick=true;l.host.setPointerCapture(e.pointerId);l.host.focus({preventScroll:true});cursore();return;
  }
  if(!spazio||e.button!==0||e.pointerType!=='mouse')return;
  e.preventDefault();e.stopPropagation();chiudiSelezione();
  sopra=l.host;pan={host:l.host,id:e.pointerId,x:e.clientX,y:e.clientY,left:l.host.scrollLeft,top:l.host.scrollTop};
  ignoraMouse=true;ignoraClick=true;l.host.setPointerCapture(e.pointerId);l.host.focus({preventScroll:true});cursore();
 },true);
 window.addEventListener('pointerup',function(e){
  var t=tocchi.get(e.pointerId);
  if(t){
   e.preventDefault();e.stopPropagation();
   if(!multipli.has(t.l.host)&&!t.trascina&&Math.hypot(e.clientX-t.inizioX,e.clientY-t.inizioY)<8){
    var ora=performance.now();tap=tap&&tap.host===t.l.host&&ora-tap.ora<500&&Math.hypot(e.clientX-tap.x,e.clientY-tap.y)<30?{...tap,n:tap.n+1,ora:ora}:{n:1,host:t.l.host,ora:ora,x:e.clientX,y:e.clientY};
    if(tap.n===3){chiudiSelezione();t.l.adatta(true);tap=null;}
   }else tap=null;
   tocchi.delete(e.pointerId);if(!dita(t.l.host).length)multipli.delete(t.l.host);
   if(t.l.host.hasPointerCapture(e.pointerId))t.l.host.releasePointerCapture(e.pointerId);cursore();return;
  }
  if(pan&&e.pointerId===pan.id){e.preventDefault();e.stopPropagation();termina();}
 },true);
 window.addEventListener('pointercancel',annulla,true);
 window.addEventListener('lostpointercapture',function(e){if(tocchi.has(e.pointerId))annulla();else if(pan&&e.pointerId===pan.id)termina();},true);
 window.addEventListener('mouseup',function(e){if(ignoraMouse){e.preventDefault();e.stopPropagation();ignoraMouse=false;chiudiSelezione();}},true);
 window.addEventListener('click',function(e){
  if(ignoraClick){e.preventDefault();e.stopPropagation();ignoraClick=false;return;}
  var l=lettore(e.target);
  if(e.detail!==3||e.button!==0||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey||!l||interattivo(e.target)||ALBUM.giu)return;
  e.preventDefault();e.stopPropagation();chiudiSelezione();l.adatta(true);
 },true);
 // La chiusura del dialogo può arrivare mentre Spazio è ancora premuto.
 document.addEventListener('close',annulla,true);
 window.addEventListener('blur',annulla);
 document.addEventListener('visibilitychange',function(){if(document.hidden)annulla();});
 window.addEventListener('studia:zaino-changed',annulla);
}());
