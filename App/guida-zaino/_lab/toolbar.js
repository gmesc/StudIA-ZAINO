'use strict';
// Riprese mirate su dati dimostrativi: nessun vault personale o provider esterno.
const L=require('./lab'),fs=require('fs'),assert=require('node:assert/strict'),barre=require('./barre');
async function wait(expr){assert(await L.finoA(expr,18000),expr);}
async function shot(nome,sel){await L.muovi(10,940);await L.pausa(500);await L.scatta(nome,{sel,scala:2,margine:4});}
(async()=>{
 await L.collega();const vault=process.env.GUIDA_VAULT;
 assert(vault&&fs.realpathSync(vault).startsWith('/private/tmp/studia-guida-'));assert.equal(await L.val('window.vault.path'),vault);
 await L.pulito();await L.invia('Emulation.setDeviceMetricsOverride',{width:1470,height:956,deviceScaleFactor:2,mobile:false});
 await L.val(`bancoZoomTorna();cambiaZaino('biologia');document.documentElement.dataset.theme='chiaro';bancoForma('uno');bancoAssegna('A','fonte');openPdf('01 Botanica.pdf',1,'Botanica',true)`);
 await wait(`!!PDFJS.doc && PDFJS.pronto`);await L.pausa(1200);await L.muovi(10,940);
 await barre.fonti(L);
 const tb=await L.rect('header.topbar');await L.banda({x:0,y:tb.y+tb.h,w:1470,h:0},{altezza:34});
 await L.numeri(['#zainoSelect','#searchBtn','#bancoBtn','#chatBtn','#settingsBtn','#themeToggle'].map((sel,i)=>({sel,n:i+1,dove:'b'})),{filo:tb.y+tb.h+5});
 await L.scatta('02-topbar-zaino',{clip:{x:0,y:0,width:1470,height:tb.h+36},scala:3});await L.overlayPulisci();
 await shot('23a-zoom-larghezza','#pdfZoom');await L.val('pdfZoomAdatta()');await L.pausa(500);await shot('23b-zoom-pagina','#pdfZoom');await L.val('pdfZoomPasso(true)');await L.pausa(500);await shot('23c-zoom-percento','#pdfZoom');
 await L.val(`bancoAssegna('A','appunti');notesReload();noteOpen(NOTES.list[0].file,NOTES)`);await wait(`!!NOTES.cur`);await L.pausa(500);await barre.appunti(L);
 await L.val(`(async()=>{const r=await mappeApi().salva(corsoAttivo(),null,{titolo:'La fotosintesi',nodi:[{id:'u1',testo:'La fotosintesi'},{id:'u2',testo:'Luce e clorofilla'},{id:'u3',testo:'Zuccheri e ossigeno'}],archi:[{da:'u1',a:'u2'},{da:'u1',a:'u3'}]});MAPPA.registro='mie';await mappaApriMia(r.file);bancoAssegna('A','mappa');})()`);await L.pausa(900);await barre.mappa(L);
 await L.val(`bancoForma('due-col');bancoAssegna('A','keyword');bancoAssegna('C','album');EVIDENZE.elenco=[{id:'guida-uno',exact:'clorofilla',materiale:'01 Botanica.pdf',pagina:1,colore:'#fdf14d',creato:'2026-10-16T12:00:00Z'},{id:'guida-due',exact:'fotosintesi',materiale:'01 Botanica.pdf',pagina:2,colore:'#67d9e8',creato:'2026-10-17T12:00:00Z'},{id:'guida-tre',exact:'zuccheri',materiale:'01 Botanica.pdf',pagina:3,colore:'#ff8ad0',creato:'2026-10-18T12:00:00Z'}];KW.ordine={criterio:'data',verso:'asc'};keywordDisegna()`);await L.pausa(500);
 const kw=await L.rect('#keywordPane');await L.muovi(10,940);await L.scatta('62-parole-chiave',{clip:{x:kw.x,y:kw.y-35,width:kw.w,height:230},scala:2});
 await L.val(`bancoAssegna('A','fonte');bancoAssegna('C','appunti');closeEditor(NOTES);document.getElementById('pdfClose').click()`);await L.pausa(700);await L.muovi(10,940);
 const area=await L.rect('#pdfPane');await L.scatta('204-strumenti-senza-documenti',{clip:{x:0,y:area.y-35,width:1470,height:290},scala:2});
 await L.val(`document.getElementById('chatBtn').click()`);await wait(`!document.getElementById('zchatWindow').hidden`);await shot('205-chat-comandi','#zchatHandle');
 await L.val(`document.getElementById('zchatScopeButton').click()`);await wait(`!document.getElementById('zchatScope').hidden`);await shot('190-chat-scelta-fonti','#zchatWindow');
 await L.val(`document.getElementById('zchatClose').click();document.getElementById('settingsBtn').click();document.querySelector('.set-tab[data-tab="zaino"]').click()`);await L.pausa(400);
 await shot('206-impostazioni-zaino','#settingsModal .media-card');await L.val(`document.getElementById('settingsClose').click()`);
 console.log('Toolbar Fonti, Appunti, Mappe, Parole chiave, chat e stato vuoto acquisite.');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
