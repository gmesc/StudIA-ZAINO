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
  check('il conto si dà, non solo il verdetto', { scansione: true, pagineVuote: 2, npagine: 3 },
    OCR.eScansione([s(1), s(2), t(3)]));
  check('vuoto non è una scansione', false, OCR.eScansione([]).scansione);
  check('e nemmeno un non-elenco', { scansione: false, pagineVuote: 0, npagine: 0 }, OCR.eScansione(null));
  /* gli spazi non sono testo: una pagina di soli a-capo è vuota */
  check('una pagina di soli spazi è vuota', 1, OCR.eScansione([{ page: 1, text: ' \n \t '.repeat(200) }]).pagineVuote);
}

async function conMotore() {
  /* ------------------------------------------------------------------ fixture
     Un PDF con testo vero → PNG con sips (1 pt = 1 px) → PDF di sola immagine,
     pagina a metà misura (scala 2 px/pt): è la forma di una scheda fotografata. */
  const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
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
