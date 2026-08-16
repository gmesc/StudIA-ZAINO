'use strict';
/**
 * zaini — il contenitore della modalità ZAINO.
 *
 * Uno zaino è dove si studia sui PROPRI documenti: si caricano dei PDF, si
 * legge, e si usano gli strumenti — evidenziatore, appunti, mappe, album. Non
 * c'è pipeline, non c'è modello che scrive, non ci sono capitoli generati.
 * Quello che c'è dentro l'ha messo una persona.
 *
 * ── Perché uno zaino ha la stessa FORMA di un corso ────────────────────────
 *
 * Sul disco:
 *
 *     Zaini/<id>/
 *       _zaino.md                titolo e data, niente altro
 *       MATERIALI/PDF/           i documenti, copiati dentro il vault
 *       MATERIALI/Indici-PDF/    il testo per pagina — SOLO per la ricerca
 *       APPUNTI/  MAPPE/  ALBUM/ i dati dell'utente, come in un corso
 *
 * ⚠️ `MATERIALI/PDF/` e non `FONTI/`, per quanto «fonti» sia la parola giusta:
 * è la stessa forma di un corso, quindi `materiali.js`, `openPdf`, l'album e i
 * rimandi `pdf:NN#p=7` funzionano identici. Una cartella con un altro nome
 * vorrebbe dire un secondo percorso nel codice per ogni cosa che cerca un
 * documento, e i secondi percorsi in questo progetto si pagano due volte.
 *
 * ── Il perno, e perché questo file è così corto ────────────────────────────
 *
 * Appunti, mappe, album ed evidenze non sanno niente degli zaini, e non devono
 * saperlo: chiedono tutti la cartella a `corsi.cartella(vault, id)`, che è
 * l'unico punto in cui si decide dove stanno i dati di chi studia. Quella
 * funzione adesso risolve **due radici** — `Corsi/` e `Zaini/` — con lo stesso
 * `primoCheEsiste()` che usava già per tollerare i vault mai migrati da
 * `Progetti/`. Quattro moduli funzionano nello zaino senza una riga nuova.
 *
 * ⚠️ Il prezzo di quella scelta sta qui dentro, in `crea()`: **un id non può
 * esistere in tutte e due le radici**. Uno zaino e un corso omonimi punterebbero
 * alla stessa cartella per metà del codice, e sarebbe un guasto silenzioso — le
 * mappe dell'uno che compaiono nell'altro. La guardia va dove il nome si
 * sceglie, non dove si legge: dopo è troppo tardi.
 *
 * Niente DOM, niente Electron: gira in Node e si prova con `node test/zaini.js`.
 */

const fs = require('fs');
const path = require('path');
const mdser = require('./mdser');
const corsiLib = require('./corsi');
const mat = require('./materiali');
const profilo = require('./profilo');   // il parser del frontmatter ristretto, come in corsi.js

const RADICE = 'Zaini';
const FILE = '_zaino.md';

/** Le cartelle che uno zaino ha appena nato: i documenti, il loro indice, i dati di chi studia. */
const SOTTOCARTELLE = [
  path.join(mat.CARTELLA, 'PDF'),
  path.join(mat.CARTELLA, 'Indici-PDF'),
  'APPUNTI', 'MAPPE', 'ALBUM'
];

/**
 * Il nome di uno zaino è una cartella, e nient'altro.
 *
 * ⚠️ La stessa guardia di `mappe.nomeValido` e di `evidenze.corsoValido`, per la
 * stessa ragione già pagata là: l'identificatore arriva da fuori, e con `..`
 * esce dal vault. Qui la porta è l'unica che crea cartelle, quindi lasciarla
 * aperta vorrebbe dire poter fabbricare una `APPUNTI/` in casa di chiunque.
 */
function nomeValido(id) {
  const s = String(id == null ? '' : id);
  return !!s && s === path.basename(s) && s !== '.' && s !== '..' && !s.startsWith('.');
}

/** La cartella che raccoglie gli zaini. */
function radice(vault) { return path.join(vault, RADICE); }

/** La cartella di uno zaino. */
function cartella(vault, id) { return path.join(radice(vault), id); }

/** Il file che descrive lo zaino. */
function fileZaino(vault, id) { return path.join(cartella(vault, id), FILE); }

/**
 * Questo id è uno zaino?
 *
 * ⚠️ Si guarda `_zaino.md`, non la cartella: una cartella `Zaini/<id>/` vuota —
 * lasciata da una creazione interrotta o creata a mano — non è uno zaino, e
 * dirlo eviterebbe di aprire una modalità su niente.
 */
function esiste(vault, id) {
  if (!vault || !nomeValido(id)) return false;
  try { return fs.statSync(fileZaino(vault, id)).isFile(); } catch (e) { return false; }
}

/** Quel nome è già preso, in una qualunque delle due radici? */
function idOccupato(vault, id) {
  for (const dir of [cartella(vault, id), path.join(corsiLib.radice(vault), id)]) {
    try { if (fs.statSync(dir).isDirectory()) return true; } catch (e) { /* non c'è: libero */ }
  }
  return false;
}

/** Quanti documenti ci sono dentro: il numero che ha senso mostrare accanto al nome. */
function quantiDocumenti(vault, id) {
  try {
    return fs.readdirSync(path.join(cartella(vault, id), mat.CARTELLA, 'PDF'))
      .filter((n) => !n.startsWith('.') && /\.pdf$/i.test(n)).length;
  } catch (e) { return 0; }
}

/**
 * Gli zaini del vault, in ordine alfabetico.
 *
 * ⚠️ Un vault che non ha mai visto uno zaino non ha la cartella `Zaini/`, e
 * questo non è un errore: è la condizione normale di chi usa solo i corsi. Si
 * torna un elenco vuoto, non si crea niente — la cartella nasce al primo zaino.
 */
function elenco(vault) {
  if (!vault) return [];
  let dirs;
  try { dirs = fs.readdirSync(radice(vault), { withFileTypes: true }); } catch (e) { return []; }
  const out = [];
  for (const d of dirs) {
    if (!d.isDirectory() || d.name.startsWith('.')) continue;
    if (!esiste(vault, d.name)) continue;
    let raw = ''; try { raw = fs.readFileSync(fileZaino(vault, d.name), 'utf-8'); } catch (e) {}
    const fm = profilo.parse(raw);
    out.push({ id: d.name, title: fm.title || d.name, creato: fm.creato || '',
      documenti: quantiDocumenti(vault, d.name) });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id, 'it'));
}

/** Il testo di `_zaino.md`. Corto per scelta: qui non c'è un brief da compilare. */
function testoZaino(id, titolo, quando) {
  const fm = [['id', id], ['title', titolo], ['tipo', 'zaino'], ['creato', quando || '']];
  return mdser.frontmatter(fm) + '\n\n# ' + titolo + '\n\n' +
    'I documenti stanno in `MATERIALI/PDF/`. Appunti, mappe e ritagli sono tuoi:\n' +
    'StudIA non ci scrive mai da sola.\n';
}

/**
 * Crea uno zaino. Torna `{ id }` oppure `{ error }` — non solleva: chi chiama è
 * un canale IPC, e un'eccezione lì diventa una finestra che non risponde.
 */
function crea(vault, nome, quando) {
  if (!vault) return { error: 'nessuna cartella StudIA impostata' };
  const titolo = String(nome == null ? '' : nome).trim();
  const id = mdser.slugify(titolo, 60);
  if (!titolo || id === 'senza-titolo') return { error: 'dai un nome allo zaino' };
  if (!nomeValido(id)) return { error: 'nome non valido' };
  /* ⚠️ Il controllo è sulle DUE radici: vedi la nota in testa al file. */
  if (idOccupato(vault, id)) return { error: 'esiste già un corso o uno zaino con questo nome' };
  try {
    for (const sub of SOTTOCARTELLE) fs.mkdirSync(path.join(cartella(vault, id), sub), { recursive: true });
    /* Scrittura atomica come ovunque: un `_zaino.md` a metà è uno zaino che
       l'elenco non riconosce più. */
    const file = fileZaino(vault, id);
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, testoZaino(id, titolo, quando || ''), 'utf-8');
    fs.renameSync(tmp, file);
    return { id };
  } catch (err) { return { error: err.message }; }
}

/**
 * Rinomina uno zaino: il titolo E la cartella.
 *
 * ⚠️ PERCHÉ ANCHE LA CARTELLA. L'id di uno zaino *è* il suo titolo, ridotto a
 * nome di cartella (`crea` fa `slugify` e nient'altro): lasciare la cartella al
 * vecchio nome vorrebbe dire un vault in cui `Zaini/diritto-pubblico/` si chiama
 * «Storia romana» — e il vault è dell'utente, che lo apre col Finder e con
 * Obsidian. Un id che smette di derivare dal titolo è una seconda verità.
 *
 * ⚠️ E PERCHÉ NON FA PAURA. Dentro la cartella nessuno cita lo zaino per id: i
 * rimandi (`pdf:03#p=7`) sono relativi al contenitore, evidenze e ritagli citano
 * il NOME DEL FILE, appunti e mappe stanno lì dentro. L'unico riferimento
 * esterno è la memoria della macchina (`localStorage`), che il renderer sposta
 * perché conosce i due id. Resta un timbro vecchio nel campo `corso` delle mappe
 * già salvate: nessuno lo legge — è una firma, non un puntatore.
 *
 * Ordine: prima la cartella, poi il file. Se la seconda scrittura fallisce, lo
 * zaino esiste ed è aperto col titolo di prima; l'errore si dichiara. Al
 * contrario resterebbe un `_zaino.md` che nomina una cartella che non c'è.
 *
 * Torna `{ id, title, spostato }` — `id` è quello NUOVO, e chi chiama deve
 * usarlo: quando il titolo cambia senza cambiare lo slug («Diritto pubblico» →
 * «Diritto Pubblico») è lo stesso di prima, e `spostato` lo dice.
 */
function rinomina(vault, id, nome) {
  if (!vault) return { error: 'nessuna cartella StudIA impostata' };
  if (!esiste(vault, id)) return { error: 'zaino non trovato' };
  const titolo = String(nome == null ? '' : nome).trim();
  const nuovo = mdser.slugify(titolo, 60);
  if (!titolo || nuovo === 'senza-titolo') return { error: 'dai un nome allo zaino' };
  if (!nomeValido(nuovo)) return { error: 'nome non valido' };
  /* Come alla creazione: l'unicità è sulle DUE radici. Se lo slug non cambia,
     il nome è «occupato» da questo stesso zaino e non è un conflitto. */
  if (nuovo !== id && idOccupato(vault, nuovo)) {
    return { error: 'esiste già un corso o uno zaino con questo nome' };
  }
  /* La data di nascita non è un dato da rifare: si rilegge e si riscrive. */
  let creato = '';
  try { creato = profilo.parse(fs.readFileSync(fileZaino(vault, id), 'utf-8')).creato || ''; } catch (e) { /* la riscriviamo vuota */ }
  if (nuovo !== id) {
    try { fs.renameSync(cartella(vault, id), cartella(vault, nuovo)); }
    catch (err) { return { error: err.message || 'cartella non rinominata' }; }
  }
  try {
    const file = fileZaino(vault, nuovo);
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, testoZaino(nuovo, titolo, creato), 'utf-8');
    fs.renameSync(tmp, file);
  } catch (err) { return { error: err.message, id: nuovo, title: titolo, spostato: nuovo !== id }; }
  return { id: nuovo, title: titolo, spostato: nuovo !== id };
}

/**
 * Elimina uno zaino INTERO: la cartella — documenti, appunti, mappe, ritagli —
 * va nel Cestino di chi chiama (`opt.cestina`). Nessuna lapide e nessun
 * riaggancio: uno zaino non ha indici della pipeline, e il Cestino di sistema
 * È la rete — ci resta finché lo decide l'utente.
 */
async function elimina(vault, id, opt) {
  const o = opt || {};
  if (!esiste(vault, id)) return { error: 'zaino non trovato' };
  const p = cartella(vault, id);
  try {
    if (typeof o.cestina === 'function') await o.cestina(p);
    else fs.rmSync(p, { recursive: true });
  } catch (e) { return { error: e.message || 'zaino non rimosso' }; }
  return { error: '' };
}

module.exports = { RADICE, FILE, SOTTOCARTELLE, elimina, rinomina,
  radice, cartella, fileZaino, nomeValido, esiste, idOccupato, quantiDocumenti, elenco, crea, testoZaino };
