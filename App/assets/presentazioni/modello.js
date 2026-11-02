/* Documento modificabile di PRESENTA: operazioni pure, senza DOM né accessi al vault. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./testo'));else root.PresentaModello=factory(root.PresentaTesto);})(typeof window==='undefined'?this:window,function(T){
 'use strict';
 const VERSIONE=1, STRUMENTI=Object.freeze({presenta:'PRESENTA',gobbo:'GOBBO'});
 const EFFETTI=Object.freeze({'fade-in':'Comparsa','fade-up':'Comparsa dal basso','fade-out':'Scomparsa',grow:'Ingrandimento',shrink:'Riduzione','highlight-red':'Evidenziazione'});
 const LAYOUT=Object.freeze(['free','title-text','text-image','image-caption','two-columns','formula-text','media']);
 const CARATTERI=Object.freeze({zaino:{nome:'ZAINO',css:'"Helvetica Neue",Helvetica,Arial,sans-serif'},arial:{nome:'Arial',css:'Arial,Helvetica,sans-serif'},verdana:{nome:'Verdana',css:'Verdana,Geneva,sans-serif'},georgia:{nome:'Georgia',css:'Georgia,"Times New Roman",serif'},atkinson:{nome:'Atkinson Hyperlegible',css:'"Atkinson Hyperlegible",Arial,sans-serif'},'atkinson-next':{nome:'Atkinson Hyperlegible Next',css:'"Atkinson Hyperlegible Next",Arial,sans-serif'},'testme-alt':{nome:'TestMe Sans Alternate',css:'"TestMe Sans Alternate",Arial,sans-serif'},testme:{nome:'TestMe Sans',css:'"TestMe Sans",Arial,sans-serif'},courier:{nome:'Courier',css:'"Courier New",Courier,monospace'}});
 const MODELLI=Object.freeze({vuota:'Vuota',titolo:'Solo titolo',testo:'Titolo e testo',colonne:'Due colonne',domanda:'Domanda'});
 const STILI=Object.freeze({essenziale:{nome:'Essenziale',sfondo:'#ffffff',colore:'#000000',font:'zaino',accento:'#0f766e'},leggibile:{nome:'Leggibile',sfondo:'#fffbeb',colore:'#1e293b',font:'atkinson',accento:'#0f766e'},lavagna:{nome:'Lavagna',sfondo:'#0f172a',colore:'#ffffff',font:'testme',accento:'#5eead4'}});
 const TIPI=['title','text','list','math','image','audio','video','shape','table'];
 const ID=/^[A-Za-z0-9_-]{1,100}$/;
 const copia=x=>JSON.parse(JSON.stringify(x));
 const nuovoId=()=>globalThis.crypto.randomUUID();
 function slide(id=nuovoId){return {id:id(),title:'Nuova slide',layout:'free',autoAnimate:{enabled:false,groupId:null,duration:0.6},blocks:[],animations:[],notes:{markdown:''}};}
 function crea(zaino,title='Nuova presentazione',id=nuovoId){return {schemaVersion:VERSIONE,id:id(),zainoId:zaino,title,revision:0,settings:{width:1280,height:720,theme:'zaino-light',navigationMode:'default',reducedMotion:false},assets:{},stacks:[{id:id(),slides:[slide(id)]}]};}
 function posizioni(d){return d.stacks.flatMap((p,h)=>p.slides.map((s,v)=>({slide:s,stack:p,h,v})));}
 function trova(d,id){const p=posizioni(d).find(p=>p.slide.id===id);if(!p)throw Error('Slide non più disponibile.');return p;}
 function bersagli(s){return s.blocks.flatMap(b=>[b.id,...(b.items||[]).map(i=>i.id)]);}
 // Percentuali del foglio: il salvataggio resta indipendente dallo zoom e dallo split.
 function coloriPersonali(v={}){const colore=c=>typeof c==='string'&&/^#[a-fA-F0-9]{6}$/.test(c);return {ultimo:colore(v?.ultimo)?v.ultimo:'#22c55e',slots:Array.from({length:5},(_,i)=>colore(v?.slots?.[i])?v.slots[i]:null)};}
 function ricordaColore(memoria,hex,slot){
  if(typeof hex!=='string'||!/^#[a-fA-F0-9]{6}$/.test(hex)||slot!==undefined&&(!Number.isInteger(slot)||slot<0||slot>4))throw Error('Colore o slot non valido.');
  const r=coloriPersonali(memoria);r.ultimo=hex.toLowerCase();
  if(slot!==undefined)r.slots[slot]=r.ultimo;
  else if(!r.slots.some(c=>c?.toLowerCase()===r.ultimo)){const libero=r.slots.indexOf(null);if(libero>=0)r.slots[libero]=r.ultimo;else{r.slots.shift();r.slots.push(r.ultimo);}}
  return r;
 }
 function temaPersonale(v){
  if(!v||typeof v.nome!=='string'||!v.nome.trim()||v.nome.length>40||!Object.hasOwn(CARATTERI,v.font)||!['sfondo','colore','accento'].every(k=>typeof v[k]==='string'&&/^#[a-fA-F0-9]{6}$/.test(v[k]))||!['titolo','testo'].every(k=>Number.isFinite(v[k])&&v[k]>=12&&v[k]<=120))return null;
  return {nome:v.nome.trim(),font:v.font,sfondo:v.sfondo,colore:v.colore,accento:v.accento,titolo:v.titolo,testo:v.testo};
 }
 function stileSlide(s){return {layout:s.layout,background:s.background||null,blocks:s.blocks.map(b=>({type:b.type,style:copia(b.style||{})}))};}
 function contrasto(c){const rgb=[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]>.179?'#16181d':'#fbfbfa';}
 function riquadro(b){return !!b&&!Array.isArray(b)&&Object.keys(b).length===4&&['x','y','width','height'].every(k=>Number.isFinite(b[k]))&&b.x>=0&&b.y>=0&&b.width>=2&&b.height>=2&&b.x+b.width<=100.001&&b.y+b.height<=100.001;}
 function selezioneObsoleta(o,corrente,gesto){return o.selezioneGiro<corrente?.selezioneGiro||!!gesto&&o.selezioneGiro<=gesto.generazione&&o.selezionato!==gesto.id;}
 function ritaglioValido(c){return !!c&&Number.isFinite(c.aspect)&&c.aspect>=.01&&c.aspect<=100&&Object.keys(c).length===5&&riquadro({x:c.x,y:c.y,width:c.width,height:c.height});}
 function ritaglia(c,dx,dy,lato){
  if(!ritaglioValido(c)||!Number.isFinite(dx)||!Number.isFinite(dy)||!['sposta','n','s','e','w','ne','nw','se','sw'].includes(lato))throw Error('Ritaglio non valido.');
  const lim=(v,a,b)=>Math.max(a,Math.min(b,v)),box={x:c.x,y:c.y,width:c.width,height:c.height};
  if(lato==='sposta')return {...muovi(box,dx,dy),aspect:c.aspect};
  let x=c.x,y=c.y,r=x+c.width,b=y+c.height;
  if(lato.includes('w'))x=lim(x+dx,0,r-2);if(lato.includes('e'))r=lim(r+dx,x+2,100);
  if(lato.includes('n'))y=lim(y+dy,0,b-2);if(lato.includes('s'))b=lim(b+dy,y+2,100);
  return {x,y,width:r-x,height:b-y,aspect:c.aspect};
 }
 function proporzioneRitaglio(c,ratio){
  if(!ritaglioValido(c)||!Number.isFinite(ratio)||ratio<=0)throw Error('Proporzione non valida.');
  const width=Math.min(c.width,c.height*ratio/c.aspect),height=width*c.aspect/ratio;
  const r={x:c.x+(c.width-width)/2,y:c.y+(c.height-height)/2,width,height,aspect:c.aspect};if(!ritaglioValido(r))throw Error('Allarga il ritaglio prima di cambiare proporzione.');return r;
 }
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
 function allinea(s,ids,modo){
  const scelti=s.blocks.filter(b=>ids.includes(b.id)),boxes=s.blocks.map(b=>({id:b.id,box:copia(b.style?.box||iniziale(b))})),gruppo=boxes.filter(b=>ids.includes(b.id));
  if(scelti.length<2||scelti.length!==new Set(ids).size)throw Error('Seleziona almeno due oggetti.');
  if(!['left','right','center','top','bottom','middle','distribuisci-x','distribuisci-y'].includes(modo))throw Error('Allineamento non disponibile.');
  const minX=Math.min(...gruppo.map(v=>v.box.x)),minY=Math.min(...gruppo.map(v=>v.box.y)),maxX=Math.max(...gruppo.map(v=>v.box.x+v.box.width)),maxY=Math.max(...gruppo.map(v=>v.box.y+v.box.height));
  if(modo.startsWith('distribuisci-')){if(gruppo.length<3)throw Error('Seleziona almeno tre oggetti da distribuire.');const x=modo.endsWith('x'),asse=x?'x':'y',dimensione=x?'width':'height';gruppo.sort((a,b)=>a.box[asse]-b.box[asse]);const min=x?minX:minY,max=x?maxX:maxY,spazio=(max-min-gruppo.reduce((s,b)=>s+b.box[dimensione],0))/(gruppo.length-1);let pos=min;for(const b of gruppo){b.box[asse]=pos;pos+=b.box[dimensione]+spazio;}}
  else for(const b of gruppo){if(modo==='left')b.box.x=minX;if(modo==='right')b.box.x=maxX-b.box.width;if(modo==='center')b.box.x=(minX+maxX-b.box.width)/2;if(modo==='top')b.box.y=minY;if(modo==='bottom')b.box.y=maxY-b.box.height;if(modo==='middle')b.box.y=(minY+maxY-b.box.height)/2;}
  return boxes;
 }
 function righelli(n){
  if(![0,2,3,4].includes(n))throw Error('Griglia non disponibile.');
  return {divisioni:n||3,linee:n?Array.from({length:n+1},(_,i)=>7+86*i/n):[]};
 }
 function cellePosizione(n,{riga=null,colonna=null}){
  if(![2,3,4].includes(n)||[riga,colonna].some(v=>v!==null&&(!Number.isInteger(v)||v<0||v>=n))||riga===null&&colonna===null)throw Error('Posizione non disponibile.');
  return Array.from({length:n*n},(_,i)=>i).filter(i=>(riga===null||Math.floor(i/n)===riga)&&(colonna===null||i%n===colonna));
 }
 function ancoraGriglia(b,{divisioni=3,riga=null,colonna=null}){
  cellePosizione(divisioni,{riga,colonna});if(!riquadro(b))throw Error('Posizione non valida.');
  return muovi(b,colonna===null?0:7+(86-b.width)*colonna/(divisioni-1)-b.x,riga===null?0:7+(86-b.height)*riga/(divisioni-1)-b.y);
 }
 function aggancia(box,altri,soglia=.7,riferimenti=[7,50,93]){
  if(!riquadro(box))throw Error('Posizione non valida.');const b={...box},guide=[];
  for(const [asse,dim]of [['x','width'],['y','height']]){const linee=[...riferimenti,...altri.flatMap(v=>[v[asse],v[asse]+v[dim]/2,v[asse]+v[dim]])];let scelta=null;
   for(const f of [0,.5,1])for(const linea of linee){const delta=linea-(box[asse]+box[dim]*f);if(Math.abs(delta)<=soglia&&(!scelta||Math.abs(delta)<Math.abs(scelta.delta)))scelta={delta,linea};}
   if(scelta&&b[asse]+scelta.delta>=0&&b[asse]+scelta.delta+b[dim]<=100){b[asse]+=scelta.delta;guide.push({asse,pos:scelta.linea});}
  }return {box:b,guide};
 }
 function sistema(s){
  const titolo=s.blocks.find(b=>b.type==='title'),corpo=s.blocks.filter(b=>b!==titolo),media=corpo.filter(b=>['image','audio','video'].includes(b.type)),testi=corpo.filter(b=>!media.includes(b));
  const out=titolo?[{id:titolo.id,box:{x:7,y:6,width:86,height:18}}]:[],alto=titolo?29:7,altezza=titolo?64:86;
  function colonna(bs,x,w){const h=altezza/Math.max(1,bs.length);if(h<4)throw Error('Troppi oggetti per una sola slide. Distribuiscili su più slide.');bs.forEach((b,i)=>out.push({id:b.id,box:{x,y:alto+i*h,width:w,height:h-2}}));}
  if(media.length&&testi.length){colonna(media,7,40);colonna(testi,53,40);}else if(corpo.length>3){colonna(corpo.filter((_,i)=>i%2===0),7,40);colonna(corpo.filter((_,i)=>i%2),53,40);}else colonna(corpo,7,86);
  return out;
 }
 function trasportoSidebar(file,corso,tipo){
  if(typeof file!=='string'||!file||/[\\/\x00]/.test(file)||!corso)return null;
  if(file.startsWith('album:')&&ID.test(file.slice(6)))return {tipo:'album',id:file.slice(6),corso};
  return ['audio','video'].includes(tipo)?{version:1,tipo,file,corso}:null;
 }
 function ancora(b,nome){const [v,h]=nome.split('-'),x={sinistra:7,centro:(100-b.width)/2,destra:93-b.width},y={alto:7,centro:(100-b.height)/2,basso:93-b.height};if(!(h in x)||!(v in y))throw Error('Posizione non disponibile.');return muovi(b,x[h]-b.x,y[v]-b.y);}
 // I modelli nascono vuoti: nessun testo d'esempio può finire per errore nella lezione.
 function daModello(nome,origine,id=nuovoId){
  if(!Object.hasOwn(MODELLI,nome))throw Error('Modello della slide non disponibile.');
  const s=slide(id);if(origine.background)s.background=origine.background;
  function aggiungi(type,box,extra={}){const precedente=origine.blocks.find(b=>b.type===type),style=copia(precedente?.style||{});for(const k of ['box','column','span','row','rowSpan'])delete style[k];s.blocks.push({id:id(),type,slot:type==='title'?'title':'body',markdown:'',style:{...style,...extra,box}});}
  if(nome!=='vuota')aggiungi('title',nome==='domanda'?{x:10,y:20,width:80,height:32}:iniziale({type:'title'}),nome==='domanda'?{align:'center'}:{});
  if(nome==='testo')aggiungi('text',{x:7,y:29,width:86,height:61});
  if(nome==='colonne'){aggiungi('text',{x:7,y:29,width:40,height:61});aggiungi('text',{x:53,y:29,width:40,height:61});}
  if(nome==='domanda')aggiungi('text',{x:15,y:60,width:70,height:26},{align:'center'});
  return s;
 }
 function copiaOggetto(d,slideId,blockId){const block=trova(d,slideId).slide.blocks.find(b=>b.id===blockId);if(!block)throw Error('Seleziona un oggetto da copiare.');return {documentId:d.id,block:copia(block)};}
 function valida(d){
  const errors=[];if(!d||typeof d!=='object'||Array.isArray(d))return {ok:false,errors:['Documento non valido.']};
  if(d.schemaVersion!==VERSIONE)errors.push('Versione del documento non supportata: nessuna riscrittura consentita.');
  if(!ID.test(d.id||'')||typeof d.zainoId!=='string'||!d.zainoId||/[\\/\x00]/.test(d.zainoId))errors.push('Identità del documento non valida.');
  if(typeof d.title!=='string'||!d.title.trim()||d.title.length>140)errors.push('Titolo non valido.');
  if(!Number.isSafeInteger(d.revision)||d.revision<0)errors.push('Revisione non valida.');
  if(!d.settings||!['default','grid'].includes(d.settings.navigationMode)||!Number.isFinite(d.settings.width)||!Number.isFinite(d.settings.height))errors.push('Impostazioni non valide.');
  if(d.settings?.fontFamily!==undefined&&!Object.hasOwn(CARATTERI,d.settings.fontFamily))errors.push('Carattere della presentazione non disponibile.');
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
     if(b.style?.fontWeight!==undefined&&![200,300,400,500,600,700,800,900].includes(b.style.fontWeight))errors.push('Peso del carattere non valido.');
     if(b.style?.fontFamily!==undefined&&!Object.hasOwn(CARATTERI,b.style.fontFamily))errors.push('Carattere non disponibile.');
     for(const k of ['bold','italic','underline'])if(b.style?.[k]!==undefined&&typeof b.style[k]!=='boolean')errors.push('Formato del testo non valido.');
     if(b.style?.lineHeight!==undefined&&(!Number.isFinite(b.style.lineHeight)||b.style.lineHeight<1||b.style.lineHeight>2))errors.push('Interlinea non valida.');
     for(const item of b.items||[]){add(item.id);targets.add(item.id);if(item.richText!==undefined&&!T.valida(item.richText))errors.push('Testo formattato non valido.');}
     if(b.richText!==undefined&&(!['title','text'].includes(b.type)||!T.valida(b.richText)))errors.push('Testo formattato non valido.');
     if(b.assetId&&!Object.hasOwn(d.assets||{},b.assetId))errors.push('Risorsa del blocco mancante.');
     if(['image','audio','video'].includes(b.type)&&d.assets?.[b.assetId]?.kind!==b.type)errors.push('Tipo del blocco e della risorsa non coerenti.');
     if(b.type==='shape'&&!['rectangle','ellipse','arrow'].includes(b.shape))errors.push('Forma non valida.');
     if(b.type==='table'&&(!Array.isArray(b.table)||b.table.length<1||b.table.length>20||!b.table.every(r=>Array.isArray(r)&&r.length===b.table[0].length&&r.length>=1&&r.length<=10&&r.every(c=>typeof c==='string'&&c.length<=2000))))errors.push('Tabella non valida.');
     if(b.crop!==undefined&&(b.type!=='image'||!ritaglioValido(b.crop)))errors.push('Ritaglio dell’immagine non valido.');
     for(const k of ['start','end'])if(b[k]!==undefined&&(!Number.isFinite(b[k])||b[k]<0||b[k]>604800))errors.push('Tempo del media non valido.');
     if(b.end!==undefined&&b.end<=(b.start||0))errors.push('Intervallo del media non valido.');
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
 function senzaCarattere(style,font){const s=T.aggiornaStile(style,{fontFamily:font});delete s.fontFamily;return s;}
 function carattereEreditato(ns,font){return T.normalizza(ns.map(n=>n.style?{...n,style:senzaCarattere(n.style,font)}:n));}
 function destinazioneSlide(d,da,a,quota){
  if(da===a||!Number.isFinite(quota))return null;const p=trova(d,da),q=trova(d,a);
  const dentro=quota>=.25&&quota<=.75;if(p.v===0&&p.stack===q.stack)return null;
  return {tipo:dentro?'approfondisciSlide':'riordinaSlide',slideId:da,destinazione:a,...(dentro?{}:{dopo:quota>.75})};
 }
 function applica(documento,o,id=nuovoId){
  esigi(documento);const d=copia(documento);if(!o||typeof o.tipo!=='string')throw Error('Operazione non valida.');
  if(o.tipo==='titolo'){d.title=o.title;return esigi(d);}
  if(o.tipo==='caratterePresentazione'){
   if(!Object.hasOwn(CARATTERI,o.fontFamily))throw Error('Carattere non disponibile.');
   d.settings.fontFamily=o.fontFamily;for(const p of posizioni(d))for(const b of p.slide.blocks){if(b.style)b.style=senzaCarattere(b.style,o.fontFamily);if(b.richText)b.richText=carattereEreditato(b.richText,o.fontFamily);for(const i of b.items||[])if(i.richText)i.richText=carattereEreditato(i.richText,o.fontFamily);}
   return esigi(d);
  }
  if(o.tipo==='stilePresentazione'){
   const t=o.tema?temaPersonale(o.tema):STILI[o.stile];if(!t)throw Error('Stile non disponibile.');
   const slide=o.tutte?posizioni(d).map(p=>p.slide):[trova(d,o.slideId).slide];if(o.tutte)d.settings.fontFamily=t.font;
   for(const s of slide){s.background=t.sfondo;for(const b of s.blocks){b.style={...T.aggiornaStile(b.style,{fontFamily:t.font}),color:b.type==='title'?t.accento:t.colore,fontSize:b.type==='title'?(t.titolo||54):(t.testo||32),lineHeight:b.type==='title'?1.15:1.4};if(b.richText)b.richText=T.comune(carattereEreditato(b.richText,t.font),'color');for(const i of b.items||[])if(i.richText)i.richText=T.comune(carattereEreditato(i.richText,t.font),'color');}}
   return esigi(d);
  }
  const p=trova(d,o.slideId),s=p.slide;
  function inserisci(n){if(o.direzione==='sotto')p.stack.slides.splice(p.v+1,0,n);else d.stacks.splice(p.h+1,0,{id:id(),slides:[n]});}
  switch(o.tipo){
   case 'titoloSlide':{
    s.title=o.title;let b=s.blocks.find(b=>b.type==='title');
    if(!b){b={id:id(),type:'title',slot:'title',markdown:''};if(s.layout==='free')b.style={box:iniziale(b)};s.blocks.unshift(b);}if(b.richText){b.richText=T.riscrivi(b.richText,o.title);b.markdown=T.markdown(b.richText);}else b.markdown=o.title;break;
   }
   case 'testoInLinea':{
    const b=s.blocks.find(b=>b.id===o.blockId);if(!b||!['title','text','list'].includes(b.type))throw Error('Testo non disponibile.');
    const target=b.type==='list'?b.items.find(i=>i.id===o.itemId):b;if(!target)throw Error('Voce non disponibile.');
    target.richText=T.normalizza(o.richText);target.markdown=T.markdown(target.richText);
    if(b.type==='title')s.title=T.piano(target.richText).replace(/\s+/g,' ').slice(0,140);break;
   }
   case 'spostaArgomento':{
    const h=p.h+o.delta;if(![-1,1].includes(o.delta)||h<0||h>=d.stacks.length)throw Error('Non ci sono altri argomenti in questa direzione.');
    [d.stacks[p.h],d.stacks[h]]=[d.stacks[h],d.stacks[p.h]];break;
   }
   case 'aggiungiSlide':inserisci(o.modello?daModello(o.modello,s,id):slide(id));break;
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
   case 'sostituisciMedia':{
    const b=s.blocks.find(b=>b.id===o.blockId);if(!b||!['image','audio','video'].includes(b.type)||o.block?.type!==b.type||!o.assetId||o.asset?.kind!==b.type)throw Error('Scegli un media dello stesso tipo.');
    d.assets[o.assetId]=copia(o.asset);const sostituto={...copia(o.block),id:b.id,slot:b.slot,style:copia(b.style||{}),assetId:o.assetId};if(b.matchId)sostituto.matchId=b.matchId;s.blocks[s.blocks.indexOf(b)]=sostituto;break;
   }
   case 'gruppo':{
    const ids=new Set(o.ids);if(ids.size<2||!s.blocks.every(b=>!ids.has(b.id)||riquadro(b.style?.box)))throw Error('Selezione non valida.');
    const originali=s.blocks.filter(b=>ids.has(b.id));if(originali.length!==ids.size)throw Error('Oggetti non disponibili.');
    if(o.comando==='elimina'){const target=new Set(originali.flatMap(b=>[b.id,...(b.items||[]).map(i=>i.id)]));s.blocks=s.blocks.filter(b=>!ids.has(b.id));s.animations=s.animations.filter(a=>!target.has(a.targetId));}
    else if(o.comando==='duplica'){for(const o of originali){const b=copia(o);b.id=id();delete b.matchId;if(b.type==='title'){b.type='text';b.slot='body';}if(b.items)b.items=b.items.map(i=>({...i,id:id()}));b.style.box=muovi(b.style.box,2,2);s.blocks.push(b);}}
    else throw Error('Comando del gruppo non disponibile.');break;
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
   case 'duplicaBlocco':{
    const originale=s.blocks.find(b=>b.id===o.blockId);if(!originale)throw Error('Oggetto non disponibile.');const b=copia(originale);b.id=id();delete b.matchId;if(b.type==='title'){b.type='text';b.slot='body';}if(b.items)b.items=b.items.map(i=>({...i,id:id()}));if(b.style?.box)b.style.box=muovi(b.style.box,2,2);s.blocks.push(b);break;
   }
   case 'incollaOggetto':{
    if(o.appunti?.documentId!==d.id||!o.appunti.block)throw Error('Copia un oggetto di questa presentazione.');
    const b=copia(o.appunti.block);b.id=id();delete b.matchId;if(b.type==='title'){b.type='text';b.slot='body';}
    if(b.items)b.items=b.items.map(i=>({...i,id:id()}));if(b.style?.box)b.style.box=muovi(b.style.box,2,2);else if(s.layout==='free')b.style={...b.style,box:iniziale(b,s.blocks.length)};
    s.blocks.push(b);break;
   }
   case 'incollaStile':{
    const v=o.stile;if(!v||!LAYOUT.includes(v.layout)||!Array.isArray(v.blocks))throw Error('Stile della slide non disponibile.');s.layout=v.layout;if(v.background)s.background=v.background;else delete s.background;
    const usati=new Set();for(const b of s.blocks){const i=v.blocks.findIndex((x,i)=>x.type===b.type&&!usati.has(i));if(i<0)continue;usati.add(i);b.style=copia(v.blocks[i].style||{});}break;
   }
   case 'approfondisciSlide':{
    const q=trova(d,o.destinazione);if(q.slide.id===s.id)break;
    if(p.v===0&&p.stack===q.stack)throw Error('Una slide non può diventare approfondimento di una propria slide.');
    // Una principale porta con sé tutti i suoi approfondimenti, senza introdurre un terzo livello Reveal.
    const spostate=p.v===0?p.stack.slides:p.stack.slides.splice(p.v,1);
    if(p.v===0)d.stacks.splice(d.stacks.indexOf(p.stack),1);
    q.stack.slides.splice(q.stack.slides.indexOf(q.slide)+1,0,...spostate);break;
   }
   case 'riordinaSlide':{
    const q=trova(d,o.destinazione);if(q.slide.id===s.id)break;
    if(p.v===0){if(p.stack===q.stack)break;d.stacks.splice(p.h,1);const index=d.stacks.indexOf(q.stack)+(o.dopo?1:0);d.stacks.splice(index,0,p.stack);}
    else{p.stack.slides.splice(p.v,1);if(q.v===0)d.stacks.splice(d.stacks.indexOf(q.stack)+(o.dopo?1:0),0,{id:id(),slides:[s]});else q.stack.slides.splice(q.stack.slides.indexOf(q.slide)+(o.dopo?1:0),0,s);}
    break;
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
  return {schemaVersion:VERSIONE,title:d.title,settings:scegli(d.settings,['width','height','theme','navigationMode','reducedMotion','fontFamily']),assets,stacks:d.stacks.map(p=>({slides:p.slides.map(s=>({title:s.title,layout:s.layout,...(s.background?{background:s.background}:{}),autoAnimate:scegli(s.autoAnimate,['enabled','groupId','duration']),animations:s.animations.map(a=>scegli(a,['targetId','step','effect'])),blocks:s.blocks.map(b=>{
   const n=scegli(b,['id','type','slot','markdown','latex','display','assetId','alt','caption','matchId','autoplay','start','end','crop','richText','shape','table']);
   if(b.items)n.items=b.items.map(i=>scegli(i,['id','markdown','richText']));if(b.style)n.style=scegli(b.style,['column','span','row','rowSpan','fontSize','color','highlight','align','scale','box','verticalAlign','fontFamily','fontWeight','bold','italic','underline','lineHeight']);return n;
  })}))}))};
 }
 return {righelli,cellePosizione,ancoraGriglia,ricordaColore,temaPersonale,destinazioneSlide,allinea,aggancia,STILI,sistema,trasportoSidebar,selezioneObsoleta,ritaglioValido,ritaglia,proporzioneRitaglio,CARATTERI,MODELLI,daModello,copiaOggetto,coloriPersonali,stileSlide,contrasto,riquadro,muovi,iniziale,disponi,ancora,VERSIONE,STRUMENTI,EFFETTI,LAYOUT,crea,slide,copia,posizioni,trova,bersagli,valida,esigi,applica,cronologia,indiceFragment,risorseUsate,pubblica};
});
