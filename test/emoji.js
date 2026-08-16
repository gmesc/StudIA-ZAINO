/* La tavolozza del selettore: il DATO, non la griglia.
 *
 * ⚠️ Perché questa prova esiste. `App/assets/dati/emoji.js` non si scrive più a
 * mano: lo genera `bin/emoji.js` incrociando l'elenco di OpenMoji con i nomi
 * italiani di CLDR. Un generatore che sbaglia non si rompe — produce un file
 * plausibile e più povero: le parole italiane tornate inglesi, i toni della
 * pelle rientrati dalla finestra, la tavolozza curata sparita in fondo. Nessuna
 * di queste cose fa rumore, e tutte si vedono qui.
 *
 * Quello che NON si prova qui è che il font disegni davvero quei caratteri:
 * quella è una misura che vuole un motore di rendering e la fa il generatore,
 * scartando ciò che il font non sa disegnare.
 *
 *   node test/emoji.js
 */
const fs = require('fs');
const path = require('path');

const EMOJI = require('../App/assets/dati/emoji.js');
const CURATE = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'App', 'assets', 'dati', 'emoji-curate.json'), 'utf-8'));

let ko = 0;
function ok(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + nome); return; }
  ko++; console.log('  KO  ' + nome + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

/* L'indice piatto, costruito come lo costruisce il renderer: se la forma di una
   voce cambia, questa prova se ne accorge prima dell'utente. */
const PIATTO = [];
for (const [cat, voci] of EMOJI) {
  for (const v of voci.split('|')) {
    const sp = v.indexOf(' ');
    PIATTO.push({ cat, ch: v.slice(0, sp), kw: v.slice(sp + 1) });
  }
}
const senzaVariante = (s) => s.replace(/️/g, '');
const cerca = (q) => PIATTO.filter((e) => e.kw.indexOf(q) >= 0 ||
  e.kw.split(' ').some((w) => w.indexOf(q) === 0));

sezione('La forma: ogni voce è «carattere parole»');
ok('ci sono categorie', true, EMOJI.length >= 12);
ok('e sono coppie [nome, voci]', true, EMOJI.every((c) => Array.isArray(c) && c.length === 2 &&
  typeof c[0] === 'string' && typeof c[1] === 'string'));
ok('nessuna voce senza carattere', 0, PIATTO.filter((e) => !e.ch).length);
ok('nessuna voce senza parole chiave', 0, PIATTO.filter((e) => !e.kw || !e.kw.trim()).length);
ok('nessuna parola chiave con il separatore dentro', 0, PIATTO.filter((e) => e.kw.indexOf('|') >= 0).length);

sezione('È la tavolozza COMPLETA, non le ottantanove di prima');
console.log('   ' + PIATTO.length + ' voci in ' + EMOJI.length + ' categorie');
ok('almeno duemila emoji', true, PIATTO.length >= 2000);

/* ⚠️ I toni della pelle sono esclusi apposta: sei copie della stessa mano
   riempiono la griglia senza aggiungere un significato. Se rientrano, la
   tavolozza raddoppia e nessuno se ne accorge guardando. */
const TONI = /[\u{1F3FB}-\u{1F3FF}]/u;
ok('niente varianti di tono della pelle', 0, PIATTO.filter((e) => TONI.test(e.ch)).length);

sezione('La tavolozza curata resta in testa, con le sue parole italiane');
ok('la prima categoria è la prima curata', CURATE[0][0], EMOJI[0][0]);
const primeCat = EMOJI.slice(0, CURATE.length).map((c) => c[0]);
ok('e ci sono tutte, nell\'ordine', CURATE.map((c) => c[0]), primeCat);
const mancanti = [];
for (const [, elenco] of CURATE) {
  for (const v of elenco) {
    const trovata = PIATTO.some((e) => senzaVariante(e.ch) === senzaVariante(v.ch));
    if (!trovata) mancanti.push(v.ch);
  }
}
ok('nessuna emoji curata è andata persa', [], mancanti);

sezione('LA RICERCA IN ITALIANO: è la ragione per cui si genera invece di copiare');
/* Se CLDR non fosse stato incrociato, queste risponderebbero in inglese — cioè
   non risponderebbero affatto a chi scrive. */
for (const [q, atteso] of [['attenzione', '⚠'], ['laurea', '🎓'], ['gatto', '😺'],
  ['cuore', '❤'], ['libro', '📖'], ['montagna', '⛰']]) {
  const r = cerca(q);
  const c = r.some((e) => senzaVariante(e.ch).indexOf(atteso) === 0 ||
    senzaVariante(e.ch) === atteso);
  ok('«' + q + '» trova ' + atteso + ' (' + r.length + ' risultati)', true, c);
}

sezione('Le parole delle curate vincono su quelle di CLDR');
/* La curata dice «attenzione pericolo avviso»: sono state scelte guardando che
   cosa scrive chi cerca, e la generazione non deve averle sostituite. */
const avviso = PIATTO.find((e) => senzaVariante(e.ch) === '⚠');
ok('⚠️ ha ancora le sue parole curate', true, !!avviso && /attenzione/.test(avviso.kw) &&
  /pericolo/.test(avviso.kw));

sezione('Il file dichiara di essere generato');
const testo = fs.readFileSync(path.join(__dirname, '..', 'App', 'assets', 'dati', 'emoji.js'), 'utf-8');
ok('lo dice in cima, con il comando che lo rifà', true,
  /GENERATO da bin\/emoji\.js/.test(testo) && /npm run emoji/.test(testo));
ok('e dice dove si aggiunge a mano', true, /emoji-curate\.json/.test(testo));

console.log('');
console.log(ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati');
process.exit(ko ? 1 : 0);
