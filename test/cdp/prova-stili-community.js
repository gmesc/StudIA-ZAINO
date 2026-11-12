'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),c=require('./cdp'),q=JSON.stringify;
const dir=path.resolve(__dirname,'../../App/guida-zaino/download/stili'),dlg='dialog.stili-community[open]';
async function wait(expr){for(let i=0;i<120;i++){if(await c.val(expr))return;await c.pausa(75);}throw Error('Attesa: '+expr+' · '+await c.val('document.querySelector(".stili-community output")?.textContent'));}
async function click(sel){await wait('!!document.querySelector('+q(sel)+')');await c.val('document.querySelector('+q(sel)+').click()');}
const bt=n=>`[...document.querySelectorAll('${dlg} button')].find(b=>b.textContent===${q(n)})`;
async function clicVero(expr){
 const pos=await c.val('(()=>{const e='+expr+';e.scrollIntoView({block:"center",behavior:"instant"});const r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;return {x,y,ok:r.width>0&&e.contains(document.elementFromPoint(x,y))};})()');
 assert(pos.ok,'Comando visibile e raggiungibile: '+expr);
 for(const type of ['mousePressed','mouseReleased'])await c.invia('Input.dispatchMouseEvent',{type,x:pos.x,y:pos.y,button:'left',clickCount:1});
}
async function premi(n){await wait(bt(n)+' && !'+bt(n)+'.disabled');await clicVero(bt(n));}
async function scegli(file){
 const doc=(await c.invia('DOM.getDocument')).result.root.nodeId;
 const nodeId=(await c.invia('DOM.querySelector',{nodeId:doc,selector:dlg+' input[type=file]'})).result.nodeId;
 await c.invia('DOM.setFileInputFiles',{nodeId,files:[file]});
}
(async()=>{
 await c.collega();await wait("typeof ZainoPresenta!=='undefined' && zainoAttivo()==='biologia'");
 const vault=await c.val('vault.path');assert(vault.includes('studia-zaino-prova-'));
 const raccoltaPrima=await c.val('JSON.stringify(ZainoRaccolta.leggi())');
 const orig=await c.val('({impostazioniNascoste:document.getElementById("settingsModal").hidden,banco:bancoStato(),attivo:BANCO.attivo,storage:{...localStorage},tuning:document.querySelector(".tuning-tipi [aria-pressed=true]")?.dataset.tipo||"mappa"})'),area=path.dirname(vault),marker=path.join(area,'dati/dialogo-salvataggio.json'),prima=fs.existsSync(marker)?fs.readFileSync(marker):null;
 let mappa,doc;
 async function flusso(nome,tipo){
  await wait('!!document.querySelector('+q(dlg)+')');
  if(tipo==='mappa'){await scegli(path.join(dir,'ardesia.zaino-stile.json'));await wait('document.querySelector(".stili-community output").textContent.includes("soltanto")');assert(await c.val(bt('Applica stile')+'.disabled'));}
  const input=path.join(dir,nome+'.zaino-stile.json'),p=JSON.parse(fs.readFileSync(input)),out=path.join(area,tipo+'.json');
  await scegli(input);await wait('document.querySelector(".stili-community select").value==="file" && !'+bt('Applica stile')+'.disabled');
  if(process.env.ZAINO_CAMPIONI_STILI){
   await c.val('document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))');
   const png=await c.invia('Page.captureScreenshot',{format:'png'});assert(!png.error,JSON.stringify(png.error));fs.writeFileSync(path.join(process.env.ZAINO_CAMPIONI_STILI,nome+'.png'),Buffer.from(png.result.data,'base64'));
  }
  await premi('Salva nella raccolta');await wait('document.querySelector(".stili-community output").textContent.includes("salvato")');
  fs.writeFileSync(marker,q({filePath:out}));await premi('Esporta stile…');await wait('document.querySelector(".stili-community output").textContent.includes("esportato")');
  assert.deepEqual(JSON.parse(fs.readFileSync(out)),p);await premi('Applica stile');await wait('!document.querySelector('+q(dlg)+')');
 }
 try{
  // Il kit è un allegato fisso dell’app: il dialogo sceglie solo dove salvarlo.
  await c.val('ZainoTuning.apri("navbar")');await wait('!!document.querySelector(".tuning-toolbar")');
  const kit='document.querySelector("#tuningKit")';assert(await c.val('!!'+kit),'pulsante Scarica kit chatbot presente in TUNING');
  const zip=path.join(area,'Kit-stili-ZAINO.zip'),originale=fs.readFileSync(path.join(dir,'../Kit-stili-ZAINO.zip'));
  fs.writeFileSync(marker,q({filePath:zip}));await clicVero(kit);await wait('document.querySelector(".tuning-stato").textContent.includes("Kit salvato")');assert(fs.readFileSync(zip).equals(originale),'ZIP scaricato identico al kit incluso');
  const contenuto=require('fflate').unzipSync(fs.readFileSync(zip));for(const nome of ['stile.schema.json','bosco.zaino-stile.json','ardesia.zaino-stile.json','sentiero.zaino-stile.json','LEGGIMI.md','PROMPT-NAVBAR.txt'])assert(contenuto['Kit-stili-ZAINO/'+nome],nome+' incluso');
  fs.writeFileSync(marker,q({canceled:true}));await clicVero(kit);await wait('document.querySelector(".tuning-stato").textContent.includes("annullato")');assert(fs.readFileSync(zip).equals(originale));
  fs.writeFileSync(marker,q({filePath:path.join(area,'kit.txt')}));await clicVero(kit);await wait('document.querySelector(".tuning-stato").textContent.includes("Formato di esportazione non consentito")');assert(!fs.existsSync(path.join(area,'kit.txt')));assert(!await c.val(kit+'.disabled'));
  await c.val('document.querySelector(".tuning-stato").textContent=""');await c.val('document.fonts.ready');fs.writeFileSync('/private/tmp/zaino-tuning-kit.png',Buffer.from((await c.invia('Page.captureScreenshot',{format:'png'})).result.data,'base64'));
  await c.clicca('#settingsClose');console.log('✓ Kit chatbot: clic reale, ZIP completo identico, annullamento e errore di salvataggio dichiarato.');
  mappa=await c.val(`(async()=>{const r=await mappeApi().salva('biologia',null,{titolo:'Campione',nodi:[{id:'a',testo:'Riservato',origine:'utente'}],archi:[]});bancoForma('uno');bancoAssegna('A','mappa');MAPPA.registro='mie';await mappaApriMia(r.file);return r.file;})()`);
  await click('#mVista');await clicVero('document.querySelector("#mAspetto details > button")');await flusso('bosco','mappa');assert.equal(await c.val('MAPPA.vista.aspetto.raggio'),12);
  await c.val('mappaAnnulla()');assert.notEqual(await c.val('MAPPA.vista.aspetto.raggio'),12);await c.val('mappaRipeti();mappaFlush()');
  assert.equal(require('../../lib/mappe').apri(vault,'biologia',mappa).mappa.vista.aspetto.carta,'#F4F7F0');
  await c.val("closePops();bancoAssegna('A','presenta')");await click('#presentaPane [aria-label=Documento]');await click('[aria-label="Nuova presentazione"]');
  await wait('!!document.querySelector("#uiModal[open]")');await c.val("document.querySelector('#umInput').value='Stili';document.querySelector('#umOk').click()");await wait('!!ZainoPresenta.documento');doc=await c.val('ZainoPresenta.documento.id');
  await click('#presentaPane [data-oggetto-id="@stile"]');await click('.presenta-stili-controlli [aria-label="Stili della community…"]');await flusso('ardesia','slide');
  assert.equal(await c.val('ZainoPresenta.documento.stacks[0].slides[0].background'),'#172A2A');
  await click('#presentaPane [aria-label="Annulla nella presentazione"]');assert.notEqual(await c.val('ZainoPresenta.documento.stacks[0].slides[0].background'),'#172A2A');await click('#presentaPane [aria-label="Ripeti nella presentazione"]');
  assert.deepEqual(await c.val('ZainoStili.slide(ZainoPresenta.documento,ZainoPresenta.documento.stacks[0].slides[0])'),JSON.parse(fs.readFileSync(path.join(dir,'ardesia.zaino-stile.json'))).stile);
  await click('#presentaPane [aria-label=Inserisci]');await click('.presenta-voci-menu [aria-label=Navbar]');
  await click('.presenta-aspetto summary');if(!await c.val('document.querySelector("[data-pannello=navbar-intera]").open'))await click('[data-pannello=navbar-intera] summary');await clicVero('document.querySelector('+q('.presenta-aspetto [aria-label="Stili della community…"]')+')');await flusso('sentiero','navbar');
  await c.val('ZainoPresenta.flush()');const d=require('../../lib/presentazioni').leggi(vault,'biologia',doc);assert.equal(d.stacks[0].slides[0].blocks.find(b=>b.type==='navbar').style.navbar.markerSize,36);
  console.log('✓ Tre file reali: anteprima, raccolta, esportazione su disco con attribuzione e applicazione; Undo mappa e persistenza.');
 }finally{
  await c.val('document.querySelector('+q('.tuning-tipi [data-tipo="'+orig.tuning+'"]')+')?.click()');
  await c.val('vault.stili.raccoltaSalva('+q(raccoltaPrima)+')');
  await c.val('document.querySelector("dialog.stili-community[open]")?.close()');
  if(orig.impostazioniNascoste)await c.val('if(!document.getElementById("settingsModal").hidden)document.getElementById("settingsClose").click()');
  if(doc){await c.val('ZainoPresenta.chiudi()');await c.val('vault.presentazioni.comando({azione:"elimina",corso:"biologia",id:'+q(doc)+'})');}
  if(mappa)await c.val('mappeApi().rimuovi("biologia",'+q(mappa)+')');
  await c.val('localStorage.clear();Object.entries('+q(orig.storage)+').forEach(([k,v])=>localStorage.setItem(k,v));BANCO.stato='+q(orig.banco)+';BANCO.attivo='+q(orig.attivo)+';bancoDisegna()');
  if(prima)fs.writeFileSync(marker,prima);else fs.rmSync(marker,{force:true});
 }
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
