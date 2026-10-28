'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),WS=require('ws'),c=require('./cdp');
setTimeout(()=>{console.error('Tempo massimo LIM');process.exit(1);},180000).unref();let peer;
async function wait(expr,client=c){for(let n=0;n<150;n++){if(await client.val(expr))return;await c.pausa(100);}throw Error('Attesa: '+expr);}
async function collega(){let t;for(let n=0;n<50&&!t;n++){t=(await(await fetch('http://localhost:'+(process.env.STUDIA_PORTA||9467)+'/json')).json()).find(t=>t.url.includes('/proiezione/index.html'));if(!t)await c.pausa(100);}assert(t);const ws=new WS(t.webSocketDebuggerUrl),pending=new Map();let id=0;await new Promise(r=>ws.once('open',r));ws.on('message',s=>{const o=JSON.parse(s);if(pending.has(o.id)){pending.get(o.id)(o);pending.delete(o.id);}});const invia=(method,params)=>new Promise(r=>{pending.set(++id,r);ws.send(JSON.stringify({id,method,params}));});return {ws,invia,val:async expression=>{const r=await invia('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.result.exceptionDetails)throw Error(JSON.stringify(r.result.exceptionDetails));return r.result.result.value;}};}
async function clicca(sel,client){const p=await client.val(`(()=>{const r=document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);for(const type of ['mousePressed','mouseReleased'])await client.invia('Input.dispatchMouseEvent',{type,...p,button:'left',clickCount:1});}
async function shot(nome,client=c){const r=await client.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/zaino-lim-'+nome+'.png',Buffer.from(r.result.data,'base64'));}
// I dati provengono dal vero dragstart; CDP consegna il drop al canvas nella finestra scelta.
async function trasporto(sel){
 const d=await c.val(`(()=>{const dt=new DataTransfer();document.querySelector(${JSON.stringify(sel)}).dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:dt}));return {tipi:[...dt.types],payload:dt.getData(LimModello.MIME),testo:dt.getData('text/plain')};})()`);
 assert(d.tipi.includes('application/x-studia-lim'));assert(d.testo,'conserva il trascinamento negli appunti');return d;
}
async function rilascia(d,client,host,editor){
 await client.val(`${editor}.api.updateScene({appState:{zoom:{value:1.4},scrollX:85,scrollY:-35,selectedElementIds:{}}})`);await c.pausa(150);
 const prima=await client.val(`(()=>{const a=${editor}.api,s=a.getAppState(),r=document.querySelector('${host} .lim-editor').getBoundingClientRect();return {ids:a.getSceneElements().map(e=>e.id),x:r.x+r.width*.65,y:r.y+r.height*.6,s:{zoom:s.zoom.value,scrollX:s.scrollX,scrollY:s.scrollY,left:s.offsetLeft,top:s.offsetTop}};})()`);
 const data={items:[{mimeType:'application/x-studia-lim',data:d.payload}],dragOperationsMask:1};
 for(const type of ['dragEnter','dragOver','drop']){const r=await client.invia('Input.dispatchDragEvent',{type,x:prima.x,y:prima.y,data});assert(!r.error,JSON.stringify(r.error));}
 await wait(`${editor}.api.getSceneElements().length>${prima.ids.length}`,client);await client.val(`${editor}.salva()`);
 const dopo=await client.val(`(()=>{const a=${editor}.api,s=a.getAppState();return {nuovi:a.getSceneElements().filter(e=>!${JSON.stringify(prima.ids)}.includes(e.id)),zoom:s.zoom.value,scrollX:s.scrollX,scrollY:s.scrollY};})()`);
 const base=dopo.nuovi.find(e=>['rectangle','image'].includes(e.type));assert(base,'oggetto visuale, non markdown incollato');
 assert(Math.abs(base.x-((prima.x-prima.s.left)/prima.s.zoom-prima.s.scrollX))<1,'ascissa del rilascio con zoom e pan');
 assert(Math.abs(base.y-((prima.y-prima.s.top)/prima.s.zoom-prima.s.scrollY))<1,'ordinata del rilascio con zoom e pan');
 assert.deepEqual([dopo.zoom,dopo.scrollX,dopo.scrollY],[prima.s.zoom,prima.s.scrollX,prima.s.scrollY],'il drop conserva la vista');
 if(base.type==='image'){
  // Verifica i pixel sulla tela visibile: avere il file nello stato non basta.
  await wait(`(()=>{const cv=document.querySelector('${host} canvas.static'),r=cv.getBoundingClientRect(),s=${editor}.api.getAppState(),x=(${base.x}+20+s.scrollX)*s.zoom.value+s.offsetLeft,y=(${base.y}+30+s.scrollY)*s.zoom.value+s.offsetTop,p=cv.getContext('2d').getImageData(Math.floor((x-r.x)*cv.width/r.width),Math.floor((y-r.y)*cv.height/r.height),1,1).data;return Math.abs(p[0]-16)<5&&Math.abs(p[1]-165)<5&&Math.abs(p[2]-148)<5;})()`,client);
 }
 return dopo.nuovi;
}
async function menuContestuale(client,host,tema){
 const p=await client.val(`(()=>{const r=document.querySelector('${host} .lim-editor').getBoundingClientRect();return {x:r.right-80,y:r.top+r.height*.55};})()`);
 for(const type of ['mousePressed','mouseReleased'])await client.invia('Input.dispatchMouseEvent',{type,...p,button:'right',clickCount:1});
 try{await wait(`!!document.querySelector('${host} .context-menu')`,client);}catch(e){await shot('menu-assente',client);console.log(await client.val(`({target:document.elementFromPoint(${p.x},${p.y})?.outerHTML.slice(0,400),menus:[...document.querySelectorAll('.context-menu')].map(m=>m.parentElement.outerHTML.slice(0,400))})`));throw e;}
 await c.pausa(150);
 const misura=await client.val(`(()=>{const m=document.querySelector('${host} .context-menu').getBoundingClientRect(),h=document.querySelector('${host} .lim-editor').getBoundingClientRect(),p=document.querySelector('${host} .context-menu').parentElement;return {m:m.toJSON(),h:h.toJSON(),height:innerHeight,pop:p.style.cssText};})()`);
 await shot('contestuale-'+tema,client);
 assert(misura.m.width>=190&&misura.m.left>=misura.h.left&&misura.m.right<=misura.h.right&&misura.m.top>=misura.h.top&&misura.m.bottom<=Math.min(misura.h.bottom,misura.height),'bolla leggibile e interamente visibile nello split: '+JSON.stringify(misura));
 const stile=await client.val(`(()=>{const m=document.querySelector('${host} .context-menu'),s=getComputedStyle(m),b=getComputedStyle(document.querySelector('${host} .lim-menu')),it=getComputedStyle(m.querySelector('button'));return {r:s.borderRadius,bg:s.backgroundColor,panel:b.backgroundColor,shadow:s.boxShadow,ombra:b.boxShadow,font:it.fontSize};})()`);
 assert.equal(stile.r,'0px');assert.equal(stile.bg,stile.panel);assert.equal(stile.shadow,stile.ombra);assert.equal(stile.font,'12px');
 await shot('contestuale-'+tema,client);
 await client.invia('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab'});
 assert(await client.val(`!!document.activeElement.closest('${host} .context-menu')`),'menu utilizzabile da tastiera');
 await client.invia('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
 await wait(`!document.querySelector('${host} .context-menu')`,client);
}
(async()=>{
 await c.collega();await wait('!!window.ZainoLim');const vault=await c.val('window.vault.path');assert(vault.includes('studia-zaino-prova-'));
 await c.val("cambiaZaino('biologia',true);bancoForma('due-col');bancoAssegna('A','lim')");await c.pausa(400);assert(await c.val("document.querySelector('#limPane [aria-label=\"Elimina lavagnata\"]').disabled"),'cestino inattivo senza lavagnata');assert.equal(await c.val("!!document.querySelector('#zs-lim')"),false,'sidebar assente prima della prima lavagnata');
 assert.equal(await c.val("document.querySelector('#limPane .lim-scegli span').textContent"),'-','lavagna non salvata senza titolo');
 assert.equal(await c.val("!!document.querySelector('#limPane [aria-label=\"Rinomina lavagnata\"]')"),false,'nessuna matita nella toolbar');
 await wait('!!ZainoLim.editor.api');
 await c.clicca('#limPane .main-menu-trigger');
 assert(await c.val("!!document.querySelector('#limPane [aria-label=\"Sfondo nero\"]')"),'nero disponibile fra gli sfondi della lavagna');
 await shot('sfondi');
 await c.clicca('#limPane [aria-label="Sfondo nero"]');
 await wait("ZainoLim.editor.api.getAppState().viewBackgroundColor==='#000000'");
 await wait("!document.querySelector('#limPane [data-testid=button-undo]').disabled");
 await c.clicca('#limPane [data-testid=button-undo]');
 await wait("ZainoLim.editor.api.getAppState().viewBackgroundColor==='#ffffff'");
 await c.clicca('#limPane [data-testid=button-redo]');
 await wait("ZainoLim.editor.api.getAppState().viewBackgroundColor==='#000000'");
 for(const tema of ['chiaro','scuro']){await c.val(`document.documentElement.dataset.theme='${tema}'`);await menuContestuale(c,'#limPane',tema);}
 await c.val("document.documentElement.dataset.theme='chiaro'");
 await c.val("ZainoLim.editor.api.updateScene({elements:LimEditor.converti([{type:'text',x:50,y:50,text:'Prima del salvataggio',fontSize:24}])})");await c.pausa(500);
 assert.equal(await c.val('ZainoLim.doc'),null,'il disegno aspetta il primo salvataggio');
 assert.equal(await c.val("!!document.querySelector('#zs-lim')"),false,'nessun file prima del floppy');
 await c.clicca('#limPane [aria-label="Salva lavagnata"]');await wait('!!ZainoLim.doc');await wait("!!document.querySelector('#zs-lim')");
 const titolo=await c.val('ZainoLim.doc.studia.title');assert.match(titolo,/^LAVAGNA 001 \[\d{2}\/\d{2}\/\d{4}\]$/);
 assert(await c.val("ZainoLim.editor.api.getSceneElements().some(e=>e.text==='Prima del salvataggio')"),'primo salvataggio conserva il disegno');

 const id=await c.val('ZainoLim.doc.studia.id');
 assert(await c.val("!!document.querySelector('#limPane .lim-scegli')"),'selettore LIM compatto con bubble menu');
 assert.equal(await c.val("!!document.querySelector('#limPane .lim-bar select')"),false,'nessun select nativo nella barra LIM');
 await c.clicca('#limPane .lim-scegli');
 await wait("!!document.querySelector('#limPane .lim-menu:popover-open')");
 assert.equal(await c.val("document.querySelector('#limPane .lim-menu [aria-checked=true]').dataset.limId"),id);
 await c.invia('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
 await wait("!document.querySelector('#limPane .lim-menu:popover-open')");
 assert(await c.val("document.activeElement===document.querySelector('#limPane .lim-scegli')"),'Esc restituisce il fuoco al nome');
 await c.val("ZainoLim.editor.inserisci({testo:'Nucleo e membrana',titolo:'Botanica.pdf; p. 1',link:'pdf:01#p=1'})");
 await wait("ZainoLim.editor.api.getSceneElements().some(e=>e.text?.includes('Nucleo'))");
 const file=path.join(vault,'Zaini/biologia/LIM',id+'.excalidraw');assert(fs.existsSync(file));assert(JSON.parse(fs.readFileSync(file)).elements.some(e=>e.text?.includes('Nucleo')));
 assert.equal(JSON.parse(fs.readFileSync(file)).appState.viewBackgroundColor,'#000000','sfondo salvato nel file della lavagnata');
 // Menu e drag delle parole chiave usano lo stesso inserimento modificabile, con fonte e colore.
 const keyword=await c.val("(()=>{const r=window.vault.evidenze.aggiungi('biologia',{exact:'Clorofilla',prefix:'La ',suffix:' assorbe luce',materiale:'01 Botanica.pdf',pagina:1,colore:'#ffd966'});if(r.error)throw Error(r.error);evidenzeCarica();bancoAssegna('C','keyword');keywordDisegna();return r.evidenze.find(e=>e.exact==='Clorofilla').id;})()");
 const chip=`.kwchip[data-kw="${keyword}"]`;await wait(`!!document.querySelector(${JSON.stringify(chip)})`);
 await c.val(`(()=>{const e=document.querySelector(${JSON.stringify(chip)}),r=e.getBoundingClientRect();e.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.x+20,clientY:r.y+20}));})()`);
 await c.clicca('#kwMenu [data-kwaz="lim"]');await wait("ZainoLim.editor.api.getSceneElements().some(e=>e.text==='Clorofilla')");await c.pausa(300);
 const parolaDrag=await trasporto(chip);assert(parolaDrag.tipi.includes('application/x-studia-evidenza'));
 const etichetta=await rilascia(parolaDrag,c,'#limPane','ZainoLim.editor');
 const rettangolo=etichetta.find(e=>e.type==='rectangle'),testo=etichetta.find(e=>e.type==='text');assert.equal(rettangolo.backgroundColor,'#ffd966');assert.equal(testo.text,'Clorofilla');assert.equal(testo.containerId,rettangolo.id);assert(testo.link.startsWith('zaino-pdf:'));assert.equal(testo.link,rettangolo.link);
 assert.equal(await c.val(`RimandiSintassi.leggi(${JSON.stringify(testo.link)}).selezione.testo`),'Clorofilla');
 await shot('keyword-trascinata');
 const immagini=await c.val(`(()=>{const c=document.createElement('canvas');c.width=1600;c.height=900;const g=c.getContext('2d');g.fillStyle='#10a594';g.fillRect(0,0,c.width,c.height);g.fillStyle='black';g.font='80px Arial';g.fillText('Originale 1600 × 900',60,180);window.__immagineLim=c.toDataURL();return ['ritaglio','foto'].map(origine=>{const r=window.vault.album.salva('biologia',{origine,materiale:origine==='ritaglio'?'01 Botanica.pdf':'Foglia.png',didascalia:'Foglia originale',pagina:1,rect:{x:0,y:0,w:1600,h:900},dati:window.__immagineLim});if(r.error)throw Error(r.error);return r.voce.id;});})()`);
 await c.val("bancoAssegna('C','album');AlbumSpazio.scegli('ritagli');AlbumSpazio.aggiorna()");await wait(`!!document.querySelector('#albLista [data-id="${immagini[0]}"]')`);
 const ritaglioDrag=await trasporto(`#albLista [data-id="${immagini[0]}"]`);assert(ritaglioDrag.tipi.includes('application/x-studia-album'));
 const ritaglio=await rilascia(ritaglioDrag,c,'#limPane','ZainoLim.editor'),img=ritaglio.find(e=>e.type==='image');assert.equal(img.width/img.height,1600/900);assert(img.link.startsWith('zaino-pdf:'));
 assert.equal(await c.val(`ZainoLim.editor.api.getFiles()[${JSON.stringify(img.fileId)}].dataURL===window.__immagineLim`),true,'incorpora l’originale, non la miniatura');
 assert(ritaglio.some(e=>e.text==='Foglia originale\nBotanica.pdf; p. 1'));
 await c.val("AlbumSpazio.scegli('immagini')");await wait(`!!document.querySelector('#fotoLista [data-id="${immagini[1]}"]')`);
 const fotoDrag=await trasporto(`#fotoLista [data-id="${immagini[1]}"]`);
 await shot('album-trascinato');
 await shot('banco');
 await c.val("bancoAssegna('C','fonte');openPdf('01 Botanica.pdf',1)");await wait('PDFJS.pronto&&!!PDFJS.viewer?.pdfDocument');assert(await c.val("['fontSize','fontWeight','textTransform','letterSpacing'].every(k=>getComputedStyle(document.querySelector('#limPane .lim-scegli'))[k]===getComputedStyle(document.getElementById('pdfDoc'))[k])"),'tipografia uguale al selettore Fonti');await c.val("BancoPresentazione.apriProiezione('fonte')");peer=await collega();await wait("document.body.dataset.tipo==='immagine'",peer);await wait("!!document.querySelector('.proiezione-area')");
 await peer.val('ProiezioneLavagna.apri()');await wait('!!ProiezioneLavagna.editor?.api',peer);assert.equal(await peer.val('ProiezioneLavagna.editor.doc.studia.id'),id);
 assert.equal(await peer.val('ProiezioneLavagna.editor.api.getAppState().viewBackgroundColor'),'#000000','riapertura con lo stesso fondo');
 await clicca('#limProiezione .main-menu-trigger',peer);
 await clicca('#limProiezione [data-testid="color-top-pick-#ffffff"]',peer);
 await wait("ZainoLim.editor.api.getAppState().viewBackgroundColor==='#ffffff'");
 await clicca('#limProiezione [aria-label="Sfondo nero"]',peer);
 await wait("ProiezioneLavagna.editor.api.getAppState().viewBackgroundColor==='#000000'",peer);
 await wait("ZainoLim.editor.api.getAppState().viewBackgroundColor==='#000000'");
 const fotoLim=await rilascia(fotoDrag,peer,'#limProiezione','ProiezioneLavagna.editor'),foto=fotoLim.find(e=>e.type==='image');assert.equal(foto.link,'album:'+immagini[1]);
 assert.equal(await peer.val(`ProiezioneLavagna.editor.api.getFiles()[${JSON.stringify(foto.fileId)}].dataURL`),await c.val('window.__immagineLim'));
 await wait(`ZainoLim.editor.api.getSceneElements().some(e=>e.id===${JSON.stringify(foto.id)})`);
 await rilascia(parolaDrag,peer,'#limProiezione','ProiezioneLavagna.editor');
 await wait("ZainoLim.editor.api.getSceneElements().filter(e=>e.text==='Clorofilla').length===3");
 assert.equal(await c.val("window.vault.evidenze.leggi('biologia').evidenze.length"),1);assert.equal(await c.val("window.vault.album.elenco('biologia').voci.length"),2,'trasferire non sposta gli originali');
 await shot('trasferimenti-proiezione',peer);
 await menuContestuale(peer,'#limProiezione','proiezione');
 await peer.val("document.querySelector('.lim-scegli').click()");await wait("!!document.querySelector('.lim-menu:popover-open')",peer);
 assert.equal(await peer.val("document.querySelector('.lim-menu [aria-checked=true]').dataset.limId"),id);
 await shot('menu-proiezione',peer);
 await peer.invia('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
 await wait("!document.querySelector('.lim-menu:popover-open')",peer);
 // La barra LIM resta a portata di mano anche mentre quella della proiezione scompare.
 await peer.val("document.activeElement?.blur()");await peer.invia('Input.dispatchMouseEvent',{type:'mouseMoved',x:200,y:300});
 await wait("document.getElementById('barra').dataset.nascosta==='1'",peer);await c.pausa(250);
 assert.deepEqual({cestino:await c.val("!!document.querySelector('#limPane [aria-label=\"Elimina lavagnata\"]')"),barraInAlto:await peer.val("Math.abs(document.querySelector('#limProiezione .lim-bar').getBoundingClientRect().top)<1")},{cestino:true,barraInAlto:true},'cestino LIM e nessuno spazio vuoto quando la barra principale si nasconde');
 await shot('barra-nascosta',peer);
 const tasto=await peer.val("(()=>{const r=document.querySelector('.lim-scegli').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
 await peer.invia('Input.dispatchMouseEvent',{type:'mouseMoved',...tasto});
 await peer.invia('Input.dispatchMouseEvent',{type:'mousePressed',...tasto,button:'left',clickCount:1});await peer.invia('Input.dispatchMouseEvent',{type:'mouseReleased',...tasto,button:'left',clickCount:1});
 await wait("!!document.querySelector('.lim-menu:popover-open')",peer);
 assert.equal(await peer.val("document.getElementById('barra').dataset.nascosta"),'1','i comandi LIM non fanno riapparire la barra sopra il puntatore');
 await peer.invia('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
 await peer.invia('Input.dispatchMouseEvent',{type:'mouseMoved',x:200,y:4});await c.pausa(250);
 assert(await peer.val("Math.abs(document.querySelector('#limProiezione .lim-bar').getBoundingClientRect().top-document.getElementById('barra').getBoundingClientRect().bottom)<1"),'barra LIM immediatamente sotto la barra principale visibile');
 await wait("document.getElementById('vista').clientWidth<innerWidth*.6",peer);await c.pausa(600);
 const mis=await peer.val("({w:document.getElementById('vista').clientWidth,h:document.getElementById('vista').clientHeight})");const crop=await c.val("(()=>{const r=document.querySelector('.proiezione-area').getBoundingClientRect();return {w:r.width,h:r.height};})()");assert(Math.abs(crop.w/crop.h-mis.w/mis.h)<.02,'cornice segue porzione della fonte');
 await peer.val("ProiezioneLavagna.editor.inserisci({testo:'Disegnato sulla LIM'})");await wait("ZainoLim.editor.api.getSceneElements().some(e=>e.text?.includes('Disegnato'))");
 await peer.val("ProiezioneLavagna.editor.api.setActiveTool({type:'freedraw'})");
 const pen=await peer.val("(()=>{const r=document.querySelector('#limProiezione .lim-editor').getBoundingClientRect();return {x:r.x+r.width*.4,y:r.y+r.height*.4};})()");
 await peer.invia('Input.dispatchMouseEvent',{type:'mousePressed',x:pen.x,y:pen.y,button:'left',buttons:1,clickCount:1,pointerType:'pen',force:.5});
 for(let n=1;n<=12;n++)await peer.invia('Input.dispatchMouseEvent',{type:'mouseMoved',x:pen.x+n*5,y:pen.y+Math.sin(n/2)*20,button:'left',buttons:1,pointerType:'pen',force:.5});
 await peer.invia('Input.dispatchMouseEvent',{type:'mouseReleased',x:pen.x+60,y:pen.y,button:'left',buttons:0,clickCount:1,pointerType:'pen'});
 await wait("ProiezioneLavagna.editor.api.getSceneElements().some(e=>e.type==='freedraw'&&e.points.length>3)",peer);await wait("ZainoLim.editor.api.getSceneElements().some(e=>e.type==='freedraw')");
 await peer.val("document.getElementById('limDivisore').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}))");await c.pausa(500);assert(await peer.val("document.getElementById('vista').clientWidth<innerWidth*.48"));
 await shot('affiancata',peer);await shot('cornice');
 assert(await peer.val("typeof window.vault==='undefined'"));const refused=await peer.val("proiezione.lim.comando({azione:'apri',corso:'storia',id:'../x'})");assert(!refused.ok);
 await peer.val("document.getElementById('citaLim').click()");await wait("document.getElementById('limCitazione').open",peer);await peer.val("document.getElementById('limInserisciCitazione').click()");await wait("ProiezioneLavagna.editor.api.getSceneElements().some(e=>e.text?.includes('Botanica'))",peer);
 await wait("ProiezioneLavagna.editor.api.getSceneElements().some(e=>e.link?.startsWith('zaino-pdf:'))",peer);
 const immaginiPrima=await peer.val("ProiezioneLavagna.editor.api.getSceneElements().filter(e=>e.type==='image').length");
 await peer.val("document.getElementById('ritagliaLim').click()");
 await peer.invia('Input.dispatchMouseEvent',{type:'mousePressed',x:30,y:90,button:'left',buttons:1,clickCount:1,pointerType:'pen'});
 await peer.invia('Input.dispatchMouseEvent',{type:'mouseMoved',x:270,y:180,button:'left',buttons:1,pointerType:'pen'});
 await peer.invia('Input.dispatchMouseEvent',{type:'mouseReleased',x:270,y:180,button:'left',buttons:0,clickCount:1,pointerType:'pen'});
 await wait(`ProiezioneLavagna.editor.api.getSceneElements().filter(e=>e.type==='image').length>${immaginiPrima}`,peer);await wait(`ZainoLim.editor.api.getSceneElements().filter(e=>e.type==='image').length>${immaginiPrima}`);
 // Conferma anche in proiezione; il rifiuto lascia scena e file invariati.
 await peer.val("window.__confermaOriginale=window.confirm;window.__conferme=[];window.__risposta=false;window.confirm=m=>{window.__conferme.push(m);return window.__risposta;}");
 await peer.val('ProiezioneLavagna.editor.salva()');const salvata=fs.readFileSync(file);
 await clicca('#limProiezione [aria-label="Elimina lavagnata"]',peer);await c.pausa(250);
 assert.equal(await peer.val('window.__conferme.length'),1,'il cestino della proiezione chiede conferma');
 assert.match(await peer.val('window.__conferme[0]'),/Cestino del Mac/);assert.equal(await peer.val('ProiezioneLavagna.editor.doc.studia.id'),id);assert(fs.readFileSync(file).equals(salvata),'annullare conserva il file');
 await peer.val('window.__risposta=true');await clicca('#limProiezione [aria-label="Elimina lavagnata"]',peer);
 await wait("!ProiezioneLavagna.editor.doc",peer);await wait("!ZainoLim.doc&&!document.getElementById('zs-lim')");
 assert.equal(await peer.val('window.__conferme.length'),2,'ogni clic richiede una nuova conferma');
 assert(!fs.existsSync(file));assert(!fs.existsSync(path.join(path.dirname(file),'_cestino')),'non usa più un cestino nel vault');
 assert.equal(await peer.val("!!document.querySelector('.lim-annulla')"),false,'nessun falso Annulla per il Cestino del Mac');
 const scenaSalvata=JSON.parse(salvata);assert(scenaSalvata.elements.some(e=>e.type==='image'));assert(Object.values(scenaSalvata.files).some(f=>f.dataURL.startsWith('data:image/png;base64,')),'ritagli incorporati nel file consegnato al Cestino');
 // Simula il ritorno dal Finder soltanto nel vault sintetico della prova.
 fs.writeFileSync(file,salvata);await peer.val(`ProiezioneLavagna.editor.apri(${JSON.stringify(id)})`);
 await c.val(`ZainoLim.apri(${JSON.stringify(id)})`);await wait("!!document.getElementById('zs-lim')&&!!ZainoLim.editor.api");
 assert(await peer.val("ProiezioneLavagna.editor.api.getSceneElements().some(e=>e.type==='freedraw')&&ProiezioneLavagna.editor.api.getSceneElements().some(e=>e.type==='image')"),'riapertura conserva segni e ritagli');
 await peer.val('window.confirm=window.__confermaOriginale');
 await c.val('BancoPresentazione.chiudiProiezione()');peer.ws.close();peer=null;
 await c.val("cambiaZaino('storia',true)");await c.pausa(350);assert.equal(await c.val("!!document.getElementById('zs-lim')"),false);
 await c.val("cambiaZaino('biologia',true)");await wait("!!document.getElementById('zs-lim')");await c.val(`ZainoLim.apri(${JSON.stringify(id)})`);await wait('!!ZainoLim.editor.api');assert(await c.val("ZainoLim.editor.api.getSceneElements().some(e=>e.text?.includes('Disegnato'))"));
 await c.val("(async()=>{const r=document.querySelector('#limPane .lim-editor').getBoundingClientRect();return (await ZainoLim.editor.immagine({x:r.x,y:r.y,width:r.width,height:r.height},{width:800,height:600,dpr:2})).slice(0,22);})()");await c.val("BancoPresentazione.apriProiezione('lim')");peer=await collega();await wait("document.body.dataset.tipo==='immagine'",peer);assert(await peer.val("document.getElementById('immagine').naturalWidth>=document.getElementById('vista').clientWidth"));await shot('lavagna-proiettata',peer);
 await c.val('BancoPresentazione.chiudiProiezione()');peer.ws.close();peer=null;
 await c.val('ZainoLim.editor.nuova()');await wait('!!ZainoLim.editor.api');assert.equal(await c.val('ZainoLim.doc'),null);await c.clicca('#limPane [aria-label="Salva lavagnata"]');await wait("document.querySelectorAll('#zs-lim .zs-item').length===2");
 await c.clicca('#limPane .lim-scegli');await wait("document.querySelectorAll('#limPane .lim-menu button').length===2");
 await shot('menu-banco');
 await c.clicca(`#limPane .lim-menu [data-lim-id="${id}"]`);
 await wait(`ZainoLim.doc?.studia.id===${JSON.stringify(id)}&&!!ZainoLim.editor.api`);
 assert.equal(await c.val("document.querySelector('#limPane .lim-scegli span').textContent"),titolo,'il nome della lavagnata resta indipendente dalla fonte');
 assert(await c.val("ZainoLim.editor.api.getSceneElements().some(e=>e.type==='freedraw')"),'cambio dal menu conserva il disegno salvato');
 await c.val("window.__confermaOriginale=window.confirm;window.__conferme=[];window.__risposta=false;window.confirm=m=>{window.__conferme.push(m);return window.__risposta;}");
 await c.val('ZainoLim.editor.salva()');const primaCestino=fs.readFileSync(file);
 await c.clicca('#limPane [aria-label="Elimina lavagnata"]');await c.pausa(250);assert.equal(await c.val('window.__conferme.length'),1,'conferma nel banco');assert.equal(await c.val('ZainoLim.doc.studia.id'),id);assert(fs.existsSync(file));
 await c.val('window.__risposta=true');await c.clicca('#limPane [aria-label="Elimina lavagnata"]');await wait("document.querySelectorAll('#zs-lim .zs-item').length===1&&ZainoLim.doc===null");
 assert.equal(await c.val('window.__conferme.length'),2);assert(!fs.existsSync(file));
 fs.writeFileSync(file,primaCestino);await c.val(`ZainoLim.apri(${JSON.stringify(id)})`);await wait("document.querySelectorAll('#zs-lim .zs-item').length===2");
 await c.val("document.querySelector('#zs-lim [aria-label=\"Modifica elenco LIM\"]').click();document.querySelector('[data-sezione=appunti] [data-znav=organizza]').click()");
 await wait("!!document.querySelector('[data-sezione=appunti] .zs-item input')&&!!document.querySelector('#zs-lim .zs-item input')");
 for(const tema of ['chiaro','scuro']){
  await c.val(`document.documentElement.dataset.theme=${JSON.stringify(tema)}`);
  assert(await c.val(`(()=>{const a=document.querySelector('[data-sezione=appunti] .zs-item>button'),b=document.querySelector('#zs-lim .zs-item>button');return ['fontSize','fontFamily','lineHeight','paddingLeft','paddingTop','paddingBottom','borderLeftWidth'].every(k=>getComputedStyle(a)[k]===getComputedStyle(b)[k]);})()`),'stessi caratteri, spazi e bordi delle altre voci');
  assert(await c.val(`(()=>{const a=document.querySelector('[data-sezione=appunti] .zs-seleziona'),b=document.querySelector('#zs-lim .zs-seleziona');return ['width','height','accentColor'].every(k=>getComputedStyle(a)[k]===getComputedStyle(b)[k]);})()`),'checkbox della sidebar condivisi');
  await shot('sidebar-'+tema);
 }
 await c.val("document.documentElement.dataset.theme='chiaro';document.querySelector('[data-sezione=appunti] [data-znav=organizza]').click()");
 await c.val(`document.querySelector('#zs-lim [data-lim-focus="rename:${id}"]').click()`);await wait("document.getElementById('uiModal').hasAttribute('open')");
 await c.val("document.getElementById('umInput').value='Lezione di scienze';document.getElementById('umOk').click()");await wait("document.querySelector('#limPane .lim-scegli span').textContent==='Lezione di scienze'");
 const primaMultipla=fs.readdirSync(path.dirname(file)).filter(n=>n.endsWith('.excalidraw')).map(n=>[n,fs.readFileSync(path.join(path.dirname(file),n))]);
 await c.val("window.__risposta=false;document.querySelector('#zs-lim [aria-label=\"Seleziona tutte le lavagnate\"]').click();document.querySelector('#zs-lim [aria-label=\"Elimina selezionate\"]').click()");await c.pausa(250);
 assert.equal(await c.val('window.__conferme.length'),3);assert.match(await c.val('window.__conferme[2]'),/2 lavagnate/);
 assert.equal(await c.val("document.querySelectorAll('#zs-lim .zs-item input:checked').length"),2,'annullare conserva anche la selezione');assert(primaMultipla.every(([n])=>fs.existsSync(path.join(path.dirname(file),n))));
 await c.val("window.__risposta=true;document.querySelector('#zs-lim [aria-label=\"Elimina selezionate\"]').click()");await wait("!document.getElementById('zs-lim')");
 assert.equal(await c.val('window.__conferme.length'),4);assert(primaMultipla.every(([n])=>!fs.existsSync(path.join(path.dirname(file),n))));assert(!fs.existsSync(path.join(path.dirname(file),'_cestino')));
 for(const [n,dati] of primaMultipla)fs.writeFileSync(path.join(path.dirname(file),n),dati);
 await c.val(`ZainoLim.apri(${JSON.stringify(id)})`);await wait("document.querySelectorAll('#zs-lim .zs-item').length===2");await c.val('window.confirm=window.__confermaOriginale');
 await c.val("ZainoLim.editor.nuova()");await wait('!!ZainoLim.editor.api');
 await c.val("ZainoLim.editor.api.updateScene({elements:LimEditor.converti([{type:'text',x:50,y:50,text:'Da conservare al cambio zaino',fontSize:24}])})");await c.pausa(100);await c.val("cambiaZaino('storia',true)");await wait("document.getElementById('zainoNav').dataset.zaino==='storia'");
 const bozze=fs.readdirSync(path.dirname(file)).filter(n=>n.endsWith('.excalidraw')).map(n=>JSON.parse(fs.readFileSync(path.join(path.dirname(file),n))));
 assert(bozze.some(d=>d.studia.numero===3&&d.elements.some(e=>e.text==='Da conservare al cambio zaino')),'cambio zaino non perde il disegno non ancora salvato');
 console.log('✓ LIM: editor, persistenza, fonte/citazione, divisore, sincronizzazione, riapertura e zaini');
})().catch(async e=>{console.error(e);try{await shot('errore');if(peer)await shot('errore-proiezione',peer);}catch(_){}process.exitCode=1;}).finally(async()=>{peer?.ws.close();try{await c.val('if(window.__confermaOriginale)window.confirm=window.__confermaOriginale;BancoPresentazione.chiudiProiezione()');}catch(_){}process.exit(process.exitCode||0);});
