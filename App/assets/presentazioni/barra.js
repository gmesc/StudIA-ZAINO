(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.PresentaBarra=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 // Conserva l’ordine e sposta gruppi interi, riservando spazio al comando Altri.
 function visibili(larghezze,spazio,gap,altri){
  const totale=larghezze.reduce((s,w)=>s+w,0)+Math.max(0,larghezze.length-1)*gap;
  if(totale<=spazio)return larghezze.length;
  let usato=altri,n=0;
  for(const w of larghezze){if(usato+gap+w>spazio)break;usato+=gap+w;n++;}
  return n;
 }
 // Massimo due righe; il menu occupa una colonna propria, senza campi tagliati.
 function griglia(n,spazio,gap,altri,minimo=160,righe=2){
  if(!n)return {visibili:0,colonne:0};
  let colonne=Math.max(0,Math.floor((spazio+gap)/(minimo+gap)));
  if(colonne*righe>=n)return {visibili:n,colonne:Math.min(n,colonne)};
  colonne=Math.max(0,Math.floor((spazio-altri)/(minimo+gap)));
  return {visibili:Math.min(n,colonne*righe),colonne};
 }
 return {visibili,griglia};
});
