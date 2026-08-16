/* L'ambiente della macchina: dove si cerca Python, e quale si sceglie.
 *
 * ⚠️ Perché questa prova esiste adesso. Finché StudIA girava solo su Mac, le
 * assunzioni macOS erano invisibili perché erano vere: `/usr/bin/python3` come
 * «quello di sistema», `xcode-select --install` come rimedio, la shell di login
 * come ultima spiaggia. Con l'installer per Windows sono diventate tre bugie
 * possibili, e nessuna di loro fa rumore: l'app parte lo stesso, dice all'utente
 * di lanciare un comando che non esiste, e non trova un Python che c'è.
 *
 * Il modo di provarle da un Mac è dichiarare la piattaforma invece di
 * ereditarla: `process.platform` si può ridefinire, e le funzioni la leggono
 * ogni volta — è per questo che qui si può misurare Windows senza Windows.
 * Quello che NON si può provare così è che su una macchina Windows vera ci sia
 * davvero un python.exe in quei posti: quella resta una prova a mano.
 *
 *   node test/ambiente.js
 */
const A = require('../lib/ambiente.js');

let ko = 0;
function ok(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + nome); return; }
  ko++; console.log('  KO  ' + nome + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

/** Fa credere al modulo di girare altrove, per la durata di una funzione. */
function comeSe(piattaforma, fn) {
  const vera = process.platform;
  Object.defineProperty(process, 'platform', { value: piattaforma, configurable: true });
  try { return fn(); } finally {
    Object.defineProperty(process, 'platform', { value: vera, configurable: true });
  }
}

sezione('Le versioni si leggono da qualunque forma le stampi Python');
ok('«Python 3.13.1» → 3.13.1', [3, 13, 1], A.versioneDa('Python 3.13.1'));
ok('«Python 3.9» → 3.9.0', [3, 9, 0], A.versioneDa('Python 3.9'));
ok('niente numeri, niente versione', null, A.versioneDa('command not found'));
ok('3.13 batte 3.9', 1, A.confronta([3, 13, 0], [3, 9, 7]));

sezione('SU WINDOWS si cerca dove Python si installa DAVVERO');
const suWin = comeSe('win32', () => A.candidatiPython());
console.log('   ' + suWin.length + ' candidati, i primi: ' + suWin.slice(0, 3).join(' · '));
ok('il launcher ufficiale è fra i primi', true, suWin.indexOf('py') >= 0 && suWin.indexOf('py') <= 1);
ok('nessun percorso da Mac è rimasto', [], suWin.filter((p) => /^\/(usr|opt|Library)\//.test(p)));
ok('c\'è il PATH', true, suWin.indexOf('python') >= 0);
/* ⚠️ Lo stub del Microsoft Store si chiama python3.exe, sembra installato e non
   è Python: deve stare IN FONDO, dopo ogni installazione vera. */
const stub = suWin.findIndex((p) => /WindowsApps/i.test(p));
ok('lo stub del Microsoft Store è previsto', true, stub >= 0);
ok('…e sta in fondo, dopo le installazioni vere', suWin.length - 1, stub);

sezione('SU MAC la lista resta quella di prima');
const suMac = comeSe('darwin', () => A.candidatiPython());
ok('c\'è Homebrew di Apple Silicon', true, suMac.indexOf('/opt/homebrew/bin/python3') >= 0);
ok('e quello di sistema, per ultimo', '/usr/bin/python3', suMac[suMac.length - 1]);
ok('nessun percorso da Windows', [], suMac.filter((p) => /\\|\.exe$/.test(p)));

sezione('La scelta: il più recente, e chi lo impone vince');
const finti = [
  { percorso: '/usr/bin/python3', versione: '3.9.6', v: [3, 9, 6] },
  { percorso: '/opt/homebrew/bin/python3', versione: '3.13.1', v: [3, 13, 1] },
];
ok('si prende il più recente', '/opt/homebrew/bin/python3', A.scegli(finti).percorso);
ok('e si dice che non è quello di sistema', true, A.scegli(finti).diversoDaSistema);
ok('STUDIA_PYTHON scavalca la versione', '/usr/bin/python3',
  A.scegli(finti, '/usr/bin/python3').percorso);
ok('senza candidati, non si inventa niente', false, A.scegli([]).trovato);

sezione('⚠️ «Quello di sistema» non è un percorso fisso');
/* Su Windows il confronto con `/usr/bin/python3` sarebbe sempre falso, e
   l'avviso «stai usando un altro interprete» non comparirebbe mai. */
const suPc = [
  { percorso: 'C:\\Users\\g\\AppData\\Local\\Microsoft\\WindowsApps\\python3.exe', versione: '3.11.0', v: [3, 11, 0] },
  { percorso: 'C:\\Program Files\\Python313\\python.exe', versione: '3.13.1', v: [3, 13, 1] },
];
const sceltoPc = comeSe('win32', () => A.scegli(suPc, null,
  'C:\\Users\\g\\AppData\\Local\\Microsoft\\WindowsApps\\python3.exe'));
ok('si sceglie l\'installazione vera', 'C:\\Program Files\\Python313\\python.exe', sceltoPc.percorso);
ok('e si dice che non è quella del PATH', true, sceltoPc.diversoDaSistema);
ok('senza sapere quale sia quella di sistema, non si accusa nessuno', false,
  comeSe('win32', () => A.scegli(suPc, null, null)).diversoDaSistema);

sezione('Il rimedio suggerito è quello della macchina di chi legge');
const avvisoDi = (piattaforma) => comeSe(piattaforma, () => {
  const c = A.consiglio({ python: { trovato: false }, motore: 'anthropic', spazioGb: 100, scrittura: true });
  const a = (c.avvisi || []).find((x) => x.id === 'python-assente');
  return a ? a.comando : '';
});
ok('su Mac, gli strumenti da riga di comando', true, /xcode-select/.test(avvisoDi('darwin')));
ok('su Windows, python.org — non il Microsoft Store', true,
  /python\.org/.test(avvisoDi('win32')) && !/xcode-select/.test(avvisoDi('win32')));

console.log('');
console.log(ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati');
process.exit(ko ? 1 : 0);
