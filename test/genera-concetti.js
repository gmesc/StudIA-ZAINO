'use strict';
/**
 * Test delle MAPPE CONCETTUALI generate: `estrai`, `daLezione`, `daCorso`.
 *
 * Non prova che il codice giri: prova le promesse su cui si regge la vista
 * generata dopo il §13 del piano — che i nodi siano concetti presi dai
 * paragrafi e non i contenitori dei callout, che due occorrenze della stessa
 * cosa diventino un nodo solo *e non una di più*, che ogni concetto sappia da
 * dove viene, e che le leve del ⚙ (soglia, tetto, fonti) cambino davvero la
 * mappa invece di stare lì per bellezza.
 *
 * Metà dei controlli gira su un capitolo finto, perché lì l'atteso si può
 * scrivere per esteso; l'altra metà sul CORPUS VERO (TD74-DSA, 210 capitoli in
 * 16 lezioni), perché l'identità dei concetti è un problema che si vede solo
 * su un testo vero: su due paragrafi inventati qualunque normalizzazione
 * sembra giusta. Il corpus si legge e basta — l'ultimo controllo verifica che
 * nemmeno un byte del corso sia cambiato.
 *
 *   node test/genera-concetti.js
 */

const fs = require('fs');
const path = require('path');
const G = require('../App/assets/mappa/genera');
const rp = require('../lib/reader-parser');
const corsiLib = require('../lib/corsi');
const espandi = require('../lib/espandi');
const mat = require('../lib/materiali');

let ko = 0, ok = 0;
function check(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { ok++; return; }
  ko++;
  console.log('  ✗ ' + nome + '\n      atteso: ' + a + '\n      avuto:  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

/* Il controllo che vale per tutte: costruire una mappa non deve toccare il
   materiale da cui la si costruisce. */
function puro(nome, ingresso, fn) {
  const prima = JSON.stringify(ingresso);
  fn(ingresso);
  check('l\'ingresso resta intatto — ' + nome, prima, JSON.stringify(ingresso));
}

/** Le tre cose che, sbagliate, non si vedono a schermo ma rompono la mappa. */
function integra(nome, m) {
  const ids = new Set(m.nodi.map((n) => n.id));
  check(nome + ': ogni nodo ha un id', 0, m.nodi.filter((n) => !n.id).length);
  check(nome + ': nessun id ripetuto', m.nodi.length, ids.size);
  check(nome + ': nessun arco con un capo mancante', 0,
    m.archi.filter((a) => !ids.has(a.da) || !ids.has(a.a)).length);
  check(nome + ': nessun cappio', 0, m.archi.filter((a) => a.da === a.a).length);
  check(nome + ': nessun arco in doppio', 0, (() => {
    const visti = new Set(); let d = 0;
    m.archi.forEach((a) => { const k = a.da + '>' + a.a; if (visti.has(k)) d++; visti.add(k); });
    return d;
  })());
}

/* ==========================================================================
   1. UN CAPITOLO FINTO — l'estrazione, riga per riga

   Il capitolo arriva come lo consegna il parser del lettore (`mdChapter`):
   HTML già reso, glossario a parte, i rimandi del frontmatter già risolti.
   ========================================================================== */

function capUno() {
  return {
    title: 'La lettura strumentale',
    brief: '<p>Leggere non è capire.</p>',
    html:
      '<p><strong>La modularità.</strong> Il sistema di lettura è fatto di moduli: la ' +
      '<strong>via lessicale</strong> e la <strong>via fonologica</strong> lavorano insieme. ' +
      '<a href="#" class="vlink" data-file="05 lez.mp4" data-t="132" data-label="vai a 2:12">vai a 2:12</a></p>' +
      '<p>Nei <strong>tempi</strong> di lettura si misura la <strong>velocità</strong>, ' +
      'e la <strong>modularità</strong> torna qui.</p>' +
      '<p><strong>Una frase messa in grassetto che non è affatto un concetto ma un enunciato intero</strong></p>',
    keypoints: ['La lettura è modulare'],
    glossary: [
      { t: 'Via lessicale', d: 'Accesso diretto alla forma della parola; si oppone alla via fonologica.' },
      { t: 'Metacognizione', d: 'Consapevolezza dei propri processi.' }
    ],
    videoRefs: [{ video: '05 lez.mp4', t: 132, label: 'I due moduli della lettura' }],
    sources: [{ pdf: '03 disp.pdf', page: 21, label: 'La velocità di lettura' }]
  };
}

sezione('estrai — i nodi sono i concetti del testo, non le scatole del capitolo');
{
  const e = G.estrai(capUno(), { indice: 0 });
  const per = (t) => e.concetti.find((c) => c.chiave === t);

  check('i concetti sono le parole importanti dell\'autore, non «Punti chiave»',
    ['via lessicale', 'metacognizione', 'modularità', 'via fonologica', 'tempi', 'velocità'],
    e.concetti.map((c) => c.chiave));
  check('una frase in grassetto non è un concetto', undefined,
    e.concetti.find((c) => c.chiave.indexOf('enunciato') >= 0));
  check('l\'articolo non fa un secondo concetto', 'modularità', G.normalizza('<strong>La modularità.</strong>'));
  check('e le due forme stanno nello stesso nodo, l\'altra come alias',
    ['La modularità', ['modularità']], [per('modularità').testo, per('modularità').alias]);

  check('il micro-titolo è marcato come tale', true, per('modularità').micro);
  check('e pesa più di un grassetto qualsiasi', true, per('modularità').peso > per('velocità').peso);
  check('una voce di glossario dà al concetto la sua definizione',
    'Accesso diretto alla forma della parola; si oppone alla via fonologica.', per('via lessicale').def);
  check('un grassetto che coincide con una voce non fonda un secondo nodo', 1,
    e.concetti.filter((c) => c.chiave === 'via lessicale').length);
  check('il concetto sa in quale capitolo sta', [0, 0, 0, 0, 0, 0], e.concetti.map((c) => c.capitolo));

  // le fonti: il paragrafo cita un minuto, il frontmatter gli dà il nome
  check('la fonte del paragrafo arriva con l\'etichetta dell\'autore, non con l\'orologio',
    [{ type: 'video', file: '05 lez.mp4', t: 132, label: 'I due moduli della lettura' }],
    per('modularità').fonti);
  check('un concetto nominato da una fonte del frontmatter se la prende comunque',
    [{ type: 'pdf', file: '03 disp.pdf', page: 21, label: 'La velocità di lettura' }],
    per('velocità').fonti);
  check('un concetto che nessuna fonte tocca non se ne inventa una', [], per('tempi').fonti);

  // i legami
  check('i legami sono quelli che il testo autorizza',
    [['cooccorrenza', 3], ['definizione', 1], ['microtitolo', 2]],
    Object.entries(e.legami.reduce((a, l) => (a[l.tipo] = (a[l.tipo] || 0) + 1, a), {})).sort());
  check('TUTTI gli archi nascono muti: i verbi sono di G3', [''],
    Array.from(new Set(e.legami.map((l) => l.rel))));
  check('il micro-titolo comprende i concetti del suo paragrafo',
    [G.idDi('via lessicale'), G.idDi('via fonologica')],
    e.legami.filter((l) => l.tipo === 'microtitolo').map((l) => l.a));
  check('e la definizione che nomina un altro termine lo lega',
    [G.idDi('via lessicale'), G.idDi('via fonologica')],
    e.legami.filter((l) => l.tipo === 'definizione').map((l) => [l.da, l.a])[0]);
  check('una coppia produce UN arco, non uno per paragrafo', e.legami.length,
    new Set(e.legami.map((l) => [l.da, l.a].sort().join('~'))).size);

  check('l\'id è l\'impronta del termine, non un contatore', G.idDi('modularità'), per('modularità').id);
  check('e due estrazioni della stessa cosa danno lo stesso id',
    G.estrai(capUno(), { indice: 7 }).concetti.map((c) => c.id), e.concetti.map((c) => c.id));
  puro('estrai', capUno(), (c) => G.estrai(c, { indice: 0 }));
  check('senza capitolo non si inventa niente', { titolo: '', capitolo: null, concetti: [], legami: [] }, G.estrai(null, {}));
}

sezione('L\'identità di un concetto — dove si fonde e, soprattutto, dove no');
{
  check('l\'articolo si toglie solo se è una parola', ['modularità', 'lessicale'],
    [G.normalizza('la modularità'), G.normalizza('lessicale')]);
  check('le virgolette e il punto finale non fanno un secondo concetto', 'dislessia',
    G.normalizza('«Dislessia».'));
  check('«comprensione» e «comprensione del testo» restano due cose diverse', false,
    G.normalizza('la comprensione') === G.normalizza('la comprensione del testo'));

  /* La fusione singolare/plurale non può stare in `estrai`: decidere che
     «tempo» e «tempi» sono la stessa parola richiede di sapere che esistono
     tutte e due, e quale delle due il corso usa di più. Quindi si guarda al
     montaggio, ed è lì che si prova. */
  const lezione = {
    id: 'prova', titolo: 'Lezione di prova',
    chapters: [capUno(), {
      title: 'Il tempo di lettura', brief: '', keypoints: [], glossary: [],
      html: '<p>Il <strong>tempo</strong> di esecuzione dipende dalla <strong>velocità</strong>.</p>' +
            '<p>La <strong>comprensione</strong> non è la <strong>comprensione del testo</strong>.</p>'
    }]
  };
  const m = G.daLezione(lezione, { soglia: 2 });
  const testi = m.nodi.map((n) => n.testo);
  check('«tempo» e «tempi» diventano un nodo solo', 1,
    testi.filter((t) => /^tempi?$/i.test(t)).length);
  check('e la forma non scelta resta come alias del ponte fra i due capitoli', true,
    m.archi.some((a) => a.da === 'r' && a.a === G.idDi('tempi')));
  check('«comprensione» e «comprensione del testo» restano due nodi', 2,
    testi.filter((t) => /^comprensione/i.test(t)).length);
  /* La spina si guarda senza sottobosco: con `annidate` acceso anche un
     concetto locale che non trova a chi appendersi finisce sotto la radice, e
     appeso alla radice non vuol dire «spina». */
  const sola = G.daLezione(lezione, { soglia: 2, annidate: false });
  check('un concetto che sta in due capitoli è spina, uno che sta in uno no',
    [true, false],
    [sola.nodi.some((n) => n.id === G.idDi('velocità')),
     sola.nodi.some((n) => n.id === G.idDi('comprensione del testo'))]);
  integra('daLezione finta', m);
  puro('daLezione', lezione, (l) => G.daLezione(l, { soglia: 2 }));
}

sezione('daCapitolo non è cambiata: la mappa vecchia regge ancora chi la chiama');
{
  const g = G.daCapitolo(capUno(), { glossario: true, indice: 3 });
  check('la radice è ancora il titolo del capitolo', 'La lettura strumentale', g.nodi[0].testo);
  check('i punti chiave sono ancora un ramo', true, !!g.nodi.find((n) => n.testo === 'Punti chiave'));
  check('e il glossario pure', true, !!g.nodi.find((n) => n.testo === 'Glossario'));
  check('gli id sono ancora i contatori di sempre', 'n1', g.nodi[0].id);
}

/* ==========================================================================
   2. IL CORPUS VERO — l'unica prova che l'identità dei concetti tenga

   Le misure attese vengono dal §13.3 del piano, pagate prima di scrivere una
   riga: 193 termini in ≥2 lezioni, 63 in ≥3, 9 in ≥5. Qui non si cerca il
   numero esatto — quello dipende da che cosa si conta come concetto — ma
   l'ORDINE DI GRANDEZZA: se ne uscissero 40 la normalizzazione starebbe
   fondendo tutto, se ne uscissero 900 non starebbe fondendo niente.
   ========================================================================== */

/** Dove sono i dati veri: come `test/roundtrip.js`, prima la configurazione
 *  dell'app, poi la posizione storica, poi la cartella affiancata. */
function vaultReale() {
  const cand = [];
  if (process.env.HOME) {
    try {
      const cfg = JSON.parse(fs.readFileSync(
        path.join(process.env.HOME, 'Library', 'Application Support', 'studia', 'config.json'), 'utf-8'));
      if (cfg.vaultPath) cand.push(cfg.vaultPath);
    } catch (e) { /* nessuna configurazione: si prova con le posizioni note */ }
  }
  cand.push(path.join(__dirname, '..'));
  cand.push(path.join(__dirname, '..', '..', 'StudIA - file'));
  return cand.find((v) => fs.existsSync(path.join(v, 'Corsi'))) || path.join(__dirname, '..');
}

const MEDIA_EXT = ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.mpeg', '.mpg', '.m4a', '.mp3', '.wav', '.aac', '.flac'];
/** La mappa «NN» → nome file, come la costruisce `preload.numeriPerCorso`.
 *  Senza, i rimandi `video:05` restano numeri e le fonti dei nodi sarebbero
 *  finte: si proverebbe una cosa diversa da quella che gira nell'app. */
function numeriDi(vault, corso) {
  const perNum = (dirs, exts) => {
    const map = {};
    for (const dir of dirs) {
      let files; try { files = fs.readdirSync(dir); } catch (e) { continue; }
      for (const f of files.sort()) {
        if (exts && exts.indexOf(path.extname(f).toLowerCase()) < 0) continue;
        const m = /^(\d{1,3})\b/.exec(f);
        if (m) { const k = m[1].padStart(2, '0'); if (!map[k]) map[k] = f; }
      }
    }
    return map;
  };
  return {
    mediaByNum: perNum(mat.cartelle(vault, 'Media', corso, true).concat(mat.cartelle(vault, 'Fonti', corso, true)), MEDIA_EXT),
    pdfByNum: perNum(mat.cartelle(vault, 'Fonti', corso, true), ['.pdf'])
  };
}

/** Il titolo di una lezione sta nel frontmatter del suo `_lezione.md`. */
function titoloLezione(dir, folder) {
  for (const nome of ['_lezione.md', '_corso.md']) {
    try {
      const m = /^title:\s*(.+)$/m.exec(fs.readFileSync(path.join(dir, nome), 'utf-8'));
      if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    } catch (e) { /* la lezione non dichiara un titolo: vale la cartella */ }
  }
  return folder;
}

/** L'impronta di una cartella: ogni file con la sua dimensione e il suo
 *  ultimo cambiamento. Serve a dimostrare che il corso non è stato scritto. */
function impronta(dir) {
  const out = [];
  (function scendi(d) {
    let voci; try { voci = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    voci.sort((a, b) => a.name.localeCompare(b.name)).forEach((v) => {
      const p = path.join(d, v.name);
      if (v.isDirectory()) return scendi(p);
      const st = fs.statSync(p);
      out.push(v.name + '|' + st.size + '|' + st.mtimeMs);
    });
  })(dir);
  return out.join('\n');
}

const VAULT = vaultReale();
const CORSO = 'TD74-DSA';
const RADICE_CORSO = path.join(VAULT, 'Corsi', CORSO);

if (!fs.existsSync(RADICE_CORSO)) {
  console.log('\n  ⚠️ SALTATI tutti i controlli sul corpus: ' + RADICE_CORSO + ' non esiste.');
  console.log('     Sono metà della prova — una suite verde senza di loro non dice niente.');
} else {
  const primaDelTest = impronta(path.join(RADICE_CORSO, 'LEZIONI'));
  const api = rp.load(numeriDi(VAULT, CORSO));
  const corso = {
    titolo: 'TD 74 — I disturbi specifici di apprendimento',
    lezioni: corsiLib.elencoLezioni(VAULT, CORSO).map((folder) => {
      const dir = corsiLib.lezioneDir(VAULT, CORSO, folder);
      const chapters = [];
      espandi.capitoliDi(fs.readdirSync(dir)).forEach((f, i) => {
        const c = api.mdChapter(fs.readFileSync(path.join(dir, f), 'utf-8'), folder, i + 1);
        if (c.title) chapters.push(c);
      });
      return { id: folder, titolo: titoloLezione(dir, folder), chapters };
    })
  };

  sezione('Il corpus è quello che credo che sia');
  check('16 lezioni', 16, corso.lezioni.length);
  check('210 capitoli', 210, corso.lezioni.reduce((s, l) => s + l.chapters.length, 0));

  sezione('I concetti-ponte: quanti sono davvero, su un corpus vero');
  /* Senza tetto e senza sottobosco la mappa È l'elenco dei ponti: si contano
     là, perché con `max` in mezzo si conterebbe il tetto, non il corpus. */
  const soliPonti = (soglia) => G.daCorso(corso, { soglia, max: 99999, annidate: false })
    .nodi.filter((n) => n.genere === 'concetto' || n.genere === 'termine');
  const p2 = soliPonti(2).length, p3 = soliPonti(3).length, p5 = soliPonti(5).length;
  console.log('   misurati: ' + p2 + ' concetti in ≥2 lezioni · ' + p3 + ' in ≥3 · ' + p5 + ' in ≥5' +
    '   (il §13.3 aveva contato 193 · 63 · 9)');
  check('i ponti a ≥2 lezioni sono nell\'ordine di grandezza delle 193 misurate', true, p2 > 120 && p2 < 320);
  check('quelli a ≥3 lezioni, delle 63', true, p3 > 40 && p3 < 110);
  check('quelli a ≥5 lezioni, delle 9', true, p5 > 4 && p5 < 25);
  check('e alzare la soglia restringe sempre', true, p2 > p3 && p3 > p5);

  sezione('«memoria di lavoro» è il ponte più lungo del corso');
  {
    const m = G.daCorso(corso, { soglia: 2, max: 99999, annidate: false });
    const id = G.idDi('memoria di lavoro');
    const nodo = m.nodi.find((n) => n.id === id);
    check('c\'è, ed è un concetto', 'concetto', nodo && nodo.genere);
    check('porta il capitolo in cui si incontra la prima volta', true, nodo && nodo.capitolo != null);
    check('porta le sue fonti', true, !!(nodo && nodo.fonti && nodo.fonti.length));
    const verso = m.archi.filter((a) => a.a === id);
    console.log('   «memoria di lavoro» tocca ' + verso.length + ' lezioni (' +
      verso.filter((a) => a.cross).length + ' come cross-link)');
    check('tocca più di una lezione', true, verso.length > 1);
    check('e tutte tranne quella di casa sono cross-link, che si contano e non si chiedono',
      verso.length - 1, verso.filter((a) => a.cross).length);
    check('i cross partono da nodi-lezione', true,
      verso.filter((a) => a.cross).every((a) => (m.nodi.find((n) => n.id === a.da) || {}).genere === 'lezione'));
  }

  sezione('La mappa del corso: forma, integrità, e le leve che la cambiano');
  {
    const m = G.daCorso(corso, { soglia: 2 });
    integra('daCorso', m);
    check('la radice è il corso', ['radice', corso.titolo], [m.nodi[0].genere, m.nodi[0].testo]);
    check('una lezione, un nodo', 16, m.nodi.filter((n) => n.genere === 'lezione').length);
    check('e il tetto non nasconde mai una lezione', 16,
      G.daCorso(corso, { soglia: 2, max: 3 }).nodi.filter((n) => n.genere === 'lezione').length);
    check('«si articola in» è l\'unico verbo scritto a mano', ['', 'si articola in'],
      Array.from(new Set(m.archi.map((a) => a.rel))).sort());
    check('e sta solo sugli archi corso → lezione', 16,
      m.archi.filter((a) => a.rel === 'si articola in').length);
    check('ogni nodo dichiara di essere generato', true,
      m.nodi.every((n) => n.origine === 'generata'));
    check('i generi sono quelli del vocabolario condiviso', true,
      m.nodi.every((n) => ['radice', 'lezione', 'concetto', 'fonte', 'termine'].indexOf(n.genere) >= 0));
    check('ogni concetto sa dove portare il click', true,
      m.nodi.filter((n) => n.genere === 'concetto').every((n) => n.capitolo != null));
    /* ⚠️ Su una mappa di CORSO il numero del capitolo non basta: «capitolo 3»
       sono sedici capitoli diversi, e il lettore aprirebbe il terzo della
       lezione aperta adesso — in silenzio, e con l'aria di funzionare. Il nodo
       deve portare l'id STABILE (`01-fondamenti-c03`), che `vaiAlCapitolo` sa
       risolvere caricando prima la lezione giusta. */
    check('e lo sa in modo non ambiguo: id del capitolo, non solo il numero', true,
      m.nodi.filter((n) => n.capitolo != null).every((n) => typeof n.capitoloId === 'string' && n.capitoloId));
    check('l\'id del capitolo è uno di quelli veri del corso', true,
      (() => {
        const veri = new Set();
        corso.lezioni.forEach((l) => (l.chapters || []).forEach((c) => veri.add(c.id)));
        return m.nodi.filter((n) => n.capitoloId).every((n) => veri.has(n.capitoloId));
      })());
    check('e la lezione che l\'id nomina è quella sotto cui il nodo sta appeso', true,
      (() => {
        const perId = {}; m.nodi.forEach((n) => { perId[n.id] = n; });
        const padre = {}; m.archi.forEach((a) => { if (!padre[a.a] && !a.cross) padre[a.a] = a.da; });
        return m.nodi.filter((n) => n.capitoloId && perId[padre[n.id]] &&
          perId[padre[n.id]].genere === 'lezione').every((n) => {
          const lez = corso.lezioni.find((l) => (l.chapters || []).some((c) => c.id === n.capitoloId));
          return lez && perId[padre[n.id]].testo.indexOf(lez.titolo.slice(0, 20)) >= 0;
        });
      })());

    // la leva della soglia
    const n2 = m.nodi.length, n3 = G.daCorso(corso, { soglia: 3 }).nodi.length,
      n5 = G.daCorso(corso, { soglia: 5 }).nodi.length;
    console.log('   nodi: soglia 2 → ' + n2 + ' · soglia 3 → ' + n3 + ' · soglia 5 → ' + n5);
    check('una soglia più alta fa una mappa più piccola', true, n2 > n3 && n3 > n5);
    // la leva del tetto
    check('il tetto pota i rami', true, G.daCorso(corso, { soglia: 2, max: 4 }).nodi.length < n2);
    // la leva del sottobosco
    check('senza il sottobosco restano la spina e le lezioni', true,
      G.daCorso(corso, { soglia: 2, annidate: false }).nodi.length < n2);

    puro('daCorso', corso, (c) => G.daCorso(c, { soglia: 2 }));
    check('due chiamate uguali danno la stessa mappa',
      JSON.stringify(G.daCorso(corso, { soglia: 3 })), JSON.stringify(G.daCorso(corso, { soglia: 3 })));
  }

  sezione('Le fonti: un pallino sul concetto, oppure nodi a sé');
  {
    const pallino = G.daCorso(corso, { soglia: 3, fonti: 'pallino' });
    const nodo = G.daCorso(corso, { soglia: 3, fonti: 'nodo' });
    const niente = G.daCorso(corso, { soglia: 3, fonti: 'no' });
    check('con «pallino» le fonti non sono nodi…', 0, pallino.nodi.filter((n) => n.genere === 'fonte').length);
    check('…ma stanno sul concetto, pronte per la bolla', true,
      pallino.nodi.filter((n) => n.fonti && n.fonti.length).length > 100);
    check('con «nodo» diventano nodi appesi ai concetti che le citano', true,
      nodo.nodi.filter((n) => n.genere === 'fonte').length > 100);
    check('e ogni nodo-fonte sa aprire il suo punto esatto', true,
      nodo.nodi.filter((n) => n.genere === 'fonte')
        .every((n) => n.rimando && n.rimando.file && (n.rimando.t != null || n.rimando.page != null)));
    check('lo stesso minuto dello stesso video è UN nodo, citato da più concetti', true,
      nodo.nodi.filter((n) => n.genere === 'fonte').length ===
      new Set(nodo.nodi.filter((n) => n.genere === 'fonte').map((n) => n.id)).size);
    check('con «no» non resta né l\'elenco né il rimando', [0, 0],
      [niente.nodi.filter((n) => n.fonti).length, niente.nodi.filter((n) => n.rimando).length]);
    check('il primo elemento di fonti[] è anche il rimando, per chi legge solo quello', true,
      pallino.nodi.filter((n) => n.fonti).every((n) => JSON.stringify(n.fonti[0]) === JSON.stringify(n.rimando)));
    integra('daCorso con le fonti a nodo', nodo);
  }

  sezione('La mappa di una lezione');
  {
    const lz = corso.lezioni[0];
    const m = G.daLezione(lz, { soglia: 2 });
    integra('daLezione', m);
    check('la radice è la lezione', ['radice', lz.titolo], [m.nodi[0].genere, m.nodi[0].testo]);
    check('non ci sono nodi-capitolo: i nodi sono concetti', 0,
      m.nodi.filter((n) => n.genere === 'capitolo' || n.genere === 'sezione' || n.genere === 'raccolta').length);
    check('nessun ramo si chiama «Punti chiave» o «Glossario»', 0,
      m.nodi.filter((n) => ['Punti chiave', 'Glossario', 'Note e materiali'].indexOf(n.testo) >= 0).length);
    check('ogni concetto porta il capitolo in cui si incontra', true,
      m.nodi.filter((n) => n.genere !== 'radice').every((n) => n.capitolo != null));
    check('tutti gli archi sono muti', [''], Array.from(new Set(m.archi.map((a) => a.rel))));
    const cross = m.archi.filter((a) => a.cross);
    console.log('   ' + m.nodi.length + ' nodi, ' + m.archi.length + ' archi, ' + cross.length + ' cross-link');
    check('i cross legano concetti che abitano capitoli diversi', true,
      cross.every((a) => {
        const A = m.nodi.find((n) => n.id === a.da), B = m.nodi.find((n) => n.id === a.a);
        return A && B && A.capitolo !== B.capitolo;
      }));
    check('tutte le lezioni del corso producono una mappa non vuota', 16,
      corso.lezioni.filter((l) => G.daLezione(l, { soglia: 2 }).nodi.length > 1).length);
  }

  sezione('Il corso è stato solo letto');
  check('nessun file delle lezioni è cambiato', primaDelTest, impronta(path.join(RADICE_CORSO, 'LEZIONI')));
}

console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutto verde') + '  (' + ok + ' controlli)');
process.exit(ko ? 1 : 0);
