'use strict';
/**
 * Test di due segni che la mappa non sapeva ancora fare.
 *
 * 1. IL NODO CHE CITA PIÙ FONTI. Un concetto onesto viene da più punti — il
 *    minuto del video e la tabella della dispensa — e il vecchio `rimando`
 *    ne teneva uno solo. Ora il nodo porta un elenco (`nodo.fonti`), e il segno
 *    nell'angolo deve dire QUANTE sono: a chi guarda, con un numerino; a chi
 *    scrive il menu a bolla, con `data-fonti`; a chi la mappa la percorre da
 *    tastiera, con l'etichetta della card. Ciò che si prova qui non è che il
 *    numero compaia, ma che compaia SENZA cambiare niente al resto: il segno
 *    delle mappe già salvate deve restare identico a se stesso, e il bersaglio
 *    non deve spostarsi di un pixel — la mano ha già imparato dov'è.
 *
 * 2. LE LINKING WORD NEL MOTORE PERCORSO. Guasto misurato: là non si
 *    disegnavano affatto. Il ciclo delle etichette iterava `res.archi`, ma in
 *    Percorso quelli sono i segmenti del filo numerato e i legami veri stanno
 *    in `res.extra` — che riceveva tratto, bersaglio e colore, mai la parola.
 *    Stessa famiglia del guasto 5.6 dell'HANDOFF: chi scrive un ciclo sugli
 *    archi dimentica che su un motore su quattro gli archi si chiamano `extra`.
 *
 * Si legge la STRINGA SVG, mai il DOM: è la stringa che va a svg2pdf, ed è lì
 * che si decide la fedeltà dell'esportazione. Per la stessa ragione ogni
 * asserzione guarda ATTRIBUTI e non classi.
 *
 *   node test/disegna-fonti.js
 */

const ML = require('../App/assets/mappa/layouts');
const DIS = require('../App/assets/mappa/disegna');
const REL = require('../App/assets/mappa/relazioni');

let ko = 0, ok = 0;
function check(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { ok++; return; }
  ko++;
  console.log('  ✗ ' + nome + '\n      atteso: ' + a + '\n      avuto:  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

/* Attrezzi. `n1` è l'arrotondamento del disegno: per ritrovare una parola sul
   punto di mezzo del suo arco bisogna cercarla con le stesse cifre. */
const n1 = (v) => Math.round(v * 10) / 10;
const W = ML.opzioni({}).w;
const gruppi = (mk, cls) => mk.match(new RegExp('<g class="' + cls + '"[\\s\\S]*?</g>', 'g')) || [];
const segno = (mk, id) => gruppi(mk, 'mfonte').find((s) => s.indexOf('data-id="' + id + '"') >= 0) || '';
const card = (mk, id) => (mk.match(new RegExp('<g class="mnodo" data-id="' + id + '"[\\s\\S]*?</g>')) || [''])[0];
const attr = (s, k) => (s.match(new RegExp('\\b' + k + '="([^"]*)"')) || [])[1];
const testi = (s) => s.match(/<text[\s\S]*?<\/text>/g) || [];
const cerchi = (s) => s.match(/<circle[^>]*\/>/g) || [];
const disegna = (g, opt, vista) =>
  DIS.svg(ML.run(g, Object.assign({ motore: 'albero' }, vista || {})), opt || {}).markup;

/* ---------------------------------------------------------------- 1. le fonti */

/* Il grafo di prova tiene insieme le tre generazioni di rimandi: l'elenco nuovo,
   il `rimando` dell'estrazione, il `capitolo` della vista generata. Sono
   apposta nello stesso disegno: la retrocompatibilità non si prova su una
   mappa a parte, si prova accanto al caso nuovo. */
const F = (n) => ({ type: 'pdf', file: 'dispensa.pdf', page: n, label: 'p. ' + n });
const gFonti = { nodi: [
  { id: 'tre', testo: 'Tre fonti', fonti: [F(3), { type: 'video', file: 'lezione.mp4', t: 42, label: "0'42\"" }, F(9)] },
  { id: 'una', testo: 'Una fonte', fonti: [F(5)] },
  { id: 'vec', testo: 'Solo rimando', rimando: { type: 'pdf', file: 'x.pdf', page: 3 } },
  { id: 'cap', testo: 'Solo capitolo', capitolo: 2 },
  { id: 'no', testo: 'Niente' },
  { id: 'vuoto', testo: 'Elenco vuoto', fonti: [] }
], archi: [{ da: 'tre', a: 'una' }, { da: 'tre', a: 'vec' }, { da: 'tre', a: 'cap' },
           { da: 'tre', a: 'no' }, { da: 'tre', a: 'vuoto' }] };
const mkF = disegna(gFonti, {});

sezione('Mappe — un concetto può citare più fonti, e il segno lo dice prima che lo si prema');
{
  check('un segno per chi porta da qualche parte, e per nessun altro',
    ['cap', 'tre', 'una', 'vec'],
    gruppi(mkF, 'mfonte').map((s) => attr(s, 'data-id')).sort());
  // un elenco vuoto è un elenco, non una fonte: prometterebbe una bolla vuota
  check('un elenco vuoto non è una fonte: nessun segno, come se il campo non ci fosse',
    '', segno(mkF, 'vuoto'));

  /* Il numero sta in un `data-*` perché lo legge il renderer, non un umano: con
     una sola fonte si apre l'anteprima, con tre si apre la bolla e si sceglie.
     ⚠️ Sulla via vecchia l'attributo NON c'è. Un `data-fonti="1"` messo lì per
     simmetria direbbe che esiste una lista da cui pescare, e la lista non c'è. */
  check('il conto sta in data-fonti, e solo per chi porta l\'elenco nuovo',
    ['3', '1', undefined, undefined],
    ['tre', 'una', 'vec', 'cap'].map((id) => attr(segno(mkF, id), 'data-fonti')));

  /* Retrocompatibilità: con il solo `rimando` il segno deve essere quello di
     sempre — bersaglio invisibile largo, pallino piccolo, nessun'altra cosa. */
  check('con il solo rimando il segno è esattamente quello di ieri',
    [2, 0, true, true, true],
    [cerchi(segno(mkF, 'vec')).length, testi(segno(mkF, 'vec')).length,
     /r="11"[^>]*fill-opacity="0"/.test(segno(mkF, 'vec')),
     /r="3" fill="#/.test(segno(mkF, 'vec')),
     /<title>Apri la fonte<\/title>/.test(segno(mkF, 'vec'))]);

  // il numerino: solo quando c'è davvero da scegliere
  check('il numerino compare solo quando c\'è da scegliere', [2, 0, 0],
    ['tre', 'una', 'vec'].map((id) => testi(segno(mkF, id)).length));
  check('e dice il numero vero', ['3', '3'],
    testi(segno(mkF, 'tre')).map((t) => (t.match(/>([^<]*)</) || [])[1]));

  /* Alone bianco: il numerino sta sopra il testo della card, e `paint-order` non
     sopravvive alla conversione in PDF. Due copie, il contorno DIETRO. */
  const dueCopie = testi(segno(mkF, 'tre'));
  check('l\'alone bianco sta dietro anche al numerino, come alle linking word',
    [true, false, '#ffffff'],
    [/stroke-width="3.5"/.test(dueCopie[0]), /stroke-width="3.5"/.test(dueCopie[1]),
     attr(dueCopie[0], 'fill')]);
  check('e il numerino non intercetta il puntatore', 0,
    (segno(mkF, 'tre').match(/<text(?![^>]*pointer-events="none")/g) || []).length);

  /* ⚠️ Il controllo che conta più di tutti: il BERSAGLIO non cambia. Un segno
     che cresce col contenuto sposta il punto in cui la mano ha imparato a
     premere, e lo sposta proprio sui nodi più ricchi. */
  const bersaglio = (id) => {
    const c = cerchi(segno(mkF, id))[0] || '';
    const r = card(mkF, id).match(/<rect x="([-\d.]+)" y="([-\d.]+)"/) || [];
    return [n1(+attr(c, 'cx') - +r[1]), n1(+attr(c, 'cy') - +r[2]), +attr(c, 'r'), attr(c, 'fill-opacity')];
  };
  check('il bersaglio non si sposta di un pixel col numero delle fonti',
    [[W - 9, 11, 11, '0'], [W - 9, 11, 11, '0'], [W - 9, 11, 11, '0']],
    ['tre', 'una', 'vec'].map(bersaglio));
  // il numerino cresce verso l'interno della card, dove non c'è nessun altro
  // bersaglio: verso la porta ruberebbe spazio a un segno vivo
  check('il numerino cresce verso l\'interno, non verso la porta', ['end', true],
    [attr(dueCopie[0], 'text-anchor'),
     +attr(dueCopie[0], 'x') < +attr(cerchi(segno(mkF, 'tre'))[0], 'cx')]);

  /* Il conto disegnato si accorcia, l'attributo no: la card è larga 168px e un
     numero che si allarga senza limite prima o poi entra nelle parole. */
  const mkTanti = disegna({ nodi: [{ id: 'x', testo: 'Tantissime', fonti: Array.from({ length: 12 }, (_, i) => F(i)) },
                                   { id: 'y', testo: 'Altro' }], archi: [{ da: 'x', a: 'y' }] }, {});
  check('oltre il nove il numerino si accorcia, ma data-fonti dice il vero',
    ['12', '9+'],
    [attr(segno(mkTanti, 'x'), 'data-fonti'), (testi(segno(mkTanti, 'x'))[0].match(/>([^<]*)</) || [])[1]]);

  /* Una voce vuota nell'elenco non si conta: il numero sul nodo è la promessa
     di quante righe troverà chi apre la bolla. */
  const mkBuchi = disegna({ nodi: [{ id: 'x', testo: 'Con un buco', fonti: [F(1), null, undefined, F(2)] },
                                   { id: 'y', testo: 'Altro' }], archi: [{ da: 'x', a: 'y' }] }, {});
  check('una voce vuota non si conta: la bolla non prometterà una riga che non c\'è',
    ['2', 2], [attr(segno(mkBuchi, 'x'), 'data-fonti'), DIS.fontiDi({ fonti: [F(1), null, undefined, F(2)] }).length]);

  // la card deve dirsi apribile anche a chi ha SOLO l'elenco nuovo
  check('la card si dichiara apribile anche con il solo elenco nuovo',
    [true, true, true, false, false],
    ['tre', 'una', 'vec', 'no', 'vuoto'].map((id) => /data-apri="1"/.test(card(mkF, id))));

  /* La mappa si percorre anche da tastiera, una card per volta: senza il numero
     nell'etichetta un concetto con tre rimandi si annuncia identico a uno che
     non ne ha nessuno. */
  check('l\'etichetta della card nomina quante fonti ci sono',
    ['Tre fonti — 3 fonti', 'Una fonte — 1 fonte'],
    ['tre', 'una'].map((id) => attr(card(mkF, id), 'aria-label')));
  check('e sulla via vecchia resta il testo nudo, come è sempre stata',
    ['Solo rimando', 'Solo capitolo', 'Niente', 'Elenco vuoto'],
    ['vec', 'cap', 'no', 'vuoto'].map((id) => attr(card(mkF, id), 'aria-label')));
  check('anche il segno si annuncia per quello che farà', ['3 fonti — scegli quale aprire', 'Apri la fonte', 'Apri la fonte'],
    ['tre', 'una', 'vec'].map((id) => attr(segno(mkF, id), 'aria-label')));

  // fratello della card, non figlio: dentro erediterebbe il click che seleziona
  check('il segno resta FUORI dalla card, come prima', [true, false],
    [card(mkF, 'tre').length > 0, /mfonte/.test(card(mkF, 'tre'))]);
  // niente classi di colore: il PDF perde il foglio di stile
  check('tutto sta negli attributi, anche il numerino', [true, false],
    [/fill="#[0-9a-f]{6}"/.test(dueCopie[1]), /class=/.test(dueCopie[1])]);
}

/* ⚠️ L'ordine di emissione è portante: i bersagli invisibili si sovrappongono e
   in SVG vince l'ultimo disegnato. Con la card di fabbrica il centro della
   porta dista 15,8px da quello della fonte (r=12 e r=11: si toccano), e la
   fonte — che è il bersaglio più piccolo e più preciso — deve restare l'ultima
   delle due. Il numerino non entra in questo conto: è `pointer-events="none"`,
   e il cerchio invisibile della fonte è rimasto dov'era. */
sezione('Mappe — porta, fonte e ramo: l\'ordine di emissione non è cambiato');
{
  const mk = disegna(gFonti, { maniglie: true, chiudibili: { tre: 'aperto' } });
  const dove = (cls) => mk.indexOf('class="' + cls + '" data-id="tre"');
  check('porta → fonte → toggle, in quest\'ordine', [true, true],
    [dove('mporta') < dove('mfonte'), dove('mfonte') < dove('mtoggle')]);
  check('e ci sono tutti e tre', [true, true, true],
    [dove('mporta') > 0, dove('mfonte') > 0, dove('mtoggle') > 0]);

  /* La misura della sovrapposizione, scritta invece che ricordata: se un giorno
     qualcuno sposta un segno, questo numero glielo dice prima del disegno. */
  const centro = (cls) => {
    const g = gruppi(mk, cls).find((s) => s.indexOf('data-id="tre"') >= 0) || '';
    const c = cerchi(g)[0] || '';
    return { x: +attr(c, 'cx'), y: +attr(c, 'cy'), r: +attr(c, 'r') };
  };
  const p = centro('mporta'), f = centro('mfonte');
  check('i due bersagli invisibili distano 15,8px e si sovrappongono davvero',
    [15.8, true], [n1(Math.hypot(p.x - f.x, p.y - f.y)), Math.hypot(p.x - f.x, p.y - f.y) < p.r + f.r]);
}

/* ------------------------------------------------------- 2. il motore Percorso */

/* In Percorso `res.archi` sono i segmenti del filo numerato (`_filo`, `rel`
   vuoto) e i legami VERI stanno in `res.extra`, in filigrana. Il ciclo delle
   etichette guardava solo i primi: il motore che serve a leggere una mappa come
   una scaletta era l'unico in cui i verbi non si vedevano. */
sezione('Mappe — nel Percorso anche i legami in filigrana dicono il loro verbo');
{
  const gp = { nodi: [{ id: 'a', testo: 'A' }, { id: 'b', testo: 'B' }, { id: 'c', testo: 'C' }],
               archi: [{ da: 'a', a: 'b', rel: 'precede' }, { da: 'a', a: 'c', rel: 'richiede in parte' }] };
  const rp = ML.run(gp, { motore: 'percorso' });
  const sp = DIS.svg(rp, {}).markup;
  const fili = (rp.archi || []).filter((a) => a.e && a.e._filo);
  const veri = (rp.extra || []).filter((a) => a.e && a.e.rel);
  const suPunto = (mk, a) => mk.indexOf('<text x="' + n1(a.meta.x) + '" y="' + n1(a.meta.y) + '"') >= 0;
  const quante = (mk, s) => (mk.match(new RegExp('>' + s + '<', 'g')) || []).length;

  check('il presupposto: in Percorso il filo sta in archi e i legami veri in extra',
    [2, 2, 2], [rp.archi.length, fili.length, veri.length]);
  // due copie per parola: il contorno bianco e il testo
  check('ogni legame vero dice il suo verbo', [2, 2],
    [quante(sp, 'precede'), quante(sp, 'richiede in parte')]);
  check('e la parola sta sul punto di mezzo del proprio arco', [true, true],
    veri.map((a) => suPunto(sp, a)));
  /* Il filo numerato resta muto per costruzione: `rel` vuoto e `_filo` addosso.
     Il numero del passo lo dice già la card, e una parola su ogni segmento del
     serpente sarebbe rumore su ciò che si legge per primo. */
  check('il filo numerato resta muto: nessuna parola sui suoi segmenti', 0,
    fili.filter((a) => suPunto(sp, a)).length);

  const copie = sp.match(/<text[^>]*>precede<\/text>/g) || [];
  check('con l\'alone dietro, che il PDF non perde', [true, '#ffffff', false],
    [/stroke-width="3.5"/.test(copie[0]), attr(copie[0], 'fill'), /stroke-width/.test(copie[1])]);
  check('e prende il colore della famiglia del verbo, come su ogni altro motore',
    REL.coloreDi('precede'), attr(copie[1], 'fill'));
  /* Un `<text>` intercetta il puntatore, e la parola sta SOPRA il suo arco:
     senza questo il legame non si prenderebbe proprio da dove la mano lo cerca
     per primo (guasto 5.7). */
  check('nessuna parola ruba il click al proprio arco', 0,
    (sp.match(/<text(?![^>]*pointer-events="none")[^>]*>(precede|richiede)/g) || []).length);

  // la leva delle etichette vale anche qui: era l'altra metà del guasto
  check('opt.etichette «no» le spegne anche in filigrana', [0, 0],
    [quante(DIS.svg(rp, { etichette: 'no' }).markup, 'precede'),
     quante(DIS.svg(rp, { etichette: 'no' }).markup, 'richiede in parte')]);
  const brevi = DIS.svg(rp, { etichette: 'brevi' }).markup;
  check('e «brevi» accorcia anche in filigrana, alla prima parola', [2, 0, 2],
    [quante(brevi, 'richiede'), quante(brevi, 'richiede in parte'), quante(brevi, 'precede')]);

  // un legame senza verbo non deve produrre una parola vuota
  const senza = ML.run({ nodi: gp.nodi, archi: [{ da: 'a', a: 'b', rel: 'precede' }, { da: 'a', a: 'c' }] },
                       { motore: 'percorso' });
  const spSenza = DIS.svg(senza, {}).markup;
  check('un legame senza verbo non produce una parola vuota', [2, 0],
    [quante(spSenza, 'precede'), (spSenza.match(/<text[^>]*><\/text>/g) || []).length]);

  /* E sugli altri motori nulla è cambiato: la correzione doveva AGGIUNGERE un
     caso, non riscrivere quello che funzionava. */
  const alb = DIS.svg(ML.run(gp, { motore: 'albero' }), {}).markup;
  check('sull\'albero le parole sono quelle di prima, né una in più né una in meno',
    [2, 2], [quante(alb, 'precede'), quante(alb, 'richiede in parte')]);
  check('e nessuna di loro ruba il click al proprio arco', 0,
    (alb.match(/<text(?![^>]*pointer-events="none")[^>]*>(precede|richiede)/g) || []).length);
}

console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati') + ' (' + ok + ' ok)');
process.exit(ko ? 1 : 0);
