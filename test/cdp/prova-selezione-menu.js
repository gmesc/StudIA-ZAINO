/* Un menu solo, due porte.
 *
 * Sulla selezione si arriva in due modi — la barra che compare da sé e il tasto
 * destro — e fino a oggi erano due disegni diversi per le stesse cinque azioni:
 * qui una fila di icone (✎ ◯ ⌫), là un elenco di voci a parole. Chi imparava
 * l'uno non riconosceva l'altro, e ogni condizione che accende o spegne un
 * comando era scritta due volte.
 *
 * Adesso il menu lo scrive `selMenuHTML()` e le due superfici lo mostrano. Qui
 * si misura che siano davvero LO STESSO — stesse voci, stesse parole, stesso
 * vestito — e che restino due cose distinte solo in ciò che le distingue: dove
 * si posano.
 *
 * ⚠️ Gira contro il vault della config: puntarlo a una COPIA (trappola ⑧).
 *   ./test/cdp/con-vault-di-prova.sh prova-selezione-menu
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, val, pausa, partiPulito } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}

/* Seleziona un pezzo di testo del capitolo con eventi veri di mouse: una
   selezione fatta da JS non fa comparire la barra, che nasce dal `mouseup`. */
async function selezionaNelCapitolo() {
  const p = await val(`(()=>{const n=document.querySelector('#content p');
    if(!n) return null; const r=n.getBoundingClientRect();
    return { x1:Math.round(r.left+8), y:Math.round(r.top+r.height/2), x2:Math.round(r.left+Math.min(180,r.width-8)) };})()`);
  if (!p) return false;
  const { invia } = require(S);
  await invia('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x1, y: p.y, button: 'left', clickCount: 1 });
  await invia('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x2, y: p.y, button: 'left', buttons: 1 });
  await invia('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x2, y: p.y, button: 'left', clickCount: 1 });
  await pausa(350);
  return p;
}

/** La firma di una superficie: che cosa offre e come è vestita. */
const firma = (sel) => val(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});
  if(!e) return null; const s=getComputedStyle(e);
  return {
    voci:[...e.querySelectorAll('.ctx-item')].map(b=>b.textContent.trim()),
    spente:[...e.querySelectorAll('.ctx-item')].filter(b=>b.disabled).map(b=>b.dataset.az),
    colori:e.querySelectorAll('.ctx-col').length,
    riquadri:e.querySelectorAll('.ctx-cal').length,
    testata:!!e.querySelector('.ctx-head'),
    fondo:s.backgroundColor, bordo:s.borderTopWidth, ombra:s.boxShadow!=='none',
    largo:Math.round(e.getBoundingClientRect().width),
    vecchiStili:e.querySelectorAll('.sb-az, .sb-sep').length };})()`);

(async () => {
  await collega(); await partiPulito();
  await val('location.reload(), 1'); await pausa(1800); await collega(); await pausa(700);

  console.log('\n== La barra compare da sé sulla selezione');
  const p = await selezionaNelCapitolo();
  ok('c\'è un capitolo con del testo', true, !!p);
  const barra = await firma('#selBarra');
  ok('la barra è aperta', true, await val(`document.querySelector('#selBarra').classList.contains('aperta')`));
  ok('e porta le classi del menu contestuale', true,
    await val(`(()=>{const c=document.querySelector('#selBarra').classList; return c.contains('ctxmenu')&&c.contains('selmenu');})()`));
  ok('niente più bottoni del vecchio disegno', 0, barra.vecchiStili);
  ok('ha una testata col testo scelto', true, barra.testata);
  console.log('   voci: ' + JSON.stringify(barra.voci));
  /* ⚠️ La fotografia si scatta ADESSO, non in fondo. Dopo il tasto destro la
     barra non torna da sé: il click che chiude il menu chiude anche lei, e una
     seconda selezione dovrebbe cominciare da un gesto pulito. Fotografare qui
     costa una riga; rifare il gesto costava una prova che sembra rotta. */
  if (process.env.STUDIA_FOTO) {
    const { invia: manda } = require(S);
    const box = await val(`(()=>{const r=document.querySelector('#selBarra').getBoundingClientRect();
      return {x:Math.max(0,Math.round(r.left)-40),y:Math.max(0,Math.round(r.top)-30),
              w:Math.round(r.width)+140,h:Math.round(r.height)+120};})()`);
    const foto = await manda('Page.captureScreenshot', { format: 'png',
      clip: { x: box.x, y: box.y, width: box.w, height: box.h, scale: 2 } });
    require('fs').writeFileSync(process.env.STUDIA_FOTO, Buffer.from(foto.result.data, 'base64'));
    console.log('   fotografia: ' + process.env.STUDIA_FOTO);
  }

  console.log('\n== Il tasto destro apre la stessa cosa');
  /* ⚠️ `Input.dispatchMouseEvent` col tasto destro NON produce un evento
     `contextmenu` in Chromium: quello lo genera il sistema operativo, e via CDP
     non arriva mai. Si manda l'evento vero e proprio, con le coordinate dentro
     la selezione — che è la condizione che il gestore controlla. Stessa strada
     di `prova-keyword.js`. */
  const { invia } = require(S);
  /* ⚠️ Il punto lo dà la SELEZIONE, non il paragrafo. Il gestore controlla che
     il click cada dentro i rettangoli del range (`puntoNellaSelezione`), e il
     centro verticale del paragrafo può stare su un'altra riga: misurato, il
     menu non si apriva e sembrava un guasto del menu. */
  await val(`(()=>{const r=selezioneAttiva().range.getClientRects()[0];
    const x=Math.round(r.left+r.width/2), y=Math.round(r.top+r.height/2);
    document.elementFromPoint(x,y)
      .dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:x,clientY:y}));
    return 1;})()`);
  await pausa(400);
  const menu = await firma('#selMenu');
  ok('il menu è aperto', true, await val(`document.querySelector('#selMenu').classList.contains('open')`));
  ok('la barra si è spenta (non si coprono)', false,
    await val(`document.querySelector('#selBarra').classList.contains('aperta')`));

  console.log('\n== Sono lo stesso menu');
  ok('stesse voci, nello stesso ordine', menu.voci, barra.voci);
  ok('stesse voci spente', menu.spente, barra.spente);
  ok('stessa riga di colori', menu.colori, barra.colori);
  ok('stessa riga di riquadri', menu.riquadri, barra.riquadri);
  ok('stesso fondo', menu.fondo, barra.fondo);
  ok('stessa cornice', menu.bordo, barra.bordo);
  ok('stessa ombra', menu.ombra, barra.ombra);
  ok('larghezza nello stesso ordine di grandezza', true, Math.abs(menu.largo - barra.largo) <= 8);

  console.log('\n== E restano due cose diverse solo in ciò che le distingue');
  ok('la barra sta sopra il menu nell\'impilamento', true,
    await val(`parseInt(getComputedStyle(document.querySelector('#selBarra')).zIndex,10)
             > parseInt(getComputedStyle(document.querySelector('#selMenu')).zIndex,10)`));
  ok('la barra è ancorata alla selezione', true,
    await val(`getComputedStyle(document.querySelector('#selBarra')).positionAnchor==='--selezione'`));

  console.log(ko ? '\n✗ ' + ko + ' controlli falliti' : '\n✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
