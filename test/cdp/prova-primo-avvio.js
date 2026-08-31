/* Il primo avvio parte dallo ZAINO, e i requisiti della pipeline si chiedono
 * alla soglia dei CORSI.
 *
 * ⚠️ Che cosa difende. Fino al 31 agosto 2026 l'app apriva sempre nei corsi e la
 * prima cosa che vedeva chi arrivava erano tre schermate su motore AI, chiave e
 * Python: requisiti della pipeline, davanti a chi magari voleva solo aprire un
 * PDF e prenderci appunti. La decisione — da dove si comincia, che cosa si
 * chiede — sta in `App/assets/onboarding/avvio.js` e la provano 15 controlli in
 * Node. Qui si prova ciò che in Node non esiste: che il modulo sia davvero nel
 * bundle e legga i dati VERI, che la porta della soglia esista e sia UNA, e che
 * nello zaino non compaia la card del profilo di generazione.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-primo-avvio.js
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

(async () => {
  await collega();
  await partiPulito();

  sezione('Il modulo è nel bundle, e legge i dati veri');
  ok('OnboardingAvvio è caricato', ['function', 'function'],
    await val("[typeof OnboardingAvvio.modoIniziale, typeof OnboardingAvvio.passiPrimoAvvio]"));
  /* ⚠️ Il vault di prova HA dei corsi, quindi qui la regola deve dire «corso»:
     è il controllo che difende chi apre un vault esistente dal ritrovarsi nella
     metà vuota. Il caso del vault vergine sta in Node, dove si può fingere. */
  const corsi = await val("(window.vault.courses||[]).length");
  console.log('   corsi nel vault di prova: ' + corsi);
  ok('con dei corsi sul disco si comincia dai corsi', 'corso',
    await val("OnboardingAvvio.modoIniziale({ salvato:null, corsi:(window.vault.courses||[]).length })"));
  ok('e un vault senza niente comincia dallo zaino', 'zaino',
    await val("OnboardingAvvio.modoIniziale({ salvato:null, corsi:0 })"));

  sezione('⚠️ Nello ZAINO non si chiede niente della pipeline');
  ok('nessun pannello, per nessun avviso', { pannelli: [], toastSpazio: false },
    await val(`OnboardingAvvio.passiPrimoAvvio({ modo:'zaino',
      consiglio:{ avvisi:[{id:'motore-assente'},{id:'python-assente'}] } })`));
  ok('e nei corsi restano i due di sempre', ['motore', 'python'],
    await val("OnboardingAvvio.passiPrimoAvvio({ modo:'corso', consiglio:null }).pannelli"));

  sezione('La soglia dei corsi è una porta sola');
  ok('la porta esiste', 'function', await val("typeof window.pipelineInvito"));
  /* Con il flag già segnato la porta non deve aprire niente: è ciò che impedisce
     alla card di tornare a ogni passaggio fra le due metà. */
  await val("(async()=>{ await window.vault.onboarding.pipelineVista(true); return 1; })()");
  await val("window.pipelineInvito(), 1"); await pausa(700);
  ok('a domanda già fatta, non si ripresenta', true,
    await val("document.getElementById('primoAvvio').hidden"));
  /* Azzerando il flag, la porta apre la card VERA: gli stessi pannelli, con le
     frasi che stanno in `consiglio()` e non nell'HTML. */
  await val("(async()=>{ await window.vault.onboarding.pipelineVista(false); return 1; })()");
  await val("window.pipelineInvito(), 1"); await pausa(2500);
  const carta = await val(`(()=>{ const c=document.getElementById('primoAvvio');
    return { aperta: !c.hidden, passi: (document.getElementById('paSteps')||{}).textContent||'',
             testo: (document.getElementById('paBody')||{}).textContent||'' }; })()`);
  console.log('   ' + JSON.stringify({ aperta: carta.aperta, passi: carta.passi }));
  ok('alla soglia la card si apre', true, carta.aperta);
  ok('e parla di ciò che serve per generare', true,
    /Claude Code|chiave|API|motore/i.test(carta.testo));

  sezione('Il profilo di generazione non si propone nello zaino');
  /* «Come vuoi studiare?» regola la FORMA delle lezioni: nello zaino lezioni non
     ce ne sono, e chiederlo lì è la stessa domanda fuori posto. */
  await val("(()=>{ document.getElementById('primoAvvio').hidden=true; return 1; })()");
  const modoPrima = await val("modoAttivo()");
  await val("(async()=>{ await cambiaModo('zaino'); return 1; })()"); await pausa(900);
  ok('si è nello zaino', 'zaino', await val("modoAttivo()"));
  ok('e la card del profilo resta chiusa', true,
    await val("document.getElementById('profiloSetup').hidden"));

  /* La prova lascia l'app e la config come le ha trovate. */
  await val("(async()=>{ await window.vault.onboarding.pipelineVista(true); return 1; })()");
  if (modoPrima !== 'zaino') { await val("(async()=>{ await cambiaModo('corso'); return 1; })()"); await pausa(700); }
  await val("(()=>{ document.getElementById('primoAvvio').hidden=true; document.getElementById('profiloSetup').hidden=true; return 1; })()");

  console.log('');
  console.log(ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('✗ ' + (e && e.message ? e.message : e)); process.exit(1); });
