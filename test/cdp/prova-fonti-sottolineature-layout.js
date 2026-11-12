'use strict';
// Vault sintetico: i segni devono avere intervalli visibili anche dopo il
// montaggio dei pannelli. Il disco da solo non dimostra che siano dipinti.
const assert=require('node:assert/strict'),c=require('./cdp');
async function aspetta(expr){for(let i=0;i<150;i++){if(await c.val(expr))return;await c.pausa(80);}throw Error('Attesa: '+expr);}
const misura=`(()=>{const out=[];for(const [n,h]of CSS.highlights){if(!n.startsWith('ev-'))continue;for(const r of h){const b=r.getBoundingClientRect();out.push({testo:r.toString(),w:b.width,h:b.height,connesso:r.startContainer.isConnected});}}return out;})()`;
async function dipinta(gesto){const r=await c.val(misura);console.log(gesto,JSON.stringify(r));assert(r.some(x=>x.testo==='Botanica'&&x.w>0&&x.h>0&&x.connesso),gesto+': sottolineatura visibile');}
(async()=>{
 await c.collega();await aspetta(`typeof bancoStato==='function'&&zainoAttivo()==='biologia'`);
 assert((await c.val('window.vault.path')).includes('studia-zaino-prova-'));await c.partiPulito();
 const prima=await c.val(`({banco:bancoStato(),attivo:BANCO.attivo,memoria:{...localStorage}})`);let id;
 try{
  await c.val(`bancoForma('due-col');bancoAssegna('A','fonte');bancoAssegna('C','fonte2');openPdf('01 Botanica.pdf',1,'Botanica',true)`);
  await aspetta(`!!document.querySelector('#pdfFrame .page .textLayer span')`);
  id=await c.val(`(()=>{const r=vault.evidenze.aggiungi(corsoAttivo(),{exact:'Botanica',prefix:'',suffix:'',colore:'#ef4444',tratto:'sotto',materiale:'01 Botanica.pdf',pagina:1});if(r.error)throw Error(r.error);evidenzeCarica();evidenzeDisegna();return r.evidenze.find(e=>e.exact==='Botanica').id;})()`);
  await dipinta('inizio');await c.val(`fonte2Apri('02 Biologia cellulare.pdf')`);await aspetta(`!!FONTE2.doc`);
  // Scala fissa: il rimontaggio non deve dipendere da un nuovo textlayerrendered.
  await c.val(`PDFJS.viewer.currentScaleValue='1';pdfZoomRicorda('1')`);await c.pausa(800);
  for(let i=0;i<3;i++){
   await c.val(`bancoZoom('C')`);await c.pausa(200);await c.val(`bancoZoomTorna()`);await c.pausa(500);
   await dipinta('ritorno al banco '+i);
  }
  for(let i=0;i<3;i++){
   await c.val(`BancoPresentazione.schermoIntero('fonte2')`);await c.pausa(250);
   await c.val(`BancoPresentazione.esciIntero()`);await c.pausa(1000);await dipinta('uscita schermo intero '+i);
  }
  console.log('✓ sottolineature persistenti tra due fonti e schermo intero');
 }finally{await c.val(`(()=>{if(${JSON.stringify(id||'')})vault.evidenze.rimuovi(corsoAttivo(),${JSON.stringify(id||'')});evidenzeCarica();evidenzeDisegna();closePdf();fonte2Chiudi();localStorage.clear();Object.entries(${JSON.stringify(prima.memoria)}).forEach(([k,v])=>localStorage.setItem(k,v));BANCO.stato=${JSON.stringify(prima.banco)};BANCO.attivo=${JSON.stringify(prima.attivo)};bancoDisegna();})()`);}
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
