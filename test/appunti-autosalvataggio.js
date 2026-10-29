'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path');
const html=fs.readFileSync(process.env.ZAINO_HTML_PROVA||path.join(__dirname,'../App/StudIA.html'),'utf8');
const fun=nome=>{const a=html.indexOf('function '+nome+'(');assert(a>=0);return html.slice(a,html.indexOf('\n}',a)+2);};
let salvato,errore=false,nav=0,bozza;
const s={courseId:'ct',cur:{file:'lezione.md',title:'Lezione'},dirty:true,mde:{value:()=> 'Testo aggiornato'}};
const ctx={NOTES:{list:[s.cur],listCourse:'ct'},SEARCH:{docs:['vecchio testo']},noteStatoAttivo:()=>s,
 notesApi:()=>({save:(z,file,meta,body)=>{if(errore)return {error:'Disco non disponibile'};salvato={file,...meta,body};return {file};},leggi:()=>({notes:[salvato]})}),
 curMeta:()=>({courseId:'ct'}),modoAttivo:()=> 'zaino',zainoNavAggiorna:()=>nav++,
 noteStati:()=>[s],mdbChiudi(){},noteRicorda:(_,v)=>{bozza=v;},refreshNoteUI(){},refreshMyNotes(){},toast(){},clearTimeout,console};
vm.createContext(ctx);for(const n of ['noteMeta','noteResync','notesReload','noteSave'])vm.runInContext(fun(n),ctx);
assert.equal(ctx.noteSave(true,s),true);
assert.equal(salvato.body,'Testo aggiornato');assert.equal(s.dirty,false);assert.equal(bozza,false);
assert.equal(ctx.NOTES.list[0].body,salvato.body);assert.equal(ctx.SEARCH.docs,null,'la ricerca deve rileggere il testo salvato');
assert.equal(nav,0,'salvare il testo non deve rileggere tutti i materiali della sidebar');
ctx.notesReload({soloTesto:true});assert.equal(nav,0,'rientrare nella finestra con lo stesso elenco non rilegge i materiali');
salvato={...salvato,title:'Titolo modificato fuori dall’app'};ctx.notesReload({soloTesto:true});assert.equal(nav,1,'le modifiche esterne dei titoli aggiornano anche la sidebar');
ctx.notesReload();assert.equal(nav,2,'creazione, rinomina e rimozione conservano l’aggiornamento completo');
errore=true;s.dirty=true;assert.equal(ctx.noteSave(true,s),false);assert(s.dirty);assert.equal(bozza,true);assert.equal(nav,2);
console.log('✓ autosalvataggio: testo e ricerca aggiornati, nessuna scansione materiali, bozza su errore');
