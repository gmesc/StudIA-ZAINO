/* Comandi dell'editor Markdown, condivisi dai nove banchi. */
(function(){
 'use strict';
 let worker,richiesta=0;const inviati=new Set();const attese=new Map();
 function fermaOrtografia(){
  worker?.terminate();worker=null;inviati.clear();
  for(const p of attese.values()){clearTimeout(p.timer);p.reject(Error('Controllo ortografico non disponibile'));}
  attese.clear();
 }
 async function ortografia(dati){
  const dizionari=await AppuntiDizionari.carica(dati.lingua,inviati);
  if(!worker){
   worker=new Worker('assets/appunti/vendor/ortografia-worker.js');
   worker.onmessage=({data})=>{const p=attese.get(data.id);if(!p)return;attese.delete(data.id);clearTimeout(p.timer);data.errore?p.reject(Error(data.errore)):p.resolve(data.risultato);};
   worker.onerror=fermaOrtografia;
  }
  return new Promise((resolve,reject)=>{const id=++richiesta;attese.set(id,{resolve,reject,timer:setTimeout(fermaOrtografia,15000)});worker.postMessage({...dati,id,dizionari});dizionari.forEach(d=>inviati.add(d.id));});
 }
 function bottone(nome,icona,fn){const b=document.createElement('button');b.type='button';b.className='tbtn no-disable';b.title=nome;b.setAttribute('aria-label',nome);b.innerHTML=UiIcone.svg(icona);b.onclick=fn;return b;}
 function popup(ancora,nome,contestuale=false){
  document.querySelectorAll('.note-strumenti-menu:popover-open').forEach(e=>e.hidePopover());
  const p=document.createElement('div');p.className='note-strumenti-menu';p.popover=contestuale?'manual':'auto';p.setAttribute('role','dialog');p.setAttribute('aria-label',nome);
  const r=ancora.getBoundingClientRect?ancora.getBoundingClientRect():ancora;
  function posiziona(){
   p.style.left=Math.max(8,Math.min(r.left,innerWidth-p.offsetWidth-8))+'px';
   const sotto=r.bottom+6,sopra=r.top-p.offsetHeight-6;
   p.style.top=Math.max(8,Math.min(sotto+p.offsetHeight<=innerHeight-8?sotto:sopra,innerHeight-p.offsetHeight-8))+'px';
  }
  const fuoco=document.activeElement;
  const fuori=e=>{if(!p.contains(e.target))p.hidePopover();};
  const esc=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();p.hidePopover();if(fuoco?.isConnected)fuoco.focus({preventScroll:true});}};
  document.body.append(p);p.showPopover();posiziona();
  // Il popover automatico si chiude al rilascio dello stesso clic destro che lo apre.
  if(contestuale){document.addEventListener('pointerdown',fuori,true);document.addEventListener('keydown',esc,true);}
  const misura=new ResizeObserver(posiziona);misura.observe(p);
  p.addEventListener('toggle',()=>{if(!p.matches(':popover-open')){misura.disconnect();document.removeEventListener('pointerdown',fuori,true);document.removeEventListener('keydown',esc,true);p.remove();}});return p;
 }
 function testoScrivibile(s){
  if(!s.cur||AppuntiAnnotaUI.aperta(s))return false;
  if(!AppuntiA4.scegli(s,'scrittura'))return false;
  if(s.mde.isPreviewActive())s.mde.togglePreview();return true;
 }
 function paragrafo(cm,line){
  const testo=cm.getLine(line),token=cm.getTokenTypeAt({line,ch:Math.max(1,testo.search(/\S/)+1)})||'';
  const base={line,fine:line,livello:0,testo,codice:/comment|code/.test(token)};
  if(base.codice)return base;
  if(/^ {0,3}(?:=+|-+)\s*$/.test(testo)&&line>0&&/header/.test(token))return paragrafo(cm,line-1);
  const atx=/^ {0,3}(#{1,6})(?:\s+|$)(.*)$/.exec(testo);
  if(atx)return {...base,livello:atx[1].length,testo:atx[2].replace(/\s+#+\s*$/,'')};
  const sotto=cm.getLine(line+1)||'';
  if(testo.trim()&&/^ {0,3}(?:=+|-+)\s*$/.test(sotto)&&/header/.test(cm.getTokenTypeAt({line,ch:testo.length})||''))
   return {...base,fine:line+1,livello:sotto.trim()[0]==='='?1:2};
  return base;
 }
 function titoli(cm){
  const out=[];for(let line=0;line<cm.lineCount();line++){
   const h=paragrafo(cm,line);if(h.livello){out.push(h);line=h.fine;}
  }return out;
 }
 function installa(s){
  const cm=s.mde.codemirror,host=noteHost(s),bar=host.querySelector('.editor-toolbar');
  if(host.querySelector('.note-stile-testo'))return;
  const selettore=document.createElement('button');selettore.type='button';selettore.className='note-stile-testo no-disable';selettore.setAttribute('aria-label','Stile del paragrafo');selettore.title='Stile del paragrafo';selettore.setAttribute('aria-haspopup','menu');selettore.setAttribute('aria-expanded','false');
  const nomeStile=n=>n?'# '+n+' · '+(n===1?'Titolo':'Sottotitolo '+(n-1)):'¶ Testo';
  bar.querySelector('.heading').replaceWith(selettore);
  function livello(line){return paragrafo(cm,line).livello;}
  function intervallo(){const a=cm.getCursor('from'),b=cm.getCursor('to');return {da:a.line,a:b.line-(b.ch===0&&b.line>a.line?1:0)};}
  function stato(){selettore.disabled=!s.cur;const r=intervallo(),v=livello(r.da);let uguale=true;for(let i=r.da;i<=r.a;i++)if(livello(i)!==v)uguale=false;selettore.value=uguale?String(v):'misto';selettore.innerHTML=UiIcone.svg('pilcrow');selettore.title='Stile del paragrafo: '+(uguale?nomeStile(v):'Stili diversi');}
  function applica(n){
   const r=intervallo();if(!testoScrivibile(s)){stato();return;}
   const blocchi=new Map();for(let line=r.da;line<=r.a;line++){const h=paragrafo(cm,line);if(!h.codice)blocchi.set(h.line,h);}
   cm.operation(()=>{for(const h of [...blocchi.values()].reverse()){
    cm.replaceRange((n?'#'.repeat(n)+' ':'')+h.testo,{line:h.line,ch:0},{line:h.fine,ch:cm.getLine(h.fine).length},'stile');
   }});cm.focus();stato();
  }
  function apriStili(){
   const versione=s.versione,originale=cm.getValue(),selezione=cm.listSelections();
   const p=popup(selettore,'Stile del paragrafo');p.classList.add('note-stili-menu');p.setAttribute('role','menu');
   selettore.setAttribute('aria-expanded','true');
   p.addEventListener('toggle',()=>{if(!p.matches(':popover-open'))selettore.setAttribute('aria-expanded','false');});
   for(let i=0;i<=6;i++){
    const b=document.createElement('button');b.type='button';b.dataset.livello=i;b.setAttribute('role','menuitemradio');b.setAttribute('aria-checked',String(selettore.value===String(i)));
    b.innerHTML='<span class="note-stile-spunta">'+(selettore.value===String(i)?UiIcone.svg('check'):'')+'</span><span class="note-stile-anteprima">'+nomeStile(i)+'</span>';
    b.querySelector('.note-stile-anteprima').style.fontSize=i?'calc(var(--tit-'+i+') * .8)':(parseFloat(getComputedStyle(cm.getWrapperElement()).fontSize)*.8)+'px';
    b.onclick=()=>{p.hidePopover();if(s.versione!==versione||originale!==cm.getValue())return;cm.setSelections(selezione);applica(i);};p.append(b);
   }
   const bottoni=[...p.querySelectorAll('button')];
   p.addEventListener('keydown',e=>{
    const n=bottoni.indexOf(document.activeElement);let prossimo;
    if((e.key==='Enter'||e.key===' ')&&n>=0){e.preventDefault();e.stopPropagation();bottoni[n].click();return;}
    if(e.key==='ArrowDown')prossimo=(n+1)%bottoni.length;
    if(e.key==='ArrowUp')prossimo=(n+bottoni.length-1)%bottoni.length;
    if(e.key==='Home')prossimo=0;if(e.key==='End')prossimo=bottoni.length-1;
    if(prossimo!==undefined){e.preventDefault();bottoni[prossimo].focus();}
    if(e.key==='Escape'){e.preventDefault();p.hidePopover();selettore.focus();}
    if(e.key==='Tab')p.hidePopover();
   });
   (bottoni.find(b=>b.getAttribute('aria-checked')==='true')||bottoni[0]).focus();
  }
  selettore.onclick=apriStili;
  selettore.addEventListener('keydown',e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();apriStili();}});
  cm.on('cursorActivity',stato);cm.on('changes',stato);
  const sommario=bottone('Sommario dell’appunto','list',()=>{
   const elenco=titoli(cm),versione=s.versione,originale=cm.getValue(),p=popup(sommario,'Sommario dell’appunto');
   if(!elenco.length)p.textContent='Aggiungi un titolo per navigare nell’appunto.';
   for(const h of elenco){const b=document.createElement('button');b.type='button';b.textContent='#'.repeat(h.livello)+' '+h.testo;b.style.paddingLeft=(h.livello-1)*12+8+'px';b.onclick=()=>{p.hidePopover();if(s.versione!==versione||originale!==cm.getValue()||!testoScrivibile(s))return;cm.setCursor(h.line,0);cm.scrollIntoView({line:h.line,ch:0},80);cm.focus();};p.append(b);}
   p.querySelector('button')?.focus();
  });sommario.classList.add('note-sommario');bar.append(sommario);
  const lingua=AppuntiDizionari.installa(bar);
  let timer,giro=0,segni=[];
  function pulisci(){segni.forEach(m=>m.clear());segni=[];}
  async function controlla(){
   const turno=++giro;clearTimeout(timer);pulisci();if(!lingua.value||!s.cur)return;
   const versione=s.versione,contenuto=cm.getValue(),vista=cm.getViewport(),parole=[];
   for(let line=vista.from;line<vista.to;line++)for(const m of cm.getLine(line).matchAll(/\p{L}+(?:['’]\p{L}+)*/gu)){
    if(m[0].length<2||m[0].length>100||/comment|link|url|string|code/.test(cm.getTokenTypeAt({line,ch:m.index+1})||''))continue;
    parole.push({testo:m[0],da:{line,ch:m.index},a:{line,ch:m.index+m[0].length}});
   }
   try{const errori=new Set(await ortografia({lingua:lingua.value,parole:[...new Set(parole.map(p=>p.testo))]}));
    if(turno!==giro||versione!==s.versione||contenuto!==cm.getValue())return;
    cm.operation(()=>{for(const p of parole)if(errori.has(p.testo))segni.push(cm.markText(p.da,p.a,{className:'note-errore-ortografico',title:'Clic destro per i suggerimenti'}));});
   }catch(e){if(turno===giro)toast(e.message,false);}
  }
  function programma(){++giro;clearTimeout(timer);timer=setTimeout(controlla,350);}
  window.addEventListener('zaino:ortografia',programma);
  cm.on('changes',programma);cm.on('viewportChange',programma);
  window.EvidenzeAppunti?.installa(s);
  // L'evento CodeMirror precede il suo menu nativo e il textarea temporaneo.
  // preventDefault impedisce che competano con il bubble al primo clic destro.
  cm.on('contextmenu',async(_cm,e)=>{
   if(window.EvidenzeAppunti?.menu(s,e))return;
   selMenuChiudi();selBarraChiudi();
   const pos=cm.coordsChar({left:e.clientX,top:e.clientY}),mark=cm.findMarksAt(pos).find(m=>m.className==='note-errore-ortografico');if(!mark)return;
   const range=mark.find();if(!range||!s.cur)return;
   e.preventDefault();e.stopPropagation();
   const parola=cm.getRange(range.from,range.to),versione=s.versione,originale=cm.getValue(),linguaScelta=lingua.value;
   const nodo=e.target.closest?.('.note-errore-ortografico'),r=nodo?nodo.getBoundingClientRect():cm.charCoords(range.from,'window');
   const p=popup(r,'Suggerimenti ortografici',true);p.tabIndex=-1;p.textContent='Suggerimenti…';p.setAttribute('aria-busy','true');p.focus({preventScroll:true});
   const attuale=()=>s.versione===versione&&cm.getValue()===originale&&lingua.value===linguaScelta;
   const chiudi=()=>{if(p.matches(':popover-open'))p.hidePopover();};
   const invalidato=()=>{if(!attuale())chiudi();};
   cm.on('changes',invalidato);cm.on('scroll',chiudi);window.addEventListener('zaino:ortografia',invalidato);
   p.addEventListener('toggle',()=>{if(!p.matches(':popover-open')){cm.off('changes',invalidato);cm.off('scroll',chiudi);window.removeEventListener('zaino:ortografia',invalidato);}});
   try{
    const suggerimenti=await ortografia({lingua:linguaScelta,parola});
    if(!p.matches(':popover-open')||!attuale()){chiudi();return;}
    p.replaceChildren();p.removeAttribute('aria-busy');
    if(!suggerimenti.length)p.textContent='Nessun suggerimento per «'+parola+'»';
    for(const t of suggerimenti){
     const b=document.createElement('button');b.type='button';b.textContent=t;
     b.onclick=()=>{chiudi();if(!attuale()||!testoScrivibile(s))return;cm.replaceRange(t,range.from,range.to,'correzione');cm.focus();};p.append(b);
    }
    p.querySelector('button')?.focus({preventScroll:true});
   }catch(err){if(p.matches(':popover-open')){p.removeAttribute('aria-busy');p.textContent=err.message;}}
  });
  cm.getWrapperElement().addEventListener('paste',e=>{
   if(e.defaultPrevented||!s.cur||AppuntiAnnotaUI.aperta(s))return;
   const html=e.clipboardData?.getData('text/html'),plain=e.clipboardData?.getData('text/plain')||'';
   if(!html||plain.startsWith('```zaino-tabella')||e.shiftKey)return;
   const doc=new DOMParser().parseFromString(html,'text/html');
   const immagini=doc.querySelectorAll('img');
   immagini.forEach(n=>n.replaceWith(doc.createTextNode(n.alt||'[Immagine]')));
   doc.querySelectorAll('script,style,iframe,object,embed,svg,meta,link').forEach(n=>n.remove());
   for(const a of doc.querySelectorAll('a'))if(!/^(https?:|mailto:)/i.test(a.getAttribute('href')||''))a.removeAttribute('href');
   const md=AppuntiHtmlMarkdown.turndown(doc.body);if(!md.trim())return;
   e.preventDefault();e.stopPropagation();cm.replaceSelection(md,'end','incolla');cm.focus();
   if(immagini.length)toast('Incollato il testo. Per le immagini usa ALBUM.');
  },true);
  stato();programma();
 }
 window.AppuntiStrumenti={installa,titoli};
 for(const s of noteStati())if(s.mde)installa(s);
})();
