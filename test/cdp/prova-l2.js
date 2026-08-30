/* L2 dalla porta principale: doppio click, trascinamento vero, tasti veri. */
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
  console.log('corso:', corso, '· mappe già presenti:', prima.length);

  // ---- una mappa di prova, dalla porta vera
  // il tasto della mappa è un interruttore: se l'app è rimasta aperta da una
  // prova precedente, premerlo la chiuderebbe invece di aprirla
  if (!(await val('mappaAperta()'))) await apriStrumento('mappa');
  if ((await val('MAPPA.registro')) !== 'mie' ||
      (await val("document.querySelector('#mRegistro button[data-reg=\"mie\"]').getAttribute('aria-pressed')")) !== 'true') {
    await registro(val, clicca, pausa, 'mie');
  }
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
  ok('e NON ha chiuso la mappa', true, await val('mappaAperta()'));

  // ---- trascinare una card
  const idF = await val("MAPPA.mia.grafo.nodi.find(n=>n.testo==='Figlio uno').id");
  const zPrima = await val('JSON.stringify([MAPPA.z.x, MAPPA.z.y, MAPPA.z.k])');
  const p0 = await posCard(idF);
  await trascina(p0, { x: p0.x + 150, y: p0.y + 60 }); await pausa(400);
  ok('trascinare la card fissa la posizione', true,
    await val(`MappaGrafo.fissato(MAPPA.mia.grafo.nodi.find(n=>n.id==='${idF}'))`));
  ok('e il motore la onora nel disegno', true,
    await val(`(()=>{const n=MAPPA.mia.grafo.nodi.find(n=>n.id==='${idF}');
      const p=MAPPA.res.pos['${idF}']; return Math.abs(p.x-n.x)<0.6 && Math.abs(p.y-n.y)<0.6;})()`));
  /* ⚠️ Non si guarda che `MAPPA.z` sia a ZERO: la vista è a due strati, e il
     viewBox parte dal contenuto — «fermo» non vuol dire «all'origine». Si
     confronta con dov'era prima del trascinamento, che è la domanda vera:
     trascinando una card si è mosso il NODO, non la mappa sotto. */
  ok('la mappa non si è spostata sotto: era il nodo, non il pan', zPrima,
    await val('JSON.stringify([MAPPA.z.x, MAPPA.z.y, MAPPA.z.k])'));

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
  /* ⚠️ Il segmento dei motori NON è più in barra su una mappa tua: lì stanno le
     memorie, e i quattro motori sono passati nel menu contestuale della tela
     («su una mappa tua il motore è un mezzo e la disposizione è il fine»,
     `mappaMemorieDisegna`). Il gesto è il tasto destro sul vuoto. */
  ok('in «Mie» la barra mostra le memorie, non i motori', [false, true],
    await val("[document.querySelector('#mMemorie').hidden, document.querySelector('#mMotore').hidden]"));
  const tela = await val(`(()=>{ const s=document.querySelector('#mappaSvg'); if(!s) return null;
    const r=s.getBoundingClientRect(); return {x:Math.round(r.left+12), y:Math.round(r.bottom-12)}; })()`);
  await invia('Input.dispatchMouseEvent', { type: 'mousePressed', x: tela.x, y: tela.y, button: 'right', clickCount: 1 });
  await invia('Input.dispatchMouseEvent', { type: 'mouseReleased', x: tela.x, y: tela.y, button: 'right', clickCount: 1 });
  await pausa(350);
  ok('il menu della tela si apre, e offre i motori', true,
    await val("!!document.querySelector('#mapMenu.open [data-motore=\"dag\"]')"));
  await clicca('#mapMenu [data-motore="dag"]'); await pausa(400);
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
