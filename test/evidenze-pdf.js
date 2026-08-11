'use strict';
/**
 * Le evidenze prese su un DOCUMENTO (lib/evidenze.js).
 *
 * Un'evidenza su un capitolo dice «lezione, capitolo, questo testo». Una presa
 * su un PDF non ha capitoli: dice «documento, pagina, questo testo». La forma
 * del record era già pronta — `materiale` e `pagina` stanno in `CAMPI` dal
 * giorno in cui il file è nato — ma l'IDENTITÀ no, e lì c'era un guasto che
 * questo file esiste per impedire:
 *
 *   la stessa frase evidenziata a pagina 3 di un documento e a pagina 9 di un
 *   altro produceva **lo stesso id**, perché il seme guardava solo il capitolo
 *   (vuoto in entrambi i casi) più il testo. E `aggiungi` è idempotente per id:
 *   la seconda evidenza sovrascriveva la prima. Una parola chiave che sparisce
 *   mentre se ne aggiunge un'altra, senza un errore.
 *
 * L'altra promessa da difendere è la compatibilità: cambiare il seme cambia gli
 * id, e gli id sono già scritti nei vault. Le evidenze dei capitoli devono
 * continuare a produrre ESATTAMENTE l'id di prima, o ri-evidenziare un punto
 * già evidenziato creerebbe un doppione sulla stessa parola.
 *
 *   node test/evidenze-pdf.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const E = require('../lib/evidenze');

let ko = 0, ok = 0;
function check(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { ok++; return; }
  ko++;
  console.log('  ✗ ' + nome + '\n      atteso: ' + a + '\n      avuto:  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

const VAULT = fs.mkdtempSync(path.join(os.tmpdir(), 'studia-evpdf-'));
const CORSO = 'corso-di-prova';
fs.mkdirSync(path.join(VAULT, 'Corsi', CORSO), { recursive: true });
const QUANDO = '2026-08-10T10:00:00.000Z';

/** Una parola chiave presa su una pagina di un documento. */
function suPdf(materiale, pagina, exact, extra) {
  return Object.assign({ materiale, pagina, exact, prefix: 'la ', suffix: ' di lavoro',
    colore: '#a16207' }, extra || {});
}

sezione('⚠️ L\'identità: due pagine e due documenti non sono la stessa cosa');
{
  const a = E.identita(suPdf('03 dispensa.pdf', 3, 'memoria'));
  const b = E.identita(suPdf('07 slide.pdf', 3, 'memoria'));
  const c = E.identita(suPdf('03 dispensa.pdf', 9, 'memoria'));
  check('la stessa frase in due documenti ha due id', false, a === b);
  check('e in due pagine dello stesso documento pure', false, a === c);
  /* Lo stesso punto, ri-evidenziato: stesso id. È ciò che rende `aggiungi`
     idempotente senza che nessuno debba cercare i doppioni. */
  check('lo stesso punto dà sempre lo stesso id', a, E.identita(suPdf('03 dispensa.pdf', 3, 'memoria')));
  /* E il contorno conta: la stessa parola due volte nella stessa pagina sono
     due evidenze diverse, non una. */
  check('due occorrenze nella stessa pagina sono due evidenze', false,
    a === E.identita(suPdf('03 dispensa.pdf', 3, 'memoria', { prefix: 'nella ', suffix: ' visiva' })));
}

sezione('E le evidenze dei capitoli non cambiano id (nessuna migrazione)');
{
  /* ⚠️ Il valore è scritto a mano di proposito: è il contratto con i vault che
     esistono già. Se un giorno cambia, questa riga diventa rossa e chi la
     guarda sa che ha appena reso doppione ogni parola chiave del mondo. */
  const suCapitolo = { capitoloId: 'c01', exact: 'memoria', prefix: 'la ', suffix: ' di lavoro' };
  check('l\'id di un\'evidenza di capitolo è quello di sempre',
    '2b4488da0195', E.identita(suCapitolo));
  /* Un capitolo e un documento non si scambiano id nemmeno per caso. */
  check('capitolo e documento vivono in due spazi', false,
    E.identita(suCapitolo) === E.identita(suPdf('x.pdf', 1, 'memoria')));
}

sezione('Il giro su disco: due pagine, due record');
{
  const r1 = E.aggiungi(VAULT, CORSO, suPdf('03 dispensa.pdf', 3, 'memoria'), QUANDO);
  check('la prima si salva', '', r1.error);
  const r2 = E.aggiungi(VAULT, CORSO, suPdf('03 dispensa.pdf', 9, 'memoria'), QUANDO);
  check('la seconda si salva', '', r2.error);
  check('e sono due, non una', 2, r2.evidenze.length);
  /* Il guasto che questo blocco impedisce: la seconda che scrive sopra la prima
     e la fa sparire dall'elenco. */
  check('la pagina 3 è ancora lì', true, r2.evidenze.some((e) => e.pagina === 3));
  check('e la pagina 9 anche', true, r2.evidenze.some((e) => e.pagina === 9));

  /* Ri-aggiungere lo stesso punto con un altro colore è il gesto «ricolora»:
     non allunga l'elenco. */
  const r3 = E.aggiungi(VAULT, CORSO, suPdf('03 dispensa.pdf', 3, 'memoria', { colore: '#2dd4bf' }), QUANDO);
  check('ri-evidenziare lo stesso punto non aggiunge niente', 2, r3.evidenze.length);
  check('ma il colore nuovo vince', '#2dd4bf',
    r3.evidenze.filter((e) => e.pagina === 3)[0].colore);

  /* La pagina resta un NUMERO: scritta come stringa nel file, riletta come
     numero, o il confronto con la pagina del viewer sarebbe fra tipi diversi. */
  const letto = E.leggi(VAULT, CORSO);
  check('la pagina è un numero, non una stringa', 'number',
    typeof letto.evidenze.filter((e) => e.materiale)[0].pagina);
  check('e il materiale è il nome del file', '03 dispensa.pdf',
    letto.evidenze.filter((e) => e.materiale)[0].materiale);
}

sezione('La vista leggibile raggruppa per documento e pagina');
{
  const md = E.indice([
    suPdf('03 dispensa.pdf', 3, 'memoria'),
    suPdf('03 dispensa.pdf', 9, 'attenzione'),
    { capitoloId: 'c01', capitolo: 'Il framework', exact: 'fluency', prefix: '', suffix: '' }
  ], QUANDO);
  check('c\'è la sezione della pagina 3', true, md.indexOf('## 03 dispensa.pdf — p. 3') >= 0);
  check('e quella della pagina 9', true, md.indexOf('## 03 dispensa.pdf — p. 9') >= 0);
  /* Il capitolo continua a raggrupparsi per titolo, come prima. */
  check('il capitolo resta raggruppato per titolo', true, md.indexOf('## Il framework') >= 0);
}

sezione('Una voce senza pagina non inventa una pagina');
{
  /* Può arrivare da un file scritto a mano. Non è un motivo per rifiutarla —
     il testo c'è — ma nemmeno per attribuirle la pagina 1. */
  const v = E.normalizzaVoce({ materiale: 'x.pdf', exact: 'qualcosa' });
  check('la pagina resta vuota', '', v.pagina);
  check('e la voce è valida', true, !!v.id);
  check('nella vista sta sotto il solo documento', true,
    E.indice([v], QUANDO).indexOf('## x.pdf\n') >= 0);
}

try { fs.rmSync(VAULT, { recursive: true, force: true }); } catch (e) { /* era temporanea */ }

console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati') + ' (' + ok + ' ok)');
process.exit(ko ? 1 : 0);
