/* La finestra sulla riga, sull'app viva: il CABLAGGIO.
 *
 * ⚠️ Che cosa NON si prova qui. Dove passano le righe — gli apici, i corpi
 * diversi, le due colonne, i due decimi di pixel fra due `top` — lo decide
 * `App/assets/fonti/righello.js` e lo controlla `node test/righello.js`, in
 * quaranta millisecondi.
 *
 * ⚠️ IL CONTROLLO CHE VALE IL FILE è l'ultimo: **con la fascia accesa il testo
 * si seleziona ancora**. La fascia sta SOPRA il documento, e un elemento sopra
 * il layer di testo che intercettasse il mouse spegnerebbe in un colpo solo
 * «Appunta», l'evidenziatore, le forbici e la barra della selezione — cioè
 * metà dell'app, per un aiuto alla lettura. `pointer-events:none` non è una
 * rifinitura: è la funzione.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-righello.js
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, val, invia, pausa, partiPulito, apriStrumento, clicca } = require(S);

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
async function tasto(key, vk) {
  await invia('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code: key, windowsVirtualKeyCode: vk });
  await invia('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: vk });
  await pausa(300);
}
const FASCIA = `(()=>{ const e=document.getElementById('pdfRighello');
  const r=e.getBoundingClientRect(); const s=getComputedStyle(e);
  return { visibile:!e.hidden, top:Math.round(r.top), alta:Math.round(r.height),
           puntatore:s.pointerEvents, ombra:s.boxShadow.indexOf('rgba')>=0,
           banda:RIGHELLO.i, quante:RIGHELLO.bande.length }; })()`;

(async () => {
  await collega();
  await partiPulito();
  await apriStrumento('fonte');
  await val(`openPdf(${JSON.stringify(PDF)}, 1, 'Piano di studio'), 1`);
  await finoA('!!PDFJS.doc');
  /* ⚠️ NON basta «ci sono degli span»: servono span DENTRO il riquadro. Il layer
     di testo di pdf.js arriva dopo il disegno, e su un documento grosso monta
     anche le pagine vicine — i cui span stanno legittimamente fuori dalla vista.
     La prima stesura aspettava «più di dieci span» e misurava un istante in cui
     gli unici due a schermo erano di una pagina più in basso: zero bande, e il
     rosso accusava il righello per un'attesa scritta male. */
  const pronti = await finoA(`(()=>{ const h=document.getElementById('pdfHost');
    if(!h) return 0; const r=h.getBoundingClientRect();
    return [...document.querySelectorAll('#pdfFrame .textLayer span')]
      .filter(s=>{ const b=s.getBoundingClientRect();
        return b.height>0 && b.top>=r.top && b.bottom<=r.bottom; }).length; })()`, 25000);
  console.log('   righe di testo dentro il riquadro: ' + pronti);
  await pausa(400);

  sezione('Il comando c\'è e dice che cosa fa');
  ok('il bottone è a schermo con un documento aperto', false,
    await val("document.getElementById('pdfRighelloBtn').hidden"));
  ok('e da spento si spiega', true,
    await val("/isola la riga/.test(document.getElementById('pdfRighelloBtn').title)"));
  ok('la fascia parte spenta', true, await val("document.getElementById('pdfRighello').hidden"));

  sezione('Accendendola, si posa su una riga vera');
  await clicca('#pdfRighelloBtn'); await pausa(500);
  const acc = await val(FASCIA);
  console.log('   ' + JSON.stringify(acc));
  ok('la fascia si vede', true, acc.visibile);
  ok('ha trovato delle righe nella pagina', true, acc.quante > 3);
  /* ⚠️ Appena accesa si mette sulla PRIMA riga a schermo, non «da nessuna
     parte»: un comando che si accende senza che si veda niente sembra rotto. */
  ok('e si è posata sulla prima', 0, acc.banda);
  ok('è alta come una riga, non come mezza pagina', true, acc.alta > 8 && acc.alta < 90);
  ok('e il buio sta attorno, non dentro', true, acc.ombra);
  ok('il bottone si dichiara acceso', 'true',
    await val("document.getElementById('pdfRighelloBtn').getAttribute('aria-pressed')"));

  sezione('Le frecce la spostano di riga, e al capo non fa niente');
  const primo = await val('RIGHELLO.i');
  await tasto('ArrowDown', 40);
  ok('↓ scende di una riga', primo + 1, await val('RIGHELLO.i'));
  await tasto('ArrowDown', 40);
  await tasto('ArrowUp', 38);
  ok('↑ risale', primo + 1, await val('RIGHELLO.i'));
  /* ⚠️ In cima non gira in tondo: chi legge con la fascia e arriva al capo vuole
     accorgersi che è finita, non ritrovarsi dall'altra parte. */
  await val('RIGHELLO.i=0, 1');
  await tasto('ArrowUp', 38);
  ok('in cima, ↑ non riparte dal fondo', 0, await val('RIGHELLO.i'));

  sezione('Da spenta, ↑ ↓ tornano a scorrere il documento');
  await val('righelloAccendi(false), 1'); await pausa(200);
  ok('la fascia è sparita', true, await val("document.getElementById('pdfRighello').hidden"));
  const scrollPrima = await val("document.getElementById('pdfHost').scrollTop");
  await val("document.getElementById('pdfFrame').focus(), 1");
  await tasto('ArrowDown', 40);
  ok('e ↓ scorre la pagina come sempre', true,
    (await val("document.getElementById('pdfHost').scrollTop")) !== scrollPrima ||
    (await val('ANTEPRIMA.page')) > 0);

  sezione('Esc la spegne');
  await val('righelloAccendi(true), 1'); await pausa(300);
  ok('riaccesa', false, await val("document.getElementById('pdfRighello').hidden"));
  await tasto('Escape', 27);
  ok('Esc la spegne', true, await val("document.getElementById('pdfRighello').hidden"));
  /* ⚠️ E si ferma lì: il documento resta aperto. Esc è il tasto che si preme
     d'istinto, e dal 23 agosto nessuno dei suoi gradini costa qualcosa. */
  ok('e il documento resta aperto', true,
    await val("!!PDFJS.doc && document.documentElement.dataset.pdf==='1'"));

  sezione('⭐ Con la fascia accesa il testo si seleziona ancora');
  /* Il controllo che vale il file. Se la fascia intercettasse il mouse, un aiuto
     alla lettura spegnerebbe «Appunta», l'evidenziatore, le forbici e la barra
     della selezione: metà dell'app. */
  await val('righelloAccendi(true), 1'); await pausa(400);
  ok('la fascia non prende il puntatore', 'none', (await val(FASCIA)).puntatore);
  /* E non lo prende DAVVERO: si chiede al browser che cosa c'è sotto il punto in
     cui la fascia sta. Un `pointer-events:none` dichiarato e un elemento che
     resta comunque il bersaglio sarebbero due fatti diversi. */
  const sotto = await val(`(()=>{ const f=document.getElementById('pdfRighello');
    const r=f.getBoundingClientRect();
    const el=document.elementFromPoint(Math.round(r.left+r.width/2), Math.round(r.top+r.height/2));
    return el ? (el.id || el.className || el.tagName) : null; })()`);
  console.log('   sotto la fascia c\'è: ' + JSON.stringify(sotto));
  ok('sotto la fascia c\'è la pagina, non la fascia', false, String(sotto).indexOf('pdfRighello') >= 0);

  const scelto = await val(`(()=>{
    const sp=[...document.querySelectorAll('#pdfFrame .textLayer span')]
      .filter(s=>{ const r=s.getBoundingClientRect();
        return r.width>20 && r.top>0 && r.bottom<innerHeight && /^[A-Za-zÀ-ÿ]{4,}$/.test(s.textContent.trim()); });
    if(!sp.length) return null;
    const s=sp[0], r=s.getBoundingClientRect();
    return { testo:s.textContent.trim(), x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2) }; })()`);
  if (scelto) {
    /* Si porta la fascia proprio su quella riga, così la selezione avviene
       DENTRO di lei: è il caso peggiore, non uno comodo. */
    await val(`(()=>{ const i=FontiRighello.vicina(RIGHELLO.bande, ${scelto.y}); if(i>=0) righelloVai(i); return 1; })()`);
    await pausa(300);
    await invia('Input.dispatchMouseEvent', { type: 'mousePressed', x: scelto.x, y: scelto.y, button: 'left', clickCount: 2 });
    await invia('Input.dispatchMouseEvent', { type: 'mouseReleased', x: scelto.x, y: scelto.y, button: 'left', clickCount: 2 });
    await pausa(300);
    const sel = await val(`(()=>{ const s=getSelection();
      return (!s.rangeCount || s.isCollapsed) ? '' : s.getRangeAt(0).toString().trim(); })()`);
    console.log('   selezionato: ' + JSON.stringify(sel) + ' (il pezzo diceva ' + JSON.stringify(scelto.testo) + ')');
    ok('un doppio click dentro la fascia seleziona la parola', true,
      !!sel && scelto.testo.toLowerCase().indexOf(sel.toLowerCase()) >= 0);
  } else {
    ok('c\'era un pezzo su cui puntare', true, false);
  }

  await val('righelloAccendi(false), 1');
  console.log(ko ? `\n✗ ${ko} controlli falliti` : `\n✓ tutti i controlli passati`);
  process.exit(ko ? 1 : 0);
})();
