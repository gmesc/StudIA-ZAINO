'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),Mappe=require('../lib/mappe'),Stile=require('../App/assets/mappa/aspetto'),Svg=require('../App/assets/appunti/svg'),Figure=require('../App/assets/appunti/figure'),Disegna=require('../App/assets/mappa/disegna'),Layouts=require('../App/assets/mappa/layouts');
const originale={nodi:[{id:'a',testo:'Radice',origine:'utente'},{id:'b',testo:'Foglia',origine:'utente'}],archi:[{da:'a',a:'b'}],vista:{zoom:{k:1.7,x:2,y:3},chiusi:['b'],gapNodo:32}};
const v=Stile.applica(originale.vista,'leggibile');A.equal(v.font,undefined);A.equal(v.aspetto.font,'atkinson');A.equal(v.fsNodo,16);A.deepEqual(v.zoom,originale.vista.zoom);A.deepEqual(v.chiusi,['b']);A.equal(originale.vista.aspetto,undefined);
const cartella=fs.mkdtempSync(path.join(os.tmpdir(),'zaino-aspetto-'));
try{require('../lib/zaini').crea(cartella,'Biologia');const r=Mappe.salva(cartella,'biologia',null,{...originale,titolo:'Stili',vista:v});const riaperta=Mappe.apri(cartella,'biologia',r.file);A.deepEqual(riaperta.mappa.vista.aspetto,v.aspetto);}finally{fs.rmSync(cartella,{recursive:true,force:true});}
const res=Layouts.run(originale,{}),mk=Disegna.svg(res,{aspetto:v.aspetto,fsNodo:v.fsNodo}).markup;A(mk.includes('Atkinson Hyperlegible'));A(mk.includes('rx="8"'));A(mk.includes('fill="#fffbed"'));A(mk.includes('stroke="#475569"'));A(mk.includes('<pattern'));
for(const tipo of ['pieno','linee','punti']){const s=Disegna.svg(res,{aspetto:{...v.aspetto,sfondo:tipo}}).markup;A.equal(s.includes('<pattern'),tipo!=='pieno');}
A.equal(Stile.normalizza({font:'url(x)',carta:'red" onclick="x',spessore:999}).carta,'');A.equal(Stile.normalizza({spessore:999}).spessore,4);
// Carta persistente e barra arrotondata: le regressioni segnalate sulle mappe.
for(const tipo of ['cotone','naturale','chiara']){
 const a=Stile.normalizza({...v.aspetto,sfondo:'carta-'+tipo});A.equal(a.sfondo,'carta-'+tipo);
 const css=Stile.cartaCSS(a,{});A(css.backgroundImage.includes('/carte/'+tipo+'.png'));A.equal(css.backgroundSize,'cover');A.equal(css.backgroundRepeat,'no-repeat');
 const svg=Disegna.svg(res,{aspetto:a}).markup;A(svg.includes('href="assets/presentazioni/carte/'+tipo+'.png"'));A(!svg.includes('<pattern'));
}
A.equal(Stile.normalizza({sfondo:'carta-../../x'}).sfondo,'punti');
for(const orient of ['td','lr']){
 const svg=Disegna.svg(Layouts.run(originale,{orient}),{aspetto:v.aspetto}).markup;
 A(/<path class="mbarra"[^>]+d="[^"]*A/.test(svg),'La barra segue gli angoli anche in orientamento '+orient);
}
const senza=Stile.normalizza({...v.aspetto,nodo:'none',bordo:'none',legame:''});
A.equal(senza.nodo,'none');A.equal(senza.bordo,'none');A.notEqual(Stile.normalizza({testo:'none'}).testo,'none');
const libero=Disegna.svg(res,{aspetto:senza,sfondo:false}).markup,nodoLibero=libero.match(/<g class="mnodo"[^]*?<\/g>/)[0];
A(/fill="none"[^>]*stroke="none"/.test(nodoLibero));A(nodoLibero.includes('pointer-events="all"'));
A(!libero.match(/<g class="marco"[^]*?<\/g>/)[0].includes('stroke="none"'),'Senza bordo non nasconde i collegamenti');
A(!Disegna.svg(res,{aspetto:senza,sfondo:false,evidenzia:'a'}).markup.match(/<g class="mnodo" data-id="a"[^]*?<\/g>/)[0].includes('stroke="none"'),'La selezione rimane visibile');
const vettore={drawing:{viewBox:'0 0 120 80',scene:[],nodes:[{tag:'rect',attrs:{width:'120',height:'80',fill:'#ff9900'},children:[]}]},fonts:[]};
A(Svg.html(vettore).includes('width="120" height="80"'));A.throws(()=>Svg.html({...vettore,fonts:[{family:'Arial',data:'https://evil.example/font'}]}));A.throws(()=>Svg.html({...vettore,drawing:{...vettore.drawing,nodes:[{tag:'script',attrs:{},children:[]}]}}));
A(Figure.leggi(['![Schema](_disegni/12345678-1234-1234-1234-123456789abc.svg)'],0));
(async()=>{const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1cAAAAASUVORK5CYII=',b=await require('../lib/appunti-docx').crea({titolo:'Vettoriale',albero:{tag:'root',figli:[{tag:'img',figli:[],dati:png,vettore,larghezza:120,altezza:80}]}}),z=require('fflate'),zip=z.unzipSync(b);A(Object.keys(zip).some(k=>k.endsWith('.svg')));A(Object.keys(zip).some(k=>k.endsWith('.png')));A(z.strFromU8(zip['word/document.xml']).includes('asvg:svgBlip'));A(Object.keys(zip).some(k=>/footer.*xml$/.test(k)));console.log('✓ Aspetto: preset, persistenza, SVG condiviso con stampa, validazione e DOCX vettoriale con fallback');})().catch(e=>{console.error(e);process.exitCode=1;});
