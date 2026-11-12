(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FontiNomi = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // Il separatore distingue il numero interno da quelli che appartengono al titolo.
  function prefisso(file) {
    return /^(\d{4,} - |\d{1,3} )/.exec(String(file || ''))?.[0] || '';
  }
  function visibile(file) { return String(file || '').slice(prefisso(file).length); }
  function numero(file) {
    var m = /^(\d+)\b/.exec(String(file || ''));
    return m ? m[1].padStart(2, '0') : null;
  }
  function titoloAnteprima(zaino,file) {
    zaino=String(zaino||'').replace(/\s+/g,' ').trim();
    var nome=visibile(file).replace(/\s+/g,' ').trim();
    function breve(t,n){var caratteri=Array.from(t);return caratteri.length>n?caratteri.slice(0,n-1).join('')+'…':t;}
    // Lo zaino resta riconoscibile; il documento riceve lo spazio lasciato libero.
    var origine=breve(zaino,15),documento=breve(nome,30-Array.from(origine).length);
    return {testo:origine+' › '+documento,completo:zaino+' › '+nome};
  }
  return { prefisso: prefisso, visibile: visibile, numero: numero, titoloAnteprima: titoloAnteprima };
}));
