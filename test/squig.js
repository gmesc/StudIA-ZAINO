'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const S=require('../App/assets/squig/catalogo'),Q=require('../App/assets/squig/tratti'),V=require('../App/assets/presentazioni/vettori'),M=require('../App/assets/presentazioni/modello'),R=require('../App/assets/interfaccia/stili-raccolta'),C=require('../lib/stili-community'),D=require('../App/assets/mappa/disegna'),L=require('../App/assets/mappa/layouts'),P=require('../lib/presentazioni'),X=require('../lib/presentazioni-export'),valida=require('../lib/validate').validatePresentazione;
(async()=>{
 await S.prepara();A.equal(S.catalogo.length,155);
 for(const d of S.catalogo)for(const fattore of [.5,1,1.5]){
  const s=S.nuova(d.kind);s.larghezza=Math.max(16,Math.min(2000,s.larghezza*fattore));s.altezza=Math.max(16,Math.min(2000,s.altezza*fattore));
  const svg=S.disegno(s);A(V.valida(svg),d.kind);A(svg.nodes.length,d.kind);A.deepEqual(svg,S.disegno(s),'tratti stabili tra riaperture: '+d.kind);
 }
 const s=S.nuova();s.proprieta.label='<script>alert("x")</script>';const h=V.html(S.disegno(s));A(!h.includes('<script>'));A(h.includes('&lt;'));
 for(const patch of [{componente:'__proto__'},{tema:'__proto__'},{larghezza:Infinity},{altezza:0},{seme:-1},{proprieta:{label:'a'.repeat(10001)}},{proprieta:{onclick:'alert(1)'}},{proprieta:{variant:'html'}},{proprieta:{icon:'left',glyph:'non-esiste'}}])A.throws(()=>S.disegno({...s,...patch}));
 const dannoso=S.disegno(S.nuova());dannoso.nodes.push({tag:'script',attrs:{},children:[]});A(!V.valida(dannoso));
 const raccolta=R.iniziale(()=>null),nuovi=raccolta.stili.filter(r=>r.id.includes('-squig-'));A.equal(nuovi.length,3);
 for(const r of nuovi){C.leggi(JSON.stringify(r.pacchetto),r.pacchetto.tipo);A(R.preinstallato(r));}
 const vecchia={versione:1,presetProtetti:true,stili:raccolta.stili.filter(r=>!r.id.includes('-squig-'))};A.equal(R.leggi(JSON.stringify(vecchia)).stili.length,raccolta.stili.length);A(R.leggi(JSON.stringify({...vecchia,presetProtetti:false})).stili.filter(r=>r.id.includes('-squig-')).every(r=>!r.nascosto),'nuovi preset visibili anche migrando la prima raccolta');
 const nascosta=R.cambia(raccolta,{tipo:'visibilita',id:nuovi[0].id,nascosto:true});A(R.leggi(JSON.stringify(nascosta)).stili.find(r=>r.id===nuovi[0].id).nascosto);
 const mappa=nuovi.find(r=>r.pacchetto.tipo==='mappa').pacchetto.stile,grafo={nodi:[{id:'uno',testo:'Squig',origine:'utente'}],archi:[]};
 const markup=D.svg(L.run(grafo,{}),{aspetto:mappa}).markup;A(markup.includes('mcontorno-squig'));A(markup.includes('mriempimento-squig'));A(markup.includes('Patrick Hand'));A(markup.includes('stroke-dasharray="4 3"'),'origine utente conservata');A(!D.svg(L.run(grafo,{}),{aspetto:{...mappa,tratto:'regolare'}}).markup.includes('mcontorno-squig'));
 A.equal(Q.contorno(150,70,{seme:12}),Q.contorno(150,70,{seme:12}));A.notEqual(Q.contorno(150,70,{seme:12}),Q.contorno(150,70,{seme:13}));
 const cartella=fs.mkdtempSync(path.join(os.tmpdir(),'zaino-squig-'));
 try{
  require('../lib/zaini').crea(cartella,'Scienze');let d=await P.crea(cartella,'scienze','Squig offline'),sid=d.stacks[0].slides[0].id;
  const drawing=S.disegno({...S.nuova('button'),proprieta:{label:'Procedi',variant:'outline'}});
  d=M.applica(d,{tipo:'inserisciBlocco',slideId:sid,block:{type:'drawing',slot:'body',drawing,style:{box:{x:20,y:30,width:40,height:20}}}});
  d=M.applica(d,{tipo:'inserisciComune',slideId:sid,type:'navbar'});
  let nav=d.stacks[0].slides[0].blocks.find(b=>b.type==='navbar');d=M.applica(d,{tipo:'blocco',slideId:sid,blockId:nav.id,block:require('../App/assets/interfaccia/stili').bloccoNavbar(nav,nuovi.find(r=>r.pacchetto.tipo==='navbar').pacchetto.stile)});
  A(valida(d).ok,JSON.stringify(valida(d).errors));d=await P.salva(cartella,'scienze',d,d.revision);const letto=P.leggi(cartella,'scienze',d.id);A.deepEqual(letto.stacks[0].slides[0].blocks.find(b=>b.type==='drawing').drawing,drawing);
  const out=await X.esporta(cartella,'scienze',d.id,cartella,d.revision),html=fs.readFileSync(path.join(out.cartella,'index.html'),'utf8');A(html.includes('Procedi'));A(html.includes('presenta-squig-cornice'));A(html.includes('Patrick Hand'));A(!html.includes('catalogo.js'),'l’export usa i vettori salvati senza caricare il catalogo');
  for(const f of ['fonts/PatrickHand-Regular.ttf','fonts/OFL-PatrickHand.txt','licenze/squig.txt','licenze/phosphor-icons.txt','licenze/roughjs.txt'])A(fs.statSync(path.join(out.cartella,f)).size>500,f);
 }finally{fs.rmSync(cartella,{recursive:true,force:true});}
 console.log('✓ Squig: 155 componenti × 3 misure, SVG sicuri e stabili, 3 stili coordinati, migrazione, mappe, salvataggio, font e licenze nell’export offline.');
})().catch(e=>{console.error(e);process.exitCode=1;});
