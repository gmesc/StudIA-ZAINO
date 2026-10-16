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

function harness(){
  let corso='uno',errore=false,visibili=['appunti','appunti2'],titolo=()=>Promise.resolve({titolo:'Nuovo',materiale:''});
  const files={uno:[{file:'a.md',title:'A',body:'Appunto A'},{file:'b.md',title:'B',body:'Appunto B'}],due:[{file:'b.md',title:'Altro B',body:'Altro zaino'}]};
  const dati=new Map(),salvati=[],messaggi=[],aperti=[];
  const elementi=new Map(),eventiDom={},eventiWindow={};
  function elemento(id){
    if(!elementi.has(id)) elementi.set(id,{id,value:'',innerHTML:'',hidden:false,offsetParent:true,options:[],addEventListener(){},appendChild(o){this.options.push(o);},querySelector(sel){return sel==='.editor-preview-active'?(this.anteprima?{}:null):{insertAdjacentHTML(){}};}});
    return elementi.get(id);
  }
  class Mde{
    constructor(opt){
      this.host=elemento(opt&&opt.element.id==='noteArea2'?'noteHost2':'noteHost');
      this.body='';const eventi={},opzioni={};
      const cm=this.codemirror={on(t,f){eventi[t]=f;},setOption(k,v){opzioni[k]=v;},getOption(k){return opzioni[k];},
        getCursor(){return cm.cursor||{line:0,ch:0};},getScrollInfo(){return {top:cm.top||0,left:cm.left||0};},
        setCursor(p){cm.cursor=p;},scrollTo(x,y){cm.left=x;cm.top=y;},focus(){cm.focalizzato=true;},refresh(){},
        lastLine:()=>this.body.split('\n').length-1,getLine:n=>this.body.split('\n')[n],scrollIntoView(){},
        replaceRange:(t,p)=>{const righe=this.body.split('\n');righe[p.line]=righe[p.line].slice(0,p.ch)+t+righe[p.line].slice(p.ch);this.value(righe.join('\n'));}};
      this.value=(v)=>{if(v===undefined)return this.body;this.body=v;if(eventi.change)eventi.change();};
      this.togglePreview=()=>{this.host.anteprima=!this.host.anteprima;};
    }
  }
  const win={document:{getElementById:elemento,createElement(){return {};},addEventListener(t,f){eventiDom[t]=f;}},
    localStorage:{getItem:k=>dati.get(k)||null,setItem:(k,v)=>dati.set(k,v)},EasyMDE:Mde,
    addEventListener(t,f){eventiWindow[t]=f;},
    NOTES:{cur:{file:'a.md'},courseId:'uno'},corsoAttivo:()=>corso,bancoVisibile:id=>visibili.includes(id),
    bancoMostra:id=>aperti.push(id),bancoTogli(){},openEditor(){},toast:t=>messaggi.push(t),tendinaViva(){},tastiNelDom(){},
    renderNoteMd:t=>t,noteMeta:n=>({title:n.title,materiale:n.materiale||''}),notesReload(){},refreshNoteUI(){},refreshMyNotes(){},
    apertoScrivi(k,v){salvati.push({k,v});},
    notesApi:()=>({leggi:id=>({notes:JSON.parse(JSON.stringify(files[id])),error:''}),
      save(id,file,meta,body,opt){
        if(errore)return {error:'Disco non scrivibile'};
        if(!file){file='nuovo-'+files[id].length+'.md';files[id].push({file});}
        const n=files[id].find(n=>n.file===file);assert(n,'salvataggio nel corretto zaino');
        Object.assign(n,meta,{body});salvati.push({id,file,body,opt});return {file};
      }})};
  win.NOTES.mde=new Mde(); win.NOTES.mde.value(files.uno[0].body);
  const contesto={window:win,document:win.document,console,NOTES:win.NOTES,setTimeout,clearTimeout,requestAnimationFrame:f=>f(),
    openEditor:()=>aperti.push('appunti'),noteSave:()=>{files.uno[0].body=win.NOTES.mde.value();salvati.push({primario:true});},
    bancoVisibile:id=>visibili.includes(id),corsoAttivo:()=>corso,noteOpen:file=>aperti.push(file),
    curCtx:()=>({courseId:corso,materiale:'',pagina:''}),notesApi:win.notesApi,toast:win.toast,
    notesReload:win.notesReload,refreshNoteUI:win.refreshNoteUI,noteChiediNomeEOrigine:()=>titolo(),
    frammentoAppuntato:t=>'Citazione: '+t};
  vm.createContext(contesto);vm.runInContext(modulo,contesto);
  const funzioni=html.slice(html.indexOf('function noteStatoAttivo('),html.indexOf('function noteOpen('));
  if(funzioni)vm.runInContext(funzioni,contesto);
  vm.runInContext(html.slice(html.indexOf('function noteInserisci('),html.indexOf('/**',html.indexOf('function noteInserisci('))),contesto);
  for(const nome of ['noteNasce','noteNew','noteAppend']){
    const a=html.indexOf((nome==='noteNasce'?'function ':'async function ')+nome+'(');
    vm.runInContext(html.slice(a,html.indexOf('/**',a)),contesto);
  }
  const anticipo=html.indexOf(' * ⌘J: accende'),inizio=html.indexOf('(function(){',anticipo);
  vm.runInContext(html.slice(inizio,html.indexOf('})();',inizio)+5),contesto);
  return {api:win.appuntiParalleli,titolo:f=>{titolo=f;},aperti,visibili:v=>{visibili=v;},anteprima(){eventiWindow.keydown({key:'j',metaKey:true,target:{closest:()=>null},preventDefault(){},stopPropagation(){}});},win,files,dati,salvati,messaggi,contesto,tocca(id){const e={target:{closest:()=>({id})}};if(eventiDom.pointerdown)eventiDom.pointerdown(e);},corso:v=>{corso=v;},errore:v=>{errore=v;}};
}
// Una citazione dopo aver lavorato nel secondo riquadro appartiene a quel file.
const fuoco=harness();fuoco.api.open('b.md');fuoco.tocca('notePane2');
assert.equal(fuoco.contesto.noteInserisci('Citazione destinata al secondo'),true);
assert.match(fuoco.api.stato.mde.value(),/Citazione destinata al secondo/,'Appunta segue il riquadro toccato');
assert.equal(fuoco.win.NOTES.mde.value(),'Appunto A','il primo appunto non viene alterato');
assert.equal(fuoco.files.uno[0].body,'Appunto A','il salvataggio lascia il primo file intatto');
assert.match(fuoco.files.uno[1].body,/Citazione destinata al secondo/,'si salva il file del secondo riquadro');
fuoco.anteprima();assert(fuoco.api.stato.mde.host.anteprima);assert(!fuoco.win.NOTES.mde.host.anteprima);
fuoco.anteprima();assert(!fuoco.api.stato.mde.host.anteprima);assert(fuoco.api.stato.mde.codemirror.focalizzato,'uscendo dalla preview il cursore torna al secondo editor');
fuoco.tocca('notePane');fuoco.contesto.noteInserisci('Citazione destinata al primo');
assert.match(fuoco.win.NOTES.mde.value(),/Citazione destinata al primo/);
assert.match(fuoco.files.uno[0].body,/Citazione destinata al primo/);
assert(!fuoco.files.uno[1].body.includes('destinata al primo'));
fuoco.tocca('notePane2');fuoco.visibili(['appunti']);
assert.equal(fuoco.contesto.noteStatoAttivo(),fuoco.win.NOTES,'uno split nascosto non riceve inserimenti');
fuoco.visibili(['appunti','appunti2']);fuoco.contesto.noteApriAttivo('a.md');
assert.equal(fuoco.contesto.noteStatoAttivo(),fuoco.win.NOTES,'aprire un file già nel primo riquadro lo attiva');
fuoco.visibili(['appunti2']);fuoco.tocca('notePane');
assert.equal(fuoco.contesto.noteStatoAttivo(),fuoco.api.stato,'si usa l’unico editor visibile');
fuoco.api.molla();
const h=harness(), a=h.api;
assert.equal(a.open('a.md'),false,'stesso appunto bloccato prima di caricare');
assert.match(h.messaggi.pop(),/già aperto/);
assert.equal(a.open('b.md'),true);
assert.equal(a.stato.mde.value(),'Appunto B');
a.stato.mde.value('Modifica indipendente');
assert(a.stato.dirty);assert.equal(a.flush(),true);
assert.equal(h.files.uno[1].body,'Modifica indipendente');assert.equal(h.files.uno[0].body,'Appunto A');
a.stato.mde.codemirror.setCursor({line:3,ch:1});a.stato.mde.codemirror.scrollTo(4,120);
a.flush();a.molla();a.open('b.md');
assert.equal(a.stato.mde.codemirror.getScrollInfo().top,120);
assert.equal(a.stato.mde.codemirror.getCursor().line,3);
assert(a.occupato('b.md','uno'));assert(!a.occupato('b.md','due'));
a.stato.mde.value('Prima del cambio zaino');a.molla();h.corso('due');a.open('b.md');
assert.equal(h.files.uno[1].body,'Prima del cambio zaino');assert.equal(a.stato.mde.value(),'Altro zaino');
a.stato.mde.value('Da recuperare');h.errore(true);assert.equal(a.flush(),false);
assert.match(h.messaggi.at(-1),/bozza resta conservata/);
assert.equal(a.molla(),true);h.errore(false);a.open('b.md');
assert.equal(a.stato.mde.value(),'Da recuperare');assert(a.stato.dirty);
assert.equal(a.save(false),true);assert.equal(h.files.due[0].body,'Da recuperare');
assert(h.salvati.at(-1).opt.svuota);a.molla();

async function creazione(){
  const h=harness();h.api.layout();h.tocca('notePane2');
  assert.equal(h.api.stato.cur,null);
  assert.equal(await h.contesto.noteAppend('Primo frammento'),true);
  assert(h.api.stato.cur,'Appunta nel secondo split vuoto apre lì il nuovo appunto');
  assert.match(h.api.stato.mde.value(),/Primo frammento/);
  assert.equal(h.files.uno[0].body,'Appunto A');
  assert.equal(h.win.NOTES.cur.file,'a.md');
  assert(h.files.uno.some(n=>n.file===h.api.stato.cur.file && n.body.includes('Primo frammento')));
  h.api.molla();
  // Il dialogo può tenere aperto il vecchio contesto: non scrivere nel nuovo zaino.
  let completa;h.titolo(()=>new Promise(r=>{completa=r;}));h.tocca('notePane2');
  const attesa=h.contesto.noteAppend('Non deve finire altrove');h.corso('due');
  completa({titolo:'Titolo tardivo',materiale:''});
  assert.equal(await attesa,false);assert.equal(h.files.uno.length,3);assert.equal(h.files.due.length,1);
  // L'editor che riceverà il testo è quello scelto prima del dialogo.
  h.corso('uno');h.tocca('notePane2');const nelloSplit=h.contesto.noteAppend('Destinazione catturata');
  h.tocca('notePane');completa({titolo:'Secondo nuovo',materiale:''});
  assert.equal(await nelloSplit,true);assert.match(h.api.stato.mde.value(),/Destinazione catturata/);
  h.api.molla();
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
creazione().then(fonti).then(()=>{
  for(const m of html.replace(/<!--[\s\S]*?-->/g,'').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
    if(!/\bsrc\s*=/.test(m[1]) && m[2].trim())new vm.Script(m[2]);
  }
  console.log('split-materiali: istanze, salvataggio, recupero, isolamento e ripristino OK');
}).catch(e=>{console.error(e);process.exitCode=1;});
