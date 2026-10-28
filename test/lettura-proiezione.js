'use strict';
const assert=require('node:assert/strict'),L=require('../App/assets/banco/lettura');
assert.equal(L.scala('x'),100);assert.equal(L.scala(500),300);assert.equal(L.scala(20),75);
assert.equal(L.passo(100,1),125);assert.equal(L.passo(200,-1),175);assert.equal(L.passo(300,1),300);
assert.deepEqual(L.rettangolo({x:100,y:20,width:1000,height:700},{width:800,height:600}),{x:100,y:20,width:700,height:580});
assert.deepEqual(L.rettangolo({x:-20,y:-10,width:100,height:80},{width:800,height:600}),{x:0,y:0,width:80,height:70});
assert.throws(()=>L.rettangolo({x:900,y:0,width:50,height:30},{width:800,height:600}));
assert.throws(()=>L.rettangolo({x:0,y:NaN,width:50,height:30},{width:800,height:600}));
assert.deepEqual(L.inquadratura({x:10,y:20,width:600,height:900},{width:1600,height:900,scala:100}),{x:10,y:20,width:600,height:337});
assert.deepEqual(L.inquadratura({x:10,y:20,width:600,height:900},{width:1600,height:900,scala:200},{x:1,y:1}),{x:310,y:752,width:300,height:168});
assert.deepEqual(L.inquadratura({x:0,y:0,width:600,height:300},{width:600,height:900,scala:100}),{x:0,y:0,width:600,height:300});
assert.throws(()=>L.inquadratura({x:0,y:0,width:600,height:300},{width:0,height:900,scala:100}));
const a=L.ancora([{id:0,top:-100,height:80},{id:1,top:-20,height:100},{id:2,top:80,height:200}],0);
assert.deepEqual(a,{id:'1',frazione:.2});assert.equal(L.posizione({top:500,height:200},a),540,'stesso passaggio in una colonna di misura diversa');
const w={isDestroyed:()=>false,webContents:{mainFrame:{url:'file:///app.html'}}};
const e={sender:w.webContents,senderFrame:w.webContents.mainFrame};assert(L.mittente(e,w,'file:///app.html'));
assert(!L.mittente({...e,senderFrame:{url:'file:///app.html'}},w,'file:///app.html'),'un sottoframe non ottiene i comandi di proiezione');
assert(!L.mittente(e,w,'file:///altro.html'));assert(!L.mittente({...e,sender:{}},w,'file:///app.html'));
console.log('Lettura: scala, ancore, ritaglio e confine della finestra verificati.');

// Il ciclo delle finestre e i confini IPC si verificano senza Electron né vault.
(async()=>{
 const {EventEmitter}=require('node:events'),{pathToFileURL}=require('node:url');
 class Finestra extends EventEmitter{
  static create=[];
  constructor(opzioni={}){super();this.opzioni=opzioni;this.destroyed=false;this.full=false;this.bounds={x:0,y:0,width:800,height:600};this.canali=new Map();this.messaggi=[];
   this.webContents=new EventEmitter();Object.assign(this.webContents,{ipc:{handle:(k,f)=>this.canali.set(k,f)},mainFrame:{url:''},send:(k,d)=>this.messaggi.push([k,d]),setWindowOpenHandler:f=>this.open=f,session:{setPermissionRequestHandler:f=>this.permission=f,setPermissionCheckHandler:f=>this.check=f,webRequest:{onBeforeRequest:(_r,f)=>this.request=f}},capturePage:async r=>{this.capture=r;return {toDataURL:()=> 'data:image/png;base64,cHJvdmE='};}});Finestra.create.push(this);
  }
  isDestroyed(){return this.destroyed;}isFullScreen(){return this.full;}
  setFullScreen(v){this.full=v;this.emit(v?'enter-full-screen':'leave-full-screen');}
  getBounds(){return this.bounds;}setBounds(r){this.bounds=r;}getContentSize(){return [800,600];}
  async loadFile(f){this.webContents.mainFrame.url=pathToFileURL(f).href;}showInactive(){}show(){}
  close(){this.destroyed=true;this.emit('closed');}
  async call(k,o,evento){return this.canali.get(k)(evento||{sender:this.webContents,senderFrame:this.webContents.mainFrame},o);}
 }
 const primary={id:1,label:'Portatile',workArea:{x:0,y:0,width:800,height:600},bounds:{x:0,y:0,width:800,height:600}},external={id:2,label:'Proiettore',workArea:{x:800,y:0,width:1200,height:800},bounds:{x:800,y:0,width:1200,height:800}};
 const screen=new EventEmitter();let displays=[primary,external];Object.assign(screen,{getAllDisplays:()=>displays,getDisplayMatching:r=>r.x>=800?external:primary,getPrimaryDisplay:()=>primary});
 const win=new Finestra();win.webContents.mainFrame.url='file:///app/StudIA.html';require('../lib/proiezione').installa({win,BrowserWindow:Finestra,screen,appDir:'/app'});
 await win.call('presentazione:intero',{attivo:true});assert(win.full);await win.call('presentazione:intero',{attivo:false});assert(!win.full);
 win.setFullScreen(true);await win.call('presentazione:intero',{attivo:true});await win.call('presentazione:intero',{attivo:false});assert(win.full,'ripristina la finestra già a schermo intero');win.setFullScreen(false);
 const first=await win.call('proiezione:apri');assert(first.ok);const p=Finestra.create.at(-1);assert.equal(p.opzioni.x,800);assert(p.opzioni.webPreferences.sandbox);assert(!p.opzioni.webPreferences.nodeIntegration);assert.equal(p.check(),false);
 assert.equal((await win.call('proiezione:aggiorna',{sessione:first.sessione,tipo:'testo',html:'<p>Prova</p>'},{sender:p.webContents,senderFrame:p.webContents.mainFrame})).ok,false);
 assert.equal((await win.call('proiezione:aggiorna',{sessione:'scaduta',tipo:'testo'})).chiusa,true);
 assert.equal((await win.call('proiezione:aggiorna',{sessione:first.sessione,tipo:'testo',html:'<p>Prova</p>'})).ok,true);
 assert.equal(p.messaggi.at(-1)[1].html,'<p>Prova</p>');
 assert.equal((await win.call('proiezione:aggiorna',{sessione:first.sessione,tipo:'immagine',area:{x:10,y:10,width:900,height:700}})).ok,true);
 assert.deepEqual(win.capture,{x:10,y:10,width:790,height:590});
 await p.call('proiezione:comando',{azione:'vista',width:1600,height:900,scala:125});
 assert.deepEqual(win.messaggi.at(-1),['proiezione:vista',{sessione:first.sessione,vista:{width:1600,height:900,scala:125}}]);
 assert.equal((await p.call('proiezione:comando',{azione:'vista',width:NaN,height:900,scala:100})).ok,false);
 assert.equal((await p.call('proiezione:comando',{azione:'vista',width:0,height:900,scala:100})).ok,false);
 await new Promise(ok=>p.request({url:'file:///segreto.txt'},r=>{assert(r.cancel);ok();}));
 await new Promise(ok=>p.request({url:'https://example.com'},r=>{assert(r.cancel);ok();}));
 await p.call('proiezione:comando',{azione:'schermo',id:2});assert.equal(p.bounds.x,800);
 displays=[primary];screen.emit('display-removed');assert.equal(p.bounds.x,0,'il distacco del proiettore recupera la finestra sul portatile');
 assert.equal((await p.call('proiezione:comando',{azione:'schermo',id:3})).ok,false);
 await p.call('proiezione:comando',{azione:'intero'});assert(p.full);
 let prevented=false;p.webContents.emit('before-input-event',{preventDefault:()=>prevented=true},{type:'keyDown',key:'Escape'});assert(prevented&&!p.full&&!p.destroyed);
 const second=await win.call('proiezione:apri');assert(p.destroyed);assert.notEqual(second.sessione,first.sessione);
 assert.equal((await win.call('proiezione:aggiorna',{sessione:first.sessione,tipo:'testo'})).chiusa,true);
 win.close();assert(Finestra.create.at(-1).destroyed);assert.equal(screen.listenerCount('display-added'),0);
 console.log('Proiezione: isolamento, lifecycle, schermi e ripristino fullscreen verificati.');
})().catch(e=>{console.error(e);process.exitCode=1;});
