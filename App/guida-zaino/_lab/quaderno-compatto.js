'use strict';
// Solo dati dimostrativi nel laboratorio: nessun appunto personale.
const L=require('./lab'),fs=require('node:fs'),assert=require('node:assert/strict'),barre=require('./barre');
(async()=>{
 await L.collega();const vault=process.env.GUIDA_VAULT;
 assert(vault&&fs.realpathSync(vault).startsWith('/private/tmp/studia-guida-'));
 assert.equal(await L.val('window.vault.path'),vault);
 await L.pulito();await L.invia('Emulation.setDeviceMetricsOverride',{width:1470,height:956,deviceScaleFactor:2,mobile:false});
 await L.val(`bancoZoomTorna();cambiaZaino('biologia');document.documentElement.dataset.theme='chiaro';bancoForma('uno');bancoAssegna('A','appunti');notesApi().save('biologia',null,{title:'Botanica — appunti',materiale:'01 Botanica.pdf'},'Osservazioni sulle piante.');notesReload();noteOpen(NOTES.list.find(n=>!n.materiale).file,NOTES)`);
 assert(await L.finoA(`!!NOTES.cur && !!document.querySelector('#noteSelect').closest('.tendina').querySelector('[data-icona="notebook"]')`,10000));
 await L.pausa(600);await L.muovi(10,940);await barre.appunti(L);
 await L.tendinaFinta('#noteSelect',{largh:320,allinea:'sinistra'});const nt=await L.rect('#noteHost .notectl .tendina');
 await L.scatta('52-tendina-quaderno',{clip:{x:nt.x-10,y:nt.y-8,width:520,height:300},scala:2});await L.overlayPulisci();
 await L.val(`bancoForma('due-col');bancoAssegna('A','fonte');bancoAssegna('C','appunti');closeEditor(NOTES);document.getElementById('pdfClose').click()`);await L.pausa(600);await L.muovi(10,940);
 const area=await L.rect('#pdfPane');await L.scatta('204-strumenti-senza-documenti',{clip:{x:0,y:area.y-35,width:1470,height:290},scala:2});
 console.log('Quaderno SVG, menu e stato vuoto acquisiti.');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
