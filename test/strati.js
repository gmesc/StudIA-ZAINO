/* Quali segni si accendono: la regola, sola.
 *
 * Oggi l'interruttore è uno — le sottolineature si vedono o non si vedono — e
 * la forma dello stato è già quella che servirà agli strati. Che cosa si prova
 * qui: che di fabbrica si vedano, che uno stato illeggibile non le faccia
 * sparire, che spegnere non tocchi l'elenco, e che si sappia sempre QUANTE sono
 * nascoste — perché è quello che permette di dirlo invece di lasciar credere
 * che siano andate perse.
 *
 * ⚠️ Il modulo NON è una copia: è `App/assets/evidenze/strati.js`, lo STESSO
 * file che l'app carica con `<script src>`.
 */
const path = require('path');
const S = require(path.join(__dirname, '..', 'App', 'assets', 'evidenze', 'strati.js'));

let ko = 0, ok = 0;
function check(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { ok++; return; }
  ko++;
  console.log('  ✗ ' + nome + '\n      atteso: ' + a + '\n      avuto:  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

const TRE = [{ id: 'a1' }, { id: 'b2' }, { id: 'c3' }];

sezione('Di fabbrica i segni si vedono');
{
  check('lo stato di partenza li accende', { tutte: true }, S.diFabbrica());
  check('e senza stato si dipinge tutto', 3, S.visibili(TRE, undefined).length);
  check('«accese» lo dice in un booleano', true, S.accese(S.diFabbrica()));
}

sezione('⚠️ Uno stato illeggibile non fa sparire il lavoro di nessuno');
{
  /* Il ripiego non è neutro: se uno stato storto SPEGNESSE i segni, un
     carattere sbagliato in una preferenza farebbe credere di aver perso tutto,
     e non ci sarebbe niente da guardare per capirlo. */
  check('una stringa che non è JSON', { tutte: true }, S.normalizza('{rotto'));
  check('un numero', { tutte: true }, S.normalizza(7));
  check('null', { tutte: true }, S.normalizza(null));
  check('un oggetto vuoto', { tutte: true }, S.normalizza({}));
  check('e un campo di un altro tipo', { tutte: true }, S.normalizza({ tutte: 'forse' }));
  /* Spento invece si rispetta: è l'unico valore che l'utente può aver scelto. */
  check('spento si legge spento', { tutte: false }, S.normalizza({ tutte: false }));
  check('anche arrivando come stringa', { tutte: false }, S.normalizza('{"tutte":false}'));
}

sezione('L\'andata e ritorno dal localStorage si chiude');
{
  const giro = S.normalizza(S.scrivi({ tutte: false }));
  check('scrivere e rileggere danno lo stesso stato', { tutte: false }, giro);
  check('e si scrive una stringa, che è quello che il localStorage tiene', 'string',
    typeof S.scrivi(S.diFabbrica()));
}

sezione('L\'interruttore gira, e basta');
{
  check('da accese a spente', { tutte: false }, S.commuta({ tutte: true }));
  check('e ritorno', { tutte: true }, S.commuta({ tutte: false }));
  check('da uno stato storto si parte da «accese», quindi si spegne',
    { tutte: false }, S.commuta('boh'));
}

sezione('Spegnere nasconde, non toglie');
{
  const spento = { tutte: false };
  check('non si dipinge niente', 0, S.visibili(TRE, spento).length);
  /* ⚠️ L'elenco di partenza non si tocca: chi chiama riconosce le proprie
     evidenze per IDENTITÀ (l'ancoraggio le restituisce per riferimento), e una
     copia in mezzo romperebbe quel patto. */
  check('e l\'elenco di partenza è ancora intero', 3, TRE.length);
  check('quello che torna è un array nuovo', false, S.visibili(TRE, S.diFabbrica()) === TRE);
  check('con le stesse voci, non con copie', true, S.visibili(TRE, S.diFabbrica())[0] === TRE[0]);
}

sezione('⚠️ Quante sono nascoste si sa sempre: è ciò che permette di dirlo');
{
  check('con i segni accesi', { viste: 3, nascoste: 0, tutte: 3 }, S.conta(TRE, { tutte: true }));
  check('con i segni spenti', { viste: 0, nascoste: 3, tutte: 3 }, S.conta(TRE, { tutte: false }));
  check('e senza evidenze non si inventa un conto', { viste: 0, nascoste: 0, tutte: 0 },
    S.conta([], { tutte: false }));
  check('un elenco che non è un elenco non fa saltare niente',
    { viste: 0, nascoste: 0, tutte: 0 }, S.conta(null, { tutte: false }));
}

sezione('Il confine: qui dentro non entra il DOM');
{
  const sorgente = require('fs').readFileSync(
    path.join(__dirname, '..', 'App', 'assets', 'evidenze', 'strati.js'), 'utf-8');
  // si guarda il CODICE, non i commenti: la testata nomina il DOM apposta
  const codice = sorgente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  check('niente document, window, localStorage o querySelector', [],
    ['document', 'window', 'localStorage', 'querySelector'].filter((t) => codice.indexOf(t) >= 0));
}

console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti  (' + (ok + ko) + ' controlli)'
                       : '✓ tutto verde  (' + ok + ' controlli)'));
process.exit(ko ? 1 : 0);
