'use strict';
/**
 * Lo stato di ripasso su disco (`lib/ripasso.js`) — P3.1 di PIANO-BRAYNR.
 *
 * ⚠️ Che cosa si sta difendendo. La storia di ripasso è il dato più costoso di
 * tutta l'app: mesi di risposte, che nessuno può ricostruire. Fino a oggi non
 * esisteva — viveva in memoria e si azzerava a ogni cambio di lezione. Da
 * adesso sta su disco, e le due domande che contano sono: **sopravvive a una
 * rigenerazione del corso?** e **quando non sopravvive, lo dice?**
 *
 *   node test/ripasso.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const R = require('../lib/ripasso');

let ko = 0, ok = 0;
function check(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { ok++; return; }
  ko++;
  console.log('  ✗ ' + nome + '\n      atteso: ' + a + '\n      avuto:  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

const VAULT = fs.mkdtempSync(path.join(os.tmpdir(), 'studia-ripasso-'));
const CORSO = 'corso-prova';
fs.mkdirSync(path.join(VAULT, 'Corsi', CORSO), { recursive: true });

sezione('L\'identità di una carta è la sua domanda, non il suo posto');
{
  const a = R.identita('cap-01', 'Vero o falso: i DSA sono un gruppo eterogeneo?');
  /* ⚠️ Spazi e maiuscole non contano: una rigenerazione che scrive «falso ?»
     invece di «falso?» non deve azzerare la storia di chi ha già ripassato
     quella carta sei volte. Contano le parole. */
  check('spazi e maiuscole non cambiano la carta', a,
    R.identita('cap-01', '  VERO o  falso:  i DSA sono un gruppo eterogeneo? '));
  /* Ma se la domanda cambia DAVVERO, la carta è un'altra e riparte da zero:
     rispondere «buono» a una domanda non dice niente su una domanda diversa. */
  check('una domanda diversa è una carta diversa', false,
    a === R.identita('cap-01', 'Vero o falso: i DSA sono un disturbo unico?'));
  /* La stessa domanda in due capitoli sono due carte, con due storie. */
  check('lo stesso testo in un altro capitolo è un\'altra carta', false,
    a === R.identita('cap-02', 'Vero o falso: i DSA sono un gruppo eterogeneo?'));
  check('l\'id è corto e stabile', 12, a.length);
}

sezione('Il giro sul disco');
{
  check('un corso su cui non si è mai ripassato non è un errore',
    [{}, ''], [R.leggi(VAULT, CORSO).carte, R.leggi(VAULT, CORSO).error]);
  /* ⚠️ E la cartella non nasce solo perché qualcuno ha guardato. */
  check('e nemmeno crea la cartella', false, fs.existsSync(R.dir(VAULT, CORSO)));

  const id = R.identita('cap-01', 'Domanda uno');
  let carte = R.registra({}, id, 'buono', { capitolo: 'cap-01', quando: '2026-08-11T10:00:00.000Z' });
  check('registrare non tocca lo stato che riceve', {}, {});
  check('la risposta è scritta', ['buono', '2026-08-11T10:00:00.000Z'],
    [carte[id].esito, carte[id].visto]);
  check('e finisce nella storia', 1, carte[id].storia.length);

  check('salvare non dà errore', '', R.salva(VAULT, CORSO, carte).error);
  const riletto = R.leggi(VAULT, CORSO);
  check('e rileggendo si ritrova tutto', ['buono', 'cap-01', 1],
    [riletto.carte[id].esito, riletto.carte[id].capitolo, riletto.carte[id].storia.length]);

  carte = R.registra(riletto.carte, id, 'di-nuovo', { quando: '2026-08-12T10:00:00.000Z' });
  check('una seconda risposta si accoda', 2, carte[id].storia.length);
  check('e l\'ultima è quella che vale', 'di-nuovo', carte[id].esito);
  check('il capitolo non si perde per strada', 'cap-01', carte[id].capitolo);

  /* Un file che cresce senza limite per un dato che nessuno rilegge è un file
     che un giorno rallenta l'avvio: bastano le ultime venti. */
  let tante = {};
  for (let i = 0; i < 30; i++) tante = R.registra(tante, id, 'buono', { quando: '2026-08-11T10:00:0' + (i % 10) + '.000Z' });
  check('la storia si ferma a venti risposte', 20, tante[id].storia.length);
}

sezione('Ciò che non si capisce non si crede');
{
  fs.writeFileSync(path.join(R.dir(VAULT, CORSO), R.FILE), '{ non json', 'utf-8');
  const r = R.leggi(VAULT, CORSO);
  /* ⚠️ «Non lo so» non è «non hai mai ripassato»: chi chiama deve poter dire
     all'utente che la sua storia non si è potuta leggere, invece di mostrargli
     un corso azzerato come se fosse normale. */
  check('un file storto è un errore dichiarato', ['il file non è JSON valido', {}], [r.error, r.carte]);

  fs.writeFileSync(path.join(R.dir(VAULT, CORSO), R.FILE),
    JSON.stringify({ formato: 1, carte: [
      { id: 'buona', esito: 'buono', capitolo: 'c1', storia: [{ quando: 'ieri', esito: 'buono' }] },
      { esito: 'buono' },                                  // senza id: non è una carta
      { id: 'strana', esito: 'fantasia' },                 // un esito che non esiste
      { id: 'storiaccia', esito: 'buono', storia: 'non una lista' }
    ] }), 'utf-8');
  const s = R.leggi(VAULT, CORSO);
  check('le voci senza id si scartano', ['buona', 'storiaccia', 'strana'], Object.keys(s.carte).sort());
  check('un esito inventato diventa vuoto, non un esito', '', s.carte.strana.esito);
  check('e una storia che non è una lista diventa una lista vuota', [], s.carte.storiaccia.storia);
}

sezione('⚠️ La rigenerazione: chi resta, chi si perde, e chi lo dice');
{
  const vive = ['a', 'b'].map((t) => R.identita('cap-01', 'Domanda ' + t));
  const morta = R.identita('cap-01', 'Domanda che sparirà');
  let carte = {};
  [...vive, morta].forEach((i) => { carte = R.registra(carte, i, 'buono', { capitolo: 'cap-01' }); });

  const p = R.pota(carte, vive);
  check('le carte ancora vive restano', vive.sort(), Object.keys(p.carte).sort());
  /* Il patto di `percorsi.invalida()`: la storia di una domanda sparita è persa
     davvero — riattaccarla a una domanda diversa sarebbe mentire — ma non si
     perde in silenzio. Chi chiama lo mostra: «1 carta non esiste più». */
  check('e quella sparita si dichiara, con la sua storia', [morta], p.tolte.map((c) => c.id));
  check('potare senza niente di vivo non lascia niente', [0, 3],
    [Object.keys(R.pota(carte, []).carte).length, R.pota(carte, []).tolte.length]);
}

sezione('Lo stato del capitolo si DERIVA dalle carte');
{
  /* Le stesse tre etichette e le stesse soglie di prima: la segnaletica su
     indice e barra non cambia significato sotto gli occhi di chi la conosce.
     Cambia solo da dove viene il dato — dal disco, non dalla sessione. */
  const c = (esito) => ({ id: 'x' + Math.random(), capitolo: 'cap-01', esito: esito, storia: [] });
  check('tutte facili: appreso', 'appreso', R.statoCapitolo([c('facile'), c('facile')]));
  check('tutte buone: appreso', 'appreso', R.statoCapitolo([c('buono'), c('buono')]));
  check('metà difficili: da ripassare', 'ripassare', R.statoCapitolo([c('buono'), c('difficile'), c('buono')]));
  check('«di nuovo» pesa: da studiare', 'studiare', R.statoCapitolo([c('di-nuovo'), c('buono')]));
  /* ⚠️ Un capitolo mai ripassato non è «da studiare»: è «non lo so». Accenderlo
     di rosso vorrebbe dire dire a chi apre un corso nuovo che è già indietro. */
  check('mai risposto è «non lo so», non «da studiare»', null, R.statoCapitolo([]));
  check('e nemmeno una carta senza esito lo cambia', null, R.statoCapitolo([{ id: 'y', esito: '' }]));

  const carte = {};
  ['a', 'b'].forEach((t, i) => { carte['id' + i] = { id: 'id' + i, capitolo: t === 'a' ? 'cap-01' : 'cap-02', esito: 'buono', storia: [] }; });
  check('le carte si trovano per capitolo', 1, R.delCapitolo(carte, 'cap-01').length);
}

try { fs.rmSync(VAULT, { recursive: true, force: true }); } catch (e) {}
console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati') + ' (' + ok + ' ok)');
process.exit(ko ? 1 : 0);
