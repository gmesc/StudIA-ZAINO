/* I file descrivono l'aspetto, mai contenuto, selezione o coordinate del documento. */
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory(require('../mappa/aspetto'),require('../presentazioni/modello'));
 else root.ZainoStili=factory(root.MappaAspetto,root.PresentaModello);
})(globalThis,function(A,M){
 'use strict';
 const testoNav=['fontFamily','fontSize','fontWeight','bold','italic','underline','align','verticalAlign','lineHeight','color','highlight','appearance'];
 function mappa(v){
  const {preset,...aspetto}=A.normalizza(v.aspetto);
  return {...aspetto,fsNodo:v.fsNodo??12,fsRel:v.fsRel??10,linee:v.linee||'curva'};
 }
 function vista(v,s){
  const {fsNodo=12,fsRel=10,linee='curva',...aspetto}=s;
  return {...v,fsNodo,fsRel,linee,aspetto:A.normalizza({...aspetto,preset:'personale'})};
 }
 function slide(d,s){
  const t=s.blocks.find(b=>b.type==='title')?.style||{},b=s.blocks.find(b=>['text','list'].includes(b.type))?.style||{};
  const sfondo=M.sfondoSlide(d,s).background||(d.settings.theme==='zaino-dark'?'#0f1115':'#fbfbfa');
  const base=s.temaTesto||{};
  const dimensione=n=>Math.max(12,Math.min(120,n));
  return {font:b.fontFamily||t.fontFamily||base.font||d.settings.fontFamily||'zaino',sfondo,colore:b.color||base.colore||M.contrasto(sfondo),accento:t.color||base.accento||M.contrasto(sfondo),titolo:dimensione(t.fontSize||base.titolo||54),testo:dimensione(b.fontSize||base.testo||32),...(M.sfondoSlide(d,s).backgroundCustom?{sfondoPersonale:M.copia(M.sfondoSlide(d,s).backgroundCustom)}:{})};
 }
 function slideCompleta(d,s){const t=s.blocks.find(b=>b.type==='title'),b=s.blocks.find(b=>['text','list'].includes(b.type)),f=M.sfondoSlide(d,s);return {...slide(d,s),...(t?{stileTitolo:M.copia(t.style||{})}:{}),...(b?{stileTesto:M.copia(b.style||{})}:{}),...(f.backgroundPattern?{carta:f.backgroundPattern}:{}),...(f.backgroundCustom?{sfondoPersonale:M.copia(f.backgroundCustom)}:{})};}
 function navbar(b){
  const style=b.style||{};
  return {variant:b.variant||'steps',orientation:b.orientation||'horizontal',activeZoom:b.activeZoom??1,
   ...Object.fromEntries(testoNav.filter(k=>style[k]!==undefined).map(k=>[k,style[k]])),grafica:M.graficaNavbar(style.navbar)};
 }
 function bloccoNavbar(b,s){
  const style={...b.style};for(const k of testoNav)delete style[k];
  Object.assign(style,{fontSize:18,align:'left'},Object.fromEntries(testoNav.filter(k=>s[k]!==undefined).map(k=>[k,s[k]])),{navbar:M.graficaNavbar(s.grafica)});
  return {...b,style,variant:s.variant||'steps',orientation:s.orientation||'horizontal',activeZoom:s.activeZoom??1};
 }
 return {mappa,vista,slide,slideCompleta,navbar,bloccoNavbar};
});
