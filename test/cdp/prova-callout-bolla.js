/* La bolla dei riquadri: si batte «> » e il menu compare al cursore.
 *
 * ⚠️ IL CONTROLLO CHE VALE IL FILE è il terzo: dentro un riquadro l'Invio
 * inserisce «> » DA SOLO (l'addon `continuelist` di CodeMirror), e ⌘' fa lo
 * stesso a comando. Una bolla agganciata a «la riga è `> `» sbucherebbe a ogni
 * Invio dentro ogni riquadro — cioè sarebbe inutilizzabile. Qui si misura che
 * scatti per ciò che è stato BATTUTO e per nient'altro.
 *
 * ⚠️ E si batte davvero, con `Input.dispatchKeyEvent`: `replaceSelection` da
 * codice non emette `inputRead`, quindi una prova scritta con quello direbbe
 * «non compare» sempre, o «compare» mai — a seconda di come è scritto il
 * codice, non di come si comporta.
 *
 * ⚠️ Gira contro il vault della config: puntarlo a una COPIA (trappola ⑧).
 *   ./test/cdp/con-vault-di-prova.sh prova-callout-bolla
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, val, pausa, partiPulito, apriStrumento, invia } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
async function tasto(key, code, vk) {
  const base = { key, code: code || key, windowsVirtualKeyCode: vk || 0 };
  await invia('Input.dispatchKeyEvent', Object.assign({ type: 'keyDown' }, base));
  await invia('Input.dispatchKeyEvent', Object.assign({ type: 'keyUp' }, base));
  await pausa(60);
}
/* ⚠️ Si batte con `keyDown` PORTANDO il testo, non con `char`: una tastiera
   vera emette tutti e due gli eventi, e il solo `char` non fa scattare nessun
   `keydown` — una prova scritta così misura mezzo percorso e chiama rosso il
   codice che funziona. */
async function scrivi(s) {
  for (const ch of s) {
    await invia('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, key: ch, unmodifiedText: ch });
    await invia('Input.dispatchKeyEvent', { type: 'keyUp', key: ch });
  }
  await pausa(150);
}
const aperta = () => val(`(()=>{const m=document.querySelector('#calloutMenu');
  return !!(m && m.hasAttribute('open'));})()`);
const testo = () => val(`NOTES.mde.codemirror.getValue()`);
/** Svuota l'editor e ci mette il cursore dentro, come farebbe una mano. */
async function daCapo(iniziale) {
  await val(`(()=>{ NOTES.caricando=true; NOTES.mde.value(${JSON.stringify(iniziale || '')});
    NOTES.caricando=false; const cm=NOTES.mde.codemirror;
    cm.focus(); cm.setCursor({ line:cm.lineCount()-1, ch:cm.getLine(cm.lineCount()-1).length });
    return 1; })()`);
  await pausa(150);
}

(async () => {
  await collega(); await partiPulito();
  await apriStrumento('appunti'); await pausa(800);
  await val(`(()=>{ ensureMde(); openEditor(); return 1; })()`); await pausa(500);

  console.log('== Si batte «> » e la bolla compare');
  await daCapo('');
  await scrivi('> ');
  ok('la bolla è aperta', true, await aperta());
  ok('sta al cursore, non in cima alla finestra', true, await val(`(()=>{
    const m=document.querySelector('#calloutMenu').getBoundingClientRect();
    const c=NOTES.mde.codemirror.cursorCoords(true,'window');
    return Math.abs(m.left-c.left) < 40 && m.top > c.top - 8; })()`));
  ok('la prima voce è quella scelta', 'nota',
    await val(`document.querySelector('#calloutMenu button.scelto').dataset.cal`));

  console.log('\n== Le frecce scorrono, Invio sceglie');
  await tasto('ArrowDown', 'ArrowDown', 40);
  await tasto('ArrowDown', 'ArrowDown', 40);
  ok('due giù = la terza voce', 'definizione',
    await val(`document.querySelector('#calloutMenu button.scelto').dataset.cal`));
  await tasto('ArrowUp', 'ArrowUp', 38);
  ok('e una su torna indietro', 'importante',
    await val(`document.querySelector('#calloutMenu button.scelto').dataset.cal`));
  await tasto('Enter', 'Enter', 13);
  await pausa(200);
  ok('la bolla si chiude', false, await aperta());
  /* ⚠️ Il «> » battuto non deve restare: `insertCallout` scrive il suo, e
     sommandosi uscirebbe «> > [!importante]» — un riquadro dentro una
     citazione, che non è quello che si è chiesto. */
  ok('e il riquadro è scritto una volta sola',
    '> [!importante] Importante\n> Scrivi qui\n', await testo());

  console.log('\n== ⚠️ Dentro un riquadro l\'Invio NON la sveglia');
  /* L'Invio in fondo a una riga di riquadro fa scrivere «> » a `continuelist`:
     se la bolla si agganciasse alla FORMA della riga, comparirebbe qui. */
  await daCapo('> [!nota] Titolo\n> Prima frase.');
  await tasto('Enter', 'Enter', 13);
  await pausa(200);
  ok('la riga nuova comincia con «> » da sé', true,
    await val(`/^>\\s?$/.test(NOTES.mde.codemirror.getLine(2)||'')`));
  ok('e la bolla non è comparsa', false, await aperta());
  /* E nemmeno battendolo a mano: sotto una riga di riquadro si sta continuando
     quel riquadro. */
  await daCapo('> [!nota] Titolo\n> Prima frase.\n');
  await scrivi('> ');
  ok('nemmeno battuto sotto un riquadro', false, await aperta());

  console.log('\n== È un suggerimento, non un dirottamento');
  await daCapo('');
  await scrivi('> ');
  ok('la bolla c\'è', true, await aperta());
  await scrivi('Le parole di qualcun altro.');
  ok('continuando a scrivere se ne va', false, await aperta());
  ok('e resta la citazione che si stava scrivendo',
    '> Le parole di qualcun altro.', await testo());
  await daCapo('');
  await scrivi('> ');
  await tasto('Escape', 'Escape', 27);
  await pausa(150);
  ok('Esc la manda via', false, await aperta());
  ok('e lascia la riga com\'era', '> ', await testo());

  console.log('\n== Il 📜 della barra apre lo stesso menu, e non è la bolla');
  await daCapo('');
  await val(`(()=>{ openCalloutMenu(document.querySelector('#noteHost .ncb-callout')); return 1; })()`);
  await pausa(200);
  ok('il menu è aperto', true, await aperta());
  ok('ma la bolla non è attiva', false, await val(`CALBOLLA.attiva`));
  await val(`(()=>{ document.querySelector('#calloutMenu button[data-cal="dubbio"]').click(); return 1; })()`);
  await pausa(200);
  ok('e inserisce senza cancellare niente davanti',
    '> [!dubbio] Dubbio\n> Scrivi qui\n', await testo());

  await daCapo('');
  console.log(ko ? '\n✗ ' + ko + ' controlli falliti' : '\n✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
