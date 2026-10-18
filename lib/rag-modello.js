'use strict';
// Solo questo manifest decide quali byte installare; le domande non accedono alla rete.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const REV='daa72c51243991dfcaf9f9137d2c573d8f7790c0', ID='onnx-community/embeddinggemma-2-ONNX';
const FILES=[
 ['config.json',5031,'git','b267dcb270ba41f67a8d14001bf470f23a9525fb'],
 ['tokenizer_config.json',1599,'git','a9afd12fb3ca2c418fd405320ace85ad46748d03'],
 ['tokenizer.json',32170510,'sha256','4d777ef5bdc1aa36227abdfb77c3e49e7b9c892d16e1b6bda41c393504828be4'],
 ['onnx/model_quantized.onnx',495165,'sha256','d06edd601f851c633a2519304cbeb8dc6170d7ceb61b436625c17fb9b6e74953'],
 ['onnx/model_quantized.onnx_data',313724928,'sha256','278a7ff1248c3618e4bd11a607fc54f7bdc7778854230f3956d3f86bd9db4f3b']
];
const SPEC=ID+'@'+REV+'|transformers=4.3.1|q8|768|text-v1';
async function verifica(dir) {
 for(const [name,size,alg,expected] of FILES){
  const file=path.join(dir,name);if(fs.statSync(file).size!==size)throw Error('Dimensione del modello non valida: '+name);
  const h=crypto.createHash(alg==='git'?'sha1':alg);if(alg==='git')h.update('blob '+size+'\0');
  for await(const bytes of fs.createReadStream(file))h.update(bytes);
  if(h.digest('hex')!==expected)throw Error('Integrità del modello non valida: '+name);
 }
 return true;
}
function pronto(dir){try{return JSON.parse(fs.readFileSync(path.join(dir,'ready.json'),'utf8')).spec===SPEC && FILES.every(([f,n])=>fs.statSync(path.join(dir,f)).size===n);}catch(_){return false;}}
async function installa(dir,{signal,progress=()=>{},fetch=globalThis.fetch}={}) {
 fs.mkdirSync(dir,{recursive:true});let completed=0;const total=FILES.reduce((n,f)=>n+f[1],0);
 for(const [name,size,alg,expected] of FILES){
  if(signal?.aborted)throw Error('Download interrotto.');
  const dest=path.join(dir,name),part=dest+'.part';fs.mkdirSync(path.dirname(dest),{recursive:true});
  // Un file già verificato rimane; un parziale riparte dall'ultimo byte scritto.
  let valid=false;
  if(fs.existsSync(dest)){
   const h=crypto.createHash(alg==='git'?'sha1':alg);if(alg==='git')h.update('blob '+size+'\0');
   for await(const bytes of fs.createReadStream(dest))h.update(bytes);
   valid=fs.statSync(dest).size===size && h.digest('hex')===expected;
  }
  if(!valid){
   let offset=fs.existsSync(part)?fs.statSync(part).size:0;if(offset>size){fs.unlinkSync(part);offset=0;}
   if(offset<size){
    const response=await fetch('https://huggingface.co/'+ID+'/resolve/'+REV+'/'+name,{signal,headers:offset?{Range:'bytes='+offset+'-'}:{}});
    if(!response.ok)throw Error('Download modello: HTTP '+response.status);
    if(offset && response.status!==206)offset=0;
    if(response.status===206 && !String(response.headers.get('content-range')).startsWith('bytes '+offset+'-'))throw Error('Ripresa download non valida.');
    const fd=fs.openSync(part,offset?'a':'w');
    try{for await(const bytes of response.body){if(signal?.aborted)throw Error('Download interrotto.');offset+=bytes.length;if(offset>size)throw Error('Download più grande del manifest.');fs.writeSync(fd,bytes);progress({phase:'download',file:name,bytes:completed+offset,total});}fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
   }
   const h=crypto.createHash(alg==='git'?'sha1':alg);if(alg==='git')h.update('blob '+size+'\0');
   for await(const bytes of fs.createReadStream(part))h.update(bytes);
   if(fs.statSync(part).size!==size || h.digest('hex')!==expected){fs.unlinkSync(part);throw Error('Checksum non valido: '+name+'. Ripeti il download.');}
   fs.renameSync(part,dest);
  }
  completed+=size;progress({phase:'download',file:name,bytes:completed,total});
 }
 await verifica(dir);
 const tmp=path.join(dir,'ready.json.tmp');fs.writeFileSync(tmp,JSON.stringify({spec:SPEC}));fs.renameSync(tmp,path.join(dir,'ready.json'));progress({phase:'ready',bytes:total,total});
}
module.exports={REV,ID,FILES,SPEC,pronto,verifica,installa};
