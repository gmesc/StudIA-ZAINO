/* Posizione e aspetto delle figure: il Markdown resta la fonte e i commenti
 * portano solo proprietà di impaginazione, mai codice o percorsi arbitrari. */
(function(root,f){if(typeof module==='object'&&module.exports)module.exports=f(require('../lettura/misura'));else root.AppuntiFigure=f(root.LetturaMisura);}(typeof globalThis!=='undefined'?globalThis:this,function(M){
 'use strict';
 const ID='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',RE=new RegExp('^!\\[([^\\]]*)\\]\\((album:[0-9a-f]{6,40}|fig:\\d+#p=\\d+(?:&i=\\d+)?|_disegni/'+ID+'\\.(?:png|svg))\\)\\s*$');
 function aspetto(v={}){if(Object.keys(v).some(k=>!['align','layer','x','y'].includes(k))||v.align&&!['left','center','right'].includes(v.align)||v.layer&&!['inline','front','back'].includes(v.layer))throw Error('Posizione della figura non valida.');if(['x','y'].some(k=>v[k]!==undefined&&(!Number.isFinite(v[k])||Math.abs(v[k])>10000))||v.x!==undefined&&(v.x<0||v.x>100))throw Error('Coordinate della figura non valide.');return {align:v.align||'center',layer:v.layer||'inline',...(v.x!==undefined?{x:v.x}:{}),...(v.y!==undefined?{y:v.y}:{})};}
 function leggi(lines,i){const m=RE.exec(lines[i]||'');if(!m)return null;let style=aspetto(),fine=i;const meta=/^<!-- zaino-figura (.*) -->$/.exec(lines[i+1]||'');if(meta){style=aspetto(JSON.parse(meta[1]));fine++;}const alt=M.leggi(m[1]);return {da:i,fine,src:m[2],caption:alt.didascalia,percento:alt.percento,style};}
 function scrivi(v){const a=aspetto(v.style);return '!['+M.scrivi(v.caption||'',v.percento)+']('+v.src+')\n<!-- zaino-figura '+JSON.stringify(a)+' -->';}
 function html(v,immagine){return '<div class="note-visual" data-align="'+v.style.align+'" data-layer="'+v.style.layer+'"'+(v.style.x!==undefined?' data-libera="true" data-x="'+v.style.x+'" data-y="'+(v.style.y||0)+'" style="--fig-x:'+v.style.x+'%;--fig-y:'+(v.style.y||0)+'em"':'')+'><div class="note-visual-contenuto">'+immagine+'</div></div>';}
 function dimensiona(v,percento){if(!Number.isFinite(percento)||percento<10||percento>100)throw Error('Dimensione della figura non valida.');return {...v,percento,style:{...v.style,...(v.style.x!==undefined?{x:Math.min(v.style.x,100-percento)}:{})}};}
 function sposta(v,dx,dy,{larghezza,em,alto=-10000,basso=10000}){
  if(![dx,dy,larghezza,em,alto,basso].every(Number.isFinite)||larghezza<=0||em<=0)throw Error('Misure della figura non valide.');
  const percento=v.percento||60,x=v.style.x??(v.style.align==='right'?100-percento:v.style.align==='left'?0:(100-percento)/2),y=v.style.y||0;
  return {...v,percento,style:{...v.style,layer:v.style.layer==='inline'?'front':v.style.layer,x:Math.round(Math.max(0,Math.min(100-percento,x+dx/larghezza*100))*100)/100,y:Math.round(Math.max(alto,Math.min(basso,y+dy/em))*100)/100}};
 }
 return {dimensiona,sposta,leggi,scrivi,aspetto,html,inizio:line=>RE.test(line||'')};
}));
