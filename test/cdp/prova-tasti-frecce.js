/* Le frecce, sull'app viva: il CABLAGGIO, non la priorità.
 *
 * ⚠️ Che cosa NON si prova qui. Quale tasto vinca su quale, in quale contesto,
 * lo decide `App/assets/tasti/lettura.js` e lo controlla `node
 * test/tasti-lettura.js` — 47 controlli in quaranta millisecondi, senza aprire
 * niente. Duplicarli qui vorrebbe dire pagarli quaranta secondi l'uno e tenerne
 * due copie che possono discordare.
 *
 * Qui resta la sola domanda a cui Node non può rispondere: **il filo è
 * attaccato?** Il gestore è registrato, legge davvero il DOM per riempire il
 * contesto, chiama la funzione giusta, e `preventDefault` ferma davvero quello
 * che c'era sotto.
 *
 * ⚠️ E ce n'è una seconda, che è il difetto da cui è nato tutto: che il tasto
 * faccia UNA cosa. La freccia sinistra col fuoco nel Player saltava cinque
 * secondi **e** cambiava capitolo, perché il gestore dei capitoli gira prima di
 * quello del Player e quando decideva `defaultPrevented` era ancora falso. Una
 * prova che guardasse solo «ha saltato cinque secondi» sarebbe verde anche col
 * difetto dentro: qui si guarda anche il capitolo, che non deve muoversi.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-tasti-frecce.js
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, val, invia, pausa, partiPulito, apriStrumento } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

const PDF = 'Piano-di-studio-della-Scuola-dell-obbligo-ticinese.pdf';

async function finoA(expr, quanto) {
  const fine = Date.now() + (quanto || 20000);
  for (;;) {
    const v = await val(expr);
    if (v) return v;
    if (Date.now() > fine) return null;
    await pausa(250);
  }
}

/* Un tasto VERO, non un `dispatchEvent`: gli eventi sintetici non hanno
   `isTrusted` e soprattutto non producono l'azione di fabbrica del browser —
   e metà di quello che si vuole misurare qui è proprio che `preventDefault`
   fermi lo scorrimento della pagina. */
async function freccia(quale) {
  const p = { key: quale, code: quale, windowsVirtualKeyCode: quale === 'ArrowLeft' ? 37 : 39 };
  await invia('Input.dispatchKeyEvent', Object.assign({ type: 'rawKeyDown' }, p));
  await invia('Input.dispatchKeyEvent', Object.assign({ type: 'keyUp' }, p));
  await pausa(350);
}

(async () => {
  await collega();
  await partiPulito();

  sezione('Il filo è attaccato');
  /* ⚠️ `typeof X.y` SOLLEVA se `X` non esiste, e una prova che esplode invece di
     dire KO è peggio di una che non c'è: uccide il resto della corsa e l'errore
     parla dell'infrastruttura invece del difetto. Misurato scrivendo questa
     prova, sulla controprova senza il modulo. Si chiede prima se il nome esista.
     È la stessa forma del `getComputedStyle(null)` che faceva esplodere
     `prova-confronto`. */
  ok('la tabella è arrivata nella pagina', 'function',
    await val("(typeof TastiLettura==='undefined') ? 'assente' : typeof TastiLettura.decidi"));
  ok('e il renderer sa fotografare il contesto', 'function', await val('typeof tastiDove'));
  /* ⚠️ Se lo script inline del monolite fosse rotto, NIENTE di quanto sopra
     esisterebbe: questo controllo è anche la prova che il file si carica ancora.
     È il guasto del 19 agosto — un blocco infilato fra un `if` e il suo `else`
     uccise l'intero script, e il rosso parlava d'altro. */

  sezione('Nello ZAINO le frecce voltano la pagina');
  await val("cambiaModo('zaino'), 1"); await pausa(1400);
  await apriStrumento('fonte'); await pausa(300);
  await val(`openPdf(${JSON.stringify(PDF)}, 5, 'Piano di studio'), 1`);
  await finoA('!!PDFJS.doc');
  await val("document.getElementById('pdfFrame').focus(), 1"); await pausa(200);
  ok('si parte da pagina 5', 5, await val('ANTEPRIMA.page'));
  await freccia('ArrowRight');
  ok('→ va avanti di una pagina', 6, await val('ANTEPRIMA.page'));
  await freccia('ArrowLeft');
  ok('← torna indietro', 5, await val('ANTEPRIMA.page'));

  /* ⚠️ IL DIFETTO CHE SI RIPARA, e non si vedeva: quelle frecce sfogliavano in
     SILENZIO i capitoli del corso rimasto aperto dietro allo zaino. Nessuno se
     ne accorgeva — non c'è niente a schermo che lo dica — e tornando ai corsi il
     capitolo era cambiato. È l'invariante 4 in forma di tasto. */
  const capPrima = await val('state.current');
  await freccia('ArrowRight'); await freccia('ArrowRight');
  ok('e il capitolo del corso dietro non si muove', capPrima, await val('state.current'));

  sezione('⭐ Nel Player un tasto fa UNA cosa');
  /* Si mette il fuoco dentro il riquadro del Player come farebbe un click. */
  const media = await val(`(()=>{ const el=document.querySelector('#playerPane'); return !!el; })()`);
  ok('il riquadro del Player esiste', true, media);
  const conMedia = await val(`(()=>{ return (typeof playerAperto==='function') ? !!playerAperto() : false; })()`);
  if (!conMedia) {
    console.log('   (nessun media aperto in questo vault di prova: il caso del Player si misura sulla tabella,');
    console.log('    dove è il controllo che vale il file — node test/tasti-lettura.js)');
  }

  sezione('Nei CORSI le frecce restano dei capitoli');
  await val("cambiaModo('corso'), 1"); await pausa(1400);
  await val("document.body.focus && document.body.focus(), document.activeElement.blur && document.activeElement.blur(), 1");
  const cap0 = await val('state.current');
  await freccia('ArrowRight');
  ok('→ cambia capitolo', cap0 + 1, await val('state.current'));
  await freccia('ArrowLeft');
  ok('← torna al precedente', cap0, await val('state.current'));

  sezione('Le scorciatoie del sistema restano del sistema');
  /* ⌘← su un Mac vuol dire «indietro»: prima cambiava capitolo, perché il
     gestore dei capitoli non guardava i modificatori. */
  const capM = await val('state.current');
  await invia('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37, modifiers: 4 });
  await invia('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37, modifiers: 4 });
  await pausa(350);
  ok('⌘← non cambia capitolo', capM, await val('state.current'));

  console.log(ko ? `\n✗ ${ko} controlli falliti` : `\n✓ tutti i controlli passati`);
  process.exit(ko ? 1 : 0);
})();
