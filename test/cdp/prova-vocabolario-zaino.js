/* Nello zaino l'app non nomina cose che qui non esistono.
 *
 * ⚠️ PERCHÉ QUESTA PROVA ESISTE. Il codice è condiviso con l'app che ha anche i corsi, e i
 * messaggi scritti là parlano di corsi, lezioni, capitoli e del registro «Generata». Letti qui
 * mandano l'utente a cercare un bottone che non c'è: l'8 settembre 2026 il vuoto della mappa
 * diceva «torna su «Generata» e premi «Modifica una copia»», e il nome occupato diceva «esiste
 * già un corso o uno zaino con questo nome» — dove i corsi non si vedono nemmeno.
 *
 * Non prova le PAROLE esatte (cambiano): prova che le parole VIETATE non ci siano.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-vocabolario-zaino.js
 */
const S = require('path').join(__dirname, 'cdp.js');
const { collega, val, pausa, partiPulito, apriStrumento } = require(S);

let ko = 0;
const VIETATE = /\b(corso|corsi|lezione|lezioni|capitolo|capitoli)\b/i;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

(async () => {
  await collega();
  await partiPulito();

  sezione('Il vuoto della mappa parla di zaini, non di lezioni');
  await apriStrumento('mappa');
  await pausa(700);
  /* ⚠️ Si CHIUDE la mappa che la prova prima ha lasciato aperta: il riquadro del vuoto compare
     solo quando non c'è nessun grafo, e con una mappa a schermo questa prova misurava una
     stringa vuota. Passava da sola e cadeva in catena — la trappola di sempre.
     ⚠️ E il registro si forza a «generata» apposta: è lo stato da cui usciva il messaggio
     sbagliato. Un utente non ci arriva dai comandi, ma il codice sì, e il testo deve andare bene
     comunque. Alla fine si rimette tutto dove deve stare. */
  const vuoto = await val(`(()=>{ try{ mappaChiudi(); }catch(e){}
    MAPPA.registro='generata'; mappaRidisegna();
    const v=document.getElementById('mVuota');   /* ⚠️ l'id è «mVuota», non «mappaVuota» */
    return (v && v.textContent || '').trim(); })()`);
  console.log('   ' + JSON.stringify(vuoto.slice(0, 120)));
  ok('il vuoto della mappa dice qualcosa', true, vuoto.length > 10);
  ok('e non nomina corsi, lezioni o capitoli', false, VIETATE.test(vuoto));
  await val(`(()=>{ mappaRegistroCoerente(); mappaRidisegna(); return 1; })()`);
  await pausa(200);

  sezione('Il rifiuto di un nome già preso parla di cartelle, non di corsi');
  /* Si chiede di creare uno zaino con il nome di uno che c'è già: torna l'errore e non crea
     niente. È il messaggio che legge chi sbaglia nome. */
  const preso = await val(`(async()=>{ const l=await window.vault.zaino.list();
    if(!l || !l.length) return '';
    const r=await window.vault.zaino.create(l[0].title || l[0].id);
    return (r && r.error) || ''; })()`);
  console.log('   ' + JSON.stringify(preso));
  ok('il nome già preso viene rifiutato', true, preso.length > 5);
  ok('e il rifiuto non nomina corsi', false, VIETATE.test(preso));

  console.log(ko ? '\n✗ ' + ko + ' controlli falliti' : '\n✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
