/* Documento modificabile di PRESENTA: operazioni pure, senza DOM né accessi al vault. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.PresentaModello=factory();})(typeof window==='undefined'?this:window,function(){
 'use strict';
 const VERSIONE=1, STRUMENTI=Object.freeze({presenta:'PRESENTA',gobbo:'GOBBO'});
 const EFFETTI=Object.freeze({'fade-in':'Comparsa','fade-up':'Comparsa dal basso','fade-out':'Scomparsa',grow:'Ingrandimento',shrink:'Riduzione','highlight-red':'Evidenziazione'});
 const LAYOUT=Object.freeze(['free','title-text','text-image','image-caption','two-columns','formula-text','media']);
 const TIPI=['title','text','list','math','image','audio','video'];
 const ID=/^[A-Za-z0-9_-]{1,100}$/;
 const copia=x=>JSON.parse(JSON.stringify(x));
 const nuovoId=()=>globalThis.crypto.randomUUID();
 function slide(id=nuovoId){return {id:id(),title:'Nuova slide',layout:'free',autoAnimate:{enabled:false,groupId:null,duration:0.6},blocks:[],animations:[],notes:{markdown:''}};}
 function crea(zaino,title='Nuova presentazione',id=nuovoId){return {schemaVersion:VERSIONE,id:id(),zainoId:zaino,title,revision:0,settings:{width:1280,height:720,theme:'zaino-light',navigationMode:'default',reducedMotion:false},assets:{},stacks:[{id:id(),slides:[slide(id)]}]};}
 function posizioni(d){return d.stacks.flatMap((p,h)=>p.slides.map((s,v)=>({slide:s,stack:p,h,v})));}
 function trova(d,id){const p=posizioni(d).find(p=>p.slide.id===id);if(!p)throw Error('Slide non più disponibile.');return p;}
 function bersagli(s){return s.blocks.flatMap(b=>[b.id,...(b.items||[]).map(i=>i.id)]);}
 // Percentuali del foglio: il salvataggio resta indipendente dallo zoom e dallo split.
 function contrasto(c){const rgb=[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]>.179?'#16181d':'#fbfbfa';}
 function riquadro(b){return !!b&&!Array.isArray(b)&&Object.keys(b).length===4&&['x','y','width','height'].every(k=>Number.isFinite(b[k]))&&b.x>=0&&b.y>=0&&b.width>=2&&b.height>=2&&b.x+b.width<=100.001&&b.y+b.height<=100.001;}
 function muovi(b,dx,dy,ridimensiona=false){
  if(!riquadro(b)||!Number.isFinite(dx)||!Number.isFinite(dy))throw Error('Posizione non valida.');const r={...b},lim=(n,a,z)=>Math.max(a,Math.min(z,n));
  if(ridimensiona){r.width=lim(b.width+dx,2,100-b.x);r.height=lim(b.height+dy,2,100-b.y);}else{r.x=lim(b.x+dx,0,100-b.width);r.y=lim(b.y+dy,0,100-b.height);}
  return Object.fromEntries(Object.entries(r).map(([k,v])=>[k,Math.round(v*1000)/1000]));
 }
 function iniziale(b,i=0){return b.type==='title'?{x:7,y:6,width:86,height:18}:{x:i%2?53:7,y:30+Math.floor(i/2)%2*30,width:40,height:Math.floor(i/2)%2?27:55};}
 function disponi(s,modo){
  const media=s.blocks.filter(b=>['image','video','audio'].includes(b.type)),testi=s.blocks.filter(b=>b.type!=='title'&&!media.includes(b));
  return s.blocks.map(b=>{if(b.type==='title')return {id:b.id,box:iniziale(b)};const gruppo=media.includes(b)?media:testi,i=gruppo.indexOf(b),immagine=media.includes(b),sinistra=modo==='image-left'?immagine:!immagine;
   const box=modo==='image-top'?{x:7,y:immagine?27+i*30/gruppo.length:62+i*30/gruppo.length,width:86,height:27/gruppo.length}:modo==='text-only'?{x:7,y:28+s.blocks.filter(x=>x.type!=='title').indexOf(b)*60/(s.blocks.length-1),width:86,height:56/(s.blocks.length-1)}:{x:sinistra?7:53,y:29+i*59/gruppo.length,width:40,height:55/gruppo.length};
   return {id:b.id,box};});
 }
 function ancora(b,nome){const [v,h]=nome.split('-'),x={sinistra:7,centro:(100-b.width)/2,destra:93-b.width},y={alto:7,centro:(100-b.height)/2,basso:93-b.height};if(!(h in x)||!(v in y))throw Error('Posizione non disponibile.');return muovi(b,x[h]-b.x,y[v]-b.y);}
 function valida(d){
  const errors=[];if(!d||typeof d!=='object'||Array.isArray(d))return {ok:false,errors:['Documento non valido.']};
  if(d.schemaVersion!==VERSIONE)errors.push('Versione del documento non supportata: nessuna riscrittura consentita.');
  if(!ID.test(d.id||'')||typeof d.zainoId!=='string'||!d.zainoId||/[\\/\x00]/.test(d.zainoId))errors.push('Identità del documento non valida.');
  if(typeof d.title!=='string'||!d.title.trim()||d.title.length>140)errors.push('Titolo non valido.');
  if(!Number.isSafeInteger(d.revision)||d.revision<0)errors.push('Revisione non valida.');
  if(!d.settings||!['default','grid'].includes(d.settings.navigationMode)||!Number.isFinite(d.settings.width)||!Number.isFinite(d.settings.height))errors.push('Impostazioni non valide.');
  if(!d.assets||typeof d.assets!=='object'||Array.isArray(d.assets))errors.push('Risorse non valide.');
  if(!Array.isArray(d.stacks)||!d.stacks.length||d.stacks.length>300)return {ok:false,errors:errors.concat('La presentazione deve contenere almeno una pila (massimo 300).')};
  const ids=new Set(),add=id=>{if(!ID.test(id||'')||ids.has(id))errors.push('Identità mancante o duplicata.');ids.add(id);};add(d.id);
  let quanti=0;
  for(const stack of d.stacks){
   add(stack.id);if(!Array.isArray(stack.slides)||!stack.slides.length){errors.push('Pila senza slide.');continue;}
   for(const s of stack.slides){
    quanti++;add(s.id);
    if(!LAYOUT.includes(s.layout)||!Array.isArray(s.blocks)||!Array.isArray(s.animations)||typeof s.notes?.markdown!=='string'){errors.push('Slide non valida.');continue;}
    if(s.background!==undefined&&!/^#[a-fA-F0-9]{6}$/.test(s.background))errors.push('Sfondo non valido.');
    const targets=new Set();const corrispondenze=new Set();
    for(const b of s.blocks){
     add(b.id);targets.add(b.id);if(b.style?.box&&!riquadro(b.style.box))errors.push('Riquadro fuori dal foglio.');if(b.style?.verticalAlign&&!['start','center','end'].includes(b.style.verticalAlign))errors.push('Posizione verticale non valida.');if(!TIPI.includes(b.type))errors.push('Tipo di blocco non supportato.');
     for(const item of b.items||[]){add(item.id);targets.add(item.id);}
     if(b.assetId&&!Object.hasOwn(d.assets||{},b.assetId))errors.push('Risorsa del blocco mancante.');
     if(['image','audio','video'].includes(b.type)&&d.assets?.[b.assetId]?.kind!==b.type)errors.push('Tipo del blocco e della risorsa non coerenti.');
     if(b.start!==undefined&&b.end!==undefined&&b.end<=b.start)errors.push('Intervallo del media non valido.');
     if(b.matchId){if(corrispondenze.has(b.matchId)||!s.autoAnimate?.enabled)errors.push('Corrispondenza Auto-Animate incoerente.');corrispondenze.add(b.matchId);}
    }
    const azioni=new Set();
    for(const a of s.animations){
     if(!targets.has(a.targetId)||!Number.isSafeInteger(a.step)||a.step<1||a.step>1000||!Object.hasOwn(EFFETTI,a.effect))errors.push('Azione animata non valida.');
     const k=a.targetId+':'+a.step;if(azioni.has(k))errors.push('Un elemento non può avere due effetti nello stesso passaggio.');azioni.add(k);
    }
    const passi=[...new Set(s.animations.map(a=>a.step))].sort((a,b)=>a-b);if(passi.some((n,i)=>n!==i+1))errors.push('I passaggi devono essere consecutivi a partire da 1.');
    if(s.autoAnimate?.enabled&&!ID.test(s.autoAnimate.groupId||''))errors.push('Gruppo Auto-Animate mancante.');
   }
  }
  if(quanti>300)errors.push('Massimo 300 slide per documento.');
  for(const [id,a] of Object.entries(d.assets||{})){
   if(!ID.test(id)||!a||!['image','audio','video'].includes(a.kind)||!/^assets\/[a-f0-9]{64}\.[a-z0-9]{2,5}$/.test(a.path||''))errors.push('Risorsa locale non valida.');
   if(a&&!a.path?.startsWith('assets/'+a.sha256+'.'))errors.push('Impronta e percorso della risorsa non coerenti.');
  }
  return {ok:!errors.length,errors};
 }
 function esigi(d){const r=valida(d);if(!r.ok)throw Error(r.errors.join(' '));return d;}
 function duplicata(s,id,collega){
  const n=copia(s),mappa=new Map();n.id=id();
  for(const b of n.blocks){const prima=b.id;b.id=id();mappa.set(prima,b.id);if(!collega)delete b.matchId;for(const item of b.items||[]){const prima=item.id;item.id=id();mappa.set(prima,item.id);}}
  n.animations=n.animations.map(a=>({...a,targetId:mappa.get(a.targetId)}));
  if(!collega)n.autoAnimate={enabled:false,groupId:null,duration:s.autoAnimate.duration};return n;
 }
 function applica(documento,o,id=nuovoId){
  esigi(documento);const d=copia(documento);if(!o||typeof o.tipo!=='string')throw Error('Operazione non valida.');
  if(o.tipo==='titolo'){d.title=o.title;return esigi(d);}
  const p=trova(d,o.slideId),s=p.slide;
  function inserisci(n){if(o.direzione==='sotto')p.stack.slides.splice(p.v+1,0,n);else d.stacks.splice(p.h+1,0,{id:id(),slides:[n]});}
  switch(o.tipo){
   case 'titoloSlide':{
    s.title=o.title;let b=s.blocks.find(b=>b.type==='title');
    if(!b){b={id:id(),type:'title',slot:'title',markdown:''};if(s.layout==='free')b.style={box:iniziale(b)};s.blocks.unshift(b);}b.markdown=o.title;break;
   }
   case 'spostaArgomento':{
    const h=p.h+o.delta;if(![-1,1].includes(o.delta)||h<0||h>=d.stacks.length)throw Error('Non ci sono altri argomenti in questa direzione.');
    [d.stacks[p.h],d.stacks[h]]=[d.stacks[h],d.stacks[p.h]];break;
   }
   case 'aggiungiSlide':inserisci(slide(id));break;
   case 'duplicaSlide':inserisci(duplicata(s,id,false));break;
   case 'statoSuccessivo':{
    const gruppo=s.autoAnimate.enabled?s.autoAnimate.groupId:id();s.autoAnimate={...s.autoAnimate,enabled:true,groupId:gruppo};
    for(const b of s.blocks)if(!b.matchId)b.matchId=id();inserisci(duplicata(s,id,true));break;
   }
   case 'eliminaSlide':if(posizioni(d).length===1)throw Error('Conserva almeno una slide.');p.stack.slides.splice(p.v,1);if(!p.stack.slides.length)d.stacks.splice(p.h,1);break;
   case 'spostaSlide':{
    const dest=d.stacks.find(x=>x.id===o.stackId);if(!dest||!Number.isInteger(o.index)||o.index<0||o.index>dest.slides.length)throw Error('Destinazione della slide non valida.');
    p.stack.slides.splice(p.v,1);dest.slides.splice(Math.min(o.index,dest.slides.length),0,s);if(!p.stack.slides.length)d.stacks.splice(d.stacks.indexOf(p.stack),1);break;
   }
   case 'slide':for(const k of ['title','layout','notes','autoAnimate','background'])if(Object.hasOwn(o,k))s[k]=copia(o[k]);break;
   case 'inserisciBlocco':{
    const b=copia(o.block);b.id=id();if(b.items)b.items=b.items.map(i=>({...i,id:id()}));
    if(o.asset){if(!o.assetId)throw Error('Identità della risorsa mancante.');d.assets[o.assetId]=copia(o.asset);b.assetId=o.assetId;}
    const index=o.index===undefined?s.blocks.length:o.index;if(!Number.isInteger(index)||index<0||index>s.blocks.length)throw Error('Posizione del blocco non valida.');
    if(s.layout==='free'&&!b.style?.box)b.style={...b.style,box:iniziale(b,s.blocks.filter(x=>x.type!=='title').length)};s.blocks.splice(index,0,b);break;
   }
   case 'blocco':{
    const i=s.blocks.findIndex(b=>b.id===o.blockId);if(i<0)throw Error('Blocco non più disponibile.');
    const b=copia(o.block);if(b.id!==o.blockId)throw Error('L’identità del blocco non si cambia.');s.blocks[i]=b;const rimasti=new Set(bersagli(s));s.animations=s.animations.filter(a=>rimasti.has(a.targetId));break;
   }
   case 'eliminaBlocco':{
    const b=s.blocks.find(b=>b.id===o.blockId);if(!b)throw Error('Blocco non più disponibile.');const target=new Set([b.id,...(b.items||[]).map(i=>i.id)]);
    s.blocks=s.blocks.filter(x=>x!==b);s.animations=s.animations.filter(a=>!target.has(a.targetId));break;
   }
   case 'spostaBlocco':{
    const i=s.blocks.findIndex(b=>b.id===o.blockId);if(i<0||!Number.isInteger(o.index)||o.index<0||o.index>=s.blocks.length)throw Error('Posizione del blocco non valida.');s.blocks.splice(o.index,0,s.blocks.splice(i,1)[0]);break;
   }
   case 'posizionaBlocchi':{
    if(!Array.isArray(o.boxes)||o.boxes.length!==s.blocks.length||new Set(o.boxes.map(x=>x.id)).size!==s.blocks.length)throw Error('Misure degli oggetti non aggiornate.');
    const libera=s.layout==='free';for(const b of s.blocks){const v=o.boxes.find(x=>x.id===b.id);if(!v||!riquadro(v.box))throw Error('Riquadro fuori dal foglio.');b.style={...b.style,box:copia(v.box)};if(!libera&&b.type==='title'&&v.fontSize===undefined)b.style.fontSize=Math.min(160,(b.style.fontSize||32)*1.7);if(v.fontSize!==undefined&&(!libera||!b.style.fontSize)){if(!Number.isFinite(v.fontSize)||v.fontSize<12||v.fontSize>160)throw Error('Dimensione testo non valida.');b.style.fontSize=v.fontSize;}}
    s.layout='free';break;
   }
   case 'animazioni':s.animations=copia(o.animations);break;
   default:throw Error('Operazione PRESENTA non disponibile.');
  }
  // Reveal compatta gli indici: anche il documento mantiene gruppi consecutivi.
  for(const p of posizioni(d)){const passi=[...new Set(p.slide.animations.map(a=>a.step))].sort((a,b)=>a-b);for(const a of p.slide.animations)a.step=passi.indexOf(a.step)+1;}
  return esigi(d);
 }
 function cronologia(documento,limite=100){
  let corrente=copia(esigi(documento)),prima=[],dopo=[];
  return {get documento(){return copia(corrente);},get annullabile(){return !!prima.length;},get ripetibile(){return !!dopo.length;},
   applica(o,id){const nuovo=applica(corrente,o,id);if(JSON.stringify(nuovo)===JSON.stringify(corrente))return copia(corrente);prima.push(corrente);prima=prima.slice(-limite);dopo=[];corrente=nuovo;return copia(corrente);},
   annulla(){if(prima.length){dopo.push(corrente);corrente=prima.pop();}return copia(corrente);},
   ripeti(){if(dopo.length){prima.push(corrente);corrente=dopo.pop();}return copia(corrente);}};
 }
 // È l'unico adattatore tra i passaggi 1-based dell'editor e gli indici Reveal.
 function indiceFragment(step){if(!Number.isSafeInteger(step)||step<1||step>1000)throw Error('Passaggio non valido.');return step-1;}
 function risorseUsate(d){return [...new Set(posizioni(d).flatMap(p=>p.slide.blocks.map(b=>b.assetId).filter(Boolean)))];}
 function pubblica(d){
  esigi(d);const assets={};for(const id of risorseUsate(d)){const a=d.assets[id];assets[id]={kind:a.kind,path:a.path,mimeType:a.mimeType,size:a.size,sha256:a.sha256};}
  // Lista consentita: note, provenienza e identità del vault non arrivano al pubblico.
  const scegli=(o,chiavi)=>Object.fromEntries(chiavi.filter(k=>Object.hasOwn(o,k)).map(k=>[k,copia(o[k])]));
  return {schemaVersion:VERSIONE,title:d.title,settings:scegli(d.settings,['width','height','theme','navigationMode','reducedMotion']),assets,stacks:d.stacks.map(p=>({slides:p.slides.map(s=>({title:s.title,layout:s.layout,...(s.background?{background:s.background}:{}),autoAnimate:scegli(s.autoAnimate,['enabled','groupId','duration']),animations:s.animations.map(a=>scegli(a,['targetId','step','effect'])),blocks:s.blocks.map(b=>{
   const n=scegli(b,['id','type','slot','markdown','latex','display','assetId','alt','caption','matchId','autoplay','start','end']);
   if(b.items)n.items=b.items.map(i=>scegli(i,['id','markdown']));if(b.style)n.style=scegli(b.style,['column','span','row','rowSpan','fontSize','color','highlight','align','scale','box','verticalAlign']);return n;
  })}))}))};
 }
 return {contrasto,riquadro,muovi,iniziale,disponi,ancora,VERSIONE,STRUMENTI,EFFETTI,LAYOUT,crea,slide,copia,posizioni,trova,bersagli,valida,esigi,applica,cronologia,indiceFragment,risorseUsate,pubblica};
});
