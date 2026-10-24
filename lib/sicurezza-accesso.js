'use strict';
// Un punto condiviso per import, lettura e cache AI. Il main collega il servizio;
// CLI e prove delle librerie conservano il controllo dei formati già esistente.
let servizio;
function configura(s) { servizio=s; }
async function controlla(percorsi) {
  if(servizio)return servizio.controlla(percorsi);
  return {ok:true,esiti:percorsi.map(percorso=>({percorso,ok:true,avvisi:[]})),controllati:0,bloccati:0};
}
async function richiedi(percorso) {
  const r=await controlla([percorso]),esito=r.esiti[0];
  if(!esito?.ok)throw Error(esito?.error||'PDF non verificato.');
  return esito;
}
function richiediSync(percorso) { return servizio?servizio.richiediSync(percorso):{ok:true,avvisi:[]}; }
function verificaByte(esito,bytes) {
  if(esito?.hash && require('node:crypto').createHash('sha256').update(bytes).digest('hex')!==esito.hash)throw Error('Il PDF è cambiato dopo il controllo di sicurezza. Riprova.');
}
module.exports={configura,controlla,richiedi,richiediSync,verificaByte};
