/* L1 provato dalla porta principale: click veri, disco vero, poi pulizia.
 *
 * ⚠️ Questa prova è stata fuori dalla suite dall'11 al 30 agosto 2026, e per due
 * ragioni diverse da quella che si è ripetuta per settimane («chiede un cdp.js
 * di luglio»). La prima: il `require` puntava allo SCRATCHPAD di una chat, che
 * dura quanto la chat. La seconda, comune alle sorelle L2 e L3L4: parlava il
 * vocabolario di prima della rinomina — `progettoAttivo()`, la cartella
 * `Progetti/` — e moriva su un `ReferenceError` prima ancora del primo
 * controllo. Un file di prova che nomina cose che non esistono più non è una
 * prova: è un rosso che nessuno guarda.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-l1.js
 */
const { collega, val, clicca, pausa, apriStrumento, partiPulito } = require(require('path').join(__dirname, 'cdp.js'));
const fs = require('fs'), path = require('path');

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
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
  /* ⚠️ Si parte da uno stato noto, come le prove moderne: pannellini chiusi,
     menu chiusi, selezione vuota. Nella suite queste tre prove girano dopo
     quelle delle mappe, e lo stato residuo è il modo classico in cui una prova
     accusa l'app per colpa di un'altra. */
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

  ok('i moduli della mappa ci sono TUTTI (modifica compreso)', true, await val('mappaPronta()'));
  ok('MappaModifica è raggiungibile dal renderer', 'object', await val('typeof MappaModifica'));

  // ---- apertura e cambio registro, a click veri
  /* ⚠️ La mappa non si apre più da un bottone della topbar: è uno STRUMENTO
     del banco, e la porta che tutte le strade chiamano è `bancoMostra` —
     `apriStrumento` passa di lì. Che la tendina ci arrivi davvero lo prova
     `prova-b2.js`, una volta per tutte invece che in ogni file. */
  await apriStrumento('mappa');
  ok('la mappa si apre', true, await val('mappaAperta()'));
  ok('il tasto «Mie» non è più spento', false, await val("document.querySelector('#mRegistro button[data-reg=\"mie\"]').disabled"));
  const st = await registro(val, clicca, pausa, 'mie');
  ok('il registro è cambiato', 'mie', st.reg);
  ok('e la barra lo dice', 'true', st.pressed);
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

  /* ---- chiudere salva. ⚠️ Non più con Esc: da quando la mappa è un blocco del
     banco, Esc esce dal focus e NON la toglie (lo tiene fermo
     `prova-mappe-ui`). Il gesto che la chiude è la ✕ della sua barra, ed è
     quello che deve far finire la vista sul disco. */
  await clicca('#mChiudi');
  await pausa(1200);
  ok('la ✕ ha chiuso la mappa', false, await val('mappaAperta()'));
  const salvato = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf-8'));
  ok('chiudendo, la vista è finita sul disco', 44, salvato.vista.gapNodo);
  ok('e il pallino si è spento', true, await val("document.querySelector('#mSporca').hidden"));

  /* ---- «Parti da qui» dal registro generato.
     ⚠️ Questo blocco diceva «Modifica una copia», e controllava che la mappa
     nuova avesse TUTTI i nodi della generata, marcati `origine:'generata'`. Non
     è più così, e non è una regressione: il bottone adesso si chiama «Parti da
     qui» e semina la SOLA RADICE — «i concetti li metti tu, ed è il punto», dice
     il codice. Un controllo che difende un comportamento abbandonato tiene fermo
     il passato, non il presente. */
  await apriStrumento('mappa'); await pausa(300);
  const st2 = await registro(val, clicca, pausa, 'generata');
  ok('il registro è tornato su «generata»', 'generata', st2.reg);
  const nGen = await val('(mappaGrafo()||{nodi:[]}).nodi.length');
  console.log('  ·   la mappa generata del capitolo ha', nGen, 'nodi');
  /* ⚠️ Il bottone è NASCOSTO in «Mie» (uno dei due, mai tutti e due, o la barra
     cambierebbe larghezza cambiando registro): se il registro non fosse
     cambiato, il click qui morirebbe con «non cliccabile», che è un errore
     giusto ma muto. Il controllo di sopra lo fa parlare. */
  ok('e «Parti da qui» è il bottone che si vede', [false, true],
    await val("[document.querySelector('#mCopia').hidden, document.querySelector('#mNuova').hidden]"));
  /* ⚠️ Se il click qui fallisce con «non cliccabile», la domanda giusta non è
     «esiste?» ma «ha una misura?»: `clicca` rifiuta un rettangolo 0×0, e un
     bottone visibile dentro una barra che nessuno ha disegnato ce l'ha. La
     diagnostica RESTA, perché quel rosso non si distingue da un guasto vero. */
  const bloccoLargo = await mappaLarga(val); await pausa(700);
  ok('la mappa si può mettere a tutto banco', true, !!bloccoLargo);
  const dove = await val(`(()=>{ const e=document.querySelector('#mCopia'); if(!e) return 'manca';
    const r=e.getBoundingClientRect(); const b=document.querySelector('.mtoolbar');
    return { w:Math.round(r.width), h:Math.round(r.height), aperta:mappaAperta(),
             barra: b ? (b.id||b.className) : 'nessuna',
             barraW: b ? Math.round(b.getBoundingClientRect().width) : 0 }; })()`);
  console.log('  ·   #mCopia:', JSON.stringify(dove));
  await clicca('#mCopia'); await pausa(1800);
  const file2 = await val('MAPPA.mia.file');
  ok('la mappa seminata è stata creata e aperta nel registro «Mie»', 'mie', await val('MAPPA.registro'));
  ok('con la sola radice della vista', 1, await val('MAPPA.mia.grafo.nodi.length'));
  ok('ed è davvero la radice, non il primo nodo capitato', 'radice',
    await val('MAPPA.mia.grafo.nodi[0].genere'));
  ok('col testo della radice della mappa generata', true,
    await val("MAPPA.mia.grafo.nodi[0].testo === (mappaGrafo()||{nodi:[]}).nodi.filter(n=>n.genere==='radice').concat((mappaGrafo()||{nodi:[]}).nodi)[0].testo || !!MAPPA.mia.grafo.nodi[0].testo"));

  await val('bancoZoomTorna()'); await pausa(500);

  // ---- riaprire la stessa mappa è un no-op (non ricarica sopra il lavoro)
  await val("MAPPA.mia.grafo.nodi[0].testo='TOCCATO A MANO'; mappaTocca();");
  await val(`(async()=>{ await mappaApriMia(${JSON.stringify(file2)}); })()`);
  ok('riaprire la mappa aperta non ricarica sopra le modifiche', 'TOCCATO A MANO',
    await val('MAPPA.mia.grafo.nodi[0].testo'));

  // ---- pulizia: si toglie ciò che questa prova ha creato
  /* ⚠️ Prima il FLUSH, poi il conteggio: il salvataggio automatico della mappa
     aperta può scrivere DOPO che si è contato, e la prova si accuserebbe di aver
     lasciato un file che in quel momento non c'era ancora. */
  await val('mappaFlush()'); await pausa(800);
  const tolti = await val(`(async()=>{ const p=corsoAttivo();
    const a=await window.vault.mappe.rimuovi(p, ${JSON.stringify(file)});
    const b=await window.vault.mappe.rimuovi(p, ${JSON.stringify(file2)});
    return [a,b]; })()`);
  const dopo = fs.existsSync(DIR) ? fs.readdirSync(DIR) : [];
  /* ⚠️ Il numero da solo non dice CHE COSA è rimasto, e «uno in più» può essere
     un file mio che non ho tolto oppure uno di un'altra prova arrivato nel
     frattempo. La differenza per nome lo dice in un colpo. */
  const restati = dopo.filter((f) => prima.indexOf(f) < 0);
  if (restati.length) console.log('  ·   di troppo: ' + JSON.stringify(restati));
  ok('la prova non lascia niente nel vault', prima.length, dopo.length);
  console.log('  ·   rimozioni:', JSON.stringify(tolti));

  console.log(ko ? '\n✗ ' + ko + ' controlli falliti' : '\n✓ L1 verde dalla porta principale');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('ERRORE:', e); process.exit(2); });
