'use strict';
const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const path=require('path');
const Banco=require('../App/assets/banco/materiali');
const html=fs.readFileSync(path.join(__dirname,'../App/StudIA.html'),'utf8');
const modulo=fs.readFileSync(path.join(__dirname,'../App/assets/banco/materiali.js'),'utf8');

assert.equal(Banco.tipo('appunti2'),'appunti');
assert.equal(Banco.tipo('fonte2'),'fonte');
const blocchi={A:'fonte',B:'fonte2',C:'appunti',D:'appunti2'};
assert.equal(Banco.scegli(blocchi,['A','B','C','D'],'B','fonte'),'fonte2');
assert.equal(Banco.scegli(blocchi,['A','B','C','D'],'D','appunti'),'appunti2');
assert.equal(Banco.scegli(blocchi,['A','B','C','D'],'C','fonte'),'');
assert.equal(Banco.scegli({A:'fonte',C:'appunti'},['A','B','C','D'],'B','fonte'),'fonte2');
assert.equal(Banco.scegli({A:'fonte',C:'appunti'},['A','B','C','D'],'D','appunti'),'appunti2');
assert.equal(Banco.scegli(blocchi,['A','C'],'C','fonte'),'fonte2'); // libero perché nascosto
assert.equal(Banco.scegli(blocchi,['A','B','C','D'],'D','mappa'),'mappa');

// Il renderer comune gira con DOM e CodeMirror minimi: le decisioni di salvataggio,
// destinazione e attesa sono vere; Electron deve soltanto verificarne il cablaggio.
function harness(){
  let corso='uno',errore=false,visibili=['appunti','appunti2'];
  let titolo=()=>Promise.resolve({titolo:'Nuovo',materiale:''}),rinomina=()=>Promise.resolve({testo:'Rinominato',scelta:''});
  const files={uno:[{file:'a.md',title:'A',body:'Appunto A'},{file:'b.md',title:'B',body:'Appunto B'},{file:'c.md',title:'C',body:'Appunto C'}],due:[{file:'b.md',title:'Altro B',body:'Altro zaino'}]};
  const dati=new Map(),salvati=[],messaggi=[],aperti=[],righe=[],timers=new Map();
  const elementi=new Map(),eventiDom={},eventiWindow={};let prossimoTimer=0;
  function elemento(id){
    if(!elementi.has(id)){
      const el={id,value:'',innerHTML:'',textContent:'',hidden:false,offsetParent:true,options:[],style:{},
        setAttribute(k,v){this[k]=v;},getAttribute(k){return this[k];},
        focus(){this.focalizzato=true;},addEventListener(){},appendChild(o){this.options.push(o);},insertBefore(){},
        querySelector(sel){
          if(sel==='.mdb-edit')return this.campo||null;
          if(sel.includes('editor-preview'))return this.anteprima?(this.preview||(this.preview={innerHTML:''})):null;
          if(sel==='.editor-toolbar')return elemento(id+'-bar');
          if(sel==='.mdb[data-edit]')return this.campo?this.campo.closest():null;
          return elemento(id+sel);
        },closest(){return elemento(id.endsWith('2')?'notePane2':'notePane');},querySelectorAll(){return [];}};
      if(id==='noteCtlTpl'||id==='noteCtlFineTpl')el.content={cloneNode(){return {querySelectorAll(){return [];}};}};
      elementi.set(id,el);
    }
    return elementi.get(id);
  }
  class Mde{
    constructor(opt){
      this.opt=opt;this.host=elemento(opt.element.id==='noteArea2'?'noteHost2':'noteHost');
      this.body='';const eventi={},opzioni={};
      const index=p=>this.body.split('\n').slice(0,p.line).reduce((n,r)=>n+r.length+1,0)+p.ch;
      const cm=this.codemirror={on(t,f){eventi[t]=f;},setOption(k,v){opzioni[k]=v;},getOption:k=>opzioni[k],
        historySize:()=>({undo:0,redo:0}),clearHistory(){},
        getCursor(){return cm.cursor||{line:0,ch:0};},getScrollInfo(){return {top:cm.top||0,left:cm.left||0};},
        setCursor(p,ch){cm.cursor=typeof p==='number'?{line:p,ch:ch||0}:p;if(eventi.cursorActivity)eventi.cursorActivity();},
        scrollTo(x,y){cm.left=x;cm.top=y;},focus(){cm.focalizzato=true;},refresh(){},
        getValue:()=>this.body,lineCount:()=>this.body.split('\n').length,lastLine:()=>this.body.split('\n').length-1,
        getLine:n=>this.body.split('\n')[n],scrollIntoView(){},getSelection(){return '';},
        getRange:(a,b)=>this.body.slice(index(a),index(b)),
        replaceRange:(t,a,b)=>this.value(this.body.slice(0,index(a))+t+this.body.slice(index(b||a))),
        replaceSelection:t=>cm.replaceRange(t,cm.getCursor())};
      this.value=(v)=>{if(v===undefined)return this.body;this.body=v;if(eventi.change)eventi.change();};
      this.togglePreview=()=>{this.host.anteprima=!this.host.anteprima;};
    }
  }
  const api={leggi:id=>({notes:JSON.parse(JSON.stringify(files[id])),error:''}),
    save(id,file,meta,body,opt){
      if(errore)return {error:'Disco non scrivibile'};
      if(!file){file='nuovo-'+files[id].length+'.md';files[id].push({file});}
      const n=files[id].find(n=>n.file===file);assert(n,'salvataggio nel corretto zaino');
      Object.assign(n,meta,{body});salvati.push({id,file,body,opt});return {file};
    },
    rename(id,file,title){const n=files[id].find(n=>n.file===file);assert(n);n.title=title;n.file=title+'.md';return {file:n.file,nota:{...n}};},
    async remove(id,file){if(errore)return false;files[id]=files[id].filter(n=>n.file!==file);return true;}};
  const ctx={console,document:{getElementById:elemento,createElement(){return elemento('creato-'+elementi.size);},documentElement:{dataset:{}},
      addEventListener(t,f){(eventiDom[t]||(eventiDom[t]=[])).push(f);}},
    localStorage:{getItem:k=>dati.get(k)||null,setItem:(k,v)=>dati.set(k,v)},EasyMDE:Mde,
    setTimeout(f,ms){const id=++prossimoTimer;timers.set(id,{f,ms});return id;},clearTimeout:id=>timers.delete(id),
    addEventListener(t,f){(eventiWindow[t]||(eventiWindow[t]=[])).push(f);},
    corsoAttivo:()=>corso,curMeta:()=>({courseId:corso}),modoAttivo:()=>'zaino',
    curCtx:()=>({courseId:corso,materiale:'',pagina:''}),notesApi:()=>api,
    bancoAggiornaDocumenti(){},bancoVisibile:id=>visibili.includes(id),bancoMostra:id=>aperti.push(id),bancoTogli:id=>{visibili=visibili.filter(x=>x!==id);},
    toast:t=>messaggi.push(t),tendinaViva(){},tasti:String,tastiNelDom(){},barreSeparatori(){},zainoNavAggiorna(){},SEARCH:{},
    renderNoteMd:t=>t,escHtml:String,noteEtichetta:n=>n.title,noteEtichettaAltrove:n=>n.title,noteMateriale:n=>n.materiale||'',
    noteGroups:ns=>({qui:ns,altrove:[]}),noteInChapter:()=>true,PERSONALE:'Personale',
    noteCollegaCallout(){},openCalloutMenu(){},citaCorrente(){},apriMateriali(){},apriGuida(){},
    openEmojiPop(anchor,callback){ctx.emoji=callback;},documentiPdf:()=>Promise.resolve([]),titoloMateriale:n=>n,
    askText:()=>rinomina(),confirm:()=>true,
    apertoScrivi(k,v){salvati.push({k,v});},$:(sel)=>elemento(sel.slice(1)),
    vault:{riga:{segna(c,f,r){righe.push({corso:c,file:f,riga:r});return Promise.resolve({});}}}};
  ctx.window=ctx;vm.createContext(ctx);
  const a=html.indexOf('function noteCreaStato('),b=html.indexOf('/**',a);
  vm.runInContext(html.slice(a,b),ctx);
  vm.runInContext(html.slice(html.indexOf('function notesReload('),html.indexOf("document.addEventListener('input',function(e){ if(e.target && e.target.id==='emojiSearch')")),ctx);
  // Il dialogo e il frammento hanno prove proprie: qui controlliamo l'identità che li attraversa.
  ctx.noteChiediNomeEOrigine=()=>titolo();ctx.frammentoAppuntato=t=>'Citazione: '+t;
  ctx.refreshMyNotes=()=>{};
  vm.runInContext(modulo,ctx);
  ctx.notesReload();ctx.noteOpen('a.md',ctx.NOTES);
  function scatti(max=60){for(const [id,t] of [...timers])if(t.ms<=max){timers.delete(id);t.f();}}
  scatti();
  return {api:ctx.appuntiParalleli,ctx,win:ctx,files,dati,salvati,messaggi,aperti,righe,elemento,scatti,
    titolo:f=>{titolo=f;},rinomina:f=>{rinomina=f;},visibili:v=>{visibili=v;},corso:v=>{corso=v;},errore:v=>{errore=v;},
    tocca(id){const e={target:{closest:()=>({id})}};(eventiDom.pointerdown||[]).forEach(f=>f(e));},
    anteprima(){(eventiWindow.keydown||[]).forEach(f=>f({key:'j',metaKey:true,preventDefault(){},stopPropagation(){}}));},
    modificaBlocco(stato,testo){const host=ctx.noteHost(stato),box={getAttribute:k=>k==='data-da'?'0':'0',removeAttribute(){}};
      host.campo={value:testo,closest:()=>box,remove(){host.campo=null;}};
      return host;
    }};
}
async function editor(){
  const h=harness(),a=h.api,s1=h.ctx.NOTES,s2=a.stato;
  assert.equal(a.open('a.md'),false,'lo stesso file non si modifica da due riquadri');
  assert.equal(a.open('b.md'),true);h.scatti();
  assert.deepEqual(s1.mde.opt.toolbar.map(x=>typeof x==='string'?x:x.name),s2.mde.opt.toolbar.map(x=>typeof x==='string'?x:x.name),'una toolbar identica per entrambe le istanze');
  assert.equal(s2.mde.opt.previewRender('Corpo'),'Corpo');
  h.tocca('notePane2');assert.equal(h.ctx.noteStatoAttivo(),s2);
  h.ctx.noteInserisci('Citazione al secondo');
  assert.match(s2.mde.value(),/Citazione al secondo/);assert.equal(h.files.uno[0].body,'Appunto A');
  h.anteprima();assert(s2.mde.host.anteprima);assert(!s1.mde.host.anteprima);
  h.anteprima();assert(!s2.mde.host.anteprima);assert(s2.mde.codemirror.focalizzato);
  h.tocca('notePane');h.ctx.noteInserisci('Citazione al primo');
  assert.match(h.files.uno[0].body,/Citazione al primo/);assert(!h.files.uno[1].body.includes('al primo'));
  h.tocca('notePane2');h.visibili(['appunti']);assert.equal(h.ctx.noteStatoAttivo(),s1);
  h.visibili(['appunti','appunti2']);h.ctx.noteApriAttivo('a.md');assert.equal(h.ctx.noteStatoAttivo(),s1);
  h.visibili(['appunti2']);h.tocca('notePane');assert.equal(h.ctx.noteStatoAttivo(),s2);
  h.visibili(['appunti','appunti2']);
  s1.mde.codemirror.setCursor({line:1,ch:0});s2.mde.codemirror.setCursor({line:2,ch:0});h.ctx.rigaFlush();
  assert(h.righe.some(r=>r.file==='a.md'&&r.riga===1));assert(h.righe.some(r=>r.file==='b.md'&&r.riga===2),'il debounce conserva entrambi i segni');
  s2.mde.codemirror.setCursor({line:3,ch:1});s2.mde.codemirror.scrollTo(4,120);a.flush();a.molla();a.open('b.md');h.scatti();
  assert.equal(s2.mde.codemirror.getScrollInfo().top,120);assert.equal(s2.mde.codemirror.getCursor().line,3);
  h.modificaBlocco(s2,'Anteprima modificata');assert.equal(a.flush(),true);
  assert.match(h.files.uno[1].body,/Anteprima modificata/,'flush raccoglie il testo ancora nella textarea di anteprima');
  const corpo=s2.mde.value();h.ctx.closeEditor(s2);assert.equal(s2.cur,null);assert.equal(s2.mde.value(),'','chiudere l’appunto libera l’editor');assert.equal(h.files.uno[1].body,corpo,'la chiusura conserva il documento su disco');assert(h.ctx.bancoVisibile('appunti2'),'la toolbar resta nello split');a.open('b.md');assert.equal(s2.mde.value(),corpo);
  s2.mde.value('Da recuperare');h.errore(true);assert.equal(a.flush(),false);assert.equal(a.molla(),false,'non svuotare un editor che non si è salvato');
  assert.match(h.messaggi.at(-1),/bozza resta conservata/);
  const memoria=new Map(h.dati);h.errore(false);h.ctx.noteSvuota(s2); // simula nuova istanza dopo un riavvio
  for(const [k,v] of memoria)h.dati.set(k,v);
  a.open('b.md');assert.equal(s2.mde.value(),'Da recuperare');assert(s2.dirty);a.save(false);
  assert.equal(h.files.uno[1].body,'Da recuperare');assert(h.salvati.filter(x=>x.opt).at(-1).opt.svuota);
  s1.mde.value('Primo prima del cambio');s2.mde.value('Secondo prima del cambio');assert(h.ctx.noteMolla());
  assert.equal(h.files.uno[0].body,'Primo prima del cambio');assert.equal(h.files.uno[1].body,'Secondo prima del cambio');
  h.corso('due');a.open('b.md');assert.equal(s2.mde.value(),'Altro zaino');
  h.errore(true);assert.equal(await h.ctx.noteDelete(s2),false);assert(s2.cur,'eliminazione fallita lascia appunto aperto');
  h.errore(false);assert.equal(await h.ctx.noteDelete(s2),true);assert.equal(s2.cur,null);
  assert(h.ctx.noteMolla());
}
async function creazione(){
  const h=harness(),a=h.api,s2=a.stato;a.layout();h.tocca('notePane2');
  assert.equal(await h.ctx.noteAppend('Primo frammento'),true);assert(s2.cur);assert.match(s2.mde.value(),/Primo frammento/);
  assert.equal(h.ctx.NOTES.cur.file,'a.md');a.molla();
  let completa;h.titolo(()=>new Promise(r=>{completa=r;}));
  h.tocca('notePane2');const attesa=h.ctx.noteAppend('Non deve finire altrove');h.corso('due');completa({titolo:'Tardivo',materiale:''});
  assert.equal(await attesa,false);assert.equal(h.files.due.length,1);
  h.corso('uno');h.tocca('notePane2');const stabile=h.ctx.noteAppend('Destinazione catturata');h.tocca('notePane');completa({titolo:'Nuovo secondo',materiale:''});
  assert.equal(await stabile,true);assert.match(s2.mde.value(),/Destinazione catturata/);
  let termina;h.rinomina(()=>new Promise(r=>{termina=r;}));
  const cambio=h.ctx.noteRename(s2);await new Promise(setImmediate);h.ctx.noteOpen('c.md',s2);termina({testo:'Non toccare C',scelta:''});await cambio;
  assert.equal(s2.cur.file,'c.md');assert.equal(h.files.uno[2].title,'C','rinomina tardiva non cambia il nuovo documento');
  h.rinomina(()=>Promise.resolve({testo:'C rinominato',scelta:'01 fonte.pdf'}));await h.ctx.noteRename(s2);
  assert.equal(s2.cur.title,'C rinominato');assert.equal(s2.cur.materiale,'01 fonte.pdf');
  const emoji=s2.mde.opt.toolbar.find(x=>x.name==='emoji');emoji.action(s2.mde);
  h.ctx.noteOpen('b.md',s2);const prima=s2.mde.value();h.ctx.emoji('😀');assert.equal(s2.mde.value(),prima,'emoji tardiva non entra nel nuovo file');
  h.ctx.noteMolla();a.layout();s2.mde.value('Bozza breve');
  assert.equal(h.ctx.noteMolla(),false,'non perdere il testo senza nome al cambio zaino');
  assert.equal(h.ctx.noteOpen('b.md',s2),false,'non perdere il testo senza nome aprendo un file');
  assert.equal(s2.mde.value(),'Bozza breve');
  h.titolo(()=>Promise.resolve({titolo:'Conservata',materiale:''}));assert(await h.ctx.noteNew('',null,null,null,s2));
  assert.equal(s2.mde.value(),'Bozza breve','il più conserva il testo già scritto');
  h.ctx.noteMolla();a.layout();h.tocca('notePane2');s2.mde.value('Bozza prima della citazione');
  assert.equal(await h.ctx.noteAppend('Frammento dalla fonte'),true);
  assert.equal(s2.mde.value(),'Bozza prima della citazione\n\nCitazione: Frammento dalla fonte','Appunta conserva anche il testo senza nome');
  h.ctx.noteMolla();
}
async function rinominaSoloMaiuscole(){
  for(const indice of [0,1]){
    const h=harness(),s=h.ctx.noteStati()[indice];
    if(indice) h.api.open('b.md');
    h.scatti();
    s.mde.value('Prima riga\nSeconda riga\nTerza riga');
    s.mde.codemirror.setCursor({line:2,ch:3});s.mde.codemirror.scrollTo(4,120);
    assert(h.ctx.noteFlushStato(s));
    const file=s.cur.file,punto=h.ctx.noteMemoria(s).punti[file];
    const riga=JSON.stringify(h.ctx.RIGA.appunti[file]);
    // Su macOS un titolo che cambia solo il caso può mantenere il nome file:
    // copiare il segno sulla stessa chiave e poi eliminarla lo perdeva.
    h.ctx.notesApi().rename=(corso,nome,titolo)=>{
      const nota=h.files[corso].find(n=>n.file===nome);nota.title=titolo;
      return {file:nome,nota:{...nota}};
    };
    h.rinomina(()=>Promise.resolve({testo:s.cur.title.toLowerCase(),scelta:''}));
    await h.ctx.noteRename(s);
    assert.equal(s.cur.file,file,'la rinomina conserva il nome effettivo restituito dal disco');
    assert.deepEqual(h.ctx.noteMemoria(s).punti[file],punto,'la rinomina delle maiuscole conserva cursore e scroll in ogni split');
    assert.equal(JSON.stringify(h.ctx.RIGA.appunti[file]),riga,'la rinomina sullo stesso file conserva il segno di lettura');
    assert.equal(s.mde.value(),'Prima riga\nSeconda riga\nTerza riga');
    h.ctx.noteMolla();
  }
}
async function eliminazioneInAttesa(){
  for(const indice of [0,1]){
    const h=harness(),s=h.ctx.noteStati()[indice];
    if(indice)h.api.open('b.md');
    const api=h.ctx.notesApi(),file=s.cur.file, salva=api.save;
    api.save=(id,nome,meta,body,opt)=>{
      // Il preload riscrive un percorso assente: non possiede un blocco di cancellazione.
      if(!h.files[id].some(n=>n.file===nome))h.files[id].push({file:nome});
      return salva(id,nome,meta,body,opt);
    };
    s.mde.value('Modifica ancora da salvare');
    let completa,rimozioni=0;
    api.remove=(id,nome)=>{
      rimozioni++;
      // Il main ha già spostato il file, la risposta IPC non è ancora arrivata.
      h.files[id]=h.files[id].filter(n=>n.file!==nome);
      return new Promise(r=>{completa=r;});
    };
    const cancellazione=h.ctx.noteDelete(s);
    assert.equal(s.mde.codemirror.getOption('readOnly'),true,'il testo non si modifica durante il Cestino');
    assert.equal(h.ctx.noteSave(true,s),false,'un autosave non ricrea il file appena rimosso');
    assert.equal(h.ctx.noteFlushStato(s),false);
    assert.equal(h.ctx.noteOpen('c.md',s),false,'non cambiare documento mentre la cancellazione è in attesa');
    assert.equal(h.ctx.noteMolla(),false,'non cambiare zaino durante la cancellazione');
    assert.equal(await h.ctx.noteDelete(s),false,'non inviare due cestinamenti dello stesso file');
    assert.equal(rimozioni,1);completa(true);assert.equal(await cancellazione,true);
    assert.equal(s.cur,null);assert(!h.files.uno.some(n=>n.file===file));
    assert.equal(s.mde.codemirror.getOption('readOnly'),false);
    h.ctx.noteOpen('c.md',s);s.mde.value('Modifica che deve sopravvivere al fallimento');
    api.remove=()=>new Promise(r=>{completa=r;});
    const fallita=h.ctx.noteDelete(s);completa(false);assert.equal(await fallita,false);
    assert(s.cur && s.dirty);assert.equal(s.mde.codemirror.getOption('readOnly'),false);
    h.scatti(1800);
    assert.equal(h.files.uno.find(n=>n.file==='c.md').body,'Modifica che deve sopravvivere al fallimento','il salvataggio automatico riparte dopo un errore');
    assert.equal(s.dirty,false);
    h.ctx.noteMolla();
  }
}

async function fonti(){
  const memoria=new Map(),deferred={},distrutti=[],scroller={scrollTop:110,scrollLeft:12};
  let corso='uno';
  const ctx={localStorage:{getItem:k=>memoria.get(k)||null,setItem:(k,v)=>memoria.set(k,v)},
    window:{vault:{srcUrl:(file,id)=>id+'/'+file}},corsoAttivo:()=>corso,
    $:()=>scroller,apertoScrivi(){},bancoMostra(){},fonte2Aggiorna(){},toast(){},
    pdfjsLib:{getDocument:({url})=>({promise:new Promise(r=>{deferred[url]=r;})})}};
  const start=html.indexOf('var FONTE2 ='),end=html.indexOf('/** La barra:',start);
  vm.createContext(ctx);vm.runInContext(html.slice(start,end),ctx);
  ctx.fonte2Avvia=()=>true;
  ctx.FONTE2.viewer={currentScaleValue:'1.5',setDocument(){}};ctx.FONTE2.link={setDocument(){}};
  Object.assign(ctx.FONTE2,{doc:{destroy(){}},file:'primo.pdf',corso:'uno',page:3});
  ctx.fonte2Ricorda();
  assert.equal(JSON.parse(memoria.get('studia.banco.c.uno.fonti2'))['primo.pdf'].page,3);
  assert.equal(JSON.parse(memoria.get('studia.banco.c.uno.fonti2'))['primo.pdf'].top,110);
  const lento=ctx.fonte2Apri('lento.pdf'),veloce=ctx.fonte2Apri('veloce.pdf');
  deferred['uno/veloce.pdf']({numPages:9,destroy(){}});await veloce;
  deferred['uno/lento.pdf']({destroy(){distrutti.push('lento');}});await lento;
  assert.equal(ctx.FONTE2.file,'veloce.pdf');assert.deepEqual(distrutti,['lento']);
  const vecchio=ctx.fonte2Apri('vecchio.pdf');ctx.fonte2Chiudi(true);corso='due';
  deferred['uno/vecchio.pdf']({destroy(){distrutti.push('vecchio');}});await vecchio;
  assert.equal(ctx.FONTE2.file,'');assert(distrutti.includes('vecchio'),'caricamento vecchio non compare nel nuovo zaino');
}
editor().then(creazione).then(rinominaSoloMaiuscole).then(eliminazioneInAttesa).then(fonti).then(()=>{
  for(const m of html.replace(/<!--[\s\S]*?-->/g,'').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
    if(!/\bsrc\s*=/.test(m[1]) && m[2].trim())new vm.Script(m[2]);
  }
  console.log('split-materiali: editor comune, destinazioni, salvataggio, anteprima, recupero, isolamento e ripristino OK');
}).catch(e=>{console.error(e);process.exitCode=1;});
