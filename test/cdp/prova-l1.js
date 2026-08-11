/* L1 provato dalla porta principale: click veri, disco vero, poi pulizia. */
const { collega, val, clicca, pausa } = require('/private/tmp/claude-501/-Users-giacomomeschini-Claude-StudIA/d1809773-71e9-4ab4-bae4-e1328029b22c/scratchpad/cdp.js');
const fs = require('fs'), path = require('path');

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}

(async () => {
  await collega();
  const cfg = JSON.parse(fs.readFileSync(process.env.HOME + '/Library/Application Support/studia/config.json', 'utf-8'));
  const vault = cfg.vaultPath;
  const prog = await val('progettoAttivo()');
  const DIR = path.join(vault, 'Progetti', prog, 'MAPPE');
  const prima = fs.existsSync(DIR) ? fs.readdirSync(DIR) : [];
  console.log('progetto:', prog, '· mappe già presenti:', prima.length);

  ok('i moduli della mappa ci sono TUTTI (modifica compreso)', true, await val('mappaPronta()'));
  ok('MappaModifica è raggiungibile dal renderer', 'object', await val('typeof MappaModifica'));

  // ---- apertura e cambio registro, a click veri
  await clicca('#mappaBtn'); await pausa(400);
  ok('la mappa si apre', true, await val("document.documentElement.dataset.mappa==='1'"));
  ok('il tasto «Mie» non è più spento', false, await val("document.querySelector('#mRegistro button[data-reg=\"mie\"]').disabled"));
  await clicca('#mRegistro button[data-reg="mie"]'); await pausa(700);
  ok('il registro è cambiato', 'mie', await val('MAPPA.registro'));
  ok('e la barra lo dice', 'true', await val("document.querySelector('#mRegistro button[data-reg=\"mie\"]').getAttribute('aria-pressed')"));
  ok('«Modifica una copia» sparisce, «+» compare', [true, false],
    await val("[document.querySelector('#mCopia').hidden, document.querySelector('#mNuova').hidden]"));
  ok('glossario e fonti sono spenti: su un documento non comandano niente', [true, true],
    await val("[document.querySelector('#mGlossario').disabled, document.querySelector('#mFonti').disabled]"));

  // ---- mappa nuova, dalla modale vera
  await clicca('#mNuova'); await pausa(300);
  ok('la modale del titolo si apre', true, await val("document.querySelector('#uiModal').classList.contains('open') || getComputedStyle(document.querySelector('#uiModal')).display!=='none'"));
  await val("document.querySelector('#umInput').value='Prova L1 da cancellare'");
  await clicca('#umOk'); await pausa(1200);
  const file = await val('MAPPA.mia.file');
  ok('la mappa è stata creata e aperta', true, !!file);
  ok('ed esiste su disco', true, fs.existsSync(path.join(DIR, file)));
  ok('nasce con un nodo: il titolo', ['Prova L1 da cancellare'], await val('MAPPA.mia.grafo.nodi.map(n=>n.testo)'));
  ok('disegnata davvero (una card nell\'SVG)', 1, await val("document.querySelectorAll('#mappaSvg .mnodo').length"));
  ok('la tendina mostra la mappa aperta', file, await val("document.querySelector('#mAmbito').value"));
  ok('nessuna modifica in sospeso appena creata', true, await val("document.querySelector('#mSporca').hidden"));

  // ---- una leva della vista sporca, ma non salva subito
  await val("MAPPA.vista.gapNodo=44; mappaVistaCambiata();");
  ok('girare una leva accende il pallino', false, await val("document.querySelector('#mSporca').hidden"));
  ok('ma non fa partire il salvataggio a raffica', true, await val('MAPPA.mia.timer===null'));

  // ---- chiudere salva (Esc, come farebbe l'utente)
  await val("(()=>{const e=new KeyboardEvent('keydown',{key:'Escape',bubbles:true});window.dispatchEvent(e);})()");
  await pausa(1200);
  ok('Esc ha chiuso la mappa', false, await val("document.documentElement.dataset.mappa==='1'"));
  const salvato = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf-8'));
  ok('chiudendo, la vista è finita sul disco', 44, salvato.vista.gapNodo);
  ok('e il pallino si è spento', true, await val("document.querySelector('#mSporca').hidden"));

  // ---- «Modifica una copia» dal registro generato
  await clicca('#mappaBtn'); await pausa(500);
  await clicca('#mRegistro button[data-reg="generata"]'); await pausa(500);
  const nGen = await val('(mappaGrafo()||{nodi:[]}).nodi.length');
  console.log('  ·   la mappa generata del capitolo ha', nGen, 'nodi');
  await clicca('#mCopia'); await pausa(1500);
  const file2 = await val('MAPPA.mia.file');
  ok('la copia è stata creata e aperta nel registro «Mie»', 'mie', await val('MAPPA.registro'));
  ok('con gli stessi nodi della generata', nGen, await val('MAPPA.mia.grafo.nodi.length'));
  ok('e tutti marcati «generata»', true, await val("MAPPA.mia.grafo.nodi.every(n=>n.origine==='generata')"));

  // ---- riaprire la stessa mappa è un no-op (non ricarica sopra il lavoro)
  await val("MAPPA.mia.grafo.nodi[0].testo='TOCCATO A MANO'; mappaTocca();");
  await val(`(async()=>{ await mappaApriMia(${JSON.stringify(file2)}); })()`);
  ok('riaprire la mappa aperta non ricarica sopra le modifiche', 'TOCCATO A MANO',
    await val('MAPPA.mia.grafo.nodi[0].testo'));

  // ---- pulizia: si toglie ciò che questa prova ha creato
  await pausa(1500);
  const tolti = await val(`(async()=>{ const p=progettoAttivo();
    const a=await window.vault.mappe.rimuovi(p, ${JSON.stringify(file)});
    const b=await window.vault.mappe.rimuovi(p, ${JSON.stringify(file2)});
    return [a,b]; })()`);
  const dopo = fs.existsSync(DIR) ? fs.readdirSync(DIR) : [];
  ok('la prova non lascia niente nel vault', prima.length, dopo.length);
  console.log('  ·   rimozioni:', JSON.stringify(tolti));

  console.log(ko ? '\n✗ ' + ko + ' controlli falliti' : '\n✓ L1 verde dalla porta principale');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('ERRORE:', e); process.exit(2); });
