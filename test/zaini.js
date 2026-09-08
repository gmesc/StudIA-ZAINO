'use strict';
/**
 * Test del contenitore ZAINO (lib/zaini.js) e del perno che lo rende possibile
 * (lib/corsi.js › cartella).
 *
 * Le promesse da difendere sono tre, e la seconda è la sola che possa far
 * perdere dati:
 *
 *  1. uno zaino nasce con la forma di un corso — `MATERIALI/PDF`, `APPUNTI`,
 *     `MAPPE`, `ALBUM` — perché è quella forma a far funzionare senza modifiche
 *     l'album, il viewer e i rimandi `pdf:NN`;
 *  2. **un id non esiste in due radici**. `corsi.cartella()` risolve `Corsi/` e
 *     `Zaini/`: se un corso e uno zaino potessero chiamarsi uguale, gli appunti
 *     dell'uno finirebbero nella cartella dell'altro senza un errore. La
 *     guardia sta alla creazione, ed è questo file a impedire che sparisca;
 *  3. appunti, mappe e album — che di zaini non sanno niente — atterrano DENTRO
 *     lo zaino, perché passano da quel perno.
 *
 * E un mestiere secondario, come per gli altri file di questa cartella: qui si
 * carica il modulo da Node, senza DOM e senza Electron.
 *
 *   node test/zaini.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const Z = require('../lib/zaini');
const corsi = require('../lib/corsi');
const appunti = require('../lib/appunti');
const mappe = require('../lib/mappe');
const album = require('../lib/album');

let ko = 0, ok = 0;
function check(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { ok++; return; }
  ko++;
  console.log('  ✗ ' + nome + '\n      atteso: ' + a + '\n      avuto:  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

const VAULT = fs.mkdtempSync(path.join(os.tmpdir(), 'studia-zaini-'));
const QUANDO = '2026-08-10';

sezione('Uno zaino nasce con la forma di un corso');
{
  const r = Z.crea(VAULT, 'Diritto pubblico', QUANDO);
  check('la creazione riesce', 'diritto-pubblico', r.id);
  check('e non lascia errori per strada', undefined, r.error);
  const dir = path.join(VAULT, 'Zaini', 'diritto-pubblico');
  for (const sub of ['MATERIALI/PDF', 'MATERIALI/Indici-PDF', 'APPUNTI', 'MAPPE', 'ALBUM']) {
    check('c\'è la cartella ' + sub, true, fs.existsSync(path.join(dir, sub)));
  }
  check('e il file che lo dichiara zaino', true, fs.existsSync(path.join(dir, '_zaino.md')));
  const testo = fs.readFileSync(path.join(dir, '_zaino.md'), 'utf-8');
  check('il frontmatter dice che tipo è', true, /^tipo: "?zaino"?$/m.test(testo));
  check('e porta la data di creazione', true, testo.indexOf(QUANDO) > 0);
  /* Il titolo scritto dall'utente non si perde nello slug: «Diritto pubblico»
     resta leggibile, `diritto-pubblico` è solo il nome della cartella. */
  check('il titolo vero sopravvive allo slug', true, /title: "?Diritto pubblico"?/.test(testo));
}

sezione('⚠️ Un id non può esistere in due radici');
{
  /* Il caso che questo blocco esiste per impedire: `corsi.cartella()` risolve
     `Corsi/` PRIMA di `Zaini/`, quindi un corso omonimo si prenderebbe tutti i
     dati dello zaino — appunti, mappe, ritagli — e nessuno se ne accorgerebbe
     finché non manca qualcosa. */
  fs.mkdirSync(path.join(VAULT, 'Corsi', 'psicologia'), { recursive: true });
  const r = Z.crea(VAULT, 'Psicologia', QUANDO);
  check('uno zaino omonimo di un corso viene rifiutato', true, /esiste già/.test(r.error || ''));
  check('e non ha creato niente', false, fs.existsSync(path.join(VAULT, 'Zaini', 'psicologia')));

  const bis = Z.crea(VAULT, 'Diritto pubblico', QUANDO);
  check('e nemmeno due zaini con lo stesso nome', true, /esiste già/.test(bis.error || ''));
}

sezione('Le guardie sul nome');
{
  check('«..» non è un nome', false, Z.nomeValido('..'));
  check('e nemmeno un percorso', false, Z.nomeValido('../../fuori'));
  check('né una cartella nascosta', false, Z.nomeValido('.git'));
  check('né il vuoto', false, Z.nomeValido(''));
  check('un nome normale invece sì', true, Z.nomeValido('diritto-pubblico'));
  check('senza nome non si crea niente', true, /dai un nome/.test(Z.crea(VAULT, '   ', QUANDO).error || ''));
  check('e senza vault nemmeno', true, /cartella StudIA/.test(Z.crea(null, 'X', QUANDO).error || ''));
}

sezione('L\'elenco');
{
  const l = Z.elenco(VAULT);
  check('c\'è un solo zaino', 1, l.length);
  check('e porta il titolo, non lo slug', 'Diritto pubblico', l[0].title);
  check('con il conto dei documenti, che per ora è zero', 0, l[0].documenti);

  /* Un PDF messo nella cartella si conta; un file di sistema no. */
  const pdfDir = path.join(VAULT, 'Zaini', 'diritto-pubblico', 'MATERIALI', 'PDF');
  fs.writeFileSync(path.join(pdfDir, '01 sentenze.pdf'), '%PDF-1.4\n');
  fs.writeFileSync(path.join(pdfDir, '.DS_Store'), 'x');
  fs.writeFileSync(path.join(pdfDir, 'appunti.txt'), 'x');
  check('un documento in più si vede', 1, Z.elenco(VAULT)[0].documenti);

  /* ⚠️ Una cartella senza `_zaino.md` NON è uno zaino: può essere una
     creazione interrotta a metà, e aprirci una modalità sopra vorrebbe dire
     mostrare una sidebar su niente. */
  fs.mkdirSync(path.join(VAULT, 'Zaini', 'mezzo-fatto'), { recursive: true });
  check('una cartella senza _zaino.md non entra nell\'elenco', 1, Z.elenco(VAULT).length);
  check('e `esiste` lo dice', false, Z.esiste(VAULT, 'mezzo-fatto'));
  check('mentre per uno vero è vero', true, Z.esiste(VAULT, 'diritto-pubblico'));
  check('«..» non esiste mai, qualunque cosa ci sia sul disco', false, Z.esiste(VAULT, '..'));
}

sezione('Un vault senza zaini non è un vault rotto');
{
  const vuoto = fs.mkdtempSync(path.join(os.tmpdir(), 'studia-novault-'));
  check('l\'elenco è vuoto, non un errore', [], Z.elenco(vuoto));
  check('e la cartella Zaini/ non viene creata per il solo fatto di guardare',
    false, fs.existsSync(path.join(vuoto, 'Zaini')));
  check('senza vault, elenco vuoto', [], Z.elenco(null));
  try { fs.rmSync(vuoto, { recursive: true, force: true }); } catch (e) {}
}

sezione('⚠️ IL PERNO: i dati dell\'utente atterrano dentro lo zaino');
{
  /* Questi tre moduli non sanno che gli zaini esistono. Se il perno
     (`corsi.cartella`) è cablato bene, ci finiscono dentro lo stesso — ed è la
     ragione per cui la modalità ZAINO non ha richiesto di riscriverli. */
  const dentro = path.join(VAULT, 'Zaini', 'diritto-pubblico');
  check('gli appunti', path.join(dentro, 'APPUNTI'), appunti.dir(VAULT, 'diritto-pubblico'));
  check('le mappe', path.join(dentro, 'MAPPE'), mappe.dir(VAULT, 'diritto-pubblico'));
  check('l\'album', path.join(dentro, 'ALBUM'), album.dir(VAULT, 'diritto-pubblico'));

  /* E un corso resta un corso: la seconda radice non deve dirottare niente di
     quello che funzionava prima. */
  check('un corso continua a stare in Corsi/', path.join(VAULT, 'Corsi', 'psicologia'),
    corsi.cartella(VAULT, 'psicologia'));

  /* ⚠️ Un id che non esiste da nessuna parte torna il percorso sotto `Corsi/`:
     è il comportamento su cui contano le funzioni che CREANO un corso, e
     cambiarlo le farebbe scrivere in `Zaini/`. */
  check('un id sconosciuto punta ancora a Corsi/', path.join(VAULT, 'Corsi', 'mai-visto'),
    corsi.cartella(VAULT, 'mai-visto'));
}

sezione('Scrivere davvero: un appunto nello zaino finisce nello zaino');
{
  const r = appunti.save(VAULT, 'diritto-pubblico', null,
    { title: 'Prima lettura' }, 'Qualcosa da ricordare.\n', QUANDO);
  check('il salvataggio torna il nome del file', true, /\.md$/.test(r.file));
  const atteso = path.join(VAULT, 'Zaini', 'diritto-pubblico', 'APPUNTI');
  const scritti = fs.readdirSync(atteso).filter((n) => n.endsWith('.md'));
  check('il file sta dentro lo zaino', true, scritti.indexOf(r.file) >= 0);
  /* `save` rigenera anche l'indice: se il perno fosse cablato male, quello
     finirebbe in un'altra cartella e il file resterebbe qui da solo. */
  check('e con lui l\'indice degli appunti', true, fs.existsSync(path.join(atteso, '_indice.md')));
  check('e non è nato niente sotto Corsi/', false,
    fs.existsSync(path.join(VAULT, 'Corsi', 'diritto-pubblico')));
}

sezione('Rinominare uno zaino: il titolo e la cartella');
{
  /* Uno zaino con dentro del lavoro: rinominare deve portarselo appresso. Se la
     cartella si spostasse senza il contenuto, o il contenuto restasse indietro,
     è qui che si vede — e non a schermo, dove si vedrebbe come «lo zaino si è
     svuotato». */
  Z.crea(VAULT, 'Storia romana', QUANDO);
  appunti.save(VAULT, 'storia-romana', null, { title: 'Le guerre puniche' }, 'Zama.\n', QUANDO);

  const solo = Z.rinomina(VAULT, 'storia-romana', 'Storia romana antica');
  check('l\'esito porta il nuovo id e il nuovo titolo',
    { id: 'storia-romana-antica', title: 'Storia romana antica', spostato: true }, solo);
  check('la cartella vecchia non c\'è più', false, fs.existsSync(path.join(VAULT, 'Zaini', 'storia-romana')));
  check('e quella nuova sì', true, Z.esiste(VAULT, 'storia-romana-antica'));
  /* Il lavoro dell'utente viaggia con la cartella: è tutto lì dentro, e questa
     è la ragione per cui rinominare non è un'operazione pericolosa. */
  check('l\'appunto è dentro quella nuova', true,
    fs.readdirSync(path.join(VAULT, 'Zaini', 'storia-romana-antica', 'APPUNTI'))
      .some((n) => /guerre puniche/i.test(n)));

  const dopo = Z.elenco(VAULT).filter((z) => z.id === 'storia-romana-antica')[0];
  check('l\'elenco legge il titolo nuovo', 'Storia romana antica', dopo.title);
  /* ⚠️ La data di nascita non è un dato da rifare: `rinomina` la rilegge e la
     riscrive. Perderla vorrebbe dire uno zaino che dichiara di essere nato oggi
     ogni volta che cambia nome. */
  check('e la data di nascita è quella di prima', QUANDO, dopo.creato);

  /* Un titolo che si riscrive senza cambiare lo slug: la cartella non si tocca,
     e `spostato` lo dice — è il campo su cui il renderer decide se traslocare la
     memoria della macchina. */
  const stesso = Z.rinomina(VAULT, 'storia-romana-antica', 'Storia Romana Antica');
  check('cambiare solo le maiuscole non sposta la cartella',
    { id: 'storia-romana-antica', title: 'Storia Romana Antica', spostato: false }, stesso);

  /* Le stesse guardie della creazione, perché è lo stesso rischio: due
     contenitori con un id solo. */
  Z.crea(VAULT, 'Chimica', QUANDO);
  check('un nome già preso è rifiutato',
    { error: 'esiste già una cartella con questo nome' },
    Z.rinomina(VAULT, 'storia-romana-antica', 'Chimica'));
  fs.mkdirSync(path.join(VAULT, 'Corsi', 'fisica'), { recursive: true });
  check('anche se il nome è di un CORSO',
    { error: 'esiste già una cartella con questo nome' },
    Z.rinomina(VAULT, 'storia-romana-antica', 'Fisica'));
  check('un nome vuoto è rifiutato', { error: 'dai un nome allo zaino' },
    Z.rinomina(VAULT, 'storia-romana-antica', '   '));
  check('un nome che non lascia lettere è rifiutato', { error: 'dai un nome allo zaino' },
    Z.rinomina(VAULT, 'storia-romana-antica', '???'));
  check('uno zaino che non esiste è rifiutato', { error: 'zaino non trovato' },
    Z.rinomina(VAULT, 'mai-esistito', 'Qualcosa'));
  /* E dopo tutti i rifiuti lo zaino è ancora al suo posto, col suo nome: un
     rifiuto che lasciasse la cartella spostata sarebbe peggio di un errore. */
  check('nessun rifiuto ha spostato niente', true, Z.esiste(VAULT, 'storia-romana-antica'));
}

try { fs.rmSync(VAULT, { recursive: true, force: true }); } catch (e) { /* era temporanea */ }

console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati') + ' (' + ok + ' ok)');
process.exit(ko ? 1 : 0);
