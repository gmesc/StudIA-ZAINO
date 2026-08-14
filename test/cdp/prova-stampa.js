/* Il foglio di stampa, nell'app viva.
 *
 * ⚠️ Che cosa difende. Le regole di stampa le scrive `stampaPrepara()` al
 * momento, dentro `#stampaRegole`: se quel cablaggio si rompe — il modulo non
 * caricato, il tipo di foglio non passato, il <style> rinominato — l'app
 * continua a stampare, ma su foglio LETTER coi margini di fabbrica e senza
 * numeri di pagina, cioè esattamente il difetto misurato il 14 agosto. Non si
 * vede a schermo e non lancia nessun errore: si vede solo sul PDF, dopo.
 *
 * Qui NON si misura il PDF (serve il main, e il dialogo di stampa è modale):
 * si misura che le regole ci siano e dicano le cose giuste. La misura sul PDF
 * vero — margini in millimetri, corpo in punti — sta nell'handoff del 14
 * agosto, presa a 150 dpi sull'inchiostro.
 *
 *   ./test/cdp/con-vault-di-prova.sh prova-stampa.js
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

  sezione('Il modulo della carta è caricato');
  ok('c’è, e sa dire i due formati', ['A4 portrait', 'A4 landscape'],
    await val(`[StampaFoglio.formato('testo').size, StampaFoglio.formato('mappa').size]`));

  sezione('Un appunto: foglio verticale, margini da lettura, numeri di pagina');
  const testo = await val(`(()=>{
    const tipo = stampaPrepara({ titolo:'Prova di stampa', dove:'Lezione 3',
      html:'<p>Un paragrafo.</p><h4>Un titolo</h4><p>Un altro paragrafo.</p>' });
    const r = document.getElementById('stampaRegole').textContent;
    const f = document.getElementById('stampaFoglio');
    return { tipo:tipo,
      a4: /size:A4 portrait/.test(r), margini: /margin:20mm 20mm 25mm 20mm/.test(r),
      numeri: /counter\\(page\\) " di " counter\\(pages\\)/.test(r),
      marchio: /@bottom-left \\{ content:"StudIA · Lezione 3"/.test(r),
      titolo: (f.querySelector('.st-titolo')||{}).textContent,
      dove: (f.querySelector('.st-dove')||{}).textContent,
      corpo: !!f.querySelector('.st-corpo p') }; })()`);
  ok('il tipo di foglio è «testo»', 'testo', testo.tipo);
  ok('A4 verticale', true, testo.a4);
  ok('margini 20/20/25/20', true, testo.margini);
  ok('il piè conta le pagine', true, testo.numeri);
  ok('e a sinistra dice dove si sta lavorando', true, testo.marchio);
  ok('la testata porta titolo e contesto', ['Prova di stampa', true],
    [testo.titolo, /Lezione 3 · \d\d\/\d\d\/\d{4}/.test(testo.dove || '')]);
  ok('e il corpo è dentro il foglio', true, testo.corpo);

  sezione('Una mappa: foglio coricato, e il disegno capato in millimetri');
  const mappa = await val(`(()=>{
    const tipo = stampaPrepara({ titolo:'Mappa', classe:'foglio-mappa', tipo:'mappa',
      html:'<svg viewBox="0 0 100 50"><rect width="100" height="50"></rect></svg>' });
    const r = document.getElementById('stampaRegole').textContent;
    return { tipo:tipo, a4: /size:A4 landscape/.test(r),
      tetto: /max-height:164mm/.test(r), vh: /vh/.test(r),
      classe: document.getElementById('stampaFoglio').className }; })()`);
  ok('il tipo di foglio è «mappa»', 'mappa', mappa.tipo);
  ok('A4 coricato', true, mappa.a4);
  ok('il tetto del disegno è in mm', true, mappa.tetto);
  /* ⚠️ `vh` in stampa non è l’altezza della pagina: col vecchio `max-height:92vh`
     il disegno restava alto due terzi, con 72mm di bianco sotto (misurato). */
  ok('e nessun `vh` è rimasto in giro', false, mappa.vh);
  ok('il foglio porta la sua classe', 'foglio-mappa', mappa.classe);

  sezione('⚠️ Il foglio non deve mai vedersi a schermo');
  ok('è invisibile', 'none',
    await val(`getComputedStyle(document.getElementById('stampaFoglio')).display`));

  /* Si lascia il foglio vuoto, come lo trova chi non ha stampato. */
  await val(`(()=>{ const f=document.getElementById('stampaFoglio');
    f.innerHTML=''; f.className=''; return 1; })()`);

  console.log(ko ? `\n✗ ${ko} controlli falliti` : '\n✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('prova-stampa: ' + (e && e.message)); process.exit(1); });
