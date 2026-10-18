/* Appunta distingue una frase da un frammento senza pretendere di analizzare
 * la lingua. Il paragrafo intero si dichiara solo quando la fonte ne espone
 * davvero il confine; nei PDF gli a capo possono essere semplici righe. */
(function(root,factory){
  if(typeof module==='object' && module.exports) module.exports=factory();
  else root.AppuntiCitazione=factory();
}(typeof self!=='undefined'?self:this,function(){
  'use strict';
  function pulisci(t){ return String(t==null?'':t).replace(/\s+/g,' ').trim(); }
  function blocco(t,paragrafo){
    t=pulisci(t).replace(/^[«“"'‘(\[]+\s*/u,'').replace(/[»”"'’\])]+$/u,'').trim();
    if(paragrafo && t) return true;
    if(!/^\p{Lu}/u.test(t) || !/[.!?]$/u.test(t) || /(?:\.\.|…)\s*$/u.test(t)) return false;
    // Un punto dopo un'abbreviazione non certifica la fine di una frase.
    return !/\b(?:dott|prof|sig|sigg|pag|pp|p|art|cap|es|ecc|etc|vs)\.$/iu.test(t) && !/(?:^|\s)\p{Lu}\.$/u.test(t);
  }
  function letterale(t){ return pulisci(t).replace(/[\\`*\[\]#_!>|]/g,'\\$&'); }
  function componi(t,rimando,intero){
    if(!t) return '';
    if(intero) return '> '+t+(rimando?'\n> — '+rimando:'')+'\n\n';
    return '«*'+t+'*»'+(rimando?' — '+rimando:'')+'\n\n';
  }
  return {blocco:blocco,letterale:letterale,componi:componi};
}));
