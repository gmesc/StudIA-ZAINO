/* I simboli dei comandi sono SVG locali. Le etichette e i numeri restano testo. */
(function(root){
 'use strict';
 function appunti(host){
  var comandi={'.bold':['bold','Grassetto'],'.italic':['italic','Corsivo'],'.heading':['heading','Titolo'],'.quote':['quote','Citazione'],'.unordered-list':['list','Elenco puntato'],'.ordered-list':['list-ordered','Elenco numerato'],'.link':['external-link','Inserisci collegamento'],'.code':['code','Codice'],'.preview':['eye','Anteprima'],'.side-by-side':['columns-2','Testo e anteprima affiancati'],'.ncb-undo':['undo-2','Annulla'],'.ncb-redo':['redo-2','Ripeti'],'.ncb-callout':['notebook-text','Inserisci un riquadro'],'.ncb-emoji':['smile','Inserisci un’emoji'],'.ncb-guida':['help-circle','Guida alla scrittura'],'.ncb-cita':['bookmark','Cita il punto corrente'],'.ncb-mat':['paperclip','Cita un materiale'], '[id^="noteNew"]':['plus','Nuovo appunto'],'[id^="noteSave"]':['save','Salva appunto'],'[id^="noteRen"]':['pencil','Rinomina appunto'],'[id^="noteDel"]':['trash-2','Elimina appunto'],'[id^="noteStampa"]':['printer','Stampa appunto'],'[id^="notePdf"]':['file-down','Salva appunto in PDF'],'[id^="noteClose"]':['x','Chiudi l’appunto']};
  Object.keys(comandi).forEach(function(sel){
   var b=host.querySelector('.editor-toolbar '+sel),v=comandi[sel];if(!b)return;
   var titolo=b.title||v[1];
   // EasyMDE fornisce il gesto in inglese: teniamo solo la sua scorciatoia.
   if(sel.indexOf('.ncb-')!==0 && sel.indexOf('[id')!==0){
    var tasto=titolo.match(/\([^)]*\)$/);titolo=v[1]+(tasto?' '+tasto[0]:'');
    b.setAttribute('aria-label',titolo);
   }
   root.UiIcone.imposta(b,v[0],titolo);
  });
 }
 root.UiToolbar={appunti:appunti};
 function inizializza(){
  var icone={searchBtn:'search',bancoBtn:'columns-2',settingsBtn:'settings',albumCerca:'search',albumOrdine:'chevron-down',plGiu:'chevrons-left',plPlay:'play',plSu:'chevrons-right',plRitaglia:'scissors',plNota:'notebook-pen',plElimina:'trash-2',plClose:'x',fotoIndietro:'x',fotoZoomOut:'minus',fotoZoomLvl:'move-horizontal',fotoZoomIn:'plus',fotoRitaglia:'scissors',stratiNuovo:'plus',pdfFindPrev:'chevron-left',pdfFindNext:'chevron-right',pdfFindClose:'x',riquadriClose:'x',guidaClose:'x',creditsClose:'x',settingsClose:'x',costsRefresh:'refresh-cw',costsClose:'x',mediaRefresh:'refresh-cw',mediaClose:'x',wzClose:'x',cmpClose:'x',atlChiudi:'x',pdfPrev:'chevron-left',pdfNext:'chevron-right',pdfTinta:'palette',pdfRighelloBtn:'ruler',pdfVoce:'play',pdfZoomOut:'minus',pdfZoomLvl:'move-horizontal',pdfZoomIn:'plus',pdfEvid:'eye',pdfStrati:'layers',pdfRitaglia:'scissors',pdfFindBtn:'search',pdfOcr:'scan-text',pdfRinomina:'pencil',pdfElimina:'trash-2',pdfClose:'x',pdf2Prev:'chevron-left',pdf2Next:'chevron-right',pdf2ZoomOut:'minus',pdf2ZoomLvl:'move-horizontal',pdf2ZoomIn:'plus',pdf2Close:'x',kwEvid:'eye',mCopia:'plus',mNuova:'plus',mRinomina:'pencil',mCestino:'trash-2',mAnnulla:'undo-2',mRipeti:'redo-2',mVista:'settings',mStampa:'printer',mPdf:'file-down',mAdatta:'maximize',mChiudi:'x'};
  Object.keys(icone).forEach(function(id){root.UiIcone.imposta(document.getElementById(id),icone[id]);});
  document.querySelectorAll('.helpbtn').forEach(function(b){root.UiIcone.imposta(b,'help-circle');});
  document.querySelectorAll('[data-ui-icona]').forEach(function(b){root.UiIcone.imposta(b,b.dataset.uiIcona);});
  ['sun','moon'].forEach(function(n){var e=document.querySelector('#themeToggle .i-'+n);if(e)e.innerHTML=root.UiIcone.svg(n);});
  var menu=document.getElementById('menuBtn');if(menu&&!menu.title)menu.title=menu.getAttribute('aria-label');
  var guida=document.getElementById('setGuida');if(guida){guida.innerHTML=root.UiIcone.svg('book-open')+'<span>Apri la guida allo ZAINO</span>';guida.title='Apri la guida allo ZAINO';}
  var costi=document.getElementById('openCosts');if(costi){costi.innerHTML=root.UiIcone.svg('chart-column')+'<span>Dashboard costi</span>';costi.title='Consulta i costi delle richieste AI';}
  ['plus','minus','check','x','chevron-down','chevron-right','external-link','play'].forEach(function(n){document.documentElement.style.setProperty('--icon-'+n,'url("'+root.UiIcone.uri(n)+'")');});
  document.querySelectorAll('#mOrient button').forEach(function(b){root.UiIcone.imposta(b,b.dataset.orient==='td'?'arrow-down':'arrow-right');});
  document.querySelectorAll('#mMotore button').forEach(function(b){root.UiIcone.imposta(b,({albero:'list-tree',dag:'network',percorso:'route',anelli:'network'})[b.dataset.motore]);});
  if(typeof root.evidenzeBottoni==='function')root.evidenzeBottoni();
  if(typeof root.keywordDisegna==='function')root.keywordDisegna();
  if(typeof root.aggiornaBarraPagina==='function')root.aggiornaBarraPagina();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inizializza);else inizializza();
}(window));
