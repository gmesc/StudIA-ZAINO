'use strict';
// I motori restano programmi autonomi: nessuna libreria antivirus viene collegata a Electron.
const fs = require('./permessi-disco').fs;
const path = require('node:path');
const crypto = require('node:crypto');
const {gunzipSync} = require('node:zlib');
const {execFile} = require('node:child_process');
const {promisify} = require('node:util');
const eseguiFile = promisify(execFile);
const MOTORI = [{id:'qpdf',nome:'qpdf'}, {id:'clamav',nome:'ClamAV'}];
const hash = dati => crypto.createHash('sha256').update(dati).digest('hex');
function identificatore(id) { if (!MOTORI.some(m => m.id === id)) throw Error('Motore di sicurezza non valido.'); return id; }
function relativo(nome) {
  if (typeof nome !== 'string' || !nome || nome.includes('\\') || nome.includes(':') || nome.includes('\0') || path.posix.isAbsolute(nome) || nome.split('/').some(p => !p || p === '.' || p === '..')) throw Error('Percorso del pacchetto non valido.');
  return nome;
}
function controllaPercorso(radice, nome, directory = false) {
  const parti = relativo(nome).split('/'); let file = radice;
  for (let i = 0; i < parti.length; i++) {
    file = path.join(file, parti[i]); const st = fs.lstatSync(file);
    if (st.isSymbolicLink() || (i < parti.length - 1 || directory ? !st.isDirectory() : !st.isFile() || st.nlink !== 1)) throw Error('Collegamento o file speciale nel pacchetto di sicurezza.');
  }
  return file;
}
function ambiente(radice, certificati) {
  // Le variabili del processo chiamante non devono iniettare librerie nel motore.
  const env = {HOME:radice, TMPDIR:radice, TEMP:radice, TMP:radice, LANG:'C', LC_ALL:'C'};
  if (process.platform === 'win32') { env.SystemRoot = process.env.SystemRoot || 'C:\\Windows'; env.PATH = path.join(env.SystemRoot, 'System32'); }
  else env.PATH = '/usr/bin:/bin';
  // FreshClam 1.5 avvia il test dei database in un processo che non eredita CVDCertsDirectory dalla configurazione.
  if(certificati)env.CVD_CERTS_DIR=certificati;
  return env;
}
function crea({radice, risorse, onProgress = () => {}, piattaforma = process.platform, architettura = process.arch, esegui = eseguiFile} = {}) {
  if (!path.isAbsolute(radice || '') || !path.isAbsolute(risorse || '') || /[\r\n\0"]/u.test(radice)) throw Error('Cartella della sicurezza non valida.');
  const pacchetti = path.join(risorse, 'sicurezza-pacchetti', piattaforma + '-' + architettura);
  const motori = path.join(radice, 'motori'), database = path.join(radice, 'firme');
  const cache = new Map(); let inCorso = false;
  function cartellaPrivata() {
    // Gli alias di sistema /var e /tmp sono ammessi nella radice, mai dentro l'area privata.
    fs.mkdirSync(radice, {recursive:true, mode:0o700});
    if (fs.lstatSync(radice).isSymbolicLink()) throw Error('La cartella della sicurezza non può essere un collegamento.');
  }
  function manifest(id) {
    identificatore(id); const base = path.join(pacchetti, id);
    const testo = fs.readFileSync(controllaPercorso(risorse, 'sicurezza-pacchetti/' + piattaforma + '-' + architettura + '/' + id + '/manifest.json'), 'utf8');
    if (testo.length > 2 * 1024 * 1024) throw Error('Manifest di sicurezza troppo grande.');
    const m = JSON.parse(testo);
    if (m.formato !== 1 || m.id !== id || m.piattaforma !== piattaforma || m.architettura !== architettura || typeof m.versione !== 'string' || !Array.isArray(m.files) || !m.files.length || m.files.length > 5000 || !m.comandi) throw Error('Manifest del motore non valido.');
    const nomi = new Set();
    for (const f of m.files) {
      relativo(f.nome);
      if (nomi.has(f.nome) || !/^[a-f0-9]{64}$/.test(f.sha256) || !Number.isSafeInteger(f.dimensione) || f.dimensione < 0 || f.dimensione > 1024*1024*1024) throw Error('File del manifest non valido.');
      if(f.origine){relativo(f.origine);if(!/^[a-f0-9]{64}$/.test(f.sha256Origine)||!Number.isSafeInteger(f.dimensioneOrigine)||f.dimensioneOrigine<0||f.dimensioneOrigine>1024*1024*1024)throw Error('Archivio del motore non valido.');}
      nomi.add(f.nome);
    }
    for (const comando of id === 'qpdf' ? ['qpdf'] : ['clamscan','freshclam','sigtool']) if (!nomi.has(m.comandi[comando])) throw Error('Comando assente dal pacchetto.');
    return {...m, base, impronta:hash(testo)};
  }
  function verifica(m, base) {
    // Ricontrolla i byte quando cambia l'identità del file; non rilegge centinaia di MB a ogni repaint.
    for (const f of m.files) {
      const compresso=base===m.base&&f.origine;
      const file = controllaPercorso(base, compresso ? f.origine : f.nome), s = fs.statSync(file);
      const dimensione=compresso?f.dimensioneOrigine:f.dimensione,atteso=compresso?f.sha256Origine:f.sha256;
      const chiave = [m.impronta,s.dev,s.ino,s.size,s.mtimeMs,s.ctimeMs].join(':');
      if (s.size !== dimensione) throw Error('Dimensione del motore non valida: ' + f.nome);
      if (cache.get(file) !== chiave) {
        if (hash(fs.readFileSync(file)) !== atteso) throw Error('Integrità del motore non valida: ' + f.nome);
        cache.set(file, chiave);
      }
    }
  }
  function payload(m,f) {
    const origine=controllaPercorso(m.base,f.origine||f.nome);
    const bytes=f.origine?gunzipSync(fs.readFileSync(origine),{maxOutputLength:f.dimensione}):fs.readFileSync(origine);
    if(bytes.length!==f.dimensione||hash(bytes)!==f.sha256)throw Error('Integrità del payload non valida: '+f.nome);
    return bytes;
  }
  function verificaPacchetti() {
    for(const {id} of MOTORI){const m=manifest(id);verifica(m,m.base);for(const f of m.files)if(f.origine)payload(m,f);}
    return true;
  }
  function installato(m) {
    const base = path.join(motori, m.id);
    if(fs.lstatSync(radice).isSymbolicLink())throw Error('La cartella della sicurezza non può essere un collegamento.');
    const r = JSON.parse(fs.readFileSync(controllaPercorso(radice, 'motori/' + m.id + '/installato.json'), 'utf8'));
    if (r.impronta !== m.impronta) throw Error('È necessario installare la versione aggiornata del motore.');
    verifica(m, base); return base;
  }
  function fileFirme() {
    return ['main','daily','bytecode'].map(nome => {
      const candidati = ['cvd','cld'].map(est => nome + '.' + est).filter(f => fs.existsSync(path.join(database, f)));
      if (candidati.length !== 1) throw Error('Database delle firme incompleto.');
      const file = controllaPercorso(database, candidati[0]); const s = fs.statSync(file);
      if (s.size < 512) throw Error('Database delle firme incompleto.');
      return {nome:candidati[0],file,dimensione:s.size,mtime:s.mtimeMs,ctime:s.ctimeMs,ino:s.ino,dev:s.dev};
    });
  }
  function statoFirme() {
    try {
      controllaPercorso(radice, 'firme', true);
      const r = JSON.parse(fs.readFileSync(controllaPercorso(radice, 'firme-verificate.json'), 'utf8'));
      const files = fileFirme(), firmaDatabase = hash(JSON.stringify(files));
      if (r.firmaDatabase !== firmaDatabase || !Number.isFinite(Date.parse(r.aggiornatoAl))) throw Error('Firme cambiate: aggiornare e verificare.');
      return {pronte:true,data:r.aggiornatoAl,aggiornatoAl:r.aggiornatoAl,firmaDatabase};
    } catch (_) { return {pronte:false,data:null,aggiornatoAl:null,firmaDatabase:null}; }
  }
  function stato() {
    return {motori:MOTORI.map(m => {
      try { const info = manifest(m.id); verifica(info,info.base); let errore = null, presente = false;
        try { installato(info); presente = true; } catch (e) { if (e.code !== 'ENOENT') errore = e.message; }
        return {...m,versione:info.versione,installato:presente,disponibile:true,errore};
      } catch (e) { return {...m,versione:null,installato:false,disponibile:false,errore:e.code === 'ENOENT' ? 'Pacchetto non incluso in questa versione di ZAINO.' : e.message}; }
    }),firme:statoFirme(),inCorso};
  }
  function percorsi(id) {
    const m = manifest(id), base = installato(m);
    const out = {eseguibile:controllaPercorso(base, m.comandi[id === 'qpdf' ? id : 'clamscan']),versione:m.versione};
    if (id === 'clamav') Object.assign(out, {freshclam:controllaPercorso(base,m.comandi.freshclam),sigtool:controllaPercorso(base,m.comandi.sigtool),database,certificati:controllaPercorso(base,'etc/certs',true),...statoFirme()});
    return out;
  }
  async function installa(id) {
    identificatore(id); if (inCorso) throw Error('Un’operazione di sicurezza è già in corso.');
    inCorso = true; let temporanea;
    try {
      const m = manifest(id); verifica(m, m.base); cartellaPrivata();
      fs.mkdirSync(motori,{recursive:true,mode:0o700}); controllaPercorso(radice,'motori',true);
      temporanea = fs.mkdtempSync(path.join(motori,'.installazione-'));
      let n = 0;
      for (const f of m.files) {
        const origine = controllaPercorso(m.base, f.origine || f.nome), destinazione = path.join(temporanea,f.nome);
        fs.mkdirSync(path.dirname(destinazione),{recursive:true,mode:0o700});
        if(f.origine)fs.writeFileSync(destinazione,payload(m,f),{flag:'wx',mode:0o600});
        else fs.copyFileSync(origine,destinazione,fs.constants.COPYFILE_EXCL); fs.chmodSync(destinazione,f.eseguibile ? 0o700 : 0o600);
        onProgress({fase:'installazione',id,messaggio:'Installazione di '+m.nome+'…',percentuale:Math.round(++n / m.files.length*100)});
      }
      verifica(m,temporanea);
      fs.writeFileSync(path.join(temporanea,'installato.json'),JSON.stringify({impronta:m.impronta}),{flag:'wx',mode:0o600,flush:true});
      const destinazione = path.join(motori,id), precedente = path.join(motori,'.precedente-'+crypto.randomUUID());
      let spostato = false;
      if (fs.existsSync(destinazione)) { controllaPercorso(motori,id,true); fs.renameSync(destinazione,precedente); spostato=true; }
      try { fs.renameSync(temporanea,destinazione); temporanea=null; } catch(e) { if(spostato)fs.renameSync(precedente,destinazione); throw e; }
      if(spostato)fs.rmSync(precedente,{recursive:true,force:true});
      return {...stato(),inCorso:false};
    } finally { if(temporanea)fs.rmSync(temporanea,{recursive:true,force:true}); inCorso=false; }
  }
  async function aggiornaFirme() {
    if(inCorso)throw Error('Un’operazione di sicurezza è già in corso.');
    inCorso=true;
    try {
      const p=percorsi('clamav'); cartellaPrivata();
      fs.mkdirSync(database,{recursive:true,mode:0o700}); controllaPercorso(radice,'firme',true);
      for(const nome of fs.readdirSync(database))controllaPercorso(database,nome);
      // La configurazione è scritta dal main; nessun parametro o comando arriva dal renderer.
      const conf=path.join(radice,'freshclam.conf');
      if(fs.existsSync(conf))controllaPercorso(radice,'freshclam.conf');
      fs.writeFileSync(conf,'DatabaseDirectory "'+database+'"\nCVDCertsDirectory "'+p.certificati+'"\nDatabaseMirror database.clamav.net\nDNSDatabaseInfo current.cvd.clamav.net\nScriptedUpdates yes\nTestDatabases yes\nBytecode yes\nConnectTimeout 30\nReceiveTimeout 120\n',{mode:0o600,flush:true});
      onProgress({fase:'firme',id:'clamav',messaggio:'Download e verifica delle firme antivirus…'});
      await esegui(p.freshclam,['--config-file='+conf,'--stdout'],{cwd:radice,env:ambiente(radice,p.certificati),timeout:15*60*1000,maxBuffer:2*1024*1024,windowsHide:true});
      for(const f of fileFirme())await esegui(p.sigtool,['--cvdcertsdir='+p.certificati,'--info='+f.file],{cwd:radice,env:ambiente(radice,p.certificati),timeout:120000,maxBuffer:1024*1024,windowsHide:true});
      const dati={firmaDatabase:hash(JSON.stringify(fileFirme())),aggiornatoAl:new Date().toISOString()};
      const tmp=path.join(radice,'.firme-'+crypto.randomUUID()+'.json');
      fs.writeFileSync(tmp,JSON.stringify(dati),{flag:'wx',mode:0o600,flush:true}); fs.renameSync(tmp,path.join(radice,'firme-verificate.json'));
      onProgress({fase:'pronto',id:'clamav',messaggio:'Firme antivirus aggiornate.'});
      return {...stato(),inCorso:false};
    } catch(e) { throw Error('Aggiornamento firme non completato: '+String(e.stderr || e.stdout || e.message).slice(0,1500)); }
    finally {inCorso=false;}
  }
  return {stato,installa,aggiornaFirme,percorsi,verificaPacchetti};
}
module.exports={crea,ambiente};
