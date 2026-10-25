'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),c=require('./cdp');
async function wait(expr){for(let n=0;n<180;n++){if(await c.val(expr))return;await c.pausa(80);}throw Error('Attesa: '+expr);}
const click=async s=>{await c.val(`document.querySelector(${JSON.stringify(s)}).scrollIntoView({block:'nearest'})`);await c.pausa(100);return c.clicca(s);};
const key=async key=>{await c.invia('Input.dispatchKeyEvent',{type:'keyDown',key});await c.invia('Input.dispatchKeyEvent',{type:'keyUp',key});};
async function screenshot(name){await wait(`!document.querySelector('#toast.show')`);await c.pausa(300);const shot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/zaino-percorso-'+name+'.png',Buffer.from(shot.result.data,'base64'));}
const set=(id,value)=>c.val(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
(async()=>{
 await c.collega();await wait(`!!window.zainoStudio && document.getElementById('zschedePreset')?.options.length===5`);
 const vault=await c.val('window.vault.path');assert(vault.includes('studia-zaino-prova-'));
 const ripasso=path.join(vault,'Zaini/biologia/RIPASSO'),active=path.join(ripasso,'active.json'),activeBefore=fs.existsSync(active)?fs.readFileSync(active):null;
 const initial=await c.val(`({banco:JSON.parse(JSON.stringify(bancoStato())),theme:document.documentElement.dataset.theme,storage:{...localStorage}})`);
 await c.val(`cambiaZaino('biologia',true);bancoForma('uno');bancoAssegna('A','studio')`);
 const requests=path.join(path.dirname(vault),'dati/chat-requests.jsonl'),sent=()=>fs.existsSync(requests)?fs.readFileSync(requests,'utf8'):'';
 const previousState=await c.val(`window.vault.studio.state('biologia')`),old=previousState.questions.length,savedCount=previousState.questions.filter(q=>q.saved).length;
 await c.val(`window.vault.chat.clearKey({provider:'openai'});window.vault.chat.saveSettings({provider:'openai',model:'modello-locale-di-prova'})`);
 await click('#zschedeNewButton');await wait(`document.getElementById('zschedeNew').open`);const source=await c.val(`document.getElementById('zschedeSource').value`);
 await set('zschedePreset','domande');await click('#zschedeEstimate');await wait(`!!document.querySelector('#zschedeStatusConfig button') && !document.getElementById('zschedeEstimate').disabled`);
 assert.equal(await c.val(`document.getElementById('zschedeGenerate').hidden`),true);
 await screenshot('configurazione');const before=sent();await click('#zschedeStatusConfig button');assert.equal(await c.val(`document.documentElement.dataset.settings`),'1');
 await c.val(`window.vault.chat.setKey({provider:'openai',value:'chiave-finta-ux'})`);await click('#settingsClose');await wait(`document.getElementById('zschedeStatusConfig').hidden`);
 assert.equal(await c.val(`document.getElementById('zschedeSource').value`),source);assert.equal(await c.val(`document.getElementById('zschedePreset').value`),'domande');assert.equal(sent(),before);assert.equal(await c.val(`document.activeElement.id`),'zschedeEstimate');
 await click('#zschedeEstimate');await wait(`!document.getElementById('zschedeGenerate').hidden && !document.getElementById('zschedeGenerate').disabled`);await screenshot('stima');await click('#zschedeGenerate');await wait(`!!document.querySelector('#zschedeResult article button') && !document.getElementById('zschedeNewButton').disabled`);
 const exactTitle=await c.val(`document.querySelector('#zschedeResult h4').textContent`),afterGeneration=sent();
 await click('#zschedeResult article>button:last-child');
 await wait(`!!document.querySelector('#zstudyQuestion h3') && !document.getElementById('zstudyBrowse').disabled`);
 assert.equal(await c.val(`document.querySelector('#zstudyQuestion h3').textContent`),exactTitle);assert.equal(sent(),afterGeneration);
 let state=await c.val(`window.vault.studio.state('biologia')`);const q=state.questions.find(q=>q.question===exactTitle&&q.saved);assert(q);assert.equal(state.questions.length,old+1);
 await click('#zstudyCollection');await wait(`!!document.querySelector('#zschedeCollection [data-question-id]')`);await set('zschedeKind','domanda');await set('zschedeFilter',exactTitle);
 assert(await c.val(`!!document.querySelector('#zschedeCollection [data-question-id="${q.id}"]')`));await click('#zschedeCollection [data-question-id="'+q.id+'"] button');await wait(`!!document.getElementById('zstudyAttempt')`);assert.equal(sent(),afterGeneration);
 await set('zstudyAttempt','Bozza personale da conservare');await click('#zstudyPause');assert.equal(await c.val(`document.querySelector('#zstudyQuestion h3')`),null);
 await click('#zstudyBrowse');await click('#zstudyQueueFilter [data-filter="all"]');await wait(`!!document.querySelector('#zstudyQueue [data-question-id="${q.id}"]')`);await click('#zstudyQueue [data-question-id="'+q.id+'"]');await wait(`!!document.getElementById('zstudyAttempt')`);assert.equal(await c.val(`document.getElementById('zstudyAttempt').value`),'Bozza personale da conservare');
 // Una seconda domanda sintetica rende verificabile il passaggio senza rigenerazione.
 const q2={...JSON.parse(fs.readFileSync(path.join(ripasso,'domande',q.id+'.json'),'utf8')),id:'prova-ux-seconda',question:'Seconda domanda conservata',attempts:[]};
 fs.writeFileSync(path.join(ripasso,'domande',q2.id+'.json'),JSON.stringify(q2));
 await click('#zstudyBrowse');await wait(`!!document.querySelector('#zstudyQueue [data-question-id="prova-ux-seconda"]')`);await click('#zstudyBack');
 const visited=[await c.val(`document.querySelector('#zstudyQuestion h3').textContent`)];
 while(!await c.val(`document.getElementById('zstudyNext').disabled`)){assert(visited.length<20);await click('#zstudyNext');await wait(`!document.getElementById('zstudyBrowse').disabled`);visited.push(await c.val(`document.querySelector('#zstudyQuestion h3').textContent`));}
 assert.equal(new Set(visited).size,visited.length);assert(visited.includes(q2.question));assert.equal(sent(),afterGeneration);assert.match(await c.val(`document.getElementById('zstudySession').textContent`),/tutte le domande/);
 await screenshot('ripasso');fs.unlinkSync(path.join(ripasso,'domande',q2.id+'.json'));
 await click('#zstudyCollection');await set('zschedeKind','all');await set('zschedeFilter','');
 // Il contesto attivo è una nota, anche se la fonte preselezionata era un’altra.
 await c.val(`window.zainoStudio.usaFonti({mode:'all',sourceIds:[],wikipedia:false});bancoForma('due-col');bancoAssegna('A','appunti');bancoAssegna('C','studio');notesReload()`);await wait(`NOTES.list.length>=2`);
 await c.val(`noteApriAttivo(NOTES.list.find(n=>n.title==='Fotosintesi').file);document.getElementById(noteStatoAttivo().id==='appunti2'?'notePane2':'notePane').dispatchEvent(new Event('pointerdown',{bubbles:true}))`);
 await click('#zschedeNewButton');await wait(`document.getElementById('zschedeSource').selectedOptions[0].textContent.includes('Fotosintesi')`);
 assert(await c.val(`document.getElementById('zragScopeSummary').hidden`),'La scheda usa solo la fonte scelta nel modulo');
 // Selezione trasferita esplicitamente a Ripasso e chat, nomi leggibili fuori dal menu.
 await c.val(`window.zainoStudio.usaFonti({mode:'selected',sourceIds:[${JSON.stringify(source)}],wikipedia:false})`);await click('#zragOpenReview');await wait(`document.querySelector('#zstudyScopeButton span').textContent==='Fonti: 1'`);
 await click('#chatBtn');await click('#zchatScopeButton');await click('#zchatUseStudySources');await wait(`document.getElementById('zchatContext').textContent.includes('Materiali della chat:')`);assert.equal(await c.val(`document.getElementById('zchatScopeCount').textContent`),'1');
 await c.val(`document.getElementById('zchatWindow').hidden=true`);
 // Scorciatoie di attività non perdono documenti. Finestra compatta, poi entrambe le palette.
 await click('#bancoBtn');await click('[data-attivita="lettura"]');assert.equal(await c.val(`bancoStato().forma`),'due-col');assert(await c.val(`bancoVisibile('fonte')&&bancoVisibile('appunti')`));
 await c.invia('Emulation.setDeviceMetricsOverride',{width:1024,height:768,deviceScaleFactor:1,mobile:false});
 await c.val(`bancoForma('quattro');bancoAssegna('D','appunti2');appuntiParalleli.open(NOTES.list.find(n=>n.title==='Cellule').file)`);
 await wait(`!!document.querySelector('#noteHost2 .ncb-more')`);
 assert(await c.val(`getComputedStyle(document.querySelector('#noteHost2 .ncb-more')).display!=='none'`));await click('#noteHost2 .ncb-more');assert.equal(await c.val(`document.querySelector('#noteHost2 .ncb-more').getAttribute('aria-expanded')`),'true');
 await key('Escape');assert.equal(await c.val(`document.querySelector('#noteHost2 .ncb-more').getAttribute('aria-expanded')`),'false');assert.equal(await c.val(`document.activeElement.classList.contains('ncb-more')`),true);await screenshot('compatto');
 await click('#bancoBtn');await click('[data-attivita="studio"]');
 await c.val(`document.getElementById('zschedeBack').click();document.getElementById('zschedeFilter').scrollIntoView({block:'center'});document.getElementById('zschedeFilter').focus()`);await key('Tab');
 assert.equal(await c.val(`document.activeElement.id`),'zschedeKind');assert.equal(await c.val(`getComputedStyle(document.activeElement).outlineStyle`),'solid');
 assert(await c.val(`['zschedeFilter','zschedeKind','zstudySearch','zstudyOrigin'].every(id=>document.getElementById(id).labels.length>0)`));
 const contrasts={};
 for(const theme of ['chiaro','scuro']){
  await c.val(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);await screenshot(theme);assert(await c.val(`document.documentElement.scrollWidth<=innerWidth`));
  contrasts[theme]=await c.val(`(()=>{const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d'),css=getComputedStyle(document.documentElement);function rgb(token){ctx.fillStyle=css.getPropertyValue(token).trim();ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3);}return {testo:rgb('--muted'),sfondo:rgb('--panel'),focus:rgb('--focus')};})()`);
  const luminance=rgb=>rgb.map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((a,n,i)=>a+n*[.2126,.7152,.0722][i],0);
  const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
  contrasts[theme].rapportoTesto=ratio(contrasts[theme].testo,contrasts[theme].sfondo);contrasts[theme].rapportoFocus=ratio(contrasts[theme].focus,contrasts[theme].sfondo);
  assert(contrasts[theme].rapportoTesto>=4.5);assert(contrasts[theme].rapportoFocus>=3);
 }
 fs.writeFileSync('/tmp/zaino-percorso-contrasto.json',JSON.stringify(contrasts,null,2));
 const fsBefore=await c.val(`document.documentElement.style.getPropertyValue('--fs')`);await c.val(`document.documentElement.style.setProperty('--fs','34px')`);
 assert(await c.val(`document.getElementById('zstudio').scrollWidth<=document.getElementById('zstudio').clientWidth+1`),'lo studio non scorre in orizzontale con testo raddoppiato');
 await c.val(`document.documentElement.style.setProperty('--fs',${JSON.stringify(fsBefore)})`);
 // Anche una domanda nuova non ancora conservata resta reperibile dopo Pausa.
 await c.val(`bancoForma('uno');bancoAssegna('A','flashcard');document.getElementById('zstudyNewButton').click()`);
 await set('zstudyTopic','luce e fotosintesi');await click('#zstudyStart');await wait(`!!document.getElementById('zstudyAttempt') && !document.getElementById('zstudyBrowse').disabled`);
 assert.equal(await c.val(`document.getElementById('zstudyNew').open`),false);
 const fresh=(await c.val(`window.vault.studio.state('biologia')`)).active;assert(fresh&&!fresh.saved);
 await set('zstudyAttempt','Bozza della domanda nuova');await click('#zstudyPause');await wait(`!document.getElementById('zstudyAttempt') && !document.getElementById('zstudyBrowse').disabled`);
 assert((await c.val(`window.vault.studio.state('biologia')`)).questions.find(x=>x.id===fresh.id).saved);
 await click('#zstudyBrowse');await click('#zstudyQueueFilter [data-filter="all"]');await wait(`!!document.querySelector('#zstudyQueue [data-question-id="${fresh.id}"]')`);await click('#zstudyQueue [data-question-id="'+fresh.id+'"]');await wait(`!!document.getElementById('zstudyAttempt')`);assert.equal(await c.val(`document.getElementById('zstudyAttempt').value`),'Bozza della domanda nuova');
 fs.unlinkSync(path.join(ripasso,'domande',fresh.id+'.json'));
 await c.val(`cambiaZaino('storia',true)`);await wait(`document.getElementById('zschedeCollectionStatus').textContent.includes('0 domande')`);assert(!(await c.val(`document.getElementById('zschedeCollection').textContent`)).includes(exactTitle));
 await c.val(`cambiaZaino('biologia',true)`);await wait(`document.getElementById('zschedeCollectionStatus').textContent.includes('${savedCount+1} domande')`);
 state=await c.val(`window.vault.studio.state('biologia')`);assert(state.questions.some(x=>x.id===q.id));
 // Il runner condivide il vault fra prove: ripristina ciò che questa prova ha creato.
 fs.unlinkSync(path.join(ripasso,'domande',q.id+'.json'));if(activeBefore)fs.writeFileSync(active,activeBefore);else fs.rmSync(active,{force:true});
 await c.val(`document.documentElement.dataset.theme=${JSON.stringify(initial.theme)};localStorage.clear();Object.entries(${JSON.stringify(initial.storage)}).forEach(([k,v])=>localStorage.setItem(k,v));BANCO.stato=${JSON.stringify(initial.banco)};bancoSalva();bancoDisegna()`);await c.invia('Emulation.clearDeviceMetricsOverride');
 console.log('percorso UI: raccolta comune, identità stabile, apertura senza AI, configurazione recuperabile, fonti, pausa, Banco compatto e isolamento OK');process.exit(0);
})().catch(async e=>{console.error(e);try{console.error(await c.val(`({schede:document.getElementById('zschedeStatus')?.textContent,ripasso:document.getElementById('zstudyStatus')?.textContent})`));}catch(_){}process.exit(1);});
