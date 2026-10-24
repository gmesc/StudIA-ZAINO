'use strict';
// Le prove usano soltanto il vault e il profilo creati dal laboratorio.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const c=require('./cdp'),q=JSON.stringify;
async function aspetta(expr){for(let n=0;n<160;n++){if(await c.val(expr))return;await c.pausa(100);}throw Error('Attesa: '+expr);}
async function scegli(files){
 await c.val(`(()=>{document.getElementById('securityFiles')?.remove();const e=document.createElement('input');e.type='file';e.multiple=true;e.id='securityFiles';document.body.append(e);})()`);
 const doc=await c.invia('DOM.getDocument',{}),n=await c.invia('DOM.querySelector',{nodeId:doc.result.root.nodeId,selector:'#securityFiles'});
 const r=await c.invia('DOM.setFileInputFiles',{nodeId:n.result.nodeId,files});assert(!r.error);
}
(async()=>{
 await c.collega();await c.partiPulito();
 const v=await c.val('window.vault.vaultPath'),lab=path.dirname(v),dati=path.join(lab,'dati');
 assert(lab.includes('studia-zaino-prova-'),'solo laboratorio sintetico');
 const fuori=path.join(lab,'segreto-esterno.txt');fs.writeFileSync(fuori,'SEGRETO DA NON LEGGERE');
 const cacheEsterno=path.join(lab,'cache-esterna'),cache=path.join(dati,'tesseract-cache');fs.mkdirSync(cacheEsterno);fs.symlinkSync(cacheEsterno,cache,'dir');
 const ocr=await c.val('window.vault.ocrpdf.apri()');assert(!ocr.error,ocr.error);await c.val('window.vault.ocrpdf.chiudi()');
 assert.deepEqual(fs.readdirSync(cacheEsterno),[],'OCR senza scritture della cache fuori area');fs.unlinkSync(cache);

 assert.deepEqual(await c.val('[typeof require,typeof process]'),['undefined','undefined']);
 assert.equal((await c.val('window.vault.crediti.leggi()')).chromium,true,'licenze di sistema accessibili');
 assert.equal(await c.val(`window.vault.srcUrl('../../../segreto-esterno.txt','biologia')`),'');
 assert.equal(await c.val(`fetch(${q(pathToFileURL(fuori).href)}).then(()=>false,()=>true)`),true,'fetch fuori vault bloccato');
 assert.equal(await c.val(`fetch('https://example.org/dati').then(()=>false,()=>true)`),true,'documenti senza rete diretta');
 assert.equal((await c.val(`window.vault.fonti.importa('biologia',[${q(fuori)}])`)).ok,false,'path senza selezione non autorizzato');
 const creato=await c.val(`window.vault.zaino.create('Sicurezza')`);assert(!creato.error,JSON.stringify(creato));
 const id=creato.id,root=path.join(v,'Zaini',id),note=path.join(root,'APPUNTI');
 fs.symlinkSync(fuori,path.join(note,'intruso.md'));
 const read=await c.val(`window.vault.notes.leggi(${q(id)})`);assert(!JSON.stringify(read).includes('SEGRETO DA NON LEGGERE'));
 const write=await c.val(`window.vault.notes.save(${q(id)},'intruso.md',{title:'Intruso'},'NON SCRIVERE')`);assert(write.error);
 assert.equal(fs.readFileSync(fuori,'utf8'),'SEGRETO DA NON LEGGERE');fs.unlinkSync(path.join(note,'intruso.md'));
 const source=path.join(lab,'Documento.pdf'),falso=path.join(lab,'Falso.pdf'),script=path.join(lab,'script.js');
 const {PDFDocument,PDFName,PDFString}=require('pdf-lib');const pdf=await PDFDocument.create();pdf.addPage().drawText('Documento di prova: JavaScript disattivato.',{x:40,y:700,size:16});
 pdf.catalog.set(PDFName.of('OpenAction'),pdf.context.obj({S:PDFName.of('JavaScript'),JS:PDFString.of('globalThis.__pdfEseguito=true;')}));
 const bytes=await pdf.save();fs.writeFileSync(source,bytes);fs.writeFileSync(falso,'<html><script>alert(1)</script></html>');fs.writeFileSync(script,'console.log("non eseguire")');
 await scegli([source,falso,script]);
 const validati=await c.val(`Array.from(document.getElementById('securityFiles').files,f=>window.vault.fonti.verifica(f))`);
 assert.deepEqual(validati.map(r=>r.ok),[true,false,false]);
 const importati=await c.val(`window.vault.fonti.importa(${q(id)},Array.from(document.getElementById('securityFiles').files,window.vault.fonti.percorsoDi))`);
 assert(!importati.error,JSON.stringify(importati));assert.equal(importati.copiati.length,1);assert.equal(importati.scartati.length,2);
 assert.deepEqual(fs.readFileSync(source),Buffer.from(bytes),'originale invariato');
 const nome=importati.copiati[0].nome,src=await c.val(`window.vault.srcUrl(${q(nome)},${q(id)})`);assert(src.startsWith('file:'));
 assert.equal(await c.val(`fetch(${q(src)}).then(r=>r.ok,()=>false)`),true,'PDF valido leggibile');
 // Lo script è davvero nel documento, ma il viewer deve mostrare solo la pagina.
 await c.val(`(async()=>{await zainiAggiorna();cambiaZaino(${q(id)},true);})()`);
 await aspetta(`zainoAttivo()===${q(id)} && !ZNAV.carico`);
 await c.val(`openPdf(${q(nome)},1,'Documento di prova')`);
 await aspetta(`PDFJS.doc && document.querySelector('#pdfFrame .textLayer')?.textContent.includes('JavaScript disattivato') && document.querySelector('#pdfFrame canvas')?.width>0`);
 assert.equal(await c.val(`typeof globalThis.__pdfEseguito`),'undefined','OpenAction non eseguita');
 assert(await c.val(`PDFJS.doc.getJSActions().then(a=>JSON.stringify(a).includes('__pdfEseguito'))`),'fixture con JavaScript reale');
 assert.equal(await c.val(`PDFJS.viewer.scriptingManager==null`),true);
 assert(await c.val(`(()=>{const e=document.querySelector('#pdfFrame canvas'),d=e.getContext('2d').getImageData(0,0,e.width,e.height).data;for(let i=0;i<d.length;i+=4)if(d[i]<80&&d[i+1]<80&&d[i+2]<80&&d[i+3]>0)return true;return false;})()`),'pagina realmente disegnata');
 const shot=await c.invia('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/private/tmp/zaino-sicurezza-pdf.png',Buffer.from(shot.result.data,'base64'));
 await c.val(`pdfChiudiDoc();cambiaZaino('biologia',true)`);await aspetta(`zainoAttivo()==='biologia' && !ZNAV.carico`);
 const locale=path.join(root,'MATERIALI/PDF',nome);fs.writeFileSync(locale,'<html>alterato dopo importazione</html>');
 assert.equal(await c.val(`window.vault.srcUrl(${q(nome)},${q(id)})`),'','firma ricontrollata all’apertura');
 assert.equal(await c.val(`fetch(${q(src)}).then(()=>false,()=>true)`),true,'URL già conosciuto non aggira verifica');fs.writeFileSync(locale,bytes);
 const origine=await c.val('location.href');
 await c.val(`window.open('file:///etc/passwd','_blank');window.open('data:text/html,<script>1</script>','_blank');location.href='file:///etc/passwd'`);
 await c.pausa(300);assert.equal(await c.val('location.href'),origine);
 const t=await (await fetch('http://127.0.0.1:'+process.env.STUDIA_PORTA+'/json')).json();assert.equal(t.filter(x=>x.type==='page').length,1,'nessuna finestra alternativa');
 // La prova sostituisce il dialogo nativo nel main, mai la policy di produzione.
 const exportPath=path.join(lab,'Documento esportato.pdf'),scorciatoia=path.join(lab,'NON-autorizzato.pdf');
 fs.writeFileSync(path.join(dati,'dialogo-salvataggio.json'),JSON.stringify({filePath:exportPath}));
 const stampato=await c.val(`window.vault.stampa.pdf({html:'<!doctype html><html><body>Documento stampato<script>throw new Error("non eseguire")</script></body></html>',nome:'Prova',percorso:${q(scorciatoia)}})`);
 assert(stampato.ok,JSON.stringify(stampato));assert(fs.readFileSync(exportPath).subarray(0,5).equals(Buffer.from('%PDF-')));assert(!fs.existsSync(scorciatoia));
 fs.writeFileSync(path.join(dati,'dialogo-salvataggio.json'),JSON.stringify({canceled:true}));
 assert((await c.val(`window.vault.crediti.notice(${q(path.join(lab,'NON-autorizzato.txt'))})`)).annullato);
 const prefs=fs.readFileSync(path.join(dati,'finestre-sicurezza.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
 assert(prefs.filter(x=>x.preload).every(x=>x.sandbox&&x.contextIsolation&&!x.nodeIntegration),'renderer principale sandbox');
 await c.val(`document.getElementById('securityFiles')?.remove()`);
 fs.rmSync(root,{recursive:true,force:true});await c.val('zainiAggiorna()');await c.partiPulito();
 console.log('OK: sandbox, PDF leggibile senza script, file selezionati, firme, symlink, niente rete/file fuori vault, popup e export solo da dialogo.');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
