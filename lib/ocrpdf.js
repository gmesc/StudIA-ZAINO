'use strict';
/**
 * ocrpdf — il testo dentro le fotografie: riconoscimento e layer invisibile.
 *
 * Gli studenti spesso non ricevono i PDF: fotografano le schede, e il telefono
 * ne fa un PDF di sole immagini. Nell'app quel documento si vede ma non si
 * seleziona — quindi niente evidenze, niente parole chiave, niente lente. Qui
 * c'è quello che manca: Tesseract riconosce le parole con le loro coordinate, e
 * `scriviLayer` le scrive DENTRO la copia del PDF come testo invisibile. Da quel
 * momento il documento è indistinguibile da un nativo e nessun altro pezzo
 * dell'app deve sapere che c'è stato un riconoscimento.
 *
 * Tre scelte di fondo, e il perché:
 *
 *  1. **tesseract.js, non Chandra e non ocrmypdf.** Chandra dà i riquadri dei
 *     BLOCCHI, mai delle parole (il suo parser butta i bbox annidati: «not
 *     needed in open source»), quindi un layer selezionabile non può nascerne;
 *     e i suoi pesi hanno una licenza col tetto di fatturato. ocrmypdf farebbe
 *     tutto, ma si porta dietro Ghostscript (AGPL) e un'installazione di
 *     sistema che chi studia non ha. tesseract.js è lo stesso motore Tesseract
 *     compilato in WASM: parole con coordinate, dentro l'app, pila
 *     Apache-2.0/MIT. Le lingue stanno in `App/assets/tesseract/`.
 *
 *  2. **Le parole a bassa confidenza si scrivono comunque.** Un buco nel layer
 *     sposta la selezione di tutto quello che segue sulla riga: chi seleziona
 *     tre parole sull'immagine ne riceverebbe due più una sbagliata. Meglio una
 *     parola brutta al posto giusto che un buco che sposta le altre.
 *
 *  3. **Prima si verifica, poi si sostituisce.** Il layer si scrive su un file
 *     temporaneo; si riapre, si controlla che sia un PDF sano e che il testo ne
 *     esca davvero, e solo allora prende il posto della copia nel vault — con
 *     un rename, che è atomico. Se qualcosa non torna, l'originale non si è
 *     mosso e il motivo si dice (un documento rovinato in silenzio è il guasto
 *     peggiore che quest'app possa fare a chi le ha affidato le sue foto).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/* Quanto grande rasterizzare per il riconoscimento, e quanto piccolo un
   riquadro può essere prima di non credergli più. */
const CONF_MINIMA = 0;        // vedi scelta 2: oggi non si scarta niente, la soglia esiste per poterla alzare
const PUNTI_MINIMI = 2;       // un riquadro più basso di così non è una parola, è rumore

// ------------------------------------------------------------------ il motore

/* Un worker solo, tenuto acceso fra una pagina e l'altra: caricare lingue e
   WASM costa secondi, e un documento sono decine di pagine. Chi ha finito
   chiude (`chiudi()`), come si fa con un file. */
let MOTORE = null;

async function apri(dirLingue, dirCache) {
  if (MOTORE) return { error: '' };
  try {
    const Tesseract = require('tesseract.js');
    MOTORE = await Tesseract.createWorker(['ita', 'eng'], 1, {
      langPath: dirLingue,
      cachePath: dirCache || dirLingue,
      gzip: true
    });
    return { error: '' };
  } catch (e) {
    MOTORE = null;
    return { error: e.message || 'motore OCR non partito' };
  }
}

async function chiudi() {
  const m = MOTORE; MOTORE = null;
  if (m) { try { await m.terminate(); } catch (e) { /* stava già morendo */ } }
  return { error: '' };
}

/**
 * Le parole di una pagina fotografata, con i loro riquadri in pixel.
 *
 * `png` è la pagina rasterizzata dal renderer (è lui che ha pdf.js e il
 * canvas); qui si riconosce e basta. La `base` è la linea di base della
 * PAROLA quando Tesseract la dà, quella della riga altrimenti: è il punto su
 * cui il layer appoggia i glifi, e sbagliarla di poco si vede subito nella
 * selezione.
 */
async function riconosci(png) {
  if (!MOTORE) return { error: 'motore OCR non aperto', parole: [] };
  let r;
  try { r = await MOTORE.recognize(png, {}, { blocks: true, text: true }); }
  catch (e) { return { error: e.message || 'riconoscimento fallito', parole: [] }; }
  const parole = [];
  for (const b of (r.data && r.data.blocks) || []) {
    for (const par of b.paragraphs || []) {
      for (const riga of par.lines || []) {
        const baseRiga = riga.baseline && Number.isFinite(riga.baseline.y0) ? riga.baseline.y0 : null;
        /* L'altezza della RIGA, portata addosso a ogni parola: il corpo del
           glifo invisibile si taglia su questa, non sul riquadro della parola —
           «ma» è più basso di «Mg» solo perché non ha aste, e tagliargli il
           corpo addosso fa un'area di selezione più piccola del testo che si
           vede. Misurato da Giacomo alla prima prova a mano, punto 2. */
        const altoRiga = riga.bbox ? (riga.bbox.y1 - riga.bbox.y0) : 0;
        for (const w of riga.words || []) {
          const testo = String(w.text || '').trim();
          if (!testo || !w.bbox) continue;
          if ((w.confidence || 0) < CONF_MINIMA) continue;
          const baseParola = w.baseline && Number.isFinite(w.baseline.y0) ? w.baseline.y0 : null;
          parole.push({
            testo,
            x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1,
            base: baseParola != null ? baseParola : (baseRiga != null ? baseRiga : w.bbox.y1),
            rigaAlto: altoRiga > 0 ? altoRiga : (w.bbox.y1 - w.bbox.y0),
            conf: Math.round(w.confidence || 0)
          });
        }
      }
    }
  }
  return { error: '', parole, testo: String((r.data && r.data.text) || '') };
}

// ------------------------------------------------------------- il layer

function sha1(percorso) {
  try { return crypto.createHash('sha1').update(fs.readFileSync(percorso)).digest('hex'); }
  catch (e) { return ''; }
}

/* WinAnsi non copre tutto quello che Tesseract può leggere (frecce, greco…):
   una parola con un glifo fuori codifica farebbe fallire drawText. Si tenta
   intera; se la codifica la rifiuta, si riprova senza i caratteri che WinAnsi
   non ha — la selezione resta allineata, si perde solo il glifo raro. */
function scrivibile(font, testo) {
  try { font.widthOfTextAtSize(testo, 10); return testo; }
  catch (e) {
    const pulito = Array.from(testo).filter((c) => {
      try { font.widthOfTextAtSize(c, 10); return true; } catch (e2) { return false; }
    }).join('');
    return pulito || null;
  }
}

/**
 * Scrive il layer di testo invisibile dentro il PDF, al posto giusto.
 *
 * `pagine` = [{ n, larghezzaPx, parole: [{testo,x0,y0,x1,y1,base}] }]
 * con le coordinate nei pixel dell'immagine rasterizzata: la scala per passare
 * ai punti PDF si ricava per pagina (`larghezzaPx / larghezza vista della
 * pagina`), perché ogni pagina può avere misure sue.
 *
 * ⚠️ Le coordinate di Tesseract vivono nello spazio dell'immagine COME SI VEDE,
 * cioè con la rotazione della pagina già applicata (il renderer rasterizza col
 * viewport di pdf.js, che la applica). Il contenuto del PDF invece vive nello
 * spazio NON ruotato. Le quattro mappature qui sotto riportano ogni parola al
 * suo posto; il glifo si ruota insieme (`rotate`), o il testo starebbe dritto
 * su una pagina che si mostra girata.
 *
 * ⚠️ La larghezza si forza con l'operatore `Tz` (horizontal scaling) SCRITTO A
 * MANO con pushOperators, perché copra ESATTAMENTE il riquadro misurato:
 * Helvetica non ha le metriche del carattere fotografato, e senza la forzatura
 * l'evidenza copriva «CONTRAT» di «CONTRATTO» — il 78% della parola, misurato
 * dallo screenshot di Giacomo (prova a mano, punto 2).
 * ⚠️⚠️ La prima versione passava `horizontalScale` come opzione di `drawText`,
 * che NON esiste: pdf-lib inghiotte le opzioni sconosciute senza dire niente, e
 * lo spike misurava solo la posizione (0,00 pt, vera) — mai la larghezza. Una
 * forzatura che non si misura è una forzatura che non c'è.
 */
async function scriviLayer(percorsoPdf, pagine, opz) {
  const o = opz || {};
  if (!percorsoPdf || !fs.existsSync(percorsoPdf)) return { error: 'documento non trovato' };
  const improntaPrima = sha1(percorsoPdf);

  const { PDFDocument, StandardFonts, degrees, PDFOperator, PDFOperatorNames, PDFNumber } = require('pdf-lib');
  const tz = (pct) => PDFOperator.of(PDFOperatorNames.SetTextHorizontalScaling, [PDFNumber.of(pct)]);
  let doc;
  try { doc = await PDFDocument.load(fs.readFileSync(percorsoPdf)); }
  catch (e) { return { error: 'il PDF non si apre: ' + (e.message || '?') }; }
  const font = await doc.embedFont(StandardFonts.Helvetica);

  let scritte = 0, saltate = 0;
  for (const pag of (Array.isArray(pagine) ? pagine : [])) {
    const idx = Math.trunc(+(pag && pag.n)) - 1;
    if (!(idx >= 0 && idx < doc.getPageCount())) continue;
    const p = doc.getPage(idx);
    const rot = ((p.getRotation().angle % 360) + 360) % 360;
    const W = p.getWidth(), H = p.getHeight();
    /* La larghezza VISTA della pagina: con rotazione 90/270 il viewport del
       renderer ha scambiato i lati, e la scala va presa sul lato giusto. */
    const wVista = (rot === 90 || rot === 270) ? H : W;
    const hVista = (rot === 90 || rot === 270) ? W : H;
    const scala = (pag.larghezzaPx > 0) ? (pag.larghezzaPx / wVista) : 0;
    if (!scala) continue;

    for (const w of pag.parole || []) {
      const testo = scrivibile(font, String(w.testo || ''));
      if (!testo) { saltate++; continue; }
      const alto = (w.y1 - w.y0) / scala;
      if (!(alto >= PUNTI_MINIMI)) { saltate++; continue; }
      /* Il corpo viene dall'altezza della RIGA quando c'è: uniforme lungo la
         riga e grande quanto il testo che si vede — al 95% del riquadro della
         parola le selezioni uscivano visibilmente più piccole dell'originale
         (prova a mano, punto 2). Il riquadro della parola resta il limite per
         la larghezza (horizontalScale, sotto) e il ripiego per il corpo. */
      const size = Math.max(PUNTI_MINIMI,
        (Number.isFinite(w.rigaAlto) && w.rigaAlto > 0) ? (w.rigaAlto / scala) : alto);
      /* coordinate nello spazio VISTO, in punti (origine in alto a sinistra) */
      const vx = w.x0 / scala;
      const vy = (Number.isFinite(w.base) ? w.base : w.y1) / scala;
      const largVista = (w.x1 - w.x0) / scala;
      /* → spazio del contenuto (origine in basso a sinistra, non ruotato).
         Le quattro formule sono le inverse delle matrici del viewport di
         pdf.js per le quattro rotazioni — le stesse con cui il renderer ha
         prodotto l'immagine su cui Tesseract ha misurato. */
      let x, y, angolo;
      if (rot === 90) { x = vy; y = vx; angolo = 90; }
      else if (rot === 180) { x = W - vx; y = vy; angolo = 180; }
      else if (rot === 270) { x = W - vy; y = H - vx; angolo = 270; }
      else { x = vx; y = hVista - vy; angolo = 0; }
      const wFont = font.widthOfTextAtSize(testo, size);
      const scalaTz = wFont > 0 ? Math.max(1, (largVista / wFont) * 100) : 100;
      try {
        p.pushOperators(tz(scalaTz));
        p.drawText(testo, { x, y, size, font, opacity: 0, rotate: degrees(angolo) });
        scritte++;
      } catch (e) { saltate++; }
    }
    /* Il Tz è stato di testo e sopravvive fuori dal BT/ET: si rimette a 100,
       o il prossimo che scrive su questa pagina erediterebbe l'ultima scala. */
    p.pushOperators(tz(100));
  }
  if (!scritte) return { error: 'nessuna parola da scrivere: il layer non si tocca' };

  /* Su file temporaneo, poi la verifica, poi il posto vero. */
  const tmp = percorsoPdf + '.ocr.tmp';
  try { fs.writeFileSync(tmp, await doc.save()); }
  catch (e) { try { fs.unlinkSync(tmp); } catch (e2) {} return { error: 'scrittura fallita: ' + (e.message || '?') }; }

  const controllo = await verifica(tmp, pagine, o);
  if (controllo.error) {
    try { fs.unlinkSync(tmp); } catch (e) {}
    return { error: 'verifica fallita, il documento non è stato toccato: ' + controllo.error };
  }
  try { fs.renameSync(tmp, percorsoPdf); }
  catch (e) { try { fs.unlinkSync(tmp); } catch (e2) {} return { error: 'sostituzione fallita: ' + (e.message || '?') }; }

  return { error: '', scritte, saltate, improntaPrima, improntaDopo: sha1(percorsoPdf) };
}

/**
 * Il temporaneo è un PDF sano da cui il testo esce davvero?
 *
 * Si riapre con pdf.js — lo STESSO lettore che l'app userà — e si estrae il
 * testo della prima pagina lavorata: se non ne esce niente, il layer è stato
 * scritto in un modo che il lettore non vede, e sostituire il file darebbe un
 * documento identico a prima spacciato per riconosciuto.
 *
 * ⚠️ pdf.js in Node vuole `DOMMatrix`, che qui non esiste: basta uno stub,
 * perché `getTextContent` legge e non disegna. Lo stub resta dentro questa
 * funzione — il main non deve ritrovarsi geometrie finte in giro.
 */
async function verifica(percorso, pagine, opz) {
  const o = opz || {};
  try {
    const { PDFDocument } = require('pdf-lib');
    const d = await PDFDocument.load(fs.readFileSync(percorso));
    if (!d.getPageCount()) return { error: 'zero pagine' };
  } catch (e) { return { error: 'il file scritto non è un PDF: ' + (e.message || '?') }; }

  const pdfjsDir = o.pdfjsDir || path.join(__dirname, '..', 'App', 'assets', 'pdfjs');
  try {
    if (typeof globalThis.DOMMatrix === 'undefined') {
      globalThis.DOMMatrix = class DOMMatrix {
        constructor(v) { const m = Array.isArray(v) ? v : [1, 0, 0, 1, 0, 0];
          this.a = m[0]; this.b = m[1]; this.c = m[2]; this.d = m[3]; this.e = m[4]; this.f = m[5]; }
        translate() { return this; } scale() { return this; } multiply() { return this; }
      };
    }
    const pdfjs = await import(path.join(pdfjsDir, 'pdf.min.mjs'));
    /* ⚠️ Sempre, non «se manca»: il default è la stringa "./pdf.worker.mjs" —
       piena, quindi un controllo `if (!workerSrc)` non scatterebbe mai, e
       pdf.js andrebbe a cercare un worker che nella build vendorizzata non
       esiste con quel nome. Misurato: è stato il primo modo in cui questa
       funzione ha fallito. */
    pdfjs.GlobalWorkerOptions.workerSrc = path.join(pdfjsDir, 'pdf.worker.min.mjs');
    const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(percorso)), isEvalSupported: false }).promise;
    const prima = (Array.isArray(pagine) && pagine.length && pagine[0].n) || 1;
    const pg = await doc.getPage(Math.min(Math.max(1, prima), doc.numPages));
    const tc = await pg.getTextContent();
    const testo = tc.items.map((i) => i.str).join(' ').trim();
    /* Gli item con posizione e LARGHEZZA: è la misura che dice se la selezione
       coprirà la parola intera — la prima versione del layer non la controllava
       e copriva il 78% (vedi scriviLayer). */
    const items = tc.items.filter((i) => i.str.trim()).map((i) =>
      ({ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width }));
    try { await doc.destroy(); } catch (e) {}
    if (!testo) return { error: 'il testo non si rilegge dalla pagina ' + prima };
    return { error: '', testo, items };
  } catch (e) {
    return { error: 'rilettura fallita: ' + (e.message || '?') };
  }
}

module.exports = {
  CONF_MINIMA, PUNTI_MINIMI,
  apri, chiudi, riconosci,
  scriviLayer, verifica, sha1, scrivibile
};
