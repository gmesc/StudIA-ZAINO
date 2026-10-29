'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path');
const html=fs.readFileSync(process.env.ZAINO_HTML_PROVA||path.join(__dirname,'../App/StudIA.html'),'utf8');
const fun=nome=>{const a=html.indexOf('function '+nome+'(');assert(a>=0);return html.slice(a,html.indexOf('\n}',a)+2);};
(async()=>{
 let salvato,errore=false,nav=0,bozza,letture=0,sync=0,body='Testo aggiornato';const attese=[];
 const s={versione:1,courseId:'ct',cur:{file:'lezione.md',title:'Lezione'},dirty:true,mde:{value:()=>body}};
 const api={save:(z,file,meta,testo)=>{sync++;if(errore)return {error:'Disco non disponibile'};salvato={file,...meta,body:testo};return {file,nota:salvato};},
  saveAsync:(z,file,meta,testo)=>new Promise(resolve=>attese.push(()=>{salvato={file,...meta,body:testo};resolve(errore?{error:'Disco non disponibile'}:{file,nota:salvato});})),
  leggi:()=>{letture++;return {notes:[salvato]};}};
 api.flush=api.save;
 let logica={};try{logica=require('../App/assets/appunti/salvataggio');}catch(_){}
 const ctx={AppuntiSalvataggio:logica,NOTES:{list:[s.cur],listCourse:'ct'},SEARCH:{docs:['vecchio testo']},noteStatoAttivo:()=>s,
  notesApi:()=>api,curMeta:()=>({courseId:'ct'}),modoAttivo:()=> 'zaino',zainoNavAggiorna:()=>nav++,
  noteStati:()=>[s],mdbChiudi(){},noteRicorda:(_,v)=>{bozza=v;},refreshNoteUI(){},refreshMyNotes(){},toast(){},rigaFlush(){},noteEl:()=>null,clearTimeout,console};
 vm.createContext(ctx);for(const n of ['noteMeta','noteResync','notesReload','noteSave','noteFlushStato'])vm.runInContext(fun(n),ctx);
 let p=ctx.noteSave(true,s);assert(p&&typeof p.then==='function','autosalvataggio restituisce subito senza IPC sincrono');assert.equal(sync,0);assert(s.dirty,'non dichiarare salvato prima della risposta');
 body='Testo scritto durante la scrittura';attese.shift()();await p;assert(s.dirty,'una risposta tardiva non cancella i nuovi tasti');assert.equal(body,'Testo scritto durante la scrittura');
 p=ctx.noteSave(true,s);attese.shift()();assert.equal(await p,true);assert.equal(s.dirty,false);assert.equal(bozza,false);
 assert.equal(ctx.NOTES.list[0].body,body);assert.equal(ctx.SEARCH.docs,null);assert.equal(letture,0,'il salvataggio aggiorna solo la nota, senza rileggere l’elenco');assert.equal(nav,0);
 // La risposta del vecchio autosave arriva dopo il flush finale: non torna indietro.
 body='Vecchio in viaggio';s.dirty=true;p=ctx.noteSave(true,s);body='Ultimo prima di cambiare';
 assert.equal(ctx.noteFlushStato(s),true);assert.equal(sync,1);assert.equal(s.cur.body,body);attese.shift()();await p;assert.equal(s.cur.body,body);assert.equal(s.dirty,false);
 // Anche un Salva esplicito su testo già pulito va completato prima della chiusura.
 p=ctx.noteSave(false,s);assert(!s.dirty);const primaSync=sync;assert(ctx.noteFlushStato(s));assert.equal(sync,primaSync+1);attese.shift()();await p;
 // Un altro appunto nello stesso editor non riceve né testo né errori tardivi.
 body='In partenza';s.dirty=true;p=ctx.noteSave(true,s);s.versione++;s.cur={file:'altro.md',body:'Altro'};s.dirty=false;attese.shift()();await p;assert.equal(s.cur.body,'Altro');assert.equal(s.dirty,false);
 s.cur={file:'lezione.md',title:'Lezione'};s.dirty=true;errore=true;p=ctx.noteSave(true,s);attese.shift()();assert.equal(await p,false);assert(s.dirty);assert.equal(bozza,true);assert.equal(ctx.noteFlushStato(s),false,'chiusura rifiutata se il disco non salva');
 errore=false;salvato={...s.cur,body:'Esterno'};ctx.NOTES.list=[salvato];ctx.notesReload({soloTesto:true});assert.equal(nav,0);
 salvato={...salvato,title:'Titolo esterno'};ctx.notesReload({soloTesto:true});assert.equal(nav,1);ctx.notesReload();assert.equal(nav,2);
 console.log('✓ autosave asincrono, modifiche durante I/O, flush finale, cambio appunto, bozza su errore e nessuna rilettura globale');
})().catch(e=>{console.error(e);process.exitCode=1;});
