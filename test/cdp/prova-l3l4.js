/* L3 (archi e linking word) + L4 (menu contestuale) dalla porta principale. */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, invia, val, clicca, pausa, apriStrumento, partiPulito } = require(S);
const fs = require('fs'), path = require('path');

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
async function tasto(key, opt) {
  opt = opt || {};
  const base = { key, code: opt.code || key, windowsVirtualKeyCode: opt.vk || 0, modifiers: opt.mod || 0 };
  await invia('Input.dispatchKeyEvent', Object.assign({ type: 'keyDown' }, base));
  await invia('Input.dispatchKeyEvent', Object.assign({ type: 'keyUp' }, base));
}
async function scrivi(s) { for (const ch of s) await invia('Input.dispatchKeyEvent', { type: 'char', text: ch }); }
async function punto(sel) {
  return val(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return null;
    const r=e.getBoundingClientRect(); if(!r.width&&!r.height) return null;
    return {x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2)};})()`);
}
async function destro(p) {
  await invia('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'right', clickCount: 1 });
  await invia('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'right', clickCount: 1 });
  await pausa(250);
}
async function sinistro(p) {
  await invia('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
  await invia('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 });
  await pausa(250);
}
async function trascina(da, a) {
  await invia('Input.dispatchMouseEvent', { type: 'mousePressed', x: da.x, y: da.y, button: 'left', clickCount: 1 });
  for (let i = 1; i <= 6; i++) {
    await invia('Input.dispatchMouseEvent', { type: 'mouseMoved', button: 'left', buttons: 1,
      x: Math.round(da.x + (a.x - da.x) * i / 6), y: Math.round(da.y + (a.y - da.y) * i / 6) });
    await pausa(25);
  }
  await invia('Input.dispatchMouseEvent', { type: 'mouseReleased', x: a.x, y: a.y, button: 'left', clickCount: 1 });
  await pausa(350);
}

/**
 * Cambia registro e ASPETTA che la barra sia d'accordo.
 *
 * ⚠️ Perché non basta una pausa. `mappaRegistro` passa da `mappaFlush()`, che è
 * una PROMESSA: se c'è una mappa sporca da salvare — magari lasciata da un'altra
 * prova — il seguito (che sincronizza la barra) arriva più tardi. Da sola questa
 * prova era verde con 700 ms; dentro la suite no, e il rosso diceva
 * «MAPPA.registro=mie» con la barra ancora su «generata»: due cose vere in due
 * istanti diversi, non un difetto. Qui si aspetta la CONDIZIONE, e se non arriva
 * si dice tutto quello che si sa invece di lasciare un rosso muto.
 */
async function registro(val, clicca, pausa, reg) {
  /* ⚠️ Lo stato PRIMA del click è metà della diagnosi: `mappaRegistro` esce
     subito se il registro è già quello chiesto (`if(reg===MAPPA.registro)
     return`), e in quel caso la barra resta com'era — se qualcuno l'aveva
     lasciata indietro, indietro rimane. Senza questa riga il rosso dice solo
     che la barra non segue, non da dove viene. */
  const prima = await val(`(()=>{ const b=document.querySelector('#mRegistro button[data-reg="${reg}"]');
    return { reg: MAPPA.registro, pressed: b && b.getAttribute('aria-pressed'), aperta: mappaAperta() }; })()`);
  await clicca(`#mRegistro button[data-reg="${reg}"]`);
  let st = null;
  for (let i = 0; i < 40; i++) {
    st = await val(`(()=>{ const b=document.querySelector('#mRegistro button[data-reg="${reg}"]');
      return { reg: MAPPA.registro, pressed: b && b.getAttribute('aria-pressed'),
               nuova: !!document.querySelector('#mNuova').hidden,
               copia: !!document.querySelector('#mCopia').hidden,
               sporca: !!(MAPPA.mia && MAPPA.mia.sporca), file: (MAPPA.mia && MAPPA.mia.file) || '',
               /* quante barre della mappa ci sono davvero a schermo: se fossero
                  due, premi() aggiornerebbe la prima e a vedersi sarebbe l'altra */
               barre: document.querySelectorAll('[id="mRegistro"]').length,
               viste: document.querySelectorAll('[id="mappaView"]').length,
               dentro: !!(b && b.closest('#mappaView')) }; })()`);
    if (st.reg === reg && st.pressed === 'true') return st;
    await pausa(200);
  }
  console.log('  ·   la barra non ha seguito il registro in 8 s.');
  console.log('  ·   prima del click: ' + JSON.stringify(prima));
  console.log('  ·   dopo:            ' + JSON.stringify(st));
  return st;
}


/**
 * La mappa a tutto banco, e perché serve.
 *
 * ⚠️ «Parti da qui» e «adatta» portano la classe `.mlungo`, e una container
 * query li toglie sotto i 560px di contenitore
 * (`@container mappa (max-width:560px)`). In un banco a due colonne la mappa sta
 * sotto quella soglia: il bottone c'è, non è `hidden`, ma misura 0×0 e `clicca`
 * lo rifiuta con «non cliccabile» — che è vero e insieme fuorviante. Il gesto
 * dell'utente per premerlo è mettere la mappa a tutto banco (doppio click sulla
 * testata); qui si passa da `bancoZoom`, che è la funzione che quel gesto chiama.
 */
async function mappaLarga(val) {
  return await val(`(()=>{ const b=['A','B','C','D','E','F','G','H','I']
      .find(x=>bancoStrumentoIn(x)==='mappa');
    if(!b) return ''; bancoZoom(b); return b; })()`);
}

(async () => {
  await collega();
  await partiPulito();
  /* ⚠️ Il vault lo dice l'APP, non la config di casa. L'istanza di prova ha una
     cartella dati sua (`--user-data-dir`), quindi la config dell'utente indica un
     altro vault: i controlli su disco guarderebbero nel posto sbagliato e —
     peggio — la pulizia finale cancellerebbe nella cartella VERA. È la trappola
     ⑧, e la rete è quella di `prova-mappe-ui`. */
  const vault = await val('window.vault && window.vault.vaultPath');
  if (!vault) { console.log('  KO  l\'app non dice dove sia il vault'); process.exit(1); }
  if (vault.indexOf('studia-prove-') < 0) {
    console.log('  KO  sto guardando il vault VERO (' + vault + '): mi fermo prima di creare qualcosa');
    process.exit(1);
  }
  const corso = await val('corsoAttivo()');
  const DIR = path.join(vault, 'Corsi', corso, 'MAPPE');
  /* ⚠️ SI SGANCIA CIÒ CHE UN'ALTRA PROVA HA LASCIATO IN CANNA. Nella suite,
     prima di qui, qualcuno apre una mappa e poi ne rimuove il FILE dal disco
     lasciando lo stato in memoria agganciato: al primo `mappaFlush()` — e ce
     n'è uno dentro ogni cambio di registro — quel file RINASCE, e il conteggio
     finale accusa questa prova di aver lasciato in giro «Mappa.json», che non
     ha mai creato. Nell'app non capita, perché il cestino chiude anche la mappa;
     qui capita perché una prova ha usato l'API saltando il gesto. */
  await val(`(()=>{ MAPPA.mia.file=''; MAPPA.mia.grafo=null; MAPPA.sel=null; return 1; })()`);
  const prima = fs.existsSync(DIR) ? fs.readdirSync(DIR) : [];

  if (!(await val('mappaAperta()'))) await apriStrumento('mappa');
  if ((await val('MAPPA.registro')) !== 'mie' ||
      (await val("document.querySelector('#mRegistro button[data-reg=\"mie\"]').getAttribute('aria-pressed')")) !== 'true') {
    await registro(val, clicca, pausa, 'mie');
  }
  await clicca('#mNuova'); await pausa(300);
  await val("document.querySelector('#umInput').value='Prova L3L4 da cancellare'");
  await clicca('#umOk'); await pausa(1300);
  const file = await val('MAPPA.mia.file');
  ok('mappa di prova creata', true, !!file);

  const radice = await val('MAPPA.mia.grafo.nodi[0].id');

  // ---- il menu contestuale su un nodo
  await destro(await punto(`#mappaSvg .mnodo[data-id="${radice}"] rect`));
  ok('il menu si apre col tasto destro', true, await val("document.querySelector('#mapMenu').classList.contains('open')"));
  ok('e apre selezionando il nodo su cui è stato aperto', radice, await val('MAPPA.sel'));
  const voci = await val("Array.from(document.querySelectorAll('#mapMenu .ctx-item')).map(b=>b.querySelector('span')?b.querySelector('span').textContent:'')");
  ok('elenca i gesti del §4.1', true,
    ['Rinomina', 'Aggiungi figlio', 'Aggiungi accanto', 'Collega a…', 'Elimina il nodo'].every((v) => voci.includes(v)));
  ok('e accanto a ognuno c’è la scorciatoia', true,
    await val("Array.from(document.querySelectorAll('#mapMenu .ctx-scorc')).map(s=>s.textContent).join('|').includes('Tab')"));
  ok('la riga dei colori c’è, con 5 preset + togli + picker', [5, 1, 1],
    await val(`[document.querySelectorAll('#mapMenu .ctx-col:not(.nessuno)').length,
               document.querySelectorAll('#mapMenu .ctx-col.nessuno').length,
               document.querySelectorAll('#mapMenu input[type=color]').length]`));

  // ---- la voce del menu chiama la stessa funzione del gesto
  await sinistro(await punto('#mapMenu .ctx-item[data-az="figlio"]'));
  await pausa(300);
  ok('«Aggiungi figlio» dal menu crea il figlio', 2, await val('MAPPA.mia.grafo.nodi.length'));
  await scrivi('Figlio'); await tasto('Enter', { code: 'Enter', vk: 13 }); await pausa(350);
  ok('col testo che ho battuto', 'Figlio', await val('MAPPA.mia.grafo.nodi[1].testo'));

  // ---- colore con cascata sul grafo intero
  await destro(await punto(`#mappaSvg .mnodo[data-id="${radice}"] rect`));
  await val("document.querySelector('#mCasc').checked=true");
  await sinistro(await punto('#mapMenu .ctx-col:not(.nessuno)'));
  await pausa(300);
  ok('il colore scende su tutto il ramo, non solo sul nodo', 2,
    await val('MAPPA.mia.grafo.nodi.filter(n=>n.colore).length'));

  // ---- un terzo nodo, sciolto: serve per collegare due nodi NON già legati
  const vuoto0 = await val(`(()=>{const r=document.querySelector('.mtela').getBoundingClientRect();
    return {x:Math.round(r.left+60), y:Math.round(r.bottom-70)};})()`);
  for (const cc of [1, 2]) {
    await invia('Input.dispatchMouseEvent', { type: 'mousePressed', x: vuoto0.x, y: vuoto0.y, button: 'left', clickCount: cc });
    await invia('Input.dispatchMouseEvent', { type: 'mouseReleased', x: vuoto0.x, y: vuoto0.y, button: 'left', clickCount: cc });
  }
  await pausa(400);
  await scrivi('Terzo'); await tasto('Enter', { code: 'Enter', vk: 13 }); await pausa(350);
  ok('tre nodi sulla tela', 3, await val('MAPPA.mia.grafo.nodi.length'));
  const idTerzo = await val("MAPPA.mia.grafo.nodi[2].id");

  // ---- il legame che c'è già viene rifiutato, e lo dice
  await destro(await punto(`#mappaSvg .mnodo[data-id="${radice}"] rect`));
  await sinistro(await punto('#mapMenu .ctx-item[data-az="collega"]'));
  await sinistro(await punto(`#mappaSvg .mnodo[data-id="${await val('MAPPA.mia.grafo.nodi[1].id')}"] rect`));
  await pausa(350);
  ok('collegare due nodi già legati non ne crea un secondo', 1, await val('MAPPA.mia.grafo.archi.length'));
  ok('e viene detto', true,
    await val("/legame c.è già/.test(document.querySelector('#toast')?document.querySelector('#toast').textContent:'')"));

  // ---- «Collega a…» a due click
  await destro(await punto(`#mappaSvg .mnodo[data-id="${radice}"] rect`));
  await sinistro(await punto('#mapMenu .ctx-item[data-az="collega"]'));
  await pausa(250);
  ok('la barra dice in che modalità sei', true,
    await val("!document.querySelector('#mModo').hidden && /Collega/.test(document.querySelector('#mModo').textContent)"));
  const idFiglio = await val("MAPPA.mia.grafo.nodi[1].id");
  await sinistro(await punto(`#mappaSvg .mnodo[data-id="${idTerzo}"] rect`));
  await pausa(400);
  ok('il secondo click crea il legame', 2, await val('MAPPA.mia.grafo.archi.length'));
  ok('e apre subito la casella del verbo', false, await val("document.querySelector('#mCampo').hidden"));
  ok('con il datalist dei verbi attaccato', 'mVerbi', await val("document.querySelector('#mCampo').getAttribute('list')"));
  const nVerbi = await val("document.querySelectorAll('#mVerbi option').length");
  console.log('  ·   verbi suggeriti:', nVerbi);
  ok('il vocabolario non è vuoto', true, nVerbi > 10);
  await scrivi('richiede'); await tasto('Enter', { code: 'Enter', vk: 13 }); await pausa(350);
  ok('il verbo si salva come battuto', 'richiede',
    await val("MAPPA.mia.grafo.archi.find(a=>a.rel).rel"));
  ok('la famiglia NON finisce nel grafo: si ricava', undefined,
    await val("MAPPA.mia.grafo.archi.find(a=>a.rel).famiglia"));
  ok('e l’arco prende il colore della sua famiglia nel disegno', true,
    await val(`(()=>{const c=MappaRelazioni.coloreDi('richiede');
      return document.querySelector('#mappaSvg').innerHTML.indexOf(c)>=0;})()`));

  // ---- menu sull'arco: inverti svuota il verbo e lo dice
  /* Il punto dell'arco lo chiedo all'app: il centro del RIQUADRO di un
     tracciato curvo non sta sulla curva, e il tasto destro cadrebbe sulla tela
     vuota. `meta` è il punto in cui il disegno mette l'etichetta, cioè sul filo. */
  /* ⚠️ PRIMA si fa spazio. Con tre nodi appena creati le card stanno addosso al
     loro legame: campionando tutto il filo, sotto il puntatore c'era «rect.»
     dal primo all'ultimo punto — l'arco esiste ma è interamente coperto, e
     nessun tasto destro potrebbe mai raggiungerlo. Si allontana il nodo di
     arrivo, che è ciò che farebbe chiunque volesse cliccare quel filo. */
  await val(`MAPPA.mia.grafo=MappaModifica.sposta(MAPPA.mia.grafo, '${idTerzo}', {x:520, y:360}); mappaRidisegna();`);
  await pausa(500);

  /* ⚠️ Il punto dell'etichetta NON basta: con tre nodi e il motore ad albero
     cade sopra una card, e il tasto destro apre il menu del NODO. L'ha detto la
     diagnostica qui sotto («rect. (dentro una card)»), non un'ipotesi. Si chiede
     al DISEGNO: si scorre il tracciato dell'arco vero — `.marco[data-da][data-a]`
     — e si prende il primo punto che non sia coperto da una card. Se non ce ne
     fosse nessuno, si dice: meglio un rosso che parla di un menu che si apre sul
     nodo sbagliato. */
  const arco = await val(`(()=>{
    const el=document.querySelector('#mappaSvg .marco[data-da="${radice}"][data-a="${idTerzo}"]');
    if(!el) return null;
    /* Il primo path del gruppo e il BERSAGLIO: stesso tracciato, invisibile e
       spesso 12px, con pointer-events="stroke". E quello che il mouse prende. */
    const path=el.querySelector('path'); if(!path||!path.getPointAtLength) return null;
    const L=path.getTotalLength(); const visti=[];
    for(let q=0.5, passo=0.02, i=0; i<46; i++){
      q = 0.5 + ((i%2) ? 1 : -1) * passo * Math.ceil(i/2);
      if(q<=0.02 || q>=0.98) continue;
      const pt=path.getPointAtLength(L*q);
      const m=path.getScreenCTM && path.getScreenCTM(); if(!m) break;
      const r=pt.matrixTransform(m);
      const x=Math.round(r.x), y=Math.round(r.y);
      const sotto=document.elementFromPoint(x,y);
      /* Non basta «non e una card»: fra i due capi ci sono le PORTE (i pallini),
         e li il tasto destro apre il menu della porta — misurato. Sotto il
         puntatore dev'esserci QUESTO arco, che e cio che il gestore cerca con
         closest('.marco'). (Niente apici inversi: siamo in un template literal.) */
      if(sotto && sotto.closest('.marco')===el) return {x:x, y:y};
      if(visti.length<6) visti.push(sotto ? (sotto.tagName+'.'+(sotto.getAttribute('class')||'')) : 'niente');
    }
    return { errore:'nessun punto libero sul filo', visti:visti };})()`);
  if (arco && arco.errore) console.log('  ·   ' + arco.errore + ': ' + JSON.stringify(arco.visti));
  ok('il legame etichettato si trova nel disegno', true, !!(arco && arco.x !== undefined));
  /* ⚠️ Un menu aperto resta SOPRA la tela, e il tasto destro successivo cade su
     di lui: la diagnostica qui sotto lo ha detto in chiaro — «sotto: DIV.ctxmenu
     mapmenu open, menu: tipo=nodo». È lo stesso difetto delle prove che non
     lasciano lo stato come l'hanno trovato, dentro una prova sola. Si chiude
     come lo chiude l'utente, con Esc. */
  await tasto('Escape', { code: 'Escape', vk: 27 }); await pausa(250);
  ok('nessun menu resta aperto sopra la tela', false,
    await val("!!document.querySelector('#mapMenu.open')"));
  /* ⚠️ CHI C'È SOTTO IL PUNTATORE, chiesto PRIMA di premere: dopo, sotto il
     puntatore c'è il menu appena aperto, e la risposta non dice più niente. È la
     domanda che ha risolto in un colpo il rosso del 30 agosto. La diagnostica
     resta, perché questo rosso non si distingue da un guasto vero. */
  const sotto = await val(`(()=>{ const e=document.elementFromPoint(${arco.x}, ${arco.y});
    return e ? (e.tagName+'.'+(e.getAttribute('class')||'')+(e.closest('.mnodo')?' (dentro una card)':'')) : 'niente'; })()`);
  console.log('  ·   sotto il punto scelto sul filo:', sotto);
  await destro(arco);
  ok('il menu dell’arco si apre', 'arco',
    await val("document.querySelector('#mapMenu').dataset.tipo||''"));
  await sinistro(await punto('#mapMenu .ctx-item[data-az="inverti"]'));
  await pausa(400);
  ok('invertendo, i capi si scambiano', true,
    await val(`!!MAPPA.mia.grafo.archi.find(a=>a.da==='${idTerzo}' && a.a==='${radice}')`));
  ok('e il verbo si svuota: invertito direbbe il falso', 0,
    await val("MAPPA.mia.grafo.archi.filter(a=>a.rel).length"));
  ok('e viene detto perché', true,
    await val("/verbo.*svuotato|direbbe il falso/.test(document.querySelector('#toast')?document.querySelector('#toast').textContent:'')"));
  await tasto('Escape', { code: 'Escape', vk: 27 }); await pausa(250);

  // ---- Esc chiude il menu, non la mappa
  await destro(await punto(`#mappaSvg .mnodo[data-id="${radice}"] rect`));
  await tasto('Escape', { code: 'Escape', vk: 27 }); await pausa(250);
  ok('Esc chiude il menu…', false, await val("document.querySelector('#mapMenu').classList.contains('open')"));
  ok('…e NON la mappa', true, await val('mappaAperta()'));

  // ---- la porta: trascinare per collegare
  const porte = await val("document.querySelectorAll('#mappaSvg .mporta').length");
  console.log('  ·   porte disegnate:', porte);
  if (porte > 0) {
    ok('una porta per nodo', await val('Object.keys(MAPPA.res.pos).length'), porte);
    ok('la porta è fratello della card, non figlia', false,
      await val("!!document.querySelector('#mappaSvg .mnodo .mporta')"));
    const distanza = await val(`(()=>{const p=document.querySelector('#mappaSvg .mporta [r]');
      const t=document.querySelector('#mappaSvg .mtoggle [r]'); if(!p||!t) return 999;
      const a=p.getBoundingClientRect(), b=t.getBoundingClientRect();
      return Math.round(Math.hypot(a.x-b.x, a.y-b.y));})()`);
    ok('e non finisce sopra il pallino del ramo', true, distanza >= 16);
    // trascinamento vero da porta a nodo
    await val('MAPPA.mia.grafo=MappaModifica.eliminaArco(MAPPA.mia.grafo, MAPPA.mia.grafo.archi[1].da, MAPPA.mia.grafo.archi[1].a); mappaRidisegna();');
    const nArchi = await val('MAPPA.mia.grafo.archi.length');
    const pPorta = await punto(`#mappaSvg .mporta[data-id="${radice}"]`);
    const pDest = await punto(`#mappaSvg .mnodo[data-id="${idTerzo}"] rect`);
    if (pPorta && pDest) {
      await trascina(pPorta, pDest);
      ok('trascinando dalla porta nasce il legame', nArchi + 1, await val('MAPPA.mia.grafo.archi.length'));
      await tasto('Escape', { code: 'Escape', vk: 27 }); await pausa(200);
    } else { console.log('  ·   porta non raggiungibile a schermo, trascinamento saltato'); }
  } else {
    console.log('  ·   nessuna porta nel markup: «Collega a…» resta l’unica via');
  }

  // ---- menu sul vuoto: nodo nuovo lì, e il motore
  const vuoto = await val(`(()=>{const r=document.querySelector('.mtela').getBoundingClientRect();
    return {x:Math.round(r.left+50), y:Math.round(r.bottom-60)};})()`);
  await destro(vuoto);
  ok('sul vuoto il menu offre il nodo e il motore', true,
    await val("!!document.querySelector('#mapMenu .ctx-item[data-az=\"nuovo\"]') && !!document.querySelector('#mapMenu .ctx-item[data-motore=\"dag\"]')"));
  const quantiPrima = await val('MAPPA.mia.grafo.nodi.length');
  await sinistro(await punto('#mapMenu .ctx-item[data-az="nuovo"]'));
  await pausa(350);
  ok('«Nuovo nodo qui» lo crea davvero', quantiPrima + 1, await val('MAPPA.mia.grafo.nodi.length'));
  await scrivi('Dal menu'); await tasto('Enter', { code: 'Enter', vk: 13 }); await pausa(300);
  ok('e nel punto in cui avevo aperto il menu', true,
    await val('MappaGrafo.fissato(MAPPA.mia.grafo.nodi[MAPPA.mia.grafo.nodi.length-1])'));

  /* ⚠️ Non si riapre il menu NELLO STESSO PUNTO: lì adesso c'è il nodo appena
     creato («Dal menu», messo proprio dove il menu era stato aperto), e il tasto
     destro aprirebbe il menu del nodo — che di motori non ne offre. Si prende un
     altro angolo di tela vuota. */
  const vuoto2 = await val(`(()=>{const s=document.querySelector('#mappaSvg');
    const r=s.getBoundingClientRect();
    return {x:Math.round(r.right-60), y:Math.round(r.top+60)};})()`);
  await destro(vuoto2);
  ok('e il menu della tela si riapre altrove', true,
    await val("!!document.querySelector('#mapMenu.open [data-motore=\"percorso\"]')"));
  await sinistro(await punto('#mapMenu .ctx-item[data-motore="percorso"]'));
  await pausa(400);
  ok('il motore si cambia anche dal menu', 'percorso', await val('MAPPA.vista.motore'));
  ok('e la barra lo dice', 'true',
    await val("document.querySelector('#mMotore button[data-motore=\"percorso\"]').getAttribute('aria-pressed')"));

  // ---- nella vista generata il menu è di sola lettura
  await clicca('#mRegistro button[data-reg="generata"]'); await pausa(800);
  const pg = await punto('#mappaSvg .mnodo rect');
  await destro(pg);
  ok('in «Generata» il menu non offre modifiche', false,
    await val("!!document.querySelector('#mapMenu .ctx-item[data-az=\"elimina\"]') || !!document.querySelector('#mapMenu .ctx-col')"));
  await tasto('Escape', { code: 'Escape', vk: 27 }); await pausa(250);

  // ---- pulizia
  await clicca('#mRegistro button[data-reg="mie"]'); await pausa(900);
  const tolta = await val(`(async()=>{ return await window.vault.mappe.rimuovi(corsoAttivo(), ${JSON.stringify(file)}); })()`);
  await pausa(400);
  const dopo = fs.existsSync(DIR) ? fs.readdirSync(DIR) : [];
  ok('la prova non lascia niente nel vault', prima.length, dopo.length);

  console.log(ko ? '\n✗ ' + ko + ' controlli falliti' : '\n✓ L3+L4 verdi dalla porta principale');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('ERRORE:', e); process.exit(2); });
