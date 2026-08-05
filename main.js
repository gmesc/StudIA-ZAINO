const { app, BrowserWindow, shell, ipcMain, dialog, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, spawnSync } = require('child_process');
const readline = require('readline');
const os = require('os');
const { pathToFileURL } = require('url');

const CFG = path.join(app.getPath('userData'), 'config.json');
const readCfg = () => { try { return JSON.parse(fs.readFileSync(CFG, 'utf8')); } catch (e) { return {}; } };
const writeCfg = (c) => { try { fs.mkdirSync(path.dirname(CFG), { recursive: true }); } catch (e) {} fs.writeFileSync(CFG, JSON.stringify(c, null, 2)); };
const mat = require('./lib/materiali');   // i materiali possono vivere dentro il progetto
// Un vault nuovo nasce con le sole cartelle che servono: i materiali di un
// progetto vivono dentro il progetto (vedi lib/materiali.js), «Corsi/» era il
// formato JSON di prima e non si crea più.
const scaffold = (v) => { for (const d of ['Progetti', mat.ATTESA, '.studia']) { try { fs.mkdirSync(path.join(v, d), { recursive: true }); } catch (e) {} } };

// ---- chiavi API personali: cifrate con safeStorage (Keychain) quando disponibile ----
const PROVIDERS = ['anthropic', 'openai', 'google'];
function storeKey(provider, value) {
  const c = readCfg(); c.keys = c.keys || {};
  if (!value) { delete c.keys[provider]; writeCfg(c); return; }
  const hint = value.length > 4 ? value.slice(-4) : '';
  let rec;
  try {
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      rec = { enc: true, data: safeStorage.encryptString(value).toString('base64'), hint };
    } else {
      rec = { enc: false, data: Buffer.from(value, 'utf8').toString('base64'), hint };
    }
  } catch (e) { rec = { enc: false, data: Buffer.from(value, 'utf8').toString('base64'), hint }; }
  c.keys[provider] = rec; writeCfg(c);
}
// esposta solo al main (per la futura generazione): NON passa mai al renderer
function readKey(provider) {
  const c = readCfg(); const r = c.keys && c.keys[provider]; if (!r) return null;
  try { const buf = Buffer.from(r.data, 'base64'); return r.enc ? safeStorage.decryptString(buf) : buf.toString('utf8'); }
  catch (e) { return null; }
}
function keysStatus() {
  const c = readCfg(); const k = c.keys || {}; const out = {};
  for (const p of PROVIDERS) out[p] = k[p] ? { set: true, hint: k[p].hint || '', enc: !!k[p].enc } : { set: false };
  return out;
}
ipcMain.handle('keys:status', () => keysStatus());
ipcMain.handle('keys:set', (e, { provider, value }) => {
  if (!PROVIDERS.includes(provider)) return { ok: false };
  storeKey(provider, (value || '').trim()); return { ok: true, status: keysStatus() };
});
ipcMain.handle('keys:clear', (e, { provider }) => { if (PROVIDERS.includes(provider)) storeKey(provider, ''); return { ok: true, status: keysStatus() }; });

// ---- registro costi di generazione AI: Costi/usage.jsonl nel vault ----
ipcMain.handle('costs:summary', () => {
  const empty = { total: { costUsd: 0, inputTokens: 0, outputTokens: 0, calls: 0 }, byProvider: [], byModel: [], byDay: [], recent: [], currency: 'USD' };
  const c = readCfg(); if (!c.vaultPath) return empty;
  const f = path.join(c.vaultPath, 'Costi', 'usage.jsonl');
  let raw; try { raw = fs.readFileSync(f, 'utf8'); } catch (e) { return empty; }
  const rows = [];
  for (const ln of raw.split('\n')) { const s = ln.trim(); if (!s) continue; try { rows.push(JSON.parse(s)); } catch (e) {} }
  if (!rows.length) return empty;
  const total = { costUsd: 0, inputTokens: 0, outputTokens: 0, calls: 0 };
  const byP = {}, byM = {}, byD = {};
  for (const r of rows) {
    const cost = Number(r.costUsd) || 0, ti = Number(r.inputTokens) || 0, to = Number(r.outputTokens) || 0;
    total.costUsd += cost; total.inputTokens += ti; total.outputTokens += to; total.calls++;
    const prov = r.provider || '?', mod = r.model || '?', day = (r.ts || '').slice(0, 10) || '?';
    (byP[prov] = byP[prov] || { provider: prov, costUsd: 0, calls: 0 }).costUsd += cost; byP[prov].calls++;
    (byM[mod] = byM[mod] || { model: mod, costUsd: 0, calls: 0 }).costUsd += cost; byM[mod].calls++;
    (byD[day] = byD[day] || { day, costUsd: 0, calls: 0 }).costUsd += cost; byD[day].calls++;
  }
  return {
    total,
    byProvider: Object.values(byP).sort((a, b) => b.costUsd - a.costUsd),
    byModel: Object.values(byM).sort((a, b) => b.costUsd - a.costUsd),
    byDay: Object.values(byD).sort((a, b) => (a.day < b.day ? -1 : 1)),
    recent: rows.slice(-25).reverse(), currency: 'USD'
  };
});
// append di una riga d'uso (la userà la pipeline di generazione)
ipcMain.handle('costs:log', (e, entry) => {
  const c = readCfg(); if (!c.vaultPath) return { ok: false };
  entry = entry || {};
  try { fs.mkdirSync(path.join(c.vaultPath, 'Costi'), { recursive: true }); } catch (_) {}
  const row = {
    ts: entry.ts || new Date().toISOString(), provider: entry.provider || '?', model: entry.model || '?',
    inputTokens: Number(entry.inputTokens) || 0, outputTokens: Number(entry.outputTokens) || 0,
    costUsd: Number(entry.costUsd) || 0, courseId: entry.courseId || '', label: entry.label || ''
  };
  try { fs.appendFileSync(path.join(c.vaultPath, 'Costi', 'usage.jsonl'), JSON.stringify(row) + '\n'); }
  catch (err) { return { ok: false, error: String(err) }; }
  return { ok: true };
});

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1320, height: 880, title: 'StudIA', backgroundColor: '#fbfbfa',
    // backgroundThrottling: una finestra in secondo piano si vede clampare tutti i
    // timer a un secondo. Chi ascolta un capitolo intanto fa altro, e la lettura
    // andrebbe a scatti: fra un paragrafo e l'altro si aprirebbe un secondo di vuoto.
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true,
      nodeIntegration: false, sandbox: false, backgroundThrottling: false }
  });
  win.loadFile(path.join(__dirname, 'App', 'StudIA.html'));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });
}
app.whenReady().then(() => { createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ---- lettura ad alta voce con la sintesi di sistema (macOS `say`) ----
// Chromium vede solo le voci vecchie; `say` vede anche quelle premium, che
// sono l'unica ragione per cui questo giro dal main process esiste.
const voceLib = require('./lib/voce');
ipcMain.handle('voce:elenco', () => {
  if (!voceLib.disponibile()) return { ok: false, voci: [], italiane: [], migliore: null };
  const voci = voceLib.elenco();
  return { ok: true, voci, italiane: voceLib.italiane(voci), migliore: voceLib.migliore(voci) };
});
/* La lettura passa di qui: ogni blocco viene sintetizzato su file e il
   renderer lo riproduce con un <audio>. Così l'avvio di `say` — che costa
   qualche centinaio di millisecondi, e mai gli stessi — avviene mentre il
   blocco precedente si sta ancora ascoltando, invece che nel silenzio fra i due. */
let voceTmp = null;
function voceCartella() {
  if (!voceTmp || !fs.existsSync(voceTmp)) voceTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'studia-voce-'));
  return voceTmp;
}
function voceScarta() {
  if (!voceTmp) return;
  try { fs.rmSync(voceTmp, { recursive: true, force: true }); } catch (e) {}
  voceTmp = null;
}
ipcMain.handle('voce:rendi', async (e, { segmenti, voce, velocita, chiave } = {}) => {
  if (!voceLib.disponibile()) return { ok: false, errore: 'sintesi di sistema non disponibile' };
  const testo = voceLib.preparaTesto(segmenti, { velocita });
  if (!testo.trim()) return { ok: true, vuoto: true };
  const nome = String(chiave || 'blocco').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120) + '.m4a';
  const file = path.join(voceCartella(), nome);
  // già sintetizzato: stessa voce, stessa velocità, stesso testo
  if (fs.existsSync(file) && fs.statSync(file).size > 0) {
    return { ok: true, url: pathToFileURL(file).href, dallaCache: true };
  }
  const wpm = voceLib.wpmDaVelocita(voceLib.velocitaBlocco(segmenti, velocita));
  const esito = await voceLib.rendi(testo, voce, { wpm, file });
  if (!esito.ok) return { ok: false, errore: esito.errore || 'sintesi fallita' };
  return { ok: true, url: pathToFileURL(file).href };
});
ipcMain.handle('voce:scarta', () => { voceScarta(); return { ok: true }; });
/* Fermare la voce non richiede più di uccidere niente: la riproduzione è un
   <audio> nel renderer, e qui resta solo da buttare i file temporanei. */
app.on('before-quit', voceScarta);
app.on('window-all-closed', voceScarta);

// config sincrona per il preload
ipcMain.on('cfg:get', (e) => { e.returnValue = readCfg(); });

// scelta della cartella del vault
ipcMain.handle('vault:choose', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Scegli la cartella del Vault',
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: 'Usa questa cartella'
  });
  if (r.canceled || !r.filePaths[0]) return null;
  const vault = r.filePaths[0];
  scaffold(vault);
  const c = readCfg(); c.vaultPath = vault; writeCfg(c);
  return vault;
});

// ---- requisiti Python (venv + dipendenze), installati una volta sola ----
const ambiente = require('./lib/ambiente');
/**
 * L'interprete su cui costruire il venv.
 *
 * Non basta il primo `python3` che risponde: lanciata dal Finder l'app trova
 * comunque /usr/bin/python3 (macOS lo fornisce), che però su molte macchine è un
 * 3.9 mentre l'utente ha un 3.13 altrove. Il venv nascerebbe sul vecchio e
 * mlx-whisper si installerebbe peggio o per niente. lib/ambiente.js sceglie il
 * più recente fra i candidati noti; il vecchio comportamento resta come ripiego.
 */
function findSystemPython() {
  try { const p = ambiente.pythonMigliore(); if (p.trovato) return p.percorso; } catch (e) {}
  for (const c of ['python3', 'python']) { try { if (spawnSync(c, ['--version']).status === 0) return c; } catch (e) {} }
  return null;
}
function venvPython() {
  const d = path.join(app.getPath('userData'), 'pyenv');
  return process.platform === 'win32' ? path.join(d, 'Scripts', 'python.exe') : path.join(d, 'bin', 'python');
}
function runStream(cmd, args, send, phaseMsg) {
  return new Promise((resolve, reject) => {
    if (phaseMsg) send('ingest:progress', { phase: 'deps', indeterminate: true, msg: phaseMsg });
    const p = spawn(cmd, args);
    readline.createInterface({ input: p.stdout }).on('line', (l) => send('ingest:log', l));
    readline.createInterface({ input: p.stderr }).on('line', (l) => send('ingest:log', l));
    p.on('error', reject);
    p.on('close', (code) => code === 0 ? resolve() : reject(new Error(cmd + ' exit ' + code)));
  });
}
async function ensureDeps(send) {
  const py = venvPython();
  // su Mac Apple Silicon usiamo mlx-whisper (GPU, ~10-15x più veloce); altrove faster-whisper su CPU
  const wantMlx = process.platform === 'darwin' && process.arch === 'arm64';
  /* pypdfium2 sta qui e non nell'ambiente dell'OCR di proposito: serve a dire
     all'utente che cosa guadagnerebbe installando la lettura avanzata — quante
     pagine e quante ore. Se dipendesse da Chandra, l'unico modo per sapere se
     conviene installarlo sarebbe installarlo. Pesa pochi megabyte. */
  const check = wantMlx ? 'import faster_whisper, pypdf, pypdfium2, mlx_whisper' : 'import faster_whisper, pypdf, pypdfium2';
  try { if (spawnSync(py, ['-c', check]).status === 0) return py; } catch (e) {}
  const sys = findSystemPython();
  if (!sys) throw new Error('Python 3 non trovato sul computer. Installa Python 3 (python.org o "xcode-select --install") e riprova.');
  const venvDir = path.join(app.getPath('userData'), 'pyenv');
  await runStream(sys, ['-m', 'venv', venvDir], send, 'Creo l ambiente Python con ' + sys + ' (una volta sola)...');
  await runStream(py, ['-m', 'pip', 'install', '--upgrade', 'pip'], send, 'Aggiorno pip...');
  try {
    await runStream(py, ['-m', 'pip', 'install', 'faster-whisper', 'pypdf', 'pypdfium2'], send, 'Installo le dipendenze: faster-whisper, pypdf, pypdfium2...');
  } catch (e) {
    // si è scelto l'interprete più recente: se un giorno le wheel per quella
    // versione non ci fossero ancora, l'errore deve dire su quale Python è
    // successo e come imporne un altro, invece di sembrare un baco dell'app
    throw new Error('Le dipendenze non si sono installate con ' + sys + ' (' + (e.message || e) + '). ' +
      'Prova con un altro Python impostando la variabile STUDIA_PYTHON al suo percorso.');
  }
  if (wantMlx) {
    try { await runStream(py, ['-m', 'pip', 'install', 'mlx-whisper'], send, 'Installo il motore veloce su GPU: mlx-whisper...'); }
    catch (e) { send('ingest:log', '@ERR mlx-whisper non installato (' + (e.message || e) + ') — uso faster-whisper su CPU'); }
  }
  return py;
}

// ---- elenco dei media (Media/ + Fonti/) con stato di elaborazione ----
const MEDIA_EXT = ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.mpeg', '.mpg', '.m4a', '.mp3', '.wav', '.aac', '.flac'];
ipcMain.handle('media:list', () => {
  const cfg = readCfg(); if (!cfg.vaultPath) return [];
  const V = cfg.vaultPath;
  const seen = new Map(); // stem -> record (Media elencata prima → vince sul duplicato di Fonti)
  for (const sub of ['Media', 'Fonti']) {
    for (const { nome: f, dir } of mat.elenca(V, sub)) {
      const ext = path.extname(f).toLowerCase();
      if (!MEDIA_EXT.includes(ext)) continue;
      const stem = f.slice(0, f.length - ext.length);
      if (seen.has(stem)) continue;
      let size = 0; try { size = fs.statSync(path.join(dir, f)).size; } catch (e) {}
      const trj = mat.trova(V, 'Trascrizioni', stem + '.json') || path.join(V, 'Trascrizioni', stem + '.json');
      let processed = false, segments = 0;
      try { const st = fs.statSync(trj); if (st.size > 0) { processed = true; try { segments = (JSON.parse(fs.readFileSync(trj, 'utf-8')).segments || []).length; } catch (e) {} } } catch (e) {}
      seen.set(stem, { name: f, dir: sub, size, processed, segments });
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name, 'it'));
});

// ---- avvio ingestion ----
// opts (opzionale): { files: [basename,...] limita a questi media (niente PDF), force: bool rielabora,
//                     lang: codice della lingua parlata nei media ('it', 'en', …, 'auto') }
// La lingua la sceglie il wizard e vive in <vault>/.studia/prefs.json. Chi non la
// dichiara (i due avvii dalla finestra principale) eredita quella salvata: altrimenti
// bastava rilanciare l'elaborazione da fuori dal wizard per tornare all'italiano
// senza vederlo. Italiano solo se non è mai stata scelta.
ipcMain.on('ingest:start', async (e, opts) => {
  const send = (ch, d) => { try { e.sender.send(ch, d); } catch (_) {} };
  const cfg = readCfg();
  if (!cfg.vaultPath) { send('ingest:error', 'Nessun vault scelto.'); return; }
  try {
    const py = await ensureDeps(send);
    const lang = String((opts && opts.lang) || leggiPrefs().lingua || 'it').trim().toLowerCase();
    const args = [path.join(__dirname, 'ingest.py'), '--vault', cfg.vaultPath, '--model', cfg.model || 'medium',
      '--lang', /^[a-z]{2,3}$|^auto$/.test(lang) ? lang : 'it'];
    // senza progetto si elabora tutto il vault: è il ripiego dei vault a corpus unico
    if (opts && opts.progetto) args.push('--progetto', String(opts.progetto));
    if (opts && Array.isArray(opts.files)) for (const f of opts.files) args.push('--only', f);
    if (opts && opts.force) args.push('--force');
    const proc = spawn(py, args);
    let total = 0, idx = 0, sub = 0, fatal = null;
    readline.createInterface({ input: proc.stdout }).on('line', (line) => {
      if (line.startsWith('@TOTAL ')) {
        total = parseInt(line.slice(7)) || 0;
        send('ingest:progress', { phase: 'work', total, index: 0, fraction: 0, msg: total ? ('Trovati ' + total + ' file da elaborare') : 'Niente di nuovo da elaborare' });
      } else if (line.startsWith('@FILE ')) {
        const m = line.split(' '); idx = parseInt(m[1]) || 0; total = parseInt(m[2]) || total; sub = 0;
        send('ingest:progress', { phase: 'work', total, index: idx, fraction: total ? Math.max(0, idx - 1) / total : 0, kind: m[3], name: m.slice(4).join(' ') });
      } else if (line.startsWith('@SUB ')) {
        sub = parseFloat(line.slice(5)) || 0;
        send('ingest:progress', { phase: 'work', total, index: idx, fraction: total ? Math.min(1, (Math.max(0, idx - 1) + sub) / total) : 0 });
      } else if (line.startsWith('@DONE ')) {
        send('ingest:progress', { phase: 'work', total, index: total, fraction: 1 });
      } else if (line.startsWith('@FATAL ')) {
        // errore non recuperabile di ingest.py: va mostrato come errore, non come "completato"
        fatal = line.slice(7).trim();
        send('ingest:error', fatal);
        send('ingest:log', line);
      } else if (line.startsWith('@OK ') || line.startsWith('@ERR ')) {
        send('ingest:log', line);
      } else { send('ingest:log', line); }
    });
    readline.createInterface({ input: proc.stderr }).on('line', (l) => send('ingest:log', l));
    proc.on('error', (err) => send('ingest:error', String(err.message || err)));
    proc.on('close', (code) => send('ingest:done', { code, fatal }));
  } catch (err) { send('ingest:error', String(err.message || err)); }
});

// ============================================================================
// M2 — progetti, brief e importazione materiali
// ============================================================================
const mdser = require('./lib/mdser');
const profiloLib = require('./lib/profilo');
const progettiLib = require('./lib/progetti');

const vaultDir = () => readCfg().vaultPath || null;
const projDir = (id) => path.join(vaultDir(), 'Progetti', id);
const MEDIA_EXTS = ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.mpeg', '.mpg', '.m4a', '.mp3', '.wav', '.aac', '.flac'];

// scrittura atomica: mai lasciare un .md a metà se il processo muore
function writeAtomic(file, text) {
  const tmp = file + '.tmp';
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(tmp, text, 'utf-8');
  fs.renameSync(tmp, file);
}

// ---- profilo (il lettore vero è lib/profilo.js, condiviso con preload) ----
ipcMain.handle('profile:get', () => { const v = vaultDir(); return v ? profiloLib.load(v) : { exists: false, bisogni: [] }; });
ipcMain.handle('profile:skip', () => { const c = readCfg(); c.profiloSaltato = true; writeCfg(c); return true; });
ipcMain.handle('profile:skipped', () => !!readCfg().profiloSaltato);

// ---- progetti ----
ipcMain.handle('project:list', () => {
  const v = vaultDir(); if (!v) return [];
  const root = path.join(v, 'Progetti'); const out = [];
  let dirs; try { dirs = fs.readdirSync(root, { withFileTypes: true }); } catch (e) { return []; }
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    let raw = ''; try { raw = fs.readFileSync(path.join(root, d.name, '_progetto.md'), 'utf-8'); } catch (e) {}
    const fm = profiloLib.parse(raw);
    let piano = null; try { piano = JSON.parse(fs.readFileSync(progettiLib.servizio(v, d.name, '_piano.json'), 'utf-8')); } catch (e) {}
    const corsi = progettiLib.elencoCorsi(v, d.name).length;
    out.push({ id: d.name, title: fm.title || d.name, corsi, protetto: progettiLib.protetto(v, d.name),
      status: piano ? piano.status : null, wizardStep: piano ? piano.wizardStep : null,
      incompleto: !!(piano && ['raccolta', 'ingest', 'proposto', 'approvato', 'in-generazione', 'errore'].includes(piano.status)) });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
});

// ---- pacchetto: un progetto in un file solo, e ritorno ----
// Il caso d'uso è un docente che passa il corso agli allievi: dentro ci va tutto
// quello che serve a leggerlo altrove, niente di ciò che appartiene solo a chi
// l'ha costruito. Vedi lib/pacchetto.js.
const pacchetto = require('./lib/pacchetto');
const espandiLib = require('./lib/espandi');   // far crescere un progetto senza rinumerare niente

function contaFileRicorsivo(dir, salta) {
  let n = 0;
  let voci; try { voci = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return 0; }
  for (const v of voci) {
    if (v.name === '.DS_Store' || (salta || []).includes(v.name)) continue;
    if (v.isDirectory()) n += contaFileRicorsivo(path.join(dir, v.name), salta);
    else n++;
  }
  return n;
}

ipcMain.handle('project:export', async (e, { progetto, appunti } = {}) => {
  const v = vaultDir(); if (!v) return { error: 'nessuna cartella StudIA impostata' };
  if (!progetto) return { error: 'nessun progetto scelto' };
  const radice = path.join(v, 'Progetti');
  if (!fs.existsSync(path.join(radice, progetto, '_progetto.md'))) return { error: 'progetto inesistente' };

  const r = await dialog.showSaveDialog(win, {
    title: 'Esporta il progetto',
    defaultPath: path.join(app.getPath('downloads'), pacchetto.nomeFile(progetto)),
    filters: [{ name: 'Pacchetto StudIA', extensions: ['zip'] }]
  });
  if (r.canceled || !r.filePath) return { annullato: true };

  const salta = [progettiLib.LAVORAZIONE].concat(appunti ? [] : ['APPUNTI']);
  const totale = contaFileRicorsivo(path.join(radice, progetto), salta) || 1;
  const { cmd, args } = pacchetto.comandoEsporta(progetto, r.filePath, { appunti: !!appunti });
  try { fs.unlinkSync(r.filePath); } catch (_) {}          // zip aggiungerebbe a un file esistente

  return await new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd: radice });
    let fatti = 0, ultimo = 0;
    const avanza = (buf) => {
      for (const ln of String(buf).split('\n')) {
        if (!/^\s*(adding|updating):/.test(ln)) continue;
        fatti++;
        const ora = Date.now();
        if (ora - ultimo > 200) {                          // niente raffiche di messaggi al renderer
          ultimo = ora;
          if (win && !win.isDestroyed()) {
            win.webContents.send('project:export:progress', {
              fatti, totale, percento: Math.min(99, Math.round(fatti / totale * 100))
            });
          }
        }
      }
    };
    p.stdout.on('data', avanza);
    let err = '';
    p.stderr.on('data', (d) => { err += String(d); });
    p.on('error', (e2) => resolve({ error: 'zip non disponibile: ' + e2.message }));
    p.on('close', (code) => {
      if (code !== 0 && code !== 12) return resolve({ error: 'esportazione non riuscita' + (err ? ': ' + err.trim() : ' (codice ' + code + ')') });
      let size = 0; try { size = fs.statSync(r.filePath).size; } catch (_) {}
      if (win && !win.isDestroyed()) win.webContents.send('project:export:progress', { fatti: totale, totale, percento: 100 });
      resolve({ file: r.filePath, size, file_count: fatti });
    });
  });
});

/** Elenca il contenuto di un pacchetto senza estrarlo. */
function leggiPacchetto(zip) {
  return new Promise((resolve) => {
    const { cmd, args } = pacchetto.comandoElenca(zip);
    const p = spawn(cmd, args);
    let out = '', err = '';
    p.stdout.on('data', (d) => { out += String(d); });
    p.stderr.on('data', (d) => { err += String(d); });
    p.on('error', (e) => resolve({ ok: false, motivo: 'unzip non disponibile: ' + e.message }));
    p.on('close', () => resolve(out.trim() ? pacchetto.esamina(out.split('\n')) : { ok: false, motivo: err.trim() || 'zip illeggibile' }));
  });
}

ipcMain.handle('project:import', async () => {
  const v = vaultDir(); if (!v) return { error: 'nessuna cartella StudIA impostata' };
  const scelta = await dialog.showOpenDialog(win, {
    title: 'Scegli il pacchetto del progetto',
    properties: ['openFile'],
    filters: [{ name: 'Pacchetto StudIA', extensions: ['zip'] }]
  });
  if (scelta.canceled || !scelta.filePaths[0]) return { annullato: true };
  const zip = scelta.filePaths[0];

  const info = await leggiPacchetto(zip);
  if (!info.ok) return { error: 'Pacchetto non valido: ' + info.motivo };

  const radice = path.join(v, 'Progetti');
  fs.mkdirSync(radice, { recursive: true });
  const idFinale = pacchetto.idLibero(info.id, (x) => fs.existsSync(path.join(radice, x)));

  // si estrae in una cartella di servizio e si sposta solo a estrazione riuscita:
  // un'interruzione a metà non lascia un progetto monco dentro Progetti/
  const tmp = path.join(radice, '.import-' + Date.now());
  const { cmd, args } = pacchetto.comandoEstrai(zip, tmp);
  return await new Promise((resolve) => {
    const p = spawn(cmd, args);
    let err = '';
    p.stderr.on('data', (d) => { err += String(d); });
    p.on('error', (e) => resolve({ error: 'unzip non disponibile: ' + e.message }));
    p.on('close', (code) => {
      const pulisci = () => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {} };
      if (code !== 0) { pulisci(); return resolve({ error: 'estrazione non riuscita' + (err ? ': ' + err.trim() : '') }); }
      try {
        fs.renameSync(path.join(tmp, info.id), path.join(radice, idFinale));
        pulisci();
        // il pacchetto di qualcun altro non deve arrivare già in sola lettura
        try { fs.rmSync(path.join(radice, idFinale, progettiLib.LAVORAZIONE), { recursive: true, force: true }); } catch (_) {}
        resolve({ id: idFinale, rinominato: idFinale !== info.id, contenuto: pacchetto.descrizione(info) });
      } catch (e2) { pulisci(); resolve({ error: e2.message }); }
    });
  });
});

ipcMain.handle('project:create', (e, { nome, brief } = {}) => {
  const v = vaultDir(); if (!v) return { error: 'nessuna cartella StudIA impostata' };
  const id = mdser.slugify(String(nome || '').trim(), 60);
  if (!id || id === 'senza-titolo') return { error: 'dai un nome al progetto' };
  const dir = path.join(v, 'Progetti', id);
  if (fs.existsSync(dir)) return { error: 'esiste già un progetto con questo nome' };
  try {
    fs.mkdirSync(dir, { recursive: true });
    // un progetto nuovo nasce già con la sua cartella dei materiali: è ciò che
    // rende la cartella distribuibile così com'è
    for (const sub of mat.cartelleProgetto()) fs.mkdirSync(path.join(dir, mat.CARTELLA, sub), { recursive: true });
    writeAtomic(path.join(dir, '_progetto.md'), mdser.progetto({
      id, title: String(nome).trim(), brief: brief || {}, indicazioni: (brief && brief.indicazioni) || ''
    }));
    return { id };
  } catch (err) { return { error: err.message }; }
});

// ---- brief: upsert IN-PLACE su _progetto.md (mai ri-serializzare da un parse) ----
ipcMain.handle('brief:get', (e, { progetto } = {}) => {
  const v = vaultDir(); if (!v || !progetto) return {};
  let raw = ''; try { raw = fs.readFileSync(path.join(projDir(progetto), '_progetto.md'), 'utf-8'); } catch (err) { return {}; }
  const fm = profiloLib.parse(raw);
  const sec = /^##\s+Indicazioni per questo materiale\s*$([\s\S]*?)(?=^##\s|\Z)/m.exec(raw);
  return {
    title: fm.title || progetto,
    obiettivo: fm.obiettivo || '', scadenza: fm.scadenza || '',
    priorita: fm.priorita || '', granularita: fm.granularita || '',
    fonti: mappaFonti(fm),
    indicazioni: sec ? sec[1].trim().replace(/^—$/, '') : ''
  };
});

/** Le righe «fonti» del frontmatter come mappa numero → ruolo. */
function mappaFonti(fm) {
  const out = {};
  for (const f of (Array.isArray(fm.fonti) ? fm.fonti : [])) {
    if (f && f.materiale && f.ruolo) out[String(f.materiale)] = String(f.ruolo);
  }
  return out;
}

// il ruolo dichiarato di una fonte: l'unica cosa che il file non sa di sé
ipcMain.handle('fonti:set', (e, { progetto, fonti } = {}) => {
  const v = vaultDir(); if (!v || !progetto) return { error: 'progetto mancante' };
  if (progettiLib.protetto(v, progetto)) return { error: progettiLib.motivoRifiuto(progetto) };
  const file = path.join(projDir(progetto), '_progetto.md');
  let raw; try { raw = fs.readFileSync(file, 'utf-8'); } catch (err) { return { error: '_progetto.md non trovato' }; }
  try {
    writeAtomic(file, mdser.upsertFmLine(raw, 'fonti', mdser.bloccoFonti(fonti || {})));
    return { ok: true };
  } catch (err) { return { error: err.message }; }
});

ipcMain.handle('brief:set', (e, { progetto, brief } = {}) => {
  const v = vaultDir(); if (!v || !progetto) return { error: 'progetto mancante' };
  if (progettiLib.protetto(v, progetto)) return { error: progettiLib.motivoRifiuto(progetto) };
  const file = path.join(projDir(progetto), '_progetto.md');
  let raw; try { raw = fs.readFileSync(file, 'utf-8'); } catch (err) { return { error: '_progetto.md non trovato' }; }
  const b = brief || {};
  try {
    if (b.obiettivo !== undefined) raw = mdser.upsertFmLine(raw, 'obiettivo', 'obiettivo: ' + mdser.yq(b.obiettivo));
    if (b.scadenza !== undefined) raw = mdser.upsertFmLine(raw, 'scadenza', 'scadenza: ' + mdser.yq(b.scadenza));
    if (b.priorita !== undefined) raw = mdser.upsertFmLine(raw, 'priorita', 'priorita: ' + mdser.yq(b.priorita));
    if (b.granularita !== undefined) raw = mdser.upsertFmLine(raw, 'granularita', 'granularita: ' + mdser.yq(b.granularita));
    if (b.fonti !== undefined) raw = mdser.upsertFmLine(raw, 'fonti', mdser.bloccoFonti(b.fonti || {}));
    if (b.indicazioni !== undefined) raw = mdser.upsertSection(raw, 'Indicazioni per questo materiale', mdser.bodyText(b.indicazioni || '—'));
    writeAtomic(file, raw);
    return { ok: true };
  } catch (err) { return { error: err.message }; }
});

// ---- importazione materiali: PDF in Fonti/, media in Media/ ----
ipcMain.handle('files:pick', async () => {
  const r = await dialog.showOpenDialog({
    title: 'Scegli i materiali da importare',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Materiali di studio', extensions: ['pdf', 'mp4', 'mov', 'mkv', 'webm', 'm4a', 'mp3', 'wav'] }]
  });
  return r.canceled ? [] : r.filePaths;
});

ipcMain.handle('files:import', (e, { paths } = {}) => {
  const v = vaultDir(); if (!v) return { error: 'nessuna cartella StudIA impostata' };
  const esiti = [];
  for (const src of (paths || [])) {
    try {
      const ext = path.extname(src).toLowerCase();
      const sub = ext === '.pdf' ? 'Fonti' : (MEDIA_EXTS.includes(ext) ? 'Media' : null);
      if (!sub) { esiti.push({ src, error: 'tipo non supportato (' + ext + ')' }); continue; }
      const dir = path.join(v, sub);
      fs.mkdirSync(dir, { recursive: true });
      let base = path.basename(src), dest = path.join(dir, base), i = 1;
      while (fs.existsSync(dest)) {                       // mai sovrascrivere un materiale esistente
        base = path.basename(src, ext) + ' (' + (++i) + ')' + ext;
        dest = path.join(dir, base);
      }
      fs.copyFileSync(src, dest);
      esiti.push({ src, dest: sub + '/' + base, sub, name: base, size: fs.statSync(dest).size });
    } catch (err) { esiti.push({ src, error: err.message }); }
  }
  return { esiti };
});

// ---- importazione di un'intera cartella preparata dall'utente ----
// Il materiale scaricato sta in sottocartelle a piacere (MEDIA, PDF, HTML, SOTTOTITOLI):
// qui si guarda com'è fatta e si propone dove va ogni cosa, senza copiare niente.
const importaLib = require('./lib/importa');

/** Da quale numero ripartire per non scavalcare i materiali già nel vault. */
/**
 * Il numero da dare al prossimo materiale importato.
 *
 * Si conta DENTRO il progetto: un progetto nuovo parte da 01. Prima si guardava
 * tutto il vault — ogni altro progetto, la radice e i materiali in attesa — e si
 * ripartiva dal massimo. Così un corpus di 24 lezioni si è ritrovato numerato
 * 79–102 perché altrove, in una cartella di lavoro che non era nemmeno un
 * progetto, c'erano 45 file già numerati.
 *
 * Senza `progetto` resta il conteggio globale, che è quello giusto per i vault a
 * corpus unico, dove i numeri non hanno un progetto a cui appartenere.
 */
function prossimoNumero(v, progetto) {
  let max = 0;
  const guarda = (dir) => {
    let files; try { files = fs.readdirSync(dir); } catch (e) { return; }
    for (const f of files) { const n = mat.numero(f); if (n) max = Math.max(max, n); }
  };
  for (const sub of ['Media', 'Fonti']) {
    for (const dir of mat.cartelle(v, sub, progetto, !!progetto)) guarda(dir);
  }
  return max + 1;
}

ipcMain.handle('import:pick', async () => {
  const r = await dialog.showOpenDialog({
    title: 'Scegli la cartella con i materiali',
    properties: ['openDirectory'],
    buttonLabel: 'Esamina questa cartella'
  });
  return r.canceled ? null : r.filePaths[0];
});

// `progetto` decide due cose insieme: da che numero si parte e dove atterrano i
// file. Vanno decise insieme, o si numera per progetto scrivendo nella radice.
ipcMain.handle('import:scan', (e, { cartella, forzati, progetto } = {}) => {
  const v = vaultDir(); if (!v) return { error: 'nessuna cartella StudIA impostata' };
  if (!cartella) return { error: 'nessuna cartella da esaminare' };
  try {
    return importaLib.esamina(cartella, { numeraDa: prossimoNumero(v, progetto), progetto, forzati: forzati || [] });
  } catch (err) { return { error: err.message }; }
});

ipcMain.handle('import:apply', (e, { cartella, forzati, progetto } = {}) => {
  const v = vaultDir(); if (!v) return { error: 'nessuna cartella StudIA impostata' };
  if (!cartella) return { error: 'nessuna cartella da importare' };
  try {
    // si ripianifica al momento della copia: l'anteprima poteva essere vecchia
    const piano = importaLib.esamina(cartella, { numeraDa: prossimoNumero(v, progetto), progetto, forzati: forzati || [] });
    return { ...importaLib.applica(v, piano), riepilogo: piano.riepilogo };
  } catch (err) { return { error: err.message }; }
});

// ---- corpus: materiali (media + PDF) con lo stato di elaborazione ----
// estende media:list ai PDF, che vengono indicizzati in Indice-PDF/ invece che trascritti
// Con `progetto` elenca SOLO i suoi materiali: il pannello «Elaborazione» del
// wizard mostrava tutto il vault, cioè anche i materiali degli altri progetti.
ipcMain.handle('corpus:list', (e, { progetto } = {}) => {
  const v = vaultDir(); if (!v) return [];
  const solo = !!progetto;
  const out = [];
  const stato = (dirStato, stem) => {
    const f = mat.trova(v, dirStato, stem + '.json', progetto, solo);
    try { return !!f && fs.statSync(f).size > 0; } catch (e) { return false; }
  };
  for (const sub of ['Media', 'Fonti']) {
    for (const { nome: f, dir, dentroProgetto } of mat.elenca(v, sub, progetto, solo)) {
      const ext = path.extname(f).toLowerCase();
      const isMedia = MEDIA_EXTS.includes(ext), isPdf = ext === '.pdf', isHtml = (ext === '.html' || ext === '.htm');
      if (!isMedia && !isPdf && !isHtml) continue;
      const tipo = isPdf ? 'pdf' : isHtml ? 'html' : 'media';
      const stem = f.slice(0, f.length - ext.length);
      if (out.some((x) => x.stem === stem && x.tipo === tipo)) continue;
      let size = 0; try { size = fs.statSync(path.join(dir, f)).size; } catch (e) {}
      const m = /^(\d{1,3})\b/.exec(f);
      const dove = { pdf: 'Indice-PDF', html: 'Indice-HTML', media: 'Trascrizioni' }[tipo];
      out.push({
        name: f, stem, dir: sub, size, tipo,
        num: m ? m[1].padStart(2, '0') : null,
        fatto: stato(dove, stem),
        // la trascrizione fornita dall'autore, quando c'è, affianca quella di Whisper
        ufficiale: tipo === 'media' && !!mat.trova(v, 'Trascrizioni', stem + '.ufficiale.txt', progetto, solo),
        // dove sta davvero il file: dentro il progetto o nel corpus del vault
        dentroProgetto: !!dentroProgetto
      });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'it'));
});

// ============================================================================
// M4 — proposta dell'indice dei corsi e approvazione
// ============================================================================
const propose = require('./lib/propose');
const providerAi = require('./lib/ai/provider');
const linguaLib = require('./lib/lingua');

/** Preferenze AI salvate nel vault (provider e modelli scelti in ⚙ › AI). */
function leggiPrefs() {
  const v = vaultDir(); if (!v) return {};
  try { return JSON.parse(fs.readFileSync(path.join(v, '.studia', 'prefs.json'), 'utf-8')); } catch (e) { return {}; }
}

/** Quali fornitori hanno una chiave utilizzabile. */
function chiaviDisponibili() {
  const out = {};
  for (const p of PROVIDERS) out[p] = !!readKey(p);
  // Claude Code non ha una chiave: è «disponibile» se il binario c'è ed è loggato
  try { out.claudecode = require('./lib/ai/claudecode').disponibile(); } catch (e) { out.claudecode = false; }
  return out;
}

/**
 * I modelli realmente disponibili oggi per un fornitore, chiesti alla sua API
 * con la chiave dell'utente. L'elenco viene messo in cache nel vault: al
 * prossimo avvio si riparte da lì senza richiamare l'API.
 */
ipcMain.handle('models:refresh', async (e, { fornitore } = {}) => {
  const f = fornitore || 'anthropic';
  try {
    const r = await require('./lib/ai/modelli').elenca(f, f === 'claudecode' ? null : readKey(f));
    if (r.errore) return { error: r.errore };
    const v = vaultDir();
    if (v) {                                     // cache: l'elenco vale finché non lo si aggiorna
      try {
        const dir = path.join(v, '.studia');
        fs.mkdirSync(dir, { recursive: true });
        const file = path.join(dir, 'modelli.json');
        let tutti = {};
        try { tutti = JSON.parse(fs.readFileSync(file, 'utf-8')); } catch (err) {}
        tutti[f] = { modelli: r.modelli, aggiornato: r.aggiornato };
        writeAtomic(file, JSON.stringify(tutti, null, 1));
      } catch (err) {}
    }
    return r;
  } catch (err) { return { error: String((err && err.message) || err) }; }
});

/** L'elenco in cache, per non richiamare l'API a ogni apertura delle Impostazioni. */
ipcMain.handle('models:cache', (e, { fornitore } = {}) => {
  const v = vaultDir(); if (!v) return null;
  try {
    const tutti = JSON.parse(fs.readFileSync(path.join(v, '.studia', 'modelli.json'), 'utf-8'));
    return tutti[fornitore || 'anthropic'] || null;
  } catch (err) { return null; }
});

/** Dove sta Claude Code e se risponde: serve alle Impostazioni per spiegarsi. */
ipcMain.handle('claudecode:diagnosi', () => {
  try { return require('./lib/ai/claudecode').diagnosi(); }
  catch (e) { return { ok: false, motivo: 'errore', spiegazione: String((e && e.message) || e) }; }
});

// ============================================================================
// Primo avvio: com'è fatta la macchina, e che cosa conviene fare
// ============================================================================

/**
 * Lo stato della macchina più il consiglio che ne deriva.
 *
 * Le chiavi API le passa il main, non le cerca ambiente.js: sono cifrate col
 * Keychain e leggibili solo da qui. Il rilevamento interroga binari e legge
 * cartelle, quindi può prendersi qualche secondo: l'UI lo mostra come attesa.
 */
ipcMain.handle('ambiente:rileva', () => {
  try {
    const stato = ambiente.rileva({
      vaultPath: readCfg().vaultPath || null,
      venvPython: venvPython(),
      userData: app.getPath('userData'),
      chiavi: chiaviDisponibili()
    });
    return { stato, consiglio: ambiente.consiglio(stato) };
  } catch (e) {
    return { error: String((e && e.message) || e) };
  }
});

// ---------------------------------------------------------------------------
// Lettura avanzata dei documenti (Chandra): componente FACOLTATIVO
//
// Vive in un ambiente Python suo (`pyenv-ocr`), separato da quello della
// trascrizione: installarlo non può romperla, e toglierlo è cancellare una
// cartella. Nessuno di questi tre canali fa niente da sé — l'installazione pesa
// più di dieci gigabyte, e una cosa così si chiede.
// ---------------------------------------------------------------------------
const ocrLib = require('./lib/ocr');

ipcMain.handle('ocr:stato', () => {
  try {
    const s = ocrLib.stato(app.getPath('userData'));
    return { stato: s, consiglio: ocrLib.consiglio(s, {
      python: ambiente.pythonMigliore(),
      spazioLiberoGb: ambiente.spazioLiberoGb(app.getPath('userData'))
    }) };
  } catch (e) { return { error: String((e && e.message) || e) }; }
});

/**
 * Che cosa guadagnerebbe questo progetto a farsi rileggere i PDF, PDF per PDF.
 *
 * Gira sull'ambiente della trascrizione, non su quello dell'OCR: la stima deve
 * potersi vedere PRIMA di scaricare undici gigabyte, altrimenti l'unico modo di
 * sapere se conviene installare Chandra sarebbe installarlo.
 */
ipcMain.handle('ocr:stima', (e, { progetto } = {}) => {
  const v = vaultDir(); if (!v || !progetto) return { error: 'progetto mancante' };
  try {
    const file = [];
    for (const dir of mat.cartelle(v, 'Fonti', progetto, true)) {
      let nomi = []; try { nomi = fs.readdirSync(dir); } catch (_) { continue; }
      for (const n of nomi.sort()) if (n.toLowerCase().endsWith('.pdf')) file.push(path.join(dir, n));
    }
    if (!file.length) return { pdf: [], totale: ocrLib.totaleStima([]) };
    const py = venvPython();
    const r = spawnSync(py, [path.join(__dirname, 'ocr.py'), 'scheda'].concat(file),
      { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024, timeout: 180000 });
    if (!r || r.status !== 0) {
      return { error: 'Non riesco a leggere la struttura dei PDF: ' + String((r && r.stderr) || 'errore').slice(0, 200) };
    }
    const schede = JSON.parse(r.stdout);
    const pdf = schede.map((s) => {
      if (s.errore) return { file: s.file, errore: s.errore };
      const sel = ocrLib.selezionaPagine(s);
      return { file: s.file, npagine: sel.npagine, pagine: sel.pagine,
        motivi: sel.motivi, secondi: sel.secondi, riga: ocrLib.rigaStima(sel) };
    });
    return { pdf, totale: ocrLib.totaleStima(pdf.filter((x) => !x.errore && x.pagine)) };
  } catch (err) { return { error: String((err && err.message) || err) }; }
});

/** Esegue i passi in fila, riportando ogni riga: un download lungo senza voce sembra bloccato. */
async function eseguiPassi(passi, send) {
  for (const p of passi) {
    send('ocr:progress', { msg: p.msg });
    await new Promise((risolvi, rifiuta) => {
      // `env` dice dove finiscono i pesi: dentro la cartella dell'app, salvo
      // che non esistano già nel magazzino condiviso del computer
      const pr = spawn(p.cmd, p.args, { env: Object.assign({}, process.env, p.env || {}) });
      readline.createInterface({ input: pr.stdout }).on('line', (l) => send('ocr:log', l));
      readline.createInterface({ input: pr.stderr }).on('line', (l) => send('ocr:log', l));
      pr.on('error', rifiuta);
      pr.on('close', (c) => c === 0 ? risolvi() : rifiuta(new Error(p.cmd + ' è uscito con ' + c)));
    });
  }
}

ipcMain.on('ocr:installa', async (e, { conModello } = {}) => {
  const send = (ch, d) => { try { e.sender.send(ch, d); } catch (_) {} };
  try {
    const ud = app.getPath('userData');
    const sys = findSystemPython();
    if (!sys) { send('ocr:error', 'Python 3 non trovato sul computer: installalo e riprova.'); return; }
    const st = ocrLib.stato(ud);
    const passi = st.installato ? [] : ocrLib.passiInstallazione(sys, ud);
    // il modello si scarica ora se l'utente lo ha chiesto: altrimenti aspetta il primo documento
    if (conModello !== false) {
      passi.push(ocrLib.passoScaricaModello(ud, ocrLib.modelloScaricato(ocrLib.MODELLO, ud)));
    }
    await eseguiPassi(passi, send);
    send('ocr:done', ocrLib.stato(ud));
  } catch (err) {
    send('ocr:error', String((err && err.message) || err));
  }
});

/**
 * Rilegge con Chandra le pagine scelte, un PDF per volta.
 *
 * Non si ferma al primo intoppo: un documento che non si legge non deve buttare
 * via le ore già spese sugli altri. Quello che non è riuscito si dice alla fine,
 * con il nome — un errore riassunto in «alcuni file» non si può indagare.
 */
const ocrFermato = new Set();
ipcMain.on('ocr:ferma', (e, { progetto } = {}) => { if (progetto) ocrFermato.add(progetto); });

ipcMain.on('ocr:leggi', async (e, { progetto, scelte } = {}) => {
  const send = (ch, d) => { try { e.sender.send(ch, d); } catch (_) {} };
  const v = vaultDir();
  if (!v || !progetto) { send('ocr:leggiError', 'progetto mancante'); return; }
  if (progettiLib.protetto(v, progetto)) { send('ocr:leggiError', progettiLib.motivoRifiuto(progetto)); return; }
  const ud = app.getPath('userData');
  if (!ocrLib.stato(ud).installato) { send('ocr:leggiError', 'La lettura avanzata non è installata.'); return; }
  const lista = (scelte || []).filter((s) => s && s.file && (s.pagine || []).length);
  if (!lista.length) { send('ocr:leggiError', 'nessun PDF da rileggere'); return; }

  ocrFermato.delete(progetto);
  const py = ocrLib.python(ud);
  const fatti = [], falliti = [];
  const totPagine = lista.reduce((a, s) => a + s.pagine.length, 0);
  let fattePagine = 0;

  for (const s of lista) {
    if (ocrFermato.has(progetto)) { send('ocr:leggiLog', 'Fermato su richiesta.'); break; }
    const pdf = mat.trova(v, 'Fonti', s.file, progetto, true);
    if (!pdf) { falliti.push({ file: s.file, errore: 'non trovato' }); continue; }
    const stem = s.file.replace(/\.[a-z0-9]+$/i, '');
    // l'indice e i ritagli stanno ACCANTO al materiale, cioè dentro il progetto:
    // altrimenti il progetto spostato altrove avrebbe i PDF senza le sue figure
    const indice = mat.trova(v, 'Indice-PDF', stem + '.json', progetto, true) ||
      path.join(mat.destinazioneDerivato(v, pdf, 'Indice-PDF'), stem + '.json');
    const figure = mat.destinazioneDerivato(v, pdf, 'Figure');
    fs.mkdirSync(path.dirname(indice), { recursive: true });
    fs.mkdirSync(figure, { recursive: true });

    send('ocr:leggiProgress', { file: s.file, pagine: s.pagine.length, fattePagine, totPagine,
      msg: 'Leggo «' + s.file + '»: ' + s.pagine.length + ' pagine' });
    try {
      await new Promise((risolvi, rifiuta) => {
        const pr = spawn(py, [path.join(__dirname, 'ocr.py'), 'leggi', pdf, s.pagine.join(','), indice, figure],
          { env: Object.assign({}, process.env, ocrLib.stato(ud).ambiente) });
        const riga = (l) => {
          if (l.startsWith('@AVANZ ')) {
            let ev = {}; try { ev = JSON.parse(l.slice(7)); } catch (_) {}
            if (ev.fase === 'pagina') {
              send('ocr:leggiProgress', { file: s.file, pagina: ev.pagina,
                fattePagine: fattePagine + (ev.fatte || 0), totPagine,
                msg: '«' + s.file + '» — pagina ' + ev.pagina + ' (' + ((ev.fatte || 0) + 1) + ' di ' + ev.totale + ')' });
            }
            return;
          }
          if (l.startsWith('@FATTO ')) { try { fatti.push(Object.assign({ file: s.file }, JSON.parse(l.slice(7)))); } catch (_) {} return; }
          send('ocr:leggiLog', l);
        };
        readline.createInterface({ input: pr.stdout }).on('line', riga);
        readline.createInterface({ input: pr.stderr }).on('line', (l) => send('ocr:leggiLog', l));
        pr.on('error', rifiuta);
        pr.on('close', (c) => c === 0 ? risolvi() : rifiuta(new Error('uscito con ' + c)));
      });
    } catch (err) {
      falliti.push({ file: s.file, errore: String((err && err.message) || err) });
      send('ocr:leggiLog', '✗ ' + s.file + ' — ' + (err && err.message));
    }
    fattePagine += s.pagine.length;
  }
  send('ocr:leggiDone', { fatti, falliti,
    figure: fatti.reduce((a, x) => a + (x.figure || 0), 0),
    pagine: fatti.reduce((a, x) => a + (x.pagine || 0), 0) });
});

/**
 * Rimuove il componente. Cancella l'ambiente, NON i pesi del modello: quelli
 * stanno nella cache condivisa di Hugging Face e potrebbero servire ad altro
 * sul computer. Chi vuole liberare i dieci gigabyte se li va a prendere, e
 * l'interfaccia gli dice dove sono.
 */
ipcMain.handle('ocr:rimuovi', () => {
  try {
    const ud = app.getPath('userData');
    const piano = ocrLib.daRimuovere(ud, ocrLib.modelloScaricato(ocrLib.MODELLO, ud));
    for (const d of piano.cartelle) fs.rmSync(d, { recursive: true, force: true });
    return { ok: true, tolte: piano.cartelle, modelloRestaIn: piano.restaFuori, modelloGb: piano.gb };
  } catch (e) { return { error: String((e && e.message) || e) }; }
});

/** Se l'onboarding è già stato fatto (o saltato) non si ripresenta all'avvio. */
ipcMain.handle('onboarding:stato', () => {
  const c = readCfg();
  return { fatto: !!c.onboardingFatto, profiloSaltato: !!c.profiloSaltato };
});
ipcMain.handle('onboarding:fatto', (e, { fatto } = {}) => {
  const c = readCfg();
  // il valore si può anche azzerare: in Impostazioni c'è «rifai il primo avvio»
  c.onboardingFatto = fatto === false ? false : true;
  writeCfg(c);
  return { ok: true, fatto: c.onboardingFatto };
});

/** Sceglie fornitore, modello e lingua di scrittura, o null se non c'è nessuna chiave. */
function sceltaAi() {
  const prefs = leggiPrefs();
  const f = providerAi.fornitoreDisponibile(chiaviDisponibili(), prefs.provider);
  if (!f) return null;
  // la lingua viaggia con la scelta del modello: così arriva a tutte le chiamate
  // senza doverla passare a mano in ogni handler (vedi lib/lingua.js)
  return { fornitore: f, modello: providerAi.modelloDi(f, prefs), apiKey: readKey(f),
    lingua: linguaLib.normalizza(prefs.linguaOutput) };
}

ipcMain.handle('plan:get', (e, { progetto } = {}) => {
  const v = vaultDir(); if (!v || !progetto) return null;
  return propose.leggiPiano(v, progetto);
});

ipcMain.handle('plan:save', (e, { progetto, piano } = {}) => {
  const v = vaultDir(); if (!v || !progetto) return { error: 'progetto mancante' };
  if (progettiLib.protetto(v, progetto)) return { error: progettiLib.motivoRifiuto(progetto) };
  return propose.scriviPiano(v, progetto, piano);
});

ipcMain.on('plan:propose', async (e, { progetto, granularita } = {}) => {
  const send = (ch, d) => { try { e.sender.send(ch, d); } catch (_) {} };
  const v = vaultDir();
  if (!v || !progetto) { send('plan:error', 'progetto mancante'); return; }
  if (progettiLib.protetto(v, progetto)) { send('plan:error', progettiLib.motivoRifiuto(progetto)); return; }
  try {
    send('plan:progress', { fase: 'digest', msg: 'Leggo trascrizioni e indici…' });
    const ai = sceltaAi();
    send('plan:progress', {
      fase: ai ? 'ai' : 'euristica',
      msg: ai ? ('Chiedo a ' + ai.fornitore + ' di rivedere il raggruppamento…') : 'Nessuna chiave API: uso le sole euristiche locali…'
    });
    // il brief sta nel frontmatter di _progetto.md: entra nel prompt della proposta
    let briefObj = {};
    try {
      const raw = fs.readFileSync(path.join(projDir(progetto), '_progetto.md'), 'utf-8');
      const fm = profiloLib.parse(raw);
      briefObj = { obiettivo: fm.obiettivo, priorita: fm.priorita, fonti: mappaFonti(fm) };
    } catch (err) {}
    // se le schede esistono si passa dalla pipeline multiagente: è la via buona.
    // Senza schede resta la vecchia proposta (euristiche + eventuale revisione singola).
    /* Il gate va misurato sul corpus che finirà DAVVERO nel piano, non su tutto
       ciò che sta sul disco: altrimenti confronta le schede con un totale che
       comprende materiali non elaborati e pagine web congelate, e la soglia
       dell'80% diventa un confronto fra due numeri che si muovono insieme —
       sempre soddisfatto, anche con mezzo corpus fuori. */
    const dgOra = propose.corpusDelPiano(v, progetto).dg;
    const schedePresenti = Object.keys(schedeLib.tutte(v, progetto, dgOra.materiali)).length;
    let r;
    if (ai && schedePresenti >= Math.max(1, Math.floor(dgOra.totale * 0.8))) {
      send('plan:progress', { fase: 'multiagente', msg: 'Tre analisi indipendenti sulle ' + schedePresenti + ' schede…' });
      r = await propose.proponiMultiagente(v, progetto, {
        granularita: granularita || 'atomico', brief: briefObj, profilo: profiloLib.load(v),
        ai: { fornitore: ai.fornitore, modello: ai.modello, apiKey: ai.apiKey, lingua: ai.lingua },
        onProgress: (ev) => send('plan:progress', {
          fase: ev.fase,
          msg: ev.fase === 'lente' ? ('Analisi «' + ev.etichetta + '»: ' + ev.stato)
             : (ev.fase === 'sintesi' ? 'Sintesi dell\'architettura…' : 'Revisione critica dell\'architettura…')
        })
      });
      if (r.errore) { send('plan:error', r.errore); return; }
      if (r.uso) registraUso(Object.assign({ fornitore: ai.fornitore, modello: ai.modello }, r.uso), progetto, 'architettura multiagente');
    } else {
      r = await propose.proponi(v, progetto, {
        granularita: granularita || 'atomico',
        brief: briefObj,
        profilo: profiloLib.load(v),
        fornitore: ai && ai.fornitore, modello: ai && ai.modello, apiKey: ai && ai.apiKey, lingua: ai && ai.lingua
      });
      if (ai && schedePresenti < dgOra.totale) {
        r.avviso = (r.avviso ? r.avviso + ' ' : '') + 'Analisi dei materiali incompleta (' + schedePresenti + '/' + dgOra.totale + '): per un indice di qualità piena, analizza prima tutti i materiali.';
      }
    }
    const scritto = propose.scriviPiano(v, progetto, r.piano);
    if (scritto.error) { send('plan:error', scritto.error); return; }
    if (r.uso) {
      // il costo della proposta va nel registro come qualunque altra chiamata
      try {
        fs.mkdirSync(path.join(v, 'Costi'), { recursive: true });
        fs.appendFileSync(path.join(v, 'Costi', 'usage.jsonl'), JSON.stringify({
          ts: new Date().toISOString(), provider: r.uso.fornitore, model: r.uso.modello,
          inputTokens: r.uso.inputTokens || 0, outputTokens: r.uso.outputTokens || 0,
          costUsd: 0, courseId: progetto, label: 'proposta indice'
        }) + '\n');
      } catch (err) {}
    }
    send('plan:done', { piano: r.piano, origine: r.origine, avviso: r.avviso || null, revisione: r.revisione || null, giri: r.giri || 1 });
  } catch (err) {
    send('plan:error', String((err && err.message) || err));
  }
});

/** Crea le cartelle-corso e i _corso.md, e aggiorna ordine_corsi nel progetto. */
ipcMain.handle('plan:approve', (e, { progetto } = {}) => {
  const v = vaultDir(); if (!v || !progetto) return { error: 'progetto mancante' };
  if (progettiLib.protetto(v, progetto)) return { error: progettiLib.motivoRifiuto(progetto) };
  const piano = propose.leggiPiano(v, progetto);
  if (!piano || !Array.isArray(piano.corsi) || !piano.corsi.length) return { error: 'nessun piano da approvare' };

  /* Ultima rete prima che il piano diventi cartelle sul disco: il corpus si
     rilegge ADESSO e si controlla che nessun materiale utilizzabile sia rimasto
     fuori. Il piano può essere nato ore prima, su un corpus a metà — è
     esattamente così che sono nati 156 rimandi ai video e zero ai PDF: i PDF
     furono indicizzati dopo la proposta, e nulla lo disse. Restano fuori senza
     protestare i materiali non ancora elaborati e le pagine web congelate:
     quelli l'utente li vede nell'avviso della proposta. */
  const delPiano = propose.corpusDelPiano(v, progetto).dg;
  const nelPiano = new Set();
  for (const c of piano.corsi) for (const m of (c.materiali || [])) if (m.num) nelPiano.add(String(m.num).padStart(2, '0'));
  const fuori = delPiano.materiali.filter((m) => m.num && !nelPiano.has(String(m.num).padStart(2, '0')));
  if (fuori.length) {
    return { error: 'Il piano lascia fuori ' + fuori.length + ' materiali già elaborati (' +
      fuori.map((m) => m.num).join(', ') + '). Rifai la proposta dell\'indice prima di approvare.' };
  }

  const creati = [];
  try {
    for (const c of piano.corsi) {
      const dir = path.join(progettiLib.cartellaCorsiPerScrivere(v, progetto), c.folder);
      fs.mkdirSync(dir, { recursive: true });
      writeAtomic(path.join(dir, '_corso.md'), mdser.corso({
        id: c.folder, title: c.title, area: c.area || '',
        materiali: (c.materiali || []).map((m) => m.num || m.source),
        status: 'approvato', ordineCapitoli: (c.capitoli || []).map((k) => k.file),
        nota: c.rationale || ''
      }));
      creati.push(c.folder);
      c.status = 'approvato';
    }
    // ordine_corsi nel progetto, upsert in-place per non perdere il resto del frontmatter
    const fileProg = path.join(projDir(progetto), '_progetto.md');
    let raw = fs.readFileSync(fileProg, 'utf-8');
    raw = mdser.upsertFmLine(raw, 'ordine_corsi', 'ordine_corsi: ' + mdser.yList(creati));
    raw = mdser.upsertFmLine(raw, 'n_corsi', 'n_corsi: ' + creati.length);
    writeAtomic(fileProg, raw);

    piano.status = 'approvato'; piano.wizardStep = 4; piano.aggiornato = new Date().toISOString();
    const scritto = propose.scriviPiano(v, progetto, piano);
    if (scritto.error) return { error: scritto.error };
    return { ok: true, creati };
  } catch (err) { return { error: err.message }; }
});

// ============================================================================
// Analisi multiagente: schede per materiale + architettura dei corsi
// ============================================================================
const schedeLib = require('./lib/schede');

/** Registra il consumo di una fase nel registro costi. */
function registraUso(uso, progetto, etichetta) {
  const v = vaultDir(); if (!v || !uso) return;
  try {
    fs.mkdirSync(path.join(v, 'Costi'), { recursive: true });
    fs.appendFileSync(path.join(v, 'Costi', 'usage.jsonl'), JSON.stringify({
      ts: new Date().toISOString(), provider: uso.fornitore || '?', model: uso.modello || '?',
      inputTokens: uso.inputTokens || 0, outputTokens: uso.outputTokens || 0,
      // Claude Code dichiara già il costo a listino: quello vince sul nostro calcolo
      costUsd: (typeof uso.costoUsdDichiarato === 'number' ? uso.costoUsdDichiarato : providerAi.costoUsd(uso)) || 0,
      courseId: progetto, label: etichetta
    }) + '\n');
  } catch (e) {}
}

/** Stato delle schede di un progetto: quante ci sono e quante mancano. */
ipcMain.handle('schede:stato', (e, { progetto } = {}) => {
  const v = vaultDir(); if (!v || !progetto) return { totale: 0, fatte: 0, mancanti: [] };
  /* Il conteggio deve chiudere: se il totale comprende materiali che l'analisi
     non tocca — non elaborati, o congelati — «24 su 37» non arriva mai a 37 e
     l'utente rifà l'analisi all'infinito cercando le tredici che mancano. */
  const filtrato = corpusLib().perIlPiano(corpusLib().digest(v, progetto));
  const dg = filtrato.dg;
  const mappa = schedeLib.tutte(v, progetto, dg.materiali);
  const fatti = new Set(Object.keys(mappa));
  return {
    totale: dg.totale,
    fatte: fatti.size,
    mancanti: dg.materiali.filter((m) => !fatti.has(m.num || m.nome)).map((m) => ({ num: m.num, titolo: m.titolo, tipo: m.tipo })),
    fuori: filtrato.congelati.concat(filtrato.senzaIndice).map((m) => ({ num: m.num, titolo: m.titolo, tipo: m.tipo, motivo: m.indicizzato === false ? 'non elaborato' : 'tipo sospeso' }))
  };
});
function corpusLib() { return require('./lib/corpus'); }

// ============================================================================
// M5 — scalette alternative e generazione dei capitoli
// ============================================================================
const scalettaLib = require('./lib/scaletta');
const generaLib = require('./lib/genera');

/** Le regole di forma del profilo, per la fase chiesta. */
function regoleForma(fase, progetto) {
  const v = vaultDir(); if (!v) return '';
  try {
    const p = profiloLib.load(v);
    let indicazioni = '';
    if (progetto) {
      const raw = fs.readFileSync(path.join(projDir(progetto), '_progetto.md'), 'utf-8');
      const sec = /^##\s+Indicazioni per questo materiale\s*$([\s\S]*?)(?=^##\s|\Z)/m.exec(raw);
      indicazioni = sec ? sec[1].trim().replace(/^—$/, '') : '';
    }
    return profiloLib.promptBlock(p, fase, indicazioni);
  } catch (err) { return ''; }
}

// le alternative di scaletta per UN corso del piano
ipcMain.handle('scaletta:proponi', async (e, { progetto, folder, nCapitoli } = {}) => {
  const v = vaultDir(); if (!v || !progetto) return { error: 'progetto mancante' };
  if (progettiLib.protetto(v, progetto)) return { error: progettiLib.motivoRifiuto(progetto) };
  const ai = sceltaAi();
  if (!ai) return { error: 'Serve una chiave API: le scalette nascono dalla lettura delle schede.' };
  const piano = propose.leggiPiano(v, progetto);
  const corso = piano && (piano.corsi || []).find((c) => c.folder === folder);
  if (!corso) return { error: 'corso non trovato nel piano' };
  try {
    const dg = corpusLib().digest(v, progetto);
    const schedeMappa = schedeLib.tutte(v, progetto, dg.materiali);
    if (!Object.keys(schedeMappa).length) return { error: 'Mancano le schede: fai prima il passo «Analisi».' };
    const r = await scalettaLib.proponi(corso, schedeMappa,
      { fornitore: ai.fornitore, modello: ai.modello, apiKey: ai.apiKey, lingua: ai.lingua },
      { regoleForma: regoleForma('proposta', progetto), nCapitoli: nCapitoli });
    if (r.uso) registraUso(Object.assign({ fornitore: ai.fornitore, modello: ai.modello }, r.uso), progetto, 'scalette ' + folder);
    if (r.errore) return { error: r.errore };
    // in cache: le alternative sono un intermedio pagato, e il composer le rilegge invece di ricomprarle
    try { percorsiLib.scriviScaletta(v, progetto, folder, r.alternative, nCapitoli); } catch (err) {}
    return { alternative: r.alternative };
  } catch (err) { return { error: String((err && err.message) || err) }; }
});

// ============================================================================
// Composer degli indici: le scalette di TUTTI i corsi, e i percorsi che ne nascono
// ============================================================================
const percorsiLib = require('./lib/percorsi');

/** Quello che il composer trova già in casa: piano, scalette in cache, percorsi salvati. */
ipcMain.handle('composer:stato', (e, { progetto } = {}) => {
  const v = vaultDir(); if (!v || !progetto) return { error: 'progetto mancante' };
  const piano = propose.leggiPiano(v, progetto);
  const corsi = ((piano && piano.corsi) || []).map((c) => ({
    folder: c.folder, title: c.title, materiali: (c.materiali || []).length
  }));
  return {
    corsi,
    scalette: percorsiLib.leggiScalette(v, progetto),
    percorsi: percorsiLib.leggiTutti(v, progetto),
    personaggi: percorsiLib.PERSONAGGI,
    protetto: progettiLib.protetto(v, progetto)
  };
});

/**
 * Chiede le scalette di più corsi in fila, mandando avanzamento per ognuno.
 *
 * Un corso per volta e non tutti insieme: sono chiamate lunghe, e con la
 * concorrenza un 429 del fornitore ne farebbe cadere quattro invece di una.
 * `solo` limita ai corsi indicati (il «rifai» di una riga sola); senza `rifai`
 * i corsi che hanno già una scaletta in cache si saltano, così riaprire il
 * composer dopo un errore non ricompra quello che c'è già.
 */
ipcMain.on('scalette:tutte', async (e, { progetto, nCapitoli, solo, rifai } = {}) => {
  const send = (ch, d) => { try { e.sender.send(ch, d); } catch (_) {} };
  const v = vaultDir();
  if (!v || !progetto) { send('scalette:error', 'progetto mancante'); return; }
  if (progettiLib.protetto(v, progetto)) { send('scalette:error', progettiLib.motivoRifiuto(progetto)); return; }
  const ai = sceltaAi();
  if (!ai) { send('scalette:error', 'Serve una chiave API: le scalette nascono dalla lettura delle schede.'); return; }
  const piano = propose.leggiPiano(v, progetto);
  const tutti = (piano && piano.corsi) || [];
  if (!tutti.length) { send('scalette:error', 'nessun corso nel piano'); return; }
  const cache = percorsiLib.leggiScalette(v, progetto);
  const lista = tutti.filter((c) => (!solo || !solo.length || solo.indexOf(c.folder) >= 0))
                     .filter((c) => rifai || !(cache[c.folder] && (cache[c.folder].alternative || []).length));
  if (!lista.length) { send('scalette:done', { fatti: 0, errori: [] }); return; }
  try {
    const dg = corpusLib().digest(v, progetto);
    const schedeMappa = schedeLib.tutte(v, progetto, dg.materiali);
    if (!Object.keys(schedeMappa).length) { send('scalette:error', 'Mancano le schede: fai prima il passo «Analisi».'); return; }
    const regole = regoleForma('proposta', progetto);
    const errori = [];
    let fatti = 0;
    for (let i = 0; i < lista.length; i++) {
      const corso = lista[i];
      send('scalette:progress', { folder: corso.folder, titolo: corso.title, indice: i + 1, totale: lista.length, stato: 'in corso' });
      let r;
      try {
        r = await scalettaLib.proponi(corso, schedeMappa,
          { fornitore: ai.fornitore, modello: ai.modello, apiKey: ai.apiKey, lingua: ai.lingua },
          { regoleForma: regole, nCapitoli: nCapitoli });
      } catch (err) { r = { errore: String((err && err.message) || err) }; }
      if (r.uso) registraUso(Object.assign({ fornitore: ai.fornitore, modello: ai.modello }, r.uso), progetto, 'scalette ' + corso.folder);
      if (r.errore || !(r.alternative || []).length) {
        errori.push({ folder: corso.folder, errore: r.errore || 'nessuna scaletta utilizzabile' });
        send('scalette:progress', { folder: corso.folder, titolo: corso.title, indice: i + 1, totale: lista.length, stato: 'errore: ' + (r.errore || 'niente di utilizzabile') });
        continue;
      }
      percorsiLib.scriviScaletta(v, progetto, corso.folder, r.alternative, nCapitoli);
      fatti++;
      send('scalette:progress', {
        folder: corso.folder, titolo: corso.title, indice: i + 1, totale: lista.length,
        stato: r.alternative.length + ' indici', alternative: r.alternative
      });
    }
    send('scalette:done', { fatti, errori });
  } catch (err) { send('scalette:error', String((err && err.message) || err)); }
});

ipcMain.handle('percorsi:list', (e, { progetto } = {}) => {
  const v = vaultDir(); if (!v || !progetto) return [];
  return percorsiLib.leggiTutti(v, progetto);
});

/** Lo stato intero del composer: i percorsi mandati si salvano, quelli spariti si cancellano. */
ipcMain.handle('percorsi:save', (e, { progetto, percorsi } = {}) => {
  const v = vaultDir(); if (!v || !progetto) return { error: 'progetto mancante' };
  if (progettiLib.protetto(v, progetto)) return { error: progettiLib.motivoRifiuto(progetto) };
  try {
    // la cartella della coppia si calcola qui, dove le scalette ci sono, e resta
    // scritta nel percorso: il lettore la legge senza dover conoscere le scalette
    const conCartelle = percorsiLib.conCartelle(percorsi || [], percorsiLib.leggiScalette(v, progetto));
    return { ok: true, percorsi: percorsiLib.salvaTutti(v, progetto, conCartelle) };
  } catch (err) { return { error: String((err && err.message) || err) }; }
});

/** I file .md di capitolo dentro una cartella-corso (la logica sta in lib/, coperta dai test). */
function capitoliSulDisco(v, progetto, cartella) { return percorsiLib.capitoliSulDisco(v, progetto, cartella); }

/**
 * Le coppie corso+indice da scrivere, con quanto è già stato scritto e quanto costa il resto.
 * È ciò che il composer mostra prima di far spendere: quante cartelle, quanti
 * capitoli, e quali indici sono condivisi fra più percorsi.
 */
ipcMain.handle('percorsi:coppie', (e, { progetto } = {}) => {
  const v = vaultDir(); if (!v || !progetto) return { error: 'progetto mancante' };
  const piano = propose.leggiPiano(v, progetto);
  const perCorso = {};
  for (const c of ((piano && piano.corsi) || [])) perCorso[c.folder] = c;
  const coppie = percorsiLib.coppieDaScrivere(
    percorsiLib.leggiTutti(v, progetto), percorsiLib.leggiScalette(v, progetto)
  ).map((k) => {
    const scritti = capitoliSulDisco(v, progetto, k.cartella).length;
    return Object.assign({}, k, {
      capitoli: k.capitoli.length,
      titoloCorso: (perCorso[k.folder] && perCorso[k.folder].title) || k.folder,
      scritti,
      stato: !scritti ? 'da scrivere' : (scritti >= k.capitoli.length ? 'scritti' : 'parziale')
    });
  });
  const ai = sceltaAi();
  const daFare = coppie.filter((k) => k.stato !== 'scritti').reduce((s, k) => s + k.capitoli, 0);
  return {
    coppie,
    fornitore: ai && ai.fornitore, modello: ai && ai.modello,
    // stessa misura empirica di gen:stima: ~9k token in ingresso, ~1,6k in uscita per capitolo
    costoUsd: providerAi.stimaCosto({ modello: ai && ai.modello, input: daFare * 9000, output: daFare * 1600 })
  };
});

/**
 * Scrive i capitoli delle coppie corso+indice.
 *
 * Una cartella per coppia, `03-delega--per-domande`, col suo `_corso.md`. Le
 * coppie già scritte si saltano se non si chiede `riscrivi`: è la stessa regola
 * delle scalette — quello che è già stato pagato non si ricompra da solo.
 *
 * Riscrivendo, i capitoli vecchi della cartella si cancellano PRIMA: la
 * cartella appartiene per intero alla coppia, e lasciarli lì significherebbe
 * ritrovarsi due versioni dello stesso capitolo con numeri uguali e slug
 * diversi, senza modo di sapere quale sia quella buona.
 */
ipcMain.on('percorsi:capitoli', async (ev, { progetto, cartelle, riscrivi } = {}) => {
  const send = (ch, d) => { try { ev.sender.send(ch, d); } catch (_) {} };
  const v = vaultDir();
  if (!v || !progetto) { send('percorsi:cap:error', 'progetto mancante'); return; }
  if (progettiLib.protetto(v, progetto)) { send('percorsi:cap:error', progettiLib.motivoRifiuto(progetto)); return; }
  const ai = sceltaAi();
  if (!ai) { send('percorsi:cap:error', 'Serve una chiave API per scrivere i capitoli.'); return; }
  const piano = propose.leggiPiano(v, progetto);
  const perCorso = {};
  for (const c of ((piano && piano.corsi) || [])) perCorso[c.folder] = c;

  const tutte = percorsiLib.coppieDaScrivere(
    percorsiLib.leggiTutti(v, progetto), percorsiLib.leggiScalette(v, progetto));
  const lista = tutte
    .filter((k) => !cartelle || !cartelle.length || cartelle.indexOf(k.cartella) >= 0)
    .filter((k) => riscrivi || !capitoliSulDisco(v, progetto, k.cartella).length)
    .filter((k) => perCorso[k.folder] && k.capitoli.length);
  if (!lista.length) { send('percorsi:cap:done', { fatte: 0, scritti: 0, scarti: 0, saltate: tutte.length }); return; }

  genFermato.delete(progetto);
  let scritti = 0, scarti = 0, fatte = 0;
  try {
    for (let i = 0; i < lista.length; i++) {
      if (genFermato.has(progetto)) { send('percorsi:cap:log', 'Fermato su richiesta.'); break; }
      const k = lista[i];
      const corso = perCorso[k.folder];
      send('percorsi:cap:progress', { fase: 'corso', cartella: k.cartella, titoloCorso: corso.title,
        nome: k.nome, coppia: i + 1, coppie: lista.length, indice: 0, totale: k.capitoli.length });
      percorsiLib.preparaCartella(v, progetto, corso, k, { riscrivi: !!riscrivi });
      const r = await scriviCapitoli({
        v, progetto, corso, cartella: k.cartella, capitoli: k.capitoli, accoda: false, ai,
        onProgress: (d) => send('percorsi:cap:progress', Object.assign({ fase: 'capitolo', cartella: k.cartella,
          titoloCorso: corso.title, nome: k.nome, coppia: i + 1, coppie: lista.length }, d)),
        onLog: (l) => send('percorsi:cap:log', k.cartella + ' · ' + l)
      });
      scritti += r.scritti.length; scarti += r.scarti.length; fatte++;
      if (r.fermato) break;
    }
    send('percorsi:cap:done', { fatte, scritti, scarti, saltate: tutte.length - lista.length });
  } catch (err) { send('percorsi:cap:error', String((err && err.message) || err)); }
});


/**
 * Espansione: che cosa c'è di nuovo da mettere in un progetto già finito.
 * Ritorna i materiali che nessun corso dichiara di usare, i corsi esistenti
 * (per scegliere quale estendere) e i rimandi [[NN-slug]] che puntano nel vuoto.
 */
ipcMain.handle('expand:stato', (e, { progetto } = {}) => {
  const v = vaultDir(); if (!v || !progetto) return { error: 'progetto mancante' };
  if (!fs.existsSync(path.join(projDir(progetto), '_progetto.md'))) return { error: 'progetto inesistente' };
  const cartelle = progettiLib.elencoCorsi(v, progetto);

  const corsi = cartelle.map((folder) => {
    const cdir = progettiLib.corsoDir(v, progetto, folder);
    let raw = ''; try { raw = fs.readFileSync(path.join(cdir, '_corso.md'), 'utf-8'); } catch (_) {}
    const fm = profiloLib.parse(raw);
    let files = []; try { files = fs.readdirSync(cdir); } catch (_) {}
    const capitoli = espandiLib.capitoliDi(files);
    return {
      folder, titolo: fm.title || folder,
      materiali: (fm.materiali || []).map((n) => parseInt(n, 10)).filter(Number.isFinite),
      capitoli: capitoli.length, prossimoOrdine: espandiLib.prossimoOrdine(files)
    };
  });

  // rimandi verso corsi che non esistono: su un progetto che cresce è l'errore
  // che non si vede finché un allievo non ci clicca sopra
  const capitoliTesto = [];
  for (const folder of cartelle) {
    const cdir = progettiLib.corsoDir(v, progetto, folder);
    let files = []; try { files = fs.readdirSync(cdir); } catch (_) {}
    for (const f of espandiLib.capitoliDi(files)) {
      try { capitoliTesto.push({ file: folder + '/' + f, contenuto: fs.readFileSync(path.join(cdir, f), 'utf-8') }); } catch (_) {}
    }
  }
  const rotti = espandiLib.wikilinkRotti(capitoliTesto, cartelle);

  let materiali = [];
  try { materiali = corpusLib().digest(v, progetto).materiali; } catch (_) {}
  const nuovi = espandiLib.materialiNuovi(materiali, corsi);

  return {
    corsi, prossimoCorso: espandiLib.prossimoCorso(cartelle),
    nuovi: nuovi.map((m) => ({ num: m.num, nome: m.nome, tipo: m.tipo, titolo: m.titolo })),
    nonElaborati: contaNonElaborati(v),
    rimandiRotti: rotti
  };
});

/** Le cartelle-corso di un progetto: servono a validare i rimandi [[NN-slug]]. */
function corsiDelProgetto(progetto) {
  const v = vaultDir(); if (!v) return [];
  return progettiLib.elencoCorsi(v, progetto);
}

/** Materiali presenti ma senza trascrizione/indice: sono quelli da elaborare. */
function contaNonElaborati(v) {
  let n = 0;
  for (const sub of ['Media', 'Fonti']) {
    for (const { nome } of mat.elenca(v, sub)) {
      const ext = path.extname(nome).toLowerCase();
      const stem = nome.slice(0, nome.length - ext.length);
      const dove = ext === '.pdf' ? 'Indice-PDF' : (ext === '.html' || ext === '.htm') ? 'Indice-HTML' : 'Trascrizioni';
      if (!MEDIA_EXTS.includes(ext) && ext !== '.pdf' && ext !== '.html' && ext !== '.htm') continue;
      if (!mat.trova(v, dove, stem + '.json')) n++;
    }
  }
  return n;
}

/** Quanto costerà, prima di spendere: il conto si fa sui capitoli, non a occhio. */
ipcMain.handle('gen:stima', (e, { progetto, folder, capitoli } = {}) => {
  const v = vaultDir(); if (!v) return { error: 'nessuna cartella StudIA' };
  const ai = sceltaAi();
  const n = (capitoli || []).length;
  // misura empirica: ~9k token in ingresso (materiale ritagliato + regole) e ~1,6k in uscita
  const costoUsd = providerAi.stimaCosto({ modello: ai && ai.modello, input: n * 9000, output: n * 1600 });
  return { capitoli: n, fornitore: ai && ai.fornitore, modello: ai && ai.modello, costoUsd };
});

// generazione: un capitolo per volta, si può fermare fra l'uno e l'altro
const genFermato = new Set();
ipcMain.on('gen:cancel', (e, { progetto } = {}) => { if (progetto) genFermato.add(progetto); });

/**
 * Scrive i capitoli di un corso dentro `cartella`.
 *
 * `cartella` non è sempre `corso.folder`: per le varianti di percorso è
 * `03-delega--per-domande`, cioè una coppia corso+indice. Il corso da cui si
 * legge (materiali, titolo, razionale) resta lo stesso — cambia solo dove
 * atterrano i file. Il resto — ordine, riparazione, quarantena, aggiornamento
 * di `_corso.md` — è identico, e sta qui in un punto solo perché due copie
 * della stessa procedura divergono sempre.
 */
async function scriviCapitoli({ v, progetto, corso, cartella, capitoli, accoda, ai, onProgress, onLog }) {
  const log = onLog || (() => {});
  const avanti = onProgress || (() => {});
  // espansione: i capitoli nuovi si aggiungono in coda, con i numeri successivi.
  // Rinumerare quelli già scritti spezzerebbe i rimandi [[NN-slug]] degli altri corsi.
  const dirCorso = progettiLib.corsoDir(v, progetto, cartella);
  let filePresenti = []; try { filePresenti = fs.readdirSync(dirCorso); } catch (_) {}
  const daOrdine = accoda ? espandiLib.prossimoOrdine(filePresenti) : 1;
  const regole = regoleForma('generazione', progetto);
  const materiali = corpusLib().digest(v, progetto).materiali;
  const scritti = [], scarti = [];
  let uso = null, fermato = false;
  for (let i = 0; i < capitoli.length; i++) {
    if (genFermato.has(progetto)) { fermato = true; log('Fermato su richiesta dopo ' + scritti.length + ' capitoli.'); break; }
    const cap = capitoli[i];
    const ordine = daOrdine + i;
    avanti({ indice: i + 1, totale: capitoli.length, titolo: cap.titolo, frazione: i / capitoli.length, ordine });
    const g = await generaLib.generaCapitolo(v, corso, cap, ordine, daOrdine + capitoli.length - 1, materiali,
      { fornitore: ai.fornitore, modello: ai.modello, apiKey: ai.apiKey, lingua: ai.lingua },
      { regoleForma: regole,
        progetto,                                 // il testo delle fonti si cerca solo dentro questo progetto
        corsi: corsiDelProgetto(progetto),        // i rimandi devono puntare a corsi che esistono
        precedente: i > 0 ? capitoli[i - 1].titolo : '',
        successivo: i + 1 < capitoli.length ? capitoli[i + 1].titolo : '' });
    uso = generaLib.sommaUso(uso, g.uso);
    if (g.errori.length || !g.dati) {
      const nome = g.dati ? generaLib.scriviScarto(v, progetto, cartella, ordine, g.dati, g.errori) : '(nessuna risposta)';
      scarti.push({ ordine, titolo: cap.titolo, errori: g.errori, scarto: nome });
      log('✗ ' + cap.titolo + ' — ' + g.errori.join('; '));
      continue;                                   // un capitolo storto non ferma gli altri
    }
    // «fonte» nel frontmatter dice da quale materiale nasce il capitolo, col suo tipo vero
    const prima = cap.fonti && cap.fonti[0];
    const mPrima = prima && materiali.find((m) => m.num === prima.materiale);
    const w = generaLib.scriviCapitolo(v, progetto, cartella, ordine, g.dati,
      { fonte: mPrima ? { tipo: mPrima.tipo, materiale: mPrima.num } : null });
    scritti.push({ ordine, titolo: g.dati.title, file: w.file });
    log('✓ ' + g.dati.title);
  }
  if (uso) registraUso(Object.assign({ fornitore: ai.fornitore, modello: ai.modello }, uso), progetto, 'capitoli ' + cartella);
  // l'ordine dei capitoli nel _corso.md riflette ciò che è stato davvero scritto
  try {
    const fileCorso = path.join(dirCorso, '_corso.md');
    let raw = fs.readFileSync(fileCorso, 'utf-8');
    // accodando, l'ordine dichiarato dall'autore resta e i nuovi vanno in fondo
    // «prima» = i capitoli che c'erano quando la generazione è partita (il
    // frontmatter li tiene come testo, la cartella è la fonte affidabile)
    const prima = accoda ? espandiLib.capitoliDi(filePresenti) : [];
    const ordineFinale = espandiLib.ordineAggiornato(prima, scritti.map((x) => x.file));
    raw = mdser.upsertFmLine(raw, 'ordine_capitoli', 'ordine_capitoli: ' + mdser.yList(ordineFinale));
    raw = mdser.upsertFmLine(raw, 'status', 'status: ' + mdser.yq(scarti.length ? 'parziale' : 'generato'));
    writeAtomic(fileCorso, raw);
  } catch (err) {}
  return { scritti, scarti, uso, fermato };
}

ipcMain.on('gen:start', async (e, { progetto, folder, capitoli, accoda } = {}) => {
  const send = (ch, d) => { try { e.sender.send(ch, d); } catch (_) {} };
  const v = vaultDir();
  if (!v || !progetto) { send('gen:error', 'progetto mancante'); return; }
  if (progettiLib.protetto(v, progetto)) { send('gen:error', progettiLib.motivoRifiuto(progetto)); return; }
  const ai = sceltaAi();
  if (!ai) { send('gen:error', 'Serve una chiave API per scrivere i capitoli.'); return; }
  const piano = propose.leggiPiano(v, progetto);
  const corso = piano && (piano.corsi || []).find((c) => c.folder === folder);
  if (!corso) { send('gen:error', 'corso non trovato nel piano'); return; }
  const lista = capitoli || [];
  if (!lista.length) { send('gen:error', 'nessun capitolo da scrivere'); return; }

  genFermato.delete(progetto);
  try {
    const { scritti, scarti, uso } = await scriviCapitoli({
      v, progetto, corso, cartella: folder, capitoli: lista, accoda, ai,
      onProgress: (d) => send('gen:progress', d),
      onLog: (l) => send('gen:log', l)
    });
    const cc = (piano.corsi || []).find((c) => c.folder === folder);
    if (cc) {
      /* Nel piano un capitolo si scrive {file, title}: la generazione lo produce
         come {ordine, titolo, file}. Passandolo così com'era, `scriviPiano`
         falliva la validazione e restituiva un errore che nessuno guardava —
         quindi il piano NON veniva mai aggiornato, il corso restava
         «approvato» e nell'elenco non compariva mai la spunta di «già fatto».
         Un errore silenzioso che si vedeva solo come una casella mancante. */
      cc.status = scarti.length ? 'parziale' : 'generato';
      const nuovi = scritti.map((x) => ({
        file: x.file, title: String(x.titolo || '').slice(0, 120), status: 'generato'
      }));
      cc.capitoli = (accoda ? (cc.capitoli || []) : []).concat(nuovi);
      const w = propose.scriviPiano(v, progetto, piano);
      if (w && w.error) send('gen:log', '⚠ stato del corso non salvato nel piano: ' + w.error);
    }
    send('gen:done', { scritti, scarti, uso });
  } catch (err) { send('gen:error', String((err && err.message) || err)); }
});

ipcMain.on('schede:build', async (e, { progetto, rifai } = {}) => {
  const send = (ch, d) => { try { e.sender.send(ch, d); } catch (_) {} };
  const v = vaultDir();
  if (!v || !progetto) { send('schede:error', 'progetto mancante'); return; }
  if (progettiLib.protetto(v, progetto)) { send('schede:error', progettiLib.motivoRifiuto(progetto)); return; }
  const ai = sceltaAi();
  if (!ai) { send('schede:error', 'Serve una chiave API: l\'analisi dei materiali legge i contenuti con il modello.'); return; }
  try {
    /* Si analizza solo ciò che potrà entrare in un piano: una scheda si paga, e
       pagarla per un materiale che il piano non può accogliere è denaro speso
       per niente. Ciò che resta fuori viene detto, non taciuto. */
    const grezzo = corpusLib().digest(v, progetto);
    const filtrato = corpusLib().perIlPiano(grezzo);
    const dg = filtrato.dg;
    if (!dg.totale) { send('schede:error', 'Nessun materiale elaborato: fai prima trascrizione e indicizzazione.'); return; }
    const escluso = corpusLib().avvisoEsclusi(filtrato.congelati, filtrato.senzaIndice);
    // il ruolo dichiarato viaggia col materiale: chi legge deve sapere se ha
    // davanti la dispensa ufficiale o gli appunti presi a lezione
    let ruoli = {};
    try { ruoli = mappaFonti(profiloLib.parse(fs.readFileSync(path.join(projDir(progetto), '_progetto.md'), 'utf-8'))); } catch (err) {}
    const materiali = dg.materiali.map((m) => (ruoli[m.num] ? Object.assign({}, m, { ruolo: ruoli[m.num] }) : m));
    send('schede:progress', { fase: 'avvio', totale: dg.totale,
      msg: 'Leggo ' + dg.totale + ' materiali con ' + ai.fornitore + '…' + (escluso ? ' ' + escluso : '') });
    const esiti = await schedeLib.analizzaTutti(v, progetto, materiali, {
      concorrenza: 3, rifai: !!rifai,
      ai: { fornitore: ai.fornitore, modello: ai.modello, apiKey: ai.apiKey, lingua: ai.lingua },
      onProgress: (ev) => send('schede:progress', ev)
    });
    registraUso(Object.assign({ fornitore: ai.fornitore, modello: ai.modello }, esiti.uso), progetto, 'analisi materiali');
    send('schede:done', esiti);
  } catch (err) {
    send('schede:error', String((err && err.message) || err));
  }
});
