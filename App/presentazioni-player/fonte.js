/* Anteprima PDF in sola lettura nel player isolato: nessuna API generale del vault. */
(function(){
 'use strict';
 window.PresentaFonte={crea({leggi,prima,dopo}){
  let dialog=null,viewer=null,task=null,documento=null,giro=0,chiusura=null,ritorno=null;
  const el=(tag,testo)=>{const e=document.createElement(tag);if(testo)e.textContent=testo;return e;};
  async function chiudi(){
   if(!dialog||chiusura)return chiusura;
   const d=dialog;giro++;chiusura=(async()=>{
    try{viewer?.setDocument(null);await task?.destroy();}finally{
     viewer=null;task=null;documento=null;await dopo();d.close();d.remove();dialog=null;chiusura=null;ritorno?.focus({preventScroll:true});
    }
   })();return chiusura;
  }
  async function apri(richiesta){
   if(dialog)return;const turno=++giro;ritorno=document.activeElement;
   dialog=el('dialog');dialog.className='presenta-fonte';dialog.setAttribute('aria-labelledby','presentaFonteTitolo');
   const titolo=el('strong','Fonte della slide');titolo.id='presentaFonteTitolo';
   const header=el('div');header.className='presenta-fonte-barra';header.append(titolo);
   const controlli=el('div');controlli.className='presenta-fonte-barra';
   const messaggio=el('p','Controllo la fonte…');messaggio.className='presenta-fonte-stato';messaggio.setAttribute('role','status');
   const area=el('div'),frame=el('div'),pagine=el('div');area.className='presenta-fonte-area';frame.className='presenta-fonte-frame';frame.tabIndex=0;frame.setAttribute('aria-label','Anteprima della fonte PDF');pagine.className='pdfViewer';frame.append(pagine);area.append(frame);
   function bottone(nome,testo,azione,barra=controlli){const b=el('button',testo);b.type='button';b.className='tbtn';b.setAttribute('aria-label',nome);b.title=nome;b.onclick=azione;barra.append(b);return b;}
   const chiudiBt=bottone('Chiudi la fonte','',chiudi,header);chiudiBt.innerHTML=UiIcone.svg('x');
   const precedente=bottone('Pagina precedente','‹',()=>{viewer.currentPageNumber--;aggiorna();}),conto=el('output');conto.setAttribute('aria-label','Pagina della fonte');controlli.append(conto);
   const successiva=bottone('Pagina successiva','›',()=>{viewer.currentPageNumber++;aggiorna();});
   const meno=bottone('Riduci PDF','−',()=>zoom(-1)),adatta=bottone('Adatta PDF','Adatta',()=>{viewer.currentScaleValue='page-width';aggiorna();}),piu=bottone('Ingrandisci PDF','+',()=>zoom(1));
   function zoom(verso){viewer.currentScale=Math.max(.25,Math.min(4,viewer.currentScale*(verso>0?1.2:1/1.2)));aggiorna();}
   function aggiorna(){const n=documento?.numPages||0,p=viewer?.currentPageNumber||0;conto.textContent=n?p+' di '+n:'− di −';precedente.disabled=!n||p<=1;successiva.disabled=!n||p>=n;for(const b of [meno,adatta,piu])b.disabled=!n;}
   dialog.append(header,controlli,messaggio,area);dialog.addEventListener('cancel',e=>{e.preventDefault();chiudi();});document.body.append(dialog);aggiorna();prima();dialog.showModal();header.querySelector('button').focus();
   try{
    const r=await leggi(richiesta);if(turno!==giro)return;if(!r.ok)throw Error(r.error);
    const info=r.fonte;if(info.status!=='available')throw Error({removed:'La fonte non è più disponibile.',changed:'La fonte è cambiata: la versione citata non è più disponibile.',ambiguous:'Non posso individuare lo zaino della fonte.'}[info.status]||'Fonte non disponibile.');
    const nome=FontiNomi.titoloAnteprima(info.zainoTitolo,info.file);
    titolo.textContent=nome.testo;titolo.title=nome.completo;titolo.setAttribute('aria-label',nome.completo);
    // Gli stessi pdf.js e PDFViewer del lettore principale; dati verificati dal main.
    if(!document.querySelector('[data-pdf-fonte-stile]')){const css=el('link');css.rel='stylesheet';css.href=new URL('../assets/pdfjs/pdf_viewer.css',location.href).href;css.dataset.pdfFonteStile='1';await new Promise((ok,ko)=>{css.onload=ok;css.onerror=()=>ko(Error('Stile PDF non disponibile.'));document.head.append(css);});}
    if(turno!==giro)return;const pdf=await import('../assets/pdfjs/pdf.min.mjs');if(turno!==giro)return;window.pdfjsLib=pdf;
    pdf.GlobalWorkerOptions.workerSrc=new URL('../assets/pdfjs/pdf.worker.min.mjs',location.href).href;
    const PV=await import('../assets/pdfjs/pdf_viewer.mjs');if(turno!==giro)return;
    const bus=new PV.EventBus(),link=new PV.PDFLinkService({eventBus:bus});
    viewer=new PV.PDFViewer({container:frame,viewer:pagine,eventBus:bus,linkService:link,textLayerMode:1,annotationMode:0,annotationEditorMode:-1,removePageBorders:true});link.setViewer(viewer);
    const carico=pdf.getDocument({data:new Uint8Array(info.bytes),isEvalSupported:false,enableXfa:false});task=carico;
    const doc=await carico.promise;if(turno!==giro){await doc.destroy();return;}documento=doc;
    if(info.pagina>doc.numPages)throw Error('La pagina citata non esiste nel PDF.');
    bus.on('pagesinit',()=>{if(turno!==giro)return;viewer.currentScaleValue='page-width';viewer.currentPageNumber=info.pagina;aggiorna();});bus.on('pagechanging',aggiorna);
    bus.on('textlayerrendered',e=>{
     if(turno!==giro||!info.selezione||e.pageNumber!==info.pagina)return;
     const layer=pagine.querySelector('.page[data-page-number="'+info.pagina+'"] .textLayer');if(!layer)return;
     const trovato=RimandiSintassi.trovaSelezione(layer.textContent,info.selezione);if(!trovato)return;const pos=trovato.inizio,testo=layer.textContent.slice(pos,trovato.fine);
     const walk=document.createTreeWalker(layer,NodeFilter.SHOW_TEXT),r=document.createRange();let n,offset=0,avviato=false;
     while((n=walk.nextNode())){const fine=offset+n.length;if(!avviato&&pos<fine){r.setStart(n,pos-offset);avviato=true;}if(avviato&&pos+testo.length<=fine){r.setEnd(n,pos+testo.length-offset);getSelection().removeAllRanges();getSelection().addRange(r);break;}offset=fine;}
    });
    link.setDocument(doc);viewer.setDocument(doc);messaggio.textContent='Sola lettura · Chiudi per continuare dallo stesso punto della presentazione.';aggiorna();
   }catch(e){if(turno===giro)messaggio.textContent=e.message;}
  }
  return {apri,chiudi,aperta:()=>!!dialog};
 }};
})();
