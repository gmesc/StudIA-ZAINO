/* Le figure ritagliate dai documenti, dal markdown al capitolo.
 *
 * Che cosa si prova qui: che `![didascalia](fig:03#p=7&i=2)` diventi una figura
 * che si vede e si può aprire, che il nome del file del ritaglio sia quello che
 * `ocr.py` ha davvero scritto su disco, e che l'elenco delle figure di un
 * capitolo non si perda per strada fra testo, frontmatter e riquadro delle fonti.
 *
 * ⚠️ Il parser NON è una copia: `lib/reader-parser.js` estrae le funzioni vere
 * da `App/StudIA.html` e le esegue in Node. Se un giorno la resa cambia
 * nell'app, questi controlli lo sanno.
 */
const path = require('path');
const RP = require('../lib/reader-parser.js');
const GEN = require('../lib/genera.js');
const MDSER = require('../lib/mdser.js');
const VAL = require('../lib/validate.js');
const PAC = require('../lib/pacchetto.js');

let ko = 0, ok = 0;
function check(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { ok++; return; }
  ko++;
  console.log('  ✗ ' + nome + '\n      atteso: ' + a + '\n      avuto:  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

const PDF = { '03': '03 La disortografia - Galton.pdf', '05': '05 Metodo di studio.pdf' };
const P = RP.load({ pdfByNum: PDF, mediaByNum: {} });

sezione('Dal markdown alla figura che si vede');
{
  const h = P._mdInline('Lo schema chiarisce tutto. ![I quattro processi](fig:03#p=7&i=2)');
  check('la figura diventa un contenitore col suo ruolo', true, /<span class="figura" role="figure"/.test(h));
  /* Il click NON è un gestore nuovo: è `a.plink`, cioè la stessa strada dei
     rimandi a pagina. Se un giorno cambiasse, cambierebbe per tutti insieme. */
  check('si apre con lo stesso link dei rimandi a pagina', true, /class="plink figlink"/.test(h));
  check('e porta il documento e la pagina giusti', true,
    h.indexOf('data-file="03 La disortografia - Galton.pdf"') > 0 && h.indexOf('data-page="7"') > 0);
  /* ⚠️ Il confronto si fa sul nome DECODIFICATO: la sorgente è una URL, quindi
     gli spazi del nome del PDF ci arrivano come «%20». Confrontare la stringa
     grezza farebbe fallire questo controllo per un motivo che non c'entra
     niente con le figure. */
  check('l\'immagine punta al ritaglio con quel nome', '03 La disortografia - Galton__p007_f2.webp',
    decodeURIComponent((/src="([^"]*)"/.exec(h) || [, ''])[1]).split('/').pop());
  check('la didascalia si vede sotto', true, /<span class="figcap">I quattro processi<\/span>/.test(h));
  check('e vale anche come testo alternativo', true, /alt="I quattro processi"/.test(h));

  const uno = P._mdInline('![Senza indice](fig:05#p=3)');
  check('senza «i» la figura è la prima della pagina', true, /__p003_f1\.webp/.test(uno));

  /* ⚠️ Il guasto che questa riga tiene fermo: la regex dei link normali matcha
     anche la parte dopo il punto esclamativo. Se la figura non si riconosce
     PRIMA, resta un «!» orfano davanti a un link che non è più una figura. */
  check('nessun punto esclamativo orfano', false, /!<(a|span)/.test(h));

  const rotta = P._mdInline('![Schema](fig:99#p=2&i=1)');
  check('un materiale che non esiste lo dice, invece di lasciare un buco', true,
    /figmanca/.test(rotta) && rotta.indexOf('non trovato') > 0);
  check('e non produce mai un\'immagine senza sorgente', false, /<img/.test(rotta));

  const testo = P._mdInline('Vedi [p. 7](pdf:03#p=7) e ![Schema](fig:03#p=7&i=1)');
  check('un rimando normale e una figura convivono nella stessa riga', true,
    /class="plink"/.test(testo) && /class="figura"/.test(testo));
}

sezione('Il capitolo porta con sé l\'elenco delle sue figure');
{
  const md = [
    '---',
    'id: 01-fondamenti-c01',
    'title: "La disortografia"',
    'figure:',
    '  - { pdf: "03", p: 7, i: 2, label: "I quattro processi" }',
    '  - { pdf: "03", p: 9, i: 1, label: "La scala" }',
    '---',
    '',
    '## In breve',
    'Testo breve.',
    '',
    '## Contenuto',
    'Il processo si articola. ![I quattro processi](fig:03#p=7&i=2)',
    '',
    '## Punti chiave',
    '- un punto',
    '- due punti',
    '- tre punti'
  ].join('\n');
  const cap = P.mdChapter(md, '01-fondamenti', 1);
  check('il capitolo espone le sue figure', 2, (cap.figure || []).length);
  check('col documento sciolto in nome di file', '03 La disortografia - Galton.pdf', cap.figure[0].pdf);
  check('la pagina e l\'indice sono numeri', [7, 2], [cap.figure[0].page, cap.figure[0].i]);
  check('e il testo mostra la figura', true, /class="figura"/.test(cap.html));
}

sezione('Chi scrive il capitolo non perde le figure per strada');
{
  const dati = {
    title: 'La disortografia', inBreve: 'Breve.', puntiChiave: ['a', 'b', 'c'],
    contenuto: 'Prima. ![Schema dei processi](fig:03#p=7&i=2)\n\nPoi ![La scala](fig:03#p=9&i=1) e ancora ![Schema dei processi](fig:03#p=7&i=2).'
  };
  const trovati = GEN.rimandiDa(dati);
  check('le figure citate nel testo si raccolgono', 2, trovati.figure.length);
  check('senza doppioni', [7, 9], trovati.figure.map((f) => f.p));
  check('con la didascalia come etichetta', 'Schema dei processi', trovati.figure[0].label);

  /* ⚠️ Due figure sulla STESSA pagina sono due cose diverse: se l'identità
     fosse la sola pagina, la seconda sparirebbe dall'elenco pur restando
     visibile nel testo. */
  const due = GEN.rimandiDa({ contenuto: '![Una](fig:03#p=7&i=1) ![Due](fig:03#p=7&i=2)' });
  check('due figure della stessa pagina restano due', 2, due.figure.length);

  const fuse = GEN.unisciFigure(
    [{ pdf: '3', p: 7, i: 2, label: 'Etichetta scritta a mano' }],
    [{ pdf: '03', p: 7, i: 2, label: 'trovata nel testo' }, { pdf: '03', p: 9, i: 1, label: 'solo nel testo' }]);
  check('l\'unione tiene tutte le figure', 2, fuse.length);
  check('e a parità vince l\'etichetta dichiarata', 'Etichetta scritta a mano', fuse[0].label);
  check('il numero del materiale è sempre a due cifre', '03', fuse[0].pdf);
}

sezione('Il file .md le riscrive, e rileggendolo tornano uguali');
{
  const md = MDSER.chapter({
    id: '01-x-c01', title: 'Titolo', order: 1, inBreve: 'Breve.', contenuto: 'Testo. ![Schema](fig:03#p=7&i=2)',
    puntiChiave: ['a', 'b', 'c'], figure: [{ pdf: '03', p: 7, i: 2, label: 'Schema' }]
  });
  check('il frontmatter dichiara la figura', true, /figure:\s*\n\s+- \{ pdf: "03", p: 7, i: 2/.test(md));
  const ri = P.mdChapter(md, '01-x', 1);
  check('e rileggendo si ritrova identica', [7, 2, 'Schema'], [ri.figure[0].page, ri.figure[0].i, ri.figure[0].label]);
}

sezione('Il validatore guarda le figure come guarda le pagine');
{
  const base = { title: 'Titolo', inBreve: 'Una frase abbastanza lunga.', puntiChiave: ['a', 'b', 'c'] };
  const ctx = { pdfByNum: { '03': 'x.pdf' }, pagine: { '03': 10 } };
  const buono = VAL.validateCapitolo(Object.assign({}, base, {
    contenuto: 'Un testo lungo abbastanza per passare la lunghezza minima richiesta. ![Schema](fig:03#p=7&i=2)'
  }), ctx);
  check('una figura giusta passa', [], buono.errors.filter((e) => /fig/.test(e)));

  const male = VAL.validateCapitolo(Object.assign({}, base, {
    contenuto: 'Un testo lungo abbastanza per passare la lunghezza minima richiesta. ![Schema](fig:03#p=99&i=1)'
  }), ctx);
  check('una pagina oltre la fine no', 1, male.errors.filter((e) => /oltre le pagine/.test(e)).length);

  const ignoto = VAL.validateCapitolo(Object.assign({}, base, {
    contenuto: 'Un testo lungo abbastanza per passare la lunghezza minima richiesta. ![Schema](fig:07#p=1&i=1)'
  }), ctx);
  check('un materiale inesistente no', 1, ignoto.errors.filter((e) => /materiale inesistente/.test(e)).length);

  const zero = VAL.validateCapitolo(Object.assign({}, base, {
    contenuto: 'Un testo lungo abbastanza per passare la lunghezza minima richiesta. ![Schema](fig:03#p=7&i=0)'
  }), ctx);
  check('l\'indice della figura parte da 1', 1, zero.errors.filter((e) => /parte da 1/.test(e)).length);

  const storto = VAL.validateCapitolo(Object.assign({}, base, {
    contenuto: 'Un testo lungo abbastanza per passare la lunghezza minima richiesta. ![Schema](fig:03)'
  }), ctx);
  check('e una forma storta si dice, invece di passare in silenzio', 1,
    storto.errors.filter((e) => /malformato/.test(e)).length);
}

sezione('L\'esportazione le conta, quindi chi importa se ne accorge');
{
  const voci = ['TD/_corso.md', 'TD/01-lez/01-cap.md',
    'TD/MATERIALI/PDF/03 x.pdf', 'TD/MATERIALI/Figure/03 x__p007_f1.webp', 'TD/MATERIALI/Figure/03 x__p007_f2.webp'];
  const info = PAC.esamina(voci);
  check('il pacchetto dichiara quante figure porta', 2, info.figure);
  check('e lo dice a parole', true, PAC.descrizione(info).indexOf('2 figure') >= 0);
  check('le figure non stanno fra le esclusioni', false,
    PAC.esclusioni('TD', { appunti: true }).some((x) => /Figure/.test(x)));
}

console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti  (' + (ok + ko) + ' controlli)'
                        : '✓ tutto verde  (' + ok + ' controlli)'));
process.exit(ko ? 1 : 0);
