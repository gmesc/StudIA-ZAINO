'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const E=require('../lib/evidenze'),N=require('../lib/appunti'),M=require('../App/assets/mappa/modifica'),P=require('../App/assets/evidenze/postille');
const vault=fs.mkdtempSync(path.join(os.tmpdir(),'zaino-keyword-')),corso='prova';
try{
 fs.mkdirSync(path.join(vault,'Corsi',corso),{recursive:true});
 const n=N.save(vault,corso,null,{title:'Cellule'},'I mitocondri producono energia.');
 const v={appunto:n.file,exact:'mitocondri',prefix:'I ',suffix:' producono energia.',nota:'Organelli'};
 const r=E.aggiungi(vault,corso,v);A.equal(r.error,'');const id=r.evidenza.id;
 A.notEqual(id,E.identita({...v,appunto:'Altro.md'}));
 A.notEqual(id,E.identita({...v,appunto:'',materiale:n.file,pagina:1}));
 A.equal(E.normalizzaVoce({...v,appunto:'../Altro.md'}),null);
 A.equal(E.leggi(vault,corso).evidenze[0].appunto,n.file);
 A.equal(E.aggiungi(vault,corso,{appunto:n.file,exact:v.exact,prefix:v.prefix,suffix:v.suffix,colore:'#ff0000'}).evidenza.nota,'Organelli');
 const rename=N.rinomina(vault,corso,n.file,'Organelli');A(!rename.error,rename.error);
 const aggiornata=E.leggi(vault,corso).evidenze[0];A.equal(aggiornata.appunto,rename.file);A.equal(aggiornata.id,id);
 A.equal(E.aggiungi(vault,corso,{...v,appunto:rename.file}).evidenze.length,1);
 A.equal(E.aggiungi(vault,corso,{...v,appunto:rename.file}).evidenza.id,id);
 A.equal(P.gruppi([aggiornata])[0].appunto,rename.file);
 const nodo=M.estrai({nodi:[],archi:[]},{testo:v.exact,rimando:{type:'evidenza',file:id,label:v.exact}}).nodi[0];A.equal(nodo.rimando.file,id);
 const salva=E.salva;E.salva=()=>({error:'disco non scrivibile'});
 try{A(N.rinomina(vault,corso,rename.file,'Rinomina fallita').error);}finally{E.salva=salva;}
 A(N.apri(vault,corso,rename.file).nota);A.equal(E.leggi(vault,corso).evidenze[0].appunto,rename.file);
 const raw=fs.readFileSync(E.percorso(vault,corso));fs.writeFileSync(E.percorso(vault,corso),'corrotto');
 A(N.rinomina(vault,corso,rename.file,'Non deve rinominare').error);A(N.apri(vault,corso,rename.file).nota);
 fs.writeFileSync(E.percorso(vault,corso),raw);
 console.log('✓ Keyword APPUNTI: identità separata, persistenza, rinomina, nessun doppione, postille e rimando mappa');
}finally{fs.rmSync(vault,{recursive:true,force:true});}
