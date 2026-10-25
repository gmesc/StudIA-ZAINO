'use strict';
const assert=require('node:assert/strict'),B=require('../App/assets/banco/forme');
B.registraForma('mia-nove-chiusura','Nove','"A C E" "B D F" "G H I"');
let casi=0;
for(const forma of B.CHIAVI){
 const ordine=B.blocchiInLettura(forma);
 for(const chiuso of ordine){
  const s=B.normalizzaStato({forma,col:.62,riga:.43,blocchi:Object.fromEntries(B.BLOCCHI.map(k=>[k,k==='B'?'':'contenuto-'+k]))}),prima=JSON.stringify(s),r=B.chiudiBlocco(s,chiuso);
  assert.equal(JSON.stringify(s),prima,'non modifica lo stato ricevuto');
  if(ordine.length===1){assert.deepEqual(r,s);continue;}
  assert.equal(B.blocchiDi(r.forma).length,ordine.length-1);
  assert.deepEqual(B.blocchiInLettura(r.forma).map(b=>r.blocchi[b]),ordine.filter(b=>b!==chiuso).map(b=>s.blocchi[b]),'conserva ordine e vuoti degli altri split');
  assert.deepEqual(Object.values(r.blocchi).filter(Boolean).sort(),Object.values(s.blocchi).filter(v=>v&&v!==s.blocchi[chiuso]).sort(),'toglie solo lo split chiuso, non gli strumenti già fuori vista');
  assert.deepEqual(B.normalizzaStato(JSON.parse(JSON.stringify(r))),r,'riapertura persistente');assert.equal(r.col,.62);assert.equal(r.riga,.43);casi++;
 }
}
const base=B.normalizzaStato({forma:'quattro',blocchi:{A:'fonte',C:'appunti',B:'mappa',D:'studio'}});
assert.deepEqual(B.chiudiBlocco(base,'assente'),base);
assert.equal(B.chiudiBlocco(B.normalizzaStato({forma:'due-riga'}),'A').forma,'uno');
assert.equal(B.chiudiBlocco(B.normalizzaStato({forma:'tre-col'}),'C').forma,'due-col');
let ridotto=B.normalizzaStato({forma:'mia-nove-chiusura',blocchi:Object.fromEntries(B.BLOCCHI.map(k=>[k,k]))});
for(let n=9;n>1;n--){ridotto=B.chiudiBlocco(ridotto,B.blocchiInLettura(ridotto.forma)[1]);assert.equal(B.blocchiDi(ridotto.forma).length,n-1);assert.equal(ridotto.blocchi.A,'A');}
B.dimenticaForma('mia-nove-chiusura');
console.log('banco-chiusura: '+casi+' chiusure, ordine, vuoti, strumenti fuori vista, persistenza e nove→uno OK');
