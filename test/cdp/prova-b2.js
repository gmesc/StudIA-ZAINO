/* B2 — la mappa dentro un blocco, dalla porta principale.
 *
 * Che cosa promette questo lotto: la mappa smette di essere un sipario calato
 * sopra il capitolo e diventa uno strumento del banco come la fonte e gli
 * appunti. Da qui le due promesse che i controlli qui sotto verificano davvero:
 * mappa e capitolo si vedono INSIEME, e le tre strade per aprirla e chiuderla
 * (il tasto in topbar, la ✕, Esc) più la quarta — la tendina del blocco —
 * finiscono tutte nello stesso posto.
 *
 * ⚠️ Gira contro il vault indicato nella config: puntarlo a una COPIA prima di
 * lanciarlo (trappola ⑧ dell'handoff 8-9 agosto: una sequenza interrotta ha già
 * fatto sparire una mappa dell'utente, e sotto non c'è versionamento).
 *
 *   ./node_modules/.bin/electron . --remote-debugging-port=9333
 *   node test/cdp/prova-b2.js
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, invia, val, clicca, pausa, apriStrumento } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
const dove = () => val(`(()=>{const v=document.getElementById('mappaView');
  const p=v&&v.parentElement; return p ? (p.id || p.className) : null;})()`);
const alto = (sel) => val(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});
  return e ? Math.round(e.getBoundingClientRect().height) : -1;})()`);

(async () => {
  await collega();

  // si parte dallo stato di fabbrica: senza, il primo controllo misura l'uso di
  // ieri invece della promessa del lotto
  await val('localStorage.removeItem("studia.banco"), 1');
  await val('location.reload(), 1');
  await pausa(1500);
  await collega();
  await pausa(500);

  console.log('\n== lo strumento esiste ed è spento');
  ok('la mappa è nel registro degli strumenti', 'Mappa', await val('bancoStrumenti().mappa.nome'));
  ok('e ora è disponibile: ha un elemento vero', true, await val('bancoDisponibile("mappa")'));
  ok('a freddo non è a schermo', false, await val('mappaAperta()'));
  ok('aspetta in magazzino, non distrutta', 'bancoMagazzino', await dove());
  ok('e NON è più annidata dentro il capitolo', false,
    await val(`!!document.getElementById('mappaView').closest('main')`));

  console.log('\n== la tendina del blocco la porta in scena');
  await apriStrumento('mappa');
  ok('la mappa è a schermo', true, await val('mappaAperta()'));
  ok('ed è dentro il corpo di un blocco', 'bcorpo', await dove());
  /* Il tasto in topbar non c'e' piu': lo stato lo dice il BANCO, che e' la
     verita' da quando la mappa e' uno strumento. */
  ok('e il banco la registra come strumento a schermo', true, await val('bancoVisibile("mappa")'));
  ok('l\'elenco degli strumenti a schermo la nomina', true,
    await val(`(document.documentElement.dataset.strumenti||'').split(' ').indexOf('mappa')>=0`));

  console.log('\n== la promessa del lotto: accanto al capitolo, non sopra');
  ok('il capitolo è ancora visibile', true,
    await val(`(()=>{const a=document.getElementById('content');
      return !!a && getComputedStyle(a).display!=='none' && a.getBoundingClientRect().height>0;})()`));
  ok('e anche la sua navigazione', true,
    await val(`(()=>{const n=document.querySelector('main > .nav');
      return !!n && getComputedStyle(n).display!=='none';})()`));
  ok('la mappa ha un\'altezza vera dentro il riquadro', true, (await alto('#mappaView')) > 80);
  ok('e la tela pure', true, (await alto('#mappaView .mtela')) > 20);

  console.log('\n== il guasto dei 72px non torna');
  // il piè di pagina faceva traboccare il documento: la rotella scorreva la
  // PAGINA invece della mappa, e la barra dei comandi usciva dalla vista
  ok('la pagina non ha barra di scorrimento', true,
    await val('document.documentElement.scrollHeight <= document.documentElement.clientHeight + 2'));
  ok('la barra dei comandi della mappa è dentro la finestra', true,
    await val(`(()=>{const b=document.querySelector('#mappaView .mtoolbar');
      if(!b) return false; const r=b.getBoundingClientRect();
      return r.top>=0 && r.bottom<=window.innerHeight;})()`));

  console.log('\n== la seconda strada: la tendina del blocco');
  // è l'ingresso che prima non esisteva, ed è la ragione per cui «la mappa è
  // aperta» non può più essere un attributo che solo la topbar sa accendere
  await clicca('#mChiudi'); await pausa(500);
  ok('la ✕ la rimanda in magazzino', 'bancoMagazzino', await dove());
  ok('e mappaAperta() lo sa', false, await val('mappaAperta()'));

  const bloccoLibero = await val(`(()=>{const b=bancoBlocchiVisibili().filter(function(x){
    return bancoStrumentoIn(x)!=='capitolo'; })[0]; return b||null;})()`);
  await val(`(()=>{const s=document.querySelector('.bsel[data-blocco="${bloccoLibero}"]');
    s.value='mappa'; s.dispatchEvent(new Event('change',{bubbles:true})); return 1;})()`);
  await pausa(600);
  ok('scegliendola dalla tendina, la mappa entra in scena', true, await val('mappaAperta()'));
  ok('ed è montata nel blocco scelto', true,
    await val(`!!document.querySelector('.bcorpo[data-corpo="${bloccoLibero}"] > #mappaView')`));
  ok('e anche per questa strada il banco la registra', true, await val('bancoVisibile("mappa")'));

  /* ⚠️ QUESTA SEZIONE DICEVA IL CONTRARIO fino al 23 agosto 2026: «Esc toglie la
     mappa dal banco», e lo strumento tornava in magazzino. Non è stata aggirata,
     è cambiata la promessa. L'ultimo gradino della catena degli Esc chiamava
     `bancoTogli('mappa')`, e non «chiudeva» la mappa — SVUOTAVA il blocco:
     tendina a «—», «Scegli uno strumento qui sopra», e il banco da ricomporre a
     mano. Esc è il tasto che si preme d'istinto e si preme due volte: nessuno
     dei suoi gradini può costare qualcosa. Il gesto per togliere la mappa resta
     la ✕, che questa stessa prova misura venti righe più su. */
  console.log('\n== Esc chiude uno strato per volta, e nessuno costa niente');
  await invia('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await invia('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await pausa(500);
  ok('Esc NON toglie la mappa dal banco', true, await val('mappaAperta()'));
  ok('e lo strumento resta nel suo blocco', 'bcorpo', await dove());
  ok('il capitolo non si è mosso', true,
    await val(`!!document.querySelector('.bcorpo[data-corpo="A"] > main')`));
  /* E la ✕ la toglie ancora: si è tolto un gradino alla catena, non il gesto. */
  await clicca('#mChiudi'); await pausa(500);
  ok('ma la ✕ sì', 'bancoMagazzino', await dove());

  console.log('\n== la barra di avanzamento segue il CAPITOLO, non la mappa');
  await apriStrumento('mappa');
  ok('col capitolo a schermo la barra resta', true,
    await val(`(()=>{const c=document.getElementById('cprog');
      return !!c && getComputedStyle(c).display!=='none';})()`));

  // si rimette com'era, che è la regola di queste prove: il vault e lo stato
  // vanno lasciati come li si è trovati
  await val('localStorage.removeItem("studia.banco"), 1');
  await val('location.reload(), 1');

  console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ B2 verde dalla porta principale'));
  process.exit(ko ? 1 : 0);
})();
