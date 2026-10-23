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
  return { prefisso: prefisso, visibile: visibile, numero: numero };
}));
