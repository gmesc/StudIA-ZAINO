/* I testi che arrivano da fuori e diventano appunti.
 *
 * ⚠️ Che cosa difende: le tre cose che si perderebbero in silenzio — il
 * frontmatter di un altro programma (mangiato dalla lista bianca di
 * `lib/appunti.js`), i `[[wikilink]]` che qui puntano alle lezioni del
 * contenitore, e le immagini con percorso relativo, che sono rimaste dov'erano.
 * Perdere in silenzio è l'unica cosa peggiore di perdere.
 *
 *   node test/importa-testi.js
 */
const I = require('../App/assets/appunti/importa.js');

let ko = 0;
function ok(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + nome); return; }
  ko++; console.log('  KO  ' + nome + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

sezione('Che cosa è un testo');
ok('.md sì', 'md', I.tipoDalNome('appunti.md'));
ok('.markdown è lo stesso formato', 'md', I.tipoDalNome('Note di lettura.MARKDOWN'));
ok('.txt sì', 'txt', I.tipoDalNome('lista.txt'));
ok('.pdf no: quella è una fonte', null, I.tipoDalNome('dispensa.pdf'));
ok('.jpg nemmeno', null, I.tipoDalNome('foto.jpg'));
ok('senza estensione no', null, I.tipoDalNome('Makefile'));

sezione('Chi non entra lo sa, e sa perché');
const r = I.accetta([
  { nome: 'buono.md', dimensione: 4000 },
  { nome: 'enorme.md', dimensione: 5 * 1024 * 1024 },
  { nome: 'vuoto.txt', dimensione: 0 },
  { nome: 'dispensa.pdf', dimensione: 100 }
]);
ok('entra solo il testo vero', ['buono.md'], r.buone.map((x) => x.nome));
/* ⚠️ Il rifiuto non dice «troppo grande»: dice che quella è un'altra strada —
   un testo lungo così è una fonte, non un appunto. */
ok('il file lungo viene rimandato alle fonti', true,
  /più che un appunto è una fonte/.test(r.scartate.find((x) => x.nome === 'enorme.md').motivo));
ok('il vuoto lo dice', 'il file è vuoto', r.scartate.find((x) => x.nome === 'vuoto.txt').motivo);
ok('e un PDF non è un testo da appuntare', 'non è un testo',
  r.scartate.find((x) => x.nome === 'dispensa.pdf').motivo);

sezione('Il titolo si cerca in tre posti, in quest\'ordine');
ok('prima il frontmatter', 'Dal frontmatter',
  I.daTesto('---\ntitle: "Dal frontmatter"\n---\n\n# Un altro titolo\ntesto', 'file.md').titolo);
ok('poi il primo titolo del testo', 'Un altro titolo',
  I.daTesto('# Un altro titolo\n\ntesto', 'file.md').titolo);
ok('infine il nome del file', 'Note di lettura',
  I.daTesto('solo testo, senza titoli', 'Note di lettura.md').titolo);
ok('e un file senza niente non resta senza nome', 'Appunto importato',
  I.daTesto('', '').titolo);

/* ⚠️ Il `# Titolo` NON si toglie dal corpo: è testo che l'autore ha scritto, e
   toglierlo perché ci somiglia vorrebbe dire che riaprendo l'appunto manca una
   riga che c'era. */
ok('il titolo trovato nel testo resta nel testo', true,
  I.daTesto('# Un titolo\n\ncorpo', 'x.md').corpo.indexOf('# Un titolo') === 0);

sezione('⚠️ Il frontmatter di un altro programma non sparisce');
const obs = I.daTesto('---\ntitle: "Lettura"\ntags: [ai, mente]\naliases: X\n---\n\nIl corpo.', 'x.md');
ok('il titolo se ne va nel titolo', 'Lettura', obs.titolo);
/* Le altre chiavi le mangerebbe la lista bianca di `lib/appunti.js`: restano
   nel corpo, dentro un blocco che si vede e si legge. */
ok('le altre chiavi restano, in un blocco yaml', true, /^```yaml\ntags: \[ai, mente\]\naliases: X\n```/.test(obs.corpo));
ok('e il corpo vero viene dopo', true, /Il corpo\.$/.test(obs.corpo));
ok('e lo si dichiara', true, obs.avvisi.some((a) => /frontmatter/.test(a)));
ok('le chiavi si leggono anche a parte', { title: 'Lettura', tags: '[ai, mente]', aliases: 'X' }, obs.meta);
/* Un frontmatter col SOLO titolo non lascia un blocco vuoto in cima. */
const soloTitolo = I.daTesto('---\ntitle: "T"\n---\n\ncorpo', 'x.md');
ok('col solo titolo non resta nessun blocco', 'corpo', soloTitolo.corpo);
ok('e nessun avviso', [], soloTitolo.avvisi);

sezione('Gli avvisi che evitano un mistero, dopo');
ok('i wikilink si dichiarano', true,
  I.daTesto('vedi [[Lezione 3]] e poi', 'x.md').avvisi.some((a) => /doppie parentesi/.test(a)));
ok('le immagini relative pure', true,
  I.daTesto('![schema](immagini/x.png)', 'x.md').avvisi.some((a) => /percorso relativo/.test(a)));
/* Un'immagine dell'album o una del web non sono un problema: non si avvisa per
   niente, o l'avviso diventa rumore che nessuno legge. */
ok('un\'immagine dell\'album non fa rumore', [],
  I.daTesto('![x](album:aabbccdd01)', 'x.md').avvisi);
ok('e nemmeno una del web', [], I.daTesto('![x](https://esempio.ch/x.png)', 'x.md').avvisi);

sezione('Le rifiniture del testo grezzo');
ok('il BOM se ne va', 'ciao', I.daTesto('﻿ciao', 'x.md').corpo);
ok('i fine riga di Windows diventano normali', 'a\nb', I.daTesto('a\r\nb', 'x.md').corpo);
ok('le righe vuote in fondo pure', 'a', I.daTesto('a\n\n\n', 'x.md').corpo);

console.log(ko ? `\n✗ ${ko} controlli falliti` : `\n✓ tutti i controlli passati`);
process.exit(ko ? 1 : 0);
