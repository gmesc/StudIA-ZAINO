'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),c=require('./cdp'),C=require('../../lib/costi-zaino'),F=require('../../lib/fonti-ai');
const q=JSON.stringify;async function wait(expr){for(let i=0;i<160;i++){if(await c.val(expr))return;await c.pausa(100);}throw Error('Attesa: '+expr);}
async function click(sel){await c.val(`document.querySelector(${q(sel)}).scrollIntoView({block:'nearest'})`);await c.clicca(sel);}
async function open(){await click('#settingsBtn');await click('.set-tab[data-tab="ai"]');assert.equal(await c.val(`document.getElementById('zchatCosts').tagName`),'DETAILS');assert.equal(await c.val(`document.getElementById('zchatCosts').open`),false,'Costi inizialmente collassati');await click('#zchatCosts>summary');await wait(`!!document.getElementById('zchatCostsTotal') && !document.getElementById('zchatCostsRefresh').disabled`);}
(async()=>{
 await c.collega();await wait(`!!window.vault.costs.summaryZaini && !!document.getElementById('zchatCosts')`);
 const vault=await c.val('window.vault.path');assert(vault.includes('studia-zaino-prova-'));
 const config=path.join(path.dirname(vault),'dati/config.json'),requests=path.join(path.dirname(vault),'dati/chat-requests.jsonl'),files=[config,requests,path.join(vault,'Costi/storico-zaini.json'),...['biologia','storia'].map(z=>path.join(vault,'Zaini',z,'Costi/usage.jsonl'))];
 const backups=files.map(f=>[f,fs.existsSync(f)?fs.readFileSync(f):null]);let session;
 const initial=await c.val(`({storage:{...localStorage},banco:bancoStato(),theme:document.documentElement.dataset.theme})`);
 try{
  for(const f of files.slice(2))fs.rmSync(f,{force:true});
  const source=F.sincronizza(vault,'biologia').sources.find(s=>s.kind==='pdf'),meta={provider:'google',model:'gemini-2.5-flash',operation:'Scheda: Sintesi',sourceIds:[source.id],usage:{inputTokens:1000,outputTokens:100}};
  C.registra(vault,'biologia',meta);C.registra(vault,'storia',{...meta,model:'senza-tariffa',sourceIds:[]});
  await open();assert((await c.val(`document.getElementById('zchatCostsTotal').textContent`)).includes('parziale'));
  assert.equal(await c.val(`document.querySelectorAll('#zchatCostsSummary details').length`),2);
  await click('#zchatCosts>summary');assert.equal(await c.val(`document.getElementById('zchatCostsTotal').checkVisibility()`),false);await click('#zchatCosts>summary');await wait(`!document.getElementById('zchatCostsRefresh').disabled`);
  await click('#zchatCostsSummary [data-zaino="biologia"] summary');assert((await c.val(`document.querySelector('#zchatCostsSummary [data-zaino="biologia"]').textContent`)).includes('Botanica.pdf'));
  assert((await c.val(`document.querySelector('#zchatCostsSummary [data-zaino="storia"] summary').textContent`)).includes('Stima non disponibile'));
  if(process.env.STUDIA_SOLO_NAVIGAZIONE==='1'){
   C.registra(vault,'biologia',{...meta,model:'senza-tariffa',sourceIds:[]});await click('#zchatCostsRefresh');
  }else{
  await c.val(`window.vault.chat.setKey({provider:'openai',value:'chiave-finta-costi'})`);await c.val(`window.vault.chat.saveSettings({provider:'openai',model:'modello-locale-di-prova'})`);
  session=(await c.val(`window.vault.chat.create('biologia',{role:'spiegamelo'})`)).session.id;
  const answer=await c.val(`window.vault.chat.send('biologia',{sessionId:${q(session)},text:'Come funziona una cellula?',provider:'openai',model:'modello-locale-di-prova'})`);assert(answer.ok,answer.error);
  await wait(`document.getElementById('zchatCostsSummary').textContent.includes('3 chiamate cloud')`);
  }
  assert.equal((await c.val(`window.vault.costs.summaryZaini()`)).total.calls,3,'Una risposta della chat registra un solo consumo');
  const ledger=path.join(vault,'Zaini/biologia/Costi/usage.jsonl'),before=fs.readFileSync(ledger);
  assert(!before.toString().includes('Come funziona')&&!before.toString().includes('chiave-finta'),'Nel registro non finiscono prompt o chiavi');
  for(const theme of ['chiaro','scuro']){await c.val(`document.documentElement.dataset.theme=${q(theme)};document.getElementById('zchatCosts').scrollIntoView({block:'start'})`);const shot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/zaino-costi-'+theme+'.png',Buffer.from(shot.result.data,'base64'));}
  await click('#zchatCostsReset');await wait(`!document.getElementById('zchatCostsUndo').hidden && !document.getElementById('zchatCostsUndo').disabled`);assert.equal((await c.val(`window.vault.costs.summaryZaini()`)).total.calls,0);assert(fs.readFileSync(ledger).equals(before));
  C.registra(vault,'biologia',meta);await click('#zchatCostsRefresh');await wait(`!document.getElementById('zchatCostsRefresh').disabled && document.getElementById('zchatCostsSummary').textContent.includes('1 chiamate cloud')`);
  await click('#zchatCostsUndo');await wait(`document.getElementById('zchatCostsUndo').hidden && !document.getElementById('zchatCostsRefresh').disabled`);assert.equal((await c.val(`window.vault.costs.summaryZaini()`)).total.calls,4);
  await click('#zchatCostsReset');await wait(`!document.getElementById('zchatCostsUndo').hidden && !document.getElementById('zchatCostsUndo').disabled`);
  await click('#settingsClose');await c.val('location.reload()');await c.pausa(800);await c.collega();await wait(`!!document.getElementById('zchatCosts')`);await open();assert(await c.val(`!document.getElementById('zchatCostsUndo').hidden`));
  await click('#zchatCostsUndo');await wait(`document.getElementById('zchatCostsUndo').hidden && !document.getElementById('zchatCostsRefresh').disabled`);assert.equal((await c.val(`window.vault.costs.summaryZaini()`)).total.calls,4);
  assert(await c.val(`!!document.querySelector('#zchatCostsRefresh svg[data-icona="refresh-cw"]') && !!document.getElementById('zchatCostsReset').title`));
  await click('#settingsClose');
 }finally{
  if(session)await c.val(`window.vault.chat.remove('biologia',${q(session)})`);
  for(const [f,data] of backups){if(data){fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,data);}else fs.rmSync(f,{force:true});}
  await c.val(`(()=>{localStorage.clear();for(const [k,v] of Object.entries(${q(initial.storage)}))localStorage.setItem(k,v);document.documentElement.dataset.theme=${q(initial.theme)};BANCO.stato=${q(initial.banco)};bancoSalva();bancoDisegna();})()`);await c.val('location.reload()');await c.pausa(800);await c.collega();
 }
 console.log('✓ Costi AI: riepilogo per zaino/materiale, dati mancanti, risposta cloud registrata, reset e undo persistenti senza perdere nuovi consumi');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
