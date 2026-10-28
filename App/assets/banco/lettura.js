/* Misure e ancore della lettura: indipendenti da finestre, DOM e vault. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.BancoLettura=factory();}(typeof self!=='undefined'?self:this,function(){
 'use strict';
 const PASSI=[75,100,125,150,175,200,225,250,300];
 const TAGS_TESTO='DIV SPAN P H1 H2 H3 H4 H5 H6 UL OL LI STRONG B EM I U S BLOCKQUOTE BR HR PRE CODE TABLE THEAD TBODY TR TD TH DETAILS SUMMARY ARTICLE SECTION IMG SUP SUB'.split(' ');
 function scala(n){n=Number(n);return Number.isFinite(n)?Math.max(75,Math.min(300,n)):100;}
 function passo(n,verso){n=scala(n);return (verso>0?PASSI.find(x=>x>n):PASSI.slice().reverse().find(x=>x<n))||n;}
 function rettangolo(r,limiti){
  if(!r||!['x','y','width','height'].every(k=>Number.isFinite(r[k])))throw Error('Area di proiezione non valida.');
  const x=Math.max(0,Math.floor(r.x)),y=Math.max(0,Math.floor(r.y));
  const width=Math.min(Math.floor(r.x+r.width),Math.floor(limiti.width))-x,height=Math.min(Math.floor(r.y+r.height),Math.floor(limiti.height))-y;
  if(width<1||height<1)throw Error('Lo split da proiettare non è visibile.');
  return {x,y,width,height};
 }
 // Il ritaglio segue la larghezza, senza deformare il documento. Se lo split
 // è più basso della destinazione, si proiettano soltanto i pixel disponibili.
 function inquadratura(area,vista,punto={}){
  if(!vista||!['width','height'].every(k=>Number.isFinite(vista[k])&&vista[k]>0))throw Error('Misure della proiezione non valide.');
  const width=Math.max(1,Math.floor(area.width/(Math.max(100,scala(vista.scala))/100)));
  const height=Math.max(1,Math.min(Math.floor(area.height),Math.floor(width*vista.height/vista.width)));
  const frazione=n=>Number.isFinite(n)?Math.max(0,Math.min(1,n)):0;
  return {x:Math.floor(area.x+(area.width-width)*frazione(punto.x)),y:Math.floor(area.y+(area.height-height)*frazione(punto.y)),width,height};
 }
 const STILI_CLONE='display position top right bottom left box-sizing width height min-width min-height max-width max-height margin-top margin-right margin-bottom margin-left padding-top padding-right padding-bottom padding-left border-top border-right border-bottom border-left border-radius border-collapse border-spacing font-family font-size font-weight font-style font-variant line-height letter-spacing word-spacing text-align text-indent text-transform text-decoration white-space word-break overflow-wrap vertical-align list-style-type list-style-position color background-color opacity overflow-x overflow-y flex-direction flex-wrap flex-grow flex-shrink flex-basis align-items align-self justify-content gap row-gap column-gap grid-template-columns grid-template-rows grid-column grid-row transform transform-origin tab-size'.split(' ');
 function stileSicuro(v){return typeof v==='string'&&v.length<500&&!/url\s*\(|expression|@import|[<>\\]/i.test(v);}
 function raster(area,vista){
  const dpr=Math.max(1,Math.min(3,Number(vista.dpr)||1));
  const fattore=Math.min(vista.width*dpr/area.width,8192/area.width,8192/area.height,Math.sqrt(32000000/(area.width*area.height)));
  return {width:Math.max(1,Math.ceil(area.width*fattore)),height:Math.max(1,Math.ceil(area.height*fattore)),fattore};
 }
 function ancora(elementi,top){
  const e=elementi.find(e=>e.top+e.height>top&&e.height>0)||elementi.at(-1);
  return e?{id:String(e.id),frazione:Math.max(0,Math.min(1,(top-e.top)/Math.max(1,e.height)))}:null;
 }
 function posizione(e,a){return e.top+Math.max(0,Math.min(1,Number(a?.frazione)||0))*e.height;}
 function mittente(e,w,url){return !!w&&!w.isDestroyed()&&e.sender===w.webContents&&e.senderFrame===w.webContents.mainFrame&&e.senderFrame.url.split('#')[0]===url;}
 return {PASSI,TAGS_TESTO,STILI_CLONE,stileSicuro,raster,scala,passo,rettangolo,inquadratura,ancora,posizione,mittente};
}));
