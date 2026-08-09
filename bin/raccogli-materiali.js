#!/usr/bin/env node
'use strict';
/**
 * raccogli.js — dà a ogni corso la sua cartella dei materiali.
 *
 *  Corsi/<id>/MATERIALI/{Video,Audio,PDF,Web,Trascrizioni,Indici-PDF,Indici-Web}
 *
 * I file sono HARDLINK di quelli globali: stesso inode, quindi lo spazio si paga
 * una volta sola, ma copiando o comprimendo la cartella del corso si ottiene
 * un pacchetto completo e autonomo.
 *
 * I materiali che nessun corso referenzia vengono SPOSTATI in
 * MATERIALI-DA-ASSEGNARE/ con la stessa struttura.
 *
 * Uso:  node raccogli.js <vault> [--esegui]      (senza --esegui: solo anteprima)
 */
const fs = require('fs');
const path = require('path');
const corsiLib = require('../lib/corsi');   // la radice dei corsi: `Corsi/`, o `Progetti/` nei vault mai migrati

const VAULT = process.argv[2];
const ESEGUI = process.argv.includes('--esegui');
if (!VAULT) { console.error('uso: node raccogli.js <vault> [--esegui]'); process.exit(1); }

const SUB = ['Media', 'Fonti', 'Trascrizioni', 'Indice-PDF'];
const MEDIA_EXT = ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.mpeg', '.mpg', '.m4a', '.mp3', '.wav', '.aac', '.flac'];

const log = [];
function nota(s) { log.push(s); console.log(s); }
function umano(b) {
  if (b > 1e9) return (b / 1e9).toFixed(1) + ' GB';
  if (b > 1e6) return (b / 1e6).toFixed(1) + ' MB';
  return Math.max(1, Math.round(b / 1e3)) + ' kB';
}
function numeroDi(nome) { const m = /^(\d{1,3})\b/.exec(nome); return m ? parseInt(m[1], 10) : null; }
function pesa(p) {
  try {
    const st = fs.lstatSync(p);
    if (!st.isDirectory()) return st.size;
    return fs.readdirSync(p).reduce((t, f) => t + pesa(path.join(p, f)), 0);
  } catch (e) { return 0; }
}

/* ---------- 1. inventario dei materiali globali, per numero ---------- */
// { 5: { media:[{sub,nome}], pdf:[...], html:[...], allegati:[...], trascrizioni:[...], indici:[...] } }
const perNumero = new Map();
function agg(n, chiave, voce) {
  if (!perNumero.has(n)) perNumero.set(n, { media: [], pdf: [], html: [], allegati: [], trascrizioni: [], indici: [] });
  perNumero.get(n)[chiave].push(voce);
}
for (const sub of SUB) {
  let voci; try { voci = fs.readdirSync(path.join(VAULT, sub), { withFileTypes: true }); } catch (e) { continue; }
  for (const v of voci) {
    if (v.name.startsWith('.')) continue;
    const n = numeroDi(v.name); if (n == null) continue;
    const ext = path.extname(v.name).toLowerCase();
    if (sub === 'Trascrizioni') agg(n, 'trascrizioni', { sub, nome: v.name });
    else if (sub === 'Indice-PDF') agg(n, 'indici', { sub, nome: v.name });
    else if (v.isDirectory()) agg(n, 'allegati', { sub, nome: v.name });        // "NN ..._files"
    else if (ext === '.pdf') agg(n, 'pdf', { sub, nome: v.name });
    else if (ext === '.html' || ext === '.htm') agg(n, 'html', { sub, nome: v.name });
    else if (MEDIA_EXT.includes(ext)) agg(n, 'media', { sub, nome: v.name });
  }
}

/* ---------- 2. quali numeri usa ogni corso (dai _lezione.md) ---------- */
const corsi = [];
let cdirs; try { cdirs = fs.readdirSync(corsiLib.radice(VAULT), { withFileTypes: true }); } catch (e) { cdirs = []; }
for (const pe of cdirs) {
  if (!pe.isDirectory() || pe.name.startsWith('.')) continue;
  const cdir = corsiLib.cartella(VAULT, pe.name);
  const usati = new Set(); const perLezione = new Map();
  // le lezioni stanno in LEZIONI/; i corsi fatti prima le hanno nella radice
  const lbase = fs.existsSync(path.join(cdir, 'LEZIONI')) ? path.join(cdir, 'LEZIONI') : cdir;
  for (const ce of fs.readdirSync(lbase, { withFileTypes: true })) {
    if (!ce.isDirectory() || ['APPUNTI', 'MATERIALI', 'LEZIONI', '_lavorazione'].includes(ce.name)) continue;
    let raw = ''; try { raw = fs.readFileSync(path.join(lbase, ce.name, '_lezione.md'), 'utf-8'); } catch (e) { continue; }
    const m = /^materiali:\s*\[([^\]]*)\]/m.exec(raw); if (!m) continue;
    const nums = m[1].split(',').map(s => parseInt(s.trim(), 10)).filter(Number.isFinite);
    nums.forEach(n => { usati.add(n); if (!perLezione.has(n)) perLezione.set(n, []); perLezione.get(n).push(ce.name); });
  }
  if (usati.size) corsi.push({ id: pe.name, dir: cdir, usati, perLezione });
}

/* ---------- 3. hardlink dei materiali dentro ogni corso ---------- */
function collega(src, dest) {
  if (fs.existsSync(dest)) return 'già presente';
  if (!ESEGUI) return 'da collegare';
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const st = fs.lstatSync(src);
  if (st.isDirectory()) {                                    // "NN ..._files": ricorsivo
    fs.mkdirSync(dest, { recursive: true });
    for (const f of fs.readdirSync(src)) collega(path.join(src, f), path.join(dest, f));
    return 'collegata';
  }
  try { fs.linkSync(src, dest); return 'collegato'; }
  catch (e) { fs.copyFileSync(src, dest); return 'copiato (hardlink non possibile: ' + e.code + ')'; }
}

// dentro il corso ogni tipo di sorgente ha la sua cartella (vedi lib/materiali.js):
// per i media la scelta dipende dall'estensione, così un .mp3 finisce in Audio/
const mat = require(path.join(__dirname, '..', 'lib', 'materiali'));
const DEST = { pdf: 'PDF', html: 'Web', allegati: 'Web', trascrizioni: 'Trascrizioni', indici: 'Indici-PDF' };
const TIPI = ['media', 'pdf', 'html', 'allegati', 'trascrizioni', 'indici'];
function destinazione(chiave, nome) {
  return chiave === 'media' ? mat.cartellaPerFile(nome) : DEST[chiave];
}

for (const pr of corsi) {
  const base = path.join(pr.dir, 'MATERIALI');
  let n = 0, bytes = 0;
  const righe = [];
  for (const num of [...pr.usati].sort((a, b) => a - b)) {
    const g = perNumero.get(num);
    if (!g) { righe.push({ num, mancante: true }); continue; }
    const voci = [];
    for (const chiave of TIPI) {
      for (const v of g[chiave]) {
        const src = path.join(VAULT, v.sub, v.nome);
        const destSub = destinazione(chiave, v.nome);
        collega(src, path.join(base, destSub, v.nome));
        n++; bytes += pesa(src);
        if (chiave !== 'trascrizioni' && chiave !== 'indici') voci.push({ chiave, nome: v.nome, sub: destSub });
      }
    }
    const stem = (voci[0] ? voci[0].nome : '').replace(/\.[a-z0-9]+$/i, '');
    const elaborato = g.trascrizioni.length > 0 || g.indici.length > 0 ||
      !!(stem && (mat.trova(VAULT, 'Trascrizioni', stem + '.json') ||
                  mat.trova(VAULT, 'Indice-PDF', stem + '.json') ||
                  mat.trova(VAULT, 'Indice-HTML', stem + '.json')));
    righe.push({ num, voci, lezioni: pr.perLezione.get(num) || [], trascritto: elaborato });
  }
  nota(`${pr.id}: ${pr.usati.size} materiali · ${n} file collegati · ${umano(bytes)}`);

  const md = ['---', 'tipo: materiali', 'corso: "' + pr.id + '"', 'n_materiali: ' + pr.usati.size, '---', '',
    '# Materiali di ' + pr.id, '',
    'Video, PDF, pagine web, trascrizioni e indici usati dalle lezioni di questo corso.',
    'I file sono *hardlink* di quelli in `../../../Media` e `../../../Fonti`: occupano lo spazio una volta',
    'sola, ma copiando o comprimendo la cartella del corso il pacchetto è completo e si apre altrove.',
    '', '| N | Materiale | Tipo | Lezioni che lo usano | Trascritto |', '|---|---|---|---|---|'];
  for (const r of righe) {
    if (r.mancante) { md.push('| ' + String(r.num).padStart(2, '0') + ' | *file non trovato nel vault* | — | — | — |'); continue; }
    const primo = r.voci[0];
    const tipo = primo ? ({ media: (primo.sub === 'Audio' ? 'audio' : 'video'), pdf: 'PDF', html: 'pagina web', allegati: 'allegati' })[primo.chiave] : '—';
    md.push('| ' + String(r.num).padStart(2, '0') + ' | `' + (primo ? primo.sub + '/' + primo.nome : '—') + '` | ' +
            tipo + ' | ' + (r.lezioni.join(', ') || '—') + ' | ' + (r.trascritto ? 'sì' : 'no') + ' |');
  }
  if (ESEGUI) { fs.mkdirSync(base, { recursive: true }); fs.writeFileSync(path.join(base, '_materiali.md'), md.join('\n') + '\n', 'utf-8'); }
}

/* ---------- 4. i materiali che nessuno usa vanno in attesa ---------- */
const assegnati = new Set(); corsi.forEach(p => p.usati.forEach(n => assegnati.add(n)));
const orfani = [...perNumero.keys()].filter(n => !assegnati.has(n)).sort((a, b) => a - b);
const attesa = path.join(VAULT, 'MATERIALI-DA-ASSEGNARE');
let bytesOrfani = 0, nOrfani = 0;
const righeOrfani = [];
for (const num of orfani) {
  const g = perNumero.get(num);
  for (const chiave of TIPI) {
    for (const v of g[chiave]) {
      const destSub = destinazione(chiave, v.nome);
      const src = path.join(VAULT, v.sub, v.nome), dest = path.join(attesa, destSub, v.nome);
      bytesOrfani += pesa(src); nOrfani++;
      if (ESEGUI) { fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.renameSync(src, dest); }
      if (chiave !== 'trascrizioni' && chiave !== 'indici') righeOrfani.push({ num, sub: destSub, nome: v.nome, chiave });
    }
  }
}
nota(`da assegnare: ${orfani.length} materiali · ${nOrfani} file spostati · ${umano(bytesOrfani)}`);

if (ESEGUI && orfani.length) {
  const md = ['---', 'tipo: materiali', 'stato: da-assegnare', 'n_materiali: ' + orfani.length, '---', '',
    '# Materiali da assegnare', '',
    'Materiali presenti nel vault che nessuna lezione referenzia. Sono stati **spostati** qui',
    'dalle cartelle globali per non sporcare il corpus dei corsi esistenti.',
    'Per usarli: ⚙ Impostazioni › Corsi › importa questa cartella nel corso giusto.',
    '', '| N | Materiale | Tipo |', '|---|---|---|'];
  for (const r of righeOrfani) {
    md.push('| ' + String(r.num).padStart(2, '0') + ' | `' + r.sub + '/' + r.nome + '` | ' +
            ({ media: (r.sub === 'Audio' ? 'audio' : 'video'), pdf: 'PDF', html: 'pagina web', allegati: 'allegati' })[r.chiave] + ' |');
  }
  fs.writeFileSync(path.join(attesa, '_materiali.md'), md.join('\n') + '\n', 'utf-8');
}

if (!ESEGUI) nota('\n(anteprima: nessun file è stato toccato — rilancia con --esegui)');
