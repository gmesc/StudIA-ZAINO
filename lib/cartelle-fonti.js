'use strict';

const fs = require('./permessi-disco').fs;
const path = require('path');
const materiali = require('./materiali');
const { safeName, stessoFile } = require('./appunti');

const chiave = nome => nome.normalize('NFC').toLowerCase();
function nomiCartelle(stato) {
  const usati = new Set(), nomi = new Map();
  // L'ordine della sidebar non deve cambiare i suffissi di due gruppi omonimi.
  for (const g of stato.gruppi.slice().sort((a, b) => a.id.localeCompare(b.id))) {
    let base = safeName(g.nome).slice(0, 80).replace(/^[._]+|[. ]+$/g, '') || 'Gruppo';
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(base)) base = 'Gruppo ' + base;
    let nome = base, n = 2;
    while (usati.has(chiave(nome))) nome = base + ' (' + n++ + ')';
    usati.add(chiave(nome)); nomi.set(g.id, nome);
  }
  return nomi;
}

/** Spostamenti e registro riescono insieme; un errore ripristina i percorsi iniziali. */
function sincronizza(dir, prima, stato, salvaRegistro) {
  const pdf = path.join(dir, 'PDF'), base = path.join(pdf, 'Gruppi');
  const nomi = nomiCartelle(stato), vecchi = nomiCartelle(prima);
  const destinazioni = new Map(), fonti = new Map(), annulla = [];
  for (const g of stato.gruppi) for (const f of g.files) destinazioni.set(f, path.join(base, nomi.get(g.id), f));
  for (const f of stato.liberi) destinazioni.set(f, path.join(pdf, f));
  // Si leggono anche i percorsi storici, senza confondere fonti omonime.
  const radici = new Set(materiali.nomiInCorso('Fonti').concat('Fonti'));
  for (const nome of radici) for (const sotto of nome === 'PDF' ? materiali.cartellePdf(pdf) : [path.join(dir, nome)]) {
    if (!fs.existsSync(sotto)) continue;
    for (const f of fs.readdirSync(sotto)) {
      if (f.startsWith('.') || !/\.pdf$/i.test(f)) continue;
      const file = path.join(sotto, f), st = fs.lstatSync(file);
      if (!st.isFile() || st.isSymbolicLink()) throw new Error('Fonte non valida: ' + f);
      if (fonti.has(chiave(f))) throw new Error('Due PDF hanno lo stesso nome: ' + f + '. Rinominali prima di organizzare i gruppi.');
      fonti.set(chiave(f), file);
    }
  }
  function crea(p) {
    let st;
    try { st = fs.lstatSync(p); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    if (st) {
      if (!st.isDirectory() || st.isSymbolicLink()) throw new Error('Cartella delle fonti non valida: ' + path.basename(p));
    } else { fs.mkdirSync(p); annulla.push(() => fs.rmdirSync(p)); }
  }
  try {
    crea(pdf); crea(base);
    // Su macOS mkdir non corregge le maiuscole di una cartella già esistente.
    for (const nome of nomi.values()) {
      const esistente = fs.readdirSync(base).find(n => chiave(n) === chiave(nome));
      if (esistente && esistente !== nome) {
        const da = path.join(base, esistente), a = path.join(base, nome);
        crea(da);
        if (fs.existsSync(a) && !stessoFile(a, da)) throw new Error('Cartelle omonime: ' + nome);
        fs.renameSync(da, a); annulla.push(() => fs.renameSync(a, da));
        for (const [k, f] of fonti) if (path.dirname(f) === da) fonti.set(k, path.join(a, path.basename(f)));
      }
      crea(path.join(base, nome));
    }
    for (const [f, a] of destinazioni) {
      const da = fonti.get(chiave(f));
      if (!da) throw new Error('Fonte non trovata: ' + f);
      if (da === a) continue;
      try { fs.lstatSync(a); throw new Error('La destinazione esiste già: ' + f); }
      catch (e) { if (e.code !== 'ENOENT') throw e; }
      fs.renameSync(da, a); annulla.push(() => fs.renameSync(a, da));
    }
    const attuali = new Set(Array.from(nomi.values(), chiave));
    for (const nome of vecchi.values()) {
      const p = path.join(base, nome);
      if (!attuali.has(chiave(nome)) && fs.existsSync(p) && fs.readdirSync(p).length === 0) {
        fs.rmdirSync(p); annulla.push(() => fs.mkdirSync(p));
      }
    }
    salvaRegistro();
  } catch (e) {
    const errori = [];
    for (const ripristina of annulla.reverse()) try { ripristina(); } catch (r) { errori.push(r.message); }
    if (errori.length) e.message += ' Ripristino incompleto: ' + errori.join('; ');
    throw e;
  }
}

module.exports = { nomiCartelle, sincronizza };
