'use strict';
const assert = require('assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const fonti = require('../lib/fonti'), media = require('../lib/media'), importa = require('../lib/importa');
const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'zaino-formati-')));
const vault = path.join(tmp, 'vault'), src = path.join(tmp, 'sorgenti');
fs.mkdirSync(path.join(vault, 'Zaini', 'sicurezza'), { recursive: true }); fs.mkdirSync(src);
const file = (nome, dati) => { const p = path.join(src, nome); fs.writeFileSync(p, dati); return p; };
try {
  // Una pagina HTML rinominata in PDF prima veniva copiata senza alcun controllo.
  const falsoPdf = file('fattura.pdf', '<html><script>maligno()</script></html>');
  assert.equal(fonti.importa(vault, 'sicurezza', [falsoPdf]).copiati.length, 0, 'HTML rinominato PDF deve essere rifiutato');
  const falsi = ['.mp4', '.mov', '.mp3', '.wav', '.webm'].map(ext => file('falso' + ext, '#!/bin/sh\necho eseguibile'));
  assert.equal(media.importa(vault, 'sicurezza', falsi).copiati.length, 0, 'script rinominati media devono essere rifiutati');
  const html = file('pagina.html', '<html>pagina</html>'), js = file('attivo.js', 'maligno()');
  const piano = importa.esamina(src, { forzati: ['pagina.html', 'attivo.js'] });
  assert(!piano.materiali.some(v => [html, js].includes(v.abs)), 'il ripescaggio non aggira i formati proibiti');
  const sicuri = require('../lib/formati-sicuri');
  const pdf = file('dispensa.pdf', '%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF');
  assert.equal(sicuri.verificaFile(pdf).ok, true);
  for (const ext of ['.exe', '.sh', '.bat', '.cmd', '.ps1', '.js', '.mjs', '.html', '.htm', '.svg', '.docm', '.xlsm', '.zip', '.app']) {
    assert.equal(sicuri.verificaBuffer(Buffer.from('%PDF-1.7'), ext).ok, false, ext + ' vietato anche con firma di altro formato');
  }
  const alias = path.join(src, 'alias.pdf'); fs.symlinkSync(pdf, alias);
  assert.equal(sicuri.verificaFile(alias).ok, false, 'symlink esplicito rifiutato');
  assert.equal(fonti.importa(vault, 'sicurezza', [alias]).copiati.length, 0);
  assert.equal(sicuri.verificaFile(src).ok, false, 'una cartella non è un file');
  assert.equal(sicuri.verificaFile(file('vuoto.pdf', '')).ok, false, 'PDF vuoto rifiutato');
  assert.equal(sicuri.verificaFile(file('binario.txt', Buffer.from([0x4d, 0x5a, 0, 0]))).ok, false, 'binario rinominato testo rifiutato');
  assert.equal(sicuri.verificaFile(file('script.md', '#!/bin/sh\nexit')).ok, false, 'script rinominato testo rifiutato');
  assert.equal(sicuri.verificaFile(file('appunto.md', '# Città\nTesto UTF-8.')).ok, true);
  const cartellaAlias = path.join(tmp, 'cartella-alias'); fs.symlinkSync(src, cartellaAlias);
  assert.equal(importa.esamina(cartellaAlias).materiali.length, 0, 'la scansione non segue una cartella simbolica');
  const fifo = path.join(src, 'dispositivo.pdf');
  if (process.platform !== 'win32') {
    require('child_process').execFileSync('mkfifo', [fifo]);
    assert.equal(sicuri.verificaFile(fifo).ok, false, 'FIFO rifiutata senza bloccarsi in lettura');
    assert.equal(fonti.importa(vault, 'sicurezza', [fifo]).copiati.length, 0);
  }
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const iso = marca => Buffer.concat([Buffer.from([0, 0, 0, 20]), Buffer.from('ftyp' + marca + '\0\0\0\0' + marca)]);
  const buoni = {
    '.png': png, '.jpg': Buffer.from([255, 216, 255, 224]), '.jpeg': Buffer.from([255, 216, 255, 224]),
    '.gif': Buffer.from('GIF89a00'), '.webp': Buffer.from('RIFF0000WEBP00'), '.avif': iso('avif'), '.heic': iso('heic'), '.heif': iso('mif1'),
    '.mp4': iso('isom'), '.m4a': iso('M4A '), '.mov': iso('qt  '), '.mkv': Buffer.from([26, 69, 223, 163, 0]), '.webm': Buffer.from([26, 69, 223, 163, 0]),
    '.avi': Buffer.from('RIFF0000AVI 00'), '.mpeg': Buffer.from([0, 0, 1, 0xba]), '.mpg': Buffer.from([0, 0, 1, 0xb3]),
    '.mp3': Buffer.from('ID3\0\0\0\0\0\0\0'), '.wav': Buffer.from('RIFF0000WAVE00'), '.aac': Buffer.from([255, 241, 0, 0, 0, 0, 0]),
    '.flac': Buffer.from('fLaC00'), '.ogg': Buffer.from('OggS00'), '.opus': Buffer.from('OggS00'), '.aiff': Buffer.from('FORM0000AIFF00')
  };
  for (const [ext, bytes] of Object.entries(buoni)) {
    assert.equal(sicuri.verificaBuffer(bytes, ext).ok, true, 'firma riconosciuta ' + ext);
    assert.equal(sicuri.verificaBuffer(Buffer.from('<script>attivo</script>'), ext).ok, false, 'camuffamento rifiutato ' + ext);
  }
  const album = require('../lib/album');
  assert(album.daDataUrl('data:image/svg+xml;base64,' + Buffer.from('<svg/>').toString('base64')).error);
  assert(album.daDataUrl('data:image/png;base64,' + Buffer.from('<svg/>').toString('base64')).error);
  const destinazione = path.join(tmp, 'copia.pdf');
  sicuri.copiaVerificata(pdf, destinazione);
  assert.deepEqual(fs.readFileSync(destinazione), fs.readFileSync(pdf), 'copia conserva i byte originali');
  assert.throws(() => sicuri.copiaVerificata(pdf, destinazione), /esiste|EEXIST/i, 'nessuna sovrascrittura');
  assert.throws(() => sicuri.copiaVerificata(falsoPdf, path.join(tmp, 'negato.pdf')), /contenuto|firma/i);
  assert(!fs.existsSync(path.join(tmp, 'negato.pdf')));
  const binarioInCoda = file('testo.txt', Buffer.concat([Buffer.alloc(70000, 65), Buffer.from([0])]));
  const testoCopiato = path.join(tmp, 'testo.txt');
  assert.throws(() => sicuri.copiaVerificata(binarioInCoda, testoCopiato), /testo/);
  assert(!fs.existsSync(testoCopiato), 'un errore in coda elimina la copia parziale');
  assert.throws(() => sicuri.copiaVerificata(pdf, path.join(tmp, 'media.mp4'), { estensioni: sicuri.MEDIA }), /Formato/);
  const permessi = require('../lib/permessi-disco');
  const limitata = path.join(tmp, 'destinazione-autorizzata'); fs.mkdirSync(limitata);
  const esterno = path.join(tmp, 'esterno.pdf'); fs.writeFileSync(esterno, '%PDF-1.7\nprivato');
  permessi.esegui({ lettura: [src], scrittura: [limitata] }, () => {
    assert.equal(sicuri.verificaFile(esterno).ok, false, 'il validator non legge fuori dall’ambito autorizzato');
    sicuri.copiaVerificata(pdf, path.join(limitata, 'letta.pdf'));
    assert.throws(() => sicuri.copiaVerificata(pdf, path.join(src, 'mai-scrivere.pdf')), /Accesso al disco negato/);
    assert.throws(() => sicuri.copiaVerificata(pdf, esterno), /Accesso al disco negato/);
  });
  assert.equal(fs.readFileSync(esterno, 'utf8'), '%PDF-1.7\nprivato');
  assert(!fs.existsSync(path.join(src, 'mai-scrivere.pdf')), 'la cartella sorgente resta in sola lettura');
  assert.deepEqual(fs.readFileSync(path.join(limitata, 'letta.pdf')), fs.readFileSync(pdf));
  console.log('✓ Import sicuro: allowlist non aggirabile, firme, originali immutati, symlink e copie esclusive');
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
