/* Posizione e aspetto delle figure: il Markdown resta la fonte e i commenti
 * portano solo proprietà di impaginazione, mai codice o percorsi arbitrari. */
(function(root,f){if(typeof module==='object'&&module.exports)module.exports=f(require('../lettura/misura'));else root.AppuntiFigure=f(root.LetturaMisura);}(typeof globalThis!=='undefined'?globalThis:this,function(M){
 'use strict';
 const ID='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',RE=new RegExp('^!\\[([^\\]]*)\\]\\((album:[0-9a-f]{6,40}|fig:\\d+#p=\\d+(?:&i=\\d+)?|_disegni/'+ID+'\\.(?:png|svg))\\)\\s*$');
 function carta(v){
  // La tela trasparente può superare il foglio: i gesti limitano al foglio i
  // tratti visibili, non i margini vuoti dell'SVG di Annota.
  if(!v||Object.keys(v).some(k=>!['pagina','x','y','larghezza'].includes(k))||!Number.isInteger(v.pagina)||v.pagina<1||v.pagina>10000||!['x','y','larghezza'].every(k=>Number.isFinite(v[k]))||Math.abs(v.x)>10000||Math.abs(v.y)>10000||v.larghezza<1||v.larghezza>10000)throw Error('Posizione A4 della figura non valida.');
  return {pagina:v.pagina,x:v.x,y:v.y,larghezza:v.larghezza};
 }
 function aspetto(v={}){if(Object.keys(v).some(k=>!['align','layer','x','y','a4'].includes(k))||v.align&&!['left','center','right'].includes(v.align)||v.layer&&!['inline','front','back'].includes(v.layer))throw Error('Posizione della figura non valida.');if(['x','y'].some(k=>v[k]!==undefined&&(!Number.isFinite(v[k])||Math.abs(v[k])>10000))||v.x!==undefined&&(v.x< -100||v.x>100))throw Error('Coordinate della figura non valide.');return {align:v.align||'center',layer:v.layer||'inline',...(v.x!==undefined?{x:v.x}:{}),...(v.y!==undefined?{y:v.y}:{}),...(v.a4?{a4:carta(v.a4)}:{})};}
 function leggi(lines,i){const m=RE.exec(lines[i]||'');if(!m)return null;let style=aspetto(),fine=i;const meta=/^<!-- zaino-figura (.*) -->$/.exec(lines[i+1]||'');if(meta){style=aspetto(JSON.parse(meta[1]));fine++;}const alt=M.leggi(m[1]);return {da:i,fine,src:m[2],caption:alt.didascalia,percento:alt.percento,style};}
 function scrivi(v){const a=aspetto(v.style);return '!['+M.scrivi(v.caption||'',v.percento)+']('+v.src+')\n<!-- zaino-figura '+JSON.stringify(a)+' -->';}
 function html(v,immagine){return '<div class="note-visual" data-align="'+v.style.align+'" data-layer="'+v.style.layer+'"'+(v.style.x!==undefined?' data-libera="true" data-x="'+v.style.x+'" data-y="'+(v.style.y||0)+'" style="--fig-x:'+v.style.x+'%;--fig-y:'+(v.style.y||0)+'em"':'')+'><div class="note-visual-contenuto">'+immagine+'</div></div>';}
 function dimensiona(v,percento){if(!Number.isFinite(percento)||percento<10||percento>100)throw Error('Dimensione della figura non valida.');return {...v,percento,style:{...v.style,...(v.style.a4?{a4:{...v.style.a4,larghezza:170*percento/100}}:{}),...(v.style.x!==undefined?{x:Math.min(v.style.x,100-percento)}:{})}};}
 function sposta(v,dx,dy,{larghezza,em,alto=-10000,basso=10000,sinistra=0,destra=100-(v.percento||60),a4}){
  if(![dx,dy,larghezza,em,alto,basso,sinistra,destra].every(Number.isFinite)||larghezza<=0||em<=0)throw Error('Misure della figura non valide.');
  const percento=v.percento||60,x=v.style.x??(v.style.align==='right'?100-percento:v.style.align==='left'?0:(100-percento)/2),y=v.style.y||0;
  const style={...v.style,layer:v.style.layer==='inline'?'front':v.style.layer,x:Math.round(Math.max(sinistra,Math.min(destra,x+dx/larghezza*100))*100)/100,y:Math.round(Math.max(alto,Math.min(basso,y+dy/em))*100)/100};
  if(a4){style.a4=carta({...a4,pagina:a4.pagina,x:style.x*1.7,y:style.y*16*25.4/96});style.x=Math.max(-100,Math.min(100,style.x));}else delete style.a4;
  return {...v,percento,style};
 }
 function ridimensionaA4(v,angolo,dx,dy,{scala,rapporto,ink={l:0,t:0,r:1,b:1}}){
  const p=carta(v.style.a4);
  if(!['nw','ne','sw','se'].includes(angolo)||![dx,dy,scala,rapporto,...Object.values(ink)].every(Number.isFinite)||scala<=0||rapporto<=0||ink.l<0||ink.t<0||ink.r>1||ink.b>1||ink.r<=ink.l||ink.b<=ink.t)throw Error('Misure della figura non valide.');
  const sx=angolo.includes('e')?1:-1,sy=angolo.includes('s')?1:-1,w=p.larghezza,h=w*rapporto,vw=w*(ink.r-ink.l),vh=h*(ink.b-ink.t),ax=p.x+w*(sx>0?ink.l:ink.r),ay=p.y+h*(sy>0?ink.t:ink.b),mm=25.4/96/scala;
  const richiesto=1+(sx*dx*mm*vw+sy*dy*mm*vh)/(vw*vw+vh*vh),massimo=Math.min((sx>0?170-ax:ax)/vw,(sy>0?252-ay:ay)/vh,10000/w),minimo=Math.max(1/w,Math.min(1,3/Math.max(vw,vh)));
  if(massimo<minimo)return v;
  const k=Math.max(minimo,Math.min(massimo,richiesto)),arrotonda=n=>Math.round(n*10000)/10000;
  const a4=carta({...p,larghezza:arrotonda(w*k),x:arrotonda(ax-w*k*(sx>0?ink.l:ink.r)),y:arrotonda(ay-h*k*(sy>0?ink.t:ink.b))});
  return {...v,percento:Math.max(10,Math.min(100,Math.round(a4.larghezza/1.7))),style:{...v.style,layer:v.style.layer==='inline'?'front':v.style.layer,x:Math.max(-100,Math.min(100,a4.x/1.7)),y:a4.y*96/25.4/16,a4}};
 }
 return {dimensiona,sposta,ridimensionaA4,leggi,scrivi,aspetto,html,inizio:line=>RE.test(line||'')};
}));
