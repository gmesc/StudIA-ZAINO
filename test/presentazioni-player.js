'use strict';
// Si esegue con Electron: il player vero, in finestra nascosta e con dati sintetici.
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'zaino-presenta-player-'));fs.mkdirSync(path.join(tmp,'dati'));app.setPath('userData',path.join(tmp,'dati'));
let win;const errori=[],rete=[];
app.whenReady().then(async()=>{
 const exported=await require('../bin/presenta-demo').genera(path.join(tmp,'export'));
 const carte=require('../lib/presentazioni-export').carte();fs.mkdirSync(path.join(exported.cartella,'carte'));for(const f of carte)fs.copyFileSync(f.p,path.join(exported.cartella,'carte',f.nome));
 const M=require('../App/assets/presentazioni/modello'),R=require('../App/assets/presentazioni/reveal-adapter');let foglio=M.crea('00000000-0000-4000-8000-000000000001','Sul foglio'),sid=foglio.stacks[0].slides[0].id;
 foglio=M.applica(foglio,{tipo:'titoloSlide',slideId:sid,title:'Foglio libero'});foglio=M.applica(foglio,{tipo:'inserisciBlocco',slideId:sid,block:{type:'text',slot:'body',markdown:'A destra',style:{fontFamily:'georgia',bold:true,italic:true,underline:true,lineHeight:1.6}}});
 foglio=M.applica(foglio,{tipo:'posizionaBlocchi',slideId:sid,boxes:foglio.stacks[0].slides[0].blocks.map((b,i)=>({id:b.id,box:{x:i?53:7,y:i?30:6,width:i?40:86,height:i?55:18}}))});foglio=M.applica(foglio,{tipo:'slide',slideId:sid,background:'#0f1115'});
 foglio=M.applica(foglio,{tipo:'caratterePresentazione',fontFamily:'atkinson'});const testo=foglio.stacks[0].slides[0].blocks[1];testo.style.fontFamily='georgia';
 foglio=M.applica(foglio,{tipo:'testoInLinea',slideId:sid,blockId:testo.id,richText:[{text:'A '},{text:'destra',style:{fontFamily:'testme',color:'#22c55e',bold:false,underline:false}},{text:' Leggero',style:{fontFamily:'atkinson-next',fontWeight:300,italic:true}},{text:' Alternativo',style:{fontFamily:'testme-alt',bold:true}}]});
 const foto=fs.readdirSync(path.join(exported.cartella,'assets')).find(n=>n.endsWith('.png')),bytes=fs.readFileSync(path.join(exported.cartella,'assets',foto));
 foglio=M.applica(foglio,{tipo:'inserisciBlocco',slideId:sid,assetId:'foto_crop',asset:{kind:'image',path:'assets/'+foto,mimeType:'image/png',sha256:foto.split('.')[0],size:bytes.length},block:{type:'image',slot:'media',crop:{x:20,y:20,width:60,height:40,aspect:1},style:{box:{x:10,y:35,width:30,height:40}}}});
 const A=require('../App/assets/presentazioni/animazioni');
 let esempi=M.crea('00000000-0000-4000-8000-000000000001','Galleria verificata');esempi.stacks=[];
 for(const e of A.catalogo){const slide=M.slide();slide.title=e.nome;const type=e.tipi[0],b={id:'campione-'+e.id,type,slot:'body',style:{box:{x:15,y:20,width:50,height:50}}};
  if(type==='table')b.table=[['Pianeta','Lune'],['Terra','1']];else if(type==='list')b.items=[{id:'uno',markdown:'Osserva'},{id:'due',markdown:'Spiega'}];else if(type==='shape')b.shape='arrow';else b.markdown=e.id==='letters'?'Caffè 👩‍🚀 e **Terra**':'La **Terra** gira intorno al Sole.';
  slide.blocks=[b];slide.animations=[{targetId:b.id,effect:e.id,step:1,duration:.2,delay:.05,distance:40}];if(e.id==='fade-in')slide.animations.push({targetId:b.id,effect:'words',step:2,duration:.2});esempi.stacks.push({id:require('node:crypto').randomUUID(),slides:[slide]});
 }
 const Fsfondo=require('./fixtures/presentazioni');let sfondi=M.crea('00000000-0000-4000-8000-000000000001','Sfondi');sfondi.stacks=[];
 for(const [i,[kind,ext,dati]]of [['image','png',bytes],['image','gif',Fsfondo.gif],['video','webm',Fsfondo.video]].entries()){const sha256=require('node:crypto').createHash('sha256').update(dati).digest('hex'),assetId='sfondo_'+i,a={kind,path:'assets/'+sha256+'.'+ext,mimeType:kind+'/'+ext,size:dati.length,sha256};sfondi.assets[assetId]=a;fs.writeFileSync(path.join(exported.cartella,a.path),dati);const s=M.slide();s.title='Sfondo '+ext;s.background='#000000';s.backgroundMedia={assetId,fit:i===0?'contain':'cover',muted:true,loop:true};sfondi.stacks.push({id:require('node:crypto').randomUUID(),slides:[s]});}
 const index=path.join(exported.cartella,'index.html');fs.writeFileSync(index,fs.readFileSync(index,'utf8').replace('</div></div><script',R.compila(foglio).html+R.compila(esempi).html+R.compila(sfondi).html+'</div></div><script'));
 const spostato=path.join(tmp,'altro-percorso');fs.renameSync(exported.cartella,spostato);
 win=new BrowserWindow({show:false,width:1280,height:720,webPreferences:{backgroundThrottling:false,sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,partition:'presenta-prova'}});
 win.webContents.on('console-message',event=>{if(event.level==='error')errori.push(event.message);});
 win.webContents.session.webRequest.onBeforeRequest({urls:['<all_urls>']},(d,cb)=>{if(!d.url.startsWith('file:'))rete.push(d.url);cb({cancel:!d.url.startsWith('file:')});});
 await win.loadFile(path.join(spostato,'index.html'));
 const run=async js=>{try{return await win.webContents.executeJavaScript(js,true);}catch(e){throw Error(js+'\n'+e.message+'\n'+errori.join('\n'));}};
 async function verificaSfondi(){
 // Sfondo immagine/GIF reale e video in movimento nel pacchetto spostato.
 const bgH=4+A.catalogo.length;
 for(let i=0;i<2;i++){await run(`PresentaPlayer.comando({azione:'vai',h:${bgH+i},v:0,fragmentIndex:-1});new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);const vista=await run(`(async()=>{const s=document.querySelector('section.present[data-background-image]'),img=new Image();img.src=s.dataset.backgroundImage;await img.decode();return {width:img.naturalWidth,colore:getComputedStyle(s.querySelector('.presenta-slide')).backgroundColor,src:s.dataset.backgroundImage,background:document.querySelector('section.present[data-background-image]').slideBackgroundContentElement.style.backgroundImage};})()`);assert(vista.width>0&&vista.colore==='rgba(0, 0, 0, 0)'&&vista.background.includes(vista.src),JSON.stringify(vista));}
 const primoGif=(await win.webContents.capturePage()).toBitmap().subarray(0,4).toString('hex');let gifCambiata=false;
 for(let n=0;n<10&&!gifCambiata;n++){await new Promise(r=>setTimeout(r,150));gifCambiata=(await win.webContents.capturePage()).toBitmap().subarray(0,4).toString('hex')!==primoGif;}assert(gifCambiata,'lo sfondo GIF cambia realmente fotogramma');
 await run(`PresentaPlayer.comando({azione:'vai',h:${bgH+2},v:0,fragmentIndex:-1})`);
 for(let n=0;n<80&&!await run(`(()=>{const m=document.querySelector('section.present[data-background-video]').slideBackgroundElement.querySelector('video');return m&&m.readyState>=2&&!m.paused&&m.currentTime>0;})()`);n++)await new Promise(r=>setTimeout(r,50));
 const videoBg=await run(`(()=>{const m=document.querySelector('section.present[data-background-video]').slideBackgroundElement.querySelector('video');return {ready:m.readyState,paused:m.paused,time:m.currentTime,muted:m.muted,loop:m.loop};})()`);assert(videoBg.ready>=2&&!videoBg.paused&&videoBg.time>0&&videoBg.muted&&videoBg.loop,JSON.stringify(videoBg));
 await run(`PresentaPlayer.comando({azione:'vai',h:${bgH},v:0,fragmentIndex:-1})`);assert(await run(`document.querySelector('.slide-background video').paused`),'video di sfondo fermato quando si lascia la slide');
 }
 const stato=await run('PresentaPlayer.ready');assert.deepEqual(stato,{h:0,v:0,fragmentIndex:-1});if(process.env.PRESENTA_SOLO_SFONDI){await verificaSfondi();assert.deepEqual(rete,[]);assert.deepEqual(errori,[]);console.log('✓ Sfondi offline immagine/GIF/video, riproduzione e pausa');app.exit(0);return;}
 assert.equal(await run('document.fonts.status'),'loaded');assert.equal(await run('document.querySelector("audio").paused'),true);
 assert.deepEqual(await run('PresentaPlayer.comando({azione:"argomentoSuccessivo"})'),{h:1,v:0,fragmentIndex:-1});
 assert.equal(await run('document.querySelector("section.present > .presenta-slide .fragment[data-effetto=fade-in]").classList.contains("visible")'),false);
 const primo=await run('PresentaPlayer.comando({azione:"avanti"})');assert.equal(primo.fragmentIndex,0);
 assert.equal(await run(`document.querySelectorAll('section.present > .presenta-slide .fragment.visible[data-fragment-index="0"]').length`),2,'due elementi compaiono nello stesso passaggio');
 assert.equal((await run('PresentaPlayer.comando({azione:"avanti"})')).fragmentIndex,1);
 assert.equal(await run('document.querySelector("section.present > .presenta-slide .fragment[data-effetto=highlight-red]").classList.contains("visible")'),true);
 assert.equal((await run('PresentaPlayer.comando({azione:"indietro"})')).fragmentIndex,0);
 assert.equal(await run('document.querySelector("section.present > .presenta-slide .fragment[data-effetto=highlight-red]").classList.contains("visible")'),false);
 assert.deepEqual(await run('PresentaPlayer.comando({azione:"approfondisci"})'),{h:1,v:1,fragmentIndex:-1});
 assert(await run('document.querySelector("section.present > .presenta-slide").parentElement.hasAttribute("data-auto-animate")'),'stato successivo collegato');
 if(!await run('matchMedia("(prefers-reduced-motion: reduce)").matches'))assert(await run('document.querySelectorAll("section.present > .presenta-slide [data-auto-animate-target]").length>0'),'Reveal ha riconosciuto e animato gli elementi corrispondenti');
 assert.equal(await run('getComputedStyle(document.querySelector("section.present > .presenta-slide .presenta-blocco:nth-child(2)")).fontSize'),'52px');
 assert.deepEqual(await run('PresentaPlayer.comando({azione:"argomentoSuccessivo"})'),{h:2,v:0,fragmentIndex:-1});
 assert.equal(await run('document.querySelectorAll("section.present > .presenta-slide .katex").length'),5);assert.equal(await run('document.querySelectorAll("section.present > .presenta-slide .presenta-formula-errore").length'),1);
 assert(!await run('document.documentElement.outerHTML.includes("NOTA_PRIVATA")'));assert.equal(await run('typeof window.vault'),'undefined');
 await run('PresentaPlayer.comando({azione:"vai",h:0,v:0,fragmentIndex:-1})');await run('document.querySelector("audio").play()');assert.equal(await run('document.querySelector("audio").paused'),false);
 await run('PresentaPlayer.comando({azione:"argomentoSuccessivo"})');assert.equal(await run('document.querySelector("audio").paused'),true,'media fuori slide fermati');
 await run('PresentaPlayer.comando({azione:"vai",h:1,v:0,fragmentIndex:-1})');assert.equal(await run('document.querySelector("section.present > .presenta-slide .fragment[data-effetto=fade-in]").classList.contains("visible")'),false,'vai riapre la slide dal passaggio iniziale');
 await run('PresentaPlayer.comando({azione:"avanti"})');await run('PresentaPlayer.comando({azione:"avanti"})');
 await new Promise(r=>setTimeout(r,350));
 const immagine=await win.webContents.capturePage();const screenshot=process.env.PRESENTA_SCREENSHOT||path.join(tmp,'player.png');fs.mkdirSync(path.dirname(screenshot),{recursive:true});fs.writeFileSync(screenshot,immagine.toPNG());
 await run('document.documentElement.dataset.movimentoRidotto="true";PresentaPlayer.comando({azione:"vai",h:3,v:0,fragmentIndex:-1})');
 const geometria=await run(`(()=>{const s=document.querySelector('section.present>.presenta-slide'),b=s.querySelectorAll('.presenta-blocco')[1],r=b.getBoundingClientRect(),a=s.getBoundingClientRect();return {sfondo:getComputedStyle(s).backgroundColor,colore:getComputedStyle(s).color,x:(r.x-a.x)/a.width*100,width:r.width/a.width*100,maniglie:document.querySelectorAll('.presenta-maniglia').length};})()`);
 assert.equal(geometria.sfondo,'rgb(15, 17, 21)');assert.equal(geometria.colore,'rgb(251, 251, 250)');assert(Math.abs(geometria.x-53)<.1&&Math.abs(geometria.width-40)<.1);assert.equal(geometria.maniglie,0);
 win.setContentSize(1280,900);await run('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
 if(process.env.PRESENTA_FOGLIO_SCREENSHOT)fs.writeFileSync(process.env.PRESENTA_FOGLIO_SCREENSHOT,(await win.webContents.capturePage()).toPNG());
 const cornice=await run(`(()=>{const s=document.querySelector('section.present>.presenta-slide'),r=document.querySelector('.reveal'),b=document.querySelector('.backgrounds>.slide-background.present'),a=document.querySelector('.slides').getBoundingClientRect();return {sfondo:getComputedStyle(s).backgroundColor,esterno:getComputedStyle(b).backgroundColor,controlli:getComputedStyle(document.querySelector('.controls')).color,larghezza:a.width,altezza:a.height,disponibile:r.clientWidth};})()`);
 assert.equal(cornice.esterno,cornice.sfondo,'le bande fuori dalla slide ereditano il suo sfondo');
 assert.equal(cornice.controlli,'rgb(251, 251, 250)','i comandi del player restano visibili sullo sfondo scuro');
 assert(Math.abs(cornice.larghezza-cornice.disponibile)<2&&Math.abs(cornice.larghezza/cornice.altezza-16/9)<.01,'il player usa tutta la larghezza senza deformare il foglio');
 assert((await run(`getComputedStyle(document.querySelector('section.present>.presenta-slide h2')).fontFamily`)).includes('Atkinson'));
 assert(await run(`document.fonts.load('32px "Atkinson Hyperlegible"').then(f=>f.length===1)`));assert(await run(`document.fonts.load('32px "TestMe Sans"').then(f=>f.length===1)`));
 const testoStile=await run(`(()=>{const b=document.querySelector('section.present>.presenta-slide .presenta-blocco:nth-child(2)'),t=b.querySelector('.presenta-testo'),s=getComputedStyle(t);return {font:s.fontFamily,peso:s.fontWeight,corsivo:s.fontStyle,interlinea:s.lineHeight,sottolineato:getComputedStyle(b).getPropertyValue('--sottolineato-testo')};})()`);assert(testoStile.font.includes('Georgia'));assert.equal(testoStile.peso,'700');assert.equal(testoStile.corsivo,'italic');assert.equal(testoStile.interlinea,'51.2px');assert.equal(testoStile.sottolineato,'underline');
 assert(await run(`(async()=>{const e=document.querySelector('section.present>.presenta-slide svg image'),img=new Image();img.src=e.getAttribute('href');await img.decode();return img.naturalWidth>0&&e.parentElement.getAttribute('viewBox')==='20 20 60 40';})()`));
 assert(await run(`(()=>{const ns=[...document.querySelectorAll('section.present .presenta-testo span')],n=ns.find(n=>n.textContent==='destra'),s=getComputedStyle(n);return s.fontFamily.includes('TestMe')&&s.color==='rgb(34, 197, 94)'&&s.fontWeight==='400'&&s.textDecorationLine==='none'&&getComputedStyle(ns.find(n=>n.textContent==='A ')).textDecorationLine==='underline';})()`));
 for(const stile of ['normal','italic'])for(const peso of [200,300,400,500,600,700,800])assert(await run(`document.fonts.load('${stile} ${peso} 32px "Atkinson Hyperlegible Next"').then(f=>f.length===1&&f[0].status==='loaded')`));
 assert(await run(`document.fonts.load('700 32px "TestMe Sans Alternate"').then(f=>f.length===1)`));
 assert(await run(`(()=>{const n=[...document.querySelectorAll('section.present .presenta-testo span')].find(n=>n.textContent===' Leggero'),s=getComputedStyle(n);return s.fontFamily.includes('Next')&&s.fontWeight==='300'&&s.fontStyle==='italic';})()`));
 assert.equal(await run('document.querySelectorAll(".presenta-guide-fisse").length'),0);
 // Ogni effetto attraversa il player esportato, il tempo e il ritorno al clic iniziale.
 await run('document.documentElement.dataset.movimentoRidotto="false"');
 for(const [i,e]of A.catalogo.entries()){
  await run(`PresentaPlayer.comando({azione:'vai',h:${4+i},v:0,fragmentIndex:-1})`);
  const prima=await run('document.querySelector("section.present .presenta-contenuto").innerHTML');
  assert.equal(await run('Number(getComputedStyle(document.querySelector("section.present .presenta-animazione")).opacity)'),e.entrata?0:1,e.id+' stato prima del clic');
  await run('PresentaPlayer.comando({azione:"avanti"})');await new Promise(r=>setTimeout(r,350));
  for(let attesa=0;attesa<20;attesa++){const fine=await run(`(()=>{const s=getComputedStyle(document.querySelector('section.present .presenta-animazione'));return Number(s.opacity)===${e.uscita?0:1}&&${e.id==='blur'?"s.filter==='blur(8px)'":e.id==='focus-in'?"s.filter==='blur(0px)'":'true'};})()`);if(fine)break;await new Promise(r=>setTimeout(r,100));}
  const stato=await run(`(()=>{const el=document.querySelector('section.present .presenta-animazione');return {opacity:Number(getComputedStyle(el).opacity),transform:getComputedStyle(el).transform,filter:getComputedStyle(el).filter,text:el.textContent,styles:el.getAttribute('style')};})()`);
  assert.equal(stato.opacity,e.uscita?0:1,e.id+' stato finale');
  if(e.id==='fade-in')assert(await run(`Array.from(document.querySelectorAll('section.present .presenta-animazione')).every(e=>Number(getComputedStyle(e).opacity)===1)`),'un ingresso futuro non nasconde il contenuto fra due clic');
  if(e.id==='blur')assert.equal(stato.filter,'blur(8px)');if(e.id==='focus-in')assert.equal(stato.filter,'blur(0px)');
  if(e.id==='grow')assert(stato.transform.includes('1.15'),e.id);if(e.id==='shrink')assert(stato.transform.includes('0.85'),e.id);
  if(e.id==='wipe-in')assert(['inset(0%)','inset(0% 0% 0% 0%)'].includes(await run(`getComputedStyle(document.querySelector('section.present .presenta-animazione')).clipPath`)),'tendina completamente aperta alla fine');
  if(e.id.startsWith('path-'))assert(!/NaN/.test(stato.transform),e.id+' percorso valido');
  await run('PresentaPlayer.comando({azione:"indietro"})');
  assert.equal(await run('document.querySelector("section.present .presenta-contenuto").innerHTML'),prima,e.id+' DOM ripristinato, inclusi formule e formati');
  assert.equal(await run('document.querySelector("section.present .presenta-animazione").getAttribute("style")'),null,e.id+' nessuno stile residuo');
  // Movimento ridotto: risultato finale immediato, sempre rispettando il clic.
  await run('document.documentElement.dataset.movimentoRidotto="true";PresentaPlayer.comando({azione:"avanti"})');
  assert.equal(await run('Number(getComputedStyle(document.querySelector("section.present .presenta-animazione")).opacity)'),e.uscita?0:1,e.id+' movimento ridotto');
  await run('document.documentElement.dataset.movimentoRidotto="false"');
 }
 // Verifica il movimento durante l’esecuzione, non soltanto il risultato finale.
 for(const id of ['path-line','path-arc','path-orbit','path-wave','path-zigzag','letters','words','table-rows','table-columns','draw','shake','wobble','spin','bounce-in','wipe-in']){
  const i=A.catalogo.findIndex(e=>e.id===id);await run(`PresentaPlayer.comando({azione:'vai',h:${4+i},v:0,fragmentIndex:-1});(()=>{const e=document.querySelector('section.present .presenta-animazione'),a=JSON.parse(e.dataset.animazione);a.duration=2;a.delay=0;a.inizio=0;e.dataset.animazione=JSON.stringify(a);})()`);
  const prima=await run('document.querySelector("section.present .presenta-contenuto").innerHTML');await run('PresentaPlayer.comando({azione:"avanti"})');await new Promise(r=>setTimeout(r,220));
  if(id.startsWith('path-'))assert(await run(`(()=>{const m=new DOMMatrix(getComputedStyle(document.querySelector('section.present .presenta-animazione')).transform);return Math.abs(m.e)+Math.abs(m.f)>1;})()`),id+' movimento reale intermedio');
  if(['letters','words','table-rows','table-columns'].includes(id))assert(await run(`(()=>{const ns=[...document.querySelectorAll('section.present .presenta-animazione ${['words','letters'].includes(id)?'span[style]':id==='table-columns'?'th,section.present .presenta-animazione td':'tr'}')],op=ns.map(e=>Number(getComputedStyle(e).opacity));return op.some(n=>n>0)&&op.some(n=>n===0);})()`),id+' contenuti in momenti diversi');
  if(id==='letters')assert(await run(`Array.from(document.querySelectorAll('section.present .presenta-animazione span')).some(e=>e.textContent==='👩‍🚀'&&e.children.length===0)`),'emoji composto conservato come un unico carattere');
  if(['shake','wobble','spin','bounce-in'].includes(id))assert(await run(`(()=>{const m=new DOMMatrix(getComputedStyle(document.querySelector('section.present .presenta-animazione')).transform);return Math.abs(m.a-1)+Math.abs(m.b)+Math.abs(m.c)+Math.abs(m.d-1)+Math.abs(m.e)+Math.abs(m.f)>.01;})()`),id+' trasformazione in corso');
  if(id==='wipe-in')assert(await run(`(()=>{const s=getComputedStyle(document.querySelector('section.present .presenta-animazione'));return s.clipPath!=='none'&&s.clipPath!=='inset(0%)';})()`),'tendina in corso');
  if(id==='draw')assert(await run(`(()=>{const n=parseFloat(document.querySelector('section.present .presenta-forma path').getAttribute('stroke-dasharray'));return n>0&&n<1000;})()`),'contorno SVG in corso');
  await run('PresentaPlayer.comando({azione:"indietro"})');assert.equal(await run('document.querySelector("section.present .presenta-contenuto").innerHTML'),prima,id+' ritorno durante animazione');
 }
 await run('PresentaPlayer.comando({azione:"vai",h:3,v:0,fragmentIndex:-1})');
 const immagineEvidenza=await run(`(()=>{const e=document.querySelector('section.present .presenta-contenuto:has(svg image)'),prima=e.getAttribute('style'),h=PresentaAnimazioniDOM.esegui(e,{effect:'highlight-red'},{finale:true});const colore=getComputedStyle(e).outlineColor;h.revert();return {colore,prima,dopo:e.getAttribute('style')};})()`);assert.equal(immagineEvidenza.colore,'rgb(239, 68, 68)',JSON.stringify(immagineEvidenza));assert.equal(immagineEvidenza.dopo,immagineEvidenza.prima);
 await verificaSfondi();
 // Secondo HTML autonomo: nessun indice preso in prestito dalla galleria precedente.
 let elementi=M.crea('00000000-0000-4000-8000-000000000001','Elementi');const es=elementi.stacks[0].slides[0].id;
 const eo=o=>elementi=M.applica(elementi,{slideId:es,...o});eo({tipo:'titoloSlide',title:'Partenza'});eo({tipo:'aggiungiSlide',direzione:'sotto'});eo({tipo:'aggiungiSlide',direzione:'destra'});eo({tipo:'inserisciComune',type:'navbar'});eo({tipo:'inserisciComune',type:'page-number'});
 const navbar=elementi.stacks[0].slides[0].blocks.find(b=>b.type==='navbar');eo({tipo:'blocco',blockId:navbar.id,block:{...navbar,orientation:'vertical',activeZoom:1.2,style:{...navbar.style,box:{x:5,y:20,width:24,height:65},navbar:{activeTextColor:'#cc2200',activeGraphicColor:'#008800',border:{width:3,color:'#111111',opacity:.5},background:{color:'#ffffff',opacity:.3},separator:{width:2,color:'#0000ff',opacity:.4},activeBackground:{color:'#aaaaaa',opacity:.2}}}}});
 const drawing={viewBox:'0 0 100 100',scene:[],nodes:[{tag:'path',attrs:{d:'M0 0 L100 100',stroke:'#ef4444','stroke-width':'4'},children:[]}]};eo({tipo:'inserisciBlocco',block:{type:'drawing',slot:'body',drawing,style:{appearance:{opacity:.6,blend:'multiply',grayscale:100},box:{x:20,y:30,width:40,height:40}}}});
 const elementiFile=path.join(spostato,'elementi.html');fs.writeFileSync(elementiFile,require('../lib/presentazioni-export').html(elementi).html);await run('PresentaPlayer.destroy()');await win.loadFile(elementiFile);await run('PresentaPlayer.ready');
 assert.equal(await run('document.querySelector(".presenta-comuni .presenta-numero-pagina").textContent'),'1/2');
 assert(await run(`!document.querySelector('.presenta-comuni').closest('.slides')`),'navbar e numeratore fuori dalle transizioni Reveal');
 await run(`window.__nav=document.querySelector('.presenta-comuni [data-type=navbar]');window.__numero=document.querySelector('.presenta-comuni [data-type=page-number]');window.__step=__nav.querySelector('[data-nav-v="1"]');window.__fermi=[__nav,__numero].map(e=>e.getBoundingClientRect().toJSON());`);

 assert.equal(await run('getComputedStyle(document.querySelector("section.present > .presenta-slide [data-type=drawing]")).opacity'),'0.6');
 assert.equal(await run('document.querySelectorAll("section.present > .presenta-slide .presenta-vettore path").length'),1);
 assert.equal(await run(`getComputedStyle(document.querySelector('.presenta-comuni .presenta-navbar [aria-current]')).color`),'rgb(204, 34, 0)');
 assert.equal(await run(`getComputedStyle(document.querySelector('.presenta-comuni .presenta-navbar [aria-current] .presenta-step-numero')).color`),'rgb(204, 34, 0)');
 assert.equal(await run(`getComputedStyle(document.querySelector('.presenta-comuni .presenta-navbar [aria-current] .presenta-step-numero')).borderTopColor`),'color(srgb 0 0.533333 0 / 0.5)');
 assert.equal(await run(`getComputedStyle(document.querySelector('.presenta-comuni .presenta-navbar .presenta-step-numero')).borderTopWidth`),'3px');
 assert.equal(await run('getComputedStyle(document.querySelector(".presenta-comuni .presenta-navbar")).flexDirection'),'column');
 for(let attesa=0;attesa<20;attesa++){if(Math.abs(await run('new DOMMatrix(getComputedStyle(document.querySelector(".presenta-comuni [aria-current]>.presenta-step-contenuto")).transform).a')-1.2)<.01)break;await new Promise(r=>setTimeout(r,100));}
 const scalaEsportata=await run('new DOMMatrix(getComputedStyle(document.querySelector(".presenta-comuni [aria-current]>.presenta-step-contenuto")).transform).a');assert(Math.abs(scalaEsportata-1.2)<.01,'zoom dello step attivo nel player esportato: '+scalaEsportata);
 assert.equal(await run('new DOMMatrix(getComputedStyle(document.querySelector(".presenta-comuni button:not([aria-current])>.presenta-step-contenuto")).transform).a'),1);

 const transizione=await run(`new Promise(resolve=>{let n=0,fermi=true,zoom=false,ritorno=false,numero=false;const vecchio=__nav.querySelector('[aria-current] .presenta-step-contenuto');__step.click();function campiona(){const attuali=[__nav,__numero].map(e=>e.getBoundingClientRect());fermi=fermi&&attuali.every((r,i)=>['x','y','width','height'].every(k=>Math.abs(r[k]-__fermi[i][k])<.1));const nuovo=__nav.querySelector('[aria-current] .presenta-step-contenuto'),scala=e=>new DOMMatrix(getComputedStyle(e).transform).a,a=scala(nuovo),b=scala(vecchio),valore=__numero.querySelector('.presenta-numero-valore');zoom=zoom||a>1.001&&a<1.199;ritorno=ritorno||b>1.001&&b<1.199;numero=numero||Number(getComputedStyle(valore).opacity)<.99;if(++n<30)requestAnimationFrame(campiona);else resolve({fermi,zoom,ritorno,numero,stessi:__nav===document.querySelector('.presenta-comuni [data-type=navbar]')&&__numero===document.querySelector('.presenta-comuni [data-type=page-number]')&&__step===__nav.querySelector('[data-nav-v="1"]')});}requestAnimationFrame(campiona);})`);
 assert(transizione.fermi&&transizione.stessi,JSON.stringify(transizione));if(!await run('matchMedia("(prefers-reduced-motion: reduce)").matches'))assert(transizione.zoom&&transizione.ritorno&&transizione.numero,JSON.stringify(transizione));
 assert.deepEqual(await run('PresentaPlayer.stato()'),{h:0,v:1,fragmentIndex:-1});assert.equal(await run('document.querySelector(".presenta-comuni .presenta-numero-pagina").textContent'),'1a/2');
 assert(await run(`new Promise(resolve=>{let n=0;document.querySelector('.presenta-comuni [data-nav-h="1"]').click();function campiona(){if(![__nav,__numero].every((e,i)=>['x','y','width','height'].every(k=>Math.abs(e.getBoundingClientRect()[k]-__fermi[i][k])<.1)))return resolve(false);if(++n<30)requestAnimationFrame(campiona);else resolve(true);}requestAnimationFrame(campiona);})`),'comuni fermi durante tutta la transizione orizzontale');
 assert.deepEqual(await run('PresentaPlayer.stato()'),{h:1,v:0,fragmentIndex:-1});assert.equal(await run('document.querySelector(".presenta-comuni .presenta-numero-pagina").textContent'),'2/2');
 await run(`(async()=>{for(const [h,v] of [[0,1],[1,0],[0,0],[0,1]]){PresentaPlayer.comando({azione:'vai',h,v,fragmentIndex:-1});await new Promise(r=>requestAnimationFrame(r));}await new Promise(r=>setTimeout(r,250));})()`);
 assert.equal(await run('document.querySelector(".presenta-comuni .presenta-numero-pagina").textContent'),'1a/2');assert(Math.abs(await run('new DOMMatrix(getComputedStyle(document.querySelector(".presenta-comuni [aria-current]>.presenta-step-contenuto")).transform).a')-1.2)<.001,'clic rapidi: ultimo step alla scala corretta');

 await run(`document.documentElement.dataset.movimentoRidotto='true';document.querySelector('.presenta-comuni [data-nav-v="1"]').click()`);assert(Math.abs(await run('new DOMMatrix(getComputedStyle(document.querySelector(".presenta-comuni [aria-current]>.presenta-step-contenuto")).transform).a')-1.2)<.01,'movimento ridotto: zoom finale immediato');

 // Anche la navbar orizzontale conserva i nodi e rispetta le slide con comuni nascosti.
 const navOrizzontale=elementi.stacks[0].slides[0].blocks.find(b=>b.type==='navbar');eo({tipo:'blocco',blockId:navOrizzontale.id,block:{...navOrizzontale,orientation:'horizontal',style:{...navOrizzontale.style,box:{x:7,y:86,width:72,height:12}}}});
 const nascosta=elementi.stacks[0].slides[1];for(const b of nascosta.blocks.filter(M.comune))eo({tipo:'visibilitaComune',slideId:nascosta.id,blockId:b.id,hidden:true});
 fs.writeFileSync(elementiFile,require('../lib/presentazioni-export').html(elementi).html);await run('PresentaPlayer.destroy()');await win.loadFile(elementiFile);await run('PresentaPlayer.ready');
 assert.equal(await run('getComputedStyle(document.querySelector(".presenta-comuni .presenta-navbar")).flexDirection'),'row');
 await run(`window.__nav=document.querySelector('.presenta-comuni [data-type=navbar]');PresentaPlayer.comando({azione:'vai',h:0,v:1,fragmentIndex:-1})`);assert(await run(`__nav.hidden&&document.querySelector('.presenta-comuni [data-type=page-number]').hidden`),'nascondi soltanto su questa slide');
 await run(`PresentaPlayer.comando({azione:'vai',h:1,v:0,fragmentIndex:-1})`);assert(await run(`!__nav.hidden&&__nav===document.querySelector('.presenta-comuni [data-type=navbar]')`),'ricompare lo stesso riquadro');
 win.setSize(900,760);await run(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);assert(await run(`(()=>{const a=document.querySelector('.slides').getBoundingClientRect(),b=document.querySelector('.presenta-comuni').getBoundingClientRect();return ['x','y','width','height'].every(k=>Math.abs(a[k]-b[k])<.1);})()`),'resize: comuni e foglio hanno la stessa scala');win.setSize(1280,720);
 for(const b of nascosta.blocks.filter(M.comune))eo({tipo:'visibilitaComune',slideId:nascosta.id,blockId:b.id,hidden:false});

 // Lo sfondo comune resta un singolo elemento durante slide e approfondimenti.
 eo({tipo:'sfondoMedia',assetId:'sfondo_comune',asset:Object.values(sfondi.assets).find(a=>a.kind==='video'),backgroundMedia:{assetId:'sfondo_comune',fit:'cover'}});eo({tipo:'sfondoTutte'});
 const comuneFile=path.join(spostato,'comune.html');fs.writeFileSync(comuneFile,require('../lib/presentazioni-export').html(elementi).html);await run('PresentaPlayer.destroy()');await win.loadFile(comuneFile);await run('PresentaPlayer.ready');
 for(let i=0;i<30;i++){if(await run(`document.querySelector('.presenta-sfondo-comune video')?.readyState>=2`))break;await new Promise(r=>setTimeout(r,100));}
 assert.equal(await run(`document.querySelectorAll('.presenta-sfondo-comune video').length`),1);assert(await run(`document.querySelector('.presenta-sfondo-comune video').loop`));
 await run(`window.__sfondo=document.querySelector('.presenta-sfondo-comune video');__sfondo.pause();__sfondo.currentTime=.05;window.__rect=JSON.stringify(__sfondo.getBoundingClientRect().toJSON());PresentaPlayer.comando({azione:'vai',h:0,v:1,fragmentIndex:-1})`);
 assert(await run(`__sfondo===document.querySelector('.presenta-sfondo-comune video')`),'stesso video DOM');assert(await run(`__sfondo.currentTime>=.049`),'il video non riparte da zero');assert(await run(`JSON.stringify(__sfondo.getBoundingClientRect().toJSON())===__rect`),'sfondo fermo durante la transizione');
 eo({tipo:'sfondoAutonomo',slideId:elementi.stacks[1].slides[0].id,autonomo:true});eo({tipo:'sfondoPattern',slideId:elementi.stacks[1].slides[0].id,pattern:'naturale'});eo({tipo:'sfondoPattern',pattern:'cotone'});
 fs.writeFileSync(comuneFile,require('../lib/presentazioni-export').html(elementi).html);await run('PresentaPlayer.destroy()');await win.loadFile(comuneFile);await run('PresentaPlayer.ready');
 assert.equal(await run(`document.querySelectorAll('.presenta-sfondo-comune img[src*=cotone]').length`),1);await run(`window.__carta=document.querySelector('.presenta-sfondo-comune');PresentaPlayer.comando({azione:'vai',h:0,v:1,fragmentIndex:-1})`);assert(await run(`__carta===document.querySelector('.presenta-sfondo-comune')&&!__carta.hidden`));await run(`PresentaPlayer.comando({azione:'vai',h:1,v:0,fragmentIndex:-1})`);assert(await run(`__carta.hidden`));assert.equal(await run(`document.querySelectorAll('section.present img.presenta-carta[src*=naturale]').length`),1,'texture di carta autonoma');
 assert.equal(await run(`getComputedStyle(document.querySelector('section.present img.presenta-carta')).objectFit`),'cover','la carta copre tutto il foglio senza bande laterali');
 eo({tipo:'sfondoAutonomo',autonomo:false});eo({tipo:'sfondoPattern',pattern:'chiara'});fs.writeFileSync(comuneFile,require('../lib/presentazioni-export').html(elementi).html);await run('PresentaPlayer.destroy()');await win.loadFile(comuneFile);await run('PresentaPlayer.ready');await run(`document.querySelector('.presenta-sfondo-comune img').decode()`);assert(await run(`document.querySelector('.presenta-sfondo-comune img').naturalWidth>1000`),'texture chiarissima reale');
 assert.deepEqual(rete,[],'nessuna dipendenza di rete');assert.deepEqual(errori,[],'nessun errore del renderer');
 await run('PresentaPlayer.destroy()');console.log('✓ Player reale offline: passi, simultaneità, inverso, Auto-Animate verticale, formule, media, privacy e pacchetto spostato.');console.log('Schermata: '+screenshot);app.exit(0);
}).catch(e=>{console.error(e);app.exit(1);});
app.on('will-quit',()=>{if(win&&!win.isDestroyed())win.destroy();fs.rmSync(tmp,{recursive:true,force:true});});
