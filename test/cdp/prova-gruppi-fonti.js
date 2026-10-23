'use strict';
// Solo vault sintetico: si provano anche i gesti nativi, non soltanto il riordino in memoria.
const assert=require('assert/strict'), fs=require('fs'), path=require('path'), c=require('./cdp');
const q=JSON.stringify;
let prima, vault, mediaDir, mappeDir, importati=[];
const mappeProva=[];
const base=sezione=>'#zainoNav [data-sezione="'+sezione+'"]';
const stato=sezione=>c.val('ZNAV.gruppi['+q(sezione)+']');
async function aspetta(expr){
  const fine=Date.now()+10000;
  while(Date.now()<fine){ if(await c.val(expr)) return; await c.pausa(80); }
  throw new Error('Attesa scaduta: '+expr);
}
async function stabile(){ await aspetta('!ZNAV.carico && !ZNAV.salva'); await c.pausa(120); }
async function click(sel){
  await stabile(); await c.val(`document.querySelector(${q(sel)}).scrollIntoView({block:'nearest'})`);
  await c.pausa(80); await c.clicca(sel); await c.pausa(80);
}
async function sfiora(sel){
  await c.val(`document.querySelector(${q(sel)}).scrollIntoView({block:'nearest'})`);
  const p=await c.val(`(()=>{const r=document.querySelector(${q(sel)}).getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
  await c.invia('Input.dispatchMouseEvent',{type:'mouseMoved',...p});await c.pausa(180);
}
async function tasto(key,code,vk){
  await c.invia('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:vk,...(key==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})});
  await c.invia('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:vk});
}
async function nome(testo){
  await aspetta(`document.getElementById('uiModal').hasAttribute('open')`);
  await c.val(`document.getElementById('umInput').value=${q(testo)}`);await c.clicca('#umOk');await stabile();
}
async function modifica(sezione){if(!await c.val('ZNAV.organizza['+q(sezione)+']'))await click(base(sezione)+' [data-znav="organizza"]');}
async function crea(sezione,n){await modifica(sezione);await click(base(sezione)+' [data-znav="crea"]');await nome(n);return (await stato(sezione)).gruppi.at(-1).id;}
const item=(sezione,file)=>base(sezione)+' .zs-item[data-file='+q(file)+']';
const gruppo=(sezione,id)=>base(sezione)+' .zs-gruppo[data-gruppo='+q(id)+']';
async function assegna(sezione,file,id){
  await trascina(item(sezione,file),id?gruppo(sezione,id)+' .zs-gruppo-testa':base(sezione)+' .zs-liberi');
}
async function altreInvariate(sezione, prima, azione){
  const dopo=await c.val('ZNAV.gruppi');
  for(const altra of Object.keys(prima).filter(s=>s!==sezione)){
    assert.deepEqual(dopo[altra],prima[altra],azione+' in '+sezione+' non modifica '+altra);
    assert.deepEqual(await c.val(`Array.from(document.querySelectorAll(${q(base(altra)+' .zs-nome')}),e=>e.textContent)`),
      prima[altra].gruppi.map(g=>g.nome),'anche i gruppi visibili in '+altra+' restano invariati');
  }
}
async function trascina(da,a,dopo=true){
  await stabile();
  await c.val(`(()=>{window.__znavDrag=[];if(!window.__znavDragOsserva){window.__znavDragOsserva=true;['dragstart','dragover','drop','dragend'].forEach(t=>document.addEventListener(t,e=>window.__znavDrag.push({tipo:t,x:e.clientX,y:e.clientY,target:e.target.outerHTML?.slice(0,180),origine:ZNAV.trascinamento}),true));}})()`);
  await c.val(`document.querySelector(${q(da)}).scrollIntoView({block:'center'})`);await c.pausa(120);
  const punti=await c.val(`(()=>{const a=document.querySelector(${q(da)}).getBoundingClientRect(),b=document.querySelector(${q(a)}).getBoundingClientRect();
    return {x:Math.round(a.left+a.width*.35),y:Math.round(a.top+a.height/2),dx:Math.round(b.left+b.width*.35),dy:Math.round(b.top+b.height*${dopo?.85:.15})};})()`);
  assert(punti.dy>0 && punti.dy<await c.val('innerHeight'),'bersaglio visibile per il gesto nativo');
  await c.invia('Input.dispatchMouseEvent',{type:'mouseMoved',x:punti.x,y:punti.y});
  await c.invia('Input.dispatchMouseEvent',{type:'mousePressed',x:punti.x,y:punti.y,button:'left',buttons:1,clickCount:1});
  for(let i=1;i<=8;i++){
    await c.invia('Input.dispatchMouseEvent',{type:'mouseMoved',x:Math.round(punti.x+(punti.dx-punti.x)*i/8),y:Math.round(punti.y+(punti.dy-punti.y)*i/8),button:'left',buttons:1});
    await c.pausa(45);
    if(i===4){
      assert(await c.val('!!ZNAV.trascinamento'),'il gesto deve essere iniziato');
      await c.val('zainoNavAggiorna()');
      assert(await c.val('!!ZNAV.trascinamento'),'un aggiornamento della sidebar non deve interrompere il gesto');
    }
  }
  // Entrare in un nuovo elemento produce dragenter; un movimento sul bersaglio produce dragover.
  await c.pausa(120);
  await c.invia('Input.dispatchMouseEvent',{type:'mouseMoved',x:punti.dx+1,y:punti.dy,button:'left',buttons:1});
  await c.pausa(120);
  await c.invia('Input.dispatchMouseEvent',{type:'mouseReleased',x:punti.dx,y:punti.dy,button:'left',buttons:0,clickCount:1});
  await c.pausa(180);await stabile();
  const eventi=await c.val('window.__znavDrag');
  assert(eventi.some(e=>e.tipo==='drop'),'Il mouse deve rilasciare sul bersaglio: '+JSON.stringify({da,a,punti,eventi}));
}
async function pulisci(){
  if(!prima)return;
  await c.val('closePops();znavTrascinaFine()');
  // I gruppi ora spostano file reali: si ripristinano i percorsi prima del registro.
  const F=require('../../lib/fonti'), A=require('../../lib/gruppi-fonti'), G=require('../../App/assets/fonti/gruppi');
  let s=A.leggi(vault,'biologia').stato;
  if(s){for(const g of s.gruppi)s=G.elimina(s,g.id);assert.equal(A.salva(vault,'biologia',s).error,'');}
  for(const f of importati){fs.rmSync(F.percorso(vault,'biologia',f),{force:true});fs.rmSync(F.percorsoIndice(vault,'biologia',f),{force:true});}
  for(const [file,testo] of Object.entries(prima.registri)){
    if(testo===null)fs.rmSync(file,{force:true});else fs.writeFileSync(file,testo);
  }
  for(const f of ['91 Media prova.wav','92 Media prova.wav'])fs.rmSync(path.join(mediaDir,f),{force:true});
  for(const f of mappeProva)fs.rmSync(path.join(mappeDir,f),{force:true});
  await c.val(`(async()=>{document.documentElement.dataset.theme=${q(prima.tema)}; ZNAV.organizza={}; await zainoNavAggiorna(); document.getElementById('sidebar').scrollTop=0;})()`);
}
(async()=>{
  await c.collega();
  // I gesti CDP restano reali anche se un'altra app passa in primo piano durante la prova.
  // Senza fuoco emulato, il rientro richiama notesReload tra pressione e rilascio del mouse.
  const fuoco=await c.invia('Emulation.setFocusEmulationEnabled',{enabled:true});assert(!fuoco.error);
  await c.partiPulito();await aspetta(`zainoAttivo()==='biologia' && ZNAV.gruppi.fonti && !ZNAV.carico`);
  vault=await c.val('window.vault.path');assert(vault.includes('studia-zaino-prova-'));
  const radice=path.join(vault,'Zaini/biologia');
  const registri=[path.join(radice,'MATERIALI/_gruppi.json'),path.join(radice,'APPUNTI/_gruppi.json'),path.join(radice,'MAPPE/_gruppi.json')];
  prima={tema:await c.val('document.documentElement.dataset.theme'),registri:Object.fromEntries(registri.map(f=>[f,fs.existsSync(f)?fs.readFileSync(f,'utf8'):null]))};
  // Il registro v2 lasciato dalla vecchia migrazione non deve mostrare copie vuote in Media.
  const primaFonti=await stato('fonti'), g={id:'ereditato',nome:'Solo Fonti',chiuso:true,files:[primaFonti.liberi[0]]};
  fs.writeFileSync(registri[0],JSON.stringify({versione:2,
    fonti:{versione:1,gruppi:[g],liberi:primaFonti.liberi.slice(1)},
    media:{versione:1,gruppi:[{...g,files:[]}],liberi:[]}}));
  await c.val('zainoNavAggiorna()');await stabile();
  assert.equal(await c.val(`document.querySelectorAll(${q(base('fonti')+' .zs-gruppo')}).length`),1);
  assert.equal(await c.val(`document.querySelectorAll(${q(base('media')+' .zs-gruppo')}).length`),0,'nessun gruppo Fonti duplicato in Media');
  // Si torna alla base per i gesti indipendenti nelle quattro sezioni.
  if(prima.registri[registri[0]]===null)fs.rmSync(registri[0]);else fs.writeFileSync(registri[0],prima.registri[registri[0]]);
  mediaDir=path.join(radice,'MATERIALI/Audio');fs.mkdirSync(mediaDir,{recursive:true});
  // Due WAV silenziosi, validi anche se un click involontario aprisse il player.
  const wav=Buffer.alloc(16044);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(16000,40);
  for(const f of ['91 Media prova.wav','92 Media prova.wav'])fs.writeFileSync(path.join(mediaDir,f),wav);
  mappeDir=path.join(radice,'MAPPE');
  for(const titolo of ['Prima mappa','Seconda mappa']){
    const r=require('../../lib/mappe').salva(vault,'biologia',null,{titolo,nodi:[],archi:[]});assert(!r.error);mappeProva.push(r.file);
  }
  await c.val('zainoNavAggiorna()');await stabile();
  try{
    assert.equal(await c.val(`document.querySelectorAll('#zainoNav .zs-seleziona, #zainoNav [data-znav="crea"]').length`),0,'spunte e + assenti fuori dalla modifica');
    assert.equal(await c.val(`document.querySelectorAll('#zainoNav [data-znav="importa"]').length`),0,'le cartelle entrano con il drop');
    await modifica('fonti');
    const piu=base('fonti')+' [data-znav="crea"]';
    await sfiora(piu);
    assert(await c.val(`(()=>{const b=document.querySelector(${q(piu)}),tip=document.getElementById(b.getAttribute('aria-describedby'));return tip && !tip.hidden && tip.getAttribute('role')==='tooltip' && tip.textContent.includes('gruppo vuoto') && !b.hasAttribute('title');})()`),'il + spiega la creazione del gruppo con un popup visibile');
    await tasto('Escape','Escape',27);assert.equal(await c.val(`document.getElementById('znavAiuto').hidden`),true);
    await c.val(`document.querySelector(${q(piu)}).focus()`);
    assert.equal(await c.val(`document.getElementById('znavAiuto').hidden`),false,'popup disponibile anche da tastiera');
    for(const tema of ['chiaro','scuro']){
      await c.val(`document.documentElement.dataset.theme=${q(tema)}`);
      for(const sel of [piu,base('fonti')+' [data-znav="organizza"]',base('fonti')+' [data-znav="ordina"]',base('fonti')+' .zs-collapse','.blocco:not([hidden]) .bhead .tendina']){
        await sfiora(sel);
        assert.deepEqual(await c.val(`(()=>{const s=getComputedStyle(document.querySelector(${q(sel)}));return [s.backgroundBlendMode,s.backgroundImage.includes('128, 128, 128'),s.mixBlendMode];})()`),['multiply',true,'normal'],'il solo sfondo si moltiplica in '+tema+' su '+sel);
      }
      await sfiora(piu);
      const r=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/studia-zaino-hover-'+tema+'.png',Buffer.from(r.result.data,'base64'));
    }
    await c.val(`document.documentElement.dataset.theme=${q(prima.tema)}`);
    await click(base('fonti')+' [data-znav="organizza"]');
    assert.equal(await c.val(`document.getElementById('znavAiuto').hidden`),true);
    assert.equal(await c.val(`getComputedStyle(document.getElementById('sidebarTitolo')).display`),'none');
    for(const sezione of ['fonti','appunti','media','mappe']){
      const toggle=base(sezione)+' .zs-collapse';
      await click(toggle);assert.equal(await c.val(`document.getElementById('zs-corpo-${sezione}').hidden`),true);
      await c.val('zainoNavAggiorna()');await stabile();assert.equal(await c.val(`document.querySelector(${q(toggle)}).getAttribute('aria-expanded')`),'false');
      await click(toggle);assert.equal(await c.val(`document.getElementById('zs-corpo-${sezione}').hidden`),false);
      const gap=await c.val(`(()=>{const s=document.querySelector(${q(base(sezione))}),head=s.querySelector('.zs-tit'),first=s.querySelector('.zs-corpo .zs-media-tipo, .zs-corpo .zs-item');return first.getBoundingClientRect().top-head.getBoundingClientRect().bottom;})()`);assert(Math.abs(gap)<1,'Nessuno spazio tra titolo e primo elemento: '+sezione+' '+gap);
    }
    for(const sezione of ['fonti','appunti','media','mappe']){
      const altre=await c.val('ZNAV.gruppi');
      const files=(await stato(sezione)).liberi;assert.equal(files.length,2);
      const altezza=await c.val(`document.querySelector(${q(item(sezione,files[0]))}).getBoundingClientRect().height`);
      const uno=await crea(sezione,'Lezioni <base>'),due=await crea(sezione,'Ripasso');
      await altreInvariate(sezione,altre,'Creare gruppi');
      assert.equal(await c.val(`document.querySelector(${q(item(sezione,files[0]))}).getBoundingClientRect().height`),altezza,'organizzare non aumenta l’altezza di una riga semplice');
      assert(await c.val(`(()=>{
        const e=document.querySelector(${q(item(sezione,files[0]))}),b=e.querySelector('.zs-seleziona'),s=getComputedStyle(b);
        const tit=getComputedStyle(document.querySelector(${q(base(sezione)+' .zs-tit')})),g=getComputedStyle(document.querySelector(${q(gruppo(sezione,uno)+' [data-znav="toggle"]')}));
        return b.type==='checkbox' && b.getBoundingClientRect().height<=e.getBoundingClientRect().height && tit.fontSize==='12px' && g.fontSize==='12px' && g.fontWeight==='700';
      })()`),'checkbox integrato nella riga e gerarchia dei caratteri');
      assert.equal(await c.val(`document.querySelector(${q(gruppo(sezione,uno)+' .zs-nome')}).textContent`),'Lezioni <base>');
      assert.equal(await c.val(`document.querySelectorAll(${q(base(sezione)+' select, '+base(sezione)+' [data-znav="file-su"], '+base(sezione)+' [data-znav="gruppo-su"]')}).length`),0);
      await assegna(sezione,files[0],uno);await assegna(sezione,files[1],uno);
      if(sezione==='fonti'){
        const pdf=path.join(vault,'Zaini/biologia/MATERIALI/PDF');
        for(const f of files){assert(fs.existsSync(path.join(pdf,'Gruppi','Lezioni -base-',f)));assert(!fs.existsSync(path.join(pdf,f)));}
      }
      console.log('  ok  '+sezione+': gruppi e assegnazione con trascinamento');
      await trascina(item(sezione,files[0]),item(sezione,files[1]));
      assert.deepEqual((await stato(sezione)).gruppi[0].files,[files[1],files[0]],'riordino con mouse vero');
      console.log('  ok  '+sezione+': trascinamento nativo delle voci');
      await c.val(`(()=>{window.__znavTasti=[];if(!window.__znavOsservaTasti){window.__znavOsservaTasti=true;document.addEventListener('keydown',e=>window.__znavTasti.push({key:e.key,alt:e.altKey,target:e.target.outerHTML?.slice(0,400),carico:ZNAV.carico,salva:ZNAV.salva}),true);}document.querySelector(${q(item(sezione,files[0])+' .zs-seleziona')}).focus();})()`);
      for(const [key,code,vk,atteso] of [['ArrowUp','ArrowUp',38,files],['ArrowDown','ArrowDown',40,[files[1],files[0]]]]){
        await c.invia('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:vk,modifiers:1});
        await c.invia('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:vk,modifiers:1});
        await stabile();assert.deepEqual((await stato(sezione)).gruppi[0].files,atteso,'riordino alternativo da tastiera: '+JSON.stringify(await c.val('window.__znavTasti')));
      }

      await trascina(gruppo(sezione,due)+' .zs-gruppo-testa',gruppo(sezione,uno)+' .zs-gruppo-testa',false);
      assert.deepEqual((await stato(sezione)).gruppi.map(g=>g.id),[due,uno]);
      await click(gruppo(sezione,due)+' [data-znav="toggle"]');
      await trascina(item(sezione,files[0]),gruppo(sezione,due)+' .zs-gruppo-testa');
      assert.deepEqual((await stato(sezione)).gruppi[0].files,[files[0]]);
      assert.equal((await stato(sezione)).gruppi[0].chiuso,false,'caduta nel gruppo chiuso rende visibile il risultato');
      await click(gruppo(sezione,due)+' [data-znav="rinomina"]');await nome('Da ripassare');
      if(sezione==='fonti'){
        const pdf=path.join(vault,'Zaini/biologia/MATERIALI/PDF');
        assert(fs.existsSync(path.join(pdf,'Gruppi','Da ripassare',files[0])));
        assert(!fs.existsSync(path.join(pdf,'Gruppi','Ripasso')));
      }
      await altreInvariate(sezione,altre,'Rinominare un gruppo');
      await assegna(sezione,files[0],'');
      assert.deepEqual((await stato(sezione)).liberi,[files[0]],'trascinamento fuori dal gruppo');
      await click(item(sezione,files[0])+' .zs-seleziona');
      await tasto(' ','Space',32);
      assert.equal(await c.val(`document.querySelector(${q(item(sezione,files[0])+' .zs-seleziona')}).checked`),false,'checkbox usabile da tastiera');
      await click(base(sezione)+' .zs-collapse');
      assert.equal(await c.val(`document.getElementById('zs-corpo-${sezione}').hidden`),true);await click(base(sezione)+' .zs-collapse');
      await click(gruppo(sezione,uno)+' [data-znav="toggle"]');
      assert.equal(await c.val(`document.querySelector(${q(item(sezione,files[1]))}).getBoundingClientRect().height`),0);
      await click(gruppo(sezione,uno)+' [data-znav="elimina"]');await stabile();
      assert.equal((await stato(sezione)).gruppi.some(g=>g.id===uno),false);
      assert.deepEqual((await stato(sezione)).liberi.slice().sort(),files.slice().sort(),'sciogliere il gruppo conserva le voci');
      assert.equal(await c.val(`document.querySelector(${q(item(sezione,files[1]))}).getBoundingClientRect().height>0`),true);
      await altreInvariate(sezione,altre,'Eliminare un gruppo');
      console.log('  ok  '+sezione+': gruppi trascinabili, selezione e creazione/rinomina/eliminazione indipendenti dalle altre tre sezioni');
    }
    const salvato=await c.val('ZNAV.gruppi');
    assert.deepEqual(JSON.parse(fs.readFileSync(registri[0],'utf8')),{versione:3,fonti:salvato.fonti,media:salvato.media});
    assert.deepEqual(JSON.parse(fs.readFileSync(registri[1],'utf8')),salvato.appunti);
    assert.deepEqual(JSON.parse(fs.readFileSync(registri[2],'utf8')),salvato.mappe);
    await c.val(`cambiaZaino('storia',true)`);await aspetta(`ZNAV.id==='storia' && !ZNAV.carico`);
    for(const s of ['fonti','appunti','media','mappe'])assert.equal((await stato(s)).gruppi.length,0);
    await c.val(`cambiaZaino('biologia',true)`);await aspetta(`ZNAV.id==='biologia' && !ZNAV.carico`);
    assert.deepEqual(await c.val('ZNAV.gruppi'),salvato);
    await c.val('location.reload()');await c.pausa(1000);await aspetta(`typeof ZNAV!=='undefined' && ZNAV.id==='biologia' && !ZNAV.carico`);
    assert.deepEqual(await c.val('ZNAV.gruppi'),salvato);
    // Un registro guasto resta intatto: i file sono visibili, i comandi di modifica spenti.
    const buono=fs.readFileSync(registri[1],'utf8');fs.writeFileSync(registri[1],'{rotto');await c.val('zainoNavAggiorna()');await stabile();
    assert.equal(await c.val(`document.querySelectorAll(${q(base('appunti')+' .zn-appunto')}).length`),2);
    assert.equal(await c.val(`document.querySelector(${q(base('appunti')+' [data-znav="organizza"]')}).disabled`),true);
    assert.match(await c.val(`document.querySelector(${q(base('appunti')+' .zs-no')}).textContent`),/non leggibile/);
    fs.writeFileSync(registri[1],buono);await c.val('zainoNavAggiorna()');await stabile();
    await modifica('appunti');
    const file=(await stato('appunti')).liberi[0];await click(item('appunti',file)+' .zs-seleziona');
    for(const tema of ['chiaro','scuro']){
      await c.val(`document.documentElement.dataset.theme=${q(tema)}`);await c.pausa(100);
      assert(await c.val(`(()=>{
        const e=document.createElement('div');e.className='sr-lesson';document.getElementById('searchRes').appendChild(e);
        const sfondo=getComputedStyle(e).backgroundColor;e.remove();
        return Array.from(document.querySelectorAll('#zainoNav .zs-tit')).every(t=>getComputedStyle(t).backgroundColor===sfondo);
      })()`),'le intestazioni condividono lo sfondo della ricerca in entrambi i temi');
      const r=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/studia-zaino-gruppi-'+tema+'.png',Buffer.from(r.result.data,'base64'));
      assert(await c.val(`(()=>{const e=document.getElementById('zainoNav');return e.scrollWidth<=e.clientWidth+1;})()`));

    }
    await click(item('appunti',file)+' .zs-seleziona');
    await c.val('closePops()');
    const lavoro=path.dirname(vault), sorgente=path.join(lavoro,'Cartella PDF di prova');
    fs.mkdirSync(path.join(sorgente,'Sottocartella'),{recursive:true});
    const F=require('../../lib/fonti'), {PDFDocument,StandardFonts}=require('pdf-lib');
    const doc=await PDFDocument.create(), font=await doc.embedFont(StandardFonts.Helvetica);
    for(let n=1;n<=3;n++){
      const pagina=doc.addPage();
      for(let r=0;r<6;r++)pagina.drawText('Storia e geografia: materiali di studio per la pagina '+n,{x:40,y:700-r*25,font,size:14});
    }
    const bytes=await doc.save();
    fs.writeFileSync(path.join(sorgente,'01.1 CT Alunno.pdf'),bytes);
    fs.writeFileSync(path.join(sorgente,'Sottocartella','02.2 Piano_di studio.pdf'),bytes);
    if(await c.val('ZNAV.organizza.fonti'))await click(base('fonti')+' [data-znav="organizza"]');
    const appuntiPrima=await c.val('noteStati().map(s=>s.mde && s.mde.value())');
    const punto=await c.val(`(()=>{const e=Array.from(document.querySelectorAll('.CodeMirror-scroll')).find(e=>e.getBoundingClientRect().width>0),r=e.getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+Math.min(r.height/2,80))};})()`);
    assert(await c.val(`!!document.elementFromPoint(${punto.x},${punto.y}).closest('.CodeMirror')`),'il drop arriva sopra l’editor degli Appunti');
    const data={items:[],files:[sorgente],dragOperationsMask:1};
    for(const type of ['dragEnter','dragOver','drop']){
      const r=await c.invia('Input.dispatchDragEvent',{type,...punto,data});assert(!r.error,JSON.stringify(r.error));
      if(type==='dragOver')assert.equal(await c.val('document.documentElement.dataset.drop'),'pdf');
    }
    await aspetta(`!FONTI.inCorso && ZNAV.gruppi.fonti.gruppi.some(g=>g.nome==='Cartella PDF di prova' && g.files.length===2)`);
    assert.deepEqual(await c.val('noteStati().map(s=>s.mde && s.mde.value())'),appuntiPrima,'la cartella non viene letta come testo nell’appunto aperto');
    const nuovo=(await stato('fonti')).gruppi.find(g=>g.nome==='Cartella PDF di prova');importati=nuovo.files;
    assert.equal(await c.val('!!ZNAV.organizza.fonti'),false,'il drop importa anche fuori dalla modifica');
    for(const f of importati){
      assert(fs.existsSync(path.join(vault,'Zaini/biologia/MATERIALI/PDF/Gruppi',nuovo.nome,f)));
      assert(fs.existsSync(F.percorsoIndice(vault,'biologia',f)),'indice costruito da pdf.js per il PDF raggruppato');
      assert(await c.val(`!!document.querySelector(${q(item('fonti',f))})`));
    }
    await aspetta('!!PDFJS.doc');
    const aperto=await c.val('ANTEPRIMA.file');assert(importati.includes(aperto));
    await c.val(`fonte2Apri(${q(importati[1])})`);await aspetta('!!FONTE2.doc && !FONTE2.caricando');
    assert.deepEqual(await c.val(`['fonte','fonte2'].map(id=>document.querySelector('.blocco[data-blocco="'+bancoBloccoDi(id)+'"] .bdoc').textContent)`),importati.map(f=>f.slice(7)));

    if(!await c.val('ZNAV.organizza.fonti'))await click(base('fonti')+' [data-znav="organizza"]');
    await click(gruppo('fonti',nuovo.id)+' [data-znav="rinomina"]');await nome('PDF rinominati');
    await aspetta('!!PDFJS.doc && !!FONTE2.doc && !FONTE2.caricando');
    assert.equal(await c.val('ANTEPRIMA.file'),aperto);
    assert(await c.val(`window.vault.srcUrl(${q(aperto)},'biologia').includes('PDF%20rinominati')`));
    for(const f of importati)assert(fs.existsSync(path.join(vault,'Zaini/biologia/MATERIALI/PDF/Gruppi/PDF rinominati',f)));
    await c.val('location.reload()');await c.pausa(1000);await aspetta(`typeof ZNAV!=='undefined' && ZNAV.id==='biologia' && !ZNAV.carico`);
    assert.equal((await stato('fonti')).gruppi.find(g=>g.id===nuovo.id).nome,'PDF rinominati');
    await c.val(`document.querySelector(${q(item('fonti',aperto)+' .zn-fonte')}).click()`);await aspetta('!!PDFJS.doc');
    assert.equal(await c.val('PDFJS.doc.numPages'),3);
    const immagine=await c.invia('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync('/tmp/studia-zaino-cartelle-pdf.png',Buffer.from(immagine.result.data,'base64'));
    assert.deepEqual(importati,['0003 - 01.1 CT Alunno.pdf','0004 - 02.2 Piano_di studio.pdf']);
    for(const f of importati)assert.equal(await c.val(`document.querySelector(${q(item('fonti',f)+' .zn-fonte')}).textContent`),f.slice(7));
    assert.equal(await c.val(`_pdfNum()['0003']`),importati[0]);
    assert.equal(await c.val(`RimandiSintassi.scriviPdf(numDiFile(${q(importati[0])},_pdfNum()),2)`),'pdf:0003#p=2');
    await click(base('fonti')+' [data-znav="ordina"]');await stabile();
    assert.deepEqual((await stato('fonti')).gruppi.find(g=>g.id===nuovo.id).files,importati);
    await click(base('fonti')+' [data-znav="ordina"]');await stabile();
    assert.deepEqual((await stato('fonti')).gruppi.find(g=>g.id===nuovo.id).files,[...importati].reverse());
    await modifica('fonti');
    for(const f of importati)await click(item('fonti',f)+' .zs-seleziona');
    await c.val('zainoNavAggiorna()');await stabile();
    assert.equal(await c.val(`document.querySelectorAll(${q(base('fonti')+' .zs-seleziona:checked')}).length`),2,'la selezione sopravvive al refresh');
    await sfiora(piu);
    assert.match(await c.val(`document.getElementById('znavAiuto').textContent`),/2 voci selezionate/,'il popup descrive la selezione corrente');
    await click(base('fonti')+' [data-znav="organizza"]');
    assert.equal(await c.val(`document.querySelectorAll(${q(base('fonti')+' .zs-seleziona, '+base('fonti')+' [data-znav="crea"]')}).length`),0);
    assert.deepEqual(await c.val('ZNAV.selezione.fonti'),[],'nessuna selezione invisibile alla chiusura della modifica');
    await modifica('fonti');
    for(const f of importati)await click(item('fonti',f)+' .zs-seleziona');
    const multiplo=await crea('fonti','Selezione multipla');
    assert.deepEqual((await stato('fonti')).gruppi.find(g=>g.id===multiplo).files,[...importati].reverse());
    for(const f of importati){
      assert(fs.existsSync(path.join(F.dirPdf(vault,'biologia'),'Gruppi','Selezione multipla',f)));
      await click(item('fonti',f)+' .zs-seleziona');
    }
    await trascina(item('fonti',importati[0]),gruppo('fonti',nuovo.id)+' .zs-gruppo-testa');
    assert.deepEqual((await stato('fonti')).gruppi.find(g=>g.id===nuovo.id).files,[...importati].reverse());
    assert.deepEqual((await stato('fonti')).gruppi.find(g=>g.id===multiplo).files,[]);
    for(const f of importati)assert(fs.existsSync(path.join(F.dirPdf(vault,'biologia'),'Gruppi','PDF rinominati',f)));
    assert.equal(await c.val(`document.querySelectorAll(${q(base('fonti')+' .zs-seleziona:checked')}).length`),0);
    await c.val('closePdf();fonte2Chiudi()');
    console.log('✓ sidebar e cartelle: drop nativo di cartella, gruppi sul disco, due viewer, indici e riapertura');
  }catch(e){console.error('Prima della pulizia:',e);const r=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/studia-sidebar-prima-pulizia.png',Buffer.from(r.result.data,'base64'));throw e;}finally{await pulisci();await c.invia('Emulation.setFocusEmulationEnabled',{enabled:false});}
  process.exit(0);
})().catch(async e=>{console.error(e);try{const r=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/studia-zaino-gruppi-failure.png',Buffer.from(r.result.data,'base64'));}catch(_){}process.exit(1);});
