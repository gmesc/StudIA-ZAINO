'use strict';
/**
 * Test delle OPERAZIONI di modifica del grafo di una mappa.
 *
 * Non prova che il codice giri: prova le PROMESSE su cui si appoggia
 * l'interfaccia — che il grafo di ingresso non si muova mai, che eliminando un
 * padre i figli restino, che invertire un arco ne svuoti il verbo, che il verbo
 * si salvi come è stato battuto e che famiglia e colore non finiscano mai nel
 * file. Sono esattamente le cose che, sbagliate, non si vedono a schermo.
 *
 * Con l'estrazione (§3 del piano) se ne aggiungono altre tre della stessa
 * specie: che nessuno possa fabbricare a mano un nodo `origine:'generata'`, che
 * il rimando appeso al grafo sia una COPIA e non resti legato a chi l'ha
 * passato, e che liberare una posizione TOLGA `x` e `y` invece di azzerarle —
 * uno zero salvato è una posizione, e il motore lo onorerebbe.
 *
 *   node test/modifica.js
 */

const M = require('../App/assets/mappa/modifica');
const G = require('../App/assets/mappa/grafo');
const REL = require('../App/assets/mappa/relazioni');

let ko = 0, ok = 0;
function check(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { ok++; return; }
  ko++;
  console.log('  ✗ ' + nome + '\n      atteso: ' + a + '\n      avuto:  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

/** Il controllo che vale per tutte: l'operazione non deve toccare l'ingresso. */
function puro(nome, g, fn) {
  const prima = JSON.stringify(g);
  fn(g);
  check('l\'ingresso resta intatto — ' + nome, prima, JSON.stringify(g));
}

/* Grafo di prova. La foresta portante che ne esce:
     n1 ─ n2 ─ n4
        │    └ n5
        └ n3 ─ n6        (n5→n6 esiste ma NON è il legame portante di n6)
   Serve così: la cascata del colore deve seguire l'albero, non tutti gli archi. */
function base() {
  return {
    titolo: 'Mappa di prova',
    nodi: [
      { id: 'n1', testo: 'Radice', origine: 'generata' },
      { id: 'n2', testo: 'Economia', origine: 'generata' },
      { id: 'n3', testo: 'Diritto', origine: 'generata' },
      { id: 'n4', testo: 'Mercato', origine: 'generata' },
      { id: 'n5', testo: 'Prezzo', origine: 'generata' },
      { id: 'n6', testo: 'Contratto', origine: 'generata' }
    ],
    archi: [
      { da: 'n1', a: 'n2', rel: 'comprende' },
      { da: 'n1', a: 'n3', rel: 'comprende' },
      { da: 'n2', a: 'n4', rel: '' },
      { da: 'n2', a: 'n5', rel: '' },
      { da: 'n3', a: 'n6', rel: '' },
      { da: 'n5', a: 'n6', rel: 'richiede' }
    ]
  };
}
const testi = (g) => g.nodi.map((n) => n.id);
const legami = (g) => g.archi.map((e) => e.da + '→' + e.a);

// ------------------------------------------------------------- 0. la foresta
sezione('Il grafo di prova è quello che credo che sia');
{
  const s = G.sanitizza(base());
  check('n6 pende da n3, non da n5', 'n3', s.genitore.n6);
  check('i figli di n2', ['n4', 'n5'], s.figli.n2);
}

// ----------------------------------------------------------------- 1. nodi
sezione('creaNodo');
{
  const g = base();
  const g2 = M.creaNodo(g, { testo: 'Inflazione', comeFiglioDi: 'n2' });
  const nuovo = g2.nodi[g2.nodi.length - 1];

  check('il nodo nuovo c\'è', 'Inflazione', nuovo.testo);
  check('nasce sempre dell\'utente', 'utente', nuovo.origine);
  check('l\'id del nuovo si legge in .nuovo', nuovo.id, g2.nuovo);
  check('.nuovo non finisce nel file salvato', undefined, JSON.parse(JSON.stringify(g2)).nuovo);
  check('l\'arco dal genitore c\'è', true, legami(g2).indexOf('n2→' + nuovo.id) >= 0);
  check('il grafo di partenza aveva 6 nodi, il nuovo ne ha 7', [6, 7], [g.nodi.length, g2.nodi.length]);
  check('le chiavi in più del grafo non si perdono', 'Mappa di prova', g2.titolo);
  puro('creaNodo', base(), (x) => M.creaNodo(x, { testo: 'X', comeFiglioDi: 'n2' }));

  // fratello: prende il genitore di chi gli sta accanto
  const g3 = M.creaNodo(base(), { testo: 'Moneta', vicinoA: 'n4' });
  check('un fratello di n4 pende da n2', 'n2', G.sanitizza(g3).genitore[g3.nuovo]);

  // fratello di una radice: resta radice, non si aggancia da nessuna parte
  const g4 = M.creaNodo(base(), { testo: 'Seconda radice', vicinoA: 'n1' });
  check('il fratello di una radice è una radice', undefined, G.sanitizza(g4).genitore[g4.nuovo]);
  check('e non nasce nessun arco', 6, g4.archi.length);

  // senza genitore: nodo flottante (il doppio click sul vuoto)
  const g5 = M.creaNodo(base(), { testo: 'Isolato', x: 120, y: -40 });
  check('un nodo creato nel vuoto non ha archi', 6, g5.archi.length);
  check('e porta con sé la posizione', [120, -40], [g5.nodi[6].x, g5.nodi[6].y]);

  // un genitore che non esiste non fa saltare niente: il nodo nasce comunque
  const g6 = M.creaNodo(base(), { testo: 'Orfano', comeFiglioDi: 'nZZ' });
  check('un genitore inesistente non impedisce il nodo', [7, 6], [g6.nodi.length, g6.archi.length]);

  // testo vuoto: è il caso NORMALE (l'interfaccia apre subito la casella)
  check('il testo vuoto è lecito', '', M.creaNodo(base(), {}).nodi[6].testo);
}

sezione('creaNodo — le opzioni di prima, identiche a prima');
{
  // La rete che protegge L2: i gesti sulla tela chiamano queste stesse opzioni,
  // e le tre nuove non devono aver cambiato di una virgola quello che c'era.
  check('un nodo dell\'utente ha esattamente i campi di sempre',
    ['id', 'testo', 'origine'], Object.keys(M.creaNodo(base(), { testo: 'x' }).nodi[6]));
  check('con la posizione, quelli', ['id', 'testo', 'origine', 'x', 'y'],
    Object.keys(M.creaNodo(base(), { x: 1, y: 2 }).nodi[6]));
  check('il colore scelto a mano si scrive', '#0aa',
    M.creaNodo(base(), { colore: '#0aa' }).nodi[6].colore);
  check('un colore vuoto non lascia la chiave', false,
    'colore' in M.creaNodo(base(), { colore: '' }).nodi[6]);
  check('comeFiglioDi aggancia ancora', 'n2',
    G.sanitizza(M.creaNodo(base(), { comeFiglioDi: 'n2' })).genitore.u1);
  check('vicinoA prende ancora il genitore del fratello', 'n2',
    G.sanitizza(M.creaNodo(base(), { vicinoA: 'n4' })).genitore.u1);
}

sezione('creaNodo — origine, rimando, nota, capitolo: il nodo estratto (§3)');
{
  // ---- l'origine
  check('di fabbrica il nodo è dell\'utente', 'utente', M.creaNodo(base(), {}).nodi[6].origine);
  check('«fonte» si può chiedere', 'fonte', M.creaNodo(base(), { origine: 'fonte' }).nodi[6].origine);
  check('«generata» NO: quella marca la mette solo mappe.daGrafo', 'utente',
    M.creaNodo(base(), { origine: 'generata' }).nodi[6].origine);
  check('e nemmeno un\'origine inventata', 'utente',
    M.creaNodo(base(), { origine: 'chissà' }).nodi[6].origine);
  check('un\'origine rifiutata non fa sparire il nodo', ['Inflazione', 7],
    (() => { const g = M.creaNodo(base(), { origine: 'generata', testo: 'Inflazione' });
             return [g.nodi[6].testo, g.nodi.length]; })());
  check('nessun nodo si può fabbricare a mano come «generata»', false,
    /"origine": ?"generata"/.test(JSON.stringify(
      M.creaNodo({ nodi: [], archi: [] }, { origine: 'generata' }))));

  // ---- il rimando: sul nodo, e COPIATO
  const r = { type: 'video', file: '03', t: 615, label: 'Lezione 3 — 10:15' };
  const g = M.creaNodo(base(), { testo: 'Il mercato', origine: 'fonte', rimando: r });
  check('il rimando finisce sul nodo', r, g.nodi[6].rimando);
  check('ma non è lo stesso oggetto', false, g.nodi[6].rimando === r);
  r.t = 9999; r.label = 'ROVINATO';
  check('mutare l\'originale non tocca il grafo', [615, 'Lezione 3 — 10:15'],
    [g.nodi[6].rimando.t, g.nodi[6].rimando.label]);

  // ⚠️ e la copia deve reggere anche dopo: `copia()` CONDIVIDE il rimando di
  // proposito, quindi un rimando entrato per riferimento resterebbe legato a chi
  // l'ha passato per tutta la vita della mappa, non solo alla creazione
  const dopo = M.rinomina(M.colora(g, 'u1', '#0aa', {}), 'n2', 'Macro');
  r.file = 'ALTRO';
  check('nemmeno dopo una catena di altre operazioni', '03', dopo.nodi[6].rimando.file);

  check('senza rimando la chiave non c\'è proprio', false, 'rimando' in M.creaNodo(base(), {}).nodi[6]);
  check('un rimando che non è un oggetto si ignora', false,
    'rimando' in M.creaNodo(base(), { rimando: 'video:03#t=615' }).nodi[6]);
  check('il rimando del PDF passa com\'è', { type: 'pdf', file: '07', page: 12, label: 'p. 12' },
    M.creaNodo(base(), { rimando: { type: 'pdf', file: '07', page: 12, label: 'p. 12' } }).nodi[6].rimando);

  // ---- la nota: è dove finisce l'anchor (la frase attorno al frammento)
  const anchor = 'Il prezzo di equilibrio si forma dove domanda e offerta si incontrano.';
  check('la nota si scrive sul nodo', anchor, M.creaNodo(base(), { nota: anchor }).nodi[6].nota);
  check('e si salva come è arrivata', '  Con  spazi  strani ',
    M.creaNodo(base(), { nota: '  Con  spazi  strani ' }).nodi[6].nota);
  check('una nota vuota non lascia una chiave vuota nel file', false,
    'nota' in M.creaNodo(base(), { nota: '' }).nodi[6]);

  // ---- il capitolo (l'altro puntatore che disegna.js sa rendere navigabile)
  check('il capitolo si porta dritto sul nodo, come numero', 3,
    M.creaNodo(base(), { capitolo: 3 }).nodi[6].capitolo);
  check('il capitolo 0 è un capitolo', 0, M.creaNodo(base(), { capitolo: 0 }).nodi[6].capitolo);
  check('la stringa vuota non è il capitolo zero', false,
    'capitolo' in M.creaNodo(base(), { capitolo: '' }).nodi[6]);
  check('e nemmeno una parola', false, 'capitolo' in M.creaNodo(base(), { capitolo: 'due' }).nodi[6]);

  // ---- l'ordine dei campi: identità prima, aspetto poi
  check('i campi del nodo estratto, nell\'ordine',
    ['id', 'testo', 'origine', 'rimando', 'nota', 'capitolo', 'x', 'y', 'colore'],
    Object.keys(M.creaNodo(base(), {
      testo: 't', origine: 'fonte', rimando: { type: 'pdf', page: 2 },
      nota: 'a', capitolo: 1, x: 0, y: 0, colore: '#111'
    }).nodi[6]));

  puro('creaNodo con rimando e nota', base(),
    (x) => M.creaNodo(x, { origine: 'fonte', rimando: { type: 'pdf', page: 4 }, nota: 'a', capitolo: 1 }));
}

sezione('estrai — chi dichiara una fonte deve saperla indicare');
{
  const r = { type: 'video', file: '07', t: 128, label: 'Lezione 7 — 2:08' };
  const g = M.estrai(base(), { testo: 'Prezzo di equilibrio', rimando: r, nota: 'la frase attorno' });
  const n = g.nodi[6];
  check('il nodo nasce dalla fonte', 'fonte', n.origine);
  check('col rimando addosso', ['video', '07', 128], [n.rimando.type, n.rimando.file, n.rimando.t]);
  check('e con la nota', 'la frase attorno', n.nota);
  check('l\'id torna in .nuovo anche da qui', n.id, g.nuovo);
  check('e nemmeno da qui finisce nel file', undefined, JSON.parse(JSON.stringify(g)).nuovo);
  r.t = 0;
  check('anche da estrai il rimando è una copia', 128, g.nodi[6].rimando.t);

  // il capitolo da solo basta: è il puntatore del §3.1, il frammento dal testo
  const c = M.estrai(base(), { testo: 'Dal capitolo', capitolo: 2, comeFiglioDi: 'n3' });
  check('il capitolo da solo è un puntatore buono', ['fonte', 2],
    [c.nodi[6].origine, c.nodi[6].capitolo]);
  check('e l\'aggancio al genitore funziona come in creaNodo', 'n3',
    G.sanitizza(c).genitore[c.nuovo]);
  check('il capitolo 0 è un puntatore, non un\'assenza', 'fonte',
    M.estrai(base(), { capitolo: 0 }).nodi[6].origine);

  /* SENZA puntatore: DECISIONE presa in modifica.js — il frammento non si butta,
     il nodo scende a 'utente'. Il testo è lavoro dell'utente, il puntatore è il
     contorno; un gesto che non fa niente e non lo dice è il guasto peggiore. */
  const senza = M.estrai(base(), { testo: 'Frammento senza puntatore' });
  check('il frammento non si perde', 7, senza.nodi.length);
  check('ma non dichiara una fonte che non sa indicare', 'utente', senza.nodi[6].origine);
  check('il testo è tutto lì', 'Frammento senza puntatore', senza.nodi[6].testo);
  check('e l\'id torna comunque, così l\'interfaccia apre la casella', 'u1', senza.nuovo);
  check('chi chiama distingue i due esiti leggendo l\'origine', ['fonte', 'utente'],
    [M.estrai(base(), { capitolo: 1 }).nodi[6].origine, senza.nodi[6].origine]);
  check('un rimando che non è un oggetto non è un puntatore', 'utente',
    M.estrai(base(), { rimando: 'video:07#t=128' }).nodi[6].origine);
  check('né lo è un capitolo vuoto', 'utente', M.estrai(base(), { capitolo: '' }).nodi[6].origine);
  check('senza puntatore non resta nemmeno mezza chiave sul nodo',
    ['id', 'testo', 'origine'], Object.keys(senza.nodi[6]));

  check('estrai senza opzioni non fa saltare niente', 7, M.estrai(base()).nodi.length);
  puro('estrai', base(), (x) => M.estrai(x, { testo: 'X', rimando: { type: 'pdf', file: '02', page: 9 } }));
}

sezione('id nuovi che non collidono');
{
  check('sul grafo generato il primo libero è u1', 'u1', M.prossimoId(base()));

  const g = M.creaNodo(M.creaNodo(base(), {}), {});
  check('due nodi di fila hanno id diversi', ['u1', 'u2'], [g.nodi[6].id, g.nodi[7].id]);

  // una mappa già lavorata, con buchi: l'id non si ricava dal CONTEGGIO dei nodi
  const usata = { nodi: [{ id: 'u1' }, { id: 'u3' }, { id: 'n1' }], archi: [] };
  check('salta gli id già presi', 'u2', M.prossimoId(usata));
  const dopo = M.creaNodo(usata, { testo: 'a' });
  check('e il nodo nato non ne calpesta nessuno', 4, new Set(dopo.nodi.map((n) => n.id)).size);

  // il caso che rompe un contatore: si elimina e si ricrea
  let h = M.creaNodo(base(), { testo: 'primo' });           // u1
  const primo = h.nuovo;
  h = M.creaNodo(h, { testo: 'secondo' });                  // u2
  h = M.eliminaNodo(h, primo);
  h = M.creaNodo(h, { testo: 'terzo' });
  check('dopo un\'eliminazione l\'id libero si riusa senza doppioni',
    h.nodi.length, new Set(h.nodi.map((n) => n.id)).size);
}

sezione('rinomina');
{
  const g2 = M.rinomina(base(), 'n3', 'Diritto privato');
  check('il testo cambia', 'Diritto privato', g2.nodi[2].testo);
  check('il testo si salva come è battuto', '  L\'Analisi   COSTI-benefici ',
    M.rinomina(base(), 'n3', '  L\'Analisi   COSTI-benefici ').nodi[2].testo);
  check('un id sconosciuto non cambia niente', JSON.stringify(base().nodi),
    JSON.stringify(M.rinomina(base(), 'nZZ', 'x').nodi));
  puro('rinomina', base(), (x) => M.rinomina(x, 'n3', 'altro'));
}

sezione('eliminaNodo — i figli restano flottanti (regola di Braynr)');
{
  const g2 = M.eliminaNodo(base(), 'n2');
  check('il nodo se n\'è andato', ['n1', 'n3', 'n4', 'n5', 'n6'], testi(g2));
  check('i figli sono ancora tutti lì', true, testi(g2).indexOf('n4') >= 0 && testi(g2).indexOf('n5') >= 0);
  check('gli archi che lo toccavano se ne sono andati con lui',
    ['n1→n3', 'n3→n6', 'n5→n6'], legami(g2));

  const s = G.sanitizza(g2);
  check('n4 è rimasto senza genitore', undefined, s.genitore.n4);
  check('n4 è ora una radice', true, s.radici.indexOf('n4') >= 0);
  check('ma n5→n6, che non toccava n2, sopravvive', 'n5', s.genitore.n6);

  check('un id sconosciuto non cambia niente', [6, 6],
    [M.eliminaNodo(base(), 'nZZ').nodi.length, M.eliminaNodo(base(), 'nZZ').archi.length]);
  puro('eliminaNodo', base(), (x) => M.eliminaNodo(x, 'n2'));
}

// ---------------------------------------------------------------- 2. archi
sezione('creaArco');
{
  check('l\'arco nasce', true, legami(M.creaArco(base(), 'n4', 'n6', {})).indexOf('n4→n6') >= 0);
  check('niente cappi', 6, M.creaArco(base(), 'n4', 'n4', {}).archi.length);
  check('niente doppioni nello stesso verso', 6, M.creaArco(base(), 'n1', 'n2', {}).archi.length);
  check('il verso opposto invece è un\'altra affermazione', 7, M.creaArco(base(), 'n2', 'n1', {}).archi.length);
  check('un capo inesistente non crea niente', 6, M.creaArco(base(), 'n1', 'nZZ', {}).archi.length);

  const b = M.creaArco(base(), 'n4', 'n6', { bidir: true, rel: 'è simile a' });
  check('la doppia punta e il verbo si salvano', [true, 'è simile a'],
    [b.archi[6].bidir, b.archi[6].rel]);
  check('bidir falso non si scrive proprio', undefined,
    M.creaArco(base(), 'n4', 'n6', {}).archi[6].bidir);
  check('un doppione del verso opposto di un arco bidirezionale è comunque un doppione',
    7, M.creaArco(b, 'n6', 'n4', {}).archi.length);
  puro('creaArco', base(), (x) => M.creaArco(x, 'n4', 'n6', { rel: 'x' }));
}

sezione('eliminaArco');
{
  check('l\'arco se ne va', ['n1→n2', 'n1→n3', 'n2→n4', 'n2→n5', 'n5→n6'],
    legami(M.eliminaArco(base(), 'n3', 'n6')));
  check('nel verso sbagliato non tocca niente', 6, M.eliminaArco(base(), 'n6', 'n3').archi.length);

  // un legame a doppia punta non ha un capo privilegiato: si cancella da tutti e due
  const b = M.creaArco(base(), 'n4', 'n6', { bidir: true });
  check('un bidirezionale si cancella anche dall\'altro capo', 6, M.eliminaArco(b, 'n6', 'n4').archi.length);
  puro('eliminaArco', base(), (x) => M.eliminaArco(x, 'n3', 'n6'));
}

sezione('inverti — scambia i capi E SVUOTA IL VERBO');
{
  const g2 = M.inverti(base(), 'n5', 'n6');
  const e = g2.archi[5];
  check('i capi sono scambiati', ['n6', 'n5'], [e.da, e.a]);
  check('il verbo è sparito', '', e.rel);
  check('«A richiede B» invertito non resta «richiede»', false, /richiede/.test(JSON.stringify(g2.archi)));
  check('l\'arco resta al suo posto nell\'ordine', 6, g2.archi.length);
  check('gli altri verbi non si toccano', ['comprende', 'comprende'],
    [g2.archi[0].rel, g2.archi[1].rel]);

  // invertire dove il verso opposto esiste già: l'originale se ne va, non nasce un gemello
  const doppio = M.creaArco(base(), 'n6', 'n3', { rel: 'deriva da' });
  const g3 = M.inverti(doppio, 'n3', 'n6');
  check('l\'inversione non crea un doppione', 6, g3.archi.length);
  check('e sopravvive quello che c\'era, col suo verbo', 'deriva da',
    g3.archi[g3.archi.length - 1].rel);

  check('un arco inesistente non cambia niente', 6, M.inverti(base(), 'n4', 'n6').archi.length);
  puro('inverti', base(), (x) => M.inverti(x, 'n5', 'n6'));
}

sezione('etichetta — la linking word, come è stata battuta');
{
  const battuto = '  È  Condizione Di ';
  const g2 = M.etichetta(base(), 'n2', 'n4', battuto);
  check('il verbo è salvato identico', battuto, g2.archi[2].rel);
  check('la famiglia si RICAVA leggendo', 'dipendenza', REL.famigliaDi(g2.archi[2].rel));
  check('e con lei il colore', REL.FAMIGLIE.dipendenza.colore, REL.coloreDi(g2.archi[2].rel));

  check('l\'arco salvato ha solo i suoi campi', ['da', 'a', 'rel'], Object.keys(g2.archi[2]));
  const salvato = JSON.stringify(g2);
  check('«famiglia» non finisce mai nel grafo', false, /famiglia/i.test(salvato));
  check('nessun colore finisce sugli archi', false,
    /colore/i.test(JSON.stringify(g2.archi)) || /hsl\(/.test(salvato));

  check('si può anche togliere il verbo', '', M.etichetta(base(), 'n1', 'n2', '').archi[0].rel);
  check('un arco inesistente non cambia niente', JSON.stringify(base().archi),
    JSON.stringify(M.etichetta(base(), 'n4', 'n6', 'causa').archi));

  // il verbo cambia, il colore lo segue perché non è mai stato salvato
  const prima = REL.coloreDi(M.etichetta(base(), 'n2', 'n4', 'causa').archi[2].rel);
  const dopo = REL.coloreDi(M.etichetta(M.etichetta(base(), 'n2', 'n4', 'causa'), 'n2', 'n4', 'si oppone a').archi[2].rel);
  check('correggere il verbo cambia davvero il colore letto', true, prima !== dopo);
  puro('etichetta', base(), (x) => M.etichetta(x, 'n2', 'n4', 'causa'));
}

sezione('direzione');
{
  const b = M.direzione(base(), 'n5', 'n6', true);
  check('la doppia punta si accende', true, b.archi[5].bidir);
  check('e si spegne dall\'altro capo', undefined, M.direzione(b, 'n6', 'n5', false).archi[5].bidir);
  puro('direzione', base(), (x) => M.direzione(x, 'n5', 'n6', true));
}

// ------------------------------------------------------- 3. colore, posizione
sezione('colora');
{
  const uno = M.colora(base(), 'n2', '#ff0000', {});
  check('senza cascata colora solo lui', ['#ff0000'],
    uno.nodi.filter((n) => n.colore).map((n) => n.colore));
  check('ed è proprio n2', ['n2'], uno.nodi.filter((n) => n.colore).map((n) => n.id));

  const casc = M.colora(base(), 'n2', '#ff0000', { aCascata: true });
  check('la cascata scende su tutto il sottoalbero', ['n2', 'n4', 'n5'],
    casc.nodi.filter((n) => n.colore === '#ff0000').map((n) => n.id));
  check('e si ferma dove finisce il ramo: n6 pende da n3, non da n5', undefined,
    casc.nodi.find((n) => n.id === 'n6').colore);
  check('né risale al genitore', undefined, casc.nodi.find((n) => n.id === 'n1').colore);

  // su una foglia la cascata non ha niente da fare
  check('la cascata da una foglia colora solo la foglia', ['n4'],
    M.colora(base(), 'n4', '#0f0', { aCascata: true }).nodi.filter((n) => n.colore).map((n) => n.id));

  // il ramo chiuso: la cascata segue il grafo che le si dà
  const potato = G.senzaRami(base(), ['n2']).grafo;
  check('su un grafo potato la cascata si ferma col disegno', ['n2'],
    M.colora(potato, 'n2', '#00f', { aCascata: true }).nodi.filter((n) => n.colore).map((n) => n.id));

  // togliere il colore vuol dire TOGLIERE la chiave, non scriverci dentro il vuoto
  const azzerato = M.colora(casc, 'n2', null, { aCascata: true });
  check('il colore si toglie davvero', [],
    azzerato.nodi.filter((n) => 'colore' in n).map((n) => n.id));
  check('e non resta una stringa vuota nel file', false, /"colore"/.test(JSON.stringify(azzerato)));

  check('un id sconosciuto non colora niente', 0,
    M.colora(base(), 'nZZ', '#fff', { aCascata: true }).nodi.filter((n) => n.colore).length);
  puro('colora', base(), (x) => M.colora(x, 'n2', '#ff0000', { aCascata: true }));
}

sezione('sposta');
{
  const g2 = M.sposta(base(), 'n4', { x: 12.5, y: -300 });
  check('la posizione si scrive sul nodo', [12.5, -300], [g2.nodi[3].x, g2.nodi[3].y]);
  check('solo su quel nodo', 1, g2.nodi.filter((n) => n.x != null).length);
  check('niente flag «fissato» accanto: la presenza di x e y È il flag',
    ['id', 'testo', 'origine', 'x', 'y'], Object.keys(g2.nodi[3]));
  check('una coordinata non numerica non scrive niente', undefined,
    M.sposta(base(), 'n4', { x: 'qui', y: 3 }).nodi[3].x);
  check('un id sconosciuto non cambia niente', JSON.stringify(base().nodi),
    JSON.stringify(M.sposta(base(), 'nZZ', { x: 1, y: 2 }).nodi));
  puro('sposta', base(), (x) => M.sposta(x, 'n4', { x: 1, y: 2 }));
}

/* Ciò che questo modulo SCRIVE deve sempre soddisfare `fissato()`: sono le due
   metà della stessa regola, e finché nessun motore leggeva le coordinate
   potevano divergere senza che si vedesse. `+null` e `+''` fanno zero, e uno
   zero è una posizione: un chiamante distratto avrebbe inchiodato il nodo
   nell'origine, per sempre e in silenzio. */
sezione('quel che si scrive è sempre «fissato»: nessuno zero per sbaglio');
{
  const nonPunti = [null, '', false, undefined, NaN, Infinity, '120', {}, []];
  nonPunti.forEach((v) => {
    const s = M.sposta(base(), 'n4', { x: v, y: v });
    check('sposta non accetta ' + JSON.stringify(v), [undefined, undefined],
      [s.nodi[3].x, s.nodi[3].y]);
    const c = M.creaNodo(base(), { testo: 'X', x: v, y: v });
    const n = c.nodi[c.nodi.length - 1];
    check('creaNodo non accetta ' + JSON.stringify(v), [false, undefined, undefined],
      [M.fissato(n), n.x, n.y]);
  });
  check('mezza coordinata non fissa niente, nemmeno alla creazione', false,
    M.fissato(M.creaNodo(base(), { x: 10 }).nodi[6]));
  const buono = M.creaNodo(base(), { testo: 'X', x: 0, y: -7.5 });
  check('un punto vero invece si scrive, zero compreso', [true, 0, -7.5],
    [M.fissato(buono.nodi[6]), buono.nodi[6].x, buono.nodi[6].y]);
  check('e la stessa regola vale per sposta', true,
    M.fissato(M.sposta(base(), 'n4', { x: 0, y: 0 }).nodi[3]));
}

/* La definizione vive in `grafo.js` (il motore non può dipendere dalle
   operazioni); qui c'è una porta. Che sia una porta e non una seconda copia lo
   dice questo controllo: se qualcuno riscrivesse la condizione a mano, i due
   verdetti divergerebbero al primo caso limite. */
sezione('fissato è la stessa funzione di grafo.js, non una copia');
{
  const casi = [{ x: 1, y: 2 }, { x: 0, y: 0 }, { x: '1', y: '2' }, { x: null, y: null },
    { x: 1 }, { y: 2 }, { x: NaN, y: 1 }, { x: Infinity, y: 1 }, {}];
  check('stesso verdetto su ogni caso limite',
    casi.map((n) => G.fissato(n)), casi.map((n) => M.fissato(n)));
}

/* Il contratto condiviso col motore e col menu: un nodo è fissato SE E SOLO SE
   ha x e y, tutti e due numeri finiti. Non c'è nessun flag: le coordinate sono
   il flag. Quindi liberare vuol dire TOGLIERE le chiavi, non azzerarle. */
sezione('fissato — la presenza delle coordinate È il flag');
{
  const fissa = M.sposta(M.sposta(base(), 'n4', { x: 10, y: 20 }), 'n5', { x: 0, y: 0 });
  check('un nodo spostato è fissato', true, M.fissato(fissa.nodi[3]));
  check('lo zero è una posizione, non un\'assenza', true, M.fissato(fissa.nodi[4]));
  check('un nodo mai spostato non lo è', false, M.fissato(fissa.nodi[0]));
  check('mezza coordinata non è una posizione', [false, false],
    [M.fissato({ id: 'a', x: 5 }), M.fissato({ id: 'a', y: 5 })]);
  check('e nemmeno una coordinata scritta come stringa', false, M.fissato({ id: 'a', x: '5', y: '5' }));
  check('null non è zero', false, M.fissato({ id: 'a', x: null, y: null }));
  check('né lo è la stringa vuota', false, M.fissato({ id: 'a', x: '', y: '' }));
  check('un non-nodo non fa saltare niente', [false, false], [M.fissato(null), M.fissato(undefined)]);
}

sezione('libera / liberaTutte — togliere le coordinate, non azzerarle');
{
  const fissa = M.sposta(M.sposta(base(), 'n4', { x: 10, y: 20 }), 'n5', { x: 0, y: 0 });

  const l = M.libera(fissa, 'n4');
  check('le chiavi se ne vanno DAVVERO', [false, false], ['x' in l.nodi[3], 'y' in l.nodi[3]]);
  check('non restano azzerate', undefined, l.nodi[3].x);
  check('e non restano nel file', ['id', 'testo', 'origine'], Object.keys(l.nodi[3]));
  check('per il motore quel nodo non è più fissato', false, M.fissato(l.nodi[3]));
  check('il resto del nodo non si tocca', ['Mercato', 'generata'], [l.nodi[3].testo, l.nodi[3].origine]);
  check('gli altri nodi nemmeno', [0, 0], [l.nodi[4].x, l.nodi[4].y]);
  check('archi e titolo restano dov\'erano', [6, 'Mappa di prova'], [l.archi.length, l.titolo]);
  check('dice quante posizioni ha liberato', 1, l.liberate);
  check('e il conteggio non finisce nel file', undefined, JSON.parse(JSON.stringify(l)).liberate);

  check('un id sconosciuto non cambia niente', JSON.stringify(fissa.nodi),
    JSON.stringify(M.libera(fissa, 'nZZ').nodi));
  check('e non conta una posizione che non c\'era', [0, 0],
    [M.libera(fissa, 'nZZ').liberate, M.libera(fissa, 'n1').liberate]);
  check('liberare un nodo mai spostato non gli aggiunge niente',
    ['id', 'testo', 'origine'], Object.keys(M.libera(fissa, 'n1').nodi[0]));

  const t = M.liberaTutte(fissa);
  check('liberaTutte le toglie tutte', 0, t.nodi.filter((n) => 'x' in n || 'y' in n).length);
  check('nessun nodo resta fissato', 0, t.nodi.filter(M.fissato).length);
  check('e dice quante ne ha azzerate — è il numero del toast del cambio motore', 2, t.liberate);
  check('i nodi ci sono ancora tutti', 6, t.nodi.length);
  check('e gli archi pure', 6, t.archi.length);
  check('su una mappa senza posizioni non azzera niente', 0, M.liberaTutte(base()).liberate);
  check('il grafo senza posizioni resta identico a se stesso', JSON.stringify(base()),
    JSON.stringify(M.liberaTutte(base())));
  check('il colore scelto a mano sopravvive alla liberazione', '#0aa',
    M.liberaTutte(M.colora(fissa, 'n4', '#0aa', {})).nodi[3].colore);
  check('e così il rimando di un nodo estratto', 'pdf',
    M.liberaTutte(M.estrai(fissa, { rimando: { type: 'pdf', page: 3 }, x: 5, y: 5 })).nodi[6].rimando.type);

  puro('libera', fissa, (x) => M.libera(x, 'n4'));
  puro('liberaTutte', fissa, (x) => M.liberaTutte(x));
}

sezione('il cambio motore è distruttivo: passa dalla pila come tutte le altre');
{
  // §12.2 punto 3: cambiare motore azzera le posizioni manuali, quindi è
  // un'operazione distruttiva — e una distruttiva che non si annulla è un tasto
  // che butta via mezz'ora di sistemazione senza nemmeno nominarla.
  const p = M.pila();
  let g = M.sposta(M.sposta(base(), 'n4', { x: 10, y: 20 }), 'n5', { x: 30, y: 40 });

  const quante = M.liberaTutte(g).liberate;
  M.annullabile(p, 'Cambia motore: ' + quante + ' posizioni azzerate', g);
  g = M.liberaTutte(g);

  check('l\'etichetta può dire quante ne butta', 'Cambia motore: 2 posizioni azzerate', M.daAnnullare(p));
  check('e intanto le posizioni sono sparite davvero', 0, g.nodi.filter(M.fissato).length);
  const indietro = M.annulla(p).grafo;
  check('il ⌘Z le rimette tutte, con i loro valori', [10, 20, 30, 40],
    [indietro.nodi[3].x, indietro.nodi[3].y, indietro.nodi[4].x, indietro.nodi[4].y]);
}

// ----------------------------------------------------- 4. pila degli annulla
sezione('pila degli annullamenti');
{
  const p = M.pila();
  check('nasce vuota', '', M.daAnnullare(p));
  check('e non c\'è niente da annullare', null, M.annulla(p));

  let g = base();
  M.annullabile(p, M.descriviAzione('Elimina nodo', g, 'n2'), g);
  g = M.eliminaNodo(g, 'n2');
  check('l\'etichetta dice COSA si annulla', 'Elimina nodo: Economia', M.daAnnullare(p));
  check('intanto il nodo è sparito davvero', 5, g.nodi.length);

  const indietro = M.annulla(p);
  check('annulla restituisce lo stato di prima', 6, indietro.grafo.nodi.length);
  check('con la sua etichetta', 'Elimina nodo: Economia', indietro.etichetta);
  check('lo stato ripristinato è identico all\'originale', JSON.stringify(base()), JSON.stringify(indietro.grafo));
  check('e la pila si è svuotata', null, M.annulla(p));

  // due passi indietro, nell'ordine giusto
  const p2 = M.pila();
  let h = base();
  M.annullabile(p2, 'Rinomina', h); h = M.rinomina(h, 'n2', 'Macroeconomia');
  M.annullabile(p2, 'Elimina arco', h); h = M.eliminaArco(h, 'n1', 'n3');
  check('si torna prima all\'ultima operazione', ['Elimina arco', 'Macroeconomia'],
    [M.daAnnullare(p2), p2.stati[1].grafo.nodi[1].testo]);
  const uno = M.annulla(p2);
  check('e il grafo ripristinato ha ancora l\'arco', 6, uno.grafo.archi.length);
  const due = M.annulla(p2);
  check('poi si torna al nome di partenza', 'Economia', due.grafo.nodi[1].testo);

  // lo stato messo da parte è una COPIA: chi lavora sul grafo dopo non lo tocca
  const p3 = M.pila();
  const vivo = base();
  M.annullabile(p3, 'Prova', vivo);
  vivo.nodi[0].testo = 'ROVINATO';
  vivo.archi.push({ da: 'n4', a: 'n5', rel: 'x' });
  const messoDaParte = M.annulla(p3).grafo;
  check('la pila tiene una copia, non un riferimento', ['Radice', 6],
    [messoDaParte.nodi[0].testo, messoDaParte.archi.length]);

  // il tetto: il più vecchio se ne va per primo
  const p4 = M.pila(3);
  for (let i = 1; i <= 5; i++) M.annullabile(p4, 'passo ' + i, base());
  check('la pila non cresce oltre il tetto', 3, p4.stati.length);
  check('ed è la coda ad essere sopravvissuta', ['passo 3', 'passo 4', 'passo 5'],
    p4.stati.map((s) => s.etichetta));

  check('svuota azzera', ['', null], [M.daAnnullare(M.svuota(p4)), M.annulla(p4)]);
}

sezione('descriviAzione');
{
  const g = base();
  check('azione e nodo', 'Elimina nodo: Diritto', M.descriviAzione('Elimina nodo', g, 'n3'));
  check('un nodo senza testo non lascia i due punti a vuoto', 'Nuovo nodo',
    M.descriviAzione('Nuovo nodo', M.creaNodo(g, {}), 'u1'));
  check('un id sconosciuto nemmeno', 'Colora', M.descriviAzione('Colora', g, 'nZZ'));
  const lungo = M.rinomina(g, 'n3', 'Un titolo assai lungo che nel menu non ci starebbe mai per intero');
  check('il testo lungo si taglia una volta sola, qui', 40 + 'Rinomina: '.length,
    M.descriviAzione('Rinomina', lungo, 'n3').length);
}

// --------------------------------------------- 5. le operazioni in catena
sezione('una sessione vera, in catena');
{
  let g = base();
  const p = M.pila();

  M.annullabile(p, M.descriviAzione('Nuovo nodo', g, 'n2'), g);
  g = M.creaNodo(g, { testo: 'Inflazione', comeFiglioDi: 'n2' });
  const nuovo = g.nuovo;
  g = M.etichetta(g, 'n2', nuovo, 'causa');
  g = M.colora(g, 'n2', '#0aa', { aCascata: true });
  g = M.sposta(g, nuovo, { x: 40, y: 40 });
  g = M.inverti(g, 'n2', nuovo);

  check('il nodo è nato, l\'arco è girato e il verbo è caduto',
    [7, nuovo + '→n2', ''],
    [g.nodi.length, legami(g)[6], g.archi[6].rel]);
  check('la cascata ha preso anche il nuovo', true,
    g.nodi.find((n) => n.id === nuovo).colore === '#0aa');

  const s = G.sanitizza(g);
  check('il grafo resta sano dopo la catena', [], s.note.filter((n) => /inesistenti|doppio/.test(n)));

  const rimesso = M.annulla(p);
  check('un solo annulla riporta a prima di tutto', JSON.stringify(base()), JSON.stringify(rimesso.grafo));
}

/* ---------------- un nodo che È un'immagine ---------------------------------
   `disegna.js` sapeva già disegnare `nodo.immagine`, ma nessuno la metteva: il
   campo esisteva solo per chi lo legge. Ora l'album può appenderci un ritaglio. */
sezione('Un nodo può essere un\'immagine dell\'album');
{
  let g = M.creaNodo({ nodi: [], archi: [] }, { testo: 'Figura 3', immagine: { id: 'ab12cd34', w: 476, h: 420 } });
  const n = g.nodi[0];
  check('l\'immagine arriva sul nodo', { id: 'ab12cd34', w: 476, h: 420 }, n.immagine);

  /* ⚠️ Si COPIA, non si condivide: due nodi che puntassero allo stesso oggetto
     divergerebbero al primo salvataggio, ed è la regola già scritta per
     `rimando`. */
  const fonte = { id: 'ab12cd34', w: 10, h: 10 };
  const g2 = M.creaNodo({ nodi: [], archi: [] }, { testo: 'x', immagine: fonte });
  fonte.w = 999;
  check('è una copia, non l\'oggetto di chi chiama', 10, g2.nodi[0].immagine.w);

  /* Senza id non è un'immagine: `disegna.js` promette un ritaglio solo se sa
     quale, e un campo vuoto farebbe apparire un segnaposto che nessuno può
     riempire. Ciò che è vuoto non si scrive — la stessa regola del colore. */
  check('senza id non si scrive niente', undefined,
    M.creaNodo({ nodi: [], archi: [] }, { testo: 'x', immagine: { w: 10, h: 10 } }).nodi[0].immagine);
  check('e nemmeno con un\'immagine che non è un oggetto', undefined,
    M.creaNodo({ nodi: [], archi: [] }, { testo: 'x', immagine: 'ab12cd34' }).nodi[0].immagine);
  check('le misure storte cadono, l\'id resta', { id: 'ab12cd34' },
    M.creaNodo({ nodi: [], archi: [] }, { testo: 'x', immagine: { id: 'ab12cd34', w: 0, h: -3 } }).nodi[0].immagine);

  /* `estrai` è la porta che usa l'album: deve portarsi dietro l'immagine
     insieme al rimando che riporta alla pagina. */
  /* Il ridimensionamento è sempre PROPORZIONALE: un numero solo. */
  let gk = M.creaNodo({ nodi: [], archi: [] }, { testo: 'x', immagine: { id: 'aa11bb' } });
  const idk = gk.nuovo;
  check('di fabbrica la scala non si scrive', undefined, gk.nodi[0].immagine.scala);
  gk = M.ridimensionaImmagine(gk, idk, 1.5);
  check('ingrandire la scrive', 1.5, gk.nodi[0].immagine.scala);
  gk = M.ridimensionaImmagine(gk, idk, 1);
  check('e tornare a uno la toglie: ciò che è di fabbrica non sporca il file',
    undefined, gk.nodi[0].immagine.scala);
  check('oltre il tetto si ferma al tetto', 3,
    M.ridimensionaImmagine(gk, idk, 99).nodi[0].immagine.scala);
  check('e sotto il pavimento al pavimento', 0.5,
    M.ridimensionaImmagine(gk, idk, 0.01).nodi[0].immagine.scala);
  /* Ridimensionare ciò che non è un'immagine non vuol dire niente: inventare il
     campo su un nodo di testo lo farebbe disegnare come un ritaglio senza
     sorgente, cioè un segnaposto che nessuno ha chiesto. */
  const soloTesto = M.creaNodo({ nodi: [], archi: [] }, { testo: 'nudo' });
  check('un nodo senza immagine resta identico', JSON.stringify(soloTesto),
    JSON.stringify(M.ridimensionaImmagine(soloTesto, soloTesto.nuovo, 2)));

  const e = M.estrai({ nodi: [], archi: [] }, {
    testo: 'Il ciclo', immagine: { id: 'beef00', w: 100, h: 50 },
    rimando: { type: 'pdf', file: 'd.pdf', page: 7 }
  });
  check('estrai porta immagine e rimando insieme', ['beef00', 7, 'fonte'],
    [e.nodi[0].immagine.id, e.nodi[0].rimando.page, e.nodi[0].origine]);
}

/* ---------------- l'annulla si porta dietro anche le LEVE -------------------
   Richiamare una disposizione salvata cambia solo la vista: una pila che
   copiasse il solo grafo riporterebbe indietro i nodi lasciando il motore
   dov'era — un annulla che annulla per metà, cioè peggio di uno che non c'è. */
sezione('La pila degli annullamenti conosce anche ciò che non è grafo');
{
  const g0 = base();
  const p = M.pila(5);
  M.annullabile(p, 'Richiama «Visione d\'insieme»', g0,
    { vista: { motore: 'albero', orient: 'td' }, memorie: [null, { nome: 'X' }] });
  const r = M.annulla(p);
  check('le leve tornano indietro col grafo', { motore: 'albero', orient: 'td' }, r.extra.vista);
  /* ⚠️ E anche le disposizioni salvate. La prima versione copiava le sole leve,
     e svuotare uno slot mostrava un toast che PROMETTEVA «⌘Z lo riporta» mentre
     l'annulla non aveva le memorie: una promessa scritta e non mantenuta. */
  check('e con loro tutto il resto di ciò che si può perdere', 'X', r.extra.memorie[1].nome);
  check('e l\'etichetta dice che cosa si annulla', 'Richiama «Visione d\'insieme»', r.etichetta);

  /* Assente vuol dire «questa operazione non toccava le leve», non «leve vuote»:
     chi annulla deve poter distinguere i due casi, o rimetterebbe una vista
     vuota su una mappa che ne aveva una. */
  M.annullabile(p, 'Aggiungi nodo', g0);
  check('un\'operazione che tocca il solo grafo non inventa stato', undefined, M.annulla(p).extra);

  /* Si COPIA: l'oggetto è di chi chiama, e fra un annulla e l'altro cambia. */
  const viva = { vista: { motore: 'dag' } };
  M.annullabile(p, 'x', g0, viva);
  viva.vista.motore = 'anelli';
  check('lo stato messo da parte è una copia profonda', 'dag', M.annulla(p).extra.vista.motore);
}

sezione('Sostituire l\'immagine di un nodo: il pezzo prende il posto dell\'intera');
{
  const g = { nodi: [{ id: 'n1', testo: 'foto', immagine: { id: 'aaaa111111', w: 300, h: 200, scala: 1.5 } },
                     { id: 'n2', testo: 'senza immagine' }], archi: [] };
  const r = M.sostituisciImmagine(g, 'n1', { id: 'bbbb222222', w: 150, h: 100 });
  check('l\'immagine è quella nuova', 'bbbb222222', r.nodi[0].immagine.id);
  check('con le sue misure', [150, 100], [r.nodi[0].immagine.w, r.nodi[0].immagine.h]);
  /* ⚠️ La scala è la misura che l'utente ha dato al riquadro sulla mappa: non ha
     niente a che vedere con quale immagine ci sta dentro, e rifarla partire da 1
     disferebbe un aggiustamento fatto a mano. */
  check('e la scala del nodo si conserva', 1.5, r.nodi[0].immagine.scala);
  check('il grafo di partenza non si tocca', 'aaaa111111', g.nodi[0].immagine.id);
  check('un nodo senza immagine non ne guadagna una', undefined,
    M.sostituisciImmagine(g, 'n2', { id: 'cccc333333', w: 1, h: 1 }).nodi[1].immagine);
  check('un nodo che non esiste non cambia niente', 'aaaa111111',
    M.sostituisciImmagine(g, 'n9', { id: 'd', w: 1, h: 1 }).nodi[0].immagine.id);
}

console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati') + ' (' + ok + ' ok)');
process.exit(ko ? 1 : 0);
