/* Le etichette hanno lo stesso peso nella scheda e nella copia personale. */
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.ZainoSchedeTesto=factory();
}(typeof self!=='undefined'?self:this,function(){
 'use strict';
 function etichette(text){
  return String(text||'').replace(/^([ \t]*(?:(?:[-+*]|\d+[.)])[ \t]+)?)([\p{L}][\p{L}\p{N} /’'()-]{0,59}):(?=[ \t]|$)/gmu,'$1**$2:**');
 }
 return {etichette};
}));
