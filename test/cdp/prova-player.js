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
 * ⚠️ I media sono VERI (un WAV fabbricato qui, e un mp4 se c'è ffmpeg), e fino
 * al 24 agosto 2026 erano nomi inventati: reggevano finché un media che non si
 * apriva falliva in silenzio. Adesso il player dice perché e si rimette vuoto,
 * e una barra accesa sopra un media inesistente non esiste più — né qui né
 * nell'app. Si prova comunque il CABLAGGIO — stato, barra, banco, tasti — non
 * la riproduzione, che è del browser. Le regole di tempo, salto, velocità e riga d'appunto sono provate a
 * parte, in Node, da `test/player.js`: qui non si ricontrollano.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-player.js
 */
const path = require('path');
const fs = require('fs');
const S = path.join(__dirname, 'cdp.js');
const { collega, val, pausa, partiPulito, partiVuoto, apriStrumento, wavDiProva, mediaConFfmpeg } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

/* ⚠️ I media sono VERI, e prima non lo erano: fino al 24 agosto 2026 qui
   c'erano due nomi inventati («01 lezione finta.mp4»), e reggevano soltanto
   perché un media che non si apriva falliva in SILENZIO. Da quando il player
   dice perché e si rimette vuoto — il difetto che l'utente ha visto con un
   `.aiff` vero, con tutte le suite verdi — un fantasma non regge più una
   barra, ed è giusto così: una barra accesa sopra un media inesistente era
   esattamente ciò che nessuno voleva vedere nell'app.
   L'audio non ha bisogno di nessuno (`wavDiProva`); il video sì, e se ffmpeg
   non c'è le due righe che riguardano solo lui si saltano DICENDOLO. */
const VIDEO = '01 lezione vera.mp4';
const AUDIO = '02 registrazione vera.wav';

(async () => {
  await collega();
  /* il riquadro del player si misura vuoto: il ripristino gli metterebbe un media in mano */
  await partiVuoto();

  /* I due media veri, dentro il CORSO attivo. ⚠️ Si scrivono sul disco del
     vault di prova (temporaneo), non si trascinano: un trascinamento di file
     veri non si simula col CDP, ed è la stessa ricetta di `prova-media-punto`.
     ⚠️ E nel corso, non in uno zaino nuovo: la sezione «aprire un documento non
     spegne il player» — la ragione per cui questa prova esiste — ha bisogno di
     un documento da aprire, e uno zaino appena creato è vuoto. Misurato: con
     lo zaino quella sezione si SALTAVA, e la prova restava verde senza aver
     provato il suo punto principale. */
  const vault = await val('window.vault.path');
  const corso = await val('corsoAttivo()');
  const dirAudio = path.join(vault, 'Corsi', corso, 'MATERIALI', 'Audio');
  const dirVideo = path.join(vault, 'Corsi', corso, 'MATERIALI', 'Video');
  fs.mkdirSync(dirAudio, { recursive: true });
  fs.writeFileSync(path.join(dirAudio, AUDIO), wavDiProva(60));
  const conVideo = !!mediaConFfmpeg(path.join(dirVideo, VIDEO));
  if (!conVideo) console.log('  --  senza ffmpeg: le due righe che riguardano SOLO il video si saltano');
  /* ⚠️ E un DOCUMENTO accanto ai media, che prima non serviva. Creando
     `MATERIALI/` dentro il corso si cambia dove l'app guarda: `corpus:list`
     con un corso cerca SOLO lì dentro, mentre finché quella cartella non
     esisteva cadeva sul ripiego globale (`Fonti/` del vault) e i PDF li
     trovava. Senza questa riga la sezione «aprire un documento non spegne il
     player» — la ragione per cui questa prova esiste — si saltava, e la prova
     restava verde senza provare il suo punto principale. */
  const dirPdf = path.join(vault, 'Corsi', corso, 'MATERIALI', 'PDF');
  const daCopiare = (fs.existsSync(path.join(vault, 'Fonti'))
    ? fs.readdirSync(path.join(vault, 'Fonti')).filter((f) => /\.pdf$/i.test(f))[0] : '') || '';
  if (daCopiare) {
    fs.mkdirSync(dirPdf, { recursive: true });
    fs.copyFileSync(path.join(vault, 'Fonti', daCopiare), path.join(dirPdf, '01 dispensa di prova.pdf'));
  }
  await val('zainoNavAggiorna()');

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
    /* ⚠️ Il video PRIMA dell'audio, e solo se c'è: le righe che riguardano il
       vestito «video» e le forbici non si possono provare su un audio. */
    if (conVideo) {
      await val(`(()=>{ playerApri(${JSON.stringify(VIDEO)}, 1, 'Lezione vera'); return 1; })()`);
      for (let i = 0; i < 40 && !(await val(`PLAYER.pronto ? 1 : 0`)); i++) await pausa(200);
      ok('il player sa che cosa ha in mano', [VIDEO, 'video'],
        await val(`[PLAYER.file, PLAYER.tipo]`));
      ok('il riquadro dichiara il tipo', 'video',
        await val(`document.getElementById('plHost').dataset.tipo||''`));
      ok('e le forbici ci sono, che è un video', false,
        await val(`document.getElementById('plRitaglia').hidden`));
    }
    await val(`(()=>{ playerApri(${JSON.stringify(AUDIO)}, 0, 'Registrazione vera'); return 1; })()`);
    for (let i = 0; i < 40 && !(await val(`PLAYER.pronto ? 1 : 0`)); i++) await pausa(200);
    ok('il player ha in mano l\'audio', [AUDIO, 'audio'],
      await val(`[PLAYER.file, PLAYER.tipo]`));
    /* ⚠️ Il nome del materiale sta SOLO nel selettore, e in nessun altro posto
       della barra. Fino al 24 agosto 2026 lo scriveva anche un «plTitle»
       accanto, che era la terza copia di due cose già dette — il nome dello
       STRUMENTO lo dice la testata del blocco, il nome del MATERIALE lo dice il
       selettore, che lo accorcia coi puntini perché è un comando e non
       un'insegna. Questo controllo prima affermava il contrario e passava
       grazie al difetto: è stato riscritto con la promessa. */
    ok('il nome del materiale è nel selettore', true,
      /Registrazione vera/.test(await val(`document.getElementById('plScegli').textContent`)));
    ok('e non è scritto da nessun\'altra parte nella barra', 0,
      await val(`(function(){ var b=document.querySelector('.tbar.plbar'); if(!b) return -1;
        var n=0; b.querySelectorAll('*').forEach(function(el){
          if(el.id!=='plScegli' && el.children.length===0 && /Registrazione vera/.test(el.textContent||'')) n++;
        });
        return n; })()`));
    ok('i comandi sono accesi', true,
      await val(`!document.getElementById('plComandi').hidden && !document.getElementById('plNota').hidden`));
    /* Un audio è lo stesso elemento senza immagine: cambia il vestito, non il
       motore — e le forbici, che su un audio non hanno niente da inquadrare. */
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
      ok('il media aperto resta quello di prima', AUDIO, await val(`PLAYER.file`));
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

  /* ⚠️ La modalità resta quella dei corsi per tutta la prova, e non è un
     dettaglio: una prova che finisce dentro uno zaino lascia le successive
     senza capitoli e senza quiz — pagato il 24 agosto 2026, cinque prove rosse
     a valle per una modalità rimasta. */
  await partiPulito();
  ok('e la modalità è ancora quella dei corsi, per chi viene dopo', 'corso', await val(`modoAttivo()`));

  console.log(ko ? '\n✗ ' + ko + ' controlli falliti' : '\n✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('✗ ' + (e && e.message ? e.message : e)); process.exit(1); });
