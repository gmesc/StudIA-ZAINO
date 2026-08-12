'use strict';
/**
 * media — i video e gli audio che entrano in un contenitore.
 *
 * È il gemello di `lib/fonti.js`: là entrano i documenti, qui entra ciò che si
 * ascolta e si guarda. Le decisioni sono le stesse, e per le stesse ragioni:
 *
 *   1. **si copiano**, non si linkano. Un file linkato è una lezione che si
 *      rompe appena la si sposta — e una registrazione linkata dal Desktop
 *      sparisce alla prima pulizia della scrivania;
 *   2. **prendono un numero**, ed è quel numero che rende scrivibile un rimando
 *      `media:03#t=850`, cioè quel che lega un appunto al minuto da cui nasce;
 *   3. **vanno dove il vault li cerca**: `MATERIALI/Video/` e `MATERIALI/Audio/`,
 *      le cartelle che `lib/materiali.js` dichiara da sempre. È la ragione per
 *      cui `srcUrl` trova un video dello zaino senza una riga nuova: cercava
 *      già lì.
 *
 * ⚠️ **Il numero è UNO per contenitore, condiviso fra video e audio.** Nel
 * rimando il tipo non compare — `media:03` non dice se è un `.mp4` o un `.m4a`
 * — quindi due file con lo stesso numero in due cartelle diverse sarebbero due
 * risposte alla stessa domanda, e a decidere finirebbe l'ordine di lettura
 * delle cartelle. Per questo `prossimoNumero` guarda l'elenco INTERO.
 *
 * ⚠️ Qui non si trascrive e non si indicizza niente. Un video importato è un
 * video che si può guardare e citare al secondo: la trascrizione è un derivato,
 * costa minuti di macchina, e chi la vuole la chiede alla pipeline dei corsi.
 * Lo zaino resta il posto dove **scrive solo l'utente** (PIANO-ZAINO §1.5).
 *
 * Niente DOM, niente Electron: gira in Node e si prova con `node test/media.js`.
 */

const fs = require('fs');
const path = require('path');
const corsi = require('./corsi');       // cartella(): risolve `Corsi/` e `Zaini/`
const mat = require('./materiali');     // CARTELLA, le estensioni e la regola «dove va questo file»
const fonti = require('./fonti');       // prossimoNumero: la regola del numero sta in un posto solo

/** Le due cartelle in cui può finire un media, dentro `MATERIALI/`. */
const SOTTO = { video: 'Video', audio: 'Audio' };

function str(v) { return typeof v === 'string' ? v : (v == null ? '' : String(v)); }

/** Il contenitore è una cartella dentro `Corsi/` o `Zaini/`, e nient'altro. */
function idValido(id) {
  const s = str(id);
  return !!s && s.indexOf('/') < 0 && s.indexOf('\\') < 0 && s.indexOf('..') < 0;
}

/**
 * Che cosa è questo file: `'video'`, `'audio'`, o `''` se non è né l'uno né
 * l'altro. L'elenco delle estensioni sta in `lib/materiali.js` — è lo stesso da
 * cui la pipeline decide dove mettere un materiale, e due elenchi divergono.
 */
function tipoDi(nome) {
  const ext = path.extname(str(nome)).toLowerCase();
  if (mat.EXT_VIDEO.includes(ext)) return 'video';
  if (mat.EXT_AUDIO.includes(ext)) return 'audio';
  return '';
}

/** La cartella di un tipo dentro il contenitore. */
function dir(vault, id, tipo) {
  return path.join(corsi.cartella(vault, id), mat.CARTELLA, SOTTO[tipo] || SOTTO.video);
}

function leggiCartella(p) {
  try { return fs.readdirSync(p).filter((n) => !n.startsWith('.')); }
  catch (e) { return []; }
}

/**
 * I media già dentro, in ordine di nome — cioè di numero, che è il primo pezzo
 * del nome. Video e audio in un elenco solo: per chi li apre sono la stessa
 * cosa (roba che scorre nel tempo), e per il numero lo sono davvero.
 */
function elenco(vault, id) {
  if (!vault || !idValido(id)) return [];
  const out = [];
  for (const tipo of Object.keys(SOTTO)) {
    for (const nome of leggiCartella(dir(vault, id, tipo))) {
      if (tipoDi(nome) !== tipo) continue;      // un .txt finito in Video/ non è un media
      out.push({ nome, tipo });
    }
  }
  return out.sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
}

/** Solo i nomi: è ciò che serve al numero. */
function nomi(vault, id) { return elenco(vault, id).map((m) => m.nome); }

/** Due cifre, come i materiali di un corso. */
function nn(n) { return String(n).padStart(2, '0'); }

/**
 * Il nome con cui un file entra: `NN titolo.ext`.
 *
 * ⚠️ **L'estensione si tiene**, e non si tocca: è l'unica cosa che dice al
 * lettore come decodificare quei byte. Il resto è la stessa pulizia dei
 * documenti — il numero di prima non si eredita («03 lezione.mp4» in uno zaino
 * che ne ha già tre diventa «04 lezione.mp4», non «04 03 lezione.mp4»), e i
 * caratteri che sul disco fanno danno spariscono, perché il nome arriva da
 * fuori.
 */
function nomeDestinazione(nomeOrigine, numero) {
  const base = path.basename(str(nomeOrigine));
  const ext = path.extname(base).toLowerCase();
  const pulito = base.slice(0, base.length - ext.length)
    .replace(/^\d{1,3}[\s._-]+/, '')
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90) || 'registrazione';
  return nn(numero) + ' ' + pulito + ext;
}

/**
 * Copia dei media dentro il contenitore.
 *
 * Torna che cosa è entrato e che cosa no, **con il motivo**: un import che
 * ingoia in silenzio ciò che non capisce lascia l'utente a cercare un file che
 * non c'è. È la stessa promessa di `fonti.importa`, e la stessa forma della
 * risposta — chi chiama ne gestisce una sola.
 *
 * ⚠️ Lo stesso file trascinato due volte diventa `03` e `04`: non si
 * sovrascrive niente. Una sovrascrittura porterebbe via gli appunti agganciati
 * al minuto del file di prima, che è esattamente il lavoro che questo modulo
 * esiste per proteggere.
 */
function importa(vault, id, sorgenti, quando) {
  if (!vault || !idValido(id)) return { copiati: [], scartati: [], error: 'contenitore non valido' };

  const copiati = [], scartati = [];
  let numero = fonti.prossimoNumero(nomi(vault, id));

  for (const src of (Array.isArray(sorgenti) ? sorgenti : [])) {
    const p = str(src);
    if (!p) continue;
    const tipo = tipoDi(p);
    if (!tipo) { scartati.push({ file: path.basename(p), motivo: 'non è un video né un audio' }); continue; }
    let st;
    try { st = fs.statSync(p); }
    catch (e) { scartati.push({ file: path.basename(p), motivo: 'non si legge' }); continue; }
    if (!st.isFile()) { scartati.push({ file: path.basename(p), motivo: 'non è un file' }); continue; }

    /* La cartella si crea qui e non all'inizio: un import di soli file scartati
       non deve lasciare in giro due cartelle vuote nel vault di chi guarda. */
    const dest = dir(vault, id, tipo);
    try { fs.mkdirSync(dest, { recursive: true }); }
    catch (e) { scartati.push({ file: path.basename(p), motivo: e.message || 'cartella non creata' }); continue; }

    const nome = nomeDestinazione(path.basename(p), numero);
    try { fs.copyFileSync(p, path.join(dest, nome)); }
    catch (e) { scartati.push({ file: path.basename(p), motivo: e.message || 'copia fallita' }); continue; }
    copiati.push({ da: p, nome, tipo, quando: str(quando) || new Date().toISOString() });
    numero++;
  }
  return { copiati, scartati, error: '' };
}

module.exports = { SOTTO, idValido, tipoDi, dir, elenco, nomi, nomeDestinazione, importa };
