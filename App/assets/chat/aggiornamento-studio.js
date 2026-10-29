/* Le notifiche delle fonti invalidano le viste: non devono farle leggere quando sono nascoste. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ZainoAggiornamentoStudio=factory();}(typeof self!=='undefined'?self:this,function(){
 'use strict';
 function crea({visibile,aggiorna,errore,timer=setTimeout,cancella=clearTimeout}){
  let sporco=false,attesa=null;
  function mostra(){
   cancella(attesa);attesa=null;
   if(!sporco||!visibile())return;
   attesa=timer(()=>{
    attesa=null;if(!sporco||!visibile())return;
    sporco=false;Promise.resolve().then(aggiorna).catch(errore);
   },250);
  }
  return {richiedi(){sporco=true;mostra();},mostra,reset(){cancella(attesa);attesa=null;sporco=false;}};
 }
 return {crea};
}));
