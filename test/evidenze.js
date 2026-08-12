'use strict';
/**
 * Test dell'ancoraggio delle evidenze (App/assets/evidenze/ancoraggio.js).
 *
 * La promessa da difendere è una sola, e ha due facce. Un'evidenza salvata
 * ieri deve riaccendersi OGGI sulla stessa parola, anche se la pipeline ha
 * rigenerato l'HTML del capitolo e riscritto la prosa intorno; e quando quella
 * parola non c'è più, o quando il testo non basta a distinguerla da un'altra
 * uguale, l'evidenza deve dichiararsi orfana invece di accendersi altrove. Il
 * guasto che questi controlli esistono per impedire non è un'eccezione: è il
 * giallo che compare sulla parola sbagliata e nessuno se ne accorge.
 *
 * L'altra promessa è il confine: qui si carica il modulo da Node, senza DOM.
 * Se un giorno qualcuno ci infila un `document`, questo file smette di
 * partire — ed è il suo secondo mestiere.
 *
 *   node test/evidenze.js
 */

const A = require('../App/assets/evidenze/ancoraggio');

let ko = 0, ok = 0;
function check(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { ok++; return; }
  ko++;
  console.log('  ✗ ' + nome + '\n      atteso: ' + a + '\n      avuto:  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

/** Al confine questa casa restituisce valori neutri, non lancia: un ingresso
 *  storto arriva da un file scritto a mano o da una versione vecchia, e non è
 *  un motivo per far cadere l'apertura di un capitolo. Il controllo prova
 *  insieme le due cose — che non sollevi, e che dia il neutro giusto. */
function neutro(nome, atteso, fn) {
  let avuto;
  try { avuto = fn(); }
  catch (e) { ko++; console.log('  ✗ ' + nome + '\n      ha sollevato: ' + e.message); return; }
  check(nome, atteso, avuto);
}

/** Il controllo che vale per tutte: l'operazione non tocca ciò che riceve. */
function puro(nome, x, fn) {
  const prima = JSON.stringify(x);
  fn(x);
  check('l\'ingresso resta intatto — ' + nome, prima, JSON.stringify(x));
}

/** Tutte le posizioni di `ago`, contate qui a mano: se le chiedessi al modulo
 *  proverei il modulo con se stesso. */
function dove(testo, ago) {
  const out = [];
  let da = 0, at;
  while ((at = testo.indexOf(ago, da)) >= 0) { out.push(at); da = at + 1; }
  return out;
}

/** Costruisce la voce di un'evidenza — un selettore più l'id di chi la porta. */
function voceDa(id, testo, frase) {
  const i = testo.indexOf(frase);
  const s = A.daTesto(testo, i, i + frase.length);
  return { id: id, exact: s.exact, prefix: s.prefix, suffix: s.suffix };
}

/* Un paragrafo verosimile del corpus: prosa vera, con le ripetizioni che la
   prosa vera ha. Le prove sulle parole singole girano tutte qui sopra. */
const PARAGRAFO =
  'La memoria di lavoro è il banco su cui la mente tiene aperte le poche cose che sta ' +
  'usando adesso. Ha una capienza ridotta e una durata brevissima: senza ripasso il ' +
  'contenuto svanisce in una manciata di secondi. Nella dislessia la decodifica costa ' +
  'tanto da occupare quasi tutto il banco, e alla comprensione non resta più spazio.';

/* Dieci ricorrenze della stessa espressione, che è IL caso d'uso: nel corpus
   vero di questo progetto «memoria di lavoro» compare nove volte. Ogni frase
   porta un ordinale prima e un numero dopo, così il contesto ha da entrambi i
   lati qualcosa che distingue — come in un capitolo scritto da un umano. */
const ORDINALI = ['prima', 'seconda', 'terza', 'quarta', 'quinta', 'sesta', 'settima', 'ottava', 'nona', 'decima'];
const CHIAVE = 'memoria di lavoro';
const DIECI = ORDINALI
  .map((o, i) => 'Nel paragrafo ' + o + ', la ' + CHIAVE + ' regge ' + (i + 3) + ' elementi.')
  .join(' ');

sezione('normalizza — il testo del DOM non è il testo che si vede');
{
  check('gli a capo e l\'indentazione dell\'HTML diventano un solo spazio',
    'La memoria di lavoro regge poco.',
    A.normalizza('La memoria\n    di lavoro\n\tregge poco.'));
  check('anche il non-breaking space diventa uno spazio come gli altri',
    'tre parole qui',
    A.normalizza('tre parole qui'));
  check('una stringa già normale non cambia: si può normalizzare due volte',
    'La memoria di lavoro regge poco.',
    A.normalizza(A.normalizza('La memoria\n di lavoro  regge poco.')));
  check('accenti, maiuscole e punteggiatura non si toccano: sono il testo',
    'È così, dev\'essere: perché? Sì!',
    A.normalizza('È così, dev\'essere: perché?  Sì!'));
  neutro('un testo che non è una stringa vale la stringa vuota, non un\'eccezione',
    '', () => A.normalizza(null));
  neutro('e nemmeno un numero fa cadere niente', '', () => A.normalizza(42));
}

sezione('daTesto — costruire il selettore');
{
  const i = PARAGRAFO.indexOf('decodifica');
  const sel = A.daTesto(PARAGRAFO, i, i + 'decodifica'.length);
  check('il selettore porta la parola scelta e non un carattere di più', 'decodifica', sel.exact);
  check('di fabbrica si salvano trentadue caratteri prima', 32, sel.prefix.length);
  check('e trentadue dopo', 32, sel.suffix.length);
  check('il prefisso è davvero il testo che precede', PARAGRAFO.slice(i - 32, i), sel.prefix);
  check('e il suffisso quello che segue', PARAGRAFO.slice(i + 10, i + 42), sel.suffix);

  const corto = A.daTesto(PARAGRAFO, i, i + 10, { contesto: 8 });
  check('chi chiede meno contesto ne riceve meno, da entrambi i lati', [8, 8],
    [corto.prefix.length, corto.suffix.length]);
  const nudo = A.daTesto(PARAGRAFO, i, i + 10, { contesto: 0 });
  check('contesto zero è una richiesta legittima e dà un selettore nudo', ['', ''],
    [nudo.prefix, nudo.suffix]);
  check('un contesto storto ricade sui trentadue di fabbrica', 32,
    A.daTesto(PARAGRAFO, i, i + 10, { contesto: 'tanto' }).prefix.length);
}

sezione('daTesto — i bordi del testo');
{
  check('una selezione che comincia al primo carattere ha il prefisso vuoto', '',
    A.daTesto(PARAGRAFO, 0, 2).prefix);
  check('e porta comunque il suo testo', 'La', A.daTesto(PARAGRAFO, 0, 2).exact);
  const n = PARAGRAFO.length;
  check('una selezione che finisce con il testo ha il suffisso vuoto', '',
    A.daTesto(PARAGRAFO, n - 6, n).suffix);
  check('e porta comunque il suo testo', 'spazio.', PARAGRAFO.slice(n - 7, n));

  const breve = 'Ciao mondo';
  const s = A.daTesto(breve, 5, 10);
  check('su un testo più corto del contesto si prende ciò che c\'è, senza lamentarsi',
    { exact: 'mondo', prefix: 'Ciao ', suffix: '' }, s);
  check('e quel selettore si ritrova lo stesso', { inizio: 5, fine: 10, esatto: true },
    A.trova(breve, s));
}

sezione('daTesto — gli ingressi storti non passano e non lanciano');
{
  neutro('un testo che non è una stringa non produce selettore', null, () => A.daTesto(null, 0, 3));
  neutro('nemmeno un testo indefinito', null, () => A.daTesto(undefined, 0, 3));
  neutro('sulla stringa vuota non c\'è niente da selezionare', null, () => A.daTesto('', 0, 0));
  neutro('gli indici invertiti non valgono come selezione al contrario', null, () => A.daTesto('abcdef', 4, 1));
  neutro('due indici uguali darebbero un exact vuoto, che combacerebbe ovunque', null,
    () => A.daTesto('abcdef', 3, 3));
  neutro('un indice oltre la fine del testo non si tronca in silenzio', null, () => A.daTesto('abcdef', 2, 99));
  neutro('un indice negativo nemmeno', null, () => A.daTesto('abcdef', -1, 3));
  neutro('un indice frazionario non è una posizione fra due caratteri', null, () => A.daTesto('abcdef', 1.5, 3));
  neutro('NaN non è zero', null, () => A.daTesto('abcdef', NaN, 3));
  neutro('e la stringa "0" non è il numero 0', null, () => A.daTesto('abcdef', '0', 3));
  neutro('un indice mancante non vale zero', null, () => A.daTesto('abcdef'));
}

sezione('Andata e ritorno sullo stesso testo');
{
  const i = PARAGRAFO.indexOf('decodifica');
  const sel = A.daTesto(PARAGRAFO, i, i + 10);
  check('la parola si ritrova esattamente dove era stata presa',
    { inizio: i, fine: i + 10, esatto: true }, A.trova(PARAGRAFO, sel));
  check('l\'esito dichiara di essere un match esatto, non un\'approssimazione',
    true, A.trova(PARAGRAFO, sel).esatto);

  const frase = 'senza ripasso il contenuto svanisce';
  const j = PARAGRAFO.indexOf(frase);
  check('vale per una frase intera come per una parola sola',
    { inizio: j, fine: j + frase.length, esatto: true },
    A.trova(PARAGRAFO, A.daTesto(PARAGRAFO, j, j + frase.length)));

  // La prova in massa: OGNI parola del paragrafo, non tre scelte bene.
  const parole = [];
  const re = /[A-Za-zÀ-ÿ]{3,}/g;
  let m;
  while ((m = re.exec(PARAGRAFO)) !== null) parole.push([m.index, m.index + m[0].length]);
  const sbagliate = parole
    .filter(([a, b]) => {
      const r = A.trova(PARAGRAFO, A.daTesto(PARAGRAFO, a, b));
      return !r || r.inizio !== a || r.fine !== b;
    })
    .map(([a, b]) => PARAGRAFO.slice(a, b));
  check('il paragrafo di prova contiene le parole che credo', 41, parole.length);
  check('ognuna di quelle parole torna al proprio posto, nessuna esclusa', [], sbagliate);
}

sezione('La stessa espressione dieci volte — è il caso d\'uso');
{
  const posti = dove(DIECI, CHIAVE);
  check('nel testo di prova l\'espressione compare dieci volte', 10, posti.length);

  const ritrovate = posti.map((p) => {
    const r = A.trova(DIECI, A.daTesto(DIECI, p, p + CHIAVE.length));
    return r ? r.inizio : null;
  });
  check('ciascuna delle dieci ricorrenze si ritrova alla propria, non alla prima',
    posti, ritrovate);

  const nudo = A.daTesto(DIECI, posti[6], posti[6] + CHIAVE.length, { contesto: 0 });
  check('tolto il contesto la stessa ricorrenza non è più distinguibile: orfana',
    null, A.trova(DIECI, nudo));
  check('ed è il contesto a fare il lavoro, non la posizione salvata',
    posti[6], A.trova(DIECI, A.daTesto(DIECI, posti[6], posti[6] + CHIAVE.length)).inizio);
}

sezione('Il testo attorno è cambiato, la frase evidenziata no');
{
  // La rigenerazione riscrive l'attacco di ogni frase: `prefix+exact+suffix`
  // non combacia più da nessuna parte, e tocca al punteggio del passo ②.
  // ⚠️ La sostituzione accorcia di due caratteri apposta. Con un rimpiazzo
  // della stessa lunghezza gli indici resterebbero identici, e il controllo
  // passerebbe anche se `trova` avesse salvato la posizione invece del testo.
  const RIVISTO = DIECI.split('Nel paragrafo').join('Nella parte');
  const prima = dove(DIECI, CHIAVE), poi = dove(RIVISTO, CHIAVE);
  check('la riscrittura ha spostato tutte le ricorrenze', false,
    JSON.stringify(prima) === JSON.stringify(poi));

  const ritrovate = prima.map((p) => {
    const r = A.trova(RIVISTO, A.daTesto(DIECI, p, p + CHIAVE.length));
    return r ? r.inizio : null;
  });
  check('ogni evidenza segue la propria frase nel testo riscritto', poi, ritrovate);

  // Un caso più duro: cambia anche la coda, resta solo mezzo contesto buono.
  const MEZZO = RIVISTO.split(' elementi.').join(' unità distinte.');
  const attese = dove(MEZZO, CHIAVE);
  const seguite = prima.map((p) => {
    const r = A.trova(MEZZO, A.daTesto(DIECI, p, p + CHIAVE.length));
    return r ? r.inizio : null;
  });
  check('e le segue anche quando è cambiato il testo da entrambi i lati', attese, seguite);
}

sezione('La frase non c\'è più — orfana, non spostata');
{
  const i = PARAGRAFO.indexOf('la decodifica costa tanto');
  const sel = A.daTesto(PARAGRAFO, i, i + 'la decodifica costa tanto'.length);
  const SPARITA = PARAGRAFO.split('la decodifica costa tanto').join('il riconoscimento pesa');
  neutro('se il testo evidenziato è stato riscritto l\'evidenza è orfana', null,
    () => A.trova(SPARITA, sel));

  const parola = A.daTesto(PARAGRAFO, PARAGRAFO.indexOf('dislessia'), PARAGRAFO.indexOf('dislessia') + 9);
  neutro('e su un capitolo del tutto diverso resta orfana invece di indovinare', null,
    () => A.trova('Un altro capitolo, di tutt\'altro argomento, senza quella parola.', parola));
  check('una parola che sopravvive alla riscrittura invece si ritrova ancora',
    SPARITA.indexOf('dislessia'), A.trova(SPARITA, parola).inizio);
}

sezione('Ambiguità vera — meglio orfana che sbagliata');
{
  // Lo stesso periodo ripetuto: contesto identico a destra e a sinistra ben
  // oltre i trentadue caratteri salvati. Non c'è modo di sapere quale dei due
  // l'utente avesse evidenziato, e inventarlo è il guasto da evitare.
  const RITORNELLO = 'Si applica la regola generale, e in particolare la ' + CHIAVE +
    ' va allenata con costanza ogni giorno. ';
  const DUEVOLTE = RITORNELLO + 'Segue un intermezzo di servizio, lungo quanto basta. ' + RITORNELLO;
  const posti = dove(DUEVOLTE, CHIAVE);
  check('il testo di prova contiene due punti indistinguibili', 2, posti.length);
  const sel = A.daTesto(DUEVOLTE, posti[0], posti[0] + CHIAVE.length);
  check('i due punti hanno lo stesso identico contesto salvato',
    [DUEVOLTE.slice(posti[1] - 32, posti[1]), DUEVOLTE.slice(posti[1] + CHIAVE.length, posti[1] + CHIAVE.length + 32)],
    [sel.prefix, sel.suffix]);
  neutro('a parità di punteggio non si sceglie il primo: si dichiara orfana', null,
    () => A.trova(DUEVOLTE, sel));

  // Basta un carattere che distingua perché il pareggio si rompa.
  const DISTINTE = RITORNELLO + 'Segue un intermezzo di servizio, lungo quanto basta. ' +
    RITORNELLO.replace('ogni giorno', 'ogni settimana');
  check('ma appena un solo carattere distingue i due punti, la scelta torna certa',
    dove(DISTINTE, CHIAVE)[0],
    A.trova(DISTINTE, A.daTesto(DISTINTE, dove(DISTINTE, CHIAVE)[0], dove(DISTINTE, CHIAVE)[0] + CHIAVE.length)).inizio);
}

sezione('Occorrenze sovrapposte — «AA» dentro «AAAA»');
{
  const T = 'la sigla AAAA compare così';
  const posti = dove(T, 'AA');
  check('le occorrenze sovrapposte si contano tutte e tre', 3, posti.length);
  check('e la seconda si ritrova al proprio posto grazie al contesto',
    posti[1], A.trova(T, A.daTesto(T, posti[1], posti[1] + 2)).inizio);

  // ⚠️ Il controllo qui sopra passa dalla strada corta: il contesto intero
  // combacia, e nessuno guarda l'elenco delle occorrenze. Questo invece
  // costringe al punteggio, ed è l'unico che si accorge se le occorrenze
  // vengono raccolte saltando avanti di `exact.length`: la ricorrenza giusta è
  // quella di MEZZO, e saltando non finisce nemmeno fra le candidate.
  const ORIG = 'Nel testo la sigla AAAA compare una volta.';
  const MOD = 'Qui la sigla AAAA compare due volte.';
  const mezzo = ORIG.indexOf('AAAA') + 1;
  check('la ricorrenza di mezzo si ritrova anche dopo che il testo attorno è cambiato',
    MOD.indexOf('AAAA') + 1, (A.trova(MOD, A.daTesto(ORIG, mezzo, mezzo + 2)) || {}).inizio);
}

sezione('trova — gli ingressi storti non passano e non lanciano');
{
  const sel = A.daTesto(PARAGRAFO, 3, 10);
  neutro('un testo nullo non fa cadere l\'apertura del capitolo', null, () => A.trova(null, sel));
  neutro('nemmeno un testo vuoto', null, () => A.trova('', sel));
  neutro('un selettore nullo non cerca niente', null, () => A.trova(PARAGRAFO, null));
  neutro('un selettore che non è un oggetto nemmeno', null, () => A.trova(PARAGRAFO, 'memoria'));
  neutro('un selettore senza exact non è un selettore', null, () => A.trova(PARAGRAFO, { prefix: 'La ' }));
  neutro('un exact vuoto combacerebbe ovunque: non vale', null, () => A.trova(PARAGRAFO, { exact: '' }));
  neutro('un exact che non è una stringa nemmeno', null, () => A.trova(PARAGRAFO, { exact: 42 }));
  neutro('un selettore senza contesto è comunque legittimo se il testo è unico',
    { inizio: PARAGRAFO.indexOf('dislessia'), fine: PARAGRAFO.indexOf('dislessia') + 9, esatto: true },
    () => A.trova(PARAGRAFO, { exact: 'dislessia' }));
  neutro('un prefisso nullo vale un prefisso assente, non un errore',
    PARAGRAFO.indexOf('dislessia'),
    () => A.trova(PARAGRAFO, { exact: 'dislessia', prefix: null, suffix: undefined }).inizio);
  neutro('e i campi in più che la voce si porta dietro non danno fastidio',
    PARAGRAFO.indexOf('dislessia'),
    () => A.trova(PARAGRAFO, { id: 'e7', colore: 'giallo', exact: 'dislessia' }).inizio);
}

sezione('risolvi — riaccendere tutte le evidenze all\'apertura');
{
  const elenco = [
    voceDa('c', PARAGRAFO, 'comprensione'),
    voceDa('a', PARAGRAFO, CHIAVE),
    voceDa('b', PARAGRAFO, 'decodifica')
  ];
  const r = A.risolvi(PARAGRAFO, elenco);
  check('escono ordinate per posizione nel testo, non nell\'ordine in cui erano salvate',
    ['a', 'b', 'c'], r.trovate.map((t) => t.voce.id));
  check('ognuna porta i propri indici',
    [PARAGRAFO.indexOf(CHIAVE), PARAGRAFO.indexOf('decodifica'), PARAGRAFO.indexOf('comprensione')],
    r.trovate.map((t) => t.inizio));
  check('la voce torna per riferimento, così chi chiama riconosce la sua', [true],
    r.trovate.filter((t) => t.voce.id === 'b').map((t) => t.voce === elenco[2]));
  check('nessuna orfana e nessuna sovrapposta su un capitolo intatto', [0, 0],
    [r.orfane.length, r.sovrapposte.length]);
}
{
  const viva = voceDa('viva', PARAGRAFO, 'dislessia');
  const morta = { id: 'morta', exact: 'una frase che nel capitolo non è mai esistita', prefix: '', suffix: '' };
  const r = A.risolvi(PARAGRAFO, [morta, viva]);
  check('le orfane si separano dalle vive invece di far saltare tutto il blocco',
    [['viva'], ['morta']], [r.trovate.map((t) => t.voce.id), r.orfane.map((v) => v.id)]);
  check('un\'orfana torna com\'era, non ridotta a un indice', true, r.orfane[0] === morta);
}
{
  // Chi evidenzia «memoria di lavoro» e poi «memoria di» ha due evidenze
  // legittime sugli stessi caratteri: il DOM non può avvolgerle entrambe.
  const lunga = voceDa('lunga', PARAGRAFO, CHIAVE);
  const corta = voceDa('corta', PARAGRAFO, 'memoria di');
  const altra = voceDa('altra', PARAGRAFO, 'decodifica');
  const r = A.risolvi(PARAGRAFO, [corta, lunga, altra]);
  check('a parità di inizio si tiene la più lunga', ['lunga', 'altra'], r.trovate.map((t) => t.voce.id));
  check('e quella che si sovrappone non viene chiamata orfana: il suo testo c\'è',
    [['corta'], []], [r.sovrapposte.map((t) => t.voce.id), r.orfane.map((v) => v.id)]);
  check('la sovrapposta conserva gli indici trovati, per l\'elenco laterale',
    [[PARAGRAFO.indexOf('memoria di'), PARAGRAFO.indexOf('memoria di') + 10]],
    r.sovrapposte.map((t) => [t.inizio, t.fine]));
}
{
  // Due evidenze che si toccano senza accavallarsi devono passare entrambe:
  // la fine dell'una è l'inizio dell'altra, e questo non è un conflitto.
  const i = PARAGRAFO.indexOf('memoria di lavoro');
  const a = A.daTesto(PARAGRAFO, i, i + 7);
  const b = A.daTesto(PARAGRAFO, i + 7, i + 17);
  a.id = 'a'; b.id = 'b';
  const r = A.risolvi(PARAGRAFO, [a, b]);
  check('due evidenze adiacenti passano entrambe: toccarsi non è sovrapporsi',
    ['a', 'b'], r.trovate.map((t) => t.voce.id));
}
{
  neutro('un elenco vuoto dà tre elenchi vuoti, non un\'eccezione',
    { trovate: [], orfane: [], sovrapposte: [] }, () => A.risolvi(PARAGRAFO, []));
  neutro('un elenco che non è un elenco nemmeno',
    { trovate: [], orfane: [], sovrapposte: [] }, () => A.risolvi(PARAGRAFO, 'evidenze'));
  neutro('e un testo nullo con un elenco nullo',
    { trovate: [], orfane: [], sovrapposte: [] }, () => A.risolvi(null, null));
  neutro('una voce nulla dentro l\'elenco finisce fra le orfane senza far cadere le altre',
    1, () => A.risolvi(PARAGRAFO, [null, voceDa('v', PARAGRAFO, 'dislessia')]).trovate.length);
}

sezione('Purezza — niente di ciò che entra viene toccato');
{
  const sel = A.daTesto(PARAGRAFO, 10, 20);
  puro('trova non scrive dentro il selettore che riceve', sel, (x) => A.trova(PARAGRAFO, x));
  // ⚠️ Il controllo qui sopra da solo non basta: un selettore uscito da
  // `daTesto` ha già i campi a posto, e una scrittura che si limita a
  // raddrizzarli non si vedrebbe. Questo parte da un selettore SPORCO — è la
  // forma che arriva da un file scritto a mano — e allora la scrittura si vede.
  puro('e non ne raddrizza i campi per comodità propria', { exact: 'dislessia', prefix: null },
    (x) => A.trova(PARAGRAFO, x));
  puro('daTesto non scrive dentro le opzioni', { contesto: 12 },
    (x) => A.daTesto(PARAGRAFO, 10, 20, x));

  const elenco = [voceDa('a', PARAGRAFO, 'decodifica'), voceDa('b', PARAGRAFO, 'comprensione')];
  puro('risolvi non tocca l\'elenco né le voci che contiene', elenco, (x) => A.risolvi(PARAGRAFO, x));

  const stesso = A.daTesto(PARAGRAFO, 10, 20);
  check('e chiamare trova due volte dà due volte lo stesso esito',
    A.trova(PARAGRAFO, stesso), A.trova(PARAGRAFO, stesso));
  check('il modulo espone cinque funzioni e nessuno stato',
    ['daTesto', 'normalizza', 'parolePiene', 'risolvi', 'trova'], Object.keys(A).sort());
}

sezione('Il confine: qui dentro non entra il DOM');
{
  const sorgente = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'App', 'assets', 'evidenze', 'ancoraggio.js'), 'utf-8');
  // Si guarda il CODICE, non i commenti: la testata del file nomina il DOM
  // apposta, per dire che non ci deve entrare. Vanno via i blocchi /* … */
  // interi, non le righe che cominciano per `*`: la testata a banda di questa
  // casa ha righe di prosa che cominciano con una parola qualunque.
  const codice = sorgente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  check('nel codice non compaiono document, window, Range o createTreeWalker', [],
    ['document', 'window', 'Range', 'createTreeWalker', 'querySelector']
      .filter((t) => codice.indexOf(t) >= 0));
}

/* =====================================================================
   La persistenza (lib/evidenze.js): l'elenco su disco.

   Sta in questo file e non in un quarto perché è la stessa funzione vista
   dall'altro capo — là si ritrova il testo, qui si ricorda quale. Le prove
   girano in una cartella temporanea: nessuna tocca il vault.
   ===================================================================== */

const fs = require('fs');
const os = require('os');
const path = require('path');
const E = require('../lib/evidenze');

const VAULT = fs.mkdtempSync(path.join(os.tmpdir(), 'studia-evidenze-'));
const CORSO = 'corso-di-prova';
const QUANDO = '2026-08-09T10:00:00.000Z';
const voce = (testo, extra) => Object.assign({
  exact: testo, prefix: 'prima di ', suffix: ' e poi',
  capitoloId: '01-fondamenti-c02', capitolo: 'Memoria e attenzione',
  lezioneId: '01-fondamenti', colore: '#a16207'
}, extra || {});

sezione('Su disco: scrivere, rileggere, non perdere niente');
{
  const vuoto = E.leggi(VAULT, CORSO);
  check('un corso senza evidenze non è un errore', ['', 0], [vuoto.error, vuoto.evidenze.length]);

  const a = E.aggiungi(VAULT, CORSO, voce('memoria di lavoro'), QUANDO);
  check('aggiungere non dà errore', '', a.error);
  check('e torna l\'evidenza scritta', 'memoria di lavoro', a.evidenza.exact);
  check('con la data che le è stata data', QUANDO, a.evidenza.creato);

  const r = E.leggi(VAULT, CORSO);
  check('rileggendo, l\'evidenza è lì', 1, r.evidenze.length);
  check('e nessun campo si è perso per strada',
    JSON.stringify(a.evidenza), JSON.stringify(r.evidenze[0]));
}

sezione('L\'identità è il testo PIÙ il suo contorno');
{
  const uno = E.identita(voce('memoria'));
  const due = E.identita(voce('memoria', { prefix: 'un altro punto ' }));
  check('la stessa parola in due punti diversi ha due identità', true, uno !== due);
  check('lo stesso punto ha sempre la stessa identità', uno, E.identita(voce('memoria')));
  check('e cambiare capitolo cambia l\'identità', true,
    uno !== E.identita(voce('memoria', { capitoloId: '02-altro-c01' })));
}

sezione('Aggiungere due volte lo stesso punto non lo duplica');
{
  E.aggiungi(VAULT, CORSO, voce('attenzione'), QUANDO);
  const dopo = E.aggiungi(VAULT, CORSO, voce('attenzione'), '2026-08-09T11:00:00.000Z');
  check('l\'elenco non si allunga', 2, dopo.evidenze.length);
  check('e la data di nascita resta la prima', QUANDO,
    dopo.evidenze.filter((x) => x.exact === 'attenzione')[0].creato);

  const col = E.aggiungi(VAULT, CORSO, voce('attenzione', { colore: '#1d4ed8' }), QUANDO);
  check('ma un colore nuovo vince', '#1d4ed8',
    col.evidenze.filter((x) => x.exact === 'attenzione')[0].colore);
  check('senza aggiungere una riga', 2, col.evidenze.length);
}

sezione('Colorare e togliere');
{
  const id = E.leggi(VAULT, CORSO).evidenze[0].id;
  const c = E.colora(VAULT, CORSO, id, '#0f766e');
  check('il colore si scrive', '#0f766e', c.evidenza.colore);
  check('e resta scritto', '#0f766e', E.leggi(VAULT, CORSO).evidenze.filter((x) => x.id === id)[0].colore);
  check('colorare un\'evidenza che non c\'è lo dice', 'evidenza non trovata',
    E.colora(VAULT, CORSO, 'inesistente', '#000').error);

  const t = E.rimuovi(VAULT, CORSO, id);
  check('togliere dice quante ne ha tolte', 1, t.tolte);
  check('e l\'elenco si accorcia', 1, t.evidenze.length);
  check('togliere ciò che non c\'è non è un errore, ma nemmeno un successo',
    [0, ''], [E.rimuovi(VAULT, CORSO, 'inesistente').tolte, E.rimuovi(VAULT, CORSO, 'inesistente').error]);
}

sezione('Ciò che arriva storto non entra');
{
  const s = E.salva(VAULT, CORSO, [voce('buona'), { exact: '' }, null, 'stringa', voce('buona')]);
  check('senza testo, non è un\'evidenza: resta fuori', 1, s.evidenze.length);
  check('e i doppioni si potano scrivendo', 'buona', s.evidenze[0].exact);
  check('una pagina non numerica diventa vuota, non NaN', '',
    E.normalizzaVoce(voce('x', { pagina: 'sette' })).pagina);
  check('una pagina vera resta un intero', 7, E.normalizzaVoce(voce('x', { pagina: '7' })).pagina);
  check('dal colore si tolgono i caratteri che in uno stile non hanno senso',
    'rossoalert(1)', E.coloreValido('rosso;<alert(1)>'));
}

sezione('⚠️ Il corso è una cartella, non un percorso');
{
  // la trappola già pagata in mappe.js: `rimuovi(p,'../APPUNTI/prezioso.md')`
  // cancellava un appunto dell'utente e rispondeva «fatto»
  check('un corso con .. viene rifiutato in lettura', 'corso non valido',
    E.leggi(VAULT, '../../altrove').error);
  check('e anche in scrittura', 'corso non valido',
    E.salva(VAULT, '../../altrove', [voce('x')]).error);
  check('e con una barra pure', 'corso non valido', E.leggi(VAULT, 'a/b').error);
}

sezione('⚠️ Zero evidenze non è un file vuoto: è nessun file');
{
  // difetto vero, trovato guardando il vault: `salva(corso, [])` seminava
  // `_evidenze.json` e `_evidenze.md` vuoti in ogni corso che sfiorava
  const CORSO2 = 'corso-mai-toccato';
  const s = E.salva(VAULT, CORSO2, []);
  check('salvare niente non è un errore', '', s.error);
  check('e non crea il JSON', false, fs.existsSync(E.percorso(VAULT, CORSO2)));
  check('né la vista', false, fs.existsSync(E.percorsoVista(VAULT, CORSO2)));

  E.aggiungi(VAULT, CORSO2, voce('qualcosa'), QUANDO);
  check('ma appena c\'è qualcosa il file nasce', true, fs.existsSync(E.percorso(VAULT, CORSO2)));
  E.salva(VAULT, CORSO2, []);
  check('e svuotarlo lo riscrive vuoto, invece di lasciarlo mentire', 0,
    JSON.parse(fs.readFileSync(E.percorso(VAULT, CORSO2), 'utf-8')).evidenze.length);
}

sezione('Il JSON è la verità, il markdown è una vista');
{
  E.salva(VAULT, CORSO, [voce('dislessia'), voce('disortografia', { capitolo: 'Altro capitolo' })]);
  const md = fs.readFileSync(E.percorsoVista(VAULT, CORSO), 'utf-8');
  check('la vista dichiara di essere generata', true, md.indexOf('generato automaticamente') > 0);
  check('e dice dov\'è la verità', true, md.indexOf('_evidenze.json') > 0);
  check('raggruppa per capitolo', true, md.indexOf('## Altro capitolo') > 0);
  check('l\'indice è una funzione pura: stesso ingresso, stessa uscita',
    E.indice([voce('x')], QUANDO), E.indice([voce('x')], QUANDO));
  check('e non tocca l\'elenco che riceve', JSON.stringify([voce('x')]),
    (function () { const l = [voce('x')]; E.indice(l, QUANDO); return JSON.stringify(l); })());
}

sezione('Un file illeggibile non si spaccia per «nessuna evidenza»');
{
  fs.mkdirSync(path.dirname(E.percorso(VAULT, 'corso-rotto')), { recursive: true });
  fs.writeFileSync(E.percorso(VAULT, 'corso-rotto'), '{ questo non è json', 'utf-8');
  const r = E.leggi(VAULT, 'corso-rotto');
  check('lo dice invece di tacere', 'il file non è JSON valido', r.error);
  check('e non inventa evidenze', 0, r.evidenze.length);
}

/* La regola «≤ 3 parole appuntate diventano anche parola chiave» si gioca tutta
   su questo conteggio: se sbaglia, la selezione giusta non diventa keyword — o,
   peggio, mezza frase ci diventa. Qui si prova il conteggio, non l'interfaccia
   che lo consulta. */
sezione('Quante parole PIENE ha un frammento');
{
  check('una parola sola', ['fotosintesi'], A.parolePiene('fotosintesi'));
  check('l\'articolo non conta', ['fotosintesi'], A.parolePiene('la fotosintesi'));
  check('l\'apostrofo separa, e l\'articolo apostrofato non conta',
    ['Stati', 'Uniti', 'America'], A.parolePiene("Stati Uniti d'America"));
  check('anche con l\'apostrofo tipografico dei PDF',
    ['acqua'], A.parolePiene('dell’acqua'));
  check('le preposizioni articolate non contano',
    ['legge', 'gravitazione'], A.parolePiene('la legge della gravitazione'));
  check('la punteggiatura ai bordi si toglie', ['sinapsi'], A.parolePiene('«sinapsi,»'));
  check('quella dentro la parola resta', ['d.C'], A.parolePiene('d.C.'));
  check('il trattino NON separa: è una parola sola',
    ['pesco-mandorlo'], A.parolePiene('pesco-mandorlo'));
  check('quattro piene restano quattro',
    ['sistema', 'nervoso', 'centrale', 'periferico'],
    A.parolePiene('il sistema nervoso centrale e periferico').filter(function (p) { return p !== 'e'; }));
  check('gli spazi multipli non fanno parole finte', ['alfa', 'beta'], A.parolePiene('  alfa\n\n  beta  '));
  /* ⚠️ «a» È una preposizione, e questo controllo dice che la regola non fa
     eccezioni per le parole corte: chi evidenzia «da a b» sta evidenziando una
     parola piena sola. */
  check('«a» e «da» sono preposizioni anche da sole', ['b'], A.parolePiene('da a b'));
  neutro('un ingresso che non è una stringa dà elenco vuoto', [], function () { return A.parolePiene(null); });
  neutro('e una stringa di soli articoli pure', [], function () { return A.parolePiene('il la di'); });
  puro('parolePiene', ['x'], function (x) { A.parolePiene('la casa'); return x; });
}

try { fs.rmSync(VAULT, { recursive: true, force: true }); } catch (e) { /* la cartella era temporanea */ }

console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati') + ' (' + ok + ' ok)');
process.exit(ko ? 1 : 0);
