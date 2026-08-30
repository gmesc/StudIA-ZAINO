const { contextBridge, ipcRenderer, webUtils } = require('electron');
const fs = require('fs');
const path = require('path');
const url = require('url');
const mat = require('./lib/materiali');   // materiali del corso, con ripiego sulle cartelle globali
const corsiLib = require('./lib/corsi');  // dove stanno corsi e lezioni, anche nei vault mai migrati
const evidenzeLib = require('./lib/evidenze'); // le parole chiave evidenziate, accanto agli appunti
const albumLib = require('./lib/album');  // le immagini ritagliate dai documenti, per corso
const mappeLib = require('./lib/mappe');  // i grafi delle mappe: la lente ha bisogno del loro testo
const heicLib = require('./lib/heic');    // le foto dell'iPhone, che il browser non sa disegnare
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
/* ⚠️ `corso` è il contenitore ATTIVO, e va passato: `trova` mette le sue
   cartelle davanti a tutte. Senza, due zaini con un file omonimo aprivano
   quello del primo in ordine alfabetico — misurato il 13 agosto, quando due
   prove hanno copiato lo stesso PDF in due zaini e `srcUrl` ha risposto con
   lo zaino sbagliato. */
function srcUrl(file, corso) {
  if (!vaultPath) return '../Fonti/' + encodeURIComponent(file);
  for (const sub of ['Fonti', 'Media', 'Figure']) {
    const p = mat.trova(vaultPath, sub, file, corso);
    if (p) return url.pathToFileURL(p).href;
  }
  return url.pathToFileURL(path.join(vaultPath, 'Fonti', file)).href;
}

// mappa "NN" -> nome file (per risolvere gli schemi video:NN / pdf:NN dei capitoli .md)
// ⚠️ La lista la dice `lib/materiali.js`: la copia che stava qui non aveva
// `.ogg .opus .aiff`, e i rimandi `video:NN` a un memo vocale non risolvevano
const MEDIA_EXT = mat.EXT_MEDIA;
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
  // con `corso` l'elenco è quello del corso, non di tutto il vault
  corpus: { list: (corso) => ipcRenderer.invoke('corpus:list', { corso }) },
  /* Salva come PDF: il renderer manda il documento già impaginato, il main lo
     stampa in una finestra invisibile e lo scrive dove dice il dialogo.
     ⚠️ UNA sola chiave `stampa` in questo oggetto: due chiavi uguali in un
     letterale non sono due cose — l'ultima vince e la prima sparisce senza un
     errore, ed è già costato due funzioni mute il 13 agosto. */
  stampa: {
    pdf: (o) => ipcRenderer.invoke('stampa:pdf', o || {}),
    mostra: (percorso) => ipcRenderer.invoke('stampa:mostra', { percorso: percorso })
  },
  /* La guida illustrata dello ZAINO, in una finestra sua. Sta dentro l'app
     (`App/guida-zaino/`) e non su disco accanto al vault: dev'esserci anche
     sul computer di chi installa il pacchetto e non ha mai visto questo repo. */
  guida: { apri: () => ipcRenderer.invoke('guida:apri') },
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
  /* l'Atlante delle opzioni: leve, direttive vere ed esempi, composti nel main */
  atlante: () => ipcRenderer.invoke('profilo:atlante'),
  /* crediti e licenze: l'inventario sta su disco, non nel renderer */
  crediti: {
    leggi: () => ipcRenderer.invoke('crediti:leggi'),
    chromium: () => ipcRenderer.invoke('crediti:chromium'),
    notice: (percorso) => ipcRenderer.invoke('crediti:notice', { percorso: percorso || '' })
  },
  notes: {
    // leggi() dice anche che cosa è andato storto; list() resta per compatibilità
    leggi: (courseId) => vaultPath ? appunti.read(vaultPath, courseId) : { notes: [], error: 'nessuna cartella vault impostata' },
    list: (courseId) => vaultPath ? appunti.read(vaultPath, courseId).notes : [],
    /* ⚠️ `opt.svuota` è la chiave che permette di scrivere il VUOTO sopra un
       appunto che ha del testo. Non ha valore di comodo: chi non la passa non
       può svuotare niente, e l'autosalvataggio non la passa MAI. La difesa
       vera sta in `lib/appunti.js`, che è l'unico punto da cui passano tutte
       le scritture; qui si limita a lasciarla dichiarare. */
    save: (courseId, file, meta, body, opt) => {
      try {
        if (!vaultPath) throw new Error('nessuna cartella vault impostata');
        return appunti.save(vaultPath, courseId, file, meta || {}, body || '', null, opt || {});
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
    /* ⚠️ L'unica voce ASINCRONA del blocco: passa dal main perché
       `shell.trashItem` — il Cestino di sistema — esiste solo là, e un appunto
       è l'unico file che esiste soltanto in questo vault. Non serve dentro
       `beforeunload`: si cancella a gesto, mai alla chiusura. */
    remove: (courseId, file) => ipcRenderer.invoke('note:rimuovi', { corso: courseId, file }).then((r) => !!(r && r.ok)),
    reindex: (courseId) => { try { return appunti.reindex(vaultPath, courseId); } catch (e) { return 0; } },
    /* Le copie di ciò che è stato perso, dalla più recente. Sono `.md` veri in
       `APPUNTI/_versioni/`: si aprono col Finder o con Obsidian anche senza
       che l'app offra un gesto: un backup che si legge solo con lo strumento
       che l'ha rotto non è un backup. */
    versioni: (courseId, file) => { try { return appunti.versioni(vaultPath, courseId, file); } catch (e) { return []; } },
    cartellaVersioni: (courseId) => { try { return appunti.dirVersioni(vaultPath, courseId); } catch (e) { return ''; } },
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
    },
    /* Il terzo gemello di `colora`: la POSTILLA, cioè il perché di una
       sottolineatura. Non tocca l'identità — sta accanto a colore e tratto —
       e una postilla vuota la toglie. */
    postilla: (courseId, id, testo) => {
      if (!vaultPath) return { evidenza: null, evidenze: [], error: 'nessuna cartella vault impostata' };
      try { return evidenzeLib.postilla(vaultPath, courseId, id, testo); }
      catch (e) { return { evidenza: null, evidenze: [], error: e.message }; }
    },
    // il gemello di `colora`, per il TRATTO: sottolineatura o fondo pieno
    tratta: (courseId, id, tratto) => {
      if (!vaultPath) return { evidenza: null, evidenze: [], error: 'nessuna cartella vault impostata' };
      try { return evidenzeLib.tratta(vaultPath, courseId, id, tratto); }
      catch (e) { return { evidenza: null, evidenze: [], error: e.message }; }
    },
    /**
     * Che id AVRÀ questa voce, senza scriverla.
     *
     * ⚠️ Sta nel main e non nel renderer per la sola ragione ammessa
     * dall'invariante 5: l'id è uno `sha1`, e `crypto` di là non c'è. Rifarlo
     * nel renderer sarebbe una seconda implementazione della stessa identità —
     * e il giorno che le due divergessero, un appunto citerebbe un'evidenza che
     * non esiste, in silenzio. È la stessa scelta già fatta per `ripasso:ids`.
     *
     * Serve ad «Appunta»: per scrivere `[==testo==](ev:<id>)` l'id lo si deve
     * sapere PRIMA di scrivere l'appunto, e l'evidenza si crea dopo — perché un
     * giallo acceso senza l'appunto che l'ha causato sarebbe comparso dal nulla.
     * Non tocca niente: è un calcolo, e non serve nemmeno il vault.
     */
    /* Le LETTURE (gli strati): stesso file delle evidenze, stessa natura
       sincrona del resto di questo blocco. Tre verbi soli — nasce, si rinomina,
       si toglie — perché accendere e spegnere non tocca il disco: è una
       preferenza di lettura, e vive nel localStorage del renderer. */
    creaStrato: (courseId, nome) => {
      if (!vaultPath) return { strato: null, strati: [], error: 'nessuna cartella vault impostata' };
      try { return evidenzeLib.creaStrato(vaultPath, courseId, nome); }
      catch (e) { return { strato: null, strati: [], error: e.message }; }
    },
    rinominaStrato: (courseId, id, nome) => {
      if (!vaultPath) return { strati: [], error: 'nessuna cartella vault impostata' };
      try { return evidenzeLib.rinominaStrato(vaultPath, courseId, id, nome); }
      catch (e) { return { strati: [], error: e.message }; }
    },
    /* `dove`: `'via'` porta via anche i segni, l'id di un'altra lettura ce li
       sposta. Non c'è un valore di comodo — chi chiama deve aver chiesto. */
    rimuoviStrato: (courseId, id, dove) => {
      if (!vaultPath) return { tolte: 0, spostate: 0, rinati: [], strati: [], error: 'nessuna cartella vault impostata' };
      try { return evidenzeLib.rimuoviStrato(vaultPath, courseId, id, dove); }
      catch (e) { return { tolte: 0, spostate: 0, rinati: [], strati: [], error: e.message }; }
    },
    identita: (voce) => {
      try {
        /* ⚠️ Si passa da `normalizzaVoce`, che è la STESSA porta da cui passa
           `aggiungi`: l'id nasce dai campi raddrizzati, e chiamare `identita`
           sulla voce grezza darebbe un id diverso da quello che verrà scritto
           — cioè un appunto che cita un'evidenza che non esiste, in silenzio. */
        const n = evidenzeLib.normalizzaVoce(voce);
        return { id: n ? n.id : '', error: n ? '' : 'evidenza senza testo' };
      } catch (e) { return { id: '', error: e.message }; }
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
    /* `origine` filtra la vista: `'ritaglio'` per i Ritagli, `'foto'` per
       l'Album Foto, niente per l'archivio intero. Il filtro lo fa la libreria,
       così le due viste partono dalla stessa risposta. */
    elenco: (corso, origine) => {
      if (!vaultPath) return { voci: [], error: 'nessuna cartella vault impostata' };
      try { return albumLib.elenco(vaultPath, corso, origine); }
      catch (e) { return { voci: [], error: e.message }; }
    },
    /* Il percorso vero di un file trascinato dentro. ⚠️ Da Electron 32 un `File`
       non ha più `.path`: senza questa riga, di una foto si avrebbe solo il
       contenuto — e per l'HEIC serve il file, perché a convertirlo è `sips`.
       È lo stesso ponte già usato dai media. */
    percorsoDi: (file) => { try { return webUtils.getPathForFile(file); } catch (e) { return ''; } },
    /* Una foto HEIC tradotta in JPEG, come data URL — la stessa forma che
       `salva` accetta già. Sincrono come il resto dell'album: converte un file
       per volta, a gesto dell'utente. */
    heic: (percorso) => {
      try { return heicLib.converti(percorso); }
      catch (e) { return { dati: '', error: e.message }; }
    },
    heicDisponibile: () => { try { return heicLib.disponibile(); } catch (e) { return false; } },
    SENZA_HEIC: heicLib.SENZA_SIPS,
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
    /* Rifiuta se l'immagine è usata: si passa con `{ insisti: true }`, che è una
       scelta dell'utente e non un valore di fabbrica.
       ⚠️ ASINCRONA, sola del blocco: passa dal main perché `shell.trashItem` —
       il Cestino di sistema — esiste solo là. `usi` resta qui: è una lettura. */
    rimuovi: (corso, id, opt) => ipcRenderer.invoke('album:rimuovi', { corso, id, opt }),
    /* La URL con cui `<img>` mostra l'immagine, come `srcUrl` fa per i materiali.
       ⚠️ Vuole anche il corso, a differenza della firma abbozzata nel piano:
       l'album è di un corso, e un id da solo non individua nessun file — il nome
       del file lo dà l'indice di QUEL corso. */
    srcUrl: (corso, id, quale) => {
      if (!vaultPath) return '';
      try {
        /* `'mini'` chiede il francobollo, e se non c'è si torna l'immagine vera
           invece di una stringa vuota: chi disegna una card non deve gestire il
           caso «niente da mostrare» per una cosa che c'è. */
        const m = quale === 'mini' ? albumLib.percorsoMini(vaultPath, corso, id) : '';
        const p = m || albumLib.percorsoImmagine(vaultPath, corso, id);
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
    /**
     * Il TESTO di tutte le mappe del contenitore, in un colpo e SINCRONO.
     *
     * ⚠️ Serve alla LENTE, e ha dovuto essere una porta nuova. `elenco` di
     * proposito i nodi non li porta — un grafo intero che attraversa il ponte
     * per riempire una tendina è peso per niente — e `apri` è asincrona, mentre
     * l'indice della ricerca si costruisce in modo sincrono. Il risultato era
     * che di una mappa non aperta si poteva cercare solo il titolo: una parola
     * scritta in un nodo non si trovava, senza nessun errore da nessuna parte.
     *
     * Sincrona come `album.elenco`, e per la stessa ragione: è una lettura, e
     * l'indice si ricostruisce una volta per contenitore, non a ogni tasto.
     *
     * ⚠️ Passano solo i tre campi che l'indice cerca. Posizioni, colori, archi
     * e memorie non c'entrano niente con la ricerca, e su un vault con molte
     * mappe sarebbero il grosso di ciò che attraversa il ponte.
     */
    nodi: (corso) => {
      if (!vaultPath) return { mappe: [], error: 'nessuna cartella vault impostata' };
      try {
        const r = mappeLib.read(vaultPath, corso);
        return {
          mappe: (r.mappe || []).map((m) => ({
            file: m.file || '', titolo: m.titolo || '', errore: m.errore || '',
            nodi: (m.nodi || []).map((n) => ({ id: n.id, testo: n.testo, nota: n.nota }))
          })),
          error: r.error || ''
        };
      } catch (e) { return { mappe: [], error: e.message }; }
    },
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
    create: (nome) => ipcRenderer.invoke('zaino:create', { nome }),
    /* Torna `{ id, title, spostato }`: `id` è quello NUOVO — quando il titolo
       cambia lo slug, cambia anche la cartella, e chi chiama deve riagganciarsi
       a quello o continuerebbe a scrivere in una cartella che non c'è più. */
    rinomina: (id, nome) => ipcRenderer.invoke('zaino:rinomina', { id, nome }),
    elimina: (id) => ipcRenderer.invoke('zaino:elimina', { id })
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
    /* ⚠️ `set` — il ruolo dichiarato di una fonte, che scrive il wizard — stava
       in un SECONDO blocco `fonti:` più in su nello stesso oggetto letterale.
       Due chiavi uguali in un letterale non sono due cose: l'ultima vince e la
       prima sparisce per intero, senza un errore. Il wizard chiamava
       `window.vault.fonti.set(...)` dietro una guardia che controlla l'oggetto
       `fonti` — che c'era — e moriva di TypeError sul `.set`: il ruolo scelto
       non arrivava mai in `_corso.md`, e l'utente non vedeva niente. Il canale
       nel main era vivo e intatto da sempre. */
    set: (corso, fonti) => ipcRenderer.invoke('fonti:set', { corso, fonti }),
    percorsoDi: (file) => { try { return webUtils.getPathForFile(file); } catch (e) { return ''; } },
    importa: (corso, percorsi) => ipcRenderer.invoke('fonti:importa', { corso, percorsi }),
    /* Togliere una fonte: il file va nel Cestino di sistema e resta una traccia
       del suo contenuto, così se lo stesso documento torna riprende il nome e il
       numero di prima e il lavoro che ci stava sopra si riaggancia da sé. */
    elimina: (corso, file) => ipcRenderer.invoke('fonti:elimina', { corso, file }),
    /* Cambiare il nome di un documento: il NUMERO resta — è quello che scrivono
       i rimandi `pdf:03#p=7` — e il nome per esteso si riscrive dove è citato
       (evidenze, ritagli, appunti, mappe, lapidi, e l'indice del documento). */
    rinomina: (corso, file, titolo) => ipcRenderer.invoke('fonti:rinomina', { corso, file, titolo }),
    rimossi: (corso) => ipcRenderer.invoke('fonti:rimossi', { corso }),
    usi: (corso, file) => ipcRenderer.invoke('fonti:usi', { corso, file }),
    dimentica: (corso, impronta) => ipcRenderer.invoke('fonti:dimentica', { corso, impronta }),
    indiceServe: (corso, file) => ipcRenderer.invoke('fonti:indiceServe', { corso, file }),
    indiceScrivi: (corso, file, pagine, motore) =>
      ipcRenderer.invoke('fonti:indiceScrivi', { corso, file, pagine, motore }),
    indici: (corso) => ipcRenderer.invoke('fonti:indici', { corso })
  },
  /* Il testo dentro le fotografie: il renderer rasterizza le pagine (pdf.js e
     il canvas stanno da lui), il main riconosce con Tesseract e scrive il layer
     invisibile nella copia del PDF. Vedi lib/ocrpdf.js. */
  ocrpdf: {
    apri: () => ipcRenderer.invoke('ocrpdf:apri'),
    pagina: (png, larghezzaPx, altezzaPx) =>
      ipcRenderer.invoke('ocrpdf:pagina', { png, larghezzaPx, altezzaPx }),
    chiudi: () => ipcRenderer.invoke('ocrpdf:chiudi'),
    applica: (corso, file, pagine) => ipcRenderer.invoke('ocrpdf:applica', { corso, file, pagine })
  },
  /* Il ripasso: la storia di che cosa hai già risposto, e come. Vive in
     `RIPASSO/stato.json` dentro il contenitore — cartella dell'utente, come gli
     appunti: una rigenerazione del corso non la tocca. */
  ripasso: {
    leggi: (corso) => ipcRenderer.invoke('ripasso:leggi', { corso }),
    /* Scrive TUTTO lo stato: lo usa «azzera avanzamento», e le prove per
       ripartire da un terreno pulito. Le risposte singole passano da
       `registra`, che non richiede al renderer di sapere com'è fatta una voce. */
    salva: (corso, carte) => ipcRenderer.invoke('ripasso:salva', { corso, carte }),
    /* L'id della carta lo calcola il main: la formula dell'identità sta in un
       posto solo (`lib/ripasso.js`), e qui si mandano capitolo e domanda. */
    registra: (corso, capitolo, domanda, esito) =>
      ipcRenderer.invoke('ripasso:registra', { corso, capitolo, domanda, esito }),
    pota: (corso, vive) => ipcRenderer.invoke('ripasso:pota', { corso, vive }),
    /* Gli id delle carte che esistono adesso: la vista di ripasso ci appaia la
       storia letta dal disco. Non tocca niente — è solo la formula, che vive di
       là perché il renderer non ha `crypto`. */
    ids: (vive) => ipcRenderer.invoke('ripasso:ids', { vive })
  },
  lettura: {
    leggi: (corso) => ipcRenderer.invoke('lettura:leggi', { corso }),
    segna: (corso, file, pagina) => ipcRenderer.invoke('lettura:segna', { corso, file, pagina })
  },
  /* Il segno di ASCOLTO: lo stesso patto del segno di lettura, per i secondi.
     Sta nel vault e non nel `localStorage` perché è un fatto del materiale, non
     della macchina: lo zaino aperto su un altro computer riprende la lezione
     dov'era rimasta. */
  ascolto: {
    leggi: (corso) => ipcRenderer.invoke('ascolto:leggi', { corso }),
    segna: (corso, file, secondo) => ipcRenderer.invoke('ascolto:segna', { corso, file, secondo })
  },
  /* A che RIGA si era arrivati in un appunto: il terzo gemello di `lettura` e
     `ascolto`. Passa dal main come gli altri due — il segno sta nel vault, non
     nel `localStorage`, perché è un fatto del contenuto e viaggia con lui. */
  riga: {
    leggi: (corso) => ipcRenderer.invoke('riga:leggi', { corso }),
    segna: (corso, file, riga) => ipcRenderer.invoke('riga:segna', { corso, file, riga }),
    dimentica: (corso, file) => ipcRenderer.invoke('riga:dimentica', { corso, file })
  },
  /* I media di un contenitore: i video e gli audio che l'utente porta dentro.
     ⚠️ `percorsoDi` è quello delle fonti, e per la stessa ragione — da Electron
     32 un `File` trascinato non ha più `.path`. Sta anche qui perché chi
     trascina un video non deve sapere che la funzione vive sotto «fonti»: due
     gesti gemelli, due porte gemelle. */
  media: {
    /* ⚠️ Stessa storia di `fonti.set`: `list` — l'elenco dei video da
       trascrivere — viveva in un secondo blocco `media:` più in su, schiacciato
       da questo. Il modale «Trascrivi i video» si apriva e restava piantato su
       «Carico l'elenco…»: il TypeError è sincrono e scappa PRIMA che esista una
       Promise, quindi nemmeno il `.catch` lo raccoglieva. */
    list: () => ipcRenderer.invoke('media:list'),
    percorsoDi: (file) => { try { return webUtils.getPathForFile(file); } catch (e) { return ''; } },
    importa: (corso, percorsi) => ipcRenderer.invoke('media:importa', { corso, percorsi }),
    elenco: (corso) => ipcRenderer.invoke('media:elenco', { corso }),
    elimina: (corso, file) => ipcRenderer.invoke('media:elimina', { corso, file }),
    usi: (corso, file) => ipcRenderer.invoke('media:usi', { corso, file })
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
