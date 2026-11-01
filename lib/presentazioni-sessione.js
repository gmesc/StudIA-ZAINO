'use strict';
const {randomUUID}=require('node:crypto'),M=require('../App/assets/presentazioni/modello');
const COMANDI=['avanti','indietro','argomentoSuccessivo','argomentoPrecedente','approfondisci','risali','vai'];
function crea({adesso=()=>performance.now(),id=randomUUID}={}){
 let doc=null,stato=null,token='',confermato=0,tempo=0,partenza=null,ultimoTempo=0;
 function ora(){const n=adesso();if(!Number.isFinite(n)||n<ultimoTempo)throw Error('Orologio della sessione non monotono.');ultimoTempo=n;return n;}
 function elapsed(){return tempo+(partenza===null?0:ora()-partenza);}
 function esigi(){if(!stato)throw Error('Nessuna presentazione in corso.');}
 function contesto(e){esigi();if(!e||e.sessionId!==stato.sessionId||e.zainoId!==stato.zainoId||e.presentationId!==stato.presentationId||e.documentRevision!==stato.documentRevision)throw Error('Messaggio di una sessione o revisione precedente.');}
 function snapshot(){esigi();return {...M.copia(stato),timer:{elapsedMs:elapsed(),running:partenza!==null}};}
 function pubblica(){const {html,settings,title}=require('../App/assets/presentazioni/reveal-adapter').compila(doc);return {html,settings,title,assets:M.pubblica(doc).assets};}
 function avvia(documento,autorita='locale'){
  const r=require('./validate').validatePresentazione(documento);if(!r.ok)throw Error(r.errors.join('; '));
  if(!['locale','pubblico'].includes(autorita))throw Error('Player non valido.');
  doc=M.copia(documento);token=id();tempo=0;partenza=null;confermato=0;ultimoTempo=0;ora();
  const p=M.posizioni(doc)[0];stato={sessionId:id(),zainoId:doc.zainoId,presentationId:doc.id,documentRevision:doc.revision,sequence:0,slideId:p.slide.id,h:0,v:0,fragmentIndex:-1,status:'presenting',authority:autorita};
  return {stato:snapshot(),token,documento:pubblica()};
 }
 function comando(e){
  contesto(e);if(!COMANDI.includes(e.azione))throw Error('Comando di riproduzione non valido.');
  let destinazione;
  if(e.azione==='vai'){const p=M.trova(doc,e.slideId);destinazione={h:p.h,v:p.v,fragmentIndex:-1};}
  stato.sequence++;return {...snapshot(),azione:e.azione,...(destinazione?{destinazione}:{}),token};
 }
 function conferma(e){
  contesto(e);if(e.token!==token||!Number.isSafeInteger(e.sequence)||e.sequence<confermato||e.sequence!==stato.sequence)throw Error('Conferma obsoleta o player non autorevole.');
  if(!Number.isInteger(e.h)||!Number.isInteger(e.v))throw Error('Coordinate non valide.');
  const s=doc.stacks[e.h]?.slides[e.v];if(!s)throw Error('Slide del player non valida.');
  const max=Math.max(-1,...s.animations.map(a=>M.indiceFragment(a.step)));
  if(!Number.isInteger(e.fragmentIndex)||e.fragmentIndex< -1||e.fragmentIndex>max)throw Error('Passaggio del player non valido.');
  Object.assign(stato,{h:e.h,v:e.v,slideId:s.id,fragmentIndex:e.fragmentIndex});confermato=e.sequence;return snapshot();
 }
 function autorita(e,nome){contesto(e);if(!['locale','pubblico'].includes(nome))throw Error('Player non valido.');stato.authority=nome;token=id();stato.sequence++;return {stato:snapshot(),token,documento:pubblica()};}
 function timer(e,azione){
  contesto(e);if(azione==='avvia'){if(partenza===null)partenza=ora();}else if(azione==='pausa'){tempo=elapsed();partenza=null;}else if(azione==='azzera'){tempo=0;if(partenza!==null)partenza=ora();}else throw Error('Comando timer non valido.');return snapshot();
 }
 function regia(){const s=snapshot(),slide=M.trova(doc,s.slideId).slide,max=Math.max(-1,...slide.animations.map(a=>M.indiceFragment(a.step)));
  return {stato:s,title:slide.title,notes:M.copia(slide.notes),prossimo:s.fragmentIndex<max?'passaggio':'slide'};
 }
 function chiudi(e){contesto(e);doc=null;stato=null;token='';partenza=null;}
 return {avvia,stato:snapshot,comando,conferma,autorita,timer,regia,chiudi};
}
module.exports={crea,COMANDI};
