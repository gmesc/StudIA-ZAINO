'use strict';
// Consumi locali: non contiene prompt, risposte, chiavi o testi dei documenti.
const fs=require('./permessi-disco').fs,{randomUUID}=require('node:crypto');
const P=require('./chat-profili'),F=require('./fonti-ai'),Z=require('./zaini'),N=require('../App/assets/chat/citazioni');
const file=z=>[...F.parti(z),'Costi','usage.jsonl'],statoFile=['Costi','storico-zaini.json'];
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function stato(v){
 let s;try{s=JSON.parse(P.leggiFileSicuro(v,statoFile,8*1024*1024));}catch(e){if(e.code==='ENOENT')return {version:1,excluded:[],undo:null};throw e;}
 if(!s||s.version!==1||!Array.isArray(s.excluded)||s.excluded.some(id=>!UUID.test(id))||(s.undo&&(!UUID.test(s.undo.token)||!Array.isArray(s.undo.previous)||s.undo.previous.some(id=>!UUID.test(id)))))throw Error('Storico dei costi non leggibile.');return s;
}
function salvaStato(v,s){const json=JSON.stringify(s);if(Buffer.byteLength(json)>8*1024*1024)throw Error('Storico dei costi troppo grande.');P.scriviAtomico(v,statoFile,json);}
function registra(v,z,meta){
 F.verifica(v,z);const usage=meta.usage||{},token=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0?n:null;
 const inputTokens=token(usage.inputTokens),outputTokens=token(usage.outputTokens),prices=require('../App/assets/chat/schede-piano').tariffa(meta.provider,meta.model);
 const costUsd=prices&&inputTokens!==null&&outputTokens!==null?(inputTokens*prices.input+outputTokens*prices.output)/1e6:null;
 const sourceIds=[...new Set((meta.sourceIds||[]).filter(id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(id)))];
 const row={id:randomUUID(),ts:new Date().toISOString(),provider:String(meta.provider||'').slice(0,100),model:String(meta.model||'').slice(0,200),operation:String(meta.operation||'AI cloud').slice(0,100),sourceIds,inputTokens,outputTokens,costUsd,...(prices?{prices}:{})};
 const target=P.percorsoSicuro(v,file(z),true),fd=fs.openSync(target,fs.constants.O_WRONLY|fs.constants.O_APPEND|fs.constants.O_CREAT|fs.constants.O_NOFOLLOW,0o600);
 try{if(!fs.fstatSync(fd).isFile())throw Error('Registro dei costi non valido.');fs.writeFileSync(fd,JSON.stringify(row)+'\n');}finally{fs.closeSync(fd);}return row;
}
async function misura(v,z,meta,fn){
 const r=await fn();try{registra(v,z,{...meta,usage:r?.usage});}catch(e){return {...r,costWarning:'Il consumo di questa chiamata AI non è stato registrato: '+e.message};}return r;
}
function righe(v,z){
 let text;try{text=P.leggiFileSicuro(v,file(z),32*1024*1024).toString('utf8');}catch(e){if(e.code==='ENOENT')return [];throw e;}
 return text.split('\n').filter(s=>s.trim()).map(line=>{let r;try{r=JSON.parse(line);}catch(_){throw Error('Registro dei costi non leggibile: '+z);}
  if(!UUID.test(r.id)||typeof r.ts!=='string'||!Array.isArray(r.sourceIds)||[r.costUsd,r.inputTokens,r.outputTokens].some(n=>n!==null&&(typeof n!=='number'||!Number.isFinite(n)||n<0)))throw Error('Consumo AI non valido: '+z);return r;});
}
const vuoto=()=>({costUsd:0,calls:0,unknownCosts:0,inputTokens:0,outputTokens:0});
function aggiungi(total,r){total.calls++;if(r.costUsd===null)total.unknownCosts++;else total.costUsd+=r.costUsd;total.inputTokens+=r.inputTokens||0;total.outputTokens+=r.outputTokens||0;}
function dati(v){return Z.elenco(v).map(z=>({...z,rows:righe(v,z.id)}));}
function summary(v){
 const s=stato(v),excluded=new Set(s.excluded),total=vuoto(),byZaino=[];
 for(const z of dati(v)){
  const t=vuoto(),materials=new Map();let inventory;try{inventory=JSON.parse(P.leggiFileSicuro(v,[...F.parti(z.id),'_fonti-ai.json'],16*1024*1024)).sources||[];}catch(e){if(e.code!=='ENOENT')throw e;inventory=[];}
  for(const r of z.rows.filter(r=>!excluded.has(r.id))){
   aggiungi(t,r);aggiungi(total,r);const source=r.sourceIds.length===1?inventory.find(s=>s.id===r.sourceIds[0]):null;
   const key=r.sourceIds.length===1?r.sourceIds[0]:'multi',label=source?N.nome(source):r.sourceIds.length===1?'Fonte non più disponibile':'Chat e più materiali';
   if(!materials.has(key))materials.set(key,{id:key,label,...vuoto()});aggiungi(materials.get(key),r);
  }
  byZaino.push({id:z.id,title:z.title,...t,materials:[...materials.values()].sort((a,b)=>a.label.localeCompare(b.label,'it'))});
 }
 return {total,byZaino,currency:'USD',undo:s.undo?{token:s.undo.token,at:s.undo.at}:null};
}
function reset(v){
 const s=stato(v),ids=dati(v).flatMap(z=>z.rows.map(r=>r.id)),excluded=[...new Set([...s.excluded,...ids])];
 if(excluded.length===s.excluded.length)return summary(v);
 const undo={token:randomUUID(),at:new Date().toISOString(),previous:s.excluded};salvaStato(v,{version:1,excluded,undo});return summary(v);
}
function annulla(v,token){
 const s=stato(v);if(!s.undo||s.undo.token!==token)throw Error('Annullamento non disponibile: lo storico è cambiato.');
 salvaStato(v,{version:1,excluded:s.undo.previous,undo:null});return summary(v);
}
module.exports={registra,misura,summary,reset,annulla};
