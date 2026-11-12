/* Geometria e preferenze condivise dal relatore, dal pubblico e dal confine IPC.
   I segni sono temporanei: non modificano mai il documento proiettato. */
(function(root,f){if(typeof module==='object'&&module.exports)module.exports=f();else root.LaserTraccia=f();}(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const colori={blu:'#3b82f6',rosso:'#ef4444',verde:'#22c55e'};
 function impostazioni(v={}){
  if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!['forma','spot','spessore','colore','durata'].includes(k)))throw Error('Impostazioni del puntatore non valide.');
  const o={forma:'laser',spot:false,spessore:3,colore:'rosso',durata:2,...v};
  if(!['laser','box','cerchio'].includes(o.forma)||typeof o.spot!=='boolean'||!Object.hasOwn(colori,o.colore)||!Number.isFinite(o.spessore)||o.spessore<0||o.spessore>12||!Number.isFinite(o.durata)||o.durata<0||o.durata>2)throw Error('Impostazioni del puntatore non valide.');
  return o;
 }
 function forma(punti,o,w,h){
  if(!punti.length)return {d:'',chiusa:false};
  const [x,y]=punti[0],[xx,yy]=punti.at(-1),n=v=>Math.round(v*100)/100;
  if(o.forma==='box'){
   const l=n(Math.min(x,xx)),t=n(Math.min(y,yy)),r=n(Math.max(x,xx)),b=n(Math.max(y,yy));
   // Il raggio segue la scala della proiezione e si riduce nei riquadri piccoli.
   const a=o.spot?n(Math.min(w*.01,(r-l)/4,(b-t)/4)):0;
   if(a>0)return {d:`M${n(l+a)} ${t}H${n(r-a)}A${a} ${a} 0 0 1 ${r} ${n(t+a)}V${n(b-a)}A${a} ${a} 0 0 1 ${n(r-a)} ${b}H${n(l+a)}A${a} ${a} 0 0 1 ${l} ${n(b-a)}V${n(t+a)}A${a} ${a} 0 0 1 ${n(l+a)} ${t}Z`,chiusa:(r-l)*(b-t)>4};
   return {d:`M${l} ${t}H${r}V${b}H${l}Z`,chiusa:(r-l)*(b-t)>4};
  }
  if(o.forma==='cerchio'){
   const r=n(Math.max(0,Math.min(Math.hypot(xx-x,yy-y),x,y,w-x,h-y)));
   return {d:r?`M${n(x+r)} ${n(y)}A${r} ${r} 0 1 0 ${n(x-r)} ${n(y)}A${r} ${r} 0 1 0 ${n(x+r)} ${n(y)}Z`:'',chiusa:r>1};
  }
  // Evenodd conserva anche i lobi di un lazo che incrocia se stesso.
  const chiusa=o.spot&&punti.length>2&&punti.some((p,i)=>i>1&&Math.abs((punti[1][0]-x)*(p[1]-y)-(punti[1][1]-y)*(p[0]-x))>2);
  return {d:punti.map((p,i)=>(i?'L':'M')+p.map(n).join(' ')).join(' ')+(chiusa?'Z':''),chiusa};
 }
 function crea(id,rettangolo){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),spot=document.createElement('div');
  svg.id=id;svg.classList.add('puntatore-laser');svg.setAttribute('aria-hidden','true');svg.setAttribute('hidden','');
  spot.id=id+'Spot';spot.className='puntatore-laser-spot';spot.setAttribute('aria-hidden','true');spot.hidden=true;document.body.append(spot,svg);
  let attivo=null,ultimo=null,larghezza=1,altezza=1,timer=0;
  function el(tag,attributi={}){const e=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attributi))e.setAttribute(k,v);return e;}
  function cancella(){clearTimeout(timer);timer=0;attivo=ultimo=null;svg.replaceChildren();svg.setAttribute('hidden','');spot.hidden=true;delete spot.dataset.svanisce;}
  function misura(){const r=rettangolo();if(!r)return;larghezza=r.width;altezza=r.height;for(const e of [svg,spot])Object.assign(e.style,{left:r.x+'px',top:r.y+'px',width:r.width+'px',height:r.height+'px'});svg.setAttribute('viewBox','0 0 '+r.width+' '+r.height);}
  function punto(q){
   if(!attivo)return;const x=q.x*larghezza,y=q.y*q.rapporto*larghezza,g=attivo;
   if(g.op.forma==='laser'){
    const precedente=g.punti.at(-1);if(!precedente||Math.hypot(x-precedente[0],y-precedente[1])>.5)g.punti.push([x,y]);
    if(g.punti.length>4096)g.punti=g.punti.filter((_,i,a)=>i%2===0||i===a.length-1);
   }else if(!g.punti.length)g.punti.push([x,y]);else g.punti[1]=[x,y];
   const f=forma(g.punti,g.op,larghezza,Math.min(altezza,q.rapporto*larghezza));g.linea.setAttribute('d',f.d);g.bordo.setAttribute('d',f.d);g.dot.setAttribute('cx',x);g.dot.setAttribute('cy',y);
   spot.hidden=!(g.op.spot&&f.chiusa);
   if(!spot.hidden)spot.style.clipPath=`path(evenodd, "M0 0H${larghezza}V${altezza}H0Z ${f.d}")`;
  }
  function ricevi(q){
   if(q.fase==='annulla'){cancella();return;}
   if(q.fase==='inizio'){
    const op=impostazioni(q.impostazioni);cancella();misura();
    const g=el('g',{'data-forma':op.forma}),bordo=el('path',{class:'laser-bordo'}),linea=el('path',{class:'laser-tratto'}),dot=el('circle',{class:'laser-punto',r:5});
    g.style.setProperty('--laser-colore',colori[op.colore]);g.style.setProperty('--laser-spessore',op.spessore+'px');g.style.setProperty('--laser-contorno',(op.spessore+2)+'px');g.dataset.bordo=String(op.spessore>0);dot.style.display=op.forma==='laser'&&!op.spot&&op.spessore>0?'':'none';
    g.append(bordo,linea,dot);svg.append(g);attivo=ultimo={el:g,bordo,linea,dot,punti:[],op};svg.removeAttribute('hidden');punto(q);
   }else if(q.fase==='punto')punto(q);
   else if(q.fase==='fine'&&attivo){
    const g=attivo;attivo=null;
    // 0 significa fermo fino al nuovo clic destro, non cancellazione immediata.
    if(g.op.durata>0){for(const e of [g.el,spot]){e.style.setProperty('--laser-durata',g.op.durata+'s');e.dataset.svanisce='';}timer=setTimeout(cancella,g.op.durata*1000);}
   }
  }
  return {ricevi,cancella,misura,presente:()=>!!ultimo,visibile:v=>{for(const e of [svg,spot])e.style.visibility=v?'':'hidden';},smonta(){cancella();svg.remove();spot.remove();}};
 }
 return {crea,impostazioni,forma,colori};
}));
