/* Lotto «barre degli strumenti» — una barra sola, cinque superfici.
 *
 * La barra della mappa è il modello dichiarato:
 *   GENERATA MIE  MAPPE ▾ + ✎ 🗑 │ 1 2 3 4 5 │ TD SX        ⚙ 🖨 ✕
 * Questa prova misura che le altre barre degli split — fonte, appunti, album,
 * parole chiave — siano la STESSA barra: stessa altezza minima, stesso fondo,
 * una linea sola sotto, e bottoni alti quanto quelli della mappa.
 *
 * Non è un capriccio grafico: prima ogni barra aveva le sue misure scritte a
 * mano (40px nella fonte contro 30 nella mappa, 24 nei campi di ricerca), e
 * cambiarle voleva dire trovarle tutte — cioè sbagliarne una.
 *
 * ⚠️ Gira contro il vault della config: puntarlo a una COPIA (trappola ⑧).
 *   ./test/cdp/con-vault-di-prova.sh prova-tbar
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, val, pausa, apriStrumento, partiPulito } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}

/** Che cosa sa dire di sé una barra: le misure che devono coincidere. */
const misura = (sel) => val(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});
  if(!e) return null; const s=getComputedStyle(e); const r=e.getBoundingClientRect();
  return { c:s.display, minH:s.minHeight, alt:Math.round(r.height),
           fondo:s.backgroundColor, sotto:s.borderBottomWidth+' '+s.borderBottomColor,
           sopra:s.borderTopWidth, wrap:s.flexWrap };})()`);

/** L'altezza vera del primo bottone della barra: il token `--tb-h` è 30px. */
const altBottone = (sel) => val(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});
  return e ? Math.round(e.getBoundingClientRect().height) : null;})()`);

(async () => {
  await collega();
  await partiPulito();
  await val('localStorage.removeItem("studia.banco"), 1');
  await val('location.reload(), 1');
  await pausa(1800); await collega(); await pausa(600);

  console.log('\n== Il modello: la barra della mappa');
  await apriStrumento('mappa');
  const m = await misura('.mtoolbar');
  ok('esiste ed è una riga flex', 'flex', m && m.c);
  ok('alta quanto il token', '39px', m.minH);
  ok('fondo del pannello, non trasparente', true, m.fondo !== 'rgba(0, 0, 0, 0)');
  ok('una linea sotto, nessuna sopra', ['1px', '0px'], [m.sotto.split(' ')[0], m.sopra]);
  ok('i comandi possono andare a capo', 'wrap', m.wrap);
  ok('i bottoni sono alti 30', 30, await altBottone('#mChiudi'));

  console.log('\n== Le altre barre sono la stessa barra');
  for (const [nome, strumento, sel] of [
    ['fonte',         'fonte',    '#pdfPane .pdfbar'],
    ['appunti',       'appunti',  '#noteHost .editor-toolbar'],
    ['album',         'album',    '.albar'],
    ['parole chiave', 'keyword',  '.kwbar'],
    ['ripasso',       'flashcard', '.ripbar'],
  ]) {
    await apriStrumento(strumento);
    await pausa(300);
    const b = await misura(sel);
    if (!b) { ok(nome + ': la barra c\'è', true, false); continue; }
    ok(nome + ': stessa altezza minima della mappa', m.minH, b.minH);
    ok(nome + ': stesso fondo', m.fondo, b.fondo);
    ok(nome + ': stessa linea sotto e nessuna sopra', [m.sotto, '0px'], [b.sotto, b.sopra]);
    ok(nome + ': va a capo come la mappa', 'wrap', b.wrap);
  }

  console.log('\n== I controlli in barra stanno tutti sulla stessa riga');
  await apriStrumento('fonte'); await pausa(300);
  /* ⚠️ Non `#pdfDoc`: senza un documento aperto quel bottone non è a schermo, e
     misurarlo darebbe 0 accusando la barra di una cosa che non è sua. La ✕ c'è
     sempre, ed è un bottone della barra come gli altri. */
  ok('la fonte: la ✕ è alta 30', 30, await altBottone('#pdfClose'));
  await apriStrumento('keyword'); await pausa(300);
  ok('parole chiave: il campo di ricerca è alto 30', 30, await altBottone('#kwCerca'));
  ok('…e il bottone dell\'ordine pure', 30, await altBottone('#kwOrdine'));
  await apriStrumento('album'); await pausa(300);
  ok('album: il campo di ricerca è alto 30', 30, await altBottone('#albCerca'));
  await apriStrumento('flashcard'); await pausa(300);
  ok('ripasso: la tendina dell\'ambito è alta 30', 30, await altBottone('#ripAmbito'));
  ok('…e il bottone «Salta» pure', 30, await altBottone('#ripSalta'));

  console.log(ko ? '\n✗ ' + ko + ' controlli falliti' : '\n✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
