'use strict';
/* Crediti e licenze — l'inventario di TUTTO ciò che StudIA spedisce o richiama.
 *
 * Perché un generatore e non un elenco scritto a mano: un elenco a mano è la
 * trappola ④ (la seconda copia che diverge). Le dipendenze npm cambiano a ogni
 * `npm install`, e una schermata delle licenze che non le segue è peggio che
 * non averla — dichiara una cosa falsa. Qui l'elenco si RICAVA da node_modules
 * (nome, versione, licenza dichiarata, copyright, testo integrale della
 * licenza) e si unisce a ciò che npm non può sapere: le librerie vendorizzate a
 * mano in App/assets/, gli strumenti Python della pipeline, la piattaforma
 * (Electron/Chromium/Node/ffmpeg), i modelli di dati e i servizi remoti.
 * Quella parte sta in un file dichiarativo, `App/assets/dati/crediti-extra.json`,
 * col testo delle licenze in `App/assets/licenze/`.
 *
 * Il risultato è `App/assets/dati/crediti.json`, committato: l'app lo legge dal
 * disco (nessuna rete, funziona nel .dmg firmato). Si rigenera con
 * `npm run crediti`, e `test/crediti.js` fallisce se è rimasto indietro. */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RADICE = path.join(__dirname, '..');
const USCITA = path.join(RADICE, 'App', 'assets', 'dati', 'crediti.json');
const EXTRA = path.join(RADICE, 'App', 'assets', 'dati', 'crediti-extra.json');
const LICENZE = path.join(RADICE, 'App', 'assets', 'licenze');

/* I nomi di file che i pacchetti usano per la licenza, in ordine di preferenza. */
const NOMI_LICENZA = [
  'LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'LICENCE.md', 'LICENCE.txt',
  'LICENSE-MIT', 'LICENSE-MIT.txt', 'LICENSE.BSD', 'LICENSE.APACHE2', 'COPYING', 'COPYING.txt'
];
const NOMI_NOTICE = ['NOTICE', 'NOTICE.md', 'NOTICE.txt'];

/** Legge un file di testo, o null se non c'è. */
function leggiSePresente(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; }
}

/** Il primo dei `nomi` presente nella cartella del pacchetto (case-insensitive). */
function trovaFile(dir, nomi) {
  let elenco;
  try { elenco = fs.readdirSync(dir); } catch (e) { return null; }
  const perMinuscolo = new Map(elenco.map((n) => [n.toLowerCase(), n]));
  for (const n of nomi) {
    const vero = perMinuscolo.get(n.toLowerCase());
    if (vero) return path.join(dir, vero);
  }
  return null;
}

/** La licenza dichiarata nel package.json, nelle tre forme storiche del campo. */
function licenzaDichiarata(pkg) {
  if (typeof pkg.license === 'string') return pkg.license;
  if (pkg.license && pkg.license.type) return pkg.license.type;
  if (Array.isArray(pkg.licenses) && pkg.licenses.length) {
    return pkg.licenses.map((l) => (typeof l === 'string' ? l : l.type)).filter(Boolean).join(' OR ');
  }
  return '';
}

/** L'URL pubblico del progetto, ripulito dalle forme `git+…git`. */
function urlProgetto(pkg) {
  let u = '';
  const r = pkg.repository;
  if (typeof r === 'string') u = r;
  else if (r && r.url) u = r.url;
  if (!u) u = pkg.homepage || '';
  return String(u)
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/\.git$/, '')
    .replace(/^github:/, 'https://github.com/');
}

/** Chi detiene il diritto d'autore: la riga «Copyright …» del testo di licenza
 *  (è quella che vincola davvero), o in mancanza l'autore del package.json. */
function copyright(testo, pkg) {
  if (testo) {
    const m = testo.match(/^.*copyright\b.*$/im);
    if (m) {
      const riga = m[0].trim().replace(/\s+/g, ' ');
      // scarta le righe della licenza che parlano di copyright in astratto
      if (!/copyright notice|copyright holder|copyright and|copyright \(c\) <|copyright \[/i.test(riga)) return riga;
    }
  }
  const a = pkg.author;
  if (typeof a === 'string') return a;
  if (a && a.name) return a.name + (a.email ? ' <' + a.email + '>' : '');
  return '';
}

/** L'albero delle dipendenze di produzione (quelle che finiscono nel .dmg:
 *  electron-builder spedisce le `dependencies`, non le `devDependencies`). */
function elencoNpm(radice) {
  let json;
  try {
    const out = execFileSync('npm', ['ls', '--omit=dev', '--all', '--json'], {
      cwd: radice, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024
    });
    json = JSON.parse(out);
  } catch (e) {
    // `npm ls` esce con codice ≠ 0 quando ci sono peer opzionali non installati:
    // l'albero sullo stdout è comunque valido, e ci serve quello.
    const out = (e && e.stdout) ? String(e.stdout) : '';
    if (!out) throw new Error('npm ls non ha prodotto nulla: ' + (e && e.message));
    json = JSON.parse(out);
  }
  const visti = new Map();
  (function scendi(nodo) {
    const deps = nodo.dependencies || {};
    for (const [nome, v] of Object.entries(deps)) {
      if (!v || !v.version) continue;          // peer/opzionali non installati
      const chiave = nome + '@' + v.version;
      if (!visti.has(chiave)) visti.set(chiave, { nome, versione: v.version, percorso: v.path || '' });
      scendi(v);
    }
  })(json);
  return [...visti.values()].sort((a, b) => a.nome.localeCompare(b.nome) || a.versione.localeCompare(b.versione));
}

/** Dove sta sul disco un pacchetto: `npm ls` dà il percorso, ma non sempre
 *  (alberi deduplicati); allora si cerca nelle radici note. */
function cartellaPacchetto(radice, voce) {
  const candidati = [voce.percorso, path.join(radice, 'node_modules', voce.nome)].filter(Boolean);
  for (const c of candidati) {
    const pkg = leggiSePresente(path.join(c, 'package.json'));
    if (pkg) { try { if (JSON.parse(pkg).version === voce.versione) return c; } catch (e) { /* rotto: prova il prossimo */ } }
  }
  return candidati.find((c) => fs.existsSync(path.join(c, 'package.json'))) || null;
}

/* Alcuni pacchetti non spediscono il file di licenza (capita: `files` in
 * package.json che lo esclude). Il testo standard della licenza dichiarata è il
 * ripiego onesto — con l'avviso che è il testo canonico e non quello del
 * pacchetto, così chi legge sa esattamente che cosa sta guardando. */
const TESTI_STANDARD = {
  'MIT': 'mit-standard.txt',
  'Apache-2.0': 'apache-2.0.txt'
};

/** Il testo canonico di una licenza, se ne teniamo copia in App/assets/licenze/. */
function testoStandard(licenza, cartellaLicenze) {
  const file = TESTI_STANDARD[String(licenza || '').trim()];
  if (!file) return null;
  return leggiSePresente(path.join(cartellaLicenze || LICENZE, file));
}

/** Una voce di credito a partire da un pacchetto npm installato. */
function voceNpm(radice, p, cartellaLicenze) {
  const dir = cartellaPacchetto(radice, p);
  const pkg = dir ? JSON.parse(leggiSePresente(path.join(dir, 'package.json')) || '{}') : {};
  const fileLic = dir ? trovaFile(dir, NOMI_LICENZA) : null;
  const fileNotice = dir ? trovaFile(dir, NOMI_NOTICE) : null;
  const testo = fileLic ? leggiSePresente(fileLic) : null;
  const licenza = licenzaDichiarata(pkg) || 'non dichiarata';
  const ripiego = testo ? null : testoStandard(licenza, cartellaLicenze);
  return {
    id: p.nome + '@' + p.versione,
    nome: p.nome,
    versione: p.versione,
    categoria: 'npm',
    ruolo: pkg.description || '',
    licenza: licenza,
    copyright: copyright(testo, pkg),
    url: urlProgetto(pkg),
    testo: (testo || ripiego || '').trim(),
    notice: fileNotice ? (leggiSePresente(fileNotice) || '').trim() : '',
    // dichiarare l'assenza è meglio che tacerla (invariante 4)
    avviso: testo ? '' : (ripiego
      ? 'Il pacchetto non spedisce il proprio file di licenza: qui sotto c\'è il testo canonico della licenza che dichiara nel package.json (' + licenza + '), non una copia fornita dall\'autore.'
      : 'Il pacchetto non spedisce il file di licenza e di questa licenza non teniamo il testo canonico: vale quanto dichiarato nel suo package.json (' + licenza + ').')
  };
}

/** Le voci che npm non può conoscere, dal file dichiarativo + i testi in App/assets/licenze/. */
function vociExtra(fileExtra, cartellaLicenze) {
  const grezzo = leggiSePresente(fileExtra);
  if (!grezzo) throw new Error('manca ' + fileExtra);
  const dati = JSON.parse(grezzo);
  const voci = (dati.voci || []).map((v) => {
    const testo = v.licenzaFile ? leggiSePresente(path.join(cartellaLicenze, v.licenzaFile)) : null;
    if (v.licenzaFile && testo == null) throw new Error('manca il testo di licenza ' + v.licenzaFile + ' per ' + v.nome);
    return Object.assign({}, v, {
      id: v.id || (v.nome + (v.versione ? '@' + v.versione : '')),
      testo: testo ? testo.trim() : (v.testo || ''),
      notice: v.notice || '',
      avviso: v.avviso || ''
    });
  });
  return { voci, obblighi: dati.obblighi || [], app: dati.app || {} };
}

/** L'inventario completo: npm + extra, ordinato per categoria e nome. */
function componi(opzioni) {
  const o = opzioni || {};
  const radice = o.radice || RADICE;
  const extra = vociExtra(o.extra || EXTRA, o.licenze || LICENZE);
  const npm = elencoNpm(radice).map((p) => voceNpm(radice, p, o.licenze || LICENZE));
  const ordine = ['piattaforma', 'vendor', 'dati', 'python', 'servizio', 'npm'];
  const voci = extra.voci.concat(npm).sort((a, b) => {
    const d = ordine.indexOf(a.categoria) - ordine.indexOf(b.categoria);
    return d !== 0 ? d : a.nome.toLowerCase().localeCompare(b.nome.toLowerCase());
  });
  return {
    generato: o.quando || '',           // niente Date.now() qui: lo passa chi genera
    app: extra.app,
    obblighi: extra.obblighi,
    voci
  };
}

/** Il NOTICE da spedire con l'app (o da incollare in un ticket legale). */
function notice(dati) {
  const righe = [];
  const app = dati.app || {};
  righe.push(app.nome ? app.nome + (app.versione ? ' ' + app.versione : '') : 'StudIA');
  if (app.copyright) righe.push(app.copyright);
  if (app.licenza) righe.push('Licenza: ' + app.licenza);
  righe.push('');
  righe.push('Questo prodotto include software di terze parti elencato qui sotto,');
  righe.push('con la licenza e il copyright di ciascuno.');
  righe.push('');
  for (const v of dati.voci || []) {
    righe.push('─'.repeat(72));
    righe.push(v.nome + (v.versione ? ' ' + v.versione : '') + '  —  ' + (v.licenza || 'licenza non dichiarata'));
    if (v.copyright) righe.push(v.copyright);
    if (v.url) righe.push(v.url);
    if (v.avviso) righe.push('Nota: ' + v.avviso);
    righe.push('');
    if (v.testo) { righe.push(v.testo); righe.push(''); }
    if (v.notice) { righe.push('NOTICE:'); righe.push(v.notice); righe.push(''); }
  }
  return righe.join('\n');
}

/** Scrive App/assets/dati/crediti.json. Ritorna i dati scritti. */
function genera(opzioni) {
  const o = opzioni || {};
  const dati = componi(o);
  const dove = o.uscita || USCITA;
  fs.mkdirSync(path.dirname(dove), { recursive: true });
  fs.writeFileSync(dove, JSON.stringify(dati, null, 2) + '\n', 'utf8');
  return dati;
}

/** Legge l'inventario committato (è ciò che l'app mostra). */
function leggi(dove) {
  const grezzo = leggiSePresente(dove || USCITA);
  if (!grezzo) return { errore: 'Inventario delle licenze non trovato: rigeneralo con «npm run crediti».', voci: [] };
  try { return JSON.parse(grezzo); } catch (e) { return { errore: 'Inventario delle licenze illeggibile: ' + e.message, voci: [] }; }
}

module.exports = {
  USCITA, EXTRA, LICENZE,
  elencoNpm, voceNpm, vociExtra, componi, genera, leggi, notice,
  // esportate per le prove
  licenzaDichiarata, urlProgetto, copyright, trovaFile
};

/* Da riga di comando: `node lib/crediti.js` rigenera l'inventario. */
if (require.main === module) {
  const dati = genera({ quando: new Date().toISOString().slice(0, 10) });
  const npm = dati.voci.filter((v) => v.categoria === 'npm').length;
  console.log('crediti.json: ' + dati.voci.length + ' voci (' + npm + ' pacchetti npm, ' + (dati.voci.length - npm) + ' dichiarate a mano)');
  const senza = dati.voci.filter((v) => !v.testo);
  if (senza.length) console.log('senza testo di licenza sul disco: ' + senza.map((v) => v.id).join(', '));
}
