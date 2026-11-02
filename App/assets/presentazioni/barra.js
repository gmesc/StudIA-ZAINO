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
 return {visibili};
});
