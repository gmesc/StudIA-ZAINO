'use strict';
/**
 * appunti — le note personali dell'utente su disco.
 *
 * Vivono in Progetti/<progetto>/APPUNTI/ come .md indipendenti: la pipeline che
 * genera i corsi non li tocca mai, e una rigenerazione non li perde. Il legame
 * col capitolo sta nel frontmatter (corsoId/capitoloId/capitoloFile), non dentro
 * il capitolo.
 *
 * Due regole che valgono per tutto il file:
 *  1. si scrive in modo atomico (tmp + rename): una lettura che capitasse a metà
 *     scrittura vedrebbe un appunto troncato — cioè senza titolo — e sembrerebbe
 *     sparito;
 *  2. un errore di lettura non si trasforma mai in "nessun appunto": la cartella
 *     assente è l'unico caso in cui l'elenco vuoto è la verità.
 */
const fs = require('fs');
const path = require('path');

const CARTELLA = 'APPUNTI';

function dir(vaultPath, projectId) { return path.join(vaultPath, 'Progetti', projectId, CARTELLA); }

// nomi file leggibili: teniamo spazi e accenti, togliamo solo ciò che il fs non regge
function safeName(s) {
  return String(s == null ? '' : s)
    .replace(/[\/\\:*?"<>|]/g, '-')
    .replace(/[\x00-\x1f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90) || 'senza titolo';
}
function ymlEsc(s) { return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' '); }

const CHIAVI = ['title', 'corso', 'corsoId', 'capitolo', 'capitoloId', 'capitoloFile', 'anchor', 'creato', 'modificato'];

function serialize(meta, body) {
  let out = '---\n';
  for (const k of CHIAVI) if (meta[k] != null && meta[k] !== '') out += k + ': "' + ymlEsc(meta[k]) + '"\n';
  out += '---\n\n' + String(body == null ? '' : body).replace(/\s+$/, '') + '\n';
  return out;
}
function parse(raw) {
  const meta = {}; const m = /^---\n([\s\S]*?)\n---\n?/.exec(raw || '');
  if (m) {
    for (const line of m[1].split('\n')) {
      const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line); if (!kv) continue;
      let v = kv[2].trim();
      if (/^".*"$/.test(v)) v = v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      meta[kv[1]] = v;
    }
  }
  return { meta, fm: !!m, body: (raw || '').replace(/^---\n[\s\S]*?\n---\n?/, '').replace(/^\n+/, '') };
}

// scrittura non interrompibile: il file definitivo compare già completo
function writeAtomic(p, data) {
  const tmp = p + '.tmp-' + process.pid;
  try { fs.writeFileSync(tmp, data, 'utf-8'); fs.renameSync(tmp, p); }
  catch (e) { try { fs.unlinkSync(tmp); } catch (e2) {} throw e; }
}

/** Elenca gli appunti di un progetto.
 *  Cartella assente -> []. Qualsiasi altro errore di lettura della cartella -> throw.
 *  Un singolo file illeggibile resta nell'elenco col nome del file e un campo
 *  `errore`: sparire in silenzio è peggio che comparire rotto. */
function list(vaultPath, projectId) {
  const d = dir(vaultPath, projectId); const out = []; const rotti = [];
  let files;
  try { files = fs.readdirSync(d); }
  catch (e) { if (e.code === 'ENOENT') return out; throw e; }
  for (const f of files.sort()) {
    if (!f.toLowerCase().endsWith('.md') || f.startsWith('_')) continue;
    try {
      const p = parse(fs.readFileSync(path.join(d, f), 'utf-8'));
      const n = Object.assign({ file: f, body: p.body }, p.meta);
      // frontmatter assente o troncato (scrittura interrotta, modifica a mano):
      // l'appunto resta, ma con un nome — senza, nell'interfaccia sarebbe una riga muta
      if (!p.fm || !n.title) {
        n.title = n.title || f.replace(/\.md$/, '');
        if (!p.fm) { n.errore = 'frontmatter mancante'; rotti.push(f + ' (frontmatter mancante)'); }
      }
      out.push(n);
    } catch (e) {
      rotti.push(f + ' (' + e.message + ')');
      out.push({ file: f, body: '', title: f.replace(/\.md$/, ''), errore: e.message });
    }
  }
  if (rotti.length) out.rotti = rotti;
  return out;
}

/** Forma esplicita { notes, error }: l'errore va detto a chi legge, e
 *  contextBridge non porterebbe comunque le proprietà appese a un array. */
function read(vaultPath, projectId) {
  try {
    const notes = list(vaultPath, projectId);
    return {
      notes: notes.map((n) => Object.assign({}, n)),
      error: notes.rotti ? ('appunti illeggibili: ' + notes.rotti.join(' · ')) : ''
    };
  } catch (e) {
    return { notes: [], error: e.message };
  }
}

// nome di default: "<Corso> - <Capitolo> - <Titolo>.md", con suffisso " 2" sulle collisioni
function filename(vaultPath, projectId, meta) {
  const base = safeName([meta.corso, meta.capitolo, meta.title || CARTELLA].filter(Boolean).join(' - '));
  const d = dir(vaultPath, projectId);
  let name = base + '.md', i = 1;
  while (fs.existsSync(path.join(d, name))) { i++; name = base + ' ' + i + '.md'; }
  return name;
}

function save(vaultPath, projectId, file, meta, body, adesso) {
  const d = dir(vaultPath, projectId);
  fs.mkdirSync(d, { recursive: true });
  const now = adesso || new Date().toISOString();
  const m = Object.assign({}, meta, { creato: meta.creato || now, modificato: now });
  const name = file || filename(vaultPath, projectId, m);
  writeAtomic(path.join(d, name), serialize(m, body));
  reindex(vaultPath, projectId);
  return { file: name, meta: m };
}

function remove(vaultPath, projectId, file) {
  try { fs.unlinkSync(path.join(dir(vaultPath, projectId), file)); } catch (e) { return false; }
  reindex(vaultPath, projectId); return true;
}

// indice automatico: APPUNTI/_indice.md, raggruppato per corso e capitolo
function indice(notes, quando) {
  const byCourse = new Map();
  for (const n of notes) {
    const ck = n.corso || n.corsoId || 'Senza corso';
    if (!byCourse.has(ck)) byCourse.set(ck, new Map());
    const chk = n.capitolo || n.capitoloId || 'Senza capitolo';
    const chs = byCourse.get(ck);
    if (!chs.has(chk)) chs.set(chk, []);
    chs.get(chk).push(n);
  }
  let md = '---\ntitle: "Indice degli appunti"\ngenerato: "' + (quando || new Date().toISOString()) + '"\n---\n\n';
  md += '# Indice degli appunti\n\n> File generato automaticamente da StudIA a ogni salvataggio. Non modificarlo a mano.\n\n';
  md += '**' + notes.length + '** ' + (notes.length === 1 ? 'appunto' : 'appunti') + ' in ' + byCourse.size + ' cors' + (byCourse.size === 1 ? 'o' : 'i') + '.\n\n';
  for (const ck of Array.from(byCourse.keys()).sort()) {
    md += '## ' + ck + '\n\n';
    const chs = byCourse.get(ck);
    for (const chk of Array.from(chs.keys()).sort()) {
      md += '### ' + chk + '\n\n';
      for (const n of chs.get(chk)) {
        const first = (n.body || '').split('\n').map((s) => s.trim()).filter(Boolean)[0] || '';
        md += '- [' + (n.title || n.file.replace(/\.md$/, '')) + '](<' + n.file + '>)';
        if (n.anchor) md += ' — *«' + n.anchor.slice(0, 80) + '»*';
        else if (first) md += ' — ' + first.replace(/[#*`>]/g, '').slice(0, 80);
        md += '\n';
      }
      md += '\n';
    }
  }
  return md;
}

function reindex(vaultPath, projectId, quando) {
  let notes = [];
  try { notes = list(vaultPath, projectId); } catch (e) { return 0; }
  const d = dir(vaultPath, projectId);
  try { fs.mkdirSync(d, { recursive: true }); writeAtomic(path.join(d, '_indice.md'), indice(notes, quando)); } catch (e) {}
  return notes.length;
}

module.exports = { CARTELLA, dir, safeName, serialize, parse, writeAtomic, list, read, filename, save, remove, reindex, indice };
