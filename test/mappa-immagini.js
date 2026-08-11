'use strict';
/**
 * Test del nodo che È un'immagine.
 *
 * Si ritaglia con il mouse un pezzo di un PDF, il ritaglio finisce nell'album del
 * corso, e da lì lo si manda sulla mappa aperta: quel nodo non dice più una
 * frase, MOSTRA uno schema, e il suo testo scende sotto a fare da didascalia.
 * Il campo è uno solo — `nodo.immagine = {id, w, h}` — e questo file prova le
 * due metà del suo viaggio:
 *
 *  1. LA PERSISTENZA (`lib/mappe.js`). Un `immagine` malformato non deve mai
 *     finire su disco: un rimando a un ritaglio che l'album non sa ritrovare
 *     condannerebbe quel nodo a un segnaposto per sempre, senza che nessuno
 *     possa capire se manca l'album o è sbagliato il campo. Ma le misure sono
 *     un'altra cosa: servono al rapporto d'aspetto, e quando mancano si perde
 *     un po' di bellezza, non l'immagine.
 *
 *  2. IL DISEGNO (`disegna.js`). Il modulo è PURO e non sa dove stia l'album:
 *     l'indirizzo glielo dà chi chiama con `opt.srcImmagine`. Senza quella
 *     funzione — o quando il file non c'è più — NON si emette un `<image>` senza
 *     sorgente, che a schermo è un buco muto e in PDF un errore: si emette un
 *     segnaposto che dice che lì un ritaglio ci sarebbe.
 *
 * Ciò che si prova più di tutto, però, è che NIENTE sia cambiato per chi
 * un'immagine non ce l'ha: la geometria delle card la decide `layouts` e non è
 * di questo modulo, e un nodo di solo testo deve uscire identico a ieri.
 *
 * Si legge la STRINGA SVG, mai il DOM: è la stringa che va a svg2pdf, ed è lì
 * che si decide la fedeltà dell'esportazione. Per la stessa ragione ogni
 * asserzione guarda ATTRIBUTI e non classi.
 *
 *   node test/mappa-immagini.js
 */

const ML = require('../App/assets/mappa/layouts');
const DIS = require('../App/assets/mappa/disegna');
const M = require('../lib/mappe');

let ko = 0, ok = 0;
function check(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { ok++; return; }
  ko++;
  console.log('  ✗ ' + nome + '\n      atteso: ' + a + '\n      avuto:  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

/* Attrezzi. Sono quelli di `disegna-fonti.js`: si guarda dentro la stringa con
   le stesse pinze, così due file che provano lo stesso modulo non finiscono per
   avere due idee diverse di che cosa sia una card. */
const n1 = (v) => Math.round(v * 10) / 10;
const O = ML.opzioni({});
const W = O.w, H = O.h;
const card = (mk, id) => (mk.match(new RegExp('<g class="mnodo" data-id="' + id + '"[\\s\\S]*?</g>')) || [''])[0];
const attr = (s, k) => (s.match(new RegExp('\\b' + k + '="([^"]*)"')) || [])[1];
const testi = (s) => s.match(/<text[\s\S]*?<\/text>/g) || [];
const imm = (s) => s.match(/<image[^>]*\/>/g) || [];
const rett = (s) => s.match(/<rect[^>]*\/>/g) || [];
const quante = (mk, s) => (mk.match(new RegExp('>' + s + '<', 'g')) || []).length;
const box = (s) => ({ x: +attr(s, 'x'), y: +attr(s, 'y'), w: +attr(s, 'width'), h: +attr(s, 'height') });
const disegna = (g, opt, vista) =>
  DIS.svg(ML.run(g, Object.assign({ motore: 'albero' }, vista || {})), opt || {}).markup;

/* Il grafo di prova tiene insieme in un disegno solo i quattro casi che esistono
   davvero: il ritaglio che si trova, quello che l'album non trova più (cancellato
   fuori dall'app: è normale, non è un guasto), il campo che non dice niente, e il
   nodo di solo testo che non deve accorgersi di nulla. */
const F = (n) => ({ type: 'pdf', file: 'dispensa.pdf', page: n, label: 'p. ' + n });
const TESTO_LUNGO = 'Lo schema dei quattro processi della scrittura';
const gImm = { nodi: [
  { id: 'tutto', testo: 'Radice con tutto addosso', immagine: { id: 'alb_0001', w: 900, h: 1600 }, fonti: [F(3), F(9)] },
  { id: 'foto', testo: TESTO_LUNGO, immagine: { id: 'alb_0007', w: 1200, h: 800 } },
  { id: 'persa', testo: 'Ritaglio introvabile', immagine: { id: 'alb_perso' } },
  { id: 'vuota', testo: 'Campo che non dice niente', immagine: { w: 10, h: 10 } },
  { id: 'senza', testo: 'Un nodo di solo testo, abbastanza lungo da andare a capo' }
], archi: [{ da: 'tutto', a: 'foto' }, { da: 'tutto', a: 'persa' },
           { da: 'tutto', a: 'vuota' }, { da: 'tutto', a: 'senza' }] };
const IDS = gImm.nodi.map((n) => n.id);

/** L'album del renderer, ridotto all'osso: sa dov'è ogni ritaglio tranne quello
 *  che qualcuno ha cancellato dal disco senza passare dall'app. */
const SRC = (im) => im.id === 'alb_perso' ? '' : 'studia-album://TD74-DSA/' + im.id + '.webp';

const mk = disegna(gImm, { srcImmagine: SRC });
const mkMuto = disegna(gImm, {});   // il chiamante non ha passato nessuna funzione

/* Lo stesso grafo senza nemmeno un campo `immagine`: è il metro con cui si
   misura la non-regressione. Le posizioni le decide la struttura, non i campi
   dei nodi, quindi le due mappe sono sovrapponibili card per card. */
const gSenza = { nodi: gImm.nodi.map((n) => { const c = Object.assign({}, n); delete c.immagine; return c; }),
                 archi: gImm.archi };
const mkSenza = disegna(gSenza, { srcImmagine: SRC });

/* ------------------------------------------------------------- 1. il ritaglio */

sezione('Mappe — un nodo può essere un\'immagine, e la sorgente arriva da fuori');
{
  check('il ritaglio compare solo su chi ne porta uno', ['foto', 'tutto'],
    IDS.filter((id) => imm(card(mk, id)).length).sort());
  check('e chi ha un campo senz\'id resta una card qualsiasi', 0, imm(card(mk, 'vuota')).length);

  const i = imm(card(mk, 'foto'))[0];
  check('la sorgente è quella che ha dato opt.srcImmagine, e nessun\'altra',
    ['studia-album://TD74-DSA/alb_0007.webp', 'studia-album://TD74-DSA/alb_0007.webp'],
    [attr(i, 'href'), attr(i, 'xlink:href')]);
  /* Due attributi con lo stesso valore: i browser leggono `href` (SVG 2), i
     convertitori in PDF cercano ancora `xlink:href` (SVG 1.1), e questo modulo
     esiste per servire tutti e due con una resa sola. */
  check('l\'indirizzo sta in tutti e due i nomi, per il browser e per il PDF', [true, true],
    [/ href="/.test(i), / xlink:href="/.test(i)]);

  // dentro la card, non fratello: un nodo-immagine si preme come ogni altro nodo
  check('nessun ritaglio fuori da una card', imm(mk).length,
    IDS.reduce((n, id) => n + imm(card(mk, id)).length, 0));
  check('e la card non cambia identità: resta .mnodo con il suo id', [true, true],
    [/^<g class="mnodo" data-id="foto"/.test(card(mk, 'foto')),
     /^<g class="mnodo" data-id="senza"/.test(card(mk, 'senza'))]);

  // tutto ad attributi: una classe di colore il PDF la perderebbe
  check('tutto sta negli attributi, anche il ritaglio', false, /class=/.test(i));
}

/* ------------------------------------------------- 2. il rapporto d'aspetto */

/* ⚠️ QUESTA REGOLA È STATA ROVESCIATA, e vale la pena sapere com'era prima.
   Fino al 10 agosto 2026 il rapporto d'aspetto non entrava MAI nella geometria:
   la card di un nodo-immagine misurava quanto tutte le altre e il ritaglio si
   TAGLIAVA per starci dentro (`slice`). Il guadagno era una griglia
   perfettamente regolare; il prezzo era che di uno schema si vedeva un pezzo —
   e uno schema di cui si vede un pezzo non è uno schema.

   Adesso il nodo prende la forma del ritaglio e lo mostra INTERO: la larghezza
   parte da quella della card, l'altezza la detta il rapporto, e l'immagine si
   disegna con `meet`. La griglia non è più regolare e i motori non lo sanno —
   ma i nodi-immagine vivono SOLO sulle mappe dell'utente (decisione del 10
   agosto 2026, imposta da `mappaNodoImmagine`, che sulla generata rifiuta), cioè
   dove la disposizione la fa la mano. Non è un debito: è un caso che non si
   presenta. */
sezione('Mappe — il nodo prende la forma del ritaglio, e lo mostra intero');
{
  check('nessun taglio: si vede tutto',
    ['xMidYMid meet', 'xMidYMid meet'],
    imm(mk).map((s) => attr(s, 'preserveAspectRatio')));

  /* Due file con proporzioni opposte (900×1600 in piedi, 1200×800 sdraiato)
     ricevono adesso due riquadri DIVERSI, ciascuno col rapporto del suo file. */
  const bT = box(imm(card(mk, 'tutto'))[0]), bF = box(imm(card(mk, 'foto'))[0]);
  check('un\'immagine in piedi e una sdraiata non hanno più lo stesso riquadro',
    true, n1(bT.w) !== n1(bF.w) || n1(bT.h) !== n1(bF.h));
  check('e il rapporto è quello del file, non quello della card',
    [n1(1200 / 800), n1(900 / 1600)], [n1(bF.w / bF.h), n1(bT.w / bT.h)]);

  /* La larghezza di partenza resta quella della card: è ciò che tiene le
     immagini confrontabili fra loro invece di farne una collezione di ritagli
     di misure a caso. */
  const cardBox = (m, id) => box(rett(card(m, id))[0]);
  check('la larghezza parte da quella della card', W, n1(cardBox(mk, 'foto').w));
  check('e un nodo di solo testo resta esattamente com\'era',
    { w: W, h: H }, { w: cardBox(mk, 'senza').w, h: cardBox(mk, 'senza').h });
  check('mentre quello con l\'immagine è alto quanto serve', true,
    cardBox(mk, 'foto').h !== H);

  /* ⚠️ Il tetto: un ritaglio molto alto e stretto — una colonna di testo presa
     da una dispensa — darebbe un nodo più alto dell'intera mappa. Al tetto si
     arriva STRINGENDO la larghezza, mai schiacciando l'altezza: il rapporto non
     si tocca, o si torna alla deformazione da cui si scappava. */
  const altissima = disegna({
    nodi: [{ id: 'n1', testo: 'colonna', immagine: { id: 'aa11bb', w: 100, h: 3000 } }], archi: []
  }, { srcImmagine: SRC });
  const bA = box(imm(card(altissima, 'n1'))[0]);
  check('un ritaglio altissimo non fa un nodo alto quanto la mappa', true, bA.h <= H * 5 + 1);
  check('e per starci dentro si è stretto, non schiacciato', n1(100 / 3000), n1(bA.w / bA.h));

  /* Il riquadro non copre la barra a sinistra: il colore del ramo è la prima
     cosa che si legge su una mappa. In alto invece è a filo — lassù non c'è più
     nessuna cornice da rispettare. */
  const dentro = (id) => {
    const c = cardBox(mk, id), r = box(imm(card(mk, id))[0]);
    return [r.x >= c.x + 4, r.y >= c.y, r.x + r.w <= c.x + c.w + 0.5, r.y + r.h <= c.y + c.h + 0.5];
  };
  check('non copre la barra a sinistra e non esce dai tre lati nudi',
    [[true, true, true, true], [true, true, true, true]], [dentro('foto'), dentro('tutto')]);
  const barra = (id) => {
    const c = cardBox(mk, id);
    const b = rett(card(mk, id)).map(box).filter((r) => n1(r.w) === n1(4) && n1(r.h) === n1(c.h))[0];
    return b ? [n1(b.x), n1(b.y), n1(b.w)] : null;
  };
  check('la barra del colore sta a sinistra, alta quanto il nodo',
    [n1(cardBox(mk, 'foto').x), n1(cardBox(mk, 'foto').y), n1(4)], barra('foto'));
  check('con lati positivi, che è la sola cosa che l\'SVG non perdona', [true, true],
    [bF.w > 0 && bF.h > 0, bT.w > 0 && bT.h > 0]);

  /* La card più bassa che `layouts` accetta è alta 24: là il riquadro si stringe
     ma deve restare disegnabile, altrimenti un `height` negativo rompe l'intera
     mappa e non solo quel nodo. */
  const stretta = disegna(gImm, { srcImmagine: SRC }, { w: 40, h: 24 });
  const bS = box(imm(card(stretta, 'foto'))[0]);
  check('anche sulla card più piccola che il motore accetta il riquadro regge',
    [true, true], [bS.w > 0, bS.h > 0]);
}

/* -------------------------------------------------------- 3. il segnaposto */

sezione('Mappe — senza sorgente compare un segnaposto, mai un rettangolo muto');
{
  check('senza opt.srcImmagine non si emette nemmeno un <image>', 0, imm(mkMuto).length);
  // tre nodi-immagine, e ognuno lo dice: due copie a testa per l'alone bianco
  check('e ogni nodo-immagine dice perché non si vede', 6, quante(mkMuto, DIS.SEGNAPOSTO));

  // quando l'album risponde vuoto vale lo stesso, ma solo per quel nodo
  check('un ritaglio cancellato fuori dall\'app riguarda solo il suo nodo',
    [0, 1, 1, 0], [imm(card(mk, 'persa')).length, quante(card(mk, 'persa'), DIS.SEGNAPOSTO) / 2,
                   imm(card(mk, 'foto')).length, quante(card(mk, 'foto'), DIS.SEGNAPOSTO)]);

  /* ⚠️ Il controllo che vale per tutti i disegni di questo file: un `<image>`
     senza indirizzo non deve esistere. A schermo sarebbe un buco che non si
     distingue da un nodo vuoto, in conversione un errore. */
  check('mai un <image> senza sorgente, in nessuno dei disegni', [],
    imm(mk).concat(imm(mkMuto), imm(mkSenza))
      .filter((s) => !attr(s, 'href') || !attr(s, 'xlink:href')));

  const seg = rett(card(mkMuto, 'persa')).find((s) => /stroke-dasharray/.test(s)) || '';
  check('il segnaposto è un riquadro tratteggiato, non un buco bianco',
    ['3 3', '#fbfbfa', false], [attr(seg, 'stroke-dasharray'), attr(seg, 'fill'), /class=/.test(seg)]);
  // il bersaglio del click resta il rettangolo della card, che sta sotto e copre tutto
  check('e non ruba il click alla card', ['none', 0],
    [attr(seg, 'pointer-events'),
     (card(mkMuto, 'persa').match(/<text(?![^>]*pointer-events="none")[^>]*>immagine non/g) || []).length]);
}

/* --------------------------------------------------------- 4. la didascalia */

sezione('Mappe — il testo del nodo resta, sotto, come didascalia di una riga');
{
  const t = testi(card(mk, 'foto'));
  check('con un\'immagine il testo diventa una riga sola', 1, t.length);
  check('tagliata, e riconoscibile come l\'inizio del testo vero', [true, true],
    [/…<\/text>$/.test(t[0]),
     TESTO_LUNGO.indexOf((t[0].match(/>([^<]*)</) || [])[1].replace('…', '')) === 0]);
  // lo stesso nodo senza immagine si prende tutte le righe che ci stanno
  check('e senza immagine lo stesso testo torna ad andare a capo come sempre', 2,
    testi(card(mkSenza, 'foto')).length);

  const r = box(imm(card(mk, 'foto'))[0]);
  check('la didascalia sta SOTTO il riquadro, non sopra e non dentro', true,
    +attr(t[0], 'y') > r.y + r.h);
  check('centrata come ogni testo di card, e con lo stesso corpo', ['middle', '12'],
    [attr(t[0], 'text-anchor'), attr(t[0], 'font-size')]);

  /* Anche col segnaposto la didascalia c'è: chi guarda deve poter leggere DI CHE
     COSA era il ritaglio che non si vede. Tre testi = le due copie del
     segnaposto più la didascalia, che resta l'ultima. */
  const tm = testi(card(mkMuto, 'persa'));
  check('e c\'è anche quando il ritaglio non si trova', [3, 'Ritaglio introvabile'],
    [tm.length, (tm[2].match(/>([^<]*)</) || [])[1]]);
}

/* ----------------------------------------------------------- 5. l'etichetta */

/* La mappa si percorre da tastiera, un nodo per volta. Senza questa aggiunta un
   nodo che mostra uno schema si annuncerebbe con la sola didascalia — cioè come
   un nodo di testo qualsiasi, per giunta troncato. */
sezione('Mappe — l\'etichetta della card dice che lì c\'è un\'immagine');
{
  check('chi porta un ritaglio lo annuncia',
    [TESTO_LUNGO + ' — immagine', 'Radice con tutto addosso — immagine — 2 fonti'],
    ['foto', 'tutto'].map((id) => attr(card(mk, id), 'aria-label')));
  // e con le stesse parole che si leggono nel segnaposto: chi guarda e chi
  // ascolta non devono trovarsi davanti a due nodi diversi
  check('e chi non lo trova lo dice con le parole del segnaposto',
    'Ritaglio introvabile — ' + DIS.SEGNAPOSTO, attr(card(mk, 'persa'), 'aria-label'));
  check('mentre chi non ne ha resta il testo nudo, come è sempre stato',
    ['Un nodo di solo testo, abbastanza lungo da andare a capo', 'Campo che non dice niente'],
    ['senza', 'vuota'].map((id) => attr(card(mk, id), 'aria-label')));
}

/* ------------------------------------------------------ 6. nessuna regressione */

sezione('Mappe — chi non ha immagini esce identico a ieri, byte per byte');
{
  check('la card di un nodo di solo testo è la stessa con e senza immagini nella mappa',
    card(mkSenza, 'senza'), card(mk, 'senza'));
  check('e un campo immagine che non dice niente non cambia una virgola',
    card(mkSenza, 'vuota'), card(mk, 'vuota'));
  check('una mappa senza ritagli non produce né <image> né segnaposto né tratteggi',
    [0, 0, 0],
    [imm(mkSenza).length, quante(mkSenza, DIS.SEGNAPOSTO),
     (mkSenza.match(/stroke-dasharray="3 3"/g) || []).length]);
  /* Il bordo tratteggiato dei nodi dell'utente ha un altro passo (`4 3`): il
     segnaposto non deve averglielo rubato, altrimenti due segni diversi
     direbbero la stessa cosa. */
  check('e il tratteggio del segnaposto non è quello del bordo «tuo»', true,
    DIS.SEGNAPOSTO.length > 0 && !/stroke-dasharray="4 3"/.test(card(mkMuto, 'persa')));
}

/* --------------------------------------------------- 7. i segni sulla card */

/* ⚠️ L'ordine di emissione è portante: i bersagli invisibili si sovrappongono e
   in SVG vince l'ultimo disegnato. L'immagine non entra in questo conto — sta
   DENTRO la card, quindi prima di tutti e tre — ma il conto deve restare quello
   di prima anche sui nodi che ne portano una. */
sezione('Mappe — porta, fonte e ramo convivono con l\'immagine, nell\'ordine di prima');
{
  const mkT = disegna(gImm, { srcImmagine: SRC, maniglie: true, chiudibili: { tutto: 'aperto' } });
  const dove = (cls) => mkT.indexOf('class="' + cls + '" data-id="tutto"');
  check('ci sono tutti e tre, sul nodo che porta anche il ritaglio', [true, true, true],
    [dove('mporta') > 0, dove('mfonte') > 0, dove('mtoggle') > 0]);
  check('porta → fonte → toggle, in quest\'ordine', [true, true],
    [dove('mporta') < dove('mfonte'), dove('mfonte') < dove('mtoggle')]);
  check('e il ritaglio sta dentro la card, quindi prima di tutti e tre', [1, true],
    [imm(card(mkT, 'tutto')).length, mkT.indexOf('<image') < dove('mporta')]);
  // il segno delle fonti non si è accorto dell'immagine: numero e bersaglio uguali
  const f = (mkT.match(/<g class="mfonte" data-id="tutto"[\s\S]*?<\/g>/) || [''])[0];
  check('il segno delle fonti dice ancora due, e sta dove stava', ['2', true],
    [attr(f, 'data-fonti'), /r="11"[^>]*fill-opacity="0"/.test(f)]);
}

/* ----------------------------------------------------------- 8. su disco */

sezione('Mappe — l\'immagine su disco: si valida, e ciò che è storto non ci arriva');
{
  const nodo = (im) => M.normalizzaNodo({ id: 'n1', testo: 'x', immagine: im });
  check('«immagine» è nel vocabolario dei nodi, come «fonti»', true,
    M.CAMPI_NODO.indexOf('immagine') >= 0);
  check('un\'immagine buona si scrive tale e quale', { id: 'alb_0007', w: 1200, h: 800 },
    nodo({ id: 'alb_0007', w: 1200, h: 800 }).immagine);

  /* ⚠️ Il controllo che giustifica il nome in `CAMPI_NODO`: senza, questi valori
     grezzi rientrerebbero dal ramo dei campi non nominati in fondo a
     `normalizzaNodo`, rimettendo nel file esattamente ciò che la validazione ha
     appena tolto. Qui si guarda la CHIAVE, non il valore: un `immagine: null`
     scritto su disco sarebbe già un campo di troppo. */
  const storte = ['alb_0007', ['alb_0007'], {}, { id: '' }, { id: '   ' }, { id: null },
                  null, 42, true, { w: 1200, h: 800 }];
  check('un immagine malformato non finisce mai su disco: la chiave non c\'è proprio',
    storte.map(() => false),
    storte.map((im) => Object.prototype.hasOwnProperty.call(nodo(im), 'immagine')));

  /* Le misure sono un'altra cosa: servono al rapporto d'aspetto, e senza di loro
     il disegno ripiega. Buttare l'immagine per una misura sbagliata vorrebbe
     dire perdere il ritaglio per un dettaglio estetico. */
  const assurde = [{ id: 'a', w: 0, h: 600 }, { id: 'a', w: -3, h: -4 },
                   { id: 'a', w: 'mille', h: 800 }, { id: 'a', w: 1200 }, { id: 'a', h: 800 },
                   { id: 'a', w: Infinity, h: 800 }, { id: 'a', w: null, h: null }];
  check('con misure assurde l\'immagine resta, e cadono solo le misure',
    assurde.map(() => ({ id: 'a' })), assurde.map((im) => nodo(im).immagine));
  /* Tutto o niente, come `x`/`y`: da un lato solo un rapporto non si ricava, e
     un numero che nessuno può usare rimasto nel file suggerirebbe a chi legge
     una proporzione che lì dentro non c'è. */
  check('mezza misura non è una misura: cade anche il lato buono', [undefined, undefined],
    [nodo({ id: 'a', w: 1200 }).immagine.w, nodo({ id: 'a', h: 800 }).immagine.h]);

  check('una misura scritta come stringa diventa un numero, non resta una stringa',
    [1200, 800, 'number'],
    [nodo({ id: 'a', w: '1200', h: '800' }).immagine.w,
     nodo({ id: 'a', w: '1200', h: '800' }).immagine.h,
     typeof nodo({ id: 'a', w: '1200', h: '800' }).immagine.w]);
  check('e una frazione si arrotonda invece di far cadere il campo', [1201, 799],
    [nodo({ id: 'a', w: 1200.6, h: 799.4 }).immagine.w, nodo({ id: 'a', w: 1200.6, h: 799.4 }).immagine.h]);
  check('l\'id si ripulisce dagli spazi, come ogni altro nome che finisce su disco',
    'alb_9', nodo({ id: '  alb_9  ' }).immagine.id);
  // come per le fonti: un campo che l'album aggiungerà domani non sparisce oggi
  check('i campi che l\'album aggiungerà domani si portano com\'erano',
    { id: 'a', w: 10, h: 10, pagina: 7 }, nodo({ id: 'a', w: 10, h: 10, pagina: 7 }).immagine);

  /* Il nodo che un'immagine non ce l'ha deve uscire di qui identico a se stesso:
     è la sola prova che regge nel tempo, perché non guarda una regola ma il
     risultato completo. */
  const ieri = { id: 'n9', testo: 'Nodo di ieri', gruppo: 2, origine: 'utente', colore: '#0f766e',
                 nota: 'una nota', genere: 'radice', capitolo: 3, x: 12, y: -8 };
  check('un nodo senza immagine resta identico byte per byte',
    '{"id":"n9","testo":"Nodo di ieri","gruppo":2,"origine":"utente","colore":"#0f766e",' +
    '"nota":"una nota","genere":"radice","capitolo":3,"x":12,"y":-8}',
    JSON.stringify(M.normalizzaNodo(ieri)));
}

sezione('Mappe — il giro completo su disco, e i file di ieri che si aprono senza');
{
  const grezza = { titolo: 'Con ritagli', nodi: [
    { id: 'a', testo: 'Buona', immagine: { id: 'alb_1', w: 1200, h: 800 } },
    { id: 'b', testo: 'Storta', immagine: { w: 1200, h: 800 } },
    { id: 'c', testo: 'Senza misure', immagine: { id: 'alb_2', w: 0, h: 0 } }
  ], archi: [{ da: 'a', a: 'b' }, { da: 'a', a: 'c' }] };
  const su = M.parse(M.serializza(M.entroFormato(grezza, '2026-08-10T00:00:00.000Z')));
  const per = {}; su.nodi.forEach((n) => { per[n.id] = n; });
  check('andata e ritorno dal file: la buona torna intera, la storta non c\'è, le misure cadono da sole',
    [{ id: 'alb_1', w: 1200, h: 800 }, undefined, { id: 'alb_2' }],
    ['a', 'b', 'c'].map((id) => per[id].immagine));
  check('e nel testo del file non compare nessun campo immagine vuoto', 2,
    (M.serializza(M.entroFormato(grezza, '2026-08-10T00:00:00.000Z')).match(/"immagine"/g) || []).length);

  /* Nessuna migrazione: `formato` resta 1 e un file di ieri semplicemente non ha
     questo campo. Se un giorno servisse alzarlo, il motivo non sarà questo. */
  const vecchia = M.parse(JSON.stringify({ formato: 1, titolo: 'Di ieri',
    nodi: [{ id: 'a', testo: 'Un nodo di ieri' }], archi: [] }));
  check('un file di ieri si apre senza immagini e senza accorgersi di niente',
    [1, { id: 'a', testo: 'Un nodo di ieri' }, 1], [M.FORMATO, vecchia.nodi[0], vecchia.formato]);
}

console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati') + ' (' + ok + ' ok)');
process.exit(ko ? 1 : 0);
