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
