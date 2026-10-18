'use strict';
const P=require('./chat-profili'),F=require('./fonti-ai'),M=require('./rag-modello');
const path=require('node:path'),fs=require('node:fs');
function base(z){return [...F.parti(z),'_lavorazione','rag'];}
function generation(chunks){return F.hash(M.SPEC+'|'+chunks.map(c=>c.chunkId+'|'+c.file).join('|'));}
function readVectors(v,z,sourceId,chunks){
 const gen=generation(chunks),parts=[...base(z),'vettori',sourceId+'-'+gen];
 try{
  const meta=JSON.parse(P.leggiFileSicuro(v,[...parts.slice(0,-1),parts.at(-1)+'.json']));
  if(meta.generation!==gen || meta.count!==chunks.length)return null;
  const bytes=P.leggiFileSicuro(v,[...parts.slice(0,-1),parts.at(-1)+'.bin'],32*1024*1024);
  if(bytes.length!==chunks.length*768*4 || F.hash(bytes)!==meta.hash)return null;
  const values=[];for(let n=0;n<chunks.length;n++){const row=[];for(let i=0;i<768;i++)row.push(bytes.readFloatLE((n*768+i)*4));if(row.some(x=>!Number.isFinite(x)))return null;values.push(row);}return values;
 }catch(e){if(e.code==='ENOENT' || e instanceof SyntaxError)return null;throw e;}
}
function groups(chunks){const g=new Map();for(const c of chunks){if(!g.has(c.sourceId))g.set(c.sourceId,[]);g.get(c.sourceId).push(c);}return g;}
function alive(v,z,chunks){const now=F.sincronizza(v,z).sources;return chunks.filter(c=>now.some(s=>s.id===c.sourceId && s.revision===c.revision));}
async function indicizza(v,z,opts={}){
 const origin=F.identita(v,z);
 if(!opts.runtime?.ready())throw Error('Installa il modello locale prima di indicizzare.');
 const data=await require('./chat').contesto(v,z,'',{...opts,allChunks:true});
 let done=0,reused=0;const warnings=[...data.warnings];
 for(const [id,chunks] of groups(data.chunks)){
  if(opts.signal?.aborted)throw Error('Indicizzazione interrotta.');
  if(readVectors(v,z,id,chunks)){reused+=chunks.length;done+=chunks.length;continue;}
  const values=[];
  try{
   for(const c of chunks){values.push((await opts.runtime.embed(c.text,{title:c.file,signal:opts.signal,priority:0})).vector);done++;opts.progress?.({done,total:data.chunks.length,file:c.file});}
   if(alive(v,z,chunks).length!==chunks.length){warnings.push(chunks[0].file+': modificata durante l’indicizzazione; indice non pubblicato.');continue;}
   F.verificaIdentita(v,z,origin);
   const gen=generation(chunks),prefix=[...base(z),'vettori',id+'-'+gen];
   const bytes=Buffer.alloc(values.length*768*4);values.forEach((row,n)=>row.forEach((x,i)=>bytes.writeFloatLE(x,(n*768+i)*4)));
   P.scriviAtomico(v,[...prefix.slice(0,-1),prefix.at(-1)+'.bin'],bytes);
   P.scriviAtomico(v,[...prefix.slice(0,-1),prefix.at(-1)+'.json'],JSON.stringify({generation:gen,count:chunks.length,hash:F.hash(bytes),spec:M.SPEC}));
  }catch(e){if(opts.signal?.aborted)throw e;warnings.push(chunks[0].file+': '+e.message);}
 }
 return {done,reused,total:data.chunks.length,warnings};
}
function radici(text){return (String(text).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').match(/[\p{L}\p{N}]{3,}/gu)||[]).map(w=>w.length>4?w.replace(/[aeio]$/,''):w);}
function classifica(chunks,query,semantic=new Map()){
 const words=[...new Set(radici(query))].filter(w=>!['dell','nell','dall','quest','sono','come','cosa','per','con','che','gli','del','una','spiegami'].includes(w));
 const lexical=chunks.map(c=>{const text=new Set(radici(c.file+' '+c.text));return {c,score:words.reduce((s,w)=>s+(text.has(w)?1:0),0)};}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
 const vector=chunks.filter(c=>semantic.has(c.chunkId)).map(c=>({c,score:semantic.get(c.chunkId)})).filter(x=>x.score>.2).sort((a,b)=>b.score-a.score);
 const scores=new Map();for(const list of [lexical,vector])list.forEach((x,i)=>scores.set(x.c.chunkId,(scores.get(x.c.chunkId)||0)+1/(60+i)));
 const ranked=chunks.map(c=>({...c,score:scores.get(c.chunkId)||0})).sort((a,b)=>b.score-a.score || a.position-b.position);
 if(/confront|differenz|paragon/i.test(query)){
  // Il confronto non deve consumare tutto il budget sulla prima fonte lunga.
  const g=groups(ranked),out=[];while(out.length<ranked.length)for(const list of g.values())if(list.length)out.push(list.shift());return out;
 }
 return ranked;
}
async function cerca(v,z,query,opts={}){
 const origin=F.identita(v,z);
 if(typeof query!=='string' || query.length>12000)throw Error('Ricerca non valida.');
 const data=await require('./chat').contesto(v,z,query,{...opts,allChunks:true});
 const semantic=new Map();let indexed=0,mode='lessicale';
 if(opts.runtime?.ready() && data.chunks.length){
  try{
   const vectors=[];for(const [id,chunks] of groups(data.chunks)){const rows=readVectors(v,z,id,chunks);if(rows)chunks.forEach((c,i)=>vectors.push([c,rows[i]]));}
   indexed=vectors.length;
   if(indexed){const {vector:q}=await opts.runtime.embed(query,{query:true,signal:opts.signal,priority:2});for(const [c,row] of vectors)semantic.set(c.chunkId,row.reduce((s,n,i)=>s+n*q[i],0));mode='ibrida';}
  }catch(e){if(opts.signal?.aborted)throw e;data.warnings.push('Ricerca semantica non disponibile: '+e.message);}
 }
 if(indexed<data.chunks.length)data.warnings.push('Ricerca locale: '+indexed+'/'+data.chunks.length+' passaggi indicizzati semanticamente; gli altri usano le parole del testo.');
 F.verificaIdentita(v,z,origin);
 const live=alive(v,z,data.chunks);if(live.length<data.chunks.length)data.warnings.push('Una fonte è cambiata durante la ricerca ed è stata esclusa.');
 return {...data,chunks:classifica(live,query,semantic),mode,indexed};
}
async function recupera(v,z,query,opts={}){
 const data=await cerca(v,z,query,opts),selected=[];let size=0;
 for(const c of data.chunks){if(size+c.text.length>24000)continue;selected.push(c);size+=c.text.length;}
 if(selected.length<data.chunks.length)data.warnings.push('Contesto parziale: '+selected.length+' di '+data.chunks.length+' passaggi, massimo 24000 caratteri.');
 if(selected.length && !selected.some(c=>c.score>0))data.warnings.push('Nessun passaggio con corrispondenza forte: verifica la pertinenza delle fonti.');
 selected.forEach((c,i)=>{c.label=c.citation;c.citation='[S'+(i+1)+']';});
 return {excerpts:selected,sources:selected.map(({text,score,position,...s})=>({...s,quote:text,quoteComplete:true})),warnings:data.warnings,scope:data.scope,documents:data.documents,selected:selected.length,updatedAt:data.updatedAt,retrieval:{mode:data.mode,indexed:data.indexed,total:data.chunks.length}};
}
function ricostruisci(v,z){F.verifica(v,z);for(const folder of ['estratti','vettori']){const d=P.percorsoSicuro(v,[...base(z),folder]);fs.rmSync(d,{recursive:true,force:true});}return {ok:true};}
module.exports={indicizza,cerca,recupera,ricostruisci,classifica,readVectors,generation};
