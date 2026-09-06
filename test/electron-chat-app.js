'use strict';
// Esemplare di prova: i provider sono simulati prima di caricare il main.
// Nessuna variabile d'ambiente o opzione di produzione abilita questi adattatori.
const provider = require('../lib/chat-provider');
provider.modelli = async () => [{id:'modello-locale-di-prova',nome:'Modello locale di prova'}];
provider.rispondi = async ({messages,signal}) => {
  const ultimo=messages.at(-1).content;
  if(ultimo.startsWith('Risposta lenta')) await new Promise((resolve,reject)=>{
    const timer=setTimeout(resolve,10000);
    const cancel=()=>{clearTimeout(timer);reject(new Error('Risposta interrotta.'));};
    if(signal.aborted)cancel();else signal.addEventListener('abort',cancel,{once:true});
  });
  return {text:'Risposta simulata per verificare il cablaggio.\n'+ultimo};
};
global.fetch=async()=>{throw new Error('Rete disabilitata nella prova UI.');};
require('../main');
