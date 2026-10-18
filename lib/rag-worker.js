'use strict';
// Processo Node figlio anche in Electron: un crash nativo non chiude il vault.
const {verifica}=require('./rag-modello');
let model,tokenizer;
async function init(dir){
 await verifica(dir);
 const {AutoConfig,AutoTokenizer,AutoModel,env}=await import('@huggingface/transformers');
 env.allowRemoteModels=false;env.allowLocalModels=true;env.useFSCache=false;
 const config=await AutoConfig.from_pretrained(dir,{local_files_only:true});config.vision_config=null;config.audio_config=null;
 tokenizer=await AutoTokenizer.from_pretrained(dir,{local_files_only:true});
 model=await AutoModel.from_pretrained(dir,{config,dtype:'q8',device:'cpu',local_files_only:true,session_options:{intraOpNumThreads:2,interOpNumThreads:1}});
}
process.on('message',async({id,action,dir,text,title,query})=>{
 try{
  if(!model)await init(dir);
  const input=query?'task: search result | query: '+text:'title: '+(title||'none')+' | text: '+text;
  const tokens=await tokenizer(input,{truncation:false});
  if(tokens.input_ids.dims.at(-1)>2048)throw Error('Passaggio troppo lungo per il limite locale di 2048 token.');
  const out=await model(tokens),v=Array.from(out.sentence_embedding.data);
  const norm=Math.sqrt(v.reduce((s,n)=>s+n*n,0));
  if(v.length!==768 || v.some(n=>!Number.isFinite(n)) || Math.abs(norm-1)>.02)throw Error('Vettore locale non valido.');
  process.send({id,vector:v,memory:process.memoryUsage().rss});
 }catch(e){process.send({id,error:e.message});}
});
