'use strict';
// Chiude davvero la finestra principale: errore disco, retry e ultima battuta ancora nel debounce.
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'zaino-presenta-chiusura-')),profilo=path.join(tmp,'profilo'),vault=path.join(tmp,'vault');fs.mkdirSync(profilo);
app.setPath('userData',profilo);app.commandLine.appendSwitch('user-data-dir',profilo);
require('../lib/zaini').crea(vault,'Scienze');fs.writeFileSync(path.join(profilo,'config.json'),JSON.stringify({vaultPath:vault,onboardingFatto:true}));
const P=require('../lib/presentazioni'),vero=P.salva;let rotto=false,ritardo=0;
P.salva=async(...args)=>{if(ritardo)await new Promise(r=>setTimeout(r,ritardo));if(rotto)throw Error('DISCO_PIENO_SIMULATO');return vero(...args);};
require('../main');
async function wait(fn){for(let n=0;n<150;n++){if(await fn())return;await new Promise(r=>setTimeout(r,100));}throw Error('Attesa della chiusura non soddisfatta.');}
app.whenReady().then(async()=>{
 await wait(()=>BrowserWindow.getAllWindows().some(w=>w.webContents.getURL().endsWith('/StudIA.html')));const win=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/StudIA.html'));
 const run=js=>win.webContents.executeJavaScript(js,true);await wait(()=>run('!!window.ZainoPresenta'));
 await run(`cambiaZaino('scienze',true);bancoMostra('presenta');document.querySelector('#presentaPane [aria-label="Documento"]').click()`);await wait(()=>run('document.querySelector(\'#presentaPane [data-presenta-action="nuova"]\')?.disabled===false'));
 const d=await run(`window.vault.presentazioni.comando({azione:'crea',corso:'scienze',title:'Chiusura protetta'})`);assert(d.ok,d.error);await run('ZainoPresenta.apri('+JSON.stringify(d.documento.id)+')');
 const sid=d.documento.stacks[0].slides[0].id;
 rotto=true;await run('ZainoPresenta.modifica({tipo:"titoloSlide",slideId:'+JSON.stringify(sid)+',title:"Ultima battuta"})');win.close();
 await wait(()=>run('document.querySelector("#presentaPane .presenta-stato").textContent.includes("DISCO_PIENO_SIMULATO")'));
 assert(!win.isDestroyed(),'l’errore disco impedisce la chiusura');assert(await run('ZainoPresenta.daSalvare'));
 assert.equal(P.leggi(vault,'scienze',d.documento.id).stacks[0].slides[0].title,'Nuova slide');assert.equal(P.recupera(vault,'scienze',d.documento.id).documento.stacks[0].slides[0].title,'Ultima battuta');
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
 // Simula l'ultima modifica DOM non ancora notificata: la chiusura deve interrogarla.
 await frame.executeJavaScript('document.querySelector("[contenteditable=true]").textContent="Scritta sul foglio subito prima di chiudere"');
 const closed=new Promise(r=>win.once('closed',r));win.close();await closed;
 assert.equal(P.leggi(vault,'scienze',d.documento.id).stacks[0].slides[0].title,'Scritta sul foglio subito prima di chiudere');
 console.log('✓ Chiusura reale: errore dichiarato, finestra e bozza conservate; retry attende la scrittura atomica dell’ultima battuta.');app.exit(0);
}).catch(e=>{console.error(e);app.exit(1);});
app.on('will-quit',()=>fs.rmSync(tmp,{recursive:true,force:true}));
