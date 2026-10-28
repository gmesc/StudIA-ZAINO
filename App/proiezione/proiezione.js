/* Finestra di sola lettura. L'HTML ricevuto viene ricostruito con una lista
   positiva di tag e proprietà CSS: nessun evento, URL o accesso al vault. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id),api=window.proiezione,L=window.BancoLettura;
 let tipo='testo',scala=100,layout=null,ancora=null,timer=null,intero=false,ultimoHtml='';
 let annullaGesti=()=>{};
 const tags=new Set([...L.TAGS_TESTO,'MARK','LABEL','DL','DT','DD']);
 function pulisci(html){
  const template=document.createElement('template');template.innerHTML=html;
  function copia(n){
   if(n.nodeType===3)return document.createTextNode(n.textContent);
   if(n.nodeType!==1||!tags.has(n.tagName))return document.createDocumentFragment();
   const el=document.createElement(n.tagName);
   for(const k of L.STILI_CLONE){const v=n.style.getPropertyValue(k);if(v&&L.stileSicuro(v))el.style.setProperty(k,v);}
   for(const k of ['sx','sy'])if(Number.isFinite(Number(n.dataset[k])))el.dataset[k]=n.dataset[k];
   if(n.hasAttribute('data-p-id'))el.dataset.pId=n.getAttribute('data-p-id');
   if(n.classList.contains('rimando'))el.className='rimando';
   if(n.tagName==='DETAILS'&&n.hasAttribute('open'))el.open=true;
   if(n.tagName==='IMG'){
    const src=n.getAttribute('src')||'';if(/^data:image\/(png|jpeg|webp);base64,/.test(src))el.src=src;
    el.alt=n.getAttribute('alt')||'';
   }
   for(const child of n.childNodes)el.append(copia(child));return el;
  }
  const out=document.createDocumentFragment();for(const n of template.content.childNodes)out.append(copia(n));return out;
 }
 function allinea(){
  if(tipo==='clone'&&layout){
   const k=$('vista').clientWidth/layout.width;
   $('vista').style.clipPath='inset(0 0 '+Math.max(0,$('vista').clientHeight-layout.height*k)+'px 0)';
   Object.assign($('contenuto').style,{left:layout.x*k+'px',top:layout.y*k+'px',transform:'scale('+k+')'});
   return;
  }
  if(tipo!=='testo'||!ancora)return;
  const el=[...$('contenuto').querySelectorAll('[data-p-id]')].find(n=>n.dataset.pId===String(ancora.id));if(!el)return;
  const r=el.getBoundingClientRect(),v=$('vista');
  v.scrollTop=L.posizione({top:r.top+v.scrollTop,height:r.height},ancora)-64;
 }
 function inviaVista(ancora){comando({ancora,azione:'vista',width:$('vista').clientWidth,height:$('vista').clientHeight,scala,dpr:devicePixelRatio});}
 function ingrandisci(n,ancora){scala=Math.max(100,L.scala(n));document.documentElement.style.setProperty('--zoom',scala/100);$('scala').textContent=Math.round(scala)+'%';$('meno').disabled=scala<=100;$('piu').disabled=scala>=300;
  inviaVista(ancora);requestAnimationFrame(allinea);
 }
 function mostraBarra(){delete $('barra').dataset.nascosta;clearTimeout(timer);timer=setTimeout(()=>{if(!$('barra').matches(':hover,:focus-within'))$('barra').dataset.nascosta='1';},2200);}
 async function comando(o){const r=await api.comando(o);if(r?.error){$('errore').hidden=false;$('errore').textContent=r.error;}}
 document.querySelectorAll('[data-icon]').forEach(e=>{e.innerHTML=UiIcone.svg(e.dataset.icon);});
 $('meno').onclick=()=>ingrandisci(L.passo(scala,-1));$('piu').onclick=()=>ingrandisci(L.passo(scala,1));$('scala').onclick=()=>ingrandisci(100);
 $('intero').onclick=()=>comando({azione:'intero'});$('chiudi').onclick=()=>comando({azione:'chiudi'});$('schermi').onchange=()=>comando({azione:'schermo',id:Number($('schermi').value)});
 api.intero(value=>{annullaGesti();intero=value;$('intero').title=value?'Esci dallo schermo intero (Esc)':'Schermo intero (Esc per uscire)';$('intero').setAttribute('aria-label',$('intero').title);mostraBarra();});
 api.schermi(({schermi,corrente})=>{$('schermiLabel').hidden=schermi.length<2;$('schermi').replaceChildren();for(const s of schermi){const o=document.createElement('option');o.value=s.id;o.textContent=s.nome;$('schermi').append(o);}$('schermi').value=corrente;});
 api.quadro(q=>{
  window.ProiezioneLavagna?.quadro(q);
  document.documentElement.dataset.theme=q.tema;$('titolo').textContent=q.titolo;document.title=q.titolo+' — Proiezione';
  if(tipo!==q.tipo){tipo=q.tipo;ingrandisci(100);}
  if(tipo!=='clone')$('vista').style.clipPath='';
  document.body.dataset.tipo=['pdf','mappa','lavagna'].includes(tipo)?'immagine':tipo;$('contenuto').hidden=!['testo','clone'].includes(tipo);$('figura').hidden=!['pdf','mappa','lavagna','immagine'].includes(tipo);
  if(q.html!=null&&q.html!==ultimoHtml){
   ultimoHtml=q.html;$('contenuto').replaceChildren(pulisci(q.html));
   $('contenuto').querySelectorAll('[data-sy]').forEach(el=>{el.scrollLeft=Number(el.dataset.sx)||0;el.scrollTop=Number(el.dataset.sy)||0;});
  }
  if(q.layout){layout=q.layout;allinea();}
  if(q.immagine&&$('immagine').getAttribute('src')!==q.immagine)$('immagine').src=q.immagine;
  if(q.ancora){ancora=q.ancora;requestAnimationFrame(allinea);}
 });
 $('contenuto').addEventListener('load',allinea,true);window.addEventListener('resize',()=>{inviaVista();requestAnimationFrame(allinea);});
 // I comandi LIM risaliti fino al bordo devono restare sotto il dito/la penna.
 window.addEventListener('pointermove',e=>{if(e.clientY<56&&!e.target.closest('#limProiezione'))mostraBarra();});$('barra').addEventListener('pointerleave',mostraBarra);$('barra').addEventListener('focusout',mostraBarra);
 window.addEventListener('keydown',e=>{if(e.key==='Tab')mostraBarra();if(e.key==='Escape'&&intero)comando({azione:'intero'});});
 function densita(){const media=matchMedia('(resolution: '+devicePixelRatio+'dppx)');media.addEventListener('change',()=>{inviaVista();densita();},{once:true});}
 annullaGesti=ProiezioneGesti.collega($('vista'),{leggiScala:()=>scala,zoom:ingrandisci,sposta:(dx,dy)=>comando({azione:'sposta',dx,dy}),adatta:()=>ingrandisci(100)});
 new ResizeObserver(()=>{inviaVista();requestAnimationFrame(allinea);}).observe($('vista'));
 new ResizeObserver(()=>document.documentElement.style.setProperty('--proiezione-barra-h',$('barra').getBoundingClientRect().height+'px')).observe($('barra'));
 densita();ingrandisci(100);mostraBarra();
}());
