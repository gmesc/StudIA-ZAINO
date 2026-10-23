'use strict';
const assert=require('assert/strict');
const C=require('../App/assets/album/catalogo');
const B=require('../App/assets/banco/materiali');
const v=[{nome:'Ética 10',creato:'2026-10-02',tipo:'audio'},{nome:'etica 2',creato:'2026-10-03',tipo:'video'},{nome:'Albero',creato:'2026-10-01',tipo:'immagini'}];
assert.deepEqual(C.ordina(v,{criterio:'nome',verso:'asc'}).map(x=>x.nome),['Albero','etica 2','Ética 10']);
assert.equal(v[0].nome,'Ética 10');
assert.deepEqual(C.ordina(v,{criterio:'data',verso:'desc'}).map(x=>x.nome),['etica 2','Ética 10','Albero']);
assert.deepEqual(C.cerca(v,'ETICA').map(x=>x.tipo),['audio','video']);
assert.equal(C.cerca([{nome:'Schema',materiale:'Botanica pagina 2'}],'botanica schema').length,1);
assert.deepEqual(['nome','data'].flatMap(criterio=>['asc','desc'].map(verso=>C.etichetta({criterio,verso}))),['Z–A','A–Z','31–1','1–31']);
assert.equal(C.preferenze({dimensione:999,tipo:'inesistente'}).dimensione,260);
assert.equal(C.preferenze({dimensione:999,tipo:'inesistente'}).tipo,'ritagli');
const prima={forma:'due',col:.4,blocchi:{A:'player',B:'album',C:'appunti',D:'foto'}};
const dopo=B.unificaAlbum(prima,['A','C']);
assert.deepEqual(dopo.blocchi,{A:'album',B:'',C:'appunti',D:''});
assert.equal(dopo.col,.4);assert.equal(prima.blocchi.A,'player');
assert.equal(B.riquadro('foto'),'album');assert.equal(B.riquadro('fonte2'),'fonte2');
// Le foto partecipano ai gruppi Media con la stessa identità usata dai rimandi.
const fs=require('fs'),os=require('os'),path=require('path');
const A=require('../lib/album'),G=require('../lib/gruppi-fonti'),F=require('../App/assets/fonti/gruppi');
const vault=fs.mkdtempSync(path.join(os.tmpdir(),'album-gruppi-'));
try{
  require('../lib/zaini').crea(vault,'Prova');
  const foto=A.salva(vault,'prova',{origine:'foto',materiale:'Albero.png',didascalia:'Albero',dati:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='});
  assert.equal(foto.error,'');
  const id='album:'+foto.voce.id,st=G.leggi(vault,'prova','media');
  assert.equal(st.error,'');assert(st.stato.liberi.includes(id));
  const gruppo=F.sposta(F.crea(st.stato,'g-foto','Paesaggi'),id,'g-foto');
  assert.equal(G.salva(vault,'prova',gruppo,'media').error,'');
  assert.deepEqual(G.leggi(vault,'prova','media').stato.gruppi[0].files,[id]);
  A.rinomina(vault,'prova',foto.voce.id,'Albero nuovo');
  assert.deepEqual(G.leggi(vault,'prova','media').stato.gruppi[0].files,[id]);
  assert.deepEqual(G.leggi(vault,'prova','fonti').stato.liberi,[]);
}finally{fs.rmSync(vault,{recursive:true,force:true});}
console.log('✓ catalogo ALBUM: ordinamento, ricerca, preferenze, migrazione del banco');
