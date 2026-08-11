'use strict';
/**
 * La lente: che cosa entra nell'indice, e come si ordina ciò che trova
 * (`App/assets/ricerca/indice.js`).
 *
 * ⚠️ PERCHÉ QUESTE PROVE NON ESISTEVANO, E PERCHÉ SERVONO. La ricerca è la cosa
 * che si rompe più in silenzio dell'app: se un campo smette di finire
 * nell'indice non c'è nessun errore, da nessuna parte — semplicemente quella
 * cosa non si trova più, e chi cerca conclude che non c'è. Fino all'11 agosto
 * 2026 il codice stava dentro `App/StudIA.html` e l'unico modo di verificarlo
 * era aprire l'app e cercare qualcosa di cui si sapeva già la risposta.
 *
 *   node test/ricerca.js
 */

const R = require('../App/assets/ricerca/indice.js');

let ko = 0, ok = 0;
function check(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { ok++; return; }
  ko++;
  console.log('  ✗ ' + nome + '\n      atteso: ' + a + '\n      avuto:  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

/* Lo `stripHtml` del renderer, nella sua forma minima: qui non c'è un DOM. */
const via = (h) => String(h == null ? '' : h).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

sezione('La normalizzazione preserva la lunghezza');
{
  /* ⚠️ È la condizione che tiene in piedi tutto il resto: le posizioni trovate
     nel testo normalizzato si usano per ritagliare il frammento dal testo
     ORIGINALE. Se `sNorm` togliesse anche un solo carattere, il ritaglio
     partirebbe sfasato e il frammento comincerebbe a mezza parola. */
  const casi = ['perché', 'città', 'è così', 'l’altro', '“virgolette”', 'ñandù', 'ÀÈÌÒÙ'];
  for (const s of casi) check('«' + s + '» resta lunga uguale', s.length, R.sNorm(s).length);
  check('gli accenti si appiattiscono', 'perche cosi citta', R.sNorm('Perché Così Città'));
  check('e le virgolette curve diventano dritte', '"l\'altro"', R.sNorm('“l’altro”'));
}

sezione('Che cosa di un capitolo diventa cercabile');
{
  /* I cinque posti in cui chi studia si aspetta di ritrovare una parola letta.
     Toglierne uno non rompe niente e non si vede: per questo si elencano. */
  const cap = {
    title: 'La memoria di lavoro',
    brief: '<p>Un <b>sommario</b> con la parola sommarioso</p>',
    html: '<p>Il corpo del capitolo, con capitolosa dentro.</p>',
    keypoints: ['<i>Primo</i> punto puntoso'],
    glossary: [{ t: 'Glossarione', d: '<p>una <b>definizione</b> definitosa</p>' }]
  };
  const d = R.docCapitolo(cap, { lessonId: '01-x', lessonTitle: 'Lezione uno', idx: 2 }, via);
  for (const parola of ['memoria', 'sommarioso', 'capitolosa', 'puntoso', 'glossarione', 'definitosa']) {
    check('«' + parola + '» è nell\'indice', true, d.ntext.indexOf(parola) >= 0);
  }
  check('l\'HTML non ci entra dentro', false, /<b>|<p>/.test(d.text));
  check('e la voce sa dove sta', ['01-x', 'Lezione uno', 2], [d.lessonId, d.lessonTitle, d.idx]);

  const p = R.docPagina('03 dispensa.pdf', 'Dispensa', { page: 7, text: 'testo della settima pagina' });
  check('una pagina di documento si apre per pagina', ['03 dispensa.pdf', 7, 'p. 7', 7],
    [p.materiale, p.pagina, p.title, p.idx]);
}

sezione('Tutti i termini, non uno qualsiasi');
{
  const docs = [
    R.docCapitolo({ title: 'Alfa', html: 'parla di memoria e di lavoro' }, { lessonTitle: 'L', idx: 0 }, via),
    R.docCapitolo({ title: 'Beta', html: 'parla solo di memoria' }, { lessonTitle: 'L', idx: 1 }, via)
  ];
  /* Una ricerca di due parole che restituisse anche i documenti con una sola
     riempirebbe l'elenco di risposte che non sono risposte. */
  check('due termini: passa solo chi li ha entrambi', ['Alfa'],
    R.cerca(docs, 'memoria lavoro').map((r) => r.d.title));
  check('un termine solo: passano tutti e due', ['Alfa', 'Beta'],
    R.cerca(docs, 'memoria').map((r) => r.d.title).sort());
  check('una ricerca vuota non è una ricerca di tutto', [], R.cerca(docs, '   '));
  check('e nemmeno una di sole spaziature', [], R.cerca(docs, '\t\n'));
  check('gli accenti non contano', 1, R.cerca(
    [R.docCapitolo({ title: 'X', html: 'perché è così' }, { lessonTitle: 'L', idx: 0 }, via)], 'perche').length);
}

sezione('Il titolo pesa più del corpo');
{
  const titolato = R.docCapitolo({ title: 'La memoria di lavoro', html: 'una riga' }, { lessonTitle: 'L', idx: 5 }, via);
  const ripetuto = R.docCapitolo({ title: 'Altro', html: 'memoria memoria memoria memoria memoria' },
    { lessonTitle: 'L', idx: 0 }, via);
  /* ⚠️ Trenta e non tre: un capitolo che si INTITOLA «memoria di lavoro» è la
     risposta a quella domanda anche se un altro la nomina cinque volte di
     sfuggita. Con un peso piccolo finiva sotto, ed è il difetto che chi cerca
     legge come «la ricerca non funziona». */
  check('chi lo ha nel titolo viene prima', 'La memoria di lavoro',
    R.cerca([ripetuto, titolato], 'memoria')[0].d.title);
  check('a parità, l\'ordine è quello di lettura', [0, 1],
    R.cerca([
      R.docCapitolo({ title: 'B', html: 'x' }, { lessonTitle: 'L', idx: 1 }, via),
      R.docCapitolo({ title: 'A', html: 'x' }, { lessonTitle: 'L', idx: 0 }, via)
    ], 'x').map((r) => r.d.idx));
  check('e le lezioni si ordinano per nome', ['Anatomia', 'Zoologia'],
    R.cerca([
      R.docCapitolo({ title: 'z', html: 'x' }, { lessonTitle: 'Zoologia', idx: 0 }, via),
      R.docCapitolo({ title: 'a', html: 'x' }, { lessonTitle: 'Anatomia', idx: 0 }, via)
    ], 'x').map((r) => r.d.lessonTitle));

  const tanti = [];
  for (let i = 0; i < 60; i++) tanti.push(R.docCapitolo({ title: 'C' + i, html: 'ripetuta' }, { lessonTitle: 'L', idx: i }, via));
  check('l\'elenco si ferma a quaranta', 40, R.cerca(tanti, 'ripetuta').length);
  check('…e il tetto si può cambiare', 5, R.cerca(tanti, 'ripetuta', { max: 5 }).length);
}

sezione('Il frammento: acceso dov\'è, e senza HTML rotto');
{
  const d = R.docCapitolo({ title: 'T', html: 'la memoria di lavoro tiene poche cose insieme' },
    { lessonTitle: 'L', idx: 0 }, via);
  const r = R.cerca([d], 'memoria')[0];
  const f = R.frammento(r);
  check('il termine è acceso', true, f.indexOf('<mark>memoria</mark>') >= 0);
  check('e una volta sola', 1, f.split('<mark>').length - 1);

  /* ⚠️ Due termini in cui uno contiene l'altro: senza il salto di ciò che sta
     già dentro un `<mark>`, «memo» aprirebbe un marcatore dentro quello di
     «memoria» e l'HTML del frammento uscirebbe annidato e rotto. */
  const r2 = R.cerca([d], 'memoria memo')[0];
  const f2 = R.frammento(r2);
  check('termini sovrapposti non annidano i marcatori',
    f2.split('<mark>').length, f2.split('</mark>').length);
  check('e non compaiono marcatori dentro marcatori', false, /<mark>[^<]*<mark>/.test(f2));

  /* Il frammento finisce in `innerHTML`: l'escape è l'unica cosa che lo separa
     da un'iniezione, e il ripiego deve esserci anche senza `escHtml`. */
  const cattivo = R.docCapitolo({ title: 'T', html: 'prima <img src=x onerror=alert(1)> dopo bersaglio' },
    { lessonTitle: 'L', idx: 0 }, via);
  const fx = R.frammento(R.cerca([cattivo], 'bersaglio')[0]);
  check('niente tag vivi nel frammento', false, /<img|onerror/.test(fx));

  const lungo = 'ini ' + 'x '.repeat(200) + 'bersaglio ' + 'y '.repeat(200) + 'fine';
  const fl = R.frammento(R.cerca([R.docCapitolo({ title: 'T', html: lungo }, { lessonTitle: 'L', idx: 0 }, via)], 'bersaglio')[0]);
  check('un testo lungo si ritaglia attorno al risultato', true, fl.length < 240);
  check('e i puntini dicono che c\'è dell\'altro prima e dopo', [true, true],
    [fl.indexOf('…') === 0, fl.lastIndexOf('…') === fl.length - 1]);

  /* ⚠️ Il ritaglio si fa sul testo ORIGINALE con le posizioni trovate in quello
     normalizzato: se `sNorm` cambiasse lunghezza, qui il frammento comincerebbe
     spostato e il termine acceso non sarebbe quello trovato. */
  const acc = R.docCapitolo({ title: 'T', html: 'però la memòria è così, perché sì' }, { lessonTitle: 'L', idx: 0 }, via);
  const fa = R.frammento(R.cerca([acc], 'memoria')[0]);
  check('con gli accenti si accende la parola giusta', true, fa.indexOf('<mark>memòria</mark>') >= 0);
}

console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati') + ' (' + ok + ' ok)');
process.exit(ko ? 1 : 0);
