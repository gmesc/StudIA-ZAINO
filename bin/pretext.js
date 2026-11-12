#!/usr/bin/env node
'use strict';
// Il bundle deriva solo dalla revisione registrata, senza download durante la build.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),esbuild=require('esbuild');
const radice=path.resolve(__dirname,'..'),fonte=path.join(radice,'vendor/pretext'),dest=path.join(radice,'App/assets/pretext');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const verifica=process.argv.includes('--verifica'),p=JSON.parse(fs.readFileSync(path.join(fonte,'provenienza.json'),'utf8'));
 for(const [nome,h]of Object.entries(p.files))if(hash(fs.readFileSync(path.join(fonte,nome)))!==h)throw Error('Sorgente Pretext diverso dalla revisione registrata: '+nome);
 const r=await esbuild.build({absWorkingDir:radice,entryPoints:['vendor/pretext/src/layout.ts'],bundle:true,minify:true,format:'iife',globalName:'ZainoPretext',platform:'browser',target:'es2022',write:false,legalComments:'inline',footer:{js:'if(typeof module==="object"&&module.exports)module.exports=ZainoPretext;'}});
 const b=Buffer.from(r.outputFiles[0].contents),licenza=fs.readFileSync(path.join(fonte,'LICENSE'));
 const files=[['../presentazioni/vendor/pretext.js',b],['../licenze/pretext.txt',licenza]];
 for(const [nome,bytes]of files){const file=path.join(dest,nome);if(verifica){if(!fs.existsSync(file)||!bytes.equals(fs.readFileSync(file)))throw Error('Runtime Pretext da ricompilare: '+nome);}else{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);}}
 console.log('Pretext '+p.commit.slice(0,8)+' · '+b.length+' byte · '+hash(b));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
