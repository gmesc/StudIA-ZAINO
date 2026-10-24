'use strict';

// Riconoscere il formato evita di importare eseguibili rinominati. Non è una
// scansione antivirus: un documento valido resta un ingresso non fidato.
const fs = require('./permessi-disco').fs;
const path = require('path');
const { TextDecoder } = require('util');
const materiali = require('./materiali');
const PDF = ['.pdf'];
const TESTO = ['.md', '.markdown', '.txt', '.vtt', '.srt'];
const IMMAGINI = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.heic', '.heif'];
const MEDIA = materiali.EXT_MEDIA;
const ESTENSIONI = Object.freeze(PDF.concat(TESTO, IMMAGINI, MEDIA));
const TESTATA = 65536;

function permessa(ext, opzioni) {
  return ESTENSIONI.includes(ext) && (!opzioni || !opzioni.estensioni || opzioni.estensioni.includes(ext));
}

function firma(buf, ext) {
  const s = (a, b) => buf.toString('latin1', a, b);
  const inizio = (...byte) => buf.length >= byte.length && byte.every((b, i) => buf[i] === b);
  const riff = tipo => buf.length > 12 && s(0, 4) === 'RIFF' && s(8, 12) === tipo;
  const iso = marche => {
    if (buf.length < 16 || s(4, 8) !== 'ftyp') return false;
    const n = buf.readUInt32BE(0);
    if (n < 16 || n > buf.length) return false;
    for (let i = 8; i + 4 <= n; i += 4) if (i !== 12 && marche.includes(s(i, i + 4))) return true;
    return false;
  };
  if (ext === '.pdf') return /^%PDF-(?:1\.[0-7]|2\.0)(?:\s|$)/.test(s(0, 16));
  if (ext === '.png') return buf.length > 24 && inizio(137, 80, 78, 71, 13, 10, 26, 10) && s(12, 16) === 'IHDR';
  if (ext === '.jpg' || ext === '.jpeg') return buf.length > 3 && inizio(255, 216, 255);
  if (ext === '.gif') return buf.length > 6 && ['GIF87a', 'GIF89a'].includes(s(0, 6));
  if (ext === '.webp') return riff('WEBP');
  if (ext === '.avif') return iso(['avif', 'avis']);
  if (ext === '.heic' || ext === '.heif') return iso(['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1']);
  if (ext === '.mp4' || ext === '.m4a' || ext === '.mov') {
    if (iso(['isom', 'iso2', 'iso3', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'M4V ', 'M4A ', 'M4B ', 'dash', 'MSNV', 'qt  '])) return true;
    // QuickTime precedente a ftyp usa subito uno di questi atom.
    return ext === '.mov' && buf.length >= 8 && buf.readUInt32BE(0) >= 8 && ['moov', 'mdat', 'wide'].includes(s(4, 8));
  }
  if (ext === '.webm' || ext === '.mkv') return buf.length > 4 && inizio(0x1a, 0x45, 0xdf, 0xa3);
  if (ext === '.avi') return riff('AVI ');
  if (ext === '.mpg' || ext === '.mpeg') return inizio(0, 0, 1, 0xba) || inizio(0, 0, 1, 0xb3);
  if (ext === '.wav') return riff('WAVE');
  if (ext === '.flac') return buf.length > 4 && s(0, 4) === 'fLaC';
  if (ext === '.ogg' || ext === '.opus') return buf.length > 4 && s(0, 4) === 'OggS';
  if (ext === '.aiff') return buf.length > 12 && s(0, 4) === 'FORM' && ['AIFF', 'AIFC'].includes(s(8, 12));
  if (ext === '.mp3') return (buf.length >= 10 && s(0, 3) === 'ID3') ||
    (buf.length >= 4 && buf[0] === 255 && (buf[1] & 0xe0) === 0xe0 && (buf[1] & 6) !== 0 && (buf[1] & 0x18) !== 8);
  if (ext === '.aac') return buf.length >= 7 && buf[0] === 255 && (buf[1] & 0xf6) === 0xf0;
  if (TESTO.includes(ext)) {
    if (s(0, 2) === '#!' || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(s(0))) return false;
    try { new TextDecoder('utf-8', { fatal: true }).decode(buf, { stream: true }); return true; }
    catch (_) { return false; }
  }
  return false;
}

function verificaBuffer(buf, estensione, opzioni) {
  const ext = String(estensione || '').toLowerCase();
  if (!permessa(ext, opzioni)) return { ok: false, error: 'Formato non consentito: ' + (ext || 'senza estensione'), ext };
  if (!Buffer.isBuffer(buf) || !firma(buf, ext)) return { ok: false, error: 'Il contenuto non corrisponde al formato ' + ext + '.', ext };
  return { ok: true, error: '', ext };
}

function apri(percorso, opzioni) {
  const ext = path.extname(String(percorso || '')).toLowerCase();
  if (!permessa(ext, opzioni)) throw new Error('Formato non consentito: ' + (ext || 'senza estensione'));
  const st = fs.lstatSync(percorso);
  if (st.isSymbolicLink()) throw new Error('Collegamento simbolico escluso.');
  if (!st.isFile()) throw new Error('Non è un file regolare.');
  // O_NONBLOCK impedisce di restare bloccati se un file viene sostituito con
  // una FIFO fra lstat e open; il controllo fstat vale sul descrittore aperto.
  const fd = fs.openSync(percorso, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0));
  try {
    const reale = fs.fstatSync(fd);
    if (!reale.isFile() || reale.dev !== st.dev || reale.ino !== st.ino) throw new Error('Il file è cambiato durante la lettura.');
    const buf = Buffer.alloc(Math.min(TESTATA, reale.size));
    const letti = fs.readSync(fd, buf, 0, buf.length, 0);
    const r = verificaBuffer(buf.subarray(0, letti), ext, opzioni);
    if (!r.ok) throw new Error(r.error);
    return { fd, ext, size: reale.size, stat: reale };
  } catch (e) { fs.closeSync(fd); throw e; }
}

function verificaFile(percorso, opzioni) {
  let f;
  try { f = apri(percorso, opzioni); return { ok: true, error: '', ext: f.ext, size: f.size }; }
  catch (e) { return { ok: false, error: e.code === 'ENOENT' ? 'non si legge' : (e.message || 'File non leggibile.') }; }
  finally { if (f) fs.closeSync(f.fd); }
}

// La copia usa lo stesso descrittore validato: sostituire il percorso sorgente
// dopo la verifica non fa entrare un altro file. La destinazione non si sovrascrive.
function copiaVerificata(sorgente, destinazione, opzioni) {
  const f = apri(sorgente, opzioni);
  let fuori, creata = false;
  try {
    fuori = fs.openSync(destinazione, 'wx', 0o600); creata = true;
    const buf = Buffer.alloc(1024 * 1024);
    const decoder = TESTO.includes(f.ext) ? new TextDecoder('utf-8', { fatal: true }) : null;
    let pos = 0, n;
    while (pos < f.size && (n = fs.readSync(f.fd, buf, 0, Math.min(buf.length, f.size - pos), pos))) {
      if (decoder) {
        const testo = decoder.decode(buf.subarray(0, n), { stream: true });
        if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(testo)) throw new Error('Il contenuto non è un file di testo.');
      }
      let scritto = 0;
      while (scritto < n) scritto += fs.writeSync(fuori, buf, scritto, n - scritto);
      pos += n;
    }
    if (decoder) decoder.decode();
    const dopo = fs.fstatSync(f.fd);
    if (pos !== f.size || dopo.mtimeMs !== f.stat.mtimeMs || dopo.ctimeMs !== f.stat.ctimeMs) throw new Error('Il file è cambiato durante la copia. Riprova.');
    return { ok: true, ext: f.ext, size: pos };
  } catch (e) {
    if (fuori !== undefined) { fs.closeSync(fuori); fuori = undefined; }
    if (creata) fs.unlinkSync(destinazione);
    throw e;
  } finally { if (fuori !== undefined) fs.closeSync(fuori); fs.closeSync(f.fd); }
}

module.exports = { PDF, TESTO, IMMAGINI, MEDIA, ESTENSIONI, verificaBuffer, verificaFile, copiaVerificata };
