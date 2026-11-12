#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),esbuild=require('esbuild');
const radice=path.resolve(__dirname,'..'),dest=path.join(radice,'App/assets/drawably');
async function esegui(){
 const verifica=process.argv.includes('--verifica');fs.mkdirSync(dest,{recursive:true});
 const fonte=path.join(radice,'vendor/drawably'),provenienza=JSON.parse(fs.readFileSync(path.join(fonte,'provenienza.json'),'utf8'));
 for(const [nome,hash]of Object.entries(provenienza.files))if(crypto.createHash('sha256').update(fs.readFileSync(path.join(fonte,nome))).digest('hex')!==hash)throw Error('Sorgente Drawably diverso dalla revisione registrata: '+nome);
 for(const [nome,globale]of [['tratti','ZainoDrawablyTratti'],['catalogo','ZainoDrawablyCatalogo']]){
  const r=await esbuild.build({absWorkingDir:radice,entryPoints:['lib/drawably-'+nome+'.ts'],bundle:true,minify:true,format:'iife',globalName:globale,platform:'browser',target:'es2022',write:false,footer:{js:'if(typeof module==="object"&&module.exports)module.exports='+globale+';'}});
  const dati=r.outputFiles[0].contents,file=path.join(dest,nome+'.js');
  if(verifica){if(!fs.existsSync(file)||!Buffer.from(dati).equals(fs.readFileSync(file)))throw Error('Runtime Drawably da ricompilare: '+nome);}else fs.writeFileSync(file,dati);
  console.log(nome+': '+dati.length+' byte · '+crypto.createHash('sha256').update(dati).digest('hex'));
 }
}
esegui().catch(e=>{console.error(e.message);process.exitCode=1;});
