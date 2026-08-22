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
  /* ⚠️ Questo controllo diceva il contrario fino al 19 agosto 2026 («la testata
     porta titolo e contesto»), ed è cambiato con la promessa: l'app non scrive
     più niente SOPRA il contenuto di chi stampa. Il titolo di un appunto sta
     nella sua prima riga, quello di una mappa nel nome del file; il piè, che
     dice da dove viene il foglio, resta — ed è misurato due righe più su.
     Una prova che descrive una promessa va riscritta insieme alla promessa. */
  ok('niente testata sopra il contenuto', [undefined, undefined],
    [testo.titolo, testo.dove]);
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

  sezione('Il documento che va al main: ripulito, e con la sua base');
  /* ⚠️ Gli script si CONTANO analizzando il documento, non cercando «<script»
     nel testo: uno dei commenti del monolite nomina quel tag in prosa, e la
     prima stesura di questa prova accusava il codice per una frase. */
  const doc = await val(`(()=>{ stampaPrepara({ titolo:'Prova', html:'<p>Testo.</p>' });
    const d = documentoStampabile();
    const dom = new DOMParser().parseFromString(d, 'text/html');
    return { script: dom.querySelectorAll('script').length,
      base: /<base href="file:[^"]+\\/"/.test(d),
      foglio: !!dom.querySelector('#stampaFoglio'), banco: !!dom.querySelector('#banco'),
      regole: /size:A4 portrait/.test(d), kb: Math.round(d.length/1024) }; })()`);
  /* ⚠️ Gli `<script>` vanno via: la finestra che stampa li ESEGUIREBBE, e
     l'app ripartirebbe dentro il PDF con un secondo accesso al disco. */
  ok('nessuno script', 0, doc.script);
  ok('c’è il `<base>` sulla cartella dell’app', true, doc.base);
  ok('c’è il foglio', true, doc.foglio);
  /* ⚠️ E NON c’è il resto dell’interfaccia: sarebbero megabyte di icone in
     base64 spediti al main a ogni salvataggio. */
  ok('e non c’è il banco', false, doc.banco);
  console.log('   il documento pesa ' + doc.kb + ' KB');
  ok('le regole di stampa viaggiano col documento', true, doc.regole);

  sezione('Salva come PDF: il file esiste davvero');
  const fs = require('fs'), os = require('os'), path = require('path');
  const dove = path.join(os.tmpdir(), 'studia-prova-stampa-' + process.pid + '.pdf');
  /* `percorso` salta il dialogo di sistema, che una prova non può premere;
     `foglio` dà il contenuto già pronto.
     ⚠️ Il contenuto arriva da qui e non da un appunto aperto, e va detto che
     cosa si misura: questa sezione prova la CATENA — documento → main →
     finestra invisibile → file scritto — non che l'appunto si impagini bene
     (quello lo misurano le sezioni sopra, e il PDF a mano). La prima stesura
     chiamava `salvaPdf('appunto')` a schermo vuoto: da sola passava, in suite
     no, perché lì nessun appunto è aperto e la funzione si ferma prima. */
  const scritto = await val(`salvaPdf('appunto', { percorso:${JSON.stringify(dove)},
    foglio:{ titolo:'Prova PDF', dove:'Prove', html:'<p>Testo.</p><p>Altro testo.</p>' } })`);
  const esiste = fs.existsSync(dove);
  const grande = esiste ? fs.statSync(dove).size : 0;
  ok('il PDF è stato scritto dove chiesto', true, !!scritto && esiste);
  ok('e non è un file vuoto', true, grande > 3000);
  ok('comincia con la firma di un PDF', '%PDF',
    esiste ? fs.readFileSync(dove).slice(0, 4).toString() : '');
  console.log('   ' + Math.round(grande / 1024) + ' KB');
  try { fs.unlinkSync(dove); } catch (e) { /* la prova non lascia file in giro */ }

  sezione('Sul foglio: niente testata per un appunto, e nessun rimando morto');
  /* ⚠️ Il markdown è quello vero di un appunto: un link esterno scritto, un
     indirizzo NUDO, e due rimandi dell'app. I primi due devono restare
     cliccabili anche su carta — è il motivo per cui uno scrive una fonte — e i
     secondi no: fuori dall'app non portano da nessuna parte, e un'ancora che
     non porta niente in un PDF è un'annotazione che promette. */
  const MD = 'Fonte: [Consensus](https://www.iss.it).\n\nOppure https://www.iss.it/dsa nudo.\n\n'
           + 'Vedi la [p. 7](pdf:03#p=7) e il [capitolo](cap:01-x-c02).';
  const foglio = await val(`(()=>{
    stampaPrepara({ titolo:'Prova', dove:'Prove', html:renderNoteMd(${JSON.stringify(MD)}) });
    const f=document.getElementById('stampaFoglio');
    return { testata:!!f.querySelector('.st-testa'),
             vivi:[...f.querySelectorAll('.st-corpo a[href]')].map(a=>a.getAttribute('href')),
             morti:f.querySelectorAll('.st-corpo a[href="#"]').length,
             spenti:f.querySelectorAll('.st-corpo span.plink, .st-corpo span.clink').length,
             testo:f.querySelector('.st-corpo').textContent.indexOf('p. 7')>=0 }; })()`);
  ok('il foglio non porta la testata', false, foglio.testata);
  ok('i due indirizzi veri restano cliccabili',
    ['https://www.iss.it', 'https://www.iss.it/dsa'], foglio.vivi);
  ok('nessun rimando morto è rimasto un’ancora', 0, foglio.morti);
  ok('…sono diventati testo, con le loro classi', 2, foglio.spenti);
  ok('e il testo del rimando non si è perso', true, foglio.testo);
  /* ⚠️ Nemmeno la mappa: l'app non scrive più niente sopra il contenuto di chi
     stampa. Il titolo di una mappa sta nel nome del file, quello di un appunto
     nella sua prima riga. */
  const conTesta = await val(`(()=>{
    stampaPrepara({ titolo:'Una mappa', dove:'Prove', classe:'foglio-mappa', tipo:'mappa', html:'<svg></svg>' });
    return !!document.querySelector('#stampaFoglio .st-testa'); })()`);
  ok('e nemmeno la mappa', false, conTesta);
  /* Il piè invece resta: dice da dove viene il foglio e a che pagina si è,
     cioè le due cose che il contenuto non può portarsi dietro. */
  ok('il piè è ancora nelle regole', true,
    await val(`(document.getElementById('stampaRegole').textContent||'').indexOf('@bottom')>=0`));

  sezione('Il nome proposto è quello con cui la cosa è salvata');
  /* ⚠️ Si misura la REGOLA, non il dialogo: con `percorso` il dialogo non si
     apre (una prova non può premerlo) e il nome proposto non lo vedrebbe
     nessuno. La regola sta in una funzione sua, ed è la stessa che `salvaPdf`
     chiama — una porta sola, come per tutto il resto. */
  const nomi = await val(`[ stampaNomeFile('Decodifica'),
    stampaNomeFile('Mappa: la lettura/decodifica'),
    stampaNomeFile('   '), stampaNomeFile(''),
    stampaNomeFile('decodifica.md'), stampaNomeFile('mia-mappa.json') ]`);
  ok('il nome è quello con cui la cosa è salvata', 'Decodifica', nomi[0]);
  ok('i caratteri che il disco non ama diventano spazi', 'Mappa la lettura decodifica', nomi[1]);
  ok('e senza titolo non si resta senza nome', ['StudIA', 'StudIA'], [nomi[2], nomi[3]]);
  /* ⚠️ Nessuna data appiccicata: fino al 19 agosto si aggiungeva « — 19 ago
     2026» per «ritrovarlo fra un mese», e il PDF non si riconosceva più come la
     copia dell'appunto che porta lo stesso nome. La data la porta il disco. */
  ok('nessuna data nel nome', false, /\d{4}|ago|gen|feb/.test(nomi[0]));
  /* Senza titolo si ripiega sul nome del file, e allora l'estensione va tolta:
     al dialogo arriverebbe «decodifica.md.pdf». */
  ok('l’estensione dell’originale non si porta dietro',
    ['decodifica', 'mia-mappa'], [nomi[4], nomi[5]]);

  sezione('Nel PDF i link veri restano, quelli morti no');
  const dovePdf = path.join(os.tmpdir(), 'studia-prova-link-' + process.pid + '.pdf');
  await val('salvaPdf(\'appunto\', { percorso:' + JSON.stringify(dovePdf) + ', foglio:{ titolo:\'Prova link\', dove:\'Prove\','
    + ' html:renderNoteMd(' + JSON.stringify(MD) + ') } })');
  const pdf = fs.existsSync(dovePdf) ? fs.readFileSync(dovePdf).toString('latin1') : '';
  /* ⚠️ Si contano le ANNOTAZIONI, non le parole: un indirizzo scritto nel testo
     compare nel PDF comunque: è il `/Link` che dice se si può premere. */
  ok('due annotazioni, quante sono le fonti vere', 2, (pdf.match(/\/Link/g) || []).length);
  ok('e l’indirizzo è finito dentro il file', true, pdf.indexOf('iss.it') >= 0);
  try { fs.unlinkSync(dovePdf); } catch (e) {}

  /* Si lascia il foglio vuoto, come lo trova chi non ha stampato. */
  await val(`(()=>{ const f=document.getElementById('stampaFoglio');
    f.innerHTML=''; f.className=''; return 1; })()`);

  console.log(ko ? `\n✗ ${ko} controlli falliti` : '\n✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('prova-stampa: ' + (e && e.message)); process.exit(1); });
