/* L’editor reale riceve un backend in memoria. Nessuna operazione della demo raggiunge il vault. */
(async function(){
 'use strict';
 const ponte=parent.ZainoTuning,p=ponte.datiAmbiente(window),E=(tag,txt,cls)=>{const e=document.createElement(tag);if(txt!==undefined)e.textContent=txt;if(cls)e.className=cls;return e;};
 document.documentElement.dataset.theme=parent.document.documentElement.dataset.theme||'';
 for(const a of parent.document.documentElement.attributes)if(a.name.startsWith('data-'))document.documentElement.setAttribute(a.name,a.value);
 document.documentElement.removeAttribute('data-settings');
 for(const s of parent.document.querySelectorAll('style,link[rel=stylesheet]')){const e=s.cloneNode(true);if(s.tagName==='LINK')e.href=s.href;document.head.append(e);}
 const css=E('link');css.rel='stylesheet';css.href='assets/interfaccia/tuning-ambiente.css';document.head.append(css);
 // Anche le preferenze recenti del simulatore restano in memoria.
 const dati={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>dati[k]??null,setItem:(k,v)=>{dati[k]=String(v);},removeItem:k=>delete dati[k]}});
 async function script(src){await new Promise((resolve,reject)=>{const s=E('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(Error('Impossibile caricare '+src));document.head.append(s);});}
 const comuni=['assets/interfaccia/icone.js','assets/presentazioni/colori.js','assets/interfaccia/palette.js','assets/presentazioni/testo.js','assets/presentazioni/animazioni.js','assets/squig/tratti.js','assets/drawably/tratti.js','assets/presentazioni/vettori.js','assets/interfaccia/sfondi.js','assets/presentazioni/modello.js','assets/mappa/aspetto.js','assets/interfaccia/stili.js','assets/interfaccia/tuning-demo.js'];
 try{
  for(const f of comuni)await script(f);
  const M=PresentaModello,S=ZainoStili,D=ZainoTuningDemoModello;
  window.toast=msg=>document.getElementById('demoErrore').textContent=msg;
  window.ZainoRaccolta={elenco:()=>[]};window.ZainoStiliUI={apri:()=>{}};
  const cambiata=()=>ponte.cambiato(window),conMetadati=stile=>{const n={...p,stile};delete n.autore;delete n.licenza;return {...n,...ponte.metadati(window)};};
  if(p.tipo==='mappa'){
   for(const f of ['assets/mappa/grafo.js','assets/mappa/relazioni.js','assets/mappa/layouts.js','assets/mappa/video.js','assets/mappa/disegna.js'])await script(f);
   document.body.dataset.demo='mappa';document.querySelector('#presentaPane').remove();
   const area=E('main',undefined,'tuning-mappa'),bar=E('div',undefined,'mtoolbar tbar'),tela=E('div',undefined,'mtela'),svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),comandi=E('section',undefined,'tuning-mappa-comandi');svg.id='mappaSvg';svg.setAttribute('aria-label','Mappa demo con sette nodi');tela.append(svg);area.append(bar,tela,comandi);document.body.append(area);
   const grafo=D.mappa();window.MAPPA={vista:S.vista({},p.stile),mia:{grafo,file:'demo'}};window.mappaTema=()=>{const st=getComputedStyle(document.body),v=k=>st.getPropertyValue('--'+k).trim();return {bg:v('bg'),panel:v('panel'),ink:v('ink'),line:v('line'),muted:v('muted')};};
   let storia=[],dopo=[],vb;const adatta=()=>{const res=MappaLayouts.run(grafo,{...MAPPA.vista,w:168,h:136,gapLivello:85,gapNodo:32}),out=MappaDisegna.svg(res,{...MAPPA.vista,sfondo:MappaAspetto.segueMappa(MAPPA.vista.aspetto),tema:mappaTema(),srcImmagine:im=>new URL('assets/interfaccia/demo-'+im.id+'.svg',document.baseURI).href});Object.assign(tela.style,MappaAspetto.cartaCSS(MAPPA.vista.aspetto,mappaTema()));if(MappaAspetto.segueMappa(MAPPA.vista.aspetto))tela.style.backgroundImage='none';svg.style.mixBlendMode=MappaAspetto.segueMappa(MAPPA.vista.aspetto)?'normal':MappaAspetto.normalizza(MAPPA.vista.aspetto).fusione;svg.innerHTML=out.markup;svg.setAttribute('viewBox',out.viewBox);vb=out.viewBox.split(' ').map(Number);};
   window.mappaMie=()=>true;window.corsoAttivo=()=> 'tuning-demo';window.mappaAnnullabile=()=>{storia.push(M.copia(MAPPA.vista));dopo=[];};window.mappaVistaCambiata=()=>{};window.mappaTocca=cambiata;window.mappaSincronizzaComandi=()=>window.MappaAspettoUI?.sincronizza();window.mappaRidisegna=adatta;window.closePops=()=>{};
   function b(nome,fn){const e=E('button',nome,'tbtn');e.type='button';e.onclick=fn;bar.append(e);return e;}
   b('Adatta alla finestra',adatta);b('Annulla',()=>{if(storia.length){dopo.push(M.copia(MAPPA.vista));MAPPA.vista=storia.pop();mappaSincronizzaComandi();adatta();cambiata();}});b('Ripeti',()=>{if(dopo.length){storia.push(M.copia(MAPPA.vista));MAPPA.vista=dopo.pop();mappaSincronizzaComandi();adatta();cambiata();}});
   function campo(nome,k,min,max,opzioni){const l=E('label',nome),i=E(opzioni?'select':'input');i.setAttribute('aria-label',nome);if(opzioni)for(const [v,n]of opzioni)i.add(new Option(n,v));else{i.type='number';i.min=min;i.max=max;}i.value=MAPPA.vista[k];i.onchange=()=>{if(!i.validity.valid||!i.value)return; mappaAnnullabile();MAPPA.vista[k]=opzioni?i.value:Number(i.value);adatta();cambiata();};l.append(i);bar.append(l);}
   campo('Testo nodi · px','fsNodo',9,20);campo('Testo legami · px','fsRel',8,18);campo('Collegamenti','linee',null,null,[['curva','Curve'],['dritto','Dritte'],['orto','A squadra']]);
   const aspetto=E('div');aspetto.id='mAspetto';comandi.append(aspetto);await script('assets/mappa/aspetto-ui.js');aspetto.querySelector('.mappa-preset')?.remove();for(const e of aspetto.querySelectorAll('button'))if(['Stili della community…','Gestisci in TUNING'].includes(e.textContent))e.remove();
   adatta();let drag=null;svg.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,vb:[...vb]};svg.setPointerCapture(e.pointerId);});svg.addEventListener('pointermove',e=>{if(!drag)return;const r=svg.getBoundingClientRect(),scale=Math.max(vb[2]/r.width,vb[3]/r.height);vb=[drag.vb[0]-(e.clientX-drag.x)*scale,drag.vb[1]-(e.clientY-drag.y)*scale,vb[2],vb[3]];svg.setAttribute('viewBox',vb.join(' '));for(const r of svg.querySelectorAll('.msfondo>rect'))['x','y','width','height'].forEach((k,i)=>r.setAttribute(k,vb[i]));});svg.addEventListener('pointerup',()=>drag=null);svg.addEventListener('wheel',e=>{e.preventDefault();const s=e.deltaY>0?1.1:1/1.1;vb=[vb[0]+vb[2]*(1-s)/2,vb[1]+vb[3]*(1-s)/2,vb[2]*s,vb[3]*s];svg.setAttribute('viewBox',vb.join(' '));for(const r of svg.querySelectorAll('.msfondo>rect'))['x','y','width','height'].forEach((k,i)=>r.setAttribute(k,vb[i]));},{passive:false});
   window.ZainoTuningAmbiente={sfondo:s=>{ZainoSfondi.esigi(s);mappaAnnullabile();MAPPA.vista.aspetto={...MAPPA.vista.aspetto,sfondo:'personale',sfondoPersonale:M.copia(s)};mappaSincronizzaComandi();adatta();cambiata();},leggi:async()=>conMetadati(S.mappa(MAPPA.vista)),get demo(){return grafo;}};
  }else{
   document.body.dataset.demo=p.tipo;
   for(const f of ['assets/presentazioni/vendor/katex/dist/katex.min.js','assets/presentazioni/fonti.js','assets/presentazioni/documento.js','presentazioni-player/scrittura.js','assets/presentazioni/barra.js','assets/interfaccia/tipografia.js'])await script(f);
   let documento=D.presentazione(p);window.zainoAttivo=()=> 'tuning-demo';window.bancoVisibile=k=>k==='presenta';window.bancoMostra=()=>{};
   window.ZainoTuningDemo={tipo:p.tipo,cambiata};
   window.vault={presentazioni:{async comando(o){
    if(o.azione==='frame')return {ok:true,url:await ponte.framePresenta(window)};
    if(o.azione==='vista')return ponte.vistaDemo(window,o.documento);
    if(o.azione==='elenco')return {ok:true,elenco:[{id:documento.id,title:documento.title}]};
    if(o.azione==='apri')return {ok:true,documento:M.copia(documento)};
    if(o.azione==='salva'){documento={...M.copia(o.documento),revision:o.baseRevision+1};return {ok:true,documento:M.copia(documento)};}
    if(['editorPronto','bozza','lascia'].includes(o.azione))return {ok:true};
    return {ok:false,error:'Questa funzione riguarda i materiali. Qui stai modificando uno stile su una demo.'};
   },onCambiata:()=>{},onSessione:()=>{},onChiudi:()=>{}}};
   await script('assets/squig/ui.js');await script('assets/drawably/ui.js');await script('assets/presentazioni/editor.js');await ZainoPresenta.apri(documento.id);
   if(p.tipo==='navbar')ZainoPresenta.selezionaOggetto(ZainoPresenta.documento.stacks[0].slides[0].blocks.find(b=>b.type==='navbar').id);
   window.ZainoTuningAmbiente={sfondo:s=>{ZainoSfondi.esigi(s);ZainoPresenta.modifica({tipo:'sfondoPersonale',slideId:ZainoPresenta.slideSelezionata,sfondo:s});cambiata();},async leggi(){await ZainoPresenta.flush();const d=ZainoPresenta.documento,s=M.posizioni(d).find(p=>p.slide.id===ZainoPresenta.slideSelezionata).slide;return conMetadati(D.estrai(p,d,s).stile);},get demo(){return ZainoPresenta.documento;}};
  }
  ponte.pronto(window);
 }catch(e){document.getElementById('demoErrore').textContent=e.message;}
})();
