/* La POSTILLA dentro uno ZAINO, sul documento (Q6).
 *
 * ⚠️ Perché esiste. La prima versione di Q6 è stata provata solo nei CORSI, e
 * l'utente ha riferito «la postilla non funziona» lavorando in uno zaino. Le
 * due metà dell'app hanno superfici ancorabili diverse — là il capitolo, qui la
 * pagina di un PDF — e una voce provata da una parte sola è una voce provata a
 * metà.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-postilla-zaino.js
 */
const path = require('path');
const fs = require('fs');
const S = path.join(__dirname, 'cdp.js');
const { collega, val, invia, pausa, partiPulito, apriStrumento } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }
async function finoA(expr, q) { const f = Date.now() + (q || 20000);
  for (;;) { const v = await val(expr); if (v) return v; if (Date.now() > f) return null; await pausa(250); } }

const ZAINO = 'zaino-postilla';

(async () => {
  await collega();
  await val('location.reload(), 1'); await pausa(2500);
  await collega(); await pausa(800);
  await partiPulito();

  sezione('Uno zaino con un documento vero dentro');
  const vault = await val('window.vault.path');
  await val(`(async()=>{ await cambiaModo('zaino'); await zainoCrea('Zaino postilla'); return 1; })()`);
  await finoA(`zainoAttivo()==='${ZAINO}' ? 1 : 0`, 15000);
  const fuori = fs.mkdtempSync(path.join(require('os').tmpdir(), 'studia-scriv-'));
  const originale = fs.readdirSync(path.join(vault, 'Fonti')).filter((f) => f.toLowerCase().endsWith('.pdf'))[0];
  const sorgente = path.join(fuori, 'Dispensa.pdf');
  fs.copyFileSync(path.join(vault, 'Fonti', originale), sorgente);
  const entrato = await val(`(async()=>{ const r=await window.vault.fonti.importa(corsoAttivo(),
    [${JSON.stringify(sorgente)}]); return (r.copiati||[]).map(function(x){ return x.nome; })[0]||''; })()`);
  ok('il documento è entrato nello zaino', '01 Dispensa.pdf', entrato);

  await apriStrumento('fonte');
  await val(`openPdf(${JSON.stringify(entrato)}, 1, 'Dispensa'), 1`);
  await finoA(`(PDFJS.doc && PDFJS.doc.numPages) || 0`, 25000);
  const pronta = await finoA(`(()=>{ const p=document.querySelector('#pdfFrame .page[data-page-number="1"]');
    const t=p && p.querySelector('.textLayer'); return t && t.firstChild ? 1 : 0; })()`, 25000);
  ok('e il suo testo è disegnato', 1, pronta);

  sezione('⚠️ Selezionando NEL DOCUMENTO, «Postilla…» è viva');
  const riga = await val(`(()=>{ const p=document.querySelector('#pdfFrame .page[data-page-number="1"]');
    const t=p.querySelector('.textLayer');
    const sp=[...t.querySelectorAll('span')].filter(s=>{ const r=s.getBoundingClientRect();
      return r.width>90 && r.top>0 && r.bottom<innerHeight && s.textContent.trim().length>25; });
    if(!sp.length) return null;
    const s=sp[0], r=s.getBoundingClientRect();
    return { x1:Math.round(r.left+2), x2:Math.round(r.right-2), y:Math.round(r.top+r.height/2) }; })()`);
  ok('c\'è una riga su cui lavorare', true, !!riga);
  await val('getSelection().removeAllRanges(), 1');
  await invia('Input.dispatchMouseEvent', { type: 'mousePressed', x: riga.x1, y: riga.y, button: 'left', clickCount: 1 });
  await invia('Input.dispatchMouseEvent', { type: 'mouseMoved', x: riga.x2, y: riga.y, button: 'left', buttons: 1 });
  await invia('Input.dispatchMouseEvent', { type: 'mouseReleased', x: riga.x2, y: riga.y, button: 'left', clickCount: 1 });
  await pausa(500);

  const voce = await val(`(()=>{ const s=getSelection(); if(!s.rangeCount) return null;
    const r=s.getRangeAt(0); selMenuApri(60,60,{ testo:r.toString(), range:r });
    const b=document.querySelector('#selMenu .ctx-item[data-az="postilla"]');
    return b ? { c:(b.textContent||'').trim(), spenta:!!b.disabled } : null; })()`);
  ok('la voce c\'è', true, !!voce);
  /* ⚠️ È QUESTO il controllo che mancava: nello zaino, sul documento, la voce
     deve essere VIVA. Provata solo nei corsi, restava spenta senza che nessuna
     prova lo dicesse. */
  ok('e NON è spenta', false, voce && voce.spenta);

  sezione('E il gesto scrive davvero, ancorando alla PAGINA');
  await val(`document.querySelector('#selMenu .ctx-item[data-az="postilla"]').click(), 1`);
  await pausa(700);
  ok('la modale si apre', true, await val(`!!document.getElementById('uiModal').hasAttribute('open')`));
  await val(`(()=>{ const i=document.getElementById('umInput'); i.value='da rivedere col tutor';
    i.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', bubbles:true })); return 1; })()`);
  await pausa(1200);

  const ev = await val(`(()=>{ const r=window.vault.evidenze.leggi(corsoAttivo());
    const c=(r.evidenze||[]).filter(function(e){ return e.nota; })[0];
    return c ? { nota:c.nota, materiale:c.materiale||'', pagina:c.pagina, haCapitolo:!!c.capitoloId } : null; })()`);
  ok('la postilla è sul disco', 'da rivedere col tutor', ev && ev.nota);
  /* ⚠️ Nello zaino l'ancora è il DOCUMENTO, non il capitolo: se qui comparisse
     un capitoloId, l'evidenza sarebbe ancorata a qualcosa che qui non esiste. */
  ok('ancorata al documento e alla sua pagina', ['01 Dispensa.pdf', 1, false],
    ev ? [ev.materiale, ev.pagina, ev.haCapitolo] : null);

  await val(`(async()=>{ if(modoAttivo()!=='corso') await cambiaModo('corso'); return 1; })()`);
  console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati'));
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('✗ ' + (e && e.message ? e.message : e)); process.exit(1); });
