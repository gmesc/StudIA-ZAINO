'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),c=require('./cdp');
const q=JSON.stringify;let marker,prima;const creati=[];
async function aspetta(expr){for(let i=0;i<100;i++){if(await c.val(expr))return;await c.pausa(100);}throw Error('Attesa scaduta: '+expr);}
(async()=>{
 await c.collega();await c.partiPulito();
 const vault=await c.val('window.vault.path');assert(vault.includes('studia-zaino-prova-'),'solo vault sintetico');
 const dati=path.join(path.dirname(vault),'dati'),d=path.join(vault,'Zaini/biologia/APPUNTI');marker=path.join(dati,'appunti-salvataggio-lento');
 prima=await c.val(`(()=>{noteFlush();return {banco:JSON.parse(JSON.stringify(bancoStato())),file:NOTES.cur?.file,zaino:corsoAttivo()};})()`);
 await c.val(`cambiaZaino('biologia',true);bancoForma('quattro');bancoAssegna('A','fonte');bancoAssegna('C','fonte2');bancoAssegna('B','appunti');bancoAssegna('D','lim');`);
 for(const title of ['Asincrono uno','Asincrono due'])creati.push(await c.val(`window.vault.notes.save('biologia',null,{title:${q(title)}},'Testo base').file`));
 await c.val(`notesReload();noteOpen(${q(creati[0])},NOTES);if(NOTES.mde.isPreviewActive())NOTES.mde.togglePreview();if(NOTES.mde.isSideBySideActive())NOTES.mde.toggleSideBySide();NOTES.mde.codemirror.focus();NOTES.mde.codemirror.setCursor({line:0,ch:0});`);
 await c.pausa(150);fs.writeFileSync(marker,'1');
 await c.invia('Input.insertText',{text:'Prima. '});
 assert(await c.val(`(()=>{window.__esito=null;var p=noteSave(true,NOTES);if(!p?.then)return false;p.then(r=>__esito=r);return true;})()`),'la porta dell’autosave deve essere asincrona');
 await c.invia('Input.insertText',{text:'Durante. '});
 assert.equal(await c.val('__esito'),null,'il testo deve comparire PRIMA che il disco lento risponda');
 assert((await c.val('NOTES.mde.value()')).includes('Durante. '));
 assert(await c.val(`new Promise(r=>requestAnimationFrame(()=>r(__esito===null)))`),'anche il frame deve avanzare durante il salvataggio');
 await aspetta('__esito!==null');assert(await c.val('NOTES.dirty'),'i nuovi tasti restano da salvare');
 // Cambio documento durante la seconda scrittura: il flush aspetta e l'ack vecchio non tocca il nuovo editor.
 await c.val(`window.__secondo=noteSave(true,NOTES);true`);
 await c.invia('Input.insertText',{text:'Ultimo. '});
 assert(await c.val(`noteOpen(${q(creati[1])},NOTES)`));await c.pausa(100);
 assert.equal(await c.val('NOTES.cur.file'),creati[1]);assert.equal((await c.val('NOTES.mde.value()')).trim(),'Testo base');
 assert(fs.readFileSync(path.join(d,creati[0]),'utf8').includes('Prima. Durante. Ultimo. '));
 // La rinomina usa la stessa coda e non lascia un file fantasma.
 await c.val(`noteOpen(${q(creati[0])},NOTES);NOTES.mde.codemirror.focus();NOTES.mde.codemirror.replaceRange('Rinomina. ',{line:0,ch:0});window.__rinomina=noteSave(true,NOTES);true`);
 const rinominato=await c.val(`(()=>{if(!noteFlushStato(NOTES))throw Error('flush');return window.vault.notes.rename('biologia',${q(creati[0])},'Asincrono rinominato');})()`);
 assert(!rinominato.error,q(rinominato));const vecchio=creati[0];creati[0]=rinominato.file;
 assert(!fs.existsSync(path.join(d,vecchio)));assert(fs.readFileSync(path.join(d,creati[0]),'utf8').includes('Rinomina. '));
 await c.val(`noteSvuota(NOTES);notesReload();noteOpen(${q(creati[0])},NOTES);NOTES.mde.codemirror.replaceRange('Prima del reload. ',{line:0,ch:0});window.__reload=noteSave(true,NOTES);true`);
 await c.invia('Page.reload');await c.pausa(1800);await aspetta(`typeof NOTES!=='undefined' && window.vault?.path===${q(vault)}`);
 assert(fs.readFileSync(path.join(d,creati[0]),'utf8').includes('Prima del reload. '));
 await c.val(`notesReload();noteOpen(${q(creati[0])},NOTES)`);
 assert((await c.val('NOTES.mde.value()')).includes('Prima del reload. '),'la nota salvata resta visibile dopo la riapertura');
 // Un salvataggio già partito precede la rimozione, mai il contrario.
 await c.val(`NOTES.mde.codemirror.replaceRange('Da cestinare. ',{line:0,ch:0});window.__rimozione=noteSave(true,NOTES);true`);
 assert(await c.val(`window.vault.notes.remove('biologia',${q(creati[0])})`));await c.pausa(1200);assert(!fs.existsSync(path.join(d,creati[0])));
 await c.val('noteSvuota(NOTES)');creati.shift();
 console.log('✓ testo e frame durante disco lento; ultimo testo al cambio, rinomina, reload e rimozione ordinata');
})().then(async()=>{
 fs.rmSync(marker,{force:true});
 for(const f of creati)await c.val(`window.vault.notes.remove('biologia',${q(f)})`);
 await c.val(`noteSvuota(NOTES);notesReload();if(${q(prima.file||'')})noteOpen(${q(prima.file||'')},NOTES);BANCO.stato=${q(prima.banco)};bancoSalva();bancoDisegna();`);process.exit(0);
}).catch(e=>{if(marker)fs.rmSync(marker,{force:true});console.error(e);process.exit(1);});
