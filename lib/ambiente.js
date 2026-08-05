'use strict';
/**
 * Com'è fatta questa macchina, e che cosa conviene fare di conseguenza.
 *
 * Due funzioni con due nature diverse, e la distinzione è il punto del modulo:
 *
 *  - `rileva()` GUARDA il sistema: interroga binari, legge cartelle, misura lo
 *    spazio. Non si può provare con un test, perché la risposta dipende dalla
 *    macchina su cui gira.
 *  - `consiglio(stato)` è PURA: riceve lo stato come argomento e decide cosa
 *    suggerire. Tutta la logica che vale la pena verificare sta qui, e `npm test`
 *    la prova senza toccare niente.
 *
 * Perché esiste: al primo avvio StudIA presumeva che chi la apre sapesse già
 * quale motore AI userà, che serve Python per trascrivere, e che il primo video
 * scarica più di un giga di modello. Lo si scopriva a metà di un'operazione
 * lunga. Questo modulo permette di dirlo prima.
 *
 * Nota sul PATH: un'app lanciata dal Finder eredita il PATH minimo di launchd
 * (/usr/bin:/bin:/usr/sbin:/sbin), non quello della shell. Per Python il
 * problema non è «non lo trovo» — macOS fornisce /usr/bin/python3 — ma «trovo
 * quello sbagliato»: su molte macchine quel binario è un 3.9 mentre l'utente ha
 * un 3.13 altrove, e il venv costruito sul vecchio installa peggio o non
 * installa. Perciò qui non si prende il primo che risponde: si prende il più
 * recente fra i candidati noti, e si dice all'utente quale è stato scelto.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const TIMEOUT = 8000;                      // nessuna interrogazione blocca l'avvio
const PY_MINIMA = [3, 10, 0];              // sotto questa, mlx-whisper e faster-whisper soffrono
const WHISPER_GB = 1.5;                    // quanto scarica il primo video
const SPAZIO_MINIMO_GB = 5;

// ---------------------------------------------------------------- versioni

/** I numeri di versione dentro un testo qualunque: «Python 3.13.1» → [3,13,1]. */
function versioneDa(testo) {
  const m = /(\d+)\.(\d+)(?:\.(\d+))?/.exec(String(testo == null ? '' : testo));
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] || 0)] : null;
}

/** -1, 0, +1 come qualunque comparatore. Un null perde sempre. */
function confronta(a, b) {
  if (!a) return b ? -1 : 0;
  if (!b) return 1;
  for (let i = 0; i < 3; i++) {
    const d = (a[i] || 0) - (b[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

// ---------------------------------------------------------------- Python

/**
 * Dove Python 3 si installa davvero su un Mac, oltre a quello di sistema.
 * L'ordine qui non decide niente: la scelta è per versione, non per posizione.
 */
function candidatiPython() {
  const casa = os.homedir();
  const out = [];
  if (process.env.STUDIA_PYTHON) out.push(process.env.STUDIA_PYTHON);
  out.push('/opt/homebrew/bin/python3');                    // Homebrew su Apple Silicon
  out.push('/usr/local/bin/python3');                       // Homebrew su Intel, o python.org vecchi
  // gli installer di python.org tengono una cartella per versione
  const frameworks = '/Library/Frameworks/Python.framework/Versions';
  let vers = [];
  try { vers = fs.readdirSync(frameworks); } catch (e) {}
  for (const v of vers) {
    if (v === 'Current') continue;                          // è un link a una delle altre
    out.push(path.join(frameworks, v, 'bin', 'python3'));
  }
  out.push(path.join(casa, '.pyenv', 'shims', 'python3'));
  out.push('/usr/bin/python3');                             // quello di macOS: c'è sempre, è il più vecchio
  return out;
}

/**
 * `/usr/bin/python3` senza gli strumenti da riga di comando di Xcode è uno
 * stub: interrogarlo apre una finestra d'installazione. Dentro un'app packaged
 * quella finestra è un blocco muto, quindi non lo si interroga affatto.
 */
function stubDiXcode(p) {
  if (process.platform !== 'darwin') return false;
  if (p !== '/usr/bin/python3') return false;
  try {
    const r = spawnSync('/usr/bin/xcode-select', ['-p'], { encoding: 'utf-8', timeout: TIMEOUT });
    return !r || r.status !== 0;
  } catch (e) { return true; }               // nel dubbio non lo si tocca
}

/** Che versione è, o null se non è un Python utilizzabile. */
function interroga(p) {
  if (!p) return null;
  try {
    const r = spawnSync(p, ['--version'], { encoding: 'utf-8', timeout: TIMEOUT });
    if (!r || r.status !== 0) return null;
    // Python 3.9 stampa la versione su stderr, i più recenti su stdout
    const v = versioneDa(String(r.stdout || '') + ' ' + String(r.stderr || ''));
    if (!v || v[0] < 3) return null;
    return { percorso: p, versione: v.join('.'), v };
  } catch (e) { return null; }
}

/** Chiede alla shell di login: è il modo che funziona con nvm, pyenv e simili. */
function chiediAllaShell() {
  const shell = process.env.SHELL || '/bin/zsh';
  try {
    const r = spawnSync(shell, ['-lc', 'command -v python3'], { encoding: 'utf-8', timeout: TIMEOUT });
    const p = String((r && r.stdout) || '').trim().split('\n').pop();
    return p && fs.existsSync(p) ? p : null;
  } catch (e) { return null; }
}

/**
 * Quale interprete usare, fra quelli che hanno risposto. Pura: la scelta è la
 * parte che conta e va provata senza dipendere da com'è fatta la macchina.
 *
 * La regola è «il più recente», con una sola eccezione: se l'utente ha imposto
 * un percorso con STUDIA_PYTHON, quello vince: è una scelta esplicita e
 * scavalcarla per un decimale di versione sarebbe solo prepotenza.
 */
function scegli(visti, esplicito) {
  if (!visti || !visti.length) return { trovato: false, candidati: [] };
  const imposto = esplicito ? visti.find((c) => c.percorso === esplicito) : null;
  let migliore = imposto || visti[0];
  if (!imposto) for (const c of visti) if (confronta(c.v, migliore.v) > 0) migliore = c;
  return {
    trovato: true, percorso: migliore.percorso, versione: migliore.versione, v: migliore.v,
    candidati: visti.map((c) => ({ percorso: c.percorso, versione: c.versione })),
    esplicito: !!imposto,
    // vero quando la scelta buona NON è quella che avrebbe fatto un `spawn('python3')`:
    // è il caso in cui vale la pena dire all'utente quale interprete si usa
    diversoDaSistema: migliore.percorso !== '/usr/bin/python3' && visti.some((c) => c.percorso === '/usr/bin/python3')
  };
}

/**
 * Il Python più recente fra quelli installati, con l'elenco di tutti quelli
 * visti: l'onboarding lo mostra, perché «quale interprete hai scelto» è
 * esattamente la cosa che di solito non si capisce.
 */
function pythonMigliore() {
  const visti = [];
  const gia = new Set();
  for (const c of candidatiPython()) {
    if (!c || gia.has(c)) continue;
    gia.add(c);
    if (stubDiXcode(c)) continue;
    const r = interroga(c);
    if (r) visti.push(r);
  }
  if (!visti.length) {
    const dallaShell = chiediAllaShell();
    const r = interroga(dallaShell);
    if (r) visti.push(r);
  }
  return scegli(visti, process.env.STUDIA_PYTHON || null);
}

// ---------------------------------------------------------------- resto della macchina

/** Il modello di trascrizione è già scaricato? Se no, il primo video ci mette. */
function modelloWhisper() {
  const hub = path.join(os.homedir(), '.cache', 'huggingface', 'hub');
  let dirs = [];
  try { dirs = fs.readdirSync(hub); } catch (e) { return { presente: false, dove: null }; }
  const d = dirs.find((x) => /whisper/i.test(x));
  return { presente: !!d, dove: d ? path.join(hub, d) : null };
}

/** Gigabyte liberi sul volume che contiene `dir`, o null se non si sa. */
function spazioLiberoGb(dir) {
  if (!dir) return null;
  try {
    const s = fs.statfsSync(dir);
    return Math.round((s.bavail * s.bsize) / 1e9 * 10) / 10;
  } catch (e) { return null; }
}

/** Si può scrivere davvero là dentro? Lo si prova, invece di dedurlo dai permessi. */
function scritturaOk(dir) {
  if (!dir) return false;
  const f = path.join(dir, '.studia-prova-scrittura');
  try { fs.writeFileSync(f, 'x'); fs.unlinkSync(f); return true; }
  catch (e) { return false; }
}

/** L'ambiente Python di StudIA esiste già con le sue dipendenze? */
function venvPronto(venvPy) {
  if (!venvPy) return false;
  try {
    if (!fs.existsSync(venvPy)) return false;
    const r = spawnSync(venvPy, ['-c', 'import faster_whisper, pypdf'], { timeout: 30000 });
    return !!r && r.status === 0;
  } catch (e) { return false; }
}

/**
 * Lo stato della macchina, tutto in un colpo.
 * `chiavi` arriva da fuori: le chiavi API sono cifrate col Keychain e leggibili
 * solo dal main process, quindi questo modulo non le cerca da sé.
 */
function rileva(opts) {
  const o = opts || {};
  let cc;
  try { cc = require('./ai/claudecode').diagnosi(); }
  catch (e) { cc = { ok: false, motivo: 'errore', spiegazione: String((e && e.message) || e) }; }
  const py = pythonMigliore();
  const whisper = modelloWhisper();
  // la lettura avanzata dei documenti è facoltativa: qui si guarda solo se c'è
  let ocrStato = { installato: false };
  try { ocrStato = require('./ocr').stato(o.userData); } catch (e) {}
  return {
    ocr: ocrStato,
    piattaforma: process.platform,
    arch: process.arch,
    claudecode: cc,
    python: py,
    venvPronto: venvPronto(o.venvPython),
    chiavi: o.chiavi || {},
    vault: { path: o.vaultPath || null, scritturaOk: scritturaOk(o.vaultPath) },
    spazioLiberoGb: spazioLiberoGb(o.vaultPath || os.homedir()),
    modelloWhisperPresente: whisper.presente,
    modelloWhisperDove: whisper.dove
  };
}

// ---------------------------------------------------------------- la parte pura

/**
 * Dato lo stato, che cosa suggerire. Nessun accesso al sistema: solo decisioni.
 *
 * `motore`:  'claudecode' → c'è il binario, si usa l'abbonamento, niente chiavi
 *            'apikey'     → nessun Claude Code ma almeno una chiave c'è
 *            'nessuno'    → l'app resta usabile in sola lettura
 *
 * Ogni avviso ha un `id` stabile (l'UI ci appende il testo), un `livello`
 * ('attenzione' | 'avviso' | 'info') e, quando esiste, il `comando` da copiare.
 * L'ordine è deterministico: i test ci contano.
 */
function consiglio(stato) {
  const s = stato || {};
  const cc = s.claudecode || {};
  const chiavi = s.chiavi || {};
  const fornitoriPronti = Object.keys(chiavi).filter((k) => chiavi[k] && k !== 'claudecode').sort();
  const motore = cc.ok ? 'claudecode' : (fornitoriPronti.length ? 'apikey' : 'nessuno');
  const avvisi = [];

  if (motore === 'nessuno') {
    avvisi.push({
      id: 'motore-assente', livello: 'attenzione',
      testo: 'Nessun motore AI disponibile: non si possono generare corsi nuovi. ' +
             'I corsi già scritti si leggono comunque, senza limitazioni.',
      azione: 'installa-claudecode'
    });
  }

  const py = s.python || {};
  if (!py.trovato) {
    avvisi.push({
      id: 'python-assente', livello: 'attenzione',
      testo: 'Python 3 non trovato: senza, i video non si trascrivono. Il resto dell’app funziona.',
      comando: 'xcode-select --install'
    });
  } else {
    if (confronta(py.v, PY_MINIMA) < 0) {
      avvisi.push({
        id: 'python-vecchio', livello: 'avviso',
        testo: 'Il Python trovato è il ' + py.versione + ', più vecchio del ' + PY_MINIMA.slice(0, 2).join('.') +
               ': la trascrizione veloce su GPU potrebbe non installarsi. Un Python più recente la abilita.',
        comando: 'brew install python@3.13'
      });
    }
    if (py.diversoDaSistema) {
      avvisi.push({
        id: 'python-scelto', livello: 'info',
        testo: 'Sul computer ci sono più Python: StudIA userà il ' + py.versione + ' in ' + py.percorso +
               (py.esplicito ? ', quello che hai imposto con STUDIA_PYTHON.'
                             : ', il più recente fra quelli installati.')
      });
    }
    if (!s.modelloWhisperPresente) {
      avvisi.push({
        id: 'whisper-download', livello: 'info',
        testo: 'Il primo video da trascrivere scarica il modello Whisper, circa ' +
               String(WHISPER_GB).replace('.', ',') + ' GB. Succede una volta sola, ' +
               'e conviene farlo con una connessione buona.'
      });
    }
  }

  if (typeof s.spazioLiberoGb === 'number' && s.spazioLiberoGb < SPAZIO_MINIMO_GB) {
    avvisi.push({
      id: 'spazio', livello: 'attenzione',
      testo: 'Restano ' + String(s.spazioLiberoGb).replace('.', ',') + ' GB liberi: il modello di trascrizione ' +
             'da solo ne chiede ' + String(WHISPER_GB).replace('.', ',') + ', più i video e le trascrizioni.'
    });
  }

  const v = s.vault || {};
  if (v.path && !v.scritturaOk) {
    avvisi.push({
      id: 'vault-non-scrivibile', livello: 'attenzione',
      testo: 'Non riesco a scrivere nella cartella scelta. Scegline un’altra, ' +
             'fuori da cartelle di sistema o da un disco in sola lettura.'
    });
  }

  /* La lettura avanzata dei documenti sta FUORI dagli avvisi, in un campo suo.
     Un avviso segnala un guasto; questa è una possibilità, e metterla in mezzo
     agli altri avrebbe reso impossibile lo stato «non c'è niente da dire» — che
     su una macchina a posto è la cosa giusta da mostrare. */
  let ocr = null;
  try { ocr = require('./ocr').consiglio(s.ocr || {}, s); } catch (e) {}

  return { motore, soloLettura: motore === 'nessuno', fornitoriPronti, avvisi, ocr };
}

module.exports = {
  rileva, consiglio, pythonMigliore, scegli, candidatiPython, interroga, stubDiXcode,
  modelloWhisper, spazioLiberoGb, scritturaOk, venvPronto,
  versioneDa, confronta, PY_MINIMA, WHISPER_GB, SPAZIO_MINIMO_GB
};
