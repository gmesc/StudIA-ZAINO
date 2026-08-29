'use strict';
/**
 * Che cosa si vede sbirciando un rimando (App/assets/rimandi/anteprima.js) — Q4.
 *
 * «Hover = anteprima; click = torni lì». Qui si prova la DECISIONE: dato un
 * rimando già letto e i dati che il renderer ha in mano, che cosa entra nella
 * bolla — e soprattutto **quando la bolla non si apre affatto**, che è la metà
 * che si sbaglia: una bolla che dice «non lo so» ruba il testo sotto senza dare
 * niente in cambio.
 *
 *   node test/anteprima.js
 */

const A = require('../App/assets/rimandi/anteprima');
const R = require('../App/assets/rimandi/sintassi');
const P = require('../App/assets/player/lettore');

let ko = 0, ok = 0;
function check(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { ok++; return; }
  ko++;
  console.log('  ✗ ' + nome + '\n      atteso: ' + a + '\n      avuto:  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

/* I dati che il renderer ha già in mano. Ogni campo è facoltativo: le sezioni
   qui sotto ne tolgono uno per volta per provare i vuoti. */
const PIENI = {
  titoloMateriale: (n) => ({ '03': 'Dispensa DSA', '05': 'Lezione 5' })[n] || '',
  testoPagina: (n, p) => (n === '03' && p === 7)
    ? 'La memoria di lavoro è il sistema che tiene a mente le informazioni mentre le si usa, e ha una capacità limitata.'
    : '',
  evidenza: (id) => id === 'aa11bb22cc33'
    ? { exact: 'memoria di lavoro', prefix: 'la ', suffix: ' è limitata', colore: '#fdf14d', nota: 'chiedere al prof' }
    : null,
  immagine: (id) => id === 'a1b2c3d4' ? { didascalia: 'schema del sistema', src: 'file:///x.png' } : null,
  capitolo: (id) => id === 'c01' ? { titolo: 'Che cosa sono i DSA', lezione: 'Fondamenti' } : null
};

sezione('⚠️ La lettura del rimando NON si rifà qui');
{
  /* La porta unica è `RimandiSintassi.leggi`: questo modulo riceve il
     risultato. Se cominciasse a riconoscere `pdf:` da sé sarebbe il secondo
     lettore che l'invariante 7 vieta — e il giorno che le due letture
     divergessero, la bolla mostrerebbe una cosa e il click ne aprirebbe
     un'altra. */
  check('un rimando che non è stato letto non produce niente', true,
    A.contenuto(null, PIENI).vuoto);
  check('e nemmeno una stringa passata per sbaglio', true,
    A.contenuto('pdf:03#p=7', PIENI).vuoto);
}

sezione('Un DOCUMENTO: il titolo, la pagina, e le righe attorno');
{
  const c = A.contenuto(R.leggi('pdf:03#p=7'), PIENI);
  check('il tipo', 'pdf', c.tipo);
  check('il titolo leggibile, non il numero', 'Dispensa DSA', c.titolo);
  check('e dove porta', 'p. 7', c.dove);
  check('col testo della pagina', true, /memoria di lavoro/.test(c.testo));
  check('la bolla si apre', false, c.vuoto);

  /* ⚠️ Senza il testo dell'indice la bolla dice comunque DOVE porta: un
     documento non ancora indicizzato non deve far sparire l'anteprima, o chi
     passa sopra non capisce se il rimando è rotto o solo silenzioso. */
  const senza = A.contenuto(R.leggi('pdf:03#p=7'), { titoloMateriale: PIENI.titoloMateriale });
  check('senza indice resta il titolo e la pagina', ['Dispensa DSA', 'p. 7'], [senza.titolo, senza.dove]);
  check('e la bolla si apre lo stesso', false, senza.vuoto);
  /* Senza nemmeno il titolo si ripiega sul numero, che è ciò che il rimando
     dice: meglio «Documento 03» che una bolla muta. */
  check('senza titolo si ripiega sul numero', 'Documento 03',
    A.contenuto(R.leggi('pdf:03#p=7'), {}).titolo);
}

sezione('Un MEDIA: il titolo e il minuto, e nessuna finta anteprima');
{
  const c = A.contenuto(R.leggi('video:05#t=160'), PIENI);
  check('il tipo', 'video', c.tipo);
  check('il titolo', 'Lezione 5', c.titolo);
  check('e il minuto, scritto come lo scrive il player', '2:40', c.dove);
  /* ⚠️ Su un media non c'è testo da mostrare: fingere un'anteprima del
     contenuto vorrebbe dire trascrivere, e qui non si trascrive niente. */
  check('nessun testo inventato', '', c.testo);
  check('oltre l\'ora si scrive l\'ora', '1:23:20', A.contenuto(R.leggi('video:05#t=5000'), PIENI).dove);

  /* ⚠️ IL CONTROLLO CHE INCHIODA LA COPIA DICHIARATA: `tempo` è scritta due
     volte — qui e nel player — perché questo modulo gira anche dove il player
     non è caricato. Le due forme devono coincidere, o lo stesso minuto si
     leggerebbe in due modi a due centimetri di distanza. */
  const campioni = [0, 7, 59, 60, 850, 3599, 3600, 5000, 7503];
  check('e la forma è la STESSA del player', campioni.map(P.tempo), campioni.map(A.tempo));
}

sezione('Un\'EVIDENZA: la frase col suo contorno, e il colore');
{
  const c = A.contenuto(R.leggi('ev:aa11bb22cc33'), PIENI);
  check('il tipo', 'ev', c.tipo);
  /* `prefix` e `suffix` sono lì apposta: sono ciò che distingue «la memoria»
     ripetuta in tre punti diversi del documento. */
  check('la frase esatta', 'memoria di lavoro', c.esatto);
  check('col suo contorno', ['la ', ' è limitata'], [c.prefix, c.suffix]);
  check('il testo intero è il contorno completo', 'la memoria di lavoro è limitata', c.testo);
  check('e il colore, per accendere l\'esatto', '#fdf14d', c.colore);
  check('con la postilla, se c\'è', 'chiedere al prof', c.nota);

  /* ⚠️ Un'evidenza che non c'è più — cancellata, o di un altro corso — NON apre
     la bolla: dire «non lo so» rubando il testo sotto è peggio di non dire
     niente. Chi clicca lo scopre lo stesso, con un messaggio. */
  check('un\'evidenza sparita non apre la bolla', true,
    A.contenuto(R.leggi('ev:000000000000'), PIENI).vuoto);
  check('e nemmeno una senza testo', true,
    A.contenuto(R.leggi('ev:aa11bb22cc33'), { evidenza: () => ({ exact: '' }) }).vuoto);
}

sezione('Un\'IMMAGINE: la miniatura e la sua didascalia');
{
  const c = A.contenuto(R.leggi('album:a1b2c3d4'), PIENI);
  check('il tipo', 'album', c.tipo);
  check('la didascalia', 'schema del sistema', c.titolo);
  check('e la sorgente da mostrare', 'file:///x.png', c.immagine);
  check('un\'immagine sparita non apre la bolla', true,
    A.contenuto(R.leggi('album:ffffffff'), PIENI).vuoto);
}

sezione('Un CAPITOLO: il titolo e la sua lezione');
{
  const c = A.contenuto(R.leggi('cap:c01'), PIENI);
  check('titolo e lezione', ['Che cosa sono i DSA', 'Fondamenti'], [c.titolo, c.dove]);
  check('un capitolo che non c\'è non apre la bolla', true,
    A.contenuto(R.leggi('cap:mai'), PIENI).vuoto);
}

sezione('⚠️ Che cosa NON ha un\'anteprima, e perché');
{
  /* Una figura è già un'immagine a schermo: mostrarne una copia in una bolla
     non aggiunge niente. E per un link esterno l'unica anteprima onesta
     sarebbe andare a prendere la pagina — una richiesta di rete che nessuno
     ha chiesto, da un'app che lavora sul disco. */
  check('una figura non ha bolla', true, A.contenuto(R.leggi('fig:03#p=2'), PIENI).vuoto);
  check('e un link esterno nemmeno', true, A.contenuto(R.leggi('https://esempio.it'), PIENI).vuoto);
}

sezione('Il testo attorno si taglia sulle PAROLE, non a metà');
{
  const lungo = 'parola '.repeat(80);
  const t = A.attorno(lungo, 40);
  check('sta nel limite, coi puntini', true, t.length <= 42 && /…$/.test(t));
  /* ⚠️ Un'anteprima che comincia o finisce con «…zione della» fa perdere tempo
     invece di darne: chi passa sopra deve capire in un colpo d'occhio se è il
     punto giusto. */
  check('e non taglia una parola a metà', true, /parola…$/.test(t));
  check('un testo corto resta intero', 'poco', A.attorno('poco', 40));
  check('gli spazi si stringono', 'due parole', A.attorno('  due   parole  ', 40));
  check('e il niente resta niente', '', A.attorno(null, 40));
}

sezione('I dati si fanno PASSARE: senza, non si solleva');
{
  /* ⚠️ Il modulo non va a prendere niente da sé — è la regola di `suMac(nav)`.
     Qui si prova che senza dati non salta nulla: è la condizione di chi apre
     un appunto prima che gli indici siano caricati. */
  check('senza nessun dato, il documento dice ancora dove porta', 'p. 7',
    A.contenuto(R.leggi('pdf:03#p=7'), null).dove);
  check('e un fornitore che solleva non fa saltare la bolla', 'Documento 03',
    A.contenuto(R.leggi('pdf:03#p=7'), { titoloMateriale: () => { throw new Error('rotto'); } }).titolo);
}

console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati') + ' (' + ok + ' ok)');
process.exit(ko ? 1 : 0);
