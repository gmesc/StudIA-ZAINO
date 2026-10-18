'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{createHash}=require('node:crypto'),{Readable}=require('node:stream');
const M=require('../lib/rag-modello'),original=M.FILES.slice(),root=fs.mkdtempSync(path.join(os.tmpdir(),'rag-download-'));
(async()=>{
 const bytes=Buffer.from('modello locale completo'),hash=createHash('sha256').update(bytes).digest('hex');M.FILES.splice(0,M.FILES.length,['tiny.bin',bytes.length,'sha256',hash]);
 fs.writeFileSync(path.join(root,'tiny.bin.part'),bytes.subarray(0,7));let calls=0;
 await M.installa(root,{fetch:async(url,o)=>{calls++;assert.equal(o.headers.Range,'bytes=7-');return {ok:true,status:206,headers:new Map([['content-range','bytes 7-'+(bytes.length-1)+'/'+bytes.length]]),body:Readable.from([bytes.subarray(7)])};}});
 assert.equal(calls,1);assert(M.pronto(root));await M.verifica(root);
 await M.installa(root,{fetch:()=>{throw Error('Non riscaricare file verificati.');}});
 fs.writeFileSync(path.join(root,'tiny.bin'),'corrotto');assert.equal(M.pronto(root),false);await assert.rejects(M.verifica(root));
 fs.unlinkSync(path.join(root,'tiny.bin'));
 await assert.rejects(M.installa(root,{fetch:async()=>({ok:true,status:200,headers:new Map(),body:Readable.from([Buffer.alloc(bytes.length)])})}),/Checksum/);
 assert(!fs.existsSync(path.join(root,'tiny.bin.part')));
 const ctrl=new AbortController();ctrl.abort();await assert.rejects(M.installa(root,{signal:ctrl.signal,fetch:()=>{throw Error('Non accedere alla rete dopo annullamento');}}),/interrotto/);
 console.log('rag-modello: ripresa Range, checksum, file corrotti, nessun download ripetuto e annullamento OK');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{M.FILES.splice(0,M.FILES.length,...original);fs.rmSync(root,{recursive:true,force:true});});
