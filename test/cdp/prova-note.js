/* Il salto ai richiami di nota, nell'app viva.
 *
 * Il markup lo provano in Node i 47 controlli di `test/note.js`. Quello che di
 * qui non si vede è la sola cosa che poteva rompersi davvero: **che cosa
 * scorre**. Da quando c'è il banco la pagina non scorre più — scorre il corpo
 * del blocco (`.bcorpo`) — e un salto scritto per una pagina che scorre
 * porterebbe il riquadro delle note fuori vista senza muovere niente.
 *
 * ⚠️ Gira contro il vault della config: puntarlo a una COPIA (trappola ⑧).
 *   ./test/cdp/con-vault-di-prova.sh prova-note
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, val, clicca, pausa, partiPulito } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}

/**
 * Il primo capitolo CON NOTE, cercandolo anche negli altri corsi del vault.
 *
 * ⚠️ Non tutti i corsi ne hanno: il corso aperto per primo nel vault di prova
 * non ne ha nemmeno una, e cercarle solo lì faceva uscire la prova dicendo
 * «niente da provare» — che è un verde che non prova niente. Le note si
 * scrivono a mano nei materiali, quindi dipende dal corpus, non dal codice.
 */
async function capitoloConNote() {
  /* ⚠️ `LESSONS` sono le LEZIONI, non i corsi — ci ho sbattuto: chiamare
     `cambiaCorso()` con le sue chiavi non cambia niente e la ricerca gira a
     vuoto. Le lezioni di tutti i corsi caricati stanno lì dentro, quindi si
     scorrono e basta. */
  const lezioni = await val(`Object.keys(LESSONS||{})`);
  for (const lez of lezioni) {
    await val(`loadLesson(${JSON.stringify(lez)}), 1`);
    await pausa(420);
    const i = await val(`(async()=>{
      for(var i=0;i<(LESSON.chapters||[]).length;i++){
        go(i); await new Promise(r=>setTimeout(r,170));
        if(document.querySelector('#content sup.fnref a.fnsalta')) return i;
      }
      return -1; })()`);
    if (i >= 0) return { lezione: lez, capitolo: i };
  }
  return null;
}


(async () => {
  await collega(); await partiPulito(); await pausa(400);

  const trovato = await capitoloConNote();
  if (!trovato) {
    /* ⚠️ Rosso, non verde. Se in tutto il vault di prova non c'è una nota, non
       è che il salto funziona: è che non lo si sta provando, e un verde che non
       prova niente è peggio di un rosso. */
    console.log('  ✗ nessun capitolo con note in tutto il vault di prova: la prova non può provare niente');
    process.exit(1);
  }
  console.log('  lezione «' + trovato.lezione + '» · capitolo ' + (trovato.capitolo + 1) +
    ': ha dei richiami di nota');

  console.log('\n== Il numeretto è un\'ancora, non un apice muto');
  ok('ha il bersaglio addosso', true,
    await val(`!!document.querySelector('#content sup.fnref a.fnsalta').dataset.nota`));
  ok('e il bersaglio esiste davvero', true,
    await val(`(()=>{const a=document.querySelector('#content sup.fnref a.fnsalta');
      return !!document.getElementById(a.dataset.nota);})()`));

  console.log('\n== Il salto muove il contenitore che scorre');
  /* Si guarda la posizione della VOCE sullo schermo prima e dopo: è la misura
     onesta, perché non presume chi sia a scorrere — pagina, dock o blocco. */
  const dove = () => val(`(()=>{const a=document.querySelector('#content sup.fnref a.fnsalta');
    const b=document.getElementById(a.dataset.nota);
    const r=b.getBoundingClientRect(), h=window.innerHeight;
    return { centro:Math.round(r.top+r.height/2), inVista:(r.top>=0 && r.bottom<=h) };})()`);
  /* ⚠️ Prima si porta il numeretto SOTTO GLI OCCHI, poi lo si preme. Il click di
     CDP arriva a coordinate dello schermo: con l'ancora a y=1103 in una finestra
     alta 848 il colpo cade nel vuoto, non succede niente, e il rosso accusa il
     gestore invece della prova. Misurato. */
  await val(`(()=>{document.querySelector('#content sup.fnref a.fnsalta')
    .scrollIntoView({block:'center'}); return 1;})()`);
  await pausa(300);
  const prima = await dove();
  await clicca('#content sup.fnref a.fnsalta');
  await pausa(900);
  const dopo = await dove();
  console.log('   la voce era a y=' + prima.centro + ', ora è a y=' + dopo.centro);
  ok('la nota è finita sotto gli occhi', true, dopo.inVista);
  ok('…e qualcosa si è mosso davvero', true, prima.centro !== dopo.centro || prima.inVista);
  ok('il fuoco è sulla nota (la tastiera segue)', true,
    await val(`(()=>{const a=document.activeElement; return !!a && a.matches('#content .fnotes li');})()`));
  ok('l\'indirizzo della finestra non si è sporcato di #', false,
    await val(`location.hash.length>1`));

  console.log('\n== E la freccia riporta indietro');
  ok('la voce ha la freccia del ritorno', true,
    await val(`!!document.querySelector('#content .fnotes a.fnback')`));
  const suY = () => val(`(()=>{const a=document.querySelector('#content sup.fnref a.fnsalta');
    const r=a.getBoundingClientRect(); return { centro:Math.round(r.top), inVista:(r.top>=0 && r.bottom<=window.innerHeight) };})()`);
  await val(`(()=>{document.querySelector('#content .fnotes a.fnback')
    .scrollIntoView({block:'center'}); return 1;})()`);
  await pausa(300);
  await clicca('#content .fnotes a.fnback');
  await pausa(900);
  ok('il richiamo nel testo è tornato in vista', true, (await suY()).inVista);

  console.log(ko ? '\n✗ ' + ko + ' controlli falliti' : '\n✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
