/* La barra degli appunti è la barra della mappa.
 *
 * Erano due barre diverse per un motivo storico: quella degli appunti la
 * disegna EasyMDE — misure sue, cornice che compare al passaggio del mouse,
 * separatore fatto di due bordi, angoli tondi — e i comandi dell'appunto si
 * erano presi una riga tutta loro sotto gli strumenti. Su un editor alto mezza
 * colonna, una riga di barra in più è spazio per scrivere in meno.
 *
 * Che cosa si promette qui:
 *   · la stessa grammatica della mappa — documento a sinistra · strumenti ·
 *     spazio elastico · stampa e chiudi a destra;
 *   · lo stesso vestito — bottoni nudi alti 30, barrette da 1×16, niente
 *     angoli tondi, acceso = fondo teal;
 *   · la PARITÀ di righe. Non «una riga sempre»: in un riquadro da 480 pixel
 *     diciassette strumenti non ci stanno, e nemmeno la barra della mappa ci
 *     sta — vanno a capo tutte e due, ed è ciò che `.tbar` promette. Quello che
 *     non deve più succedere è che gli appunti ne usino una in più per forza.
 *
 * ⚠️ Gira contro il vault della config: puntarlo a una COPIA (trappola ⑧).
 *   ./test/cdp/con-vault-di-prova.sh prova-appunti-barra
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, val, pausa, apriStrumento, partiPulito } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
const stile = (sel) => val(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});
  if(!e) return null; const s=getComputedStyle(e), r=e.getBoundingClientRect();
  return { h:Math.round(r.height), largo:Math.round(r.width), display:s.display,
           bordo:s.borderTopWidth+s.borderRightWidth+s.borderBottomWidth+s.borderLeftWidth,
           raggio:s.borderTopLeftRadius, fondo:s.backgroundColor, minH:s.minHeight };})()`);
/* Quante righe occupa una barra: si contano i CENTRI, non i bordi alti — una
   barretta da 16 dentro una riga da 30 ha il bordo più in basso pur stando
   sulla stessa riga. */
const righe = (sel) => val(`(()=>{const t=document.querySelector(${JSON.stringify(sel)});
  const y=[...t.children].filter(e=>!e.hidden && getComputedStyle(e).display!=='none')
    .map(e=>{const r=e.getBoundingClientRect(); return Math.round((r.top+r.bottom)/2);});
  return new Set(y).size;})()`);

(async () => {
  await collega(); await partiPulito();
  /* ⚠️ Il banco di fabbrica si ottiene togliendo la chiave VIVA della disposizione — quella
     che `bancoChiave()` calcola per il contenitore attivo, `studia.banco.c.<id>` — non
     `studia.banco`, che è la chiave di modalità morta dal 13 agosto (guida §8). Con quella
     morta la prova CREDEVA di partire da zero e invece, al reload, ereditava la disposizione
     salvata da un'altra prova: un banco a un blocco, la mappa su una riga sola (39 px) e gli
     appunti su due (71 px). Rossa in ogni catena ZAINO del 7 settembre 2026, verde da sola. */
  await val(`(()=>{ const k=bancoChiave();
    ['studia.banco','studia.banco.zaino',k,k+'.zoom'].forEach(x=>localStorage.removeItem(x)); return 1; })()`);
  await val('location.reload(), 1');
  await pausa(1800); await collega(); await pausa(600);

  await apriStrumento('appunti'); await pausa(900);
  /* Senza un appunto aperto EasyMDE c'è lo stesso: la barra deve esserci
     sempre, è la porta da cui se ne crea uno. */
  ok('la barra degli appunti è a schermo', true,
    await val(`!!document.querySelector('#noteHost .editor-toolbar')`));

  console.log('\n== Parità con la mappa, nello stesso riquadro');
  await apriStrumento('mappa'); await pausa(500);
  const mappa = await stile('.mtoolbar');
  const righeMappa = await righe('.mtoolbar');
  await apriStrumento('appunti'); await pausa(700);
  const barra = await stile('#noteHost .editor-toolbar');
  const righeNote = await righe('#noteHost .editor-toolbar');
  console.log('   mappa ' + mappa.h + 'px / ' + righeMappa + ' righe   ·   appunti '
    + barra.h + 'px / ' + righeNote + ' righe');
  ok('stessa altezza minima', mappa.minH, barra.minH);
  ok('stesso fondo', mappa.fondo, barra.fondo);
  ok('niente angoli tondi (EasyMDE ne mette 4px)', '0px', barra.raggio);
  /* La parità di righe ha senso solo a parità di larghezza: se le due barre finissero in
     riquadri diversi, il rosso sotto parlerebbe del banco e non del vestito degli appunti. */
  ok('nello stesso riquadro: le due barre sono larghe uguali', mappa.largo, barra.largo);
  ok('non usa più righe della mappa', true, righeNote <= righeMappa);
  ok('e quindi non è più alta', true, barra.h <= mappa.h + 2);

  console.log('\n== I bottoni di EasyMDE parlano la lingua della barra');
  const b = await stile('#noteHost .editor-toolbar button.bold');
  ok('alti quanto quelli della mappa', 30, b.h);
  ok('larghi almeno quanto l\'area cliccabile del token', true, b.largo >= 30);
  ok('senza cornice', '0px0px0px0px', b.bordo);
  ok('e senza angoli tondi', '0px', b.raggio);
  ok('niente fondo a riposo', 'rgba(0, 0, 0, 0)', b.fondo);
  /* Uno strumento acceso deve usare la marca della mappa (fondo teal) e non la
     cornice grigia di EasyMDE: si accende la classe e si guarda che cosa
     cambia, invece di scrivere in un appunto vero per ottenerla. */
  ok('acceso = fondo, non cornice', true, await val(`(()=>{
    const b=document.querySelector('#noteHost .editor-toolbar button.bold');
    if(!b) return false; b.classList.add('active');
    const s=getComputedStyle(b), fondo=s.backgroundColor, bordo=s.borderTopWidth;
    b.classList.remove('active');
    return fondo!=='rgba(0, 0, 0, 0)' && bordo==='0px'; })()`));

  console.log('\n== Il separatore di EasyMDE è la barretta di StudIA');
  /* ⚠️ Sotto i 520px di riquadro una regola di contenitore li spegne — là
     dentro sono spazio sprecato — quindi qui si misura lo STILE, che il
     browser calcola anche su un elemento non disegnato, non l'ingombro. */
  const sep = await stile('#noteHost .editor-toolbar i.separator');
  const nostra = await stile('#noteHost .editor-toolbar .tbsep');
  ok('stesso colore della barretta di StudIA', nostra.fondo, sep.fondo);
  ok('e nessuno dei due bordi di EasyMDE', '0px0px0px0px', sep.bordo);
  ok('la barretta fra documento e strumenti è a schermo', 1, nostra.largo);
  ok('…alta 16', 16, nostra.h);

  console.log('\n== La grammatica: documento a sinistra, chiusura a destra');
  const ordine = await val(`[...document.querySelector('#noteHost .editor-toolbar').children]
    .filter(e=>!e.hidden && getComputedStyle(e).display!=='none')
    .map(e=>e.className.split(' ').filter(x=>x&&x!=='no-disable').join('.')||e.tagName)`);
  console.log('   ' + ordine.join(' · '));
  ok('il gruppo del documento apre la barra', 'notectl', ordine[0]);
  ok('lo spazio elastico precede la coda', true,
    ordine.indexOf('tbspazio') > 0 && ordine.indexOf('tbspazio') < ordine.indexOf('notectl.notectl-fine'));
  ok('e la coda chiude la barra', 'notectl.notectl-fine', ordine[ordine.length - 1]);
  const dx = await val(`(()=>{const t=document.querySelector('#noteHost .editor-toolbar');
    const f=t.querySelector('.notectl-fine');
    return Math.round(t.getBoundingClientRect().right - f.getBoundingClientRect().right);})()`);
  ok('stampa e chiudi sono davvero a destra', true, dx < 20);
  ok('i comandi ci sono ancora tutti', [true, true, true, true, true, true],
    await val(`['noteSelect','noteNew','noteSave','noteRen','noteDel','noteClose']
      .map(i=>!!document.getElementById(i))`));

  console.log('\n== La guida elenca i tasti, e sono gli stessi della barra');
  /* ⚠️ PERCHÉ QUESTA SEZIONE ESISTE. La sezione «Tasti» della guida è un elenco
     scritto a mano accanto ai suggerimenti dei bottoni, cioè una seconda copia:
     senza un controllo, il giorno che una scorciatoia cambia la guida continua a
     insegnare quella di prima e nessuno se ne accorge (è la trappola ④). Qui si
     misura che i due elenchi dicano la stessa cosa. */
  await val('apriGuida(), 1');
  await pausa(250);
  ok('la tabella dei tasti è nella guida', true,
    await val(`!!document.querySelector('table.guida.tasti')`));
  const inGuida = await val(`[...document.querySelectorAll('table.guida.tasti .g-kbd')].map(e=>e.textContent.trim())`);
  ok('…con almeno una dozzina di righe', true, inGuida.length >= 12);
  /* I suggerimenti della barra: quelli di EasyMDE li scrive lui in inglese
     («Bold (Cmd-B)») e `tastiNelDom` li traduce, quindi qui dentro i tasti si
     leggono già nella scrittura della piattaforma — la stessa che usa la guida. */
  const inBarra = await val(`[...document.querySelectorAll('#noteHost [title]')]
    .map(e=>e.getAttribute('title')).join(' § ')`);
  /* Non tutte le righe hanno un bottone (Invio, Esc, ⌘Invio non ne hanno): si
     controllano quelle che ce l'hanno, che sono le sole che possono divergere. */
  const daiDue = ['⌘S', '⌘B', '⌘I', '⌘K', '⌘L', 'F9', '⌘⇧C'];
  for (const k of daiDue) {
    const kk = await val(`tasti(${JSON.stringify(k)})`);
    ok('«' + kk + '» sta nella guida e nella barra', [true, true],
      [inGuida.some(t => t.indexOf(kk) >= 0), inBarra.indexOf(kk) >= 0]);
  }
  /* ⌘J non lo scrive EasyMDE — l'anteprima è nostra — ed è proprio la riga che
     un elenco scritto a mano si dimentica per prima. */
  const jj = await val('tasti("⌘J")');
  ok('e «' + jj + '», che è dell\'app e non dell\'editor', [true, true],
    [inGuida.some(t => t.indexOf(jj) >= 0), inBarra.indexOf(jj) >= 0]);
  await val('chiudiGuida(), 1');
  await pausa(150);

  if (process.env.STUDIA_FOTO) {
    const { invia } = require(S);
    const box = await val(`(()=>{const r=document.querySelector('#noteHost .editor-toolbar').getBoundingClientRect();
      return {x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)};})()`);
    const r = await invia('Page.captureScreenshot', { format: 'png',
      clip: { x: box.x, y: box.y, width: box.w, height: box.h + 6, scale: 2 } });
    require('fs').writeFileSync(process.env.STUDIA_FOTO, Buffer.from(r.result.data, 'base64'));
    console.log('   fotografia: ' + process.env.STUDIA_FOTO);
  }

  console.log(ko ? '\n✗ ' + ko + ' controlli falliti' : '\n✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
