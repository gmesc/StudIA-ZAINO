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

/** Il PDF fotografato: testo vero → PNG (sips) → PDF che contiene SOLO
 *  l'immagine. DUE pagine, e la seconda è STORTA di 3 gradi: è il caso normale
 *  di una scheda fotografata a mano, e la sola che esercita la seconda passata
 *  raddrizzata. Una pagina dritta accanto è il controllo che il raddrizzamento
 *  non si accenda dove non serve. */
async function fixture(dove) {
  const { PDFDocument, StandardFonts, rgb, degrees } =
    require(path.join(__dirname, '..', '..', 'node_modules', 'pdf-lib'));
  const W = 1240, H = 877;
  const foglio = async (frasi, gradi) => {
    const src = await PDFDocument.create();
    const f = await src.embedFont(StandardFonts.Helvetica);
    const pg = src.addPage([W, H]);
    frasi.forEach((t, i) => pg.drawText(t, { x: 60, y: H - 160 - i * 120, size: 34, font: f,
      color: rgb(0, 0, 0), rotate: degrees(gradi || 0) }));
    const p = path.join(dove, 'f' + (gradi || 0) + '.pdf');
    fs.writeFileSync(p, await src.save());
    const png = path.join(dove, 'f' + (gradi || 0) + '.png');
    execFileSync('sips', ['-s', 'format', 'png', p, '--out', png], { stdio: 'ignore' });
    return png;
  };
  const dritta = await foglio(['La memoria di lavoro ha una capienza limitata.',
    'Il carico cognitivo si gestisce, non si subisce.',
    'Una mappa concettuale è una rete di proposizioni.'], 0);
  const storta = await foglio(['La ripetizione dilazionata batte la rilettura.',
    'Il recupero attivo consolida piu della sottolineatura.',
    'Ogni richiamo riscrive la traccia in memoria.'], 3);

  const img = await PDFDocument.create();
  for (const png of [dritta, storta]) {
    const foto = await img.embedPng(fs.readFileSync(png));
    img.addPage([W / 2, H / 2]).drawImage(foto, { x: 0, y: 0, width: W / 2, height: H / 2 });
  }
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
  ok('con il conto delle pagine vuote', { vuote: 2, npagine: 2 },
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

  sezione('⚠️ La pagina STORTA: si legge, e il layer segue le righe');
  /* La seconda pagina della fixture è inclinata di 3°: sopra la soglia, quindi
     l'app deve averla riletta raddrizzata. Qui si misura l'esito — il testo
     c'è, e i glifi del layer sono inclinati come la fotografia. */
  ok('anche la pagina storta è finita nell\'indice', true,
    !!(nellIndice && nellIndice[1] && /recupero\s+attivo/i.test(nellIndice[1].text)));
  const inclinazione = await val(`(async()=>{ try{
    const pg=await PDFJS.doc.getPage(2);
    const tc=await pg.getTextContent();
    const g=tc.items.filter(i=>i.str.trim())
      .map(i=>Math.atan2(i.transform[1], i.transform[0])*180/Math.PI).sort((a,b)=>a-b);
    if(!g.length) return null;
    return { quanti:g.length, mediana:g[Math.floor(g.length/2)],
             testo:tc.items.map(i=>i.str).join(' ') };
  }catch(e){ return { errore:e.message }; } })()`, 20000);
  ok('la pagina storta ha il suo testo', true,
    !!inclinazione && /ripetizione\s+dilazionata/i.test(inclinazione.testo || ''));
  ok('e i glifi sono inclinati di ~3°, non dritti', true,
    !!inclinazione && Math.abs(inclinazione.mediana - 3) < 0.6);
  /* ⚠️ Che la SECONDA PASSATA sia avvenuta davvero non lo dice il layer
     inclinato — quello lo produrrebbe anche la sola misura della baseline. Lo
     dice il contatore: una pagina riletta girata, la storta, e non l'altra. */
  ok('la seconda passata ha girato UNA pagina, la storta', 1, await val('OCRZ.raddrizzate'));
  /* Il controllo che il raddrizzamento non si accenda dove non serve: la prima
     pagina è dritta e i suoi glifi devono restare dritti. */
  const dirittura = await val(`(async()=>{ const pg=await PDFJS.doc.getPage(1);
    const tc=await pg.getTextContent();
    const g=tc.items.filter(i=>i.str.trim())
      .map(i=>Math.abs(Math.atan2(i.transform[1], i.transform[0])*180/Math.PI));
    return g.length ? Math.max.apply(null, g) : null; })()`);
  ok('sulla pagina dritta i glifi restano dritti', true, dirittura !== null && dirittura < 0.5);

  sezione('⚠️ I rettangoli dell\'evidenza non hanno buchi fra le parole');
  /* pdf.js non scala gli span di solo spazio del textLayer: senza il rimedio
     (pdfSpaziaLayer) l'evidenza usciva a chiazze — coperta la parola, buco sul
     vuoto, coperta la prossima. Qui si evidenzia una frase di più parole e si
     pretende che i suoi rettangoli si tocchino. */
  /* si aspetta che il layer della pagina 1 sia disegnato E spaziato: misurare
     mentre il render è in volo è la trappola di sempre */
  await finoA(`(()=>{ const t=document.querySelector('#pdfFrame .page[data-page-number="1"] .textLayer');
    return t && t.querySelectorAll('span').length > 5 ? 1 : 0; })()`, 20000);
  await pausa(900);
  const buchi = await val(`(async()=>{
    const tl=document.querySelector('#pdfFrame .page[data-page-number="1"] .textLayer');
    if(!tl) return { errore:'niente textLayer' };
    const sup={ tipo:'pdf', radice:tl, salta:'', file:ANTEPRIMA.file, pagina:1 };
    const m=evMappaDi(sup);
    const fr='memoria di lavoro ha una capienza';
    const i=m.testo.indexOf(fr);
    if(i<0) return { errore:'frase non nel modello' };
    const r=rangeDaOffset(m, i, i+fr.length);
    const rects=[...r.getClientRects()].map(q=>({x:q.x,w:q.width})).filter(q=>q.w>0.5)
      .sort((a,b)=>a.x-b.x);
    const buchi=[];
    for(let k=1;k<rects.length;k++){
      const gap=rects[k].x-(rects[k-1].x+rects[k-1].w);
      if(gap>2) buchi.push(Math.round(gap));
    }
    return { rettangoli:rects.length, buchi };
  })()`);
  ok('la frase evidenziata è coperta senza chiazze', [],
    (buchi && buchi.buchi) || ['errore: '+JSON.stringify(buchi)]);

  sezione('⚠️ Una riga non ruba il puntatore a quella sopra');
  /* Sul contratto vero una riga con tre macchie della carta lette come parole
     alte tre volte il testo prendeva un corpo di due righe, copriva il titolo
     sopra e lo rendeva inselezionabile: si vedeva e non si poteva prendere
     (schermo di Giacomo). Il corpo di una riga è la mediana, e comunque mai
     più della distanza dalla riga sopra: qui si pretende che il riquadro di
     ogni span stia dentro il passo fra le righe. */
  const invadenti = await val(`(()=>{
    const tl=document.querySelector('#pdfFrame .page[data-page-number="1"] .textLayer');
    if(!tl) return { errore:'niente textLayer' };
    const box=[...tl.querySelectorAll('span')].filter(s=>s.textContent.trim())
      .map(s=>{ const r=s.getBoundingClientRect(); return { t:s.textContent.slice(0,12), y:r.y, h:r.height, b:r.y+r.height }; })
      .filter(q=>q.h>0);
    if(box.length<4) return { errore:'pochi span' };
    /* ⚠️ Le righe si RAGGRUPPANO per vicinanza, non si quantizzano: le basi di
       una riga differiscono di qualche pixel (inclinazione, discendenti), e un
       arrotondamento le conta come righe distinte a quattro pixel l'una
       dall'altra — un passo finto che boccia qualunque cosa. */
    const bs=box.map(q=>q.b).sort((a,b)=>a-b);
    const hMed=box.map(q=>q.h).sort((a,b)=>a-b)[Math.floor(box.length/2)];
    const gruppi=[[bs[0]]];
    for(let i=1;i<bs.length;i++){
      const g=gruppi[gruppi.length-1];
      if(bs[i]-g[g.length-1] <= hMed*0.6) g.push(bs[i]); else gruppi.push([bs[i]]);
    }
    const centri=gruppi.map(g=>g.reduce((a,b)=>a+b,0)/g.length);
    if(centri.length<2) return { errore:'una riga sola' };
    let passo=Infinity;
    for(let i=1;i<centri.length;i++) passo=Math.min(passo, centri[i]-centri[i-1]);
    const troppoAlti=box.filter(q=>q.h > passo*1.6).map(q=>q.t+'@'+Math.round(q.h)+'>'+Math.round(passo));
    return { passo:Math.round(passo), righe:centri.length, troppoAlti };
  })()`);
  ok('nessuno span è più alto del passo fra le righe', [],
    (invadenti && invadenti.troppoAlti) || ['errore: '+JSON.stringify(invadenti)]);

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
