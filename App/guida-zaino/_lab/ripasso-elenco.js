'use strict';
// Le schede dimostrative restano confinate nel laboratorio; nessuna generazione AI.
const L=require('./lab'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
async function wait(expr){assert(await L.finoA(expr,18000),expr);}
(async()=>{
 await L.collega();const vault=process.env.GUIDA_VAULT;
 assert(vault && fs.realpathSync(vault).startsWith('/private/tmp/studia-guida-'));assert.equal(await L.val('window.vault.path'),vault);
 await L.pulito();await L.invia('Emulation.setDeviceMetricsOverride',{width:1470,height:956,deviceScaleFactor:2,mobile:false});
 await L.val(`cambiaZaino('biologia')`);await wait(`zainoAttivo()==='biologia' && document.getElementById('zschedePreset')?.options.length===5`);
 const sources=(await L.val(`window.vault.chat.sources('biologia')`)).sources,s=sources.find(s=>s.file.endsWith('01 Botanica.pdf'));assert(s);
 const file=path.join(vault,'Zaini/biologia/_lavorazione/rag/schede',s.id+'-domande.json'),old=fs.existsSync(file)?fs.readFileSync(file):null;
 fs.mkdirSync(path.dirname(file),{recursive:true});
 fs.writeFileSync(file,JSON.stringify({version:1,preset:'domande',sourceId:s.id,revision:s.revision,file:s.file,createdAt:new Date().toISOString(),provider:'dimostrazione',model:'sintetico',sources:[{sourceId:s.id,revision:s.revision,file:s.file,kind:'pdf',page:1,chunkId:'guida-domande',quote:'La luce alimenta la fotosintesi.'}],items:['Come utilizzano la luce le piante per produrre energia chimica?','Quale ruolo svolge la clorofilla nella fotosintesi?','Perché le piante hanno bisogno di acqua e anidride carbonica?'].map(title=>({title,text:'Risposta dimostrativa.',refs:['guida-domande']}))}));
 try{
  await L.val(`bancoForma('due-col');bancoAssegna('A','flashcard');bancoAssegna('C','studio');bancoAttivaBlocco('A')`);
  await L.clicca('#zstudyBrowse');await L.clicca('#zstudyScopeButton');await wait(`document.querySelector('#zstudyScope input')`);
  if(!await L.val(`document.querySelector('#zstudyScope input').checked`))await L.clicca('#zstudyScope input');
  await L.clicca('#zstudyScopeButton');await wait(`document.querySelectorAll('#zstudyQueue .zstudy-question-open').length>=3`);
  await L.val(`document.getElementById('zstudySearch').value='';document.getElementById('zstudySearch').dispatchEvent(new Event('input'));document.getElementById('zstudyOrigin').value='all';document.getElementById('zstudyOrigin').dispatchEvent(new Event('change'));document.querySelector('#zstudyQueueFilter [data-filter="all"]').click()`);
  await L.muovi(10,940);await L.pausa(3800);await L.scatta('208-ripasso-domande',{sel:'#zinterroga',scala:2,margine:4});
  await L.clicca('#zstudyEdit');await L.clicca('#zstudyQueue .zstudy-card-group > summary input');await L.muovi(10,940);await L.pausa(300);await L.scatta('209-ripasso-modifica',{sel:'#zinterroga',scala:2,margine:4});await L.clicca('#zstudyEdit');
  await L.clicca('#zstudyQueue .zstudy-card-group > summary');await wait(`!document.querySelector('#zstudyQueue .zstudy-card-group').open`);await L.muovi(10,940);await L.pausa(200);
  const chiusa=await L.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/zaino-ripasso-scheda-chiusa.png',Buffer.from(chiusa.result.data,'base64'));
 }finally{if(old)fs.writeFileSync(file,old);else fs.rmSync(file,{force:true});}
 console.log('Elenco Ripasso: ricerca, etichette e filtri acquisiti.');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
