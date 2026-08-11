'use strict';
/**
 * La grammatica dei rimandi (`App/assets/rimandi/sintassi.js`): come si scrive
 * «da dove viene questo pezzo», e come si rilegge.
 *
 * ⚠️ Perché queste prove esistono. La sintassi era scritta in CINQUE punti —
 * quattro che la compongono, uno che la legge con tre espressioni regolari a
 * mano — e il 10-11 agosto 2026 tre guasti su otto sono nati lì: un rimando con
 * un numero che nessuno sapeva risolvere, un `#p=` perso per strada, un
 * capitolo sbagliato di uno. Nessuno dei tre solleva un errore: il rimando
 * resta scritto, e semplicemente non apre più niente.
 *
 * Il controllo che conta più di tutti sta in fondo: **scrivere e rileggere
 * devono chiudersi**. Finché erano due codici diversi, potevano divergere senza
 * che nessuna prova se ne accorgesse.
 *
 *   node test/rimandi.js
 */

const R = require('../App/assets/rimandi/sintassi.js');

let ko = 0, ok = 0;
function check(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { ok++; return; }
  ko++;
  console.log('  ✗ ' + nome + '\n      atteso: ' + a + '\n      avuto:  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

sezione('Scrivere: il numero è sempre a due cifre');
{
  /* ⚠️ Le mappe NN→file hanno le chiavi a due cifre. Un rimando scritto `pdf:3`
     non trova niente, e non lo dice: il link resta lì, cliccabile e inerte. */
  check('un numero corto si imbottisce', 'pdf:03#p=7', R.scriviPdf(3, 7));
  check('e uno già a due cifre resta', 'pdf:12#p=1', R.scriviPdf('12', 1));
  check('il video porta il secondo', 'video:01#t=160', R.scriviVideo(1, 160));
  check('i secondi si arrotondano in giù', 'video:01#t=160', R.scriviVideo('01', 160.9));
  /* Un rimando a «meno tre secondi» aprirebbe il video all'inizio senza dire
     perché: meglio zero, che almeno è un punto vero. */
  check('e non vanno mai indietro', 'video:01#t=0', R.scriviVideo(1, -3));
  check('senza numero non si scrive un rimando', ['', ''], [R.scriviPdf('', 3), R.scriviVideo(null, 10)]);

  /* Le pagine si contano da 1: `#p=0` non esiste. Senza pagina il rimando resta
     valido — apre il documento — ed è la forma che usa un'evidenza presa da un
     documento di cui non si sa la pagina. */
  check('pagina zero non si scrive', 'pdf:03', R.scriviPdf(3, 0));
  check('e nemmeno una pagina che non è un numero', 'pdf:03', R.scriviPdf(3, 'boh'));
  check('il capitolo si scrive col suo id intero', 'cap:01-fondamenti-c03', R.scriviCap('01-fondamenti-c03'));
  check('un id storto non diventa un rimando', '', R.scriviCap('non valido/qui'));
}

sezione('Leggere: che cosa dice una stringa');
{
  check('un pdf con la pagina', { tipo: 'pdf', numero: '03', pagina: 7 }, R.leggi('pdf:03#p=7'));
  check('un pdf senza pagina apre la prima', { tipo: 'pdf', numero: '03', pagina: 1 }, R.leggi('pdf:03'));
  check('un video al secondo', { tipo: 'video', numero: '01', t: 160 }, R.leggi('video:01#t=160'));
  check('un capitolo', { tipo: 'cap', capitoloId: '01-fondamenti-c03' }, R.leggi('cap:01-fondamenti-c03'));
  check('una figura, con l\'indice', { tipo: 'fig', numero: '03', pagina: 4, i: 2 }, R.leggi('fig:03#p=4&i=2'));
  /* ⚠️ `&amp;` e non `&`: la stringa arriva già passata dall'escape dell'HTML, e
     una regex che cercasse solo `&` mancherebbe ogni figura con l'indice. */
  check('anche quando la e commerciale è già scappata',
    { tipo: 'fig', numero: '03', pagina: 4, i: 2 }, R.leggi('fig:03#p=4&amp;i=2'));
  check('una figura senza indice è la prima', { tipo: 'fig', numero: '03', pagina: 4, i: 1 }, R.leggi('fig:03#p=4'));
  check('un indirizzo esterno si riconosce', 'esterno', (R.leggi('https://insegnai.ch') || {}).tipo);

  check('quello che non è un rimando è niente', [null, null, null, null],
    [R.leggi('boh'), R.leggi(''), R.leggi(null), R.leggi('pdf:')]);
  /* Un `cap:` con una barra dentro punterebbe fuori dalla cartella: non è un
     rimando, ed è meglio del testo che sembra un link e apre altro. */
  check('un capitolo con un percorso dentro non passa', null, R.leggi('cap:../fuori'));
}

sezione('Scrivere e rileggere si chiudono');
{
  /* ⚠️ È IL CONTROLLO CHE CONTA. Finché comporre e leggere erano due codici
     diversi in due punti diversi, potevano divergere senza che niente lo
     dicesse: si continuava a scrivere una forma che l'altro capo non
     riconosceva più, e i rimandi smettevano di aprire in silenzio. */
  const giri = [
    [R.scriviPdf(3, 7), { tipo: 'pdf', numero: '03', pagina: 7 }],
    [R.scriviPdf(11, 250), { tipo: 'pdf', numero: '11', pagina: 250 }],
    [R.scriviVideo(2, 0), { tipo: 'video', numero: '02', t: 0 }],
    [R.scriviVideo(2, 3599), { tipo: 'video', numero: '02', t: 3599 }],
    [R.scriviCap('01-fondamenti-c03'), { tipo: 'cap', capitoloId: '01-fondamenti-c03' }]
  ];
  for (const [scritto, atteso] of giri) check('«' + scritto + '» si rilegge com\'è stato scritto', atteso, R.leggi(scritto));
}

sezione('Il link markdown, montato');
{
  check('etichetta e rimando', '[p. 7](pdf:03#p=7)', R.link('p. 7', R.scriviPdf(3, 7)));
  /* Senza numero il materiale non è indirizzabile: si scrive il testo nudo,
     che è meglio di un link che non apre niente. */
  check('senza rimando resta il testo', 'la citazione', R.link('la citazione', R.scriviPdf('', 1)));
}

sezione('Dal nome del file al suo numero');
{
  const mappa = { '01': '01 lezione.mp4', '03': '03 dispensa.pdf' };
  check('lo trova', '03', R.numeroDi('03 dispensa.pdf', mappa));
  check('e se non c\'è lo dice', null, R.numeroDi('sconosciuto.pdf', mappa));
  check('senza mappa non si inventa niente', null, R.numeroDi('x.pdf', null));
}

console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati') + ' (' + ok + ' ok)');
process.exit(ko ? 1 : 0);
