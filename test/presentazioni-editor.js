'use strict';
const assert=require('node:assert/strict'),M=require('../App/assets/presentazioni/modello'),C=require('../App/assets/presentazioni/documento');
assert.equal(M.cronologiaTasto({key:'z',metaKey:true}),'annulla');
assert.equal(M.cronologiaTasto({key:'Z',metaKey:true,shiftKey:true}),'ripeti');
assert.equal(M.cronologiaTasto({key:'y',ctrlKey:true}),'ripeti');
assert.equal(M.cronologiaTasto({key:'s',metaKey:true}),'salva');
assert.equal(M.cronologiaTasto({key:'z'}),null);
assert.equal(M.cronologiaTasto({key:'z',metaKey:true,altKey:true}),null);
const Barra=require('../App/assets/presentazioni/barra');
for(const nav of [{x:0,y:360,width:640,height:40},{x:0,y:0,width:640,height:40},{x:0,y:0,width:100,height:400},{x:540,y:0,width:100,height:400},{x:200,y:120,width:240,height:120},{x:-20,y:-100,width:120,height:600},{x:540,y:350,width:200,height:150}]){
 const r=Barra.pannelloNavbar({x:0,y:0,width:640,height:400},nav,{width:360,height:180});assert(r);assert(r.x>=0&&r.y>=0&&r.x+r.width<=640&&r.y+r.height<=400);assert(r.x+r.width<=nav.x||r.x>=nav.x+nav.width||r.y+r.height<=nav.y||r.y>=nav.y+nav.height,'navbar interamente scoperta');
}
assert.equal(Barra.pannelloNavbar({x:0,y:0,width:160,height:90},{x:0,y:0,width:160,height:90},{width:360,height:180}),null,'senza spazio si usa il pannello sotto la slide');
assert.equal(Barra.visibili([200,112,64],392,8,40),3,'tutti i campi entrano esattamente');
assert.equal(Barra.visibili([200,112,64],391,8,40),2,'riserva spazio per Altri');
assert.equal(Barra.visibili([200,112,64],240,8,40),0,'nessun campo parzialmente tagliato');
assert.equal(Barra.visibili([200,112,64],248,8,40),1);
assert.equal(Barra.visibili([40.5,80.5],120,8,40),1,'misure frazionarie');
assert.equal(Barra.visibili([],0,8,40),0);
assert.deepEqual(Barra.griglia(8,1400,8,36),{visibili:8,colonne:8},'schermo largo: tutti gli otto controlli in riga');
assert.deepEqual(Barra.griglia(8,900,8,36),{visibili:8,colonne:5},'più colonne, al massimo due righe');
assert.deepEqual(Barra.griglia(8,440,8,36),{visibili:4,colonne:2},'split stretto: quattro controlli e menu');
assert.deepEqual(Barra.griglia(8,200,8,36),{visibili:0,colonne:0},'nessun cursore tagliato');
assert.deepEqual(Barra.griglia(0,0,8,36),{visibili:0,colonne:0});
const differita=()=>{let resolve,reject;return {promise:new Promise((r,j)=>{resolve=r;reject=j;}),resolve,reject};};
(async()=>{
 let disco=M.crea('00000000-0000-4000-8000-000000000001','Lezione');disco.revision=1;const sid=disco.stacks[0].slides[0].id;
 let fermo=differita(),ritarda=true,richieste=0,bozza=null;
 const editor=C.crea({ritardo:60000,salva:async(d,revision)=>{richieste++;if(ritarda){ritarda=false;await fermo.promise;}assert.equal(revision,disco.revision);disco={...d,revision:revision+1};return disco;},bozza:async d=>{bozza=d;}});
 editor.apri(disco);editor.applica({tipo:'titoloSlide',slideId:sid,title:'Una foglia'});const save=editor.flush();
 editor.applica({tipo:'inserisciBlocco',slideId:sid,block:{type:'text',slot:'body',markdown:'Scritto durante il salvataggio'}});fermo.resolve();await save;
 assert.equal(richieste,2);assert.equal(disco.stacks[0].slides[0].blocks[1].markdown,'Scritto durante il salvataggio');assert.equal(editor.sporco,false);
 editor.annulla();await editor.flush();assert.equal(disco.stacks[0].slides[0].blocks.length,1);assert.equal(disco.revision,4,'undo conserva la revisione corrente del disco');
 editor.ripeti();await editor.flush();assert.equal(disco.stacks[0].slides[0].blocks.length,2);assert.equal(disco.revision,5);
 editor.applica({tipo:'titolo',title:'Ultima battuta'});let lasciata=false;
 await editor.transizione(()=>{lasciata=true;assert.equal(disco.title,'Ultima battuta');assert.throws(()=>editor.applica({tipo:'titolo',title:'Durante il cambio'}),/Attendi/);});assert(lasciata);
 editor.svuota();assert.equal(editor.documento,null);
 let rotto=true;
 const errore=C.crea({ritardo:60000,salva:async(d,rev)=>{if(rotto)throw Error('Disco pieno');return {...d,revision:rev+1};},bozza:async d=>{bozza=d;}});
 errore.apri(disco);errore.applica({tipo:'titolo',title:'Da recuperare'});
 await assert.rejects(errore.transizione(()=>{throw Error('Non deve lasciare il documento');}),/Disco pieno/);
 assert.equal(bozza.title,'Da recuperare');assert(errore.sporco);assert.throws(()=>errore.svuota(),/non salvate/);assert.equal(errore.documento.title,'Da recuperare');
 rotto=false;await errore.flush();assert.equal(errore.sporco,false);errore.svuota();
 let d=M.applica(disco,{tipo:'aggiungiSlide',slideId:sid});const secondo=d.stacks[1].slides[0].id;
 d=M.applica(d,{tipo:'spostaArgomento',slideId:secondo,delta:-1});assert.equal(d.stacks[0].slides[0].id,secondo);assert.throws(()=>M.applica(d,{tipo:'spostaArgomento',slideId:secondo,delta:-1}));
 // Il foglio usa percentuali: un gesto è una sola operazione, anche quando converte la griglia.
 const {validatePresentazione}=require('../lib/validate'),Rivela=require('../App/assets/presentazioni/reveal-adapter');
 let foglio=M.crea('00000000-0000-4000-8000-000000000001','Sul foglio'),fid=foglio.stacks[0].slides[0].id;
 foglio=M.applica(foglio,{tipo:'titoloSlide',slideId:fid,title:'Demografia'});
 foglio=M.applica(foglio,{tipo:'inserisciBlocco',slideId:fid,block:{type:'text',slot:'body',markdown:'Confederazione'}});
 const slideFoglio=()=>M.trova(foglio,fid).slide,blocchi=slideFoglio().blocks;
 assert.equal(slideFoglio().layout,'free');assert(blocchi.every(b=>M.riquadro(b.style.box)));
 const g=M.righelli(4);assert.equal(g.divisioni,4);assert.deepEqual(g.linee,[7,28.5,50,71.5,93]);
 assert.equal(M.righelli(0).divisioni,3);assert.deepEqual(M.righelli(0).linee,[]);assert.throws(()=>M.righelli(8));
 const daPosizionare={x:19,y:23,width:40,height:30};
 assert.deepEqual(M.ancoraGriglia(daPosizionare,{divisioni:3,riga:2,colonna:2}),M.ancora(daPosizionare,'basso-destra'));
 assert.equal(M.ancoraGriglia(daPosizionare,{divisioni:4,riga:1,colonna:null}).x,19);
 assert.equal(M.ancoraGriglia(daPosizionare,{divisioni:4,riga:null,colonna:2}).y,23);
 assert.deepEqual(M.cellePosizione(4,{riga:1,colonna:null}),[4,5,6,7]);
 assert.deepEqual(M.cellePosizione(3,{riga:null,colonna:2}),[2,5,8]);
 assert.throws(()=>M.ancoraGriglia(daPosizionare,{divisioni:3,riga:3,colonna:0}));
 const snap=M.aggancia({x:28.1,y:20,width:10,height:10},[],.7,g.linee);assert.equal(snap.box.x,28.5);assert(snap.guide.some(g=>g.pos===28.5));
 // Il vincolo sceglie l’asse in pixel del puntatore, prima della conversione in percentuali.
 assert.deepEqual(M.vincolaSpostamento(30,8),{dx:30,dy:0,asse:'x'});
 assert.deepEqual(M.vincolaSpostamento(3,-20),{dx:0,dy:-20,asse:'y'});
 assert.deepEqual(M.vincolaSpostamento(3,50,'x'),{dx:3,dy:0,asse:'x'},'l’asse resta fermo finché si tiene Maiusc');
 assert.deepEqual(M.vincolaSpostamento(0,0),{dx:0,dy:0,asse:null});
 assert.deepEqual(M.deltaFreccia('ArrowRight',.25),[.25,0]);
 assert.deepEqual(M.deltaFreccia('ArrowUp',2,true),[0,-6]);
 assert.deepEqual(M.deltaFreccia('ArrowLeft',NaN),[-1,0]);
 assert.equal(M.deltaFreccia('a',1),null);
 for(const p of M.PASSI_FRECCE)assert.equal(M.passoFrecce(p),p);
 for(const p of [null,0,-1,100,'rotto'])assert.equal(M.passoFrecce(p),1);
 const box={x:7,y:30,width:40,height:55};assert.deepEqual(M.muovi(box,12,-9),{x:19,y:21,width:40,height:55});
 assert.deepEqual(M.muovi(box,500,-500),{x:60,y:0,width:40,height:55});
 assert.deepEqual(M.muovi(box,500,500,true),{x:7,y:30,width:93,height:70});assert.equal(M.muovi(box,-500,0,true).width,2);
 assert.throws(()=>M.muovi(box,NaN,0));assert(!M.riquadro({...box,width:100}));assert.equal(box.x,7,'il gesto non muta il documento di partenza');
 assert.deepEqual(M.ancora(box,'basso-destra'),{x:53,y:38,width:40,height:55});
 foglio=M.applica(foglio,{tipo:'slide',slideId:fid,layout:'title-text'});const storiaFoglio=M.cronologia(foglio),boxes=blocchi.map((b,i)=>({id:b.id,box:i?M.muovi(box,12,-9):b.style.box,fontSize:b.type==='title'?54:32}));
 storiaFoglio.applica({tipo:'posizionaBlocchi',slideId:fid,boxes});assert.equal(M.trova(storiaFoglio.documento,fid).slide.blocks[1].style.box.x,19);
 assert.deepEqual(storiaFoglio.annulla(),foglio,'un annulla ripristina tutte le misure e la disposizione precedente');storiaFoglio.ripeti();foglio=storiaFoglio.documento;
 assert.throws(()=>M.applica(foglio,{tipo:'posizionaBlocchi',slideId:fid,boxes:[boxes[0]]}),/Misure/);
 assert.throws(()=>M.applica(foglio,{tipo:'posizionaBlocchi',slideId:fid,boxes:boxes.map(v=>({...v,box:{...v.box,x:99}}))}),/Riquadro/);
 foglio=M.applica(foglio,{tipo:'slide',slideId:fid,background:'#0f1115'});assert(validatePresentazione(foglio).ok);
 const pubblica=M.pubblica(foglio);assert.equal(pubblica.stacks[0].slides[0].background,'#0f1115');assert.deepEqual(pubblica.stacks[0].slides[0].blocks[1].style.box,boxes[1].box);
 const htmlFoglio=Rivela.compila(foglio).html;assert(htmlFoglio.includes('left:19%'));assert(htmlFoglio.includes('background-color:#0f1115'));assert(htmlFoglio.includes('color:#fbfbfa'));
 assert.throws(()=>M.applica(foglio,{tipo:'slide',slideId:fid,background:'red;url(http://example.com)'}),/Sfondo/);
 const errato=M.copia(foglio);errato.stacks[0].slides[0].blocks[0].style.box.x=500;assert(!validatePresentazione(errato).ok);
 // Gli sfondi sono risorse del documento, separati dai blocchi e presenti anche nell’export.
 {
  const asset=(kind,ext,n)=>({kind,path:'assets/'+String(n).repeat(64)+'.'+ext,mimeType:kind==='image'?'image/'+ext:'video/webm',sha256:String(n).repeat(64),size:10,source:{kind:'album',id:'privata',title:'Fonte privata'}});
  const foto=asset('image','png',1),gif=asset('image','gif',2),video=asset('video','webm',3),sfondo={assetId:'foto_sfondo',fit:'cover',loop:true,muted:true};
  const storia=M.cronologia(foglio);storia.applica({tipo:'sfondoMedia',slideId:fid,assetId:sfondo.assetId,asset:foto,backgroundMedia:sfondo});const d=storia.documento;
  assert.deepEqual(d.stacks[0].slides[0].blocks,foglio.stacks[0].slides[0].blocks);assert(validatePresentazione(d).ok);
  assert.deepEqual(M.risorseUsate(d),['foto_sfondo']);assert(!JSON.stringify(M.pubblica(d)).includes('Fonte privata'));
  assert.deepEqual(M.pubblica(d).stacks[0].slides[0].backgroundMedia,sfondo);
  assert(Rivela.compila(d).html.includes('data-background-image="'+foto.path+'"'));assert(Rivela.compila(d).html.includes('data-sfondo-media="true"'));
  assert.equal(storia.annulla().stacks[0].slides[0].backgroundMedia,undefined);assert.deepEqual(storia.ripeti().stacks[0].slides[0].backgroundMedia,sfondo);
  const g=M.applica(d,{tipo:'sfondoMedia',slideId:fid,assetId:'gif_sfondo',asset:gif,backgroundMedia:{...sfondo,assetId:'gif_sfondo',fit:'contain'}});
  assert(Rivela.compila(g).html.includes('data-background-image="'+gif.path+'"'));assert(Rivela.compila(g).html.includes('data-background-size="contain"'));
  const v=M.applica(g,{tipo:'sfondoMedia',slideId:fid,assetId:'video_sfondo',asset:video,backgroundMedia:{...sfondo,assetId:'video_sfondo'}}),html=Rivela.compila(v).html;
  assert(html.includes('data-background-video="'+video.path+'"'));assert(html.includes('data-background-video-loop'));assert(html.includes('data-background-video-muted'));
  assert.deepEqual(M.risorseUsate(v),['video_sfondo'],'le risorse sostituite non entrano nel pacchetto');
  const senzaAudio=M.applica(v,{tipo:'sfondoMedia',slideId:fid,backgroundMedia:{...sfondo,assetId:'video_sfondo',muted:false,loop:false}});
  assert(!Rivela.compila(senzaAudio).html.includes('data-background-video-muted'));assert(!Rivela.compila(senzaAudio).html.includes('data-background-video-loop'));
  const rimossa=M.applica(v,{tipo:'sfondoMedia',slideId:fid,backgroundMedia:null});assert.equal(rimossa.stacks[0].slides[0].backgroundMedia,undefined);assert.deepEqual(M.risorseUsate(rimossa),[]);
  assert.deepEqual(M.daModello('vuota',v.stacks[0].slides[0]).backgroundMedia,v.stacks[0].slides[0].backgroundMedia);
  assert.deepEqual(M.applica(rimossa,{tipo:'incollaStile',slideId:fid,stile:M.stileSlide(v.stacks[0].slides[0])}).stacks[0].slides[0].backgroundMedia,v.stacks[0].slides[0].backgroundMedia);
  for(const patch of [{assetId:'mancante'},{fit:'url(https://male)'},{muted:'false'},{src:'file:///privato'}])assert.throws(()=>M.applica(v,{tipo:'sfondoMedia',slideId:fid,backgroundMedia:{...sfondo,assetId:'video_sfondo',...patch}}));
  assert.throws(()=>M.applica(d,{tipo:'sfondoMedia',slideId:fid,assetId:'audio',asset:{...video,kind:'audio'},backgroundMedia:{assetId:'audio',fit:'cover'}}));
 }
 // Riordino e stile non portano con sé il contenuto o gli appunti di un'altra slide.
 const stile=M.stileSlide(slideFoglio()),primaTesto=slideFoglio().blocks[1].markdown;
 foglio=M.applica(foglio,{tipo:'slide',slideId:fid,background:'#ffffff'});foglio=M.applica(foglio,{tipo:'incollaStile',slideId:fid,stile});assert.equal(slideFoglio().background,'#0f1115');assert.equal(slideFoglio().blocks[1].markdown,primaTesto);assert(!JSON.stringify(stile).includes('notes'));
 foglio=M.applica(foglio,{tipo:'duplicaBlocco',slideId:fid,blockId:slideFoglio().blocks[1].id});assert.equal(slideFoglio().blocks.length,3);assert.notEqual(slideFoglio().blocks[1].id,slideFoglio().blocks[2].id);assert.notEqual(slideFoglio().blocks[1].style.box.x,slideFoglio().blocks[2].style.box.x);
 const originaleTitolo=M.copia(slideFoglio().blocks[0]);const testo=slideFoglio().blocks[1];foglio=M.applica(foglio,{tipo:'blocco',slideId:fid,blockId:testo.id,block:{...testo,style:{...testo.style,align:'right',color:'#abcdef'}}});assert.deepEqual(slideFoglio().blocks[0],originaleTitolo,'allineamento e colore appartengono al solo oggetto');
 foglio=M.applica(foglio,{tipo:'aggiungiSlide',slideId:fid});const secondoId=foglio.stacks[1].slides[0].id;foglio=M.applica(foglio,{tipo:'aggiungiSlide',slideId:secondoId,direzione:'sotto'});const dettaglio=foglio.stacks[1].slides[1].id;
 foglio=M.applica(foglio,{tipo:'riordinaSlide',slideId:secondoId,destinazione:fid});assert.equal(foglio.stacks[0].slides[0].id,secondoId);assert.equal(foglio.stacks[0].slides[1].id,dettaglio,'spostare l’argomento conserva gli approfondimenti');
 foglio=M.applica(foglio,{tipo:'riordinaSlide',slideId:dettaglio,destinazione:fid,dopo:true});assert.equal(foglio.stacks[2].slides[0].id,dettaglio);assert(validatePresentazione(foglio).ok);
 // I colori scelti si ricordano senza un gesto di salvataggio; gli slot espliciti restano modificabili.
 const vuoti=M.coloriPersonali(),mem=M.ricordaColore(vuoti,'#0EA5E9');
 assert.equal(mem.slots[0],'#0ea5e9');assert.equal(vuoti.slots[0],null);
 assert.deepEqual(M.ricordaColore(mem,'#0ea5e9'),mem,'nessun duplicato automatico');
 assert.equal(M.ricordaColore(mem,'#22c55e',4).slots[4],'#22c55e');
 assert.throws(()=>M.ricordaColore(mem,'url(no)'));assert.throws(()=>M.ricordaColore(mem,'#ffffff',5));
 const pieni={ultimo:'#555555',slots:['#111111','#222222','#333333','#444444','#555555']};
 assert.deepEqual(M.ricordaColore(pieni,'#666666').slots,['#222222','#333333','#444444','#555555','#666666']);
 // I temi personali sono dati limitati, applicabili senza toccare geometrie e contenuti.
 const tema=M.temaPersonale({nome:'Mio stile',font:'atkinson-next',sfondo:'#e0f2fe',colore:'#0c4a6e',accento:'#075985',titolo:48,testo:28});
 assert(tema);assert.equal(M.temaPersonale({...tema,font:'url(no)'}),null);assert.equal(M.temaPersonale({...tema,testo:999}),null);
 const primaTema=M.copia(foglio),storiaTema=M.cronologia(foglio);
 storiaTema.applica({tipo:'stilePresentazione',slideId:fid,tema,tutte:true});
 for(const p of M.posizioni(storiaTema.documento)){
  assert.equal(p.slide.background,tema.sfondo);
  for(const b of p.slide.blocks)assert.equal(b.style.fontSize,b.type==='title'?48:28);
 }
 assert.equal(storiaTema.documento.settings.fontFamily,'atkinson-next');
 assert.deepEqual(M.trova(storiaTema.documento,fid).slide.blocks[1].style.box,M.trova(primaTema,fid).slide.blocks[1].style.box);
 assert.equal(M.trova(storiaTema.documento,fid).slide.blocks[1].markdown,M.trova(primaTema,fid).slide.blocks[1].markdown);
 assert.deepEqual(storiaTema.annulla(),primaTema);assert(validatePresentazione(storiaTema.ripeti()).ok);
 assert.throws(()=>M.applica(foglio,{tipo:'stilePresentazione',slideId:fid,tema:{...tema,sfondo:'red;url(no)'}}));
 const palette=M.coloriPersonali({ultimo:'#ABCDEF',slots:['#123456','url(bad)',null,'#654321','#000000','#ffffff']});assert.equal(palette.ultimo,'#ABCDEF');assert.deepEqual(palette.slots,['#123456',null,null,'#654321','#000000']);assert.equal(M.coloriPersonali(null).slots.length,5);
 const Colori=require('../App/assets/presentazioni/colori');
 assert.equal(Colori.palette.length,242);assert.equal(new Set(Colori.palette.map(c=>c.id)).size,242);
 assert.equal(Colori.palette.find(c=>c.id==='sky-500').hex,'#0ea5e9');assert.equal(Colori.palette.find(c=>c.id==='slate-950').hex,'#020617');
 assert.equal(Colori.etichetta('#0EA5E9'),'sky-500');assert.equal(Colori.etichetta('#ffffff'),'white');assert.equal(Colori.etichetta('#000000'),'black');
 assert.equal(Colori.etichetta('#0ea5e8'),'≈ sky-500');assert.equal(Colori.etichetta(null),'—');assert.equal(Colori.etichetta('url(bad)'),'—');
 assert.equal(Colori.sfondoBianco('#ffffff','zaino-dark'),true);assert.equal(Colori.sfondoBianco(undefined,'zaino-light'),true);assert.equal(Colori.sfondoBianco(undefined,'zaino-dark'),false);assert.equal(Colori.sfondoBianco('#fefce8','zaino-light'),false);
 // La formattazione cambia il singolo oggetto e attraversa il confine pubblico/offline.
 let base=M.crea('00000000-0000-4000-8000-000000000001','Strumenti di base');const bs=base.stacks[0].slides[0].id;
 base=M.applica(base,{tipo:'titoloSlide',slideId:bs,title:'Titolo indipendente'});
 base=M.applica(base,{tipo:'inserisciBlocco',slideId:bs,block:{type:'text',slot:'body',markdown:'Contenuto',style:{fontFamily:'georgia',bold:true,italic:true,underline:true,lineHeight:1.6,color:'#0f766e'}}});
 base=M.applica(base,{tipo:'slide',slideId:bs,background:'#fef9c3'});
 const stileTesto=M.trova(base,bs).slide.blocks[1].style;assert(validatePresentazione(base).ok);
 assert.deepEqual(M.pubblica(base).stacks[0].slides[0].blocks[1].style,stileTesto,'tutto lo stile sopravvive alla pubblicazione');
 const htmlStile=Rivela.compila(base).html;for(const css of ['font-family:Georgia','--peso-testo:700','font-style:italic','--sottolineato-testo:underline','--interlinea:1.6'])assert(htmlStile.includes(css),css+' deve arrivare al player e all’export');
 assert(!M.trova(base,bs).slide.blocks[0].style.fontFamily,'il titolo non eredita una modifica locale al testo');
 for(const [k,v]of [['fontFamily','url(https://bad)'],['bold','true'],['lineHeight',9]]){const err=M.copia(base);err.stacks[0].slides[0].blocks[1].style[k]=v;assert(!M.valida(err).ok);assert(!validatePresentazione(err).ok);assert.throws(()=>Rivela.compila(err));}
 const storiaBase=M.cronologia(base);storiaBase.applica({tipo:'aggiungiSlide',slideId:bs,modello:'colonne'});let nuova=storiaBase.documento.stacks[1].slides[0];
 assert.equal(nuova.blocks.length,3);assert.equal(nuova.background,'#fef9c3');assert(nuova.blocks.every(b=>!b.markdown),'i modelli non introducono testi nella lezione');assert(nuova.blocks.every(b=>M.riquadro(b.style.box)));
 assert.equal(nuova.blocks[1].style.fontFamily,'georgia');assert.equal(nuova.blocks[2].style.box.x,53);assert.equal(nuova.notes.markdown,'');assert(validatePresentazione(storiaBase.documento).ok);
 assert.deepEqual(storiaBase.annulla(),base,'una sola operazione annulla l’intera nuova slide');storiaBase.ripeti();
 for(const modello of Object.keys(M.MODELLI)){const doc=M.applica(base,{tipo:'aggiungiSlide',slideId:bs,modello});assert(validatePresentazione(doc).ok,modello);}
 assert.throws(()=>M.applica(base,{tipo:'aggiungiSlide',slideId:bs,modello:'inesistente'}));
 const appunti=M.copiaOggetto(base,bs,M.trova(base,bs).slide.blocks[1].id),primaIncolla=storiaBase.documento;
 storiaBase.applica({tipo:'incollaOggetto',slideId:nuova.id,appunti});const incollato=M.trova(storiaBase.documento,nuova.id).slide.blocks.at(-1);
 assert.equal(incollato.markdown,'Contenuto');assert.equal(incollato.style.fontFamily,'georgia');assert.notEqual(incollato.id,appunti.block.id);assert(validatePresentazione(storiaBase.documento).ok);
 assert.deepEqual(storiaBase.annulla(),primaIncolla);assert.throws(()=>M.applica(M.crea('altro-zaino','Altro'),{tipo:'incollaOggetto',slideId:'manca',appunti}));
 const altro=M.crea('altro-zaino','Altro');assert.throws(()=>M.applica(altro,{tipo:'incollaOggetto',slideId:altro.stacks[0].slides[0].id,appunti}),/questa presentazione/);
 assert.deepEqual(appunti.block.style,stileTesto,'incollare non cambia gli appunti');
 // Il protocollo non può diventare un lettore generico del vault.
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),P=require('../lib/presentazioni'),R=require('../lib/presentazioni-risorse'),V=require('../lib/presentazioni-vista');
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'zaino-presenta-vista-'));try{
  require('../lib/zaini').crea(tmp,'Scienze');let doc=await P.crea(tmp,'scienze','Risorse autorizzate');
  const img=require('../lib/album').salva(tmp,'scienze',{origine:'foto',materiale:'pianeta.png',dati:'data:image/png;base64,'+require('./fixtures/presentazioni').png.toString('base64')});
  const r=await R.importa(tmp,'scienze',doc.id,{tipo:'album',id:img.voce.id,corso:'scienze'},1);doc=M.applica(doc,{tipo:'inserisciBlocco',slideId:doc.stacks[0].slides[0].id,...r});
  let handle;const session={protocol:{handle:(_scheme,fn)=>{handle=fn;}}},net={fetch:async url=>new Response(fs.readFileSync(require('node:url').fileURLToPath(url)))};
  const vista=V.crea({session,net,v:tmp,z:'scienze',id:doc.id}),pubblico=vista.compila(doc),url=pubblico.html.match(/src="([^"]+)"/)[1];
  assert(url.startsWith('presenta://'));assert(!pubblico.html.includes(tmp));assert(V.consentita(url,session));
  assert.deepEqual(Buffer.from(await (await handle(new Request(url))).arrayBuffer()),require('./fixtures/presentazioni').png);
  for(const u of [url.replace(/assets\/.*/, 'presentazione.json'),url.replace(/assets\/.*/, '../_identita.json'),url+'?file=segreto',url.replace('presenta://','presenta://utente@'),url.replace('presenta://','https://')])assert(!V.consentita(u,session));
  doc=M.applica(doc,{tipo:'sfondoPattern',slideId:doc.stacks[0].slides[0].id,pattern:'chiara'});const carta=vista.compila(doc).html.match(/src="([^"]+\/carte\/chiara.png)"/)[1];
  assert(V.consentita(carta,session));assert.equal(Buffer.from(await (await handle(new Request(carta))).arrayBuffer()).subarray(1,4).toString(),'PNG');assert(!V.consentita(carta.replace('carte/chiara.png','modello.js'),session));
  vista.chiudi();for(const u of [url,carta]){assert(!V.consentita(u,session));assert.equal((await handle(new Request(u))).status,404);}
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
 {
  let x=M.crea('00000000-0000-4000-8000-000000000001','Sfondo comune'),sid=x.stacks[0].slides[0].id;
  const opera=o=>x=M.applica(x,{slideId:sid,...o}),slide=()=>M.trova(x,sid).slide;
  opera({tipo:'aggiungiSlide',direzione:'destra'});const seconda=x.stacks[1].slides[0].id;
  const a={kind:'video',path:'assets/'+('4'.repeat(64))+'.webm',mimeType:'video/webm',sha256:'4'.repeat(64),size:10};
  opera({tipo:'sfondoMedia',assetId:'comune',asset:a,backgroundMedia:{assetId:'comune',fit:'cover'}});assert.equal(slide().backgroundMedia.loop,true);opera({tipo:'sfondoTutte'});
  assert(M.posizioni(x).every(p=>M.sfondoSlide(x,p.slide).backgroundMedia.assetId==='comune'));assert(validatePresentazione(x).ok);assert.deepEqual(M.risorseUsate(x),['comune']);
  const html=Rivela.compila(x).html;assert.equal((html.match(/<video /g)||[]).length,1,'un solo video condiviso');assert.equal((html.match(/data-sfondo-comune="true"/g)||[]).length,2);assert(!JSON.stringify(M.pubblica(x)).includes('Fonte privata'));
  opera({tipo:'sfondoAutonomo',slideId:seconda,autonomo:true});opera({tipo:'sfondoPattern',slideId:seconda,pattern:'naturale'});assert.equal(M.sfondoSlide(x,M.trova(x,seconda).slide).backgroundPattern,'naturale');assert.equal(M.sfondoSlide(x,slide()).backgroundMedia.assetId,'comune');assert(Rivela.compila(x).html.includes('carte/naturale.png'));
  opera({tipo:'aggiungiSlide',direzione:'sotto'});assert.equal(M.sfondoSlide(x,x.stacks[0].slides[1]).backgroundMedia.assetId,'comune','nuove slide collegate');opera({tipo:'sfondoPattern',pattern:'cotone'});assert.equal(x.backgroundCommon.backgroundPattern,'cotone');assert.equal(x.backgroundCommon.backgroundMedia,undefined);assert.equal(M.sfondoSlide(x,M.trova(x,seconda).slide).backgroundPattern,'naturale','eccezione conservata');
  opera({tipo:'sfondoAutonomo',slideId:seconda,autonomo:false});assert.equal(M.sfondoSlide(x,M.trova(x,seconda).slide).backgroundPattern,'cotone');assert(validatePresentazione(x).ok);
  opera({tipo:'sfondoTutte'});assert(M.posizioni(x).every(p=>!p.slide.backgroundIndependent));opera({tipo:'incollaStile',stile:{layout:'free',background:'#000000',blocks:[]}});assert(!slide().backgroundIndependent,'Incolla stile conserva il collegamento');assert.equal(M.sfondoSlide(x,slide()).backgroundPattern,'cotone');assert.throws(()=>opera({tipo:'sfondoPattern',pattern:'url(file:///secret)'}));
  const storia=M.cronologia(x);storia.applica({tipo:'sfondoColore',slideId:sid,background:'#000000'});assert.equal(storia.documento.backgroundCommon.backgroundPattern,undefined);assert.equal(storia.annulla().backgroundCommon.backgroundPattern,'cotone');
 }
 console.log('✓ Editor PRESENTA: scrittura durante autosave, undo/redo dopo salvataggio, flush delle transizioni, errore disco, bozza e riordino');
})().catch(e=>{console.error(e);process.exitCode=1;});
