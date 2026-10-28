(function(){
 'use strict';
 let ui,lista=[],corso='',edit=false,chiusa=false,giro=0;const scelti=new Set(),api=window.vault?.lim;
 const $=id=>document.getElementById(id),E=(t,s,c)=>{const e=document.createElement(t);if(s!=null)e.textContent=s;if(c)e.className=c;return e;};
 function b(nome,icona,fn){const e=E('button',null,'tbtn');e.type='button';e.title=nome;e.setAttribute('aria-label',nome);if(icona)e.innerHTML=UiIcone.svg(icona);else e.textContent=nome;e.onclick=()=>azione(fn);return e;}
 async function azione(fn){try{return await fn();}catch(e){window.toast?.(e.message,false);}}
 async function call(o){const r=await api.comando({...o,corso});if(!r.ok)throw Error(r.error);return r;}
 function nome(){window.bancoAggiornaDocumenti?.();}
 function spunta(ids,titolo,focus){
  const wrap=E('label',null,'zs-seleziona-area'),cb=E('input');wrap.title=titolo;cb.type='checkbox';cb.className='zs-seleziona';cb.setAttribute('aria-label',titolo);cb.dataset.limFocus=focus;cb.checked=ids.every(id=>scelti.has(id));cb.indeterminate=!cb.checked&&ids.some(id=>scelti.has(id));
  cb.onchange=e=>{e.stopPropagation();for(const id of ids){if(cb.checked)scelti.add(id);else scelti.delete(id);}sidebar();};wrap.append(cb);return wrap;
 }
 function sidebar(){
  const old=$('zs-lim'),focus=old?.contains(document.activeElement)?document.activeElement.dataset.limFocus:null;old?.remove();const host=$('zainoNav');if(!host||host.hidden||host.dataset.zaino!==corso||!lista.length)return;
  const section=E('section',null,'zs-raccolta');section.id='zs-lim';section.dataset.sezione='lim';
  const head=E('div',null,'zs-tit'),toggle=E('button',null,'zs-collapse'),body=E('div',null,'zs-corpo');body.id='zs-lim-corpo';toggle.dataset.limFocus='section';
  const freccia=E('span');freccia.setAttribute('aria-hidden','true');freccia.innerHTML=UiIcone.svg(chiusa?'chevron-right':'chevron-down');toggle.append(freccia,E('span','LIM'),E('span',String(lista.length),'zs-n'));toggle.title=(chiusa?'Espandi ':'Comprimi ')+'LIM';toggle.setAttribute('aria-expanded',String(!chiusa));toggle.setAttribute('aria-controls',body.id);toggle.onclick=()=>{chiusa=!chiusa;localStorage.setItem('studia.lim.chiusa.'+corso,String(chiusa));sidebar();};body.hidden=chiusa;
  const azioni=E('span',null,'zs-azioni');head.append(toggle,azioni);azioni.append(b('Nuova lavagnata','plus',()=>{bancoMostra('lim');return ui.nuova();}));const pen=b(edit?'Termina modifiche':'Modifica elenco LIM',edit?'check':'pencil',()=>{edit=!edit;scelti.clear();sidebar();});pen.dataset.limFocus='edit';pen.setAttribute('aria-pressed',String(edit));azioni.append(pen);section.append(head,body);
  if(edit){
   const del=b('Elimina selezionate','trash-2',async()=>{await ui.elimina([...scelti]);scelti.clear();await aggiorna();});del.disabled=!scelti.size;azioni.append(del);
   const bar=E('div',null,'zs-schede-selection'),all=spunta(lista.map(d=>d.id),'Seleziona tutte le lavagnate','all'),count=E('span',scelti.size+(scelti.size===1?' selezionata':' selezionate'),'zs-n');all.append(E('span','Seleziona tutte'));count.setAttribute('role','status');bar.append(all,count);body.append(bar);
  }
  const ul=E('ul');for(const d of lista){const row=E('li',null,'zs-item'),open=E('button',d.title,'lim-apri');open.type='button';open.title=d.title;open.dataset.limId=d.id;open.dataset.limFocus=d.id;if(ui.doc?.studia.id===d.id){open.classList.add('attivo');open.setAttribute('aria-current','page');}open.onclick=()=>azione(()=>apri(d.id));row.append(open);if(edit){
   const azioni=E('span',null,'zs-azioni'),rename=b('Rinomina '+d.title,'pencil',async()=>{const t=await window.askText('Titolo della lavagnata',d.title);if(t!==null){await call({azione:'rinomina',id:d.id,titolo:t});await aggiorna();}});rename.dataset.limFocus='rename:'+d.id;azioni.append(rename);row.append(azioni,spunta([d.id],'Seleziona '+d.title,'select:'+d.id));
  }ul.append(row);}body.append(ul);host.append(section);
  if(focus)([...section.querySelectorAll('[data-lim-focus]')].find(e=>e.dataset.limFocus===focus)||toggle).focus({preventScroll:true});
 }
 async function aggiorna(){const n=++giro,z=window.zainoAttivo?.()||'';if(!z)return;
  if(corso!==z){if(ui&&!ui.flush())return;corso=z;lista=[];edit=false;scelti.clear();chiusa=localStorage.getItem('studia.lim.chiusa.'+z)==='true';await ui.contesto(z);}
  const r=await call({azione:'elenco'});if(n!==giro||z!==window.zainoAttivo())return;lista=r.elenco;for(const id of scelti)if(!lista.some(d=>d.id===id))scelti.delete(id);sidebar();nome();if(window.bancoVisibile('lim'))await ui.assicurati();
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
  window.addEventListener('banco-layout',()=>{if(window.bancoVisibile('lim'))azione(async()=>{await aggiorna();await ui.assicurati();});});azione(aggiorna);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',avvia);else avvia();
})();
