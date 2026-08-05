const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const url = require('url');
const mat = require('./lib/materiali');   // materiali del progetto, con ripiego sulle cartelle globali
const voceLib = require('./lib/voce');    // sintesi di sistema per la lettura ad alta voce

const cfg = ipcRenderer.sendSync('cfg:get') || {};
const vaultPath = cfg.vaultPath || null;

function loadCourses() {
  if (!vaultPath) return [];
  const dir = path.join(vaultPath, 'Corsi'); const out = [];
  try {
    for (const f of fs.readdirSync(dir)) {
      if (!f.toLowerCase().endsWith('.json')) continue;
      try { out.push(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'))); }
      catch (e) { console.error('Corso non valido:', f, e.message); }
    }
  } catch (e) {}
  return out;
}
function srcUrl(file) {
  if (!vaultPath) return '../Fonti/' + encodeURIComponent(file);
  for (const sub of ['Fonti', 'Media']) {
    const p = mat.trova(vaultPath, sub, file);
    if (p) return url.pathToFileURL(p).href;
  }
  return url.pathToFileURL(path.join(vaultPath, 'Fonti', file)).href;
}

// mappa "NN" -> nome file (per risolvere gli schemi video:NN / pdf:NN dei capitoli .md)
const MEDIA_EXT = ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.mpeg', '.mpg', '.m4a', '.mp3', '.wav', '.aac', '.flac'];
function listByNum(dirs, exts) {
  const map = {};
  for (const dir of dirs) {
    let files; try { files = fs.readdirSync(dir); } catch (e) { continue; }
    for (const f of files.sort()) {
      const ext = path.extname(f).toLowerCase();
      if (exts && !exts.includes(ext)) continue;
      const m = /^(\d{1,3})\b/.exec(f);
      if (m) { const k = m[1].padStart(2, '0'); if (!map[k]) map[k] = f; }
    }
  }
  return map;
}
/**
 * Le mappe NN → file di OGNI progetto, tenute separate.
 *
 * Una mappa sola per tutto il vault funzionava finché i numeri erano unici a
 * livello di vault. Ora che ogni progetto numera per conto suo, due progetti
 * possono avere entrambi un «01»: con una mappa unica `listByNum` terrebbe il
 * primo in ordine alfabetico, e un rimando `video:01` scritto in un corso
 * aprirebbe il video di un altro progetto — senza errore, senza avviso.
 */
function numeriPerProgetto() {
  const out = {};
  if (!vaultPath) return out;
  let ids; try { ids = fs.readdirSync(path.join(vaultPath, 'Progetti'), { withFileTypes: true }); } catch (e) { return out; }
  for (const d of ids) {
    if (!d.isDirectory()) continue;
    const media = mat.cartelle(vaultPath, 'Media', d.name, true)
      .concat(mat.cartelle(vaultPath, 'Fonti', d.name, true));
    out[d.name] = {
      media: listByNum(media, MEDIA_EXT),
      pdf: listByNum(mat.cartelle(vaultPath, 'Fonti', d.name, true), ['.pdf'])
    };
  }
  return out;
}

// carica i progetti-vault: Progetti/<progetto>/<corso>/NN-*.md (markdown grezzo, parsato dal renderer)
function loadProjects() {
  if (!vaultPath) return [];
  const root = path.join(vaultPath, 'Progetti'); const out = [];
  let pdirs; try { pdirs = fs.readdirSync(root, { withFileTypes: true }); } catch (e) { return []; }
  for (const pe of pdirs.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!pe.isDirectory()) continue;
    const pdir = path.join(root, pe.name);
    let progRaw = ''; try { progRaw = fs.readFileSync(path.join(pdir, '_progetto.md'), 'utf-8'); } catch (e) {}
    // i progetti-laboratorio non compaiono nel lettore: servono alla pipeline, non allo studio
    if (/^nascosto:\s*true\s*$/m.test(progRaw)) continue;
    const courses = [];
    // i corsi stanno in CORSI/; i progetti fatti prima li hanno nella radice
    const cbase = fs.existsSync(path.join(pdir, 'CORSI')) ? path.join(pdir, 'CORSI') : pdir;
    let cdirs; try { cdirs = fs.readdirSync(cbase, { withFileTypes: true }); } catch (e) { cdirs = []; }
    const NON_CORSI = ['APPUNTI', mat.CARTELLA, '_lavorazione', 'CORSI', '_scarti'];
    for (const ce of cdirs.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!ce.isDirectory() || NON_CORSI.includes(ce.name)) continue;
      const cdir = path.join(cbase, ce.name);
      let corsoRaw = ''; try { corsoRaw = fs.readFileSync(path.join(cdir, '_corso.md'), 'utf-8'); } catch (e) {}
      const chapters = [];
      let files; try { files = fs.readdirSync(cdir); } catch (e) { files = []; }
      for (const f of files.filter(x => /^\d+.*\.md$/.test(x)).sort()) {
        try { chapters.push({ file: f, raw: fs.readFileSync(path.join(cdir, f), 'utf-8') }); } catch (e) {}
      }
      if (chapters.length) courses.push({ folder: ce.name, corsoRaw, chapters });
    }
    if (courses.length) out.push({ id: pe.name, progRaw, courses });
  }
  return out;
}

/* ---------------- APPUNTI (note personali dell'utente) ----------------
   La logica sta in lib/appunti.js — condivisa e coperta dai test. Qui restano
   solo i legacci col vault corrente. */
const appunti = require('./lib/appunti');

/* ---------------- PROFILO DI APPRENDIMENTO + PREFERENZE ----------------
   Profilo persona -> <vault>/_profilo.md (frontmatter con i campi a scelta multipla,
   corpo con i due campi liberi). Preferenze tecniche (modelli AI) -> <vault>/.studia/prefs.json.
   Entrambi leggibili dal main process quando arriverà la pipeline di generazione. */
// lib/ condivise: UN solo serializzatore e UN solo lettore del profilo, usati anche dal main
let mdser = null, profiloLib = null, validate = null;
try { mdser = require(path.join(__dirname, 'lib', 'mdser.js')); } catch (e) { console.error('mdser non caricato:', e.message); }
try { profiloLib = require(path.join(__dirname, 'lib', 'profilo.js')); } catch (e) { console.error('profilo non caricato:', e.message); }
try { validate = require(path.join(__dirname, 'lib', 'validate.js')); } catch (e) { console.error('validate non caricato:', e.message); }

function profiloRead() {
  if (!vaultPath || !profiloLib) return {};
  return profiloLib.load(vaultPath);
}
function profiloSave(o) {
  if (!vaultPath) throw new Error('nessuna cartella vault impostata');
  if (!profiloLib) throw new Error('lib/profilo.js non disponibile');
  // validazione dei vocabolari prima di scrivere: un profilo fuori schema
  // romperebbe directives() a valle, quando l'errore non sarebbe più attribuibile
  if (validate) {
    const perSchema = {
      schema: 1, tipo: 'profilo', bisogni: o.bisogni || [], bisogni_altro: o.bisogniAltro || '',
      stile_progetto: o.stileProgetto, stile_corsi: o.stileCorsi, stile_capitoli: o.stileCapitoli,
      granularita: o.granularita, capitoli_brevi: o.capitoliBrevi, quiz: o.quiz,
      glossario: o.glossario, esempi_concreti: o.esempiConcreti, approfondimenti: o.approfondimenti,
      comeImparo: o.comeImparo || '', cosaAffatica: o.cosaAffatica || ''
    };
    Object.keys(perSchema).forEach(k => perSchema[k] === undefined && delete perSchema[k]);
    const r = validate.validateProfilo(perSchema);
    if (!r.ok) throw new Error('profilo non valido: ' + r.errors.slice(0, 3).join(' · '));
  }
  return profiloLib.save(vaultPath, o || {});
}
function prefsPath() { return path.join(vaultPath, '.studia', 'prefs.json'); }
function prefsRead() { try { return JSON.parse(fs.readFileSync(prefsPath(), 'utf-8')); } catch (e) { return {}; } }
function prefsSave(o) {
  if (!vaultPath) throw new Error('nessuna cartella vault impostata');
  fs.mkdirSync(path.dirname(prefsPath()), { recursive: true });
  fs.writeFileSync(prefsPath(), JSON.stringify(o || {}, null, 2), 'utf-8');
  return true;
}
contextBridge.exposeInMainWorld('vault', {
  hasElectron: true,
  path: vaultPath,
  courses: loadCourses(),
  projects: loadProjects(),
  // gli schemi video:NN / pdf:NN si risolvono prima sui materiali dei progetti, poi su quelli del vault
  // globali: ripiego per i vault a corpus unico, dove i numeri non hanno progetto
  mediaByNum: vaultPath ? listByNum(mat.cartelle(vaultPath, 'Media').concat(mat.cartelle(vaultPath, 'Fonti')), MEDIA_EXT) : {},
  pdfByNum: vaultPath ? listByNum(mat.cartelle(vaultPath, 'Fonti'), ['.pdf']) : {},
  numeriPerProgetto: numeriPerProgetto(),   // e queste sono quelle che contano
  srcUrl: srcUrl,
  choose: () => ipcRenderer.invoke('vault:choose'),
  media: { list: () => ipcRenderer.invoke('media:list') },
  // con `progetto` l'elenco è quello del progetto, non di tutto il vault
  corpus: { list: (progetto) => ipcRenderer.invoke('corpus:list', { progetto }) },
  schede: {
    stato: (progetto) => ipcRenderer.invoke('schede:stato', { progetto }),
    build: (progetto, rifai) => ipcRenderer.send('schede:build', { progetto, rifai }),
    onProgress: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('schede:progress', h); return () => ipcRenderer.removeListener('schede:progress', h); },
    onDone: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('schede:done', h); return () => ipcRenderer.removeListener('schede:done', h); },
    onError: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('schede:error', h); return () => ipcRenderer.removeListener('schede:error', h); }
  },
  plan: {
    get: (progetto) => ipcRenderer.invoke('plan:get', { progetto }),
    save: (progetto, piano) => ipcRenderer.invoke('plan:save', { progetto, piano }),
    approve: (progetto) => ipcRenderer.invoke('plan:approve', { progetto }),
    propose: (progetto, granularita) => ipcRenderer.send('plan:propose', { progetto, granularita }),
    // i canali nuovi restituiscono la funzione per disiscriversi (a differenza di ingest.on*)
    onProgress: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('plan:progress', h); return () => ipcRenderer.removeListener('plan:progress', h); },
    onDone: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('plan:done', h); return () => ipcRenderer.removeListener('plan:done', h); },
    onError: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('plan:error', h); return () => ipcRenderer.removeListener('plan:error', h); }
  },
  ingest: {
    start: (opts) => ipcRenderer.send('ingest:start', opts || {}),
    onProgress: (cb) => ipcRenderer.on('ingest:progress', (e, d) => cb(d)),
    onDone: (cb) => ipcRenderer.on('ingest:done', (e, d) => cb(d)),
    onError: (cb) => ipcRenderer.on('ingest:error', (e, d) => cb(d)),
    onLog: (cb) => ipcRenderer.on('ingest:log', (e, d) => cb(d))
  },
  keys: {
    status: () => ipcRenderer.invoke('keys:status'),
    set: (provider, value) => ipcRenderer.invoke('keys:set', { provider, value }),
    clear: (provider) => ipcRenderer.invoke('keys:clear', { provider })
  },
  costs: {
    summary: () => ipcRenderer.invoke('costs:summary'),
    log: (entry) => ipcRenderer.invoke('costs:log', entry)
  },
  notes: {
    // leggi() dice anche che cosa è andato storto; list() resta per compatibilità
    leggi: (projectId) => vaultPath ? appunti.read(vaultPath, projectId) : { notes: [], error: 'nessuna cartella vault impostata' },
    list: (projectId) => vaultPath ? appunti.read(vaultPath, projectId).notes : [],
    save: (projectId, file, meta, body) => {
      try {
        if (!vaultPath) throw new Error('nessuna cartella vault impostata');
        return appunti.save(vaultPath, projectId, file, meta || {}, body || '');
      } catch (e) { return { error: e.message }; }
    },
    remove: (projectId, file) => { try { return appunti.remove(vaultPath, projectId, file); } catch (e) { return false; } },
    reindex: (projectId) => { try { return appunti.reindex(vaultPath, projectId); } catch (e) { return 0; } },
    indexPath: (projectId) => { try { return path.join(appunti.dir(vaultPath, projectId), '_indice.md'); } catch (e) { return ''; } }
  },
  profile: {
    read: () => { try { return profiloRead(); } catch (e) { return {}; } },
    save: (o) => { try { profiloSave(o); return { ok: true }; } catch (e) { return { error: e.message }; } }
  },
  prefs: {
    read: () => { try { return prefsRead(); } catch (e) { return {}; } },
    save: (o) => { try { prefsSave(o); return { ok: true }; } catch (e) { return { error: e.message }; } }
  },
  // lettura ad alta voce con la sintesi di sistema: vede anche le voci premium,
  // che a Web Speech dentro Chromium non arrivano
  voce: {
    disponibile: voceLib.disponibile(),
    elenco: () => ipcRenderer.invoke('voce:elenco'),
    // sintetizza un blocco su file e ne restituisce l'URL: la riproduzione la fa
    // il renderer con un <audio>, così l'avvio di say non cade fra un blocco e l'altro
    rendi: (segmenti, nome, velocita, chiave) => ipcRenderer.invoke('voce:rendi', { segmenti, voce: nome, velocita, chiave }),
    scarta: () => ipcRenderer.invoke('voce:scarta')
  },
  // progetti, brief e materiali passano dal main: scrittura atomica + un solo posto che tocca il vault
  project: {
    create: (nome, brief) => ipcRenderer.invoke('project:create', { nome, brief }),
    list: () => ipcRenderer.invoke('project:list'),
    // un progetto in un file solo: per passarlo a qualcuno che non ha questo vault
    export: (progetto, appunti) => ipcRenderer.invoke('project:export', { progetto, appunti }),
    import: () => ipcRenderer.invoke('project:import'),
    // espansione di un progetto già finito: che c'è di nuovo, e che cosa è rotto
    expandStato: (progetto) => ipcRenderer.invoke('expand:stato', { progetto }),
    onExportProgress: (cb) => {
      const h = (e, d) => cb(d);
      ipcRenderer.on('project:export:progress', h);
      return () => ipcRenderer.removeListener('project:export:progress', h);
    }
  },
  brief: {
    get: (progetto) => ipcRenderer.invoke('brief:get', { progetto }),
    set: (progetto, brief) => ipcRenderer.invoke('brief:set', { progetto, brief })
  },
  // ruolo dichiarato delle fonti: mappa numero materiale → ruolo
  fonti: {
    set: (progetto, fonti) => ipcRenderer.invoke('fonti:set', { progetto, fonti })
  },
  // Claude Code come motore: nessuna chiave, si usa l'abbonamento
  claudecode: {
    diagnosi: () => ipcRenderer.invoke('claudecode:diagnosi')
  },
  // quali modelli esistono davvero oggi, chiesti all'API del fornitore
  modelli: {
    aggiorna: (fornitore) => ipcRenderer.invoke('models:refresh', { fornitore }),
    cache: (fornitore) => ipcRenderer.invoke('models:cache', { fornitore })
  },
  // M5 — scalette alternative e scrittura dei capitoli
  scaletta: {
    proponi: (progetto, folder, nCapitoli) => ipcRenderer.invoke('scaletta:proponi', { progetto, folder, nCapitoli }),
    // tutte insieme, per il composer: una chiamata per corso, con avanzamento
    tutte: (progetto, opts) => ipcRenderer.send('scalette:tutte', Object.assign({ progetto }, opts || {})),
    onProgress: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('scalette:progress', h); return () => ipcRenderer.removeListener('scalette:progress', h); },
    onDone: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('scalette:done', h); return () => ipcRenderer.removeListener('scalette:done', h); },
    onError: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('scalette:error', h); return () => ipcRenderer.removeListener('scalette:error', h); }
  },
  /* Composer degli indici: righe = corsi, colonne = indici proposti, e gli otto
     personaggi che si trascinano sulle card. Lo stato arriva in un colpo solo —
     piano, scalette in cache, percorsi già salvati — perché il composer si apre
     sempre su un progetto intero, mai su un corso. */
  composer: {
    stato: (progetto) => ipcRenderer.invoke('composer:stato', { progetto })
  },
  percorsi: {
    list: (progetto) => ipcRenderer.invoke('percorsi:list', { progetto }),
    save: (progetto, percorsi) => ipcRenderer.invoke('percorsi:save', { progetto, percorsi }),
    // le coppie corso+indice: quante sono, quanto è già scritto, quanto costa il resto
    coppie: (progetto) => ipcRenderer.invoke('percorsi:coppie', { progetto }),
    // la scrittura vera: una cartella per coppia, `03-delega--per-domande`
    capitoli: (progetto, opts) => ipcRenderer.send('percorsi:capitoli', Object.assign({ progetto }, opts || {})),
    // si ferma con lo stesso interruttore della generazione singola: la coda è una sola
    ferma: (progetto) => ipcRenderer.send('gen:cancel', { progetto }),
    onCapProgress: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('percorsi:cap:progress', h); return () => ipcRenderer.removeListener('percorsi:cap:progress', h); },
    onCapLog: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('percorsi:cap:log', h); return () => ipcRenderer.removeListener('percorsi:cap:log', h); },
    onCapDone: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('percorsi:cap:done', h); return () => ipcRenderer.removeListener('percorsi:cap:done', h); },
    onCapError: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('percorsi:cap:error', h); return () => ipcRenderer.removeListener('percorsi:cap:error', h); }
  },
  gen: {
    stima: (progetto, folder, capitoli) => ipcRenderer.invoke('gen:stima', { progetto, folder, capitoli }),
    // accoda: i capitoli nuovi vanno in fondo, senza rinumerare quelli già scritti
    start: (progetto, folder, capitoli, accoda) => ipcRenderer.send('gen:start', { progetto, folder, capitoli, accoda: !!accoda }),
    cancel: (progetto) => ipcRenderer.send('gen:cancel', { progetto }),
    // ogni ascolto restituisce la funzione per smettere di ascoltare
    onProgress: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('gen:progress', h); return () => ipcRenderer.removeListener('gen:progress', h); },
    onLog: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('gen:log', h); return () => ipcRenderer.removeListener('gen:log', h); },
    onDone: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('gen:done', h); return () => ipcRenderer.removeListener('gen:done', h); },
    onError: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('gen:error', h); return () => ipcRenderer.removeListener('gen:error', h); }
  },
  files: {
    pick: () => ipcRenderer.invoke('files:pick'),
    import: (paths) => ipcRenderer.invoke('files:import', { paths }),
    pathOf: (file) => { try { return require('electron').webUtils.getPathForFile(file); } catch (e) { return file && file.path ? file.path : null; } }
  },
  // importazione di un'intera cartella: prima si guarda, poi si copia
  cartella: {
    pick: () => ipcRenderer.invoke('import:pick'),
    // con `progetto` i materiali atterrano dentro di lui e la numerazione riparte da 01
    scan: (cartella, forzati, progetto) => ipcRenderer.invoke('import:scan', { cartella, forzati, progetto }),
    apply: (cartella, forzati, progetto) => ipcRenderer.invoke('import:apply', { cartella, forzati, progetto })
  },
  // com'è fatta la macchina: motore AI, Python, spazio, modello di trascrizione
  ambiente: {
    rileva: () => ipcRenderer.invoke('ambiente:rileva')
  },
  /* La lettura avanzata dei documenti: si installa se si vuole, e l'app
     funziona identica senza. `installa` è un flusso lungo con avanzamento,
     quindi eventi e non una promessa che tace per un quarto d'ora. */
  ocr: {
    stato: () => ipcRenderer.invoke('ocr:stato'),
    // quante pagine e quante ore, PDF per PDF: si vede prima di installare
    stima: (progetto) => ipcRenderer.invoke('ocr:stima', { progetto }),
    installa: (conModello) => ipcRenderer.send('ocr:installa', { conModello: conModello !== false }),
    rimuovi: () => ipcRenderer.invoke('ocr:rimuovi'),
    // la rilettura vera: ore di lavoro, quindi eventi e un modo per fermarla
    leggi: (progetto, scelte) => ipcRenderer.send('ocr:leggi', { progetto, scelte }),
    ferma: (progetto) => ipcRenderer.send('ocr:ferma', { progetto }),
    onLeggiProgress: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('ocr:leggiProgress', h); return () => ipcRenderer.removeListener('ocr:leggiProgress', h); },
    onLeggiLog: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('ocr:leggiLog', h); return () => ipcRenderer.removeListener('ocr:leggiLog', h); },
    onLeggiDone: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('ocr:leggiDone', h); return () => ipcRenderer.removeListener('ocr:leggiDone', h); },
    onLeggiError: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('ocr:leggiError', h); return () => ipcRenderer.removeListener('ocr:leggiError', h); },
    onProgress: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('ocr:progress', h); return () => ipcRenderer.removeListener('ocr:progress', h); },
    onLog: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('ocr:log', h); return () => ipcRenderer.removeListener('ocr:log', h); },
    onDone: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('ocr:done', h); return () => ipcRenderer.removeListener('ocr:done', h); },
    onError: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('ocr:error', h); return () => ipcRenderer.removeListener('ocr:error', h); }
  },
  onboarding: {
    skipped: () => ipcRenderer.invoke('profile:skipped'),
    skip: () => ipcRenderer.invoke('profile:skip'),
    // il primo avvio è una cosa sola, il profilo un'altra: due flag distinti
    stato: () => ipcRenderer.invoke('onboarding:stato'),
    fatto: (v) => ipcRenderer.invoke('onboarding:fatto', { fatto: v !== false })
  }
});
