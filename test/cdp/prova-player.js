/* Il PLAYER: lo strumento nuovo del banco, sull'app viva.
 *
 * ⚠️ Perché esiste. Il `<video>` è stato SPOSTATO fuori da `#pdfPane`: era
 * dentro il riquadro del documento, e i due si spegnevano a vicenda. Uno
 * spostamento del genere non si vede rotto — l'elemento c'è, le funzioni ci
 * sono, semplicemente il media suona dove non lo si guarda, oppure aprire una
 * dispensa zittisce la lezione senza dire perché. Qui si misura che:
 *
 *   1. «Player» è fra gli strumenti offerti, nei corsi e negli zaini;
 *   2. il pannello si monta in un blocco, e il `<video>` sta DENTRO di lui —
 *      non è più figlio di `#pdfPane`;
 *   3. aprire un media accende la barra (titolo, comandi, velocità, ✎) e
 *      dichiara il tipo al riquadro (`#plHost[data-tipo]`);
 *   4. ⚠️ **aprire un documento non tocca il player** — è la promessa per cui
 *      questo lavoro esiste;
 *   5. i tasti rapidi valgono col fuoco fuori dall'editor e NON dentro, o
 *      scrivere «job» in un appunto farebbe saltare la lezione;
 *   6. chiudere il player lascia il documento dov'è.
 *
 * ⚠️ Il media è FINTO: un nome di file che non esiste. Serve a provare il
 * cablaggio — stato, barra, banco, tasti — non la riproduzione, che è del
 * browser. Le regole di tempo, salto, velocità e riga d'appunto sono provate a
 * parte, in Node, da `test/player.js`: qui non si ricontrollano.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-player.js
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, val, pausa, partiPulito, partiVuoto, apriStrumento } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

const FINTO = '01 lezione finta.mp4';
const FINTO_AUDIO = '02 registrazione finta.m4a';

(async () => {
  await collega();
  /* il riquadro del player si misura vuoto: il ripristino gli metterebbe un media in mano */
  await partiVuoto();

  sezione('Il registro: «Player» è uno strumento, e lo è in tutte e due le modalità');
  {
    ok('c\'è nel registro', 'Player', await val(`(bancoStrumenti().player||{}).nome||''`));
    ok('ed è disponibile (il pannello esiste)', true, await val(`bancoDisponibile('player')`));
    /* ⚠️ A differenza di «Capitolo», il player vale anche nello zaino: un video
       importato lì dentro è dell'utente quanto un PDF. */
    ok('offerto nei corsi', true, await val(`!!bancoStrumentiOfferti().player`));
    const inZaino = await val(`(()=>{ const prima=modoAttivo();
      try{ MODO.modo='zaino'; return !!bancoStrumentiOfferti().player; }
      finally{ MODO.modo=prima; } })()`);
    ok('e offerto negli zaini', true, inZaino);
  }

  sezione('Il pannello si monta, e il video sta dentro di lui');
  {
    ok('il banco lo mette a schermo', 'a schermo', await apriStrumento('player'));
    /* ⚠️ La prova dello SPOSTAMENTO: finché il `<video>` era figlio di
       `#pdfPane`, mostrare il player non avrebbe mostrato niente. */
    ok('il video è dentro il player', true,
      await val(`!!document.querySelector('#playerPane #mediaVideo')`));
    ok('e non è più dentro le fonti', false,
      await val(`!!document.querySelector('#pdfPane #mediaVideo')`));
    ok('senza media il riquadro non dichiara nessun tipo', true,
      await val(`!document.getElementById('plHost').dataset.tipo`));
    ok('e i comandi sono spenti', true,
      await val(`document.getElementById('plComandi').hidden && document.getElementById('plNota').hidden`));
  }

  sezione('Aprire un media accende la barra');
  {
    await val(`(()=>{ playerApri(${JSON.stringify(FINTO)}, 30, 'Lezione finta'); return 1; })()`);
    await pausa(400);
    ok('il player sa che cosa ha in mano', [FINTO, 'video'],
      await val(`[PLAYER.file, PLAYER.tipo]`));
    ok('il riquadro dichiara il tipo', 'video',
      await val(`document.getElementById('plHost').dataset.tipo||''`));
    ok('il titolo è quello passato', 'Lezione finta',
      await val(`document.getElementById('plTitle').textContent`));
    ok('i comandi sono accesi', true,
      await val(`!document.getElementById('plComandi').hidden && !document.getElementById('plNota').hidden`));
    ok('e le forbici pure, che è un video', false,
      await val(`document.getElementById('plRitaglia').hidden`));
    /* Un audio è lo stesso elemento senza immagine: cambia il vestito, non il
       motore — e le forbici, che su un audio non hanno niente da inquadrare. */
    await val(`(()=>{ playerApri(${JSON.stringify(FINTO_AUDIO)}, 0, 'Registrazione'); return 1; })()`);
    await pausa(300);
    ok('un audio dichiara «audio»', 'audio',
      await val(`document.getElementById('plHost').dataset.tipo||''`));
    ok('e lì le forbici spariscono', true,
      await val(`document.getElementById('plRitaglia').hidden`));
  }

  sezione('⚠️ Aprire un documento NON spegne il player');
  {
    const pdf = await val(`(async()=>{ const l=await window.vault.corpus.list(corsoAttivo());
      const p=(l||[]).filter(m=>m.tipo==='pdf')[0]; return p?p.name:''; })()`);
    if (!pdf) { console.log('  --  nessun documento in questo corso: la prova salta'); }
    else {
      await val(`(()=>{ openPdf(${JSON.stringify(pdf)}, 1, 'Documento'); return 1; })()`);
      await pausa(1200);
      /* ⚠️ È la riga che prima fermava il media e gli toglieva la sorgente. */
      ok('il media aperto resta quello di prima', FINTO_AUDIO, await val(`PLAYER.file`));
      ok('e il riquadro del player non si è svuotato', 'audio',
        await val(`document.getElementById('plHost').dataset.tipo||''`));
      ok('il documento intanto è aperto', 'pdf', await val(`ANTEPRIMA.tipo||''`));
      /* Due riquadri accesi, due citazioni: 🔖 cita il documento, ✎ il minuto. */
      ok('e ANTEPRIMA parla del documento, non del media', pdf, await val(`ANTEPRIMA.file`));
    }
  }

  sezione('I tasti rapidi: fuori dall\'editor sì, dentro no');
  {
    ok('fuori dai campi si scrive', false, await val(`scriveraDaTastiera(document.body)`));
    ok('in un campo di testo no', true,
      await val(`(()=>{ const i=document.createElement('input'); document.body.appendChild(i);
        const r=scriveraDaTastiera(i); i.remove(); return r; })()`));
    /* ⚠️ CodeMirror non è un `<textarea>` visibile: senza questa riga, «job»
       scritto in un appunto sarebbe due salti indietro di dieci secondi. */
    ok('e dentro CodeMirror nemmeno', true,
      await val(`(()=>{ const d=document.createElement('div'); d.className='CodeMirror';
        const s=document.createElement('span'); d.appendChild(s); document.body.appendChild(d);
        const r=scriveraDaTastiera(s); d.remove(); return r; })()`));
  }

  sezione('Chiudere il player lascia il documento dov\'è');
  {
    const primaPdf = await val(`ANTEPRIMA.file||''`);
    await val(`(()=>{ playerChiudi(); return 1; })()`);
    await pausa(300);
    ok('il player è vuoto', '', await val(`PLAYER.file`));
    ok('il riquadro non dichiara più un tipo', true,
      await val(`!document.getElementById('plHost').dataset.tipo`));
    ok('i comandi si spengono', true, await val(`document.getElementById('plComandi').hidden`));
    ok('e il documento è ancora lì', primaPdf, await val(`ANTEPRIMA.file||''`));
  }

  await partiPulito();
  console.log(ko ? '\n✗ ' + ko + ' controlli falliti' : '\n✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('✗ ' + (e && e.message ? e.message : e)); process.exit(1); });
