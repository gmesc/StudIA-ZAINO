'use strict';
// Runtime vendorizzato e verificabile: il bundle desktop non dipende da una CDN.
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const root=path.join(__dirname,'..'),out=path.join(root,'App/assets/presentazioni/vendor');
const hash=b=>createHash('sha256').update(b).digest('hex');
function sorgenti(){
 const files=[['animejs/dist/bundles/anime.umd.min.js','anime.js'],['animejs/LICENSE.md','licenze/anime.txt'],['reveal.js/dist/reveal.js','reveal.js'],['reveal.js/dist/reveal.css','reveal.css'],['reveal.js/dist/plugin/math.js','math.js'],['reveal.js/LICENSE','licenze/reveal.txt'],['katex/LICENSE','licenze/katex.txt']];
 for(const nome of ['katex.min.js','katex.min.css','contrib/auto-render.min.js'])files.push(['katex/dist/'+nome,'katex/dist/'+nome]);
 for(const nome of fs.readdirSync(path.join(root,'node_modules/katex/dist/fonts')))files.push(['katex/dist/fonts/'+nome,'katex/dist/fonts/'+nome]);
 return files.map(([src,dest])=>({src:path.join(root,'node_modules',src),dest}));
}
function genera(verifica=false){
 const files=sorgenti(),manifest={version:1,anime:JSON.parse(fs.readFileSync(path.join(root,'node_modules/animejs/package.json'))).version,reveal:JSON.parse(fs.readFileSync(path.join(root,'node_modules/reveal.js/package.json'))).version,katex:JSON.parse(fs.readFileSync(path.join(root,'node_modules/katex/package.json'))).version,files:{}};
 for(const f of files){const bytes=fs.readFileSync(f.src);manifest.files[f.dest]=hash(bytes);const dest=path.join(out,f.dest);
  if(verifica){if(!fs.existsSync(dest)||hash(fs.readFileSync(dest))!==manifest.files[f.dest])throw Error('Runtime PRESENTA da rigenerare: '+f.dest);}
  else{fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);}
 }
 const testo=JSON.stringify(manifest,null,2)+'\n',p=path.join(out,'manifest.json');
 if(verifica){if(fs.readFileSync(p,'utf8')!==testo)throw Error('Manifest runtime PRESENTA non aggiornato.');}
 else fs.writeFileSync(p,testo);
 return manifest;
}
if(require.main===module){const m=genera(process.argv.includes('--verifica'));console.log('Runtime locale PRESENTA: Reveal.js '+m.reveal+', KaTeX '+m.katex+'.');}
module.exports={genera,out};
