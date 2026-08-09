/* L2 dalla porta principale: doppio click, trascinamento vero, tasti veri. */
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
  await invia('Input.dispatchKeyEvent', Object.assign({ type: 'keyDown' }, base, opt.text ? { text: opt.text } : {}));
  await invia('Input.dispatchKeyEvent', Object.assign({ type: 'keyUp' }, base));
}
async function scriviTesto(s) {
  for (const ch of s) await invia('Input.dispatchKeyEvent', { type: 'char', text: ch });
}
async function posCard(id) {
  return val(`(()=>{const e=document.querySelector('#mappaSvg .mnodo[data-id="${id}"] rect');
    if(!e) return null; const r=e.getBoundingClientRect();
    return {x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2)};})()`);
}
async function trascina(da, a) {
  await invia('Input.dispatchMouseEvent', { type: 'mousePressed', x: da.x, y: da.y, button: 'left', clickCount: 1 });
  for (let i = 1; i <= 6; i++) {
    await invia('Input.dispatchMouseEvent', { type: 'mouseMoved', button: 'left', buttons: 1,
      x: Math.round(da.x + (a.x - da.x) * i / 6), y: Math.round(da.y + (a.y - da.y) * i / 6) });
    await pausa(30);
  }
  await invia('Input.dispatchMouseEvent', { type: 'mouseReleased', x: a.x, y: a.y, button: 'left', clickCount: 1 });
}

(async () => {
  await collega();
  const cfg = JSON.parse(fs.readFileSync(process.env.HOME + '/Library/Application Support/studia/config.json', 'utf-8'));
  const prog = await val('progettoAttivo()');
  const DIR = path.join(cfg.vaultPath, 'Progetti', prog, 'MAPPE');
  const prima = fs.existsSync(DIR) ? fs.readdirSync(DIR) : [];
  console.log('progetto:', prog, '· mappe già presenti:', prima.length);

  // ---- una mappa di prova, dalla porta vera
  // il tasto della mappa è un interruttore: se l'app è rimasta aperta da una
  // prova precedente, premerlo la chiuderebbe invece di aprirla
  if (!(await val('mappaAperta()'))) { await clicca('#mappaBtn'); await pausa(500); }
  if ((await val('MAPPA.registro')) !== 'mie') { await clicca('#mRegistro button[data-reg="mie"]'); await pausa(900); }
  await clicca('#mNuova'); await pausa(300);
  await val("document.querySelector('#umInput').value='Prova L2 da cancellare'");
  await clicca('#umOk'); await pausa(1300);
  const file = await val('MAPPA.mia.file');
  ok('mappa di prova creata', true, !!file);
  ok('il cestino è comparso, e dice quale mappa', true,
    await val("!document.querySelector('#mCestino').hidden && /Prova L2/.test(document.querySelector('#mCestino').title)"));

  // ---- selezione col click (in «Mie» non apre, sceglie)
  const radice = await val('MAPPA.mia.grafo.nodi[0].id');
  let p = await posCard(radice);
  await invia('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
  await invia('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 });
  await pausa(300);
  ok('il click sulla card seleziona', radice, await val('MAPPA.sel'));
  ok('e il bordo acceso lo dice', true,
    await val(`/stroke-width="2.5"/.test(document.querySelector('#mappaSvg .mnodo[data-id="${radice}"]').innerHTML)`));

  // ---- Tab = figlio, con la casella di rinomina che si apre da sé
  await tasto('Tab', { code: 'Tab', vk: 9 }); await pausa(350);
  ok('Tab crea un figlio', 2, await val('MAPPA.mia.grafo.nodi.length'));
  ok('e apre subito la casella per scriverlo', false, await val("document.querySelector('#mCampo').hidden"));
  await scriviTesto('Figlio uno'); await pausa(120);
  await tasto('Enter', { code: 'Enter', vk: 13 }); await pausa(350);
  ok('Invio conferma il testo', 'Figlio uno', await val('MAPPA.mia.grafo.nodi[1].testo'));
  ok('la casella si è chiusa', true, await val("document.querySelector('#mCampo').hidden"));
  ok('ed è figlio della radice, non un nodo sciolto', 1, await val('MAPPA.mia.grafo.archi.length'));

  // ---- Invio = fratello
  await tasto('Enter', { code: 'Enter', vk: 13 }); await pausa(350);
  await scriviTesto('Fratello'); await tasto('Enter', { code: 'Enter', vk: 13 }); await pausa(350);
  ok('Invio crea un fratello', ['Prova L2 da cancellare', 'Figlio uno', 'Fratello'],
    await val('MAPPA.mia.grafo.nodi.map(n=>n.testo)'));
  ok('col genitore giusto: due figli della radice', 2, await val('MAPPA.mia.grafo.archi.length'));

  // ---- doppio click sul vuoto = nodo nuovo lì
  const vuoto = await val(`(()=>{const r=document.querySelector('.mtela').getBoundingClientRect();
    return {x:Math.round(r.left+40), y:Math.round(r.bottom-50)};})()`);
  for (const clickCount of [1, 2]) {
    await invia('Input.dispatchMouseEvent', { type: 'mousePressed', x: vuoto.x, y: vuoto.y, button: 'left', clickCount });
    await invia('Input.dispatchMouseEvent', { type: 'mouseReleased', x: vuoto.x, y: vuoto.y, button: 'left', clickCount });
  }
  await pausa(400);
  ok('il doppio click sul vuoto crea un nodo', 4, await val('MAPPA.mia.grafo.nodi.length'));
  ok('nel punto in cui si è premuto (posizione fissata)', true,
    await val('MappaGrafo.fissato(MAPPA.mia.grafo.nodi[3])'));
  await scriviTesto('Sciolto'); await tasto('Enter', { code: 'Enter', vk: 13 }); await pausa(350);
  ok('e nasce senza genitore, come chiesto', 2, await val('MAPPA.mia.grafo.archi.length'));

  // ---- Esc annulla la scrittura, e un nodo mai battuto se ne va
  await tasto('Tab', { code: 'Tab', vk: 9 }); await pausa(300);
  ok('un altro figlio in canna', 5, await val('MAPPA.mia.grafo.nodi.length'));
  await tasto('Escape', { code: 'Escape', vk: 27 }); await pausa(350);
  ok('Esc chiude la casella e toglie il nodo mai scritto', 4, await val('MAPPA.mia.grafo.nodi.length'));
  ok('e NON ha chiuso la mappa', true, await val("document.documentElement.dataset.mappa==='1'"));

  // ---- trascinare una card
  const idF = await val("MAPPA.mia.grafo.nodi.find(n=>n.testo==='Figlio uno').id");
  const p0 = await posCard(idF);
  await trascina(p0, { x: p0.x + 150, y: p0.y + 60 }); await pausa(400);
  ok('trascinare la card fissa la posizione', true,
    await val(`MappaGrafo.fissato(MAPPA.mia.grafo.nodi.find(n=>n.id==='${idF}'))`));
  ok('e il motore la onora nel disegno', true,
    await val(`(()=>{const n=MAPPA.mia.grafo.nodi.find(n=>n.id==='${idF}');
      const p=MAPPA.res.pos['${idF}']; return Math.abs(p.x-n.x)<0.6 && Math.abs(p.y-n.y)<0.6;})()`));
  ok('la mappa non si è spostata sotto: era il nodo, non il pan', true,
    await val('MAPPA.z.x===0 && MAPPA.z.y===0'));

  // ---- ⌘Z etichettato
  await tasto('z', { code: 'KeyZ', vk: 90, mod: 4 }); await pausa(350);
  ok('⌘Z rimette il nodo dove stava', false,
    await val(`MappaGrafo.fissato(MAPPA.mia.grafo.nodi.find(n=>n.id==='${idF}'))`));
  ok('e il toast dice CHE COSA ha annullato', true,
    await val("/Annullato: Sposta: Figlio uno/.test(document.querySelector('#toast')?document.querySelector('#toast').textContent:'')"));

  // ---- Canc: i figli restano flottanti, e lo dice
  await clicca(`#mappaSvg .mnodo[data-id="${idF}"]`); await pausa(250);
  await tasto('Delete', { code: 'Delete', vk: 46 }); await pausa(350);
  ok('Canc elimina il nodo scelto', 3, await val('MAPPA.mia.grafo.nodi.length'));

  // ---- il cambio motore azzera le posizioni a mano, dicendolo
  await val("MAPPA.mia.grafo=MappaModifica.sposta(MAPPA.mia.grafo, MAPPA.mia.grafo.nodi[0].id, {x:10,y:10}); mappaRidisegna();");
  const fissatePrima = await val('MAPPA.mia.grafo.nodi.filter(MappaGrafo.fissato).length');
  await clicca('#mMotore button[data-motore="dag"]'); await pausa(400);
  ok('cambiando motore le posizioni a mano se ne vanno', 0,
    await val('MAPPA.mia.grafo.nodi.filter(MappaGrafo.fissato).length'));
  ok('e viene detto, con il numero e come rimediare', true,
    await val("/posizion.*azzerat.*⌘Z/.test(document.querySelector('#toast')?document.querySelector('#toast').textContent:'')"));
  await tasto('z', { code: 'KeyZ', vk: 90, mod: 4 }); await pausa(350);
  ok('⌘Z le rimette tutte, quante erano', fissatePrima, await val('MAPPA.mia.grafo.nodi.filter(MappaGrafo.fissato).length'));

  // ---- il salvataggio automatico ha scritto tutto sul disco
  await pausa(1800);
  const salvato = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf-8'));
  ok('sul disco ci sono i nodi veri', 3, salvato.nodi.length);
  ok('e le posizioni fissate', true, salvato.nodi.some((n) => typeof n.x === 'number'));

  // ---- il cestino, con la conferma
  await val("window.__conferme=[]; window.confirm=function(m){ window.__conferme.push(m); return true; };");
  await clicca('#mCestino'); await pausa(1200);
  ok('il cestino chiede conferma nominando la mappa', true,
    await val("/Prova L2 da cancellare/.test((window.__conferme||[])[0]||'')"));
  ok('il file è sparito dal disco', false, fs.existsSync(path.join(DIR, file)));
  ok('la vista non resta agganciata alla mappa cancellata', false, (await val('MAPPA.mia.file'))===file);
  /* Se nel progetto restano altre mappe si apre la più recente (e il cestino
     resta acceso su QUELLA); se non ne resta nessuna, il cestino si nasconde:
     un comando acceso su niente prometterebbe un effetto che non c'è. */
  const restano = (fs.existsSync(DIR) ? fs.readdirSync(DIR) : []).length;
  ok('col vuoto il cestino si nasconde, altrimenti passa alla mappa rimasta',
    restano === 0, await val("document.querySelector('#mCestino').hidden"));
  ok('e non ha aperto la mappa cancellata', false,
    (await val("document.querySelector('#mAmbito').value")) === file);

  const dopo = fs.existsSync(DIR) ? fs.readdirSync(DIR) : [];
  ok('la prova non lascia niente nel vault', prima.length, dopo.length);
  console.log(ko ? '\n✗ ' + ko + ' controlli falliti' : '\n✓ L2 verde dalla porta principale');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('ERRORE:', e); process.exit(2); });
