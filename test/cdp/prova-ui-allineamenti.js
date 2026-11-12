'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),c=require('./cdp'),q=JSON.stringify;
async function wait(e){for(let n=0;n<120;n++){if(await c.val(e))return;await c.pausa(80);}throw Error('Attesa '+e);}
const leggi=fn=>c.val('('+fn.toString()+')()');
async function barre(){return leggi(()=>{
 const vis=e=>e.getBoundingClientRect().width&&e.getBoundingClientRect().height;
 return [...document.querySelectorAll('.bcorpo .tbar,.bcorpo .mtoolbar,.bcorpo .editor-toolbar,.bcorpo .pdfbar')].filter(e=>vis(e)&&!e.closest('.popmenu,.presenta-campi')).map(e=>{
  const p=document.createElement('i');p.style.cssText='position:absolute;visibility:hidden;height:var(--tb-bar-h)';e.append(p);const standard=parseFloat(getComputedStyle(p).height);p.remove();
  return {nome:e.id||e.className,h:e.offsetHeight,standard,figli:[...e.querySelectorAll('button,input,select,output')].filter(vis).map(b=>({nome:b.id||b.getAttribute('aria-label')||b.textContent,h:b.offsetHeight,y:b.getBoundingClientRect().y,token:parseFloat(getComputedStyle(b).getPropertyValue('--tb-h'))}))};
 });
});}
function verifica(rows,nome){assert(rows.length,'toolbar presenti: '+nome);for(const r of rows){assert(Math.abs(r.h-Math.round(r.h/r.standard)*r.standard)<1,'altezza delle righe: '+nome+' '+JSON.stringify(r));for(const f of r.figli)assert(Math.abs(f.h-f.token)<1,'altezza controllo: '+nome+' '+JSON.stringify(f));}}
(async()=>{await c.collega();await c.partiPulito();assert((await c.val('vault.path')).includes('studia-zaino-prova-'));const prima=await c.val('({banco:bancoStato(),attivo:BANCO.attivo,storage:{...localStorage}})');const dati=[];
try{
 await c.invia('Emulation.setDeviceMetricsOverride',{width:1400,height:1000,deviceScaleFactor:1,mobile:false});await c.val("cambiaZaino('biologia',true);bancoForma('uno')");
 for(const tipo of ['album','keyword','mappa','fonte','fonte2','appunti','appunti2','postille','studio','flashcard','lim','presenta','gobbo']){
  await c.val('bancoAssegna("A",'+q(tipo)+')');await c.pausa(120);const rows=await barre();dati.push({tipo,barre:rows});verifica(rows,tipo);
  if(tipo==='album'){
   assert.equal(rows.length,1,'Album: un’unica toolbar');await c.clicca('#albumOrdine');await wait('document.getElementById("albumOrdineMenu").getBoundingClientRect().height>0');
   const scelta=await leggi(()=>{const a=document.querySelector('#albumOrdineMenu [aria-checked=true]'),b=document.querySelector('#albumOrdineMenu [aria-checked=false]');return {scelto:getComputedStyle(a).backgroundColor,altro:getComputedStyle(b).backgroundColor,visto:getComputedStyle(a,'::before').content};});
   assert.notEqual(scelta.scelto,scelta.altro,'criterio corrente evidenziato');assert(['none','normal','""'].includes(scelta.visto),'nessun visto nel criterio');await c.clicca('[data-album-ordine=data]');assert.equal(await c.val('document.querySelector("[data-album-ordine=data]").getAttribute("aria-checked")'),'true');
   await c.clicca('#albumCerca');assert.equal(await c.val('document.getElementById("albumCercaInput").offsetHeight'),40,'ricerca nel bubble allo standard dei campi');await c.val('closePops()');
   const shot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/private/tmp/zaino-ui-album.png',Buffer.from(shot.result.data,'base64'));
  }
  if(tipo==='studio'){
   await c.val('document.getElementById("zschedeBack").click()');
   const campi=await leggi(()=>['zschedeFilter','zschedeKind'].map(id=>{const e=document.getElementById(id),s=getComputedStyle(e);let a=e,antenati=[];for(let n=0;a&&n<7;n++,a=a.parentElement)antenati.push([a.id,a.className,getComputedStyle(a).zoom]);return {id,h:e.offsetHeight,token:s.getPropertyValue('--ctl-h'),stile:['fontSize','lineHeight','minHeight','maxHeight','flexShrink','boxSizing','zoom'].map(k=>[k,s[k]]),antenati};}));
   fs.writeFileSync('/private/tmp/zaino-campi-style.json',JSON.stringify(campi,null,2));assert(campi.every(e=>Math.abs(e.h-parseFloat(e.token))<1),'Cerca e Tipo: stessa altezza del token '+JSON.stringify(campi));
  }
 }
 for(const forma of ['due-col','quattro']){await c.val('bancoForma('+q(forma)+');bancoAssegna("A","presenta");bancoAssegna("C","mappa")');if(forma==='quattro')await c.val('bancoAssegna("B","album");bancoAssegna("D","keyword")');await c.pausa(160);verifica(await barre(),forma);const shot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/private/tmp/zaino-ui-'+forma+'.png',Buffer.from(shot.result.data,'base64'));}
 for(const width of [700,390]){await c.invia('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await c.val('bancoForma("uno");bancoAssegna("A","album")');await c.pausa(100);verifica(await barre(),'Album '+width);await c.val('bancoAssegna("A","mappa")');await c.pausa(100);verifica(await barre(),'Mappa '+width);}
 await c.invia('Emulation.setDeviceMetricsOverride',{width:1400,height:1000,deviceScaleFactor:1,mobile:false});await c.val('ZainoTuning.apri("mappa")');await wait('document.getElementById("settingsModal").dataset.tuning==="true"');
 const tuning=await leggi(()=>[...document.querySelectorAll('.tuning-filtri input,.tuning-filtri select,.tuning-tipi button,.set-tab')].filter(e=>e.offsetWidth).map(e=>({nome:e.textContent,h:e.offsetHeight,token:getComputedStyle(e).getPropertyValue('--ctl-h')})));
 assert(tuning.every(e=>e.h===parseFloat(e.token)),'STILI: campi e bottoni allineati '+JSON.stringify(tuning));
 fs.writeFileSync('/private/tmp/zaino-ui-misure.json',JSON.stringify(dati,null,2));console.log('✓ Altezze condivise nelle toolbar di 13 split, due/quattro banchi, Album su una riga e criteri senza visti; filtri Raccoglitore/STILI allineati');
}finally{await c.invia('Emulation.clearDeviceMetricsOverride',{});await c.val('document.getElementById("settingsClose").click();localStorage.clear();Object.entries('+q(prima.storage)+').forEach(([k,v])=>localStorage.setItem(k,v));BANCO.stato='+q(prima.banco)+';BANCO.attivo='+q(prima.attivo)+';bancoDisegna()');}process.exit(0);})().catch(e=>{console.error(e);process.exit(1);});
