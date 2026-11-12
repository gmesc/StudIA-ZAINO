'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),c=require('./cdp'),q=JSON.stringify;
async function wait(e){for(let i=0;i<200;i++){if(await c.val(e))return;await c.pausa(80);}throw Error('Attesa: '+e+' '+JSON.stringify(await c.val("FontiMultipli.tutti().map(c=>({id:c.id,doc:!!c.stato.doc,pronto:c.stato.pronto,file:c.stato.file,size:document.getElementById(c.prefisso+'Frame').getBoundingClientRect().toJSON(),testi:document.getElementById(c.prefisso+'Frame').querySelectorAll('.textLayer span').length}))")));}
(async()=>{await c.collega();c.ws().on('message',s=>{const e=JSON.parse(s);if(e.method==='Runtime.consoleAPICalled'&&e.params.type==='error')console.log(JSON.stringify(e.params));if(e.method==='Runtime.exceptionThrown')console.log(JSON.stringify(e.params));});await c.invia('Runtime.enable');await wait("typeof FontiMultipli!=='undefined'&&zainoAttivo()==='biologia'");A((await c.val('vault.path')).includes('studia-zaino-prova-'));await c.partiPulito();const prima=await c.val('({banco:bancoStato(),memoria:{...localStorage},vault:vault.path,evidenze:vault.evidenze.leggi(corsoAttivo()).evidenze.map(e=>e.id)})');
 const registro=path.join(prima.vault,'Zaini/biologia/APPUNTI/_annotazioni-pdf'),segniPrima=new Map((fs.existsSync(registro)?fs.readdirSync(registro):[]).map(n=>[n,fs.readFileSync(path.join(registro,n))]));
 try{
 await c.val(`BancoForme.registraForma('mia-prova-nove','Nove','"A C E" "B D F" "G H I"');bancoFormePersonaliScrivi([...bancoFormePersonali(),{chiave:'mia-prova-nove',nome:'Nove',aree:'\"A C E\" \"B D F\" \"G H I\"'}]);bancoForma('mia-prova-nove');bancoBlocchiVisibili().forEach(b=>bancoAssegnaDaMenu(b,'fonte'));openPdf('01 Botanica.pdf',1,'Botanica',true);fonte2Apri('02 Biologia cellulare.pdf',{ripristina:true});Promise.all(FontiMultipli.tutti().map((c,i)=>c.apri(i%2?'02 Biologia cellulare.pdf':'01 Botanica.pdf',{ripristina:true})))`);
 A.equal(await c.val("BancoMateriali.istanze('fonte').filter(bancoVisibile).length"),9);
 await wait("FontiMultipli.tutti().every(c=>c.stato.doc&&document.querySelector('#'+c.prefisso+'Frame .textLayer span'))");
 for(let n=3;n<=9;n++){
  const prefix='#pdf'+n;
  A(await c.val(`(()=>{const p=document.getElementById('pdfPane${n}');return p.closest('.bcorpo')&&p.querySelector('[data-pdf-annota]')&&!p.querySelector('[data-pdf-annota]').disabled&&document.getElementById('pdf${n}Doc').closest('.bhead');})()`),'toolbar e selettore del banco '+n);
  await c.clicca(prefix+'Next');A.equal(await c.val(`FontiMultipli.get('fonte${n}').stato.page`),2);
 }
 A.equal(await c.val('ANTEPRIMA.page'),1);A.equal(await c.val('FONTE2.page'),1);
 await c.val("bancoZoom(bancoBloccoDi('fonte3'))");await c.pausa(200);
 await c.clicca('#pdf3RighelloBtn');A(await c.val("FontiMultipli.get('fonte3').stato.righello.acceso&&!FontiMultipli.get('fonte4').stato.righello.acceso"));await c.clicca('#pdf3RighelloBtn');
 await c.clicca('#pdf3FindBtn');await c.invia('Input.insertText',{text:'Botanica'});await wait("PDFFIND.seconda==='fonte3'&&document.getElementById('pdfFindCount').textContent.includes('di 3')");await c.clicca('#pdfFindClose');
 await c.val(`(()=>{const n=document.querySelector('#pdf3Frame .page[data-page-number="2"] .textLayer span').firstChild,r=document.createRange();r.setStart(n,0);r.setEnd(n,8);evidenzia(r,'#ef4444');})()`);A.equal(await c.val("EVIDENZE.elenco.find(e=>e.exact==='Botanica')?.materiale"),'01 Botanica.pdf');
 await c.clicca('#pdfPane3 [data-pdf-annota]');await c.clicca('#pdfPane3 [data-tool=freccia]');await wait("!!document.querySelector('#pdf3Frame .pdf-segni')");
 await c.val("FontiMultipli.get('fonte3').stato.viewer.currentPageNumber=2");await c.pausa(150);
 const r=await c.val("document.querySelector('#pdf3Frame .page[data-page-number=\"2\"] .pdf-segni').getBoundingClientRect().toJSON()");
 for(const [type,x,y]of [['mousePressed',r.x+70,r.y+80],['mouseMoved',r.x+170,r.y+160],['mouseReleased',r.x+170,r.y+160]])await c.invia('Input.dispatchMouseEvent',{type,x,y,button:'left',buttons:type==='mouseReleased'?0:1,clickCount:1});
 await wait("!!document.querySelector('#pdf3Frame [data-segno]')");A.equal(await c.val("document.querySelectorAll('#pdf4Frame [data-segno]').length"),0,'annotazione non passa a un altro PDF');
 await c.val('bancoZoomTorna()');await c.pausa(150);await c.val("bancoZoom(bancoBloccoDi('fonte3'))");await wait("!!document.querySelector('#pdf3Frame [data-segno]')");await c.val('bancoZoomTorna()');
 fs.writeFileSync('/private/tmp/zaino-fonti-nove.png',Buffer.from((await c.invia('Page.captureScreenshot',{format:'png'})).result.data,'base64'));
 const before=await c.val("FontiMultipli.tutti().map(c=>({id:c.id,file:c.stato.file,page:c.stato.page}))");await c.val('window.__primaRicarica=true');await c.invia('Page.reload');await wait("!window.__primaRicarica&&typeof FontiMultipli!=='undefined'&&FontiMultipli.tutti().every(c=>c.stato.doc&&!c.stato.caricando)");A.equal(await c.val("BancoMateriali.istanze('fonte').filter(bancoVisibile).length"),9,'nove banchi ripristinati al riavvio');A.deepEqual(await c.val("FontiMultipli.tutti().map(c=>({id:c.id,file:c.stato.file,page:c.stato.page}))"),before);
 }finally{await c.val(`(()=>{FontiMultipli.tutti().forEach(c=>c.chiudi());fonte2Chiudi();closePdf();for(const e of vault.evidenze.leggi(corsoAttivo()).evidenze)if(!${q(prima.evidenze)}.includes(e.id))vault.evidenze.rimuovi(corsoAttivo(),e.id);evidenzeCarica();evidenzeDisegna();localStorage.clear();for(const[k,v]of Object.entries(${q(prima.memoria)}))localStorage.setItem(k,v);BANCO.stato=${q(prima.banco)};bancoDisegna();})()`);
  // Il PDF sintetico è condiviso con la prova successiva: anche i segni sul disco vanno ripristinati.
  if(fs.existsSync(registro))for(const n of fs.readdirSync(registro))if(!segniPrima.has(n))fs.rmSync(path.join(registro,n));
  for(const[n,bytes]of segniPrima)fs.writeFileSync(path.join(registro,n),bytes);
  // La cache delle revisioni appartiene al renderer: dopo il ripristino del disco si rilegge da zero.
  await c.val('window.__ripristinoFontiMultipli=true');await c.invia('Page.reload');await wait("!window.__ripristinoFontiMultipli&&typeof FontiMultipli!=='undefined'&&zainoAttivo()==='biologia'");
 }
 console.log('✓ nove Fonti: scelta dai menu, toolbar completa, pagine, ricerca, righello, sottolineature, Annota, ritorno e ripristino');c.ws().close();
})().catch(e=>{console.error(e);c.ws()?.close();process.exitCode=1;});
