/* La luce e la misura del testo: che cosa si fa di un valore che arriva dal
 * disco — senza aprire l'app.
 *
 * ⚠️ Che cosa difende. Tre modi di sbagliare che a schermo si vedrebbero solo a
 * occhio, e uno l'app l'ha già pagato una volta sullo zoom del documento:
 * il passo che INVERTE il gesto al capo della scala; il valore illeggibile che
 * passa lo stesso e riapre l'app con un `--fs` che nessuno ha scelto (e che non
 * si può nemmeno leggere per rimediare); e «di fabbrica» scritto come un numero
 * invece che come l'assenza di uno stile.
 *
 *   node test/stanza.js
 */
const S = require('../App/assets/aspetto/stanza.js');

let ko = 0;
function ok(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + nome); return; }
  ko++; console.log('  KO  ' + nome + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

sezione('Il tema: due valori, e il ripiego è quello del markup');
ok('«chiaro» si riconosce', 'chiaro', S.tema('chiaro'));
ok('«scuro» pure', 'scuro', S.tema('scuro'));
ok('gli spazi non contano', 'scuro', S.tema('  scuro '));
ok('né le maiuscole', 'scuro', S.tema('Scuro'));
/* ⚠️ Il ripiego NON è neutro: è il tema scritto in `<html data-theme="chiaro">`.
   Ripiegare sullo scuro per un carattere storto vorrebbe dire un'app che si
   riapre diversa senza che nessuno l'abbia chiesta. */
ok('quello che non si capisce diventa chiaro', 'chiaro', S.tema('notte'));
ok('e il vuoto anche', 'chiaro', S.tema(null));
ok('e la stringa vuota anche', 'chiaro', S.tema(''));

sezione('L\'interruttore: l\'altro dei due');
ok('da chiaro si va a scuro', 'scuro', S.altroTema('chiaro'));
ok('da scuro si torna a chiaro', 'chiaro', S.altroTema('scuro'));
/* Chi non ha mai scelto è nel chiaro: il primo click deve portare allo scuro. */
ok('da niente si va a scuro', 'scuro', S.altroTema(null));
ok('e da spazzatura pure', 'scuro', S.altroTema('boh'));

sezione('⭐ Il corpo: «di fabbrica» è l\'ASSENZA di una misura, non una misura');
/* ⚠️ Il controllo che vale il file. `null` non è MIN e non è FABBRICA scritto
   in linea: è «nessuno stile, comanda il foglio». La differenza si vede il
   giorno che qualcuno ritocca `--fs` nel CSS — chi non ha mai toccato i bottoni
   deve seguire quel ritocco, chi ha scelto una misura no. */
ok('senza niente scritto, di fabbrica', null, S.corpo(null));
ok('e lo stile da scrivere è «niente»', null, S.stile(null));
ok('di fabbrica NON è il minimo', true, S.corpo(null) !== S.MIN);
ok('e nemmeno il numero di fabbrica scritto a mano', true, S.corpo(null) !== S.FABBRICA);

sezione('Il corpo: che cosa si accetta');
ok('un numero valido si tiene', 1.22, S.corpo(1.22));
ok('anche scritto come stringa', 1.22, S.corpo('1.22'));
ok('il minimo è valido', 0.9, S.corpo(0.9));
ok('e il massimo pure', 1.5, S.corpo(1.5));
ok('e diventa una misura in rem', '1.22rem', S.stile('1.22'));
/* ⚠️ Un valore fuori scala si BUTTA, non si stringe: «3» non è la scelta
   deliberata di ingrandire al massimo, è un dito su una preferenza. */
ok('un numero troppo grande non è una scelta', null, S.corpo(3));
ok('né uno troppo piccolo', null, S.corpo(0.2));
ok('una stringa storta nemmeno', null, S.corpo('grande'));
/* ⚠️ Il caso che rende l'app illeggibile: `NaN` scritto in `--fs` non solleva
   niente e non si può rimediare, perché non si legge più nemmeno il bottone. */
ok('e «NaN» non arriva mai nel foglio di stile', null, S.stile('NaN'));
ok('né l\'infinito', null, S.corpo(Infinity));
ok('un booleano non è una misura', null, S.corpo(true));

sezione('⭐ Il passo non inverte mai il gesto');
ok('«A+» da fabbrica ingrandisce', 1.14, S.passo(null, true));
ok('«A−» da fabbrica rimpicciolisce', 0.98, S.passo(null, false));
ok('«A+» sale di uno scalino', 1.3, S.passo(1.22, true));
ok('«A−» scende di uno scalino', 1.14, S.passo(1.22, false));
/* ⚠️ IL DIFETTO GIÀ PAGATO SULLO ZOOM: un `Math.min` cieco fa SCENDERE
   premendo «+». Al capo si risponde «niente da fare», e chi chiama non scrive:
   è la stessa cosa detta meglio. */
ok('«A+» al massimo non fa niente', null, S.passo(S.MAX, true));
ok('«A−» al minimo non fa niente', null, S.passo(S.MIN, false));
ok('ma «A−» dal massimo scende', 1.42, S.passo(S.MAX, false));
ok('e «A+» dal minimo sale', 0.98, S.passo(S.MIN, true));
/* Il passo si ferma AL capo, non lo scavalca: da 1,46 il «+» arriva a 1,5. */
ok('l\'ultimo scalino si accorcia invece di sfondare', 1.5, S.passo(1.46, true));
ok('e il primo pure', 0.9, S.passo(0.94, false));
/* ⚠️ Da un valore illeggibile si riparte da FABBRICA, non da MIN: il primo
   «A+» deve ingrandire il testo che si sta guardando, non saltare altrove. */
ok('da spazzatura si riparte da quello che si vede', 1.14, S.passo('boh', true));

sezione('Andata e ritorno: la scala si percorre tutta e torna');
/* ⚠️ 1,06 più otto centesimi cinque volte non fa esattamente 1,46: il
   confronto fra numeri a virgola si fa con una soglia, non con `===`. Senza,
   «A+» al massimo risponderebbe con un valore invece che con «niente da fare»
   per un errore al quindicesimo decimale. */
let v = null, saliti = 0;
for (let i = 0; i < 50; i++) { const n = S.passo(v, true); if (n === null) break; v = n; saliti++; }
ok('si sale fino al massimo e ci si ferma', S.MAX, v);
ok('in un numero finito di scalini', true, saliti > 0 && saliti < 20);
let scesi = 0;
for (let i = 0; i < 50; i++) { const n = S.passo(v, false); if (n === null) break; v = n; scesi++; }
ok('e si scende fino al minimo', S.MIN, v);
ok('anche lì in un numero finito', true, scesi > 0 && scesi < 20);
ok('ogni valore toccato è valido', true, S.corpo(v) === S.MIN);

sezione('La tinta del foglio: i nomi qui, i colori nel foglio di stile');
/* ⚠️ Invariante 8: il modulo tiene la REGOLA, non l'aspetto. Se i colori
   stessero qui ci sarebbero due verità, e la prima che diverge è quella che si
   vede. */
ok('le tinte sono quattro, «nessuna» compresa', 4, S.TINTE.length);
ok('e nessuna di loro è un colore', true, S.TINTE.every((t) => !/#|rgb/.test(t)));
ok('«crema» si riconosce', 'crema', S.tinta('crema'));
ok('gli spazi e le maiuscole non contano', 'azzurro', S.tinta(' Azzurro '));
/* ⚠️ Il ripiego è il bianco che il PDF ha davvero: un documento che si riapre
   colorato senza che nessuno l'abbia chiesto è peggio di uno bianco. */
ok('un nome che non esiste diventa «nessuna»', 'nessuna', S.tinta('fucsia'));
ok('e il vuoto anche', 'nessuna', S.tinta(null));
ok('si cicla in tondo', ['crema', 'azzurro', 'grigio', 'nessuna'],
  ['nessuna', 'crema', 'azzurro', 'grigio'].map(S.tintaDopo));
ok('e da un nome storto si riparte dalla prima', 'crema', S.tintaDopo('fucsia'));

console.log(ko ? `\n✗ ${ko} controlli falliti` : `\n✓ tutti i controlli passati`);
process.exit(ko ? 1 : 0);
