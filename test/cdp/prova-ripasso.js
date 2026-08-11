/* La storia dei ripassi sopravvive alla sera.
 *
 * Fino a oggi il punteggio di un quiz produceva un'etichetta
 * (`appreso`/`ripassare`/`studiare`) che viveva in `state.learn`, in memoria, e
 * si azzerava a ogni `loadLesson`. Il lavoro sull'apprendimento — il dato più
 * costoso dell'app, perché nessuno può ricostruirlo — non veniva scritto da
 * nessuna parte.
 *
 * Qui si misura il giro vero, dall'app: si risponde a un quiz, si cambia
 * lezione, si torna, e l'etichetta deve essere ancora lì. Poi si riparte da
 * zero (ricarica della pagina) e deve esserci ancora.
 *
 * ⚠️ Gira contro il vault della config: puntarlo a una COPIA (trappola ⑧).
 *   ./test/cdp/con-vault-di-prova.sh prova-ripasso
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, val, clicca, pausa, partiPulito } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}

/** Il primo capitolo con un quiz a schermo: senza, non c'è niente da ripassare. */
async function capitoloConQuiz() {
  return val(`(async()=>{
    for(var i=0;i<(LESSON.chapters||[]).length;i++){
      go(i); await new Promise(r=>setTimeout(r,180));
      if(document.querySelector('.quiz .q .opt')) return i;
    }
    return -1; })()`);
}

(async () => {
  await collega(); await partiPulito(); await pausa(400);

  const i = await capitoloConQuiz();
  if (i < 0) { console.log('  ✗ nessun capitolo con quiz: la prova non può provare niente'); process.exit(1); }
  const cap = await val(`LESSON.chapters[state.current].id`);
  const lez = await val(`LESSON.id`);
  console.log('  capitolo ' + (i + 1) + ' della lezione «' + lez + '»');

  /* Si parte puliti: la copia del vault può portarsi dietro la storia di una
     prova precedente, e misurare su un terreno sporco non misura niente. */
  await val(`(async()=>{ await window.vault.ripasso.salva(corsoAttivo(), {}); await ripassoCarica(); return 1; })()`);
  ok('si parte senza storia', null, await val(`state.learn[${JSON.stringify(cap)}]||null`));

  console.log('\n== Rispondere scrive su disco, non solo a schermo');
  /* ⚠️ Prima si porta il bottone SOTTO GLI OCCHI. Il click di CDP arriva a
     coordinate dello schermo, e il quiz sta in fondo al capitolo: senza questo,
     il colpo cade nel vuoto e il rosso accusa il salvataggio per una risposta
     che nessuno ha dato. È la stessa trappola delle note, stesso giorno. */
  await val(`(()=>{document.querySelector('.quiz .q .opt').scrollIntoView({block:'center'}); return 1;})()`);
  await pausa(350);
  await clicca('.quiz .q .opt');
  await pausa(900);
  const dopo = await val(`(()=>({ etichetta:state.learn[${JSON.stringify(cap)}]||null,
    carte:Object.keys(RIPASSO.carte).length }))()`);
  console.log('   etichetta: ' + dopo.etichetta + ' · carte in memoria: ' + dopo.carte);
  ok('il capitolo ha preso un\'etichetta', true, !!dopo.etichetta);
  ok('e c\'è una carta registrata', true, dopo.carte >= 1);
  ok('la carta sta nel file, non solo in memoria', true,
    await val(`(async()=>{const r=await window.vault.ripasso.leggi(corsoAttivo());
      return Object.keys((r&&r.carte)||{}).length>=1;})()`));
  ok('e la carta sa a quale capitolo appartiene', true,
    await val(`(async()=>{const r=await window.vault.ripasso.leggi(corsoAttivo());
      return Object.keys(r.carte).some(k=>r.carte[k].capitolo===${JSON.stringify(cap)});})()`));

  console.log('\n== Cambiare lezione non la cancella più');
  /* ⚠️ Era esattamente questa la riga che buttava via tutto: `loadLesson`
     faceva `state.learn={}`. Il gesto più comune dell'app cancellava il dato
     più costoso, e nessuno se ne accorgeva perché non era mai stato scritto. */
  const altra = await val(`Object.keys(LESSONS).filter(k=>k!==LESSON.id)[0]||''`);
  if (altra) { await val(`loadLesson(${JSON.stringify(altra)}), 1`); await pausa(500); }
  await val(`loadLesson(${JSON.stringify(lez)}), 1`); await pausa(600);
  ok('tornando, l\'etichetta è ancora lì', dopo.etichetta,
    await val(`state.learn[${JSON.stringify(cap)}]||null`));

  console.log('\n== E nemmeno riavviare la pagina');
  await val('location.reload(), 1'); await pausa(2000); await collega(); await pausa(800);
  await val(`loadLesson(${JSON.stringify(lez)}), 1`); await pausa(700);
  ok('dopo la ricarica, la storia c\'è ancora', dopo.etichetta,
    await val(`state.learn[${JSON.stringify(cap)}]||null`));
  ok('l\'indice la mostra', true,
    await val(`(()=>{const li=[...document.querySelectorAll('#toc li')]
      .filter(x=>x.className.indexOf('st-')>=0); return li.length>0;})()`));

  console.log('\n== Una carta che non esiste più si pota, e lo si dice');
  await val(`(async()=>{
    const c=Object.assign({}, RIPASSO.carte);
    c['fantasma00000']={ id:'fantasma00000', capitolo:${JSON.stringify(cap)}, esito:'buono', storia:[] };
    await window.vault.ripasso.salva(corsoAttivo(), c); await ripassoCarica(); return 1; })()`);
  ok('la carta finta c\'è', true, await val(`!!RIPASSO.carte['fantasma00000']`));
  const potate = await val(`(async()=>{
    const vive=[];
    for(const lid in LESSONS) ((LESSONS[lid]||{}).chapters||[]).forEach(function(c){
      (c.quiz||[]).forEach(function(q){ vive.push({ capitolo:c.id, domanda:String(q.q||'') }); }); });
    const r=await window.vault.ripasso.pota(corsoAttivo(), vive);
    await ripassoCarica();
    return { tolte:r.tolte, restaFantasma:!!RIPASSO.carte['fantasma00000'], restaVera:Object.keys(RIPASSO.carte).length };})()`);
  ok('la potatura la toglie', [1, false], [potate.tolte, potate.restaFantasma]);
  ok('e non porta via quelle vere', true, potate.restaVera >= 1);

  console.log(ko ? '\n✗ ' + ko + ' controlli falliti' : '\n✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
