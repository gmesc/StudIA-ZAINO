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
  let corso='uno',errore=false;
  const files={uno:[{file:'a.md',title:'A',body:'Appunto A'},{file:'b.md',title:'B',body:'Appunto B'}],due:[{file:'b.md',title:'Altro B',body:'Altro zaino'}]};
  const dati=new Map(),salvati=[],messaggi=[],aperti=[];
  const elementi=new Map();
  function elemento(id){
    if(!elementi.has(id)) elementi.set(id,{id,value:'',innerHTML:'',hidden:false,options:[],addEventListener(){},appendChild(o){this.options.push(o);},querySelector(){return {insertAdjacentHTML(){}};}});
    return elementi.get(id);
  }
  class Mde{
    constructor(){
      this.body='';const eventi={},opzioni={};
      const cm=this.codemirror={on(t,f){eventi[t]=f;},setOption(k,v){opzioni[k]=v;},getOption(k){return opzioni[k];},
        getCursor(){return cm.cursor||{line:0,ch:0};},getScrollInfo(){return {top:cm.top||0,left:cm.left||0};},
        setCursor(p){cm.cursor=p;},scrollTo(x,y){cm.left=x;cm.top=y;},focus(){},refresh(){}};
      this.value=(v)=>{if(v===undefined)return this.body;this.body=v;if(eventi.change)eventi.change();};
    }
  }
  const win={document:{getElementById:elemento,createElement(){return {};},addEventListener(){}},
    localStorage:{getItem:k=>dati.get(k)||null,setItem:(k,v)=>dati.set(k,v)},EasyMDE:Mde,
    NOTES:{cur:{file:'a.md'},courseId:'uno'},corsoAttivo:()=>corso,bancoVisibile:()=>true,
    bancoMostra:id=>aperti.push(id),bancoTogli(){},openEditor(){},toast:t=>messaggi.push(t),tendinaViva(){},tastiNelDom(){},
    renderNoteMd:t=>t,noteMeta:n=>({title:n.title,materiale:n.materiale||''}),notesReload(){},refreshNoteUI(){},refreshMyNotes(){},
    apertoScrivi(k,v){salvati.push({k,v});},
    notesApi:()=>({leggi:id=>({notes:JSON.parse(JSON.stringify(files[id])),error:''}),
      save(id,file,meta,body,opt){
        if(errore)return {error:'Disco non scrivibile'};
        const n=files[id].find(n=>n.file===file);assert(n,'salvataggio nel corretto zaino');
        Object.assign(n,meta,{body});salvati.push({id,file,body,opt});return {file};
      }})};
  vm.runInNewContext(modulo,{window:win,setTimeout,clearTimeout,requestAnimationFrame:f=>f()});
  return {api:win.appuntiParalleli,win,files,dati,salvati,messaggi,corso:v=>{corso=v;},errore:v=>{errore=v;}};
}
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
fonti().then(()=>{
  for(const m of html.replace(/<!--[\s\S]*?-->/g,'').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
    if(!/\bsrc\s*=/.test(m[1]) && m[2].trim())new vm.Script(m[2]);
  }
  console.log('split-materiali: istanze, salvataggio, recupero, isolamento e ripristino OK');
}).catch(e=>{console.error(e);process.exitCode=1;});
