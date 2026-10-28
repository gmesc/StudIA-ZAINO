(function(){
 'use strict';
 let ui,lista=[],corso='',edit=false,chiusa=false,ultimo=[],giro=0;const scelti=new Set(),api=window.vault?.lim;
 const $=id=>document.getElementById(id),E=(t,s,c)=>{const e=document.createElement(t);if(s!=null)e.textContent=s;if(c)e.className=c;return e;};
 function b(nome,icona,fn){const e=E('button',null,'tbtn');e.type='button';e.title=nome;e.setAttribute('aria-label',nome);if(icona)e.innerHTML=UiIcone.svg(icona);else e.textContent=nome;e.onclick=()=>azione(fn);return e;}
 async function azione(fn){try{return await fn();}catch(e){window.toast?.(e.message,false);}}
 async function call(o){const r=await api.comando({...o,corso});if(!r.ok)throw Error(r.error);return r;}
 function nome(){window.bancoAggiornaDocumenti?.();}
 function sidebar(){
  $('limAnnulla')?.remove();if(ultimo.length){const undo=b('Annulla eliminazione lavagnate','undo-2',async()=>{await call({azione:'ripristina',ids:ultimo});ultimo=[];await aggiorna();});undo.id='limAnnulla';$('limPane').querySelector('.lim-bar').append(undo);}
  $('zs-lim')?.remove();const host=$('zainoNav');if(!host||host.hidden||host.dataset.zaino!==corso||!lista.length)return;
  const section=E('section',null,'zs-raccolta');section.id='zs-lim';section.dataset.sezione='lim';
  const head=E('div',null,'zs-tit'),toggle=E('button',null,'zs-collapse'),body=E('div',null,'zs-corpo');body.id='zs-lim-corpo';
  const freccia=E('span');freccia.setAttribute('aria-hidden','true');freccia.innerHTML=UiIcone.svg(chiusa?'chevron-right':'chevron-down');toggle.append(freccia,E('span','LIM'),E('span',String(lista.length),'zs-n'));toggle.setAttribute('aria-expanded',String(!chiusa));toggle.setAttribute('aria-controls',body.id);toggle.onclick=()=>{chiusa=!chiusa;localStorage.setItem('studia.lim.chiusa.'+corso,String(chiusa));sidebar();};body.hidden=chiusa;
  const azioni=E('span',null,'zs-azioni');head.append(toggle,azioni);azioni.append(b('Nuova lavagnata','plus',()=>{bancoMostra('lim');return ui.nuova();}));const pen=b(edit?'Termina modifiche':'Modifica elenco LIM',edit?'check':'pencil',()=>{edit=!edit;scelti.clear();sidebar();});pen.setAttribute('aria-pressed',String(edit));azioni.append(pen);section.append(head,body);
  if(edit){const bar=E('div',null,'lim-azioni'),all=E('input');all.type='checkbox';all.title='Seleziona tutte le lavagnate';all.setAttribute('aria-label',all.title);all.checked=lista.every(x=>scelti.has(x.id));all.onchange=()=>{scelti.clear();if(all.checked)lista.forEach(d=>scelti.add(d.id));sidebar();};const del=b('Elimina selezionate','trash-2',async()=>{const r=await call({azione:'elimina',ids:[...scelti]});ultimo=r.rimossi;scelti.clear();await aggiorna();});del.disabled=!scelti.size;bar.append(all,E('span',scelti.size+' selezionate'),del);body.append(bar);}
  const ul=E('ul',null,'lim-elenco');for(const d of lista){const row=E('li',null,'lim-voce'),open=E('button',d.title,'lim-apri');open.title=d.title;open.dataset.limId=d.id;if(ui.doc?.studia.id===d.id)open.setAttribute('aria-current','page');open.onclick=()=>azione(()=>apri(d.id));row.append(open);if(edit){row.append(b('Rinomina '+d.title,'pencil',async()=>{const t=await window.askText('Titolo della lavagnata',d.title);if(t!==null){await call({azione:'rinomina',id:d.id,titolo:t});await aggiorna();}}));const cb=E('input');cb.type='checkbox';cb.setAttribute('aria-label','Seleziona '+d.title);cb.checked=scelti.has(d.id);cb.onchange=()=>{if(cb.checked)scelti.add(d.id);else scelti.delete(d.id);sidebar();};row.append(cb);}ul.append(row);}body.append(ul);
  host.append(section);
 }
 async function aggiorna(){const n=++giro,z=window.zainoAttivo?.()||'';if(!z)return;
  if(corso!==z){if(ui&&!ui.flush())return;corso=z;lista=[];edit=false;scelti.clear();ultimo=[];chiusa=localStorage.getItem('studia.lim.chiusa.'+z)==='true';await ui.contesto(z);}
  const r=await call({azione:'elenco'});if(n!==giro||z!==window.zainoAttivo())return;lista=r.elenco;sidebar();nome();
 }
 async function apri(id){bancoMostra('lim');await ui.apri(id);sidebar();nome();}
 async function trasferisci(d){await aggiorna();const r=await call({azione:'elenco'});if(r.attiva&&r.attiva!==ui.doc?.studia.id)await ui.apri(r.attiva);await ui.inserisci(d);await aggiorna();
  const p=await window.vault.presentazione.lavagna({id:ui.doc.studia.id});if(!p?.aperta)bancoMostra('lim');window.toast?.('Inserito in «'+ui.doc.studia.title+'»',true);
 }
 async function citazione(testo,range){const o=window.citazioneOriginePdf(range);if(!o)throw Error('Seleziona il testo di una sola pagina PDF.');
  const r=await window.vault.citazioni.crea(corso,o.file,o.pagina,testo);if(r.error)throw Error(r.error);let link=r.rimando;
  const ref=RimandiSintassi.leggi(link),layer=range.startContainer.parentElement?.closest('.textLayer');
  if(layer){const pre=document.createRange();pre.selectNodeContents(layer);pre.setEnd(range.startContainer,range.startOffset);link=RimandiSintassi.scriviPdfZaino(ref.zainoId,ref.sourceId,o.pagina,ref.revision,{testo:range.toString(),inizio:pre.toString().length})||link;}
  await trasferisci({testo,titolo:FontiNomi.visibile(o.file)+'; p. '+o.pagina,link});
 }
 async function ritaglio(id){const v=window.albumVoce(id);if(!v)throw Error('Ritaglio non disponibile.');const img=new Image();img.src=window.vault.album.srcUrl(corso,id,'full');await img.decode();const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext('2d').drawImage(img,0,0);
  let link='',titolo=v.didascalia||'Ritaglio';if(v.materiale&&v.pagina){const r=await window.vault.citazioni.crea(corso,v.materiale,v.pagina,'');if(!r.error){link=r.rimando;titolo=FontiNomi.visibile(v.materiale)+'; p. '+v.pagina;}}
  await trasferisci({immagine:c.toDataURL(),width:c.width,height:c.height,titolo,link});
 }
 function link(r){const d=RimandiSintassi.leggi(r);if(d?.tipo==='pdf-zaino')window.citazioneZainoApri(r);else if(d?.tipo==='pdf'){const file=window._pdfNum()[d.numero];if(file)window.openPdf(file,d.pagina);else window.toast?.('Fonte non disponibile nello zaino attivo.',false);}}
 function avvia(){if(!api)return;ui=LavagnaUI.monta($('limPane'),api,{link,cambiata:()=>{sidebar();nome();}});
  window.ZainoLim={apri,trasferisci,citazione:(t,r)=>azione(()=>citazione(t,r.cloneRange())),ritaglio:id=>azione(()=>ritaglio(id)),get doc(){return ui.doc;},get editor(){return ui;},link};
  window.vault.presentazione.onFonte(d=>link(d.link));
  api.onCambiata(d=>{if(d.corso===corso)azione(aggiorna);});window.addEventListener('studia:zaino-changed',()=>azione(aggiorna));window.addEventListener('studia:sidebar-updated',sidebar);
  window.addEventListener('banco-layout',()=>{if(window.bancoVisibile('lim'))azione(async()=>{await aggiorna();if(!ui.doc&&lista.length)await ui.apri(lista[0].id);});});azione(aggiorna);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',avvia);else avvia();
})();
