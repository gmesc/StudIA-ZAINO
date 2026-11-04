/* Le figure restano ancorate al Markdown. Il dialogo lavora su una copia e
 * ogni conferma produce un solo passo Undo, senza riscrivere altri appunti. */
(function(){
 'use strict';
 const F=AppuntiFigure,E=(t,txt,cls)=>{const el=document.createElement(t);if(txt)el.textContent=txt;if(cls)el.className=cls;return el;};
 let bubble;
 function via(){bubble?.remove();bubble=null;}
 function button(nome,fn){const b=E('button',nome,'tbtn');b.type='button';b.onclick=fn;return b;}
 function contesto(el){const s=noteStatoDaNodo(el),box=el.closest('.mdb');if(!s?.cur||!box)return null;const cm=s.mde.codemirror,da=+box.dataset.da,v=F.leggi(cm.getValue().split('\n'),da);if(!v)return null;return {s,cm,v,file:s.cur.file,versione:s.versione,originale:cm.getValue()};}
 function attuale(c){if(c.s.cur?.file!==c.file||c.s.versione!==c.versione||c.cm.getValue()!==c.originale)throw Error('L’appunto è cambiato. Riapri i comandi della figura.');}
 function sostituisci(c,v){attuale(c);c.cm.replaceRange(F.scrivi(v),{line:c.v.da,ch:0},{line:c.v.fine,ch:c.cm.getLine(c.v.fine).length},'+figura');noteAnteprimaRidisegna(c.s);}
 function menu(el){
  via();closePops();const c=contesto(el);if(!c)return;const visuale=el.closest('.note-visual'),r=visuale.querySelector('img').getBoundingClientRect();bubble=E('div',null,'popmenu note-figure-menu tbar-ctl');bubble.setAttribute('open','');bubble.setAttribute('role','dialog');bubble.setAttribute('aria-label','Aspetto della figura');const bar=E('div',null,'tbar');
  function modifica(fn){try{const v={...c.v,style:{...c.v.style}};fn(v);sostituisci(c,v);via();}catch(e){toast(e.message,false);}}
  const misura=c.v.percento||Math.max(10,Math.min(100,Math.round(r.width/Math.max(1,visuale.getBoundingClientRect().width)*20)*5));
  const larg=E('label','Dimensione '),slider=E('input'),numero=E('output',misura+'%');slider.type='range';slider.className='zaino-slider';slider.min=10;slider.max=100;slider.step=5;slider.value=misura;slider.setAttribute('aria-label','Larghezza della figura');slider.oninput=()=>numero.textContent=slider.value+'%';slider.onchange=()=>modifica(v=>v.percento=+slider.value);larg.append(slider,numero);
  if(c.v.src.startsWith('album:'))bar.append(button('Mostra nell’album',()=>{via();albumMostraCitata(c.v.src.slice(6));}));
  if(c.v.src.startsWith('_disegni/'))bar.append(button('Modifica disegno',()=>{via();disegno(c.s,c);}));
  for(const [v,n] of [['left','Sinistra'],['center','Centro'],['right','Destra']]){const b=button(n,()=>modifica(x=>x.style.align=v));b.setAttribute('aria-pressed',String(c.v.style.align===v));bar.append(b);}
  const livelli=E('div',null,'tbar');for(const [v,n] of [['front','Porta sopra'],['back','Porta sotto'],['inline','In linea']]){const b=button(n,()=>modifica(x=>x.style.layer=v));b.setAttribute('aria-pressed',String(c.v.style.layer===v));livelli.append(b);}
  bar.append(button('Chiudi',via));bubble.append(bar,larg,livelli);document.body.append(bubble);const b=bubble.getBoundingClientRect();bubble.style.left=Math.max(8,Math.min(r.left,innerWidth-b.width-8))+'px';bubble.style.top=Math.max(8,Math.min(r.bottom+4,innerHeight-b.height-8))+'px';
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
 document.addEventListener('click',e=>{const el=e.target.closest?.('#noteHost .note-visual img,#noteHost2 .note-visual img');if(el){e.preventDefault();e.stopImmediatePropagation();menu(el);}else if(bubble&&!bubble.contains(e.target))via();},true);
 document.addEventListener('dblclick',e=>{const el=e.target.closest?.('#noteHost .note-visual img,#noteHost2 .note-visual img'),c=el&&contesto(el);if(c&&c.v.src.startsWith('_disegni/')){e.preventDefault();e.stopImmediatePropagation();disegno(c.s,c);}},true);
 document.addEventListener('contextmenu',e=>{const el=e.target.closest?.('#noteHost .note-visual img,#noteHost2 .note-visual img');if(el){e.preventDefault();e.stopImmediatePropagation();menu(el);}},true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&bubble){e.preventDefault();via();}});window.addEventListener('resize',via);
 window.AppuntiFigureUI={disegno,menu,chiudi:via};
}());
