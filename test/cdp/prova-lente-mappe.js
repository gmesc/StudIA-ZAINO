/* La lente vede anche le MAPPE e le DIDASCALIE (Q5).
 *
 * ⚠️ Perché esiste. I nodi di una mappa e le didascalie dei ritagli sono
 * l'altro testo che l'utente ha SCRITTO, e la lente non li vedeva. Il principio
 * era già dichiarato dentro `ricerca/indice.js` — «quello che hai scritto tu
 * viene prima di quello che hai letto», ed è la ragione per cui gli appunti
 * stanno in cima ai risultati — e loro stavano dalla stessa parte di quella
 * linea restandone fuori.
 *
 * Che cosa entra nell'indice e in che ORDINE escono i gruppi lo decide
 * `ricerca/indice.js`, provato in Node (`test/ricerca.js`). Qui si misura ciò
 * che in Node non si vede: che l'indice si costruisca davvero con le mappe e i
 * ritagli di questo contenitore, e che il click ATTERRI — la mappa aperta col
 * nodo a fuoco, la card del ritaglio in vista.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-lente-mappe.js
 */
const path = require('path');
const S = path.join(__dirname, 'cdp.js');
const { collega, val, pausa, partiPulito, apriStrumento } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }
async function finoA(expr, q) { const f = Date.now() + (q || 20000);
  for (;;) { const v = await val(expr); if (v) return v; if (Date.now() > f) return null; await pausa(250); } }

/* Una parola che non compare in nessun materiale del vault di prova: così un
   risultato è per forza roba scritta qui, e non un falso positivo. */
const PAROLA = 'perielio';

(async () => {
  await collega();
  await val('location.reload(), 1'); await pausa(2500);
  await collega(); await pausa(800);
  await partiPulito();
  await finoA(`(typeof corsoAttivo==='function' && corsoAttivo()) ? 1 : 0`, 15000);

  sezione('Una mappa con un nodo, e un ritaglio con la sua didascalia');
  {
    /* La mappa: si crea e si apre, così i suoi nodi entrano nell'indice. */
    await apriStrumento('mappa');
    const fatta = await val(`(async()=>{
      MAPPA.registro='mie';
      const g=MappaModifica.creaNodo({ nodi:[], archi:[] },
        { testo:'${PAROLA}', nota:'il punto più vicino al Sole', origine:'utente' });
      const r=await window.vault.mappe.salva(corsoAttivo(), null,
        { titolo:'Orbite di prova', corso:corsoAttivo(), nodi:g.nodi, archi:g.archi });
      await mappaCaricaElenco();
      if(r && r.file) await mappaApriMia(r.file);
      return r && r.file ? r.file : ''; })()`);
    ok('la mappa c\'è', true, !!fatta);
    ok('ed è aperta, coi suoi nodi', true,
      await val(`!!(MAPPA.mia.grafo && MAPPA.mia.grafo.nodi.length)`));

    /* Il ritaglio: una voce d'album con la didascalia che contiene la parola. */
    const rit = await val(`(()=>{ const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      const r=window.vault.album.salva(corsoAttivo(), { materiale:'x.pdf', pagina:1,
        rect:{ x:0, y:0, w:1, h:1 }, didascalia:'schema del ${PAROLA}',
        dati:'data:image/png;base64,'+png });
      return (r && r.voce) ? r.voce.id : (r && r.error) || ''; })()`);
    ok('il ritaglio c\'è', true, /^[0-9a-f]{6,}$/.test(String(rit)));
  }

  sezione('⚠️ La lente li TROVA, e nell\'ordine giusto');
  {
    const res = await val(`(()=>{ searchBuild();
      return searchRun('${PAROLA}').map(function(r){
        return { gruppo:r.d.lessonTitle, mappa:r.d.mappa||'', nodo:r.d.nodo||'', album:r.d.album||'' }; }); })()`);
    console.log('   risultati: ' + JSON.stringify(res));
    ok('c\'è il nodo della mappa', true, res.some((r) => !!r.mappa));
    ok('e la didascalia del ritaglio', true, res.some((r) => !!r.album));
    /* ⚠️ L'ORDINE È UNA PROMESSA: prima ciò che l'utente ha scritto — appunti,
       mappe, didascalie — e dopo ciò che ha letto. */
    const soloScritti = res.filter((r) => r.mappa || r.album).map((r) => (r.mappa ? 'mappa' : 'ritaglio'));
    ok('la mappa viene prima del ritaglio', ['mappa', 'ritaglio'], soloScritti);
    ok('il nodo porta con sé dove tornare', true, res.some((r) => !!r.nodo));
  }

  sezione('⚠️ Il click ATTERRA: la mappa si apre e il nodo va a fuoco');
  {
    /* Si va altrove, così «è aperta» non può essere vero per caso. */
    await apriStrumento('capitolo');
    await val(`(()=>{ MAPPA.mia.file=''; MAPPA.mia.grafo=null; MAPPA.sel=null; return 1; })()`);
    await val(`(()=>{ const r=searchRun('${PAROLA}').filter(function(x){ return x.d.mappa && x.d.nodo; })[0];
      if(r) searchGoto(r, '${PAROLA}'); return 1; })()`);
    const aperta = await finoA(`(MAPPA.mia.grafo && MAPPA.mia.grafo.nodi.length) ? 1 : 0`, 15000);
    ok('la mappa si è aperta', 1, aperta);
    /* ⚠️ Aprire e basta è mezzo gesto: su una mappa di novantotto nodi
       lascerebbe a cercare a occhio ciò che la lente ha appena trovato. */
    const aFuoco = await finoA(`(MAPPA.focus && MAPPA.focus.id) ? 1 : 0`, 8000);
    ok('e il nodo è a fuoco, non solo la mappa aperta', 1, aFuoco);
  }

  sezione('⚠️ E il ritaglio porta alla sua card');
  {
    await apriStrumento('capitolo');
    await val(`(()=>{ const r=searchRun('${PAROLA}').filter(function(x){ return x.d.album; })[0];
      if(r) searchGoto(r, '${PAROLA}'); return 1; })()`);
    await pausa(900);
    ok('lo strumento dei ritagli è a schermo', true, await val(`bancoVisibile('album')`));
    /* ⚠️ La classe è `.alcard` e l'evidenziazione è un `outline` che dura 1,4
       secondi — misurato leggendo `albumEvidenzia`, non indovinato: la prima
       stesura di questa riga cercava classi che non esistono («.acard
       evidenziata») e accusava l'app di non fare una cosa che faceva. */
    ok('la card del ritaglio è nella griglia', true,
      await val(`!!document.querySelector('#albLista .alcard')`));
    ok('ed è quella giusta, accesa', true,
      await val(`(()=>{ const c=document.querySelector('#albLista .alcard[style*="outline"]');
        return !!c && (c.style.outline||'').indexOf('solid')>=0; })()`));
  }

  sezione('Il messaggio del vuoto dice dove si è guardato');
  {
    const vuoto = await val(`(()=>{ searchRender([], 'zzzqqq');
      return (document.querySelector('#searchRes .sr-empty')||{}).textContent||''; })()`);
    /* ⚠️ Lasciare l'elenco di prima farebbe credere che una parola scritta in un
       nodo non sia stata cercata — cioè manderebbe a cercarla a mano proprio
       dove la lente è appena passata. */
    ok('nomina le mappe', true, /mappe/i.test(vuoto));
    ok('e le didascalie', true, /didascalie/i.test(vuoto));
  }

  /* si lascia il contenitore com'era */
  await val(`(async()=>{
    try{ const l=(MAPPA.elenco||[]).filter(function(m){ return /Orbite di prova/.test(m.titolo||''); });
      for(const m of l) await window.vault.mappe.rimuovi(corsoAttivo(), m.file); }catch(e){}
    try{ const r=window.vault.album.elenco(corsoAttivo());
      ((r&&r.voci)||[]).forEach(function(v){ if(/${PAROLA}/.test(v.didascalia||''))
        window.vault.album.rimuovi(corsoAttivo(), v.id, { insisti:true }); }); }catch(e){}
    MAPPA.mia.file=''; MAPPA.mia.grafo=null; SEARCH.docs=null; return 1; })()`);
  /* ⚠️ E IL BANCO SI LASCIA COM'ERA — la regola è già scritta in
     `prova-banco-griglia`, e questa prova non la rispettava. Aprendo tre
     strumenti (mappa, ritagli, capitolo) cambia quanti blocchi ci sono e
     quindi l'ALTEZZA del riquadro del documento: `partiPulito` chiude
     pannellini e selezioni ma il banco non lo tocca, e due prove più in là
     `prova-testolayer` calcolava i suoi bersagli su un layout e ci cliccava
     sopra con un altro — il doppio click cadeva sul vuoto o su un pallino di
     elenco. Verde da sola, rossa nella suite: la trappola di sempre. */
  /* ⚠️ E LA CHIAVE È QUELLA VERA: `bancoChiave()`, cioè
     `studia.banco.c.<contenitore>` da quando ogni corso e ogni zaino ricordano
     il SUO banco (13 agosto). Togliere `studia.banco` — la chiave di modalità,
     morta da allora — non ripristina niente: l'ho misurato, e due prove più in
     là `prova-testolayer` cliccava sopra `svg#mappaSvg` invece che sul
     documento. Il rosso lo diceva soltanto dopo aver chiesto all'app CHI c'era
     sotto il puntatore. */
  await val(`(()=>{ localStorage.removeItem(bancoChiave()); bancoCarica(); bancoDisegna(); return 1; })()`);
  await pausa(400);
  ok('e il banco è tornato alla forma di fabbrica, per chi viene dopo', 'due-col',
    await val(`bancoStato().forma`));
  console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati'));
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('✗ ' + (e && e.message ? e.message : e)); process.exit(1); });
