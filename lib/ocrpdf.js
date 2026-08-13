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

/* ------------------------------------------------------- le righe storte
   Una foto di una scheda non è mai dritta. Tre soglie, in gradi, e il perché
   di ognuna — sono l'unico posto dove questi numeri esistono, e il renderer
   non li conosce: riceve un sì o un no già deciso qui (`daRaddrizzare`).

   ⚠️ La convenzione dell'angolo, dichiarata una volta per non doverla
   indovinare mai più: si misura nello spazio dell'IMMAGINE, dove la y cresce
   verso il basso, e **positivo = riga che scende verso destra**. Nel PDF la y
   cresce verso l'alto, quindi la stessa riga vuole una rotazione dell'angolo
   OPPOSTO: è l'unica inversione di segno di tutto il file, e sta in
   `scriviLayer`. */
const GRADI_LAYER = 0.3;      // sotto: il glifo si scrive dritto — inclinarlo di un decimo di grado è rumore
const GRADI_RADDRIZZA = 2;    // sopra: vale una seconda passata sull'immagine raddrizzata
const GRADI_MAX = 10;         // oltre: non è una foto storta, è un'altra cosa (pagina ruotata, ritaglio storto)

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

/** La mediana, che è quello che serve qui: una riga d'intestazione storta per
 *  conto suo non deve piegare l'intera pagina, e la media invece la piega. */
function mediana(numeri) {
  const l = numeri.slice().sort((a, b) => a - b);
  if (!l.length) return 0;
  const m = Math.floor(l.length / 2);
  return l.length % 2 ? l[m] : (l[m - 1] + l[m]) / 2;
}

/**
 * L'inclinazione di una riga, in gradi, dalla sua linea di base.
 *
 * Tesseract dà la baseline come SEGMENTO (`{x0,y0,x1,y1}`), e la sua pendenza
 * è già la risposta: non serve né trasformare l'immagine né indovinare. Torna
 * `null` quando la riga è troppo corta perché la pendenza voglia dire qualcosa
 * — su venti pixel di larghezza un pixel di dislivello sono tre gradi di
 * rumore.
 */
function angoloBaseline(baseline) {
  if (!baseline) return null;
  const dx = baseline.x1 - baseline.x0, dy = baseline.y1 - baseline.y0;
  if (!(Math.abs(dx) > 40)) return null;
  return Math.atan2(dy, dx) * 180 / Math.PI;
}

/**
 * Le parole di una pagina fotografata, con i loro riquadri in pixel — e
 * l'inclinazione, che è la cosa nuova.
 *
 * `png` è la pagina rasterizzata dal renderer (è lui che ha pdf.js e il
 * canvas); qui si riconosce e basta.
 *
 * ⚠️ LE PAROLE NON HANNO UNA BASELINE, solo le righe: misurato: `word.baseline`
 * è sempre `undefined` in tesseract.js 7. Il vecchio codice ripiegava sulla y
 * d'INIZIO riga per tutte le parole, e su una riga storta di due gradi larga
 * settecento pixel l'ultima parola finiva ventisei pixel fuori posto. La `base`
 * di ogni parola si INTERPOLA quindi sul segmento della riga, al suo bordo
 * sinistro: è esatta anche a metà riga.
 *
 * ⚠️ E l'altezza della riga si misura DE-INCLINATA: il riquadro di una riga
 * storta è alto quanto il testo PIÙ il dislivello (49 px invece di 30, sempre
 * a due gradi), e tagliarci sopra il corpo del glifo darebbe lettere grasse il
 * doppio del vero. Si prende l'estensione delle parole rispetto alla loro
 * baseline, che è la stessa cosa su una riga dritta e la cosa giusta su una
 * storta.
 */
async function riconosci(png) {
  if (!MOTORE) return { error: 'motore OCR non aperto', parole: [] };
  let r;
  try { r = await MOTORE.recognize(png, {}, { blocks: true, text: true }); }
  catch (e) { return { error: e.message || 'riconoscimento fallito', parole: [] }; }
  const parole = [], angoli = [];
  let nRiga = 0;
  for (const b of (r.data && r.data.blocks) || []) {
    for (const par of b.paragraphs || []) {
      for (const riga of par.lines || []) {
        nRiga++;
        const parNette = (riga.words || []).filter((w) => String(w.text || '').trim() && w.bbox &&
          (w.confidence || 0) >= CONF_MINIMA);
        if (!parNette.length) continue;
        const bl = riga.baseline;
        const gradi = angoloBaseline(bl);
        /* La baseline sotto un punto x: sul segmento se c'è, altrimenti piatta
           sotto il riquadro della riga — una riga senza baseline non è un
           errore, è una riga di cui non si sa la pendenza. */
        const baseA = (x) => {
          if (!bl) return riga.bbox ? riga.bbox.y1 : 0;
          const dx = bl.x1 - bl.x0;
          if (!dx) return bl.y0;
          return bl.y0 + (x - bl.x0) * (bl.y1 - bl.y0) / dx;
        };
        /* L'altezza vera della riga: quanto le parole si alzano e scendono
           RISPETTO alla loro baseline, non l'ingombro del riquadro storto. */
        let sopra = Infinity, sotto = -Infinity;
        for (const w of parNette) {
          const b0 = baseA((w.bbox.x0 + w.bbox.x1) / 2);
          sopra = Math.min(sopra, w.bbox.y0 - b0);
          sotto = Math.max(sotto, w.bbox.y1 - b0);
        }
        /* ⚠️ SOTTO-RIGHE. Sulla dattilografia notarile Tesseract fonde le righe
           di trattini («----») col testo in un'unica «riga»: l'altezza
           esplodeva a 179 px per parole alte 35, e i glifi del layer coprivano
           cinque righe — misurato sul contratto vero di Giacomo, 73 parole su
           232. Qui la riga si SPEZZA sui salti di quota: le parole si
           raggruppano per vicinanza di base, e ogni gruppo diventa una riga
           per conto suo — coi suoi numeri, la sua altezza, il suo oggetto di
           testo nel layer. */
        const hMed = mediana(parNette.map((w) => w.bbox.y1 - w.bbox.y0)) || 10;
        const conQuota = parNette.map((w) => ({ w, quota: baseA((w.bbox.x0 + w.bbox.x1) / 2) }))
          .sort((a, b) => (a.quota - b.quota) || (a.w.bbox.x0 - b.w.bbox.x0));
        const gruppi = [];
        for (const v of conQuota) {
          const g = gruppi[gruppi.length - 1];
          if (g && Math.abs(v.quota - g[g.length - 1].quota) <= hMed * 0.7) g.push(v);
          else gruppi.push([v]);
        }
        /* Alla mediana della pagina votano solo le righe di almeno tre parole:
           una riga di una parola ha una baseline corta, e una baseline corta
           misura il rumore invece dell'inclinazione. */
        if (gradi != null && parNette.length >= 3) angoli.push(gradi);
        for (const gruppo of gruppi) {
          nRiga++;
          /* Il gruppo che sta SULLA baseline della riga madre tiene le basi
             interpolate (esatte anche a metà riga); gli altri — i trattini, la
             riga fusa sopra — una baseline non ce l'hanno mai avuta, e il
             bordo basso del loro inchiostro è l'approssimazione onesta. */
          const scarti = gruppo.map((v) => Math.abs(v.w.bbox.y1 - v.quota));
          const sullaBase = mediana(scarti) < hMed * 0.45;
          const medAlt = mediana(gruppo.map((v) => v.w.bbox.y1 - v.w.bbox.y0));
          let sopra = Infinity, sotto = -Infinity;
          for (const v of gruppo) {
            const b0 = sullaBase ? v.quota : v.w.bbox.y1;
            sopra = Math.min(sopra, v.w.bbox.y0 - b0);
            sotto = Math.max(sotto, v.w.bbox.y1 - b0);
          }
          const estensione = (sotto > sopra) ? (sotto - sopra) : 0;
          const altoRiga = Math.min(estensione || medAlt * 1.3, medAlt * 1.3);
          for (const v of gruppo.slice().sort((a, b) => a.w.bbox.x0 - b.w.bbox.x0)) {
            const w = v.w;
            const propria = w.bbox.y1 - w.bbox.y0;
            parole.push({
              testo: String(w.text).trim(),
              x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1,
              base: sullaBase ? baseA(w.bbox.x0) : w.bbox.y1,
              /* mai più bassa dell'inchiostro suo: una parola più alta della
                 mediana — «(diciotto)» in mezzo a cifre — tiene la sua misura */
              rigaAlto: Math.max(altoRiga > 0 ? altoRiga : propria, propria),
              angoloRiga: gradi != null ? gradi : 0,
              /* il numero della RIGA (sotto-riga): chi scrive il layer
                 raggruppa su questo — le parole di una riga diventano UN
                 oggetto di testo, che è ciò che fa sopravvivere gli spazi
                 alla selezione */
              riga: nRiga,
              conf: Math.round(w.confidence || 0)
            });
          }
        }
      }
    }
  }
  const angoloPagina = mediana(angoli);
  return { error: '', parole, testo: String((r.data && r.data.text) || ''),
           angoloPagina, righeMisurate: angoli.length };
}

// -------------------------------------------------- raddrizzare per leggere

/**
 * Vale la pena rileggere questa pagina raddrizzata? E con quali numeri?
 *
 * Risponde a chi ha in mano il canvas — il renderer — con tutto già calcolato:
 * le misure della tela ruotata e i RADIANTI da passare a `ctx.rotate`. Là non
 * si fa geometria e non si conoscono soglie: si ubbidisce. È la stessa
 * divisione di `eScansione`, e per la stessa ragione (invariante 5: i numeri
 * vivono in un posto solo).
 *
 * ⚠️ La tela ruotata è più GRANDE dell'originale — `W·|cos|+H·|sin|` per lato —
 * o gli angoli del foglio uscirebbero dal bordo e con loro le parole che ci
 * stanno sopra. Costa qualche megabyte di RAM per il tempo di una pagina.
 */
function pianoRaddrizzamento(angoloPagina, larghezzaPx, altezzaPx) {
  const g = Number.isFinite(angoloPagina) ? angoloPagina : 0;
  const serve = Math.abs(g) >= GRADI_RADDRIZZA && Math.abs(g) <= GRADI_MAX &&
    larghezzaPx > 0 && altezzaPx > 0;
  if (!serve) return { daRaddrizzare: false, gradi: g };
  const rad = -g * Math.PI / 180;            // si toglie l'inclinazione, non la si aggiunge
  const c = Math.abs(Math.cos(rad)), s = Math.abs(Math.sin(rad));
  return {
    daRaddrizzare: true,
    gradi: g,
    radianti: rad,
    larghezzaPx, altezzaPx,
    larghezzaRuotataPx: Math.ceil(larghezzaPx * c + altezzaPx * s),
    altezzaRuotataPx: Math.ceil(larghezzaPx * s + altezzaPx * c)
  };
}

/** Un punto dall'immagine originale a quella raddrizzata. Serve alle prove —
 *  il giro di andata lo fa il canvas — e a dimostrare che l'inversa è inversa. */
function aRuotato(x, y, r) {
  const u = x - r.larghezzaPx / 2, v = y - r.altezzaPx / 2;
  const co = Math.cos(r.radianti), si = Math.sin(r.radianti);
  return { x: u * co - v * si + r.larghezzaRuotataPx / 2,
           y: u * si + v * co + r.altezzaRuotataPx / 2 };
}

/** E il ritorno: dall'immagine raddrizzata — quella su cui Tesseract ha
 *  misurato — a quella VERA, che è l'unica che il PDF conosce. */
function daRuotato(x, y, r) {
  const u = x - r.larghezzaRuotataPx / 2, v = y - r.altezzaRuotataPx / 2;
  const co = Math.cos(r.radianti), si = Math.sin(r.radianti);
  return { x: u * co + v * si + r.larghezzaPx / 2,
           y: -u * si + v * co + r.altezzaPx / 2 };
}

/**
 * Le parole misurate sull'immagine raddrizzata, riportate su quella vera.
 *
 * Solo l'ANCORA si trasforma (il punto d'appoggio del glifo): larghezza e
 * altezza sopravvivono alla rotazione senza cambiare — una rotazione non
 * allunga niente — e l'inclinazione da dare al glifo è quella che si era tolta
 * all'immagine, più l'eventuale storta residua della riga.
 */
function riportaParole(parole, r) {
  return (Array.isArray(parole) ? parole : []).map((w) => {
    const a = daRuotato(w.x0, w.base, r);
    return { testo: w.testo, x0: a.x, base: a.y,
             largPx: w.x1 - w.x0, altoPx: w.rigaAlto, riga: w.riga,
             angoloRiga: (w.angoloRiga || 0) + r.gradi, conf: w.conf };
  });
}

/** La forma con cui il layer disegna, da qualunque strada arrivi la pagina:
 *  ancora, larghezza, altezza, inclinazione. Una sola, o `scriviLayer` avrebbe
 *  due rami e due modi di sbagliare. */
function pezziDaScrivere(pag) {
  if (pag && pag.raddrizzata && pag.raddrizzata.daRaddrizzare) {
    return riportaParole(pag.parole, pag.raddrizzata);
  }
  return (Array.isArray(pag && pag.parole) ? pag.parole : []).map((w) => ({
    testo: w.testo, x0: w.x0, base: w.base,
    largPx: w.x1 - w.x0, altoPx: w.rigaAlto, riga: w.riga,
    angoloRiga: w.angoloRiga || 0, conf: w.conf
  }));
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
 * `pagine` = [{ n, larghezzaPx, parole: [{testo,x0,y0,x1,y1,base,rigaAlto,angoloRiga}],
 *               raddrizzata? }]
 * con le coordinate nei pixel dell'immagine rasterizzata: la scala per passare
 * ai punti PDF si ricava per pagina (`larghezzaPx / larghezza vista della
 * pagina`), perché ogni pagina può avere misure sue. Se la pagina è stata letta
 * RADDRIZZATA, le parole arrivano nello spazio dell'immagine girata e
 * `pezziDaScrivere` le riporta su quella vera: da qui in giù la provenienza non
 * si vede più, ed è la ragione per cui quel passaggio sta prima e non dentro.
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

  const { PDFDocument, StandardFonts, PDFOperator, PDFOperatorNames, PDFNumber, PDFName } = require('pdf-lib');
  const Op = (nome, args) => PDFOperator.of(nome, args);
  const N = (v) => PDFNumber.of(v);
  let doc;
  try { doc = await PDFDocument.load(fs.readFileSync(percorsoPdf)); }
  catch (e) { return { error: 'il PDF non si apre: ' + (e.message || '?') }; }
  /* Due metriche tra cui scegliere RIGA PER RIGA: le schede fotografate sono
     spesso dattiloscritte (larghezze da monospazio, Courier) e spesso stampate
     (proporzionali, Helvetica). Con la scala unica di riga — obbligata, vedi
     sotto — sbagliare famiglia raddoppia l'errore di copertura: misurato sul
     contratto, Courier dimezza la mediana sulle pagine a macchina. */
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontMono = await doc.embedFont(StandardFonts.Courier);

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

    /* Prima la geometria di ogni parola, poi la scrittura PER RIGHE. */
    const daScrivere = [];
    for (const w of pezziDaScrivere(pag)) {
      const testo = scrivibile(font, String(w.testo || ''));
      if (!testo) { saltate++; continue; }
      /* Il corpo viene dall'altezza della RIGA: uniforme lungo la riga e grande
         quanto il testo che si vede — al 95% del riquadro della parola le
         selezioni uscivano visibilmente più piccole dell'originale (prova a
         mano, punto 2). Il riquadro della parola resta il limite per la
         larghezza (`Tz`, sotto). */
      const size = (w.altoPx > 0) ? (w.altoPx / scala) : 0;
      if (!(size >= PUNTI_MINIMI)) { saltate++; continue; }
      /* coordinate nello spazio VISTO, in punti (origine in alto a sinistra) */
      const vx = w.x0 / scala;
      const vy = w.base / scala;
      const largVista = w.largPx / scala;
      /* → spazio del contenuto (origine in basso a sinistra, non ruotato).
         Le quattro formule sono le inverse delle matrici del viewport di
         pdf.js per le quattro rotazioni — le stesse con cui il renderer ha
         prodotto l'immagine su cui Tesseract ha misurato. */
      let x, y, angolo;
      if (rot === 90) { x = vy; y = vx; angolo = 90; }
      else if (rot === 180) { x = W - vx; y = vy; angolo = 180; }
      else if (rot === 270) { x = W - vy; y = H - vx; angolo = 270; }
      else { x = vx; y = hVista - vy; angolo = 0; }
      /* ⚠️ E QUI il segno si inverte, una volta sola in tutto il file: nello
         spazio dell'immagine la y cresce verso il basso e un angolo positivo è
         una riga che SCENDE a destra; nel PDF la y cresce verso l'alto, e la
         stessa riga si ottiene ruotando dell'opposto. Sotto il decimo di grado
         non si tocca niente: inclinare un glifo di 0,1° è rumore che sposta la
         selezione senza raddrizzare niente. */
      const storta = Number.isFinite(w.angoloRiga) ? w.angoloRiga : 0;
      if (Math.abs(storta) >= GRADI_LAYER) angolo -= storta;
      daScrivere.push({ testo, x, y, vy, angolo, size, largVista, riga: w.riga });
    }

    /* ⚠️ UNA RIGA = UN OGGETTO DI TESTO (BT…ET), le parole dentro con `Td`, e
       — questa è la parte non negoziabile — LO STATO NON SI TOCCA MAI dentro
       la riga: un solo font, un solo corpo, un solo `Tz` per tutta la riga.
       Non è pignoleria da formato: pdf.js SCARTA lo spazio in coda a un run a
       OGNI cambio di stato (`Tz`, `Tf`, e anche `Tm`) — misurato con quattro
       esperimenti, uno per strada: parola-per-oggetto, spazio-oggetto (anche
       insecabile), scala nella matrice, cambio Tz in mezzo. Tutte finivano in
       «UZIONEDIDIRITTODIUS», che è lo schermo da cui è partito tutto. Con lo
       stato uniforme gli spazi sono interni al run e sopravvivono, anche a
       riga inclinata.
       Il prezzo dichiarato: la larghezza è esatta per RIGA (scala mediana sul
       font che fitta meglio) e l'ancora di OGNI parola è esatta (`Td` la
       inchioda al riquadro misurato); il bordo destro della singola parola
       può sbagliare di qualche percento. Meglio una parola che finisce mezzo
       carattere corta che una selezione senza spazi.
       L'invisibilità è `Tr 3` (testo che non si disegna), lo standard dei
       layer OCR: niente stato grafico da incorporare. */
    const perRiga = [];
    for (const pz of daScrivere) {
      const ultima = perRiga[perRiga.length - 1];
      if (ultima && ultima.length && ultima[0].riga != null && ultima[0].riga === pz.riga) ultima.push(pz);
      else perRiga.push([pz]);
    }
    p.setFont(font);                       // registra i font sulla pagina e dà le chiavi
    /* `fontKey` è GIÀ un PDFName (uniqueKey della pagina): riavvolgerlo in
       PDFName.of lo farebbe morire con «name.replace is not a function». */
    const chiaveElv = (typeof p.fontKey === 'string') ? PDFName.of(p.fontKey) : p.fontKey;
    p.setFont(fontMono);
    const chiaveMono = (typeof p.fontKey === 'string') ? PDFName.of(p.fontKey) : p.fontKey;
    /* La quota di ogni riga nello spazio VISTO: serve a non lasciare che una
       riga si prenda lo spazio della vicina (sotto). Si misura prima delle
       rotazioni di pagina, così vale per tutte e quattro. */
    const quote = perRiga.map((riga) => mediana(riga.map((pz) => pz.vy)));
    for (let iRiga = 0; iRiga < perRiga.length; iRiga++) {
      const riga = perRiga[iRiga];
      /* ⚠️ Il corpo della riga è la MEDIANA delle parole, non il massimo. Sul
         contratto vero la riga «CON COSTITUZIONE…» portava tre macchie della
         carta lette come parole («N», «¢», «Niel») alte 148 px contro le 44 del
         testo: col massimo, i glifi invisibili di quella riga diventavano alti
         due righe, coprivano il titolo sopra e gli rubavano il puntatore — il
         titolo si vedeva e non si poteva selezionare (schermo di Giacomo).
         ⚠️⚠️ E comunque nessuna riga può essere più alta della distanza dalla
         riga SOPRA: il glifo cresce verso l'alto dalla sua base, ed è di là che
         invade. Il pavimento al 60% evita che due sotto-righe vicinissime
         (testo e trattini) si strozzino a vicenda. */
      const mediaSize = mediana(riga.map((pz) => pz.size));
      let dSopra = Infinity;
      for (let j = 0; j < quote.length; j++) {
        if (j === iRiga) continue;
        const d = quote[iRiga] - quote[j];       // vy cresce verso il BASSO
        if (d > 0.5 && d < dSopra) dSopra = d;
      }
      const size = Math.max(mediaSize * 0.6, Math.min(mediaSize, dSopra * 1.2));
      /* Quale metrica somiglia di più a questa riga: si prova il rapporto
         riquadro/font parola per parola e vince il font col fit MEDIANO
         migliore — la mediana perché i trattini e i glifi rotti non devono
         decidere la scala delle parole vere. */
      let fontRiga = font, chiaveRiga = chiaveElv, tzRiga = 100, fitRiga = Infinity;
      for (const [f2, chiave2] of [[font, chiaveElv], [fontMono, chiaveMono]]) {
        const rapporti = [], perErr = [];
        for (const pz of riga) {
          let wf = 0;
          try { wf = f2.widthOfTextAtSize(pz.testo, size); } catch (e) { continue; }
          if (wf > 0 && pz.largVista > 2) { rapporti.push(pz.largVista / wf); perErr.push([pz.largVista, wf]); }
        }
        if (!rapporti.length) continue;
        /* ⚠️ Il QUANTILE BASSO, non la mediana, ed è una scelta di sopravvivenza:
           pdf.js spezza l'item quando una parola disegnata SCONFINA oltre il
           salto verso la prossima di più di 0,2 corpi (`negativeSpaceMax`,
           letto dal suo sorgente) — e con l'item muore lo spazio. Alla mediana
           metà delle parole sconfina; al quantile 0,2 quasi nessuna: le parole
           restano un filo strette e il vuoto lo riempiono gli spazi qui sotto,
           che è quello che pdf.js si aspetta da un PDF nativo. */
        const ordinati = rapporti.slice().sort((a, b) => a - b);
        const tzF = ordinati[Math.floor(ordinati.length * 0.2)];
        const errore = mediana(perErr.map(([larg, wf]) => Math.abs(wf * tzF - larg) / larg));
        if (errore < fitRiga) { fitRiga = errore; fontRiga = f2; chiaveRiga = chiave2; tzRiga = Math.max(1, tzF * 100); }
      }
      /* ⚠️ Le parole non codificabili si tolgono PRIMA di incatenare i `Td`:
         ogni delta punta alla parola EMESSA precedente, e un buco in mezzo
         sposterebbe tutto il resto della riga del suo scarto. */
      const daEmettere = riga
        .map((pz) => ({ pz, testo: scrivibile(fontRiga, pz.testo) }))
        .filter((v) => { if (!v.testo) saltate++; return !!v.testo; });
      if (!daEmettere.length) continue;
      /* ⚠️ L'angolo della Tm si STIMA DALLE ANCORE (regressione), non si eredita
         dalla baseline di Tesseract — e il `Td` fra le parole viaggia SENZA
         componente verticale. pdf.js spezza l'item anche per un punto di
         dislivello fra un salto e l'altro, e con l'item muore lo spazio: nella
         stessa pagina il titolo (ancore sulla baseline della sua Tm) restava
         intero, «fra di loro» (dy residuo ~1 pt) usciva spezzato e incollato.
         Con l'asse della Tm ADAGIATO sulle ancore, i residui verticali sono
         sotto il pixel: si assorbono, e nessuno se ne accorge. */
      let th = daEmettere[0].pz.angolo * Math.PI / 180;
      if (daEmettere.length >= 2) {
        const n2 = daEmettere.length;
        let sx = 0, sy = 0, sxx = 0, sxy = 0;
        for (const v of daEmettere) { sx += v.pz.x; sy += v.pz.y; sxx += v.pz.x * v.pz.x; sxy += v.pz.x * v.pz.y; }
        const den = n2 * sxx - sx * sx;
        const span = Math.max.apply(null, daEmettere.map((v) => v.pz.x)) -
                     Math.min.apply(null, daEmettere.map((v) => v.pz.x));
        if (Math.abs(den) > 1e-6 && span > 20) th = Math.atan((n2 * sxy - sx * sy) / den);
      }
      const c = Math.cos(th), s = Math.sin(th);
      const ops = [
        Op(PDFOperatorNames.BeginText, []),
        Op(PDFOperatorNames.SetTextRenderingMode, [N(3)]),
        Op(PDFOperatorNames.SetFontAndSize, [chiaveRiga, N(size)]),
        Op(PDFOperatorNames.SetTextHorizontalScaling, [N(tzRiga)]),
        Op(PDFOperatorNames.SetTextMatrix, [N(c), N(s), N(-s), N(c), N(daEmettere[0].pz.x), N(daEmettere[0].pz.y)])
      ];
      let spazioW = 0;
      try { spazioW = fontRiga.widthOfTextAtSize(' ', size) * tzRiga / 100; } catch (e) { spazioW = size * 0.3; }
      for (let k = 0; k < daEmettere.length; k++) {
        const { pz, testo } = daEmettere[k];
        if (k > 0) {
          /* Lo spostamento alla parola dopo, nello spazio del TESTO: `Td` è
             relativo all'inizio riga corrente, quindi il delta di pagina si
             riporta indietro con la rotazione inversa. Niente contabilità
             degli avanzamenti: ogni parola atterra sulla SUA ancora misurata,
             e gli errori non si accumulano lungo la riga. */
          const dX = pz.x - daEmettere[k - 1].pz.x, dY = pz.y - daEmettere[k - 1].pz.y;
          /* solo lungo la riga: il residuo verticale è già sotto il pixel per
             costruzione della Tm, e dichiararlo farebbe spezzare l'item */
          ops.push(Op(PDFOperatorNames.MoveText, [N(c * dX + s * dY), N(0)]));
        }
        /* ⚠️ Gli spazi in coda: TANTI quanti ne servono a coprire il resto del
           riquadro di questa parola E il vuoto fino alla prossima, non uno per
           cortesia. Due ragioni, tutte e due misurate:
           1. pdf.js fonde due run nello stesso item solo se il salto del `Td`
              combacia con l'avanzamento disegnato; sui vuoti larghi della
              dattilografia («fra   di   loro») un solo spazio lasciava uno
              scarto grande, l'item si spezzava e lo spazio pendente moriva;
           2. le lunghe file di trattini che Tesseract legge come parole di due
              lettere («Em» per 404 px di filetto) verrebbero coperte al 10%:
              il resto del riquadro lo riempiono gli spazi, che sono testo
              selezionabile quanto le lettere.
           Il tetto è largo (40) perché un filetto di trattini è lungo davvero;
           più di così è un salto fra due colonne, e quello resta un salto. */
        let avanz = 0;
        try { avanz = fontRiga.widthOfTextAtSize(testo, size) * tzRiga / 100; } catch (e) { avanz = pz.largVista; }
        let daCoprire = Math.max(0, pz.largVista - avanz);   // il resto del riquadro suo
        if (k < daEmettere.length - 1) {
          const prossimo = daEmettere[k + 1].pz;
          const dxTesto = c * (prossimo.x - pz.x) + s * (prossimo.y - pz.y);
          daCoprire = Math.max(daCoprire, dxTesto - avanz);   // fino alla parola dopo
        }
        const nSpazi = (spazioW > 0)
          ? Math.max(1, Math.min(40, Math.round(daCoprire / spazioW))) : 1;
        ops.push(Op(PDFOperatorNames.ShowText, [fontRiga.encodeText(testo + ' '.repeat(nSpazi))]));
      }
      ops.push(Op(PDFOperatorNames.EndText, []));
      try { p.pushOperators.apply(p, ops); scritte += daEmettere.length; }
      catch (e) { saltate += daEmettere.length; }
    }
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
       e copriva il 78% (vedi scriviLayer).
       ⚠️ Gli item di SOLO spazio restano dentro: sono gli spazi che pdf.js
       mette fra un pezzo e l'altro, cioè esattamente ciò che la selezione
       copia. Un filtro `str.trim()` qui ha fatto sembrare rotto un layer sano
       per tre iterazioni di seguito: lo strumento di misura mentiva, non il
       misurato. */
    const items = tc.items.filter((i) => i.str.length > 0).map((i) =>
      ({ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width,
         /* l'inclinazione con cui il glifo è finito nel file: `a` e `b` della
            matrice sono coseno e seno della rotazione */
         gradi: Math.atan2(i.transform[1], i.transform[0]) * 180 / Math.PI }));
    try { await doc.destroy(); } catch (e) {}
    if (!testo) return { error: 'il testo non si rilegge dalla pagina ' + prima };
    return { error: '', testo, items };
  } catch (e) {
    return { error: 'rilettura fallita: ' + (e.message || '?') };
  }
}

module.exports = {
  CONF_MINIMA, PUNTI_MINIMI, GRADI_LAYER, GRADI_RADDRIZZA, GRADI_MAX,
  apri, chiudi, riconosci,
  angoloBaseline, mediana, pianoRaddrizzamento, aRuotato, daRuotato,
  riportaParole, pezziDaScrivere,
  scriviLayer, verifica, sha1, scrivibile
};
