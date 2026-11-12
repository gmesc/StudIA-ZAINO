'use strict';
// Chiude davvero la finestra principale: errore disco, retry e ultima battuta ancora nel debounce.
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'zaino-presenta-chiusura-')),profilo=path.join(tmp,'profilo'),vault=path.join(tmp,'vault');fs.mkdirSync(profilo);
app.setPath('userData',profilo);app.commandLine.appendSwitch('user-data-dir',profilo);
require('../lib/zaini').crea(vault,'Scienze');fs.writeFileSync(path.join(profilo,'config.json'),JSON.stringify({vaultPath:vault,onboardingFatto:true}));
const P=require('../lib/presentazioni'),vero=P.salva;let rotto=false,ritardo=0;
P.salva=async(...args)=>{if(ritardo)await new Promise(r=>setTimeout(r,ritardo));if(rotto)throw Error('DISCO_PIENO_SIMULATO');return vero(...args);};
// Simula un main rimasto aperto prima dell’aggiornamento: non comunica il catalogo.
let catalogoVecchio=false,controllaTuning=false,esitoTuning=null;const IPC=require('../lib/presentazioni-ipc'),installa=IPC.installa;
IPC.installa=o=>{const handle=o.win.webContents.ipc.handle;o.win.webContents.ipc.handle=function(canale,fn){return handle.call(this,canale,async(...args)=>{
 if(controllaTuning&&args[1]?.azione==='chiusuraPronta')esitoTuning=await o.win.webContents.executeJavaScript('({conferme:window.__chiusuraTuning.conferme,nome:document.querySelector(\'.tuning-identita [aria-label="Nome dello stile"]\').value,salvato:ZainoRaccolta.elenco("mappa")[0].pacchetto.nome})');
 const r=await fn(...args);if(catalogoVecchio&&args[1]?.azione==='strumenti')delete r.effetti;return r;
 });};try{return installa(o);}finally{o.win.webContents.ipc.handle=handle;}};
require('../main');
async function wait(fn){for(let n=0;n<150;n++){if(await fn())return;await new Promise(r=>setTimeout(r,100));}throw Error('Attesa della chiusura non soddisfatta.');}
app.whenReady().then(async()=>{
 await wait(()=>BrowserWindow.getAllWindows().some(w=>w.webContents.getURL().endsWith('/StudIA.html')));const win=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/StudIA.html'));
 const run=js=>win.webContents.executeJavaScript(js,true);await wait(()=>run('!!window.ZainoPresenta'));
 let chiusuraAttesa=false;win.once('closed',()=>{if(!chiusuraAttesa){console.error('La finestra si è chiusa nonostante modifiche o errori da conservare.');app.exit(1);}});
 const preparaTuning=async accetta=>{
  await run('ZainoTuning.apri("mappa",ZainoRaccolta.elenco("mappa")[0].id)');await wait(()=>run('!!document.querySelector(".tuning-finestra>iframe")?.contentWindow.ZainoTuningAmbiente'));
  const nomeSalvato=await run('ZainoRaccolta.elenco("mappa")[0].pacchetto.nome');
  await run('(()=>{window.__chiusuraTuning={conferme:0,accetta:'+accetta+',confermaOriginale:window.confirm,toastOriginale:window.toast,errori:[]};window.confirm=()=>{__chiusuraTuning.conferme++;return __chiusuraTuning.accetta;};window.toast=(...args)=>{__chiusuraTuning.errori.push(args);};const campoTuning=document.querySelector(\'.tuning-identita [aria-label="Nome dello stile"]\');campoTuning.value="Stile non salvato";campoTuning.dispatchEvent(new Event("input",{bubbles:true}));})()');
  controllaTuning=true;esitoTuning=null;return nomeSalvato;
 };
 await run(`cambiaZaino('scienze',true);bancoMostra('presenta');document.querySelector('#presentaPane [aria-label="Documento"]').click()`);await wait(()=>run('document.querySelector(\'#presentaPane [data-presenta-action="nuova"]\')?.disabled===false'));
 const d=await run(`window.vault.presentazioni.comando({azione:'crea',corso:'scienze',title:'Chiusura protetta'})`);assert(d.ok,d.error);await run('ZainoPresenta.apri('+JSON.stringify(d.documento.id)+')');
 const sid=d.documento.stacks[0].slides[0].id;
 await run('ZainoPresenta.modifica({tipo:"titoloSlide",slideId:'+JSON.stringify(sid)+',title:"Titolo di prova"});ZainoPresenta.flush()');
 const apriGalleria=async()=>{await run(`document.querySelector('#presentaPane [aria-label="Titolo"]').click();document.querySelector('.presenta-animazioni').open=true;document.querySelector('#presentaPane [aria-label="Scegli un’animazione"]').click()`);await wait(()=>run('!!document.querySelector(".presenta-galleria-animazioni[open]")'));await run(`document.querySelector('.presenta-effetto-card[data-effetto="letters"]').click()`);};
 catalogoVecchio=true;await apriGalleria();
 assert(await run(`document.querySelector('.presenta-galleria-animazioni [aria-label="Applica all’oggetto"]').disabled`),'un main precedente non permette di applicare lettere e bloccare il salvataggio');
 assert(await run(`document.querySelector('.presenta-runtime-avviso').textContent.includes('chiudi e riapri')`));
 assert.equal(await run('ZainoPresenta.documento.stacks[0].slides[0].animations.length'),0,'la galleria precedente non sporca il documento');
 await run(`document.querySelector('.presenta-galleria-animazioni [aria-label="Chiudi galleria"]').click()`);
 catalogoVecchio=false;await apriGalleria();
 assert(!await run(`document.querySelector('.presenta-galleria-animazioni [aria-label="Applica all’oggetto"]').disabled`));
 await run(`document.querySelector('.presenta-galleria-animazioni [aria-label="Applica all’oggetto"]').click();ZainoPresenta.flush()`);
 assert.equal(P.leggi(vault,'scienze',d.documento.id).stacks[0].slides[0].animations[0].effect,'letters','il nuovo effetto si salva sul disco');

 const nomeTuning=await preparaTuning(false);win.close();await wait(()=>esitoTuning!==null||win.isDestroyed());
 assert(!win.isDestroyed(),'rifiutare lo scarto dello stile impedisce la chiusura nativa');assert.deepEqual(esitoTuning,{conferme:1,nome:'Stile non salvato',salvato:nomeTuning});
 assert(await run('!!document.querySelector(".tuning-finestra[open]")'),'la demo resta aperta e correggibile');assert.equal(await run('__chiusuraTuning.errori.length'),0,'annullare la chiusura non mostra un errore');
 await run('__chiusuraTuning.accetta=true;[...document.querySelector(".tuning-finestra").querySelectorAll("button")].find(b=>b.textContent==="Chiudi").click()');await wait(()=>run('!document.querySelector(".tuning-finestra")'));
 assert.equal(await run('__chiusuraTuning.conferme'),2,'il rifiuto mantiene le modifiche non salvate per il tentativo successivo');
 await run('void(window.confirm=__chiusuraTuning.confermaOriginale);void(window.toast=__chiusuraTuning.toastOriginale)');controllaTuning=false;await run('document.getElementById("settingsClose").click()');

 rotto=true;await run('ZainoPresenta.modifica({tipo:"titoloSlide",slideId:'+JSON.stringify(sid)+',title:"Ultima battuta"})');win.close();
 await wait(()=>run('document.querySelector("#presentaPane .presenta-stato").textContent.includes("DISCO_PIENO_SIMULATO")'));
 assert(!win.isDestroyed(),'l’errore disco impedisce la chiusura');assert(await run('ZainoPresenta.daSalvare'));
 assert.equal(P.leggi(vault,'scienze',d.documento.id).stacks[0].slides[0].title,'Titolo di prova');assert.equal(P.recupera(vault,'scienze',d.documento.id).documento.stacks[0].slides[0].title,'Ultima battuta');
 rotto=false;ritardo=250;
 await run('ZainoPresenta.modifica({tipo:"titoloSlide",slideId:'+JSON.stringify(sid)+',title:"Scritta un attimo prima di chiudere"})');
 await wait(()=>win.webContents.mainFrame.frames.some(f=>f.url.includes('/presentazioni-player/index.html')));
 const frame=win.webContents.mainFrame.frames.find(f=>f.url.includes('/presentazioni-player/index.html'));
 await wait(()=>frame.executeJavaScript('document.querySelector(".reveal")?.dataset.bloccato==="false"'));
 await frame.executeJavaScript('document.querySelector("[data-testo-id]").dispatchEvent(new MouseEvent("dblclick",{bubbles:true,cancelable:true}))');
 await wait(()=>run(`!!document.querySelector('[aria-label="Carattere delle parole"]')`));
 // Un contenuto non valido resta correggibile sul foglio e non conferma il salvataggio.
 await frame.executeJavaScript('document.querySelector("[contenteditable=true]").textContent="x".repeat(100001)');
 const erroreTesto=await run('ZainoPresenta.flush().then(()=>null,e=>e.message)');
 assert(erroreTesto?.includes('Testo formattato non valido'),'il flush rifiuta il testo fuori limite');
 win.close();await wait(()=>run('document.querySelector("#presentaPane .presenta-stato").textContent.includes("Testo formattato non valido")'));
 assert(!win.isDestroyed(),'il testo non valido impedisce la chiusura');
 assert.equal(await frame.executeJavaScript('document.querySelector("[contenteditable=true]").textContent.length'),100001,'il testo resta correggibile');
 // Anche il popup interroga il DOM prima del flush, e conserva un errore correggibile.
 await frame.executeJavaScript('document.querySelector("[contenteditable=true]").textContent="Titolo corretto"');await run('ZainoPresenta.flush()');
 await run(`document.querySelector('[aria-label="Termina scrittura"]').click();document.querySelector('#presentaPane [aria-label="Titolo"]').click();document.querySelector('#presentaPane [aria-label="Titolo della slide"]').click()`);
 await wait(()=>run('!!document.querySelector(".presenta-input-popup input")'));
 await run('document.querySelector(".presenta-input-popup input").value="x".repeat(141)');
 assert((await run('ZainoPresenta.flush().then(()=>null,e=>e.message)')).includes('limite'));
 assert(await run('ZainoPresenta.daSalvare'),'una bozza non valida nel popup resta segnalata');
 await run('document.querySelector(".presenta-input-popup input").value="Ultima battuta dal popup"');await run('ZainoPresenta.flush()');
 assert.equal(P.leggi(vault,'scienze',d.documento.id).stacks[0].slides[0].title,'Ultima battuta dal popup');
 await run(`document.querySelector('.presenta-input-popup [aria-label="Chiudi campo"]').click()`);
 await wait(()=>frame.executeJavaScript('document.querySelector(".reveal")?.dataset.bloccato==="false"'));
 await frame.executeJavaScript('document.querySelector("[data-testo-id]").dispatchEvent(new MouseEvent("dblclick",{bubbles:true,cancelable:true}))');
 await wait(()=>run(`!!document.querySelector('[aria-label="Carattere delle parole"]')`));
 const nomeFinaleTuning=await preparaTuning(true);
 // Simula l'ultima modifica DOM non ancora notificata: la chiusura deve interrogarla.
 await frame.executeJavaScript('document.querySelector("[contenteditable=true]").textContent="Scritta sul foglio subito prima di chiudere"');
 const closed=new Promise(r=>win.once('closed',r));chiusuraAttesa=true;win.close();await closed;
 assert.deepEqual(esitoTuning,{conferme:1,nome:'Stile non salvato',salvato:nomeFinaleTuning},'accettare lo scarto chiude davvero senza salvare implicitamente lo stile');
 assert.equal(P.leggi(vault,'scienze',d.documento.id).stacks[0].slides[0].title,'Scritta sul foglio subito prima di chiudere');
 assert.equal(P.leggi(vault,'scienze',d.documento.id).stacks[0].slides[0].animations[0].effect,'letters','l’effetto è conservato anche dopo la chiusura');
 console.log('✓ Cataloghi disallineati bloccati prima della modifica; nuovo effetto salvato e conservato. Chiusura reale: errore dichiarato, finestra e bozza conservate; retry attende la scrittura atomica dell’ultima battuta.');app.exit(0);
}).catch(e=>{console.error(e);app.exit(1);});
app.on('will-quit',()=>fs.rmSync(tmp,{recursive:true,force:true}));
