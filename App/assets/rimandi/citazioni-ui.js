/* Consultazione umana di una citazione: nessun cambio di zaino, indice o contesto AI. */
(function(){
 'use strict';
 var stato=null,sequenza=0;
 function icona(id,nome){document.getElementById(id).innerHTML=UiIcone.svg(nome);}
 function messaggio(t){document.getElementById('citazioneStato').textContent=t;}
 function pulisci(){
  sequenza++;var s=stato;stato=null;
  selMenuChiudi();selBarraChiudi();
  menuNelDialogo(false);
  if(s){s.viewer?.setDocument(null);s.task?.destroy().catch(function(){});}
  document.getElementById('citazionePagine').replaceChildren();
 }
 function menuNelDialogo(aperto){
  // Un dialogo modale sta nel top layer: nessuno z-index del body può superarlo.
  var dialog=document.getElementById('citazioneDialog');
  ['selAncora','selBarra','selMenu'].forEach(function(id){
   var el=document.getElementById(id);if(aperto)dialog.append(el);
   else if(el.parentElement===dialog)document.body.append(el);
  });
 }
 function chiudi(){document.getElementById('citazioneDialog').close();}
 function controlli(){
  var s=stato,pronto=!!s?.doc,p=pronto?s.viewer.currentPageNumber:0;
  document.getElementById('citazioneConto').textContent=pronto?p+' DI '+s.doc.numPages:'− DI −';
  document.getElementById('citazionePrima').disabled=!pronto||p<=1;
  document.getElementById('citazioneDopo').disabled=!pronto||p>=s.doc.numPages;
  document.getElementById('citazioneCopia').disabled=!pronto;
  document.getElementById('citazioneVai').disabled=!pronto;
 }
 window.citazioneCopiaPdf=async function(zaino,file,pagina,testo){
  try{
   var r=await window.vault.citazioni.crea(zaino,file,Number(pagina),testo||'');
   if(r.error||!r.markdown)throw Error(r.error||'Citazione non disponibile.');
   await navigator.clipboard.writeText(r.markdown);toast('Citazione copiata: incollala in un appunto di qualsiasi zaino',true);return r;
  }catch(e){toast(e.message,false);return null;}
 };
 window.citazioneOriginePdf=function(range){
  if(!range)return null;
  function pagina(n){return (n.nodeType===1?n:n.parentElement)?.closest('#pdfPane .page,#pdfPane2 .page');}
  var a=pagina(range.startContainer),b=pagina(range.endContainer);
  if(!a||a!==b)return null;
  var file=a.closest('#pdfPane2')?FONTE2.file:ANTEPRIMA.file;
  return file?{file:file,pagina:Number(a.dataset.pageNumber)}:null;
 };
 window.citazioneSelezione=function(range){
  var root=document.getElementById('citazionePagine');
  if(!stato?.doc||!range||!root.contains(range.startContainer)||!root.contains(range.endContainer))return null;
  var testo=testoSelezionePdf(range);
  return testo?{range:range,testo:testo,soloCitazione:true}:null;
 };
 // Il secondo lettore permette la copia, senza esporre gli strumenti di annotazione del primo.
 document.addEventListener('contextmenu',function(e){
  if(!e.target.closest('#pdfPane2'))return;
  var s=window.getSelection();if(!s?.rangeCount||s.isCollapsed)return;
  var r=s.getRangeAt(0);if(!citazioneOriginePdf(r)||!puntoNellaSelezione(r,e.clientX,e.clientY))return;
  e.preventDefault();selMenuApri(e.clientX,e.clientY,{range:r,testo:testoSelezionePdf(r),soloCitazione:true});
 });
 window.citazioneZainoApri=async function(rimando){
  closePops();pulisci();var turno=sequenza,dialog=document.getElementById('citazioneDialog');
  document.getElementById('citazioneTitolo').textContent='Citazione PDF';
  if(!dialog.open)dialog.showModal();menuNelDialogo(true);messaggio('Controllo la fonte…');controlli();
  try{
   var r=await window.vault.citazioni.risolvi(rimando);
   if(turno!==sequenza||!dialog.open)return;
   if(r.error)throw Error(r.error);
   if(r.status!=='available')throw Error({changed:'La fonte è cambiata: il PDF non corrisponde più alla versione citata. La pagina originale non è disponibile.',ambiguous:'Due zaini hanno la stessa identità. Non posso scegliere la fonte corretta.',removed:'Fonte non disponibile: lo zaino o il PDF sono stati rimossi.'}[r.status]||'Fonte non disponibile.');
   document.getElementById('citazioneTitolo').textContent=r.zainoTitolo+' › '+r.file;
   pdfjsLib.GlobalWorkerOptions.workerSrc='assets/pdfjs/pdf.worker.min.mjs';
   var bus=new pdfjsViewer.EventBus(),link=new pdfjsViewer.PDFLinkService({eventBus:bus});
   var viewer=new pdfjsViewer.PDFViewer({container:document.getElementById('citazioneFrame'),viewer:document.getElementById('citazionePagine'),eventBus:bus,linkService:link,textLayerMode:1,annotationMode:0,annotationEditorMode:-1,removePageBorders:true});
   link.setViewer(viewer);
   var task=pdfjsLib.getDocument({data:new Uint8Array(r.bytes),isEvalSupported:false,enableXfa:false});delete r.bytes;
   var s={info:r,viewer:viewer,task:task,doc:null};stato=s;
   bus.on('pagesinit',function(){if(stato!==s)return;viewer.currentScaleValue='page-width';viewer.currentPageNumber=r.pagina;controlli();});
   bus.on('pagechanging',controlli);
   var doc=await task.promise;
   if(turno!==sequenza||!dialog.open){await doc.destroy();return;}
   if(r.pagina>doc.numPages)throw Error('La pagina citata non esiste in questo PDF.');
   s.doc=doc;link.setDocument(doc);viewer.setDocument(doc);
   messaggio('Sola lettura · Lo zaino attivo e le fonti dell’AI restano invariati.');controlli();
  }catch(e){if(turno!==sequenza)return;pulisci();messaggio(e.message);controlli();}
 };
 var dialog=document.getElementById('citazioneDialog');
 icona('citazioneChiudi','x');icona('citazionePrima','chevron-left');icona('citazioneDopo','chevron-right');
 // `close` arriva in coda: non deve distruggere un'anteprima già riaperta.
 dialog.addEventListener('close',function(){if(!dialog.open)pulisci();});
 document.getElementById('citazioneChiudi').onclick=chiudi;
 document.getElementById('citazionePrima').onclick=function(){if(stato?.doc)stato.viewer.currentPageNumber--;};
 document.getElementById('citazioneDopo').onclick=function(){if(stato?.doc)stato.viewer.currentPageNumber++;};
 document.getElementById('citazioneCopia').addEventListener('mousedown',function(e){e.preventDefault();});
 window.citazioneCopiaDaRange=async function(range){
  var s=stato;if(!s?.doc)return;
  var testo='',pagina=s.viewer.currentPageNumber;
  if(citazioneSelezione(range)){
   var n=range.startContainer,e=range.endContainer;
   var a=(n.nodeType===1?n:n.parentElement).closest('#citazionePagine .page');
   var b=(e.nodeType===1?e:e.parentElement).closest('#citazionePagine .page');
   if(a&&b){if(a!==b){toast('Seleziona un passaggio di una sola pagina per citarlo.',false);return;}pagina=Number(a.dataset.pageNumber);testo=testoSelezionePdf(range);}
  }
  // Riusa l'identità e la revisione già verificate, anche se l'originale è cambiato nel frattempo.
  var ref=RimandiSintassi.leggi(s.info.rimando),url=RimandiSintassi.scriviPdfZaino(ref.zainoId,ref.sourceId,pagina,ref.revision);
  var md=RimandiSintassi.citazionePdfZaino({...s.info,pagina:pagina,rimando:url},testo);
  try{await navigator.clipboard.writeText(md);messaggio('Citazione copiata. Chiudi l’anteprima e incollala nel tuo appunto.');}catch(e){messaggio('Copia non riuscita: '+e.message);}
 };
 document.getElementById('citazioneCopia').onclick=function(){
  var sel=window.getSelection();citazioneCopiaDaRange(sel?.rangeCount&&!sel.isCollapsed?sel.getRangeAt(0):null);
 };
 document.getElementById('citazioneVai').onclick=function(){
  var r=stato?.info;if(!r)return;chiudi();cambiaZaino(r.zaino);
  if(zainoAttivo()===r.zaino)openPdf(r.file,r.pagina,r.file);
 };
 window.addEventListener('studia:zaino-changed',function(){if(dialog.open)chiudi();});
 new ResizeObserver(function(){if(stato?.doc)stato.viewer.currentScaleValue='page-width';}).observe(document.getElementById('citazioneFrame'));
}());
