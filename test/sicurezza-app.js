'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const S = require('../lib/sicurezza-app');
const base = { vault:'/vault', appDir:'/app', userData:'/dati', temporanei:'/tmp/privata' };
assert.equal(S.urlEsterna('https://example.org/documento'), true);
for (const u of ['file:///etc/passwd','javascript:alert(1)','data:text/html,x','https://user:pass@example.org','smb://host/share']) assert.equal(S.urlEsterna(u),false,u);
assert.throws(()=>S.privilegi('ignoto:leggi',{},base),/non autorizzat/);
const fromCard=S.privilegi('studio:fromCard',{zaino:'biologia'},base);
assert(fromCard.scrittura.includes('/vault/Zaini/biologia/RIPASSO'));assert(!fromCard.scrittura.includes('/vault/Zaini/biologia/APPUNTI'));assert(!fromCard.scrittura.includes('/vault/Costi'));
const r = S.privilegi('rag:index',{zaino:'biologia'},base);
assert(r.lettura.includes('/vault/Zaini/biologia'));
assert(!r.scrittura.includes('/vault/Zaini/biologia/APPUNTI'));
assert(r.scrittura.includes('/vault/Zaini/biologia/_lavorazione/rag'));
assert.throws(()=>S.privilegi('mappe:salva',{corso:'../../fuori'},base),/non valido/);
const m=S.privilegi('mappe:salva',{corso:'biologia'},base);
assert.deepEqual(m.scrittura,['/vault/Zaini/biologia/MAPPE']);
const p=S.privilegi('vault:sync',{gruppo:'notes',metodo:'leggi',args:['biologia']},base);
assert.deepEqual(p.scrittura,[]);
const w=S.privilegi('vault:sync',{gruppo:'notes',metodo:'save',args:['biologia']},base);
assert.deepEqual(w.scrittura,['/vault/Zaini/biologia/APPUNTI']);
assert.throws(()=>S.privilegi('vault:sync',{gruppo:'notes',metodo:'__proto__',args:['biologia']},base),/non autorizzat/);

// Le policy devono permettere il lavoro vero, non soltanto contenere i nomi
// attesi: ogni operazione seguente usa le librerie reali su un vault temporaneo.
const fs = require('node:fs');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { EventEmitter } = require('node:events');
const D = require('../lib/permessi-disco');
const Z = require('../lib/zaini');
const A = require('../lib/appunti');
const V = require('../lib/vault-sincrono');
const M = require('../lib/mappe');
const G = require('../lib/gruppi-fonti');
const F = require('../lib/fonti');
const C = require('../lib/chat');
const R = require('../lib/rag');
const negato = /Accesso al disco negato/;

async function integrazione() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zaino-policy-'));
  const ctx = { vault:path.join(root,'vault'), appDir:path.join(__dirname,'..'), userData:path.join(root,'dati'), temporanei:path.join(root,'temporanei'), risorse:path.join(root,'risorse-pacchetto') };
  const fuori = path.join(root,'scrivania'), errori = [];
  let auto;
  for (const dir of [ctx.vault,ctx.userData,ctx.temporanei,ctx.risorse,fuori]) fs.mkdirSync(dir);
  const policy = (canale,o) => S.privilegi(canale,o,ctx);
  const con = (canale,o,fn) => D.esegui(policy(canale,o),fn);
  const sync = (gruppo,metodo,...args) => con('vault:sync',{gruppo,metodo,args},()=>V.esegui(ctx.vault,gruppo,metodo,args));
  const prova = async (nome,fn) => {
    try { await fn(); }
    catch(e) { errori.push(nome+': '+(e.stack||e.message)); }
  };
  async function attendi(fn) {
    for (let n=0;n<100;n++) { if(fn())return;await new Promise(resolve=>setTimeout(resolve,10)); }
    throw Error('Stato non raggiunto: '+JSON.stringify(auto?.state()));
  }
  try {
    const creato = con('zaino:create',{},()=>Z.crea(ctx.vault,'Scienze'));
    assert.equal(creato.error,undefined,creato.error);
    const id=creato.id,dir=path.join(ctx.vault,'Zaini',id);
    const originale=path.join(fuori,'01 Biologia.pdf'), nonScelto=path.join(fuori,'Altro.pdf');
    const pdf=await require('pdf-lib').PDFDocument.create();
    pdf.addPage().drawText('Le cellule contengono acqua e utilizzano ATP.');
    const bytes=Buffer.from(await pdf.save());fs.writeFileSync(originale,bytes);fs.writeFileSync(nonScelto,bytes);
    const esterno=path.join(fuori,'privato.txt');fs.writeFileSync(esterno,'Contenuto esterno intatto');
    let nota,mappa,documento,sessione;

    await prova('Crediti packaged: soli metadati della licenza Chromium esterna alla cartella app',()=>{
      const licenza=path.join(ctx.risorse,'LICENSES.chromium.html'),altro=path.join(ctx.risorse,'altro.txt');
      fs.writeFileSync(licenza,'<html>Licenze Chromium</html>');fs.writeFileSync(altro,'Non autorizzato');
      for(const canale of ['crediti:leggi','crediti:chromium'])con(canale,{},()=>{
        assert.equal(D.fs.existsSync(licenza),true);
        assert(D.fs.statSync(licenza).isFile());
        assert.throws(()=>D.fs.readFileSync(licenza),negato);
        assert.throws(()=>D.fs.writeFileSync(licenza,'alterata'),negato);
        assert.throws(()=>D.fs.statSync(altro),negato);
        assert.throws(()=>D.fs.readdirSync(ctx.risorse),negato);
      });
      con('rag:state',{},()=>assert.throws(()=>D.fs.statSync(licenza),negato));
    });

    await prova('Appunti: salvataggio e lettura nel proprio ambito',()=>{
      nota=sync('notes','save',id,'',{title:'Cellule'},'Le cellule usano ATP per le loro attivita.');
      assert(!nota.error,nota.error);assert(nota.file);
      const letto=sync('notes','leggi',id);
      assert(!letto.error,letto.error);assert(letto.notes.some(n=>n.file===nota.file&&n.body.includes('ATP')));
      con('vault:sync',{gruppo:'notes',metodo:'leggi',args:[id]},()=>{
        assert.throws(()=>A.save(ctx.vault,id,nota.file,{title:'Cellule'},'Testo sostituito'),negato);
        assert.throws(()=>D.fs.readFileSync(esterno),negato);
      });
      assert(fs.readFileSync(path.join(dir,'APPUNTI',nota.file),'utf8').includes('ATP'));
    });
    await prova('Mappe: scrittura e apertura senza accesso agli appunti',()=>{
      mappa=con('mappe:salva',{corso:id},()=>M.salva(ctx.vault,id,null,{titolo:'Mappa cellule',nodi:[{id:'n1',testo:'Cellula'}],archi:[]}));
      assert(!mappa.error,mappa.error);
      assert.equal(con('mappe:apri',{corso:id},()=>M.apri(ctx.vault,id,mappa.file)).mappa.titolo,'Mappa cellule');
      con('mappe:salva',{corso:id},()=>assert.throws(()=>D.fs.writeFileSync(path.join(dir,'APPUNTI','estraneo.md'),'vietato'),negato));
    });
    await prova('Importazione: sola lettura del file scelto e copia nello zaino',()=>{
      const p=policy('fonti:importa',{corso:id});p.lettura.push(originale);
      const importato=D.esegui(p,()=>{
        assert.throws(()=>D.fs.writeFileSync(originale,'vietato'),negato);
        assert.throws(()=>D.fs.readFileSync(nonScelto),negato);
        return F.importa(ctx.vault,id,[originale]);
      });
      assert(!importato.error,importato.error);assert.equal(importato.copiati.length,1,JSON.stringify(importato));
      documento=importato.copiati[0].nome;
      assert.deepEqual(fs.readFileSync(originale),bytes);
      assert.deepEqual(fs.readFileSync(path.join(dir,'MATERIALI','PDF',documento)),bytes);
      const senzaScelta=con('fonti:importa',{corso:id},()=>F.importa(ctx.vault,id,[nonScelto]));
      assert.equal(senzaScelta.copiati.length,0,'Nessuna lettura esterna implicita per importare');
    });
    for (const sezione of ['fonti','media','appunti','mappe']) {
      await prova('Gruppi '+sezione+': scrittura e riapertura del registro reale',()=>{
        const o={corso:id,sezione};
        const prima=con('zaino:gruppi-leggi',o,()=>G.leggi(ctx.vault,id,sezione));assert(!prima.error,prima.error);
        const presi=prima.stato.liberi.slice(0,1);
        const stato={versione:1,gruppi:[{id:'g-'+sezione,nome:'Gruppo '+sezione,chiuso:false,files:presi}],liberi:prima.stato.liberi.slice(1)};
        const salvato=con('zaino:gruppi-salva',o,()=>G.salva(ctx.vault,id,stato,sezione));assert(!salvato.error,salvato.error);
        const dopo=con('zaino:gruppi-leggi',o,()=>G.leggi(ctx.vault,id,sezione));assert(!dopo.error,dopo.error);
        assert(dopo.stato.gruppi.some(g=>g.id==='g-'+sezione));
        if(sezione==='fonti'&&documento)assert(fs.existsSync(path.join(dir,'MATERIALI','PDF','Gruppi','Gruppo fonti',documento)));
      });
    }
    await prova('Chat: creazione, persistenza e sola lettura della cronologia',()=>{
      sessione=con('chat:create',{zaino:id},()=>C.crea(ctx.vault,id,{role:'socratico'}));assert(sessione.id);
      const letta=con('chat:read',{zaino:id},()=>C.leggi(ctx.vault,id,sessione.id));assert.equal(letta.id,sessione.id);
      con('chat:read',{zaino:id},()=>assert.throws(()=>C.rinomina(ctx.vault,id,sessione.id,'Non autorizzata'),negato));
    });
    await prova('AI e indice: nessuna scrittura sulle fonti o sugli appunti originali',()=>{
      assert(documento&&nota?.file,'Materiali preparati dalla prova');
      const fonte=F.percorso(ctx.vault,id,documento),appunto=path.join(dir,'APPUNTI',nota.file);
      for(const canale of ['chat:send','rag:index','studio:analyze']) con(canale,{zaino:id},()=>{
        assert.throws(()=>D.fs.writeFileSync(fonte,'vietato'),negato,canale);
        assert.throws(()=>D.fs.writeFileSync(appunto,'vietato'),negato,canale);
        assert.throws(()=>D.fs.readFileSync(esterno),negato,canale);
      });
      assert.deepEqual(fs.readFileSync(fonte),bytes);
    });
    await prova('Gruppi: spostamento dei PDF dal percorso storico Documenti',()=>{
      const storico=path.join(dir,'MATERIALI','Documenti','0099 - Vecchio.pdf');fs.mkdirSync(path.dirname(storico));fs.writeFileSync(storico,bytes);
      const o={corso:id,sezione:'fonti'};
      const prima=con('zaino:gruppi-leggi',o,()=>G.leggi(ctx.vault,id,'fonti'));assert(!prima.error,prima.error);
      const stato=prima.stato;stato.gruppi.push({id:'storico',nome:'Storico',chiuso:false,files:[path.basename(storico)]});
      stato.liberi=stato.liberi.filter(f=>f!==path.basename(storico));
      const r=con('zaino:gruppi-salva',o,()=>G.salva(ctx.vault,id,stato,'fonti'));assert(!r.error,r.error);
      assert(fs.existsSync(path.join(dir,'MATERIALI','PDF','Gruppi','Storico',path.basename(storico))));
      assert(!fs.existsSync(storico));
    });
    await prova('IPC: sender, id, scelte e sottocartelle sono convalidati prima delle librerie',async()=>{
      const handles=new Map(),events=new Map(),appFile=pathToFileURL(path.join(ctx.appDir,'App','StudIA.html')).href;
      const wc={id:7,mainFrame:{url:appFile}},evento={sender:wc,senderFrame:wc.mainFrame};
      const ipc={handle:(c,fn)=>handles.set(c,fn),on:(c,fn)=>events.set(c,fn)};
      S.registra({ipcMain:ipc,contesto:()=>ctx,finestra:()=>({isDestroyed:()=>false,webContents:wc}),appFile,concessioni:{ha:(_id,f)=>f===originale}});
      ipc.handle('fonti:importa',(_e,o)=>F.importa(ctx.vault,o.corso,o.percorsi));
      ipc.handle('mappe:salva',(_e,o)=>M.salva(ctx.vault,o.corso,null,{titolo:'IPC',nodi:[],archi:[]}));
      ipc.on('vault:sync',(e,o)=>{e.returnValue=V.esegui(ctx.vault,o.gruppo,o.metodo,o.args);});
      const negata=await handles.get('fonti:importa')(evento,{corso:id,percorsi:[nonScelto]});assert.equal(negata.ok,false);assert.match(negata.error,/selezionati/);
      const straniero=await handles.get('mappe:salva')({sender:{id:8},senderFrame:wc.mainFrame},{corso:id});assert.equal(straniero.ok,false);
      const frame=await handles.get('mappe:salva')({sender:wc,senderFrame:{url:appFile}},{corso:id});assert.equal(frame.ok,false);
      assert.equal((await handles.get('mappe:salva')(evento,{corso:'../../altro'})).ok,false);
      const idLink=con('zaino:create',{},()=>Z.crea(ctx.vault,'Link di prova')).id;
      const cartella=path.join(ctx.vault,'Zaini',idLink,'APPUNTI');fs.rmdirSync(cartella);fs.symlinkSync(fuori,cartella,'dir');
      const e={...evento};events.get('vault:sync')(e,{gruppo:'notes',metodo:'save',args:[idLink,'',{title:'No'},'Non deve uscire']});
      assert.equal(e.returnValue.ok,false);assert.match(e.returnValue.error,/negato/);assert(!fs.existsSync(path.join(fuori,'No.md')));
    });
    await prova('Indice automatico: cache reale e scope conservato dopo download e ripresa',async()=>{
      const z=con('zaino:create',{},()=>Z.crea(ctx.vault,'Indice locale')).id;
      const n=sync('notes','save',z,'',{title:'Energia'},'Le cellule utilizzano ATP per trasportare energia.');assert(!n.error,n.error);
      let ready=false,modelli=0;
      const runtime={ready:()=>ready,embed:async()=>{modelli++;return {vector:[1,...Array(767).fill(0)]};}};
      auto=con('rag:watch',{zaino:z},()=>require('../lib/rag-automatico').crea({vault:ctx.vault,zaino:z,runtime,delay:5,watch:()=>{const w=new EventEmitter();w.close=()=>{};return w;}}));
      await attendi(()=>auto.state().phase==='waiting-model');
      ready=true;con('rag:install',{},()=>auto.request(true));
      await attendi(()=>['ready','warning','error'].includes(auto.state().phase));
      assert.equal(auto.state().phase,'ready',JSON.stringify(auto.state()));assert(modelli>0);
      assert.equal(auto.state().indice.current,true);
      assert(fs.existsSync(path.join(ctx.vault,'Zaini',z,'_lavorazione','rag','indice.json')));
      const risultato=await con('rag:search',{zaino:z},()=>R.cerca(ctx.vault,z,'energia',{runtime}));assert.equal(risultato.mode,'ibrida');
      await auto.pause();con('rag:install',{},()=>auto.resume());
      await attendi(()=>['ready','warning','error'].includes(auto.state().phase));assert.equal(auto.state().phase,'ready',JSON.stringify(auto.state()));
      await auto.close();auto=null;
    });
    assert.equal(fs.readFileSync(esterno,'utf8'),'Contenuto esterno intatto');
    if(errori.length)throw Error(errori.join('\n\n'));
    console.log('✓ Privilegi reali: appunti, mappe, gruppi, import, chat, indice automatico, sender e rifiuti fuori ambito');
  } finally {await auto?.close();fs.rmSync(root,{recursive:true,force:true});}
}
integrazione().catch(error=>{console.error(error);process.exitCode=1;});
