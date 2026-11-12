'use strict';
// Lo stesso validatore dell'importazione, utilizzabile dalla community e in CI.
const fs=require('node:fs'),V=require('../lib/stili-community');
try{
 const file=process.argv[2];if(!file||process.argv.length!==3)throw Error('Uso: node bin/verifica-stile.js /percorso/stile.zaino-stile.json');
 if(fs.statSync(file).size>3*1024*1024)throw Error('Il file supera 3 MiB.');
 const raw=fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''),tipo=JSON.parse(raw)?.tipo,p=V.leggi(raw,tipo);
 console.log('✓ '+p.nome+' · '+p.tipo+' · formato '+p.versione);
}catch(e){console.error('Stile non valido: '+e.message);process.exitCode=1;}
