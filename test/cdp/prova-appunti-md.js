/* Il markdown scritto a mano, come lo rende l'APP.
 *
 * ⚠️ Perché non basta `test/appunti-md.js`. Quei 26 controlli chiamano
 * `mdToHtml` — il fondo della catena — mentre l'appunto passa prima da
 * `renderNoteMd`, che sta nel monolite e in Node non si carica. E il 18 agosto
 * la differenza fra i due si è vista con gli occhi: la riga di bianco scritta
 * con ⌥+Spazio si vedeva DENTRO un riquadro (che passa dritto a `mdToHtml`) e
 * spariva fuori, perché lassù la riga la scartava un `trim()` — per il quale lo
 * spazio insecabile è uno spazio come gli altri. Prove verdi, difetto a schermo.
 *
 * Qui si misura la funzione che l'app usa davvero, sulle quattro forme che i
 * bottoni della barra sanno scrivere.
 *
 * ⚠️ Gira contro il vault della config: puntarlo a una COPIA (trappola ⑧).
 *   ./test/cdp/con-vault-di-prova.sh prova-appunti-md
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, val, pausa, partiPulito } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
const NBSP = ' ';
/* Il markdown passa da `JSON.stringify` due volte: una per entrare nella
   stringa da valutare, una perché la funzione la riceva com'è scritta. */
const rendi = (md) => val(`renderNoteMd(${JSON.stringify(md)})`);

(async () => {
  await collega(); await partiPulito();

  console.log('== La riga di bianco');
  const bianco = await rendi('Sopra.\n\n' + NBSP + '\n\nSotto.');
  ok('lo spazio insecabile resta un paragrafo suo', true, /<p>[^<]* [^<]*<\/p>/.test(bianco));
  ok('…in mezzo agli altri due', 3, (bianco.match(/<p>/g) || []).length);
  const vuote = await rendi('Sopra.\n\n\n\n\nSotto.');
  ok('le righe davvero vuote non lasciano bianco, quante che siano', 2,
    (vuote.match(/<p>/g) || []).length);
  /* ⚠️ Il bianco dentro un riquadro c'era già e deve restare: è la strada che
     passa da `mdToHtml` senza toccare `renderNoteMd`. */
  const dentro = await rendi('> [!nota] Titolo\n> Prima.\n> ' + NBSP + '\n> Dopo.');
  ok('e il bianco dentro un riquadro non si è perso', true, dentro.indexOf(NBSP) >= 0);

  console.log('\n== Le due forme che i bottoni scrivono');
  const cit = await rendi('> La lettura non è naturale.');
  ok('la citazione è una citazione', true, cit.indexOf('<blockquote>') >= 0);
  ok('…e il maggiore non si vede più', false, cit.indexOf('&gt;') >= 0);
  const cod = await rendi('```\na = b * c\n```');
  ok('il blocco di codice è un blocco di codice', true, cod.indexOf('md-code') >= 0);
  ok('…e gli apici non si vedono più', false, cod.indexOf('```') >= 0);
  const misto = await rendi('Testo.\n\n> Citato.\n\n```\nx\n```\n\n> [!nota] Riquadro\n> Corpo.');
  ok('le quattro cose convivono nello stesso appunto', [true, true, true, true],
    ['<p>Testo.</p>', '<blockquote>', 'md-code', 'ucallout'].map(s => misto.indexOf(s) >= 0));
  ok('un riquadro non diventa una citazione', false, misto.indexOf('<blockquote><p>Riquadro') >= 0);

  console.log('\n== Il vestito arriva davvero (le regole ci sono)');
  /* ⚠️ Il CSS elenca CINQUE superfici a mano: se una si scorda, quel pezzo di
     appunto si legge diverso dagli altri. Qui si misura sulla superficie che
     l'utente guarda di più — l'anteprima dell'editor — che le due regole
     esistano e non siano rimaste parole in un foglio di stile. */
  await val(`(()=>{ ensureMde(); openEditor(); return 1; })()`);
  await pausa(500);
  const stili = await val(`(()=>{
    const host=document.querySelector('#noteHost'); if(!host) return null;
    const d=document.createElement('div'); d.className='editor-preview';
    d.innerHTML='<blockquote>x</blockquote><pre class="md-code"><code>y</code></pre>';
    host.appendChild(d);
    const q=getComputedStyle(d.querySelector('blockquote'));
    const p=getComputedStyle(d.querySelector('pre'));
    const out={ filo:q.borderLeftWidth, corsivo:q.fontStyle, scorre:p.overflowX, aCapo:p.whiteSpace };
    d.remove(); return out; })()`);
  ok('la citazione porta il suo filo a sinistra', '2px', stili.filo);
  ok('…ed è in corsivo', 'italic', stili.corsivo);
  ok('il codice scorre invece di allargare la pagina', 'auto', stili.scorre);
  ok('…e non va a capo dove capita', 'pre', stili.aCapo);

  console.log(ko ? '\n✗ ' + ko + ' controlli falliti' : '\n✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
