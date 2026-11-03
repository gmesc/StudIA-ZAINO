'use strict';
/* Geometria reale: il fantasma deve restare cliccabile senza coprire il nome,
 * anche chiudendo la sidebar e cambiando forma, larghezza o tema.
 * Solo il vault sintetico di bin/prova-zaino.sh. */
const assert=require('node:assert/strict'),fs=require('node:fs'),c=require('./cdp');
const q=JSON.stringify;
async function aspetta(expr){for(let i=0;i<120;i++){if(await c.val(expr))return;await c.pausa(100);}throw Error('Attesa: '+expr);}
async function finestra(width){await c.invia('Emulation.setDeviceMetricsOverride',{width,height:940,deviceScaleFactor:1,mobile:false});await c.pausa(180);}
async function misura(){return c.val(`(()=>{
 const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
 const h=document.querySelector('.bhead[data-primo="1"]'),btn=document.getElementById('menuBtn'),r=btn.getBoundingClientRect();
 const n=h.querySelector('.bnumero'),sel=h.querySelector('.tendina');
 return {maniglia:box(btn),testata:box(h),numero:box(n),titolo:box(sel),
  cliccabile:!!document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#menuBtn'),
  espansa:btn.getAttribute('aria-expanded'),nome:btn.getAttribute('aria-label'),
  topbar:box(document.querySelector('.topbar')),barra:box(document.querySelector('#pdfPane .pdfbar')),
  barraMinima:parseFloat(getComputedStyle(document.querySelector('#pdfPane .pdfbar')).minHeight)};
})()`);}
function vicino(n,a,b){assert(Math.abs(a-b)<.15,n+': '+a+' / '+b);}
function maniglia(m,contesto){
 vicino(contesto+' altezza',m.maniglia.h,m.testata.h);
 vicino(contesto+' bordo superiore',m.maniglia.y,m.testata.y);
 vicino(contesto+' bordo inferiore',m.maniglia.bottom,m.testata.bottom);
 vicino(contesto+' ancoraggio',m.maniglia.x,m.testata.x);
 assert(m.numero.x>=m.maniglia.right,contesto+': numero scoperto');
 assert(m.titolo.x>=m.maniglia.right,contesto+': titolo scoperto');
 assert(m.cliccabile,contesto+': fantasma raggiungibile col mouse');
}
(async()=>{
 await c.collega();await aspetta(`typeof bancoStato==='function' && zainoAttivo()==='biologia'`);
 assert((await c.val('window.vault.path')).includes('studia-zaino-prova-'));
 await c.partiPulito();
 const prima=await c.val(`({banco:bancoStato(),attivo:BANCO.attivo,tema:root.dataset.theme,sidebar:root.dataset.sidebar,nav:root.dataset.nav,storage:{...localStorage}})`);
 try{
  await finestra(1440);
  await c.val(`root.dataset.sidebar='';root.dataset.nav='';root.dataset.theme='chiaro';bancoForma('due-col');bancoAssegna('A','fonte');bancoAssegna('C','appunti');bancoAttivaBlocco('C');positionPanelToggle()`);
  await aspetta(`!!document.querySelector('#noteHost .editor-toolbar')`);await c.pausa(250);
  const iniziale=await misura();console.log('Misure: '+JSON.stringify(iniziale));
  vicino('topbar -10%',iniziale.topbar.h,42.9*.9);
  vicino('testata +1/8',iniziale.testata.h,32*.9*1.125);
  vicino('toolbar interna -10%',iniziale.barraMinima,39*.9);
  const fantasma=await c.val(`document.querySelector('#menuBtn img.oi').src`);
  for(const tema of ['chiaro','scuro']){
   await c.val(`root.dataset.theme=${q(tema)};root.dataset.sidebar='';positionPanelToggle()`);await c.invia('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});await c.pausa(180);
   const colori=await c.val(`(()=>{
    const sonda=document.createElement('i');document.body.append(sonda);
    const colore=v=>{sonda.style.color=v;return getComputedStyle(sonda).color;};
    const pannello=colore('var(--panel)'),neutro=colore('var(--hover)'),inchiostro=colore('var(--ink)');sonda.remove();
    const h=document.querySelector('.blocco[data-attivo="1"]>.bhead'),spenta=document.querySelector('.blocco[data-attivo="0"]:not([hidden])>.bhead');
    const titoli=[...document.querySelectorAll('.znav .zs-tit')].filter(e=>e.getClientRects().length);
    return {pannello,neutro,inchiostro,attiva:getComputedStyle(h).backgroundColor,inattiva:getComputedStyle(spenta).backgroundColor,
     badge:[h,spenta].map(e=>{const n=e.querySelector('.bnumero'),s=getComputedStyle(n),r=n.getBoundingClientRect();return {raggio:s.borderRadius,colore:s.color,peso:s.fontWeight,bordo:s.borderColor,fondo:s.backgroundColor,w:r.width,h:r.height};}),linea:getComputedStyle(h).boxShadow,numero:getComputedStyle(h.querySelector('.bnumero')).backgroundColor,
     sidebar:titoli.map(e=>({fondo:getComputedStyle(e).backgroundColor,colore:getComputedStyle(e).color})),
     maniglia:getComputedStyle(document.getElementById('menuBtn')).backgroundColor};
   })()`);
   assert.equal(colori.attiva,colori.pannello,'testata attiva neutra in '+tema);
   assert.equal(colori.inattiva,colori.neutro,'testata inattiva neutra in '+tema);
   assert.equal(colori.linea,'none','nessuna linea sullo split attivo');
   assert.equal(colori.numero,'rgb(249, 115, 22)','numero attivo arancione');
   assert(colori.sidebar.length>0 && colori.sidebar.every(t=>t.fondo===colori.neutro&&t.colore===colori.inchiostro),'titoli sidebar neutri in '+tema+': '+JSON.stringify(colori));
   assert.deepEqual(colori.badge.map(b=>({raggio:b.raggio,colore:b.colore,peso:b.peso,bordo:b.bordo,fondo:b.fondo,w:b.w,h:b.h})),[{raggio:'50%',colore:'rgb(75, 85, 99)',peso:'700',bordo:'rgba(0, 0, 0, 0)',fondo:'rgb(249, 115, 22)',w:20,h:20},{raggio:'50%',colore:'rgb(107, 114, 128)',peso:'400',bordo:'rgb(209, 213, 219)',fondo:'rgba(0, 0, 0, 0)',w:20,h:20}]);
   assert.equal(colori.maniglia,colori.pannello,'maniglia coerente con il tema');
   for(const forma of ['uno','due-col','quattro']){
    await c.val(`bancoForma(${q(forma)});positionPanelToggle()`);
    for(const chiusa of [false,true]){
     await c.val(`root.dataset.sidebar=${q(chiusa?'collapsed':'')};positionPanelToggle()`);
     const m=await misura();maniglia(m,tema+'/'+forma+'/'+chiusa);
     assert.equal(m.espansa,String(!chiusa));assert(m.nome.includes(chiusa?'Mostra':'Nascondi'));
    }
   }
  }
  await c.val(`root.dataset.theme='chiaro';root.dataset.sidebar='';bancoForma('due-col');bancoAssegna('A','fonte');bancoAssegna('C','appunti');positionPanelToggle()`);
  await c.clicca('#menuBtn');assert.equal(await c.val(`root.dataset.sidebar`),'collapsed');
  maniglia(await misura(),'click per chiudere');
  await c.clicca('#menuBtn');assert.equal(await c.val(`root.dataset.sidebar`),'');
  for(const width of [1024,800,390]){
   await finestra(width);maniglia(await misura(),'finestra '+width);
   await c.clicca('#menuBtn');
   if(width<=860){assert.equal(await c.val(`root.dataset.nav`),'open');await c.clicca('#menuBtn');assert.equal(await c.val(`root.dataset.nav`),'');}
   else await c.clicca('#menuBtn');
  }
  assert.equal(await c.val(`document.querySelector('#menuBtn img.oi').src`),fantasma,'icona originale conservata');
  await finestra(1440);
  await c.val(`root.dataset.nav='';root.dataset.sidebar='';bancoForma('due-col');bancoAssegna('A','fonte');bancoAssegna('C','appunti');bancoAttivaBlocco('C');openPdf('01 Botanica.pdf',1,'Botanica',true)`);
  await aspetta(`!!PDFJS.doc && !!NOTES.list.length`);
  await c.val(`noteOpen(NOTES.list[0].file,NOTES)`);await c.pausa(300);
  const shot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/private/tmp/zaino-gerarchia-a.png',Buffer.from(shot.result.data,'base64'));
  console.log('Gerarchia A: colori, testate +1/8 e altre barre -10%, fantasma senza sovrapposizioni, temi, forme e finestre OK');
 }finally{
  await c.invia('Emulation.clearDeviceMetricsOverride',{});
  await c.val(`root.dataset.theme=${q(prima.tema||'chiaro')};root.dataset.sidebar=${q(prima.sidebar||'')};root.dataset.nav=${q(prima.nav||'')};localStorage.clear();Object.entries(${q(prima.storage)}).forEach(([k,v])=>localStorage.setItem(k,v));BANCO.stato=${q(prima.banco)};BANCO.attivo=${q(prima.attivo)};bancoDisegna();positionPanelToggle()`);
 }
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
