/* Segni vettoriali in coordinate PDF: la vista e l'export condividono
 * geometria, terminali e impaginazione dei post-it. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.PdfAnnotazioni=factory();})(typeof self!=='undefined'?self:this,function(){
 'use strict';
 const TIPI=['penna','linea','freccia','rettangolo','ellisse','testo','postit'],SPESSORI=[1,2,4,8],PUNTE=['pallino','aperta','triangolo','t'];
 const FORME=['rettangolo','triangolo','pentagono','esagono','ottagono'];
 const haTesto=s=>s.tipo==='testo'||s.tipo==='postit',colore=c=>typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c);
 function punto(p){if(!Array.isArray(p)||p.length!==2||!p.every(n=>Number.isFinite(n)&&Math.abs(n)<=100000))throw Error('Coordinate del segno non valide.');return p.slice();}
 function segno(s){
  if(!s||!TIPI.includes(s.tipo)||typeof s.id!=='string'||!/^[-\w]{1,80}$/.test(s.id)||!Number.isInteger(s.pagina)||s.pagina<1||s.pagina>100000)throw Error('Segno PDF non valido.');
  if(!colore(s.colore)||!Number.isFinite(s.spessore)||s.spessore<.5||s.spessore>20||!Number.isFinite(s.opacita)||s.opacita<.05||s.opacita>1)throw Error('Aspetto del segno non valido.');
  if(!Array.isArray(s.punti)||s.punti.length<2||s.punti.length>10000||(s.tipo!=='penna'&&s.punti.length!==2))throw Error('Tratto non valido.');
  const extra={};
  if(s.tipo==='freccia'){
   extra.punta=s.punta||'aperta';if(!PUNTE.includes(extra.punta))throw Error('Punta della freccia non valida.');
   extra.bidirezionale=s.bidirezionale??false;if(typeof extra.bidirezionale!=='boolean')throw Error('Direzione della freccia non valida.');
   if(s.curva!=null)extra.curva=punto(s.curva);
  }
  if(s.tipo==='rettangolo'){extra.forma=s.forma||'rettangolo';if(!FORME.includes(extra.forma))throw Error('Forma non valida.');}
  if(haTesto(s)){
   if(typeof s.testo!=='string'||!s.testo.trim()||s.testo.length>2000||!Number.isFinite(s.fontSize)||s.fontSize<6||s.fontSize>96)throw Error('Testo dell’annotazione non valido.');
   Object.assign(extra,{testo:s.testo,fontSize:s.fontSize,fontUi:s.fontUi||'zaino'});
   if(!['zaino','atkinson'].includes(extra.fontUi))throw Error('Font dell’annotazione non valido.');
   if(s.tipo==='postit'){
    if(!colore(s.fondo)||!Number.isFinite(s.larghezza)||s.larghezza<48||s.larghezza>600)throw Error('Dimensione o colore del post-it non validi.');
    Object.assign(extra,{fondo:s.fondo.toLowerCase(),larghezza:s.larghezza});
   }
  }
  return {...extra,id:s.id,pagina:s.pagina,tipo:s.tipo,colore:s.colore.toLowerCase(),spessore:s.spessore,opacita:s.opacita,punti:s.punti.map(punto)};
 }
 function valida(v){
  if(!v||v.versione!==1||!Number.isInteger(v.revisione)||v.revisione<0||!Array.isArray(v.segni)||v.segni.length>2000)throw Error('Annotazioni PDF non valide.');
  const segni=v.segni.map(segno);if(new Set(segni.map(s=>s.id)).size!==segni.length||segni.reduce((n,s)=>n+s.punti.length,0)>100000)throw Error('Troppe annotazioni nel documento.');
  return {versione:1,revisione:v.revisione,segni};
 }
 function terminale(s,inizio=false){
  const b=s.punti[inizio?0:1],altro=s.punti[inizio?1:0],a=s.curva&&Math.hypot(s.curva[0]-b[0],s.curva[1]-b[1])>1e-8?s.curva:altro;
  const ang=Math.atan2(b[1]-a[1],b[0]-a[0]),lung=Math.min(Math.hypot(b[0]-altro[0],b[1]-altro[1])*.4,Math.max(9,s.spessore*4));
  const q=(x,y)=>[b[0]+x*Math.cos(ang)-y*Math.sin(ang),b[1]+x*Math.sin(ang)+y*Math.cos(ang)];
  if(s.punta==='pallino'){const r=lung*.35;return {fine:q(-r,0),pieno:Array.from({length:33},(_,i)=>q(Math.cos(i*Math.PI/16)*r,Math.sin(i*Math.PI/16)*r))};}
  if(s.punta==='triangolo')return {fine:q(-lung,0),pieno:[q(0,0),q(-lung,-lung*.45),q(-lung,lung*.45),q(0,0)]};
  if(s.punta==='t')return {fine:b,tratto:[q(0,-lung*.6),q(0,lung*.6)]};
  return {fine:b,tratto:[q(-lung*Math.cos(.5),-lung*Math.sin(.5)),b,q(-lung*Math.cos(.5),lung*Math.sin(.5))]};
 }
 function bezier(s,t){const [a,b]=s.punti,c=s.curva||[(a[0]+b[0])/2,(a[1]+b[1])/2];return a.map((v,i)=>(1-t)**2*v+2*(1-t)*t*c[i]+t*t*b[i]);}
 function manigliaCurva(s){return bezier(s,.5);}
 function curvaDaManiglia(s,m){return segno({...s,curva:m.map((v,i)=>2*v-(s.punti[0][i]+s.punti[1][i])/2)});}
 function asseFreccia(s){
  const fine=terminale(s),inizio=s.bidirezionale?terminale(s,true):null;
  if(!s.curva)return {punti:[inizio?.fine||s.punti[0],fine.fine],fine,inizio};
  // Accorcia la curva sotto i terminali pieni: evita un tratto più scuro
  // quando punta e linea sono semitrasparenti. Il risultato resta una Q esatta.
  const campioni=Array.from({length:65},(_,i)=>bezier(s,i/64)),d=[0];
  for(let i=1;i<campioni.length;i++)d.push(d[i-1]+Math.hypot(...campioni[i].map((v,j)=>v-campioni[i-1][j])));
  function parametro(l){if(l<=0)return 0;for(let i=1;i<d.length;i++)if(d[i]>=l)return (i-1+(l-d[i-1])/(d[i]-d[i-1]||1))/64;return 1;}
  const taglio=(t,p)=>t?Math.hypot(t.fine[0]-p[0],t.fine[1]-p[1]):0;
  const t0=parametro(taglio(inizio,s.punti[0])),t1=parametro(Math.max(0,d.at(-1)-taglio(fine,s.punti[1]))),a=bezier(s,t0),b=bezier(s,t1);
  const c=a.map((v,i)=>v+(t1-t0)*((1-t0)*(s.curva[i]-s.punti[0][i])+t0*(s.punti[1][i]-s.curva[i])));
  return {punti:[a,b],curva:c,fine,inizio};
 }
 function poligono(s){
  const [a,b]=s.punti,x=Math.min(a[0],b[0]),y=Math.min(a[1],b[1]),w=Math.abs(b[0]-a[0]),h=Math.abs(b[1]-a[1]),n=({triangolo:3,pentagono:5,esagono:6,ottagono:8})[s.forma];
  if(!n)return [[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]];
  const base=Array.from({length:n},(_,i)=>[Math.cos(Math.PI/2+i*2*Math.PI/n),Math.sin(Math.PI/2+i*2*Math.PI/n)]),xs=base.map(p=>p[0]),ys=base.map(p=>p[1]),xmin=Math.min(...xs),ymin=Math.min(...ys),dx=Math.max(...xs)-xmin,dy=Math.max(...ys)-ymin;
  const pts=base.map(p=>[x+(p[0]-xmin)/dx*w,y+(p[1]-ymin)/dy*h]);return [...pts,pts[0]];
 }
 function tracce(s){
  if(haTesto(s))return [];
  const [a,b]=s.punti,x=Math.min(a[0],b[0]),y=Math.min(a[1],b[1]),w=Math.abs(b[0]-a[0]),h=Math.abs(b[1]-a[1]);
  if(s.tipo==='rettangolo')return [poligono(s)];
  if(s.tipo==='ellisse')return [Array.from({length:65},(_,i)=>[x+w/2+Math.cos(i*Math.PI/32)*w/2,y+h/2+Math.sin(i*Math.PI/32)*h/2])];
  if(s.tipo==='freccia'){const g=asseFreccia(s);return [g.curva?Array.from({length:65},(_,i)=>bezier(g,i/64)):g.punti,...[g.inizio?.tratto,g.fine.tratto].filter(Boolean)];}
  return [s.punti];
 }
 function pieni(s){return s.tipo==='freccia'?[s.bidirezionale?terminale(s,true).pieno:null,terminale(s).pieno].filter(Boolean):[];}
 function sposta(s,dx,dy){return segno({...s,punti:s.punti.map(([x,y])=>[x+dx,y+dy]),...(s.curva?{curva:[s.curva[0]+dx,s.curva[1]+dy]}:{})});}
 function vincolaPunto(a,b,rapporto=1){const dx=b[0]-a[0],dy=b[1]-a[1],h=Math.max(Math.abs(dx)/rapporto,Math.abs(dy));return [a[0]+(Math.sign(dx)||1)*h*rapporto,a[1]+(Math.sign(dy)||1)*h];}
 function ridimensiona(s,i,b,proporzioni=false){
  const p=s.punti.map(p=>p.slice()),a=p[1-i];let nuovo=b.slice();
  if(proporzioni){
   if(s.tipo==='rettangolo'||s.tipo==='ellisse'){const w=Math.abs(p[1][0]-p[0][0]),h=Math.abs(p[1][1]-p[0][1]);nuovo=vincolaPunto(a,b,w&&h?w/h:1);}
   else if(s.tipo==='linea'||s.tipo==='freccia'){if(Math.abs(b[0]-a[0])>Math.abs(b[1]-a[1]))nuovo[1]=a[1];else nuovo[0]=a[0];}
  }
  const curva=s.curva?.map((v,j)=>v+(nuovo[j]-p[i][j])/2);p[i]=nuovo;
  return segno({...s,punti:p,...(curva?{curva}:{})});
 }
 function righe(s,misura){
  if(s.tipo!=='postit')return s.testo.split('\n');
  const out=[];
  for(const par of s.testo.split('\n')){
   let r='';
   for(const parola of par.split(/\s+/)){
    if(r&&misura(r+' '+parola)>s.larghezza){out.push(r);r='';}
    for(const carattere of Array.from((r?' ':'')+parola)){
     if(r&&misura(r+carattere)>s.larghezza){out.push(r);r='';}
     r+=carattere;
    }
   }
   out.push(r);
  }
  return out;
 }
 function riquadro(s,n){return {x:s.punti[0][0]-8,y:s.punti[0][1]-(n-1)*s.fontSize*1.2-s.fontSize*.25-8,w:s.larghezza+16,h:(n-1)*s.fontSize*1.2+s.fontSize*1.25+16};}
 function limiti(s,misura){
  if(s.tipo==='postit')return riquadro(s,typeof misura==='number'?misura:righe(s,t=>t.length*s.fontSize*.6).length);
  if(s.tipo==='testo'){
   const righe=s.testo.split('\n'),b=misura||{x:0,y:-s.fontSize*.8,width:Math.max(...righe.map(t=>t.length),1)*s.fontSize*.6,height:s.fontSize*(1+(righe.length-1)*1.2)};
   return {x:s.punti[0][0]+b.x,y:s.punti[0][1]-b.y-b.height,w:b.width,h:b.height};
  }
  const pts=[...tracce(s).flat(),...pieni(s).flat()],xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
  return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};
 }
 function percorsoPunti(tratti,invertiY=false){return tratti.map(t=>t.map((p,i)=>(i?'L':'M')+[p[0],invertiY?-p[1]:p[1]].join(' ')).join(' ')).join(' ');}
 function percorso(s,invertiY=false){
  if(s.tipo==='freccia'&&s.curva){const g=asseFreccia(s),coord=p=>[p[0],invertiY?-p[1]:p[1]].join(' ');return 'M'+coord(g.punti[0])+'Q'+coord(g.curva)+' '+coord(g.punti[1])+' '+percorsoPunti([g.inizio?.tratto,g.fine.tratto].filter(Boolean),invertiY);}
  return percorsoPunti(tracce(s),invertiY);
 }
 function recenti(lista,c){return [...new Set([c,...(Array.isArray(lista)?lista:[])].filter(colore).map(v=>v.toLowerCase()))].slice(0,4);}
 function posiziona(r,b,v){
  const clamp=(n,min,max)=>Math.max(min,Math.min(n,Math.max(min,max))),w=b.width,h=b.height;
  const candidati=[[r.x+(r.width-w)/2,r.y-h-8],[r.x+(r.width-w)/2,r.y+r.height+8],[r.x+r.width+8,r.y],[r.x-w-8,r.y]];
  const punti=candidati.map(([x,y])=>({x:clamp(x,8,v.width-w-8),y:clamp(y,8,v.height-h-8)}));
  const area=p=>Math.max(0,Math.min(p.x+w,r.x+r.width)-Math.max(p.x,r.x))*Math.max(0,Math.min(p.y+h,r.y+r.height)-Math.max(p.y,r.y));
  return punti.sort((a,b)=>area(a)-area(b))[0];
 }
 function fontCss(id){return id==='atkinson'?'"Atkinson Hyperlegible",Arial,sans-serif':'"Helvetica Neue",Helvetica,Arial,sans-serif';}
 function vuoto(){return {versione:1,revisione:0,segni:[]};}
 return {TIPI,SPESSORI,PUNTE,FORME,haTesto,punto,segno,valida,tracce,pieni,percorso,percorsoPunti,sposta,limiti,righe,riquadro,recenti,posiziona,fontCss,vuoto,vincolaPunto,ridimensiona,manigliaCurva,curvaDaManiglia};
});
