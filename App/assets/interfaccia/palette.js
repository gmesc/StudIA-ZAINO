/* Una sola griglia Tailwind per i diversi editor, con la palette locale già inclusa. */
(function(){
 'use strict';const C=PresentaColori,E=(t,txt,cls)=>{const e=document.createElement(t);if(txt)e.textContent=txt;if(cls)e.className=cls;return e;};let aperto;
 function griglia({valore,onSelect}){
  const g=E('div',null,'zaino-tailwind');g.setAttribute('role','group');g.setAttribute('aria-label','Palette Tailwind');g.append(E('span'));
  for(const n of C.gradazioni)g.append(E('span',String(n),'zaino-gradazione'));
  let famiglia='';const pulsanti=[];
  for(const c of C.palette){
   if(c.famiglia!==famiglia){famiglia=c.famiglia;g.append(E('span',famiglia,'zaino-famiglia'));}
   const b=E('button',null,'tbtn'),sw=E('i',null,'zaino-campione');b.type='button';b.title=c.id+' · '+c.hex;b.setAttribute('aria-label',c.id);b.setAttribute('aria-pressed',String(valore?.toLowerCase()===c.hex));b.dataset.colore=c.hex;sw.style.backgroundColor=c.hex;b.append(sw);b.onclick=()=>onSelect(c.hex);g.append(b);pulsanti.push(b);
  }
  const attivo=pulsanti.find(b=>b.getAttribute('aria-pressed')==='true')||pulsanti[0];for(const b of pulsanti)b.tabIndex=b===attivo?0:-1;
  g.onkeydown=e=>{const i=pulsanti.indexOf(document.activeElement);if(i<0)return;const n=pulsanti.length;let j;if(e.key==='ArrowRight')j=Math.min(n-1,i+1);else if(e.key==='ArrowLeft')j=Math.max(0,i-1);else if(e.key==='ArrowDown')j=Math.min(n-1,i+11);else if(e.key==='ArrowUp')j=Math.max(0,i-11);else if(e.key==='Home')j=0;else if(e.key==='End')j=n-1;else return;e.preventDefault();pulsanti[i].tabIndex=-1;pulsanti[j].tabIndex=0;pulsanti[j].focus();};
  return g;
 }
 function campione(b,valore){b.value=valore;b.dataset.colore=valore;const nome=valore==='none'?'Nessuno':C.etichetta(valore),sw=E('i',null,'zaino-campione');sw.style.backgroundColor=valore==='none'?'transparent':valore;b.replaceChildren(sw,E('span',nome));b.title=nome+(valore==='none'?'':' · '+valore)+' · palette Tailwind';}
 function chiudi(focus=true){if(!aperto)return false;const p=aperto;aperto=null;if(p.matches(':popover-open'))p.hidePopover();p.ancora?.setAttribute('aria-expanded','false');p.remove();if(focus&&p.ancora?.getBoundingClientRect().width)p.ancora.focus({preventScroll:true});return true;}
 function apri({ancora,nome,valore,nessuno,onSelect,valido=()=>true}){
  chiudi(false);const r=ancora.getBoundingClientRect(),p=E('div',null,'popmenu zaino-palette tbar-ctl'),titolo=E('strong',nome+' · Tailwind'),bar=E('div',null,'tbar zaino-palette-azioni');p.popover='auto';p.ancora=ancora;p.setAttribute('role','dialog');p.setAttribute('aria-label',nome+' · Tailwind');ancora.setAttribute('aria-expanded','true');ancora.dataset.palette='true';
  function scegli(v){chiudi();if(valido())onSelect(v);}
  for(const [v,n]of [...(nessuno?[['none',nessuno]]:[]),['#ffffff','Bianco'],['#000000','Nero']]){const b=E('button',n,'tbtn');b.type='button';b.dataset.colore=v;b.setAttribute('aria-pressed',String(valore===v));b.onclick=()=>scegli(v);bar.append(b);}
  const g=griglia({valore,onSelect:scegli});p.append(titolo,bar,g);(ancora.closest('dialog[open]')||document.body).append(p);aperto=p;p.showPopover();const b=p.getBoundingClientRect();p.style.left=Math.max(8,Math.min(r.left,innerWidth-b.width-8))+'px';p.style.top=Math.max(8,Math.min(r.bottom+4,innerHeight-b.height-8))+'px';p.addEventListener('toggle',e=>{if(e.newState==='closed'){if(aperto===p)aperto=null;if(aperto?.ancora!==ancora)ancora.setAttribute('aria-expanded','false');p.remove();}});const scelto=g.querySelector('[tabindex="0"]');scelto?.focus({preventScroll:true});scelto?.scrollIntoView({block:'nearest'});
  p.addEventListener('keydown',e=>e.stopPropagation());
 }
 // Escape appartiene allo strato più alto: anche gli altri gestori su window
 // devono aspettare il prossimo tasto, altrimenti chiuderebbero il pannello sotto.
 window.addEventListener('keydown',e=>{if(e.key==='Escape'&&aperto){e.preventDefault();e.stopImmediatePropagation();chiudi();}},true);
 window.ZainoPalette={griglia,apri,campione,chiudi,aperta:()=>!!aperto};window.addEventListener('resize',()=>chiudi(false));
}());
