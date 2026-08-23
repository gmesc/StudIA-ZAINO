/* «Aprite a pagina 142»: che cosa vuol dire quello che uno scrive — senza
 * aprire l'app.
 *
 * ⚠️ Che cosa difende. Il valore d'oro è nella prima sezione: **«non ho capito»
 * non è «vai a pagina 1»**. Le due cose sembrano vicine e non lo sono: un
 * ripiego su 1 manderebbe al frontespizio chi ha battuto tre lettere per
 * sbaglio, facendogli perdere il punto in cui stava leggendo, e senza dirglielo.
 * A schermo si proverebbe un caso limite alla volta, aprendo un documento vero.
 *
 *   node test/pagina-fonte.js
 */
const P = require('../App/assets/fonti/pagina.js');

let ko = 0;
function ok(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + nome); return; }
  ko++; console.log('  KO  ' + nome + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

const DOC = { numPages: 266 };

sezione('⭐ «Non ho capito» non è «vai a pagina 1»');
/* Il controllo che vale il file. `null` vuol dire «non si muove niente». */
ok('tre lettere per sbaglio non muovono il documento', null, P.leggi('abc', DOC));
ok('il campo vuoto nemmeno', null, P.leggi('', DOC));
ok('gli spazi soli nemmeno', null, P.leggi('   ', DOC));
ok('e niente del tutto nemmeno', null, P.leggi(null, DOC));
/* ⚠️ «142a» e «1 di 2» non sono richieste di andare a una pagina: sono cose che
   contengono un numero. Accettarle vorrebbe dire indovinare al posto di chi
   scrive, e indovinare male una volta su dieci. */
ok('un numero con della roba attaccata non è una richiesta', null, P.leggi('142a', DOC));
ok('e nemmeno il conteggio incollato per sbaglio', null, P.leggi('1 di 2', DOC));
ok('né un numero negativo scritto per esteso', null, P.leggi('meno 3', DOC));

sezione('Quello che uno scrive davvero');
ok('un numero secco', 142, P.leggi('142', DOC));
ok('con gli spazi attorno', 142, P.leggi('  142 ', DOC));
ok('con la «p.» davanti, come si cita', 142, P.leggi('p. 142', DOC));
ok('senza lo spazio', 142, P.leggi('p.142', DOC));
ok('«pag»', 142, P.leggi('pag 142', DOC));
ok('«pagina», per esteso', 142, P.leggi('pagina 142', DOC));
ok('e le maiuscole non contano', 142, P.leggi('P. 142', DOC));

sezione('Fuori scala si STRINGE, perché è un intento e non rumore');
/* ⚠️ È il contrario di quel che fa `aspetto/stanza.js` con una misura fuori
   scala, e la differenza non è un capriccio: là il valore arriva dal disco, e
   un valore che non sappiamo leggere è RUMORE; qui l'ha appena battuto una
   persona, ed è un INTENTO. Chi scrive 9999 su 266 pagine dice «portami in
   fondo», e portarcelo è la risposta giusta. */
ok('più grande del documento porta all\'ultima', 266, P.leggi('9999', DOC));
ok('lo zero porta alla prima', 1, P.leggi('0', DOC));
ok('l\'ultima pagina è valida', 266, P.leggi('266', DOC));
ok('e la prima anche', 1, P.leggi('1', DOC));
/* Senza sapere quante pagine ci siano non si stringe niente: il documento non
   è ancora arrivato, e chi chiama stringerà quando lo sa. */
ok('senza sapere quante pagine, il numero si tiene', 9999, P.leggi('9999', {}));

sezione('Le etichette: si batte quello che è stampato sulla pagina');
/* Un libro con la prefazione in numeri romani: le prime tre pagine si chiamano
   i, ii, iii, e la quarta è la «1» del testo. */
const LIBRO = { numPages: 6, etichette: ['i', 'ii', 'iii', '1', '2', '3'] };
ok('«iii» porta alla terza pagina fisica', 3, P.leggi('iii', LIBRO));
ok('le maiuscole non contano', 3, P.leggi('III', LIBRO));
ok('e la «p.» davanti nemmeno', 3, P.leggi('p. iii', LIBRO));
/* ⚠️ IL CASO CHE DECIDE: esistono una pagina «1» FISICA (la copertina) e una
   pagina ETICHETTATA «1» (l'inizio del testo). Quella che uno intende è la
   seconda: è quella stampata sul foglio che ha davanti. */
ok('«1» è la pagina che il libro chiama 1, non la prima fisica', 4, P.leggi('1', LIBRO));
ok('e «2» la seconda del testo', 5, P.leggi('2', LIBRO));
ok('un\'etichetta che non esiste ripiega sul numero', 6, P.leggi('6', LIBRO));
ok('e una parola che non è un\'etichetta resta «non ho capito»', null, P.leggi('boh', LIBRO));
/* Un documento senza etichette si comporta come sempre. */
ok('senza etichette, il numero è il numero', 3, P.leggi('3', DOC));

sezione('Che cosa scrive il contatore: sempre il numero FISICO');
/* ⚠️ Le etichette sono un INGRESSO, mai un rimando: `pdf:NN#p=` cita il numero
   fisico, e due numerazioni dentro la grammatica sarebbero due grammatiche. */
ok('«p. 3 di 266»', 'p. 3 di 266', P.etichetta(3, DOC));
ok('anche su un libro con le etichette', 'p. 3 di 6', P.etichetta(3, LIBRO));
ok('senza sapere quante, dice solo dove si è', 'p. 3', P.etichetta(3, {}));
ok('una pagina storta non stampa NaN', 'p. 1 di 266', P.etichetta('boh', DOC));
ok('e nemmeno lo zero', 'p. 1 di 266', P.etichetta(0, DOC));

sezione('Il suggerimento nomina l\'etichetta solo se dice qualcosa in più');
ok('dice che si può scrivere', true, /scrivi il numero/.test(P.suggerimento(3, DOC)));
ok('su un libro dice come si chiama questa pagina', true, /«iii»/.test(P.suggerimento(3, LIBRO)));
/* ⚠️ Su un PDF le cui etichette sono «1, 2, 3…» ripeterle sarebbe rumore. */
const NORMALE = { numPages: 3, etichette: ['1', '2', '3'] };
ok('ma non ripete un\'etichetta uguale al numero', false, /«/.test(P.suggerimento(2, NORMALE)));
ok('e non inventa niente fuori scala', true, /scrivi il numero/.test(P.suggerimento(99, LIBRO)));

sezione('Il sommario: da albero a elenco, col suo livello');
const ALBERO = [
  { title: 'Parte prima', dest: 'd1', items: [
    { title: 'Capitolo 1', dest: 'd2', items: [{ title: 'Un paragrafo', dest: 'd3' }] },
    { title: '  Capitolo   2 ', dest: 'd4' }
  ] },
  { title: '', dest: 'vuoto' },
  { title: 'Parte seconda', dest: 'd5' }
];
const piatto = P.appiattisci(ALBERO);
ok('l\'ordine è quello di lettura', ['Parte prima', 'Capitolo 1', 'Un paragrafo', 'Capitolo 2', 'Parte seconda'],
  piatto.map((v) => v.titolo));
ok('e ogni voce sa quanto è annidata', [0, 1, 2, 1, 0], piatto.map((v) => v.livello));
/* ⚠️ Una riga vuota in un menu è una riga su cui si clicca senza sapere dove si
   va: le voci senza titolo non entrano. */
ok('le voci senza titolo non entrano', false, piatto.some((v) => !v.titolo));
ok('gli spazi di troppo si appiattiscono', 'Capitolo 2', piatto[3].titolo);
/* La destinazione si porta avanti così com'è: risolverla è del renderer, che
   ha il documento e può chiedergli `getPageIndex`. */
ok('la destinazione arriva intatta a chi la sa risolvere', 'd3', piatto[2].dest);
ok('un sommario che non c\'è dà un elenco vuoto', [], P.appiattisci(null));
ok('e uno vuoto pure', [], P.appiattisci([]));

/* ⚠️ Un sommario malfatto può annidarsi all'infinito: un menu di quarantotto
   livelli non è un menu, ed è anche il modo di far esplodere la pila. */
let profondo = { title: 'fondo', dest: 'x' };
for (let i = 0; i < 60; i++) profondo = { title: 'liv ' + i, dest: 'x', items: [profondo] };
const tagliato = P.appiattisci([profondo]);
ok('la profondità si ferma', true, tagliato.length > 0 && tagliato.length <= 4);
ok('e nessuna voce supera il tetto dei livelli', true, tagliato.every((v) => v.livello < 4));

console.log(ko ? `\n✗ ${ko} controlli falliti` : `\n✓ tutti i controlli passati`);
process.exit(ko ? 1 : 0);
