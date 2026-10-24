'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {crea,ambiente}=require('../lib/sicurezza-installazione');
const base=fs.mkdtempSync(path.join(os.tmpdir(),'zaino-installazione-test-'));
const risorse=path.join(base,'risorse'),radice=path.join(base,'privata');
let conteggio=0;function ok(v,msg){assert.ok(v,msg);conteggio++;}
function pacchetto(id){
 const dir=path.join(risorse,'sicurezza-pacchetti',process.platform+'-'+process.arch,id);fs.mkdirSync(path.join(dir,'bin'),{recursive:true});
 const comandi={},files=[];
 for(const nome of id==='qpdf'?['qpdf']:['clamscan','freshclam','sigtool']){const file='bin/'+nome;const contenuto=Buffer.from('#!/bin/sh\nprintf '+nome+'\n');fs.writeFileSync(path.join(dir,file),contenuto,{mode:0o700});comandi[nome]=file;files.push({nome:file,dimensione:contenuto.length,sha256:crypto.createHash('sha256').update(contenuto).digest('hex'),eseguibile:true});}
 if(id==='clamav'){const nome='etc/certs/clamav.crt',bytes=Buffer.from('certificato di prova');fs.mkdirSync(path.join(dir,'etc','certs'),{recursive:true});fs.writeFileSync(path.join(dir,nome),bytes);files.push({nome,dimensione:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});}
 const m={formato:1,id,nome:id,versione:'1.0',piattaforma:process.platform,architettura:process.arch,comandi,files};fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(m));return {dir,m};
}
(async()=>{try{
 const q=pacchetto('qpdf');pacchetto('clamav');let chiamate=[];const progress=[];
 const installer=crea({radice,risorse,onProgress:x=>progress.push(x),esegui:async(bin,args,opts)=>{
  chiamate.push({bin,args,opts});
  if(path.basename(bin)==='freshclam')for(const nome of ['main.cvd','daily.cvd','bytecode.cvd'])fs.writeFileSync(path.join(radice,'firme',nome),Buffer.alloc(1024));
  return {stdout:'Verification OK',stderr:''};
 }});
 ok(installer.stato().motori.every(m=>m.disponibile&&!m.installato),'I motori inclusi sono installabili, non attivi/installati implicitamente.');
 ok(installer.verificaPacchetti(),'Preflight dei pacchetti inclusi.');
 ok(!fs.existsSync(radice),'Leggere lo stato e verificare il pacchetto non creano cartelle.');
 await assert.rejects(installer.installa('../qpdf'),/non valido/);conteggio++;
 const esito=await installer.installa('qpdf');ok(esito.motori[0].installato&&!esito.inCorso,'Installazione finita e verificata.');
 const p=installer.percorsi('qpdf');ok(p.eseguibile.startsWith(radice),'Il comando viene dalla copia privata.');
 ok(progress.length>0&&progress.every(p=>p.id==='qpdf'),'Progresso del motore.');
 fs.writeFileSync(p.eseguibile,'#! alterato');assert.throws(()=>installer.percorsi('qpdf'),/Dimensione|Integrità/);conteggio++;
 ok(!installer.stato().motori[0].installato,'Un binario modificato perde la disponibilità all’esecuzione.');
 await installer.installa('qpdf');
 const originale=fs.readFileSync(p.eseguibile);const diverso=Buffer.from(originale);diverso[0]^=1;fs.writeFileSync(p.eseguibile,diverso);assert.throws(()=>installer.percorsi('qpdf'),/Integrità/);conteggio++;
 await installer.installa('qpdf');fs.unlinkSync(p.eseguibile);fs.symlinkSync(path.join(q.dir,'bin','qpdf'),p.eseguibile);assert.throws(()=>installer.percorsi('qpdf'),/Collegamento/);conteggio++;
 fs.unlinkSync(p.eseguibile);fs.writeFileSync(p.eseguibile,originale);await installer.installa('clamav');
 ok(!installer.stato().firme.pronte,'Installare il motore non finge di avere già le firme.');
 await installer.aggiornaFirme();ok(installer.stato().firme.pronte&&chiamate.length===4,'FreshClam e verifica separata dei tre database.');
 ok(chiamate.every(c=>c.opts.windowsHide&&c.opts.timeout>0&&!c.opts.shell),'Comandi delimitati, timeout e nessuna shell.');
 ok(chiamate[0].args[0].startsWith('--config-file='+radice),'Configurazione privata determinata dal main.');
 const cfg=fs.readFileSync(path.join(radice,'freshclam.conf'),'utf8');ok(cfg.includes('TestDatabases yes')&&!cfg.includes('no-dns'),'Aggiornamenti con verifiche attive.');
 fs.appendFileSync(path.join(radice,'firme','daily.cvd'),'modificato');ok(!installer.stato().firme.pronte,'Firme cambiate invalidano il marcatore.');
 await installer.aggiornaFirme();fs.symlinkSync(path.join(base,'esterno'),path.join(radice,'firme','freshclam.dat'));await assert.rejects(installer.aggiornaFirme(),/Collegamento/);conteggio++;
 fs.writeFileSync(path.join(q.dir,'bin','qpdf'),'contraffatto');ok(!installer.stato().motori[0].disponibile,'Pacchetto incluso alterato non installabile.');await assert.rejects(installer.installa('qpdf'),/Dimensione|Integrità/);conteggio++;
 q.m.files[0].nome='../fuga';fs.writeFileSync(path.join(q.dir,'manifest.json'),JSON.stringify(q.m));ok(!installer.stato().motori[0].disponibile,'Percorso traversal rifiutato nel manifest.');
 const nuovo=pacchetto('qpdf'),f=nuovo.m.files[0],gz=require('node:zlib').gzipSync(fs.readFileSync(path.join(nuovo.dir,f.nome)));f.origine='payload/qpdf.gz';f.sha256Origine=crypto.createHash('sha256').update(gz).digest('hex');f.dimensioneOrigine=gz.length;fs.mkdirSync(path.join(nuovo.dir,'payload'),{recursive:true});fs.writeFileSync(path.join(nuovo.dir,f.origine),gz);fs.writeFileSync(path.join(nuovo.dir,'manifest.json'),JSON.stringify(nuovo.m));
 await installer.installa('qpdf');ok(installer.stato().motori[0].installato,'Payload compresso verificato ed eseguibile dopo installazione.');
 f.sha256='0'.repeat(64);fs.writeFileSync(path.join(nuovo.dir,'manifest.json'),JSON.stringify(nuovo.m));assert.throws(()=>installer.verificaPacchetti(),/payload/);conteggio++;await assert.rejects(installer.installa('qpdf'),/payload/);conteggio++;
 ok(!ambiente(radice).DYLD_LIBRARY_PATH&&!ambiente(radice).NODE_OPTIONS,'Nessuna variabile di iniezione ereditata.');
 const altro=crea({radice:path.join(base,'altro'),risorse,piattaforma:'sconosciuta'});ok(altro.stato().motori.every(m=>!m.disponibile),'Piattaforma senza pacchetto dichiarata indisponibile.');
 console.log('sicurezza-installazione: '+conteggio+' controlli passati');
}finally{fs.rmSync(base,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
