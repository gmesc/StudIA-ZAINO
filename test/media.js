'use strict';
/**
 * I media che entrano in un contenitore (lib/media.js).
 *
 * Quattro promesse:
 *  1. un video e un audio finiscono nelle cartelle che il vault già cerca —
 *     `MATERIALI/Video/` e `MATERIALI/Audio/` — dentro un corso come dentro uno
 *     zaino, perché passano da `corsi.cartella()`;
 *  2. il numero è UNO per contenitore, condiviso fra video e audio: nel rimando
 *     `video:03#t=850` il tipo non compare, e due «03» sarebbero due risposte
 *     alla stessa domanda;
 *  3. l'estensione non si perde e il file non si sovrascrive mai;
 *  4. ciò che non entra si dice, col motivo.
 *
 *   node test/media.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const M = require('../lib/media');
const Z = require('../lib/zaini');

let ko = 0, ok = 0;
function check(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { ok++; return; }
  ko++;
  console.log('  ✗ ' + nome + '\n      atteso: ' + a + '\n      avuto:  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

const VAULT = fs.mkdtempSync(path.join(os.tmpdir(), 'studia-media-'));
const CORSO = 'un-corso';
fs.mkdirSync(path.join(VAULT, 'Corsi', CORSO), { recursive: true });
Z.crea(VAULT, 'Diritto pubblico', '2026-08-12');
const ZAINO = 'diritto-pubblico';
const QUANDO = '2026-08-12T10:00:00.000Z';

/* I file di partenza: sul disco, come quelli che si trascinano davvero. */
const FUORI = path.join(VAULT, '_scrivania');
fs.mkdirSync(FUORI, { recursive: true });
function semina(nome, contenuto) {
  const p = path.join(FUORI, nome);
  fs.writeFileSync(p, contenuto || nome, 'utf-8');
  return p;
}

sezione('Che cosa è questo file');
{
  check('un mp4 è un video', 'video', M.tipoDi('lezione.mp4'));
  check('un MOV maiuscolo pure', 'video', M.tipoDi('LEZIONE.MOV'));
  check('un m4a è un audio', 'audio', M.tipoDi('registrazione.m4a'));
  check('un opus pure', 'audio', M.tipoDi('nota.opus'));
  /* ⚠️ Un PDF non è un media, e nemmeno un file senza estensione: chi chiede
     lo fa per decidere se copiarlo, e un «forse» qui vuol dire un documento
     finito fra i video. */
  check('un pdf non lo è', '', M.tipoDi('dispensa.pdf'));
  check('e nemmeno un nome nudo', '', M.tipoDi('lezione'));
  check('né il niente', '', M.tipoDi(null));
}

sezione('Il nome con cui entra');
{
  check('numero davanti, estensione intatta', '01 lezione.mp4', M.nomeDestinazione('lezione.mp4', 1));
  /* Il numero di prima non si eredita, o si otterrebbe «04 03 lezione.mp4». */
  check('il numero di prima non si eredita', '04 lezione.mp4', M.nomeDestinazione('03 lezione.mp4', 4));
  check('i caratteri che fanno danno spariscono', '02 a b.m4a', M.nomeDestinazione('a:b.m4a', 2));
  check('un nome ridotto a niente ha comunque un nome', '07 registrazione.mp4', M.nomeDestinazione('   .mp4', 7));
  /* ⚠️ L'estensione si normalizza in minuscolo: sul disco `.MP4` e `.mp4` sono
     due nomi diversi, e il resto del codice cerca in minuscolo. */
  check('l’estensione scende in minuscolo', '01 lezione.mov', M.nomeDestinazione('lezione.MOV', 1));
}

sezione('Un video e un audio entrano in uno zaino');
{
  const r = M.importa(VAULT, ZAINO, [semina('lezione.mp4'), semina('appunti vocali.m4a')], QUANDO);
  check('nessun errore', '', r.error);
  check('due dentro, zero fuori', [2, 0], [r.copiati.length, r.scartati.length]);
  check('e il numero è condiviso fra i due tipi',
    ['01 lezione.mp4', '02 appunti vocali.m4a'], r.copiati.map((c) => c.nome));
  check('ognuno nella sua cartella', ['video', 'audio'], r.copiati.map((c) => c.tipo));
  /* ⚠️ Dove sono finiti DAVVERO: è la promessa che regge tutto il resto —
     `srcUrl` cerca in `MATERIALI/Video` e `MATERIALI/Audio`, e un file altrove
     sarebbe un player che non apre niente senza dire perché. */
  check('il video è in Zaini/<id>/MATERIALI/Video', true,
    fs.existsSync(path.join(VAULT, 'Zaini', ZAINO, 'MATERIALI', 'Video', '01 lezione.mp4')));
  check('l’audio è in Zaini/<id>/MATERIALI/Audio', true,
    fs.existsSync(path.join(VAULT, 'Zaini', ZAINO, 'MATERIALI', 'Audio', '02 appunti vocali.m4a')));
  check('e l’originale resta dov’era', true, fs.existsSync(path.join(FUORI, 'lezione.mp4')));
  check('l’elenco li dà insieme, in ordine di numero',
    ['01 lezione.mp4', '02 appunti vocali.m4a'], M.nomi(VAULT, ZAINO));
}

sezione('Il numero riprende da dove era arrivato');
{
  const r = M.importa(VAULT, ZAINO, [semina('seconda parte.mp4')], QUANDO);
  check('il terzo prende il 03', ['03 seconda parte.mp4'], r.copiati.map((c) => c.nome));
  /* ⚠️ Lo stesso file trascinato due volte NON sovrascrive: diventa un secondo
     materiale con un numero suo. Una sovrascrittura porterebbe via gli appunti
     agganciati al minuto di quello di prima. */
  const bis = M.importa(VAULT, ZAINO, [semina('lezione.mp4')], QUANDO);
  check('lo stesso file due volte non sovrascrive', ['04 lezione.mp4'], bis.copiati.map((c) => c.nome));
  check('e restano quattro', 4, M.nomi(VAULT, ZAINO).length);
}

sezione('Un buco nella numerazione non si riusa');
{
  fs.unlinkSync(path.join(VAULT, 'Zaini', ZAINO, 'MATERIALI', 'Video', '03 seconda parte.mp4'));
  const r = M.importa(VAULT, ZAINO, [semina('terza parte.mp4')], QUANDO);
  /* ⚠️ Si guarda il MASSIMO, non il conteggio: col conteggio questo file
     avrebbe preso un numero già speso, e un vecchio `video:03` avrebbe aperto
     un'altra cosa — senza errore. */
  check('si riparte dal massimo, non dal conteggio', ['05 terza parte.mp4'], r.copiati.map((c) => c.nome));
}

sezione('Anche in un corso, e senza saperlo');
{
  const r = M.importa(VAULT, CORSO, [semina('conferenza.webm')], QUANDO);
  check('il corso funziona identico', ['01 conferenza.webm'], r.copiati.map((c) => c.nome));
  check('nel corso, non nello zaino', true,
    fs.existsSync(path.join(VAULT, 'Corsi', CORSO, 'MATERIALI', 'Video', '01 conferenza.webm')));
  /* I due contenitori numerano per conto loro: è la stessa regola dei PDF. */
  check('e i numeri non si mescolano', 1, M.nomi(VAULT, CORSO).length);
}

sezione('Ciò che non entra si dice, col motivo');
{
  const r = M.importa(VAULT, ZAINO, [semina('dispensa.pdf'), path.join(FUORI, 'mai-esistito.mp4'), FUORI], QUANDO);
  check('niente dentro', 0, r.copiati.length);
  check('tre motivi, uno per file',
    ['non è un video né un audio', 'non si legge', 'non è un video né un audio'],
    r.scartati.map((x) => x.motivo));
  /* ⚠️ Una cartella trascinata si scarta per il tipo prima ancora che per il
     fatto di essere una cartella: l'ordine dei controlli è quello che decide il
     motivo che l'utente legge, e «non è un video» è più utile di «non è un
     file». */
  check('e il contenitore è rimasto com’era', 4, M.nomi(VAULT, ZAINO).length);
}

sezione('Un contenitore che non c’è');
{
  const r = M.importa(VAULT, '../fuori', [semina('x.mp4')], QUANDO);
  check('non si esce dal vault', 'contenitore non valido', r.error);
  check('e non si copia niente', 0, r.copiati.length);
  check('un contenitore mai visto non ha media', [], M.nomi(VAULT, 'mai-visto'));
}

sezione('Un file estraneo dentro le cartelle dei media');
{
  fs.writeFileSync(path.join(VAULT, 'Zaini', ZAINO, 'MATERIALI', 'Video', 'note.txt'), 'x', 'utf-8');
  /* L'elenco serve al numero e al selettore del player: un `.txt` in mezzo
     sarebbe una voce che si può scegliere e che non suona. */
  check('l’elenco lo salta', false, M.nomi(VAULT, ZAINO).indexOf('note.txt') >= 0);
}

try { fs.rmSync(VAULT, { recursive: true, force: true }); } catch (e) { /* era temporanea */ }

console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati') + ' (' + ok + ' ok)');
process.exit(ko ? 1 : 0);
