'use strict';
/**
 * fonti — i documenti che entrano in un contenitore, e il loro indice.
 *
 * Nello zaino i PDF li porta l'utente: li trascina dentro, e da quel momento
 * sono dell'app. Qui c'è che cosa vuol dire «portarli dentro»:
 *
 *   1. **si copiano**, non si linkano. Un file linkato è una fonte che si rompe
 *      appena lo si sposta, ed è il difetto di Braynr che il PIANO-BRAYNR
 *      (§0-ter) dice esplicitamente di non ereditare;
 *   2. **prendono un numero**, come i materiali di un corso: è quel numero che
 *      rende scrivibile un rimando `pdf:03#p=7`, cioè quel che lega una parola
 *      chiave al punto da cui viene;
 *   3. **si indicizzano per pagina**, e l'indice serve SOLO alla ricerca: non si
 *      mostra mai come testo. Senza, la lente della topbar in modalità zaino non
 *      cercherebbe niente.
 *
 * ⚠️ Chi ha letto il documento si scrive nell'indice (`motore`). Nello zaino è
 * `pdfjs` — il testo lo estrae il visualizzatore che è già nell'app, senza
 * Python e senza modelli. È la stessa regola di `lib/ocr.js`: un vault non deve
 * poter contenere indici di tre provenienze senza che si sappia quale.
 *
 * Niente DOM, niente Electron: gira in Node e si prova con `node test/fonti.js`.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const corsi = require('./corsi');       // cartella(): risolve `Corsi/` e `Zaini/`
const mat = require('./materiali');     // CARTELLA, e il nome della sottocartella dei PDF

const SOTTO_PDF = 'PDF';
const SOTTO_INDICI = 'Indici-PDF';
/* Il registro delle fonti tolte. Vive accanto ai documenti e non dentro `PDF/`,
   che deve contenere documenti e basta. Vedi `elimina()` per che cosa ci sta
   dentro e perché. */
const RIMOSSI = '_rimossi.json';

function str(v) { return typeof v === 'string' ? v : (v == null ? '' : String(v)); }

/** Il contenitore è una cartella dentro `Corsi/` o `Zaini/`, e nient'altro. */
function idValido(id) {
  const s = str(id);
  return !!s && s.indexOf('/') < 0 && s.indexOf('\\') < 0 && s.indexOf('..') < 0;
}

function dirPdf(vault, id) { return path.join(corsi.cartella(vault, id), mat.CARTELLA, SOTTO_PDF); }
function dirIndici(vault, id) { return path.join(corsi.cartella(vault, id), mat.CARTELLA, SOTTO_INDICI); }

/** I documenti già dentro, in ordine. */
function elenco(vault, id) {
  if (!vault || !idValido(id)) return [];
  try {
    return fs.readdirSync(dirPdf(vault, id))
      .filter((n) => !n.startsWith('.') && /\.pdf$/i.test(n))
      .sort((a, b) => a.localeCompare(b, 'it'));
  } catch (e) { return []; }
}

/**
 * Il prossimo numero libero.
 *
 * ⚠️ Si guarda il MASSIMO, non il conteggio: cancellando il 02 di tre
 * documenti, il conteggio direbbe 3 e il numero 03 esisterebbe già. Due
 * materiali con lo stesso numero vogliono dire un rimando `pdf:03` che apre
 * quello sbagliato — senza errore.
 */
function prossimoNumero(nomi) {
  let max = 0;
  for (const n of (nomi || [])) {
    const m = /^(\d{1,3})\b/.exec(str(n));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

/** Due cifre, come i materiali di un corso. */
function nn(n) { return String(n).padStart(2, '0'); }

/**
 * Il nome con cui un file entra: `NN titolo.pdf`.
 *
 * Il numero di partenza del file d'origine si toglie — «03 dispensa.pdf» portato
 * in uno zaino che ha già tre documenti diventa «04 dispensa.pdf», non
 * «04 03 dispensa.pdf». E i caratteri che sul disco fanno danno spariscono: il
 * nome arriva da fuori, e `/` dentro un nome è una cartella che nessuno ha
 * chiesto.
 */
function nomeDestinazione(nomeOrigine, numero) {
  const base = path.basename(str(nomeOrigine));
  const senzaExt = base.replace(/\.pdf$/i, '');
  const pulito = senzaExt
    .replace(/^\d{1,3}[\s._-]+/, '')          // il numero di prima non si eredita
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, ' ')   // ciò che un file system non vuole
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90) || 'documento';
  return nn(numero) + ' ' + pulito + '.pdf';
}

/**
 * Copia dei documenti dentro il contenitore.
 *
 * Torna che cosa è entrato e che cosa no, **con il motivo**: un import che
 * ingoia in silenzio ciò che non capisce lascia l'utente a chiedersi dove sia
 * finito il suo file.
 */
function importa(vault, id, sorgenti, quando) {
  if (!vault || !idValido(id)) return { copiati: [], scartati: [], error: 'contenitore non valido' };
  const dir = dirPdf(vault, id);
  try { fs.mkdirSync(dir, { recursive: true }); }
  catch (e) { return { copiati: [], scartati: [], error: e.message || 'cartella non creata' }; }

  const copiati = [], scartati = [];
  /* ⚠️ I numeri delle fonti TOLTE restano occupati finché la loro lapide vive.
     Misurato scrivendo la prova: tolto «01 dispensa.pdf», il documento
     importato subito dopo prendeva il numero 01 — e quando la dispensa tornava,
     nel contenitore c'erano due `01`. Un rimando `pdf:01` non avrebbe più
     saputo chi aprire, ed è esattamente il legame che la lapide esiste per
     salvare. Il numero di una fonte tolta è prenotato per il suo ritorno. */
  let numero = prossimoNumero(elenco(vault, id).concat(rimossi(vault, id).map((r) => r.nome)));
  for (const src of (Array.isArray(sorgenti) ? sorgenti : [])) {
    const p = str(src);
    if (!p) continue;
    if (!/\.pdf$/i.test(p)) { scartati.push({ file: path.basename(p), motivo: 'non è un PDF' }); continue; }
    let st;
    try { st = fs.statSync(p); }
    catch (e) { scartati.push({ file: path.basename(p), motivo: 'non si legge' }); continue; }
    if (!st.isFile()) { scartati.push({ file: path.basename(p), motivo: 'non è un file' }); continue; }
    /* ⚠️ È un RITORNO? Se questo contenuto era già stato tolto da qui, riprende
       il nome e il numero di allora: le evidenze, i ritagli, gli appunti e i
       nodi di mappa che lo nominavano tornano ad agganciarsi da soli, senza che
       si riscriva un solo file dell'utente. Il numero si riusa **solo** qui,
       dove l'impronta prova che è lo stesso documento — riciclarlo in generale
       farebbe puntare i vecchi `pdf:03` a un'altra cosa. */
    const lapide = lapideDi(vault, id, p);
    let nome, tornata = false;
    if (lapide && !fs.existsSync(path.join(dir, lapide.nome))) { nome = lapide.nome; tornata = true; }
    else nome = nomeDestinazione(path.basename(p), numero);
    try { fs.copyFileSync(p, path.join(dir, nome)); }
    catch (e) { scartati.push({ file: path.basename(p), motivo: e.message || 'copia fallita' }); continue; }
    copiati.push({ da: p, nome, tornata, quando: str(quando) || new Date().toISOString() });
    /* La lapide si toglie solo quando il documento è tornato davvero al suo
       posto: un registro che dimentica una fonte ancora assente le negherebbe
       il riaggancio al tentativo dopo. */
    if (tornata) scriviRimossi(vault, id, rimossi(vault, id).filter((r) => r && r.impronta !== lapide.impronta));
    else numero++;
  }
  return { copiati, scartati, error: '' };
}

/* ===========================================================================
   TOGLIERE UNA FONTE, SENZA STACCARE IL LAVORO CHE CI STA SOPRA
   ===========================================================================
   Una fonte non è un file: è il capo di un filo a cui sono legate evidenze,
   ritagli, appunti e nodi di mappa. Il legame è il NOME (`03 dispensa.pdf`),
   perché è il nome che compare nei rimandi `pdf:03#p=7`.

   Il guaio nasce al ritorno. Se domani si reimporta lo stesso PDF, prende il
   numero successivo libero — `12 dispensa.pdf` — e per l'app è un altro
   documento: le evidenze di prima restano orfane per sempre, pur avendo
   davanti il file da cui erano state prese.

   Il rimedio è una LAPIDE: togliendo la fonte si scrive in `_rimossi.json`
   l'impronta del suo contenuto insieme al nome che aveva. Reimportando, se
   l'impronta combacia, il documento **riprende il nome e il numero di prima** e
   tutto si riaggancia da sé — senza toccare un solo file dell'utente.

   ⚠️ L'impronta è del CONTENUTO, non del nome. Il nome è quello che l'utente
   può cambiare, e un riaggancio basato sul nome riattaccherebbe le evidenze di
   «dispensa.pdf» a un dispensa.pdf qualunque, che è peggio del non riagganciare.

   ⚠️ E il numero si riusa SOLO su impronta uguale. Riciclare un numero libero
   in generale farebbe puntare i vecchi `pdf:03` a un documento diverso: è la
   stessa azione con l'esito opposto, e la differenza è tutta nella prova che si
   tratti dello stesso documento.
*/

/** L'impronta del contenuto di un file. Sha1: qui serve a riconoscere, non a
 *  proteggere. Su un PDF da 50 MB costa una lettura, e si paga una volta sola. */
function impronta(percorso) {
  try {
    return crypto.createHash('sha1').update(fs.readFileSync(percorso)).digest('hex');
  } catch (e) { return ''; }
}

function percorsoRimossi(vault, id) {
  return path.join(corsi.cartella(vault, id), mat.CARTELLA, RIMOSSI);
}

/** Le lapidi di un contenitore. Un file illeggibile o storto vale «nessuna»:
 *  un registro rotto non deve impedire di importare un documento. */
function rimossi(vault, id) {
  if (!vault || !idValido(id)) return [];
  try {
    const d = JSON.parse(fs.readFileSync(percorsoRimossi(vault, id), 'utf8'));
    return Array.isArray(d && d.fonti) ? d.fonti : [];
  } catch (e) { return []; }
}

function scriviRimossi(vault, id, lista) {
  const p = percorsoRimossi(vault, id);
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify({ formato: 1, fonti: lista }, null, 1) + '\n', 'utf8');
    return '';
  } catch (e) { return e.message || 'registro non scritto'; }
}

/**
 * Toglie un documento dal contenitore e ne scrive la lapide.
 *
 * `cestina` è iniettata da chi chiama: nell'app è `shell.trashItem` di Electron,
 * così il file finisce nel Cestino di sistema e si recupera con un gesto. Qui
 * non si importa Electron — questo modulo gira in Node — e chi non passa niente
 * ottiene la cancellazione vera, che è ciò che serve alle prove.
 *
 * ⚠️ L'impronta si calcola PRIMA di togliere il file: dopo non c'è più niente da
 * leggere, e la lapide nascerebbe senza la sola cosa che la rende utile.
 */
async function elimina(vault, id, nome, opt) {
  const o = opt || {};
  if (!vault || !idValido(id)) return { error: 'contenitore non valido' };
  const f = path.basename(str(nome));
  if (!f || !/\.pdf$/i.test(f)) return { error: 'non è un documento' };
  const p = path.join(dirPdf(vault, id), f);
  try { if (!fs.statSync(p).isFile()) return { error: 'non è un file' }; }
  catch (e) { return { error: 'documento non trovato' }; }

  const imp = impronta(p);
  let pagine = 0;
  try { pagine = (JSON.parse(fs.readFileSync(percorsoIndice(vault, id, f), 'utf8')).pages || []).length; }
  catch (e) { /* senza indice si vive: è un dato della lapide, non una condizione */ }

  try {
    if (typeof o.cestina === 'function') await o.cestina(p);
    else fs.unlinkSync(p);
  } catch (e) { return { error: e.message || 'documento non rimosso' }; }

  /* L'indice va via col documento: lasciarlo vuol dire una lente che trova
     pagine di un documento che non c'è più, e un click che non apre niente. */
  try { fs.unlinkSync(percorsoIndice(vault, id, f)); } catch (e) { /* poteva non esserci */ }

  const lista = rimossi(vault, id).filter((r) => r && r.impronta !== imp);
  lista.push({ nome: f, impronta: imp, pagine, tolto: str(o.quando) || new Date().toISOString() });
  const err = scriviRimossi(vault, id, lista);
  /* ⚠️ Se la lapide non si scrive il documento è comunque già tolto: si dice, e
     non si finge che sia andato tutto bene. Chi legge saprà che reimportandolo
     non si riaggancerà da sé. */
  return { file: f, impronta: imp, error: '', avviso: err ? ('traccia non scritta: ' + err) : '' };
}

/**
 * Chi si appoggia a questo documento: evidenze, appunti, mappe, ritagli.
 *
 * ⚠️ Si chiede PRIMA di togliere, e chi non può rispondere lo dice: un file che
 * non si legge potrebbe contenere un riferimento, e «non lo so» non è «no». È
 * la regola già scritta in `lib/album.js` per le immagini, e vale qui per lo
 * stesso motivo — chi conferma deve sapere che cosa sta staccando.
 *
 * Non impedisce niente: la traccia lasciata da `elimina()` fa sì che un ritorno
 * riagganci tutto. Serve a dire quanto lavoro c'è appeso, perché «togliere una
 * fonte» e «togliere una fonte da cui hai preso quarantatré parole chiave»
 * meritano due decisioni diverse.
 */
function usi(vault, id, nome) {
  const out = { evidenze: 0, appunti: [], mappe: [], ritagli: 0, quanti: 0, illeggibili: [], error: '' };
  if (!vault || !idValido(id)) { out.error = 'contenitore non valido'; return out; }
  const f = path.basename(str(nome));
  if (!f) { out.error = 'documento non valido'; return out; }
  const base = corsi.cartella(vault, id);

  /* ⚠️ Evidenze e ritagli si chiedono ai LORO moduli, non rileggendo il JSON a
     mano: sanno già che una lista può essere un array o un oggetto con dentro
     l'array, e sanno potare i doppioni. Due lettori dello stesso file divergono
     al primo cambio di formato — e lì il conto sbagliato lo si scoprirebbe
     davanti a una conferma di cancellazione, cioè troppo tardi. */
  const letteEv = require('./evidenze').leggi(vault, id);
  if (letteEv.error) out.illeggibili.push('_evidenze.json');
  out.evidenze = (letteEv.evidenze || []).filter((x) => x && x.materiale === f).length;

  /* Appunti e mappe possono nominarlo in due modi: nel campo `materiale` (da
     dove nascono) oppure dentro un rimando `pdf:NN` scritto nel testo. Si cerca
     il NOME e il suo NUMERO, che è la forma con cui compare nei rimandi. */
  const num = (/^(\d{2})\s/.exec(f) || [])[1] || '';
  const re = new RegExp(escapeRe(f) + (num ? '|pdf:' + num + '(?![0-9])' : ''));
  for (const [cart, ext, dove] of [['APPUNTI', /\.md$/i, 'appunti'], ['MAPPE', /\.json$/i, 'mappe']]) {
    let files = [];
    try { files = fs.readdirSync(path.join(base, cart)); }
    catch (e) { if (e.code !== 'ENOENT') out.illeggibili.push(cart + '/'); continue; }
    for (const nf of files.sort()) {
      if (!ext.test(nf) || nf.charAt(0) === '_' || nf.charAt(0) === '.') continue;
      try { if (re.test(fs.readFileSync(path.join(base, cart, nf), 'utf8'))) out[dove].push(nf); }
      catch (e2) { out.illeggibili.push(nf); }
    }
  }

  /* I ritagli dell'album portano il documento da cui sono stati presi. */
  const letteAl = require('./album').leggiIndice(vault, id);
  if (letteAl.error) out.illeggibili.push('_album.json');
  out.ritagli = (letteAl.voci || []).filter((x) => x && x.materiale === f).length;

  out.quanti = out.evidenze + out.appunti.length + out.mappe.length + out.ritagli;
  return out;
}

function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/**
 * Dimentica una lapide: la fonte non tornerà, e il suo numero torna libero.
 *
 * ⚠️ Da qui in poi un documento con quel contenuto reimportato è un documento
 * NUOVO, con un numero nuovo, e le evidenze di prima restano orfane per sempre.
 * È l'unico gesto irreversibile di questa storia, e per questo è separato dal
 * togliere: chi toglie una fonte quasi sempre non sta decidendo anche questo.
 */
function dimentica(vault, id, impronta_) {
  if (!vault || !idValido(id)) return { error: 'contenitore non valido' };
  const prima = rimossi(vault, id);
  const dopo = prima.filter((r) => r && r.impronta !== str(impronta_));
  if (dopo.length === prima.length) return { error: 'traccia non trovata' };
  const err = scriviRimossi(vault, id, dopo);
  return { error: err, tolte: prima.length - dopo.length };
}

/** La lapide che corrisponde a un file, se c'è. È la domanda che si fa
 *  l'importazione prima di assegnare un numero nuovo. */
function lapideDi(vault, id, percorsoSorgente) {
  const imp = impronta(percorsoSorgente);
  if (!imp) return null;
  return rimossi(vault, id).filter((r) => r && r.impronta === imp)[0] || null;
}

/** Dove sta l'indice di un documento. */
function percorsoIndice(vault, id, nomePdf) {
  const base = path.basename(str(nomePdf)).replace(/\.pdf$/i, '');
  return path.join(dirIndici(vault, id), base + '.json');
}

/** C'è già un indice per questo documento? */
function haIndice(vault, id, nomePdf) {
  if (!vault || !idValido(id) || !str(nomePdf)) return false;
  try { return fs.statSync(percorsoIndice(vault, id, nomePdf)).size > 0; } catch (e) { return false; }
}

/**
 * Scrive l'indice per pagina.
 *
 * La forma è quella che `ingest.py` scrive da sempre — `{pdf, npages, pages:[{page,text}]}` —
 * più `motore`, perché chi legge un indice deve poter sapere chi l'ha scritto.
 * Cambiarla vorrebbe dire due formati per la stessa cosa, e la ricerca dovrebbe
 * conoscerli entrambi.
 */
function scriviIndice(vault, id, nomePdf, pagine, motore) {
  if (!vault || !idValido(id)) return { error: 'contenitore non valido' };
  const nome = path.basename(str(nomePdf));
  if (!nome || !/\.pdf$/i.test(nome)) return { error: 'documento non valido' };
  const lista = (Array.isArray(pagine) ? pagine : []).map((p, i) => ({
    page: Number.isFinite(+(p && p.page)) ? Math.trunc(+p.page) : i + 1,
    text: str(p && p.text).replace(/\s+/g, ' ').trim()
  }));
  const dir = dirIndici(vault, id);
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* c'è già */ }
  const corpo = JSON.stringify({ pdf: nome, npages: lista.length, motore: str(motore) || 'pdfjs', pages: lista }, null, 1) + '\n';
  const p = percorsoIndice(vault, id, nome);
  try {
    const tmp = p + '.tmp';
    fs.writeFileSync(tmp, corpo, 'utf-8');
    fs.renameSync(tmp, p);
  } catch (e) { return { error: e.message || 'scrittura fallita' }; }
  return { error: '', file: path.basename(p), npages: lista.length };
}

/**
 * Tutti gli indici del contenitore, per la ricerca.
 *
 * ⚠️ Un indice illeggibile si dichiara invece di sparire: «questo documento non
 * contiene la parola cercata» e «questo documento non l'ho potuto leggere» sono
 * due risposte diverse, e la seconda va detta.
 */
function leggiIndici(vault, id) {
  if (!vault || !idValido(id)) return { documenti: [], illeggibili: [], error: 'contenitore non valido' };
  const dir = dirIndici(vault, id);
  let files;
  try { files = fs.readdirSync(dir); }
  catch (e) { return { documenti: [], illeggibili: [], error: e.code === 'ENOENT' ? '' : (e.message || 'lettura fallita') }; }
  const documenti = [], illeggibili = [];
  for (const f of files.sort((a, b) => a.localeCompare(b, 'it'))) {
    if (!f.toLowerCase().endsWith('.json') || f.startsWith('.')) continue;
    let dati;
    try { dati = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')); }
    catch (e) { illeggibili.push({ file: f, motivo: e.message || 'non è JSON' }); continue; }
    const pagine = Array.isArray(dati && dati.pages) ? dati.pages : [];
    documenti.push({
      pdf: str(dati && dati.pdf) || f.replace(/\.json$/i, '') + '.pdf',
      motore: str(dati && dati.motore),
      pagine: pagine.map((p, i) => ({
        page: Number.isFinite(+(p && p.page)) ? Math.trunc(+p.page) : i + 1,
        text: str(p && p.text)
      })).filter((p) => p.text)
    });
  }
  return { documenti, illeggibili, error: '' };
}

module.exports = {
  SOTTO_PDF, SOTTO_INDICI,
  idValido, dirPdf, dirIndici, elenco, prossimoNumero, nomeDestinazione,
  importa, percorsoIndice, haIndice, scriviIndice, leggiIndici,
  RIMOSSI, impronta, rimossi, elimina, lapideDi, dimentica, usi
};
