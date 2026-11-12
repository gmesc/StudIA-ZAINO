/* TUNING modifica la raccolta; applicare un tema resta una scelta dell'editor. */
(function(){
 'use strict';
 const R=ZainoRaccolta,M=PresentaModello,S=ZainoStili,host=document.getElementById('tuningPane');
 const E=(t,txt,cls)=>{const e=document.createElement(t);if(txt!==undefined)e.textContent=txt;if(cls)e.className=cls;return e;};
 const nomi={mappa:'Mappe',slide:'Slide',navbar:'Navbar'};
 let tipo='mappa',vista='visibili',ricerca='',corrente=null,caricamento=0,mostrato=false,daAprire=null;
 let righe=[],errori=new Map(),lista,stato,conta;
 const osservatore=new ResizeObserver(entries=>{for(const e of entries)e.target.style.setProperty('--tuning-scala',e.contentRect.width/520);});
 const sporco=()=>modificato;
 function consentiUscita(){if(!modificato)return true;if(!confirm('Ci sono modifiche allo stile non salvate. Vuoi scartarle?'))return false;modificato=false;return true;}
 function bottone(txt,fn){const b=E('button',txt,'tbtn');b.type='button';b.onclick=()=>{try{const p=fn();if(p?.catch)p.catch(e=>stato.textContent=e.message);}catch(e){stato.textContent=e.message;}};return b;}
 async function verifica(p){const r=await vault.stili.verifica(p.tipo,JSON.stringify(p));if(!r.stile)throw Error(r.error||'Stile non valido.');return r.stile;}
 function messaggio(s){stato.textContent=s;}
 function campione(h,p){ZainoStiliUI.anteprima(h,p.tipo,p.stile);osservatore.observe(h);}
 function ridisegna(){
  for(const e of lista.querySelectorAll('.stili-campione'))osservatore.unobserve(e);
  lista.replaceChildren();
  const filtrate=righe.filter(r=>r.pacchetto.tipo===tipo&&(vista==='tutti'||r.nascosto===(vista==='nascosti'))&&r.pacchetto.nome.toLocaleLowerCase('it').includes(ricerca.toLocaleLowerCase('it')));
  conta.textContent=filtrate.length+' '+(filtrate.length===1?'stile':'stili');
  for(const r of filtrate){
   const card=E('article',undefined,'tuning-card');card.dataset.stileId=r.id;
   const apri=bottone('',()=>seleziona(r.id));apri.className='tbtn tuning-apri';apri.setAttribute('aria-label','Aspetto · '+r.pacchetto.nome);apri.disabled=errori.has(r.id);
   const img=E('div',undefined,'stili-campione tuning-campione');img.setAttribute('aria-hidden','true');apri.append(img);
   const fondo=E('div',undefined,'tuning-card-fondo'),testi=E('div');testi.append(E('strong',r.pacchetto.nome),E('span',(R.preinstallato(r)?'Preinstallato':'Personale')+(r.nascosto?' · Nascosto':''),'tuning-card-info'));
   const altro=bottone('…',()=>menu(r,altro));altro.setAttribute('aria-label','Comandi di '+r.pacchetto.nome);altro.setAttribute('aria-haspopup','menu');altro.setAttribute('aria-expanded','false');fondo.append(testi,altro);card.append(apri,fondo);lista.append(card);
   if(errori.has(r.id))img.textContent=errori.get(r.id);else try{campione(img,r.pacchetto);}catch(e){img.textContent=e.message;}
  }
  if(!filtrate.length)lista.append(E('p',vista==='nascosti'?'Nessuno stile nascosto.':'Nessuno stile da mostrare. Crea un nuovo stile o importa un file.','tuning-vuoto'));
 }
 async function carica(){
  const n=++caricamento;messaggio('Caricamento degli stili…');
  try{
   const nuove=R.elenco(null,true),risultati=await Promise.all(nuove.map(async r=>{try{await verifica(r.pacchetto);return null;}catch(e){return [r.id,e.message];}}));
   if(n!==caricamento)return;righe=nuove;errori=new Map(risultati.filter(Boolean));ridisegna();messaggio(errori.size?'Alcuni stili non sono leggibili: gli errori sono indicati nelle tessere.':'');
   const id=daAprire;daAprire=null;if(id&&!finestra?.open)seleziona(id);
  }catch(e){if(n===caricamento){messaggio(e.message);lista.replaceChildren(E('p','Raccolta non disponibile. I dati salvati sono conservati.'));}}
 }
 function nuovo(p=R.nuovo(tipo)){
  if(finestra?.open||!consentiUscita())return;corrente={id:crypto.randomUUID(),pacchetto:p,nuovo:true,nascosto:false};apriAmbiente();
 }
 function caricaSfondo(){ZainoSfondiUI.apri({tipo,conferma:s=>{const p=R.nuovo(tipo);p.nome=s.nome.replace(/\.[^.]+$/,'').slice(0,40)||p.nome;p.stile.sfondoPersonale=s;if(tipo==='mappa')p.stile.sfondo='personale';nuovo(p);}});}
 function seleziona(id){if(finestra?.open||!consentiUscita())return;corrente=righe.find(r=>r.id===id);if(!corrente)return;if(errori.has(id)){messaggio(errori.get(id));return;}apriAmbiente();}
 async function esporta(r){const p=await verifica(r.pacchetto),res=await vault.stili.esporta(p.tipo,JSON.stringify(p));if(res.error)throw Error(res.error);if(res.ok)messaggio('File esportato.');}
 function menu(r,ancora){
  document.querySelector('.tuning-menu')?.remove();const pop=E('div',undefined,'popmenu tuning-menu tbar-ctl');pop.popover='auto';pop.setAttribute('role','menu');pop.setAttribute('aria-label','Comandi di '+r.pacchetto.nome);
  function voce(nome,fn){const b=bottone(nome,()=>{pop.hidePopover();return fn();});b.setAttribute('role','menuitem');pop.append(b);return b;}
  const aspetto=voce('Aspetto',()=>seleziona(r.id));aspetto.disabled=errori.has(r.id);voce('Esporta',()=>esporta(r));
  voce(r.nascosto?'Mostra':'Nascondi',()=>{R.cambia({tipo:'visibilita',id:r.id,nascosto:!r.nascosto});righe=R.elenco(null,true);ridisegna();});
  if(!R.preinstallato(r))voce('Elimina',()=>{if(confirm('Eliminare «'+r.pacchetto.nome+'» dalla raccolta?')){R.cambia({tipo:'elimina',id:r.id});righe=R.elenco(null,true);ridisegna();}});
  host.append(pop);pop.showPopover();const box=ancora.getBoundingClientRect(),rect=pop.getBoundingClientRect();pop.style.left=Math.max(8,Math.min(innerWidth-rect.width-8,box.right-rect.width))+'px';pop.style.top=Math.max(8,Math.min(innerHeight-rect.height-8,box.bottom+4))+'px';ancora.setAttribute('aria-expanded','true');
  pop.addEventListener('toggle',e=>{if(e.newState==='closed'){ancora.setAttribute('aria-expanded','false');ancora.focus();pop.remove();}});
  pop.onkeydown=e=>{const bs=[...pop.querySelectorAll('button:not(:disabled)')],i=bs.indexOf(document.activeElement);if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();bs[e.key==='Home'?0:e.key==='End'?bs.length-1:(i+(e.key==='ArrowDown'?1:bs.length-1))%bs.length].focus();}};pop.querySelector('button:not(:disabled)')?.focus();
 }
 let finestra=null,ambienteFrame=null,modificato=false,origine=null,ultimoFocus=null;
 function datiAmbiente(w){if(w!==ambienteFrame?.contentWindow)throw Error('Ambiente non disponibile.');return M.copia(corrente.pacchetto);}
 async function framePresenta(w){datiAmbiente(w);const r=await vault.presentazioni.comando({azione:'frame'});if(!r.ok)throw Error(r.error);return r.url;}
 async function vistaDemo(w,documento){datiAmbiente(w);const r=await vault.presentazioni.comando({azione:'vistaStile',documento});if(!r.ok)throw Error(r.error);const url=await framePresenta(w),base=new URL('../assets/presentazioni/carte/',url).href;r.documento.html=r.documento.html.replace(/src="carte\//g,'src="'+base);for(const k of Object.keys(M.CARTE))r.immagini['carte/'+k+'.png']=new URL('assets/presentazioni/carte/'+k+'.png',document.baseURI).href;return r;}

 function pronto(w){datiAmbiente(w);for(const b of finestra.querySelectorAll('[data-attendi-editor]'))b.disabled=false;}
 function cambiato(w){datiAmbiente(w);modificato=true;}
 function chiudiAmbiente(){if(!consentiUscita())return;finestra.close();}
 async function salvaAmbiente(){
  const w=ambienteFrame.contentWindow,p=await verifica(await w.ZainoTuningAmbiente.leggi());
  if(!finestra?.open||w!==ambienteFrame.contentWindow)return;
  R.cambia({tipo:'salva',id:corrente.id,pacchetto:p});corrente={...corrente,pacchetto:p,nuovo:false};modificato=false;finestra.querySelector('output').textContent='Stile salvato.';await carica();
 }
 function apriAmbiente(){
  ultimoFocus=document.activeElement;origine=M.copia(corrente.pacchetto);modificato=!!corrente.nuovo;
  finestra=E('dialog',undefined,'tuning-finestra tbar-ctl');finestra.setAttribute('aria-label','Aspetto · '+corrente.pacchetto.nome);
  const bar=E('div',undefined,'tbar media-head'),titolo=E('strong','Aspetto · '+nomi[corrente.pacchetto.tipo]),nome=E('input'),autore=E('input'),licenza=E('input');nome.value=origine.nome;nome.maxLength=40;nome.setAttribute('aria-label','Nome dello stile');autore.value=origine.autore||'';autore.maxLength=80;autore.setAttribute('aria-label','Autore');licenza.value=origine.licenza||'';licenza.maxLength=80;licenza.setAttribute('aria-label','Licenza');
  const identita=E('details',undefined,'tuning-identita'),sommario=E('summary','Nome, autore e licenza');identita.append(sommario);for(const [n,i]of [['Nome',nome],['Autore',autore],['Licenza',licenza]]){const l=E('label',n);l.append(i);identita.append(l);i.oninput=()=>{modificato=true;};}
  const output=E('output',corrente.pacchetto.tipo==='slide'?'Lo stile viene ricavato dalla slide selezionata.':'');output.setAttribute('role','status');
  if(corrente.nuovo)identita.open=true;
  const carica=bottone('Carica sfondo…',async()=>{const w=ambienteFrame.contentWindow,p=await w.ZainoTuningAmbiente.leggi();ZainoSfondiUI.apri({tipo:corrente.pacchetto.tipo,valore:p.stile.sfondoPersonale,conferma:s=>{if(w!==ambienteFrame?.contentWindow)throw Error('L’editor è cambiato. Riapri lo sfondo.');w.ZainoTuningAmbiente.sfondo(s);modificato=true;}});});carica.hidden=corrente.pacchetto.tipo==='navbar';carica.disabled=true;carica.dataset.attendiEditor='';
  const salva=bottone('Salva stile',()=>salvaAmbiente().catch(e=>output.textContent=e.message));salva.disabled=true;salva.dataset.attendiEditor='';bar.append(titolo,E('span',undefined,'tbspazio'),carica,salva,bottone('Chiudi',chiudiAmbiente));
  ambienteFrame=E('iframe');ambienteFrame.title='Editor demo · '+nomi[corrente.pacchetto.tipo];ambienteFrame.src='assets/interfaccia/tuning-ambiente.html';
  finestra.append(bar,identita,output,ambienteFrame);finestra.addEventListener('cancel',e=>{e.preventDefault();chiudiAmbiente();});finestra.addEventListener('close',()=>{finestra.remove();finestra=ambienteFrame=null;modificato=false;ultimoFocus?.focus();});
  finestra.metadati=()=>({nome:nome.value,...(autore.value.trim()?{autore:autore.value.trim()}:{}),...(licenza.value.trim()?{licenza:licenza.value.trim()}:{} )});
  document.body.append(finestra);finestra.showModal();if(corrente.nuovo){nome.focus();nome.select();}
 }
 function label(nome,input){const l=E('label',nome);l.append(input);return l;}
 function metadati(w){datiAmbiente(w);return finestra.metadati();}
 async function importa(file){
  if(!file||!consentiUscita())return;if(file.size>3*1024*1024)throw Error('Il file supera 3 MiB.');
  let p;try{p=JSON.parse((await file.text()).replace(/^\uFEFF/,''));}catch(_){throw Error('JSON non leggibile.');}if(!p||!nomi[p.tipo])throw Error('Il file deve essere uno stile di mappa, slide o navbar.');p=await verifica(p);
  R.cambia({tipo:'salva',id:crypto.randomUUID(),pacchetto:p});tipo=p.tipo;vista='visibili';ricerca='';aggiornaFiltri();await carica();messaggio('Stile importato. Apri … → Aspetto per modificarlo.');
 }
 let filtri,tipoSelect,cerca,sfondoButton;
 function aggiornaFiltri(){sfondoButton.hidden=tipo==='navbar';for(const b of filtri.children)b.setAttribute('aria-pressed',String(b.dataset.tipo===tipo));tipoSelect.value=vista;cerca.value=ricerca;}
 function prepara(){
  const testa=E('div',undefined,'tuning-testa'),testi=E('div');testi.append(E('h2','Il tuo ZAINO, il tuo stile'),E('p','Scegli uno stile, personalizzalo e ritrovalo negli editor.','tuning-nota'));
  const az=E('div',undefined,'tuning-toolbar'),file=E('input');file.type='file';file.accept='.json,application/json';file.hidden=true;file.id='tuningFile';file.onchange=()=>{const f=file.files[0];file.value='';importa(f).catch(e=>messaggio(e.message));};
  sfondoButton=bottone('Carica sfondo…',caricaSfondo);az.append(bottone('Nuovo stile',()=>nuovo()),sfondoButton,bottone('Importa stile…',()=>file.click()));
  const kit=bottone('Scarica kit chatbot…',async()=>{kit.disabled=true;messaggio('Scegli dove salvare il kit…');try{const r=await vault.stili.kit();if(r.error)throw Error(r.error);messaggio(r.annullato?'Download annullato.':'Kit salvato. Scompatta lo ZIP: contiene schema, esempi, prompt e guida per la community.');}finally{kit.disabled=false;}});kit.id='tuningKit';kit.title='Schema, esempi, prompt multimodale e guida per la community · ZIP';az.append(kit);
  testa.append(testi,az);filtri=E('div',undefined,'tuning-tipi');filtri.setAttribute('role','group');filtri.setAttribute('aria-label','Tipo di stile');
  for(const [k,n]of Object.entries(nomi)){const b=bottone(n,()=>{if(!consentiUscita())return;tipo=k;corrente=null;aggiornaFiltri();ridisegna();});b.dataset.tipo=k;filtri.append(b);}
  const ricercaBox=E('div',undefined,'tuning-filtri');cerca=E('input');cerca.type='search';cerca.oninput=()=>{ricerca=cerca.value;ridisegna();};
  tipoSelect=E('select');for(const [v,n]of [['visibili','Disponibili negli editor'],['nascosti','Nascosti'],['tutti','Tutti gli stili']])tipoSelect.add(new Option(n,v));tipoSelect.onchange=()=>{vista=tipoSelect.value;ridisegna();};
  conta=E('span',undefined,'tuning-conteggio');ricercaBox.append(filtri,label('Cerca uno stile',cerca),label('Mostra',tipoSelect),conta);
  const corpo=E('div',undefined,'tuning-corpo');lista=E('div',undefined,'tuning-gallery');lista.setAttribute('aria-label','Galleria degli stili');corpo.append(lista);stato=E('output',undefined,'tuning-stato');stato.setAttribute('role','status');host.append(testa,file,ricercaBox,stato,corpo);aggiornaFiltri();
 }
 function mostra(){if(!mostrato){prepara();mostrato=true;}if(!sporco())carica();}
 function apri(t,id){if(!consentiUscita())return;if(nomi[t])tipo=t;corrente=null;daAprire=id||null;vista='visibili';ricerca='';document.getElementById('settingsBtn').click();document.querySelector('[data-tab=tuning]').click();if(mostrato){aggiornaFiltri();ridisegna();}}
 window.ZainoTuning={mostra,apri,consentiUscita,datiAmbiente,framePresenta,vistaDemo,pronto,cambiato,metadati};
 new MutationObserver(()=>{if(!document.getElementById('settingsModal').hidden&&document.getElementById('settingsModal').dataset.tuning==='true')mostra();}).observe(document.getElementById('settingsModal'),{attributes:true,attributeFilter:['hidden']});
 if(document.getElementById('settingsModal').dataset.tuning==='true')mostra();
})();
