'use strict';
const fs=require('node:fs'),path=require('node:path'),esbuild=require('esbuild');
const root=path.join(__dirname,'..'),out=path.join(root,'App/assets/appunti/vendor');
const verifica=process.argv.includes('--verifica');
function scrivi(file,contenuto){
 const bytes=Buffer.from(contenuto);
 if(verifica){if(!fs.existsSync(file)||!fs.readFileSync(file).equals(bytes))throw Error('Risorsa editor da rigenerare: '+path.relative(root,file));}
 else{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);}
}
(async()=>{
 for(const [entry,name] of [['strumenti-entry','strumenti'],['ortografia-worker','ortografia-worker']]){
  // Il pacchetto WASM 4.0.2 richiede il suo export CJS; l'export ESM usa nanoid come namespace callable.
  const r=await esbuild.build({entryPoints:[path.join(root,'App/assets/appunti/'+entry+'.js')],outfile:path.join(out,name+'.js'),bundle:true,minify:true,platform:'browser',mainFields:['browser','main'],legalComments:'external',write:false});
  for(const f of r.outputFiles)scrivi(f.path,f.contents);
  const legal=path.join(out,name+'.js.LEGAL.txt');
  if(!r.outputFiles.some(f=>f.path===legal)&&fs.existsSync(legal)){if(verifica)throw Error('Avviso generato obsoleto: '+legal);fs.unlinkSync(legal);}
 }
 for(const lingua of ['it','en'])for(const [src,dest]of [['index.aff',lingua+'.aff'],['index.dic',lingua+'.dic'],['license',lingua+'-LICENSE.txt']])
  scrivi(path.join(out,'dizionari',dest),fs.readFileSync(path.join(root,'node_modules/dictionary-'+lingua,src)));
 for(const nome of ['turndown','hunspell-asm','getroot'])scrivi(path.join(out,nome+'-LICENSE.txt'),fs.readFileSync(path.join(root,'node_modules',nome,'LICENSE')));
 scrivi(path.join(out,'nanoid-LICENSE.txt'),fs.readFileSync(path.join(root,'node_modules/hunspell-asm/node_modules/nanoid/LICENSE')));
 for(const file of ['getroot-LICENSE.txt','hunspell-LICENSE.txt','hunspell-asm-LICENSE.txt','emscripten-wasm-loader-NOTICE.txt','nanoid-LICENSE.txt','turndown-LICENSE.txt','dizionari/it-LICENSE.txt','dizionari/en-LICENSE.txt'])
  scrivi(path.join(root,'App/assets/licenze/appunti-'+path.basename(file)),fs.readFileSync(path.join(out,file)));
 console.log(verifica?'✓ Risorse editor e dizionari corrispondono ai sorgenti':'✓ Risorse editor e dizionari rigenerati');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
