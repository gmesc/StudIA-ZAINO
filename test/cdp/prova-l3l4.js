/* L3 (archi e linking word) + L4 (menu contestuale) dalla porta principale. */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, invia, val, clicca, pausa } = require(S);
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

(async () => {
  await collega();
  const cfg = JSON.parse(fs.readFileSync(process.env.HOME + '/Library/Application Support/studia/config.json', 'utf-8'));
  const prog = await val('progettoAttivo()');
  const DIR = path.join(cfg.vaultPath, 'Progetti', prog, 'MAPPE');
  const prima = fs.existsSync(DIR) ? fs.readdirSync(DIR) : [];

  if (!(await val('mappaAperta()'))) { await clicca('#mappaBtn'); await pausa(500); }
  if ((await val('MAPPA.registro')) !== 'mie') { await clicca('#mRegistro button[data-reg="mie"]'); await pausa(900); }
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
  const arco = await val(`(()=>{const d=(MAPPA.res.archi||[]).concat(MAPPA.res.extra||[])
      .filter(x=>x.e && x.e.da==='${radice}' && x.e.a==='${idTerzo}')[0];
    if(!d||!d.meta) return null; const p=mappaClientDaGrafo(d.meta.x, d.meta.y);
    return p?{x:Math.round(p.x), y:Math.round(p.y)}:null;})()`);
  ok('il legame etichettato si trova nel disegno', true, !!arco);
  await destro(arco);
  ok('il menu dell’arco si apre', true,
    await val("document.querySelector('#mapMenu').dataset.tipo==='arco'"));
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
  ok('…e NON la mappa', true, await val("document.documentElement.dataset.mappa==='1'"));

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

  await destro(vuoto);
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
  const tolta = await val(`(async()=>{ return await window.vault.mappe.rimuovi(progettoAttivo(), ${JSON.stringify(file)}); })()`);
  await pausa(400);
  const dopo = fs.existsSync(DIR) ? fs.readdirSync(DIR) : [];
  ok('la prova non lascia niente nel vault', prima.length, dopo.length);

  console.log(ko ? '\n✗ ' + ko + ' controlli falliti' : '\n✓ L3+L4 verdi dalla porta principale');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('ERRORE:', e); process.exit(2); });
