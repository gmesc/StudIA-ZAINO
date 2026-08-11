'use strict';
/**
 * Test delle due potature nuove del modello: la SOGLIA di profondità
 * (`entroProfondita`, cioè lo slider) e la MODALITÀ FOCUS su un nodo
 * (`focus`, cioè le voci del menu contestuale).
 *
 * Non provano che il codice giri: provano le promesse su cui si appoggerà
 * l'interfaccia, e sono quattro.
 *
 *  1. I livelli non si credono, si ricalcolano. Un `livello` scritto nel file è
 *     un'opinione: se la soglia lo ascoltasse, taglierebbe i nodi sbagliati e
 *     nessuno se ne accorgerebbe guardando lo schermo.
 *  2. Se non si nasconde niente, torna LO STESSO oggetto — identità, non copia
 *     uguale. È ciò che permette a chi disegna di dire `out.grafo === g` invece
 *     di confrontare due liste di nodi.
 *  3. I due conti che l'interfaccia mostra — `quanti` e `frontiera` — devono
 *     essere esatti: la frontiera è l'elenco dei segni «+n» da disegnare, e un
 *     segno di troppo (o di meno) è una bugia su che cosa è stato tolto.
 *  4. L'ingresso non si muove, e le potature si compongono: focus → profondità
 *     → rami chiusi, ognuna indipendente e idempotente.
 *
 *   node test/grafo-focus.js
 */

const G = require('../App/assets/mappa/grafo');

let ko = 0, ok = 0;
function check(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { ok++; return; }
  ko++;
  console.log('  ✗ ' + nome + '\n      atteso: ' + a + '\n      avuto:  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

/** Il controllo che vale per tutte: la potatura non deve toccare l'ingresso.
 *  ⚠️ È il più importante di tutti, perché `sanitizza` RISCRIVE il livello dei
 *  nodi che tocca: se lavorasse sugli originali invece che sulle copie, una
 *  potatura cambierebbe in silenzio il file dell'utente. */
function puro(nome, g, fn) {
  const prima = JSON.stringify(g);
  fn(g);
  check('l\'ingresso resta intatto — ' + nome, prima, JSON.stringify(g));
}

const ids = (x) => (x.nodi || []).map((n) => n.id).sort();

/* Un albero pulito, per la soglia. La foresta portante:
     r ─ a ─ a1 ─ a11
       │   └ a2
       └ b ─ b1
   Livelli topologici: r 0 · a,b 1 · a1,a2,b1 2 · a11 3.
   I `livello` scritti nei nodi sono BUGIE apposta: la soglia deve ignorarli. */
function albero() {
  return {
    nodi: [{ id: 'r', livello: 7 }, { id: 'a', livello: 0 }, { id: 'b' }, { id: 'a1', livello: 9 },
           { id: 'a2' }, { id: 'b1' }, { id: 'a11', livello: 1 }],
    archi: [{ da: 'r', a: 'a' }, { da: 'r', a: 'b' }, { da: 'a', a: 'a1' }, { da: 'a', a: 'a2' },
            { da: 'b', a: 'b1' }, { da: 'a1', a: 'a11' }]
  };
}

/* Biforcazioni e un ciclo (a1 → z → a1), per il fuoco. I cicli si rompono, non
   si buttano: `rompiCicli` inverte l'arco all'indietro, e la foresta portante
   che ne esce è
     r ─ a ─ a1 ─ z
       │   └ a2
       └ b ─ b1                                                           */
function ciclico() {
  return {
    nodi: [{ id: 'r' }, { id: 'a' }, { id: 'b' }, { id: 'a1' }, { id: 'a2' }, { id: 'b1' }, { id: 'z' }],
    archi: [{ da: 'r', a: 'a' }, { da: 'r', a: 'b' }, { da: 'a', a: 'a1' }, { da: 'a', a: 'a2' },
            { da: 'b', a: 'b1' }, { da: 'a1', a: 'z' }, { da: 'z', a: 'a1' }]
  };
}

/* ====================================================== la soglia (lo slider) */
sezione('Profondità — la soglia taglia sui livelli veri, non su quelli scritti');
{
  const g = albero();

  /* Il livello dichiarato dice r=7 e a11=1: se la soglia gli credesse, a 1
     resterebbero a11 e a, e sparirebbe la radice. */
  const uno = G.entroProfondita(g, 1);
  check('a profondità 1 restano radice e primo livello', ['a', 'b', 'r'], ids(uno.grafo));
  check('e i livelli usati sono quelli topologici, non quelli del file', false,
    Object.keys(uno.nascosti).indexOf('r') >= 0);
  check('quel che sta sotto la soglia è nascosto, tutto', ['a1', 'a11', 'a2', 'b1'],
    Object.keys(uno.nascosti).sort());

  const due = G.entroProfondita(g, 2);
  check('a profondità 2 cade solo la foglia più in basso', ['a', 'a1', 'a2', 'b', 'b1', 'r'], ids(due.grafo));
  const zero = G.entroProfondita(g, 0);
  check('a profondità 0 resta la sola radice', ['r'], ids(zero.grafo));

  sezione('Profondità — i due conti che l\'interfaccia deve mostrare');
  check('la frontiera è chi ha figli tagliati, e nessun altro', ['a', 'b'], uno.frontiera.slice().sort());
  check('e conta quanti nodi sono spariti SOTTO di lui, non quanti figli aveva',
    { a: 3, b: 1 }, uno.quanti);
  check('un nodo con i figli ancora tutti lì non è in frontiera', [], due.frontiera.filter((i) => i !== 'a1'));
  check('il conto scende con la profondità che sale', { a1: 1 }, due.quanti);
  check('dalla radice si conta l\'intera mappa sparita', { r: 6 }, zero.quanti);
  check('nascosti e conti si tengono: la somma dalla frontiera copre tutto ciò che manca',
    Object.keys(uno.nascosti).length, uno.frontiera.reduce((s, i) => s + uno.quanti[i], 0));

  sezione('Profondità — fuori scala non si costruisce niente: è lo STESSO oggetto');
  check('una soglia pari alla profondità massima non taglia', true, G.entroProfondita(g, 3).grafo === g);
  check('e nemmeno una più grande', true, G.entroProfondita(g, 99).grafo === g);
  check('nessuna soglia (null) lascia tutto', true, G.entroProfondita(g, null).grafo === g);
  check('e nemmeno indefinita o vuota taglia — «vuoto» non è zero',
    [true, true], [G.entroProfondita(g).grafo === g, G.entroProfondita(g, '').grafo === g]);
  check('una soglia negativa vuol dire «senza limite», non «via tutto»', true,
    G.entroProfondita(g, -1).grafo === g);
  check('e una che non è un numero si ignora invece di far saltare tutto', true,
    G.entroProfondita(g, 'due').grafo === g);
  check('quando non taglia, i tre conti sono vuoti', [{}, {}, []],
    [G.entroProfondita(g, 9).nascosti, G.entroProfondita(g, 9).quanti, G.entroProfondita(g, 9).frontiera]);
  check('lo slider legge stringhe, che è quello che dà un <input>', ['a', 'b', 'r'],
    ids(G.entroProfondita(g, '1').grafo));

  sezione('Profondità — idempotente: la seconda passata non trova più niente');
  check('ripotare al livello di prima restituisce lo stesso oggetto', true,
    G.entroProfondita(uno.grafo, 1).grafo === uno.grafo);
  check('e il grafo ridotto è già sano', [], G.sanitizza(uno.grafo).note.filter((n) => /inesistenti|doppio/.test(n)));

  puro('soglia', albero(), (x) => G.entroProfondita(x, 1));
  puro('soglia fuori scala', albero(), (x) => G.entroProfondita(x, 99));
}

/* ============================================================ i quattro fuochi */
sezione('Focus — i quattro modi, su un grafo con biforcazioni e un ciclo');
{
  const g = ciclico();

  const vic = G.focus(g, 'a', 'vicini');
  check('vicini: il nodo e ciò che lo tocca, in entrambi i versi',
    ['a', 'a1', 'a2', 'r'], ids(vic.grafo));
  check('e gli archi verso i spariti se ne vanno con loro', 3, vic.grafo.archi.length);

  check('vicini a due salti allarga di un giro',
    ['a', 'a1', 'a2', 'b', 'r', 'z'], ids(G.focus(g, 'a', 'vicini', { salti: 2 }).grafo));
  check('zero salti è legittimo e vuol dire «solo questo nodo»',
    ['a'], ids(G.focus(g, 'a', 'vicini', { salti: 0 }).grafo));
  check('senza salti dichiarati ne vale uno — e coincide con vicini()',
    G.vicini(g, 'a').sort(), ids(G.focus(g, 'a', 'vicini').grafo));

  check('parentela: antenati e discendenti, non i fratelli',
    ['a', 'a1', 'r', 'z'], ids(G.focus(g, 'a1', 'parentela').grafo));
  check('genitori: solo da dove viene',
    ['a', 'r'], ids(G.focus(g, 'a', 'genitori').grafo));
  check('figli: solo dove porta',
    ['a', 'a1', 'a2', 'z'], ids(G.focus(g, 'a', 'figli').grafo));
  const unione = (a, b) => Object.keys(a.concat(b).reduce((o, i) => (o[i] = 1, o), {})).sort();
  check('genitori e figli, rimessi insieme, danno esattamente parentela',
    ids(G.focus(g, 'a1', 'parentela').grafo),
    unione(ids(G.focus(g, 'a1', 'genitori').grafo), ids(G.focus(g, 'a1', 'figli').grafo)));
  check('ma dentro un ciclo le due metà si sovrappongono: z è antenato E discendente di a1',
    [true, true],
    [ids(G.focus(g, 'a1', 'genitori').grafo).indexOf('z') >= 0,
     ids(G.focus(g, 'a1', 'figli').grafo).indexOf('z') >= 0]);

  sezione('Focus — il ciclo si attraversa e non fa girare a vuoto');
  check('risalire dentro un ciclo finisce', ['a', 'a1', 'r', 'z'], ids(G.focus(g, 'z', 'genitori').grafo));
  check('scendere dentro un ciclo finisce', ['a1', 'z'], ids(G.focus(g, 'a1', 'figli').grafo));
  check('e il grafo ritagliato si tiene tutti e due gli archi del ciclo', 2,
    G.focus(g, 'a1', 'figli').grafo.archi.length);

  sezione('Focus — i conti: il segno si mette solo dove qualcosa è stato tolto SOTTO');
  check('chi ha perso un figlio è in frontiera', ['a1', 'r'], vic.frontiera.slice().sort());
  check('e sa quanti ne ha persi in tutto il ramo', { r: 3, a1: 1 }, vic.quanti);
  const giu = G.focus(g, 'a', 'figli');
  check('un fuoco che taglia di lato e di sopra non lascia nessun segno', [], giu.frontiera);
  check('ma dice lo stesso che cosa è sparito', ['b', 'b1', 'r'], Object.keys(giu.nascosti).sort());
  const su = G.focus(g, 'a', 'genitori');
  check('un fuoco all\'insù mette il segno sul nodo stesso', ['a', 'r'], su.frontiera.slice().sort());
  check('e il conto è tutto il sottoalbero che ha chiuso', { r: 5, a: 3 }, su.quanti);

  sezione('Focus — ciò che non si conosce non si taglia');
  check('un id che non esiste restituisce lo stesso oggetto', true, G.focus(g, 'mai-visto', 'vicini').grafo === g);
  check('e non lancia: i conti tornano vuoti', [{}, {}, []],
    [G.focus(g, 'mai-visto', 'vicini').nascosti, G.focus(g, 'mai-visto', 'vicini').quanti,
     G.focus(g, 'mai-visto', 'vicini').frontiera]);
  check('nemmeno un id nullo', [true, true],
    [G.focus(g, null, 'vicini').grafo === g, G.focus(g, undefined, 'parentela').grafo === g]);
  check('un modo sconosciuto non taglia mezza mappa: non taglia niente', true,
    G.focus(g, 'a', 'cugini').grafo === g);
  check('e nemmeno un modo mancante', true, G.focus(g, 'a').grafo === g);
  check('su un grafo vuoto non succede niente', true, G.focus({ nodi: [], archi: [] }, 'a', 'vicini').grafo.nodi.length === 0);

  sezione('Focus — idempotente e puro');
  ['vicini', 'parentela', 'genitori', 'figli'].forEach((modo) => {
    const f = G.focus(g, 'a1', modo);
    check('rifare lo stesso fuoco sul ridotto non toglie più niente — ' + modo, true,
      G.focus(f.grafo, 'a1', modo).grafo === f.grafo);
    puro('fuoco ' + modo, ciclico(), (x) => G.focus(x, 'a1', modo));
  });
}

/* ================================================== la fila delle tre potature */
sezione('Composizione — focus → profondità: l\'origine è il nodo a fuoco');
{
  const g = ciclico();

  /* Dopo un fuoco in giù il nodo a fuoco È la sorgente del grafo ridotto, e
     `sanitizza` gli assegna livello 0: la soglia riparte da lui senza che
     nessuno debba dirglielo. Sulla mappa intera la stessa soglia vuol dire
     un'altra cosa — ed è appunto il punto. */
  const f = G.focus(g, 'a', 'figli');
  check('sul ridotto la soglia 1 tiene il nodo a fuoco e un giro di figli',
    ['a', 'a1', 'a2'], ids(G.entroProfondita(f.grafo, 1).grafo));
  check('sulla mappa intera la stessa soglia dice un\'altra cosa',
    ['a', 'b', 'r'], ids(G.entroProfondita(g, 1).grafo));
  check('e il segno finisce sul nodo giusto del ridotto', [['a1'], { a1: 1 }],
    [G.entroProfondita(f.grafo, 1).frontiera, G.entroProfondita(f.grafo, 1).quanti]);

  /* Fuoco all'insù: gli antenati restano, e la vecchia radice varrebbe ancora
     zero. Senza dirlo, lo slider mangerebbe per primo proprio il nodo scelto —
     ed è il motivo per cui `opt.da` esiste. */
  const su = G.focus(albero(), 'a1', 'genitori');
  check('senza origine la soglia mangia il nodo appena messo a fuoco', true,
    !!G.entroProfondita(su.grafo, 0).nascosti.a1);
  check('con l\'origine sul nodo a fuoco non si taglia più niente', true,
    G.entroProfondita(su.grafo, 0, { da: 'a1' }).grafo === su.grafo);
  check('chi sta SOPRA l\'origine non si tocca mai', ['a', 'a1', 'r'],
    ids(G.entroProfondita(su.grafo, 0, { da: 'a1' }).grafo));

  sezione('Composizione — l\'origine sposta la soglia, non cambia la regola');
  const alb = albero();
  check('contare da «a» a profondità 0 dà lo stesso di contare dalla radice a 1',
    ids(G.entroProfondita(alb, 1).grafo), ids(G.entroProfondita(alb, 0, { da: 'a' }).grafo));
  check('e gli stessi conti', G.entroProfondita(alb, 1).quanti, G.entroProfondita(alb, 0, { da: 'a' }).quanti);
  check('un\'origine che non esiste si ignora e si torna alla radice',
    ids(G.entroProfondita(alb, 1).grafo), ids(G.entroProfondita(alb, 1, { da: 'fantasma' }).grafo));

  sezione('Composizione — profondità → rami chiusi: ognuna resta a casa sua');
  const p = G.entroProfondita(albero(), 2);
  const r = G.senzaRami(p.grafo, { a: 1 });
  check('chiudere un ramo dopo la soglia toglie il sottoalbero rimasto', ['b', 'b1', 'r', 'a'].sort(), ids(r.grafo));
  check('e i due conti non si confondono fra loro', [{ a1: 1 }, { a: 2 }], [p.quanti, r.quanti]);
  check('il tasto del ramo chiuso dice «chiuso», gli altri «aperto»',
    ['chiuso', 'aperto', 'aperto'], [r.chiudibili.a, r.chiudibili.r, r.chiudibili.b]);
  check('`chiudibili` è `frontiera` letta al contrario', ['a'], r.frontiera);
  puro('rami chiusi dopo la soglia', albero(), (x) => G.senzaRami(G.entroProfondita(x, 2).grafo, { a: 1 }));

  sezione('Composizione — le tre potature parlano la stessa lingua');
  const forma = (o) => Object.keys(o).filter((k) => ['grafo', 'nascosti', 'quanti', 'frontiera'].indexOf(k) >= 0).sort();
  check('stesso contratto in uscita per tutte e tre',
    [['frontiera', 'grafo', 'nascosti', 'quanti'], ['frontiera', 'grafo', 'nascosti', 'quanti'],
     ['frontiera', 'grafo', 'nascosti', 'quanti']],
    [forma(G.focus(g, 'a', 'vicini')), forma(G.entroProfondita(g, 1)), forma(G.senzaRami(g, { a: 1 }))]);

  /* La meccanica dei conti è una sola, condivisa dalle tre: due potature che
     per strade diverse finiscono col nascondere gli STESSI nodi devono dare gli
     stessi conti, altrimenti erano due meccaniche travestite da una. Qui
     chiudere il ramo di a1 e tagliare sotto il livello 2 tolgono entrambe il
     solo a11. */
  const perRamo = G.senzaRami(albero(), { a1: 1 });
  const perSoglia = G.entroProfondita(albero(), 2);
  check('due potature diverse tolgono lo stesso nodo', [['a11'], ['a11']],
    [Object.keys(perRamo.nascosti), Object.keys(perSoglia.nascosti)]);
  check('e allora danno per forza la stessa frontiera e lo stesso conto',
    [['a1'], { a1: 1 }], [perSoglia.frontiera, perSoglia.quanti]);
  check('gli stessi che dà la chiusura del ramo',
    [perRamo.frontiera, perRamo.quanti], [perSoglia.frontiera, perSoglia.quanti]);
}

console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati') + ' (' + ok + ' ok)');
process.exit(ko ? 1 : 0);
