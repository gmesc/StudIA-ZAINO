'use strict';
// Le immagini non consumano la quota localStorage; il catalogo resta nel profilo.
const path=require('node:path'),D=require('./permessi-disco'),fs=D.fs,R=require('../App/assets/interfaccia/stili-raccolta');
const LIMITE=32*1024*1024;
function file(dir){return D.percorso(dir,path.join(dir,'raccolta.json'));}
function leggi(dir){const p=file(dir);if(!fs.existsSync(p))return null;if(fs.statSync(p).size>LIMITE)throw Error('La raccolta TUNING supera 32 MiB.');const raw=fs.readFileSync(p,'utf8');R.leggi(raw);return raw;}
function salva(dir,raw){if(typeof raw!=='string'||Buffer.byteLength(raw)>LIMITE)throw Error('La raccolta TUNING supera 32 MiB: esporta e rimuovi gli stili che non usi.');R.leggi(raw);const p=file(dir);fs.mkdirSync(dir,{recursive:true});require('./appunti').writeAtomic(p,raw);return {ok:true};}
module.exports={leggi,salva};
