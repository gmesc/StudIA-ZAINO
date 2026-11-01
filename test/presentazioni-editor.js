'use strict';
const assert=require('node:assert/strict'),M=require('../App/assets/presentazioni/modello'),C=require('../App/assets/presentazioni/documento');
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
 // Riordino e stile non portano con sé il contenuto o gli appunti di un'altra slide.
 const stile=M.stileSlide(slideFoglio()),primaTesto=slideFoglio().blocks[1].markdown;
 foglio=M.applica(foglio,{tipo:'slide',slideId:fid,background:'#ffffff'});foglio=M.applica(foglio,{tipo:'incollaStile',slideId:fid,stile});assert.equal(slideFoglio().background,'#0f1115');assert.equal(slideFoglio().blocks[1].markdown,primaTesto);assert(!JSON.stringify(stile).includes('notes'));
 foglio=M.applica(foglio,{tipo:'duplicaBlocco',slideId:fid,blockId:slideFoglio().blocks[1].id});assert.equal(slideFoglio().blocks.length,3);assert.notEqual(slideFoglio().blocks[1].id,slideFoglio().blocks[2].id);assert.notEqual(slideFoglio().blocks[1].style.box.x,slideFoglio().blocks[2].style.box.x);
 const originaleTitolo=M.copia(slideFoglio().blocks[0]);const testo=slideFoglio().blocks[1];foglio=M.applica(foglio,{tipo:'blocco',slideId:fid,blockId:testo.id,block:{...testo,style:{...testo.style,align:'right',color:'#abcdef'}}});assert.deepEqual(slideFoglio().blocks[0],originaleTitolo,'allineamento e colore appartengono al solo oggetto');
 foglio=M.applica(foglio,{tipo:'aggiungiSlide',slideId:fid});const secondoId=foglio.stacks[1].slides[0].id;foglio=M.applica(foglio,{tipo:'aggiungiSlide',slideId:secondoId,direzione:'sotto'});const dettaglio=foglio.stacks[1].slides[1].id;
 foglio=M.applica(foglio,{tipo:'riordinaSlide',slideId:secondoId,destinazione:fid});assert.equal(foglio.stacks[0].slides[0].id,secondoId);assert.equal(foglio.stacks[0].slides[1].id,dettaglio,'spostare l’argomento conserva gli approfondimenti');
 foglio=M.applica(foglio,{tipo:'riordinaSlide',slideId:dettaglio,destinazione:fid,dopo:true});assert.equal(foglio.stacks[2].slides[0].id,dettaglio);assert(validatePresentazione(foglio).ok);
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
  vista.chiudi();assert(!V.consentita(url,session));assert.equal((await handle(new Request(url))).status,404);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
 console.log('✓ Editor PRESENTA: scrittura durante autosave, undo/redo dopo salvataggio, flush delle transizioni, errore disco, bozza e riordino');
})().catch(e=>{console.error(e);process.exitCode=1;});
