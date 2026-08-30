/* B1 — il banco, dalla porta principale. */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, invia, val, clicca, pausa } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
const dentro = (sel, padre) => val(`!!document.querySelector('${padre} ${sel}')`);

(async () => {
  await collega();

  /* ⚠️ Si riparte dallo stato di fabbrica, e va fatto QUI.
     Questo file asseriva «forma di fabbrica: due affiancati» senza azzerare niente, e il
     `localStorage` sopravvive alla chiusura dell'app: bastava un'esecuzione precedente — o
     un giro dell'utente — perché nove controlli diventassero rossi senza che il codice
     avesse nulla che non andasse. È costato due diagnosi sbagliate il 9 agosto, prima di
     capire che il colpevole era la prova e non ciò che provava. */
  await val(`(()=>{ /* ⚠️ TUTTE le chiavi del banco, non «studia.banco». Quella è la chiave
       di MODALITÀ, morta dal 13 agosto: da allora ogni corso e ogni zaino
       ricordano il SUO banco in studia.banco.c.<contenitore> (bancoChiave()),
       e togliere la morta non ripristinava niente — la prova credeva di partire
       dalla forma di fabbrica e partiva da quella lasciata da un'altra. Si
       spazza il prefisso, così vale anche per i contenitori che questa prova non
       sa di stare per aprire. */
    Object.keys(localStorage).filter(function(k){ return k.indexOf('studia.banco')===0; })
      .forEach(function(k){ localStorage.removeItem(k); }); return 1; })()`);
  await val('location.reload(), 1');
  await pausa(1500);
  await collega();
  await pausa(500);

  ok('il modulo delle forme è caricato', 'object', await val('typeof BancoForme'));
  ok('il banco c’è', true, await val("!!document.getElementById('banco')"));

  // ---- lo stato di partenza
  ok('forma di fabbrica: due affiancati', 'due-col', await val('bancoStato().forma'));
  ok('il capitolo sta nel blocco A', true, await dentro('main', '.bcorpo[data-corpo="A"]'));
  ok('gli appunti nel blocco C', true, await dentro('#notePane', '.bcorpo[data-corpo="C"]'));
  ok('i blocchi non usati sono nascosti', [false, true, false, true],
    await val(`['A','B','C','D'].map(b=>document.querySelector('.blocco[data-blocco="'+b+'"]').hidden)`));
  ok('un divisore solo, quello verticale', [false, true],
    await val(`[document.getElementById('bDivCol').hidden, document.getElementById('bDivRiga').hidden]`));
  ok('la fonte, che non è a schermo, aspetta in magazzino e non è distrutta', true,
    await dentro('#pdfPane', '#bancoMagazzino'));

  // ---- la pagina non scorre più: scorre il blocco
  ok('la pagina non ha barra di scorrimento', true,
    await val('document.documentElement.scrollHeight <= document.documentElement.clientHeight + 2'));
  ok('il corpo del capitolo invece scorre', true,
    await val(`(()=>{const c=bancoCorpoDi('capitolo'); return !!c && c.scrollHeight > c.clientHeight;})()`));

  // ---- il selettore della forma
  await clicca('#bancoBtn'); await pausa(300);
  /* Dodici di fabbrica più la casella «+» del pittore (B1, 15 agosto). Si conta
     dalla TABELLA e non con un numero scritto qui: le forme personali
     dell'utente ne aggiungono altre, e questa prova non deve arrossire per una
     preferenza. */
  const inTabella = await val('Object.keys(BancoForme.FORME).length');
  ok('il selettore mostra tutte le forme della tabella, più il pittore',
    inTabella + 1, await val("document.querySelectorAll('#bForme .bforma').length"));
  ok('e segna quella in uso', 'due-col',
    await val("document.querySelector('#bForme .bforma[aria-pressed=\"true\"]').dataset.forma"));
  await clicca('#bForme .bforma[data-forma="quattro"]'); await pausa(400);
  ok('passando a quattro blocchi, si vedono tutti', [false, false, false, false],
    await val(`['A','B','C','D'].map(b=>document.querySelector('.blocco[data-blocco="'+b+'"]').hidden)`));
  ok('e compaiono tutti e due i divisori', [false, false],
    await val(`[document.getElementById('bDivCol').hidden, document.getElementById('bDivRiga').hidden]`));

  // ---- scegliere lo strumento di un blocco
  await val(`(()=>{const s=document.querySelector('.bsel[data-blocco="B"]');
    s.value='fonte'; s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await pausa(350);
  ok('la fonte entra nel blocco B', true, await dentro('#pdfPane', '.bcorpo[data-corpo="B"]'));
  ok('e il blocco dice a quale famiglia appartiene', 'fonte',
    await val(`document.querySelector('.blocco[data-blocco="B"]').dataset.fam`));

  // ---- uno strumento sta in un blocco solo: sceglierlo altrove lo sposta
  await val(`(()=>{const s=document.querySelector('.bsel[data-blocco="D"]');
    s.value='appunti'; s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await pausa(350);
  ok('gli appunti si spostano in D…', true, await dentro('#notePane', '.bcorpo[data-corpo="D"]'));
  ok('…e non restano anche in C', false, await dentro('#notePane', '.bcorpo[data-corpo="C"]'));
  ok('in C è finito ciò che stava in D: uno scambio, non un buco', 'keyword',
    await val("bancoStrumentoIn('C')"));

  // ---- il divisore, e la memoria
  const rBanco = await val(`(()=>{const r=document.getElementById('banco').getBoundingClientRect();
    return {x:Math.round(r.left), y:Math.round(r.top), w:Math.round(r.width), h:Math.round(r.height)};})()`);
  const colPrima = await val('bancoStato().col');
  /* Si prende il divisore verticale **a metà altezza**, che è dove la mano lo
     cerca — ed è anche il punto in cui incrocia quello orizzontale: se un
     giorno l'ordine dei due cambia, questo controllo se ne accorge. */
  const dv = await val(`(()=>{const r=document.getElementById('bDivCol').getBoundingClientRect();
    return {x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2)};})()`);
  ok('a metà altezza il manico che si prende è quello verticale', 'bDivCol',
    await val(`(()=>{const r=document.getElementById('bDivCol').getBoundingClientRect();
      const e=document.elementFromPoint(Math.round(r.left+r.width/2), Math.round(r.top+r.height/2));
      return e?e.id:'niente';})()`));
  await invia('Input.dispatchMouseEvent', { type: 'mousePressed', x: dv.x, y: dv.y, button: 'left', clickCount: 1 });
  for (let i = 1; i <= 5; i++) {
    await invia('Input.dispatchMouseEvent', { type: 'mouseMoved', button: 'left', buttons: 1,
      x: Math.round(dv.x - 120 * i / 5), y: dv.y });
    await pausa(25);
  }
  await invia('Input.dispatchMouseEvent', { type: 'mouseReleased', x: dv.x - 120, y: dv.y, button: 'left', clickCount: 1 });
  await pausa(300);
  const col = await val('bancoStato().col');
  ok('trascinando il divisore la colonna si stringe', true, col < colPrima);
  ok('e la misura è una FRAZIONE, non pixel', true, col > 0 && col < 1);
  /* La chiave la dice `bancoChiave()`: dal 13 agosto è del CONTENITORE. */
  ok('lo stato è finito nel localStorage', true,
    await val(`(JSON.parse(localStorage.getItem(bancoChiave())||'{}').col||0) === bancoStato().col`));

  // ---- sopravvive alla ricarica
  await invia('Page.enable', {});
  await invia('Page.reload', {});
  await pausa(3500);
  ok('dopo la ricarica la forma è quella di prima', 'quattro', await val('bancoStato().forma'));
  ok('e anche le assegnazioni', ['capitolo', 'fonte', 'keyword', 'appunti'],
    await val("['A','B','C','D'].map(bancoStrumentoIn)"));

  // ---- «fai posto a questo strumento» quando non è a schermo
  await val(`(()=>{ bancoForma('uno'); bancoAssegna('A','capitolo'); })()`); await pausa(400);
  ok('con un blocco solo, gli appunti non sono a schermo', false, await val("bancoVisibile('appunti')"));
  await val('openEditor()'); await pausa(600);
  ok('aprire gli appunti fa crescere il banco alla forma più piccola che li tiene', true,
    await val("bancoVisibile('appunti')"));
  ok('e il capitolo resta dov’era', true, await val("bancoVisibile('capitolo')"));

  // ---- si rimette com'era, per non lasciare il banco storto
  await val(`(()=>{ Object.keys(localStorage).filter(function(k){ return k.indexOf('studia.banco')===0; })
      .forEach(function(k){ localStorage.removeItem(k); });
    bancoCarica(); bancoDisegna(); return 1; })()`);
  await pausa(300);
  ok('lo stato di fabbrica si ripristina', 'due-col', await val('bancoStato().forma'));

  console.log(ko ? '\n✗ ' + ko + ' controlli falliti' : '\n✓ B1 verde dalla porta principale');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('ERRORE:', e); process.exit(2); });
