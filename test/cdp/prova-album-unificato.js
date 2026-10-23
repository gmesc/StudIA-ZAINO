'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),c=require('./cdp');
const q=JSON.stringify;
async function aspetta(expr){const fine=Date.now()+12000;while(Date.now()<fine){if(await c.val(expr))return;await c.pausa(80);}throw Error('Attesa: '+expr);}
async function clicca(sel){await c.val(`document.querySelector(${q(sel)}).scrollIntoView({block:'nearest'})`);await c.clicca(sel);}
async function esc(){await c.invia('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await c.invia('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});}
(async()=>{
 await c.collega();await c.invia('Emulation.setFocusEmulationEnabled',{enabled:true});await aspetta(`typeof AlbumSpazio==='object' && zainoAttivo()==='biologia'`);await c.partiPulito();
 const vault=await c.val('window.vault.path');assert(vault.includes('studia-zaino-prova-'));
 const radice=path.join(vault,'Zaini/biologia'),audio=path.join(radice,'MATERIALI/Audio/0097 - Audio catalogo.wav'),video=path.join(radice,'MATERIALI/Video/0098 - Video catalogo.mp4');
 const prima=await c.val(`({banco:JSON.parse(JSON.stringify(bancoStato())),attivo:BANCO.attivo,nota:NOTES.cur?.file||'',preview:!!NOTES.mde?.isPreviewActive(),locale:Object.assign({},localStorage)})`);
 const backup=new Map(['ALBUM','APPUNTI','MATERIALI/_gruppi.json'].map(f=>{const p=path.join(radice,f);return[p,fs.existsSync(p)?fs.statSync(p).isDirectory()?new Map(fs.readdirSync(p).map(n=>[n,fs.readFileSync(path.join(p,n))])):fs.readFileSync(p):null];}));
 try{
  assert.equal(await c.val(`bancoStrumentiOfferti().album.nome`),'Album');
  await c.val(`localStorage.setItem(bancoChiave(),JSON.stringify({forma:'uno',blocchi:{A:'player',B:'album',C:'appunti',D:'foto'}}));bancoRicarica()`);
  assert.equal(await c.val(`bancoStrumentoIn('A')`),'album');
  assert.equal(await c.val(`Object.values(bancoStato().blocchi).filter(v=>v==='album').length`),1);
  assert.equal(await c.val(`!!bancoStrumentiOfferti().foto || !!bancoStrumentiOfferti().player`),false);
  fs.mkdirSync(path.dirname(audio),{recursive:true});fs.writeFileSync(audio,c.wavDiProva(30));
  assert(c.mediaConFfmpeg(video),'ffmpeg richiesto per la prova del video');
  const ids=await c.val(`(()=>{
    const canvas=document.createElement('canvas');canvas.width=120;canvas.height=90;const ctx=canvas.getContext('2d');
    return ['foto','ritaglio'].map((origine,i)=>{ctx.fillStyle=i?'#10a594':'#3b84c7';ctx.fillRect(0,0,120,90);
      const r=window.vault.album.salva('biologia',{origine,materiale:i?'01 Botanica.pdf':'Immagine catalogo.png',didascalia:i?'Ritaglio catalogo':'Immagine catalogo',pagina:1,rect:{x:0,y:0,w:120,h:90},dati:canvas.toDataURL('image/png')});if(r.error)throw Error(r.error);return r.voce.id;});
  })()`);
  await c.val(`(async()=>{await zainoNavAggiorna();BANCO.stato=BancoForme.normalizzaStato({forma:'due-col',blocchi:{A:'album',C:'appunti'}});bancoDisegna();await AlbumSpazio.aggiorna();})()`);
  // La forma usa quella esistente del banco, senza assumere nomi storici delle forme.
  await c.val(`bancoForma('uno'); bancoAssegna('A','album'); AlbumSpazio.scegli('immagini')`);
  assert.deepEqual(await c.val(`Array.from(document.querySelectorAll('#zainoNav > .zs-raccolta')).map(e=>e.dataset.sezione)`),['appunti','mappe','fonti','media']);
  assert.deepEqual(await c.val(`Array.from(document.querySelectorAll('[data-media-tipo]')).map(e=>e.dataset.mediaTipo)`),['immagini','video','audio']);
  assert(await c.val(`!!document.querySelector('.zn-immagine[data-quale="album:${ids[0]}"]')`));
  await clicca(`#fotoLista [data-id="${ids[0]}"]`);
  await aspetta(`FOTOV.aperta===${q(ids[0])} && document.getElementById('fotoImg').naturalWidth>0`);
  assert(await c.val(`document.getElementById('fotoVista').getBoundingClientRect().height>100 && !document.getElementById('fotoPane').hidden`));
  await c.val(`void askText('Nome di prova','').then(v=>window.__albumRisposta=v)`);
  await aspetta(`document.activeElement.id==='umInput'`);await esc();assert.equal(await c.val(`document.getElementById('uiModal').hasAttribute('open')`),false);
  assert.equal(await c.val('FOTOV.aperta'),ids[0],'Esc chiude prima il dialogo, conservando l’anteprima');
  await esc();assert.equal(await c.val('FOTOV.aperta'),'');assert.equal(await c.val(`document.getElementById('fotoLista').hidden`),false);
  await clicca('[data-album-tab="ritagli"]');await clicca(`#albLista [data-id="${ids[1]}"]`);await clicca('#fotoIndietro');
  assert.equal(await c.val(`document.getElementById('albumPane').hidden`),false);
  await clicca('[data-album-tab="audio"]');await clicca('[data-album-media="0097 - Audio catalogo.wav"]');
  await aspetta(`PLAYER.pronto && playerSecondo()<5`);assert.equal(await c.val(`document.getElementById('playerPane').hidden`),false);
  await esc();assert.equal(await c.val('PLAYER.file'),'');assert.equal(await c.val(`document.getElementById('albumMediaLista').hidden`),false);
  await clicca('[data-album-tab="video"]');await clicca('[data-album-media="0098 - Video catalogo.mp4"]');await aspetta('PLAYER.pronto');await clicca('#plClose');
  assert.equal(await c.val('PLAYER.file'),'');
  // Il rimando è dentro un appunto vero, renderizzato dalla stessa pipeline dell'editor.
  await c.val(`bancoMostra('appunti');const nota=notesApi().save(corsoAttivo(),null,{title:'Minutaggio album'},'[0:12](video:0097#t=12)');notesReload();noteOpen(nota.file,NOTES);if(!NOTES.mde.isPreviewActive())NOTES.mde.togglePreview()`);
  await aspetta(`!!document.querySelector('#notePane .editor-preview-active a.vlink')`);await clicca('#notePane .editor-preview-active a.vlink');
  await aspetta('PLAYER.pronto && playerSecondo()>=12 && playerSecondo()<16');
  assert.equal(await c.val(`bancoStrumentoIn(bancoBloccoDi('player'))`),'album');await clicca('#plClose');
  await clicca('#albumOrdine');assert.equal(await c.val(`document.getElementById('albumOrdineMenu').hasAttribute('open')`),true);
  await clicca('[data-album-ordine="data"]');assert.equal(await c.val(`document.getElementById('albumOrdina').textContent`),'31–1');
  await clicca('#albumOrdina');assert.equal(await c.val(`document.getElementById('albumOrdina').textContent`),'1–31');
  assert.equal(await c.val(`document.getElementById('albumOrdineMenu').hasAttribute('open')`),false);
  await c.val(`const slider=document.getElementById('albumDimensione');slider.value='240';slider.dispatchEvent(new Event('input',{bubbles:true}))`);
  assert.equal(await c.val(`getComputedStyle(document.querySelector('#albumMediaLista .albumAudio')).height`),'168px');
  await clicca('#albumCerca');await c.invia('Input.insertText',{text:'catalogo'});
  await aspetta(`document.querySelectorAll('#albumCercaRisultati .sr-lesson').length===4`);
  assert.deepEqual(await c.val(`Array.from(document.querySelectorAll('#albumCercaRisultati .sr-lesson')).map(e=>e.textContent.split(' · ')[0])`),['Ritagli','Immagini','Video','Audio']);
  const ricerca=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/zaino-album-ricerca.png',Buffer.from(ricerca.result.data,'base64'));
  await clicca('#albumCercaRisultati [data-album-risultato="'+ids[0]+'"]');
  assert.equal(await c.val('FOTOV.aperta'),ids[0]);
  assert.equal(await c.val(`document.getElementById('albumCercaPop').hasAttribute('open')`),false);await esc();
  await c.val(`bancoForma('uno');bancoAssegna('A','album');AlbumSpazio.scegli('immagini')`);
  const shot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/zaino-album-unificato.png',Buffer.from(shot.result.data,'base64'));
  await c.val(`document.documentElement.dataset.theme='scuro'`);
  const scura=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/zaino-album-scuro.png',Buffer.from(scura.result.data,'base64'));
  await c.val(`document.documentElement.dataset.theme='chiaro'`);
  console.log('✓ ALBUM: quattro raccolte, anteprime, ×/Esc, minutaggio negli appunti, ricerca, ordine e dimensioni');
 }finally{
  await c.val(`playerChiudi();fotoChiudiVista();closePops();document.getElementById('umCancel').click();noteFlushStato(NOTES);noteSvuota(NOTES);localStorage.clear();Object.entries(${q(prima.locale)}).forEach(([k,v])=>localStorage.setItem(k,v));BANCO.stato=${q(prima.banco)};BANCO.attivo=${q(prima.attivo)};bancoDisegna();`);
  for(const f of[audio,video])fs.rmSync(f,{force:true});
  for(const[p,dati]of backup){fs.rmSync(p,{recursive:true,force:true});if(dati instanceof Map){fs.mkdirSync(p,{recursive:true});for(const[n,b]of dati)fs.writeFileSync(path.join(p,n),b);}else if(dati)fs.writeFileSync(p,dati);}
  await c.val(`notesReload();if(${q(prima.nota)})noteOpen(${q(prima.nota)},NOTES);if(NOTES.mde && NOTES.mde.isPreviewActive()!==${q(prima.preview)})NOTES.mde.togglePreview();zainoNavAggiorna();`);
 }
 c.ws().close();
})().catch(e=>{console.error(e);if(c.ws())c.ws().close();process.exitCode=1;});
