/* Dove passano le righe di una pagina — senza aprire l'app.
 *
 * ⚠️ Che cosa difende. Raggruppare i pezzi di testo in righe sbaglia in
 * silenzio, e nessuno dei suoi modi di sbagliare si vede a occhio: l'apice che
 * diventa una riga sua e fa fermare la fascia due volte sulla stessa riga; il
 * titolo che non ha lo stesso centro del testo accanto; le due colonne che
 * sarebbero due righe per chi raggruppa in orizzontale; i due decimi di pixel
 * fra due `top` che non sono due righe. A schermo si proverebbero puntando il
 * mouse e guardando dove si ferma la fascia, un caso alla volta.
 *
 *   node test/righello.js
 */
const R = require('../App/assets/fonti/righello.js');

let ko = 0;
function ok(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + nome); return; }
  ko++; console.log('  KO  ' + nome + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

/* Una pagina finta ma verosimile: righe alte 14, con l'interlinea. */
const r = (top, h, extra) => Object.assign({ top, bottom: top + h }, extra || {});

sezione('Tre righe sono tre bande');
const semplice = [r(10, 14), r(10, 14), r(30, 14), r(50, 14)];
const b1 = R.righe(semplice);
ok('tre bande', 3, b1.length);
ok('con i loro estremi', [[10, 24], [30, 44], [50, 64]], b1.map((b) => [b.alto, b.basso]));
ok('e il centro in mezzo', [17, 37, 57], b1.map((b) => b.centro));
ok('l\'ordine è quello di lettura', true, b1[0].alto < b1[1].alto && b1[1].alto < b1[2].alto);
/* ⚠️ E l'ordine di ARRIVO non conta: il layer di pdf.js dà i pezzi nell'ordine
   in cui il file li ha emessi, che non è quello in cui si leggono. */
ok('anche se i pezzi arrivano alla rovescia', [[10, 24], [30, 44], [50, 64]],
  R.righe([r(50, 14), r(10, 14), r(30, 14)]).map((b) => [b.alto, b.basso]));

sezione('⭐ Un apice non è una riga sua');
/* Il «2» di «m²»: alto la metà, e sta più su. Il suo CENTRO è fuori da quello
   della riga — chi raggruppasse per centro ne farebbe due bande, e la fascia si
   fermerebbe due volte sulla stessa riga di testo. Il criterio è la
   SOVRAPPOSIZIONE: l'apice sta dentro la fascia della sua parola. */
const conApice = [r(10, 14), r(8, 7), r(30, 14)];
ok('l\'apice resta nella riga della sua parola', 2, R.righe(conApice).length);
ok('e la banda si allarga fin dove arriva', [8, 24],
  [R.righe(conApice)[0].alto, R.righe(conApice)[0].basso]);

sezione('Un titolo e il testo accanto sono la stessa riga');
/* Corpi diversi, centri diversi, stessa riga: si accavallano abbondantemente. */
ok('due corpi diversi non fanno due bande', 1, R.righe([r(10, 28), r(16, 14)]).length);

sezione('⭐ Due colonne sono UNA banda, perché la fascia è orizzontale');
/* ⚠️ Il caso che decide il criterio. Due pezzi lontanissimi in x, alla stessa
   altezza: chi raggruppasse per vicinanza orizzontale farebbe due righe dove
   l'occhio ne vede una — e la fascia, che attraversa la pagina, ne
   illuminerebbe metà. */
const colonne = [r(10, 14, { left: 0, right: 200 }), r(10, 14, { left: 400, right: 600 })];
ok('la stessa altezza è la stessa banda', 1, R.righe(colonne).length);

sezione('Due decimi di pixel non sono due righe');
ok('lo scarto minimo si assorbe', 1, R.righe([r(10, 14), r(10.2, 13.8)]).length);
/* Ma due righe vere restano due: l'interlinea è più della metà del pezzo. */
ok('due righe vere restano due', 2, R.righe([r(10, 14), r(26, 14)]).length);

sezione('Le caselle che non dicono niente non entrano');
/* Il layer monta pezzi che non disegna: una banda alta zero è una fascia che
   non si vede, e un pezzo senza altezza non è una riga. */
ok('un pezzo alto zero si butta', 1, R.righe([r(10, 14), r(30, 0)]).length);
ok('e uno senza numeri anche', 1, R.righe([r(10, 14), { top: 'boh' }]).length);
ok('l\'altezza va bene anche come `height`', 1, R.righe([{ top: 10, height: 14 }]).length);
ok('nessuna casella, nessuna banda', [], R.righe([]));
ok('e niente del tutto nemmeno', [], R.righe(null));

sezione('⭐ Fra due righe non si salta in cima alla pagina');
const b = R.righe(semplice);
ok('dentro la prima riga', 0, R.sotto(b, 15));
ok('dentro la seconda', 1, R.sotto(b, 37));
ok('sul bordo esatto conta come dentro', 0, R.sotto(b, 24));
/* ⚠️ `-1` NON è «la prima»: il puntatore che passa nell'interlinea non deve far
   saltare la fascia in cima alla pagina. */
ok('nell\'interlinea non c\'è nessuna banda', -1, R.sotto(b, 27));
ok('sopra la pagina nemmeno', -1, R.sotto(b, 0));
ok('sotto la pagina nemmeno', -1, R.sotto(b, 999));
ok('e un\'altezza che non è un numero nemmeno', -1, R.sotto(b, 'boh'));

sezione('Ma il puntatore trova sempre la più vicina');
/* La fascia deve SEGUIRE il mouse anche nell'interlinea, invece di sparire e
   riapparire a ogni pixel di passaggio fra una riga e l'altra. */
ok('nell\'interlinea si prende la più vicina', 0, R.vicina(b, 26));
ok('e appena più giù l\'altra', 1, R.vicina(b, 29));
ok('sopra la pagina, la prima', 0, R.vicina(b, -100));
ok('sotto la pagina, l\'ultima', 2, R.vicina(b, 999));
ok('senza bande non c\'è nessuna vicina', -1, R.vicina([], 10));

sezione('Le frecce non girano in tondo');
ok('giù di una', 1, R.passo(b, 0, true));
ok('su di una', 0, R.passo(b, 1, false));
/* ⚠️ Chi legge con la fascia e arriva in fondo alla pagina non vuole
   ritrovarsi in cima: vuole accorgersi che la pagina è finita. Stessa scelta di
   `fonti/zoom.js` e di `aspetto/stanza.js` — al capo, «niente da fare». */
ok('in fondo, giù non fa niente', null, R.passo(b, 2, true));
ok('in cima, su non fa niente', null, R.passo(b, 0, false));
/* Da nessuna parte si comincia dal capo giusto: la fascia appena accesa. */
ok('da nessuna parte, giù comincia dalla prima', 0, R.passo(b, -1, true));
ok('e su comincia dall\'ultima', 2, R.passo(b, -1, false));
ok('un indice fuori scala si comporta come «nessuna parte»', 0, R.passo(b, 99, true));
ok('senza bande non si va da nessuna parte', null, R.passo([], 0, true));

sezione('La soglia si può stringere, e allora l\'apice si stacca');
/* La quota è una manopola dichiarata: serve il giorno che un documento
   dimostrasse di aver bisogno di un criterio diverso. Qui si prova che c'è e
   che fa quello che dice. */
ok('con una quota alta l\'apice diventa una riga sua', 3,
  R.righe(conApice, { quota: 0.95 }).length);
ok('e con una bassa due righe vicine si fondono', 1,
  R.righe([r(10, 14), r(22, 14)], { quota: 0.1 }).length);

console.log(ko ? `\n✗ ${ko} controlli falliti` : `\n✓ tutti i controlli passati`);
process.exit(ko ? 1 : 0);
