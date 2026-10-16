'use strict';
// Solo vault sintetico: si provano anche i gesti nativi, non soltanto il riordino in memoria.
const assert=require('assert/strict'), fs=require('fs'), path=require('path'), c=require('./cdp');
const q=JSON.stringify;
let prima, vault, mediaDir;
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
async function tasto(key,code,vk){
  await c.invia('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:vk,...(key==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})});
  await c.invia('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:vk});
}
async function nome(testo){
  await aspetta(`document.getElementById('uiModal').hasAttribute('open')`);
  await c.val(`document.getElementById('umInput').value=${q(testo)}`);await c.clicca('#umOk');await stabile();
}
async function crea(sezione,n){await click(base(sezione)+' [data-znav="crea"]');await nome(n);return (await stato(sezione)).gruppi.at(-1).id;}
const item=(sezione,file)=>base(sezione)+' .zs-item[data-file='+q(file)+']';
const gruppo=(sezione,id)=>base(sezione)+' .zs-gruppo[data-gruppo='+q(id)+']';
async function assegna(sezione,file,id){
  await click(item(sezione,file)+' .zs-assegna');
  await aspetta(`document.querySelector('#znavGruppiPop[open]')`);
  await click('#znavGruppiPop [data-znav-destinazione='+q(id)+']');await stabile();
  assert.equal(await c.val('document.activeElement.dataset.file'),file);
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
  for(const [file,testo] of Object.entries(prima.registri)){
    if(testo===null)fs.rmSync(file,{force:true});else fs.writeFileSync(file,testo);
  }
  for(const f of ['91 Media prova.wav','92 Media prova.wav'])fs.rmSync(path.join(mediaDir,f),{force:true});
  await c.val(`(async()=>{document.documentElement.dataset.theme=${q(prima.tema)}; ZNAV.organizza={}; await zainoNavAggiorna(); document.getElementById('sidebar').scrollTop=0;})()`);
}
(async()=>{
  await c.collega();await c.partiPulito();await aspetta(`zainoAttivo()==='biologia' && ZNAV.gruppi.fonti && !ZNAV.carico`);
  vault=await c.val('window.vault.path');assert(vault.includes('studia-zaino-prova-'));
  const radice=path.join(vault,'Zaini/biologia');
  const registri=[path.join(radice,'MATERIALI/_gruppi.json'),path.join(radice,'APPUNTI/_gruppi.json')];
  prima={tema:await c.val('document.documentElement.dataset.theme'),registri:Object.fromEntries(registri.map(f=>[f,fs.existsSync(f)?fs.readFileSync(f,'utf8'):null]))};
  mediaDir=path.join(radice,'MATERIALI/Audio');fs.mkdirSync(mediaDir,{recursive:true});
  // Due WAV silenziosi, validi anche se un click involontario aprisse il player.
  const wav=Buffer.alloc(16044);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(16000,40);
  for(const f of ['91 Media prova.wav','92 Media prova.wav'])fs.writeFileSync(path.join(mediaDir,f),wav);
  await c.val('zainoNavAggiorna()');await stabile();
  try{
    for(const sezione of ['fonti','appunti','media']){
      const files=(await stato(sezione)).liberi;assert.equal(files.length,2);
      const uno=await crea(sezione,'Lezioni <base>'),due=await crea(sezione,'Ripasso');
      assert.equal(await c.val(`document.querySelector(${q(gruppo(sezione,uno)+' .zs-nome')}).textContent`),'Lezioni <base>');
      assert.equal(await c.val(`document.querySelectorAll(${q(base(sezione)+' select, '+base(sezione)+' [data-znav="file-su"], '+base(sezione)+' [data-znav="gruppo-su"]')}).length`),0);
      await assegna(sezione,files[0],uno);await assegna(sezione,files[1],uno);
      console.log('  ok  '+sezione+': gruppi e assegnazione dal solo chevron');
      await trascina(item(sezione,files[0]),item(sezione,files[1]));
      assert.deepEqual((await stato(sezione)).gruppi[0].files,[files[1],files[0]],'riordino con mouse vero');
      console.log('  ok  '+sezione+': trascinamento nativo delle voci');
      await c.val(`document.querySelector(${q(item(sezione,files[0])+' .zs-assegna')}).focus()`);
      for(const [key,code,vk,atteso] of [['ArrowUp','ArrowUp',38,files],['ArrowDown','ArrowDown',40,[files[1],files[0]]]]){
        await c.invia('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:vk,modifiers:1});
        await c.invia('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:vk,modifiers:1});
        await stabile();assert.deepEqual((await stato(sezione)).gruppi[0].files,atteso,'riordino alternativo da tastiera');
      }

      await trascina(gruppo(sezione,due)+' .zs-gruppo-testa',gruppo(sezione,uno)+' .zs-gruppo-testa',false);
      assert.deepEqual((await stato(sezione)).gruppi.map(g=>g.id),[due,uno]);
      await click(gruppo(sezione,due)+' [data-znav="toggle"]');
      await trascina(item(sezione,files[0]),gruppo(sezione,due)+' .zs-gruppo-testa');
      assert.deepEqual((await stato(sezione)).gruppi[0].files,[files[0]]);
      assert.equal((await stato(sezione)).gruppi[0].chiuso,false,'caduta nel gruppo chiuso rende visibile il risultato');
      await click(gruppo(sezione,due)+' [data-znav="rinomina"]');await nome('Da ripassare');
      await click(item(sezione,files[0])+' .zs-assegna');
      await tasto('Escape','Escape',27);
      assert.equal(await c.val(`document.querySelector('#znavGruppiPop').hasAttribute('open')`),false);
      assert.equal(await c.val('document.activeElement.dataset.file'),files[0]);
      await click(item(sezione,files[0])+' .zs-assegna');await tasto('Home','Home',36);await tasto('Enter','Enter',13);await stabile();
      assert.deepEqual((await stato(sezione)).liberi,[files[0]],'menu usabile da tastiera');
      await click(item(sezione,files[0])+' .zs-assegna');await click(base(sezione)+' .zs-tit');
      assert.equal(await c.val(`document.querySelector('#znavGruppiPop').hasAttribute('open')`),false);
      await click(gruppo(sezione,uno)+' [data-znav="toggle"]');
      assert.equal(await c.val(`document.querySelector(${q(item(sezione,files[1]))}).getBoundingClientRect().height`),0);
      console.log('  ok  '+sezione+': gruppi trascinabili, caduta nei chiusi, menu da tastiera e chiusura');
    }
    const salvato=await c.val('ZNAV.gruppi');
    assert.deepEqual(JSON.parse(fs.readFileSync(registri[0],'utf8')),{versione:2,fonti:salvato.fonti,media:salvato.media});
    assert.deepEqual(JSON.parse(fs.readFileSync(registri[1],'utf8')),salvato.appunti);
    await c.val(`cambiaZaino('storia',true)`);await aspetta(`ZNAV.id==='storia' && !ZNAV.carico`);
    for(const s of ['fonti','appunti','media'])assert.equal((await stato(s)).gruppi.length,0);
    await c.val(`cambiaZaino('biologia',true)`);await aspetta(`ZNAV.id==='biologia' && !ZNAV.carico`);
    assert.deepEqual(await c.val('ZNAV.gruppi'),salvato);
    await c.val('location.reload()');await c.pausa(1000);await aspetta(`typeof ZNAV!=='undefined' && ZNAV.id==='biologia' && !ZNAV.carico`);
    assert.deepEqual(await c.val('ZNAV.gruppi'),salvato);
    // Un registro guasto resta intatto: i file sono visibili, i comandi di modifica spenti.
    const buono=fs.readFileSync(registri[1],'utf8');fs.writeFileSync(registri[1],'{rotto');await c.val('zainoNavAggiorna()');await stabile();
    assert.equal(await c.val(`document.querySelectorAll(${q(base('appunti')+' .zn-appunto')}).length`),2);
    assert.equal(await c.val(`document.querySelector(${q(base('appunti')+' [data-znav="crea"]')}).disabled`),true);
    assert.match(await c.val(`document.querySelector(${q(base('appunti')+' .zs-no')}).textContent`),/non leggibile/);
    fs.writeFileSync(registri[1],buono);await c.val('zainoNavAggiorna()');await stabile();
    await click(base('appunti')+' [data-znav="organizza"]');
    const file=(await stato('appunti')).liberi[0];await click(item('appunti',file)+' .zs-assegna');
    for(const tema of ['chiaro','scuro']){
      await c.val(`document.documentElement.dataset.theme=${q(tema)}`);await c.pausa(100);
      const r=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/studia-zaino-gruppi-'+tema+'.png',Buffer.from(r.result.data,'base64'));
      assert(await c.val(`(()=>{const e=document.getElementById('zainoNav');return e.scrollWidth<=e.clientWidth+1;})()`));
      assert(await c.val(`(()=>{const r=document.getElementById('znavGruppiPop').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;})()`));
    }
    console.log('✓ sidebar: tre sezioni, mouse nativo, bubble menu, tastiera, persistenza, migrazione e errori');
  }catch(e){console.error('Prima della pulizia:',e);const r=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/studia-sidebar-prima-pulizia.png',Buffer.from(r.result.data,'base64'));throw e;}finally{await pulisci();}
  process.exit(0);
})().catch(async e=>{console.error(e);try{const r=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/studia-zaino-gruppi-failure.png',Buffer.from(r.result.data,'base64'));}catch(_){}process.exit(1);});
