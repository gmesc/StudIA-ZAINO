'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const D=require('../lib/appunti-disegni');
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1cAAAAASUVORK5CYII=';
const annotazioni={versione:1,larghezza:800,altezza:420,segni:[{id:'freccia',pagina:1,tipo:'freccia',colore:'#0f766e',spessore:2,opacita:1,punti:[[20,50],[200,200]],curva:[40,230],bidirezionale:true,punta:'triangolo'}]};
const vettore={drawing:{viewBox:'0 0 800 420',scene:[],nodes:[{tag:'path',attrs:{d:'M20 50 Q40 230 200 200',stroke:'#0f766e',fill:'none'},children:[]}]},fonts:[]};
const tmp=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'zaino-appunti-annota-')));
try{
 require('../lib/zaini').crea(tmp,'Prova');
 const a=D.salva(tmp,'prova',{png,vettore,annotazioni});
 A(a.src.endsWith('.svg'));
 const r=D.leggi(tmp,'prova',a.id);A.deepEqual(r.annotazioni,annotazioni);A(r.vettore);A.equal(r.dati,png);A(D.srcUrl(tmp,'prova',a.id).startsWith('data:image/svg+xml'));
 const b=D.salva(tmp,'prova',{png,vettore,annotazioni:{...annotazioni,segni:[{...annotazioni.segni[0],colore:'#ef4444'}]}});
 A.notEqual(a.id,b.id);A.equal(D.leggi(tmp,'prova',a.id).annotazioni.segni[0].colore,'#0f766e','Undo conserva la scena precedente');
 A.throws(()=>D.salva(tmp,'prova',{png,vettore}),/Excalidraw/,'un PNG arbitrario non è un disegno modificabile');
 for(const x of [{...annotazioni,segni:[]},{...annotazioni,larghezza:Infinity},{...annotazioni,segni:[{...annotazioni.segni[0],pagina:2}]},{...annotazioni,segni:[{...annotazioni.segni[0],curva:[NaN,20]}]}])A.throws(()=>D.salva(tmp,'prova',{png,vettore,annotazioni:x}));
 A.throws(()=>D.salva(tmp,'prova',{png,annotazioni}),/vettoriale/);
 A.throws(()=>D.salva(tmp,'prova',{png,vettore:{...vettore,drawing:{...vettore.drawing,nodes:[{tag:'script',attrs:{},children:[]}]}},annotazioni}));
 console.log('✓ APPUNTI Annota: SVG/PNG, scena modificabile, versioni immutabili, rifiuto dati non validi');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
