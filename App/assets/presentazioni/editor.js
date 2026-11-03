(function(){
 'use strict';
 const M=window.PresentaModello,C=window.PresentaColori,api=window.vault?.presentazioni;
 if(!api||!M)return;
 const $=id=>document.getElementById(id),E=(tag,testo,classe)=>{const e=document.createElement(tag);if(testo!=null)e.textContent=testo;if(classe)e.className=classe;return e;};
 const atteseScrittura=new Map();
 let gruppo=[],grigliaAttiva=0,magnetiche=false,posizioneScelta=null,selezioneGiro=0,scrittura=null,daScrittura=false;
 let corso='',elenco=[],slideId='',giro=0,occupato=false,listaErrore='',regia=null,previewTimer=null,previewGiro=0,quadro=null,framePronto=false,firma='',canale=crypto.randomUUID();
 let inputAperto=null,ricostruisciInput=false,datiInput=null,richiestaScrittura=null,quadroVisibile=null;
 let barreAdattive=[];
 let avviso,bloccoId='',oggettiNav,richiestaMisure=null,appuntiOggetto=null;
 let host,bar,corpo,scaletta,campi,frame,stato,vuoto,editor,gobbo,gobboBar,gobboCorpo,gobboStato;
 const bottoni={},D=PresentaDocumento.crea({salva:async(d,baseRevision)=>(await call({azione:'salva',documento:d,baseRevision})).documento,
  bozza:(d,baseRevision)=>call({azione:'bozza',documento:d,baseRevision}),cambiata:()=>{if(host)disegna();}});
 async function salvaTutto(){
  const errore=inputAperto?.salva();if(errore)throw Error(errore);
  if(scrittura&&!scrittura.locale&&framePronto){const richiesta=crypto.randomUUID();await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{atteseScrittura.delete(richiesta);reject(Error('La scrittura sul foglio non risponde. La presentazione resta aperta: riprova il salvataggio.'));},4000);atteseScrittura.set(richiesta,errore=>{clearTimeout(timer);if(errore)reject(Error(errore));else resolve();});frame.contentWindow.postMessage({presenta:canale,tipo:'salvaScrittura',richiesta},'*');});}
  return D.flush();
 }
 async function call(o,z=corso){const r=await api.comando({...o,corso:z});if(!r?.ok)throw Error(r?.error||'PRESENTA non disponibile.');return r;}
 async function azione(fn){try{return await fn();}catch(e){listaErrore=e.message;disegna();window.toast?.(e.message,false);}}
 function b(nome,icona,fn,chiave){const e=E('button',null,'tbtn');e.type='button';e.title=nome;e.setAttribute('aria-label',nome);if(icona)UiIcone.imposta(e,icona);else e.textContent=nome;e.onclick=()=>azione(fn);if(chiave){e.dataset.presentaAction=chiave;bottoni[chiave]=e;}return e;}
 function campo(nome,valore,fn,{tipo='text',opzioni,maxLength,min,max,step,opzionale=false,espanso=false}={}){
  if(!espanso&&!opzioni&&['text','textarea'].includes(tipo))return campoBreve(nome,valore,fn,{tipo,maxLength});
  const label=E('label',null,'presenta-campo'),input=E(tipo==='textarea'?'textarea':opzioni?'select':'input');input.setAttribute('aria-label',nome);label.title=nome==='Allineamento del testo'?'Allinea soltanto le righe di questo oggetto, senza spostare gli altri testi.':nome==='Posizione nel riquadro'?'Posizione verticale del contenuto dentro il riquadro selezionato.':nome==='Testo · Markdown e formule'?'Testo con Markdown e formule tra delimitatori matematici.':nome;
  label.append(E('span',nome));
  if(opzioni)for(const [value,text]of opzioni)input.append(new Option(text,value));else if(tipo!=='textarea')input.type=tipo;
  if(maxLength)input.maxLength=maxLength;if(min!==undefined)input.min=min;if(max!==undefined)input.max=max;if(step!==undefined)input.step=step;
  input.value=valore??'';input.addEventListener(opzioni||['number','color'].includes(tipo)?'change':'input',()=>azione(()=>{if(tipo==='number'&&!(opzionale&&!input.value)&&(!input.value||!input.validity.valid)){input.reportValidity();return;}return fn(input.value,input);}));label.append(input);return label;
 }
 // Un solo punto di scrittura per i campi brevi: l’anteprima non ricostruisce il cursore.
 function scriviSulFoglio(id){richiestaScrittura={id,slideId,documento:D.documento.id};avviaScritturaRichiesta();}
 function avviaScritturaRichiesta(){
  if(!richiestaScrittura)return;const r=richiestaScrittura;if(r.documento!==D.documento?.id||r.slideId!==slideId||r.id!==bloccoId){richiestaScrittura=null;return;}
  if(firma!==JSON.stringify({...D.documento,revision:0})||quadroVisibile!==quadro?.editor?.firma){anteprima();return;}
  richiestaScrittura=null;frame.contentWindow.postMessage({presenta:canale,tipo:'modificaTesto',blockId:r.id},'*');
 }
 function chiudiInput(ricostruisci=true){
  if(!inputAperto)return;const errore=inputAperto.salva();if(errore)throw Error(errore);const a=inputAperto;inputAperto=null;
  if(scrittura?.locale){editorInput.termina(false);scrittura=null;}a.popup.hidePopover();a.popup.remove();if(ricostruisci){campiSlide();disegna();}
 }
 function campoBreve(nome,valore,fn,{tipo='text',maxLength}={}){
  valore=valore??'';const box=E('div',null,'presenta-campo presenta-campo-breve'),label=E('span',nome),anteprima=b(nome,null,()=>{
   chiudiInput();fineScrittura();const documento=D.documento.id,sid=slideId,bid=bloccoId,contenuto=E('div'),bar=E('div',null,'tbar'),errore=E('output',null,'presenta-stato');errore.setAttribute('role','status');
   const area=campo(nome,valore,()=>{salva();},{tipo,maxLength,espanso:true}),input=area.querySelector('input,textarea');
   function salva(){try{if(input.value===valore){errore.textContent='';return null;}if(D.documento?.id!==documento||slideId!==sid||bloccoId!==bid&&bid!=='@titolo')throw Error('La selezione è cambiata. Chiudi e riapri il campo.');if(maxLength&&input.value.length>maxLength)throw Error('Il testo supera il limite di '+maxLength+' caratteri.');if(input.value!==valore){fn(input.value,input);valore=input.value;mostra();}errore.textContent='';return null;}catch(e){errore.textContent=e.message;return e.message;}}
   bar.append(E('strong',nome),E('span',null,'tbspazio'),b('Chiudi campo','check',chiudiInput));contenuto.append(bar,area,errore);const r=anteprima.getBoundingClientRect(),pop=popup('presenta-input-popup',contenuto,r.left,r.bottom+4,true);pop.setAttribute('role','dialog');pop.setAttribute('aria-label',nome);inputAperto={popup:pop,salva,errore};input.focus();input.setSelectionRange(input.value.length,input.value.length);
  });
  function mostra(){anteprima.replaceChildren(E('span',String(valore||'').replace(/\s+/g,' ').trim()||'–','presenta-input-anteprima'));const matita=E('i');UiIcone.imposta(matita,'pencil');anteprima.append(matita);anteprima.title=nome+' · clic per modificare';anteprima.dataset.valore=valore||'';}
  mostra();box.append(label,anteprima);return box;
 }
 const editorInput=PresentaScrittura({metadati:()=>datiInput,pronto:()=>!!D.documento&&!occupato&&!D.bloccato,seleziona:()=>{},bubble:()=>{},invia:(tipo,d)=>{
  if(tipo==='errore'){if(inputAperto?.errore)inputAperto.errore.textContent=d.error;return;}
  riceviScrittura(tipo,d,true);
 }});
 async function apriInputRicco(block,anchor){
  chiudiInput();fineScrittura();const d=D.documento,sid=slideId,r=await call({azione:'vista',documento:d});if(D.documento?.id!==d.id||slideId!==sid)return;
  const contenuto=E('div'),titolo=E('div',null,'tbar'),corpo=E('div',null,'presenta-input-ricco'),testo=E('div'),errore=E('output',null,'presenta-stato');errore.setAttribute('role','status');corpo.dataset.blockId=block.id;testo.dataset.testoId=block.id;corpo.append(testo);const stile=block.style||{},sfondo=posizione().slide.background||(d.settings.theme==='zaino-dark'?'#0f1115':'#fbfbfa');corpo.style.background=sfondo;Object.assign(testo.style,{fontFamily:M.CARATTERI[stile.fontFamily||d.settings.fontFamily||'zaino'].css,fontSize:(stile.fontSize||32)+'px',fontWeight:PresentaTesto.peso(stile,400),fontStyle:stile.italic?'italic':'normal',lineHeight:stile.lineHeight||1.4,color:stile.color||M.contrasto(sfondo)});testo.style.setProperty('--sottolineato-testo',stile.underline?'underline':'none');
  datiInput={slideId:sid,firma:quadro?.editor?.firma,testi:r.documento.testi};titolo.append(E('strong','Testo'),E('span',null,'tbspazio'),b('Chiudi campo','check',chiudiInput));contenuto.append(titolo,corpo,errore);
  const rect=anchor.getBoundingClientRect(),pop=popup('presenta-input-popup',contenuto,rect.left,rect.bottom+4,true);pop.setAttribute('role','dialog');pop.setAttribute('aria-label','Modifica testo');inputAperto={popup:pop,errore,salva:()=>{const e=editorInput.salva();if(e)errore.textContent=e;return e;}};
  editorInput.avvia(testo);testo.setAttribute('aria-label','Testo nel pannello');const barra=barraScrittura();barra.querySelector('[aria-label="Termina scrittura"]').remove();contenuto.insertBefore(barra,corpo);if(scrittura?.formati)aggiornaFormatiParole(scrittura.formati);const misura=pop.getBoundingClientRect();pop.style.top=Math.max(8,Math.min(rect.bottom+4,innerHeight-misura.height-8))+'px';
 }
 function campoTestoRicco(block){
  const box=E('div',null,'presenta-campo presenta-campo-breve'),bt=b('Modifica testo',null,()=>apriInputRicco(block,bt));bt.replaceChildren(E('span',PresentaTesto.piano(block.richText)||'–','presenta-input-anteprima'));const matita=E('i');UiIcone.imposta(matita,'pencil');bt.append(matita);box.append(E('span','Testo'),bt);return box;
 }
 function riceviScrittura(tipo,o,locale=false){
  if(tipo==='inizioScrittura'){
   const s=posizione()?.slide;if(!s||o.slideId!==s.id||o.firma!==quadro?.editor?.firma||!s.blocks.some(b=>b.id===o.blockId)||occupato||D.bloccato)return;
   clearTimeout(previewTimer);previewGiro++;scrittura={...o,locale,documento:D.documento.id};if(!locale){campiSlide();menuScrittura();}
  }
  if(tipo==='formatiParole'&&scrittura?.sessione===o.sessione&&!!scrittura.locale===locale)aggiornaFormatiParole(o.formati);
  if(tipo==='testoInLinea'){
   if(!scrittura||!!scrittura.locale!==locale||o.sessione!==scrittura.sessione||o.blockId!==scrittura.blockId||o.itemId!==scrittura.itemId||o.slideId!==posizione()?.slide.id||D.documento.id!==scrittura.documento)return;
   daScrittura=true;try{op({tipo:'testoInLinea',blockId:o.blockId,itemId:o.itemId,richText:o.richText});}finally{daScrittura=false;}
  }
  if(tipo==='fineScrittura'&&scrittura?.sessione===o.sessione&&!!scrittura.locale===locale){scrittura=null;nascondiBubble();campiSlide();disegna();}
 }
 function posizione(){const d=D.documento;if(!d)return null;return M.posizioni(d).find(p=>p.slide.id===slideId)||M.posizioni(d)[0];}
 function modifica(o,{struttura=false,seleziona}={}){if(!daScrittura)fineScrittura();listaErrore='';const d=D.applica(o);if(seleziona)slideId=seleziona(d);if(bloccoId==='@titolo')bloccoId=posizione()?.slide.blocks.find(b=>b.type==='title')?.id||'@titolo';if(struttura)campiSlide();disegna();return d;}
 function op(o,opts){return modifica({slideId:posizione().slide.id,...o},opts);}
 function memoria(){return 'studia.presenta.'+corso;}
 function ricorda(){if(corso&&D.documento)try{localStorage.setItem(memoria(),JSON.stringify({id:D.documento.id,slideId}));}catch(_){}window.bancoAggiornaDocumenti?.();}
 function anteprima(){
  clearTimeout(previewTimer);if(scrittura&&!scrittura.locale)return;const d=D.documento;if(!d||!window.bancoVisibile?.('presenta'))return;
  const stamp=JSON.stringify({...d,revision:0});if(stamp===firma){vaiAnteprima();return;}const n=++previewGiro,z=corso;
  previewTimer=setTimeout(()=>azione(async()=>{const r=await call({azione:'vista',documento:d},z);if(n!==previewGiro||z!==corso||D.documento?.id!==d.id)return;
   firma=stamp;disegnaMiniature(r.documento,r.immagini);quadro={presenta:canale,tipo:'quadro',documento:r.documento,posizione:coordinate(),editor:{...metaEditor(),firma:n}};if(framePronto)frame.contentWindow.postMessage(quadro,'*');
  }),180);
 }
 function coordinate(){const p=posizione();return {h:p?.h||0,v:p?.v||0,fragmentIndex:-1};}
 function vaiAnteprima(){if(framePronto&&quadro&&(!scrittura||scrittura.locale)&&firma===JSON.stringify({...D.documento,revision:0}))frame.contentWindow.postMessage({presenta:canale,tipo:'vai',posizione:coordinate(),editor:{...quadro.editor,...metaEditor()}},'*');}
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
  if(d&&p){frame.style.aspectRatio=d.settings.width+'/'+d.settings.height;frame.dataset.sfondoBianco=String(!M.sfondoSlide(d,p.slide).backgroundMedia&&!M.sfondoSlide(d,p.slide).backgroundPattern&&C.sfondoBianco(M.sfondoSlide(d,p.slide).background,d.settings.theme));if(avviso.dataset.slideId!==p.slide.id)avviso.hidden=true;}
  disegnaScaletta();
  oggetti();ricorda();sidebar();anteprima();sincronizzaSelezione();disegnaGobbo();
 }
 function scegliSlide(id){gruppo=[];fineScrittura();nascondiBubble();selezioneGiro++;richiestaMisure=null;slideId=id;bloccoId=posizione()?.slide.blocks.find(b=>b.type==='title')?.id||'@titolo';campiSlide();disegna();vaiAnteprima();}
 function nuovoBlocco(tipo){
  const block=tipo==='shape'?{type:'shape',slot:'body',shape:'rectangle',style:{color:'#0f766e'}}:tipo==='table'?{type:'table',slot:'body',table:[['',''],['','']]}:tipo==='math'?{type:'math',slot:'formula',latex:'',display:true}:tipo==='list'?{type:'list',slot:'body',items:[]}:{type:tipo,slot:tipo==='title'?'title':'body',markdown:''};
  const d=op({tipo:'inserisciBlocco',block},{struttura:true});scegliBlocco(M.trova(d,slideId).slide.blocks.at(-1).id);campi.querySelector('.presenta-blocco-editor .presenta-campo-breve button')?.focus();
 }
 function inserisciComune(type){const d=op({tipo:'inserisciComune',type},{struttura:true});scegliBlocco(M.trova(d,slideId).slide.blocks.find(b=>b.type===type).id);}
 function cambiaBlocco(id,patch){const s=posizione().slide,b=s.blocks.find(b=>b.id===id);op({tipo:'blocco',blockId:id,block:{...b,...patch}});}
 function testoBottone(nome,icona,fn){const el=b(nome,icona,fn);if(icona)el.append(E('span',nome));return el;}
 function metaEditor(){return {areaUtile:posizione()?M.areaUtile(posizione().slide):undefined,selezionati:gruppo,griglia:grigliaAttiva,magnetiche,selezioneGiro,slideId:posizione()?.slide.id,selezionato:bloccoId,boxes:posizione()?.slide.blocks.map(b=>({id:b.id,box:b.style?.box})),bloccato:occupato||D.bloccato||firma!==JSON.stringify({...D.documento,revision:0}),colore:getComputedStyle(host).getPropertyValue('--teal-strong').trim()};}
 function sincronizzaSelezione(){if(scrittura)return;if(framePronto&&quadro)frame.contentWindow.postMessage({presenta:canale,tipo:'selezione',editor:{...quadro.editor,...metaEditor()}},'*');}
 function scegliBlocco(id){gruppo=[];if(id!==bloccoId)fineScrittura();selezioneGiro++;nascondiBubble();bloccoId=['@disposizione','@stile','@righelli'].includes(id)?id:id==='@titolo'?(posizione()?.slide.blocks.find(b=>b.type==='title')?.id||'@titolo'):posizione()?.slide.blocks.some(b=>b.id===id)?id:'';campiSlide();disegna();sincronizzaSelezione();}
 function posiziona(nome){
  if(!bloccoId&&nome!=='conserva')return;const s=posizione().slide;if(s.layout==='free'&&s.blocks.every(b=>b.style?.box)){op({tipo:'posizionaBlocchi',boxes:s.blocks.map(b=>({id:b.id,box:b.id===bloccoId?ancoraScelta(b.style.box,nome):b.style.box}))},{struttura:true});return;}richiestaMisure={id:crypto.randomUUID(),slideId:posizione().slide.id,blockId:bloccoId,nome};frame.contentWindow.postMessage({presenta:canale,tipo:'misure',richiesta:richiestaMisure.id},'*');
 }
 function ancoraScelta(box,nome){const block=posizione().slide.blocks.find(b=>b.id===bloccoId),area=M.comune(block)?undefined:M.areaUtile(posizione().slide);return typeof nome==='string'?M.ancora(box,nome,area):M.ancoraGriglia(box,nome,area);}
 function comandoPosizione(block){
  const box=E('div',null,'presenta-campo presenta-posizione-campo'),bt=b('Posizione',null,()=>{
   const r=bt.getBoundingClientRect(),pop=popup('presenta-posizione-popup tbar-ctl',pannelloPosizione(block),r.left,r.bottom+4);pop.setAttribute('role','dialog');pop.setAttribute('aria-label','Posizione dell’oggetto');bt.setAttribute('aria-expanded','true');
   pop.addEventListener('toggle',e=>{if(e.newState==='closed'){const attuale=campi.querySelector('[aria-label="Posizione"]');attuale?.setAttribute('aria-expanded','false');if(document.activeElement===document.body)attuale?.focus({preventScroll:true});}});
   (pop.querySelector('[data-cella][aria-pressed=true]')||pop.querySelector('[data-cella]'))?.focus({preventScroll:true});
  });
  bt.innerHTML='<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><rect x="3" y="3" width="18" height="18"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>';bt.append(E('span','▾'));bt.title='Posiziona l’oggetto sulla slide';bt.setAttribute('aria-haspopup','dialog');bt.setAttribute('aria-expanded',String(!!host.querySelector('.presenta-posizione-popup:popover-open')));box.append(E('span','Posizione'),bt);return box;
 }
 function pannelloPosizione(block){
  const documentoId=D.documento.id,sid=slideId,pos=E('section',null,'presenta-posizione-compatta'),grid=E('div',null,'presenta-posizioni'),n=M.righelli(grigliaAttiva).divisioni;
  pos.append(E('h3','Posizione','presenta-sezione'));grid.setAttribute('role','group');grid.setAttribute('aria-label','Posizione sulla slide');grid.dataset.divisioni=n;grid.style.setProperty('--divisioni',n);
  const corrente=()=>posizione().slide.blocks.find(b=>b.id===block.id)?.style?.box,corrisponde=posizioneScelta?.blockId===block.id&&posizioneScelta?.slideId===slideId&&posizioneScelta?.n===n&&posizioneScelta?.firma===JSON.stringify(corrente());
  let selezione=corrisponde?posizioneScelta.scelta:null;
  if(!selezione&&corrente())for(let r=0;r<n;r++)for(let c=0;c<n;c++){const a=M.ancoraGriglia(corrente(),{divisioni:n,riga:r,colonna:c},M.comune(block)?undefined:M.areaUtile(posizione().slide));if(Math.abs(a.x-corrente().x)<.1&&Math.abs(a.y-corrente().y)<.1)selezione={riga:r,colonna:c};}
  const celle=[];function colora(scelta,hover=false){const ids=scelta?M.cellePosizione(n,scelta):[];celle.forEach((b,i)=>{if(hover)b.dataset.hover=String(ids.includes(i));else b.setAttribute('aria-pressed',String(ids.includes(i)));});}
  function scegli(riga,colonna){if(D.documento?.id!==documentoId||slideId!==sid||bloccoId!==block.id){menuAperto?.hidePopover();return;}const scelta={divisioni:n,riga,colonna};posiziona(scelta);selezione={riga,colonna};posizioneScelta={slideId,blockId:block.id,n,scelta:selezione,firma:JSON.stringify(corrente())};colora(selezione);}
  function intestazione(nome,riga,colonna,simbolo){const bt=b(nome,null,()=>scegli(riga,colonna));bt.classList.add('presenta-posizione-asse');bt.textContent=simbolo;bt.onpointerenter=()=>colora({riga,colonna},true);bt.onfocus=bt.onpointerenter;bt.onpointerleave=()=>colora(null,true);bt.onblur=bt.onpointerleave;return bt;}
  grid.append(E('span',null,'presenta-posizione-angolo'));for(let c=0;c<n;c++)grid.append(intestazione('Colonna '+(c+1),null,c,'↕'));
  const nomiRiga=['Alto','Centro','Basso'],nomiCol=['sinistra','centro','destra'];
  for(let r=0;r<n;r++){
   grid.append(intestazione('Riga '+(r+1),r,null,'↔'));
   for(let c=0;c<n;c++){
    const nome=n===3?nomiRiga[r]+' '+nomiCol[c]:'Riga '+(r+1)+' · colonna '+(c+1),bt=b(nome,null,()=>scegli(r,c));bt.replaceChildren();bt.dataset.cella=r*n+c;bt.onpointerenter=()=>colora({riga:r,colonna:c},true);bt.onfocus=bt.onpointerenter;bt.onpointerleave=()=>colora(null,true);bt.onblur=bt.onpointerleave;celle.push(bt);grid.append(bt);
   }
  }
  colora(selezione);pos.append(grid);return pos;
 }
 function cambiaRighelli(){const valori=[0,2,3,4];grigliaAttiva=valori[(valori.indexOf(grigliaAttiva)+1)%valori.length];posizioneScelta=null;aggiornaRighelli();}
 function aggiornaRighelli(){frame.contentWindow.postMessage({presenta:canale,tipo:'guide',griglia:grigliaAttiva,magnetiche},'*');campiSlide();disegna();}
 function pannelloRighelli(){
  const box=E('section',null,'presenta-righelli tbar-ctl'),ciclo=testoBottone('Cambia griglia di riferimento','ruler',cambiaRighelli),aggancio=testoBottone('Guide magnetiche','move-horizontal',()=>{magnetiche=!magnetiche;aggiornaRighelli();});
  ciclo.querySelector('span').textContent=grigliaAttiva?'Griglia '+grigliaAttiva+'×'+grigliaAttiva:'Righelli spenti';ciclo.title='Ciclo: spenti, 2×2, 3×3, 4×4';ciclo.setAttribute('aria-pressed',String(!!grigliaAttiva));aggancio.setAttribute('aria-pressed',String(magnetiche));aggancio.title='Aggancia margini, centri e griglia attiva durante il trascinamento. Alt sospende l’aggancio.';box.append(ciclo,aggancio);return box;
 }
 function modello(nome){const s=posizione().slide;op({tipo:'posizionaBlocchi',boxes:M.disponi(s,nome)},{struttura:true});}
 // Miniature illustrative: immagine e testo mostrano il risultato senza didascalie esterne.
 function campioneLayout(nome='image-left'){
  const mini=E('span',null,'presenta-layout-campione');mini.dataset.layout=nome;mini.setAttribute('aria-hidden','true');
  const titolo=E('strong','Titolo'),immagine=E('span',null,'presenta-layout-immagine'),testo=E('span',null,'presenta-layout-testo');
  immagine.innerHTML='<svg viewBox="0 0 48 36" fill="none" aria-hidden="true"><rect x="1" y="1" width="46" height="34" stroke="currentColor"/><circle cx="34" cy="11" r="4" fill="currentColor"/><path d="M2 30 16 15 26 25 33 19 46 33" stroke="currentColor" stroke-width="2"/></svg>';
  testo.append(E('span','Una nuova idea'),E('i'),E('i'),E('i'));mini.append(titolo,immagine,testo);return mini;
 }
 function modelli(){
  const box=E('div',null,'presenta-modelli');box.setAttribute('role','group');box.setAttribute('aria-label','Disposizioni pronte');
  for(const [nome,label]of [['image-left','Immagine a sinistra'],['text-left','Testo a sinistra'],['image-top','Immagine sopra']]){
   const bt=b(label,null,()=>modello(nome));bt.classList.add('presenta-modello');bt.replaceChildren(campioneLayout(nome));box.append(bt);
  }return box;
 }
 function bacchetta(){
  const bt=b('Sistema la slide',null,sistemaSlide);bt.classList.add('presenta-bacchetta','presenta-modello');bt.title='Sistema la slide · mostra una proposta prima di applicarla';
  bt.innerHTML='<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4 20 12-12 4 4L8 24z" transform="translate(0 -3)"/><path d="m13 8 4 4M5 3v4M3 5h4M19 2v4M17 4h4M20 17v4M18 19h4"/></svg>';return bt;
 }
 const nomiOggetti={title:'Titolo',text:'Testo',list:'Testo',math:'Formula',image:'Immagine',audio:'Audio',video:'Video',shape:'Forma',table:'Tabella',navbar:'Navbar', 'page-number':'Numero pagina',drawing:'Disegno'};
 let ambitoStile='slide',stiliPersonali=Array(6).fill(null);
 try{const v=JSON.parse(localStorage.getItem('studia.presenta.stili')||'[]');stiliPersonali=Array.from({length:6},(_,i)=>M.temaPersonale(v?.[i]));}catch(_){}
 let colori=M.coloriPersonali(),stileCopiato=null,trascinaSlide='',miniature=new Map(),miniGiro=0,scalettaFirma='',menuAperto=null,bubble=null,bubbleRect=null,appuntiPopup=null;
 try{colori=M.coloriPersonali(JSON.parse(localStorage.getItem('studia.presenta.colori')||'{}'));}catch(_){}
 function ricordaColori(){localStorage.setItem('studia.presenta.colori',JSON.stringify(colori));}
 function popup(classe,contenuto,x,y,manuale=false){
  if(!manuale)menuAperto?.remove();const p=E('div',null,'popmenu presenta-menu '+classe);p.popover=manuale?'manual':'auto';p.append(contenuto);(document.querySelector('.presenta-tema-dialog[open]')||inputAperto?.popup||host).append(p);p.showPopover();const r=p.getBoundingClientRect();p.style.left=Math.max(8,Math.min(x,innerWidth-r.width-8))+'px';p.style.top=Math.max(8,Math.min(y,innerHeight-r.height-8))+'px';if(!manuale)menuAperto=p;p.addEventListener('toggle',e=>{if(e.newState==='closed')p.remove();});return p;
 }
 function scegliCarta(anchor){
  const documento=D.documento.id,sid=posizione().slide.id,fondo=M.sfondoSlide(D.documento,posizione().slide),grid=E('div',null,'presenta-carte-griglia');grid.setAttribute('role','group');grid.setAttribute('aria-label','Carte disponibili');
  function restituisciFocus(){const bt=campi.querySelector('[aria-label="Carta"]'),dest=bt?.getBoundingClientRect().width?bt:campi.querySelector('[aria-label="Altri sfondi"]');dest?.focus({preventScroll:true});}
  for(const [tipo,nome]of Object.entries(M.CARTE)){
   const bt=b(nome,null,()=>{pop.hidePopover();if(D.documento?.id!==documento||posizione()?.slide.id!==sid)return;op({tipo:'sfondoPattern',pattern:tipo},{struttura:true});restituisciFocus();}),img=E('img');img.src=new URL('assets/presentazioni/carte/'+tipo+'.png',document.baseURI).href;img.alt='';bt.classList.add('presenta-carta-scelta');bt.setAttribute('aria-pressed',String(fondo.backgroundPattern===tipo));bt.replaceChildren(img,E('span',nome));grid.append(bt);
  }
  const r=anchor.getBoundingClientRect(),pop=popup('presenta-carte-popup',grid,r.left,r.bottom+4);pop.setAttribute('role','dialog');pop.setAttribute('aria-label','Tipo di carta');anchor.setAttribute('aria-expanded','true');pop.addEventListener('toggle',e=>{if(e.newState==='closed'){anchor.setAttribute('aria-expanded','false');if(document.activeElement===document.body||pop.contains(document.activeElement))restituisciFocus();}});(grid.querySelector('[aria-pressed=true]')||grid.firstElementChild).focus({preventScroll:true});
 }
 function sfogliaColori(fn,anchor,slot){
  const box=E('div',null,'presenta-palette-contenuto'),titolo=E('div','Tailwind · '+C.etichetta(colori.ultimo),'presenta-sezione'),grid=E('div',null,'presenta-tailwind');
  grid.append(E('span'));for(const n of C.gradazioni)grid.append(E('span',String(n),'presenta-gradazione'));
  let famiglia='';for(const c of C.palette){
   if(c.famiglia!==famiglia){famiglia=c.famiglia;grid.append(E('span',famiglia,'presenta-famiglia'));}
   const bt=b(c.id,null,()=>{menuAperto?.hidePopover();colori=M.ricordaColore(colori,c.hex,slot);ricordaColori();fn(c.hex);if(scrittura)campiSlide();}),sw=E('i',null,'presenta-campione');sw.style.backgroundColor=c.hex;bt.textContent='';bt.append(sw);bt.title=c.id+' · '+c.hex;bt.setAttribute('aria-pressed',String(colori.ultimo.toLowerCase()===c.hex));grid.append(bt);
  }
  box.append(titolo,grid);const r=anchor.getBoundingClientRect(),p=popup('presenta-palette',box,r.left,r.bottom+4);grid.querySelector('[aria-pressed=true]')?.scrollIntoView({block:'center'});p.querySelector('[aria-pressed=true]')?.focus({preventScroll:true});
 }
 function sceltaCarattere(nome,valore,fn){
  const box=E('div',null,'presenta-campo presenta-carattere'),label=E('span',nome),scelto=M.CARATTERI[valore]||M.CARATTERI.zaino;
  const bt=b(nome,null,()=>{
   valore=bt.dataset.valore||valore;const documentoId=D.documento?.id,origine=slideId,oggetto=bloccoId,lista=E('div',null,'presenta-lista-caratteri');lista.setAttribute('role','menu');lista.setAttribute('aria-label',nome);
   for(const [id,f]of Object.entries(M.CARATTERI)){
    const voce=b(f.nome,null,()=>{menuAperto?.hidePopover();if(D.documento?.id!==documentoId||slideId!==origine||bloccoId!==oggetto)return;fn(id);});
    voce.classList.add('presenta-font-opzione');voce.setAttribute('role','menuitemradio');voce.setAttribute('aria-checked',String(id===valore));voce.style.fontFamily=f.css;
    voce.replaceChildren(E('span',f.nome),E('span','La luce e le foglie · Aa 123','presenta-font-esempio'));lista.append(voce);
   }
   const r=bt.getBoundingClientRect(),pop=popup('presenta-menu-caratteri',lista,r.left,r.bottom+4);bt.setAttribute('aria-expanded','true');
   pop.addEventListener('toggle',e=>{if(e.newState==='closed'){bt.setAttribute('aria-expanded','false');if(bt.isConnected)bt.focus({preventScroll:true});}});
   const voci=[...lista.children];lista.addEventListener('keydown',e=>{const i=voci.indexOf(document.activeElement);let j;if(e.key==='ArrowDown')j=(i+1)%voci.length;else if(e.key==='ArrowUp')j=(i-1+voci.length)%voci.length;else if(e.key==='Home')j=0;else if(e.key==='End')j=voci.length-1;else return;e.preventDefault();voci[j].focus();});
   (lista.querySelector('[aria-checked=true]')||lista.firstElementChild)?.focus();
  });
  bt.dataset.valore=valore;bt.replaceChildren(E('span',scelto.nome,'presenta-carattere-nome'));bt.title=scelto.nome;bt.style.fontFamily=scelto.css;bt.setAttribute('aria-haspopup','menu');bt.setAttribute('aria-expanded','false');box.append(label,bt);return box;
 }
 function iconaAllineamento(v,verticale){
  const x=({left:3,center:7,right:11})[v]||3,y=({start:4,center:8,end:12})[v]||4;
  const disegno=verticale?'<path d="M3 2h18M3 22h18" stroke="var(--muted)"/><rect x="5" y="'+y+'" width="14" height="8" fill="currentColor" stroke="none"/>':'<path d="M3 4h18M'+x+' 9h10M3 14h18M'+x+' 19h10"/>';
  return '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true">'+disegno+'</svg>';
 }
 function sceltaAllineamento(nome,valore,verticale,fn){
  const box=E('div',null,'presenta-campo presenta-allineamento'),voci=verticale?[['start','In alto'],['center','Al centro'],['end','In basso']]:[['left','Sinistra'],['center','Centro'],['right','Destra']];
  const bt=b(nome,null,()=>{const bar=E('div',null,'tbar');bar.setAttribute('role','group');bar.setAttribute('aria-label',nome);
   for(const [v,label]of voci){const opzione=b(nome+' · '+label,null,()=>{menuAperto?.hidePopover();valore=v;fn(v);disegnaIcona();});opzione.innerHTML=iconaAllineamento(v,verticale);opzione.setAttribute('aria-pressed',String(v===valore));bar.append(opzione);}
   const r=bt.getBoundingClientRect(),p=popup('presenta-menu-allineamento',bar,r.left,r.bottom+4);bt.setAttribute('aria-expanded','true');p.addEventListener('toggle',e=>{if(e.newState==='closed')bt.setAttribute('aria-expanded','false');});bar.querySelector('[aria-pressed=true]')?.focus();
  });function disegnaIcona(){bt.innerHTML=iconaAllineamento(valore,verticale);bt.append(E('span','▾'));bt.title=nome+' · '+voci.find(v=>v[0]===valore)[1];}disegnaIcona();bt.setAttribute('aria-expanded','false');bt.setAttribute('aria-haspopup','true');box.append(bt);return box;
 }
 const nomiPesi={200:'ExtraLight',300:'Light',400:'Regular',500:'Medium',600:'SemiBold',700:'Bold',800:'ExtraBold',900:'Black'};
 function aggiornaPesi(select,font,peso){
  const valori=PresentaTesto.pesi(font);
  select.replaceChildren(...(peso==null?[new Option('Misto','')]:[]),...valori.map(v=>{const o=new Option(nomiPesi[v],String(v));o.style.fontWeight=v;return o;}));select.value=peso??'';
 }
 function sceltaPeso(nome,font,peso,fn){const box=campo(nome,peso,v=>{if(v)fn(Number(v));},{opzioni:[]});box.classList.add('presenta-peso');aggiornaPesi(box.querySelector('select'),font,peso);return box;}
 function sceltaColore(nome,valore,fn,{automatico=false}={}){
  const box=E('div',null,'presenta-campo presenta-colori'),label=E('span',nome),bar=E('div',null,'tbar presenta-bar');box.append(label,bar);
  if(automatico){const bt=b('Automatico',null,()=>fn(null));bt.setAttribute('aria-pressed',String(!valore));bt.title='Il colore segue lo sfondo di questa slide';bar.append(bt);}
  for(const [hex,nome]of [['#ffffff','Bianco'],['#000000','Nero']]){const bt=b(nome,null,()=>fn(hex)),sw=E('i',null,'presenta-campione');sw.style.backgroundColor=hex;bt.prepend(sw);bt.setAttribute('aria-pressed',String(valore?.toLowerCase()===hex));bar.append(bt);}
  const nomePicker=nome==='Sfondo della slide'?'Nuovo colore dello sfondo':nome==='Colore della forma'?'Nuovo colore della forma':'Nuovo colore del testo',personalizzato=b(nomePicker,'palette',()=>sfogliaColori(fn,personalizzato));personalizzato.classList.add('presenta-personalizzato');personalizzato.dataset.colore=colori.ultimo;personalizzato.title='Nuovo colore · palette Tailwind · ultimo colore '+C.etichetta(colori.ultimo)+' · '+colori.ultimo;bar.append(personalizzato);
  const slots=E('div',null,'presenta-slot-colori');slots.setAttribute('role','group');slots.setAttribute('aria-label','Colori personali');bar.append(slots);
  for(let i=0;i<5;i++){
   const hex=colori.slots[i],col=E('div'),uso=b('Usa colore '+(i+1),null,()=>{const colore=colori.slots[i];if(!colore){sfogliaColori(fn,uso,i);return;}colori.ultimo=colore;ricordaColori();fn(colore);}),sw=E('i',null,'presenta-campione');sw.style.backgroundColor=hex||'transparent';uso.textContent='';uso.append(sw,E('span',hex?C.etichetta(hex):'–'));uso.dataset.slotVuoto=String(!hex);uso.setAttribute('aria-pressed',String(!!hex&&hex.toLowerCase()===valore?.toLowerCase()));uso.title=hex?C.etichetta(hex)+' · clic per usare, clic destro per modificare o eliminare':'Slot '+(i+1)+' · scegli un colore, si salva automaticamente';uso.setAttribute('aria-haspopup','menu');uso.setAttribute('aria-expanded','false');uso.setAttribute('aria-keyshortcuts','Shift+F10');
   function menuColore(x,y){
    const voci=E('div',null,'presenta-voci-menu');voci.setAttribute('role','menu');voci.setAttribute('aria-label','Colore personale '+(i+1));
    const modifica=testoBottone('Modifica colore','pencil',()=>{menuAperto?.hidePopover();sfogliaColori(fn,uso,i);}),elimina=testoBottone('Elimina colore','trash-2',()=>{menuAperto?.hidePopover();colori.slots[i]=null;ricordaColori();campiSlide();});
    elimina.disabled=!colori.slots[i];for(const bt of [modifica,elimina])bt.setAttribute('role','menuitem');voci.append(modifica,elimina);
    const p=popup('presenta-menu-colore',voci,x,y);uso.setAttribute('aria-expanded','true');p.addEventListener('toggle',e=>{if(e.newState==='closed'){uso.setAttribute('aria-expanded','false');if(uso.isConnected&&(document.activeElement===document.body||p.contains(document.activeElement)))uso.focus({preventScroll:true});}});
    voci.onkeydown=e=>{const attivi=[...voci.querySelectorAll('button:not(:disabled)')],indice=attivi.indexOf(document.activeElement);let j;if(e.key==='ArrowDown')j=(indice+1)%attivi.length;else if(e.key==='ArrowUp')j=(indice-1+attivi.length)%attivi.length;else if(e.key==='Home')j=0;else if(e.key==='End')j=attivi.length-1;else return;e.preventDefault();attivi[j].focus();};modifica.focus({preventScroll:true});
   }
   uso.oncontextmenu=e=>{e.preventDefault();e.stopPropagation();menuColore(e.clientX,e.clientY);};uso.onkeydown=e=>{if(e.key==='ContextMenu'||e.shiftKey&&e.key==='F10'){e.preventDefault();e.stopPropagation();const r=uso.getBoundingClientRect();menuColore(r.left,r.bottom);}};col.append(uso);slots.append(col);
  }
  return box;
 }
 function oggetti(){
  oggettiNav.replaceChildren();const s=posizione()?.slide;if(!s)return;const titolo=s.blocks.find(b=>b.type==='title');
  const voci=[{id:titolo?.id||'@titolo',type:'title'},...s.blocks.filter(b=>b!==titolo),{id:'',type:'sfondo'},{id:'@disposizione',type:'disposizione'},{id:'@stile',type:'stile'},{id:'@righelli',type:'righelli'}],conta={};
  for(const obj of voci){const nome=nomiOggetti[obj.type]||({sfondo:'Sfondo',disposizione:'Disposizione',stile:'Stile',righelli:'Righelli'})[obj.type],n=(conta[nome]||0)+1;conta[nome]=n;const bt=b(nome+(n>1?' '+n:''),null,()=>scegliBlocco(obj.id));bt.dataset.oggettoId=obj.id;if(obj.hidden){bt.title=nome+' · nascosto su questa slide';bt.append(E('span',' · nascosto'));}bt.setAttribute('aria-pressed',String(bloccoId===obj.id));bt.disabled=occupato||D.bloccato;oggettiNav.append(bt);}

  if(s.blocks.some(b=>b.id===bloccoId)){const menu=b('Comandi dell’oggetto',null,()=>{const r=menu.getBoundingClientRect();menuOggetto({blockId:bloccoId,anchor:{x:r.left,y:r.bottom}});});menu.textContent='…';menu.disabled=occupato||D.bloccato;oggettiNav.append(E('span',null,'tbspazio'),menu);}
 }
 function disegnaMiniature(compilata,immagini={}){
  const html=compilata.html.replace(/(src|href|data-background-image|data-background-video|data-common-image|data-common-video)="([^"]+)"/g,(intero,attributo,src)=>{if(attributo==='href'&&!/^(assets\/|presenta:)/.test(src))return intero;let p;try{p=new URL(src).pathname.slice(1);}catch(_){p=src;}return attributo+'="'+(immagini[p]||'')+'"';});const dom=new DOMParser().parseFromString(html,'text/html');for(const section of dom.querySelectorAll('[data-sfondo-comune]')){if(section.dataset.commonImage)section.dataset.backgroundImage=section.dataset.commonImage;if(section.hasAttribute('data-common-video'))section.setAttribute('data-background-video','');}const viste=[...dom.querySelectorAll('.presenta-slide')];miniature=new Map(M.posizioni(D.documento).map((p,i)=>[p.slide.id,{html:viste[i]?.parentElement?.outerHTML||'',settings:compilata.settings}]));miniGiro++;disegnaScaletta();
 }
 function scalaMiniatura(box){const w=Number(box.dataset.larghezza)||1280;box.firstElementChild.style.transform='scale('+box.clientWidth/w+')';}
 const osservaMini=new ResizeObserver(entries=>entries.forEach(e=>scalaMiniatura(e.target)));
 function disegnaScaletta(){
  const d=D.documento,p=posizione();if(!d){scaletta.replaceChildren();scalettaFirma='';return;}const posizioni=M.posizioni(d),sig=JSON.stringify([miniGiro,posizioni.map(p=>[p.slide.id,p.slide.title,p.v])]);
  if(sig!==scalettaFirma&&!trascinaSlide){osservaMini.disconnect();scaletta.replaceChildren();const nuova=testoBottone('+ SLIDE',null,()=>scegliModello());nuova.setAttribute('aria-label','Nuova slide');scaletta.append(nuova);
   for(const pos of posizioni){
    const nome=(pos.h+1)+(pos.v?'.'+pos.v:'')+' · '+(pos.slide.title||'Senza titolo'),bt=b(nome,null,()=>scegliSlide(pos.slide.id));bt.classList.add('presenta-slide-mini');bt.dataset.slideId=pos.slide.id;bt.dataset.verticale=String(pos.v>0);bt.draggable=true;bt.setAttribute('aria-keyshortcuts','Shift+F10');bt.title=nome+' · Trascina al centro di una miniatura per creare un approfondimento; sui bordi per riordinare.'+(pos.v?'':' La slide porta con sé i suoi approfondimenti.');
    const mini=E('div',null,'presenta-mini'),v=miniature.get(pos.slide.id),scena=E('div',null,'presenta-mini-scena');mini.setAttribute('aria-hidden','true');mini.dataset.larghezza=v?.settings.width||1280;mini.style.aspectRatio=(v?.settings.width||1280)+' / '+(v?.settings.height||720);scena.style.width=(v?.settings.width||1280)+'px';scena.style.height=(v?.settings.height||720)+'px';scena.dataset.tema=v?.settings.theme||'zaino-light';
    if(v){scena.innerHTML=v.html;const section=scena.querySelector('section');scena.style.backgroundColor=section?.dataset.backgroundColor||'';if(section?.dataset.backgroundImage){scena.style.backgroundImage='url('+JSON.stringify(section.dataset.backgroundImage)+')';scena.style.backgroundSize=section.dataset.backgroundSize;scena.style.backgroundPosition='center';scena.style.backgroundRepeat='no-repeat';}if(section?.hasAttribute('data-background-video'))scena.append(E('span','Video','presenta-mini-video'));for(const e of scena.querySelectorAll('audio,video'))e.replaceWith(E('span',e.tagName==='AUDIO'?'Audio':'Video'));for(const e of scena.querySelectorAll('a,button,input'))e.tabIndex=-1;}
    else scena.append(E('h2',pos.slide.title));mini.append(scena);bt.replaceChildren(mini,E('span',nome,'presenta-mini-numero'));bt.oncontextmenu=e=>{e.preventDefault();menuSlide(pos.slide.id,e.clientX,e.clientY);};bt.onkeydown=e=>{if(e.key==='ContextMenu'||e.shiftKey&&e.key==='F10'){e.preventDefault();const r=bt.getBoundingClientRect();menuSlide(pos.slide.id,r.left,r.bottom);}};
    const destinazione=e=>{const r=bt.getBoundingClientRect();return trascinaSlide?M.destinazioneSlide(D.documento,trascinaSlide,pos.slide.id,(e.clientY-r.top)/r.height):null;};
    const pulisci=()=>scaletta.querySelectorAll('[data-destinazione]').forEach(b=>{delete b.dataset.destinazione;delete b.dataset.dropLabel;});
    bt.ondragstart=e=>{fineScrittura();trascinaSlide=pos.slide.id;e.dataTransfer.setData('application/x-studia-slide',JSON.stringify({documento:d.id,slide:pos.slide.id}));e.dataTransfer.effectAllowed='move';};
    bt.ondragover=e=>{if(!trascinaSlide)return;const o=destinazione(e);pulisci();if(!o){e.dataTransfer.dropEffect='none';return;}e.preventDefault();e.dataTransfer.dropEffect='move';bt.dataset.destinazione=o.tipo==='approfondisciSlide'?'dentro':o.dopo?'dopo':'prima';bt.dataset.dropLabel=o.tipo==='approfondisciSlide'?'Come approfondimento':o.dopo?'Dopo questa slide':'Prima di questa slide';};
    bt.ondragleave=e=>{if(!bt.contains(e.relatedTarget))pulisci();};
    bt.ondrop=e=>{if(!trascinaSlide)return;e.preventDefault();e.stopPropagation();const o=destinazione(e);trascinaSlide='';pulisci();if(o)azione(()=>modifica(o,{struttura:true,seleziona:()=>o.slideId}));};
    bt.ondragend=()=>{trascinaSlide='';pulisci();disegnaScaletta();};const voce=E('div',null,'presenta-mini-voce'),menu=b('Comandi della slide '+(pos.h+1)+(pos.v?'.'+pos.v:''),null,()=>{const r=menu.getBoundingClientRect();menuSlide(pos.slide.id,r.right,r.bottom);});menu.textContent='…';menu.classList.add('presenta-mini-menu');voce.append(bt,menu);scaletta.append(voce);osservaMini.observe(mini);
   }scalettaFirma=sig;
  }
  for(const bt of scaletta.querySelectorAll('button')){bt.disabled=occupato||D.bloccato; if(bt.dataset.slideId)bt.setAttribute('aria-pressed',String(bt.dataset.slideId===p?.slide.id));}
 }
 function menuSlide(id,x,y){
  scegliSlide(id);const p=posizione(),bar=E('div',null,'presenta-voci-menu');
  const voce=(nome,icona,fn,disabilitato=false)=>{const bt=testoBottone(nome,icona,()=>{menuAperto?.hidePopover();return fn();});bt.disabled=disabilitato;bar.append(bt);return bt;};
  voce('Nuova slide','plus',scegliModello);voce('Nuovo approfondimento','arrow-down',()=>aggiungi('aggiungiSlide','sotto'));voce('Duplica slide','copy',()=>aggiungi('duplicaSlide',p.v?'sotto':'destra'));
  if(p.h>0)voce('Rendi approfondimento della slide precedente','arrow-down',()=>op({tipo:'approfondisciSlide',destinazione:D.documento.stacks[p.h-1].slides[0].id},{struttura:true}));
  if(p.v>0)voce('Rendi slide principale','arrow-up',()=>op({tipo:'riordinaSlide',destinazione:p.stack.slides[0].id,dopo:true},{struttura:true}));
  const autonomo=voce('Sfondo autonomo','image',()=>op({tipo:'sfondoAutonomo',autonomo:!p.slide.backgroundIndependent},{struttura:true}),!D.documento.backgroundCommon);autonomo.setAttribute('aria-pressed',String(!!p.slide.backgroundIndependent));autonomo.title='Sgancia questa slide dallo sfondo comune per modificarla separatamente.';
  voce('Copia stile','copy',()=>{stileCopiato=M.stileSlide(posizione().slide,D.documento);});voce('Incolla stile','palette',()=>op({tipo:'incollaStile',stile:stileCopiato},{struttura:true}),!stileCopiato);voce('Stato successivo animato','layers',()=>aggiungi('statoSuccessivo',p.v?'sotto':'destra'));voce('Sposta prima','chevron-up',()=>sposta(-1),p.v?p.v===1:p.h===0);voce('Sposta dopo','chevron-down',()=>sposta(1),p.v?p.v===p.stack.slides.length-1:p.h===D.documento.stacks.length-1);voce('Elimina slide','trash-2',()=>{if(confirm('Eliminare questa slide? Puoi ripristinarla con Annulla.'))op({tipo:'eliminaSlide'},{struttura:true});},M.posizioni(D.documento).length===1);popup('',bar,x,y);
 }
 function nascondiBubble(){bubble?.remove();bubble=null;bubbleRect=null;}
 function posizionaBubble(a){
  if(!bubble||!a)return;bubbleRect=a;const r=frame.getBoundingClientRect(),p=bubble.getBoundingClientRect();bubble.style.left=Math.max(8,Math.min(r.left+a.x,innerWidth-p.width-8))+'px';bubble.style.top=Math.max(8,Math.min(r.top+a.y-p.height-4,innerHeight-p.height-8))+'px';
 }
 // Il focus nel testo può scorrere il pannello dopo l’apertura del menu: la scrittura deve conservarlo.
 function aggiornaBubbleVista(){if(scrittura&&!scrittura.locale&&bubble)posizionaBubble(bubbleRect||{x:8,y:bubble.offsetHeight+12});else nascondiBubble();}
 function comandiGruppo(){const box=E('div',null,'tbar presenta-bar');box.append(E('strong',gruppo.length+' oggetti'));
  for(const [modo,nome]of [['left','Allinea a sinistra'],['center','Allinea al centro'],['right','Allinea a destra'],['top','Allinea in alto'],['middle','Allinea a metà'],['bottom','Allinea in basso'],['distribuisci-x','Distribuisci in orizzontale'],['distribuisci-y','Distribuisci in verticale']]){const bt=b(nome,null,()=>op({tipo:'posizionaBlocchi',boxes:M.allinea(posizione().slide,gruppo,modo)},{struttura:true}));bt.disabled=modo.startsWith('distribuisci')&&gruppo.length<3;box.append(bt);}box.append(b('Duplica selezionati','copy',()=>comandoOggetto('duplica')),b('Elimina selezionati','trash-2',()=>comandoOggetto('elimina')));return box;
 }
 function fineScrittura(){if(scrittura?.locale){chiudiInput();return;}if(!scrittura)return;scrittura=null;frame.contentWindow.postMessage({presenta:canale,tipo:'fineScrittura'},'*');nascondiBubble();firma='';}
 function formatoParole(patch){if(!scrittura)return false;if(scrittura.locale){editorInput.formatta(patch);return true;}frame.contentWindow.postMessage({presenta:canale,tipo:'formatoTesto',sessione:scrittura.sessione,patch},'*');return true;}
 function aggiornaFormatiParole(formati){
  if(!scrittura)return;scrittura.formati=formati;for(const scope of [bubble,campi,inputAperto?.popup]){if(!scope)continue;const font=scope.querySelector('[aria-label="Carattere delle parole"],[aria-label="Carattere"]'),size=scope.querySelector('[aria-label="Dimensione delle parole"],[aria-label="Dimensione testo"]');
   if(font){font.dataset.valore=formati.fontFamily||'';font.querySelector('.presenta-carattere-nome').textContent=M.CARATTERI[formati.fontFamily]?.nome||'Misto';font.title=font.textContent;font.style.fontFamily=M.CARATTERI[formati.fontFamily]?.css||'';}
   const peso=scope.querySelector('[aria-label="Peso delle parole"],[aria-label="Peso del carattere"]');if(peso)aggiornaPesi(peso,formati.fontFamily,formati.fontWeight);
   if(size&&document.activeElement!==size)size.value=formati.fontSize??'';
   for(const [k,nome]of [['bold','Grassetto'],['italic','Corsivo'],['underline','Sottolineato']]){const bt=scope.querySelector('[aria-label="'+nome+' sulle parole"],[aria-label="'+nome+'"]');if(bt)bt.setAttribute('aria-pressed',formati[k]===null?'mixed':String(!!formati[k]));}
  }
 }
 function barraScrittura(){
  const bar=E('div',null,'tbar presenta-tipografia presenta-font-bubble'),block=posizione().slide.blocks.find(b=>b.id===scrittura.blockId);
  bar.append(sceltaCarattere('Carattere delle parole',block.style?.fontFamily||D.documento.settings.fontFamily||'zaino',v=>formatoParole({fontFamily:v})),campo('Dimensione delle parole',block.style?.fontSize||(block.type==='title'?54:32),v=>formatoParole({fontSize:Number(v)}),{tipo:'number',min:12,max:160}));
  bar.insertBefore(sceltaPeso('Peso delle parole',block.style?.fontFamily||D.documento.settings.fontFamily||'zaino',PresentaTesto.peso(block.style,block.type==='title'?700:400),v=>formatoParole({fontWeight:v})),bar.children[1]);
  for(const [k,nome,lettera]of [['bold','Grassetto sulle parole','G'],['italic','Corsivo sulle parole','C'],['underline','Sottolineato sulle parole','S']]){const bt=b(nome,null,()=>formatoParole({[k]:'toggle'}));bt.textContent=lettera;bt.dataset.formato=k;bar.append(bt);}
  bar.append(b('Collegamento delle parole','link',async()=>{const attuale=scrittura?.sessione,url=await askText('Indirizzo web (http o https). Vuoto per rimuoverlo.','');if(url!==null&&scrittura?.sessione===attuale)formatoParole({link:url.trim()||null});}));
  const colore=b('Colore delle parole','palette',()=>sfogliaColori(v=>formatoParole({color:v}),colore));bar.append(colore,b('Colore automatico delle parole',null,()=>formatoParole({color:null})),b('Rimuovi formati delle parole','eraser',()=>formatoParole({bold:false,italic:false,underline:false,fontFamily:null,fontSize:null,fontWeight:null,color:null})),b('Termina scrittura','check',()=>{fineScrittura();campiSlide();disegna();}));
  bar.querySelector('[aria-label="Colore automatico delle parole"]').textContent='Auto';
  return bar;
 }
 function menuScrittura(){nascondiBubble();if(!scrittura||scrittura.locale)return;const r=frame.getBoundingClientRect();bubble=popup('presenta-bubble',barraScrittura(),r.left+8,r.top+8,true);}
 function menuOggetto(o){
  if(scrittura){menuScrittura();posizionaBubble(o.rect);return;}nascondiBubble();if(!posizione()?.slide.blocks.some(b=>b.id===o.blockId))return;scegliBlocco(o.blockId);const bar=E('div',null,'tbar'),voce=(nome,icona,fn)=>bar.append(b(nome,icona,()=>{nascondiBubble();return fn();}));
  const blocco=posizione().slide.blocks.find(b=>b.id===o.blockId);
  if(['title','text','list'].includes(blocco.type)){
   voce('Scrivi sul foglio','pencil',()=>scriviSulFoglio(blocco.id));
   const tipografia=E('div',null,'tbar presenta-tipografia presenta-font-bubble'),patch=(k,v)=>{const corrente=posizione().slide.blocks.find(b=>b.id===o.blockId);cambiaBlocco(o.blockId,{style:PresentaTesto.aggiornaStile(corrente.style,{[k]:v})});campiSlide();nascondiBubble();};
   tipografia.append(sceltaCarattere('Carattere dell’oggetto',blocco.style?.fontFamily||D.documento.settings.fontFamily||'zaino',v=>patch('fontFamily',v)),campo('Dimensione dell’oggetto',blocco.style?.fontSize||(blocco.type==='title'?54:32),v=>patch('fontSize',Number(v)),{tipo:'number',min:12,max:160}));tipografia.insertBefore(sceltaPeso('Peso dell’oggetto',blocco.style?.fontFamily||D.documento.settings.fontFamily||'zaino',PresentaTesto.peso(blocco.style,blocco.type==='title'?700:400),v=>patch('fontWeight',v)),tipografia.children[1]);bar.append(tipografia);
  }
  if(M.aspettoConsentito(blocco,D.documento.assets))voce('Aspetto dell’oggetto','palette',()=>{const r=frame.getBoundingClientRect();const pop=popup('presenta-aspetto-popup',pannelloAspetto(blocco),r.left+8,r.top+8);adattaAspetto(pop);});
  if(blocco.type==='drawing')voce('Modifica disegno vettoriale','pencil',()=>disegnoVettoriale(blocco));
  if(M.comune(blocco))voce(blocco.hidden?'Mostra su questa slide':'Nascondi su questa slide','eye',()=>op({tipo:'visibilitaComune',blockId:blocco.id,hidden:!blocco.hidden},{struttura:true}));
  if(blocco.type==='image')voce('Ritaglia immagine','scissors',()=>ritagliaImmagine(blocco.id));
  voce('Copia oggetto','copy',()=>comandoOggetto('copia'));voce('Incolla oggetto','plus',()=>comandoOggetto('incolla'));
  voce('Adatta riquadro al contenuto','maximize',()=>frame.contentWindow.postMessage({presenta:canale,tipo:'adatta',blockId:o.blockId},'*'));voce('Centra nella slide','move-horizontal',()=>posiziona('centro-centro'));voce('Duplica oggetto','copy',()=>{const d=op({tipo:'duplicaBlocco',blockId:o.blockId},{struttura:true});scegliBlocco(M.trova(d,slideId).slide.blocks.at(-1).id);});voce('Porta avanti','chevron-up',()=>muoviBlocco(o.blockId,1));voce('Porta indietro','chevron-down',()=>muoviBlocco(o.blockId,-1));voce(M.comune(blocco)?'Rimuovi da tutte le slide':'Elimina oggetto','trash-2',()=>comandoOggetto('elimina'));
  const r=frame.getBoundingClientRect(),a=o.rect;bubble=popup('presenta-bubble',bar,o.anchor?.x??r.left+(a?.x||8),o.anchor?.y??r.top+(a?.y||0)-38,true);if(M.comune(blocco)){bar.querySelector('[aria-label="Duplica oggetto"]').disabled=true;bar.querySelector('[aria-label="Copia oggetto"]').disabled=true;}bar.querySelector('[aria-label="Incolla oggetto"]').disabled=appuntiOggetto?.documentId!==D.documento?.id;
 }
 // Gli stessi controlli passano nel popover: nessuna copia di valori o listener.
 function adattaBarra(row,{nome='Altri comandi di testo',griglia=false}={}){
  if(!row)return;
  const nodi=[...row.children],abort=new AbortController(),eventi={signal:abort.signal};
  const altri=b(nome,null,()=>aperto()?chiudi(true):apri());altri.textContent='…';altri.classList.add('presenta-altri');altri.setAttribute('aria-haspopup','dialog');altri.setAttribute('aria-expanded','false');
  const pop=E('div',null,'popmenu presenta-menu '+(nome==='Altri comandi di testo'?'presenta-tipografia-popup':'presenta-controlli-popup')+' tbar-ctl');pop.popover='manual';pop.setAttribute('role','dialog');pop.setAttribute('aria-label',nome);
  pop.id='presenta-altri-'+crypto.randomUUID();altri.setAttribute('aria-controls',pop.id);row.append(altri,pop);
  const aperto=()=>pop.matches(':popover-open');
  function chiudi(focus=false){if(aperto())pop.hidePopover();altri.setAttribute('aria-expanded','false');if(focus&&altri.isConnected&&!altri.hidden)altri.focus();}
  function colloca(){if(!aperto())return;const r=altri.getBoundingClientRect(),p=pop.getBoundingClientRect();pop.style.left=Math.max(8,Math.min(r.left,innerWidth-p.width-8))+'px';pop.style.top=Math.max(8,Math.min(r.bottom+4,innerHeight-p.height-8))+'px';}
  function apri(){pop.showPopover();altri.setAttribute('aria-expanded','true');colloca();pop.querySelector('button,input,select')?.focus();}
  let precedente=-1;
  function misura(){
   if(!row.isConnected)return;const spazio=row.clientWidth;if(!spazio||spazio===precedente)return;precedente=spazio;
   const focus=document.activeElement,eraAperto=aperto();
   for(const n of nodi)row.insertBefore(n,altri);
   altri.hidden=false;
   const gap=parseFloat(getComputedStyle(row).columnGap)||0,larghezzaAltri=altri.getBoundingClientRect().width;
   let quanti;
   if(griglia){const g=PresentaBarra.griglia(nodi.length,spazio,gap,larghezzaAltri);quanti=g.visibili;row.style.gridTemplateColumns=(g.colonne?'repeat('+g.colonne+',minmax(0,1fr))':'')+(quanti<nodi.length?(g.colonne?' ':'')+larghezzaAltri+'px':'');altri.style.gridColumn=quanti<nodi.length?String(g.colonne+1):'';altri.style.gridRow='1 / span 2';}
   else{quanti=PresentaBarra.visibili(nodi.map(n=>n.getBoundingClientRect().width),spazio,gap,larghezzaAltri);if(nodi[quanti-1]?.classList.contains('tbsep'))quanti--;}

   for(const n of nodi.slice(quanti))pop.append(n);
   altri.hidden=quanti===nodi.length;
   if(altri.hidden)chiudi();else if(eraAperto)colloca();
   if(focus!==document.body&&row.contains(focus)){if(focus.closest('.presenta-tipografia-popup,.presenta-controlli-popup')&&!aperto())altri.focus();else focus.focus({preventScroll:true});}
  }
  document.addEventListener('pointerdown',e=>{if(aperto()&&!pop.contains(e.target)&&!altri.contains(e.target)&&!e.target.closest('.presenta-menu'))chiudi();},eventi);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&aperto()&&!document.querySelector('.presenta-menu[popover="auto"]:popover-open')&&!inputAperto){e.preventDefault();e.stopImmediatePropagation();chiudi(true);}}, {...eventi,capture:true});
  // Un clic sul foglio avviene nell’iframe e non propaga pointerdown al documento.
  window.addEventListener('blur',()=>{if(document.activeElement===frame)chiudi();},eventi);
  corpo.addEventListener('scroll',colloca,eventi);window.addEventListener('resize',colloca,eventi);
  const details=row.closest('details');details?.addEventListener('toggle',()=>{if(!details.open)chiudi();else{precedente=-1;misura();}},eventi);
  const osserva=new ResizeObserver(misura);osserva.observe(row);misura();
  const dispose=()=>{abort.abort();osserva.disconnect();chiudi();};barreAdattive.push(dispose);return dispose;
 }
 function campiSlide(){
  barreAdattive.forEach(f=>f());barreAdattive=[];
  const aperti=[...campi.querySelectorAll('details[open]')].map(e=>e.dataset.pannello);campi.replaceChildren();const p=posizione();if(!p)return;slideId=p.slide.id;const s=p.slide;if(!['@titolo','@disposizione','@stile','@righelli'].includes(bloccoId)&&!s.blocks.some(b=>b.id===bloccoId))bloccoId='';
  if(gruppo.length>1){campi.append(comandiGruppo());oggetti();return;}
  const block=s.blocks.find(b=>b.id===bloccoId),titolo=block?.type==='title'||bloccoId==='@titolo',props=E('div',null,'presenta-proprieta-foglio');props.dataset.voce=titolo?'titolo':bloccoId==='@stile'?'stile':bloccoId==='@disposizione'?'disposizione':bloccoId==='@righelli'?'righelli':block?.type||'sfondo';
  if(titolo){const contenuto=E('section'),titolo=campo('Titolo della slide',s.title,v=>op({tipo:'titoloSlide',title:v}),{maxLength:140});titolo.firstElementChild.textContent='Titolo';titolo.classList.add('presenta-titolo-campo');if(block)bloccoCampi(block,contenuto,titolo);else contenuto.append(titolo);props.append(contenuto);}
  else if(block){const contenuto=E('section');bloccoCampi(block,contenuto);props.append(contenuto);}
  else if(bloccoId==='@righelli'){props.append(pannelloRighelli());}
  else if(bloccoId==='@stile'){props.append(stiliPronti());}
  else if(bloccoId==='@disposizione'){const disposizione=E('section',null,'presenta-disposizione-compatta');const mod=modelli();mod.append(bacchetta());disposizione.append(mod);props.append(disposizione);}
  else{
   const fondo=M.sfondoSlide(D.documento,s),media=fondo.backgroundMedia,risorsa=media&&D.documento.assets[media.assetId],bar=E('div',null,'tbar presenta-bar presenta-sfondo-tipi');bar.setAttribute('role','group');bar.setAttribute('aria-label','Tipo di sfondo');
   const colore=testoBottone('Colore','palette',()=>op({tipo:'sfondoColore',background:fondo.background||'#ffffff'},{struttura:true})),immagine=testoBottone('Immagine/GIF di sfondo','image',()=>scegliMateriale(null,'image')),video=testoBottone('Video di sfondo','video',()=>scegliMateriale(null,'video'));
   const carta=testoBottone('Carta','image',()=>scegliCarta(carta));carta.setAttribute('aria-haspopup','dialog');carta.setAttribute('aria-expanded','false');carta.title=fondo.backgroundPattern?'Carta: '+M.CARTE[fondo.backgroundPattern]:'Scegli una texture di carta';
   immagine.lastElementChild.textContent='Immagine/GIF';video.lastElementChild.textContent='Video';for(const [bt,attivo]of [[colore,!media&&!fondo.backgroundPattern],[immagine,risorsa?.kind==='image'],[video,risorsa?.kind==='video'],[carta,!!fondo.backgroundPattern]]){bt.setAttribute('aria-pressed',String(attivo));bar.append(bt);}video.title=tooltipMedia();const carica=testoBottone('Carica dal PC','plus',()=>importaFile(null,true));carica.title=tooltipMedia();bar.append(carica);const azioni=E('div',null,'tbar presenta-azioni-comuni'),tutte=testoBottone('Applica a tutte le slide','layers',()=>op({tipo:'sfondoTutte'},{struttura:true}));tutte.title='Usa lo sfondo corrente su tutte le slide, anche quelle nuove. Sfondo autonomo nel menu di una miniatura permette un’eccezione.';azioni.append(tutte);bar.append(azioni);props.append(bar);
   if(!media&&!fondo.backgroundPattern){const sfondo=sceltaColore('Sfondo della slide',fondo.background,v=>op({tipo:'sfondoColore',background:v},{struttura:true}));sfondo.firstElementChild.remove();sfondo.setAttribute('role','group');sfondo.setAttribute('aria-label','Sfondo della slide');props.append(sfondo);}
   else if(media){
    const comandi=E('div',null,'tbar tbar-ctl presenta-bar presenta-sfondo-comandi'),nome=E('span',risorsa.source?.title|| (risorsa.mimeType==='image/gif'?'GIF animata':risorsa.kind==='video'?'Video':'Immagine'),'presenta-sfondo-nome');nome.title=nome.textContent;
    const aggiorna=patch=>op({tipo:'sfondoMedia',backgroundMedia:{...media,...patch}},{struttura:true}),fit=campo('Visualizzazione sfondo',media.fit,v=>aggiorna({fit:v}),{opzioni:[['cover','Riempi slide'],['contain','Mostra tutto']]});fit.firstElementChild.textContent='Dimensione';fit.title='Riempi slide: copre tutto, ritagliando i bordi. Mostra tutto: mantiene visibile l’intero media.';comandi.append(nome,fit);
    if(risorsa.kind==='video'){comandi.title=tooltipMedia();const audio=testoBottone('Audio dello sfondo','volume-2',()=>aggiorna({muted:media.muted===false})),ripeti=testoBottone('Ripeti video di sfondo','refresh-cw',()=>aggiorna({loop:media.loop===false}));audio.lastElementChild.textContent='Audio';ripeti.lastElementChild.textContent='Ripeti';audio.setAttribute('aria-pressed',String(media.muted===false));ripeti.setAttribute('aria-pressed',String(media.loop!==false));comandi.append(audio,ripeti);}
    comandi.append(testoBottone('Prova sfondo','play',provaAnimazioni),b('Rimuovi media di sfondo','trash-2',()=>op({tipo:'sfondoMedia',backgroundMedia:null},{struttura:true})));props.append(comandi);
   }
  }
  campi.append(props);for(const key of aperti){const el=campi.querySelector('details[data-pannello="'+key+'"]');if(el)el.open=true;}adattaBarra(campi.querySelector('.presenta-tipografia'));adattaBarra(campi.querySelector('.presenta-navbar-controlli'),{nome:'Altri comandi della navbar'});adattaBarra(campi.querySelector('.presenta-sfondo-tipi'),{nome:'Altri sfondi'});adattaAspetto(campi);oggetti();
 }
 function stiliPronti(){
  const box=E('section',null,'presenta-stili-compatti tbar-ctl'),controlli=E('div',null,'presenta-stili-controlli'),galleria=E('div',null,'presenta-stili-galleria');galleria.setAttribute('role','group');galleria.setAttribute('aria-label','Stili della presentazione');
  const font=sceltaCarattere('Carattere per tutte le slide',D.documento.settings.fontFamily||'zaino',v=>modifica({tipo:'caratterePresentazione',fontFamily:v},{struttura:true})),scelta=campo('Applica lo stile a',ambitoStile,v=>{ambitoStile=v;},{opzioni:[['slide','Questa slide'],['tutte','Tutte le slide']]});
  font.firstElementChild.textContent='Font';font.title='Carattere per tutte le slide';scelta.firstElementChild.textContent='Applica a';controlli.append(font,scelta);box.append(controlli,galleria);
  function tessera(t,id){
   const cella=E('div',null,'presenta-stile-tessera'),bt=b(t?.nome||'Crea stile '+(id+1),null,()=>t?op({tipo:'stilePresentazione',...(typeof id==='string'?{stile:id}:{tema:t}),tutte:ambitoStile==='tutte'},{struttura:true}):personalizzaStile(id));
   bt.classList.add('presenta-stile-pronto');const mini=campioneLayout();
   if(t){mini.style.background=t.sfondo;mini.style.color=t.colore;mini.style.fontFamily=M.CARATTERI[t.font].css;mini.querySelector('strong').style.color=t.accento;mini.querySelector('strong').style.fontSize=(t.titolo||54)/5+'px';mini.querySelector('.presenta-layout-testo').style.fontSize=(t.testo||32)/5+'px';}
   else{mini.classList.add('presenta-stile-vuoto');mini.append(E('span','+','presenta-stile-aggiungi'));}
   bt.replaceChildren(mini,E('span',t?.nome||'Personale '+(id+1),'presenta-stile-nome'));bt.title=t?t.nome+' · applica font, dimensioni e colori. Puoi annullare.':'Crea uno stile a partire dalla slide';cella.append(bt);
   if(typeof id==='number'){cella.dataset.slotStile=id;if(t){const modifica=b('Modifica stile '+(id+1),'pencil',()=>personalizzaStile(id));modifica.classList.add('presenta-stile-modifica');cella.append(modifica);}}
   galleria.append(cella);
  }
  for(const [id,t]of Object.entries(M.STILI))tessera(t,id);for(let i=0;i<6;i++)tessera(stiliPersonali[i],i);return box;
 }
 function personalizzaStile(i){
  const slide=posizione().slide,titolo=slide.blocks.find(b=>b.type==='title')?.style||{},testo=slide.blocks.find(b=>['text','list'].includes(b.type))?.style||{},sfondo=slide.background||'#ffffff';
  let tema=M.copia(stiliPersonali[i]||{nome:'Personale '+(i+1),font:testo.fontFamily||D.documento.settings.fontFamily||'zaino',sfondo,colore:testo.color||M.contrasto(sfondo),accento:titolo.color||M.contrasto(sfondo),titolo:Math.min(120,Math.max(12,titolo.fontSize||54)),testo:Math.min(120,Math.max(12,testo.fontSize||32))});
  const dialog=E('dialog',null,'presenta-materiali presenta-tema-dialog tbar-ctl'),bar=E('div',null,'tbar'),form=E('div',null,'presenta-tema-campi'),preview=campioneLayout(),errore=E('output',null,'presenta-stato');dialog.setAttribute('aria-label','Personalizza stile');errore.setAttribute('role','status');
  function aggiorna(){preview.style.background=tema.sfondo;preview.style.color=tema.colore;preview.style.fontFamily=M.CARATTERI[tema.font].css;preview.querySelector('strong').style.color=tema.accento;preview.querySelector('strong').style.fontSize=tema.titolo/5+'px';preview.querySelector('.presenta-layout-testo').style.fontSize=tema.testo/5+'px';}
  form.append(campo('Nome',tema.nome,v=>{tema.nome=v;},{maxLength:40,espanso:true}),sceltaCarattere('Font dello stile',tema.font,v=>{tema.font=v;const f=form.querySelector('.presenta-carattere>.tbtn');f.dataset.valore=v;f.querySelector('span').textContent=M.CARATTERI[v].nome;f.style.fontFamily=M.CARATTERI[v].css;aggiorna();}),campo('Titolo · px',tema.titolo,v=>{tema.titolo=Number(v);aggiorna();},{tipo:'number',min:12,max:120}),campo('Testo · px',tema.testo,v=>{tema.testo=Number(v);aggiorna();},{tipo:'number',min:12,max:120}));
  for(const [chiave,label]of [['sfondo','Sfondo'],['accento','Titolo'],['colore','Testo']]){const col=E('div',null,'presenta-campo'),bt=b('Colore '+label.toLowerCase()+' dello stile',null,()=>sfogliaColori(v=>{tema[chiave]=v;campione();aggiorna();},bt));function campione(){const sw=E('i',null,'presenta-campione');sw.style.background=tema[chiave];bt.replaceChildren(sw,E('span',C.etichetta(tema[chiave])));}campione();col.append(E('span',label),bt);form.append(col);}
  function conserva(v){const nuovi=stiliPersonali.slice();nuovi[i]=v;localStorage.setItem('studia.presenta.stili',JSON.stringify(nuovi));stiliPersonali=nuovi;dialog.close();campiSlide();}
  bar.append(E('strong','Personalizza stile'),E('span',null,'tbspazio'),b('Chiudi','x',()=>dialog.close()));
  const azioni=E('div',null,'tbar');if(stiliPersonali[i])azioni.append(testoBottone('Svuota slot','trash-2',()=>conserva(null)));azioni.append(E('span',null,'tbspazio'),testoBottone('Salva stile','check',()=>{const valido=M.temaPersonale(tema);if(!valido){errore.textContent='Inserisci un nome e dimensioni tra 12 e 120.';return;}conserva(valido);}));
  dialog.append(bar,preview,form,errore,azioni);document.body.append(dialog);dialog.addEventListener('close',()=>{menuAperto?.remove();dialog.remove();},{once:true});aggiorna();dialog.showModal();
 }
 async function sistemaSlide(){
  fineScrittura();const d=D.documento,s=posizione().slide,boxes=M.sistema(s),proposta=M.applica(d,{tipo:'posizionaBlocchi',slideId:s.id,boxes}),prima=JSON.stringify({...d,revision:0}),z=corso;
  const r=await call({azione:'vista',documento:proposta});if(corso!==z||D.documento?.id!==d.id)return;
  const dialog=E('dialog',null,'presenta-materiali presenta-sistema-dialog'),bar=E('div',null,'tbar'),anteprima=E('iframe',null,'presenta-sistema-anteprima'),canaleProva=crypto.randomUUID();anteprima.title='Proposta di disposizione';anteprima.setAttribute('sandbox','allow-scripts');anteprima.style.aspectRatio=d.settings.width+'/'+d.settings.height;anteprima.src=frame.src;
  const ascolta=e=>{if(e.source===anteprima.contentWindow&&e.data?.tipo==='presenta-caricato')anteprima.contentWindow.postMessage({presenta:canaleProva,tipo:'quadro',documento:r.documento,posizione:coordinate()},'*');};window.addEventListener('message',ascolta);
  bar.append(E('strong','Sistema la slide'),E('span',null,'tbspazio'),testoBottone('Annulla proposta','x',()=>dialog.close()),testoBottone('Applica disposizione','check',()=>{if(corso!==z||JSON.stringify({...D.documento,revision:0})!==prima)throw Error('La presentazione è cambiata. Riapri la proposta.');op({tipo:'posizionaBlocchi',boxes},{struttura:true});dialog.close();}));
  dialog.append(bar,anteprima);document.body.append(dialog);dialog.addEventListener('close',()=>{window.removeEventListener('message',ascolta);dialog.remove();},{once:true});dialog.showModal();
 }
 function bloccoCampi(block,destinazione,inizio=null){
  const box=E('section',null,'presenta-blocco-editor');box.dataset.blockId=block.id;
  const patch=v=>cambiaBlocco(block.id,v),s=posizione().slide;
  if(block.type==='text'&&scrittura)box.append(testoBottone('Termina scrittura','check',()=>{fineScrittura();campiSlide();disegna();}));
  else if(block.type==='text'&&!block.richText){box.append(campo('Testo · Markdown e formule',block.markdown,v=>patch({markdown:v,richText:undefined}),{tipo:'textarea',maxLength:100000}));const comandi=E('div',null,'tbar presenta-scrittura-comandi');comandi.append(testoBottone('Scrivi sul foglio','pencil',()=>scriviSulFoglio(block.id)));box.append(comandi);}
  else if(block.type==='text'&&block.richText){box.append(campoTestoRicco(block));const comandi=E('div',null,'tbar presenta-scrittura-comandi');box.append(comandi);comandi.append(testoBottone('Scrivi sul foglio','pencil',()=>scriviSulFoglio(block.id)),testoBottone('Modifica sorgente Markdown',null,()=>{if(confirm('Passare al sorgente Markdown rimuove i font, i colori e le dimensioni delle singole parole. Grassetto, corsivo e formule restano. Puoi annullare.')){patch({richText:undefined});campiSlide();}}));}
  else if(block.type==='title'){}
  else if(block.type==='navbar'){
   const row=E('div',null,'presenta-navbar-controlli tbar-ctl'),tipo=campo('Tipo di navbar',block.variant,v=>{patch({variant:v});campiSlide();},{opzioni:Object.entries(M.NAVBAR)}),step=campo('Step della navbar',block.scope,v=>{patch({scope:v});campiSlide();},{opzioni:[['all','Tutte le slide'],['main','Solo principali']]});tipo.firstElementChild.textContent='Tipo';step.firstElementChild.textContent='Step';
   row.append(tipo,step,campo('Orientamento',block.orientation||'horizontal',v=>{const corrente=posizione().slide.blocks.find(b=>b.id===block.id),q=corrente.style?.box,ruota=q&&(v==='vertical'?q.width>q.height:q.height>q.width);patch({orientation:v,...(ruota?{style:{...corrente.style,box:v==='vertical'?{x:3,y:10,width:18,height:78}:{x:7,y:90,width:74,height:8}}}:{})});campiSlide();},{opzioni:[['horizontal','Orizzontale'],['vertical','Verticale']]}),campo('Zoom dello step attivo',block.activeZoom??1,v=>{patch({activeZoom:Number(v)});campiSlide();},{opzioni:[[1,'Disattivato'],[1.1,'Leggero · 110%'],[1.2,'Medio · 120%'],[1.3,'Marcato · 130%']]}));row.lastElementChild.firstElementChild.textContent='Zoom';box.append(row);
  }
  else if(block.type==='page-number')box.append(E('p','Numerazione automatica: principali 1/12, approfondimenti 2a/12. Il totale conta le slide principali.','presenta-aiuto-comuni'));
  else if(block.type==='drawing')box.append(testoBottone('Modifica disegno vettoriale','pencil',()=>disegnoVettoriale(block)));
  else if(block.type==='shape')box.append(campo('Forma',block.shape,v=>patch({shape:v}),{opzioni:[['rectangle','Rettangolo'],['ellipse','Ellisse'],['arrow','Freccia']]}));
  else if(block.type==='table'){inizio=testoBottone('Modifica celle','pencil',()=>modificaTabella(block.id));inizio.classList.add('presenta-celle-comando');}
  else if(block.type==='math')box.append(campo('Formula · LaTeX',block.latex,v=>patch({latex:v}),{tipo:'textarea',maxLength:20000}));
  else if(block.type==='list')box.append(campo('Elenco · una voce per riga',block.items.map(i=>i.richText?PresentaTesto.piano(i.richText):i.markdown).join('\n'),v=>{
   const corrente=posizione().slide.blocks.find(b=>b.id===block.id);patch({items:v.split('\n').map((markdown,i)=>{const prima=corrente.items[i];return prima&&(prima.richText?PresentaTesto.piano(prima.richText):prima.markdown)===markdown?prima:{id:prima?.id||crypto.randomUUID(),markdown,...(prima?.richText?{richText:PresentaTesto.riscrivi(prima.richText,markdown)}:{})};})});
  },{tipo:'textarea',maxLength:100000}));
  else{
   if(block.type==='image'){
    const azioni=E('div',null,'tbar presenta-immagine-comandi'),campi=E('div',null,'presenta-immagine-campi');azioni.append(testoBottone('Carica immagine o video dal computer','plus',()=>importaFile()),testoBottone('Sostituisci immagine','image',()=>scegliMateriale(block.id)),testoBottone('Ritaglia immagine','scissors',()=>ritagliaImmagine(block.id)));azioni.firstElementChild.title=tooltipMedia();campi.append(campo('Descrizione dell’immagine',block.alt,v=>patch({alt:v}),{maxLength:2000}),campo('Didascalia',block.caption,v=>patch({caption:v}),{maxLength:10000}));box.append(azioni,campi);
   }else box.append(campo('Didascalia',block.caption,v=>patch({caption:v}),{maxLength:10000}));
  }
  if(['audio','video'].includes(block.type)){
   box.append(testoBottone('Scegli e prova il frammento','scissors',()=>frammentoMedia(block.id)));
   const intervallo=E('div',null,'presenta-proprieta');intervallo.title='In secondi. Lascia Fine vuoto per riprodurre fino alla fine del file.';
   for(const [k,nome]of [['start','Inizio (secondi)'],['end','Fine (secondi)']])intervallo.append(campo(nome,block[k],v=>patch({[k]:v===''?undefined:Number(v)}),{tipo:'number',min:0,max:604800,step:.1,opzionale:true}));
   box.append(intervallo,testoBottone('Usa media intero',null,()=>{patch({start:undefined,end:undefined});campiSlide();}));
  }
  if(M.comune(block)){const azioni=E('div',null,'tbar presenta-azioni-comuni');azioni.title='Posizione e aspetto si applicano a tutte le slide. La griglia dei contenuti riserva il loro spazio con un margine di sicurezza.';azioni.append(testoBottone(block.hidden?'Mostra su questa slide':'Nascondi su questa slide','eye',()=>op({tipo:'visibilitaComune',blockId:block.id,hidden:!block.hidden},{struttura:true})),E('span','Posizione e aspetto su tutte le slide.','presenta-aiuto-comuni'));box.append(azioni);}
  if(block.type==='drawing'){box.append(comandoPosizione(block),aspettoOggetto(block),animazioniOggetto(block));destinazione.append(box);return;}
  const stile=(k,v)=>{if(scrittura&&PresentaTesto.CHIAVI.includes(k)){formatoParole({[k]:v});return;}const corrente=posizione().slide.blocks.find(b=>b.id===block.id);patch({style:PresentaTesto.aggiornaStile(corrente.style,{[k]:v})});};
  const visibili=E('div',null,'presenta-proprieta tbar-ctl presenta-tipografia');
  visibili.append(sceltaCarattere('Carattere',block.style?.fontFamily||D.documento.settings.fontFamily||'zaino',v=>{stile('fontFamily',v);campiSlide();}),campo('Dimensione testo',block.style?.fontSize||(block.type==='title'?54:32),v=>stile('fontSize',Number(v)),{tipo:'number',min:12,max:160}),sceltaAllineamento('Allineamento del testo',block.style?.align||'left',false,v=>stile('align',v)),sceltaAllineamento('Posizione nel riquadro',block.style?.verticalAlign||'center',true,v=>stile('verticalAlign',v)));visibili.insertBefore(sceltaPeso('Peso del carattere',block.style?.fontFamily||D.documento.settings.fontFamily||'zaino',PresentaTesto.peso(block.style,block.type==='title'?700:400),v=>{stile('fontWeight',v);if(!scrittura)campiSlide();}),visibili.children[1]);visibili.children[0].firstElementChild.textContent='Font';visibili.children[1].firstElementChild.textContent='Peso';visibili.children[2].firstElementChild.textContent='Dimensione';visibili.children[2].classList.add('presenta-dimensione');box.append(visibili);
  const formati=E('div',null,'tbar presenta-bar presenta-formati');formati.setAttribute('role','group');formati.setAttribute('aria-label',block.type==='image'?'Formato della didascalia':scrittura?'Formato delle parole selezionate':'Formato dell’intero oggetto');
  for(const [k,nome,lettera]of [['bold','Grassetto','G'],['italic','Corsivo','C'],['underline','Sottolineato','S']]){const attivo=k==='bold'?PresentaTesto.peso(block.style,block.type==='title'?700:400)>=600:!!block.style?.[k],bt=b(nome,null,()=>{if(scrittura){formatoParole({[k]:'toggle'});return;}stile(k,!attivo);campiSlide();});bt.textContent=lettera;bt.style.fontWeight=k==='bold'?'700':'400';bt.style.fontStyle=k==='italic'?'italic':'normal';bt.style.textDecoration=k==='underline'?'underline':'none';bt.setAttribute('aria-pressed',String(attivo));bt.title=nome+(scrittura?' · parole selezionate':' · intero oggetto');formati.append(bt);}
  const interlinea=campo('Interlinea',block.style?.lineHeight||(block.type==='title'?1.15:1.4),v=>stile('lineHeight',Number(v)),{opzioni:[[1,'Compatta · 1'],[1.15,'Stretta · 1,15'],[1.4,'Normale · 1,4'],[1.6,'Ampia · 1,6'],[2,'Doppia · 2']]});interlinea.classList.add('presenta-interlinea');visibili.insertBefore(formati,visibili.children[3]);visibili.append(interlinea,comandoPosizione(block));box.append(sceltaColore(block.type==='shape'?'Colore della forma':'Colore del testo',block.style?.color,v=>{if(formatoParole({color:v}))return;const corrente=posizione().slide.blocks.find(b=>b.id===block.id),style={...corrente.style};if(v)style.color=v;else delete style.color;patch({style});campiSlide();},{automatico:true}));

  if(inizio)visibili.prepend(inizio);
  if(M.aspettoConsentito(block,D.documento.assets))box.append(aspettoOggetto(block));
  box.append(animazioniOggetto(block));destinazione.append(box);
 }
 function aspettoOggetto(block){const dettagli=E('details',null,'presenta-aspetto tbar-ctl'),summary=E('summary',null,'tbtn');UiIcone.imposta(summary,'chevron-right');summary.append(E('span','Aspetto'));dettagli.dataset.pannello='aspetto';dettagli.append(summary,pannelloAspetto(block));return dettagli;}
 function adattaAspetto(scope){for(const row of scope.querySelectorAll('.presenta-aspetto-campi'))adattaBarra(row,{nome:'Altri controlli di aspetto',griglia:true});for(const row of scope.querySelectorAll('.presenta-aspetto-azioni'))adattaBarra(row,{nome:'Altre azioni di aspetto'});}
 function pannelloAspetto(block){
  const box=E('div',null,'presenta-aspetto-controlli tbar-ctl'),documento=D.documento.id,sid=slideId;
  const corrente=()=>D.documento?.id===documento&&slideId===sid?posizione().slide.blocks.find(b=>b.id===block.id):null;
  function patch(p){const b=corrente();if(!b)throw Error('La selezione è cambiata. Riapri Aspetto.');cambiaBlocco(b.id,{style:{...b.style,appearance:{...b.style?.appearance,...p}}});}
  const a=block.style?.appearance||{},campiAspetto=E('div',null,'presenta-aspetto-campi'),azioni=E('div',null,'tbar presenta-aspetto-azioni');box.append(campiAspetto,azioni);
  campiAspetto.append(campo('Fusione',a.blend||'normal',v=>patch({blend:v}),{opzioni:Object.entries(M.FUSIONI)}));
  function cursore(key,label,min,max,base,step=1){const val=a[key]??base,field=campo(label,key==='opacity'?Math.round(val*100):val,v=>{const numero=Number(v);patch({[key]:key==='opacity'?numero/100:numero});output.textContent=v+(key==='blur'?' px':'%');},{tipo:'range',min,max,step}),output=E('output',(key==='opacity'?Math.round(val*100):val)+(key==='blur'?' px':'%'));field.append(output);field.dataset.aspetto=key;field.querySelector('input').classList.add('zaino-slider');campiAspetto.append(field);}
  cursore('opacity','Opacità',0,100,1);
  if(M.filtriConsentiti(block)){
  const grigio=testoBottone('Bianco e nero',null,()=>{const v=corrente()?.style?.appearance?.grayscale===100?0:100;patch({grayscale:v});grigio.setAttribute('aria-pressed',String(v===100));const input=box.querySelector('[aria-label="Scala di grigi"]');input.value=v;input.nextElementSibling.textContent=v+'%';});grigio.setAttribute('aria-pressed',String(a.grayscale===100));grigio.classList.add('presenta-bianco-nero');azioni.append(grigio,E('span',null,'tbsep'));
  for(const [key,label]of [['grayscale','Scala di grigi'],['sepia','Seppia'],['brightness','Luminosità'],['contrast','Contrasto'],['saturate','Saturazione'],['blur','Sfocatura']]){const [min,max,base]=M.FILTRI[key];cursore(key,label,min,max,base,key==='blur'?.5:1);}
  }
  if(block.type==='navbar')box.append(pannelloGraficaNavbar(block,corrente),azioni);
  azioni.append(testoBottone('Ripristina aspetto','rotate-ccw',()=>{const b=corrente();if(!b)return;const style={...b.style};delete style.appearance;if(block.type==='navbar')delete style.navbar;cambiaBlocco(b.id,{style});campiSlide();menuAperto?.hidePopover();}));return box;
 }
 function pannelloGraficaNavbar(block,corrente){
  const box=E('div',null,'presenta-navbar-grafica'),g=M.graficaNavbar(block.style?.navbar);
  function patch(key,prop,value){const b=corrente();if(!b)return;const prima=b.style?.navbar||{};cambiaBlocco(b.id,{style:{...b.style,navbar:{...prima,[key]:prop?{...prima[key],[prop]:value}:value}}});}
  function gruppo(nome){const d=E('details',null,'presenta-navbar-gruppo'),summary=E('summary',nome,'tbtn');d.dataset.pannello='navbar-'+nome;d.append(summary);box.append(d);return d;}
  function colore(parent,nome,key,prop='color'){parent.append(sceltaColore(nome,prop?g[key][prop]:g[key],v=>{patch(key,prop,v);campiSlide();},{automatico:true}));}
  function numero(parent,nome,key,prop,min,max,unit='px'){const val=prop?g[key][prop]:g[key],percento=prop==='opacity'||key==='activeGraphicOpacity',field=campo(nome,percento?Math.round(val*100):val,v=>{patch(key,prop,Number(v)/(percento?100:1));out.textContent=v+(percento?'%':' '+unit);},{tipo:'range',min,max,step:1}),out=E('output',(percento?Math.round(val*100):val)+(percento?'%':' '+unit));field.querySelector('input').classList.add('zaino-slider');field.append(out);return field;}
  function misure(parent,fields){const row=E('div',null,'presenta-aspetto-campi');for(const f of fields)row.append(numero(parent,...f));parent.append(row);}
  const attivo=gruppo('Step attivo');colore(attivo,'Colore del testo attivo','activeTextColor',null);colore(attivo,'Colore della grafica attiva','activeGraphicColor',null);misure(attivo,[['Opacità della grafica attiva','activeGraphicOpacity',null,0,100]]);if(block.variant!=='progress'){colore(attivo,'Sfondo dello step attivo','activeBackground');misure(attivo,[['Opacità dello sfondo attivo','activeBackground','opacity',0,100]]);}
  const dimensioni=gruppo('Dimensioni e spazi');misure(dimensioni,[...(block.variant==='steps'?[['Dimensione dei numeri','markerSize',null,12,80]]:[]),['Distanza tra gli step','gap',null,0,32]]);
  if(block.variant==='progress'){const linea=gruppo('Linea di avanzamento');colore(linea,'Colore della linea','line');misure(linea,[['Spessore della linea','line','width',0,16],['Opacità della linea inattiva','line','opacity',0,100]]);}
  const separatori=gruppo('Separatori');separatori.append(E('p','Tra gli step: verticali nella navbar orizzontale, orizzontali nella navbar verticale. Spessore 0 per nasconderli.','presenta-aiuto-comuni'));colore(separatori,'Colore dei separatori','separator');misure(separatori,[['Spessore dei separatori','separator','width',0,16],['Opacità dei separatori','separator','opacity',0,100]]);
  if(block.variant!=='progress'){const forme=gruppo('Bordo e sfondo delle forme');colore(forme,'Colore del bordo','border');colore(forme,'Sfondo delle forme','background');misure(forme,[['Spessore del bordo','border','width',0,16],['Opacità del bordo','border','opacity',0,100],['Opacità delle forme','background','opacity',0,100]]);}
  return box;
 }
 async function disegnoVettoriale(block){
  fineScrittura();nascondiBubble();const documento=D.documento.id,sid=slideId;await LavagnaUI.carica();if(D.documento?.id!==documento||slideId!==sid)return;
  const dialog=E('dialog',null,'presenta-disegno-dialog tbar-ctl'),bar=E('div',null,'tbar'),tela=E('div',null,'presenta-disegno-tela'),errore=E('output',null,'presenta-stato');dialog.setAttribute('aria-label','Disegno vettoriale');errore.setAttribute('role','status');let disegno,busy=false;
  const annulla=testoBottone('Annulla disegno','x',()=>dialog.close()),salva=testoBottone(block?'Aggiorna disegno':'Inserisci disegno','check',async()=>{
   if(busy||!disegno?.api)return;busy=true;salva.disabled=true;try{
    if(D.documento?.id!==documento||slideId!==sid)throw Error('La presentazione è cambiata. Chiudi e riapri il disegno.');
    const scene=LimModello.scena({elements:disegno.api.getSceneElements(),appState:{},files:{}}).elements;
    if(!scene.length)throw Error('Disegna almeno un elemento prima di inserire.');
    const nonVettoriali=scene.some(e=>!['rectangle','diamond','ellipse','arrow','line','freedraw','text'].includes(e.type)||e.link);if(nonVettoriali)throw Error('Usa forme, frecce, testo o disegno libero senza collegamenti.');
    const svg=await LimEditor.exportToSvg({elements:scene,appState:{...disegno.api.getAppState(),exportBackground:false,exportWithDarkMode:false},files:{},exportPadding:8,exportEmbedScene:false,skipInliningFonts:true});
    // ponytail: font di sistema nel disegno; i font della slide restano nei normali oggetti di testo.
    function leggi(e){if(!M.vettori.TAG.includes(e.localName))return [];const attrs={};for(const a of e.attributes){const v=a.name==='font-family'?'Arial, Helvetica, sans-serif':a.value;if(M.vettori.attributo(a.name,v))attrs[a.name]=v;}for(const k of e.style||[]){const v=e.style.getPropertyValue(k);if(M.vettori.attributo(k,v))attrs[k]=v;}const text=[...e.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('');return [{tag:e.localName,attrs,...(text?{text}:{}),children:[...e.children].flatMap(leggi)}];}
    const drawing={viewBox:svg.getAttribute('viewBox'),nodes:[...svg.children].flatMap(leggi),scene};if(!M.vettori.valida(drawing))throw Error('Il disegno supera i limiti supportati. Riduci il numero di elementi.');
    if(!dialog.open)return;if(D.documento?.id!==documento||slideId!==sid)throw Error('La presentazione è cambiata.');
    if(block)cambiaBlocco(block.id,{drawing});else{const d=op({tipo:'inserisciBlocco',block:{type:'drawing',slot:'body',drawing,style:{box:{x:15,y:25,width:70,height:60}}}},{struttura:true});scegliBlocco(M.trova(d,slideId).slide.blocks.at(-1).id);}dialog.close();campiSlide();
   }catch(e){errore.textContent=e.message;}finally{busy=false;salva.disabled=false;}
  });salva.disabled=true;bar.append(E('strong','Disegno vettoriale'),E('span',null,'tbspazio'),annulla,salva);dialog.append(bar,E('p','Forme e tratti restano vettoriali. Il testo del disegno viene reso in Arial.','presenta-aiuto-comuni'),tela,errore);document.body.append(dialog);dialog.showModal();
  dialog.addEventListener('close',()=>{disegno?.smonta();dialog.remove();},{once:true});
  disegno=LimEditor.monta(tela,{data:{elements:block?.drawing.scene||[],appState:{viewBackgroundColor:'#fbfbfa',currentItemFontFamily:2,exportBackground:false},scrollToContent:true},ready:()=>{salva.disabled=false;},onChange:()=>{},link:()=>{}});
 }
 function ordineAnimazioni(){return PresentaAnimazioni.normalizza(PresentaAnimazioni.sequenza(posizione().slide.animations).map(({indice,...a})=>a));}
 function animazioniOggetto(block){
  const A=PresentaAnimazioni,details=E('details',null,'presenta-animazioni tbar-ctl'),contenuto=E('div',null,'presenta-animazioni-controlli'),lista=E('div',null,'presenta-animazioni-elenco'),azioni=ordineAnimazioni(),tempi=A.tempi(azioni);
  const apri=E('summary',null,'tbtn');UiIcone.imposta(apri,'chevron-right');apri.append(E('span','Animazioni'));details.dataset.pannello='oggetto';details.append(apri,contenuto);
  const toolbar=E('div',null,'tbar presenta-animazioni-toolbar');toolbar.append(testoBottone('Scegli un’animazione','plus',()=>galleriaAnimazioni(block)),testoBottone('Prova la slide','play',provaAnimazioni));contenuto.append(toolbar);
  if(!azioni.some(a=>a.targetId===block.id))contenuto.append(E('p','Nessuna animazione su questo oggetto. Scegli un effetto e guardalo prima di applicarlo.','presenta-animazioni-vuoto'));
  for(const [i,a]of azioni.entries()){
   if(a.targetId!==block.id)continue;
   const row=E('div',null,'presenta-azione'),aggiorna=patch=>{const copia=ordineAnimazioni();copia[i]={...copia[i],...patch};op({tipo:'animazioni',animations:copia},{struttura:true});};
   row.setAttribute('role','group');row.setAttribute('aria-label','Animazione '+(i+1)+' · '+A.effetti[a.effect].nome);
   const nome=testoBottone(A.effetti[a.effect].nome,'layers',()=>galleriaAnimazioni(block,i));nome.setAttribute('aria-label','Cambia animazione '+(i+1));nome.classList.add('presenta-effetto-scelto');nome.title=A.effetti[a.effect].descrizione;
   const avvio=campo('Avvio',a.start,v=>aggiorna({start:v}),{opzioni:i?[['click','Al clic'],['with','Insieme al precedente'],['after','Dopo il precedente']]:[['click','Al clic']]}),durata=campo('Durata (s)',A.durata(a),v=>aggiorna({duration:Number(v)}),{tipo:'number',min:.1,max:20,step:.1}),attesa=campo('Attesa (s)',a.delay||0,v=>aggiorna({delay:Number(v)}),{tipo:'number',min:0,max:20,step:.1});
   const prima=azioni[i-1],bersaglio=prima&&posizione().slide.blocks.find(b=>b.id===prima.targetId),nomeBersaglio=bersaglio?({title:'Titolo',text:'Testo',list:'Elenco',table:'Tabella',image:'Immagine',shape:'Forma',math:'Formula',audio:'Audio',video:'Video'}[bersaglio.type]):'Oggetto';avvio.title=i?'Precedente: '+A.effetti[prima.effect].nome+' · '+(bersaglio?.type==='title'?'Titolo':bersaglio?.type==='table'?'Tabella':bersaglio?.type==='image'?'Immagine':'Oggetto '+i):'Il primo effetto parte con il primo clic';attesa.title='Pausa prima di questo effetto, in secondi';durata.title='Tempo totale dell’effetto, inclusa la comparsa in sequenza';
   const etichetta=E('div',null,'presenta-effetto-nome');etichetta.append(E('span','Clic '+a.step+' · effetto '+(i+1)),nome);row.append(etichetta,avvio,durata,attesa);
   if(a.effect.startsWith('path-'))row.append(campo('Distanza',a.distance||80,v=>aggiorna({distance:Number(v)}),{opzioni:[[40,'Breve'],[80,'Media'],[160,'Ampia']]}));
   const comandi=E('div',null,'tbar');for(const [delta,label,icon]of [[-1,'Prima','chevron-up'],[1,'Dopo','chevron-down']]){const bt=b('Sposta effetto '+(i+1)+' '+label.toLowerCase(),icon,()=>{const copia=ordineAnimazioni();[copia[i],copia[i+delta]]=[copia[i+delta],copia[i]];op({tipo:'animazioni',animations:copia},{struttura:true});});bt.disabled=i+delta<0||i+delta>=azioni.length;bt.dataset.vuoto=String(bt.disabled);comandi.append(bt);}comandi.append(b('Rimuovi effetto '+(i+1),'trash-2',()=>op({tipo:'animazioni',animations:ordineAnimazioni().filter((_,n)=>n!==i)},{struttura:true})));row.append(comandi);lista.append(row);
   const testo=E('p',a.start==='click'?'Parte al clic '+a.step+'.':(a.start==='with'?'Insieme a':'Dopo')+' «'+A.effetti[prima.effect].nome+'» ('+nomeBersaglio+', effetto '+i+') · clic '+a.step+'.','presenta-tempo-effetto');testo.title='Inizio '+tempi[i].inizio.toFixed(1)+' s · fine '+tempi[i].fine.toFixed(1)+' s dal clic';lista.append(testo);
  }
  contenuto.append(lista);return details;
 }
 function campioneAnimazione(id){
  const box=E('div',null,'presenta-campione-animazione'),oggetto=E('div',null,'presenta-demo-oggetto');box.setAttribute('aria-hidden','true');box.append(oggetto);
  if(id.startsWith('table-'))oggetto.innerHTML='<table><tr><th>Pianeta</th><th>Lune</th></tr><tr><td>Terra</td><td>1</td></tr><tr><td>Marte</td><td>2</td></tr></table>';
  else if(id==='list-items')oggetto.innerHTML='<ul><li>Osserva</li><li>Confronta</li><li>Spiega</li></ul>';
  else if(id==='draw')oggetto.innerHTML='<svg class="presenta-forma" viewBox="0 0 100 60" fill="currentColor"><path d="M5 23H65V5L95 30L65 55V37H5Z"/></svg>';
  else if(id.startsWith('path-')){oggetto.innerHTML='<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="17" fill="currentColor"/><ellipse cx="24" cy="24" rx="23" ry="7" fill="none" stroke="currentColor" stroke-width="2"/></svg>';oggetto.classList.add('presenta-demo-pianeta');}
  else oggetto.innerHTML='<span class="presenta-testo">La Terra<br>gira intorno al Sole</span>';
  return {box,oggetto};
 }
 async function galleriaAnimazioni(block,indice=null){
  const A=PresentaAnimazioni,documento=D.documento.id,sid=slideId,dialog=E('dialog',null,'presenta-galleria-animazioni tbar-ctl'),bar=E('div',null,'tbar'),filtri=E('div',null,'tbar presenta-filtri-animazioni'),griglia=E('div',null,'presenta-galleria-effetti'),footer=E('div',null,'presenta-galleria-footer'),descrizione=E('p'),esempio=E('div',null,'presenta-esempio-grande');
  const runtime=await call({azione:'strumenti'}),supportati=Array.isArray(runtime.effetti)?runtime.effetti:[];if(D.documento?.id!==documento||slideId!==sid)return;
  let scelto=indice===null?'fade-in':ordineAnimazioni()[indice].effect,riproduzione=null,riproduzioneEl=null,campione=null,categoria='Tutti';
  dialog.setAttribute('aria-label','Galleria delle animazioni');
  function ferma(el){if(el&&el!==riproduzioneEl)return;riproduzione?.revert();riproduzione=null;riproduzioneEl=null;}
  function riproduci(id,el){ferma();riproduzioneEl=el;riproduzione=PresentaAnimazioniDOM.esegui(el,{effect:id,distance:28},{ridotto:matchMedia('(prefers-reduced-motion: reduce)').matches||D.documento.settings.reducedMotion});}
  function seleziona(id){ferma();scelto=id;const e=A.effetti[id];campione=campioneAnimazione(id);esempio.replaceChildren(campione.box);descrizione.textContent=e.descrizione+(A.disponibile(id,block.type)?'':' Scegli '+(e.tipi.includes('shape')?'una forma':e.tipi.includes('table')?'una tabella':e.tipi.includes('list')&&e.tipi.length===1?'un elenco':'un titolo o un testo')+' per applicare questo effetto.');if(A.disponibile(id,block.type)&&!A.disponibile(id,block.type,supportati))descrizione.textContent+=' Riavvia ZAINO per usare questo effetto.';applica.disabled=!A.disponibile(id,block.type,supportati);for(const b of griglia.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.effetto===id));riproduci(id,campione.oggetto);}
  function disegna(){griglia.replaceChildren();for(const e of A.catalogo){if(categoria!=='Tutti'&&e.gruppo!==categoria)continue;const c=campioneAnimazione(e.id),bt=b(e.nome,null,()=>seleziona(e.id));bt.dataset.effetto=e.id;bt.classList.add('presenta-effetto-card');bt.setAttribute('aria-pressed',String(e.id===scelto));bt.title=e.descrizione;bt.replaceChildren(c.box,E('span',e.nome));if(!A.disponibile(e.id,block.type))bt.append(E('small','Per '+(e.tipi.includes('shape')?'forme':e.tipi.includes('table')?'tabelle':e.tipi.length===1?'elenchi':'testi')));if(A.disponibile(e.id,block.type)&&!A.disponibile(e.id,block.type,supportati))bt.append(E('small','Richiede riavvio'));bt.addEventListener('pointerenter',()=>riproduci(e.id,c.oggetto));bt.addEventListener('focus',()=>riproduci(e.id,c.oggetto));bt.addEventListener('pointerleave',()=>ferma(c.oggetto));griglia.append(bt);}}
  for(const gruppo of ['Tutti',...new Set(A.catalogo.map(e=>e.gruppo))]){const bt=b(gruppo,null,()=>{categoria=gruppo;ferma();for(const e of filtri.children)e.setAttribute('aria-pressed',String(e===bt));disegna();});bt.setAttribute('aria-pressed',String(gruppo===categoria));filtri.append(bt);}
  const applica=testoBottone(indice===null?'Applica all’oggetto':'Sostituisci effetto','check',()=>{if(D.documento?.id!==documento||slideId!==sid||!posizione().slide.blocks.some(b=>b.id===block.id))throw Error('La slide è cambiata. Riapri la galleria.');if(!A.disponibile(scelto,block.type,supportati))throw Error('Riavvia ZAINO per usare questo effetto.');const azioni=ordineAnimazioni(),a={targetId:block.id,effect:scelto,duration:A.effetti[scelto].durata,start:'click',step:Math.max(0,...azioni.map(a=>a.step))+1};if(indice===null)azioni.push(a);else azioni[indice]={...azioni[indice],effect:scelto,duration:a.duration};op({tipo:'animazioni',animations:azioni},{struttura:true});dialog.close();});
  bar.append(E('strong','Scegli un’animazione'),E('span',null,'tbspazio'),b('Chiudi galleria','x',()=>dialog.close()));const azioni=E('div',null,'tbar');azioni.append(testoBottone('Rivedi esempio','play',()=>riproduci(scelto,campione.oggetto)),applica);footer.append(esempio,descrizione,azioni);dialog.append(bar,filtri);if(A.catalogo.some(e=>!supportati.includes(e.id))){const avviso=E('p','ZAINO è stato aggiornato: salva le modifiche, poi chiudi e riapri l’app per attivare tutti gli effetti.','presenta-runtime-avviso');avviso.setAttribute('role','status');dialog.append(avviso);}dialog.append(griglia,footer);document.body.append(dialog);dialog.addEventListener('close',()=>{ferma();dialog.remove();},{once:true});dialog.showModal();disegna();seleziona(scelto);
 }
 async function provaAnimazioni(){
  fineScrittura();const d=D.documento,p=coordinate(),r=await call({azione:'vista',documento:d});if(D.documento?.id!==d.id)return;
  const dialog=E('dialog',null,'presenta-materiali presenta-prova-animazioni'),bar=E('div',null,'tbar'),preview=E('iframe'),canaleProva=crypto.randomUUID();dialog.setAttribute('aria-label','Prova le animazioni della slide');dialog.dataset.pronto='false';preview.title='Anteprima delle animazioni';preview.setAttribute('sandbox','allow-scripts');preview.allow='autoplay';preview.style.aspectRatio=d.settings.width+'/'+d.settings.height;preview.src=frame.src;
  const invia=o=>preview.contentWindow.postMessage({presenta:canaleProva,...o},'*');const rinizia=()=>invia({tipo:'vai',posizione:{...p,fragmentIndex:-1}});
  bar.append(E('strong','Prova la slide'),E('span',null,'tbspazio'),testoBottone('Ricomincia','undo-2',rinizia),testoBottone('Indietro','chevron-left',()=>invia({tipo:'passoAnimazione',indietro:true})),testoBottone('Avanti','chevron-right',()=>invia({tipo:'passoAnimazione'})),b('Chiudi prova','x',()=>dialog.close()));
  const controlli=[...bar.querySelectorAll('button')].slice(0,-1);controlli.forEach(b=>b.disabled=true);const statoProva=E('output','Caricamento della slide…','presenta-stato');statoProva.setAttribute('role','status');bar.append(statoProva);
  const ascolta=e=>{if(e.source!==preview.contentWindow)return;if(e.data?.tipo==='presenta-caricato')invia({tipo:'quadro',documento:r.documento,posizione:{...p,fragmentIndex:-1},provaAnimazioni:true});if(e.data?.presenta!==canaleProva)return;if(e.data.tipo==='pronto'){dialog.dataset.pronto='true';controlli.forEach(b=>b.disabled=false);statoProva.textContent='Usa Avanti e Indietro per provare i clic.';}if(e.data.tipo==='errore')statoProva.textContent=e.data.error;};window.addEventListener('message',ascolta);dialog.append(bar,preview);document.body.append(dialog);dialog.addEventListener('close',()=>{window.removeEventListener('message',ascolta);dialog.remove();},{once:true});dialog.showModal();
 }

 function modificaTabella(id){
  const documentoId=D.documento.id,sid=posizione().slide.id,originale=posizione().slide.blocks.find(b=>b.id===id),dialog=E('dialog',null,'presenta-materiali presenta-tabella-dialog'),bar=E('div',null,'tbar'),celle=E('div',null,'presenta-tabella-celle'),dimensioni=E('div',null,'tbar');let valori=M.copia(originale.table);
  function disegna(){celle.replaceChildren();celle.style.gridTemplateColumns='repeat('+valori[0].length+',minmax(120px,1fr))';valori.forEach((r,i)=>r.forEach((v,j)=>celle.append(campo('Riga '+(i+1)+' · colonna '+(j+1),v,t=>valori[i][j]=t,{maxLength:2000,espanso:true}))));}
  function togli(asse){if((asse==='riga'?valori.length:valori[0].length)<=1)return;const pieni=asse==='riga'?valori.at(-1).some(Boolean):valori.some(r=>r.at(-1));if(pieni&&!confirm('Eliminare '+(asse==='riga'?'l’ultima riga':'l’ultima colonna')+' e il suo contenuto?'))return;if(asse==='riga')valori.pop();else valori.forEach(r=>r.pop());disegna();}
  bar.append(E('strong','Tabella'),E('span',null,'tbspazio'),testoBottone('Annulla tabella','x',()=>dialog.close()),testoBottone('Applica tabella','check',()=>{if(D.documento?.id!==documentoId||posizione()?.slide.id!==sid||!posizione().slide.blocks.some(b=>b.id===id))throw Error('La slide è cambiata. Riapri la tabella.');cambiaBlocco(id,{table:valori});campiSlide();dialog.close();}));
  dimensioni.append(testoBottone('+ Riga','plus',()=>{if(valori.length>=20)return;valori.push(valori[0].map(()=>''));disegna();}),testoBottone('+ Colonna','plus',()=>{if(valori[0].length>=10)return;valori.forEach(r=>r.push(''));disegna();}),testoBottone('Rimuovi ultima riga',null,()=>togli('riga')),testoBottone('Rimuovi ultima colonna',null,()=>togli('colonna')));dialog.append(bar,dimensioni,celle);disegna();document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
 }
 async function frammentoMedia(id){
  fineScrittura();const d=D.documento,s=posizione().slide,block=s.blocks.find(b=>b.id===id),z=corso,r=await call({azione:'vista',documento:d});if(corso!==z||D.documento?.id!==d.id)return;
  const dom=new DOMParser().parseFromString(r.documento.html,'text/html'),src=dom.querySelector('[data-block-id="'+id+'"] '+block.type)?.getAttribute('src')?.split('#')[0];if(!src)throw Error('Media non disponibile.');
  const dialog=E('dialog',null,'presenta-materiali presenta-clip-dialog'),bar=E('div',null,'tbar'),vista=E('iframe',null,'presenta-clip-anteprima'),controlli=E('div',null,'presenta-clip-controlli'),stato=E('output',null,'presenta-stato'),token=crypto.randomUUID();let durata=0;
  const invia=o=>vista.contentWindow.postMessage({presenta:token,...o},'*');vista.setAttribute('sandbox','allow-scripts');vista.title='Anteprima del frammento';vista.src=frame.src;
  const inizio=campo('Inizio del frammento',block.start||0,()=>aggiorna(),{tipo:'range',min:0,max:1,step:.1}),fine=campo('Fine del frammento',block.end||1,()=>aggiorna(),{tipo:'range',min:0,max:1,step:.1});
  const a=inizio.querySelector('input'),b=fine.querySelector('input');a.disabled=b.disabled=true;
  function aggiorna(){if(!durata)return;const start=Number(a.value),end=Number(b.value);applica.disabled=!(start<end);stato.textContent=start.toFixed(1)+' s → '+end.toFixed(1)+' s · durata '+Math.max(0,end-start).toFixed(1)+' s';if(start<end)invia({tipo:'intervalloClip',start,end});}
  const applica=testoBottone('Applica frammento','check',()=>{if(!durata||Number(a.value)>=Number(b.value))throw Error('L’inizio deve precedere la fine.');if(corso!==z||D.documento?.id!==d.id||posizione()?.slide.id!==s.id||posizione().slide.blocks.find(b=>b.id===id)?.assetId!==block.assetId)throw Error('Il media è cambiato. Riapri il frammento.');cambiaBlocco(id,{start:Number(a.value),end:Number(b.value)});campiSlide();dialog.close();});applica.disabled=true;
  bar.append(E('strong','Frammento '+(block.type==='audio'?'audio':'video')),E('span',null,'tbspazio'),testoBottone('Annulla frammento','x',()=>dialog.close()),applica);
  controlli.append(inizio,fine,stato,testoBottone('Prova il frammento','play',()=>invia({tipo:'riproduciClip'})),testoBottone('Pausa frammento','pause',()=>invia({tipo:'pausaClip'})));
  const ascolta=e=>{if(e.source!==vista.contentWindow)return;if(e.data?.tipo==='presenta-caricato'){invia({tipo:'apriClip',src,mediaType:block.type});return;}if(e.data?.presenta!==token)return;if(e.data.tipo==='durataClip'){durata=e.data.duration;if(!Number.isFinite(durata)||durata<=0||durata>604800){stato.textContent='Durata non disponibile per questo media.';return;}a.max=b.max=String(durata);a.value=Math.min(block.start||0,Math.max(0,durata-.1));b.value=Math.min(block.end||durata,durata);a.disabled=b.disabled=false;aggiorna();}if(e.data.tipo==='errore')stato.textContent=e.data.error;};
  window.addEventListener('message',ascolta);dialog.append(bar,vista,controlli);document.body.append(dialog);dialog.addEventListener('close',()=>{window.removeEventListener('message',ascolta);dialog.remove();},{once:true});dialog.showModal();
 }
 async function ritagliaImmagine(id){
  const d=D.documento,s=posizione().slide,b=s.blocks.find(b=>b.id===id);if(!b||!quadro)return;
  const zaino=corso,r=await call({azione:'immagineRitaglio',documento:d,blockId:id});if(corso!==zaino||D.documento?.id!==d.id||posizione()?.slide.id!==s.id)return;const src=r.immagine;
  const dialog=E('dialog',null,'presenta-materiali presenta-ritaglio-dialog'),bar=E('div',null,'tbar'),area=E('div',null,'presenta-ritaglio-editor'),img=E('img'),crop=E('div',null,'presenta-area-ritaglio'),comandi=E('div',null,'tbar presenta-bar'),stato=E('p',null,'presenta-aiuto');
  let valore=null,gesto=null;stato.setAttribute('role','status');img.alt=b.alt||'Immagine da ritagliare';img.draggable=false;crop.tabIndex=0;crop.setAttribute('role','group');crop.setAttribute('aria-label','Area del ritaglio');crop.title='Trascina i bordi per cambiare proporzioni. Le frecce spostano il ritaglio; Alt e frecce lo ridimensionano.';
  const disegna=()=>{if(!valore)return;Object.assign(crop.style,{left:valore.x+'%',top:valore.y+'%',width:valore.width+'%',height:valore.height+'%'});stato.textContent='Ritaglio: '+Math.round(valore.width)+'% × '+Math.round(valore.height)+'% dell’immagine originale.';};
  const applica=(c)=>{const corrente=D.documento;if(corrente?.id!==d.id||posizione()?.slide.id!==s.id||!posizione().slide.blocks.some(x=>x.id===id))throw Error('La slide è cambiata. Riapri il ritaglio.');const attuale=posizione().slide.blocks.find(x=>x.id===id);if(attuale.assetId!==b.assetId)throw Error('L’immagine è cambiata. Riapri il ritaglio.');const nuovo={...attuale};if(c)nuovo.crop=c;else delete nuovo.crop;op({tipo:'blocco',blockId:id,block:nuovo},{struttura:true});dialog.close();};
  const conferma=testoBottone('Applica ritaglio',null,()=>{if(valore)applica(valore);});conferma.disabled=true;
  bar.append(E('strong','Ritaglia immagine'),E('span',null,'tbspazio'),bottoneChiudi());function bottoneChiudi(){return testoBottone('Annulla ritaglio','x',()=>dialog.close());}
  for(const [nome,ratio]of [['1:1',1],['4:3',4/3],['16:9',16/9],['3:4',3/4]])comandi.append(testoBottone(nome,null,()=>{if(valore){valore=M.proporzioneRitaglio(valore,ratio);disegna();}}));
  comandi.append(testoBottone('Immagine intera',null,()=>{if(valore){valore={x:0,y:0,width:100,height:100,aspect:valore.aspect};disegna();}}),testoBottone('Rimuovi ritaglio',null,()=>applica(null)),conferma);
  for(const lato of ['nw','n','ne','e','se','s','sw','w']){const h=E('span',null,'presenta-crop-maniglia');h.dataset.lato=lato;h.setAttribute('aria-hidden','true');crop.append(h);}
  area.append(img,crop);dialog.append(bar,area,stato,comandi);host.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
  img.onload=()=>{valore=b.crop?M.copia(b.crop):{x:0,y:0,width:100,height:100,aspect:r.width/r.height};if(!M.ritaglioValido(valore)){stato.textContent='Proporzioni dell’immagine non supportate.';return;}conferma.disabled=false;area.style.aspectRatio=r.width+'/'+r.height;area.style.width=Math.min(560,innerHeight*.5*r.width/r.height)+'px';disegna();};img.onerror=()=>{stato.textContent='Immagine non disponibile. Chiudi e riprova.';};img.src=src;
  crop.addEventListener('pointerdown',e=>{if(!valore||e.button!==0||gesto)return;e.preventDefault();crop.focus();crop.setPointerCapture(e.pointerId);gesto={pointer:e.pointerId,x:e.clientX,y:e.clientY,prima:M.copia(valore),lato:e.target.dataset.lato||'sposta',area:area.getBoundingClientRect()};});
  crop.addEventListener('pointermove',e=>{if(gesto?.pointer!==e.pointerId)return;valore=M.ritaglia(gesto.prima,(e.clientX-gesto.x)/gesto.area.width*100,(e.clientY-gesto.y)/gesto.area.height*100,gesto.lato);disegna();});
  const termina=(e,annulla=false)=>{if(gesto?.pointer!==e.pointerId)return;if(annulla)valore=gesto.prima;gesto=null;if(crop.hasPointerCapture(e.pointerId))crop.releasePointerCapture(e.pointerId);disegna();};crop.addEventListener('pointerup',e=>termina(e));crop.addEventListener('pointercancel',e=>termina(e,true));crop.addEventListener('lostpointercapture',e=>termina(e,true));
  crop.addEventListener('keydown',e=>{if(!valore||!e.key.startsWith('Arrow'))return;e.preventDefault();const d=e.shiftKey?5:1;valore=M.ritaglia(valore,({ArrowLeft:-d,ArrowRight:d})[e.key]||0,({ArrowUp:-d,ArrowDown:d})[e.key]||0,e.altKey?'se':'sposta');disegna();});
 }
 function muoviBlocco(id,delta){const s=posizione().slide,index=s.blocks.findIndex(b=>b.id===id)+delta;if(index<0||index>=s.blocks.length)return;op({tipo:'spostaBlocco',blockId:id,index},{struttura:true});}
 function aggiungi(tipo,direzione,modello){const prima=new Set(M.posizioni(D.documento).map(p=>p.slide.id));op({tipo,direzione,...(modello?{modello}:{})},{struttura:true,seleziona:d=>M.posizioni(d).find(p=>!prima.has(p.slide.id)).slide.id});scegliBlocco('@titolo');}
 function scegliModello(){
  const documentoId=D.documento.id,origine=posizione().slide.id;
  const dialog=E('dialog',null,'presenta-materiali presenta-scelta-modello'),testata=E('div',null,'tbar');testata.append(E('strong','Nuova slide'),E('span',null,'tbspazio'),b('Chiudi modelli','x',()=>dialog.close()));dialog.append(testata);
  const lista=E('div',null,'presenta-modelli');for(const [id,nome]of Object.entries(M.MODELLI)){const bt=b(nome,null,()=>{dialog.close();if(D.documento?.id!==documentoId||posizione()?.slide.id!==origine)throw Error('La slide è cambiata. Scegli di nuovo il modello.');aggiungi('aggiungiSlide','destra',id);campi.querySelector('input')?.focus();});bt.classList.add('presenta-modello');bt.dataset.modello=id;const mini=E('div',null,'presenta-schema-modello');mini.setAttribute('aria-hidden','true');for(const block of M.daModello(id,posizione().slide).blocks){const r=block.style.box,segno=E('i');Object.assign(segno.style,{left:r.x+'%',top:r.y+'%',width:r.width+'%',height:r.height+'%'});segno.dataset.titolo=String(block.type==='title');mini.append(segno);}bt.prepend(mini);lista.append(bt);}dialog.append(lista);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
 }
 function comandoOggetto(cmd){
  if(!D.documento||occupato||D.bloccato)return;nascondiBubble();
  if(gruppo.length>1&&['duplica','elimina'].includes(cmd)){const ids=[...gruppo];gruppo=[];op({tipo:'gruppo',ids,comando:cmd},{struttura:true});return;}
  if(cmd==='copia'&&gruppo.length>1){window.toast?.('Per copiare, seleziona un solo oggetto. Duplica selezionati mantiene il gruppo sulla slide.',false);return;}
  if(cmd==='copia'){appuntiOggetto=M.copiaOggetto(D.documento,posizione().slide.id,bloccoId);window.toast?.('Oggetto copiato. Puoi incollarlo in un’altra slide.',true);return;}
  if(cmd==='incolla'){const d=op({tipo:'incollaOggetto',appunti:appuntiOggetto},{struttura:true});scegliBlocco(M.trova(d,slideId).slide.blocks.at(-1).id);return;}
  if(cmd==='elimina'){const block=posizione().slide.blocks.find(b=>b.id===bloccoId);op(M.comune(block)?{tipo:'eliminaComune',type:block.type}:{tipo:'eliminaBlocco',blockId:bloccoId},{struttura:true});return;}
  if(cmd==='duplica'){const d=op({tipo:'duplicaBlocco',blockId:bloccoId},{struttura:true});scegliBlocco(M.trova(d,slideId).slide.blocks.at(-1).id);}
 }
 function tastoOggetto(e){
  if(e.target.closest?.('input,textarea,select,[contenteditable=true]'))return false;
  const key=e.key.toLowerCase(),cmd=(e.metaKey||e.ctrlKey)?({c:'copia',v:'incolla',d:'duplica'})[key]:['Delete','Backspace'].includes(e.key)?'elimina':null;
  if(!cmd||!D.documento||(cmd!=='incolla'&&!posizione().slide.blocks.some(b=>b.id===bloccoId))||(cmd==='incolla'&&appuntiOggetto?.documentId!==D.documento.id))return false;
  e.preventDefault();e.stopPropagation();azione(()=>comandoOggetto(cmd));return true;
 }
 function sposta(delta){const p=posizione();if(p.v===0){if(p.h+delta<0||p.h+delta>=D.documento.stacks.length)return;op({tipo:'spostaArgomento',delta},{struttura:true});}
  else{const index=p.v+delta;if(index<1||index>=p.stack.slides.length)return;op({tipo:'spostaSlide',stackId:p.stack.id,index},{struttura:true});}}
 async function ricaricaLista(){const z=corso,n=++giro;if(!z)return;const r=await call({azione:'elenco'},z);if(n!==giro||z!==corso)return;elenco=r.elenco;disegna();}
 async function carica(d){fineScrittura();appuntiOggetto=null;selezioneGiro++;bloccoId='';richiestaMisure=null;D.apri(d);slideId=d.stacks[0].slides[0].id;bloccoId=d.stacks[0].slides[0].blocks.find(b=>b.type==='title')?.id||'@titolo';miniature.clear();scalettaFirma='';firma='';quadro=null;campiSlide();disegna();}
 async function apri(id){if(occupato)return;const z=corso;occupato=true;disegna();try{await salvaTutto();if(z!==corso)return;const r=await call({azione:'apri',id},z);if(z!==corso)return;
  await carica(r.documento);const b=r.bozza;if(b&&b.baseRevision===r.documento.revision&&JSON.stringify(b.documento)!==JSON.stringify(r.documento)&&confirm('È disponibile una bozza non salvata di questa presentazione. Recuperarla?')){D.recupera(b.documento);campiSlide();disegna();}
  await ricaricaLista();
 }finally{occupato=false;disegna();}}
 async function nuova(){if(occupato)return;const title=await window.askText('Titolo della presentazione','Nuova presentazione');if(title===null)return;if(!title.trim())throw Error('Scrivi un titolo.');const z=corso;occupato=true;disegna();try{await salvaTutto();if(z!==corso)return;const r=await call({azione:'crea',title:title.trim()},z);if(z!==corso)return;await carica(r.documento);await ricaricaLista();}finally{occupato=false;disegna();}}
 async function pronta(){const z=corso,id=D.documento?.id;if(!id)throw Error('Crea o apri una presentazione.');await salvaTutto();fineScrittura();if(z!==corso||id!==D.documento?.id)throw Error('La presentazione è cambiata durante il salvataggio. Ripeti il comando.');return {d:D.documento,z};}
 async function rinomina(){const t=await askText('Titolo della presentazione',D.documento.title);if(t!==null){modifica({tipo:'titolo',title:t.trim()});await salvaTutto();await ricaricaLista();}}
 async function chiudi(){await salvaTutto();fineScrittura();selezioneGiro++;await call({azione:'lascia'});D.svuota();slideId='';previewGiro++;firma='';quadro=null;frame.contentWindow.postMessage({presenta:canale,tipo:'quadro',documento:{html:'',settings:{width:1280,height:720,theme:'zaino-light',navigationMode:'default'}}},'*');campiSlide();disegna();}
 async function elimina(){if(!confirm('Spostare questa presentazione e i suoi media nel Cestino di sistema?'))return;const {d,z}=await pronta();await call({azione:'lascia'},z);await call({azione:'elimina',id:d.id},z);if(z!==corso)return;D.svuota();await ricaricaLista();}
 function tooltipMedia(){return 'Massimo '+(M.LIMITE_MEDIA/1024/1024)+' MiB per file ('+M.LIMITE_MEDIA.toLocaleString('it-IT')+' byte). Immagini, GIF e video; la riproduzione video dipende dal codec. Come sfondo, il video parte in loop e senza audio.';}
 async function importaFile(sostituisci=null,sfondo=false){if(!(await call({azione:'strumenti'})).importaFile)throw Error('Riavvia ZAINO per caricare dal computer.');return importa(null,sostituisci,sfondo,true);}
 async function importa(trasporto,sostituisci=null,sfondo=null,locale=false){
  if(typeof trasporto==='string')trasporto=JSON.parse(trasporto);
  if(!D.documento)throw Error('Crea o apri prima una presentazione.');const z=corso,id=D.documento.id,sid=posizione().slide.id,n=selezioneGiro;
  await salvaTutto();const r=await call({azione:locale?'file':'materiale',id,...(locale?{}:{trasporto}),baseRevision:D.documento.revision},z);if(r.annullato)return;
  if(z!==corso||id!==D.documento?.id||sid!==posizione()?.slide.id||n!==selezioneGiro)throw Error('La slide è cambiata durante il caricamento. Ripeti l’inserimento.');
  if(sfondo){if(!r.asset||!['image','video'].includes(r.asset.kind)||sfondo!==true&&r.asset.kind!==sfondo)throw Error('Scegli un’immagine, una GIF o un video del tipo richiesto.');op({tipo:'sfondoMedia',asset:r.asset,assetId:r.assetId,backgroundMedia:{assetId:r.assetId,fit:'cover',loop:true,muted:true}},{struttura:true});scegliBlocco('');return;}
  const doc=op({tipo:sostituisci?'sostituisciMedia':'inserisciBlocco',...(sostituisci?{blockId:sostituisci}:{}),block:r.block,...(r.asset?{asset:r.asset,assetId:r.assetId}:{})},{struttura:true});scegliBlocco(sostituisci||M.trova(doc,sid).slide.blocks.at(-1).id);
 }
 async function scegliMateriale(sostituisci=null,sfondo=null){
  if(sfondo&&!(await call({azione:'strumenti'})).sfondiMedia)throw Error('Riavvia ZAINO per usare immagini e video come sfondo.');
  const voci=[];for(const e of (window.vault.evidenze.leggi(corso)?.evidenze||[]).filter(e=>window.kwEParolaChiave(e)))voci.push({label:'Parola · '+(e.exact||e.id).slice(0,80),t:LimModello.trasporto('keyword',e.id,corso)});
  for(const e of window.vault.album.elenco(corso)?.voci||[])voci.push({label:'Immagine · '+(e.didascalia||e.titolo||e.title||e.id),t:LimModello.trasporto('album',e.id,corso)});
  const media=await window.vault.media.elenco(corso);for(const e of Array.isArray(media)?media:media?.elenco||[])voci.push({label:(e.tipo==='audio'?'Audio':'Video')+' · '+(e.nome||e.name||e.file),t:{version:1,tipo:e.tipo,file:e.file||e.nome||e.name,corso}});
  for(const v of voci)if(typeof v.t==='string')v.t=JSON.parse(v.t);
  if(sostituisci){const tipo=posizione().slide.blocks.find(b=>b.id===sostituisci)?.type;for(let i=voci.length-1;i>=0;i--)if(voci[i].t.tipo!==(tipo==='image'?'album':tipo))voci.splice(i,1);}
  if(sfondo)for(let i=voci.length-1;i>=0;i--)if(voci[i].t.tipo!==(sfondo==='image'?'album':'video'))voci.splice(i,1);
  if(!voci.length){window.toast?.(sfondo==='image'?'Aggiungi prima un’immagine o una GIF a MEDIA → Immagini.':sfondo==='video'?'Aggiungi prima un video a MEDIA → Video.':'Non ci sono ancora parole chiave o media in questo zaino.',false);return;}
  const scelta=await new Promise(resolve=>{
   const dialog=E('dialog',null,'lim-menu presenta-materiali'),bar=E('div',null,'tbar'),title=E('strong',sfondo==='image'?'Scegli immagine o GIF di sfondo':sfondo==='video'?'Scegli video di sfondo':'Inserisci dallo zaino');let scelta=null;
   bar.append(title,E('span',null,'tbspazio'),b('Chiudi inserimento','x',()=>dialog.close()));dialog.append(bar);
   for(const [i,v]of voci.entries()){const button=E('button',v.label,'lim-menu-voce');button.type='button';button.setAttribute('aria-label',v.label);button.onclick=()=>{scelta=i;dialog.close();};dialog.append(button);}
   dialog.addEventListener('close',()=>{dialog.remove();resolve(scelta);},{once:true});document.body.append(dialog);dialog.showModal();
  });if(scelta!==null)await importa(voci[scelta].t,sostituisci,sfondo);
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
  for(const d of elenco){const li=E('li',null,'zs-item'),button=E('button',d.title);button.type='button';button.title=d.title;button.dataset.materiale='presenta:'+d.id;button.onclick=()=>azione(async()=>{bancoMostra('presenta');await apri(d.id);});li.append(button);ul.append(li);}nav.append(section);window.znavIndicatori?.();
 }
 async function contesto(){
  const z=window.zainoAttivo?.()||'';if(z===corso)return;
  if(D.sporco||D.salvando)throw Error('Salva la presentazione prima di cambiare zaino.');
  fineScrittura();gruppo=[];if(corso)await call({azione:'lascia'});corso=z;giro++;selezioneGiro++;previewGiro++;clearTimeout(previewTimer);D.svuota();elenco=[];slideId='';regia=null;listaErrore='';firma='';quadro=null;campiSlide();disegna();
  if(!z)return;await ricaricaLista();let m;try{m=JSON.parse(localStorage.getItem(memoria())||'null');}catch(_){}
  if(m&&elenco.some(d=>d.id===m.id)){await apri(m.id);if(M.posizioni(D.documento).some(p=>p.slide.id===m.slideId))scegliSlide(m.slideId);}
 }
 function molla(){const errore=inputAperto?.salva();if(errore){window.toast?.(errore,false);return false;}if(D.sporco||D.salvando){window.toast?.('La presentazione contiene modifiche da salvare.',false);return false;}chiudiInput();D.svuota();slideId='';regia=null;return true;}
 function monta(){
  host=$('presentaPane');gobbo=$('gobboPane');if(!host||!gobbo)return;
  bar=E('div',null,'tbar presenta-bar');const sel=E('select');sel.id='presentaDocumenti';sel.setAttribute('aria-label','Apri presentazione');sel.onchange=()=>azione(()=>sel.value?apri(sel.value):chiudi());bar.append(sel);
  const documentoMenu=E('div',null,'presenta-voci-menu');documentoMenu.append(testoBottone('Nuova presentazione','plus',nuova),testoBottone('Rinomina presentazione','pencil',rinomina),testoBottone('Salva presentazione','save',()=>salvaTutto()),testoBottone('Esporta presentazione HTML','file-down',async()=>{const {d,z}=await pronta();const r=await call({azione:'esporta',id:d.id,baseRevision:d.revision},z);if(!r.annullato)toast('Presentazione esportata in '+r.cartella,true);}),testoBottone('Elimina presentazione','trash-2',elimina),testoBottone('Chiudi presentazione','x',chiudi));
  for(const [i,k]of ['nuova','rinomina','salva','esporta','elimina','chiudi'].entries()){bottoni[k]=documentoMenu.children[i];bottoni[k].dataset.presentaAction=k;}
  function apriMenu(contenuto,anchor){const r=anchor.getBoundingClientRect();contenuto.onclick=e=>{if(e.target.closest('button'))menuAperto?.hidePopover();};popup('',contenuto,r.left,r.bottom+4);}
  const documento=b('Documento',null,()=>apriMenu(documentoMenu,documento));documento.textContent='Documento';bar.append(documento,E('span',null,'tbsep'),b('Annulla nella presentazione','undo-2',()=>{fineScrittura();D.annulla();campiSlide();disegna();},'annulla'),b('Ripeti nella presentazione','redo-2',()=>{fineScrittura();D.ripeti();campiSlide();disegna();},'ripeti'));
  const inserimento=E('div',null,'presenta-voci-menu');inserimento.append(testoBottone('Aggiungi testo','type',()=>nuovoBlocco('text')),testoBottone('Aggiungi elenco','list',()=>nuovoBlocco('list')),testoBottone('Aggiungi formula','plus',()=>nuovoBlocco('math')),testoBottone('Aggiungi forma','plus',()=>nuovoBlocco('shape')),testoBottone('Aggiungi tabella','plus',()=>{nuovoBlocco('table');modificaTabella(bloccoId);}),testoBottone('Navbar','list',()=>inserisciComune('navbar')),testoBottone('Numera pagine','list',()=>inserisciComune('page-number')),testoBottone('Disegno vettoriale','pencil',()=>disegnoVettoriale()),testoBottone('Carica dal computer','plus',()=>importaFile()),testoBottone('Inserisci dallo zaino','image',scegliMateriale),testoBottone('Incolla oggetto','copy',()=>comandoOggetto('incolla')));
  const inserisci=testoBottone('Inserisci','plus',()=>{inserimento.lastElementChild.disabled=appuntiOggetto?.documentId!==D.documento?.id;apriMenu(inserimento,inserisci);});bottoni.inserisci=inserisci;bar.append(E('span',null,'tbsep'),inserisci,E('span',null,'tbspazio'));
  const proietta=testoBottone('Presenta','play',presenta);proietta.setAttribute('aria-label','Presenta a schermo intero');bottoni.presenta=proietta;bar.append(proietta,b('Apri GOBBO',null,()=>bancoMostra('gobbo'),'gobbo'));
  stato=E('div',null,'presenta-stato');stato.setAttribute('role','status');corpo=E('div',null,'presenta-corpo');vuoto=E('div',null,'presenta-vuoto');vuoto.append(E('h2','Costruisci la tua presentazione'),E('p'),b('Crea presentazione',null,nuova));
  editor=E('div',null,'presenta-editor');scaletta=E('nav',null,'presenta-scaletta');scaletta.setAttribute('aria-label','Slide della presentazione');
  const lavoro=E('div',null,'presenta-lavoro');frame=E('iframe',null,'presenta-anteprima');frame.title='Anteprima della slide';frame.setAttribute('sandbox','allow-scripts');call({azione:'frame'}).then(r=>{frame.src=r.url;}).catch(e=>window.toast?.(e.message,false));
  campi=E('div',null,'presenta-campi');avviso=E('p',null,'presenta-aiuto');avviso.setAttribute('role','status');avviso.hidden=true;oggettiNav=E('div',null,'tbar presenta-tabs');oggettiNav.setAttribute('role','group');oggettiNav.setAttribute('aria-label','Impostazioni di titolo, oggetti o sfondo');lavoro.append(frame,oggettiNav,avviso,campi);const sinistra=E('aside',null,'presenta-navigazione');sinistra.append(scaletta);editor.append(sinistra,lavoro);corpo.append(vuoto,editor);host.append(bar,stato,corpo);
  const note=campo('Appunti del presentatore · privati','',v=>{if(posizione())op({tipo:'slide',notes:{markdown:v}});},{tipo:'textarea',maxLength:100000,espanso:true});appuntiPopup=E('div',null,'popmenu presenta-menu presenta-appunti');appuntiPopup.popover='auto';appuntiPopup.append(note);host.append(appuntiPopup);bar.append(b('Appunti privati','pencil',()=>{note.querySelector('textarea').value=posizione()?.slide.notes.markdown||'';appuntiPopup.showPopover();}));
  fetch(new URL('assets/presentazioni/deck.css',document.baseURI)).then(r=>r.text()).then(css=>{const style=E('style');style.textContent='@scope (.presenta-mini) {'+css+'}';document.head.append(style);}).catch(e=>window.toast?.('Anteprime: '+e.message,false));
  corpo.addEventListener('scroll',aggiornaBubbleVista);window.addEventListener('resize',aggiornaBubbleVista);document.addEventListener('pointerdown',e=>{if(bubble&&!bubble.contains(e.target)&&!scrittura)nascondiBubble();});
  window.tendinaViva?.(sel,{piccola:true,icona:'layers',fissa:'Presentazioni'});
  gobboBar=E('div',null,'tbar presenta-bar');for(const [nome,icona,cmd]of [['Indietro','chevron-left','indietro'],['Avanti','chevron-right','avanti'],['Argomento precedente','chevrons-left','argomentoPrecedente'],['Argomento successivo','chevrons-right','argomentoSuccessivo'],['Approfondisci','chevron-down','approfondisci'],['Risali','chevron-up','risali']])gobboBar.append(b(nome,icona,()=>sessione(cmd)));
  const tempo=E('output','00:00','gobbo-tempo');tempo.id='gobboTempo';tempo.setAttribute('aria-label','Tempo della presentazione');
  const schermi=E('select');schermi.id='gobboSchermi';schermi.setAttribute('aria-label','Schermo della presentazione');schermi.onchange=()=>azione(()=>sessione('schermo',{schermo:Number(schermi.value)}));
  gobboBar.append(tempo,b('Avvia timer','play',()=>sessione('timer',{timer:'avvia'})),b('Pausa timer','pause',()=>sessione('timer',{timer:'pausa'})),b('Azzera timer',null,()=>sessione('timer',{timer:'azzera'})),schermi,b('Schermo intero','maximize',()=>sessione('intero')),b('Termina presentazione','x',()=>sessione('chiudi')));
  gobboStato=E('div',null,'presenta-stato');gobboStato.setAttribute('role','status');gobboCorpo=E('div',null,'gobbo-corpo');gobbo.append(gobboBar,gobboStato,gobboCorpo);window.tendinaViva?.(schermi,{piccola:true,fissa:'Schermo'});
  // Chiudere senza ridisegnare al pointerdown conserva il controllo che riceverà il clic.
  document.addEventListener('pointerdown',e=>{if(!inputAperto||inputAperto.popup.contains(e.target))return;const errore=inputAperto.salva();if(errore){e.preventDefault();e.stopImmediatePropagation();return;}chiudiInput(false);ricostruisciInput=true;},true);
  document.addEventListener('click',()=>{if(!ricostruisciInput)return;ricostruisciInput=false;if(!inputAperto){campiSlide();disegna();}});
  document.addEventListener('keydown',e=>{if(!inputAperto)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();azione(chiudiInput);}else if(scrittura?.locale&&inputAperto.popup.contains(e.target))editorInput.keydown(e);},true);
  document.addEventListener('keydown',e=>{if(e.key!=='Escape'||!D.documento||!window.bancoVisibile?.('presenta')||document.querySelector('dialog[open],:popover-open:not(.presenta-bubble)'))return;const attivo=document.activeElement;if(attivo!==document.body&&attivo!==frame&&!host.contains(attivo))return;e.preventDefault();fineScrittura();nascondiBubble();scegliBlocco('');});
  host.addEventListener('keydown',e=>{if(tastoOggetto(e))return;if(!(e.metaKey||e.ctrlKey)||!['s','z','y'].includes(e.key.toLowerCase()))return;e.preventDefault();e.stopPropagation();azione(()=>{if(e.key.toLowerCase()==='s')return salvaTutto();fineScrittura();if(e.key.toLowerCase()==='y'||e.shiftKey)D.ripeti();else D.annulla();campiSlide();disegna();});});
  document.addEventListener('dragstart',e=>{if([...e.dataTransfer.types].some(t=>['application/x-studia-lim','application/x-studia-presenta-media'].includes(t)))frame.style.pointerEvents='none';});document.addEventListener('dragend',()=>{frame.style.pointerEvents='';host.classList.remove('presenta-drop');});
  host.addEventListener('dragover',e=>{if(![...e.dataTransfer.types].some(t=>['application/x-studia-lim','application/x-studia-presenta-media'].includes(t)))return;e.preventDefault();e.dataTransfer.dropEffect='copy';host.classList.add('presenta-drop');});
  host.addEventListener('dragleave',e=>{if(!host.contains(e.relatedTarget))host.classList.remove('presenta-drop');});
  host.addEventListener('drop',e=>{host.classList.remove('presenta-drop');frame.style.pointerEvents='';const raw=e.dataTransfer.getData('application/x-studia-lim')||e.dataTransfer.getData('application/x-studia-presenta-media');if(!raw)return;e.preventDefault();e.stopPropagation();azione(()=>importa(JSON.parse(raw)));});
  window.addEventListener('message',e=>{if(e.source!==frame.contentWindow)return;if(e.data?.tipo==='presenta-caricato'){framePronto=true;if(quadro)frame.contentWindow.postMessage(quadro,'*');}
   else if(e.data?.presenta===canale){if(inputAperto&&['seleziona','selezionaGruppo','menuOggetto'].includes(e.data.tipo))azione(chiudiInput);if(e.data.tipo==='scritturaSalvata'){const id=e.data.richiesta;atteseScrittura.get(id)?.(e.data.errore);atteseScrittura.delete(id);}if(e.data.tipo==='selezionaGruppo'){fineScrittura();const s=posizione()?.slide;gruppo=[...new Set(e.data.ids||[])].filter(id=>s?.blocks.some(b=>b.id===id));bloccoId=gruppo.at(-1)||'';selezioneGiro++;campiSlide();disegna();}
    if(e.data.tipo==='seleziona'&&(e.data.blockId||'')!==bloccoId)scegliBlocco(e.data.blockId);
    if(['inizioScrittura','formatiParole','testoInLinea','fineScrittura'].includes(e.data.tipo))azione(()=>riceviScrittura(e.data.tipo,e.data));
    if(e.data.tipo==='muoviBubble'&&bubble&&e.data.blockId===bloccoId)posizionaBubble(e.data.rect);
    if(e.data.tipo==='menuOggetto')menuOggetto(e.data);if(e.data.tipo==='comandoOggetto')azione(()=>{const o=e.data,s=posizione()?.slide;if(!s||o.slideId!==s.id||o.firma!==quadro?.editor?.firma||firma!==JSON.stringify({...D.documento,revision:0}))return;if(o.comando!=='incolla'&&!s.blocks.some(b=>b.id===o.blockId))return;if(o.blockId)bloccoId=o.blockId;comandoOggetto(o.comando);});if(e.data.tipo==='nascondiBubble')nascondiBubble();
    if(e.data.tipo==='cronologia'&&!occupato&&!D.bloccato)azione(()=>{if(e.data.comando==='salva')return salvaTutto();fineScrittura();if(e.data.comando==='ripeti')D.ripeti();else if(e.data.comando==='annulla')D.annulla();campiSlide();disegna();});
    if(['geometria','misure'].includes(e.data.tipo))azione(()=>{
     const o=e.data,s=posizione()?.slide;if(!s||o.slideId!==s.id||o.firma!==quadro?.editor?.firma||firma!==JSON.stringify({...D.documento,revision:0})){firma='';anteprima();return;}
     let boxes=o.boxes;
     if(o.tipo==='misure'){const r=richiestaMisure;if(!r||r.id!==o.richiesta||r.slideId!==s.id)return;richiestaMisure=null;if(r.nome!=='conserva')boxes=boxes.map(v=>v.id===r.blockId?{...v,box:ancoraScelta(v.box,r.nome)}:v);}
     if(occupato||D.bloccato)return;try{op({tipo:'posizionaBlocchi',boxes},{struttura:true});}catch(e){firma='';anteprima();throw e;}
    });if(e.data.tipo==='pronto'){quadroVisibile=e.data.firma;avviaScritturaRichiesta();if(richiestaMisure)frame.contentWindow.postMessage({presenta:canale,tipo:'misure',richiesta:richiestaMisure.id},'*');}
    if(e.data.tipo==='ingombro'&&e.data.slideId===posizione()?.slide.id&&e.data.firma===quadro?.editor?.firma&&firma===JSON.stringify({...D.documento,revision:0})){avviso.dataset.slideId=e.data.slideId;avviso.hidden=!e.data.overflow;avviso.textContent='Parte del contenuto non entra nella slide o nel riquadro: allarga il riquadro, riduci il testo o dividi la slide.';}
    if(e.data.tipo==='errore')window.toast?.('Anteprima: '+e.data.error,false);if(e.data.tipo==='pronto'&&e.data.errors?.length)window.toast?.('Ci sono formule da correggere nella slide.',false);}});
  window.ZainoPresenta={nuova,apri,flush:()=>salvaTutto(),molla,importa,modifica,chiudi,presenta,get documento(){return D.documento;},get daSalvare(){return !!inputAperto?.errore?.textContent||D.sporco||D.salvando;},get regia(){return regia;}};
  api.onCambiata(o=>{if(o.corso===corso)azione(ricaricaLista);});api.onSessione(o=>{regia=o.regia;if(regia?.corso!==corso)regia=null;disegnaGobbo();});
  api.onChiudi(o=>azione(async()=>{try{await salvaTutto();await D.transizione(()=>{});await api.comando({azione:'chiusuraPronta',id:o.id});}catch(e){await api.comando({azione:'chiusuraPronta',id:o.id,errore:true});throw e;}}));
  window.addEventListener('studia:zaino-changed',()=>azione(contesto));window.addEventListener('studia:sidebar-updated',sidebar);
  window.addEventListener('banco-layout',()=>{if(window.bancoVisibile?.('presenta'))azione(async()=>{await contesto();anteprima();});});
  window.addEventListener('beforeunload',e=>{if(D.sporco||D.salvando){e.preventDefault();e.returnValue=false;azione(()=>salvaTutto());}});
  window.addEventListener('blur',()=>{if(D.sporco)azione(()=>salvaTutto());});
  setInterval(()=>{if(regia&&window.bancoVisibile?.('gobbo'))azione(async()=>{const r=await call({azione:'regia'});regia=r.regia;disegnaGobbo();});},1000);
  api.comando({azione:'editorPronto'});azione(contesto);disegna();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',monta);else monta();
})();
