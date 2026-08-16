/* Il selettore di emoji della barra degli appunti, dalla porta vera.
 *
 * ⚠️ Perché esiste. La tavolozza è passata da 89 emoji scelte a mano a tutte
 * quelle di OpenMoji: il dato lo controlla `test/emoji.js`, ma un elenco giusto
 * non è ancora un pannellino che si apre, cerca e inserisce. Le tre cose che
 * possono rompersi qui e non lì sono la griglia che non regge il volume, la
 * ricerca che non arriva al carattere giusto, e l'inserimento — che è l'unico
 * gesto per cui tutto il resto esiste.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-emoji.js
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, val, pausa, partiPulito, apriStrumento, clicca } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

const conta = () => val(`document.querySelectorAll('#emojiGrid button').length`);
const primi = (n) => val(`[...document.querySelectorAll('#emojiGrid button')].slice(0,${n}).map(function(b){return b.textContent;})`);

(async () => {
  await collega();
  await val('location.reload(), 1'); await pausa(1800);
  await collega(); await pausa(600);
  await partiPulito();
  await apriStrumento('appunti');
  await pausa(500);

  sezione('La tavolozza è quella completa, e si apre');
  ok('le emoji sono più di duemila', true, (await val('EMOJI_FLAT.length')) > 2000);
  ok('e le categorie più di dodici', true, (await val('EMOJI.length')) > 12);
  await clicca('.ncb-emoji');
  await pausa(400);
  ok('il pannellino è aperto', true, await val(`!!document.querySelector('#emojiPop[open]')`));
  const quante = await conta();
  ok('la griglia le mostra tutte', true, quante > 2000);
  console.log('   ' + quante + ' bottoni nella griglia');

  /* Il volume è la ragione per cui questa prova è nata: se disegnare la griglia
     costasse mezzo secondo, il pannellino sembrerebbe rotto. */
  const ms = await val(`(function(){ var t0=performance.now(); emojiRender(''); return Math.round(performance.now()-t0); })()`);
  console.log('   disegnata in ' + ms + ' ms');
  ok('e la disegna in meno di 200 ms', true, ms < 200);

  sezione('LA RICERCA È IN ITALIANO — è la ragione per cui la tavolozza si genera');
  for (const [q, atteso] of [['attenzione', '⚠'], ['gatto', '😺'], ['laurea', '🎓'], ['montagna', '⛰']]) {
    await val(`emojiRender(${JSON.stringify(q)}), 1`);
    const trovati = await primi(8);
    const c = (trovati || []).some((ch) => String(ch).replace(/️/g, '').indexOf(atteso) === 0);
    ok('«' + q + '» porta a ' + atteso, true, c);
    if (!c) console.log('      ha trovato: ' + JSON.stringify(trovati));
  }

  sezione('⚠️ Nella ricerca la stessa emoji non compare due volte');
  /* Le curate stanno in testa E nel loro gruppo: sfogliando è un accesso
     rapido, cercando erano due bottoni identici uno accanto all'altro. */
  await val(`emojiRender('attenzione'), 1`);
  const dop = await val(`(function(){ var v={}, doppi=0;
    [...document.querySelectorAll('#emojiGrid button')].forEach(function(b){
      var k=b.textContent.replace(/️/g,''); if(v[k]) doppi++; v[k]=1; });
    return doppi; })()`);
  ok('nessun doppione', 0, dop);

  sezione('Una ricerca che non trova niente lo dice');
  await val(`emojiRender('qwertyuiop'), 1`);
  ok('nessun bottone', 0, await conta());
  ok('e un messaggio al posto della griglia', true,
    await val(`!!document.querySelector('#emojiGrid .ep-empty')`));

  sezione('IL GESTO: l\'emoji finisce nel testo dell\'appunto');
  await val(`emojiRender('gatto'), 1`);
  const scelta = (await primi(1))[0];
  const prima = await val(`(NOTES.mde ? NOTES.mde.value() : '')`);
  await clicca('#emojiGrid button');
  await pausa(400);
  const dopo = await val(`(NOTES.mde ? NOTES.mde.value() : '')`);
  ok('il testo è cambiato', true, dopo !== prima);
  ok('e contiene l\'emoji scelta ' + scelta, true, dopo.indexOf(scelta) >= 0);
  ok('il pannellino si è chiuso dopo la scelta', false,
    await val(`!!document.querySelector('#emojiPop[open]')`));

  console.log('');
  console.log(ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})();
