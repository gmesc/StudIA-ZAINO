'use strict';
// Solo vault sintetico: gli strumenti in magazzino non sono materiali aperti.
const assert=require('node:assert/strict'),c=require('./cdp'),q=JSON.stringify;
async function aspetta(expr){for(let i=0;i<150;i++){if(await c.val(expr))return;await c.pausa(80);}throw Error('Attesa: '+expr);}
async function stato(){return c.val(`Object.fromEntries([...document.querySelectorAll('#zainoNav .zn-appunto')].map(b=>[b.dataset.quale,{aperto:b.classList.contains('attivo'),numeri:[...b.querySelectorAll('.znumero')].map(n=>({numero:n.textContent,attivo:n.dataset.attivo==='1'}))}]))`);}
(async()=>{
 await c.collega();await aspetta(`typeof bancoStato==='function' && zainoAttivo()==='biologia'`);assert((await c.val('window.vault.path')).includes('studia-zaino-prova-'));await c.partiPulito();
 const prima=await c.val(`({banco:bancoStato(),attivo:BANCO.attivo,storage:{...localStorage}})`);
 let immagine;
 try{
  await c.val(`bancoForma('due-col');bancoAssegna('A','appunti');bancoAssegna('C','fonte')`);
  await aspetta(`NOTES.list.length>=2`);const files=await c.val(`NOTES.list.slice(0,2).map(n=>n.file)`);
  await c.val(`noteOpen(${q(files[0])},NOTES);bancoAttivaBlocco('A');zainoNavAggiorna()`);await aspetta(`!ZNAV.carico`);
  await c.val(`bancoAssegna('A','album')`);
  assert.equal((await stato())[files[0]].aperto,false,'un appunto nascosto non resta evidenziato');
  await c.val(`BANCO.stato=BancoForme.normalizzaStato({forma:'due-col',blocchi:{A:'appunti',C:'appunti2'}});bancoDisegna();noteOpen(${q(files[1])},noteStati()[1]);bancoAttivaBlocco('A');zainoNavAggiorna()`);await aspetta(`!ZNAV.carico`);
  let s=await stato();assert.deepEqual(s[files[0]].numeri,[{numero:'1',attivo:true}]);assert.deepEqual(s[files[1]].numeri,[{numero:'2',attivo:false}]);assert(s[files[0]].aperto&&s[files[1]].aperto,'entrambe le istanze sono aperte');
  await c.val(`bancoAttivaBlocco('C')`);s=await stato();assert(!s[files[0]].numeri[0].attivo&&s[files[1]].numeri[0].attivo,'il cambio attivo aggiorna subito i pallini');
  await c.val(`bancoForma('uno')`);s=await stato();assert.equal(Object.values(s).filter(v=>v.aperto).length,1,'riduzione: un solo materiale ancora visibile');assert.deepEqual(s[files[1]].numeri,[{numero:'1',attivo:true}]);
  await c.val(`BANCO.stato=BancoForme.normalizzaStato({forma:'due-col',blocchi:{A:'fonte',C:'fonte2'}});bancoDisegna();openPdf('01 Botanica.pdf',1,'Botanica',true)`);
  await aspetta(`!!PDFJS.doc`);await c.val(`fonte2Apri('01 Botanica.pdf')`);await aspetta(`!!FONTE2.doc`);await c.val(`zainoNavAggiorna()`);await aspetta(`!ZNAV.carico`);
  assert.deepEqual(await c.val(`[...document.querySelector('.zn-fonte[data-quale="01 Botanica.pdf"]').querySelectorAll('.znumero')].map(n=>n.textContent)`),['1','2'],'lo stesso PDF nei due split mostra entrambi i numeri');
  await c.val(`fonte2Chiudi()`);assert.equal(await c.val(`document.querySelectorAll('.zn-fonte[data-quale="01 Botanica.pdf"] .znumero').length`),1,'la chiusura aggiorna senza ricostruire la sidebar');
  immagine=await c.val(`(()=>{const cv=document.createElement('canvas');cv.width=80;cv.height=60;cv.getContext('2d').fillRect(0,0,80,60);const r=vault.album.salva('biologia',{origine:'foto',materiale:'Indicatore.png',didascalia:'Immagine degli indicatori',dati:cv.toDataURL('image/png')});if(r.error)throw Error(r.error);return r.voce.id;})()`);
  await c.val(`(async()=>{await zainoNavAggiorna();bancoAssegna('A','album');fotoApri(${q(immagine)});})()`);await aspetta(`!ZNAV.carico`);
  assert.equal(await c.val(`document.querySelector('.zn-immagine[data-quale="album:${immagine}"] .znumero').textContent`),'1','immagine aperta con indicatore');
  await c.val(`AlbumSpazio.scegli('ritagli')`);assert.equal(await c.val(`document.querySelectorAll('.zn-immagine .znumero').length`),0,'tornando alla raccolta non resta una falsa immagine aperta');
  assert.equal(await c.val(`document.querySelectorAll('.albumTabs .tbsep').length`),3,'separatori Album');
  const separatori=await c.val(`[...document.querySelectorAll('.albumTabs .tbsep')].map(e=>({hidden:e.hidden,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height,bg:getComputedStyle(e).backgroundColor}))`);
  assert(separatori.every(e=>!e.hidden&&e.w===1&&e.h===16&&e.bg!=='rgba(0, 0, 0, 0)'),'separatori realmente visibili: '+JSON.stringify(separatori));

  await c.invia('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});await c.pausa(250);
  assert.equal(await c.val(`getComputedStyle(document.querySelector('.albumTabs [aria-pressed="true"]')).backgroundColor`),'rgb(229, 231, 235)','tab selezionato grigio senza hover');
  const tab=await c.val(`(()=>{const r=document.querySelector('.albumTabs [aria-pressed="true"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await c.invia('Input.dispatchMouseEvent',{type:'mouseMoved',...tab});await c.pausa(250);
  assert.notEqual(await c.val(`getComputedStyle(document.querySelector('.albumTabs [aria-pressed="true"]')).backgroundColor`),'rgb(229, 231, 235)','hover verde anche sul tab selezionato');
  await c.invia('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});await c.pausa(250);
  const slider=await c.val(`(()=>{const e=document.querySelector('#albumDimensione');return {accento:getComputedStyle(e).accentColor,pallino:getComputedStyle(e).getPropertyValue('--album-cursore').trim(),linea:getComputedStyle(e).getPropertyValue('--album-traccia').trim()};})()`);assert.equal(slider.pallino,'#6b7280');assert.equal(slider.linea,'#e5e7eb');
  console.log('Indicatori materiali: nascosti, due istanze, cambio attivo, riduzione, PDF duplicato, chiusura e Album OK');
 }finally{if(immagine)await c.val(`vault.album.rimuovi('biologia',${q(immagine)},{insisti:true})`);await c.val(`localStorage.clear();Object.entries(${q(prima.storage)}).forEach(([k,v])=>localStorage.setItem(k,v));BANCO.stato=${q(prima.banco)};BANCO.attivo=${q(prima.attivo)};bancoDisegna()`);}
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
