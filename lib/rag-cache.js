'use strict';
const P=require('./chat-profili'),F=require('./fonti-ai');
async function estrai(vault,zaino,source,opts){
 const base=[...F.parti(zaino),'_lavorazione','rag','estratti'];
 const file=source.id+'-'+source.revision+'-v1.json';
 try{
  const cache=JSON.parse(P.leggiFileSicuro(vault,[...base,file],4*1024*1024));
  if(cache.revision===source.revision && Array.isArray(cache.pages) && cache.pages.every(p=>typeof p.text==='string'))return cache;
 }catch(e){if(e.code!=='ENOENT' && !['SyntaxError'].includes(e.name))throw e;}
 const bytes=P.leggiFileSicuro(vault,[...F.parti(zaino),...source.file.split('/')],source.kind==='pdf'?40*1024*1024:2*1024*1024);
 if(F.hash(bytes)!==source.revision)throw Error('La fonte è cambiata durante la lettura. Riprova.');
 let result;
 if(source.kind==='pdf')result=await opts.estraePdf(bytes,opts.signal);
 else{
  const text=bytes.toString('utf8').replace(/^\uFEFF/,'');
  if(text.includes('\0'))throw Error('Il file non contiene testo UTF-8 leggibile.');
  result={pages:[{text:text.slice(0,250000)}],truncated:text.length>250000};
 }
 if(opts.signal?.aborted)throw Error('Lettura interrotta.');
 const data={revision:source.revision,...result};P.scriviAtomico(vault,[...base,file],JSON.stringify(data));return data;
}
module.exports={estrai};
