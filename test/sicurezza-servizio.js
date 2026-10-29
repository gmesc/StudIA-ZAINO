'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), Module = require('node:module');
const D = require('../lib/permessi-disco'), core = require('../lib/sicurezza-pdf');
const {fileURLToPath}=require('node:url');
const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'zaino-servizio-')));
const userData = path.join(tmp, 'profilo'), tempRoot = path.join(tmp, 'temporanei'), risorse = path.join(tmp, 'risorse');
const radice = path.join(userData, 'sicurezza'), motori = path.join(radice, 'motori'), database = path.join(radice, 'firme');
for (const dir of [motori, database, tempRoot, risorse]) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
for (const nome of ['qpdf', 'clamscan']) fs.writeFileSync(path.join(motori, nome), 'Motore sintetico, non eseguire.');
fs.writeFileSync(path.join(database, 'daily.cvd'), 'Database sintetico.');
let aggiornatoAl = new Date().toISOString(), aggiornamenti = 0, scansioni = 0;
let cfg = { sicurezza: { qpdf: true, clamav: true } };
const notifiche = [];
const installer = {
  stato: () => ({ motori: ['qpdf', 'clamav'].map(id => ({ id, installato: true, disponibile: true, versione: '1.0-prova' })),
    firme: { pronte: true, aggiornatoAl, firmaDatabase: 'firme-sintetiche' } }),
  percorsi: id => ({ eseguibile: path.join(motori, id === 'qpdf' ? 'qpdf' : 'clamscan'), versione: '1.0-prova',
    ...(id === 'clamav' ? { database, firmaDatabase: 'firme-sintetiche', aggiornatoAl } : {}) }),
  aggiornaFirme: async () => { aggiornamenti++; aggiornatoAl = new Date().toISOString(); },
  installa: async () => {}
};
const fileServizio = path.resolve(__dirname, '../lib/sicurezza-servizio.js');
const modulo = new Module(fileServizio, module);
modulo.filename = fileServizio; modulo.paths = Module._nodeModulePaths(path.dirname(fileServizio));
const requireNormale = modulo.require.bind(modulo);
modulo.require = nome => {
  if (nome === './sicurezza-installazione') return { crea: () => installer };
  if (nome === './sicurezza-pdf') return { ...core, crea: opzioni => core.crea({ ...opzioni,
    avvia: async (binario, args) => {
      scansioni++;
      const pdf = args.filter(p => p.endsWith('.pdf'));
      return { status: 0, stderr: '', stdout: path.basename(binario) === 'qpdf'
        ? 'checking ' + pdf[0] + '\nPDF Version: 1.7\nFile is not encrypted\n'
        : pdf.map(p => p + ': OK').join('\n') };
    },
    avviaSync: () => { throw Error('Il controller non deve avviare scansioni sincrone.'); }
  }) };
  return requireNormale(nome);
};
modulo._compile(fs.readFileSync(fileServizio, 'utf8'), fileServizio);
const servizio = modulo.exports.crea({ userData, risorse, tempRoot,
  readCfg: () => structuredClone(cfg), writeCfg: nuovo => { cfg = nuovo; }, invia: dati => notifiche.push(dati) });
const statoClam = () => servizio.stato().motori.find(m => m.id === 'clamav');
(async () => {
  try {
    assert.equal(statoClam().operativo, true, 'firme appena verificate consentono il controllo');
    await servizio.aggiornaAutomaticamente(); assert.equal(aggiornamenti, 0, 'non riscarica firme appena verificate');
    for (const [caso, data] of [
      ['futuro', new Date(Date.now() + 10 * 86400000).toISOString()],
      ['non valida', 'data-non-valida'],
      ['scaduta', new Date(Date.now() - 8 * 86400000).toISOString()]
    ]) {
      aggiornatoAl = data;
      assert.equal(statoClam().pronto, false, 'data ' + caso + ': nessuna falsa disponibilità');
      assert.equal(statoClam().operativo, false, 'data ' + caso + ': nessuna falsa protezione attiva');
      assert.throws(() => servizio.attiva('clamav', true), /firm|dat|aggiorn/i, 'data ' + caso + ': attivazione negata');
      const prima = aggiornamenti;
      await servizio.aggiornaAutomaticamente();
      assert.equal(aggiornamenti, prima + 1, 'data ' + caso + ': ripete aggiornamento e verifica delle firme');
      assert.equal(statoClam().operativo, true, 'data ' + caso + ': operatività ripristinata dopo verifica');
    }
    aggiornatoAl = new Date(Date.now() - 2 * 86400000).toISOString();
    assert.equal(statoClam().operativo, true, 'firme di due giorni sono ancora valide');
    const prima = aggiornamenti; await servizio.aggiornaAutomaticamente(); assert.equal(aggiornamenti, prima + 1, 'aggiornamento preventivo dopo un giorno');
    servizio.attiva('clamav', false); aggiornatoAl = 'non-valida';
    await servizio.aggiornaAutomaticamente(); assert.equal(aggiornamenti, prima + 1, 'nessun download automatico quando ClamAV è disattivato');
    aggiornatoAl = new Date().toISOString(); servizio.attiva('clamav', true);

    const consentito = path.join(tmp, 'fonte-consentita.pdf'), esterno = path.join(tmp, 'fonte-privata.pdf');
    fs.writeFileSync(consentito, '%PDF-1.7\nfonte ammessa\n%%EOF'); fs.writeFileSync(esterno, '%PDF-1.7\nfonte fuori dai permessi\n%%EOF');
    await D.esegui({ lettura: [consentito] }, async () => {
      assert.equal((await servizio.controlla([consentito])).ok, true);
      assert.equal(servizio.richiediSync(consentito).ok, true);
      const prima = scansioni, negato = await servizio.controlla([esterno]);
      assert.equal(negato.ok, false, 'le risorse interne del controller non concedono accesso ad altri documenti');
      assert.match(negato.esiti[0].error, /Accesso al disco negato/);
      assert.equal(scansioni, prima, 'il documento non autorizzato non arriva ai motori');
      assert.throws(() => servizio.richiediSync(esterno), /Accesso al disco negato/);
    });
    assert.equal(fs.readdirSync(tempRoot).length, 0, 'il lotto non lascia copie temporanee');
    const copiaOriginale=fs.readFileSync(consentito);
    const limitato=modulo.exports.crea({userData,risorse,tempRoot,readCfg:()=>structuredClone(cfg),writeCfg:nuovo=>{cfg=nuovo;},limiteCopie:copiaOriginale.length});
    require('../lib/sicurezza-accesso').configura(limitato);
    await D.esegui({lettura:[consentito,esterno]},async()=>{
      const url=await limitato.urlVerificata(consentito),copia=fileURLToPath(url);
      assert(copia.startsWith(tempRoot+path.sep),'il browser riceve una copia privata');
      assert.deepEqual(fs.readFileSync(copia),copiaOriginale,'la copia conserva esattamente i byte verificati');
      assert.equal(await limitato.urlVerificata(consentito),url,'il documento invariato riusa la stessa copia');
      assert.equal(await limitato.urlVerificata(copia),null,'nessun ciclo di redirect sulla copia approvata');
      await assert.rejects(limitato.urlVerificata(esterno),/limite.*copie PDF temporanee/,'il budget evita crescita illimitata dei temporanei');
      assert.deepEqual(fs.readFileSync(consentito),copiaOriginale,'gli originali restano invariati');
      assert.deepEqual(fs.readdirSync(path.join(tempRoot,'pdf-approvati')),[path.basename(copia)],'il rifiuto non lascia una seconda copia');
    });
    await new Promise(r=>setTimeout(r,300));
    const avvisiPrima=notifiche.filter(n=>n.stato).length;
    for(let i=0;i<12;i++)await D.esegui({lettura:[consentito]},()=>servizio.controlla([consentito]));
    assert.equal(notifiche.filter(n=>n.stato).length,avvisiPrima,'un lotto di letture non ricalcola lo stato dei pacchetti per ogni PDF');
    await new Promise(r=>setTimeout(r,300));
    assert.equal(notifiche.filter(n=>n.stato).length,avvisiPrima+1,'il riepilogo aggiornato arriva una volta a fine lotto');
    assert.equal(notifiche.at(-1).stato.inCorso,false);
    assert(notifiche.length > 0);
    console.log('✓ Servizio sicurezza: date firme, aggiornamento automatico, ambiti, copie verificate e budget temporanei');
  } finally { require('../lib/sicurezza-accesso').configura(null);fs.rmSync(tmp, { recursive: true, force: true }); }
})().catch(e => { console.error(e); process.exitCode = 1; });
