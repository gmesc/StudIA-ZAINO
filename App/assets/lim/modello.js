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
 function titoloAutomatico(numero,data){
  if(!Number.isSafeInteger(numero)||numero<1||!Number.isFinite(data?.getTime()))throw Error('Numero o data della lavagna non validi.');
  const due=n=>String(n).padStart(2,'0');
  return 'LAVAGNA '+String(numero).padStart(3,'0')+' ['+due(data.getDate())+'/'+due(data.getMonth()+1)+'/'+data.getFullYear()+']';
 }
 return {scena,unisci,rapporto,titoloAutomatico};
});
