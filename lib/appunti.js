'use strict';
/**
 * appunti — le note personali dell'utente su disco.
 *
 * Vivono in Corsi/<corso>/APPUNTI/ come .md indipendenti: la pipeline che
 * genera le lezioni non li tocca mai, e una rigenerazione non li perde. Il legame
 * col capitolo sta nel frontmatter (lezioneId/capitoloId/capitoloFile), non dentro
 * il capitolo.
 *
 * Due regole che valgono per tutto il file:
 *  1. si scrive in modo atomico (tmp + rename): una lettura che capitasse a metà
 *     scrittura vedrebbe un appunto troncato — cioè senza titolo — e sembrerebbe
 *     sparito;
 *  2. un errore di lettura non si trasforma mai in "nessun appunto": la cartella
 *     assente è l'unico caso in cui l'elenco vuoto è la verità.
 */
const fs = require('fs');
const path = require('path');
const corsiLib = require('./corsi');   // la radice dei corsi: `Corsi/`, o `Progetti/` nei vault mai migrati

const CARTELLA = 'APPUNTI';

function dir(vaultPath, courseId) { return path.join(corsiLib.cartella(vaultPath, courseId), CARTELLA); }

// nomi file leggibili: teniamo spazi e accenti, togliamo solo ciò che il fs non regge
function safeName(s) {
  return String(s == null ? '' : s)
    .replace(/[\/\\:*?"<>|]/g, '-')
    .replace(/[\x00-\x1f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90) || 'senza titolo';
}
function ymlEsc(s) { return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' '); }

function str(v) { return v == null ? '' : String(v); }

/**
 * Un nome di file è una FOGLIA della cartella che lo ospita, e nient'altro.
 *
 * ⚠️ Senza questo controllo ogni porta che tocca il disco accetta un percorso:
 * `remove(p, c, '../MAPPE/mia.json')` cancellava una mappa e rispondeva «fatto»,
 * `save` con lo stesso nome scriveva fuori da APPUNTI/. È il guasto già pagato
 * dalle mappe (HANDOFF §5.2), e vale identico qui: una regola che vale per una
 * porta sola non è una regola.
 *
 * Sta in questo modulo — il più in basso dei due — perché `mappe.js` lo riusa:
 * la stessa domanda non deve avere due risposte che possono divergere.
 */
function nomeValido(f) {
  const s = str(f);
  return !!s && s.indexOf('/') < 0 && s.indexOf('\\') < 0 && s.indexOf('..') < 0;
}

/**
 * Il nome che nasce da un titolo, reso innocuo. `safeName` da solo non basta, in
 * due modi verificati sulle mappe e veri anche per gli appunti:
 *  · «Cap.. 3» diventerebbe `Cap.. 3.md`, che `nomeValido` rifiuta per sempre:
 *    l'appunto compare nell'elenco e non si apre né si rinomina più;
 *  · «_bozza» diventerebbe `_bozza.md`, che `list()` salta di proposito (i file
 *    che cominciano per `_` non sono appunti, sono l'indice): l'appunto esiste
 *    su disco e dall'app non si vede.
 * In tutti e due i casi il salvataggio risponde «fatto». Il posto giusto per
 * impedirlo è qui, dove il nome nasce, non nei chiamanti che dovrebbero
 * ricordarsene.
 */
function nomeSicuro(s, ripiego) {
  const b = str(s).replace(/\.{2,}/g, '.').replace(/^[_.\s]+/, '').trim();
  return b || ripiego || 'senza titolo';
}

/**
 * Le sole chiavi che il frontmatter di un appunto conosce.
 *
 * ⚠️ È una LISTA BIANCA, e `serialize` non avvisa: un campo che non sta qui
 * viene buttato via al salvataggio, in silenzio. Chi aggiunge un dato a un
 * appunto e si dimentica questa riga lo vede funzionare finché non salva, e
 * sparire per sempre al primo autosalvataggio (1,8 s dopo il primo tasto).
 *
 * `materiale` e `pagina` sono il posto che nello ZAINO tengono `lezione` e
 * `capitolo`: là non ci sono lezioni né capitoli, e un appunto dice invece da
 * quale documento — e da quale pagina — è nato (Z6). Si chiamano come i campi
 * delle evidenze perché sono la stessa cosa, e due nomi per la stessa cosa
 * sono due cose da tenere d'accordo a mano.
 */
const CHIAVI = ['title', 'lezione', 'lezioneId', 'capitolo', 'capitoloId', 'capitoloFile',
  'materiale', 'pagina', 'anchor', 'creato', 'modificato'];

function serialize(meta, body) {
  let out = '---\n';
  for (const k of CHIAVI) if (meta[k] != null && meta[k] !== '') out += k + ': "' + ymlEsc(meta[k]) + '"\n';
  out += '---\n\n' + String(body == null ? '' : body).replace(/\s+$/, '') + '\n';
  return out;
}
function parse(raw) {
  const meta = {}; const m = /^---\n([\s\S]*?)\n---\n?/.exec(raw || '');
  if (m) {
    for (const line of m[1].split('\n')) {
      const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line); if (!kv) continue;
      let v = kv[2].trim();
      if (/^".*"$/.test(v)) v = v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      meta[kv[1]] = v;
    }
  }
  return { meta, fm: !!m, body: (raw || '').replace(/^---\n[\s\S]*?\n---\n?/, '').replace(/^\n+/, '') };
}

// scrittura non interrompibile: il file definitivo compare già completo
function writeAtomic(p, data) {
  const tmp = p + '.tmp-' + process.pid;
  try { fs.writeFileSync(tmp, data, 'utf-8'); fs.renameSync(tmp, p); }
  catch (e) { try { fs.unlinkSync(tmp); } catch (e2) {} throw e; }
}

/**
 * «Questi due percorsi sono lo stesso file?» — lo dice il FILESYSTEM (inode +
 * dispositivo), non il confronto dei nomi.
 *
 * ⚠️ È il criterio che ha già cancellato una mappa dell'utente (HANDOFF §5.1):
 * su macOS il volume non distingue le maiuscole, quindi `Neuroni.md` e
 * `neuroni.md` sono LA STESSA voce di cartella. Chi rinomina cerca un nome
 * libero a minuscole (giusto), scrive — cioè riscrive lo stesso file — e poi,
 * confrontando i NOMI con le maiuscole, li trova «diversi» e cancella quello
 * appena scritto. Con l'inode la domanda ha una risposta sola, e funziona anche
 * dove le maiuscole contano davvero.
 *
 * Se uno dei due non esiste non sono lo stesso file: `stat` solleva e la
 * risposta è `false`, che è il caso normale della rinomina vera.
 */
function stessoFile(a, b) {
  try {
    const x = fs.statSync(a), y = fs.statSync(b);
    return x.ino === y.ino && x.dev === y.dev;
  } catch (e) { return false; }
}

/** Un file di APPUNTI/ letto come appunto: `{file, body, …frontmatter}`, la
 *  stessa forma che l'interfaccia già consuma. Frontmatter assente o troncato
 *  (scrittura interrotta, modifica a mano): l'appunto resta, ma con un nome —
 *  senza, nell'elenco sarebbe una riga muta. Una sola copia di questa regola,
 *  perché `list` e `apri` devono raccontare lo stesso appunto. */
function nota(file, raw) {
  const p = parse(raw);
  const n = Object.assign({ file: file, body: p.body }, p.meta);
  if (!p.fm || !n.title) {
    n.title = n.title || file.replace(/\.md$/, '');
    if (!p.fm) n.errore = 'frontmatter mancante';
  }
  return n;
}

/** Le sole chiavi che il frontmatter conosce, prese da un appunto già letto.
 *  Serve a rinominare senza travasare nel file `body`, `file` o `errore`, che
 *  appunti non sono: `serialize` li scarterebbe comunque, ma affidarsi a quel
 *  filtro vorrebbe dire che una chiave in più a CHIAVI li farebbe passare. */
function soloFrontmatter(n) {
  const m = {};
  for (const k of CHIAVI) if (n[k] != null && n[k] !== '') m[k] = n[k];
  return m;
}

/** Elenca gli appunti di un corso.
 *  Cartella assente -> []. Qualsiasi altro errore di lettura della cartella -> throw.
 *  Un singolo file illeggibile resta nell'elenco col nome del file e un campo
 *  `errore`: sparire in silenzio è peggio che comparire rotto. */
function list(vaultPath, courseId) {
  const d = dir(vaultPath, courseId); const out = []; const rotti = [];
  let files;
  try { files = fs.readdirSync(d); }
  catch (e) { if (e.code === 'ENOENT') return out; throw e; }
  for (const f of files.sort()) {
    if (!f.toLowerCase().endsWith('.md') || f.startsWith('_')) continue;
    try {
      const n = nota(f, fs.readFileSync(path.join(d, f), 'utf-8'));
      if (n.errore) rotti.push(f + ' (' + n.errore + ')');
      out.push(n);
    } catch (e) {
      rotti.push(f + ' (' + e.message + ')');
      out.push({ file: f, body: '', title: f.replace(/\.md$/, ''), errore: e.message });
    }
  }
  if (rotti.length) out.rotti = rotti;
  return out;
}

/** Forma esplicita { notes, error }: l'errore va detto a chi legge, e
 *  contextBridge non porterebbe comunque le proprietà appese a un array. */
function read(vaultPath, courseId) {
  try {
    const notes = list(vaultPath, courseId);
    return {
      notes: notes.map((n) => Object.assign({}, n)),
      error: notes.rotti ? ('appunti illeggibili: ' + notes.rotti.join(' · ')) : ''
    };
  } catch (e) {
    return { notes: [], error: e.message };
  }
}

/**
 * Un appunto solo, per nome di file. `{ nota, error }`: l'appunto che non c'è e
 * l'appunto illeggibile sono due cose diverse e vanno dette diverse.
 *
 * Oltre a essere una foglia di APPUNTI/, il nome deve essere quello di un
 * appunto: un `.md` che non comincia per `_`. È la stessa regola con cui `list`
 * decide che cosa elencare, e serve a tenere fuori `_indice.md` — che è
 * generato, non scritto: rinominarlo lo trasformerebbe in un appunto fasullo e
 * cancellerebbe l'indice, con la risposta «fatto».
 */
function apri(vaultPath, courseId, file) {
  const f = str(file);
  if (!nomeValido(f)) return { nota: null, error: 'nome di file non valido: ' + f };
  if (!f.toLowerCase().endsWith('.md') || f.charAt(0) === '_') {
    return { nota: null, error: 'non è un appunto: ' + f };
  }
  try {
    return { nota: nota(f, fs.readFileSync(path.join(dir(vaultPath, courseId), f), 'utf-8')), error: '' };
  } catch (e) {
    if (e.code === 'ENOENT') return { nota: null, error: 'l\'appunto «' + f + '» non esiste' };
    return { nota: null, error: e.message };
  }
}

/**
 * Nome di default: "<Lezione> - <Capitolo> - <Titolo>.md", con suffisso " 2",
 * " 3"… sulle collisioni.
 *
 * `escludi` è il file che si sta rinominando: senza, rinominare un appunto
 * senza cambiargli il titolo lo chiamerebbe «… 2» perché collide con SE STESSO.
 * Il confronto è a minuscole perché il filesystem di macOS non distingue il
 * caso: «Nota.md» e «nota.md» sono lo stesso file, ed è ciò che `existsSync`
 * risponde.
 */
/**
 * Il nome di un appunto: dove l'hai preso, e come l'hai chiamato.
 *
 * ⚠️ Il TITOLO non si sacrifica mai al taglio dei 90 caratteri, e la ragione è
 * un guasto misurato: il nome nasceva da «lezione - capitolo - titolo» tagliato
 * in fondo, e con una lezione e un capitolo dal titolo lungo il titolo
 * dell'utente spariva del tutto. Conseguenza: rinominare un appunto cambiava il
 * titolo dentro il file e lasciava il nome identico — cioè il gesto sembrava
 * fatto a metà, senza dire perché. Adesso si accorcia il CONTESTO, che l'app
 * sa comunque ricostruire dal frontmatter, e se non ci sta si toglie del tutto:
 * un nome che non dice come si chiama l'appunto non serve a niente.
 */
function baseNome(meta) {
  const titolo = safeName(str(meta.title) || CARTELLA);
  /* ⚠️ `safeName('')` non torna una stringa vuota: torna «senza titolo», che è
     il suo ripiego. Chiederglielo su un contesto che non c'è appiccicherebbe
     quel ripiego davanti al titolo di ogni appunto preso fuori da un capitolo. */
  const grezzo = [meta.lezione, meta.capitolo].filter(Boolean).join(' - ');
  const contesto = grezzo ? safeName(grezzo) : '';
  if (!contesto) return nomeSicuro(titolo);
  const spazio = 90 - titolo.length - 3;
  const testa = spazio >= 8 ? contesto.slice(0, spazio).trim().replace(/[\s-]+$/, '') : '';
  return nomeSicuro(testa ? testa + ' - ' + titolo : titolo);
}

function filename(vaultPath, courseId, meta, escludi) {
  const base = baseNome(meta);
  const d = dir(vaultPath, courseId);
  const suo = str(escludi).toLowerCase();
  const libero = (nome) => nome.toLowerCase() === suo || !fs.existsSync(path.join(d, nome));
  let name = base + '.md', i = 1;
  while (!libero(name)) { i++; name = base + ' ' + i + '.md'; }
  return name;
}

/* ===== LE VERSIONI: la copia di ciò che sta per essere PERSO ==============
 *
 * ⚠️ Nasce da un guasto vero (26 agosto 2026): un appunto svuotato da un
 * annullamento — ⌘Z su un editor la cui cronologia era stata azzerata da un
 * `setValue` — e riscritto vuoto dal salvataggio automatico. La rete di
 * `save` impedisce il caso automatico; questa cartella copre il resto,
 * compreso il ⌘S che segue un annullamento sbagliato.
 *
 * ⚠️ SI VERSIONA SOLO CIÒ CHE PERDE. Non a ogni salvataggio: un autosalvataggio
 * ogni 1,8 secondi seminerebbe migliaia di file per un pomeriggio di scrittura,
 * e il rumore renderebbe inservibile proprio la cosa che deve salvare. La copia
 * si fa quando il testo nuovo è **più corto** di quello che c'è — cioè
 * esattamente quando qualcosa sparisce. Scrivere non costa niente; cancellare
 * lascia una traccia.
 *
 * ⚠️ Le versioni sono `.md` LEGGIBILI, con il nome e l'ora nel titolo: si
 * aprono col Finder o con Obsidian, senza bisogno che l'app offra un gesto per
 * ripristinarle. Un backup che si può leggere solo con lo strumento che l'ha
 * rotto non è un backup.
 */
const VERSIONI = '_versioni';
/** Quante se ne tengono per appunto: le più recenti. Dieci copie di un file da
 *  7 KB sono 70 KB — il prezzo di non perdere un semestre. */
const VERSIONI_MAX = 10;

function dirVersioni(vaultPath, courseId) { return path.join(dir(vaultPath, courseId), VERSIONI); }

/** Il nome di una versione: l'appunto, la data e l'ora **coi millesimi**.
 *  Ordinabile, e leggibile senza aprire il file.
 *
 *  ⚠️ I millesimi non sono pedanteria: due salvataggi possono cadere nello
 *  stesso secondo — succede a chi annulla e risalva di seguito, che è proprio
 *  il gesto da cui questa cartella difende — e due versioni con lo stesso nome
 *  sono una versione sola, con la più vecchia (quella che serviva) sovrascritta
 *  dalla più nuova. Misurato al primo collaudo. */
function nomeVersione(file, quando) {
  const base = str(file).replace(/\.md$/i, '');
  const t = (str(quando) || new Date().toISOString()).replace(/[:.]/g, '-').replace('T', ' ').slice(0, 23);
  return base + ' — ' + t + '.md';
}

/**
 * Mette da parte il file com'è ADESSO, prima che qualcuno lo accorci.
 *
 * Non solleva mai: una copia di sicurezza che fa fallire il salvataggio
 * sarebbe peggio del guasto da cui difende. Se non si riesce a scriverla, il
 * salvataggio va avanti — e il testo nuovo dell'utente non si perde per colpa
 * della rete.
 */
function versiona(vaultPath, courseId, file, quando) {
  try {
    const p = path.join(dir(vaultPath, courseId), str(file));
    const grezzo = fs.readFileSync(p, 'utf-8');
    if (!str(parse(grezzo).body).trim()) return '';     // niente da salvare: era già vuoto
    const dv = dirVersioni(vaultPath, courseId);
    fs.mkdirSync(dv, { recursive: true });
    /* ⚠️ E se quel nome è già preso, se ne cerca uno libero: due salvataggi
       possono cadere nello STESSO millesimo — è quello che fa un ⌘Z seguito
       subito da un ⌘S, cioè il gesto esatto da cui questa cartella difende — e
       scrivere sopra la copia di un istante prima vorrebbe dire perdere proprio
       quella che serviva. Misurato: senza questa riga la prova era rossa a
       corse alterne, una su cinque. */
    let nome = nomeVersione(file, quando);
    for (let k = 2; k < 100 && fs.existsSync(path.join(dv, nome)); k++) {
      nome = nomeVersione(file, quando).replace(/\.md$/, ' (' + k + ').md');
    }
    writeAtomic(path.join(dv, nome), grezzo);
    potaVersioni(vaultPath, courseId, file);
    return nome;
  } catch (e) { return ''; }
}

/** Tiene le ultime `VERSIONI_MAX` di quell'appunto e toglie le più vecchie.
 *  ⚠️ Cancella SOLO file che cominciano col nome di quell'appunto e finiscono
 *  in `.md` dentro `_versioni/`: una potatura che sbaglia bersaglio sarebbe il
 *  guasto che questa cartella esiste per impedire. */
function potaVersioni(vaultPath, courseId, file) {
  try {
    const dv = dirVersioni(vaultPath, courseId);
    const base = str(file).replace(/\.md$/i, '') + ' — ';
    const mie = fs.readdirSync(dv)
      .filter((f) => f.startsWith(base) && f.toLowerCase().endsWith('.md'))
      .sort();
    for (const f of mie.slice(0, Math.max(0, mie.length - VERSIONI_MAX))) {
      try { fs.unlinkSync(path.join(dv, f)); } catch (e) { /* passi */ }
    }
  } catch (e) { /* la cartella può non esserci */ }
}

/** Le versioni di un appunto, dalla più recente. Serve a chi vuole offrirle. */
function versioni(vaultPath, courseId, file) {
  try {
    const base = str(file).replace(/\.md$/i, '') + ' — ';
    return fs.readdirSync(dirVersioni(vaultPath, courseId))
      .filter((f) => f.startsWith(base) && f.toLowerCase().endsWith('.md'))
      .sort().reverse();
  } catch (e) { return []; }
}

/**
 * ⚠️ UN APPUNTO PIENO NON SI SVUOTA DA SÉ.
 *
 * Il 26 agosto 2026 un appunto dell'utente è stato trovato con il frontmatter
 * intatto e il CORPO VUOTO: il file c'era, il lavoro no. La causa non è stata
 * riprodotta — e proprio per questo la difesa sta qui, nell'unico punto da cui
 * passano tutte le scritture, invece che nel gesto che si sospetta.
 *
 * La regola: scrivere il vuoto sopra un appunto che sul disco ha del testo
 * **non si fa**, a meno che chi chiama lo dichiari (`opt.svuota`). Un
 * salvataggio automatico non lo dichiara mai; solo un gesto esplicito può.
 *
 * ⚠️ E il rifiuto si DICE, non si tace: torna `{ error }`, perché «non ho
 * salvato» e «ho salvato» sono due fatti diversi e chi scrive deve saperlo.
 * Perdere in silenzio è l'unica cosa peggiore di perdere (invariante 4).
 *
 * Il costo di questa rete è dichiarato: chi vuole DAVVERO svuotare un appunto
 * deve passare dal gesto esplicito. È un prezzo minuscolo contro un semestre
 * di appunti.
 */
function save(vaultPath, courseId, file, meta, body, adesso, opt) {
  // un nome scelto da chi chiama vale solo se è una foglia di APPUNTI/
  if (file && !nomeValido(file)) throw new Error('nome di file non valido: ' + str(file));
  const o = opt || {};
  const d = dir(vaultPath, courseId);
  const now = adesso || new Date().toISOString();
  const m = Object.assign({}, meta, { creato: meta.creato || now, modificato: now });
  const name = file || filename(vaultPath, courseId, m);
  const p = path.join(d, name);

  if (!str(body).trim() && !o.svuota && file) {
    /* Che cosa c'è ADESSO su disco: se ha del testo, questo salvataggio lo
       cancellerebbe. Un file che non si riesce a leggere non autorizza niente:
       «non lo so» non è «vai avanti» — è la stessa regola di `album.rimuovi`. */
    let vecchio = null;
    try { vecchio = fs.readFileSync(p, 'utf-8'); } catch (e) { vecchio = null; }
    if (vecchio !== null) {
      const corpoVecchio = str(parse(vecchio).body).trim();
      if (corpoVecchio) {
        return { file: name, meta: m, error: 'salvataggio rifiutato: svuoterebbe un appunto che ha del testo' };
      }
    }
  }

  /* ⚠️ E prima di scrivere, se questo salvataggio ACCORCIA il testo, si mette
     da parte quello che c'è. Solo in quel caso: chi aggiunge non perde niente,
     e una copia a ogni battuta renderebbe la cartella inservibile. */
  if (file) {
    try {
      const grezzo = fs.readFileSync(p, 'utf-8');
      const vecchio = str(parse(grezzo).body);
      if (vecchio.trim() && str(body).length < vecchio.length) versiona(vaultPath, courseId, name, now);
    } catch (e) { /* non c'era: niente da mettere da parte */ }
  }

  fs.mkdirSync(d, { recursive: true });
  writeAtomic(p, serialize(m, body));
  reindex(vaultPath, courseId);
  return { file: name, meta: m };
}

/** Cancella un appunto. `false` se il nome non è un appunto di questa cartella,
 *  se non c'era, o se il disco ha rifiutato.
 *
 *  ⚠️ `opt.cestina` è iniettata da chi chiama — nell'app è `shell.trashItem` di
 *  Electron, così l'appunto finisce nel Cestino di sistema e si recupera con un
 *  gesto: è l'UNICO file dello zaino che esiste soltanto qui, scritto
 *  dall'utente, e la cancellazione vera era rovesciata rispetto al valore (un
 *  PDF cestinato è ancora nella mail del professore; un appunto no). Il Cestino
 *  è asincrono, quindi CON `cestina` la risposta è una Promise; senza, resta la
 *  cancellazione sincrona di sempre — è ciò che serve alle prove. Stesso patto
 *  di `fonti.elimina`. */
function remove(vaultPath, courseId, file, opt) {
  const o = opt || {};
  if (typeof o.cestina === 'function') {
    if (!nomeValido(file)) return Promise.resolve(false);
    const p = path.join(dir(vaultPath, courseId), str(file));
    return Promise.resolve().then(() => o.cestina(p)).then(
      () => { reindex(vaultPath, courseId); return true; },
      () => false
    );
  }
  if (!nomeValido(file)) return false;
  try { fs.unlinkSync(path.join(dir(vaultPath, courseId), str(file))); } catch (e) { return false; }
  reindex(vaultPath, courseId); return true;
}

/**
 * Rinomina: cambia il titolo DENTRO l'appunto e il nome del file di conseguenza.
 *
 * I due devono restare d'accordo — un file «Sistema nervoso.md» che dentro dice
 * «Bozza» è il tipo di doppia verità che poi nessuno sa quale credere. Il
 * contenuto si riscrive comunque, perché il titolo sta nel frontmatter; il
 * cambio di nome è solo la seconda metà.
 *
 * Ritorna `{ file, nota }` — il nome VERO che l'appunto ha su disco e l'appunto
 * riletto — oppure `{ error }`. `adesso` fissa l'istante di `modificato` (lo
 * usano i test), come in `save`.
 */
function rinomina(vaultPath, courseId, file, titolo, adesso) {
  const vecchio = str(file);
  const r = apri(vaultPath, courseId, vecchio);
  if (!r.nota) return { error: r.error };
  const t = str(titolo).trim();
  if (!t) return { error: 'un appunto senza titolo non si distinguerebbe dagli altri' };
  try {
    const d = dir(vaultPath, courseId);
    const meta = Object.assign(soloFrontmatter(r.nota), { title: t });
    const nuovo = filename(vaultPath, courseId, meta, vecchio);
    /* Il nuovo si scrive PRIMA di togliere il vecchio: se la scrittura fallisse
       a metà, l'appunto resterebbe comunque leggibile col nome di prima. */
    const esito = save(vaultPath, courseId, nuovo, meta, r.nota.body, adesso);
    let nome = esito.file;
    if (nuovo !== vecchio) {
      /* ⚠️ «Vecchio e nuovo sono lo stesso file?» lo decide `stessoFile`, cioè
         l'inode, non il confronto dei nomi: correggere le sole maiuscole di un
         titolo confrontando le stringhe cancella il file appena scritto, ed è
         costato una mappa dell'utente (§5.1, la storia sta su `stessoFile`). */
      if (stessoFile(path.join(d, vecchio), path.join(d, nuovo))) {
        /* Cambiate solo le maiuscole, il file è uno: il volume non le distingue
           e `rename` non riscrive il caso della voce già esistente, quindi su
           disco resta `Neuroni.md` mentre dentro il titolo dice «neuroni».
           Si torna il nome VERO, non quello chiesto: chi chiama lo userà per
           riaprire l'appunto e per ritrovarlo nell'elenco. La divergenza che
           resta è di sole maiuscole, ed è detta qui invece di essere scoperta
           poi. */
        nome = vecchio;
      } else {
        try { fs.unlinkSync(path.join(d, vecchio)); } catch (e) {}
        // il `reindex` di `save` è avvenuto col vecchio file ancora su disco:
        // senza questo secondo giro l'indice elencherebbe un appunto fantasma
        reindex(vaultPath, courseId);
      }
    }
    return { file: nome, nota: Object.assign({}, esito.meta, { file: nome, body: r.nota.body }) };
  } catch (e) {
    return { error: e.message };
  }
}

/**
 * L'etichetta di una lezione nell'indice: il titolo, e la variante quando c'è.
 *
 * ⚠️ Le varianti di una lezione **condividono il titolo** per costruzione — è
 * la stessa lezione, con un altro ordine dei capitoli. Senza il suffisso, due
 * sezioni dell'indice si chiamerebbero uguale e non si saprebbe di quale
 * versione siano gli appunti che ci stanno sotto.
 */
function etichettaLezione(n, chiave) {
  const titolo = n.lezione || chiave;
  const id = String(n.lezioneId || '');
  const i = id.indexOf('--');
  return i < 0 ? titolo : titolo + ' — variante «' + id.slice(i + 2).replace(/-/g, ' ') + '»';
}

/* indice automatico: APPUNTI/_indice.md, raggruppato per lezione e capitolo.
   ⚠️ Si raggruppa per `lezioneId`, cioè per CARTELLA, non per titolo: un appunto
   appartiene alla variante in cui è stato preso (decisione del 10 agosto 2026, la
   stessa che vale per evidenze e mappe). Raggruppando per titolo, gli appunti di
   due varianti finivano mescolati in una sezione sola, come se fossero dello
   stesso testo — e non lo sono: l'ordine dei capitoli è un altro.
   Ordinare per cartella ha anche un effetto buono: l'indice segue la sequenza
   didattica (`01-`, `02-`…) invece dell'alfabeto dei titoli. */
function indice(notes, quando) {
  const byLesson = new Map();
  for (const n of notes) {
    const ck = n.lezioneId || n.lezione || 'Senza lezione';
    if (!byLesson.has(ck)) byLesson.set(ck, { eti: etichettaLezione(n, ck), capitoli: new Map() });
    const chk = n.capitolo || n.capitoloId || 'Senza capitolo';
    const chs = byLesson.get(ck).capitoli;
    if (!chs.has(chk)) chs.set(chk, []);
    chs.get(chk).push(n);
  }
  let md = '---\ntitle: "Indice degli appunti"\ngenerato: "' + (quando || new Date().toISOString()) + '"\n---\n\n';
  md += '# Indice degli appunti\n\n> File generato automaticamente da StudIA a ogni salvataggio. Non modificarlo a mano.\n\n';
  md += '**' + notes.length + '** ' + (notes.length === 1 ? 'appunto' : 'appunti') + ' in ' + byLesson.size + ' lezion' + (byLesson.size === 1 ? 'e' : 'i') + '.\n\n';
  for (const ck of Array.from(byLesson.keys()).sort()) {
    md += '## ' + byLesson.get(ck).eti + '\n\n';
    const chs = byLesson.get(ck).capitoli;
    for (const chk of Array.from(chs.keys()).sort()) {
      md += '### ' + chk + '\n\n';
      for (const n of chs.get(chk)) {
        const first = (n.body || '').split('\n').map((s) => s.trim()).filter(Boolean)[0] || '';
        md += '- [' + (n.title || n.file.replace(/\.md$/, '')) + '](<' + n.file + '>)';
        if (n.anchor) md += ' — *«' + n.anchor.slice(0, 80) + '»*';
        else if (first) md += ' — ' + first.replace(/[#*`>]/g, '').slice(0, 80);
        md += '\n';
      }
      md += '\n';
    }
  }
  return md;
}

function reindex(vaultPath, courseId, quando) {
  let notes = [];
  try { notes = list(vaultPath, courseId); } catch (e) { return 0; }
  const d = dir(vaultPath, courseId);
  try { fs.mkdirSync(d, { recursive: true }); writeAtomic(path.join(d, '_indice.md'), indice(notes, quando)); } catch (e) {}
  return notes.length;
}

module.exports = {
  CARTELLA, CHIAVI, dir, safeName, nomeValido, nomeSicuro, stessoFile,
  serialize, parse, nota, writeAtomic, list, read, apri,
  filename, save, remove, rinomina, reindex, indice,
  VERSIONI, VERSIONI_MAX, dirVersioni, nomeVersione, versiona, versioni
};
