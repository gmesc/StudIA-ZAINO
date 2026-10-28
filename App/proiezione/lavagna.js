(function(){
 'use strict';
 const $=id=>document.getElementById(id),api=window.proiezione;let ui=null,fonte=null,tipo='',ratio=.5,presa=null,taglio=null,citazione=null;
 async function azione(fn){try{return await fn();}catch(e){$('errore').hidden=false;$('errore').textContent=e.message;}}
 function misure(n){ratio=LimModello.rapporto(n);document.documentElement.style.setProperty('--lim-ratio',ratio*100+'%');$('limDivisore').setAttribute('aria-valuenow',String(Math.round(ratio*100)));}
 async function apri(id){
  document.body.dataset.lavagna='1';$('limProiezione').hidden=$('limDivisore').hidden=false;$('affianca').setAttribute('aria-pressed','true');$('affianca').title=$('affianca').ariaLabel='Nascondi lavagna';
  if(!ui)ui=LavagnaUI.monta($('limProiezione'),api.lim,{link:r=>api.comando({azione:'fonte',link:r})});
  if(id)await ui.apri(id);else await ui.assicurati();misure(ratio);controlli();
 }
 async function chiudi(){await ui?.salva();delete document.body.dataset.lavagna;$('limProiezione').hidden=$('limDivisore').hidden=true;$('affianca').setAttribute('aria-pressed','false');$('affianca').title=$('affianca').ariaLabel='Affianca lavagna';annullaTaglio();controlli();}
 function controlli(){$('citaLim').hidden=!fonte?.testo;$('ritagliaLim').hidden=!['pdf','mappa','immagine'].includes(tipo);}
 $('affianca').onclick=()=>azione(()=>document.body.dataset.lavagna?chiudi():apri());api.lavagna(d=>azione(()=>apri(d.id)));
 const div=$('limDivisore');div.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();presa=e.pointerId;div.setPointerCapture(e.pointerId);});
 div.addEventListener('pointermove',e=>{if(presa===e.pointerId)misure(e.clientX/innerWidth);});div.addEventListener('pointerup',()=>presa=null);div.addEventListener('lostpointercapture',()=>presa=null);
 div.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();misure(e.key==='Home'?.25:e.key==='End'?.75:ratio+(e.key==='ArrowRight'?.05:-.05));}});
 $('citaLim').onclick=()=>{if(!fonte)return;citazione={...fonte};$('limTestoCitazione').value=fonte.testo;$('limFonteCitazione').textContent=fonte.titolo;$('limCitazione').showModal();};
 $('limInserisciCitazione').onclick=()=>{const t=$('limTestoCitazione'),testo=t.selectionEnd>t.selectionStart?t.value.slice(t.selectionStart,t.selectionEnd):t.value,ref=RimandiSintassi.leggi(citazione.link),link=ref?.tipo==='pdf-zaino'?RimandiSintassi.scriviPdfZaino(ref.zainoId,ref.sourceId,ref.pagina,ref.revision,{testo,inizio:0}):citazione.link,d={testo,titolo:citazione.titolo,link};azione(async()=>{await apri();await ui.inserisci(d);});};
 function annullaTaglio(){taglio=null;$('limRitaglio').hidden=true;$('limRitaglio').firstChild.style.cssText='';$('ritagliaLim').setAttribute('aria-pressed','false');}
 $('ritagliaLim').onclick=()=>{const r=$('vista').getBoundingClientRect(),overlay=$('limRitaglio');if(!overlay.hidden){annullaTaglio();return;}overlay.style.width=r.width+'px';overlay.hidden=false;$('ritagliaLim').setAttribute('aria-pressed','true');};
 const overlay=$('limRitaglio');overlay.addEventListener('pointerdown',e=>{e.preventDefault();taglio={x:e.clientX,y:e.clientY,id:e.pointerId};overlay.setPointerCapture(e.pointerId);});
 overlay.addEventListener('pointermove',e=>{if(taglio?.id!==e.pointerId)return;Object.assign(overlay.firstChild.style,{left:Math.min(taglio.x,e.clientX)+'px',top:Math.min(taglio.y,e.clientY)+'px',width:Math.abs(taglio.x-e.clientX)+'px',height:Math.abs(taglio.y-e.clientY)+'px'});});
 overlay.addEventListener('pointerup',e=>{if(taglio?.id!==e.pointerId)return;const a=taglio,r=$('immagine').getBoundingClientRect(),img=$('immagine'),x=Math.max(0,Math.min(a.x,e.clientX)-r.x),y=Math.max(0,Math.min(a.y,e.clientY)-r.y),w=Math.min(r.width-x,Math.abs(a.x-e.clientX)),h=Math.min(r.height-y,Math.abs(a.y-e.clientY));annullaTaglio();if(w<8||h<8)return;
  const k=img.naturalWidth/r.width,c=document.createElement('canvas');c.width=Math.round(w*k);c.height=Math.round(h*k);c.getContext('2d').drawImage(img,x*k,y*k,w*k,h*k,0,0,c.width,c.height);const d={immagine:c.toDataURL(),width:c.width,height:c.height,titolo:fonte?.titolo||$('titolo').textContent,link:fonte?.link||''};azione(async()=>{await apri();await ui.inserisci(d);});
 });overlay.addEventListener('pointercancel',annullaTaglio);window.addEventListener('keydown',e=>{if(e.key==='Escape')annullaTaglio();});
 window.ProiezioneLavagna={apri,chiudi,get editor(){return ui;},quadro(q){tipo=q.tipo;fonte=q.fonte||null;controlli();}};
})();
