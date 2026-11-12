/* Gli stessi controlli tipografici in PRESENTA e APPUNTI: catalogo, anteprime e pesi unici. */
(function(){
 'use strict';
 function iconaAllineamento(v,verticale){
  const x=({left:3,center:7,right:11})[v]||3,y=({start:4,center:8,end:12})[v]||4;
  const disegno=verticale?'<path d="M3 2h18M3 22h18" stroke="var(--muted)"/><rect x="5" y="'+y+'" width="14" height="8" fill="currentColor" stroke="none"/>':'<path d="M3 4h18M'+x+' 9h10M3 14h18M'+x+' 19h10"/>';
  return '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true">'+disegno+'</svg>';
 }
 function crea({popup,contesto=()=>()=>true,bottone}){
 const M=PresentaModello,E=(t,txt,cls)=>{const e=document.createElement(t);if(txt)e.textContent=txt;if(cls)e.className=cls;return e;};
 const b=bottone||((nome,icona,fn)=>{const x=E('button',nome,'tbtn');x.type='button';x.title=nome;x.setAttribute('aria-label',nome);x.onclick=fn;return x;});let aperto;
 function campo(nome,valore,fn,{opzioni=[]}={}){const box=E('label',null,'presenta-campo'),sel=E('select');sel.setAttribute('aria-label',nome);for(const [v,n]of opzioni)sel.append(new Option(n,v));sel.value=valore;sel.onchange=()=>fn(sel.value);box.append(E('span',nome),sel);return box;}
 function sceltaCarattere(nome,valore,fn){
  const box=E('div',null,'presenta-campo presenta-carattere'),label=E('span',nome),scelto=M.CARATTERI[valore]||M.CARATTERI.zaino;
  const bt=b(nome,null,()=>{
   valore=bt.dataset.valore||valore;const valido=contesto(),lista=E('div',null,'presenta-lista-caratteri');lista.setAttribute('role','menu');lista.setAttribute('aria-label',nome);
   for(const [id,f]of Object.entries(M.CARATTERI)){
    const voce=b(f.nome,null,()=>{aperto?.hidePopover();if(!valido())return;fn(id);});
    voce.classList.add('presenta-font-opzione');voce.setAttribute('role','menuitemradio');voce.setAttribute('aria-checked',String(id===valore));voce.style.fontFamily=f.css;
    voce.replaceChildren(E('span',f.nome),E('span','La luce e le foglie · Aa 123','presenta-font-esempio'));lista.append(voce);
   }
   const r=bt.getBoundingClientRect(),pop=aperto=popup('presenta-menu-caratteri',lista,r.left,r.bottom+4);bt.setAttribute('aria-expanded','true');
   pop.addEventListener('toggle',e=>{if(e.newState==='closed'){bt.setAttribute('aria-expanded','false');if(bt.isConnected)bt.focus({preventScroll:true});}});
   const voci=[...lista.children];lista.addEventListener('keydown',e=>{const i=voci.indexOf(document.activeElement);let j;if(e.key==='ArrowDown')j=(i+1)%voci.length;else if(e.key==='ArrowUp')j=(i-1+voci.length)%voci.length;else if(e.key==='Home')j=0;else if(e.key==='End')j=voci.length-1;else return;e.preventDefault();voci[j].focus();});
   (lista.querySelector('[aria-checked=true]')||lista.firstElementChild)?.focus();
  });
  bt.dataset.valore=valore;bt.replaceChildren(E('span',scelto.nome,'presenta-carattere-nome'));bt.title=scelto.nome;bt.style.fontFamily=scelto.css;bt.setAttribute('aria-haspopup','menu');bt.setAttribute('aria-expanded','false');box.append(label,bt);return box;
 }
 function sceltaAllineamento(nome,valore,verticale,fn){
  const box=E('div',null,'presenta-campo presenta-allineamento'),voci=verticale?[['start','In alto'],['center','Al centro'],['end','In basso']]:[['left','Sinistra'],['center','Centro'],['right','Destra']];
  const bt=b(nome,null,()=>{const bar=E('div',null,'tbar');bar.setAttribute('role','group');bar.setAttribute('aria-label',nome);
   for(const [v,label]of voci){const opzione=b(nome+' · '+label,null,()=>{aperto?.hidePopover();valore=v;fn(v);disegnaIcona();});opzione.innerHTML=iconaAllineamento(v,verticale);opzione.setAttribute('aria-pressed',String(v===valore));bar.append(opzione);}
   const r=bt.getBoundingClientRect(),p=aperto=popup('presenta-menu-allineamento',bar,r.left,r.bottom+4);bt.setAttribute('aria-expanded','true');p.addEventListener('toggle',e=>{if(e.newState==='closed')bt.setAttribute('aria-expanded','false');});bar.querySelector('[aria-pressed=true]')?.focus();
  });function disegnaIcona(){bt.innerHTML=iconaAllineamento(valore,verticale);bt.append(E('span','▾'));bt.title=nome+' · '+voci.find(v=>v[0]===valore)[1];}disegnaIcona();bt.setAttribute('aria-expanded','false');bt.setAttribute('aria-haspopup','true');box.append(bt);return box;
 }
 const nomiPesi={200:'ExtraLight',300:'Light',400:'Regular',500:'Medium',600:'SemiBold',700:'Bold',800:'ExtraBold',900:'Black'};
 function aggiornaPesi(select,font,peso){
  const valori=PresentaTesto.pesi(font);
  select.replaceChildren(...(peso==null?[new Option('Misto','')]:[]),...valori.map(v=>{const o=new Option(nomiPesi[v],String(v));o.style.fontWeight=v;return o;}));select.value=peso??'';select.title=select.selectedOptions[0]?.textContent||'';
 }
 function sceltaPeso(nome,font,peso,fn){const box=campo(nome,peso,v=>{if(v)fn(Number(v));},{opzioni:[]});box.classList.add('presenta-peso');box.querySelector('select').addEventListener('change',e=>{e.target.title=e.target.selectedOptions[0]?.textContent||'';});aggiornaPesi(box.querySelector('select'),font,peso);return box;}

 return {sceltaCarattere,sceltaPeso,sceltaAllineamento,aggiornaPesi};
 }
 window.ZainoTipografia={crea,iconaAllineamento};
}());
