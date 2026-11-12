/* Il pannello usa le stesse operazioni della mappa: una scelta, un Undo. */
(function(){
 'use strict';const A=MappaAspetto,E=(t,txt,cls)=>{const e=document.createElement(t);if(txt)e.textContent=txt;if(cls)e.className=cls;return e;},host=document.getElementById('mAspetto'),campi={},preset=[];
 function cambia(fn){if(!mappaMie()||!MAPPA.mia.grafo)return;try{mappaAnnullabile('Aspetto della mappa');MAPPA.vista=fn(MAPPA.vista);mappaVistaCambiata();mappaTocca();mappaSincronizzaComandi();mappaRidisegna();}catch(e){toast(e.message,false);}}
 function valore(k,v){cambia(vista=>({...vista,aspetto:A.normalizza({...vista.aspetto,[k]:v})}));}
 const dettagli=E('details'),titolo=E('summary','Stile e sfondo');dettagli.open=true;const griglia=E('div',null,'mappa-preset');
 function galleria(){
  griglia.replaceChildren();preset.length=0;
  let raccolta;try{raccolta=ZainoRaccolta.elenco('mappa');}catch(e){toast(e.message,false);return;}
  for(const r of raccolta){const p=r.pacchetto,b=E('button',null,'tbtn mappa-preset-voce');b.type='button';b.dataset.stileId=r.id;
   if(r.id.startsWith('mappa-'))b.dataset.preset=r.id.slice(6);
   const a=A.normalizza(p.stile),campione=E('span',null,'mappa-preset-campione');campione.style.background=a.carta||'var(--bg)';
   const miniatura=E('img');miniatura.alt='';miniatura.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 48"><path d="M36 24H84" stroke="'+(a.legame||'#64748b')+'" stroke-width="'+a.spessore+'"/><rect x="4" y="10" width="38" height="28" rx="'+a.raggio+'" fill="'+(a.nodo||'#ffffff')+'" stroke="'+(a.bordo||'#64748b')+'"/><rect x="78" y="10" width="38" height="28" rx="'+a.raggio+'" fill="'+(a.nodo||'#ffffff')+'" stroke="'+(a.bordo||'#64748b')+'"/></svg>');campione.append(miniatura);
   b.append(campione,E('span',p.nome));b.onclick=async()=>{const file=MAPPA.mia.file,z=corsoAttivo();const res=await vault.stili.verifica('mappa',JSON.stringify(p));if(!res.stile){toast(res.error,false);return;}if(file!==MAPPA.mia.file||z!==corsoAttivo())return;cambia(v=>{const n=ZainoStili.vista(v,p.stile);if(b.dataset.preset)n.aspetto.preset=b.dataset.preset;return n;});};griglia.append(b);preset.push(b);
  }
 }
 galleria();window.addEventListener('zaino-stili-cambiati',()=>{galleria();sincronizza();});
 const form=E('div',null,'mappa-aspetto-campi');
 function select(k,nome,voci){const lab=E('label',nome),s=E('select');s.setAttribute('aria-label',nome);s.dataset.aspetto=k;for(const [v,n]of voci)s.append(new Option(n,v));s.onchange=()=>valore(k,s.value);lab.append(s);form.append(lab);campi[k]=s;}
 select('tratto','Tratto dei riquadri',[['regolare','Regolare'],['squig','Squig · a mano'],['drawably','Drawably · a mano']]);select('font','Font dei nodi',Object.entries(PresentaModello.CARATTERI).map(([k,v])=>[k,v.nome]));select('sfondo','Sfondo',Object.entries(A.SFONDI));select('fusione','Fusione dei contenuti',[['normal','Normale'],['multiply','Moltiplica (Multiply)']]);campi.fusione.title='Applica la fusione a nodi, immagini, testi e collegamenti sopra lo sfondo della mappa.';
 for(const [k,n]of [['carta','Colore dello sfondo'],['segno','Puntini e linee'],['nodo','Fondo dei nodi'],['testo','Testo'],['bordo','Bordi dei nodi neutri'],['legame','Collegamenti']]){const lab=E('label',n),i=E('button',null,'tbtn zaino-colore');i.type='button';i.setAttribute('aria-label',n);i.setAttribute('aria-haspopup','dialog');i.dataset.aspetto=k;i.onclick=()=>{const file=MAPPA.mia.file,corso=corsoAttivo();ZainoPalette.apri({ancora:i,nome:n,valore:i.value,nessuno:k==='nodo'?'Senza sfondo':k==='bordo'?'Senza bordo':null,valido:()=>MAPPA.mia.file===file&&corsoAttivo()===corso,onSelect:v=>valore(k,v)});};lab.append(i);form.append(lab);campi[k]=i;}
 for(const [k,n,min,max,step]of [['raggio','Angoli dei nodi',0,24,1],['spessore','Spessore dei tratti',.5,4,.5],['freccia','Dimensione delle frecce',3,20,1],['passo','Distanza del pattern',12,64,2]]){const lab=E('label',n),riga=E('span',null,'mappa-aspetto-range'),i=E('input'),o=E('output');i.type='range';i.className='zaino-slider';i.min=min;i.max=max;i.step=step;i.setAttribute('aria-label',n);i.dataset.aspetto=k;i.oninput=()=>o.textContent=i.value+' px';i.onchange=()=>valore(k,+i.value);riga.append(i,o);lab.append(riga);form.append(lab);campi[k]=i;}
 campi.freccia.title='Dimensione base con tratto da 1 px. La punta cresce insieme allo spessore dei tratti.';
 const community=E('button','Stili della community…','tbtn');community.type='button';
 community.onclick=()=>{const file=MAPPA.mia.file,z=corsoAttivo();
  ZainoStiliUI.apri({tipo:'mappa',nome:'Stile mappa',stile:ZainoStili.mappa(MAPPA.vista),destinazione:'Applica alla mappa aperta. Puoi annullare la modifica.',
   valido:()=>mappaMie()&&!!MAPPA.mia.grafo&&MAPPA.mia.file===file&&corsoAttivo()===z,applica:p=>cambia(v=>ZainoStili.vista(v,p.stile))});};
 const tuning=E('button','Gestisci in TUNING','tbtn');tuning.type='button';tuning.onclick=()=>{closePops();ZainoTuning.apri('mappa');};
 dettagli.append(titolo,griglia,form,community,tuning);host.append(dettagli);
 function sincronizza(){const v=A.normalizza(MAPPA.vista.aspetto),t=A.tema(v,mappaTema()),fallback={carta:t.bg,segno:'#d4d7dc',nodo:t.panel,testo:t.ink,bordo:t.line,legame:t.muted},attiva=mappaMie()&&!!MAPPA.mia.grafo;community.disabled=!attiva;campi.sfondo.querySelector('[value=personale]').disabled=!v.sfondoPersonale;for(const b of preset){b.disabled=!attiva;b.setAttribute('aria-pressed',String(v.preset===b.dataset.preset));}for(const [k,c]of Object.entries(campi)){const valore=v[k]===''?(fallback[k]||''):v[k];if(c.tagName==='BUTTON')ZainoPalette.campione(c,valore);else c.value=valore;c.disabled=!attiva||(k==='carta'&&v.sfondo.startsWith('carta-'))||(['segno','passo'].includes(k)&&!['punti','linee'].includes(v.sfondo));if(c.type==='range')c.nextElementSibling.textContent=c.value+' px';} }
 window.MappaAspettoUI={sincronizza};sincronizza();
}());
