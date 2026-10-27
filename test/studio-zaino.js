'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const F=require('../lib/fonti-ai'),S=require('../lib/schede-zaino'),I=require('../lib/interrogazione'),R=require('../lib/rag');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'studio-zaino-')),d=path.join(root,'Zaini','test');
(async()=>{
 fs.mkdirSync(path.join(d,'MATERIALI'),{recursive:true});fs.writeFileSync(path.join(d,'_zaino.md'),'# Test');fs.writeFileSync(path.join(d,'MATERIALI','bio.txt'),'I mitocondri producono ATP. La respirazione cellulare fornisce energia.');
 const source=F.sincronizza(root,'test').sources[0],scope={mode:'selected',sourceIds:[source.id],wikipedia:false};
 // Il modello deve scegliere riferimenti vincolati, senza ricopiare hash o numeri di pagina.
 const schemaScheda=require('../schema/scheda-zaino.schema.json'),contrattoPrima=JSON.stringify(schemaScheda);
 const vincolata=await require('../lib/schede').analizzaEsplicite([{chunkId:'a'.repeat(64),kind:'pdf',file:'MATERIALI/PDF/02 Fonte.pdf',page:7,text:'La fiducia rende possibili le relazioni sociali.'}],{schema:schemaScheda,preset:'Domande per capire',profile:{},chiama:async req=>{
  const contract=req.schema||JSON.parse(req.system.split('Rispondi soltanto con JSON conforme a questo schema:\n')[1]);
  const refs=contract.properties.items.items.properties.refs.items.enum;
  return {text:JSON.stringify({items:[{title:'Qual è il ruolo della fiducia?',text:'Rende possibili le relazioni sociali.',refs:[refs?.[0]||'p. 7']}]})};
 }});
 assert.deepEqual(vincolata.items[0].refs,['a'.repeat(64)]);assert.equal(JSON.stringify(schemaScheda),contrattoPrima,'Il contratto condiviso non viene mutato');
 let correzioniRefs=0;
 const corretta=await require('../lib/schede').analizzaEsplicite([{chunkId:'b'.repeat(64),kind:'pdf',file:'MATERIALI/PDF/02 Fonte.pdf',page:30,text:'La fiducia rende possibili le relazioni sociali.'}],{schema:schemaScheda,preset:'Domande per capire',profile:{},chiama:async req=>{
  correzioniRefs++;assert.deepEqual(req.schema.properties.items.items.properties.refs.items.enum,['R1']);
  if(correzioniRefs===2)assert(req.messages.at(-1).content.includes('Errori di validazione'));
  return {text:JSON.stringify({items:[{title:'Fiducia',text:'Rende possibili le relazioni sociali.',refs:[correzioniRefs===1?'R999':'R1']}]})};
 }});
 assert.equal(correzioniRefs,2);assert.deepEqual(corretta.items[0].refs,['b'.repeat(64)],'Un alias uguale di un’altra parte torna al suo hash, senza creare citazioni spurie');
 let calls=0;
 const opts={provider:'openai',model:'finto',chiama:async req=>{calls++;const data=JSON.parse(req.messages[0].content);if(data.porzioni)return {text:JSON.stringify({items:[{title:'Mitocondri',text:'Producono ATP.\n- Concetti: ATP.\n- Prerequisiti: energia.',refs:[data.porzioni[0].chunkId]}]})};if(data.proofs && data.topic)return {text:JSON.stringify({question:'Quale organello produce ATP?',answer:'I mitocondri.',rubric:['Identifica i mitocondri.'],hint:'Pensa alla respirazione cellulare.',refs:[data.proofs[0].chunkId]})};assert.equal(data.question,'Quale organello produce ATP?');assert(data.proofs[0].text.includes('mitocondri'));return {text:JSON.stringify({correct:['Hai indicato i mitocondri.'],missing:[],contradictory:[],summary:'La risposta è coerente con il materiale.',assessable:true})};}};
 for(const preset of Object.keys(S.PRESET)){const card=await S.genera(root,'test',source.id,preset,opts);assert(card.items[0].refs.length);assert.equal(S.leggi(root,'test',source.id,preset).status,'current');}
 const cardQuestions=S.leggi(root,'test',source.id,'domande').card,beforeOpen=calls;
 const catalogo=I.stato(root,'test',scope);
 assert.equal(catalogo.cardQuestions.length,1,'Le domande mai aperte sono già disponibili');
 assert.equal(catalogo.cardQuestions[0].question,cardQuestions.items[0].title);
 assert.equal(catalogo.cardQuestions[0].scheda.sourceId,source.id);
 assert(!JSON.stringify(catalogo.cardQuestions).includes('Producono ATP.'),'Le anteprime non rivelano la risposta');
 assert(!fs.existsSync(path.join(d,'RIPASSO/domande')),'Elencare non crea ripassi sul disco');
 assert.equal(I.stato(root,'test',{mode:'selected',sourceIds:[],wikipedia:false}).cardQuestions.length,0);
 const exact=I.daScheda(root,'test',source.id,0,cardQuestions.revision);
 assert.equal(exact.question,cardQuestions.items[0].title);assert.equal(exact.saved,true);assert(!Object.hasOwn(exact,'answer'));assert.equal(calls,beforeOpen);
 assert.equal(exact.id,catalogo.cardQuestions[0].id);assert.equal(exact.scheda.sourceId,source.id);
 assert.throws(()=>I.daScheda(root,'test',source.id,0,cardQuestions.revision,'scheda-superata'),/cambiata/);
 const exactStored=I.leggi(root,'test',exact.id);delete exactStored.scheda;exactStored.attempts.push({id:'kept',status:'done',text:'Tentativo già scritto',createdAt:new Date().toISOString(),corrections:[]});
 fs.writeFileSync(path.join(d,'RIPASSO/domande',exact.id+'.json'),JSON.stringify(exactStored));
 assert.equal(I.daScheda(root,'test',source.id,0,cardQuestions.revision).attempts[0].text,'Tentativo già scritto');
 assert.equal(I.stato(root,'test',scope).questions.find(q=>q.id===exact.id).scheda.sourceId,source.id,'Anche le conversioni precedenti ritrovano la scheda di origine');
 assert.throws(()=>I.daScheda(root,'test',source.id,0,'vecchia-revisione'),/cambiata/);
 fs.unlinkSync(path.join(d,'RIPASSO/domande',exact.id+'.json'));
 assert.equal(S.elenco(root,'test').cards.length,5);assert(S.elenco(root,'test').cards.every(c=>c.status==='current'&&c.sourceId===source.id));
 const copy=S.copia(root,'test',source.id,'sintesi');
 const note=require('../lib/appunti').parse(fs.readFileSync(path.join(d,'APPUNTI',copy.file),'utf8'));
 assert.equal(note.meta.title,'Sintesi — bio.txt');assert(note.body.startsWith('### Sintesi — bio.txt\n'));assert(!note.body.includes('Risposta del tutor AI'));assert(note.body.includes('- **Concetti:** ATP.'));assert(note.body.includes('- **Prerequisiti:** energia.'));
 const T=require('../App/assets/chat/schede-testo');
 for(const text of ['Opera originale:\nAutore Esempio, Titolo originale\nISBN 978-00-000-000-0, Presses universitaires, Paris 2016.','Autore Esempio\nTitolo del libro\nNome Traduttore\nTraduzione di','Copyright © MMXVI\nEditrice Esempio S.r.l.\nI diritti di traduzione, di memorizzazione elettronica, di\nriproduzione e di adattamento anche parziale,\ncon qualsiasi mezzo, sono riservati per tutti i paesi.\nI edizione italiana: dicembre 2016','.\nIndice\n1.1. La cellula, 23 / 1.2. La respirazione, 30 /\n1.3. I mitocondri, 34 / 1.4. Il metabolismo, 38.'])assert(T.soloParatesto(text),'frontespizio, colophon romano e indice con numeri di sezione vanno riconosciuti');
 for(const text of ['Indice\nIntroduzione ........ 3\nLa cellula ........ 7\nLa respirazione ........ 18','© 2026 Editore Esempio\nTutti i diritti riservati.\nISBN 978-88-0000-000-0\nPrima edizione: 2026\nStampato in Italia'])assert(T.soloParatesto(text),'indice e colophon non sono contenuto didattico');
 for(const text of ['L’indice di rifrazione è il rapporto fra due velocità.','Il copyright tutela le opere. In questo capitolo analizziamo la durata del diritto d’autore e i limiti posti alla riproduzione delle opere.','Indice\nL’indice di rifrazione descrive come la luce attraversa un mezzo. Il rapporto fra la velocità nel vuoto e quella nel materiale ne determina il valore.'])assert(!T.soloParatesto(text),'i concetti didattici non vanno cancellati da una parola ambigua');
 assert(!T.soloParatesto('© 2026 Editore. La respirazione cellulare produce ATP e rende disponibile l’energia dei nutrienti. Nelle cellule i mitocondri sono gli organelli in cui si svolgono molte fasi di questo processo.'),'una pagina mista senza a capo resta disponibile al modello');
 assert(!T.soloParatesto('Dati sperimentali\nTemperatura 20\nPressione 100\nVolume 15'),'le tabelle didattiche non sono indici');
 assert.equal(T.etichette('- Concetti: ATP.\n- Prerequisiti: energia.\nEsempi: batteria.\n- **Limiti:** nessuno.\nhttps://example.org'),'- **Concetti:** ATP.\n- **Prerequisiti:** energia.\n**Esempi:** batteria.\n- **Limiti:** nessuno.\nhttps://example.org');
 fs.appendFileSync(path.join(d,'APPUNTI',copy.file),'\nModifica personale');assert(S.copia(root,'test',source.id,'sintesi').duplicate);assert(fs.readFileSync(path.join(d,'APPUNTI',copy.file),'utf8').includes('Modifica personale'));
 // Più passaggi della stessa pagina producono un solo rimando per domanda.
 const Cit=require('../App/assets/chat/citazioni');
 const pagina={sourceId:source.id,revision:source.revision,kind:'pdf',file:'MATERIALI/PDF/01 Sistema_solare.pdf',page:3,chunkId:'p3a',quote:'Prima prova.'};
 const prove=[pagina,{...pagina,chunkId:'p3b',quote:'Seconda prova.'},{...pagina,page:4,chunkId:'p4'}, {...pagina,revision:'b'.repeat(64),chunkId:'altra-versione'}, {...pagina,sourceId:'altra-fonte',chunkId:'altro-pdf'}];
 assert.deepEqual(Cit.perRiferimenti(['p3a','p3b','p4','p4','altra-versione','altro-pdf','assente'],prove).map(s=>s.chunkId),['p3a','p4','altra-versione','altro-pdf']);
 const cardPath=path.join(d,'_lavorazione/rag/schede',source.id+'-domande.json'),originale=fs.readFileSync(cardPath);
 const pdfCard={...cardQuestions,file:pagina.file,sources:prove,items:[{title:'Come orbitano i pianeti?',text:'**Concetti:** eclittica.\n**Prerequisiti:** gravità.',refs:['p3a','p3b','p4','p4']},{title:'Dove si trova il Sole?',text:'Nella galassia.',refs:['p3a']}]};
 fs.writeFileSync(cardPath,JSON.stringify(pdfCard));
 const legacyFile='Scheda AI '+F.hash(JSON.stringify(pdfCard)).slice(0,24)+'.md';fs.writeFileSync(path.join(d,'APPUNTI',legacyFile),'La mia copia precedente, modificata.');
 const copiaPdf=S.copia(root,'test',source.id,'domande'),bodyPdf=require('../lib/appunti').parse(fs.readFileSync(path.join(d,'APPUNTI',copiaPdf.file),'utf8')).body;
 assert.notEqual(copiaPdf.file,legacyFile);assert.equal(fs.readFileSync(path.join(d,'APPUNTI',legacyFile),'utf8'),'La mia copia precedente, modificata.');
 assert(bodyPdf.startsWith('###### Domande per capire — Sistema\\_solare.pdf\n'));
 const blocchi=bodyPdf.split(/^#### /m).slice(1);assert.equal(blocchi.length,2);assert(bodyPdf.includes('Prima prova.'));assert(bodyPdf.includes('Seconda prova.'));
 assert.equal((blocchi[0].match(/\[Sistema_solare.pdf · p. 3\]/g)||[]).length,1);
 assert.equal((blocchi[0].match(/\[Sistema_solare.pdf · p. 4\]/g)||[]).length,1);
 assert.match(blocchi[0],/gravità\.\n\n\[Sistema_solare.pdf · p. 3\]\(pdf:01#p=3&s=[^\n]+\)\n\n\[Sistema_solare.pdf · p. 4\]/);
 assert(S.copia(root,'test',source.id,'domande').duplicate);fs.writeFileSync(cardPath,originale);
 const q=await I.avvia(root,'test',{scope,topic:'ATP'},opts);assert(!Object.hasOwn(q,'answer'),'la soluzione non va al renderer prima del tentativo');assert.equal(I.stato(root,'test',scope).active.id,q.id);
 let answered=await I.rispondi(root,'test',q.id,{attemptId:'attempt-one',text:'I mitocondri.'},opts);assert.equal(answered.answer,'I mitocondri.');assert(answered.attempts[0].feedback.assessable);
 const n=calls;await I.rispondi(root,'test',q.id,{attemptId:'attempt-one',text:'I mitocondri.'},opts);assert.equal(calls,n);assert.equal(I.leggi(root,'test',q.id).attempts.length,1);
 I.conserva(root,'test',q.id);const good=I.esito(root,'test',q.id,'attempt-one','buono');assert.equal(good.storia.length,1);assert.equal(good.anteprima.find(x=>x.esito==='facile').minuti,1440,'correggere lo stesso tentativo non simula una seconda ripetizione');I.esito(root,'test',q.id,'attempt-one','facile');const changed=I.leggi(root,'test',q.id);assert.equal(changed.attempts[0].corrections.length,2);assert.equal(I.storia(changed).length,1);assert.equal(I.storia(changed)[0].esito,'facile');
 R.ricostruisci(root,'test');assert.equal(S.leggi(root,'test',source.id,'sintesi').status,'current');assert.equal(I.leggi(root,'test',q.id).attempts.length,1);assert.equal(I.stato(root,'test',scope).counts.total,1);
 // La rimozione è un lotto atomico: include domande mai aperte, non altera schede né tentativi.
 const excludedPath=path.join(d,'RIPASSO/rimosse.json'),unopened=catalogo.cardQuestions[0].id;
 const savedBefore=fs.readFileSync(path.join(d,'RIPASSO/domande',q.id+'.json'));
 assert.throws(()=>I.elimina(root,'test',[q.id,'../../fuori']),/valido/);
 assert.throws(()=>I.elimina(root,'test',[q.id,'inesistente']),/disponibile/);
 assert(!fs.existsSync(excludedPath),'Un lotto non valido non rimuove neanche la prima domanda');
 const security=require('../lib/sicurezza-app'),disk=require('../lib/permessi-disco'),ctx={vault:root,appDir:path.resolve(__dirname,'..'),userData:path.join(root,'dati'),temporanei:path.join(root,'tmp')};
 const guarded=(action,fn)=>disk.esegui(security.privilegi('studio:'+action,{zaino:'test'},ctx),fn);
 const removed=guarded('remove',()=>I.elimina(root,'test',[q.id,unopened,q.id]));assert.equal(removed.count,2);
 let without=I.stato(root,'test',scope);assert.equal(without.questions.length,0);assert.equal(without.cardQuestions.length,0);assert.equal(without.active,null);assert.equal(without.counts.total,0);
 assert.equal(I.elenco(root,'test').length,0,'Anche il raccoglitore esclude le domande eliminate');
 assert.equal(I.stato(root,'test').rimozione.token,removed.token,'Annulla rimane disponibile dopo una rilettura');
 assert.throws(()=>I.riprendi(root,'test',q.id),/eliminata/);
 assert.throws(()=>I.daScheda(root,'test',source.id,0,cardQuestions.revision),/eliminata/);
 assert(fs.readFileSync(cardPath).equals(originale));assert(fs.readFileSync(path.join(d,'RIPASSO/domande',q.id+'.json')).equals(savedBefore));
 assert.throws(()=>I.annullaEliminazione(root,'test','token-vecchio'),/non disponibile/);
 guarded('undoRemove',()=>I.annullaEliminazione(root,'test',removed.token));
 assert.equal(I.stato(root,'test').questions.length,1);assert.equal(I.stato(root,'test').cardQuestions.length,1);assert.equal(I.leggi(root,'test',q.id).attempts.length,1);
 assert.equal(I.stato(root,'test').rimozione,null);
 const firstRemoval=I.elimina(root,'test',[q.id]),secondRemoval=I.elimina(root,'test',[unopened]);
 assert.throws(()=>I.annullaEliminazione(root,'test',firstRemoval.token),/non disponibile/);
 I.annullaEliminazione(root,'test',secondRemoval.token);assert.equal(I.stato(root,'test').questions.length,0);assert.equal(I.stato(root,'test').cardQuestions.length,1);
 fs.unlinkSync(excludedPath);
 require('../lib/zaini').crea(root,'Altro');assert.throws(()=>I.elimina(root,'altro',[q.id]),/disponibile/);
 assert.throws(()=>I.annullaEliminazione(root,'altro',secondRemoval.token),/non disponibile/);
 let release;const evaluating=I.rispondi(root,'test',q.id,{attemptId:'lock-check',text:'I mitocondri.'},{...opts,chiama:()=>new Promise(resolve=>{release=resolve;})});
 assert.throws(()=>I.elimina(root,'test',[unopened,q.id]),/riscontro/);
 assert.equal(I.stato(root,'test').cardQuestions.length,1,'Un riscontro in corso blocca tutto il lotto');
 release({text:JSON.stringify({correct:[],missing:[],contradictory:[],summary:'Prova',assessable:true})});await evaluating;
 fs.writeFileSync(path.join(d,'RIPASSO/domande',q.id+'.json'),savedBefore);
 fs.writeFileSync(excludedPath,'{rotto');assert.throws(()=>I.stato(root,'test'));fs.unlinkSync(excludedPath);
 fs.symlinkSync(cardPath,excludedPath);assert.throws(()=>I.elimina(root,'test',[q.id]),/simbolico/);fs.unlinkSync(excludedPath);
 assert.equal(calls,n,'Eliminare e annullare non usano AI');
 fs.writeFileSync(path.join(d,source.file),'Contenuto sostituito.');
 assert(S.elenco(root,'test').cards.every(c=>c.status==='changed'));
 answered=await I.rispondi(root,'test',q.id,{attemptId:'attempt-two',text:'Un altro tentativo.'},opts);assert.equal(answered.attempts.at(-1).feedback.assessable,false);assert.equal(calls,n);
 const empty=I.stato(root,'test',{mode:'selected',sourceIds:[],wikipedia:false});assert.equal(empty.questions.length,0);
 let invalid=0;await assert.rejects(S.genera(root,'test',source.id,'sintesi',{...opts,chiama:async()=>{invalid++;return {text:'{"items":[{"title":"Falso","text":"Inventato","refs":["inesistente"]}]}'};}}),/due tentativi/);assert.equal(invalid,2);
 // Tutti i preset ricevono contenuti di studio, senza usare indice e colophon come prove.
 fs.writeFileSync(path.join(d,'MATERIALI','02 Edizione.pdf'),'%PDF-prova');
 const edizione=F.sincronizza(root,'test').sources.find(s=>s.file.endsWith('02 Edizione.pdf'));
 const estratto={numPages:5,truncated:false,pages:[{page:1,text:'© 2026 Editore Esempio\nTutti i diritti riservati.\nISBN 978-88-0000-000-0\nPrima edizione: 2026'},{page:2,text:'Indice\nIntroduzione ........ 3\nLa cellula ........ 7\nLa respirazione ........ 18'},{page:3,text:'La respirazione cellulare produce ATP e rende disponibile l’energia dei nutrienti.'},{page:4,text:'Il copyright tutela le opere. In questo capitolo analizziamo la durata del diritto d’autore e i limiti posti alla riproduzione delle opere.'},{page:5,text:'- Indice\n'+Array.from({length:50},(_,i)=>'1.'+(i+1)+'. Argomento della trattazione, '+(i+20)).join(' / ')}]};
 const didattico={...opts,estraePdf:async()=>estratto,chiama:async req=>{const data=JSON.parse(req.messages[0].content);assert.deepEqual(data.porzioni.map(p=>p.page),[3,4]);assert(data.porzioni.every(p=>p.file==='Edizione.pdf'&&!p.citation&&!p.label));assert(req.system.includes('Ignora indice, sommario, frontespizio, colophon e dati editoriali'));return {text:JSON.stringify({items:[{title:'Energia',text:'La respirazione produce ATP.',refs:[data.porzioni[0].chunkId]}]})};}};
 for(const preset of Object.keys(S.PRESET)){const card=await S.genera(root,'test',edizione.id,preset,didattico);assert.equal(card.excluded,4);assert.equal(card.covered,2);assert.equal(card.partial,false);assert.deepEqual(card.sources.map(s=>s.page),[3,4]);assert.equal(card.promptVersion,3);}
 // Un PDF vero oltre pagina 250 deve raggiungere l’ultima pagina, con cache dedicata.
 const {PDFDocument,StandardFonts}=require('pdf-lib'),pdfIntero=await PDFDocument.create(),font=await pdfIntero.embedFont(StandardFonts.Helvetica);
 for(let page=1;page<=260;page++)pdfIntero.addPage().drawText('Contenuto didattico della pagina '+page+'. Le cellule trasformano energia.',{x:30,y:600,font,size:12});
 fs.writeFileSync(path.join(d,'MATERIALI','04 Libro intero.pdf'),await pdfIntero.save());
 const libro=F.sincronizza(root,'test').sources.find(s=>s.file.endsWith('04 Libro intero.pdf'));
 const intero=await S.prepara(root,'test',libro.id,'domande');assert.equal(intero.chunks.at(-1).page,260);assert(!intero.partial);
 fs.writeFileSync(path.join(d,'MATERIALI','05 Oltre limite.pdf'),'%PDF-prova');
 const oltre=F.sincronizza(root,'test').sources.find(s=>s.file.endsWith('05 Oltre limite.pdf'));let remote=0;
 await assert.rejects(S.genera(root,'test',oltre.id,'domande',{...opts,estraePdf:async()=>({pages:[{page:1,text:'Le cellule producono energia.'}],truncated:true}),chiama:async()=>{remote++;}}),/limite di lettura sicura/);assert.equal(remote,0);
 const indice='Indice\nIntroduzione ........ 3\nLa cellula ........ 7\nLa respirazione ........ 18';fs.writeFileSync(path.join(d,'MATERIALI','solo-indice.txt'),indice);
 const soloIndice=F.sincronizza(root,'test').sources.find(s=>s.file.endsWith('solo-indice.txt'));let invii=0;
 await assert.rejects(S.genera(root,'test',soloIndice.id,'domande',{...opts,chiama:async()=>{invii++;}}),/contenuti didattici.*indice e dati editoriali/);assert.equal(invii,0,'una fonte con il solo indice non avvia la generazione');
 // Regressione: il vecchio tetto di 24.000 caratteri non leggeva la coda della fonte.
 const lungo=Array.from({length:5000},(_,i)=>'Tema '+i+': le cellule trasformano energia e materia durante le reazioni metaboliche.').join('\n');
 fs.writeFileSync(path.join(d,'MATERIALI','03 Fonte intera.txt'),lungo);
 const intera=F.sincronizza(root,'test').sources.find(s=>s.file.endsWith('03 Fonte intera.txt'));
 const vecchio=await require('../lib/chat').contesto(root,'test','',{scope:{mode:'selected',sourceIds:[intera.id]},allChunks:true});
 assert(vecchio.chunks.at(-1).offset<lungo.length-100000,'La cache chat della prova è deliberatamente limitata');
 const piano=await S.prepara(root,'test',intera.id,'domande');
 assert.equal(piano.covered,piano.total,'Tutti i passaggi devono entrare nel piano');
 assert(piano.chunks.at(-1).text.includes('Tema 4999'),'La scheda deve leggere oltre il vecchio limite di estrazione');
 assert(piano.parts>1);assert(piano.maxCalls>=piano.parts);assert(!piano.partial);
 let letti=[],fusioni=0,progressi=[],partiLette=0;
 const completa={...opts,onProgress:p=>progressi.push(p),chiama:async req=>{
  const data=JSON.parse(req.messages[0].content);
  if(data.porzioni){letti.push(...data.porzioni.map(p=>p.text));const n=letti.length;return {text:JSON.stringify({items:[{title:++partiLette%2?'Come producono energia le cellule?':'In quale modo le cellule ottengono energia?',text:'Le cellule trasformano energia attraverso le reazioni metaboliche.',refs:[data.porzioni[0].chunkId]},{title:'Tema specifico '+n,text:'Risposta specifica alla parte '+n,refs:[data.porzioni.at(-1).chunkId]}]})};}
  assert(Array.isArray(data.candidati));fusioni++;const doppie=data.candidati.filter(i=>i.text==='Le cellule trasformano energia attraverso le reazioni metaboliche.').map(i=>i.id);
  return {text:JSON.stringify({groups:doppie.length>1?[doppie]:[]})};
 }};
 const completaCard=await S.genera(root,'test',intera.id,'domande',completa);
 assert.deepEqual(letti,piano.chunks.map(p=>p.text));assert(fusioni>0);
 assert.equal(completaCard.covered,completaCard.total);assert.equal(completaCard.items.filter(i=>i.text==='Le cellule trasformano energia attraverso le reazioni metaboliche.').length,1);
 assert(completaCard.items.length>12,'L’unione non deve troncare a dodici gli argomenti di tutte le parti');
 assert(completaCard.items[0].refs.length>1,'Le prove delle ripetizioni vengono conservate');
 assert(progressi.some(p=>p.phase==='analysis'&&p.done===piano.parts));
 const completaPath=path.join(d,'_lavorazione/rag/schede',intera.id+'-domande.json'),salvata=fs.readFileSync(completaPath);
 const ctrl=new AbortController();let iniziate=0;
 await assert.rejects(S.genera(root,'test',intera.id,'domande',{...completa,signal:ctrl.signal,chiama:async req=>{iniziate++;const r=await completa.chiama(req);ctrl.abort();return r;}}),/interrott|annullat/);
 assert.equal(iniziate,1);assert(fs.readFileSync(completaPath).equals(salvata),'Interrompere non sostituisce la scheda precedente');
 let tentate=0;
 await assert.rejects(S.genera(root,'test',intera.id,'domande',{...completa,chiama:async req=>{if(++tentate===2)throw Error('Rete interrotta nella seconda parte');return completa.chiama(req);}}),/seconda parte/);
 assert(fs.readFileSync(completaPath).equals(salvata),'Un errore intermedio non pubblica una scheda incompleta');
 const Plan=require('../App/assets/chat/schede-piano'),cost=Plan.costo(piano,{input:2,output:10});assert(cost.max>cost.min&&cost.min>0);
 assert.equal(Plan.unisci([{title:'Formula',text:'a+b',refs:['1']},{title:'Formula',text:'a-b',refs:['2']}]).length,2,'La rimozione dei doppioni identici deve conservare segni e formule');
 const campione=Array.from({length:100},(_,i)=>({title:String(i)+'a'.repeat(195),text:'b'.repeat(1800),refs:['c'+i]})),confronti=Plan.confronti(campione);
 for(let a=0;a<campione.length;a++)for(let b=a+1;b<campione.length;b++)assert(confronti.some(g=>g.some(i=>i.id===a)&&g.some(i=>i.id===b)),'Anche le ripetizioni fra gruppi lontani devono poter essere unite');
 assert(confronti.every(g=>JSON.stringify(g).length<65000));
 assert.equal(Plan.unisci([{title:'A|B',text:'C',refs:['1']},{title:'A',text:'B|C',refs:['2']}]).length,2);
 let erroreFusione=0;
 await assert.rejects(S.genera(root,'test',intera.id,'domande',{...completa,chiama:async req=>{const data=JSON.parse(req.messages[0].content);if(data.candidati){erroreFusione++;return {text:JSON.stringify({groups:[[data.candidati[0].id,999999]]})};}return completa.chiama(req);}}),/due tentativi/);
 assert.equal(erroreFusione,2);assert(fs.readFileSync(completaPath).equals(salvata),'Un errore di unione non pubblica solo le parti');
 let cambiata=false;
 try{await assert.rejects(S.genera(root,'test',intera.id,'domande',{...completa,chiama:async req=>{if(!cambiata){fs.appendFileSync(path.join(d,intera.file),'\nFonte cambiata.');cambiata=true;}return completa.chiama(req);}}),/Fonte cambiata/);assert(fs.readFileSync(completaPath).equals(salvata));}
 finally{fs.writeFileSync(path.join(d,intera.file),lungo);}
 assert.equal(Plan.costo(piano,null),null);assert.equal(Plan.tariffa('openai','sconosciuto'),null);
 assert.equal(Plan.tariffa('google','gemini-4-argon','2026-11-30').input,2);assert.equal(Plan.tariffa('google','gemini-4-argon','2026-12-01').input,4);
 assert.deepEqual(Plan.unisci([{title:'A',text:'Uno',refs:['1']},{title:'B',text:'Due',refs:['2']},{title:'C',text:'Tre',refs:['3']}],[[0,1],[1,2]])[0].refs,['1','2','3']);
 // L’embedder riduce i candidati cloud, mai i passaggi letti o le citazioni.
 let indiceLocale=0,cloudLocale=0,embeddingLocale=0,passaggiLocali=[];
 const mockLocale=async req=>{
  const data=JSON.parse(req.messages[0].content);
  if(data.porzioni){const n=indiceLocale++;passaggiLocali.push(...data.porzioni.map(p=>p.text));return {text:JSON.stringify({items:[
   {title:n%2?'Come si produce ATP?':'Quale processo produce ATP?',text:n%2?'La respirazione cellulare produce ATP.':'L’ATP viene prodotto dalla respirazione cellulare.',refs:[data.porzioni[0].chunkId]},
   ...[n*2,n*2+1].map(i=>({title:'Argomento '+i,text:'Spiegazione specifica '+i+': '+('contenuto '.repeat(150)).trim(),refs:[data.porzioni.at(-1).chunkId]})),
   ...(n===0?[{title:'Affermazione opposta',text:'La respirazione cellulare non produce ATP.',refs:[data.porzioni[1].chunkId]}]:[])
  ]})};}
  cloudLocale++;const ids=data.candidati.filter(i=>['Come si produce ATP?','Quale processo produce ATP?'].includes(i.title)).map(i=>i.id);
  return {text:JSON.stringify({groups:ids.length>1?[ids]:[]})};
 };
 const confrontoCompleto=await S.genera(root,'test',intera.id,'domande',{...opts,chiama:mockLocale}),chiamateComplete=cloudLocale;
 assert(chiamateComplete>1);
 indiceLocale=0;cloudLocale=0;passaggiLocali=[];
 const runtimeLocale={ready:()=>true,embed:async(text,o)=>{embeddingLocale++;assert.equal(o.query,false);const v=Array(768).fill(0),indice=text.match(/^Argomento (\d+)/);v[indice?Number(indice[1])+1:0]=1;return {vector:v};}};
 const locale=await S.genera(root,'test',intera.id,'domande',{...opts,runtime:runtimeLocale,chiama:mockLocale});
 assert(embeddingLocale>0,'La generazione deve usare davvero l’embedder locale');
 assert(cloudLocale<chiamateComplete,'La selezione locale deve ridurre le richieste cloud');
 assert.deepEqual(passaggiLocali,piano.chunks.map(p=>p.text));assert.equal(locale.covered,locale.total);
 const tutteLeProve=card=>[...new Set(card.items.flatMap(i=>i.refs))].sort();assert.deepEqual(tutteLeProve(locale),tutteLeProve(confrontoCompleto));
 assert.equal(locale.items.length,confrontoCompleto.items.length);assert(locale.items.some(i=>i.title==='Affermazione opposta'),'Similarità massima non autorizza a unire risposte opposte');
 assert.equal(locale.dedup.mode,'local');assert.equal(locale.dedup.cloudCalls,cloudLocale);assert(locale.dedup.savedCalls>0);
 assert.deepEqual(locale.sources,confrontoCompleto.sources);
 indiceLocale=0;cloudLocale=0;
 const ripiego=await S.genera(root,'test',intera.id,'domande',{...opts,chiama:mockLocale,runtime:{ready:()=>true,embed:async()=>{throw Error('Motore locale non disponibile');}}});
 assert.equal(ripiego.dedup.mode,'fallback');assert.equal(cloudLocale,chiamateComplete);assert(ripiego.warnings.some(w=>w.includes('confronto cloud completo')));assert.deepEqual(tutteLeProve(ripiego),tutteLeProve(locale));
 const primaDelloStop=fs.readFileSync(completaPath);indiceLocale=0;cloudLocale=0;
 const stopLocale=new AbortController();await assert.rejects(S.genera(root,'test',intera.id,'domande',{...opts,chiama:mockLocale,signal:stopLocale.signal,runtime:{ready:()=>true,embed:async()=>{stopLocale.abort();throw Error('Interrotto');}}}),/interrott/i);
 assert.equal(cloudLocale,0,'L’annullamento locale non deve avviare il ripiego cloud');assert(fs.readFileSync(completaPath).equals(primaDelloStop));
 const stimaLocale=await S.prepara(root,'test',intera.id,'domande',{runtime:runtimeLocale});assert.equal(stimaLocale.dedupPlan.mode,'local');assert.equal(stimaLocale.estimatedInputTokens,piano.estimatedInputTokens,'La fascia prudente deve includere anche il ripiego cloud completo');
 const vettoriCampione=campione.map((_,i)=>Array.from({length:768},(_,k)=>k===i%17?1:0)),selezione=Plan.confrontiLocali(campione,vettoriCampione);
 assert(selezione.jobs.length<=confronti.length);
 for(let a=0;a<campione.length;a++)for(let b=a+1;b<campione.length;b++)if(a%17===b%17)assert(selezione.jobs.some(g=>g.some(i=>i.id===a)&&g.some(i=>i.id===b)),'Ogni coppia candidata deve arrivare a una verifica anche fra gruppi lontani');
 assert.throws(()=>Plan.confrontiLocali(campione,[[1]]),/incompleti/);
 assert.throws(()=>Plan.confrontiLocali([campione[0]],[Array(768).fill(0)]),/non valido/);
 const sparso=Array(768);sparso[0]=1;assert.throws(()=>Plan.confrontiLocali([campione[0]],[sparso]),/non valido/);
 indiceLocale=0;cloudLocale=0;
 const errati=await S.genera(root,'test',intera.id,'domande',{...opts,chiama:mockLocale,runtime:{ready:()=>true,embed:async()=>({vector:[NaN]})}});
 assert.equal(errati.dedup.mode,'fallback');assert.equal(cloudLocale,chiamateComplete);assert.deepEqual(tutteLeProve(errati),tutteLeProve(locale));
 console.log('duplicati locali: '+chiamateComplete+'→'+locale.dedup.cloudCalls+' confronti cloud; fonte intera, negazioni, tutte le prove e stop conservati');
 console.log('studio-zaino: cinque preset, prove vincolate, copia personale, soluzione nascosta, ripresa, idempotenza, correzioni e fonti obsolete OK');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>fs.rmSync(root,{recursive:true,force:true}));
