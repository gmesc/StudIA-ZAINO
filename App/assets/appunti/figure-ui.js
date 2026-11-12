/* Le figure restano ancorate al Markdown. Il dialogo lavora su una copia e
 * ogni conferma produce un solo passo Undo, senza riscrivere altri appunti. */
(function(){
 'use strict';
 const F=AppuntiFigure,E=(t,txt,cls)=>{const el=document.createElement(t);if(txt)el.textContent=txt;if(cls)el.className=cls;return el;};
 let bubble,maniglia,annullaDrag,trascinamento=false,ignoraClick=false;
 function via(){bubble?.remove();bubble=null;maniglia?.remove();maniglia=null;}
 function icon(nome,icona,fn){const b=button('',fn);b.innerHTML=UiIcone.svg(icona);b.title=nome;b.setAttribute('aria-label',nome);return b;}
 function button(nome,fn){const b=E('button',nome,'tbtn');b.type='button';b.onclick=fn;return b;}
 function contesto(el){const s=noteStatoDaNodo(el),box=el.closest('.mdb');if(!s?.cur||!box)return null;const cm=s.mde.codemirror,da=+box.dataset.da,v=F.leggi(cm.getValue().split('\n'),da);if(!v)return null;return {s,cm,v,file:s.cur.file,versione:s.versione,originale:cm.getValue()};}
 function attuale(c){if(c.s.cur?.file!==c.file||c.s.versione!==c.versione||c.cm.getValue()!==c.originale)throw Error('L’appunto è cambiato. Riapri i comandi della figura.');}
 function sostituisci(c,v){attuale(c);c.cm.changeGeneration(true);c.cm.replaceRange(F.scrivi(v),{line:c.v.da,ch:0},{line:c.v.fine,ch:c.cm.getLine(c.v.fine).length},'+figura');noteAnteprimaRidisegna(c.s);}
 function elimina(c){
  try{attuale(c);const fine=c.v.fine<c.cm.lastLine()?{line:c.v.fine+1,ch:0}:{line:c.v.fine,ch:c.cm.getLine(c.v.fine).length};c.cm.changeGeneration(true);c.cm.replaceRange('',{line:c.v.da,ch:0},fine,'+figura');via();noteAnteprimaRidisegna(c.s);noteHost(c.s).querySelector('.note-a4:not([hidden])')?.focus({preventScroll:true});}
  catch(e){toast(e.message,false);}
 }
 function seleziona(s,attiva){const host=noteHost(s);host.classList.toggle('note-seleziona-figure',attiva);host.querySelector('.ncb-seleziona-figure')?.setAttribute('aria-pressed',String(attiva));if(!attiva)via();}
 function installa(s){
  const host=noteHost(s);if(host.querySelector('.ncb-seleziona-figure'))return;
  const b=icon('Seleziona figure, anche dietro al testo · Esc per uscire','mouse-pointer-2',()=>{const on=!host.classList.contains('note-seleziona-figure');if(on&&!AppuntiA4.attiva(s)&&!AppuntiA4.scegli(s,'a4'))return;seleziona(s,on);});b.classList.add('ncb-seleziona-figure','no-disable');b.setAttribute('aria-pressed','false');host.querySelector('.ncb-disegno').after(b);
 }
 function menu(el){
  via();closePops();const c=contesto(el);if(!c)return;const visuale=el.closest('.note-visual'),r=rettangolo(el,c);bubble=E('div',null,'popmenu note-figure-menu tbar-ctl');bubble.popover='manual';bubble.setAttribute('open','');bubble.setAttribute('role','dialog');bubble.setAttribute('aria-label','Aspetto della figura');const bar=E('div',null,'tbar');
  function modifica(fn){try{const v={...c.v,style:{...c.v.style}};fn(v);AppuntiA4.regolaFigura(v,c);sostituisci(c,v);via();return true;}catch(e){toast(e.message,false);return false;}}
  const suCarta=!!el.closest('.note-a4-paper'),g=suCarta?geometria(el,c):null;
  const misura=suCarta?Math.round(r.width/g.larghezza*100):c.v.percento||Math.max(10,Math.min(100,Math.round(r.width/Math.max(1,visuale.getBoundingClientRect().width)*20)*5));
  const larg=E('label',suCarta?'Larghezza ':'Dimensione '),slider=E('input'),numero=E('output',misura+'%');slider.type='range';slider.className='zaino-slider';slider.min=suCarta?1:10;slider.max=100;slider.step=suCarta?1:5;slider.value=misura;slider.setAttribute('aria-label','Larghezza della figura');slider.oninput=()=>numero.textContent=slider.value+'%';slider.onchange=()=>modifica(v=>{if(suCarta){const k=(g.larghezza*Number(slider.value)/100)/r.width;Object.assign(v,F.ridimensionaA4(g.v,'se',r.width*(k-1),r.height*(k-1),misureRidimensionamento(el,c,g)));}else Object.assign(v,F.dimensiona(v,+slider.value));});larg.append(slider,numero);
  if(c.v.src.startsWith('album:'))bar.append(button('Mostra nell’album',()=>{via();albumMostraCitata(c.v.src.slice(6));}));
  if(c.v.src.startsWith('_disegni/'))bar.append(button('Modifica disegno',()=>{via();apriDisegno(c.s,c);}));
  const livelli=E('div',null,'tbar note-figure-livelli');
  const sopra=icon('Davanti al testo','chevron-up',()=>modifica(x=>{x.style.layer='front';})),sotto=icon('Dietro al testo','chevron-down',()=>{if(modifica(x=>{x.style.layer='back';}))seleziona(c.s,true);});
  sopra.dataset.livello='front';sotto.dataset.livello='back';for(const bt of [sopra,sotto])bt.setAttribute('aria-pressed',String(c.v.style.layer===bt.dataset.livello));
  const inline=button('Fra i paragrafi',()=>modifica(x=>{x.style.layer='inline';delete x.style.x;delete x.style.y;}));inline.dataset.livello='inline';inline.title='Occupa uno spazio nel testo e segue i paragrafi, senza sovrapporli';inline.setAttribute('aria-pressed',String(c.v.style.layer==='inline'));
  const simbolo=E('span',null,'note-figure-icona-livelli');simbolo.innerHTML=UiIcone.svg('layers');simbolo.title='Livello rispetto al testo';simbolo.setAttribute('aria-label',simbolo.title);simbolo.setAttribute('role','img');
  const cestino=icon('Elimina figura dall’appunto · ⌘Z per annullare','trash-2',()=>elimina(c));cestino.dataset.eliminaFigura='';
  livelli.append(sopra,simbolo,sotto,E('i',null,'tbsep'),inline,E('i',null,'tbsep'),cestino);
  if(AppuntiA4.attiva(c.s)&&c.v.style.layer!=='inline'){
   const pos=AppuntiA4.posizione(c),label=E('span','Pagina '),n=E('input');n.type='number';n.min=1;n.max=AppuntiA4.pagine(c.s);n.value=pos.pagina;n.setAttribute('aria-label','Pagina della figura');n.style.width='4em';n.onchange=()=>{const pagina=Math.max(1,Math.min(+n.max,Math.trunc(+n.value)||1));if(modifica(v=>{v.style.a4={...pos,pagina};}))AppuntiA4.pagina(c.s,0,pagina-1);};label.append(n);larg.append(label);
  }
  const head=E('div',null,'note-figure-head');head.append(E('strong','Figura'),icon('Chiudi · Esc','x',via));bubble.append(head,bar,larg,livelli);document.body.append(bubble);bubble.showPopover();
  const b=bubble.getBoundingClientRect();bubble.style.left=Math.max(8,Math.min(r.left,innerWidth-b.width-8))+'px';bubble.style.top=Math.max(8,Math.min(r.bottom+16,innerHeight-b.height-8))+'px';
  posiziona(el,true);
  // Il pannello resta sopra alla maniglia anche quando il disegno è molto alto.
  bubble.hidePopover();bubble.showPopover();

 }
 // Le coordinate sono nel foglio (x in percentuale, y in em), indipendenti
 // dallo zoom del banco. Il drag scrive una volta sola al rilascio.
 const ingombri=new Map();
 function inchiostro(c){
  const key=c.s.courseId+'/'+c.v.src;if(ingombri.has(key))return ingombri.get(key);
  let box=null;
  if(c.v.src.startsWith('_disegni/'))try{
   const id=c.v.src.match(/([0-9a-f-]{36})\.(?:png|svg)$/)?.[1],scena=id&&window.vault.disegni.leggi(c.s.courseId,id).annotazioni;
   if(scena?.segni.length){
    const limiti=scena.segni.map(s=>{const r=PdfAnnotazioni.limiti(s),p=s.spessore/2+2;return {l:r.x-p,r:r.x+r.w+p,b:r.y-p,t:r.y+r.h+p};});
    box={l:Math.max(0,Math.min(...limiti.map(r=>r.l))/scena.larghezza),r:Math.min(1,Math.max(...limiti.map(r=>r.r))/scena.larghezza),t:Math.max(0,1-Math.max(...limiti.map(r=>r.t))/scena.altezza),b:Math.min(1,1-Math.min(...limiti.map(r=>r.b))/scena.altezza)};
   }
  }catch(_){/* Le figure precedenti conservano i limiti della propria immagine. */}
  if(ingombri.size>100)ingombri.clear();ingombri.set(key,box);return box;
 }
 // La tela SVG resta intera per mantenere le coordinate e l'export; solo il
 // riquadro interattivo segue i tratti visibili, esclusi i margini trasparenti.
 function rettangolo(el,c=contesto(el)){
  const r=el.getBoundingClientRect(),ink=c&&inchiostro(c);if(!ink)return r;
  return new DOMRect(r.left+r.width*ink.l,r.top+r.height*ink.t,r.width*(ink.r-ink.l),r.height*(ink.b-ink.t));
 }
 function aggiornaManiglia(el,c){const r=rettangolo(el,c);Object.assign(maniglia.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});}
 function geometria(el,c){
  if(el.closest('.note-a4-paper'))return AppuntiA4.geometria(el,c,inchiostro(c));
  const visuale=el.closest('.note-visual'),r=visuale.getBoundingClientRect(),img=el.getBoundingClientRect(),contenuto=visuale.querySelector('.note-visual-contenuto'),scala=r.width/Math.max(1,visuale.offsetWidth),em=parseFloat(getComputedStyle(visuale).fontSize)*scala,prev=visuale.closest('.editor-preview,.md-prev,.editor-preview-side'),pr=prev.getBoundingClientRect();
  const percento=c.v.percento||Math.max(10,Math.min(100,img.width/r.width*100)),ink=inchiostro(c);
  // I margini trasparenti della tela non devono bloccare il tratto visibile.
  return {visuale,contenuto,img,scala,larghezza:r.width,em,
   sinistra:ink?-ink.l*percento:0,destra:ink?100-ink.r*percento:100-percento,
   alto:Math.min(0,(pr.top-prev.scrollTop*scala+parseFloat(getComputedStyle(prev).paddingTop)*scala-r.top)/em)-(ink?.t||0)*img.height/em,
   basso:Math.max(0,(pr.top-prev.scrollTop*scala+Math.max(prev.scrollHeight,prev.clientHeight)*scala-r.top-img.height)/em)+(ink?1-ink.b:0)*img.height/em,
   v:{...c.v,style:{...c.v.style,x:c.v.style.x??((img.left-r.left)/r.width*100),y:c.v.style.y??((img.top-r.top)/em)},percento}};
 }
 function avvia(e,el,handle){
  if(e.button!==0)return;const c=contesto(el);if(!c)return;const g=geometria(el,c),x=e.clientX,y=e.clientY,punto=handle||el;let cambiata=false,nuova=g.v;
  e.preventDefault();e.stopPropagation();punto.setPointerCapture?.(e.pointerId);
  function move(ev){if(ev.pointerId!==e.pointerId)return;const dx=ev.clientX-x,dy=ev.clientY-y;if(!cambiata&&Math.hypot(dx,dy)<4)return;if(!cambiata){cambiata=true;trascinamento=true;bubble?.remove();bubble=null;g.visuale.dataset.layer=g.v.style.layer==='inline'?'front':g.v.style.layer;}nuova=F.sposta(g.v,dx,dy,g);g.visuale.dataset.libera='true';g.visuale.style.setProperty('--fig-x',nuova.style.x+'%');g.visuale.style.setProperty('--fig-y',nuova.style.y+'em');AppuntiA4.muovi(g,nuova);if(handle)aggiornaManiglia(g.a4?g.contenuto.querySelector('img'):el,c);}
  function fine(ev){annullaDrag=null;punto.removeEventListener('pointermove',move);punto.removeEventListener('pointerup',fine);punto.removeEventListener('pointercancel',fine);if(punto.hasPointerCapture?.(e.pointerId))punto.releasePointerCapture(e.pointerId);trascinamento=false;if(cambiata){ignoraClick=true;setTimeout(()=>ignoraClick=false,0);try{if(ev.type==='pointercancel')noteAnteprimaRidisegna(c.s);else sostituisci(c,nuova);}catch(err){noteAnteprimaRidisegna(c.s);toast(err.message,false);}via();}}
  annullaDrag=()=>fine({type:'pointercancel'});punto.addEventListener('pointermove',move);punto.addEventListener('pointerup',fine);punto.addEventListener('pointercancel',fine);
 }
 function misureRidimensionamento(el,c,g){return {scala:g.scala,rapporto:g.img.height/g.img.width,ink:inchiostro(c)||{l:0,t:0,r:1,b:1}};}
 function ridimensiona(e,el,punto){
  if(e.button!==0)return;const c=contesto(el);if(!c)return;const g=geometria(el,c);if(!g.a4)return;
  e.preventDefault();e.stopPropagation();const angolo=punto.dataset.ridimensiona,x=e.clientX,y=e.clientY,m=misureRidimensionamento(el,c,g),eventi=new AbortController();let cambiata=false,nuova=g.v;
  punto.setPointerCapture(e.pointerId);
  function fine(ev){
   annullaDrag=null;eventi.abort();if(punto.hasPointerCapture(e.pointerId))punto.releasePointerCapture(e.pointerId);trascinamento=false;
   if(!cambiata)return;ignoraClick=true;setTimeout(()=>ignoraClick=false,0);
   try{if(ev.type==='pointercancel'){noteAnteprimaRidisegna(c.s);via();}else{sostituisci(c,nuova);maniglia.focus({preventScroll:true});AppuntiA4.riseleziona(c.s,c.v.da,maniglia);}}
   catch(err){noteAnteprimaRidisegna(c.s);via();toast(err.message,false);}
  }
  punto.addEventListener('pointermove',ev=>{
   if(ev.pointerId!==e.pointerId)return;const dx=ev.clientX-x,dy=ev.clientY-y;if(!cambiata&&Math.hypot(dx,dy)<3)return;
   if(!cambiata){cambiata=true;trascinamento=true;bubble?.remove();bubble=null;}
   nuova=F.ridimensionaA4(g.v,angolo,dx,dy,m);AppuntiA4.muovi(g,nuova);aggiornaManiglia(g.contenuto.querySelector('img'),c);
  },{signal:eventi.signal});
  for(const tipo of ['pointerup','pointercancel'])punto.addEventListener(tipo,fine,{signal:eventi.signal});annullaDrag=()=>fine({type:'pointercancel'});
 }
 function posiziona(el,conMenu=false){
  if(!conMenu)via();const c=contesto(el);if(!c)return;maniglia=E('div',null,'note-figure-posizione');maniglia.tabIndex=0;maniglia.popover='manual';maniglia.setAttribute('role','group');maniglia.setAttribute('aria-label','Sposta figura: trascina o usa le frecce');document.body.append(maniglia);maniglia.showPopover();Object.assign(maniglia.style,{margin:'0',inset:'auto'});aggiornaManiglia(el,c);maniglia.onpointerdown=e=>{if(!e.target.closest('[data-ridimensiona]'))avvia(e,el,maniglia);};maniglia.ondblclick=e=>{if(e.target.closest('[data-ridimensiona]'))return;if(c.v.src.startsWith('_disegni/')){e.preventDefault();e.stopPropagation();via();apriDisegno(c.s,c);}};maniglia.onkeydown=e=>{
   if((e.metaKey||e.ctrlKey)&&!e.altKey&&e.key.toLowerCase()==='z'){e.preventDefault();e.stopPropagation();via();noteCronologia(c.s,e.shiftKey);return;}
   if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();e.stopPropagation();const att=contesto(el);if(att)elimina(att);return;}
   if(e.target.closest('[data-ridimensiona]'))return;
   if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
   e.preventDefault();e.stopPropagation();const att=contesto(el);if(!att)return;
   const g=geometria(el,att),passo=e.shiftKey?10:1,dx=e.key==='ArrowRight'?passo:e.key==='ArrowLeft'?-passo:0,dy=e.key==='ArrowDown'?passo:e.key==='ArrowUp'?-passo:0;
   try{
    const host=el.closest('.note-host'),v=F.sposta(g.v,dx*g.scala,dy*g.scala,g);sostituisci(att,v);
    if(g.a4){AppuntiA4.muovi(g,v);aggiornaManiglia(g.contenuto.querySelector('img'),att);AppuntiA4.riseleziona(att.s,att.v.da,maniglia);}
    else{const nuova=host.querySelector('.mdb[data-da="'+att.v.da+'"] .note-visual img');if(nuova)posiziona(nuova);else via();}
   }catch(err){toast(err.message,false);via();}
  };
  if(el.closest('.note-a4-paper'))for(const [angolo,nome]of [['nw','alto a sinistra'],['ne','alto a destra'],['sw','basso a sinistra'],['se','basso a destra']]){
   const b=button('',null);b.className='note-figure-resize';b.dataset.ridimensiona=angolo;b.title='Ridimensiona da '+nome+' · proporzioni mantenute · frecce, Maiusc per un passo maggiore';b.setAttribute('aria-label',b.title);b.onpointerdown=e=>ridimensiona(e,el,b);
   b.onkeydown=e=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();e.stopPropagation();const att=contesto(el);if(!att)return;
    try{const g=geometria(el,att),passo=(e.shiftKey?10:1)*g.scala,dx=e.key==='ArrowLeft'?-passo:e.key==='ArrowRight'?passo:0,dy=e.key==='ArrowUp'?-passo:e.key==='ArrowDown'?passo:0,v=F.ridimensionaA4(g.v,angolo,dx,dy,misureRidimensionamento(el,att,g));AppuntiA4.muovi(g,v);aggiornaManiglia(g.contenuto.querySelector('img'),att);sostituisci(att,v);AppuntiA4.riseleziona(att.s,att.v.da,b,angolo);}catch(err){toast(err.message,false);via();}
   };maniglia.append(b);
  }
  if(!conMenu)maniglia.focus();return maniglia;
 }
 document.addEventListener('pointerdown',e=>{
  const host=e.target.closest?.('.note-host'),area=e.target.closest?.('.note-a4,.editor-preview,.editor-preview-side');
  if(e.button===0&&host&&area&&(e.altKey||host.classList.contains('note-seleziona-figure'))){
   const figure=[...area.querySelectorAll('.note-visual img')].reverse().filter(i=>i.getClientRects().length);
   const el=figure.find(i=>{const r=rettangolo(i);return e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;});
   if(el){menu(el);avvia(e,el,maniglia);return;}
  }
  const el=e.target.closest?.('.note-host .note-visual img');if(el)avvia(e,el);
 },true);
 document.addEventListener('dragstart',e=>{if(e.target.closest?.('.note-visual'))e.preventDefault();},true);
 function apriDisegno(s,c){
  try{const id=c.v.src.match(/([0-9a-f-]{36})\.(?:png|svg)$/)[1],r=window.vault.disegni.leggi(s.courseId,id);if(r.error)throw Error(r.error);if(r.annotazioni)annota(s,c,r.annotazioni);else disegno(s,c);}catch(e){toast(e.message,false);}
 }
 function annota(s,c,scena){
  s=s||noteStatoAttivo();if(!s?.cur||!s.mde){toast('Apri un appunto per annotare.',false);return;}via();mdbChiudi(true,s);
  if(AppuntiA4.attiva(s))return AppuntiA4.annota(s,c,scena).catch(e=>toast(e.message,false));
  const cm=s.mde.codemirror,originale=cm.getValue(),versione=s.versione,file=s.cur.file,z=s.courseId,cursor=cm.getCursor('from');
  if(!s.mde.isPreviewActive())noteAlternaAnteprima(s);
  const preview=noteHost(s).querySelector('.editor-preview-active,.editor-preview-side-active,.md-prev');
  const blocchi=[...(preview?.querySelectorAll('.mdb')||[])];
  let blocco=blocchi.find(b=>+b.dataset.a>=cursor.line);
  const elenco=blocco?.closest('ul,ol');if(elenco)blocco=elenco.querySelector('.mdb')||blocco;
  const ancora=c?.v.da??(blocco?+blocco.dataset.da:cursor.line);
  const from={line:ancora,ch:0},to=from;
  function verifica(){if(s.cur?.file!==file||s.courseId!==z||s.versione!==versione||cm.getValue()!==originale)throw Error('L’appunto è cambiato. Annulla e riapri il disegno.');}
  AppuntiAnnotaUI.apri({s,scena,verifica,ancora,figura:c?.v,preview,conferma(src){
   verifica();const v=c?{...c.v,src}:{src,caption:'Disegno',percento:100,style:{align:'left',layer:'front',x:0,y:0}};
   if(c)sostituisci(c,v);else{cm.changeGeneration(true);cm.replaceRange('\n\n'+F.scrivi(v)+'\n\n',from,to,'+disegno');noteAnteprimaRidisegna(s);}
  }});
 }
 async function disegno(s,c){
  s=s||noteStatoAttivo();if(!s?.cur||!s.mde){toast('Apri un appunto per inserire il disegno.',false);return;}
  via();mdbChiudi(true,s);const cm=s.mde.codemirror,originale=cm.getValue(),versione=s.versione,file=s.cur.file,z=s.courseId,from=cm.getCursor('from'),to=cm.getCursor('to');
  const dialog=E('dialog',null,'note-disegno-dialog tbar-ctl'),bar=E('div',null,'tbar'),tela=E('div',null,'note-disegno-tela'),errore=E('output');errore.setAttribute('role','status');dialog.setAttribute('aria-label','Disegno negli appunti');let editor,busy=false;
  function verifica(){if(!dialog.open||s.cur?.file!==file||s.versione!==versione||cm.getValue()!==originale)throw Error('L’appunto è cambiato. Chiudi e riapri il disegno.');}
  const applica=button(c?'Aggiorna disegno':'Inserisci disegno',async()=>{
   if(busy||!editor?.api)return;busy=true;applica.disabled=true;
   try{
    verifica();const scene=LimModello.scena({elements:editor.api.getSceneElements().filter(e=>!e.isDeleted),appState:{},files:{}});
    if(!scene.elements.length)throw Error('Disegna almeno un elemento.');
    if(scene.elements.some(e=>!['rectangle','diamond','ellipse','arrow','line','freedraw','text'].includes(e.type)||e.link))throw Error('Usa forme, frecce, testo o tratto libero senza collegamenti.');
    const png=await LimEditor.exportToBlob({elements:scene.elements,appState:{...editor.api.getAppState(),exportBackground:false,exportWithDarkMode:false,exportEmbedScene:true},files:{},mimeType:'image/png',maxWidthOrHeight:3200,exportPadding:16});
    const dati=await new Promise((ok,ko)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=()=>ko(Error('Impossibile preparare il disegno.'));r.readAsDataURL(png);});
    const svg=await LimEditor.exportToSvg({elements:scene.elements,appState:{...editor.api.getAppState(),exportBackground:false,exportWithDarkMode:false},files:{},exportPadding:16});
    const vettore=AppuntiSvg.daDOM(svg,scene.elements);
    verifica();const salvato=window.vault.disegni.salva(z,{png:dati,vettore});if(salvato.error)throw Error(salvato.error);verifica();
    const v=c?{...c.v,src:salvato.src}:{src:salvato.src,caption:'Disegno',percento:60,style:{align:'center',layer:'inline'}};
    if(c)sostituisci(c,v);else{cm.replaceRange('\n\n'+F.scrivi(v)+'\n\n',from,to,'+disegno');noteAnteprimaRidisegna(s);}dialog.close();
   }catch(e){errore.textContent=e.message;}finally{busy=false;applica.disabled=false;}
  });
  applica.disabled=true;bar.append(E('strong','Disegno'),E('span',null,'tbspazio'),button('Annulla',()=>dialog.close()),applica);dialog.append(bar,tela,errore);document.body.append(dialog);dialog.showModal();dialog.addEventListener('close',()=>{editor?.smonta();dialog.remove();},{once:true});
  try{
   await LavagnaUI.carica();verifica();let data={elements:[],appState:{viewBackgroundColor:'#ffffff',currentItemFontFamily:2},files:{}};
   if(c){const id=c.v.src.match(/([0-9a-f-]{36})\.(?:png|svg)$/)[1],r=window.vault.disegni.leggi(z,id);if(r.error)throw Error(r.error);const blob=new Blob([Uint8Array.from(atob(r.dati.split(',')[1]),c=>c.charCodeAt(0))],{type:'image/png'});data=await LimEditor.loadFromBlob(blob,null,null);LimModello.scena(data);verifica();}
   editor=LimEditor.monta(tela,{data:{...data,scrollToContent:true},ready:()=>{applica.disabled=false;},onChange:()=>{},link:()=>{}});
  }catch(e){errore.textContent=e.message;}
 }
 document.addEventListener('click',e=>{if(ignoraClick){e.preventDefault();e.stopImmediatePropagation();return;}const el=e.target.closest?.('.note-host .note-visual img');if(el){e.preventDefault();e.stopImmediatePropagation();menu(el);}else if(!trascinamento&&(bubble||maniglia)&&!bubble?.contains(e.target)&&!maniglia?.contains(e.target))via();},true);
 document.addEventListener('dblclick',e=>{const el=e.target.closest?.('.note-host .note-visual img'),c=el&&contesto(el);if(c&&c.v.src.startsWith('_disegni/')){e.preventDefault();e.stopImmediatePropagation();apriDisegno(c.s,c);}},true);
 document.addEventListener('contextmenu',e=>{const el=e.target.closest?.('.note-host .note-visual img');if(el){e.preventDefault();e.stopImmediatePropagation();menu(el);}},true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&annullaDrag){e.preventDefault();annullaDrag();return;}if(e.key==='Escape'&&(bubble||maniglia)){e.preventDefault();e.stopImmediatePropagation();via();return;}if(e.key==='Escape'){const s=noteStatoAttivo();if(s&&noteHost(s).classList.contains('note-seleziona-figure')){e.preventDefault();e.stopImmediatePropagation();seleziona(s,false);}}},true);window.addEventListener('resize',()=>{annullaDrag?.();via();});document.addEventListener('scroll',()=>{if(!trascinamento)via();},true);
 window.AppuntiFigureUI={installa,seleziona,annota,disegno,menu,posiziona,rettangolo,chiudi:via};
}());
