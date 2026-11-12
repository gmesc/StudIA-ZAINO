/* Misure riutilizzabili: testo e font sono input; il DOM resta a chi disegna. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports={crea:factory};else{root.ZainoImpaginazione=factory(root.ZainoPretext);root.document?.fonts?.addEventListener('loadingdone',()=>root.ZainoImpaginazione.invalida());}})(globalThis,function(P){
 'use strict';
 const cache=new Map();let contesto='';
 function invalida(){cache.clear();P.clearCache();}
 function misura(testo,{font,larghezza,interlinea,spaziatura=0,lingua='it',dpr=1}={}){
  if(typeof testo!=='string'||!font||!Number.isFinite(larghezza)||larghezza<=0||!Number.isFinite(interlinea)||interlinea<=0||!Number.isFinite(spaziatura))throw Error('Parametri di impaginazione non validi.');
  const c=JSON.stringify([lingua,dpr]);if(c!==contesto){invalida();P.setLocale(lingua);contesto=c;}
  const k=JSON.stringify([testo,font,spaziatura]);let preparato=cache.get(k);
  if(!preparato){preparato=P.prepareWithSegments(testo,font,{letterSpacing:spaziatura});cache.set(k,preparato);if(cache.size>64)cache.delete(cache.keys().next().value);}
  // Cambiare larghezza non ripete la misurazione Canvas.
  return P.layoutWithLines(preparato,larghezza,interlinea);
 }
 function gruppiParole(testo,opzioni){
  const parole=testo.match(/\S+/gu)||[],righe=misura(testo,opzioni).lines,gruppi=[];let i=0;
  for(let r=0;r<righe.length;r++)for(const parola of righe[r].text.match(/\S+/gu)||[]){if(parola!==parole[i++])return null;gruppi.push(r);}
  // Una parola che Pretext spezza tra due righe richiede il percorso DOM: i suoi
  // span inline-block sono atomici e non vanno animati con geometria differente.
  return i===parole.length?gruppi:null;
 }
 return {misura,gruppiParole,invalida};
});
