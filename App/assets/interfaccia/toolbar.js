/* I simboli dei comandi sono SVG locali. Le etichette e i numeri restano testo. */
(function(root){
 'use strict';
 function inizializza(){
  var icone={pdfPrev:'chevron-left',pdfNext:'chevron-right',pdfTinta:'palette',pdfRighelloBtn:'ruler',pdfVoce:'play',pdfZoomOut:'minus',pdfZoomLvl:'move-horizontal',pdfZoomIn:'plus',pdfEvid:'eye',pdfStrati:'layers',pdfRitaglia:'scissors',pdfFindBtn:'search',pdfOcr:'scan-text',pdfRinomina:'pencil',pdfElimina:'trash-2',pdfClose:'x',pdf2Prev:'chevron-left',pdf2Next:'chevron-right',pdf2ZoomOut:'minus',pdf2ZoomLvl:'move-horizontal',pdf2ZoomIn:'plus',pdf2Close:'x',kwEvid:'eye',mCopia:'plus',mNuova:'plus',mRinomina:'pencil',mCestino:'trash-2',mAnnulla:'undo-2',mRipeti:'redo-2',mVista:'settings',mStampa:'printer',mPdf:'file-down',mAdatta:'maximize',mChiudi:'x'};
  Object.keys(icone).forEach(function(id){root.UiIcone.imposta(document.getElementById(id),icone[id]);});
  document.querySelectorAll('#mOrient button').forEach(function(b){root.UiIcone.imposta(b,b.dataset.orient==='td'?'arrow-down':'arrow-right');});
  document.querySelectorAll('#mMotore button').forEach(function(b){root.UiIcone.imposta(b,({albero:'list-tree',dag:'network',percorso:'route',anelli:'network'})[b.dataset.motore]);});
  if(typeof root.evidenzeBottoni==='function')root.evidenzeBottoni();
  if(typeof root.keywordDisegna==='function')root.keywordDisegna();
  if(typeof root.aggiornaBarraPagina==='function')root.aggiornaBarraPagina();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inizializza);else inizializza();
}(window));
