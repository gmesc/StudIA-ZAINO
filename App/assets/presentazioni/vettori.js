/* SVG da Excalidraw come albero di soli elementi grafici: nessun markup eseguibile. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.PresentaVettori=factory();})(typeof window==='undefined'?this:window,function(){
 'use strict';
 const TAG=['g','path','rect','ellipse','circle','line','polyline','polygon','text','tspan','defs','clipPath','mask','pattern'];
 const ATTR=['id','d','x','y','x1','x2','y1','y2','width','height','rx','ry','cx','cy','r','points','transform','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','stroke-dasharray','stroke-dashoffset','opacity','fill-opacity','stroke-opacity','fill-rule','clip-rule','clip-path','mask','patternUnits','patternTransform','font-size','font-family','font-weight','text-anchor','dominant-baseline','direction','letter-spacing'];
 const NUM=/^[0-9eE.,+\-\s]+$/;
 function attributo(k,v){
  if(typeof v!=='string'||v.length>500000||!ATTR.includes(k))return false;
  if(['fill','stroke'].includes(k))return /^(none|transparent|currentColor|#[a-f0-9]{3,8}|url\(#[A-Za-z0-9_-]+\))$/i.test(v);
  if(['clip-path','mask'].includes(k))return /^url\(#[A-Za-z0-9_-]+\)$/.test(v);
  if(k==='id')return /^[A-Za-z0-9_-]{1,150}$/.test(v);
  if(k==='d')return /^[MmZzLlHhVvCcSsQqTtAa0-9eE.,+\-\s]*$/.test(v);
  if(['transform','patternTransform'].includes(k))return /^(?:(?:matrix|translate|scale|rotate|skewX|skewY)\([0-9eE.,+\-\s]+\)\s*)+$/.test(v);
  if(['font-family','stroke-linecap','stroke-linejoin','fill-rule','clip-rule','patternUnits','text-anchor','dominant-baseline','direction'].includes(k))return /^[A-Za-z0-9_\s,'"-]{1,150}$/.test(v);
  return NUM.test(v);
 }
 function valida(v){
  if(!v||!Array.isArray(v.nodes)||!Array.isArray(v.scene)||v.scene.length>2000||typeof v.viewBox!=='string'||!NUM.test(v.viewBox)||v.viewBox.trim().split(/\s+/).length!==4||!v.viewBox.trim().split(/\s+/).map(Number).every(Number.isFinite)||v.viewBox.trim().split(/\s+/).slice(2).some(n=>Number(n)<=0))return false;
  if(new TextEncoder().encode(JSON.stringify(v)).length>2*1024*1024)return false;
  if(v.scene.some(e=>!e||!['rectangle','diamond','ellipse','arrow','line','freedraw','text'].includes(e.type)||e.link||!['x','y','width','height','version','versionNonce'].every(k=>Number.isFinite(e[k]))||typeof e.id!=='string'))return false;
  let n=0;function nodo(e,depth){return ++n<=15000&&depth<40&&e&&TAG.includes(e.tag)&&e.attrs&&typeof e.attrs==='object'&&!Array.isArray(e.attrs)&&Object.entries(e.attrs).every(([k,v])=>attributo(k,v))&&(e.text===undefined||typeof e.text==='string'&&e.text.length<=20000)&&Array.isArray(e.children)&&e.children.every(c=>nodo(c,depth+1));}
  return v.nodes.every(e=>nodo(e,0));
 }
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function html(v,prefix=''){if(!valida(v))throw Error('Disegno vettoriale non valido.');const nodo=e=>'<'+e.tag+Object.entries(e.attrs).map(([k,v])=>' '+k+'="'+esc(k==='id'?prefix+v:['fill','stroke','clip-path','mask'].includes(k)?v.replace(/url\(#([A-Za-z0-9_-]+)\)/g,(_,id)=>'url(#'+prefix+id+')'):v)+'"').join('')+'>'+esc(e.text||'')+e.children.map(nodo).join('')+'</'+e.tag+'>';return '<svg class="presenta-vettore" xmlns="http://www.w3.org/2000/svg" viewBox="'+esc(v.viewBox)+'" role="img" aria-label="Disegno vettoriale">'+v.nodes.map(nodo).join('')+'</svg>';}
 return {TAG,attributo,valida,html};
});
