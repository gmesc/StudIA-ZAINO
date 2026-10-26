'use strict';
const assert=require('node:assert/strict'),B=require('../App/assets/banco/forme');
let casi=0;
for(const forma of B.CHIAVI){
 const visibili=B.blocchiInLettura(forma);
 const s=B.normalizzaStato({forma,col:.63,riga:.41,col3:.22,col3b:.74,blocchi:Object.fromEntries(B.BLOCCHI.map((b,i)=>[b,i===1?'':'strumento-'+b]))});
 for(const da of visibili)for(const a of visibili){
  const prima=JSON.stringify(s),r=B.scambiaBlocchi(s,da,a);
  assert.equal(JSON.stringify(s),prima);
  assert.deepEqual({...r,blocchi:s.blocchi},s,'forma e dimensioni restano quelle delle aree');
  assert.equal(r.blocchi[a],s.blocchi[da]);assert.equal(r.blocchi[da],s.blocchi[a]);
  for(const b of B.BLOCCHI)if(b!==da&&b!==a)assert.equal(r.blocchi[b],s.blocchi[b]);
  assert.deepEqual(B.scambiaBlocchi(r,a,da),s,'lo scambio è reversibile');
  assert.deepEqual(B.normalizzaStato(JSON.parse(JSON.stringify(r))),r);casi++;
 }
 assert.deepEqual(B.scambiaBlocchi(s,'assente',visibili[0]),s);
 const nascosto=B.BLOCCHI.find(b=>!visibili.includes(b));
 if(nascosto)assert.deepEqual(B.scambiaBlocchi(s,visibili[0],nascosto),s);
}
console.log('banco-spostamento: '+casi+' scambi, misure, vuoti, fuori vista e persistenza OK');
