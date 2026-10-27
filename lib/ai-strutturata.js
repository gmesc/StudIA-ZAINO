'use strict';
// Lo stesso schema va al provider e ad Ajv: nessun JSON del modello scrive percorsi o comandi.
const Ajv=require('ajv');
async function chiedi({schema,system,messages,chiama,controlla=()=>{},signal}){
 const validate=new Ajv({allErrors:true,strict:false}).compile(schema);
 let error='';
 for(let attempt=0;attempt<2;attempt++){
  if(signal?.aborted)throw Error('Operazione interrotta.');
  const result=await chiama({schema,system:system+'\nRispondi soltanto con JSON conforme a questo schema:\n'+JSON.stringify(schema),messages:messages.concat(error?[{role:'user',content:'Correggi la forma della risposta. Errori di validazione: '+error}]:[]),signal});
  try{
   const obj=JSON.parse(String(result.text).replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));
   if(!validate(obj))throw Error(validate.errors.map(e=>e.instancePath+' '+e.message).join('; '));
   controlla(obj);return obj;
  }catch(e){error=e.message.slice(0,1000);}
 }
 throw Error('Risposta strutturata non valida dopo due tentativi: '+error);
}
module.exports={chiedi};
