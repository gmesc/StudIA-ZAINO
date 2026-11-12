/* La finestra restituisce un disegno completo: il salvataggio resta una sola operazione annullabile. */
(function(){
 'use strict';
 const url=new URL('catalogo.js',document.currentScript.src).href;
 let caricamento;
 async function carica(){
  if(!caricamento)caricamento=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.onload=resolve;s.onerror=()=>{s.remove();caricamento=null;reject(Error('Libreria Squig non disponibile.'));};document.head.append(s);});
  await caricamento;await ZainoSquigCatalogo.prepara();return ZainoSquigCatalogo;
 }
 const E=(tag,testo,cls)=>{const e=document.createElement(tag);if(testo!==undefined)e.textContent=testo;if(cls)e.className=cls;return e;};
 const etichette={Label:'Testo',Title:'Titolo',Subtitle:'Sottotitolo',Description:'Descrizione',Variant:'Variante',Size:'Dimensione',Icon:'Icona',Text:'Testo',Value:'Valore',Placeholder:'Segnaposto',Disabled:'Disabilitato',Checked:'Selezionato',Selected:'Selezionato',Items:'Voci',Rows:'Righe',Columns:'Colonne',Count:'Quantità',Progress:'Avanzamento',Color:'Colore','Icon side':'Posizione dell’icona',Initials:'Iniziali',Shape:'Forma',Content:'Contenuto',Direction:'Direzione'};
 const cercaItaliano={pulsante:'button',scheda:'card',freccia:'arrow',grafico:'chart',tabella:'table',modulo:'form',navigazione:'nav',immagine:'image',icona:'icon'};
 async function apri(disegno){
  const prima=document.activeElement,S=await carica(),dialog=E('dialog',undefined,'squig-dialog tbar-ctl'),bar=E('div',undefined,'tbar'),corpo=E('div',undefined,'squig-corpo'),sinistra=E('section',undefined,'squig-elenco'),destra=E('section',undefined,'squig-proprieta'),griglia=E('div',undefined,'squig-griglia'),anteprima=E('div',undefined,'squig-anteprima'),campi=E('div',undefined,'squig-campi'),errore=E('output',undefined,'squig-errore');
  dialog.setAttribute('aria-label','Componenti Squig');errore.setAttribute('role','status');
  let config=disegno?.squig?S.esigi(disegno.squig):S.nuova(),risultato=null,pagina=0;
  const b=(nome,fn)=>{const e=E('button',nome,'tbtn');e.type='button';e.onclick=fn;return e;};
  const salva=b(disegno?'Aggiorna componente':'Inserisci componente',()=>{try{const v=S.disegno(config);if(!PresentaVettori.valida(v))throw Error('Il componente supera i limiti del disegno.');risultato=v;dialog.close();}catch(e){errore.textContent=e.message;}});
  bar.append(E('strong','Componenti Squig'),E('span',undefined,'tbspazio'),b('Annulla',()=>dialog.close()),salva);
  const ricerca=E('input'),gruppo=E('select'),stato=E('output');ricerca.type='search';ricerca.setAttribute('aria-label','Cerca componenti');gruppo.setAttribute('aria-label','Gruppo di componenti');gruppo.add(new Option('Tutti i gruppi',''));for(const g of [...new Set(S.catalogo.map(d=>d.group))])gruppo.add(new Option(g,g));
  function campo(nome,valore,fn,{tipo='text',opzioni,min,max}={}){
   const label=E('label'),titolo=E('span',nome),input=E(opzioni?'select':tipo==='text'&&String(valore).includes('\n')?'textarea':'input');input.setAttribute('aria-label',nome);
   if(opzioni)for(const [val,testo]of opzioni)input.add(new Option(testo,val));else{input.type=tipo;if(tipo==='text')input.maxLength=10000;if(tipo==='number')input.step='any';if(min!==undefined)input.min=min;if(max!==undefined)input.max=max;}
   if(tipo==='checkbox')input.checked=valore;else input.value=valore??'';
   input.onchange=()=>{if(!input.checkValidity()){input.reportValidity();return;}fn(tipo==='checkbox'?input.checked:tipo==='number'?Number(input.value):input.value);};label.append(titolo,input);return label;
  }
  function disegna(){try{anteprima.innerHTML=PresentaVettori.html(S.disegno(config),'squig-anteprima-');salva.disabled=false;errore.textContent='';}catch(e){salva.disabled=true;errore.textContent=e.message;}}
  function proprieta(){
   const d=S.catalogo.find(d=>d.kind===config.componente);campi.replaceChildren();destra.querySelector('h3').textContent=d.name;
   campi.append(campo('Palette Squig',config.tema,v=>{config.tema=v;disegna();},{opzioni:Object.keys(S.temi).map(k=>[k,S.nomi[k]])}));
   for(const [k,nome]of [['larghezza','Larghezza del componente'],['altezza','Altezza del componente']])campi.append(campo(nome,config[k],v=>{config[k]=v;disegna();},{tipo:'number',min:16,max:2000}));
   for(const c of d.controls){const cond=c.visibleWhen;if(cond&&![].concat(cond.equals).includes(config.proprieta[cond.key]))continue;
    const label=campo(etichette[c.label]||c.label,config.proprieta[c.key],v=>{config.proprieta[c.key]=v;disegna();if(d.controls.some(x=>x.visibleWhen?.key===c.key))proprieta();},{tipo:c.type==='toggle'?'checkbox':c.type==='number'?'number':'text',...(c.type==='select'?{opzioni:c.options.map(v=>[v,v])}:{}),min:c.min,max:c.max});
    if(c.type==='icon'){label.querySelector('input').setAttribute('list','squig-icone');label.append(E('small','Nome Phosphor, per esempio arrow-right o star.'));}campi.append(label);
   }
   disegna();
  }
  function elenco(){
   griglia.replaceChildren();const q=ricerca.value.trim().toLowerCase(),query=cercaItaliano[q]||q,defs=S.catalogo.filter(d=>(!gruppo.value||d.group===gruppo.value)&&[d.name,d.kind,d.group,...(d.keywords||[])].join(' ').toLowerCase().includes(query));
   const pagine=Math.max(1,Math.ceil(defs.length/24));pagina=Math.min(pagina,pagine-1);stato.textContent=defs.length+' componenti · pagina '+(pagina+1)+' di '+pagine;indietro.disabled=pagina===0;avanti.disabled=pagina===pagine-1;
   for(const d of defs.slice(pagina*24,pagina*24+24)){
    const t=b(d.name,()=>{const tema=config.tema;config={...S.nuova(d.kind),tema};proprieta();elenco();});t.dataset.squig=d.kind;t.classList.add('squig-scelta');t.setAttribute('aria-pressed',String(d.kind===config.componente));
    const svg=E('span',undefined,'squig-miniatura');svg.setAttribute('aria-hidden','true');svg.innerHTML=PresentaVettori.html(S.disegno(S.nuova(d.kind)),'squig-'+d.kind+'-');t.prepend(svg);griglia.append(t);
   }
  }
  const paginazione=E('div',undefined,'tbar'),indietro=b('Precedenti',()=>{pagina--;elenco();}),avanti=b('Successivi',()=>{pagina++;elenco();});paginazione.append(indietro,stato,avanti);
  ricerca.oninput=gruppo.onchange=()=>{pagina=0;elenco();};
  const filtro=E('div',undefined,'squig-filtri'),cerca=E('label'),categoria=E('label');cerca.append(E('span','Cerca componenti'),ricerca);categoria.append(E('span','Gruppo'),gruppo);filtro.append(cerca,categoria);sinistra.append(filtro,griglia,paginazione);
  const lista=E('datalist');lista.id='squig-icone';for(const nome of S.icone)lista.append(new Option(nome,nome));
  destra.append(E('h3'),anteprima,campi,lista);corpo.append(sinistra,destra);dialog.append(bar,E('p','Elementi grafici modificabili: testi, varianti e colori. I pulsanti e i moduli inseriti nelle slide sono illustrazioni.','squig-aiuto'),corpo,errore,E('small','Squig © 2026 Pablo Stanley · MIT. Icone Phosphor · MIT. Patrick Hand · SIL OFL 1.1.'));
  document.body.append(dialog);proprieta();elenco();dialog.showModal();ricerca.focus();
  return new Promise(resolve=>dialog.addEventListener('close',()=>{dialog.remove();prima?.focus({preventScroll:true});resolve(risultato);},{once:true}));
 }
 window.ZainoSquigUI={apri};
})();
