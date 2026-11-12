'use strict';
// Prova del medesimo bundle del worker distribuito, con dizionari locali.
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../App/assets/appunti/vendor');
const ricevute=new Map();
const contesto={URL,Uint8Array,Int8Array,Uint16Array,Int16Array,Uint32Array,Int32Array,Float32Array,Float64Array,ArrayBuffer,WebAssembly,TextDecoder,TextEncoder,console,setTimeout,clearTimeout,performance,crypto:require('node:crypto').webcrypto};
contesto.self=contesto;contesto.global=contesto;contesto.importScripts=()=>{};contesto.atob=atob;contesto.location={href:'file://'+root+'/ortografia-worker.js'};
contesto.fetch=async url=>({ok:true,arrayBuffer:async()=>fs.readFileSync(url)});
contesto.postMessage=m=>{const p=ricevute.get(m.id);if(m.errore)p.reject(Error(m.errore));else p.resolve(m.risultato);ricevute.delete(m.id);};
let id=0;
function chiedi(dati){return new Promise((resolve,reject)=>{ricevute.set(++id,{resolve,reject});contesto.onmessage({data:{id,...dati}});});}
(async()=>{
 vm.runInNewContext(fs.readFileSync(path.join(root,'ortografia-worker.js'),'utf8'),contesto,{filename:'ortografia-worker.js'});
 A.deepEqual(Array.from(await chiedi({lingua:'it',parole:['perché','città',"dell’acqua",'conoscenza','fotosintesi','mitocondri','conoscienza']})),['conoscienza']);
 A((await chiedi({lingua:'it',parola:'conoscienza'})).includes('conoscenza'));
 A.deepEqual(Array.from(await chiedi({lingua:'en',parole:['knowledge','color','photosynthesis','knowlege','recieve']})),['knowlege','recieve']);
 A((await chiedi({lingua:'en',parola:'recieve'})).includes('receive'));
 A.deepEqual(Array.from(await chiedi({lingua:'it-en',parole:['conoscenza','knowledge','knowlege']})),['knowlege']);
 const enc=new TextEncoder();
 A.deepEqual(Array.from(await chiedi({lingua:'it-fr',dizionari:[{id:'fr',aff:enc.encode('SET UTF-8\n'),dic:enc.encode('2\nbonjour\nécole\n')}],parole:['conoscenza','bonjour','école','bonjouur']})),['bonjouur']);
 await A.rejects(chiedi({lingua:'../altra',parole:[]}),/Lingua non valida/);
 console.log('✓ Dizionari IT/EN: accenti, apostrofi, lessico scolastico, suggerimenti e bilingue (campione di regressione, non graduatoria di qualità)');
})().catch(e=>{console.error(e);process.exitCode=1;});
