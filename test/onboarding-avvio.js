'use strict';
/**
 * Da quale metà dell'app si comincia, e che cosa si chiede prima
 * (`App/assets/onboarding/avvio.js`).
 *
 * ⚠️ Che cosa difendono queste prove. Fino al 31 agosto 2026 l'app apriva sempre
 * nei CORSI e il primo avvio chiedeva motore AI, chiave e Python: requisiti della
 * pipeline, davanti a chi magari voleva solo aprire un PDF. Ma il rimedio ha due
 * modi di essere peggiore del male, e sono questi due controlli:
 *
 *   - **spostare l'app sotto i piedi di chi la usa già**: chi ieri era nei corsi
 *     deve ritrovarsi nei corsi, sempre, e chi apre un vault che ha già dei corsi
 *     non deve trovarsi nella metà vuota;
 *   - **nascondere la pipeline**: in modalità corso i pannelli devono restare
 *     esattamente quelli di prima. Non si toglie niente, si sposta il momento.
 *
 *   node test/onboarding-avvio.js
 */

const A = require('../App/assets/onboarding/avvio');

let ko = 0, ok = 0;
function check(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { ok++; return; }
  ko++;
  console.log('  ✗ ' + nome + '\n      atteso: ' + a + '\n      avuto:  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

sezione('Da dove si comincia');
{
  /* Il caso per cui si fa tutto questo: nessuna storia, nessun corso. */
  check('un vault vergine apre nello ZAINO', 'zaino', A.modoIniziale({ corsi: [], zaini: [] }));
  check('e anche senza sapere niente di niente', 'zaino', A.modoIniziale({}));
  check('e con un argomento storto', 'zaino', A.modoIniziale(null));

  /* ⚠️ I due «no», che valgono più del sì: la regola non deve spostare l'app a
     chi la usa già. */
  check('la modalità di ieri vince su tutto', 'corso',
    A.modoIniziale({ salvato: 'corso', corsi: [], zaini: ['z'] }));
  check('anche quando era lo zaino', 'zaino',
    A.modoIniziale({ salvato: 'zaino', corsi: ['a', 'b'] }));
  check('un vault che ha già dei CORSI apre nei corsi', 'corso',
    A.modoIniziale({ corsi: ['ai-literacy'] }));
  /* Il conto può arrivare come numero invece che come elenco: succede quando
     chi chiama ha in mano una `length` e non la lista. */
  check('e vale anche se il conto arriva come numero', 'corso', A.modoIniziale({ corsi: 3 }));
  check('zero corsi come numero resta zaino', 'zaino', A.modoIniziale({ corsi: 0 }));
  /* Un valore che non è una delle due modalità non è «ieri»: si ricomincia
     dalla regola, invece di aprire una metà che non esiste. */
  check('una modalità salvata senza senso si ignora', 'zaino', A.modoIniziale({ salvato: 'boh' }));
}

sezione('Che cosa si chiede prima di cominciare');
{
  const conSpazio = { avvisi: [{ id: 'spazio', livello: 'attenzione', testo: '…' }] };
  const conMotore = { avvisi: [{ id: 'motore-assente', livello: 'attenzione', testo: '…' }] };

  /* ⚠️ IL CONTROLLO CHE VALE IL LAVORO: nello zaino non si chiede NIENTE. Non un
     pannello più corto: nessuno, così chi chiama non apre la card affatto. */
  check('nello ZAINO non si chiede niente', { pannelli: [], toastSpazio: false },
    A.passiPrimoAvvio({ modo: 'zaino', consiglio: conMotore }));
  /* Lo spazio scarso resta l'unica cosa da dire, e si dice di passaggio: una
     card modale per una riga sola è lo stesso muro, più basso. */
  check('e lo spazio scarso diventa un avviso di passaggio, non un muro',
    { pannelli: [], toastSpazio: true },
    A.passiPrimoAvvio({ modo: 'zaino', consiglio: conSpazio }));

  /* ⚠️ E nei CORSI non cambia niente: la pipeline non si nasconde, si sposta. */
  check('nei CORSI restano motore e Python', { pannelli: ['motore', 'python'], toastSpazio: false },
    A.passiPrimoAvvio({ modo: 'corso', consiglio: conMotore }));
  check('più lo spazio, quando è poco',
    { pannelli: ['motore', 'python', 'spazio'], toastSpazio: false },
    A.passiPrimoAvvio({ modo: 'corso', consiglio: conSpazio }));
  check('senza consiglio si resta ai due di sempre',
    { pannelli: ['motore', 'python'], toastSpazio: false }, A.passiPrimoAvvio({ modo: 'corso' }));
  check('e un argomento storto non fa saltare niente',
    { pannelli: ['motore', 'python'], toastSpazio: false }, A.passiPrimoAvvio(null));
}

sezione('Alla soglia dei corsi si apre solo se manca qualcosa');
{
  /* ⚠️ IL CONTROLLO NATO DA UN ROSSO. La prima versione apriva la card ogni volta
     che si entrava nei corsi finché il flag non era segnato — anche con motore e
     Python a posto. Nella suite CDP tre prove sono diventate rosse: la card
     copriva l'app e i click finivano su di lei. Per l'utente sarebbe stata la
     stessa cosa, una volta sola: una finestra aperta per dire «tutto bene». */
  check('con tutto a posto non si chiede niente', false, A.serveSoglia({ avvisi: [] }));
  check('e nemmeno senza consiglio', false, A.serveSoglia(null));
  check('senza motore AI si chiede', true, A.serveSoglia({ avvisi: [{ id: 'motore-assente' }] }));
  check('senza Python si chiede', true, A.serveSoglia({ avvisi: [{ id: 'python-assente' }] }));
  /* Lo spazio è un avviso, non un requisito: su un disco quasi pieno si genera
     lo stesso. Aprire una finestra per quello sarebbe la porta di troppo. */
  check('per il solo spazio NON si chiede', false, A.serveSoglia({ avvisi: [{ id: 'spazio' }] }));
}

console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati') + ' (' + ok + ' ok)');
process.exit(ko ? 1 : 0);
