/* Editor condiviso fra il banco e la proiezione; il salvataggio è nello zaino. */
(function(){
 'use strict';
 const base=new URL('.',document.currentScript.src);let caricamento;
 function carica(){return caricamento||(caricamento=new Promise((ok,ko)=>{
  window.EXCALIDRAW_ASSET_PATH=new URL('vendor/',base).href;
  const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('vendor/excalidraw.css',base).href;document.head.append(css);
  const js=document.createElement('script');js.src=new URL('vendor/excalidraw.js',base).href;js.onload=ok;js.onerror=()=>ko(Error('Editor LIM non disponibile.'));document.head.append(js);
 }));}
 function el(tag,text,cls){const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;}
 function monta(host,api,opt={}){
  host.classList.add('lim-superficie');const toolbar=el('div',null,'tbar lim-bar'),select=el('button',null,'tbtn lim-scegli'),menu=el('div',null,'lim-menu'),label=el('span','Lavagnate','ui-documento'),status=el('span','Apri o crea una lavagnata.','lim-stato'),canvas=el('div',null,'lim-editor');
  select.type='button';select.append(label);select.insertAdjacentHTML('beforeend',UiIcone.svg('chevron-down'));
  menu.id='lim-menu-'+crypto.randomUUID();menu.popover='auto';menu.setAttribute('role','menu');menu.setAttribute('aria-label','Lavagnate salvate');menu.tabIndex=-1;
  select.setAttribute('aria-haspopup','menu');select.setAttribute('aria-controls',menu.id);select.setAttribute('aria-expanded','false');status.setAttribute('role','status');
  const titolo=el('input');titolo.type='text';titolo.maxLength=140;titolo.setAttribute('aria-label','Titolo della lavagnata');titolo.title='Titolo della lavagnata';titolo.hidden=true;
  function btn(nome,icon,fn){const b=el('button',null,'tbtn');b.type='button';b.title=nome;b.setAttribute('aria-label',nome);b.innerHTML=UiIcone.svg(icon);b.onclick=()=>azione(fn);toolbar.append(b);return b;}
  toolbar.append(select);btn('Nuova lavagnata','plus',nuova);const edit=btn('Rinomina lavagnata','pencil',()=>{if(!doc)return;titolo.hidden=false;titolo.value=doc.studia.title;titolo.focus();titolo.select();});toolbar.append(titolo);
  const save=btn('Salva lavagnata','save',()=>salva(true));toolbar.append(status);host.append(toolbar,menu,canvas);
  let doc=null,editor=null,timer=null,sporco=false,impronta='',giro=0,corso='',lista=[],coda=Promise.resolve(),disposed=false;
  const mittente=crypto.randomUUID();
  function stato(t,errore=false){status.textContent=t;status.dataset.errore=errore?'1':'';}
  async function richiesta(o){const r=await api.comando({...o,corso,mittente});if(!r?.ok)throw Error(r?.error||'Operazione LIM non riuscita.');corso=r.corso||corso;return r;}
  async function azione(fn){try{return await fn();}catch(e){stato(e.message,true);opt.errore?.(e);}}
  function scena(){const a=editor?.api;return a?LimModello.scena({elements:a.getSceneElementsIncludingDeleted(),files:a.getFiles(),appState:a.getAppState()}):null;}
  function cambiata(){if(!doc||!editor?.api)return;let s;try{s=scena();}catch(e){stato(e.message,true);return;}const key=JSON.stringify(s);if(key===impronta)return;impronta=key;sporco=true;window.dispatchEvent(new Event('studia:lim-disegno'));stato('Salvataggio…');clearTimeout(timer);timer=setTimeout(()=>azione(()=>salva()),250);}
  async function salva(esplicito=false){
   clearTimeout(timer);if(!doc||!sporco){await coda;if(esplicito)stato(doc?'Salvata':'Crea una lavagnata.');return;}
   const s=scena(),id=doc.studia.id,z=corso;sporco=false;
   const run=async()=>{const r=await api.comando({azione:'salva',corso:z,id,scena:s,mittente});if(!r?.ok){if(doc?.studia.id===id){sporco=true;stato(r?.error||'Salvataggio non riuscito',true);}throw Error(r?.error||'Salvataggio non riuscito');}
    if(doc?.studia.id===id){doc.studia=r.lavagna.studia;stato(sporco?'Salvataggio…':'Salvata');opt.cambiata?.(doc);}};
   coda=coda.then(run,run);return coda;
  }
  function flush(){clearTimeout(timer);if(!doc||!editor?.api)return true;
   const s=scena();if(!sporco&&JSON.stringify(s)===impronta)return true;
   const r=api.flush({azione:'salva',corso,id:doc.studia.id,scena:s,mittente});if(!r?.ok){stato(r?.error||'Salvataggio non riuscito',true);return false;}sporco=false;impronta=JSON.stringify(s);return true;
  }
  function etichetta(){const nome=lista.find(d=>d.id===doc?.studia.id)?.title||doc?.studia.title;label.textContent=nome||'Lavagnate';select.title=nome?'Lavagnata aperta: '+nome+' — premi per cambiarla':'Scegli una lavagnata';select.setAttribute('aria-label',select.title);edit.disabled=save.disabled=!doc;}
  function voci(){const focus=menu.contains(document.activeElement),id=document.activeElement?.dataset.limId;menu.replaceChildren();
   for(const d of lista){const b=el('button',d.title,'lim-menu-voce');b.type='button';b.dataset.limId=d.id;b.title=d.title;b.setAttribute('role','menuitemradio');b.setAttribute('aria-checked',String(d.id===doc?.studia.id));b.onclick=()=>{chiudiMenu(true);azione(()=>apri(d.id));};menu.append(b);}
   if(!lista.length)menu.append(el('p','Nessuna lavagnata salvata. Usa + per crearne una.','lim-menu-vuoto'));
   if(focus)([...menu.querySelectorAll('button')].find(b=>b.dataset.limId===id)||menu).focus();
  }
  function chiudiMenu(focus=false){if(menu.matches(':popover-open'))menu.hidePopover();select.setAttribute('aria-expanded','false');if(focus)select.focus();}
  function apriMenu(ultima=false){window.closePops?.();voci();menu.showPopover();select.setAttribute('aria-expanded','true');
   const r=select.getBoundingClientRect(),b=menu.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(innerWidth-b.width-8,r.left))+'px';menu.style.top=Math.max(8,Math.min(innerHeight-b.height-8,r.bottom+4))+'px';
   const bs=menu.querySelectorAll('button');(ultima?bs[bs.length-1]:menu.querySelector('[aria-checked="true"]')||bs[0]||menu)?.focus();
  }
  // Il popover nativo resta sopra la tela e si chiude anche con un clic esterno.
  select.onclick=()=>menu.matches(':popover-open')?chiudiMenu():apriMenu();
  select.onkeydown=e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();apriMenu(e.key==='ArrowUp');}};
  menu.addEventListener('toggle',()=>select.setAttribute('aria-expanded',String(menu.matches(':popover-open'))));
  menu.onkeydown=e=>{if(e.key==='Tab'){chiudiMenu(true);return;}if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;e.preventDefault();e.stopPropagation();const bs=[...menu.querySelectorAll('button')],i=bs.indexOf(document.activeElement),n=e.key==='Home'?0:e.key==='End'?bs.length-1:(i+(e.key==='ArrowDown'?1:-1)+bs.length)%bs.length;bs[n]?.focus();};
  function escMenu(e){if(e.key==='Escape'&&menu.matches(':popover-open')){e.preventDefault();e.stopImmediatePropagation();chiudiMenu(true);}}
  function nascondiMenu(){chiudiMenu();}
  window.addEventListener('keydown',escMenu,true);window.addEventListener('resize',nascondiMenu);window.addEventListener('banco-layout',nascondiMenu);
  async function elenco(){const r=await richiesta({azione:'elenco'});lista=r.elenco;etichetta();voci();return r;}
  async function apri(id){await salva();const n=++giro,r=await richiesta({azione:'apri',id});if(n!==giro||disposed)return;await mostra(r.lavagna);await elenco();}
  async function mostra(d){await carica();editor?.smonta();editor=null;canvas.replaceChildren();doc=d;sporco=false;impronta='';
   editor=LimEditor.monta(canvas,{data:{...d,appState:{...d.appState,isLoading:false}},ready:()=>{stato('Salvata');opt.cambiata?.(doc);},onChange:()=>cambiata(),link:link=>opt.link?.(link)});
   opt.cambiata?.(doc);etichetta();
  }
  async function nuova(){await salva();const r=await richiesta({azione:'crea',titolo:'Lavagnata '+(lista.length+1)});await mostra(r.lavagna);await elenco();}
  async function assicurati(){if(!doc){const r=await elenco();if(r.attiva||lista.length)await apri(r.attiva||lista[0].id);else await nuova();}for(let n=0;!editor?.api&&n<100;n++)await new Promise(r=>setTimeout(r,30));if(!editor?.api)throw Error('La lavagna non è pronta.');return doc;}
  async function inserisci(d){await assicurati();const a=editor.api,s=a.getAppState(),x=-s.scrollX+40/s.zoom.value,y=-s.scrollY+80/s.zoom.value;
   let skeleton=[];
   if(d.immagine){const id=crypto.randomUUID();a.addFiles([{id,dataURL:d.immagine,mimeType:'image/png',created:Date.now()}]);skeleton.push({type:'image',fileId:id,x,y,width:Math.min(720,d.width),height:Math.min(720,d.width)*d.height/d.width});}
   const testo=[d.testo,d.titolo].filter(Boolean).join('\n\n');if(testo)skeleton.push({type:'text',x,y:y+(d.immagine?Math.min(720,d.width)*d.height/d.width+16:0),text:testo,fontSize:24,fontFamily:2,...(d.link?{link:d.link,customData:{fonte:d.link}}:{})});
   const elementi=LimEditor.converti(skeleton);a.updateScene({elements:[...a.getSceneElementsIncludingDeleted(),...elementi],captureUpdate:LimEditor.CaptureUpdateAction.IMMEDIATELY});a.scrollToContent(elementi,{fitToViewport:true,maxZoom:1});cambiata();await salva();return doc.studia.id;
  }
  async function sincronizza(d){if(d.corso!==corso||d.mittente===mittente)return;await elenco();if(!doc)return;
   if(d.rimossi?.includes(doc.studia.id)){giro++;editor?.smonta();editor=null;doc=null;sporco=false;canvas.replaceChildren();stato('Lavagnata eliminata.');etichetta();voci();opt.cambiata?.(null);return;}
   if(d.id!==doc.studia.id||!editor?.api)return;const id=doc.studia.id,r=await richiesta({azione:'apri',id});if(doc?.studia.id!==id)return;
   const a=editor.api,remoto=r.lavagna;doc.studia=remoto.studia;
   a.addFiles(Object.values(remoto.files));a.updateScene({elements:LimEditor.reconcile(a.getSceneElementsIncludingDeleted(),LimEditor.restore(remoto.elements,null),a.getAppState()),captureUpdate:LimEditor.CaptureUpdateAction.NEVER});opt.cambiata?.(doc);
  }
  titolo.onkeydown=e=>{if(e.key==='Escape')titolo.hidden=true;if(e.key==='Enter'){e.preventDefault();azione(async()=>{await salva();const r=await richiesta({azione:'rinomina',id:doc.studia.id,titolo:titolo.value});doc.studia=r.lavagna.studia;titolo.hidden=true;await elenco();opt.cambiata?.(doc);});}};
  const off=api.onCambiata(d=>azione(()=>sincronizza(d)));
  async function immagine(area,vista){const a=editor?.api;if(!a)throw Error('Apri una lavagnata da proiettare.');const s=a.getAppState(),r=canvas.getBoundingClientRect(),z=s.zoom.value,m=BancoLettura.raster(area,vista);
   const frame=LimEditor.converti([{type:'frame',children:[],x:(area.x-r.x)/z-s.scrollX,y:(area.y-r.y)/z-s.scrollY,width:area.width/z,height:area.height/z}])[0];
   const c=await LimEditor.exportToCanvas({elements:a.getSceneElements(),appState:{...s,exportBackground:true,exportWithDarkMode:false},files:a.getFiles(),exportingFrame:frame,exportPadding:0,getDimensions:()=>({width:m.width,height:m.height,scale:m.fattore*z})});
   const data=c.toDataURL();c.width=c.height=0;return data;
  }
  function primaDiUscire(e){if(!flush()){e.preventDefault();e.returnValue='';}}
  window.addEventListener('beforeunload',primaDiUscire);
  return {apri,nuova,inserisci,assicurati,flush,salva,elenco,immagine,get doc(){return doc;},get api(){return editor?.api;},async contesto(z){if(z===corso)return;chiudiMenu();if(!flush())throw Error('Salva la lavagnata prima di cambiare zaino.');await coda;corso=z;giro++;editor?.smonta();editor=null;doc=null;sporco=false;canvas.replaceChildren();stato('Apri o crea una lavagnata.');await elenco();},smonta(){disposed=true;chiudiMenu();window.removeEventListener('keydown',escMenu,true);window.removeEventListener('resize',nascondiMenu);window.removeEventListener('banco-layout',nascondiMenu);flush();off();editor?.smonta();window.removeEventListener('beforeunload',primaDiUscire);}};
 }
 window.LavagnaUI={monta,carica};
})();
