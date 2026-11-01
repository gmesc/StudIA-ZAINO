'use strict';
const path=require('node:path'),{createHash,randomUUID}=require('node:crypto');
const D=require('./permessi-disco'),fs=D.fs,P=require('./presentazioni'),A=require('./appunti'),F=require('./formati-sicuri');
const MIME={'.png':['image','image/png'],'.jpg':['image','image/jpeg'],'.jpeg':['image','image/jpeg'],'.webp':['image','image/webp'],'.gif':['image','image/gif'],'.mp3':['audio','audio/mpeg'],'.wav':['audio','audio/wav'],'.ogg':['audio','audio/ogg'],'.opus':['audio','audio/ogg'],'.flac':['audio','audio/flac'],'.m4a':['audio','audio/mp4'],'.aac':['audio','audio/aac'],'.aiff':['audio','audio/aiff'],'.mp4':['video','video/mp4'],'.webm':['video','video/webm'],'.mov':['video','video/quicktime'],'.mkv':['video','video/x-matroska'],'.avi':['video','video/x-msvideo'],'.mpg':['video','video/mpeg'],'.mpeg':['video','video/mpeg']};
async function impronta(p){
 const h=await fs.promises.open(p,'r');try{const hash=createHash('sha256'),buf=Buffer.alloc(1024*1024);let n,pos=0;while((n=(await h.read(buf,0,buf.length,pos)).bytesRead)){hash.update(buf.subarray(0,n));pos+=n;}return {sha256:hash.digest('hex'),size:pos};}finally{await h.close();}
}
function percorso(v,z,id,asset){
 const dir=P.directory(v,z,id);if(!asset||!/^assets\/[a-f0-9]{64}\.[a-z0-9]{2,5}$/.test(asset.path||''))throw Error('Risorsa non valida.');
 return D.percorso(v,path.join(dir,asset.path));
}
async function verifica(v,z,id,asset){
 const p=percorso(v,z,id,asset),r=F.verificaFile(p,{estensioni:Object.keys(MIME)});if(!r.ok)throw Error('Risorsa non disponibile: '+r.error);
 const pair=MIME[path.extname(p)];if(pair[0]!==asset.kind||pair[1]!==asset.mimeType)throw Error('Tipo della risorsa non coerente.');
 const hash=await impronta(p);if(hash.sha256!==asset.sha256||hash.size!==asset.size)throw Error('Risorsa modificata o incompleta: '+asset.path);return p;
}
async function conserva(v,z,id,ext,source,bytes,originale){
 const pair=MIME[ext];if(!pair)throw Error('Formato del media non supportato.');
 const dir=D.percorso(v,path.join(P.directory(v,z,id),'assets'));await fs.promises.mkdir(dir,{recursive:true});
 const tmp=D.percorso(v,path.join(dir,'.risorsa-'+randomUUID()+ext));let creato=false;
 try{
  if(bytes){const r=F.verificaBuffer(bytes,ext,{estensioni:Object.keys(MIME)});if(!r.ok)throw Error(r.error);await fs.promises.writeFile(tmp,bytes,{flag:'wx',mode:0o600});creato=true;}
  else{
   const prima=fs.statSync(originale);if(prima.size>512*1024*1024)throw Error('Media troppo grande (massimo 512 MiB).');
   await fs.promises.copyFile(originale,tmp,fs.constants.COPYFILE_EXCL);creato=true;D.percorso(v,originale);
   const dopo=fs.statSync(originale);if(prima.ino!==dopo.ino||prima.dev!==dopo.dev||prima.mtimeMs!==dopo.mtimeMs||prima.ctimeMs!==dopo.ctimeMs)throw Error('Il media è cambiato durante la copia. Riprova.');
   const r=F.verificaFile(tmp,{estensioni:Object.keys(MIME)});if(!r.ok)throw Error(r.error);
  }
  const hash=await impronta(tmp),rel='assets/'+hash.sha256+ext,p=D.percorso(v,path.join(P.directory(v,z,id),rel));
  const asset={kind:pair[0],path:rel,mimeType:pair[1],...hash,source};
  if(fs.existsSync(p))await verifica(v,z,id,asset);
  else{const h=await fs.promises.open(tmp,'r+');try{await h.sync();}finally{await h.close();}await fs.promises.rename(tmp,p);creato=false;}
  return {assetId:'a_'+hash.sha256,asset};
 }finally{if(creato)await fs.promises.unlink(tmp);}
}
function importa(v,z,id,trasporto,baseRevision){
 return P.accoda(v,z,id,async()=>{
  const d=P.leggi(v,z,id);if(d.revision!==baseRevision)throw Error('Destinazione cambiata: ripeti l’inserimento nella slide corrente.');
  if(!trasporto||typeof trasporto!=='object')throw Error('Trasferimento non valido.');
  if(trasporto.tipo==='keyword'||trasporto.tipo==='album'){
   const LM=require('../App/assets/lim/modello');const t=LM.leggiTrasporto(JSON.stringify(trasporto));
   const m=require('./lim').comando(v,z,{azione:'materiale',trasporto:LM.trasporto(t.tipo,t.id,t.corso)}).materiale;
   const source={kind:t.tipo,id:t.id,title:m.titolo||'',link:m.link||''};
   if(t.tipo==='keyword')return {block:{type:'text',slot:'body',markdown:m.testo,source,...(/^#[0-9a-f]{6}$/i.test(m.colore||'')?{style:{highlight:m.colore}}:{})}};
   const match=/^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(m.immagine||'');if(!match)throw Error('Immagine Album non disponibile.');
   const ext={png:'.png',jpeg:'.jpg',webp:'.webp',gif:'.gif'}[match[1]],r=await conserva(v,z,id,ext,source,Buffer.from(match[2],'base64'));
   return {...r,block:{type:'image',slot:'media',assetId:r.assetId,alt:m.titolo||'',caption:m.titolo||'',source}};
  }
  // Estensione versionata per i media: il nome è risolto nel catalogo dello stesso zaino.
  if(trasporto.version!==1||!['audio','video'].includes(trasporto.tipo)||trasporto.corso!==z||typeof trasporto.file!=='string'||path.basename(trasporto.file)!==trasporto.file||/[\\\x00]/.test(trasporto.file))throw Error('Trascina un media dello stesso zaino.');
  const ext=path.extname(trasporto.file).toLowerCase();if(MIME[ext]?.[0]!==trasporto.tipo)throw Error('Tipo del media non supportato.');
  const originale=require('./materiali').trova(v,'Media',trasporto.file,z,true);if(!originale)throw Error('Media non più disponibile.');
  D.percorso(path.join(v,...require('./fonti-ai').parti(z),'MATERIALI'),originale);
  const source={kind:trasporto.tipo,id:trasporto.file,title:require('../App/assets/fonti/nomi').visibile(trasporto.file)},r=await conserva(v,z,id,ext,source,null,originale);
  return {...r,block:{type:trasporto.tipo,slot:'media',assetId:r.assetId,caption:source.title,autoplay:false,source}};
 });
}
module.exports={MIME,impronta,percorso,verifica,importa};
