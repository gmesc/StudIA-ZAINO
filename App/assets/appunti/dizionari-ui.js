/* Catalogo locale e scelta dei dizionari: una preferenza per tutti gli editor. */
(function(){
 'use strict';
 const chiave='zaino.appunti.ortografia',secondaChiave='zaino.appunti.secondaLingua';
 let lingue=[{id:'it',nome:'Italiano',sigla:'ITA',installato:true,incluso:true},{id:'en',nome:'English (US)',sigla:'ENG',installato:true,incluso:true}],caricamento;
 const risorse=new Map();
 function seconda(){const id=localStorage.getItem(secondaChiave)||'en';return lingue.some(d=>d.id===id&&d.installato&&id!=='it')?id:'en';}
 function valore(){const v=localStorage.getItem(chiave)||'';if(!v)return '';if(v.startsWith('it-'))return 'it-'+seconda();return lingue.some(d=>d.id===v&&d.installato)?v:'it';}
 function sigla(id){return lingue.find(d=>d.id===id)?.sigla||id.toUpperCase();}
 function etichetta(v){return v?v.split('-').map(sigla).join(' + '):'OFF';}
 function notifica(){window.dispatchEvent(new Event('zaino:ortografia'));}
 function scegli(v){localStorage.setItem(chiave,v);notifica();}
 async function catalogo(){
  if(!caricamento)caricamento=(async()=>{const r=await window.vault.dizionari.catalogo();if(!r.ok)throw Error(r.error||'Catalogo non disponibile.');lingue=r.lingue;notifica();return lingue;})().finally(()=>{caricamento=null;});
  return caricamento;
 }
 function bottone(testo,icona,fn){const b=document.createElement('button');b.type='button';b.className='tbtn';if(icona)b.innerHTML=UiIcone.svg(icona);const t=document.createElement('span');t.textContent=testo;b.append(t);b.onclick=fn;return b;}
 function finestra(titolo){
  document.querySelectorAll('.note-dizionari-menu:popover-open').forEach(p=>p.hidePopover());
  const d=document.createElement('dialog');d.className='note-dizionari-dialog';d.setAttribute('aria-label',titolo);
  const testa=document.createElement('div');testa.className='tbar';const h=document.createElement('h3');h.textContent=titolo;
  const chiudi=bottone('','x',()=>d.close());chiudi.setAttribute('aria-label','Chiudi');testa.append(h,chiudi);d.append(testa);document.body.append(d);
  d.addEventListener('close',()=>d.remove());d.showModal();return d;
 }
 async function scarica(){
  const d=finestra('Scarica dizionari'),stato=document.createElement('p'),lista=document.createElement('div');stato.setAttribute('role','status');d.append(stato,lista);stato.textContent='Caricamento catalogo…';
  try{
   await catalogo();if(!d.isConnected)return;stato.textContent='Dopo il download i dizionari funzionano anche senza Internet.';
   for(const l of lingue.filter(l=>!l.incluso)){
    const r=document.createElement('div');r.className='note-dizionario-riga';const nome=document.createElement('span');nome.textContent=l.nome+' ('+l.sigla+') · '+l.licenza+' · '+(l.bytes/1048576).toFixed(1)+' MB';
    const b=bottone(l.installato?'Installato':'Scarica',l.installato?'check':'download',async()=>{
     b.disabled=true;stato.textContent='Download di '+l.nome+'…';
     try{const esito=await window.vault.dizionari.scarica(l.id);if(!esito.ok)throw Error(esito.error||'Download non riuscito.');lingue=esito.lingue;notifica();b.replaceChildren(document.createTextNode('Installato'));stato.textContent=l.nome+' installato. Puoi selezionarlo o abbinarlo a ITA.';}
     catch(e){stato.textContent=e.message;b.disabled=false;}
    });b.dataset.dizionarioScarica=l.id;b.disabled=l.installato;r.append(nome,b);lista.append(r);
   }
  }catch(e){stato.textContent=e.message;}
 }
 async function abbina(){
  const d=finestra('Abbina i dizionari'),stato=document.createElement('p');stato.setAttribute('role','status');d.append(stato);
  try{await catalogo();if(!d.isConnected)return;
   const r=document.createElement('label');r.textContent='ITA + ';const select=document.createElement('select');select.setAttribute('aria-label','Secondo dizionario');
   for(const l of lingue.filter(l=>l.installato&&l.id!=='it')){const o=document.createElement('option');o.value=l.id;o.textContent=l.sigla+' · '+l.nome;select.append(o);}select.value=seconda();r.append(select);d.append(r);
   stato.textContent='Italiano resta il primo dizionario. Scegli il secondo fra quelli installati.';
   const azioni=document.createElement('div');azioni.className='tbar';azioni.append(bottone('Annulla',null,()=>d.close()),bottone('Salva coppia','check',()=>{localStorage.setItem(secondaChiave,select.value);if(valore().includes('-'))localStorage.setItem(chiave,'it-'+select.value);notifica();d.close();}));d.append(azioni);select.focus();
  }catch(e){stato.textContent=e.message;}
 }
 function installa(bar){
  const b=bottone('','chevron-down',()=>apri(b));b.classList.add('note-lingua','no-disable');b.setAttribute('aria-haspopup','menu');b.setAttribute('aria-expanded','false');bar.append(b);
  function aggiorna(){
   const misura=document.createElement('span');misura.className='note-lingua-misura';
   const attuale=document.createElement('span');attuale.textContent=etichetta(valore());misura.append(attuale);
   for(const t of [...lingue.filter(l=>l.installato).map(l=>l.sigla),...lingue.filter(l=>l.installato&&l.id!=='it').map(l=>'ITA + '+l.sigla)]){const s=document.createElement('span');s.textContent=t;s.setAttribute('aria-hidden','true');s.style.visibility='hidden';misura.append(s);}
   b.replaceChildren(misura);b.insertAdjacentHTML('beforeend',UiIcone.svg('chevron-down'));b.dataset.lingua=valore();b.title='Controllo ortografico: '+etichetta(valore());b.setAttribute('aria-label',b.title);
  }
  window.addEventListener('zaino:ortografia',aggiorna);aggiorna();catalogo().catch(()=>{});
  return {get value(){return valore();}};
 }
 function apri(b){
  document.querySelectorAll('.note-dizionari-menu').forEach(m=>m.matches(':popover-open')?m.hidePopover():m.remove());const p=document.createElement('div');p.className='note-dizionari-menu';p.popover='auto';p.setAttribute('role','menu');p.setAttribute('aria-label','Controllo ortografico');
  for(const v of ['',...lingue.filter(l=>l.installato).map(l=>l.id),'it-'+seconda()]){
   const item=bottone(v?etichetta(v):'OFF · Ortografia spenta','check',()=>{scegli(v);p.hidePopover();b.focus();});item.querySelector('svg').style.visibility=valore()===v?'visible':'hidden';item.dataset.lingua=v;item.setAttribute('role','menuitemradio');item.setAttribute('aria-checked',String(valore()===v));p.append(item);
  }
  const sep=document.createElement('hr');p.append(sep);
  for(const [t,icona,fn,id] of [['Scarica altri dizionari','download',scarica,'scarica'],['Abbina dizionari','settings',abbina,'abbina']]){const item=bottone(t,icona,fn);item.dataset.dizionariAzione=id;item.setAttribute('role','menuitem');p.append(item);}
  document.body.append(p);p.showPopover();b.setAttribute('aria-expanded','true');const r=b.getBoundingClientRect();p.style.left=Math.max(8,Math.min(r.left,innerWidth-p.offsetWidth-8))+'px';p.style.top=Math.max(8,Math.min(r.bottom+4,innerHeight-p.offsetHeight-8))+'px';p.querySelector('[aria-checked=true]').focus();
  p.addEventListener('keydown',e=>{const buttons=[...p.querySelectorAll('button')],i=buttons.indexOf(document.activeElement);if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length].focus();}if(e.key==='Escape')b.focus();});
  p.addEventListener('toggle',()=>{if(!p.matches(':popover-open')){b.setAttribute('aria-expanded','false');p.remove();}});
 }
 async function carica(v,inviati){
  const extra=[];
  for(const id of v.split('-').filter(l=>l&&!['it','en'].includes(l)&&!inviati.has(l))){
   if(!risorse.has(id))risorse.set(id,window.vault.dizionari.dati(id).then(r=>{if(!r.ok)throw Error(r.error);return {id,aff:r.aff,dic:r.dic};}).catch(e=>{risorse.delete(id);throw e;}));
   extra.push(await risorse.get(id));
  }return extra;
 }
 window.AppuntiDizionari={installa,carica};
})();
