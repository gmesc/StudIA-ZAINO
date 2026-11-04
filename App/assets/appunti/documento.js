/* Un albero di contenuto, senza DOM né percorsi del computer. Il main valida
 * nuovamente questo contratto: un'immagine mancante non sparisce dall'export. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();else root.AppuntiDocumento=factory();
}(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var TAG=new Set('root p h1 h2 h3 h4 h5 h6 div span strong b em i u s del sup sub code pre blockquote ul ol li table thead tbody tfoot tr td th br hr a mark img callout figura'.split(' '));
  function valida(doc){
    if(!doc||typeof doc.titolo!=='string'||doc.titolo.length>1000||!doc.albero)throw Error('Appunto non valido.');
    var nodi=0,testo=0,immagini=0;
    function visita(n,livello){
      if(!n||typeof n!=='object'||++nodi>100000||livello>60)throw Error('Appunto troppo complesso.');
      if(n.tag==='#text'){
        if(typeof n.testo!=='string'||(testo+=n.testo.length)>5000000)throw Error('Testo troppo grande.');
        return;
      }
      if(!TAG.has(n.tag)||!Array.isArray(n.figli))throw Error('Elemento DOCX non supportato: '+String(n.tag));
      if(n.tag==='img'){
        if(typeof n.dati!=='string'||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(n.dati))throw Error('Immagine non incorporata.');
        immagini+=n.dati.length;
        if(immagini>100000000||!(n.larghezza>0&&n.larghezza<=10000&&n.altezza>0&&n.altezza<=10000))throw Error('Immagine troppo grande.');
      }
      ['riferimento','href','postilla'].forEach(function(k){if(n[k]!=null&&(typeof n[k]!=='string'||n[k].length>10000))throw Error('Riferimento non valido.');});
      n.figli.forEach(function(f){visita(f,livello+1);});
    }
    visita(doc.albero,0);return doc;
  }
  function colore(v,fallback){return typeof v==='string'&&/^[0-9a-f]{6}$/i.test(v)?v:(fallback||'111111');}
  function carta(col){var c=colore(col);return [0,2,4].map(function(i){return Math.round(parseInt(c.slice(i,i+2),16)*.09+255*.91).toString(16).padStart(2,'0');}).join('');}
  function testo(n){return n.tag==='#text'?n.testo:(n.figli||[]).map(testo).join('');}
  return {valida:valida,colore:colore,carta:carta,testo:testo};
}));
