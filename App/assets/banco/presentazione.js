/* I comandi seguono lo strumento quando si sposta nel banco. Nessun appunto
   viene copiato su disco: la proiezione è una vista temporanea di sola lettura. */
(function(){
 'use strict';
 const L=window.BancoLettura,api=window.vault?.presentazione;
 let proiezione=null,intero=null,pop=null,barra=null,timerBarra=null,aprendo=false;
 const testuali=new Set(['appunti','appunti2','studio','flashcard']);
 const $=s=>document.querySelector(s),perId=id=>window.bancoElemento(id);
 function blocco(id){return perId(id)?.closest('.blocco');}
 function chiave(id){return 'studia.lettura.'+window.corsoAttivo()+'.'+id;}
 function percentuale(id){if(intero?.id===id)return intero.zoom;try{return L.scala(localStorage.getItem(chiave(id))||100);}catch(_){return 100;}}
 function nota(id){return window.noteStati().find(s=>s.id===id);}
 function testo(id){const el=perId(id);return el?.querySelector('.editor-preview-active,.editor-preview-active-side,.zstudio-banco')||el;}
 function scrolls(id){const el=perId(id);if(!el)return [];
  return [...el.querySelectorAll('.editor-preview,.CodeMirror-scroll,.zstudio-banco,#pdfFrame,#pdf2Frame')].map(e=>({e,x:e.scrollLeft,y:e.scrollTop}));
 }
 function ripristinaScroll(r){r.forEach(s=>{if(s.e.isConnected){s.e.scrollLeft=s.x;s.e.scrollTop=s.y;}});}
 function avvisa(e){if(typeof window.toast==='function')window.toast(e?.message||String(e),false);}
 function button(nome,icona,fn){const e=document.createElement('button');e.type='button';e.className='tbtn';e.title=nome;e.setAttribute('aria-label',nome);e.innerHTML=UiIcone.svg(icona);e.onclick=fn;return e;}
 function zoom(id,n,salva=true){
  const el=perId(id),body=el?.closest('.bcorpo');if(!body)return;
  const s=nota(id),cm=s?.mde?.codemirror,info=cm?.getScrollInfo(),r=testo(id),a=r&&ancoraDom(r);
  n=L.scala(n);body.style.setProperty('--lettura-scala',n/100);
  if(intero?.id===id)intero.zoom=n;
  else if(salva)try{localStorage.setItem(chiave(id),String(n));}catch(_){}
  cm?.refresh();if(info)cm.scrollTo(info.left,info.top);
  if(a)requestAnimationFrame(()=>allineaDom(r,a));
  if(pop?.dataset.strumento===id)aggiornaMisura(pop,n);
  if(intero?.id===id)aggiornaMisura(barra,n);
 }
 function aggiornaMisura(host,n){if(!host)return;const v=host.querySelector('output');if(v)v.textContent=n+'%';const meno=host.querySelector('[data-meno]'),piu=host.querySelector('[data-piu]');if(meno)meno.disabled=n<=75;if(piu)piu.disabled=n>=300;}
 function misura(host,id){
  const meno=button('Riduci il testo','minus',()=>zoom(id,L.passo(percentuale(id),-1)));meno.dataset.meno='';
  const output=document.createElement('output');output.setAttribute('aria-label','Dimensione del testo');
  const piu=button('Ingrandisci il testo','plus',()=>zoom(id,L.passo(percentuale(id),1)));piu.dataset.piu='';
  host.append(meno,output,piu,button('Ripristina il testo al 100%','rotate-ccw',()=>zoom(id,100)));aggiornaMisura(host,percentuale(id));
 }
 function dimensione(id,b){
  if(pop){pop.remove();pop=null;}
  pop=document.createElement('div');pop.className='lettura-pop';pop.setAttribute('popover','auto');pop.setAttribute('role','group');pop.setAttribute('aria-label','Dimensione del testo');pop.dataset.strumento=id;
  const row=document.createElement('div');row.className='tbar';pop.append(row);misura(row,id);document.body.append(pop);pop.showPopover();
  const r=b.getBoundingClientRect();pop.style.top=Math.min(innerHeight-pop.offsetHeight-8,r.bottom+4)+'px';pop.style.left=Math.max(8,Math.min(innerWidth-pop.offsetWidth-8,r.right-pop.offsetWidth))+'px';
 }
 function controlli(){
  if(!window.BANCO?.stato)return;
  document.querySelectorAll('.blocco .blettura').forEach(e=>e.remove());
  document.querySelectorAll('.blocco[data-proiezione]').forEach(e=>delete e.dataset.proiezione);
  window.bancoBlocchiVisibili().forEach(b=>{
   const id=window.bancoStrumentoIn(b),el=perId(id),h=el?.closest('.blocco')?.querySelector('.bhead');if(!h)return;
   const row=document.createElement('span');row.className='blettura';row.setAttribute('role','group');row.setAttribute('aria-label','Lettura e presentazione');
   if(testuali.has(id)){const z=button('Dimensione del testo','type',()=>dimensione(id,z));z.dataset.lettura='';row.append(z);zoom(id,percentuale(id),false);}
   const f=button('Schermo intero (Esc per uscire)','maximize',()=>schermoIntero(id));f.dataset.intero='';row.append(f);
   const p=button(proiezione?.id===id?'Chiudi la finestra di proiezione':'Apri finestra di proiezione','external-link',()=>proiezione?.id===id?chiudiProiezione():apriProiezione(id));p.dataset.proietta='';p.setAttribute('aria-pressed',String(proiezione?.id===id));row.append(p);h.append(row);
   if(proiezione?.id===id)el.closest('.blocco').dataset.proiezione='1';
  });
  if(proiezione&&(!blocco(proiezione.id)||proiezione.zaino!==window.corsoAttivo()))chiudiProiezione();
  if(intero&&(!blocco(intero.id)||intero.zaino!==window.corsoAttivo()))esciIntero();
 }
 function mostraBarra(){if(!barra)return;delete barra.dataset.nascosta;clearTimeout(timerBarra);timerBarra=setTimeout(()=>{if(barra&&!barra.matches(':focus-within,:hover')&&!document.querySelector(':popover-open,dialog[open]'))barra.dataset.nascosta='1';},2200);}
 function vai(id,verso){
  const v=id==='fonte'?window.PDFJS?.viewer:id==='fonte2'?window.FONTE2?.viewer:null;
  if(v){v.currentPageNumber=Math.max(1,Math.min(v.pagesCount,v.currentPageNumber+verso));return;}
  if(id==='flashcard'&&verso>0){const next=$('#zstudyNext');if(next&&!next.hidden&&!next.disabled){next.click();return;}}
  const e=testo(id);if(!e)return;const top=e.getBoundingClientRect().top;
  const nodes=[...e.querySelectorAll('h1,h2,h3,h4,article')].filter(n=>n.getClientRects().length);
  const n=verso>0?nodes.find(n=>n.getBoundingClientRect().top>top+30):nodes.reverse().find(n=>n.getBoundingClientRect().top<top-10);
  if(n)n.scrollIntoView({block:'start'});else e.scrollBy({top:verso*e.clientHeight*.8});
 }
 async function schermoIntero(id){
  if(intero){await esciIntero();return;}
  const b=blocco(id);if(!b)return;pop?.hidePopover();window.closePops?.();
  const s=nota(id),v=id==='fonte'?window.PDFJS?.viewer:id==='fonte2'?window.FONTE2?.viewer:null;
  const scala=percentuale(id),letturaPrima=testo(id),ancoraPrima=letturaPrima&&ancoraDom(letturaPrima),linea=s?.mde?.codemirror.lineAtHeight(s.mde.codemirror.getScrollInfo().top,'local');
  intero={id,zaino:window.corsoAttivo(),scroll:scrolls(id),focus:document.activeElement,tabindex:perId(id).getAttribute('tabindex'),note:s,noteFile:s?.cur?.file,preview:s?.mde?.isPreviewActive(),side:s?.mde?.isSideBySideActive(),scala,zoom:Math.max(200,scala),pdf:v&&{v,documento:v.pdfDocument,scala:v.currentScaleValue,pagina:v.currentPageNumber},mappa:id==='mappa'?{file:window.MAPPA?.mia?.file,registro:window.MAPPA?.registro,z:{...window.MAPPA?.z}}:null};
  if(s?.mde){window.mdbChiudi?.(true,s);if(intero.side)s.mde.toggleSideBySide();if(!s.mde.isPreviewActive())s.mde.togglePreview();}
  document.documentElement.dataset.presentazione='1';b.dataset.presentazione='1';
  perId(id).querySelectorAll(':scope > .tbar,:scope > header,:scope > .panehead').forEach(e=>e.dataset.presentazioneToolbar='1');
  barra=document.createElement('div');barra.className='presentazione-bar tbar';barra.setAttribute('role','toolbar');barra.setAttribute('aria-label','Presentazione');
  const nome=document.createElement('span');nome.className='presentazione-titolo';nome.textContent=titolo(id);barra.append(nome);
  barra.append(button('Passaggio precedente','chevron-left',()=>vai(id,-1)),button('Passaggio successivo','chevron-right',()=>vai(id,1)));
  if(testuali.has(id))misura(barra,id);
  if(v){const pref=id==='fonte'?'pdf':'pdf2';[['Riduci','minus','ZoomOut'],['Adatta alla larghezza','move-horizontal','ZoomLvl'],['Ingrandisci','plus','ZoomIn']].forEach(([t,i,suffisso])=>barra.append(button(t,i,()=>{if(suffisso==='ZoomLvl')v.currentScaleValue='page-width';else $('#'+pref+suffisso)?.click();})));}
  if(id==='mappa')barra.append(button('Adatta la mappa alla finestra','maximize-2',()=>$('#mAdatta')?.click()));
  barra.append(button('Apri finestra di proiezione','external-link',()=>apriProiezione(id)),button('Esci dallo schermo intero (Esc)','x',esciIntero));
  b.append(barra);barra.addEventListener('focusout',mostraBarra);barra.addEventListener('pointerleave',mostraBarra);mostraBarra();
  perId(id).setAttribute('tabindex','-1');perId(id).focus({preventScroll:true});window.bancoDopoLayout?.();
  if(testuali.has(id)){
   zoom(id,intero.zoom,false);const corrente=intero;
   const allinea=()=>{if(intero!==corrente)return;const e=testo(id);if(s&&!corrente.preview&&!corrente.side){const n=[...e.querySelectorAll('.mdb')].find(n=>Number(n.dataset.da)<=linea&&Number(n.dataset.a)>=linea);n?.scrollIntoView({block:'start'});}else allineaDom(e,ancoraPrima);};
   requestAnimationFrame(allinea);setTimeout(allinea,400);
  }
  const r=await api?.intero(true);if(r?.error){avvisa(r.error);ripristinaIntero();}
 }
 function ripristinaIntero(){
  if(!intero)return;const prima=intero;intero=null;clearTimeout(timerBarra);barra?.remove();barra=null;
  delete document.documentElement.dataset.presentazione;document.querySelectorAll('[data-presentazione],[data-presentazione-toolbar]').forEach(e=>{delete e.dataset.presentazione;delete e.dataset.presentazioneToolbar;});
  const s=prima.note,stesso=prima.zaino===window.corsoAttivo();
  const el=perId(prima.id);if(el){if(prima.tabindex==null)el.removeAttribute('tabindex');else el.setAttribute('tabindex',prima.tabindex);}
  if(stesso&&s?.cur?.file===prima.noteFile&&s?.mde){if(s.mde.isPreviewActive()!==prima.preview)s.mde.togglePreview();if(s.mde.isSideBySideActive()!==prima.side)s.mde.toggleSideBySide();s.mde.codemirror.refresh();}
  zoom(prima.id,stesso?prima.scala:percentuale(prima.id),false);window.bancoDopoLayout?.();
  function ripristina(){if(!stesso||intero||prima.zaino!==window.corsoAttivo())return;if(prima.mappa&&prima.mappa.file===window.MAPPA?.mia?.file&&prima.mappa.registro===window.MAPPA?.registro){window.MAPPA.z={...prima.mappa.z};window.mappaApplicaZoom();}if(prima.pdf&&prima.pdf.documento===prima.pdf.v.pdfDocument){try{prima.pdf.v.currentScaleValue=prima.pdf.scala;prima.pdf.v.currentPageNumber=prima.pdf.pagina;}catch(_){}}ripristinaScroll(prima.scroll);}
  requestAnimationFrame(ripristina);let attesa;const adatta=()=>{clearTimeout(attesa);attesa=setTimeout(ripristina,120);};window.addEventListener('resize',adatta);setTimeout(()=>{window.removeEventListener('resize',adatta);ripristina();},900);
  if(stesso&&prima.focus?.isConnected)prima.focus.focus({preventScroll:true});
 }
 async function esciIntero(){ripristinaIntero();await api?.intero(false);}
 function titolo(id){return blocco(id)?.querySelector('.bdoc')?.textContent||window.bancoStrumento(id)?.nome||'Proiezione';}
 function ancoraDom(el){
  const nodes=[...el.querySelectorAll('.mdb,p,li,h1,h2,h3,h4,summary')].filter(n=>n.getClientRects().length);
  return L.ancora(nodes.map((n,i)=>{const r=n.getBoundingClientRect();return {id:i,top:r.top,height:r.height};}),el.getBoundingClientRect().top+16);
 }
 function allineaDom(el,a){if(!a)return;const n=[...el.querySelectorAll('.mdb,p,li,h1,h2,h3,h4,summary')].filter(n=>n.getClientRects().length)[Number(a.id)];if(n){const r=n.getBoundingClientRect();el.scrollTop+=L.posizione({top:r.top,height:r.height},a)-el.getBoundingClientRect().top-16;}}
 const immagini=new WeakMap();
 function immagine(n){
  if(immagini.get(n)?.src===n.src)return immagini.get(n).dati;
  if(/^data:image\/(png|jpeg|webp);base64,/.test(n.src))return n.src;
  if(!n.complete||!n.naturalWidth)return '';
  try{const c=document.createElement('canvas'),k=Math.min(1,2400/n.naturalWidth);c.width=n.naturalWidth*k;c.height=n.naturalHeight*k;c.getContext('2d').drawImage(n,0,0,c.width,c.height);const dati=c.toDataURL();immagini.set(n,{src:n.src,dati});return dati;}catch(_){return '';}
 }
 function reso(id){
  const s=nota(id),el=perId(id),detached=!!s?.mde;
  let root=el.querySelector('.zstudio-banco')||el,top=root.getBoundingClientRect().top+16,linea=null,ancore=[],indice=0;
  if(detached){
   const md=s.mde.value();if(proiezione.md!==md){proiezione.md=md;proiezione.reso=document.createElement('div');proiezione.reso.innerHTML=window.renderNoteMd(md,{mappa:true});}
   root=proiezione.reso;
   const pv=el.querySelector('.editor-preview-active,.editor-preview-active-side');
   if(pv){const a=L.ancora([...pv.querySelectorAll('.mdb')].map(n=>{const r=n.getBoundingClientRect();return {id:n.dataset.da,top:r.top,height:r.height};}),pv.getBoundingClientRect().top+16);if(a)linea=a;}
   else {const cm=s.mde.codemirror;linea={id:String(cm.lineAtHeight(cm.getScrollInfo().top,'local')),frazione:0};}
  }
  const scarta='SCRIPT,STYLE,IFRAME,OBJECT,EMBED,TEMPLATE,SVG,CANVAS'.split(',');
  const tags=new Set(L.TAGS_TESTO);
  function copia(n){
   if(n.nodeType===3)return document.createTextNode(n.textContent);if(n.nodeType!==1)return document.createDocumentFragment();
   if(scarta.includes(n.tagName)||n.hidden||n.matches('.tbar,.editor-toolbar,.zstudio-actions,.zstudy-editbar,.zstudio-filters,.zstudio-tabs,.zstudy-selection')||(!detached&&!n.getClientRects().length))return document.createDocumentFragment();
   if(n.tagName==='BUTTON'&&!n.matches('.zchat-citation,.zstudy-open,.zstudy-question-open,.zstudio-card-open'))return document.createDocumentFragment();
   const tag=n.tagName==='A'||n.tagName==='BUTTON'?'SPAN':n.tagName==='TEXTAREA'?'P':tags.has(n.tagName)?n.tagName:'DIV';
   const out=document.createElement(tag);
   if(n.matches('a,.zchat-citation'))out.className='rimando';
   if(n.matches('.mdb')&&detached)out.dataset.pId=n.dataset.da;
   else if(!detached&&n.matches('p,li,h1,h2,h3,h4,summary,textarea')){out.dataset.pId=String(indice++);const r=n.getBoundingClientRect();ancore.push({id:out.dataset.pId,top:r.top,height:r.height});}
   if(n.tagName==='DETAILS')out.open=n.open;
   if(n.tagName==='IMG'){out.src=immagine(n);out.alt=n.alt||'';return out;}
   if(n.tagName==='TEXTAREA'||n.tagName==='INPUT'){out.textContent=n.type==='checkbox'?'':n.value;return out;}
   if(n.tagName==='SELECT'){out.textContent=n.selectedOptions?.[0]?.textContent||'';return out;}
   for(const child of n.childNodes)out.append(copia(child));return out;
  }
  const html=copia(root).outerHTML||'';
  if(detached&&linea){const nodes=[...root.querySelectorAll('.mdb')];const n=nodes.find(n=>Number(n.dataset.da)<=Number(linea.id)&&Number(n.dataset.a)>=Number(linea.id))||nodes.find(n=>Number(n.dataset.da)>=Number(linea.id));if(n)linea.id=n.dataset.da;}
  return {html,ancora:detached?linea:L.ancora(ancore,top)};
 }
 async function aggiornaProiezione(p){
  if(proiezione!==p)return;
  const el=perId(p.id),b=blocco(p.id);if(!b||b.hidden||p.zaino!==window.corsoAttivo()){await chiudiProiezione();return;}
  try{
   let quadro={sessione:p.sessione,titolo:titolo(p.id),tema:document.documentElement.dataset.theme==='scuro'?'dark':'light'};
   if(testuali.has(p.id)){
    const r=reso(p.id);quadro={...quadro,tipo:'testo',ancora:r.ancora};if(r.html!==p.html){quadro.html=r.html;p.html=r.html;}
   }else{
    const target=el.querySelector('#pdfFrame,#pdf2Frame,#mappaSvg')||el;
    const r=target.getBoundingClientRect(),misure=[r.x,r.y,r.width,r.height].join(',');
    if(!p.dirty&&p.misure===misure){p.timer=setTimeout(()=>aggiornaProiezione(p),250);return;}
    p.dirty=false;p.misure=misure;const bordo=b.getBoundingClientRect(),x=Math.ceil(Math.max(r.x,bordo.left+4)),y=Math.ceil(Math.max(r.y,bordo.top+4));
    quadro={...quadro,tipo:'immagine',area:{x,y,width:Math.min(r.right,bordo.right-4)-x,height:Math.min(r.bottom,bordo.bottom-4)-y}};
   }
   const r=await api.aggiorna(quadro);if(r.error)throw Error(r.error);if(r.chiusa){if(proiezione===p){p.observer?.disconnect();proiezione=null;controlli();}return;}
  }catch(e){avvisa(e);await chiudiProiezione();return;}
  if(proiezione===p)p.timer=setTimeout(()=>aggiornaProiezione(p),250);
 }
 async function apriProiezione(id){
  if(aprendo)return;if(!api){avvisa('La proiezione richiede l’app desktop.');return;}
  if(proiezione?.id===id)return;aprendo=true;
  try{
   if(proiezione)await chiudiProiezione();const r=await api.apri();if(r.error)throw Error(r.error);
   proiezione={id,zaino:window.corsoAttivo(),sessione:r.sessione,html:null,md:null,dirty:true};
   const p=proiezione;p.observer=new MutationObserver(()=>p.dirty=true);p.observer.observe(perId(id),{subtree:true,childList:true,attributes:true,characterData:true});
   p.observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
   controlli();aggiornaProiezione(proiezione);
  }catch(e){avvisa(e);}finally{aprendo=false;}
 }
 async function chiudiProiezione(){const p=proiezione;proiezione=null;if(p){clearTimeout(p.timer);p.observer?.disconnect();}controlli();await api?.chiudi();}
 function avvia(){
  controlli();window.addEventListener('banco-layout',controlli);
  api?.onChiusa(d=>{if(proiezione?.sessione===d.sessione){clearTimeout(proiezione.timer);proiezione.observer?.disconnect();proiezione=null;controlli();}});
  api?.onUscita(ripristinaIntero);
  window.addEventListener('pointermove',e=>{if(intero&&e.clientY<56)mostraBarra();});
  document.addEventListener('scroll',()=>{if(proiezione)proiezione.dirty=true;},true);
  document.addEventListener('selectionchange',()=>{if(proiezione)proiezione.dirty=true;});
  window.addEventListener('keydown',e=>{if(!intero)return;if(e.key==='Tab')mostraBarra();if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();esciIntero();}},true);
 }
 window.BancoPresentazione={zoom,percentuale,schermoIntero,esciIntero,apriProiezione,chiudiProiezione,controlli,stato:()=>({intero:intero?.id||'',proiezione:proiezione?.id||''})};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',avvia);else avvia();
}());
