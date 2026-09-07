/* «Alla mappa» da un DOCUMENTO: il pallino della fonte apre davvero (Q3).
 *
 * ⚠️ Perché esiste. Selezioni una frase in un PDF, premi «Alla mappa»: nasce un
 * nodo col testo e col pallino della fonte nell'angolo — che cliccato non apriva
 * NIENTE. Il frammento nasceva con `capitolo: state.current`, cioè il capitolo
 * che si stava leggendo, che con un documento davanti non c'entra, e in uno
 * zaino non esiste affatto. Un pallino che compare e non apre è «un comando su
 * carta»: un disegno che promette un gesto impossibile.
 *
 * La forma del rimando e la regola «meglio nessun pallino di uno che non apre»
 * stanno in `App/assets/mappa/modifica.js` e si provano in Node
 * (`test/modifica.js`). Qui si misura ciò che in Node non si vede: che il
 * frammento estratto dalla selezione VERA porti il rimando giusto, e che
 * premendo il pallino il documento si apra ALLA PAGINA da cui il testo veniva.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-mappa-pallino.js
 */
const path = require('path');
const S = path.join(__dirname, 'cdp.js');
const { collega, val, invia, pausa, partiPulito, apriStrumento, pdfVisibile } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

async function finoA(expr, quanto) {
  const fine = Date.now() + (quanto || 15000);
  for (;;) {
    const v = await val(expr);
    if (v) return v;
    if (Date.now() > fine) return null;
    await pausa(250);
  }
}

const PDF = 'Piano-di-studio-della-Scuola-dell-obbligo-ticinese.pdf';
const PAGINA = 30;

/** Seleziona col MOUSE VERO una riga del layer di testo, e torna il suo testo. */
async function selezionaUnaRiga() {
  const riga = await val(`(()=>{ const p=document.querySelector('#pdfFrame .page[data-page-number="${PAGINA}"]');
    if(!p) return null; const t=p.querySelector('.textLayer'); if(!t) return null;
    const sp=[...t.querySelectorAll('span')].filter(s=>{ const r=s.getBoundingClientRect();
      return r.width>90 && r.top>0 && r.bottom<innerHeight && s.textContent.trim().length>25; });
    if(!sp.length) return null;
    const s=sp[0], r=s.getBoundingClientRect();
    return { testo:s.textContent, x1:Math.round(r.left+2), x2:Math.round(r.right-2),
             y:Math.round(r.top+r.height/2) }; })()`);
  if (!riga) return null;
  await val('getSelection().removeAllRanges(), 1');
  await invia('Input.dispatchMouseEvent', { type: 'mousePressed', x: riga.x1, y: riga.y, button: 'left', clickCount: 1 });
  await invia('Input.dispatchMouseEvent', { type: 'mouseMoved', x: Math.round((riga.x1 + riga.x2) / 2), y: riga.y, button: 'left', buttons: 1 });
  await invia('Input.dispatchMouseEvent', { type: 'mouseMoved', x: riga.x2, y: riga.y, button: 'left', buttons: 1 });
  await invia('Input.dispatchMouseEvent', { type: 'mouseReleased', x: riga.x2, y: riga.y, button: 'left', clickCount: 1 });
  await pausa(300);
  return riga;
}

(async () => {
  await collega();
  await val('location.reload(), 1'); await pausa(2000);
  await collega(); await pausa(800);
  await partiPulito();

  sezione('Un documento aperto, e una frase selezionata col mouse');
  await apriStrumento('fonte');
  await pdfVisibile(PDF);
  await val(`openPdf(${JSON.stringify(PDF)}, ${PAGINA}, 'Piano di studio'), 1`);
  await finoA(`(PDFJS.doc && PDFJS.doc.numPages) || 0`, 25000);
  await finoA(`(()=>{ const p=document.querySelector('#pdfFrame .page[data-page-number="${PAGINA}"]');
    const t=p && p.querySelector('.textLayer'); return t && t.firstChild ? 1 : 0; })()`, 25000);
  /* Si parte da una mappa «Mie» vuota: il nodo estratto deve essere l'ultimo, e
     un residuo di un giro precedente falserebbe l'indice. */
  await val(`(()=>{ MAPPA.registro='mie'; MAPPA.mia.file=''; MAPPA.mia.grafo={ nodi:[], archi:[] };
    return 1; })()`);
  await apriStrumento('mappa');

  const riga = await selezionaUnaRiga();
  ok('la selezione col mouse ha preso del testo', true, !!(riga && riga.testo));

  sezione('«Alla mappa»: il nodo nasce col rimando al DOCUMENTO, non a un capitolo');
  await val(`(()=>{ const r=getSelection().rangeCount ? getSelection().getRangeAt(0) : null;
    mappaEstrai(r ? r.toString() : '', r); return 1; })()`);
  await pausa(700);

  const nodo = await val(`(()=>{ const g=MAPPA.mia.grafo; if(!g || !g.nodi.length) return null;
    const n=g.nodi[g.nodi.length-1];
    return { origine:n.origine, rimando:n.rimando||null, capitolo:('capitolo' in n) ? n.capitolo : null,
             testo:(n.testo||'').slice(0,30) }; })()`);
  ok('il nodo c\'è ed è nato da una fonte', 'fonte', nodo && nodo.origine);
  ok('e porta un rimando al documento, con la sua pagina',
    ['pdf', PDF, PAGINA], nodo && nodo.rimando ? [nodo.rimando.type, nodo.rimando.file, nodo.rimando.page] : null);
  /* ⚠️ E NON porta anche un capitolo: due provenienze su un nodo solo sono una
     doppia verità sul disco, e chi lo apre ne sceglie una. */
  ok('e NON dichiara anche un capitolo, che sarebbe la seconda provenienza', null, nodo && nodo.capitolo);

  sezione('⚠️ Il pallino APRE: è tutto il punto di questo lavoro');
  {
    /* Si sposta il documento altrove, così «si è aperto alla pagina giusta» non
       può essere vero per caso: era già lì. */
    await val(`openPdf(${JSON.stringify(PDF)}, 3, 'Piano di studio'), 1`);
    await finoA(`(ANTEPRIMA.page===3) ? 1 : 0`, 15000);
    ok('il documento adesso è su un\'altra pagina', 3, await val(`ANTEPRIMA.page`));

    /* La porta è quella vera: `mappaVaiAllaFonte` è ciò che il click sul
       pallino chiama. Il pallino come pixel lo prova `prova-mappe-ui`; qui si
       prova che ciò che c'è SUL NODO sappia aprire. */
    await val(`(()=>{ const g=MAPPA.mia.grafo; const n=g.nodi[g.nodi.length-1];
      mappaVaiAllaFonte(n); return 1; })()`);
    const tornato = await finoA(`(ANTEPRIMA.page===${PAGINA}) ? 1 : 0`, 15000);
    ok('premendo il pallino il documento torna alla pagina da cui il testo veniva', 1, tornato);
    ok('ed è proprio quel documento', PDF, await val(`ANTEPRIMA.file||''`));
  }

  sezione('Senza documento sotto, il pallino non compare affatto');
  {
    /* ⚠️ «Meglio nessun pallino di uno che non apre», che è lo stesso difetto
       al contrario. Un frammento senza origine e senza capitolo non deve
       dichiarare una fonte che non sa indicare. */
    const nudo = await val(`(()=>{ const prima=MAPPA.mia.grafo.nodi.length;
      const g=MappaModifica.estrai(MAPPA.mia.grafo, { testo:'un frammento senza provenienza' });
      const n=g.nodi[g.nodi.length-1];
      return { cresciuto:(g.nodi.length===prima+1), origine:n.origine, haRimando:('rimando' in n) }; })()`);
    ok('il frammento non si perde', true, nudo.cresciuto);
    ok('ma nasce «utente», senza pallino', ['utente', false], [nudo.origine, nudo.haRimando]);
  }

  /* Si lascia la mappa com'era: le prove girano contro la stessa istanza. */
  await val(`(()=>{ MAPPA.mia.grafo={ nodi:[], archi:[] }; MAPPA.mia.file=''; mappaRidisegna(); return 1; })()`);
  console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati'));
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('✗ ' + (e && e.message ? e.message : e)); process.exit(1); });
