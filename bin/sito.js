#!/usr/bin/env node
'use strict';
/**
 * sito — costruisce in `dist/sito/` le due pagine per www.insegnai.ch/studia-zaino/:
 *
 *   dist/sito/index.html        la presentazione dell'app        → /studia-zaino/
 *   dist/sito/guida/            la guida, autonoma dal repo      → /studia-zaino/guida/
 *
 * La guida NON si riscrive: è `App/guida-zaino/` — la stessa che l'app apre dal «?» —
 * copiata con i suoi screenshot e resa autonoma (il marchio e il font OpenMoji stavano
 * fuori dalla cartella, in `App/assets/`). Una seconda copia da mantenere a mano
 * divergerebbe al primo ritocco: questo script è la ricetta, `dist/sito/` il prodotto.
 *
 *     node bin/sito.js            costruisce e verifica (ogni <img> deve esistere)
 *
 * Gli screenshot si rigenerano prima, sull'app viva: `bash bin/guida-zaino.sh`.
 */
const fs = require('fs');
const path = require('path');

const RADICE = path.join(__dirname, '..');
const GUIDA = path.join(RADICE, 'App', 'guida-zaino');
const SITO = path.join(RADICE, 'sito');
const USCITA = path.join(RADICE, 'dist', 'sito');
const OGGI = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const URL_SITO = 'https://www.insegnai.ch/studia-zaino/';

function copia(da, a) {
  fs.mkdirSync(path.dirname(a), { recursive: true });
  fs.copyFileSync(da, a);
}
function copiaCartella(da, a) {
  let n = 0;
  for (const f of fs.readdirSync(da)) {
    const p = path.join(da, f);
    if (fs.statSync(p).isDirectory()) { n += copiaCartella(p, path.join(a, f)); continue; }
    if (f.startsWith('.')) continue;
    copia(p, path.join(a, f)); n++;
  }
  return n;
}

function guida() {
  let html = fs.readFileSync(path.join(GUIDA, 'index.html'), 'utf8');
  const sostituisci = (da, a, nome) => {
    if (!html.includes(da)) throw new Error('guida: non trovo «' + nome + '» — la guida è cambiata, aggiorna bin/sito.js');
    html = html.split(da).join(a);
  };
  // il marchio stava fuori dalla cartella: nel sito vive dentro `img/`
  sostituisci('src="../assets/1F392.svg"', 'src="img/1F392.svg"', 'marchio');
  // cache-bust con la data di costruzione: chi ricarica vede il CSS nuovo
  html = html.replace(/stile\.css\?v=\d+/, 'stile.css?v=' + OGGI).replace(/guida\.js\?v=\d+/, 'guida.js?v=' + OGGI);
  // dalla guida si torna alla presentazione: il marchio in testata porta a `../`
  sostituisci('<a class="brand" href="#inizio">', '<a class="brand" href="../" title="Torna alla presentazione di StudIA - ZAINO">', 'brand');
  sostituisci('<title>Guida di StudIA - ZAINO</title>',
    '<title>Guida di StudIA - ZAINO</title>\n<link rel="canonical" href="' + URL_SITO + 'guida/">', 'title');
  fs.mkdirSync(path.join(USCITA, 'guida'), { recursive: true });
  fs.writeFileSync(path.join(USCITA, 'guida', 'index.html'), html);
  copia(path.join(GUIDA, 'stile.css'), path.join(USCITA, 'guida', 'stile.css'));
  copia(path.join(GUIDA, 'guida.js'), path.join(USCITA, 'guida', 'guida.js'));
  const immagini = copiaCartella(path.join(GUIDA, 'img'), path.join(USCITA, 'guida', 'img'));
  copia(path.join(RADICE, 'App', 'assets', '1F392.svg'), path.join(USCITA, 'guida', 'img', '1F392.svg'));
  copia(path.join(RADICE, 'App', 'assets', 'fonts', 'OpenMoji-color.woff2'), path.join(USCITA, 'guida', 'assets', 'fonts', 'OpenMoji-color.woff2'));
  return immagini;
}

function presentazione() {
  let html = fs.readFileSync(path.join(SITO, 'index.html'), 'utf8');
  html = html.replace(/presentazione\.css\?v=\d+/, 'presentazione.css?v=' + OGGI);
  fs.writeFileSync(path.join(USCITA, 'index.html'), html);
  copia(path.join(SITO, 'presentazione.css'), path.join(USCITA, 'presentazione.css'));
}

/** Ogni <img src> e ogni url() locale delle due pagine deve esistere nell'uscita: un'immagine rotta sul sito non la vede nessuno prima del lettore. */
function verifica() {
  const problemi = [];
  for (const pagina of ['index.html', path.join('guida', 'index.html')]) {
    const file = path.join(USCITA, pagina), dir = path.dirname(file);
    const html = fs.readFileSync(file, 'utf8');
    const src = [...html.matchAll(/(?:src|href)="([^"#?]+)(?:\?[^"]*)?"/g)].map((m) => m[1])
      .filter((u) => !/^(https?:|mailto:|\/)/.test(u) && !u.startsWith('#'));
    for (const u of new Set(src)) {
      // il pacchetto (.dmg) non viaggia con le pagine: si carica accanto a index.html, con questo nome
      if (/\.dmg$/.test(u)) { console.log('  ↳ da caricare accanto a ' + pagina + ': ' + u); continue; }
      if (!fs.existsSync(path.join(dir, u))) problemi.push(pagina + ' → ' + u);
    }
  }
  const css = fs.readFileSync(path.join(USCITA, 'presentazione.css'), 'utf8');
  for (const m of css.matchAll(/url\('([^')]+)'\)/g)) {
    if (!/^(https?:|data:)/.test(m[1]) && !fs.existsSync(path.join(USCITA, m[1]))) problemi.push('presentazione.css → ' + m[1]);
  }
  return problemi;
}

function peso(dir) {
  let tot = 0;
  for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); const s = fs.statSync(p); tot += s.isDirectory() ? peso(p) : s.size; }
  return tot;
}

function main() {
  if (fs.existsSync(USCITA)) fs.rmSync(USCITA, { recursive: true });   // solo la NOSTRA uscita, sotto dist/
  const immagini = guida();
  presentazione();
  const problemi = verifica();
  if (problemi.length) { console.error('✗ riferimenti rotti:\n  ' + problemi.join('\n  ')); process.exit(1); }
  console.log('dist/sito/  ·  guida con ' + immagini + ' immagini  ·  ' + Math.round(peso(USCITA) / 1024 / 1024) + ' MB  ·  v=' + OGGI);
}

if (require.main === module) main();
module.exports = { guida, presentazione, verifica, USCITA };
