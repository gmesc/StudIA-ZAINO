/* Il player vive solo nel DOM: la resa SVG/PDF conserva miniatura e link. */
(function(){
 'use strict';let attivo=null,inserendo=false;
 function chiudi(focus=false){if(!attivo)return;const a=attivo;attivo=null;a.video.pause();a.video.removeAttribute('src');a.video.load();a.host.remove();a.play.style.display='';if(focus&&a.play.isConnected)a.play.focus();}
 async function miniatura(src){
  const v=document.createElement('video');v.preload='auto';v.muted=true;v.src=src;
  try{return await new Promise((risolvi,rifiuta)=>{
   const timer=setTimeout(()=>fine(Error('Il video non risponde: miniatura non creata.')),15000);
   function fine(err,valore){clearTimeout(timer);v.onloadeddata=v.onseeked=v.onerror=null;err?rifiuta(err):risolvi(valore);}
   function cattura(){try{const k=Math.min(1,640/v.videoWidth,640/v.videoHeight),w=Math.max(1,Math.round(v.videoWidth*k)),h=Math.max(1,Math.round(v.videoHeight*k)),c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(v,0,0,w,h);fine(null,{poster:c.toDataURL('image/jpeg',.8),w,h});}catch(e){fine(e);}}
   v.onerror=()=>fine(Error(Lettore.erroreDaDire(v.error,'video')||'Video non leggibile.'));
   v.onseeked=cattura;v.onloadeddata=()=>{if(Number.isFinite(v.duration)&&v.duration>.15)v.currentTime=.1;else cattura();};v.load();
  });}finally{v.pause();v.removeAttribute('src');v.load();}
 }
 async function inserisci(trasporto,punto){
  const corso=corsoAttivo(),file=MappaVideo.trasporto(trasporto,corso),mappa=MAPPA.mia.file;
  if(!file){toast('Trascina un video dell’ALBUM di questo zaino.',false);return;}
  if(!mappaMie()||!MAPPA.mia.grafo){toast('Apri una mappa tua per aggiungere un video.',false);return;}
  if(inserendo){toast('Attendi la miniatura del video in corso.',false);return;}inserendo=true;
  try{
   const elenco=await vault.corpus.list(corso);if(!elenco.some(v=>v.name===file&&v.tipo==='media'))throw Error('Video non trovato nello zaino.');
   const src=vault.srcUrl(file,corso);if(!src)throw Error('Video non disponibile.');
   const dati=await miniatura(src),video=MappaVideo.normalizza({file,...dati});if(!video)throw Error('Miniatura del video non valida.');
   if(corsoAttivo()!==corso||MAPPA.mia.file!==mappa||!mappaMie())throw Error('La mappa è cambiata: trascina nuovamente il video.');
   mappaAnnullabile('Aggiungi video');
   MAPPA.mia.grafo=MappaModifica.creaNodo(MAPPA.mia.grafo,{testo:FontiNomi.visibile(file),video,rimando:{type:'video',file,t:0},x:punto?Math.round(punto.x):null,y:punto?Math.round(punto.y):null});
   mappaTocca();mappaRidisegna();toast('Video aggiunto alla mappa.',true);
  }catch(e){toast(e.message,false);}finally{inserendo=false;}
 }
 function riproduci(play){
  const nodo=MAPPA.nodi[play.dataset.video],d=MappaVideo.normalizza(nodo?.video);if(!d)return;
  chiudi();const src=vault.srcUrl(d.file,corsoAttivo());if(!src){toast('Video non disponibile.',false);return;}
  const gruppo=play.closest('.mnodo'),imm=gruppo.querySelector('image');if(!imm)return;
  const host=document.createElementNS('http://www.w3.org/2000/svg','foreignObject');host.classList.add('mvideo-player');for(const k of ['x','y','width','height'])host.setAttribute(k,imm.getAttribute(k));
  const box=document.createElement('div');box.className='mvideo-lettore';const v=document.createElement('video'),stop=document.createElement('button');v.controls=true;v.playsInline=true;v.preload='metadata';v.poster=d.poster;v.src=src;v.setAttribute('aria-label',nodo.testo||d.file);stop.type='button';stop.className='mvideo-chiudi';stop.title='Chiudi video';stop.setAttribute('aria-label','Chiudi video');stop.innerHTML=UiIcone.svg('x');stop.onclick=()=>chiudi(true);
  box.append(v,stop);host.append(box);document.querySelector('#mappaSvg .mzoom').append(host);play.style.display='none';attivo={host,video:v,play};
  host.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();chiudi(true);}});
  v.onerror=()=>{const messaggio=Lettore.erroreDaDire(v.error,d.file);if(messaggio){chiudi(true);toast(messaggio,false);}};
  v.play().catch(e=>{if(attivo?.video===v)toast('Premi Play nei controlli del video: '+e.message,false);});
 }
 document.addEventListener('pointerdown',e=>{if(e.target.closest?.('.mvideo,.mvideo-player')){MAPPA.giu=null;e.stopImmediatePropagation();}},true);
 document.addEventListener('dblclick',e=>{if(e.target.closest?.('.mvideo,.mvideo-player'))e.stopImmediatePropagation();},true);
 document.addEventListener('click',e=>{const p=e.target.closest?.('#mappaSvg .mvideo');if(p){e.preventDefault();e.stopImmediatePropagation();riproduci(p);}},true);
 document.addEventListener('keydown',e=>{const p=e.target.closest?.('#mappaSvg .mvideo');if(p&&['Enter',' '].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();riproduci(p);}},true);
 window.addEventListener('banco-layout',()=>{if(!bancoVisibile('mappa'))chiudi();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)chiudi();});
 window.MappaVideoUI={inserisci,chiudi};
}());
