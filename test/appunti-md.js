/* Il markdown scritto A MANO: citazioni, blocchi di codice, righe vuote.
 *
 * ⚠️ Il difetto da cui nasce questo file, misurato il 18 agosto 2026. Nella
 * barra dell'editor ci sono due bottoni di serie di EasyMDE — «"» e «</>» — che
 * scrivono `> testo` e ``` … ```. Il renderore non conosceva né l'una né
 * l'altra forma: quel markdown usciva LETTERALE, con il maggiore e gli apici a
 * vista. Due comandi che promettevano e non mantenevano, e nessun errore da
 * nessuna parte.
 *
 * ⚠️ E vale SOLO PER GLI APPUNTI (`aCapo`). Nei capitoli generati la sintassi
 * non si usa e accenderla là cambierebbe la resa di file già scritti: metà di
 * questi controlli è lì per tenere ferma quella riga di confine.
 *
 * Il parser non è una copia: è `App/assets/lettura/capitolo.js`, lo stesso
 * modulo che carica l'app.
 */
const RP = require('../lib/reader-parser.js');
const C = RP.load();
const NBSP = ' ';

let ko = 0, ok = 0;
function check(nome, atteso, avuto) {
  if (atteso === avuto) { ok++; return; }
  ko++;
  console.log('  ✗ ' + nome + '\n      atteso: ' + JSON.stringify(atteso) + '\n      avuto:  ' + JSON.stringify(avuto));
}
function contiene(nome, ago, pagliaio) {
  if (String(pagliaio).indexOf(ago) >= 0) { ok++; return; }
  ko++;
  console.log('  ✗ ' + nome + '\n      manca:  ' + JSON.stringify(ago) + '\n      dentro: ' + JSON.stringify(pagliaio));
}
function nonContiene(nome, ago, pagliaio) {
  if (String(pagliaio).indexOf(ago) < 0) { ok++; return; }
  ko++;
  console.log('  ✗ ' + nome + '\n      non doveva esserci: ' + JSON.stringify(ago) + '\n      dentro: ' + JSON.stringify(pagliaio));
}
const appunto = (md) => C.mdToHtml(md, true);
const capitolo = (md) => C.mdToHtml(md, false);

console.log('— citazioni —');
check('una riga', '<blockquote><p>citazione</p></blockquote>', appunto('> citazione'));
check('due righe, un blocco solo',
  '<blockquote><p>uno<br>due</p></blockquote>', appunto('> uno\n> due'));
check('senza lo spazio dopo il maggiore',
  '<blockquote><p>stretto</p></blockquote>', appunto('>stretto'));
/* Il bottone «"» premuto sulla riga sotto un paragrafo: la citazione comincia
   lì, senza pretendere una riga vuota che chi preme il bottone non scrive. */
check('subito dopo del testo',
  '<p>Testo</p>\n<blockquote><p>citato</p></blockquote>', appunto('Testo\n> citato'));
contiene('un elenco dentro la citazione', '<ul><li>a</li>', appunto('> intro\n> - a\n> - b'));
contiene('un titoletto dentro la citazione', '<h2>Titolo</h2>', appunto('> ## Titolo'));
contiene('una citazione dentro la citazione',
  '<blockquote><p>uno</p>\n<blockquote><p>due</p></blockquote></blockquote>', appunto('> uno\n> > due'));
/* ⚠️ Il markdown in linea deve continuare a funzionare LÀ DENTRO: la citazione
   avvolge, non sequestra. */
contiene('grassetto dentro la citazione', '<strong>forte</strong>', appunto('> testo **forte**'));
contiene('rimando dentro la citazione', 'wlink', appunto('> vedi [[02-comorbidita]]'));

console.log('— il confine con i capitoli —');
check('in un capitolo la citazione resta testo',
  '<p>&gt; citazione</p>', capitolo('> citazione'));
check('in un capitolo due righe restano un paragrafo solo',
  '<p>&gt; uno &gt; due</p>', capitolo('> uno\n> due'));

console.log('— blocchi di codice —');
check('un recinto',
  '<pre class="md-code"><code>var x=1;</code></pre>', appunto('```\nvar x=1;\n```'));
check('la lingua dichiarata si legge e si butta',
  '<pre class="md-code"><code>var x=1;</code></pre>', appunto('```js\nvar x=1;\n```'));
/* ⚠️ IL CONTROLLO CHE VALE IL FILE. Il codice è l'unico blocco che può
   CONTENERE una riga vuota: se i recinti si ritagliassero dopo lo spezzettamento
   sui bianchi, uscirebbe tagliato in due pezzi con metà apici per uno. */
check('una riga vuota dentro il codice non lo taglia',
  '<pre class="md-code"><code>a\n\nb</code></pre>', appunto('```\na\n\nb\n```'));
check('testo prima e dopo',
  '<p>Prima</p>\n<pre class="md-code"><code>x</code></pre>\n<p>Dopo</p>',
  appunto('Prima\n\n```\nx\n```\n\nDopo'));
/* Dentro il recinto il markdown NON si interpreta: è la ragione per cui uno
   scrive in un recinto. */
contiene('il markdown dentro il codice resta scritto', '**forte**', appunto('```\n**forte**\n```'));
nonContiene('e non diventa grassetto', '<strong>', appunto('```\n**forte**\n```'));
contiene('il minore si scherma', '&lt;div&gt;', appunto('```\n<div>\n```'));
/* ⚠️ Chi sta ancora scrivendo ha un recinto aperto e basta: metà appunto non
   deve diventare codice mentre batte. È anche la condizione d'uscita della
   ricorsione — senza, il pezzo rientrerebbe da capo e si girerebbe in tondo. */
check('un recinto mai chiuso resta testo',
  '<p>Testo</p>\n<p>```<br>var x=1;</p>', appunto('Testo\n\n```\nvar x=1;'));
check('in un capitolo il recinto non si accende',
  true, capitolo('```\nvar x=1;\n```').indexOf('md-code') < 0);
contiene('il codice in linea non è cambiato', '<code>_profilo.md</code>', appunto('Il file `_profilo.md`.'));

console.log('— quello che c\'era prima, invariato —');
check('a capo con un Invio solo', '<p>Prima<br>Seconda</p>', appunto('Prima\nSeconda'));
check('due paragrafi', '<p>Uno</p>\n<p>Due</p>', appunto('Uno\n\nDue'));
/* La riga di spazio bianco: una riga davvero vuota separa e basta, una riga con
   lo spazio insecabile (⌥+Spazio) è contenuto e si vede. */
check('le righe vuote non lasciano spazio', '<p>Uno</p>\n<p>Due</p>', appunto('Uno\n\n\n\nDue'));
check('lo spazio insecabile sì',
  '<p>Uno</p>\n<p>' + NBSP + '</p>\n<p>Due</p>', appunto('Uno\n\n' + NBSP + '\n\nDue'));
check('un riquadro non è una citazione',
  true, appunto('> [!nota] Titolo').indexOf('<blockquote>') < 0);

console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutto a posto') + ' (' + (ok + ko) + ' controlli)');
process.exit(ko ? 1 : 0);
