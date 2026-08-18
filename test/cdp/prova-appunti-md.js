/* Il markdown scritto a mano, come lo rende l'APP.
 *
 * ⚠️ Perché non basta `test/appunti-md.js`. Quei controlli chiamano
 * `mdToHtml` — il fondo della catena — mentre l'appunto passa prima da
 * `renderNoteMd`, che sta nel monolite e in Node non si carica. E il 18 agosto
 * la differenza fra i due si è vista con gli occhi: la riga di bianco scritta
 * con ⌥+Spazio si vedeva DENTRO un riquadro (che passa dritto a `mdToHtml`) e
 * spariva fuori, perché lassù la riga la scartava un `trim()` — per il quale lo
 * spazio insecabile è uno spazio come gli altri. Prove verdi, difetto a schermo.
 *
 * Qui si misura la funzione che l'app usa davvero: il bianco fra i blocchi — che
 * solo lei conta, perché è lei a spezzarli — e le forme che i bottoni scrivono.
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

  console.log('== Le righe vuote si contano');
  /* ⚠️ Il conteggio del bianco FRA i blocchi lo fa `renderNoteMd`, che i blocchi
     li spezza: `mdToHtml` vede solo quello che sta DENTRO un blocco, quindi i
     controlli in Node non arrivano fin qui. La regola su quanto vale un Invio in
     più è però una sola (`vuote()`), e qui si misura che il conto di sopra usi
     quella invece di una seconda idea. */
  const bianchi = (h) => (String(h).match(/md-vuota/g) || []).length;
  ok('una riga vuota cambia paragrafo e basta', 0, bianchi(await rendi('Sopra.\n\nSotto.')));
  ok('due righe vuote lasciano un bianco', 1, bianchi(await rendi('Sopra.\n\n\nSotto.')));
  ok('cinque righe vuote ne lasciano quattro', 4, bianchi(await rendi('Sopra.\n\n\n\n\n\nSotto.')));
  /* Il bianco sta FRA due cose che si vedono: in cima e in fondo sono avanzi. */
  ok('niente bianco in cima', 0, bianchi(await rendi('\n\n\nSopra.')));
  ok('niente bianco in fondo', 0, bianchi(await rendi('Sopra.\n\n\n')));
  /* ⚠️ UNA RIGA, NON UNA RIGA E MEZZA. Il bianco è un `<p>`, quindi la regola
     che dà lo stacco ai paragrafi degli appunti gliel'ha dato anche a lui: ogni
     Invio in più valeva il doppio, e a occhio si vedeva mentre le prove
     tacevano. I margini a zero devono restare a zero. */
  const misuraBianco = await val(`(()=>{
    const d=document.createElement('div'); d.className='myotes';
    d.innerHTML='<div class="nt-body"><p>x</p><p class="md-vuota"></p></div>';
    document.body.appendChild(d);
    const v=d.querySelector('.md-vuota'), riga=d.querySelector('p'), s=getComputedStyle(v);
    const out={ alto:Math.round(v.getBoundingClientRect().height),
                riga:Math.round(riga.getBoundingClientRect().height),
                mt:Math.round(parseFloat(s.marginTop)), mb:Math.round(parseFloat(s.marginBottom)) };
    d.remove(); return out; })()`);
  ok('il bianco è alto quanto una riga di testo', true,
    misuraBianco.alto > 8 && Math.abs(misuraBianco.alto - misuraBianco.riga) < 6);
  ok('…e non si porta dietro i margini del paragrafo', [0, 0],
    [misuraBianco.mt, misuraBianco.mb]);
  /* ⚠️ Lo spazio insecabile era il modo di lasciare un bianco PRIMA di questa
     regola, e sta negli appunti già scritti: resta CONTENUTO, un paragrafo suo,
     non una riga vuota da contare. Un cambio di regola non riscrive il passato. */
  const bianco = await rendi('Sopra.\n\n' + NBSP + '\n\nSotto.');
  ok('lo spazio insecabile resta un paragrafo suo', true, /<p>[^<]* [^<]*<\/p>/.test(bianco));
  ok('…in mezzo agli altri due', 3, (bianco.match(/<p>/g) || []).length);
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

  console.log('\n== Due paragrafi si vedono come due');
  /* ⚠️ IL CONTROLLO CHE ELENCA LE SUPERFICI, ed è il punto in cui questo lavoro
     è nato: `*{margin:0}` vale ovunque, e lo stacco fra paragrafi stava scritto
     solo per `article` — cioè per i capitoli. Negli appunti due paragrafi si
     toccavano, e premere Invio due volte non cambiava niente a schermo. Se un
     giorno una di queste cinque cade dall'elenco del foglio di stile, quel pezzo
     di appunto torna a leggersi come un blocco solo: qui si accorge. */
  /* ⚠️ SI MISURANO I PARAGRAFI VERI, non un DOM costruito qui. La prima
     versione di questo controllo fabbricava `<div class="editor-preview"><p>…`
     e diceva verde mentre a schermo i paragrafi si toccavano: nell'anteprima
     ogni blocco sta dentro un `.mdb` (`display:contents`), quindi ogni `<p>` è
     il primo figlio del suo involucro — e la regola che eccettuava il primo li
     eccettuava tutti. Un DOM di comodo non è la pagina.
     ⚠️ Per il foglio di stampa si misura invece lo STILE: vive dietro un
     `display:none`, e là ogni rettangolo è alto zero. */
  /* L'anteprima affiancata va ACCESA e riempita: i paragrafi veri esistono solo
     se c'è un appunto sotto e il pannello è aperto. */
  await val(`(()=>{ ensureMde(); NOTES.caricando=true;
    NOTES.mde.value('Primo paragrafo.\\n\\nSecondo paragrafo.'); NOTES.caricando=false;
    const b=document.querySelector('#noteHost .editor-toolbar button.side-by-side');
    if(b && !b.classList.contains('active')) b.click(); return 1; })()`);
  await pausa(700);
  const vivo = await val(`(()=>{
    const pv=document.querySelector('#noteHost .editor-preview-active-side, #noteHost .editor-preview-active');
    if(!pv) return null;
    const ps=[...pv.querySelectorAll('p')].filter(p=>!p.classList.contains('md-vuota'));
    if(ps.length<2) return null;
    const r=(e)=>e.getBoundingClientRect();
    return { salto:Math.round(r(ps[1]).top - r(ps[0]).bottom),
             riga:Math.round(r(ps[0]).height),
             sopra:Math.round(parseFloat(getComputedStyle(ps[0]).marginTop)) }; })()`);
  ok('due paragrafi dell\'anteprima non si toccano', true, !!vivo && vivo.salto >= 12);
  ok('…e lo stacco è meno di una riga intera', true, !!vivo && vivo.salto < vivo.riga);
  ok('il primo paragrafo non sporge in cima', 0, vivo && vivo.sopra);
  const stile = await val(`(()=>{
    const prova = (host, cls) => {
      const d=document.createElement('div'); d.className=cls;
      d.innerHTML='<p>uno</p><p>due</p>';
      (host||document.body).appendChild(d);
      const m=Math.round(parseFloat(getComputedStyle(d.querySelector('p')).marginBottom));
      d.remove(); return m; };
    const host=document.querySelector('#noteHost');
    return { riquadro:prova(host,'uc-body'), stampa:prova(document.querySelector('#stampaFoglio'),'st-corpo'),
             capitolo:prova(document.querySelector('article'),'x-qualunque') }; })()`);
  ['riquadro', 'stampa', 'capitolo'].forEach(function(dove){
    ok('lo stacco c\'è anche: ' + dove, true, stile[dove] >= 12);
  });

  console.log(ko ? '\n✗ ' + ko + ' controlli falliti' : '\n✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
