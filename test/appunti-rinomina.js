'use strict';
/**
 * Test della rinomina degli appunti (lib/appunti.js) e delle fonti multiple sui
 * nodi delle mappe (lib/mappe.js).
 *
 * Sono due cose sole, e una sola paura. Rinominare vuol dire scrivere un file
 * nuovo e togliere quello vecchio: fra i due passi c'è il momento in cui
 * l'appunto esiste due volte, e chi sbaglia a decidere quale togliere non perde
 * una riga — perde l'appunto, e risponde «fatto». È già successo alle mappe
 * (§5.1: bastava correggere le maiuscole di un titolo), ed è il motivo per cui
 * qui l'identità di un file la dichiara il filesystem, non il nome.
 *
 * L'altra metà — `fonti` sui nodi — difende la promessa opposta: ciò che è
 * scritto male non deve poter finire su disco, ma nemmeno portarsi via ciò che
 * accanto è scritto bene.
 *
 * Gira su una cartella temporanea creata e ripulita qui: il vault vero non si
 * tocca mai.
 *
 *   node test/appunti-rinomina.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const A = require('../lib/appunti');
const M = require('../lib/mappe');

let ko = 0, ok = 0;
function check(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { ok++; return; }
  ko++;
  console.log('  ✗ ' + nome + '\n      atteso: ' + a + '\n      avuto:  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

const VAULT = fs.mkdtempSync(path.join(os.tmpdir(), 'studia-appunti-rinomina-'));
const CORSO = 'TD74-DSA';
const DIR = A.dir(VAULT, CORSO);

function pulisci() { try { fs.rmSync(DIR, { recursive: true, force: true }); } catch (e) {} }
/** Gli appunti che ci sono davvero su disco, indice escluso. */
function suDisco() {
  try { return fs.readdirSync(DIR).filter((f) => f.endsWith('.md') && !f.startsWith('_')).sort(); }
  catch (e) { return []; }
}
function indice() {
  try { return fs.readFileSync(path.join(DIR, '_indice.md'), 'utf-8'); } catch (e) { return ''; }
}
function inode(nome) {
  try { return fs.statSync(path.join(DIR, nome)).ino; } catch (e) { return null; }
}
function scrivi(meta, corpo) { return A.save(VAULT, CORSO, null, meta, corpo, '2026-08-01T09:00:00.000Z'); }

/* ---------------------------------- 0. la rete contro lo svuotamento */
sezione('⚠️ Un appunto pieno non si svuota da sé');
{
  pulisci();
  /* ⚠️ IL 26 AGOSTO 2026 un appunto dell'utente è stato trovato col frontmatter
     intatto e il CORPO VUOTO: il file c'era, il lavoro di settimane no. La causa
     non è stata riprodotta — e la difesa sta qui, nell'unico punto da cui
     passano tutte le scritture, invece che nel gesto che si sospettava.
     Perdere in silenzio è l'unica cosa peggiore di perdere (invariante 4). */
  const s = scrivi({ title: 'Prezioso' }, 'IL LAVORO DI UN SEMESTRE');

  const auto = A.save(VAULT, CORSO, s.file, { title: 'Prezioso' }, '');
  check('un salvataggio che svuoterebbe viene RIFIUTATO', true, !!auto.error);
  check('e il rifiuto dice perché', true, /svuoterebbe/.test(auto.error));
  check('⚠️ il testo è ancora tutto sul disco', 'IL LAVORO DI UN SEMESTRE',
    A.apri(VAULT, CORSO, s.file).nota.body.trim());
  check('e il file non è stato riscritto a vuoto', 1, suDisco().length);

  /* Solo gli spazi valgono come vuoto: un appunto di soli a capo non è testo. */
  check('anche il corpo di soli spazi è «vuoto»', true,
    !!A.save(VAULT, CORSO, s.file, { title: 'Prezioso' }, '   \n\n  ').error);

  /* ⚠️ Ma svuotare DEVE restare possibile: è un gesto legittimo, e va
     dichiarato da chi lo compie. L'autosalvataggio non lo dichiara mai. */
  const voluto = A.save(VAULT, CORSO, s.file, { title: 'Prezioso' }, '', null, { svuota: true });
  check('chi lo dichiara può svuotare', undefined, voluto.error);
  check('e allora il corpo se ne va davvero', '', A.apri(VAULT, CORSO, s.file).nota.body.trim());

  /* Un appunto GIÀ vuoto si riscrive senza cerimonie: non c'è niente da
     perdere, e chiedere il permesso per non fare danni sarebbe rumore. */
  check('un appunto già vuoto si salva vuoto senza storie', undefined,
    A.save(VAULT, CORSO, s.file, { title: 'Prezioso' }, '').error);

  /* ⚠️ E scrivere del TESTO non passa mai dalla rete: la difesa riguarda solo
     il vuoto, o rallenterebbe ogni battuta. */
  check('scrivere testo non viene mai rifiutato', undefined,
    A.save(VAULT, CORSO, s.file, { title: 'Prezioso' }, 'di nuovo pieno').error);
  check('e il testo nuovo c\'è', 'di nuovo pieno', A.apri(VAULT, CORSO, s.file).nota.body.trim());

  /* Un appunto NUOVO nasce vuoto tutte le volte che serve: la rete difende
     ciò che c'è, non impedisce di cominciare. */
  const nuovo = A.save(VAULT, CORSO, null, { title: 'Appena nato' }, '');
  check('un appunto nuovo può nascere vuoto', undefined, nuovo.error);
}

/* ------------------------------- 0-bis. le versioni, per i casi estremi */
sezione('Le VERSIONI: la copia di ciò che sta per essere perso');
{
  pulisci();
  const s = scrivi({ title: 'Prezioso' }, 'RIGA UNO\nRIGA DUE\nRIGA TRE');

  /* ⚠️ SI VERSIONA SOLO CIÒ CHE PERDE. Un autosalvataggio ogni 1,8 secondi
     seminerebbe migliaia di file per un pomeriggio di scrittura, e il rumore
     renderebbe inservibile proprio la cosa che deve salvare. */
  A.save(VAULT, CORSO, s.file, { title: 'Prezioso' }, 'RIGA UNO\nRIGA DUE\nRIGA TRE\nRIGA QUATTRO');
  check('scrivere di più non lascia nessuna copia', 0, A.versioni(VAULT, CORSO, s.file).length);

  A.save(VAULT, CORSO, s.file, { title: 'Prezioso' }, 'RIGA UNO');
  const dopo = A.versioni(VAULT, CORSO, s.file);
  check('accorciare sì', 1, dopo.length);
  check('e la copia contiene il testo perso', true,
    fs.readFileSync(path.join(A.dirVersioni(VAULT, CORSO), dopo[0]), 'utf-8').indexOf('RIGA QUATTRO') > 0);
  check('col frontmatter, così si riapre come un appunto', true,
    fs.readFileSync(path.join(A.dirVersioni(VAULT, CORSO), dopo[0]), 'utf-8').indexOf('title: "Prezioso"') > 0);

  /* ⚠️ Anche lo svuotamento DICHIARATO lascia la sua copia: è il gesto giusto,
     ma resta il gesto che fa sparire più testo di tutti. */
  A.save(VAULT, CORSO, s.file, { title: 'Prezioso' }, '', null, { svuota: true });
  check('e svuotare lascia la sua', 2, A.versioni(VAULT, CORSO, s.file).length);

  /* ⚠️ Due versioni nello stesso SECONDO non devono diventarne una: succede a
     chi annulla e risalva di seguito, cioè nel gesto da cui questa cartella
     difende. Il nome porta i millesimi — misurato al primo collaudo, dove la
     seconda copia sovrascriveva la prima. */
  check('due copie ravvicinate restano due', true,
    A.nomeVersione('x.md', '2026-08-26T10:00:00.100Z') !== A.nomeVersione('x.md', '2026-08-26T10:00:00.900Z'));

  /* La rotazione: si tengono le più recenti, non tutte per sempre.
     ⚠️ L'ora si PASSA, non si lascia al clock: venti salvataggi di fila cadono
     anche nello stesso millisecondo, due copie prendono lo stesso nome e il
     conto balla — un rosso a corse alterne, che è la cosa peggiore da avere in
     una suite. È la stessa lezione di `fonti/attesa.js`: una prova che dipende
     dal tempo vero è una prova che a volte passa. */
  const quando = (n) => '2026-08-26T10:' + String(10 + n).padStart(2, '0') + ':00.000Z';
  A.save(VAULT, CORSO, s.file, { title: 'Prezioso' }, 'a'.repeat(60), quando(0));
  for (let i = 59; i > 40; i--) {
    A.save(VAULT, CORSO, s.file, { title: 'Prezioso' }, 'a'.repeat(i), quando(60 - i));
  }
  const tenute = A.versioni(VAULT, CORSO, s.file);
  check('non se ne accumulano più del tetto', true, tenute.length <= A.VERSIONI_MAX);
  check('e il tetto è dichiarato dal modulo, non indovinato qui', 10, A.VERSIONI_MAX);
  /* ⚠️ Quelle che restano sono le PIÙ RECENTI: tenere le più vecchie vorrebbe
     dire che dopo dieci ritocchi la copia utile non c'è più. */
  check('e sono le più recenti', tenute.slice().sort().reverse(), tenute);

  /* ⚠️ Le versioni NON sono appunti: non devono comparire nell'elenco né
     nell'indice, o il quaderno si riempirebbe di copie di se stesso. */
  check('l\'elenco degli appunti non le vede', 1, A.read(VAULT, CORSO).notes.length);
  check('e nemmeno l\'indice', false, /— 2026-/.test(indice()));

  /* Una copia di sicurezza non deve poter far fallire il salvataggio: se non si
     riesce a scriverla, il testo NUOVO dell'utente si salva lo stesso. */
  check('versionare un file che non c\'è non solleva e non inventa', '',
    A.versiona(VAULT, CORSO, 'mai-esistito.md'));
}

/* ------------------------------------------------- 1. la rinomina normale */
sezione('Rinominare: il titolo dentro e il nome fuori restano d\'accordo');
pulisci();
{
  const s = scrivi({ title: 'Bozza', lezione: 'Cosa sono i DSA', capitolo: 'Definizione',
    lezioneId: '01-fondamenti', capitoloId: 'c01' }, 'Il corpo che deve sopravvivere.');
  check('l\'appunto nasce col nome composto', 'Cosa sono i DSA - Definizione - Bozza.md', s.file);
  /* ⚠️ Il titolo è l'unica parte del nome che l'utente sceglie, ed è l'unica che
     cambia quando rinomina: nel taglio dei 90 caratteri si accorcia il
     CONTESTO, mai lui. Prima si tagliava in fondo, e con una lezione e un
     capitolo dal titolo lungo il titolo spariva del tutto — così rinominare
     cambiava il testo dentro il file e lasciava il nome identico, cioè un gesto
     che sembrava riuscito a metà senza dire perché. */
  {
    const lunga = { lezione: 'Introduzione al corso di AI literacy e ai modelli linguistici moderni',
      capitolo: 'Che cosa sono i modelli linguistici di grandi dimensioni' };
    const a1 = A.filename(VAULT, CORSO, Object.assign({}, lunga, { title: 'Appunto di prova' }));
    const a2 = A.filename(VAULT, CORSO, Object.assign({}, lunga, { title: 'Appunto rinominato' }));
    check('con un contesto lunghissimo il titolo resta nel nome', [true, true],
      [a1.indexOf('Appunto di prova.md') > 0, a2.indexOf('Appunto rinominato.md') > 0]);
    check('e due titoli diversi danno due nomi diversi', true, a1 !== a2);
    check('il nome sta dentro il limite', true, a1.length <= 93 && a2.length <= 93);
    check('senza contesto il nome è il solo titolo', 'Solo io.md',
      A.filename(VAULT, CORSO, { title: 'Solo io' }));
  }

  const r = A.rinomina(VAULT, CORSO, s.file, 'Che cos\'è la dislessia', '2026-08-09T18:00:00.000Z');
  check('rinominare non dà errore', undefined, r.error);
  check('il nome nuovo segue il titolo nuovo', 'Cosa sono i DSA - Definizione - Che cos\'è la dislessia.md', r.file);
  check('e su disco c\'è quello, e uno solo', [r.file], suDisco());
  check('il vecchio file se n\'è andato', false, fs.existsSync(path.join(DIR, s.file)));

  const riletto = A.apri(VAULT, CORSO, r.file);
  check('si riapre senza errori', '', riletto.error);
  check('il titolo DENTRO il file è quello nuovo', 'Che cos\'è la dislessia', riletto.nota.title);
  check('il corpo è intatto', 'Il corpo che deve sopravvivere.', riletto.nota.body.trim());
  check('gli agganci al capitolo non si perdono', ['01-fondamenti', 'c01'],
    [riletto.nota.lezioneId, riletto.nota.capitoloId]);
  check('la data di nascita resta quella del primo giorno', '2026-08-01T09:00:00.000Z', riletto.nota.creato);
  check('«modificato» segue la rinomina', '2026-08-09T18:00:00.000Z', riletto.nota.modificato);
  check('l\'appunto tornato è quello che c\'è su disco', ['Che cos\'è la dislessia', r.file],
    [r.nota.title, r.nota.file]);
  check('e l\'elenco ne vede sempre uno', 1, A.read(VAULT, CORSO).notes.length);

  // rinominare col titolo che ha già non deve chiamarlo «… 2»: collide con se stesso
  const r2 = A.rinomina(VAULT, CORSO, r.file, 'Che cos\'è la dislessia');
  check('rinominare senza cambiare titolo lascia il nome com\'è', r.file, r2.file);
  check('e non ne fabbrica una seconda copia', 1, suDisco().length);
}

/* ------------------------------------ 2. §5.1 — cambiano solo le maiuscole */
sezione('Cambiare le sole maiuscole NON cancella l\'appunto (guasto 5.1)');
pulisci();
{
  const s = scrivi({ title: 'Neuroni' }, 'Non deve sparire.');
  /* Il volume distingue le maiuscole? Su macOS (e su questo tmpdir) no, ed è
     esattamente la condizione in cui il guasto si manifestava. La risposta
     cambia che cosa è giusto attendersi dall'inode, non che cosa è giusto
     attendersi dall'appunto: quello sopravvive comunque. */
  const insensibile = fs.existsSync(path.join(DIR, s.file.toUpperCase()));

  const r = A.rinomina(VAULT, CORSO, s.file, 'neuroni');
  check('la rinomina riesce', undefined, r.error);
  check('e l\'appunto è ancora su disco: uno, non zero', 1, suDisco().length);
  check('l\'elenco lo vede ancora', 1, A.read(VAULT, CORSO).notes.length);
  check('il nome tornato è quello che esiste davvero', true, fs.existsSync(path.join(DIR, r.file)));
  check('e apre', '', A.apri(VAULT, CORSO, r.file).error);
  check('il titolo dentro è cambiato lo stesso', 'neuroni', A.apri(VAULT, CORSO, r.file).nota.title);
  check('il corpo non si è perso per strada', 'Non deve sparire.', A.apri(VAULT, CORSO, r.file).nota.body.trim());
  /* La prova vera del rimedio, chiesta al filesystem come la chiede il codice.
     Dove il volume non distingue il caso, «Neuroni.md» e «neuroni.md» sono LA
     STESSA voce di cartella — stesso inode — ed è per questo che il vecchio non
     si tocca: cancellarlo sarebbe cancellare quello appena scritto.
     ⚠️ L'inode NON è quello di prima della rinomina, e non deve esserlo: la
     scrittura atomica crea un file nuovo e ci fa `rename` sopra, quindi il
     numero cambia per costruzione. La domanda che conta è se i due NOMI, dopo,
     indicano lo stesso file. */
  const inoVecchio = inode(s.file), inoNuovo = inode('neuroni.md');
  check('i due nomi indicano lo stesso file (inode)', true,
    !insensibile || (inoVecchio !== null && inoVecchio === inoNuovo));
  check('e il nome tornato è quello VERO, quello che il volume ha conservato', true,
    !insensibile || r.file === s.file);
  check('nell\'indice l\'appunto c\'è, col titolo nuovo', true, indice().indexOf('neuroni') >= 0);
}

/* ------------------------------------------------------- 3. la collisione */
sezione('Un titolo già occupato prende il suffisso, non il posto dell\'altro');
pulisci();
{
  const primo = scrivi({ title: 'Memoria di lavoro', lezione: 'Funzioni' }, 'Il primo.');
  const secondo = scrivi({ title: 'Altro', lezione: 'Funzioni' }, 'Il secondo.');
  const r = A.rinomina(VAULT, CORSO, secondo.file, 'Memoria di lavoro');
  check('il secondo prende « 2»', 'Funzioni - Memoria di lavoro 2.md', r.file);
  check('i due appunti sono entrambi lì', ['Funzioni - Memoria di lavoro 2.md', 'Funzioni - Memoria di lavoro.md'], suDisco());
  check('il primo non è stato toccato', 'Il primo.', A.apri(VAULT, CORSO, primo.file).nota.body.trim());
  check('e il secondo è quello rinominato', 'Il secondo.', A.apri(VAULT, CORSO, r.file).nota.body.trim());
  check('che dentro dice il titolo chiesto, non quello del file', 'Memoria di lavoro',
    A.apri(VAULT, CORSO, r.file).nota.title);

  const terzo = scrivi({ title: 'Terzo', lezione: 'Funzioni' }, 'Il terzo.');
  check('il terzo con lo stesso titolo prende « 3»', 'Funzioni - Memoria di lavoro 3.md',
    A.rinomina(VAULT, CORSO, terzo.file, 'Memoria di lavoro').file);
}

/* ---------------------------------- 4. §5.2 — il nome che esce dalla cartella */
sezione('Nessun nome può uscire da APPUNTI/ (guasto 5.2)');
pulisci();
{
  const s = scrivi({ title: 'Il mio appunto' }, 'Prezioso.');
  // un file dell'utente FUORI da APPUNTI/, che nessuna di queste porte deve sfiorare
  const fuori = path.join(VAULT, 'Corsi', CORSO, 'MAPPE');
  fs.mkdirSync(fuori, { recursive: true });
  fs.writeFileSync(path.join(fuori, 'prezioso.json'), '{"titolo":"una mappa vera"}', 'utf-8');

  const cattivi = ['../MAPPE/prezioso.json', 'sub/x.md', 'a\\b.md', '..', ''];
  check('rinomina li rifiuta tutti', [true, true, true, true, true],
    cattivi.map((f) => !!A.rinomina(VAULT, CORSO, f, 'Rubato').error));
  check('e nessuno di loro ha scritto niente', [s.file], suDisco());
  check('la mappa fuori cartella è intatta', '{"titolo":"una mappa vera"}',
    fs.readFileSync(path.join(fuori, 'prezioso.json'), 'utf-8'));

  // le altre due porte che toccano il disco, per la stessa ragione
  check('remove rifiuta un nome che esce dalla cartella', false, A.remove(VAULT, CORSO, '../MAPPE/prezioso.json'));
  check('e la mappa è ancora lì', true, fs.existsSync(path.join(fuori, 'prezioso.json')));
  let scritturaEvasa = '';
  try { A.save(VAULT, CORSO, '../MAPPE/evaso.json', { title: 'Evaso' }, 'x'); }
  catch (e) { scritturaEvasa = e.message; }
  check('save rifiuta un nome che esce dalla cartella', 'nome di file non valido: ../MAPPE/evaso.json', scritturaEvasa);
  check('e non ha lasciato niente fuori', false, fs.existsSync(path.join(fuori, 'evaso.json')));

  // un titolo non deve poter fabbricare un nome che l'app poi non sa più aprire
  const doppioPunto = A.rinomina(VAULT, CORSO, s.file, 'Cap.. 3');
  check('un titolo con «..» non produce un file irraggiungibile', true, A.nomeValido(doppioPunto.file));
  check('e l\'appunto si riapre', '', A.apri(VAULT, CORSO, doppioPunto.file).error);
  const sottolineato = A.rinomina(VAULT, CORSO, doppioPunto.file, '_bozza');
  check('un titolo che comincia per «_» non lo fa sparire dall\'elenco', 1, A.read(VAULT, CORSO).notes.length);
  check('perché il file non comincia per «_»', false, sottolineato.file.charAt(0) === '_');
}

/* ------------------------------------------------ 5. i rifiuti dichiarati */
sezione('Titolo vuoto e appunto inesistente: si dice di no, non si fa a metà');
pulisci();
{
  const s = scrivi({ title: 'Resta così' }, 'Intatto.');
  const vuoti = ['', '   ', '\n\t ', null, undefined];
  check('un titolo vuoto si rifiuta, in tutte le sue forme', [true, true, true, true, true],
    vuoti.map((t) => !!A.rinomina(VAULT, CORSO, s.file, t).error));
  check('e non torna un file', [undefined, undefined, undefined, undefined, undefined],
    vuoti.map((t) => A.rinomina(VAULT, CORSO, s.file, t).file));
  check('l\'appunto è rimasto quello che era', [s.file], suDisco());
  check('col suo titolo', 'Resta così', A.apri(VAULT, CORSO, s.file).nota.title);

  const mai = A.rinomina(VAULT, CORSO, 'mai-esistito.md', 'Nuovo');
  check('rinominare un appunto che non c\'è dà errore', true, /non esiste/.test(mai.error));
  check('e non lo crea', [s.file], suDisco());

  /* L'indice è generato, non scritto: rinominarlo vorrebbe dire farne un
     appunto fasullo e cancellare l'indice, rispondendo «fatto». */
  const idx = A.rinomina(VAULT, CORSO, '_indice.md', 'Rubo l\'indice');
  check('l\'indice non è un appunto e non si rinomina', true, /non è un appunto/.test(idx.error));
  check('ed è ancora al suo posto', true, fs.existsSync(path.join(DIR, '_indice.md')));
  check('gli appunti sono sempre e solo quello di prima', [s.file], suDisco());
}

/* ------------------------------------------------------- 6. l'indice vero */
sezione('L\'indice resta vero: nessun appunto fantasma, nessun titolo vecchio');
pulisci();
{
  scrivi({ title: 'Primo', lezione: 'Fondamenti', capitolo: 'Uno' }, 'a');
  const b = scrivi({ title: 'Da rinominare', lezione: 'Fondamenti', capitolo: 'Due' }, 'b');
  check('l\'indice di partenza li conta tutti e due', true, /\*\*2\*\* appunti/.test(indice()));

  const r = A.rinomina(VAULT, CORSO, b.file, 'Rinominato');
  const idx = indice();
  check('l\'indice nomina il titolo nuovo', true, idx.indexOf('[Rinominato]') >= 0);
  check('e punta al file nuovo', true, idx.indexOf('<' + r.file + '>') >= 0);
  check('il titolo vecchio non c\'è più', false, idx.indexOf('Da rinominare') >= 0);
  check('e nemmeno il file vecchio: l\'indice non elenca fantasmi', false, idx.indexOf(b.file) >= 0);
  check('gli appunti contati sono ancora due, non tre', true, /\*\*2\*\* appunti/.test(idx));
  check('l\'altro appunto è rimasto nell\'indice', true, idx.indexOf('[Primo]') >= 0);
}

/* ============================ mappe: le fonti multiple sui nodi ============ */

const MDIR = M.dir(VAULT, CORSO);
function puliMappe() { try { fs.rmSync(MDIR, { recursive: true, force: true }); } catch (e) {} }
function grezza(file) { return JSON.parse(fs.readFileSync(path.join(MDIR, file), 'utf-8')); }
function nodoCon(fonti) { return M.normalizzaNodo({ id: 'n1', testo: 'Dislessia', fonti: fonti }); }

sezione('Un nodo può portare più fonti, e sopravvivono al giro sul disco');
puliMappe();
{
  check('«fonti» sta nel vocabolario dei nodi', true, M.CAMPI_NODO.indexOf('fonti') >= 0);

  const fonti = [
    { type: 'video', file: '05 lezione.mp4', t: 132, label: 'La definizione' },
    { type: 'pdf', file: '03 dispensa DSA.pdf', page: 7, label: 'Tabella 2' }
  ];
  const s = M.salva(VAULT, CORSO, null, {
    titolo: 'Con le fonti',
    nodi: [{ id: 'n1', testo: 'Dislessia', fonti: fonti }],
    archi: []
  });
  const riletta = M.apri(VAULT, CORSO, s.file).mappa;
  check('le due fonti tornano su dal file, intere', fonti, riletta.nodi[0].fonti);
  check('e nel file ci sono davvero, non solo in memoria', 2, grezza(s.file).nodi[0].fonti.length);

  // il numero arriva da una casella di testo, cioè come stringa: deve tornare numero
  const daTesto = nodoCon([{ type: 'video', file: 'a.mp4', t: '132' }, { type: 'pdf', file: 'b.pdf', page: '7' }]);
  check('«132» e «7» arrivano numeri, non stringhe', [132, 7], [daTesto.fonti[0].t, daTesto.fonti[1].page]);
  check('e t:0 resta 0: è l\'inizio del video, non un campo vuoto', 0,
    nodoCon([{ type: 'video', file: 'a.mp4', t: 0 }]).fonti[0].t);
  check('un campo in più del generatore non si perde', 'ottima',
    nodoCon([{ type: 'pdf', file: 'b.pdf', page: 2, pertinenza: 'ottima' }]).fonti[0].pertinenza);
}

sezione('Una fonte rotta cade da sola, non si porta via le altre');
{
  const misto = nodoCon([
    { type: 'video', file: '05 lezione.mp4', t: 10 },     // buona
    { type: 'audio', file: 'x.mp3' },                     // tipo che nessuno sa aprire
    { type: 'pdf', file: '' },                            // senza file non si apre niente
    { type: 'pdf' },                                      // idem, il campo manca proprio
    null, 'una stringa', 42, ['pdf', 'b.pdf'],            // non sono nemmeno oggetti
    { file: 'senza-tipo.pdf', page: 3 },                  // senza tipo
    { type: 'pdf', file: '03 dispensa.pdf', page: 4 }     // buona
  ]);
  check('restano le due buone, nell\'ordine in cui stavano', ['05 lezione.mp4', '03 dispensa.pdf'],
    misto.fonti.map((f) => f.file));
  check('e sono complete', [10, 4], [misto.fonti[0].t, misto.fonti[1].page]);

  const storto = nodoCon([{ type: 'video', file: 'a.mp4', t: 'presto' }, { type: 'pdf', file: 'b.pdf', page: null }]);
  check('un tempo che non è un numero si toglie: la fonte resta apribile', [false, 'a.mp4'],
    ['t' in storto.fonti[0], storto.fonti[0].file]);
  check('e lo stesso vale per la pagina', [false, 'b.pdf'], ['page' in storto.fonti[1], storto.fonti[1].file]);
  check('le fonti buone sono comunque due', 2, storto.fonti.length);
}

sezione('Un «fonti» vuoto o non-array non finisce mai su disco');
puliMappe();
{
  const senza = [undefined, null, [], 'video:03', 42, {}, [{ type: 'audio', file: 'x.mp3' }]];
  check('nessuno di questi mette un campo «fonti» sul nodo', senza.map(() => false),
    senza.map((v) => 'fonti' in nodoCon(v)));

  const s = M.salva(VAULT, CORSO, null, {
    titolo: 'Senza fonti', nodi: [{ id: 'n1', testo: 'x', fonti: [] }], archi: []
  });
  check('e nel file non c\'è nemmeno un «fonti: []»', false, 'fonti' in grezza(s.file).nodi[0]);
  /* Sul testo si cerca la FORMA, non la parola: «fonti» nel file c'è comunque,
     perché è anche una leva della vista — ed è proprio il motivo per cui questo
     controllo non può essere un `indexOf('"fonti"')`. */
  check('nessun elenco vuoto è finito nel JSON', false,
    /"fonti":\s*\[\s*\]/.test(fs.readFileSync(path.join(MDIR, s.file), 'utf-8')));
}

sezione('Il tetto: un nodo non diventa lo scarico del corpus');
{
  const tante = [];
  for (let i = 0; i < 40; i++) tante.push({ type: 'pdf', file: 'dispensa ' + i + '.pdf', page: i });
  const n = nodoCon(tante);
  check('oltre il tetto si taglia', M.TETTO_FONTI, n.fonti.length);
  check('si taglia dalla coda: la testa dell\'elenco resta com\'era', ['dispensa 0.pdf', 'dispensa 1.pdf'],
    n.fonti.slice(0, 2).map((f) => f.file));
  check('e l\'ultima tenuta è quella al tetto, non una a caso',
    'dispensa ' + (M.TETTO_FONTI - 1) + '.pdf', n.fonti[n.fonti.length - 1].file);

  // il tetto conta le fonti BUONE: le rotte non devono consumare posti
  const conRotte = [];
  for (let i = 0; i < 30; i++) { conRotte.push({ type: 'boh', file: 'x' }); conRotte.push({ type: 'pdf', file: 'b' + i + '.pdf' }); }
  check('le fonti rotte non rubano posti a quelle buone', M.TETTO_FONTI, nodoCon(conRotte).fonti.length);
}

sezione('Chi non ha fonti resta identico a prima: nessuna migrazione');
puliMappe();
{
  const prima = {
    id: 'n1', testo: 'Dislessia', livello: 1, gruppo: 0, origine: 'fonte',
    rimando: { type: 'pdf', file: '03 dispensa.pdf', page: 7, label: 'p. 7' },
    colore: '#0f766e', nota: 'la frase attorno', genere: 'radice', capitolo: 2, x: 10, y: -4
  };
  check('un nodo senza «fonti» passa da normalizzaNodo tale e quale', prima, M.normalizzaNodo(prima));
  check('e non gli spunta il campo dal nulla', false, 'fonti' in M.normalizzaNodo(prima));

  // un file scritto prima che `fonti` esistesse si apre e resta formato 1
  fs.mkdirSync(MDIR, { recursive: true });
  fs.writeFileSync(path.join(MDIR, 'Vecchia.json'), JSON.stringify({
    formato: 1, titolo: 'Vecchia', nodi: [prima], archi: []
  }, null, 2) + '\n', 'utf-8');
  const v = M.apri(VAULT, CORSO, 'Vecchia.json');
  check('una mappa scritta prima delle fonti si apre senza errori', '', v.error);
  check('col suo nodo intatto, rimando compreso', prima.rimando, v.mappa.nodi[0].rimando);
  check('e il formato resta 1: non c\'è niente da migrare', 1, v.mappa.formato);

  /* `fonti` è anche una leva della VISTA (mostra o nasconde le fonti nel
     disegno): due cose diverse con lo stesso nome, e chi tocca l'una non deve
     credere di aver toccato l'altra. */
  const conLeva = M.salva(VAULT, CORSO, null, {
    titolo: 'Leva', nodi: [{ id: 'n1', testo: 'x', fonti: [{ type: 'pdf', file: 'a.pdf' }] }],
    archi: [], vista: { fonti: false }
  });
  const r = M.apri(VAULT, CORSO, conLeva.file).mappa;
  check('la leva della vista resta un booleano', false, r.vista.fonti);
  check('e le fonti del nodo restano un elenco', [{ type: 'pdf', file: 'a.pdf' }], r.nodi[0].fonti);
}

/* ------------------- gli appunti stanno nella variante in cui sono nati -----
   Decisione dell'utente del 10 agosto 2026, la stessa che vale per evidenze e
   mappe. Le varianti di una lezione CONDIVIDONO il titolo per costruzione — è
   la stessa lezione con un altro ordine dei capitoli — quindi un indice
   raggruppato per titolo mescolava in una sezione sola gli appunti di due
   testi diversi, senza dire che erano di due testi diversi. */
sezione('Due varianti della stessa lezione non si scambiano gli appunti');
pulisci();
{
  const base = { lezione: 'Delegation', capitolo: 'Problem awareness' };
  scrivi(Object.assign({ title: 'Nota A', lezioneId: '04-delega--scaletta-a' }, base), 'Corpo A.');
  scrivi(Object.assign({ title: 'Nota B', lezioneId: '04-delega--per-domande' }, base), 'Corpo B.');
  const idx = indice();
  check('l\'indice le conta come due lezioni, non una', true, /in 2 lezioni/.test(idx));
  check('e le due sezioni si distinguono dal nome della variante', 2,
    (idx.match(/^## Delegation — variante «/gm) || []).length);
  check('la variante è leggibile, non uno slug', true, idx.indexOf('variante «scaletta a»') >= 0);
  /* Che ogni appunto stia sotto la SUA sezione, non solo che le sezioni siano
     due: si taglia l'indice sui titoli di secondo livello e si guarda dentro. */
  const sezioni = {};
  idx.split(/^## /m).slice(1).forEach((b) => { sezioni[b.split('\n')[0]] = b; });
  check('sotto «scaletta a» c\'è solo l\'appunto di quella variante', [true, false],
    [/Nota A/.test(sezioni['Delegation — variante «scaletta a»'] || ''),
     /Nota B/.test(sezioni['Delegation — variante «scaletta a»'] || '')]);
  check('e sotto «per domande» solo l\'altro', [false, true],
    [/Nota A/.test(sezioni['Delegation — variante «per domande»'] || ''),
     /Nota B/.test(sezioni['Delegation — variante «per domande»'] || '')]);

  /* Una lezione senza varianti non deve guadagnare un suffisso che non
     significa niente: il sospetto è che l'etichetta si attacchi sempre. */
  scrivi({ title: 'Nota C', lezione: 'Fondamenti', capitolo: 'Che cosa sono',
    lezioneId: '01-fondamenti' }, 'Corpo C.');
  check('una lezione senza varianti resta col suo titolo nudo', true,
    /^## Fondamenti$/m.test(indice()));

  /* L'ordine segue la cartella, cioè la sequenza didattica: prima la 01, poi la
     04. Per titolo sarebbe stato l'alfabeto — «Delegation» prima di
     «Fondamenti» — che è un ordine che non vuol dire niente. */
  const finale = indice();
  check('e l\'indice segue la sequenza didattica, non l\'alfabeto dei titoli', true,
    finale.indexOf('## Fondamenti') < finale.indexOf('## Delegation'));
}

/* --------------------------------------------------------------------------
   `cestina` iniettata: l'appunto va nel Cestino, non nel nulla.

   È il patto di `fonti.elimina` portato sui file che l'utente ha SCRITTO: chi
   passa `cestina` (nell'app è `shell.trashItem`) ottiene una Promise e il file
   consegnato al Cestino; chi non la passa, la cancellazione sincrona di sempre
   — sono le sezioni qui sopra.

   ⚠️ Da qui in poi la prova è asincrona: il `return` interrompe il modulo, e
   la pulizia e il conto finale vivono in fondo alla catena. Chi aggiunge
   sezioni sincrone le metta PRIMA di questa. */
sezione('`cestina` iniettata: l\'appunto va nel Cestino, non nel nulla');
{
  const CESTINO = path.join(VAULT, '_cestino-finto');
  fs.mkdirSync(CESTINO, { recursive: true });
  const cestina = (p) => { fs.renameSync(p, path.join(CESTINO, path.basename(p))); };

  const r = scrivi({ title: 'Da cestinare' }, 'il corpo che deve sopravvivere nel Cestino');
  return Promise.resolve(A.remove(VAULT, CORSO, r.file, { cestina })).then((tolto) => {
    check('con `cestina` la risposta è vera', true, tolto);
    check('il file non è più in APPUNTI/', false, fs.existsSync(path.join(DIR, r.file)));
    check('ed è arrivato nel cestino, intero', true,
      /il corpo che deve sopravvivere/.test(fs.readFileSync(path.join(CESTINO, r.file), 'utf-8')));
    check('e l\'indice non lo elenca più', false, indice().indexOf('Da cestinare') >= 0);

    /* Un Cestino che rifiuta non è «fatto»: la risposta è false e il file
       resta dov'era — «non lo so» non è «sì». */
    const r2 = scrivi({ title: 'Resta qui' }, 'x');
    return Promise.resolve(A.remove(VAULT, CORSO, r2.file, {
      cestina: () => Promise.reject(new Error('il Cestino ha detto no'))
    })).then((tolto2) => {
      check('se il Cestino rifiuta, la risposta è false', false, tolto2);
      check('e l\'appunto è ancora lì', true, fs.existsSync(path.join(DIR, r2.file)));

      /* La porta resta sbarrata anche col Cestino in mano: un nome che esce
         dalla cartella non arriva mai a `cestina`. */
      let chiamata = false;
      return Promise.resolve(A.remove(VAULT, CORSO, '../MAPPE/prezioso.json', {
        cestina: (p) => { chiamata = true; }
      })).then((evaso) => {
        check('un nome che esce dalla cartella si rifiuta anche col cestino', false, evaso);
        check('e `cestina` non è mai stata chiamata', false, chiamata);

        try { fs.rmSync(VAULT, { recursive: true, force: true }); } catch (e) {}
        console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati') + ' (' + ok + ' ok)');
        process.exit(ko ? 1 : 0);
      });
    });
  });
}
