/* La carta: formato, margini, scala e piè — provati senza aprire l'app.
 *
 * ⚠️ Che cosa difende. Le regole di stampa erano quattro righe dentro il
 * monolite, quindi si potevano verificare solo stampando davvero. Il PDF vero
 * misurato il 14 agosto diceva: foglio LETTER invece di A4, colonna da 188mm
 * (~110 battute per riga), corpo 10,9pt, nessun numero di pagina. Qui si
 * controlla ciò che si può controllare in 40 millisecondi — che le regole
 * DICANO le cose giuste — e la misura sul PDF resta il passo dopo, a mano.
 *
 *   node test/stampa-foglio.js
 */
const F = require('../App/assets/stampa/foglio.js');

let ko = 0;
function ok(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + nome); return; }
  ko++; console.log('  KO  ' + nome + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

sezione('Il foglio è A4, e lo dice');
const testo = F.regole({ tipo: 'testo' });
ok('il testo va su A4 verticale', true, /size:A4 portrait/.test(testo));
ok('coi margini da lettura', true, /margin:20mm 20mm 25mm 20mm/.test(testo));
/* ⚠️ Senza `size` Chromium sceglie LETTER, che è il difetto misurato: la prova
   sta sul valore, non sulla presenza della parola «size». */
ok('nessun @page senza formato', false, /@page\s*\{\s*margin/.test(testo));

const mappa = F.regole({ tipo: 'mappa' });
ok('la mappa va su A4 coricato', true, /size:A4 landscape/.test(mappa));
ok('con margini più stretti', true, /margin:12mm 12mm 16mm 12mm/.test(mappa));

sezione('Il piè: è l’unico posto da cui si può contare le pagine');
ok('c’è il numero, col totale', true, /counter\(page\) " di " counter\(pages\)/.test(testo));
ok('e sta in un margin-box di @page', true, /@bottom-right \{ content:"pagina /.test(testo));
ok('a sinistra il marchio', true, /@bottom-left \{ content:"StudIA"/.test(testo));
ok('che sa dire anche dove si sta lavorando', true,
  /@bottom-left \{ content:"StudIA · Il DSA"/.test(F.regole({ sotto: 'Il DSA' })));
ok('e si può spegnere', false, /counter\(page\)/.test(F.regole({ numeri: false })));

sezione('⚠️ Una stringa storta nel piè spegnerebbe il piè, in silenzio');
/* Un a-capo dentro una `content` invalida la dichiarazione: la regola cade e
   il numero di pagina sparisce senza che nessuno protesti. */
const sporco = F.regole({ sotto: 'due\nrighe e una "virgoletta"' });
ok('l’a-capo è appiattito', false, /content:"[^"]*\n/.test(sporco));
ok('le virgolette sono protette', true, /\\"virgoletta\\"/.test(sporco));

sezione('I corpi sono in PUNTI e discendono da uno solo');
ok('il corpo del testo è 12pt', true, /font-size:12pt/.test(testo));
ok('h1 è 1,5 volte il corpo', true, /h1 \{ font-size:18\.0pt/.test(testo));
ok('h2 è 1,4 volte', true, /h2 \{ font-size:16\.8pt/.test(testo));
/* ⚠️ `mdToHtml` sposta i titoli di DUE livelli: un «##» di un appunto arriva
   come h4 e un «###» come h5. Nel PDF del 14 agosto un h5 usciva più piccolo
   del corpo — un titolo che si legge meno di ciò che titola. */
ok('anche h5 e h6 hanno una taglia', true, /h5 \{ font-size:13\.0pt/.test(testo) && /h6 \{ font-size:12\.0pt/.test(testo));
ok('e nessun titolo scende sotto il corpo', true,
  [1, 2, 3, 4, 5, 6].every(function (n) {
    var m = new RegExp('h' + n + ' \\{ font-size:([\\d.]+)pt').exec(testo);
    return m && parseFloat(m[1]) >= 12;
  }));
ok('il titolo del foglio è 1,8 volte', true, /st-titolo \{ font-size:21\.6pt/.test(testo));
/* ⚠️ Nessun `px` nelle misure del testo stampato: un pixel in stampa vale
   0,26mm e nessuno sa quanti pixel siano «leggibile». */
ok('niente pixel nei corpi', false, /font-size:\d+(\.\d+)?px/.test(testo));

sezione('⚠️ `vh` in stampa non è l’altezza della pagina');
/* Il vecchio `max-height:92vh` lasciava il disegno alto due terzi, con 72mm di
   bianco sotto: misurato sul PDF. Il tetto del disegno si dice in millimetri. */
ok('il tetto del disegno è in mm', true, /max-height:164mm/.test(mappa));
ok('e non c’è nessun vh', false, /vh/.test(mappa));

sezione('Le regole che valgono per la lettura, non per l’estetica');
ok('due righe minime di qua e di là dal salto', true, /orphans:2; widows:2/.test(testo));
/* ⚠️ Un `break-inside:avoid` sui paragrafi c’era, e su un paragrafo lungo
   sposta l’intero blocco alla pagina dopo lasciando mezza pagina bianca. */
/* ⚠️ La prova va scritta su ` p,` o ` p {`, non su `p`: `.st-corpo pre` comincia
   per «p» e il suo `break-inside:avoid` — che è giusto — faceva fallire il
   controllo. Un falso rosso costa quanto un falso verde. */
ok('i paragrafi NON sono indivisibili', false,
  /\.st-corpo p[,\s]\{?[^}]*break-inside:avoid/.test(testo));
ok('i riquadri invece sì', true, /blockquote[\s\S]{0,200}break-inside:avoid/.test(testo));
ok('un titolo resta col suo testo', true, /break-after:avoid/.test(testo));
ok('l’intestazione di una tabella si ripete', true, /thead \{ display:table-header-group/.test(testo));
ok('le immagini non sfondano la colonna', true, /img \{ max-width:100%/.test(testo));
/* ⚠️ La larghezza data a un'immagine dentro un appunto vale anche sulla carta.
   Non è vestito ricopiato: sta scritta nel markdown (`![Titolo|60%](album:…)`),
   l'utente l'ha decisa, e un foglio che la ignorasse direbbe una cosa diversa
   da quella che si vede a schermo. */
ok('e la misura scritta nell’appunto arriva sul foglio', true,
  /\.figura\.misurata a \{[^}]*width:var\(--figw\)/.test(testo));
ok('con l’immagine che riempie la sua larghezza', true,
  /\.figura\.misurata img \{ width:100%/.test(testo));
/* Il testo che sulla fonte era evidenziato resta evidenziato sul foglio: il
   colore arriva per riga in `--ev`, le misure le porta il foglio. ⚠️ Il ripiego
   è una SOTTOLINEATURA e non un fondo, perché un fondo si stampa solo con
   «grafica di sfondo» accesa — di norma è spenta nel dialogo di Chromium. */
ok('l’evidenza si stampa', true, /mark\.evid \{[^}]*text-decoration:underline var\(--ev/.test(testo));
ok('e il fondo pieno resta il fondo pieno', true,
  /mark\.evid\[data-tratto="overlay"\] \{[^}]*background:var\(--ev/.test(testo));
ok('una parola chiave tolta si stampa scolorita, non sparisce', true,
  /mark\.evid\.evorfana \{[^}]*text-decoration-color:#c9c6c2/.test(testo));
/* ⚠️ I link sul foglio sono BLU e sottolineati, e non è vezzo: in un PDF
   un'annotazione non si vede finché non ci passi sopra col puntatore, quindi un
   indirizzo scritto in nero come il resto del testo è cliccabile e non lo dice.
   E la regola dice il vero da quando i rimandi dell'app (`pdf:`, `cap:`)
   diventano testo prima della stampa: quello che resta un `<a>` è un indirizzo
   vero, cioè l'unica cosa che in un PDF porta davvero da qualche parte. */
ok('i link si vedono che sono link', true,
  /\.st-corpo a \{ color:#1d4ed8; text-decoration:underline; \}/.test(testo));

sezione('La testata');
const t = F.testata({ titolo: 'Il <DSA>', dove: 'Lezione 3', data: new Date('2026-08-14T10:00:00Z') });
ok('il titolo è protetto dall’HTML', true, /Il &lt;DSA&gt;/.test(t));
ok('dice dove si sta', true, /Lezione 3/.test(t));
ok('e la data in GG/MM/AAAA', true, /14\/08\/2026/.test(t));
ok('senza ora', false, /:\d\d/.test(t));
ok('la data si può togliere', false, /\d\d\/\d\d\/\d{4}/.test(F.testata({ titolo: 'x', data: false })));

sezione('Un tipo che non esiste non lascia il foglio senza regole');
ok('ripiega sul foglio di testo', true, /size:A4 portrait/.test(F.regole({ tipo: 'inventato' })));
ok('e `formato` dice quello del testo', F.FORMATI.testo, F.formato('inventato'));

console.log(ko ? `\n✗ ${ko} controlli falliti` : `\n✓ tutti i controlli passati`);
process.exit(ko ? 1 : 0);
