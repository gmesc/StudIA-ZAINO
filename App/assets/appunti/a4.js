/* APPUNTI: un'impaginazione fisica condivisa fra anteprima e PDF.
 * Chromium frammenta il testo in colonne alte quanto l'area stampabile. Ogni
 * foglio mostra una colonna, senza rimisurare il testo alla larghezza del banco.
 * Le figure sovrapposte hanno coordinate in mm, conservate nel Markdown.
 * L'export clona questi stessi fogli (testo selezionabile e disegni SVG). */
(function(){
 'use strict';
 const MM=96/25.4,W=170*MM,H=252*MM,PASSO=210*MM,stati=new WeakMap();
 const E=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;};
 function font(){return getComputedStyle(document.body).getPropertyValue('--font-documento').trim()||'Arial, sans-serif';}
 function stile(){let el=document.getElementById('noteA4Tipografia');if(!el){el=E('style');el.id='noteA4Tipografia';document.head.append(el);}el.textContent=StampaFoglio.corpo({tipo:'testo'},'.note-a4-paper');}
 function attiva(s){return noteHost(s)?.dataset.noteVista==='a4';}
 function bottone(nome,icona,fn){const b=E('button','tbtn');b.type='button';b.title=nome;b.setAttribute('aria-label',nome);if(icona)b.innerHTML=UiIcone.svg(icona);else b.textContent=nome;b.onclick=fn;return b;}
 function installa(s){
  const host=noteHost(s);if(stati.has(s))return;
  AppuntiFigureUI.installa(s);
  stile();const barra=E('span','note-viste'),scrittura=bottone('Scrittura','notebook-pen',()=>{if(scegli(s,'scrittura')){if(s.mde.isPreviewActive())s.mde.togglePreview();s.mde.codemirror.refresh();s.mde.codemirror.focus();}}),a4=host.querySelector('.editor-toolbar .preview');
  a4.innerHTML=UiIcone.svg('file-text');a4.title='Impaginazione A4 · Anteprima (⌘J)';a4.setAttribute('aria-label',a4.title);scrittura.classList.add('no-disable');
  scrittura.dataset.noteVista='scrittura';a4.dataset.noteVista='a4';barra.setAttribute('aria-label','Vista dell’appunto');
  const nav=E('div','note-a4-nav'),prima=bottone('Pagina precedente · ←','chevron-left',()=>pagina(s,-1)),dopo=bottone('Pagina successiva · →','chevron-right',()=>pagina(s,1)),numero=E('input'),totale=E('span'),zoom=E('label','note-a4-zoom'),zoomNumero=E('input');
  const meno=bottone('Riduci il foglio A4','minus',()=>impostaZoom(stati.get(s),(stati.get(s).scala*100)-25)),piu=bottone('Ingrandisci il foglio A4','plus',()=>impostaZoom(stati.get(s),(stati.get(s).scala*100)+25)),adattaBanco=bottone('Adatta il foglio al banco','move-horizontal',()=>impostaZoom(stati.get(s),'fit'));
  zoomNumero.type='number';zoomNumero.min=25;zoomNumero.max=300;zoomNumero.step=1;zoomNumero.setAttribute('aria-label','Zoom A4 in percentuale');zoomNumero.title='Zoom della vista: non modifica le dimensioni nel PDF';zoomNumero.onchange=()=>{const n=Number(zoomNumero.value);if(Number.isFinite(n)&&n>0)impostaZoom(stati.get(s),n);else adatta(stati.get(s));};zoom.append(zoomNumero,E('span','','%'));
  numero.type='number';numero.min=1;numero.value=1;numero.setAttribute('aria-label','Pagina A4');numero.onchange=()=>pagina(s,0,+numero.value-1);nav.append(prima,numero,totale,dopo,E('i','tbsep'),meno,zoom,piu,adattaBanco);barra.append(scrittura,a4);
  const box=E('section','note-a4'),stage=E('div','note-a4-stage');box.setAttribute('aria-label','Impaginazione A4');box.tabIndex=0;box.title='← → o scorri lateralmente per cambiare pagina. Doppio clic sul testo per scrivere. Seleziona figure o Alt + clic per i disegni dietro al testo.';box.append(stage);box.hidden=true;nav.hidden=true;
  host.querySelector('.notectl-fine').prepend(barra);host.querySelector('.editor-toolbar').after(nav);host.querySelector('.EasyMDEContainer').append(box);
  const c={s,host,barra,box,stage,nav,numero,totale,zoomNumero,meno,piu,adattaBanco,prima,dopo,pagina:0,giro:0,zoomModo:'fit'};stati.set(s,c);
  c.resize=new ResizeObserver(()=>adatta(c));c.resize.observe(box);
  box.addEventListener('click',e=>{const b=e.target.closest('.mdb[data-da]');if(b)s.mde.codemirror.setCursor(+b.dataset.da,0);});
  box.addEventListener('dblclick',e=>{if(e.target.closest('.note-visual'))return;const b=e.target.closest('.mdb[data-da]');if(!b)return;e.preventDefault();e.stopPropagation();const cm=s.mde.codemirror,line=+b.dataset.da,offset=mdbPuntoCliccato(b,e.clientX,e.clientY,s),pos=cm.posFromIndex(cm.indexFromPos({line,ch:0})+(offset??0));if(!scegli(s,'scrittura'))return;if(s.mde.isPreviewActive())noteAlternaAnteprima(s);cm.setCursor(pos);s.mde.codemirror.focus();});
  box.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();noteCronologia(s,e.shiftKey);}});
  navigazione(c);
  s.mde.codemirror.on('changes',()=>aggiorna(s));
  c.host.dataset.noteVista='scrittura';scrittura.setAttribute('aria-pressed','true');a4.setAttribute('aria-pressed','false');
 }
 function scegli(s,v){
  installa(s);if(!AppuntiAnnotaUI.primaDiUscire(s))return false;
  if(s.mde.isPreviewActive())s.mde.togglePreview();
  mdbChiudi(true,s);AppuntiFigureUI.chiudi();const c=stati.get(s);c.host.dataset.noteVista=v;c.box.hidden=v!=='a4';c.nav.hidden=v!=='a4';
  c.barra.querySelectorAll('[data-note-vista]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.noteVista===v)));
  if(v==='a4'){aggiorna(s);adatta(c);c.box.focus({preventScroll:true});}else{AppuntiFigureUI.seleziona(s,false);++c.giro;clearTimeout(c.timer);c.stage.replaceChildren();c.paper=null;c.layout=null;s.mde.codemirror.refresh();}
  return true;
 }
 function adatta(c){
  if(!c||c.box.hidden)return;
  const scala=c.zoomModo==='fit'?Math.max(.1,Math.min(1,(c.box.clientWidth-32)/PASSO)):c.zoomLivello;c.scala=scala;c.stage.style.width=PASSO*scala+'px';c.stage.style.height=297*MM*scala+'px';if(c.paper)c.paper.style.transform='scale('+scala+')';c.zoomNumero.value=Math.round(scala*100);c.meno.disabled=scala<=.25;c.piu.disabled=scala>=3;c.adattaBanco.setAttribute('aria-pressed',String(c.zoomModo==='fit'));
 }
 function impostaZoom(c,valore,punto){
  if(!c)return;AppuntiFigureUI.chiudi();const r=c.paper?.getBoundingClientRect(),b=c.box.getBoundingClientRect(),p=punto||{x:b.left+b.width/2,y:b.top+b.height/2},scala=r?.width/PASSO;
  const x=r?(p.x-r.left)/scala:0,y=r?(p.y-r.top)/scala:0;c.zoomModo=valore==='fit'?'fit':'manuale';if(c.zoomModo==='manuale')c.zoomLivello=Math.max(.25,Math.min(3,valore/100));adatta(c);
  if(r&&c.paper){const dopo=c.paper.getBoundingClientRect(),k=dopo.width/PASSO;c.box.scrollLeft+=dopo.left+x*k-p.x;c.box.scrollTop+=dopo.top+y*k-p.y;}
 }
 function pagina(s,delta,assoluta){const c=stati.get(s);if(!c?.layout)return;const richiesta=assoluta??c.pagina+delta,nuova=Math.max(0,Math.min(c.layout.totale-1,Number.isFinite(richiesta)?Math.trunc(richiesta):c.pagina));if(nuova===c.pagina){c.numero.value=c.pagina+1;return;}AppuntiFigureUI.chiudi();c.pagina=nuova;mostra(c);c.box.scrollTop=0;c.box.scrollLeft=0;}
 function navigazione(c){
  const {box,host,s}=c;let ultimo=0,somma=0,girato=false,tocco;
  const modifica=e=>e.target.closest('input,textarea,select,[contenteditable=true]');
  host.addEventListener('keydown',e=>{if(!attiva(s)||AppuntiAnnotaUI.aperta(s)||e.defaultPrevented||e.metaKey||e.ctrlKey||e.altKey||e.shiftKey||modifica(e))return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();pagina(s,e.key==='ArrowRight'?1:-1);}});
  box.addEventListener('wheel',e=>{
   if(e.ctrlKey){e.preventDefault();impostaZoom(c,c.scala*100*Math.exp(-e.deltaY*.008),{x:e.clientX,y:e.clientY});return;}
   const laterale=Math.abs(e.deltaX)>Math.abs(e.deltaY),delta=(laterale?e.deltaX:e.deltaY)*(e.deltaMode===1?16:e.deltaMode===2?box.clientHeight:1),verso=Math.sign(delta);if(!verso)return;
   const pos=laterale?box.scrollLeft:box.scrollTop,max=laterale?box.scrollWidth-box.clientWidth:box.scrollHeight-box.clientHeight;
   // Prima scorre il foglio ingrandito; al margine continua sulla pagina vicina.
   if(verso>0?pos<max-2:pos>2){somma=0;return;}
   e.preventDefault();const ora=performance.now();if(ora-ultimo>220){somma=0;girato=false;}ultimo=ora;
   if(girato)return;if(Math.sign(somma)!==verso)somma=0;somma+=delta;if(Math.abs(somma)>=(laterale?60:120)){pagina(s,verso);girato=true;somma=0;}
  },{passive:false});
  box.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch'||e.target.closest('.note-visual'))return;tocco={id:e.pointerId,x:e.clientX,y:e.clientY};box.setPointerCapture(e.pointerId);});
  box.addEventListener('pointerup',e=>{if(tocco?.id!==e.pointerId)return;const dx=e.clientX-tocco.x,dy=e.clientY-tocco.y;tocco=null;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.3){pagina(s,dx<0?1:-1);}});
  box.addEventListener('pointercancel',()=>{tocco=null;});
 }
 function mostra(c){
  c.pagina=Math.min(c.pagina,c.layout.totale-1);c.paper=c.layout.foglio(c.pagina);c.stage.replaceChildren(c.paper);c.numero.value=c.pagina+1;c.numero.max=c.layout.totale;c.totale.textContent='di '+c.layout.totale;c.prima.disabled=!c.pagina;c.dopo.disabled=c.pagina===c.layout.totale-1;adatta(c);
 }
 function aggiorna(s){
  const c=stati.get(s);if(!c||!attiva(s))return;
  clearTimeout(c.timer);const giro=++c.giro;c.box.setAttribute('aria-busy','true');
  c.timer=setTimeout(()=>{c.pronto=prepara(s).then(layout=>{if(c.giro!==giro)return;c.layout=layout;mostra(c);c.box.removeAttribute('aria-busy');const selezione=c.riseleziona;c.riseleziona=null;if(selezione&&document.activeElement===selezione.maniglia){const img=c.paper.querySelector('.mdb[data-da="'+selezione.da+'"] .note-visual img');if(img){const box=AppuntiFigureUI.posiziona(img);if(selezione.angolo)box.querySelector('[data-ridimensiona="'+selezione.angolo+'"]')?.focus({preventScroll:true});}}}).catch(e=>{if(c.giro!==giro)return;c.box.removeAttribute('aria-busy');toast('Impaginazione A4: '+e.message,false);});},40);
 }
 function riseleziona(s,da,maniglia,angolo){const c=stati.get(s);if(c)c.riseleziona={da,maniglia,angolo};}
 async function risorse(el){
  // L'area di misura è fuori schermo: immagini lazy non inizierebbero mai il
  // caricamento e decode() resterebbe in attesa. Anche le copie PDF sono eager.
  el.querySelectorAll('img').forEach(img=>{img.loading='eager';});
  await document.fonts.ready;
  await Promise.all([...el.querySelectorAll('img')].map(img=>img.decode().catch(()=>{})));
  await new Promise(requestAnimationFrame);
 }
 async function prepara(s){
  stile();const md=s.mde.value(),titolo=s.cur?.title||s.cur?.file||'Appunto',famiglia=font(),righe=md.split('\n'),paper=E('div','note-a4-paper note-a4-measure'),content=E('div','note-a4-content'),flow=E('div','st-corpo note-a4-flow');
  paper.style.setProperty('--a4-font',famiglia);paper.style.setProperty('--font-documento',famiglia);flow.innerHTML=renderNoteMd(md,{mappa:true});content.append(flow);paper.append(content);document.body.append(paper);
  try{
   // Nessun handler di preview deve riscrivere il contenuto durante la misura.
   flow.querySelectorAll('[onerror]').forEach(e=>e.removeAttribute('onerror'));
   await risorse(paper);
   const figure=[];
   flow.querySelectorAll('.note-visual:not([data-layer=inline])').forEach(vis=>{
    const blocco=vis.closest('.mdb'),v=blocco&&AppuntiFigure.leggi(righe,+blocco.dataset.da);if(!v)return;
    const img=vis.querySelector('img'),rapporto=img?.naturalHeight/Math.max(1,img?.naturalWidth)||.525;
    const anchor=E('span','note-a4-anchor');vis.replaceWith(anchor);figure.push({v,html:vis.outerHTML,anchor,rapporto});
   });
   const r=flow.getBoundingClientRect();let totale=1;
   // scrollWidth della prima colonna è W, non PASSO; misurare il bordo destro
   // delle righe evita un foglio vuoto per gli arrotondamenti subpixel.
   let destra=W;const range=document.createRange();range.selectNodeContents(flow);for(const q of range.getClientRects())destra=Math.max(destra,q.right-r.left);totale=Math.max(1,Math.floor((destra-1)/PASSO)+1);
   for(const f of figure){
    const a=f.anchor.getBoundingClientRect(),col=Math.max(0,Math.floor((a.left-r.left+1)/PASSO)),larghezza=170*(f.v.percento||60)/100;
    f.pos=f.v.style.a4||{pagina:col+1,larghezza,x:f.v.style.x!==undefined?f.v.style.x*1.7:f.v.style.align==='left'?0:f.v.style.align==='right'?170-larghezza:(170-larghezza)/2,y:(a.top-r.top)/MM+(f.v.style.y||0)*16/MM};
    totale=Math.max(totale,f.pos.pagina);f.anchor.remove();
   }
   // I riferimenti hanno altezza zero: rimuoverli non altera il flusso del testo.
   const html=flow.innerHTML;
   return {totale,md,titolo,figure,foglio(indice){
    const p=E('div','note-a4-paper'),area=E('div','note-a4-content'),f=E('div','st-corpo note-a4-flow');p.style.setProperty('--a4-font',famiglia);p.style.setProperty('--font-documento',famiglia);p.dataset.pagina=indice+1;p.setAttribute('aria-label','Pagina '+(indice+1)+' di '+totale);f.innerHTML=html;f.style.left=(-indice*PASSO)+'px';area.append(f);
    for(const v of figure.filter(v=>v.pos.pagina===indice+1)){
     const box=E('div','mdb note-a4-figure');box.dataset.da=v.v.da;box.dataset.a=v.v.fine;box.dataset.layer=v.v.style.layer;box.innerHTML=v.html;posiziona(box,v.pos);area.append(box);
    }
    const footer=E('footer','note-a4-footer');footer.append(E('span','',titolo),E('span','','pagina '+(indice+1)+' di '+totale));p.append(area,footer);return p;
   }};
  }finally{paper.remove();}
 }
 function posiziona(box,pos){box.style.left=pos.x+'mm';box.style.top=pos.y+'mm';box.style.width=pos.larghezza+'mm';}
 function figura(c){return stati.get(c.s)?.layout?.figure.find(f=>f.v.da===c.v.da);}
 function regolaFigura(v,c){
  if(!attiva(c.s))return v;
  if(v.style.layer==='inline'){delete v.style.a4;return v;}
  const f=figura(c);if(!f)return v;
  const pos={...f.pos,...v.style.a4};
  if(!v.style.a4&&v.percento!==c.v.percento)pos.larghezza=170*(v.percento||60)/100;
  if(v.style.x===undefined){pos.x=v.style.align==='right'?170-pos.larghezza:v.style.align==='center'?(170-pos.larghezza)/2:0;}
  v.style.a4=pos;return v;
 }
 function geometria(el,c,ink){
  const box=el.closest('.note-a4-figure'),area=el.closest('.note-a4-content'),r=area.getBoundingClientRect(),img=el.getBoundingClientRect(),scala=r.width/W,em=16*scala;
  const pos=c.v.style.a4||figura(c)?.pos||{pagina:+area.parentElement.dataset.pagina,x:(img.left-r.left)/scala/MM,y:(img.top-r.top)/scala/MM,larghezza:img.width/scala/MM},percento=pos.larghezza/1.7;
  return {visuale:el.closest('.note-visual'),contenuto:box,area,da:c.v.da,fine:c.v.fine,img,scala,larghezza:r.width,em,a4:{...pos},
   sinistra:ink?-ink.l*percento:0,destra:ink?100-ink.r*percento:100-percento,alto:-(ink?.t||0)*img.height/em,basso:(H*scala-img.height*(ink?.b||1))/em,
   v:{...c.v,percento,style:{...c.v.style,x:pos.x/1.7,y:pos.y*MM/16,a4:{...pos}}}};
 }
 function muovi(g,v){
  if(!g.a4)return;
  if(!g.contenuto){const box=E('div','mdb note-a4-figure');box.dataset.da=g.da;box.dataset.a=g.fine;box.dataset.layer=v.style.layer;box.append(g.visuale.cloneNode(true));g.visuale.style.visibility='hidden';g.visuale.dataset.layer='inline';g.area.append(box);g.contenuto=box;}
  g.contenuto.dataset.layer=v.style.layer;posiziona(g.contenuto,v.style.a4);
 }
 function ripulisci(root){
  // Un rimando interno non è cliccabile nel PDF. Manteniamo il tag dell'ancora:
  // è anche il contenitore che determina la larghezza delle immagini Album.
  root.querySelectorAll('a[href^="#"]').forEach(a=>a.removeAttribute('href'));
  root.querySelectorAll('[id],[contenteditable],[tabindex]').forEach(e=>{e.removeAttribute('id');e.removeAttribute('contenteditable');e.removeAttribute('tabindex');});
 }
 async function annota(s,c,scena){
  mdbChiudi(true,s);const state=stati.get(s),cm=s.mde.codemirror,originale=cm.getValue(),versione=s.versione,file=s.cur?.file;
  function verifica(){if(cm.getValue()!==originale||s.versione!==versione||s.cur?.file!==file)throw Error('L’appunto è cambiato. Riapri il disegno.');}
  const layout=await prepara(s);verifica();
  const fig=c&&layout.figure.find(f=>f.v.da===c.v.da),indice=fig?fig.pos.pagina-1:state.pagina,pos=fig?{...fig.pos}:{pagina:indice+1,x:0,y:0,larghezza:170};
  scena=scena||AppuntiAnnotazioni.valida({versione:1,larghezza:W,altezza:H,segni:[]});
  AppuntiAnnotaUI.apri({s,scena,verifica,impaginazione:{monta(frame,foglio){
   frame.dataset.a4='';const stage=E('div','note-a4-stage'),p=layout.foglio(indice),area=p.querySelector('.note-a4-content');
   if(c)p.querySelector('.note-a4-figure[data-da="'+c.v.da+'"]')?.remove();
   posiziona(foglio,pos);area.append(foglio);stage.append(p);frame.replaceChildren(stage);
   const resize=new ResizeObserver(()=>{const scala=state.zoomModo==='fit'?Math.max(.1,Math.min(1,(frame.clientWidth-32)/PASSO)):state.zoomLivello;stage.style.width=PASSO*scala+'px';stage.style.height=297*MM*scala+'px';p.style.transform='scale('+scala+')';});resize.observe(frame);return ()=>resize.disconnect();
  }},conferma(src){
   verifica();const v=c?{...c.v,src,style:{...c.v.style,a4:pos}}:{src,caption:'Disegno',percento:100,style:{align:'left',layer:'front',x:0,y:0,a4:pos}};
   cm.changeGeneration(true);if(c)cm.replaceRange(AppuntiFigure.scrivi(v),{line:c.v.da,ch:0},{line:c.v.fine,ch:cm.getLine(c.v.fine).length},'+disegno');else cm.replaceRange(AppuntiFigure.scrivi(v)+'\n',{line:0,ch:0},undefined,'+disegno');noteAnteprimaRidisegna(s);
  }});
 }
 async function documento(s){
  if(AppuntiAnnotaUI.aperta(s))throw Error('Applica o annulla il disegno prima di esportare.');
  mdbChiudi(true,s);const layout=await prepara(s),doc=document.implementation.createHTMLDocument(layout.titolo);
  const base=doc.createElement('base');base.href=location.href.replace(/[^/]*$/,'');doc.head.append(base);
  // Stili dell'app e font locali, senza script né interfaccia. Il foglio non
  // usa #stampaFoglio: le media query del vecchio export non lo reimpaginano.
  document.querySelectorAll('style,link[rel=stylesheet]').forEach(e=>{if(e.id!=='stampaRegole')doc.head.append(e.cloneNode(true));});
  // Il documento autonomo deve impaginare subito: un contenitore display:none
  // rimanda il caricamento dei font al printToPDF, dopo document.fonts.ready.
  const regole=doc.createElement('style');regole.textContent='body>.note-a4-print{display:block} @media print{@page{size:A4 portrait;margin:0;@bottom-left{content:none}@bottom-right{content:none}}}';doc.head.append(regole);
  const root=doc.createElement('div');root.className='note-a4-print';
  for(let i=0;i<layout.totale;i++)root.append(layout.foglio(i));
  ripulisci(root);
  doc.body.append(root);return '<!doctype html>'+doc.documentElement.outerHTML;
 }
 async function stampa(s){
  if(AppuntiAnnotaUI.aperta(s))throw Error('Applica o annulla il disegno prima di stampare.');
  const layout=await prepara(s),root=E('div','note-a4-print'),regole=E('style');
  regole.textContent='@media print{@page{size:A4 portrait;margin:0;@bottom-left{content:none}@bottom-right{content:none}}}';
  for(let i=0;i<layout.totale;i++)root.append(layout.foglio(i));ripulisci(root);document.body.append(root,regole);
  function pulisci(){root.remove();regole.remove();window.removeEventListener('afterprint',pulisci);}
  window.addEventListener('afterprint',pulisci);try{await risorse(root);window.print();}catch(e){pulisci();throw e;}
 }
 function posizione(c){const f=figura(c);return f?{...f.pos}:null;}
 function pagine(s){return stati.get(s)?.layout?.totale||1;}
 window.AppuntiA4={installa,scegli,attiva,aggiorna,prepara,documento,stampa,geometria,muovi,riseleziona,regolaFigura,annota,pagina,posizione,pagine};
 noteStati().filter(s=>s.mde).forEach(installa);
}());
