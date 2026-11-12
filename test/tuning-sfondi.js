'use strict';
const assert=require('node:assert/strict'),R=require('../App/assets/interfaccia/stili-raccolta');
const stato=R.iniziale(()=>null),prima=JSON.stringify(stato);
const nuova=R.nuovo('navbar',stato.stili);
assert.equal(nuova.nome,'Navbar personale');assert.equal(nuova.tipo,'navbar');
assert.equal(R.nuovo('navbar',[{pacchetto:nuova}]).nome,'Navbar personale 2');
nuova.stile.grafica.markerSize=66;assert.equal(JSON.stringify(stato),prima);
assert.equal(R.nuovo('navbar',[]).stile.grafica.markerSize,32);
assert.throws(()=>R.nuovo('altro',[]));
const F=require('../App/assets/interfaccia/sfondi'),M=require('../App/assets/presentazioni/modello'),A=require('../App/assets/mappa/aspetto'),S=require('../App/assets/interfaccia/stili'),V=require('../lib/stili-community');
const png='data:image/png;base64,'+require('./fixtures/presentazioni').png.toString('base64');
const fondo={nome:'Carta di prova',dati:png,larghezza:1,altezza:1,modo:'immagine',adatta:'cover',passo:128};
F.esigi(fondo);for(const dati of ['https://example.org/a.png','data:image/svg+xml;base64,PHN2Zz4=','data:image/png;base64,PHNjcmlwdD4='])assert.throws(()=>F.esigi({...fondo,dati}));
assert.throws(()=>F.esigi({...fondo,modo:'fisso'}));assert.throws(()=>F.esigi({...fondo,passo:0}));assert.throws(()=>F.esigi({...fondo,html:'<script>'}));
assert.deepEqual(F.dimensioni(4000,2000),{larghezza:2560,altezza:1280});assert.equal(F.formato(1280,720),'1280 × 720 px · 16:9');
const m=R.nuovo('mappa',[]);m.stile.sfondo='personale';m.stile.sfondoPersonale=fondo;V.leggi(JSON.stringify(m),'mappa');
const vista=S.vista({},m.stile);assert.deepEqual(S.mappa(vista).sfondoPersonale,fondo);
assert.equal(A.segueMappa(vista.aspetto),false);assert(A.cartaCSS(vista.aspetto,{bg:'#fff'}).backgroundImage.includes(png));
vista.aspetto.sfondoPersonale={...fondo,modo:'pattern'};assert(A.segueMappa(vista.aspetto));assert(A.sfondo(vista.aspetto,[0,0,800,500],{bg:'#ffffff'}).includes('patternUnits="userSpaceOnUse"'));
const p=R.nuovo('slide',[]);p.stile.sfondoPersonale=fondo;V.leggi(JSON.stringify(p),'slide');
const D=require('../App/assets/interfaccia/tuning-demo'),d=D.presentazione(p),s=d.stacks[0].slides[0];
assert.deepEqual(M.sfondoSlide(d,s).backgroundCustom,fondo);assert.deepEqual(D.estrai(p,d,s).stile.sfondoPersonale,fondo);
assert(V.demo(d).html.includes(png));assert(require('../lib/validate').validatePresentazione(d).ok);
const pulito=M.applica(d,{tipo:'sfondoColore',slideId:s.id,background:'#334455'});assert.equal(M.sfondoSlide(pulito,pulito.stacks[0].slides[0]).backgroundCustom,undefined);
console.log('✓ Nuovi stili indipendenti; sfondi incorporati, formato proporzionato, pattern e immagini ferme, resa e trasporto.');
// Copia/incolla e modelli mantengono lo sfondo, compreso quello comune.
const stile=M.stileSlide(s,d);assert.deepEqual(stile.backgroundCustom,fondo);
const nuovaSlide=M.daModello('testo',stile);assert.deepEqual(nuovaSlide.backgroundCustom,fondo);
const autonomo=M.applica(pulito,{tipo:'sfondoAutonomo',slideId:s.id,autonomo:true});
const incollato=M.applica(autonomo,{tipo:'incollaStile',slideId:s.id,stile});assert.deepEqual(M.sfondoSlide(incollato,incollato.stacks[0].slides[0]).backgroundCustom,fondo);
const senza=M.applica(incollato,{tipo:'incollaStile',slideId:s.id,stile:M.stileSlide(pulito.stacks[0].slides[0],pulito)});assert(!M.sfondoSlide(senza,senza.stacks[0].slides[0]).backgroundCustom);
assert.equal(JSON.stringify(d).split(png).length-1,1,'lo sfondo comune è memorizzato una volta');
const html=require('../lib/presentazioni-export').html(d).html;assert(html.includes(png));assert(html.includes("img-src 'self' data:"));
assert.equal(html.split(png).length-1,1,'anche nell’HTML esportato lo sfondo comune compare una volta');
// Archivio locale: persistenza atomica, confini del disco, file illeggibile conservato.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),Archivio=require('../lib/stili-archivio'),Disco=require('../lib/permessi-disco'),Sicurezza=require('../lib/sicurezza-app');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zaino-tuning-')),profilo=path.join(dir,'dati'),archivio=path.join(profilo,'tuning'),ctx={appDir:path.resolve(__dirname,'..'),userData:profilo,temporanei:dir};
const con=(c,f)=>Disco.esegui(Sicurezza.privilegi(c,{},ctx),f),raw=JSON.stringify(R.cambia(stato,{tipo:'salva',id:'personale',pacchetto:p}));
try{
 fs.mkdirSync(profilo);
 assert.equal(con('stili:raccolta-leggi',()=>Archivio.leggi(archivio)),null);
 assert(con('stili:raccolta-salva',()=>Archivio.salva(archivio,raw)).ok);assert.equal(con('stili:raccolta-leggi',()=>Archivio.leggi(archivio)),raw);
 assert.throws(()=>con('stili:raccolta-leggi',()=>Archivio.salva(archivio,prima)),/negato/);
 assert.throws(()=>con('stili:raccolta-salva',()=>Archivio.salva(path.join(dir,'altro'),raw)),/negato/);
 assert.throws(()=>Archivio.salva(archivio,'{rotto'));assert.equal(Archivio.leggi(archivio),raw);
 fs.writeFileSync(path.join(archivio,'raccolta.json'),'{rotto');assert.throws(()=>Archivio.leggi(archivio),/non è leggibile/);assert.equal(fs.readFileSync(path.join(archivio,'raccolta.json'),'utf8'),'{rotto');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
// Migrazione browser: conserva il vecchio catalogo, non torna ai preset se il disco dà errore.
const vm=require('node:vm');let salvato=null,scritture=0,errore=false;
const browser={ZainoSquigTratti:require('../App/assets/squig/tratti'),ZainoStili:S,MappaAspetto:A,PresentaModello:M,localStorage:{getItem:k=>k===R.CHIAVE?prima:null},vault:{stili:{raccoltaLeggi:()=>({testo:salvato}),raccoltaSalva:raw=>{if(errore)return{error:'Disco pieno'};salvato=raw;scritture++;return{ok:true};}}},Event:class{},dispatchEvent(){}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../App/assets/interfaccia/stili-raccolta.js'),'utf8'),browser);
assert.equal(JSON.stringify(browser.ZainoRaccolta.leggi()),prima);assert.equal(scritture,1);browser.ZainoRaccolta.leggi();assert.equal(scritture,1);errore=true;assert.throws(()=>browser.ZainoRaccolta.cambia({tipo:'salva',id:'sfondo',pacchetto:p}),/Disco pieno/);assert.equal(salvato,prima);salvato='{rotto';assert.throws(()=>browser.ZainoRaccolta.leggi(),/non è leggibile/);assert.equal(scritture,1);
console.log('✓ Sfondi comuni senza duplicazione, copia/incolla, export HTML, archivio con permessi e migrazione senza perdita.');
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zaino-sfondo-portabile-')),v=path.join(root,'vault'),copia=path.join(root,'trasferito'),X=require('../lib/presentazioni-export'),P=require('../lib/presentazioni');
 try{
  require('../lib/zaini').crea(v,'Sfondi');let doc=await P.crea(v,'sfondi','Sfondo incorporato'),sid=doc.stacks[0].slides[0].id;
  doc=M.applica(doc,{tipo:'stilePresentazione',slideId:sid,tema:{...p.stile,nome:p.nome},community:true,tutte:true});doc=await P.salva(v,'sfondi',doc,doc.revision);
  fs.cpSync(v,copia,{recursive:true});fs.rmSync(v,{recursive:true});const spostato=P.leggi(copia,'sfondi',doc.id);assert.deepEqual(M.sfondoSlide(spostato,spostato.stacks[0].slides[0]).backgroundCustom,fondo);
  const out=await X.esporta(copia,'sfondi',doc.id,root,doc.revision);assert(fs.readFileSync(path.join(out.cartella,'index.html'),'utf8').includes(png));assert(fs.existsSync(path.join(out.cartella,'runtime/reveal.js')));
  console.log('✓ Sfondo visibile nei dati dopo trasferimento dello zaino e incorporato nell’export HTML offline reale.');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
