/* La seconda Fonte usa gli stessi comandi e servizi. Il documento resta del suo
 * lettore: mai scambiare ANTEPRIMA per far funzionare un bottone asincrono. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const modello=document.querySelector('#pdfPane .pdfbar'),barra=document.querySelector('[data-fonti-toolbar="seconda"]');
 if(!modello||!barra)return;
 // Un solo markup: anche altezza, separatori, tooltip e ordine seguono la Fonte.
 const copia=modello.cloneNode(true);
 copia.querySelectorAll('[id]').forEach(e=>{e.id=e.id.replace(/^pdf/,'pdf2');});
 barra.replaceChildren(...copia.childNodes);
 const icone={Tinta:'palette',RighelloBtn:'ruler',Voce:'play',Evid:'eye',Strati:'layers',Ritaglia:'scissors',FindBtn:'search',Ocr:'scan-text',Rinomina:'pencil',Elimina:'trash-2'};
 Object.entries(icone).forEach(([nome,icona])=>UiIcone.imposta($('pdf2'+nome),icona));
 let infoDoc=null,etichette=null;
 function chiudiPagina(){
  $('pdf2PagIn').hidden=true;$('pdf2PagN').hidden=false;$('pdf2PagN').setAttribute('aria-expanded','false');
 }
 function aggiorna(){
  const c=fonteLettore(true),aperta=!!c.doc;
  Object.keys(icone).forEach(n=>{const b=$('pdf2'+n);b.hidden=false;b.disabled=!aperta;});
  ['Ocr','Rinomina','Elimina'].forEach(n=>$('pdf2'+n).hidden=modoAttivo()!=='zaino');
  const ocr=$('pdf2Ocr'),inCorso=OCRZ?.inCorso&&OCRZ.doc===c.file;
  ocr.disabled=!aperta||(!inCorso&&(OCRZ?.inCorso||!ocrDocOfferta(c.file)));
  UiIcone.imposta(ocr,inCorso?'square':'scan-text');ocr.setAttribute('aria-pressed',String(!!inCorso));
  ocr.title=inCorso?'Ferma il riconoscimento del testo':'Riconosci il testo di questo documento fotografato';ocr.setAttribute('aria-label',ocr.title);
  const voce=$('pdf2Voce'),legge=voceInCorso()&&TTS.pdfSeconda===true;
  voce.hidden=!ttsSistema();UiIcone.imposta(voce,legge?'square':'play');
  voce.title=legge?'Ferma la lettura':'Leggi ad alta voce questa pagina';voce.setAttribute('aria-label',voce.title);voce.classList.toggle('acceso',!!legge);
  const tinta=$('pdf2Tinta'),ora=AspettoStanza.tinta(document.documentElement.dataset.tinta);
  tinta.title='Tinta del foglio: '+tintaNome(ora)+' · palette Tailwind';tinta.setAttribute('aria-label',tinta.title);tinta.classList.toggle('acceso',ora!=='nessuna');
  righelloAggiorna(true);
  if(!aperta)chiudiPagina();
  if(infoDoc!==c.doc){
   infoDoc=c.doc;etichette=null;chiudiPagina();
   if(c.doc)c.doc.getPageLabels().then(v=>{if(infoDoc===c.doc){etichette=v;aggiorna();}}).catch(()=>{});
  }
  const pagina=$('pdf2PagN');pagina.title=FontiPagina.suggerimento(c.pagina,{etichette});pagina.setAttribute('aria-label',pagina.title);
 }
 document.addEventListener('click',e=>{
  const b=e.target.closest?.('button');if(!b)return;
  const c=fonteLettore(true);
  switch(b.id){
   case 'pdf2Tinta': tintaScegli(b);break;
   case 'pdf2RighelloBtn':righelloAccendi(!RIGHELLO2.acceso,true);break;
   case 'pdf2Voce':voceAvvia(true);break;
   case 'pdf2Ritaglia':albumRitaglioModo();break;
   case 'pdf2FindBtn':
    if(PDFFIND.seconda===true&&($('pdfFindPop').hasAttribute('open')||pdfFindAccesa()))pdfFindChiudi();else pdfFindApri({seconda:true});break;
   case 'pdf2Ocr':if(OCRZ.inCorso&&OCRZ.doc===c.file)OCRZ.ferma=true;else if(c.file)ocrRiconosci(c.file);break;
   case 'pdf2Rinomina':fonteRinomina(true);break;
   case 'pdf2Elimina':fonteElimina(true);break;
   case 'pdf2PagN':if(c.doc){const i=$('pdf2PagIn');b.hidden=true;b.setAttribute('aria-expanded','true');i.hidden=false;i.value=etichette?.[c.pagina-1]||String(c.pagina);i.focus();i.select();}break;
   default:if(!e.target.closest('#pdf2Pag'))chiudiPagina();
  }
 });
 $('pdf2PagIn').addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();chiudiPagina();$('pdf2PagN').focus();}
  if(e.key!=='Enter')return;
  e.preventDefault();const c=fonteLettore(true),n=FontiPagina.leggi(e.target.value,{numPages:c.doc?.numPages,etichette});
  if(n===null){toast('Scrivi un numero di pagina valido',false);return;}
  if(c.doc)c.viewer.currentPageNumber=n;chiudiPagina();$('pdf2PagN').focus();
 });
 window.FonteSecondaUI={aggiorna};
 document.addEventListener('DOMContentLoaded',aggiorna,{once:true});
}());
