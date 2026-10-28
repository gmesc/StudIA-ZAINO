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
 function ancora(elementi,top){
  const e=elementi.find(e=>e.top+e.height>top&&e.height>0)||elementi.at(-1);
  return e?{id:String(e.id),frazione:Math.max(0,Math.min(1,(top-e.top)/Math.max(1,e.height)))}:null;
 }
 function posizione(e,a){return e.top+Math.max(0,Math.min(1,Number(a?.frazione)||0))*e.height;}
 function mittente(e,w,url){return !!w&&!w.isDestroyed()&&e.sender===w.webContents&&e.senderFrame===w.webContents.mainFrame&&e.senderFrame.url.split('#')[0]===url;}
 return {PASSI,TAGS_TESTO,scala,passo,rettangolo,ancora,posizione,mittente};
}));
