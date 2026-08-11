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
const corsi = require('./corsi');       // cartella(): risolve `Corsi/` e `Zaini/`
const mat = require('./materiali');     // CARTELLA, e il nome della sottocartella dei PDF

const SOTTO_PDF = 'PDF';
const SOTTO_INDICI = 'Indici-PDF';

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
  let numero = prossimoNumero(elenco(vault, id));
  for (const src of (Array.isArray(sorgenti) ? sorgenti : [])) {
    const p = str(src);
    if (!p) continue;
    if (!/\.pdf$/i.test(p)) { scartati.push({ file: path.basename(p), motivo: 'non è un PDF' }); continue; }
    let st;
    try { st = fs.statSync(p); }
    catch (e) { scartati.push({ file: path.basename(p), motivo: 'non si legge' }); continue; }
    if (!st.isFile()) { scartati.push({ file: path.basename(p), motivo: 'non è un file' }); continue; }
    const nome = nomeDestinazione(path.basename(p), numero);
    try { fs.copyFileSync(p, path.join(dir, nome)); }
    catch (e) { scartati.push({ file: path.basename(p), motivo: e.message || 'copia fallita' }); continue; }
    copiati.push({ da: p, nome, quando: str(quando) || new Date().toISOString() });
    numero++;
  }
  return { copiati, scartati, error: '' };
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
  importa, percorsoIndice, haIndice, scriviIndice, leggiIndici
};
