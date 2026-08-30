'use strict';
/**
 * L'anteprima che si scrive: dove va il cursore, e quando un elenco si apre
 * voce per voce (`App/assets/appunti/scrivibile.js`).
 *
 * ⚠️ Perché queste prove esistono. Le due domande sembrano cosmetiche e non lo
 * sono: la prima decide dove atterra il cursore di chi sta correggendo, la
 * seconda decide **con quali confini si riscrive il file dell'utente**. Un
 * confine sbagliato su un elenco non fa un cursore storto — fa una voce che si
 * mangia le sue vicine, e chi scrive lo scopre quando il testo non c'è più.
 *
 *   node test/scrivibile.js
 */

const S = require('../App/assets/appunti/scrivibile');

let ko = 0, ok = 0;
function check(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { ok++; return; }
  ko++;
  console.log('  ✗ ' + nome + '\n      atteso: ' + a + '\n      avuto:  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

/* Il modo di leggere i controlli qui sotto: si dà il markdown, il testo COME SI
   VEDE, e il punto toccato nel secondo; si vuole il punto corrispondente nel
   primo. `md.slice(pos)` dice a occhio se la risposta è quella giusta. */
function dove(md, reso, off) {
  const p = S.posSorgente(md, reso, off);
  return p === null ? null : md.slice(p, p + 12);
}

sezione('Il cursore va DOVE HAI CLICCATO, non in fondo');
{
  check('testo semplice: la posizione è la stessa', 0, S.posSorgente('ciao mondo', 'ciao mondo', 0));
  check('e in mezzo pure', 5, S.posSorgente('ciao mondo', 'ciao mondo', 5));
  /* ⚠️ IL CASO CHE VALE LA FUNZIONE: nel sorgente ci sono due asterischi che nel
     reso non esistono. Contando sul testo reso il cursore cadeva due caratteri
     prima, cioè dentro la sintassi invece che nella parola. */
  check('il grassetto non sposta il cursore', 'mondo**', dove('ciao **mondo**', 'ciao mondo', 5));
  check('il corsivo nemmeno', 'mondo*', dove('ciao *mondo*', 'ciao mondo', 5));
  check('un titolo: il cancelletto non si conta', 'Titolo', dove('## Titolo', 'Titolo', 0));
  /* Un rimando: l'etichetta si vede, l'indirizzo no. Cliccando dopo l'etichetta
     il cursore deve stare lì, non dentro la parentesi. */
  check('un rimando: si conta l\'etichetta, non l\'indirizzo',
    'pagina 7](pd', dove('Vedi [pagina 7](pdf:01#p=7) e basta', 'Vedi pagina 7 e basta', 5));
  check('e dopo il rimando si torna nel testo',
    'e basta', dove('Vedi [pagina 7](pdf:01#p=7) e basta', 'Vedi pagina 7 e basta', 14));
  /* Il reso collassa i bianchi: due spazi diventano uno, un a capo diventa uno
     spazio. Confrontarli alla lettera farebbe perdere il passo a metà riga. */
  check('gli a capo del sorgente valgono uno spazio',
    'terza', dove('prima riga\nseconda\nterza', 'prima riga seconda terza', 19));
  check('e gli spazi doppi non sfasano', 'due', dove('uno  due', 'uno due', 4));

  sezione('E quando non lo sa, lo dice');
  /* ⚠️ La metà che conta: rispondere «non lo so» invece di un numero inventato.
     Chi chiama mette il cursore in fondo, com'era prima, e nessuno si trova a
     scrivere in mezzo a una parola sbagliata senza capire perché. */
  check('un offset oltre la fine del testo', null, S.posSorgente('ciao', 'ciao', 99));
  check('un testo che non c\'entra col sorgente', null, S.posSorgente('ciao', 'tutt\'altro', 8));
  check('un sorgente vuoto', null, S.posSorgente('', '', 0));
  check('un offset che non è un numero', null, S.posSorgente('ciao', 'ciao', 'due'));
  /* ⚠️ «L'inizio» è l'inizio di ciò che SI VEDE, non del sorgente: cliccando
     sulla prima lettera di una parola in grassetto il cursore va dopo gli
     asterischi, o la prima lettera battuta finirebbe dentro il marcatore e il
     grassetto si aprirebbe da solo. */
  check('l\'inizio è quello del testo, non della sintassi', 2, S.posSorgente('**ciao**', 'ciao', 0));
}

sezione('Un elenco si apre voce per voce — ma solo se è semplice');
{
  check('tre voci, tre confini', [0, 1, 2], S.vociElenco(['- uno', '- due', '- tre']));
  check('anche numerato', [0, 1], S.vociElenco(['1. uno', '2. due']));
  check('e con la parentesi', [0, 1], S.vociElenco(['1) uno', '2) due']));
  /* ⚠️ I tre «no», e sono il motivo per cui questa funzione esiste invece di una
     regex sparsa nel renderer: le voci diventano i confini con cui si RISCRIVE
     il file, e su un elenco annidato una voce si mangerebbe le sue figlie. */
  check('un annidato si rifiuta', null, S.vociElenco(['- uno', '  - uno a', '- due']));
  check('una voce che continua sotto si rifiuta', null, S.vociElenco(['- uno', '  continua', '- due']));
  check('un paragrafo non è un elenco', null, S.vociElenco(['Questa è una frase', 'e questa la seconda']));
  check('una riga sola non è un elenco', null, S.vociElenco(['- uno']));
  check('niente righe, niente elenco', null, S.vociElenco(null));
}

sezione('I confini finiscono sui <li>, o non ci finisce niente');
{
  const html = '<ul><li>uno</li><li>due</li></ul>';
  check('ogni voce porta la sua riga',
    '<ul><li class="mdb" data-da="3" data-a="3">uno</li><li class="mdb" data-da="4" data-a="4">due</li></ul>',
    S.marcaVoci(html, ['- uno', '- due'], 3));
  /* ⚠️ Se i conti non tornano si lascia stare TUTTO. Marcare a metà darebbe
     blocchi con le coordinate di righe altrui — e quelle coordinate sono le due
     con cui si sovrascrive il markdown. */
  check('tre <li> e due voci: l\'html resta com\'era',
    '<ul><li>uno</li><li>due</li><li>tre</li></ul>',
    S.marcaVoci('<ul><li>uno</li><li>due</li><li>tre</li></ul>', ['- uno', '- due'], 0));
  check('un elenco annidato non si marca',
    '<ul><li>uno<ul><li>a</li></ul></li><li>due</li></ul>',
    S.marcaVoci('<ul><li>uno<ul><li>a</li></ul></li><li>due</li></ul>', ['- uno', '- due'], 0));
  check('e un blocco che non è un elenco nemmeno',
    '<p>una frase</p>', S.marcaVoci('<p>una frase</p>', ['una frase', 'e un\'altra'], 0));
}

console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati') + ' (' + ok + ' ok)');
process.exit(ko ? 1 : 0);
