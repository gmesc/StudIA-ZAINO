'use strict';
/**
 * I nomi dei tasti (`App/assets/tasti/nomi.js`).
 *
 * ⚠️ PERCHÉ QUESTE PROVE ESISTONO. Il guasto che questo modulo ripara era
 * invisibile da qui: su Windows i suggerimenti dicevano «⌘F», un tasto che là
 * non c'è, e chi leggeva concludeva che la scorciatoia non esistesse — mentre il
 * codice funzionava già (`e.metaKey || e.ctrlKey`). Era solo il nome a mentire.
 *
 * E la regola non è una sostituzione: «⌘F» diventa «Ctrl+F», ma «tieni premuto
 * ⌘» deve diventare «tieni premuto Ctrl», non «tieni premuto Ctrl+». Il «+»
 * appartiene alla combinazione, non al tasto — un `replace` secco sbaglia una
 * delle due frasi, e sbagliarla non si vede finché non si leggono tutte e due.
 * Questo file le elenca.
 *
 *   node test/tasti.js
 */

const T = require('../App/assets/tasti/nomi.js');

let ko = 0, ok = 0;
function check(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { ok++; return; }
  ko++;
  console.log('  ✗ ' + nome + '\n      atteso: ' + a + '\n      avuto:  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

const win = (s) => T.perPiattaforma(s, false);
const mac = (s) => T.perPiattaforma(s, true);

sezione('Altrove: i simboli diventano parole');
{
  check('una combinazione porta il più', 'Cerca nel documento (Ctrl+F)', win('Cerca nel documento (⌘F)'));
  check('due modificatori, due più', 'Segna il minuto (Ctrl+Shift+C)', win('Segna il minuto (⌘⇧C)'));
  check('anche scritti al contrario', 'Ctrl+Shift+C', win('⇧⌘C'));
  check('⌘⌥ è Ctrl+Alt', 'Ctrl+Alt+L', win('⌘⌥L'));
  /* ⚠️ La riga per cui questo modulo esiste: il tasto da solo NON porta il più.
     «tieni premuto Ctrl+» prometterebbe un secondo tasto che non arriva. */
  check('un tasto da solo non porta il più', 'o tieni premuto Ctrl', win('o tieni premuto ⌘'));
  check('nemmeno a fine frase', 'si ritaglia con Ctrl.', win('si ritaglia con ⌘.'));
  check('⇧ da solo resta un tasto', 'premi Shift', win('premi ⇧'));
  check('⌃ è lo stesso Ctrl', 'Ctrl+F', win('⌃F'));
  check('la scrittura per esteso si allinea', 'Salva (Ctrl+S)', win('Salva (Cmd+S)'));
  check('col trattino come nella libreria dell\'editor', 'Bold (Ctrl-B)', win('Bold (Cmd-B)'));
  /* Su una tastiera italiana il tasto si chiama «Maiusc» tanto su Mac quanto su
     Windows: tradurlo in «Shift» sarebbe inventare un tasto che non c'è. */
  check('«Maiusc» resta «Maiusc»', 'Precedente (Maiusc+Invio)', win('Precedente (Maiusc+Invio)'));
  check('una frase senza tasti non si tocca', 'Chiudi anteprima', win('Chiudi anteprima'));
}

sezione('Su un Mac: una scrittura sola, quella coi simboli');
{
  check('i simboli restano', 'Cerca nel documento (⌘F)', mac('Cerca nel documento (⌘F)'));
  check('e «Cmd+» diventa il simbolo', 'Salva (⌘S)', mac('Salva (Cmd+S)'));
  check('anche col trattino', 'Bold (⌘B)', mac('Bold (Cmd-B)'));
  check('il tasto da solo non guadagna niente', 'o tieni premuto ⌘', mac('o tieni premuto ⌘'));
}

sezione('Chi ha bisogno di essere riscritto');
{
  check('un suggerimento coi simboli', true, T.haTasti('Cerca nel documento (⌘F)'));
  check('uno con la scrittura per esteso', true, T.haTasti('Salva (Cmd+S)'));
  check('uno senza tasti, no', false, T.haTasti('Chiudi anteprima'));
  /* ⚠️ «comando» contiene «Cmd»? No: il confine di parola lo impedisce. Senza,
     mezza interfaccia si sarebbe riscritta da sola. */
  check('e una parola che li contiene per caso, nemmeno', false, T.haTasti('Comandi della mappa'));
}

sezione('Dove si sta girando');
{
  check('userAgentData vince', true, T.suMac({ userAgentData: { platform: 'macOS' }, platform: 'Win32' }));
  check('platform quando non c\'è', true, T.suMac({ platform: 'MacIntel' }));
  check('lo userAgent come ultimo ripiego', true,
    T.suMac({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }));
  check('Windows', false, T.suMac({ platform: 'Win32' }));
  check('Linux', false, T.suMac({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' }));
  check('un navigatore che non dice niente non è un Mac', false, T.suMac({}));
  check('e nemmeno l\'assenza di navigatore', false, T.suMac(null));
}

console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati') + ' (' + ok + ' ok)');
process.exit(ko ? 1 : 0);
