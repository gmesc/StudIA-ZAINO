'use strict';
const path=require('node:path'),fs=require('node:fs');
(async()=>{
 const out=path.join(__dirname,'../App/assets/lim/vendor');fs.mkdirSync(out,{recursive:true});
 await require('esbuild').build({entryPoints:[path.join(__dirname,'../App/assets/lim/editor.jsx')],outfile:path.join(out,'excalidraw.js'),bundle:true,format:'iife',platform:'browser',minify:true,target:['chrome138'],conditions:['production'],define:{'process.env.NODE_ENV':'"production"','process.env.IS_PREACT':'"false"'},loader:{'.woff2':'file'},assetNames:'fonts/[name]-[hash]',legalComments:'external'});
 // Excalidraw include la configurazione Firebase pubblica della propria demo.
 // ZAINO salva in locale: la rimuoviamo, senza trascinare servizi o chiavi upstream.
 const bundle=path.join(out,'excalidraw.js'),codice=fs.readFileSync(bundle,'utf8').replace(/VITE_APP_FIREBASE_CONFIG:'[^']*'/g,"VITE_APP_FIREBASE_CONFIG:'{}'");
 if(/AIza[0-9A-Za-z_-]{35}/.test(codice))throw Error('Il bundle LIM contiene ancora una chiave Google: distribuzione interrotta.');
 fs.writeFileSync(bundle,codice);
 fs.cpSync(path.join(__dirname,'../node_modules/@excalidraw/excalidraw/dist/prod/fonts'),path.join(out,'fonts'),{recursive:true});
 console.log('Editor Excalidraw locale generato.');
})().catch(e=>{console.error(e);process.exitCode=1;});
