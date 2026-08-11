const { contextBridge, ipcRenderer, webUtils } = require('electron');
const fs = require('fs');
const path = require('path');
const url = require('url');
const mat = require('./lib/materiali');   // materiali del corso, con ripiego sulle cartelle globali
const corsiLib = require('./lib/corsi');  // dove stanno corsi e lezioni, anche nei vault mai migrati
const evidenzeLib = require('./lib/evidenze'); // le parole chiave evidenziate, accanto agli appunti
const albumLib = require('./lib/album');  // le immagini ritagliate dai documenti, per corso
const voceLib = require('./lib/voce');    // sintesi di sistema per la lettura ad alta voce

const cfg = ipcRenderer.sendSync('cfg:get') || {};
const vaultPath = cfg.vaultPath || null;

function loadLessons() {
  if (!vaultPath) return [];
  const dir = path.join(vaultPath, 'Lezioni'); const out = [];
  try {
    for (const f of fs.readdirSync(dir)) {
      if (!f.toLowerCase().endsWith('.json')) continue;
      try { out.push(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'))); }
      catch (e) { console.error('Lezione non valida:', f, e.message); }
    }
  } catch (e) {}
  return out;
}
/* ⚠️ `Figure` sta nell'elenco perché i ritagli dei PDF sono file come gli altri e
   il lettore li chiede per nome, esattamente come chiede un video o un PDF. Senza
   questa voce un capitolo con una figura mostrerebbe una casella vuota — e la
   causa (una cartella non cercata) non si vedrebbe da nessuna parte. */
function srcUrl(file) {
  if (!vaultPath) return '../Fonti/' + encodeURIComponent(file);
  for (const sub of ['Fonti', 'Media', 'Figure']) {
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
 * Le mappe NN → file di OGNI corso, tenute separate.
 *
 * Una mappa sola per tutto il vault funzionava finché i numeri erano unici a
 * livello di vault. Ora che ogni corso numera per conto suo, due corsi
 * possono avere entrambi un «01»: con una mappa unica `listByNum` terrebbe il
 * primo in ordine alfabetico, e un rimando `video:01` scritto in una lezione
 * aprirebbe il video di un altro corso — senza errore, senza avviso.
 */
function numeriPerCorso() {
  const out = {};
  if (!vaultPath) return out;
  /* ⚠️ Le DUE radici, come ovunque: un documento dentro uno zaino ha un numero
     (`01 dispensa.pdf`) esattamente come quelli di un corso, ed è quel numero a
     rendere apribile un rimando `pdf:01#p=7`. Guardando solo `Corsi/`, nello
     zaino la mappa restava vuota: le parole chiave e i frammenti finivano negli
     appunti come testo nudo, senza link, e non si capiva perché. */
  const ids = [];
  for (const radice of [corsiLib.radice(vaultPath), path.join(vaultPath, corsiLib.RADICE_ZAINI)]) {
    try { ids.push(...fs.readdirSync(radice, { withFileTypes: true })); } catch (e) { /* non c'è */ }
  }
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

// carica i corsi del vault: Corsi/<corso>/<lezione>/NN-*.md (markdown grezzo, parsato dal renderer)
function loadCourses() {
  if (!vaultPath) return [];
  const root = corsiLib.radice(vaultPath); const out = [];
  let cdirs; try { cdirs = fs.readdirSync(root, { withFileTypes: true }); } catch (e) { return []; }
  for (const pe of cdirs.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!pe.isDirectory()) continue;
    const cdir = path.join(root, pe.name);
    let progRaw = ''; try { progRaw = fs.readFileSync(corsiLib.fileCorso(vaultPath, pe.name), 'utf-8'); } catch (err) {}
    // i corsi-laboratorio non compaiono nel lettore: servono alla pipeline, non allo studio
    if (/^nascosto:\s*true\s*$/m.test(progRaw)) continue;
    const lessons = [];
    // le lezioni stanno in LEZIONI/; i corsi fatti prima le tengono nella radice
    const lbase = corsiLib.cartellaLezioni(vaultPath, pe.name);
    let ldirs; try { ldirs = fs.readdirSync(lbase, { withFileTypes: true }); } catch (e) { ldirs = []; }
    /* L'elenco sta in lib/corsi: teneva qui una copia più corta, e ogni cartella
       dell'utente che mancava (PERCORSI, MAPPE) diventava una lezione fantasma. */
    const NON_LEZIONI = corsiLib.NON_LEZIONI.concat([mat.CARTELLA]);
    for (const ce of ldirs.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!ce.isDirectory() || NON_LEZIONI.includes(ce.name)) continue;
      const ldir = path.join(lbase, ce.name);
      let lezioneRaw = ''; try { lezioneRaw = fs.readFileSync(corsiLib.fileLezione(ldir), 'utf-8'); } catch (err) {}
      const chapters = [];
      let files; try { files = fs.readdirSync(ldir); } catch (e) { files = []; }
      for (const f of files.filter(x => /^\d+.*\.md$/.test(x)).sort()) {
        try { chapters.push({ file: f, raw: fs.readFileSync(path.join(ldir, f), 'utf-8') }); } catch (e) {}
      }
      if (chapters.length) lessons.push({ folder: ce.name, lezioneRaw, chapters });
    }
    if (lessons.length) out.push({ id: pe.name, progRaw, lessons });
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
      stile_corso: o.stileCorso, stile_lezioni: o.stileLezioni, stile_capitoli: o.stileCapitoli,
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
  lessons: loadLessons(),
  courses: loadCourses(),
  // gli schemi video:NN / pdf:NN si risolvono prima sui materiali dei corsi, poi su quelli del vault
  // globali: ripiego per i vault a corpus unico, dove i numeri non hanno corso
  mediaByNum: vaultPath ? listByNum(mat.cartelle(vaultPath, 'Media').concat(mat.cartelle(vaultPath, 'Fonti')), MEDIA_EXT) : {},
  pdfByNum: vaultPath ? listByNum(mat.cartelle(vaultPath, 'Fonti'), ['.pdf']) : {},
  numeriPerCorso: numeriPerCorso(),   // e queste sono quelle che contano
  srcUrl: srcUrl,
  /* Mostra un file nel Finder. Prende ciò che il renderer ha per mano — un
     `file://` — e la conversione a percorso la fa il main, insieme al controllo
     che stia dentro il vault. */
  reveal: (quale) => ipcRenderer.invoke('file:reveal', quale),
  /* Dov'è il vault, in chiaro e in sola lettura. Serve a due cose concrete: le
     prove sull'app viva, che devono poter verificare di stare lavorando sulla
     COPIA e non sul vault vero (prima lo leggevano dalla config dell'utente —
     e con l'istanza di prova che ha una config sua quella lettura mentirebbe),
     e i comandi che mostrano un file nel Finder. Non è una porta di scrittura:
     è una stringa. */
  vaultPath: vaultPath,
  choose: () => ipcRenderer.invoke('vault:choose'),
  media: { list: () => ipcRenderer.invoke('media:list') },
  // con `corso` l'elenco è quello del corso, non di tutto il vault
  corpus: { list: (corso) => ipcRenderer.invoke('corpus:list', { corso }) },
  schede: {
    stato: (corso) => ipcRenderer.invoke('schede:stato', { corso }),
    build: (corso, rifai) => ipcRenderer.send('schede:build', { corso, rifai }),
    onProgress: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('schede:progress', h); return () => ipcRenderer.removeListener('schede:progress', h); },
    onDone: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('schede:done', h); return () => ipcRenderer.removeListener('schede:done', h); },
    onError: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('schede:error', h); return () => ipcRenderer.removeListener('schede:error', h); }
  },
  plan: {
    get: (corso) => ipcRenderer.invoke('plan:get', { corso }),
    save: (corso, piano) => ipcRenderer.invoke('plan:save', { corso, piano }),
    approve: (corso) => ipcRenderer.invoke('plan:approve', { corso }),
    propose: (corso, granularita) => ipcRenderer.send('plan:propose', { corso, granularita }),
    // correzioni al taglio delle lezioni, dal composer: sposta/unisci/separa/rinomina
    comando: (corso, azione, indice, valore) => ipcRenderer.invoke('plan:comando', { corso, azione, indice, valore }),
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
    leggi: (courseId) => vaultPath ? appunti.read(vaultPath, courseId) : { notes: [], error: 'nessuna cartella vault impostata' },
    list: (courseId) => vaultPath ? appunti.read(vaultPath, courseId).notes : [],
    save: (courseId, file, meta, body) => {
      try {
        if (!vaultPath) throw new Error('nessuna cartella vault impostata');
        return appunti.save(vaultPath, courseId, file, meta || {}, body || '');
      } catch (e) { return { error: e.message }; }
    },
    /* Rinomina: cambia il titolo DENTRO il file E il nome del file, che devono
       restare d'accordo. Torna `{ file, nota }` — e `file` è il nome VERO che
       l'appunto ha su disco, che quando cambiano le sole maiuscole NON è quello
       chiesto: chi chiama deve usare questo per riaprirlo.
       Sincrona come tutto ciò che sta in `notes`, e non è una svista: la
       ragione è quella scritta qui sotto sulle evidenze — il sincrono è ciò
       che permette di scrivere dentro `beforeunload`, dove una `invoke` non
       farebbe in tempo a tornare. Perciò niente canale IPC nemmeno qui. */
    rename: (courseId, file, titolo) => {
      try {
        if (!vaultPath) throw new Error('nessuna cartella vault impostata');
        return appunti.rinomina(vaultPath, courseId, file, titolo);
      } catch (e) { return { error: e.message }; }
    },
    remove: (courseId, file) => { try { return appunti.remove(vaultPath, courseId, file); } catch (e) { return false; } },
    reindex: (courseId) => { try { return appunti.reindex(vaultPath, courseId); } catch (e) { return 0; } },
    indexPath: (courseId) => { try { return path.join(appunti.dir(vaultPath, courseId), '_indice.md'); } catch (e) { return ''; } }
  },
  /* Le parole chiave evidenziate nel testo (APPUNTI/_evidenze.json).
     Sincrone come gli appunti e per la stessa ragione: si scrivono a gesto
     dell'utente, una alla volta, e la scrittura sincrona è ciò che permette di
     salvarle dentro `beforeunload` — cosa che alle mappe, che passano da
     `invoke`, è preclusa perché la finestra si chiude prima della risposta. */
  evidenze: {
    leggi: (courseId) => {
      if (!vaultPath) return { evidenze: [], error: 'nessuna cartella vault impostata' };
      try { return evidenzeLib.leggi(vaultPath, courseId); }
      catch (e) { return { evidenze: [], error: e.message }; }
    },
    salva: (courseId, elenco) => {
      if (!vaultPath) return { evidenze: [], error: 'nessuna cartella vault impostata' };
      try { return evidenzeLib.salva(vaultPath, courseId, elenco); }
      catch (e) { return { evidenze: [], error: e.message }; }
    },
    aggiungi: (courseId, voce) => {
      if (!vaultPath) return { evidenza: null, evidenze: [], error: 'nessuna cartella vault impostata' };
      try { return evidenzeLib.aggiungi(vaultPath, courseId, voce); }
      catch (e) { return { evidenza: null, evidenze: [], error: e.message }; }
    },
    rimuovi: (courseId, id) => {
      if (!vaultPath) return { tolte: 0, evidenze: [], error: 'nessuna cartella vault impostata' };
      try { return evidenzeLib.rimuovi(vaultPath, courseId, id); }
      catch (e) { return { tolte: 0, evidenze: [], error: e.message }; }
    },
    colora: (courseId, id, colore) => {
      if (!vaultPath) return { evidenza: null, evidenze: [], error: 'nessuna cartella vault impostata' };
      try { return evidenzeLib.colora(vaultPath, courseId, id, colore); }
      catch (e) { return { evidenza: null, evidenze: [], error: e.message }; }
    }
  },
  /* L'album delle immagini ritagliate dai documenti (ALBUM/ + _album.json).
     Sincrono e diretto come `notes` e `evidenze`, e per la stessa ragione detta
     su `notes.rename`: si scrive a gesto dell'utente, una immagine alla volta, e
     il sincrono è ciò che permette di salvare dentro `beforeunload` — dove una
     `invoke` non farebbe in tempo a tornare. Nessun canale IPC nuovo, quindi:
     l'album sta dalla parte degli appunti, non delle mappe.
     Ogni metodo torna un oggetto con `error`: l'immagine che non si è salvata
     deve poterlo dire, invece di fallire in silenzio. */
  album: {
    elenco: (corso) => {
      if (!vaultPath) return { voci: [], error: 'nessuna cartella vault impostata' };
      try { return albumLib.elenco(vaultPath, corso); }
      catch (e) { return { voci: [], error: e.message }; }
    },
    /* `voce` è `{ materiale, pagina, rect, didascalia, dati }`, dove `rect` è in
       coordinate della PAGINA (non dello schermo: a un altro zoom indicherebbe
       un altro punto) e `dati` è il data URL del canvas. Se quell'area era già
       stata ritagliata torna quella di prima con `giaCera: true`. */
    salva: (corso, voce) => {
      if (!vaultPath) return { voce: null, giaCera: false, error: 'nessuna cartella vault impostata' };
      try { return albumLib.salva(vaultPath, corso, voce); }
      catch (e) { return { voce: null, giaCera: false, error: e.message }; }
    },
    // cambia la DIDASCALIA: il nome del file resta quello, ed è l'identità a cui
    // puntano gli appunti (`album:<id>`) e i nodi delle mappe
    rinomina: (corso, id, didascalia) => {
      if (!vaultPath) return { voce: null, error: 'nessuna cartella vault impostata' };
      try { return albumLib.rinomina(vaultPath, corso, id, didascalia); }
      catch (e) { return { voce: null, error: e.message }; }
    },
    // dove compare quest'immagine: serve a chiederlo PRIMA di cancellare
    usi: (corso, id) => {
      if (!vaultPath) return { appunti: [], mappe: [], illeggibili: [], quanti: 0, error: 'nessuna cartella vault impostata' };
      try { return albumLib.usi(vaultPath, corso, id); }
      catch (e) { return { appunti: [], mappe: [], illeggibili: [], quanti: 0, error: e.message }; }
    },
    // rifiuta se l'immagine è usata: si passa con `{ insisti: true }`, che è una
    // scelta dell'utente e non un valore di fabbrica
    rimuovi: (corso, id, opt) => {
      if (!vaultPath) return { tolto: false, usi: null, error: 'nessuna cartella vault impostata' };
      try { return albumLib.rimuovi(vaultPath, corso, id, opt); }
      catch (e) { return { tolto: false, usi: null, error: e.message }; }
    },
    /* La URL con cui `<img>` mostra l'immagine, come `srcUrl` fa per i materiali.
       ⚠️ Vuole anche il corso, a differenza della firma abbozzata nel piano:
       l'album è di un corso, e un id da solo non individua nessun file — il nome
       del file lo dà l'indice di QUEL corso. */
    srcUrl: (corso, id) => {
      if (!vaultPath) return '';
      try {
        const p = albumLib.percorsoImmagine(vaultPath, corso, id);
        return p ? url.pathToFileURL(p).href : '';
      } catch (e) { return ''; }
    }
  },
  /* Le mappe dell'utente (MAPPE/*.json). A differenza degli appunti passano dal
     main: una mappa la si salva mentre la si sta modificando, e un solo processo
     che tocca il vault è ciò che rende la scrittura atomica una garanzia e non
     una speranza. Tutti i metodi tornano un oggetto con `error`: la mappa che
     non si è salvata deve poterlo dire, non fallire in silenzio. */
  mappe: {
    // elenco leggero (titoli e conteggi): i nodi arrivano solo con apri()
    elenco: (corso) => ipcRenderer.invoke('mappe:elenco', { corso }),
    apri: (corso, file) => ipcRenderer.invoke('mappe:apri', { corso, file }),
    // `file` assente = mappa nuova; il nome scelto torna in `{ file }`
    salva: (corso, file, mappa) => ipcRenderer.invoke('mappe:salva', { corso, file, mappa }),
    rimuovi: (corso, file) => ipcRenderer.invoke('mappe:rimuovi', { corso, file }),
    // rinomina cambia il titolo dentro la mappa E il nome del file: restano d'accordo
    rinomina: (corso, file, titolo) => ipcRenderer.invoke('mappe:rinomina', { corso, file, titolo }),
    // «Modifica una copia»: il grafo è quello di MappaGenera.daCapitolo/daLezione
    semina: (corso, grafo, meta) => ipcRenderer.invoke('mappe:semina', { corso, grafo, meta })
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
  // corsi, brief e materiali passano dal main: scrittura atomica + un solo posto che tocca il vault
  course: {
    create: (nome, brief) => ipcRenderer.invoke('course:create', { nome, brief }),
    list: () => ipcRenderer.invoke('course:list'),
    // un corso in un file solo: per passarlo a qualcuno che non ha questo vault
    export: (corso, appunti) => ipcRenderer.invoke('course:export', { corso, appunti }),
    import: () => ipcRenderer.invoke('course:import'),
    // espansione di un corso già finito: che c'è di nuovo, e che cosa è rotto
    expandStato: (corso) => ipcRenderer.invoke('expand:stato', { corso }),
    onExportProgress: (cb) => {
      const h = (e, d) => cb(d);
      ipcRenderer.on('course:export:progress', h);
      return () => ipcRenderer.removeListener('course:export:progress', h);
    }
  },
  brief: {
    get: (corso) => ipcRenderer.invoke('brief:get', { corso }),
    set: (corso, brief) => ipcRenderer.invoke('brief:set', { corso, brief })
  },
  // ruolo dichiarato delle fonti: mappa numero materiale → ruolo
  fonti: {
    set: (corso, fonti) => ipcRenderer.invoke('fonti:set', { corso, fonti })
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
    proponi: (corso, folder, nCapitoli, nAlternative) => ipcRenderer.invoke('scaletta:proponi', { corso, folder, nCapitoli, nAlternative }),
    // tutte insieme, per il composer: una chiamata per lezione, con avanzamento
    tutte: (corso, opts) => ipcRenderer.send('scalette:tutte', Object.assign({ corso }, opts || {})),
    onProgress: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('scalette:progress', h); return () => ipcRenderer.removeListener('scalette:progress', h); },
    onDone: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('scalette:done', h); return () => ipcRenderer.removeListener('scalette:done', h); },
    onError: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('scalette:error', h); return () => ipcRenderer.removeListener('scalette:error', h); }
  },
  /* Gli zaini: la modalità in cui si studia sui propri documenti. L'API è corta
     perché lo è il concetto — un contenitore e i suoi PDF. Appunti, mappe e
     album dello zaino NON passano da qui: usano i loro canali di sempre con
     l'id dello zaino al posto di quello del corso. */
  zaino: {
    list: () => ipcRenderer.invoke('zaino:list'),
    create: (nome) => ipcRenderer.invoke('zaino:create', { nome })
  },
  /* Il segno di lettura di ogni documento. Sta nel vault e non nel
     `localStorage` perché è un fatto del documento, non della macchina: lo
     zaino passato a un altro computer si riapre dove l'avevi lasciato. */
  /* Le fonti di un contenitore: portarle dentro e indicizzarle.
     ⚠️ `percorsoDi` esiste perché da Electron 32 un `File` trascinato non ha
     più `.path`: il percorso vero lo dà `webUtils.getPathForFile`, e senza
     quello un documento trascinato non si potrebbe copiare — si potrebbe solo
     leggerne il contenuto e riscriverlo, cioè fare la stessa cosa in peggio. */
  fonti: {
    percorsoDi: (file) => { try { return webUtils.getPathForFile(file); } catch (e) { return ''; } },
    importa: (corso, percorsi) => ipcRenderer.invoke('fonti:importa', { corso, percorsi }),
    indiceServe: (corso, file) => ipcRenderer.invoke('fonti:indiceServe', { corso, file }),
    indiceScrivi: (corso, file, pagine, motore) =>
      ipcRenderer.invoke('fonti:indiceScrivi', { corso, file, pagine, motore }),
    indici: (corso) => ipcRenderer.invoke('fonti:indici', { corso })
  },
  lettura: {
    leggi: (corso) => ipcRenderer.invoke('lettura:leggi', { corso }),
    segna: (corso, file, pagina) => ipcRenderer.invoke('lettura:segna', { corso, file, pagina })
  },
  /* Composer degli indici: righe = lezioni, colonne = indici proposti, e gli otto
     personaggi che si trascinano sulle card. Lo stato arriva in un colpo solo —
     piano, scalette in cache, percorsi già salvati — perché il composer si apre
     sempre su un corso intero, mai su una lezione sola. */
  composer: {
    stato: (corso) => ipcRenderer.invoke('composer:stato', { corso })
  },
  percorsi: {
    list: (corso) => ipcRenderer.invoke('percorsi:list', { corso }),
    save: (corso, percorsi) => ipcRenderer.invoke('percorsi:save', { corso, percorsi }),
    // le coppie lezione+indice: quante sono, quanto è già scritto, quanto costa il resto
    coppie: (corso) => ipcRenderer.invoke('percorsi:coppie', { corso }),
    // la scrittura vera: una cartella per coppia, `03-delega--per-domande`
    capitoli: (corso, opts) => ipcRenderer.send('percorsi:capitoli', Object.assign({ corso }, opts || {})),
    // si ferma con lo stesso interruttore della generazione singola: la coda è una sola
    ferma: (corso) => ipcRenderer.send('gen:cancel', { corso }),
    onCapProgress: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('percorsi:cap:progress', h); return () => ipcRenderer.removeListener('percorsi:cap:progress', h); },
    onCapLog: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('percorsi:cap:log', h); return () => ipcRenderer.removeListener('percorsi:cap:log', h); },
    onCapDone: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('percorsi:cap:done', h); return () => ipcRenderer.removeListener('percorsi:cap:done', h); },
    onCapError: (cb) => { const h = (e, d) => cb(d); ipcRenderer.on('percorsi:cap:error', h); return () => ipcRenderer.removeListener('percorsi:cap:error', h); }
  },
  gen: {
    stima: (corso, folder, capitoli) => ipcRenderer.invoke('gen:stima', { corso, folder, capitoli }),
    // accoda: i capitoli nuovi vanno in fondo, senza rinumerare quelli già scritti
    start: (corso, folder, capitoli, accoda) => ipcRenderer.send('gen:start', { corso, folder, capitoli, accoda: !!accoda }),
    cancel: (corso) => ipcRenderer.send('gen:cancel', { corso }),
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
    // con `corso` i materiali atterrano dentro di lui e la numerazione riparte da 01
    scan: (cartella, forzati, corso) => ipcRenderer.invoke('import:scan', { cartella, forzati, corso }),
    apply: (cartella, forzati, corso) => ipcRenderer.invoke('import:apply', { cartella, forzati, corso })
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
    stima: (corso) => ipcRenderer.invoke('ocr:stima', { corso }),
    installa: (conModello) => ipcRenderer.send('ocr:installa', { conModello: conModello !== false }),
    rimuovi: () => ipcRenderer.invoke('ocr:rimuovi'),
    // la rilettura vera: ore di lavoro, quindi eventi e un modo per fermarla
    leggi: (corso, scelte) => ipcRenderer.send('ocr:leggi', { corso, scelte }),
    ferma: (corso) => ipcRenderer.send('ocr:ferma', { corso }),
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
