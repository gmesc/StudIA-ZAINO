'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const Z=require('../lib/zaini'),R=require('../App/assets/rimandi/sintassi');
const v=fs.mkdtempSync(path.join(os.tmpdir(),'zaino-citazioni-'));
(async()=>{try{
 assert.equal(typeof R.scriviPdfZaino,'function','grammatica unica per citazioni tra zaini');
 const C=require('../lib/citazioni-zaini'),D=require('../lib/permessi-disco'),S=require('../lib/sicurezza-app');
 const ctx={vault:v,appDir:path.resolve(__dirname,'..'),userData:v,temporanei:v};
 const esegui=(azione,o,fn)=>D.esegui(S.privilegi('citazioni:'+azione,o,ctx),fn);
 Z.crea(v,'Origine','2026-01-01');Z.crea(v,'Destinazione','2026-02-01');
 const p=path.join(v,'Zaini/origine/MATERIALI/PDF/01 Fonte.pdf');
 fs.writeFileSync(p,'%PDF-1.4\ncontenuto originale');
 const cita=esegui('crea',{zaino:'origine'},()=>C.crea(v,'origine',path.basename(p),3,'Estratto scelto.'));
 assert.equal(cita.status,'available');assert(cita.markdown.includes('Origine › Fonte.pdf · p. 3'));assert(!cita.markdown.includes('01 Fonte.pdf'));
 const rif=R.leggi(cita.rimando);assert.equal(rif.tipo,'pdf-zaino');assert.equal(rif.pagina,3);
 const intero=R.scriviPdfZaino(rif.zainoId,rif.sourceId,null,rif.revision);
 assert.equal(R.leggi(intero)?.intero,true,'rimando al documento intero');
 const selezione={inizio:12,testo:'DAG (2) — già [qui] & là'};
 const puntuale=R.scriviPdfZaino(rif.zainoId,rif.sourceId,3,rif.revision,selezione);
 assert(!puntuale.includes('('),'parentesi codificate per il markdown');
 assert.deepEqual(R.leggi(puntuale).selezione,selezione);
 assert.deepEqual(R.leggi(puntuale.replaceAll('&','&amp;')).selezione,selezione);
 assert.equal(R.leggi(puntuale.replace(/q=[^&]+/,'q=%ZZ')),null,'encoding malformato rifiutato');
 assert.deepEqual(R.trovaSelezione('prima DAG dopo DAG',{inizio:15,testo:'DAG'}),{inizio:15,fine:18},'riconosce la seconda occorrenza');
 assert.equal(R.trovaSelezione('DAG e DAG',{inizio:30,testo:'DAG'}),null,'mai scegliere una frase ambigua');
 assert.deepEqual(R.trovaSelezione('prima DAG dopo',{inizio:0,testo:'DAG'}),{inizio:6,fine:9},'ripiego univoco');
 for(const [rimando,testo,titolo] of [[intero,'','Fonte.pdf'],[cita.rimando,'','Fonte.pdf; p. 3'],[puntuale,'DAG su due\nrighe','Fonte.pdf; p. 3']]){
  const md=R.citazionePdfZaino({...cita,rimando},testo);
  assert(md.split('\n').every(l=>l.startsWith('> ')),'un blocco unico include anche il link');assert.equal(md.split('\n').at(-2).trimEnd(),'> '+titolo,'titolo senza numero d’importazione');
  const html=require('../lib/reader-parser').load().mdToHtml(md,true);
  assert(/<blockquote>[\s\S]*data-citazione-zaino=[\s\S]*<\/blockquote>/.test(html),'link dentro la stessa barra');
  if(testo)assert(html.includes('<em>DAG su due</em>'),'estratto in corsivo');
  assert(html.includes(rimando.replaceAll('&','&amp;')),'il renderer preserva il rimando completo');
 }
 const vecchia='> DAG\n\n'+R.link('Origine › 01 Fonte.pdf · p. 3',cita.rimando);
 const normalizzata=R.normalizzaCitazioni(vecchia);
 assert.equal(normalizzata.split('\n').length,vecchia.split('\n').length,'coordinate degli appunti conservate');
 assert(normalizzata.split('\n').every(l=>l.startsWith('>')),'barra continua anche sulle citazioni precedenti');
 const codice='```\n'+vecchia+'\n```';assert.equal(R.normalizzaCitazioni(codice),codice,'codice letterale invariato');
 const precedente='> *Estratto*  \n> 01 Fonte.pdf; p. 3  \n> '+R.link('Origine › 01 Fonte.pdf · p. 3',cita.rimando);
 const resa=R.normalizzaCitazioni(precedente);assert.equal(resa.split('\n')[1],'> Fonte.pdf; p. 3  ','anche il titolo delle citazioni esistenti perde solo il numero interno');assert.equal(resa.split('\n')[2],'> '+R.link('Origine › Fonte.pdf · p. 3',cita.rimando),'testo del link pulito, indirizzo originale invariato');
 assert.equal(resa.split('\n').length,precedente.split('\n').length,'righe conservate');assert.equal(R.normalizzaCitazioni(resa),resa,'resa idempotente');
 assert.equal(R.normalizzaCitazioni('```\n'+precedente+'\n```'),'```\n'+precedente+'\n```','nessuna normalizzazione nel codice');
 for(const [file,titolo] of [['0001 - 2026 orario.pdf','2026 orario.pdf'],['1984.pdf','1984.pdf'],['12 orario 1C.pdf','orario 1C.pdf'],['12 Budget $&.pdf','Budget $&.pdf']]){
  const md=R.citazionePdfZaino({...cita,file},'');assert.equal(md.split('\n')[0].trimEnd(),'> '+titolo+'; p. 3');assert.equal(md.split('\n')[1],'> '+R.link('Origine › '+titolo+' · p. 3',cita.rimando));
  for(const rimando of [intero,puntuale]){const ref=R.leggi(rimando),label='Origine › '+file+(ref.intero?'':' · p. 3'),old=R.link(label,rimando);const nuovo=R.normalizzaCitazioni(old);assert.equal(nuovo,'> '+R.link('Origine › '+titolo+(ref.intero?'':' · p. 3'),rimando),'nomi puliti anche nelle citazioni precedenti, senza toccare la destinazione');assert.deepEqual(R.leggi(/\]\((.+)\)/.exec(nuovo)[1]),ref);}
 }
 const personale=R.link('Un titolo scelto da me',cita.rimando);assert.equal(R.normalizzaCitazioni(personale),'> '+personale,'etichetta personalizzata conservata');

 assert.equal(R.leggi(cita.rimando.replace('#p=3','#p=0')),null);
 assert.equal(R.leggi(cita.rimando.replace(rif.zainoId,'../fuori')),null);
 assert.equal(R.leggi(cita.rimando+'&altro=1'),null);
 const leggi=()=>esegui('risolvi',{},()=>C.risolvi(v,cita.rimando));
 assert.equal(leggi().file,'01 Fonte.pdf');
 assert.equal(esegui('risolvi',{},()=>C.risolvi(v,intero)).intero,true);
 assert.deepEqual(esegui('risolvi',{},()=>C.risolvi(v,puntuale)).selezione,selezione);
 assert.equal(R.leggi(esegui('crea',{zaino:'origine'},()=>C.crea(v,'origine',path.basename(p),null)).rimando).intero,true);
 const identita=fs.readFileSync(path.join(v,'Zaini/origine/_identita.json'),'utf8');
 assert.equal(Z.rinomina(v,'origine','Rinominato').id,'rinominato');
 assert.equal(fs.readFileSync(path.join(v,'Zaini/rinominato/_identita.json'),'utf8'),identita);
 const nuovo=path.join(v,'Zaini/rinominato/MATERIALI/PDF/Gruppi/Capitolo/02 Nuovo.pdf');
 fs.mkdirSync(path.dirname(nuovo),{recursive:true});fs.renameSync(p.replace('/origine/','/rinominato/'),nuovo);
 assert.equal(leggi().file,'02 Nuovo.pdf');assert.equal(leggi().zaino,'rinominato');
 // L'anteprima non scrive nei materiali o nei registri dell'origine.
 const reg=path.join(v,'Zaini/rinominato/_fonti-ai.json'),prima=fs.readFileSync(reg,'utf8');leggi();assert.equal(fs.readFileSync(reg,'utf8'),prima);
 fs.writeFileSync(nuovo,'%PDF-1.4\ncontenuto sostituito');assert.equal(leggi().status,'changed');
 fs.unlinkSync(nuovo);assert.equal(leggi().status,'removed');
 fs.mkdirSync(path.join(v,'Zaini/copia'),{recursive:true});fs.writeFileSync(path.join(v,'Zaini/copia/_zaino.md'),'# Copia');fs.writeFileSync(path.join(v,'Zaini/copia/_identita.json'),identita);
 assert.equal(leggi().status,'ambiguous','mai scegliere silenziosamente fra identità duplicate');
 assert.throws(()=>C.crea(v,'../fuori','01.pdf',1,''));
 assert.throws(()=>C.crea(v,'rinominato','../01.pdf',1,''));
 assert.throws(()=>C.crea(v,'rinominato','01.pdf',0,''));
 const b=path.join(v,'Zaini/destinazione');fs.writeFileSync(path.join(b,'APPUNTI/nota.md'),cita.markdown);
 fs.writeFileSync(path.join(v,'Zaini/rinominato/MATERIALI/segreto.txt'),'SEGRETO_ORIGINE_NON_COPIATO');
 const F=require('../lib/fonti-ai'),Chat=require('../lib/chat');
 const scope={mode:'all',sourceIds:[],wikipedia:false};
 const ambito=S.privilegi('chat:send',{zaino:'destinazione'},ctx);
 assert(!ambito.lettura.includes(path.join(v,'Zaini')));
 const contesto=await D.esegui(ambito,()=>Chat.contesto(v,'destinazione','Estratto scelto',{scope,allChunks:true}));
 assert(!JSON.stringify(contesto).includes('SEGRETO_ORIGINE_NON_COPIATO'));assert(contesto.chunks.some(c=>c.text.includes('Estratto scelto')));
 assert(F.sincronizza(v,'destinazione').sources.every(s=>s.kind==='appunto'));
 console.log('citazioni-zaini: identità, rinomina, gruppi, revisione, permessi e isolamento AI OK');
 }finally{fs.rmSync(v,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
