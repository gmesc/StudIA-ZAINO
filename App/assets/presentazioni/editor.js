(function(){
 'use strict';
 const M=window.PresentaModello,C=window.PresentaColori,api=window.vault?.presentazioni;
 if(!api||!M)return;
 const $=id=>document.getElementById(id),E=(tag,testo,classe)=>{const e=document.createElement(tag);if(testo!=null)e.textContent=testo;if(classe)e.className=classe;return e;};
 let selezioneGiro=0;
 let corso='',elenco=[],slideId='',giro=0,occupato=false,listaErrore='',regia=null,previewTimer=null,previewGiro=0,quadro=null,framePronto=false,firma='',canale=crypto.randomUUID();
 let avviso,bloccoId='',oggettiNav,richiestaMisure=null;
 let host,bar,corpo,scaletta,campi,frame,stato,vuoto,editor,gobbo,gobboBar,gobboCorpo,gobboStato;
 const bottoni={},D=PresentaDocumento.crea({salva:async(d,baseRevision)=>(await call({azione:'salva',documento:d,baseRevision})).documento,
  bozza:(d,baseRevision)=>call({azione:'bozza',documento:d,baseRevision}),cambiata:()=>{if(host)disegna();}});
 async function call(o,z=corso){const r=await api.comando({...o,corso:z});if(!r?.ok)throw Error(r?.error||'PRESENTA non disponibile.');return r;}
 async function azione(fn){try{return await fn();}catch(e){listaErrore=e.message;disegna();window.toast?.(e.message,false);}}
 function b(nome,icona,fn,chiave){const e=E('button',null,'tbtn');e.type='button';e.title=nome;e.setAttribute('aria-label',nome);if(icona)UiIcone.imposta(e,icona);else e.textContent=nome;e.onclick=()=>azione(fn);if(chiave){e.dataset.presentaAction=chiave;bottoni[chiave]=e;}return e;}
 function campo(nome,valore,fn,{tipo='text',opzioni,maxLength,min,max}={}){
  const label=E('label',nome,'presenta-campo'),input=E(tipo==='textarea'?'textarea':opzioni?'select':'input');input.setAttribute('aria-label',nome);label.title=nome==='Allineamento del testo'?'Allinea soltanto le righe di questo oggetto, senza spostare gli altri testi.':nome==='Posizione nel riquadro'?'Posizione verticale del contenuto dentro il riquadro selezionato.':nome==='Testo · Markdown e formule'?'Testo con Markdown e formule tra delimitatori matematici.':nome;
  if(opzioni)for(const [value,text]of opzioni)input.append(new Option(text,value));else if(tipo!=='textarea')input.type=tipo;
  if(maxLength)input.maxLength=maxLength;if(min!==undefined)input.min=min;if(max!==undefined)input.max=max;
  input.value=valore??'';input.addEventListener(opzioni||['number','color'].includes(tipo)?'change':'input',()=>azione(()=>{if(tipo==='number'&&(!input.value||!input.validity.valid)){input.reportValidity();return;}return fn(input.value,input);}));label.append(input);return label;
 }
 function posizione(){const d=D.documento;if(!d)return null;return M.posizioni(d).find(p=>p.slide.id===slideId)||M.posizioni(d)[0];}
 function modifica(o,{struttura=false,seleziona}={}){listaErrore='';const d=D.applica(o);if(seleziona)slideId=seleziona(d);if(bloccoId==='@titolo')bloccoId=posizione()?.slide.blocks.find(b=>b.type==='title')?.id||'@titolo';if(struttura)campiSlide();disegna();return d;}
 function op(o,opts){return modifica({slideId:posizione().slide.id,...o},opts);}
 function memoria(){return 'studia.presenta.'+corso;}
 function ricorda(){if(corso&&D.documento)try{localStorage.setItem(memoria(),JSON.stringify({id:D.documento.id,slideId}));}catch(_){}window.bancoAggiornaDocumenti?.();}
 function anteprima(){
  clearTimeout(previewTimer);const d=D.documento;if(!d||!window.bancoVisibile?.('presenta'))return;
  const stamp=JSON.stringify({...d,revision:0});if(stamp===firma){vaiAnteprima();return;}const n=++previewGiro,z=corso;
  previewTimer=setTimeout(()=>azione(async()=>{const r=await call({azione:'vista',documento:d},z);if(n!==previewGiro||z!==corso||D.documento?.id!==d.id)return;
   firma=stamp;disegnaMiniature(r.documento,r.immagini);quadro={presenta:canale,tipo:'quadro',documento:r.documento,posizione:coordinate(),editor:{...metaEditor(),firma:n}};if(framePronto)frame.contentWindow.postMessage(quadro,'*');
  }),180);
 }
 function coordinate(){const p=posizione();return {h:p?.h||0,v:p?.v||0,fragmentIndex:-1};}
 function vaiAnteprima(){if(framePronto&&quadro)frame.contentWindow.postMessage({presenta:canale,tipo:'vai',posizione:coordinate(),editor:{...quadro.editor,...metaEditor()}},'*');}
 function elencoBarra(){
  const sel=$('presentaDocumenti'),id=D.documento?.id||'';const entries=elenco.map(d=>[d.id,d.title]);
  if(id&&!entries.some(e=>e[0]===id))entries.push([id,D.documento.title]);
  const f=JSON.stringify(entries);if(sel.dataset.firma!==f){sel.replaceChildren(new Option('Apri una presentazione…',''),...entries.map(([v,t])=>new Option(t,v)));sel.dataset.firma=f;}sel.value=id;
  sel.disabled=occupato||D.bloccato||!corso;
 }
 function disegna(){
  if(!host)return;const d=D.documento,p=posizione(),disabled=occupato||D.bloccato;
  elencoBarra();vuoto.hidden=!!d;editor.hidden=!d;
  if(!d)vuoto.querySelector('p').textContent=corso?'Crea una presentazione o scegline una dalla tendina.':'Apri uno zaino per costruire una presentazione.';
  for(const [k,v]of Object.entries(bottoni))v.disabled=disabled||(!d&&!['nuova'].includes(k))||(!corso&&k==='nuova');
  bottoni.annulla.disabled=disabled||!D.annullabile;bottoni.ripeti.disabled=disabled||!D.ripetibile;
  bottoni.salva.disabled=disabled||!d;bottoni.nuova.disabled=disabled||!corso;
  const messaggio=listaErrore||D.errore;stato.textContent=messaggio?'Non salvato: '+messaggio:D.salvando?'Salvataggio…':D.sporco?'Modifiche da salvare':d?'Salvato':'PRESENTA';stato.dataset.errore=String(!!messaggio);
  for(const e of campi.querySelectorAll('input,textarea,select,button'))e.disabled=disabled||!d||e.dataset.vuoto==='true';const eliminaSlide=campi.querySelector('[aria-label="Elimina slide"]');if(eliminaSlide)eliminaSlide.disabled=disabled||!d||M.posizioni(d).length===1;
  if(d&&p){frame.style.aspectRatio=d.settings.width+'/'+d.settings.height;frame.dataset.sfondoBianco=String(C.sfondoBianco(p.slide.background,d.settings.theme));}
  disegnaScaletta();
  oggetti();ricorda();sidebar();anteprima();sincronizzaSelezione();disegnaGobbo();
 }
 function scegliSlide(id){nascondiBubble();selezioneGiro++;richiestaMisure=null;slideId=id;bloccoId=posizione()?.slide.blocks.find(b=>b.type==='title')?.id||'@titolo';campiSlide();disegna();vaiAnteprima();}
 function nuovoBlocco(tipo){
  const block=tipo==='math'?{type:'math',slot:'formula',latex:'',display:true}:tipo==='list'?{type:'list',slot:'body',items:[]}:{type:tipo,slot:tipo==='title'?'title':'body',markdown:''};
  const d=op({tipo:'inserisciBlocco',block},{struttura:true});scegliBlocco(M.trova(d,slideId).slide.blocks.at(-1).id);campi.querySelector('.presenta-blocco-editor textarea')?.focus();
 }
 function cambiaBlocco(id,patch){const s=posizione().slide,b=s.blocks.find(b=>b.id===id);op({tipo:'blocco',blockId:id,block:{...b,...patch}});}
 function testoBottone(nome,icona,fn){const el=b(nome,icona,fn);if(icona)el.append(E('span',nome));return el;}
 function metaEditor(){return {slideId:posizione()?.slide.id,selezionato:bloccoId,bloccato:occupato||D.bloccato||firma!==JSON.stringify({...D.documento,revision:0}),colore:getComputedStyle(host).getPropertyValue('--teal-strong').trim()};}
 function sincronizzaSelezione(){if(framePronto&&quadro)frame.contentWindow.postMessage({presenta:canale,tipo:'selezione',editor:{...quadro.editor,...metaEditor()}},'*');}
 function scegliBlocco(id){nascondiBubble();bloccoId=id==='@titolo'?(posizione()?.slide.blocks.find(b=>b.type==='title')?.id||'@titolo'):posizione()?.slide.blocks.some(b=>b.id===id)?id:'';campiSlide();disegna();sincronizzaSelezione();}
 function posiziona(nome){
  if(!bloccoId&&nome!=='conserva')return;const s=posizione().slide;if(s.layout==='free'&&s.blocks.every(b=>b.style?.box)){op({tipo:'posizionaBlocchi',boxes:s.blocks.map(b=>({id:b.id,box:b.id===bloccoId?M.ancora(b.style.box,nome):b.style.box}))},{struttura:true});return;}richiestaMisure={id:crypto.randomUUID(),slideId:posizione().slide.id,blockId:bloccoId,nome};frame.contentWindow.postMessage({presenta:canale,tipo:'misure',richiesta:richiestaMisure.id},'*');
 }
 function modello(nome){const s=posizione().slide;op({tipo:'posizionaBlocchi',boxes:M.disponi(s,nome)},{struttura:true});}
 function modelli(){
  const box=E('div',null,'presenta-modelli');box.setAttribute('role','group');box.setAttribute('aria-label','Disposizioni pronte');
  for(const [nome,label,immagine,testo]of [['image-left','Immagine a sinistra',[2,3,26,26],[36,6,68,22]],['text-left','Testo a sinistra',[42,3,26,26],[2,6,32,22]],['image-top','Immagine sopra',[25,1,26,15],[7,23,63,30]]]){
   const bt=b(label,null,()=>modello(nome));bt.classList.add('presenta-modello');const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 72 34');svg.setAttribute('aria-hidden','true');const r=document.createElementNS(svg.namespaceURI,'rect');for(const [i,k]of ['x','y','width','height'].entries())r.setAttribute(k,immagine[i]);r.setAttribute('fill','currentColor');r.setAttribute('opacity','.2');const line=document.createElementNS(svg.namespaceURI,'path');line.setAttribute('d','M'+testo[0]+' '+testo[1]+'H'+testo[2]+'M'+testo[0]+' '+(testo[1]+8)+'H'+testo[2]+'M'+testo[0]+' '+testo[3]+'H'+(testo[2]-5));line.setAttribute('stroke','currentColor');line.setAttribute('fill','none');svg.append(r,line);bt.prepend(svg);box.append(bt);
  }return box;
 }
 const nomiOggetti={title:'Titolo',text:'Testo',list:'Testo',math:'Formula',image:'Immagine',audio:'Audio',video:'Video'};
 let colori=M.coloriPersonali(),stileCopiato=null,trascinaSlide='',miniature=new Map(),miniGiro=0,scalettaFirma='',menuAperto=null,bubble=null,appuntiPopup=null;
 try{colori=M.coloriPersonali(JSON.parse(localStorage.getItem('studia.presenta.colori')||'{}'));}catch(_){}
 function ricordaColori(){localStorage.setItem('studia.presenta.colori',JSON.stringify(colori));}
 function popup(classe,contenuto,x,y,manuale=false){
  if(!manuale)menuAperto?.remove();const p=E('div',null,'popmenu presenta-menu '+classe);p.popover=manuale?'manual':'auto';p.append(contenuto);host.append(p);p.showPopover();const r=p.getBoundingClientRect();p.style.left=Math.max(8,Math.min(x,innerWidth-r.width-8))+'px';p.style.top=Math.max(8,Math.min(y,innerHeight-r.height-8))+'px';if(!manuale)menuAperto=p;p.addEventListener('toggle',e=>{if(e.newState==='closed')p.remove();});return p;
 }
 function sfogliaColori(fn,anchor){
  const box=E('div',null,'presenta-palette-contenuto'),titolo=E('div','Tailwind · '+C.etichetta(colori.ultimo),'presenta-sezione'),grid=E('div',null,'presenta-tailwind');
  grid.append(E('span'));for(const n of C.gradazioni)grid.append(E('span',String(n),'presenta-gradazione'));
  let famiglia='';for(const c of C.palette){
   if(c.famiglia!==famiglia){famiglia=c.famiglia;grid.append(E('span',famiglia,'presenta-famiglia'));}
   const bt=b(c.id,null,()=>{menuAperto?.hidePopover();colori.ultimo=c.hex;ricordaColori();fn(c.hex);}),sw=E('i',null,'presenta-campione');sw.style.backgroundColor=c.hex;bt.textContent='';bt.append(sw);bt.title=c.id+' · '+c.hex;bt.setAttribute('aria-pressed',String(colori.ultimo.toLowerCase()===c.hex));grid.append(bt);
  }
  box.append(titolo,grid);const r=anchor.getBoundingClientRect(),p=popup('presenta-palette',box,r.left,r.bottom+4);grid.querySelector('[aria-pressed=true]')?.scrollIntoView({block:'center'});p.querySelector('[aria-pressed=true]')?.focus({preventScroll:true});
 }
 function sceltaColore(nome,valore,fn,{automatico=false}={}){
  const box=E('div',null,'presenta-campo'),label=E('span',nome),bar=E('div',null,'tbar presenta-bar');box.append(label,bar);
  if(automatico){const bt=b('Automatico',null,()=>fn(null));bt.setAttribute('aria-pressed',String(!valore));bt.title='Il colore segue lo sfondo di questa slide';bar.append(bt);}
  for(const [hex,nome]of [['#ffffff','Bianco'],['#000000','Nero']]){const bt=b(nome,null,()=>fn(hex)),sw=E('i',null,'presenta-campione');sw.style.backgroundColor=hex;bt.prepend(sw);bt.setAttribute('aria-pressed',String(valore?.toLowerCase()===hex));bar.append(bt);}
  const nomePicker=nome==='Sfondo della slide'?'Colore personalizzato dello sfondo':'Colore manuale del testo',personalizzato=b(nomePicker,null,()=>sfogliaColori(fn,personalizzato)),sw=E('i',null,'presenta-campione');personalizzato.textContent='';personalizzato.classList.add('presenta-personalizzato');personalizzato.dataset.colore=colori.ultimo;sw.style.backgroundColor=colori.ultimo;personalizzato.append(sw,E('span',C.etichetta(colori.ultimo)));personalizzato.title='Palette Tailwind · ultimo colore '+C.etichetta(colori.ultimo)+' · '+colori.ultimo;bar.append(personalizzato);
  const slots=E('div',null,'presenta-slot-colori');slots.setAttribute('role','group');slots.setAttribute('aria-label','Colori personali');box.append(slots);
  for(let i=0;i<5;i++){
   const hex=colori.slots[i],col=E('div'),uso=b('Usa colore '+(i+1),null,()=>{if(!hex)return;colori.ultimo=hex;ricordaColori();fn(hex);}),sw=E('i',null,'presenta-campione');sw.style.backgroundColor=hex||'transparent';uso.textContent='';uso.append(sw,E('span',C.etichetta(hex)));uso.disabled=!hex;uso.dataset.vuoto=String(!hex);uso.setAttribute('aria-pressed',String(!!hex&&hex.toLowerCase()===valore?.toLowerCase()));uso.title=hex?C.etichetta(hex)+' · '+hex:'Slot '+(i+1)+' vuoto';
   const salva=b('Memorizza colore nello slot '+(i+1),'save',()=>{colori.slots[i]=colori.ultimo;ricordaColori();campiSlide();});salva.title='Memorizza '+C.etichetta(colori.ultimo)+' nello slot '+(i+1);col.append(uso,salva);slots.append(col);
  }
  return box;
 }
 function oggetti(){
  oggettiNav.replaceChildren();const s=posizione()?.slide;if(!s)return;const titolo=s.blocks.find(b=>b.type==='title');
  const voci=[{id:titolo?.id||'@titolo',type:'title'},...s.blocks.filter(b=>b!==titolo),{id:'',type:'sfondo'}],conta={};
  for(const obj of voci){const nome=nomiOggetti[obj.type]||'Sfondo',n=(conta[nome]||0)+1;conta[nome]=n;const bt=b(nome+(n>1?' '+n:''),null,()=>scegliBlocco(obj.id));bt.dataset.oggettoId=obj.id;bt.setAttribute('aria-pressed',String(bloccoId===obj.id));bt.disabled=occupato||D.bloccato;oggettiNav.append(bt);}
 }
 function disegnaMiniature(compilata,immagini={}){
  const html=compilata.html.replace(/src="([^"]+)"/g,(_,src)=>{let p;try{p=new URL(src).pathname.slice(1);}catch(_){p=src;}return 'src="'+(immagini[p]||'')+'"';});const dom=new DOMParser().parseFromString(html,'text/html'),viste=[...dom.querySelectorAll('.presenta-slide')];miniature=new Map(M.posizioni(D.documento).map((p,i)=>[p.slide.id,{html:viste[i]?.outerHTML||'',settings:compilata.settings}]));miniGiro++;disegnaScaletta();
 }
 function scalaMiniatura(box){const w=Number(box.dataset.larghezza)||1280;box.firstElementChild.style.transform='scale('+box.clientWidth/w+')';}
 const osservaMini=new ResizeObserver(entries=>entries.forEach(e=>scalaMiniatura(e.target)));
 function disegnaScaletta(){
  const d=D.documento,p=posizione();if(!d){scaletta.replaceChildren();scalettaFirma='';return;}const posizioni=M.posizioni(d),sig=JSON.stringify([miniGiro,posizioni.map(p=>[p.slide.id,p.slide.title,p.v])]);
  if(sig!==scalettaFirma&&!trascinaSlide){osservaMini.disconnect();scaletta.replaceChildren();const nuova=testoBottone('+ SLIDE',null,()=>aggiungi('aggiungiSlide','destra'));nuova.setAttribute('aria-label','Nuova slide');scaletta.append(nuova);
   for(const pos of posizioni){
    const nome=(pos.h+1)+(pos.v?'.'+pos.v:'')+' · '+(pos.slide.title||'Senza titolo'),bt=b(nome,null,()=>scegliSlide(pos.slide.id));bt.classList.add('presenta-slide-mini');bt.dataset.slideId=pos.slide.id;bt.dataset.verticale=String(pos.v>0);bt.draggable=true;bt.setAttribute('aria-keyshortcuts','Shift+F10');bt.title=nome+(pos.v?' · Approfondimento':' · Il trascinamento sposta anche gli approfondimenti');
    const mini=E('div',null,'presenta-mini'),v=miniature.get(pos.slide.id),scena=E('div',null,'presenta-mini-scena');mini.setAttribute('aria-hidden','true');mini.dataset.larghezza=v?.settings.width||1280;mini.style.aspectRatio=(v?.settings.width||1280)+' / '+(v?.settings.height||720);scena.style.width=(v?.settings.width||1280)+'px';scena.style.height=(v?.settings.height||720)+'px';scena.dataset.tema=v?.settings.theme||'zaino-light';
    if(v){scena.innerHTML=v.html;for(const e of scena.querySelectorAll('audio,video'))e.replaceWith(E('span',e.tagName==='AUDIO'?'Audio':'Video'));for(const e of scena.querySelectorAll('a,button,input'))e.tabIndex=-1;}
    else scena.append(E('h2',pos.slide.title));mini.append(scena);bt.replaceChildren(mini,E('span',nome,'presenta-mini-numero'));bt.oncontextmenu=e=>{e.preventDefault();menuSlide(pos.slide.id,e.clientX,e.clientY);};bt.onkeydown=e=>{if(e.key==='ContextMenu'||e.shiftKey&&e.key==='F10'){e.preventDefault();const r=bt.getBoundingClientRect();menuSlide(pos.slide.id,r.left,r.bottom);}};
    bt.ondragstart=e=>{trascinaSlide=pos.slide.id;e.dataTransfer.setData('application/x-studia-slide',JSON.stringify({documento:d.id,slide:pos.slide.id}));e.dataTransfer.effectAllowed='move';};bt.ondragover=e=>{if(!trascinaSlide)return;e.preventDefault();e.dataTransfer.dropEffect='move';bt.dataset.destinazione='true';};bt.ondragleave=()=>delete bt.dataset.destinazione;
    bt.ondrop=e=>{if(!trascinaSlide)return;e.preventDefault();e.stopPropagation();const da=trascinaSlide;trascinaSlide='';delete bt.dataset.destinazione;azione(()=>modifica({tipo:'riordinaSlide',slideId:da,destinazione:pos.slide.id,dopo:e.clientY>bt.getBoundingClientRect().top+bt.clientHeight/2},{struttura:true}));};bt.ondragend=()=>{trascinaSlide='';disegnaScaletta();};scaletta.append(bt);osservaMini.observe(mini);
   }scalettaFirma=sig;
  }
  for(const bt of scaletta.querySelectorAll('button')){bt.disabled=occupato||D.bloccato; if(bt.dataset.slideId)bt.setAttribute('aria-pressed',String(bt.dataset.slideId===p?.slide.id));}
 }
 function menuSlide(id,x,y){
  scegliSlide(id);const p=posizione(),bar=E('div',null,'presenta-voci-menu');
  const voce=(nome,icona,fn,disabilitato=false)=>{const bt=testoBottone(nome,icona,()=>{menuAperto?.hidePopover();return fn();});bt.disabled=disabilitato;bar.append(bt);};
  voce('Nuova slide','plus',()=>aggiungi('aggiungiSlide','destra'));voce('Nuovo approfondimento','arrow-down',()=>aggiungi('aggiungiSlide','sotto'));voce('Duplica slide','copy',()=>aggiungi('duplicaSlide',p.v?'sotto':'destra'));
  voce('Copia stile','copy',()=>{stileCopiato=M.stileSlide(posizione().slide);});voce('Incolla stile','palette',()=>op({tipo:'incollaStile',stile:stileCopiato},{struttura:true}),!stileCopiato);voce('Stato successivo animato','layers',()=>aggiungi('statoSuccessivo',p.v?'sotto':'destra'));voce('Sposta prima','chevron-up',()=>sposta(-1),p.v?p.v===1:p.h===0);voce('Sposta dopo','chevron-down',()=>sposta(1),p.v?p.v===p.stack.slides.length-1:p.h===D.documento.stacks.length-1);voce('Elimina slide','trash-2',()=>{if(confirm('Eliminare questa slide? Puoi ripristinarla con Annulla.'))op({tipo:'eliminaSlide'},{struttura:true});},M.posizioni(D.documento).length===1);popup('',bar,x,y);
 }
 function nascondiBubble(){bubble?.remove();bubble=null;}
 function menuOggetto(o){
  nascondiBubble();if(!posizione()?.slide.blocks.some(b=>b.id===o.blockId))return;scegliBlocco(o.blockId);const bar=E('div',null,'tbar'),voce=(nome,icona,fn)=>bar.append(b(nome,icona,()=>{nascondiBubble();return fn();}));
  voce('Adatta riquadro al contenuto','maximize',()=>frame.contentWindow.postMessage({presenta:canale,tipo:'adatta',blockId:o.blockId},'*'));voce('Centra nella slide','move-horizontal',()=>posiziona('centro-centro'));voce('Duplica oggetto','copy',()=>{const d=op({tipo:'duplicaBlocco',blockId:o.blockId},{struttura:true});scegliBlocco(M.trova(d,slideId).slide.blocks.at(-1).id);});voce('Porta avanti','chevron-up',()=>muoviBlocco(o.blockId,1));voce('Porta indietro','chevron-down',()=>muoviBlocco(o.blockId,-1));voce('Elimina oggetto','trash-2',()=>op({tipo:'eliminaBlocco',blockId:o.blockId},{struttura:true}));
  const r=frame.getBoundingClientRect(),a=o.rect;bubble=popup('presenta-bubble',bar,r.left+(a?.x||8),r.top+(a?.y||0)-38,true);
 }
 function campiSlide(){
  const aperti=[...campi.querySelectorAll('details[open]')].map(e=>e.dataset.pannello);campi.replaceChildren();const p=posizione();if(!p)return;slideId=p.slide.id;const s=p.slide;if(bloccoId!=='@titolo'&&!s.blocks.some(b=>b.id===bloccoId))bloccoId='';
  const block=s.blocks.find(b=>b.id===bloccoId),titolo=block?.type==='title'||bloccoId==='@titolo',props=E('div',null,'presenta-proprieta-foglio');props.dataset.voce=titolo?'titolo':block?.type||'sfondo';
  if(titolo){const contenuto=E('section');contenuto.append(campo('Titolo della slide',s.title,v=>{const virtuale=bloccoId==='@titolo';op({tipo:'titoloSlide',title:v});if(virtuale){campiSlide();const input=campi.querySelector('[aria-label="Titolo della slide"]');input?.focus();input?.setSelectionRange(v.length,v.length);}},{maxLength:140}));if(block)bloccoCampi(block,contenuto);props.append(contenuto);}
  else if(block){const contenuto=E('section');bloccoCampi(block,contenuto);props.append(contenuto);}
  else{
   const sfondo=E('section');sfondo.append(sceltaColore('Sfondo della slide',s.background,v=>op({tipo:'slide',background:v},{struttura:true})));props.append(sfondo);
   const disposizione=E('section');disposizione.append(E('h3','Disposizione','presenta-sezione'),modelli());props.append(disposizione);
  }
  if(block){const pos=E('section'),grid=E('div',null,'presenta-posizioni');grid.setAttribute('role','group');grid.setAttribute('aria-label','Posizione sulla slide');pos.append(E('h3','Posizione sulla slide','presenta-sezione'));for(const v of ['alto','centro','basso'])for(const h of ['sinistra','centro','destra'])grid.append(b(({alto:'Alto',centro:'Centro',basso:'Basso'})[v]+' '+h,null,()=>posiziona(v+'-'+h)));grid.title='Oppure trascina il riquadro. Frecce per spostare, Maiusc per un passo maggiore, Alt + frecce per ridimensionare.';pos.append(grid);props.append(pos);}
  campi.append(props);for(const key of aperti){const el=campi.querySelector('details[data-pannello="'+key+'"]');if(el)el.open=true;}oggetti();
 }
 function bloccoCampi(block,destinazione){
  const box=E('section',null,'presenta-blocco-editor');box.dataset.blockId=block.id;
  const patch=v=>cambiaBlocco(block.id,v),s=posizione().slide;
  if(block.type==='text')box.append(campo('Testo · Markdown e formule',block.markdown,v=>patch({markdown:v}),{tipo:'textarea',maxLength:100000}));
  else if(block.type==='title'){}
  else if(block.type==='math')box.append(campo('Formula · LaTeX',block.latex,v=>patch({latex:v}),{tipo:'textarea',maxLength:20000}));
  else if(block.type==='list')box.append(campo('Elenco · una voce per riga',block.items.map(i=>i.markdown).join('\n'),v=>{
   const corrente=posizione().slide.blocks.find(b=>b.id===block.id);patch({items:v.split('\n').map((markdown,i)=>({id:corrente.items[i]?.id||crypto.randomUUID(),markdown}))});
  },{tipo:'textarea',maxLength:100000}));
  else{
   if(block.type==='image')box.append(campo('Descrizione dell’immagine',block.alt,v=>patch({alt:v}),{maxLength:2000}));
   box.append(campo('Didascalia',block.caption,v=>patch({caption:v}),{maxLength:10000}));
  }
  const details=E('details'),summary=E('summary','Animazioni avanzate'),props=E('div',null,'presenta-proprieta');details.append(summary,props);
  details.dataset.pannello='oggetto';
  const stile=(k,v)=>{const corrente=posizione().slide.blocks.find(b=>b.id===block.id);patch({style:{...corrente.style,[k]:v}});};
  const visibili=E('div',null,'presenta-proprieta');
  visibili.append(campo('Dimensione testo',block.style?.fontSize||(block.type==='title'?54:32),v=>stile('fontSize',Number(v)),{tipo:'number',min:12,max:160}),campo('Allineamento del testo',block.style?.align||'left',v=>stile('align',v),{opzioni:[['left','Sinistra'],['center','Centro'],['right','Destra']]}),campo('Posizione nel riquadro',block.style?.verticalAlign||'center',v=>stile('verticalAlign',v),{opzioni:[['start','In alto'],['center','Al centro'],['end','In basso']]}));box.append(visibili);box.append(sceltaColore('Colore del testo',block.style?.color,v=>{const corrente=posizione().slide.blocks.find(b=>b.id===block.id),style={...corrente.style};if(v)style.color=v;else delete style.color;patch({style});campiSlide();},{automatico:true}));

  const actions=E('div');for(const a of s.animations.filter(a=>a.targetId===block.id)){
   const row=E('div',null,'presenta-azione'),aggiorna=patch=>{const animations=posizione().slide.animations.map(x=>x.targetId===a.targetId&&x.step===a.step?{...x,...patch}:x);op({tipo:'animazioni',animations},{struttura:true});};
   row.append(campo('Passaggio',a.step,v=>aggiorna({step:Number(v)}),{tipo:'number',min:1,max:1000}),campo('Effetto',a.effect,v=>aggiorna({effect:v}),{opzioni:Object.entries(M.EFFETTI)}),b('Rimuovi effetto','x',()=>op({tipo:'animazioni',animations:posizione().slide.animations.filter(x=>!(x.targetId===a.targetId&&x.step===a.step))},{struttura:true})));actions.append(row);
  }actions.append(b('Aggiungi passaggio','plus',()=>{const animations=posizione().slide.animations;op({tipo:'animazioni',animations:[...animations,{targetId:block.id,step:Math.max(0,...animations.map(a=>a.step))+1,effect:'fade-in'}]},{struttura:true});}));details.append(actions);box.append(details);destinazione.append(box);
 }
 function muoviBlocco(id,delta){const s=posizione().slide,index=s.blocks.findIndex(b=>b.id===id)+delta;if(index<0||index>=s.blocks.length)return;op({tipo:'spostaBlocco',blockId:id,index},{struttura:true});}
 function aggiungi(tipo,direzione){const prima=new Set(M.posizioni(D.documento).map(p=>p.slide.id));op({tipo,direzione},{struttura:true,seleziona:d=>M.posizioni(d).find(p=>!prima.has(p.slide.id)).slide.id});scegliBlocco('@titolo');}
 function sposta(delta){const p=posizione();if(p.v===0){if(p.h+delta<0||p.h+delta>=D.documento.stacks.length)return;op({tipo:'spostaArgomento',delta},{struttura:true});}
  else{const index=p.v+delta;if(index<1||index>=p.stack.slides.length)return;op({tipo:'spostaSlide',stackId:p.stack.id,index},{struttura:true});}}
 async function ricaricaLista(){const z=corso,n=++giro;if(!z)return;const r=await call({azione:'elenco'},z);if(n!==giro||z!==corso)return;elenco=r.elenco;disegna();}
 async function carica(d){selezioneGiro++;bloccoId='';richiestaMisure=null;D.apri(d);slideId=d.stacks[0].slides[0].id;bloccoId=d.stacks[0].slides[0].blocks.find(b=>b.type==='title')?.id||'@titolo';miniature.clear();scalettaFirma='';firma='';quadro=null;campiSlide();disegna();}
 async function apri(id){if(occupato)return;const z=corso;occupato=true;disegna();try{await D.flush();if(z!==corso)return;const r=await call({azione:'apri',id},z);if(z!==corso)return;
  await carica(r.documento);const b=r.bozza;if(b&&b.baseRevision===r.documento.revision&&JSON.stringify(b.documento)!==JSON.stringify(r.documento)&&confirm('È disponibile una bozza non salvata di questa presentazione. Recuperarla?')){D.recupera(b.documento);campiSlide();disegna();}
  await ricaricaLista();
 }finally{occupato=false;disegna();}}
 async function nuova(){if(occupato)return;const title=await window.askText('Titolo della presentazione','Nuova presentazione');if(title===null)return;if(!title.trim())throw Error('Scrivi un titolo.');const z=corso;occupato=true;disegna();try{await D.flush();if(z!==corso)return;const r=await call({azione:'crea',title:title.trim()},z);if(z!==corso)return;await carica(r.documento);await ricaricaLista();}finally{occupato=false;disegna();}}
 async function pronta(){const z=corso,id=D.documento?.id;if(!id)throw Error('Crea o apri una presentazione.');await D.flush();if(z!==corso||id!==D.documento?.id)throw Error('La presentazione è cambiata durante il salvataggio. Ripeti il comando.');return {d:D.documento,z};}
 async function rinomina(){const t=await askText('Titolo della presentazione',D.documento.title);if(t!==null){modifica({tipo:'titolo',title:t.trim()});await D.flush();await ricaricaLista();}}
 async function chiudi(){selezioneGiro++;await D.flush();await call({azione:'lascia'});D.svuota();slideId='';previewGiro++;firma='';quadro=null;frame.contentWindow.postMessage({presenta:canale,tipo:'quadro',documento:{html:'',settings:{width:1280,height:720,theme:'zaino-light',navigationMode:'default'}}},'*');campiSlide();disegna();}
 async function elimina(){if(!confirm('Spostare questa presentazione e i suoi media nel Cestino di sistema?'))return;const {d,z}=await pronta();await call({azione:'lascia'},z);await call({azione:'elimina',id:d.id},z);if(z!==corso)return;D.svuota();await ricaricaLista();}
 async function importa(trasporto){
  if(typeof trasporto==='string')trasporto=JSON.parse(trasporto);
  if(!D.documento)throw Error('Crea o apri prima una presentazione.');const z=corso,id=D.documento.id,sid=posizione().slide.id,n=selezioneGiro;
  await D.flush();const r=await call({azione:'materiale',id,trasporto,baseRevision:D.documento.revision},z);
  if(z!==corso||id!==D.documento?.id||sid!==posizione()?.slide.id||n!==selezioneGiro)throw Error('La slide è cambiata durante il caricamento. Ripeti l’inserimento.');
  const doc=op({tipo:'inserisciBlocco',block:r.block,...(r.asset?{asset:r.asset,assetId:r.assetId}:{})},{struttura:true});scegliBlocco(M.trova(doc,sid).slide.blocks.at(-1).id);
 }
 async function scegliMateriale(){
  const voci=[];for(const e of (window.vault.evidenze.leggi(corso)?.evidenze||[]).filter(e=>window.kwEParolaChiave(e)))voci.push({label:'Parola · '+(e.exact||e.id).slice(0,80),t:LimModello.trasporto('keyword',e.id,corso)});
  for(const e of window.vault.album.elenco(corso)?.voci||[])voci.push({label:'Immagine · '+(e.didascalia||e.titolo||e.title||e.id),t:LimModello.trasporto('album',e.id,corso)});
  const media=await window.vault.media.elenco(corso);for(const e of Array.isArray(media)?media:media?.elenco||[])voci.push({label:(e.tipo==='audio'?'Audio':'Video')+' · '+(e.nome||e.name||e.file),t:{version:1,tipo:e.tipo,file:e.file||e.nome||e.name,corso}});
  if(!voci.length){window.toast?.('Non ci sono ancora parole chiave o media in questo zaino.',false);return;}
  const scelta=await new Promise(resolve=>{
   const dialog=E('dialog',null,'lim-menu presenta-materiali'),bar=E('div',null,'tbar'),title=E('strong','Inserisci dallo zaino');let scelta=null;
   bar.append(title,E('span',null,'tbspazio'),b('Chiudi inserimento','x',()=>dialog.close()));dialog.append(bar);
   for(const [i,v]of voci.entries()){const button=E('button',v.label,'lim-menu-voce');button.type='button';button.onclick=()=>{scelta=i;dialog.close();};dialog.append(button);}
   dialog.addEventListener('close',()=>{dialog.remove();resolve(scelta);},{once:true});document.body.append(dialog);dialog.showModal();
  });if(scelta!==null)await importa(voci[scelta].t);
 }
 async function presenta(){const {d,z}=await pronta();if(regia?.stato.presentationId===d.id&&regia.stato.documentRevision===d.revision){await sessione('mostra');return;}const r=await call({azione:'presenta',id:d.id,baseRevision:d.revision},z);regia=r.regia;disegnaGobbo();}
 async function sessione(comando,extra={}){if(!regia)throw Error('Avvia prima una presentazione.');const r=await call({azione:'sessione',sessionId:regia.stato.sessionId,comando,...extra});regia=r.regia;disegnaGobbo();}
 function disegnaGobbo(){
  if(!gobbo)return;window.bancoAggiornaDocumenti?.();const r=regia;gobboCorpo.replaceChildren();
  for(const e of gobboBar.querySelectorAll('button,select'))e.disabled=!r;
  if(!r){$('gobboTempo').textContent='00:00';gobboStato.textContent='Le note restano private.';gobboCorpo.append(E('h2','GOBBO','gobbo-titolo'),E('p','Avvia la presentazione da PRESENTA. Qui compariranno le note della slide proiettata e i comandi del relatore.','presenta-aiuto'));return;}
  const s=r.stato;gobboStato.textContent='Slide '+(s.h+1)+(s.v?'.'+s.v:'')+' · '+(s.fragmentIndex<0?'Inizio slide':'Passaggio '+(s.fragmentIndex+1))+' · Revisione '+s.documentRevision;
  const seconds=Math.floor(s.timer.elapsedMs/1000);$('gobboTempo').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
  gobboCorpo.append(E('h2',r.title||'Senza titolo','gobbo-titolo'),E('p',r.notes.markdown||'Nessun appunto per questa slide.','gobbo-note'),E('p','Prossimo avanzamento: '+(r.prossimo==='passaggio'?'passaggio animato.':'slide.'),'presenta-aiuto'));
  const sel=$('gobboSchermi'),sig=JSON.stringify(r.schermi);if(sel.dataset.firma!==sig){sel.replaceChildren(...r.schermi.map(d=>new Option(d.nome,String(d.id))));sel.dataset.firma=sig;}sel.value=String(r.schermo);
 }
 function sidebar(){
  const old=$('zs-presenta');old?.remove();const nav=$('zainoNav');if(!nav||nav.hidden||nav.dataset.zaino!==corso||!elenco.length)return;
  const section=E('section',null,'zs-raccolta');section.id='zs-presenta';const head=E('div',null,'zs-tit'),title=E('span','PRESENTA'),ul=E('ul');head.append(title);section.append(head,ul);
  for(const d of elenco){const li=E('li',null,'zs-item'),button=E('button',d.title);button.type='button';button.title=d.title;if(D.documento?.id===d.id)button.classList.add('attivo');button.onclick=()=>azione(async()=>{bancoMostra('presenta');await apri(d.id);});li.append(button);ul.append(li);}nav.append(section);
 }
 async function contesto(){
  const z=window.zainoAttivo?.()||'';if(z===corso)return;
  if(D.sporco||D.salvando)throw Error('Salva la presentazione prima di cambiare zaino.');
  if(corso)await call({azione:'lascia'});corso=z;giro++;selezioneGiro++;previewGiro++;clearTimeout(previewTimer);D.svuota();elenco=[];slideId='';regia=null;listaErrore='';firma='';quadro=null;campiSlide();disegna();
  if(!z)return;await ricaricaLista();let m;try{m=JSON.parse(localStorage.getItem(memoria())||'null');}catch(_){}
  if(m&&elenco.some(d=>d.id===m.id)){await apri(m.id);if(M.posizioni(D.documento).some(p=>p.slide.id===m.slideId))scegliSlide(m.slideId);}
 }
 function molla(){if(D.sporco||D.salvando){window.toast?.('La presentazione contiene modifiche da salvare.',false);return false;}D.svuota();slideId='';regia=null;return true;}
 function monta(){
  host=$('presentaPane');gobbo=$('gobboPane');if(!host||!gobbo)return;
  bar=E('div',null,'tbar presenta-bar');const sel=E('select');sel.id='presentaDocumenti';sel.setAttribute('aria-label','Apri presentazione');sel.onchange=()=>azione(()=>sel.value?apri(sel.value):chiudi());bar.append(sel);
  bar.append(b('Nuova presentazione','plus',nuova,'nuova'),b('Rinomina presentazione','pencil',rinomina,'rinomina'),b('Salva presentazione','save',()=>D.flush(),'salva'),E('span',null,'tbsep'),
   b('Annulla nella presentazione','undo-2',()=>{D.annulla();campiSlide();disegna();},'annulla'),b('Ripeti nella presentazione','redo-2',()=>{D.ripeti();campiSlide();disegna();},'ripeti'),E('span',null,'tbsep'),
   b('Presenta a schermo intero','play',presenta,'presenta'),b('Apri GOBBO',null,()=>bancoMostra('gobbo'),'gobbo'),
   b('Esporta presentazione HTML','file-down',async()=>{const {d,z}=await pronta();const r=await call({azione:'esporta',id:d.id,baseRevision:d.revision},z);if(!r.annullato)toast('Presentazione esportata in '+r.cartella,true);},'esporta'),
   b('Elimina presentazione','trash-2',elimina,'elimina'),b('Chiudi presentazione','x',chiudi,'chiudi'));
  stato=E('div',null,'presenta-stato');stato.setAttribute('role','status');corpo=E('div',null,'presenta-corpo');vuoto=E('div',null,'presenta-vuoto');vuoto.append(E('h2','Costruisci la tua presentazione'),E('p'),b('Crea presentazione',null,nuova));
  editor=E('div',null,'presenta-editor');scaletta=E('nav',null,'presenta-scaletta');scaletta.setAttribute('aria-label','Slide della presentazione');
  const lavoro=E('div',null,'presenta-lavoro');frame=E('iframe',null,'presenta-anteprima');frame.title='Anteprima della slide';frame.setAttribute('sandbox','allow-scripts');call({azione:'frame'}).then(r=>{frame.src=r.url;}).catch(e=>window.toast?.(e.message,false));
  campi=E('div',null,'presenta-campi');avviso=E('p',null,'presenta-aiuto');avviso.setAttribute('role','status');avviso.hidden=true;oggettiNav=E('div',null,'tbar presenta-tabs');oggettiNav.setAttribute('role','group');oggettiNav.setAttribute('aria-label','Impostazioni di titolo, oggetti o sfondo');lavoro.append(frame,oggettiNav,avviso,campi);const sinistra=E('aside',null,'presenta-navigazione');sinistra.append(scaletta);editor.append(sinistra,lavoro);corpo.append(vuoto,editor);host.append(bar,stato,corpo);
  bar.append(E('span',null,'tbsep'),b('Aggiungi testo','type',()=>nuovoBlocco('text'),'aggiungiTesto'),b('Aggiungi elenco','list',()=>nuovoBlocco('list'),'aggiungiElenco'),b('Aggiungi formula','plus',()=>nuovoBlocco('math'),'aggiungiFormula'),b('Inserisci dallo zaino','image',scegliMateriale,'aggiungiMateriale'));
  const note=campo('Appunti del presentatore · privati','',v=>{if(posizione())op({tipo:'slide',notes:{markdown:v}});},{tipo:'textarea',maxLength:100000});appuntiPopup=E('div',null,'popmenu presenta-menu presenta-appunti');appuntiPopup.popover='auto';appuntiPopup.append(note);host.append(appuntiPopup);bar.append(b('Appunti privati','pencil',()=>{note.querySelector('textarea').value=posizione()?.slide.notes.markdown||'';appuntiPopup.showPopover();}));
  fetch(new URL('assets/presentazioni/deck.css',document.baseURI)).then(r=>r.text()).then(css=>{const style=E('style');style.textContent='@scope (.presenta-mini) {'+css+'}';document.head.append(style);}).catch(e=>window.toast?.('Anteprime: '+e.message,false));
  corpo.addEventListener('scroll',nascondiBubble);window.addEventListener('resize',nascondiBubble);document.addEventListener('pointerdown',e=>{if(bubble&&!bubble.contains(e.target))nascondiBubble();});
  window.tendinaViva?.(sel,{piccola:true,icona:'layers',fissa:'Presentazioni'});
  gobboBar=E('div',null,'tbar presenta-bar');for(const [nome,icona,cmd]of [['Indietro','chevron-left','indietro'],['Avanti','chevron-right','avanti'],['Argomento precedente','chevrons-left','argomentoPrecedente'],['Argomento successivo','chevrons-right','argomentoSuccessivo'],['Approfondisci','chevron-down','approfondisci'],['Risali','chevron-up','risali']])gobboBar.append(b(nome,icona,()=>sessione(cmd)));
  const tempo=E('output','00:00','gobbo-tempo');tempo.id='gobboTempo';tempo.setAttribute('aria-label','Tempo della presentazione');
  const schermi=E('select');schermi.id='gobboSchermi';schermi.setAttribute('aria-label','Schermo della presentazione');schermi.onchange=()=>azione(()=>sessione('schermo',{schermo:Number(schermi.value)}));
  gobboBar.append(tempo,b('Avvia timer','play',()=>sessione('timer',{timer:'avvia'})),b('Pausa timer','pause',()=>sessione('timer',{timer:'pausa'})),b('Azzera timer',null,()=>sessione('timer',{timer:'azzera'})),schermi,b('Schermo intero','maximize',()=>sessione('intero')),b('Termina presentazione','x',()=>sessione('chiudi')));
  gobboStato=E('div',null,'presenta-stato');gobboStato.setAttribute('role','status');gobboCorpo=E('div',null,'gobbo-corpo');gobbo.append(gobboBar,gobboStato,gobboCorpo);window.tendinaViva?.(schermi,{piccola:true,fissa:'Schermo'});
  host.addEventListener('keydown',e=>{if(!(e.metaKey||e.ctrlKey)||!['s','z','y'].includes(e.key.toLowerCase()))return;e.preventDefault();e.stopPropagation();azione(()=>{if(e.key.toLowerCase()==='s')return D.flush();if(e.key.toLowerCase()==='y'||e.shiftKey)D.ripeti();else D.annulla();campiSlide();disegna();});});
  host.addEventListener('dragover',e=>{if(![...e.dataTransfer.types].some(t=>['application/x-studia-lim','application/x-studia-presenta-media'].includes(t)))return;e.preventDefault();e.dataTransfer.dropEffect='copy';host.classList.add('presenta-drop');});
  host.addEventListener('dragleave',e=>{if(!host.contains(e.relatedTarget))host.classList.remove('presenta-drop');});
  host.addEventListener('drop',e=>{host.classList.remove('presenta-drop');const raw=e.dataTransfer.getData('application/x-studia-lim')||e.dataTransfer.getData('application/x-studia-presenta-media');if(!raw)return;e.preventDefault();e.stopPropagation();azione(()=>importa(JSON.parse(raw)));});
  window.addEventListener('message',e=>{if(e.source!==frame.contentWindow)return;if(e.data?.tipo==='presenta-caricato'){framePronto=true;if(quadro)frame.contentWindow.postMessage(quadro,'*');}
   else if(e.data?.presenta===canale){if(e.data.tipo==='seleziona')scegliBlocco(e.data.blockId);
    if(e.data.tipo==='menuOggetto')menuOggetto(e.data);if(e.data.tipo==='nascondiBubble')nascondiBubble();
    if(e.data.tipo==='cronologia'&&!occupato&&!D.bloccato)azione(()=>{if(e.data.comando==='salva')return D.flush();if(e.data.comando==='ripeti')D.ripeti();else if(e.data.comando==='annulla')D.annulla();campiSlide();disegna();});
    if(['geometria','misure'].includes(e.data.tipo))azione(()=>{
     const o=e.data,s=posizione()?.slide;if(!s||o.slideId!==s.id||o.firma!==quadro?.editor?.firma||firma!==JSON.stringify({...D.documento,revision:0})){firma='';anteprima();return;}
     let boxes=o.boxes;
     if(o.tipo==='misure'){const r=richiestaMisure;if(!r||r.id!==o.richiesta||r.slideId!==s.id)return;richiestaMisure=null;if(r.nome!=='conserva')boxes=boxes.map(v=>v.id===r.blockId?{...v,box:M.ancora(v.box,r.nome)}:v);}
     if(occupato||D.bloccato)return;try{op({tipo:'posizionaBlocchi',boxes},{struttura:true});}catch(e){firma='';anteprima();throw e;}
    });if(e.data.tipo==='pronto'){if(richiestaMisure)frame.contentWindow.postMessage({presenta:canale,tipo:'misure',richiesta:richiestaMisure.id},'*');avviso.hidden=!e.data.overflow;avviso.textContent='Parte del contenuto non entra nella slide o nel riquadro: allarga il riquadro, riduci il testo o dividi la slide.';}if(e.data.tipo==='errore')window.toast?.('Anteprima: '+e.data.error,false);if(e.data.tipo==='pronto'&&e.data.errors?.length)window.toast?.('Ci sono formule da correggere nella slide.',false);}});
  window.ZainoPresenta={nuova,apri,flush:()=>D.flush(),molla,importa,modifica,chiudi,presenta,get documento(){return D.documento;},get daSalvare(){return D.sporco||D.salvando;},get regia(){return regia;}};
  api.onCambiata(o=>{if(o.corso===corso)azione(ricaricaLista);});api.onSessione(o=>{regia=o.regia;if(regia?.corso!==corso)regia=null;disegnaGobbo();});
  api.onChiudi(o=>azione(async()=>{try{await D.transizione(()=>{});await api.comando({azione:'chiusuraPronta',id:o.id});}catch(e){await api.comando({azione:'chiusuraPronta',id:o.id,errore:true});throw e;}}));
  window.addEventListener('studia:zaino-changed',()=>azione(contesto));window.addEventListener('studia:sidebar-updated',sidebar);
  window.addEventListener('banco-layout',()=>{if(window.bancoVisibile?.('presenta'))azione(async()=>{await contesto();anteprima();});});
  window.addEventListener('beforeunload',e=>{if(D.sporco||D.salvando){e.preventDefault();e.returnValue=false;azione(()=>D.flush());}});
  window.addEventListener('blur',()=>{if(D.sporco)azione(()=>D.flush());});
  setInterval(()=>{if(regia&&window.bancoVisibile?.('gobbo'))azione(async()=>{const r=await call({azione:'regia'});regia=r.regia;disegnaGobbo();});},1000);
  api.comando({azione:'editorPronto'});azione(contesto);disegna();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',monta);else monta();
})();
