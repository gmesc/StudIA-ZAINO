'use strict';
// Questo adattatore viene caricato soltanto dall'entry point del laboratorio.
// Installer, IPC, policy e cache restano reali; nessun motore o download reale parte.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const {app} = require('electron');
const dati = app.getPath('userData');
assert(dati.includes('studia-zaino-prova-') || dati.includes('studia-guida-'), 'Adattatore sicurezza riservato al profilo sintetico');
const registro = path.join(dati, 'sicurezza-chiamate.jsonl');
const scrivi = voce => fs.appendFileSync(registro, JSON.stringify({...voce, quando:Date.now()}) + '\n');
const attendi = ms => new Promise(resolve => setTimeout(resolve, ms));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

const installer = require('../lib/sicurezza-installazione'), creaInstaller = installer.crea;
installer.crea = opzioni => {
  assert(opzioni.radice.startsWith(dati + path.sep), 'Motori soltanto nel profilo sintetico');
  const risorse = path.join(opzioni.radice, 'risorse-sintetiche');
  for (const id of ['qpdf', 'clamav']) {
    const base = path.join(risorse, 'sicurezza-pacchetti', process.platform + '-' + process.arch, id);
    const comandi = id === 'qpdf' ? ['qpdf'] : ['clamscan', 'freshclam', 'sigtool'];
    fs.mkdirSync(base, {recursive:true});
    const files = comandi.concat(id === 'clamav' ? ['etc/certs/certificato-prova.pem'] : []).map(nome => {
      const bytes = Buffer.from('Motore sintetico ' + nome + ': non eseguire.\n');
      fs.mkdirSync(path.dirname(path.join(base, nome)), {recursive:true});
      fs.writeFileSync(path.join(base, nome), bytes);
      return {nome,sha256:hash(bytes),dimensione:bytes.length,eseguibile:comandi.includes(nome)};
    });
    fs.writeFileSync(path.join(base, 'manifest.json'), JSON.stringify({formato:1,id,nome:id === 'qpdf' ? 'qpdf' : 'ClamAV',
      piattaforma:process.platform,architettura:process.arch,versione:'1.0.0-prova',files,comandi:Object.fromEntries(comandi.map(nome => [nome,nome]))}));
  }
  return creaInstaller({...opzioni,risorse,esegui:async (binario, args, execOpzioni) => {
    assert(binario.startsWith(opzioni.radice + path.sep));
    const nome = path.basename(binario); scrivi({operazione:nome});
    const certificati=path.join(opzioni.radice,'motori/clamav/etc/certs');
    assert.equal(execOpzioni.env.CVD_CERTS_DIR,certificati,'I subprocessi usano i certificati privati');
    if (nome === 'freshclam') {
      assert(args.some(a => a.startsWith('--config-file=')), 'Aggiornamento con configurazione privata');
      const conf=fs.readFileSync(args.find(a=>a.startsWith('--config-file=')).slice('--config-file='.length),'utf8');
      assert(conf.includes('CVDCertsDirectory "'+certificati+'"'));
      await attendi(650);
      const db = path.join(opzioni.radice, 'firme');
      fs.mkdirSync(db, {recursive:true});
      for (const tipo of ['main','daily','bytecode']) fs.writeFileSync(path.join(db, tipo + '.cvd'), Buffer.from(('Firme sintetiche ' + Date.now() + ' ').padEnd(512, '.')));
    } else {assert.equal(nome, 'sigtool');assert(args.includes('--cvdcertsdir='+certificati));}
    return {stdout:'Verification OK.\n',stderr:''};
  }});
};

const core = require('../lib/sicurezza-pdf'), creaScanner = core.crea;
core.crea = opzioni => {
  function prepara(binario, args, sincrono) {
    const nome = path.basename(binario), pdf = args.filter(a => /\.pdf$/i.test(a));
    assert(['qpdf','clamscan'].includes(nome));
    assert(pdf.length > 0);
    const testi = pdf.map(file => {
      assert(file.startsWith(opzioni.tempRoot + path.sep), 'Lo scanner riceve soltanto snapshot privati');
      return fs.readFileSync(file, 'latin1');
    });
    let configurazione = {};
    try { configurazione = JSON.parse(fs.readFileSync(path.join(dati, 'sicurezza-simulazione.json'), 'utf8')); } catch (_) {}
    const lento = testi.some(t => t.includes('ZAINO-PROVA-LENTO'));
    scrivi({operazione:'scansione',fase:'inizio',motore:nome,quanti:pdf.length,sincrono,lento});
    if (lento && sincrono) throw Error('La scansione lenta non deve bloccare il main con un comando sincrono.');
    const risultato = () => {
      let esito;
      if (nome === 'qpdf') {
        const stdout = 'checking ' + pdf[0] + '\nPDF Version: 1.7\nFile is not encrypted\n';
        const avviso = testi[0].includes('ZAINO-PROVA-OFFSET');
        esito = {status:avviso ? 3 : 0,stdout,stderr:avviso ? 'WARNING: ' + pdf[0] + ' (object 25 0): object has offset 0 - a common error handled correctly by qpdf and most other applications\nqpdf: operation succeeded with warnings\n' : ''};
      } else {
        const minacce = testi.map(t => t.includes('ZAINO-PROVA-MINACCIA') || configurazione.rilevaTutto === true);
        esito = {status:minacce.some(Boolean) ? 1 : 0,stderr:'',stdout:pdf.map((p,i) => p + (minacce[i] ? ': Win.Test.Simulazione FOUND' : ': OK')).join('\n')};
      }
      scrivi({operazione:'scansione',fase:'fine',motore:nome,quanti:pdf.length,sincrono,lento,status:esito.status});
      return esito;
    };
    return {lento,risultato};
  }
  return creaScanner({...opzioni,avvia:async (binario,args) => {
    const p = prepara(binario,args,false);
    if (p.lento) await attendi(2200);
    return p.risultato();
  },avviaSync:(binario,args) => prepara(binario,args,true).risultato()});
};
