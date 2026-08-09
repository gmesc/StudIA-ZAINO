'use strict';
/**
 * corsi — piccole regole di sicurezza sui corsi del vault.
 *
 * Un corso può essere marcato PROTETTO: è materiale di studio finito, che la
 * pipeline non deve toccare. Chi scrive nel vault chiede il permesso qui prima,
 * così la regola sta in un posto solo e non dipende dalla memoria di chi chiama.
 *
 * Marcatura: `protetto: true` nel frontmatter di `_corso.md`, oppure la
 * presenza del file `_PROTETTO` nella cartella del corso.
 */

const fs = require('fs');
const path = require('path');
const profilo = require('./profilo');   // riusa il parser del frontmatter ristretto

/* ------------------------------------------------- i nomi di prima e di adesso
 *
 * Fino ad agosto 2026 i tre livelli si chiamavano Progetto › Corso › Capitolo, e
 * sul disco erano `Progetti/`, `_progetto.md`, `CORSI/`, `_corso.md`. Adesso sono
 * Corso › Lezione › Capitolo: `Corsi/`, `_corso.md`, `LEZIONI/`, `_lezione.md`
 * (contratto in RINOMINA-GLOSSARIO.md).
 *
 * Il nome `_corso.md` si è quindi spostato di un livello: era il file della
 * lezione, adesso è quello del corso. Non nasce ambiguità perché i due stanno a
 * profondità diverse — uno nella radice del corso, l'altro dentro la cartella di
 * una lezione — e le funzioni qui sotto guardano sempre in un posto solo.
 *
 * La LETTURA tollera l'impianto vecchio; la SCRITTURA usa solo i nomi nuovi.
 */
const RADICE = 'Corsi';
const RADICE_VECCHIA = 'Progetti';
const LEZIONI_VECCHIO = 'CORSI';
const FILE_CORSO = '_corso.md';
const FILE_CORSO_VECCHIO = '_progetto.md';
const FILE_LEZIONE = '_lezione.md';
const FILE_LEZIONE_VECCHIO = '_corso.md';

/** Il primo dei candidati che esiste; se nessuno esiste, il primo (che è quello nuovo). */
function primoCheEsiste(candidati) {
  for (const c of candidati) { if (fs.existsSync(c)) return c; }
  return candidati[0];
}

/** La cartella che raccoglie i corsi: `Corsi/`, o `Progetti/` in un vault mai migrato. */
function radice(vault) {
  return primoCheEsiste([path.join(vault, RADICE), path.join(vault, RADICE_VECCHIA)]);
}

/** Cartella di un corso. */
function cartella(vault, id) { return path.join(radice(vault), id); }

/** Il file che descrive il corso: `_corso.md`, o `_progetto.md` se il vault è vecchio. */
function fileCorso(vault, id) {
  const dir = cartella(vault, id);
  return primoCheEsiste([path.join(dir, FILE_CORSO), path.join(dir, FILE_CORSO_VECCHIO)]);
}

/**
 * Il file che descrive una lezione, data la sua cartella: `_lezione.md`, o
 * `_corso.md` se la lezione è stata scritta prima della rinomina.
 */
function fileLezione(dirLezione) {
  return primoCheEsiste([path.join(dirLezione, FILE_LEZIONE), path.join(dirLezione, FILE_LEZIONE_VECCHIO)]);
}

/**
 * La cartella dei file di servizio della pipeline: piano, schede, marcatore di
 * protezione. Stanno insieme e fuori strada, così aprendo un corso si vedono
 * solo le cose che contano per chi studia: `_corso.md`, le lezioni, `APPUNTI/`,
 * `MATERIALI/`.
 */
const LAVORAZIONE = '_lavorazione';
function lavorazione(vault, id) { return path.join(cartella(vault, id), LAVORAZIONE); }

/**
 * Le lezioni stanno in `LEZIONI/`, così la radice del corso resta leggibile: chi
 * apre la cartella vede quattro cose (`_corso.md`, `LEZIONI/`, `APPUNTI/`,
 * `MATERIALI/`) e non sedici cartelle numerate mescolate al resto.
 *
 * I corsi fatti prima tengono le lezioni nella radice: `cartellaLezioni()` le
 * riconosce e continua a funzionare senza migrazione obbligata.
 */
const LEZIONI = 'LEZIONI';
/* Le cartelle che NON sono lezioni. Sui corsi vecchi — quelli senza `LEZIONI/` —
   l'elenco delle lezioni si ricava scandendo le cartelle del corso, e tutto ciò
   che non è escluso qui diventa una lezione fantasma nell'interfaccia.
   `PERCORSI` mancava dal giorno in cui sono nate le varianti e `MAPPE` da oggi:
   sono due cartelle dell'utente, e ogni volta che se ne aggiunge una va aggiunta
   anche qui. */
const NON_LEZIONI = ['APPUNTI', 'MATERIALI', 'PERCORSI', 'MAPPE', LAVORAZIONE, LEZIONI, LEZIONI_VECCHIO, '_scarti'];

/**
 * Dove stanno le lezioni di questo corso: `LEZIONI/` se c'è, `CORSI/` se il corso
 * è di prima della rinomina, altrimenti la radice (impianto ancora precedente).
 */
function cartellaLezioni(vault, id) {
  const dir = cartella(vault, id);
  const nuova = path.join(dir, LEZIONI);
  if (fs.existsSync(nuova)) return nuova;
  const vecchia = path.join(dir, LEZIONI_VECCHIO);
  if (fs.existsSync(vecchia)) return vecchia;
  return dir;
}

/** La cartella di una lezione. */
function lezioneDir(vault, id, folder) { return path.join(cartellaLezioni(vault, id), folder); }

/** I nomi delle cartelle-lezione, in ordine. */
function elencoLezioni(vault, id) {
  try {
    return fs.readdirSync(cartellaLezioni(vault, id), { withFileTypes: true })
      .filter((x) => x.isDirectory() && !x.name.startsWith('.') && !NON_LEZIONI.includes(x.name))
      .map((x) => x.name).sort((a, b) => a.localeCompare(b, 'it'));
  } catch (e) { return []; }
}

/**
 * Dove creare una lezione nuova: in `LEZIONI/` sempre, anche se il corso non ce
 * l'ha ancora — i corsi crescono verso la struttura ordinata, non indietro.
 */
function cartellaLezioniPerScrivere(vault, id) {
  const dir = path.join(cartella(vault, id), LEZIONI);
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
  return dir;
}

/**
 * Percorso di un file di servizio: quello nuovo se c'è, altrimenti il vecchio
 * nella radice del corso (i vault già in uso non vanno migrati per forza).
 */
function servizio(vault, id, nome) {
  const nuovo = path.join(lavorazione(vault, id), nome);
  if (fs.existsSync(nuovo)) return nuovo;
  const vecchio = path.join(cartella(vault, id), nome);
  return fs.existsSync(vecchio) ? vecchio : nuovo;
}

/** Il corso è marcato protetto? */
function protetto(vault, id) {
  if (!vault || !id) return false;
  const dir = cartella(vault, id);
  if (fs.existsSync(path.join(dir, LAVORAZIONE, '_PROTETTO')) || fs.existsSync(path.join(dir, '_PROTETTO'))) return true;
  try {
    const fm = profilo.parse(fs.readFileSync(fileCorso(vault, id), 'utf-8'));
    return fm.protetto === true || fm.protetto === 'true';
  } catch (e) { return false; }
}

/** Marca (o smarca) un corso come protetto. */
function proteggi(vault, id, attiva) {
  const dir = cartella(vault, id);
  const marcatore = servizio(vault, id, '_PROTETTO');
  const mdser = require('./mdser');
  const file = fileCorso(vault, id);
  try {
    let raw = fs.readFileSync(file, 'utf-8');
    raw = mdser.upsertFmLine(raw, 'protetto', 'protetto: ' + (attiva === false ? 'false' : 'true'));
    fs.writeFileSync(file, raw, 'utf-8');
  } catch (e) {}
  if (attiva === false) { try { fs.unlinkSync(marcatore); } catch (e) {} }
  else { try { fs.mkdirSync(path.dirname(marcatore), { recursive: true }); } catch (e) {} }
  if (attiva !== false) fs.writeFileSync(marcatore,'Corso protetto: la pipeline di StudIA non deve scriverci.\nToglilo (o metti protetto: false in _corso.md) per riaprirlo alla scrittura.\n', 'utf-8');
  return true;
}

/** Errore pronto da restituire quando qualcuno prova a scrivere in un corso protetto. */
function motivoRifiuto(id) {
  return 'Il corso «' + id + '» è protetto: è materiale di studio, la pipeline non ci scrive. ' +
    'Lavora su una copia (per esempio «' + id + '-LAB»).';
}

/** Solleva se il corso è protetto; altrimenti non fa niente. */
function assicuraScrivibile(vault, id) {
  if (protetto(vault, id)) throw new Error(motivoRifiuto(id));
}

module.exports = { LAVORAZIONE, LEZIONI, NON_LEZIONI, RADICE, FILE_CORSO, FILE_LEZIONE,
  lavorazione, servizio, radice, fileCorso, fileLezione,
  cartellaLezioni, cartellaLezioniPerScrivere, lezioneDir, elencoLezioni, cartella, protetto, proteggi, motivoRifiuto, assicuraScrivibile };
