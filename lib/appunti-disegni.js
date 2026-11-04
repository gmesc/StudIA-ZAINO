'use strict';
// Ogni aggiornamento crea un PNG nuovo: Undo e altri appunti conservano l'originale.
const path=require('node:path'),{randomUUID}=require('node:crypto'),{pathToFileURL}=require('node:url');
const D=require('./permessi-disco'),fs=D.fs,F=require('./fonti-ai'),A=require('./appunti'),S=require('./formati-sicuri');
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function file(v,z,id){if(!ID.test(id))throw Error('Disegno non valido.');F.verifica(v,z);return D.percorso(v,path.join(A.dir(v,z),'_disegni',id+'.png'));}
function bytes(p){if(fs.statSync(p).size>24*1024*1024)throw Error('Disegno troppo grande.');const b=fs.readFileSync(p);verifica(b);return b;}
function verifica(b){const r=S.verificaBuffer(b,'.png',{estensioni:['.png']});if(!r.ok)throw Error(r.error);if(b.length>24*1024*1024||b.length<24||b.readUInt32BE(16)<1||b.readUInt32BE(20)<1||b.readUInt32BE(16)>10000||b.readUInt32BE(20)>10000)throw Error('Disegno troppo grande.');}
function salva(v,z,dati){if(typeof dati!=='string'||dati.length>34*1024*1024||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(dati))throw Error('Immagine del disegno non valida.');const b=Buffer.from(dati.split(',')[1],'base64');verifica(b);if(!b.includes(Buffer.from('application/vnd.excalidraw+json')))throw Error('Il PNG non contiene i dati modificabili Excalidraw.');const id=randomUUID(),p=file(v,z,id);fs.mkdirSync(path.dirname(p),{recursive:true});A.writeAtomic(p,b);return {ok:true,id,src:'_disegni/'+id+'.png'};}
function leggi(v,z,id){return {ok:true,dati:'data:image/png;base64,'+bytes(file(v,z,id)).toString('base64')};}
function srcUrl(v,z,id,o={}){const p=file(v,z,id);bytes(p);return o.urlPerFile?o.urlPerFile(p):pathToFileURL(p).href;}
module.exports={salva,leggi,srcUrl};
