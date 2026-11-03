'use strict';
const assert=require('node:assert/strict'),A=require('../App/assets/presentazioni/animazioni'),M=require('../App/assets/presentazioni/modello'),R=require('../App/assets/presentazioni/reveal-adapter'),V=require('../lib/validate');
const N=require('../App/assets/presentazioni/navigazione'),inizio={h:0,v:0,step:'0/0',pagina:'1/2'},figliaStato={h:0,v:1,step:'0/1',pagina:'1a/2'};
assert.deepEqual(N.passaggioComuni(null,inizio),{zoom:false,numero:false,verso:1});
assert.deepEqual(N.passaggioComuni(inizio,figliaStato),{zoom:true,numero:true,verso:1});
assert.deepEqual(N.passaggioComuni(figliaStato,inizio),{zoom:true,numero:true,verso:-1});
assert.deepEqual(N.passaggioComuni(inizio,inizio),{zoom:false,numero:false,verso:1});
assert.deepEqual(N.passaggioComuni(inizio,{...figliaStato,step:inizio.step}),{zoom:false,numero:true,verso:1},'approfondimento con navbar dei soli argomenti');
assert.deepEqual(N.passaggioComuni(inizio,figliaStato,true),{zoom:false,numero:false,verso:1});
assert.deepEqual(N.passaggioComuni({...inizio,step:null,pagina:null},figliaStato),{zoom:false,numero:false,verso:1},'gli oggetti prima nascosti riappaiono senza ingresso');
// Gli assi hanno destinazioni esplicite: nessuna memoria dell'ultimo approfondimento visitato.
const pile=[3,1,2],punto=(h,v)=>({h,v,fragmentIndex:-1});
for(const [h,v,azione,attesa] of [[0,0,'approfondisci',punto(0,1)],[0,2,'approfondisci',punto(1,0)],[1,0,'approfondisci',punto(2,0)],[2,1,'approfondisci',null],[2,1,'risali',punto(2,0)],[2,0,'risali',punto(1,0)],[1,0,'risali',punto(0,2)],[0,0,'risali',null],[0,2,'argomentoSuccessivo',punto(1,0)],[2,1,'argomentoPrecedente',punto(1,0)],[0,1,'argomentoPrecedente',null],[2,1,'argomentoSuccessivo',null]])assert.deepEqual(N.destinazione(punto(h,v),pile,azione),attesa,azione+' da '+h+'/'+v);
assert.equal(N.destinazione(punto(0,0),[1],'approfondisci'),null);assert.equal(N.destinazione(punto(0,0),[1],'risali'),null);
const comandiTasti=[],mappaTasti=N.tasti(o=>comandiTasti.push(o.azione));for(const codice of [39,37,40,38])mappaTasti[codice]();assert.deepEqual(comandiTasti,['argomentoSuccessivo','argomentoPrecedente','approfondisci','risali']);
let indice={h:0,v:2,f:0},passaggi=0;const deckFinto={getIndices:()=>indice,getHorizontalSlides:()=>pile.map(n=>({querySelectorAll:()=>({length:n===1?0:n})})),slide:(h,v,f)=>{indice={h,v,f};},next:()=>passaggi++,prev:()=>passaggi--};
assert.deepEqual(N.comando(deckFinto,{azione:'approfondisci'}),punto(1,0));assert.deepEqual(N.comando(deckFinto,{azione:'risali'}),punto(0,2));N.comando(deckFinto,{azione:'avanti'});assert.equal(passaggi,1,'Avanti conserva il percorso dei frammenti');N.comando(deckFinto,{azione:'indietro'});assert.equal(passaggi,0);
indice={h:2,v:1,f:0};N.comando(deckFinto,{azione:'approfondisci'});assert.deepEqual(indice,{h:2,v:1,f:0},'al limite non si azzerano le animazioni');
let n=0;const id=()=> 'elemento-'+(++n);
let d=M.crea('cbd14eca-2adb-4fc1-9762-f20fe6601a1c','Elementi',id),sid=d.stacks[0].slides[0].id;
const op=o=>d=M.applica(d,{slideId:sid,...o},id),s=()=>M.trova(d,sid).slide;
for(const type of ['navbar','page-number','drawing'])assert(A.disponibile('fade-in',type));
assert.equal(M.numeroPagina(1,0,12),'2/12');assert.equal(M.numeroPagina(1,1,12),'2a/12');assert.equal(M.numeroPagina(1,26,12),'2z/12');assert.equal(M.numeroPagina(1,27,12),'2aa/12');
op({tipo:'titoloSlide',title:'Partenza'});op({tipo:'inserisciComune',type:'navbar'});op({tipo:'inserisciComune',type:'page-number'});
op({tipo:'aggiungiSlide',direzione:'sotto'});op({tipo:'aggiungiSlide',direzione:'destra'});
assert(M.posizioni(d).every(p=>p.slide.blocks.filter(M.comune).length===2));
const figlia=d.stacks[0].slides[1].id,seconda=d.stacks[1].slides[0].id;
op({tipo:'titoloSlide',slideId:seconda,title:'Arrivo <script>alert(1)</script>'});
assert.deepEqual(M.passi(d,0,1).map(p=>[p.numero,p.attivo]),[['1',false],['1a',true],['2',false]]);
assert.equal(M.passi(d,0,1,'main').length,2);assert(M.passi(d,0,1,'main')[0].attivo);
const numero=s().blocks.find(b=>b.type==='page-number');op({tipo:'blocco',blockId:numero.id,block:{...numero,style:{...numero.style,color:'#ac1234',fontFamily:'georgia',box:{x:60,y:80,width:20,height:10},appearance:{opacity:.4,blend:'multiply',grayscale:100}}}});
assert(M.posizioni(d).every(p=>p.slide.blocks.find(b=>b.type==='page-number').style.box.x===60));
op({tipo:'visibilitaComune',slideId:figlia,blockId:M.trova(d,figlia).slide.blocks.find(b=>b.type==='page-number').id,hidden:true});
assert(!s().blocks.find(b=>b.type==='page-number').hidden);assert(M.trova(d,figlia).slide.blocks.find(b=>b.type==='page-number').hidden);
op({tipo:'aggiungiSlide',slideId:figlia,direzione:'sotto'});assert(!d.stacks[0].slides[2].blocks.find(b=>b.type==='page-number').hidden);
const html=R.compila(d).html;assert(html.includes('1b/2'));assert(html.includes('opacity:0.4;mix-blend-mode:multiply;filter:grayscale(100%)'));assert(html.includes('Arrivo &lt;script&gt;'));assert(!html.includes('<script>alert'));
assert.equal((html.match(/data-type="page-number" hidden/g)||[]).length,1);
assert(M.sistema(s()).find(b=>b.id===numero.id).box.x===60,'Sistematica non sposta gli oggetti comuni');
const nav=s().blocks.find(b=>b.type==='navbar');for(const variant of Object.keys(M.NAVBAR)){op({tipo:'blocco',blockId:nav.id,block:{...s().blocks.find(b=>b.id===nav.id),variant}});assert(R.compila(d).html.includes('data-variante="'+variant+'"'));}
op({tipo:'blocco',blockId:nav.id,block:{...s().blocks.find(b=>b.id===nav.id),orientation:'vertical',activeZoom:1.2}});
assert(M.posizioni(d).every(p=>{const b=p.slide.blocks.find(b=>b.type==='navbar');return b.orientation==='vertical'&&b.activeZoom===1.2;}),'orientamento e zoom comuni su tutte le slide');
assert(R.compila(d).html.includes('data-orientamento="vertical" data-zoom="1.2"'));assert(JSON.stringify(M.pubblica(d)).includes('"activeZoom":1.2'));
assert.throws(()=>op({tipo:'blocco',blockId:nav.id,block:{...s().blocks.find(b=>b.id===nav.id),activeZoom:2}}));
assert.throws(()=>op({tipo:'blocco',blockId:nav.id,block:{...s().blocks.find(b=>b.id===nav.id),orientation:'url(x)'}}));
op({tipo:'riordinaSlide',slideId:seconda,destinazione:sid,dopo:false});assert.equal(M.passi(d,0,0)[0].title,'Arrivo <script>alert(1)</script>');
assert(V.validatePresentazione(d).ok);assert.throws(()=>op({tipo:'duplicaBlocco',blockId:numero.id}));
const style=s().blocks.find(b=>b.type==='page-number').style;const boxes=s().blocks.map(b=>({id:b.id,box:b.id===numero.id?{...style.box,x:55}:b.style.box}));op({tipo:'posizionaBlocchi',boxes});assert(M.posizioni(d).every(p=>p.slide.blocks.find(b=>b.type==='page-number').style.box.x===55));
const v={viewBox:'0 0 100 100',scene:[{id:'segno',type:'rectangle',x:0,y:0,width:100,height:100,version:1,versionNonce:1,customData:{nota:'NOTA_EDITING_PRIVATA'}}],nodes:[{tag:'path',attrs:{d:'M0 0 L100 100',stroke:'#334155',fill:'none'},children:[]},{tag:'text',attrs:{x:'3',y:'12'},text:'A & B < C',children:[]}]};
assert(M.vettori.valida(v));assert.match(M.vettori.html(v),/A &amp; B &lt; C/);
for(const attrs of [{onclick:'alert(1)'},{fill:'url(https://example.com)'},{'clip-path':'url(file:///privato)'},{d:'M0 0<script>'}])assert(!M.vettori.valida({...v,nodes:[{tag:'path',attrs,children:[]}]}));
assert(!M.vettori.valida({...v,nodes:[{tag:'foreignObject',attrs:{},children:[]}]}));
op({tipo:'inserisciBlocco',block:{type:'drawing',slot:'body',drawing:v}});assert(R.compila(d).html.includes('class="presenta-vettore"'));assert(!JSON.stringify(M.pubblica(d)).includes('NOTA_EDITING_PRIVATA'));assert(V.validatePresentazione(d).ok);
assert(!M.aspettoConsentito({type:'audio'}));assert(!M.aspettoConsentito({type:'video'}));assert(!M.aspettoConsentito({type:'image',assetId:'gif'},{gif:{mimeType:'image/gif'}}));assert(M.aspettoConsentito({type:'drawing'}));
assert(!M.aspettoValido({opacity:1.1}));assert(!M.aspettoValido({blend:'url(x)'}));assert(!M.aspettoValido({blur:-1}));
const titolo=s().blocks.find(b=>b.type==='title'),male=M.copia(d);M.trova(male,sid).slide.blocks.find(b=>b.id===titolo.id).style.appearance={blend:'hacker'};assert(!V.validatePresentazione(male).ok);
op({tipo:'eliminaBlocco',blockId:numero.id});assert(M.posizioni(d).every(p=>!p.slide.blocks.some(b=>b.type==='page-number')));assert(M.posizioni(d).every(p=>p.slide.blocks.some(b=>b.type==='navbar')));
const storia=M.cronologia(d);storia.applica({tipo:'inserisciComune',slideId:sid,type:'page-number'},id);storia.annulla();assert(!M.trova(storia.documento,sid).slide.blocks.some(b=>b.type==='page-number'));storia.ripeti();assert(M.trova(storia.documento,sid).slide.blocks.some(b=>b.type==='page-number'));
console.log('✓ PRESENTA elementi: navbar dinamiche, numeri e approfondimenti, stile comune, nascondi, movimento, copia, cronologia, effetti, SVG sicuro ed export');

assert(!M.filtriConsentiti({type:'text'}));assert(!M.filtriConsentiti({type:'navbar'}));assert(M.filtriConsentiti({type:'image'}));
const grafica={activeTextColor:'#ff0000',activeGraphicColor:'#008800',markerSize:42,gap:12,line:{width:6,color:'#0000ff',opacity:.4},separator:{width:2,color:'#333333',opacity:.3},border:{width:3,color:'#cccccc',opacity:.7},background:{color:'#ffffff',opacity:.2},activeBackground:{color:'#111111',opacity:.6}};
assert(M.graficaNavbarValida(grafica));assert(!M.graficaNavbarValida({line:{width:99}}));assert(!M.graficaNavbarValida({activeTextColor:'red;display:none'}));assert(!M.graficaNavbarValida({border:{url:'x'}}));
const navAttuale=s().blocks.find(b=>b.type==='navbar');op({tipo:'blocco',blockId:navAttuale.id,block:{...navAttuale,style:{...navAttuale.style,navbar:grafica}}});
assert(M.posizioni(d).every(p=>JSON.stringify(p.slide.blocks.find(b=>b.type==='navbar').style.navbar)===JSON.stringify(grafica)));assert(V.validatePresentazione(d).ok);assert(R.compila(d).html.includes('--nav-active-text:#ff0000'));assert(R.compila(d).html.includes('--nav-line-opacity:0.4'));
const scorretto=M.copia(d);M.trova(scorretto,sid).slide.blocks.find(b=>b.type==='navbar').style.navbar.line.opacity=2;assert(!V.validatePresentazione(scorretto).ok);
const contenuto={id:'contenuto',type:'text',slot:'body',markdown:'Contenuto',style:{box:{x:7,y:7,width:40,height:40}}};
for(const [orientation,box,attesa] of [['vertical',{x:2,y:10,width:18,height:80},{x:22,y:7,width:71,height:86}],['vertical',{x:80,y:10,width:18,height:80},{x:7,y:7,width:71,height:86}],['horizontal',{x:7,y:2,width:86,height:10},{x:7,y:14,width:86,height:79}],['horizontal',{x:7,y:88,width:86,height:10},{x:7,y:7,width:86,height:79}]]){
 const navbar={id:'nav',...M.modelloComune('navbar'),orientation,style:{box}},slide={...M.slide(id),blocks:[contenuto,navbar]},a=M.areaUtile(slide);assert.deepEqual(a,attesa);
 for(const azione of [M.sistema(slide),M.disponi(slide,'text-left'),M.disponi(slide,'image-top')]){assert.deepEqual(azione.find(v=>v.id==='nav').box,box);for(const v of azione.filter(v=>v.id!=='nav')){assert.deepEqual(M.limitaArea(v.box,a),v.box);assert(M.riquadro(v.box));}}
 const corner=M.ancoraGriglia(contenuto.style.box,{divisioni:3,riga:2,colonna:2},a);assert(Math.abs(corner.x+corner.width-a.x-a.width)<.001);assert(Math.abs(corner.y+corner.height-a.y-a.height)<.001);
 assert.equal(M.righelli(3,a).x[0],a.x);assert.equal(M.righelli(3,a).y.at(-1),a.y+a.height);
 assert.deepEqual(M.areaUtile({...slide,blocks:[contenuto,{...navbar,hidden:true}]}),{x:7,y:7,width:86,height:86});
}
let prova=M.crea('cbd14eca-2adb-4fc1-9762-f20fe6601a1c','Margini',id),psid=prova.stacks[0].slides[0].id;
const opera=o=>prova=M.applica(prova,{slideId:psid,...o},id),slideProva=()=>prova.stacks[0].slides[0];opera({tipo:'inserisciBlocco',block:contenuto});opera({tipo:'inserisciComune',type:'navbar'});opera({tipo:'inserisciComune',type:'page-number'});opera({tipo:'aggiungiSlide',modello:'colonne',direzione:'destra'});
let barra=slideProva().blocks.find(b=>b.type==='navbar');opera({tipo:'blocco',blockId:barra.id,block:{...barra,orientation:'vertical',style:{...barra.style,box:{x:2,y:10,width:18,height:80}}}});
for(const p of M.posizioni(prova)){const a=M.areaUtile(p.slide);assert(p.slide.blocks.filter(b=>!M.comune(b)).every(b=>JSON.stringify(M.limitaArea(b.style.box,a))===JSON.stringify(b.style.box)));}
const comuni=slideProva().blocks.filter(M.comune).map(b=>M.copia(b));opera({tipo:'posizionaBlocchi',boxes:M.sistema(slideProva())});assert.deepEqual(slideProva().blocks.filter(M.comune),comuni);
opera({tipo:'incollaStile',stile:{layout:'free',blocks:[{type:'navbar',style:{box:{x:70,y:7,width:10,height:20}}},{type:'page-number',style:{fontSize:90}}]}});assert.deepEqual(slideProva().blocks.filter(M.comune),comuni);
const bid=slideProva().blocks.find(b=>!M.comune(b)).id;opera({tipo:'posizionaBlocchi',boxes:slideProva().blocks.map(b=>({id:b.id,box:b.id===bid?{x:0,y:0,width:90,height:90}:b.style.box}))});assert.deepEqual(slideProva().blocks.find(b=>b.id===bid).style.box,M.areaUtile(slideProva()));
assert.throws(()=>M.allinea(slideProva(),[bid,barra.id],'left'),/navbar/);
console.log('✓ Grafica navbar validata, filtri pertinenti, area utile sui quattro lati, guide, ancoraggi, contenuti protetti e comuni invariati');

const areaGruppo={x:25,y:7,width:68,height:80},primo={x:25,y:10,width:20,height:15},ultimo={x:65,y:45,width:20,height:20};assert.deepEqual(M.limitaDelta([primo,ultimo],-90,90,areaGruppo),[0,22]);assert.deepEqual(M.limitaDelta([primo,ultimo],90,-90,areaGruppo),[8,-3]);

opera({tipo:'incollaStile',stile:{layout:'title-text',blocks:[]}});assert.equal(slideProva().layout,'free','i layout storici si adattano alla fascia riservata');assert.deepEqual(slideProva().blocks.filter(M.comune),comuni);for(const b of slideProva().blocks.filter(b=>!M.comune(b)))assert.deepEqual(M.limitaArea(b.style.box,M.areaUtile(slideProva())),b.style.box);
