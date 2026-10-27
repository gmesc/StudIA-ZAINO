/* Consultazione umana di una citazione: nessun cambio di zaino, indice o contesto AI. */
(function(){
 'use strict';
 var stato=null,sequenza=0;
 var frame=document.getElementById('citazioneFrame');
 function adatta(modo){if(stato?.doc){stato.viewer.currentScaleValue=modo;stato.larghezza=frame.clientWidth;controlli();}}
 function adattaLarghezza(){adatta('page-width');}
 function zoomPasso(su){
  if(!stato?.doc)return;
  var n=FontiZoom.passo(stato.viewer.currentScale,su);
  if(n!==null){stato.viewer.currentScaleValue=String(n);controlli();}
 }
 FontiGesti.registra('citazioneFrame',function(){return stato?.doc&&document.getElementById('citazioneDialog').open?
  {viewer:stato.viewer,adatta:adattaLarghezza}:null;});
 function campoChiudi(){var i=document.getElementById('citazionePaginaIn'),b=document.getElementById('citazioneConto');i.hidden=true;b.hidden=false;b.setAttribute('aria-expanded','false');}
 function campoApri(){if(!stato?.doc)return;var i=document.getElementById('citazionePaginaIn'),b=document.getElementById('citazioneConto');b.hidden=true;i.hidden=false;b.setAttribute('aria-expanded','true');i.value=stato.viewer.currentPageNumber;i.focus();i.select();}
 function campoVai(){if(!stato?.doc)return;var i=document.getElementById('citazionePaginaIn'),p=FontiPagina.leggi(i.value,{numPages:stato.doc.numPages,etichette:stato.etichette});if(p===null){i.select();return;}campoChiudi();stato.viewer.currentPageNumber=p;frame.focus({preventScroll:true});}
 function ancoraDaRange(range){
  if(!range)return null;
  var a=(range.startContainer.nodeType===1?range.startContainer:range.startContainer.parentElement).closest('.page'),b=(range.endContainer.nodeType===1?range.endContainer:range.endContainer.parentElement).closest('.page');
  if(!a||a!==b)return null;
  var layer=a.querySelector('.textLayer');if(!layer?.contains(range.startContainer)||!layer.contains(range.endContainer))return null;
  var prima=document.createRange();prima.selectNodeContents(layer);prima.setEnd(range.startContainer,range.startOffset);
  return {testo:range.toString(),inizio:prima.toString().length};
 }
 window.citazioneSelezionaLayer=function(layer,ancora){
  var pos=RimandiSintassi.trovaSelezione(layer.textContent,ancora);
  if(!pos)return false;
  var walk=document.createTreeWalker(layer,NodeFilter.SHOW_TEXT),el,offset=0,r=document.createRange(),inizio=false;
  while((el=walk.nextNode())){
   var fine=offset+el.textContent.length;
   if(!inizio&&pos.inizio<=fine){r.setStart(el,pos.inizio-offset);inizio=true;}
   if(inizio&&pos.fine<=fine){r.setEnd(el,pos.fine-offset);break;}offset=fine;
  }
  getSelection().removeAllRanges();getSelection().addRange(r);
  r.startContainer.parentElement.scrollIntoView({block:'center',behavior:'instant'});
  return true;
 };
 function selezionaPassaggio(s,n){
  if(stato!==s||s.selezioneApplicata||!s.info.selezione||n!==s.info.pagina)return;
  var layer=document.querySelector('#citazionePagine .page[data-page-number="'+n+'"] .textLayer');if(!layer)return;
  s.selezioneApplicata=true;
  if(!citazioneSelezionaLayer(layer,s.info.selezione))messaggio('Pagina aperta. Non riesco a individuare esattamente il passaggio citato.');
 }
 function markdownCitazione(modo,range){
  if(!stato?.doc)return '';
  var s=stato,ref=RimandiSintassi.leggi(s.info.rimando),pagina=modo==='pdf'?null:s.viewer.currentPageNumber,testo='',ancora;
  if(modo==='estratto'){
   if(!citazioneSelezione(range))return '';
   ancora=ancoraDaRange(range);
   if(!ancora){messaggio('Seleziona un passaggio di una sola pagina per citarlo.');return '';}
   var el=range.startContainer.nodeType===1?range.startContainer:range.startContainer.parentElement;
   pagina=Number(el.closest('.page').dataset.pageNumber);testo=testoSelezionePdf(range);
  }
  var url=RimandiSintassi.scriviPdfZaino(ref.zainoId,ref.sourceId,pagina,ref.revision,ancora);
  if(!url){messaggio('La selezione è troppo lunga per un rimando. Seleziona un passaggio più breve.');return '';}
  return RimandiSintassi.citazionePdfZaino({...s.info,pagina:pagina||1,rimando:url},testo);
 }
 function inserisciMarkdown(md){
  var b=stato?.destinazione;
  if(!b?.file||!noteBersaglioValido(b)||!b.stato.mde){messaggio('L’appunto di destinazione non è più aperto. Riapri la citazione dall’appunto in cui vuoi inserire il testo.');return false;}
  var s=b.stato;chiudi();openEditor(s);mdbChiudi(true,s);
  s.mde.codemirror.setCursor(b.punto);var riga=s.mde.codemirror.getCursor().line+2;
  if(!noteScriviAlCursore('\n\n'+md+'\n\n',s))return false;
  noteAnteprimaRidisegna(s);
  var pv=noteHost(s).querySelector('.editor-preview-active-side, .editor-preview-active');
  var blocco=pv&&Array.from(pv.querySelectorAll('.mdb')).find(function(el){return Number(el.dataset.da)<=riga&&Number(el.dataset.a)>=riga;});
  var visibile=blocco?.firstElementChild;
  if(visibile){visibile.tabIndex=-1;visibile.focus({preventScroll:true});visibile.scrollIntoView({block:'center',behavior:'instant'});}
  toast('Citazione inserita in «'+(s.cur.title||s.cur.file)+'».',true);return true;
 }
 window.citazionePrepara=async function(zaino,file,destinazione,pagina){
  var b=destinazione?.stato?destinazione:noteBersaglio(destinazione);
  if(!b.file||!noteBersaglioValido(b)){toast('Apri prima l’appunto in cui vuoi inserire la citazione.',false);return;}
  mdbChiudi(true,b.stato);b.punto=b.stato.mde.codemirror.getCursor('to');
  try{var r=await window.vault.citazioni.crea(zaino,file,pagina||1,'');if(r.error)throw Error(r.error);
   if(!noteBersaglioValido(b))throw Error('L’appunto di destinazione è cambiato.');
   await citazioneZainoApri(r.rimando,b);
  }catch(e){toast('Non riesco ad aprire la fonte: '+e.message,false);}
 };
 var ritorno=null;
 function titoloZaino(id){return (MODO.zaini||[]).find(function(z){return z.id===id;})?.title||id;}
 function ritornoAggiorna(){var b=document.getElementById('citazioneTorna');b.hidden=!ritorno;if(ritorno){b.textContent='Torna a '+titoloZaino(ritorno.zaino);b.title='Torna allo zaino '+titoloZaino(ritorno.zaino)+' e all’appunto di partenza';}}
 async function apriOrigine(){
  var info=stato?.info;if(!info)return;
  if(info.zaino!==zainoAttivo())ritorno={zaino:zainoAttivo(),origine:info.zaino,attivo:noteStatoAttivo().id,
   note:noteStati().map(function(s){return {id:s.id,file:s.cur?.file,preview:!!s.mde?.isPreviewActive(),punto:s.mde?.codemirror.getCursor(),scroll:noteHost(s).querySelector('.editor-preview-active')?.scrollTop||0};})};
  chiudi();await cambiaZaino(info.zaino);
  if(zainoAttivo()===info.zaino){ritornoAggiorna();openPdf(info.file,info.pagina,info.file,false,info.selezione);}
  else{ritorno=null;ritornoAggiorna();}
 }
 document.getElementById('citazioneTorna').onclick=async function(e){
  e.stopPropagation();var b=ritorno;if(!b)return;
  if(!(MODO.zaini||[]).some(function(z){return z.id===b.zaino;})){ritorno=null;ritornoAggiorna();toast('Lo zaino di partenza non è più disponibile.',false);return;}
  closePops();await cambiaZaino(b.zaino);if(zainoAttivo()!==b.zaino)return;
  b.note.forEach(function(n){var s=noteStati().find(function(s){return s.id===n.id;});if(!s||!n.file||!noteOpen(n.file,s,{ripristina:true}))return;
   if(s.mde.isPreviewActive()!==n.preview)s.mde.togglePreview();s.mde.codemirror.setCursor(n.punto);
   var versione=s.versione;setTimeout(function(){if(s.versione!==versione)return;var pv=noteHost(s).querySelector('.editor-preview-active');if(pv)pv.scrollTop=n.scroll;},80);
  });
  noteAttiva(noteStati().find(function(s){return s.id===b.attivo;}));ritorno=null;ritornoAggiorna();
 };
 window.addEventListener('studia:zaino-changed',function(){if(ritorno&&zainoAttivo()!==ritorno.origine)ritorno=null;ritornoAggiorna();});

 function icona(id,nome){document.getElementById(id).innerHTML=UiIcone.svg(nome);}
 function messaggio(t){document.getElementById('citazioneStato').textContent=t;}
 function pulisci(){
  sequenza++;var s=stato;stato=null;campoChiudi();
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
  document.getElementById('citazioneVai').disabled=!pronto;
  var conto=document.getElementById('citazioneConto');conto.disabled=!pronto;conto.title=FontiPagina.suggerimento(p,{etichette:s?.etichette});
  var b=s?.destinazione,puoi=pronto&&b?.file&&noteBersaglioValido(b);
  document.getElementById('citazioneCitaPdf').disabled=!puoi;
  document.getElementById('citazioneCitaPagina').disabled=!puoi;
  document.querySelectorAll('#citazioneZoom button').forEach(function(b){b.disabled=!pronto;});
  var lvl=document.getElementById('citazioneZoomLvl');
  var e=FontiZoom.comandoPdf(s?.viewer.currentScaleValue,s?.viewer.currentScale,pronto);
  UiIcone.imposta(lvl,e.icona);lvl.title=e.titolo;lvl.setAttribute('aria-label',e.titolo);
 }
 window.citazioneCopiaPdf=async function(zaino,file,pagina,testo,range){
  var ancora=ancoraDaRange(range);
  try{
   var r=await window.vault.citazioni.crea(zaino,file,Number(pagina),testo||'');
   if(r.error||!r.markdown)throw Error(r.error||'Citazione non disponibile.');
   if(ancora){var ref=RimandiSintassi.leggi(r.rimando);r.rimando=RimandiSintassi.scriviPdfZaino(ref.zainoId,ref.sourceId,pagina,ref.revision,ancora);if(!r.rimando)throw Error('Selezione troppo lunga per un rimando. Seleziona un passaggio più breve.');r.markdown=RimandiSintassi.citazionePdfZaino(r,testo);}
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
  var b=stato.destinazione;
  return testo?{range:range,testo:testo,soloCitazione:true,anteprimaEsterna:true,
   appunto:b?.file&&noteBersaglioValido(b)?(b.stato.cur.title||b.file):''}:null;
 };
 // Il secondo lettore permette la copia, senza esporre gli strumenti di annotazione del primo.
 document.addEventListener('contextmenu',function(e){
  if(!e.target.closest('#pdfPane2'))return;
  var s=window.getSelection();if(!s?.rangeCount||s.isCollapsed)return;
  var r=s.getRangeAt(0);if(!citazioneOriginePdf(r)||!puntoNellaSelezione(r,e.clientX,e.clientY))return;
  e.preventDefault();selMenuApri(e.clientX,e.clientY,{range:r,testo:testoSelezionePdf(r),soloCitazione:true});
 });
 window.citazioneZainoApri=async function(rimando,destinazione){
  // Il link può appartenere al secondo editor. Catturarlo prima dell'attesa
  // impedisce che un cambio di focus scelga un altro documento al ritorno.
  var bersaglio=destinazione?.stato?destinazione:noteBersaglio(destinazione);
  if(bersaglio.file&&bersaglio.stato.mde){
   mdbChiudi(true,bersaglio.stato);
   if(!bersaglio.punto)bersaglio.punto=bersaglio.stato.mde.codemirror.getCursor('to');
  }
  closePops();pulisci();var turno=sequenza,dialog=document.getElementById('citazioneDialog');
  document.getElementById('citazioneTitolo').textContent='Citazione PDF';
  if(!dialog.open)dialog.showModal();menuNelDialogo(true);messaggio('Controllo la fonte…');controlli();
  try{
   var r=await window.vault.citazioni.risolvi(rimando);
   if(turno!==sequenza||!dialog.open)return;
   if(r.error)throw Error(r.error);
   if(r.status!=='available')throw Error({changed:'La fonte è cambiata: il PDF non corrisponde più alla versione citata. La pagina originale non è disponibile.',ambiguous:'Due zaini hanno la stessa identità. Non posso scegliere la fonte corretta.',removed:'Fonte non disponibile: lo zaino o il PDF sono stati rimossi.'}[r.status]||'Fonte non disponibile.');
   document.getElementById('citazioneTitolo').textContent=r.zainoTitolo+' › '+FontiNomi.visibile(r.file);
   pdfjsLib.GlobalWorkerOptions.workerSrc='assets/pdfjs/pdf.worker.min.mjs';
   var bus=new pdfjsViewer.EventBus(),link=new pdfjsViewer.PDFLinkService({eventBus:bus});
   var viewer=new pdfjsViewer.PDFViewer({container:document.getElementById('citazioneFrame'),viewer:document.getElementById('citazionePagine'),eventBus:bus,linkService:link,textLayerMode:1,annotationMode:0,annotationEditorMode:-1,removePageBorders:true});
   link.setViewer(viewer);
   var task=pdfjsLib.getDocument({data:new Uint8Array(r.bytes),isEvalSupported:false,enableXfa:false});delete r.bytes;
   var s={info:r,viewer:viewer,task:task,doc:null,destinazione:bersaglio,larghezza:0};stato=s;
   bus.on('pagesinit',function(){if(stato!==s)return;adattaLarghezza();viewer.currentPageNumber=r.pagina;controlli();});
   bus.on('pagechanging',controlli);bus.on('scalechanging',controlli);
   bus.on('textlayerrendered',function(e){selezionaPassaggio(s,e.pageNumber);});
   var doc=await task.promise;
   if(turno!==sequenza||!dialog.open){await doc.destroy();return;}
   if(r.pagina>doc.numPages)throw Error('La pagina citata non esiste in questo PDF.');
   s.doc=doc;link.setDocument(doc);viewer.setDocument(doc);
   doc.getPageLabels().then(function(v){if(stato===s){s.etichette=v;controlli();}}).catch(function(){});
   messaggio('Sola lettura · Lo zaino attivo e le fonti dell’AI restano invariati.');controlli();
  }catch(e){if(turno!==sequenza)return;pulisci();messaggio(e.message);controlli();}
 };
 var dialog=document.getElementById('citazioneDialog');
 icona('citazioneZoomOut','minus');icona('citazioneZoomIn','plus');icona('citazioneZoomLvl','move-horizontal');
 icona('citazioneChiudi','x');icona('citazionePrima','chevron-left');icona('citazioneDopo','chevron-right');
 // `close` arriva in coda: non deve distruggere un'anteprima già riaperta.
 dialog.addEventListener('close',function(){if(!dialog.open)pulisci();});
 document.getElementById('citazioneChiudi').onclick=chiudi;
 document.getElementById('citazioneZoomOut').onclick=function(){zoomPasso(false);};
 document.getElementById('citazioneZoomIn').onclick=function(){zoomPasso(true);};
 document.getElementById('citazioneZoomLvl').onclick=function(){if(stato?.doc)adatta(FontiZoom.prossimoAdatta(stato.viewer.currentScaleValue));};
 document.getElementById('citazioneConto').onclick=campoApri;
 document.getElementById('citazionePaginaIn').addEventListener('keydown',function(e){
  if(e.key==='Enter'){e.preventDefault();e.stopPropagation();campoVai();}
 });
 document.getElementById('citazionePaginaIn').addEventListener('blur',campoChiudi);
 window.addEventListener('keydown',function(e){if(e.key!=='Escape'||!dialog.open)return;e.preventDefault();e.stopPropagation();
  if(!document.getElementById('citazionePaginaIn').hidden){campoChiudi();frame.focus({preventScroll:true});}else chiudi();
 },true);
 document.getElementById('citazioneCitaPdf').onclick=function(){var md=markdownCitazione('pdf');if(md)inserisciMarkdown(md);};
 document.getElementById('citazioneCitaPagina').onclick=function(){var md=markdownCitazione('pagina');if(md)inserisciMarkdown(md);};
 document.getElementById('citazionePrima').onclick=function(){if(stato?.doc)stato.viewer.currentPageNumber--;};
 document.getElementById('citazioneDopo').onclick=function(){if(stato?.doc)stato.viewer.currentPageNumber++;};
 window.citazioneInserisciDaRange=function(range){
  if(!citazioneSelezione(range))return;var md=markdownCitazione('estratto',range);if(md)inserisciMarkdown(md);
 };
 document.getElementById('citazioneVai').onclick=apriOrigine;
 window.addEventListener('studia:zaino-changed',function(){if(dialog.open)chiudi();});
 new ResizeObserver(function(){
  if(!stato?.doc)return;
  var v=stato.viewer.currentScaleValue,w=frame.clientWidth;
  if(FontiZoom.daRiadattare(v,w,stato.larghezza)){stato.larghezza=w;stato.viewer.currentScaleValue=v;}
 }).observe(frame);
}());
