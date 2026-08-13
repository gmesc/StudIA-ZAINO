'use strict';
/**
 * Il testo dentro le fotografie (lib/ocrpdf.js + lib/ocr.eScansione).
 *
 * Quattro promesse:
 *  1. un PDF fotografato SI RICONOSCE come tale (`eScansione`), e uno nativo no;
 *  2. Tesseract restituisce le parole con i loro riquadri, e il layer scritto
 *     da `scriviLayer` si RILEGGE con pdf.js — lo stesso lettore dell'app —
 *     alle stesse posizioni (è la promessa su cui poggiano le evidenze);
 *  3. quello che va storto NON tocca il documento: un PDF illeggibile o un
 *     riconoscimento vuoto lasciano il file com'era, e lo dicono;
 *  4. dopo il riconoscimento l'indice ricorda l'OCR (`ocr.improntaOriginale`),
 *     la riscrittura non lo dimentica, e ritrascinare l'originale non crea
 *     il doppione.
 *
 *   node test/ocrpdf.js
 *
 * ⚠️ La prova rasterizza con `sips` (c'è su ogni macOS) e riconosce DAVVERO con
 * tesseract.js: qualche secondo, una volta. Un finto motore proverebbe solo il
 * codice che non si può sbagliare.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const O = require('../lib/ocrpdf');
const OCR = require('../lib/ocr');
const F = require('../lib/fonti');
const Z = require('../lib/zaini');

let ko = 0, ok = 0;
function check(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { ok++; return; }
  ko++;
  console.log('  ✗ ' + nome + '\n      atteso: ' + a + '\n      avuto:  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

const QUI = fs.mkdtempSync(path.join(os.tmpdir(), 'studia-ocrpdf-'));
const LINGUE = path.join(__dirname, '..', 'App', 'assets', 'tesseract');

sezione('Che cosa è una scansione (eScansione)');
{
  const s = (n) => ({ page: n, text: '' });
  const t = (n) => ({ page: n, text: 'x'.repeat(400) });
  check('un documento senza testo lo è', true, OCR.eScansione([s(1), s(2), s(3)]).scansione);
  check('uno pieno di testo no', false, OCR.eScansione([t(1), t(2), t(3)]).scansione);
  check('metà esatta non basta: serve la maggioranza', false, OCR.eScansione([s(1), t(2)]).scansione);
  check('due su tre sì', true, OCR.eScansione([s(1), s(2), t(3)]).scansione);
  check('il conto si dà, non solo il verdetto — e l\'elenco delle pagine da leggere',
    { scansione: true, pagineVuote: 2, npagine: 3, daRiconoscere: [1, 2] },
    OCR.eScansione([s(1), s(2), t(3)]));
  /* l'elenco è ciò che un riconoscimento fermato riprende in mano: le pagine
     con testo NON ci stanno, o riceverebbero un secondo layer sopra il primo */
  check('una pagina già piena non si rilegge', [2, 5],
    OCR.eScansione([t(1), s(2), t(3), t(4), s(5)]).daRiconoscere);
  check('vuoto non è una scansione', false, OCR.eScansione([]).scansione);
  check('e nemmeno un non-elenco', { scansione: false, pagineVuote: 0, npagine: 0, daRiconoscere: [] }, OCR.eScansione(null));
  /* gli spazi non sono testo: una pagina di soli a-capo è vuota */
  check('una pagina di soli spazi è vuota', 1, OCR.eScansione([{ page: 1, text: ' \n \t '.repeat(200) }]).pagineVuote);
}

/* ⚠️ La geometria delle righe storte si prova QUI, senza motore e senza PDF:
   sono formule, e una formula sbagliata scoperta dentro una prova che dura
   trenta secondi costa trenta secondi ogni volta. La convenzione — spazio
   immagine, y verso il basso, positivo = riga che SCENDE a destra — è
   dichiarata in lib/ocrpdf e va provata, non ricordata. */
sezione('L\'inclinazione: gradi, mediana, soglie');
{
  const bl = (x0, y0, x1, y1) => ({ x0, y0, x1, y1 });
  check('una riga orizzontale è a zero gradi', 0, O.angoloBaseline(bl(10, 100, 400, 100)));
  check('una che SCENDE a destra è positiva', true, O.angoloBaseline(bl(10, 100, 400, 120)) > 0);
  check('una che sale a destra è negativa', true, O.angoloBaseline(bl(10, 120, 400, 100)) < 0);
  check('e il valore è quello vero (45°)', 45, Math.round(O.angoloBaseline(bl(0, 0, 100, 100))));
  /* una baseline corta misura il rumore, non l'inclinazione */
  check('una riga troppo corta non vota', null, O.angoloBaseline(bl(10, 100, 45, 103)));
  check('e nemmeno una riga che non c\'è', null, O.angoloBaseline(null));

  check('la mediana ignora l\'intestazione storta per conto suo', 2, O.mediana([2, 2, 2, 30]));
  check('con un numero pari di righe sta in mezzo', 2.5, O.mediana([2, 3]));
  check('senza righe è zero', 0, O.mediana([]));

  const p0 = O.pianoRaddrizzamento(0.4, 1000, 800);
  check('mezzo grado non vale una seconda passata', false, p0.daRaddrizzare);
  const p1 = O.pianoRaddrizzamento(3, 1000, 800);
  check('tre gradi sì', true, p1.daRaddrizzare);
  check('e si gira dell\'OPPOSTO, per toglierla', true, p1.radianti < 0);
  /* la tela cresce, o gli angoli del foglio uscirebbero dal bordo */
  check('la tela ruotata è più grande dell\'originale', true,
    p1.larghezzaRuotataPx > 1000 && p1.altezzaRuotataPx > 800);
  check('venti gradi non sono una foto storta', false, O.pianoRaddrizzamento(20, 1000, 800).daRaddrizzare);
  check('e nemmeno una pagina senza misure', false, O.pianoRaddrizzamento(3, 0, 0).daRaddrizzare);

  /* andata e ritorno: se l'inversa non è l'inversa, ogni parola di una pagina
     raddrizzata finisce in un punto sbagliato — e nessuno se ne accorgerebbe
     leggendo il codice */
  const r = O.pianoRaddrizzamento(3, 1000, 800);
  let peggio = 0;
  for (const q of [[0, 0], [999, 0], [500, 400], [123, 777], [1000, 800]]) {
    const a = O.aRuotato(q[0], q[1], r);
    const b = O.daRuotato(a.x, a.y, r);
    peggio = Math.max(peggio, Math.abs(b.x - q[0]), Math.abs(b.y - q[1]));
  }
  check('andata e ritorno riportano al punto di partenza', true, peggio < 0.0001);

  /* e la parola riportata indietro porta l'inclinazione della FOTO, non zero */
  const riportate = O.riportaParole(
    [{ testo: 'x', x0: 100, x1: 160, base: 200, rigaAlto: 20, angoloRiga: 0 }], r);
  check('la larghezza sopravvive alla rotazione', 60, riportate[0].largPx);
  check('e l\'altezza pure', 20, riportate[0].altoPx);
  check('mentre il glifo si inclina di quanto la foto è storta', 3, riportate[0].angoloRiga);
}

async function conMotore() {
  /* ------------------------------------------------------------------ fixture
     Un PDF con testo vero → PNG con sips (1 pt = 1 px) → PDF di sola immagine,
     pagina a metà misura (scala 2 px/pt): è la forma di una scheda fotografata. */
  const { PDFDocument, StandardFonts, rgb, degrees } = require('pdf-lib');
  const W = 1240, H = 877, SCALA = 2;
  const FRASI = [
    'La fotosintesi clorofilliana avviene nei cloroplasti.',
    'La velocità della luce è costante nel vuoto.',
    'Il sistema nervoso centrale comprende encefalo e midollo.'
  ];
  const src = await PDFDocument.create();
  const fnt = await src.embedFont(StandardFonts.Helvetica);
  const pg = src.addPage([W, H]);
  FRASI.forEach((f, i) => pg.drawText(f, { x: 60, y: H - 140 - i * 110, size: 34, font: fnt, color: rgb(0, 0, 0) }));
  const pdfTesto = path.join(QUI, 'testo.pdf');
  fs.writeFileSync(pdfTesto, await src.save());
  const png = path.join(QUI, 'scan.png');
  execFileSync('sips', ['-s', 'format', 'png', pdfTesto, '--out', png], { stdio: 'ignore' });

  const img = await PDFDocument.create();
  const foto = await img.embedPng(fs.readFileSync(png));
  const pagina = img.addPage([W / SCALA, H / SCALA]);
  pagina.drawImage(foto, { x: 0, y: 0, width: W / SCALA, height: H / SCALA });
  const pdfFoto = path.join(QUI, 'foto.pdf');
  fs.writeFileSync(pdfFoto, await img.save());

  sezione('Il riconoscimento: parole con i loro riquadri');
  const apertura = await O.apri(LINGUE, path.join(QUI, 'cache'));
  check('il motore parte con le lingue vendorizzate', '', apertura.error);
  const r = await O.riconosci(fs.readFileSync(png));
  check('senza errori', '', r.error);
  check('legge almeno 20 parole', true, r.parole.length >= 20);
  const attese = FRASI.join(' ').split(' ').length;
  check('circa quante ce ne sono davvero (±3)', true, Math.abs(r.parole.length - attese) <= 3);
  const veloc = r.parole.find((p) => /velocit/i.test(p.testo));
  check('gli accenti sopravvivono al riconoscimento', true, !!veloc && /velocità/.test(veloc.testo));
  check('ogni parola ha il suo riquadro', true,
    r.parole.every((p) => p.x1 > p.x0 && p.y1 > p.y0 && Number.isFinite(p.base)));
  /* il corpo del glifo si taglia sull'altezza della RIGA: due parole della
     stessa riga — con e senza aste — devono portare la stessa misura */
  check('e l\'altezza della sua riga', true,
    r.parole.every((p) => Number.isFinite(p.rigaAlto) && p.rigaAlto >= (p.y1 - p.y0) - 1));

  sezione('Il layer: si scrive, si rilegge, sta al posto giusto');
  /* la copia com'era PRIMA del layer: è il file che l'utente ha in casa sua,
     e che più avanti proverà a ritrascinare */
  const originale = path.join(QUI, 'originale.pdf');
  fs.copyFileSync(pdfFoto, originale);
  const primaDelLayer = O.sha1(pdfFoto);
  const esito = await O.scriviLayer(pdfFoto, [{ n: 1, larghezzaPx: W, parole: r.parole }]);
  check('scrittura riuscita', '', esito.error);
  check('quasi tutte le parole scritte', true, esito.scritte >= r.parole.length - 2);
  check('l\'impronta di prima è quella vera', primaDelLayer, esito.improntaPrima);
  check('e il file è cambiato davvero', true, esito.improntaDopo !== esito.improntaPrima);

  const rilettura = await O.verifica(pdfFoto, [{ n: 1 }]);
  check('pdf.js rilegge il testo dal file sostituito', '', rilettura.error);
  check('e il testo è quello fotografato', true, /fotosintesi/.test(rilettura.testo) && /velocità/.test(rilettura.testo));
  /* ⚠️ La LARGHEZZA, non solo la posizione: la prima versione forzava la scala
     con un'opzione che pdf-lib non ha — inghiottita in silenzio — e l'evidenza
     copriva «CONTRAT» di «CONTRATTO». Con le larghezze vere pdf.js FONDE le
     parole contigue in un item per riga, come su un PDF nativo: quindi si
     misura la riga — deve cominciare al bordo sinistro della prima parola e
     finire al bordo destro dell'ultima (±5% e un punto: pdf.js conta anche un
     filo d'avanzamento). Un controllo per parola qui passerebbe A VUOTO, con
     zero confronti: è successo alla prima stesura di questa sezione. */
  {
    /* Gli item possono essere uno per riga o uno per parola (più gli spazi che
       pdf.js mette in mezzo): quello che si misura è l'AGGREGATO di riga —
       dove comincia il primo pezzo e dove finisce l'ultimo. */
    const hPagina = H / SCALA;
    const perBase = {};
    r.parole.forEach((w) => { const k = Math.round(w.base / 30); (perBase[k] = perBase[k] || []).push(w); });
    let righe = 0, sbagliate = 0;
    for (const k in perBase) {
      const rr = perBase[k];
      const yAtteso = hPagina - O.mediana(rr.map((w) => w.base)) / SCALA;
      const pezzi = (rilettura.items || []).filter((i) => i.str.trim() && Math.abs(i.y - yAtteso) < 4);
      if (!pezzi.length) { sbagliate++; continue; }
      righe++;
      const x0 = Math.min.apply(null, rr.map((w) => w.x0)) / SCALA;
      const x1 = Math.max.apply(null, rr.map((w) => w.x1)) / SCALA;
      const sinistro = Math.min.apply(null, pezzi.map((i) => i.x));
      const destro = Math.max.apply(null, pezzi.map((i) => i.x + i.w));
      const largAttesa = x1 - x0;
      /* il bordo destro può SUPERARE l'ultima parola dello spazio in coda —
         quello che dà gli spazi alla selezione — ma mai fermarsi molto prima */
      if (Math.abs(sinistro - x0) > 1.5 ||
          destro < x1 - (largAttesa * 0.12 + 3) ||
          destro > x1 + (largAttesa * 0.2 + 6)) sbagliate++;
    }
    check('ogni riga del layer comincia e finisce coi bordi misurati', 0, sbagliate);
    check('e le righe confrontate sono tutte e tre', 3, righe);
    /* ⚠️ Gli SPAZI: la selezione copia gli item incollati, senza separatori
       suoi. La concatenazione grezza deve già contenere le frasi con i loro
       spazi — prima dava «UZIONEDIDIRITTODIUS». */
    const grezzo = (rilettura.items || []).map((i) => i.str).join('');
    check('la concatenazione grezza degli item ha gli spazi fra le parole', true,
      /fotosintesi clorofilliana avviene/.test(grezzo));
  }

  /* ⚠️ LA PAGINA STORTA, che è il caso normale di una foto. La fixture si
     inclina di 2° con `rotate` di pdf-lib PRIMA di rasterizzare: la verità è
     nota al decimo di grado, che una foto storta vera non potrebbe dare. */
  sezione('Le righe storte: si misurano, e il glifo le segue');
  const STORTA = 2;
  {
    const s = await PDFDocument.create();
    const fs2 = await s.embedFont(StandardFonts.Helvetica);
    const pgs = s.addPage([W, H]);
    ['La fotosintesi clorofilliana avviene nei cloroplasti.',
     'La velocita della luce e costante nel vuoto.',
     'Il sistema nervoso centrale comprende encefalo e midollo.'
    ].forEach((t, i) => pgs.drawText(t, { x: 60, y: H - 160 - i * 120, size: 34, font: fs2,
      color: rgb(0, 0, 0), rotate: degrees(STORTA) }));
    const pdfStortoTesto = path.join(QUI, 'storta-testo.pdf');
    fs.writeFileSync(pdfStortoTesto, await s.save());
    const pngStorto = path.join(QUI, 'storta.png');
    execFileSync('sips', ['-s', 'format', 'png', pdfStortoTesto, '--out', pngStorto], { stdio: 'ignore' });

    const rs = await O.riconosci(fs.readFileSync(pngStorto));
    check('la pagina storta si legge lo stesso', true, /fotosintesi/i.test(rs.testo));
    /* Il testo SALE verso destra (rotate positivo in PDF), e nello spazio
       dell'immagine — y verso il basso — questo è un angolo NEGATIVO. */
    check('l\'inclinazione misurata è quella vera, col segno giusto', true,
      Math.abs(rs.angoloPagina + STORTA) < 0.3);
    check('e l\'hanno votata tutte e tre le righe', 3, rs.righeMisurate);

    /* ⚠️ La baseline INTERPOLATA: prima le parole prendevano la y d'inizio riga
       e l'ultima parola di una riga larga finiva ventisei pixel fuori posto.
       Su una riga che sale, l'ultima parola deve avere una `base` più IN ALTO
       (y minore) della prima, di quanto dice la pendenza. */
    const riga1 = rs.parole.filter((p) => p.base < 200).sort((a, b) => a.x0 - b.x0);
    const prima = riga1[0], ultima = riga1[riga1.length - 1];
    const attesoDislivello = (ultima.x0 - prima.x0) * Math.tan(rs.angoloPagina * Math.PI / 180);
    check('la base di ogni parola segue la pendenza della riga', true,
      riga1.length > 4 && Math.abs((ultima.base - prima.base) - attesoDislivello) < 3);
    /* …e l'altezza della riga NON si gonfia del dislivello: il riquadro di una
       riga storta è alto quanto il testo più la salita, e tagliarci sopra il
       corpo del glifo darebbe lettere grasse il doppio. */
    check('l\'altezza della riga è quella del testo, non del riquadro storto', true,
      prima.rigaAlto < 40 && prima.rigaAlto > 20);

    /* Il layer sul PDF-immagine storto: i glifi devono inclinarsi come il testo
       fotografato — cioè dell'angolo con cui la fixture è nata. */
    const imgS = await PDFDocument.create();
    const fotoS = await imgS.embedPng(fs.readFileSync(pngStorto));
    imgS.addPage([W / SCALA, H / SCALA]).drawImage(fotoS, { x: 0, y: 0, width: W / SCALA, height: H / SCALA });
    const pdfStorto = path.join(QUI, 'storta-foto.pdf');
    fs.writeFileSync(pdfStorto, await imgS.save());
    const esitoS = await O.scriviLayer(pdfStorto, [{ n: 1, larghezzaPx: W, parole: rs.parole }]);
    check('il layer si scrive anche sulla pagina storta', '', esitoS.error);
    const letturaS = await O.verifica(pdfStorto, [{ n: 1 }]);
    check('e si rilegge', '', letturaS.error);
    const gradiScritti = O.mediana((letturaS.items || []).map((i) => i.gradi));
    check('i glifi sono inclinati come il testo fotografato', true,
      Math.abs(gradiScritti - STORTA) < 0.4);
  }

  /* ⚠️ LA DATTILOGRAFIA NOTARILE: righe di trattini fra le righe di testo,
     come nel contratto vero di Giacomo. Là Tesseract fondeva trattini e testo
     in un'unica «riga» e l'altezza-estensione esplodeva: 179 px per parole
     alte 35, glifi su cinque righe, selezione impossibile. Il metro robusto è
     la mediana delle altezze: qui si pretende che NESSUNA parola porti un
     corpo oltre il doppio del suo inchiostro. */
  sezione('Le righe di trattini non gonfiano il corpo delle parole');
  {
    const s2 = await PDFDocument.create();
    const f2 = await s2.embedFont(StandardFonts.Courier);
    const pg2 = s2.addPage([W, H]);
    const RIGHE = ['Locarno, 18 (diciotto) novembre 2011 (duemi-', 'laundici). Fra di loro intervengono:'];
    let y = H - 160;
    for (const t of RIGHE) {
      pg2.drawText('-'.repeat(52), { x: 60, y: y + 44, size: 26, font: f2, color: rgb(0, 0, 0) });
      pg2.drawText(t, { x: 60, y, size: 30, font: f2, color: rgb(0, 0, 0) });
      y -= 120;
    }
    pg2.drawText('-'.repeat(52), { x: 60, y: y + 44, size: 26, font: f2, color: rgb(0, 0, 0) });
    const pdfDat = path.join(QUI, 'dattilo.pdf');
    fs.writeFileSync(pdfDat, await s2.save());
    const pngDat = path.join(QUI, 'dattilo.png');
    execFileSync('sips', ['-s', 'format', 'png', pdfDat, '--out', pngDat], { stdio: 'ignore' });
    const rd = await O.riconosci(fs.readFileSync(pngDat));
    check('la pagina dattiloscritta si legge', true, /Locarno/i.test(rd.testo) && /novembre/i.test(rd.testo));
    const testuali = rd.parole.filter((w) => /[a-zà-ù0-9]{2}/i.test(w.testo));
    const gonfie = testuali.filter((w) => w.rigaAlto > (w.y1 - w.y0) * 2 + 2);
    check('nessuna parola ha un corpo oltre il doppio del suo inchiostro', [],
      gonfie.map((w) => w.testo + '@' + Math.round(w.rigaAlto) + '/' + (w.y1 - w.y0)));
    check('e nessuna sotto il proprio inchiostro', true,
      testuali.every((w) => w.rigaAlto >= (w.y1 - w.y0) - 0.01));
  }

  /* ⚠️ I FILETTI DI TRATTINI della dattilografia: Tesseract li legge come
     parole di due lettere («Em» per 404 px di filetto, misurato sul contratto
     vero), e il glifo che ne nasce copre un decimo del suo riquadro — la
     selezione ci cascava dentro. Il riquadro si riempie con gli spazi, che
     sono testo selezionabile quanto le lettere: qui si pretende che una parola
     larga il quadruplo del suo glifo arrivi comunque in fondo al suo posto. */
  sezione('Un filetto di trattini è coperto per quanto è lungo');
  {
    const larga = { testo: 'Em', x0: 200, x1: 1000, y0: 400, y1: 420,
                    base: 420, rigaAlto: 30, angoloRiga: 0, riga: 1 };
    const vicina = { testo: 'fine', x0: 1040, x1: 1180, y0: 396, y1: 424,
                     base: 420, rigaAlto: 30, angoloRiga: 0, riga: 1 };
    const f = path.join(QUI, 'filetto.pdf');
    fs.copyFileSync(originale, f);
    const e2 = await O.scriviLayer(f, [{ n: 1, larghezzaPx: W, parole: [larga, vicina] }]);
    check('il layer si scrive', '', e2.error);
    const v2 = await O.verifica(f, [{ n: 1 }]);
    const its = (v2.items || []).filter((i) => i.w > 0);
    const dx = its.length ? (Math.max.apply(null, its.map((i) => i.x + i.w)) -
                             Math.min.apply(null, its.map((i) => i.x))) : 0;
    /* dall'inizio della parola larga alla fine della vicina, in punti */
    const atteso = (1180 - 200) / SCALA;
    check('la riga copre il suo tratto per intero (≥90%)', true, dx >= atteso * 0.9);
    check('e non sborda (≤115%)', true, dx <= atteso * 1.15);
  }

  /* ⚠️ La strada della SECONDA PASSATA, provata senza canvas: si prendono
     parole vere, le si porta in uno spazio «raddrizzato» con `aRuotato` — cioè
     si finge di averle lette su un'immagine girata — e si pretende che il layer
     finisca ESATTAMENTE dove finirebbe scrivendole a mano inclinate. Se
     l'inversa non è l'inversa, qui si vede; sull'app viva si vedrebbe come
     «l'evidenza è due centimetri più in là», senza sapere perché. */
  sezione('La seconda passata: raddrizzata e dritta finiscono nello stesso posto');
  {
    const GRADI = 3;
    const piano = O.pianoRaddrizzamento(GRADI, W, H);
    const dirette = r.parole.map((w) => ({
      testo: w.testo, x0: w.x0, x1: w.x1, y0: w.y0, y1: w.y1,
      base: w.base, rigaAlto: w.rigaAlto, angoloRiga: GRADI
    }));
    const comeSeRuotate = r.parole.map((w) => {
      const a = O.aRuotato(w.x0, w.base, piano);
      return { testo: w.testo, x0: a.x, x1: a.x + (w.x1 - w.x0), base: a.y,
               rigaAlto: w.rigaAlto, angoloRiga: 0 };
    });
    const A = path.join(QUI, 'dritta.pdf'), B = path.join(QUI, 'raddrizzata.pdf');
    fs.copyFileSync(originale, A); fs.copyFileSync(originale, B);
    await O.scriviLayer(A, [{ n: 1, larghezzaPx: W, parole: dirette }]);
    await O.scriviLayer(B, [{ n: 1, larghezzaPx: W, parole: comeSeRuotate, raddrizzata: piano }]);
    const la = await O.verifica(A, [{ n: 1 }]), lb = await O.verifica(B, [{ n: 1 }]);
    check('le due strade scrivono lo stesso testo', la.testo, lb.testo);
    let scartoMax = 0;
    (la.items || []).forEach((it, i) => {
      const jt = (lb.items || [])[i]; if (!jt) return;
      scartoMax = Math.max(scartoMax, Math.abs(it.x - jt.x), Math.abs(it.y - jt.y),
        Math.abs(it.gradi - jt.gradi));
    });
    check('e nello stesso punto, con la stessa inclinazione', true, scartoMax < 0.05);
    check('inclinazione che è quella della foto', true,
      Math.abs(O.mediana((lb.items || []).map((i) => i.gradi)) + GRADI) < 0.2);
  }

  sezione('Quello che va storto non tocca il documento');
  const nonPdf = path.join(QUI, 'finto.pdf');
  fs.writeFileSync(nonPdf, 'non sono un PDF');
  const rotto = await O.scriviLayer(nonPdf, [{ n: 1, larghezzaPx: W, parole: r.parole }]);
  check('un file che non è un PDF lo dice', true, /non si apre/.test(rotto.error));
  check('e resta com\'era', 'non sono un PDF', fs.readFileSync(nonPdf, 'utf-8'));
  const vuoto = await O.scriviLayer(pdfTesto, [{ n: 1, larghezzaPx: W, parole: [] }]);
  check('zero parole = niente da scrivere, dichiarato', true, /nessuna parola/.test(vuoto.error));
  const impVuoto = O.sha1(pdfTesto);
  check('e il file non si è mosso', impVuoto, O.sha1(pdfTesto));
  check('una parola di soli glifi fuori codifica si salta senza morire',
    null, O.scrivibile({ widthOfTextAtSize: () => { throw new Error('no'); } }, '→→'));

  sezione('L\'indice ricorda l\'OCR, e il doppione non entra');
  const VAULT = fs.mkdtempSync(path.join(os.tmpdir(), 'studia-ocrpdf-vault-'));
  Z.crea(VAULT, 'Schede fotografate', '2026-08-12');
  const ZAINO = 'schede-fotografate';
  const dentro = F.importa(VAULT, ZAINO, [pdfFoto], '2026-08-12T22:00:00.000Z');
  check('la foto entra nello zaino', 1, dentro.copiati.length);
  const nome = dentro.copiati[0].nome;
  /* il riconoscimento scrive il campo `ocr` nell'indice… */
  const meta = { motore: 'tesseract.js', quando: '2026-08-12T22:05:00.000Z', improntaOriginale: esito.improntaPrima };
  F.scriviIndice(VAULT, ZAINO, nome, [{ page: 1, text: rilettura.testo }], 'pdfjs', meta);
  let letti = F.leggiIndici(VAULT, ZAINO).documenti;
  check('l\'indice porta il campo ocr', meta, letti[0].ocr);
  check('e il documento non è più una scansione', false, letti[0].scansione);
  /* …la riscrittura SENZA il campo non lo dimentica (la lista bianca che mangia) */
  F.scriviIndice(VAULT, ZAINO, nome, [{ page: 1, text: rilettura.testo }], 'pdfjs');
  letti = F.leggiIndici(VAULT, ZAINO).documenti;
  check('il campo ocr torna indietro dal disco dopo una riscrittura', meta, letti[0].ocr);
  /* il gemello: l'utente ritrascina il SUO file, quello senza layer */
  check('gemelloOcr riconosce l\'impronta di prima', nome, F.gemelloOcr(VAULT, ZAINO, esito.improntaPrima));
  const ancora = F.importa(VAULT, ZAINO, [originale], '2026-08-12T22:10:00.000Z');
  check('ritrascinare l\'originale non crea il doppione', 0, ancora.copiati.length);
  check('e il motivo nomina il documento che c\'è già', true,
    ancora.scartati.length === 1 && ancora.scartati[0].motivo.indexOf(nome) >= 0);

  /* ⚠️ La ripresa dopo un «ferma»: `ocr.pagine` è la memoria di quali pagine
     hanno già il layer. Una pagina sotto soglia ma GIÀ riconosciuta — la foto
     con tre righe — NON torna nell'elenco, o la ripresa le scriverebbe addosso
     un secondo layer e ogni parola conterebbe doppia. Il conteggio da solo non
     può dirlo: è successo alla prova CDP, pagina da 150 caratteri. */
  sezione('La ripresa: si rileggono le pagine mai fatte, non quelle povere');
  const meta2 = { motore: 'tesseract.js', quando: '2026-08-12T23:00:00.000Z',
    improntaOriginale: 'abc123', pagine: [1] };
  F.scriviIndice(VAULT, ZAINO, '99 finta.pdf',
    [{ page: 1, text: 'tre righe scarse' }, { page: 2, text: '' }], 'pdfjs', meta2);
  let parziale = F.leggiIndici(VAULT, ZAINO).documenti.filter((d) => d.pdf === '99 finta.pdf')[0];
  check('la pagina già riconosciuta esce dall\'elenco anche se povera', [2], parziale.daRiconoscere);
  check('e il lavoro risulta da finire', true, parziale.ocrDaFinire);
  check('ma non è più una «scansione» da proporre', false, parziale.scansione);
  F.scriviIndice(VAULT, ZAINO, '99 finta.pdf',
    [{ page: 1, text: 'tre righe scarse' }, { page: 2, text: '' }], 'pdfjs',
    Object.assign({}, meta2, { pagine: [1, 2] }));
  parziale = F.leggiIndici(VAULT, ZAINO).documenti.filter((d) => d.pdf === '99 finta.pdf')[0];
  check('con tutte le pagine fatte non resta niente', [], parziale.daRiconoscere);
  check('e niente da finire', false, parziale.ocrDaFinire);

  try { fs.rmSync(VAULT, { recursive: true, force: true }); } catch (e) { /* temporanea */ }
}

conMotore()
  .catch((e) => { ko++; console.log('  ✗ la prova col motore è morta: ' + (e && e.message)); })
  .then(async () => {
    await O.chiudi();
    try { fs.rmSync(QUI, { recursive: true, force: true }); } catch (e) { /* temporanea */ }
    console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati') + ' (' + ok + ' ok)');
    process.exit(ko ? 1 : 0);
  });
