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
  const editoriale=r=>r.length<180&&/^(?:©|copyright\s*(?:©|\d|[MDCLXVI]+\b)|isbn\b|issn\b|opera originale\b|tutti i diritti riservati|all rights reserved|diritti di (?:traduzione|riproduzione)|(?:prima|seconda|terza|\d+[ªa]|[IVXLCDM]+) edizione|(?:finito di )?stampa(?:to|ta|re)?\b|printed (?:in|by)|progetto grafico|impaginazione|copertina|traduzione di|redazione[:\s])/i.test(r);
  // Frontespizi brevi, senza paragrafi didattici; nessuna esclusione per il solo titolo.
  if(righe.length<=6&&righe.some(r=>/^(?:opera originale\s*:|traduzione di\s*$)/i.test(r))&&righe.every(r=>r.length<100))return true;
  const indice=righe.slice(0,3).some(r=>/^[\s\p{P}\d]*(?:indice(?: generale)?|sommario|table of contents|contents)\s*[:.]?$/iu.test(r));
  if(indice&&(String(text).match(/\b\d+\.\d+(?:\.\d+)*\./g)||[]).length>=3&&(String(text).match(/,\s*\d{1,4}\b/g)||[]).length>=3)return true;
  const discorso=righe.some(r=>!editoriale(r)&&r.length>=60&&/[.!?](?:\s|$)/.test(r)&&!/[.·…]{2,}\s*\d+\s*$/.test(r));
  if(discorso)return false;
  const voci=righe.filter(r=>/(?:[.·…]{2,}|\s)\s*\d{1,4}\s*$/.test(r)).length;
  const puntate=righe.filter(r=>/[.·…]{2,}\s*\d{1,4}\s*$/.test(r)).length;
  if(puntate>=3&&puntate>=righe.length/2)return true;
  if(indice&&voci>=2)return true;
  const dati=righe.filter(editoriale).length;
  return dati>0&&(dati===righe.length||dati>=2)&&righe.every(r=>r.length<180||editoriale(r));
 }
 function contenuti(chunks){
  const pagine=new Map(),chiave=c=>c.kind==='pdf'&&c.page?JSON.stringify([c.sourceId,c.revision,c.page]):null;
  for(const c of chunks){const k=chiave(c);if(k)pagine.set(k,(pagine.get(k)||'')+'\n'+c.text);}
  const escluse=new Set([...pagine].filter(([,text])=>soloParatesto(text)).map(([k])=>k));
  // L’indice può occupare più passaggi: si riconosce sulla pagina intera.
  return chunks.filter(c=>chiave(c)?!escluse.has(chiave(c)):!soloParatesto(c.text));
 }
 return {etichette,soloParatesto,contenuti};
}));
