/* Posizione e aspetto delle figure: il Markdown resta la fonte e i commenti
 * portano solo proprietà di impaginazione, mai codice o percorsi arbitrari. */
(function(root,f){if(typeof module==='object'&&module.exports)module.exports=f(require('../lettura/misura'));else root.AppuntiFigure=f(root.LetturaMisura);}(typeof globalThis!=='undefined'?globalThis:this,function(M){
 'use strict';
 const ID='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',RE=new RegExp('^!\\[([^\\]]*)\\]\\((album:[0-9a-f]{6,40}|fig:\\d+#p=\\d+(?:&i=\\d+)?|_disegni/'+ID+'\\.png)\\)\\s*$');
 function aspetto(v={}){if(Object.keys(v).some(k=>!['align','layer'].includes(k))||v.align&&!['left','center','right'].includes(v.align)||v.layer&&!['inline','front','back'].includes(v.layer))throw Error('Posizione della figura non valida.');return {align:v.align||'center',layer:v.layer||'inline'};}
 function leggi(lines,i){const m=RE.exec(lines[i]||'');if(!m)return null;let style=aspetto(),fine=i;const meta=/^<!-- zaino-figura (.*) -->$/.exec(lines[i+1]||'');if(meta){style=aspetto(JSON.parse(meta[1]));fine++;}const alt=M.leggi(m[1]);return {da:i,fine,src:m[2],caption:alt.didascalia,percento:alt.percento,style};}
 function scrivi(v){const a=aspetto(v.style);return '!['+M.scrivi(v.caption||'',v.percento)+']('+v.src+')\n<!-- zaino-figura '+JSON.stringify(a)+' -->';}
 function html(v,immagine){return '<div class="note-visual" data-align="'+v.style.align+'" data-layer="'+v.style.layer+'"><div class="note-visual-contenuto">'+immagine+'</div></div>';}
 return {leggi,scrivi,aspetto,html,inizio:line=>RE.test(line||'')};
}));
