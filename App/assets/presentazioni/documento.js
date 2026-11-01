/* Una bozza per editor: la revisione del disco non entra nella cronologia annulla/ripeti. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./modello'));else root.PresentaDocumento=factory(root.PresentaModello);})(typeof window==='undefined'?this:window,function(M){
 'use strict';
 function crea({salva,bozza,cambiata=()=>{},ritardo=600}){
  let storia=null,revisione=0,modifica=0,scritta=0,inVolo=null,timer=null,errore='',bloccato=false;
  function notifica(){cambiata();}
  function documento(){if(!storia)return null;return {...storia.documento,revision:revisione};}
  function pianifica(){clearTimeout(timer);timer=setTimeout(()=>flush().catch(()=>{}),ritardo);timer?.unref?.();}
  function registra(d){clearTimeout(timer);storia=M.cronologia(d);revisione=d.revision;modifica=scritta=0;errore='';bloccato=false;notifica();}
  function cambia(fn){if(!storia||bloccato)throw Error('Attendi il salvataggio prima di cambiare documento.');fn();modifica++;errore='';notifica();pianifica();return documento();}
  async function flush(){
   clearTimeout(timer);if(inVolo)await inVolo;if(!storia||modifica===scritta)return documento();
   // Un solo salvataggio in volo; la digitazione successiva resta una nuova bozza.
   const lavoro=(async()=>{
    while(modifica!==scritta){const n=modifica,d=documento();errore='';notifica();
     try{const r=await salva(d,revisione);revisione=r.revision;scritta=n;notifica();}
     catch(e){errore=e.message;try{await bozza?.(documento(),revisione);}catch(b){errore+=' Anche la copia di recupero non è stata scritta: '+b.message;}notifica();throw Error(errore);}
    }return documento();
   })();inVolo=lavoro;
   try{return await lavoro;}finally{inVolo=null;notifica();}
  }
  return {get documento(){return documento();},get sporco(){return modifica!==scritta;},get salvando(){return !!inVolo;},get errore(){return errore;},get bloccato(){return bloccato;},get annullabile(){return !!storia?.annullabile;},get ripetibile(){return !!storia?.ripetibile;},
   apri(d){if(inVolo||modifica!==scritta)throw Error('Salva prima di cambiare presentazione.');registra(d);},
   recupera(d){if(!storia||d.id!==documento().id)throw Error('Bozza di un altro documento.');return cambia(()=>{storia=M.cronologia({...d,revision:revisione});});},
   applica(o){return cambia(()=>storia.applica(o));},annulla(){if(storia?.annullabile)return cambia(()=>storia.annulla());},ripeti(){if(storia?.ripetibile)return cambia(()=>storia.ripeti());},flush,
   async transizione(fn){if(bloccato)throw Error('Cambio documento già in corso.');bloccato=true;notifica();try{await flush();return await fn();}finally{bloccato=false;notifica();}},
   svuota(){if(inVolo||modifica!==scritta)throw Error('Modifiche non salvate: il documento resta aperto.');clearTimeout(timer);storia=null;notifica();}
  };
 }
 return {crea};
});
