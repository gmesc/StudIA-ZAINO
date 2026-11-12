/* Lettori PDF indipendenti: nessuno scambio dello stato globale durante azioni asincrone. */
(function(){
 'use strict';
 const readers=new Map();
 function crea(n){
  const id='fonte'+n,prefisso='pdf'+n,template=document.getElementById('pdfPane2'),pane=template.cloneNode(true);
  pane.id='pdfPane'+n;pane.classList.add('fonte-extra');pane.dataset.fonte=id;pane.setAttribute('aria-label','Fonti');
  pane.querySelectorAll('[id]').forEach(e=>{e.id=e.id.replace(/^pdf2/,prefisso);});
  pane.querySelectorAll('[aria-controls]').forEach(e=>e.setAttribute('aria-controls',e.getAttribute('aria-controls').replace(/^pdf2/,prefisso)));
  pane.querySelector('#'+prefisso+'Frame').classList.add('fonte-extra-frame');
  pane.querySelector('#'+prefisso+'Host').classList.add('fonte-extra-host');
  pane.querySelector('#'+prefisso+'Righello').classList.add('fonte-extra-righello');
  pane.querySelector('#'+prefisso+'Evid').classList.add('fonte-evid');pane.querySelector('#'+prefisso+'Strati').classList.add('fonte-strati');
  for(const [suffix,cls]of [['PagN','fonte-pagina-numero'],['PagIn','fonte-pagina-input'],['ZoomLvl','fonte-zoom-livello'],['Doc','fonte-doc-scegli']])pane.querySelector('#'+prefisso+suffix).classList.add(cls);
  pane.querySelector('.pdfbar').removeAttribute('data-fonti-toolbar');
  template.after(pane);
  const $=sel=>document.querySelector(sel),el=id=>document.getElementById(id);
  const s={pronto:false,viewer:null,bus:null,link:null,doc:null,file:'',page:1,corso:'',operazione:0,ripresa:null,caricando:false,larghezza:0,CHIAVE:'studia.'+prefisso+'.zoom',righello:{acceso:false,bande:[],i:-1}};
function lettorePunti(corso){
  try{ return JSON.parse(localStorage.getItem('studia.banco.c.'+corso+'.'+id)||'{}')||{}; }catch(e){ return {}; }
}
function lettoreRicorda(){
  if(!s.doc || !s.file || !s.corso || s.caricando) return;
  var host=$('#'+prefisso+'Frame'), punti=lettorePunti(s.corso);
  punti[s.file]={ page:s.page, zoom:s.viewer.currentScaleValue,
    top:host?host.scrollTop:0, left:host?host.scrollLeft:0 };
  try{ localStorage.setItem('studia.banco.c.'+s.corso+'.'+id,JSON.stringify(punti)); }catch(e){}
}
function lettoreAperta(){ return !!s.doc; }
function lettoreZoomSalvato(){
  var v='';
  try{ v=localStorage.getItem(s.CHIAVE)||''; }catch(e){ return 'page-width'; }
  return FontiZoom.valido(v);
}
function lettoreZoomRicorda(v){ try{ localStorage.setItem(s.CHIAVE, String(v)); }catch(e){} }

function lettoreAvvia(){
  if(s.pronto) return true;
  if(!pdfjsCaricato()) return false;
  var host=$('#'+prefisso+'Frame'); if(!host) return false;
  var tela=host.querySelector('.pdfViewer'); if(!tela) return false;
  try{

    pdfjsLib.GlobalWorkerOptions.workerSrc='assets/pdfjs/pdf.worker.min.mjs';
    s.bus=new pdfjsViewer.EventBus();
    s.link=new pdfjsViewer.PDFLinkService({ eventBus:s.bus, externalLinkTarget:2, externalLinkRel:'noopener noreferrer' });
    s.find=new pdfjsViewer.PDFFindController({eventBus:s.bus,linkService:s.link});
    s.viewer=new pdfjsViewer.PDFViewer({
      container:host, viewer:tela,
      eventBus:s.bus, linkService:s.link, findController:s.find,
      textLayerMode:1,
      annotationMode:1,
      annotationEditorMode:-1,         // stessa lezione della fonte: niente «timbri»
      removePageBorders:true,          // «riempi larghezza» riempie: il perché sta in `pdfjsAvvia`
      imageResourcesPath:'assets/pdfjs/images/'
    });
    s.link.setViewer(s.viewer);
    s.bus.on('pagesinit', function(){
      try{ s.viewer.currentScaleValue=s.ripresa?FontiZoom.valido(s.ripresa.zoom):lettoreZoomSalvato(); }
      catch(e){ try{ s.viewer.currentScaleValue='page-width'; }catch(e2){} }
      s.larghezza=$('#'+prefisso+'Frame') ? $('#'+prefisso+'Frame').clientWidth : 0;
      var pagina=(s.ripresa&&s.ripresa.page)||s.page;
      if(pagina>1){ try{ s.viewer.currentPageNumber=Math.min(pagina,s.doc.numPages); }catch(e){} }
      var ripresa=s.ripresa, op=s.operazione;
      requestAnimationFrame(function(){
        if(op!==s.operazione) return;
        var h=$('#'+prefisso+'Frame');
        if(h && ripresa){ h.scrollTop=ripresa.top||0; h.scrollLeft=ripresa.left||0; }
        s.caricando=false; s.ripresa=null; lettoreRicorda();
      });
      lettoreAggiorna();
    });
    s.bus.on('scalechanging', function(){ lettoreAggiorna(); lettoreRicorda(); });
    s.bus.on('pagechanging', function(e){
      if(e && e.pageNumber){ s.page=e.pageNumber; lettoreAggiorna(); lettoreRicorda(); }
    });
    fontiFindEventi(s.bus,id);
    s.bus.on('textlayerrendered',function(e){
      pdfSpaziaLayer(e.pageNumber,id); evPdfScade(e.pageNumber); evidenzeDisegna();
    });
    s.pronto=true;
    return true;
  }catch(err){
    console.error(id+': avvio fallito', err);
    return false;
  }
}


async function lettoreApri(file, opt){
  if(!file) return;
  opt=opt||{};
  if(!lettoreAvvia()){ toast('Il visualizzatore del documento non si è avviato', false); return; }
  lettoreRicorda();
  if(TTS.pdfSeconda===id&&voceInCorso())voceFerma();
  if(PDFFIND.seconda===id)pdfFindChiudi();
  righelloAccendi(false,id);
  var corso=corsoAttivo(), op=++s.operazione;
  var url=(window.vault&&window.vault.srcUrl)?window.vault.srcUrl(file,corso):('../Fonti/'+encodeURIComponent(file));
  try{
    var doc=await pdfjsLib.getDocument({ url:url, isEvalSupported:false, enableXfa:false }).promise;
    if(op!==s.operazione || corso!==corsoAttivo()){ doc.destroy(); return; }
    if(s.doc){ try{ s.doc.destroy(); }catch(e){} }
    s.ripresa=lettorePunti(corso)[file]||null;
    if(opt.pagina)s.ripresa={page:opt.pagina,zoom:s.ripresa?.zoom||lettoreZoomSalvato()};
    s.caricando=true; s.doc=doc; s.file=file; s.corso=corso;
    s.page=(s.ripresa&&s.ripresa.page)||1;
    s.viewer.setDocument(doc); s.link.setDocument(doc,null); s.find.setDocument(doc);
  }catch(e){
    if(op===s.operazione && corso===corsoAttivo()) toast('Il documento non si è potuto aprire: '+((e&&e.message)||e),false);
    return;
  }
  apertoScrivi(id,file);
  if(!opt.ripristina){ try{ bancoMostra(id); }catch(e){} }
  lettoreAggiorna();
}
function lettoreChiudi(conserva){
  if(PDFFIND.seconda===id)pdfFindChiudi();
  righelloAccendi(false,id);
  if(TTS.pdfSeconda===id&&voceInCorso())voceFerma();
  lettoreRicorda(); s.operazione++;
  if(!conserva) apertoScrivi(id,'');
  if(s.doc){ try{ s.doc.destroy(); }catch(e){} }
  s.doc=null; s.file=''; s.page=1; s.corso=''; s.ripresa=null; s.caricando=false;
  try{ if(s.viewer) s.viewer.setDocument(null); }catch(e){}
  lettoreAggiorna(); evPdfScade(); evidenzeDisegna();
}


function lettoreAggiorna(){
  bancoAggiornaDocumenti();
  var pane=$('#pdfPane'+n); if(!pane) return;
  var aperta=lettoreAperta();
  aggiornaToolbar();
  pane.dataset.doc=aperta?'1':'0';

  var sel=$('#'+prefisso+'Doc');
  if(sel){
    var nome=aperta ? (titoloMateriale(s.file)||s.file) : '';
    sel.innerHTML='<span class="ui-documento">'+escHtml(nome || 'Documenti')+'</span>'+UiIcone.svg('chevron-down');
    var dice=nome ? (nome+' — premi per cambiarlo') : 'Scegli un documento';
    sel.title=dice; sel.setAttribute('aria-label', dice);
  }
  var vuoto=$('#'+prefisso+'Vuoto'); if(vuoto) vuoto.hidden=aperta;
  var pag=$('#'+prefisso+'Pag'), zoom=$('#'+prefisso+'Zoom'), chiudi=$('#'+prefisso+'Close');
  if(pag){pag.hidden=false;pag.querySelectorAll('button').forEach(function(b){b.disabled=!aperta;});}
  if(zoom){zoom.hidden=false;zoom.querySelectorAll('button').forEach(function(b){b.disabled=!aperta;});}
  if(chiudi){chiudi.hidden=false;chiudi.disabled=!aperta;}
  var numero=$('#'+prefisso+'PagN');if(numero)numero.textContent=FontiPagina.etichetta(aperta?s.page:null,{numPages:s.doc?.numPages||0});
  if(!aperta)return;
  var lvl=$('#'+prefisso+'ZoomLvl');
  if(lvl){
    var e=FontiZoom.comandoPdf(s.viewer && s.viewer.currentScaleValue,
                              s.viewer && s.viewer.currentScale, true);
    UiIcone.imposta(lvl,e.icona);lvl.title=e.titolo;lvl.setAttribute('aria-label',e.titolo);
  }
}
function lettorePagina(avanti){
  if(!lettoreAperta()) return;
  var n=(s.viewer.currentPageNumber||1)+(avanti?1:-1);
  n=Math.max(1, Math.min(s.doc.numPages, n));
  try{ s.viewer.currentPageNumber=n; }catch(e){}
}
function lettoreZoomPasso(su){
  if(!lettoreAperta()) return;
  var n=FontiZoom.passo(s.viewer.currentScale||1, su);
  if(n===null) return;
  try{ s.viewer.currentScaleValue=String(n); }catch(e){ return; }
  lettoreZoomRicorda(n); lettoreAggiorna();
}
function lettoreZoomAdatta(larghezza){
  if(!lettoreAperta()) return;
  var nuovo=larghezza===true?'page-width':FontiZoom.prossimoAdatta(s.viewer.currentScaleValue);
  try{ s.viewer.currentScaleValue=nuovo; }catch(e){ return; }
  s.larghezza=$('#'+prefisso+'Frame') ? $('#'+prefisso+'Frame').clientWidth : 0;
  lettoreZoomRicorda(nuovo); lettoreAggiorna();
}

function lettoreRiadatta(){
  if(!lettoreAperta() || !s.viewer) return;
  var host=$('#'+prefisso+'Frame'); if(!host) return;
  var v=s.viewer.currentScaleValue;
  if(!FontiZoom.daRiadattare(v, host.clientWidth, s.larghezza)) return;
  s.larghezza=host.clientWidth;
  try{ s.viewer.currentScaleValue=v; }catch(e){}
}


async function lettorePannello(btn){
  var pop=$('#pdfDocPop'); if(!pop) return;
  var corsoMenu=corsoAttivo();
  if(!corsoMenu){ toast('Apri un corso o uno zaino', false); return; }
  var docs=await documentiPdf(corsoMenu);if(corsoMenu!==corsoAttivo())return;
  if(!docs.length){
    pop.innerHTML='<div class="pd-vuoto">Nessun documento in questo contenitore.</div>';
  } else {
    pop.innerHTML=docs.map(function(d){
      var attivo=(d.name===s.file);
      return '<button type="button" class="pd-voce'+(attivo?' attivo':'')+'" data-fonte-extra="'+id+'" data-file="'+escHtml(d.name)+'">'+
        escHtml(titoloMateriale(d.name)||d.name)+'</button>';
    }).join('');
  }
  popAt(pop, btn);
}

(function(){
  function attacca(){
    var scroller=document.getElementById(prefisso+'Frame'), salvaTimer;
    if(scroller) scroller.addEventListener('scroll',function(){ clearTimeout(salvaTimer); salvaTimer=setTimeout(lettoreRicorda,250); },{passive:true});
    window.addEventListener('beforeunload',lettoreRicorda);
    if(typeof ResizeObserver==='function'){
      var el=document.getElementById(prefisso+'Frame');
      if(el){
        var atteso=0;
        new ResizeObserver(function(){
          if(atteso) return;
          atteso=requestAnimationFrame(function(){ atteso=0; lettoreRiadatta(); });
        }).observe(el);
      }
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', attacca); else attacca();

  document.addEventListener('click', function(e){
    if(!e.target.closest) return;
    if(e.target.closest('#'+prefisso+'Doc')){ lettorePannello(e.target.closest('#'+prefisso+'Doc')); return; }
    var voce=e.target.closest('#pdfDocPop .pd-voce[data-fonte-extra="'+id+'"]');
    if(voce){ closePops(); lettoreApri(voce.getAttribute('data-file')); return; }
    if(e.target.closest('#'+prefisso+'Prev')){ lettorePagina(false); return; }
    if(e.target.closest('#'+prefisso+'Next')){ lettorePagina(true); return; }
    if(e.target.closest('#'+prefisso+'ZoomIn')){ lettoreZoomPasso(true); return; }
    if(e.target.closest('#'+prefisso+'ZoomOut')){ lettoreZoomPasso(false); return; }
    if(e.target.closest('#'+prefisso+'ZoomLvl')){ lettoreZoomAdatta(); return; }
    if(e.target.closest('#'+prefisso+'Close')){ lettoreChiudi(); return; }
  });

})();

 const icone={Tinta:'palette',RighelloBtn:'ruler',Voce:'play',Evid:'eye',Strati:'layers',Ritaglia:'scissors',FindBtn:'search',Ocr:'scan-text',Rinomina:'pencil',Elimina:'trash-2'};
 Object.entries({Prev:'chevron-left',Next:'chevron-right',ZoomIn:'plus',ZoomOut:'minus',ZoomLvl:'move-horizontal',Close:'x'}).forEach(([nome,icona])=>UiIcone.imposta(el(prefisso+nome),icona));
 Object.entries(icone).forEach(([nome,icona])=>UiIcone.imposta(el(prefisso+nome),icona));
 let infoDoc=null,etichette=null;
 function chiudiPagina(){
  el(prefisso+'PagIn').hidden=true;el(prefisso+'PagN').hidden=false;el(prefisso+'PagN').setAttribute('aria-expanded','false');
 }
 function aggiornaToolbar(){
  const c=fonteLettore(id),aperta=!!c.doc;
  Object.keys(icone).forEach(n=>{const b=el(prefisso+n);b.hidden=false;b.disabled=!aperta;});
  ['Ocr','Rinomina','Elimina'].forEach(n=>el(prefisso+n).hidden=modoAttivo()!=='zaino');
  const ocr=el(prefisso+'Ocr'),inCorso=OCRZ?.inCorso&&OCRZ.doc===c.file;
  ocr.disabled=!aperta||(!inCorso&&(OCRZ?.inCorso||!ocrDocOfferta(c.file)));
  UiIcone.imposta(ocr,inCorso?'square':'scan-text');ocr.setAttribute('aria-pressed',String(!!inCorso));
  ocr.title=inCorso?'Ferma il riconoscimento del testo':'Riconosci il testo di questo documento fotografato';ocr.setAttribute('aria-label',ocr.title);
  const voce=el(prefisso+'Voce'),legge=voceInCorso()&&TTS.pdfSeconda===id;
  voce.hidden=!ttsSistema();UiIcone.imposta(voce,legge?'square':'play');
  voce.title=legge?'Ferma la lettura':'Leggi ad alta voce questa pagina';voce.setAttribute('aria-label',voce.title);voce.classList.toggle('acceso',!!legge);
  const tinta=el(prefisso+'Tinta'),ora=AspettoStanza.tinta(document.documentElement.dataset.tinta);
  tinta.title='Tinta del foglio: '+tintaNome(ora)+' · palette Tailwind';tinta.setAttribute('aria-label',tinta.title);tinta.classList.toggle('acceso',ora!=='nessuna');
  righelloAggiorna(id);
  if(!aperta)chiudiPagina();
  if(infoDoc!==c.doc){
   infoDoc=c.doc;etichette=null;chiudiPagina();
   if(c.doc)c.doc.getPageLabels().then(v=>{if(infoDoc===c.doc){etichette=v;aggiornaToolbar();}}).catch(()=>{});
  }
  const pagina=el(prefisso+'PagN');pagina.title=FontiPagina.suggerimento(c.pagina,{etichette});pagina.setAttribute('aria-label',pagina.title);
 }
 document.addEventListener('click',e=>{
  const b=e.target.closest?.('button');if(!b)return;
  const c=fonteLettore(id);
  switch(b.id.startsWith(prefisso)?'pdf2'+b.id.slice(prefisso.length):''){
   case 'pdf2Tinta': tintaScegli(b);break;
   case 'pdf2RighelloBtn':righelloAccendi(!s.righello.acceso,id);break;
   case 'pdf2Voce':voceAvvia(id);break;
   case 'pdf2Ritaglia':albumRitaglioModo();break;
   case 'pdf2FindBtn':
    if(PDFFIND.seconda===id&&(el('pdfFindPop').hasAttribute('open')||pdfFindAccesa()))pdfFindChiudi();else pdfFindApri({seconda:id});break;
   case 'pdf2Ocr':if(OCRZ.inCorso&&OCRZ.doc===c.file)OCRZ.ferma=true;else if(c.file)ocrRiconosci(c.file);break;
   case 'pdf2Rinomina':fonteRinomina(id);break;
   case 'pdf2Elimina':fonteElimina(id);break;
   case 'pdf2PagN':if(c.doc){const i=el(prefisso+'PagIn');b.hidden=true;b.setAttribute('aria-expanded','true');i.hidden=false;i.value=etichette?.[c.pagina-1]||String(c.pagina);i.focus();i.select();}break;
   default:if(!e.target.closest('#'+prefisso+'Pag'))chiudiPagina();
  }
 });
 el(prefisso+'PagIn').addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();chiudiPagina();el(prefisso+'PagN').focus();}
  if(e.key!=='Enter')return;
  e.preventDefault();const c=fonteLettore(id),n=FontiPagina.leggi(e.target.value,{numPages:c.doc?.numPages,etichette});
  if(n===null){toast('Scrivi un numero di pagina valido',false);return;}
  if(c.doc)c.viewer.currentPageNumber=n;chiudiPagina();el(prefisso+'PagN').focus();
 });

  const api={id,prefisso,stato:s,apri:lettoreApri,chiudi:lettoreChiudi,aggiorna:lettoreAggiorna,aggiornaToolbar,ricordaZoom:lettoreZoomRicorda,adatta:lettoreRiadatta,pagina:lettorePagina};readers.set(id,api);
  return api;
 }
 window.FontiMultipli={tutti:()=>[...readers.values()],get:id=>readers.get(id)};
 for(let n=3;n<=9;n++)crea(n);
 window.addEventListener('DOMContentLoaded',()=>readers.forEach(c=>{
  FontiGesti.registra(c.prefisso+'Frame',()=>c.stato.doc?{viewer:c.stato.viewer,ricorda:c.ricordaZoom,aggiorna:c.aggiorna,adatta:()=>{c.stato.viewer.currentScaleValue=FontiZoom.prossimoAdatta(c.stato.viewer.currentScaleValue);c.aggiorna();}}:null);
  AnnotazioniUI.crea('pdfPane'+c.id.slice(5),c.prefisso+'Frame',()=>({viewer:c.stato.viewer,bus:c.stato.bus,file:c.stato.file}));
  c.aggiorna();
 }));
})();
