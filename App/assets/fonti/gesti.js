/* Gesti dei due lettori: il viewer mantiene scala e scroll, senza copie dello stato. */
(function(){
 'use strict';
 var sopra=null,spazio=false,pan=null,ignoraMouse=false,ignoraClick=false;
 function lettore(n){
  var host=n?.closest?.('#pdfFrame,#pdf2Frame');
  if(!host)return null;
  if(host.id==='pdfFrame')return ANTEPRIMA.tipo==='pdf'&&PDFJS.pronto&&PDFJS.doc?
   {host:host,viewer:PDFJS.viewer,ricorda:pdfZoomRicorda,aggiorna:pdfZoomAggiorna,adatta:pdfZoomAdatta}:null;
  return fonte2Aperta()?{host:host,viewer:FONTE2.viewer,ricorda:fonte2ZoomRicorda,aggiorna:fonte2Aggiorna,adatta:fonte2ZoomAdatta}:null;
 }
 function interattivo(n){return !!n?.closest?.('input,textarea,select,button,a,[contenteditable="true"],[role="button"]');}
 function chiudiSelezione(){getSelection()?.removeAllRanges();selMenuChiudi();selBarraChiudi();}
 function cursore(){
  ['pdfFrame','pdf2Frame'].forEach(function(id){var h=document.getElementById(id);h.classList.toggle('pdf-spazio',spazio&&sopra===h);h.classList.toggle('pdf-trascina',pan?.host===h);});
 }
 function termina(){
  var p=pan;pan=null;
  if(p?.host.hasPointerCapture(p.id))p.host.releasePointerCapture(p.id);
  cursore();
 }
 function annulla(){spazio=false;termina();}
 document.addEventListener('wheel',function(e){
  var l=lettore(e.target);if(!l||(!e.ctrlKey&&!e.shiftKey))return;
  // Blocca lo zoom della finestra anche quando il PDF ha raggiunto il limite.
  e.preventDefault();
  if(pan||ALBUM.giu)return;
  var s=l.viewer.currentScale||1,n=FontiZoom.daRotella(s,e);if(n===null)return;
  var r=l.host.getBoundingClientRect();
  // PDF.js sottrae offsetLeft/Top: clientX/Y da soli sposterebbero l'ancora nel secondo split.
  l.viewer.updateScale({scaleFactor:n/s,origin:[e.clientX-r.left+l.host.offsetLeft,e.clientY-r.top+l.host.offsetTop],drawingDelay:400});
  l.ricorda(l.viewer.currentScale);l.aggiorna();
 },{passive:false});
 window.addEventListener('keydown',function(e){
  if(e.key==='Escape'){annulla();return;}
  if(e.code!=='Space'||e.ctrlKey||e.metaKey||e.altKey||interattivo(e.target)||document.querySelector('dialog[open]'))return;
  // Uno spazio scritto nell'appunto o usato per scorrerlo non deve armare il PDF.
  if(!lettore(e.target) && !(e.target===document.body&&lettore(sopra)))return;
  e.preventDefault();e.stopPropagation();spazio=true;cursore();
 },true);
 window.addEventListener('keyup',function(e){if(e.code==='Space'&&spazio){e.preventDefault();annulla();}},true);
 window.addEventListener('pointermove',function(e){
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
  if(!spazio||!l||e.button!==0||e.pointerType!=='mouse'||interattivo(e.target)||ALBUM.giu)return;
  e.preventDefault();e.stopPropagation();chiudiSelezione();
  sopra=l.host;pan={host:l.host,id:e.pointerId,x:e.clientX,y:e.clientY,left:l.host.scrollLeft,top:l.host.scrollTop};
  ignoraMouse=true;ignoraClick=true;l.host.setPointerCapture(e.pointerId);l.host.focus({preventScroll:true});cursore();
 },true);
 window.addEventListener('pointerup',function(e){if(pan&&e.pointerId===pan.id){e.preventDefault();e.stopPropagation();termina();}},true);
 window.addEventListener('pointercancel',annulla,true);
 window.addEventListener('lostpointercapture',function(e){if(pan&&e.pointerId===pan.id)termina();},true);
 window.addEventListener('mouseup',function(e){if(ignoraMouse){e.preventDefault();e.stopPropagation();ignoraMouse=false;chiudiSelezione();}},true);
 window.addEventListener('click',function(e){
  if(ignoraClick){e.preventDefault();e.stopPropagation();ignoraClick=false;return;}
  var l=lettore(e.target);
  if(e.detail!==3||e.button!==0||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey||!l||interattivo(e.target)||ALBUM.giu)return;
  e.preventDefault();e.stopPropagation();chiudiSelezione();l.adatta(true);
 },true);
 window.addEventListener('blur',annulla);
 document.addEventListener('visibilitychange',function(){if(document.hidden)annulla();});
 window.addEventListener('studia:zaino-changed',annulla);
}());
