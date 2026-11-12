'use strict';
const A=require('node:assert/strict'),F=require('../App/assets/appunti/figure'),S=require('../lib/vault-sincrono'),P=require('../lib/sicurezza-app');
const lines=['![Schema|60%](album:abcdef)','<!-- zaino-figura {"align":"right","layer":"back"} -->'];
const v=F.leggi(lines,0);A.equal(v.percento,60);A.equal(v.style.layer,'back');A.equal(v.fine,1);A.deepEqual(F.leggi(F.scrivi(v).split('\n'),0),v);
A.throws(()=>F.aspetto({layer:'javascript:alert(1)'}));A.throws(()=>F.aspetto({top:'-9999px'}));A.equal(F.leggi(['![x](_disegni/../../segreto.png)'],0),null);
A(F.html(v,'<p>Figura</p>').includes('data-layer="back"'));A(S.consentito('disegni','srcUrl'));A(!S.scrive('disegni','leggi'));A(S.scrive('disegni','salva'));
const base={vault:'/vault',appDir:'/app',userData:'/cfg',temporanei:'/tmp'};
const p=P.privilegi('vault:sync',{gruppo:'disegni',metodo:'salva',args:['scienze','data']},base);A(p.scrittura.includes('/vault/Zaini/scienze/APPUNTI/_disegni'));A(!p.scrittura.includes('/vault/Zaini/scienze/APPUNTI'));
A.throws(()=>require('../lib/appunti-disegni').srcUrl('/tmp','x','../../segreto'),/non valido/);
console.log('✓ Figure: metadata, dimensioni, allineamento/livelli, roundtrip e privilegi limitati');
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1cAAAAASUVORK5CYII=';
(async()=>{const b=await require('../lib/appunti-docx').crea({titolo:'Livelli',albero:{tag:'root',figli:['front','back'].map(layer=>({tag:'p',figli:[{tag:'img',figli:[],dati:png,larghezza:100,altezza:50,visuale:{align:'right',layer}}]}))}});const z=require('fflate'),xml=z.strFromU8(z.unzipSync(b)['word/document.xml']);A.equal((xml.match(/<wp:anchor /g)||[]).length,2);A(xml.includes('behindDoc="1"'));A(xml.includes('behindDoc="0"'));A(xml.includes('right'));console.log('✓ DOCX: figure davanti e dietro al testo, allineate a destra');})().catch(e=>{console.error(e);process.exitCode=1;});
const f={...v,style:{align:'center',layer:'inline'},percento:40},misure={larghezza:800,em:20,alto:-5,basso:30};
const mosso=F.sposta(f,80,40,misure);A.equal(mosso.style.x,40);A.equal(mosso.style.y,2);A.equal(mosso.style.layer,'front');
A.deepEqual(F.sposta(f,40,20,{...misure,larghezza:400,em:10}),mosso,'posizione indipendente dallo zoom');
A.equal(F.sposta(mosso,-10000,-10000,misure).style.x,0);A.equal(F.sposta(mosso,-10000,-10000,misure).style.y,-5);
A.equal(F.sposta(mosso,10000,10000,misure).style.x,60);A.equal(F.sposta(mosso,10000,10000,misure).style.y,30);
A.deepEqual(F.leggi(F.scrivi(mosso).split('\n'),0).style,mosso.style);A(F.html(mosso,'x').includes('--fig-y:2em'));A.throws(()=>F.aspetto({x:Infinity}));
console.log('✓ Posizionamento libero: zoom, limiti del foglio, annidamento e Markdown');

A.equal(F.dimensiona(mosso,90).style.x,10,'ingrandire non porta la figura oltre il bordo destro');A.equal(F.dimensiona(mosso,90).style.y,2);

const tela={...v,percento:100,style:{align:'left',layer:'front',x:0,y:0}};
A.equal(F.sposta(tela,80,0,{...misure,sinistra:-30,destra:40}).style.x,10,'i margini trasparenti non bloccano il disegno');
const negativo=F.sposta(tela,-80,0,{...misure,sinistra:-30,destra:40});A.equal(negativo.style.x,-10);A.deepEqual(F.leggi(F.scrivi(negativo).split('\n'),0).style,negativo.style);

// Le coordinate fisiche A4 viaggiano col documento e non dipendono dal banco.
const a4={pagina:2,x:17,y:10,larghezza:85},suCarta={...tela,percento:50,style:{...tela.style,x:10,y:10*96/25.4/16,a4}};
A.deepEqual(F.leggi(F.scrivi(suCarta).split('\n'),0).style.a4,a4);
const cartaMossa=F.sposta(suCarta,64.2519685,16,{larghezza:642.519685,em:16,a4});
A.equal(cartaMossa.style.a4.x,34);A.equal(cartaMossa.style.a4.pagina,2);
A.deepEqual(cartaMossa,F.sposta(suCarta,32.12598425,8,{larghezza:321.2598425,em:8,a4}));
A.equal(F.dimensiona(suCarta,60).style.a4.larghezza,102);
for(const errato of [{...a4,pagina:0},{...a4,x:Infinity},{...a4,larghezza:-1},{...a4,css:'position:fixed'}])A.throws(()=>F.aspetto({a4:errato}));
console.log('✓ A4: coordinate in mm, salvataggio, dimensione e movimento invarianti allo zoom');

{
const g={scala:1,rapporto:1.5,ink:{l:.2,t:.1,r:.6,b:.3}},full={...tela,style:{...tela.style,a4:{pagina:1,x:0,y:0,larghezza:170}}};
for(const angolo of ['nw','ne','sw','se']){
 const sx=angolo.includes('e')?1:-1,sy=angolo.includes('s')?1:-1;
 const piccolo=F.ridimensionaA4(full,angolo,-sx*34*96/25.4,-sy*25.5*96/25.4,g);
 A.equal(piccolo.style.a4.larghezza,85,'scala a metà: '+angolo);
 const p=piccolo.style.a4,ax=sx>0?g.ink.l:g.ink.r,ay=sy>0?g.ink.t:g.ink.b;
 A(Math.abs(p.x+ax*p.larghezza-ax*170)<.001,'angolo opposto fermo x');A(Math.abs(p.y+ay*p.larghezza*g.rapporto-ay*170*g.rapporto)<.001,'angolo opposto fermo y');
 A.deepEqual(piccolo,F.ridimensionaA4(full,angolo,-sx*17*96/25.4,-sy*12.75*96/25.4,{...g,scala:.5}),'ridimensionamento indipendente dallo zoom');
}
const grande=F.ridimensionaA4(full,'se',10000,10000,g),p=grande.style.a4;
A(p.larghezza>170,'il disegno può ingrandirsi oltre il 100% della tela trasparente');
A(p.x+g.ink.r*p.larghezza<=170.001);A(p.y+g.ink.b*p.larghezza*g.rapporto<=252.001);
A.deepEqual(F.leggi(F.scrivi(grande).split('\n'),0).style.a4,p,'roundtrip delle nuove dimensioni fisiche');
A.equal(F.ridimensionaA4({...full,style:{...full.style,layer:'inline'}},'se',-20,-20,g).style.layer,'front');
A.throws(()=>F.ridimensionaA4(full,'no',1,1,g));A.throws(()=>F.ridimensionaA4(full,'se',1,1,{...g,scala:0}));
console.log('✓ A4: quattro angoli, proporzioni, limiti dei tratti, ancoraggio e zoom');
}
