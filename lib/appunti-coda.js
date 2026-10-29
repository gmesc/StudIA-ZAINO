'use strict';
// Una coda per cartella: anche l'indice condiviso deve seguire l'ordine dei testi.
// Il contesto dei permessi resta quello della richiesta che accoda la funzione.
function crea(){
 const code=new Map();
 return {esegui(vault,corso,fn){
  const chiave=JSON.stringify([vault,corso]),prima=code.get(chiave)||Promise.resolve();
  const ora=prima.catch(()=>{}).then(fn);code.set(chiave,ora);
  const finito=()=>{if(code.get(chiave)===ora)code.delete(chiave);};
  ora.then(finito,finito);return ora;
 }};
}
module.exports={crea};
