'use strict';
const P=require('./chat-profili'),F=require('./fonti-ai'),C=require('./chat'),R=require('./risposte-ai'),A=require('./appunti');
const schema=require('../schema/scheda-zaino.schema.json');
const T=require('../App/assets/chat/schede-testo');
const fs=require('node:fs');
const PRESET={sintesi:'Sintesi',concetti:'Concetti e definizioni',prerequisiti:'Prerequisiti',domande:'Domande per capire',argomenti:'Argomenti e prove'};
const ISTRUZIONI={sintesi:'Descrivi la sequenza dei temi e riassumi i punti essenziali.',concetti:'Elenca i termini tecnici realmente spiegati e le loro definizioni.',prerequisiti:'Distingui i prerequisiti espliciti da quelli che proponi tu come preparazione; motiva ogni proposta con un passaggio.',domande:'Il title di ogni elemento è una domanda aperta; text è la risposta attesa motivata dalle prove.',argomenti:'Ricostruisci tesi, argomenti, prove e limiti, distinguendoli.'};
function valida(id,preset){if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id) || !Object.hasOwn(PRESET,preset))throw Error('Scheda non valida.');}
function parti(z,id,preset){valida(id,preset);return [...F.parti(z),'_lavorazione','rag','schede',id+'-'+preset+'.json'];}
function leggi(v,z,id,preset){
 try{const card=JSON.parse(P.leggiFileSicuro(v,parti(z,id,preset),2*1024*1024));const source=F.sincronizza(v,z).sources.find(s=>s.id===id);return {card,status:!source?'removed':source.revision===card.revision?'current':'changed'};}
 catch(e){if(e.code==='ENOENT')return {card:null,status:'missing'};throw e;}
}
function elenco(v,z){
 const inventory=F.sincronizza(v,z),sources=new Map(inventory.sources.map(s=>[s.id,s])),cards=[],warnings=[...inventory.warnings];
 let files;try{files=fs.readdirSync(P.percorsoSicuro(v,[...F.parti(z),'_lavorazione','rag','schede']));}catch(e){if(e.code==='ENOENT')return {cards,warnings};throw e;}
 for(const file of files.filter(f=>f.endsWith('.json')&&!f.startsWith('.'))){
  try{
   const c=JSON.parse(P.leggiFileSicuro(v,[...F.parti(z),'_lavorazione','rag','schede',file],2*1024*1024));valida(c.sourceId,c.preset);
   if(typeof c.sourceId!=='string'||file!==c.sourceId+'-'+c.preset+'.json'||typeof c.file!=='string'||typeof c.revision!=='string'||!Array.isArray(c.items))throw Error('Scheda non valida.');
   const source=sources.get(c.sourceId);
   cards.push({sourceId:c.sourceId,preset:c.preset,title:PRESET[c.preset],file:source?.file||c.file,createdAt:c.createdAt,partial:c.partial,covered:c.covered,total:c.total,status:!source?'removed':source.revision===c.revision?'current':'changed'});
  }catch(e){warnings.push(file+': '+e.message);}
 }
 cards.sort((a,b)=>a.file.localeCompare(b.file)||a.title.localeCompare(b.title));return {cards,warnings};
}
async function prepara(v,z,id,preset,opts={}){
 valida(id,preset);const scope={mode:'selected',sourceIds:[id],wikipedia:false};
 const data=await C.contesto(v,z,'',{...opts,scope,allChunks:true});
 const selected=[];let chars=0;for(const c of data.chunks){if(chars+c.text.length>24000)break;selected.push(c);chars+=c.text.length;}
 if(!selected.length)throw Error('La fonte non contiene passaggi leggibili.');
 return {preset,sourceId:id,revision:selected[0].revision,file:selected[0].file,chunks:selected,total:data.chunks.length,covered:selected.length,partial:selected.length<data.chunks.length || data.warnings.length>0,warnings:data.warnings,estimatedInputTokens:Math.ceil(JSON.stringify(selected).length/3)+2500};
}
async function genera(v,z,id,preset,opts={}){
 const origin=F.identita(v,z);
 const data=await prepara(v,z,id,preset,opts);
 if(opts.expectedRevision && data.revision!==opts.expectedRevision)throw Error('La fonte è cambiata: ricontrolla la stima prima di analizzarla.');
 const profile=P.leggi(v),p=profile.profiles.find(p=>p.id===profile.activeId);
 const result=await require('./schede').analizzaEsplicite(data.chunks,{schema,preset:ISTRUZIONI[preset],profile:p,chiama:opts.chiama,signal:opts.signal});
 F.verificaIdentita(v,z,origin);
 const current=F.sincronizza(v,z).sources.find(s=>s.id===id);
 if(current?.revision!==data.revision)throw Error('Fonte cambiata durante l’analisi: scheda non pubblicata.');
 const {chunks,...coverage}=data;
 const card={version:1,promptVersion:1,...coverage,provider:opts.provider,model:opts.model,createdAt:new Date().toISOString(),...result,sources:chunks.map(({score,position,...s})=>({...s,quote:s.text,quoteComplete:true}))};
 P.scriviAtomico(v,parti(z,id,preset),JSON.stringify(card,null,2));return card;
}
function copia(v,z,id,preset){
 const {card,status}=leggi(v,z,id,preset);if(!card)throw Error('Genera prima la scheda.');
 const message={id:F.hash(JSON.stringify(card)).slice(0,24),content:card.items.map(item=>'#### '+item.title+'\n\n'+T.etichette(item.text)+' '+item.refs.map(id=>{const i=card.sources.findIndex(s=>s.chunkId===id);return '[S'+(i+1)+']';}).join(' ')).join('\n\n'),...card,
 context:{sources:card.sources.map((s,i)=>({...s,citation:'[S'+(i+1)+']'}))}};
 const file='Scheda AI '+message.id+'.md';
 const title=PRESET[preset]+' — '+card.file.split('/').pop();
 const {body}=R.prepara(message,'scheda-'+id,title);
 let old;try{old=P.leggiFileSicuro(v,[...F.parti(z),'APPUNTI',file]).toString();}catch(e){if(e.code!=='ENOENT')throw e;}
 if(old)return {file,duplicate:true};
 P.percorsoSicuro(v,[...F.parti(z),'APPUNTI',file]);
 const now=new Date().toISOString();P.scriviAtomico(v,[...F.parti(z),'APPUNTI',file],A.serialize({title,creato:now,modificato:now},body+'\n\nCopertura: '+card.covered+'/'+card.total+' passaggi. Stato: '+status));A.reindex(v,z);return {file};
}
module.exports={PRESET,prepara,genera,leggi,copia,elenco};
