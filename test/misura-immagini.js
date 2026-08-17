/* Quanto è larga un'immagine dentro un appunto: la grammatica, sola.
 *
 * Che cosa si prova qui: che `![Titolo|60%](album:…)` si sciolga nei suoi due
 * pezzi e si ricomponga uguale, che una misura assente NON diventi `|100%`, che
 * cambiare la larghezza della seconda copia di un'immagine non tocchi la prima,
 * e che `(album:<id>)` esca dal giro identico a com'era entrato — perché è la
 * stringa con cui `lib/album.js` sa in quanti posti un'immagine è usata.
 *
 * ⚠️ Il modulo NON è una copia: è `App/assets/lettura/misura.js`, lo STESSO
 * file che l'app carica con `<script src>` e che `lettura/capitolo.js`
 * richiede. Se un giorno la grammatica cambia nell'app, questi controlli lo
 * sanno.
 */
const path = require('path');
const M = require(path.join(__dirname, '..', 'App', 'assets', 'lettura', 'misura.js'));

let ko = 0, ok = 0;
function check(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { ok++; return; }
  ko++;
  console.log('  ✗ ' + nome + '\n      atteso: ' + a + '\n      avuto:  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

sezione('La didascalia e la sua misura si sciolgono');
{
  check('senza misura, la didascalia è tutta didascalia',
    { didascalia: 'La curva di Galton', percento: 0 }, M.leggi('La curva di Galton'));
  check('con la misura in coda, i due pezzi si separano',
    { didascalia: 'La curva di Galton', percento: 60 }, M.leggi('La curva di Galton|60%'));
  check('una didascalia vuota con la sua misura',
    { didascalia: '', percento: 45 }, M.leggi('|45%'));
  /* ⚠️ Conta l'ULTIMA barra: una didascalia può contenerne, e prendere la prima
     spezzerebbe il testo dell'utente a metà. */
  check('con più barre, la misura è l’ultima',
    { didascalia: 'prima|dopo', percento: 30 }, M.leggi('prima|dopo|30%'));
}

sezione('Quello che NON è una misura resta didascalia');
{
  check('senza il segno di percentuale', { didascalia: 'schema|3', percento: 0 }, M.leggi('schema|3'));
  check('con le cifre decimali', { didascalia: 'schema|33,5%', percento: 0 }, M.leggi('schema|33,5%'));
  check('con delle lettere', { didascalia: 'schema|metà%', percento: 0 }, M.leggi('schema|metà%'));
  check('e la barra in mezzo, non in coda', { didascalia: 'a|50% e poi', percento: 0 }, M.leggi('a|50% e poi'));
}

sezione('I limiti: una percentuale della colonna, non della misura naturale');
{
  /* Sopra il 100 non si va: `max-width:100%` la fermerebbe lì comunque, e un
     menu che mostra 125% senza che cambi niente insegna che l'app mente. */
  check('sopra il tetto si ferma al tetto', 100, M.limita(140));
  check('sotto il minimo si ferma al minimo', 10, M.limita(3));
  check('lo zero vuol dire «nessuna misura»', 0, M.limita(0));
  check('e anche ciò che non è un numero', 0, M.limita('largo'));
  check('si arrotonda all’intero', 63, M.limita(62.5));
  check('una misura fuori scala scritta a mano si legge limitata',
    { didascalia: 'x', percento: 100 }, M.leggi('x|500%'));
}

sezione('Scrivere: «come viene» non si scrive');
{
  /* ⚠️ A misura assente NON si scrive `|100%`: un campo scritto per dire
     «normale» sporca il file dell'utente. Stessa regola con cui
     `mappa/modifica.js` cancella `scala` quando il nodo torna a 1. */
  check('senza misura, la didascalia esce nuda', 'Titolo', M.scrivi('Titolo', 0));
  check('e con la misura, in coda', 'Titolo|60%', M.scrivi('Titolo', 60));
  check('il giro completo non perde niente', 'Titolo|60%',
    M.scrivi(M.leggi('Titolo|60%').didascalia, M.leggi('Titolo|60%').percento));
  check('100% invece si scrive: è una misura, non «come viene»', 'Titolo|100%', M.scrivi('Titolo', 100));
}

sezione('Il passo è moltiplicativo, come sulla mappa');
{
  check('più stretta', 80, M.passo(100, '-'));
  check('e ancora più stretta', 64, M.passo(80, '-'));
  check('più larga', 100, M.passo(80, '+'));
  check('senza misura si parte da tutta la colonna', 80, M.passo(0, '-'));
  check('e non si scende sotto il minimo', 10, M.passo(11, '-'));
  check('né si sale sopra il tetto', 100, M.passo(95, '+'));
}

sezione('Una didascalia che arriva da fuori non può fingersi una misura');
{
  check('la barra se ne va con le quadre', 'schema 2', M.ripulisci('sche[ma|] 2'));
  check('e quello che non minaccia niente resta', 'La curva di Galton', M.ripulisci('La curva di Galton'));
}

sezione('Cambiare la misura di UNA immagine dentro un testo');
{
  const t = 'Ecco lo schema.\n\n![La curva](album:9f2c1a4b7e)\n\nE si commenta.';
  const dopo = M.cambia(t, 'album:9f2c1a4b7e', 0, 60);
  check('la misura entra nella didascalia', true, dopo.indexOf('![La curva|60%](album:9f2c1a4b7e)') >= 0);
  /* ⚠️ Il rimando esce IDENTICO: è la stringa con cui `album.usi` sa in quanti
     posti un'immagine è citata, e con cui il ritaglio prende il posto della
     foto intera dopo «solo una parte…». Cambiarla vorrebbe dire zero usi su
     un'immagine usata, cioè una cancellazione silenziosa. */
  check('e il rimando non è stato toccato', true, dopo.indexOf('(album:9f2c1a4b7e)') >= 0);
  check('il resto del testo è quello di prima', true,
    dopo.indexOf('Ecco lo schema.') === 0 && dopo.indexOf('E si commenta.') > 0);

  check('rimetterla a zero toglie la misura, non scrive 100%',
    t, M.cambia(dopo, 'album:9f2c1a4b7e', 0, 0));
  check('e un secondo passo la sostituisce invece di accodarla',
    true, M.cambia(dopo, 'album:9f2c1a4b7e', 0, 45).indexOf('![La curva|45%](album:9f2c1a4b7e)') >= 0);
}

sezione('La stessa immagine due volte: si tocca quella che si è toccata');
{
  const t = '![x](album:aa11bb22cc) in mezzo ![x](album:aa11bb22cc)';
  const primo = M.cambia(t, 'album:aa11bb22cc', 0, 50);
  check('la prima prende la misura', '![x|50%](album:aa11bb22cc) in mezzo ![x](album:aa11bb22cc)', primo);
  const secondo = M.cambia(t, 'album:aa11bb22cc', 1, 50);
  check('la seconda pure, e da sola', '![x](album:aa11bb22cc) in mezzo ![x|50%](album:aa11bb22cc)', secondo);
  check('un’occorrenza che non c’è lascia il testo com’era', t, M.cambia(t, 'album:aa11bb22cc', 7, 50));
  check('e un bersaglio che non c’è nemmeno', t, M.cambia(t, 'album:0000000000', 0, 50));
  check('senza bersaglio non si riscrive niente', t, M.cambia(t, '', 0, 50));
}

sezione('Un rimando con dentro caratteri da espressione regolare');
{
  /* Una figura di capitolo non ha il menu (dal DOM il suo rimando non si
     ricompone com’era scritto), ma la grammatica non deve rompersi su di lei:
     `fig:03#p=7&i=2` porta caratteri che dentro una regex vogliono dire altro. */
  const t = 'testo ![Fig](fig:03#p=7&i=2) coda';
  check('il bersaglio si cerca alla lettera',
    'testo ![Fig|40%](fig:03#p=7&i=2) coda', M.cambia(t, 'fig:03#p=7&i=2', 0, 40));
}

sezione('La misura che c’è ADESSO si chiede al testo');
{
  const t = '![a|75%](album:aa11bb22cc)\n\n![b](album:aa11bb22cc)';
  check('la prima ce l’ha', 75, M.misuraDi(t, 'album:aa11bb22cc', 0));
  check('la seconda no', 0, M.misuraDi(t, 'album:aa11bb22cc', 1));
  check('e la terza non esiste', 0, M.misuraDi(t, 'album:aa11bb22cc', 2));
  check('senza bersaglio, niente', 0, M.misuraDi(t, '', 0));
}

console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti  (' + (ok + ko) + ' controlli)'
                       : '✓ tutto verde  (' + ok + ' controlli)'));
process.exit(ko ? 1 : 0);
