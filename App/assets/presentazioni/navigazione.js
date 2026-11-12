/* Una sola grammatica dei comandi per anteprima, finestra pubblica e HTML esportato. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.PresentaNavigazione=factory();})(typeof window==='undefined'?this:window,function(){
 'use strict';
 const FRECCE=[[37,'left','argomentoPrecedente','Slide principale precedente'],[39,'right','argomentoSuccessivo','Slide principale successiva'],[38,'up','risali','Slide precedente nel percorso completo'],[40,'down','approfondisci','Slide successiva nel percorso completo']];
 function destinazione(p,quante,azione){
  let {h,v}=p;if(!quante[h])return null;
  switch(azione){
   case 'argomentoSuccessivo':h++;v=0;break;
   case 'argomentoPrecedente':h--;v=0;break;
   case 'approfondisci':if(v+1<quante[h])v++;else{h++;v=0;}break;
   case 'risali':if(v>0)v--;else{h--;v=(quante[h]||1)-1;}break;
   default:throw Error('Comando di navigazione non disponibile.');
  }return h>=0&&h<quante.length?{h,v,fragmentIndex:-1}:null;
 }
 const quantita=deck=>deck.getHorizontalSlides().map(s=>s.querySelectorAll(':scope > section').length||1);
 const tasti=esegui=>Object.fromEntries(FRECCE.map(([codice,_nome,azione])=>[codice,()=>esegui({azione})]));
 const avanzaAlClic=({button=0,defaultPrevented=false,interattivo=false,selezione=false})=>button===0&&!defaultPrevented&&!interattivo&&!selezione;
 function stato(deck){const p=deck.getIndices();return {h:p.h,v:p.v||0,fragmentIndex:p.f??-1};}
 function comando(deck,o){
  const p=stato(deck);
  switch(o.azione){
   case 'avanti':deck.next();break;case 'indietro':deck.prev();break;
   case 'argomentoSuccessivo':case 'argomentoPrecedente':case 'approfondisci':case 'risali':{const d=destinazione(p,quantita(deck),o.azione);if(d)deck.slide(d.h,d.v,d.fragmentIndex);break;}
   case 'vai':if(!Number.isInteger(o.h)||!Number.isInteger(o.v)||!Number.isInteger(o.fragmentIndex)||!deck.getSlide(o.h,o.v))throw Error('Posizione non valida.');deck.slide(o.h,o.v,o.fragmentIndex);break;
   default:throw Error('Comando non disponibile.');
  }return stato(deck);
 }
 // Anche le frecce a schermo saltano i frammenti e ignorano le posizioni ricordate da Reveal.
 function frecce(deck,root,{esegui=o=>comando(deck,o)}={}){
  let chiuso=false;
  function aggiorna(){if(chiuso)return;const p=stato(deck),quante=quantita(deck);for(const [_codice,nome,azione,label]of FRECCE)for(const b of root.querySelectorAll('.controls .navigate-'+nome)){const disponibile=!!destinazione(p,quante,azione);if(b.disabled===disponibile)b.disabled=!disponibile;if(b.classList.contains('enabled')!==disponibile)b.classList.toggle('enabled',disponibile);for(const c of ['fragmented','highlight'])if(b.classList.contains(c))b.classList.remove(c);if(b.getAttribute('aria-label')!==label)b.setAttribute('aria-label',label);if(b.title!==label)b.title=label;}}
  // Reveal aggiorna i suoi pulsanti dopo slidechanged: la nostra disponibilità segue quella scrittura.
  const pianifica=()=>queueMicrotask(aggiorna),bottone=e=>e.target.closest('.controls button');
  function click(e){const b=bottone(e),voce=b&&FRECCE.find(([,nome])=>b.classList.contains('navigate-'+nome));if(!voce)return;e.preventDefault();e.stopPropagation();if(!b.disabled)esegui({azione:voce[2]});pianifica();}
  // Il touch genera un solo clic nativo; non deve eseguire anche il gestore touch di Reveal.
  function touch(e){if(bottone(e))e.stopPropagation();}
  // «Al clic» deve funzionare anche sul foglio: le frecce conservano i salti fra capitoli.
  function foglio(e){if(!e.target.closest('.presenta-slide')||!avanzaAlClic({button:e.button,defaultPrevented:e.defaultPrevented,interattivo:!!e.target.closest('a,button,input,select,textarea,video,audio,[contenteditable="true"],[data-apri-fonte],.presenta-comuni'),selezione:!root.ownerDocument.getSelection().isCollapsed}))return;e.preventDefault();esegui({azione:'avanti'});pianifica();}
  root.addEventListener('click',foglio);
  root.addEventListener('click',click,true);root.addEventListener('touchstart',touch,true);root.addEventListener('touchend',touch,true);
  const eventi=['slidechanged','fragmentshown','fragmenthidden','slidesync'];for(const ev of eventi)deck.on(ev,pianifica);
  // Anche slide(h,v) sulla posizione già corrente riscrive i controlli senza emettere slidechanged.
  const osserva=new root.ownerDocument.defaultView.MutationObserver(pianifica);for(const c of root.querySelectorAll('.controls'))osserva.observe(c,{subtree:true,attributes:true,attributeFilter:['disabled','class']});aggiorna();
  return {aggiorna,destroy(){chiuso=true;osserva.disconnect();root.removeEventListener('click',foglio);root.removeEventListener('click',click,true);root.removeEventListener('touchstart',touch,true);root.removeEventListener('touchend',touch,true);for(const ev of eventi)deck.off(ev,pianifica);}};
 }
 function sincronizzaMedia(deck,root,passivo){
  const slide=deck?.getCurrentSlide(),p=deck?.getIndices(),sfondo=p&&deck.getSlideBackground(p.h,p.v);
  for(const m of root.querySelectorAll('audio,video')){const dietro=!!m.closest('.slide-background'),comune=!!m.closest('.presenta-sfondo-comune');if(passivo||!(slide?.contains(m)||sfondo?.contains(m)||comune&&slide?.dataset.sfondoComune==='true'))m.pause();m.muted=passivo||(comune?m.dataset.silenzioso!=='false':dietro&&!!slide?.hasAttribute('data-background-video-muted'));}
 }
 // Un solo elemento vive fuori dalle slide: GIF e video non ripartono al cambio.
 function sfondoComune(deck,root,{passivo=()=>false,errore=()=>{}}={}){
  const template=root.querySelector('.presenta-sfondo-template');if(!template)return {destroy(){}};
  const layer=template.content.firstElementChild.cloneNode(true),video=layer.querySelector('video');root.append(layer);
  function aggiorna(){layer.hidden=deck.getCurrentSlide()?.dataset.sfondoComune!=='true';if(video){video.muted=passivo()||video.dataset.silenzioso!=='false';if(layer.hidden||passivo())video.pause();else if(video.paused)video.play().catch(e=>{if(e.name!=='AbortError'&&video.isConnected)errore('Video di sfondo non riproducibile. Verifica il formato e il codec.');});}}
  deck.on('slidechanged',aggiorna);aggiorna();return {firma:template.innerHTML,aggiorna,destroy(){video?.pause();deck.off('slidechanged',aggiorna);layer.remove();}};
 }
 // I frammenti e gli approfondimenti dello stesso argomento non rilanciano lo zoom.
 function passaggioComuni(prima,dopo,ridotto=false){
  return {zoom:!!prima&&!ridotto&&!!prima.step&&!!dopo.step&&prima.step!==dopo.step,numero:!!prima&&!ridotto&&!!prima.pagina&&!!dopo.pagina&&prima.pagina!==dopo.pagina,verso:prima&&(dopo.h<prima.h||dopo.h===prima.h&&dopo.v<prima.v)?-1:1};
 }
 // Un solo foglio esterno alle sezioni Reveal conserva geometria, pulsanti e focus.
 function navbar(deck,root,{ridotto=false,attiva=()=>true}={}){
  const doc=root.ownerDocument,win=doc.defaultView,layer=doc.createElement('div'),fissi=new Map();
  layer.className='presenta-slide presenta-comuni';layer.dataset.layout='free';root.append(layer);
  let prima=null,animazioni=[],presenti=[];
  const riduci=()=>!!(typeof ridotto==='function'?ridotto():ridotto)||doc.documentElement.dataset.movimentoRidotto==='true'||win.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function ferma(){for(const a of animazioni)a.revert();animazioni=[];}
  function dimensiona(){const c=deck.getConfig();Object.assign(layer.style,{width:c.width+'px',height:c.height+'px',transform:'translate(-50%, -50%) scale('+deck.getScale()+')'});}
  function firma(b){const c=b.cloneNode(true);c.querySelectorAll('[aria-current]').forEach(e=>e.removeAttribute('aria-current'));const n=c.querySelector('.presenta-numero-pagina');if(n)n.textContent='';return c.innerHTML;}
  function aggiorna(){
   presenti=[];const sezione=deck.getCurrentSlide(),slide=sezione&&root.contains(sezione)?sezione.querySelector('.presenta-slide'):null;layer.hidden=!slide;if(!slide){ferma();prima=null;return;}
   dimensiona();const stile=win.getComputedStyle(slide);for(const k of ['fontFamily','color'])layer.style[k]=stile[k];for(const k of ['--ink','--muted'])layer.style.setProperty(k,stile.getPropertyValue(k));
   // Le copie nelle slide restano misurabili per l'editor e per le miniature.
   for(const b of root.querySelectorAll('.slides .presenta-blocco:is([data-type=navbar],[data-type=page-number])')){b.classList.add('presenta-comune-sorgente');b.inert=true;b.setAttribute('aria-hidden','true');}
   const navOrigine=slide.querySelector('[data-type=navbar]:not([hidden]) .presenta-navbar'),attivo=navOrigine?.querySelector('[aria-current]'),pagina=slide.querySelector('[data-type=page-number]:not([hidden]) .presenta-numero-pagina')?.textContent||null;
   const dopo={...stato(deck),step:attivo?attivo.dataset.navH+'/'+attivo.dataset.navV:null,pagina},passo=passaggioComuni(prima,dopo,riduci()),scale=new Map();
   for(const e of layer.querySelectorAll('.presenta-step-contenuto'))scale.set(e,new win.DOMMatrix(win.getComputedStyle(e).transform).a);
   const cambiato=!prima||prima.step!==dopo.step||prima.pagina!==dopo.pagina;
   let struttura=false;for(const tipo of ['navbar','page-number']){const b=slide.querySelector('[data-type="'+tipo+'"]');if(b&&fissi.get(tipo)?.firma!==firma(b))struttura=true;}
   if(cambiato||struttura||riduci())ferma();
   for(const tipo of ['navbar','page-number']){
    const b=slide.querySelector('[data-type="'+tipo+'"]');let f=fissi.get(tipo);if(!b){if(f)f.elemento.hidden=true;continue;}
    const stamp=firma(b);if(!f){const elemento=doc.createElement('div');elemento.className='presenta-blocco';layer.append(elemento);f={elemento};fissi.set(tipo,f);}
    const e=f.elemento;presenti.push(e);e.dataset.blockId=b.dataset.blockId;e.dataset.type=tipo;e.dataset.slot=b.dataset.slot;e.setAttribute('style',b.getAttribute('style')||'');e.hidden=b.hidden;
    if(f.firma!==stamp){e.innerHTML=b.innerHTML;f.firma=stamp;}
    if(tipo==='navbar'){
     const nav=e.querySelector('.presenta-navbar');if(!nav)continue;
     const origine=b.querySelector('.presenta-navbar'),key=el=>el.dataset.navH+'/'+el.dataset.navV;
     for(const bt of nav.querySelectorAll('button')){
      const active=key(bt)===dopo.step;bt.toggleAttribute('aria-current',active);if(active)bt.setAttribute('aria-current','step');
      const target=bt.querySelector('.presenta-step-contenuto'),scala=active?Number(origine.dataset.zoom)||1:1,da=scale.get(target)??scala;
      if(passo.zoom&&target&&Math.abs(da-scala)>.001&&globalThis.anime?.animate)animazioni.push(globalThis.anime.animate(target,{scale:{from:da,to:scala},duration:220,ease:'outQuad'}));
     }
     const active=nav.querySelector('[aria-current]');if(active){const verticale=nav.dataset.orientamento==='vertical',asse=verticale?'scrollTop':'scrollLeft',pos=verticale?active.offsetTop-nav.offsetTop:active.offsetLeft-nav.offsetLeft,lungo=verticale?active.offsetHeight:active.offsetWidth,visibile=verticale?nav.clientHeight:nav.clientWidth;if(pos<nav[asse])nav[asse]=pos;else if(pos+lungo>nav[asse]+visibile)nav[asse]=pos+lungo-visibile;}
    }else{
     const n=e.querySelector('.presenta-numero-pagina');if(n){let valore=n.querySelector('.presenta-numero-valore');if(!valore){valore=doc.createElement('span');valore.className='presenta-numero-valore';n.replaceChildren(valore);n.setAttribute('aria-live','polite');n.setAttribute('aria-atomic','true');}valore.textContent=pagina||b.querySelector('.presenta-numero-pagina').textContent;
      if(passo.numero&&globalThis.anime?.animate)animazioni.push(globalThis.anime.animate(valore,{opacity:{from:.25,to:1},translateY:{from:passo.verso*6,to:0},duration:200,ease:'outQuad'}));}
    }
   }
   prima=dopo;
  }
  function click(e){const b=e.target.closest('[data-nav-h]');if(!b||!layer.contains(b)||!attiva())return;e.preventDefault();e.stopPropagation();deck.slide(Number(b.dataset.navH),Number(b.dataset.navV),-1);}
  root.addEventListener('click',click,true);deck.on('slidechanged',aggiorna);deck.on('resize',dimensiona);aggiorna();
  return {aggiorna,elementi:()=>presenti.slice(),destroy(){ferma();root.removeEventListener('click',click,true);deck.off('slidechanged',aggiorna);deck.off('resize',dimensiona);layer.remove();for(const b of root.querySelectorAll('.presenta-comune-sorgente')){b.classList.remove('presenta-comune-sorgente');b.inert=false;b.removeAttribute('aria-hidden');}}};
 }

 return {destinazione,tasti,avanzaAlClic,frecce,stato,comando,sincronizzaMedia,sfondoComune,passaggioComuni,navbar};
});
