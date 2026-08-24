/* Un media che il lettore NON sa aprire lo dice, invece di restare nero e muto.
 *
 * ⚠️ Perché esiste. Misurato il 24 agosto 2026 con file veri dentro l'Electron
 * del progetto: `.aiff`, `.avi` e `.mpg` entrano nel vault (le liste li
 * accettano, e la pipeline li trascrive benissimo — non passa da Chromium) ma
 * il browser non li apre. Hanno un tipo, quindi passano il controllo di
 * `playerApri`, e lasciavano un riquadro nero MUTO: né «entra e si vede», né
 * «si ferma sulla soglia dicendo perché».
 *
 * Che cosa dire lo decide `Lettore.erroreDaDire`, provata in Node
 * (`test/player.js`). Qui si misura solo il CABLAGGIO, che in Node non si può
 * vedere: il gestore è attaccato? l'errore del `<video>` arriva? il messaggio
 * compare davvero a schermo?
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-media-nonapre.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const S = path.join(__dirname, 'cdp.js');
const { collega, val, pausa, partiPulito, partiVuoto, apriStrumento } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

(async () => {
  await collega();
  await partiVuoto();
  await apriStrumento('player');

  sezione('Un media che non si apre: il riquadro non resta muto');
  {
    /* ⚠️ Un nome che non esiste sul disco è il modo più corto di ottenere un
       `error` vero dal `<video>` senza portarsi dietro un file binario nel
       vault di prova. La causa è un'altra (`code 2/4`), ma il cablaggio che si
       misura — gestore attaccato, errore letto, messaggio a schermo — è
       identico a quello di un `.aiff` che Chromium rifiuta. */
    /* ⚠️ Il codice dell'errore si registra QUANDO ACCADE, non dopo: adesso il
       player si rimette vuoto da sé, e `playerChiudi` fa `load()`, che azzera
       `video.error`. Leggerlo alla fine dava sempre 0 — un rosso che accusava
       l'app di non fallire mentre falliva eccome. La spia si mette prima. */
    await val(`(function(){ window.__toasts=[]; window.__codici=[];
      var t=window.toast;
      window.toast=function(m, buono){ window.__toasts.push(String(m)); return t.apply(this, arguments); };
      var v=document.querySelector('#mediaVideo');
      if(!window.__spia){ window.__spia=function(){ window.__codici.push((v.error||{}).code||0); };
        v.addEventListener('error', window.__spia, true); }
      return 1; })()`);
    await val(`playerApri('99 inesistente.m4a')`);
    /* l'errore del `<video>` arriva in un giro dopo: non è sincrono */
    for (let i = 0; i < 40 && !(await val(`(window.__codici||[]).length`)); i++) await pausa(100);

    ok('il <video> ha davvero fallito', true, (await val(`(window.__codici||[])[0]||0`)) > 0);
    const detti = await val(`JSON.stringify(window.__toasts||[])`);
    const parlato = JSON.parse(detti).some((m) => /non (riesco|apre|si riesce)/i.test(m));
    ok('e l\'app lo ha DETTO, invece di restare muta', true, parlato);
    if (!parlato) console.log('      i messaggi visti: ' + detti);
  }

  sezione('E il gestore non si accumula: dieci aperture, un gestore');
  {
    /* ⚠️ I due esiti (`loadedmetadata` e `error`) si tolgono a VICENDA: prima
       un media che non si apriva lasciava `alPunto` appeso, e il gestore
       dell'apertura dopo si sommava a quello di prima. Non si contano i
       gestori (il DOM non lo dice): si conta quante volte PARLA, che è la
       conseguenza visibile — dieci aperture fallite, dieci messaggi, non
       cinquantacinque. */
    await val(`window.__toasts=[]`);
    for (let i = 0; i < 5; i++) {
      await val(`playerApri('9${i} mai vista.m4a')`);
      for (let k = 0; k < 30 && !(await val(`(document.querySelector('#mediaVideo').error||{}).code||0`)); k++) await pausa(50);
    }
    await pausa(300);
    const quanti = JSON.parse(await val(`JSON.stringify((window.__toasts||[]).filter(function(m){ return /non (riesco|apre|si riesce)/i.test(m); }))`)).length;
    ok('cinque aperture fallite, cinque messaggi', 5, quanti);
  }

  sezione('Un .aiff VERO: si ferma sulla soglia — e chi passa lo stesso lo dice all\'apertura');
  {
    /* ⚠️ Qui il file è vero, non un nome inventato: `.aiff` è il caso misurato
       — Chromium lo rifiuta con `code 4` mentre il vault lo accetta, perché la
       pipeline lo trascrive benissimo. Se manca ffmpeg la sezione si salta
       invece di fallire: è una prova del CABLAGGIO, non di ffmpeg. */
    let sorgente = '';
    try {
      const fuori = fs.mkdtempSync(path.join(os.tmpdir(), 'studia-aiff-'));
      sorgente = path.join(fuori, 'Registrazione vera.aiff');
      execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'sine=f=440:d=1', '-c:a', 'pcm_s16be', sorgente],
        { stdio: 'ignore' });
    } catch (e) { sorgente = ''; }

    if (!sorgente || !fs.existsSync(sorgente)) {
      console.log('  --  saltata: ffmpeg non c\'è, e il file .aiff va generato');
    } else {
      await partiPulito();
      await val(`(async()=>{ await cambiaModo('zaino'); await zainoCrea('Zaino aiff'); return 1; })()`);
      for (let i = 0; i < 40 && !(await val(`zainoAttivo()==='zaino-aiff' ? 1 : 0`)); i++) await pausa(300);
      /* ⚠️ LA SOGLIA, dal 24 agosto 2026: nello zaino un `.aiff` NON entra più.
         Il gesto vero è un trascinamento, e un `File` che arrivi davvero da
         fuori non si costruisce col CDP — ma la decisione non sta nel gesto:
         sta in `mediaSiApre`, che si CHIEDE a Chromium invece di consultare una
         lista. Qui si prova quella, con un File vero costruito dai byte del
         file vero, che è esattamente ciò che il drop passa a `mediaTrascinati`. */
      const byte = fs.readFileSync(sorgente).toString('base64');
      const verdetti = await val(`(async()=>{
        const daB64=(b64, nome, mime)=>{ const bin=atob(b64); const u=new Uint8Array(bin.length);
          for(let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i);
          return new File([u], nome, { type: mime||'' }); };
        const aiff=daB64(${JSON.stringify(byte)}, 'Registrazione vera.aiff');
        /* e un WAV sano, per la controprova: la soglia deve dire di sì a lui */
        const rate=8000, n=rate, dati=new Uint8Array(44+n*2), dv=new DataView(dati.buffer);
        const scriviTesto=(off,t)=>{ for(let i=0;i<t.length;i++) dati[off+i]=t.charCodeAt(i); };
        scriviTesto(0,'RIFF'); dv.setUint32(4, 36+n*2, true); scriviTesto(8,'WAVE');
        scriviTesto(12,'fmt '); dv.setUint32(16,16,true); dv.setUint16(20,1,true); dv.setUint16(22,1,true);
        dv.setUint32(24,rate,true); dv.setUint32(28,rate*2,true); dv.setUint16(32,2,true); dv.setUint16(34,16,true);
        scriviTesto(36,'data'); dv.setUint32(40, n*2, true);
        for(let i=0;i<n;i++) dv.setInt16(44+i*2, Math.round(3000*Math.sin(i/20)), true);
        const wav=new File([dati], 'Registrazione sana.wav', { type:'audio/wav' });
        return [await mediaSiApre(aiff), await mediaSiApre(wav)]; })()`);
      ok('la soglia dice NO all\'aiff e SÌ al wav', [false, true], verdetti);

      /* E il messaggio del rifiuto è quello del modulo puro, provato in Node. */
      ok('il rifiuto nomina il file e dice come si rimedia', true,
        await val(`(function(){ var m=Lettore.rifiutoSullaSoglia(['Registrazione vera.aiff']);
          return /Non porto dentro/.test(m) && /Registrazione vera\.aiff/.test(m) && /Convertilo/.test(m); })()`));

      /* ⚠️ La PORTA resta aperta: `media.importa` non filtra niente, ed è
         voluto — la soglia è dello zaino, non del canale. Nei corsi lo stesso
         file deve poter entrare, perché là si trascrive. */
      const esito = await val(`(async()=>{ const r=await window.vault.media.importa(corsoAttivo(),
        [${JSON.stringify(sorgente)}]);
        return { copiati:(r.copiati||[]).map(function(x){ return x.nome; }), scartati:r.scartati||[], error:r.error||'' }; })()`);
      ok('il canale dell\'import non filtra: la soglia è dello zaino', ['01 Registrazione vera.aiff'], esito.copiati);
      ok('e non viene scartato dal canale', [], esito.scartati);

      await apriStrumento('player');
      await val(`(function(){ window.__toasts=[]; window.__codici=[];
        var t=window.toast;
        window.toast=function(m){ window.__toasts.push(String(m)); return t.apply(this, arguments); };
        var v=document.querySelector('#mediaVideo');
        if(!window.__spia){ window.__spia=function(){ window.__codici.push((v.error||{}).code||0); };
          v.addEventListener('error', window.__spia, true); }
        return 1; })()`);
      await val(`playerApri('01 Registrazione vera.aiff')`);
      for (let i = 0; i < 60 && !(await val(`(window.__codici||[]).length`)); i++) await pausa(100);

      /* ⚠️ `code 4` è MEDIA_ERR_SRC_NOT_SUPPORTED, e qui il file c'è eccome:
         è Chromium che non sa aprire un AIFF. Misurato, non supposto. */
      ok('Chromium lo rifiuta davvero (code 4)', 4, await val(`(window.__codici||[])[0]||0`));
      /* ⚠️ Seconda metà: e allora lo si DICE. Il terzo caso — entra, non si
         apre, e nessuno lo dice — è quello che non deve esistere. */
      const detti = await val(`JSON.stringify(window.__toasts||[])`);
      const messaggi = JSON.parse(detti);
      ok('e l\'app lo dice', true, messaggi.some((m) => /non apre/i.test(m)));
      if (!messaggi.some((m) => /non apre/i.test(m))) console.log('      i messaggi visti: ' + detti);
      /* ⚠️ E QUI SIAMO IN UNO ZAINO, dove la trascrizione NON esiste
         («qui non si trascrive niente», PIANO-ZAINO §1.5). Il messaggio era
         giusto sul perché e falso sul rimedio: prometteva una porta che in
         questa metà dell'app non c'è. Trovato dall'utente provando a mano un
         `.aiff` vero, con la prova qui sopra già verde — perché guardava che
         l'app parlasse, non CHE COSA dicesse. */
      ok('e nello zaino non promette la trascrizione, che qui non c\'è', false,
        messaggi.some((m) => /trascriv/i.test(m)));
      ok('ma dice il rimedio vero: convertirlo', true,
        messaggi.some((m) => /convertito/i.test(m)));
      /* ⚠️ E il vestito resta quello dell'AUDIO: un `.aiff` è un audio anche
         quando non si apre, e il rettangolo nero del video sarebbe un buco che
         sembra un guasto dell'app. */
      /* ⚠️ E dirlo NON BASTA: il toast passa, e quello che resta è un riquadro
         con dentro un media morto — comandi accesi che non comandano niente e
         il tempo fermo a 0:00. È quello che ha visto l'utente provando a mano
         un `.aiff` vero, con tutte le suite verdi: la prova diceva «lo ha
         detto» e si fermava un istante prima del punto che conta. */
      await pausa(300);
      ok('e il player si rimette vuoto, invece di restare con un media morto in mano',
        [ '', '', false ],
        await val(`[ PLAYER.file, (document.querySelector('#plHost').dataset.tipo||''),
                     !document.getElementById('plComandi').hidden ]`));
      ok('lo stato vuoto torna visibile', true,
        await val(`getComputedStyle(document.getElementById('plVuoto')).display!=='none'`));
    }
  }

  /* ⚠️ SI TORNA AI CORSI, e la spia si stacca. `partiPulito()` chiude
     pannellini e selezioni ma NON riporta la modalità: una prova che finisce
     dentro uno zaino lascia le successive senza capitoli e senza quiz, e le fa
     fallire per una ragione che non c'entra niente con loro. È scritto
     nell'handoff del pacchetto, ed è stato pagato di nuovo qui: cinque prove
     rosse a valle di questa, tutte per la modalità rimasta. */
  await val(`(async function(){
    try{ var v=document.querySelector('#mediaVideo');
         if(window.__spia){ v.removeEventListener('error', window.__spia, true); window.__spia=null; } }catch(e){}
    playerChiudi();
    if(typeof cambiaModo==='function' && modoAttivo()!=='corso') await cambiaModo('corso');
    return 1; })()`);
  for (let i = 0; i < 30 && (await val(`modoAttivo()`)) !== 'corso'; i++) await pausa(200);
  ok('e si torna ai corsi, per chi viene dopo', 'corso', await val(`modoAttivo()`));

  console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati'));
  process.exit(ko ? 1 : 0);
})();
