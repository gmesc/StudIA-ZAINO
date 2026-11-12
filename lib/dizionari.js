'use strict';
const fs=require('./permessi-disco').fs,path=require('node:path'),crypto=require('node:crypto');
const catalogo=require('./dizionari-catalogo.json'),inVolo=new Map();
const inclusi=[{id:'it',nome:'Italiano',sigla:'ITA'},{id:'en',nome:'English (US)',sigla:'ENG'}];
function voce(id){const d=catalogo.find(d=>d.id===id);if(!d)throw Error('Dizionario non disponibile nel catalogo.');return d;}
function cartella(base,d){return path.join(base,d.id+'-'+d.rev);}
function controlla(bytes,f){if(bytes.length!==f.bytes||crypto.createHash('sha256').update(bytes).digest('hex')!==f.sha256)throw Error('Dizionario non integro: riprova il download.');}
function pronto(base,d){try{for(const f of d.files)controlla(fs.readFileSync(path.join(cartella(base,d),f.nome)),f);return true;}catch(_){return false;}}
function elenco(base){return inclusi.map(d=>({...d,incluso:true,installato:true})).concat(catalogo.map(d=>({id:d.id,nome:d.nome,sigla:d.sigla,licenza:d.licenza,incluso:false,installato:pronto(base,d),bytes:d.files.reduce((n,f)=>n+f.bytes,0)})));}
async function installa(base,id,richiedi=fetch){
 const d=voce(id),chiave=path.join(base,id);if(inVolo.has(chiave))return inVolo.get(chiave);
 const lavoro=(async()=>{
  if(pronto(base,d))return;
  fs.mkdirSync(base,{recursive:true});const tmp=fs.mkdtempSync(path.join(base,'.download-'));
  try{
   for(const f of d.files){
    const r=await richiedi('https://raw.githubusercontent.com/wooorm/dictionaries/'+d.rev+'/dictionaries/'+d.id+'/'+f.nome,{signal:AbortSignal.timeout(30000),redirect:'error'});
    if(!r.ok)throw Error('Download non riuscito ('+r.status+'). Riprova quando sei online.');
    const blocchi=[];let dimensione=0;
    for await(const blocco of r.body){dimensione+=blocco.length;if(dimensione>f.bytes)throw Error('Dimensione del dizionario non valida.');blocchi.push(blocco);}
    const bytes=Buffer.concat(blocchi);controlla(bytes,f);fs.writeFileSync(path.join(tmp,f.nome),bytes,{flag:'wx',mode:0o600});
   }
   fs.writeFileSync(path.join(tmp,'provenienza.json'),JSON.stringify(d,null,2));
   const dir=cartella(base,d);if(fs.existsSync(dir))fs.rmSync(dir,{recursive:true});fs.renameSync(tmp,dir);
  }finally{if(fs.existsSync(tmp))fs.rmSync(tmp,{recursive:true,force:true});}
 })();inVolo.set(chiave,lavoro);try{return await lavoro;}finally{inVolo.delete(chiave);}
}
function dati(base,id){const d=voce(id);if(!pronto(base,d))throw Error('Scarica prima questo dizionario.');const dir=cartella(base,d);return {aff:new Uint8Array(fs.readFileSync(path.join(dir,'index.aff'))),dic:new Uint8Array(fs.readFileSync(path.join(dir,'index.dic')))};}
module.exports={elenco,installa,dati,catalogo};
