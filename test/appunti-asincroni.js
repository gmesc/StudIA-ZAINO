'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const A=require('../lib/appunti'),D=require('../lib/permessi-disco'),S=require('../lib/sicurezza-app');
(async()=>{
 assert.equal(typeof A.saveAsync,'function','il salvataggio deve offrire I/O asincrono');
 const v=fs.mkdtempSync(path.join(os.tmpdir(),'studia-note-async-'));
 try{
  require('../lib/zaini').crea(v,'Prova');
  const r=A.save(v,'prova',null,{title:'Prima'},'Prima riga\nTesto iniziale lungo.');
  const altra=A.save(v,'prova',null,{title:'Altra'},'Da conservare');
  const d=A.dir(v,'prova'),indice=path.join(d,'_indice.md'),prima=fs.readFileSync(indice,'utf8');
  const policy=S.privilegi('note:salva',{corso:'prova'},{vault:v,appDir:path.join(__dirname,'..'),userData:v,temporanei:v});
  assert.deepEqual(policy.scrittura,[d]);
  assert.deepEqual(S.privilegi('note:flush',{corso:'prova'},{vault:v,appDir:path.join(__dirname,'..'),userData:v,temporanei:v}).scrittura,[d]);
  // Se il percorso tornasse a sincrono, il disco lento bloccherebbe anche il timer.
  const write=fs.writeFileSync,read=fs.readFileSync,reale=fs.realpathSync(d);let giri=0;
  const dentro=p=>String(p).startsWith(d+path.sep)||String(p).startsWith(reale+path.sep);
  fs.writeFileSync=(p,...a)=>{if(dentro(p))throw Error('scrittura sincrona durante autosave');return write(p,...a);};
  fs.readFileSync=(p,...a)=>{if(dentro(p))throw Error('rilettura sincrona durante autosave');return read(p,...a);};
  let salvato;
  try{const timer=setInterval(()=>giri++,0);try{salvato=await D.esegui(policy,()=>A.saveAsync(v,'prova',r.file,{title:'Prima'},'Prima riga\nTesto aggiornato molto più lungo.'));}finally{clearInterval(timer);}}
  finally{fs.writeFileSync=write;fs.readFileSync=read;}
  assert(giri>0,'il main deve poter servire altri eventi durante la scrittura');
  assert.equal(salvato.nota.body,'Prima riga\nTesto aggiornato molto più lungo.\n');
  assert.equal(fs.readFileSync(indice,'utf8'),prima,'corpo diverso con stesso riepilogo: indice invariato');
  // Il resto della cartella non viene aperto: anche un altro file guasto non
  // impedisce di aggiornare la sola riga dell’appunto corrente.
  fs.renameSync(path.join(d,altra.file),path.join(d,'_altro-temporaneo.md'));
  await D.esegui(policy,()=>A.saveAsync(v,'prova',r.file,{title:'Prima'},'Riga modificata\nTesto aggiornato molto più lungo.'));
  const aggiornato=fs.readFileSync(indice,'utf8');assert(aggiornato.includes('Riga modificata'));assert(aggiornato.includes(altra.file));
  fs.renameSync(path.join(d,'_altro-temporaneo.md'),path.join(d,altra.file));
  fs.unlinkSync(indice);
  await D.esegui(policy,()=>A.saveAsync(v,'prova',r.file,{title:'Prima'},'Riga modificata\nTesto aggiornato molto più lungo.'));
  assert(fs.readFileSync(indice,'utf8').includes(altra.file),'indice mancante ricostruito dalle note reali');
  const primaErrore=fs.readFileSync(path.join(d,r.file),'utf8'),rename=fs.promises.rename;
  fs.promises.rename=async(a,b)=>{if(path.basename(b)===r.file)throw Error('disco non disponibile');return rename(a,b);};
  try{await assert.rejects(D.esegui(policy,()=>A.saveAsync(v,'prova',r.file,{title:'Prima'},'Riga modificata\nTesto aggiornato molto più lungo. Ancora.')),/disco non disponibile/);}
  finally{fs.promises.rename=rename;}
  assert.equal(fs.readFileSync(path.join(d,r.file),'utf8'),primaErrore);
  assert(!fs.readdirSync(d).some(f=>f.includes('.tmp-')),'temporanei rimossi dopo errore');
  const no=await D.esegui(policy,()=>A.saveAsync(v,'prova',r.file,{title:'Prima'},''));assert(no.error);assert(A.apri(v,'prova',r.file).nota.body.includes('Riga modificata'));
  await D.esegui(policy,()=>A.saveAsync(v,'prova',r.file,{title:'Prima'},'Breve'));
  assert(A.versioni(v,'prova',r.file).length,'le versioni restano conservate quando il testo si accorcia');
  await D.esegui(policy,()=>A.saveAsync(v,'prova',r.file,{title:'Prima'},'',null,{svuota:true}));
  assert.equal(A.apri(v,'prova',r.file).nota.body.trim(),'');
  await assert.rejects(D.esegui(policy,()=>A.saveAsync(v,'prova','../altro.md',{},'male')),/non valido/);
  const esterno=path.join(v,'esterno.md');fs.writeFileSync(esterno,'intatto');fs.symlinkSync(esterno,path.join(d,'link.md'));
  await assert.rejects(D.esegui(policy,()=>A.saveAsync(v,'prova','link.md',{},'male')));assert.equal(fs.readFileSync(esterno,'utf8'),'intatto');
  const Q=require('../lib/appunti-coda').crea();let libera;const ordine=[];
  const a=Q.esegui(v,'prova',async()=>{ordine.push('vecchio');await new Promise(r=>libera=r);});
  await new Promise(setImmediate);
  const b=Q.esegui(v,'prova',()=>ordine.push('ultimo'));
  const c=Q.esegui(v,'prova',()=>ordine.push('rinomina o chiusura'));
  await new Promise(setImmediate);assert.deepEqual(ordine,['vecchio']);libera();await Promise.all([a,b,c]);assert.deepEqual(ordine,['vecchio','ultimo','rinomina o chiusura']);
  await assert.rejects(Q.esegui(v,'prova',()=>{throw Error('disco');}));assert.equal(await Q.esegui(v,'prova',()=>42),42,'un errore non avvelena la coda');
  console.log('✓ I/O asincrono, indice mirato, versioni, errori, permessi e scritture ordinate');
 }finally{fs.rmSync(v,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
