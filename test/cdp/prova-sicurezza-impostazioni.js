'use strict';
// Cablaggio reale, documenti sintetici e motori sostituiti solo nell'entry point di prova.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const {fileURLToPath,pathToFileURL} = require('node:url');
const {PDFDocument} = require('pdf-lib');
const c = require('./cdp'), q = JSON.stringify;
async function aspetta(expr) {
  const fine=Date.now()+20000;
  while(Date.now()<fine) { if(await c.val(expr))return; await c.pausa(80); }
  const stato=await c.val(`(async()=>({sicurezza:await window.vault.sicurezza.stato(),progresso:document.getElementById('sicurezzaProgresso')?.textContent,pdf:document.getElementById('pdfHost')?.getAttribute('data-stato')}))()`);
  throw Error('Attesa: '+expr+'\nStato: '+JSON.stringify(stato));
}
async function click(sel) { await c.val(`document.querySelector(${q(sel)}).scrollIntoView({block:'nearest'})`); await c.clicca(sel); }
async function scegli(files) {
  await c.val(`(()=>{document.getElementById('sicurezzaFiles')?.remove();const e=document.createElement('input');e.type='file';e.multiple=true;e.id='sicurezzaFiles';document.body.append(e);})()`);
  const doc=await c.invia('DOM.getDocument',{}), nodo=await c.invia('DOM.querySelector',{nodeId:doc.result.root.nodeId,selector:'#sicurezzaFiles'});
  const r=await c.invia('DOM.setFileInputFiles',{nodeId:nodo.result.nodeId,files}); assert(!r.error);
}
async function pdf(file, marker='') {
  const d=await PDFDocument.create();d.addPage().drawText('Energia e cellule: documento per la prova sicurezza.',{x:40,y:700,size:14});
  fs.writeFileSync(file,Buffer.concat([Buffer.from(await d.save()),Buffer.from('\n% '+marker+'\n')]));
}

(async()=>{
  await c.collega();await c.invia('Emulation.setFocusEmulationEnabled',{enabled:true});
  await aspetta(`!!window.vault?.sicurezza && typeof zainoAttivo==='function' && !!document.getElementById('settingsBtn')`);
  const vault=await c.val('window.vault.path'), lab=path.dirname(vault), dati=path.join(lab,'dati');
  assert(lab.includes('studia-zaino-prova-'),'Solo il laboratorio sintetico');
  const registro=path.join(dati,'sicurezza-chiamate.jsonl'), simulazione=path.join(dati,'sicurezza-simulazione.json');
  const chiamate=()=>fs.existsSync(registro)?fs.readFileSync(registro,'utf8').split('\n').filter(Boolean).map(JSON.parse):[];
  const prima=await c.val(`({zaino:zainoAttivo(),banco:JSON.parse(JSON.stringify(bancoStato())),attivo:BANCO.attivo,locale:Object.assign({},localStorage),tema:document.documentElement.dataset.theme})`);
  const statoPrima=await c.val('window.vault.sicurezza.stato()');assert(statoPrima.ok,JSON.stringify(statoPrima));
  const originali=new Map();let id,root;
  const input=fs.mkdtempSync(path.join(lab,'sicurezza-input-'));
  try {
    await c.partiVuoto();await click('#settingsBtn');await click('[data-tab="sicurezza"]');
    assert(await c.val(`!document.getElementById('sicurezzaSettings').hidden && document.querySelector('[data-tab="sicurezza"]').getAttribute('aria-selected')==='true'`));
    for(const motore of ['qpdf','clamav']) {
      const stato=await c.val('window.vault.sicurezza.stato()'), info=stato.motori.find(m=>m.id===motore);assert(info.disponibile,'Pacchetto sintetico disponibile');
      if(!info.installato) {await click('#sicurezzaInstalla-'+motore);await aspetta(`window.vault.sicurezza.stato().then(s=>!s.inCorso&&s.motori.find(m=>m.id===${q(motore)}).installato)`);}
    }
    await click('#sicurezzaAggiornaFirme');
    await aspetta(`document.getElementById('sicurezzaProgresso').textContent.trim().length>0`);
    await aspetta(`window.vault.sicurezza.stato().then(s=>s.firme.pronte&&!s.inCorso)`);
    for(const motore of ['qpdf','clamav']) {
      if(!(await c.val('window.vault.sicurezza.stato()')).motori.find(m=>m.id===motore).attivo)await click('#sicurezzaAttiva-'+motore);
      await aspetta(`window.vault.sicurezza.stato().then(s=>s.motori.find(m=>m.id===${q(motore)}).operativo)`);
      assert(await c.val(`document.getElementById(${q('sicurezzaAttiva-'+motore)}).checked`));
    }
    assert.equal((await c.val(`window.vault.sicurezza.attiva('inesistente',true)`)).ok,false,'Nessun motore arbitrario dal renderer');
    await click('#settingsClose');
    await c.val('location.reload()');await c.pausa(700);
    await aspetta(`!!window.vault?.sicurezza && !!document.getElementById('settingsBtn')`);
    assert((await c.val('window.vault.sicurezza.stato()')).motori.every(m=>m.attivo&&m.operativo),'Preferenze conservate al ricaricamento');
    await click('#settingsBtn');await click('[data-tab="sicurezza"]');
    for(const tema of ['chiaro','scuro']) {
      await c.val(`document.documentElement.dataset.theme=${q(tema)};document.getElementById('sicurezzaSettings').scrollIntoView({block:'start'})`);
      assert(await c.val(`['qpdf','clamav'].every(id=>document.getElementById('sicurezzaStato-'+id).textContent.trim().length>0)`));
      const shot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/zaino-sicurezza-impostazioni-'+tema+'.png',Buffer.from(shot.result.data,'base64'));
    }
    await click('#settingsClose');

    const creato=await c.val(`window.vault.zaino.create('Sicurezza motori')`);assert(!creato.error,JSON.stringify(creato));id=creato.id;root=path.join(vault,'Zaini',id);
    const buono=path.join(input,'Documento con avviso.pdf'), cattivo=path.join(input,'Documento bloccato.pdf');
    await pdf(buono,'ZAINO-PROVA-OFFSET');await pdf(cattivo,'ZAINO-PROVA-MINACCIA');
    for(const f of [buono,cattivo])originali.set(f,fs.readFileSync(f));
    await scegli([buono,cattivo]);
    const primaImport=chiamate().length;
    const r=await c.val(`window.vault.fonti.importa(${q(id)},Array.from(document.getElementById('sicurezzaFiles').files,window.vault.fonti.percorsoDi))`);
    assert(!r.error,JSON.stringify(r));assert.equal(r.copiati.length,1,JSON.stringify(r));assert.equal(r.scartati.length,1,JSON.stringify(r));
    assert.match(r.scartati[0].motivo,/Simulazione|ClamAV/,'La minaccia simulata ha una motivazione');
    assert(chiamate().slice(primaImport).some(x=>x.motore==='clamscan'&&x.fase==='inizio'&&x.quanti===2),'Un solo lotto antivirus per i PDF');
    assert(/offset 0/.test(JSON.stringify(r)+' '+JSON.stringify(await c.val('window.vault.sicurezza.stato()'))),'L’avviso recuperabile qpdf resta visibile');
    const nome=r.copiati[0].nome,url=await c.val(`window.vault.srcUrl(${q(nome)},${q(id)})`);assert(url.startsWith('file:'));
    const locale=fileURLToPath(url),bytes=fs.readFileSync(locale);
    assert.equal(await c.val(`fetch(${q(url+'?prova=ammesso')}).then(r=>r.ok,()=>false)`),true,'qpdf warning non è malware');

    // La cache di estrazione deve rispettare anche le firme aggiornate successivamente.
    const fonti=await c.val(`window.vault.chat.sources(${q(id)})`),fonte=fonti.sources.find(s=>s.kind==='pdf');assert(fonte);
    const scope={mode:'selected',sourceIds:[fonte.id],wikipedia:false};
    const ricerca=await c.val(`window.vault.rag.search(${q(id)},'energia',${q(scope)})`);assert(ricerca.ok,JSON.stringify(ricerca));assert(ricerca.chunks.length>0);
    const estratti=path.join(root,'_lavorazione/rag/estratti');assert(fs.readdirSync(estratti).some(f=>f.endsWith('.json')),'Cache testo realmente prodotta');
    fs.writeFileSync(simulazione,JSON.stringify({rilevaTutto:true}));
    const firme=await c.val('window.vault.sicurezza.aggiornaFirme()');assert(firme.ok,JSON.stringify(firme));
    const nuova=await c.val(`window.vault.rag.search(${q(id)},'energia',${q(scope)})`);assert(nuova.ok,JSON.stringify(nuova));
    assert.equal(nuova.chunks.length,0,'Le nuove firme impediscono anche il riuso della cache RAG');assert.match(nuova.warnings.join(' '),/Simulazione|ClamAV/);
    fs.rmSync(simulazione,{force:true});assert((await c.val('window.vault.sicurezza.aggiornaFirme()')).ok);

    // Un file arrivato dal filesystem non ha attraversato l'importazione: serve la guardia di apertura.
    const lento=path.join(path.dirname(locale),'0999 - Documento lento.pdf');await pdf(lento,'ZAINO-PROVA-LENTO');
    const lentoUrl=pathToFileURL(lento).href,logInizio=chiamate().length;
    await c.val(`window.__sicurezzaFine=false;window.__sicurezzaEsito=null;fetch(${q(lentoUrl+'?prova=lento')}).then(r=>{window.__sicurezzaEsito=r.ok;window.__sicurezzaFine=true},()=>{window.__sicurezzaEsito=false;window.__sicurezzaFine=true});void 0`);
    const attesa=Date.now()+8000;while(!chiamate().slice(logInizio).some(x=>x.fase==='inizio'&&x.lento)&&Date.now()<attesa)await c.pausa(50);
    assert(chiamate().slice(logInizio).some(x=>x.fase==='inizio'&&x.lento),'Scanner lento avviato');
    const inizio=Date.now();const durante=await c.val('window.vault.sicurezza.stato()');assert(durante.ok);
    assert(Date.now()-inizio<1500,'Il main risponde mentre lo scanner lavora');assert.equal(await c.val('window.__sicurezzaFine'),false);
    await aspetta('window.__sicurezzaFine');assert.equal(await c.val('window.__sicurezzaEsito'),true,'La scansione lenta completa senza congelare il main');

    fs.writeFileSync(locale,Buffer.concat([bytes,Buffer.from('\n% ZAINO-PROVA-MINACCIA\n')]));
    assert.equal(await c.val(`fetch(${q(url+'?prova=modificato')}).then(()=>false,()=>true)`),true,'URL noto non aggira il controllo dopo una modifica');
    await c.val(`(async()=>{await zainiAggiorna();cambiaZaino(${q(id)},true);})()`);await aspetta(`zainoAttivo()===${q(id)}&&!ZNAV.carico`);
    await c.val(`pdfChiudiDoc();openPdf(${q(nome)},1,'Documento modificato')`);
    await aspetta(`!PDFJS.doc && /sicurezza|ClamAV|Simulazione|Non riesco|non verific/i.test(document.getElementById('pdfHost').getAttribute('data-stato')||'')`);
    for(const [f,originale] of originali)assert.deepEqual(fs.readFileSync(f),originale,'Gli originali non vengono modificati');
    console.log('✓ Sicurezza: installazione e firme, toggle persistenti, qpdf warning, blocco import/apertura, cache RAG invalidata, scanner asincrono e temi');
  } finally {
    fs.rmSync(simulazione,{force:true});
    await c.val(`window.vault.rag.watch(null)`);
    for(const motore of statoPrima.motori)await c.val(`window.vault.sicurezza.attiva(${q(motore.id)},${motore.attivo===true})`);
    await c.val(`try{document.getElementById('settingsClose').click();pdfChiudiDoc();fonte2Chiudi(true);document.getElementById('sicurezzaFiles')?.remove();}catch(_){};cambiaZaino(${q(prima.zaino)},true)`);
    if(root)fs.rmSync(root,{recursive:true,force:true});fs.rmSync(input,{recursive:true,force:true});
    await c.val(`document.documentElement.dataset.theme=${q(prima.tema)};BANCO.stato=${q(prima.banco)};BANCO.attivo=${q(prima.attivo)};bancoDisegna();localStorage.clear();Object.entries(${q(prima.locale)}).forEach(([k,v])=>localStorage.setItem(k,v));location.reload()`);
  }
  c.ws().close();
})().catch(e=>{console.error(e);if(c.ws())c.ws().close();process.exitCode=1;});
