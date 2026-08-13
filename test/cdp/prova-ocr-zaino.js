/* Il testo dentro le fotografie, provato sull'app viva.
 *
 * Il percorso intero di un documento fotografato, come lo farebbe uno studente:
 *
 *  1. un PDF di sole immagini entra nello zaino e l'INDICE lo dichiara
 *     scansione (la soglia sta in lib/ocr, il renderer riceve il verdetto);
 *  2. con il documento aperto compare il bottone Aa↗ — e su un nativo no;
 *  3. `ocrRiconosci` fa tutto il giro — rasterizza, riconosce, scrive il layer,
 *     reindicizza — e alla fine il testo SI LEGGE dal visualizzatore, che è la
 *     promessa su cui poggiano evidenze e lente;
 *  4. dopo, il documento non è più una scansione, l'indice ricorda l'OCR, il
 *     bottone si spegne — e ritrascinare l'originale non crea il doppione.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-ocr-zaino.js
 *
 * ⚠️ La fixture si costruisce QUI (pdf-lib + sips): un PDF fotografato vero nel
 * vault di prova sarebbe mezzo megabyte di binario in git per niente.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const S = path.join(__dirname, 'cdp.js');
const { collega, val, pausa, partiPulito } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

async function finoA(expr, quanto) {
  const fine = Date.now() + (quanto || 15000);
  for (;;) {
    const v = await val(expr);
    if (v) return v;
    if (Date.now() > fine) return null;
    await pausa(250);
  }
}

const ZAINO = 'zaino-ocr';

/** Il PDF fotografato: testo vero → PNG (sips) → PDF che contiene SOLO l'immagine. */
async function fixture(dove) {
  const { PDFDocument, StandardFonts, rgb } = require(path.join(__dirname, '..', '..', 'node_modules', 'pdf-lib'));
  const W = 1240, H = 877;
  const src = await PDFDocument.create();
  const f = await src.embedFont(StandardFonts.Helvetica);
  const pg = src.addPage([W, H]);
  ['La memoria di lavoro ha una capienza limitata.',
   'Il carico cognitivo si gestisce, non si subisce.',
   'Una mappa concettuale è una rete di proposizioni.'
  ].forEach((t, i) => pg.drawText(t, { x: 60, y: H - 140 - i * 110, size: 34, font: f, color: rgb(0, 0, 0) }));
  const pdfTesto = path.join(dove, 'testo.pdf');
  fs.writeFileSync(pdfTesto, await src.save());
  const png = path.join(dove, 'scan.png');
  execFileSync('sips', ['-s', 'format', 'png', pdfTesto, '--out', png], { stdio: 'ignore' });
  const img = await PDFDocument.create();
  const foto = await img.embedPng(fs.readFileSync(png));
  img.addPage([W / 2, H / 2]).drawImage(foto, { x: 0, y: 0, width: W / 2, height: H / 2 });
  const fuori = path.join(dove, 'scheda fotografata.pdf');
  fs.writeFileSync(fuori, await img.save());
  return fuori;
}

(async () => {
  await collega();
  await val('location.reload(), 1'); await pausa(2000);
  await collega(); await pausa(800);
  await partiPulito();

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'studia-prova-ocr-'));
  const originale = await fixture(tmp);

  sezione('Il PDF fotografato entra, e l\'indice lo dichiara scansione');
  await val(`(async()=>{ await cambiaModo('zaino'); await zainoCrea('Zaino OCR'); return 1; })()`);
  await finoA(`zainoAttivo()==='${ZAINO}' ? 1 : 0`, 10000);
  const dentro = await val(`window.vault.fonti.importa('${ZAINO}', [${JSON.stringify(originale)}])`);
  ok('il documento è entrato', 1, (dentro.copiati || []).length);
  const nome = dentro.copiati[0].nome;
  const indice = await val(`fontiIndicizza(${JSON.stringify(nome)})`);
  ok('l\'esito dell\'indicizzazione porta il verdetto', true, !!indice.scansione);
  ok('con il conto delle pagine vuote', { vuote: 1, npagine: 1 },
    { vuote: indice.pagineVuote, npagine: indice.npagine });
  await val('fontiIndiciCarica()'); await pausa(400);

  sezione('Il bottone Aa↗: acceso sulla scansione, spento altrove');
  await val(`zainoNavAggiorna(), openPdf(${JSON.stringify(nome)}, null, 'Scheda'), 1`);
  await finoA(`(PDFJS.doc && PDFJS.doc.numPages) || 0`, 25000);
  await pausa(600);
  ok('sul documento fotografato il bottone c\'è', true,
    await val(`(()=>{ const b=document.getElementById('pdfOcr'); return !!b && !b.hidden; })()`));

  sezione('Il giro intero: riconosci, scrivi, rileggi');
  await val(`(window.__ocrFatto=0), ocrRiconosci(${JSON.stringify(nome)}).then(()=>{ window.__ocrFatto=1; }), 1`);
  const fatto = await finoA('window.__ocrFatto', 90000);
  ok('il riconoscimento è arrivato in fondo', 1, fatto);
  /* Il visualizzatore si sta riaprendo sul file nuovo: si ASPETTA il testo,
     non si legge al volo — `PDFJS.doc` resta quello vecchio finché la ricarica
     non è atterrata, ed è la trappola «misurare col disegno in volo». */
  const testo = await finoA(`(async()=>{ try{
    if(!PDFJS.doc) return '';
    const pg=await PDFJS.doc.getPage(1);
    const tc=await pg.getTextContent();
    const t=tc.items.map(i=>i.str).join(' ');
    return /memoria/i.test(t) ? t : '';
  }catch(e){ return ''; } })()`, 25000);
  /* le parole del layer tornano un item ciascuna: fra loro c'è più di uno spazio */
  ok('il testo si legge dal visualizzatore', true, /memoria\s+di\s+lavoro/i.test(testo || ''));
  ok('accenti compresi', true, /capienza\s+limitata/.test(testo || ''));
  /* E sta anche nell'indice, che è quello che la lente cerca. */
  const nellIndice = await val(`(FONTI.indici.filter(d=>d.pdf===${JSON.stringify(nome)})[0]||{}).pagine`);
  ok('il testo sta nell\'indice della lente', true,
    !!(nellIndice && nellIndice[0] && /carico cognitivo/i.test(nellIndice[0].text)));

  sezione('Dopo: non è più una scansione, e il doppione non entra');
  await val('fontiIndiciCarica()'); await pausa(400);
  const doc = await val(`FONTI.indici.filter(d=>d.pdf===${JSON.stringify(nome)})[0]`);
  ok('l\'indice non lo dice più scansione', false, !!(doc && doc.scansione));
  /* niente pagine rimaste = niente da finire: il bottone non deve riproporre
     un lavoro completo (ocrDaFinire esiste per i «ferma» a metà) */
  ok('non restano pagine da riconoscere', 0, (doc && doc.daRiconoscere || []).length);
  ok('e niente da finire', false, !!(doc && doc.ocrDaFinire));
  ok('e ricorda chi ha riconosciuto', 'tesseract.js', doc && doc.ocr && doc.ocr.motore);
  ok('con l\'impronta di prima', true, !!(doc && doc.ocr && doc.ocr.improntaOriginale));
  await pausa(400);
  ok('il bottone Aa↗ si è spento', true,
    await val(`(()=>{ const b=document.getElementById('pdfOcr'); return !!b && b.hidden; })()`));
  const ancora = await val(`window.vault.fonti.importa('${ZAINO}', [${JSON.stringify(originale)}])`);
  ok('ritrascinare l\'originale non crea il doppione', 0, (ancora.copiati || []).length);
  ok('e il motivo nomina il documento che c\'è già', true,
    !!(ancora.scartati && ancora.scartati[0] && ancora.scartati[0].motivo.indexOf(nome) >= 0));

  /* ⚠️ Si esce tornando al CORSO: le prove del ripasso che seguono leggono
     `LESSON` e il quiz, e una modalità zaino lasciata accesa le fa morire con
     «nessun capitolo con quiz» — successo alla prima corsa intera di questa
     suite. Ogni prova che cambia modo lo rimette a posto. */
  await val(`cambiaModo('corso')`); await pausa(600);

  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* temporanea */ }
  console.log('');
  console.log(ko ? `✗ ${ko} controlli falliti` : '✓ prova-ocr-zaino: tutto verde');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('la prova è morta:', e.message); process.exit(1); });
