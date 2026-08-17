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
const mat = require('./lib/materiali');   // i materiali possono vivere dentro il corso
// Un vault nuovo nasce con le sole cartelle che servono: i materiali di un
// corso vivono dentro il corso (vedi lib/materiali.js), «Lezioni/» era il
// formato JSON di prima e non si crea più.
const scaffold = (v) => { for (const d of [corsiLib.RADICE, mat.ATTESA, '.studia']) { try { fs.mkdirSync(path.join(v, d), { recursive: true }); } catch (e) {} } };

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
    costUsd: Number(entry.costUsd) || 0, lessonId: entry.lessonId || '', label: entry.label || ''
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
    // senza corso si elabora tutto il vault: è il ripiego dei vault a corpus unico
    if (opts && opts.corso) args.push('--corso', String(opts.corso));
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
// M2 — corsi, brief e importazione materiali
// ============================================================================
const mdser = require('./lib/mdser');
const profiloLib = require('./lib/profilo');
const corsiLib = require('./lib/corsi');

const vaultDir = () => readCfg().vaultPath || null;
const courseDir = (id) => corsiLib.cartella(vaultDir(), id);
/* Il file che descrive il corso. Passa da lib/corsi perché in un vault mai
   migrato si chiama ancora `_progetto.md`: leggerlo col nome nuovo darebbe un
   corso senza titolo invece di un errore, ed è il modo peggiore di sbagliare. */
const fileCorsoDi = (id) => corsiLib.fileCorso(vaultDir(), id);
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

// ---- corsi ----
ipcMain.handle('course:list', () => {
  const v = vaultDir(); if (!v) return [];
  const root = corsiLib.radice(v); const out = [];
  let dirs; try { dirs = fs.readdirSync(root, { withFileTypes: true }); } catch (e) { return []; }
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    let raw = ''; try { raw = fs.readFileSync(corsiLib.fileCorso(v, d.name), 'utf-8'); } catch (e) {}
    const fm = profiloLib.parse(raw);
    let piano = null; try { piano = JSON.parse(fs.readFileSync(corsiLib.servizio(v, d.name, '_piano.json'), 'utf-8')); } catch (e) {}
    /* ⚠️ Le LEZIONI, non le cartelle. Un corso con varianti ne ha due per
       lezione — il segnaposto e la variante scritta — e questo numero diceva 14
       per un corso di 7. Il danno però non è il numero: `projDaFinire` chiede
       `lezioni===0` per dire «nessuna lezione ancora scritta», e con le sole
       cartelle-segnaposto il conto era 7 mentre da leggere non c'era una riga.
       L'app dichiarava finito un corso vuoto. */
    const lezioni = percorsiLib.nomiRaggiungibili(corsiLib.elencoLezioni(v, d.name).map((folder) => {
      let files = []; try { files = fs.readdirSync(corsiLib.lezioneDir(v, d.name, folder)); } catch (_) {}
      return { folder, capitoli: espandiLib.capitoliDi(files).length };
    })).length;
    out.push({ id: d.name, title: fm.title || d.name, lezioni, protetto: corsiLib.protetto(v, d.name),
      status: piano ? piano.status : null, wizardStep: piano ? piano.wizardStep : null,
      incompleto: !!(piano && ['raccolta', 'ingest', 'proposto', 'approvato', 'in-generazione', 'errore'].includes(piano.status)) });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
});

/* ---- zaini: la seconda modalità, e perché qui ci sono solo due righe ----
 *
 * Uno zaino è un contenitore di documenti propri: niente pipeline, niente
 * lezioni, niente stato di lavorazione. Tutto quello che serve al main è
 * elencarli e crearne uno — appunti, mappe, album ed evidenze arrivano dai loro
 * canali di sempre, che passano da `corsi.cartella()` e trovano lo zaino da
 * soli (vedi la nota su quella funzione in lib/corsi.js).
 *
 * ⚠️ `zaino:create` NON è `course:create` con un'altra cartella: il controllo di
 * unicità è sulle DUE radici, ed è dentro `zaini.crea()`. Duplicarlo qui
 * vorrebbe dire due regole che invecchiano separate.
 */
const zainiLib = require('./lib/zaini');
ipcMain.handle('zaino:list', () => zainiLib.elenco(vaultDir()));
/* Eliminare uno zaino: la cartella intera nel Cestino di sistema, mai `rm`.
   È il gesto più grosso dell'app — dentro ci sono anche appunti e mappe — e
   la conferma con i conti la fa il renderer, che li sa dire. */
ipcMain.handle('zaino:elimina', (e, { id } = {}) =>
  zainiLib.elimina(vaultDir(), id, { cestina: (p) => shell.trashItem(p) }));
ipcMain.handle('zaino:create', (e, { nome } = {}) =>
  zainiLib.crea(vaultDir(), nome, new Date().toISOString().slice(0, 10)));
/* Rinominare uno zaino cambia il titolo E la cartella: il perché sta in
   `lib/zaini.js`. Qui non c'è logica — nemmeno la guardia sull'unicità, che è
   la stessa della creazione e vive in un posto solo. */
ipcMain.handle('zaino:rinomina', (e, { id, nome } = {}) => zainiLib.rinomina(vaultDir(), id, nome));

/* ---- il segno di lettura: a che pagina si era arrivati ----
 * Vale per i corsi come per gli zaini: `lib/lettura.js` passa da
 * `corsi.cartella()` e trova da sé il contenitore giusto. */
const letturaLib = require('./lib/lettura');
ipcMain.handle('lettura:leggi', (e, { corso } = {}) => letturaLib.leggi(vaultDir(), corso));
ipcMain.handle('lettura:segna', (e, { corso, file, pagina } = {}) =>
  letturaLib.segna(vaultDir(), corso, file, pagina));

/* ---- il segno di ascolto: a che secondo si era arrivati ----
 * Il gemello del segno di lettura, per ciò che scorre nel tempo. Due canali e
 * non uno solo con un campo in più: una pagina e un secondo si somigliano da
 * lontano, e un canale che chiede «pagina o secondo?» a ogni chiamata è la
 * prima riga di un ramo che si biforca ovunque. */
const ascoltoLib = require('./lib/ascolto');
ipcMain.handle('ascolto:leggi', (e, { corso } = {}) => ascoltoLib.leggi(vaultDir(), corso));
ipcMain.handle('ascolto:segna', (e, { corso, file, secondo } = {}) =>
  ascoltoLib.segna(vaultDir(), corso, file, secondo));

/* ---- i media di un contenitore: video e audio che entrano ----
 * ⚠️ Qui non si trascrive niente. Un video importato è un video che si guarda e
 * si cita al secondo: la trascrizione costa minuti di macchina, è un derivato,
 * e chi la vuole la chiede alla pipeline dei corsi. Lo zaino resta il posto in
 * cui scrive solo l'utente. */
const mediaLib = require('./lib/media');
ipcMain.handle('media:importa', (e, { corso, percorsi } = {}) =>
  mediaLib.importa(vaultDir(), corso, percorsi));
ipcMain.handle('media:elenco', (e, { corso } = {}) => mediaLib.elenco(vaultDir(), corso));
/* Togliere un media dallo zaino: `shell.trashItem` e non `unlink`, per la
   stessa ragione dei documenti — è un file dell'UTENTE, e l'irreversibile non
   può essere un click. Il conto di chi ci si appoggia lo fa `media.usi`. */
ipcMain.handle('media:elimina', (e, { corso, file } = {}) =>
  mediaLib.elimina(vaultDir(), corso, file, { cestina: (p) => shell.trashItem(p) }));
ipcMain.handle('media:usi', (e, { corso, file } = {}) => mediaLib.usi(vaultDir(), corso, file));

/* ---- le fonti di un contenitore: import e indici ----
 * ⚠️ L'indice per pagina lo costruisce il RENDERER con pdf.js — il
 * visualizzatore è già nell'app, e così un documento entra senza Python e senza
 * modelli. Qui si scrive soltanto, e si dichiara chi ha letto (`motore`). */
const fontiLib = require('./lib/fonti');
const ripassoLib = require('./lib/ripasso');
ipcMain.handle('fonti:importa', (e, { corso, percorsi } = {}) =>
  fontiLib.importa(vaultDir(), corso, percorsi));
/**
 * Togliere un documento dallo zaino.
 *
 * ⚠️ `shell.trashItem` e non `unlink`: questo è un file dell'UTENTE, portato
 * dentro da lui, e l'unico gesto irreversibile dell'app non può essere un
 * click. Nel Cestino ci resta finché lo decide lui.
 *
 * Il resto — la traccia che permetterà il riaggancio, l'indice che va via col
 * documento — lo fa `lib/fonti.js`, che non sa niente di Electron.
 */
/* ===== Il ripasso: la storia di che cosa hai già risposto (P3.1) ===========
   ⚠️ Cartella dell'UTENTE, come APPUNTI/ e MAPPE/: la pipeline non la tocca, e
   un corso rigenerato non porta via niente. Il canale è corto di proposito —
   leggi tutto, scrivi tutto — perché lo stato di un corso sono poche decine di
   voci e un protocollo più fine avrebbe due modi di sbagliare invece di uno. */
ipcMain.handle('ripasso:leggi', (e, { corso } = {}) => ripassoLib.leggi(vaultDir(), corso));
/* Scrive tutto lo stato in un colpo: lo usa «azzera avanzamento», che è l'unico
   gesto che tocca la storia intera di un corso. */
ipcMain.handle('ripasso:salva', (e, { corso, carte } = {}) => ripassoLib.salva(vaultDir(), corso, carte || {}));
/**
 * Registra una risposta. ⚠️ L'IDENTITÀ DELLA CARTA SI CALCOLA QUI, non nel
 * renderer: è un hash del capitolo più il testo della domanda, e il renderer non
 * ha `crypto`. Farlo di là vorrebbe dire scrivere una seconda volta la stessa
 * formula — e due formule per la stessa identità divergono al primo ritocco,
 * lasciando la storia di ripasso attaccata a carte che nessuno ritrova più.
 */
ipcMain.handle('ripasso:registra', (e, { corso, capitolo, domanda, esito, quando } = {}) => {
  const letto = ripassoLib.leggi(vaultDir(), corso);
  if (letto.error) return { error: letto.error };
  const id = ripassoLib.identita(capitolo, domanda);
  const carte = ripassoLib.registra(letto.carte, id, esito, { capitolo, quando });
  const scritto = ripassoLib.salva(vaultDir(), corso, carte);
  return scritto.error ? { error: scritto.error } : { error: '', id, carte };
});
/**
 * Gli id di un elenco di carte vive — e basta: non tocca il disco.
 *
 * ⚠️ Serve alla vista di ripasso (P3.3), che deve appaiare le domande che ci
 * sono ADESSO nel corso con la storia scritta su disco, e non può calcolare
 * l'identità da sé: nel renderer non c'è `crypto`. Stessa ragione di
 * `ripasso:registra` — la formula dell'identità sta in un posto solo.
 */
ipcMain.handle('ripasso:ids', (e, { vive } = {}) =>
  ({ ids: (vive || []).map((v) => ripassoLib.identita(v && v.capitolo, v && v.domanda)) }));
/**
 * Toglie lo stato delle carte che non esistono più, e dice quante ne ha tolte.
 * Si chiama all'apertura di un corso: è lì che si scopre che una rigenerazione
 * ha riscritto un quiz. `vive` è l'elenco `{capitolo, domanda}` delle carte che
 * ci sono adesso — gli id li calcola sempre questo lato.
 */
ipcMain.handle('ripasso:pota', (e, { corso, vive } = {}) => {
  const letto = ripassoLib.leggi(vaultDir(), corso);
  if (letto.error) return { error: letto.error, tolte: 0 };
  const ids = (vive || []).map((v) => ripassoLib.identita(v && v.capitolo, v && v.domanda));
  const p = ripassoLib.pota(letto.carte, ids);
  if (!p.tolte.length) return { error: '', tolte: 0, carte: letto.carte };
  const scritto = ripassoLib.salva(vaultDir(), corso, p.carte);
  return scritto.error ? { error: scritto.error, tolte: 0 } : { error: '', tolte: p.tolte.length, carte: p.carte };
});

ipcMain.handle('fonti:elimina', (e, { corso, file } = {}) =>
  fontiLib.elimina(vaultDir(), corso, file, { cestina: (p) => shell.trashItem(p) }));
ipcMain.handle('fonti:rimossi', (e, { corso } = {}) => fontiLib.rimossi(vaultDir(), corso));
ipcMain.handle('fonti:usi', (e, { corso, file } = {}) => fontiLib.usi(vaultDir(), corso, file));
ipcMain.handle('fonti:dimentica', (e, { corso, impronta } = {}) =>
  fontiLib.dimentica(vaultDir(), corso, impronta));
ipcMain.handle('fonti:indiceScrivi', (e, { corso, file, pagine, motore } = {}) => {
  const r = fontiLib.scriviIndice(vaultDir(), corso, file, pagine, motore);
  /* Il verdetto «sembra una scansione» viaggia con l'esito della scrittura: è
     il momento in cui il renderer ha appena indicizzato un documento nuovo ed
     è l'unico in cui ha senso proporre il riconoscimento del testo. La soglia
     sta in lib/ocr, il renderer riceve solo il conto. */
  if (r && !r.error) Object.assign(r, ocrLib.eScansione(pagine));
  return r;
});
ipcMain.handle('fonti:indiceServe', (e, { corso, file } = {}) =>
  ({ serve: !fontiLib.haIndice(vaultDir(), corso, file) }));
ipcMain.handle('fonti:indici', (e, { corso } = {}) => fontiLib.leggiIndici(vaultDir(), corso));

/* ---- il testo dentro le fotografie: riconoscimento e layer ----
 * Il renderer rasterizza (pdf.js e il canvas stanno da lui) e qui si riconosce
 * e si scrive: tesseract.js e pdf-lib vivono nel main perché servono `fs` e la
 * sostituzione atomica del file. Vedi lib/ocrpdf.js per le tre scelte di fondo. */
const ocrpdfLib = require('./lib/ocrpdf');
ipcMain.handle('ocrpdf:apri', () =>
  ocrpdfLib.apri(path.join(__dirname, 'App', 'assets', 'tesseract'),
    path.join(app.getPath('userData'), 'tesseract-cache')));
ipcMain.handle('ocrpdf:pagina', async (e, { png, larghezzaPx, altezzaPx } = {}) => {
  const r = await ocrpdfLib.riconosci(Buffer.from(png || []));
  /* Il verdetto «questa pagina va riletta raddrizzata» si dà QUI, con le
     soglie di lib/ocrpdf: il renderer ha il canvas, non i numeri. Riceve anche
     i radianti da passare a `ctx.rotate`, così là non si fa geometria. */
  if (!r.error) r.raddrizza = ocrpdfLib.pianoRaddrizzamento(r.angoloPagina, larghezzaPx, altezzaPx);
  return r;
});
ipcMain.handle('ocrpdf:chiudi', () => ocrpdfLib.chiudi());
ipcMain.handle('ocrpdf:applica', async (e, { corso, file, pagine } = {}) => {
  if (!vaultDir()) return { error: 'nessuna cartella vault impostata' };
  const nome = path.basename(String(file || ''));
  if (!nome || !/\.pdf$/i.test(nome)) return { error: 'documento non valido' };
  const percorso = path.join(fontiLib.dirPdf(vaultDir(), corso), nome);
  const r = await ocrpdfLib.scriviLayer(percorso, pagine);
  if (r.error) return r;
  /* L'indice ricorda subito CHI ha riconosciuto e l'impronta di prima: la
     reindicizzazione che il renderer farà tra un attimo riscrive le pagine ma
     conserva questo campo (vedi scriviIndice). Senza l'impronta, ritrascinare
     l'originale creerebbe il doppione.
     ⚠️ Il JSON si legge GREZZO e non con leggiIndici, che filtra via le pagine
     senza testo: riscritte da lì, un indice di quindici pagine fotografate ne
     dichiarerebbe zero fino alla reindicizzazione. */
  let vecchio = {};
  try { vecchio = JSON.parse(fs.readFileSync(fontiLib.percorsoIndice(vaultDir(), corso, nome), 'utf-8')) || {}; }
  catch (e2) { /* indice non ancora scritto: il campo entra con la reindicizzazione */ }
  /* ⚠️ `ocr.pagine` è la MEMORIA di quali pagine hanno già il layer, e si
     ACCUMULA fra una corsa e l'altra («ferma» + ripresa). Non può derivarla
     nessuno dal testo: una pagina fotografata con tre righe resta sotto la
     soglia delle scansioni anche DOPO il riconoscimento, e senza questo elenco
     la ripresa la rileggerebbe scrivendole addosso un secondo layer — ogni
     parola doppia nella ricerca e nelle evidenze.
     E `improntaOriginale` resta quella della PRIMA corsa: l'originale in casa
     dell'utente è il file di prima di tutti i layer. */
  const prevOcr = (vecchio.ocr && typeof vecchio.ocr === 'object') ? vecchio.ocr : null;
  const fatteOra = (Array.isArray(pagine) ? pagine : []).map((p) => Math.trunc(+(p && p.n))).filter((n) => n > 0);
  const fatte = Array.from(new Set((prevOcr && Array.isArray(prevOcr.pagine) ? prevOcr.pagine : []).concat(fatteOra)))
    .sort((a, b) => a - b);
  fontiLib.scriviIndice(vaultDir(), corso, nome,
    Array.isArray(vecchio.pages) ? vecchio.pages : [], vecchio.motore || 'pdfjs',
    { motore: 'tesseract.js', quando: new Date().toISOString(),
      improntaOriginale: (prevOcr && prevOcr.improntaOriginale) || r.improntaPrima,
      pagine: fatte });
  return r;
});

/* ── ATLANTE DELLE OPZIONI ─────────────────────────────────────────────────
 * La pagina che spiega il profilo di apprendimento: per ogni menu, la direttiva
 * che finisce nel prompt e un esempio del suo effetto.
 *
 * ⚠️ La direttiva NON viaggia scritta a mano da nessuna parte: si compone qui
 * chiedendola a `profilo.directives()`, cioè alla stessa funzione che riempie i
 * prompt veri. Una spiegazione ricopiata diverge al primo ritocco, e una pagina
 * che dichiara una regola che il modello non riceve è peggio del silenzio.
 * Il catalogo delle leve è un modulo UMD (invariante 5): lo stesso file serve a
 * questa composizione e alle prove. */
const leveLib = require('./App/assets/dati/leve.js');

ipcMain.handle('profilo:atlante', () => {
  const out = { leve: [], esempi: {}, brano: null, avviso: '' };
  try { out.leve = leveLib.atlante(profiloLib.directives); }
  catch (err) { return { errore: 'Le leve del profilo non si sono potute leggere: ' + err.message, leve: [] }; }
  try {
    const raw = fs.readFileSync(path.join(__dirname, 'App', 'assets', 'dati', 'atlante-esempi.json'), 'utf8');
    const e = JSON.parse(raw);
    out.esempi = e.esempi || {}; out.brano = e.brano || null; out.avviso = e.avviso || '';
  } catch (err) {
    // invariante 4: gli esempi mancanti si dichiarano, la griglia resta utile
    out.avvisoEsempi = 'Gli esempi non si sono potuti leggere: ' + err.message;
  }
  /* La scelta ATTUALE dell'utente, per marcare la sua colonna: l'Atlante non è
     un manuale astratto, è la spiegazione di ciò che ha scelto lui. */
  try {
    const v = vaultDir();
    const p = v ? profiloLib.load(v) : null;
    if (p) {
      out.scelte = {};
      for (const l of leveLib.LEVE) {
        if (l.tipo === 'bisogno') {
          const suoi = Array.isArray(p.bisogni) ? p.bisogni : [];
          out.scelte[l.chiave] = l.varianti.map((x) => x.valore).filter((x) => suoi.includes(x))[0] || '';
        } else {
          const val = p[l.campo];
          out.scelte[l.chiave] = (val === true || val === false) ? String(val) : (val || '');
        }
      }
    }
  } catch (err) { /* senza vault l'Atlante si legge lo stesso: è una spiegazione, non uno stato */ }
  return out;
});

/* ── CREDITI E LICENZE ─────────────────────────────────────────────────────
 * L'inventario sta su disco (App/assets/dati/crediti.json, generato da
 * `npm run crediti`) e non in una costante nel renderer: era una costante, ed
 * era ferma a quindici voci mentre i pacchetti spediti erano novantacinque —
 * la trappola ④ applicata a una schermata che ha valore legale.
 * Qui si legge, si esporta il NOTICE.txt e si apre l'elenco di Chromium. */
const creditiLib = require('./lib/crediti');

/** L'elenco Chromium (14 MB) non entra nel JSON: lo si spedisce come risorsa
 *  accanto all'app (build.extraResources) e in sviluppo si legge da node_modules. */
function chromiumLicenses() {
  const candidati = [
    path.join(process.resourcesPath || '', 'LICENSES.chromium.html'),
    path.join(__dirname, 'node_modules', 'electron', 'dist', 'LICENSES.chromium.html')
  ];
  return candidati.find((p) => p && fs.existsSync(p)) || '';
}

ipcMain.handle('crediti:leggi', () => {
  const dati = creditiLib.leggi(path.join(__dirname, 'App', 'assets', 'dati', 'crediti.json'));
  dati.chromium = !!chromiumLicenses();
  return dati;
});

ipcMain.handle('crediti:chromium', async () => {
  const p = chromiumLicenses();
  if (!p) return { error: 'L\'elenco dei componenti di Chromium non è stato trovato accanto all\'app.' };
  const err = await shell.openPath(p);
  return err ? { error: err } : { ok: true };
});

ipcMain.handle('crediti:notice', async (e, { percorso } = {}) => {
  const dati = creditiLib.leggi(path.join(__dirname, 'App', 'assets', 'dati', 'crediti.json'));
  if (dati.errore) return { error: dati.errore };
  let dest = percorso || '';
  if (!dest) {
    const r = await dialog.showSaveDialog(win, {
      title: 'Esporta crediti e licenze',
      defaultPath: path.join(app.getPath('downloads'), 'StudIA-NOTICE.txt'),
      filters: [{ name: 'Testo', extensions: ['txt'] }]
    });
    if (r.canceled || !r.filePath) return { annullato: true };
    dest = r.filePath;
  }
  try { fs.writeFileSync(dest, creditiLib.notice(dati), 'utf8'); }
  catch (err) { return { error: err.message }; }
  return { ok: true, percorso: dest };
});

// ---- pacchetto: un corso in un file solo, e ritorno ----
// Il caso d'uso è un docente che passa il corso agli allievi: dentro ci va tutto
// quello che serve a leggerlo altrove, niente di ciò che appartiene solo a chi
// l'ha costruito. Vedi lib/pacchetto.js.
const pacchetto = require('./lib/pacchetto');
const espandiLib = require('./lib/espandi');   // far crescere un corso senza rinumerare niente

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

/* ── SALVA COME PDF ────────────────────────────────────────────────────────
 * Il renderer manda il documento GIÀ IMPAGINATO — il foglio di stampa col suo
 * CSS e le sue regole `@page` — e qui si stampa in una finestra invisibile.
 *
 * ⚠️ Perché non basta `window.print()`, che c'era già. Il dialogo di Chromium
 * stampa **senza «grafica di sfondo»** finché non la si accende a mano: i fondi
 * dei riquadri degli appunti — che sono il codice-colore dei callout —
 * spariscono, e nessuno lo dice. Qui `printBackground` è acceso una volta per
 * tutte, e `preferCSSPageSize` lascia decidere il nostro `@page` invece del
 * formato di fabbrica (che è Letter: misurato).
 *
 * ⚠️ Il documento si scrive in un FILE temporaneo e si carica con `loadFile`,
 * non come `data:` URL: una pagina `data:` ha un'origine opaca e il browser le
 * nega i sotto-file `file://` — cioè il nostro CSS, i font e le icone. Con un
 * file vero il `<base href>` che il renderer ci mette dentro risolve tutto.
 *
 * `percorso` salta il dialogo: serve alle prove, che non possono premere
 * «Salva» in una finestra di sistema.
 */
ipcMain.handle('stampa:pdf', async (e, { html, nome, landscape, percorso } = {}) => {
  if (!html || typeof html !== 'string') return { error: 'niente da stampare' };
  let dest = percorso || '';
  if (!dest) {
    const r = await dialog.showSaveDialog(win, {
      title: 'Salva come PDF',
      defaultPath: path.join(app.getPath('downloads'), (nome || 'StudIA') + '.pdf'),
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });
    if (r.canceled || !r.filePath) return { annullato: true };
    dest = r.filePath;
  }
  const tmp = path.join(os.tmpdir(), 'studia-stampa-' + Date.now() + '.html');
  let finestra = null;
  try {
    fs.writeFileSync(tmp, html, 'utf8');
    finestra = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
    });
    await finestra.loadFile(tmp);
    /* I font PRIMA della stampa, e non un tempo a caso: senza, il foglio esce
       col carattere di ripiego e le misure cambiano. Tetto a 4s — meglio un
       ripiego che restare appesi. */
    await finestra.webContents.executeJavaScript(
      'Promise.race([document.fonts?document.fonts.ready:Promise.resolve(),' +
      'new Promise(function(r){setTimeout(r,4000);})]).then(function(){return true;})'
    ).catch(() => { });
    await new Promise((r) => setTimeout(r, 200));   // assestamento delle immagini inline
    const pdf = await finestra.webContents.printToPDF({
      printBackground: true, preferCSSPageSize: true, landscape: !!landscape
    });
    fs.writeFileSync(dest, pdf);
    return { ok: true, percorso: dest };
  } catch (err) {
    return { error: err.message || String(err) };
  } finally {
    if (finestra) { try { finestra.destroy(); } catch (_) { } }
    try { fs.unlinkSync(tmp); } catch (_) { }
  }
});

/* ---- la guida illustrata dello ZAINO, in una finestra sua ----------------
 * ⚠️ La finestra è SENZA `preload`: la guida è una pagina statica, e darle il
 * ponte verso il vault vorrebbe dire che una pagina di documentazione può
 * scrivere sui file dell'utente. Non le serve, e ciò che non serve non si dà.
 * ⚠️ Una sola finestra: il bottone si preme più volte (è dentro Impostazioni,
 * e Impostazioni si riapre), e senza questa memoria si accumulerebbero copie
 * identiche una sopra l'altra. Se c'è già, si porta davanti. */
let guidaWin = null;
ipcMain.handle('guida:apri', async () => {
  const file = path.join(__dirname, 'App', 'guida-zaino', 'index.html');
  if (!fs.existsSync(file)) return { error: 'la guida non è installata con questa copia dell’app' };
  if (guidaWin && !guidaWin.isDestroyed()) { guidaWin.show(); guidaWin.focus(); return { ok: true }; }
  guidaWin = new BrowserWindow({
    width: 1180, height: 900, title: 'Guida allo ZAINO',
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
  });
  /* I link http della guida vanno nel browser di sistema, come nella finestra
     principale: una finestra di documentazione non è un browser. */
  guidaWin.webContents.setWindowOpenHandler(({ url: u }) => {
    if (/^https?:/i.test(u)) { shell.openExternal(u); return { action: 'deny' }; }
    return { action: 'allow' };
  });
  guidaWin.on('closed', () => { guidaWin = null; });
  await guidaWin.loadFile(file);
  return { ok: true };
});

/* Mostra nel Finder ciò che si è appena salvato: si accetta SOLO un file che
   esiste, e si passa da `showItemInFolder`, che apre la cartella senza aprire
   il file — un PDF che si apre da solo è una finestra che nessuno ha chiesto. */
ipcMain.handle('stampa:mostra', async (e, { percorso } = {}) => {
  try {
    if (!percorso || !fs.existsSync(percorso)) return { error: 'file inesistente' };
    shell.showItemInFolder(percorso);
    return { ok: true };
  } catch (err) { return { error: err.message }; }
});

ipcMain.handle('course:export', async (e, { corso, appunti } = {}) => {
  const v = vaultDir(); if (!v) return { error: 'nessuna cartella StudIA impostata' };
  if (!corso) return { error: 'nessun corso scelto' };
  const radice = corsiLib.radice(v);
  if (!fs.existsSync(corsiLib.fileCorso(v, corso))) return { error: 'corso inesistente' };

  const r = await dialog.showSaveDialog(win, {
    title: 'Esporta il corso',
    defaultPath: path.join(app.getPath('downloads'), pacchetto.nomeFile(corso)),
    filters: [{ name: 'Pacchetto StudIA', extensions: ['zip'] }]
  });
  if (r.canceled || !r.filePath) return { annullato: true };

  const salta = [corsiLib.LAVORAZIONE].concat(appunti ? [] : ['APPUNTI']);
  const totale = contaFileRicorsivo(path.join(radice, corso), salta) || 1;
  const { cmd, args } = pacchetto.comandoEsporta(corso, r.filePath, { appunti: !!appunti });
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
            win.webContents.send('course:export:progress', {
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
      if (win && !win.isDestroyed()) win.webContents.send('course:export:progress', { fatti: totale, totale, percento: 100 });
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

ipcMain.handle('course:import', async () => {
  const v = vaultDir(); if (!v) return { error: 'nessuna cartella StudIA impostata' };
  const scelta = await dialog.showOpenDialog(win, {
    title: 'Scegli il pacchetto del corso',
    properties: ['openFile'],
    filters: [{ name: 'Pacchetto StudIA', extensions: ['zip'] }]
  });
  if (scelta.canceled || !scelta.filePaths[0]) return { annullato: true };
  const zip = scelta.filePaths[0];

  const info = await leggiPacchetto(zip);
  if (!info.ok) return { error: 'Pacchetto non valido: ' + info.motivo };

  const radice = corsiLib.radice(v);
  fs.mkdirSync(radice, { recursive: true });
  const idFinale = pacchetto.idLibero(info.id, (x) => fs.existsSync(path.join(radice, x)));

  // si estrae in una cartella di servizio e si sposta solo a estrazione riuscita:
  // un'interruzione a metà non lascia un corso monco dentro Corsi/
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
        try { fs.rmSync(path.join(radice, idFinale, corsiLib.LAVORAZIONE), { recursive: true, force: true }); } catch (_) {}
        resolve({ id: idFinale, rinominato: idFinale !== info.id, contenuto: pacchetto.descrizione(info) });
      } catch (e2) { pulisci(); resolve({ error: e2.message }); }
    });
  });
});

ipcMain.handle('course:create', (e, { nome, brief } = {}) => {
  const v = vaultDir(); if (!v) return { error: 'nessuna cartella StudIA impostata' };
  const id = mdser.slugify(String(nome || '').trim(), 60);
  if (!id || id === 'senza-titolo') return { error: 'dai un nome al corso' };
  const dir = path.join(corsiLib.radice(v), id);
  if (fs.existsSync(dir)) return { error: 'esiste già un corso con questo nome' };
  try {
    fs.mkdirSync(dir, { recursive: true });
    // un corso nuovo nasce già con la sua cartella dei materiali: è ciò che
    // rende la cartella distribuibile così com'è
    for (const sub of mat.cartelleCorso()) fs.mkdirSync(path.join(dir, mat.CARTELLA, sub), { recursive: true });
    writeAtomic(path.join(dir, '_corso.md'), mdser.corso({
      id, title: String(nome).trim(), brief: brief || {}, indicazioni: (brief && brief.indicazioni) || ''
    }));
    return { id };
  } catch (err) { return { error: err.message }; }
});

// ---- brief: upsert IN-PLACE su _corso.md (mai ri-serializzare da un parse) ----
ipcMain.handle('brief:get', (e, { corso } = {}) => {
  const v = vaultDir(); if (!v || !corso) return {};
  let raw = ''; try { raw = fs.readFileSync(fileCorsoDi(corso), 'utf-8'); } catch (err) { return {}; }
  const fm = profiloLib.parse(raw);
  const sec = /^##\s+Indicazioni per questo materiale\s*$([\s\S]*?)(?=^##\s|\Z)/m.exec(raw);
  return {
    title: fm.title || corso,
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
ipcMain.handle('fonti:set', (e, { corso, fonti } = {}) => {
  const v = vaultDir(); if (!v || !corso) return { error: 'corso mancante' };
  if (corsiLib.protetto(v, corso)) return { error: corsiLib.motivoRifiuto(corso) };
  const file = fileCorsoDi(corso);
  let raw; try { raw = fs.readFileSync(file, 'utf-8'); } catch (err) { return { error: '_corso.md non trovato' }; }
  try {
    writeAtomic(file, mdser.upsertFmLine(raw, 'fonti', mdser.bloccoFonti(fonti || {})));
    return { ok: true };
  } catch (err) { return { error: err.message }; }
});

ipcMain.handle('brief:set', (e, { corso, brief } = {}) => {
  const v = vaultDir(); if (!v || !corso) return { error: 'corso mancante' };
  if (corsiLib.protetto(v, corso)) return { error: corsiLib.motivoRifiuto(corso) };
  const file = fileCorsoDi(corso);
  let raw; try { raw = fs.readFileSync(file, 'utf-8'); } catch (err) { return { error: '_corso.md non trovato' }; }
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
 * Si conta DENTRO il corso: un corso nuovo parte da 01. Prima si guardava
 * tutto il vault — ogni altro corso, la radice e i materiali in attesa — e si
 * ripartiva dal massimo. Così un corpus di 24 lezioni si è ritrovato numerato
 * 79–102 perché altrove, in una cartella di lavoro che non era nemmeno un
 * corso, c'erano 45 file già numerati.
 *
 * Senza `corso` resta il conteggio globale, che è quello giusto per i vault a
 * corpus unico, dove i numeri non hanno un corso a cui appartenere.
 */
function prossimoNumero(v, corso) {
  let max = 0;
  const guarda = (dir) => {
    let files; try { files = fs.readdirSync(dir); } catch (e) { return; }
    for (const f of files) { const n = mat.numero(f); if (n) max = Math.max(max, n); }
  };
  for (const sub of ['Media', 'Fonti']) {
    for (const dir of mat.cartelle(v, sub, corso, !!corso)) guarda(dir);
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

// `corso` decide due cose insieme: da che numero si parte e dove atterrano i
// file. Vanno decise insieme, o si numera per corso scrivendo nella radice.
ipcMain.handle('import:scan', (e, { cartella, forzati, corso } = {}) => {
  const v = vaultDir(); if (!v) return { error: 'nessuna cartella StudIA impostata' };
  if (!cartella) return { error: 'nessuna cartella da esaminare' };
  try {
    return importaLib.esamina(cartella, { numeraDa: prossimoNumero(v, corso), corso, forzati: forzati || [] });
  } catch (err) { return { error: err.message }; }
});

ipcMain.handle('import:apply', (e, { cartella, forzati, corso } = {}) => {
  const v = vaultDir(); if (!v) return { error: 'nessuna cartella StudIA impostata' };
  if (!cartella) return { error: 'nessuna cartella da importare' };
  try {
    // si ripianifica al momento della copia: l'anteprima poteva essere vecchia
    const piano = importaLib.esamina(cartella, { numeraDa: prossimoNumero(v, corso), corso, forzati: forzati || [] });
    return { ...importaLib.applica(v, piano), riepilogo: piano.riepilogo };
  } catch (err) { return { error: err.message }; }
});

// ---- corpus: materiali (media + PDF) con lo stato di elaborazione ----
// estende media:list ai PDF, che vengono indicizzati in Indice-PDF/ invece che trascritti
// Con `corso` elenca SOLO i suoi materiali: il pannello «Elaborazione» del
// wizard mostrava tutto il vault, cioè anche i materiali degli altri corsi.
ipcMain.handle('corpus:list', (e, { corso } = {}) => {
  const v = vaultDir(); if (!v) return [];
  const solo = !!corso;
  const out = [];
  const stato = (dirStato, stem) => {
    const f = mat.trova(v, dirStato, stem + '.json', corso, solo);
    try { return !!f && fs.statSync(f).size > 0; } catch (e) { return false; }
  };
  for (const sub of ['Media', 'Fonti']) {
    for (const { nome: f, dir, dentroCorso } of mat.elenca(v, sub, corso, solo)) {
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
        ufficiale: tipo === 'media' && !!mat.trova(v, 'Trascrizioni', stem + '.ufficiale.txt', corso, solo),
        // dove sta davvero il file: dentro il corso o nel corpus del vault
        dentroCorso: !!dentroCorso
      });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'it'));
});

// ============================================================================
// M4 — proposta dell'indice delle lezioni e approvazione
// ============================================================================
const propose = require('./lib/propose');
const pianoEdit = require('./lib/pianoedit');   // le correzioni al taglio delle lezioni, dal composer
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
 * Che cosa guadagnerebbe questo corso a farsi rileggere i PDF, PDF per PDF.
 *
 * Gira sull'ambiente della trascrizione, non su quello dell'OCR: la stima deve
 * potersi vedere PRIMA di scaricare undici gigabyte, altrimenti l'unico modo di
 * sapere se conviene installare Chandra sarebbe installarlo.
 */
ipcMain.handle('ocr:stima', (e, { corso } = {}) => {
  const v = vaultDir(); if (!v || !corso) return { error: 'corso mancante' };
  try {
    const file = [];
    for (const dir of mat.cartelle(v, 'Fonti', corso, true)) {
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
ipcMain.on('ocr:ferma', (e, { corso } = {}) => { if (corso) ocrFermato.add(corso); });

ipcMain.on('ocr:leggi', async (e, { corso, scelte } = {}) => {
  const send = (ch, d) => { try { e.sender.send(ch, d); } catch (_) {} };
  const v = vaultDir();
  if (!v || !corso) { send('ocr:leggiError', 'corso mancante'); return; }
  if (corsiLib.protetto(v, corso)) { send('ocr:leggiError', corsiLib.motivoRifiuto(corso)); return; }
  const ud = app.getPath('userData');
  if (!ocrLib.stato(ud).installato) { send('ocr:leggiError', 'La lettura avanzata non è installata.'); return; }
  const lista = (scelte || []).filter((s) => s && s.file && (s.pagine || []).length);
  if (!lista.length) { send('ocr:leggiError', 'nessun PDF da rileggere'); return; }

  ocrFermato.delete(corso);
  const py = ocrLib.python(ud);
  const fatti = [], falliti = [];
  const totPagine = lista.reduce((a, s) => a + s.pagine.length, 0);
  let fattePagine = 0;

  for (const s of lista) {
    if (ocrFermato.has(corso)) { send('ocr:leggiLog', 'Fermato su richiesta.'); break; }
    const pdf = mat.trova(v, 'Fonti', s.file, corso, true);
    if (!pdf) { falliti.push({ file: s.file, errore: 'non trovato' }); continue; }
    const stem = s.file.replace(/\.[a-z0-9]+$/i, '');
    // l'indice e i ritagli stanno ACCANTO al materiale, cioè dentro il corso:
    // altrimenti il corso spostato altrove avrebbe i PDF senza le sue figure
    const indice = mat.trova(v, 'Indice-PDF', stem + '.json', corso, true) ||
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

ipcMain.handle('plan:get', (e, { corso } = {}) => {
  const v = vaultDir(); if (!v || !corso) return null;
  return propose.leggiPiano(v, corso);
});

ipcMain.handle('plan:save', (e, { corso, piano } = {}) => {
  const v = vaultDir(); if (!v || !corso) return { error: 'corso mancante' };
  if (corsiLib.protetto(v, corso)) return { error: corsiLib.motivoRifiuto(corso) };
  /* Correggere il taglio delle lezioni rinumera le cartelle: `03-delega` può
     ritrovarsi a essere un'altra lezione. Le scalette appese alle cartelle
     cambiate non valgono più, e vanno buttate PRIMA di salvare — una scaletta
     sopravvissuta sembrerebbe quella giusta e proporrebbe capitoli su materiali
     che quella lezione non ha. Si perde una spesa, ma è già persa. */
  const prima = propose.leggiPiano(v, corso);
  const cambiate = pianoEdit.cartelleCambiate(prima, piano);
  const buttate = percorsiLib.invalida(v, corso, cambiate);
  const r = propose.scriviPiano(v, corso, piano);
  if (r && r.error) return r;
  return Object.assign({}, r, { invalidate: buttate.scalette, percorsiToccati: buttate.percorsi });
});

ipcMain.on('plan:propose', async (e, { corso, granularita } = {}) => {
  const send = (ch, d) => { try { e.sender.send(ch, d); } catch (_) {} };
  const v = vaultDir();
  if (!v || !corso) { send('plan:error', 'corso mancante'); return; }
  if (corsiLib.protetto(v, corso)) { send('plan:error', corsiLib.motivoRifiuto(corso)); return; }
  try {
    send('plan:progress', { fase: 'digest', msg: 'Leggo trascrizioni e indici…' });
    const ai = sceltaAi();
    send('plan:progress', {
      fase: ai ? 'ai' : 'euristica',
      msg: ai ? ('Chiedo a ' + ai.fornitore + ' di rivedere il raggruppamento…') : 'Nessuna chiave API: uso le sole euristiche locali…'
    });
    // il brief sta nel frontmatter di _corso.md: entra nel prompt della proposta
    let briefObj = {};
    try {
      const raw = fs.readFileSync(fileCorsoDi(corso), 'utf-8');
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
    const dgOra = propose.corpusDelPiano(v, corso).dg;
    const schedePresenti = Object.keys(schedeLib.tutte(v, corso, dgOra.materiali)).length;
    let r;
    if (ai && schedePresenti >= Math.max(1, Math.floor(dgOra.totale * 0.8))) {
      send('plan:progress', { fase: 'multiagente', msg: 'Tre analisi indipendenti sulle ' + schedePresenti + ' schede…' });
      r = await propose.proponiMultiagente(v, corso, {
        granularita: granularita || 'atomico', brief: briefObj, profilo: profiloLib.load(v),
        ai: { fornitore: ai.fornitore, modello: ai.modello, apiKey: ai.apiKey, lingua: ai.lingua },
        onProgress: (ev) => send('plan:progress', {
          fase: ev.fase,
          msg: ev.fase === 'lente' ? ('Analisi «' + ev.etichetta + '»: ' + ev.stato)
             : (ev.fase === 'sintesi' ? 'Sintesi dell\'architettura…' : 'Revisione critica dell\'architettura…')
        })
      });
      if (r.errore) { send('plan:error', r.errore); return; }
      if (r.uso) registraUso(Object.assign({ fornitore: ai.fornitore, modello: ai.modello }, r.uso), corso, 'architettura multiagente');
    } else {
      r = await propose.proponi(v, corso, {
        granularita: granularita || 'atomico',
        brief: briefObj,
        profilo: profiloLib.load(v),
        fornitore: ai && ai.fornitore, modello: ai && ai.modello, apiKey: ai && ai.apiKey, lingua: ai && ai.lingua
      });
      if (ai && schedePresenti < dgOra.totale) {
        r.avviso = (r.avviso ? r.avviso + ' ' : '') + 'Analisi dei materiali incompleta (' + schedePresenti + '/' + dgOra.totale + '): per un indice di qualità piena, analizza prima tutti i materiali.';
      }
    }
    const scritto = propose.scriviPiano(v, corso, r.piano);
    if (scritto.error) { send('plan:error', scritto.error); return; }
    /* Il costo della proposta va nel registro come qualunque altra chiamata —
       e ora ci va DAVVERO. ⚠️ Qui c'era una copia scritta a mano di
       `registraUso` con `costUsd: 0` **cablato**: la proposta d'indice, che è
       una delle chiamate più grosse del progetto (tutto il digest del corpus),
       risultava gratis per costruzione. Una funzione sola, così il giorno che
       cambia il modo di calcolare il costo cambia in un posto. */
    if (r.uso) registraUso(r.uso, corso, 'proposta indice');
    send('plan:done', { piano: r.piano, origine: r.origine, avviso: r.avviso || null, revisione: r.revisione || null, giri: r.giri || 1 });
  } catch (err) {
    send('plan:error', String((err && err.message) || err));
  }
});

/** Crea le cartelle-lezione e i _lezione.md, e aggiorna ordine_lezioni nel corso. */
ipcMain.handle('plan:approve', (e, { corso } = {}) => {
  const v = vaultDir(); if (!v || !corso) return { error: 'corso mancante' };
  if (corsiLib.protetto(v, corso)) return { error: corsiLib.motivoRifiuto(corso) };
  const piano = propose.leggiPiano(v, corso);
  if (!piano || !Array.isArray(piano.lezioni) || !piano.lezioni.length) return { error: 'nessun piano da approvare' };

  /* Ultima rete prima che il piano diventi cartelle sul disco: il corpus si
     rilegge ADESSO e si controlla che nessun materiale utilizzabile sia rimasto
     fuori. Il piano può essere nato ore prima, su un corpus a metà — è
     esattamente così che sono nati 156 rimandi ai video e zero ai PDF: i PDF
     furono indicizzati dopo la proposta, e nulla lo disse. Restano fuori senza
     protestare i materiali non ancora elaborati e le pagine web congelate:
     quelli l'utente li vede nell'avviso della proposta. */
  const delPiano = propose.corpusDelPiano(v, corso).dg;
  const nelPiano = new Set();
  for (const c of piano.lezioni) for (const m of (c.materiali || [])) if (m.num) nelPiano.add(String(m.num).padStart(2, '0'));
  const fuori = delPiano.materiali.filter((m) => m.num && !nelPiano.has(String(m.num).padStart(2, '0')));
  if (fuori.length) {
    return { error: 'Il piano lascia fuori ' + fuori.length + ' materiali già elaborati (' +
      fuori.map((m) => m.num).join(', ') + '). Rifai la proposta dell\'indice prima di approvare.' };
  }

  const creati = [];
  try {
    for (const c of piano.lezioni) {
      const dir = path.join(corsiLib.cartellaLezioniPerScrivere(v, corso), c.folder);
      fs.mkdirSync(dir, { recursive: true });
      writeAtomic(path.join(dir, '_lezione.md'), mdser.lezione({
        id: c.folder, title: c.title, area: c.area || '',
        materiali: (c.materiali || []).map((m) => m.num || m.source),
        status: 'approvato', ordineCapitoli: (c.capitoli || []).map((k) => k.file),
        nota: c.rationale || ''
      }));
      creati.push(c.folder);
      c.status = 'approvato';
    }
    // ordine_lezioni nel corso, upsert in-place per non perdere il resto del frontmatter
    const fileProg = fileCorsoDi(corso);
    let raw = fs.readFileSync(fileProg, 'utf-8');
    raw = mdser.upsertFmLine(raw, 'ordine_lezioni', 'ordine_lezioni: ' + mdser.yList(creati));
    raw = mdser.upsertFmLine(raw, 'n_lezioni', 'n_lezioni: ' + creati.length);
    writeAtomic(fileProg, raw);

    piano.status = 'approvato'; piano.wizardStep = 4; piano.aggiornato = new Date().toISOString();
    const scritto = propose.scriviPiano(v, corso, piano);
    if (scritto.error) return { error: scritto.error };
    return { ok: true, creati };
  } catch (err) { return { error: err.message }; }
});

// ============================================================================
// Analisi multiagente: schede per materiale + architettura delle lezioni
// ============================================================================
const schedeLib = require('./lib/schede');

/**
 * Mostra un file nel Finder.
 *
 * ⚠️ Arriva un `file://` (è quello che il renderer ha per mano: `srcUrl` torna
 * URL, non percorsi) e `showItemInFolder` vuole un PERCORSO: passargli l'URL
 * apre una finestra sulla cartella sbagliata, o nessuna. E si controlla che il
 * file stia DENTRO il vault: questa è una porta che apre il Finder su ciò che
 * gli si dice, e non deve poter puntare fuori.
 */
ipcMain.handle('file:reveal', (e, quale) => {
  const v = vaultDir(); if (!v) return { ok: false, error: 'nessun vault' };
  let p = String(quale || '');
  try { if (/^file:\/\//i.test(p)) p = require('url').fileURLToPath(p); } catch (_) { return { ok: false, error: 'percorso illeggibile' }; }
  const dentro = path.resolve(p);
  if (!dentro.startsWith(path.resolve(v) + path.sep)) return { ok: false, error: 'fuori dal vault' };
  if (!fs.existsSync(dentro)) return { ok: false, error: 'il file non c\'è più' };
  shell.showItemInFolder(dentro);
  return { ok: true, error: '' };
});

/** Registra il consumo di una fase nel registro costi. */
function registraUso(uso, corso, etichetta) {
  const v = vaultDir(); if (!v || !uso) return;
  try {
    fs.mkdirSync(path.join(v, 'Costi'), { recursive: true });
    fs.appendFileSync(path.join(v, 'Costi', 'usage.jsonl'), JSON.stringify({
      ts: new Date().toISOString(), provider: uso.fornitore || '?', model: uso.modello || '?',
      inputTokens: uso.inputTokens || 0, outputTokens: uso.outputTokens || 0,
      // Claude Code dichiara già il costo a listino: quello vince sul nostro calcolo
      costUsd: (typeof uso.costoUsdDichiarato === 'number' ? uso.costoUsdDichiarato : providerAi.costoUsd(uso)) || 0,
      lessonId: corso, label: etichetta
    }) + '\n');
  } catch (e) {}
}

/** Stato delle schede di un corso: quante ci sono e quante mancano. */
ipcMain.handle('schede:stato', (e, { corso } = {}) => {
  const v = vaultDir(); if (!v || !corso) return { totale: 0, fatte: 0, mancanti: [] };
  /* Il conteggio deve chiudere: se il totale comprende materiali che l'analisi
     non tocca — non elaborati, o congelati — «24 su 37» non arriva mai a 37 e
     l'utente rifà l'analisi all'infinito cercando le tredici che mancano. */
  const filtrato = corpusLib().perIlPiano(corpusLib().digest(v, corso));
  const dg = filtrato.dg;
  const mappa = schedeLib.tutte(v, corso, dg.materiali);
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
function regoleForma(fase, corso) {
  const v = vaultDir(); if (!v) return '';
  try {
    const p = profiloLib.load(v);
    let indicazioni = '';
    if (corso) {
      const raw = fs.readFileSync(fileCorsoDi(corso), 'utf-8');
      const sec = /^##\s+Indicazioni per questo materiale\s*$([\s\S]*?)(?=^##\s|\Z)/m.exec(raw);
      indicazioni = sec ? sec[1].trim().replace(/^—$/, '') : '';
    }
    return profiloLib.promptBlock(p, fase, indicazioni);
  } catch (err) { return ''; }
}

// le alternative di scaletta per UNA lezione del piano
ipcMain.handle('scaletta:proponi', async (e, { corso, folder, nCapitoli, nAlternative } = {}) => {
  const v = vaultDir(); if (!v || !corso) return { error: 'corso mancante' };
  if (corsiLib.protetto(v, corso)) return { error: corsiLib.motivoRifiuto(corso) };
  const ai = sceltaAi();
  if (!ai) return { error: 'Serve una chiave API: le scalette nascono dalla lettura delle schede.' };
  const piano = propose.leggiPiano(v, corso);
  const lezione = lezioneDelPiano(piano, folder);
  if (!lezione) return { error: 'lezione non trovata nel piano' };
  try {
    const dg = corpusLib().digest(v, corso);
    const schedeMappa = schedeLib.tutte(v, corso, dg.materiali);
    if (!Object.keys(schedeMappa).length) return { error: 'Mancano le schede: fai prima il passo «Analisi».' };
    const r = await scalettaLib.proponi(lezione, schedeMappa,
      { fornitore: ai.fornitore, modello: ai.modello, apiKey: ai.apiKey, lingua: ai.lingua },
      { regoleForma: regoleForma('proposta', corso), nCapitoli: nCapitoli,
        nAlternative: nAlternative || leggiPrefs().nAlternative });
    if (r.uso) registraUso(Object.assign({ fornitore: ai.fornitore, modello: ai.modello }, r.uso), corso, 'scalette ' + folder);
    if (r.errore) return { error: r.errore };
    // in cache: le alternative sono un intermedio pagato, e il composer le rilegge invece di ricomprarle
    try { percorsiLib.scriviScaletta(v, corso, folder, r.alternative, nCapitoli); } catch (err) {}
    return { alternative: r.alternative };
  } catch (err) { return { error: String((err && err.message) || err) }; }
});

// ============================================================================
// Composer degli indici: le scalette di TUTTE le lezioni, e i percorsi che ne nascono
// ============================================================================
const percorsiLib = require('./lib/percorsi');

/** Quello che il composer trova già in casa: piano, scalette in cache, percorsi salvati. */
ipcMain.handle('composer:stato', (e, { corso } = {}) => {
  const v = vaultDir(); if (!v || !corso) return { error: 'corso mancante' };
  const piano = propose.leggiPiano(v, corso);
  const lezioni = ((piano && piano.lezioni) || []).map((c) => ({
    folder: c.folder, title: c.title, materiali: (c.materiali || []).length
  }));
  return {
    lezioni,
    scalette: percorsiLib.leggiScalette(v, corso),
    percorsi: percorsiLib.leggiTutti(v, corso),
    personaggi: percorsiLib.PERSONAGGI,
    protetto: corsiLib.protetto(v, corso)
  };
});

/**
 * Chiede le scalette di più lezioni in fila, mandando avanzamento per ognuna.
 *
 * Una lezione per volta e non tutte insieme: sono chiamate lunghe, e con la
 * concorrenza un 429 del fornitore ne farebbe cadere quattro invece di una.
 * `solo` limita alle lezioni indicate (il «rifai» di una riga sola); senza `rifai`
 * le lezioni che hanno già una scaletta in cache si saltano, così riaprire il
 * composer dopo un errore non ricompra quello che c'è già.
 */
ipcMain.on('scalette:tutte', async (e, { corso, nCapitoli, nAlternative, solo, rifai } = {}) => {
  const send = (ch, d) => { try { e.sender.send(ch, d); } catch (_) {} };
  const v = vaultDir();
  if (!v || !corso) { send('scalette:error', 'corso mancante'); return; }
  if (corsiLib.protetto(v, corso)) { send('scalette:error', corsiLib.motivoRifiuto(corso)); return; }
  const ai = sceltaAi();
  if (!ai) { send('scalette:error', 'Serve una chiave API: le scalette nascono dalla lettura delle schede.'); return; }
  const piano = propose.leggiPiano(v, corso);
  const tutti = (piano && piano.lezioni) || [];
  if (!tutti.length) { send('scalette:error', 'nessuna lezione nel piano'); return; }
  const cache = percorsiLib.leggiScalette(v, corso);
  const lista = tutti.filter((c) => (!solo || !solo.length || solo.indexOf(c.folder) >= 0))
                     .filter((c) => rifai || !(cache[c.folder] && (cache[c.folder].alternative || []).length));
  if (!lista.length) { send('scalette:done', { fatti: 0, errori: [] }); return; }
  try {
    const dg = corpusLib().digest(v, corso);
    const schedeMappa = schedeLib.tutte(v, corso, dg.materiali);
    if (!Object.keys(schedeMappa).length) { send('scalette:error', 'Mancano le schede: fai prima il passo «Analisi».'); return; }
    const regole = regoleForma('proposta', corso);
    const errori = [];
    let fatti = 0;
    for (let i = 0; i < lista.length; i++) {
      const lezione = lista[i];
      send('scalette:progress', { folder: lezione.folder, titolo: lezione.title, indice: i + 1, totale: lista.length, stato: 'in corso' });
      let r;
      try {
        r = await scalettaLib.proponi(lezione, schedeMappa,
          { fornitore: ai.fornitore, modello: ai.modello, apiKey: ai.apiKey, lingua: ai.lingua },
          { regoleForma: regole, nCapitoli: nCapitoli,
            nAlternative: nAlternative || leggiPrefs().nAlternative });
      } catch (err) { r = { errore: String((err && err.message) || err) }; }
      if (r.uso) registraUso(Object.assign({ fornitore: ai.fornitore, modello: ai.modello }, r.uso), corso, 'scalette ' + lezione.folder);
      if (r.errore || !(r.alternative || []).length) {
        errori.push({ folder: lezione.folder, errore: r.errore || 'nessuna scaletta utilizzabile' });
        send('scalette:progress', { folder: lezione.folder, titolo: lezione.title, indice: i + 1, totale: lista.length, stato: 'errore: ' + (r.errore || 'niente di utilizzabile') });
        continue;
      }
      percorsiLib.scriviScaletta(v, corso, lezione.folder, r.alternative, nCapitoli);
      fatti++;
      send('scalette:progress', {
        folder: lezione.folder, titolo: lezione.title, indice: i + 1, totale: lista.length,
        stato: r.alternative.length + ' indici', alternative: r.alternative
      });
    }
    send('scalette:done', { fatti, errori });
  } catch (err) { send('scalette:error', String((err && err.message) || err)); }
});

ipcMain.handle('percorsi:list', (e, { corso } = {}) => {
  const v = vaultDir(); if (!v || !corso) return [];
  return percorsiLib.leggiTutti(v, corso);
});

/** Lo stato intero del composer: i percorsi mandati si salvano, quelli spariti si cancellano. */
ipcMain.handle('percorsi:save', (e, { corso, percorsi } = {}) => {
  const v = vaultDir(); if (!v || !corso) return { error: 'corso mancante' };
  if (corsiLib.protetto(v, corso)) return { error: corsiLib.motivoRifiuto(corso) };
  try {
    // la cartella della coppia si calcola qui, dove le scalette ci sono, e resta
    // scritta nel percorso: il lettore la legge senza dover conoscere le scalette
    const conCartelle = percorsiLib.conCartelle(percorsi || [], percorsiLib.leggiScalette(v, corso));
    return { ok: true, percorsi: percorsiLib.salvaTutti(v, corso, conCartelle) };
  } catch (err) { return { error: String((err && err.message) || err) }; }
});

/**
 * Un comando sul taglio delle lezioni, dal composer: sposta, unisci, separa,
 * rinomina. La logica sta in `lib/pianoedit.js`; qui si legge, si applica, si
 * buttano le scalette che il rimescolamento ha reso false, e si salva.
 */
ipcMain.handle('plan:comando', (e, { corso, azione, indice, valore } = {}) => {
  const v = vaultDir(); if (!v || !corso) return { error: 'corso mancante' };
  if (corsiLib.protetto(v, corso)) return { error: corsiLib.motivoRifiuto(corso) };
  const piano = propose.leggiPiano(v, corso);
  if (!piano || !Array.isArray(piano.lezioni)) return { error: 'nessun piano da correggere' };
  const prima = JSON.parse(JSON.stringify(piano));
  const i = Number(indice);
  if (azione === 'titolo') {
    if (!piano.lezioni[i]) return { error: 'lezione inesistente' };
    piano.lezioni[i].title = String(valore || '').slice(0, 120);
    pianoEdit.rinumera(piano);
  } else {
    if (pianoEdit.AZIONI.indexOf(azione) < 0) return { error: 'comando sconosciuto: ' + azione };
    if (!pianoEdit.possibile(piano, azione, i)) return { error: 'comando non applicabile qui' };
    pianoEdit.applica(piano, azione, i);
  }
  const buttate = percorsiLib.invalida(v, corso, pianoEdit.cartelleCambiate(prima, piano));
  const w = propose.scriviPiano(v, corso, piano);
  if (w && w.error) return { error: w.error };
  return {
    ok: true,
    lezioni: piano.lezioni.map((c) => ({ folder: c.folder, title: c.title, materiali: (c.materiali || []).length })),
    scalette: percorsiLib.leggiScalette(v, corso),
    percorsi: percorsiLib.leggiTutti(v, corso),
    invalidate: buttate.scalette
  };
});

/** I file .md di capitolo dentro una cartella-lezione (la logica sta in lib/, coperta dai test). */
function capitoliSulDisco(v, corso, cartella) { return percorsiLib.capitoliSulDisco(v, corso, cartella); }

/**
 * Le coppie lezione+indice da scrivere, con quanto è già stato scritto e quanto costa il resto.
 * È ciò che il composer mostra prima di far spendere: quante cartelle, quanti
 * capitoli, e quali indici sono condivisi fra più percorsi.
 */
ipcMain.handle('percorsi:coppie', (e, { corso } = {}) => {
  const v = vaultDir(); if (!v || !corso) return { error: 'corso mancante' };
  const piano = propose.leggiPiano(v, corso);
  const perLezione = {};
  for (const c of ((piano && piano.lezioni) || [])) perLezione[c.folder] = c;
  const coppie = percorsiLib.coppieDaScrivere(
    percorsiLib.leggiTutti(v, corso), percorsiLib.leggiScalette(v, corso)
  ).map((k) => {
    const scritti = capitoliSulDisco(v, corso, k.cartella).length;
    return Object.assign({}, k, {
      capitoli: k.capitoli.length,
      titoloLezione: (perLezione[k.folder] && perLezione[k.folder].title) || k.folder,
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
 * Scrive i capitoli delle coppie lezione+indice.
 *
 * Una cartella per coppia, `03-delega--per-domande`, col suo `_lezione.md`. Le
 * coppie già scritte si saltano se non si chiede `riscrivi`: è la stessa regola
 * delle scalette — quello che è già stato pagato non si ricompra da solo.
 *
 * Riscrivendo, i capitoli vecchi della cartella si cancellano PRIMA: la
 * cartella appartiene per intero alla coppia, e lasciarli lì significherebbe
 * ritrovarsi due versioni dello stesso capitolo con numeri uguali e slug
 * diversi, senza modo di sapere quale sia quella buona.
 */
ipcMain.on('percorsi:capitoli', async (ev, { corso, cartelle, riscrivi } = {}) => {
  const send = (ch, d) => { try { ev.sender.send(ch, d); } catch (_) {} };
  const v = vaultDir();
  if (!v || !corso) { send('percorsi:cap:error', 'corso mancante'); return; }
  if (corsiLib.protetto(v, corso)) { send('percorsi:cap:error', corsiLib.motivoRifiuto(corso)); return; }
  const ai = sceltaAi();
  if (!ai) { send('percorsi:cap:error', 'Serve una chiave API per scrivere i capitoli.'); return; }
  const piano = propose.leggiPiano(v, corso);
  const perLezione = {};
  for (const c of ((piano && piano.lezioni) || [])) perLezione[c.folder] = c;

  const tutte = percorsiLib.coppieDaScrivere(
    percorsiLib.leggiTutti(v, corso), percorsiLib.leggiScalette(v, corso));
  const lista = tutte
    .filter((k) => !cartelle || !cartelle.length || cartelle.indexOf(k.cartella) >= 0)
    .filter((k) => riscrivi || !capitoliSulDisco(v, corso, k.cartella).length)
    .filter((k) => perLezione[k.folder] && k.capitoli.length);
  if (!lista.length) { send('percorsi:cap:done', { fatte: 0, scritti: 0, scarti: 0, saltate: tutte.length }); return; }

  genFermato.delete(corso);
  let scritti = 0, scarti = 0, fatte = 0;
  try {
    for (let i = 0; i < lista.length; i++) {
      if (genFermato.has(corso)) { send('percorsi:cap:log', 'Fermato su richiesta.'); break; }
      const k = lista[i];
      const lezione = perLezione[k.folder];
      send('percorsi:cap:progress', { fase: 'lezione', cartella: k.cartella, titoloLezione: lezione.title,
        nome: k.nome, coppia: i + 1, coppie: lista.length, indice: 0, totale: k.capitoli.length });
      percorsiLib.preparaCartella(v, corso, lezione, k, { riscrivi: !!riscrivi });
      const r = await scriviCapitoli({
        v, corso, lezione, cartella: k.cartella, capitoli: k.capitoli, accoda: false, ai,
        onProgress: (d) => send('percorsi:cap:progress', Object.assign({ fase: 'capitolo', cartella: k.cartella,
          titoloLezione: lezione.title, nome: k.nome, coppia: i + 1, coppie: lista.length }, d)),
        onLog: (l) => send('percorsi:cap:log', k.cartella + ' · ' + l)
      });
      scritti += r.scritti.length; scarti += r.scarti.length; fatte++;
      if (r.fermato) break;
    }
    send('percorsi:cap:done', { fatte, scritti, scarti, saltate: tutte.length - lista.length });
  } catch (err) { send('percorsi:cap:error', String((err && err.message) || err)); }
});


/**
 * La voce di piano di una cartella-lezione, accettando anche le VARIANTI.
 *
 * ⚠️ Il piano conosce solo le basi (`lib/propose.js`: `folder: NN-slug`), ma la
 * cartella in cui si scrive davvero è quella che il percorso fa leggere — che
 * per una lezione variantizzata è `base--variante`. Il controllo «è nel piano?»
 * quindi bocciava proprio le destinazioni giuste: la tendina di ⚙ offriva la
 * variante e il click rispondeva «lezione non trovata nel piano». Cercare la
 * base è ciò che rende la stessa domanda vera per tutte e due le forme.
 */
function lezioneDelPiano(piano, folder) {
  const lez = (piano && piano.lezioni) || [];
  const esatta = lez.find((c) => c.folder === folder);
  if (esatta) return esatta;
  const base = percorsiLib.scomponi(folder).base;
  return lez.find((c) => c.folder === base) || null;
}

/**
 * Espansione: che cosa c'è di nuovo da mettere in un corso già finito.
 * Ritorna i materiali che nessuna lezione dichiara di usare, le lezioni esistenti
 * (per scegliere quale estendere) e i rimandi [[NN-slug]] che puntano nel vuoto.
 */
ipcMain.handle('expand:stato', (e, { corso } = {}) => {
  const v = vaultDir(); if (!v || !corso) return { error: 'corso mancante' };
  if (!fs.existsSync(fileCorsoDi(corso))) return { error: 'corso inesistente' };
  const cartelle = corsiLib.elencoLezioni(v, corso);

  const lezioni = cartelle.map((folder) => {
    const ldir = corsiLib.lezioneDir(v, corso, folder);
    let raw = ''; try { raw = fs.readFileSync(corsiLib.fileLezione(ldir), 'utf-8'); } catch (_) {}
    const fm = profiloLib.parse(raw);
    let files = []; try { files = fs.readdirSync(ldir); } catch (_) {}
    const capitoli = espandiLib.capitoliDi(files);
    /* `variante` e `base` viaggiano fino alla tendina: senza, l'unica cosa da
       mostrare sarebbe il nome della cartella — che per una variante è lungo,
       tagliato a metà e uguale a quello della sua base per i primi quaranta
       caratteri. È così che si sceglie la riga sbagliata. */
    const { base, variante } = percorsiLib.scomponi(folder);
    return {
      folder, titolo: fm.title || folder, base, variante: fm.variante || variante,
      materiali: (fm.materiali || []).map((n) => parseInt(n, 10)).filter(Number.isFinite),
      capitoli: capitoli.length, prossimoOrdine: espandiLib.prossimoOrdine(files)
    };
  });

  // rimandi verso lezioni che non esistono: su un corso che cresce è l'errore
  // che non si vede finché un allievo non ci clicca sopra
  const capitoliTesto = [];
  for (const folder of cartelle) {
    const ldir = corsiLib.lezioneDir(v, corso, folder);
    let files = []; try { files = fs.readdirSync(ldir); } catch (_) {}
    for (const f of espandiLib.capitoliDi(files)) {
      try { capitoliTesto.push({ file: folder + '/' + f, contenuto: fs.readFileSync(path.join(ldir, f), 'utf-8') }); } catch (_) {}
    }
  }
  /* ⚠️ Non `cartelle`: i nomi che il lettore sa aprire. Le due liste sembrano la
     stessa cosa e non lo sono — fra le cartelle ci sono i segnaposto delle
     lezioni variantizzate, che hanno il solo `_lezione.md`. Passandole, questo
     controllo dichiarava sani otto rimandi che nel lettore erano morti: diceva
     «esiste sul disco» mentre la domanda era «ci si arriva». */
  const rotti = espandiLib.wikilinkRotti(capitoliTesto, percorsiLib.nomiRaggiungibili(lezioni));

  let materiali = [];
  try { materiali = corpusLib().digest(v, corso).materiali; } catch (_) {}
  const nuovi = espandiLib.materialiNuovi(materiali, lezioni);

  return {
    /* ⚠️ `destinazioni`, non `lezioni`, e con i PERCORSI in mano: fra le cartelle
       ci sono i segnaposto delle lezioni variantizzate e le varianti che nessun
       percorso legge, e generare lì dentro è denaro speso per capitoli che non
       si vedranno. Chi decide non è il conteggio dei capitoli — è chi le legge. */
    lezioni: espandiLib.destinazioni(lezioni, percorsiLib.leggiTutti(v, corso)),
    prossimoLezione: espandiLib.prossimoLezione(cartelle),
    nuovi: nuovi.map((m) => ({ num: m.num, nome: m.nome, tipo: m.tipo, titolo: m.titolo })),
    nonElaborati: contaNonElaborati(v),
    rimandiRotti: rotti
  };
});

/**
 * I nomi con cui si possono citare le lezioni di un corso: l'elenco che il
 * modello riceve come «gli UNICI rimandi ammessi» e contro cui il validatore
 * controlla i `[[NN-slug]]`.
 *
 * ⚠️ Prima tornava le CARTELLE (`corsi.elencoLezioni`), ed è da lì che nasceva
 * il difetto: fra le cartelle ci sono i segnaposto senza capitoli delle lezioni
 * variantizzate, e ci sono le varianti stesse. Il modello copiava alla lettera
 * un nome dalla lista — come gli si chiede — e otteneva un rimando morto (il
 * segnaposto) o uno che scavalca il percorso attivo (la variante). Il
 * validatore approvava, perché guardava la stessa lista sbagliata. Non era il
 * modello a inventare: era la lista a mentire.
 */
function lezioniDelCorso(corso) {
  const v = vaultDir(); if (!v) return [];
  return percorsiLib.nomiRimandabili(corsiLib.elencoLezioni(v, corso));
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
ipcMain.handle('gen:stima', (e, { corso, folder, capitoli } = {}) => {
  const v = vaultDir(); if (!v) return { error: 'nessuna cartella StudIA' };
  const ai = sceltaAi();
  const n = (capitoli || []).length;
  // misura empirica: ~9k token in ingresso (materiale ritagliato + regole) e ~1,6k in uscita
  const costoUsd = providerAi.stimaCosto({ modello: ai && ai.modello, input: n * 9000, output: n * 1600 });
  return { capitoli: n, fornitore: ai && ai.fornitore, modello: ai && ai.modello, costoUsd };
});

// generazione: un capitolo per volta, si può fermare fra l'uno e l'altro
const genFermato = new Set();
ipcMain.on('gen:cancel', (e, { corso } = {}) => { if (corso) genFermato.add(corso); });

/**
 * Scrive i capitoli di una lezione dentro `cartella`.
 *
 * `cartella` non è sempre `lezione.folder`: per le varianti di percorso è
 * `03-delega--per-domande`, cioè una coppia lezione+indice. La lezione da cui si
 * legge (materiali, titolo, razionale) resta la stessa — cambia solo dove
 * atterrano i file. Il resto — ordine, riparazione, quarantena, aggiornamento
 * di `_lezione.md` — è identico, e sta qui in un punto solo perché due copie
 * della stessa procedura divergono sempre.
 */
async function scriviCapitoli({ v, corso, lezione, cartella, capitoli, accoda, ai, onProgress, onLog }) {
  const log = onLog || (() => {});
  const avanti = onProgress || (() => {});
  // espansione: i capitoli nuovi si aggiungono in coda, con i numeri successivi.
  // Rinumerare quelli già scritti spezzerebbe i rimandi [[NN-slug]] delle altre lezioni.
  const dirLezione = corsiLib.lezioneDir(v, corso, cartella);
  let filePresenti = []; try { filePresenti = fs.readdirSync(dirLezione); } catch (_) {}
  const daOrdine = accoda ? espandiLib.prossimoOrdine(filePresenti) : 1;
  const regole = regoleForma('generazione', corso);
  const materiali = corpusLib().digest(v, corso).materiali;
  const scritti = [], scarti = [];
  let uso = null, fermato = false;
  for (let i = 0; i < capitoli.length; i++) {
    if (genFermato.has(corso)) { fermato = true; log('Fermato su richiesta dopo ' + scritti.length + ' capitoli.'); break; }
    const cap = capitoli[i];
    const ordine = daOrdine + i;
    avanti({ indice: i + 1, totale: capitoli.length, titolo: cap.titolo, frazione: i / capitoli.length, ordine });
    const g = await generaLib.generaCapitolo(v, lezione, cap, ordine, daOrdine + capitoli.length - 1, materiali,
      { fornitore: ai.fornitore, modello: ai.modello, apiKey: ai.apiKey, lingua: ai.lingua },
      { regoleForma: regole,
        corso,                                 // il testo delle fonti si cerca solo dentro questo corso
        lezioni: lezioniDelCorso(corso),        // i rimandi devono puntare a lezioni che esistono
        precedente: i > 0 ? capitoli[i - 1].titolo : '',
        successivo: i + 1 < capitoli.length ? capitoli[i + 1].titolo : '' });
    uso = generaLib.sommaUso(uso, g.uso);
    if (g.errori.length || !g.dati) {
      const nome = g.dati ? generaLib.scriviScarto(v, corso, cartella, ordine, g.dati, g.errori) : '(nessuna risposta)';
      scarti.push({ ordine, titolo: cap.titolo, errori: g.errori, scarto: nome });
      log('✗ ' + cap.titolo + ' — ' + g.errori.join('; '));
      continue;                                   // un capitolo storto non ferma gli altri
    }
    // «fonte» nel frontmatter dice da quale materiale nasce il capitolo, col suo tipo vero
    const prima = cap.fonti && cap.fonti[0];
    const mPrima = prima && materiali.find((m) => m.num === prima.materiale);
    const w = generaLib.scriviCapitolo(v, corso, cartella, ordine, g.dati,
      { fonte: mPrima ? { tipo: mPrima.tipo, materiale: mPrima.num } : null });
    scritti.push({ ordine, titolo: g.dati.title, file: w.file });
    log('✓ ' + g.dati.title);
  }
  if (uso) registraUso(Object.assign({ fornitore: ai.fornitore, modello: ai.modello }, uso), corso, 'capitoli ' + cartella);
  // l'ordine dei capitoli nel _lezione.md riflette ciò che è stato davvero scritto
  try {
    const fileLezione = corsiLib.fileLezione(dirLezione);
    let raw = fs.readFileSync(fileLezione, 'utf-8');
    // accodando, l'ordine dichiarato dall'autore resta e i nuovi vanno in fondo
    // «prima» = i capitoli che c'erano quando la generazione è partita (il
    // frontmatter li tiene come testo, la cartella è la fonte affidabile)
    const prima = accoda ? espandiLib.capitoliDi(filePresenti) : [];
    const ordineFinale = espandiLib.ordineAggiornato(prima, scritti.map((x) => x.file));
    raw = mdser.upsertFmLine(raw, 'ordine_capitoli', 'ordine_capitoli: ' + mdser.yList(ordineFinale));
    raw = mdser.upsertFmLine(raw, 'status', 'status: ' + mdser.yq(scarti.length ? 'parziale' : 'generato'));
    writeAtomic(fileLezione, raw);
  } catch (err) {}
  return { scritti, scarti, uso, fermato };
}

ipcMain.on('gen:start', async (e, { corso, folder, capitoli, accoda } = {}) => {
  const send = (ch, d) => { try { e.sender.send(ch, d); } catch (_) {} };
  const v = vaultDir();
  if (!v || !corso) { send('gen:error', 'corso mancante'); return; }
  if (corsiLib.protetto(v, corso)) { send('gen:error', corsiLib.motivoRifiuto(corso)); return; }
  const ai = sceltaAi();
  if (!ai) { send('gen:error', 'Serve una chiave API per scrivere i capitoli.'); return; }
  const piano = propose.leggiPiano(v, corso);
  const lezione = lezioneDelPiano(piano, folder);
  if (!lezione) { send('gen:error', 'lezione non trovata nel piano'); return; }
  const lista = capitoli || [];
  if (!lista.length) { send('gen:error', 'nessun capitolo da scrivere'); return; }

  genFermato.delete(corso);
  try {
    const { scritti, scarti, uso } = await scriviCapitoli({
      v, corso, lezione, cartella: folder, capitoli: lista, accoda, ai,
      onProgress: (d) => send('gen:progress', d),
      onLog: (l) => send('gen:log', l)
    });
    const cc = (piano.lezioni || []).find((c) => c.folder === folder);
    if (cc) {
      /* Nel piano un capitolo si scrive {file, title}: la generazione lo produce
         come {ordine, titolo, file}. Passandolo così com'era, `scriviPiano`
         falliva la validazione e restituiva un errore che nessuno guardava —
         quindi il piano NON veniva mai aggiornato, la lezione restava in stato
         «approvato» e nell'elenco non compariva mai la spunta di «già fatto».
         Un errore silenzioso che si vedeva solo come una casella mancante. */
      cc.status = scarti.length ? 'parziale' : 'generato';
      const nuovi = scritti.map((x) => ({
        file: x.file, title: String(x.titolo || '').slice(0, 120), status: 'generato'
      }));
      cc.capitoli = (accoda ? (cc.capitoli || []) : []).concat(nuovi);
      const w = propose.scriviPiano(v, corso, piano);
      if (w && w.error) send('gen:log', '⚠ stato della lezione non salvato nel piano: ' + w.error);
    }
    send('gen:done', { scritti, scarti, uso });
  } catch (err) { send('gen:error', String((err && err.message) || err)); }
});

ipcMain.on('schede:build', async (e, { corso, rifai } = {}) => {
  const send = (ch, d) => { try { e.sender.send(ch, d); } catch (_) {} };
  const v = vaultDir();
  if (!v || !corso) { send('schede:error', 'corso mancante'); return; }
  if (corsiLib.protetto(v, corso)) { send('schede:error', corsiLib.motivoRifiuto(corso)); return; }
  const ai = sceltaAi();
  if (!ai) { send('schede:error', 'Serve una chiave API: l\'analisi dei materiali legge i contenuti con il modello.'); return; }
  try {
    /* Si analizza solo ciò che potrà entrare in un piano: una scheda si paga, e
       pagarla per un materiale che il piano non può accogliere è denaro speso
       per niente. Ciò che resta fuori viene detto, non taciuto. */
    const grezzo = corpusLib().digest(v, corso);
    const filtrato = corpusLib().perIlPiano(grezzo);
    const dg = filtrato.dg;
    if (!dg.totale) { send('schede:error', 'Nessun materiale elaborato: fai prima trascrizione e indicizzazione.'); return; }
    const escluso = corpusLib().avvisoEsclusi(filtrato.congelati, filtrato.senzaIndice);
    // il ruolo dichiarato viaggia col materiale: chi legge deve sapere se ha
    // davanti la dispensa ufficiale o gli appunti presi a lezione
    let ruoli = {};
    try { ruoli = mappaFonti(profiloLib.parse(fs.readFileSync(fileCorsoDi(corso), 'utf-8'))); } catch (err) {}
    const materiali = dg.materiali.map((m) => (ruoli[m.num] ? Object.assign({}, m, { ruolo: ruoli[m.num] }) : m));
    send('schede:progress', { fase: 'avvio', totale: dg.totale,
      msg: 'Leggo ' + dg.totale + ' materiali con ' + ai.fornitore + '…' + (escluso ? ' ' + escluso : '') });
    const esiti = await schedeLib.analizzaTutti(v, corso, materiali, {
      concorrenza: 3, rifai: !!rifai,
      ai: { fornitore: ai.fornitore, modello: ai.modello, apiKey: ai.apiKey, lingua: ai.lingua },
      onProgress: (ev) => send('schede:progress', ev)
    });
    registraUso(Object.assign({ fornitore: ai.fornitore, modello: ai.modello }, esiti.uso), corso, 'analisi materiali');
    send('schede:done', esiti);
  } catch (err) {
    send('schede:error', String((err && err.message) || err));
  }
});

/* ===================== MAPPE dell'utente (fase D) =========================
   Le mappe personali vivono in `Corsi/<id>/MAPPE/*.json`. Passano dal main
   e non dal preload — come i corsi e i materiali — così un solo processo
   tocca il vault e la scrittura atomica sta in un posto solo.

   ⚠️ Nessuna di queste chiamate passa da `corsiLib.assicuraScrivibile()`, ed
   è voluto: la protezione ferma la PIPELINE, non chi studia. Su TD74-DSA le
   mappe si devono poter fare e salvare, esattamente come gli appunti.

   La logica sta in lib/mappe.js — condivisa e coperta da test/mappe.js. Qui
   restano solo i legacci col vault corrente e la forma degli errori.
   ========================================================================= */
const mappeLib = require('./lib/mappe');

/** Il vault e il corso, o il motivo per cui non si può fare niente. */
function mappeDove(corso) {
  const v = vaultDir();
  if (!v) return { error: 'nessuna cartella StudIA impostata' };
  if (!corso) return { error: 'nessun corso scelto' };
  return { v };
}

// elenco leggero per il menu a tendina: i nodi non attraversano il ponte finché
// una mappa non viene davvero aperta
ipcMain.handle('mappe:elenco', (e, { corso } = {}) => {
  const d = mappeDove(corso); if (d.error) return { mappe: [], error: d.error };
  return mappeLib.elenco(d.v, corso);
});

ipcMain.handle('mappe:apri', (e, { corso, file } = {}) => {
  const d = mappeDove(corso); if (d.error) return { mappa: null, error: d.error };
  return mappeLib.apri(d.v, corso, file);
});

// `file` assente = mappa nuova: il nome nasce dal titolo e torna indietro, così
// il renderer sa su quale file continuerà a salvare
ipcMain.handle('mappe:salva', (e, { corso, file, mappa } = {}) => {
  const d = mappeDove(corso); if (d.error) return { error: d.error };
  return mappeLib.salva(d.v, corso, file, mappa || {});
});

ipcMain.handle('mappe:rimuovi', (e, { corso, file } = {}) => {
  const d = mappeDove(corso); if (d.error) return { ok: false, error: d.error };
  return { ok: mappeLib.rimuovi(d.v, corso, file), error: '' };
});

ipcMain.handle('mappe:rinomina', (e, { corso, file, titolo } = {}) => {
  const d = mappeDove(corso); if (d.error) return { error: d.error };
  return mappeLib.rinomina(d.v, corso, file, titolo);
});

// «Modifica una copia»: il grafo arriva già costruito dal renderer (è
// `MappaGenera.daCapitolo/daLezione`), qui si scrive soltanto. Il main non
// ricostruisce la vista generata: il parser dei capitoli è quello del lettore, e
// una seconda lettura del disco sarebbe una seconda verità.
ipcMain.handle('mappe:semina', (e, { corso, grafo, meta } = {}) => {
  const d = mappeDove(corso); if (d.error) return { error: d.error };
  return mappeLib.semina(d.v, corso, grafo || {}, meta || {});
});
