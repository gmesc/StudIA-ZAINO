'use strict';
/**
 * percorsi — le varianti di percorso di un corso, e la cache delle scalette.
 *
 * Dalla stessa base di materiali si ricavano più percorsi per studenti dello
 * STESSO livello ma con modi di imparare diversi. Un percorso non è una copia
 * del corso: è una mappa `lezione → indice scelto`, poche righe. L'unità di
 * lavoro è la COPPIA lezione+indice, e due percorsi che scelgono lo stesso indice
 * per una lezione condividono quei capitoli — si scrivono una volta sola. È ciò
 * che rende sostenibile fare otto varianti: altrimenti si pagherebbe otto volte
 * il materiale su cui otto studenti sono d'accordo.
 *
 * Sul disco:
 *
 *   Corsi/<id>/
 *   ├── _lavorazione/scalette/<folder>.json   le alternative proposte per una lezione
 *   └── PERCORSI/<personaggio>.json           la mappa lezione → indice di un percorso
 *
 * Le scalette stanno in `_lavorazione/` perché sono un intermedio pagato al
 * modello: si tengono per non ricomprarle a ogni apertura del composer. I
 * percorsi stanno in chiaro perché sono una scelta dell'utente, non un residuo
 * di lavorazione.
 */

const fs = require('fs');
const path = require('path');
const corsi = require('./corsi');

/**
 * Gli otto personaggi: stesso livello, modi di imparare diversi.
 *
 * Animali e non persone di proposito: sono glifi a codepoint singolo, che
 * OpenMoji rende sempre. Le emoji «professione» sono sequenze ZWJ e cadono sul
 * font di sistema, che su macOS vuol dire glifi Apple in mezzo a icone OpenMoji.
 */
const PERSONAGGI = [
  { id: 'gufo',     emoji: '🦉', nome: 'Analitica',   colore: '#3b82f6', desc: 'vuole andare a fondo di un tema per intero prima di passare oltre' },
  { id: 'tarta',    emoji: '🐢', nome: 'Sequenziale', colore: '#0f766e', desc: 'segue la logica dell\'autore senza saltare, un passo alla volta' },
  { id: 'volpe',    emoji: '🦊', nome: 'Sintetica',   colore: '#f97316', desc: 'poco tempo: vuole l\'essenziale prima, i dettagli solo se servono' },
  { id: 'ape',      emoji: '🐝', nome: 'Pratica',     colore: '#a16207', desc: 'capisce facendo: parte dal caso concreto e risale alla regola' },
  { id: 'polpo',    emoji: '🐙', nome: 'Trasversale', colore: '#7c3aed', desc: 'tiene aperti più fili insieme e ama i rimandi fra i temi' },
  { id: 'coniglio', emoji: '🐇', nome: 'Curioso',     colore: '#db2777', desc: 'parte sempre da una domanda propria, non dall\'indice' },
  { id: 'elefante', emoji: '🐘', nome: 'Ripassatore', colore: '#65a30d', desc: 'ha bisogno di tornare più volte sulle stesse cose' },
  { id: 'aquila',   emoji: '🦅', nome: 'Panoramica',  colore: '#0891b2', desc: 'vuole la mappa d\'insieme prima di entrare nel dettaglio' }
];

function personaggio(id) { return PERSONAGGI.find((p) => p.id === id) || null; }

/** Riduce un nome a nome di file: minuscolo, senza accenti, solo lettere, cifre e trattini. */
function slug(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'percorso';
}

// ------------------------------------------------------------------- cartelle

const CARTELLA = 'PERCORSI';
function dir(vault, corso) { return path.join(corsi.cartella(vault, corso), CARTELLA); }
function scaletteDir(vault, corso) { return path.join(corsi.lavorazione(vault, corso), 'scalette'); }

function scriviJson(file, dati) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(dati, null, 2) + '\n', 'utf-8');
  fs.renameSync(tmp, file);
  return file;
}
function leggiJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch (e) { return null; }
}

// ------------------------------------------------------------------ scalette

/** Le alternative già proposte per una lezione, o null se non sono mai state chieste. */
function leggiScaletta(vault, corso, folder) {
  return leggiJson(path.join(scaletteDir(vault, corso), slug(folder) + '.json'));
}

/** Tutte le scalette in cache: mappa folder → { alternative, quando, nCapitoli }. */
function leggiScalette(vault, corso) {
  const out = {};
  let files; try { files = fs.readdirSync(scaletteDir(vault, corso)); } catch (e) { return out; }
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const d = leggiJson(path.join(scaletteDir(vault, corso), f));
    if (d && d.folder) out[d.folder] = d;
  }
  return out;
}

/**
 * Mette in cache le alternative di una lezione.
 * `nCapitoli` viene registrato con loro: riaprendo il composer si deve poter
 * vedere con quale vincolo erano state chieste, altrimenti «5 capitoli» sembra
 * una scelta del modello anche quando era una richiesta esplicita.
 */
function scriviScaletta(vault, corso, folder, alternative, nCapitoli) {
  return scriviJson(path.join(scaletteDir(vault, corso), slug(folder) + '.json'), {
    folder: folder,
    quando: new Date().toISOString(),
    nCapitoli: (typeof nCapitoli === 'number' && nCapitoli > 0) ? nCapitoli : null,
    alternative: alternative || []
  });
}

// ------------------------------------------------- cartelle delle coppie lezione+indice

/**
 * L'unità di lavoro è la coppia lezione+indice, e sul disco è una cartella:
 * `03-delega--per-domande`. Il suffisso c'è SEMPRE, anche quando oggi la
 * variante è una sola: se comparisse solo alla seconda, la prima dovrebbe
 * cambiare nome — e con lei i rimandi `[[03-delega]]` già scritti dentro gli
 * altri capitoli, che nessuno si accorgerebbe di aver rotto finché un allievo
 * non ci clicca sopra.
 *
 * La cartella senza suffisso resta quella dei capitoli scritti dal wizard, una
 * lezione per volta: le due strade convivono senza pestarsi.
 */
const SEP = '--';

/** Base e variante di una cartella-lezione: `03-delega--per-domande` → { base, variante }. */
function scomponi(folder) {
  const s = String(folder || '');
  const i = s.indexOf(SEP);
  return i < 0 ? { base: s, variante: '' } : { base: s.slice(0, i), variante: s.slice(i + SEP.length) };
}

/**
 * I nomi con cui un rimando `[[NN-slug]]` può chiamare le lezioni di un corso.
 *
 * ⚠️ Non è l'elenco delle cartelle, ed è qui che nascevano otto rimandi morti:
 * una lezione con varianti si cita con la **base** (`04-delegation`), mai con la
 * cartella (`04-delegation--scaletta-a`). Quale variante si legge lo decide il
 * percorso attivo; un rimando che nomina la variante porta l'allievo fuori dal
 * percorso che sta seguendo, e lo fa senza dirlo.
 *
 * Le lezioni ancora senza capitoli ci sono lo stesso, ed è voluto: durante la
 * generazione un corso si scrive una lezione per volta, e il **rimando in
 * avanti** — la 01 che annuncia la 04 — è la cosa che rende un corso un corso.
 * Togliere dalla lista ciò che non è ancora scritto significherebbe farlo
 * cancellare da `togliWikilinkRotti` proprio mentre lo si sta costruendo.
 * Quello che è morto ADESSO lo dice `nomiRaggiungibili`, che è l'altra domanda.
 *
 * @param lezioni [{ folder }] oppure un elenco di nomi di cartella
 */
function nomiRimandabili(lezioni) {
  const out = new Set();
  for (const l of lezioni || []) {
    const folder = typeof l === 'string' ? l : (l && l.folder);
    if (folder) out.add(scomponi(folder).base);
  }
  return Array.from(out).sort((a, b) => a.localeCompare(b, 'it'));
}

/**
 * I nomi che il lettore sa aprire ADESSO: come `nomiRimandabili`, ma solo le
 * lezioni che hanno almeno un capitolo, in sé o in una variante.
 *
 * Una cartella senza capitoli non è una destinazione: la base di una lezione
 * variantizzata resta sul disco come segnaposto con il solo `_lezione.md`, e chi
 * guarda il disco la vede «esistere» — ma l'app non la carica (`preload.js`:
 * `if (chapters.length)`). Serve a chi deve DIRE che un rimando è rotto, non a
 * chi deve decidere se scriverlo.
 *
 * @param lezioni [{ folder, capitoli }] — `capitoli` è il CONTEGGIO dei capitoli
 */
function nomiRaggiungibili(lezioni) {
  return nomiRimandabili((lezioni || []).filter((l) => l && l.capitoli > 0));
}

/**
 * I nomi di cartella delle alternative di una lezione, uno per indice e nello
 * stesso ordine. Due alternative possono chiamarsi uguale — il modello non
 * promette nomi distinti — e due cartelle con lo stesso nome sarebbero una
 * cartella sola: i doppioni prendono un suffisso numerico, in modo
 * deterministico, così il nome non cambia da una chiamata all'altra.
 */
function cartelleAlternative(folder, alternative) {
  const base = scomponi(folder).base;
  const viste = {};
  return (alternative || []).map((a) => {
    // `slug()` ha già il suo ripiego («percorso»), che qui direbbe la cosa sbagliata:
    // questa è la cartella di un INDICE, e un indice senza nome si chiama così
    let s = (a && a.nome) ? slug(a.nome) : 'indice';
    viste[s] = (viste[s] || 0) + 1;
    if (viste[s] > 1) s = s + '-' + viste[s];
    return base + SEP + s;
  });
}

/** La cartella dell'indice che un percorso ha scelto per una lezione, o null se non ha scelto. */
function cartellaDi(percorso, folder, scalette) {
  const s = percorso && percorso.scelte && percorso.scelte[folder];
  if (!s) return null;
  const alt = (scalette && scalette[folder] && scalette[folder].alternative) || [];
  const nomi = cartelleAlternative(folder, alt);
  return nomi[s.indice] || null;
}

/**
 * Scrive dentro ogni scelta la cartella della coppia.
 *
 * Serve al lettore: per sapere quale cartella appartiene a una variante
 * dovrebbe altrimenti rileggersi le scalette e rifare il conto dei nomi
 * duplicati — cioè conoscere una regola che non lo riguarda. La cartella si
 * calcola una volta sola, quando si salva, e resta scritta nel percorso.
 */
function conCartelle(percorsi, scalette) {
  return (percorsi || []).map((p) => {
    const scelte = {};
    for (const [folder, s] of Object.entries(p.scelte || {})) {
      const alt = (scalette && scalette[folder] && scalette[folder].alternative) || [];
      const a = alt[s.indice];
      /* ⚠️ `s.cartella` come ripiego, e non è pignoleria: le scalette stanno in
         `_lavorazione/`, che è cache — si butta, e si ricompra. Quando non ci
         sono, `cartelleAlternative` torna una lista vuota e qui si scriveva
         `cartella: null` DENTRO il percorso salvato. Da lì il lettore non
         trovava più nessuna cartella da mostrare e la lezione spariva: misurato
         sul percorso «Analitica», 7 scelte su 7 azzerate da un salvataggio, con
         tutti i capitoli intatti sul disco. Perdere la cache è normale;
         cancellare per questo la scelta dell'utente no. «Non lo so» non è
         «nessuna» — è la stessa regola di `album.usi()`. */
      scelte[folder] = Object.assign({}, s, {
        nome: s.nome || (a && a.nome) || '',
        capitoli: typeof s.capitoli === 'number' ? s.capitoli : (a ? (a.capitoli || []).length : 0),
        cartella: cartelleAlternative(folder, alt)[s.indice] || s.cartella || null
      });
    }
    return Object.assign({}, p, { scelte });
  });
}

/**
 * Le coppie lezione+indice da scrivere, una per cartella, con l'elenco dei
 * percorsi che le usano.
 *
 * `usataDa` non è decorazione: rigenerare un indice condiviso riscrive i
 * capitoli di tutti i percorsi che lo hanno scelto, e va detto **prima** di
 * premere — «questo indice è usato da 3 percorsi».
 */
function coppieDaScrivere(percorsi, scalette) {
  const per = {};
  for (const p of (percorsi || [])) {
    for (const [folder, s] of Object.entries(p.scelte || {})) {
      const alt = (scalette && scalette[folder] && scalette[folder].alternative) || [];
      const a = alt[s.indice];
      if (!a) continue;
      const cartella = cartelleAlternative(folder, alt)[s.indice];
      const k = cartella;
      if (!per[k]) {
        per[k] = { folder, indice: s.indice, cartella, nome: a.nome || '',
                   capitoli: a.capitoli || [], usataDa: [] };
      }
      per[k].usataDa.push(p.id);
    }
  }
  return Object.values(per).sort((x, y) => x.cartella.localeCompare(y.cartella, 'it', { numeric: true }));
}

/**
 * Butta via le scalette delle cartelle che non valgono più, e le scelte dei
 * percorsi che le usavano.
 *
 * Il taglio delle lezioni si corregge nel composer, e ogni correzione rinumera le
 * cartelle: unirne due fa scalare tutte quelle che seguono. Una scaletta rimasta
 * appesa al vecchio nome sarebbe **peggio** di una mancante — sembrerebbe la
 * scaletta di quella lezione, e proporrebbe capitoli su materiali che quella
 * lezione non ha più. Meglio una riga vuota che dice «proponi», e si ripaga.
 */
function invalida(vault, corso, cartelle) {
  const morte = new Set(cartelle || []);
  if (!morte.size) return { scalette: [], percorsi: [] };
  const scalette = [];
  for (const folder of morte) {
    const f = path.join(scaletteDir(vault, corso), slug(folder) + '.json');
    try { fs.unlinkSync(f); scalette.push(folder); } catch (e) {}
  }
  const toccati = [];
  for (const p of leggiTutti(vault, corso)) {
    const scelte = {};
    let cambiato = false;
    for (const [folder, s] of Object.entries(p.scelte || {})) {
      if (morte.has(folder)) { cambiato = true; continue; }
      scelte[folder] = s;
    }
    if (!cambiato) continue;
    if (Object.keys(scelte).length) scrivi(vault, corso, Object.assign({}, p, { scelte }));
    else elimina(vault, corso, p.id);     // un percorso senza più scelte non è un percorso
    toccati.push(p.id);
  }
  return { scalette, percorsi: toccati };
}

/** I file di capitolo di una cartella-lezione: la cartella è la fonte affidabile, non il registro. */
function capitoliSulDisco(vault, corso, cartella) {
  try {
    return fs.readdirSync(corsi.lezioneDir(vault, corso, cartella))
      .filter((f) => /^\d+.*\.md$/.test(f)).sort();
  } catch (e) { return []; }
}

/**
 * La cartella di una coppia e il suo `_lezione.md`.
 *
 * Il titolo resta quello della lezione base: due varianti della stessa lezione
 * sono la stessa lezione, e chiamarle «Delega (per domande)» le farebbe leggere
 * come due lezioni diverse nell'indice. Che cosa le distingue sta in `variante`,
 * che il lettore usa per mostrare una versione per volta.
 *
 * Riscrivendo, i capitoli vecchi si cancellano PRIMA: la cartella appartiene
 * per intero alla coppia, e lasciarli lì significherebbe ritrovarsi due
 * versioni dello stesso capitolo con numeri uguali e slug diversi, senza modo
 * di sapere quale sia quella buona. Il `_lezione.md` invece non si sovrascrive:
 * ordine e stato dei capitoli li tiene chi scrive.
 */
function preparaCartella(vault, corso, lezione, coppia, opts) {
  const o = opts || {};
  const mdser = require('./mdser');
  const dir = corsi.lezioneDir(vault, corso, coppia.cartella);
  fs.mkdirSync(dir, { recursive: true });
  const tolti = [];
  if (o.riscrivi) {
    for (const f of capitoliSulDisco(vault, corso, coppia.cartella)) {
      try { fs.unlinkSync(path.join(dir, f)); tolti.push(f); } catch (e) {}
    }
  }
  const file = corsi.fileLezione(dir);
  if (!fs.existsSync(file)) {
    let raw = mdser.lezione({
      id: coppia.cartella, title: lezione.title, area: lezione.area || '',
      materiali: (lezione.materiali || []).map((m) => (m && (m.num || m.source)) || m),
      status: 'approvato', ordineCapitoli: [],
      nota: 'Variante «' + coppia.nome + '» della lezione ' + coppia.folder + '.'
    });
    raw = mdser.upsertFmLine(raw, 'variante', 'variante: ' + mdser.yq(coppia.nome || ''));
    raw = mdser.upsertFmLine(raw, 'lezione_base', 'lezione_base: ' + mdser.yq(coppia.folder));
    fs.writeFileSync(file, raw, 'utf-8');
  }
  return { dir, tolti };
}

// ------------------------------------------------------------------ percorsi

/** I percorsi salvati, in ordine di personaggio. */
function leggiTutti(vault, corso) {
  let files; try { files = fs.readdirSync(dir(vault, corso)); } catch (e) { return []; }
  const out = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const d = leggiJson(path.join(dir(vault, corso), f));
    if (d && d.id) out.push(d);
  }
  const ordine = PERSONAGGI.map((p) => p.id);
  return out.sort((a, b) => ordine.indexOf(a.id) - ordine.indexOf(b.id));
}

/**
 * Salva un percorso. Il nome del file è l'id del personaggio, non il nome dato
 * dall'utente: rinominare la variante non deve lasciare due file dove prima ce
 * n'era uno.
 */
function scrivi(vault, corso, percorso) {
  const p = personaggio(percorso && percorso.id);
  if (!p) throw new Error('personaggio sconosciuto: ' + (percorso && percorso.id));
  const prima = leggiJson(path.join(dir(vault, corso), p.id + '.json'));
  const ora = new Date().toISOString();
  return scriviJson(path.join(dir(vault, corso), p.id + '.json'), {
    id: p.id, emoji: p.emoji,
    nome: String(percorso.nome || p.nome).slice(0, 60),
    slug: slug(percorso.nome || p.nome),
    creato: (prima && prima.creato) || ora,
    aggiornato: ora,
    scelte: percorso.scelte || {}
  });
}

function elimina(vault, corso, id) {
  try { fs.unlinkSync(path.join(dir(vault, corso), slug(id) + '.json')); return true; }
  catch (e) { return false; }
}

/**
 * Riscrive l'insieme dei percorsi: quelli passati si salvano, quelli spariti si
 * cancellano. Il composer manda sempre lo stato intero, e togliere un
 * personaggio da tutte le card deve togliere anche il suo file — altrimenti il
 * menu in topbar continuerebbe a mostrare una variante che non esiste più.
 */
function salvaTutti(vault, corso, percorsi) {
  const tenere = new Set();
  for (const p of (percorsi || [])) { scrivi(vault, corso, p); tenere.add(p.id); }
  for (const vecchio of leggiTutti(vault, corso)) if (!tenere.has(vecchio.id)) elimina(vault, corso, vecchio.id);
  return leggiTutti(vault, corso);
}

// -------------------------------------------------------------- conti e buchi

/** Le lezioni per cui un percorso non ha ancora scelto un indice. */
function buchi(percorso, folders) {
  const scelte = (percorso && percorso.scelte) || {};
  return (folders || []).filter((f) => !(f in scelte));
}

/** Quante volte ogni coppia lezione+indice è usata: chiave `folder:indice`. */
function coppie(percorsi) {
  const out = {};
  for (const p of (percorsi || [])) {
    for (const [folder, s] of Object.entries(p.scelte || {})) {
      const k = folder + ':' + s.indice;
      out[k] = (out[k] || 0) + 1;
    }
  }
  return out;
}

/**
 * Quanti capitoli si scrivono davvero, e quanti se ne risparmiano.
 *
 * `ingenui` è la somma dei capitoli di ogni percorso presi uno per uno;
 * `daScrivere` conta le coppie DISTINTE. La differenza è il senso stesso della
 * struttura: va mostrata, perché è l'unica ragione per cui otto varianti non
 * costano otto volte.
 */
function conteggio(percorsi, scalette) {
  const usate = coppie(percorsi);
  let daScrivere = 0, ingenui = 0;
  for (const [k, quanti] of Object.entries(usate)) {
    const i = k.lastIndexOf(':');
    const folder = k.slice(0, i), idx = Number(k.slice(i + 1));
    const alt = scalette && scalette[folder] && (scalette[folder].alternative || [])[idx];
    const n = alt ? (alt.capitoli || []).length : 0;
    daScrivere += n;
    ingenui += n * quanti;
  }
  return { daScrivere, ingenui, risparmiati: ingenui - daScrivere };
}

module.exports = {
  PERSONAGGI, personaggio, slug, CARTELLA, SEP, dir, scaletteDir,
  leggiScaletta, leggiScalette, scriviScaletta,
  leggiTutti, scrivi, elimina, salvaTutti,
  scomponi, nomiRimandabili, nomiRaggiungibili, cartelleAlternative, cartellaDi, conCartelle, coppieDaScrivere,
  capitoliSulDisco, preparaCartella, invalida,
  buchi, coppie, conteggio
};
