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
/* ⚠️ LE RIGHE VUOTE SI CONTANO, e non è markdown classico: là dieci righe
   vuote rendono come una. Qui un appunto è un testo scritto a mano, e vale la
   stessa regola dell'«a capo» — quello che si vede nell'editor si vede
   nell'anteprima. La prima riga vuota cambia paragrafo (lo stacco lo dà il
   margine del <p>), ognuna in più è una riga di bianco. */
const bianchi = (h) => (h.match(/md-vuota/g) || []).length;
check('una riga vuota cambia paragrafo e basta', 0, bianchi(appunto('Uno\n\nDue')));
check('due righe vuote lasciano un bianco', 1, bianchi(appunto('Uno\n\n\nDue')));
check('cinque righe vuote ne lasciano quattro', 4, bianchi(appunto('Uno\n\n\n\n\n\nDue')));
check('una riga di soli spazi è vuota anche lei', 2, bianchi(appunto('Uno\n\n   \n\nDue')));
/* Il bianco sta FRA due cose che si vedono: in cima e in fondo a un file le
   righe vuote non sono spazio voluto, sono avanzi. */
check('niente bianco in cima', 0, bianchi(appunto('\n\n\nUno')));
check('niente bianco in fondo', 0, bianchi(appunto('Uno\n\n\n')));
check('e dentro un riquadro vale la stessa regola', 1, bianchi(appunto('Prima.\n\n\nDopo.')));
/* ⚠️ Nei capitoli generati la regola NON cambia: quei file sono già scritti. */
check('un capitolo collassa come sempre', '<p>Uno</p>\n<p>Due</p>', capitolo('Uno\n\n\n\nDue'));
/* ⚠️ Lo spazio insecabile era il modo di lasciare un bianco prima di questa
   regola, e sta negli appunti della gente: resta CONTENUTO, cioè un paragrafo
   suo, non una riga vuota da contare. */
check('lo spazio insecabile resta un paragrafo',
  '<p>Uno</p>\n<p>' + NBSP + '</p>\n<p>Due</p>', appunto('Uno\n\n' + NBSP + '\n\nDue'));
check('un riquadro non è una citazione',
  true, appunto('> [!nota] Titolo').indexOf('<blockquote>') < 0);

console.log('— indirizzi scritti nudi —');
/* ⚠️ `[ISS](https://…)` era già un'ancora — e nel PDF un'annotazione cliccabile,
   misurato nel file — mentre l'indirizzo scritto e basta restava testo morto. Chi
   incolla un link in un appunto lo incolla nudo: è il modo normale di scriverlo. */
contiene('un indirizzo nudo diventa link', '<a href="https://www.iss.it"', appunto('Fonte: https://www.iss.it e basta.'));
contiene('anche senza schema', '<a href="https://www.iss.it"', appunto('Vedi www.iss.it oggi.'));
check('la punteggiatura della frase resta fuori',
  '<p>Vedi <a href="https://www.iss.it" target="_blank" rel="noopener">https://www.iss.it</a>.</p>',
  appunto('Vedi https://www.iss.it.'));
check('e la parentesi pure',
  '<p>(vedi <a href="https://www.iss.it" target="_blank" rel="noopener">https://www.iss.it</a>)</p>',
  appunto('(vedi https://www.iss.it)'));
/* ⚠️ IL CONTROLLO CHE VALE LA FUNZIONE: un `replace` sull'HTML già fatto
   riscriverebbe anche gli indirizzi dentro gli `href`, cioè un'ancora dentro
   un'altra ancora. Qui l'autolink passa FRA i tag e non li guarda. */
check('un link markdown non si annida in un altro', 1,
  (appunto('[ISS](https://www.iss.it)').match(/<a /g) || []).length);
check('nemmeno quando l\'etichetta È l\'indirizzo', 1,
  (appunto('[https://www.iss.it](https://www.iss.it)').match(/<a /g) || []).length);
/* Dentro il codice l'indirizzo resta scritto: è il motivo per cui uno scrive in
   un recinto. */
check('nel codice in linea non si tocca', 0,
  (appunto('Scrivi `https://www.iss.it` nel campo.').match(/<a /g) || []).length);
check('e nel recinto nemmeno', 0,
  (appunto('```\nhttps://www.iss.it\n```').match(/<a /g) || []).length);
/* ⚠️ Nei capitoli generati vale la stessa regola: là un indirizzo nudo capita —
   lo scrive il modello — e restava morto pure lì. */
contiene('e vale anche nei capitoli', '<a href="https://www.iss.it"', capitolo('Fonte: https://www.iss.it'));

/* ⚠️ L'ESCAPE SI FA UNA VOLTA SOLA. `_mdInline` escapa l'intera riga PRIMA di
   riconoscere le figure, quindi ciò che arriva a `albumHtml` e a `figuraHtml` è
   già HTML-safe: riescaparlo mandava a schermo «Sole &amp;amp; Luna» — nell'alt,
   nell'aria-label e sotto la figura. Il difetto stava nel solo `albumHtml`, e si
   vedeva confrontandolo coi gemelli, che qui restano il termine di paragone. */
console.log('\n— l\'escape delle didascalie, una volta sola —');
nonContiene('l\'immagine dell\'album non escapa due volte', '&amp;amp;',
  appunto('![Sole & Luna](album:abc123def456)'));
contiene('e la e commerciale arriva scritta bene', 'Sole &amp; Luna',
  appunto('![Sole & Luna](album:abc123def456)'));
nonContiene('la figura di un documento fa lo stesso', '&amp;amp;',
  appunto('![Sole & Luna](fig:01#p=3)'));
nonContiene('e un rimando pure', '&amp;amp;',
  appunto('[Sole & Luna](pdf:01#p=3)'));
/* Il testo dell'utente resta escapato: togliere l'escape di troppo non deve
   togliere quello che serve. */
nonContiene('e un tag scritto nella didascalia resta inerte', '<b>',
  appunto('![<b>Sole</b>](album:abc123def456)'));

/* ⚠️ I CONTROLLI DI SOPRA VEDONO SOLO META FUNZIONE. In Node non c'è `window`,
   quindi `albumHtml` cade sempre nel ramo «immagine non trovata» — e i tre posti
   dove l'escape era doppio (alt, aria-label, didascalia sotto la figura) stanno
   nell'ALTRO ramo, quello che vede chi usa l'app. Si accende un `window` finto e
   si crea un parser col gancio del contenitore, che `reader-parser` non passa
   perché in Node nessun corso è aperto. Senza questo, rimettere il difetto
   lasciava la prova verde: misurato. */
global.window = { vault: { album: { srcUrl: function(){ return 'album/x.webp'; } } } };
const CAPV = require('../App/assets/lettura/capitolo.js').crea({
  mediaNum: function(){ return {}; }, pdfNum: function(){ return {}; },
  corsoAttivo: function(){ return 'corso-di-prova'; }
});
const conImg = CAPV.mdToHtml('![Sole & Luna](album:abc123def456)', true);
nonContiene('con l\'immagine vera, niente doppio escape', '&amp;amp;', conImg);
contiene('l\'alt è scritto bene', 'alt="Sole &amp; Luna"', conImg);
contiene('e la didascalia sotto la figura pure',
  '<span class="figcap">Sole &amp; Luna</span>', conImg);

console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutto a posto') + ' (' + (ok + ko) + ' controlli)');
process.exit(ko ? 1 : 0);
