/* Gesto temporaneo: solo il tasto destro dentro il ritaglio arancione.
   Nessun segno viene scritto nel documento o negli appunti. */
(function(){
 'use strict';
 function collega(p,api){
  const eventi=new AbortController(),op={capture:true,signal:eventi.signal};let presa=null,ultimo=null,frame=0,sopprimiMenu=false,menu=null,ingranaggio=null;
  let preferenze;try{preferenze=LaserTraccia.impostazioni(JSON.parse(localStorage.getItem('zaino.proiezione.puntatore')||'{}'));}catch(_){preferenze=LaserTraccia.impostazioni();}
  const locale=LaserTraccia.crea('laserBanco',()=>p.ritaglio);
  p.visibilitaLaser=locale.visibile;
  function invia(fase,punto){const gesto={fase,...punto,...(fase==='inizio'?{impostazioni:{...preferenze}}:{})};locale.ricevi(gesto);api.laser({sessione:p.sessione,...gesto}).catch(()=>{});}
  function coordinate(e){const r=p.ritaglio,origine=window.bancoElemento(p.id);if(!r||p.box?.hidden||!p.box?.isConnected||!origine?.getClientRects().length||!origine.getBoundingClientRect().width)return null;const x=(e.clientX-r.x)/r.width,y=(e.clientY-r.y)/r.height;return x>=0&&x<=1&&y>=0&&y<=1?{x,y,rapporto:r.height/r.width}:null;}
  function svuota(){cancelAnimationFrame(frame);frame=0;if(ultimo){invia('punto',ultimo);ultimo=null;}}
  function ferma(annulla=false){
   const prima=presa;presa=null;svuota();
   if(prima!==null){if(document.documentElement.hasPointerCapture(prima))document.documentElement.releasePointerCapture(prima);invia(annulla?'annulla':'fine');}
   else if(annulla)invia('annulla');
  }
  window.addEventListener('pointerdown',e=>{
   if(presa===null)sopprimiMenu=false;
   if(e.button!==2||e.pointerType!=='mouse'||e.target.closest?.('dialog,[popover]:popover-open:not(.note-figure-posizione)'))return;
   const punto=coordinate(e);if(!punto)return;
   e.preventDefault();e.stopImmediatePropagation();ferma();presa=e.pointerId;sopprimiMenu=true;invia('inizio',punto);document.documentElement.setPointerCapture(e.pointerId);
  },op);
  window.addEventListener('pointermove',e=>{
   if(e.pointerId!==presa)return;e.preventDefault();e.stopImmediatePropagation();if(!(e.buttons&2)){ferma();return;}
   const punto=coordinate(e);if(!punto)return;ultimo=punto;if(!frame)frame=requestAnimationFrame(svuota);
  },op);
  window.addEventListener('pointerup',e=>{if(e.pointerId!==presa||e.button!==2)return;e.preventDefault();e.stopImmediatePropagation();ferma();},op);
  window.addEventListener('pointercancel',e=>{if(e.pointerId===presa)ferma();},op);
  window.addEventListener('lostpointercapture',e=>{if(e.pointerId===presa)ferma();},op);
  window.addEventListener('blur',()=>ferma(),{signal:eventi.signal});
  window.addEventListener('contextmenu',e=>{if(!sopprimiMenu)return;sopprimiMenu=false;e.preventDefault();e.stopImmediatePropagation();},op);
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menu?.matches(':popover-open')&&(presa!==null||locale.presente())){e.preventDefault();e.stopImmediatePropagation();ferma(true);}},op);
  function chiudiMenu(){menu?.remove();menu=null;ingranaggio?.setAttribute('aria-expanded','false');}
  function apriMenu(b){
   if(menu?.matches(':popover-open')){chiudiMenu();return;}
   ferma(true);chiudiMenu();ingranaggio=b;
   const E=(tag,cls,testo)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(testo)e.textContent=testo;return e;};
   const bottone=(nome,icona,fn)=>{const e=E('button','tbtn');e.type='button';e.title=nome;e.setAttribute('aria-label',nome);e.innerHTML=UiIcone.svg(icona);e.onclick=fn;return e;};
   menu=E('div','laser-pop popmenu tbar-ctl');menu.popover='auto';menu.setAttribute('role','dialog');menu.setAttribute('aria-label','Puntatore e spot');
   const head=E('div','laser-pop-head');head.append(E('strong',null,'Puntatore'),bottone('Chiudi · Esc','x',()=>{chiudiMenu();b.focus({preventScroll:true});}));menu.append(head);
   const forme=E('div','tbar laser-forme');forme.setAttribute('role','group');forme.setAttribute('aria-label','Forma del puntatore');
   for(const [valore,nome,icona]of [['laser','Laser · traccia libera; con Spot il contorno si chiude','laser-pointer'],['box','Box · trascina fra due angoli opposti','square'],['cerchio','Cerchio · trascina dal centro al bordo','circle']]){
    const t=bottone(nome,icona,()=>salva('forma',valore));t.dataset.laserForma=valore;forme.append(t);
   }
   const spot=bottone('Spot · esterno scurito al 50% e sfocato di 8 px','eye',()=>salva('spot',!preferenze.spot));spot.dataset.laserSpot='';spot.append(E('span',null,'Spot'));forme.append(E('i','tbsep'),spot);menu.append(forme);
   const colori=E('div','tbar laser-colori');colori.setAttribute('role','group');colori.setAttribute('aria-label','Colore del bordo');
   for(const [valore,colore]of Object.entries(LaserTraccia.colori)){
    const t=E('button','tbtn');t.type='button';t.dataset.laserColore=valore;t.setAttribute('aria-label',valore);t.title=valore;const swatch=E('i','laser-campione');swatch.style.background=colore;t.append(swatch,E('span',null,valore));t.onclick=()=>salva('colore',valore);colori.append(t);
   }menu.append(colori);
   const campi=E('div','laser-campi'),label=E('label',null,'Bordo (px)'),spessore=E('input');spessore.type='number';spessore.min=0;spessore.max=12;spessore.step=1;spessore.value=preferenze.spessore;spessore.dataset.laserSpessore='';spessore.title='Spessore del bordo · 0 = spento';spessore.onchange=()=>{const n=Number(spessore.value);if(spessore.value!==''&&Number.isFinite(n))salva('spessore',Math.max(0,Math.min(12,n)));spessore.value=preferenze.spessore;};label.append(spessore);
   const tempo=E('label',null,'Dissolvenza (s)'),riga=E('span','laser-tempo'),durata=E('input'),valore=E('output');durata.type='range';durata.className='zaino-slider';durata.min=0;durata.max=2;durata.step=.1;durata.value=preferenze.durata;durata.dataset.laserDurata='';durata.setAttribute('aria-label','Tempo di dissolvenza in secondi');durata.title='0 = resta fino al nuovo clic destro · Esc cancella';durata.oninput=()=>{salva('durata',+durata.value);valore.value=preferenze.durata.toLocaleString('it-CH',{maximumFractionDigits:1});};valore.value=preferenze.durata.toLocaleString('it-CH',{maximumFractionDigits:1});riga.append(durata,valore);tempo.append(riga);campi.append(label,tempo);menu.append(campi);
   const aiuto=E('p','laser-aiuto');menu.append(aiuto);
   function aggiorna(){menu.querySelectorAll('[data-laser-forma]').forEach(t=>t.setAttribute('aria-pressed',String(t.dataset.laserForma===preferenze.forma)));menu.querySelectorAll('[data-laser-colore]').forEach(t=>t.setAttribute('aria-pressed',String(t.dataset.laserColore===preferenze.colore)));spot.setAttribute('aria-pressed',String(preferenze.spot));aiuto.textContent=preferenze.durata===0?'Resta fino al nuovo clic destro. Esc cancella.':'Tieni premuto il tasto destro e trascina.';}
   function salva(chiave,valore){preferenze=LaserTraccia.impostazioni({...preferenze,[chiave]:valore});try{localStorage.setItem('zaino.proiezione.puntatore',JSON.stringify(preferenze));}catch(_){}aggiorna();}
   aggiorna();document.body.append(menu);menu.showPopover();b.setAttribute('aria-expanded','true');
   const r=b.getBoundingClientRect(),m=menu.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(innerWidth-m.width-8,r.left))+'px';menu.style.top=Math.max(8,Math.min(innerHeight-m.height-8,r.bottom+4))+'px';
   menu.addEventListener('toggle',e=>{if(e.newState==='closed'){b.setAttribute('aria-expanded','false');}});menu.querySelector('[data-laser-forma]')?.focus({preventScroll:true});
  }
  p.menuLaser=apriMenu;p.fermaLaser=ferma;return ()=>{ferma(true);chiudiMenu();eventi.abort();locale.smonta();};
 }
 window.ProiezioneLaser={collega};
}());
