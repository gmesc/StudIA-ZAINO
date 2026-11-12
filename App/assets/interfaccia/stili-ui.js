/* L'anteprima usa solo pacchetti verificati e materiale dimostrativo. */
(function(){
 'use strict';
 const M=PresentaModello,S=ZainoStili;
 const el=(tag,testo)=>{const e=document.createElement(tag);if(testo!==undefined)e.textContent=testo;return e;};
 function stesso(a,b){return ['formato','versione','tipo','nome','autore','licenza'].every(k=>a[k]===b[k])&&JSON.stringify(a.stile)===JSON.stringify(b.stile);}
 function bottone(t,fn){const b=el('button',t);b.type='button';b.className='tbtn';b.onclick=fn;return b;}
 function anteprima(host,t,s){
  host.replaceChildren();const campione=el('div');campione.inert=true;Object.assign(campione.style,{fontWeight:'400',letterSpacing:'normal',textTransform:'none'});host.append(campione);
  if(t==='mappa'){
   const v=S.vista({},s),res=MappaLayouts.run({nodi:[{id:'a',testo:'Foresta'},{id:'b',testo:'Alberi'},{id:'c',testo:'Animali'}],archi:[{da:'a',a:'b',rel:'ospita'},{da:'a',a:'c',rel:'ospita'}]},{linee:v.linee,w:110,h:40,gapLivello:35,gapNodo:12});
   const out=MappaDisegna.svg(res,{...v,tema:mappaTema(),margine:12}),svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',out.viewBox);svg.innerHTML=out.markup;campione.append(svg);return;
  }
  if(t==='slide'){
   Object.assign(campione.style,{background:s.sfondo,color:s.colore,fontFamily:M.CARATTERI[s.font].css,padding:'1em',fontSize:s.testo/2+'px'});
   if(s.sfondoPersonale)Object.assign(campione.style,ZainoSfondi.css(s.sfondoPersonale));
   const titolo=el('strong','Energia dal sole');Object.assign(titolo.style,{display:'block',color:s.accento,fontSize:s.titolo/2+'px'});campione.append(titolo,el('span','Le foglie catturano la luce.'));return;
  }
  const b=S.bloccoNavbar(M.modelloComune('navbar'),s),a=b.style,ombra=campione.attachShadow({mode:'open'}),css=el('link');css.rel='stylesheet';css.href='assets/presentazioni/deck.css';
  const nav=el('nav');nav.className='presenta-navbar';nav.dataset.variante=b.variant;nav.dataset.orientamento=b.orientation;nav.style.cssText=M.graficaNavbarCSS(a.navbar,a.color)+';--step-zoom:'+b.activeZoom;
  Object.assign(nav.style,{fontFamily:M.CARATTERI[a.fontFamily||'zaino'].css,fontSize:a.fontSize+'px',color:a.color||'inherit',fontWeight:a.fontWeight||(a.bold?'bold':'normal'),fontStyle:a.italic?'italic':'normal',lineHeight:a.lineHeight||1.4,textDecoration:a.underline?'underline':'none',textAlign:a.align||'left',backgroundColor:a.highlight||'transparent',mixBlendMode:a.appearance?.blend||'normal',opacity:a.appearance?.opacity??1});
  for(const [i,nome]of ['Inizio','Lezione','Ripasso'].entries()){const bt=el('button'),passo=el('span'),n=el('span',String(i+1)),tit=el('span',nome);bt.tabIndex=-1;if(i===1)bt.setAttribute('aria-current','step');passo.className='presenta-step-contenuto';n.className='presenta-step-numero';tit.className='presenta-step-titolo';passo.append(n,tit);bt.append(passo);nav.append(bt);}
  nav.inert=true;ombra.append(css,nav);
 }
 function apri({tipo,nome,stile,destinazione,valido,applica}){
  const api=window.vault.stili;
  const corrente={formato:'zaino-stile',versione:1,tipo,nome,stile};
  const d=el('dialog');d.className='stili-community';d.setAttribute('aria-label','Stili della community · '+tipo);
  const titolo=el('h2','Stili della community · '+tipo),info=el('p',destinazione),selettore=el('select'),file=el('input'),preview=el('div'),errore=el('output'),azioni=el('div'),campi=el('div');
  errore.setAttribute('role','status');preview.className='stili-campione';preview.setAttribute('aria-label','Anteprima dello stile');campi.className='stili-metadati';azioni.className='stili-azioni';
  function etichetta(n,input){const l=el('label',n);l.append(input);return l;}
  const metadati={};for(const [k,label,max]of [['nome','Nome',40],['autore','Autore (facoltativo)',80],['licenza','Licenza (facoltativa)',80]]){const i=el('input');i.maxLength=max;metadati[k]=i;campi.append(etichetta(label,i));}
  file.type='file';file.accept='.json,application/json';file.hidden=true;
  let raccolta=[],scelto=null,giro=0;
  try{raccolta=ZainoRaccolta.elenco(tipo);}catch(_){window.toast?.('Raccolta degli stili illeggibile.',false);return;}
  function elenco(){selettore.replaceChildren(new Option('Aspetto attuale',''));raccolta.forEach((p,i)=>selettore.add(new Option(p?.pacchetto.nome||'Stile',String(i))));}
  async function verifica(testo){const r=await api.verifica(tipo,testo);if(!r?.stile)throw Error(r?.error||'Verifica non riuscita.');return r.stile;}
  function dati(){const p={...scelto};for(const [k,i]of Object.entries(metadati)){delete p[k];if(i.value.trim())p[k]=i.value.trim();}return p;}
  function stato(attivo){salva.disabled=esporta.disabled=usa.disabled=personalizza.disabled=!attivo;}
  async function mostra(leggi,daFile=false){
   const id=++giro;scelto=null;stato(false);errore.textContent='';preview.replaceChildren();for(const i of Object.values(metadati))i.value='';
   if(daFile){selettore.querySelector('[value="file"]')?.remove();selettore.add(new Option('Dal file…','file'));selettore.value='file';}
   try{const p=await verifica(await leggi());if(!d.open||id!==giro)return;
    if(daFile)selettore.selectedOptions[0].textContent='Dal file: '+p.nome;
    for(const [k,i]of Object.entries(metadati))i.value=p[k]||'';
    anteprima(preview,tipo,p.stile);scelto=p;stato(true);
   }catch(e){if(id===giro)errore.textContent=e.message;}
  }
  function esegui(fn){return async()=>{if(!scelto)return;const id=giro;stato(false);errore.textContent='';try{const p=await verifica(JSON.stringify(dati()));if(!d.open||id!==giro)return;await fn(p);}catch(e){errore.textContent=e.message;}finally{if(id===giro)stato(!!scelto);}};}
  const importa=bottone('Importa file…',()=>file.click()),salva=bottone('Salva nella raccolta',esegui(p=>{
   const esistente=raccolta.find(r=>stesso(r.pacchetto,p)),id=esistente?.id||crypto.randomUUID();
   ZainoRaccolta.cambia({tipo:'salva',id,pacchetto:p});raccolta=ZainoRaccolta.elenco(tipo);elenco();selettore.value=String(raccolta.findIndex(r=>r.id===id));scelto=p;visibilita();errore.textContent='Stile salvato in TUNING.';
  })),esporta=bottone('Esporta stile…',esegui(async p=>{const r=await api.esporta(tipo,JSON.stringify(p));if(r?.error)throw Error(r.error);if(r?.ok)errore.textContent='File di stile esportato.';})),
  usa=bottone('Applica stile',esegui(p=>{if(!valido())throw Error('La destinazione è cambiata. Chiudi e riapri il pannello.');applica(p);d.close();}));
  const rimuovi=bottone('Rimuovi dalla raccolta',()=>{const i=selettore.value;if(!/^\d+$/.test(i))return;try{ZainoRaccolta.cambia({tipo:'elimina',id:raccolta[Number(i)].id});raccolta=ZainoRaccolta.elenco(tipo);elenco();selettore.onchange();}catch(e){errore.textContent=e.message;}});
  function visibilita(){rimuovi.hidden=!/^\d+$/.test(selettore.value)||ZainoRaccolta.preinstallato(raccolta[Number(selettore.value)]);}
  selettore.onchange=()=>{const i=selettore.value;if(i==='file')return;selettore.querySelector('[value="file"]')?.remove();visibilita();mostra(()=>JSON.stringify(i===''?corrente:raccolta[Number(i)].pacchetto));};
  file.onchange=()=>{const f=file.files[0];file.value='';if(f){rimuovi.hidden=true;mostra(()=>{if(f.size>3*1024*1024)throw Error('Il file supera 3 MiB.');return f.text();},true);}};
  const personalizza=bottone('Personalizza in TUNING',esegui(p=>{
   const esistente=raccolta.find(r=>stesso(r.pacchetto,p)),id=esistente?.id||crypto.randomUUID();
   if(!esistente)ZainoRaccolta.cambia({tipo:'salva',id,pacchetto:p});
   d.close();document.querySelector('.presenta-tema-dialog[open]')?.close();window.closePops?.();ZainoTuning.apri(tipo,id);
  }));
  azioni.append(usa,personalizza,salva,rimuovi,esporta,bottone('Chiudi',()=>d.close()));d.append(titolo,info,etichetta('Stile',selettore),importa,file,preview,campi,errore,azioni);
  d.addEventListener('keydown',e=>e.stopPropagation());
  d.addEventListener('close',()=>d.remove(),{once:true});document.body.append(d);elenco();visibilita();d.showModal();selettore.onchange();
 }
 window.ZainoStiliUI={apri,anteprima};
})();
