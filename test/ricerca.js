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

sezione('La normalizzazione preserva la lunghezza — anche per la «İ»');
{
  /* ⚠️ È la condizione che tiene in piedi `frammento`: le posizioni trovate nel
     testo normalizzato si usano per ritagliare il frammento dal testo
     ORIGINALE. Se `sNorm` togliesse o aggiungesse anche un solo carattere, il
     ritaglio partirebbe sfasato e il frammento comincerebbe a mezza parola.

     ⚠️ FRA IL 24 E IL 30 AGOSTO 2026 QUESTA SEZIONE DICHIARAVA UN LIMITE, e il
     titolo era «per le lettere che usiamo»: `toLowerCase()` non è uno a uno — la
     «İ» turca (U+0130) diventa DUE caratteri — e su un testo che la contiene il
     frammento della lente partiva sfasato di uno. L'aveva trovato la prova di
     `punto()`, scritta per l'editor degli appunti. Adesso `sNorm` abbassa
     carattere per carattere e la lunghezza torna: il limite non c'è più, e i
     controlli qui sotto lo tengono chiuso.
     ⚠️ `punto()` non dipendeva da questa proprietà nemmeno prima: mappa le
     posizioni una per una, apposta. Resta qui il suo controllo, perché è la
     prova che ha fatto emergere il caso. */
  const casi = ['perché', 'città', 'è così', 'l’altro', '“virgolette”', 'ñandù', 'ÀÈÌÒÙ'];
  for (const s of casi) check('«' + s + '» resta lunga uguale', s.length, R.sNorm(s).length);
  /* La lettera che allungava, misurata: una code unit dentro, una fuori. */
  check('anche la «İ» (U+0130) resta lunga uno', 1, R.sNorm('İ').length);
  check('e diventa una «i», quindi si trova cercandola', 'istanbul', R.sNorm('İstanbul'));
  /* ⚠️ IL CONTROLLO CHE VALE IL FIX: il frammento accende la parola cercata, non
     la parola meno la sua prima lettera. Con la normalizzazione più lunga
     dell'originale usciva «la m<mark>emoria</mark>». */
  check('e il frammento accende la parola intera, non da metà',
    'İstanbul e la <mark>memoria</mark>',
    R.frammento({ d: { text: 'İstanbul e la memoria' }, pos: 12, toks: ['memoria'], esatta: false }));
  check('lo stesso testo senza la «İ» si comporta identico',
    'Istanbul e la <mark>memoria</mark>',
    R.frammento({ d: { text: 'Istanbul e la memoria' }, pos: 12, toks: ['memoria'], esatta: false }));
  check('e `punto` non ci casca lo stesso', 'perielio',
    (() => { const t = 'İstanbul e il perielio'; const p = R.punto(t, R.interpreta('perielio'));
      return p ? t.slice(p.da, p.a) : null; })());
  check('gli accenti si appiattiscono', 'perche cosi citta', R.sNorm('Perché Così Città'));
  check('e le virgolette curve diventano dritte', '"l\'altro"', R.sNorm('“l’altro”'));
}

sezione('Le virgolette: «la parola così com\'è»');
{
  /* Cercando `per` si trovano anche *perché* e *periodo*: chi cercava la
     preposizione scorre venti risultati che non gli servono. `"per"` chiede i
     confini di parola. Questa funzione non cerca: dice che cosa è stato chiesto. */
  check('senza virgolette non è esatta', { testo: 'per', esatta: false }, R.interpreta('per'));
  check('fra virgolette dritte sì', { testo: 'per', esatta: true }, R.interpreta('"per"'));
  check('le spaziature attorno non contano', { testo: 'per', esatta: true }, R.interpreta('  " per "  '));
  /* Su una tastiera italiana la correzione automatica trasforma «"» in «“”»
     senza che chi scrive lo voglia: una regola che le rifiuta sembra rotta. */
  check('anche fra virgolette curve', { testo: 'sole', esatta: true }, R.interpreta('“sole”'));
  check('e fra caporali', { testo: 'sole', esatta: true }, R.interpreta('«sole»'));
  check('e fra apici singoli', { testo: 'sole', esatta: true }, R.interpreta("'sole'"));
  /* Una frase fra virgolette resta una frase: chi cerca la ricerca nel documento
     la trova come sequenza, e i confini valgono ai suoi due capi. */
  check('una frase fra virgolette resta la frase', { testo: 'sistema solare', esatta: true },
    R.interpreta('"sistema solare"'));

  /* ⚠️ Una virgoletta SPAIATA è uno che ha cominciato a scrivere: trattarla come
     esatta gli cambierebbe i risultati sotto le mani a metà digitazione. */
  check('una virgoletta aperta e non chiusa non è una richiesta', { testo: '"per', esatta: false },
    R.interpreta('"per'));
  check('né una chiusa senza apertura', { testo: 'per"', esatta: false }, R.interpreta('per"'));
  /* Due segni diversi non sono una coppia, anche se stanno ai due capi. */
  check('l\'apostrofo iniziale non fa coppia con la virgoletta finale',
    { testo: "'per\"", esatta: false }, R.interpreta("'per\""));
  check('virgolette vuote sono due segni, non una ricerca', { testo: '""', esatta: false },
    R.interpreta('""'));
  check('e una ricerca vuota resta vuota', { testo: '', esatta: false }, R.interpreta('   '));
  check('niente al posto della stringa non rompe niente', { testo: '', esatta: false },
    R.interpreta(null));
  /* Le virgolette DENTRO non si toccano: sono citazione, non richiesta. */
  check('le virgolette in mezzo restano nel testo',
    { testo: 'la "cosa" giusta', esatta: false }, R.interpreta('la "cosa" giusta'));
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

sezione('Le virgolette nella LENTE: la frase, e la parola intera');
{
  /* Senza virgolette la lente è larga: ogni parola è un termine e servono tutti,
     in qualunque punto. Fra virgolette la richiesta è UNA — quella frase, in
     quell'ordine — e con i confini di parola, come nella ricerca dentro il
     documento. Una convenzione con due significati non è una convenzione. */
  const insieme = R.docCapitolo({ title: 'A', html: 'il sistema solare è vasto' }, { lessonTitle: 'L', idx: 0 }, via);
  const sparsi = R.docCapitolo({ title: 'B', html: 'il sistema nervoso e l\'anno solare' }, { lessonTitle: 'L', idx: 1 }, via);
  check('senza virgolette bastano le due parole, dove capitano', ['A', 'B'],
    R.cerca([insieme, sparsi], 'sistema solare').map((r) => r.d.title).sort());
  check('fra virgolette serve la frase in quell\'ordine', ['A'],
    R.cerca([insieme, sparsi], '"sistema solare"').map((r) => r.d.title));

  /* I confini di parola: `per` sta dentro *perché* e *periodo*. */
  const dentro = R.docCapitolo({ title: 'Dentro', html: 'perché e periodo, personale' }, { lessonTitle: 'L', idx: 0 }, via);
  const sola = R.docCapitolo({ title: 'Sola', html: 'una cosa per volta' }, { lessonTitle: 'L', idx: 1 }, via);
  check('senza virgolette si trova anche dentro un\'altra parola', ['Dentro', 'Sola'],
    R.cerca([dentro, sola], 'per').map((r) => r.d.title).sort());
  check('fra virgolette no', ['Sola'], R.cerca([dentro, sola], '"per"').map((r) => r.d.title));

  /* ⚠️ L'apostrofo è un confine: «dell'acqua» contiene la parola «acqua», ed è
     la forma più comune in cui in italiano una parola sta attaccata a un'altra.
     Se non lo fosse, la ricerca esatta di una parola comune sembrerebbe rotta. */
  const apostrofo = R.docCapitolo({ title: 'Apostrofo', html: 'il livello dell\'acqua sale' }, { lessonTitle: 'L', idx: 0 }, via);
  check('l\'apostrofo è un confine di parola', ['Apostrofo'],
    R.cerca([apostrofo], '"acqua"').map((r) => r.d.title));

  /* Il punteggio conta soltanto le occorrenze VALIDE: contare anche i pezzi
     dentro altre parole farebbe vincere il documento che non ha risposto. */
  const misto = R.docCapitolo({ title: 'Misto', html: 'perché periodo persona per' }, { lessonTitle: 'L', idx: 0 }, via);
  check('e il punteggio conta solo le occorrenze intere', 1, R.cerca([misto], '"per"')[0].score);
  check('mentre senza virgolette le conta tutte', 4, R.cerca([misto], 'per')[0].score);

  /* Il peso del titolo vale con la stessa regola, o un titolo che contiene il
     termine dentro un'altra parola prenderebbe trenta punti non dovuti. */
  const titoloDentro = R.docCapitolo({ title: 'Periodico', html: 'testo per intero' }, { lessonTitle: 'L', idx: 0 }, via);
  check('nel titolo i trenta punti si prendono solo per la parola intera', 1,
    R.cerca([titoloDentro], '"per"')[0].score);

  /* Il frammento non accende ciò che la ricerca ha scartato: mostrarlo come
     risposta farebbe concludere che le virgolette non funzionano. */
  const f = R.frammento(R.cerca([misto], '"per"')[0]);
  check('nel frammento si accende una volta sola', 1, f.split('<mark>').length - 1);
  check('e non dentro «perché»', false, /<mark>per<\/mark>ché/.test(f));

  /* La richiesta viaggia col risultato: serve al frammento, e dice a chi legge
     il codice che quel risultato è nato da una ricerca esatta. */
  check('il risultato dichiara di essere esatto', [true, false],
    [R.cerca([sola], '"per"')[0].esatta, R.cerca([sola], 'per')[0].esatta]);

  /* Una frase fra virgolette che non c'è da nessuna parte non trova niente —
     e non ripiega sulla ricerca larga, che sarebbe rispondere un'altra domanda. */
  check('una frase che non c\'è non trova niente', [], R.cerca([insieme, sparsi], '"solare sistema"'));
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

sezione('Gli appunti entrano nell\'indice');
{
  /* ⚠️ Erano l'unica cosa che l'utente SCRIVE e non poteva rileggere cercando:
     la lente guardava i capitoli (nei corsi) o le pagine dei documenti (negli
     zaini), mai il quaderno. Chi cercava una frase che sapeva di aver scritto
     non la trovava, e non c'era modo di capire che era la lente a non guardare. */
  const n = { file: 'Pianeti rocciosi.md', title: 'Pianeti rocciosi',
    body: '# I quattro interni\n\nMercurio, Venere, Terra e Marte hanno una crosta solida.\n' };
  const d = R.docAppunto(n, 'Appunti', 3);
  check('il titolo si cerca', true, R.cerca([d], 'rocciosi').length === 1);
  check('e anche il corpo', true, R.cerca([d], 'crosta solida').length === 1);
  check('il risultato dice quale appunto aprire', 'Pianeti rocciosi.md', R.cerca([d], 'crosta')[0].d.appunto);
  check('e sotto quale intestazione raggrupparlo', 'Appunti', d.lessonTitle);
  check('il titolo dell\'appunto è quello della voce', 'Pianeti rocciosi', d.title);
  check('la posizione nell\'elenco è l\'ordine di parità', 3, d.idx);

  /* Il titolo pesa 30, come per i capitoli: un appunto che si INTITOLA come
     quello che cerchi è la risposta, anche se un altro lo nomina di sfuggita. */
  const altro = R.docAppunto({ file: 'Diario.md', title: 'Diario',
    body: 'rocciosi rocciosi rocciosi rocciosi' }, 'Appunti', 0);
  check('chi si intitola così viene prima', 'Pianeti rocciosi.md',
    R.cerca([altro, d], 'rocciosi')[0].d.appunto);

  /* Un appunto senza titolo nel frontmatter: il nome del file, senza `.md`. */
  const senza = R.docAppunto({ file: 'Appunti di classe.md', body: 'Zama e le guerre puniche.' }, 'Appunti', 0);
  check('senza titolo si usa il nome del file', 'Appunti di classe', senza.title);
  check('e resta cercabile', 1, R.cerca([senza], 'puniche').length);

  /* Un appunto vuoto non deve rompere l'indice: `body` assente è la condizione
     normale di un appunto appena creato. */
  const vuoto = R.docAppunto({ file: 'Nuovo.md', title: 'Nuovo' }, 'Appunti', 0);
  check('un appunto vuoto non rompe niente', 1, R.cerca([vuoto], 'nuovo').length);

  /* Capitoli, pagine e appunti convivono nello stesso indice: è una lente
     sola, e ognuno dei tre porta il campo che dice come aprirlo. */
  const cap = R.docCapitolo({ title: 'La memoria', html: '<p>rocciosi</p>' }, { lessonId: 'l1', lessonTitle: 'L', idx: 0 }, via);
  const pag = R.docPagina('01 Sistema solare.pdf', 'Sistema solare', { page: 4, text: 'pianeti rocciosi interni' });
  const misti = R.cerca([cap, pag, d], 'rocciosi');
  check('tre tipi di voce nello stesso indice', 3, misti.length);
  check('e ognuna dice come si apre', [true, true, true],
    [misti.some((r) => r.d.appunto), misti.some((r) => r.d.materiale), misti.some((r) => r.d.lessonId !== undefined)]);
}

sezione('Ogni fonte compare UNA VOLTA SOLA');
{
  /* ⚠️ Ordinando per punteggio puro le pagine di due documenti si alternavano, e
     siccome l'intestazione la scrive il renderer a ogni cambio di gruppo, lo
     stesso documento si presentava tre volte in dodici righe — misurato a schermo
     il 17 agosto. Adesso i gruppi sono contigui: dove va un gruppo lo decide il
     suo risultato MIGLIORE, non la somma (premierebbe il documento lungo) né la
     media (punirebbe quello che risponde benissimo in un punto solo). */
  const a1 = R.docPagina('01 A.pdf', 'Alfa', { page: 1, text: 'sole' });
  const a2 = R.docPagina('01 A.pdf', 'Alfa', { page: 2, text: 'sole sole sole' });
  const b1 = R.docPagina('02 B.pdf', 'Beta', { page: 1, text: 'sole sole' });
  const b2 = R.docPagina('02 B.pdf', 'Beta', { page: 2, text: 'sole' });
  const ord = R.cerca([a1, b1, a2, b2], 'sole');
  check('i risultati di una fonte stanno insieme', ['Alfa', 'Alfa', 'Beta', 'Beta'],
    ord.map((r) => r.d.lessonTitle));
  /* Alfa va davanti perché ha il risultato migliore (tre occorrenze in una
     pagina), anche se Beta ne ha di più in totale contando tutte le pagine. */
  check('e il gruppo col risultato migliore viene prima', 'Alfa', ord[0].d.lessonTitle);
  check('dentro il gruppo comanda la pertinenza', [2, 1], [ord[0].d.pagina, ord[1].d.pagina]);

  /* Gli appunti restano davanti a tutto: le due regole non si contendono niente,
     perché la prima riguarda il tipo e la seconda l'ordine dei gruppi. */
  const app = R.docAppunto({ file: 'Mio.md', title: 'Mio', body: 'sole' }, 'Appunti', 0);
  check('e gli appunti restano comunque in cima', ['Appunti', 'Alfa', 'Alfa', 'Beta', 'Beta'],
    R.cerca([a1, b1, app, a2, b2], 'sole').map((r) => r.d.lessonTitle));

  /* La prova che conta per chi legge: nessuna intestazione si ripete, cioè
     nessun gruppo torna dopo essere già comparso. */
  const gruppi = R.cerca([a1, b1, a2, b2, app], 'sole').map((r) => r.d.lessonTitle);
  const intestazioni = gruppi.filter((g, i) => g !== gruppi[i - 1]);
  check('nessuna intestazione compare due volte', intestazioni.length, new Set(intestazioni).size);
}

sezione('Gli appunti sono la PRIMA sezione dell\'elenco');
{
  /* ⚠️ Ciò che l'utente ha scritto viene prima di ciò che ha letto, e viene
     prima anche col punteggio più basso. Il motivo non è di gusto: l'elenco
     scrive un'intestazione ogni volta che `lessonTitle` cambia, e un appunto
     piazzato a metà classifica spezzava in due il documento attorno a lui —
     la stessa fonte compariva sotto due intestazioni identiche, come se
     fossero due cose diverse. */
  const capForte = R.docCapitolo({ title: 'Il Sole e il Sole', html: '<p>' + 'sole '.repeat(30) + '</p>' },
    { lessonId: 'l1', lessonTitle: 'Sistema solare', idx: 0 }, via);
  const appDebole = R.docAppunto({ file: 'Generali.md', title: 'Generali', body: 'una riga sul sole' }, 'Appunti', 0);
  check('un appunto debole batte un capitolo fortissimo', 'Generali.md',
    R.cerca([capForte, appDebole], 'sole')[0].d.appunto);

  const pagForte = R.docPagina('01 Sistema solare.pdf', 'Sistema solare',
    { page: 2, text: 'sole sole sole sole sole' });
  check('e batte anche una pagina di documento', 'Generali.md',
    R.cerca([pagForte, appDebole], 'sole')[0].d.appunto);

  /* ⚠️ Gli appunti stanno TUTTI davanti, non solo il primo: se ne restasse uno
     indietro l'elenco avrebbe due sezioni «Appunti», che è esattamente il
     difetto che si sta togliendo. La prova guarda la forma dell'elenco intero —
     un blocco di appunti e poi il resto — non la posizione di una voce sola. */
  const appAltro = R.docAppunto({ file: 'Diario.md', title: 'Diario', body: 'ancora sole' }, 'Appunti', 1);
  const forma = R.cerca([capForte, appDebole, pagForte, appAltro], 'sole').map((r) => !!r.d.appunto);
  check('prima gli appunti, poi tutto il resto', [true, true, false, false], forma);
  check('e nessuno si perde per strada', 4, forma.length);

  /* ⚠️ L'ordine si decide PRIMA del taglio a `max`: un appunto quarantunesimo
     per punteggio, tagliato via, sarebbe «primo» in un elenco in cui non c'è. */
  const folla = [R.docAppunto({ file: 'Ultimo.md', title: 'Ultimo', body: 'ripetuta una volta' }, 'Appunti', 0)];
  for (let i = 0; i < 60; i++) {
    folla.push(R.docCapitolo({ title: 'ripetuta ' + i, html: '<p>' + 'ripetuta '.repeat(10) + '</p>' },
      { lessonTitle: 'L', idx: i }, via));
  }
  const tagliata = R.cerca(folla, 'ripetuta');
  check('l\'appunto c\'è anche quando i capitoli riempiono l\'elenco', 'Ultimo.md', tagliata[0].d.appunto);
  check('e il tetto resta quello', 40, tagliata.length);
}

sezione('⭐ DOVE sta la parola: la posizione nel testo GREZZO');
/* Serve all'editor degli appunti: la lente promette «ti porto dove l'ho
   trovato», e finché non sa dire il PUNTO mantiene quella promessa solo sul
   PDF. `occorrenze` risponde nel testo normalizzato, che è la forma su cui si
   cerca; `punto` risponde in quello vero, che è la forma in cui si scrive. */
check('trova la parola in mezzo al testo', { da: 3, a: 11 },
  R.punto('il perielio è vicino', R.interpreta('perielio')));
check('e anche quando comincia al primo carattere', { da: 0, a: 8 },
  R.punto('perielio, subito', R.interpreta('perielio')));
/* ⚠️ IL VALORE D'ORO, e la terza volta che questo progetto lo scrive (dopo
   `aspetto/stanza.js` e `fonti/pagina.js`): `null` NON È 0. «Non ho trovato
   niente» e «l'occorrenza comincia al primo carattere» sono due cose diverse, e
   confonderle vuol dire aprire un appunto in cima facendo credere a chi cerca
   di essere arrivato. */
check('quello che non c\'è dà «niente», non zero', null,
  R.punto('niente di simile qui', R.interpreta('perielio')));
check('e «niente» si distingue da «al primo carattere»', true,
  R.punto('niente', R.interpreta('zzz')) === null && R.punto('zzz', R.interpreta('zzz')).da === 0);

sezione('Il punto segue le stesse convenzioni della lente');
/* ⚠️ Se qui si usasse un `indexOf` crudo, l'editor troverebbe cose DIVERSE da
   quelle che ha trovato la lente: cercando `pero` non porterebbe su «però», e
   l'appunto si aprirebbe in cima proprio nel caso in cui la lente ha appena
   detto che la parola c'è. Una convenzione con due significati non è una
   convenzione. */
check('gli accenti sono appiattiti, come nella ricerca', { da: 4, a: 8 },
  R.punto('era però vero', R.interpreta('pero')));
check('e le maiuscole non contano', { da: 0, a: 8 },
  R.punto('Perielio grande', R.interpreta('perielio')));
/* Le virgolette chiedono la parola INTERA, qui come dappertutto. */
check('senza virgolette si trova anche dentro un\'altra parola', { da: 0, a: 3 },
  R.punto('perché no', R.interpreta('per')));
check('con le virgolette no', null, R.punto('perché no', R.interpreta('"per"')));
check('e la parola intera si trova lo stesso', { da: 7, a: 10 },
  R.punto('perché per primo', R.interpreta('"per"')));
/* ⚠️ L'apostrofo è un confine: `"acqua"` deve trovarsi in «dell'acqua», che in
   italiano è la forma più comune in cui una parola compare attaccata. */
check('l\'apostrofo è un confine', { da: 5, a: 10 },
  R.punto("dell'acqua fresca", R.interpreta('"acqua"')));

sezione('Le posizioni si mappano, non si suppongono');
/* ⚠️ `sNorm` SEMBRA conservare la lunghezza — un accento diventa una lettera,
   una virgoletta curva una dritta — ma `toLowerCase()` no: la «İ» (U+0130)
   diventa DUE caratteri, e da lì in poi ogni indice sarebbe spostato di uno.
   Su un testo che la contiene il cursore cadrebbe a mezza parola, e nessuno
   saprebbe perché. Questo controllo esiste per quella riga di codice. */
const conI = 'İ poi perielio';
check('un carattere che si allunga non sposta il punto', 'perielio',
  (() => { const p = R.punto(conI, R.interpreta('perielio')); return p ? conI.slice(p.da, p.a) : null; })());
/* E il caso normale resta esatto: la fetta ritagliata è la parola. */
check('la fetta ritagliata è esattamente la parola', 'perielio',
  (() => { const t = 'il perielio è vicino'; const p = R.punto(t, R.interpreta('perielio'));
    return t.slice(p.da, p.a); })());
check('anche con l\'accento nel mezzo', 'però',
  (() => { const t = 'era però vero'; const p = R.punto(t, R.interpreta('pero'));
    return t.slice(p.da, p.a); })());

sezione('E i casi storti non inventano una posizione');
check('un testo vuoto', null, R.punto('', R.interpreta('x')));
check('un termine vuoto', null, R.punto('qualcosa', R.interpreta('')));
check('solo spazi', null, R.punto('qualcosa', R.interpreta('   ')));
check('niente del tutto', null, R.punto(null, null));
check('virgolette vuote non sono una richiesta', null, R.punto('qualcosa', R.interpreta('""')));

sezione('Q5 — la lente vede anche le MAPPE e le DIDASCALIE');
{
  /* ⚠️ I nodi di mappa e le didascalie sono l'altro testo che l'utente ha
     SCRITTO, e la lente non li vedeva. Il principio era già dichiarato dentro
     questo modulo — «quello che hai scritto tu viene prima di quello che hai
     letto» — e loro stavano dalla stessa parte di quella linea restandone
     fuori. */
  const nodo = R.docNodoMappa({ id: 'n7', testo: 'perielio', nota: 'il punto più vicino al Sole' },
    { file: 'Sistema solare.json', titolo: 'Il sistema solare' }, 3);
  check('il nodo porta con sé dove tornare', ['Sistema solare.json', 'n7'], [nodo.mappa, nodo.nodo]);
  check('il gruppo è il titolo della mappa', 'Il sistema solare', nodo.lessonTitle);
  /* ⚠️ Nel testo cercabile entra anche la NOTA: è la frase attorno da cui il
     nodo è nato, e chi cerca la ricorda com'era, non come l'ha accorciata. */
  check('si trova per il testo del nodo', 1, R.cerca([nodo], 'perielio').length);
  check('e anche per la frase attorno', 1, R.cerca([nodo], 'vicino al Sole').length);
  check('il titolo pesa: è il testo del nodo', true, R.cerca([nodo], 'perielio')[0].score >= 30);

  const rit = R.docRitaglio({ id: 'a1b2c3', didascalia: 'schema del perielio', origine: 'ritaglio' }, 1);
  check('il ritaglio porta il suo id', 'a1b2c3', rit.album);
  check('e il gruppo dice quale delle due viste', 'Ritagli', rit.lessonTitle);
  check('una FOTO lo dice a sua volta', 'Album Foto',
    R.docRitaglio({ id: 'x', didascalia: 'la lavagna', origine: 'foto' }, 0).lessonTitle);
  check('si trova per la didascalia', 1, R.cerca([rit], 'perielio').length);
  /* ⚠️ Il nome del file NON entra nel testo cercabile: `a1b2c3.png` è un
     dettaglio tecnico, e cercarci dentro darebbe risposte che nessuno
     riconosce. */
  check('ma non per il nome del file', 0, R.cerca([rit], 'a1b2c3').length);

  /* ⚠️ L'ORDINE DEI GRUPPI È UNA PROMESSA, non un caso: prima ciò che l'utente
     ha scritto — appunti, poi mappe, poi didascalie — e dopo ciò che ha letto.
     Gli appunti restano primi perché sono prosa, cioè il posto dove una frase
     si ritrova per intero; le didascalie ultime perché sono una riga sola. */
  const misti = [
    R.docPagina('03 dispensa.pdf', 'Dispensa', { page: 4, text: 'il perielio di Mercurio' }),
    R.docRitaglio({ id: 'z', didascalia: 'perielio', origine: 'ritaglio' }, 0),
    R.docNodoMappa({ id: 'n1', testo: 'perielio' }, { file: 'm.json', titolo: 'Orbite' }, 0),
    R.docAppunto({ file: 'n.md', title: 'Appunto', body: 'perielio' }, 'Appunti', 0)
  ];
  check('appunti, mappe, ritagli, e infine ciò che si è letto',
    ['Appunti', 'Orbite', 'Ritagli', 'Dispensa'],
    R.cerca(misti, 'perielio').map((x) => x.d.lessonTitle));
  /* ⚠️ E vale anche col punteggio ROVESCIATO: la pagina qui nomina il termine
     una volta come gli altri, ma se ne avesse dieci resterebbe comunque ultima.
     «Prima ciò che hai scritto» non è «prima se vince». */
  const forte = R.docPagina('03 dispensa.pdf', 'Dispensa',
    { page: 4, text: 'perielio perielio perielio perielio perielio' });
  check('anche quando ciò che si è letto vince per punteggio',
    ['Appunti', 'Orbite', 'Ritagli', 'Dispensa'],
    R.cerca([forte, misti[1], misti[2], misti[3]], 'perielio').map((x) => x.d.lessonTitle));

  /* ⚠️ QUALE GRAFO VINCE (`docsMappe`). Fino al 30 agosto 2026 nell'indice
     entravano i nodi della sola mappa APERTA: di tutte le altre c'era il
     titolo e basta. Il difetto era invisibile — nessun errore, nessun vuoto:
     semplicemente una parola scritta in un nodo di una mappa chiusa non si
     trovava, e chi cercava concludeva di non averla mai scritta. */
  const dueMappe = [
    { file: 'Orbite.json', titolo: 'Orbite', nodi: [{ id: 'n1', testo: 'perielio' }] },
    { file: 'Pianeti.json', titolo: 'Pianeti', nodi: [{ id: 'n2', testo: 'rocciosi' }] }
  ];
  /* ⚠️ Si guarda il TITOLO delle voci, non il gruppo: col codice di prima il
     gruppo era identico — le mappe entravano lo stesso, col loro titolo — e una
     prova sul gruppo sarebbe rimasta verde davanti al difetto che descrive. */
  check('di una mappa CHIUSA entrano i NODI, non il suo titolo', ['perielio', 'rocciosi'],
    R.docsMappe(dueMappe, {}).map((d) => d.title));
  check('e si trovano cercandoli', 1, R.cerca(R.docsMappe(dueMappe, {}), 'rocciosi').length);

  /* ⚠️ La mappa aperta vince sul disco: in memoria c'è anche quello che non è
     ancora salvato, e cercare nella copia salvata vorrebbe dire non trovare il
     nodo scritto un minuto fa. */
  const conAperta = R.docsMappe(dueMappe, {
    aperta: { file: 'Orbite.json', nodi: [{ id: 'n1', testo: 'perielio' }, { id: 'n9', testo: 'afelio' }] }
  });
  check('la mappa aperta vince sul disco', 1, R.cerca(conAperta, 'afelio').length);
  check('e le altre restano quelle del disco', 1, R.cerca(conAperta, 'rocciosi').length);

  /* Una mappa senza nodi non sparisce: entra col titolo, o non la si potrebbe
     nemmeno trovare per aprirla. */
  check('una mappa vuota entra col suo titolo', 1,
    R.cerca(R.docsMappe([{ file: 'Vuota.json', titolo: 'Da fare', nodi: [] }], {}), 'da fare').length);
  check('una mappa illeggibile non entra affatto', 0,
    R.docsMappe([{ file: 'Rotta.json', titolo: 'Rotta', errore: 'JSON non valido' }], {}).length);

  /* Il sommario leggero della tendina porta `nodi` come NUMERO: si degrada al
     titolo, che è ciò che la lente sapeva fare prima e continua a bastare. */
  check('un elenco leggero (nodi = un numero) si degrada al titolo', ['Orbite'],
    R.docsMappe([{ file: 'Orbite.json', titolo: 'Orbite', nodi: 12 }], {}).map((d) => d.title));

  /* ⚠️ Mappa aperta ma grafo non ancora caricato: si cade sul DISCO, non sul
     niente — altrimenti proprio la mappa che si sta guardando sparirebbe dalla
     lente per la frazione di secondo in cui si apre. */
  check('la mappa aperta senza grafo cade sul disco', 1,
    R.cerca(R.docsMappe(dueMappe, { aperta: { file: 'Orbite.json', nodi: null } }), 'perielio').length);

  /* Il rango è una funzione a sé perché è una DECISIONE, e si prova come tale. */
  check('il rango mette in fila le quattro nature', [0, 1, 2, 3],
    [misti[3], misti[2], misti[1], misti[0]].map(R.rango));
  check('e una voce che non è niente di tutto ciò va in fondo', 9, R.rango(null));
}

console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati') + ' (' + ok + ' ok)');
process.exit(ko ? 1 : 0);
