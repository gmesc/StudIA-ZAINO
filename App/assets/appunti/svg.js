/* Lo SVG si ricostruisce da dati grafici validati, mai da markup arbitrario.
 * La scena originale rimane nel PNG gemello, usato anche come compatibilità Word. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('../presentazioni/vettori'));else root.AppuntiSvg=factory(root.PresentaVettori);})(typeof window==='undefined'?this:window,function(V){
 'use strict';
 function fontValido(f){return f&&typeof f.family==='string'&&/^[A-Za-z0-9 _-]{1,100}$/.test(f.family)&&typeof f.data==='string'&&/^data:(?:font\/(?:woff2?|ttf|otf)|application\/(?:font-woff|octet-stream));base64,[A-Za-z0-9+/=]+$/.test(f.data);}
 function valida(d){if(!d||!V.valida(d.drawing)||!Array.isArray(d.fonts)||d.fonts.length>20||!d.fonts.every(fontValido)||JSON.stringify(d).length>16*1024*1024)throw Error('SVG del disegno non valido.');return d;}
 function html(d){valida(d);const [, ,w,h]=d.drawing.viewBox.trim().split(/\s+/).map(Number);if(w>10000||h>10000)throw Error('Disegno troppo grande.');const fonts=d.fonts.map(f=>'@font-face{font-family:"'+f.family+'";src:url("'+f.data+'")}').join('');return V.html(d.drawing).replace('<svg ','<svg width="'+w+'" height="'+h+'" ').replace('><', '>'+(fonts?'<defs><style>'+fonts+'</style></defs>':'')+'<');}
 function daDOM(svg,scene){
  const fonts=[];
  for(const style of svg.querySelectorAll('style')){
   // Il parser CSS del browser separa le sole font-face prodotte da Excalidraw.
   const sheet=new CSSStyleSheet();sheet.replaceSync(style.textContent);
   for(const rule of sheet.cssRules){if(rule.type!==5)continue;const family=rule.style.getPropertyValue('font-family').replace(/["']/g,'').trim(),src=rule.style.getPropertyValue('src'),m=src.match(/url\(["']?(data:[^"')]+)["']?\)/);if(m)fonts.push({family,data:m[1]});}
  }
  function nodo(e){if(!V.TAG.includes(e.localName))return [];const attrs={};for(const a of e.attributes)if(V.attributo(a.name,a.value))attrs[a.name]=a.value;for(const k of e.style||[]){const v=e.style.getPropertyValue(k);if(V.attributo(k,v))attrs[k]=v;}const text=[...e.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('');return [{tag:e.localName,attrs,...(text?{text}:{}),children:[...e.children].flatMap(nodo)}];}
  return valida({drawing:{viewBox:svg.getAttribute('viewBox'),nodes:[...svg.children].flatMap(nodo),scene},fonts});
 }
 return {valida,html,daDOM};
});
