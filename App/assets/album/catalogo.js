/* Le quattro raccolte condividono ricerca e ordinamento, senza leggere il DOM. */
(function(root,factory){
  if(typeof module==='object' && module.exports) module.exports=factory();
  else root.AlbumCatalogo=factory();
})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  var tipi=['ritagli','immagini','video','audio'];
  function preferenze(p){
    p=p||{};
    return {tipo:tipi.includes(p.tipo)?p.tipo:'ritagli',criterio:p.criterio==='data'?'data':'nome',
      verso:p.verso==='desc'?'desc':'asc',dimensione:Math.max(100,Math.min(260,Number(p.dimensione)||150))};
  }
  function nome(v){return String(v.nome||v.didascalia||v.materiale||v.file||'');}
  function testo(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('it');}
  function ordina(voci,p){
    p=preferenze(p);
    return voci.slice().sort(function(a,b){
      var n=p.criterio==='data'?((Date.parse(a.creato)||0)-(Date.parse(b.creato)||0)):0;
      if(!n) n=nome(a).localeCompare(nome(b),'it',{numeric:true,sensitivity:'base'});
      return p.verso==='desc'?-n:n;
    });
  }
  function cerca(voci,q){
    var parole=testo(q).trim().split(/\s+/).filter(Boolean);
    return voci.filter(function(v){var s=testo(nome(v)+' '+(v.materiale||''));return parole.every(function(p){return s.includes(p);});});
  }
  function etichetta(p){p=preferenze(p);return p.criterio==='nome'?(p.verso==='asc'?'Z–A':'A–Z'):(p.verso==='asc'?'31–1':'1–31');}
  return {tipi:tipi,preferenze:preferenze,nome:nome,ordina:ordina,cerca:cerca,etichetta:etichetta};
});
