'use strict';
const P=require('./chat-profili'),F=require('./fonti-ai'),C=require('./chat'),R=require('./risposte-ai'),A=require('./appunti');
const schema=require('../schema/scheda-zaino.schema.json');
const T=require('../App/assets/chat/schede-testo');
const Cit=require('../App/assets/chat/citazioni');
const fs=require('./permessi-disco').fs;
const PRESET={sintesi:'Sintesi',concetti:'Concetti e definizioni',prerequisiti:'Prerequisiti',domande:'Domande per capire',argomenti:'Argomenti e prove'};
const ISTRUZIONI={sintesi:'Descrivi la sequenza dei temi e riassumi i punti essenziali.',concetti:'Elenca i termini tecnici realmente spiegati e le loro definizioni.',prerequisiti:'Distingui i prerequisiti espliciti da quelli che proponi tu come preparazione; motiva ogni proposta con un passaggio.',domande:'Il title di ogni elemento è una domanda aperta; text è la risposta attesa motivata dalle prove.',argomenti:'Ricostruisci tesi, argomenti, prove e limiti, distinguendoli.'};
function valida(id,preset){if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id) || !Object.hasOwn(PRESET,preset))throw Error('Scheda non valida.');}
function parti(z,id,preset){valida(id,preset);return [...F.parti(z),'_lavorazione','rag','schede',id+'-'+preset+'.json'];}
function leggi(v,z,id,preset){
 try{const card=JSON.parse(P.leggiFileSicuro(v,parti(z,id,preset),2*1024*1024));const source=F.sincronizza(v,z).sources.find(s=>s.id===id);return {card,status:!source?'removed':source.revision===card.revision?'current':'changed'};}
 catch(e){if(e.code==='ENOENT')return {card:null,status:'missing'};throw e;}
}
function idDomanda(card,item){return 'scheda-'+F.hash(JSON.stringify([card.sourceId,card.revision,item])).slice(0,48);}
function origineDomanda(card,index){return {sourceId:card.sourceId,revision:card.revision,index,title:PRESET.domande,file:card.file};}
function elenco(v,z,{domande=false}={}){
 const inventory=F.sincronizza(v,z),sources=new Map(inventory.sources.map(s=>[s.id,s])),cards=[],questions=[],warnings=[...inventory.warnings];
 let files;try{files=fs.readdirSync(P.percorsoSicuro(v,[...F.parti(z),'_lavorazione','rag','schede']));}catch(e){if(e.code==='ENOENT')return {cards,questions,warnings};throw e;}
 for(const file of files.filter(f=>f.endsWith('.json')&&!f.startsWith('.'))){
  try{
   const c=JSON.parse(P.leggiFileSicuro(v,[...F.parti(z),'_lavorazione','rag','schede',file],2*1024*1024));valida(c.sourceId,c.preset);
   if(typeof c.sourceId!=='string'||file!==c.sourceId+'-'+c.preset+'.json'||typeof c.file!=='string'||typeof c.revision!=='string'||!Array.isArray(c.items))throw Error('Scheda non valida.');
   const source=sources.get(c.sourceId);
   cards.push({sourceId:c.sourceId,preset:c.preset,title:PRESET[c.preset],file:source?.file||c.file,createdAt:c.createdAt,partial:c.partial,covered:c.covered,total:c.total,status:!source?'removed':source.revision===c.revision?'current':'changed'});
   if(domande && c.preset==='domande')for(const [index,item] of c.items.entries()){
    if(typeof item.title!=='string'||!Array.isArray(item.refs)||!Array.isArray(c.sources))throw Error('Domanda non leggibile.');
    const refs=c.sources.filter(s=>item.refs.includes(s.chunkId)).map(({sourceId,revision,file,kind,page})=>({sourceId,revision,file,kind,page}));
    if(!refs.length)throw Error('Domanda senza riferimenti disponibili: '+item.title);
    questions.push({id:idDomanda(c,item),question:item.title,createdAt:c.createdAt,saved:false,attempts:[],sources:refs,sourcesCurrent:source?.revision===c.revision,scheda:{...origineDomanda(c,index),file:source?.file||c.file}});
   }
  }catch(e){warnings.push(file+': '+e.message);}
 }
 cards.sort((a,b)=>a.file.localeCompare(b.file)||a.title.localeCompare(b.title));return {cards,questions,warnings};
}
async function prepara(v,z,id,preset,opts={}){
 valida(id,preset);const scope={mode:'selected',sourceIds:[id],wikipedia:false};
 const data=await C.contesto(v,z,'',{...opts,scope,allChunks:true});
 const contenuti=data.chunks.filter(c=>!T.soloParatesto(c.text)),excluded=data.chunks.length-contenuti.length;
 const selected=[];let chars=0;for(const c of contenuti){if(chars+c.text.length>24000)break;selected.push(c);chars+=c.text.length;}
 if(!selected.length)throw Error(data.chunks.length?'Non ci sono contenuti didattici leggibili oltre a indice e dati editoriali. Scegli una fonte con il testo da studiare.':'La fonte non contiene passaggi leggibili.');
 const warnings=[...data.warnings,...(excluded?['Esclusi '+excluded+' passaggi di indice o dati editoriali.']:[])];
 return {preset,sourceId:id,revision:selected[0].revision,file:selected[0].file,chunks:selected,total:contenuti.length,covered:selected.length,excluded,partial:selected.length<contenuti.length || data.warnings.length>0,warnings,estimatedInputTokens:Math.ceil(JSON.stringify(selected).length/3)+2500};
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
 const card={version:1,promptVersion:2,...coverage,provider:opts.provider,model:opts.model,createdAt:new Date().toISOString(),...result,sources:chunks.map(({score,position,...s})=>({...s,quote:s.text,quoteComplete:true}))};
 P.scriviAtomico(v,parti(z,id,preset),JSON.stringify(card,null,2));return card;
}
function copia(v,z,id,preset){
 const {card,status}=leggi(v,z,id,preset);if(!card)throw Error('Genera prima la scheda.');
 // Il nuovo formato ha una propria identità: non sovrascrive copie personali già editate.
 const usati=new Set(card.items.flatMap(item=>item.refs));
 const sources=card.sources.map((s,i)=>({...s,selezione:Cit.selezione(s),citation:'[S'+(i+1)+']',text:[...new Set(card.sources.filter(p=>usati.has(p.chunkId)&&Cit.chiave(p)===Cit.chiave(s)).map(p=>p.text||p.quote).filter(Boolean))].join('\n\n')}));
 const message={...card,id:F.hash(JSON.stringify({formato:3,card})).slice(0,24),content:card.items.map(item=>'#### '+item.title+'\n\n'+T.etichette(item.text)+'\n\n'+Cit.perRiferimenti(item.refs,sources).map(s=>s.citation).join('\n\n')).join('\n\n'),context:{sources}};
 const file='Scheda AI '+message.id+'.md';
 const title=PRESET[preset]+' — '+Cit.nome(card);
 const {body}=R.prepara(message,'scheda-'+id,title,{livelloTitolo:preset==='domande'?6:3,citazioniEstese:true});
 let old;try{old=P.leggiFileSicuro(v,[...F.parti(z),'APPUNTI',file]).toString();}catch(e){if(e.code!=='ENOENT')throw e;}
 if(old)return {file,duplicate:true};
 P.percorsoSicuro(v,[...F.parti(z),'APPUNTI',file]);
 const now=new Date().toISOString();P.scriviAtomico(v,[...F.parti(z),'APPUNTI',file],A.serialize({title,creato:now,modificato:now},body+'\n\nCopertura: '+card.covered+'/'+card.total+' passaggi. Stato: '+status));A.reindex(v,z);return {file};
}
module.exports={PRESET,prepara,genera,leggi,copia,elenco,idDomanda,origineDomanda};
