/* Il PDF viene ridisegnato dall'originale; il testo mantiene il DOM e le misure.
   Nessuno dei due dipende dalla risoluzione dello split sul portatile. */
(function(){
 'use strict';
 const L=window.BancoLettura;
 const tags=new Set([...L.TAGS_TESTO,'MARK','LABEL','OL','DL','DT','DD']);
 function clone(root){
  function copia(n){
   if(n.nodeType===3)return document.createTextNode(n.textContent);
   if(n.nodeType!==1||n.matches('script,style,iframe,object,embed,template'))return document.createDocumentFragment();
   const out=document.createElement(tags.has(n.tagName)?n.tagName:'span'),s=getComputedStyle(n);
   if(s.display==='none'||s.visibility==='hidden')return document.createDocumentFragment();
   for(const k of L.STILI_CLONE){const v=s.getPropertyValue(k);if(L.stileSicuro(v))out.style.setProperty(k,v);}
   out.dataset.sx=String(n.scrollLeft);out.dataset.sy=String(n.scrollTop);
   if(n.classList.contains('mdb'))out.dataset.pId=n.dataset.da;
   if(n.tagName==='DETAILS')out.open=n.open;
   if(n.tagName==='IMG'){
    try{const c=document.createElement('canvas');c.width=n.naturalWidth;c.height=n.naturalHeight;c.getContext('2d').drawImage(n,0,0);out.src=c.toDataURL();out.alt=n.alt;}catch(_){}
   }else if(n.matches('input,textarea,select')){
    out.textContent=n.tagName==='SELECT'?n.selectedOptions?.[0]?.textContent||'':n.type==='checkbox'?(n.checked?'☑':'☐'):n.value;
    if(n.tagName==='TEXTAREA')out.style.whiteSpace='pre-wrap';
   }else for(const child of n.childNodes)out.append(copia(child));
   return out;
  }
  const out=copia(root),r=root.getBoundingClientRect();
  Object.assign(out.style,{position:'relative',top:'0px',left:'0px',right:'auto',bottom:'auto',margin:'0px',boxSizing:'border-box',width:r.width+'px',height:r.height+'px'});
  return {html:out.outerHTML,rect:r};
 }
 function interseca(a,b){return a.right>b.x&&a.left<b.x+b.width&&a.bottom>b.y&&a.top<b.y+b.height;}
 function segni(ctx,root,area,k){
  function disegna(range,colore){
   const n=range.commonAncestorContainer,el=n.nodeType===1?n:n.parentElement;if(!el||!root.contains(el))return;
   ctx.fillStyle=colore;for(const r of range.getClientRects())if(interseca(r,area))ctx.fillRect((r.x-area.x)*k,(r.y-area.y)*k,r.width*k,r.height*k);
  }
  ctx.save();ctx.globalCompositeOperation='multiply';
  if(window.CSS?.highlights)for(const [nome,h] of CSS.highlights)for(const r of h){
   const n=r.commonAncestorContainer,el=n.nodeType===1?n:n.parentElement;
   if(!el||!root.contains(el))continue;
   const stile=getComputedStyle(el,'::highlight('+nome+')'),colore=stile.backgroundColor;
   if(colore&&colore!=='rgba(0, 0, 0, 0)')disegna(r,colore);
   if(stile.textDecorationLine.includes('underline')){
    const spessore=parseFloat(stile.textDecorationThickness)||2,stacco=parseFloat(stile.textUnderlineOffset)||1;
    ctx.save();ctx.strokeStyle=stile.textDecorationColor;ctx.lineWidth=spessore*k;
    if(stile.textDecorationStyle==='dashed')ctx.setLineDash([spessore*k*3,spessore*k*2]);
    if(stile.textDecorationStyle==='dotted')ctx.setLineDash([spessore*k,spessore*k]);
    for(const box of r.getClientRects())if(interseca(box,area)){
     const y=(box.bottom-area.y+stacco-spessore/2)*k;ctx.beginPath();ctx.moveTo((box.left-area.x)*k,y);ctx.lineTo((box.right-area.x)*k,y);ctx.stroke();
    }
    ctx.restore();
   }
  }
  const sel=getSelection();if(sel&&!sel.isCollapsed)for(let i=0;i<sel.rangeCount;i++)disegna(sel.getRangeAt(i),'rgba(100,130,240,.3)');
  ctx.restore();
 }
 async function pdf(viewer,root,area,vista,stato){
  const misure=L.raster(area,vista),c=document.createElement('canvas');c.width=misure.width;c.height=misure.height;
  const ctx=c.getContext('2d'),k=misure.fattore;ctx.fillStyle=getComputedStyle(root).backgroundColor;
  ctx.fillRect(0,0,c.width,c.height);
  const pagine=[...root.querySelectorAll('.page')].filter(el=>interseca(el.getBoundingClientRect(),area));
  for(const el of pagine){
   if(stato.annullato)return null;
   const pv=viewer.getPageView(Number(el.dataset.pageNumber)-1),pagina=pv?.pdfPage||await viewer.pdfDocument.getPage(Number(el.dataset.pageNumber));
   const tela=el.querySelector('.canvasWrapper')||el,r=tela.getBoundingClientRect();
   const viewport=pagina.getViewport({scale:1,rotation:pv?.viewport.rotation||0});
   const scale=r.width/viewport.width;
   const canvas=document.createElement('canvas');canvas.width=c.width;canvas.height=c.height;
   stato.render=pagina.render({canvasContext:canvas.getContext('2d'),viewport:pagina.getViewport({scale,rotation:viewport.rotation}),transform:[k,0,0,k,(r.x-area.x)*k,(r.y-area.y)*k],background:'rgba(0,0,0,0)',annotationMode:1});
   try{await stato.render.promise;}finally{stato.render=null;}
   ctx.save();ctx.beginPath();ctx.rect((r.x-area.x)*k,(r.y-area.y)*k,r.width*k,r.height*k);ctx.clip();
   ctx.fillStyle=getComputedStyle(el).backgroundColor||'#fff';ctx.fillRect((r.x-area.x)*k,(r.y-area.y)*k,r.width*k,r.height*k);
   if(getComputedStyle(el.querySelector('canvas')||el).mixBlendMode==='multiply')ctx.globalCompositeOperation='multiply';
   ctx.drawImage(canvas,0,0);ctx.restore();canvas.width=0;canvas.height=0;
  }
  segni(ctx,root,area,k);
  if(stato.annullato)return null;
  const dati=c.toDataURL();c.width=0;c.height=0;return dati;
 }
 function caricaImmagine(src){
  return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Immagine della mappa non disponibile per la proiezione.'));img.src=src;});
 }
 async function mappa(root,area,vista,stato){
  const ns='http://www.w3.org/2000/svg',r=root.getBoundingClientRect(),misure=L.raster(area,vista);
  // La SVG annidata conserva viewBox, rapporto e trasformazioni originali.
  // La SVG esterna ritaglia in coordinate CSS, le stesse della cornice sul Mac.
  const tela=document.createElementNS(ns,'svg');
  tela.setAttribute('width',misure.width);tela.setAttribute('height',misure.height);
  tela.setAttribute('viewBox',[area.x-r.x,area.y-r.y,area.width,area.height].join(' '));
  tela.setAttribute('preserveAspectRatio','none');
  const tag=new Set('svg g path rect circle ellipse line polyline polygon text tspan image title desc'.split(' '));
  const attributi=new Set('id x y x1 y1 x2 y2 cx cy r rx ry width height d points viewBox preserveAspectRatio transform dx dy textLength lengthAdjust'.split(' '));
  const stili='fill fill-opacity fill-rule stroke stroke-width stroke-opacity stroke-linecap stroke-linejoin stroke-dasharray stroke-dashoffset paint-order opacity visibility display font-family font-size font-weight font-style letter-spacing text-anchor dominant-baseline alignment-baseline white-space'.split(' ');
  async function copia(n){
   if(n.nodeType===3)return document.createTextNode(n.textContent);
   if(n.nodeType!==1||!tag.has(n.localName))return document.createDocumentFragment();
   const el=document.createElementNS(ns,n.localName),style=getComputedStyle(n);
   for(const a of n.attributes)if(attributi.has(a.name))el.setAttribute(a.name,a.value);
   for(const k of stili){const v=style.getPropertyValue(k);if(L.stileSicuro(v))el.style.setProperty(k,v);}
   if(n.localName==='image'){
    const src=n.getAttribute('href')||n.getAttributeNS('http://www.w3.org/1999/xlink','href');
    if(src){const img=await caricaImmagine(src),c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext('2d').drawImage(img,0,0);el.setAttribute('href',c.toDataURL());c.width=c.height=0;}
   }
   for(const child of n.childNodes)el.append(await copia(child));return el;
  }
  const disegno=await copia(root);disegno.setAttribute('width',r.width);disegno.setAttribute('height',r.height);tela.append(disegno);
  if(stato.annullato)return null;
  const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(tela)],{type:'image/svg+xml'}));
  try{
   const img=await caricaImmagine(url);if(stato.annullato)return null;
   const canvas=document.createElement('canvas');canvas.width=misure.width;canvas.height=misure.height;const ctx=canvas.getContext('2d');
   let bg='transparent';for(let el=root;el;el=el.parentElement){bg=getComputedStyle(el).backgroundColor;if(bg!=='rgba(0, 0, 0, 0)'&&bg!=='transparent')break;}
   ctx.fillStyle=bg;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0);
   const dati=canvas.toDataURL();canvas.width=canvas.height=0;return dati;
  }finally{URL.revokeObjectURL(url);}
 }
 window.ProiezioneContenuti={clone,pdf,mappa};
}());
