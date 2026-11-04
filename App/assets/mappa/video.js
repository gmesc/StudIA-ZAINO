/* Video locali: lo stesso contratto per renderer, operazioni e disco. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(()=>require('../player/lettore'));else root.MappaVideo=factory(()=>root.Lettore);})(typeof window==='undefined'?this:window,function(lettore){
 'use strict';
 function fileValido(file){return typeof file==='string'&&file.length<=255&&!/[\\/\x00-\x1f]/.test(file)&&!file.includes(':')&&lettore().tipoDi(file)==='video';}
 function normalizza(v){
  if(!v||!fileValido(v.file)||typeof v.poster!=='string'||v.poster.length>350000||!/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(v.poster))return null;
  if(!Number.isFinite(v.w)||!Number.isFinite(v.h)||v.w<1||v.h<1||v.w>1280||v.h>1280)return null;
  return {file:v.file,poster:v.poster,w:Math.round(v.w),h:Math.round(v.h),...(Number.isFinite(v.scala)?{scala:Math.max(.5,Math.min(3,v.scala))}:{})};
 }
 function trasporto(t,corso){try{const v=JSON.parse(t);return v.version===1&&v.tipo==='video'&&v.corso===corso&&fileValido(v.file)?v.file:'';}catch(_){return '';}}
 return {normalizza,trasporto,fileValido};
});
