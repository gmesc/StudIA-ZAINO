/* Il file scelto diventa un'immagine autonoma; nessun URL esterno nel documento. */
(function(){
 'use strict';
 const F=ZainoSfondi,E=(tag,txt)=>{const e=document.createElement(tag);if(txt!==undefined)e.textContent=txt;return e;};
 // Un riferimento locale può essere quotato; si esamina il contenuto di ogni url().
 function urlEsterno(testo){return [...testo.matchAll(/url\(\s*([^)]*)\)/gi)].some(m=>!/^#[A-Za-z_][\w:.-]*$/.test(m[1].trim().replace(/^(["'])(.*)\1$/,'$2')));}
 async function immagine(file){
  if(!file||file.size>F.LIMITE_FILE)throw Error('Scegli un’immagine entro 10 MiB.');
  if(!/\.(svg|png|jpe?g|webp)$/i.test(file.name))throw Error('Usa SVG, PNG, JPEG o WebP.');
  let blob=file;
  if(/\.svg$/i.test(file.name)){
   const testo=await file.text();if(/<!DOCTYPE|<!ENTITY/i.test(testo))throw Error('Lo SVG contiene riferimenti esterni non supportati.');
   const d=new DOMParser().parseFromString(testo,'image/svg+xml'),svg=d.documentElement;
   if(d.querySelector('parsererror')||svg.localName!=='svg'||svg.namespaceURI!=='http://www.w3.org/2000/svg')throw Error('SVG non leggibile.');
   if(d.querySelectorAll('*').length>20000)throw Error('Lo SVG è troppo complesso.');
   for(const e of d.querySelectorAll('*')){
    if(['script','foreignObject','iframe','object','embed','animate','set','animateTransform','animateMotion'].includes(e.localName))throw Error('Usa uno SVG statico, senza script o contenuti HTML.');
    for(const a of e.attributes){if(urlEsterno(a.value)||/^on/i.test(a.name)||((a.localName==='href'||a.localName==='src')&&!/^#|^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(a.value)))throw Error('Lo SVG deve contenere tutte le sue risorse, senza collegamenti esterni.');}
    const css=(e.localName==='style'?e.textContent:'')+' '+(e.getAttribute('style')||'');
    if(/@import|@font-face/i.test(css)||urlEsterno(css))throw Error('Lo SVG usa risorse CSS esterne: incorpora gli elementi nell’immagine.');
   }
   const vb=(svg.getAttribute('viewBox')||'').trim().split(/[\s,]+/).map(Number),misura=k=>/^\d+(?:\.\d+)?(?:px)?$/.test(svg.getAttribute(k)||'')?parseFloat(svg.getAttribute(k)):null,w=misura('width')||vb[2],h=misura('height')||vb[3];
   const misure=F.dimensioni(w,h);svg.setAttribute('width',misure.larghezza);svg.setAttribute('height',misure.altezza);
   blob=new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'});
  }
  const url=URL.createObjectURL(blob),img=new Image();
  try{
   img.src=url;await img.decode();const w=img.naturalWidth,h=img.naturalHeight;
   if(!w||!h||w*h>36000000)throw Error('L’immagine è troppo grande: usa al massimo 36 megapixel.');
   const m=F.dimensioni(w,h),canvas=E('canvas');canvas.width=m.larghezza;canvas.height=m.altezza;canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
   const dati=canvas.toDataURL('image/webp',.92),s={nome:file.name.slice(0,80),dati,...m,modo:'immagine',adatta:'cover',passo:128};F.esigi(s);return s;
  }catch(e){throw Error(e.message==='The source image cannot be decoded.'?'L’immagine non è leggibile.':e.message);}finally{URL.revokeObjectURL(url);}
 }
 function apri({tipo,valore,conferma}){
  if(!['mappa','slide'].includes(tipo))throw Error('Gli sfondi sono disponibili per mappe e slide.');
  const d=E('dialog');d.className='tuning-sfondo tbar-ctl';d.setAttribute('aria-label','Carica sfondo');
  const titolo=E('h2','Carica uno sfondo per '+(tipo==='mappa'?'mappe':'slide')),nota=E('p',tipo==='slide'?'Frame standard delle slide: '+F.formato(1280,720)+'. Un’immagine 1920 × 1080 riempie questo formato senza tagli né deformazioni.':'Scegli se lo sfondo segue la mappa o rimane fermo durante spostamento e zoom.');
  const file=E('input');file.type='file';file.accept='.svg,.png,.jpg,.jpeg,.webp';file.id='tuningSfondoFile';file.hidden=true;
  const nome=E('input');nome.setAttribute('aria-label','Nome dello sfondo');nome.maxLength=80;
  const modo=E('select');modo.setAttribute('aria-label','Comportamento dello sfondo');for(const [v,n]of [['immagine','Immagine fissa'],['pattern','Pattern · segue la mappa']])if(tipo==='mappa'||v==='immagine')modo.add(new Option(n,v));
  const adatta=E('select');adatta.setAttribute('aria-label','Adattamento dello sfondo');for(const [v,n]of [['cover','Riempi · ritaglia i bordi'],['contain','Immagine intera · possibili margini']])adatta.add(new Option(n,v));
  const passo=E('input');passo.type='number';passo.min=16;passo.max=1024;passo.step=1;passo.value=128;passo.setAttribute('aria-label','Larghezza del pattern');
  const label=(n,i)=>{const l=E('label',n);l.append(i);return l;},campi=E('div');campi.className='tuning-sfondo-campi';const fitLabel=label('Adattamento',adatta),tileLabel=label('Larghezza del tassello · px',passo);campi.append(label('Nome dello sfondo',nome),label('Comportamento',modo),fitLabel,tileLabel);
  const preview=E('div');preview.className='tuning-sfondo-preview';preview.setAttribute('aria-label','Anteprima dello sfondo');const esempio=E('span','Un esempio di contenuto');preview.append(esempio);
  const descrizione=E('p'),stato=E('output');stato.setAttribute('role','status');const az=E('div');az.className='tuning-toolbar';
  let corrente=valore?{...valore}:null,giro=0;
  function dati(){return {...corrente,nome:nome.value.trim(),modo:modo.value,adatta:adatta.value,passo:Number(passo.value)};}
  function mostra(){const pattern=modo.value==='pattern';tileLabel.hidden=!pattern;fitLabel.hidden=pattern;descrizione.textContent=pattern?'Il tassello si ripete e si sposta insieme ai nodi, anche durante lo zoom.':'L’immagine resta ferma. Le proporzioni vengono mantenute: riempi ritaglia, immagine intera può lasciare margini.';if(corrente)Object.assign(preview.style,F.css({...dati(),nome:nome.value.trim()||corrente.nome}));}
  function bottone(n,fn){const b=E('button',n);b.type='button';b.className='tbtn';b.onclick=fn;return b;}
  const usa=bottone('Usa sfondo',async()=>{try{F.esigi(dati());usa.disabled=true;await conferma(dati());d.close();}catch(e){stato.textContent=e.message;usa.disabled=false;}});usa.disabled=!corrente;
  file.onchange=async()=>{const f=file.files[0];file.value='';if(!f)return;const n=++giro;usa.disabled=true;stato.textContent='Preparazione dell’immagine…';try{const s=await immagine(f);if(!d.open||n!==giro)return;corrente=s;nome.value=s.nome;mostra();stato.textContent=s.larghezza+' × '+s.altezza+' px. Immagine incorporata.'+(/\.svg$/i.test(f.name)?' SVG convertito in immagine statica.':'');}catch(e){if(n===giro)stato.textContent=e.message;}finally{if(n===giro)usa.disabled=!corrente;}};
  modo.onchange=adatta.onchange=passo.onchange=()=>{try{mostra();}catch(e){stato.textContent=e.message;}};
  if(corrente){nome.value=corrente.nome;modo.value=corrente.modo;adatta.value=corrente.adatta;passo.value=corrente.passo;}
  az.append(bottone('Scegli immagine…',()=>file.click()),usa,bottone('Annulla',()=>d.close()));
  d.append(titolo,nota,E('p','SVG, PNG, JPEG, WebP · fino a 10 MiB. Lato massimo incorporato: 2560 px.'),file,campi,preview,descrizione,stato,az);d.addEventListener('close',()=>{giro++;d.remove();},{once:true});document.body.append(d);d.showModal();mostra();
 }
 window.ZainoSfondiUI={apri,immagine};
})();
