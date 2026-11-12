/* Immagini incorporate: lo stile e il documento viaggiano senza percorsi locali. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ZainoSfondi=factory();})(globalThis,function(){
 'use strict';
 const LIMITE=2*1024*1024,LIMITE_FILE=10*1024*1024,LATO=2560;
 function esigi(s){
  if(!s||typeof s!=='object'||Array.isArray(s)||Object.keys(s).some(k=>!['nome','dati','larghezza','altezza','modo','adatta','passo'].includes(k))||typeof s.nome!=='string'||!s.nome.trim()||s.nome.length>80||!['immagine','pattern'].includes(s.modo)||!['cover','contain'].includes(s.adatta)||!Number.isFinite(s.passo)||s.passo<16||s.passo>1024||!['larghezza','altezza'].every(k=>Number.isInteger(s[k])&&s[k]>0&&s[k]<=LATO))throw Error('Sfondo personale non valido.');
  const m=typeof s.dati==='string'&&s.dati.match(/^data:image\/(png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  if(!m||m[2].length%4||m[2].length/4*3-(m[2].match(/=+$/)?.[0].length||0)>LIMITE)throw Error('Lo sfondo deve essere un’immagine PNG o WebP incorporata entro 2 MiB.');
  const b=atob(m[2].slice(0,64));
  if(m[1]==='png'?!b.startsWith('\x89PNG\r\n\x1a\n'):!(b.startsWith('RIFF')&&b.slice(8,12)==='WEBP'))throw Error('I dati dello sfondo non corrispondono al formato immagine.');
  return s;
 }
 function valido(s){try{esigi(s);return true;}catch(_){return false;}}
 function dimensioni(w,h){if(!Number.isFinite(w)||!Number.isFinite(h)||w<1||h<1)throw Error('Dimensioni immagine non valide.');const k=Math.min(1,LATO/Math.max(w,h));return {larghezza:Math.max(1,Math.round(w*k)),altezza:Math.max(1,Math.round(h*k))};}
 function formato(w,h){const mcd=(a,b)=>b?mcd(b,a%b):a,k=mcd(w,h);return w+' × '+h+' px · '+w/k+':'+h/k;}
 function css(s){esigi(s);return {backgroundImage:'url("'+s.dati+'")',backgroundSize:s.modo==='pattern'?s.passo+'px '+s.passo*s.altezza/s.larghezza+'px':s.adatta,backgroundPosition:s.modo==='pattern'?'0 0':'center',backgroundRepeat:s.modo==='pattern'?'repeat':'no-repeat'};}
 return {LIMITE,LIMITE_FILE,LATO,esigi,valido,dimensioni,formato,css};
});
