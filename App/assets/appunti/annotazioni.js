/* Disegni Annota portabili: la stessa geometria dei PDF, un solo foglio
 * trasparente. La scena rimane distinta dallo SVG e dal fallback PNG. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('../fonti/annotazioni'));else root.AppuntiAnnotazioni=factory(root.PdfAnnotazioni);})(typeof window==='undefined'?this:window,function(M){
 'use strict';
 function valida(d){
  if(!d||d.versione!==1||![d.larghezza,d.altezza].every(n=>Number.isFinite(n)&&n>=100&&n<=3200))throw Error('Dimensioni del disegno non valide.');
  const segni=M.valida({versione:1,revisione:0,segni:d.segni}).segni;
  if(segni.some(s=>s.pagina!==1)||JSON.stringify(segni).length>4*1024*1024)throw Error('Scena del disegno non valida.');
  return {versione:1,larghezza:d.larghezza,altezza:d.altezza,segni};
 }
 function vuoto(){return {versione:1,larghezza:800,altezza:420,segni:[]};}
 function viewport(d){const {larghezza:width,altezza:height}=valida(d);return {width,height,transform:[1,0,0,-1,0,height],convertToPdfPoint:(x,y)=>[x,height-y],convertToViewportPoint:(x,y)=>[x,height-y]};}
 return {valida,vuoto,viewport};
});
