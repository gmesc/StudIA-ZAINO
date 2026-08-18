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
const { collega, val, pausa, partiPulito, partiVuoto, apriStrumento } = require(S);

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
  await collega(); /* la barra della selezione non deve trovare un appunto riaperto davanti */
  await partiVuoto();
  await val('location.reload(), 1'); await pausa(1800); await collega(); await pausa(700);
  /* ⚠️ Il CAPITOLO davanti, e da solo. Da quando l app ripristina all avvio la
     disposizione del banco lasciata l ultima volta, dopo un reload il capitolo
     può ritrovarsi coperto da un altro strumento: il mouse sintetico passa dal
     rilevamento del bersaglio come quello vero, quindi il trascinamento
     finisce sul riquadro sopra e non seleziona niente. La barra non compare, e
     il rosso accusa la barra invece della disposizione. */
  await val(`(()=>{ try{ bancoForma('uno'); }catch(e){} return 1; })()`);
  await pausa(300);
  await apriStrumento('capitolo');

  console.log('\n== La barra compare da sé sulla selezione');
  const p = await selezionaNelCapitolo();
  ok('c\'è un capitolo con del testo', true, !!p);
  /* ⚠️ Che il trascinamento abbia SELEZIONATO si chiede subito, e prima di
     tutto il resto: se il capitolo non è in vista il mouse cade su ciò che lo
     copre, non si seleziona niente, e tutti i controlli sotto — barra, testata,
     menu — vanno in rosso accusando pezzi che non hanno colpa. Costato un
     pomeriggio il 13 agosto: il rosso diceva «la barra è aperta: no», e la
     verità era «non c'è nessuna selezione». */
  ok('il trascinamento ha davvero selezionato del testo', true,
    await val(`(()=>{ const s=getSelection();
      return !!(s.rangeCount && !s.isCollapsed && s.getRangeAt(0).toString().trim().length>3); })()`));
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

  console.log('\n== Il 🔗: la fonte nel frammento si può togliere');
  /* ⚠️ È l'unico bottone di queste barre che NON fa il gesto: dice come sarà
     fatto il prossimo. Da qui tre cose da misurare — che ci sia in tutte e due
     le superfici, che NON chiuda il menu (chi lo preme sta ancora decidendo) e
     che i due interruttori dicano la stessa cosa: menu e barra possono essere a
     schermo insieme, e uno acceso di qua e spento di là è peggio di nessuno. */
  ok('il 🔗 c\'è in tutte e due', [1, 1],
    await val(`[document.querySelectorAll('#selMenu .ctx-cita').length,
                document.querySelectorAll('#selBarra .ctx-cita').length]`));
  const fonteIn = (md) => /\]\(pdf:|\]\(cap:/.test(String(md));
  const frammento = () => val(`frammentoAppuntato('Una frase presa dal testo.', curCtx(), null)`);
  ok('di suo la fonte c\'è', true, fonteIn(await frammento()));
  await val(`document.querySelector('#selMenu .ctx-cita').click(), 1`);
  await pausa(150);
  ok('premerlo non chiude il menu', true,
    await val(`document.querySelector('#selMenu').classList.contains('open')`));
  ok('adesso il frammento arriva senza la fonte', false, fonteIn(await frammento()));
  ok('e i due interruttori dicono la stessa cosa', ['false', 'false'],
    await val(`[...document.querySelectorAll('#selMenu .ctx-cita, #selBarra .ctx-cita')]
      .map(b=>b.getAttribute('aria-pressed'))`));
  ok('la scelta è scritta dove si ricorda', '0',
    await val(`localStorage.getItem('studia.appunta.cita')`));
  /* ⚠️ E si rimette com'era: lo stato che una prova lascia è l'ingresso di
     quella dopo, e `prova-evidenze-pdf` misura un frammento CON la sua fonte.
     È lo stesso guasto già pagato con l'evidenziatore, dall'altro lato. */
  await val(`document.querySelector('#selMenu .ctx-cita').click(), 1`);
  await pausa(150);
  ok('rimessa, la fonte torna', true, fonteIn(await frammento()));

  console.log(ko ? '\n✗ ' + ko + ' controlli falliti' : '\n✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
