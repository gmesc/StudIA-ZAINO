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
const INFO={nome:'EmbeddingGemma 2',formato:'ONNX',url:'https://huggingface.co/'+ID};
// Immagini e fotogrammi video usano lo stesso encoder: un solo download e una sola copia.
const VISION_FILES=[
 ['preprocessor_config.json',560,'git','97ebeb96191bcc96d5ea299ad16c2952eb9e36c9'],
 ['processor_config.json',1788,'git','63043a5a2fd2e25a2fc5336fcdaf24e515d12289'],
 ['onnx/vision_encoder_quantized.onnx',162495,'sha256','bb0de2df53a2448a32dc7908a187c168c8afd514d4d6f674f7f46024875fa4e3'],
 ['onnx/vision_encoder_quantized.onnx_data',195228672,'sha256','3dabd69c0a36e9a8771ad82030dde74daa5a0e02b7047a5d3f3382b1137bab89']
];
const PROFILI=[{id:'testo',nome:'Testo'},{id:'vision',nome:'Visione'},{id:'video',nome:'Video'}];
function valida(modalita='testo'){if(!PROFILI.some(p=>p.id===modalita))throw Error('Modalità del modello non valida.');return modalita;}
function filesPer(modalita='testo'){return valida(modalita)==='testo'?FILES:FILES.concat(VISION_FILES);}
const SPEC=ID+'@'+REV+'|transformers=4.3.1|q8|768|text-v1';
async function verifica(dir,modalita='testo') {
 for(const [name,size,alg,expected] of filesPer(modalita)){
  const file=path.join(dir,name);if(fs.statSync(file).size!==size)throw Error('Dimensione del modello non valida: '+name);
  const h=crypto.createHash(alg==='git'?'sha1':alg);if(alg==='git')h.update('blob '+size+'\0');
  for await(const bytes of fs.createReadStream(file))h.update(bytes);
  if(h.digest('hex')!==expected)throw Error('Integrità del modello non valida: '+name);
 }
 return true;
}
function marcatore(modalita){return modalita==='testo'?{file:'ready.json',spec:SPEC}:{file:'ready-vision.json',spec:SPEC+'|vision-q8-v1'};}
function pronto(dir,modalita='testo'){
 try{const files=filesPer(modalita),m=marcatore(modalita);return JSON.parse(fs.readFileSync(path.join(dir,m.file),'utf8')).spec===m.spec && files.every(([f,n])=>fs.statSync(path.join(dir,f)).size===n);}catch(_){return false;}
}
function pacchetti(dir){
 return PROFILI.map(p=>{
  const files=filesPer(p.id),totale=files.reduce((n,f)=>n+f[1],0);
  const daScaricare=files.reduce((n,[f,size])=>{
   try{if(fs.statSync(path.join(dir,f)).size===size)return n;}catch(_){}
   try{const parziale=fs.statSync(path.join(dir,f+'.part')).size;if(parziale<=size)return n+size-parziale;}catch(_){}
   return n+size;
  },0);
  return {...p,totale,daScaricare,pronto:pronto(dir,p.id)};
 });
}
async function installa(dir,{modalita='testo',signal,progress=()=>{},fetch=globalThis.fetch}={}) {
 const files=filesPer(modalita);
 fs.mkdirSync(dir,{recursive:true});let completed=0;const total=files.reduce((n,f)=>n+f[1],0);
 for(const [name,size,alg,expected] of files){
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
 await verifica(dir,modalita);
 for(const tipo of modalita==='testo'?['testo']:['testo','vision']){
  const m=marcatore(tipo),dest=path.join(dir,m.file),tmp=dest+'.tmp';
  fs.writeFileSync(tmp,JSON.stringify({spec:m.spec}));fs.renameSync(tmp,dest);
 }
 progress({phase:'ready',bytes:total,total});
}
module.exports={REV,ID,INFO,FILES,VISION_FILES,SPEC,valida,filesPer,pacchetti,pronto,verifica,installa};
