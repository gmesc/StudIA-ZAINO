'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const D=require('../lib/dizionari'),P=require('../lib/permessi-disco'),S=require('../lib/sicurezza-app');
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zaino-dizionari-')),base=path.join(root,'dizionari'),d=D.catalogo[0],prima=d.files;
 const dati={'index.aff':Buffer.from('SET UTF-8\n'),'index.dic':Buffer.from('2\nbonjour\nécole\n'),license:Buffer.from('Licenza della fixture di prova\n')};
 d.files=Object.entries(dati).map(([nome,b])=>({nome,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')}));
 const ctx={vault:root,appDir:path.resolve(__dirname,'..'),userData:root,temporanei:root};
 const run=(canale,fn)=>P.esegui(S.privilegi(canale,{},ctx),fn);
 try{
  A.deepEqual(D.elenco(base).filter(d=>d.installato).map(d=>d.id),['it','en']);
  await A.rejects(D.installa(base,'../../fuori'),/catalogo/);
  await A.rejects(run('dizionari:scarica',()=>D.installa(base,'fr',async()=>new Response('alterato'))),/integro|Dimensione/);
  A.equal(D.elenco(base).find(d=>d.id==='fr').installato,false);
  A.deepEqual(fs.readdirSync(base),[],'nessuna installazione parziale');
  let richieste=0;
  const fetchFixture=async u=>{richieste++;A(u.startsWith('https://raw.githubusercontent.com/wooorm/dictionaries/'+d.rev+'/dictionaries/fr/'));return new Response(dati[u.split('/').at(-1)]);};
  await Promise.all([run('dizionari:scarica',()=>D.installa(base,'fr',fetchFixture)),run('dizionari:scarica',()=>D.installa(base,'fr',fetchFixture))]);
  A.equal(richieste,3,'download concorrenti condiviso');A(D.elenco(base).find(d=>d.id==='fr').installato);
  const r=run('dizionari:dati',()=>D.dati(base,'fr'));A.equal(Buffer.from(r.dic).toString(),'2\nbonjour\nécole\n');
  await run('dizionari:scarica',()=>D.installa(base,'fr',()=>{throw Error('non deve richiedere rete');}));
  A.throws(()=>run('dizionari:catalogo',()=>P.fs.writeFileSync(path.join(base,'vietato'),'x')),/negato/);
  A.throws(()=>run('dizionari:scarica',()=>P.fs.writeFileSync(path.join(root,'appunto.md'),'x')),/negato/);
  fs.writeFileSync(path.join(base,'fr-'+d.rev,'index.dic'),'corrotto');A.throws(()=>D.dati(base,'fr'),/Scarica/);
  console.log('✓ Dizionari: integrità, download atomico/condiviso, offline e permessi limitati al catalogo');
 }finally{d.files=prima;fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
