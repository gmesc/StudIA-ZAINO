'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),c=require('./cdp'),q=JSON.stringify;
async function wait(e){for(let i=0;i<150;i++){if(await c.val(e))return;await c.pausa(100);}throw Error('Attesa: '+e);}
(async()=>{await c.collega();await wait(`typeof MappaAspettoUI!=='undefined'&&zainoAttivo()==='biologia'`);const vault=await c.val('vault.path');A(vault.includes('studia-zaino-prova-'));await c.partiPulito();const prima=await c.val('({banco:bancoStato(),tema:document.documentElement.dataset.theme,memoria:{...localStorage}})');let file;const marker=require('node:path').join(require('node:path').dirname(vault),'dati/dialogo-salvataggio.json'),dialogoPrima=fs.existsSync(marker)?fs.readFileSync(marker):null;
try{
 await c.val(`document.getElementById('settingsBtn').click();document.querySelector('[data-tab="aspetto"]').click();(()=>{const s=document.getElementById('aspettoFont');s.value='atkinson';s.dispatchEvent(new Event('change'));})()`);
 await wait(`document.fonts.check('14px "Atkinson Hyperlegible"')`);
 A(await c.val(`getComputedStyle(document.getElementById('aspettoFont')).fontFamily.includes('Atkinson')`));A.equal(await c.val(`localStorage.getItem('zaino.aspetto.font')`),'atkinson');A(!await c.val(`getComputedStyle(document.querySelector('#noteHost .CodeMirror')).fontFamily.includes('Atkinson')`));
 fs.writeFileSync('/private/tmp/zaino-aspetto-ui.png',Buffer.from((await c.invia('Page.captureScreenshot',{format:'png'})).result.data,'base64'));
 await c.val(`document.getElementById('settingsClose').click()`);await c.invia('Page.reload');await wait(`typeof MappaAspettoUI!=='undefined'&&document.documentElement.dataset.fontUi==='atkinson'&&zainoAttivo()==='biologia'`);
 file=await c.val(`(async()=>{const r=await mappeApi().salva('biologia',null,{titolo:'Aspetto della mappa',nodi:[{id:'a',testo:'La pianta',origine:'utente'},{id:'b',testo:'Foglie',origine:'utente'},{id:'c',testo:'Radici',origine:'utente'}],archi:[{da:'a',a:'b'},{da:'a',a:'c'}]});bancoForma('uno');bancoAssegna('A','mappa');MAPPA.registro='mie';await mappaApriMia(r.file);return r.file;})()`);
 await wait(`document.querySelectorAll('#mappaSvg .mnodo').length===3`);await c.val(`document.getElementById('mVista').click()`);A.equal(await c.val(`document.querySelector('[data-aspetto="raggio"]').value`),'0');await wait(`Array.from(document.querySelectorAll('.mappa-preset-campione img')).every(i=>i.complete&&i.naturalWidth>0)`);await c.clicca('[data-preset="leggibile"]');
 A.equal(await c.val('MAPPA.vista.aspetto.font'),'atkinson');A.equal(await c.val(`document.querySelector('#mappaSvg .mnodo rect').getAttribute('rx')`),'8');
 A(await c.val(`document.querySelector('#mappaSvg .mnodo text').getAttribute('font-family').includes('Atkinson')`));
 A.equal(await c.val(`MAPPA.vista.aspetto.carta`),'#fffbed');
 await c.val('mappaAnnulla()');A.equal(await c.val('MAPPA.vista.aspetto.preset'),'originale');A.equal(await c.val(`document.querySelector('[data-aspetto="raggio"]').value`),'0');await c.val('mappaRipeti()');A.equal(await c.val('MAPPA.vista.aspetto.preset'),'leggibile');
 await c.val(`(()=>{const s=document.querySelector('[data-aspetto="sfondo"]');s.value='linee';s.dispatchEvent(new Event('change'));})()`);A(await c.val(`document.querySelector('.mtela').style.backgroundImage.includes('data:image/svg')`));
 await c.val('mappaFlush()');const disco=require('../../lib/mappe').apri(vault,'biologia',file).mappa;A.equal(disco.vista.aspetto.sfondo,'linee');A.equal(disco.vista.aspetto.font,'atkinson');
 await c.val(`MAPPA.mia.file='';mappaApriMia(${q(file)})`);await wait(`MAPPA.mia.file===${q(file)}`);A.equal(await c.val('MAPPA.vista.aspetto.sfondo'),'linee');
 const stampata=await c.val('foglioMappa().html');A(stampata.includes('#fffbed'));A(stampata.includes('<pattern'));A(stampata.includes('Atkinson'));
 fs.writeFileSync('/private/tmp/zaino-mappe-aspetto.png',Buffer.from((await c.invia('Page.captureScreenshot',{format:'png'})).result.data,'base64'));
 // Tutte le carte locali si caricano e restano ferme quando la camera cambia.
 for(const tipo of ['cotone','naturale','chiara']){
  await c.val(`(()=>{const s=document.querySelector('[data-aspetto="sfondo"]');s.value='carta-${tipo}';s.dispatchEvent(new Event('change'));})()`);
  A(await c.val(`(async()=>{const i=new Image();i.src=new URL('assets/presentazioni/carte/${tipo}.png',document.baseURI);await i.decode();return i.naturalWidth>0;})()`));
 }
 const fondo=await c.val(`document.querySelector('.mtela').style.cssText`);
 await c.val(`closePops();MAPPA.z={k:1.2,x:25,y:15};mappaApplicaZoom()`);
 A.equal(await c.val(`document.querySelector('.mtela').style.cssText`),fondo);A.equal(await c.val(`document.querySelector('#mappaSvg .msfondo')`),null);
 const trasformazione=await c.val(`document.querySelector('#mappaSvg .mzoom').getAttribute('transform')`);
 const punto=await c.val(`(()=>{const r=document.getElementById('mappaSvg').getBoundingClientRect();return{x:r.left+40,y:r.top+40};})()`);
 await c.invia('Input.dispatchMouseEvent',{type:'mouseWheel',...punto,deltaX:0,deltaY:-120});await c.pausa(120);
 A.notEqual(await c.val(`document.querySelector('#mappaSvg .mzoom').getAttribute('transform')`),trasformazione);A.equal(await c.val(`document.querySelector('.mtela').style.cssText`),fondo);
 await c.val('mappaFlush()');A.equal(require('../../lib/mappe').apri(vault,'biologia',file).mappa.vista.aspetto.sfondo,'carta-chiara');
 await c.val(`MAPPA.mia.file='';mappaApriMia(${q(file)})`);await wait(`MAPPA.mia.file===${q(file)}`);A.equal(await c.val('MAPPA.vista.aspetto.sfondo'),'carta-chiara');
 A((await c.val('foglioMappa().html')).includes('carte/chiara.png'));
 fs.writeFileSync(marker,JSON.stringify({filePath:'/private/tmp/zaino-mappa-carta.pdf'}));const pdf=await c.val(`salvaPdf('mappa')`);A.equal(pdf,'/private/tmp/zaino-mappa-carta.pdf');A(fs.statSync(pdf).size>10000);
 // Campionamento raster del profilo SVG: gli angoli esterni sono trasparenti,
 // il centro della fascia mantiene il colore, nei due orientamenti.
 for(const orient of ['td','lr'])for(const raggio of [8,24])for(const immagine of [null,{id:'prova',w:1200,h:800},{id:'prova',w:300,h:1600},{id:'prova',w:1200,h:50}])for(const selezionato of [false,true]){
  const pixel=await c.val(`(async()=>{
   const a={...MAPPA.vista.aspetto,raggio:${raggio}},res=MappaLayouts.run({nodi:[{id:'x',testo:'Nodo',origine:'utente',immagine:${q(immagine)}}],archi:[]},{orient:'${orient}'});
   const out=MappaDisegna.svg(res,{aspetto:a,sfondo:false,evidenzia:${selezionato?q('x'):'null'}}),tmp=document.createElementNS('http://www.w3.org/2000/svg','svg');tmp.innerHTML=out.markup;
   const nodo=tmp.querySelector('.mnodo'),rect=nodo.querySelector('rect'),barra=nodo.querySelector('.mbarra');if(!barra)throw Error('Barra non trovata');
   const x=+rect.getAttribute('x'),y=+rect.getAttribute('y'),w=+rect.getAttribute('width'),h=+rect.getAttribute('height');
   const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+w*4+'" height="'+h*4+'" viewBox="'+[x,y,w,h].join(' ')+'">'+(nodo.querySelector('.mcontorno')||rect).outerHTML+barra.outerHTML+'</svg>';
   const i=new Image();i.src='data:image/svg+xml,'+encodeURIComponent(svg);await i.decode();const c=document.createElement('canvas');c.width=w*4;c.height=h*4;const ctx=c.getContext('2d');ctx.drawImage(i,0,0);
   const p=(x,y)=>Array.from(ctx.getImageData(Math.floor(x*4),Math.floor(y*4),1,1).data);
   return {angolo:p(.5,.5),altoDestro:p(w-.5,.5),bassoDestro:p(w-.5,h-.5),opposto:${!immagine&&orient==='td'}?p(w-.5,.5):p(.5,h-.5),centro:${!immagine&&orient==='td'}?p(w/2,3):p(3,h/2)};
  })()`);
  const caso=JSON.stringify({orient,raggio,immagine,selezionato});A.equal(pixel.angolo[3],immagine?255:0,caso);A.equal(pixel.altoDestro[3],immagine?255:0,caso);A.equal(pixel.bassoDestro[3],0,caso);A.equal(pixel.opposto[3],0,caso);A.equal(pixel.centro[3],255,caso);
 }
 await c.val(`MAPPA.z={k:1,x:0,y:0};mappaApplicaZoom();document.getElementById('mVista').click()`);
 fs.writeFileSync('/private/tmp/zaino-mappa-carta.png',Buffer.from((await c.invia('Page.captureScreenshot',{format:'png'})).result.data,'base64'));
 await c.val(`(()=>{const s=document.querySelector('[data-aspetto="sfondo"]');s.value='pieno';s.dispatchEvent(new Event('change'));})()`);A.equal(await c.val(`document.querySelector('.mtela').style.backgroundImage`),'none');
 await c.invia('Emulation.setDeviceMetricsOverride',{width:800,height:800,deviceScaleFactor:1,mobile:false});await c.val(`document.documentElement.dataset.theme='scuro';mappaRidisegna();closePops();document.getElementById('mVista').click()`);await c.pausa(150);const r=await c.val(`document.getElementById('mappaPop').getBoundingClientRect().toJSON()`);A(r.x>=0&&r.right<=801&&r.bottom<=801);A(await c.val(`getComputedStyle(document.querySelector('#mappaPop [data-aspetto=font]')).fontFamily.includes('Atkinson')`));fs.writeFileSync('/private/tmp/zaino-aspetto-stretto-scuro.png',Buffer.from((await c.invia('Page.captureScreenshot',{format:'png'})).result.data,'base64'));await c.invia('Emulation.clearDeviceMetricsOverride');
 console.log('✓ Aspetto UI e MAPPE: font locale, preset via mouse, nodi, sfondo, Undo/Redo, salvataggio/riapertura e stampa');
}finally{if(dialogoPrima)fs.writeFileSync(marker,dialogoPrima);else fs.rmSync(marker,{force:true});await c.invia('Emulation.clearDeviceMetricsOverride');await c.val(`(async()=>{closePops();document.getElementById('aspettoRipristina').click();document.documentElement.dataset.theme=${q(prima.tema)};await mappaFlush();bancoTogli('mappa');document.getElementById('settingsModal').hidden=true;localStorage.clear();for(const[k,v]of Object.entries(${q(prima.memoria)}))localStorage.setItem(k,v);BANCO.stato=${q(prima.banco)};bancoDisegna();})()`);if(file){require('../../lib/mappe').rimuovi(vault,'biologia',file);await c.val(`MAPPA.mia.file='';MAPPA.mia.grafo=null;MAPPA.pila=null;mappaCaricaElenco()`);}}
c.ws().close();})().catch(e=>{console.error(e);c.ws()?.close();process.exitCode=1;});
