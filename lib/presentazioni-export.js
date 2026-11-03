'use strict';
const path=require('node:path'),{randomUUID,createHash}=require('node:crypto');
const D=require('./permessi-disco'),fs=D.fs,P=require('./presentazioni'),R=require('./presentazioni-risorse');
const M=require('../App/assets/presentazioni/modello'),C=require('../App/assets/presentazioni/reveal-adapter');
const app=path.join(__dirname,'../App/assets/presentazioni');
function caratteri(){
 const dir=path.join(app,'fonts'),manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
 const necessari=['AtkinsonHyperlegible-Regular.woff2','AtkinsonHyperlegible-Bold.woff2','AtkinsonHyperlegible-Italic.woff2','AtkinsonHyperlegible-BoldItalic.woff2','TestMeSans02-Regular.otf','TestMeSans02-Bold.otf','OFL-Atkinson.txt','OFL-TestMe.txt','AtkinsonHyperlegibleNext-Variable.woff2','AtkinsonHyperlegibleNext-Italic-Variable.woff2','OFL-AtkinsonNext.txt','TestMeAlt02-Regular.otf','TestMeAlt02-Bold.otf'];
 for(const nome of necessari)if(!Object.hasOwn(manifest,nome))throw Error('Carattere o licenza mancante: '+nome);
 return Object.entries(manifest).map(([nome,hash])=>{
  if(!/^[A-Za-z0-9_.-]+$/.test(nome)||!/[.](woff2|otf|txt|md)$/.test(nome)||!/^[a-f0-9]{64}$/.test(hash))throw Error('Manifest dei caratteri non valido.');
  const p=D.percorso(dir,path.join(dir,nome));if(createHash('sha256').update(fs.readFileSync(p)).digest('hex')!==hash)throw Error('Carattere incompleto o modificato: '+nome);
  return {nome,p};
 });
}
function runtime(){
 const dir=path.join(app,'vendor'),m=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
 if(m.version!==1||!m.files||typeof m.files!=='object'||Object.keys(m.files).length>200)throw Error('Manifest runtime non valido.');
 const files=[];for(const [nome,hash] of Object.entries(m.files)){
  if(!/^[A-Za-z0-9_./-]+$/.test(nome)||nome.split('/').some(p=>!p||p==='.'||p==='..')||!/^[a-f0-9]{64}$/.test(hash))throw Error('Percorso runtime non valido.');
  const p=D.percorso(dir,path.join(dir,nome)),bytes=fs.readFileSync(p);if(createHash('sha256').update(bytes).digest('hex')!==hash)throw Error('Runtime incompleto o modificato: '+nome);files.push({nome,p});
 }
 for(const n of ['anime.js','reveal.js','reveal.css','math.js','katex/dist/katex.min.css','katex/dist/katex.min.js','katex/dist/contrib/auto-render.min.js'])if(!m.files[n])throw Error('Runtime mancante: '+n);
 return files;
}
function carte(d){const dir=path.join(app,'carte'),nomi=d?[...new Set([...M.posizioni(d).map(p=>M.sfondoSlide(d,p.slide).backgroundPattern),d.backgroundCommon?.backgroundPattern].filter(Boolean))]:Object.keys(M.CARTE);return nomi.map(k=>({nome:k+'.png',p:D.percorso(dir,path.join(dir,k+'.png'))}));}
function html(d){
 P.verifica(d,d.zainoId,d.id);const r=C.compila(d),config=JSON.stringify(r.settings).replace(/</g,'\\u003c');
 return {errors:r.errors,html:'<!doctype html>\n<html lang="it" data-tema="'+r.settings.theme+'" data-movimento-ridotto="'+r.settings.reducedMotion+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\'; media-src \'self\'; font-src \'self\'; connect-src \'none\'; object-src \'none\'; base-uri \'none\'"><title>'+C.esc(d.title)+'</title><link rel="stylesheet" href="runtime/reveal.css"><link rel="stylesheet" href="runtime/katex/dist/katex.min.css"><link rel="stylesheet" href="deck.css"><link rel="stylesheet" href="caratteri.css"></head><body><div class="reveal"><div class="slides">'+r.html+'</div></div><script type="application/json" id="presenta-config">'+config+'</script><script src="runtime/reveal.js" defer></script><script src="runtime/math.js" defer></script><script src="navigazione.js" defer></script><script src="runtime/anime.js" defer></script><script src="animazioni.js" defer></script><script src="animazioni-dom.js" defer></script><script src="player.js" defer></script></body></html>\n'};
}
function esporta(v,z,id,destinazione,baseRevision){
 return P.accoda(v,z,id,async()=>{
  const d=P.leggi(v,z,id);if(d.revision!==baseRevision)throw Error('La presentazione è cambiata: salva e ripeti l’esportazione.');
  const risorse=M.risorseUsate(d),esiti=await Promise.allSettled(risorse.map(k=>R.verifica(v,z,id,d.assets[k])));
  const mancanti=esiti.flatMap((r,i)=>r.status==='rejected'?[risorse[i]+': '+r.reason.message]:[]);
  if(mancanti.length)throw Error('Esportazione interrotta. Risorse mancanti o modificate:\n'+mancanti.join('\n'));
  const files=runtime(),fonts=caratteri(),documento=html(d),dest=D.percorso(destinazione,destinazione);
  const rel=path.relative(D.percorso(v,v),dest).split(path.sep);
  if(rel[0]==='Zaini'&&rel[2]===P.CARTELLA)throw Error('Scegli una destinazione fuori dall’archivio PRESENTAZIONI.');
  const finale=D.percorso(dest,path.join(dest,'presentazione-'+randomUUID()));let tmp;
  try{
   tmp=await fs.promises.mkdtemp(path.join(dest,'.presenta-'));
   await fs.promises.writeFile(path.join(tmp,'index.html'),documento.html,{flag:'wx'});
   for(const [src,nome] of [[path.join(app,'animazioni.js'),'animazioni.js'],[path.join(app,'animazioni-dom.js'),'animazioni-dom.js'],[path.join(app,'player.js'),'player.js'],[path.join(app,'navigazione.js'),'navigazione.js'],[path.join(app,'deck.css'),'deck.css'],[path.join(app,'caratteri.css'),'caratteri.css'],...fonts.map(f=>[f.p,'fonts/'+f.nome]),...carte(d).map(f=>[f.p,'carte/'+f.nome]),...files.map(f=>[f.p,'runtime/'+f.nome]),...risorse.map((k,i)=>[esiti[i].value,d.assets[k].path])]){
    const p=path.join(tmp,nome);await fs.promises.mkdir(path.dirname(p),{recursive:true});await fs.promises.copyFile(src,p,fs.constants.COPYFILE_EXCL);
   }
   // Ricontrolla le copie: il successo significa che anche i byte consegnati sono integri.
   for(const k of risorse){const a=d.assets[k],hash=await R.impronta(path.join(tmp,a.path));if(hash.sha256!==a.sha256||hash.size!==a.size)throw Error('Copia del media incompleta: '+k);}
   await fs.promises.writeFile(path.join(tmp,'LEGGIMI.txt'),'Apri index.html in un browser recente. Tutte le risorse sono locali.\nSpazio: avanti; frecce: argomenti e approfondimenti. Esc: panoramica.\nLe note del relatore e i collegamenti privati allo zaino sono esclusi.\nAudio e video dipendono dai codec supportati dal browser.\nLicenze di Reveal.js, Anime.js e KaTeX: runtime/licenze/. Caratteri e licenze OFL: fonts/.\n');
   await fs.promises.rename(tmp,finale);tmp=null;return {cartella:finale,errors:documento.errors};
  }finally{if(tmp)await fs.promises.rm(tmp,{recursive:true,force:true});}
 });
}
module.exports={runtime,caratteri,carte,html,esporta};
