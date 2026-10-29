'use strict';
const assert=require('assert'),A=require('../App/assets/chat/aggiornamento-studio');
(async()=>{
 let visibile=false,letture=0,errore='',fallisci=false,id=0;const timers=new Map();
 const a=A.crea({visibile:()=>visibile,aggiorna:async()=>{letture++;if(fallisci)throw Error('Lettura fallita');},errore:e=>{errore=e.message;},timer:f=>{timers.set(++id,f);return id;},cancella:id=>timers.delete(id)});
 const esegui=async()=>{const fs=[...timers.values()];timers.clear();fs.forEach(f=>f());await new Promise(setImmediate);};
 for(let i=0;i<10;i++)a.richiedi();await esegui();assert.equal(letture,0,'nessuna lettura nascosta');
 visibile=true;a.mostra();assert.equal(timers.size,1);await esegui();assert.equal(letture,1,'riprende l’aggiornamento rinviato');
 a.mostra();await esegui();assert.equal(letture,1,'nessuna lettura per soli cambi di layout');
 a.richiedi();a.richiedi();a.richiedi();assert.equal(timers.size,1);await esegui();assert.equal(letture,2,'accorpa le notifiche');
 a.richiedi();visibile=false;await esegui();assert.equal(letture,2,'chiusura durante l’attesa');
 visibile=true;a.mostra();await esegui();assert.equal(letture,3);
 a.richiedi();a.reset();await esegui();a.mostra();await esegui();assert.equal(letture,3,'cambio zaino annulla la richiesta vecchia');
 fallisci=true;a.richiedi();await esegui();assert.equal(errore,'Lettura fallita');
 console.log('✓ aggiornamento studio: viste nascoste, riapertura, notifiche accorpate, reset ed errori');
})().catch(e=>{console.error(e);process.exitCode=1;});
