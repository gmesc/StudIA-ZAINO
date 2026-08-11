'use strict';
/**
 * L'identità di un capitolo, e i riferimenti che non si devono staccare
 * (`App/assets/lettura/identita.js`).
 *
 * ⚠️ Che cosa si sta difendendo. Un appunto, un'evidenza, un nodo di mappa e un
 * rimando `cap:…` dicono a quale capitolo appartengono scrivendone l'id. Finché
 * quell'id dipendeva dalla POSIZIONE, una rigenerazione che infilava un
 * capitolo in mezzo spostava l'id di tutti quelli dopo — e ogni riferimento
 * scritto prima puntava al capitolo sbagliato. Senza un errore: le parole chiave
 * smettevano di accendersi, gli appunti finivano sotto «altri capitoli».
 *
 * ⚠️ E che cosa NON si può fare, contato sui 243 capitoli del vault: passare di
 * colpo all'id scritto nel frontmatter. Tutti ne hanno uno, e in TD74-DSA — 210
 * capitoli — quell'id NON coincide con il posizionale che il lettore usava,
 * mentre nei 33 di ai-literacy sì. Per i primi, tutto ciò che l'utente ha
 * scritto porta il nome vecchio: la catena dei nomi è l'unica strada che non
 * stacca niente.
 *
 *   node test/identita.js
 */

const I = require('../App/assets/lettura/identita.js');
const CAP = require('../App/assets/lettura/capitolo.js');

let ko = 0, ok = 0;
function check(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { ok++; return; }
  ko++;
  console.log('  ✗ ' + nome + '\n      atteso: ' + a + '\n      avuto:  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

const md = (fm, testo) => '---\n' + fm + '\n---\n\n## Contenuto\n\n' + (testo || 'testo') + '\n';
const parser = CAP.crea({});

sezione('L\'id si prende dal disco, non si inventa');
{
  const c = parser.mdChapter(md('id: td74-07-scrittura-c02\ntitle: Disgrafia'), '07-scrittura', 2);
  check('vale quello scritto nel frontmatter', 'td74-07-scrittura-c02', c.id);
  check('e il posizionale resta come alias', ['07-scrittura-c02'], c.alias);
  check('che è anche dichiarato a parte', '07-scrittura-c02', c.idLegacy);

  const senza = parser.mdChapter(md('title: Senza id'), '07-scrittura', 2);
  check('senza id sul disco si ricade sul posizionale', '07-scrittura-c02', senza.id);
  check('e allora non c\'è nessun alias da ricordare', [], senza.alias);

  /* Un id finisce dentro un attributo HTML e dentro un selettore: uno spazio lo
     spezza, una barra lo fa sembrare un percorso. Meglio il posizionale. */
  check('un id storto non viene creduto', '07-scrittura-c02',
    parser.mdChapter(md('id: "non valido/qui"\ntitle: T'), '07-scrittura', 2).id);
  check('e nemmeno uno vuoto', '07-scrittura-c02',
    parser.mdChapter(md('id: ""\ntitle: T'), '07-scrittura', 2).id);
}

sezione('Il capitolo risponde a tutti i suoi nomi');
{
  const c = parser.mdChapter(md('id: td74-07-scrittura-c02\ntitle: T'), '07-scrittura', 2);
  check('a quello di oggi', true, I.stesso('td74-07-scrittura-c02', c));
  /* ⚠️ È LA RIGA PER CUI ESISTE IL FILE: un'evidenza salvata sei mesi fa porta
     il nome di allora, e chiederle di conoscere quello di oggi vorrebbe dire
     cancellarla. */
  check('e a quello con cui era chiamato prima', true, I.stesso('07-scrittura-c02', c));
  check('a un nome di un altro capitolo no', false, I.stesso('07-scrittura-c03', c));
  check('e a niente nemmeno', [false, false, false],
    [I.stesso('', c), I.stesso(null, c), I.stesso('x', null)]);
  check('i nomi si elencano senza doppioni',
    ['td74-07-scrittura-c02', '07-scrittura-c02'], I.nomi(c));
}

sezione('Ritrovare un capitolo dentro una lezione');
{
  const lez = [
    parser.mdChapter(md('id: corso-lez-c01\ntitle: Primo'), 'lez', 1),
    parser.mdChapter(md('id: corso-lez-c02\ntitle: Secondo'), 'lez', 2),
    parser.mdChapter(md('id: corso-lez-c03\ntitle: Terzo'), 'lez', 3)
  ];
  check('per id stabile', 1, I.indiceDi('corso-lez-c02', lez));
  check('per nome vecchio', 1, I.indiceDi('lez-c02', lez));
  check('e chi non c\'è si dichiara', -1, I.indiceDi('lez-c99', lez));
}

sezione('⚠️ Il capitolo infilato in mezzo: il danno che tutto questo previene');
{
  /* La lezione si rigenera e nasce un capitolo nuovo al secondo posto. Chi
     stava al secondo scala al terzo. Un appunto scritto ieri lo nominava
     «lez-c02»: deve continuare a trovarlo, non attaccarsi all'intruso. */
  const prima = [
    parser.mdChapter(md('id: corso-lez-c01\ntitle: Primo'), 'lez', 1),
    parser.mdChapter(md('id: corso-lez-c02\ntitle: Secondo'), 'lez', 2)
  ];
  const rifVecchio = prima[1].idLegacy;             // «lez-c02», com'era scritto allora
  const rifNuovo = prima[1].id;                     // «corso-lez-c02», come si scrive adesso

  /* Dopo la rigenerazione: l'id sul disco è CONSERVATO (è quello che la
     pipeline dovrà fare), l'ordine no — «Secondo» è terzo. */
  const dopo = [
    parser.mdChapter(md('id: corso-lez-c01\ntitle: Primo'), 'lez', 1),
    parser.mdChapter(md('id: corso-lez-c99\ntitle: Intruso'), 'lez', 2),
    parser.mdChapter(md('id: corso-lez-c02\ntitle: Secondo'), 'lez', 3)
  ];
  check('il riferimento NUOVO segue il capitolo che si è spostato', 2, I.indiceDi(rifNuovo, dopo));
  check('e non finisce sull\'intruso', 'Secondo', dopo[I.indiceDi(rifNuovo, dopo)].title);

  /* ⚠️ Il riferimento vecchio invece resta legato alla POSIZIONE, ed è il danno
     che non si può disfare a posteriori: «lez-c02» adesso è l'alias
     dell'intruso. Questa prova non lo nasconde — lo dichiara, perché è la
     ragione per cui la pipeline deve conservare gli id da qui in avanti, e
     perché il rimedio vero è che i riferimenti nuovi nascano già stabili. */
  check('il riferimento VECCHIO segue la posizione: è il difetto storico',
    'Intruso', dopo[I.indiceDi(rifVecchio, dopo)].title);
  check('ma finché nessuno si sposta, continua a trovare il suo', 'Secondo',
    prima[I.indiceDi(rifVecchio, prima)].title);
}

sezione('E la pipeline conserva l\'id, invece di ricalcolarlo');
{
  /* L'altra metà del lavoro: finché la generazione riscrive l'id dall'ORDINE, la
     catena dei nomi rimedia ma il danno continua a prodursi a ogni rigenerazione.
     Qui si prova che un capitolo che c'era già si porta dietro il suo. */
  const fs = require('fs'), os = require('os'), path = require('path');
  const G = require('../lib/genera.js');
  const v = fs.mkdtempSync(path.join(os.tmpdir(), 'studia-ident-'));
  const dir = path.join(v, 'Corsi', 'C', 'LEZIONI', '01-lez');
  fs.mkdirSync(dir, { recursive: true });
  const cap = (ordine, titolo) => G.scriviCapitolo(v, 'C', '01-lez', ordine, { title: titolo, brief: 'b', html: '<p>x</p>' });
  const idDi = (file) => (G.capitoliSuDisco(v, 'C', '01-lez').filter((c) => c.file === file)[0] || {}).id;

  cap(1, 'Il primo'); cap(2, 'Il secondo');
  check('un capitolo nuovo prende l\'id posizionale', '01-lez-c02', idDi('02-il-secondo.md'));

  /* ⚠️ Le virgolette del frontmatter vanno tolte in lettura: rileggendo
     `id: "01-lez-c02"` con le virgolette dentro, la riscrittura le raddoppia e
     dopo due giri l'id non somiglia più a niente. Successo davvero, misurato. */
  check('e l\'id non porta le virgolette del frontmatter', false, /["']/.test(idDi('02-il-secondo.md')));

  // rigenerazione: nasce un capitolo al secondo posto, «Il secondo» scala al terzo
  cap(2, 'Intruso'); cap(3, 'Il secondo');
  check('il capitolo che si è spostato TIENE il suo id', '01-lez-c02', idDi('03-il-secondo.md'));
  /* ⚠️ E l'intruso non se lo prende: due capitoli con lo stesso id vorrebbero
     dire ogni appunto dell'uno addosso all'altro — il danno che tutto questo
     esiste per evitare, prodotto dal rimedio. Lo ha smascherato questa prova. */
  check('e il capitolo nuovo NON eredita quell\'id', '01-lez-c02-2', idDi('02-intruso.md'));

  const titoloCambiato = cap(4, 'Il secondo, rivisto');
  check('un titolo cambiato non si riconosce, e prende un id suo', true,
    /^01-lez-c04/.test(idDi(titoloCambiato.file)));

  try { fs.rmSync(v, { recursive: true, force: true }); } catch (e) {}
}

console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati') + ' (' + ok + ' ok)');
process.exit(ko ? 1 : 0);
