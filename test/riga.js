'use strict';
/**
 * Il segno di lettura degli APPUNTI (lib/riga.js) — Q1.
 *
 * Il terzo gemello di `lettura.js` e `ascolto.js`, e le due cose che qui si
 * sbagliano senza accorgersene sono: che cosa è un segno valido (lo zero è una
 * riga, la stringa vuota no) e dove si apre un appunto che nel frattempo si è
 * ACCORCIATO — perché fra il segno e la riapertura passa la vita del file.
 *
 * Gira su una cartella temporanea: il vault vero non si tocca.
 *
 *   node test/riga.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const R = require('../lib/riga');
const A = require('../lib/appunti');

let ko = 0, ok = 0;
function check(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { ok++; return; }
  ko++;
  console.log('  ✗ ' + nome + '\n      atteso: ' + a + '\n      avuto:  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

const VAULT = fs.mkdtempSync(path.join(os.tmpdir(), 'studia-riga-'));
const CORSO = 'TD74-DSA';
const QUANDO = '2026-08-26T10:00:00.000Z';

sezione('Che cosa è una riga');
{
  /* ⚠️ LO ZERO È UNA RIGA, a differenza della pagina che comincia da 1: la
     prima riga di un testo è la 0 in ogni editor, e trattarla come «nessun
     segno» vorrebbe dire non poter più tornare in cima di proposito. */
  check('lo zero è una riga', 0, R.rigaValida(0));
  check('e anche scritto come stringa', 0, R.rigaValida('0'));
  check('una riga qualunque', 42, R.rigaValida(42));
  check('i decimali si troncano', 7, R.rigaValida(7.9));
  check('il negativo non è una riga', null, R.rigaValida(-1));
  check('la stringa vuota nemmeno', null, R.rigaValida(''));
  check('né gli spazi', null, R.rigaValida('   '));
  check('né una parola', null, R.rigaValida('sette'));
  check('né il niente', null, R.rigaValida(undefined));
}

sezione('⚠️ Dove si apre DAVVERO, dato quanto è lungo l\'appunto adesso');
{
  check('dentro il testo, la riga segnata', 3, R.dove(3, 10));
  /* ⚠️ Il caso che questa funzione esiste per coprire: il file si è accorciato
     — da un altro computer, da Obsidian, o da chi ha cancellato ieri sera. Si
     STRINGE all'ultima riga vera, come `vaiAPagina` fa con le pagine: dire «il
     segno non vale più» vorrebbe dire riaprire in cima proprio l'appunto su cui
     si stava lavorando di più. */
  check('oltre la fine si stringe all\'ultima', 9, R.dove(50, 10));
  check('l\'ultima riga è quella giusta, non una dopo', 0, R.dove(5, 1));
  check('senza segno si apre in cima', 0, R.dove(null, 10));
  check('e un segno storto non porta da nessuna parte di strano', 0, R.dove('sette', 10));
  check('un appunto vuoto ha la sola riga 0', 0, R.dove(4, 0));
  check('e un conto di righe assurdo non fa saltare niente', 0, R.dove(4, -3));
  check('la riga 0 resta la riga 0', 0, R.dove(0, 10));
}

sezione('Il giro sul disco: si scrive, si rilegge, e sta in APPUNTI/');
{
  /* ⚠️ Il file sta in `APPUNTI/` e non nella radice come `_lettura.json`:
     `lib/pacchetto.js` esclude `APPUNTI/*` quando l'autore non dà i suoi
     appunti, e dove era arrivato a leggerli è roba sua quanto il testo. */
  check('il file vive dentro APPUNTI/', true,
    R.percorso(VAULT, CORSO).indexOf(path.join('APPUNTI', '_riga.json')) > 0);

  check('senza segni l\'elenco è vuoto, e non è un errore', { appunti: {}, error: '' },
    R.leggi(VAULT, CORSO));
  /* ⚠️ E NON si crea un file per dire «zero»: nel vault di chi apre le cartelle
     un file vuoto è rumore. Stessa regola di `evidenze.salva`. */
  check('e non nasce nessun file', false, fs.existsSync(R.percorso(VAULT, CORSO)));

  const r = R.segna(VAULT, CORSO, 'Appunto.md', 12, QUANDO);
  check('segnare non dà errore', '', r.error);
  check('il segno si rilegge', 12, R.riga(VAULT, CORSO, 'Appunto.md'));
  check('con la sua data', QUANDO, R.leggi(VAULT, CORSO).appunti['Appunto.md'].quando);
  check('e adesso il file c\'è', true, fs.existsSync(R.percorso(VAULT, CORSO)));

  R.segna(VAULT, CORSO, 'Secondo.md', 0, QUANDO);
  check('due appunti, due segni', [12, 0],
    ['Appunto.md', 'Secondo.md'].map((f) => R.riga(VAULT, CORSO, f)));
  /* ⚠️ La riga 0 si SCRIVE: «non l'ho mai riaperto» e «sono tornato in cima»
     sono due fatti diversi. */
  check('e lo zero è finito sul disco, non è stato scartato', true,
    'Secondo.md' in R.leggi(VAULT, CORSO).appunti);

  check('un appunto mai segnato non ha riga', null, R.riga(VAULT, CORSO, 'Mai.md'));
  check('dimenticare toglie il segno', null,
    (R.dimentica(VAULT, CORSO, 'Appunto.md'), R.riga(VAULT, CORSO, 'Appunto.md')));
  check('e non tocca gli altri', 0, R.riga(VAULT, CORSO, 'Secondo.md'));
  check('dimenticare uno che non c\'è non è un errore', '',
    R.dimentica(VAULT, CORSO, 'Mai.md').error);
}

sezione('Nessuna porta scrive fuori da APPUNTI/');
{
  /* La stessa guardia di ogni porta di `lib/appunti.js`: un nome di file è una
     FOGLIA, e un segno con dentro un percorso scriverebbe altrove. */
  check('un nome che esce dalla cartella si rifiuta', 'appunto non valido',
    R.segna(VAULT, CORSO, '../MAPPE/mia.json', 3).error);
  check('e le barre pure', 'appunto non valido', R.segna(VAULT, CORSO, 'sub/x.md', 3).error);
  check('un nome vuoto nemmeno passa', 'appunto non valido', R.segna(VAULT, CORSO, '', 3).error);
  check('una riga non valida si rifiuta invece di diventare zero', 'riga non valida',
    R.segna(VAULT, CORSO, 'Appunto.md', 'sette').error);
}

sezione('Un file storto non diventa un segno');
{
  const p = R.percorso(VAULT, CORSO);
  fs.writeFileSync(p, '{ non sono json', 'utf-8');
  check('un file illeggibile lo DICE, invece di dire «nessun segno»', true,
    !!R.leggi(VAULT, CORSO).error);
  check('e non inventa righe', {}, R.leggi(VAULT, CORSO).appunti);

  /* ⚠️ Una voce storta si SCARTA in lettura invece di diventare «riga 0»: sul
     disco resterebbe scritto uno zero che nessuno ha mai messo, e alla
     riscrittura successiva sarebbe indistinguibile da un «sono tornato in
     cima» dell'utente. */
  fs.writeFileSync(p, JSON.stringify({ appunti: {
    'Buono.md': { riga: 5 },
    'Storto.md': { riga: 'sette' },
    '../fuori.md': { riga: 2 }
  } }), 'utf-8');
  check('la voce buona resta', 5, R.riga(VAULT, CORSO, 'Buono.md'));
  check('quella storta si scarta, e non diventa zero', null, R.riga(VAULT, CORSO, 'Storto.md'));
  check('e quella che esce dalla cartella nemmeno entra', null, R.riga(VAULT, CORSO, '../fuori.md'));
  check('l\'elenco ne conta uno solo', 1, Object.keys(R.leggi(VAULT, CORSO).appunti).length);
}

sezione('Insieme a un appunto vero: dove si riapre');
{
  fs.rmSync(A.dir(VAULT, 'CORSO2'), { recursive: true, force: true });
  const s = A.save(VAULT, 'CORSO2', null, { title: 'Lungo' }, 'r0\nr1\nr2\nr3\nr4');
  R.segna(VAULT, 'CORSO2', s.file, 3, QUANDO);
  const righe = A.apri(VAULT, 'CORSO2', s.file).nota.body.split('\n').length;
  check('si riapre alla riga segnata', 3, R.dove(R.riga(VAULT, 'CORSO2', s.file), righe));

  /* L'appunto si accorcia: il segno si stringe invece di puntare nel vuoto. */
  A.save(VAULT, 'CORSO2', s.file, { title: 'Lungo' }, 'r0\nr1');
  const dopo = A.apri(VAULT, 'CORSO2', s.file).nota.body.split('\n').length;
  check('accorciato, si stringe all\'ultima riga vera', dopo - 1,
    R.dove(R.riga(VAULT, 'CORSO2', s.file), dopo));
  check('e il segno sul disco resta quello: è il testo a essere cambiato, non il segno', 3,
    R.riga(VAULT, 'CORSO2', s.file));
}

try { fs.rmSync(VAULT, { recursive: true, force: true }); } catch (e) { /* era temporanea */ }

console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati') + ' (' + ok + ' ok)');
process.exit(ko ? 1 : 0);
