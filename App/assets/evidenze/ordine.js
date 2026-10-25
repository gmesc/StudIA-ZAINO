/* Ordinamento delle parole chiave: la data indica lo stato, AZ/ZA il prossimo gesto. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ParoleOrdine=factory();}(typeof self!=='undefined'?self:this,function(){
 'use strict';
 function stato(s){return {criterio:s&&s.criterio==='data'?'data':'alfa',verso:s&&s.verso==='desc'?'desc':'asc'};}
 function scegli(s,criterio){s=stato(s);return {criterio:criterio,verso:s.criterio===criterio?(s.verso==='asc'?'desc':'asc'):(criterio==='data'?'desc':'asc')};}
 function ordina(elenco,s){s=stato(s);return (elenco||[]).slice().sort(function(a,b){
  var d=0;if(s.criterio==='data'){
   var da=Date.parse(a.creato),db=Date.parse(b.creato);
   if(!isFinite(da)||!isFinite(db))return isFinite(da)?-1:isFinite(db)?1:String(a.exact).localeCompare(String(b.exact),'it');
   d=da-db;
  }else d=String(a.exact).localeCompare(String(b.exact),'it',{numeric:true,sensitivity:'base'});
  return (s.verso==='asc'?d:-d)||String(a.id||'').localeCompare(String(b.id||''));
 });}
 function etichetta(s){return stato(s).verso==='desc'?'AZ':'ZA';}
 function freccia(s){return stato(s).verso==='asc'?'chevron-up':'chevron-down';}
 function data(v){var d=new Date(v);return v&&isFinite(d.getTime())?d.toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'}):'Data di creazione non disponibile';}
 return {stato:stato,scegli:scegli,ordina:ordina,etichetta:etichetta,freccia:freccia,data:data};
}));
