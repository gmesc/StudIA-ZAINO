/* Gli stessi segni nei due lettori. Ogni gesto produce un passo Undo e una
 * scrittura; i movimenti intermedi sono solo una bozza nella vista. */
(function(){
 'use strict';
 const M=PdfAnnotazioni,api=window.vault?.pdfSegni,NS='http://www.w3.org/2000/svg',cache=new Map(),viste=[];
 const E=(t,txt,cls)=>{const e=document.createElement(t);if(txt)e.textContent=txt;if(cls)e.className=cls;return e;};
 const svg=(t,a={})=>{const e=document.createElementNS(NS,t);Object.entries(a).forEach(([k,v])=>e.setAttribute(k,v));return e;};
 const copia=v=>JSON.parse(JSON.stringify(v));
 const nomi={seleziona:'Seleziona',penna:'Penna',linea:'Linea',freccia:'Freccia',rettangolo:'Forma',ellisse:'Ellisse',testo:'Testo',postit:'Post-it'};
 const nomiForme={rettangolo:'Rettangolo / quadrato',triangolo:'Triangolo',pentagono:'Pentagono',esagono:'Esagono',ottagono:'Ottagono'};
 const scorciatoie={seleziona:'V',penna:'P',linea:'L',freccia:'F',rettangolo:'R',ellisse:'O',testo:'T',postit:'N'};
 const iconeLocali={seleziona:'<path d="m5 3 14 9-7 1-3 7Z"/>',linea:'<path d="m4 20 16-16"/>',ellisse:'<ellipse cx="12" cy="12" rx="9" ry="7"/>',postit:'<path d="M4 3h16v12l-5 6H4Z"/><path d="M15 21v-6h5M7 8h10M7 12h7"/>'};
 function icona(tipo){return iconeLocali[tipo]?'<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+iconeLocali[tipo]+'</svg>':UiIcone.svg(({penna:'pencil',freccia:'arrow-right',rettangolo:'square',testo:'type'})[tipo]||tipo);}
 function iconButton(nome,tipo,fn,tasto){const b=bottone('',fn);b.innerHTML=icona(tipo);b.title=nome+(tasto?' · '+TastiNomi.perPiattaforma(tasto,TastiNomi.suMac(navigator)):'');b.setAttribute('aria-label',b.title);return b;}
 function strumento(c,tipo){if(c.bloccata)return;c.tool=tipo;c.selezione='';c.bubbleNascosta='';c.preferenze=false;chiudiBubble(c);dipingi(c);statoBarra(c);}
 function leggiRecenti(){try{return M.recenti(JSON.parse(localStorage.getItem('zaino.pdfsegni.colori')||'[]'));}catch(_){return [];}}
 function scegliColore(c,b,key,nome){
  const id=c.selezione,stato=c.stato;
  ZainoPalette.apri({ancora:b,nome,valore:selezionato(c)?.[key]||c.stile[key],recenti:leggiRecenti(),pipetta:true,neutri:false,valido:()=>c.attivo&&!c.bloccata&&c.stato===stato&&c.selezione===id,onSelect:v=>{
   try{localStorage.setItem('zaino.pdfsegni.colori',JSON.stringify(M.recenti(leggiRecenti(),v)));}catch(_){avvisa('Non è stato possibile ricordare i colori recenti.');}
   modifica(c,{[key]:v});
  }});
 }
 function campioneTratto(spessore){return '<svg viewBox="0 0 48 16" width="48" height="16" aria-hidden="true"><path d="M4 8H44" stroke="currentColor" stroke-width="'+spessore+'" stroke-linecap="round"/></svg>';}
 function campionePunta(punta,bidirezionale=false){const s={tipo:'freccia',punta,bidirezionale,spessore:2,punti:[[5,8],[43,8]]};return '<svg viewBox="0 0 48 16" width="48" height="16" aria-hidden="true"><path d="'+M.percorso(s)+'" fill="none" stroke="currentColor" stroke-width="2"/>'+M.pieni(s).map(t=>'<path d="'+M.percorsoPunti([t])+'Z" fill="currentColor"/>').join('')+'</svg>';}
 function campioneForma(forma){return '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="'+M.percorso({tipo:'rettangolo',forma,punti:[[3,3],[21,21]]})+'" transform="translate(0 24) scale(1 -1)" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/></svg>';}
 function opzioni(c,b,key,scelte,anteprima,soloIcone=false){
  c.menu?.remove();const p=E('div',null,'pdf-segni-opzioni tbar-ctl');p.popover='auto';p.setAttribute('role','group');p.setAttribute('aria-label',b.getAttribute('aria-label'));
  const val=selezionato(c)?.[key]??c.stile[key];
  if(soloIcone)p.classList.add('pdf-segni-forme');
  for(const [v,n]of scelte){const x=bottone(n,()=>{p.hidePopover();p.remove();c.menu=null;modifica(c,{[key]:v});});x.dataset.valore=v;x.title=n;x.setAttribute('aria-label',n);x.setAttribute('aria-pressed',String(val===v));if(anteprima){x.textContent='';x.innerHTML=anteprima(v);if(!soloIcone)x.append(E('span',n));}p.append(x);}
  c.bubble.append(p);c.menu=p;p.showPopover();const r=b.getBoundingClientRect(),q=p.getBoundingClientRect();p.style.left=Math.max(8,Math.min(r.left,innerWidth-q.width-8))+'px';p.style.top=Math.max(8,Math.min(r.bottom+4,innerHeight-q.height-8))+'px';p.querySelector('button[aria-pressed=true]')?.focus({preventScroll:true});
  p.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();p.hidePopover();p.remove();c.menu=null;b.focus();}};
 }
 function chiudiBubble(c){if(c.bubble?.contains(document.querySelector('.zaino-palette')?.ancora))ZainoPalette.chiudi(false);c.menu?.remove();c.menu=null;c.bubble?.remove();c.bubble=null;c.bubbleKey='';}
 function nascondiBubble(c){c.preferenze=false;c.bubbleNascosta=c.selezione;chiudiBubble(c);}
 function righeTesto(s){const ctx=document.createElement('canvas').getContext('2d');ctx.font=s.fontSize+'px '+M.fontCss(s.fontUi);return M.righe(s,t=>ctx.measureText(t).width);}
 function boxSegno(c,s){const node=c.frame.querySelector('[data-segno="'+s.id+'"]');return M.limiti(s,s.tipo==='postit'?righeTesto(s).length:s.tipo==='testo'?node?.querySelector('text')?.getBBox():null);}
 function aggiornaBubble(c){
  const sel=selezionato(c);if(!c.attivo||c.gesto||(sel&&c.bubbleNascosta===sel.id)||(!sel&&!c.preferenze)||!c.stato){chiudiBubble(c);return;}
  const s=sel||{...c.stile,tipo:c.tool==='seleziona'?'penna':c.tool},key=JSON.stringify([sel?.id||'preferenze',s]);
  if(c.bubbleKey!==key){
   chiudiBubble(c);c.bubbleKey=key;const p=c.bubble=E('div',null,'pdf-segni-bubble tbar-ctl');p.popover='manual';p.setAttribute('role','dialog');p.setAttribute('aria-label','Aspetto '+nomi[s.tipo]);
   const head=E('div',null,'pdf-segni-bubble-head');head.append(E('strong',sel?nomi[s.tipo]:'Stile di disegno · '+nomi[s.tipo].toLowerCase()));head.title=sel?'Modifica il segno selezionato':'Imposta l’aspetto dei nuovi segni; quelli già disegnati restano invariati.';head.append(iconButton('Chiudi impostazioni','x',()=>nascondiBubble(c),'Esc'));p.append(head);
   const campi=E('div',null,'pdf-segni-campi');p.append(campi);
   function campo(nome,b){const l=E('div',null,'pdf-segni-campo');l.append(E('span',nome),b);campi.append(l);b.setAttribute('aria-label',nome);return b;}
   function tendina(nome,prop,scelte,anteprima,soloIcone=false){const b=bottone('',()=>opzioni(c,b,prop,scelte,anteprima,soloIcone));b.classList.add('pdf-segni-tendina');b.setAttribute('aria-haspopup','true');b.dataset.parametro=prop;const valore=s[prop],titolo=scelte.find(x=>x[0]===valore)?.[1]||String(valore);if(anteprima)b.innerHTML=anteprima(valore);else b.append(E('span',titolo));b.insertAdjacentHTML('beforeend',UiIcone.svg('chevron-down'));b.title=nome+' · '+titolo;return campo(nome,b);}
   function colore(nome,prop){const b=bottone('',()=>scegliColore(c,b,prop,nome));b.dataset.parametro=prop;b.classList.add('pdf-segni-colore');const sw=E('i',null,'zaino-campione');sw.style.backgroundColor=s[prop];b.append(sw,E('span',PresentaColori.etichetta(s[prop])));b.title=nome+' · '+s[prop]+' · palette Tailwind';return campo(nome,b);}
   colore(M.haTesto(s)?'Testo':'Colore','colore');
   if(s.tipo==='postit')colore('Sfondo','fondo');
   if(!M.haTesto(s))tendina('Spessore','spessore',M.SPESSORI.map((v,i)=>[v,['Fine','Medio','Spesso','Molto spesso'][i]+' · '+v+' pt']),campioneTratto);
   if(s.tipo==='freccia'){
    tendina('Punta','punta',[['pallino','Pallino'],['aperta','Due lati'],['triangolo','Triangolo pieno'],['t','Terminale a T']],campionePunta);
    tendina('Direzione','bidirezionale',[[false,'Una punta'],[true,'Due punte']],v=>campionePunta(s.punta,v));
   }
   if(s.tipo==='rettangolo')tendina('Forma','forma',M.FORME.map(f=>[f,nomiForme[f]]),campioneForma,true);
   if(M.haTesto(s))tendina('Dimensione','fontSize',[12,16,18,24,32].map(v=>[v,v+' pt']));
   tendina('Opacità','opacita',[.25,.5,.75,1].map(v=>[v,Math.round(v*100)+'%']));
   if(M.haTesto(s)){const f=E('small',s.fontUi==='atkinson'?'Atkinson Hyperlegible':'Font dell’interfaccia');f.title='Font scelto in Impostazioni → Aspetto';p.append(f);}
   if(sel){const azioni=E('div',null,'pdf-segni-bubble-azioni');if(M.haTesto(s))azioni.append(iconButton('Modifica testo','pencil',()=>testo(c,selezionato(c)),'Doppio clic'));azioni.append(iconButton('Elimina segno','trash-2',()=>elimina(c),'Canc'));p.append(azioni);}
   document.body.append(p);p.showPopover();p.onkeydown=e=>{if(e.key==='Escape'&&!c.menu&&!ZainoPalette.aperta()){e.preventDefault();e.stopPropagation();nascondiBubble(c);}};
  }
  const node=sel?c.frame.querySelector('[data-segno="'+sel.id+'"]'):c.preferenzeBtn;
  if(!node?.getBoundingClientRect().width){chiudiBubble(c);return;}
  const r=node.getBoundingClientRect(),b=c.bubble.getBoundingClientRect(),f=c.frame.getBoundingClientRect();
  const x=Math.max(0,Math.min(f.left,innerWidth-b.width-16)),y=Math.max(0,f.top),v={width:Math.max(b.width+16,Math.min(f.right,innerWidth)-x),height:Math.max(b.height+16,Math.min(f.bottom,innerHeight)-y)};
  const pos=M.posiziona({x:r.x-x,y:r.y-y,width:r.width,height:r.height},b,v);c.bubble.style.left=(pos.x+x)+'px';c.bubble.style.top=(pos.y+y)+'px';
 }
 function chiediPostit(valore){return new Promise(resolve=>{
  const d=E('dialog',null,'pdf-postit-editor'),titolo=E('strong','Testo del post-it'),input=E('textarea'),azioni=E('div',null,'tbar');input.value=valore||'';input.maxLength=2000;input.setAttribute('aria-label','Testo del post-it');d.append(titolo,input,azioni);
  function fine(v){d.close();d.remove();resolve(v);}
  azioni.append(bottone('Annulla',()=>fine(null)),bottone('Applica',()=>fine(input.value)));d.oncancel=e=>{e.preventDefault();fine(null);};d.onkeydown=e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){e.preventDefault();fine(input.value);}e.stopPropagation();};document.body.append(d);d.showModal();input.focus();
 });}

 let raf=0;
 function avvisa(e){toast(e?.message||String(e),false);}
 function aggiorna(){if(!raf)raf=requestAnimationFrame(()=>{raf=0;viste.forEach(c=>{if(c.locale){if(!c.gesto)dipingi(c);statoBarra(c);}else sincronizza(c);});});}
 function bottone(nome,fn){const b=E('button',nome,'tbtn');b.type='button';b.onclick=fn;return b;}
 function separa(bar,e){if(bar.children.length)bar.append(E('i',null,'tbsep'));bar.append(e);return e;}
 function dati(c){return c.stato?.documento.segni||[];}
 function selezionato(c){return dati(c).find(s=>s.id===c.selezione);}
 function statoBarra(c){
  const s=c.stato,sel=selezionato(c);c.apri.disabled=!s||!!c.errore;c.apri.setAttribute('aria-pressed',String(c.attivo));c.bar.hidden=!c.attivo;
  c.bar.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===c.tool)));
  c.undo.disabled=!s?.prima.length;c.redo.disabled=!s?.dopo.length;c.export.disabled=!s||s.pending>0||!!s.errore;
  c.riprova.hidden=!s?.errore;c.status.dataset.errore=String(!!s?.errore);c.status.textContent=s?.errore?'Non salvato':s?.pending?'Salvataggio…':'Salvato';c.status.title=s?.errore||'';
  c.status.setAttribute('aria-label',c.status.textContent);c.status.title=s?.errore||c.status.textContent;aggiornaBubble(c);
 }
 function aggiornaViste(s){for(const c of viste)if(c.stato===s){dipingi(c);statoBarra(c);}}
 function salva(s){
  const snapshot=copia(s.documento.segni);s.pending++;
  s.coda=s.coda.then(async()=>{
   if(s.errore)return;
   const r=s.salvaLocale?await s.salvaLocale(snapshot):await api.salva(s.z,s.file,s.id,{versione:1,revisione:s.revisione,segni:snapshot});
   if(r.error)throw Error(r.error);s.revisione=r.revisione;s.documento.revisione=r.revisione;
  }).catch(e=>{s.errore=e.message;avvisa(e);}).finally(()=>{s.pending--;aggiornaViste(s);});
  aggiornaViste(s);return s.coda;
 }
 function cambia(c,segni){if(c.bloccata)return;const s=c.stato;if(!s||s.errore){if(s?.errore)avvisa(s.errore);return;}const next=M.valida({...s.documento,segni}).segni;s.prima.push(copia(s.documento.segni));if(s.prima.length>80)s.prima.shift();s.dopo=[];s.documento.segni=next;salva(s);}
 function modifica(c,delta){if(c.bloccata)return;Object.assign(c.stile,delta);const sel=selezionato(c);if(sel)cambia(c,dati(c).map(s=>s.id===sel.id?{...s,...delta}:s));else statoBarra(c);}
 function cronologia(c,redo){if(c.bloccata)return;const s=c.stato,da=redo?s.dopo:s.prima,a=redo?s.prima:s.dopo;if(!da.length||s.errore)return;a.push(copia(s.documento.segni));s.documento.segni=da.pop();c.selezione='';salva(s);}
 async function testo(c,segno){
  const s=c.stato,doc=c.doc;chiudiBubble(c);const r=segno.tipo==='postit'?await chiediPostit(segno.testo):await askText(c.locale?'Testo del disegno':'Testo sul PDF',segno.testo||'');
  const t=typeof r==='string'?r:r?.testo;if(!t?.trim()||c.stato!==s||c.doc!==doc||c.smontata||c.bloccata)return;
  cambia(c,dati(c).some(x=>x.id===segno.id)?dati(c).map(x=>x.id===segno.id?{...segno,testo:t}:x):[...dati(c),{...segno,testo:t}]);c.selezione=segno.id;c.tool='seleziona';dipingi(c);statoBarra(c);
 }
 async function carica(c,doc,file,z){
  c.doc=doc;c.stato=null;c.errore='';c.selezione='';c.attivo=false;statoBarra(c);
  if(!doc||!file){dipingi(c);return;}
  try{
   const r=await api.leggi(z,file);if(c.doc!==doc)return;if(r.error)throw Error(r.error);
   const key=z+'\n'+r.id;let s=cache.get(key);
   if(!s){s={id:r.id,z,file,documento:M.valida(r),revisione:r.revisione,prima:[],dopo:[],pending:0,coda:Promise.resolve(),errore:''};cache.set(key,s);}else s.file=file;
   c.stato=s;dipingi(c);statoBarra(c);
  }catch(e){if(c.doc!==doc)return;c.errore=e.message;c.apri.title=e.message;avvisa(e);}
 }
 function sincronizza(c){
  const r=c.leggi(),doc=r?.viewer?.pdfDocument||null;
  if(c.doc!==doc)carica(c,doc,r?.file,corsoAttivo());
  c.viewer=r?.viewer;
  if(c.bus!==r?.bus&&r?.bus){c.bus=r.bus;['pagerendered','scalechanging','rotationchanging'].forEach(n=>c.bus.on(n,aggiorna));}
  if(!c.gesto)dipingi(c);statoBarra(c);
 }
 function viewport(c,n){return c.locale?c.viewport:c.viewer?.getPageView(n-1)?.viewport;}
 function dipingi(c){
  (c.locale?[c.foglio]:c.frame.querySelectorAll('.page')).forEach(p=>{
   const n=c.locale?1:+p.dataset.pageNumber,v=viewport(c,n);if(!v)return;
   let layer=p.querySelector(':scope > .pdf-segni');if(!layer){layer=svg('svg',{'class':'pdf-segni',tabindex:'0','aria-label':c.locale?'Disegno modificabile':'Annotazioni della pagina '+n});p.append(layer);layer.addEventListener('pointerdown',e=>avvia(c,layer,n,e));layer.addEventListener('dblclick',e=>{const s=selezionato(c);if(s&&M.haTesto(s))testo(c,s);});layer.addEventListener('keydown',e=>tasto(c,e));}
   layer.setAttribute('viewBox','0 0 '+v.width+' '+v.height);layer.dataset.edit=String(c.attivo&&!!c.stato&&!c.stato.errore);layer.tabIndex=c.attivo?0:-1;layer.dataset.tool=c.tool;
   const segni=dati(c).filter(s=>s.pagina===n).map(s=>c.gesto?.segno?.id===s.id?c.gesto.segno:s);if(c.gesto?.nuovo&&c.gesto.segno.pagina===n)segni.push(c.gesto.segno);
   const g=svg('g',{transform:'matrix('+v.transform.join(' ')+')'});layer.replaceChildren(g);
   for(const s of segni){
    const og=svg('g',{'data-segno':s.id,opacity:s.opacita});g.append(og);
    if(M.haTesto(s)){
     const righe=righeTesto(s);
     if(s.tipo==='postit'){const box=M.riquadro(s,righe.length);og.append(svg('rect',{x:box.x,y:box.y,width:box.w,height:box.h,fill:s.fondo}));}
     const t=svg('text',{transform:'translate('+s.punti[0].join(' ')+') scale(1 -1)',fill:s.colore,'font-family':M.fontCss(s.fontUi),'font-size':s.fontSize});
     righe.forEach((r,i)=>{const span=svg('tspan',{x:0,dy:i?s.fontSize*1.2:0});span.textContent=r;t.append(span);});og.append(t);
    }else{
     og.append(svg('path',{d:M.percorso(s),fill:'none',stroke:s.colore,'stroke-width':s.spessore,'stroke-linecap':'round','stroke-linejoin':'round'}));
     for(const pieno of M.pieni(s))og.append(svg('path',{d:M.percorsoPunti([pieno])+'Z',fill:s.colore}));
    }
    if(c.attivo&&c.selezione===s.id){
     const box=boxSegno(c,s),a=v.convertToViewportPoint(box.x,box.y),b=v.convertToViewportPoint(box.x+box.w,box.y+box.h),rect=svg('rect',{'data-selezione':s.id,x:Math.min(a[0],b[0])-4,y:Math.min(a[1],b[1])-4,width:Math.abs(b[0]-a[0])+8,height:Math.abs(b[1]-a[1])+8,fill:'none',stroke:'#0f766e','stroke-width':1,'stroke-dasharray':'4 3'});layer.append(rect);
     const punti=s.tipo==='penna'||M.haTesto(s)?[[box.x,box.y],[box.x+box.w,box.y+box.h]]:s.punti;
     punti.forEach((q,i)=>{const p=v.convertToViewportPoint(...q),h=svg('circle',{'data-maniglia':i,cx:p[0],cy:p[1],r:5,fill:'white',stroke:'#0f766e','stroke-width':1.5}),t=svg('title');t.textContent='Ridimensiona · Maiusc mantiene le proporzioni';h.append(t);layer.append(h);});
     if(s.tipo==='freccia'){const p=v.convertToViewportPoint(...M.manigliaCurva(s)),h=svg('circle',{'data-maniglia':'curva',cx:p[0],cy:p[1],r:5,fill:'#0f766e',stroke:'white','stroke-width':1.5}),t=svg('title');t.textContent='Curvatura · trascina per incurvare la freccia';h.append(t);layer.append(h);}
    }
   }
  });
 }
 function avvia(c,layer,n,e){
  if(e.button!==0||c.bloccata||!c.attivo||!c.stato||c.stato.errore||c.frame.classList.contains('pdf-spazio'))return;
  e.preventDefault();e.stopPropagation();getSelection()?.removeAllRanges();layer.focus({preventScroll:true});
  const v=viewport(c,n),rect=layer.getBoundingClientRect();
  const punto=e=>v.convertToPdfPoint(Math.max(0,Math.min(v.width,(e.clientX-rect.left)*v.width/rect.width)),Math.max(0,Math.min(v.height,(e.clientY-rect.top)*v.height/rect.height)));
  const a=punto(e),hit=e.target.closest('[data-segno]')?.dataset.segno,handle=e.target.dataset.maniglia,sel=c.tool==='seleziona'?(handle!=null?selezionato(c):dati(c).find(s=>s.id===hit)):null;
  if(c.tool==='seleziona'&&!sel){c.selezione='';dipingi(c);statoBarra(c);return;}
  c.bubbleNascosta='';const nuovaSelezione=sel&&c.selezione!==sel.id;
  if(sel)c.selezione=sel.id;
  const originale=sel?copia(sel):{id:crypto.randomUUID(),tipo:c.tool,pagina:n,...c.stile,punti:[a,a],...(M.haTesto({tipo:c.tool})?{testo:'',fontUi:document.documentElement.dataset.fontUi||'zaino'}:{})};
  const boxOriginale=sel?boxSegno(c,sel):null;
  if(!sel&&M.haTesto(originale)){testo(c,originale);return;}
  chiudiBubble(c);const g={segno:originale,nuovo:!sel,mossa:false};c.gesto=g;layer.setPointerCapture(e.pointerId);
  function move(ev){if(ev.pointerId!==e.pointerId)return;const b=punto(ev);g.mossa=true;
   if(sel){if(handle==='curva'){g.segno=M.curvaDaManiglia(originale,b);}else if(handle!=null){if(sel.tipo==='penna'||M.haTesto(sel)){const box=boxOriginale,anc=+handle===0?[box.x+box.w,box.y+box.h]:[box.x,box.y],start=+handle===0?[box.x,box.y]:[box.x+box.w,box.y+box.h],kx=(b[0]-anc[0])/(start[0]-anc[0]||1),ky=(b[1]-anc[1])/(start[1]-anc[1]||1);g.segno={...originale,punti:originale.punti.map(p=>[anc[0]+(p[0]-anc[0])*kx,anc[1]+(p[1]-anc[1])*ky]),...(M.haTesto(sel)?{...(sel.tipo==='postit'?{larghezza:Math.max(48,Math.min(600,originale.larghezza*Math.abs(kx)))}:{}),fontSize:Math.max(6,Math.min(96,originale.fontSize*Math.abs(ky)))}:{})};}else{g.segno=M.ridimensiona(originale,+handle,b,ev.shiftKey);}}else g.segno=M.sposta(originale,b[0]-a[0],b[1]-a[1]);}
   else if(c.tool==='penna'){if(g.segno.punti.length<10000)g.segno={...g.segno,punti:[...g.segno.punti,b]};}else{if(ev.shiftKey){if(c.tool==='linea'||c.tool==='freccia'){if(Math.abs(b[0]-a[0])>Math.abs(b[1]-a[1]))b[1]=a[1];else b[0]=a[0];}else{const p=M.vincolaPunto(a,b);b[0]=p[0];b[1]=p[1];}}g.segno={...originale,punti:[a,b]};}dipingi(c);
  }
  function fine(ev){c.annullaGesto=null;layer.removeEventListener('pointermove',move);layer.removeEventListener('pointerup',fine);layer.removeEventListener('pointercancel',fine);c.gesto=null;if(layer.hasPointerCapture(e.pointerId))layer.releasePointerCapture(e.pointerId);if(ev.type==='pointerup'&&g.mossa){c.selezione=g.segno.id;try{cambia(c,g.nuovo?[...dati(c),g.segno]:dati(c).map(s=>s.id===g.segno.id?g.segno:s));}catch(err){avvisa(err);}c.tool='seleziona';}if(g.mossa||g.nuovo)dipingi(c);statoBarra(c);}
  c.annullaGesto=()=>fine({type:'pointercancel'});layer.addEventListener('pointermove',move);layer.addEventListener('pointerup',fine);layer.addEventListener('pointercancel',fine);if(g.nuovo||nuovaSelezione)dipingi(c);statoBarra(c);
 }
 function elimina(c){chiudiBubble(c);if(c.selezione)cambia(c,dati(c).filter(s=>s.id!==c.selezione));c.selezione='';dipingi(c);}
 function tasto(c,e){
  if(c.bloccata||!c.attivo||!c.stato||c.stato.errore)return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.stopPropagation();cronologia(c,e.shiftKey);return;}
  if(['Backspace','Delete'].includes(e.key)){e.preventDefault();e.stopPropagation();elimina(c);}
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();c.selezione='';c.tool='seleziona';dipingi(c);statoBarra(c);}
  const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key],sel=selezionato(c);
  if(delta&&sel){e.preventDefault();e.stopPropagation();const v=viewport(c,sel.pagina),a=v.convertToPdfPoint(0,0),b=v.convertToPdfPoint(delta[0]*(e.shiftKey?10:1),delta[1]*(e.shiftKey?10:1));cambia(c,dati(c).map(s=>s.id===sel.id?M.sposta(s,b[0]-a[0],b[1]-a[1]):s));}
 }
 function strumenti(c,bar=c.bar){
  for(const tipo of Object.keys(nomi)){const b=iconButton(nomi[tipo],tipo,()=>strumento(c,tipo),scorciatoie[tipo]);b.dataset.tool=tipo;b.setAttribute('aria-keyshortcuts',scorciatoie[tipo]);if(['rettangolo','ellisse'].includes(tipo))b.title+=' · Maiusc mantiene le proporzioni';separa(bar,b);}
  c.preferenzeBtn=separa(bar,iconButton('Stile di disegno: imposta l’aspetto dei nuovi segni','settings',()=>{c.selezione='';c.bubbleNascosta='';dipingi(c);c.preferenze=!c.preferenze;c.stile.fontUi=document.documentElement.dataset.fontUi||'zaino';aggiornaBubble(c);}));c.preferenzeBtn.dataset.pdfPreferenze='';
  c.undo=separa(bar,iconButton('Annulla','undo-2',()=>cronologia(c,false),'⌘Z'));c.undo.dataset.pdfAnnulla='';
  c.redo=separa(bar,iconButton('Ripeti','redo-2',()=>cronologia(c,true),'⌘⇧Z'));c.redo.dataset.pdfRipeti='';
 }
 function crea(paneId,frameId,leggi){
  const pane=document.getElementById(paneId),frame=document.getElementById(frameId),barra=pane.querySelector('.pdfbar');if(!pane||!barra)return;
  const c={pane,frame,leggi,doc:null,tool:'seleziona',attivo:false,selezione:'',stile:{colore:'#ef4444',spessore:2,opacita:1,fontSize:18,punta:'aperta',bidirezionale:false,forma:'rettangolo',fondo:'#fef08a',larghezza:180,fontUi:'zaino'}},bar=c.bar=E('div',null,'tbar pdf-segni-bar');bar.hidden=true;bar.setAttribute('aria-label','Annotazioni PDF');
  c.apri=iconButton('Annota','pencil-draw',()=>{if(!c.stato)return;c.attivo=!c.attivo;if(c.attivo){closePops();getSelection()?.removeAllRanges();}else chiudiBubble(c);dipingi(c);statoBarra(c);});c.apri.dataset.pdfAnnota='';c.apri.title='Annota · Disegna e modifica segni sul PDF · fino a 128 MB';c.apri.setAttribute('aria-label',c.apri.title);barra.insertBefore(c.apri,barra.querySelector('.pdfazioni'));barra.after(bar);
  strumenti(c);
  c.export=separa(bar,iconButton('Esporta PDF annotato','file-down',async()=>{const s=c.stato;try{await s.coda;if(s.errore)throw Error(s.errore);const r=await api.esporta(s.z,s.file);if(r.error)throw Error(r.error);if(r.ok)toast('Copia PDF annotata esportata.',true);}catch(e){avvisa(e);}}));
  c.riprova=separa(bar,iconButton('Riprova salvataggio','refresh-cw',()=>{c.stato.errore='';salva(c.stato);}));c.status=E('output');c.status.setAttribute('role','status');bar.append(c.status);viste.push(c);
  frame.addEventListener('scroll',()=>aggiornaBubble(c));
  new MutationObserver(ms=>{if(ms.some(m=>!m.target.closest?.('.pdf-segni,.pdf-segni-bar,.pdfbar')))aggiorna();}).observe(frame,{subtree:true,childList:true});
  new MutationObserver(aggiorna).observe(pane,{attributes:true,attributeFilter:['data-doc']});
 }

 function monta({pane,frame,foglio,barra,apri,viewport:v,segni=[],onChange=()=>{}}){
  const c={pane,frame,foglio,bar:barra,apri,viewport:v,locale:true,doc:{},attivo:true,tool:'penna',selezione:'',stile:{colore:'#0f766e',spessore:2,opacita:1,fontSize:18,punta:'aperta',bidirezionale:false,forma:'rettangolo',fondo:'#fef08a',larghezza:180,fontUi:'zaino'}};
  c.stato={documento:M.valida({versione:1,revisione:0,segni}),prima:[],dopo:[],pending:0,coda:Promise.resolve(),errore:'',revisione:0,salvaLocale:async snapshot=>{if(!c.smontata)onChange(copia(snapshot));return {revisione:c.stato.revisione+1};}};
  const gruppo=E('div',null,'tbar note-annota-strumenti');c.bar.append(gruppo);strumenti(c,gruppo);c.export=bottone('',()=>{});c.riprova=bottone('',()=>{});c.status=E('output');
  const tastiera=e=>{if(!e.defaultPrevented&&!e.target.closest('input,textarea,select'))tasto(c,e);};c.bar.addEventListener('keydown',tastiera);
  viste.push(c);dipingi(c);statoBarra(c);
  const scroll=()=>aggiornaBubble(c),resize=new ResizeObserver(()=>aggiornaBubble(c));frame.addEventListener('scroll',scroll);resize.observe(frame);
  return {
   segni:()=>copia(dati(c)),
   blocca(v){c.bloccata=v;c.bar.inert=v;if(v)chiudiBubble(c);},
   async pronto(){if(c.gesto)throw Error('Termina il tratto prima di applicare il disegno.');await c.stato.coda;if(c.stato.errore)throw Error(c.stato.errore);},
   svg(){const layer=foglio.querySelector('.pdf-segni'),out=svg('svg',{xmlns:NS,viewBox:'0 0 '+v.width+' '+v.height,width:v.width,height:v.height});out.append(layer.firstElementChild.cloneNode(true));out.querySelectorAll('[data-segno]').forEach(n=>n.removeAttribute('data-segno'));return out;},
   smonta(){c.annullaGesto?.();c.smontata=true;c.attivo=false;chiudiBubble(c);viste.splice(viste.indexOf(c),1);resize.disconnect();c.bar.removeEventListener('keydown',tastiera);frame.removeEventListener('scroll',scroll);foglio.querySelector('.pdf-segni')?.remove();apri.setAttribute('aria-pressed','false');}
  };
 }
 window.AnnotazioniUI={monta,crea};
 if(!api)return;
 crea('pdfPane','pdfFrame',()=>({viewer:ANTEPRIMA.tipo==='pdf'?PDFJS.viewer:null,bus:PDFJS.bus,file:ANTEPRIMA.file}));
 crea('pdfPane2','pdf2Frame',()=>({viewer:FONTE2.viewer,bus:FONTE2.bus,file:FONTE2.file}));
 window.addEventListener('banco-layout',aggiorna);window.addEventListener('resize',aggiorna);
 window.addEventListener('beforeunload',e=>{if([...cache.values()].some(s=>s.pending||s.errore)){e.preventDefault();e.returnValue='';avvisa('Attendi il salvataggio delle annotazioni PDF prima di chiudere.');}});
 // Dopo Undo/Redo un bottone può diventare disabilitato e perdere il focus.
 // La cronologia della bozza resta proprietaria del gesto nel banco attivo.
 document.addEventListener('keydown',e=>{
  if(e.defaultPrevented||e.isComposing||e.altKey||!(e.metaKey||e.ctrlKey)||e.key.toLowerCase()!=='z'||e.target.closest?.('input,textarea,select,[contenteditable=true],dialog'))return;
  const c=viste.find(c=>c.locale&&c.attivo&&(c.pane.contains(e.target)||c.bubble?.contains(e.target)||e.target===document.body&&c.pane.closest('.blocco')?.dataset.blocco===BANCO.attivo));
  if(c)tasto(c,e);
 },true);
 document.addEventListener('keydown',e=>{
  if(e.defaultPrevented||e.isComposing||e.metaKey||e.ctrlKey||e.altKey||e.target.closest?.('input,textarea,select,[contenteditable=true],.CodeMirror,dialog,[popover]'))return;
  const c=viste.find(c=>c.attivo&&c.pane.closest('.blocco')?.dataset.blocco===BANCO.attivo);if(!c)return;
  const tipo=Object.keys(scorciatoie).find(k=>scorciatoie[k].toLowerCase()===e.key.toLowerCase());if(tipo){e.preventDefault();e.stopPropagation();strumento(c,tipo);}
 });
 document.addEventListener('pointerdown',e=>{for(const c of viste)if(c.bubble&&!c.bubble.contains(e.target)&&!c.frame.contains(e.target)&&!c.bar.contains(e.target)&&!e.target.closest?.('.zaino-palette,.pdf-postit-editor,#uiModal')){nascondiBubble(c);}});
 window.PdfSegniUI={aggiorna};aggiorna();
})();
