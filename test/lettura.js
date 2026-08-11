'use strict';
/**
 * Il segno di lettura (lib/lettura.js): a che pagina si era arrivati.
 *
 * Tre promesse:
 *  1. il segno vive DENTRO il contenitore — corso o zaino — e ci arriva da solo,
 *     perché passa da `corsi.cartella()` come tutti i dati di chi studia;
 *  2. un file che non c'è non è un errore: è chi non ha ancora letto niente;
 *  3. non si semina un file per dire «zero».
 *
 *   node test/lettura.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

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

const VAULT = fs.mkdtempSync(path.join(os.tmpdir(), 'studia-lettura-'));
const CORSO = 'un-corso';
fs.mkdirSync(path.join(VAULT, 'Corsi', CORSO), { recursive: true });
Z.crea(VAULT, 'Diritto pubblico', '2026-08-10');
const ZAINO = 'diritto-pubblico';
const QUANDO = '2026-08-10T10:00:00.000Z';

sezione('Un contenitore senza segni');
{
  const r = L.leggi(VAULT, CORSO);
  check('nessun segno, e nessun errore', [{}, ''], [r.documenti, r.error]);
  check('e nessuna pagina da ricordare', null, L.pagina(VAULT, CORSO, 'x.pdf'));
  /* ⚠️ Guardare non deve seminare: un file vuoto in una cartella che l'utente
     apre in Finder è rumore che non ha chiesto. */
  check('guardare non crea il file', false, fs.existsSync(L.percorso(VAULT, CORSO)));
}

sezione('Si segna, si ritrova');
{
  const r = L.segna(VAULT, CORSO, '03 dispensa.pdf', 42, QUANDO);
  check('il segno si scrive', '', r.error);
  check('e si rilegge', 42, L.pagina(VAULT, CORSO, '03 dispensa.pdf'));
  check('con il suo quando', QUANDO, L.leggi(VAULT, CORSO).documenti['03 dispensa.pdf'].quando);
  /* Due documenti nello stesso contenitore non si scambiano il segno. */
  L.segna(VAULT, CORSO, '07 slide.pdf', 3, QUANDO);
  check('ogni documento ha il suo', [42, 3],
    [L.pagina(VAULT, CORSO, '03 dispensa.pdf'), L.pagina(VAULT, CORSO, '07 slide.pdf')]);
  /* Riscrivere sposta il segno, non ne aggiunge un secondo. */
  L.segna(VAULT, CORSO, '03 dispensa.pdf', 51, QUANDO);
  check('riscrivere sposta il segno', 51, L.pagina(VAULT, CORSO, '03 dispensa.pdf'));
  check('e i documenti restano due', 2, Object.keys(L.leggi(VAULT, CORSO).documenti).length);
  /* ⚠️ Pagina 1 è un segno come gli altri: «non l'ho mai aperto» e «l'ho
     riportato in cima» sono due fatti diversi. */
  L.segna(VAULT, CORSO, '07 slide.pdf', 1, QUANDO);
  check('tornare a pagina 1 si ricorda', 1, L.pagina(VAULT, CORSO, '07 slide.pdf'));
}

sezione('⚠️ E lo stesso vale in uno ZAINO, senza una riga in più');
{
  /* `lettura` non sa che gli zaini esistono: chiede la cartella a
     `corsi.cartella()`, che risolve le due radici. È lo stesso perno di
     appunti, mappe, album ed evidenze. */
  const r = L.segna(VAULT, ZAINO, 'sentenze.pdf', 12, QUANDO);
  check('il segno si scrive', '', r.error);
  check('e il file sta dentro lo zaino', true,
    fs.existsSync(path.join(VAULT, 'Zaini', ZAINO, '_lettura.json')));
  check('non sotto Corsi/', false, fs.existsSync(path.join(VAULT, 'Corsi', ZAINO)));
  check('e si rilegge da lì', 12, L.pagina(VAULT, ZAINO, 'sentenze.pdf'));
  /* Lo stesso nome di documento in due contenitori sono due segni diversi. */
  L.segna(VAULT, CORSO, 'sentenze.pdf', 99, QUANDO);
  check('due contenitori non si scambiano il segno', [12, 99],
    [L.pagina(VAULT, ZAINO, 'sentenze.pdf'), L.pagina(VAULT, CORSO, 'sentenze.pdf')]);
}

sezione('I confini: ciò che non si accetta');
{
  check('una pagina zero non esiste', true, /pagina/.test(L.segna(VAULT, CORSO, 'x.pdf', 0, QUANDO).error));
  check('né una pagina negativa', true, /pagina/.test(L.segna(VAULT, CORSO, 'x.pdf', -3, QUANDO).error));
  check('né una che non è un numero', true, /pagina/.test(L.segna(VAULT, CORSO, 'x.pdf', 'tre', QUANDO).error));
  /* ⚠️ Il nome del documento arriva da fuori: con `..` uscirebbe dal vault. */
  check('un documento con un percorso dentro è rifiutato', true,
    /documento/.test(L.segna(VAULT, CORSO, '../../fuori.pdf', 2, QUANDO).error));
  check('e un contenitore con «..» pure', true,
    /contenitore/.test(L.segna(VAULT, '..', 'x.pdf', 2, QUANDO).error));
  check('un decimale si tronca, non si rifiuta', 7, L.paginaValida(7.9));
}

sezione('Dimenticare');
{
  L.segna(VAULT, CORSO, 'da-togliere.pdf', 5, QUANDO);
  const r = L.dimentica(VAULT, CORSO, 'da-togliere.pdf');
  check('il segno se ne va', undefined, r.documenti['da-togliere.pdf']);
  check('e gli altri restano', 51, L.pagina(VAULT, CORSO, '03 dispensa.pdf'));
  check('dimenticare ciò che non c\'era non è un errore', '',
    L.dimentica(VAULT, CORSO, 'mai-visto.pdf').error);
}

sezione('Un file rotto non spegne la lettura');
{
  const rotto = 'corso-rotto';
  fs.mkdirSync(path.join(VAULT, 'Corsi', rotto), { recursive: true });
  fs.writeFileSync(path.join(VAULT, 'Corsi', rotto, '_lettura.json'), '{ questo non è json', 'utf-8');
  const r = L.leggi(VAULT, rotto);
  /* «Non lo so» non è «nessuno»: l'errore si dichiara invece di far finta che
     il documento non sia mai stato aperto. */
  check('lo dichiara', true, /JSON/.test(r.error));
  check('e non inventa segni', {}, r.documenti);
  /* Una voce malformata dentro un file valido si salta, il resto si tiene. */
  fs.writeFileSync(path.join(VAULT, 'Corsi', rotto, '_lettura.json'),
    JSON.stringify({ documenti: { 'a.pdf': { pagina: 4 }, 'b.pdf': { pagina: 'x' }, '../c.pdf': { pagina: 9 } } }), 'utf-8');
  const r2 = L.leggi(VAULT, rotto);
  check('si tiene ciò che è leggibile', ['a.pdf'], Object.keys(r2.documenti));
}

try { fs.rmSync(VAULT, { recursive: true, force: true }); } catch (e) { /* era temporanea */ }

console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati') + ' (' + ok + ' ok)');
process.exit(ko ? 1 : 0);
