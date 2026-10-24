'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { crea, ambiente } = require('../lib/sicurezza-pdf');
const permessi = require('../lib/permessi-disco');
const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'zaino-scanner-')));
const sorgenti = path.join(tmp, 'sorgenti'), strumenti = path.join(tmp, 'strumenti'), temporanei = path.join(tmp, 'temporanei');
for (const p of [sorgenti, strumenti, temporanei]) fs.mkdirSync(p, { mode: 0o700 });
const scrivi = (nome, testo = 'normale') => { const p = path.join(sorgenti, nome); fs.writeFileSync(p, '%PDF-1.7\n' + testo + '\n%%EOF\n'); return p; };
const qpdf = path.join(strumenti, 'qpdf'), clamav = path.join(strumenti, 'clamscan'), database = path.join(strumenti, 'database'), certificati = path.join(strumenti, 'certificati');
fs.writeFileSync(qpdf, 'eseguibile qpdf'); fs.writeFileSync(clamav, 'eseguibile clamav'); fs.mkdirSync(database); fs.writeFileSync(path.join(database, 'daily.cvd'), 'firme'); fs.mkdirSync(certificati); fs.writeFileSync(path.join(certificati, 'ca.pem'), 'certificato');
let preferenze = { qpdf: true, clamav: true }, firmaDatabase = 'firma-1', aggiornatoAl = Date.now(), modo = '', chiamate = [], durante;
function motori() { return { qpdf: { eseguibile: qpdf, versione: '12.4.2' }, clamav: { eseguibile: clamav, versione: '1.5.4', database, certificati, firmaDatabase, aggiornatoAl } }; }
function avvia(binario, argomenti, opzioni) {
  chiamate.push({ binario, argomenti, opzioni });
  assert.equal(opzioni.shell, false, 'nessuna shell interpreta nomi dei file');
  assert.equal(opzioni.env.DYLD_INSERT_LIBRARIES, undefined);
  const pdf = argomenti.filter(p => p.endsWith('.pdf'));
  for (const p of pdf) assert(p.startsWith(temporanei + path.sep), 'il sottoprocesso legge soltanto snapshot privati');
  if (durante) { const f = durante; durante = null; f(); }
  if (modo === 'timeout') return { status: null, signal: 'SIGKILL', error: new Error('timeout') };
  if (binario === qpdf) {
    const stdout = 'checking ' + pdf[0] + '\nPDF Version: 1.7\nFile is not encrypted\nFile is not linearized\n';
    if (modo === 'qpdf-danneggiato') return { status: 2, stdout, stderr: 'qpdf: damaged file' };
    if (modo === 'qpdf-cifrato') return { status: 0, stdout: stdout.replace('File is not encrypted', 'R = 6'), stderr: '' };
    if (modo === 'qpdf-warning') return { status: 3, stdout, stderr: 'WARNING: ' + pdf[0] + ' (object 25 0): object has offset 0 - a common error handled correctly by qpdf and most other applications\nqpdf: operation succeeded with warnings\n' };
    if (modo === 'qpdf-warning-altro') return { status: 3, stdout, stderr: 'WARNING: ' + pdf[0] + ': file is damaged\nqpdf: operation succeeded with warnings\n' };
    return { status: 0, stdout, stderr: '' };
  }
  assert(argomenti.includes('--alert-exceeds-max=yes'));
  assert(argomenti.includes('--alert-encrypted=yes'));
  assert(argomenti.includes('--fail-if-cvd-older-than=7'));
  assert(argomenti.includes('--cvdcertsdir=' + certificati));
  assert.equal(opzioni.env.CVD_CERTS_DIR,certificati,'certificati privati anche negli eventuali subprocessi del motore');
  if (modo === 'av-senza-riscontro') return { status: 0, stdout: '', stderr: '' };
  if (modo === 'av-errore') return { status: 2, stdout: pdf.map(p => p + ': OK').join('\n'), stderr: 'ERROR: database unreadable' };
  if (modo === 'av-limite') return { status: 1, stdout: pdf.map(p => p + ': Heuristics.Limits.Exceeded.MaxScanSize FOUND').join('\n'), stderr: '' };
  if (modo === 'av-cifrato') return { status: 1, stdout: pdf.map(p => p + ': Heuristics.Encrypted.PDF FOUND').join('\n'), stderr: '' };
  if (modo === 'av-eicar') return { status: 1, stdout: pdf.map((p, i) => p + (i ? ': OK' : ': Win.Test.EICAR_HDB-1 FOUND')).join('\n'), stderr: '' };
  return { status: 0, stdout: pdf.map(p => p + ': OK').join('\n'), stderr: '' };
}
const scanner = crea({ tempRoot: temporanei, strumenti: motori, preferenze: () => preferenze, avvia: async (...args) => avvia(...args), avviaSync: avvia });
const reset = nuovoModo => { modo = nuovoModo || ''; chiamate = []; scanner.svuotaCache(); };
(async () => {
  try {
    const ostile = {SystemRoot:'D:\\Windows',WINDIR:'E:\\Altro',PATH:'C:\\attaccante',TEMP:'C:\\pubblico',
      NODE_OPTIONS:'--require=attaccante',LD_PRELOAD:'/attaccante.so',DYLD_INSERT_LIBRARIES:'/attaccante.dylib',CVD_CERTS_DIR:'C:\\certificati-non-fidati'};
    const envWin = ambiente('C:\\Zaino\\privato','C:\\Zaino\\certificati','win32',ostile);
    assert.equal(envWin.SystemRoot,'D:\\Windows'); assert.equal(envWin.WINDIR,'D:\\Windows');
    assert.equal(envWin.PATH,'D:\\Windows\\System32;D:\\Windows');
    assert.equal(envWin.TEMP,'C:\\Zaino\\privato'); assert.equal(envWin.TMP,'C:\\Zaino\\privato');
    assert.equal(envWin.CVD_CERTS_DIR,'C:\\Zaino\\certificati');
    for (const nome of ['NODE_OPTIONS','LD_PRELOAD','DYLD_INSERT_LIBRARIES']) assert.equal(envWin[nome],undefined, nome+' non ereditata');
    assert.equal(ambiente('/privato',null,'darwin',ostile).PATH,'/usr/bin:/bin');
    assert.equal(ambiente('/privato',null,'linux',ostile).CVD_CERTS_DIR,undefined);
    assert.equal(ambiente('C:\\privato',null,'win32',{WINDIR:'D:\\Windows'}).SystemRoot,'D:\\Windows');
    assert.equal(ambiente('C:\\privato',null,'win32',{SystemRoot:'C:\\Windows;C:\\attaccante'}).SystemRoot,'C:\\Windows','non inserisce percorsi aggiuntivi nella ricerca DLL/eseguibili');
    const a = scrivi('uno.pdf'), b = scrivi('due con spazi ; $().pdf', 'altro');
    const prima = fs.readFileSync(a);
    let r = await scanner.controlla([a, b]);
    assert.equal(r.ok, true); assert.equal(r.esiti.length, 2); assert(r.esiti.every(e => e.ok && /^[a-f0-9]{64}$/.test(e.hash)));
    assert.equal(chiamate.filter(c => c.binario === clamav).length, 1, 'un solo avvio antivirus per il lotto');
    assert.deepEqual(fs.readFileSync(a), prima, 'originale invariato'); assert.equal(fs.readdirSync(temporanei).length, 0, 'snapshot rimossi');
    chiamate = []; r = await scanner.controlla([a, b]); assert.equal(chiamate.length, 0); assert(r.esiti.every(e => e.cache));
    fs.appendFileSync(a, 'modificato'); r = await scanner.controlla([a]); assert.equal(r.ok, true); assert.equal(chiamate.length, 2, 'byte nuovi invalidano cache');
    chiamate = []; firmaDatabase = 'firma-2'; r = await scanner.controlla([a]); assert.equal(chiamate.length, 2, 'firme nuove invalidano cache');
    chiamate = []; fs.appendFileSync(path.join(database, 'daily.cvd'), 'nuova'); await scanner.controlla([a]); assert.equal(chiamate.length, 2, 'anche la sostituzione del database invalida la cache');
    chiamate = []; fs.appendFileSync(path.join(certificati, 'ca.pem'), 'nuovo'); await scanner.controlla([a]); assert.equal(chiamate.length, 2, 'certificati nuovi invalidano cache');
    aggiornatoAl = Date.now() - 8 * 86400000; chiamate = []; r = await scanner.controlla([a]); assert.equal(r.ok, false); assert.match(r.esiti[0].error, /firme.*aggiorn|aggiorn.*firme/i); assert.equal(chiamate.length, 0); aggiornatoAl = Date.now();
    for (const caso of ['timeout', 'qpdf-danneggiato', 'qpdf-cifrato', 'qpdf-warning-altro', 'av-senza-riscontro', 'av-errore', 'av-limite', 'av-cifrato']) {
      reset(caso); r = await scanner.controlla([a]); assert.equal(r.ok, false, caso + ' blocca'); assert.equal(r.esiti[0].minaccia, false, caso + ' non viene spacciato per malware');
      modo = ''; chiamate = []; r = await scanner.controlla([a]); assert.equal(r.ok, true); assert(chiamate.length > 0, 'nessun errore viene memorizzato come positivo');
    }
    reset('qpdf-warning'); r = await scanner.controlla([a]); assert.equal(r.ok, true); assert(r.esiti[0].avvisi.some(s => /offset 0/.test(s)));
    reset('av-eicar'); r = await scanner.controlla([a, b]); assert.equal(r.ok, false); assert.equal(r.esiti[0].minaccia, true); assert.match(r.esiti[0].error, /EICAR/); assert.equal(r.esiti[1].ok, true);
    reset(); durante = () => fs.appendFileSync(a, 'cambiato durante scansione'); r = await scanner.controlla([a]); assert.equal(r.ok, false); assert.match(r.esiti[0].error, /cambiat/);
    reset(); durante = () => { preferenze = { qpdf: false, clamav: true }; }; r = await scanner.controlla([b]); assert.equal(r.ok, false, 'cambio policy durante scansione richiede nuovo controllo'); preferenze = { qpdf: true, clamav: true };
    reset(); assert.equal(scanner.controllaSync(b).ok, true); chiamate = []; assert.equal(scanner.richiediSync(b).cache, true); assert.equal(chiamate.length, 0);
    reset('av-eicar'); await scanner.controlla([b]); chiamate = [];
    assert.throws(() => scanner.richiediSync(b), /EICAR|controll|verific/i); assert.equal(chiamate.length,0,'la guardia sincrona non rilancia scansioni bloccanti');
    reset(); await scanner.controlla([b]); fs.appendFileSync(b,'cambiato dopo il preflight'); chiamate = [];
    assert.throws(() => scanner.richiediSync(b), /Riprova.*importazione/i,'byte cambiati richiedono un nuovo controllo asincrono');
    assert.equal(chiamate.length,0,'nessuno spawnSync sul main dopo una mutazione della sorgente');
    await scanner.controlla([b]); assert.equal(scanner.richiediSync(b).cache,true);
    reset(); const alias = path.join(sorgenti, 'alias.pdf'); fs.symlinkSync(b, alias); r = await scanner.controlla([alias]); assert.equal(r.ok, false); assert.equal(chiamate.length, 0);
    const hardlink = path.join(sorgenti, 'hardlink.pdf'); fs.linkSync(b, hardlink); r = await scanner.controlla([hardlink]); assert.equal(r.ok, false); fs.unlinkSync(hardlink);
    const enorme = scrivi('enorme.pdf'); fs.truncateSync(enorme, 201 * 1024 * 1024); r = await scanner.controlla([enorme]); assert.equal(r.ok, false); assert.match(r.esiti[0].error, /200 MB/);
    const falso = path.join(sorgenti, 'falso.pdf'); fs.writeFileSync(falso, '<html>pagina</html>'); r = await scanner.controlla([falso]); assert.equal(r.ok, false);
    reset(); await permessi.esegui({ lettura: [sorgenti, strumenti], scrittura: [temporanei], metadati: [temporanei] }, async () => {
      assert.equal((await scanner.controlla([b])).ok, true, 'funziona negli ambiti filesystem reali');
      const fuori = scrivi('fuori.pdf'); await permessi.esegui({ lettura: [strumenti], scrittura: [temporanei], metadati: [temporanei] }, async () => {
        assert.equal((await scanner.controlla([fuori])).ok, false, 'nessun allargamento del privilegio sorgente');
      });
    });
    reset(); await Promise.all([scanner.controlla([b]), scanner.controlla([b])]); assert.equal(chiamate.filter(c => c.binario === clamav).length, 1, 'richieste contemporanee condividono il riscontro positivo');
    preferenze = { qpdf: false, clamav: false }; reset(); r = await scanner.controlla([b]); assert.equal(r.ok, true); assert.equal(chiamate.length, 0); assert.equal(r.esiti[0].disattivato, true); assert.equal(scanner.richiediSync(b).disattivato,true);
    assert.equal(fs.readdirSync(temporanei).length, 0);
    // Attraversa anche execFile/spawnSync veri: i test precedenti simulano
    // soltanto i verdetti, questi due esercitano argv, stdout e codici di uscita.
    if (!process.execPath.includes(' ')) {
      const script = '#!' + process.execPath + '\n' + [
        "const fs=require('fs'),path=require('path');",
        "const pdf=process.argv.slice(2).filter(p=>p.endsWith('.pdf'));",
        "if(path.basename(process.argv[1])==='qpdf'){ console.log('checking '+pdf[0]+'\\nPDF Version: 1.7\\nFile is not encrypted'); }",
        "else { let infetto=false; for(const p of pdf){const trovato=fs.readFileSync(p,'utf8').includes('PROVA-EICAR'); infetto ||= trovato; console.log(p+': '+(trovato?'Eicar-Test-Signature FOUND':'OK'));} process.exitCode=infetto?1:0; }"
      ].join('\n');
      fs.writeFileSync(qpdf, script, { mode: 0o700 }); fs.chmodSync(qpdf, 0o700);
      fs.writeFileSync(clamav, script, { mode: 0o700 }); fs.chmodSync(clamav, 0o700);
      preferenze = { qpdf: true, clamav: true };
      const nativo = crea({ tempRoot: temporanei, strumenti: motori, preferenze: () => preferenze });
      const campione = scrivi('eicar-processo.pdf', 'PROVA-EICAR');
      r = await nativo.controlla([b, campione]); assert.equal(r.esiti[0].ok, true); assert.equal(r.esiti[1].minaccia, true);
      nativo.svuotaCache(); assert.equal(nativo.controllaSync(campione).minaccia, true);
    }
    console.log('✓ Sicurezza PDF: batch, cache per contenuto/motori/firme, fail closed, EICAR, snapshot e permessi');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
})().catch(e => { console.error(e); process.exitCode = 1; });
