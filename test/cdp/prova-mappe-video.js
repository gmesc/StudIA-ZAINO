'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),c=require('./cdp'),q=JSON.stringify;
async function wait(e){for(let i=0;i<180;i++){if(await c.val(e))return;await c.pausa(100);}throw Error(e+' '+await c.val('document.getElementById("toast").textContent'));}
(async()=>{
 await c.collega();await wait("typeof MappaVideoUI!=='undefined'&&zainoAttivo()==='biologia'");const vault=await c.val('vault.path');A(vault.includes('studia-zaino-prova-'));await c.partiPulito();
 const prima=await c.val('({banco:bancoStato(),attivo:BANCO.attivo,memoria:{...localStorage}})'),media=path.join(vault,'Zaini/biologia/MATERIALI/Video/03 Filmato.mp4'),marker=path.join(path.dirname(vault),'dati/dialogo-salvataggio.json');let file;
 try{
  A(c.mediaConFfmpeg(media),'ffmpeg richiesto');
  file=await c.val(`(async()=>{const r=await mappeApi().salva('biologia',null,{titolo:'Video nella mappa',nodi:[],archi:[]});bancoForma('due-col');bancoAssegna('A','mappa');bancoAssegna('C','album');MAPPA.registro='mie';await mappaApriMia(r.file);await AlbumSpazio.aggiorna();AlbumSpazio.scegli('video');return r.file;})()`);
  await wait(`!!document.querySelector('[data-album-media="03 Filmato.mp4"]')`);
  await c.val(`MAPPA.z={k:1.4,x:20,y:30};mappaApplicaZoom()`);
  await c.val(`(()=>{const dt=new DataTransfer(),card=document.querySelector('[data-album-media="03 Filmato.mp4"]'),t=document.getElementById('mappaSvg'),r=t.getBoundingClientRect();card.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:dt}));window.__trasportoVideo=dt.getData('application/x-studia-presenta-media');const drop=new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt,clientX:r.x+r.width/2,clientY:r.y+r.height/2});window.__puntoVideo=mappaPuntoGrafo(drop);t.dispatchEvent(drop);})()`);
  await wait('MAPPA.mia.grafo.nodi.length===1');const id=await c.val('MAPPA.mia.grafo.nodi[0].id');
  A(await c.val(`MAPPA.mia.grafo.nodi[0].x===Math.round(__puntoVideo.x)&&MAPPA.mia.grafo.nodi[0].y===Math.round(__puntoVideo.y)`),'Punto di caduta con pan/zoom: '+JSON.stringify(await c.val('({p:__puntoVideo,x:MAPPA.mia.grafo.nodi[0].x,y:MAPPA.mia.grafo.nodi[0].y})')));
  A(await c.val(`MAPPA.mia.grafo.nodi[0].video.poster.startsWith('data:image/jpeg;base64,')`));A(await c.val(`!!document.querySelector('#mappaSvg .mnodo image')&&!!document.querySelector('#mappaSvg .mvideo')`));
  await c.val('mappaAnnulla()');A.equal(await c.val('MAPPA.mia.grafo.nodi.length'),0);await c.val('mappaRipeti()');A.equal(await c.val('MAPPA.mia.grafo.nodi.length'),1);
  await c.val('MAPPA.z={k:1,x:0,y:0};mappaApplicaZoom();mappaVistaCambiata();mappaFlush()');A.equal(require('../../lib/mappe').apri(vault,'biologia',file).mappa.nodi[0].video.file,'03 Filmato.mp4');
  await c.clicca('#mappaSvg .mvideo');await wait(`document.querySelector('#mappaSvg .mvideo-player video')?.currentTime>0`);A(await c.val(`!document.querySelector('#mappaSvg .mvideo-player video').paused`));
  const video=await c.val(`(()=>{const v=document.querySelector('#mappaSvg .mvideo-player video');window.__videoMappa=v;return {larghezza:v.getBoundingClientRect().width,nativa:v.controls};})()`);A(video.larghezza>0&&video.nativa);
  fs.writeFileSync('/private/tmp/zaino-mappa-video-player.png',Buffer.from((await c.invia('Page.captureScreenshot',{format:'png'})).result.data,'base64'));
  await c.clicca('#mappaSvg .mvideo-chiudi');A(await c.val('window.__videoMappa.paused&&!document.querySelector(".mvideo-player")'));A(await c.val(`document.querySelector('.mvideo').style.display!== 'none'`));
  await c.val(`MAPPA.mia.file='';mappaApriMia(${q(file)})`);await wait(`MAPPA.mia.file===${q(file)}&&!!document.querySelector('.mvideo')`);
  // Tastiera: riproduzione, poi ridisegno che interrompe e scarica il media.
  await c.val(`document.querySelector('.mvideo').focus()`);await c.invia('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter'});await c.invia('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter'});await wait(`!!document.querySelector('.mvideo-player video')`);await c.val(`window.__videoMappa=document.querySelector('.mvideo-player video');mappaRidisegna()`);A(await c.val(`__videoMappa.paused&&!__videoMappa.getAttribute('src')`));
  await c.clicca('#mappaSvg .mvideo');await wait(`!!document.querySelector('.mvideo-player video')`);await c.val(`window.__videoMappa=document.querySelector('.mvideo-player video');bancoAssegna('A','keyword')`);A(await c.val(`__videoMappa.paused&&!__videoMappa.getAttribute('src')`),'Cambiare strumento ferma il video');await c.val(`bancoAssegna('A','mappa')`);await wait(`!!document.querySelector('.mvideo')`);
  const stampa=await c.val('foglioMappa().html');A(stampa.includes('data:image/jpeg;base64,'));A(stampa.includes('file:')&&stampa.includes('03%20Filmato.mp4'));A(!stampa.includes('foreignObject'));
  fs.writeFileSync(marker,JSON.stringify({filePath:'/private/tmp/zaino-mappa-video.pdf'}));A.equal(await c.val(`salvaPdf('mappa')`),'/private/tmp/zaino-mappa-video.pdf');
  const {PDFDocument,PDFName}=require('pdf-lib'),doc=await PDFDocument.load(fs.readFileSync('/private/tmp/zaino-mappa-video.pdf')),links=[];
  for(const page of doc.getPages())for(const ref of page.node.Annots()?.asArray()||[]){const ann=doc.context.lookup(ref),azione=doc.context.lookup(ann.get(PDFName.of('A')));if(azione){const uri=doc.context.lookup(azione.get(PDFName.of('URI')));if(uri?.decodeText)links.push(uri.decodeText());}}
  A(links.some(url=>url.includes('Filmato.mp4')),'Il PDF deve contenere il collegamento al video: '+JSON.stringify(links));
  await c.val(`MappaVideoUI.inserisci(JSON.stringify({...JSON.parse(__trasportoVideo),corso:'storia'}))`);A.equal(await c.val('MAPPA.mia.grafo.nodi.length'),1,'trasporto di altro zaino rifiutato');
  fs.renameSync(media,media+'.nascosto');await c.clicca('#mappaSvg .mvideo');await wait(`!document.querySelector('.mvideo-player')&&/disponibile|spostato|leggere/.test(document.getElementById('toast').textContent)`);fs.renameSync(media+'.nascosto',media);
  console.log('✓ MAPPE video: drag ALBUM, miniatura, Play reale/tastiera, stop/ridisegno, Undo, disco, riapertura, PDF con link');
 }finally{
  await c.val(`MappaVideoUI.chiudi();MAPPA.mia.file='';MAPPA.mia.grafo=null;localStorage.clear();for(const[k,v]of Object.entries(${q(prima.memoria)}))localStorage.setItem(k,v);BANCO.stato=${q(prima.banco)};BANCO.attivo=${q(prima.attivo)};bancoDisegna()`);
  if(file)require('../../lib/mappe').rimuovi(vault,'biologia',file);fs.rmSync(media,{force:true});fs.rmSync(media+'.nascosto',{force:true});fs.rmSync(marker,{force:true});
 }c.ws().close();
})().catch(e=>{console.error(e);c.ws()?.close();process.exitCode=1;});
