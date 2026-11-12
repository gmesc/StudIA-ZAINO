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
 // Quattro regioni libere: il pannello non può mai intersecare la navbar.
 function pannelloNavbar(area,navbar,misura,gap=8){
  const r=area.x+area.width,b=area.y+area.height,nr=navbar.x+navbar.width,nb=navbar.y+navbar.height;
  const regioni=[{x:area.x,y:area.y,width:area.width,height:navbar.y-gap-area.y},{x:area.x,y:nb+gap,width:area.width,height:b-nb-gap},{x:area.x,y:area.y,width:navbar.x-gap-area.x,height:area.height},{x:nr+gap,y:area.y,width:r-nr-gap,height:area.height}].map(v=>{const x=Math.max(area.x,v.x),y=Math.max(area.y,v.y);return {x,y,width:Math.min(r,v.x+v.width)-x,height:Math.min(b,v.y+v.height)-y};}).filter(v=>v.width>=240&&v.height>=144);
  regioni.sort((a,b)=>{const ad=Math.min(misura.width,a.width)*Math.min(misura.height,a.height),bd=Math.min(misura.width,b.width)*Math.min(misura.height,b.height);return bd-ad;});
  const v=regioni[0];if(!v)return null;const width=Math.min(misura.width,v.width),height=Math.min(misura.height,v.height);
  return {x:Math.max(v.x,Math.min(navbar.x+(navbar.width-width)/2,v.x+v.width-width)),y:Math.max(v.y,Math.min(navbar.y-height-gap,v.y+v.height-height)),width,height};
 }
 return {visibili,griglia,pannelloNavbar};
});
