'use strict';
// Ricetta autonoma: soltanto PDF e appunti dimostrativi nel laboratorio isolato.
const L=require('./lab'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {PDFDocument,StandardFonts}=require('pdf-lib');
(async()=>{
 await L.collega();const vault=process.env.GUIDA_VAULT;
 assert(vault&&fs.realpathSync(vault).startsWith('/private/tmp/studia-guida-'));
 assert.equal(await L.val('window.vault.path'),vault);
 const Z=require('../../../lib/zaini');
 for(const titolo of ['Biologia','Storia'])if(!Z.esiste(vault,titolo.toLowerCase()))Z.crea(vault,titolo);
 const pdfDir=path.join(vault,'Zaini/biologia/MATERIALI/PDF');fs.mkdirSync(pdfDir,{recursive:true});
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
 for(let n=1;n<=3;n++){
  const p=doc.addPage([595,842]);p.drawText('BOTANICA',{x:42,y:775,size:12,font:bold});
  p.drawText(n===2?'La fotosintesi':'Le piante e il loro ambiente',{x:42,y:725,size:24,font:bold});
  for(const [i,t] of ['Le piante trasformano la luce del Sole in energia chimica.','La clorofilla assorbe la luce nelle foglie.','Acqua e anidride carbonica contribuiscono a formare zuccheri.','Il processo libera ossigeno nell’ambiente.'].entries())p.drawText(t,{x:42,y:680-i*26,size:13,font});
  p.drawText(String(n),{x:288,y:38,size:11,font});
 }
 fs.writeFileSync(path.join(pdfDir,'01 Botanica.pdf'),await doc.save());
 await L.pulito();await L.invia('Emulation.setDeviceMetricsOverride',{width:1470,height:956,deviceScaleFactor:2,mobile:false});
 await L.val(`bancoZoomTorna();cambiaZaino('biologia',true);document.documentElement.dataset.theme='chiaro';zainiAggiorna()`);
 await L.clicca('#zainoScegli');assert(await L.finoA(`!!document.querySelector('#zainiMenu[open] .zaini-voce')`));await L.muovi(1450,940);
 await L.scatta('08-tendina-zaini',{sel:'#zainiMenu',scala:2});await L.pulito();
 const cita=await L.val(`window.vault.citazioni.crea('biologia','01 Botanica.pdf',2,'Le piante trasformano la luce del Sole in energia chimica.')`);assert(cita.markdown);
 await L.val(`cambiaZaino('storia',true);bancoForma('uno');bancoAssegna('A','appunti')`);
 const nota=await L.val(`notesApi().save('storia',null,{title:'Piante e civiltà'},${JSON.stringify('## Le piante nella vita quotidiana\n\n'+cita.markdown)})`);assert(nota.file);
 await L.val(`notesReload();noteOpen(${JSON.stringify(nota.file)},NOTES)`);assert(await L.finoA(`!!NOTES.cur`));
 await L.val(`apriMateriali(document.querySelector('#noteHost .ncb-mat'),NOTES)`);
 await L.val(`document.getElementById('matZaino').value='biologia';document.getElementById('matZaino').dispatchEvent(new Event('change',{bubbles:true}))`);
 assert(await L.finoA(`!!document.querySelector('#matLista [data-mat="01 Botanica.pdf"]')`));await L.muovi(1450,940);
 await L.scatta('59-cita-materiale',{sel:'#matPop',scala:2});await L.pulito();
 await L.val(`citazioneZainoApri(${JSON.stringify(cita.rimando)})`);
 assert(await L.finoA(`document.getElementById('citazioneConto').textContent==='2 DI 3'&&!!document.querySelector('#citazionePagine .page[data-page-number="2"] canvas')`));
 await L.pausa(600);
 await L.val(`(()=>{const el=[...document.querySelectorAll('#citazionePagine .page[data-page-number="2"] .textLayer span')].find(e=>e.textContent.startsWith('Le piante trasformano')),r=document.createRange();r.selectNodeContents(el);getSelection().removeAllRanges();getSelection().addRange(r);const b=r.getBoundingClientRect();el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0,clientX:b.x+4,clientY:b.y+4}));})()`);
 assert(await L.finoA(`!!document.querySelector('#selBarra.aperta [data-az="inserisci-citazione"]:not([disabled])')`));
 assert.deepEqual(await L.val(`[...document.querySelectorAll('#selBarra .ctx-item')].map(b=>b.textContent)`),['Copia','Cita dalla pagina']);
 await L.muovi(1450,940);await L.scatta('211-citazione-zaino',{scala:1});
 await L.clicca('#citazioneChiudi');assert.equal(await L.val('zainoAttivo()'),'storia');
 console.log('Menu zaini, selettore della fonte e anteprima della citazione acquisiti.');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
