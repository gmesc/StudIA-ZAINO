/* I richiami di nota: `[^1]` nel testo, `[^1]: …` in fondo al capitolo.
 *
 * Che cosa si prova qui: che il numeretto nel testo sia diventato un'ancora e
 * non un apice colorato, che il suo bersaglio esista davvero nel riquadro in
 * fondo, che dalla nota si possa tornare al punto da cui si era saltati, e che
 * gli id non collidano — fra due note, fra due capitoli, fra due rese dello
 * stesso capitolo.
 *
 * ⚠️ Il difetto da cui nasce questo file, misurato l'11 agosto 2026 provando
 * l'app: il numeretto era `<sup class="fnref">1</sup>` e basta. Il foglio di
 * stile lo colorava d'accento, quindi sembrava un link — e non lo era: chi lo
 * premeva restava dov'era. I link DENTRO le definizioni in fondo funzionavano,
 * il che rendeva la cosa ancora più difficile da credere.
 *
 * ⚠️ Il parser NON è una copia: è `App/assets/lettura/capitolo.js`, lo STESSO
 * modulo che carica l'app. Vale qui la nota che sta in testa a `test/figure.js`.
 */
const RP = require('../lib/reader-parser.js');

let ko = 0, ok = 0;
function check(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { ok++; return; }
  ko++;
  console.log('  ✗ ' + nome + '\n      atteso: ' + a + '\n      avuto:  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

const P = RP.load({ pdfByNum: { '03': '03 La disortografia - Galton.pdf' }, mediaByNum: {} });

/** Un capitolo scritto come li scrive il generatore, con le note in fondo. */
function capitolo(contenuto, note, breve) {
  return ['---', 'title: "Un capitolo"', '---', '',
    '## In breve', (breve || 'Testo breve.'), '',
    '## Contenuto', contenuto, '',
    '## Punti chiave', '- un punto', ''
  ].concat(note || []).join('\n');
}
/** Gli id che compaiono nell'HTML, in ordine: è su questi che si misura la
 *  stabilità fra due rese e la non collisione fra due capitoli. */
function idDi(html) { return (html.match(/id="[^"]+"/g) || []).map((s) => s.slice(4, -1)); }

sezione('Il numeretto nel testo è un\'ancora, non un apice colorato');
{
  const cap = P.mdChapter(capitolo('La diagnosi è una cosa seria.[^1]', ['[^1]: Consensus Conference, 2011.']), '01-fondamenti', 3);

  check('il richiamo è dentro un link', true, /<sup class="fnref"><a /.test(cap.html));
  check('e il link punta alla nota del suo capitolo', true,
    cap.html.indexOf('href="#nota-01-fondamenti-c03-1"') > 0);
  /* ⚠️ Il salto vero non lo fa l'`href`: lo fa il gestore delegato del renderer,
     perché nel banco a scorrere è `.bcorpo` e non la pagina. Il bersaglio glielo
     dice `data-nota`, e se sparisse il click smetterebbe di fare qualcosa senza
     che nulla lo dica. */
  check('e lo dice anche al gestore del salto', true,
    cap.html.indexOf('data-nota="nota-01-fondamenti-c03-1"') > 0);
  check('il ruolo dice che cos\'è a chi legge con la voce', true, /role="doc-noteref"/.test(cap.html));
  check('e ha un nome che si può leggere ad alta voce', true, /aria-label="Vai alla nota 1"/.test(cap.html));
  check('il numero resta quello che si vede', true, />1<\/a><\/sup>/.test(cap.html));
  /* La classe `fnref` regge il colore e la lettura vocale che salta i richiami
     (`TTS_SALTA_TESTO`): toglierla farebbe leggere «uno» in mezzo alla frase. */
  check('la classe di prima resta dov\'era', true, /<sup class="fnref">/.test(cap.html));

  const bersaglio = 'id="nota-01-fondamenti-c03-1"';
  check('il bersaglio esiste davvero, nel riquadro in fondo', true, cap.html.indexOf(bersaglio) > 0);
  check('ed è la voce dell\'elenco, non il riquadro', true,
    cap.html.indexOf('<li ' + bersaglio) > 0);
  check('marcata come nota di fine testo', true, /role="doc-endnote"/.test(cap.html));
  check('e raggiungibile dal fuoco, per chi arriva col salto', true,
    /<li id="nota-01-fondamenti-c03-1" role="doc-endnote" tabindex="-1">/.test(cap.html));
  check('il riquadro in fondo è rimasto quello di prima', true,
    /<div class="fnotes"><b>Note<\/b><ol>/.test(cap.html));
  check('e il testo della nota è ancora reso come markdown', true,
    cap.html.indexOf('Consensus Conference, 2011.') > 0);
}

sezione('Dalla nota si torna al punto del testo');
{
  const cap = P.mdChapter(capitolo('Una frase.[^1]', ['[^1]: La fonte.']), '01-fondamenti', 3);
  check('il richiamo nel testo ha un id a cui tornare', true,
    cap.html.indexOf('<a id="rif-01-fondamenti-c03-1"') > 0);
  check('e la nota porta la freccia che ci riporta', true,
    cap.html.indexOf('<a href="#rif-01-fondamenti-c03-1" class="fnback"') > 0);
  check('col ruolo giusto e un nome sensato', true,
    /role="doc-backlink" aria-label="Torna al richiamo della nota 1"/.test(cap.html));

  /* ⚠️ Una nota definita e MAI richiamata non deve avere la freccia: punterebbe
     a un id che nel testo non esiste, e il click non farebbe niente — cioè
     esattamente il difetto da cui si è partiti, spostato in fondo alla pagina. */
  const orfana = P.mdChapter(capitolo('Nessun richiamo qui.', ['[^9]: Definita e mai citata.']), '01-fondamenti', 3);
  check('la nota mai richiamata resta senza freccia', false, /fnback/.test(orfana.html));
  check('ma la sua voce c\'è lo stesso', true, orfana.html.indexOf('Definita e mai citata.') > 0);
}

sezione('Due note diverse non si pestano i piedi');
{
  const cap = P.mdChapter(capitolo('Prima.[^1] Seconda.[^2]',
    ['[^1]: Fonte uno.', '[^2]: Fonte due.']), '01-fondamenti', 3);
  const ids = idDi(cap.html);
  check('ogni id compare una volta sola', ids.length, new Set(ids).size);
  check('e sono i quattro che servono',
    ['rif-01-fondamenti-c03-1', 'rif-01-fondamenti-c03-2', 'nota-01-fondamenti-c03-1', 'nota-01-fondamenti-c03-2'], ids);
  check('la prima nota punta alla prima voce', true, cap.html.indexOf('href="#nota-01-fondamenti-c03-1"') > 0);
  check('la seconda alla seconda', true, cap.html.indexOf('href="#nota-01-fondamenti-c03-2"') > 0);

  /* Le etichette non sono per forza numeri: `[^fonte]` è markdown legittimo, e
     il numero che si vede è quello che conta l'`<ol>`, non l'etichetta. */
  const lettere = P.mdChapter(capitolo('Detto.[^fonte]', ['[^fonte]: Un libro.']), '01-fondamenti', 3);
  check('anche un\'etichetta a parole si ritrova', true,
    lettere.html.indexOf('href="#nota-01-fondamenti-c03-fonte"') > 0 &&
    lettere.html.indexOf('id="nota-01-fondamenti-c03-fonte"') > 0);

  /* ⚠️ Lo stesso `[^1]` può comparire due volte nel testo. Due id uguali e il
     salto della freccia finirebbe sempre sul primo: la prima volta tiene l'id
     pulito, le altre si numerano dietro. */
  const due = P.mdChapter(capitolo('Prima.[^1] E poi ancora.[^1]', ['[^1]: Fonte uno.']), '01-fondamenti', 3);
  const idsDue = idDi(due.html);
  check('lo stesso richiamo due volte non duplica gli id', idsDue.length, new Set(idsDue).size);
  check('la seconda volta si numera dietro', true, idsDue.indexOf('rif-01-fondamenti-c03-1-2') >= 0);
  check('e la freccia torna alla PRIMA delle due', true,
    due.html.indexOf('<a href="#rif-01-fondamenti-c03-1" class="fnback"') > 0);
}

sezione('Un richiamo senza definizione non produce un\'ancora rotta');
{
  const cap = P.mdChapter(capitolo('Una frase.[^7]', []), '01-fondamenti', 3);
  check('il richiamo resta il numeretto muto di prima', true, /<sup class="fnref">7<\/sup>/.test(cap.html));
  check('nessun link che non porta da nessuna parte', false, /fnsalta|nota-01-fondamenti-c03-7/.test(cap.html));
  check('e senza note non nasce nessun riquadro', false, /fnotes/.test(cap.html));

  /* Il caso misto: una nota c'è, l'altra no. Quella che c'è deve saltare lo
     stesso — un difetto in una nota non deve rompere le sue vicine. */
  const misto = P.mdChapter(capitolo('Prima.[^1] Seconda.[^2]', ['[^1]: Solo questa è definita.']), '01-fondamenti', 3);
  check('la nota definita salta', true, misto.html.indexOf('href="#nota-01-fondamenti-c03-1"') > 0);
  check('quella non definita resta muta', true, /<sup class="fnref">2<\/sup>/.test(misto.html));
}

sezione('Gli id sono gli stessi fra due rese dello stesso capitolo');
{
  /* ⚠️ Questo è il controllo che tiene ferma la scelta: gli id nascono dall'ID
     DEL CAPITOLO, non da un contatore di resa. Il testo delle note passa anche
     dalla stampa e dagli appunti: un id che cambia a ogni resa farebbe puntare
     al vuoto i rimandi di una pagina già stampata. */
  const md = capitolo('Prima.[^1] Seconda.[^2]', ['[^1]: Fonte uno.', '[^2]: Fonte due.']);
  const a = P.mdChapter(md, '01-fondamenti', 3);
  const b = P.mdChapter(md, '01-fondamenti', 3);
  check('due rese danno esattamente gli stessi id', idDi(a.html), idDi(b.html));
  check('e in generale lo stesso HTML', a.html, b.html);
  check('l\'id del capitolo è quello che si è sempre scritto', '01-fondamenti-c03', a.id);
  check('e le note lo portano dentro', true, idDi(a.html).every((x) => x.indexOf('01-fondamenti-c03') > 0));
}

sezione('Le note di due capitoli diversi non collidono');
{
  const md = capitolo('Una frase.[^1]', ['[^1]: La fonte.']);
  const uno = P.mdChapter(md, '01-fondamenti', 3);
  const due = P.mdChapter(md, '01-fondamenti', 4);
  const altra = P.mdChapter(md, '02-strumenti', 3);
  check('stesso testo, capitolo diverso: id diversi', 0,
    idDi(uno.html).filter((x) => idDi(due.html).indexOf(x) >= 0).length);
  check('e lezione diversa lo stesso', 0,
    idDi(uno.html).filter((x) => idDi(altra.html).indexOf(x) >= 0).length);

  /* ⚠️ `nota-…` e non `note-…`: `note-<capId>-<n>` è già l'id dei bottoni del
     riquadro «Note e materiali» del renderer. Due elementi con lo stesso id
     nella stessa pagina e `getElementById` ne trova uno solo. */
  check('nessun id calpesta quelli del riquadro «Note e materiali»', false,
    idDi(uno.html).some((x) => x.indexOf('note-') === 0));

  /* Un nome di lezione scritto a mano può contenere spazi: dentro un id
     spezzerebbero il selettore, e il salto morirebbe per un motivo che con le
     note non c'entra niente. */
  const storta = P.mdChapter(md, 'lezione a mano', 1);
  check('un id con spazi non arriva mai nell\'attributo', false, /id="[^"]* /.test(storta.html));
  check('e le due metà del salto restano d\'accordo', true,
    storta.html.indexOf('href="#nota-lezione-a-mano-c01-1"') > 0 &&
    storta.html.indexOf('id="nota-lezione-a-mano-c01-1"') > 0);
}

sezione('Il resto della resa non si accorge di niente');
{
  /* Iso-comportamento: fuori da un capitolo — gli appunti, un frammento reso a
     mano — non c'è nessuna nota a cui saltare, e il richiamo resta com'era. */
  check('senza capitolo il richiamo è il <sup> di sempre',
    '<p>Una frase.<sup class="fnref">1</sup></p>', P.mdToHtml('Una frase.[^1]'));
  check('e nemmeno in linea nasce un link', '<sup class="fnref">1</sup>', P._mdInline('[^1]'));

  /* Ma il contesto si può passare anche fuori da `mdChapter`: è il gancio con
     cui il renderer potrà un giorno rendere un pezzo di capitolo per conto suo. */
  const ctx = P.notaContesto('01-x-c01', ['1']);
  check('col contesto, invece, il link c\'è', true,
    P._mdInline('[^1]', ctx).indexOf('href="#nota-01-x-c01-1"') > 0);

  /* Un capitolo SENZA note deve restare identico a com'era: nessun riquadro,
     nessun attributo in più, nessuna riga vuota di troppo. */
  const pulito = P.mdChapter(capitolo('Testo semplice, con un [rimando](pdf:03#p=7).', []), '01-fondamenti', 1);
  check('un capitolo senza note non guadagna niente', '<p>Testo semplice, con un <a href="#" class="plink" data-file="03 La disortografia - Galton.pdf" data-page="7" data-label="rimando">rimando</a>.</p>', pulito.html);

  /* I link dentro le definizioni funzionavano già prima del difetto, ed è la
     ragione per cui il difetto si vedeva: devono continuare a funzionare. */
  const conLink = P.mdChapter(capitolo('Una frase.[^1]', ['[^1]: Vedi [p. 7](pdf:03#p=7).']), '01-fondamenti', 1);
  check('i link dentro le note continuano a funzionare', true,
    /<li id="nota-01-fondamenti-c01-1"[^>]*>Vedi <a href="#" class="plink" data-file="03 La disortografia - Galton\.pdf" data-page="7"/.test(conLink.html));

  /* Un richiamo scritto in «In breve» salta alla stessa voce in fondo: sono la
     stessa pagina, e due contatori separati darebbero due id uguali. */
  const breve = P.mdChapter(capitolo('Nel contenuto.[^1]', ['[^1]: La fonte.'], 'Già nel sommario.[^1]'), '01-fondamenti', 1);
  const idsBreve = idDi(breve.brief).concat(idDi(breve.html));
  check('sommario e contenuto non si danno lo stesso id', idsBreve.length, new Set(idsBreve).size);
  check('e il richiamo del sommario punta alla voce vera', true,
    breve.brief.indexOf('href="#nota-01-fondamenti-c01-1"') > 0);
}

console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti  (' + (ok + ko) + ' controlli)'
                        : '✓ tutto verde  (' + ok + ' controlli)'));
process.exit(ko ? 1 : 0);
