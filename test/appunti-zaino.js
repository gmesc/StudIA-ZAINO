'use strict';
/**
 * Nello ZAINO un appunto dice da quale DOCUMENTO nasce (Z6).
 *
 * Nei corsi un appunto è legato a lezione + capitolo. Nello zaino quei due non
 * esistono, e il legame restava vuoto: il posto c'era — «lezione · capitolo» —
 * ma non lo riempiva niente, e il chip della barra rimaneva acceso a segnalare
 * la distanza da un capitolo inesistente. Adesso quel posto lo tengono
 * `materiale` e `pagina`: il PDF aperto quando l'appunto è nato, e la pagina.
 * Un appunto nato da zero, senza niente davanti, dice `PERSONALE`.
 *
 * Tre paure, una per sezione:
 *  1. che il ramo dei CORSI cambi di nascosto — è la cosa che qui non deve
 *     succedere per nessun motivo, e la si controlla campo per campo;
 *  2. che gli appunti VECCHI (nessuno ha `materiale`) cambino comportamento;
 *  3. ⚠️ che `materiale` finisca fuori dalla lista bianca `CHIAVI` di
 *     `lib/appunti.js` e venga buttato via al salvataggio IN SILENZIO: il
 *     riferimento comparirebbe alla creazione e sparirebbe 1,8 s dopo il primo
 *     tasto battuto, senza un errore da nessuna parte. È il giro
 *     salva→rileggi della sezione 4.
 *
 *   node test/appunti-zaino.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const A = require('../lib/appunti');
// la stessa strada di test/roundtrip.js: il modulo del renderer, letto in Node
const N = require('../lib/reader-parser').loadNotes();

let ko = 0, ok = 0;
function check(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { ok++; return; }
  ko++;
  console.log('  ✗ ' + nome + '\n      atteso: ' + a + '\n      avuto:  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

/* Il contesto che il renderer costruisce in `curCtx()`, nelle due modalità. */
function ctxZaino(materiale, pagina) {
  return { courseId: 'ZAINO-storia', modo: 'zaino', lezione: '', lezioneId: '',
    capitolo: '', capitoloId: '', capitoloFile: '',
    materiale: materiale || '', pagina: pagina == null ? '' : String(pagina) };
}
const CTX_CORSO = { courseId: 'TD74-DSA', lezione: 'Cosa sono i DSA', lezioneId: '01-fondamenti',
  capitolo: 'Definizione', capitoloId: '01-fondamenti-c02', capitoloFile: '02-definizione.md' };

/* Come il renderer accorcia il nome di un file in un titolo leggibile
   (`titoloMateriale`): il modulo non può conoscerla — gira anche qui, in Node —
   e se la riceve la usa. */
function titoloMateriale(file) {
  return String(file || '').replace(/\.[a-z0-9]+$/i, '').replace(/^\d{1,3}[\s._-]*/, '')
    .replace(/[\s._-]+/g, ' ').trim();
}

/* ============================================ 1. i corsi non cambiano MAI = */
sezione('Nei corsi non cambia niente: stesse parole, stessi gruppi');
{
  const n = { file: 'a.md', title: 'Nota', lezione: 'Cosa sono i DSA', capitolo: 'Definizione' };
  check('«lezione · capitolo», come sempre', 'Cosa sono i DSA · Definizione', N.noteDove(n));
  check('e uguale se la modalità è detta esplicitamente', 'Cosa sono i DSA · Definizione',
    N.noteDove(n, 'corso'));
  check('senza capitolo resta la sola lezione', 'Cosa sono i DSA',
    N.noteDove({ lezione: 'Cosa sono i DSA' }));
  check('senza niente la riga è vuota, non «PERSONALE»', '', N.noteDove({ file: 'x.md' }));
  check('nemmeno un appunto nullo inventa un\'etichetta', '', N.noteDove(null));
  /* ⚠️ Il tranello vero: un appunto di corso che PORTA un materiale (li avranno
     quelli nati da un PDF citato) non deve cominciare a raccontare il documento
     al posto del capitolo. La modalità comanda, non il campo. */
  check('un materiale su un appunto di corso non scavalca il capitolo',
    'Cosa sono i DSA · Definizione',
    N.noteDove(Object.assign({ materiale: '03 dispensa.pdf', pagina: '7' }, n)));
  check('l\'etichetta lunga è quella di prima', 'Nota — Cosa sono i DSA · Definizione',
    N.noteEtichettaAltrove(n));

  const qui = { file: 'q.md', title: 'Qui', lezioneId: '01-fondamenti', capitoloId: '01-fondamenti-c02' };
  const altro = { file: 'z.md', title: 'Altrove', lezioneId: '01-fondamenti', capitoloId: '01-fondamenti-c09' };
  check('noteInChapter riconosce il capitolo', [true, false],
    [N.noteInChapter(qui, CTX_CORSO), N.noteInChapter(altro, CTX_CORSO)]);
  const g = N.noteGroups([qui, altro], CTX_CORSO, null);
  check('e i gruppi restano quelli', [['q.md'], ['z.md']],
    [g.qui.map((x) => x.file), g.altrove.map((x) => x.file)]);
  /* Un ctx di corso non ha `modo`: è così che il ramo dello zaino non lo sfiora
     nemmeno. Se un giorno qualcuno gli mettesse `modo:'zaino'` per sbaglio,
     questo controllo non se ne accorgerebbe — se ne accorgerebbe quello sopra,
     che confronta i capitoli. */
  check('il contesto dei corsi non porta la modalità', undefined, CTX_CORSO.modo);
}

/* ================================== 2. lo zaino: il documento, o PERSONALE = */
sezione('Nello zaino il posto del capitolo lo tiene il documento');
{
  const daPdf = { file: 'a.md', title: 'Le tre guerre', materiale: '03 dispensa storia.pdf', pagina: '7' };
  const daZero = { file: 'b.md', title: 'Pensieri sparsi' };

  check('la costante è una sola, ed è questa', 'PERSONALE', N.PERSONALE);
  check('l\'appunto nato da un PDF dice il documento e la pagina',
    '03 dispensa storia.pdf · p. 7', N.noteDove(daPdf, 'zaino'));
  check('col nome leggibile, se glielo si insegna', 'dispensa storia · p. 7',
    N.noteDove(daPdf, 'zaino', titoloMateriale));
  check('senza pagina resta il solo documento', 'dispensa storia',
    N.noteDove({ materiale: '03 dispensa storia.pdf' }, 'zaino', titoloMateriale));
  check('l\'appunto nato da zero è PERSONALE', 'PERSONALE', N.noteDove(daZero, 'zaino'));
  /* ⚠️ La retrocompatibilità in una riga: un appunto scritto prima di Z6 non ha
     `materiale`, ed è esattamente il caso «nato da zero». Non si perde niente
     perché non c'era niente da perdere: nessuno di quegli appunti sapeva da
     dove veniva. */
  check('e così ogni appunto vecchio, che «materiale» non l\'ha mai avuto',
    'PERSONALE', N.noteDove({ file: 'vecchio.md', title: 'Del 2025', creato: '2025-11-02T10:00:00.000Z' }, 'zaino'));
  check('pagina senza documento non fabbrica un «PERSONALE · p. 3»',
    'PERSONALE', N.noteDove({ pagina: '3' }, 'zaino'));
  check('noteMateriale dice il documento, senza la pagina', 'dispensa storia',
    N.noteMateriale(daPdf, titoloMateriale));
  check('e senza documento dice PERSONALE', 'PERSONALE', N.noteMateriale(daZero, titoloMateriale));
  /* Un nome che l'abbellitore riduce a niente (un file chiamato «01.pdf») non
     deve lasciare il chip muto: il ripiego è il nome del file. */
  check('se il titolo leggibile è vuoto resta il nome del file', '01.pdf',
    N.noteMateriale({ materiale: '01.pdf' }, titoloMateriale));
  check('l\'etichetta lunga della tendina porta il documento',
    'Le tre guerre — dispensa storia · p. 7', N.noteEtichettaAltrove(daPdf, 'zaino', titoloMateriale));
}

/* ============================== 3. «qui» nello zaino = questo documento ==== */
sezione('«Qui» nello zaino vuol dire «da questo documento»');
{
  const a = { file: 'a.md', title: 'A', materiale: '03 dispensa.pdf', pagina: '2' };
  const b = { file: 'b.md', title: 'B', materiale: '03 dispensa.pdf', pagina: '9' };
  const c = { file: 'c.md', title: 'C', materiale: '05 altro.pdf', pagina: '1' };
  const p = { file: 'p.md', title: 'Personale' };

  const ctx = ctxZaino('03 dispensa.pdf', 2);
  check('stesso documento, stesso posto — anche a pagine diverse', [true, true],
    [N.noteInChapter(a, ctx), N.noteInChapter(b, ctx)]);
  check('un altro documento è altrove', false, N.noteInChapter(c, ctx));
  check('e un personale, mentre leggi un PDF, è altrove', false, N.noteInChapter(p, ctx));

  /* Nessun PDF aperto: il «posto» è il vuoto, e i PERSONALI ci stanno dentro.
     È ciò che spegne il chip invece di tenerlo acceso a vuoto — il guasto per
     cui il chip era stato spento del tutto. */
  const vuoto = ctxZaino('');
  check('senza niente aperto i personali sono «qui»', true, N.noteInChapter(p, vuoto));
  check('e quelli di un documento sono «altrove»', false, N.noteInChapter(a, vuoto));

  const g = N.noteGroups([c, a, p, b], ctx, null);
  check('i gruppi seguono il documento', [['a.md', 'b.md'], ['p.md', 'c.md']],
    [g.qui.map((x) => x.file), g.altrove.map((x) => x.file)]);
  /* «altrove» si ordina per documento: i personali (materiale vuoto) vengono
     per primi, poi gli altri PDF. Nei corsi l'ordine è per lezione, e non si
     tocca. */
  check('e «altrove» è ordinato per documento, non per titolo', ['p.md', 'c.md'],
    N.noteGroups([c, p], ctx, null).altrove.map((x) => x.file));
  check('l\'appunto aperto che non è nell\'elenco resta orfano, come nei corsi',
    'z.md', (N.noteGroups([a], ctx, { file: 'z.md', title: 'Aperto ora' }).orfano || {}).file);
}

/* ======================= 4. il giro sul disco: la lista bianca dimenticata = */
sezione('«materiale» sopravvive al giro salva → rileggi (lista bianca CHIAVI)');
const VAULT = fs.mkdtempSync(path.join(os.tmpdir(), 'studia-appunti-zaino-'));
const ZAINO = 'ZAINO-storia';
const DIR = A.dir(VAULT, ZAINO);
{
  check('le due chiavi stanno nel vocabolario del frontmatter', [true, true],
    [A.CHIAVI.indexOf('materiale') >= 0, A.CHIAVI.indexOf('pagina') >= 0]);

  const s = A.save(VAULT, ZAINO, null, { title: 'Le tre guerre',
    materiale: '03 dispensa storia.pdf', pagina: '7' }, 'Corpo.', '2026-08-11T09:00:00.000Z');
  const riletto = A.apri(VAULT, ZAINO, s.file).nota;
  check('il documento torna su dal file', '03 dispensa storia.pdf', riletto.materiale);
  check('e la pagina pure', '7', riletto.pagina);
  /* Non basta che l'oggetto tornato li abbia: devono essere SCRITTI. Se
     `serialize` li scartasse, `save` tornerebbe comunque il meta che ha in mano
     e il controllo sopra passerebbe con il file vuoto sotto. */
  const grezzo = fs.readFileSync(path.join(DIR, s.file), 'utf-8');
  check('e nel file ci sono davvero, non solo in memoria', [true, true],
    [grezzo.indexOf('materiale: "03 dispensa storia.pdf"') >= 0, grezzo.indexOf('pagina: "7"') >= 0]);

  // il secondo salvataggio è quello che li perdeva: riscrive tutto il frontmatter
  A.save(VAULT, ZAINO, s.file, A.parse(grezzo).meta, 'Corpo cambiato.', '2026-08-11T10:00:00.000Z');
  const dopo = A.apri(VAULT, ZAINO, s.file).nota;
  check('un secondo salvataggio non li porta via', ['03 dispensa storia.pdf', '7'],
    [dopo.materiale, dopo.pagina]);

  const r = A.rinomina(VAULT, ZAINO, s.file, 'La guerra dei trent\'anni', '2026-08-11T11:00:00.000Z');
  check('rinominare non dà errore', undefined, r.error);
  const rin = A.apri(VAULT, ZAINO, r.file).nota;
  check('e il riferimento al documento sopravvive alla rinomina',
    ['03 dispensa storia.pdf', '7'], [rin.materiale, rin.pagina]);
  check('col titolo nuovo dentro il file', 'La guerra dei trent\'anni', rin.title);
  /* Nello zaino non c'è contesto da mettere davanti al titolo: il nome del file
     è il solo titolo, e cambiare documento non deve rinominare niente. */
  check('il nome del file è il solo titolo', 'La guerra dei trent\'anni.md', r.file);

  // cambiare documento: è ciò che fa la tendina in più della rinomina
  const meta = Object.assign({}, rin);
  delete meta.body; delete meta.file;
  A.save(VAULT, ZAINO, r.file, Object.assign(meta, { materiale: '05 altro.pdf', pagina: '' }), rin.body);
  const spostato = A.apri(VAULT, ZAINO, r.file).nota;
  check('il documento nuovo è scritto', '05 altro.pdf', spostato.materiale);
  check('e la pagina del vecchio non resta appiccicata', undefined, spostato.pagina);

  // e la scelta «PERSONALE»: nessun documento, e il campo sparisce dal file
  A.save(VAULT, ZAINO, r.file, Object.assign(meta, { materiale: '', pagina: '' }), rin.body);
  const personale = A.apri(VAULT, ZAINO, r.file).nota;
  check('scegliere PERSONALE toglie il campo, non lo lascia vuoto', undefined, personale.materiale);
  check('e l\'appunto lo racconta così', 'PERSONALE', N.noteDove(personale, 'zaino', titoloMateriale));
  check('il corpo non si è perso in nessuno dei giri', 'Corpo cambiato.', personale.body.trim());
}

/* ================================= 5. gli appunti di prima restano intatti = */
sezione('Un appunto di corso scritto ieri non si accorge di niente');
{
  const CORSO = 'TD74-DSA';
  const s = A.save(VAULT, CORSO, null, { title: 'Bozza', lezione: 'Cosa sono i DSA',
    capitolo: 'Definizione', lezioneId: '01-fondamenti', capitoloId: '01-fondamenti-c02' },
  'Corpo.', '2026-08-01T09:00:00.000Z');
  const n = A.apri(VAULT, CORSO, s.file).nota;
  check('il nome composto è quello di sempre', 'Cosa sono i DSA - Definizione - Bozza.md', s.file);
  check('e nessun campo nuovo gli è spuntato addosso', [undefined, undefined],
    [n.materiale, n.pagina]);
  check('il frontmatter non nomina nemmeno le chiavi nuove', false,
    /materiale|pagina/.test(fs.readFileSync(path.join(DIR.replace(ZAINO, CORSO), s.file), 'utf-8')));
  check('e continua a dire dove sta', 'Cosa sono i DSA · Definizione', N.noteDove(n));
}

try { fs.rmSync(VAULT, { recursive: true, force: true }); } catch (e) {}

console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati') + ' (' + ok + ' ok)');
process.exit(ko ? 1 : 0);
