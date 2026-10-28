/* Dati portabili Excalidraw; nessun DOM né percorso del vault. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('../rimandi/sintassi'));else root.LimModello=factory(root.RimandiSintassi);})(typeof window==='undefined'?this:window,function(R){
 'use strict';
 const tipi=new Set(['rectangle','diamond','ellipse','arrow','line','freedraw','text','image','frame','magicframe']);
 const stati=['viewBackgroundColor','gridSize','gridStep','gridModeEnabled','scrollX','scrollY','zoom'];
 function scena(s){
  if(!s||!Array.isArray(s.elements)||s.elements.length>20000)throw Error('Lavagnata non valida o troppo grande.');
  const copia=JSON.parse(JSON.stringify(s));if(JSON.stringify(copia).length>60*1024*1024)throw Error('Lavagnata troppo grande (massimo 60 MB).');
  const ids=new Set();
  for(const e of copia.elements){
   if(!e||!tipi.has(e.type)||typeof e.id!=='string'||e.id.length>120||ids.has(e.id)||!['x','y','width','height','version','versionNonce'].every(k=>Number.isFinite(e[k])))throw Error('Elemento della lavagnata non valido.');
   ids.add(e.id);if(e.link&&!R.leggi(e.link))throw Error('Collegamento della lavagnata non valido.');
   if(e.text!=null&&typeof e.text!=='string')throw Error('Testo della lavagnata non valido.');
  }
  const files={};for(const [id,f] of Object.entries(copia.files||{})){
   if(!f||f.id!==id||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(f.dataURL)||!['image/png','image/jpeg','image/webp'].includes(f.mimeType))throw Error('Immagine della lavagnata non valida.');files[id]=f;
  }
  const appState={};for(const k of stati)if(copia.appState?.[k]!=null)appState[k]=copia.appState[k];
  for(const e of copia.elements)if(e.type==='image'&&e.fileId&&!files[e.fileId])throw Error('Immagine della lavagnata mancante.');
  return {elements:copia.elements,appState,files};
 }
 function unisci(prima,dopo){
  const m=new Map(prima.elements.map(e=>[e.id,e]));
  for(const e of dopo.elements){const p=m.get(e.id);if(!p||e.version>p.version||(e.version===p.version&&e.versionNonce<p.versionNonce))m.set(e.id,e);}
  // Excalidraw conserva l'ordine davanti/dietro negli indici frazionari.
  const elements=[...m.values()].sort((a,b)=>typeof a.index==='string'&&typeof b.index==='string'?(a.index<b.index?-1:a.index>b.index?1:0):0);
  return {elements,appState:dopo.appState,files:{...prima.files,...dopo.files}};
 }
 function rapporto(n){return Math.max(.25,Math.min(.75,Number(n)||.5));}
 const MIME='application/x-studia-lim';
 function leggiTrasporto(t){
  if(typeof t!=='string'||t.length>512)throw Error('Elemento trascinato non valido.');
  let d;try{d=JSON.parse(t);}catch(_){throw Error('Elemento trascinato non valido.');}
  if(!d||!['keyword','album'].includes(d.tipo)||typeof d.id!=='string'||! /^[0-9a-f]{6,40}$/.test(d.id)||typeof d.corso!=='string'||!d.corso||d.corso.length>100||d.corso.startsWith('.')||/[/\\\x00-\x1f]/.test(d.corso))throw Error('Elemento trascinato non valido.');
  return {tipo:d.tipo,id:d.id,corso:d.corso};
 }
 function trasporto(tipo,id,corso){const t=JSON.stringify({tipo,id,corso});leggiTrasporto(t);return t;}
 function punto(p,s){
  const z=s.zoom?.value;if(![p.x,p.y,s.offsetLeft,s.offsetTop,s.scrollX,s.scrollY,z].every(Number.isFinite)||z<=0)throw Error('Posizione nella lavagna non valida.');
  return {x:(p.x-s.offsetLeft)/z-s.scrollX,y:(p.y-s.offsetTop)/z-s.scrollY};
 }
 // Il testo trasferito resta leggibile anche su etichette o lavagne scure.
 function coloreTesto(sfondo){
  let h=String(sfondo||'').replace(/^#/,'');if(h.length===3)h=h.split('').map(c=>c+c).join('');
  if(!/^[0-9a-f]{6}$/i.test(h))return '#000000';
  const rgb=[0,2,4].map(i=>{const c=parseInt(h.slice(i,i+2),16)/255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);});
  return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]>.179?'#000000':'#ffffff';
 }
 function titoloAutomatico(numero,data){
  if(!Number.isSafeInteger(numero)||numero<1||!Number.isFinite(data?.getTime()))throw Error('Numero o data della lavagna non validi.');
  const due=n=>String(n).padStart(2,'0');
  return 'LAVAGNA '+String(numero).padStart(3,'0')+' ['+due(data.getDate())+'/'+due(data.getMonth()+1)+'/'+data.getFullYear()+']';
 }
 return {scena,unisci,rapporto,titoloAutomatico,coloreTesto,MIME,trasporto,leggiTrasporto,punto};
});
