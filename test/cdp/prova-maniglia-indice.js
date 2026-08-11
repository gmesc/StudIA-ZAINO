/* La maniglia dell'indice e la testata del blocco che le sta a fianco.
 *
 * Sono due riquadri attaccati nell'angolo fra la topbar e la sidebar: alti
 * diverso si vede subito, ed erano 40 contro 33. Adesso li tiene insieme un
 * token solo, `--tb-blocco-h` (il bottone di barra più i suoi tre pixel di
 * bordi), e questa prova misura che non tornino a divergere — compresi i bordi
 * inferiori, che devono cadere sulla stessa riga di pixel.
 *
 * ⚠️ Gira contro il vault della config: puntarlo a una COPIA (trappola ⑧).
 *   ./test/cdp/con-vault-di-prova.sh prova-maniglia-indice
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, val, pausa, apriStrumento, partiPulito } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
const box = (sel) => val(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});
  if(!e) return null; const r=e.getBoundingClientRect();
  return { w:Math.round(r.width), h:Math.round(r.height), top:Math.round(r.top),
           left:Math.round(r.left), right:Math.round(r.right), bottom:Math.round(r.bottom) };})()`);

(async () => {
  await collega(); await partiPulito();
  await apriStrumento('fonte'); await pausa(700);

  const man = await box('#menuBtn');
  const bh = await box('.blocco[data-blocco="A"] .bhead');
  const topbar = await box('.topbar');
  const side = await box('.sidebar');
  console.log('   maniglia ' + JSON.stringify(man) + '\n   testata  ' + JSON.stringify(bh));

  console.log('\n== Alte uguale');
  ok('i due fondi cadono sulla stessa riga', bh.bottom, man.bottom);
  ok('e la maniglia è larga quanto il token della testata', true, Math.abs(man.w - (bh.h)) <= 1);
  ok('non è più il quadratone da 40', true, man.h <= 35);

  console.log('\n== E dove deve stare');
  ok('appoggiata al fondo della topbar (un pixel di bordo in comune)', topbar.bottom - 1, man.top);
  ok('sull\'angolo destro della sidebar', side.right - 1, man.left);
  ok('l\'icona ci sta dentro senza toccare i bordi', true,
    (await box('#menuBtn .oi')).h <= man.h - 6);

  if (process.env.STUDIA_FOTO) {
    const { invia } = require(S);
    const r = await invia('Page.captureScreenshot', { format: 'png',
      clip: { x: Math.max(0, man.left - 120), y: Math.max(0, man.top - 30),
              width: 460, height: 120, scale: 2 } });
    require('fs').writeFileSync(process.env.STUDIA_FOTO, Buffer.from(r.result.data, 'base64'));
    console.log('   fotografia: ' + process.env.STUDIA_FOTO);
  }

  console.log(ko ? '\n✗ ' + ko + ' controlli falliti' : '\n✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
