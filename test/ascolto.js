'use strict';
/**
 * Il segno di ascolto (lib/ascolto.js): a che secondo si era arrivati.
 *
 * Tre promesse, le stesse del segno di lettura:
 *  1. il segno vive DENTRO il contenitore — corso o zaino — perché passa da
 *     `corsi.cartella()` come tutti i dati di chi studia;
 *  2. un file che non c'è non è un errore: è chi non ha ancora ascoltato niente;
 *  3. non si semina un file per dire «zero».
 *
 * E una sua: **il secondo zero esiste**. Riportare un video all'inizio è un
 * fatto, e va ricordato come tutti gli altri — al contrario della pagina, che
 * comincia da 1.
 *
 *   node test/ascolto.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const A = require('../lib/ascolto');
const L = require('../lib/lettura');
const Z = require('../lib/zaini');

let ko = 0, ok = 0;
function check(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { ok++; return; }
  ko++;
  console.log('  ✗ ' + nome + '\n      atteso: ' + a + '\n      avuto:  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

const VAULT = fs.mkdtempSync(path.join(os.tmpdir(), 'studia-ascolto-'));
const CORSO = 'un-corso';
fs.mkdirSync(path.join(VAULT, 'Corsi', CORSO), { recursive: true });
Z.crea(VAULT, 'Diritto pubblico', '2026-08-12');
const ZAINO = 'diritto-pubblico';
const QUANDO = '2026-08-12T10:00:00.000Z';

sezione('Un contenitore senza segni');
{
  const r = A.leggi(VAULT, CORSO);
  check('nessun segno, e nessun errore', [{}, ''], [r.media, r.error]);
  check('e nessun secondo da ricordare', null, A.secondo(VAULT, CORSO, 'x.mp4'));
  check('guardare non crea il file', false, fs.existsSync(A.percorso(VAULT, CORSO)));
}

sezione('Si segna, si ritrova');
{
  const r = A.segna(VAULT, CORSO, '01 lezione.mp4', 850, QUANDO);
  check('il segno si scrive', '', r.error);
  check('e si rilegge', 850, A.secondo(VAULT, CORSO, '01 lezione.mp4'));
  check('con il suo quando', QUANDO, A.leggi(VAULT, CORSO).media['01 lezione.mp4'].quando);
  A.segna(VAULT, CORSO, '02 audio.m4a', 12, QUANDO);
  check('ogni media ha il suo', [850, 12],
    [A.secondo(VAULT, CORSO, '01 lezione.mp4'), A.secondo(VAULT, CORSO, '02 audio.m4a')]);
  A.segna(VAULT, CORSO, '01 lezione.mp4', 900, QUANDO);
  check('riscrivere sposta il segno', 900, A.secondo(VAULT, CORSO, '01 lezione.mp4'));
  check('e i media restano due', 2, Object.keys(A.leggi(VAULT, CORSO).media).length);
}

sezione('Lo zero è un valore, non un’assenza');
{
  A.segna(VAULT, CORSO, '02 audio.m4a', 0, QUANDO);
  /* ⚠️ «Non l'ho mai aperto» e «l'ho riportato all'inizio» sono due fatti
     diversi: il secondo si rispetta, o riaprendo si tornerebbe al minuto da cui
     si era voluti uscire. */
  check('il secondo zero si scrive', 0, A.secondo(VAULT, CORSO, '02 audio.m4a'));
  check('e non è «nessun segno»', true, '02 audio.m4a' in A.leggi(VAULT, CORSO).media);
}

sezione('Che cosa non è un secondo');
{
  check('il negativo no', 'secondo non valido', A.segna(VAULT, CORSO, 'x.mp4', -3, QUANDO).error);
  /* ⚠️ `currentTime` di un media non ancora caricato vale `NaN`: scriverlo
     vorrebbe dire un segnalibro che al ritorno fa saltare il lettore in un
     punto che non c'è. */
  check('il NaN nemmeno', 'secondo non valido', A.segna(VAULT, CORSO, 'x.mp4', NaN, QUANDO).error);
  check('e nemmeno l’infinito', 'secondo non valido', A.segna(VAULT, CORSO, 'x.mp4', Infinity, QUANDO).error);
  check('i decimali si troncano', 41, A.segna(VAULT, CORSO, 'y.mp4', 41.87, QUANDO).media['y.mp4'].secondo);
  check('un percorso non è un media', 'media non valido', A.segna(VAULT, CORSO, '../fuori.mp4', 3, QUANDO).error);
  check('e un contenitore fuori dal vault non esiste',
    'contenitore non valido', A.segna(VAULT, '../altrove', 'x.mp4', 3, QUANDO).error);
}

sezione('Nello zaino, e senza che il modulo sappia che esiste');
{
  A.segna(VAULT, ZAINO, '01 lezione.mp4', 300, QUANDO);
  /* ⚠️ È il perno di tutta la modalità: `corsi.cartella()` risolve le due
     radici, e questo file non nomina mai gli zaini. Se si scollegasse, il segno
     finirebbe in `Corsi/<id>/` — cioè in un corso che non esiste — e nessuno
     vedrebbe niente di rotto. */
  check('il file sta dentro lo zaino', true,
    fs.existsSync(path.join(VAULT, 'Zaini', ZAINO, '_ascolto.json')));
  check('e non fra i corsi', false, fs.existsSync(path.join(VAULT, 'Corsi', ZAINO, '_ascolto.json')));
  check('si rilegge da lì', 300, A.secondo(VAULT, ZAINO, '01 lezione.mp4'));
}

sezione('I due segni convivono, senza toccarsi');
{
  L.segna(VAULT, ZAINO, '01 dispensa.pdf', 7, QUANDO);
  /* ⚠️ Due file, non due chiavi nello stesso: la pagina e il secondo si
     somigliano solo da lontano, e il giorno in cui un materiale ha tutti e due
     i segni devono poter convivere invece di escludersi. */
  check('la pagina resta al suo posto', 7, L.pagina(VAULT, ZAINO, '01 dispensa.pdf'));
  check('il secondo pure', 300, A.secondo(VAULT, ZAINO, '01 lezione.mp4'));
  check('e sono due file distinti', [true, true],
    [fs.existsSync(path.join(VAULT, 'Zaini', ZAINO, '_lettura.json')),
     fs.existsSync(path.join(VAULT, 'Zaini', ZAINO, '_ascolto.json'))]);
}

sezione('Dimenticare');
{
  A.dimentica(VAULT, ZAINO, '01 lezione.mp4');
  check('il segno se ne va', null, A.secondo(VAULT, ZAINO, '01 lezione.mp4'));
  /* Il file resta, ma vuoto: qui «nessun segno» è un fatto nuovo, non lo stato
     di partenza — ed è la stessa regola di `lettura.scrivi`. */
  check('e il file resta, vuoto', {}, A.leggi(VAULT, ZAINO).media);
  check('dimenticare due volte non è un errore', '', A.dimentica(VAULT, ZAINO, '01 lezione.mp4').error);
}

sezione('Un file rotto');
{
  const rotto = 'corso-rotto';
  fs.mkdirSync(path.join(VAULT, 'Corsi', rotto), { recursive: true });
  fs.writeFileSync(path.join(VAULT, 'Corsi', rotto, '_ascolto.json'), '{ questo non è json', 'utf-8');
  const r = A.leggi(VAULT, rotto);
  /* «Non lo so» non è «nessuno»: l'errore si dichiara invece di far finta che
     il media non sia mai stato aperto. */
  check('lo dichiara', true, /JSON/.test(r.error));
  check('e non inventa segni', {}, r.media);
  fs.writeFileSync(path.join(VAULT, 'Corsi', rotto, '_ascolto.json'),
    JSON.stringify({ media: { 'a.mp4': { secondo: 4 }, 'b.mp4': { secondo: 'x' }, '../c.mp4': { secondo: 9 } } }), 'utf-8');
  check('si tiene ciò che è leggibile', ['a.mp4'], Object.keys(A.leggi(VAULT, rotto).media));
}

try { fs.rmSync(VAULT, { recursive: true, force: true }); } catch (e) { /* era temporanea */ }

console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati') + ' (' + ok + ' ok)');
process.exit(ko ? 1 : 0);
