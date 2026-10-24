'use strict';
// I motori leggono copie private e restano programmi separati. Questo confine
// applicativo non è una sandbox del sistema operativo né certifica l'innocuità.
const permessi = require('./permessi-disco'), fs = permessi.fs;
const path = require('node:path'), crypto = require('node:crypto');
const { execFile, spawnSync } = require('node:child_process');
const MAX_FILE = 200 * 1024 * 1024, MAX_LOTTO = 1024 * 1024 * 1024;
const ETA_FIRME = 7 * 86400000, MAX_OUTPUT = 8 * 1024 * 1024;
const VERSIONE_POLICY = 1;

function ambiente(cartella, certificati, piattaforma = process.platform, ereditato = process.env) {
  // Solo la radice di Windows è necessaria al runtime nativo. PATH, variabili
  // del loader e configurazioni del chiamante non passano ai motori.
  const env = { HOME: cartella, TMPDIR: cartella, TEMP: cartella, TMP: cartella, LANG: 'C', LC_ALL: 'C' };
  if (piattaforma === 'win32') {
    const richiesta = ereditato.SystemRoot || ereditato.WINDIR || 'C:\\Windows';
    const radice = typeof richiesta === 'string' && /^[a-z]:[\\\/]/i.test(richiesta) && !/[;\r\n\0]/.test(richiesta) ? path.win32.normalize(richiesta) : 'C:\\Windows';
    env.SystemRoot = radice; env.WINDIR = radice;
    env.PATH = path.win32.join(radice, 'System32') + ';' + radice;
  } else env.PATH = '/usr/bin:/bin';
  if (certificati) env.CVD_CERTS_DIR = certificati;
  return env;
}
function errore(messaggio) { return { ok: false, minaccia: false, error: messaggio, avvisi: [] }; }
function identita(st) { return [st.dev, st.ino, st.size, st.mtimeMs, st.ctimeMs].join(':'); }
function fileRegolare(p) {
  if (typeof p !== 'string' || !path.isAbsolute(p) || p.includes('\0')) throw new Error('Percorso del file non valido.');
  const st = fs.lstatSync(p);
  if (!st.isFile() || st.isSymbolicLink() || st.nlink > 1) throw new Error('File speciale, collegamento simbolico o hard link non consentito.');
  return st;
}
function leggiPdf(p, copia) {
  const prima = fileRegolare(p);
  if (path.extname(p).toLowerCase() !== '.pdf') throw new Error('Il controllo riguarda soltanto PDF.');
  if (prima.size > MAX_FILE) throw new Error('PDF oltre il limite di controllo di 200 MB.');
  const fd = fs.openSync(p, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0));
  let fuori;
  try {
    const st = fs.fstatSync(fd);
    if (!st.isFile() || st.nlink > 1 || identita(st) !== identita(prima)) throw new Error('Il PDF è cambiato prima del controllo.');
    const hash = crypto.createHash('sha256'), buffer = Buffer.alloc(Math.min(1024 * 1024, Math.max(16, st.size)));
    if (copia) fuori = fs.openSync(copia, 'wx', 0o600);
    let posizione = 0;
    while (posizione < st.size) {
      const letti = fs.readSync(fd, buffer, 0, Math.min(buffer.length, st.size - posizione), posizione);
      if (!letti) throw new Error('Lettura del PDF incompleta.');
      if (!posizione && !/^%PDF-(?:1\.[0-7]|2\.0)(?:\s|$)/.test(buffer.toString('latin1', 0, Math.min(16, letti)))) throw new Error('Il contenuto non corrisponde al formato PDF.');
      hash.update(buffer.subarray(0, letti));
      if (fuori !== undefined) {
        let scritti = 0;
        while (scritti < letti) scritti += fs.writeSync(fuori, buffer, scritti, letti - scritti);
      }
      posizione += letti;
    }
    if (!posizione) throw new Error('PDF vuoto.');
    if (identita(fs.fstatSync(fd)) !== identita(st) || identita(fileRegolare(p)) !== identita(st)) throw new Error('Il PDF è cambiato durante la lettura. Riprova.');
    return { hash: hash.digest('hex'), identita: identita(st), size: st.size };
  } finally { if (fuori !== undefined) fs.closeSync(fuori); fs.closeSync(fd); }
}
function avviaAsync(binario, argomenti, opzioni) {
  return new Promise(resolve => {
    execFile(binario, argomenti, opzioni, (error, stdout, stderr) => resolve({
      status: error ? (Number.isInteger(error.code) ? error.code : null) : 0,
      signal: error?.signal, error, stdout, stderr
    }));
  });
}
function esitoProcesso(r, nome) {
  if (!r || r.signal || r.status === null || r.status === undefined || (r.error && !Number.isInteger(r.error.code))) {
    return errore(nome + ': controllo interrotto o non completato (tempo limite o errore del motore).');
  }
  return null;
}
function esitoQpdf(r, copia) {
  const fallito = esitoProcesso(r, 'qpdf'); if (fallito) return fallito;
  const stdout = String(r.stdout || ''), stderr = String(r.stderr || '');
  if (![0, 3].includes(r.status)) return errore('qpdf non riesce a verificare la struttura del PDF.');
  if (!stdout.includes('checking ' + copia) || !/PDF Version: \d\.\d/.test(stdout) || !stdout.includes('File is not encrypted')) {
    return errore('qpdf: PDF cifrato o verifica della struttura incompleta.');
  }
  const righe = stderr.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (r.status === 0 && !righe.length) return { ok: true, minaccia: false, avvisi: [] };
  // I PDF CT contengono questo specifico difetto recuperabile. Gli altri
  // warning non vengono assimilati a innocui né descritti come malware.
  const avvisi = righe.filter(s => s.startsWith('WARNING: '));
  const noto = s => s.startsWith('WARNING: ' + copia + ' (object ') && /\(object \d+ \d+\): object has offset 0 - a common error handled correctly by qpdf and most other applications$/.test(s);
  if (r.status === 3 && avvisi.length && avvisi.every(noto) && righe.every(s => noto(s) || s === 'qpdf: operation succeeded with warnings')) {
    return { ok: true, minaccia: false, avvisi: ['qpdf: object has offset 0. Difetto strutturale recuperabile; non è una rilevazione di malware.'] };
  }
  return errore('qpdf segnala un problema strutturale che richiede una verifica del documento.');
}
function esitiClamav(r, copie) {
  const fallito = esitoProcesso(r, 'ClamAV');
  if (fallito || ![0, 1].includes(r.status) || String(r.stderr || '').trim()) {
    return copie.map(() => fallito || errore('ClamAV: verifica incompleta o errore del motore/database.'));
  }
  const righe = String(r.stdout || '').split(/\r?\n/).filter(Boolean);
  const esiti = copie.map(copia => {
    const riscontri = righe.filter(riga => riga.startsWith(copia + ': '));
    if (riscontri.length !== 1) return errore('ClamAV non conferma il controllo completo del PDF.');
    const risposta = riscontri[0].slice(copia.length + 2);
    if (risposta === 'OK') return { ok: true, minaccia: false, avvisi: [] };
    if (risposta.endsWith(' FOUND')) {
      const firma = risposta.slice(0, -6);
      if (/^Heuristics\.(?:Limits\.Exceeded|Encrypted\.)/.test(firma)) return errore('ClamAV: documento non verificabile integralmente (' + firma + ').');
      return { ok: false, minaccia: true, error: 'ClamAV ha rilevato: ' + firma + '.', avvisi: [] };
    }
    return errore('ClamAV non ha completato il controllo del PDF.');
  });
  const rilevati = righe.some(riga => riga.endsWith(' FOUND'));
  if ((r.status === 1 && !rilevati) || (r.status === 0 && rilevati) || righe.some(riga => !copie.some(copia => riga.startsWith(copia + ': ')))) {
    return copie.map(() => errore('ClamAV ha restituito un risultato incoerente o incompleto.'));
  }
  return esiti;
}
function crea({ tempRoot, strumenti, preferenze, onProgress = () => {}, avvia = avviaAsync, avviaSync = spawnSync }) {
  if (!path.isAbsolute(tempRoot || '') || typeof strumenti !== 'function' || typeof preferenze !== 'function') throw new Error('Configurazione sicurezza PDF incompleta.');
  const cache = new Map();
  let coda = Promise.resolve();
  function progresso(stato) { try { onProgress(stato); } catch (_) { /* un errore della UI non autorizza il file */ } }
  function contesto() {
    const p = preferenze() || {}, attivi = { qpdf: p.qpdf === true, clamav: p.clamav === true };
    if (!attivi.qpdf && !attivi.clamav) return { attivi, chiave: 'spenti' };
    const motori = strumenti() || {}, identitaMotori = {};
    for (const nome of ['qpdf', 'clamav']) {
      if (!attivi[nome]) continue;
      const m = motori[nome], atteso = nome === 'qpdf' ? 'qpdf' : 'clamscan';
      if (!m?.eseguibile || !m.versione || !new RegExp('^' + atteso + '(?:\\.exe)?$').test(path.basename(m.eseguibile))) throw new Error(nome + ': installa il motore in Impostazioni → Sicurezza.');
      identitaMotori[nome] = { eseguibile: m.eseguibile, versione: m.versione, file: identita(fileRegolare(m.eseguibile)) };
      if (nome === 'clamav') {
        const data = typeof m.aggiornatoAl === 'number' ? m.aggiornatoAl : Date.parse(m.aggiornatoAl);
        if (!Number.isFinite(data) || data > Date.now() + 86400000 || Date.now() - data > ETA_FIRME || !m.firmaDatabase) throw new Error('ClamAV: aggiorna le firme antivirus in Impostazioni → Sicurezza (validità massima 7 giorni).');
        if (!path.isAbsolute(m.database || '') || !fs.lstatSync(m.database).isDirectory() || fs.lstatSync(m.database).isSymbolicLink()) throw new Error('ClamAV: database delle firme non disponibile.');
        const firme = fs.readdirSync(m.database).filter(n => /\.(?:cvd|cld|cud)$/.test(n)).sort().map(n => [n, identita(fileRegolare(path.join(m.database, n)))]);
        if (!firme.length) throw new Error('ClamAV: database delle firme mancante.');
        identitaMotori[nome].database = [m.database, m.firmaDatabase, data, firme];
        if (m.certificati) {
          if (!path.isAbsolute(m.certificati) || !fs.lstatSync(m.certificati).isDirectory() || fs.lstatSync(m.certificati).isSymbolicLink()) throw new Error('ClamAV: certificati delle firme non disponibili.');
          const certificati = fs.readdirSync(m.certificati).sort().map(n => [n, identita(fileRegolare(path.join(m.certificati, n)))]);
          if (!certificati.length) throw new Error('ClamAV: certificati delle firme mancanti.');
          identitaMotori[nome].certificati = [m.certificati, certificati];
        }
      }
    }
    return { attivi, motori, chiave: JSON.stringify([VERSIONE_POLICY, attivi, identitaMotori]) };
  }
  function ambito(fn) {
    const attuale = permessi.corrente();
    if (!attuale) return fn();
    // Il main fornisce la propria cartella temporanea privata. Nessun percorso
    // sorgente viene aggiunto: i suoi privilegi devono già essere autorizzati.
    return permessi.esegui({ lettura: [...attuale.lettura, tempRoot], scrittura: [...attuale.scrittura, tempRoot], metadati: [...attuale.metadati, tempRoot] }, fn);
  }
  function comando(binario, argomenti, timeout, cartella, certificati) {
    return { binario, argomenti, opzioni: {
      shell: false, windowsHide: true, encoding: 'utf8', maxBuffer: MAX_OUTPUT, timeout, killSignal: 'SIGKILL', cwd: cartella,
      env: ambiente(cartella, certificati)
    } };
  }
  function* esamina(percorsi) {
    const elenco = Array.isArray(percorsi) ? [...new Set(percorsi)] : [percorsi];
    const esiti = elenco.map(percorso => ({ percorso, ...errore('Controllo non completato.') }));
    let cartella;
    try {
      const ctx = contesto();
      if (ctx.chiave === 'spenti') return riepilogo(esiti.map(e => ({ percorso: e.percorso, ok: true, minaccia: false, avvisi: [], disattivato: true })));
      if (elenco.length > 1000) throw new Error('Seleziona al massimo 1000 PDF per controllo.');
      cartella = fs.mkdtempSync(path.join(tempRoot, 'pdf-')); fs.chmodSync(cartella, 0o700);
      let totaleByte = 0;
      const daControllare = [];
      for (let i = 0; i < elenco.length; i++) {
        const p = elenco[i];
        progresso({ fase: 'preparazione', corrente: i + 1, totale: elenco.length, nome: typeof p === 'string' ? path.basename(p) : '' });
        try {
          const dimensione = fileRegolare(p).size;
          if (dimensione > MAX_FILE) throw new Error('PDF oltre il limite di controllo di 200 MB.');
          totaleByte += dimensione;
          if (totaleByte > MAX_LOTTO) throw new Error('Il lotto supera 1 GB: importa i PDF in gruppi più piccoli.');
          const originale = leggiPdf(p), chiave = ctx.chiave + ':' + originale.hash, precedente = cache.get(chiave);
          if (precedente) { esiti[i] = { percorso: p, ...precedente, avvisi: [...precedente.avvisi], cache: true }; continue; }
          const copia = path.join(cartella, String(i).padStart(5, '0') + '.pdf'), copiata = leggiPdf(p, copia);
          if (copiata.hash !== originale.hash || copiata.identita !== originale.identita) throw new Error('Il PDF è cambiato prima della scansione.');
          esiti[i] = { percorso: p, ok: true, minaccia: false, avvisi: [], hash: originale.hash, cache: false };
          daControllare.push({ i, p, copia, originale, chiave });
        } catch (e) { esiti[i] = { percorso: p, ...errore(e.message || 'PDF non leggibile.') }; }
      }
      if (ctx.attivi.qpdf) for (const f of daControllare) {
        progresso({ fase: 'qpdf', corrente: f.i + 1, totale: elenco.length, nome: path.basename(f.p) });
        const r = yield comando(ctx.motori.qpdf.eseguibile, ['--check', f.copia], 30000, cartella);
        Object.assign(esiti[f.i], esitoQpdf(r, f.copia));
      }
      const perAntivirus = daControllare.filter(f => esiti[f.i].ok);
      if (ctx.attivi.clamav && perAntivirus.length) {
        progresso({ fase: 'clamav', corrente: 0, totale: perAntivirus.length });
        const args = ['--no-summary', '--scan-pdf=yes', '--alert-exceeds-max=yes', '--alert-encrypted=yes', '--fail-if-cvd-older-than=7', '--follow-dir-symlinks=0', '--follow-file-symlinks=0', '--max-filesize=200M', '--max-scansize=512M', '--max-scantime=120000', '--max-recursion=16', '--max-files=10000', '--database=' + ctx.motori.clamav.database, '--tempdir=' + cartella, ...(ctx.motori.clamav.certificati ? ['--cvdcertsdir=' + ctx.motori.clamav.certificati] : []), ...perAntivirus.map(f => f.copia)];
        const r = yield comando(ctx.motori.clamav.eseguibile, args, Math.min(600000, 30000 + perAntivirus.length * 120000), cartella, ctx.motori.clamav.certificati);
        const controlli = esitiClamav(r, perAntivirus.map(f => f.copia));
        perAntivirus.forEach((f, i) => { const avvisi = esiti[f.i].avvisi; Object.assign(esiti[f.i], controlli[i]); esiti[f.i].avvisi = avvisi.concat(controlli[i].avvisi); });
      }
      if (contesto().chiave !== ctx.chiave) throw new Error('Le impostazioni o i motori sono cambiati durante il controllo. Riprova.');
      for (const f of daControllare) {
        if (!esiti[f.i].ok) continue;
        try {
          const attuale = leggiPdf(f.p), copia = leggiPdf(f.copia);
          if (attuale.hash !== f.originale.hash || attuale.identita !== f.originale.identita || copia.hash !== f.originale.hash) throw new Error('Il PDF è cambiato durante il controllo. Riprova.');
          cache.set(f.chiave, { ok: true, minaccia: false, hash: f.originale.hash, avvisi: [...esiti[f.i].avvisi] });
          while (cache.size > 2000) cache.delete(cache.keys().next().value);
        } catch (e) { Object.assign(esiti[f.i], errore(e.message)); }
      }
      progresso({ fase: 'completato', corrente: elenco.length, totale: elenco.length });
      return riepilogo(esiti);
    } catch (e) {
      return riepilogo(esiti.map(r => ({ percorso: r.percorso, ...errore(e.message || 'Controllo PDF non completato.') })));
    } finally { if (cartella) fs.rmSync(cartella, { recursive: true, force: true }); }
  }
  function riepilogo(esiti) { return { ok: esiti.every(e => e.ok), esiti, controllati: esiti.filter(e => e.ok && !e.disattivato).length, bloccati: esiti.filter(e => !e.ok).length }; }
  function controlla(percorsi) {
    // Una sola scansione per volta: richieste parallele/range riusano la cache
    // appena prodotta senza caricare più copie delle firme in memoria.
    const lavoro = coda.catch(() => {}).then(() => ambito(async () => {
      const verifica = esamina(percorsi); let passo = verifica.next();
      while (!passo.done) {
        const c = passo.value;
        try { passo = verifica.next(await avvia(c.binario, c.argomenti, c.opzioni)); }
        catch (e) { passo = verifica.throw(e); }
      }
      return passo.value;
    }));
    coda = lavoro; return lavoro;
  }
  function controllaSync(percorso) {
    return ambito(() => {
      const verifica = esamina([percorso]); let passo = verifica.next();
      while (!passo.done) {
        const c = passo.value;
        try { passo = verifica.next(avviaSync(c.binario, c.argomenti, c.opzioni)); }
        catch (e) { passo = verifica.throw(e); }
      }
      return passo.value.esiti[0];
    });
  }
  function richiediSync(percorso) {
    // Import e letture legacy arrivano qui soltanto dopo il preflight async.
    // Un file cambiato non può trasformare una copia in minuti di main bloccato.
    return ambito(() => {
      try {
        const ctx = contesto();
        if (ctx.chiave === 'spenti') return { percorso, ok: true, minaccia: false, avvisi: [], disattivato: true };
        const attuale = leggiPdf(percorso), approvato = cache.get(ctx.chiave + ':' + attuale.hash);
        if (!approvato || contesto().chiave !== ctx.chiave) throw new Error('PDF non verificato o cambiato dopo il controllo. Riprova l’importazione o riapri il documento per avviare il controllo di sicurezza.');
        return { percorso, ...approvato, avvisi: [...approvato.avvisi], cache: true };
      } catch (causa) {
        const e = new Error(causa.message || 'PDF non verificato. Riprova l’importazione.');
        e.code = 'PDF_NON_VERIFICATO'; e.esito = { percorso, ...errore(e.message) }; throw e;
      }
    });
  }
  return { controlla, controllaSync, richiediSync, svuotaCache: () => cache.clear() };
}
module.exports = { crea, ambiente };
