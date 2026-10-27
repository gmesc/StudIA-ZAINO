'use strict';
const P=require('./chat-profili'),F=require('./fonti-ai');
async function estrai(vault,zaino,source,opts){
 const sicurezza=require('./sicurezza-accesso');
 const esito=source.kind==='pdf'?await sicurezza.richiedi(P.percorsoSicuro(vault,[...F.parti(zaino),...source.file.split('/')])):null;
 const base=[...F.parti(zaino),'_lavorazione','rag','estratti'];
 const file=source.id+'-'+source.revision+(opts.fullSource?'-intera-v1.json':'-v1.json');
 try{
  const cache=JSON.parse(P.leggiFileSicuro(vault,[...base,file],16*1024*1024));
  if(cache.revision===source.revision && Array.isArray(cache.pages) && cache.pages.every(p=>typeof p.text==='string'))return cache;
 }catch(e){if(e.code!=='ENOENT' && !['SyntaxError'].includes(e.name))throw e;}
 const bytes=P.leggiFileSicuro(vault,[...F.parti(zaino),...source.file.split('/')],source.kind==='pdf'?40*1024*1024:2*1024*1024);
 sicurezza.verificaByte(esito,bytes);
 if(F.hash(bytes)!==source.revision)throw Error('La fonte è cambiata durante la lettura. Riprova.');
 let result;
 if(source.kind==='pdf')result=await opts.estraePdf(bytes,opts.signal);
 else{
  const text=bytes.toString('utf8').replace(/^\uFEFF/,'');
  if(text.includes('\0'))throw Error('Il file non contiene testo UTF-8 leggibile.');
  const max=opts.fullSource?2000000:250000;
  result={pages:[{text:text.slice(0,max)}],truncated:text.length>max};
 }
 if(opts.signal?.aborted)throw Error('Lettura interrotta.');
 const data={revision:source.revision,...result};P.scriviAtomico(vault,[...base,file],JSON.stringify(data));return data;
}
module.exports={estrai};
