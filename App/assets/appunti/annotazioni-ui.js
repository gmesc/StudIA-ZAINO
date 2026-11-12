/* Compositore inline: una bozza per banco, confermata in un solo passo Undo.
 * Il Markdown e le versioni già salvate non cambiano durante il disegno. */
(function(){
 'use strict';
 const sessioni=new Map(),M=AppuntiAnnotazioni;
 const E=(t,cls)=>{const e=document.createElement(t);if(cls)e.className=cls;return e;};
 const datiUrl=b=>new Promise((ok,ko)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=()=>ko(Error('Impossibile preparare il disegno.'));r.readAsDataURL(b);});
 let fontAtkinson;
 async function font(){if(!fontAtkinson)fontAtkinson=fetch('assets/presentazioni/fonts/AtkinsonHyperlegible-Regular.woff2').then(r=>{if(!r.ok)throw Error('Font del disegno non disponibile.');return r.arrayBuffer();}).then(b=>datiUrl(new Blob([b],{type:'font/woff2'}))).catch(e=>{fontAtkinson=null;throw e;});return fontAtkinson;}
 async function esporta(editor,scena){
  const svg=editor.svg(),vettore=AppuntiSvg.daDOM(svg,[]);
  if(scena.segni.some(s=>PdfAnnotazioni.haTesto(s)&&s.fontUi==='atkinson'))vettore.fonts.push({family:'Atkinson Hyperlegible',data:await font()});
  const url=URL.createObjectURL(new Blob([AppuntiSvg.html(vettore)],{type:'image/svg+xml'}));
  try{
   const img=new Image();img.src=url;await img.decode();const canvas=document.createElement('canvas');const scala=Math.min(2,3200/Math.max(scena.larghezza,scena.altezza));canvas.width=Math.round(scena.larghezza*scala);canvas.height=Math.round(scena.altezza*scala);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
   return {png:canvas.toDataURL('image/png'),vettore,annotazioni:scena};
  }finally{URL.revokeObjectURL(url);}
 }
 function chiudi(s){const c=sessioni.get(s);if(!c)return;c.resize?.disconnect();c.smontaPagina?.();c.editor.smonta();c.host.classList.remove('note-annota-attiva');c.box.remove();c.toolbar.inert=false;c.cm.setOption('readOnly',c.readOnly);sessioni.delete(s);c.cm.refresh();c.apri.classList.remove('active');c.apri.focus({preventScroll:true});}
 function aperta(s){return sessioni.has(s);}
 function primaDiUscire(s){const c=sessioni.get(s);if(!c)return true;if(c.busy||JSON.stringify(c.editor.segni())!==c.originale){toast('Applica o annulla il disegno prima di cambiare appunto.',false);return false;}chiudi(s);return true;}
 function apri({s,scena=M.vuoto(),verifica,conferma,ancora=0,figura,preview,impaginazione}){
  const esistente=sessioni.get(s);if(esistente){esistente.foglio.querySelector('svg')?.focus();return;}
  scena=M.valida(scena);const host=noteHost(s),toolbar=host.querySelector('.editor-toolbar'),apri=toolbar.querySelector('.ncb-disegno'),cm=s.mde.codemirror;
  const box=E('section','note-annota'),bar=E('div','tbar pdf-segni-bar note-annota-bar'),frame=E('div','note-annota-frame'),foglio=E('div','note-annota-foglio'),errore=E('output','note-annota-errore'),lettura=E('div','md-prev note-annota-testo');
  box.setAttribute('aria-label','Annota l’appunto');bar.setAttribute('aria-label','Strumenti di annotazione');errore.setAttribute('role','status');foglio.style.aspectRatio=scena.larghezza+'/'+scena.altezza;
  // Copia di sola lettura dello stesso testo renderizzato; il disegno resta
  // ancorato al paragrafo, non alle coordinate della finestra del banco.
  if(preview){
   lettura.replaceChildren(...[...preview.childNodes].map(n=>n.cloneNode(true)));
   const stile=getComputedStyle(preview);for(const k of ['fontFamily','fontSize','lineHeight','letterSpacing','paddingTop','paddingRight','paddingBottom','paddingLeft'])lettura.style[k]=stile[k];
  }else lettura.innerHTML=renderNoteMd(cm.getValue(),{mappa:true});
  lettura.querySelectorAll('input,textarea,select,button,a').forEach(e=>e.tabIndex=-1);
  let blocco=lettura.querySelector('.mdb[data-da="'+ancora+'"]');
  if(!blocco){blocco=E('div','mdb');lettura.append(blocco);}
  const riferimento=E('div','note-annota-ancora');
  const visuale=figura&&blocco.querySelector('.note-visual');
  if(visuale){visuale.style.visibility='hidden';visuale.before(riferimento);}
  else (blocco.closest('ul,ol')||blocco).before(riferimento);
  foglio.style.width=(figura?.percento||100)+'%';
  foglio.style.left=(figura?.style.x??(figura?.style.align==='right'?100-(figura.percento||100):figura?.style.align==='center'?(100-(figura.percento||100))/2:0))+'%';
  foglio.style.top=(figura?.style.y||0)+'em';riferimento.append(foglio);frame.append(lettura);box.append(bar,frame,errore);toolbar.after(box);host.classList.add('note-annota-attiva');
  frame.scrollTop=preview?.scrollTop||0;
  const c={s,host,box,toolbar,apri,cm,foglio,readOnly:cm.getOption('readOnly'),originale:JSON.stringify(scena.segni),busy:false};sessioni.set(s,c);cm.setOption('readOnly',true);toolbar.inert=true;apri.classList.add('active');
  if(impaginazione)c.smontaPagina=impaginazione.monta(frame,foglio);
  const editor=c.editor=AnnotazioniUI.monta({pane:host,frame,foglio,barra:bar,apri,viewport:M.viewport(scena),segni:scena.segni,onChange:()=>{applica.disabled=!editor.segni().length;errore.textContent='';}});
  function azione(nome,icona,fn){const b=E('button','tbtn note-annota-azione');b.type='button';b.innerHTML=UiIcone.svg(icona);const t=E('span');t.textContent=nome;b.append(t);b.title=nome;b.setAttribute('aria-label',nome);b.onclick=fn;bar.append(E('i','tbsep'),b);return b;}
  const annulla=azione('Annulla','x',()=>chiudi(s));annulla.dataset.annullaDisegno='';
  const applica=azione('Applica','save',async()=>{
   if(c.busy)return;c.busy=true;editor.blocca(true);applica.disabled=true;annulla.disabled=true;frame.inert=true;bar.querySelectorAll('[data-tool]').forEach(b=>b.disabled=true);
   try{
    await editor.pronto();verifica();const attuale=M.valida({...scena,segni:editor.segni()});if(!attuale.segni.length)throw Error('Disegna almeno un elemento.');
    const dati=await esporta(editor,attuale);verifica();const r=window.vault.disegni.salva(s.courseId,dati);if(r.error)throw Error(r.error);verifica();conferma(r.src);chiudi(s);
   }catch(e){errore.textContent=e.message;}
   finally{c.busy=false;editor.blocca(false);applica.disabled=!editor.segni().length;annulla.disabled=false;frame.inert=false;bar.querySelectorAll('[data-tool]').forEach(b=>b.disabled=false);}
  });applica.dataset.applicaDisegno='';applica.disabled=!scena.segni.length;
  // Undo nella bozza non deve ricadere sull’appunto sottostante.
  box.addEventListener('keydown',e=>{if(e.key==='Escape'&&!e.defaultPrevented){e.preventDefault();foglio.querySelector('svg')?.focus();}});
  const paddingBase=parseFloat(getComputedStyle(lettura).paddingBottom)||0;
  const misura=()=>{lettura.style.paddingBottom=paddingBase+'px';const r=lettura.getBoundingClientRect(),f=foglio.getBoundingClientRect(),scala=r.width/Math.max(1,lettura.offsetWidth),extra=(f.bottom-r.bottom)/scala;lettura.style.paddingBottom=(paddingBase+Math.max(0,extra))+'px';};
  if(!impaginazione){c.resize=new ResizeObserver(misura);c.resize.observe(foglio);misura();}
  foglio.querySelector('svg')?.focus({preventScroll:true});
 }
 window.addEventListener('beforeunload',e=>{if([...sessioni.values()].some(c=>c.busy||JSON.stringify(c.editor.segni())!==c.originale)){e.preventDefault();e.returnValue='';toast('Applica o annulla il disegno prima di chiudere.',false);}});
 window.AppuntiAnnotaUI={apri,chiudi,aperta,primaDiUscire};
}());
