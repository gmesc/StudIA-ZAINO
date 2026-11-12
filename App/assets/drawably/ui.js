/* La libreria restituisce un disegno vettoriale: l’editor conserva una sola operazione annullabile. */
(function(){
 'use strict';
 const url=new URL('catalogo.js',document.currentScript.src).href;
 let caricamento;
 async function carica(){if(!caricamento)caricamento=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.onload=resolve;s.onerror=()=>{s.remove();caricamento=null;reject(Error('Libreria Drawably non disponibile.'));};document.head.append(s);});await caricamento;return ZainoDrawablyCatalogo;}
 const E=(tag,testo,cls)=>{const e=document.createElement(tag);if(testo!==undefined)e.textContent=testo;if(cls)e.className=cls;return e;};
 async function apri(disegno){
  const prima=document.activeElement,S=await carica(),dialog=E('dialog',undefined,'squig-dialog drawably-dialog tbar-ctl'),bar=E('div',undefined,'tbar'),corpo=E('div',undefined,'squig-corpo'),sinistra=E('section',undefined,'squig-elenco'),destra=E('section',undefined,'squig-proprieta'),griglia=E('div',undefined,'squig-griglia'),anteprima=E('div',undefined,'squig-anteprima drawably-anteprima'),campi=E('div',undefined,'squig-campi'),errore=E('output',undefined,'squig-errore');
  dialog.setAttribute('aria-label','Componenti Drawably');errore.setAttribute('role','status');
  let config=disegno?.drawably?S.esigi(disegno.drawably):S.nuova(),risultato=null;
  const b=(nome,fn)=>{const e=E('button',nome,'tbtn');e.type='button';e.onclick=fn;return e;};
  const salva=b(disegno?'Aggiorna componente':'Inserisci componente',()=>{try{const v=S.disegno(config);if(!PresentaVettori.valida(v))throw Error('Il componente supera i limiti del disegno.');risultato=v;dialog.close();}catch(e){errore.textContent=e.message;}});
  bar.append(E('strong','Componenti Drawably'),E('span',undefined,'tbspazio'),b('Annulla',()=>dialog.close()),salva);
  const ricerca=E('input'),gruppo=E('select');ricerca.type='search';ricerca.setAttribute('aria-label','Cerca componenti');gruppo.setAttribute('aria-label','Gruppo di componenti');gruppo.add(new Option('Tutti i gruppi',''));for(const g of [...new Set(S.catalogo.map(d=>d.group))])gruppo.add(new Option(g,g));
  function campo(nome,valore,fn,{tipo='text',opzioni,min,max,step}={}){
   const label=E('label'),titolo=E('span',nome),input=E(opzioni?'select':tipo==='textarea'?'textarea':'input');input.setAttribute('aria-label',nome);
   if(opzioni)for(const [val,testo]of opzioni)input.add(new Option(testo,val));else{if(tipo!=='textarea')input.type=tipo;if(['text','textarea'].includes(tipo))input.maxLength=2000;if(tipo==='number')input.step=step||'any';if(min!==undefined)input.min=min;if(max!==undefined)input.max=max;}
   if(tipo==='checkbox')input.checked=valore;else input.value=valore??'';
   input.onchange=()=>{if(!input.checkValidity()){input.reportValidity();return;}fn(tipo==='checkbox'?input.checked:tipo==='number'?Number(input.value):input.value);};label.append(titolo,input);return label;
  }
  function disegna(){try{anteprima.innerHTML=PresentaVettori.html(S.disegno(config),'drawably-anteprima-');salva.disabled=false;errore.textContent='';}catch(e){salva.disabled=true;errore.textContent=e.message;}}
  function proprieta(){
   const d=S.catalogo.find(d=>d.kind===config.componente),k=config.componente;campi.replaceChildren();destra.querySelector('h3').textContent=d.name;
   for(const [chiave,nome]of [['larghezza','Larghezza del componente'],['altezza','Altezza del componente']])campi.append(campo(nome,config[chiave],v=>{config[chiave]=v;disegna();},{tipo:'number',min:32,max:2000}));
   const p=config.proprieta,prop=(nome,chiave,opzioni={})=>campo(nome,p[chiave],v=>{p[chiave]=v;disegna();},opzioni);
   if(k!=='divider')campi.append(prop(['tabs','pager'].includes(k)?'Voci separate da |':'Testo','testo',{tipo:['list','steps','textarea','quote','card','alert'].includes(k)?'textarea':'text'}));
   if(['card','alert','quote'].includes(k))campi.append(prop(k==='quote'?'Autore':'Descrizione','secondario',{tipo:'textarea'}));
   if(['button','badge','kbd','chip'].includes(k))campi.append(prop('Variante','variante',{opzioni:[['outline','Contorno'],['solid','Pieno'],['scribble','Scarabocchio']]}));
   if(['checkbox','radio','toggle','chip','tabs','pager'].includes(k))campi.append(prop(['tabs','pager'].includes(k)?'Seconda voce attiva':'Selezionato','attivo',{tipo:'checkbox'}));
   for(const [chiave,nome]of [['colore','Colore del tratto e del testo'],['fondo','Colore del riempimento'],['carta','Colore della carta']])campi.append(prop(nome,chiave,{tipo:'color'}));
   campi.append(prop('Spessore del tratto','spessore',{tipo:'number',min:.5,max:8,step:.5}),prop('Irregolarità del tratto','ruvidita',{tipo:'number',min:0,max:2,step:.1}),b('Nuovo tratto',()=>{config.seme=config.seme%2147483647+1;disegna();}));disegna();
  }
  function elenco(){
   griglia.replaceChildren();const q=ricerca.value.trim().toLowerCase(),defs=S.catalogo.filter(d=>(!gruppo.value||d.group===gruppo.value)&&[d.name,d.kind,d.group].join(' ').toLowerCase().includes(q));
   for(const d of defs){const t=b(d.name,()=>{const p=config.proprieta;config=S.nuova(d.kind);for(const k of ['colore','fondo','carta','spessore','ruvidita'])config.proprieta[k]=p[k];proprieta();elenco();});t.dataset.drawably=d.kind;t.classList.add('squig-scelta','drawably-scelta');t.setAttribute('aria-pressed',String(d.kind===config.componente));const svg=E('span',undefined,'squig-miniatura');svg.setAttribute('aria-hidden','true');svg.innerHTML=PresentaVettori.html(S.disegno(S.nuova(d.kind)),'drawably-'+d.kind+'-');t.prepend(svg);griglia.append(t);}
   if(!defs.length)griglia.append(E('p','Nessun componente corrisponde alla ricerca.'));
  }
  ricerca.oninput=gruppo.onchange=elenco;const filtro=E('div',undefined,'squig-filtri'),cerca=E('label'),categoria=E('label');cerca.append(E('span','Cerca componenti'),ricerca);categoria.append(E('span','Gruppo'),gruppo);filtro.append(cerca,categoria);sinistra.append(filtro,griglia);destra.append(E('h3'),anteprima,campi);corpo.append(sinistra,destra);
  dialog.append(bar,E('p','23 adattamenti vettoriali dei controlli e delle decorazioni Drawably. Pulsanti e moduli sono illustrazioni statiche; per navigare usa la Navbar.','squig-aiuto'),corpo,errore,E('small','Drawably © 2026 Daniel Belyi · MIT. Carattere Patrick Hand · SIL OFL 1.1.'));
  document.body.append(dialog);proprieta();elenco();dialog.showModal();ricerca.focus();return new Promise(resolve=>dialog.addEventListener('close',()=>{dialog.remove();prima?.focus({preventScroll:true});resolve(risultato);},{once:true}));
 }
 window.ZainoDrawablyUI={apri};
})();
