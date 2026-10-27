/* Le etichette hanno lo stesso peso nella scheda e nella copia personale. */
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.ZainoSchedeTesto=factory();
}(typeof self!=='undefined'?self:this,function(){
 'use strict';
 function etichette(text){
  return String(text||'').replace(/^([ \t]*(?:(?:[-+*]|\d+[.)])[ \t]+)?)([\p{L}][\p{L}\p{N} /’'()-]{0,59}):(?=[ \t]|$)/gmu,'$1**$2:**');
 }
 /** Si scartano solo blocchi riconoscibili: una pagina mista resta leggibile al modello. */
 function soloParatesto(text){
  const righe=String(text||'').split(/\r?\n/).map(r=>r.trim()).filter(Boolean);
  const editoriale=r=>r.length<180&&/^(?:©|copyright\s*(?:©|\d)|isbn\b|issn\b|tutti i diritti riservati|all rights reserved|diritti di (?:traduzione|riproduzione)|(?:prima|seconda|terza|\d+[ªa]) edizione|(?:finito di )?stampa(?:to|ta|re)?\b|printed (?:in|by)|progetto grafico|impaginazione|copertina|traduzione di|redazione[:\s])/i.test(r);
  const discorso=righe.some(r=>!editoriale(r)&&r.length>=60&&/[.!?](?:\s|$)/.test(r)&&!/[.·…]{2,}\s*\d+\s*$/.test(r));
  if(discorso)return false;
  const voci=righe.filter(r=>/(?:[.·…]{2,}|\s)\s*\d{1,4}\s*$/.test(r)).length;
  const puntate=righe.filter(r=>/[.·…]{2,}\s*\d{1,4}\s*$/.test(r)).length;
  if(puntate>=3&&puntate>=righe.length/2)return true;
  if(/^(?:indice(?: generale)?|sommario|table of contents|contents)\s*[:.]?$/i.test(righe[0]||'')&&voci>=2)return true;
  const dati=righe.filter(editoriale).length;
  return dati>0&&(dati===righe.length||dati>=2)&&righe.every(r=>r.length<180||editoriale(r));
 }
 return {etichette,soloParatesto};
}));
