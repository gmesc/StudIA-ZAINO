/* Le figure restano ancorate al Markdown. Il dialogo lavora su una copia e
 * ogni conferma produce un solo passo Undo, senza riscrivere altri appunti. */
(function(){
 'use strict';
 const F=AppuntiFigure,E=(t,txt,cls)=>{const el=document.createElement(t);if(txt)el.textContent=txt;if(cls)el.className=cls;return el;};
 let bubble,maniglia,annullaDrag,trascinamento=false,ignoraClick=false;
 function via(){bubble?.remove();bubble=null;maniglia?.remove();maniglia=null;}
 function button(nome,fn){const b=E('button',nome,'tbtn');b.type='button';b.onclick=fn;return b;}
 function contesto(el){const s=noteStatoDaNodo(el),box=el.closest('.mdb');if(!s?.cur||!box)return null;const cm=s.mde.codemirror,da=+box.dataset.da,v=F.leggi(cm.getValue().split('\n'),da);if(!v)return null;return {s,cm,v,file:s.cur.file,versione:s.versione,originale:cm.getValue()};}
 function attuale(c){if(c.s.cur?.file!==c.file||c.s.versione!==c.versione||c.cm.getValue()!==c.originale)throw Error('L’appunto è cambiato. Riapri i comandi della figura.');}
 function sostituisci(c,v){attuale(c);c.cm.changeGeneration(true);c.cm.replaceRange(F.scrivi(v),{line:c.v.da,ch:0},{line:c.v.fine,ch:c.cm.getLine(c.v.fine).length},'+figura');noteAnteprimaRidisegna(c.s);}
 function menu(el){
  via();closePops();const c=contesto(el);if(!c)return;const visuale=el.closest('.note-visual'),r=visuale.querySelector('img').getBoundingClientRect();bubble=E('div',null,'popmenu note-figure-menu tbar-ctl');bubble.setAttribute('open','');bubble.setAttribute('role','dialog');bubble.setAttribute('aria-label','Aspetto della figura');const bar=E('div',null,'tbar');
  function modifica(fn){try{const v={...c.v,style:{...c.v.style}};fn(v);sostituisci(c,v);via();}catch(e){toast(e.message,false);}}
  const misura=c.v.percento||Math.max(10,Math.min(100,Math.round(r.width/Math.max(1,visuale.getBoundingClientRect().width)*20)*5));
  const larg=E('label','Dimensione '),slider=E('input'),numero=E('output',misura+'%');slider.type='range';slider.className='zaino-slider';slider.min=10;slider.max=100;slider.step=5;slider.value=misura;slider.setAttribute('aria-label','Larghezza della figura');slider.oninput=()=>numero.textContent=slider.value+'%';slider.onchange=()=>modifica(v=>Object.assign(v,F.dimensiona(v,+slider.value)));larg.append(slider,numero);
  if(c.v.src.startsWith('album:'))bar.append(button('Mostra nell’album',()=>{via();albumMostraCitata(c.v.src.slice(6));}));
  if(c.v.src.startsWith('_disegni/'))bar.append(button('Modifica disegno',()=>{via();disegno(c.s,c);}));
  for(const [v,n] of [['left','Sinistra'],['center','Centro'],['right','Destra']]){const b=button(n,()=>modifica(x=>{x.style.align=v;delete x.style.x;delete x.style.y;}));b.setAttribute('aria-pressed',String(c.v.style.align===v));bar.append(b);}
  const livelli=E('div',null,'tbar');for(const [v,n] of [['front','Porta sopra'],['back','Porta sotto'],['inline','In linea']]){const b=button(n,()=>modifica(x=>{x.style.layer=v;if(v==='inline'){delete x.style.x;delete x.style.y;}}));b.setAttribute('aria-pressed',String(c.v.style.layer===v));livelli.append(b);}
  bar.append(button('Posiziona liberamente',()=>posiziona(el)),button('Chiudi',via));bubble.append(bar,larg,livelli);document.body.append(bubble);const b=bubble.getBoundingClientRect();bubble.style.left=Math.max(8,Math.min(r.left,innerWidth-b.width-8))+'px';bubble.style.top=Math.max(8,Math.min(r.bottom+4,innerHeight-b.height-8))+'px';
 }
 // Le coordinate sono nel foglio (x in percentuale, y in em), indipendenti
 // dallo zoom del banco. Il drag scrive una volta sola al rilascio.
 function geometria(el,c){const visuale=el.closest('.note-visual'),r=visuale.getBoundingClientRect(),img=el.getBoundingClientRect(),contenuto=visuale.querySelector('.note-visual-contenuto'),scala=r.width/Math.max(1,visuale.offsetWidth),em=parseFloat(getComputedStyle(visuale).fontSize)*scala,prev=visuale.closest('.editor-preview,.md-prev,.editor-preview-side'),pr=prev.getBoundingClientRect();return {visuale,contenuto,img,scala,larghezza:r.width,em,alto:Math.min(0,(pr.top-prev.scrollTop*scala+parseFloat(getComputedStyle(prev).paddingTop)*scala-r.top)/em),basso:Math.max(0,(pr.top-prev.scrollTop*scala+Math.max(prev.scrollHeight,prev.clientHeight)*scala-r.top-img.height)/em),v:{...c.v,style:{...c.v.style,x:c.v.style.x??((img.left-r.left)/r.width*100),y:c.v.style.y??((img.top-r.top)/em)},percento:c.v.percento||Math.max(10,Math.min(100,img.width/r.width*100))}};}
 function avvia(e,el,handle){
  if(e.button!==0)return;const c=contesto(el);if(!c)return;const g=geometria(el,c),x=e.clientX,y=e.clientY,punto=handle||el;let cambiata=false,nuova=g.v;
  e.preventDefault();e.stopPropagation();punto.setPointerCapture?.(e.pointerId);
  function move(ev){if(ev.pointerId!==e.pointerId)return;const dx=ev.clientX-x,dy=ev.clientY-y;if(!cambiata&&Math.hypot(dx,dy)<4)return;if(!cambiata){cambiata=true;trascinamento=true;g.visuale.dataset.layer=g.v.style.layer==='inline'?'front':g.v.style.layer;}nuova=F.sposta(g.v,dx,dy,g);g.visuale.dataset.libera='true';g.visuale.style.setProperty('--fig-x',nuova.style.x+'%');g.visuale.style.setProperty('--fig-y',nuova.style.y+'em');if(handle){handle.style.left=g.img.left+dx+'px';handle.style.top=g.img.top+dy+'px';}}
  function fine(ev){annullaDrag=null;punto.removeEventListener('pointermove',move);punto.removeEventListener('pointerup',fine);punto.removeEventListener('pointercancel',fine);if(punto.hasPointerCapture?.(e.pointerId))punto.releasePointerCapture(e.pointerId);trascinamento=false;if(cambiata){ignoraClick=true;setTimeout(()=>ignoraClick=false,0);try{if(ev.type==='pointercancel')noteAnteprimaRidisegna(c.s);else sostituisci(c,nuova);}catch(err){noteAnteprimaRidisegna(c.s);toast(err.message,false);}via();}}
  annullaDrag=()=>fine({type:'pointercancel'});punto.addEventListener('pointermove',move);punto.addEventListener('pointerup',fine);punto.addEventListener('pointercancel',fine);
 }
 function posiziona(el){
  via();const c=contesto(el);if(!c)return;const r=el.getBoundingClientRect();maniglia=E('button',null,'note-figure-posizione');maniglia.type='button';maniglia.popover='manual';maniglia.setAttribute('aria-label','Sposta figura: trascina o usa le frecce');document.body.append(maniglia);maniglia.showPopover();Object.assign(maniglia.style,{margin:'0',inset:'auto',left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});maniglia.onpointerdown=e=>avvia(e,el,maniglia);maniglia.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();e.stopPropagation();const g=geometria(el,c),passo=e.shiftKey?10:1,dx=e.key==='ArrowRight'?passo:e.key==='ArrowLeft'?-passo:0,dy=e.key==='ArrowDown'?passo:e.key==='ArrowUp'?-passo:0;try{const host=el.closest('#noteHost,#noteHost2');sostituisci(c,F.sposta(g.v,dx*g.scala,dy*g.scala,g));const nuova=host.querySelector('.mdb[data-da="'+c.v.da+'"] .note-visual img');if(nuova)posiziona(nuova);else via();}catch(err){toast(err.message,false);via();}};maniglia.focus();
 }
 document.addEventListener('pointerdown',e=>{const el=e.target.closest?.('#noteHost .note-visual img,#noteHost2 .note-visual img');if(el)avvia(e,el);},true);
 document.addEventListener('dragstart',e=>{if(e.target.closest?.('.note-visual'))e.preventDefault();},true);
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
    verifica();const salvato=window.vault.disegni.salva(z,dati);if(salvato.error)throw Error(salvato.error);verifica();
    const v=c?{...c.v,src:salvato.src}:{src:salvato.src,caption:'Disegno',percento:60,style:{align:'center',layer:'inline'}};
    if(c)sostituisci(c,v);else{cm.replaceRange('\n\n'+F.scrivi(v)+'\n\n',from,to,'+disegno');noteAnteprimaRidisegna(s);}dialog.close();
   }catch(e){errore.textContent=e.message;}finally{busy=false;applica.disabled=false;}
  });
  applica.disabled=true;bar.append(E('strong','Disegno'),E('span',null,'tbspazio'),button('Annulla',()=>dialog.close()),applica);dialog.append(bar,tela,errore);document.body.append(dialog);dialog.showModal();dialog.addEventListener('close',()=>{editor?.smonta();dialog.remove();},{once:true});
  try{
   await LavagnaUI.carica();verifica();let data={elements:[],appState:{viewBackgroundColor:'#ffffff',currentItemFontFamily:2},files:{}};
   if(c){const id=c.v.src.match(/([0-9a-f-]{36})\.png$/)[1],r=window.vault.disegni.leggi(z,id);if(r.error)throw Error(r.error);const blob=new Blob([Uint8Array.from(atob(r.dati.split(',')[1]),c=>c.charCodeAt(0))],{type:'image/png'});data=await LimEditor.loadFromBlob(blob,null,null);LimModello.scena(data);verifica();}
   editor=LimEditor.monta(tela,{data:{...data,scrollToContent:true},ready:()=>{applica.disabled=false;},onChange:()=>{},link:()=>{}});
  }catch(e){errore.textContent=e.message;}
 }
 document.addEventListener('click',e=>{if(ignoraClick){e.preventDefault();e.stopImmediatePropagation();return;}const el=e.target.closest?.('#noteHost .note-visual img,#noteHost2 .note-visual img');if(el){e.preventDefault();e.stopImmediatePropagation();menu(el);}else if(!trascinamento&&(bubble||maniglia)&&!bubble?.contains(e.target)&&!maniglia?.contains(e.target))via();},true);
 document.addEventListener('dblclick',e=>{const el=e.target.closest?.('#noteHost .note-visual img,#noteHost2 .note-visual img'),c=el&&contesto(el);if(c&&c.v.src.startsWith('_disegni/')){e.preventDefault();e.stopImmediatePropagation();disegno(c.s,c);}},true);
 document.addEventListener('contextmenu',e=>{const el=e.target.closest?.('#noteHost .note-visual img,#noteHost2 .note-visual img');if(el){e.preventDefault();e.stopImmediatePropagation();menu(el);}},true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&annullaDrag){e.preventDefault();annullaDrag();return;}if(e.key==='Escape'&&(bubble||maniglia)){e.preventDefault();via();}});window.addEventListener('resize',()=>{annullaDrag?.();via();});document.addEventListener('scroll',()=>{if(!trascinamento)via();},true);
 window.AppuntiFigureUI={disegno,menu,chiudi:via};
}());
