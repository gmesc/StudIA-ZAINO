'use strict';
/**
 * Test della persistenza delle mappe personali (lib/mappe.js).
 *
 * Il patto da difendere è quello degli appunti: sono file dell'UTENTE, e le due
 * cose che non devono succedere mai sono (a) una mappa che sparisce senza dirlo
 * e (b) un file lasciato a metà da una scrittura interrotta. Quasi tutto ciò che
 * segue prova una di queste due.
 *
 * Gira su una cartella temporanea: il vault vero non si tocca.
 *
 *   node test/mappe.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const M = require('../lib/mappe');
const pacchetto = require('../lib/pacchetto');
const genera = require('../App/assets/mappa/genera');
const grafoLib = require('../App/assets/mappa/grafo');

let ko = 0, ok = 0;
function check(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { ok++; return; }
  ko++;
  console.log('  ✗ ' + nome + '\n      atteso: ' + a + '\n      avuto:  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

const VAULT = fs.mkdtempSync(path.join(os.tmpdir(), 'studia-mappe-'));
const PROG = 'TD74-DSA';
const DIR = M.dir(VAULT, PROG);
function pulisci() { try { fs.rmSync(DIR, { recursive: true, force: true }); } catch (e) {} }
function scriviGrezzo(nome, testo) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, nome), testo, 'utf-8');
}

// una mappa minima ma completa, con tutto il vocabolario dentro
function mappaProva() {
  return {
    titolo: 'Dislessia: il quadro',
    lezioneId: '01-fondamenti', capitoloId: 'c03',
    nodi: [
      { id: 'n1', testo: 'Dislessia', genere: 'radice', origine: 'generata', livello: 0, gruppo: 0,
        nota: 'Disturbo specifico della decodifica.',
        rimando: { type: 'pdf', file: '03 dispensa DSA.pdf', page: 7, label: 'Tabella 2' } },
      { id: 'n2', testo: 'Decodifica', origine: 'utente', colore: '#0f766e' },
      { id: 'n3', testo: 'Comprensione', origine: 'fonte',
        rimando: { type: 'video', file: '05 lezione.mp4', t: 132, label: 'Definizione' } }
    ],
    archi: [
      { da: 'n1', a: 'n2', rel: 'comprende' },
      { da: 'n1', a: 'n3', rel: 'comprende' },
      { da: 'n2', a: 'n3', rel: 'richiede', cross: true, bidir: true }
    ],
    vista: { motore: 'anelli', orient: 'lr', fsNodo: 15, glossario: false, zoom: { k: 1.4, x: 12, y: -8 } }
  };
}

/* ------------------------------------------------ 1. il giro completo */
sezione('Scrittura → lettura: niente si perde per strada');
pulisci();
{
  const r = M.salva(VAULT, PROG, null, mappaProva(), '2026-08-08T10:00:00.000Z');
  check('salvare non dà errore', undefined, r.error);
  check('il nome del file nasce dal titolo', 'Dislessia- il quadro.json', r.file);
  check('la cartella è MAPPE/', true, fs.existsSync(path.join(DIR, r.file)));

  const a = M.apri(VAULT, PROG, r.file);
  check('riaperta senza errori', '', a.error);
  const m = a.mappa;
  check('titolo', 'Dislessia: il quadro', m.titolo);
  check('il corso lo mette chi salva, non chi chiama', PROG, m.corso);
  check('lezioneId e capitoloId', ['01-fondamenti', 'c03'], [m.lezioneId, m.capitoloId]);
  check('tre nodi, tre archi', [3, 3], [m.nodi.length, m.archi.length]);

  // il vocabolario dei nodi, campo per campo: è il punto di tutto il modulo
  check('id · testo', ['n1', 'Dislessia'], [m.nodi[0].id, m.nodi[0].testo]);
  check('livello · gruppo', [0, 0], [m.nodi[0].livello, m.nodi[0].gruppo]);
  check('genere', 'radice', m.nodi[0].genere);
  check('nota', 'Disturbo specifico della decodifica.', m.nodi[0].nota);
  check('rimando a PDF, intero', { type: 'pdf', file: '03 dispensa DSA.pdf', page: 7, label: 'Tabella 2' }, m.nodi[0].rimando);
  check('rimando a video, intero', { type: 'video', file: '05 lezione.mp4', t: 132, label: 'Definizione' }, m.nodi[2].rimando);
  check('colore scelto a mano', '#0f766e', m.nodi[1].colore);
  check('le tre origini sopravvivono', ['generata', 'utente', 'fonte'], m.nodi.map((n) => n.origine));

  // il vocabolario degli archi
  check('da · a · rel', ['n1', 'n2', 'comprende'], [m.archi[0].da, m.archi[0].a, m.archi[0].rel]);
  check('cross e bidir', [true, true], [m.archi[2].cross, m.archi[2].bidir]);

  // la vista: le leve girate si ritrovano, quelle non toccate valgono il default
  check('leve salvate', ['anelli', 'lr', 15, false], [m.vista.motore, m.vista.orient, m.vista.fsNodo, m.vista.glossario]);
  check('leva non toccata = valore di fabbrica', M.VISTA.gapLivello, m.vista.gapLivello);
  check('zoom e spostamento', { k: 1.4, x: 12, y: -8 }, m.vista.zoom);

  check('creato e aggiornato scritti', ['2026-08-08T10:00:00.000Z', '2026-08-08T10:00:00.000Z'], [m.creato, m.aggiornato]);
  // aprire non è modificare: altrimenti sfogliare le mappe le farebbe risultare
  // tutte «toccate oggi» e l'ordine per uso recente non direbbe più niente
  check('rileggerla non le cambia la data', '2026-08-08T10:00:00.000Z', M.apri(VAULT, PROG, r.file).mappa.aggiornato);
  check('nemmeno passando dall\'elenco', '2026-08-08T10:00:00.000Z', M.elenco(VAULT, PROG).mappe[0].aggiornato);

  // un secondo salvataggio non deve riscrivere la data di nascita
  const r2 = M.salva(VAULT, PROG, r.file, m, '2026-08-09T11:00:00.000Z');
  check('creato resta quello del primo giorno', '2026-08-08T10:00:00.000Z', r2.mappa.creato);
  check('aggiornato segue l\'ultima scrittura', '2026-08-09T11:00:00.000Z', r2.mappa.aggiornato);
}

/* ---------------------------------------------------- 2. formato: 1 */
sezione('«formato» scritto e riletto');
pulisci();
{
  const r = M.salva(VAULT, PROG, null, { titolo: 'Formato' });
  const grezzo = JSON.parse(fs.readFileSync(path.join(DIR, r.file), 'utf-8'));
  check('formato sta nel file, non solo in memoria', 1, grezzo.formato);
  check('ed è la prima chiave: chi legge lo trova subito', 'formato', Object.keys(grezzo)[0]);
  check('riletto vale il FORMATO corrente', M.FORMATO, M.apri(VAULT, PROG, r.file).mappa.formato);

  // un file di una versione futura si legge lo stesso; il numero non si finge
  scriviGrezzo('Futura.json', JSON.stringify({ formato: 99, titolo: 'Futura', nodi: [{ id: 'a', testo: 'x' }], archi: [] }));
  const f = M.apri(VAULT, PROG, 'Futura.json');
  check('un formato sconosciuto non fa saltare la lettura', '', f.error);
  check('e riscrivendola si allinea al formato di casa', 1, f.mappa.formato);
}

/* --------------------------------------- 3. cartella assente ≠ errore */
sezione('Cartella assente: elenco vuoto, non un guasto');
pulisci();
{
  check('list() torna vuoto', [], M.list(VAULT, PROG));
  const r = M.read(VAULT, PROG);
  check('read() torna zero mappe', 0, r.mappe.length);
  check('e nessun errore: l\'assenza è la verità', '', r.error);
  check('elenco() lo stesso', { mappe: [], error: '' }, M.elenco(VAULT, PROG));
  check('MAPPE/ non nasce leggendo', false, fs.existsSync(DIR));

  // un corso che non esiste proprio si comporta uguale
  check('corso inesistente: nessuna mappa, nessun errore', { mappe: [], error: '' }, M.elenco(VAULT, 'MAI-VISTO'));

  // ma un file al posto della cartella è un guasto vero, e va detto
  fs.mkdirSync(path.join(VAULT, 'Corsi', 'FINTO'), { recursive: true });
  fs.writeFileSync(M.dir(VAULT, 'FINTO'), 'non sono una cartella', 'utf-8');
  check('MAPPE che è un file: errore, non elenco vuoto', true, !!M.read(VAULT, 'FINTO').error);
}

/* -------------------------------------- 4. il file rotto compare rotto */
sezione('Un file illeggibile compare rotto, non sparisce');
pulisci();
{
  M.salva(VAULT, PROG, null, { titolo: 'Buona', nodi: [{ id: 'a', testo: 'a' }], archi: [] });
  scriviGrezzo('Rotta.json', '{ "formato": 1, "titolo": "Rotta", "nodi": [');

  const l = M.list(VAULT, PROG);
  check('tutte e due nell\'elenco', 2, l.length);
  check('in ordine di file', ['Buona.json', 'Rotta.json'], l.map((m) => m.file));
  check('la rotta ha un nome da mostrare', 'Rotta', l[1].titolo);
  check('e dichiara di essere rotta', true, !!l[1].errore);
  check('formato 0: non è una mappa che si possa credere', 0, l[1].formato);
  check('la buona resta intatta', 1, l[0].nodi.length);

  const r = M.read(VAULT, PROG);
  check('read() lo dice a chi legge', true, r.error.indexOf('Rotta.json') >= 0);
  check('ma non nasconde le mappe buone', 2, r.mappe.length);

  const a = M.apri(VAULT, PROG, 'Rotta.json');
  check('aprirla singolarmente dà errore e non una mappa vuota', null, a.mappa);
  check('con un motivo', true, a.error.length > 0);
  check('la mappa che non c\'è ha un errore suo', 'la mappa «Mai.json» non esiste', M.apri(VAULT, PROG, 'Mai.json').error);
  check('un nome che esce dalla cartella si rifiuta', true,
    M.apri(VAULT, PROG, '../../_corso.md').error.indexOf('non valido') >= 0);
}

/* ------------------------------------------------ 5. scrittura atomica */
sezione('Scrittura atomica: mai un file a metà');
pulisci();
{
  M.salva(VAULT, PROG, 'Grossa.json', { titolo: 'Grossa', nodi: [{ id: 'a', testo: 'a' }], archi: [] });

  // il temporaneo non sopravvive al salvataggio riuscito
  M.salva(VAULT, PROG, 'Grossa.json', { titolo: 'Grossa', nodi: [{ id: 'a', testo: 'b' }], archi: [] });
  check('nessun .tmp lasciato in giro', [], fs.readdirSync(DIR).filter((f) => f.indexOf('.tmp') >= 0));

  /* La prova vera: durante la scrittura il file definitivo o è quello di prima o
     è quello nuovo, mai una via di mezzo. Si simula il momento peggiore —
     un temporaneo grande e pieno di spazzatura accanto al file buono — e si
     verifica che l'elenco non lo veda mai. */
  scriviGrezzo('Grossa.json.tmp-9999', '{ "formato": 1, "nodi": [ {"id": "x"');
  const l = M.list(VAULT, PROG);
  check('il temporaneo non entra nell\'elenco', ['Grossa.json'], l.map((m) => m.file));
  check('e non sporca la lettura', '', M.read(VAULT, PROG).error);
  check('il file definitivo è intero e aggiornato', 'b', l[0].nodi[0].testo);
  fs.unlinkSync(path.join(DIR, 'Grossa.json.tmp-9999'));

  // un salvataggio impossibile non distrugge ciò che c'era
  const prima = fs.readFileSync(path.join(DIR, 'Grossa.json'), 'utf-8');
  const esito = M.salva(VAULT, PROG, 'sotto/Grossa.json', { titolo: 'x' });
  check('un percorso impossibile torna un errore', true, !!esito.error);
  check('e la mappa di prima è ancora lì, identica', prima, fs.readFileSync(path.join(DIR, 'Grossa.json'), 'utf-8'));
}

/* --------------------------------------------- 6. nomi che collidono */
sezione('Nomi che collidono, e caratteri che il filesystem non regge');
pulisci();
{
  const a = M.salva(VAULT, PROG, null, { titolo: 'Sistema nervoso' });
  const b = M.salva(VAULT, PROG, null, { titolo: 'Sistema nervoso' });
  const c = M.salva(VAULT, PROG, null, { titolo: 'Sistema nervoso' });
  check('stesso titolo, tre file distinti',
    ['Sistema nervoso.json', 'Sistema nervoso 2.json', 'Sistema nervoso 3.json'], [a.file, b.file, c.file]);
  check('e tre mappe sul disco, nessuna sovrascritta', 3, M.list(VAULT, PROG).length);
  check('il titolo però resta quello, uguale per tutte',
    ['Sistema nervoso', 'Sistema nervoso', 'Sistema nervoso'], M.list(VAULT, PROG).map((m) => m.titolo));

  // gli accenti e gli spazi restano; solo ciò che il filesystem non regge cade
  const d = M.salva(VAULT, PROG, null, { titolo: 'Perché/come: l\'attenzione' });
  check('accenti e apostrofi restano, / e : diventano -', 'Perché-come- l\'attenzione.json', d.file);
  check('senza titolo si finisce comunque con un nome', 'Mappa senza titolo.json',
    M.salva(VAULT, PROG, null, {}).file);
  check('e con un titolo di ripiego dentro', 'Mappa senza titolo', M.apri(VAULT, PROG, 'Mappa senza titolo.json').mappa.titolo);
}

/* ------------------------------------------------ 7. rinomina e cancella */
sezione('Rinomina e cancellazione');
pulisci();
{
  const a = M.salva(VAULT, PROG, null, { titolo: 'Bozza', nodi: [{ id: 'n1', testo: 'x' }], archi: [] });
  const r = M.rinomina(VAULT, PROG, a.file, 'Sistema limbico');
  check('il file segue il titolo', 'Sistema limbico.json', r.file);
  check('e il titolo dentro è quello nuovo', 'Sistema limbico', r.mappa.titolo);
  check('il file vecchio non resta come doppione', false, fs.existsSync(path.join(DIR, 'Bozza.json')));
  check('i nodi non si perdono nel viaggio', 1, M.apri(VAULT, PROG, r.file).mappa.nodi.length);

  // rinominare col titolo che ha già non deve chiamarla «… 2»
  const r2 = M.rinomina(VAULT, PROG, r.file, 'Sistema limbico');
  check('stesso titolo: stesso file, nessun « 2»', 'Sistema limbico.json', r2.file);
  check('e una sola mappa sul disco', 1, M.list(VAULT, PROG).length);

  check('rinominare una mappa che non c\'è dà errore', true, !!M.rinomina(VAULT, PROG, 'Mai.json', 'x').error);
  check('un titolo vuoto si rifiuta', true, !!M.rinomina(VAULT, PROG, r.file, '   ').error);
  check('e la mappa resta com\'era', 'Sistema limbico', M.apri(VAULT, PROG, r.file).mappa.titolo);

  check('cancellare torna true', true, M.rimuovi(VAULT, PROG, r.file));
  check('e la cartella resta vuota', 0, M.list(VAULT, PROG).length);
  check('cancellare due volte non lancia: torna false', false, M.rimuovi(VAULT, PROG, r.file));
}

/* --------------------------------- 8. semina da una mappa generata */
sezione('«Modifica una copia»: semina da un grafo generato');
pulisci();
{
  // il capitolo arriva nella forma che il lettore consegna a MappaGenera
  const cap = {
    title: 'La <em>discrepanza</em> rispetto al QI',
    brief: 'Il criterio storico, e perché è stato abbandonato.',
    html: '<h3>Il criterio A1</h3><p>Vedi <a class="plink" data-file="03 dispensa.pdf" data-page="7" ' +
          'data-label="Tabella 2">p. 7</a>.</p><h3>Le critiche</h3><p>…</p>',
    keypoints: ['La discrepanza non predice la risposta al trattamento'],
    glossary: [{ t: 'Discrepanza', d: 'Scarto fra rendimento atteso e osservato.' }]
  };
  const g = genera.daCapitolo(cap, { glossario: true, indice: 3 });
  check('il grafo generato ha nodi', true, g.nodi.length > 3);

  const r = M.semina(VAULT, PROG, g, {
    lezioneId: '01-fondamenti', capitoloId: 'c03',
    vista: { motore: 'dag', orient: 'lr', zoom: { k: 2, x: 5, y: 5 } }
  }, '2026-08-08T12:00:00.000Z');
  check('la semina non dà errore', undefined, r.error);
  check('il titolo viene dal capitolo, senza HTML', 'La discrepanza rispetto al QI.json', r.file);

  const m = M.apri(VAULT, PROG, r.file).mappa;
  check('la mappa dichiara di venire dalla generata', 'generata', m.origine);
  check('stessi nodi e stessi archi del grafo', [g.nodi.length, g.archi.length], [m.nodi.length, m.archi.length]);
  check('TUTTI i nodi sono marcati «generata»', true, m.nodi.every((n) => n.origine === 'generata'));
  check('il legame col capitolo è scritto', ['01-fondamenti', 'c03'], [m.lezioneId, m.capitoloId]);
  check('la vista è quella con cui la si stava guardando', ['dag', 'lr', { k: 2, x: 5, y: 5 }],
    [m.vista.motore, m.vista.orient, m.vista.zoom]);

  // i rimandi sono la ragione per cui la mappa è navigabile: devono arrivare interi
  const conRimando = m.nodi.filter((n) => n.rimando);
  check('almeno un nodo porta il suo rimando', true, conRimando.length > 0);
  check('e il rimando è quello che openNote sa aprire', ['pdf', '03 dispensa.pdf', 7],
    [conRimando[0].rimando.type, conRimando[0].rimando.file, conRimando[0].rimando.page]);
  check('l\'indice del capitolo resta sui nodi', 3, m.nodi[0].capitolo);
  check('il genere della radice resta', 'radice', m.nodi[0].genere);

  // ciò che esce da qui deve poter rientrare nei motori senza traduzioni
  const s = grafoLib.sanitizza({ nodi: m.nodi, archi: m.archi });
  check('sanitizza() non scarta niente', [m.nodi.length, m.archi.length], [s.nodi.length, s.archi.length]);
  check('e trova una radice sola', 1, s.radici.length);

  // la copia è una copia: modificarla non rigenera niente
  m.nodi.push({ id: 'mio', testo: 'Una cosa mia', origine: 'utente' });
  M.salva(VAULT, PROG, r.file, m);
  const dopo = M.apri(VAULT, PROG, r.file).mappa;
  check('il nodo aggiunto resta, con la sua origine', 'utente', dopo.nodi[dopo.nodi.length - 1].origine);
  check('e si distingue ancora da ciò che era generato',
    [g.nodi.length, 1],
    [dopo.nodi.filter((n) => n.origine === 'generata').length, dopo.nodi.filter((n) => n.origine === 'utente').length]);

  // una mappa da una lezione, e il caso limite del grafo vuoto
  const lezione = { title: 'Fondamenti', chapters: [{ title: 'Uno', html: '', brief: '' }, { title: 'Due', html: '', brief: '' }] };
  const rc = M.semina(VAULT, PROG, genera.daLezione(lezione, { profondita: 1 }), {});
  check('anche la lezione si semina', 'Fondamenti.json', rc.file);
  check('un grafo vuoto non produce un file vuoto', true, !!M.semina(VAULT, PROG, { nodi: [], archi: [] }, {}).error);
  check('e infatti sul disco non compare', 2, M.list(VAULT, PROG).length);

  /* I due campi che l'editor scrive passano anche di qui: `daGrafo` è pura e non
     deve avere una sua idea di che cosa sia una mappa — la forma la decide
     `entroFormato`, una volta sola, per tutti gli ingressi. */
  const dg = M.daGrafo(
    { nodi: [{ id: 'n1', testo: 'A', x: 30, y: 60 }, { id: 'n2', testo: 'B', x: 10 }], archi: [] },
    { titolo: 'Copia', vista: { chiusi: ['n1', 'n1'] } });
  check('daGrafo porta le posizioni fissate', [30, 60], [dg.nodi[0].x, dg.nodi[0].y]);
  check('e ci applica la stessa regola del tutto-o-niente', undefined, dg.nodi[1].x);
  check('daGrafo porta i rami chiusi della vista', ['n1'], dg.vista.chiusi);
  check('e ogni copia ha il suo array', false,
    dg.vista.chiusi === M.daGrafo({ nodi: [], archi: [] }, {}).vista.chiusi);
}

/* ------------------------------------------ 9. igiene di ciò che arriva */
sezione('Ciò che arriva storto si ripara, non si crede');
pulisci();
{
  const r = M.salva(VAULT, PROG, null, {
    titolo: 'Sporca',
    nodi: [
      { id: 'a', testo: 'A' },
      { id: 'a', testo: 'doppione' },        // stesso id: il secondo perde
      { testo: 'senza id' },                 // non esiste: gli archi lo indicherebbero a vuoto
      { id: 'b', testo: 'B', origine: 'marziana', x: 120, y: 40, chiuso: true }
    ],
    archi: [
      { da: 'a', a: 'b' },
      { da: 'a', a: 'b' },                   // doppione
      { da: 'a', a: 'a' },                   // cappio
      { da: 'a', a: 'fantasma' }             // verso un nodo che non c'è
    ]
  });
  const m = M.apri(VAULT, PROG, r.file).mappa;
  check('id doppi e nodi senza id via', ['a', 'b'], m.nodi.map((n) => n.id));
  check('vince il primo, non l\'ultimo', 'A', m.nodi[0].testo);
  check('cappi, doppioni e archi orfani via', [{ da: 'a', a: 'b' }], m.archi);
  check('un\'origine fuori vocabolario si scarta', undefined, m.nodi[1].origine);
  /* Le coordinate sono nel vocabolario (sezione 10 le prende sul serio); gli
     altri campi che l'editor si inventa non lo sono, e passano lo stesso —
     buttarli farebbe sparire il lavoro dell'utente al primo salvataggio. */
  check('i campi dell\'editor passano intatti', [120, 40, true], [m.nodi[1].x, m.nodi[1].y, m.nodi[1].chiuso]);

  const vuota = M.salva(VAULT, PROG, 'Vuota.json', { titolo: 'Vuota' });
  check('una mappa senza nodi ha comunque la forma piena',
    ['formato', 'titolo', 'corso', 'lezioneId', 'capitoloId', 'origine', 'creato', 'aggiornato', 'nodi', 'archi', 'vista', 'memorie'],
    Object.keys(vuota.mappa).filter((k) => k !== 'file'));
  check('e origine «utente» quando non viene da una generata', 'utente', vuota.mappa.origine);
}

/* ------------------------------- 10. le posizioni fissate a mano (x · y) */
sezione('Un nodo trascinato resta dove l\'hanno messo — o non è fissato affatto');
pulisci();
{
  const r = M.salva(VAULT, PROG, 'Posizioni.json', {
    titolo: 'Posizioni',
    nodi: [
      { id: 'a', testo: 'A', x: 120, y: -40 },   // il caso normale, anche in negativo
      { id: 'b', testo: 'B', x: 0, y: 0 },       // l'origine è una posizione come le altre
      { id: 'c', testo: 'C', x: '240', y: '18' },// una casella di testo consegna stringhe
      { id: 'd', testo: 'D' }                    // mai spostato: nessuna coordinata
    ],
    archi: []
  });
  const m = M.apri(VAULT, PROG, r.file).mappa;
  check('le coordinate tornano dal disco', [120, -40], [m.nodi[0].x, m.nodi[0].y]);
  check('e sono numeri, non stringhe', ['number', 'number'], [typeof m.nodi[0].x, typeof m.nodi[0].y]);
  check('0 è una posizione, non un\'assenza', [0, 0], [m.nodi[1].x, m.nodi[1].y]);
  check('«240» diventa 240', [240, 18], [m.nodi[2].x, m.nodi[2].y]);
  check('un nodo mai spostato non ha coordinate finte',
    [undefined, undefined], [m.nodi[3].x, m.nodi[3].y]);
  check('e nel file non compaiono nemmeno le chiavi', false,
    Object.keys(JSON.parse(fs.readFileSync(path.join(DIR, r.file), 'utf-8')).nodi[3]).indexOf('x') >= 0);

  /* Il tutto-o-niente. Un nodo è fissato se e solo se ha ENTRAMBE le coordinate
     finite: mezzo fissaggio sarebbe un nodo che il motore non sa dove mettere e
     che a schermo non risulta spostato, quindi che nessuno potrebbe liberare. */
  const mezzo = M.apri(VAULT, PROG, M.salva(VAULT, PROG, 'Mezze.json', {
    titolo: 'Mezze',
    nodi: [
      { id: 'a', testo: 'A', x: 120 },                    // la y non è mai arrivata
      { id: 'b', testo: 'B', y: 40 },                     // la x nemmeno
      { id: 'c', testo: 'C', x: NaN, y: 40 },             // NaN: un conto andato a vuoto
      { id: 'd', testo: 'D', x: 'abc', y: 40 },           // testo che non è un numero
      { id: 'e', testo: 'E', x: null, y: 40 },            // ⚠️ +null farebbe 0
      { id: 'f', testo: 'F', x: '', y: 40 },              // ⚠️ +'' pure
      { id: 'g', testo: 'G', x: Infinity, y: 40 },        // fuori dallo schermo di chiunque
      { id: 'h', testo: 'H', x: true, y: 40 }             // ⚠️ +true farebbe 1
    ],
    archi: []
  }).file).mappa;
  check('una x sola non fissa niente', [undefined, undefined], [mezzo.nodi[0].x, mezzo.nodi[0].y]);
  check('e la y rimasta orfana sparisce con lei', [undefined, undefined], [mezzo.nodi[1].x, mezzo.nodi[1].y]);
  check('nessuna coordinata storta sopravvive, e si porta via la buona',
    [], mezzo.nodi.slice(2).filter((n) => n.x !== undefined || n.y !== undefined).map((n) => n.id));

  /* Fin qui si è guardato l'oggetto riletto; adesso il file. ⚠️ La prova che
     conta è proprio questa: `JSON.stringify(NaN)` scrive `null`, quindi un NaN
     sfuggito non si vedrebbe come NaN ma come una coordinata che c'è e vale
     niente — e il motore ci si romperebbe alla riapertura, non al salvataggio.
     (Si serializzano i soli nodi: `vista.zoom` ha per conto suo una `x` e una
     `y`, e cercarle in tutto il file troverebbe quelle.) */
  const grezzo = JSON.stringify(JSON.parse(fs.readFileSync(path.join(DIR, 'Mezze.json'), 'utf-8')).nodi);
  check('nel file non c\'è traccia di «x» o «y» sui nodi', [-1, -1],
    [grezzo.indexOf('"x"'), grezzo.indexOf('"y"')]);

  // il giro completo: si legge, si sposta, si risalva, e la posizione tiene
  const dove = (file, i) => { const n = M.apri(VAULT, PROG, file).mappa.nodi[i]; return [n.x, n.y]; };
  m.nodi[3].x = 500; m.nodi[3].y = 500;
  M.salva(VAULT, PROG, r.file, m);
  check('spostare un nodo e risalvare lo lascia dove è stato messo', [500, 500], dove(r.file, 3));
  // «Libera la posizione»: si tolgono tutte e due, e il nodo torna al motore
  const liberato = M.apri(VAULT, PROG, r.file).mappa;
  delete liberato.nodi[0].x; delete liberato.nodi[0].y;
  M.salva(VAULT, PROG, r.file, liberato);
  check('liberarlo lo toglie davvero dal file', [undefined, undefined], dove(r.file, 0));
}

/* ------------------------------------------- 11. i rami chiusi nella vista */
sezione('La vista ricorda i rami che avevi chiuso');
pulisci();
{
  check('di fabbrica non c\'è nessun ramo chiuso', [], M.VISTA.chiusi);
  check('e una mappa nuova nasce con l\'elenco vuoto, non senza',
    [], M.salva(VAULT, PROG, 'Nuova.json', { titolo: 'Nuova' }).mappa.vista.chiusi);

  const r = M.salva(VAULT, PROG, 'Chiusi.json', {
    titolo: 'Chiusi',
    nodi: [{ id: 'n1', testo: 'A' }, { id: 'n2', testo: 'B' }, { id: 'n3', testo: 'C' }],
    archi: [{ da: 'n1', a: 'n2' }, { da: 'n2', a: 'n3' }],
    vista: { motore: 'anelli', chiusi: ['n2', 'n3'] }
  });
  const m = M.apri(VAULT, PROG, r.file).mappa;
  check('i rami chiusi tornano dal disco', ['n2', 'n3'], m.vista.chiusi);
  check('e sono un array vero, non una stringa', true, Array.isArray(m.vista.chiusi));
  check('le altre leve non si sono spostate', 'anelli', m.vista.motore);

  /* ⚠️ Il ramo delle stringhe di `normalizzaVista` avrebbe fatto «n2,n3»: un id
     solo, che non è nessuno dei due nodi. Vale la pena provarlo dal file. */
  check('nel file è una lista, non un id inventato', ['n2', 'n3'],
    JSON.parse(fs.readFileSync(path.join(DIR, r.file), 'utf-8')).vista.chiusi);

  // igiene: dentro ci vanno id, e un id di nodo è una stringa non vuota
  const sporca = M.salva(VAULT, PROG, 'Sporchi.json', {
    titolo: 'Sporchi',
    vista: { chiusi: ['n1', 'n1', 3, null, '', undefined, { id: 'n2' }, ['n3'], true, 'n4', 'n1'] }
  }).mappa;
  check('doppioni via, non-stringhe via, resta ciò che è un id', ['n1', 'n4'], sporca.vista.chiusi);
  check('e un «chiusi» che non è nemmeno una lista non fa danni', [],
    M.salva(VAULT, PROG, 'Nonlista.json', { titolo: 'Nonlista', vista: { chiusi: 'n1' } }).mappa.vista.chiusi);

  /* ⚠️ Il default è UN oggetto solo per tutto il vault: se `normalizzaVista` lo
     copiasse per riferimento, chiudere un ramo su una mappa lo chiuderebbe su
     tutte — un guasto che non si vede finché non se ne aprono due. */
  const a = M.salva(VAULT, PROG, 'Prima.json', { titolo: 'Prima' }).mappa;
  const b = M.salva(VAULT, PROG, 'Dopo.json', { titolo: 'Dopo' }).mappa;
  check('due mappate salvate di fila non condividono l\'array', false, a.vista.chiusi === b.vista.chiusi);
  a.vista.chiusi.push('intruso');
  check('chiudere un ramo sulla prima non lo chiude sulla seconda', [], b.vista.chiusi);
  check('e non sporca il valore di fabbrica', [], M.VISTA.chiusi);
  check('nemmeno per le mappe salvate dopo', [], M.salva(VAULT, PROG, 'Terza.json', { titolo: 'Terza' }).mappa.vista.chiusi);
  check('lo stesso vale per lo zoom, che ha il problema identico', false,
    a.vista.zoom === b.vista.zoom);

  // i file già sul disco dell'utente: scritti prima che `chiusi` esistesse
  scriviGrezzo('Vecchia.json', JSON.stringify({
    formato: 1, titolo: 'Vecchia', nodi: [{ id: 'n1', testo: 'A' }], archi: [],
    vista: { motore: 'albero', orient: 'td', zoom: { k: 1, x: 0, y: 0 } }
  }, null, 2));
  const v = M.apri(VAULT, PROG, 'Vecchia.json');
  check('una mappa senza «chiusi» si rilegge senza errori', '', v.error);
  check('e si ritrova l\'elenco vuoto, non un buco', [], v.mappa.vista.chiusi);
  check('senza perdere niente per strada', ['Vecchia', 1], [v.mappa.titolo, v.mappa.nodi.length]);
}

/* ------------------------------------------- 12. elenco leggero (sommario) */
sezione('Elenco leggero per il menu a tendina');
pulisci();
{
  M.salva(VAULT, PROG, null, mappaProva(), '2026-08-08T10:00:00.000Z');
  const e = M.elenco(VAULT, PROG);
  check('una voce', 1, e.mappe.length);
  check('i nodi sono un numero, non un elenco', [3, 3], [e.mappe[0].nodi, e.mappe[0].archi]);
  check('ma il titolo e il file ci sono', ['Dislessia: il quadro', 'Dislessia- il quadro.json'],
    [e.mappe[0].titolo, e.mappe[0].file]);
  check('e le date, per ordinare', '2026-08-08T10:00:00.000Z', e.mappe[0].aggiornato);
  check('nessuna vista nel sommario: la si legge aprendo', undefined, e.mappe[0].vista);
}

/* --------------------------------------- 13. MAPPE/ viaggia col pacchetto */
sezione('L\'esportazione non perde le mappe');
{
  const fuori = pacchetto.esclusioni(PROG, { appunti: false });
  check('MAPPE non compare fra le esclusioni', false, fuori.some((x) => x.indexOf('/MAPPE') >= 0));
  const cmd = pacchetto.comandoEsporta(PROG, '/tmp/x.zip', {});
  check('né nel comando di zip', false, cmd.args.some((x) => String(x).indexOf('MAPPE') >= 0));

  const voci = [
    PROG + '/_corso.md',
    PROG + '/LEZIONI/01-fondamenti/01 capitolo.md',
    PROG + '/MAPPE/Dislessia.json',
    PROG + '/MAPPE/Sistema limbico.json',
    PROG + '/MATERIALI/PDF/03 dispensa.pdf'
  ];
  const info = pacchetto.esamina(voci);
  check('il pacchetto è valido', true, info.ok);
  check('e dichiara quante mappe porta', 2, info.mappe);
  check('MAPPE non viene scambiata per una lezione', 1, info.lezioni);
  check('e la descrizione lo dice a chi importa', true, pacchetto.descrizione(info).indexOf('2 mappe') >= 0);
  check('una mappa sola si dice al singolare', true,
    pacchetto.descrizione(pacchetto.esamina(voci.slice(0, 3))).indexOf('1 mappa') >= 0);
  check('un corso senza mappe non ne parla', false,
    pacchetto.descrizione(pacchetto.esamina([PROG + '/_corso.md'])).indexOf('mapp') >= 0);
}

/* ----------------------------------------- 14. il corso protetto */
sezione('Un corso protetto resta scrivibile per le MAPPE');
{
  const PROT = 'TD74-PROTETTO';
  fs.mkdirSync(path.join(VAULT, 'Corsi', PROT, '_lavorazione'), { recursive: true });
  fs.writeFileSync(path.join(VAULT, 'Corsi', PROT, '_corso.md'), '---\ntitle: "Protetto"\nprotetto: true\n---\n', 'utf-8');
  fs.writeFileSync(path.join(VAULT, 'Corsi', PROT, '_lavorazione', '_PROTETTO'), 'x', 'utf-8');
  const corsi = require('../lib/corsi');
  check('il corso è davvero protetto', true, corsi.protetto(VAULT, PROT));

  const r = M.salva(VAULT, PROT, null, { titolo: 'La mia mappa', nodi: [{ id: 'a', testo: 'x' }], archi: [] });
  check('la mappa si salva lo stesso: la protezione ferma la pipeline, non chi studia', undefined, r.error);
  check('ed è lì', 1, M.list(VAULT, PROT).length);
}

/* ----------------- 14-bis. le due porte che perdevano dati
   Trovate dall'audit del contratto prima di scrivere l'interfaccia che lo
   consuma, e verificate eseguendo. Le tengo qui perché sono l'unico tipo di
   difetto che questo modulo non può permettersi: rispondono «fatto». */
sezione('Rinominare cambiando solo le maiuscole NON distrugge la mappa');
{
  pulisci();
  const s = M.salva(VAULT, PROG, null, { titolo: 'Neuroni', nodi: [{ id: 'a', testo: 'x' }], archi: [] });
  const r = M.rinomina(VAULT, PROG, s.file, 'neuroni');
  check('la rinomina riesce', undefined, r.error);
  check('e la mappa è ancora su disco', 1, fs.readdirSync(DIR).length);
  check('l\'elenco la vede ancora', 1, M.elenco(VAULT, PROG).mappe.length);
  /* Il nome tornato deve essere quello VERO: su un volume che non distingue le
     maiuscole il file conserva le sue, e un nome che `list()` non elenca
     lascerebbe il chiamante agganciato a una mappa che sembra sparita. */
  check('il nome tornato è quello che c\'è davvero', true,
    fs.existsSync(path.join(DIR, r.file)));
  check('e apre', '', M.apri(VAULT, PROG, r.file).error);
  check('il titolo dentro è cambiato', 'neuroni', M.apri(VAULT, PROG, r.file).mappa.titolo);

  // il caso normale non deve essersi rotto: lì il vecchio se ne va davvero
  const s2 = M.salva(VAULT, PROG, null, { titolo: 'Sinapsi', nodi: [{ id: 'a', testo: 'x' }], archi: [] });
  const r2 = M.rinomina(VAULT, PROG, s2.file, 'Dendriti');
  check('rinominando per davvero, il vecchio file sparisce', false, fs.existsSync(path.join(DIR, s2.file)));
  check('e il nuovo c\'è', true, fs.existsSync(path.join(DIR, r2.file)));
  pulisci();
}

sezione('Nessuna porta scrive o cancella fuori da MAPPE/');
{
  pulisci();
  const fuori = path.join(VAULT, 'Corsi', PROG, 'APPUNTI');
  fs.mkdirSync(fuori, { recursive: true });
  fs.writeFileSync(path.join(fuori, 'prezioso.md'), 'un appunto vero', 'utf-8');

  check('rimuovi rifiuta un nome che esce dalla cartella', false,
    M.rimuovi(VAULT, PROG, '../APPUNTI/prezioso.md'));
  check('e l\'appunto è ancora lì', true, fs.existsSync(path.join(fuori, 'prezioso.md')));
  check('rimuovi rifiuta anche le barre e i nomi vuoti',
    [false, false, false], [M.rimuovi(VAULT, PROG, 'sub/x.json'), M.rimuovi(VAULT, PROG, 'a\\b.json'), M.rimuovi(VAULT, PROG, '')]);

  const ev = M.salva(VAULT, PROG, '../evaso.json', { titolo: 'Evasa', nodi: [{ id: 'a', testo: 'x' }], archi: [] });
  check('salva rifiuta un nome che esce dalla cartella', 'nome di file non valido: ../evaso.json', ev.error);
  check('e non ha scritto niente fuori', false,
    fs.existsSync(path.join(VAULT, 'Corsi', PROG, 'evaso.json')));

  /* Un titolo non deve poter produrre un file che l'app poi non sa gestire:
     `..` lo renderebbe non apribile, `_` iniziale invisibile all'elenco. */
  const dueP = M.salva(VAULT, PROG, null, { titolo: 'Cap.. 3 sinapsi', nodi: [{ id: 'a', testo: 'x' }], archi: [] });
  check('un titolo con «..» produce un file apribile', '', M.apri(VAULT, PROG, dueP.file).error);
  const basso = M.salva(VAULT, PROG, null, { titolo: '_bozza', nodi: [{ id: 'a', testo: 'x' }], archi: [] });
  check('un titolo che inizia per «_» produce una mappa che si vede', true,
    M.elenco(VAULT, PROG).mappe.some((m) => m.file === basso.file));
  pulisci();
}

/* ------------------------- 15. il giro intero, dalla porta vera
   Questo file prova il disco, `test/modifica.js` le operazioni, `roundtrip` i
   motori e il disegno: tre reti che non si toccano. Il difetto che una delega
   lascia dietro, però, non sta dentro un pezzo — sta FRA due pezzi che si sono
   ignorati. Qui si percorre la catena intera come la percorrerà l'interfaccia:
   estrai → sposta → salva → apri → run → svg. Sta in questo file perché è già
   quello che attraversa il confine fra `lib/` e i moduli del renderer. */
sezione('Dalla modifica al disegno, passando dal disco');
{
  const modifica = require('../App/assets/mappa/modifica');
  const layouts = require('../App/assets/mappa/layouts');
  const disegna = require('../App/assets/mappa/disegna');

  let g = { titolo: 'Capitolo di prova',
    nodi: [{ id: 'n1', testo: 'Radice', genere: 'radice' }, { id: 'n2', testo: 'A' }, { id: 'n3', testo: 'B' }],
    archi: [{ da: 'n1', a: 'n2' }, { da: 'n1', a: 'n3' }] };

  g = modifica.estrai(g, { testo: 'frammento dal PDF', comeFiglioDi: 'n2',
    rimando: { type: 'pdf', file: '03 dispensa.pdf', page: 7, label: 'p. 7' },
    nota: 'la frase attorno al frammento' });
  const idFonte = g.nuovo;
  g = modifica.creaNodo(g, { testo: 'pensiero mio', comeFiglioDi: 'n3' });
  const idMio = g.nuovo;
  g = modifica.sposta(g, idMio, { x: 400, y: -120 });
  g = modifica.etichetta(g, 'n1', 'n2', 'comprende');

  const salvata = M.salva(VAULT, PROG, null, { titolo: 'Giro completo',
    nodi: g.nodi, archi: g.archi, vista: { motore: 'albero', chiusi: ['n2'] } });
  check('il giro parte da un salvataggio riuscito', undefined, salvata.error);
  const riletta = M.apri(VAULT, PROG, salvata.file).mappa;
  const mio = riletta.nodi.find((n) => n.id === idMio);
  const fonte = riletta.nodi.find((n) => n.id === idFonte);

  check('le coordinate arrivano dall\'altra parte', [400, -120], [mio.x, mio.y]);
  check('e il nodo è ancora fissato per il motore', true, grafoLib.fissato(mio));
  check('il rimando dell\'estratto sopravvive intero',
    { type: 'pdf', file: '03 dispensa.pdf', page: 7, label: 'p. 7' }, fonte.rimando);
  check('e con lui la frase d\'origine', 'la frase attorno al frammento', fonte.nota);
  check('le due origini restano distinguibili', ['fonte', 'utente'], [fonte.origine, mio.origine]);
  check('i rami chiusi tornano su dal file', ['n2'], riletta.vista.chiusi);
  check('il verbo si rilegge, la famiglia non è mai stata scritta',
    ['comprende', undefined], [riletta.archi[0].rel, riletta.archi[0].famiglia]);

  const res = layouts.run(riletta, { motore: 'albero', orient: 'td' });
  check('il motore onora la posizione riletta dal disco', [400, -120],
    [res.pos[idMio].x, res.pos[idMio].y]);
  const arco = res.archi.find((a) => a.e.da === 'n3' && a.e.a === idMio);
  const capo = arco.punti[arco.punti.length - 1];
  check('e l\'arco arriva davvero sulla card spostata, non dove stava prima', true,
    Math.abs(capo.x - 400) <= res.opt.w / 2 + 0.6 && Math.abs(capo.y + 120) <= res.opt.h / 2 + 0.6);
  check('il bbox si allarga fino a comprenderla', true,
    res.bbox.minX <= 400 - res.opt.w / 2 && res.bbox.minY <= -120 - res.opt.h / 2);

  const chiusi = riletta.vista.chiusi.reduce((o, id) => (o[id] = 1, o), {});
  check('chiudendo il ramo dal file sparisce il sottoalbero', false,
    grafoLib.senzaRami(riletta, chiusi).grafo.nodi.some((n) => n.id === idFonte));

  const out = disegna.svg(res, { tema: { panel: '#fff', ink: '#111', line: '#ddd', muted: '#5b6069', bg: '#fff' },
    gruppi: ['#0f766e', '#a16207'], fsNodo: 12, fsRel: 10, etichette: 'complete' });
  const cardMio = out.markup.split('data-id="' + idMio + '"')[1].slice(0, 600);
  const cardFonte = out.markup.split('data-id="' + idFonte + '"')[1].slice(0, 600);
  check('il nodo scritto a mano si disegna grigio', true, cardMio.indexOf('#5b6069') >= 0);
  check('quello estratto prende il colore del ramo', true,
    cardFonte.indexOf('#5b6069') < 0 && /#(0f766e|a16207)/.test(cardFonte));
  check('ogni arco ha il suo bersaglio cliccabile', res.archi.length,
    (out.markup.match(/pointer-events="stroke"/g) || []).length);

  const dopo = modifica.liberaTutte(riletta);
  check('il cambio motore dichiara quante posizioni azzera', 1, dopo.liberate);
  check('e da lì in poi il motore decide lui', false,
    layouts.run(dopo, { motore: 'albero' }).pos[idMio].x === 400);
  pulisci();
}

try { fs.rmSync(VAULT, { recursive: true, force: true }); } catch (e) {}

/* ---------------- le cinque memorie di disposizione -------------------------
   Cinque slot FISSI: il terzo bottone è il terzo bottone, e la mano lo ritrova
   senza leggere. Un array di lunghezza variabile farebbe apparire e sparire
   bottoni sotto il dito. */
sezione('Cinque slot, sempre cinque');
{
  const vuota = M.entroFormato({ titolo: 'X' });
  check('una mappa nuova ha cinque slot vuoti', [5, [null, null, null, null, null]],
    [vuota.memorie.length, vuota.memorie]);

  const piena = M.entroFormato({ titolo: 'X', memorie: [
    { nome: 'Visione d\'insieme', vista: { motore: 'anelli' }, posizioni: { n1: { x: 10, y: 20 } } },
    null, null, null, null, { nome: 'sesta', vista: { motore: 'dag' } }
  ] });
  check('la sesta cade: gli slot sono cinque', 5, piena.memorie.length);
  check('la prima si conserva', ['Visione d\'insieme', 'anelli', { x: 10, y: 20 }],
    [piena.memorie[0].nome, piena.memorie[0].vista.motore, piena.memorie[0].posizioni.n1]);

  /* ⚠️ Una memoria senza vista non è una memoria: sarebbe uno slot che sembra
     pieno e non ripristina niente. */
  check('senza vista lo slot resta vuoto', null,
    M.entroFormato({ titolo: 'X', memorie: [{ nome: 'finta' }] }).memorie[0]);
  check('e le posizioni non numeriche cadono, il resto resta', {},
    M.entroFormato({ titolo: 'X', memorie: [{ vista: {}, posizioni: { n1: { x: 'qui', y: 2 } } }] })
      .memorie[0].posizioni);

  /* Il giro completo dal disco: una memoria deve sopravvivere alla scrittura,
     o è una funzione che funziona finché non chiudi l'app. */
  const giro = M.parse(M.serializza(piena));
  check('sopravvive al giro sul disco', ['Visione d\'insieme', { x: 10, y: 20 }],
    [giro.memorie[0].nome, giro.memorie[0].posizioni.n1]);
  check('e lo slot protetto resta protetto', true,
    M.parse(M.serializza(M.entroFormato({ titolo: 'X', memorie: [{ vista: {}, protetta: true }] })))
      .memorie[0].protetta);
}

console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati') + ' (' + ok + ' ok)');
process.exit(ko ? 1 : 0);
