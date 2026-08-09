'use strict';
/**
 * mappe — le mappe personali dell'utente su disco.
 *
 * Vivono in `Corsi/<corso>/MAPPE/*.json`, una per file, ed è lo stesso
 * patto degli appunti: sono artefatti dell'UTENTE, la pipeline che genera le
 * lezioni non ci scrive mai e una rigenerazione non le perde. Per questo qui non
 * si passa da `corsi.assicuraScrivibile()`: un corso protetto è chiuso
 * alla pipeline, non a chi ci studia sopra — su TD74-DSA le mappe si devono
 * poter fare, esattamente come gli appunti.
 *
 * La vista GENERATA non c'entra e non si salva mai (è una proiezione del
 * capitolo, e il capitolo è la verità). Qui c'è solo la copia che l'utente
 * decide di tenere: da quel momento è roba sua.
 *
 * ── Perché un formato nostro, e perché `formato: 1` in testa ──────────────
 * Il file è JSON nostro e non JSON Canvas: i nodi e gli archi parlano
 * ESATTAMENTE il vocabolario dei motori (`App/assets/mappa/grafo.js`,
 * `layouts.js`), così fra disco e disegno non c'è nessuna traduzione da tenere
 * allineata. Il prezzo è che la forma è nostra e un giorno potrà cambiare:
 * `formato` costa una riga oggi ed è la sola cosa che rende economico quel
 * cambio domani — chi legge sa che cosa ha in mano invece di indovinarlo. È la
 * stessa ragione per cui `motore` sta dentro ogni pagina degli indici PDF
 * (HANDOFF §9): un vault finisce sempre per contenere file di età diverse.
 *
 * Due regole che valgono per tutto il file, e sono quelle di `appunti.js`:
 *  1. si scrive in modo atomico (tmp + rename): una lettura che capitasse a
 *     metà scrittura vedrebbe un JSON troncato — cioè illeggibile — e la mappa
 *     sembrerebbe sparita;
 *  2. un errore di lettura non si trasforma mai in "nessuna mappa": la cartella
 *     assente è l'unico caso in cui l'elenco vuoto è la verità.
 */

const fs = require('fs');
const path = require('path');
const corsiLib = require('./corsi');   // la radice dei corsi: `Corsi/`, o `Progetti/` nei vault mai migrati
// `safeName` e `writeAtomic` sono già scritti e provati là: le stesse due
// regole (nomi leggibili, scrittura non interrompibile) valgono qui identiche,
// e una seconda copia sarebbe destinata a divergere.
const appunti = require('./appunti');

const CARTELLA = 'MAPPE';
const EXT = '.json';

/** Versione della forma su disco. Si alza solo quando la forma cambia davvero. */
const FORMATO = 1;

function dir(vaultPath, courseId) { return path.join(corsiLib.cartella(vaultPath, courseId), CARTELLA); }

/* ------------------------------------------------------------- vocabolario */

/**
 * I campi di un nodo, quelli e nessun altro nome.
 *
 * `id · testo · livello · gruppo · origine · rimando · colore · nota` li leggono
 * `grafo.sanitizza()` e `disegna.svg()`; `genere` e `capitolo` li scrive
 * `genera.js` e li rilegge il disegno (`genere === 'radice'` fa il grassetto,
 * `capitolo != null` rende il nodo navigabile). Toglierli qui vorrebbe dire
 * perderli nel giro disco→motori, che è esattamente ciò che questo modulo
 * esiste per non fare.
 *
 * `x` e `y` — la posizione fissata a mano — stanno in elenco anche se prima
 * transitavano lo stesso dal ramo dei campi non nominati in fondo a
 * `normalizzaNodo`. Funzionava per combinazione: un campo di cui questa
 * persistenza è responsabile va scritto dove si legge il vocabolario,
 * altrimenti il primo che stringe quel filtro lo perde senza accorgersene.
 */
const CAMPI_NODO = ['id', 'testo', 'livello', 'gruppo', 'origine', 'rimando', 'colore', 'nota', 'genere', 'capitolo', 'x', 'y'];

/** I campi di un arco, come li normalizza `grafo.archi()`. */
const CAMPI_ARCO = ['da', 'a', 'rel', 'cross', 'bidir'];

/** Da dove viene un nodo. Governa il colore e il bordo (PIANO-MAPPE-EDITOR §3). */
const ORIGINI = ['fonte', 'utente', 'generata'];

/**
 * Le leve della vista, con gli stessi nomi che gira il renderer
 * (`MAPPA.vista` + `MAPPA_LEVE` in StudIA.html) e i motori (`layouts.DEFAULT`).
 * `zoom` ha la forma di `MAPPA.z`: `k` l'ingrandimento, `x`/`y` lo spostamento.
 *
 * Stanno DENTRO la mappa e non in `localStorage` perché una mappa dell'utente
 * ricorda come la si stava guardando: è la sua, non una taratura del corso.
 *
 * `chiusi` è l'elenco degli id dei rami che avevi chiuso, nella forma che
 * `grafo.senzaRami()` già accetta (array di id). Lo ricorda SOLO la mappa
 * dell'utente: nella vista generata gli id (`n1`, `n2`…) si rifanno a ogni
 * costruzione e alla riapertura indicherebbero un altro nodo — è la ragione per
 * cui il renderer tiene `MAPPA.identita` e butta i chiusi quando cambia. Qui
 * invece gli id vivono nel file e sono stabili: ricordarli è mantenere il patto
 * già dichiarato per `vista`.
 */
const VISTA = {
  motore: 'albero', orient: 'td',
  gapLivello: 92, gapNodo: 26, w: 168,
  fsNodo: 12, fsRel: 10,
  linee: 'curva', etichette: 'complete',
  glossario: true, fonti: true,
  zoom: { k: 1, x: 0, y: 0 },
  chiusi: []
};

/* -------------------------------------------------------------- normalizza */

function str(v) { return v == null ? '' : String(v); }
function num(v, d) { const n = +v; return Number.isFinite(n) ? n : d; }

/** Una coordinata, o `null` se ciò che è arrivato non è un punto sullo schermo.
 *  ⚠️ Qui non basta `num()`: `+null`, `+''` e `+false` valgono 0, cioè un nodo
 *  inchiodato nell'angolo in alto a sinistra da un campo che era semplicemente
 *  vuoto. Passano i numeri finiti e le stringhe che ne contengono uno (una
 *  casella di testo consegna «120», non 120); tutto il resto no. */
function coord(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') { const n = +v; return Number.isFinite(n) ? n : null; }
  return null;
}

/** Un nodo ridotto al vocabolario, senza i campi vuoti: il file resta leggibile
 *  a occhio nudo, e ciò che non c'è si riconosce dall'assenza invece che da un
 *  `null` da interpretare. Senza `id` il nodo non esiste: gli archi lo
 *  indicherebbero a vuoto. */
function normalizzaNodo(n) {
  if (!n || n.id == null || n.id === '') return null;
  const o = { id: str(n.id), testo: str(n.testo) };
  if (n.livello != null) o.livello = num(n.livello, 0);
  if (n.gruppo != null) o.gruppo = num(n.gruppo, 0);
  if (n.origine && ORIGINI.indexOf(n.origine) >= 0) o.origine = n.origine;
  // il rimando è la struttura che `openNote` del lettore già sa aprire
  // ({type,file,t|page,label}): si porta com'è, non se ne fa una seconda forma
  if (n.rimando && typeof n.rimando === 'object') o.rimando = Object.assign({}, n.rimando);
  if (n.colore) o.colore = str(n.colore);
  if (n.nota) o.nota = str(n.nota);
  if (n.genere) o.genere = str(n.genere);
  if (n.capitolo != null) o.capitolo = num(n.capitolo, 0);
  /* La posizione fissata a mano. Un nodo è FISSATO se e solo se ha `x` e `y`
     ENTRAMBI numeri finiti: non c'è nessun flag accanto, la presenza delle
     coordinate È il flag (la ragione sta scritta in `modifica.sposta`).
     ⚠️ Da qui la regola del tutto-o-niente: una `x` senza la sua `y` non si
     scrive, e nemmeno la `y` rimasta orfana. Mezzo fissaggio su disco sarebbe
     un nodo che il motore non sa dove mettere e che nessuno potrebbe liberare,
     perché a schermo non risulta spostato: la voce «Libera la posizione» non
     avrebbe niente da mostrare, e il nodo resterebbe storto per sempre. */
  const px = coord(n.x), py = coord(n.y);
  if (px !== null && py !== null) { o.x = px; o.y = py; }
  /* Tutto ciò che il vocabolario non nomina passa comunque: l'editor della
     fase D aggiunge campi suoi (un ramo chiuso sul nodo, una marca di lavoro)
     e una persistenza che li scarta in silenzio farebbe sparire il lavoro
     dell'utente al primo salvataggio. Si scarta solo ciò che si sa ricalcolare
     o che qui non vuol dire niente.
     ⚠️ È anche il motivo per cui `x` e `y` DEVONO stare in `CAMPI_NODO`: da
     qui passerebbero comunque, e rientrerebbero grezze — `null`, `'abc'`, una
     `x` sola — rimettendo nel file esattamente ciò che la regola sopra ha
     appena tolto. */
  Object.keys(n).forEach((k) => {
    if (CAMPI_NODO.indexOf(k) >= 0 || k.charAt(0) === '_') return;
    if (n[k] === undefined) return;
    o[k] = n[k];
  });
  return o;
}

/** Un arco fra due nodi vivi. Cappi e archi verso nodi inesistenti si tolgono
 *  qui: `grafo.sanitizza()` lo rifarebbe a valle, ma un file su disco che li
 *  contiene è un file che si porta dietro il guasto a ogni apertura. */
function normalizzaArco(e, vivi) {
  if (!e || e.da == null || e.a == null) return null;
  const da = str(e.da), a = str(e.a);
  if (da === a) return null;
  if (vivi && (!vivi[da] || !vivi[a])) return null;
  const o = { da, a };
  if (e.rel) o.rel = str(e.rel);
  if (e.cross) o.cross = true;
  if (e.bidir) o.bidir = true;
  return o;
}

/** Le leve arrivate, sopra quelle di partenza. Una leva assente non è una leva
 *  a zero: una mappa scritta da una versione di prima non deve ritrovarsi con
 *  le distanze azzerate. */
function normalizzaVista(v) {
  /* ⚠️ `zoom` e `chiusi` si ricostruiscono nuovi, non si copiano da `VISTA`:
     `Object.assign` copierebbe il riferimento, e l'oggetto di fabbrica è UNO
     SOLO per tutte le mappe del vault. Bastava che qualcuno scrivesse dentro
     la vista di una mappa perché tutte le altre si ritrovassero i rami chiusi
     di quella — un guasto che non si vede finché non se ne aprono due. */
  const o = Object.assign({}, VISTA, { zoom: Object.assign({}, VISTA.zoom), chiusi: [] });
  const s = v || {};
  /* Il tipo del valore di fabbrica dice come si normalizza la leva arrivata.
     Vale per numeri, booleani e stringhe; `zoom` e `chiusi` non sono nessuno
     dei tre e hanno il loro ramo qui sotto — un array che cadesse in questo
     `str()` diventerebbe «n1,n2», cioè un solo id inesistente. */
  Object.keys(VISTA).forEach((k) => {
    if (k === 'zoom' || k === 'chiusi' || s[k] === undefined || s[k] === null) return;
    o[k] = typeof VISTA[k] === 'number' ? num(s[k], VISTA[k])
         : typeof VISTA[k] === 'boolean' ? !!s[k]
         : str(s[k]);
  });
  const z = s.zoom || {};
  o.zoom = { k: num(z.k, VISTA.zoom.k), x: num(z.x, VISTA.zoom.x), y: num(z.y, VISTA.zoom.y) };
  /* I rami chiusi: solo id, cioè solo stringhe non vuote. Non si numera qui e
     non si converte: un id di nodo nasce già stringa da `normalizzaNodo`, e
     accettare un 3 vorrebbe dire scriverne uno che non corrisponde a nessuno.
     I doppioni cadono perché chiudere due volte lo stesso ramo è chiuderlo una
     volta — `senzaRami` lo tratterebbe uguale, ma il file no: crescerebbe a
     ogni salvataggio. Gli id sconosciuti invece restano: la mappa può aver
     perso quel nodo per un annulla, e riportarlo indietro deve ritrovarlo
     chiuso com'era. */
  (Array.isArray(s.chiusi) ? s.chiusi : []).forEach((id) => {
    if (typeof id !== 'string' || id === '' || o.chiusi.indexOf(id) >= 0) return;
    o.chiusi.push(id);
  });
  return o;
}

/**
 * Una mappa comunque arrivata (da un file, dal renderer, da una semina) rimessa
 * nella forma su disco. Non lancia mai: ripara. È l'`entroSchema` delle mappe,
 * e come `grafo.sanitizza()` non crede a ciò che riceve.
 *
 * @param m       la mappa grezza
 * @param adesso  l'istante per le date che MANCANO (i test lo fissano). Qui
 *                `aggiornato` si conserva se c'è: rimettere l'ora corrente a
 *                ogni lettura farebbe risultare «modificate oggi» tutte le
 *                mappe di un corso solo per averlo aperto. A timbrarlo è
 *                `salva()`, che è l'unico posto in cui qualcosa cambia davvero.
 */
function entroFormato(m, adesso) {
  const src = m || {};
  const ora = adesso || new Date().toISOString();

  const nodi = [];
  const visti = {};
  (Array.isArray(src.nodi) ? src.nodi : []).forEach((n) => {
    const o = normalizzaNodo(n);
    if (!o || visti[o.id]) return;      // id doppio: gli archi diventerebbero ambigui
    visti[o.id] = true;
    nodi.push(o);
  });

  const archi = [];
  const coppie = {};
  (Array.isArray(src.archi) ? src.archi : []).forEach((e) => {
    const o = normalizzaArco(e, visti);
    if (!o) return;
    const k = o.da + '␟' + o.a;
    if (coppie[k]) return;
    coppie[k] = true;
    archi.push(o);
  });

  return {
    formato: FORMATO,
    titolo: str(src.titolo).trim() || 'Mappa senza titolo',
    corso: str(src.corso),
    lezioneId: str(src.lezioneId),
    capitoloId: src.capitoloId == null ? '' : str(src.capitoloId),
    // 'generata' = nata da «Modifica una copia»; 'utente' = fatta da zero
    origine: src.origine === 'generata' ? 'generata' : 'utente',
    creato: str(src.creato) || ora,
    aggiornato: str(src.aggiornato) || str(src.creato) || ora,
    nodi,
    archi,
    vista: normalizzaVista(src.vista)
  };
}

/** Il testo che finisce nel file. Indentato e con l'a capo finale: una mappa è
 *  un file dell'utente, e deve poter essere letta (e messa in un diff) a mano. */
function serializza(mappa) { return JSON.stringify(mappa, null, 2) + '\n'; }

/** Da testo a mappa. Lancia se il JSON è rotto: chi chiama deve poter dire
 *  «questa è illeggibile» invece di presentarne una vuota. */
function parse(raw) { return entroFormato(JSON.parse(raw)); }

/* ------------------------------------------------------------------ lettura */

/**
 * Elenca le mappe di un corso.
 * Cartella assente -> []. Qualsiasi altro errore di lettura della cartella -> throw.
 * Un singolo file illeggibile resta nell'elenco col nome del file e un campo
 * `errore`: sparire in silenzio è peggio che comparire rotto.
 */
function list(vaultPath, courseId) {
  const d = dir(vaultPath, courseId); const out = []; const rotti = [];
  let files;
  try { files = fs.readdirSync(d); }
  catch (e) { if (e.code === 'ENOENT') return out; throw e; }
  for (const f of files.sort()) {
    if (!f.toLowerCase().endsWith(EXT) || f.startsWith('_') || f.startsWith('.')) continue;
    try {
      const m = parse(fs.readFileSync(path.join(d, f), 'utf-8'));
      m.file = f;
      out.push(m);
    } catch (e) {
      rotti.push(f + ' (' + e.message + ')');
      /* Una riga con un nome e un errore, non un buco: una mappa che sparisce
         dall'elenco è una mappa che l'utente crede persa e rifà da capo, mentre
         il file è lì e basterebbe aprirlo. */
      out.push({
        formato: 0, file: f, titolo: f.replace(/\.json$/i, ''), errore: e.message,
        nodi: [], archi: [], vista: normalizzaVista(null)
      });
    }
  }
  if (rotti.length) out.rotti = rotti;
  return out;
}

/** Forma esplicita `{ mappe, error }`: l'errore va detto a chi legge, e
 *  contextBridge non porterebbe comunque le proprietà appese a un array. */
function read(vaultPath, courseId) {
  try {
    const mappe = list(vaultPath, courseId);
    return {
      mappe: mappe.map((m) => Object.assign({}, m)),
      error: mappe.rotti ? ('mappe illeggibili: ' + mappe.rotti.join(' · ')) : ''
    };
  } catch (e) {
    return { mappe: [], error: e.message };
  }
}

/** Le sole cose che servono a riempire un menu a tendina. Una mappa può avere
 *  centinaia di nodi, e rispedirli tutti a ogni apertura dell'elenco è peso che
 *  attraversa il ponte per niente. */
function sommario(m) {
  return {
    file: m.file || '', formato: m.formato, titolo: m.titolo,
    corso: m.corso || '', lezioneId: m.lezioneId || '', capitoloId: m.capitoloId || '',
    origine: m.origine || '', creato: m.creato || '', aggiornato: m.aggiornato || '',
    nodi: (m.nodi || []).length, archi: (m.archi || []).length,
    errore: m.errore || ''
  };
}

/** Elenco leggero: `{ mappe:[sommario], error }`. */
function elenco(vaultPath, courseId) {
  const r = read(vaultPath, courseId);
  return { mappe: r.mappe.map(sommario), error: r.error };
}

/**
 * Il nome di file è una foglia dentro `MAPPE/`, e nient'altro.
 *
 * ⚠️ Questo controllo c'era solo in `apri`, e le altre tre porte che toccano il
 * disco non l'avevano: `rimuovi(p, '../APPUNTI/prezioso.md')` cancellava
 * l'appunto e rispondeva «fatto», `salva` con lo stesso nome scriveva fuori
 * dalla cartella. Provato, non dedotto. Una regola che vale per una porta sola
 * non è una regola: è una porta chiusa in mezzo a tre aperte.
 */
function nomeValido(f) {
  const s = str(f);
  return !!s && s.indexOf('/') < 0 && s.indexOf('\\') < 0 && s.indexOf('..') < 0;
}

/** Una mappa sola, per nome di file. `{ mappa, error }`: la mappa che non c'è e
 *  la mappa illeggibile sono due cose diverse e vanno dette diverse. */
function apri(vaultPath, courseId, file) {
  const f = str(file);
  if (!nomeValido(f)) {
    return { mappa: null, error: 'nome di file non valido: ' + f };
  }
  try {
    const m = parse(fs.readFileSync(path.join(dir(vaultPath, courseId), f), 'utf-8'));
    m.file = f;
    return { mappa: m, error: '' };
  } catch (e) {
    if (e.code === 'ENOENT') return { mappa: null, error: 'la mappa «' + f + '» non esiste' };
    return { mappa: null, error: e.message };
  }
}

/* ---------------------------------------------------------------- scrittura */

/**
 * Nome file leggibile dal titolo, con suffisso « 2» sulle collisioni.
 *
 * `escludi` è il file che si sta rinominando: senza, rinominare una mappa senza
 * cambiarle il titolo la chiamerebbe «… 2» perché collide con se stessa. Il
 * confronto è a minuscole perché il filesystem di macOS non distingue il caso:
 * «Mappa.json» e «mappa.json» sono lo stesso file, e `existsSync` lo dice.
 */
/**
 * ⚠️ Un titolo non deve poter produrre un file che l'app poi non sa più
 * gestire, e `safeName` da solo lo permette in due modi — verificati:
 *  · «Cap.. 3» diventa `Cap.. 3.json`, che `nomeValido` rifiuta per sempre: la
 *    mappa compare nell'elenco e non si apre più;
 *  · «_bozza» diventa `_bozza.json`, che `list()` salta di proposito (i file
 *    che cominciano per `_` o `.` non sono mappe): la mappa esiste su disco e
 *    dall'app non si vede.
 * In tutti e due i casi `salva` risponde «fatto». Il posto giusto per impedirlo
 * è qui, dove il nome nasce, non nei tre chiamanti che dovrebbero ricordarsene.
 */
function nomeSicuro(s) {
  const b = String(s).replace(/\.{2,}/g, '.').replace(/^[_.\s]+/, '').trim();
  return b || 'Mappa';
}

function nomeFile(vaultPath, courseId, titolo, escludi) {
  const base = nomeSicuro(appunti.safeName(str(titolo).trim() || 'Mappa'));
  const d = dir(vaultPath, courseId);
  const suo = str(escludi).toLowerCase();
  const libero = (nome) => nome.toLowerCase() === suo || !fs.existsSync(path.join(d, nome));
  let nome = base + EXT, i = 1;
  while (!libero(nome)) { i++; nome = base + ' ' + i + EXT; }
  return nome;
}

/**
 * Scrive una mappa. `file` assente = mappa nuova, il nome nasce dal titolo.
 * Restituisce `{ file, mappa }`, oppure `{ error }` se il disco ha detto di no.
 *
 * `MAPPE/` si crea qui e solo qui: nessuna pipeline la deve far nascere, così
 * un corso senza mappe non ha la cartella e l'assenza vuol dire davvero
 * «nessuna mappa».
 */
function salva(vaultPath, courseId, file, mappa, adesso) {
  try {
    const d = dir(vaultPath, courseId);
    fs.mkdirSync(d, { recursive: true });
    const ora = adesso || new Date().toISOString();
    // qui e solo qui `aggiornato` prende l'ora: è l'unico momento in cui la
    // mappa cambia davvero, e la data serve a ordinare l'elenco per uso recente
    const m = entroFormato(Object.assign({}, mappa, {
      corso: (mappa && mappa.corso) || courseId, aggiornato: ora
    }), ora);
    // un nome scelto da chi chiama vale solo se è una foglia di `MAPPE/`:
    // senza questo, `salva(p, '../evaso.json', m)` scriveva fuori e diceva sì
    if (file && !nomeValido(file)) return { error: 'nome di file non valido: ' + str(file) };
    const nome = str(file) || nomeFile(vaultPath, courseId, m.titolo);
    appunti.writeAtomic(path.join(d, nome), serializza(m));
    m.file = nome;
    return { file: nome, mappa: m };
  } catch (e) {
    return { error: e.message };
  }
}

/** Cancella una mappa. `false` se il nome non è una mappa di questa cartella,
 *  se non c'era, o se il disco ha rifiutato. */
function rimuovi(vaultPath, courseId, file) {
  if (!nomeValido(file)) return false;
  try { fs.unlinkSync(path.join(dir(vaultPath, courseId), str(file))); return true; }
  catch (e) { return false; }
}

/**
 * Rinomina: cambia il titolo DENTRO la mappa e il nome del file di conseguenza.
 *
 * I due devono restare d'accordo — un file «Sistema nervoso.json» che dentro
 * dice «Bozza» è il tipo di doppia verità che poi nessuno sa quale credere. Il
 * contenuto si riscrive comunque, perché il titolo sta lì dentro; il rename del
 * file è solo la seconda metà.
 */
function rinomina(vaultPath, courseId, file, titolo) {
  const vecchio = str(file);
  const r = apri(vaultPath, courseId, vecchio);
  if (!r.mappa) return { error: r.error };
  const t = str(titolo).trim();
  if (!t) return { error: 'una mappa senza titolo non si distinguerebbe dalle altre' };
  try {
    const d = dir(vaultPath, courseId);
    const nuovo = nomeFile(vaultPath, courseId, t, vecchio);
    r.mappa.titolo = t;
    const esito = salva(vaultPath, courseId, nuovo, r.mappa);
    if (esito.error) return esito;
    /* Il vecchio si toglie DOPO che il nuovo è a posto: se la scrittura fallisse
       a metà, la mappa resterebbe comunque leggibile col nome di prima.

       ⚠️ Ma «vecchio e nuovo sono lo stesso file?» non si decide confrontando i
       due NOMI, e qui si confrontavano. Su macOS il volume non distingue le
       maiuscole: rinominando «Neuroni» in «neuroni», `nomeFile` considerava
       libero `neuroni.json` (è il file stesso, il suo confronto è a minuscole),
       `salva` lo scriveva — cioè riscriveva LO STESSO FILE — e poi questa riga,
       che confrontava i nomi con le maiuscole, lo trovava «diverso» e lo
       cancellava. Esito misurato: cartella vuota, `elenco()` a zero, e la
       risposta era `{file:'neuroni.json'}`, cioè «fatto». Correggere le
       maiuscole di un titolo distruggeva la mappa senza dirlo.

       Lo dice il filesystem, non il nome: stesso inode e stesso dispositivo
       vuol dire stesso file. Funziona anche dove le maiuscole contano, e lì il
       vecchio se ne va davvero come deve. */
    if (nuovo !== vecchio) {
      const pv = path.join(d, vecchio), pn = path.join(d, nuovo);
      let stesso = false;
      try {
        const a = fs.statSync(pv), b = fs.statSync(pn);
        stesso = (a.ino === b.ino && a.dev === b.dev);
      } catch (e) { stesso = false; }
      if (!stesso) { try { fs.unlinkSync(pv); } catch (e) {} }
      else {
        /* Cambiate solo le maiuscole, il file è uno: il volume non le distingue
           e `rename` non riscrive il caso della voce già esistente, quindi su
           disco resta `Neuroni.json` mentre dentro il titolo dice «neuroni».
           Si torna il nome VERO, non quello chiesto: chi chiama lo userà per
           riaprirla e per ritrovarla nell'elenco, e un nome che `list()` non
           elenca lo lascerebbe agganciato a una mappa che sembra sparita.
           La divergenza che resta è di sole maiuscole, ed è detta qui invece di
           essere scoperta poi. */
        esito.file = vecchio;
        if (esito.mappa) esito.mappa.file = vecchio;
      }
    }
    return esito;
  } catch (e) {
    return { error: e.message };
  }
}

/* -------------------------------------------------------------- «una copia» */

/**
 * Da un grafo GENERATO alla mappa dell'utente — la funzione dietro «Modifica
 * una copia». Pura: costruisce l'oggetto, non tocca il disco (`semina` scrive).
 *
 * Tutti i nodi nascono `origine:'generata'`. Non è una formalità: da qui in poi
 * l'utente aggiungerà nodi suoi (`utente`) ed estratti dalla fonte (`fonte`), e
 * quella marca è ciò che a colpo d'occhio dice che cosa era già lì e che cosa
 * ci ha messo lui — la distinzione cromatica di Braynr (PIANO §3). Perso quel
 * campo, la distinzione non si può più ricostruire da nulla.
 *
 * @param grafo  ciò che `MappaGenera.daCapitolo/daLezione` produce: {nodi, archi, titolo}
 * @param meta   { titolo, corso, lezioneId, capitoloId, vista }
 */
function daGrafo(grafo, meta, adesso) {
  const g = grafo || {};
  const m = meta || {};
  return entroFormato({
    // il titolo della mappa: quello chiesto, altrimenti quello del capitolo o
    // della lezione da cui nasce — che è già la frase con cui l'utente la riconosce
    titolo: str(m.titolo).trim() || str(g.titolo).trim() || 'Mappa',
    corso: m.corso, lezioneId: m.lezioneId, capitoloId: m.capitoloId,
    origine: 'generata',
    creato: m.creato,
    nodi: (g.nodi || []).map((n) => Object.assign({}, n, { origine: 'generata' })),
    archi: g.archi || [],
    // le leve con cui la si stava guardando quando si è premuto «Modifica una
    // copia»: la copia deve aprirsi com'era, non con i valori di fabbrica
    vista: m.vista
  }, adesso);
}

/** `daGrafo` + scrittura. È la funzione che chiama l'interfaccia. */
function semina(vaultPath, courseId, grafo, meta, adesso) {
  const m = daGrafo(grafo, Object.assign({ corso: courseId }, meta || {}), adesso);
  if (!m.nodi.length) return { error: 'la mappa generata è vuota: non c\'è niente da copiare' };
  return salva(vaultPath, courseId, null, m, adesso);
}

module.exports = {
  CARTELLA, EXT, FORMATO, CAMPI_NODO, CAMPI_ARCO, ORIGINI, VISTA,
  dir, normalizzaNodo, normalizzaArco, normalizzaVista, entroFormato, serializza, parse,
  list, read, sommario, elenco, apri, nomeFile, salva, rimuovi, rinomina, daGrafo, semina
};
