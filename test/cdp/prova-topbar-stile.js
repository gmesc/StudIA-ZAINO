/* La testata è una barra degli strumenti, un decimo più grande.
 *
 * Misura a schermo tre cose: la SCALA (i token della testata valgono ×1.1
 * quelli delle barre degli split), il VESTITO (bottoni nudi, niente cornici né
 * pillole, maiuscole) e — la parte che conta di più — che le POSIZIONI non
 * siano cambiate: il logo a sinistra, tutto il resto a destra, nell'ordine di
 * prima. Cambiare il vestito di una barra è facile; cambiarlo senza spostare
 * niente è la cosa che si rompe.
 *
 * ⚠️ Gira contro il vault della config: puntarlo a una COPIA (trappola ⑧).
 *   ./test/cdp/con-vault-di-prova.sh prova-topbar-stile
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, val, pausa, partiPulito } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}

const box = (sel) => val(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});
  if(!e) return null; const s=getComputedStyle(e), r=e.getBoundingClientRect();
  return { h:Math.round(r.height), x:Math.round(r.left), destra:Math.round(r.right),
           fs:s.fontSize, bordo:s.borderTopWidth+s.borderRightWidth+s.borderBottomWidth+s.borderLeftWidth,
           fondo:s.backgroundColor, raggio:s.borderTopLeftRadius, maiuscole:s.textTransform };})()`);

(async () => {
  await collega(); await partiPulito(); await pausa(300);

  console.log('\n== La scala: +10% sulle barre degli split');
  const tok = await val(`(()=>{const c=getComputedStyle(document.documentElement);
    const t=getComputedStyle(document.querySelector('.topbar'));
    return { h:c.getPropertyValue('--tb-h').trim(), fs:c.getPropertyValue('--tb-fs').trim(),
             topH:t.getPropertyValue('--tb-h').trim(), topFs:t.getPropertyValue('--tb-fs').trim() };})()`);
  ok('la barra degli split resta a 30px / 11px', ['30px', '11px'], [tok.h, tok.fs]);
  const b = await box('#bancoBtn');
  ok('un bottone di testata è alto 33', 33, b.h);
  ok('…e scrive a 12.1px', '12.1px', b.fs);
  ok('…in maiuscole, come nelle barre', 'uppercase', b.maiuscole);

  console.log('\n== Il vestito: niente cornici, niente pillole');
  ok('il bottone non ha bordi', '0px0px0px0px', b.bordo);
  ok('né fondo a riposo', 'rgba(0, 0, 0, 0)', b.fondo);
  const chip = await box('#themeToggle');
  ok('il chiaro/scuro non è più una pillola', '0px', chip.raggio);
  ok('…e non ha cornice', '0px0px0px0px', chip.bordo);
  /* ⚠️ Quale fila di tendine sia A SCHERMO dipende dalla MODALITÀ, e questa
     prova lo dava per scontato: chiedeva sempre `.lessonrow`, che nel fork
     ZAINO è nascosta per costruzione. Misurare una fila invisibile dà altezza
     0 e accusa il vestito di un difetto che non ha. La fila si chiede alla
     modalità, così il controllo vale in tutte e due le app. */
  const fila = await val(`modoAttivo()==='zaino' ? 'zainorow' : 'lessonrow'`);
  const tend = await box('.' + fila + ' .tendina');
  ok('la tendina è nuda', '0px0px0px0px', tend.bordo);
  ok('…e alta quanto i bottoni', 33, tend.h);
  ok('le barrette di gruppo sono a schermo', true,
    await val(`[...document.querySelectorAll('.topbar .tbsep')].some(e=>!e.hidden)`));

  console.log('\n== Le posizioni: quelle di prima');
  const logo = await box('.brand'), barra = await box('.topbar');
  ok('il logo è a sinistra, a filo del rientro', true, logo.x - barra.x < 30);
  const cr = await box('.topbar .controls');
  ok('i comandi finiscono a destra', true, Math.abs(barra.destra - cr.destra) < 30);
  ok('e cominciano dopo il logo', true, cr.x > logo.destra);
  const ordine = await val(`[...document.querySelectorAll('.topbar .controls > *')]
    .filter(e=>!e.hidden && getComputedStyle(e).display!=='none').map(e=>e.id||e.className.split(' ')[0])`);
  console.log('   ordine: ' + JSON.stringify(ordine));
  ok('la fila che sceglie che cosa studiare apre la riga', fila, ordine[0]);
  ok('e «Banco» viene dopo la lente, come prima', true,
    ordine.indexOf('bancoBtn') > ordine.indexOf('searchBtn'));

  console.log('\n== I comandi ci stanno su una riga sola');
  /* ⚠️ Il centro, non il bordo alto: una barretta alta 16 dentro una riga da 33
     ha il `top` più basso di un bottone pur stando sulla stessa riga, e
     misurare i bordi contava tre righe dove ce n'è una. */
  const righe = await val(`(()=>{const c=document.querySelector('.topbar .controls');
    const y=[...c.children].filter(e=>!e.hidden && getComputedStyle(e).display!=='none')
      .map(e=>{const r=e.getBoundingClientRect(); return Math.round((r.top+r.bottom)/2);});
    return new Set(y).size;})()`);
  ok('una riga, non due', 1, righe);

  /* Una fotografia della testata: le misure dicono che è coerente, non che è
     bella. Guardarla è l'unico controllo che una prova non sa fare. */
  if (process.env.STUDIA_FOTO) {
    const { invia } = require(S);
    const r = await invia('Page.captureScreenshot', { format: 'png',
      clip: { x: 0, y: 0, width: Math.round(barra.destra), height: barra.h + 8, scale: 2 } });
    require('fs').writeFileSync(process.env.STUDIA_FOTO, Buffer.from(r.result.data, 'base64'));
    console.log('   fotografia: ' + process.env.STUDIA_FOTO);
  }

  console.log(ko ? '\n✗ ' + ko + ' controlli falliti' : '\n✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
