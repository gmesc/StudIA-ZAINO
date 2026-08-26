'use strict';
/**
 * Le regole dell'elenco delle postille (App/assets/evidenze/postille.js).
 *
 * La postilla è il corpo di un'annotazione — il perché di una sottolineatura —
 * e questo elenco è il posto in cui si rileggono tutte insieme. Qui si prova
 * ciò che si sbaglia senza accorgersene: che cosa entra nell'elenco, come si
 * raggruppa, e in che ordine — con le pagine che sono numeri e i titoli che
 * sono stringhe.
 *
 *   node test/postille.js
 */

const P = require('../App/assets/evidenze/postille');

let ko = 0, ok = 0;
function check(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { ok++; return; }
  ko++;
  console.log('  ✗ ' + nome + '\n      atteso: ' + a + '\n      avuto:  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

sezione('Che cosa è una postilla, e che cosa non lo è');
{
  check('una postilla è una postilla', 'contraddice p. 4',
    P.nota({ nota: 'contraddice p. 4' }));
  /* ⚠️ Un file toccato a mano può portare a capo e spazi doppi: l'elenco è una
     riga per voce, e una nota con dentro un ritorno a capo spezzerebbe la
     riga senza che nessuno lo abbia chiesto. */
  check('gli a capo e gli spazi si stringono', 'due righe in una',
    P.nota({ nota: '  due\n  righe   in una  ' }));
  check('una nota di soli spazi non è una postilla', false, P.haPostilla({ nota: '   ' }));
  check('e un campo assente nemmeno', false, P.haPostilla({ exact: 'x' }));
  check('né una voce che non c\'è', false, P.haPostilla(null));
}

sezione('Dove sta una postilla: la chiave è il dato, non l\'etichetta');
{
  /* ⚠️ Si raggruppa su ciò che NON cambia: due capitoli possono chiamarsi
     uguale, e due documenti pure se uno è stato rinominato. Il titolo
     leggibile lo mette il renderer, che sa tradurre un nome di file. */
  check('un documento si riconosce dal file', 'pdf 03 dispensa.pdf',
    P.chiaveDove({ materiale: '03 dispensa.pdf', capitolo: 'Un titolo' }));
  check('un capitolo dal suo id', 'cap c07', P.chiaveDove({ capitoloId: 'c07', capitolo: 'Sinapsi' }));
  check('il documento vince sul capitolo', 'pdf a.pdf',
    P.chiaveDove({ materiale: 'a.pdf', capitoloId: 'c1' }));
  check('e chi non ha né l\'uno né l\'altro sta insieme agli altri orfani', 'altro',
    P.chiaveDove({ exact: 'sola' }));
}

sezione('La pagina è un NUMERO');
{
  check('una pagina scritta come stringa vale il suo numero', 7, P.pagina({ pagina: '7' }));
  check('lo zero non è «nessuna pagina»', 0, P.pagina({ pagina: 0 }));
  check('una pagina vuota è nessuna pagina', null, P.pagina({ pagina: '' }));
  check('e una parola pure', null, P.pagina({ pagina: 'sette' }));
}

sezione('L\'elenco: raggruppato, ordinato, e col documento aperto in cima');
{
  const ev = [
    { id: '1', exact: 'alfa', nota: 'una', materiale: '02 b.pdf', pagina: 3 },
    { id: '2', exact: 'beta', nota: 'due', materiale: '10 a.pdf', pagina: 1 },
    { id: '3', exact: 'gamma', nota: '', materiale: '02 b.pdf', pagina: 1 },
    { id: '4', exact: 'delta', nota: 'tre', materiale: '02 b.pdf', pagina: 1 },
    { id: '5', exact: 'eps', nota: 'quattro', capitoloId: 'c1', capitolo: 'Primo' },
    { id: '6', exact: 'zeta', nota: 'cinque' }
  ];

  /* ⚠️ Chi apre questo pannello mentre legge cerca quasi sempre le postille di
     QUELLA pagina: farlo scorrere fino a trovarle sarebbe chiedergli di cercare
     due volte. Ma gli altri gruppi restano — un elenco che nasconde il resto fa
     credere che il resto non ci sia. */
  const g = P.gruppi(ev, { materialeAperto: '10 a.pdf' });
  check('il documento aperto viene per primo', '10 a.pdf', g[0].materiale);
  check('poi gli altri documenti, poi i capitoli, poi gli orfani',
    ['10 a.pdf', '02 b.pdf', '', ''], g.map((x) => x.materiale));
  check('e i gruppi sono quattro, non uno per evidenza', 4, g.length);
  check('la voce senza postilla non entra', ['delta', 'alfa'],
    g[1].voci.map((v) => v.exact));

  /* Dentro un gruppo si ordina per PAGINA: è l'ordine in cui si incontrano
     leggendo, non quello in cui sono state scritte. */
  check('le voci di un gruppo seguono la pagina', [1, 3], g[1].voci.map((v) => v.pagina));

  /* Senza documento aperto l'ordine è quello dei nomi — e «10» non viene prima
     di «02» solo perché comincia per uno. */
  const senza = P.gruppi(ev, {});
  check('senza documento aperto comandano i nomi, letti come numeri',
    ['02 b.pdf', '10 a.pdf'], senza.slice(0, 2).map((x) => x.materiale));

  check('il conto viene dalla stessa legge dell\'elenco', 5, P.quante(ev));
  check('e non conta la nota vuota', 5,
    g.reduce((n, x) => n + x.voci.length, 0));
}

sezione('I casi vuoti non sono guasti');
{
  check('nessuna evidenza: nessun gruppo', [], P.gruppi([], {}));
  check('evidenze senza nessuna postilla: nessun gruppo', [],
    P.gruppi([{ exact: 'x' }, { exact: 'y', nota: '  ' }], {}));
  check('e un elenco che non è un elenco non fa saltare niente', [], P.gruppi(null, {}));
  check('il conto di niente è zero', 0, P.quante(undefined));
}

sezione('A parità di pagina, l\'ordine è quello del testo segnato');
{
  const g = P.gruppi([
    { exact: 'zulu', nota: 'a', materiale: 'x.pdf', pagina: 2 },
    { exact: 'alfa', nota: 'b', materiale: 'x.pdf', pagina: 2 },
    { exact: 'senza pagina', nota: 'c', materiale: 'x.pdf' }
  ], {});
  /* ⚠️ Chi non ha pagina va in FONDO, non in cima: un'evidenza senza pagina è
     un caso raro, e metterla per prima sposterebbe tutto ciò che si cerca. */
  check('alfabetico a parità di pagina, e chi non ha pagina in fondo',
    ['alfa', 'zulu', 'senza pagina'], g[0].voci.map((v) => v.exact));
}

console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati') + ' (' + ok + ' ok)');
process.exit(ko ? 1 : 0);
