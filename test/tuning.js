'use strict';
const assert=require('node:assert/strict'),R=require('../App/assets/interfaccia/stili-raccolta'),V=require('../lib/stili-community');
const p={formato:'zaino-stile',versione:1,tipo:'slide',nome:'Dal portale',autore:'Community',stile:{font:'atkinson',sfondo:'#fffbed',colore:'#20242b',accento:'#0f766e',titolo:54,testo:32}};
const vecchio={'zaino.stili.community.v1.slide':JSON.stringify([p]),'studia.presenta.stili':JSON.stringify([{...p.stile,nome:'Personale'}])};
const s=R.iniziale(k=>vecchio[k]),prima=JSON.stringify(s);assert.equal(s.stili.length,18);
for(const tipo of ['mappa','slide','navbar'])assert.equal(s.stili.filter(r=>r.pacchetto.tipo===tipo&&r.id.includes('-squig-')).length,1,'un solo preset Squig per '+tipo);
assert.deepEqual(s.stili.filter(r=>r.id.includes('-drawably')).map(r=>r.pacchetto.tipo).sort(),['mappa','slide']);
{
 const storico=require('./fixtures/tuning-squig-v1.json'),copiato=JSON.parse(JSON.stringify(storico));
 const conservato=copiato.stili.find(r=>r.id==='slide-squig-plum');conservato.pacchetto.nome='Le mie slide';conservato.pacchetto.stile.testo=38;conservato.nascosto=true;
 const mappa=copiato.stili.find(r=>r.id==='mappa-squig-graphite');mappa.pacchetto.stile.raggio=18;mappa.pacchetto.stile.testo='#554433';
 copiato.stili.find(r=>r.id==='navbar-squig-internet-blue').nascosto=true;
 copiato.stili.push({id:'importato-personale',nascosto:false,pacchetto:{...p,nome:'Copia mia',stile:{...p.stile}}});
 const migrata=R.leggi(JSON.stringify(copiato));
 assert.equal(migrata.stili.filter(r=>r.id.includes('-squig-')&&R.preinstallato(r)).length,3);
 assert.equal(migrata.stili.filter(r=>r.id.includes('-squig-')&&!R.preinstallato(r)).length,2,'le sole varianti modificate diventano personali');
 const slide=migrata.stili.find(r=>r.pacchetto.nome==='Le mie slide');assert(slide&&!R.preinstallato(slide));assert.equal(slide.pacchetto.stile.testo,38);assert(slide.nascosto);
 const privata=migrata.stili.find(r=>!R.preinstallato(r)&&r.pacchetto.tipo==='mappa');assert.equal(privata.pacchetto.stile.raggio,18);assert.equal(privata.pacchetto.stile.testo,'#554433');
 assert(migrata.stili.find(r=>r.id==='navbar-squig-internet-blue').nascosto,'nascondere la variante conservata resta rispettato');
 assert(migrata.stili.find(r=>r.id==='importato-personale'),'copie e importazioni dell’utente restano');
 assert.equal(migrata.stili.find(r=>r.id==='mappa-squig-graphite').pacchetto.stile.bordo,'#9ca3af');
 assert.deepEqual(R.leggi(JSON.stringify(migrata)),migrata,'la migrazione non reintroduce le varianti ritirate');
 assert.equal(storico.stili.length,18,'la prova usa la raccolta reale precedente non mutata');
 const mappaSquig=migrata.stili.find(r=>r.id==='mappa-squig-graphite').pacchetto.stile;
 assert.equal(mappaSquig.testo,'#2D2A26');assert.equal(mappaSquig.legame,'#2D2A26');assert.equal(mappaSquig.bordiColorati,1);
}
for(const r of s.stili)V.leggi(JSON.stringify(r.pacchetto),r.pacchetto.tipo);
assert.equal(s.stili.find(r=>r.id==='slot-0').pacchetto.nome,'Personale');
let n=R.cambia(s,{tipo:'visibilita',id:'slide-essenziale',nascosto:true});assert(n.stili.find(r=>r.id==='slide-essenziale').nascosto);
n=R.cambia(n,{tipo:'salva',id:'slide-essenziale',pacchetto:p});assert(n.stili.find(r=>r.id==='slide-essenziale').nascosto,'personalizzare non rende visibile uno stile nascosto');
n=R.cambia(n,{tipo:'visibilita',id:'slide-essenziale',nascosto:false});assert(!n.stili.find(r=>r.id==='slide-essenziale').nascosto);
assert.throws(()=>R.cambia(n,{tipo:'elimina',id:'slide-essenziale'}),/preinstallati/);
n=R.cambia(n,{tipo:'elimina',id:'importato-slide-0'});assert(!R.leggi(JSON.stringify(n)).stili.some(r=>r.id==='importato-slide-0'),'la cancellazione degli importati resta alla riapertura');
const vecchia={versione:1,stili:s.stili.filter(r=>r.id!=='slide-lavagna')},recuperata=R.leggi(JSON.stringify(vecchia));assert(recuperata.stili.find(r=>r.id==='slide-lavagna').nascosto,'un preset cancellato nella vecchia raccolta torna nascosto');
assert.equal(JSON.stringify(s),prima,'il nuovo stato non muta quello letto');
assert.throws(()=>R.cambia(s,{tipo:'salva',id:'mappa-originale',pacchetto:p}));
assert.throws(()=>R.iniziale(()=>'{'));
assert.throws(()=>R.leggi('{"versione":2,"stili":[]}'));
assert.throws(()=>R.leggi(JSON.stringify({...s,stili:[s.stili[0],s.stili[0]]})));
console.log('✓ TUNING: migrazione dei precedenti stili, modifica, visibilità, cancellazione persistente e dati corrotti.');

const D=require('../App/assets/interfaccia/tuning-demo'),M=require('../App/assets/presentazioni/modello'),S=require('../App/assets/interfaccia/stili');
const g=D.mappa();assert.equal(g.nodi.length,7);assert.equal(g.nodi.filter(n=>n.immagine).length,2);assert.equal(g.archi.filter(a=>a.rel).length,3);assert.equal(g.archi.filter(a=>!a.rel).length,3);
for(const r of s.stili.filter(r=>r.pacchetto.tipo!=='mappa')){const d=D.presentazione(r.pacchetto);assert.equal(d.stacks.length,3);assert(d.stacks.every(s=>s.slides.length===3));V.demo(d);V.leggi(JSON.stringify(D.estrai(r.pacchetto,d,d.stacks[0].slides[0])),r.pacchetto.tipo);}
let d=D.presentazione(p);d.stacks[0].slides[0].blocks[0].style.italic=true;const completo=D.estrai(p,d,d.stacks[0].slides[0]);V.leggi(JSON.stringify(completo),'slide');const altro=D.presentazione(completo);assert(altro.stacks[2].slides[2].blocks[0].style.italic,'il formato conserva le modifiche grafiche del vero editor');
let vuota=M.crea(crypto.randomUUID());const sid=vuota.stacks[0].slides[0].id;vuota=M.applica(vuota,{tipo:'stilePresentazione',slideId:sid,community:true,tema:{...completo.stile,nome:completo.nome}});vuota=M.applica(vuota,{tipo:'titoloSlide',slideId:sid,title:'Titolo nuovo'});assert(vuota.stacks[0].slides[0].blocks[0].style.italic,'anche un titolo aggiunto dopo eredita lo stile importato');assert(require('../lib/validate').validatePresentazione(vuota).ok);
assert.throws(()=>V.demo({...d,assets:{externa:{}}}));
console.log('✓ Demo reali: 3×3 slide, 7 nodi, 2 immagini, 3 legami etichettati; aspetti incorporati e anteprima senza risorse esterne.');
// Trasferire lo zaino deve bastare: nessuna raccolta del profilo sul computer ricevente.
(async()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),P=require('../lib/presentazioni'),Mappe=require('../lib/mappe');
 const radice=fs.mkdtempSync(path.join(os.tmpdir(),'zaino-stili-trasporto-')),v=path.join(radice,'autore'),ricevente=path.join(radice,'ricevente');
 try{
  require('../lib/zaini').crea(v,'Scienze');const originale=await P.crea(v,'scienze','Stili da portare');
  let doc=D.presentazione(completo);doc={...doc,id:originale.id,zainoId:originale.zainoId,revision:originale.revision};
  const nav=s.stili.find(r=>r.id==='navbar-steps').pacchetto;nav.stile.grafica.markerSize=48;for(const pos of M.posizioni(doc))pos.slide.blocks=pos.slide.blocks.map(b=>b.type==='navbar'?S.bloccoNavbar(b,nav.stile):b);
  await P.salva(v,'scienze',doc,originale.revision);
  const mappa=Mappe.salva(v,'scienze',null,{titolo:'Demo trasferita',nodi:[{id:'a',testo:'Foresta'}],archi:[],vista:S.vista({}, {font:'testme',raggio:18,carta:'#dcefe7'})});assert(!mappa.error,mappa.error);
  fs.cpSync(path.join(v,'Zaini'),path.join(ricevente,'Zaini'),{recursive:true});
  const riaperto=P.leggi(ricevente,'scienze',doc.id),slide=riaperto.stacks[0].slides[0];assert(slide.blocks.find(b=>b.type==='title').style.italic);assert.equal(slide.blocks.find(b=>b.type==='navbar').style.navbar.markerSize,48);
  const json=JSON.parse(fs.readFileSync(path.join(ricevente,'Zaini/scienze/MAPPE',mappa.file),'utf8'));assert.equal(json.vista.aspetto.raggio,18);assert.equal(json.vista.aspetto.carta,'#dcefe7');
  console.log('✓ Zaino trasferito: mappa, slide e navbar conservano gli stili nei file, senza la raccolta del profilo autore.');
 }finally{fs.rmSync(radice,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
// L’unica nuova sottopagina locale ammessa è l’ambiente demo interno, senza parametri.
{
 const handlers={},path=require('node:path'),url=require('node:url'),file=path.resolve('App/StudIA.html'),wc={session:{},on:(k,fn)=>handlers[k]=fn,setWindowOpenHandler:()=>{}};
 require('../lib/sicurezza-finestre').proteggiFinestra({webContents:wc},{file,shell:{}});
 for(const [href,atteso]of [[url.pathToFileURL(path.resolve('App/assets/interfaccia/tuning-ambiente.html')).href,false],[url.pathToFileURL(path.resolve('App/StudIA.html')).href,true],['https://esempio.it/',true],[url.pathToFileURL(path.resolve('App/assets/interfaccia/tuning-ambiente.html')).href+'?file=privato',true]]){let bloccato=false;handlers['will-frame-navigate']({url:href,isMainFrame:false,preventDefault:()=>bloccato=true});assert.equal(bloccato,atteso);}
}
