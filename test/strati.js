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

sezione('Una lettura per volta: si spegne quella, non tutte');
{
  const evd = [
    { id: 'a1', strato: '' }, { id: 'b2', strato: 'metrica' },
    { id: 'c3', strato: 'metrica' }, { id: 'd4', strato: 'retorica' }
  ];
  const senzaMetrica = { tutte: true, spenti: ['metrica'] };
  check('restano quelle delle altre letture', ['a1', 'd4'],
    S.visibili(evd, senzaMetrica).map((e) => e.id));
  check('e il conto lo dice', { viste: 2, nascoste: 2, tutte: 4 }, S.conta(evd, senzaMetrica));
  /* ⚠️ Lo strato BASE si spegne come gli altri, e il suo id è la stringa vuota:
     è l'assenza di strato, non «nessuno strato». Senza questo, le evidenze fatte
     prima che le letture esistessero sarebbero le uniche che non si possono
     mettere via. */
  check('anche la base si spegne', ['b2', 'c3', 'd4'],
    S.visibili(evd, { tutte: true, spenti: [''] }).map((e) => e.id));
  check('e l\'interruttore generale vince su tutto', 0,
    S.visibili(evd, { tutte: false, spenti: ['metrica'] }).length);
}

sezione('L\'interruttore di una lettura, e quello che NON scrive');
{
  check('spegnerla la mette fra le spente', { tutte: true, spenti: ['metrica'] },
    S.commutaStrato({ tutte: true }, 'metrica'));
  check('riaccenderla la toglie, e il campo sparisce', { tutte: true },
    S.commutaStrato({ tutte: true, spenti: ['metrica'] }, 'metrica'));
  check('una spenta due volte non si duplica', { tutte: true, spenti: ['metrica'] },
    S.normalizza({ tutte: true, spenti: ['metrica', 'metrica'] }));
  check('la base si spegne col suo id vuoto', { tutte: true, spenti: [''] },
    S.commutaStrato({ tutte: true }, ''));
  check('«spento» risponde per la base', true, S.spento({ tutte: true, spenti: [''] }, ''));
  check('e dice di no per una che non c\'è', false, S.spento({ tutte: true, spenti: [''] }, 'metrica'));
}

sezione('⚠️ Una lettura cancellata non resta spenta per sempre');
{
  /* Uno stato che nomina una lettura che non esiste più è invisibile: riemerge
     il giorno in cui qualcuno riusa quell'id, e nessuno saprebbe perché quei
     segni non si accendono. */
  check('si pota quello che non esiste', { tutte: true, spenti: ['viva'] },
    S.potaSpenti({ tutte: true, spenti: ['viva', 'morta'] }, ['viva']));
  check('ma la base non si pota mai: non è nel registro', { tutte: true, spenti: [''] },
    S.potaSpenti({ tutte: true, spenti: [''] }, []));
  check('e senza spenti non si inventa il campo', { tutte: false },
    S.potaSpenti({ tutte: false }, ['viva']));
}

sezione('Il registro: nomi che si distinguono, ordine di nascita');
{
  check('un nome si ripulisce', 'Analisi metrica', S.nomeValido('  Analisi   metrica  '));
  check('e non è infinito', 60, S.nomeValido('x'.repeat(200)).length);
  /* ⚠️ Due letture con lo stesso nome sono due righe indistinguibili in un
     pannello dove l'unica cosa che si legge è il nome. */
  check('un nome già preso si numera', 'Metrica 2',
    S.nomeLibero('Metrica', [{ nome: 'Metrica' }]));
  check('e si continua a numerare', 'Metrica 3',
    S.nomeLibero('Metrica', [{ nome: 'Metrica' }, { nome: 'Metrica 2' }]));
  check('senza badare alle maiuscole', 'Metrica 2',
    S.nomeLibero('Metrica', [{ nome: 'METRICA' }]));
  check('un nome vuoto ne prende uno di comodo', 'Lettura', S.nomeLibero('   ', []));

  const reg = S.ordina([
    { id: 'b', nome: 'Seconda', creato: '2026-08-02T10:00:00.000Z' },
    { id: 'a', nome: 'Prima', creato: '2026-08-01T10:00:00.000Z' },
    { id: 'a', nome: 'Doppione', creato: '2026-08-03T10:00:00.000Z' },
    { nome: 'Senza id' }, null, { id: 'z' }
  ]);
  check('in ordine di nascita, senza doppioni e senza voci mute',
    [['a', 'Prima'], ['b', 'Seconda']], reg.map((s) => [s.id, s.nome]));
}

sezione('Le righe del pannello: una per lettura, più la Base');
{
  const strati = [
    { id: 'me', nome: 'Metrica', creato: '2026-08-01T10:00:00.000Z' },
    { id: 're', nome: 'Retorica', creato: '2026-08-02T10:00:00.000Z' }
  ];
  const evd = [
    { id: '1', strato: 'me' }, { id: '2', strato: 'me' },
    { id: '3', strato: 're' }, { id: '4', strato: '' }
  ];
  const r = S.righe(strati, evd, { tutte: true, spenti: ['re'] });
  check('una riga per lettura, e la Base in fondo',
    ['Metrica', 'Retorica', 'Base'], r.map((x) => x.nome));
  /* ⚠️ Il conto è metà del pannello: «Metrica» e basta non fa capire perché il
     testo è pulito, «Metrica · 2» sì. */
  check('ognuna porta il suo conto', [2, 1, 1], r.map((x) => x.quante));
  check('e dice se è spenta', [false, true, false], r.map((x) => x.spento));
  check('la Base si dichiara tale', [false, false, true], r.map((x) => x.base));

  /* ⚠️ La Base compare solo se ci vive qualcosa: un vault che non ha mai visto
     una lettura non deve trovarsi una riga a spiegargli una cosa che non usa. */
  check('senza evidenze nude, nessuna riga Base', ['Metrica', 'Retorica'],
    S.righe(strati, [{ id: '1', strato: 'me' }, { id: '3', strato: 're' }], { tutte: true })
      .map((x) => x.nome));
  check('e una lettura vuota resta nell\'elenco, con zero',
    0, S.righe(strati, [{ id: '4', strato: '' }], { tutte: true })[0].quante);
  check('nessuna lettura e nessun segno: nessuna riga', 0, S.righe([], [], { tutte: true }).length);
}

sezione('Il posto nella pila: chi si accavalla, e come lo si distingue');
{
  const L = (segni) => S.livelli(segni).per;
  /* Due righe sulla stessa parola: la seconda va al posto 1 — è quella che si
     disegnerà tratteggiata sopra la prima. */
  const due = L([{ id: 'a', tratto: 'sotto', inizio: 0, fine: 10 },
    { id: 'b', tratto: 'sotto', inizio: 2, fine: 8 }]);
  check('la prima sta sotto', 0, due.a.livello);
  check('la seconda le va sopra', 1, due.b.livello);
  check('e tutte e due sanno di non essere sole', [2, 2], [due.a.pila, due.b.pila]);

  /* ⚠️ Le due pile sono SEPARATE: un fondo e una riga sulla stessa parola non
     si danno fastidio, e contarli insieme metterebbe la riga al secondo posto
     per colpa di un fondo che non c'entra. È il primo caso del braindump. */
  const misto = L([{ id: 'f', tratto: 'overlay', inizio: 0, fine: 10 },
    { id: 'r', tratto: 'sotto', inizio: 0, fine: 10 }]);
  check('fondo e riga restano tutti e due al posto zero', [0, 0], [misto.f.livello, misto.r.livello]);
  check('e ognuno si crede solo, perché nella sua pila lo è', [1, 1], [misto.f.pila, misto.r.pila]);

  /* Chi non si tocca non fa pila: resta com'è sempre stato. */
  const lontani = L([{ id: 'x', tratto: 'sotto', inizio: 0, fine: 10 },
    { id: 'y', tratto: 'sotto', inizio: 20, fine: 30 }]);
  check('segni lontani sono tutti primi', [0, 0], [lontani.x.livello, lontani.y.livello]);
  check('e soli', [1, 1], [lontani.x.pila, lontani.y.pila]);
  /* Confinanti ma non sovrapposti: 0-10 e 10-20 non si toccano. */
  const attaccati = L([{ id: 'p', tratto: 'sotto', inizio: 0, fine: 10 },
    { id: 'q', tratto: 'sotto', inizio: 10, fine: 20 }]);
  check('nemmeno due che si sfiorano fanno pila', [1, 1], [attaccati.p.pila, attaccati.q.pila]);
}

sezione('⚠️ Il tetto: oltre il quarto non si distingue, e si dice');
{
  const cinque = [];
  for (let i = 0; i < 5; i++) cinque.push({ id: 's' + i, tratto: 'sotto', inizio: i, fine: 20 });
  const r = S.livelli(cinque);
  check('i primi quattro hanno il loro posto', [0, 1, 2, 3], [0, 1, 2, 3].map((i) => r.per['s' + i].livello));
  check('il quinto si ferma al quarto posto', 3, r.per.s4.livello);
  check('e si dichiara tagliato', true, r.per.s4.tagliato);
  check('il conto di quelli che non si distinguono torna a chi chiama', 1, r.oltre);
  check('mentre i primi quattro non sono tagliati', [false, false, false, false],
    [0, 1, 2, 3].map((i) => r.per['s' + i].tagliato));
  check('il tetto è dichiarato, non nascosto in un numero', 4, S.TETTO);
}

sezione('Ingressi storti non fanno saltare la pila');
{
  check('un elenco che non è un elenco', { per: {}, oltre: 0 }, S.livelli(null));
  check('voci senza id si scartano', {}, S.livelli([{ tratto: 'sotto', inizio: 0, fine: 5 }]).per);
  const strano = S.livelli([{ id: 'z', tratto: 'boh', inizio: '3', fine: '9' }]).per;
  check('un tratto sconosciuto diventa una riga', { livello: 0, pila: 1, tagliato: false }, strano.z);
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
