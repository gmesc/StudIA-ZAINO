/* Il banco all'avvio, in modalità zaino — e la testata che non mente.
 *
 * ⚠️ Che cosa questa prova difende davvero. Il ripristino della modalità di
 * ieri NON passa da `cambiaModo`: arriva ad app già disegnata, quando il banco
 * ha già letto la chiave dei CORSI. Senza `bancoRicarica()` in quel punto,
 * l'app riapriva nello zaino col banco dell'altra metà — il capitolo di un
 * corso, vuoto — e la tendina del blocco, che «capitolo» in zaino non lo
 * offre, ripiegava sulla prima voce: sopra il blocco compariva «Fonti» senza
 * la barra delle fonti, e la fonte cliccata in sidebar apriva un SECONDO
 * blocco invece di atterrare lì. Tre sintomi, una causa; qui si misurano
 * tutti e tre.
 *
 * La riapertura è vera: `location.reload()`, non una chiamata alle funzioni
 * di boot — che proverebbe i pezzi saltando l'ordine, ed è l'ordine il bug.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-banco-avvio.js
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, val, pausa, partiPulito } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

async function finoA(expr, quanto) {
  const fine = Date.now() + (quanto || 12000);
  for (;;) {
    let v = null;
    try { v = await val(expr); } catch (e) { /* durante il reload l'app non risponde */ }
    if (v) return v;
    if (Date.now() > fine) return null;
    await pausa(200);
  }
}

/* La testata di un blocco: che cosa DICE (l'etichetta della tendina viva) e
   che cosa il blocco OSPITA (lo stato). La prova è tutta nel confronto. */
const TESTATA = (b) => `(()=>{ const lab=document.querySelector('.blocco[data-blocco="${b}"] .bhead .tlab');
  return { dice: lab ? lab.textContent : null, ospita: bancoStrumentoIn('${b}'),
           forma: bancoStato().forma }; })()`;

(async () => {
  await collega();
  await partiPulito();

  sezione('Si prepara uno zaino con una disposizione SUA, riconoscibile');
  await val(`(async()=>{ if(modoAttivo()!=='zaino') await cambiaModo('zaino');
    if(!zainoAttivo()) await zainoCrea('Avvio di prova'); return 1; })()`);
  await finoA(`zainoAttivo() ? 1 : 0`, 10000);
  await val(`(()=>{ bancoForma('tre-sopra');
    bancoAssegna('A','fonte'); bancoAssegna('B','appunti'); bancoAssegna('D','keyword');
    return 1; })()`);
  const salvata = await val(`(()=>{ try{ return JSON.parse(localStorage.getItem('studia.banco.zaino')).forma; }catch(e){ return String(e); } })()`);
  ok('la disposizione dello zaino è sul disco, con la sua chiave', 'tre-sopra', salvata);

  sezione('Si riapre l\'app: il banco deve tornare COME ERA, non di fabbrica');
  try { await val(`(setTimeout(()=>location.reload(),80),1)`); } catch (e) {}
  await pausa(2500);
  /* Il reload butta giù il canale: ci si riattacca al bersaglio nuovo. */
  await collega();
  const boot = await finoA(`(typeof bancoStato==='function' && document.documentElement.dataset.modo==='zaino') ? 1 : 0`, 20000);
  ok('l\'app riapre nella modalità di ieri (zaino)', 1, boot);
  /* ⚠️ Il cuore. Prima del rimedio qui c'era la forma dei corsi — il banco
     disegnato con la chiave sbagliata — e il poll moriva di timeout. */
  const forma = await finoA(`bancoStato().forma==='tre-sopra' ? 'tre-sopra' : 0`, 8000);
  ok('la disposizione è quella salvata dallo zaino', 'tre-sopra', forma);
  const capitolo = await val(`bancoBlocchiVisibili().map(bancoStrumentoIn).indexOf('capitolo') < 0`);
  ok('nessun blocco ospita il capitolo di un corso', true, capitolo);
  const tA = await finoA(`(()=>{ const t=${TESTATA('A')}; return (t.dice==='Fonti' && t.ospita==='fonte') ? 1 : 0; })()`, 8000);
  ok('la testata di A dice «Fonti» E il blocco ospita le fonti', 1, tA);

  sezione('Blocco vuoto: la tendina dice il trattino, non il primo strumento');
  await val(`(()=>{ bancoForma('uno'); bancoAssegna('A',''); return 1; })()`);
  const vuota = await finoA(`(()=>{ const t=${TESTATA('A')}; return (t.dice==='\\u2014' && t.ospita==='') ? 1 : 0; })()`, 6000);
  ok('sopra un blocco vuoto la testata dice «—»', 1, vuota);

  sezione('La fonte cliccata ATTERRA nel blocco: niente secondo split');
  await val(`(()=>{ try{ bancoMostra('fonte'); }catch(e){ return String(e); } return 1; })()`);
  const atterrata = await finoA(`(()=>{ const t=${TESTATA('A')};
    return (t.forma==='uno' && t.ospita==='fonte' && t.dice==='Fonti') ? 1 : 0; })()`, 6000);
  ok('con «un blocco» la fonte apre LÌ, e la forma resta «uno»', 1, atterrata);

  sezione('Nessuna fonte aperta: il riquadro lo dice, e dice dove si apre');
  await val(`(()=>{ try{ closePdf(); }catch(e){} return 1; })()`);
  const invito = await val(`(()=>{ const v=document.getElementById('pdfVuoto');
    if(!v) return 'manca #pdfVuoto';
    const r=v.getBoundingClientRect();
    const host=document.getElementById('pdfHost');
    const visibile=r.width>0 && r.height>0;
    const testo=Array.from(v.querySelectorAll('span')).filter(s=>getComputedStyle(s).display!=='none')
      .map(s=>s.textContent).join(' ');
    return { visibile: visibile, hostSpento: !host || host.getBoundingClientRect().width===0,
             portaGiusta: /Documenti/.test(testo) }; })()`);
  ok('il vuoto si vede, il visualizzatore è spento, e la frase indica «Documenti ▾»',
     { visibile: true, hostSpento: true, portaGiusta: true }, invito);

  /* Si lascia l'app com'era prima di questa prova: forma comoda e modalità
     corso — la prova dopo non deve ereditare uno zaino sotto i piedi. */
  await val(`(()=>{ bancoForma('due-col'); return 1; })()`);
  await val(`(async()=>{ await cambiaModo('corso'); return 1; })()`);

  console.log(ko ? `\n✗ ${ko} controlli falliti` : '\n✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('prova-banco-avvio: ' + (e && e.message)); process.exit(1); });
